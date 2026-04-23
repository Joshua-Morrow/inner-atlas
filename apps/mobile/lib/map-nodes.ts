/**
 * Inner Atlas — Parts Map Node Geometry
 * All node shapes are defined as SVG path strings, centered at (0,0).
 */

// DEV TOGGLE — switch between chain styles to compare on device
// 'hanging-links' = 2-3 oval chain links dangling from bottom of node
// 'broken-shackle' = small wrist-cuff / shackle at bottom of node
export const DEV_CHAIN_STYLE: 'hanging-links' | 'broken-shackle' = 'hanging-links';

// Node base sizes (radius / half-width in canvas units)
export const NODE_SIZES = {
  self:        33,
  manager:     24,
  firefighter: 24,
  exile:       23,
  freed:       21,
  unknown:     21,
  shadowed:    20,
} as const;

// Intensity scaling: base size + (intensity * 3px), capped at base + 18
export function getNodeSize(type: string, intensity: number): number {
  const base = NODE_SIZES[type as keyof typeof NODE_SIZES] ?? NODE_SIZES.shadowed;
  return base + Math.min(intensity * 3, 18);
}

// Type colors
export const NODE_COLORS = {
  manager:           '#3B5BA5',
  firefighter:       '#C2600A',
  exile:             '#7C3D9B',
  self:              '#B88A00',
  freed_manager:     '#6B8BC5',
  freed_firefighter: '#E2924A',
  freed_exile:       '#A87DC5',
  unknown:           '#6B6860',
  shadowed:          '#2A2927',
} as const;

export function getNodeColor(type: string, freed = false): string {
  if (freed) {
    const key = `freed_${type}` as keyof typeof NODE_COLORS;
    return NODE_COLORS[key] ?? NODE_COLORS.unknown;
  }
  return NODE_COLORS[type as keyof typeof NODE_COLORS] ?? NODE_COLORS.unknown;
}

/**
 * HEXAGON path (Manager) — flat-top hexagon, radius r
 * Centered at (0,0), flat edges on top and bottom
 */
export function hexagonPath(r: number): string {
  const a = (2 * Math.PI) / 6;
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = a * i - Math.PI / 6; // flat-top: rotate -30 deg
    return `${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`;
  });
  return `M ${points.join(' L ')} Z`;
}

/**
 * SHIELD path (Firefighter) — classic heraldic shield, height ~1.3r
 * Wide at top, pointed at bottom
 */
export function shieldPath(r: number): string {
  const w   = r;
  const h   = r * 1.3;
  const cr  = r * 0.3;
  return [
    `M ${-w + cr},${-h}`,
    `Q ${-w},${-h} ${-w},${-h + cr}`,
    `L ${-w},0`,
    `Q ${-w},${h * 0.4} 0,${h}`,
    `Q ${w},${h * 0.4} ${w},0`,
    `L ${w},${-h + cr}`,
    `Q ${w},${-h} ${w - cr},${-h}`,
    'Z',
  ].join(' ');
}

/**
 * ROUNDED SQUARE path (Exile) — square with radius 0.25r corners
 */
export function roundedSquarePath(r: number): string {
  const s  = r * 0.9;
  const cr = r * 0.25;
  return [
    `M ${-s + cr},${-s}`,
    `L ${s - cr},${-s}`,
    `Q ${s},${-s} ${s},${-s + cr}`,
    `L ${s},${s - cr}`,
    `Q ${s},${s} ${s - cr},${s}`,
    `L ${-s + cr},${s}`,
    `Q ${-s},${s} ${-s},${s - cr}`,
    `L ${-s},${-s + cr}`,
    `Q ${-s},${-s} ${-s + cr},${-s}`,
    'Z',
  ].join(' ');
}

/**
 * INVERTED TRIANGLE path (Unknown) — base on top, tip at bottom
 */
export function invertedTrianglePath(r: number): string {
  const w = r;
  const h = r * 0.95;
  return `M ${-w},${-h} L ${w},${-h} L 0,${h} Z`;
}

/**
 * Returns the bottom Y extent of a node shape (for chain attachment point)
 */
export function nodeBottomY(type: string, size: number): number {
  return type === 'firefighter' ? size * 1.3 : size;
}

// ─── Chain / burden indicators ────────────────────────────────────────────────

export interface ChainLink {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export function getHangingLinks(bottomY: number): ChainLink[] {
  const linkW = 5;
  const linkH = 9;
  return [
    { cx: 0, cy: bottomY + 7,  rx: linkW, ry: linkH },
    { cx: 0, cy: bottomY + 18, rx: linkH, ry: linkW },
    { cx: 0, cy: bottomY + 29, rx: linkW, ry: linkH },
  ];
}

export function brokenShacklePath(bottomY: number): string {
  const cy   = bottomY + 14;
  const rx   = 8;
  const ry   = 6;
  const gap  = 40; // degrees — break at top
  const startAngle = ((-90 + gap / 2) * Math.PI) / 180;
  const endAngle   = ((-90 - gap / 2 + 360) * Math.PI) / 180;
  const x1 = (rx * Math.cos(startAngle)).toFixed(2);
  const y1 = (cy + ry * Math.sin(startAngle)).toFixed(2);
  const x2 = (rx * Math.cos(endAngle)).toFixed(2);
  const y2 = (cy + ry * Math.sin(endAngle)).toFixed(2);
  return [
    `M ${x1},${y1}`,
    `A ${rx},${ry} 0 1 0 ${x2},${y2}`,
    `M 0,${cy - ry} L 0,${cy - ry - 6}`,
  ].join(' ');
}
