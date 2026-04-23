/**
 * Update Saved — confirmation screen after logging an update
 * Route: /update-saved?partName&partType&activationType&intensity&exploreOption&returnTo
 *
 * Shows checkmark animation, part info, navigation options.
 * Auto-navigates after 5 seconds.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type PartType = 'manager' | 'firefighter' | 'exile' | 'self';

const TYPE_COLOR: Record<string, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
};

const TYPE_LABEL: Record<string, string> = {
  manager:     'Manager',
  firefighter: 'Firefighter',
  exile:       'Exile',
  self:        'Self',
};

export default function UpdateSavedScreen() {
  const {
    partName,
    partType,
    activationType,
    intensity,
    exploreOption,
    returnTo,
  } = useLocalSearchParams<{
    partName?:       string;
    partType?:       string;
    activationType?: string;
    intensity?:      string;
    exploreOption?:  string;
    returnTo?:       string;
  }>();

  const scaleAnim    = useRef(new Animated.Value(0)).current;
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Animate checkmark in
    Animated.spring(scaleAnim, {
      toValue:         1,
      friction:        5,
      tension:         80,
      useNativeDriver: true,
    }).start();

    // Countdown + auto-navigate
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          router.replace((returnTo || '/(tabs)') as any);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  const typeColor = TYPE_COLOR[partType ?? ''] ?? '#3B5BA5';
  const typeLabel = TYPE_LABEL[partType ?? ''] ?? partType ?? '';
  const intensityNum = intensity ? parseInt(intensity, 10) : null;

  const showExploreButton = exploreOption === 'trailhead' || exploreOption === 'elaboration';
  const exploreLabel = exploreOption === 'trailhead' ? 'Trailhead' : 'Elaboration';
  const exploreRoute = exploreOption === 'trailhead' ? '/trailhead' : '/elaborate';

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        {/* Animated checkmark */}
        <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
          <Ionicons name="checkmark" size={48} color="#FFFFFF" />
        </Animated.View>

        {/* Heading */}
        <Text style={styles.heading}>Update logged</Text>

        {/* Part name + type pill */}
        {partName ? (
          <View style={styles.partRow}>
            <Text style={styles.partName}>{partName}</Text>
            {typeLabel ? (
              <View style={[styles.typePill, { backgroundColor: typeColor + '20', borderColor: typeColor }]}>
                <Text style={[styles.typePillText, { color: typeColor }]}>{typeLabel}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Activation type + intensity */}
        {(activationType || intensityNum !== null) ? (
          <Text style={styles.meta}>
            {[
              activationType,
              !isNaN(intensityNum ?? NaN) && intensityNum !== null ? `Intensity ${intensityNum}/5` : null,
            ].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        {/* Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            activeOpacity={0.85}
            onPress={() => {
              stopTimer();
              router.replace('/cycles' as any);
            }}
          >
            <Ionicons name="analytics-outline" size={18} color="#FFFFFF" />
            <Text style={styles.btnPrimaryText}>View Cycles</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            activeOpacity={0.85}
            onPress={() => {
              stopTimer();
              router.replace((returnTo || '/(tabs)') as any);
            }}
          >
            <Ionicons name="map-outline" size={18} color="#1C1B19" />
            <Text style={styles.btnSecondaryText}>Back to Atlas</Text>
          </TouchableOpacity>

          {showExploreButton && (
            <TouchableOpacity
              style={[styles.btn, styles.btnExplore]}
              activeOpacity={0.85}
              onPress={() => {
                stopTimer();
                router.replace(exploreRoute as any);
              }}
            >
              <Ionicons name="compass-outline" size={18} color="#7C3D9B" />
              <Text style={styles.btnExploreText}>Continue to {exploreLabel}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Countdown */}
        <Text style={styles.countdown}>Returning in {countdown}s…</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: '#FAFAF8',
  },
  content: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap:            16,
  },

  checkCircle: {
    width:           96,
    height:          96,
    borderRadius:    48,
    backgroundColor: '#2E7D5E',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    8,
  },

  heading: {
    fontSize:   26,
    fontWeight: '700',
    color:      '#1C1B19',
  },

  partRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  partName: {
    fontSize:   18,
    fontWeight: '600',
    color:      '#1C1B19',
  },
  typePill: {
    borderRadius:    20,
    borderWidth:     1,
    paddingHorizontal: 10,
    paddingVertical:   3,
  },
  typePillText: {
    fontSize:   12,
    fontWeight: '600',
  },

  meta: {
    fontSize: 14,
    color:    '#6B6860',
  },

  buttons: {
    width: '100%',
    gap:   10,
    marginTop: 16,
  },
  btn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:             8,
    borderRadius:   14,
    padding:        14,
  },
  btnPrimary: {
    backgroundColor: '#B88A00',
  },
  btnPrimaryText: {
    color:      '#FFFFFF',
    fontSize:   15,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth:     1,
    borderColor:     '#E5E3DE',
  },
  btnSecondaryText: {
    color:      '#1C1B19',
    fontSize:   15,
    fontWeight: '600',
  },
  btnExplore: {
    backgroundColor: '#F5F0FF',
    borderWidth:     1,
    borderColor:     '#7C3D9B',
  },
  btnExploreText: {
    color:      '#7C3D9B',
    fontSize:   15,
    fontWeight: '600',
  },

  countdown: {
    fontSize: 12,
    color:    '#A09D96',
    marginTop: 8,
  },
});
