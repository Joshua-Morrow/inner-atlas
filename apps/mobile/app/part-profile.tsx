/**
 * Part Profile — single scrollable screen, 3-zone layout
 *
 * Zone 1: Image Header (220px + safe area, type-color bg, initials, name, type pill)
 * Zone 2: Action Buttons (Dialogue / Trailhead / Elaborate / Refine / Updates)
 * Zone 3: Profile Info (read-only cards — only non-empty fields shown)
 *
 * Route: /part-profile?id=<uuid>
 */

import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { deletePartImage, getDatabase, getPartImages, PartImage } from '@/lib/database';
import { getTechnique } from '@/lib/techniques-data';

// ─── Types ────────────────────────────────────────────────────────────────────

type PartType = 'manager' | 'firefighter' | 'exile' | 'self';

interface PracticeSessionRow {
  id: string;
  technique_id: string;
  completed_at: string;
  duration_minutes: number;
  notes_json: string | null;
}

interface PartRow {
  id: string;
  display_name: string;
  type: PartType;
  name: string;
  custom_name: string | null;
}

interface ProfileRow {
  appearance:            string | null;
  job:                   string | null;
  key_trigger:           string | null;
  key_identifier:        string | null;
  fears:                 string | null;
  body_location:         string | null;
  origin_story:          string | null;
  beliefs:               string | null;
  relationship_to_self:  string | null;
  burdens:               string | null;
  gifts:                 string | null;
  voice_phrases:         string | null;
  desires:               string | null;
  behavioral_patterns:   string | null;
  strengths:             string | null;
  weaknesses:            string | null;
  elaboration_data_json: string | null;
  inheritance_tags:      string | null;
  inheritance_notes:     string | null;
}

interface MemoryRow {
  id: string;
  title: string | null;
  content: string;
  created_at: string | null;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TrailheadRow {
  id: string;
  status: string;
  exile_discovered: number;
  discovered_part_id: string | null;
  discovered_part_name: string | null;
  created_at: string | null;
  completed_at: string | null;
}

interface ElaborationRow {
  id: string;
  status: string | null;
  steps_json: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface UpdateRow {
  id: string;
  part_id: string;
  intensity: number | null;
  update_type: string | null;
  content_json: string | null;
  created_at: string;
}

interface RelationshipMembershipRow {
  rel_id: string;
  rel_name: string;
  rel_type: 'polarization' | 'alliance';
  side: string | null;
}

type ActivityType = 'update' | 'dialogue' | 'technique' | 'trailhead' | 'elaboration';

interface ActivityItem {
  id: string;
  type: ActivityType;
  date: string;
  summary: string;
  targetId: string;
  exileName?: string;
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

const ACTION_BUTTONS: { id: string; label: string; icon: IoniconName }[] = [
  { id: 'dialogue',  label: 'Dialogue',  icon: 'chatbubble-outline' },
  { id: 'trailhead', label: 'Trailhead', icon: 'compass-outline'    },
  { id: 'elaborate', label: 'Elaborate', icon: 'layers-outline'     },
  { id: 'refine',    label: 'Refine',    icon: 'pencil-outline'     },
  { id: 'updates',   label: 'Updates',   icon: 'time-outline'       },
];

const PROFILE_FIELDS: { key: keyof ProfileRow; label: string }[] = [
  { key: 'appearance',           label: 'LOOKS / FEELS LIKE'        },
  { key: 'job',                  label: "WHAT IT'S TRYING TO DO"    },
  { key: 'key_trigger',          label: 'WHAT ACTIVATES IT'         },
  { key: 'key_identifier',       label: "HOW YOU KNOW IT'S ACTIVE"  },
  { key: 'fears',                label: "WHAT IT'S AFRAID OF"       },
  { key: 'body_location',        label: 'BODY LOCATION'             },
  { key: 'origin_story',         label: 'ORIGINS'                   },
  { key: 'beliefs',              label: 'WHAT IT BELIEVES'          },
  { key: 'relationship_to_self', label: 'RELATIONSHIP TO SELF'      },
  { key: 'burdens',              label: 'WHAT IT CARRIES'           },
  { key: 'gifts',                label: 'NATURAL GIFTS'             },
];

// ─── Mini Chart Helper ────────────────────────────────────────────────────────

function renderProfileMiniChart(
  width: number,
  height: number,
  updates: UpdateRow[],
  color: string,
  startDate: Date,
  endDate: Date,
): React.ReactElement[] {
  if (!width || width < 10) return [];
  const startTs = startDate.getTime();
  const endTs   = endDate.getTime();
  const PAD     = 8;
  const plotW   = width - PAD * 2;
  const plotH   = height - PAD * 2;

  function px(ts: number): number {
    return endTs <= startTs ? PAD : PAD + ((ts - startTs) / (endTs - startTs)) * plotW;
  }
  function py(intensity: number | null): number {
    const v = Math.max(0, Math.min(5, intensity ?? 0));
    return PAD + plotH - (v / 5) * plotH;
  }

  const pts = updates.map((u) => ({
    x: px(new Date(u.created_at).getTime()),
    y: py(u.intensity),
  }));

  const elements: React.ReactElement[] = [];

  [0, 2.5, 5].forEach((v) => {
    const y = py(v);
    elements.push(
      <View
        key={`g${v}`}
        style={{
          position: 'absolute',
          left: PAD,
          right: PAD,
          top: y,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.07)',
        }}
      />,
    );
  });

  pts.forEach((p, i) => {
    if (i === 0) return;
    const prev = pts[i - 1]!;
    const dx   = p.x - prev.x;
    const dy   = p.y - prev.y;
    const len  = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const cx    = (prev.x + p.x) / 2;
    const cy    = (prev.y + p.y) / 2;
    elements.push(
      <View
        key={`l${i}`}
        style={{
          position: 'absolute',
          left: cx - len / 2,
          top:  cy - 0.75,
          width: len,
          height: 1.5,
          backgroundColor: color,
          transform: [{ rotate: `${angle}deg` }],
        }}
      />,
    );
  });

  pts.forEach((p, i) => {
    elements.push(
      <View
        key={`d${i}`}
        style={{
          position: 'absolute',
          left:         p.x - 3,
          top:          p.y - 3,
          width:        6,
          height:       6,
          borderRadius: 3,
          backgroundColor: color,
        }}
      />,
    );
  });

  return elements;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] ?? '').toUpperCase())
    .join('');
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PartProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const navigatingRef = useRef(false);

  const safeNavigate = useCallback((href: string) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    router.push(href as any);
    setTimeout(() => { navigatingRef.current = false; }, 1000);
  }, []);

  const [part, setPart]               = useState<PartRow | null>(null);
  const [profile, setProfile]         = useState<ProfileRow | null>(null);
  const [sessions, setSessions]       = useState<PracticeSessionRow[]>([]);
  const [trailheads, setTrailheads]   = useState<TrailheadRow[]>([]);
  const [elaborations, setElaborations] = useState<ElaborationRow[]>([]);
  const [activities, setActivities]   = useState<ActivityItem[]>([]);
  const [relationships, setRelationships] = useState<RelationshipMembershipRow[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [memories, setMemories]       = useState<MemoryRow[]>([]);
  const [expandedMemories, setExpandedMemories] = useState<Record<string, boolean>>({});
  const [addMemoryVisible, setAddMemoryVisible] = useState(false);
  const [newMemoryTitle, setNewMemoryTitle]     = useState('');
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [savingMemory, setSavingMemory] = useState(false);
  const [partCycleUpdates, setPartCycleUpdates] = useState<UpdateRow[]>([]);
  const [cyclesChartWidth, setCyclesChartWidth] = useState(0);

  // Image system state
  const [partImages, setPartImages]   = useState<PartImage[]>([]);
  const [activeTab, setActiveTab]     = useState<'profile' | 'images'>('profile');
  const [viewerImage, setViewerImage] = useState<PartImage | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const db = getDatabase();

      db.getFirstAsync<PartRow>(
        `SELECT id, COALESCE(custom_name, name) AS display_name,
                type, name, custom_name
         FROM parts WHERE id = ?`,
        [id],
      ).then((row) => { if (row) setPart(row); })
        .catch((e) => console.error('[PartProfile] parts:', e));

      db.getFirstAsync<ProfileRow>(
        `SELECT appearance, job, key_trigger, key_identifier, fears,
                body_location, origin_story, beliefs, relationship_to_self,
                burdens, gifts,
                voice_phrases, desires, behavioral_patterns, strengths,
                weaknesses, elaboration_data_json,
                inheritance_tags, inheritance_notes
         FROM part_profiles WHERE part_id = ?`,
        [id],
      ).then((row) => { if (row) setProfile(row); })
        .catch((e) => console.error('[PartProfile] profile:', e));

      db.getAllAsync<MemoryRow>(
        `SELECT id, title, content, created_at
         FROM part_memories WHERE part_id = ?
         ORDER BY created_at DESC`,
        [id],
      ).then((rows) => setMemories(rows ?? []))
        .catch(() => undefined);

      // Practice history — query by part_id column or parts_tagged_json match
      db.getAllAsync<PracticeSessionRow>(
        `SELECT id, technique_id, completed_at, duration_minutes, notes_json
         FROM practice_sessions
         WHERE part_id = ?
            OR parts_tagged_json LIKE '%' || ? || '%'
         ORDER BY completed_at DESC`,
        [id, id],
      ).then((rows) => setSessions(rows ?? []))
        .catch(() => undefined);

      // Trailhead history
      db.getAllAsync<TrailheadRow>(
        `SELECT th.id, th.status, th.exile_discovered, th.discovered_part_id,
                th.created_at, th.completed_at,
                COALESCE(p.custom_name, p.name) AS discovered_part_name
         FROM trailheads th
         LEFT JOIN parts p ON p.id = th.discovered_part_id
         WHERE th.part_id = ?
         ORDER BY COALESCE(th.completed_at, th.created_at) DESC`,
        [id],
      ).then((rows) => setTrailheads(rows ?? []))
        .catch(() => undefined);

      // Elaboration history
      db.getAllAsync<ElaborationRow>(
        `SELECT id, status, steps_json, started_at, completed_at
         FROM elaboration_sessions
         WHERE part_id = ?
         ORDER BY COALESCE(completed_at, started_at) DESC`,
        [id],
      ).then((rows) => setElaborations(rows ?? []))
        .catch(() => undefined);

      // Part images
      getPartImages(db, id)
        .then((imgs) => setPartImages(imgs ?? []))
        .catch(() => undefined);

      // Relationships this part belongs to
      db.getAllAsync<RelationshipMembershipRow>(
        `SELECT r.id AS rel_id, r.name AS rel_name, r.type AS rel_type, rm.side
         FROM relationship_members rm
         JOIN relationships r ON r.id = rm.relationship_id
         WHERE rm.part_id = ?
         ORDER BY COALESCE(r.updated_at, r.created_at) DESC`,
        [id],
      ).then((rows) => setRelationships(rows ?? []))
        .catch(() => undefined);

      // Cycles — last 30 days updates for mini chart
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      db.getAllAsync<UpdateRow>(
        `SELECT id, part_id, intensity, update_type, content_json, created_at
         FROM updates
         WHERE part_id = ? AND created_at >= ?
         ORDER BY created_at ASC`,
        [id, thirtyDaysAgo],
      ).then((rows) => setPartCycleUpdates(rows ?? []))
        .catch(() => undefined);

      // Activity log — load all 5 sources then merge + sort
      Promise.all([
        db.getAllAsync<{ id: string; update_type: string; content_json: string | null; created_at: string }>(
          `SELECT id, update_type, content_json, created_at FROM updates WHERE part_id = ? ORDER BY created_at DESC`,
          [id],
        ).catch(() => [] as { id: string; update_type: string; content_json: string | null; created_at: string }[]),

        db.getAllAsync<{ id: string; title: string | null; created_at: string }>(
          `SELECT id, title, created_at FROM inner_dialogues WHERE part_id = ? ORDER BY created_at DESC`,
          [id],
        ).catch(() => [] as { id: string; title: string | null; created_at: string }[]),

        db.getAllAsync<{ id: string; technique_id: string; completed_at: string; duration_minutes: number }>(
          `SELECT id, technique_id, completed_at, duration_minutes FROM practice_sessions WHERE part_id = ? OR parts_tagged_json LIKE '%' || ? || '%' ORDER BY completed_at DESC`,
          [id, id],
        ).catch(() => [] as { id: string; technique_id: string; completed_at: string; duration_minutes: number }[]),

        db.getAllAsync<{ id: string; status: string; exile_discovered: number; discovered_part_id: string | null; exile_name: string | null; created_at: string | null; completed_at: string | null }>(
          `SELECT th.id, th.status, th.exile_discovered, th.discovered_part_id,
                  COALESCE(th.completed_at, th.created_at) AS created_at,
                  th.completed_at,
                  COALESCE(p.custom_name, p.name) AS exile_name
           FROM trailheads th
           LEFT JOIN parts p ON p.id = th.discovered_part_id
           WHERE th.part_id = ?
           ORDER BY COALESCE(th.completed_at, th.created_at) DESC`,
          [id],
        ).catch(() => [] as { id: string; status: string; exile_discovered: number; discovered_part_id: string | null; exile_name: string | null; created_at: string | null; completed_at: string | null }[]),

        db.getAllAsync<{ id: string; status: string | null; steps_json: string | null; started_at: string | null; completed_at: string | null }>(
          `SELECT id, status, steps_json, started_at, completed_at
           FROM elaboration_sessions WHERE part_id = ?
           ORDER BY COALESCE(completed_at, started_at) DESC`,
          [id],
        ).catch(() => [] as { id: string; status: string | null; steps_json: string | null; started_at: string | null; completed_at: string | null }[]),
      ]).then(([updates, dialogues, techniques, trails, elaborationItems]) => {
        const items: ActivityItem[] = [];

        for (const u of updates) {
          let notesPreview = '';
          if (u.content_json) {
            try {
              const c = JSON.parse(u.content_json) as Record<string, string>;
              const first = c.trigger ?? c.noticed ?? c.response ?? '';
              notesPreview = first.slice(0, 40) + (first.length > 40 ? '…' : '');
            } catch { /* noop */ }
          }
          const typeLabel = u.update_type
            ? u.update_type.charAt(0).toUpperCase() + u.update_type.slice(1).replace(/_/g, ' ')
            : 'Update';
          items.push({
            id: u.id,
            type: 'update',
            date: u.created_at,
            summary: notesPreview ? `${typeLabel} — ${notesPreview}` : typeLabel,
            targetId: u.id,
          });
        }

        for (const d of dialogues) {
          items.push({
            id: d.id,
            type: 'dialogue',
            date: d.created_at,
            summary: d.title ? `Dialogue: ${d.title.slice(0, 40)}` : 'Dialogue session',
            targetId: d.id,
          });
        }

        for (const t of techniques) {
          const name = getTechnique(t.technique_id)?.title ?? t.technique_id;
          const dur  = t.duration_minutes > 0 ? ` · ${t.duration_minutes}m` : '';
          items.push({
            id: t.id,
            type: 'technique',
            date: t.completed_at,
            summary: `${name}${dur}`,
            targetId: t.id,
          });
        }

        for (const th of trails) {
          const exileNote = th.exile_discovered === 1
            ? (th.exile_name ? ` · Exile: ${th.exile_name}` : ' · Exile discovered')
            : '';
          items.push({
            id: th.id,
            type: 'trailhead',
            date: th.created_at ?? '',
            summary: `Trailhead${exileNote}`,
            targetId: th.id,
          });
        }

        for (const el of elaborationItems) {
          let stepCount = 0;
          if (el.steps_json) {
            try {
              const s = JSON.parse(el.steps_json) as Record<string, string | null>;
              stepCount = Object.values(s).filter(Boolean).length;
            } catch { /* noop */ }
          }
          items.push({
            id: el.id,
            type: 'elaboration',
            date: el.completed_at ?? el.started_at ?? '',
            summary: `Elaboration${stepCount > 0 ? ` · ${stepCount} step${stepCount === 1 ? '' : 's'}` : ''}`,
            targetId: el.id,
          });
        }

        items.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
        setActivities(items);
      }).catch(() => undefined);
    }, [id]),
  );

  async function handleSaveMemory() {
    if (!id || !newMemoryContent.trim()) return;
    setSavingMemory(true);
    const db  = getDatabase();
    const now = new Date().toISOString();
    const memId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      await db.runAsync(
        `INSERT INTO part_memories (id, part_id, title, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          memId,
          id,
          newMemoryTitle.trim() || null,
          newMemoryContent.trim(),
          now,
          now,
        ],
      );
      const rows = await db.getAllAsync<MemoryRow>(
        `SELECT id, title, content, created_at FROM part_memories
         WHERE part_id = ? ORDER BY created_at DESC`,
        [id],
      );
      setMemories(rows ?? []);
      setNewMemoryTitle('');
      setNewMemoryContent('');
      setAddMemoryVisible(false);
    } catch (e) {
      console.error('[PartProfile] saveMemory:', e);
    } finally {
      setSavingMemory(false);
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!id) return;
    setDeletingImage(true);
    try {
      const db = getDatabase();
      await deletePartImage(db, imageId, id);
      const imgs = await getPartImages(db, id);
      setPartImages(imgs ?? []);
      setViewerImage(null);
      if ((imgs ?? []).length < 2) setActiveTab('profile');
    } catch (e) {
      console.error('[PartProfile] deleteImage:', e);
      Alert.alert('Error', 'Could not delete image.');
    } finally {
      setDeletingImage(false);
    }
  }

  function handleAction(actionId: string) {
    if (!id) return;
    if (actionId === 'refine') {
      safeNavigate(`/refine-part?id=${id}`);
      return;
    }
    if (actionId === 'dialogue') {
      safeNavigate(`/dialogue?id=${id}`);
      return;
    }
    if (actionId === 'updates') {
      safeNavigate(`/updates?partId=${id}`);
      return;
    }
    if (actionId === 'trailhead') {
      safeNavigate(`/trailhead?partId=${id}`);
      return;
    }
    if (actionId === 'elaborate') {
      safeNavigate(`/elaborate?partId=${id}`);
      return;
    }
    const feature = actionId.charAt(0).toUpperCase() + actionId.slice(1);
    safeNavigate(`/coming-soon?feature=${encodeURIComponent(feature)}`);
  }

  const typeColor    = part ? TYPE_COLOR[part.type] : '#3B5BA5';
  const typeLabel    = part ? TYPE_LABEL[part.type] : 'Unknown';
  const initials     = part ? getInitials(part.display_name) : '';
  const hasAnyField  = profile !== null &&
    PROFILE_FIELDS.some(({ key }) => !!profile[key]);
  const currentImage = partImages.find((img) => img.is_current === 1) ?? null;
  const showImageTab = partImages.length >= 2;

  // Header height = 220 visible + safe area so content sits below notch
  const headerHeight = 220 + insets.top;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── ZONE 1 — Image Header ─────────────────────────────────────── */}
        {currentImage ? (
          /* ── WITH IMAGE — View + Image (ImageBackground avoided: absorbs touches on Android) */
          <View style={[styles.imageHeader, { height: headerHeight }]}>
            <Image
              source={{ uri: currentImage.rect_uri }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />

            {/* Bottom gradient — non-interactive overlay */}
            <View style={styles.headerGradient} pointerEvents="none" />

            {/* Back button */}
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.backBtn, { paddingTop: insets.top + 8 }]}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.9)" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            {/* Edit image — top-right */}
            <TouchableOpacity
              style={[styles.editImageBtn, { top: insets.top + 10 }]}
              onPress={() => router.push(`/part-image-picker?partId=${id}` as any)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="camera-outline" size={16} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>

            {/* Name + type pill with left accent */}
            <View style={styles.headerBottom}>
              <View style={[styles.headerAccentBar, { backgroundColor: typeColor }]} />
              <View style={styles.headerNameWrap}>
                <Text style={styles.headerName} numberOfLines={2}>
                  {part?.display_name ?? '…'}
                </Text>
                <View style={[styles.typePill, { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' }]}>
                  <Text style={styles.typePillText}>{typeLabel}</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          /* ── WITHOUT IMAGE — type-color background + initials ─────── */
          <View style={[styles.imageHeader, { height: headerHeight, backgroundColor: typeColor }]}>
            {/* Top vignette */}
            <View style={styles.headerVignette} />

            {/* Back button */}
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.backBtn, { paddingTop: insets.top + 8 }]}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.9)" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            {/* Initials watermark — decorative only, must not absorb touches */}
            <View style={[styles.initialsWrapper, { top: insets.top }]} pointerEvents="none">
              <Text style={styles.initialsText}>{initials}</Text>
            </View>

            {/* Name + type pill */}
            <View style={styles.headerBottom}>
              <Text style={styles.headerName} numberOfLines={2}>
                {part?.display_name ?? '…'}
              </Text>
              <View style={[styles.typePill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={styles.typePillText}>{typeLabel}</Text>
              </View>
            </View>

            {/* Add image prompt — bottom-right of header */}
            <TouchableOpacity
              style={styles.addImageBtn}
              onPress={() => router.push(`/part-image-picker?partId=${id}` as any)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="camera-outline" size={14} color="rgba(255,255,255,0.75)" />
              <Text style={styles.addImageText}>Add Image</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ZONE 2 — Action Buttons ───────────────────────────────────── */}
        <View style={styles.actionRow}>
          {ACTION_BUTTONS.map((btn) => (
            <TouchableOpacity
              key={btn.id}
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => handleAction(btn.id)}
            >
              <Ionicons name={btn.icon} size={22} color={typeColor} />
              <Text style={styles.actionLabel}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab Bar (only when 2+ images exist) ─────────────────────── */}
        {showImageTab && (
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'profile' && styles.tabBtnActive]}
              onPress={() => setActiveTab('profile')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabBtnText, activeTab === 'profile' && { color: typeColor }]}>
                Profile
              </Text>
              {activeTab === 'profile' && (
                <View style={[styles.tabUnderline, { backgroundColor: typeColor }]} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'images' && styles.tabBtnActive]}
              onPress={() => setActiveTab('images')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabBtnText, activeTab === 'images' && { color: typeColor }]}>
                Images
              </Text>
              {activeTab === 'images' && (
                <View style={[styles.tabUnderline, { backgroundColor: typeColor }]} />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Images Tab ───────────────────────────────────────────────── */}
        {activeTab === 'images' && showImageTab && (
          <View style={styles.profileSection}>
            <Text style={styles.sectionHeader}>Image Journey</Text>
            <Text style={[styles.emptyPrompt, { marginTop: -4, marginBottom: 4 }]}>
              Your part's appearance through time
            </Text>
            <View style={styles.imageGrid}>
              {partImages.map((img) => {
                const isCurrent = img.is_current === 1;
                const dateStr = new Date(img.created_at).toLocaleDateString(undefined, {
                  month: 'short', year: 'numeric',
                });
                return (
                  <TouchableOpacity
                    key={img.id}
                    style={[styles.imageGridCard, !isCurrent && { opacity: 0.8 }]}
                    activeOpacity={0.8}
                    onPress={() => setViewerImage(img)}
                  >
                    <Image
                      source={{ uri: img.rect_uri }}
                      style={styles.imageGridImg}
                      resizeMode="cover"
                    />
                    <View style={styles.imageGridBottom}>
                      <Text style={styles.imageGridDate}>{dateStr}</Text>
                      {isCurrent && (
                        <View style={[styles.currentBadge, { backgroundColor: typeColor }]}>
                          <Text style={styles.currentBadgeText}>Current</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── ZONE 3 + all profile content ─────────────────────────────── */}
        {activeTab === 'profile' && (
        <>
        <View style={styles.profileSection}>
          <Text style={styles.sectionHeader}>About This Part</Text>

          {!hasAnyField ? (
            <Text style={styles.emptyPrompt}>
              Nothing recorded yet. Use Refine to add details about this part.
            </Text>
          ) : (
            PROFILE_FIELDS.map(({ key, label }) => {
              const value = profile?.[key];
              if (!value) return null;
              return (
                <View key={key} style={styles.fieldCard}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <Text style={styles.fieldValue}>{value}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* ── Practice History ──────────────────────────────────────────── */}
        {sessions.length > 0 && (
          <View style={styles.profileSection}>
            <Text style={styles.sectionHeader}>Practice History</Text>
            {sessions.map((session) => {
              const technique = getTechnique(session.technique_id);
              const techniqueName = technique?.title ?? session.technique_id;
              const dateStr = new Date(session.completed_at).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric',
              });
              const durationStr = session.duration_minutes > 0
                ? `${session.duration_minutes}m`
                : '<1m';

              let logEntries: string[] = [];
              if (session.notes_json) {
                try { logEntries = JSON.parse(session.notes_json) as string[]; } catch { /* noop */ }
              }
              const hasNotes = logEntries.length > 0;
              const expanded = expandedNotes[session.id] ?? false;

              return (
                <View key={session.id} style={styles.sessionCard}>
                  <View style={styles.sessionRow}>
                    <View style={styles.sessionMeta}>
                      <Text style={styles.sessionName}>{techniqueName}</Text>
                      <Text style={styles.sessionDate}>{dateStr} · {durationStr}</Text>
                    </View>
                    {hasNotes && (
                      <Pressable
                        onPress={() =>
                          setExpandedNotes((prev) => ({
                            ...prev,
                            [session.id]: !prev[session.id],
                          }))
                        }
                        hitSlop={8}
                      >
                        <Text style={styles.viewNotes}>
                          {expanded ? 'Hide notes' : 'View notes'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  {expanded && (
                    <View style={styles.notesWrap}>
                      {logEntries.map((entry, i) => (
                        <Text key={i} style={styles.noteEntry}>{i + 1}. {entry}</Text>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── Trailhead History ─────────────────────────────────────────── */}
        {trailheads.length > 0 && (
          <View style={styles.profileSection}>
            <Text style={styles.sectionHeader}>Trailhead History</Text>
            {trailheads.map((th) => {
              const dateStr = th.completed_at ?? th.created_at
                ? new Date((th.completed_at ?? th.created_at)!).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })
                : '';
              const statusLabel = th.status === 'complete' ? 'Completed' : 'In Progress';
              return (
                <TouchableOpacity
                  key={th.id}
                  style={styles.sessionCard}
                  activeOpacity={0.7}
                  onPress={() => safeNavigate(`/trailhead-review?id=${th.id}`)}
                >
                  <View style={styles.sessionRow}>
                    <View style={styles.sessionMeta}>
                      <Text style={styles.sessionName}>Trailhead</Text>
                      <Text style={styles.sessionDate}>
                        {dateStr}{dateStr ? ' · ' : ''}{statusLabel}
                      </Text>
                      {th.exile_discovered === 1 && (
                        <Text style={styles.exileDiscoveredLabel}>
                          Exile discovered{th.discovered_part_name ? `: ${th.discovered_part_name}` : ''}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#6B6860" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Elaboration History ───────────────────────────────────────── */}
        {elaborations.length > 0 && (
          <View style={styles.profileSection}>
            <Text style={styles.sectionHeader}>Elaboration History</Text>
            {elaborations.map((el) => {
              const dateStr = el.completed_at ?? el.started_at
                ? new Date((el.completed_at ?? el.started_at)!).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })
                : '';
              const statusLabel = el.status === 'completed' ? 'Completed' : 'In Progress';
              return (
                <TouchableOpacity
                  key={el.id}
                  style={styles.sessionCard}
                  activeOpacity={0.7}
                  onPress={() => safeNavigate(`/elaboration-review?id=${el.id}`)}
                >
                  <View style={styles.sessionRow}>
                    <View style={styles.sessionMeta}>
                      <Text style={styles.sessionName}>Elaboration</Text>
                      <Text style={styles.sessionDate}>
                        {dateStr}{dateStr ? ' · ' : ''}{statusLabel}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#6B6860" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── New Elaboration Fields ───────────────────────────────────── */}
        {profile && (profile.voice_phrases || profile.desires || profile.behavioral_patterns || profile.strengths || profile.weaknesses) && (
          <View style={styles.profileSection}>
            <Text style={styles.sectionHeader}>Elaboration Notes</Text>
            {[
              { key: 'voice_phrases',       label: 'VOICE & PHRASES'      },
              { key: 'desires',             label: 'DESIRES & NEEDS'       },
              { key: 'behavioral_patterns', label: 'BEHAVIORAL PATTERNS'  },
              { key: 'strengths',           label: 'STRENGTHS'             },
              { key: 'weaknesses',          label: 'WEAKNESSES'            },
            ].map(({ key, label }) => {
              const value = profile[key as keyof ProfileRow] as string | null;
              if (!value) return null;
              return (
                <View key={key} style={styles.fieldCard}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <Text style={styles.fieldValue}>{value}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Part Inheritance ──────────────────────────────────────────── */}
        {(() => {
          if (!profile) return null;
          let inheritanceTags: string[] = [];
          if (profile.inheritance_tags) {
            try {
              const parsed = JSON.parse(profile.inheritance_tags) as unknown;
              if (Array.isArray(parsed)) inheritanceTags = parsed as string[];
            } catch { /* noop */ }
          }
          const hasNotes = !!(profile.inheritance_notes?.trim());
          const inheritanceMemories = memories.filter(
            (m) => m.title?.startsWith('Inheritance —'),
          );
          if (!inheritanceTags.length && !hasNotes && !inheritanceMemories.length) return null;
          return (
            <View style={styles.profileSection}>
              <Text style={styles.sectionHeader}>Part Inheritance</Text>
              {inheritanceTags.length > 0 && (
                <View style={styles.descriptorChips}>
                  {inheritanceTags.map((tag) => (
                    <View
                      key={tag}
                      style={[
                        styles.descriptorChip,
                        { borderColor: typeColor, backgroundColor: `${typeColor}14` },
                      ]}
                    >
                      <Text style={[styles.descriptorChipText, { color: typeColor }]}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {hasNotes && (
                <Text style={styles.fieldValue}>{profile.inheritance_notes}</Text>
              )}
              {inheritanceMemories.map((mem) => {
                const dateStr = mem.created_at
                  ? new Date(mem.created_at).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })
                  : '';
                return (
                  <View key={mem.id} style={styles.sessionCard}>
                    {mem.title && (
                      <Text style={styles.fieldLabel}>{mem.title}</Text>
                    )}
                    <Text style={styles.fieldValue}>{mem.content}</Text>
                    {dateStr ? (
                      <Text style={styles.sessionDate}>{dateStr}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          );
        })()}

        {/* ── Descriptors ───────────────────────────────────────────────── */}
        {(() => {
          if (!profile?.elaboration_data_json) return null;
          let parsed: Record<string, { selected: string[]; custom: string }> = {};
          try { parsed = JSON.parse(profile.elaboration_data_json) as typeof parsed; }
          catch { return null; }

          const sectionLabels: Record<string, string> = {
            emotions:    'Emotions & Feelings',
            personality: 'Personality Qualities',
            attitude:    'Attitude & Disposition',
            appearance:  'Appearance',
          };

          const hasSections = Object.entries(parsed).some(
            ([, v]) => (v.selected?.length ?? 0) > 0 || (v.custom?.trim().length ?? 0) > 0,
          );
          if (!hasSections) return null;

          return (
            <View style={styles.profileSection}>
              <Text style={styles.sectionHeader}>Descriptors</Text>
              {Object.entries(parsed).map(([sid, data]) => {
                const hasContent =
                  (data.selected?.length ?? 0) > 0 ||
                  (data.custom?.trim().length ?? 0) > 0;
                if (!hasContent) return null;
                return (
                  <View key={sid} style={styles.fieldCard}>
                    <Text style={styles.fieldLabel}>{sectionLabels[sid] ?? sid}</Text>
                    {data.custom?.trim() ? (
                      <Text style={[styles.fieldValue, { fontStyle: 'italic', marginBottom: 8 }]}>
                        {data.custom.trim()}
                      </Text>
                    ) : null}
                    {(data.selected?.length ?? 0) > 0 && (
                      <View style={styles.descriptorChips}>
                        {data.selected.map((word) => (
                          <View
                            key={word}
                            style={[styles.descriptorChip, { borderColor: typeColor, backgroundColor: `${typeColor}14` }]}
                          >
                            <Text style={[styles.descriptorChipText, { color: typeColor }]}>
                              {word}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })()}

        {/* ── Memories ──────────────────────────────────────────────────── */}
        {memories.length > 0 && (
          <View style={styles.profileSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Memories</Text>
              <TouchableOpacity
                onPress={() => setAddMemoryVisible(true)}
                style={styles.addMemoryBtn}
              >
                <Ionicons name="add" size={14} color="#3B5BA5" />
                <Text style={styles.addMemoryBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            {memories.map((mem) => {
              const dateStr = mem.created_at
                ? new Date(mem.created_at).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })
                : '';
              const isExpanded = expandedMemories[mem.id] ?? false;
              const preview = mem.title
                ? mem.title
                : mem.content.slice(0, 60) + (mem.content.length > 60 ? '…' : '');
              return (
                <Pressable
                  key={mem.id}
                  style={styles.sessionCard}
                  onPress={() =>
                    setExpandedMemories((prev) => ({
                      ...prev,
                      [mem.id]: !prev[mem.id],
                    }))
                  }
                >
                  <View style={styles.sessionRow}>
                    <View style={styles.sessionMeta}>
                      <Text style={styles.sessionName}>{preview}</Text>
                      {dateStr ? (
                        <Text style={styles.sessionDate}>{dateStr}</Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#6B6860"
                    />
                  </View>
                  {isExpanded && (
                    <Text style={[styles.fieldValue, { marginTop: 8 }]}>
                      {mem.content}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Add Memory Modal */}
        <Modal
          visible={addMemoryVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setAddMemoryVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setAddMemoryVisible(false)}
          >
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <Text style={styles.modalTitle}>Add Memory</Text>
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Title (optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newMemoryTitle}
                  onChangeText={setNewMemoryTitle}
                  placeholder="A brief title…"
                  placeholderTextColor="#C5C3BE"
                />
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Memory</Text>
                <TextInput
                  style={[styles.modalInput, { minHeight: 100 }]}
                  value={newMemoryContent}
                  onChangeText={setNewMemoryContent}
                  placeholder="Describe the memory…"
                  placeholderTextColor="#C5C3BE"
                  multiline
                  textAlignVertical="top"
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.modalSaveBtn,
                  !newMemoryContent.trim() && styles.modalSaveBtnDisabled,
                ]}
                onPress={handleSaveMemory}
                disabled={!newMemoryContent.trim() || savingMemory}
              >
                <Text style={styles.modalSaveBtnText}>
                  {savingMemory ? 'Saving…' : 'Save Memory'}
                </Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ── Relationships ─────────────────────────────────────────────── */}
        {relationships.length > 0 && (
          <View style={styles.profileSection}>
            <Text style={styles.sectionHeader}>Relationships</Text>
            {relationships.map((r) => {
              const typeColor = r.rel_type === 'polarization' ? '#C2600A' : '#3B5BA5';
              const typeBg    = r.rel_type === 'polarization' ? '#FFF7ED' : '#EEF2FF';
              const typeLabel = r.rel_type === 'polarization' ? 'Polarization' : 'Alliance';
              const roleLabel = r.rel_type === 'polarization'
                ? (r.side === 'a' ? 'Side A' : r.side === 'b' ? 'Side B' : 'Member')
                : 'Member';
              return (
                <TouchableOpacity
                  key={r.rel_id}
                  style={styles.sessionCard}
                  activeOpacity={0.7}
                  onPress={() => safeNavigate(`/relationship-profile?id=${r.rel_id}`)}
                >
                  <View style={styles.sessionRow}>
                    <View style={styles.sessionMeta}>
                      <Text style={styles.sessionName}>{r.rel_name}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 3 }}>
                        <View style={[{ borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }, { backgroundColor: typeBg }]}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: typeColor }}>{typeLabel}</Text>
                        </View>
                        <Text style={styles.sessionDate}>{roleLabel}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#6B6860" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Cycles — Activation History ───────────────────────────────── */}
        {partCycleUpdates.length >= 1 && (
          <View style={styles.profileSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Activation History</Text>
              <TouchableOpacity
                onPress={() => safeNavigate(`/cycles?partId=${id}`)}
                style={styles.addMemoryBtn}
              >
                <Text style={styles.addMemoryBtnText}>View all →</Text>
              </TouchableOpacity>
            </View>
            <View
              style={{
                height:          140,
                backgroundColor: '#1A1917',
                borderRadius:    12,
                overflow:        'hidden',
                position:        'relative',
              }}
              onLayout={(e: LayoutChangeEvent) => setCyclesChartWidth(e.nativeEvent.layout.width)}
            >
              {renderProfileMiniChart(
                cyclesChartWidth,
                140,
                partCycleUpdates,
                TYPE_COLOR[part?.type ?? 'manager'] ?? '#3B5BA5',
                new Date(Date.now() - 30 * 86400000),
                new Date(),
              )}
            </View>
          </View>
        )}

        {/* ── Activity Log ──────────────────────────────────────────────── */}
        {activities.length > 0 && (
          <View style={styles.profileSection}>
            <Text style={styles.sectionHeader}>Activity Log</Text>
            {activities.map((item) => {
              const dateStr = item.date
                ? new Date(item.date).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })
                : '';

              const ACTIVITY_CONFIG: Record<ActivityType, { icon: IoniconName; color: string; label: string }> = {
                update:       { icon: 'time-outline',        color: '#6B6860', label: 'Update'       },
                dialogue:     { icon: 'chatbubble-outline',  color: '#3B5BA5', label: 'Dialogue'     },
                technique:    { icon: 'list-outline',        color: '#B88A00', label: 'Technique'    },
                trailhead:    { icon: 'compass-outline',     color: '#7C3D9B', label: 'Trailhead'    },
                elaboration:  { icon: 'layers-outline',      color: '#B88A00', label: 'Elaboration'  },
              };
              const cfg = ACTIVITY_CONFIG[item.type];

              const navTarget =
                item.type === 'update'       ? `/update-detail?id=${item.targetId}` :
                item.type === 'dialogue'     ? `/dialogue-session?dialogueId=${item.targetId}` :
                item.type === 'trailhead'    ? `/trailhead-review?id=${item.targetId}` :
                item.type === 'elaboration'  ? `/elaboration-menu?partId=${id}` :
                `/technique-log?sessionId=${item.targetId}`;

              return (
                <TouchableOpacity
                  key={`${item.type}-${item.id}`}
                  style={styles.activityCard}
                  activeOpacity={0.7}
                  onPress={() => safeNavigate(navTarget)}
                >
                  <View style={[styles.activityIconWrap, { backgroundColor: `${cfg.color}18` }]}>
                    <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                  </View>
                  <View style={styles.activityBody}>
                    <View style={styles.activityTopRow}>
                      <Text style={[styles.activityTypeLabel, { color: cfg.color }]}>{cfg.label}</Text>
                      {dateStr ? <Text style={styles.activityDate}>{dateStr}</Text> : null}
                    </View>
                    <Text style={styles.activitySummary} numberOfLines={2}>{item.summary}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#C5C3BE" />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        </>
        )}

        {/* ── Image Viewer Modal ────────────────────────────────────────── */}
        <Modal
          visible={viewerImage !== null}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setViewerImage(null)}
        >
          {viewerImage && (
            <View style={styles.viewerRoot}>
              {/* Header */}
              <View style={styles.viewerHeader}>
                <TouchableOpacity onPress={() => setViewerImage(null)} activeOpacity={0.7}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.viewerDate}>
                  {new Date(viewerImage.created_at).toLocaleDateString(undefined, {
                    month: 'long', day: 'numeric', year: 'numeric',
                  })}
                </Text>
                <View style={{ width: 24 }} />
              </View>

              {/* Images row */}
              <View style={styles.viewerImagesRow}>
                <View style={styles.viewerImageWrap}>
                  <Image
                    source={{ uri: viewerImage.rect_uri }}
                    style={styles.viewerRectImg}
                    resizeMode="cover"
                  />
                  <Text style={styles.viewerImgLabel}>Card</Text>
                </View>
                <View style={styles.viewerImageWrap}>
                  <Image
                    source={{ uri: viewerImage.circle_uri }}
                    style={styles.viewerCircleImg}
                    resizeMode="cover"
                  />
                  <Text style={styles.viewerImgLabel}>Profile</Text>
                </View>
              </View>

              {/* Delete button — only for non-current images */}
              {viewerImage.is_current !== 1 && (
                <TouchableOpacity
                  style={styles.viewerDeleteBtn}
                  activeOpacity={0.7}
                  disabled={deletingImage}
                  onPress={() => {
                    Alert.alert(
                      'Remove this image?',
                      "This can't be undone.",
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => handleDeleteImage(viewerImage.id),
                        },
                      ],
                    );
                  }}
                >
                  {deletingImage
                    ? <ActivityIndicator color="#C0392B" />
                    : <Text style={styles.viewerDeleteText}>Delete This Image</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          )}
        </Modal>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },

  scroll: {
    flex: 1,
  },

  // ── Zone 1 — Image Header
  imageHeader: {
    position: 'relative',
    overflow: 'hidden',
  },

  headerVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },

  backBtn: {
    position: 'absolute',
    top: 0,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 2,
    paddingRight: 8,
  },
  backText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '600',
  },

  initialsWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 80,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.18)',
    letterSpacing: -2,
  },

  headerBottom: {
    position: 'absolute',
    bottom: 18,
    left: 20,
    right: 20,
    gap: 8,
    zIndex: 1,
  },
  headerName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 34,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },

  typePill: {
    alignSelf: 'flex-start',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Zone 2 — Action Buttons
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },

  actionCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  actionCardPressed: {
    opacity: 0.75,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1C1B19',
    textAlign: 'center',
  },

  // ── Zone 3 — Profile Info
  profileSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 10,
  },

  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1B19',
    marginBottom: 4,
  },

  fieldCard: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E3DE',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B6860',
    letterSpacing: 0.6,
  },
  fieldValue: {
    fontSize: 15,
    color: '#1C1B19',
    lineHeight: 22,
  },

  emptyPrompt: {
    fontSize: 14,
    color: '#6B6860',
    fontStyle: 'italic',
    lineHeight: 22,
    paddingVertical: 8,
  },

  // ── Practice History
  sessionCard: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    marginBottom: 8,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  sessionMeta: { flex: 1 },
  sessionName: { fontSize: 14, fontWeight: '600', color: '#1C1B19', marginBottom: 2 },
  sessionDate: { fontSize: 12, color: '#6B6860' },
  viewNotes: { fontSize: 12, color: '#3B5BA5', fontWeight: '600', paddingTop: 2 },
  notesWrap: { marginTop: 10, gap: 4 },
  noteEntry: { fontSize: 13, color: '#1C1B19', lineHeight: 20 },

  // ── Trailhead History
  exileDiscoveredLabel: {
    fontSize: 12,
    color: '#7C3D9B',
    fontWeight: '600',
    marginTop: 2,
  },

  // ── Activity Log
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    marginBottom: 6,
  },
  activityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityBody: {
    flex: 1,
    gap: 2,
  },
  activityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  activityTypeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  activityDate: {
    fontSize: 11,
    color: '#6B6860',
  },
  activitySummary: {
    fontSize: 13,
    color: '#1C1B19',
    lineHeight: 18,
  },

  // ── Section header with action
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addMemoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
  },
  addMemoryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B5BA5',
  },

  // ── Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1B19',
  },
  modalField: { gap: 8 },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modalInput: {
    backgroundColor: '#F3F2EF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1C1B19',
    lineHeight: 22,
  },
  modalSaveBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  modalSaveBtnDisabled: { backgroundColor: '#E5E3DE' },
  modalSaveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Descriptors
  descriptorChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  descriptorChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  descriptorChipText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Zone 1 image support
  headerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  editImageBtn: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
  },
  headerNameWrap: {
    paddingLeft: 10,
    gap: 8,
  },
  addImageBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 10,
  },
  addImageText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '500',
  },

  // ── Tab Bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
    marginTop: 4,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabBtnActive: {},
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6860',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 1,
  },

  // ── Images Grid
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageGridCard: {
    width: '47%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E3DE',
    backgroundColor: '#F3F2EF',
  },
  imageGridImg: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  imageGridBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
  },
  imageGridDate: {
    fontSize: 11,
    color: '#6B6860',
    fontWeight: '500',
  },
  currentBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Image Viewer Modal
  viewerRoot: {
    flex: 1,
    backgroundColor: '#1A1917',
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  viewerDate: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  viewerImagesRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 24,
  },
  viewerImageWrap: {
    alignItems: 'center',
    gap: 8,
  },
  viewerRectImg: {
    width: 140,
    height: 187,
    borderRadius: 12,
  },
  viewerCircleImg: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  viewerImgLabel: {
    color: '#9B9A94',
    fontSize: 12,
    fontWeight: '500',
  },
  viewerDeleteBtn: {
    marginHorizontal: 24,
    marginBottom: 48,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C0392B',
    alignItems: 'center',
  },
  viewerDeleteText: {
    color: '#C0392B',
    fontSize: 15,
    fontWeight: '600',
  },
});
