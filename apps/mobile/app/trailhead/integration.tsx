/**
 * Trailhead — Close & Integration
 * Route: /trailhead/integration?sessionId=[id]&partial=[0|1]&readOnly=[0|1]
 *
 * Completion mode (partial=0 or omitted):
 *   - Trail chain visualization
 *   - Discovery summary
 *   - Trail naming
 *   - Write protection relationships + elaboration data to DB (once)
 *   - Forward orientation card
 *
 * Partial mode (partial=1):
 *   - Abbreviated card: where you are, return button
 *
 * ReadOnly mode (readOnly=1): all inputs disabled, no DB writes
 */

import { useEffect, useRef, useState } from 'react';
import {
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

import {
  getChainEntries,
  getExileContact,
  getTrailheadSession,
  updateTrailheadSession,
  writeElaborationData,
  writeProtectionRelationships,
} from '@/lib/trailhead-db';
import type {
  ChainEntryWithPart,
  TrailheadExileContact,
  TrailheadSession,
} from '@/lib/trailhead-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function autoTitle(session: TrailheadSession): string {
  if (session.title) return session.title;
  const typeLabel = session.entry_type.charAt(0).toUpperCase() + session.entry_type.slice(1);
  return `Trail — ${typeLabel} — ${formatDate(session.created_at)}`;
}

const PART_COLORS: Record<string, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
  unknown:     '#6B6860',
};

const PART_BG: Record<string, string> = {
  manager:     '#EEF2FF',
  firefighter: '#FFF7ED',
  exile:       '#F5F0FF',
  self:        '#FFFBEB',
  unknown:     '#F5F4F1',
};

function pauseLabel(phase: string | null): string {
  if (!phase) return 'the session.';
  switch (phase) {
    case 'entry':            return 'the opening.';
    case 'initial_self_check': return 'the initial check-in.';
    case 'first_contact':    return 'making first contact.';
    case 'loop':             return 'working with a part.';
    case 'exile_transition': return 'the approach to the exile.';
    case 'exile_contact':    return 'exile contact.';
    case 'integration':      return 'the integration stage.';
    default:                 return 'the session.';
  }
}

// ─── Chain Visualization ──────────────────────────────────────────────────────

function ChainViz({
  entries,
  exilePartName,
  exilePartId,
}: {
  entries: ChainEntryWithPart[];
  exilePartName: string | null;
  exilePartId: string | null;
}) {
  const nodes = [...entries];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={cv.row}
      style={cv.scroll}
    >
      {nodes.map((e, i) => {
        const color = PART_COLORS[e.part_type ?? 'unknown'];
        const bg    = PART_BG[e.part_type ?? 'unknown'];
        const name  = e.part_display_name ?? 'Unknown';
        return (
          <View key={e.id} style={cv.nodeWrap}>
            {i > 0 && (
              <View style={cv.arrowWrap}>
                <View style={cv.arrowLine} />
                <Text style={cv.arrowHead}>▶</Text>
              </View>
            )}
            <View style={[cv.node, { borderColor: color, backgroundColor: bg }]}>
              <View style={[cv.dot, { backgroundColor: color }]} />
              <Text style={[cv.typeLabel, { color }]} numberOfLines={1}>
                {e.part_type ?? 'part'}
              </Text>
            </View>
            <Text style={cv.name} numberOfLines={2}>{name}</Text>
          </View>
        );
      })}

      {/* Exile node if reached */}
      {exilePartId && exilePartName && (
        <View style={cv.nodeWrap}>
          <View style={cv.arrowWrap}>
            <View style={cv.arrowLine} />
            <Text style={cv.arrowHead}>▶</Text>
          </View>
          <View style={[cv.node, { borderColor: '#7C3D9B', backgroundColor: '#F5F0FF' }]}>
            <View style={[cv.dot, { backgroundColor: '#7C3D9B' }]} />
            <Text style={[cv.typeLabel, { color: '#7C3D9B' }]}>exile</Text>
          </View>
          <Text style={cv.name} numberOfLines={2}>{exilePartName}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const cv = StyleSheet.create({
  scroll: { flexShrink: 0, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 0,
  },
  nodeWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 0,
  },
  arrowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  arrowLine: { width: 22, height: 1, backgroundColor: '#E5E3DE' },
  arrowHead: { fontSize: 10, color: '#6B6860', marginLeft: -4 },
  node: {
    width: 64,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 4,
  },
  dot:      { width: 8, height: 8, borderRadius: 4 },
  typeLabel:{ fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  name: {
    position: 'absolute',
    bottom: -22,
    left: 0,
    right: 0,
    fontSize: 10,
    color: '#1C1B19',
    textAlign: 'center',
    width: 64,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrailheadIntegrationScreen() {
  const { sessionId: sidParam, partial, readOnly } = useLocalSearchParams<{
    sessionId: string;
    partial?: string;
    readOnly?: string;
  }>();
  const sessionId = parseInt(sidParam ?? '0', 10);
  const isPartial  = partial === '1';
  const isReadOnly = readOnly === '1';

  const [session, setSession]       = useState<TrailheadSession | null>(null);
  const [entries, setEntries]       = useState<ChainEntryWithPart[]>([]);
  const [exileContact, setExileContact] = useState<TrailheadExileContact | null>(null);
  const [exilePartName, setExilePartName] = useState<string | null>(null);
  const [trailTitle, setTrailTitle] = useState('');
  const [titleSaved, setTitleSaved] = useState(false);
  const [working, setWorking]       = useState(false);
  const wroteRelationships = useRef(false);

  useEffect(() => {
    async function load() {
      const [sess, chain, ec] = await Promise.all([
        getTrailheadSession(sessionId),
        getChainEntries(sessionId),
        getExileContact(sessionId),
      ]);
      if (!sess) return;
      setSession(sess);
      setEntries(chain);
      setExileContact(ec);
      setTrailTitle(autoTitle(sess));

      // Load exile part name if present
      if (sess.exile_part_id) {
        // Chain entries include the exile node via part_id matching
        const exileEntry = chain.find((e) => e.part_id === sess.exile_part_id);
        setExilePartName(exileEntry?.part_display_name ?? null);
      } else if (ec?.part_id) {
        const exileEntry = chain.find((e) => e.part_id === ec.part_id);
        setExilePartName(exileEntry?.part_display_name ?? null);
      }

      // Write relationships + elaboration data once on completion mode
      if (!isPartial && !isReadOnly && !wroteRelationships.current) {
        wroteRelationships.current = true;
        await writeProtectionRelationships(sessionId);
        await writeElaborationData(sessionId);
      }
    }
    load();
  }, [sessionId, isPartial, isReadOnly]);

  async function saveTitle() {
    if (isReadOnly || working) return;
    setWorking(true);
    try {
      await updateTrailheadSession(sessionId, { title: trailTitle.trim() || null });
      setTitleSaved(true);
    } finally {
      setWorking(false);
    }
  }

  function forwardOrientationText(): string {
    if (!session) return '';
    if (session.exile_part_id || exileContact?.part_id) {
      return 'This part is now visible in your system. You can explore it further through Elaboration or Inner Dialogue whenever you feel ready.';
    }
    const lastEntry = entries[entries.length - 1];
    if (lastEntry?.loop_outcome === 'refused') {
      const name = lastEntry.part_display_name ?? 'That part';
      return `${name} wasn't ready today, and that's meaningful data about your system. The trail is saved. You might return to it, or bring it to a session.`;
    }
    if (session.paused_at_phase === 'exile_transition') {
      return 'The work with your protectors is complete and saved. The exile can be approached when the time feels right — in the app, or with support.';
    }
    return 'Your trail is saved. You can return to it or continue exploring through Elaboration or Inner Dialogue.';
  }

  if (!session) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.loading}>
          <Text style={s.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.replace('/trailhead')}
          hitSlop={12}
          style={s.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color="#6B6860" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {isPartial ? 'Trail Saved' : 'Integration'}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ══ PARTIAL MODE ══ */}
        {isPartial && (
          <>
            <View style={s.card}>
              <Text style={s.cardTitle}>This trail is saved.</Text>
              <Text style={s.cardSubtitle}>Here's where you are:</Text>

              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Entry</Text>
                <Text style={s.summaryVal}>
                  {session.entry_type} — "{session.entry_description}"
                </Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Parts worked with</Text>
                <Text style={s.summaryVal}>{entries.length}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Paused during</Text>
                <Text style={s.summaryVal}>{pauseLabel(session.paused_at_phase)}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => router.push(`/trailhead/reentry?sessionId=${sessionId}`)}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>Return to this trail</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.secondaryBtn}
              onPress={() => router.replace('/trailhead')}
              activeOpacity={0.85}
            >
              <Text style={s.secondaryBtnText}>Close</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ══ COMPLETION MODE ══ */}
        {!isPartial && (
          <>
            {/* Trail chain visualization */}
            <Text style={s.sectionLabel}>Trail Chain</Text>
            <View style={s.chainCard}>
              <ChainViz
                entries={entries}
                exilePartName={exilePartName}
                exilePartId={session.exile_part_id ?? exileContact?.part_id ?? null}
              />
              {entries.length === 0 && (
                <Text style={s.dimText}>No parts recorded in chain.</Text>
              )}
            </View>

            {/* Summary card */}
            <Text style={s.sectionLabel}>What you discovered</Text>
            <View style={s.card}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Entry</Text>
                <Text style={s.summaryVal}>
                  {session.entry_type.charAt(0).toUpperCase() + session.entry_type.slice(1)} — "{session.entry_description}"
                  {session.entry_intensity ? ` — intensity ${session.entry_intensity}/10` : ''}
                </Text>
              </View>

              <Text style={[s.summaryLabel, { marginTop: 12, marginBottom: 6 }]}>Parts encountered</Text>
              {entries.map((e) => {
                const color = PART_COLORS[e.part_type ?? 'unknown'];
                return (
                  <View key={e.id} style={s.partRow}>
                    <View style={[s.partBadge, { backgroundColor: color }]}>
                      <Text style={s.partBadgeText}>{e.part_type ?? 'part'}</Text>
                    </View>
                    <Text style={s.partName}>{e.part_display_name ?? 'Unknown part'}</Text>
                  </View>
                );
              })}
              {entries.length === 0 && (
                <Text style={s.dimText}>No parts encountered.</Text>
              )}

              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Exile reached</Text>
                <Text style={s.summaryVal}>
                  {(session.exile_part_id || exileContact?.part_id)
                    ? (exilePartName ?? 'Yes')
                    : 'Not yet reached'}
                </Text>
              </View>
            </View>

            {/* Trail naming */}
            {!isReadOnly && (
              <>
                <Text style={s.sectionLabel}>Name this trail</Text>
                <View style={s.card}>
                  <Text style={s.cardBody}>Give this trail a name to find it easily later.</Text>
                  <TextInput
                    style={s.titleInput}
                    value={trailTitle}
                    onChangeText={setTrailTitle}
                    placeholder={autoTitle(session)}
                    placeholderTextColor="#9CA3AF"
                    onBlur={saveTitle}
                  />
                  {titleSaved ? (
                    <Text style={s.savedHint}>Saved</Text>
                  ) : (
                    <TouchableOpacity
                      style={s.saveNameBtn}
                      onPress={saveTitle}
                      disabled={working}
                      activeOpacity={0.8}
                    >
                      <Text style={s.saveNameBtnText}>Save name</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            {/* Forward orientation */}
            <View style={s.orientCard}>
              <Text style={s.orientText}>{forwardOrientationText()}</Text>
            </View>

            {/* Done */}
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={async () => {
                if (!isReadOnly) await saveTitle();
                router.replace('/trailhead');
              }}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAF8' },

  loading:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, color: '#6B6860' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1C1B19' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 20 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 18,
    gap: 10,
  },
  chainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    paddingVertical: 8,
    paddingBottom: 36, // room for name labels below nodes
    overflow: 'hidden',
  },
  cardTitle:    { fontSize: 18, fontWeight: '700', color: '#1C1B19' },
  cardSubtitle: { fontSize: 14, color: '#6B6860', marginBottom: 4 },
  cardBody:     { fontSize: 14, color: '#6B6860', lineHeight: 21 },

  summaryRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: '#6B6860', minWidth: 100 },
  summaryVal:   { flex: 1, fontSize: 13, color: '#1C1B19', lineHeight: 20 },

  partRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  partBadge:    { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  partBadgeText:{ fontSize: 11, fontWeight: '600', color: '#FFFFFF', textTransform: 'capitalize' },
  partName:     { fontSize: 14, color: '#1C1B19', fontWeight: '500' },

  titleInput: {
    borderWidth: 1,
    borderColor: '#E5E3DE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#1C1B19',
    backgroundColor: '#FAFAF8',
  },
  saveNameBtn:     { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 6 },
  saveNameBtnText: { fontSize: 13, color: '#3B5BA5', fontWeight: '600' },
  savedHint:       { fontSize: 12, color: '#166534', textAlign: 'right' },

  orientCard: {
    backgroundColor: '#F5F0FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(124,61,155,0.2)',
    padding: 20,
    marginTop: 16,
  },
  orientText: {
    fontSize: 15,
    color: '#4C1D73',
    lineHeight: 24,
    textAlign: 'center',
  },

  dimText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 8 },

  primaryBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#E5E3DE',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: { fontSize: 15, color: '#6B6860' },
});
