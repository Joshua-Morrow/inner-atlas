/**
 * Relationship Profile
 * Route: /relationship-profile?id=<uuid>
 *
 * Shows full details of a polarization or alliance.
 * All text fields are inline-editable (tap → TextInput, blur → auto-save).
 * Activity log shows linked dialogues.
 */

import { useCallback, useRef, useState } from 'react';
import {
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

type RelType = 'polarization' | 'alliance';
type PartType = 'manager' | 'firefighter' | 'exile' | 'self';

interface RelRow {
  id: string;
  name: string;
  type: RelType;
  description: string | null;
  what_costs: string | null;
  history_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface PolDetailsRow {
  id: string;
  side_a_wants: string | null;
  side_b_wants: string | null;
  side_a_fears: string | null;
  side_b_fears: string | null;
  side_a_label: string | null;
  side_b_label: string | null;
  mediation_notes: string | null;
  progress_notes: string | null;
}

interface MemberRow {
  id: string;
  member_type: string;
  part_id: string | null;
  side: string | null;
  role_note: string | null;
  display_name: string | null;
  part_type: PartType | null;
}

interface DialogueRow {
  id: string;
  title: string | null;
  created_at: string;
  messages_json: string | null;
  participants_json: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<PartType, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function previewMessages(messagesJson: string | null): string {
  if (!messagesJson) return '';
  try {
    const msgs = JSON.parse(messagesJson) as { text?: string }[];
    const first = msgs[0]?.text ?? '';
    return first.slice(0, 60) + (first.length > 60 ? '…' : '');
  } catch { return ''; }
}

// ─── Inline editable field ────────────────────────────────────────────────────

function InlineField({
  label,
  value,
  placeholder,
  onSave,
  multiline = true,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (val: string) => void;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);

  function handleBlur() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }

  function handleFocus() {
    setDraft(value);
    setEditing(true);
  }

  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      {editing ? (
        <TextInput
          style={[fieldStyles.input, multiline && fieldStyles.inputMulti]}
          value={draft}
          onChangeText={setDraft}
          onBlur={handleBlur}
          autoFocus
          multiline={multiline}
          placeholder={placeholder}
          placeholderTextColor="#A09D96"
        />
      ) : (
        <TouchableOpacity onPress={handleFocus} activeOpacity={0.7} style={fieldStyles.valueTap}>
          {draft ? (
            <Text style={fieldStyles.value}>{draft}</Text>
          ) : (
            <Text style={fieldStyles.valuePlaceholder}>{placeholder ?? 'Tap to add…'}</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A09D96',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  valueTap: {
    minHeight: 40,
    justifyContent: 'center',
  },
  value: {
    fontSize: 15,
    color: '#1C1B19',
    lineHeight: 22,
  },
  valuePlaceholder: {
    fontSize: 15,
    color: '#C5C3BE',
    fontStyle: 'italic',
  },
  input: {
    fontSize: 15,
    color: '#1C1B19',
    borderWidth: 1.5,
    borderColor: '#3B5BA5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  inputMulti: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
});

// ─── Inline name editor ───────────────────────────────────────────────────────

function InlineName({
  value,
  onSave,
}: {
  value: string;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);

  function handleBlur() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
  }

  return editing ? (
    <TextInput
      style={nameStyles.input}
      value={draft}
      onChangeText={setDraft}
      onBlur={handleBlur}
      autoFocus
      returnKeyType="done"
    />
  ) : (
    <TouchableOpacity onPress={() => { setDraft(value); setEditing(true); }} activeOpacity={0.7}>
      <Text style={nameStyles.text}>{value}</Text>
    </TouchableOpacity>
  );
}

const nameStyles = StyleSheet.create({
  text: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1B19',
    lineHeight: 32,
  },
  input: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1B19',
    borderBottomWidth: 2,
    borderBottomColor: '#3B5BA5',
    paddingBottom: 4,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RelationshipProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [rel, setRel]         = useState<RelRow | null>(null);
  const [polDet, setPolDet]   = useState<PolDetailsRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [dialogues, setDialogues] = useState<DialogueRow[]>([]);

  const navigatingRef = useRef(false);
  const safeNavigate = useCallback((href: string) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    router.push(href as any);
    setTimeout(() => { navigatingRef.current = false; }, 1000);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const db = getDatabase();

      db.getFirstAsync<RelRow>(
        `SELECT id, name, type, description, what_costs, history_notes, created_at, updated_at
         FROM relationships WHERE id = ?`,
        [id],
      ).then((r) => { if (r) setRel(r); }).catch(() => undefined);

      db.getFirstAsync<PolDetailsRow>(
        `SELECT id, side_a_wants, side_b_wants, side_a_fears, side_b_fears,
                side_a_label, side_b_label, mediation_notes, progress_notes
         FROM polarization_details WHERE relationship_id = ?`,
        [id],
      ).then((r) => { if (r) setPolDet(r); }).catch(() => undefined);

      db.getAllAsync<MemberRow>(
        `SELECT rm.id, rm.member_type, rm.part_id, rm.side, rm.role_note,
                COALESCE(p.custom_name, p.name) AS display_name,
                p.type AS part_type
         FROM relationship_members rm
         LEFT JOIN parts p ON p.id = rm.part_id
         WHERE rm.relationship_id = ?
         ORDER BY rm.side ASC, rm.created_at ASC`,
        [id],
      ).then((rows) => setMembers(rows ?? [])).catch(() => undefined);

      db.getAllAsync<DialogueRow>(
        `SELECT id, title, created_at, messages_json, participants_json
         FROM inner_dialogues
         WHERE relationship_id = ?
         ORDER BY created_at DESC`,
        [id],
      ).then((rows) => setDialogues(rows ?? [])).catch(() => undefined);
    }, [id]),
  );

  // ── Save helpers ─────────────────────────────────────────────────────────────

  async function saveRelField(field: keyof RelRow, value: string) {
    if (!id) return;
    const db = getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE relationships SET ${field} = ?, updated_at = ? WHERE id = ?`,
      [value, now, id],
    ).catch(() => undefined);
    setRel((prev) => prev ? { ...prev, [field]: value, updated_at: now } : prev);
  }

  async function savePolField(field: keyof PolDetailsRow, value: string) {
    if (!id || !polDet) return;
    const db = getDatabase();
    const now = nowIso();
    await db.runAsync(
      `UPDATE polarization_details SET ${field} = ?, updated_at = ? WHERE relationship_id = ?`,
      [value, now, id],
    ).catch(() => undefined);
    setPolDet((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  if (!rel) return <View style={styles.root} />;

  const sideAMembers = members.filter((m) => m.side === 'a');
  const sideBMembers = members.filter((m) => m.side === 'b');
  const sideALabel   = polDet?.side_a_label ?? (sideAMembers[0]?.display_name ?? 'Side A');
  const sideBLabel   = polDet?.side_b_label ?? (sideBMembers[0]?.display_name ?? 'Side B');

  const typeColor = rel.type === 'polarization' ? '#C2600A' : '#3B5BA5';
  const typeBg    = rel.type === 'polarization' ? '#FFF7ED' : '#EEF2FF';
  const typeLabel = rel.type === 'polarization' ? 'Polarization' : 'Alliance';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#1C1B19" />
        </TouchableOpacity>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header zone ── */}
        <View style={styles.headerZone}>
          <InlineName
            value={rel.name}
            onSave={(val) => saveRelField('name', val)}
          />
          <View style={[styles.typePill, { backgroundColor: typeBg }]}>
            <Text style={[styles.typePillText, { color: typeColor }]}>{typeLabel}</Text>
          </View>
        </View>

        {/* ── Action buttons ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => safeNavigate(`/dialogue-start?relationshipId=${id}`)}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#3B5BA5" />
            <Text style={styles.actionBtnLabel}>Dialogue</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => safeNavigate(`/relationship-members?id=${id}`)}
          >
            <Ionicons name="people-outline" size={20} color="#3B5BA5" />
            <Text style={styles.actionBtnLabel}>Members</Text>
          </TouchableOpacity>
        </View>

        {/* ── POLARIZATION sections ── */}
        {rel.type === 'polarization' && (
          <>
            {/* The Sides */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>The Sides</Text>
              <View style={styles.sidesRow}>
                {/* Side A */}
                <View style={[styles.sideCard, { borderColor: '#C2600A' + '40' }]}>
                  <InlineField
                    label="Side A label"
                    value={sideALabel === 'Side A' ? (polDet?.side_a_label ?? '') : (polDet?.side_a_label ?? '')}
                    placeholder="Label side A…"
                    multiline={false}
                    onSave={(v) => savePolField('side_a_label', v)}
                  />
                  <View style={styles.memberChipsWrap}>
                    {sideAMembers.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={[
                          styles.memberChip,
                          { backgroundColor: (m.part_type ? TYPE_COLOR[m.part_type] : '#6B6860') + '18' },
                        ]}
                        onPress={() => m.part_id && safeNavigate(`/part-profile?id=${m.part_id}`)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.memberChipText,
                            { color: m.part_type ? TYPE_COLOR[m.part_type] : '#6B6860' },
                          ]}
                          numberOfLines={1}
                        >
                          {m.display_name ?? '?'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {sideAMembers.length === 0 && (
                      <Text style={styles.noMembersHint}>No members yet</Text>
                    )}
                  </View>
                </View>

                {/* Side B */}
                <View style={[styles.sideCard, { borderColor: '#3B5BA5' + '40' }]}>
                  <InlineField
                    label="Side B label"
                    value={polDet?.side_b_label ?? ''}
                    placeholder="Label side B…"
                    multiline={false}
                    onSave={(v) => savePolField('side_b_label', v)}
                  />
                  <View style={styles.memberChipsWrap}>
                    {sideBMembers.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={[
                          styles.memberChip,
                          { backgroundColor: (m.part_type ? TYPE_COLOR[m.part_type] : '#6B6860') + '18' },
                        ]}
                        onPress={() => m.part_id && safeNavigate(`/part-profile?id=${m.part_id}`)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.memberChipText,
                            { color: m.part_type ? TYPE_COLOR[m.part_type] : '#6B6860' },
                          ]}
                          numberOfLines={1}
                        >
                          {m.display_name ?? '?'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {sideBMembers.length === 0 && (
                      <Text style={styles.noMembersHint}>No members yet</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* What Each Side Wants */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>What Each Side Wants</Text>
              <InlineField
                label={sideALabel}
                value={polDet?.side_a_wants ?? ''}
                placeholder="What does this side want?"
                onSave={(v) => savePolField('side_a_wants', v)}
              />
              <InlineField
                label={sideBLabel}
                value={polDet?.side_b_wants ?? ''}
                placeholder="What does this side want?"
                onSave={(v) => savePolField('side_b_wants', v)}
              />
            </View>

            {/* What Each Side Fears */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>What Each Side Fears</Text>
              <InlineField
                label={sideALabel}
                value={polDet?.side_a_fears ?? ''}
                placeholder="What does this side fear?"
                onSave={(v) => savePolField('side_a_fears', v)}
              />
              <InlineField
                label={sideBLabel}
                value={polDet?.side_b_fears ?? ''}
                placeholder="What does this side fear?"
                onSave={(v) => savePolField('side_b_fears', v)}
              />
            </View>

            {/* What This Costs */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>What This Costs</Text>
              <InlineField
                label="Impact on the system"
                value={rel.what_costs ?? ''}
                placeholder="What does this polarization cost the system?"
                onSave={(v) => saveRelField('what_costs', v)}
              />
            </View>

            {/* History */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>History</Text>
              <InlineField
                label="Origins and context"
                value={rel.history_notes ?? ''}
                placeholder="How did this polarization develop?"
                onSave={(v) => saveRelField('history_notes', v)}
              />
            </View>

            {/* Mediation Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Mediation Notes</Text>
              <InlineField
                label="What's been tried"
                value={polDet?.mediation_notes ?? ''}
                placeholder="Notes on mediation attempts…"
                onSave={(v) => savePolField('mediation_notes', v)}
              />
            </View>

            {/* Progress */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Progress</Text>
              <InlineField
                label="What's shifted"
                value={polDet?.progress_notes ?? ''}
                placeholder="Signs of progress or movement…"
                onSave={(v) => savePolField('progress_notes', v)}
              />
            </View>
          </>
        )}

        {/* ── ALLIANCE sections ── */}
        {rel.type === 'alliance' && (
          <>
            {/* Members */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Members</Text>
              <View style={styles.memberChipsWrap}>
                {members.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.memberChip,
                      { backgroundColor: (m.part_type ? TYPE_COLOR[m.part_type] : '#6B6860') + '18' },
                    ]}
                    onPress={() => m.part_id && safeNavigate(`/part-profile?id=${m.part_id}`)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.memberChipText,
                        { color: m.part_type ? TYPE_COLOR[m.part_type] : '#6B6860' },
                      ]}
                      numberOfLines={1}
                    >
                      {m.display_name ?? '?'}
                    </Text>
                  </TouchableOpacity>
                ))}
                {members.length === 0 && (
                  <Text style={styles.noMembersHint}>No members yet</Text>
                )}
              </View>
            </View>

            {/* What This Alliance Does */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>What This Alliance Does</Text>
              <InlineField
                label="Shared function"
                value={rel.description ?? ''}
                placeholder="What does this coalition work toward?"
                onSave={(v) => saveRelField('description', v)}
              />
            </View>

            {/* What It Protects Against */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>What It Protects Against</Text>
              <InlineField
                label="Protective function"
                value={rel.what_costs ?? ''}
                placeholder="What threat or pain does this alliance guard against?"
                onSave={(v) => saveRelField('what_costs', v)}
              />
            </View>

            {/* History */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>History</Text>
              <InlineField
                label="Origins and context"
                value={rel.history_notes ?? ''}
                placeholder="How did this alliance form?"
                onSave={(v) => saveRelField('history_notes', v)}
              />
            </View>
          </>
        )}

        {/* ── Activity Log ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Dialogues</Text>
          {dialogues.length === 0 ? (
            <Text style={styles.emptyText}>No dialogues yet</Text>
          ) : (
            dialogues.map((d) => {
              const preview = previewMessages(d.messages_json);
              let participantCount = 0;
              try {
                participantCount = JSON.parse(d.participants_json ?? '[]').length;
              } catch { /* noop */ }
              return (
                <TouchableOpacity
                  key={d.id}
                  style={styles.dialogueCard}
                  activeOpacity={0.7}
                  onPress={() => safeNavigate(`/dialogue-session?dialogueId=${d.id}`)}
                >
                  <View style={styles.dialogueIconWrap}>
                    <Ionicons name="chatbubble-outline" size={16} color="#3B5BA5" />
                  </View>
                  <View style={styles.dialogueBody}>
                    <View style={styles.dialogueTopRow}>
                      <Text style={styles.dialogueDate}>{fmtDate(d.created_at)}</Text>
                      {participantCount > 0 && (
                        <Text style={styles.dialogueParticipants}>{participantCount} participants</Text>
                      )}
                    </View>
                    {d.title ? (
                      <Text style={styles.dialogueTitle} numberOfLines={1}>{d.title}</Text>
                    ) : null}
                    {preview ? (
                      <Text style={styles.dialoguePreview} numberOfLines={2}>{preview}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#C5C3BE" />
                </TouchableOpacity>
              );
            })
          )}
          <TouchableOpacity
            style={styles.startDialogueBtn}
            activeOpacity={0.85}
            onPress={() => safeNavigate(`/dialogue-start?relationshipId=${id}`)}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#3B5BA5" />
            <Text style={styles.startDialogueBtnText}>Start Dialogue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerRight: { flex: 1 },

  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: 48,
  },

  // Header zone
  headerZone: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    gap: 10,
  },
  typePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    gap: 4,
  },
  actionBtnLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3B5BA5',
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // Sides
  sidesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sideCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },

  // Member chips
  memberChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  memberChip: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  memberChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  noMembersHint: {
    fontSize: 13,
    color: '#A09D96',
    fontStyle: 'italic',
  },

  emptyText: {
    fontSize: 14,
    color: '#A09D96',
    fontStyle: 'italic',
    marginBottom: 12,
  },

  // Dialogue cards
  dialogueCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  dialogueIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogueBody: { flex: 1 },
  dialogueTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  dialogueDate: { fontSize: 12, color: '#A09D96' },
  dialogueParticipants: { fontSize: 12, color: '#A09D96' },
  dialogueTitle: { fontSize: 14, fontWeight: '500', color: '#1C1B19', marginBottom: 3 },
  dialoguePreview: { fontSize: 13, color: '#6B6860', lineHeight: 18 },

  startDialogueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#3B5BA5',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  startDialogueBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#3B5BA5',
  },
});
