/**
 * Refine Part — editing and management hub for a part's profile
 * Route: /refine-part?id=<uuid>
 *
 * Tabs: Identity | Core Profile | Extended | Danger Zone
 * Save button pinned to bottom (hidden on Danger Zone tab).
 * Save writes only the fields in the current visible tab.
 * Delete with two-step confirmation.
 */

import { useEffect, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getDatabase } from '@/lib/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'identity' | 'core' | 'extended' | 'danger';
type PartType = 'manager' | 'firefighter' | 'exile' | 'self';
type SelectableType = 'manager' | 'firefighter' | 'exile' | 'unknown';

interface PartRow {
  id: string;
  display_name: string;
  type: PartType;
  name: string;
  custom_name: string | null;
}

interface ProfileFields {
  appearance:            string;
  job:                   string;
  key_trigger:           string;
  key_identifier:        string;
  fears:                 string;
  body_location:         string;
  origin_story:          string;
  beliefs:               string;
  relationship_to_self:  string;
  burdens:               string;
  gifts:                 string;
  voice_phrases:         string;
  desires:               string;
  behavioral_patterns:   string;
  strengths:             string;
  weaknesses:            string;
  inheritance_notes:     string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
  unknown:     '#6B6860',
};

const TABS: { id: TabId; label: string }[] = [
  { id: 'identity', label: 'Identity'     },
  { id: 'core',     label: 'Core Profile' },
  { id: 'extended', label: 'Extended'     },
  { id: 'danger',   label: 'Danger Zone'  },
];

const TYPE_CHIPS: { value: SelectableType; label: string }[] = [
  { value: 'manager',     label: 'Manager'     },
  { value: 'firefighter', label: 'Firefighter' },
  { value: 'exile',       label: 'Exile'       },
  { value: 'unknown',     label: 'Unknown'     },
];

const CORE_FIELDS: { field: keyof ProfileFields; label: string; placeholder: string }[] = [
  { field: 'appearance',           label: 'Appearance',            placeholder: 'Describe its appearance or feeling…'          },
  { field: 'job',                  label: 'Job',                   placeholder: 'What role does this part play…'               },
  { field: 'key_trigger',          label: 'Key Trigger',           placeholder: 'Situations, people, or feelings…'            },
  { field: 'key_identifier',       label: 'Key Identifier',        placeholder: 'Signs it has shown up…'                      },
  { field: 'fears',                label: 'Fears',                 placeholder: 'Concerns or fears this part holds…'          },
  { field: 'body_location',        label: 'Body Location',         placeholder: 'Where you feel it in your body…'             },
  { field: 'origin_story',         label: 'Origin Story',          placeholder: 'When it first showed up…'                    },
  { field: 'beliefs',              label: 'Beliefs',               placeholder: 'What it believes to be true…'                },
  { field: 'relationship_to_self', label: 'Relationship to Self',  placeholder: 'How it feels toward you…'                    },
  { field: 'burdens',              label: 'Burdens',               placeholder: 'What it has taken on…'                       },
  { field: 'gifts',                label: 'Gifts',                 placeholder: 'What it could offer if not working so hard…' },
];

const EXTENDED_FIELDS: { field: keyof ProfileFields; label: string; placeholder: string }[] = [
  { field: 'voice_phrases',       label: 'Voice & Phrases',       placeholder: 'What does this part sound like…'        },
  { field: 'desires',             label: 'Desires & Needs',       placeholder: 'What does this part want or need…'      },
  { field: 'behavioral_patterns', label: 'Behavioral Patterns',   placeholder: 'How does this part behave when active…' },
  { field: 'strengths',           label: 'Strengths',             placeholder: 'What is this part good at…'             },
  { field: 'weaknesses',          label: 'Weaknesses',            placeholder: 'Costs or limitations of this approach…' },
  { field: 'inheritance_notes',   label: 'Part Inheritance',      placeholder: 'Where did this part learn its patterns…'},
];

// ─── Field Row ────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  value,
  placeholder,
  onChange,
  onClear,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <View style={fr.wrap}>
      <View style={fr.labelRow}>
        <Text style={fr.label}>{label}</Text>
        {value.length > 0 && (
          <TouchableOpacity onPress={onClear} hitSlop={8} style={fr.clearBtn}>
            <Text style={fr.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
      <TextInput
        style={fr.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#A09D96"
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

const fr = StyleSheet.create({
  wrap:     { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label:    { fontSize: 13, fontWeight: '600', color: '#1C1B19' },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  clearText:{ fontSize: 12, color: '#A09D96', fontWeight: '500' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E3DE',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1C1B19',
    minHeight: 72,
    lineHeight: 22,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RefinePartScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [part, setPart]                  = useState<PartRow | null>(null);
  const [customNameInput, setCustomName] = useState('');
  const [partType, setPartType]          = useState<SelectableType>('manager');
  const [activeTab, setActiveTab]        = useState<TabId>('identity');
  const [saving, setSaving]              = useState(false);

  const [fields, setFields] = useState<ProfileFields>({
    appearance:            '',
    job:                   '',
    key_trigger:           '',
    key_identifier:        '',
    fears:                 '',
    body_location:         '',
    origin_story:          '',
    beliefs:               '',
    relationship_to_self:  '',
    burdens:               '',
    gifts:                 '',
    voice_phrases:         '',
    desires:               '',
    behavioral_patterns:   '',
    strengths:             '',
    weaknesses:            '',
    inheritance_notes:     '',
  });

  const [inheritanceTags, setInheritanceTags] = useState<string[]>([]);
  const [inheritanceTagDraft, setInheritanceTagDraft] = useState('');

  // ── Load on mount ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    const db = getDatabase();

    db.getFirstAsync<PartRow>(
      `SELECT id, COALESCE(custom_name, name) AS display_name,
              type, name, custom_name
       FROM parts WHERE id = ?`,
      [id],
    ).then((row) => {
      if (!row) return;
      setPart(row);
      setCustomName(row.custom_name ?? row.name);
      setPartType((row.type as SelectableType) ?? 'manager');
    }).catch((e) => console.error('[Refine] parts:', e));

    db.getFirstAsync<{
      appearance:            string | null;
      job:                   string | null;
      key_trigger:           string | null;
      key_identifier:        string | null;
      fears:                 string | null;
      body_location:         string | null;
      origin_story:          string | null;
      beliefs:               string | null;
      relationship_to_self:  string | null;
      burdens:               string | null;
      gifts:                 string | null;
      voice_phrases:         string | null;
      desires:               string | null;
      behavioral_patterns:   string | null;
      strengths:             string | null;
      weaknesses:            string | null;
      inheritance_notes:     string | null;
      inheritance_tags:      string | null;
    }>(
      `SELECT appearance, job, key_trigger, key_identifier, fears,
              body_location, origin_story, beliefs, relationship_to_self,
              burdens, gifts, voice_phrases, desires, behavioral_patterns,
              strengths, weaknesses, inheritance_notes, inheritance_tags
       FROM part_profiles WHERE part_id = ?`,
      [id],
    ).then((row) => {
      if (!row) return;
      setFields({
        appearance:            row.appearance            ?? '',
        job:                   row.job                   ?? '',
        key_trigger:           row.key_trigger           ?? '',
        key_identifier:        row.key_identifier        ?? '',
        fears:                 row.fears                 ?? '',
        body_location:         row.body_location         ?? '',
        origin_story:          row.origin_story          ?? '',
        beliefs:               row.beliefs               ?? '',
        relationship_to_self:  row.relationship_to_self  ?? '',
        burdens:               row.burdens               ?? '',
        gifts:                 row.gifts                 ?? '',
        voice_phrases:         row.voice_phrases         ?? '',
        desires:               row.desires               ?? '',
        behavioral_patterns:   row.behavioral_patterns   ?? '',
        strengths:             row.strengths             ?? '',
        weaknesses:            row.weaknesses            ?? '',
        inheritance_notes:     row.inheritance_notes     ?? '',
      });
      if (row.inheritance_tags) {
        try {
          const parsed = JSON.parse(row.inheritance_tags) as unknown;
          if (Array.isArray(parsed)) setInheritanceTags(parsed as string[]);
        } catch { /* noop */ }
      }
    }).catch((e) => console.error('[Refine] profile:', e));
  }, [id]);

  // ── Field helpers ──────────────────────────────────────────────────────────

  function setField(field: keyof ProfileFields, value: string) {
    setFields((prev) => ({ ...prev, [field]: value }));
  }

  function confirmClear(field: keyof ProfileFields, label: string) {
    Alert.alert(
      'Remove this content?',
      `Clear "${label}" for this part?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => setField(field, '') },
      ],
    );
  }

  // ── Tab-scoped save ────────────────────────────────────────────────────────

  async function saveTab() {
    if (!id) return;
    setSaving(true);
    try {
      const db  = getDatabase();
      const now = new Date().toISOString();

      if (activeTab === 'identity') {
        const trimmedName = customNameInput.trim() || null;
        await db.runAsync(
          `UPDATE parts SET custom_name = ?, type = ?, updated_at = ? WHERE id = ?`,
          [trimmedName, partType, now, id],
        );
      } else if (activeTab === 'core') {
        await db.runAsync(
          `INSERT INTO part_profiles
             (part_id, appearance, job, key_trigger, key_identifier, fears,
              body_location, origin_story, beliefs, relationship_to_self,
              burdens, gifts, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(part_id) DO UPDATE SET
             appearance            = excluded.appearance,
             job                   = excluded.job,
             key_trigger           = excluded.key_trigger,
             key_identifier        = excluded.key_identifier,
             fears                 = excluded.fears,
             body_location         = excluded.body_location,
             origin_story          = excluded.origin_story,
             beliefs               = excluded.beliefs,
             relationship_to_self  = excluded.relationship_to_self,
             burdens               = excluded.burdens,
             gifts                 = excluded.gifts,
             updated_at            = excluded.updated_at`,
          [
            id,
            fields.appearance            || null,
            fields.job                   || null,
            fields.key_trigger           || null,
            fields.key_identifier        || null,
            fields.fears                 || null,
            fields.body_location         || null,
            fields.origin_story          || null,
            fields.beliefs               || null,
            fields.relationship_to_self  || null,
            fields.burdens               || null,
            fields.gifts                 || null,
            now,
          ],
        );
      } else if (activeTab === 'extended') {
        await db.runAsync(
          `INSERT INTO part_profiles
             (part_id, voice_phrases, desires, behavioral_patterns,
              strengths, weaknesses, inheritance_notes, inheritance_tags, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(part_id) DO UPDATE SET
             voice_phrases         = excluded.voice_phrases,
             desires               = excluded.desires,
             behavioral_patterns   = excluded.behavioral_patterns,
             strengths             = excluded.strengths,
             weaknesses            = excluded.weaknesses,
             inheritance_notes     = excluded.inheritance_notes,
             inheritance_tags      = excluded.inheritance_tags,
             updated_at            = excluded.updated_at`,
          [
            id,
            fields.voice_phrases         || null,
            fields.desires               || null,
            fields.behavioral_patterns   || null,
            fields.strengths             || null,
            fields.weaknesses            || null,
            fields.inheritance_notes     || null,
            inheritanceTags.length > 0 ? JSON.stringify(inheritanceTags) : null,
            now,
          ],
        );
      }

      router.back();
    } catch (e) {
      console.error('[Refine] saveTab:', e);
      setSaving(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  function handleDeleteStep1() {
    const partName = part?.display_name ?? 'this part';
    Alert.alert(
      `Delete ${partName}?`,
      'This will permanently remove this part and all associated data including dialogues, trailheads, and elaborations.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, delete', style: 'destructive', onPress: handleDeleteStep2 },
      ],
    );
  }

  function handleDeleteStep2() {
    Alert.alert(
      'Are you absolutely sure?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete permanently', style: 'destructive', onPress: deletePart },
      ],
    );
  }

  async function deletePart() {
    if (!id) return;
    try {
      const db = getDatabase();
      await db.runAsync(`DELETE FROM part_profiles WHERE part_id = ?`, [id]);
      await db.runAsync(`DELETE FROM part_memories WHERE part_id = ?`, [id]);
      await db.runAsync(`DELETE FROM part_relationships WHERE part_a_id = ? OR part_b_id = ?`, [id, id]);
      await db.runAsync(`DELETE FROM relationship_members WHERE part_id = ?`, [id]);
      await db.runAsync(`DELETE FROM elaboration_sessions WHERE part_id = ?`, [id]);
      await db.runAsync(`DELETE FROM updates WHERE part_id = ?`, [id]);
      await db.runAsync(`DELETE FROM trailheads WHERE exile_id = ?`, [id]);
      await db.runAsync(`DELETE FROM parts WHERE id = ?`, [id]);
      router.replace('/my-parts');
    } catch (e) {
      console.error('[Refine] deletePart:', e);
      Alert.alert('Error', 'Could not delete this part. Please try again.');
    }
  }

  const typeColor = TYPE_COLOR[partType] ?? '#6B6860';
  const partName  = part?.display_name ?? '…';

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color="#3B5BA5" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.heading} numberOfLines={1}>
          Edit {partName}
        </Text>
      </View>

      {/* Tab row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabRow}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabBtn,
                isActive
                  ? { backgroundColor: typeColor, borderColor: typeColor }
                  : { backgroundColor: 'transparent', borderColor: '#E5E3DE' },
              ]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: isActive ? '#FFFFFF' : '#6B6860' },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Identity tab ─────────────────────────────────────────────── */}
          {activeTab === 'identity' && (
            <>
              {/* Name */}
              <View style={styles.fieldGroup}>
                <View style={fr.labelRow}>
                  <Text style={fr.label}>Name</Text>
                </View>
                <TextInput
                  style={styles.singleLineInput}
                  value={customNameInput}
                  onChangeText={setCustomName}
                  placeholder={part?.name ?? 'Enter a name…'}
                  placeholderTextColor="#A09D96"
                  autoCorrect={false}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
              </View>

              {/* Type chips */}
              <View style={styles.fieldGroup}>
                <Text style={fr.label}>Type</Text>
                <View style={styles.chipRow}>
                  {TYPE_CHIPS.map(({ value, label }) => {
                    const active    = partType === value;
                    const chipColor = TYPE_COLOR[value] ?? '#6B6860';
                    return (
                      <Pressable
                        key={value}
                        style={[
                          styles.typeChip,
                          active
                            ? { backgroundColor: chipColor, borderColor: chipColor }
                            : { backgroundColor: '#FFFFFF', borderColor: '#E5E3DE' },
                        ]}
                        onPress={() => setPartType(value)}
                      >
                        <Text
                          style={[
                            styles.typeChipText,
                            { color: active ? '#FFFFFF' : '#1C1B19' },
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Text style={styles.footerNote}>
                Changes update everywhere in your atlas
              </Text>
            </>
          )}

          {/* ── Core Profile tab ─────────────────────────────────────────── */}
          {activeTab === 'core' && (
            <>
              {CORE_FIELDS.map(({ field, label, placeholder }) => (
                <FieldRow
                  key={field}
                  label={label}
                  value={fields[field]}
                  placeholder={placeholder}
                  onChange={(v) => setField(field, v)}
                  onClear={() => confirmClear(field, label)}
                />
              ))}
            </>
          )}

          {/* ── Extended tab ─────────────────────────────────────────────── */}
          {activeTab === 'extended' && (
            <>
              {EXTENDED_FIELDS.filter((f) => f.field !== 'inheritance_notes').map(
                ({ field, label, placeholder }) => (
                  <FieldRow
                    key={field}
                    label={label}
                    value={fields[field]}
                    placeholder={placeholder}
                    onChange={(v) => setField(field, v)}
                    onClear={() => confirmClear(field, label)}
                  />
                ),
              )}

              {/* Part Inheritance — tags + notes */}
              <View style={styles.fieldGroup}>
                <View style={[fr.labelRow, { marginBottom: 6 }]}>
                  <Text style={fr.label}>Part Inheritance</Text>
                </View>

                {/* Tag chips */}
                {inheritanceTags.length > 0 && (
                  <View style={styles.chipRow}>
                    {inheritanceTags.map((tag) => (
                      <Pressable
                        key={tag}
                        style={[
                          styles.typeChip,
                          { backgroundColor: `${typeColor}18`, borderColor: typeColor },
                        ]}
                        onPress={() =>
                          setInheritanceTags((prev) => prev.filter((t) => t !== tag))
                        }
                      >
                        <Text style={[styles.typeChipText, { color: typeColor }]}>
                          {tag} ×
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* Tag input row */}
                <View style={[fr.labelRow, { gap: 8 }]}>
                  <TextInput
                    style={[styles.singleLineInput, { flex: 1 }]}
                    value={inheritanceTagDraft}
                    onChangeText={setInheritanceTagDraft}
                    placeholder="Add a person, character, or influence…"
                    placeholderTextColor="#A09D96"
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      const trimmed = inheritanceTagDraft.trim();
                      if (trimmed && !inheritanceTags.includes(trimmed)) {
                        setInheritanceTags((prev) => [...prev, trimmed]);
                      }
                      setInheritanceTagDraft('');
                    }}
                    blurOnSubmit={false}
                  />
                  <TouchableOpacity
                    style={[styles.typeChip, { backgroundColor: typeColor, borderColor: typeColor }]}
                    onPress={() => {
                      const trimmed = inheritanceTagDraft.trim();
                      if (trimmed && !inheritanceTags.includes(trimmed)) {
                        setInheritanceTags((prev) => [...prev, trimmed]);
                      }
                      setInheritanceTagDraft('');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.typeChipText, { color: '#FFFFFF' }]}>Add</Text>
                  </TouchableOpacity>
                </View>

                {/* Notes */}
                <FieldRow
                  label="Notes"
                  value={fields.inheritance_notes}
                  placeholder="Where did this part learn its patterns…"
                  onChange={(v) => setField('inheritance_notes', v)}
                  onClear={() => confirmClear('inheritance_notes', 'Part Inheritance notes')}
                />
              </View>
            </>
          )}

          {/* ── Danger Zone tab ──────────────────────────────────────────── */}
          {activeTab === 'danger' && (
            <>
              <View style={styles.dangerDivider}>
                <View style={styles.dangerLine} />
                <Text style={styles.dangerLabel}>Danger Zone</Text>
                <View style={styles.dangerLine} />
              </View>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDeleteStep1}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={16} color="#DC2626" />
                <Text style={styles.deleteBtnText}>Delete This Part</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        {/* Save button — hidden on Danger Zone tab */}
        {activeTab !== 'danger' && (
          <View style={styles.saveBar}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={saveTab}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={styles.saveBtnText}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B5BA5',
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1B19',
    flex: 1,
  },

  tabScroll: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FAFAF8',
    flexGrow: 0,
  },
  tabRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  tabBtn: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 20,
  },

  fieldGroup: {
    gap: 8,
  },

  singleLineInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E3DE',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1B19',
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '600',
  },

  dangerDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  dangerLine:  { flex: 1, height: 1, backgroundColor: '#FCA5A5' },
  dangerLabel: { fontSize: 11, fontWeight: '700', color: '#DC2626', textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0 },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },

  footerNote: {
    fontSize: 13,
    color: '#A09D96',
    textAlign: 'center',
    paddingTop: 4,
  },

  saveBar: {
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
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
