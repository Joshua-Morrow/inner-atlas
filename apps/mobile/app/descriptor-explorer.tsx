/**
 * Descriptor Explorer
 * Route: /descriptor-explorer?partId=[id]&sectionId=[id]
 *
 * Word chip selection UI for one descriptor section.
 * Auto-saves on every toggle. Custom text auto-saves on blur.
 */

import { useCallback, useMemo, useState } from 'react';
import {
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
import {
  ELABORATION_SECTIONS,
  type DescriptorSection,
} from '@/lib/elaboration-descriptors';

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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DescriptorExplorerScreen() {
  const { partId, sectionId } = useLocalSearchParams<{
    partId: string;
    sectionId: string;
  }>();

  const section: DescriptorSection | undefined = ELABORATION_SECTIONS.find(
    (s) => s.id === sectionId,
  );

  const [part, setPart]               = useState<PartRow | null>(null);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [customTags, setCustomTags]   = useState<string[]>([]);
  const [tagDraft, setTagDraft]       = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );

  useFocusEffect(
    useCallback(() => {
      if (!partId) return;
      const db = getDatabase();

      db.getFirstAsync<PartRow>(
        `SELECT id, COALESCE(custom_name, name) AS display_name, type
         FROM parts WHERE id = ?`,
        [partId],
      ).then((row) => { if (row) setPart(row); })
        .catch(() => undefined);

      db.getFirstAsync<{ elaboration_data_json: string | null }>(
        `SELECT elaboration_data_json FROM part_profiles WHERE part_id = ?`,
        [partId],
      ).then((row) => {
        if (!row?.elaboration_data_json) return;
        try {
          const parsed = JSON.parse(row.elaboration_data_json) as
            Record<string, { selected: string[]; custom?: string; custom_tags?: string[] }>;
          const sectionData = parsed[sectionId ?? ''];
          if (sectionData) {
            setSelected(new Set(sectionData.selected ?? []));
            // Migrate: if custom_tags present, use it; else convert legacy custom string
            if (sectionData.custom_tags) {
              setCustomTags(sectionData.custom_tags);
            } else if (sectionData.custom) {
              setCustomTags([sectionData.custom]);
            }
          }
        } catch { /* noop */ }
      }).catch(() => undefined);
    }, [partId, sectionId]),
  );

  const typeColor = part ? TYPE_COLOR[part.type] : '#3B5BA5';
  const isSearching = searchQuery.trim().length > 0;
  const query = searchQuery.trim().toLowerCase();

  // ── Persist elaboration data ──────────────────────────────────────────────

  async function persistData(
    nextSelected: Set<string>,
    nextCustomTags: string[],
  ) {
    if (!partId || !sectionId) return;
    const db  = getDatabase();
    const now = new Date().toISOString();

    // Read existing JSON, merge this section
    let existing: Record<string, { selected: string[]; custom?: string; custom_tags?: string[] }> = {};
    try {
      const row = await db.getFirstAsync<{ elaboration_data_json: string | null }>(
        `SELECT elaboration_data_json FROM part_profiles WHERE part_id = ?`,
        [partId],
      );
      if (row?.elaboration_data_json) {
        existing = JSON.parse(row.elaboration_data_json) as
          Record<string, { selected: string[]; custom?: string; custom_tags?: string[] }>;
      }
    } catch { /* noop */ }

    existing[sectionId] = {
      selected: Array.from(nextSelected),
      custom_tags: nextCustomTags,
    };

    const json = JSON.stringify(existing);

    try {
      await db.runAsync(
        `INSERT INTO part_profiles (part_id, elaboration_data_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(part_id) DO UPDATE SET
           elaboration_data_json = excluded.elaboration_data_json,
           updated_at = excluded.updated_at`,
        [partId, json, now],
      );
    } catch (e) {
      console.error('[DescriptorExplorer] persist:', e);
    }
  }

  function toggleWord(word: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      persistData(next, customTags).catch(() => undefined);
      return next;
    });
  }

  function addCustomTag() {
    const trimmed = tagDraft.trim();
    if (!trimmed || customTags.includes(trimmed)) {
      setTagDraft('');
      return;
    }
    const next = [...customTags, trimmed];
    setCustomTags(next);
    setTagDraft('');
    persistData(selected, next).catch(() => undefined);
  }

  function removeCustomTag(tag: string) {
    const next = customTags.filter((t) => t !== tag);
    setCustomTags(next);
    persistData(selected, next).catch(() => undefined);
  }

  function toggleCategory(name: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // ── Filtered categories for search ───────────────────────────────────────

  const filteredCategories = useMemo(() => {
    if (!section) return [];
    if (!isSearching) return section.categories;
    return section.categories
      .map((cat) => ({
        ...cat,
        words: cat.words.filter((w) =>
          w.toLowerCase().includes(query),
        ),
      }))
      .filter((cat) => cat.words.length > 0);
  }, [section, isSearching, query]);

  const selectedList = Array.from(selected);
  const visibleSelected = selectedList.slice(0, 5);
  const extraCount = selectedList.length - 5;

  // ── Save and navigate back ────────────────────────────────────────────────

  async function handleSave() {
    await persistData(selected, customTags).catch(() => undefined);
    router.back();
  }

  if (!section) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={{ padding: 20, color: '#6B6860' }}>Section not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={18} color="#6B6860" />
        </Pressable>
        <Text style={s.title}>{section.label}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Custom tag input */}
        <View style={s.customBlock}>
          <Text style={s.customLabel}>Your own words</Text>
          <View style={s.tagInputRow}>
            <TextInput
              style={s.tagInput}
              value={tagDraft}
              onChangeText={setTagDraft}
              placeholder="Type a word or phrase..."
              placeholderTextColor="#C5C3BE"
              returnKeyType="done"
              onSubmitEditing={addCustomTag}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[s.tagAddBtn, { backgroundColor: typeColor }]}
              onPress={addCustomTag}
              activeOpacity={0.8}
            >
              <Text style={s.tagAddBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {customTags.length > 0 && (
            <View style={s.tagChips}>
              {customTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    s.tagChip,
                    { backgroundColor: `${typeColor}26`, borderColor: typeColor },
                  ]}
                  onPress={() => removeCustomTag(tag)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.tagChipText, { color: typeColor }]}>{tag}</Text>
                  <Text style={[s.tagChipX, { color: typeColor }]}>×</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>or explore the list below</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Search bar */}
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={16} color="#A09D96" />
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={`Search all ${section.label.toLowerCase()} words…`}
            placeholderTextColor="#C5C3BE"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#A09D96" />
            </Pressable>
          )}
        </View>

        {/* Category sections */}
        {filteredCategories.map((cat) => {
          const isExpanded =
            isSearching || expandedCategories.has(cat.name);
          const selectedInCat = cat.words.filter((w) => selected.has(w)).length;

          return (
            <View key={cat.name} style={s.categoryBlock}>
              {/* Category header */}
              <Pressable
                style={s.categoryHeader}
                onPress={() => toggleCategory(cat.name)}
              >
                <Text style={s.categoryName}>{cat.name}</Text>
                <View style={s.categoryRight}>
                  {selectedInCat > 0 && (
                    <View
                      style={[
                        s.selectedBadge,
                        { backgroundColor: typeColor },
                      ]}
                    >
                      <Text style={s.selectedBadgeText}>
                        {selectedInCat}
                      </Text>
                    </View>
                  )}
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#A09D96"
                  />
                </View>
              </Pressable>

              {/* Collapsed selection summary */}
              {!isExpanded && selectedInCat > 0 && (
                <View style={s.collapsedSummary}>
                  <Text style={[s.collapsedSummaryText, { color: typeColor }]}>
                    {selectedInCat} selected
                  </Text>
                </View>
              )}

              {/* Word chips */}
              {isExpanded && (
                <View style={s.chipGrid}>
                  {cat.words.map((word) => {
                    const isSelected = selected.has(word);
                    const matchesSearch =
                      !isSearching ||
                      word.toLowerCase().includes(query);

                    return (
                      <TouchableOpacity
                        key={word}
                        style={[
                          s.chip,
                          isSelected && {
                            backgroundColor: typeColor,
                            borderColor: typeColor,
                          },
                          !matchesSearch && s.chipDimmed,
                        ]}
                        onPress={() => toggleWord(word)}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            s.chipText,
                            isSelected && s.chipTextSelected,
                            !matchesSearch && s.chipTextDimmed,
                          ]}
                        >
                          {word}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom bar — summary + Save */}
      <View style={s.bottomBar}>
        {selectedList.length > 0 && (
          <View style={s.summaryArea}>
            <Text style={s.summaryCount}>
              {selectedList.length} word{selectedList.length === 1 ? '' : 's'} selected
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.summaryScroll}
              contentContainerStyle={s.summaryChips}
            >
              {visibleSelected.map((w) => (
                <View
                  key={w}
                  style={[s.summaryChip, { backgroundColor: `${typeColor}20`, borderColor: typeColor }]}
                >
                  <Text style={[s.summaryChipText, { color: typeColor }]}>
                    {w}
                  </Text>
                </View>
              ))}
              {extraCount > 0 && (
                <View style={[s.summaryChip, { backgroundColor: '#F3F2EF', borderColor: '#E5E3DE' }]}>
                  <Text style={[s.summaryChipText, { color: '#6B6860' }]}>
                    +{extraCount} more
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
        <TouchableOpacity
          style={s.saveBtn}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={s.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#FAFAF8' },

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
  backBtn:     { padding: 4 },
  title:       { fontSize: 18, fontWeight: '700', color: '#1C1B19' },

  scroll:        { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 16, gap: 16 },

  customBlock: { gap: 8 },
  customLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tagInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  tagInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1C1B19',
  },
  tagAddBtn: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagAddBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  tagChips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagChipText: { fontSize: 14, fontWeight: '500' },
  tagChipX:    { fontSize: 16, fontWeight: '400', marginTop: -1 },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E3DE' },
  dividerText: { fontSize: 13, color: '#A09D96', flexShrink: 0 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1C1B19', padding: 0 },

  categoryBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  categoryName:  { fontSize: 15, fontWeight: '600', color: '#1C1B19', flex: 1 },
  categoryRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  collapsedSummary: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  collapsedSummaryText: {
    fontSize: 13,
    fontWeight: '500',
  },

  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    paddingTop: 4,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  chipDimmed:         { opacity: 0.3 },
  chipText:           { fontSize: 14, color: '#1C1B19' },
  chipTextSelected:   { color: '#FFFFFF', fontWeight: '600' },
  chipTextDimmed:     {},

  bottomBar: {
    backgroundColor: '#FAFAF8',
    borderTopWidth: 1,
    borderTopColor: '#E5E3DE',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 10,
    elevation: 8,
    zIndex: 999,
  },
  summaryArea:   { gap: 6 },
  summaryCount:  { fontSize: 13, fontWeight: '600', color: '#6B6860' },
  summaryScroll: { maxHeight: 36 },
  summaryChips:  { flexDirection: 'row', gap: 6, alignItems: 'center' },
  summaryChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  summaryChipText: { fontSize: 12, fontWeight: '500' },
  saveBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
