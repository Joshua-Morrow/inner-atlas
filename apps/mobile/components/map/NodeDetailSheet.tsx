/**
 * NodeDetailSheet — modal bottom sheet shown when a map node is tapped.
 * Shows part name, type, and quick-action buttons.
 */

import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { FeelingEdge, MapPart, getFeelingEdgesForPart, setPartBurdened } from '@/lib/database';
import { getNodeColor } from '@/lib/map-nodes';

interface Props {
  part: MapPart | null;
  visible: boolean;
  onClose: () => void;
  onBurdenToggled: () => void;
  viewMode: 'atlas' | 'feelings' | 'combined';
}

const TYPE_LABELS: Record<string, string> = {
  manager:     'Manager',
  firefighter: 'Firefighter',
  exile:       'Exile',
  self:        'Self',
  freed:       'Freed',
  unknown:     'Unknown',
};

export default function NodeDetailSheet({ part, visible, onClose, onBurdenToggled, viewMode }: Props) {
  const router = useRouter();
  const [partFeelingEdges, setPartFeelingEdges] = useState<FeelingEdge[]>([]);

  useEffect(() => {
    if (part && visible) {
      getFeelingEdgesForPart(part.id).then(setPartFeelingEdges);
    } else {
      setPartFeelingEdges([]);
    }
  }, [part?.id, visible]);

  if (!part) return null;

  const color          = getNodeColor(part.type);
  const canToggleBurden = part.type === 'manager' || part.type === 'firefighter';
  const isBurdened     = part.is_burdened === 1;

  const handleToggleBurden = async () => {
    await setPartBurdened(part.id, !isBurdened);
    onBurdenToggled();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Tap backdrop to dismiss */}
      <Pressable style={styles.overlay} onPress={onClose} />

      <View style={styles.sheet}>
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Part header */}
        <View style={styles.header}>
          <View style={[styles.typeDot, { backgroundColor: color }]} />
          <Text style={styles.partName} numberOfLines={2}>{part.display_name}</Text>
          <View style={[styles.typePill, { borderColor: color }]}>
            <Text style={[styles.typeLabel, { color }]}>
              {TYPE_LABELS[part.type] ?? part.type}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.8}
            onPress={() => {
              onClose();
              router.push(`/part-profile?id=${part.id}`);
            }}
          >
            <Text style={styles.primaryBtnText}>View Profile</Text>
          </TouchableOpacity>

          {canToggleBurden && (
            <TouchableOpacity
              style={[styles.secondaryBtn, isBurdened && styles.secondaryBtnActive]}
              activeOpacity={0.8}
              onPress={handleToggleBurden}
            >
              <Text style={[styles.secondaryBtnText, isBurdened && styles.secondaryBtnTextActive]}>
                {isBurdened ? 'Remove Chain' : 'Mark as Burdened'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.8}
            onPress={() => {
              onClose();
              router.push(`/log-update?partId=${part.id}`);
            }}
          >
            <Text style={styles.secondaryBtnText}>Log Update</Text>
          </TouchableOpacity>
        </View>

        {/* Feeling connections — only in Feelings mode */}
        {viewMode === 'feelings' && partFeelingEdges.length > 0 && (
          <View style={styles.feelSection}>
            <Text style={styles.feelSectionTitle}>Feeling connections</Text>
            {partFeelingEdges
              .filter(e => e.from_part_id === part.id)
              .map(e => {
                const chips = (() => { try { return (JSON.parse(e.feelings_json) as string[]).join(', '); } catch { return ''; } })();
                return (
                  <View key={e.id} style={styles.feelRow}>
                    <Text style={styles.feelArrow}>→</Text>
                    <Text style={styles.feelPartName}>{e.to_part_name ?? 'Unknown'}</Text>
                    <Text style={styles.feelChips}>{chips}</Text>
                  </View>
                );
              })}
            {partFeelingEdges
              .filter(e => e.to_part_id === part.id)
              .map(e => {
                const chips = (() => { try { return (JSON.parse(e.feelings_json) as string[]).join(', '); } catch { return ''; } })();
                return (
                  <View key={`in-${e.id}`} style={styles.feelRow}>
                    <Text style={styles.feelPartName}>{e.from_part_name ?? 'Unknown'}</Text>
                    <Text style={styles.feelArrow}>→</Text>
                    <Text style={styles.feelChips}>{chips}</Text>
                  </View>
                );
              })}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#1E1E1C',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: '#2A2927',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#3A3835',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  partName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#E8E6E1',
    letterSpacing: 0.2,
  },
  typePill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  actions: {
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: '#B88A00',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#1A1917',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2927',
  },
  secondaryBtnActive: {
    borderColor: '#7C3D9B',
    backgroundColor: 'rgba(124,61,155,0.1)',
  },
  secondaryBtnText: {
    color: '#9B9A94',
    fontSize: 15,
    fontWeight: '500',
  },
  secondaryBtnTextActive: {
    color: '#7C3D9B',
  },
  feelSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2927',
    paddingTop: 14,
    gap: 6,
  },
  feelSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B6860',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  feelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feelArrow: {
    fontSize: 14,
    color: '#9B7A4A',
    fontWeight: '600',
  },
  feelPartName: {
    fontSize: 13,
    color: '#E8E6E1',
    fontWeight: '500',
    flex: 1,
  },
  feelChips: {
    fontSize: 12,
    color: '#9B7A4A',
    flex: 2,
    textAlign: 'right',
  },
});
