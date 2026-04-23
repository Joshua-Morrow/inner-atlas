/**
 * Update Detail — view, edit, and delete a logged update
 * Route: /update-detail?id=<uuid>
 *
 * Read-only by default. Edit button (top right) switches to in-place editing.
 * Delete button at bottom with confirmation before removing.
 */

import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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

interface UpdateDetailRow {
  id: string;
  update_type: string;
  part_id: string | null;
  intensity: number | null;
  content_json: string | null;
  created_at: string;
  part_name: string | null;
  part_type: PartType | null;
}

interface UpdateContent {
  trigger?:  string;
  noticed?:  string;
  response?: string;
  explore?:  'trailhead' | 'elaboration';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<PartType, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
};

const TYPE_LABEL: Record<PartType, string> = {
  manager:     'Manager',
  firefighter: 'Firefighter',
  exile:       'Exile',
  self:        'Self',
};

const ACTIVATION_TYPES = [
  'Activated',
  'Noticed',
  'Reflected on',
  'Worked with',
  'Milestone',
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${date} at ${time}`;
}

function parseContent(json: string | null): UpdateContent {
  if (!json) return {};
  try {
    return JSON.parse(json) as UpdateContent;
  } catch {
    return {};
  }
}

// ─── Read-only field ──────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <Text style={fieldStyles.value}>{value}</Text>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E3DE',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: { fontSize: 15, color: '#1C1B19', lineHeight: 22 },
});

// ─── Intensity dots (display only) ───────────────────────────────────────────

function IntensityDisplay({ value }: { value: number }) {
  return (
    <View style={intensityStyles.row}>
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <View
          key={n}
          style={[intensityStyles.dot, n <= value && intensityStyles.dotFilled]}
        />
      ))}
    </View>
  );
}

const intensityStyles = StyleSheet.create({
  row:       { flexDirection: 'row', gap: 8 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E3DE',
  },
  dotFilled: { backgroundColor: '#3B5BA5' },
});

// ─── Intensity selector (edit mode) ──────────────────────────────────────────

function IntensitySelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <View style={selectorStyles.row}>
      {([1, 2, 3, 4, 5] as const).map((n) => {
        const active = value === n;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(active ? null : n)}
            hitSlop={6}
            style={[selectorStyles.dot, active && selectorStyles.dotActive]}
          >
            {active ? <View style={selectorStyles.fill} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const selectorStyles = StyleSheet.create({
  row:      { flexDirection: 'row', gap: 14 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#A09D96',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { borderColor: '#3B5BA5' },
  fill: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3B5BA5',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UpdateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [update,   setUpdate]   = useState<UpdateDetailRow | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editable field state (mirrors DB row when in edit mode)
  const [editType,     setEditType]     = useState('');
  const [editIntensity,setEditIntensity]= useState<number | null>(null);
  const [editTrigger,  setEditTrigger]  = useState('');
  const [editNoticed,  setEditNoticed]  = useState('');
  const [editResponse, setEditResponse] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      getDatabase()
        .getFirstAsync<UpdateDetailRow>(
          `SELECT u.id, u.update_type, u.part_id, u.intensity, u.content_json, u.created_at,
                  COALESCE(p.custom_name, p.name) AS part_name, p.type AS part_type
           FROM updates u
           LEFT JOIN parts p ON u.part_id = p.id
           WHERE u.id = ?`,
          [id],
        )
        .then((row) => {
          if (!row) return;
          setUpdate(row);
          // Pre-populate edit fields
          const c = parseContent(row.content_json);
          setEditType(row.update_type);
          setEditIntensity(row.intensity ?? null);
          setEditTrigger(c.trigger ?? '');
          setEditNoticed(c.noticed ?? '');
          setEditResponse(c.response ?? '');
        })
        .catch((e) => console.error('[UpdateDetail] load:', e));
    }, [id]),
  );

  function enterEditMode() {
    if (!update) return;
    const c = parseContent(update.content_json);
    setEditType(update.update_type);
    setEditIntensity(update.intensity ?? null);
    setEditTrigger(c.trigger ?? '');
    setEditNoticed(c.noticed ?? '');
    setEditResponse(c.response ?? '');
    setEditMode(true);
  }

  async function handleSave() {
    if (!update || !editType || saving) return;
    setSaving(true);

    const c = parseContent(update.content_json);
    const newContent = JSON.stringify({
      ...(editTrigger.trim()  ? { trigger:  editTrigger.trim()  } : {}),
      ...(editNoticed.trim()  ? { noticed:  editNoticed.trim()  } : {}),
      ...(editResponse.trim() ? { response: editResponse.trim() } : {}),
      ...(c.explore           ? { explore:  c.explore           } : {}),
    });

    try {
      await getDatabase().runAsync(
        `UPDATE updates
         SET update_type = ?, intensity = ?, content_json = ?
         WHERE id = ?`,
        [editType, editIntensity ?? null, newContent, update.id],
      );
      // Reload and exit edit mode
      const fresh = await getDatabase().getFirstAsync<UpdateDetailRow>(
        `SELECT u.id, u.update_type, u.part_id, u.intensity, u.content_json, u.created_at,
                COALESCE(p.custom_name, p.name) AS part_name, p.type AS part_type
         FROM updates u
         LEFT JOIN parts p ON u.part_id = p.id
         WHERE u.id = ?`,
        [update.id],
      );
      if (fresh) setUpdate(fresh);
      setEditMode(false);
    } catch (e) {
      console.error('[UpdateDetail] save:', e);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!update || deleting) return;
    Alert.alert(
      'Delete this update?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await getDatabase().runAsync(
                `DELETE FROM updates WHERE id = ?`,
                [update.id],
              );
              router.back();
            } catch (e) {
              console.error('[UpdateDetail] delete:', e);
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  if (!update) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#1C1B19" />
          </Pressable>
          <Text style={styles.headerTitle}>Update</Text>
          <View style={styles.headerRight} />
        </View>
      </SafeAreaView>
    );
  }

  const color     = update.part_type ? (TYPE_COLOR[update.part_type] ?? '#6B6860') : '#6B6860';
  const typeLabel = update.part_type ? (TYPE_LABEL[update.part_type] ?? '') : '';
  const content   = parseContent(update.content_json);

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
          <Text style={styles.headerTitle}>Update</Text>
          {editMode ? (
            <TouchableOpacity
              onPress={handleSave}
              disabled={!editType || saving}
              style={styles.headerAction}
            >
              <Text style={[styles.headerActionText, (!editType || saving) && { opacity: 0.4 }]}>
                Save
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={enterEditMode} style={styles.headerAction}>
              <Text style={styles.headerActionText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Part + type pill */}
          <View style={styles.partRow}>
            <Text style={[styles.partName, { color }]} numberOfLines={1}>
              {update.part_name ?? 'Unknown Part'}
            </Text>
            {typeLabel ? (
              <View style={[styles.pill, { backgroundColor: color + '20', borderColor: color }]}>
                <Text style={[styles.pillText, { color }]}>{typeLabel}</Text>
              </View>
            ) : null}
          </View>

          {/* Date */}
          <Text style={styles.dateText}>{formatDateTime(update.created_at)}</Text>

          {/* Activation type */}
          {editMode ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Activation type <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.chipWrap}>
                {ACTIVATION_TYPES.map((type) => {
                  const selected = editType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setEditType(selected ? '' : type)}
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
          ) : (
            <Field label="Activation type" value={update.update_type} />
          )}

          {/* Intensity */}
          {editMode ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>How activated? (optional)</Text>
              <IntensitySelector value={editIntensity} onChange={setEditIntensity} />
            </View>
          ) : update.intensity != null ? (
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Intensity</Text>
              <IntensityDisplay value={update.intensity} />
            </View>
          ) : null}

          {/* What happened? */}
          {editMode ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>What activated this part?</Text>
              <TextInput
                style={styles.textArea}
                value={editTrigger}
                onChangeText={setEditTrigger}
                placeholder="A situation, thought, or feeling..."
                placeholderTextColor="#A09D96"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          ) : content.trigger ? (
            <Field label="What activated this part" value={content.trigger} />
          ) : null}

          {/* What did you notice? */}
          {editMode ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>What did you notice in yourself?</Text>
              <TextInput
                style={styles.textArea}
                value={editNoticed}
                onChangeText={setEditNoticed}
                placeholder="Thoughts, feelings, sensations, impulses..."
                placeholderTextColor="#A09D96"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          ) : content.noticed ? (
            <Field label="What did you notice" value={content.noticed} />
          ) : null}

          {/* How did you respond? */}
          {editMode ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>How did you respond?</Text>
              <TextInput
                style={[styles.textArea, styles.textAreaSmall]}
                value={editResponse}
                onChangeText={setEditResponse}
                placeholder="What happened next..."
                placeholderTextColor="#A09D96"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </View>
          ) : content.response ? (
            <Field label="How did you respond" value={content.response} />
          ) : null}

          {/* Explore further (read-only display if set) */}
          {!editMode && content.explore ? (
            <Field
              label="Wanted to explore"
              value={content.explore === 'trailhead' ? 'Trailhead' : 'Elaboration'}
            />
          ) : null}

          {/* Delete button */}
          <View style={styles.deleteSection}>
            <TouchableOpacity
              style={[styles.deleteBtn, deleting && { opacity: 0.5 }]}
              onPress={handleDelete}
              disabled={deleting}
              activeOpacity={0.75}
            >
              <Ionicons name="trash-outline" size={16} color="#991B1B" />
              <Text style={styles.deleteBtnText}>Delete this update</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  backBtn:        { padding: 4, marginRight: 8 },
  headerTitle:    { flex: 1, fontSize: 17, fontWeight: '600', color: '#1C1B19' },
  headerRight:    { width: 48 },
  headerAction:   { paddingHorizontal: 4, paddingVertical: 4 },
  headerActionText: { fontSize: 15, fontWeight: '600', color: '#3B5BA5' },

  content: { padding: 16, gap: 12, paddingBottom: 48 },

  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  partName: { fontSize: 18, fontWeight: '700', flex: 1 },
  pill: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillText: { fontSize: 12, fontWeight: '600' },

  dateText: { fontSize: 13, color: '#A09D96', marginTop: -4, marginBottom: 4 },

  section: { gap: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  required: { color: '#C2600A' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#A09D96',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  typeChipSelected:     { backgroundColor: '#3B5BA5', borderColor: '#3B5BA5' },
  typeChipText:         { fontSize: 13, fontWeight: '500', color: '#6B6860' },
  typeChipTextSelected: { color: '#FFFFFF' },

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

  deleteSection: { marginTop: 24, alignItems: 'center' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#991B1B' },
});
