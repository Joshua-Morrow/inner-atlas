/**
 * Cycles — activation history chart for parts
 * Route: /cycles?partId=<uuid>  (optional pre-filter)
 *
 * Pure RN Views for chart rendering (no SVG, no Skia).
 * Rotated Views for diagonal line segments.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
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

interface UpdateRow {
  id: string;
  part_id: string;
  intensity: number | null;
  update_type: string | null;
  content_json: string | null;
  created_at: string;
}

interface RelationshipRow {
  id: string;
  name: string;
  type: 'polarization' | 'alliance';
}

interface RelationshipMemberRow {
  relationship_id: string;
  part_id: string | null;
  side: string | null;
}

interface AnnotationRow {
  id: string;
  label: string;
  start_date: string;
  end_date: string | null;
  color_hex: string;
  notes: string | null;
  created_at: string | null;
}

interface TooltipData {
  x: number;
  y: number;
  partName: string;
  date: string;
  activationType: string | null;
  intensity: number | null;
  notes: string;
  above: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<PartType, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
};

type TimeRange = '7D' | '30D' | '90D' | '6M' | 'All';

const TIME_RANGES: TimeRange[] = ['7D', '30D', '90D', '6M', 'All'];

const ANNOTATION_COLORS = ['#B88A00', '#3B5BA5', '#7C3D9B', '#C2600A', '#2E7D5E', '#8B4513'];

const CHART_PAD_TOP    = 20;
const CHART_PAD_BOTTOM = 28;
const CHART_PAD_LEFT   = 38;
const CHART_PAD_RIGHT  = 16;
const CHART_HEIGHT     = 280;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => (w[0] ?? '').toUpperCase()).join('');
}

function getStartDate(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case '7D':  return new Date(now.getTime() - 7  * 86400000);
    case '30D': return new Date(now.getTime() - 30 * 86400000);
    case '90D': return new Date(now.getTime() - 90 * 86400000);
    case '6M':  return new Date(now.getTime() - 180 * 86400000);
    case 'All': return new Date(2020, 0, 1);
  }
}

function getXLabels(range: TimeRange, startDate: Date, endDate: Date): { label: string; frac: number }[] {
  const start = startDate.getTime();
  const end   = endDate.getTime();
  const span  = end - start;

  function frac(d: Date): number {
    return span > 0 ? (d.getTime() - start) / span : 0;
  }

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (range === '7D') {
    const labels: { label: string; frac: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start + i * 86400000);
      labels.push({ label: DAY_NAMES[d.getDay()] ?? '', frac: frac(d) });
    }
    return labels;
  }

  if (range === '30D') {
    const labels: { label: string; frac: number }[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(start + (i / 4) * span);
      labels.push({
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`,
        frac: i / 4,
      });
    }
    return labels;
  }

  if (range === '90D') {
    const labels: { label: string; frac: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(start + (i / 5) * span);
      labels.push({
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`,
        frac: i / 5,
      });
    }
    return labels;
  }

  // 6M or All — month labels
  const labels: { label: string; frac: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(start + (i / 5) * span);
    labels.push({ label: `${MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, frac: i / 5 });
  }
  return labels;
}

// ─── Mini Chart Render Helper ─────────────────────────────────────────────────

function renderMiniChartElements(
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

  // Grid lines
  ([0, 2.5, 5] as const).forEach((v) => {
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

  // Line segments
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

  // Dots
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CyclesScreen() {
  const { partId: paramPartId } = useLocalSearchParams<{ partId?: string }>();

  // ── Data state
  const [parts,       setParts]       = useState<PartRow[]>([]);
  const [updates,     setUpdates]     = useState<UpdateRow[]>([]);
  const [relationships,    setRelationships]    = useState<RelationshipRow[]>([]);
  const [relMembers,  setRelMembers]  = useState<RelationshipMemberRow[]>([]);
  const [annotations, setAnnotations] = useState<AnnotationRow[]>([]);

  // ── Filter state
  const [timeRange,        setTimeRange]        = useState<TimeRange>('30D');
  const [selectedPartIds,  setSelectedPartIds]  = useState<string[]>(
    paramPartId ? [paramPartId] : [],
  );

  // ── Chart layout
  const [chartWidth, setChartWidth] = useState(0);

  // ── Tooltip
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // ── Annotation modal
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [annLabel,     setAnnLabel]     = useState('');
  const [annStartDate, setAnnStartDate] = useState(todayStr);
  const [annEndDate,   setAnnEndDate]   = useState('');
  const [annColor,     setAnnColor]     = useState(ANNOTATION_COLORS[0]!);
  const [annNotes,     setAnnNotes]     = useState('');
  const [savingAnn,    setSavingAnn]    = useState(false);

  // ── Load data on focus / range change
  useFocusEffect(
    useCallback(() => {
      const db = getDatabase();
      const startDate = getStartDate(timeRange);
      const startIso  = startDate.toISOString();

      db.getAllAsync<PartRow>(
        `SELECT id, COALESCE(custom_name, name) AS display_name, type FROM parts ORDER BY created_at ASC`,
        [],
      ).then((rows) => setParts(rows ?? [])).catch(console.error);

      db.getAllAsync<UpdateRow>(
        `SELECT id, part_id, intensity, update_type, content_json, created_at
         FROM updates
         WHERE created_at >= ?
         ORDER BY created_at ASC`,
        [startIso],
      ).then((rows) => setUpdates(rows ?? [])).catch(console.error);

      db.getAllAsync<RelationshipRow>(
        `SELECT id, name, type FROM relationships ORDER BY created_at ASC`,
        [],
      ).then((rows) => setRelationships(rows ?? [])).catch(console.error);

      db.getAllAsync<RelationshipMemberRow>(
        `SELECT relationship_id, part_id, side FROM relationship_members WHERE part_id IS NOT NULL`,
        [],
      ).then((rows) => setRelMembers(rows ?? [])).catch(console.error);

      db.getAllAsync<AnnotationRow>(
        `SELECT id, label, start_date, end_date, color_hex, notes, created_at FROM cycle_annotations ORDER BY start_date ASC`,
        [],
      ).then((rows) => setAnnotations(rows ?? [])).catch(console.error);
    }, [timeRange]),
  );

  // ── Derived: filtered updates
  const filteredUpdates = useMemo(() => {
    if (selectedPartIds.length === 0) return updates;
    return updates.filter((u) => selectedPartIds.includes(u.part_id));
  }, [updates, selectedPartIds]);

  const hasAnyUpdates       = updates.length > 0;
  const hasIntensityRatings = filteredUpdates.some((u) => u.intensity !== null);

  const partsWithUpdates = useMemo(() => {
    const ids = new Set(updates.map((u) => u.part_id));
    return parts.filter((p) => ids.has(p.id));
  }, [parts, updates]);

  // ── Chart computations
  const endDate   = useMemo(() => new Date(), []);
  const startDate = useMemo(() => getStartDate(timeRange), [timeRange]);

  const plotW = chartWidth - CHART_PAD_LEFT - CHART_PAD_RIGHT;
  const plotH = CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;

  function xPos(ts: number): number {
    const startTs = startDate.getTime();
    const endTs   = endDate.getTime();
    if (endTs <= startTs) return CHART_PAD_LEFT;
    return CHART_PAD_LEFT + ((ts - startTs) / (endTs - startTs)) * plotW;
  }

  function yPos(intensity: number | null): number {
    const v = Math.max(0, Math.min(5, intensity ?? 0));
    return CHART_PAD_TOP + plotH - (v / 5) * plotH;
  }

  // Group filtered updates by part
  const updatesByPart = useMemo(() => {
    const map = new Map<string, UpdateRow[]>();
    for (const u of filteredUpdates) {
      if (!map.has(u.part_id)) map.set(u.part_id, []);
      map.get(u.part_id)!.push(u);
    }
    return map;
  }, [filteredUpdates]);

  const xLabels = useMemo(() => getXLabels(timeRange, startDate, endDate), [timeRange, startDate, endDate]);

  const partsMap = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);

  // ── Toggle part filter
  function togglePart(id: string) {
    setSelectedPartIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setTooltip(null);
  }

  // ── Handle chart tap (dismiss tooltip)
  function handleChartPress() {
    setTooltip(null);
  }

  // ── Handle data point tap
  function handleDotPress(u: UpdateRow, dotX: number, dotY: number) {
    const part = partsMap.get(u.part_id);
    let notes = '';
    if (u.content_json) {
      try {
        const c = JSON.parse(u.content_json) as Record<string, string>;
        notes = (c.trigger ?? c.noticed ?? c.response ?? '').slice(0, 60);
      } catch { /* noop */ }
    }
    const above = dotY > CHART_HEIGHT / 2;
    setTooltip({
      x: dotX,
      y: dotY,
      partName: part?.display_name ?? 'Unknown',
      date: new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      activationType: u.update_type,
      intensity: u.intensity,
      notes,
      above,
    });
  }

  // ── Save annotation
  async function handleSaveAnnotation() {
    if (!annLabel.trim()) return;
    setSavingAnn(true);
    try {
      const db  = getDatabase();
      const id  = generateId();
      const now = nowIso();
      await db.runAsync(
        `INSERT INTO cycle_annotations (id, label, start_date, end_date, color_hex, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, annLabel.trim(), annStartDate, annEndDate || null, annColor, annNotes.trim() || null, now],
      );
      const rows = await db.getAllAsync<AnnotationRow>(
        `SELECT id, label, start_date, end_date, color_hex, notes, created_at FROM cycle_annotations ORDER BY start_date ASC`,
        [],
      );
      setAnnotations(rows ?? []);
      setAnnLabel('');
      setAnnStartDate(todayStr());
      setAnnEndDate('');
      setAnnColor(ANNOTATION_COLORS[0]!);
      setAnnNotes('');
      setShowAnnotationModal(false);
    } catch (e) {
      console.error('[Cycles] saveAnnotation:', e);
    } finally {
      setSavingAnn(false);
    }
  }

  // ── Delete annotation
  function handleDeleteAnnotation(id: string, label: string) {
    Alert.alert(
      'Delete Annotation',
      `Remove "${label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await getDatabase().runAsync(`DELETE FROM cycle_annotations WHERE id = ?`, [id]);
              setAnnotations((prev) => prev.filter((a) => a.id !== id));
            } catch (e) {
              console.error('[Cycles] deleteAnnotation:', e);
            }
          },
        },
      ],
    );
  }

  // ── Render chart elements
  function renderChart() {
    if (!chartWidth) return null;

    const elements: React.ReactElement[] = [];

    // Annotation bands
    annotations.forEach((ann) => {
      const startTs = new Date(ann.start_date).getTime();
      const left    = xPos(startTs);

      if (!ann.end_date) {
        // Vertical line for point-in-time
        elements.push(
          <View
            key={`ann-line-${ann.id}`}
            style={{
              position: 'absolute',
              left,
              top:    CHART_PAD_TOP,
              bottom: CHART_PAD_BOTTOM,
              width:  1.5,
              backgroundColor: ann.color_hex,
              opacity: 0.6,
            }}
          />,
        );
        elements.push(
          <Text
            key={`ann-label-${ann.id}`}
            style={{
              position: 'absolute',
              left:    left + 3,
              top:     CHART_PAD_TOP + 2,
              fontSize: 9,
              color:    ann.color_hex,
              fontWeight: '600',
            }}
            numberOfLines={1}
          >
            {ann.label}
          </Text>,
        );
      } else {
        const endTs  = new Date(ann.end_date).getTime();
        const right  = xPos(endTs);
        const bandW  = Math.max(right - left, 4);
        elements.push(
          <View
            key={`ann-band-${ann.id}`}
            style={{
              position: 'absolute',
              left,
              top:      CHART_PAD_TOP,
              width:    bandW,
              bottom:   CHART_PAD_BOTTOM,
              backgroundColor: ann.color_hex,
              opacity: 0.15,
            }}
          />,
        );
        elements.push(
          <Text
            key={`ann-label-${ann.id}`}
            style={{
              position: 'absolute',
              left:    left + 3,
              top:     CHART_PAD_TOP + 2,
              fontSize: 9,
              color:    ann.color_hex,
              fontWeight: '600',
            }}
            numberOfLines={1}
          >
            {ann.label}
          </Text>,
        );
      }
    });

    // Y-axis gridlines + labels
    for (let v = 0; v <= 5; v++) {
      const y = yPos(v);
      elements.push(
        <View
          key={`grid-${v}`}
          style={{
            position:        'absolute',
            left:            CHART_PAD_LEFT,
            right:           CHART_PAD_RIGHT,
            top:             y,
            height:          1,
            backgroundColor: 'rgba(255,255,255,0.07)',
          }}
        />,
      );
      elements.push(
        <Text
          key={`ylabel-${v}`}
          style={{
            position: 'absolute',
            left:     2,
            top:      y - 7,
            fontSize: 10,
            color:    'rgba(255,255,255,0.4)',
            width:    32,
            textAlign: 'right',
          }}
        >
          {v}
        </Text>,
      );
    }

    // Relationship lines (alliances)
    relationships.forEach((rel) => {
      if (rel.type !== 'alliance') return;
      const members = relMembers.filter((m) => m.relationship_id === rel.id && m.part_id);
      if (members.length < 2) return;
      const memberIds = members.map((m) => m.part_id!);

      // Find updates from these members in filtered set
      const relUpdates = filteredUpdates
        .filter((u) => memberIds.includes(u.part_id))
        .sort((a, b) => a.created_at.localeCompare(b.created_at));

      for (let i = 1; i < relUpdates.length; i++) {
        const prev = relUpdates[i - 1]!;
        const curr = relUpdates[i]!;
        const x1 = xPos(new Date(prev.created_at).getTime());
        const y1 = yPos(prev.intensity);
        const x2 = xPos(new Date(curr.created_at).getTime());
        const y2 = yPos(curr.intensity);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) continue;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const cx    = (x1 + x2) / 2;
        const cy    = (y1 + y2) / 2;
        const lineStyle: ViewStyle = {
          position:  'absolute',
          left:      cx - len / 2,
          top:       cy - 0.75,
          width:     len,
          height:    1.5,
          backgroundColor: 'rgba(59,91,165,0.7)',
          transform: [{ rotate: `${angle}deg` }],
        };
        elements.push(<View key={`al-${rel.id}-${i}`} style={lineStyle} />);
      }
    });

    // Polarization lines
    relationships.forEach((rel) => {
      if (rel.type !== 'polarization') return;
      const sideA = relMembers.filter((m) => m.relationship_id === rel.id && m.side === 'a' && m.part_id);
      const sideB = relMembers.filter((m) => m.relationship_id === rel.id && m.side === 'b' && m.part_id);

      const renderSide = (members: RelationshipMemberRow[], color: string) => {
        const ids = members.map((m) => m.part_id!);
        const sideUpdates = filteredUpdates
          .filter((u) => ids.includes(u.part_id))
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        for (let i = 1; i < sideUpdates.length; i++) {
          const prev = sideUpdates[i - 1]!;
          const curr = sideUpdates[i]!;
          const x1 = xPos(new Date(prev.created_at).getTime());
          const y1 = yPos(prev.intensity);
          const x2 = xPos(new Date(curr.created_at).getTime());
          const y2 = yPos(curr.intensity);
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1) return;
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const cx    = (x1 + x2) / 2;
          const cy    = (y1 + y2) / 2;
          elements.push(
            <View
              key={`pol-${rel.id}-${color}-${i}`}
              style={{
                position:  'absolute',
                left:      cx - len / 2,
                top:       cy - 0.75,
                width:     len,
                height:    1.5,
                backgroundColor: color,
                transform: [{ rotate: `${angle}deg` }],
              }}
            />,
          );
        }
      };

      const colorA = '#3B5BA5';
      const colorB = '#C2600A';
      renderSide(sideA, colorA);
      renderSide(sideB, colorB);
    });

    // Data lines per part
    updatesByPart.forEach((partUpdates, partId) => {
      const part  = partsMap.get(partId);
      const color = part ? (TYPE_COLOR[part.type] ?? '#6B6860') : '#6B6860';

      const sorted = [...partUpdates].sort((a, b) => a.created_at.localeCompare(b.created_at));

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]!;
        const curr = sorted[i]!;
        const x1   = xPos(new Date(prev.created_at).getTime());
        const y1   = yPos(prev.intensity);
        const x2   = xPos(new Date(curr.created_at).getTime());
        const y2   = yPos(curr.intensity);
        const dx   = x2 - x1;
        const dy   = y2 - y1;
        const len  = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) continue;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const cx    = (x1 + x2) / 2;
        const cy    = (y1 + y2) / 2;
        const lineStyle: ViewStyle = {
          position:  'absolute',
          left:      cx - len / 2,
          top:       cy - 0.75,
          width:     len,
          height:    1.5,
          backgroundColor: color,
          transform: [{ rotate: `${angle}deg` }],
        };
        elements.push(<View key={`line-${partId}-${i}`} style={lineStyle} />);
      }

      // Data point dots
      sorted.forEach((u, i) => {
        const dotX = xPos(new Date(u.created_at).getTime());
        const dotY = yPos(u.intensity);
        const hasIntensity = u.intensity !== null;

        if (hasIntensity) {
          elements.push(
            <Pressable
              key={`dot-${u.id}`}
              onPress={() => handleDotPress(u, dotX, dotY)}
              hitSlop={8}
              style={{
                position:        'absolute',
                left:            dotX - 5,
                top:             dotY - 5,
                width:           10,
                height:          10,
                borderRadius:    5,
                backgroundColor: color,
              }}
            />,
          );
        } else {
          elements.push(
            <Pressable
              key={`dot-${u.id}`}
              onPress={() => handleDotPress(u, dotX, dotY)}
              hitSlop={8}
              style={{
                position:        'absolute',
                left:            dotX - 5,
                top:             dotY - 5,
                width:           10,
                height:          10,
                borderRadius:    5,
                backgroundColor: 'transparent',
                borderWidth:     1.5,
                borderColor:     color,
              }}
            />,
          );
        }
      });
    });

    return elements;
  }

  // ── X-axis labels
  function renderXLabels() {
    return xLabels.map(({ label, frac }) => {
      const x = CHART_PAD_LEFT + frac * plotW;
      return (
        <Text
          key={label + frac}
          style={{
            position:  'absolute',
            left:      x - 24,
            bottom:    4,
            width:     48,
            textAlign: 'center',
            fontSize:  9,
            color:     'rgba(255,255,255,0.4)',
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      );
    });
  }

  // ── Tooltip render (outside Pressable, inside chart container)
  function renderTooltip() {
    if (!tooltip) return null;
    const ttW  = 180;
    const ttH  = 80;
    const ttX  = Math.min(Math.max(tooltip.x - ttW / 2, CHART_PAD_LEFT), chartWidth - ttW - CHART_PAD_RIGHT);
    const ttY  = tooltip.above ? tooltip.y - ttH - 12 : tooltip.y + 14;

    return (
      <View
        style={{
          position:        'absolute',
          left:            ttX,
          top:             ttY,
          width:           ttW,
          backgroundColor: '#2A2825',
          borderRadius:    10,
          padding:         10,
          shadowColor:     '#000',
          shadowOffset:    { width: 0, height: 2 },
          shadowOpacity:   0.4,
          shadowRadius:    6,
          elevation:       8,
          zIndex:          20,
        }}
        pointerEvents="none"
      >
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginBottom: 2 }} numberOfLines={1}>
          {tooltip.partName}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>
          {tooltip.date}
          {tooltip.activationType ? ` · ${tooltip.activationType}` : ''}
          {tooltip.intensity !== null ? ` · ${tooltip.intensity}/5` : ''}
        </Text>
        {tooltip.notes ? (
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 3 }} numberOfLines={2}>
            {tooltip.notes}
          </Text>
        ) : null}
      </View>
    );
  }

  // ── Legend items
  const legendItems = useMemo(() => {
    const items: { color: string; label: string }[] = [];
    const visibleIds = selectedPartIds.length > 0 ? selectedPartIds : partsWithUpdates.map((p) => p.id);
    for (const id of visibleIds) {
      const p = partsMap.get(id);
      if (p) items.push({ color: TYPE_COLOR[p.type] ?? '#6B6860', label: p.display_name });
    }
    return items;
  }, [selectedPartIds, partsWithUpdates, partsMap]);

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#1C1B19" />
        </Pressable>
        <Text style={styles.headerTitle}>Cycles</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Time range chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
          {TIME_RANGES.map((r) => (
            <Pressable
              key={r}
              onPress={() => { setTimeRange(r); setTooltip(null); }}
              style={[styles.timeChip, timeRange === r && styles.timeChipSelected]}
            >
              <Text style={[styles.timeChipText, timeRange === r && styles.timeChipTextSelected]}>{r}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Part filter */}
        {partsWithUpdates.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
            <Pressable
              onPress={() => { setSelectedPartIds([]); setTooltip(null); }}
              style={[styles.partChip, selectedPartIds.length === 0 && styles.partChipSelected]}
            >
              <Text style={[styles.partChipText, selectedPartIds.length === 0 && styles.partChipTextSelected]}>All</Text>
            </Pressable>
            {partsWithUpdates.map((p) => {
              const color    = TYPE_COLOR[p.type] ?? '#6B6860';
              const selected = selectedPartIds.includes(p.id);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => togglePart(p.id)}
                  style={[
                    styles.partChip,
                    { borderColor: color, backgroundColor: selected ? color : 'transparent' },
                  ]}
                >
                  <View style={[styles.partAvatar, { backgroundColor: selected ? '#FFFFFF' : color }]}>
                    <Text style={[styles.partAvatarText, { color: selected ? color : '#FFFFFF' }]}>
                      {getInitials(p.display_name)}
                    </Text>
                  </View>
                  <Text style={[styles.partChipText, { color: selected ? '#FFFFFF' : color }]} numberOfLines={1}>
                    {p.display_name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Chart area */}
        <View
          style={styles.chartContainer}
          onLayout={(e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width)}
        >
          {!hasAnyUpdates ? (
            // Empty state
            <View style={styles.emptyState}>
              <Ionicons name="bar-chart-outline" size={40} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyTitle}>No activation data yet</Text>
              <Text style={styles.emptyDesc}>
                Log updates for your parts to build your Cycles map over time.
              </Text>
              <Pressable
                style={styles.emptyBtn}
                onPress={() => router.push('/log-update' as any)}
              >
                <Text style={styles.emptyBtnText}>Log an Update</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.chartInner}
              onPress={handleChartPress}
            >
              {renderChart()}
              {renderXLabels()}
            </Pressable>
          )}
          {/* Tooltip rendered outside Pressable but inside chart container */}
          {hasAnyUpdates && renderTooltip()}
        </View>

        {/* No intensity hint */}
        {hasAnyUpdates && !hasIntensityRatings && (
          <Text style={styles.intensityHint}>
            Add intensity ratings when logging updates to see activation levels over time.
          </Text>
        )}

        {/* Legend */}
        {legendItems.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
            {legendItems.map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendLabel}>{item.label}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Add Context button */}
        <Pressable
          style={styles.addContextBtn}
          onPress={() => setShowAnnotationModal(true)}
        >
          <Ionicons name="add-circle-outline" size={18} color="#B88A00" />
          <Text style={styles.addContextBtnText}>Add Context</Text>
        </Pressable>

        {/* Annotations list */}
        {annotations.length > 0 && (
          <View style={styles.annotationsList}>
            {annotations.map((ann) => (
              <Pressable
                key={ann.id}
                style={styles.annotationItem}
                onLongPress={() => handleDeleteAnnotation(ann.id, ann.label)}
              >
                <View style={[styles.annotationColorDot, { backgroundColor: ann.color_hex }]} />
                <View style={styles.annotationBody}>
                  <Text style={styles.annotationLabel}>{ann.label}</Text>
                  <Text style={styles.annotationDate}>
                    {ann.start_date}{ann.end_date ? ` → ${ann.end_date}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Annotation modal */}
      <Modal visible={showAnnotationModal} animationType="slide" transparent onRequestClose={() => setShowAnnotationModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAnnotationModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Add Context Annotation</Text>

            <Text style={styles.modalLabel}>Label *</Text>
            <TextInput
              style={styles.modalInput}
              value={annLabel}
              onChangeText={setAnnLabel}
              placeholder="e.g. High stress week"
              placeholderTextColor="#A09D96"
            />

            <Text style={styles.modalLabel}>Start date</Text>
            <TextInput
              style={styles.modalInput}
              value={annStartDate}
              onChangeText={setAnnStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#A09D96"
            />

            <Text style={styles.modalLabel}>End date (optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={annEndDate}
              onChangeText={setAnnEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#A09D96"
            />

            <Text style={styles.modalLabel}>Color</Text>
            <View style={styles.colorChips}>
              {ANNOTATION_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setAnnColor(c)}
                  style={[
                    styles.colorChip,
                    { backgroundColor: c },
                    annColor === c && styles.colorChipSelected,
                  ]}
                />
              ))}
            </View>

            <Text style={styles.modalLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 60 }]}
              value={annNotes}
              onChangeText={setAnnNotes}
              placeholder="Any additional context…"
              placeholderTextColor="#A09D96"
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.modalSaveBtn, !annLabel.trim() && styles.modalSaveBtnDisabled]}
              onPress={handleSaveAnnotation}
              disabled={!annLabel.trim() || savingAnn}
            >
              <Text style={styles.modalSaveBtnText}>{savingAnn ? 'Saving…' : 'Add to Chart'}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#FAFAF8' },
  flex1: { flex: 1 },

  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor:   '#FFFFFF',
  },
  backBtn:     { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: '#1C1B19' },
  headerRight: { width: 32 },

  scrollContent: { paddingBottom: 60 },

  chipsScroll:   { flexGrow: 0 },
  chipsRow: {
    paddingHorizontal: 16,
    paddingVertical:   10,
    gap:               8,
    flexDirection:     'row',
    alignItems:        'center',
  },

  timeChip: {
    borderRadius:    24,
    borderWidth:     1,
    borderColor:     '#A09D96',
    paddingHorizontal: 14,
    paddingVertical:   6,
  },
  timeChipSelected: {
    backgroundColor: '#B88A00',
    borderColor:     '#B88A00',
  },
  timeChipText:         { fontSize: 13, fontWeight: '500', color: '#6B6860' },
  timeChipTextSelected: { color: '#FFFFFF' },

  partChip: {
    flexDirection:    'row',
    alignItems:       'center',
    borderRadius:     20,
    borderWidth:      1,
    borderColor:      '#A09D96',
    paddingHorizontal: 10,
    paddingVertical:   5,
    gap:               6,
    maxWidth:          160,
  },
  partChipSelected: {
    backgroundColor: '#1C1B19',
    borderColor:     '#1C1B19',
  },
  partChipText:         { fontSize: 12, fontWeight: '500', color: '#6B6860', flexShrink: 1 },
  partChipTextSelected: { color: '#FFFFFF' },
  partAvatar: {
    width:         18,
    height:        18,
    borderRadius:  9,
    alignItems:    'center',
    justifyContent: 'center',
  },
  partAvatarText: { fontSize: 7, fontWeight: '700' },

  chartContainer: {
    marginHorizontal: 16,
    marginVertical:    8,
    height:            CHART_HEIGHT,
    backgroundColor:   '#1A1917',
    borderRadius:      12,
    overflow:          'hidden',
  },
  chartInner: {
    flex:     1,
    position: 'relative',
  },

  // Empty state
  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    color:      '#FFFFFF',
    fontSize:   16,
    fontWeight: '600',
  },
  emptyDesc: {
    color:      'rgba(255,255,255,0.5)',
    fontSize:   13,
    textAlign:  'center',
    lineHeight: 18,
  },
  emptyBtn: {
    marginTop:       8,
    backgroundColor: '#B88A00',
    borderRadius:    20,
    paddingHorizontal: 20,
    paddingVertical:   8,
  },
  emptyBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  intensityHint: {
    marginHorizontal: 16,
    marginTop:         4,
    fontSize:          12,
    color:             '#A09D96',
    fontStyle:         'italic',
  },

  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  legendDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize:   12,
    color:      '#6B6860',
    fontWeight: '500',
  },

  addContextBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             6,
    marginHorizontal: 16,
    marginTop:       16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFBEB',
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     '#B88A00',
    alignSelf:       'flex-start',
  },
  addContextBtnText: { fontSize: 14, fontWeight: '600', color: '#B88A00' },

  annotationsList: {
    marginHorizontal: 16,
    marginTop:        12,
    gap:              8,
  },
  annotationItem: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             10,
    backgroundColor: '#FFFFFF',
    borderRadius:    10,
    padding:         12,
    borderWidth:     1,
    borderColor:     '#E5E3DE',
  },
  annotationColorDot: {
    width:        12,
    height:       12,
    borderRadius: 6,
  },
  annotationBody: { flex: 1 },
  annotationLabel: {
    fontSize:   14,
    fontWeight: '500',
    color:      '#1C1B19',
  },
  annotationDate: {
    fontSize: 12,
    color:    '#6B6860',
    marginTop: 2,
  },

  // Modal
  modalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent:  'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    gap: 8,
  },
  modalTitle: {
    fontSize:   18,
    fontWeight: '700',
    color:      '#1C1B19',
    marginBottom: 8,
  },
  modalLabel: {
    fontSize:   11,
    fontWeight: '600',
    color:      '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop:  8,
  },
  modalInput: {
    backgroundColor: '#FAFAF8',
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     '#E5E3DE',
    paddingHorizontal: 12,
    paddingVertical:   10,
    fontSize:        15,
    color:           '#1C1B19',
  },
  colorChips: {
    flexDirection: 'row',
    gap:           10,
    marginVertical: 4,
  },
  colorChip: {
    width:        28,
    height:       28,
    borderRadius: 14,
  },
  colorChipSelected: {
    borderWidth: 3,
    borderColor: '#1C1B19',
  },
  modalSaveBtn: {
    backgroundColor: '#B88A00',
    borderRadius:    14,
    padding:         14,
    alignItems:      'center',
    marginTop:       12,
  },
  modalSaveBtnDisabled: { opacity: 0.4 },
  modalSaveBtnText:     { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
