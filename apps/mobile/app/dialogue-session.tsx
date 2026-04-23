/**
 * Dialogue Session — multi-party written dialogue
 * Route: /dialogue-session?dialogueId=<uuid>
 *
 * Loads dialogue + all participants from SQLite.
 * status='active'   → active mode (input visible)
 * status='complete' → read-only mode ("Continue" button to reactivate)
 *
 * Ground button always visible in active mode.
 * Self messages: right-aligned, gold background.
 * Part messages: left-aligned, type-color background, avatar + name label.
 *
 * Speaker chips row: horizontally scrollable. "+ Add" chip opens a modal
 * to add existing parts or create a new one mid-dialogue.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getDatabase } from '@/lib/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type PartType = 'manager' | 'firefighter' | 'exile' | 'self' | 'unknown';

type NewPartType = 'manager' | 'firefighter' | 'exile' | 'unknown';

interface PartRow {
  id: string;
  display_name: string;
  type: PartType;
}

interface Message {
  id: string;
  part_id: string | null; // null = Self
  content: string;
  created_at: string;
}

interface DialogueRow {
  id: string;
  title: string | null;
  part_id: string | null;
  participants_json: string | null;
  messages_json: string | null;
  status: string | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<PartType, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
  unknown:     '#6B6860',
};

const TYPE_LABEL: Record<NewPartType, string> = {
  manager:     'Manager',
  firefighter: 'Firefighter',
  exile:       'Exile',
  unknown:     'Unknown',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function nowIso(): string {
  return new Date().toISOString();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// Handles both new format (string[]) and old format ({part_id, is_self}[])
function parseParticipantIds(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    if (parsed.length > 0 && typeof parsed[0] === 'string') return parsed as string[];
    return (parsed as { part_id: string; is_self?: number }[])
      .filter((p) => !p.is_self)
      .map((p) => p.part_id);
  } catch {
    return [];
  }
}

// Handles both new message format and old {participant_id, text, timestamp} format
function parseMessages(json: string | null): Message[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    if ('content' in parsed[0]) return parsed as Message[];
    // Legacy format: {participant_id, text, timestamp}
    return (parsed as { participant_id: string; text: string; timestamp: string }[])
      .map((m, i) => ({
        id:         `legacy_${i}`,
        part_id:    m.participant_id === 'self' ? null : m.participant_id,
        content:    m.text,
        created_at: m.timestamp,
      }));
  } catch {
    return [];
  }
}

function getTypeColor(type: PartType | undefined): string {
  return type ? (TYPE_COLOR[type] ?? '#6B6860') : '#B88A00';
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Grounding Overlay ────────────────────────────────────────────────────────

function GroundingOverlay({
  visible,
  onReturn,
  onEndAndSave,
}: {
  visible: boolean;
  onReturn: () => void;
  onEndAndSave: () => void;
}) {
  const breathAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) { breathAnim.setValue(1); return undefined; }
    breathAnim.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1.8, duration: 5000, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 1,   duration: 5000, useNativeDriver: true }),
      ]),
      { iterations: 3 },
    );
    loop.start();
    return () => { loop.stop(); breathAnim.setValue(1); };
  }, [visible, breathAnim]);

  if (!visible) return null;

  return (
    <View style={overlayStyles.root}>
      <Text style={overlayStyles.headline}>Let's slow down.</Text>
      <View style={overlayStyles.breathWrapper}>
        <Animated.View style={[overlayStyles.circle, { transform: [{ scale: breathAnim }] }]} />
      </View>
      <Text style={overlayStyles.instruction}>Feel your feet on the floor.</Text>
      <Text style={overlayStyles.instruction}>
        Notice three things you can see right now.
      </Text>
      <View style={overlayStyles.buttons}>
        <Pressable
          style={({ pressed }) => [overlayStyles.returnBtn, pressed && { opacity: 0.85 }]}
          onPress={onReturn}
        >
          <Text style={overlayStyles.returnBtnText}>
            I feel steadier — return to dialogue
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [overlayStyles.endBtn, pressed && { opacity: 0.85 }]}
          onPress={onEndAndSave}
        >
          <Text style={overlayStyles.endBtnText}>End dialogue and save</Text>
        </Pressable>
      </View>
    </View>
  );
}

const overlayStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,25,23,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 100,
  },
  headline: { fontSize: 24, fontWeight: '600', color: '#FFFFFF', marginBottom: 48, textAlign: 'center' },
  breathWrapper: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 48 },
  circle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  instruction: { fontSize: 16, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 24, marginBottom: 10 },
  buttons: { width: '100%', marginTop: 40, gap: 12 },
  returnBtn: { backgroundColor: '#3B5BA5', borderRadius: 4, paddingVertical: 14, alignItems: 'center' },
  returnBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  endBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 4, paddingVertical: 14, alignItems: 'center' },
  endBtnText: { color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: '500' },
});

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  part,
  showName,
  multiParty,
}: {
  message: Message;
  part: PartRow | undefined;
  showName: boolean;
  multiParty: boolean;
}) {
  const isSelf      = message.part_id === null;
  const color       = getTypeColor(part?.type);
  const initials    = part ? getInitials(part.display_name) : '?';
  // Show name above part bubble: always if multi-party, first-only if single-party
  const renderName  = !isSelf && (multiParty || showName);

  return (
    <View style={[bubbleStyles.wrapper, isSelf ? bubbleStyles.selfWrapper : bubbleStyles.partWrapper]}>
      {renderName && (
        <Text style={bubbleStyles.partLabel}>{part?.display_name ?? '…'}</Text>
      )}
      <View style={isSelf ? bubbleStyles.selfRow : bubbleStyles.partRow}>
        {!isSelf && (
          <View style={[bubbleStyles.avatar, { backgroundColor: color }]}>
            <Text style={bubbleStyles.avatarText}>{initials}</Text>
          </View>
        )}
        <View style={[
          bubbleStyles.bubble,
          isSelf
            ? bubbleStyles.selfBubble
            : [bubbleStyles.partBubble, { backgroundColor: color + 'DD' }],
        ]}>
          <Text style={bubbleStyles.text}>{message.content}</Text>
        </View>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  wrapper: { marginVertical: 3, maxWidth: '82%' },
  selfWrapper: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  partWrapper: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  partLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 3, paddingLeft: 36 },
  selfRow: { flexDirection: 'row', alignItems: 'flex-end' },
  partRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, flexShrink: 1 },
  selfBubble: { backgroundColor: '#B88A00', borderBottomRightRadius: 4 },
  partBubble: { borderBottomLeftRadius: 4 },
  text: { fontSize: 15, color: '#FFFFFF', lineHeight: 22 },
});

// ─── Add Part Modal ───────────────────────────────────────────────────────────

function AddPartModal({
  visible,
  availableParts,
  onAddPart,
  onCreatePart,
  onClose,
}: {
  visible: boolean;
  availableParts: PartRow[];
  onAddPart: (part: PartRow) => void;
  onCreatePart: () => void;
  onClose: () => void;
}) {
  const isEmpty = availableParts.length === 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={addPartStyles.backdrop} onPress={onClose} />
      <View style={addPartStyles.sheet}>
        {/* Handle */}
        <View style={addPartStyles.handle} />

        <Text style={addPartStyles.sheetTitle}>Add a Part</Text>

        {isEmpty ? (
          /* Empty state — all parts already in dialogue */
          <View style={addPartStyles.emptyState}>
            <Ionicons name="people-outline" size={40} color="rgba(255,255,255,0.25)" />
            <Text style={addPartStyles.emptyTitle}>All your parts are in this dialogue</Text>
            <Text style={addPartStyles.emptySubtitle}>
              Something new can still emerge.
            </Text>
            <Pressable
              style={({ pressed }) => [addPartStyles.createBtn, pressed && { opacity: 0.85 }]}
              onPress={onCreatePart}
            >
              <Ionicons name="add" size={16} color="#1A1917" />
              <Text style={addPartStyles.createBtnText}>Create New Part</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <FlatList
              data={availableParts}
              keyExtractor={(item) => item.id}
              style={addPartStyles.list}
              contentContainerStyle={addPartStyles.listContent}
              renderItem={({ item }) => {
                const color = getTypeColor(item.type);
                return (
                  <Pressable
                    style={({ pressed }) => [addPartStyles.partRow, pressed && { opacity: 0.75 }]}
                    onPress={() => onAddPart(item)}
                  >
                    {/* Type-color avatar */}
                    <View style={[addPartStyles.partAvatar, { backgroundColor: color }]}>
                      <Text style={addPartStyles.partAvatarText}>
                        {getInitials(item.display_name)}
                      </Text>
                    </View>
                    {/* Name */}
                    <Text style={addPartStyles.partName} numberOfLines={1}>
                      {item.display_name}
                    </Text>
                    {/* Type pill */}
                    <View style={[addPartStyles.typePill, { backgroundColor: color + '33', borderColor: color + '66' }]}>
                      <Text style={[addPartStyles.typePillText, { color }]}>
                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={addPartStyles.separator} />}
            />

            {/* Add a New Part — prominent full-width button */}
            <TouchableOpacity
              style={addPartStyles.emergingBtn}
              onPress={onCreatePart}
              activeOpacity={0.75}
            >
              <Ionicons name="add" size={22} color="#3B5BA5" />
              <Text style={addPartStyles.emergingBtnText}>Add a New Part</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const addPartStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#252320',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 10,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  list: { flexShrink: 1 },
  listContent: { paddingHorizontal: 16 },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  partAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  partAvatarText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  partName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  typePillText: { fontSize: 11, fontWeight: '600' },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 4,
  },
  emergingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: 'rgba(59, 91, 165, 0.12)',
    borderWidth: 1.5,
    borderColor: '#3B5BA5',
    borderRadius: 12,
  },
  emergingBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B5BA5',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 8,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#B88A00',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  createBtnText: { fontSize: 15, fontWeight: '600', color: '#1A1917' },
});

// ─── Create Part Modal ────────────────────────────────────────────────────────

function CreatePartModal({
  visible,
  onAdd,
  onClose,
}: {
  visible: boolean;
  onAdd: (name: string, job: string, type: NewPartType) => void;
  onClose: () => void;
}) {
  const [name, setName]         = useState('');
  const [job, setJob]           = useState('');
  const [type, setType]         = useState<NewPartType>('unknown');
  const nameRef = useRef<TextInput & { focus(): void }>(null);

  // Reset form when opened
  useEffect(() => {
    if (visible) {
      setName('');
      setJob('');
      setType('unknown');
      // Small delay so modal is fully rendered before focus
      setTimeout(() => nameRef.current?.focus(), 200);
    }
  }, [visible]);

  const canAdd = name.trim().length > 0;

  const NEW_PART_TYPES: NewPartType[] = ['manager', 'firefighter', 'exile', 'unknown'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={createStyles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={createStyles.kavWrapper}
      >
        <View style={createStyles.sheet}>
          {/* Handle */}
          <View style={createStyles.handle} />

          <Text style={createStyles.title}>Name This Part</Text>

          {/* Name field */}
          <View style={createStyles.fieldGroup}>
            <Text style={createStyles.fieldLabel}>Name *</Text>
            <TextInput
              ref={nameRef}
              style={createStyles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="What do you want to call this part?"
              placeholderTextColor="rgba(255,255,255,0.25)"
              returnKeyType="next"
              autoCorrect={false}
            />
          </View>

          {/* Job field */}
          <View style={createStyles.fieldGroup}>
            <Text style={createStyles.fieldLabel}>What is this part trying to do?</Text>
            <TextInput
              style={createStyles.textInput}
              value={job}
              onChangeText={setJob}
              placeholder="Optional"
              placeholderTextColor="rgba(255,255,255,0.25)"
              returnKeyType="done"
              multiline
            />
          </View>

          {/* Type chips */}
          <View style={createStyles.fieldGroup}>
            <Text style={createStyles.fieldLabel}>Type</Text>
            <View style={createStyles.typeRow}>
              {NEW_PART_TYPES.map((t) => {
                const isActive = type === t;
                const color    = TYPE_COLOR[t];
                return (
                  <Pressable
                    key={t}
                    style={[
                      createStyles.typeChip,
                      { borderColor: color },
                      isActive && { backgroundColor: color },
                    ]}
                    onPress={() => setType(t)}
                  >
                    <Text
                      style={[
                        createStyles.typeChipText,
                        !isActive && { color, opacity: 0.75 },
                      ]}
                    >
                      {TYPE_LABEL[t]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Helper note */}
          <Text style={createStyles.helperNote}>
            You can add more details to this part's profile later.
          </Text>

          {/* Add to Dialogue button */}
          <Pressable
            style={({ pressed }) => [
              createStyles.addBtn,
              !canAdd && createStyles.addBtnDisabled,
              pressed && canAdd && { opacity: 0.85 },
            ]}
            onPress={() => {
              if (canAdd) onAdd(name.trim(), job.trim(), type);
            }}
            disabled={!canAdd}
          >
            <Text style={createStyles.addBtnText}>Add to Dialogue</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  kavWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#252320',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 10,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  helperNote: {
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.35)',
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 20,
  },
  addBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.35 },
  addBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DialogueSessionScreen() {
  const { dialogueId, readOnly: readOnlyParam } = useLocalSearchParams<{ dialogueId: string; readOnly?: string }>();

  const [dialogue, setDialogue]         = useState<DialogueRow | null>(null);
  const [participants, setParticipants] = useState<PartRow[]>([]);
  const [messages, setMessages]         = useState<Message[]>([]);
  const [readOnly, setReadOnly]         = useState(false);
  // null = Self is the active speaker
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [inputText, setInputText]       = useState('');
  const [showGrounding, setShowGrounding] = useState(false);

  // Add Part modal state
  const [showAddPartModal, setShowAddPartModal]   = useState(false);
  const [availableParts, setAvailableParts]       = useState<PartRow[]>([]);
  const [showCreatePartModal, setShowCreatePartModal] = useState(false);

  const flatListRef = useRef<FlatList<Message>>(null);

  // ── Load dialogue + participants ───────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      if (!dialogueId) return;
      const db = getDatabase();

      db.getFirstAsync<DialogueRow>(
        `SELECT id, title, part_id, participants_json, messages_json, status, created_at
         FROM inner_dialogues WHERE id = ?`,
        [dialogueId],
      ).then(async (row) => {
        if (!row) return;
        setDialogue(row);
        setReadOnly(row.status === 'complete' || readOnlyParam === '1');
        setMessages(parseMessages(row.messages_json));

        const partIds = parseParticipantIds(row.participants_json);
        if (partIds.length > 0) {
          const placeholders = partIds.map(() => '?').join(',');
          const parts = await db.getAllAsync<PartRow>(
            `SELECT id, COALESCE(custom_name, name) AS display_name, type
             FROM parts WHERE id IN (${placeholders})`,
            partIds,
          );
          setParticipants(parts);
        }
      }).catch((e) => console.error('[DialogueSession] load:', e));
    }, [dialogueId]),
  );

  // ── Persist messages ──────────────────────────────────────────────────────

  async function persistMessages(msgs: Message[]) {
    if (!dialogueId) return;
    try {
      await getDatabase().runAsync(
        `UPDATE inner_dialogues SET messages_json = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(msgs), nowIso(), dialogueId],
      );
    } catch (e) {
      console.error('[DialogueSession] persist:', e);
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────

  async function handleSend() {
    const text = inputText.trim();
    if (!text) return;
    const newMsg: Message = {
      id:         generateId(),
      part_id:    activeSpeakerId,
      content:    text,
      created_at: nowIso(),
    };
    const updated = [...messages, newMsg];
    setMessages(updated);
    setInputText('');
    await persistMessages(updated);
  }

  // ── End & save ────────────────────────────────────────────────────────────

  async function handleEndAndSave() {
    setShowGrounding(false);
    if (dialogueId) {
      try {
        await getDatabase().runAsync(
          `UPDATE inner_dialogues SET status = 'complete', updated_at = ? WHERE id = ?`,
          [nowIso(), dialogueId],
        );
      } catch (e) {
        console.error('[DialogueSession] end:', e);
      }
    }
    // Navigate to the dialogue list for the primary part, or fall back to parts list
    const primaryPartId = dialogue?.part_id;
    if (primaryPartId) {
      router.replace(`/dialogue?id=${primaryPartId}`);
    } else {
      router.replace('/my-parts');
    }
  }

  // ── Android hardware back intercept ────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (!readOnly) {
          void handleEndAndSave();
          return true; // intercept in active mode — save and navigate away
        }
        return false; // allow default back in read-only mode
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [readOnly, dialogueId]),
  );

  // ── Continue (reactivate from read-only) ──────────────────────────────────

  async function handleContinue() {
    if (!dialogueId) return;
    try {
      await getDatabase().runAsync(
        `UPDATE inner_dialogues SET status = 'active', updated_at = ? WHERE id = ?`,
        [nowIso(), dialogueId],
      );
      setReadOnly(false);
    } catch (e) {
      console.error('[DialogueSession] continue:', e);
    }
  }

  // ── Add Part: open modal with available parts ─────────────────────────────

  async function handleOpenAddPart() {
    try {
      const db = getDatabase();
      const currentIds = participants.map((p) => p.id);
      let parts: PartRow[];
      if (currentIds.length > 0) {
        const placeholders = currentIds.map(() => '?').join(',');
        parts = await db.getAllAsync<PartRow>(
          `SELECT id, COALESCE(custom_name, name) AS display_name, type
           FROM parts WHERE id NOT IN (${placeholders}) ORDER BY name`,
          currentIds,
        );
      } else {
        parts = await db.getAllAsync<PartRow>(
          `SELECT id, COALESCE(custom_name, name) AS display_name, type
           FROM parts ORDER BY name`,
        );
      }
      setAvailableParts(parts);
      setShowAddPartModal(true);
    } catch (e) {
      console.error('[DialogueSession] openAddPart:', e);
    }
  }

  // ── Add existing part to dialogue ─────────────────────────────────────────

  async function handleAddExistingPart(part: PartRow) {
    if (!dialogueId) return;
    try {
      const updatedIds = [...participants.map((p) => p.id), part.id];
      await getDatabase().runAsync(
        `UPDATE inner_dialogues SET participants_json = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(updatedIds), nowIso(), dialogueId],
      );
      setParticipants((prev) => [...prev, part]);
      setActiveSpeakerId(part.id);
      setShowAddPartModal(false);
    } catch (e) {
      console.error('[DialogueSession] addExistingPart:', e);
    }
  }

  // ── Create new part mid-dialogue and add to session ───────────────────────

  async function handleCreatePart(
    name: string,
    job: string,
    type: NewPartType,
  ) {
    if (!dialogueId) return;
    try {
      const db     = getDatabase();
      const partId = generateId();
      const now    = nowIso();

      // Insert parts row
      await db.runAsync(
        `INSERT INTO parts (id, name, type, discovered_via, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [partId, name, type, 'dialogue', now, now],
      );

      // Insert part_profiles row (job optional)
      await db.runAsync(
        `INSERT INTO part_profiles (part_id, job, updated_at) VALUES (?, ?, ?)`,
        [partId, job || null, now],
      );

      // Add to dialogue participants
      const updatedIds = [...participants.map((p) => p.id), partId];
      await db.runAsync(
        `UPDATE inner_dialogues SET participants_json = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(updatedIds), now, dialogueId],
      );

      const newPart: PartRow = { id: partId, display_name: name, type };
      setParticipants((prev) => [...prev, newPart]);
      setActiveSpeakerId(partId);
      setShowCreatePartModal(false);
      setShowAddPartModal(false);
    } catch (e) {
      console.error('[DialogueSession] createPart:', e);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const partsMap   = new Map(participants.map((p) => [p.id, p]));
  const multiParty = participants.length > 1;

  const headerTitle = dialogue?.title
    ?? (dialogue ? `Dialogue — ${formatDate(dialogue.created_at)}` : 'Dialogue');

  const activeSpeakerColor = activeSpeakerId !== null
    ? getTypeColor(partsMap.get(activeSpeakerId)?.type)
    : '#B88A00'; // Self = gold

  // Single-part: show name only above first part bubble
  function shouldShowName(index: number): boolean {
    const msg = messages[index];
    if (msg.part_id === null) return false;
    if (multiParty) return true;
    return !messages.slice(0, index).some((m) => m.part_id !== null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <GroundingOverlay
        visible={showGrounding}
        onReturn={() => setShowGrounding(false)}
        onEndAndSave={handleEndAndSave}
      />

      {/* Add Part modal */}
      <AddPartModal
        visible={showAddPartModal}
        availableParts={availableParts}
        onAddPart={handleAddExistingPart}
        onCreatePart={() => {
          setShowAddPartModal(false);
          setShowCreatePartModal(true);
        }}
        onClose={() => setShowAddPartModal(false)}
      />

      {/* Create Part modal */}
      <CreatePartModal
        visible={showCreatePartModal}
        onAdd={handleCreatePart}
        onClose={() => setShowCreatePartModal(false)}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => { if (!readOnly) { void handleEndAndSave(); } else { router.back(); } }}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.85)" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {readOnly ? headerTitle : 'Active Dialogue'}
        </Text>
        {!readOnly ? (
          <Pressable onPress={handleEndAndSave} hitSlop={12} style={styles.endSaveBtn}>
            <Text style={styles.endSaveBtnText}>End & Save</Text>
          </Pressable>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      {/* Chat + input */}
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Messages */}
        <View style={styles.chatArea}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, i) => item.id ?? String(i)}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item, index }) => (
              <MessageBubble
                message={item}
                part={item.part_id ? partsMap.get(item.part_id) : undefined}
                showName={shouldShowName(index)}
                multiParty={multiParty}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatText}>
                  {readOnly
                    ? 'This dialogue has no messages.'
                    : 'Begin your dialogue below.'}
                </Text>
              </View>
            }
          />

          {/* Ground button — fixed bottom-right, above input */}
          {!readOnly && (
            <View
              style={styles.groundBtnWrapper}
              // @ts-ignore — pointerEvents works at runtime; RN types inconsistency
              pointerEvents="box-none"
            >
              <Pressable
                style={({ pressed }) => [styles.groundBtn, pressed && { opacity: 0.8 }]}
                onPress={() => setShowGrounding(true)}
              >
                <Ionicons name="shield-outline" size={15} color="#FFFFFF" />
                <Text style={styles.groundBtnText}>Ground</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Active input area OR read-only continue button */}
        {readOnly ? (
          <View style={styles.readOnlyFooter}>
            <TouchableOpacity
              style={styles.continueBtn}
              onPress={handleContinue}
              activeOpacity={0.85}
            >
              <Text style={styles.continueBtnText}>Continue this dialogue</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputArea}>
            {/* Participant selector — horizontally scrollable chips row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.speakerRow}
            >
              {/* Self chip */}
              <Pressable
                style={[
                  styles.speakerChip,
                  { borderColor: '#B88A00' },
                  activeSpeakerId === null && { backgroundColor: '#B88A00' },
                ]}
                onPress={() => setActiveSpeakerId(null)}
              >
                <Text
                  style={[
                    styles.speakerChipText,
                    activeSpeakerId !== null && styles.speakerChipTextInactive,
                  ]}
                >
                  Self
                </Text>
              </Pressable>

              {/* One chip per participant */}
              {participants.map((part) => {
                const isActive = activeSpeakerId === part.id;
                const color    = getTypeColor(part.type);
                return (
                  <Pressable
                    key={part.id}
                    style={[
                      styles.speakerChip,
                      { borderColor: color },
                      isActive && { backgroundColor: color },
                    ]}
                    onPress={() => setActiveSpeakerId(part.id)}
                  >
                    <Text
                      style={[
                        styles.speakerChipText,
                        !isActive && styles.speakerChipTextInactive,
                      ]}
                      numberOfLines={1}
                    >
                      {part.display_name}
                    </Text>
                  </Pressable>
                );
              })}

              {/* + Add chip */}
              <Pressable
                style={styles.addChip}
                onPress={handleOpenAddPart}
              >
                <Ionicons name="add" size={14} color="#6B6860" />
                <Text style={styles.addChipText}>Add</Text>
              </Pressable>
            </ScrollView>

            {/* Text input + send button */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder={
                  activeSpeakerId === null
                    ? 'Self says…'
                    : `${partsMap.get(activeSpeakerId)?.display_name ?? '…'} says…`
                }
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                returnKeyType="default"
              />
              <Pressable
                style={({ pressed }) => [
                  styles.sendBtn,
                  { backgroundColor: activeSpeakerColor },
                  pressed && { opacity: 0.7 },
                  !inputText.trim() && styles.sendBtnDisabled,
                ]}
                onPress={handleSend}
                disabled={!inputText.trim()}
              >
                <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A1917' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  headerRight: { width: 60 },
  endSaveBtn: { padding: 4 },
  endSaveBtnText: { fontSize: 14, fontWeight: '600', color: '#3B5BA5' },
  kav: { flex: 1 },
  chatArea: { flex: 1, position: 'relative' },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
  },
  emptyChat: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyChatText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  groundBtnWrapper: { position: 'absolute', right: 16, bottom: 16 },
  groundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#6B6860',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  groundBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  // Input area
  inputArea: {
    backgroundColor: '#252320',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
  },
  speakerRow: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
    paddingBottom: 2,
  },
  speakerChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    maxWidth: 160,
  },
  speakerChipText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  speakerChipTextInactive: { opacity: 0.5 },
  // "+ Add" chip — dashed border, muted color
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#6B6860',
    borderStyle: 'dashed',
  },
  addChipText: { fontSize: 13, fontWeight: '600', color: '#6B6860' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
  // Read-only footer
  readOnlyFooter: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#1A1917',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  continueBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  continueBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
