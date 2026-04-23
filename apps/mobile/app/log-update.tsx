/**
 * Log Update — capture a part activation or observation between sessions
 * Route: /log-update?partId=<uuid>  (optional)
 *
 * Pre-selects the part if partId provided.
 * Saves to the updates table and navigates back (or to explore feature).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
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

const ACTIVATION_TYPES = [
  'Activated',
  'Noticed',
  'Reflected on',
  'Worked with',
  'Milestone',
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function nowIso(): string {
  return new Date().toISOString();
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] ?? '').toUpperCase())
    .join('');
}

// ─── Part Chip ────────────────────────────────────────────────────────────────

function PartChip({
  part,
  onRemove,
}: {
  part: PartRow;
  onRemove: () => void;
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
      <Pressable onPress={onRemove} hitSlop={8} style={chipStyles.removeBtn}>
        <Ionicons name="close" size={14} color={color} />
      </Pressable>
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
    maxWidth: 200,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 8, fontWeight: '700', color: '#FFFFFF' },
  label:      { fontSize: 13, fontWeight: '500', flexShrink: 1 },
  removeBtn:  { padding: 2 },
});

// ─── Intensity Selector ───────────────────────────────────────────────────────

function IntensitySelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <View style={dotStyles.row}>
      {([1, 2, 3, 4, 5] as const).map((n) => {
        const active = value === n;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(active ? null : n)}
            hitSlop={6}
            style={[dotStyles.dot, active && dotStyles.dotActive]}
          >
            {active ? <View style={dotStyles.fill} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row:      { flexDirection: 'row', gap: 14 },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#A09D96',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { borderColor: '#3B5BA5' },
  fill: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3B5BA5',
  },
});

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  return (
    <Animated.View style={[toastStyles.wrap, { opacity }]} pointerEvents="none">
      <View style={toastStyles.toast}>
        <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
        <Text style={toastStyles.text}>Update logged</Text>
      </View>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  toast: {
    backgroundColor: '#1C1B19',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LogUpdateScreen() {
  const { partId } = useLocalSearchParams<{ partId?: string }>();

  const [allParts,        setAllParts]        = useState<PartRow[]>([]);
  const [selectedPartId,  setSelectedPartId]  = useState<string | null>(partId ?? null);
  const [activationType,  setActivationType]  = useState<string | null>(null);
  const [intensity,       setIntensity]       = useState<number | null>(null);
  const [trigger,         setTrigger]         = useState('');
  const [noticed,         setNoticed]         = useState('');
  const [response,        setResponse]        = useState('');
  const [exploreOption,   setExploreOption]   = useState<'trailhead' | 'elaboration' | null>(null);
  const [showSheet,       setShowSheet]       = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [showToast,       setShowToast]       = useState(false);

  useFocusEffect(
    useCallback(() => {
      getDatabase()
        .getAllAsync<PartRow>(
          `SELECT id, COALESCE(custom_name, name) AS display_name, type
           FROM parts ORDER BY created_at ASC`,
          [],
        )
        .then((rows) => setAllParts(rows ?? []))
        .catch((e) => console.error('[LogUpdate] load parts:', e));
    }, []),
  );

  const partsMap     = new Map(allParts.map((p) => [p.id, p]));
  const selectedPart = selectedPartId ? partsMap.get(selectedPartId) : undefined;
  const canSave      = !!selectedPartId && !!activationType && !saving;

  const isDirty =
    !!activationType ||
    intensity !== null ||
    trigger.trim() !== '' ||
    noticed.trim() !== '' ||
    response.trim() !== '' ||
    exploreOption !== null ||
    selectedPartId !== (partId ?? null);

  function handleBack() {
    if (isDirty) {
      Alert.alert(
        'Discard update?',
        'You have unsaved changes.',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => router.back() },
        ],
      );
    } else {
      router.back();
    }
  }

  async function handleSave() {
    if (!canSave || !selectedPartId || !activationType) return;
    setSaving(true);

    const db          = getDatabase();
    const id          = generateId();
    const now         = nowIso();
    const contentJson = JSON.stringify({
      ...(trigger.trim()  ? { trigger:  trigger.trim()  } : {}),
      ...(noticed.trim()  ? { noticed:  noticed.trim()  } : {}),
      ...(response.trim() ? { response: response.trim() } : {}),
      ...(exploreOption   ? { explore:  exploreOption   } : {}),
    });

    // Get the saved part for display on confirmation screen
    const savedPart = partsMap.get(selectedPartId);

    try {
      await db.runAsync(
        `INSERT INTO updates (id, update_type, part_id, intensity, content_json, context_tags_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, activationType, selectedPartId, intensity ?? null, contentJson, null, now],
      );

      // Navigate to confirmation screen
      router.replace({
        pathname: '/update-saved',
        params: {
          partName:       savedPart?.display_name ?? '',
          partType:       savedPart?.type ?? '',
          activationType: activationType,
          intensity:      String(intensity ?? ''),
          exploreOption:  exploreOption ?? '',
        },
      } as any);
    } catch (e) {
      console.error('[LogUpdate] save:', e);
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
          <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#1C1B19" />
          </Pressable>
          <Text style={styles.headerTitle}>Log an Update</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Form */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. Which part? */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Which part? <Text style={styles.required}>*</Text>
            </Text>
            {selectedPart ? (
              <View style={styles.chipsRow}>
                <PartChip
                  part={selectedPart}
                  onRemove={() => setSelectedPartId(null)}
                />
                <Pressable
                  onPress={() => setShowSheet(true)}
                  style={styles.changeBtn}
                >
                  <Text style={styles.changeBtnText}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.selectPartBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowSheet(true)}
              >
                <Ionicons name="person-add-outline" size={16} color="#3B5BA5" />
                <Text style={styles.selectPartBtnText}>Select a part...</Text>
              </Pressable>
            )}
          </View>

          {/* 2. Activation type */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Activation type <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.chipWrap}>
              {ACTIVATION_TYPES.map((type) => {
                const selected = activationType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setActivationType(selected ? null : type)}
                    style={[styles.typeChip, selected && styles.typeChipSelected]}
                  >
                    <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 3. Intensity (moved before What happened?) */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>How activated? (optional but helpful for tracking cycles)</Text>
            <IntensitySelector value={intensity} onChange={setIntensity} />
            <Text style={styles.hint}>Tap to select · tap again to clear</Text>
            <Text style={styles.hint}>Intensity ratings build your Cycles map over time</Text>
          </View>

          {/* 4. What happened? */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>What activated this part?</Text>
            <TextInput
              style={styles.textArea}
              value={trigger}
              onChangeText={setTrigger}
              placeholder="A situation, thought, or feeling..."
              placeholderTextColor="#A09D96"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* 5. What did you notice? */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>What did you notice in yourself?</Text>
            <TextInput
              style={styles.textArea}
              value={noticed}
              onChangeText={setNoticed}
              placeholder="Thoughts, feelings, sensations, impulses..."
              placeholderTextColor="#A09D96"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* 6. What did you do? */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>How did you respond?</Text>
            <TextInput
              style={[styles.textArea, styles.textAreaSmall]}
              value={response}
              onChangeText={setResponse}
              placeholder="What happened next..."
              placeholderTextColor="#A09D96"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          {/* 7. Explore further? */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Would you like to explore this?</Text>
            <View style={styles.chipWrap}>
              {(['trailhead', 'elaboration'] as const).map((opt) => {
                const label    = opt === 'trailhead' ? 'Trailhead' : 'Elaboration';
                const selected = exploreOption === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setExploreOption(selected ? null : opt)}
                    style={[styles.typeChip, selected && styles.typeChipSelected]}
                  >
                    <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hint}>
              You can also do this later from the part profile
            </Text>
          </View>
        </ScrollView>

        {/* Pinned footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>Save Update</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Toast */}
      <Toast visible={showToast} />

      {/* Part selector bottom sheet */}
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
            <Text style={sheetStyles.sheetTitle}>Select a Part</Text>

            {allParts.length === 0 ? (
              <View style={sheetStyles.emptySheet}>
                <Text style={sheetStyles.emptyText}>No parts added yet.</Text>
              </View>
            ) : (
              <FlatList
                data={allParts}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                renderItem={({ item }) => {
                  const color      = TYPE_COLOR[item.type] ?? '#6B6860';
                  const isSelected = selectedPartId === item.id;
                  return (
                    <Pressable
                      style={sheetStyles.partRow}
                      onPress={() => {
                        setSelectedPartId(item.id);
                        setShowSheet(false);
                      }}
                    >
                      <View style={[sheetStyles.partAvatar, { backgroundColor: color }]}>
                        <Text style={sheetStyles.partAvatarText}>
                          {getInitials(item.display_name)}
                        </Text>
                      </View>
                      <Text style={sheetStyles.partName}>{item.display_name}</Text>
                      {isSelected ? (
                        <Ionicons name="checkmark" size={16} color="#3B5BA5" />
                      ) : null}
                    </Pressable>
                  );
                }}
                ListFooterComponent={
                  <Pressable
                    style={sheetStyles.newPartRow}
                    onPress={() => {
                      setShowSheet(false);
                      router.push('/add-part');
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#6B6860" />
                    <Text style={sheetStyles.newPartText}>Something new is emerging...</Text>
                  </Pressable>
                }
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
  backBtn:     { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: '#1C1B19' },
  headerRight: { width: 32 },

  formContent: { padding: 16, paddingBottom: 40, gap: 28 },

  section: { gap: 10 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  required: { color: '#C2600A' },

  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  changeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  changeBtnText: { fontSize: 13, color: '#3B5BA5', fontWeight: '500' },

  selectPartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  selectPartBtnText: { fontSize: 15, color: '#6B6860' },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#A09D96',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  typeChipSelected: {
    backgroundColor: '#3B5BA5',
    borderColor: '#3B5BA5',
  },
  typeChipText:         { fontSize: 13, fontWeight: '500', color: '#6B6860' },
  typeChipTextSelected: { color: '#FFFFFF' },

  hint: { fontSize: 12, color: '#A09D96', marginTop: -4 },

  textArea: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1C1B19',
    minHeight: 80,
    lineHeight: 22,
  },
  textAreaSmall: { minHeight: 60 },

  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#FAFAF8',
    borderTopWidth: 1,
    borderTopColor: '#E5E3DE',
  },
  saveBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:     { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
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
  emptyText:  { fontSize: 15, color: '#A09D96' },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E3DE',
  },
  partAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partAvatarText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  partName:       { flex: 1, fontSize: 15, fontWeight: '500', color: '#1C1B19' },
  newPartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    marginTop: 4,
  },
  newPartText: { fontSize: 15, color: '#6B6860', fontStyle: 'italic' },
});
