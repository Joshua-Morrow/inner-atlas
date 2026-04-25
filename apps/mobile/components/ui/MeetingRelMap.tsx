/**
 * MeetingRelMap — SVG relational map shown before meeting rules.
 *
 * Self anchored at bottom-center as a root node. Parts arranged above via
 * force layout. Edges use boundary-clipping + obstacle routing so lines
 * terminate at node surfaces and bend around intervening nodes.
 *
 * Focus mode: tap a node to dim unrelated edges/nodes. Tap again (or the
 * canvas background) to exit. Pan/zoom via PanResponder.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { RelationalMap } from '@/lib/relational-map';
import {
  LayoutEdge,
  LayoutNode,
  Obstacle,
  arrowheadPath,
  bezierTangentAngle,
  clipLineToNodeBoundaries,
  routeAroundObstacles,
  runLayout,
} from '@/lib/graph-layout';

// ── DEV: set true to show layout tuning panel on device ──────────────────────
const SHOW_DEV_TUNING = false; // flip to true when tuning

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_RADIUS = 22;
const SELF_RADIUS = 28;

const TYPE_COLOR: Record<string, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
  unknown:     '#6B6860',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function buildEdgePath(
  x1: number, y1: number,
  x2: number, y2: number,
  waypoints: Array<{ x: number; y: number }>,
  cpx: number, cpy: number,
): string {
  if (waypoints.length === 0) {
    return `M ${x1.toFixed(1)},${y1.toFixed(1)} Q ${cpx.toFixed(1)},${cpy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  if (waypoints.length === 1) {
    const wp = waypoints[0];
    return `M ${x1.toFixed(1)},${y1.toFixed(1)} Q ${wp.x.toFixed(1)},${wp.y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  const mx = (waypoints[0].x + waypoints[1].x) / 2;
  const my = (waypoints[0].y + waypoints[1].y) / 2;
  return [
    `M ${x1.toFixed(1)},${y1.toFixed(1)}`,
    `Q ${waypoints[0].x.toFixed(1)},${waypoints[0].y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`,
    `Q ${waypoints[1].x.toFixed(1)},${waypoints[1].y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`,
  ].join(' ');
}

function isSelfNode(node: RelationalMap['nodes'][number]): boolean {
  return node.id === 'self' || node.partType === 'self';
}

function extractCubicCP(pathD: string): {
  cp1x: number; cp1y: number; cp2x: number; cp2y: number;
  x0: number; y0: number; x1: number; y1: number;
} | null {
  const m = pathD.match(
    /M\s*([\d.\-]+),([\d.\-]+)\s+C\s*([\d.\-]+),([\d.\-]+)\s+([\d.\-]+),([\d.\-]+)\s+([\d.\-]+),([\d.\-]+)/,
  );
  if (!m) return null;
  return {
    x0:   parseFloat(m[1]), y0:   parseFloat(m[2]),
    cp1x: parseFloat(m[3]), cp1y: parseFloat(m[4]),
    cp2x: parseFloat(m[5]), cp2y: parseFloat(m[6]),
    x1:   parseFloat(m[7]), y1:   parseFloat(m[8]),
  };
}

// ─── Dev tuning stepper ───────────────────────────────────────────────────────

function DevSlider({
  label, value, min, max, step, onChange, onRelease,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onRelease: () => void;
}) {
  return (
    <View style={devStyles.sliderRow}>
      <Text style={devStyles.sliderLabel}>{label}</Text>
      <TouchableOpacity
        style={devStyles.stepBtn}
        onPress={() => { onChange(Math.max(min, parseFloat((value - step).toFixed(4)))); onRelease(); }}
        activeOpacity={0.7}
      >
        <Text style={devStyles.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={devStyles.sliderValue}>{value.toFixed(value < 1 ? 3 : 0)}</Text>
      <TouchableOpacity
        style={devStyles.stepBtn}
        onPress={() => { onChange(Math.min(max, parseFloat((value + step).toFixed(4)))); onRelease(); }}
        activeOpacity={0.7}
      >
        <Text style={devStyles.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  relMap: RelationalMap;
  onContinue: () => void;
}

export function MeetingRelMap({ relMap, onContinue }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const canvasWidth = screenWidth - 32;

  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mapScale, setMapScale] = useState(1);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Dev tuning state — no-op when SHOW_DEV_TUNING = false
  const [devRepulsion,  setDevRepulsion]  = useState(18000);
  const [devCentering,  setDevCentering]  = useState(0.003);
  const [devSelfRest,   setDevSelfRest]   = useState(0.45);
  const [devEdgeRest,   setDevEdgeRest]   = useState(130);
  const [devEdgeStiff,  setDevEdgeStiff]  = useState(0.04);
  const [devSelfStiff,  setDevSelfStiff]  = useState(0.015);
  const [devNodeRadius, setDevNodeRadius] = useState(35);
  const [devSelfRadius, setDevSelfRadius] = useState(30);
  const [devIterations, setDevIterations] = useState(500);
  const [devKey, setDevKey] = useState(0);

  const panRef           = useRef({ x: 0, y: 0 });
  const scaleRef         = useRef(1);
  const lastPan          = useRef({ x: 0, y: 0 });
  const lastScale        = useRef(1);
  const lastTouchDist    = useRef<number | null>(null);
  const wasPinching      = useRef(false);
  const canvasOffsetRef  = useRef({ x: 0, y: 0 });
  const canvasViewRef    = useRef<View>(null);
  const coordsRef        = useRef<Record<string, { x: number; y: number }>>({});
  const focusedNodeIdRef = useRef<string | null>(null);
  const nodesRef         = useRef(relMap.nodes);

  // Keep refs up-to-date on each render
  nodesRef.current = relMap.nodes;

  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { scaleRef.current = mapScale; }, [mapScale]);
  useEffect(() => { focusedNodeIdRef.current = focusedNodeId; }, [focusedNodeId]);

  // ── Canvas sizing ─────────────────────────────────────────────────────────

  // Fixed portrait canvas — fills available screen space cleanly
  const baseCanvasHeight = Math.round(canvasWidth * 1.45 * 0.7);
  const canvasHeight = relMap.nodes.length > 8 ? baseCanvasHeight * 2 : baseCanvasHeight;
  const viewportHeight = baseCanvasHeight;

  // ── Layout: Self pinned at bottom, parts spread above ────────────────────

  const coords = useMemo(() => {
    const selfNode = relMap.nodes.find(isSelfNode);
    const selfX = canvasWidth / 2;
    const selfY = canvasHeight - 90;
    const cx = canvasWidth / 2;
    const cy = canvasHeight * 0.35;

    const useRepulsion  = SHOW_DEV_TUNING ? devRepulsion  : 36000;
    const useCentering  = SHOW_DEV_TUNING ? devCentering  : 0.003;
    const useSelfRest   = SHOW_DEV_TUNING ? devSelfRest   : 0.45;
    const useEdgeRest   = SHOW_DEV_TUNING ? devEdgeRest   : 130;
    const useEdgeStiff  = SHOW_DEV_TUNING ? devEdgeStiff  : 0.04;
    const useSelfStiff  = SHOW_DEV_TUNING ? devSelfStiff  : 0.015;
    const useNodeR      = SHOW_DEV_TUNING ? devNodeRadius : 35;
    const useSelfR      = SHOW_DEV_TUNING ? devSelfRadius : 30;
    const useIterations = SHOW_DEV_TUNING ? devIterations : 500;

    const layoutNodes: LayoutNode[] = relMap.nodes.map(node => {
      const self = isSelfNode(node);
      if (self) {
        return {
          id: node.id,
          radius: SELF_RADIUS + useSelfR,
          pinX: selfX, pinY: selfY,
          x: selfX, y: selfY,
          groupKey: 'self',
        };
      }
      return {
        id: node.id,
        radius: NODE_RADIUS + useNodeR,
        groupKey: node.partType,
      };
    });

    const layoutEdges: LayoutEdge[] = relMap.edges.map(edge => ({
      fromId: edge.fromId,
      toId: edge.toId,
      restLength: useEdgeRest,
      stiffness: useEdgeStiff,
    }));

    if (selfNode) {
      for (const node of relMap.nodes) {
        if (isSelfNode(node)) continue;
        layoutEdges.push({
          fromId: selfNode.id,
          toId: node.id,
          restLength: canvasHeight * useSelfRest,
          stiffness: useSelfStiff,
        });
      }
    }

    const result = runLayout(layoutNodes, layoutEdges, {
      width: canvasWidth,
      height: canvasHeight,
      centerX: cx,
      centerY: cy,
      iterations: useIterations,
      repulsionStrength: useRepulsion,
      centeringForce: useCentering,
      groupAttraction: 0.0003,
    });

    const coordMap: Record<string, { x: number; y: number }> = {};
    for (const [id, pos] of result.positions) {
      coordMap[id] = pos;
    }
    coordsRef.current = coordMap;
    return coordMap;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, SHOW_DEV_TUNING
    ? [relMap.nodes.length, relMap.edges.length, canvasWidth, devKey]
    : [relMap.nodes.length, relMap.edges.length, canvasWidth]);

  // ── Connected nodes for focus mode ────────────────────────────────────────

  const connectedNodeIds = useMemo(() => {
    if (!focusedNodeId) return null;
    const set = new Set<string>([focusedNodeId]);
    for (const edge of relMap.edges) {
      if (edge.fromId === focusedNodeId) set.add(edge.toId);
      if (edge.toId === focusedNodeId) set.add(edge.fromId);
    }
    return set;
  }, [focusedNodeId, relMap.edges]);

  // ── Obstacle list for edge routing ────────────────────────────────────────

  const obstacles: Obstacle[] = relMap.nodes.flatMap(node => {
    const coord = coords[node.id];
    if (!coord) return [];
    return [{
      id: node.id,
      x: coord.x,
      y: coord.y,
      radius: isSelfNode(node) ? SELF_RADIUS : NODE_RADIUS,
    }];
  });

  // ── PanResponder ──────────────────────────────────────────────────────────

  const mapPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2,

    onPanResponderGrant: () => {
      lastPan.current = { ...panRef.current };
      lastScale.current = scaleRef.current;
      wasPinching.current = false;
      lastTouchDist.current = null;
    },

    onPanResponderMove: (evt, gs) => {
      const touches = evt.nativeEvent.touches as unknown as Array<{ pageX: number; pageY: number }>;
      if (touches.length === 2) {
        wasPinching.current = true;
        const dist = Math.hypot(
          touches[1].pageX - touches[0].pageX,
          touches[1].pageY - touches[0].pageY,
        );
        const mid = {
          x: (touches[0].pageX + touches[1].pageX) / 2 - canvasOffsetRef.current.x,
          y: (touches[0].pageY + touches[1].pageY) / 2 - canvasOffsetRef.current.y,
        };
        if (lastTouchDist.current !== null) {
          const scaleDelta = dist / lastTouchDist.current;
          const newScale = Math.min(2.5, Math.max(0.4, lastScale.current * scaleDelta));
          const ratio = newScale / lastScale.current;
          const newPanX = mid.x - (mid.x - lastPan.current.x) * ratio;
          const newPanY = mid.y - (mid.y - lastPan.current.y) * ratio;
          panRef.current = { x: newPanX, y: newPanY };
          scaleRef.current = newScale;
          setPan({ x: newPanX, y: newPanY });
          setMapScale(newScale);
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
      }
    },

    onPanResponderRelease: (_, gs) => {
      lastTouchDist.current = null;
      const totalMove = Math.hypot(gs.dx, gs.dy);

      if (totalMove < 10 && !wasPinching.current) {
        setHasInteracted(true);
        // Convert screen touch to canvas coordinates
        const rawX = (gs.moveX !== 0 || gs.moveY !== 0) ? gs.moveX : gs.x0;
        const rawY = (gs.moveX !== 0 || gs.moveY !== 0) ? gs.moveY : gs.y0;
        const localX = rawX - canvasOffsetRef.current.x;
        const localY = rawY - canvasOffsetRef.current.y;
        const canvasX = (localX - panRef.current.x) / scaleRef.current;
        const canvasY = (localY - panRef.current.y) / scaleRef.current;

        // Hit-test nodes
        let hitId: string | null = null;
        for (const node of nodesRef.current) {
          const coord = coordsRef.current[node.id];
          if (!coord) continue;
          const r = isSelfNode(node) ? SELF_RADIUS : NODE_RADIUS;
          if (Math.hypot(canvasX - coord.x, canvasY - coord.y) <= r * 1.2) {
            hitId = node.id;
            break;
          }
        }

        const currentFocused = focusedNodeIdRef.current;
        setFocusedNodeId(hitId ? (currentFocused === hitId ? null : hitId) : null);
      }

      lastPan.current = { ...panRef.current };
      lastScale.current = scaleRef.current;
      wasPinching.current = false;
    },
  })).current;

  // ── Render edges ──────────────────────────────────────────────────────────

  const edgeElements = relMap.edges.map((edge, i) => {
    const from = coords[edge.fromId];
    const to   = coords[edge.toId];
    if (!from || !to) return null;

    const selfEdge = edge.fromId === 'self' || edge.toId === 'self';
    const hasReverse = relMap.edges.some(e => e.fromId === edge.toId && e.toId === edge.fromId);
    const perpOff = hasReverse ? 4 : 0;

    const edgeConnected = !focusedNodeId || edge.fromId === focusedNodeId || edge.toId === focusedNodeId;
    const edgeOpacity = edgeConnected ? (selfEdge ? 0.85 : 0.55) : 0.1;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;

    const fx = from.x + perpX * perpOff, fy = from.y + perpY * perpOff;
    const tx = to.x + perpX * perpOff,   ty = to.y + perpY * perpOff;

    const fromNode = relMap.nodes.find(n => n.id === edge.fromId);
    const toNode   = relMap.nodes.find(n => n.id === edge.toId);
    const fromR = fromNode && isSelfNode(fromNode) ? SELF_RADIUS : NODE_RADIUS;
    const toR   = toNode   && isSelfNode(toNode)   ? SELF_RADIUS : NODE_RADIUS;

    const clipped = clipLineToNodeBoundaries(fx, fy, fromR, tx, ty, toR);
    const waypoints = routeAroundObstacles(
      clipped.x1, clipped.y1, clipped.x2, clipped.y2,
      edge.fromId, edge.toId, obstacles, 10,
    );

    const midX = (clipped.x1 + clipped.x2) / 2;
    const midY = (clipped.y1 + clipped.y2) / 2;
    const curveOff = Math.min(len * 0.12, 22);
    const cpx = midX + perpX * curveOff;
    const cpy = midY + perpY * curveOff;

    const pathD = buildEdgePath(clipped.x1, clipped.y1, clipped.x2, clipped.y2, waypoints, cpx, cpy);

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

    const label = edge.feelings.filter(Boolean)[0] ?? '';
    const extraCount = edge.feelings.filter(Boolean).length - 1;
    const labelText = label + (extraCount > 0 ? ` +${extraCount}` : '');
    const labelW = Math.max(labelText.length * 6.5, 24);

    const strokeColor = selfEdge ? 'rgba(184,138,0,0.85)' : 'rgba(255,255,255,0.55)';
    const dotColor    = selfEdge ? '#B88A00' : 'rgba(255,255,255,0.75)';

    return (
      <G key={`edge-${i}`}>
        <Path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.8}
          strokeOpacity={edgeOpacity}
          strokeLinecap="round"
        />
        <Path
          d={(() => {
            const cb = extractCubicCP(pathD);
            const angleDeg = cb
              ? bezierTangentAngle(cb.x0, cb.y0, cb.cp1x, cb.cp1y, cb.cp2x, cb.cp2y, cb.x1, cb.y1, 0.85)
              : Math.atan2(clipped.y2 - clipped.y1, clipped.x2 - clipped.x1) * (180 / Math.PI);
            return arrowheadPath(arrowX, arrowY, angleDeg, 6);
          })()}
          fill={dotColor}
          opacity={edgeOpacity}
        />
        {label.length > 0 && edgeConnected && (
          <>
            <Rect
              x={midX - labelW / 2}
              y={midY - 8}
              width={labelW}
              height={14}
              rx={3}
              fill="#1A1917"
              fillOpacity={0.9}
            />
            <SvgText
              x={midX}
              y={midY + 3}
              textAnchor="middle"
              fontSize={9}
              fontWeight="600"
              fill={selfEdge ? '#B88A00' : 'rgba(255,255,255,0.85)'}
            >
              {labelText}
            </SvgText>
          </>
        )}
      </G>
    );
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={mrm.root} edges={['bottom']}>
      {/* Header */}
      <View style={mrm.headerWrap}>
        <Text style={mrm.headerTitle}>Before You Meet</Text>
        <Text style={mrm.headerSub}>
          Here's how the parts feel towards each other going into this meeting.
        </Text>
      </View>

      {/* Canvas area */}
      <View style={mrm.canvasOuter}>
        <View
          ref={canvasViewRef}
          style={[mrm.canvas, { width: canvasWidth, height: viewportHeight }]}
          onLayout={() => {
            canvasViewRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
              canvasOffsetRef.current = { x: pageX, y: pageY };
            });
          }}
          {...mapPanResponder.panHandlers}
        >
          <Svg width={canvasWidth} height={viewportHeight}>
            <G transform={`translate(${pan.x}, ${pan.y}) scale(${mapScale})`}>
              {/* Edges */}
              {edgeElements}

              {/* Nodes */}
              {relMap.nodes.map(node => {
                const coord = coords[node.id];
                if (!coord) return null;
                const self = isSelfNode(node);
                const r = self ? SELF_RADIUS : NODE_RADIUS;
                const color = TYPE_COLOR[node.partType] ?? '#6B6860';
                const dimmed = !!connectedNodeIds && !connectedNodeIds.has(node.id);
                const nodeOpacity = dimmed ? 0.3 : 1;
                const initials = self ? 'S' : getInitials(node.name);
                const labelStr = node.name.length > 10 ? node.name.slice(0, 9) + '…' : node.name;

                return (
                  <G key={node.id} opacity={nodeOpacity}>
                    {self && (
                      <Circle
                        cx={coord.x}
                        cy={coord.y}
                        r={r + 6}
                        fill="none"
                        stroke="#B88A00"
                        strokeOpacity={0.4}
                        strokeWidth={3}
                      />
                    )}
                    <Circle
                      cx={coord.x}
                      cy={coord.y}
                      r={r}
                      fill={self ? '#B88A00' : color}
                    />
                    <SvgText
                      x={coord.x}
                      y={coord.y + (self ? 5 : 4)}
                      textAnchor="middle"
                      fontSize={self ? 16 : 12}
                      fontWeight="700"
                      fill="#FFFFFF"
                    >
                      {initials}
                    </SvgText>
                    <SvgText
                      x={coord.x}
                      y={coord.y + r + 13}
                      textAnchor="middle"
                      fontSize={self ? 10 : 9}
                      fontWeight={self ? '600' : '400'}
                      fill={self ? '#B88A00' : 'rgba(255,255,255,0.55)'}
                    >
                      {labelStr}
                    </SvgText>
                    {node.addedDuringSession && !self && (
                      <Circle cx={coord.x + r - 2} cy={coord.y - r + 2} r={5} fill="#22C55E" />
                    )}
                  </G>
                );
              })}
            </G>
          </Svg>
        </View>

        {/* No edges hint */}
        {relMap.edges.length === 0 && (
          <Text style={mrm.noEdgesHint}>No feel-towards data recorded.</Text>
        )}

        {/* Pan/zoom hint — shown when many nodes, hidden after first interaction */}
        {relMap.nodes.length > 3 && !hasInteracted && (
          <Text style={mrm.panHint}>pinch to zoom · drag to pan</Text>
        )}
      </View>

      {/* Dev tuning panel */}
      {SHOW_DEV_TUNING && (
        <View style={devStyles.panel}>
          <Text style={devStyles.panelTitle}>⚙ Layout Tuning</Text>

          <DevSlider label="Repulsion" value={devRepulsion}
            min={2000} max={40000} step={500}
            onChange={setDevRepulsion} onRelease={() => setDevKey(k => k + 1)} />

          <DevSlider label="Centering" value={devCentering}
            min={0.001} max={0.02} step={0.001}
            onChange={setDevCentering} onRelease={() => setDevKey(k => k + 1)} />

          <DevSlider label="Self rest (×height)" value={devSelfRest}
            min={0.1} max={0.8} step={0.05}
            onChange={setDevSelfRest} onRelease={() => setDevKey(k => k + 1)} />

          <DevSlider label="Self stiffness" value={devSelfStiff}
            min={0.005} max={0.08} step={0.005}
            onChange={setDevSelfStiff} onRelease={() => setDevKey(k => k + 1)} />

          <DevSlider label="Edge rest" value={devEdgeRest}
            min={50} max={300} step={10}
            onChange={setDevEdgeRest} onRelease={() => setDevKey(k => k + 1)} />

          <DevSlider label="Edge stiffness" value={devEdgeStiff}
            min={0.01} max={0.15} step={0.01}
            onChange={setDevEdgeStiff} onRelease={() => setDevKey(k => k + 1)} />

          <DevSlider label="Node radius +" value={devNodeRadius}
            min={10} max={80} step={5}
            onChange={setDevNodeRadius} onRelease={() => setDevKey(k => k + 1)} />

          <DevSlider label="Self radius +" value={devSelfRadius}
            min={10} max={80} step={5}
            onChange={setDevSelfRadius} onRelease={() => setDevKey(k => k + 1)} />

          <DevSlider label="Iterations" value={devIterations}
            min={100} max={1000} step={50}
            onChange={setDevIterations} onRelease={() => setDevKey(k => k + 1)} />

          <Text style={devStyles.readout}>
            {`repulsion: ${devRepulsion} | centering: ${devCentering.toFixed(3)}\n` +
             `selfRest: ${(devSelfRest * canvasHeight).toFixed(0)}px | selfStiff: ${devSelfStiff}\n` +
             `edgeRest: ${devEdgeRest} | edgeStiff: ${devEdgeStiff}\n` +
             `nodeR+: ${devNodeRadius} | selfR+: ${devSelfRadius} | iter: ${devIterations}`}
          </Text>
        </View>
      )}

      {/* Continue button */}
      <View style={mrm.footer}>
        <TouchableOpacity style={mrm.continueBtn} onPress={onContinue} activeOpacity={0.85}>
          <Text style={mrm.continueBtnText}>Continue to meeting rules</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const mrm = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A1917',
  },
  headerWrap: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  headerSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 21,
  },
  canvasOuter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
  },
  canvas: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  noEdgesHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  panHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1917',
  },
  continueBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

const devStyles = StyleSheet.create({
  panel: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B88A00',
    marginBottom: 6,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    width: 110,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#2A2927',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 20,
  },
  sliderValue: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    width: 48,
    textAlign: 'center',
  },
  readout: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 8,
    lineHeight: 16,
  },
});
