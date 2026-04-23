/**
 * Trailhead — Trail List
 * Route: /trailhead
 *
 * Lists active/paused trails ("In Progress") and completed trails.
 * Tapping in-progress → /trailhead/reentry
 * Tapping completed  → /trailhead/integration (read-only)
 * "+"               → /trailhead/new
 */

import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { listTrailheadSessions } from '@/lib/trailhead-db';
import type { TrailSummaryRow } from '@/lib/trailhead-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function autoTitle(row: TrailSummaryRow): string {
  if (row.title) return row.title;
  const typeLabel =
    row.entry_type === 'thought'   ? 'Thought' :
    row.entry_type === 'feeling'   ? 'Feeling' :
    row.entry_type === 'sensation' ? 'Sensation' : 'Impulse';
  return `Trail — ${typeLabel} — ${formatDate(row.created_at)}`;
}

function statusBadge(row: TrailSummaryRow): { label: string; color: string; bg: string } {
  if (row.status === 'complete') return { label: 'Complete',    color: '#166534', bg: '#D1FAE5' };
  return                                { label: 'In Progress', color: '#92400E', bg: '#FEF3C7' };
}

// ─── Trail Card ───────────────────────────────────────────────────────────────

function TrailCard({ row, onPress }: { row: TrailSummaryRow; onPress: () => void }) {
  const title = autoTitle(row);
  const badge = statusBadge(row);
  const phaseLabel =
    row.current_phase === 'exile_contact' || row.current_phase === 'integration'
      ? 'Exile reached'
      : row.current_phase === 'exile_transition'
      ? 'Near exile'
      : `${row.part_count} part${row.part_count !== 1 ? 's' : ''} encountered`;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle} numberOfLines={2}>{title}</Text>
        <View style={[s.badge, { backgroundColor: badge.bg }]}>
          <Text style={[s.badgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>
      <Text style={s.cardDate}>{formatDate(row.created_at)}</Text>
      <View style={s.cardMeta}>
        <View style={s.entryPill}>
          <Text style={s.entryPillText}>{row.entry_type}</Text>
        </View>
        <Text style={s.cardMetaText}>{phaseLabel}</Text>
        {row.exile_part_id ? (
          <View style={s.exileDot} />
        ) : null}
      </View>
      <Text style={s.cardSnippet} numberOfLines={1}>
        "{row.entry_description}"
      </Text>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrailheadListScreen() {
  const [inProgress, setInProgress] = useState<TrailSummaryRow[]>([]);
  const [completed, setCompleted]   = useState<TrailSummaryRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      listTrailheadSessions().then((rows) => {
        setInProgress(rows.filter((r) => r.status === 'active' || r.status === 'paused'));
        setCompleted(rows.filter((r) => r.status === 'complete'));
      });
    }, [])
  );

  function openTrail(row: TrailSummaryRow) {
    if (row.status === 'complete') {
      router.push(`/trailhead/integration?sessionId=${row.id}&readOnly=1`);
    } else {
      router.push(`/trailhead/reentry?sessionId=${row.id}`);
    }
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#6B6860" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Trailhead</Text>
        <TouchableOpacity
          onPress={() => router.push('/trailhead/new')}
          hitSlop={12}
          style={s.addBtn}
        >
          <Ionicons name="add" size={26} color="#3B5BA5" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.sectionTitle}>In Progress</Text>
        {inProgress.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No active trails.</Text>
            <Text style={s.emptyHint}>Tap "+" to begin following an activation.</Text>
          </View>
        ) : (
          inProgress.map((row) => (
            <TrailCard key={row.id} row={row} onPress={() => openTrail(row)} />
          ))
        )}

        <Text style={[s.sectionTitle, { marginTop: 28 }]}>Completed</Text>
        {completed.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No completed trails yet.</Text>
          </View>
        ) : (
          completed.map((row) => (
            <TrailCard key={row.id} row={row} onPress={() => openTrail(row)} />
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#FAFAF8' },

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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1C1B19' },
  addBtn:      { padding: 4 },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 22 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1B19',
    lineHeight: 21,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText:    { fontSize: 11, fontWeight: '600' },
  cardDate:     { fontSize: 12, color: '#6B6860', marginBottom: 8 },
  cardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  entryPill:    { backgroundColor: '#EEF2FF', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  entryPillText:{ fontSize: 11, color: '#3B5BA5', fontWeight: '600' },
  cardMetaText: { fontSize: 12, color: '#6B6860' },
  exileDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3D9B' },
  cardSnippet:  { fontSize: 13, color: '#6B6860', fontStyle: 'italic' },

  emptyBox: {
    backgroundColor: '#F5F4F1',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyText: { fontSize: 14, color: '#6B6860', textAlign: 'center' },
  emptyHint: { fontSize: 12, color: '#9CA3AF', marginTop: 6, textAlign: 'center' },
});
