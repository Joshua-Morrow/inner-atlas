/**
 * Trailhead — Main Session (Phases 3–5)
 * Route: /trailhead/session?sessionId=[id]&mode=[first_contact|exile_contact]
 *
 * Manages:
 *   Phase 3 — First Part Contact (P3-1 through P3-3)
 *   Phase 4 — Core Loop (L-1 through L-15 + Pivot + Branch) — repeats N times
 *   Phase 5 — Exile Contact (E-1 through E-6) — entered after transition.tsx
 *
 * Incremental saves: every card writes to DB before advancing.
 * Ground button: always visible (heart icon, opens overlay).
 * Trail chain indicator: grows as parts are confirmed.
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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  createChainEntry,
  createExileContact,
  createExilePartForTrailhead,
  createPartForTrailhead,
  createSelfCheck,
  getAllParts,
  getChainEntries,
  getExileContact,
  getProtectorParts,
  getTrailheadSession,
  updateChainEntry,
  updateExileContact,
  updateTrailheadSession,
} from '@/lib/trailhead-db';
import type { ChainEntryWithPart, PartSummary } from '@/lib/trailhead-types';

// ─── Types ────────────────────────────────────────────────────────────────────

type CardId =
  // Phase 3
  | 'p3_part_select'
  | 'p3_sensing'
  | 'p3_unblending'
  | 'p3_unblend_support'
  // Loop
  | 'l_self_check'
  | 'l_blending_check'
  | 'l_blending_other'
  | 'l_blending_ack'
  | 'l_somatic'
  | 'l_energy'
  | 'l_duration'
  | 'l_message'
  | 'l_stance'
  | 'l_fear'
  | 'l_burden'
  | 'l_concerns'
  | 'l_concern_desc'
  | 'l_safety'
  | 'l_fear_deeper'
  | 'l_self_presence'
  | 'l_agreement'
  | 'l_consent'
  | 'l_consent_refused'
  | 'l_pivot'
  | 'l_branch'
  | 'l_branch_unsure'
  | 'l_new_part_select'
  // Exile contact
  | 'e_sensing'
  | 'e_somatic'
  | 'e_carries'
  | 'e_needs'
  | 'e_witnessing'
  | 'e_response'
  | 'e_felt_seen';

const BODY_CHIPS = [
  'Head','Throat','Chest','Heart','Stomach','Gut',
  'Back','Shoulders','Arms','Hands','Hips','Legs','Feet','Jaw','Whole body',
];

const ENERGY_LABELS: Record<number, string> = {
  1: 'Very scattered',
  2: 'Somewhat activated',
  3: 'Partially present',
  4: 'Mostly grounded',
  5: 'Settled and present',
};

const PART_COLORS: Record<string, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
  unknown:     '#6B6860',
};

// ─── Grounding Overlay ────────────────────────────────────────────────────────

function GroundingOverlay({
  visible,
  onReturn,
  onPause,
}: {
  visible: boolean;
  onReturn: () => void;
  onPause: () => void;
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
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      breathAnim.setValue(1);
    }
    return () => { loopRef.current?.stop(); };
  }, [visible, breathAnim]);

  if (!visible) return null;

  return (
    <View style={ov.root}>
      <Text style={ov.headline}>Let's slow down.</Text>
      <Text style={ov.subhead}>Take a breath with me.</Text>
      <View style={ov.breathWrapper}>
        <Animated.View style={[ov.circle, { transform: [{ scale: breathAnim }] }]} />
      </View>
      <Text style={ov.instruction}>Feel your feet on the floor.</Text>
      <Text style={ov.instruction}>Notice three things you can see right now.</Text>
      <View style={ov.btns}>
        <TouchableOpacity style={ov.returnBtn} onPress={onReturn} activeOpacity={0.85}>
          <Text style={ov.returnBtnText}>I feel steadier — return to session</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ov.pauseBtn} onPress={onPause} activeOpacity={0.85}>
          <Text style={ov.pauseBtnText}>Close and save trail</Text>
        </TouchableOpacity>
      </View>
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
    zIndex: 200,
  },
  headline:     { fontSize: 26, fontWeight: '700', color: '#FFFFFF', marginBottom: 6, textAlign: 'center' },
  subhead:      { fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 28, textAlign: 'center' },
  breathWrapper:{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  circle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  instruction:  { fontSize: 15, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 26, marginBottom: 4 },
  btns:         { width: '100%', marginTop: 40, gap: 12 },
  returnBtn:    { backgroundColor: '#3B5BA5', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  returnBtnText:{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  pauseBtn:     { borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  pauseBtnText: { color: 'rgba(255,255,255,0.55)', fontSize: 14 },
});

// ─── Trail Chain Indicator ────────────────────────────────────────────────────

function ChainIndicator({ entries }: { entries: ChainEntryWithPart[] }) {
  const [tooltip, setTooltip] = useState<number | null>(null);

  if (entries.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={ci.row}
      style={ci.wrap}
    >
      {entries.map((e, i) => {
        const color = PART_COLORS[e.part_type ?? 'unknown'];
        const name  = e.part_display_name ?? '?';
        return (
          <View key={e.id} style={ci.itemWrap}>
            {i > 0 && <View style={ci.line} />}
            <TouchableOpacity
              style={[ci.node, { backgroundColor: color }]}
              onPress={() => setTooltip(tooltip === e.id ? null : e.id)}
              activeOpacity={0.75}
            >
              <Text style={ci.nodeText}>{name.charAt(0).toUpperCase()}</Text>
            </TouchableOpacity>
            {tooltip === e.id && (
              <View style={ci.tooltip}>
                <Text style={ci.tooltipText}>{name}</Text>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const ci = StyleSheet.create({
  wrap: { maxHeight: 44, flexShrink: 0 },
  row:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  itemWrap: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  line: { width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  node: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  nodeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  tooltip: {
    position: 'absolute',
    bottom: 34,
    left: -20,
    backgroundColor: 'rgba(30,29,27,0.95)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 80,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 10,
  },
  tooltipText: { fontSize: 11, color: '#FFFFFF', textAlign: 'center' },
});

// ─── Shared sub-components ────────────────────────────────────────────────────

function Prompt({ text }: { text: string }) {
  return <Text style={sh.prompt}>{text}</Text>;
}

function FreeText({
  value,
  onChange,
  placeholder = 'Write here...',
  hint,
  autoFocus = false,
}: {
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  hint?: string;
  autoFocus?: boolean;
}) {
  const [hintOpen, setHintOpen] = useState(false);
  return (
    <View>
      <TextInput
        style={sh.input}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.25)"
        multiline
        value={value}
        onChangeText={onChange}
        autoFocus={autoFocus}
      />
      {hint && (
        <TouchableOpacity
          onPress={() => setHintOpen(!hintOpen)}
          style={sh.hintToggle}
          activeOpacity={0.7}
        >
          <Text style={sh.hintToggleText}>
            {hintOpen ? 'Hide examples' : 'Not sure what to write? Some ways in:'}
          </Text>
        </TouchableOpacity>
      )}
      {hint && hintOpen && (
        <Text style={sh.hintText}>{hint}</Text>
      )}
    </View>
  );
}

function BodyChips({
  selected,
  onChange,
  other,
  onOtherChange,
}: {
  selected: string[];
  onChange: (chips: string[]) => void;
  other: string;
  onOtherChange: (t: string) => void;
}) {
  function toggle(chip: string) {
    onChange(selected.includes(chip) ? selected.filter((c) => c !== chip) : [...selected, chip]);
  }
  return (
    <View>
      <View style={sh.chipsWrap}>
        {BODY_CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip}
            style={[sh.chip, selected.includes(chip) && sh.chipSel]}
            onPress={() => toggle(chip)}
            activeOpacity={0.75}
          >
            <Text style={[sh.chipText, selected.includes(chip) && sh.chipTextSel]}>{chip}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={[sh.input, { marginTop: 10, minHeight: 44 }]}
        placeholder="Other / describe..."
        placeholderTextColor="rgba(255,255,255,0.25)"
        value={other}
        onChangeText={onOtherChange}
      />
    </View>
  );
}

function EnergyScale({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={sh.energyWrap}>
      {[1,2,3,4,5].map((n) => (
        <TouchableOpacity
          key={n}
          style={[sh.energyOpt, value === n && sh.energyOptSel]}
          onPress={() => onChange(n)}
          activeOpacity={0.75}
        >
          <Text style={[sh.energyNum, value === n && sh.energyNumSel]}>{n}</Text>
          <Text style={[sh.energyLbl, value === n && sh.energyLblSel]}>{ENERGY_LABELS[n]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PartPicker({
  parts,
  selectedId,
  onSelect,
}: {
  parts: PartSummary[];
  selectedId: string | null;
  onSelect: (p: PartSummary) => void;
}) {
  return (
    <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
      {parts.map((p) => {
        const color = PART_COLORS[p.type] ?? '#6B6860';
        const sel = selectedId === p.id;
        return (
          <TouchableOpacity
            key={p.id}
            style={[sh.partRow, sel && { borderColor: color, backgroundColor: `${color}22` }]}
            onPress={() => onSelect(p)}
            activeOpacity={0.75}
          >
            <View style={[sh.partDot, { backgroundColor: color }]} />
            <Text style={sh.partName}>{p.display_name}</Text>
            <Text style={sh.partType}>{p.type}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const sh = StyleSheet.create({
  prompt: { fontSize: 19, fontWeight: '600', color: '#FFFFFF', lineHeight: 28, marginBottom: 16 },
  input: {
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
  hintToggle: { marginTop: 8 },
  hintToggleText: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' },
  hintText: {
    marginTop: 6,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
    lineHeight: 20,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.15)',
    paddingLeft: 10,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:    { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 13, paddingVertical: 6 },
  chipSel: { borderColor: '#3B5BA5', backgroundColor: 'rgba(59,91,165,0.2)' },
  chipText:    { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  chipTextSel: { color: '#FFFFFF', fontWeight: '600' },
  energyWrap: { gap: 8 },
  energyOpt:    { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.04)' },
  energyOptSel: { borderColor: '#B88A00', backgroundColor: 'rgba(184,138,0,0.12)' },
  energyNum:    { fontSize: 17, fontWeight: '700', color: 'rgba(255,255,255,0.4)', minWidth: 22 },
  energyNumSel: { color: '#B88A00' },
  energyLbl:    { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  energyLblSel: { color: 'rgba(255,255,255,0.9)' },
  partRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  partDot: { width: 10, height: 10, borderRadius: 5 },
  partName: { flex: 1, fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  partType: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrailheadSessionScreen() {
  const { sessionId: sidParam, mode } = useLocalSearchParams<{
    sessionId: string;
    mode: string;
  }>();
  const sessionId = parseInt(sidParam ?? '0', 10);
  const isExileMode = mode === 'exile_contact';

  // ── State ────────────────────────────────────────────────────────────────────

  const [card, setCard] = useState<CardId>(isExileMode ? 'e_sensing' : 'p3_part_select');
  const [showGround, setShowGround] = useState(false);
  const [saving, setSaving] = useState(false);

  // Chain data (visualizer)
  const [chainEntries, setChainEntries] = useState<ChainEntryWithPart[]>([]);

  // Current chain entry (loop iteration)
  const chainEntryId = useRef<number | null>(null);
  const chainPosition = useRef<number>(1);

  // Exile contact record
  const exileContactId = useRef<number | null>(null);

  // Available parts
  const [allParts, setAllParts]       = useState<PartSummary[]>([]);
  const [protectorParts, setProtectorParts] = useState<PartSummary[]>([]);

  // P3 / Loop — current part
  const [selectedPart, setSelectedPart]   = useState<PartSummary | null>(null);
  const [newPartName, setNewPartName]     = useState('');
  const [newPartType, setNewPartType]     = useState<'manager' | 'firefighter'>('manager');
  const [isNewPart, setIsNewPart]         = useState(false);
  const [pickMode, setPickMode]           = useState<'existing' | 'new'>('existing');

  // P3 cards
  const [p3Sensing, setP3Sensing]         = useState('');
  const [unblendingVal, setUnblendingVal] = useState<'yes' | 'somewhat' | 'not_yet' | null>(null);
  const [unblendRetry, setUnblendRetry]   = useState<'yes' | 'somewhat' | 'not_yet' | null>(null);

  // Loop cards
  const [selfEnergy, setSelfEnergy]       = useState(3);
  const [groundingDone, setGroundingDone] = useState(false);
  const [blendingOther, setBlendingOther] = useState(false);
  const [otherPartId, setOtherPartId]     = useState<string | null>(null);
  const [blendingNote, setBlendingNote]   = useState('');
  const [bodyChips, setBodyChips]         = useState<string[]>([]);
  const [bodyOther, setBodyOther]         = useState('');
  const [energyQuality, setEnergyQuality] = useState('');
  const [roleDuration, setRoleDuration]   = useState('');
  const [msgToSelf, setMsgToSelf]         = useState('');
  const [stanceToSelf, setStanceToSelf]   = useState('');
  const [fearStopped, setFearStopped]     = useState('');
  const [roleBurden, setRoleBurden]       = useState('');
  const [hasConcerns, setHasConcerns]     = useState<boolean | null>(null);
  const [concernDesc, setConcernDesc]     = useState('');
  const [safetyNeeds, setSafetyNeeds]     = useState('');
  const [fearDeeper, setFearDeeper]       = useState('');
  const [selfPresence, setSelfPresence]   = useState<number | null>(null);
  const [agreement, setAgreement]         = useState('');
  const [consent, setConsent]             = useState<'yes' | 'hesitant' | 'no' | null>(null);
  const [pivotNote, setPivotNote]         = useState('');
  const [branchUnsureCount, setBranchUnsureCount] = useState(0);

  // Exile contact cards
  const [eApparent, setEApparent]         = useState('');
  const [eBodyChips, setEBodyChips]       = useState<string[]>([]);
  const [eBodyOther, setEBodyOther]       = useState('');
  const [eCarries, setECarries]           = useState('');
  const [eNeeds, setENeeds]               = useState('');
  const [eResponse, setEResponse]         = useState('');
  const [eFeltSeen, setEFeltSeen]         = useState<boolean | null>(null);

  // ── Load on mount ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const [existing, prot, all] = await Promise.all([
        getChainEntries(sessionId),
        getProtectorParts(),
        getAllParts(),
      ]);
      setChainEntries(existing);
      setProtectorParts(prot);
      setAllParts(all);
      chainPosition.current = existing.length + 1;

      if (isExileMode) {
        // Create or find existing exile contact record
        const ec = await getExileContact(sessionId);
        if (ec) {
          exileContactId.current = ec.id;
        } else {
          const ecId = await createExileContact(sessionId);
          exileContactId.current = ecId;
        }
        await updateTrailheadSession(sessionId, { currentPhase: 'exile_contact' });
      }
    }
    load();
  }, [sessionId, isExileMode]);

  // Back handler — warn before exit
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        Alert.alert(
          'Leave session?',
          'Your progress is saved. You can resume this trail at any time.',
          [
            { text: 'Stay', style: 'cancel' },
            {
              text: 'Leave',
              onPress: () => {
                updateTrailheadSession(sessionId, {
                  pausedAtPhase: isExileMode ? 'exile_contact' : 'loop',
                  pausedAtCard: card,
                  status: 'paused',
                }).then(() => router.replace('/trailhead'));
              },
            },
          ]
        );
        return true;
      });
      return () => sub.remove();
    }, [sessionId, card, isExileMode])
  );

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const partName = (selectedPart?.display_name ?? newPartName) || 'this part';
  const partColor = PART_COLORS[selectedPart?.type ?? 'unknown'];

  function resetLoopState() {
    setP3Sensing('');
    setUnblendingVal(null);
    setUnblendRetry(null);
    setSelfEnergy(3);
    setGroundingDone(false);
    setBlendingOther(false);
    setOtherPartId(null);
    setBlendingNote('');
    setBodyChips([]);
    setBodyOther('');
    setEnergyQuality('');
    setRoleDuration('');
    setMsgToSelf('');
    setStanceToSelf('');
    setFearStopped('');
    setRoleBurden('');
    setHasConcerns(null);
    setConcernDesc('');
    setSafetyNeeds('');
    setFearDeeper('');
    setSelfPresence(null);
    setAgreement('');
    setConsent(null);
    setPivotNote('');
    setSelectedPart(null);
    setNewPartName('');
    setIsNewPart(false);
    setPickMode('existing');
  }

  async function refreshChain() {
    const entries = await getChainEntries(sessionId);
    setChainEntries(entries);
  }

  async function pauseSession() {
    await updateTrailheadSession(sessionId, {
      pausedAtPhase: isExileMode ? 'exile_contact' : 'loop',
      pausedAtCard: card,
      status: 'paused',
    });
    router.replace('/trailhead/integration?sessionId=' + sessionId + '&readOnly=0&partial=1');
  }

  // ── Part resolution ──────────────────────────────────────────────────────────

  async function resolvePartId(): Promise<string | null> {
    if (isNewPart && newPartName.trim()) {
      const id = await createPartForTrailhead(newPartName.trim(), newPartType);
      const newP: PartSummary = { id, display_name: newPartName.trim(), type: newPartType };
      setSelectedPart(newP);
      setProtectorParts((prev) => [...prev, newP]);
      setAllParts((prev) => [...prev, newP]);
      return id;
    }
    return selectedPart?.id ?? null;
  }

  // ── Phase 3 handlers ────────────────────────────────────────────────────────

  async function handleP3PartConfirm() {
    if (saving) return;
    setSaving(true);
    try {
      const partId = await resolvePartId();
      const entryId = await createChainEntry({
        sessionId,
        partId,
        partIsNew: isNewPart ? 1 : 0,
        chainPosition: chainPosition.current,
      });
      chainEntryId.current = entryId;
      await updateTrailheadSession(sessionId, {
        currentPhase: 'first_contact',
        currentLoopPartId: partId,
      });
      await refreshChain();
      setCard('p3_sensing');
    } finally {
      setSaving(false);
    }
  }

  async function handleP3Sensing(skip = false) {
    if (saving) return;
    setSaving(true);
    try {
      if (!skip && p3Sensing.trim()) {
        await updateChainEntry(chainEntryId.current!, { part_energy_quality: p3Sensing.trim() });
      }
      setCard('p3_unblending');
    } finally {
      setSaving(false);
    }
  }

  async function handleUnblending(val: 'yes' | 'somewhat' | 'not_yet', isRetry = false) {
    const field = isRetry ? 'retry' : 'first';
    if (val === 'not_yet' && field === 'first') {
      setUnblendingVal(val);
      setCard('p3_unblend_support');
      return;
    }
    const achieved = val !== 'not_yet' ? 1 : 0;
    const notes = val === 'not_yet' ? 'Persistent blending — session continued' : null;
    await updateChainEntry(chainEntryId.current!, {
      unblending_achieved: achieved,
      unblending_notes: notes,
    });
    // After Phase 3, begin loop at L-1
    await updateTrailheadSession(sessionId, { currentPhase: 'loop' });
    setCard('l_self_check');
  }

  // ── Loop handlers ────────────────────────────────────────────────────────────

  async function handleSelfCheck(energy: number) {
    if (saving) return;
    setSaving(true);
    try {
      await createSelfCheck({
        sessionId,
        chainEntryId: chainEntryId.current,
        phase: 'loop',
        energyLevel: energy,
        groundingUsed: groundingDone ? 1 : 0,
      });
      await updateChainEntry(chainEntryId.current!, { self_energy_at_contact: energy });
      if (energy <= 2) {
        setShowGround(true); // ground first, then blending check
      } else {
        setCard('l_blending_check');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleBlendingCheck(hasOther: boolean) {
    if (!hasOther) {
      setCard('l_somatic');
      return;
    }
    setBlendingOther(true);
    setCard('l_blending_other');
  }

  async function handleBlendingOtherDone() {
    if (saving) return;
    setSaving(true);
    try {
      const ids = otherPartId ? JSON.stringify([otherPartId]) : null;
      await updateChainEntry(chainEntryId.current!, {
        other_parts_blending: ids,
        blending_notes: blendingNote.trim() || null,
      });
      setCard('l_blending_ack');
    } finally {
      setSaving(false);
    }
  }

  async function handleSomatic(skip = false) {
    if (saving) return;
    setSaving(true);
    try {
      if (!skip) {
        const regions = [...bodyChips, ...(bodyOther.trim() ? [bodyOther.trim()] : [])].join(', ') || null;
        await updateChainEntry(chainEntryId.current!, {
          somatic_body_regions: regions,
          somatic_sensation_desc: bodyOther.trim() || null,
        });
      }
      setCard('l_energy');
    } finally {
      setSaving(false);
    }
  }

  async function saveAndAdvance(
    updates: Parameters<typeof updateChainEntry>[1],
    next: CardId,
    skip = false
  ) {
    if (saving) return;
    setSaving(true);
    try {
      if (!skip) await updateChainEntry(chainEntryId.current!, updates);
      setCard(next);
    } finally {
      setSaving(false);
    }
  }

  async function handleConsent(val: 'yes' | 'hesitant' | 'no') {
    if (saving) return;
    setSaving(true);
    try {
      setConsent(val);
      await updateChainEntry(chainEntryId.current!, {
        consent_given: val,
        loop_outcome: val === 'no' ? 'refused' : undefined,
      });
      if (val === 'no') {
        setCard('l_consent_refused');
      } else {
        setCard('l_pivot');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePivot() {
    if (!pivotNote.trim()) return;
    if (saving) return;
    setSaving(true);
    try {
      await updateChainEntry(chainEntryId.current!, {
        protecting_against: pivotNote.trim(),
        next_layer_notes: pivotNote.trim(),
      });
      setCard('l_branch');
    } finally {
      setSaving(false);
    }
  }

  async function handleBranch(choice: 'another' | 'exile' | 'unsure') {
    if (choice === 'unsure') {
      if (branchUnsureCount >= 1) {
        // After second unsure, default to asking again
      }
      setBranchUnsureCount((n) => n + 1);
      setCard('l_branch_unsure');
      return;
    }
    if (choice === 'exile') {
      await updateChainEntry(chainEntryId.current!, { loop_outcome: 'exile_sensed' });
      await updateTrailheadSession(sessionId, { currentPhase: 'exile_transition' });
      router.replace(`/trailhead/transition?sessionId=${sessionId}`);
      return;
    }
    // another protector — start new loop iteration
    await updateChainEntry(chainEntryId.current!, { loop_outcome: 'deeper' });
    chainPosition.current += 1;
    resetLoopState();
    setCard('l_new_part_select');
  }

  async function handleNewPartForLoop() {
    if (saving) return;
    setSaving(true);
    try {
      const partId = await resolvePartId();
      const entryId = await createChainEntry({
        sessionId,
        partId,
        partIsNew: isNewPart ? 1 : 0,
        chainPosition: chainPosition.current,
      });
      chainEntryId.current = entryId;
      await updateTrailheadSession(sessionId, { currentLoopPartId: partId });
      await refreshChain();
      setCard('l_self_check');
    } finally {
      setSaving(false);
    }
  }

  // ── Exile contact handlers ───────────────────────────────────────────────────

  async function handleExileSensing() {
    if (saving) return;
    setSaving(true);
    try {
      await updateExileContact(exileContactId.current!, {
        apparent_age_quality: eApparent.trim() || null,
      });
      setCard('e_somatic');
    } finally {
      setSaving(false);
    }
  }

  async function handleExileSomatic(skip = false) {
    if (saving) return;
    setSaving(true);
    try {
      if (!skip) {
        const regions = [...eBodyChips, ...(eBodyOther.trim() ? [eBodyOther.trim()] : [])].join(', ') || null;
        await updateExileContact(exileContactId.current!, {
          somatic_body_regions: regions,
          somatic_sensation_desc: eBodyOther.trim() || null,
        });
      }
      setCard('e_carries');
    } finally {
      setSaving(false);
    }
  }

  async function handleExileCarries() {
    if (saving) return;
    setSaving(true);
    try {
      await updateExileContact(exileContactId.current!, {
        what_it_carries: eCarries.trim() || null,
      });
      setCard('e_needs');
    } finally {
      setSaving(false);
    }
  }

  async function handleExileNeeds() {
    if (saving) return;
    setSaving(true);
    try {
      await updateExileContact(exileContactId.current!, {
        what_it_needs_to_hear: eNeeds.trim() || null,
      });
      setCard('e_witnessing');
    } finally {
      setSaving(false);
    }
  }

  async function handleWitnessing() {
    if (saving) return;
    setSaving(true);
    try {
      await updateExileContact(exileContactId.current!, { witnessing_complete: 1 });
      setCard('e_response');
    } finally {
      setSaving(false);
    }
  }

  async function handleExileResponse() {
    if (saving) return;
    setSaving(true);
    try {
      await updateExileContact(exileContactId.current!, {
        response_when_witnessed: eResponse.trim() || null,
      });
      setCard('e_felt_seen');
    } finally {
      setSaving(false);
    }
  }

  async function handleFeltSeen(val: boolean) {
    if (saving) return;
    setSaving(true);
    try {
      await updateExileContact(exileContactId.current!, { exile_felt_seen: val ? 1 : 0 });
      await updateTrailheadSession(sessionId, {
        currentPhase: 'integration',
        status: 'complete',
        completedAt: new Date().toISOString(),
      });
      router.replace(`/trailhead/integration?sessionId=${sessionId}`);
    } finally {
      setSaving(false);
    }
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  const isExileCard = card.startsWith('e_');
  const cardSpacing = isExileCard ? { paddingHorizontal: 26, paddingTop: 20 } : {};

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={sc.root} edges={['top', 'bottom']}>
      <GroundingOverlay
        visible={showGround}
        onReturn={() => {
          setShowGround(false);
          setGroundingDone(true);
          // After grounding from self-check, proceed to blending check
          if (card === 'l_self_check') setCard('l_blending_check');
        }}
        onPause={() => {
          setShowGround(false);
          pauseSession();
        }}
      />

      {/* Header */}
      <View style={sc.header}>
        <TouchableOpacity
          hitSlop={12}
          onPress={() => {
            Alert.alert(
              'Leave session?',
              'Your progress is saved. You can resume this trail at any time.',
              [
                { text: 'Stay', style: 'cancel' },
                {
                  text: 'Save & Leave',
                  onPress: () =>
                    updateTrailheadSession(sessionId, {
                      pausedAtPhase: isExileMode ? 'exile_contact' : 'loop',
                      pausedAtCard: card,
                      status: 'paused',
                    }).then(() => router.replace('/trailhead')),
                },
              ]
            );
          }}
        >
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>

        <ChainIndicator entries={chainEntries} />

        {/* Ground button */}
        <TouchableOpacity
          style={sc.groundBtn}
          onPress={() => setShowGround(true)}
          hitSlop={10}
        >
          <Ionicons name="heart-outline" size={20} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={sc.scroll}
          contentContainerStyle={[sc.scrollContent, cardSpacing]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ══════════════════ PHASE 3 ══════════════════ */}

          {card === 'p3_part_select' && (
            <View style={sc.cardWrap}>
              <Prompt text="What part of you is present in this activation?" />
              <View style={sc.pickToggle}>
                <TouchableOpacity
                  style={[sc.pickTab, pickMode === 'existing' && sc.pickTabActive]}
                  onPress={() => { setPickMode('existing'); setIsNewPart(false); }}
                >
                  <Text style={[sc.pickTabText, pickMode === 'existing' && sc.pickTabTextActive]}>
                    Existing part
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[sc.pickTab, pickMode === 'new' && sc.pickTabActive]}
                  onPress={() => { setPickMode('new'); setIsNewPart(true); }}
                >
                  <Text style={[sc.pickTabText, pickMode === 'new' && sc.pickTabTextActive]}>
                    New part
                  </Text>
                </TouchableOpacity>
              </View>

              {pickMode === 'existing' && (
                protectorParts.length === 0 ? (
                  <Text style={sc.dimText}>No protector parts yet. Create a new one.</Text>
                ) : (
                  <PartPicker parts={protectorParts} selectedId={selectedPart?.id ?? null} onSelect={setSelectedPart} />
                )
              )}

              {pickMode === 'new' && (
                <View style={{ gap: 12 }}>
                  <TextInput
                    style={[sh.input, { minHeight: 44 }]}
                    placeholder="Name this part..."
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={newPartName}
                    onChangeText={setNewPartName}
                    autoFocus
                  />
                  <View style={sc.typeRow}>
                    {(['manager','firefighter'] as const).map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[sc.typeBtn, newPartType === t && { borderColor: PART_COLORS[t], backgroundColor: `${PART_COLORS[t]}22` }]}
                        onPress={() => setNewPartType(t)}
                      >
                        <View style={[sc.typeDot, { backgroundColor: PART_COLORS[t] }]} />
                        <Text style={sc.typeBtnText}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {card === 'p3_sensing' && (
            <View style={sc.cardWrap}>
              <Prompt text={`Take a moment to notice ${partName}. What do you sense about it — its energy, quality, or presence?`} />
              <FreeText value={p3Sensing} onChange={setP3Sensing} autoFocus />
            </View>
          )}

          {card === 'p3_unblending' && (
            <View style={sc.cardWrap}>
              <Prompt text={`Can you sense ${partName} as separate from you — as something you're aware of, rather than something you are right now?`} />
              {(['yes','somewhat','not_yet'] as const).map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[sc.optCard, unblendingVal === v && sc.optCardSel]}
                  onPress={() => { setUnblendingVal(v); handleUnblending(v); }}
                  activeOpacity={0.75}
                >
                  <Text style={[sc.optText, unblendingVal === v && sc.optTextSel]}>
                    {v === 'yes' ? 'Yes — I can sense it as separate'
                    : v === 'somewhat' ? 'Somewhat — there\'s some distance'
                    : 'Not yet — I feel merged with it'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {card === 'p3_unblend_support' && (
            <View style={sc.cardWrap}>
              <Text style={sc.supportText}>
                See if you can imagine just a little space between you and this part. You don't need to push it away — just notice it from nearby.
              </Text>
              <Prompt text={`Can you sense ${partName} as separate from you now?`} />
              {(['yes','somewhat','not_yet'] as const).map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[sc.optCard, unblendRetry === v && sc.optCardSel]}
                  onPress={() => { setUnblendRetry(v); handleUnblending(v, true); }}
                  activeOpacity={0.75}
                >
                  <Text style={[sc.optText, unblendRetry === v && sc.optTextSel]}>
                    {v === 'yes' ? 'Yes — I can sense it as separate'
                    : v === 'somewhat' ? 'Somewhat — there\'s some distance'
                    : 'Not yet — and that\'s okay'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ══════════════════ LOOP CARDS ══════════════════ */}

          {card === 'l_self_check' && (
            <View style={sc.cardWrap}>
              <Prompt text="Before we go deeper — how present are you right now?" />
              <EnergyScale value={selfEnergy} onChange={setSelfEnergy} />
            </View>
          )}

          {card === 'l_blending_check' && (
            <View style={sc.cardWrap}>
              <Prompt text={`Is anything else getting activated right now? Any other part reacting to what we're doing?`} />
              <TouchableOpacity style={sc.optCard} onPress={() => handleBlendingCheck(true)} activeOpacity={0.75}>
                <Text style={sc.optText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sc.optCard} onPress={() => handleBlendingCheck(false)} activeOpacity={0.75}>
                <Text style={sc.optText}>No, just {partName}</Text>
              </TouchableOpacity>
            </View>
          )}

          {card === 'l_blending_other' && (
            <View style={sc.cardWrap}>
              <Prompt text="What part is showing up?" />
              <PartPicker parts={allParts} selectedId={otherPartId} onSelect={(p) => setOtherPartId(p.id)} />
              <TextInput
                style={[sh.input, { marginTop: 10, minHeight: 50 }]}
                placeholder="Or describe if unknown..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={blendingNote}
                onChangeText={setBlendingNote}
              />
            </View>
          )}

          {card === 'l_blending_ack' && (
            <View style={sc.cardWrap}>
              <Text style={sc.spaciousText}>
                Good. That other part has been noticed. We'll keep working with {partName}.
              </Text>
            </View>
          )}

          {card === 'l_somatic' && (
            <View style={sc.cardWrap}>
              <Prompt text={`Where in your body do you feel ${partName} most strongly right now?`} />
              <BodyChips selected={bodyChips} onChange={setBodyChips} other={bodyOther} onOtherChange={setBodyOther} />
            </View>
          )}

          {card === 'l_energy' && (
            <View style={sc.cardWrap}>
              <Prompt text={`What is the energy or quality of ${partName} right now — its pace, intensity, texture?`} />
              <FreeText
                value={energyQuality}
                onChange={setEnergyQuality}
                hint={"Tight and urgent · Heavy and slow · Sharp and watchful"}
                autoFocus
              />
            </View>
          )}

          {card === 'l_duration' && (
            <View style={sc.cardWrap}>
              <Prompt text={`How long has ${partName} been doing this job for you?`} />
              <FreeText
                value={roleDuration}
                onChange={setRoleDuration}
                hint={"As long as I can remember · Since a specific time in my life · It feels ancient"}
                autoFocus
              />
            </View>
          )}

          {card === 'l_message' && (
            <View style={sc.cardWrap}>
              <Prompt text={`What does ${partName} most want you to know about itself right now?`} />
              <FreeText
                value={msgToSelf}
                onChange={setMsgToSelf}
                hint={"What it would say if it had a voice · What it needs you to understand"}
                autoFocus
              />
            </View>
          )}

          {card === 'l_stance' && (
            <View style={sc.cardWrap}>
              <Prompt text={`How does ${partName} feel toward you — toward the part of you that is present and aware right now?`} />
              <FreeText
                value={stanceToSelf}
                onChange={setStanceToSelf}
                hint={"Suspicious · Relieved to be noticed · Guarded but curious"}
                autoFocus
              />
            </View>
          )}

          {card === 'l_fear' && (
            <View style={sc.cardWrap}>
              <Prompt text={`What is ${partName} afraid would happen if it stopped doing its job?`} />
              <FreeText
                value={fearStopped}
                onChange={setFearStopped}
                hint={"What it's trying to prevent · Its worst fear about stopping"}
                autoFocus
              />
            </View>
          )}

          {card === 'l_burden' && (
            <View style={sc.cardWrap}>
              <Prompt text={`What has it been like for ${partName} to carry this role — for however long it has?`} />
              <FreeText
                value={roleBurden}
                onChange={setRoleBurden}
                hint={"Exhausting · Necessary · It doesn't know any other way"}
                autoFocus
              />
            </View>
          )}

          {card === 'l_concerns' && (
            <View style={sc.cardWrap}>
              <Prompt text={`Does ${partName} have any concerns about us looking deeper into the system right now?`} />
              <TouchableOpacity
                style={[sc.optCard, hasConcerns === true && sc.optCardSel]}
                onPress={async () => {
                  setHasConcerns(true);
                  await updateChainEntry(chainEntryId.current!, { has_concerns: 1 });
                  setCard('l_concern_desc');
                }}
                activeOpacity={0.75}
              >
                <Text style={sc.optText}>Yes, it has concerns</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sc.optCard, hasConcerns === false && sc.optCardSel]}
                onPress={async () => {
                  setHasConcerns(false);
                  await updateChainEntry(chainEntryId.current!, { has_concerns: 0 });
                  setCard('l_safety');
                }}
                activeOpacity={0.75}
              >
                <Text style={sc.optText}>No, it seems open</Text>
              </TouchableOpacity>
            </View>
          )}

          {card === 'l_concern_desc' && (
            <View style={sc.cardWrap}>
              <Prompt text={`What is ${partName} concerned about?`} />
              <FreeText value={concernDesc} onChange={setConcernDesc} autoFocus />
            </View>
          )}

          {card === 'l_safety' && (
            <View style={sc.cardWrap}>
              <Prompt text={`What would ${partName} need in order to feel okay with us going further?`} />
              <FreeText
                value={safetyNeeds}
                onChange={setSafetyNeeds}
                hint={"To know you won't abandon it · Some reassurance about what comes next · To be acknowledged first"}
                autoFocus
              />
            </View>
          )}

          {card === 'l_fear_deeper' && (
            <View style={sc.cardWrap}>
              <Prompt text={`What is ${partName} most afraid we might disturb or uncover?`} />
              <FreeText value={fearDeeper} onChange={setFearDeeper} autoFocus />
            </View>
          )}

          {card === 'l_self_presence' && (
            <View style={sc.cardWrap}>
              <Prompt text={`Can ${partName} sense that Self is here — that you're not alone in this?`} />
              {([
                ['yes', 'Yes — it can sense Self'],
                ['somewhat', 'Somewhat'],
                ['not_clearly', 'Not clearly'],
              ] as const).map(([v, label]) => (
                <TouchableOpacity
                  key={v}
                  style={[sc.optCard, selfPresence === (['yes','somewhat','not_clearly'].indexOf(v) + 1) && sc.optCardSel]}
                  onPress={async () => {
                    const n = ['yes','somewhat','not_clearly'].indexOf(v) + 1;
                    setSelfPresence(n);
                    await saveAndAdvance({ self_presence_felt: n }, 'l_agreement', false);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={sc.optText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {card === 'l_agreement' && (
            <View style={sc.cardWrap}>
              <Prompt text={`What does ${partName} want in return for trusting this process — what would it ask of you?`} />
              <FreeText
                value={agreement}
                onChange={setAgreement}
                hint={"To be checked in on later · To not be pushed aside · To have its job acknowledged"}
                autoFocus
              />
            </View>
          )}

          {card === 'l_consent' && (
            <View style={sc.cardWrap}>
              <Prompt text={`Is ${partName} willing to allow us to look at what it's protecting — not to step away, just to allow?`} />
              {([
                ['yes', 'Yes, it\'s willing', 'We can look deeper together'],
                ['hesitant', 'It\'s hesitant, but okay', 'We\'ll proceed carefully'],
                ['no', 'No — it\'s not ready', 'We\'ll honor that'],
              ] as const).map(([v, label, sub]) => (
                <TouchableOpacity
                  key={v}
                  style={[sc.optCard, consent === v && { borderColor: v === 'no' ? '#C2600A' : '#3B5BA5', backgroundColor: v === 'no' ? 'rgba(194,96,10,0.12)' : 'rgba(59,91,165,0.15)' }]}
                  onPress={() => handleConsent(v)}
                  activeOpacity={0.75}
                >
                  <Text style={sc.optText}>{label}</Text>
                  <Text style={sc.optSub}>{sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {card === 'l_consent_refused' && (
            <View style={sc.cardWrap}>
              <Text style={sc.spaciousText}>
                {partName} isn't ready, and that matters. Its caution is protecting something real.{'\n\n'}This trail is saved exactly as it is.
              </Text>
              <TouchableOpacity
                style={[sc.primaryBtn, { marginTop: 24 }]}
                onPress={async () => {
                  await updateTrailheadSession(sessionId, { status: 'paused', pausedAtPhase: 'loop', pausedAtCard: 'l_consent_refused' });
                  router.replace(`/trailhead/integration?sessionId=${sessionId}&partial=1`);
                }}
                activeOpacity={0.85}
              >
                <Text style={sc.primaryBtnText}>Close this session for now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={sc.secondaryBtn}
                onPress={() => setCard('l_somatic')}
                activeOpacity={0.85}
              >
                <Text style={sc.secondaryBtnText}>Spend more time with {partName}</Text>
              </TouchableOpacity>
            </View>
          )}

          {card === 'l_pivot' && (
            <View style={sc.cardWrap}>
              <Prompt text={`From this place of awareness, ask ${partName} — what is it protecting? What's beneath it?`} />
              <FreeText value={pivotNote} onChange={setPivotNote} autoFocus />
            </View>
          )}

          {card === 'l_branch' && (
            <View style={sc.cardWrap}>
              <Prompt text={`What do you notice now — what's there when you look past ${partName}?`} />
              <TouchableOpacity style={sc.optCard} onPress={() => handleBranch('another')} activeOpacity={0.75}>
                <Text style={sc.optText}>Another protective part</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sc.optCard} onPress={() => handleBranch('exile')} activeOpacity={0.75}>
                <Text style={sc.optText}>Something that feels more vulnerable — possibly an exile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sc.optCard} onPress={() => handleBranch('unsure')} activeOpacity={0.75}>
                <Text style={sc.optText}>I'm not sure yet</Text>
              </TouchableOpacity>
            </View>
          )}

          {card === 'l_branch_unsure' && (
            <View style={sc.cardWrap}>
              <Text style={sc.spaciousText}>Stay with it a moment. There's no rush.</Text>
            </View>
          )}

          {card === 'l_new_part_select' && (
            <View style={sc.cardWrap}>
              <Prompt text="What part do you notice now?" />
              <View style={sc.pickToggle}>
                <TouchableOpacity
                  style={[sc.pickTab, pickMode === 'existing' && sc.pickTabActive]}
                  onPress={() => { setPickMode('existing'); setIsNewPart(false); }}
                >
                  <Text style={[sc.pickTabText, pickMode === 'existing' && sc.pickTabTextActive]}>Existing part</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[sc.pickTab, pickMode === 'new' && sc.pickTabActive]}
                  onPress={() => { setPickMode('new'); setIsNewPart(true); }}
                >
                  <Text style={[sc.pickTabText, pickMode === 'new' && sc.pickTabTextActive]}>New part</Text>
                </TouchableOpacity>
              </View>
              {pickMode === 'existing' && (
                <PartPicker parts={protectorParts} selectedId={selectedPart?.id ?? null} onSelect={setSelectedPart} />
              )}
              {pickMode === 'new' && (
                <View style={{ gap: 12 }}>
                  <TextInput
                    style={[sh.input, { minHeight: 44 }]}
                    placeholder="Name this part..."
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={newPartName}
                    onChangeText={setNewPartName}
                    autoFocus
                  />
                  <View style={sc.typeRow}>
                    {(['manager','firefighter'] as const).map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[sc.typeBtn, newPartType === t && { borderColor: PART_COLORS[t], backgroundColor: `${PART_COLORS[t]}22` }]}
                        onPress={() => setNewPartType(t)}
                      >
                        <View style={[sc.typeDot, { backgroundColor: PART_COLORS[t] }]} />
                        <Text style={sc.typeBtnText}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ══════════════════ EXILE CONTACT ══════════════════ */}

          {card === 'e_sensing' && (
            <View style={sc.cardWrap}>
              <Prompt text="What do you notice about this part? How does it appear to you — its age, quality, or presence?" />
              <FreeText value={eApparent} onChange={setEApparent} autoFocus />
            </View>
          )}

          {card === 'e_somatic' && (
            <View style={sc.cardWrap}>
              <Prompt text="Where do you feel this part in your body?" />
              <BodyChips selected={eBodyChips} onChange={setEBodyChips} other={eBodyOther} onOtherChange={setEBodyOther} />
            </View>
          )}

          {card === 'e_carries' && (
            <View style={sc.cardWrap}>
              <Prompt text="What does this part seem to be holding — what has it been carrying?" />
              <FreeText value={eCarries} onChange={setECarries} autoFocus />
            </View>
          )}

          {card === 'e_needs' && (
            <View style={sc.cardWrap}>
              <Prompt text="What does this part most need to know right now — perhaps something it has never heard?" />
              <FreeText value={eNeeds} onChange={setENeeds} autoFocus />
              <Text style={sc.italicNote}>
                Let whatever is genuine in you speak. There's no right answer here.
              </Text>
            </View>
          )}

          {card === 'e_witnessing' && (
            <View style={sc.cardWrap}>
              <Text style={sc.witnessingText}>
                Let this part know that you see it.{'\n'}That it's been found.{'\n'}That it's not alone anymore.{'\n\n'}Take as long as you need.
              </Text>
            </View>
          )}

          {card === 'e_response' && (
            <View style={sc.cardWrap}>
              <Prompt text="What do you notice in this part now — is there any shift, however subtle, in how it feels to be seen?" />
              <FreeText value={eResponse} onChange={setEResponse} autoFocus />
            </View>
          )}

          {card === 'e_felt_seen' && (
            <View style={sc.cardWrap}>
              <Prompt text="Does this part feel seen right now?" />
              <TouchableOpacity
                style={sc.optCard}
                onPress={() => handleFeltSeen(true)}
                activeOpacity={0.75}
              >
                <Text style={sc.optText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={sc.optCard}
                onPress={() => handleFeltSeen(false)}
                activeOpacity={0.75}
              >
                <Text style={sc.optText}>Not fully / I'm not sure</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom action button */}
      <View style={sc.bottomBar}>
        {renderBottomAction()}
      </View>
    </SafeAreaView>
  );

  // ── Bottom action button logic ───────────────────────────────────────────────

  function renderBottomAction(): React.ReactElement | null {
    const dis = saving;

    // Cards that handle their own taps (no bottom button needed)
    const selfHandled: CardId[] = [
      'p3_unblending','p3_unblend_support',
      'l_blending_check','l_concerns',
      'l_self_presence','l_consent','l_consent_refused',
      'l_branch','e_felt_seen',
    ];
    if (selfHandled.includes(card)) return null;

    // Skip button cards
    const skipCards: CardId[] = ['p3_sensing','l_somatic','l_energy','l_duration','l_message','l_stance','l_fear','l_burden','l_safety','l_fear_deeper','l_agreement','e_somatic'];

    function btn(label: string, onPress: () => void, disabled = false) {
      return (
        <TouchableOpacity
          style={[sc.continueBtn, (disabled || dis) && sc.continueBtnDis]}
          onPress={onPress}
          disabled={disabled || dis}
          activeOpacity={0.85}
        >
          <Text style={sc.continueBtnText}>{label}</Text>
        </TouchableOpacity>
      );
    }

    function withSkip(label: string, onPress: () => void, skipFn: () => void) {
      return (
        <>
          <TouchableOpacity style={sc.skipBtn} onPress={skipFn} activeOpacity={0.7}>
            <Text style={sc.skipBtnText}>Skip for now</Text>
          </TouchableOpacity>
          {btn(label, onPress)}
        </>
      );
    }

    switch (card) {
      // Phase 3
      case 'p3_part_select':
        return btn(
          'Confirm',
          handleP3PartConfirm,
          (!selectedPart && (!isNewPart || !newPartName.trim()))
        );
      case 'p3_sensing':
        return withSkip('Continue', () => handleP3Sensing(false), () => handleP3Sensing(true));

      // Loop — require self-energy pick then tap
      case 'l_self_check':
        return btn('Continue', () => handleSelfCheck(selfEnergy));

      case 'l_blending_other':
        return btn('Continue', handleBlendingOtherDone);

      case 'l_blending_ack':
        return btn('Continue', () => setCard('l_somatic'));

      case 'l_somatic':
        return withSkip('Continue', () => handleSomatic(false), () => handleSomatic(true));

      case 'l_energy':
        return withSkip('Continue', () => saveAndAdvance({ part_energy_quality: energyQuality.trim() || null }, 'l_duration'), () => saveAndAdvance({}, 'l_duration', true));

      case 'l_duration':
        return withSkip('Continue', () => saveAndAdvance({ role_duration: roleDuration.trim() || null }, 'l_message'), () => saveAndAdvance({}, 'l_message', true));

      case 'l_message':
        return withSkip('Continue', () => saveAndAdvance({ part_message_to_self: msgToSelf.trim() || null }, 'l_stance'), () => saveAndAdvance({}, 'l_stance', true));

      case 'l_stance':
        return withSkip('Continue', () => saveAndAdvance({ part_stance_toward_self: stanceToSelf.trim() || null }, 'l_fear'), () => saveAndAdvance({}, 'l_fear', true));

      case 'l_fear':
        return withSkip('Continue', () => saveAndAdvance({ fear_if_stopped: fearStopped.trim() || null }, 'l_burden'), () => saveAndAdvance({}, 'l_burden', true));

      case 'l_burden':
        return withSkip('Continue', () => saveAndAdvance({ role_burden_experience: roleBurden.trim() || null }, 'l_concerns'), () => saveAndAdvance({}, 'l_concerns', true));

      case 'l_concern_desc':
        return btn('Continue', () => saveAndAdvance({ concern_description: concernDesc.trim() || null }, 'l_safety'), !concernDesc.trim());

      case 'l_safety':
        return withSkip('Continue', () => saveAndAdvance({ safety_needs: safetyNeeds.trim() || null }, 'l_fear_deeper'), () => saveAndAdvance({}, 'l_fear_deeper', true));

      case 'l_fear_deeper':
        return withSkip('Continue', () => saveAndAdvance({ fear_of_going_deeper: fearDeeper.trim() || null }, 'l_self_presence'), () => saveAndAdvance({}, 'l_self_presence', true));

      case 'l_agreement':
        return withSkip('Continue', () => saveAndAdvance({ agreement_requested: agreement.trim() || null }, 'l_consent'), () => saveAndAdvance({}, 'l_consent', true));

      case 'l_pivot':
        return btn('Continue', handlePivot, !pivotNote.trim());

      case 'l_branch_unsure':
        return btn('Continue', () => setCard('l_branch'));

      case 'l_new_part_select':
        return btn('Confirm', handleNewPartForLoop, (!selectedPart && (!isNewPart || !newPartName.trim())));

      // Exile contact
      case 'e_sensing':
        return btn('Continue', handleExileSensing);

      case 'e_somatic':
        return withSkip('Continue', () => handleExileSomatic(false), () => handleExileSomatic(true));

      case 'e_carries':
        return btn('Continue', handleExileCarries);

      case 'e_needs':
        return btn('Continue', handleExileNeeds);

      case 'e_witnessing':
        return btn("I've been with this part", handleWitnessing);

      case 'e_response':
        return btn('Continue', handleExileResponse);

      default:
        return null;
    }
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BG = '#1A1917';

const sc = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  groundBtn: { padding: 6 },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20 },

  cardWrap: { gap: 14 },

  supportText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 26,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#B88A00',
    marginBottom: 8,
  },
  spaciousText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 30,
    textAlign: 'center',
    paddingVertical: 16,
  },
  witnessingText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 34,
    textAlign: 'center',
    paddingVertical: 24,
    letterSpacing: 0.3,
  },
  italicNote: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  dimText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingVertical: 16 },

  optCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 4,
  },
  optCardSel: { borderColor: '#3B5BA5', backgroundColor: 'rgba(59,91,165,0.18)' },
  optText:    { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  optTextSel: { color: '#FFFFFF', fontWeight: '600' },
  optSub:     { fontSize: 12, color: 'rgba(255,255,255,0.4)' },

  pickToggle: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 4 },
  pickTab:    { flex: 1, paddingVertical: 10, alignItems: 'center' },
  pickTabActive: { backgroundColor: 'rgba(59,91,165,0.25)' },
  pickTabText:    { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  pickTabTextActive: { color: '#FFFFFF', fontWeight: '600' },

  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    padding: 12,
  },
  typeDot:    { width: 10, height: 10, borderRadius: 5 },
  typeBtnText:{ fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

  primaryBtn: { backgroundColor: '#3B5BA5', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  secondaryBtnText: { color: 'rgba(255,255,255,0.55)', fontSize: 14 },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 22,
    paddingBottom: 34,
    paddingTop: 10,
    backgroundColor: BG,
    elevation: 8,
    zIndex: 999,
  },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.35)' },
  continueBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnDis: { opacity: 0.35 },
  continueBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
