/**
 * Dialogue List — all past dialogues for a part
 * Route: /dialogue?id=<part_id>
 *
 * Back → part profile
 * Tap card → /dialogue-session?dialogueId=<id>  (read-only if complete)
 * "Start Dialogue" → /dialogue-start?partId=<id>
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

interface PartRow {
  id: string;
  display_name: string;
  type: PartType;
}

interface DialogueRow {
  id: string;
  title: string | null;
  created_at: string;
  messages_json: string | null;
  participants_json: string | null;
}

interface DialogueListItem {
  id: string;
  date: string;
  title: string;
  preview: string;
  participantIds: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<PartType, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function getPreview(messagesJson: string | null): string {
  if (!messagesJson) return '';
  try {
    const msgs = JSON.parse(messagesJson) as Array<{ content?: string; text?: string }>;
    if (msgs.length === 0) return '';
    const text = msgs[0].content ?? msgs[0].text ?? '';
    return text.length > 60 ? text.slice(0, 60) + '…' : text;
  } catch {
    return '';
  }
}

// Handles both new format (string[]) and old format ({part_id, is_self}[])
function parseParticipantIds(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    if (parsed.length > 0 && typeof parsed[0] === 'string') return parsed as string[];
    return (parsed as { part_id: string; is_self?: number }[])
      .filter((p) => !p.is_self)
      .map((p) => p.part_id);
  } catch {
    return [];
  }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function PartAvatar({ part }: { part: PartRow | undefined }) {
  const color  = part ? (TYPE_COLOR[part.type] ?? '#6B6860') : '#6B6860';
  const initials = part
    ? part.display_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  return (
    <View style={[avatarStyles.circle, { backgroundColor: color }]}>
      <Text style={avatarStyles.initials}>{initials}</Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DialogueListScreen() {
  const { id: partId, relationshipId } = useLocalSearchParams<{ id?: string; relationshipId?: string }>();

  const navigatingRef = useRef(false);

  const safeNavigate = useCallback((href: string) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    router.push(href as any);
    setTimeout(() => { navigatingRef.current = false; }, 1000);
  }, []);

  const [contextName, setContextName] = useState('…');
  const [dialogues, setDialogues]     = useState<DialogueListItem[]>([]);
  const [partsMap, setPartsMap]       = useState<Map<string, PartRow>>(new Map());

  useFocusEffect(
    useCallback(() => {
      if (!partId && !relationshipId) return;
      const db = getDatabase();

      // All parts for avatar lookup
      db.getAllAsync<PartRow>(
        `SELECT id, COALESCE(custom_name, name) AS display_name, type FROM parts`,
        [],
      ).then((rows) => {
        const map = new Map<string, PartRow>();
        rows.forEach((r) => map.set(r.id, r));
        setPartsMap(map);
      }).catch(() => undefined);

      if (relationshipId) {
        // Relationship mode — load name and filter by relationship_id
        db.getFirstAsync<{ name: string }>(
          `SELECT name FROM relationships WHERE id = ?`,
          [relationshipId],
        ).then((r) => { if (r) setContextName(r.name); }).catch(() => undefined);

        db.getAllAsync<DialogueRow>(
          `SELECT id, title, created_at, messages_json, participants_json
           FROM inner_dialogues
           WHERE relationship_id = ?
           ORDER BY updated_at DESC`,
          [relationshipId],
        ).then((rows) => {
          setDialogues(
            rows.map((r) => ({
              id:             r.id,
              date:           formatDate(r.created_at),
              title:          r.title ?? 'Untitled dialogue',
              preview:        getPreview(r.messages_json),
              participantIds: parseParticipantIds(r.participants_json),
            })),
          );
        }).catch(() => undefined);
      } else if (partId) {
        // Part mode — existing behavior
        db.getFirstAsync<{ display_name: string }>(
          `SELECT COALESCE(custom_name, name) AS display_name FROM parts WHERE id = ?`,
          [partId],
        ).then((row) => { if (row) setContextName(row.display_name); })
          .catch((e) => console.error('[DialogueList] part:', e));

        db.getAllAsync<DialogueRow>(
          `SELECT id, title, created_at, messages_json, participants_json
           FROM inner_dialogues
           WHERE participants_json LIKE '%' || ? || '%'
              OR part_id = ?
           ORDER BY updated_at DESC`,
          [partId, partId],
        ).then((rows) => {
          setDialogues(
            rows.map((r) => ({
              id:             r.id,
              date:           formatDate(r.created_at),
              title:          r.title ?? 'Untitled dialogue',
              preview:        getPreview(r.messages_json),
              participantIds: parseParticipantIds(r.participants_json),
            })),
          );
        }).catch((e) => console.error('[DialogueList] dialogues:', e));
      }
    }, [partId, relationshipId]),
  );

  const startDialogueHref = relationshipId
    ? `/dialogue-start?relationshipId=${relationshipId}`
    : `/dialogue-start?partId=${partId}`;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#1C1B19" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Dialogues — {contextName}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.listContent}>
        {dialogues.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={52} color="#A09D96" />
            <Text style={styles.emptyTitle}>No dialogues yet</Text>
            <Text style={styles.emptyBody}>
              Start a written conversation between you and your parts
            </Text>
          </View>
        ) : (
          dialogues.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.dialogueCard}
              activeOpacity={0.7}
              onPress={() => safeNavigate(`/dialogue-session?dialogueId=${item.id}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>{item.date}</Text>
                {/* Participant avatars: Self always shown + each part */}
                <View style={styles.avatarRow}>
                  <View style={[avatarStyles.circle, { backgroundColor: '#B88A00' }]}>
                    <Text style={avatarStyles.initials}>S</Text>
                  </View>
                  {item.participantIds.slice(0, 3).map((pid) => (
                    <PartAvatar key={pid} part={partsMap.get(pid)} />
                  ))}
                </View>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {!!item.preview && (
                <Text style={styles.cardPreview} numberOfLines={2}>
                  {item.preview}
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Pinned footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startBtn}
          onPress={() => router.push(startDialogueHref as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.startBtnText}>Start Dialogue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1B19',
  },
  headerRight: { width: 32 },
  listContent: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1B19',
    marginTop: 8,
  },
  emptyBody: {
    fontSize: 15,
    color: '#6B6860',
    textAlign: 'center',
    lineHeight: 22,
  },
  dialogueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardDate: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  avatarRow: {
    flexDirection: 'row',
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1B19',
  },
  cardPreview: {
    fontSize: 13,
    color: '#6B6860',
    lineHeight: 20,
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
  startBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
