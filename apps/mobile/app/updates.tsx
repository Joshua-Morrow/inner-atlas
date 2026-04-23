/**
 * Updates List
 * Route: /updates?partId=<uuid>  (optional)
 *
 * Global mode (no partId): all updates across all parts, sorted by created_at DESC
 * Part mode (with partId): updates for that specific part only
 */

import { useCallback, useRef, useState } from 'react';
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

interface UpdateRow {
  id: string;
  update_type: string;
  part_id: string | null;
  intensity: number | null;
  content_json: string | null;
  created_at: string;
  part_name: string | null;
  part_type: PartType | null;
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

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const ACTIVATION_ICON: Record<string, IoniconName> = {
  'Activated':    'flash-outline',
  'Noticed':      'eye-outline',
  'Reflected on': 'book-outline',
  'Worked with':  'hand-left-outline',
  'Milestone':    'ribbon-outline',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${date} · ${time}`;
}

function getSnippet(contentJson: string | null): string | null {
  if (!contentJson) return null;
  try {
    const c = JSON.parse(contentJson) as {
      trigger?: string;
      noticed?: string;
      response?: string;
    };
    const text = c.trigger ?? c.noticed ?? c.response ?? '';
    if (!text) return null;
    return text.length > 80 ? text.slice(0, 80) + '…' : text;
  } catch {
    return null;
  }
}

// ─── Update Card ──────────────────────────────────────────────────────────────

function UpdateCard({ item }: { item: UpdateRow }) {
  const color      = item.part_type ? (TYPE_COLOR[item.part_type] ?? '#6B6860') : '#6B6860';
  const typeLabel  = item.part_type ? (TYPE_LABEL[item.part_type] ?? '') : '';
  const icon: IoniconName = ACTIVATION_ICON[item.update_type] ?? 'time-outline';
  const snippet    = getSnippet(item.content_json);
  const navigatingRef = useRef(false);

  return (
    <TouchableOpacity
      style={cardStyles.card}
      activeOpacity={0.7}
      onPress={() => {
        if (navigatingRef.current) return;
        navigatingRef.current = true;
        router.push(`/update-detail?id=${item.id}`);
        setTimeout(() => { navigatingRef.current = false; }, 1000);
      }}
    >
      <View style={cardStyles.top}>
        {/* Part name + type pill */}
        <View style={cardStyles.partRow}>
          <Text style={[cardStyles.partName, { color }]} numberOfLines={1}>
            {item.part_name ?? 'Unknown Part'}
          </Text>
          {typeLabel ? (
            <View style={[cardStyles.pill, { backgroundColor: color + '20', borderColor: color }]}>
              <Text style={[cardStyles.pillText, { color }]}>{typeLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* Activation type icon + date */}
        <View style={cardStyles.metaRow}>
          <Ionicons name={icon} size={14} color="#6B6860" />
          <Text style={cardStyles.updateType}>{item.update_type}</Text>
          <Text style={cardStyles.dot}>·</Text>
          <Text style={cardStyles.dateTime}>{formatDateTime(item.created_at)}</Text>
        </View>
      </View>

      {snippet ? (
        <Text style={cardStyles.snippet} numberOfLines={2}>{snippet}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    gap: 8,
  },
  pressed:    { opacity: 0.75 },
  top:        { gap: 6 },
  partRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  partName:   { fontSize: 15, fontWeight: '600', flex: 1 },
  pill: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText:   { fontSize: 11, fontWeight: '600' },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  updateType: { fontSize: 13, color: '#6B6860', fontWeight: '500' },
  dot:        { fontSize: 13, color: '#A09D96' },
  dateTime:   { fontSize: 12, color: '#A09D96' },
  snippet:    { fontSize: 13, color: '#6B6860', lineHeight: 19 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UpdatesScreen() {
  const { partId } = useLocalSearchParams<{ partId?: string }>();
  const isPartMode  = !!partId;

  const [updates,  setUpdates]  = useState<UpdateRow[]>([]);
  const [partName, setPartName] = useState('');

  useFocusEffect(
    useCallback(() => {
      const db = getDatabase();

      const query = isPartMode
        ? `SELECT u.id, u.update_type, u.part_id, u.intensity, u.content_json, u.created_at,
                  COALESCE(p.custom_name, p.name) AS part_name, p.type AS part_type
           FROM updates u
           LEFT JOIN parts p ON u.part_id = p.id
           WHERE u.part_id = ?
           ORDER BY u.created_at DESC`
        : `SELECT u.id, u.update_type, u.part_id, u.intensity, u.content_json, u.created_at,
                  COALESCE(p.custom_name, p.name) AS part_name, p.type AS part_type
           FROM updates u
           LEFT JOIN parts p ON u.part_id = p.id
           ORDER BY u.created_at DESC`;

      db.getAllAsync<UpdateRow>(query, isPartMode ? [partId] : [])
        .then((rows) => setUpdates(rows ?? []))
        .catch((e) => console.error('[Updates] load:', e));

      if (isPartMode && partId) {
        db.getFirstAsync<{ display_name: string }>(
          `SELECT COALESCE(custom_name, name) AS display_name FROM parts WHERE id = ?`,
          [partId],
        )
          .then((row) => { if (row) setPartName(row.display_name); })
          .catch(() => undefined);
      }
    }, [isPartMode, partId]),
  );

  const headerTitle = isPartMode && partName
    ? `Updates — ${partName}`
    : 'Update Log';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.listContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#1C1B19" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Empty state or list */}
        {updates.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={48} color="#A09D96" />
            <Text style={styles.emptyTitle}>No updates logged yet</Text>
            <Text style={styles.emptySub}>
              Log an update when you notice a part becoming active
            </Text>
          </View>
        ) : (
          updates.map((item) => <UpdateCard key={item.id} item={item} />)
        )}
      </ScrollView>

      {/* Pinned footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.logBtn}
          activeOpacity={0.85}
          onPress={() =>
            isPartMode
              ? router.push(`/log-update?partId=${partId}`)
              : router.push('/log-update')
          }
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.logBtnText}>Log Update</Text>
        </TouchableOpacity>
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
    paddingVertical: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  backBtn:     { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: '#1C1B19' },
  headerRight: { width: 32 },

  listContent: { paddingBottom: 120 },

  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1B19',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: '#6B6860',
    textAlign: 'center',
    lineHeight: 22,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 16,
    backgroundColor: '#FAFAF8',
    borderTopWidth: 1,
    borderTopColor: '#E5E3DE',
    elevation: 8,
    zIndex: 999,
  },
  logBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
