/**
 * Breathing Timer — standalone paced breathing practice screen.
 * Route: /breathing-timer
 *
 * - Animated gold circle expands on inhale, contracts on exhale
 * - Pace slider: 2.0–10.0s (controls both inhale and exhale equally)
 * - Hold slider: 0.0–4.0s hold after inhale
 * - Bell tone + haptic on phase transitions
 * - Breath counter resets on Stop
 * - Mute toggle suppresses sound and haptics
 *
 * Audio: generates a 440 Hz sine-wave bell tone as a WAV at runtime —
 * no external file needed. Configured via expo-av Audio.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';

// ─── Bell tone generator ───────────────────────────────────────────────────────
// Builds a 440 Hz sine wave with exponential decay as a WAV data URI.
// ~6.4 KB WAV, generated once on mount, no external asset needed.

function generateBellWavUri(): string {
  const sampleRate = 8000;
  const durationSec = 0.8;         // 800 ms — enough to be audible
  const frequency = 440;           // A4
  const numSamples = Math.floor(sampleRate * durationSec);

  const dataSize = numSamples * 2; // 16-bit = 2 bytes/sample
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46);
  view.setUint32(4, 36 + dataSize, true);
  view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45);

  // fmt sub-chunk
  view.setUint8(12, 0x66); view.setUint8(13, 0x6D); view.setUint8(14, 0x74); view.setUint8(15, 0x20);
  view.setUint32(16, 16, true);           // PCM fmt size
  view.setUint16(20, 1, true);            // PCM format
  view.setUint16(22, 1, true);            // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);            // block align
  view.setUint16(34, 16, true);           // bits per sample

  // data sub-chunk
  view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61);
  view.setUint32(40, dataSize, true);

  // PCM samples: decaying sine wave
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t / 0.25); // 250 ms decay
    const sample = envelope * Math.sin(2 * Math.PI * frequency * t);
    view.setInt16(44 + i * 2, Math.round(sample * 28000), true);
  }

  // ArrayBuffer → base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toFixed(1);
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BreathingTimerScreen() {
  const [pace, setPace]           = useState(5.0);   // seconds for inhale and exhale
  const [hold, setHold]           = useState(0.0);   // seconds to hold after inhale
  const [isRunning, setIsRunning] = useState(false);
  const [muted, setMuted]         = useState(false);
  const [breathCount, setBreathCount] = useState(0);
  const [phase, setPhase]         = useState<'inhale' | 'hold' | 'exhale' | 'idle'>('idle');

  // Animated value: 0.6 = small (exhale), 1.0 = full (inhale)
  const circleAnim = useRef(new Animated.Value(0.6)).current;

  // Refs to read latest values inside animation callbacks without stale closures
  const isRunningRef = useRef(false);
  const paceRef      = useRef(pace);
  const holdRef      = useRef(hold);
  const mutedRef     = useRef(muted);
  const soundRef     = useRef<Audio.Sound | null>(null);

  useEffect(() => { paceRef.current = pace; },  [pace]);
  useEffect(() => { holdRef.current = hold; },  [hold]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // ── Audio setup + cleanup ────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    async function setup() {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const uri = generateBellWavUri();
      const { sound } = await Audio.Sound.createAsync({ uri });
      if (mounted) {
        soundRef.current = sound;
      } else {
        sound.unloadAsync().catch(() => undefined);
      }
    }

    setup().catch(() => undefined);

    return () => {
      mounted = false;
      isRunningRef.current = false;
      circleAnim.stopAnimation();
      soundRef.current?.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    };
  }, [circleAnim]);

  // ── Bell: haptic + sound ─────────────────────────────────────────────────

  const bell = useCallback(() => {
    if (mutedRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const s = soundRef.current;
    if (s) {
      s.stopAsync()
        .then(() => s.playFromPositionAsync(0))
        .catch(() => undefined);
    }
  }, []);

  // ── Animation cycle ───────────────────────────────────────────────────────

  const runCycle = useCallback(() => {
    if (!isRunningRef.current) return;

    const p = paceRef.current;
    const h = holdRef.current;

    // Inhale
    setPhase('inhale');
    bell();
    Animated.timing(circleAnim, {
      toValue: 1.0,
      duration: p * 1000,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || !isRunningRef.current) return;

      if (h > 0) {
        // Hold
        setPhase('hold');
        const holdTimer = setTimeout(() => {
          if (!isRunningRef.current) return;
          startExhale();
        }, h * 1000);
        // store so we can cancel
        (runCycle as { holdTimer?: ReturnType<typeof setTimeout> }).holdTimer = holdTimer;
      } else {
        startExhale();
      }
    });
  }, [bell, circleAnim]);

  function startExhale() {
    setPhase('exhale');
    bell();
    Animated.timing(circleAnim, {
      toValue: 0.6,
      duration: paceRef.current * 1000,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || !isRunningRef.current) return;
      setBreathCount((prev) => prev + 1);
      runCycle();
    });
  }

  // ── Start / Stop ──────────────────────────────────────────────────────────

  function startSession() {
    isRunningRef.current = true;
    setIsRunning(true);
    runCycle();
  }

  function stopSession() {
    isRunningRef.current = false;
    circleAnim.stopAnimation();
    Animated.timing(circleAnim, { toValue: 0.6, duration: 300, useNativeDriver: true }).start();
    setIsRunning(false);
    setPhase('idle');
    setBreathCount(0);
  }

  function togglePause() {
    if (isRunning) {
      isRunningRef.current = false;
      circleAnim.stopAnimation();
      setIsRunning(false);
      setPhase('idle');
    } else {
      isRunningRef.current = true;
      setIsRunning(true);
      runCycle();
    }
  }

  // ── Phase label ───────────────────────────────────────────────────────────

  const phaseLabel: Record<typeof phase, string> = {
    inhale: 'Inhale',
    hold:   'Hold',
    exhale: 'Exhale',
    idle:   '',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => { stopSession(); router.back(); }} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#6B6860" />
        </Pressable>
        <Text style={s.headerTitle}>Breathing Timer</Text>
        <Pressable onPress={() => setMuted((prev) => !prev)} hitSlop={12} style={s.muteBtn}>
          <Ionicons
            name={muted ? 'volume-mute-outline' : 'volume-medium-outline'}
            size={20}
            color={muted ? '#C2600A' : '#6B6860'}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Animated breathing circle */}
        <View style={s.circleWrap}>
          <Animated.View
            style={[
              s.circle,
              { transform: [{ scale: circleAnim }] },
            ]}
          >
            <Text style={s.phaseLabel}>{phaseLabel[phase]}</Text>
          </Animated.View>
        </View>

        {/* Pace display */}
        <Text style={s.paceDisplay}>
          {fmt(pace)}s in · {fmt(pace)}s out
          {hold > 0 ? ` · ${fmt(hold)}s hold` : ''}
        </Text>

        {/* Breath counter */}
        <Text style={s.breathCounter}>
          Breath {breathCount}
        </Text>

        {/* Sliders */}
        <View style={s.sliderSection}>
          <View style={s.sliderRow}>
            <Text style={s.sliderLabel}>Breath pace</Text>
            <Text style={s.sliderValue}>{fmt(pace)}s</Text>
          </View>
          <Slider
            style={s.slider}
            minimumValue={2.0}
            maximumValue={10.0}
            step={0.1}
            value={pace}
            onValueChange={(v) => {
              if (isRunning) stopSession();
              setPace(parseFloat(v.toFixed(1)));
            }}
            minimumTrackTintColor="#B88A00"
            maximumTrackTintColor="#E5E3DE"
            thumbTintColor="#B88A00"
          />

          <View style={[s.sliderRow, { marginTop: 16 }]}>
            <Text style={s.sliderLabel}>Hold after inhale (optional)</Text>
            <Text style={s.sliderValue}>{hold === 0 ? 'off' : `${fmt(hold)}s`}</Text>
          </View>
          <Slider
            style={s.slider}
            minimumValue={0.0}
            maximumValue={4.0}
            step={0.1}
            value={hold}
            onValueChange={(v) => {
              if (isRunning) stopSession();
              setHold(parseFloat(v.toFixed(1)));
            }}
            minimumTrackTintColor="#B88A00"
            maximumTrackTintColor="#E5E3DE"
            thumbTintColor="#B88A00"
          />
        </View>

        {/* Start / Pause button */}
        <Pressable
          style={({ pressed }) => [
            s.startBtn,
            isRunning && s.startBtnActive,
            pressed && { opacity: 0.85 },
          ]}
          onPress={togglePause}
        >
          <Ionicons
            name={isRunning ? 'pause' : 'play'}
            size={22}
            color={isRunning ? '#1A1917' : '#B88A00'}
          />
          <Text style={[s.startBtnText, isRunning && s.startBtnTextActive]}>
            {isRunning ? 'Pause' : 'Start'}
          </Text>
        </Pressable>

        {/* Stop button (visible when running or paused with count > 0) */}
        {(isRunning || breathCount > 0) && (
          <Pressable
            style={({ pressed }) => [s.stopBtn, pressed && { opacity: 0.7 }]}
            onPress={stopSession}
          >
            <Text style={s.stopBtnText}>Stop</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAF8' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1C1B19' },
  muteBtn:     { padding: 4 },

  scroll: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 60,
    alignItems: 'center',
  },

  // Breathing circle
  circleWrap: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(184,138,0,0.12)',
    borderWidth: 3,
    borderColor: 'rgba(184,138,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B88A00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  phaseLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#B88A00',
    letterSpacing: 0.5,
  },

  paceDisplay: {
    fontSize: 15,
    color: '#6B6860',
    marginBottom: 6,
    textAlign: 'center',
  },
  breathCounter: {
    fontSize: 13,
    color: '#6B6860',
    marginBottom: 36,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  // Sliders
  sliderSection: { width: '100%', marginBottom: 36 },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sliderLabel: { fontSize: 14, color: '#1C1B19', fontWeight: '500' },
  sliderValue: { fontSize: 13, color: '#6B6860' },
  slider: { width: '100%', height: 40 },

  // Start / Pause button
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: '#B88A00',
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginBottom: 16,
  },
  startBtnActive: {
    backgroundColor: '#B88A00',
  },
  startBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#B88A00',
  },
  startBtnTextActive: {
    color: '#1A1917',
  },

  // Stop button
  stopBtn: {
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  stopBtnText: {
    fontSize: 14,
    color: '#6B6860',
    textAlign: 'center',
  },
});
