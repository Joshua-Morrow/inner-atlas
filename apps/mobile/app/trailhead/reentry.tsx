/**
 * Trailhead — Re-Entry Flow
 * Route: /trailhead/reentry?sessionId=[id]
 *
 * Always shown before resuming a paused/active trail.
 * Never drops user cold into a mid-session state.
 *
 * Step 1 — Recognition: welcome back
 * Step 2 — Trail Summary: scrollable recap of all progress
 * Step 3 — Re-Grounding: depth-scaled grounding based on where paused
 * Step 4 — Confirmation: re-entry point stated clearly, then route
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  createSelfCheck,
  getChainEntries,
  getExileContact,
  getTrailheadSession,
  recordReentry,
  updateExileContact,
} from '@/lib/trailhead-db';
import type { ChainEntryWithPart, TrailheadSession } from '@/lib/trailhead-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

const PART_COLORS: Record<string, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
  unknown:     '#6B6860',
};

const ENERGY_LABELS: Record<number, string> = {
  1: 'Very scattered',
  2: 'Somewhat activated',
  3: 'Partially present',
  4: 'Mostly grounded',
  5: 'Settled and present',
};

function pausedWhereLabel(session: TrailheadSession, entries: ChainEntryWithPart[]): string {
  const phase = session.paused_at_phase;
  const card  = session.paused_at_card ?? '';
  const lastEntry = entries[entries.length - 1];
  const name  = lastEntry?.part_display_name ?? 'this part';

  if (!phase) return 'The session is active.';
  switch (phase) {
    case 'entry':            return 'The session paused during the opening.';
    case 'initial_self_check': return 'The session paused during the initial check-in.';
    case 'first_contact':    return `The session paused while making first contact with ${name}.`;
    case 'exile_transition': return 'You had reached what felt like an exile. The session paused before exile contact began.';
    case 'exile_contact':    return 'You were in exile contact when the session paused. Exile contact will restart from the beginning when you return.';
    case 'integration':      return 'The session was nearly complete.';
    case 'loop': {
      if (!card) return `The session paused while working with ${name}.`;
      if (['l_self_check','l_blending_check','l_blending_other','l_blending_ack'].includes(card))
        return `The session paused at the start of working with ${name}.`;
      if (['l_somatic','l_energy','l_duration','l_message','l_stance','l_fear','l_burden'].includes(card))
        return `You were getting to know ${name} when the session paused.`;
      if (['l_concerns','l_concern_desc','l_safety','l_fear_deeper','l_self_presence','l_agreement'].includes(card))
        return `You were in the negotiation stage with ${name} when the session paused.`;
      if (card === 'l_consent')
        return `The session paused at the consent question with ${name}.`;
      if (card === 'l_pivot' || card === 'l_branch')
        return `The session paused just after ${name} opened the way deeper.`;
      return `The session paused while working with ${name}.`;
    }
    default: return `The session paused during ${phase}.`;
  }
}

function reentryPointLabel(session: TrailheadSession, entries: ChainEntryWithPart[]): string {
  const phase = session.paused_at_phase;
  const lastEntry = entries[entries.length - 1];
  const name = lastEntry?.part_display_name ?? 'this part';

  if (phase === 'exile_transition' || phase === 'exile_contact') {
    return "We'll approach the exile from the beginning of exile contact.";
  }
  if (phase === 'loop') {
    const card = session.paused_at_card ?? '';
    if (['l_somatic','l_energy','l_duration','l_message','l_stance','l_fear','l_burden'].includes(card))
      return `We'll continue getting to know ${name}, picking up where you left off.`;
    if (['l_concerns','l_concern_desc','l_safety','l_fear_deeper','l_self_presence','l_agreement'].includes(card))
      return `We'll continue the negotiation stage with ${name}.`;
    if (card === 'l_pivot' || card === 'l_branch')
      return `We'll pick up at the pivot — asking ${name} what it's protecting.`;
    return `We'll continue working with ${name}.`;
  }
  if (phase === 'first_contact') {
    return `We'll pick up making contact with ${name}.`;
  }
  return "We'll pick up where you left off.";
}

function isNearExile(phase: string | null): boolean {
  return phase === 'exile_transition' || phase === 'exile_contact';
}

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
    <View style={bov.root}>
      <Text style={bov.headline}>Breathe with me.</Text>
      <View style={bov.circleWrap}>
        <Animated.View style={[bov.circle, { transform: [{ scale: breathAnim }] }]} />
      </View>
      <TouchableOpacity style={bov.skipBtn} onPress={onDone} activeOpacity={0.7}>
        <Text style={bov.skipText}>I feel steadier — continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const bov = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,19,18,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    zIndex: 100,
  },
  headline:   { fontSize: 22, fontWeight: '600', color: '#FFFFFF', marginBottom: 36, textAlign: 'center' },
  circleWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 36 },
  circle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
  },
  skipBtn:  { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  skipText: { fontSize: 14, color: 'rgba(255,255,255,0.55)' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

export default function TrailheadReentryScreen() {
  const { sessionId: sidParam } = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = parseInt(sidParam ?? '0', 10);

  const [step, setStep]           = useState<Step>(1);
  const [session, setSession]     = useState<TrailheadSession | null>(null);
  const [entries, setEntries]     = useState<ChainEntryWithPart[]>([]);
  const [working, setWorking]     = useState(false);

  // Step 3 — grounding
  const [energy, setEnergy]               = useState(3);
  const [groundingUsed, setGroundingUsed] = useState(false);
  const [showBreathing, setShowBreathing] = useState(false);
  const [orientNote, setOrientNote]       = useState('');

  // Step 3 — exile check
  const [exileCheckSel, setExileCheckSel] = useState<1 | 2 | 3 | null>(null);
  const [exileNotReadyShown, setExileNotReadyShown] = useState(false);

  // Saved phase before clearing (for routing decision)
  const savedPhase = useRef<string | null>(null);

  useEffect(() => {
    async function load() {
      const [sess, chain] = await Promise.all([
        getTrailheadSession(sessionId),
        getChainEntries(sessionId),
      ]);
      setSession(sess);
      setEntries(chain);
    }
    load();
  }, [sessionId]);

  async function handleEnergySave(level: number) {
    await createSelfCheck({
      sessionId,
      chainEntryId: null,
      phase: 'reentry',
      energyLevel: level,
      groundingUsed: groundingUsed ? 1 : 0,
    });
  }

  async function handleContinueToSession() {
    if (working || !session) return;
    setWorking(true);
    try {
      savedPhase.current = session.paused_at_phase;
      await recordReentry(sessionId);

      if (isNearExile(savedPhase.current)) {
        router.replace(`/trailhead/transition?sessionId=${sessionId}`);
      } else {
        router.replace(`/trailhead/session?sessionId=${sessionId}&mode=first_contact`);
      }
    } finally {
      setWorking(false);
    }
  }

  if (!session) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.loading}>
          <Text style={s.loadingText}>Loading trail...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const lastEntry     = entries[entries.length - 1];
  const nearExile     = isNearExile(session.paused_at_phase);
  const pausedWhere   = pausedWhereLabel(session, entries);
  const reentryPoint  = reentryPointLabel(session, entries);

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <BreathingOverlay
        visible={showBreathing}
        onDone={() => {
          setShowBreathing(false);
          setGroundingUsed(true);
          if (nearExile) {
            setExileCheckSel(null);
          }
        }}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.replace('/trailhead')} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#6B6860" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Returning to Trail</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ══ STEP 1 — Recognition ══ */}
        {step === 1 && (
          <View style={s.stepWrap}>
            <Text style={s.heading}>Welcome back</Text>
            <Text style={s.body}>
              You have an unfinished trail from {formatDateTime(session.updated_at)}.
              Before we continue, let's reconnect with where you were.
            </Text>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => setStep(2)}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>Show me where I left off</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══ STEP 2 — Trail Summary ══ */}
        {step === 2 && (
          <View style={s.stepWrap}>
            <Text style={s.heading}>Your trail so far</Text>

            {/* The Trailhead */}
            <Text style={s.sectionLabel}>The Trailhead</Text>
            <View style={s.summaryCard}>
              <Text style={s.summaryText}>
                You started with a{' '}
                <Text style={s.bold}>{session.entry_type}</Text>
                {' '}— "{session.entry_description}"
                {session.entry_intensity ? ` — intensity ${session.entry_intensity}/10` : ''}.
              </Text>
            </View>

            {/* Parts */}
            <Text style={s.sectionLabel}>Parts you've worked with</Text>
            {entries.length === 0 && (
              <View style={s.summaryCard}>
                <Text style={s.dimText}>No parts worked with yet.</Text>
              </View>
            )}
            {entries.map((e, i) => {
              const color = PART_COLORS[e.part_type ?? 'unknown'];
              return (
                <View key={e.id} style={s.partCard}>
                  <View style={s.partCardHeader}>
                    <View style={[s.typeBadge, { backgroundColor: color }]}>
                      <Text style={s.typeBadgeText}>{e.part_type ?? 'part'}</Text>
                    </View>
                    <Text style={s.partCardName}>{e.part_display_name ?? `Part ${i + 1}`}</Text>
                  </View>

                  {(e.protecting_against || e.part_energy_quality) ? (
                    <View style={s.partCardRow}>
                      <Text style={s.partCardLabel}>What it was doing</Text>
                      <Text style={s.partCardVal}>{e.protecting_against ?? e.part_energy_quality}</Text>
                    </View>
                  ) : null}

                  {e.fear_if_stopped ? (
                    <View style={s.partCardRow}>
                      <Text style={s.partCardLabel}>What it feared</Text>
                      <Text style={s.partCardVal}>{e.fear_if_stopped}</Text>
                    </View>
                  ) : null}

                  {e.consent_given ? (
                    <View style={s.partCardRow}>
                      <Text style={s.partCardLabel}>Consent</Text>
                      <Text style={s.partCardVal}>
                        {e.consent_given === 'yes' ? 'Willing to look deeper'
                        : e.consent_given === 'hesitant' ? 'Hesitant but willing'
                        : 'Not ready'}
                      </Text>
                    </View>
                  ) : null}

                  {e.somatic_body_regions ? (
                    <View style={s.partCardRow}>
                      <Text style={s.partCardLabel}>Body</Text>
                      <Text style={s.partCardVal}>{e.somatic_body_regions}</Text>
                    </View>
                  ) : null}

                  {e.other_parts_blending ? (
                    <View style={s.partCardRow}>
                      <Text style={s.partCardLabel}>Also activated</Text>
                      <Text style={s.partCardVal}>{e.other_parts_blending}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}

            {/* Where you stopped */}
            <Text style={s.sectionLabel}>Where you stopped</Text>
            <View style={s.summaryCard}>
              <Text style={s.summaryText}>{pausedWhere}</Text>
            </View>

            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => setStep(3)}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══ STEP 3 — Re-Grounding ══ */}
        {step === 3 && !nearExile && (
          <View style={s.stepWrap}>
            <Text style={s.heading}>Before we continue</Text>
            <Text style={s.body}>Take a moment. How are you feeling right now?</Text>

            {/* 1–5 energy scale */}
            <View style={s.energyWrap}>
              {[1,2,3,4,5].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[s.energyOpt, energy === n && s.energyOptSel]}
                  onPress={() => setEnergy(n)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.energyNum, energy === n && s.energyNumSel]}>{n}</Text>
                  <Text style={[s.energyLbl, energy === n && s.energyLblSel]}>{ENERGY_LABELS[n]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {energy <= 2 && (
              <TouchableOpacity
                style={s.breathBtn}
                onPress={() => setShowBreathing(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="heart-outline" size={16} color="#3B5BA5" />
                <Text style={s.breathBtnText}>Take a breathing break first</Text>
              </TouchableOpacity>
            )}

            {/* Orienting question */}
            {lastEntry?.part_display_name && (
              <>
                <Text style={[s.body, { marginTop: 20 }]}>
                  When you bring{' '}
                  <Text style={s.bold}>{lastEntry.part_display_name}</Text>
                  {' '}to mind, what do you notice — does it feel familiar, or different from when you left it?
                </Text>
                <TextInput
                  style={s.orientInput}
                  value={orientNote}
                  onChangeText={setOrientNote}
                  placeholder="A word or sentence is fine..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                />
              </>
            )}

            <TouchableOpacity
              style={s.primaryBtn}
              onPress={async () => {
                await handleEnergySave(energy);
                setStep(4);
              }}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>I'm ready</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && nearExile && (
          <View style={s.stepWrap}>
            <Text style={s.heading}>Returning to a tender place</Text>
            <Text style={s.body}>
              You left this session near a more vulnerable part of your system. Before we return, let's make sure you're grounded and present.
            </Text>

            <TouchableOpacity
              style={s.breathBtn}
              onPress={() => setShowBreathing(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="heart-outline" size={16} color="#7C3D9B" />
              <Text style={[s.breathBtnText, { color: '#7C3D9B' }]}>Take a breathing break</Text>
            </TouchableOpacity>

            {exileNotReadyShown ? (
              <View style={s.summaryCard}>
                <Text style={s.summaryText}>That's okay. Your trail will be here when you're ready.</Text>
                <TouchableOpacity
                  style={[s.primaryBtn, { marginTop: 12 }]}
                  onPress={() => router.replace('/trailhead')}
                  activeOpacity={0.85}
                >
                  <Text style={s.primaryBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 10, marginTop: 16 }}>
                {([
                  [1, 'Grounded and present'],
                  [2, 'A little activated — I\'d like a moment'],
                  [3, 'I\'m not sure I\'m ready to go further today'],
                ] as [1 | 2 | 3, string][]).map(([level, label]) => (
                  <TouchableOpacity
                    key={level}
                    style={[s.exileOpt, exileCheckSel === level && s.exileOptSel]}
                    onPress={async () => {
                      setExileCheckSel(level);
                      if (level === 1) {
                        await handleEnergySave(5);
                        setStep(4);
                      } else if (level === 2) {
                        setShowBreathing(true);
                      } else {
                        setExileNotReadyShown(true);
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={s.exileOptText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ══ STEP 4 — Confirmation ══ */}
        {step === 4 && (
          <View style={s.stepWrap}>
            <Text style={s.heading}>You're ready to continue.</Text>
            <Text style={s.body}>Here's where we're picking up:</Text>

            <View style={s.summaryCard}>
              <Text style={s.summaryText}>{reentryPoint}</Text>
            </View>

            <TouchableOpacity
              style={s.primaryBtn}
              onPress={handleContinueToSession}
              disabled={working}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAF8' },

  loading:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, color: '#6B6860' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1C1B19' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 24 },

  stepWrap: { gap: 16 },

  heading: { fontSize: 24, fontWeight: '700', color: '#1C1B19', lineHeight: 32 },
  body:    { fontSize: 15, color: '#6B6860', lineHeight: 24 },
  bold:    { fontWeight: '700', color: '#1C1B19' },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 6,
  },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 16,
  },
  summaryText: { fontSize: 14, color: '#1C1B19', lineHeight: 22 },
  dimText:     { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  partCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 14,
    marginBottom: 8,
    gap: 8,
  },
  partCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeBadge:     { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  typeBadgeText: { fontSize: 11, fontWeight: '600', color: '#FFFFFF', textTransform: 'capitalize' },
  partCardName:  { fontSize: 15, fontWeight: '600', color: '#1C1B19' },
  partCardRow:   { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  partCardLabel: { fontSize: 12, fontWeight: '500', color: '#6B6860', minWidth: 100 },
  partCardVal:   { flex: 1, fontSize: 12, color: '#1C1B19', lineHeight: 18 },

  energyWrap: { gap: 8 },
  energyOpt:    { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E3DE', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#FFFFFF' },
  energyOptSel: { borderColor: '#B88A00', backgroundColor: '#FFFBEB' },
  energyNum:    { fontSize: 17, fontWeight: '700', color: '#D1D5DB', minWidth: 22 },
  energyNumSel: { color: '#B88A00' },
  energyLbl:    { flex: 1, fontSize: 13, color: '#6B6860' },
  energyLblSel: { color: '#1C1B19' },

  breathBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E5E3DE',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  breathBtnText: { fontSize: 14, color: '#3B5BA5', fontWeight: '500' },

  orientInput: {
    borderWidth: 1,
    borderColor: '#E5E3DE',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1C1B19',
    backgroundColor: '#FFFFFF',
    minHeight: 64,
    textAlignVertical: 'top',
  },

  exileOpt: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 18,
    backgroundColor: '#FFFFFF',
  },
  exileOptSel: { borderColor: '#7C3D9B', backgroundColor: '#F5F0FF' },
  exileOptText: { fontSize: 15, color: '#1C1B19', textAlign: 'center' },

  primaryBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
