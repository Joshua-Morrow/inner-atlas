/**
 * Parts Map Screen — SVG canvas (Phase 2.5)
 *
 * Pan + pinch zoom via PanResponder (no Reanimated — newArchEnabled:false)
 * Node shapes: hexagon (Manager), shield (Firefighter), rounded-square (Exile),
 *              circle (Self/Freed), inverted-triangle (Unknown)
 *
 * File is `explore.tsx` (the "Map" tab).
 */

import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  FeelingEdge,
  MapPart,
  MapRelationship,
  clearAllMapPositions,
  getAllFeelingEdges,
  getMapParts,
  getMapRelationships,
} from '@/lib/database';
import PartsMapCanvas from '@/components/map/PartsMapCanvas';
import NodeDetailSheet from '@/components/map/NodeDetailSheet';

const SYNTHETIC_SELF: MapPart = {
  id: '__self__',
  display_name: 'Self',
  type: 'self',
  intensity: 10,
  activation_status: 'high',
  status: 'named',
  is_burdened: 0,
  is_elaborated: 0,
  is_refined: 0,
  position_x: null,
  position_y: null,
  current_image_id: null,
  circle_uri: null,
};

const NODE_LEGEND = [
  { color: '#3B5BA5', label: 'Manager' },
  { color: '#C2600A', label: 'Firefighter' },
  { color: '#7C3D9B', label: 'Exile' },
  { color: '#B88A00', label: 'Self' },
  { color: '#6B6860', label: 'Unknown' },
];

const REL_LEGEND = [
  { color: '#2D6A4F', dash: false, label: 'Alliance' },
  { color: '#991B1B', dash: true,  label: 'Polarization' },
  { color: '#5B7FB8', dash: false, label: 'Protective' },
  { color: '#B88A00', dash: true,  label: 'Activation chain' },
];

type MapViewMode = 'atlas' | 'feelings';

export default function MapScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [parts, setParts]               = useState<MapPart[]>([]);
  const [relationships, setRelations]   = useState<MapRelationship[]>([]);
  const [feelingEdges, setFeelingEdges] = useState<FeelingEdge[]>([]);
  const [viewMode, setViewMode]         = useState<MapViewMode>('atlas');
  const [selectedPart, setSelectedPart] = useState<MapPart | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [hasCustomPositions, setHasCustomPositions] = useState(false);
  const [layoutResetKey, setLayoutResetKey] = useState(0);
  const [focusedPartId, setFocusedPartId] = useState<string | null>(null);

  const buildDisplayParts = useCallback((dbParts: MapPart[]): MapPart[] => {
    const hasSelf = dbParts.some(p => p.type === 'self');
    if (!hasSelf && dbParts.length > 0) {
      return [SYNTHETIC_SELF, ...dbParts];
    }
    return dbParts;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [p, r, fe] = await Promise.all([
        getMapParts(),
        getMapRelationships(),
        getAllFeelingEdges(),
      ]);
      setParts(buildDisplayParts(p));
      setRelations(r);
      setFeelingEdges(fe);
    } catch (e) {
      console.error('[MapScreen] loadData:', e);
    }
  }, [buildDisplayParts]);

  useFocusEffect(
    useCallback(() => {
      if (mode === 'feelings') setViewMode('feelings');
      loadData();
    }, [loadData, mode]),
  );

  const handlePartPress = useCallback((part: MapPart | null) => {
    if (part === null) {
      setFocusedPartId(null);
      return;
    }
    if (focusedPartId === part.id) {
      setFocusedPartId(null);
    } else {
      setFocusedPartId(part.id);
    }
    setSelectedPart(part);
    setSheetVisible(true);
  }, [focusedPartId]);

  const handleClose = useCallback(() => {
    setSheetVisible(false);
  }, []);

  const handleResetLayout = useCallback(async () => {
    await clearAllMapPositions();
    const [p, r] = await Promise.all([getMapParts(), getMapRelationships()]);
    setParts(buildDisplayParts(p));
    setRelations(r);
    setHasCustomPositions(false);
    setFocusedPartId(null);
    setLayoutResetKey(k => k + 1);
  }, [buildDisplayParts]);

  const confirmResetLayout = useCallback(() => {
    Alert.alert(
      'Reset Layout',
      'Clear all manual positions and let the layout reorganize the map? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: handleResetLayout },
      ],
    );
  }, [handleResetLayout]);

  const realPartsCount = parts.filter(p => p.id !== '__self__').length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Atlas</Text>
        <View style={styles.headerRight}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'atlas' && styles.toggleBtnActive]}
              onPress={() => setViewMode('atlas')}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleLabel, viewMode === 'atlas' && styles.toggleLabelActive]}>
                Atlas
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'feelings' && styles.toggleBtnActive]}
              onPress={() => setViewMode('feelings')}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleLabel, viewMode === 'feelings' && styles.toggleLabelActive]}>
                Feelings
              </Text>
            </TouchableOpacity>
          </View>
          {hasCustomPositions && (
            <TouchableOpacity
              style={styles.resetBtn}
              activeOpacity={0.7}
              onPress={confirmResetLayout}
            >
              <Text style={styles.resetBtnText}>Reset layout</Text>
            </TouchableOpacity>
          )}
          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {realPartsCount} {realPartsCount === 1 ? 'part' : 'parts'}
            </Text>
          </View>
        </View>
      </View>

      {/* Canvas or empty state */}
      {realPartsCount === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Your map is empty</Text>
          <Text style={styles.emptyBody}>
            Complete an assessment or add parts manually to begin mapping your system.
          </Text>
        </View>
      ) : (
        <PartsMapCanvas
          parts={parts}
          relationships={relationships}
          feelingEdges={feelingEdges}
          viewMode={viewMode}
          selectedPartId={selectedPart?.id ?? null}
          focusedPartId={focusedPartId}
          onPartPress={handlePartPress}
          onHasCustomPositionsChange={setHasCustomPositions}
          layoutResetKey={layoutResetKey}
        />
      )}

      {/* Legend overlay */}
      {realPartsCount > 0 && (
        <View style={styles.legendContainer} pointerEvents="none">
          {/* Node type legend */}
          <View style={styles.legendCard}>
            <Text style={styles.legendTitle}>Parts</Text>
            {NODE_LEGEND.map((item) => (
              <View key={item.label} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Relationship line legend — switches with viewMode */}
          <View style={[styles.legendCard, { marginTop: 6 }]}>
            <Text style={styles.legendTitle}>Connections</Text>
            {viewMode === 'atlas' ? (
              REL_LEGEND.map((item) => (
                <View key={item.label} style={styles.legendRow}>
                  <View style={styles.legendLineWrap}>
                    {item.dash ? (
                      <View
                        style={[
                          styles.legendLineDash,
                          { borderBottomColor: item.color },
                        ]}
                      />
                    ) : (
                      <View style={[styles.legendLineSolid, { backgroundColor: item.color }]} />
                    )}
                  </View>
                  <Text style={styles.legendLabel}>{item.label}</Text>
                </View>
              ))
            ) : (
              <>
                <View style={styles.legendRow}>
                  <View style={styles.legendLineWrap}>
                    <View style={[styles.legendLineSolid, { backgroundColor: '#9B7A4A' }]} />
                  </View>
                  <Text style={styles.legendLabel}>Feeling connection</Text>
                </View>
                <Text style={styles.legendNote}>Alliances/polarizations faded</Text>
              </>
            )}
          </View>
        </View>
      )}

      {/* Node detail bottom sheet */}
      <NodeDetailSheet
        part={selectedPart}
        visible={sheetVisible}
        onClose={handleClose}
        onBurdenToggled={loadData}
        viewMode={viewMode}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1917',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2927',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E8E6E1',
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resetBtn: {
    backgroundColor: '#2A2927',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#3A3835',
  },
  resetBtnText: {
    fontSize: 12,
    color: '#9B9A94',
    fontWeight: '500',
  },
  countBadge: {
    backgroundColor: '#2A2927',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: {
    fontSize: 12,
    color: '#9B9A94',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B6860',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: '#4A4845',
    textAlign: 'center',
    lineHeight: 20,
  },
  legendContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
  },
  legendCard: {
    backgroundColor: 'rgba(26,25,23,0.88)',
    borderRadius: 10,
    padding: 10,
    gap: 5,
    borderWidth: 1,
    borderColor: '#2A2927',
  },
  legendTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B6860',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLineWrap: {
    width: 24,
    height: 8,
    justifyContent: 'center',
  },
  legendLineSolid: {
    height: 2,
    width: 24,
  },
  legendLineDash: {
    height: 0,
    width: 24,
    borderBottomWidth: 2,
    borderStyle: 'dashed',
  },
  legendLabel: {
    fontSize: 11,
    color: '#9B9A94',
  },
  legendNote: {
    fontSize: 10,
    color: '#4A4845',
    fontStyle: 'italic',
    marginTop: 2,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#2A2927',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#1E1E1C',
  },
  toggleLabel: {
    fontSize: 12,
    color: '#6B6860',
    fontWeight: '500',
  },
  toggleLabelActive: {
    color: '#E8E6E1',
  },
});
