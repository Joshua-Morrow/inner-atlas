/**
 * RelationalSnapshot — static diagram of Self/part relationships from a Meeting Space session.
 * Renders Self at center with parts arranged in a circle around it.
 * Edge relationships shown as a legend below the diagram (no complex SVG/rotation needed).
 *
 * Used in technique-log.tsx when a Meeting Space session has relational_snapshot in notes_json.
 */

import { StyleSheet, Text, View } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RelationshipNode {
  id: string;
  name: string;
  partType: 'manager' | 'firefighter' | 'exile' | 'self' | 'unknown';
}

export interface RelationshipEdge {
  fromId: string;
  toId: string;
  feelings: string[];
}

interface RelationalSnapshotProps {
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
  size?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
  unknown:     '#6B6860',
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RelationalSnapshot({ nodes, edges, size = 300 }: RelationalSnapshotProps) {
  if (!nodes || nodes.length === 0) return null;

  const centerX = size / 2;
  const centerY = size / 2;
  const radius  = size / 2 - 52;

  // Self node is always centered; other nodes arranged in a circle
  const selfNode   = nodes.find((n) => n.id === 'self' || n.partType === 'self');
  const otherNodes = nodes.filter((n) => n !== selfNode);

  // Build node center coordinate map
  const centerById: Record<string, { x: number; y: number }> = {};
  if (selfNode) {
    centerById[selfNode.id] = { x: centerX, y: centerY };
  }
  otherNodes.forEach((node, index) => {
    const angle = (index / Math.max(otherNodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
    centerById[node.id] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  return (
    <View>
      {/* Diagram canvas */}
      <View style={[rs.canvas, { width: size, height: size, alignSelf: 'center' }]}>

        {/* Connection lines — rendered before nodes so nodes appear on top */}
        {edges.map((edge, i) => {
          const from = centerById[edge.fromId];
          const to   = centerById[edge.toId];
          if (!from || !to) return null;
          const dx     = to.x - from.x;
          const dy     = to.y - from.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle  = Math.atan2(dy, dx) * 180 / Math.PI;
          const midX   = from.x + dx / 2;
          const midY   = from.y + dy / 2;
          const isSelf = edge.fromId === 'self' || edge.toId === 'self';
          const feeling = (edge.feelings ?? []).filter(Boolean)[0] ?? '';
          const extra   = (edge.feelings ?? []).filter(Boolean).length - 1;
          return (
            <View key={`edge-${i}`} style={rs.edgeGroup}>
              {/* Line — centered at midpoint, rotated to connect nodes */}
              <View
                style={{
                  position: 'absolute',
                  left: midX - length / 2,
                  top:  midY - 0.75,
                  width: length,
                  height: 1.5,
                  backgroundColor: isSelf
                    ? 'rgba(184,138,0,0.45)'
                    : 'rgba(255,255,255,0.2)',
                  transform: [{ rotate: `${angle}deg` }],
                }}
              />
              {/* Arrowhead — small circle at "to" node end */}
              <View
                style={{
                  position: 'absolute',
                  left: to.x - 3,
                  top:  to.y - 3,
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: isSelf
                    ? 'rgba(184,138,0,0.5)'
                    : 'rgba(255,255,255,0.3)',
                }}
              />
              {/* Feeling label at midpoint */}
              {feeling ? (
                <Text
                  style={{
                    position: 'absolute',
                    left: midX - 30,
                    top:  midY - 8,
                    width: 60,
                    fontSize: 9,
                    color: isSelf ? 'rgba(184,138,0,0.75)' : 'rgba(255,255,255,0.45)',
                    textAlign: 'center',
                  }}
                  numberOfLines={1}
                >
                  {feeling}{extra > 0 ? ` +${extra}` : ''}
                </Text>
              ) : null}
            </View>
          );
        })}

        {/* Other nodes arranged in a circle */}
        {otherNodes.map((node, index) => {
          const angle = (index / Math.max(otherNodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          const color = TYPE_COLORS[node.partType] ?? '#6B6860';
          return (
            <View
              key={node.id}
              style={[rs.partNodeWrap, { left: x - 20, top: y - 20 }]}
            >
              <View style={[rs.partNode, { backgroundColor: color }]}>
                <Text style={rs.partNodeInitials}>{getInitials(node.name)}</Text>
              </View>
              <Text style={rs.partNodeLabel} numberOfLines={1}>{node.name}</Text>
            </View>
          );
        })}

        {/* Self node — center */}
        {selfNode && (
          <View style={[rs.selfNodeWrap, { left: centerX - 24, top: centerY - 24 }]}>
            <View style={rs.selfNode}>
              <Text style={rs.selfNodeText}>S</Text>
            </View>
            <Text style={rs.selfNodeLabel}>Self</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const rs = StyleSheet.create({
  canvas: {
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginVertical: 8,
  },
  // Part nodes
  partNodeWrap: {
    position: 'absolute',
    alignItems: 'center',
    width: 40,
  },
  partNode: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partNodeInitials: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  partNodeLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginTop: 3,
    width: 52,
    marginLeft: -6,
  },
  // Self node
  selfNodeWrap: {
    position: 'absolute',
    alignItems: 'center',
    width: 48,
  },
  selfNode: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#B88A00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B88A00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  selfNodeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  selfNodeLabel: {
    fontSize: 10,
    color: '#B88A00',
    fontWeight: '600',
    marginTop: 3,
  },
  // Edge group (lines + labels — rendered before nodes)
  edgeGroup: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
