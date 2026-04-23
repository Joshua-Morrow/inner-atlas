/**
 * Start Dialogue — configure intention + participants
 * Route: /dialogue-start?partId=<uuid>
 *
 * Pre-selects the originating part. Self is always present (non-removable).
 * Creates inner_dialogues row → navigates to /dialogue-session?dialogueId=<id>
 */

import { useCallback, useState } from 'react';
import {
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

type PartType = 'manager' | 'firefighter' | 'exile' | 'self';

interface PartRow {
  id: string;
  display_name: string;
  type: PartType;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<PartType, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function nowIso(): string {
  return new Date().toISOString();
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Part Chip ────────────────────────────────────────────────────────────────

function PartChip({
  part,
  onRemove,
  removable,
}: {
  part: PartRow;
  onRemove: () => void;
  removable: boolean;
}) {
  const color = TYPE_COLOR[part.type] ?? '#6B6860';
  return (
    <View style={[chipStyles.chip, { backgroundColor: color + '20', borderColor: color }]}>
      <View style={[chipStyles.avatar, { backgroundColor: color }]}>
        <Text style={chipStyles.avatarText}>{getInitials(part.display_name)}</Text>
      </View>
      <Text style={[chipStyles.label, { color }]} numberOfLines={1}>
        {part.display_name}
      </Text>
      {removable && (
        <Pressable onPress={onRemove} hitSlop={8} style={chipStyles.removeBtn}>
          <Ionicons name="close" size={14} color={color} />
        </Pressable>
      )}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
    maxWidth: 180,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 8, fontWeight: '700', color: '#FFFFFF' },
  label: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
  removeBtn: { padding: 2 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DialogueStartScreen() {
  const { partId, relationshipId } = useLocalSearchParams<{ partId?: string; relationshipId?: string }>();

  const [intention, setIntention]     = useState('');
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>(
    partId ? [partId] : [],
  );
  const [allParts, setAllParts]       = useState<PartRow[]>([]);
  const [showSheet, setShowSheet]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [relName, setRelName]         = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const db = getDatabase();
      db.getAllAsync<PartRow>(
          `SELECT id, COALESCE(custom_name, name) AS display_name, type
           FROM parts ORDER BY created_at ASC`,
          [],
        )
        .then((rows) => setAllParts(rows))
        .catch((e) => console.error('[DialogueStart] load parts:', e));

      if (relationshipId) {
        // Load relationship name and pre-populate all member part_ids
        db.getFirstAsync<{ name: string }>(
          `SELECT name FROM relationships WHERE id = ?`,
          [relationshipId],
        ).then((r) => { if (r) setRelName(r.name); }).catch(() => undefined);

        db.getAllAsync<{ part_id: string }>(
          `SELECT part_id FROM relationship_members WHERE relationship_id = ? AND part_id IS NOT NULL`,
          [relationshipId],
        ).then((rows) => {
          const ids = rows.map((r) => r.part_id).filter(Boolean) as string[];
          if (ids.length > 0) setSelectedPartIds(ids);
        }).catch(() => undefined);
      }
    }, [relationshipId]),
  );

  const partsMap      = new Map(allParts.map((p) => [p.id, p]));
  const selectedParts = selectedPartIds
    .map((id) => partsMap.get(id))
    .filter((p): p is PartRow => !!p);
  const canBegin = selectedParts.length >= 1;

  function handleRemovePart(id: string) {
    if (selectedPartIds.length <= 1) return;
    setSelectedPartIds((prev) => prev.filter((x) => x !== id));
  }

  function handleAddPart(id: string) {
    if (!selectedPartIds.includes(id)) {
      setSelectedPartIds((prev) => [...prev, id]);
    }
    setShowSheet(false);
  }

  async function handleBeginDialogue() {
    if (!canBegin || saving) return;
    setSaving(true);
    const db    = getDatabase();
    const newId = generateId();
    const now   = nowIso();
    try {
      await db.runAsync(
        `INSERT INTO inner_dialogues
           (id, title, part_id, participants_json, messages_json, status, relationship_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          intention.trim() || null,
          partId ?? null,
          JSON.stringify(selectedPartIds),
          JSON.stringify([]),
          'active',
          relationshipId ?? null,
          now,
          now,
        ],
      );
      router.push(`/dialogue-session?dialogueId=${newId}`);
    } catch (e) {
      console.error('[DialogueStart] insert:', e);
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#1C1B19" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {relName ? `Dialogue — ${relName}` : 'New Dialogue'}
          </Text>
          <View style={styles.headerRight} />
        </View>

        {/* Form */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formContent}>

          {/* Section 1 — Intention (optional) */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              What is this dialogue about? (optional)
            </Text>
            <TextInput
              style={styles.intentionInput}
              value={intention}
              onChangeText={setIntention}
              placeholder="e.g. I want to understand what triggered this part today"
              placeholderTextColor="#A09D96"
              returnKeyType="done"
            />
          </View>

          {/* Section 2 — Participants */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Who is in this dialogue?</Text>
            <View style={styles.chipsContainer}>

              {/* Self chip — fixed, non-removable */}
              <View style={[chipStyles.chip, { backgroundColor: '#FFFBEB', borderColor: '#B88A00' }]}>
                <View style={[chipStyles.avatar, { backgroundColor: '#B88A00' }]}>
                  <Text style={chipStyles.avatarText}>S</Text>
                </View>
                <Text style={[chipStyles.label, { color: '#B88A00' }]}>Self</Text>
              </View>

              {/* Selected part chips */}
              {selectedParts.map((part) => (
                <PartChip
                  key={part.id}
                  part={part}
                  onRemove={() => handleRemovePart(part.id)}
                  removable={selectedParts.length > 1}
                />
              ))}

              {/* Add Part button */}
              <Pressable
                style={({ pressed }) => [styles.addPartBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowSheet(true)}
              >
                <Ionicons name="add" size={16} color="#3B5BA5" />
                <Text style={styles.addPartBtnText}>Add Part</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* Pinned footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.beginBtn, !canBegin && styles.beginBtnDisabled]}
            onPress={handleBeginDialogue}
            disabled={!canBegin || saving}
            activeOpacity={0.85}
          >
            <Text style={styles.beginBtnText}>Begin Dialogue</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Add Part bottom sheet */}
      <Modal
        visible={showSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSheet(false)}
      >
        <View style={sheetStyles.container}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSheet(false)} />
          <View style={sheetStyles.sheet}>
            <View style={sheetStyles.handle} />
            <Text style={sheetStyles.sheetTitle}>Add a Part</Text>

            {allParts.length === 0 ? (
              <View style={sheetStyles.emptySheet}>
                <Text style={sheetStyles.emptySheetText}>No parts added yet.</Text>
              </View>
            ) : (
              <FlatList
                data={allParts}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                renderItem={({ item }) => {
                  const alreadyAdded = selectedPartIds.includes(item.id);
                  const color        = TYPE_COLOR[item.type] ?? '#6B6860';
                  return (
                    <Pressable
                      style={[sheetStyles.partRow, alreadyAdded && sheetStyles.partRowDisabled]}
                      onPress={() => !alreadyAdded && handleAddPart(item.id)}
                      disabled={alreadyAdded}
                    >
                      <View style={[sheetStyles.partAvatar, { backgroundColor: color }]}>
                        <Text style={sheetStyles.partAvatarText}>
                          {getInitials(item.display_name)}
                        </Text>
                      </View>
                      <Text style={[sheetStyles.partName, alreadyAdded && sheetStyles.partNameMuted]}>
                        {item.display_name}
                      </Text>
                      {alreadyAdded && (
                        <Ionicons name="checkmark" size={16} color="#A09D96" />
                      )}
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAF8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: '#1C1B19' },
  headerRight: { width: 32 },
  formContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 28,
  },
  section: { gap: 10 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  intentionInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1C1B19',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  addPartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3B5BA5',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addPartBtnText: { fontSize: 13, fontWeight: '500', color: '#3B5BA5' },
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#FAFAF8',
    borderTopWidth: 1,
    borderTopColor: '#E5E3DE',
  },
  beginBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  beginBtnDisabled: { opacity: 0.4 },
  beginBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

const sheetStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E3DE',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1B19',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  emptySheet: { padding: 32, alignItems: 'center' },
  emptySheetText: { fontSize: 15, color: '#A09D96' },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E3DE',
  },
  partRowDisabled: { opacity: 0.45 },
  partAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partAvatarText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  partName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1C1B19' },
  partNameMuted: { color: '#A09D96' },
});
