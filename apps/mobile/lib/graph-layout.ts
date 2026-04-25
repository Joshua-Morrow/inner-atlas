/**
 * Force-directed graph layout — Fruchterman-Reingold with collision constraints.
 *
 * Pinned nodes (Self, dragged parts) are immovable anchors — other nodes feel
 * repulsion from them but they never move themselves. Group attraction provides
 * loose type clustering (managers near managers, exiles near exiles, etc.).
 * The function is synchronous, pure, and deterministic given the same inputs
 * and initial positions.
 *
 * Forces each iteration:
 *   1. Repulsion (Coulomb-like) — every pair pushes apart
 *   2. Spring attraction (Hooke's law) — edges pull endpoints together
 *   3. Centering — gentle pull toward canvas center
 *   4. Group attraction — very weak pull among same-type nodes
 *   5. Collision resolution — guarantees no node-on-node overlap
 *
 * Cooling schedule: temperature decreases linearly from initialTemperature → 1.
 * Convergence: break early when total kinetic energy < nodes.length * 0.1.
 */

export interface LayoutNode {
  id: string;
  /** Collision radius — node visual size + label allowance. */
  radius: number;
  /** If set, node is locked here (Self, dragged parts). */
  pinX?: number;
  pinY?: number;
  /** Optional starting position (seed for simulation). */
  x?: number;
  y?: number;
  /** Nodes with the same groupKey are gently attracted together. */
  groupKey?: string;
}

export interface LayoutEdge {
  fromId: string;
  toId: string;
  /** Spring rest length in canvas units. Default 140. */
  restLength?: number;
  /** Spring stiffness 0..1. Default 0.05. */
  stiffness?: number;
}

export interface LayoutOptions {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  /** Simulation iterations. Default 300. */
  iterations?: number;
  /** Initial cooling temperature. Default min(width,height)/10. */
  initialTemperature?: number;
  /** Repulsion strength. Default 8000. Higher = more spread. */
  repulsionStrength?: number;
  /** Centering force coefficient. Default 0.005. */
  centeringForce?: number;
  /** Group attraction coefficient. Default 0.0008. */
  groupAttraction?: number;
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  converged: boolean;
  iterationsRun: number;
}

export function runLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutOptions,
): LayoutResult {
  const {
    width,
    height,
    centerX,
    centerY,
    iterations = 300,
    repulsionStrength = 8000,
    centeringForce = 0.005,
    groupAttraction = 0.0008,
  } = options;

  const initialTemperature =
    options.initialTemperature ?? Math.min(width, height) / 10;
  const convergenceThreshold = nodes.length * 0.1;

  // ── Internal working state ────────────────────────────────────────────────
  interface NS {
    id: string;
    x: number;
    y: number;
    radius: number;
    pinned: boolean;
    groupKey?: string;
  }

  const states: NS[] = nodes.map((n) => {
    const pinned = n.pinX !== undefined && n.pinY !== undefined;
    return {
      id: n.id,
      x: pinned
        ? n.pinX!
        : (n.x ?? centerX + (Math.random() - 0.5) * width * 0.5),
      y: pinned
        ? n.pinY!
        : (n.y ?? centerY + (Math.random() - 0.5) * height * 0.5),
      radius: n.radius,
      pinned,
      groupKey: n.groupKey,
    };
  });

  const idxById = new Map<string, number>();
  states.forEach((s, i) => idxById.set(s.id, i));

  let converged = false;
  let iterationsRun = 0;

  for (let iter = 0; iter < iterations; iter++) {
    const temp = initialTemperature * (1 - iter / iterations) + 1;
    const fdx = new Float64Array(states.length);
    const fdy = new Float64Array(states.length);

    // 1. Repulsion — O(n²) Coulomb
    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const si = states[i];
        const sj = states[j];
        let ddx = si.x - sj.x;
        let ddy = si.y - sj.y;
        const dist = Math.hypot(ddx, ddy) || 0.01;
        const raw = repulsionStrength / (dist * dist);
        const force = Math.min(raw, temp * 2);
        const fx = (ddx / dist) * force;
        const fy = (ddy / dist) * force;
        if (!si.pinned) { fdx[i] += fx; fdy[i] += fy; }
        if (!sj.pinned) { fdx[j] -= fx; fdy[j] -= fy; }
      }
    }

    // 2. Spring attraction along edges (Hooke's law — negative when too close)
    for (const edge of edges) {
      const ai = idxById.get(edge.fromId);
      const bi = idxById.get(edge.toId);
      if (ai === undefined || bi === undefined) continue;
      const sa = states[ai];
      const sb = states[bi];
      const rl = edge.restLength ?? 140;
      const k  = edge.stiffness ?? 0.05;
      const ddx = sb.x - sa.x;
      const ddy = sb.y - sa.y;
      const dist = Math.hypot(ddx, ddy) || 0.01;
      const force = k * (dist - rl);
      const fx = (ddx / dist) * force;
      const fy = (ddy / dist) * force;
      if (!sa.pinned) { fdx[ai] += fx; fdy[ai] += fy; }
      if (!sb.pinned) { fdx[bi] -= fx; fdy[bi] -= fy; }
    }

    // 3. Centering — pull toward canvas center
    for (let i = 0; i < states.length; i++) {
      if (states[i].pinned) continue;
      fdx[i] += (centerX - states[i].x) * centeringForce;
      fdy[i] += (centerY - states[i].y) * centeringForce;
    }

    // 4. Group attraction — same groupKey, very weak
    if (groupAttraction > 0) {
      const gc = new Map<string, { sx: number; sy: number; n: number }>();
      for (const s of states) {
        if (!s.groupKey) continue;
        const c = gc.get(s.groupKey) ?? { sx: 0, sy: 0, n: 0 };
        c.sx += s.x; c.sy += s.y; c.n++;
        gc.set(s.groupKey, c);
      }
      for (let i = 0; i < states.length; i++) {
        const s = states[i];
        if (s.pinned || !s.groupKey) continue;
        const c = gc.get(s.groupKey);
        if (!c || c.n <= 1) continue;
        fdx[i] += (c.sx / c.n - s.x) * groupAttraction;
        fdy[i] += (c.sy / c.n - s.y) * groupAttraction;
      }
    }

    // 5. Apply displacement (capped at temperature) + soft boundary
    let energy = 0;
    for (let i = 0; i < states.length; i++) {
      if (states[i].pinned) continue;
      const mag = Math.hypot(fdx[i], fdy[i]) || 0;
      const scale = mag > 0 ? Math.min(mag, temp) / mag : 0;
      const mx = fdx[i] * scale;
      const my = fdy[i] * scale;
      states[i].x += mx;
      states[i].y += my;
      energy += mx * mx + my * my;

      // Soft boundary — clamp with a tiny random jitter to avoid pile-ups
      const r = states[i].radius;
      if (states[i].x < r)         states[i].x = r + Math.random() * 2;
      if (states[i].x > width - r)  states[i].x = width - r - Math.random() * 2;
      if (states[i].y < r)         states[i].y = r + Math.random() * 2;
      if (states[i].y > height - r) states[i].y = height - r - Math.random() * 2;
    }

    // 6. Collision resolution — push overlapping nodes apart
    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const si = states[i];
        const sj = states[j];
        const minD = si.radius + sj.radius + 8;
        const ddx = sj.x - si.x;
        const ddy = sj.y - si.y;
        const dist = Math.hypot(ddx, ddy) || 0.01;
        if (dist < minD) {
          const push = (minD - dist) / 2;
          const nx = ddx / dist;
          const ny = ddy / dist;
          if (!si.pinned) { si.x -= nx * push; si.y -= ny * push; }
          if (!sj.pinned) { sj.x += nx * push; sj.y += ny * push; }
        }
      }
    }

    iterationsRun++;
    if (energy < convergenceThreshold) {
      converged = true;
      break;
    }
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const s of states) {
    positions.set(s.id, { x: s.x, y: s.y });
  }

  return { positions, converged, iterationsRun };
}

// ─── Edge geometry helpers ────────────────────────────────────────────────────

export function clipLineToNodeBoundaries(
  fromX: number, fromY: number, fromRadius: number,
  toX: number,   toY: number,   toRadius: number,
): { x1: number; y1: number; x2: number; y2: number; length: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: fromX + ux * fromRadius,
    y1: fromY + uy * fromRadius,
    x2: toX   - ux * toRadius,
    y2: toY   - uy * toRadius,
    length: Math.max(0, len - fromRadius - toRadius),
  };
}

export interface Obstacle {
  x: number;
  y: number;
  radius: number;
  id: string;
}

export function routeAroundObstacles(
  x1: number, y1: number,
  x2: number, y2: number,
  fromId: string, toId: string,
  obstacles: Obstacle[],
  padding: number = 8,
): Array<{ x: number; y: number }> {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return [];

  const ux = dx / len;
  const uy = dy / len;
  const perpX = -uy;
  const perpY =  ux;

  const intersecting: Array<{ obs: Obstacle; t: number }> = [];
  for (const obs of obstacles) {
    if (obs.id === fromId || obs.id === toId) continue;
    const ox = obs.x - x1;
    const oy = obs.y - y1;
    const t = (ox * ux + oy * uy) / len;
    if (t <= 0.08 || t >= 0.92) continue;
    const px = x1 + ux * t * len;
    const py = y1 + uy * t * len;
    const perpDist = Math.hypot(obs.x - px, obs.y - py);
    if (perpDist < obs.radius + padding * 0.9) {
      intersecting.push({ obs, t });
    }
  }
  if (intersecting.length === 0) return [];

  intersecting.sort((a, b) => a.t - b.t);

  let chosen = intersecting;
  if (intersecting.length > 2) {
    chosen = intersecting
      .map(o => ({ ...o, distFromMid: Math.abs(o.t - 0.5) }))
      .sort((a, b) => a.distFromMid - b.distFromMid)
      .slice(0, 2)
      .sort((a, b) => a.t - b.t);
  }

  return chosen.map(({ obs, t }) => {
    const px = x1 + ux * t * len;
    const py = y1 + uy * t * len;
    const offsetX = obs.x - px;
    const offsetY = obs.y - py;
    const side = (offsetX * perpX + offsetY * perpY) >= 0 ? 1 : -1;
    const push = obs.radius + padding;
    return {
      x: obs.x + perpX * side * push,
      y: obs.y + perpY * side * push,
    };
  });
}

// ─── Convex hull + SVG blob helpers ──────────────────────────────────────────

/**
 * Computes the convex hull of a set of 2D points using Jarvis march.
 * Returns points in counter-clockwise order.
 * Returns all points if count <= 3 (already a hull).
 */
export function convexHull(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (points.length <= 3) return [...points];

  // Find leftmost point
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].x < points[start].x) start = i;
  }

  const hull: Array<{ x: number; y: number }> = [];
  let current = start;

  do {
    hull.push(points[current]);
    let next = (current + 1) % points.length;
    for (let i = 0; i < points.length; i++) {
      // Cross product to find most counter-clockwise point
      const cross =
        (points[next].x - points[current].x) * (points[i].y - points[current].y) -
        (points[next].y - points[current].y) * (points[i].x - points[current].x);
      if (cross < 0) next = i;
    }
    current = next;
  } while (current !== start && hull.length <= points.length);

  return hull;
}

/**
 * Expands a convex hull outward by `padding` pixels from the centroid.
 * Used to give the group hull visual breathing room around its nodes.
 */
export function expandHull(
  hull: Array<{ x: number; y: number }>,
  padding: number,
): Array<{ x: number; y: number }> {
  if (hull.length === 0) return hull;
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
  return hull.map(p => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    return {
      x: p.x + (dx / dist) * padding,
      y: p.y + (dy / dist) * padding,
    };
  });
}

/**
 * Converts a hull polygon to a smooth SVG path using cubic bezier curves.
 * tension: 0 = straight lines, 0.3–0.5 = natural smooth blob.
 */
export function hullToSmoothPath(
  hull: Array<{ x: number; y: number }>,
  tension: number = 0.4,
): string {
  const n = hull.length;
  if (n < 2) return '';
  if (n === 2) {
    return `M ${hull[0].x.toFixed(1)},${hull[0].y.toFixed(1)} ` +
           `L ${hull[1].x.toFixed(1)},${hull[1].y.toFixed(1)} Z`;
  }

  // Wrapping point accessor — avoids mixed-indexing bugs
  const pt = (i: number) => hull[((i % n) + n) % n];

  let d = `M ${pt(0).x.toFixed(1)},${pt(0).y.toFixed(1)}`;

  for (let i = 0; i < n; i++) {
    const p0 = pt(i - 1); // previous
    const p1 = pt(i);     // start of this segment
    const p2 = pt(i + 1); // end of this segment
    const p3 = pt(i + 2); // after end

    // Catmull-Rom → cubic bezier control points for segment p1 → p2
    const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
    const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
    const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
    const cp2y = p2.y - (p3.y - p1.y) * tension / 3;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ` +
             `${cp2x.toFixed(1)},${cp2y.toFixed(1)} ` +
             `${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  return d + ' Z';
}

/**
 * Returns the point on the hull polygon boundary where the line from
 * (fromX, fromY) toward the hull centroid intersects the hull edge.
 * Used to draw polarization lines that start/end at hull boundaries
 * rather than hull centroids.
 *
 * Falls back to the hull centroid if no intersection is found.
 */
export function hullBoundaryPoint(
  hull: Array<{ x: number; y: number }>,
  fromX: number,
  fromY: number,
): { x: number; y: number } {
  if (hull.length === 0) return { x: fromX, y: fromY };

  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;

  const dx = cx - fromX;
  const dy = cy - fromY;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return { x: cx, y: cy };

  // Ray from centroid outward toward fromX,fromY
  const rx = fromX - cx;
  const ry = fromY - cy;

  let bestT = Infinity;
  let bestPt = { x: cx, y: cy };

  const n = hull.length;
  for (let i = 0; i < n; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % n];

    const edgeDx = b.x - a.x;
    const edgeDy = b.y - a.y;

    const denom = rx * edgeDy - ry * edgeDx;
    if (Math.abs(denom) < 0.0001) continue;

    const t = ((a.x - cx) * ry - (a.y - cy) * rx) / denom;
    const s = ((a.x - cx) * edgeDy - (a.y - cy) * edgeDx) / denom;

    if (t >= 0 && t <= 1 && s >= 0 && s < bestT) {
      bestT = s;
      bestPt = {
        x: cx + s * rx,
        y: cy + s * ry,
      };
    }
  }

  return bestPt;
}

/**
 * Computes the angle (in degrees) of a cubic bezier curve at parameter t.
 * Used to orient triangle arrowheads along the edge direction.
 */
export function bezierTangentAngle(
  x0: number, y0: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  x1: number, y1: number,
  t: number,
): number {
  const mt = 1 - t;
  const dx =
    3 * mt * mt * (cp1x - x0) +
    6 * mt * t  * (cp2x - cp1x) +
    3 * t  * t  * (x1   - cp2x);
  const dy =
    3 * mt * mt * (cp1y - y0) +
    6 * mt * t  * (cp2y - cp1y) +
    3 * t  * t  * (y1   - cp2y);
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

/**
 * Returns an SVG path string for a filled triangle arrowhead.
 * The tip points in the given direction (angleDeg), centered at (cx, cy).
 */
export function arrowheadPath(
  cx: number,
  cy: number,
  angleDeg: number,
  size: number = 7,
): string {
  const rad = angleDeg * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const tipX  =  size * 1.0;  const tipY  = 0;
  const baseL = -size * 0.9;  const baseLY = -size * 0.55;
  const baseR = -size * 0.9;  const baseRY =  size * 0.55;

  const tx = cx + cos * tipX  - sin * tipY;
  const ty = cy + sin * tipX  + cos * tipY;
  const lx = cx + cos * baseL - sin * baseLY;
  const ly = cy + sin * baseL + cos * baseLY;
  const rx = cx + cos * baseR - sin * baseRY;
  const ry = cy + sin * baseR + cos * baseRY;

  return `M ${tx.toFixed(1)},${ty.toFixed(1)} L ${lx.toFixed(1)},${ly.toFixed(1)} L ${rx.toFixed(1)},${ry.toFixed(1)} Z`;
}
