/**
 * MeetingGroundCheckStep — per-part Self-energy ground check for 'meeting-space'.
 *
 * Runs a feel-towards / unblend cycle for each part in the meeting room.
 * New parts identified during the cycle are saved to DB and added to the
 * meeting room via onNewPartsAdded.
 *
 * Phases per part: feel-towards → identify-part → unblend-support →
 *                  multi-part-check → check-again → (loop) → resolved
 */

import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { UnblendSupportCard } from './UnblendSupportCard';
import {
  FEEL_TOWARDS_SELF_QUALITIES,
  FEEL_TOWARDS_REACTIVE,
  FEEL_TOWARDS_SELF_LIKE,
  type TechniqueStep,
} from '@/lib/techniques-data';
import { getDatabase } from '@/lib/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type PartType = 'manager' | 'firefighter' | 'exile' | 'self' | 'unknown';
interface PartRow { id: string; display_name: string; type: PartType; }
const TYPE_COLOR: Record<PartType, string> = {
  manager: '#3B5BA5', firefighter: '#C2600A', exile: '#7C3D9B', self: '#B88A00', unknown: '#6B6860',
};

type GroundPhase =
  | 'feel-towards'
  | 'identify-part'
  | 'unblend-support'
  | 'multi-part-check'
  | 'check-again';

interface IdentifiedPart { partId?: string; partName: string; feeling: string; }

interface PartGroundState {
  partId: string;
  partName: string;
  partType: PartType;
  selectedFeelings: string[];
  freeText: string;
  isResolved: boolean;
  identifiedParts: IdentifiedPart[];
  cycleCount: number;
  addedDuringCheck?: boolean;
}

interface Props {
  step: TechniqueStep;
  parts: PartRow[];
  selectedPartIds: string[];
  onNewPartsAdded: (parts: PartRow[]) => void;
  onAdvance: (data: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MeetingGroundCheckStep({
  step,
  parts,
  selectedPartIds,
  onNewPartsAdded,
  onAdvance,
}: Props) {
  const initialStates: PartGroundState[] = selectedPartIds.map((id) => {
    const p = parts.find((x) => x.id === id);
    return {
      partId: id,
      partName: p?.display_name ?? 'Unknown part',
      partType: p?.type ?? 'unknown',
      selectedFeelings: [],
      freeText: '',
      isResolved: false,
      identifiedParts: [],
      cycleCount: 0,
    };
  });

  const [partStates, setPartStates] = useState<PartGroundState[]>(initialStates);
  const [activeIdx, setActiveIdx] = useState(0);
  const [groundPhase, setGroundPhase] = useState<GroundPhase>('feel-towards');

  // Identify-part sub-state
  const [selectedPartForIdentify, setSelectedPartForIdentify] = useState<string | null>(null);
  const [newPartForIdentify, setNewPartForIdentify] = useState('');
  const [notSureYet, setNotSureYet] = useState(false);
  const [isSavingPart, setIsSavingPart] = useState(false);

  // Multi-part-check sub-state
  const [multiCheckSelections, setMultiCheckSelections] = useState<string[]>([]);

  const activePart = partStates[activeIdx];

  // ── State helpers ──────────────────────────────────────────────────────────

  function updateActive(updates: Partial<PartGroundState>) {
    setPartStates((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, ...updates } : s)));
  }

  function toggleFeeling(feeling: string) {
    updateActive({
      selectedFeelings: activePart.selectedFeelings.includes(feeling)
        ? activePart.selectedFeelings.filter((f) => f !== feeling)
        : [...activePart.selectedFeelings, feeling],
    });
  }

  function isSelfEnergy(feelings: string[], freeText: string): boolean {
    const hasSelf  = feelings.some(
      (f) => FEEL_TOWARDS_SELF_QUALITIES.includes(f),
    );
    // Self-like chips are parts, not Self energy — treat like reactive for routing
    const hasReact = feelings.some(
      (f) => FEEL_TOWARDS_REACTIVE.includes(f) || FEEL_TOWARDS_SELF_LIKE.includes(f),
    );
    return hasSelf && !hasReact && !freeText.trim();
  }

  function resetIdentifySubstate() {
    setSelectedPartForIdentify(null);
    setNewPartForIdentify('');
    setNotSureYet(false);
  }

  // ── Advance logic ──────────────────────────────────────────────────────────

  function handleThisIsHowIFeel() {
    if (isSelfEnergy(activePart.selectedFeelings, activePart.freeText)) {
      const updated = partStates.map((s, i) =>
        i === activeIdx ? { ...s, isResolved: true } : s,
      );
      setPartStates(updated);

      const nextUnresolved = updated.findIndex((s, i) => i !== activeIdx && !s.isResolved);
      if (nextUnresolved >= 0) {
        setActiveIdx(nextUnresolved);
        setGroundPhase('feel-towards');
        resetIdentifySubstate();
      } else {
        // All resolved
        onAdvance(JSON.stringify({
          part_ground_states: updated.map((s) => ({
            partId: s.partId,
            partName: s.partName,
            final_feelings: s.selectedFeelings,
            cycle_count: s.cycleCount,
            identified_parts: s.identifiedParts,
          })),
        }));
      }
    } else {
      setGroundPhase('identify-part');
    }
  }

  async function handleIdentifyContinue() {
    const capturedPart = activePart;
    let partName = 'an unknown part';
    let partId: string | undefined;

    if (notSureYet) {
      partName = 'an unknown part';
      proceedToUnblend(capturedPart, partName, undefined);
    } else if (selectedPartForIdentify) {
      const p = parts.find((x) => x.id === selectedPartForIdentify);
      partName = p?.display_name ?? 'an unknown part';
      partId = selectedPartForIdentify;
      proceedToUnblend(capturedPart, partName, partId);
    } else if (newPartForIdentify.trim()) {
      const trimmed = newPartForIdentify.trim();
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
        const newPartRow: PartRow = { id: newId, display_name: trimmed, type: 'unknown' };
        onNewPartsAdded([newPartRow]);
        // Add new part to ground check queue
        setPartStates((prev) => [...prev, {
          partId: newId,
          partName: trimmed,
          partType: 'unknown',
          selectedFeelings: [],
          freeText: '',
          isResolved: false,
          identifiedParts: [],
          cycleCount: 0,
          addedDuringCheck: true,
        }]);
        proceedToUnblend(capturedPart, trimmed, newId);
      } catch (e) {
        console.error('[MeetingGroundCheckStep] save part:', e);
      } finally {
        setIsSavingPart(false);
      }
    }
  }

  function proceedToUnblend(captured: PartGroundState, partName: string, partId?: string) {
    const reactiveFeeling =
      captured.selectedFeelings.filter((f) => FEEL_TOWARDS_REACTIVE.includes(f)).join(', ')
      || captured.freeText
      || 'reactivity';
    setPartStates((prev) => prev.map((s, i) =>
      i === activeIdx
        ? { ...s, identifiedParts: [...s.identifiedParts, { partId, partName, feeling: reactiveFeeling }] }
        : s,
    ));
    setGroundPhase('unblend-support');
  }

  function handleHaveSpace() {
    updateActive({
      cycleCount: activePart.cycleCount + 1,
      selectedFeelings: [],
      freeText: '',
    });
    resetIdentifySubstate();
    setMultiCheckSelections([]);
    setGroundPhase('multi-part-check');
  }

  function handleMultiPartCheckConfirm() {
    // For each selected part, mark it as not yet resolved so the loop will revisit it
    if (multiCheckSelections.length > 0) {
      setPartStates((prev) => prev.map((s) =>
        multiCheckSelections.includes(s.partId) ? { ...s, isResolved: false } : s,
      ));
    }
    setMultiCheckSelections([]);
    setGroundPhase('check-again');
  }

  // ── Parts list header ──────────────────────────────────────────────────────

  function renderPartsHeader() {
    return (
      <View style={mgc.header}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={mgc.headerScroll}
        >
          {partStates.map((s, i) => {
            const color = TYPE_COLOR[s.partType] ?? '#6B6860';
            const isActive = i === activeIdx;
            return (
              <View
                key={s.partId}
                style={[
                  mgc.pill,
                  { borderColor: isActive ? color : 'rgba(255,255,255,0.12)' },
                  isActive && { backgroundColor: `${color}22` },
                ]}
              >
                {s.addedDuringCheck && (
                  <Ionicons name="add-circle-outline" size={11} color="rgba(255,255,255,0.45)" />
                )}
                <View style={[mgc.pillDot, { backgroundColor: color }]} />
                <Text style={[mgc.pillName, isActive && { color: '#FFFFFF' }]} numberOfLines={1}>
                  {s.partName}
                </Text>
                {s.isResolved && (
                  <Ionicons name="checkmark-circle" size={13} color="#4CAF50" />
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // ── Unblend support ────────────────────────────────────────────────────────

  if (groundPhase === 'unblend-support') {
    const lastPart = activePart.identifiedParts[activePart.identifiedParts.length - 1];
    return (
      <View style={{ flex: 1 }}>
        {renderPartsHeader()}
        <UnblendSupportCard partName={lastPart?.partName} onHaveSpace={handleHaveSpace} />
      </View>
    );
  }

  // ── Multi-part blending check ──────────────────────────────────────────────

  if (groundPhase === 'multi-part-check') {
    const lastIdentified = activePart.identifiedParts[activePart.identifiedParts.length - 1];
    const otherParts = partStates.filter((s, i) => i !== activeIdx);

    return (
      <View style={{ flex: 1 }}>
        {renderPartsHeader()}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={mgc.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={mgc.heading}>One more check.</Text>
          {lastIdentified && (
            <Text style={mgc.body}>
              Does {lastIdentified.partName} have feelings about any other parts in the room?
            </Text>
          )}
          {otherParts.map((s) => {
            const color = TYPE_COLOR[s.partType] ?? '#6B6860';
            const sel = multiCheckSelections.includes(s.partId);
            return (
              <TouchableOpacity
                key={s.partId}
                style={[mgc.partCard, { borderColor: sel ? color : 'rgba(255,255,255,0.1)' }]}
                onPress={() => setMultiCheckSelections((prev) =>
                  prev.includes(s.partId) ? prev.filter((id) => id !== s.partId) : [...prev, s.partId],
                )}
                activeOpacity={0.75}
              >
                <View style={[mgc.typeDot, { backgroundColor: color }]} />
                <Text style={mgc.partCardName}>{s.partName}</Text>
                {sel && <Ionicons name="checkmark-circle" size={18} color={color} />}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 80 }} />
        </ScrollView>
        <View style={mgc.footer}>
          <TouchableOpacity style={mgc.btn} onPress={handleMultiPartCheckConfirm} activeOpacity={0.85}>
            <Text style={mgc.btnText}>
              {multiCheckSelections.length > 0 ? "Yes, I'll check those too" : 'No, continue'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Identify part ──────────────────────────────────────────────────────────

  if (groundPhase === 'identify-part') {
    const canContinue = notSureYet || !!selectedPartForIdentify || !!newPartForIdentify.trim();
    return (
      <View style={{ flex: 1 }}>
        {renderPartsHeader()}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={mgc.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={mgc.heading}>Something is present.</Text>
          <Text style={mgc.body}>
            A part has feelings about {activePart.partName}.{'\n'}
            See if you can sense it — do you recognize it?
          </Text>
          <View style={{ gap: 8 }}>
            {parts.map((p) => {
              const color = TYPE_COLOR[p.type] ?? '#6B6860';
              const selected = selectedPartForIdentify === p.id && !notSureYet;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[mgc.partCard, { borderColor: selected ? color : 'rgba(255,255,255,0.1)' }]}
                  onPress={() => {
                    setSelectedPartForIdentify(p.id);
                    setNewPartForIdentify('');
                    setNotSureYet(false);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[mgc.typeDot, { backgroundColor: color }]} />
                  <Text style={mgc.partCardName}>{p.display_name}</Text>
                  {selected && <Ionicons name="checkmark-circle" size={18} color={color} />}
                </TouchableOpacity>
              );
            })}
            <TextInput
              style={mgc.newPartInput}
              value={newPartForIdentify}
              onChangeText={(v) => {
                setNewPartForIdentify(v);
                setSelectedPartForIdentify(null);
                setNotSureYet(false);
              }}
              placeholder="This is a new part — give it a name..."
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
            <TouchableOpacity
              style={[mgc.notSureBtn, notSureYet && mgc.notSureBtnSel]}
              onPress={() => {
                setNotSureYet(true);
                setSelectedPartForIdentify(null);
                setNewPartForIdentify('');
              }}
              activeOpacity={0.75}
            >
              <Text style={[mgc.notSureText, notSureYet && mgc.notSureTextSel]}>Not sure yet</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
        <View style={mgc.footer}>
          <TouchableOpacity
            style={[mgc.btn, (!canContinue || isSavingPart) && mgc.btnDisabled]}
            onPress={handleIdentifyContinue}
            disabled={!canContinue || isSavingPart}
            activeOpacity={0.85}
          >
            <Text style={mgc.btnText}>{isSavingPart ? 'Saving...' : 'Continue'}</Text>
            {!isSavingPart && <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Feel-towards / Check-again ─────────────────────────────────────────────

  const isCheckAgain = groundPhase === 'check-again';
  const hasSelection = activePart.selectedFeelings.length > 0 || !!activePart.freeText.trim();
  const lastIdentified = activePart.identifiedParts[activePart.identifiedParts.length - 1];

  return (
    <View style={{ flex: 1 }}>
      {renderPartsHeader()}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={mgc.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isCheckAgain && lastIdentified && (
          <Text style={mgc.cycleNote}>
            Cycle {activePart.cycleCount} — after unblending from {lastIdentified.partName}
          </Text>
        )}
        <Text style={mgc.heading}>
          {isCheckAgain
            ? `How do you feel toward ${activePart.partName} now?`
            : `How do you feel toward ${activePart.partName}?`
          }
        </Text>
        {!isCheckAgain && step.body ? (
          <Text style={mgc.body}>{step.body}</Text>
        ) : null}

        {/* TEXT: meeting-space — ground check "PARTS PRESENT" label */}
        <Text style={mgc.groupLabel}>PARTS PRESENT</Text>
        <View style={mgc.chips}>
          {FEEL_TOWARDS_REACTIVE.map((chip) => {
            const sel = activePart.selectedFeelings.includes(chip);
            return (
              <TouchableOpacity
                key={chip}
                style={[mgc.chip, mgc.reactiveChip, sel && mgc.reactiveChipSel]}
                onPress={() => toggleFeeling(chip)}
                activeOpacity={0.75}
              >
                <Text style={[mgc.chipText, sel && mgc.chipTextSel]}>{chip}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TEXT: meeting-space — ground check "SELF-LIKE PART PRESENT" label */}
        <Text style={[mgc.groupLabel, { marginTop: 16 }]}>SELF-LIKE PART PRESENT</Text>
        <View style={mgc.chips}>
          {FEEL_TOWARDS_SELF_LIKE.map((chip) => {
            const sel = activePart.selectedFeelings.includes(chip);
            return (
              <TouchableOpacity
                key={chip}
                style={[mgc.chip, mgc.selfLikeChip, sel && mgc.selfLikeChipSel]}
                onPress={() => toggleFeeling(chip)}
                activeOpacity={0.75}
              >
                <Text style={[mgc.selfLikeChipText, sel && mgc.selfLikeChipTextSel]}>{chip}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TEXT: meeting-space — ground check "SELF-ENERGY PRESENT" label */}
        <Text style={[mgc.groupLabel, { marginTop: 16 }]}>SELF-ENERGY PRESENT</Text>
        <View style={mgc.chips}>
          {FEEL_TOWARDS_SELF_QUALITIES.map((chip) => {
            const sel = activePart.selectedFeelings.includes(chip);
            return (
              <TouchableOpacity
                key={chip}
                style={[mgc.chip, mgc.selfChip, sel && mgc.selfChipSel]}
                onPress={() => toggleFeeling(chip)}
                activeOpacity={0.75}
              >
                <Text style={[mgc.chipText, sel && mgc.selfChipTextSel]}>{chip}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={mgc.freeText}
          value={activePart.freeText}
          onChangeText={(v) => updateActive({ freeText: v })}
          placeholder="Or describe it..."
          placeholderTextColor="rgba(255,255,255,0.3)"
        />
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={mgc.footer}>
        <TouchableOpacity
          style={[mgc.btn, !hasSelection && mgc.btnDisabled]}
          onPress={handleThisIsHowIFeel}
          disabled={!hasSelection}
          activeOpacity={0.85}
        >
          <Text style={mgc.btnText}>This is how I feel</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const mgc = StyleSheet.create({
  // Header parts strip
  header: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 10,
    backgroundColor: '#1E1E1C',
  },
  headerScroll: { paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 5,
    maxWidth: 140,
  },
  pillDot: { width: 7, height: 7, borderRadius: 3.5 },
  pillName: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500', flexShrink: 1 },

  // Shared content
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  cycleNote: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 10, fontStyle: 'italic' },
  heading: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 30, marginBottom: 12 },
  body: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 24, marginBottom: 20 },

  // Chips
  groupLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1, marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5 },
  selfChip: { borderColor: '#B88A00' },
  selfChipSel: { backgroundColor: '#B88A00', borderColor: '#B88A00' },
  reactiveChip: { borderColor: '#6B6860' },
  reactiveChipSel: { backgroundColor: '#2A2927', borderColor: '#6B6860' },
  selfLikeChip: { backgroundColor: 'transparent', borderColor: '#22C55E' },
  selfLikeChipSel: { backgroundColor: 'rgba(34,197,94,0.2)', borderColor: '#22C55E' },
  chipText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  selfLikeChipText: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  chipTextSel: { color: '#FFFFFF' },
  selfChipTextSel: { color: '#FFFFFF' },
  selfLikeChipTextSel: { color: '#FFFFFF' },
  freeText: {
    marginTop: 16, backgroundColor: '#2A2927', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#FFFFFF',
  },

  // Part list (identify-part + multi-part-check)
  partCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    borderWidth: 1.5, padding: 14,
  },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  partCardName: { flex: 1, fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  newPartInput: {
    backgroundColor: '#2A2927', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#FFFFFF',
  },
  notSureBtn: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center',
  },
  notSureBtnSel: { borderColor: '#B88A00', backgroundColor: 'rgba(184,138,0,0.1)' },
  notSureText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  notSureTextSel: { color: '#B88A00' },

  // Footer
  footer: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1917',
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#3B5BA5', borderRadius: 14, paddingVertical: 16,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
