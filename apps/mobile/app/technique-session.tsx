/**
 * Technique Session — dynamic step-by-step practice runner.
 * Route: /technique-session?id=[technique_id]&partId=[optional]&resumeId=[optional]
 *
 * Step types: instruction | timer | input | chip-select | part-select |
 *             experience-log | unblend-cycle | inquiry-questions |
 *             meeting-space-setup | meeting-rules | meeting-dialogue
 * Ground button: visible when technique.has_ground_button === true (weeks 3–6)
 * Completion: inline (no route change), saves to practice_sessions
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';

import { getTechniqueById, type Technique, type TechniqueStep } from '@/lib/techniques-data';
import { getDatabase, upsertFeelingEdge } from '@/lib/database';
import { ExperienceLogStep }      from '@/components/ui/ExperienceLogStep';
import { UnblendCycleStep }        from '@/components/ui/UnblendCycleStep';
import { InquiryQuestionsStep }    from '@/components/ui/InquiryQuestionsStep';
import { MeetingSpaceSetupStep }    from '@/components/ui/MeetingSpaceSetupStep';
import { MeetingRulesStep }           from '@/components/ui/MeetingRulesStep';
import { MeetingDialogueStep }        from '@/components/ui/MeetingDialogueStep';
import { MeetingFeelTowardsSeq }      from '@/components/ui/MeetingFeelTowardsSeq';
import { MeetingRelMap }              from '@/components/ui/MeetingRelMap';
import { MindfulnessPracticeStep }    from '@/components/ui/MindfulnessPracticeStep';
import { type RelationalMap, type MapNodePartType } from '@/lib/relational-map';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Substitute [part] placeholder in text with the resolved part name
function substitutePart(text: string, partName: string): string {
  return text.replace(/\[part\]/g, partName);
}

// Step types that manage their own footer / advance logic
const SELF_MANAGING_TYPES: TechniqueStep['type'][] = [
  'experience-log',
  'unblend-cycle',
  'inquiry-questions',
  'meeting-space-setup',
  'meeting-rules',
  'meeting-dialogue',
  'meeting-feel-towards',
  'meeting-relational-map',
  'mindfulness-practice',
];

// ─── Types ────────────────────────────────────────────────────────────────────

type PartType = 'manager' | 'firefighter' | 'exile' | 'self' | 'unknown';

interface PartRow {
  id: string;
  display_name: string;
  type: PartType;
}

const TYPE_COLOR: Record<PartType, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
  unknown:     '#6B6860',
};

// ─── Breathing Circle (reused for timer steps) ────────────────────────────────

function BreathingCircle({ rate = 5.0, onPhaseChange }: { rate?: number; onPhaseChange?: () => void }) {
  const anim   = useRef(new Animated.Value(0.75)).current;
  const [inhale, setInhale] = useState(true);
  const rateMs = Math.round(rate * 1000);
  // Use a ref so the interval callback always reads the latest callback
  // without adding it to the effect deps (which would restart the animation).
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.3, duration: rateMs, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.75, duration: rateMs, useNativeDriver: true }),
      ]),
    );
    loop.start();
    let phase = true;
    const interval = setInterval(() => {
      phase = !phase;
      setInhale(phase);
      onPhaseChangeRef.current?.();
    }, rateMs);
    return () => { loop.stop(); clearInterval(interval); };
  }, [anim, rateMs]);

  return (
    <View style={bc.wrap}>
      <Animated.View style={[bc.circle, { transform: [{ scale: anim }] }]}>
        <Text style={bc.phaseText}>{inhale ? 'Inhale' : 'Exhale'}</Text>
      </Animated.View>
    </View>
  );
}

const bc = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 24, height: 160 },
  circle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(184,138,0,0.18)',
    borderWidth: 2, borderColor: 'rgba(184,138,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  phaseText: { fontSize: 15, fontWeight: '600', color: '#B88A00', letterSpacing: 0.5 },
});

// ─── RFB Timer Step (Week 1 — Resonance Frequency Breathing) ─────────────────
// Self-managing component: pre-start screen + active timer with bell sounds.

function RFBTimerStep({
  breathingRate,
  onRateChange,
  onAdvance,
}: {
  breathingRate: number;
  onRateChange: (v: number) => void;
  onAdvance: () => void;
}) {
  const [timerStarted, setTimerStarted] = useState(false);
  const [durationInput, setDurationInput] = useState('10');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [timerComplete, setTimerComplete] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use a ref so playBell always reads the latest toggle state
  // without the callback needing to be recreated.
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  // Countdown timer — starts when timerStarted becomes true.
  useEffect(() => {
    if (!timerStarted) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setTimerComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerStarted]);

  // Play a bell sound at each breath phase transition.
  // Creates a fresh Audio.Sound instance per ring so multiple rings can
  // overlap naturally (previous ring fades while new one starts).
  async function playBell() {
    if (!soundEnabledRef.current) return;
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync(
        // Replace copper-bell-ding.mp3 in assets/sounds/ with the actual bell file.
        require('@/assets/Bell.mp3') as number,
        { shouldPlay: true, volume: 1.0 },
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch {
      // Audio is enhancement only — fail silently.
    }
  }

  // ── Pre-start screen ───────────────────────────────────────────────────────
  if (!timerStarted) {
    return (
      <View style={rfbt.root}>
        <ScrollView
          style={rfbt.scroll}
          contentContainerStyle={rfbt.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Duration */}
          <Text style={rfbt.sectionLabel}>DURATION</Text>
          <View style={rfbt.durationRow}>
            <TextInput
              style={rfbt.durationInput}
              value={durationInput}
              onChangeText={(val) => {
                setDurationInput(val);
                const n = parseInt(val, 10);
                if (!isNaN(n) && n >= 1 && n <= 60) {
                  // duration stored in input string; used cosmetically only
                }
              }}
              keyboardType="number-pad"
              selectTextOnFocus
              maxLength={2}
            />
            <Text style={rfbt.durationUnit}>min</Text>
          </View>

          <View style={rfbt.divider} />

          {/* Breathing rate */}
          <Text style={rfbt.sectionLabel}>BREATHING RATE</Text>
          <View style={rfbt.rateControl}>
            <Text style={rfbt.rateValue}>{breathingRate.toFixed(1)} sec per breath</Text>
            <Slider
              style={rfbt.slider}
              minimumValue={4.0}
              maximumValue={7.0}
              step={0.1}
              value={breathingRate}
              onValueChange={onRateChange}
              minimumTrackTintColor="#B88A00"
              maximumTrackTintColor="#444444"
              thumbTintColor="#FFFFFF"
            />
          </View>

          <View style={rfbt.divider} />

          {/* Sound toggle */}
          <Text style={rfbt.sectionLabel}>SOUND</Text>
          <View style={rfbt.soundRow}>
            <Ionicons name="musical-notes-outline" size={20} color="#9B9A94" />
            <View style={rfbt.soundTextGroup}>
              <Text style={rfbt.soundLabel}>Bell sound</Text>
              <Text style={rfbt.soundHint}>Bell rings at each breath transition</Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              trackColor={{ false: '#444444', true: '#B88A00' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Begin button */}
        <View style={rfbt.footer}>
          <TouchableOpacity
            style={rfbt.startBtn}
            onPress={() => {
              const mins = parseInt(durationInput, 10);
              const totalSecs = (!isNaN(mins) && mins >= 1 && mins <= 60 ? mins : 10) * 60;
              setSecondsLeft(totalSecs);
              setTimerStarted(true);
            }}
            activeOpacity={0.85}
          >
            <Text style={rfbt.startBtnText}>Begin breathing</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Active timer ───────────────────────────────────────────────────────────
  return (
    <View style={rfbt.root}>
      <ScrollView
        style={rfbt.scroll}
        contentContainerStyle={rfbt.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Breathing circle — calls playBell on each phase transition */}
        <BreathingCircle rate={breathingRate} onPhaseChange={playBell} />

        {/* Countdown display */}
        <Text style={rfbt.countdownText}>
          {`${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, '0')}`}
        </Text>

        <View style={rfbt.divider} />

        {/* Rate slider — adjustable during active timer */}
        <Text style={rfbt.sectionLabel}>BREATHING RATE</Text>
        <View style={rfbt.rateControl}>
          <Text style={rfbt.rateValue}>{breathingRate.toFixed(1)} sec per breath</Text>
          <Slider
            style={rfbt.slider}
            minimumValue={4.0}
            maximumValue={7.0}
            step={0.1}
            value={breathingRate}
            onValueChange={onRateChange}
            minimumTrackTintColor="#B88A00"
            maximumTrackTintColor="#444444"
            thumbTintColor="#FFFFFF"
          />
        </View>

        <View style={rfbt.divider} />

        {/* Sound toggle — adjustable during active timer */}
        <Text style={rfbt.sectionLabel}>SOUND</Text>
        <View style={rfbt.soundRow}>
          <Ionicons name="musical-notes-outline" size={20} color="#9B9A94" />
          <View style={rfbt.soundTextGroup}>
            <Text style={rfbt.soundLabel}>Bell sound</Text>
            <Text style={rfbt.soundHint}>Bell rings at each breath transition</Text>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={setSoundEnabled}
            trackColor={{ false: '#444444', true: '#B88A00' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Done button */}
      <View style={rfbt.footer}>
        <TouchableOpacity
          style={[rfbt.doneBtn, timerComplete && rfbt.doneBtnActive]}
          onPress={onAdvance}
          activeOpacity={0.8}
        >
          <Text style={[rfbt.doneBtnText, timerComplete && rfbt.doneBtnTextActive]}>I'm done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const rfbt = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.0, marginBottom: 12,
  },
  // Duration
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  durationInput: {
    width: 80, backgroundColor: '#2A2927', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 28, fontWeight: '700', color: '#FFFFFF', textAlign: 'center',
  },
  durationUnit: { fontSize: 20, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 24 },
  // Rate
  rateControl: { marginBottom: 24 },
  rateValue: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 8, textAlign: 'center' },
  slider: { width: '100%', height: 40 },
  // Sound
  soundRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14,
  },
  soundTextGroup: { flex: 1 },
  soundLabel: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  soundHint: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  // Buttons
  footer: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1917',
  },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#3B5BA5', borderRadius: 14, paddingVertical: 16,
  },
  startBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  doneBtn: {
    backgroundColor: '#2A2927', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#3A3937',
  },
  doneBtnText: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  doneBtnActive: { backgroundColor: '#3B5BA5', borderColor: '#3B5BA5' },
  doneBtnTextActive: { color: '#FFFFFF' },
  countdownText: {
    fontSize: 32, fontWeight: '700', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 16,
  },
});

// ─── Grounding Overlay ────────────────────────────────────────────────────────

function GroundingOverlay({
  visible,
  onReturn,
  onEndAndSave,
}: {
  visible: boolean;
  onReturn: () => void;
  onEndAndSave: () => void;
}) {
  const [groundingRate, setGroundingRate] = useState(5.5);
  const [bellEnabled, setBellEnabled]     = useState(false);
  // Use a ref so the playBell closure always reads the latest toggle value
  const bellEnabledRef = useRef(bellEnabled);
  useEffect(() => { bellEnabledRef.current = bellEnabled; }, [bellEnabled]);

  async function playBell() {
    if (!bellEnabledRef.current) return;
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/Bell.mp3') as number,
        { shouldPlay: true, volume: 1.0 },
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) { void sound.unloadAsync(); }
      });
    } catch {
      // Audio is enhancement-only — fail silently.
    }
  }

  if (!visible) return null;

  return (
    <View style={ov.root}>
      <ScrollView
        style={ov.scroll}
        contentContainerStyle={ov.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={ov.headline}>Let's slow down.</Text>
        <Text style={ov.subhead}>Take a breath with me.</Text>

        {/* Breathing circle with Inhale/Exhale label inside */}
        <BreathingCircle rate={groundingRate} onPhaseChange={() => void playBell()} />

        {/* Rate slider */}
        <Text style={ov.rateLabel}>{groundingRate.toFixed(1)} sec per breath</Text>
        <Slider
          style={ov.slider}
          minimumValue={4.0}
          maximumValue={7.0}
          step={0.1}
          value={groundingRate}
          onValueChange={setGroundingRate}
          minimumTrackTintColor="#B88A00"
          maximumTrackTintColor="#444444"
          thumbTintColor="#FFFFFF"
        />

        {/* Bell sound toggle */}
        <View style={ov.soundRow}>
          <Ionicons name="musical-notes-outline" size={18} color="#9B9A94" />
          <Text style={ov.soundLabel}>Bell</Text>
          <Switch
            value={bellEnabled}
            onValueChange={setBellEnabled}
            trackColor={{ false: '#444444', true: '#B88A00' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <Text style={ov.instruction}>Feel your feet on the floor.</Text>
        <Text style={ov.instruction}>Notice three things you can see right now.</Text>
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={ov.buttons}>
        <TouchableOpacity style={ov.returnBtn} onPress={onReturn} activeOpacity={0.85}>
          <Text style={ov.returnBtnText}>I feel steadier — return to practice</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ov.endBtn} onPress={onEndAndSave} activeOpacity={0.85}>
          <Text style={ov.endBtnText}>End practice and save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ov = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,25,23,0.97)',
    zIndex: 100,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  headline: { fontSize: 26, fontWeight: '700', color: '#FFFFFF', marginBottom: 6, textAlign: 'center' },
  subhead:  { fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 8, textAlign: 'center' },
  rateLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 4, textAlign: 'center' },
  slider: { width: '100%', height: 40, marginBottom: 12 },
  soundRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24,
    width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14,
  },
  soundLabel: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  instruction: { fontSize: 16, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 26, marginBottom: 6 },
  buttons: { paddingHorizontal: 32, paddingVertical: 24, gap: 12 },
  returnBtn: { backgroundColor: '#3B5BA5', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  returnBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  endBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  endBtnText: { color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: '500' },
});

// ─── Part Select Step ─────────────────────────────────────────────────────────

function PartSelectStep({
  parts,
  selectedPartId,
  selectedPartIds,
  multiSelect,
  onSelectPart,
  onTogglePart,
  onPartSaved,
}: {
  parts: PartRow[];
  selectedPartId: string | null;
  selectedPartIds: string[];
  multiSelect: boolean;
  onSelectPart: (id: string) => void;
  onTogglePart: (id: string) => void;
  onPartSaved: (part: PartRow) => void;
}) {
  const [newPartName, setNewPartName] = useState('');
  const [isSavingPart, setIsSavingPart] = useState(false);
  const [savedConfirmName, setSavedConfirmName] = useState<string | null>(null);

  async function handleSaveNewPart() {
    const trimmed = newPartName.trim();
    if (!trimmed || isSavingPart) return;
    setIsSavingPart(true);
    try {
      const db = getDatabase();
      const newId = generateId();
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO parts (id, name, type, status, discovered_via, created_at, updated_at)
         VALUES (?, ?, 'unknown', 'named', 'technique', ?, ?)`,
        [newId, trimmed, now, now],
      );
      await db.runAsync(
        `INSERT OR IGNORE INTO part_profiles (part_id, updated_at) VALUES (?, ?)`,
        [newId, now],
      );
      const newPart: PartRow = { id: newId, display_name: trimmed, type: 'unknown' };
      onPartSaved(newPart);
      if (multiSelect) {
        onTogglePart(newId);
      } else {
        onSelectPart(newId);
      }
      setNewPartName('');
      setSavedConfirmName(trimmed);
      setTimeout(() => setSavedConfirmName(null), 2000);
    } catch (e) {
      console.error('[PartSelectStep] handleSaveNewPart:', e);
    } finally {
      setIsSavingPart(false);
    }
  }

  return (
    <View style={pss.container}>
      {parts.length === 0 ? (
        <Text style={pss.emptyText}>No named parts yet. Add a new part below.</Text>
      ) : (
        <View style={pss.partList}>
          {parts.map((p) => {
            const color = TYPE_COLOR[p.type] ?? '#6B6860';
            const selected = multiSelect
              ? selectedPartIds.includes(p.id)
              : selectedPartId === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[pss.partCard, { borderColor: selected ? color : 'rgba(255,255,255,0.1)' }]}
                activeOpacity={0.75}
                onPress={() => multiSelect ? onTogglePart(p.id) : onSelectPart(p.id)}
              >
                <View style={[pss.typeDot, { backgroundColor: color }]} />
                <Text style={pss.partName}>{p.display_name}</Text>
                {selected && <Ionicons name="checkmark-circle" size={18} color={color} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      <Text style={pss.orLabel}>Name a new part:</Text>
      <View style={pss.newPartRow}>
        <TextInput
          style={pss.newPartInput}
          value={newPartName}
          onChangeText={setNewPartName}
          placeholder="Name a part that's active right now..."
          placeholderTextColor="rgba(255,255,255,0.3)"
        />
        <TouchableOpacity
          style={[pss.savePartBtn, (!newPartName.trim() || isSavingPart) && pss.savePartBtnDisabled]}
          onPress={handleSaveNewPart}
          disabled={!newPartName.trim() || isSavingPart}
          activeOpacity={0.75}
        >
          <Text style={pss.savePartBtnText}>{isSavingPart ? '...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
      {savedConfirmName && (
        <Text style={pss.savedConfirm}>✓ {savedConfirmName} saved and selected</Text>
      )}
    </View>
  );
}

const pss = StyleSheet.create({
  container: { gap: 10 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', marginBottom: 8 },
  partList: { gap: 8 },
  partCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1.5, padding: 14,
  },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  partName: { flex: 1, fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  orLabel: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 8 },
  newPartRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  newPartInput: { flex: 1, backgroundColor: '#2A2927', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#FFFFFF' },
  savePartBtn: { borderWidth: 1.5, borderColor: '#3B5BA5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  savePartBtnDisabled: { opacity: 0.4 },
  savePartBtnText: { fontSize: 14, fontWeight: '600', color: '#3B5BA5' },
  savedConfirm: { fontSize: 12, color: '#4CAF50', marginTop: 4 },
});

// ─── Step Content (simple types only) ────────────────────────────────────────

function StepContent({
  step,
  stepResponse,
  chipSelection,
  selectedPartId,
  selectedPartIds,
  parts,
  techniqueId,
  breathingRate,
  targetPartName,
  onResponseChange,
  onChipToggle,
  onSelectPart,
  onTogglePart,
  onPartSaved,
  onRateChange,
}: {
  step: TechniqueStep;
  stepResponse: string;
  chipSelection: string[];
  selectedPartId: string | null;
  selectedPartIds: string[];
  parts: PartRow[];
  techniqueId: string;
  breathingRate: number;
  targetPartName: string;
  onResponseChange: (v: string) => void;
  onChipToggle: (chip: string) => void;
  onSelectPart: (id: string) => void;
  onTogglePart: (id: string) => void;
  onPartSaved: (part: PartRow) => void;
  onRateChange: (v: number) => void;
}) {
  const isOptional = step.optional === true;
  const resolvedHeading = substitutePart(step.heading ?? '', targetPartName);
  const resolvedBody    = step.body ? substitutePart(step.body, targetPartName) : undefined;

  return (
    <View style={sc.container}>
      <Text style={sc.heading}>
        {resolvedHeading}
        {isOptional && <Text style={sc.optional}> (optional)</Text>}
      </Text>
      {resolvedBody ? <Text style={sc.body}>{resolvedBody}</Text> : null}

      {step.type === 'instruction' && null}

      {step.type === 'timer' && (
        <>
          {techniqueId === 'rfb' && (
            <View style={sc.rateControl}>
              <Text style={sc.rateLabel}>Breathing rate</Text>
              <Text style={sc.rateValue}>{breathingRate.toFixed(1)} sec</Text>
              <Slider
                style={sc.slider}
                minimumValue={4.0}
                maximumValue={7.0}
                step={0.1}
                value={breathingRate}
                onValueChange={onRateChange}
                minimumTrackTintColor="#B88A00"
                maximumTrackTintColor="#444444"
                thumbTintColor="#FFFFFF"
              />
              <Text style={sc.rateHint}>Adjust to find your rhythm</Text>
            </View>
          )}
          <BreathingCircle rate={breathingRate} />
        </>
      )}

      {step.type === 'input' && (
        <TextInput
          style={sc.textInput}
          value={stepResponse}
          onChangeText={onResponseChange}
          placeholder={step.input_placeholder ?? 'Write here...'}
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
          textAlignVertical="top"
        />
      )}

      {step.type === 'chip-select' && (
        <View style={sc.chipsWrap}>
          {(step.chips ?? []).map((chip) => {
            const selected = chipSelection.includes(chip);
            return (
              <TouchableOpacity
                key={chip}
                style={[sc.chip, selected && sc.chipSelected]}
                activeOpacity={0.75}
                onPress={() => onChipToggle(chip)}
              >
                <Text style={[sc.chipText, selected && sc.chipTextSelected]}>{chip}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {step.type === 'part-select' && (
        <PartSelectStep
          parts={parts}
          selectedPartId={selectedPartId}
          selectedPartIds={selectedPartIds}
          multiSelect={step.multi_select === true}
          onSelectPart={onSelectPart}
          onTogglePart={onTogglePart}
          onPartSaved={onPartSaved}
        />
      )}
    </View>
  );
}

const sc = StyleSheet.create({
  container: { flex: 1, paddingBottom: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 30, marginBottom: 12 },
  optional: { fontSize: 16, fontWeight: '400', color: 'rgba(255,255,255,0.45)' },
  body: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 24, marginBottom: 20 },
  textInput: { backgroundColor: '#2A2927', borderRadius: 12, padding: 14, fontSize: 15, color: '#FFFFFF', minHeight: 120, lineHeight: 22 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#2A2927', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  chipSelected: { backgroundColor: '#B88A00' },
  chipText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  chipTextSelected: { color: '#FFFFFF' },
  rateControl: { alignItems: 'center', marginBottom: 8 },
  rateLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  rateValue: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  slider: { width: '100%', height: 40 },
  rateHint: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
});

// ─── Completion Screen ────────────────────────────────────────────────────────

function CompletionScreen({
  technique,
  afterText,
  onAfterChange,
  onSave,
}: {
  technique: Technique;
  afterText: string;
  onAfterChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <View style={css.root}>
      <ScrollView
        style={css.scroll}
        contentContainerStyle={css.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={css.checkCircle}>
          <Ionicons name="checkmark" size={32} color="#B88A00" />
        </View>
        <Text style={css.heading}>Practice complete.</Text>
        <Text style={css.prompt}>{technique.after_prompt}</Text>
        <TextInput
          style={css.textInput}
          value={afterText}
          onChangeText={onAfterChange}
          placeholder="Your state right now — body, mind, mood..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
          textAlignVertical="top"
        />
        <View style={{ height: 100 }} />
      </ScrollView>
      <View style={css.footer}>
        <TouchableOpacity style={css.saveBtn} onPress={onSave} activeOpacity={0.85}>
          <Text style={css.saveBtnText}>Save & Finish</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const css = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 20 },
  checkCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(184,138,0,0.15)',
    borderWidth: 2, borderColor: 'rgba(184,138,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, alignSelf: 'center',
  },
  heading: { fontSize: 26, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 16 },
  prompt:  { fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 24, textAlign: 'center', marginBottom: 24 },
  textInput: { backgroundColor: '#2A2927', borderRadius: 12, padding: 14, fontSize: 15, color: '#FFFFFF', minHeight: 120, lineHeight: 22 },
  footer: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  saveBtn: { backgroundColor: '#B88A00', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TechniqueSessionScreen() {
  const { id, partId: partIdParam, resumeId } = useLocalSearchParams<{
    id: string;
    partId?: string;
    resumeId?: string;
  }>();

  const technique: Technique | undefined = id ? getTechniqueById(id) : undefined;

  // Session timing
  const sessionStartRef = useRef<number>(Date.now());

  // Resume support
  const resumeSessionIdRef = useRef<string | null>(resumeId ?? null);

  // Step state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepResponses, setStepResponses]     = useState<Record<string, string>>({});
  const [chipSelections, setChipSelections]   = useState<Record<string, string[]>>({});
  const [selectedPartId, setSelectedPartId]   = useState<string | null>(partIdParam ?? null);
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([]);
  const [isComplete, setIsComplete]           = useState(false);
  const [afterText, setAfterText]             = useState('');

  // RFB breathing rate
  const [breathingRate, setBreathingRate] = useState(5.0);

  // UI state
  const [groundingVisible, setGroundingVisible] = useState(false);
  const [parts, setParts]                       = useState<PartRow[]>([]);

  // ExperienceLogStep sub-phase tracking — used to intercept back button
  const experienceLogPhaseRef = useRef<string>('log');
  const expLogReturnToLogRef  = useRef<(() => void) | null>(null);

  // UnblendCycleStep sub-phase tracking — used to intercept back button
  const unblendCyclePhaseRef   = useRef<string>('feel-towards');
  const unblendCycleReturnRef  = useRef<(() => void) | null>(null);

  // MeetingFeelTowardsSeq back-interception ref
  const meetingFeelTowardsBackRef = useRef<(() => boolean) | null>(null);

  // Relational map — initialized with Self, populated when part-select advances
  const [relMap, setRelMap] = useState<RelationalMap>({
    nodes: [{ id: 'self', name: 'Self', partType: 'self', addedDuringSession: false }],
    edges: [],
  });

  // Load parts from DB
  useFocusEffect(
    useCallback(() => {
      getDatabase()
        .getAllAsync<PartRow>(
          `SELECT id, COALESCE(custom_name, name) AS display_name, type
           FROM parts WHERE status = 'named' ORDER BY name`,
        )
        .then(setParts)
        .catch((e) => console.error('[TechniqueSession] loadParts:', e));
    }, []),
  );

  // Load resume session if resumeId provided
  useEffect(() => {
    if (!resumeId || !technique) return;
    resumeSessionIdRef.current = resumeId;

    async function loadResumeSession() {
      try {
        const db = getDatabase();
        const row = await db.getFirstAsync<{ notes_json: string | null }>(
          `SELECT notes_json FROM practice_sessions WHERE id = ?`,
          [resumeId!],
        );
        if (!row?.notes_json) return;
        const parsed = JSON.parse(row.notes_json) as Record<string, unknown>;

        if (parsed.step_responses && typeof parsed.step_responses === 'object') {
          setStepResponses(parsed.step_responses as Record<string, string>);
        }
        if (parsed.chip_selections && typeof parsed.chip_selections === 'object') {
          setChipSelections(parsed.chip_selections as Record<string, string[]>);
        }
        if (typeof parsed.selected_part_id === 'string') {
          setSelectedPartId(parsed.selected_part_id);
        }
        if (Array.isArray(parsed.selected_part_ids)) {
          setSelectedPartIds(parsed.selected_part_ids as string[]);
        }
        if (typeof parsed.rfb_breathing_rate === 'number') {
          setBreathingRate(parsed.rfb_breathing_rate);
        }

        // Restore to last filled step
        const responses = (parsed.step_responses ?? {}) as Record<string, string>;
        const chips = (parsed.chip_selections ?? {}) as Record<string, string[]>;
        const lastFilledIdx = technique!.steps.reduce((last, step, idx) => {
          const hasContent = responses[step.id] || (chips[step.id]?.length ?? 0) > 0;
          return hasContent ? idx : last;
        }, 0);
        setCurrentStepIndex(lastFilledIdx);
      } catch (e) {
        console.error('[TechniqueSession] loadResumeSession:', e);
      }
    }

    loadResumeSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Android back handler
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });
      return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStepIndex, isComplete]),
  );

  if (!technique) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <Text style={s.errorText}>Technique not found.</Text>
      </SafeAreaView>
    );
  }

  const steps = technique.steps;
  const currentStep: TechniqueStep | undefined = steps[currentStepIndex];
  // RFB timer step is also self-managing (pre-start + active with bell sounds)
  const isRFBTimer = technique.id === 'rfb' && currentStep?.type === 'timer';
  const isSelfManaging = (currentStep && SELF_MANAGING_TYPES.includes(currentStep.type)) || isRFBTimer;

  // ── Derived helpers ──────────────────────────────────────────────────────

  function getTargetPartName(): string {
    if (selectedPartId) {
      const part = parts.find((p) => p.id === selectedPartId);
      if (part) return part.display_name;
    }
    return 'this part';
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleBack() {
    if (isComplete) {
      router.back();
      return;
    }
    // If ExperienceLogStep is in a sub-phase, return to 'log' phase
    // instead of navigating back to the previous step.
    if (
      currentStep?.type === 'experience-log' &&
      experienceLogPhaseRef.current !== 'log' &&
      expLogReturnToLogRef.current
    ) {
      expLogReturnToLogRef.current();
      return;
    }
    // If UnblendCycleStep is in a sub-phase, return to 'feel-towards'
    // instead of navigating back to the previous step.
    if (
      currentStep?.type === 'unblend-cycle' &&
      unblendCyclePhaseRef.current !== 'feel-towards' &&
      unblendCycleReturnRef.current
    ) {
      unblendCycleReturnRef.current();
      return;
    }
    // MeetingFeelTowardsSeq — delegate to component's back handler
    if (currentStep?.type === 'meeting-feel-towards' && meetingFeelTowardsBackRef.current) {
      const consumed = meetingFeelTowardsBackRef.current();
      if (consumed) return;
    }
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    } else {
      handleQuitConfirm();
    }
  }

  function handleQuitConfirm() {
    Alert.alert(
      'End practice?',
      'Your progress so far will be saved.',
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Save and quit', style: 'default', onPress: handleSaveAndQuit },
      ],
    );
  }

  function handleResponseChange(value: string) {
    if (!currentStep) return;
    setStepResponses((prev) => ({ ...prev, [currentStep.id]: value }));
  }

  function handleChipToggle(chip: string) {
    if (!currentStep) return;
    setChipSelections((prev) => {
      const current = prev[currentStep.id] ?? [];
      const next = current.includes(chip)
        ? current.filter((c) => c !== chip)
        : [...current, chip];
      return { ...prev, [currentStep.id]: next };
    });
  }

  function handleSelectPart(partId: string) {
    setSelectedPartId((prev) => (prev === partId ? null : partId));
  }

  function handleTogglePart(partId: string) {
    setSelectedPartIds((prev) =>
      prev.includes(partId) ? prev.filter((id) => id !== partId) : [...prev, partId],
    );
  }

  function advanceStep() {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((i) => i + 1);
    } else {
      setIsComplete(true);
    }
  }

  function handleContinue() {
    // When advancing from the meeting-space part-select step, populate the relational map
    if (
      technique?.id === 'meeting-space' &&
      currentStep?.type === 'part-select' &&
      currentStep.multi_select
    ) {
      setRelMap({
        nodes: [
          { id: 'self', name: 'Self', partType: 'self', addedDuringSession: false },
          ...selectedPartIds.map((pid) => {
            const p = parts.find((x) => x.id === pid);
            return {
              id: pid,
              name: p?.display_name ?? pid,
              partType: (p?.type ?? 'unknown') as MapNodePartType,
              addedDuringSession: false,
            };
          }),
        ],
        edges: [],
      });
    }
    advanceStep();
  }

  // Called by self-managing step components when they're done
  function handleComplexStepAdvance(stepId: string, data: string) {
    setStepResponses((prev) => ({ ...prev, [stepId]: data }));
    advanceStep();
  }

  async function saveSession(
    finalAfterText?: string,
    status: 'complete' | 'incomplete' = 'complete',
  ) {
    try {
      const db = getDatabase();
      const actualDurationSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const actualDurationMinutes = Math.round(actualDurationSeconds / 60);

      const notesObj: Record<string, unknown> = {
        week:             technique!.week,
        step_responses:   { ...stepResponses, after: finalAfterText ?? afterText },
        chip_selections:  chipSelections,
        selected_part_id: selectedPartId,
        selected_part_ids: selectedPartIds,
        actual_duration_seconds: actualDurationSeconds,
        status,
      };
      if (technique!.id === 'rfb') {
        notesObj.rfb_breathing_rate = breathingRate;
      }
      // Relational map for Meeting Space sessions — save full map + backward-compat snapshot
      if (technique!.id === 'meeting-space') {
        try {
          // Save the full relational map (nodes + edges with isSelfLike flag)
          notesObj.relational_map = relMap;

          // Also write relational_snapshot in the format used by technique-log / RelationalSnapshot
          // Merge in any part-to-part edges from the post-meeting relational check
          const allEdges = [...relMap.edges];
          const meetingDialogueForSnapshot = stepResponses['meeting-dialogue'];
          if (meetingDialogueForSnapshot) {
            try {
              const mdData = JSON.parse(meetingDialogueForSnapshot) as {
                relational_edges?: Array<{ fromId: string; toId: string; feelings: string[] }>;
              };
              for (const e of mdData.relational_edges ?? []) {
                const alreadyPresent = allEdges.some(
                  (x) => x.fromId === e.fromId && x.toId === e.toId,
                );
                if (!alreadyPresent) {
                  allEdges.push({ fromId: e.fromId, toId: e.toId, feelings: e.feelings, isSelfLike: false });
                }
              }
            } catch { /* ignore */ }
          }
          notesObj.relational_snapshot = {
            nodes: relMap.nodes.map((n) => ({ id: n.id, name: n.name, partType: n.partType })),
            edges: allEdges.map((e) => ({ fromId: e.fromId, toId: e.toId, feelings: e.feelings })),
          };
        } catch {
          // Snapshot is enhancement-only — fail silently
        }

        // Section 14 — save meeting dialogue to inner_dialogues
        if (status === 'complete') {
          const meetingDialogueRaw = stepResponses['meeting-dialogue'];
          if (meetingDialogueRaw) {
            try {
              const dialogueData = JSON.parse(meetingDialogueRaw) as {
                parts_present?: string[];
                messages?: Array<{ speaker: string; partId?: string; isSelf?: boolean; text: string; timestamp: string }>;
                opening_prompts?: Array<{ partId?: string; partName: string; content: string }>;
                relational_edges?: Array<{ fromId: string; toId: string; feelings: string[] }>;
              };
              const dialogueId  = generateId();
              const dialogueNow = new Date().toISOString();
              const participants = dialogueData.parts_present ?? [];
              const allMessages = [
                ...(dialogueData.opening_prompts ?? []).map((op) => ({
                  id: generateId(),
                  part_id: op.partId ?? null,
                  content: `${op.partName}: ${op.content}`, created_at: dialogueNow,
                })),
                ...(dialogueData.messages ?? []).map((m) => ({
                  id: generateId(),
                  part_id: m.isSelf ? null : (m.partId ?? null),
                  content: m.text, created_at: m.timestamp ?? dialogueNow,
                })),
              ];
              await db.runAsync(
                `INSERT INTO inner_dialogues
                   (id, title, participants_json, messages_json, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'complete', ?, ?)`,
                [dialogueId, `Meeting Room — ${new Date().toLocaleDateString()}`,
                 JSON.stringify(participants), JSON.stringify(allMessages),
                 dialogueNow, dialogueNow],
              );
              notesObj.meeting_dialogue_id = dialogueId;
            } catch (e) {
              console.error('[TechniqueSession] saveInnerDialogue:', e);
            }
          }
        }
      }

      const notesJson = JSON.stringify(notesObj);
      const reflectionNote = finalAfterText ?? afterText ?? null;
      const now = new Date().toISOString();

      const sessionRowId = resumeSessionIdRef.current ?? generateId();

      if (resumeSessionIdRef.current) {
        await db.runAsync(
          `UPDATE practice_sessions
           SET notes_json = ?, reflection_note = ?, duration_minutes = ?, completed_at = ?
           WHERE id = ?`,
          [notesJson, reflectionNote, actualDurationMinutes, now, sessionRowId],
        );
      } else {
        await db.runAsync(
          `INSERT INTO practice_sessions
             (id, technique_id, completed_at, duration_minutes, part_id, notes_json, reflection_note)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            sessionRowId,
            technique!.id,
            now,
            actualDurationMinutes,
            selectedPartId ?? null,
            notesJson,
            reflectionNote,
          ],
        );
      }

      // === Write feel-towards edges to persistent table ===
      if (technique!.id === 'meeting-space' && status === 'complete') {
        try {
          const allEdgesToPersist = [...relMap.edges];
          const meetingDialogueRaw = stepResponses['meeting-dialogue'];
          if (meetingDialogueRaw) {
            try {
              const mdData = JSON.parse(meetingDialogueRaw) as {
                relational_edges?: Array<{ fromId: string; toId: string; feelings: string[] }>;
              };
              for (const e of mdData.relational_edges ?? []) {
                const alreadyPresent = allEdgesToPersist.some(
                  (x) => x.fromId === e.fromId && x.toId === e.toId,
                );
                if (!alreadyPresent) {
                  allEdgesToPersist.push({ fromId: e.fromId, toId: e.toId, feelings: e.feelings, isSelfLike: false });
                }
              }
            } catch { /* ignore */ }
          }

          for (const edge of allEdgesToPersist) {
            if (!edge.feelings || edge.feelings.length === 0) continue;
            const fromId = edge.fromId === 'self'
              ? (parts.find((p) => p.type === 'self')?.id ?? '__self__')
              : edge.fromId;
            const toId = edge.toId === 'self'
              ? (parts.find((p) => p.type === 'self')?.id ?? '__self__')
              : edge.toId;

            await upsertFeelingEdge({
              fromPartId: fromId,
              toPartId: toId,
              feelings: edge.feelings,
              source: 'meeting_space',
              sessionId: sessionRowId || null,
            });
          }
        } catch (e) {
          console.error('[TechniqueSession] upsertFeelingEdges:', e);
        }
      }

      // Section 15 — activity log entries for each part in Meeting Room
      if (technique!.id === 'meeting-space' && selectedPartIds.length > 0 && status === 'complete') {
        const dialogueId = typeof notesObj.meeting_dialogue_id === 'string'
          ? notesObj.meeting_dialogue_id
          : undefined;
        const sessionTitle = `Meeting Room — ${new Date().toLocaleDateString()}`;
        for (const partId of selectedPartIds) {
          const otherParticipants = selectedPartIds
            .filter((id) => id !== partId)
            .map((id) => parts.find((p) => p.id === id)?.display_name ?? id);
          await db.runAsync(
            `INSERT INTO updates (id, update_type, part_id, content_json, created_at)
             VALUES (?, 'meeting_room', ?, ?, ?)`,
            [
              generateId(),
              partId,
              JSON.stringify({ session_title: sessionTitle, other_participants: otherParticipants, dialogue_id: dialogueId }),
              now,
            ],
          );
        }
      }
    } catch (e) {
      console.error('[TechniqueSession] saveSession:', e);
    }
  }

  async function handleSaveAndFinish() {
    await saveSession(afterText, 'complete');
    router.back();
  }

  async function handleSaveAndQuit() {
    await saveSession(undefined, 'incomplete');
    router.back();
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isComplete) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} hitSlop={12} style={s.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>{technique.title}</Text>
          <View style={s.headerRight} />
        </View>
        <CompletionScreen
          technique={technique}
          afterText={afterText}
          onAfterChange={setAfterText}
          onSave={handleSaveAndFinish}
        />
      </SafeAreaView>
    );
  }

  const stepResponse   = (currentStep && stepResponses[currentStep.id]) ?? '';
  const chipSelection  = (currentStep && chipSelections[currentStep.id]) ?? [];
  const targetPartName = getTargetPartName();

  const isMultiSelect  = currentStep?.type === 'part-select' && currentStep.multi_select === true;
  // Meeting Space requires at least 2 parts before continuing
  const meetingSpaceMultiSelect = isMultiSelect && technique.id === 'meeting-space';
  const canContinueMultiSelect  = !meetingSpaceMultiSelect || selectedPartIds.length >= 2;
  const buttonLabel =
    isMultiSelect
      ? (meetingSpaceMultiSelect && selectedPartIds.length < 2
          ? `Select ${2 - selectedPartIds.length} more`
          : 'These parts are present')
      : currentStep?.type === 'timer'
        ? "I'm done"
        : currentStepIndex === steps.length - 1
          ? 'Finish'
          : 'Continue';

  // Space type for MeetingDialogue (from where-to-meet step response)
  const buildSpaceData = stepResponses['where-to-meet'];
  let spaceType: string | undefined;
  try {
    if (buildSpaceData) spaceType = (JSON.parse(buildSpaceData) as { space_type: string }).space_type;
  } catch (_e) { /* ignore */ }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={handleBack} hitSlop={12} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{technique.title}</Text>
        <TouchableOpacity onPress={handleQuitConfirm} hitSlop={12} style={s.quitBtn} activeOpacity={0.7}>
          <Text style={s.quitBtnText}>Quit</Text>
        </TouchableOpacity>
      </View>

      {/* Step dots */}
      <View style={s.dotsRow}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i < currentStepIndex && s.dotPast,
              i === currentStepIndex && s.dotCurrent,
              i > currentStepIndex && s.dotFuture,
            ]}
          />
        ))}
      </View>

      {/* Step content — self-managing types fill the remaining space */}
      {isSelfManaging && currentStep ? (
        <View style={s.flex}>
          {/* Week 1 — RFB timer with pre-start screen and bell sounds */}
          {isRFBTimer && (
            <RFBTimerStep
              breathingRate={breathingRate}
              onRateChange={setBreathingRate}
              onAdvance={advanceStep}
            />
          )}
          {/* Week 2 — Parts Mindfulness: combined breathing timer + experience log */}
          {currentStep.type === 'mindfulness-practice' && (
            <MindfulnessPracticeStep
              step={currentStep}
              onAdvance={(data) => handleComplexStepAdvance(currentStep.id, data)}
            />
          )}
          {currentStep.type === 'experience-log' && (
            <ExperienceLogStep
              step={currentStep}
              parts={parts}
              onAdvance={(data) => handleComplexStepAdvance(currentStep.id, data)}
              onGround={() => setGroundingVisible(true)}
              onPhaseChange={(phase) => { experienceLogPhaseRef.current = phase; }}
              returnToLogRef={expLogReturnToLogRef}
            />
          )}
          {currentStep.type === 'unblend-cycle' && (
            <UnblendCycleStep
              step={currentStep}
              targetPartName={targetPartName}
              parts={parts}
              onAdvance={(data) => handleComplexStepAdvance(currentStep.id, data)}
              onGround={() => setGroundingVisible(true)}
              selectedPartId={selectedPartId ?? undefined}
              onPhaseChange={(phase) => { unblendCyclePhaseRef.current = phase; }}
              returnToBaseRef={unblendCycleReturnRef}
              onPartSaved={(p) => setParts((prev) => [...prev, p])}
            />
          )}
          {currentStep.type === 'meeting-feel-towards' && (
            <MeetingFeelTowardsSeq
              initialPartIds={selectedPartIds}
              parts={parts}
              relMap={relMap}
              onRelMapUpdate={setRelMap}
              onPartAdded={(newPart) => {
                setParts((prev) =>
                  prev.some((p) => p.id === newPart.id) ? prev : [...prev, newPart],
                );
                setSelectedPartIds((prev) =>
                  prev.includes(newPart.id) ? prev : [...prev, newPart.id],
                );
              }}
              onComplete={() => advanceStep()}
              backRef={meetingFeelTowardsBackRef}
            />
          )}
          {currentStep.type === 'meeting-relational-map' && (
            <MeetingRelMap
              relMap={relMap}
              onContinue={() => advanceStep()}
            />
          )}
          {currentStep.type === 'inquiry-questions' && (
            <InquiryQuestionsStep
              step={currentStep}
              targetPartName={targetPartName}
              selectedPartId={selectedPartId}
              onAdvance={(data) => handleComplexStepAdvance(currentStep.id, data)}
              onGround={() => setGroundingVisible(true)}
              parts={parts}
              onPartSaved={(p) => setParts((prev) => [...prev, p])}
            />
          )}
          {currentStep.type === 'meeting-space-setup' && (
            <MeetingSpaceSetupStep
              step={currentStep}
              onAdvance={(data) => handleComplexStepAdvance(currentStep.id, data)}
            />
          )}
          {currentStep.type === 'meeting-rules' && (
            <MeetingRulesStep
              step={currentStep}
              onAdvance={(data) => handleComplexStepAdvance(currentStep.id, data)}
            />
          )}
          {currentStep.type === 'meeting-dialogue' && (
            <MeetingDialogueStep
              step={currentStep}
              parts={parts}
              selectedPartIds={selectedPartIds}
              spaceType={spaceType}
              onAdvance={(data) => handleComplexStepAdvance(currentStep.id, data)}
              onGround={() => setGroundingVisible(true)}
              onPartSaved={(p) => setParts((prev) => [...prev, p])}
              relMap={relMap}
              onRelMapUpdate={setRelMap}
            />
          )}
        </View>
      ) : (
        /* Simple step types — existing ScrollView + footer pattern */
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={s.flex}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {currentStep && (
              <StepContent
                key={currentStep.id}
                step={currentStep}
                stepResponse={stepResponse}
                chipSelection={chipSelection}
                selectedPartId={selectedPartId}
                selectedPartIds={selectedPartIds}
                parts={parts}
                techniqueId={technique.id}
                breathingRate={breathingRate}
                targetPartName={targetPartName}
                onResponseChange={handleResponseChange}
                onChipToggle={handleChipToggle}
                onSelectPart={handleSelectPart}
                onTogglePart={handleTogglePart}
                onPartSaved={(part) => setParts((prev) => [...prev, part])}
                onRateChange={setBreathingRate}
              />
            )}
            {/* Spacer for pinned button */}
            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Primary action button */}
          <View style={s.footer}>
            <TouchableOpacity
              style={[s.continueBtn, !canContinueMultiSelect && { opacity: 0.4 }]}
              onPress={handleContinue}
              disabled={!canContinueMultiSelect}
              activeOpacity={0.85}
            >
              <Text style={s.continueBtnText}>{buttonLabel}</Text>
              {buttonLabel !== "I'm done" && (
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Ground button — suppressed when the tray inside the component owns grounding */}
      {technique.has_ground_button &&
       currentStep?.type !== 'meeting-dialogue' &&
       currentStep?.type !== 'experience-log' &&
       currentStep?.type !== 'inquiry-questions' &&
       currentStep?.type !== 'unblend-cycle' &&
       currentStep?.type !== 'meeting-feel-towards' &&
       currentStep?.type !== 'meeting-relational-map' && (
        <View
          style={s.groundBtnWrap}
        >
          <TouchableOpacity
            style={s.groundBtn}
            activeOpacity={0.85}
            onPress={() => setGroundingVisible(true)}
          >
            <Ionicons name="leaf-outline" size={20} color="#9B9A94" />
          </TouchableOpacity>
          <Text style={s.groundBtnLabel}>Ground</Text>
        </View>
      )}

      {/* Grounding overlay */}
      {technique.has_ground_button && (
        <GroundingOverlay
          visible={groundingVisible}
          onReturn={() => setGroundingVisible(false)}
          onEndAndSave={async () => { setGroundingVisible(false); await handleSaveAndQuit(); }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A1917' },
  flex: { flex: 1 },
  errorText: { textAlign: 'center', marginTop: 80, color: '#6B6860', fontSize: 15 },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1, fontSize: 15, fontWeight: '600',
    color: 'rgba(255,255,255,0.75)', textAlign: 'center',
  },
  quitBtn: { padding: 4, minWidth: 36, alignItems: 'flex-end' },
  quitBtnText: { fontSize: 14, color: '#6B6860', fontWeight: '500' },
  headerRight: { width: 28 },
  // Step dots
  dotsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotPast: { backgroundColor: 'rgba(255,255,255,0.4)' },
  dotCurrent: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#B88A00' },
  dotFuture: { backgroundColor: 'rgba(255,255,255,0.12)' },
  // Scroll
  scrollContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20, flexGrow: 1 },
  // Footer
  footer: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#3B5BA5', borderRadius: 14, paddingVertical: 16,
  },
  continueBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  // Ground button
  groundBtnWrap: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    alignItems: 'center',
    gap: 4,
  },
  groundBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#1E1E1C',
    borderWidth: 1, borderColor: '#2A2927',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 5,
  },
  groundBtnLabel: {
    fontSize: 9, color: '#6B6860', textAlign: 'center',
  },
});
