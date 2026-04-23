/**
 * Feeling Edge Detail
 * Route: /feeling-edge-detail?edgeId=[id]
 *
 * Shows current feelings for a part-pair, history timeline, and edit/delete actions.
 */

import { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  FeelingEdge,
  FeelingEdgeHistory,
  deleteFeelingEdge,
  getAllFeelingEdges,
  getFeelingEdgeHistory,
  upsertFeelingEdge,
} from '@/lib/database';
import { NODE_COLORS } from '@/lib/map-nodes';
import {
  FEEL_TOWARDS_REACTIVE,
  FEEL_TOWARDS_SELF_LIKE,
  FEEL_TOWARDS_SELF_QUALITIES,
} from '@/lib/techniques-data';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPartColor(type: string | null): string {
  if (!type) return '#6B6860';
  return NODE_COLORS[type as keyof typeof NODE_COLORS] ?? '#6B6860';
}

function safeParseJson(json: string): string[] {
  try { return JSON.parse(json) as string[]; }
  catch { return []; }
}

function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FeelingEdgeDetailScreen() {
  const { edgeId } = useLocalSearchParams<{ edgeId: string }>();
  const [edge, setEdge]       = useState<FeelingEdge | null>(null);
  const [history, setHistory] = useState<FeelingEdgeHistory[]>([]);
  const [editing, setEditing] = useState(false);
  const [editFeelings, setEditFeelings] = useState<string[]>([]);
  const [saving, setSaving]   = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const edges = await getAllFeelingEdges();
        const found = edges.find((e) => e.id === edgeId) ?? null;
        setEdge(found);
        if (found) setEditFeelings(safeParseJson(found.feelings_json));
        const hist = await getFeelingEdgeHistory(edgeId ?? '');
        setHistory(hist);
      }
      load().catch(() => undefined);
    }, [edgeId]),
  );

  function toggleFeeling(f: string) {
    setEditFeelings((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  }

  async function handleSave() {
    if (!edge || saving) return;
    setSaving(true);
    try {
      await upsertFeelingEdge({
        fromPartId: edge.from_part_id,
        toPartId: edge.to_part_id,
        feelings: editFeelings,
        source: 'manual',
        sessionId: null,
      });
      const edges = await getAllFeelingEdges();
      const found = edges.find((e) => e.id === edgeId) ?? null;
      setEdge(found);
      if (found) setEditFeelings(safeParseJson(found.feelings_json));
      const hist = await getFeelingEdgeHistory(edgeId ?? '');
      setHistory(hist);
      setEditing(false);
    } catch (e) {
      console.error('[FeelingEdgeDetail] save:', e);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!edge) return;
    Alert.alert(
      'Remove connection',
      `Remove the feeling record between ${edge.from_part_name ?? 'this part'} and ${edge.to_part_name ?? 'this part'}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteFeelingEdge(edge.id);
            router.back();
          },
        },
      ],
    );
  }

  // ── Empty / loading state ──────────────────────────────────────────────────

  if (!edge) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#1C1B19" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Feeling Connection</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentFeelings = safeParseJson(edge.feelings_json);
  const fromColor = getPartColor(edge.from_part_type);
  const toColor   = getPartColor(edge.to_part_type);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#1C1B19" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feeling Connection</Text>
        <TouchableOpacity onPress={handleDelete} hitSlop={12} style={styles.deleteBtn} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={18} color="#991B1B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Part pair header */}
        <View style={styles.relCard}>
          <Text style={[styles.partLabel, { color: fromColor }]}>
            {edge.from_part_name ?? 'Unknown'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#9B9A94" />
          <Text style={[styles.partLabel, { color: toColor }]}>
            {edge.to_part_name ?? 'Unknown'}
          </Text>
        </View>

        {/* Current feelings (view mode) */}
        {!editing && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Current feelings</Text>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setEditing(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.chipsWrap}>
              {currentFeelings.length === 0 ? (
                <Text style={styles.emptyNote}>No feelings recorded</Text>
              ) : (
                currentFeelings.map((f) => (
                  <View key={f} style={styles.chip}>
                    <Text style={styles.chipText}>{f}</Text>
                  </View>
                ))
              )}
            </View>
            <Text style={styles.metaNote}>
              {edge.source === 'meeting_space' ? 'From Meeting Space' : 'Manual entry'}
              {' · Updated '}
              {fmtDateLong(edge.updated_at)}
            </Text>
          </View>
        )}

        {/* Edit mode */}
        {editing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Edit feelings</Text>
            <Text style={styles.editHint}>Select all that apply</Text>

            <Text style={styles.groupLabel}>Parts present (reactive)</Text>
            <View style={styles.chipsWrap}>
              {FEEL_TOWARDS_REACTIVE.map((f) => {
                const sel = editFeelings.includes(f);
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, sel && styles.chipSelected]}
                    onPress={() => toggleFeeling(f)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextSel]}>{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.groupLabel, { marginTop: 14 }]}>Self-like part present</Text>
            <View style={styles.chipsWrap}>
              {FEEL_TOWARDS_SELF_LIKE.map((f) => {
                const sel = editFeelings.includes(f);
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, sel && styles.chipSelfLikeSel]}
                    onPress={() => toggleFeeling(f)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextSel]}>{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.groupLabel, { marginTop: 14 }]}>Self energy present</Text>
            <View style={styles.chipsWrap}>
              {FEEL_TOWARDS_SELF_QUALITIES.map((f) => {
                const sel = editFeelings.includes(f);
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, sel && styles.chipSelfSel]}
                    onPress={() => toggleFeeling(f)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextSel]}>{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setEditing(false);
                  setEditFeelings(safeParseJson(edge.feelings_json));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (editFeelings.length === 0 || saving) && { opacity: 0.4 }]}
                onPress={handleSave}
                disabled={editFeelings.length === 0 || saving}
                activeOpacity={0.85}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* History timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History</Text>
          {history.length === 0 ? (
            <Text style={styles.emptyNote}>No previous records — this is the first entry.</Text>
          ) : (
            history.map((h) => {
              const hFeelings = safeParseJson(h.feelings_json);
              return (
                <View key={h.id} style={styles.historyRow}>
                  <View style={styles.historyLine} />
                  <View style={styles.historyContent}>
                    <Text style={styles.historyDate}>{fmtDateLong(h.recorded_at)}</Text>
                    <View style={[styles.chipsWrap, { marginBottom: 4 }]}>
                      {hFeelings.map((f) => (
                        <View key={f} style={[styles.chip, styles.historyChip]}>
                          <Text style={styles.chipText}>{f}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.historySource}>
                      {h.source === 'meeting_space' ? 'Meeting Space' : 'Manual entry'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: '#1C1B19' },
  deleteBtn: { padding: 4 },
  headerRight: { width: 32 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, color: '#A09D96' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  relCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
  },
  partLabel: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },

  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EEE9',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  editBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#3B5BA5',
  },
  editBtnText: { fontSize: 13, color: '#3B5BA5', fontWeight: '500' },
  editHint: { fontSize: 13, color: '#9B9A94', marginBottom: 14 },
  groupLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9B9A94',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  chipSelected: { backgroundColor: '#EEF2FF', borderColor: '#3B5BA5' },
  chipSelfLikeSel: { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: '#22C55E' },
  chipSelfSel: { backgroundColor: 'rgba(184,138,0,0.1)', borderColor: '#B88A00' },
  historyChip: { backgroundColor: '#F9F8F5' },
  chipText: { fontSize: 13, color: '#6B6860', fontWeight: '500' },
  chipTextSel: { color: '#1C1B19', fontWeight: '600' },

  metaNote: { fontSize: 12, color: '#A09D96', marginTop: 4 },
  emptyNote: { fontSize: 14, color: '#A09D96', fontStyle: 'italic' },

  editActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: { fontSize: 15, color: '#6B6860', fontWeight: '500' },
  saveBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#3B5BA5',
  },
  saveBtnText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },

  historyRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  historyLine: {
    width: 2,
    backgroundColor: '#E5E3DE',
    marginTop: 4,
    borderRadius: 1,
    flexShrink: 0,
  },
  historyContent: { flex: 1 },
  historyDate: { fontSize: 12, fontWeight: '600', color: '#6B6860', marginBottom: 6 },
  historySource: { fontSize: 12, color: '#A09D96' },
});
