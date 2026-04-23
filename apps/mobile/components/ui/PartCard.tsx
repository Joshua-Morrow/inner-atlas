/**
 * PartCard — 2-column image card for My Parts grid
 *
 * Shows the rect image when available, type-color + initials fallback otherwise.
 * Frosted glass overlay at bottom with name + type pill + left accent bar.
 */

import { useEffect, useState } from 'react';
import {
  Dimensions,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getDatabase, getPartCurrentImage, PartImage } from '@/lib/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type PartType = 'manager' | 'firefighter' | 'exile' | 'self';

export interface PartCardData {
  id: string;
  display_name: string;
  type: PartType;
  current_image_id?: string | null;
}

interface PartCardProps {
  part: PartCardData;
  onPress: () => void;
}

// ─── Design constants ─────────────────────────────────────────────────────────

const TYPE_COLOR: Record<PartType | string, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
};

const TYPE_LABEL: Record<PartType | string, string> = {
  manager:     'Manager',
  firefighter: 'Firefighter',
  exile:       'Exile',
  self:        'Self',
};

// Brief letter code for the type badge
const TYPE_CODE: Record<PartType | string, string> = {
  manager:     'M',
  firefighter: 'F',
  exile:       'E',
  self:        'S',
};

// ─── Card size ────────────────────────────────────────────────────────────────

const SCREEN_W    = Dimensions.get('window').width;
const H_PAD       = 16;  // horizontal padding each side
const COL_GAP     = 12;
export const CARD_W = (SCREEN_W - H_PAD * 2 - COL_GAP) / 2;
export const CARD_H = CARD_W * 1.4;   // 5:7 portrait ratio

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] ?? '').toUpperCase())
    .join('');
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PartCard({ part, onPress }: PartCardProps) {
  const [currentImage, setCurrentImage] = useState<PartImage | null>(null);

  useEffect(() => {
    const db = getDatabase();
    getPartCurrentImage(db, part.id)
      .then(setCurrentImage)
      .catch(() => undefined);
  }, [part.id]);

  const typeColor = TYPE_COLOR[part.type] ?? '#3B5BA5';
  const typeLabel = TYPE_LABEL[part.type] ?? part.type;
  const typeCode  = TYPE_CODE[part.type]  ?? '?';
  const initials  = getInitials(part.display_name);
  const hasImage  = currentImage !== null;

  return (
    <TouchableOpacity
      style={[styles.card, { width: CARD_W, height: CARD_H }]}
      activeOpacity={0.82}
      onPress={onPress}
    >
      {hasImage ? (
        /* ── Image card ──────────────────────────────────────────────── */
        <ImageBackground
          source={{ uri: currentImage!.rect_uri }}
          style={styles.imageBg}
          resizeMode="cover"
        >
          {/* Type badge — top-right */}
          <View style={styles.typeBadge}>
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>{typeCode}</Text>
          </View>

          {/* Frosted overlay — bottom */}
          <View style={styles.frostedOverlay}>
            {/* Left accent bar */}
            <View style={[styles.accentBar, { backgroundColor: typeColor }]} />
            <View style={styles.overlayContent}>
              <Text style={styles.partName} numberOfLines={1} ellipsizeMode="tail">
                {part.display_name}
              </Text>
              <View style={[styles.typePill, { backgroundColor: `${typeColor}40` }]}>
                <Text style={[styles.typePillText, { color: typeColor }]}>{typeLabel}</Text>
              </View>
            </View>
          </View>
        </ImageBackground>
      ) : (
        /* ── Fallback: type-color gradient + initials ─────────────────── */
        <View style={[styles.fallbackBg, { backgroundColor: typeColor }]}>
          {/* Subtle inner highlight */}
          <View style={styles.fallbackHighlight} />

          {/* Initials watermark */}
          <Text style={styles.initialsText}>{initials}</Text>

          {/* Type badge — top-right */}
          <View style={[styles.typeBadge, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
            <Text style={styles.typeBadgeFallbackText}>{typeCode}</Text>
          </View>

          {/* Frosted overlay — bottom */}
          <View style={styles.frostedOverlay}>
            <View style={[styles.accentBar, { backgroundColor: 'rgba(255,255,255,0.6)' }]} />
            <View style={styles.overlayContent}>
              <Text style={styles.partName} numberOfLines={1} ellipsizeMode="tail">
                {part.display_name}
              </Text>
              <View style={[styles.typePill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={[styles.typePillText, { color: '#FFFFFF' }]}>{typeLabel}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#1C1B19',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },

  // Image variant
  imageBg: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  // Fallback variant
  fallbackBg: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  fallbackHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 100,
    borderBottomRightRadius: 100,
  },
  initialsText: {
    position: 'absolute',
    top: '15%',
    fontSize: 48,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: -1,
  },

  // Type badge
  typeBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  typeBadgeFallbackText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Frosted overlay
  frostedOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '36%',
    backgroundColor: 'rgba(15, 14, 13, 0.72)',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accentBar: {
    width: 3,
    borderBottomLeftRadius: 14,
  },
  overlayContent: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    justifyContent: 'center',
    gap: 4,
  },
  partName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  typePill: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
