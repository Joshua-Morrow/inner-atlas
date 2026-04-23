/**
 * relational-map.ts — data model for the Meeting Space relational map.
 *
 * RelationalMap is held in local state in technique-session.tsx and passed
 * through the feel-towards sequence. Saved in notes_json as `relational_map`
 * at session end.
 */

export type MapNodePartType = 'manager' | 'firefighter' | 'exile' | 'self' | 'unknown';

export interface MapNode {
  id: string;              // part id or 'self'
  name: string;            // display_name or 'Self'
  partType: MapNodePartType;
  addedDuringSession: boolean; // true if added via unblend during the session
}

export interface MapEdge {
  fromId: string;
  toId: string;
  feelings: string[];      // selected chip labels
  isSelfLike: boolean;     // true if any FEEL_TOWARDS_SELF_LIKE chips selected
}

export interface RelationalMap {
  nodes: MapNode[];
  edges: MapEdge[];
}

/** Replace an existing edge (same fromId+toId) or append a new one. */
export function addOrReplaceEdge(map: RelationalMap, edge: MapEdge): RelationalMap {
  const idx = map.edges.findIndex(
    (e) => e.fromId === edge.fromId && e.toId === edge.toId,
  );
  const newEdges =
    idx >= 0
      ? map.edges.map((e, i) => (i === idx ? edge : e))
      : [...map.edges, edge];
  return { ...map, edges: newEdges };
}
