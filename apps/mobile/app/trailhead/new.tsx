/**
 * Trailhead — Entry Phase (Phases 1 & 2)
 * Route: /trailhead/new
 *
 * 7-card sequence:
 *   Phase 1 — Entry
 *     Card 1: entry type selection
 *     Card 2: entry description
 *     Card 3: intensity (1–10 slider)
 *     Card 4: body location (multi-select chips, optional)
 *     Card 5: sensation quality (freeform, optional)
 *   Phase 2 — Initial Self Check
 *     Card 6: self energy (1–5)
 *     Card 7: grounding offer (conditional if energy ≤ 2)
 *
 * On completion: creates trailhead_sessions row, routes to session.tsx
 */

import { useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

import { createSelfCheck, createTrailheadSession } from '@/lib/trailhead-db';
import type { EntryType } from '@/lib/trailhead-types';

// ─── Constants ────────────────────────────────────────────────────────────────

const BODY_CHIPS = [
  'Head','Throat','Chest','Heart','Stomach','Gut',
  'Back','Shoulders','Arms','Hands','Hips','Legs','Feet','Jaw','Whole body',
];

const ENERGY_LABELS: Record<number, string> = {
  1: 'Very scattered / overwhelmed',
  2: 'Somewhat activated',
  3: 'Partially present',
  4: 'Mostly grounded',
  5: 'Settled and present',
};

type CardId =
  | 'entry_type'
  | 'entry_desc'
  | 'intensity'
  | 'body_location'
  | 'sensation'
  | 'self_energy'
  | 'grounding_offer'
  | 'post_grounding_check';

// ─── Grounding Overlay ────────────────────────────────────────────────────────

function GroundingOverlay({
  visible,
  onReturn,
}: {
  visible: boolean;
  onReturn: () => void;
}) {
  const breathAnim = useRef(new Animated.Value(1)).current;

  // Start animation when visible
  if (visible) {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1.8, duration: 5000, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 1,   duration: 5000, useNativeDriver: true }),
      ]),
      { iterations: 3 }
    ).start();
  }

  if (!visible) return null;

  return (
    <View style={ov.root}>
      <Text style={ov.headline}>Let's slow down.</Text>
      <Text style={ov.subhead}>Take a few breaths before we begin.</Text>
      <View style={ov.breathWrapper}>
        <Animated.View style={[ov.circle, { transform: [{ scale: breathAnim }] }]} />
      </View>
      <Text style={ov.instruction}>Feel your feet on the floor.</Text>
      <Text style={ov.instruction}>Notice where you are right now.</Text>
      <TouchableOpacity style={ov.returnBtn} onPress={onReturn} activeOpacity={0.85}>
        <Text style={ov.returnBtnText}>I feel a bit steadier — continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const ov = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,25,23,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 100,
  },
  headline:     { fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 8, textAlign: 'center' },
  subhead:      { fontSize: 15, color: 'rgba(255,255,255,0.6)', marginBottom: 28, textAlign: 'center' },
  breathWrapper:{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 36 },
  circle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  instruction:  { fontSize: 15, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 24, marginBottom: 4 },
  returnBtn:    { marginTop: 36, backgroundColor: '#3B5BA5', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 24, alignItems: 'center', width: '100%' },
  returnBtnText:{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrailheadNewScreen() {
  const [card, setCard] = useState<CardId>('entry_type');
  const [saving, setSaving] = useState(false);
  const [showGrounding, setShowGrounding] = useState(false);

  // Phase 1
  const [entryType, setEntryType]           = useState<EntryType | null>(null);
  const [entryDesc, setEntryDesc]           = useState('');
  const [intensity, setIntensity]           = useState(5);
  const [bodyChips, setBodyChips]           = useState<string[]>([]);
  const [bodyOther, setBodyOther]           = useState('');
  const [bodySkipped, setBodySkipped]       = useState(false);
  const [sensation, setSensation]           = useState('');

  // Phase 2
  const [selfEnergy, setSelfEnergy]         = useState(3);
  const [postGroundEnergy, setPostGroundEnergy] = useState(3);
  const [groundingUsed, setGroundingUsed]   = useState(false);

  // ── Chip toggle ─────────────────────────────────────────────────────────────

  function toggleChip(chip: string) {
    setBodyChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  }

  // ── Progress dots (8 possible cards → 8 dots) ────────────────────────────

  const CARD_ORDER: CardId[] = [
    'entry_type','entry_desc','intensity','body_location','sensation',
    'self_energy','grounding_offer','post_grounding_check',
  ];
  const visibleDots = 7; // show 7 fixed dots; grounding card shares dot 6
  const dotIndex = Math.min(CARD_ORDER.indexOf(card), visibleDots - 1);

  // ── Complete → create session ────────────────────────────────────────────────

  async function finalize(finalEnergy: number, usedGrounding: boolean) {
    if (saving) return;
    setSaving(true);
    try {
      const bodyRegions = bodySkipped
        ? null
        : [
            ...bodyChips,
            ...(bodyOther.trim() ? [bodyOther.trim()] : []),
          ].join(', ') || null;

      const sessionId = await createTrailheadSession({
        entryType: entryType!,
        entryDescription: entryDesc.trim(),
        entryIntensity: intensity,
        entryBodyRegions: bodyRegions,
        entrySensationNotes: sensation.trim() || null,
        initialSelfEnergy: finalEnergy,
      });

      await createSelfCheck({
        sessionId,
        chainEntryId: null,
        phase: 'initial',
        energyLevel: finalEnergy,
        groundingUsed: usedGrounding ? 1 : 0,
        groundingType: usedGrounding ? 'breathing' : null,
      });

      router.replace(`/trailhead/session?sessionId=${sessionId}&mode=first_contact`);
    } finally {
      setSaving(false);
    }
  }

  // ── Advance card ─────────────────────────────────────────────────────────────

  function advance() {
    switch (card) {
      case 'entry_type':    return setCard('entry_desc');
      case 'entry_desc':    return setCard('intensity');
      case 'intensity':     return setCard('body_location');
      case 'body_location': return setCard('sensation');
      case 'sensation':     return setCard('self_energy');
      case 'self_energy':
        if (selfEnergy <= 2) {
          return setCard('grounding_offer');
        }
        return finalize(selfEnergy, false);
      case 'grounding_offer':
        setShowGrounding(true);
        return;
      case 'post_grounding_check':
        return finalize(postGroundEnergy, groundingUsed);
    }
  }

  // ── Entry type descriptions ───────────────────────────────────────────────

  const entryDescPrompt =
    entryType === 'thought'   ? 'What thought are you noticing?' :
    entryType === 'feeling'   ? 'What are you feeling right now?' :
    entryType === 'sensation' ? 'What sensation are you aware of?' :
    'What urge or impulse is present?';

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <GroundingOverlay
        visible={showGrounding}
        onReturn={() => {
          setShowGrounding(false);
          setGroundingUsed(true);
          setCard('post_grounding_check');
        }}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>New Trail</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* Progress dots */}
      <View style={s.dotsRow}>
        {Array.from({ length: visibleDots }).map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i === dotIndex ? s.dotActive : i < dotIndex ? s.dotPast : s.dotFuture,
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── CARD 1: Entry type ─────────────────────────────────────────── */}
          {card === 'entry_type' && (
            <View style={s.card}>
              <Text style={s.prompt}>What are you starting with today?</Text>
              {(['thought','feeling','sensation','impulse'] as EntryType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[s.optionCard, entryType === t && s.optionCardSelected]}
                  onPress={() => setEntryType(t)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.optionLabel, entryType === t && s.optionLabelSelected]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── CARD 2: Entry description ───────────────────────────────────── */}
          {card === 'entry_desc' && (
            <View style={s.card}>
              <Text style={s.prompt}>{entryDescPrompt}</Text>
              <TextInput
                style={s.textInput}
                placeholder="Write here..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                value={entryDesc}
                onChangeText={setEntryDesc}
                autoFocus
              />
            </View>
          )}

          {/* ── CARD 3: Intensity ───────────────────────────────────────────── */}
          {card === 'intensity' && (
            <View style={s.card}>
              <Text style={s.prompt}>How strong is this right now?</Text>
              <Text style={s.sliderValue}>{intensity} / 10</Text>
              <Slider
                style={{ width: '100%', height: 44, marginVertical: 16 }}
                minimumValue={1}
                maximumValue={10}
                step={1}
                value={intensity}
                onValueChange={(v) => setIntensity(Math.round(v))}
                minimumTrackTintColor="#3B5BA5"
                maximumTrackTintColor="rgba(255,255,255,0.15)"
                thumbTintColor="#FFFFFF"
              />
              <View style={s.sliderEnds}>
                <Text style={s.sliderEndText}>Mild</Text>
                <Text style={s.sliderEndText}>Intense</Text>
              </View>
            </View>
          )}

          {/* ── CARD 4: Body location ───────────────────────────────────────── */}
          {card === 'body_location' && (
            <View style={s.card}>
              <Text style={s.prompt}>Where do you notice this in your body?</Text>
              <View style={s.chipsWrap}>
                {BODY_CHIPS.map((chip) => (
                  <TouchableOpacity
                    key={chip}
                    style={[s.chip, bodyChips.includes(chip) && s.chipSelected]}
                    onPress={() => toggleChip(chip)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.chipText, bodyChips.includes(chip) && s.chipTextSelected]}>
                      {chip}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[s.textInput, { marginTop: 12 }]}
                placeholder="Other / describe..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={bodyOther}
                onChangeText={setBodyOther}
              />
            </View>
          )}

          {/* ── CARD 5: Sensation quality ───────────────────────────────────── */}
          {card === 'sensation' && (
            <View style={s.card}>
              <Text style={s.prompt}>How would you describe the quality of this sensation?</Text>
              <TextInput
                style={s.textInput}
                placeholder="Write here..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                value={sensation}
                onChangeText={setSensation}
                autoFocus
              />
            </View>
          )}

          {/* ── CARD 6: Self energy ─────────────────────────────────────────── */}
          {card === 'self_energy' && (
            <View style={s.card}>
              <Text style={s.prompt}>
                Before we begin — take a moment to arrive.{'\n'}How present do you feel right now?
              </Text>
              {[1,2,3,4,5].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[s.energyOption, selfEnergy === n && s.energyOptionSelected]}
                  onPress={() => setSelfEnergy(n)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.energyNum, selfEnergy === n && s.energyNumSelected]}>{n}</Text>
                  <Text style={[s.energyLabel, selfEnergy === n && s.energyLabelSelected]}>
                    {ENERGY_LABELS[n]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── CARD 7: Grounding offer ─────────────────────────────────────── */}
          {card === 'grounding_offer' && (
            <View style={s.card}>
              <Text style={s.prompt}>
                It sounds like things are quite activated right now. Would you like to take a few minutes to ground before we begin?
              </Text>
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={advance}
                activeOpacity={0.85}
              >
                <Text style={s.primaryBtnText}>Yes, let's ground</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.secondaryBtn}
                onPress={() => finalize(selfEnergy, false)}
                activeOpacity={0.85}
              >
                <Text style={s.secondaryBtnText}>Continue anyway</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── CARD 8: Post-grounding check ───────────────────────────────── */}
          {card === 'post_grounding_check' && (
            <View style={s.card}>
              <Text style={s.prompt}>How are you feeling now?</Text>
              {[1,2,3,4,5].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[s.energyOption, postGroundEnergy === n && s.energyOptionSelected]}
                  onPress={() => setPostGroundEnergy(n)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.energyNum, postGroundEnergy === n && s.energyNumSelected]}>{n}</Text>
                  <Text style={[s.energyLabel, postGroundEnergy === n && s.energyLabelSelected]}>
                    {ENERGY_LABELS[n]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom action button */}
      {card !== 'grounding_offer' && (
        <View style={s.bottomBar}>
          {/* Skip for optional cards */}
          {(card === 'body_location' || card === 'sensation') && (
            <TouchableOpacity
              style={s.skipBtn}
              onPress={() => {
                if (card === 'body_location') setBodySkipped(true);
                advance();
              }}
              activeOpacity={0.7}
            >
              <Text style={s.skipBtnText}>
                {card === 'body_location' ? 'Not sure — skip' : 'Skip for now'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              s.continueBtn,
              (saving ||
                (card === 'entry_type' && !entryType) ||
                (card === 'entry_desc' && !entryDesc.trim())
              ) && s.continueBtnDisabled,
            ]}
            onPress={advance}
            disabled={
              saving ||
              (card === 'entry_type' && !entryType) ||
              (card === 'entry_desc' && !entryDesc.trim())
            }
            activeOpacity={0.85}
          >
            <Text style={s.continueBtnText}>
              {card === 'self_energy' && selfEnergy <= 2
                ? 'Next'
                : card === 'post_grounding_check' || card === 'self_energy'
                ? 'Begin Trail'
                : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BG = '#1A1917';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },

  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  dot:       { height: 7, borderRadius: 4, width: 7 },
  dotActive: { backgroundColor: 'rgba(255,255,255,0.9)', width: 16 },
  dotPast:   { backgroundColor: 'rgba(255,255,255,0.35)' },
  dotFuture: { backgroundColor: 'rgba(255,255,255,0.12)' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 20 },

  card: { gap: 12 },

  prompt: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 28,
    marginBottom: 8,
  },

  // Entry type options
  optionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  optionCardSelected: {
    borderColor: '#3B5BA5',
    backgroundColor: 'rgba(59,91,165,0.18)',
  },
  optionLabel: { fontSize: 16, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  optionLabelSelected: { color: '#FFFFFF', fontWeight: '600' },

  // Text input
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Intensity slider
  sliderValue: { fontSize: 36, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  sliderEnds:  { flexDirection: 'row', justifyContent: 'space-between' },
  sliderEndText: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },

  // Body chips
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipSelected: { borderColor: '#3B5BA5', backgroundColor: 'rgba(59,91,165,0.2)' },
  chipText:    { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '600' },

  // Energy options
  energyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  energyOptionSelected: {
    borderColor: '#B88A00',
    backgroundColor: 'rgba(184,138,0,0.12)',
  },
  energyNum: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.5)', minWidth: 24 },
  energyNumSelected: { color: '#B88A00' },
  energyLabel: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  energyLabelSelected: { color: 'rgba(255,255,255,0.9)' },

  // Grounding offer buttons
  primaryBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 15 },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 22,
    paddingBottom: 34,
    paddingTop: 12,
    backgroundColor: BG,
    elevation: 8,
    zIndex: 999,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 6,
  },
  skipBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.45)' },
  continueBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  continueBtnDisabled: { opacity: 0.35 },
  continueBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
