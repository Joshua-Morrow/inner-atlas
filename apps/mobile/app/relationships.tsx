/**
 * Relationships — Structures + Feelings tabbed screen
 * Route: /relationships
 */

import { useCallback, useMemo, useRef, useState } from 'react';
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

import { FeelingEdge, getAllFeelingEdges, getDatabase } from '@/lib/database';
import { NODE_COLORS } from '@/lib/map-nodes';

// ─── Types ────────────────────────────────────────────────────────────────────

type RelTab = 'structures' | 'feelings';

interface RelationshipRow {
  id: string;
  name: string;
  type: 'polarization' | 'alliance';
  created_at: string | null;
  updated_at: string | null;
  side_a_label: string | null;
  side_b_label: string | null;
}

interface MemberChip {
  part_id: string | null;
  display_name: string | null;
  side: string | null;
}

interface RelationshipItem {
  id: string;
  name: string;
  type: 'polarization' | 'alliance';
  created_at: string | null;
  sideALabel: string;
  sideBLabel: string;
  members: MemberChip[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function nowIso(): string {
  return new Date().toISOString();
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function getPartColor(type: string | null): string {
  if (!type) return '#6B6860';
  return NODE_COLORS[type as keyof typeof NODE_COLORS] ?? '#6B6860';
}

// ─── Auto-create from part_relationships ──────────────────────────────────────

type OrphanRow = {
  id: string;
  part_a_id: string | null;
  part_b_id: string | null;
  relationship_type: string | null;
  part_a_name: string | null;
  part_b_name: string | null;
};

async function autoCreateFromPartRelationships(): Promise<void> {
  const db = getDatabase();
  const orphans = await db.getAllAsync<OrphanRow>(
    `SELECT pr.id, pr.part_a_id, pr.part_b_id, pr.relationship_type,
            COALESCE(pa.custom_name, pa.name) AS part_a_name,
            COALESCE(pb.custom_name, pb.name) AS part_b_name
     FROM part_relationships pr
     LEFT JOIN parts pa ON pa.id = pr.part_a_id
     LEFT JOIN parts pb ON pb.id = pr.part_b_id
     WHERE pr.relationship_id IS NULL`,
    [],
  ).catch(() => [] as OrphanRow[]);

  for (const row of orphans) {
    const relType: 'polarization' | 'alliance' =
      row.relationship_type === 'polarized' || row.relationship_type === 'conflicting'
        ? 'polarization'
        : 'alliance';
    const nameA = row.part_a_name ?? 'Part A';
    const nameB = row.part_b_name ?? 'Part B';
    const relName = `${nameA} — ${nameB}`;
    const relId = generateId();
    const now = nowIso();
    try {
      await db.runAsync(
        `INSERT INTO relationships (id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        [relId, relName, relType, now, now],
      );
      if (row.part_a_id) {
        await db.runAsync(
          `INSERT INTO relationship_members (id, relationship_id, member_type, part_id, side, created_at)
           VALUES (?, ?, 'part', ?, ?, ?)`,
          [generateId(), relId, row.part_a_id, relType === 'polarization' ? 'a' : null, now],
        );
      }
      if (row.part_b_id) {
        await db.runAsync(
          `INSERT INTO relationship_members (id, relationship_id, member_type, part_id, side, created_at)
           VALUES (?, ?, 'part', ?, ?, ?)`,
          [generateId(), relId, row.part_b_id, relType === 'polarization' ? 'b' : null, now],
        );
      }
      if (relType === 'polarization') {
        await db.runAsync(
          `INSERT INTO polarization_details (id, relationship_id, created_at, updated_at) VALUES (?, ?, ?, ?)`,
          [generateId(), relId, now, now],
        );
      }
      await db.runAsync(`UPDATE part_relationships SET relationship_id = ? WHERE id = ?`, [relId, row.id]);
    } catch { /* skip if this row fails */ }
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RelationshipsScreen() {
  const [activeTab, setActiveTab]         = useState<RelTab>('structures');
  const [polarizations, setPolarizations] = useState<RelationshipItem[]>([]);
  const [alliances, setAlliances]         = useState<RelationshipItem[]>([]);
  const [feelingEdges, setFeelingEdges]   = useState<FeelingEdge[]>([]);

  const navigatingRef = useRef(false);
  const safeNavigate = useCallback((href: string) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    router.push(href as any);
    setTimeout(() => { navigatingRef.current = false; }, 1000);
  }, []);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        await autoCreateFromPartRelationships();
        const db = getDatabase();

        const rows = await db.getAllAsync<RelationshipRow>(
          `SELECT r.id, r.name, r.type, r.created_at, r.updated_at,
                  pd.side_a_label, pd.side_b_label
           FROM relationships r
           LEFT JOIN polarization_details pd ON pd.relationship_id = r.id
           ORDER BY COALESCE(r.updated_at, r.created_at) DESC`,
          [],
        ).catch(() => [] as RelationshipRow[]);

        const allMembers = await db.getAllAsync<{
          relationship_id: string;
          part_id: string | null;
          display_name: string | null;
          side: string | null;
        }>(
          `SELECT rm.relationship_id, rm.part_id, rm.side,
                  COALESCE(p.custom_name, p.name) AS display_name
           FROM relationship_members rm
           LEFT JOIN parts p ON p.id = rm.part_id
           ORDER BY rm.created_at ASC`,
          [],
        ).catch(() => [] as { relationship_id: string; part_id: string | null; display_name: string | null; side: string | null }[]);

        const memberMap = new Map<string, MemberChip[]>();
        for (const m of allMembers) {
          const existing = memberMap.get(m.relationship_id) ?? [];
          existing.push({ part_id: m.part_id, display_name: m.display_name, side: m.side });
          memberMap.set(m.relationship_id, existing);
        }

        const items: RelationshipItem[] = rows.map((r) => {
          const members = memberMap.get(r.id) ?? [];
          const sideAMembers = members.filter((m) => m.side === 'a');
          const sideBMembers = members.filter((m) => m.side === 'b');
          const sideALabel = r.side_a_label ?? (sideAMembers[0]?.display_name ?? 'Side A');
          const sideBLabel = r.side_b_label ?? (sideBMembers[0]?.display_name ?? 'Side B');
          return { id: r.id, name: r.name, type: r.type, created_at: r.created_at, sideALabel, sideBLabel, members };
        });

        setPolarizations(items.filter((i) => i.type === 'polarization'));
        setAlliances(items.filter((i) => i.type === 'alliance'));

        const fe = await getAllFeelingEdges();
        setFeelingEdges(fe);
      }
      load().catch(() => undefined);
    }, []),
  );

  // ── Feelings tab: group edges by from-part ────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, {
      partId: string;
      partName: string;
      partType: string | null;
      edges: FeelingEdge[];
    }>();
    for (const edge of feelingEdges) {
      const key = edge.from_part_id;
      if (!map.has(key)) {
        map.set(key, {
          partId: key,
          partName: edge.from_part_name ?? 'Unknown',
          partType: edge.from_part_type,
          edges: [],
        });
      }
      map.get(key)!.edges.push(edge);
    }
    return Array.from(map.values());
  }, [feelingEdges]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#1C1B19" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Relationships</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'structures' && styles.tabActive]}
          onPress={() => setActiveTab('structures')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabLabel, activeTab === 'structures' && styles.tabLabelActive]}>
            Structures
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feelings' && styles.tabActive]}
          onPress={() => setActiveTab('feelings')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabLabel, activeTab === 'feelings' && styles.tabLabelActive]}>
            Feelings
          </Text>
          {feelingEdges.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{feelingEdges.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Structures tab ─────────────────────────────────────────────────── */}
      {activeTab === 'structures' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionHeader}>Polarizations</Text>
          {polarizations.length === 0 ? (
            <Text style={styles.emptyText}>No polarizations logged yet</Text>
          ) : (
            polarizations.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => safeNavigate(`/relationship-profile?id=${item.id}`)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardIconWrap}>
                    <Ionicons name="git-compare-outline" size={18} color="#C2600A" />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={styles.cardSides} numberOfLines={1}>
                      {item.sideALabel}
                      <Text style={styles.cardVs}> vs </Text>
                      {item.sideBLabel}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#C5C3BE" />
                </View>
                {item.created_at ? (
                  <Text style={styles.cardDate}>{fmtDate(item.created_at)}</Text>
                ) : null}
              </TouchableOpacity>
            ))
          )}

          <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>Alliances</Text>
          {alliances.length === 0 ? (
            <Text style={styles.emptyText}>No alliances logged yet</Text>
          ) : (
            alliances.map((item) => {
              const displayMembers = item.members.slice(0, 3);
              const extraCount = item.members.length - displayMembers.length;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.card}
                  activeOpacity={0.7}
                  onPress={() => safeNavigate(`/relationship-profile?id=${item.id}`)}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.cardIconWrap}>
                      <Ionicons name="link-outline" size={18} color="#3B5BA5" />
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardName}>{item.name}</Text>
                      <View style={styles.memberChips}>
                        {displayMembers.map((m, i) => (
                          <View key={i} style={styles.memberChip}>
                            <Text style={styles.memberChipText} numberOfLines={1}>
                              {m.display_name ?? '?'}
                            </Text>
                          </View>
                        ))}
                        {extraCount > 0 && (
                          <View style={styles.memberChip}>
                            <Text style={styles.memberChipText}>+{extraCount} more</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#C5C3BE" />
                  </View>
                  {item.created_at ? (
                    <Text style={styles.cardDate}>{fmtDate(item.created_at)}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ── Feelings tab ───────────────────────────────────────────────────── */}
      {activeTab === 'feelings' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* View on Map */}
          <TouchableOpacity
            style={styles.viewMapBtn}
            onPress={() => router.push('/(tabs)/explore?mode=feelings' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={16} color="#3B5BA5" />
            <Text style={styles.viewMapBtnText}>View on Map</Text>
          </TouchableOpacity>

          {grouped.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No feeling connections yet</Text>
              <Text style={styles.emptyBody}>
                Feeling connections are established during Meeting Space sessions, or you can add them manually.
              </Text>
            </View>
          ) : (
            grouped.map((group) => (
              <View key={group.partId} style={styles.group}>
                {/* Group header */}
                <View style={styles.groupHeader}>
                  <View style={[styles.groupDot, { backgroundColor: getPartColor(group.partType) }]} />
                  <Text style={styles.groupTitle}>{group.partName}</Text>
                  <Text style={styles.groupSubtitle}>feels towards:</Text>
                </View>

                {/* Edges in group */}
                {group.edges.map((edge) => {
                  const feelings = (() => {
                    try { return JSON.parse(edge.feelings_json) as string[]; }
                    catch { return [] as string[]; }
                  })();
                  return (
                    <TouchableOpacity
                      key={edge.id}
                      style={styles.edgeCard}
                      onPress={() => safeNavigate(`/feeling-edge-detail?edgeId=${edge.id}`)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.edgeCardLeft}>
                        <Text style={styles.edgeTargetName}>{edge.to_part_name ?? 'Unknown'}</Text>
                        <View style={styles.feelingChips}>
                          {feelings.map((f) => (
                            <View key={f} style={styles.feelingChip}>
                              <Text style={styles.feelingChipText}>{f}</Text>
                            </View>
                          ))}
                        </View>
                        <Text style={styles.edgeMeta}>
                          {edge.source === 'meeting_space' ? 'From Meeting Space' : 'Manual entry'}
                          {' · '}
                          {fmtDate(edge.updated_at)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#9B9A94" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Footer — switches by tab */}
      <View style={styles.footer}>
        {activeTab === 'structures' ? (
          <TouchableOpacity
            style={styles.newBtn}
            activeOpacity={0.85}
            onPress={() => safeNavigate('/new-relationship')}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.newBtnText}>New Relationship</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.newBtn, { backgroundColor: '#B88A00' }]}
            activeOpacity={0.85}
            onPress={() => safeNavigate('/add-feeling-connection')}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.newBtnText}>Add Feeling Connection</Text>
          </TouchableOpacity>
        )}
      </View>
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
  headerRight: { width: 32 },

  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#1C1B19',
  },
  tabLabel: { fontSize: 14, fontWeight: '500', color: '#6B6860' },
  tabLabelActive: { color: '#1C1B19', fontWeight: '600' },
  tabBadge: {
    backgroundColor: '#B88A00',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#FAFAF8' },

  // ── Scroll ──
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },

  // ── Structures: section headers ──
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6860',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionHeaderSpaced: { marginTop: 28 },
  emptyText: { fontSize: 14, color: '#A09D96', fontStyle: 'italic', marginBottom: 8 },

  // ── Structures: cards ──
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F2EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 3 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#1C1B19' },
  cardSides: { fontSize: 13, color: '#6B6860' },
  cardVs: { color: '#C2600A', fontWeight: '600' },
  cardDate: { fontSize: 12, color: '#A09D96', marginTop: 8 },
  memberChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  memberChip: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  memberChipText: { fontSize: 12, color: '#3B5BA5', fontWeight: '500' },

  // ── Feelings tab: view map button ──
  viewMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#3B5BA5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  viewMapBtnText: { fontSize: 14, color: '#3B5BA5', fontWeight: '500' },

  // ── Feelings tab: grouped sections ──
  group: { marginBottom: 20 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  groupDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  groupTitle: { fontSize: 16, fontWeight: '700', color: '#1C1B19' },
  groupSubtitle: { fontSize: 13, color: '#9B9A94', marginLeft: 2 },

  // ── Feelings tab: edge cards ──
  edgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  edgeCardLeft: { flex: 1, gap: 6 },
  edgeTargetName: { fontSize: 15, fontWeight: '600', color: '#1C1B19' },
  feelingChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  feelingChip: {
    backgroundColor: '#F3F2EF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  feelingChipText: { fontSize: 12, color: '#6B6860', fontWeight: '500' },
  edgeMeta: { fontSize: 12, color: '#A09D96' },

  // ── Feelings tab: empty state ──
  emptyState: { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#6B6860', textAlign: 'center' },
  emptyBody: {
    fontSize: 14,
    color: '#A09D96',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B5BA5',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  newBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
