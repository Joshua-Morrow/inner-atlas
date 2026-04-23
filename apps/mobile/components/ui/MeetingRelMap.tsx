/**
 * MeetingRelMap — SVG relational map shown before meeting rules.
 *
 * Self anchored at bottom-center as a root node. Parts arranged above via
 * force layout. Edges use boundary-clipping + obstacle routing so lines
 * terminate at node surfaces and bend around intervening nodes.
 *
 * Focus mode: tap a node to dim unrelated edges/nodes. Tap again (or the
 * canvas background) to exit.
 */

import { useMemo, useState } from 'react';
import {
  ScrollView,
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
  clipLineToNodeBoundaries,
  routeAroundObstacles,
  runLayout,
} from '@/lib/graph-layout';

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

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  relMap: RelationalMap;
  onContinue: () => void;
}

export function MeetingRelMap({ relMap, onContinue }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const canvasWidth = screenWidth - 32;

  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  // ── Layout: Self pinned at bottom, parts arranged above ───────────────────

  const { coords, canvasHeight } = useMemo(() => {
    const selfNode = relMap.nodes.find(isSelfNode);
    const baseHeight = Math.max(canvasWidth, 380);
    const extraForCount = Math.max(0, relMap.nodes.length - 6) * 35;
    const height = baseHeight + extraForCount;

    const selfX = canvasWidth / 2;
    const selfY = height - 70;
    const cx = canvasWidth / 2;
    const cy = height * 0.40;

    const layoutNodes: LayoutNode[] = relMap.nodes.map(node => {
      const self = isSelfNode(node);
      if (self) {
        return {
          id: node.id,
          radius: SELF_RADIUS + 8,
          pinX: selfX, pinY: selfY,
          x: selfX, y: selfY,
          groupKey: 'self',
        };
      }
      return {
        id: node.id,
        radius: NODE_RADIUS + 16,
        groupKey: node.partType,
      };
    });

    const layoutEdges: LayoutEdge[] = relMap.edges.map(edge => ({
      fromId: edge.fromId,
      toId: edge.toId,
      restLength: 110,
      stiffness: 0.07,
    }));

    // Synthetic Self→part edges keep the constellation above Self
    if (selfNode) {
      for (const node of relMap.nodes) {
        if (isSelfNode(node)) continue;
        layoutEdges.push({
          fromId: selfNode.id,
          toId: node.id,
          restLength: 160,
          stiffness: 0.025,
        });
      }
    }

    const result = runLayout(layoutNodes, layoutEdges, {
      width: canvasWidth,
      height,
      centerX: cx,
      centerY: cy,
      iterations: 300,
      repulsionStrength: 6500,
      centeringForce: 0.008,
    });

    const coordMap: Record<string, { x: number; y: number }> = {};
    for (const [id, pos] of result.positions) {
      coordMap[id] = pos;
    }
    return { coords: coordMap, canvasHeight: height };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relMap.nodes.length, relMap.edges.length, canvasWidth]);

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

  // ── Obstacle list for edge routing ───────────────────────────────────────

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

  // ── Render edges ─────────────────────────────────────────────────────────

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

    const fromNodeSelf = relMap.nodes.find(n => n.id === edge.fromId);
    const toNodeSelf   = relMap.nodes.find(n => n.id === edge.toId);
    const fromR = fromNodeSelf && isSelfNode(fromNodeSelf) ? SELF_RADIUS : NODE_RADIUS;
    const toR   = toNodeSelf   && isSelfNode(toNodeSelf)   ? SELF_RADIUS : NODE_RADIUS;

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
        <Circle cx={arrowX} cy={arrowY} r={4.5} fill={dotColor} opacity={edgeOpacity} />
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

  // ── Full screen render ────────────────────────────────────────────────────

  return (
    <SafeAreaView style={mrm.root} edges={['bottom']}>
      {/* Header */}
      <View style={mrm.headerWrap}>
        <Text style={mrm.headerTitle}>Before You Meet</Text>
        <Text style={mrm.headerSub}>
          Here's how the parts feel towards each other going into this meeting.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={mrm.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[mrm.canvas, { width: canvasWidth, height: canvasHeight }]}>
          {/* Background tap to clear focus — rendered first (lowest z) */}
          {focusedNodeId !== null && (
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => setFocusedNodeId(null)}
              activeOpacity={1}
            />
          )}

          {/* SVG — visual only, no touch events */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={canvasWidth} height={canvasHeight}>
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
            </Svg>
          </View>

          {/* Absolutely-positioned node touch targets — rendered last (highest z) */}
          {relMap.nodes.map(node => {
            const coord = coords[node.id];
            if (!coord) return null;
            const self = isSelfNode(node);
            const r = self ? SELF_RADIUS : NODE_RADIUS;
            return (
              <TouchableOpacity
                key={`tap-${node.id}`}
                style={{
                  position: 'absolute',
                  left: coord.x - r,
                  top: coord.y - r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: r,
                }}
                onPress={() => {
                  if (focusedNodeId === node.id) setFocusedNodeId(null);
                  else setFocusedNodeId(node.id);
                }}
                activeOpacity={0.7}
              />
            );
          })}
        </View>

        {relMap.edges.length === 0 && (
          <Text style={mrm.noEdgesHint}>No feel-towards data recorded.</Text>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    alignItems: 'center',
  },
  canvas: {
    position: 'relative',
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
    marginTop: 16,
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
