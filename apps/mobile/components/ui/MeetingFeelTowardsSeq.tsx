/**
 * MeetingFeelTowardsSeq — feel-towards cycle for Meeting Space.
 *
 * Processes each part in the meeting room in sequence, running a full
 * feel-towards → unblend cycle before advancing to the next part.
 *
 * Phases (per target part):
 *   feel-towards     → Screen 1: Self checks feelings toward currentTarget
 *   something-present→ Screen 2: Part selector (carried feelings as context)
 *   part-is-present  → Screen 3: UnblendSupportCard
 *   part-feels-others→ Screen 4: Part Y checks feelings toward other room members
 *   part-feels-one   → Screen 5: Part Y → one target at a time
 *   self-qualities   → Screen 6: 8 Cs + 5 Ps reminder, then re-check Screen 1
 */

import React, { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
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
} from '@/lib/techniques-data';
import { addOrReplaceEdge, type MapEdge, type RelationalMap } from '@/lib/relational-map';
import { getDatabase } from '@/lib/database';

// ─── Constants ────────────────────────────────────────────────────────────────

const SELF_CS = ['Calm', 'Curious', 'Clear', 'Compassionate', 'Confident', 'Creative', 'Courageous', 'Connected'];
const SELF_PS = ['Present', 'Patient', 'Playful', 'Persistent', 'Perspective'];

// ─── Types ────────────────────────────────────────────────────────────────────

type PartType = 'manager' | 'firefighter' | 'exile' | 'self' | 'unknown';
interface PartRow { id: string; display_name: string; type: PartType; }

const TYPE_COLOR: Record<PartType, string> = {
  manager: '#3B5BA5', firefighter: '#C2600A', exile: '#7C3D9B', self: '#B88A00', unknown: '#6B6860',
};

type SeqPhase =
  | 'feel-towards'       // Screen 1
  | 'something-present'  // Screen 2
  | 'part-is-present'    // Screen 3
  | 'part-feels-others'  // Screen 4
  | 'part-feels-one'     // Screen 5
  | 'self-qualities';    // Screen 6

interface Props {
  initialPartIds: string[];
  parts: PartRow[];
  relMap: RelationalMap;
  onRelMapUpdate: Dispatch<SetStateAction<RelationalMap>>;
  onPartAdded: (part: PartRow) => void;
  onComplete: () => void;
  /** Ref for back-button interception by technique-session. */
  backRef?: React.MutableRefObject<(() => boolean) | null>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Returns true only when pure Self-energy is present:
 * at least one Self-quality chip, no reactive chips, no Self-like chips
 * (Self-like chips are parts, not Self energy — same rule as UnblendCycleStep).
 */
function isSelfOnly(feelings: string[]): boolean {
  const hasReactive = feelings.some(
    (f) => FEEL_TOWARDS_REACTIVE.includes(f) || FEEL_TOWARDS_SELF_LIKE.includes(f),
  );
  const hasSelf = feelings.some((f) => FEEL_TOWARDS_SELF_QUALITIES.includes(f));
  return hasSelf && !hasReactive;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MeetingFeelTowardsSeq({
  initialPartIds,
  parts: initialParts,
  relMap,
  onRelMapUpdate,
  onPartAdded,
  onComplete,
  backRef,
}: Props) {

  // ── Queue management ────────────────────────────────────────────────────────
  const [partQueue, setPartQueue] = useState<string[]>([...initialPartIds]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [phase, setPhase] = useState<SeqPhase>('feel-towards');

  // ── Screen 1 — feel-towards ─────────────────────────────────────────────────
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);
  const [freeText, setFreeText] = useState('');

  // ── Screen 2 — something-present ────────────────────────────────────────────
  const [carriedFeelings, setCarriedFeelings] = useState<string[]>([]);
  const [selectedNewPartId, setSelectedNewPartId] = useState<string | null>(null);
  const [newPartName, setNewPartName] = useState('');
  const [partSavedConfirm, setPartSavedConfirm] = useState('');
  const [isSavingPart, setIsSavingPart] = useState(false);

  // ── Screen 4 — part-feels-others ────────────────────────────────────────────
  const [partYTargets, setPartYTargets] = useState<string[]>([]);
  const [partYTargetIndex, setPartYTargetIndex] = useState(0);

  // ── Part Y identity (set when part is identified on Screen 2) ───────────────
  const [partYId, setPartYId] = useState<string | null>(null);
  const [partYName, setPartYName] = useState('');

  // ── Local parts (grows as new parts are discovered) ─────────────────────────
  const [localParts, setLocalParts] = useState<PartRow[]>(initialParts);

  // ── Screen 1 scroll ref (reset to top when queue advances) ──────────────────
  const screen1ScrollRef = useRef<ScrollView>(null);

  // ── Derived values ──────────────────────────────────────────────────────────
  const currentTargetId = partQueue[queueIndex] ?? '';
  const currentTargetNode = relMap.nodes.find((n) => n.id === currentTargetId);
  const currentTargetLocal = localParts.find((p) => p.id === currentTargetId);
  const currentTargetName =
    currentTargetNode?.name ?? currentTargetLocal?.display_name ?? 'this part';

  function getPartName(id: string): string {
    if (id === 'self') return 'Self';
    const node = relMap.nodes.find((n) => n.id === id);
    if (node) return node.name;
    const local = localParts.find((p) => p.id === id);
    return local?.display_name ?? 'a part';
  }

  // ── Back-interception ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!backRef) return;
    backRef.current = (): boolean => {
      switch (phase) {
        case 'feel-towards':
          if (queueIndex > 0) {
            setQueueIndex((prev) => prev - 1);
            setSelectedFeelings([]);
            setFreeText('');
            return true;
          }
          return false;
        case 'something-present':
          setPhase('feel-towards');
          return true;
        case 'part-is-present':
          setPhase('something-present');
          return true;
        case 'part-feels-others':
          setPhase('part-is-present');
          return true;
        case 'part-feels-one':
          if (partYTargetIndex > 0) {
            setPartYTargetIndex((prev) => prev - 1);
            setSelectedFeelings([]);
            return true;
          }
          setPhase('part-feels-others');
          return true;
        case 'self-qualities':
          if (partYTargets.length > 0) {
            setPartYTargetIndex(partYTargets.length - 1);
            setPhase('part-feels-one');
          } else {
            setPhase('part-feels-others');
          }
          return true;
        default:
          return false;
      }
    };
    return () => { if (backRef) backRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backRef, phase, queueIndex, partYTargetIndex, partYTargets]);

  // ── Call onComplete if queue was empty on mount ──────────────────────────────
  useEffect(() => {
    if (initialPartIds.length === 0) onComplete();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Advance the main queue to next part ─────────────────────────────────────
  function advanceQueue() {
    const next = queueIndex + 1;
    if (next >= partQueue.length) {
      onComplete();
    } else {
      setQueueIndex(next);
      setSelectedFeelings([]);
      setFreeText('');
      setPhase('feel-towards');
      // Scroll Screen 1 back to top for the next part
      setTimeout(() => {
        screen1ScrollRef.current?.scrollTo({ y: 0, animated: false });
      }, 50);
    }
  }

  // ── Chip toggle helpers ─────────────────────────────────────────────────────
  function toggleFeeling(f: string) {
    setSelectedFeelings((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  }

  function togglePartYTarget(id: string) {
    setPartYTargets((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  // ── Chip rendering helpers ──────────────────────────────────────────────────
  function renderChipGroup(
    chips: string[],
    selected: string[],
    toggle: (f: string) => void,
    chipStyle: object,
    chipSelStyle: object,
    textStyle: object,
    textSelStyle: object,
  ) {
    return (
      <View style={mft.chips}>
        {chips.map((chip) => {
          const sel = selected.includes(chip);
          return (
            <TouchableOpacity
              key={chip}
              style={[mft.chip, chipStyle, sel && chipSelStyle]}
              onPress={() => toggle(chip)}
              activeOpacity={0.75}
            >
              <Text style={[textStyle, sel && textSelStyle]}>{chip}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  function renderThreeChipSections(
    feelings: string[],
    toggleFn: (f: string) => void,
  ) {
    return (
      <>
        {/* TEXT: feel-towards chip section — parts present */}
        <Text style={mft.groupLabel}>PARTS PRESENT</Text>
        {renderChipGroup(
          FEEL_TOWARDS_REACTIVE, feelings, toggleFn,
          mft.reactiveChip, mft.reactiveChipSel, mft.chipText, mft.chipTextSel,
        )}
        {/* TEXT: feel-towards chip section — self-like part present */}
        <Text style={[mft.groupLabel, { marginTop: 16 }]}>SELF-LIKE PART PRESENT</Text>
        {renderChipGroup(
          FEEL_TOWARDS_SELF_LIKE, feelings, toggleFn,
          mft.selfLikeChip, mft.selfLikeChipSel, mft.selfLikeChipText, mft.selfLikeChipTextSel,
        )}
        {/* TEXT: feel-towards chip section — self energy present */}
        <Text style={[mft.groupLabel, { marginTop: 16 }]}>SELF ENERGY PRESENT</Text>
        {renderChipGroup(
          FEEL_TOWARDS_SELF_QUALITIES, feelings, toggleFn,
          mft.selfChip, mft.selfChipSel, mft.chipText, mft.selfChipTextSel,
        )}
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 1 — feel-towards
  // ─────────────────────────────────────────────────────────────────────────────

  function handleScreen1Continue() {
    // Write Self → currentTarget edge to relMap
    const edge: MapEdge = {
      fromId: 'self',
      toId: currentTargetId,
      feelings: selectedFeelings,
      isSelfLike: selectedFeelings.some((f) => FEEL_TOWARDS_SELF_LIKE.includes(f)),
    };
    onRelMapUpdate((prev) => addOrReplaceEdge(prev, edge));

    if (isSelfOnly(selectedFeelings)) {
      advanceQueue();
    } else {
      // Reactive or self-like (or nothing) — something is present
      setCarriedFeelings([...selectedFeelings]);
      setSelectedNewPartId(null);
      setNewPartName('');
      setPartSavedConfirm('');
      setPhase('something-present');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 2 — something-present (part selector)
  // ─────────────────────────────────────────────────────────────────────────────

  async function handleSaveNewPart() {
    const trimmed = newPartName.trim();
    if (!trimmed || isSavingPart) return;
    setIsSavingPart(true);
    try {
      const db = getDatabase();
      const countRow = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM parts WHERE name LIKE 'Unknown%'`,
      );
      const resolvedName = trimmed;
      const now = new Date().toISOString();
      const newId = generateId();
      await db.runAsync(
        `INSERT INTO parts (id, name, type, discovered_via, created_at, updated_at)
         VALUES (?, ?, 'unknown', 'meeting_room', ?, ?)`,
        [newId, resolvedName, now, now],
      );
      await db.runAsync(
        `INSERT OR IGNORE INTO part_profiles (part_id, updated_at) VALUES (?, ?)`,
        [newId, now],
      );
      await db.runAsync(
        `INSERT INTO updates (id, update_type, part_id, content_json, created_at)
         VALUES (?, 'meeting_room_discovery', ?, ?, ?)`,
        [generateId(), newId,
         JSON.stringify({ context: 'Discovered in Meeting Room' }),
         now],
      );
      const newPart: PartRow = { id: newId, display_name: resolvedName, type: 'unknown' };
      setLocalParts((prev) => prev.some((p) => p.id === newId) ? prev : [...prev, newPart]);
      // Add to map nodes immediately (functional form — avoids stale closure)
      onRelMapUpdate((prev) =>
        prev.nodes.some((n) => n.id === newId)
          ? prev
          : { ...prev, nodes: [...prev.nodes, { id: newId, name: resolvedName, partType: 'unknown', addedDuringSession: true }] },
      );
      // Add to queue
      setPartQueue((prev) => prev.includes(newId) ? prev : [...prev, newId]);
      // Notify parent
      onPartAdded(newPart);
      setSelectedNewPartId(newId);
      setNewPartName('');
      setPartSavedConfirm(resolvedName);
      setTimeout(() => setPartSavedConfirm(''), 2000);
    } catch (e) {
      console.error('[MeetingFeelTowardsSeq] handleSaveNewPart:', e);
    } finally {
      setIsSavingPart(false);
    }
  }

  async function handleScreen2Continue() {
    if (!selectedNewPartId) return;

    let actualId = selectedNewPartId;
    let actualName = 'Unknown part';

    if (selectedNewPartId === 'unknown') {
      // Create sequential Unknown entry
      try {
        const db = getDatabase();
        const countRow = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM parts WHERE name LIKE 'Unknown%'`,
        );
        const count = countRow?.count ?? 0;
        actualName = count === 0 ? 'Unknown' : `Unknown ${count + 1}`;
        actualId = generateId();
        const now = new Date().toISOString();
        await db.runAsync(
          `INSERT INTO parts (id, name, type, discovered_via, created_at, updated_at)
           VALUES (?, ?, 'unknown', 'meeting_room', ?, ?)`,
          [actualId, actualName, now, now],
        );
        await db.runAsync(
          `INSERT OR IGNORE INTO part_profiles (part_id, updated_at) VALUES (?, ?)`,
          [actualId, now],
        );
        await db.runAsync(
          `INSERT INTO updates (id, update_type, part_id, content_json, created_at)
           VALUES (?, 'meeting_room_discovery', ?, ?, ?)`,
          [generateId(), actualId,
           JSON.stringify({ context: 'Discovered in Meeting Room' }),
           now],
        );
        const newPart: PartRow = { id: actualId, display_name: actualName, type: 'unknown' };
        setLocalParts((prev) => prev.some((p) => p.id === actualId) ? prev : [...prev, newPart]);
        // Functional form — avoids stale relMap closure
        onRelMapUpdate((prev) =>
          prev.nodes.some((n) => n.id === actualId)
            ? prev
            : { ...prev, nodes: [...prev.nodes, { id: actualId, name: actualName, partType: 'unknown', addedDuringSession: true }] },
        );
        setPartQueue((prev) => prev.includes(actualId) ? prev : [...prev, actualId]);
        onPartAdded(newPart);
      } catch (e) {
        console.error('[MeetingFeelTowardsSeq] handleScreen2Continue unknown:', e);
        return;
      }
    } else {
      // Already saved part (existing or inline-saved)
      const found = localParts.find((p) => p.id === actualId);
      actualName = found?.display_name ?? 'Unknown part';
      // FIX 1 — add existing part to queue + relMap + notify parent
      setPartQueue((prev) => prev.includes(actualId) ? prev : [...prev, actualId]);
      onRelMapUpdate((prev) =>
        prev.nodes.some((n) => n.id === actualId)
          ? prev
          : {
              ...prev,
              nodes: [
                ...prev.nodes,
                {
                  id: actualId,
                  name: actualName,
                  partType: (found?.type ?? 'unknown') as 'manager' | 'firefighter' | 'exile' | 'self' | 'unknown',
                  addedDuringSession: true,
                },
              ],
            },
      );
      onPartAdded({ id: actualId, display_name: actualName, type: found?.type ?? 'unknown' });
    }

    setPartYId(actualId);
    setPartYName(actualName);
    setPartYTargets([]); // reset Screen 4 multi-select
    setPhase('part-is-present');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 3 — part-is-present (UnblendSupportCard)
  // ─────────────────────────────────────────────────────────────────────────────

  function handleHaveSpace() {
    setSelectedFeelings([]);
    setPhase('part-feels-others');
  }

  function handleStayedBlended() {
    // Part wouldn't separate — still advance to part-feels-others
    // The relMap edge already has the Self→currentTarget feelings from Screen 1
    setSelectedFeelings([]);
    setPhase('part-feels-others');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 4 — part-feels-others (multi-select)
  // ─────────────────────────────────────────────────────────────────────────────

  function handleScreen4Continue() {
    if (partYTargets.length === 0) {
      setPhase('self-qualities');
      return;
    }
    setPartYTargetIndex(0);
    setSelectedFeelings([]);
    setPhase('part-feels-one');
  }

  function handleScreen4Skip() {
    setPhase('self-qualities');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 5 — part-feels-one (per target)
  // ─────────────────────────────────────────────────────────────────────────────

  function handleScreen5Continue() {
    if (partYId) {
      const targetId = partYTargets[partYTargetIndex];
      if (targetId) {
        const edge: MapEdge = {
          fromId: partYId,
          toId: targetId,
          feelings: selectedFeelings,
          isSelfLike: selectedFeelings.some((f) => FEEL_TOWARDS_SELF_LIKE.includes(f)),
        };
        onRelMapUpdate((prev) => addOrReplaceEdge(prev, edge));
      }
    }
    const nextIdx = partYTargetIndex + 1;
    if (nextIdx >= partYTargets.length) {
      setPhase('self-qualities');
    } else {
      setPartYTargetIndex(nextIdx);
      setSelectedFeelings([]);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 6 — self-qualities (8 Cs + 5 Ps)
  // ─────────────────────────────────────────────────────────────────────────────

  function handleScreen6Continue() {
    // Reset Part Y state and return to Screen 1 for the SAME current target
    setSelectedFeelings([]);
    setFreeText('');
    setPartYId(null);
    setPartYName('');
    setPartYTargets([]);
    setPartYTargetIndex(0);
    setCarriedFeelings([]);
    setSelectedNewPartId(null);
    setPhase('feel-towards');
    // queueIndex does NOT change — re-check the same part
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — progress bar shared by all screens
  // ─────────────────────────────────────────────────────────────────────────────

  function renderProgressBar(sub?: string) {
    return (
      <View style={mft.progressBar}>
        <Text style={mft.progressText}>
          {queueIndex + 1} of {partQueue.length} parts
          {sub ? `  ·  ${sub}` : ''}
        </Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 3 render
  // ─────────────────────────────────────────────────────────────────────────────

  if (phase === 'part-is-present') {
    return (
      <View style={{ flex: 1 }}>
        {renderProgressBar(partYName)}
        <UnblendSupportCard
          partName={partYName}
          onHaveSpace={handleHaveSpace}
          onStayedBlended={handleStayedBlended}
          mode="unblending"
          selectedFeelings={carriedFeelings.filter(
            (f) => FEEL_TOWARDS_REACTIVE.includes(f) || FEEL_TOWARDS_SELF_LIKE.includes(f),
          )}
        />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 4 render — part-feels-others
  // ─────────────────────────────────────────────────────────────────────────────

  if (phase === 'part-feels-others') {
    // Use partYId when set (mid-cycle); fall back to currentTargetId after reset.
    // This covers the case where handleScreen6Continue clears partYId before
    // the next queue item reaches Screen 4.
    const fromIdToCheck = partYId ?? currentTargetId;

    const partYAlreadyExpressedTowards = new Set<string>(
      relMap.edges
        .filter((e) => e.fromId === fromIdToCheck)
        .map((e) => e.toId),
      // partYTargets intentionally NOT included — those are current in-progress
      // selections, not yet committed to relMap. They must remain visible and
      // selectable/deselectable until the user taps Continue.
    );

    const otherParticipants = relMap.nodes.filter(
      (n) =>
        n.id !== fromIdToCheck &&
        n.id !== currentTargetId &&
        n.id !== 'self' &&
        n.partType !== 'self' &&
        !partYAlreadyExpressedTowards.has(n.id),
    );
    const hasSelection = partYTargets.length > 0;

    return (
      <View style={{ flex: 1 }}>
        {renderProgressBar(partYName)}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={mft.content}
          showsVerticalScrollIndicator={false}
        >
          {/* TEXT: part-feels-others heading */}
          <Text style={mft.heading}>
            Does {partYName} have feelings towards anyone else in the room?
          </Text>
          {/* TEXT: part-feels-others instruction */}
          <Text style={mft.subText}>Select all that apply.</Text>

          {otherParticipants.length === 0 ? (
            <Text style={mft.emptyText}>No other parts in the room.</Text>
          ) : (
            otherParticipants.map((node) => {
              const sel = partYTargets.includes(node.id);
              const local = localParts.find((p) => p.id === node.id);
              const color = TYPE_COLOR[local?.type ?? 'unknown'] ?? '#6B6860';
              return (
                <TouchableOpacity
                  key={node.id}
                  style={[mft.partRow, sel && mft.partRowSel, sel && { borderColor: color }]}
                  onPress={() => togglePartYTarget(node.id)}
                  activeOpacity={0.75}
                >
                  {sel
                    ? <Ionicons name="checkmark-circle" size={20} color={color} />
                    : <View style={mft.partRadio} />}
                  <View style={[mft.partTypeDot, { backgroundColor: color }]} />
                  <Text style={[mft.partRowText, sel && mft.partRowTextSel]}>
                    {node.name}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={mft.footer}>
          {!hasSelection && (
            <TouchableOpacity
              style={mft.skipLink}
              onPress={handleScreen4Skip}
              activeOpacity={0.75}
            >
              {/* TEXT: part-feels-others skip */}
              <Text style={mft.skipLinkText}>Skip — no feelings towards others</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[mft.btn, !hasSelection && { opacity: 0.4 }]}
            onPress={handleScreen4Continue}
            disabled={!hasSelection}
            activeOpacity={0.85}
          >
            <Text style={mft.btnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 5 render — part-feels-one
  // ─────────────────────────────────────────────────────────────────────────────

  if (phase === 'part-feels-one') {
    const targetId = partYTargets[partYTargetIndex];
    const targetName = targetId ? getPartName(targetId) : 'this part';
    const progressNote = `${partYName} → ${targetName}`;

    return (
      <View style={{ flex: 1 }}>
        {renderProgressBar(progressNote)}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={mft.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* TEXT: part-feels-one heading */}
          <Text style={mft.heading}>
            How does {partYName} feel towards {targetName}?
          </Text>

          {renderThreeChipSections(selectedFeelings, toggleFeeling)}

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={mft.footer}>
          <TouchableOpacity
            style={mft.btn}
            onPress={handleScreen5Continue}
            activeOpacity={0.85}
          >
            <Text style={mft.btnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 6 render — self-qualities
  // ─────────────────────────────────────────────────────────────────────────────

  if (phase === 'self-qualities') {
    return (
      <View style={{ flex: 1 }}>
        {renderProgressBar()}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={mft.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={mft.selfBadge}>
            <Ionicons name="sunny-outline" size={14} color="#B88A00" />
            {/* TEXT: self-qualities heading */}
            <Text style={mft.selfBadgeText}>Qualities of Self</Text>
          </View>

          {/* TEXT: self-qualities body */}
          <Text style={mft.selfQualBody}>
            As you return to {currentTargetName}, here are the qualities that arise when Self is present:
          </Text>

          <Text style={mft.sqRowLabel}>THE 8 Cs</Text>
          <View style={mft.sqPills}>
            {SELF_CS.map((q) => (
              <View key={q} style={mft.sqPill}>
                <Text style={mft.sqPillText}>{q}</Text>
              </View>
            ))}
          </View>

          <Text style={[mft.sqRowLabel, { marginTop: 16 }]}>THE 5 Ps</Text>
          <View style={mft.sqPills}>
            {SELF_PS.map((q) => (
              <View key={q} style={mft.sqPill}>
                <Text style={mft.sqPillText}>{q}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={mft.footer}>
          <TouchableOpacity
            style={mft.btn}
            onPress={handleScreen6Continue}
            activeOpacity={0.85}
          >
            <Text style={mft.btnText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 2 render — something-present
  // ─────────────────────────────────────────────────────────────────────────────

  if (phase === 'something-present') {
    const canContinue = !!selectedNewPartId;

    return (
      <View style={{ flex: 1 }}>
        {renderProgressBar()}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={mft.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* TEXT: something-present heading */}
          <Text style={mft.heading}>Something is present.</Text>

          {/* Carried feelings context strip */}
          {carriedFeelings.length > 0 && (
            <View style={mft.carriedWrap}>
              {/* TEXT: something-present context label */}
              <Text style={mft.carriedLabel}>You noticed:</Text>
              <View style={mft.carriedChips}>
                {carriedFeelings.map((f) => {
                  const isReactive = FEEL_TOWARDS_REACTIVE.includes(f);
                  const isSelfLike = FEEL_TOWARDS_SELF_LIKE.includes(f);
                  const color = isSelfLike ? '#22C55E' : isReactive ? '#C2600A' : '#B88A00';
                  return (
                    <View
                      key={f}
                      style={[mft.carriedChip, { borderColor: color + '88' }]}
                    >
                      <Text style={[mft.carriedChipText, { color }]}>{f}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* TEXT: something-present instruction */}
          <Text style={mft.subText}>Which part might this be?</Text>

          {/* Parts list — single-select; exclude currentTarget and Self-type */}
          {localParts
            .filter((p) => p.id !== currentTargetId && p.type !== 'self')
            .map((p) => {
              const sel = selectedNewPartId === p.id;
              const color = TYPE_COLOR[p.type] ?? '#6B6860';
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[mft.partRow, sel && mft.partRowSel, sel && { borderColor: color }]}
                  onPress={() => setSelectedNewPartId(sel ? null : p.id)}
                  activeOpacity={0.75}
                >
                  {sel
                    ? <Ionicons name="checkmark-circle" size={20} color={color} />
                    : <View style={mft.partRadio} />}
                  <View style={[mft.partTypeDot, { backgroundColor: color }]} />
                  <Text style={[mft.partRowText, sel && mft.partRowTextSel]}>
                    {p.display_name}
                  </Text>
                </TouchableOpacity>
              );
            })}

          {/* Unknown part option */}
          <TouchableOpacity
            style={[mft.partRow, selectedNewPartId === 'unknown' && mft.partRowSel]}
            onPress={() => setSelectedNewPartId(selectedNewPartId === 'unknown' ? null : 'unknown')}
            activeOpacity={0.75}
          >
            {selectedNewPartId === 'unknown'
              ? <Ionicons name="checkmark-circle" size={20} color="#6B6860" />
              : <View style={mft.partRadio} />}
            <View style={[mft.partTypeDot, { backgroundColor: '#6B6860' }]} />
            <View style={{ flex: 1 }}>
              <Text style={[mft.partRowText, selectedNewPartId === 'unknown' && mft.partRowTextSel]}>
                Unknown part
              </Text>
              <Text style={mft.partRowSub}>Something is present — not sure which part yet</Text>
            </View>
          </TouchableOpacity>

          {/* Inline new part save */}
          <View style={mft.newPartRow}>
            <TextInput
              style={mft.newPartInput}
              value={newPartName}
              onChangeText={setNewPartName}
              placeholder="Name a new part..."
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
            <TouchableOpacity
              style={[mft.savePartBtn, (!newPartName.trim() || isSavingPart) && mft.savePartBtnDisabled]}
              onPress={handleSaveNewPart}
              disabled={!newPartName.trim() || isSavingPart}
              activeOpacity={0.8}
            >
              <Text style={mft.savePartBtnText}>{isSavingPart ? '…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          {partSavedConfirm ? (
            <Text style={mft.savedConfirm}>✓ {partSavedConfirm} saved and selected</Text>
          ) : null}

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={mft.footer}>
          <TouchableOpacity
            style={[mft.btn, !canContinue && { opacity: 0.4 }]}
            onPress={handleScreen2Continue}
            disabled={!canContinue}
            activeOpacity={0.85}
          >
            <Text style={mft.btnText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN 1 render — feel-towards (default phase)
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1 }}>
      {renderProgressBar()}

      <ScrollView
        ref={screen1ScrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={mft.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* TEXT: meeting-feel-towards heading */}
        <Text style={mft.heading}>
          How do you feel towards {currentTargetName}?
        </Text>

        {renderThreeChipSections(selectedFeelings, toggleFeeling)}

        <TextInput
          style={mft.freeText}
          value={freeText}
          onChangeText={setFreeText}
          placeholder="Or describe it in your own words..."
          placeholderTextColor="rgba(255,255,255,0.3)"
        />

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={mft.footer}>
        <TouchableOpacity
          style={[mft.btn, (selectedFeelings.length === 0 && !freeText.trim()) && { opacity: 0.4 }]}
          onPress={handleScreen1Continue}
          disabled={selectedFeelings.length === 0 && !freeText.trim()}
          activeOpacity={0.85}
        >
          <Text style={mft.btnText}>Continue →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const mft = StyleSheet.create({
  progressBar: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#1E1E1C',
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 30,
    marginBottom: 20,
  },
  subText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 22,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 24,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1,
    marginBottom: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  chipTextSel: { color: '#FFFFFF' },
  selfChipTextSel: { color: '#FFFFFF' },
  selfLikeChipTextSel: { color: '#FFFFFF' },
  // Reactive chips
  reactiveChip: { borderColor: '#6B6860' },
  reactiveChipSel: { backgroundColor: '#2A2927', borderColor: '#6B6860' },
  // Self-like chips
  selfLikeChip: { backgroundColor: 'transparent', borderColor: '#22C55E' },
  selfLikeChipSel: { backgroundColor: 'rgba(34,197,94,0.2)', borderColor: '#22C55E' },
  selfLikeChipText: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  // Self-quality chips
  selfChip: { borderColor: '#B88A00' },
  selfChipSel: { backgroundColor: '#B88A00', borderColor: '#B88A00' },
  // Free-text input
  freeText: {
    marginTop: 16,
    backgroundColor: '#2A2927',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
  },
  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1917',
    gap: 10,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 16,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  skipLink: { alignItems: 'center', paddingVertical: 2 },
  skipLinkText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  // Carried feelings strip (Screen 2)
  carriedWrap: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  carriedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  carriedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  carriedChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  carriedChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  // Part rows (Screens 2 and 4)
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  partRowSel: {
    backgroundColor: 'rgba(59,91,165,0.08)',
  },
  partRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    flexShrink: 0,
  },
  partTypeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  partRowText: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  partRowTextSel: { color: '#FFFFFF' },
  partRowSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  // New part inline save (Screen 2)
  newPartRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  newPartInput: {
    flex: 1,
    backgroundColor: '#2A2927',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
  },
  savePartBtn: {
    backgroundColor: '#3B5BA5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  savePartBtnDisabled: { opacity: 0.4 },
  savePartBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  savedConfirm: { fontSize: 12, color: '#B88A00', marginTop: 6 },
  // Self qualities (Screen 6)
  selfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(184,138,0,0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  selfBadgeText: { fontSize: 12, fontWeight: '600', color: '#B88A00' },
  selfQualBody: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 24,
    marginBottom: 20,
  },
  sqRowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sqPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sqPill: {
    borderWidth: 1,
    borderColor: 'rgba(184,138,0,0.4)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  sqPillText: {
    fontSize: 13,
    color: '#B88A00',
    fontWeight: '500',
  },
});
