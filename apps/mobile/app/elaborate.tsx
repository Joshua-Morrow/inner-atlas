/**
 * Elaboration Entry
 * Route: /elaborate?partId=[id]  (partId is optional)
 *
 * Entry points:
 *   Part Profile → Elaborate button  (partId provided — skip selector)
 *   Dashboard card                   (no partId — user selects)
 *   Update log "Explore Further"     (partId provided)
 *
 * All named parts shown (Manager, Firefighter, Exile).
 */

import { useCallback, useState } from 'react';
import {
  Pressable,
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

const TYPE_LABEL: Record<PartType, string> = {
  manager:     'Manager',
  firefighter: 'Firefighter',
  exile:       'Exile',
  self:        'Self',
};

const TYPE_BG: Record<PartType, string> = {
  manager:     '#EEF2FF',
  firefighter: '#FFF7ED',
  exile:       '#F5F0FF',
  self:        '#FFFBEB',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ElaborateEntryScreen() {
  const { partId } = useLocalSearchParams<{ partId?: string }>();

  const [parts, setParts]               = useState<PartRow[]>([]);
  const [selectedId, setSelectedId]     = useState<string | null>(partId ?? null);
  const [selectedPart, setSelectedPart] = useState<PartRow | null>(null);
  const [loading, setLoading]           = useState(true);

  useFocusEffect(
    useCallback(() => {
      const db = getDatabase();

      if (partId) {
        db.getFirstAsync<PartRow>(
          `SELECT id, COALESCE(custom_name, name) AS display_name, type
           FROM parts WHERE id = ?`,
          [partId],
        ).then((row) => {
          if (row) setSelectedPart(row);
          setLoading(false);
        }).catch(() => setLoading(false));
      } else {
        db.getAllAsync<PartRow>(
          `SELECT id, COALESCE(custom_name, name) AS display_name, type
           FROM parts
           WHERE type IN ('manager', 'firefighter', 'exile')
           ORDER BY type, display_name`,
        ).then((rows) => {
          setParts(rows ?? []);
          setLoading(false);
        }).catch(() => setLoading(false));
      }
    }, [partId]),
  );

  const canBegin = partId ? !!selectedPart : selectedId !== null;

  function handleBegin() {
    const id = partId ?? selectedId;
    if (!id) return;
    router.push(`/elaboration-menu?partId=${id}` as any);
  }

  if (loading) return <View style={s.root} />;

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={18} color="#6B6860" />
        </Pressable>
        <Text style={s.title}>Elaboration</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <View style={s.explainCard}>
          <Text style={s.explainTitle}>Getting to know a part</Text>
          <Text style={s.explainBody}>
            Explore this part through guided questions and curated word lists.
            Go at your own pace — return and add more anytime.
          </Text>
        </View>

        {partId ? (
          /* Pre-selected part */
          selectedPart ? (
            <View style={s.selectedCard}>
              <View style={[s.selectedDot, { backgroundColor: TYPE_COLOR[selectedPart.type] }]} />
              <View style={s.selectedInfo}>
                <Text style={s.selectedName}>{selectedPart.display_name}</Text>
                <Text style={s.selectedType}>{TYPE_LABEL[selectedPart.type]}</Text>
              </View>
            </View>
          ) : null
        ) : (
          /* Part selector */
          <>
            <Text style={s.selectorLabel}>
              Which part would you like to explore more deeply?
            </Text>

            {parts.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>
                  No parts found yet. Complete the First Mapping assessment to
                  discover your parts.
                </Text>
              </View>
            ) : (
              <View style={s.chipGrid}>
                {parts.map((p) => {
                  const isSelected = selectedId === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      style={({ pressed }) => [
                        s.chip,
                        { borderColor: TYPE_COLOR[p.type] },
                        isSelected && { backgroundColor: TYPE_BG[p.type], borderWidth: 2 },
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => setSelectedId(p.id)}
                    >
                      <View style={[s.chipDot, { backgroundColor: TYPE_COLOR[p.type] }]} />
                      <View>
                        <Text style={[s.chipName, isSelected && { color: TYPE_COLOR[p.type] }]}>
                          {p.display_name}
                        </Text>
                        <Text style={s.chipType}>{TYPE_LABEL[p.type]}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Begin button — pinned outside ScrollView */}
      <View style={s.footer}>
        <TouchableOpacity
          onPress={handleBegin}
          disabled={!canBegin}
          style={[s.beginBtn, !canBegin && s.beginBtnDisabled]}
          activeOpacity={0.85}
        >
          <Text style={[s.beginBtnText, !canBegin && s.beginBtnTextDisabled]}>
            Begin Elaboration
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAF8' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  backBtn: { padding: 4 },
  title:   { fontSize: 18, fontWeight: '700', color: '#1C1B19' },

  scroll:        { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 120, gap: 20 },

  explainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    gap: 8,
  },
  explainTitle: { fontSize: 17, fontWeight: '700', color: '#1C1B19' },
  explainBody:  { fontSize: 15, color: '#6B6860', lineHeight: 23 },

  selectedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
  },
  selectedDot:  { width: 12, height: 12, borderRadius: 6 },
  selectedInfo: { gap: 2 },
  selectedName: { fontSize: 16, fontWeight: '600', color: '#1C1B19' },
  selectedType: { fontSize: 13, color: '#6B6860' },

  selectorLabel: { fontSize: 16, fontWeight: '600', color: '#1C1B19' },

  chipGrid: { gap: 10 },
  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chipDot:  { width: 10, height: 10, borderRadius: 5 },
  chipName: { fontSize: 15, fontWeight: '600', color: '#1C1B19' },
  chipType: { fontSize: 12, color: '#6B6860', marginTop: 2 },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E3DE',
  },
  emptyText: {
    fontSize: 15,
    color: '#6B6860',
    lineHeight: 23,
    textAlign: 'center',
  },

  footer: {
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
  beginBtn:             { backgroundColor: '#3B5BA5', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  beginBtnDisabled:     { backgroundColor: '#E5E3DE' },
  beginBtnText:         { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  beginBtnTextDisabled: { color: '#6B6860' },
});
