/**
 * MindfulnessPracticeStep — 'mindfulness-practice' combined step type (Week 2).
 *
 * Zone A (top, fixed): compact breathing timer — Start/Pause/Resume, duration
 *   picker (5/10/15/20 min), sound toggle, elapsed time, Inhale/Exhale label.
 * Zone B (below, scrollable): experience log with + FAB to add entries.
 *
 * After each entry: UnblendSupportCard in mindfulness mode ("Something arose.")
 * Timer state lives in hooks — continues running during modals and support card.
 */

import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { UnblendSupportCard } from './UnblendSupportCard';
import { ExperienceLogEntry, type ExperienceEntry } from './ExperienceLogEntry';
import type { TechniqueStep } from '@/lib/techniques-data';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Thought',
  'Feeling',
  'Body sensation',
  'Impulse',
  'Memory',
  'Visual / image',
  'External stimulus',
];

const DURATION_OPTIONS = [5, 10, 15, 20];
const BREATH_RATE_MS   = 5000; // fixed 5 s per phase — not adjustable in this technique

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')} elapsed`;
}

// ─── Breathing Circle ─────────────────────────────────────────────────────────
// Animates only when running. Driven by phase prop (inhale → expand, exhale → contract).

function MindfulnessBreathingCircle({
  running,
  phase,
}: {
  running: boolean;
  phase: 'inhale' | 'exhale';
}) {
  const anim    = useRef(new Animated.Value(0.85)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    animRef.current?.stop();
    if (!running) return;
    const target = phase === 'inhale' ? 1.3 : 0.75;
    animRef.current = Animated.timing(anim, {
      toValue:         target,
      duration:        BREATH_RATE_MS,
      useNativeDriver: true,
    });
    animRef.current.start();
    return () => { animRef.current?.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase]);

  return (
    <View style={mbc.wrap}>
      <Animated.View style={[mbc.circle, { transform: [{ scale: anim }] }]} />
    </View>
  );
}

const mbc = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 110,
    marginBottom: 6,
  },
  circle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(184,138,0,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(184,138,0,0.5)',
  },
});

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  step: TechniqueStep;
  onAdvance: (data: string) => void;
}

export function MindfulnessPracticeStep({ step, onAdvance }: Props) {
  // Timer state
  const [timerRunning,          setTimerRunning]          = useState(false);
  const [elapsedSeconds,        setElapsedSeconds]        = useState(0);
  const [breathPhase,           setBreathPhase]           = useState<'inhale' | 'exhale'>('inhale');
  const [selectedDuration,      setSelectedDuration]      = useState(10);
  const [soundEnabled,          setSoundEnabled]          = useState(true);
  const [durationPickerVisible, setDurationPickerVisible] = useState(false);

  // Experience log state
  const [entries,          setEntries]          = useState<ExperienceEntry[]>([]);
  const [modalVisible,     setModalVisible]     = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [description,      setDescription]      = useState('');

  // Mindfulness support card
  const [showMindfulnessCard, setShowMindfulnessCard] = useState(false);
  const [pendingEntry,        setPendingEntry]        = useState<ExperienceEntry | null>(null);

  // Stable refs for async callbacks (avoids stale closure / effect restarts)
  const soundEnabledRef  = useRef(soundEnabled);
  const timerRunningRef  = useRef(timerRunning);
  useEffect(() => { soundEnabledRef.current  = soundEnabled;  }, [soundEnabled]);
  useEffect(() => { timerRunningRef.current  = timerRunning;  }, [timerRunning]);

  // Elapsed time counter — increments every second while running
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  // Breath phase toggle — fires every BREATH_RATE_MS while running
  // Also triggers bell sound at each transition.
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setBreathPhase((prev) => (prev === 'inhale' ? 'exhale' : 'inhale'));
      void playBell();
    }, BREATH_RATE_MS);
    return () => clearInterval(interval);
  // playBell is stable (reads refs, not captured state)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRunning]);

  // Bell sound — creates a fresh instance per ring so overlaps work naturally.
  async function playBell() {
    if (!soundEnabledRef.current || !timerRunningRef.current) return;
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/Bell.mp3') as number,
        { shouldPlay: true, volume: 1.0 },
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch {
      // Audio is enhancement only — fail silently
    }
  }

  // ── Experience log handlers ────────────────────────────────────────────────

  function openModal() {
    setSelectedCategory(null);
    setDescription('');
    setModalVisible(true);
  }

  function handleAddEntry() {
    if (!selectedCategory) return;
    const entry: ExperienceEntry = {
      id:          generateId(),
      category:    selectedCategory,
      description: description.trim() || undefined,
      timestamp:   formatTimestamp(new Date()),
      unblended:   false,
    };
    setModalVisible(false);
    setPendingEntry(entry);
    setShowMindfulnessCard(true);
    // Timer continues in background — hooks keep ticking regardless of render path
  }

  function handleNoted() {
    if (pendingEntry) {
      setEntries((prev) => [...prev, pendingEntry]);
      setPendingEntry(null);
    }
    setShowMindfulnessCard(false);
  }

  function handleDeleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function handleAddNote(id: string, note: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, additionalNotes: [...(e.additionalNotes ?? []), note] }
          : e,
      ),
    );
  }

  function handleDone() {
    onAdvance(JSON.stringify(entries));
  }

  // ── Mindfulness support card (early return — timer hooks keep running) ──────

  if (showMindfulnessCard && pendingEntry) {
    const partLabel = pendingEntry.description
      ? `${pendingEntry.category}: ${pendingEntry.description}`
      : pendingEntry.category;
    return (
      <UnblendSupportCard
        partName={partLabel}
        mode="mindfulness"
        onHaveSpace={handleNoted}
      />
    );
  }

  // ── Derived display values ─────────────────────────────────────────────────

  const startPauseLabel = !timerRunning && elapsedSeconds === 0
    ? 'Start'
    : timerRunning
      ? 'Pause'
      : 'Resume';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={mp.root}>
      {/* ── Zone A: Breathing timer (fixed height) ── */}
      <View style={mp.zoneA}>
        <MindfulnessBreathingCircle running={timerRunning} phase={breathPhase} />

        <Text style={mp.phaseLabel}>
          {timerRunning
            ? (breathPhase === 'inhale' ? 'Inhale' : 'Exhale')
            : (elapsedSeconds > 0 ? 'Paused' : step.heading)}
        </Text>
        <Text style={mp.elapsed}>{formatElapsed(elapsedSeconds)}</Text>

        {/* Controls row: duration | sound | start-pause */}
        <View style={mp.controlsRow}>
          {/* Duration picker trigger */}
          <TouchableOpacity
            style={mp.controlPill}
            onPress={() => setDurationPickerVisible(true)}
            activeOpacity={0.75}
          >
            <Text style={mp.controlPillText}>{selectedDuration} min</Text>
          </TouchableOpacity>

          {/* Sound toggle */}
          <TouchableOpacity
            style={mp.soundIconBtn}
            onPress={() => setSoundEnabled((v) => !v)}
            activeOpacity={0.75}
            accessibilityLabel={soundEnabled ? 'Mute bell' : 'Unmute bell'}
          >
            <Ionicons
              name={soundEnabled ? 'musical-notes-outline' : 'volume-mute-outline'}
              size={18}
              color="#9B9A94"
            />
          </TouchableOpacity>

          {/* Start / Pause / Resume */}
          <TouchableOpacity
            style={mp.controlPill}
            onPress={() => setTimerRunning((v) => !v)}
            activeOpacity={0.75}
          >
            <Text style={mp.controlPillText}>{startPauseLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Divider between zones */}
      <View style={mp.divider} />

      {/* ── Zone B: Scrollable experience log ── */}
      <ScrollView
        style={mp.scroll}
        contentContainerStyle={mp.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step.body ? <Text style={mp.bodyHint}>{step.body}</Text> : null}

        {entries.length === 0 ? (
          <Text style={mp.emptyState}>
            Nothing logged yet — breathe and notice what arises
          </Text>
        ) : (
          <View style={mp.entriesList}>
            {entries.map((entry) => (
              <ExperienceLogEntry
                key={entry.id}
                entry={entry}
                onDelete={() => handleDeleteEntry(entry.id)}
                onAddNote={(note) => handleAddNote(entry.id, note)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* + FAB — bottom: 80, right: 20 (above Done button) */}
      <TouchableOpacity style={mp.fab} onPress={openModal} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Done practicing — pinned footer */}
      <View style={mp.footer}>
        <TouchableOpacity style={mp.doneBtn} onPress={handleDone} activeOpacity={0.85}>
          <Text style={mp.doneBtnText}>Done practicing</Text>
        </TouchableOpacity>
      </View>

      {/* Add Experience Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={mo.overlay}>
          <View style={mo.sheet}>
            <View style={mo.handle} />

            <Text style={mo.label}>What arose?</Text>
            <View style={mo.chips}>
              {CATEGORIES.map((cat) => {
                const sel = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[mo.chip, sel && mo.chipSelected]}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.75}
                  >
                    <Text style={[mo.chipText, sel && mo.chipTextSelected]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedCategory && (
              <>
                <Text style={mo.label}>Briefly describe it</Text>
                <TextInput
                  style={mo.input}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g. 'a tightness in my chest', 'the urge to check my phone'"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoFocus
                />
              </>
            )}

            <View style={mo.actions}>
              <TouchableOpacity
                style={mo.cancelBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.75}
              >
                <Text style={mo.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[mo.addBtn, !selectedCategory && mo.addBtnDisabled]}
                onPress={handleAddEntry}
                disabled={!selectedCategory}
                activeOpacity={0.85}
              >
                <Text style={mo.addBtnText}>Add to log</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Duration picker modal */}
      <Modal
        visible={durationPickerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDurationPickerVisible(false)}
      >
        <TouchableOpacity
          style={dp.overlay}
          activeOpacity={1}
          onPress={() => setDurationPickerVisible(false)}
        >
          <View style={dp.sheet}>
            <Text style={dp.title}>Practice duration</Text>
            {DURATION_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[dp.option, selectedDuration === d && dp.optionSelected]}
                onPress={() => { setSelectedDuration(d); setDurationPickerVisible(false); }}
                activeOpacity={0.75}
              >
                <Text style={[dp.optionText, selectedDuration === d && dp.optionTextSelected]}>
                  {d} minutes
                </Text>
                {selectedDuration === d && (
                  <Ionicons name="checkmark" size={16} color="#B88A00" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const mp = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A1917' },

  // Zone A — breathing timer
  zoneA: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  phaseLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  elapsed: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  controlPill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  controlPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  soundIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // Zone B — experience log
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  bodyHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 20,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  emptyState: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 22,
  },
  entriesList: { gap: 10 },

  // + FAB — bottom: 160 clears the "Done practicing" pinned footer (≥ 8px gap)
  fab: {
    position: 'absolute',
    bottom: 160,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#B88A00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },

  // Done button footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1917',
    elevation: 8,
    zIndex: 999,
  },
  doneBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

// Add experience modal
const mo = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#242220',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: -4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected:     { backgroundColor: '#B88A00', borderColor: '#B88A00' },
  chipText:         { fontSize: 14, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  chipTextSelected: { color: '#FFFFFF' },
  input: {
    backgroundColor: '#2A2927',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
  },
  actions:          { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText:    { fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  addBtn: {
    flex: 2,
    backgroundColor: '#3B5BA5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnDisabled:   { opacity: 0.4 },
  addBtnText:       { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

// Duration picker modal
const dp = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 40,
  },
  sheet: {
    backgroundColor: '#242220',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  optionSelected:     { backgroundColor: 'rgba(184,138,0,0.1)' },
  optionText:         { fontSize: 16, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  optionTextSelected: { color: '#B88A00', fontWeight: '700' },
});
