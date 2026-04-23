/**
 * My Parts — 2-column image card grid of all named parts
 * Route: /my-parts
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getDatabase } from '@/lib/database';
import PartCard from '@/components/ui/PartCard';

// ─── Types ────────────────────────────────────────────────────────────────────

type PartType = 'manager' | 'firefighter' | 'exile' | 'self';

interface PartListRow {
  id: string;
  display_name: string;
  type: PartType;
  current_image_id: string | null;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyPartsScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isDialogueMode = mode === 'dialogue';

  const navigatingRef = useRef(false);

  const safeNavigate = useCallback((href: string) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    router.push(href as any);
    setTimeout(() => { navigatingRef.current = false; }, 1000);
  }, []);

  const [parts, setParts] = useState<PartListRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      const db = getDatabase();
      db.getAllAsync<PartListRow>(
        `SELECT p.id, COALESCE(p.custom_name, p.name) AS display_name,
                p.type, p.current_image_id
         FROM parts p
         ORDER BY p.created_at DESC`,
      ).then(setParts)
        .catch((e) => console.error('[MyParts] load:', e));
    }, []),
  );

  const count = parts.length;

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>
            {isDialogueMode ? 'Choose a Part' : 'My Parts'}
          </Text>
          {count > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {count} {count === 1 ? 'part' : 'parts'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {isDialogueMode && (
        <View style={styles.dialogueBanner}>
          <Ionicons name="chatbubbles-outline" size={16} color="#3B5BA5" />
          <Text style={styles.dialogueBannerText}>Select a part to begin a dialogue</Text>
        </View>
      )}

      {count === 0 ? (
        /* Empty state */
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={48} color="#A09D96" />
          <Text style={styles.emptyTitle}>No parts added yet</Text>
          <Text style={styles.emptySub}>
            Start with the guided assessment or add a part you already know.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.emptyBtn, pressed && styles.pressed]}
            onPress={() => router.push('/add-part')}
          >
            <Text style={styles.emptyBtnText}>Add a Part</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={parts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <PartCard
              part={item}
              onPress={() =>
                isDialogueMode
                  ? safeNavigate(`/dialogue-start?partId=${item.id}`)
                  : safeNavigate(`/part-profile?id=${item.id}`)
              }
            />
          )}
        />
      )}

      {/* Add Part button — pinned to bottom */}
      {!isDialogueMode && (
        <TouchableOpacity
          style={styles.addPartBtn}
          activeOpacity={0.85}
          onPress={() => router.push('/add-part')}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.addPartBtnText}>Add Part</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B5BA5',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1B19',
  },
  countBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B5BA5',
  },

  // Dialogue mode banner
  dialogueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
  },
  dialogueBannerText: {
    fontSize: 14,
    color: '#3B5BA5',
    fontWeight: '500',
  },

  // Grid
  columnWrapper: {
    gap: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 12,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1B19',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 15,
    color: '#6B6860',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: '#3B5BA5',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  pressed: {
    opacity: 0.72,
  },

  // Add Part button
  addPartBtn: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B5BA5',
    paddingVertical: 16,
    paddingBottom: 20,
    elevation: 8,
    zIndex: 999,
  },
  addPartBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
