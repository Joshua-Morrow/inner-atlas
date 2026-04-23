/**
 * Inner Atlas — Design System Constants
 * Colors, typography, and component specs from DESIGN_SYSTEM.md
 */

// ─── Part Type Colors ────────────────────────────────────────
export const PART_COLORS = {
  manager: {
    primary: '#3B5BA5',
    light: '#EEF2FF',
  },
  firefighter: {
    primary: '#C2600A',
    light: '#FFF7ED',
  },
  exile: {
    primary: '#7C3D9B',
    light: '#F5F0FF',
  },
  self: {
    primary: '#B88A00',
    light: '#FFFBEB',
  },
} as const;

// ─── App Neutrals ────────────────────────────────────────────
export const NEUTRALS = {
  backgroundPrimary: '#FAFAF8',
  backgroundSecondary: '#F3F2EF',
  surface: '#FFFFFF',
  border: '#E5E3DE',
  textPrimary: '#1C1B19',
  textSecondary: '#6B6860',
  textMuted: '#A09D96',
} as const;

// ─── Semantic / Relationship Colors ──────────────────────────
export const RELATIONSHIP_COLORS = {
  harmonious: '#2D6A4F',
  conflicting: '#991B1B',
  polarized: '#991B1B',
  protective: '#1D4E89',
  neutral: '#92400E',
} as const;

// ─── Map Canvas ──────────────────────────────────────────────
export const MAP_CANVAS = {
  background: '#1A1916',
  fogColor: 'rgba(26,25,22,0.0)',
} as const;

// ─── Typography ──────────────────────────────────────────────
export const TYPOGRAPHY = {
  displayXL: { size: 32, weight: '700' as const, family: 'Fraunces' },
  heading1: { size: 24, weight: '600' as const, family: 'Inter' },
  heading2: { size: 20, weight: '600' as const, family: 'Inter' },
  body: { size: 16, weight: '400' as const, family: 'Inter', lineHeight: 1.6 },
  caption: { size: 13, weight: '400' as const, family: 'Inter' },
  label: { size: 12, weight: '500' as const, family: 'Inter' },
  mono: { size: 14, weight: '400' as const, family: 'JetBrainsMono' },
} as const;

// ─── Component Standards ─────────────────────────────────────
export const COMPONENT = {
  borderRadius: {
    card: 8,
    modal: 12,
    button: 4,
    pill: 24,
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    modal: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 8,
    },
  },
  spacing: [0, 4, 8, 12, 16, 24, 32, 48, 64] as const,
  touchTarget: 44,
  transition: {
    micro: 200,
    screen: 350,
  },
} as const;

// ─── Node Shapes ─────────────────────────────────────────────
export const NODE_SIZES = {
  manager: { width: 80, height: 48, borderRadius: 12 },
  firefighter: { width: 72, height: 72 }, // starburst polygon
  exile: { width: 64, height: 64 }, // circle
  self: { width: 96, height: 96 }, // octagon
} as const;

// ─── Helper: get part color ──────────────────────────────────
import type { PartType } from './ifs';

export function getPartColor(type: PartType): { primary: string; light: string } {
  return PART_COLORS[type];
}
