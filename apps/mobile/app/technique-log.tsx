/**
 * Technique Log — history of all completed practice sessions.
 * Route: /technique-log?sessionId=[optional]
 *
 * Shows weekly compliance (5-of-7 days) and a FlatList of session cards.
 * Used by the therapist (Joshua) to verify program compliance.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { TECHNIQUES } from '@/lib/techniques-data';
import { getDatabase } from '@/lib/database';
import { RelationalSnapshot } from '@/components/ui/RelationalSnapshot';

// ─── Types ────────────────────────────────────────────────────────────────────

type PartType = 'manager' | 'firefighter' | 'exile' | 'self' | 'unknown';

interface SessionRow {
  id: string;
  technique_id: string;
  completed_at: string;
  duration_minutes: number | null;
  part_id: string | null;
  notes_json: string | null;
  part_display_name: string | null;
  part_type: PartType | null;
}

interface RelationalSnapshotData {
  nodes: Array<{ id: string; name: string; partType: string }>;
  edges: Array<{ fromId: string; toId: string; feelings: string[] }>;
}

interface ParsedSession extends SessionRow {
  technique_title: string;
  technique_week: number | null;
  step_responses: Record<string, string>;
  actual_duration_seconds: number | undefined;
  rfb_breathing_rate: number | undefined;
  relational_snapshot: RelationalSnapshotData | undefined;
  meeting_dialogue_id: string | undefined;
  expanded: boolean;
}

const TYPE_COLOR: Record<PartType, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
  unknown:     '#6B6860',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
  }) + ' · ' + d.toLocaleTimeString('en-US', {
    hour:   'numeric',
    minute: '2-digit',
  });
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return 'less than a minute';
  const hours = Math.floor(totalSeconds / 3600);
  const mins  = Math.floor((totalSeconds % 3600) / 60);
  const secs  = totalSeconds % 60;
  if (hours > 0) return `${hours} hr ${mins} min`;
  return `${mins} min ${secs} sec`;
}

/** Returns ISO date string (YYYY-MM-DD) for the most recent Monday */
function getMostRecentMonday(from: Date = new Date()): Date {
  const d = new Date(from);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns array of 7 Date objects starting from Monday */
function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Compliance Strip ─────────────────────────────────────────────────────────

function ComplianceStrip({
  sessions,
  techniqueId,
}: {
  sessions: ParsedSession[];
  techniqueId: string;
}) {
  const monday   = getMostRecentMonday();
  const weekDays = getWeekDays(monday);

  // Days this week that have a completed session for this technique
  const practicedDays = new Set(
    sessions
      .filter((s) => s.technique_id === techniqueId)
      .filter((s) => {
        const d = new Date(s.completed_at);
        const ds = toDateStr(d);
        return weekDays.some((wd) => toDateStr(wd) === ds);
      })
      .map((s) => toDateStr(new Date(s.completed_at))),
  );

  const count = practicedDays.size;

  return (
    <View style={cp.container}>
      <Text style={cp.label}>{count} of 5 days this week</Text>
      <View style={cp.dotsRow}>
        {weekDays.map((d, i) => {
          const practiced = practicedDays.has(toDateStr(d));
          const dayLabel  = ['M','T','W','T','F','S','S'][i];
          return (
            <View key={i} style={cp.dayCol}>
              <View style={[cp.dot, practiced && cp.dotFilled]} />
              <Text style={[cp.dayLabel, practiced && cp.dayLabelActive]}>{dayLabel}</Text>
            </View>
          );
        })}
      </View>
      <Text style={cp.note}>5 days per week required for program completion</Text>
    </View>
  );
}

const cp = StyleSheet.create({
  container: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0E6C0',
    marginBottom: 20,
  },
  label: { fontSize: 14, fontWeight: '700', color: '#B88A00', marginBottom: 12 },
  dotsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  dayCol: { alignItems: 'center', gap: 4, flex: 1 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3EED8',
    borderWidth: 1.5,
    borderColor: '#E6D8A0',
  },
  dotFilled: { backgroundColor: '#B88A00', borderColor: '#B88A00' },
  dayLabel: { fontSize: 11, color: '#B8A870', fontWeight: '600' },
  dayLabelActive: { color: '#B88A00' },
  note: { fontSize: 12, color: '#B88A00', opacity: 0.7 },
});

// ─── Complex Step Renderer ────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  'Thought':          '#3B5BA5',
  'Feeling':          '#7C3D9B',
  'Body sensation':   '#C2600A',
  'Impulse':          '#C2600A',
  'Memory':           '#7C3D9B',
  'Visual/image':     '#3B5BA5',
  'External stimulus':'#6B6860',
};

function ComplexStepRenderer({ stepId, value, dialogueId }: { stepId: string; value: string; dialogueId?: string }) {
  // Experience log / Unblending log — JSON array of entries
  if (stepId === 'experience-log' || stepId === 'unblending-log' || stepId === 'mindfulness-practice') {
    try {
      const entries = JSON.parse(value) as Array<{
        id: string;
        category: string;
        description?: string;
        timestamp: string;
        unblended?: boolean;
        stayedBlended?: boolean;
        noticeText?: string;
        linkedPartName?: string;
        additionalNotes?: string[];
        sitWithNotes?: Record<string, string>;
      }>;
      if (!Array.isArray(entries)) throw new Error();
      return (
        <View style={cr.section}>
          {entries.map((entry, i) => {
            const color = CATEGORY_COLOR[entry.category] ?? '#6B6860';
            const hasSitWith = entry.sitWithNotes && Object.values(entry.sitWithNotes).some(Boolean);
            return (
              <View key={entry.id ?? i} style={cr.entryBlock}>
                {/* Top row: badge + icons + timestamp */}
                <View style={cr.entryRow}>
                  <View style={[cr.categoryBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                    <Text style={[cr.categoryText, { color }]}>{entry.category}</Text>
                  </View>
                  {entry.unblended && !entry.stayedBlended && (
                    <Ionicons name="leaf-outline" size={12} color="#B88A00" style={cr.unblendedIcon} />
                  )}
                  {entry.stayedBlended && (
                    <View style={cr.stayedPill}>
                      <Text style={cr.stayedPillText}>stayed with</Text>
                    </View>
                  )}
                  <Text style={cr.entryTimestamp}>{entry.timestamp}</Text>
                </View>
                {/* Description text */}
                {entry.description ? (
                  <Text style={cr.entryDescription}>{entry.description}</Text>
                ) : null}
                {/* Notice text (gold italic) */}
                {entry.noticeText ? (
                  <Text style={cr.entryNoticeText}>{entry.noticeText}</Text>
                ) : null}
                {/* Linked part pill */}
                {entry.linkedPartName ? (
                  <View style={cr.linkedPartPill}>
                    <Text style={cr.linkedPartPillText}>{entry.linkedPartName}</Text>
                  </View>
                ) : null}
                {/* Additional notes bullets */}
                {entry.additionalNotes?.map((note, ni) => (
                  <Text key={ni} style={cr.additionalNote}>· {note}</Text>
                ))}
                {/* Sit-with observations (collapsed disclosure) */}
                {hasSitWith ? (
                  <Text style={cr.sitWithLabel}>
                    Observations: {Object.values(entry.sitWithNotes!).filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
            );
          })}
          {entries.length === 0 && <Text style={cr.emptyText}>No entries logged.</Text>}
        </View>
      );
    } catch {
      return <Text style={cr.errorText}>[Could not display — raw data preserved]</Text>;
    }
  }

  // Unblend cycle — JSON object
  if (stepId === 'unblend-cycle') {
    try {
      const d = JSON.parse(value) as {
        final_feeling?: string[];
        free_text?: string;
        cycle_count?: number;
        identified_parts?: Array<{ partName: string; feeling: string }>;
        in_self_note?: string;
        self_sit_note?: string;
      };
      return (
        <View style={cr.section}>
          {d.final_feeling && d.final_feeling.length > 0 && (
            <Text style={cr.line}>Feeling toward part: {d.final_feeling.join(', ')}</Text>
          )}
          {d.free_text ? <Text style={cr.noticeTextLine}>{d.free_text}</Text> : null}
          {typeof d.cycle_count === 'number' && (
            <Text style={cr.line}>Cycles to Self: {d.cycle_count}</Text>
          )}
          {d.identified_parts && d.identified_parts.length > 0 && (
            <View style={cr.indented}>
              {d.identified_parts.map((p, i) => (
                <Text key={i} style={cr.line}>· {p.partName} ({p.feeling})</Text>
              ))}
            </View>
          )}
          {d.in_self_note ? <Text style={cr.descLine}>"{d.in_self_note}"</Text> : null}
          {d.self_sit_note ? (
            <Text style={{ fontSize: 13, color: '#B88A00', fontStyle: 'italic', marginTop: 8 }}>
              Self sit-with: {d.self_sit_note}
            </Text>
          ) : null}
        </View>
      );
    } catch {
      return <Text style={cr.errorText}>[Could not display — raw data preserved]</Text>;
    }
  }

  // Inquiry questions — JSON object with responses array
  if (stepId === 'inquiry-questions') {
    try {
      const d = JSON.parse(value) as {
        questions_asked?: number;
        responses?: Array<{ question: string; response: string }>;
        unblend_log?: Array<{ experiences?: Array<{ category: string }>; linkedPartName?: string; wasUnblended: boolean }>;
      };
      const responses = d.responses ?? [];
      const unblendLog = d.unblend_log ?? [];
      return (
        <View style={cr.section}>
          <Text style={cr.sectionMeta}>
            {d.questions_asked ?? responses.length} question{responses.length !== 1 ? 's' : ''} asked
          </Text>
          {responses.map((r, i) => (
            <View key={i} style={cr.qaBlock}>
              <Text style={cr.question} numberOfLines={2}>
                Q: {r.question.length > 60 ? r.question.slice(0, 60) + '…' : r.question}
              </Text>
              {r.response ? <Text style={cr.answer}>A: {r.response}</Text> : null}
              {i < responses.length - 1 && <View style={cr.divider} />}
            </View>
          ))}
          {responses.length === 0 && <Text style={cr.emptyText}>No responses recorded.</Text>}
          {unblendLog.length > 0 && (
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', marginTop: 8 }}>
              Unblended {unblendLog.length} time{unblendLog.length !== 1 ? 's' : ''}
              {unblendLog.some((u) => u.linkedPartName) ? ': ' + unblendLog.filter((u) => u.linkedPartName).map((u) => u.linkedPartName).join(', ') : ''}
            </Text>
          )}
        </View>
      );
    } catch {
      return <Text style={cr.errorText}>[Could not display — raw data preserved]</Text>;
    }
  }

  // Meeting dialogue — JSON object
  if (stepId === 'meeting-dialogue') {
    try {
      const d = JSON.parse(value) as {
        space_type?: string;
        parts_present?: string[];
        opening_prompts?: Array<{ partName: string; content: string }>;
        messages?: Array<{ speaker: string; text: string }>;
      };
      const messages = d.messages ?? [];
      return (
        <View style={cr.section}>
          {d.space_type && <Text style={cr.line}>Space: {d.space_type}</Text>}
          {d.parts_present && d.parts_present.length > 0 && (
            <Text style={cr.line}>Parts present: {d.parts_present.length} part{d.parts_present.length !== 1 ? 's' : ''}</Text>
          )}
          {d.opening_prompts && d.opening_prompts.length > 0 && (
            <View style={cr.indented}>
              <Text style={cr.subLabel}>Opening:</Text>
              {d.opening_prompts.map((op, i) => (
                <Text key={i} style={cr.line}>· {op.partName}: {op.content.length > 60 ? op.content.slice(0, 60) + '…' : op.content}</Text>
              ))}
            </View>
          )}
          {/* If dialogue was saved to inner_dialogues, show link instead of inline messages */}
          {dialogueId ? (
            <TouchableOpacity
              style={cr.dialogueLinkBtn}
              onPress={() => router.push({ pathname: '/dialogue-session', params: { dialogueId } })}
              activeOpacity={0.8}
            >
              <Text style={cr.dialogueLinkText}>
                View full dialogue ({messages.length} message{messages.length !== 1 ? 's' : ''}) →
              </Text>
            </TouchableOpacity>
          ) : (
            messages.length > 0 && (
              <View style={cr.indented}>
                <Text style={cr.subLabel}>Dialogue ({messages.length} messages):</Text>
                {messages.slice(0, 5).map((m, i) => (
                  <Text key={i} style={cr.line}>
                    {m.speaker}: {m.text.length > 80 ? m.text.slice(0, 80) + '…' : m.text}
                  </Text>
                ))}
                {messages.length > 5 && <Text style={cr.moreText}>and {messages.length - 5} more...</Text>}
              </View>
            )
          )}
        </View>
      );
    } catch {
      return <Text style={cr.errorText}>[Could not display — raw data preserved]</Text>;
    }
  }

  // Default — plain text
  return <Text style={card.responseValue}>{value}</Text>;
}

const cr = StyleSheet.create({
  section:           { gap: 6 },
  entryBlock:        { gap: 3, marginBottom: 2 },
  entryRow:          { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  categoryBadge:     { borderRadius: 8, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  categoryText:      { fontSize: 10, fontWeight: '600' },
  unblendedIcon:     { marginLeft: 2 },
  stayedPill:        { backgroundColor: '#FFF7ED', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 2 },
  stayedPillText:    { fontSize: 10, color: '#C2600A', fontWeight: '600' },
  entryTimestamp:    { fontSize: 10, color: '#B8B4AC', flex: 1, textAlign: 'right' },
  entryDescription:  { fontSize: 13, color: '#9B9A94', marginTop: 4, lineHeight: 18 },
  entryNoticeText:   { fontSize: 12, color: '#B88A00', fontStyle: 'italic', lineHeight: 18 },
  linkedPartPill:    { alignSelf: 'flex-start', backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  linkedPartPillText:{ fontSize: 11, color: '#3B5BA5', fontWeight: '500' },
  additionalNote:    { fontSize: 12, color: '#9B9A94', lineHeight: 18 },
  sitWithLabel:      { fontSize: 11, color: '#B8B4AC', fontStyle: 'italic', lineHeight: 17 },
  emptyText:         { fontSize: 12, color: '#B8B4AC', fontStyle: 'italic' },
  errorText:         { fontSize: 12, color: '#B8B4AC', fontStyle: 'italic' },
  noticeTextLine:    { fontSize: 12, color: '#B88A00', fontStyle: 'italic', lineHeight: 18, marginTop: 2 },
  descLine:          { fontSize: 13, color: '#9B9A94', lineHeight: 20, fontStyle: 'italic' },
  line:           { fontSize: 13, color: '#1C1B19', lineHeight: 20 },
  sectionMeta:    { fontSize: 11, color: '#B8B4AC', marginBottom: 4 },
  qaBlock:        { marginBottom: 4 },
  question:       { fontSize: 12, color: '#6B6860', lineHeight: 18 },
  answer:         { fontSize: 13, color: '#1C1B19', lineHeight: 20 },
  divider:        { height: 1, backgroundColor: '#E5E3DE', marginVertical: 4 },
  indented:       { marginLeft: 8, gap: 2 },
  subLabel:       { fontSize: 11, fontWeight: '700', color: '#B8B4AC', marginBottom: 2 },
  moreText:          { fontSize: 12, color: '#B8B4AC', fontStyle: 'italic' },
  dialogueLinkBtn:   { marginTop: 6, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#EEF2FF', borderRadius: 8, alignSelf: 'flex-start' },
  dialogueLinkText:  { fontSize: 13, color: '#3B5BA5', fontWeight: '600' },
});

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onToggle,
}: {
  session: ParsedSession;
  onToggle: () => void;
}) {
  const partColor = session.part_type ? TYPE_COLOR[session.part_type] : undefined;
  const beforeText = session.step_responses['before'] ?? null;
  const afterText  = session.step_responses['after']  ?? null;

  // Actual duration display
  const durationDisplay = session.actual_duration_seconds !== undefined
    ? formatDuration(session.actual_duration_seconds)
    : session.duration_minutes !== null && session.duration_minutes !== undefined
      ? formatDuration(session.duration_minutes * 60)
      : null;

  return (
    <View style={card.container}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.75} style={card.header}>
        <View style={card.headerLeft}>
          <View style={card.weekBadge}>
            {session.technique_week !== null && (
              <Text style={card.weekBadgeText}>Week {session.technique_week}</Text>
            )}
          </View>
          <Text style={card.title}>{session.technique_title}</Text>
        </View>
        <Ionicons
          name={session.expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#B8B4AC"
        />
      </TouchableOpacity>

      <Text style={card.dateText}>{formatDate(session.completed_at)}</Text>

      {durationDisplay && (
        <Text style={card.durationText}>Time spent: {durationDisplay}</Text>
      )}

      {session.technique_id === 'rfb' && session.rfb_breathing_rate !== undefined && (
        <Text style={card.durationText}>Rate: {session.rfb_breathing_rate.toFixed(1)}s</Text>
      )}

      {session.part_display_name && partColor && (
        <View style={[card.partBadge, { backgroundColor: partColor + '1A', borderColor: partColor + '40' }]}>
          <Text style={[card.partBadgeText, { color: partColor }]}>{session.part_display_name}</Text>
        </View>
      )}

      {/* Preview — always visible */}
      {beforeText && (
        <Text style={card.previewText} numberOfLines={session.expanded ? undefined : 1}>
          Before: {beforeText}
        </Text>
      )}
      {afterText && (
        <Text style={card.previewText} numberOfLines={session.expanded ? undefined : 1}>
          After: {afterText}
        </Text>
      )}

      {/* Full responses — expanded only */}
      {session.expanded && Object.entries(session.step_responses).map(([stepId, value]) => {
        if (!value || stepId === 'before' || stepId === 'after') return null;
        return (
          <View key={stepId} style={card.responseRow}>
            <Text style={card.responseLabel}>{stepId.replace(/-/g, ' ')}</Text>
            <ComplexStepRenderer
            stepId={stepId}
            value={value}
            dialogueId={stepId === 'meeting-dialogue' ? session.meeting_dialogue_id : undefined}
          />
          </View>
        );
      })}

      {/* Relational snapshot — Meeting Space sessions only */}
      {session.expanded &&
       session.relational_snapshot &&
       (session.relational_snapshot.nodes?.length ?? 0) > 0 && (
        <View style={card.snapshotSection}>
          <Text style={card.responseLabel}>RELATIONAL MAP</Text>
          <RelationalSnapshot
            nodes={session.relational_snapshot.nodes as Parameters<typeof RelationalSnapshot>[0]['nodes']}
            edges={session.relational_snapshot.edges ?? []}
            size={260}
          />
        </View>
      )}
    </View>
  );
}

const card = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#1C1B19',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  weekBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  weekBadgeText: { fontSize: 10, fontWeight: '700', color: '#6B6860', letterSpacing: 0.4 },
  title:        { fontSize: 15, fontWeight: '700', color: '#1C1B19', flexShrink: 1 },
  dateText:     { fontSize: 12, color: '#6B6860', marginBottom: 4 },
  durationText: { fontSize: 12, color: '#6B6860', marginBottom: 4 },
  partBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  partBadgeText: { fontSize: 12, fontWeight: '600' },
  previewText:  { fontSize: 13, color: '#4A4844', lineHeight: 20, marginBottom: 4 },
  responseRow:  { marginTop: 8 },
  responseLabel:{ fontSize: 11, fontWeight: '700', color: '#B8B4AC', textTransform: 'capitalize', marginBottom: 2 },
  responseValue:{ fontSize: 13, color: '#1C1B19', lineHeight: 20 },
  snapshotSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
});

// ─── Week filter pill ─────────────────────────────────────────────────────────

function WeekPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[wp.pill, selected && wp.pillSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[wp.text, selected && wp.textSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const wp = StyleSheet.create({
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E3DE',
  },
  pillSelected: { backgroundColor: '#3B5BA5', borderColor: '#3B5BA5' },
  text:         { fontSize: 13, fontWeight: '600', color: '#6B6860' },
  textSelected: { color: '#FFFFFF' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TechniqueLogScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const flatListRef = useRef<FlatList<ParsedSession>>(null);

  const [allSessions, setAllSessions] = useState<ParsedSession[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null); // null = All

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Scroll to target session after load
  useEffect(() => {
    if (!sessionId || allSessions.length === 0) return;
    const idx = allSessions.findIndex((s) => s.id === sessionId);
    if (idx >= 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: idx, animated: true });
      }, 150);
    }
  }, [allSessions, sessionId]);

  async function loadSessions() {
    try {
      const db = getDatabase();
      const rows = await db.getAllAsync<SessionRow>(
        `SELECT
           ps.id, ps.technique_id, ps.completed_at, ps.duration_minutes,
           ps.part_id, ps.notes_json,
           COALESCE(p.custom_name, p.name) AS part_display_name,
           p.type AS part_type
         FROM practice_sessions ps
         LEFT JOIN parts p ON p.id = ps.part_id
         ORDER BY ps.completed_at DESC`,
      );

      const parsed: ParsedSession[] = rows.map((row) => {
        const technique = TECHNIQUES.find((t) => t.id === row.technique_id);
        let step_responses: Record<string, string> = {};
        let actual_duration_seconds: number | undefined;
        let rfb_breathing_rate: number | undefined;
        let relational_snapshot: RelationalSnapshotData | undefined;
        let meeting_dialogue_id: string | undefined;

        if (row.notes_json) {
          try {
            const n = JSON.parse(row.notes_json) as Record<string, unknown>;
            step_responses = (n.step_responses ?? {}) as Record<string, string>;
            if (typeof n.actual_duration_seconds === 'number') {
              actual_duration_seconds = n.actual_duration_seconds;
            }
            if (typeof n.rfb_breathing_rate === 'number') {
              rfb_breathing_rate = n.rfb_breathing_rate;
            }
            if (n.relational_snapshot && typeof n.relational_snapshot === 'object') {
              relational_snapshot = n.relational_snapshot as RelationalSnapshotData;
            }
            if (typeof n.meeting_dialogue_id === 'string') {
              meeting_dialogue_id = n.meeting_dialogue_id;
            }
          } catch {}
        }
        return {
          ...row,
          technique_title: technique?.title ?? row.technique_id,
          technique_week:  technique?.week ?? null,
          step_responses,
          actual_duration_seconds,
          rfb_breathing_rate,
          relational_snapshot,
          meeting_dialogue_id,
          expanded: row.id === sessionId,
        };
      });

      setAllSessions(parsed);
    } catch (e) {
      console.error('[TechniqueLog] loadSessions:', e);
    }
  }

  function toggleExpanded(id: string) {
    setAllSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, expanded: !s.expanded } : s)),
    );
  }

  // Filter by week
  const filteredSessions = selectedWeek === null
    ? allSessions
    : allSessions.filter((s) => {
        const technique = TECHNIQUES.find((t) => t.id === s.technique_id);
        return technique?.week === selectedWeek;
      });

  // Technique for compliance strip
  const selectedTechnique = selectedWeek !== null
    ? TECHNIQUES.find((t) => t.week === selectedWeek)
    : null;

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#1C1B19" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Practice Log</Text>
        <View style={s.headerRight} />
      </View>

      {/* Week filter strip */}
      <View style={s.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
          <WeekPill
            label="All"
            selected={selectedWeek === null}
            onPress={() => setSelectedWeek(null)}
          />
          {TECHNIQUES.map((t) => (
            <WeekPill
              key={t.id}
              label={`Week ${t.week}`}
              selected={selectedWeek === t.week}
              onPress={() => setSelectedWeek(t.week)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        ref={flatListRef}
        data={filteredSessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={() => {/* no-op: index may not exist if filtered */}}
        ListHeaderComponent={
          selectedTechnique ? (
            <ComplianceStrip
              sessions={allSessions}
              techniqueId={selectedTechnique.id}
            />
          ) : null
        }
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Ionicons name="journal-outline" size={40} color="#B8B4AC" />
            <Text style={s.emptyHeading}>No practice sessions yet</Text>
            <Text style={s.emptyBody}>Your completed practices will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <SessionCard session={item} onToggle={() => toggleExpanded(item.id)} />
        )}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAF8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FAFAF8',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1B19',
    textAlign: 'center',
  },
  headerRight: { width: 28 },
  filterWrap: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FAFAF8',
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 64,
    gap: 12,
  },
  emptyHeading: { fontSize: 18, fontWeight: '700', color: '#1C1B19' },
  emptyBody:    { fontSize: 14, color: '#6B6860', textAlign: 'center' },
});
