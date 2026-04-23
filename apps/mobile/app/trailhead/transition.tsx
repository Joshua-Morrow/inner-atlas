/**
 * Trailhead — Exile Arrival Transition
 * Route: /trailhead/transition?sessionId=[id]
 *
 * Full-screen interstitial between the protector loop and exile contact.
 * No trail chain indicator, no bottom nav, no progress dots.
 * Darker background. Centered, unhurried layout.
 *
 * Three-option self energy check:
 *   1 = Grounded and present   → "I'm ready" → session (exile_contact mode)
 *   2 = A little activated     → breathing overlay → re-check
 *   3 = Not ready today        → save paused → integration (partial mode)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import {
  createExileContact,
  getExileContact,
  updateExileContact,
  updateTrailheadSession,
} from '@/lib/trailhead-db';

// ─── Breathing Overlay ────────────────────────────────────────────────────────

function BreathingOverlay({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: () => void;
}) {
  const breathAnim = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      breathAnim.setValue(1);
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(breathAnim, { toValue: 1.8, duration: 5000, useNativeDriver: true }),
          Animated.timing(breathAnim, { toValue: 1,   duration: 5000, useNativeDriver: true }),
        ]),
        { iterations: 3 }
      );
      loopRef.current.start(({ finished }) => {
        if (finished) onDone();
      });
    } else {
      loopRef.current?.stop();
      breathAnim.setValue(1);
    }
    return () => { loopRef.current?.stop(); };
  }, [visible, breathAnim, onDone]);

  if (!visible) return null;

  return (
    <View style={ov.root}>
      <Text style={ov.headline}>Breathe with me.</Text>
      <Text style={ov.sub}>There's no hurry.</Text>
      <View style={ov.circleWrap}>
        <Animated.View style={[ov.circle, { transform: [{ scale: breathAnim }] }]} />
      </View>
      <Text style={ov.instruction}>Inhale slowly... hold... exhale.</Text>
      <TouchableOpacity style={ov.skipBtn} onPress={onDone} activeOpacity={0.7}>
        <Text style={ov.skipText}>I feel steadier — continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const ov = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,14,13,0.98)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    zIndex: 100,
  },
  headline:   { fontSize: 24, fontWeight: '600', color: '#FFFFFF', marginBottom: 8, textAlign: 'center' },
  sub:        { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 36, textAlign: 'center' },
  circleWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 36 },
  circle: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(124,61,155,0.15)',
    borderWidth: 2, borderColor: 'rgba(124,61,155,0.5)',
  },
  instruction:{ fontSize: 15, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 40 },
  skipBtn:    { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  skipText:   { fontSize: 14, color: 'rgba(255,255,255,0.55)' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

type UIState =
  | 'options'      // three-option check
  | 'ready_msg'    // "Take a breath" after option 1
  | 'not_ready';   // after option 3

export default function TrailheadTransitionScreen() {
  const { sessionId: sidParam } = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = parseInt(sidParam ?? '0', 10);

  const [uiState, setUiState]         = useState<UIState>('options');
  const [showBreathing, setShowBreathing] = useState(false);
  const [selectedEnergy, setSelectedEnergy] = useState<1 | 2 | 3 | null>(null);
  const [working, setWorking]         = useState(false);
  const exileContactId = useRef<number | null>(null);

  // Ensure exile_contact record exists
  useEffect(() => {
    async function ensureRecord() {
      const existing = await getExileContact(sessionId);
      if (existing) {
        exileContactId.current = existing.id;
      } else {
        const id = await createExileContact(sessionId);
        exileContactId.current = id;
      }
    }
    ensureRecord();
  }, [sessionId]);

  async function handleEnergySelect(level: 1 | 2 | 3) {
    if (working) return;
    setSelectedEnergy(level);
    setWorking(true);
    try {
      await updateExileContact(exileContactId.current!, {
        self_energy_at_transition: level,
      });
      await updateTrailheadSession(sessionId, { currentPhase: 'exile_transition' });

      if (level === 1) {
        setUiState('ready_msg');
      } else if (level === 2) {
        setShowBreathing(true);
      } else {
        setUiState('not_ready');
      }
    } finally {
      setWorking(false);
    }
  }

  async function handleAfterBreathing() {
    setShowBreathing(false);
    await updateExileContact(exileContactId.current!, {
      transition_grounding_used: 1,
    });
    // Re-present options
    setSelectedEnergy(null);
    setUiState('options');
  }

  async function handleReady() {
    router.replace(`/trailhead/session?sessionId=${sessionId}&mode=exile_contact`);
  }

  async function handleClose() {
    if (working) return;
    setWorking(true);
    try {
      await updateTrailheadSession(sessionId, {
        status: 'paused',
        pausedAtPhase: 'exile_transition',
      });
      router.replace(`/trailhead/integration?sessionId=${sessionId}&partial=1`);
    } finally {
      setWorking(false);
    }
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <BreathingOverlay
        visible={showBreathing}
        onDone={handleAfterBreathing}
      />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Intro text (always shown) ── */}
        <Text style={s.heading}>Something more vulnerable is near</Text>

        <Text style={s.body}>
          The protective parts have done their work. What's beneath them is a younger, more tender part of your system — one that has likely been waiting a long time to be found.
        </Text>
        <Text style={s.body}>
          This part of the process moves differently. Slowly. There's no goal here except to be present with what's here.
        </Text>
        <Text style={s.body}>
          Before we continue, let's make sure you have what you need.
        </Text>

        <View style={s.divider} />

        {/* ── Three-option check ── */}
        {uiState === 'options' && (
          <View style={s.optionsWrap}>
            {([
              [1, 'Grounded and present'],
              [2, 'A little activated — I\'d like a moment'],
              [3, 'I\'m not sure I\'m ready to go further today'],
            ] as [1 | 2 | 3, string][]).map(([level, label]) => (
              <TouchableOpacity
                key={level}
                style={[
                  s.optCard,
                  selectedEnergy === level && s.optCardSel,
                ]}
                onPress={() => handleEnergySelect(level)}
                disabled={working}
                activeOpacity={0.75}
              >
                <Text style={[s.optLabel, selectedEnergy === level && s.optLabelSel]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Ready message ── */}
        {uiState === 'ready_msg' && (
          <View style={s.msgWrap}>
            <Text style={s.msgText}>
              Take a breath. When you're ready, we'll meet this part together.
            </Text>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={handleReady}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>I'm ready</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Not ready message ── */}
        {uiState === 'not_ready' && (
          <View style={s.msgWrap}>
            <Text style={s.msgText}>
              That's wisdom, not avoidance. The trail is saved. Everything you've discovered is here when you return.
            </Text>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={handleClose}
              disabled={working}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>Close session</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BG = '#161514'; // slightly darker than session BG (#1A1917)

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  content: {
    paddingHorizontal: 30,
    paddingTop: 60,
    paddingBottom: 40,
  },

  heading: {
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 36,
  },

  body: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 30,
    textAlign: 'center',
    marginBottom: 18,
  },

  divider: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    marginVertical: 32,
  },

  optionsWrap: { gap: 12 },
  optCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
  },
  optCardSel: {
    borderColor: 'rgba(124,61,155,0.6)',
    backgroundColor: 'rgba(124,61,155,0.12)',
  },
  optLabel:    { fontSize: 16, color: 'rgba(255,255,255,0.72)', textAlign: 'center', lineHeight: 24 },
  optLabelSel: { color: '#FFFFFF' },

  msgWrap: { gap: 24, alignItems: 'center' },
  msgText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 30,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: '#7C3D9B',
    borderRadius: 14,
    paddingVertical: 17,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
