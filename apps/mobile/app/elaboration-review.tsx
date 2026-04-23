/**
 * Elaboration Review — read-only view of a completed or in-progress elaboration session.
 * Route: /elaboration-review?id=<uuid>
 *
 * Shows each step label + user's response (if any).
 * Continue Elaboration button if in_progress (pinned outside ScrollView).
 * Start New Elaboration button if completed.
 * Back button uses router.back() only.
 */

import { useCallback, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getDatabase } from '@/lib/database';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ElaborationRow {
  id: string;
  part_id: string | null;
  steps_json: string | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface StepsData {
  appearance:            string | null;
  body_location:         string | null;
  job:                   string | null;
  origin_story:          string | null;
  beliefs:               string | null;
  fears:                 string | null;
  relationship_to_self:  string | null;
  burdens:               string | null;
  gifts:                 string | null;
  feel_towards:          string | null;
}

// ─── Step display config ──────────────────────────────────────────────────────

const STEP_LABELS: { key: keyof StepsData; label: string }[] = [
  { key: 'appearance',           label: 'What you notice'           },
  { key: 'body_location',        label: 'Body location'             },
  { key: 'job',                  label: "What it's trying to do"    },
  { key: 'origin_story',         label: 'Origins'                   },
  { key: 'beliefs',              label: 'What it believes'          },
  { key: 'fears',                label: 'What it fears'             },
  { key: 'relationship_to_self', label: 'Relationship to you'       },
  { key: 'burdens',              label: 'What it carries'           },
  { key: 'gifts',                label: 'Natural gifts'             },
  { key: 'feel_towards',         label: 'How you feel toward it now'},
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ElaborationReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const isNavigating = useRef(false);

  const [elaboration, setElaboration] = useState<ElaborationRow | null>(null);
  const [steps, setSteps]             = useState<StepsData | null>(null);
  const [partName, setPartName]       = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const db = getDatabase();

      db.getFirstAsync<ElaborationRow>(
        `SELECT id, part_id, steps_json, status, started_at, completed_at
         FROM elaboration_sessions WHERE id = ?`,
        [id],
      ).then((row) => {
        if (!row) return;
        setElaboration(row);
        if (row.steps_json) {
          try { setSteps(JSON.parse(row.steps_json) as StepsData); } catch { /* noop */ }
        }
        if (row.part_id) {
          db.getFirstAsync<{ display_name: string }>(
            `SELECT COALESCE(custom_name, name) AS display_name FROM parts WHERE id = ?`,
            [row.part_id],
          ).then((p) => { if (p) setPartName(p.display_name); })
            .catch(() => undefined);
        }
      }).catch((e) => console.error('[ElaborationReview] load:', e));
    }, [id]),
  );

  const dateStr  = formatDate(elaboration?.completed_at ?? elaboration?.started_at ?? null);
  const isComplete = elaboration?.status === 'completed';
  const statusLabel = isComplete ? 'Completed' : 'In Progress';

  function handleContinue() {
    if (!elaboration?.id || !elaboration.part_id) return;
    if (isNavigating.current) return;
    isNavigating.current = true;
    router.push(`/elaboration-session?partId=${elaboration.part_id}&elaborationId=${elaboration.id}` as any);
    setTimeout(() => { isNavigating.current = false; }, 500);
  }

  function handleStartNew() {
    if (!elaboration?.part_id) return;
    if (isNavigating.current) return;
    isNavigating.current = true;
    router.push(`/elaborate?partId=${elaboration.part_id}` as any);
    setTimeout(() => { isNavigating.current = false; }, 500);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (isNavigating.current) return;
            isNavigating.current = true;
            router.back();
            setTimeout(() => { isNavigating.current = false; }, 500);
          }}
          hitSlop={12}
          activeOpacity={0.7}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color="#1C1B19" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {dateStr
            ? `Elaboration — ${dateStr}`
            : partName
            ? `Elaboration — ${partName}`
            : 'Elaboration'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={[styles.statusPill, isComplete ? styles.statusComplete : styles.statusInProgress]}>
            <Text style={styles.statusPillText}>{statusLabel}</Text>
          </View>
          {partName ? <Text style={styles.metaPartName}>{partName}</Text> : null}
          {dateStr ? <Text style={styles.metaDate}>{dateStr}</Text> : null}
        </View>

        {/* Step responses */}
        {STEP_LABELS.map(({ key, label }) => {
          const value = steps?.[key];
          if (!value) return null;
          return (
            <View key={key} style={styles.stepCard}>
              <Text style={styles.stepLabel}>{label}</Text>
              <Text style={styles.stepValue}>{value}</Text>
            </View>
          );
        })}

        {!elaboration && (
          <Text style={styles.empty}>Session not found.</Text>
        )}

        {elaboration && !steps && (
          <Text style={styles.empty}>No responses recorded yet.</Text>
        )}
      </ScrollView>

      {/* Action button — pinned below scroll */}
      {elaboration && !isComplete && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>Continue Elaboration</Text>
          </TouchableOpacity>
        </View>
      )}
      {elaboration && isComplete && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.startNewBtn}
            onPress={handleStartNew}
            activeOpacity={0.85}
          >
            <Text style={styles.startNewBtnText}>Start New Elaboration</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAF8' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FAFAF8',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1B19',
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1B19',
    textAlign: 'center',
  },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120, gap: 12 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  statusPill:        { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusComplete:    { backgroundColor: '#D1FAE5' },
  statusInProgress:  { backgroundColor: '#FEF9C3' },
  statusPillText:    { fontSize: 12, fontWeight: '600', color: '#1C1B19' },
  metaPartName:      { fontSize: 13, fontWeight: '600', color: '#1C1B19' },
  metaDate:          { fontSize: 13, color: '#6B6860' },

  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E3DE',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B6860',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  stepValue: {
    fontSize: 15,
    color: '#1C1B19',
    lineHeight: 22,
  },

  empty: {
    fontSize: 14,
    color: '#6B6860',
    textAlign: 'center',
    marginTop: 40,
    fontStyle: 'italic',
  },

  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E3DE',
    backgroundColor: '#FAFAF8',
    elevation: 8,
    zIndex: 999,
  },
  continueBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  continueBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  startNewBtn: {
    borderWidth: 1,
    borderColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  startNewBtnText: { fontSize: 15, fontWeight: '600', color: '#3B5BA5' },
});
