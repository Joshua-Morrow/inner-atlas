import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { FeelingEdge, MapPart, MapRelationship, savePartMapPosition } from '@/lib/database';
import {
  LayoutEdge,
  LayoutNode,
  Obstacle,
  clipLineToNodeBoundaries,
  convexHull,
  expandHull,
  hullToSmoothPath,
  routeAroundObstacles,
  runLayout,
} from '@/lib/graph-layout';
import { getNodeSize, nodeBottomY } from '@/lib/map-nodes';
import PartsMapNode from './PartsMapNode';

const SCREEN = Dimensions.get('window');
const CANVAS_CENTER_X = SCREEN.width / 2;
const CANVAS_CENTER_Y = SCREEN.height / 2;

const DEV_SHOW_HIT_AREAS = false; // flip true to debug hit areas on device

const HULL_COLORS = {
  alliance:         { fill: '#4A9B73', stroke: '#3A8A63' },
  activation_chain: { fill: '#C8A44A', stroke: '#B8943A' },
} as const;

// ─── Seed layout (radial) ─────────────────────────────────────────────────────

function computeInitialLayout(
  parts: MapPart[],
  relationships: MapRelationship[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  const selfPart = parts.find(p => p.type === 'self');
  if (selfPart) {
    positions.set(selfPart.id, { x: CANVAS_CENTER_X, y: CANVAS_CENTER_Y });
  }

  const nonSelf = parts.filter(p => p.type !== 'self');
  if (nonSelf.length === 0) return positions;

  const placed = new Set<string>(selfPart ? [selfPart.id] : []);
  const groups: string[][] = [];

  for (const rel of relationships.filter(r =>
    r.type === 'alliance' || r.type === 'activation_chain'
  )) {
    const members = rel.member_part_ids.filter(id => parts.some(p => p.id === id));
    if (members.length > 1) { groups.push(members); members.forEach(id => placed.add(id)); }
  }
  for (const rel of relationships.filter(r => r.type === 'polarization')) {
    const members = rel.member_part_ids.filter(id => !placed.has(id) && parts.some(p => p.id === id));
    if (members.length >= 2) { groups.push(members); members.forEach(id => placed.add(id)); }
  }
  for (const part of nonSelf) {
    if (!placed.has(part.id)) { groups.push([part.id]); placed.add(part.id); }
  }

  const CANVAS_DIAG = Math.hypot(SCREEN.width, SCREEN.height);
  const BASE_RING_RADIUS = CANVAS_DIAG * 0.28;
  const RING_SPACING     = CANVAS_DIAG * 0.22;
  const GROUP_MEMBER_SPREAD = 65;
  const totalGroups = groups.length;

  groups.forEach((group, groupIndex) => {
    const angle = (2 * Math.PI * groupIndex) / totalGroups - Math.PI / 2;
    const ring = Math.floor(groupIndex / Math.max(1, Math.ceil(totalGroups / 2)));
    const ringRadius = BASE_RING_RADIUS + ring * RING_SPACING;
    const gcx = CANVAS_CENTER_X + Math.cos(angle) * ringRadius;
    const gcy = CANVAS_CENTER_Y + Math.sin(angle) * ringRadius;

    if (group.length === 1) {
      positions.set(group[0], { x: gcx, y: gcy });
    } else {
      const spreadAngle =
        (2 * Math.PI * group.length * GROUP_MEMBER_SPREAD) / (2 * Math.PI * ringRadius);
      group.forEach((id, mi) => {
        const ma = angle + spreadAngle * (mi - (group.length - 1) / 2);
        const mr = ringRadius * 0.85;
        positions.set(id, {
          x: CANVAS_CENTER_X + Math.cos(ma) * mr,
          y: CANVAS_CENTER_Y + Math.sin(ma) * mr,
        });
      });
    }
  });

  return positions;
}

// ─── Force layout ─────────────────────────────────────────────────────────────

function computeForceLayout(
  parts: MapPart[],
  relationships: MapRelationship[],
  existingPositions: Map<string, { x: number; y: number }>,
): Map<string, { x: number; y: number }> {
  const layoutNodes: LayoutNode[] = parts.map(part => {
    const intensity = part.intensity ?? 5;
    const radius = getNodeSize(part.type, intensity) + 45;
    const isSelf = part.type === 'self' || part.id === '__self__';

    if (isSelf) {
      return {
        id: part.id, radius,
        pinX: CANVAS_CENTER_X, pinY: CANVAS_CENTER_Y,
        x: CANVAS_CENTER_X, y: CANVAS_CENTER_Y,
        groupKey: 'self',
      };
    }

    if (part.position_x != null && part.position_y != null) {
      return {
        id: part.id, radius,
        pinX: part.position_x, pinY: part.position_y,
        x: part.position_x, y: part.position_y,
        groupKey: part.type,
      };
    }

    const seed = existingPositions.get(part.id);
    return { id: part.id, radius, x: seed?.x, y: seed?.y, groupKey: part.type };
  });

  const layoutEdges: LayoutEdge[] = [];
  for (const rel of relationships) {
    if (rel.type === 'activation_chain') {
      // Sequential pairs only — strong attraction to keep chain tight
      for (let i = 0; i < rel.member_part_ids.length - 1; i++) {
        layoutEdges.push({
          fromId: rel.member_part_ids[i],
          toId: rel.member_part_ids[i + 1],
          restLength: 90,
          stiffness: 0.09,
        });
      }
    } else if (rel.type === 'alliance') {
      // All pairs — attract strongly to form a visible cluster
      for (let i = 0; i < rel.member_part_ids.length; i++) {
        for (let j = i + 1; j < rel.member_part_ids.length; j++) {
          layoutEdges.push({
            fromId: rel.member_part_ids[i],
            toId: rel.member_part_ids[j],
            restLength: 95,
            stiffness: 0.07,
          });
        }
      }
    } else if (rel.type === 'polarization') {
      for (let i = 0; i < rel.member_part_ids.length; i++) {
        for (let j = i + 1; j < rel.member_part_ids.length; j++) {
          layoutEdges.push({
            fromId: rel.member_part_ids[i],
            toId: rel.member_part_ids[j],
            restLength: 260,
            stiffness: 0.035,
          });
        }
      }
    } else {
      // protective, other
      for (let i = 0; i < rel.member_part_ids.length; i++) {
        for (let j = i + 1; j < rel.member_part_ids.length; j++) {
          layoutEdges.push({
            fromId: rel.member_part_ids[i],
            toId: rel.member_part_ids[j],
            restLength: 140,
            stiffness: 0.06,
          });
        }
      }
    }
  }

  const result = runLayout(layoutNodes, layoutEdges, {
    width: SCREEN.width,
    height: SCREEN.height,
    centerX: CANVAS_CENTER_X,
    centerY: CANVAS_CENTER_Y,
    iterations: 400,
    repulsionStrength: 28000,
    centeringForce: 0.002,
    initialTemperature: 60,
  });

  return result.positions;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function feelingLabel(feelings: string[]): string {
  if (!feelings || feelings.length === 0) return '';
  if (feelings.length === 1) return feelings[0];
  if (feelings.length === 2) return `${feelings[0]}, ${feelings[1]}`;
  return `${feelings[0]}, ${feelings[1]} +${feelings.length - 2}`;
}

function aabbOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return (
    ax - aw / 2 < bx + bw / 2 &&
    ax + aw / 2 > bx - bw / 2 &&
    ay - ah / 2 < by + bh / 2 &&
    ay + ah / 2 > by - bh / 2
  );
}

function pushControlPointAwayFromSelf(
  cpx: number, cpy: number,
  selfX: number, selfY: number,
  clearance: number,
): { cpx: number; cpy: number } {
  const dx = cpx - selfX;
  const dy = cpy - selfY;
  const dist = Math.hypot(dx, dy) || 1;
  if (dist >= clearance) return { cpx, cpy };
  const push = clearance - dist;
  return { cpx: cpx + (dx / dist) * push, cpy: cpy + (dy / dist) * push };
}

function buildEdgePath(
  x1: number, y1: number,
  x2: number, y2: number,
  waypoints: Array<{ x: number; y: number }>,
  cpx: number, cpy: number,
): string {
  if (waypoints.length === 0) {
    // Cubic bezier — two control points for more natural curve
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = cpx - mx;
    const dy = cpy - my;
    const cp1x = x1 * 0.5 + mx * 0.5 + dx * 0.6;
    const cp1y = y1 * 0.5 + my * 0.5 + dy * 0.6;
    const cp2x = x2 * 0.5 + mx * 0.5 + dx * 0.6;
    const cp2y = y2 * 0.5 + my * 0.5 + dy * 0.6;
    return `M ${x1.toFixed(1)},${y1.toFixed(1)} C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  if (waypoints.length === 1) {
    const wp = waypoints[0];
    // Cubic through waypoint
    const cp1x = x1 * 0.3 + wp.x * 0.7;
    const cp1y = y1 * 0.3 + wp.y * 0.7;
    const cp2x = x2 * 0.3 + wp.x * 0.7;
    const cp2y = y2 * 0.3 + wp.y * 0.7;
    return `M ${x1.toFixed(1)},${y1.toFixed(1)} C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  // 2 waypoints — S-curve
  const mx = (waypoints[0].x + waypoints[1].x) / 2;
  const my = (waypoints[0].y + waypoints[1].y) / 2;
  return [
    `M ${x1.toFixed(1)},${y1.toFixed(1)}`,
    `Q ${waypoints[0].x.toFixed(1)},${waypoints[0].y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`,
    `Q ${waypoints[1].x.toFixed(1)},${waypoints[1].y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`,
  ].join(' ');
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EdgeSpec {
  fromId: string;
  toId: string;
  relType: string;
  relId: string;
}

interface Props {
  parts: MapPart[];
  relationships: MapRelationship[];
  feelingEdges: FeelingEdge[];
  viewMode: 'atlas' | 'feelings' | 'combined';
  selectedPartId: string | null;
  focusedPartId?: string | null;
  onPartPress: (part: MapPart | null) => void;
  onHasCustomPositionsChange: (has: boolean) => void;
  layoutResetKey?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PartsMapCanvas({
  parts,
  relationships,
  feelingEdges,
  viewMode,
  selectedPartId,
  focusedPartId,
  onPartPress,
  onHasCustomPositionsChange,
  layoutResetKey,
}: Props) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.75);
  const [draggingPartId, setDraggingPartId] = useState<string | null>(null);
  const [dragTick, setDragTick] = useState(0);

  const panRef               = useRef({ x: 0, y: 0 });
  const scaleRef             = useRef(0.75);
  const draggingPartIdRef    = useRef<string | null>(null);
  const dragStartPos         = useRef<{ x: number; y: number } | null>(null);
  const lastPan              = useRef({ x: 0, y: 0 });
  const lastScale            = useRef(0.75);
  const lastTouchDist        = useRef<number | null>(null);
  const isDragging           = useRef(false);
  const wasPinching          = useRef(false);
  const longPressTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partsRef             = useRef<MapPart[]>(parts);
  const onPartPressRef       = useRef(onPartPress);
  const onHasCustomRef       = useRef(onHasCustomPositionsChange);
  const nodePositions        = useRef<Map<string, { x: number; y: number }>>(new Map());
  const prevResetKey         = useRef<number | undefined>(undefined);

  useEffect(() => { partsRef.current = parts; }, [parts]);
  useEffect(() => { onPartPressRef.current = onPartPress; }, [onPartPress]);
  useEffect(() => { onHasCustomRef.current = onHasCustomPositionsChange; }, [onHasCustomPositionsChange]);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  // Position initialization — seed + force layout
  useEffect(() => {
    const isReset =
      layoutResetKey !== undefined &&
      prevResetKey.current !== undefined &&
      layoutResetKey !== prevResetKey.current;
    prevResetKey.current = layoutResetKey;

    if (isReset) nodePositions.current.clear();

    const computed = computeInitialLayout(parts, relationships);
    for (const part of parts) {
      if (!isReset && part.position_x != null && part.position_y != null) {
        nodePositions.current.set(part.id, { x: part.position_x, y: part.position_y });
      } else if (!nodePositions.current.has(part.id)) {
        const cp = computed.get(part.id);
        if (cp) nodePositions.current.set(part.id, cp);
      }
    }

    const forcePositions = computeForceLayout(parts, relationships, nodePositions.current);
    for (const [id, pos] of forcePositions) {
      nodePositions.current.set(id, pos);
    }

    const hasCustom = parts.some(p => p.position_x != null && p.id !== '__self__');
    onHasCustomRef.current(hasCustom);
    setDragTick(t => t + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutResetKey, parts, relationships]);

  // ── Connected parts for focus mode ───────────────────────────────────────────

  const connectedPartIds = useMemo(() => {
    if (!focusedPartId) return null;
    const set = new Set<string>([focusedPartId]);
    for (const rel of relationships) {
      if (rel.member_part_ids.includes(focusedPartId)) {
        rel.member_part_ids.forEach(id => set.add(id));
      }
    }
    for (const fe of feelingEdges) {
      if (fe.from_part_id === focusedPartId) set.add(fe.to_part_id);
      if (fe.to_part_id === focusedPartId) set.add(fe.from_part_id);
    }
    return set;
  }, [focusedPartId, relationships, feelingEdges]);

  // ── PanResponder ─────────────────────────────────────────────────────────────

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2,

      onPanResponderGrant: (evt) => {
        lastPan.current = { ...panRef.current };
        lastScale.current = scaleRef.current;
        wasPinching.current = false;
        isDragging.current = false;
        lastTouchDist.current = null;

        const touchX = evt.nativeEvent.pageX;
        const touchY = evt.nativeEvent.pageY;
        longPressTimer.current = setTimeout(() => {
          const cx = (touchX - lastPan.current.x) / lastScale.current;
          const cy = (touchY - lastPan.current.y) / lastScale.current;
          let hit: MapPart | null = null;
          let minNorm = Infinity;
          for (const part of partsRef.current) {
            const pos = nodePositions.current.get(part.id);
            if (!pos) continue;
            const size = getNodeSize(part.type, part.intensity ?? 5);
            const hitCenterY = part.type === 'firefighter'
              ? pos.y + size * 0.15
              : pos.y;
            const hitRadiusY = part.type === 'firefighter'
              ? size * 1.15
              : size;
            const ddx = cx - pos.x;
            const ddy = cy - hitCenterY;
            const normalized = Math.hypot(ddx / size, ddy / hitRadiusY);
            if (normalized < 0.9 && normalized < minNorm) { minNorm = normalized; hit = part; }
          }
          if (hit) {
            draggingPartIdRef.current = hit.id;
            setDraggingPartId(hit.id);
            dragStartPos.current = { ...(nodePositions.current.get(hit.id) ?? { x: 0, y: 0 }) };
          }
        }, 420);
      },

      onPanResponderMove: (evt, gs) => {
        const touches = evt.nativeEvent.touches as unknown as Array<{ pageX: number; pageY: number }>;

        if (longPressTimer.current && (Math.abs(gs.dx) > 8 || Math.abs(gs.dy) > 8)) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        if (draggingPartIdRef.current && dragStartPos.current) {
          const newX = dragStartPos.current.x + gs.dx / lastScale.current;
          const newY = dragStartPos.current.y + gs.dy / lastScale.current;
          nodePositions.current.set(draggingPartIdRef.current, { x: newX, y: newY });
          setDragTick(t => t + 1);
          return;
        }

        if (touches.length === 2) {
          wasPinching.current = true;
          const dist = Math.hypot(
            touches[1].pageX - touches[0].pageX,
            touches[1].pageY - touches[0].pageY,
          );
          const mid = {
            x: (touches[0].pageX + touches[1].pageX) / 2,
            y: (touches[0].pageY + touches[1].pageY) / 2,
          };
          if (lastTouchDist.current !== null) {
            const scaleDelta = dist / lastTouchDist.current;
            const newScale = Math.min(3, Math.max(0.35, lastScale.current * scaleDelta));
            const ratio = newScale / lastScale.current;
            const newPanX = mid.x - (mid.x - lastPan.current.x) * ratio;
            const newPanY = mid.y - (mid.y - lastPan.current.y) * ratio;
            panRef.current = { x: newPanX, y: newPanY };
            scaleRef.current = newScale;
            setPan({ x: newPanX, y: newPanY });
            setScale(newScale);
            lastScale.current = newScale;
            lastPan.current = { x: newPanX, y: newPanY };
          }
          lastTouchDist.current = dist;
        } else if (touches.length === 1 && !wasPinching.current) {
          const newPan = {
            x: lastPan.current.x + gs.dx,
            y: lastPan.current.y + gs.dy,
          };
          panRef.current = newPan;
          setPan(newPan);
          isDragging.current = true;
        }
      },

      onPanResponderRelease: async (_, gs) => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        if (draggingPartIdRef.current) {
          const partId = draggingPartIdRef.current;
          if (partId !== '__self__') {
            const pos = nodePositions.current.get(partId);
            if (pos) {
              await savePartMapPosition(partId, pos.x, pos.y);
              onHasCustomRef.current(true);
            }
          }
          draggingPartIdRef.current = null;
          setDraggingPartId(null);
          dragStartPos.current = null;
          lastTouchDist.current = null;
          return;
        }

        lastTouchDist.current = null;

        const totalMove = Math.hypot(gs.dx, gs.dy);
        if (totalMove < 10 && !wasPinching.current) {
          const touchX = (gs.moveX !== 0 || gs.moveY !== 0) ? gs.moveX : gs.x0;
          const touchY = (gs.moveX !== 0 || gs.moveY !== 0) ? gs.moveY : gs.y0;
          const canvasX = (touchX - panRef.current.x) / scaleRef.current;
          const canvasY = (touchY - panRef.current.y) / scaleRef.current;

          let closest: MapPart | null = null;
          let closestNorm = Infinity;
          for (const part of partsRef.current) {
            const pos = nodePositions.current.get(part.id);
            if (!pos) continue;
            const size = getNodeSize(part.type, part.intensity ?? 5);
            const hitCenterY = part.type === 'firefighter'
              ? pos.y + size * 0.15
              : pos.y;
            const hitRadiusY = part.type === 'firefighter'
              ? size * 1.15
              : size;
            const ddx = canvasX - pos.x;
            const ddy = canvasY - hitCenterY;
            const normalized = Math.hypot(ddx / size, ddy / hitRadiusY);
            if (normalized < 1.0 && normalized < closestNorm) { closestNorm = normalized; closest = part; }
          }

          if (__DEV__) {
            console.log('[HitTest]', {
              canvasX: canvasX.toFixed(1),
              canvasY: canvasY.toFixed(1),
              closest: closest?.display_name ?? 'none',
              closestNorm: closestNorm.toFixed(3),
            });
          }

          if (closest) onPartPressRef.current(closest);
          else onPartPressRef.current(null);
        }

        wasPinching.current = false;
        lastPan.current = { ...panRef.current };
        lastScale.current = scaleRef.current;
      },
    }),
  ).current;

  // ── Edges: structural + feeling + focus dimming + label collision avoidance ───

  const edges = useMemo(() => {
    // Build obstacle list for routing — Self gets inflated radius for routing clearance
    const obstacles: Obstacle[] = [];
    for (const part of parts) {
      const pos = nodePositions.current.get(part.id);
      if (!pos) continue;
      const visualR = getNodeSize(part.type, part.intensity ?? 5);
      const isSelf = part.type === 'self' || part.id === '__self__';
      obstacles.push({
        id: part.id,
        x: pos.x,
        y: pos.y,
        radius: isSelf ? visualR + 35 : visualR,
      });
    }

    // Self position for control-point push
    const selfPartForCP = parts.find(p => p.type === 'self' || p.id === '__self__');
    const selfPosForCP = selfPartForCP ? nodePositions.current.get(selfPartForCP.id) : null;
    const selfClearance = selfPartForCP
      ? getNodeSize(selfPartForCP.type, selfPartForCP.intensity ?? 5) + 45
      : 0;

    // Build edge specs — sequential pairs for activation_chain, all-pairs for others
    const specs: EdgeSpec[] = [];
    for (const rel of relationships) {
      if (rel.type === 'activation_chain') {
        for (let i = 0; i < rel.member_part_ids.length - 1; i++) {
          specs.push({
            fromId: rel.member_part_ids[i],
            toId:   rel.member_part_ids[i + 1],
            relType: rel.type,
            relId: rel.id,
          });
        }
      } else if (rel.type === 'polarization') {
        const sideA = rel.member_part_ids.filter((_, i) => rel.member_sides[i] === 'a');
        const sideB = rel.member_part_ids.filter((_, i) => rel.member_sides[i] === 'b');
        const nullSide = rel.member_part_ids.filter((_, i) => !rel.member_sides[i]);

        if (sideA.length === 0 || sideB.length === 0) {
          // Fallback: old all-pairs if sides not recorded
          for (let i = 0; i < rel.member_part_ids.length; i++) {
            for (let j = i + 1; j < rel.member_part_ids.length; j++) {
              specs.push({ fromId: rel.member_part_ids[i], toId: rel.member_part_ids[j], relType: rel.type, relId: rel.id });
            }
          }
        } else if (sideA.length === 1 && sideB.length === 1) {
          specs.push({ fromId: sideA[0], toId: sideB[0], relType: rel.type, relId: rel.id });
        } else if (sideA.length === 1) {
          for (const b of sideB) {
            specs.push({ fromId: sideA[0], toId: b, relType: rel.type, relId: rel.id });
          }
        } else if (sideB.length === 1) {
          for (const a of sideA) {
            specs.push({ fromId: a, toId: sideB[0], relType: rel.type, relId: rel.id });
          }
        } else {
          // Group vs group — nearest representative of each side
          const centroid = (ids: string[]) => {
            const positions = ids.map(id => nodePositions.current.get(id)).filter(Boolean) as { x: number; y: number }[];
            if (positions.length === 0) return null;
            return { x: positions.reduce((s, p) => s + p.x, 0) / positions.length, y: positions.reduce((s, p) => s + p.y, 0) / positions.length };
          };
          const nearestTo = (ids: string[], target: { x: number; y: number }) => {
            let best = ids[0];
            let bestDist = Infinity;
            for (const id of ids) {
              const pos = nodePositions.current.get(id);
              if (!pos) continue;
              const d = Math.hypot(pos.x - target.x, pos.y - target.y);
              if (d < bestDist) { bestDist = d; best = id; }
            }
            return best;
          };
          const ca = centroid(sideA);
          const cb = centroid(sideB);
          if (ca && cb) {
            const repA = nearestTo(sideA, cb);
            const repB = nearestTo(sideB, ca);
            specs.push({ fromId: repA, toId: repB, relType: rel.type, relId: rel.id });
          }
        }
        // Null-side members (old data): connect to nearest other member
        for (const id of nullSide) {
          if (rel.member_part_ids.length > 1) {
            const other = rel.member_part_ids.find(x => x !== id);
            if (other) specs.push({ fromId: id, toId: other, relType: rel.type, relId: rel.id });
          }
        }
      } else {
        for (let i = 0; i < rel.member_part_ids.length; i++) {
          for (let j = i + 1; j < rel.member_part_ids.length; j++) {
            specs.push({
              fromId: rel.member_part_ids[i],
              toId:   rel.member_part_ids[j],
              relType: rel.type,
              relId: rel.id,
            });
          }
        }
      }
    }

    const pairGroups = new Map<string, EdgeSpec[]>();
    for (const s of specs) {
      const key = [s.fromId, s.toId].sort().join('||');
      if (!pairGroups.has(key)) pairGroups.set(key, []);
      pairGroups.get(key)!.push(s);
    }

    const PARALLEL_OFFSET = 9;
    const structuralBaseOpacity =
      viewMode === 'atlas'    ? 0.8 :
      viewMode === 'combined' ? 0.5 :
                                0.25;
    const elements: React.ReactElement[] = [];

    // ── Group hulls — rendered beneath edges and nodes ───────────────────────
    const hullElements: React.ReactElement[] = [];

    for (const rel of relationships) {
      if (rel.type !== 'alliance' && rel.type !== 'activation_chain') continue;

      const memberPositions = rel.member_part_ids
        .map(id => {
          const pos = nodePositions.current.get(id);
          if (!pos) return null;
          const part = parts.find(p => p.id === id);
          const r = part ? getNodeSize(part.type, part.intensity ?? 5) : 22;
          return Array.from({ length: 8 }, (_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            return { x: pos.x + Math.cos(angle) * r, y: pos.y + Math.sin(angle) * r };
          });
        })
        .filter(Boolean)
        .flat() as Array<{ x: number; y: number }>;

      if (memberPositions.length < 3) continue;

      const hull = convexHull(memberPositions);
      const expanded = expandHull(hull, 18);
      const pathD = hullToSmoothPath(expanded, 0.35);
      if (!pathD) continue;

      const colors = HULL_COLORS[rel.type as keyof typeof HULL_COLORS];
      if (!colors) continue;

      let hullOpacity = viewMode === 'atlas' ? 1 : 0.25;
      if (focusedPartId) {
        const anyMemberFocused = rel.member_part_ids.some(
          id => id === focusedPartId || connectedPartIds?.has(id),
        );
        hullOpacity = anyMemberFocused ? hullOpacity : 0.15;
      }

      hullElements.push(
        <G key={`hull-${rel.id}`} opacity={hullOpacity}>
          {/* Glow effect — slightly larger, more transparent */}
          <Path
            d={pathD}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={6}
            strokeOpacity={0.12}
            strokeLinejoin="round"
          />
          {/* Fill */}
          <Path
            d={pathD}
            fill={colors.fill}
            fillOpacity={0.07}
            stroke="none"
          />
          {/* Stroke */}
          <Path
            d={pathD}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={2}
            strokeOpacity={0.45}
            strokeLinejoin="round"
          />
        </G>,
      );
    }

    // ── Structural edges ──────────────────────────────────────────────────────
    pairGroups.forEach((group) => {
      group.forEach((spec, idx) => {
        const posA = nodePositions.current.get(spec.fromId);
        const posB = nodePositions.current.get(spec.toId);
        if (!posA || !posB) return;

        const isAlliance     = spec.relType === 'alliance';
        const isPolarization = spec.relType === 'polarization';
        const isChain        = spec.relType === 'activation_chain';
        const isProtective   = spec.relType === 'protective';
        const color =
          isAlliance     ? '#2D6A4F' :
          isPolarization ? '#991B1B' :
          isChain        ? '#B88A00' :
          isProtective   ? '#5B7FB8' :
                           '#6B6860';
        const dash  = isPolarization ? '7,4' : isChain ? '3,4' : undefined;
        const strokeW = isAlliance ? 2.5 : isProtective ? 2.5 : 2;

        let opacity = structuralBaseOpacity;
        if (focusedPartId) {
          const connected =
            spec.fromId === focusedPartId || spec.toId === focusedPartId ||
            (connectedPartIds?.has(spec.fromId) && connectedPartIds?.has(spec.toId));
          opacity = connected ? structuralBaseOpacity : 0.08;
        }

        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const len = Math.hypot(dx, dy) || 1;
        const perpX = -dy / len;
        const perpY = dx / len;
        const offset = (idx - (group.length - 1) / 2) * PARALLEL_OFFSET;
        const ox = perpX * offset;
        const oy = perpY * offset;

        const ax = posA.x + ox, ay = posA.y + oy;
        const bx = posB.x + ox, by = posB.y + oy;

        const fromPart = parts.find(p => p.id === spec.fromId);
        const toPart   = parts.find(p => p.id === spec.toId);
        const fromR = fromPart ? getNodeSize(fromPart.type, fromPart.intensity ?? 5) : 22;
        const toR   = toPart   ? getNodeSize(toPart.type,   toPart.intensity   ?? 5) : 22;
        const clipped = clipLineToNodeBoundaries(ax, ay, fromR, bx, by, toR);

        const waypoints = routeAroundObstacles(
          clipped.x1, clipped.y1, clipped.x2, clipped.y2,
          spec.fromId, spec.toId, obstacles, 16,
        );

        const mx = (clipped.x1 + clipped.x2) / 2;
        const my = (clipped.y1 + clipped.y2) / 2;
        const curveOff = Math.min(len * 0.18, 35);
        let { cpx, cpy } = { cpx: mx + perpX * curveOff, cpy: my + perpY * curveOff };
        if (selfPosForCP && selfClearance > 0) {
          ({ cpx, cpy } = pushControlPointAwayFromSelf(cpx, cpy, selfPosForCP.x, selfPosForCP.y, selfClearance));
        }

        const pathD = buildEdgePath(clipped.x1, clipped.y1, clipped.x2, clipped.y2, waypoints, cpx, cpy);

        // Alliance edges: hull communicates the group — skip line rendering
        if (isAlliance) return;

        elements.push(
          <Path
            key={`sp-${spec.relId}-${idx}`}
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeDasharray={dash}
            strokeOpacity={opacity}
            strokeLinecap="round"
          />,
        );

        // Arrowhead for activation chains — shows direction
        if (isChain) {
          const t = 0.85;
          let arrowX: number, arrowY: number;
          if (waypoints.length === 0) {
            arrowX = (1-t)*(1-t)*clipped.x1 + 2*(1-t)*t*cpx + t*t*clipped.x2;
            arrowY = (1-t)*(1-t)*clipped.y1 + 2*(1-t)*t*cpy + t*t*clipped.y2;
          } else if (waypoints.length === 1) {
            arrowX = waypoints[0].x + t * (clipped.x2 - waypoints[0].x);
            arrowY = waypoints[0].y + t * (clipped.y2 - waypoints[0].y);
          } else {
            const mxWp = (waypoints[0].x + waypoints[1].x) / 2;
            const myWp = (waypoints[0].y + waypoints[1].y) / 2;
            arrowX = mxWp + t * (clipped.x2 - mxWp);
            arrowY = myWp + t * (clipped.y2 - myWp);
          }
          elements.push(
            <Circle
              key={`ca-${spec.relId}-${idx}`}
              cx={arrowX}
              cy={arrowY}
              r={4.5}
              fill={color}
              opacity={opacity}
            />,
          );
        }
      });
    });

    // ── Feeling edges (feelings + combined modes) ─────────────────────────────
    const showFeelingEdges = viewMode === 'feelings' || viewMode === 'combined';
    if (showFeelingEdges) {
      const edgeColor = '#9B7A4A';
      const arrowR = 4.5;
      const BIDIR_OFFSET = 7;
      const LBL_H = 13;
      const placedLabels: Array<{ x: number; y: number; w: number; h: number }> = [];

      feelingEdges.forEach((fe, feIdx) => {
        const posA = nodePositions.current.get(fe.from_part_id);
        const posB = nodePositions.current.get(fe.to_part_id);
        if (!posA || !posB) return;

        const feelings: string[] = (() => {
          try { return JSON.parse(fe.feelings_json) as string[]; }
          catch { return []; }
        })();
        if (feelings.length === 0) return;

        const edgeConnected =
          !focusedPartId ||
          fe.from_part_id === focusedPartId ||
          fe.to_part_id === focusedPartId;
        const edgeOpacity = edgeConnected
          ? (viewMode === 'combined' ? 0.65 : 0.85)
          : 0.06;

        const reverseExists = feelingEdges.some(
          e => e.from_part_id === fe.to_part_id && e.to_part_id === fe.from_part_id,
        );

        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const len = Math.hypot(dx, dy) || 1;
        const perpX = -dy / len;
        const perpY = dx / len;

        const ox = perpX * BIDIR_OFFSET * (reverseExists ? 1 : 0);
        const oy = perpY * BIDIR_OFFSET * (reverseExists ? 1 : 0);

        const ax = posA.x + ox, ay = posA.y + oy;
        const bx = posB.x + ox, by = posB.y + oy;

        const fromPartFE = parts.find(p => p.id === fe.from_part_id);
        const toPartFE   = parts.find(p => p.id === fe.to_part_id);
        const fromRFE = fromPartFE ? getNodeSize(fromPartFE.type, fromPartFE.intensity ?? 5) : 22;
        const toRFE   = toPartFE   ? getNodeSize(toPartFE.type,   toPartFE.intensity   ?? 5) : 22;
        const clippedFE = clipLineToNodeBoundaries(ax, ay, fromRFE, bx, by, toRFE);

        const waypointsFE = routeAroundObstacles(
          clippedFE.x1, clippedFE.y1, clippedFE.x2, clippedFE.y2,
          fe.from_part_id, fe.to_part_id, obstacles, 16,
        );

        const mxFE = (clippedFE.x1 + clippedFE.x2) / 2;
        const myFE = (clippedFE.y1 + clippedFE.y2) / 2;
        const curveOff = Math.min(len * 0.15, 28);
        const curveMult = reverseExists ? 1.5 : 1;
        let { cpx, cpy } = { cpx: mxFE + perpX * curveOff * curveMult, cpy: myFE + perpY * curveOff * curveMult };
        if (selfPosForCP && selfClearance > 0) {
          ({ cpx, cpy } = pushControlPointAwayFromSelf(cpx, cpy, selfPosForCP.x, selfPosForCP.y, selfClearance));
        }

        const pathD = buildEdgePath(clippedFE.x1, clippedFE.y1, clippedFE.x2, clippedFE.y2, waypointsFE, cpx, cpy);

        const t = 0.85;
        let arrowX: number, arrowY: number;
        if (waypointsFE.length === 0) {
          arrowX = (1-t)*(1-t)*clippedFE.x1 + 2*(1-t)*t*cpx + t*t*clippedFE.x2;
          arrowY = (1-t)*(1-t)*clippedFE.y1 + 2*(1-t)*t*cpy + t*t*clippedFE.y2;
        } else if (waypointsFE.length === 1) {
          arrowX = waypointsFE[0].x + t * (clippedFE.x2 - waypointsFE[0].x);
          arrowY = waypointsFE[0].y + t * (clippedFE.y2 - waypointsFE[0].y);
        } else {
          const mxWp = (waypointsFE[0].x + waypointsFE[1].x) / 2;
          const myWp = (waypointsFE[0].y + waypointsFE[1].y) / 2;
          arrowX = mxWp + t * (clippedFE.x2 - mxWp);
          arrowY = myWp + t * (clippedFE.y2 - myWp);
        }

        const label = feelingLabel(feelings);
        let labelX: number, labelY: number;
        if (waypointsFE.length === 0) {
          labelX = ax / 4 + cpx / 2 + bx / 4;
          labelY = ay / 4 + cpy / 2 + by / 4 - (reverseExists ? 10 : 6);
        } else if (waypointsFE.length === 1) {
          labelX = waypointsFE[0].x;
          labelY = waypointsFE[0].y - 10;
        } else {
          labelX = (waypointsFE[0].x + waypointsFE[1].x) / 2;
          labelY = (waypointsFE[0].y + waypointsFE[1].y) / 2 - 10;
        }
        const labelW = Math.max(label.length * 6, 20);

        if (edgeConnected && label) {
          const perpNX = perpX;
          const perpNY = perpY;
          for (let attempt = 0; attempt < 6; attempt++) {
            const sign = attempt % 2 === 0 ? 1 : -1;
            const mag = Math.floor(attempt / 2 + 1) * 14;
            if (attempt > 0) {
              labelX += perpNX * sign * mag;
              labelY += perpNY * sign * mag;
            }
            let overlap = false;
            for (const pl of placedLabels) {
              if (aabbOverlap(labelX, labelY, labelW, LBL_H, pl.x, pl.y, pl.w, pl.h)) {
                overlap = true;
                break;
              }
            }
            if (!overlap) {
              for (const part of partsRef.current) {
                const np = nodePositions.current.get(part.id);
                if (!np) continue;
                const nodeClearance = getNodeSize(part.type, part.intensity ?? 5) + 8 + LBL_H / 2;
                if (Math.hypot(labelX - np.x, labelY - np.y) < nodeClearance) {
                  overlap = true;
                  break;
                }
              }
            }
            if (!overlap) break;
          }
          placedLabels.push({ x: labelX, y: labelY, w: labelW, h: LBL_H });
        }

        const showLabel = edgeConnected && label.length > 0;

        elements.push(
          <G key={`fe-${feIdx}`}>
            <Path
              d={pathD}
              fill="none"
              stroke={edgeColor}
              strokeWidth={1.8}
              strokeOpacity={edgeOpacity}
              strokeLinecap="round"
            />
            <Circle
              cx={arrowX}
              cy={arrowY}
              r={arrowR}
              fill={edgeColor}
              opacity={edgeOpacity}
            />
            {showLabel && (
              <>
                <Rect
                  x={labelX - labelW / 2}
                  y={labelY - 7}
                  width={labelW}
                  height={LBL_H}
                  rx={3}
                  fill="#1A1917"
                  fillOpacity={0.85}
                />
                <SvgText
                  x={labelX}
                  y={labelY + 2}
                  textAnchor="middle"
                  fontSize={9}
                  fill={edgeColor}
                  fontWeight="500"
                >
                  {label}
                </SvgText>
              </>
            )}
          </G>,
        );
      });
    }

    return [...hullElements, ...elements];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationships, feelingEdges, viewMode, dragTick, focusedPartId, connectedPartIds, parts]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Svg
        width={SCREEN.width}
        height={SCREEN.height}
        viewBox={`0 0 ${SCREEN.width} ${SCREEN.height}`}
      >
        <Rect x={0} y={0} width={SCREEN.width} height={SCREEN.height} fill="#1A1917" />

        <G transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {edges}
          {parts.map((part) => {
            const pos = nodePositions.current.get(part.id);
            if (!pos) return null;
            const dimmed = !!connectedPartIds && !connectedPartIds.has(part.id);
            return (
              <PartsMapNode
                key={part.id}
                part={part}
                x={pos.x}
                y={pos.y}
                isSelected={selectedPartId === part.id}
                isDragging={draggingPartId === part.id}
                dimmed={dimmed}
              />
            );
          })}
          {DEV_SHOW_HIT_AREAS && parts.map(part => {
            const pos = nodePositions.current.get(part.id);
            if (!pos) return null;
            const size = getNodeSize(part.type, part.intensity ?? 5);
            const hitCenterY = part.type === 'firefighter' ? pos.y + size * 0.15 : pos.y;
            const hitRadiusY = part.type === 'firefighter' ? size * 1.15 : size;
            return (
              <Ellipse
                key={`hit-${part.id}`}
                cx={pos.x}
                cy={hitCenterY}
                rx={size}
                ry={hitRadiusY}
                fill="none"
                stroke="#FF0000"
                strokeWidth={1.5}
                strokeOpacity={0.7}
                strokeDasharray="4,3"
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1917' },
});
