/**
 * MeetingDialogueStep — 'meeting-dialogue' step type.
 *
 * Phases:
 *   prompt-1 (first part speaks) → prompt-2 (second part responds) →
 *   prompt-3 (Self responds) → dialogue (free canvas)
 *
 * Does NOT navigate to dialogue-session.tsx.
 * Does NOT write to inner_dialogues table.
 * All data saved in practice_sessions notes_json.
 *
 * Fixes applied:
 *   FIX 4 — Dialogue pre-populated with 3 opening prompt responses
 *   FIX 5 — Part avatar circles (32px, initials, type-color)
 *   FIX 6 — Inline new-part save in opening prompt selectors
 *   FIX 7 — Unblend button shows two-option choice (pulled-in vs new-part)
 *   FIX 8 — "Close meeting" visible outlined pill button (bottom-left)
 */

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { UnblendSupportCard } from './UnblendSupportCard';
import { FullUnblendFlow } from './FullUnblendFlow';
import {
  FEEL_TOWARDS_SELF_QUALITIES,
  FEEL_TOWARDS_REACTIVE,
  FEEL_TOWARDS_SELF_LIKE,
  type TechniqueStep,
} from '@/lib/techniques-data';
import { addOrReplaceEdge, type RelationalMap } from '@/lib/relational-map';
import { getDatabase } from '@/lib/database';

// ─── Self-qualities constants ──────────────────────────────────────────────────

const SELF_CS = ['Calm', 'Curious', 'Clear', 'Compassionate', 'Confident', 'Creative', 'Courageous', 'Connected'];
const SELF_PS = ['Present', 'Patient', 'Playful', 'Persistent', 'Perspective'];

// ─── Types ────────────────────────────────────────────────────────────────────

type PartType = 'manager' | 'firefighter' | 'exile' | 'self' | 'unknown';
interface PartRow { id: string; display_name: string; type: PartType; }
const TYPE_COLOR: Record<PartType, string> = {
  manager: '#3B5BA5', firefighter: '#C2600A', exile: '#7C3D9B', self: '#B88A00', unknown: '#6B6860',
};

interface DialogueMessage {
  id: string;
  speaker: string;
  partId?: string;
  partType?: PartType;
  isSelf: boolean;
  text: string;
  timestamp: string;
}

interface OpeningPrompt { partId?: string; partName: string; content: string; }

type PromptPhase = 'prompt-1' | 'prompt-2' | 'prompt-3' | 'dialogue' | 'pre-close' | 'relational-check';

// FIX 7 — unblend mode in dialogue canvas
type UnblendMode = null | 'choice' | 'select-room-part' | 'new-part-form' | 'support-card';

interface Props {
  step: TechniqueStep;
  parts: PartRow[];
  selectedPartIds: string[];
  onAdvance: (data: string) => void;
  spaceType?: string;
  onGround?: () => void;
  onPartSaved?: (part: PartRow) => void;
  relMap?: RelationalMap;
  onRelMapUpdate?: Dispatch<SetStateAction<RelationalMap>>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// TEXT: meeting-space rules list
const RULES = [
  'Each part speaks for itself — no speaking over others.',
  'Parts describe their experience, not attacks.',
  'Fear and limits are welcome.',
  'Nothing has to be resolved today — witnessing is enough.',
  'Self is the host — not a judge, not a fixer, just present.',
  'Every part has a reason for what it does.',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// FIX 5 — derive initials from part name
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MeetingDialogueStep({ step: _step, parts: propParts, selectedPartIds: propSelectedPartIds, onAdvance, spaceType, onGround, onPartSaved, relMap, onRelMapUpdate }: Props) {
  // FIX 6 — use local state so inline-saved parts propagate within this component
  const [localParts, setLocalParts] = useState<PartRow[]>(propParts);
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(propSelectedPartIds);

  // Derive selected parts from live local state (FIX 3 — always reads live state)
  const selectedParts = localParts.filter((p) => localSelectedIds.includes(p.id));

  const [promptPhase, setPromptPhase] = useState<PromptPhase>('prompt-1');
  const [firstPartId,  setFirstPartId]  = useState<string | null>(selectedParts[0]?.id ?? null);
  const [firstPartInput, setFirstPartInput]   = useState('');
  const [secondPartId, setSecondPartId] = useState<string | null>(selectedParts[1]?.id ?? null);
  const [secondPartInput, setSecondPartInput] = useState('');
  const [selfInput,    setSelfInput]    = useState('');
  const [openingPrompts, setOpeningPrompts] = useState<OpeningPrompt[]>([]);

  // FIX 6 — inline new-part save state (opening prompts)
  const [newPromptPartName, setNewPromptPartName] = useState('');
  const [isSavingPromptPart, setIsSavingPromptPart] = useState(false);
  const [promptPartSavedName, setPromptPartSavedName] = useState<string | null>(null);

  // Dialogue phase state
  const [messages, setMessages]             = useState<DialogueMessage[]>([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string>(selectedParts[0]?.id ?? 'self');
  const [messageText, setMessageText]       = useState('');

  // Support modals
  const [showRules,   setShowRules]   = useState(false);
  const [showReframe, setShowReframe] = useState(false);

  // Collapsible support tray
  const [trayOpen, setTrayOpen] = useState(false);

  // Scroll hint for speaker chip row
  const [showScrollHint, setShowScrollHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowScrollHint(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // FullUnblendFlow state
  const [showFullUnblend, setShowFullUnblend] = useState(false);

  // FIX 4 — relational check state
  const [pairFeelings, setPairFeelings] = useState<Record<string, string[]>>({});

  // FIX 7 — unblend flow state
  const [unblendMode,         setUnblendMode]         = useState<UnblendMode>(null);
  const [unblendTargetPartId, setUnblendTargetPartId] = useState<string | null>(null);
  const [unblendPartName,     setUnblendPartName]     = useState('');
  const [newUnblendName,      setNewUnblendName]      = useState('');
  const [isSavingUnblendPart, setIsSavingUnblendPart] = useState(false);

  // Self Qualities overlay
  const [showSelfQualities, setShowSelfQualities] = useState(false);

  // Add Part flow
  const [showAddPart,     setShowAddPart]     = useState(false);
  const [addPartPhase,    setAddPartPhase]    = useState<'select' | 'feel-towards-cycle' | 'self-qualities'>('select');
  const [addPartSelectedId,   setAddPartSelectedId]   = useState<string | null>(null);
  const [addPartNewName,      setAddPartNewName]       = useState('');
  const [isSavingAddPart,     setIsSavingAddPart]      = useState(false);
  const [addPartSavedConfirm, setAddPartSavedConfirm]  = useState('');
  const [addedPartId,             setAddedPartId]             = useState<string | null>(null);
  const [addedPartName,           setAddedPartName]           = useState('');
  const [addPartFeelingTargets,   setAddPartFeelingTargets]   = useState<string[]>([]);
  const [addPartFeelingIndex,     setAddPartFeelingIndex]     = useState(0);
  const [addPartFeelings,         setAddPartFeelings]         = useState<string[]>([]);

  const listRef = { current: null as null | { scrollToEnd: (o: { animated: boolean }) => void } };

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getPartById(id: string): PartRow | undefined {
    return localParts.find((p) => p.id === id);
  }

  function getActiveSpeakerName(): string {
    if (activeSpeakerId === 'self') return 'Self';
    return getPartById(activeSpeakerId)?.display_name ?? 'Unknown';
  }

  function getActiveSpeakerType(): PartType | undefined {
    if (activeSpeakerId === 'self') return 'self';
    return getPartById(activeSpeakerId)?.type;
  }

  // FIX 6 — save a new part and add to local state
  async function saveNewPromptPart() {
    const trimmed = newPromptPartName.trim();
    if (!trimmed || isSavingPromptPart) return;
    setIsSavingPromptPart(true);
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
      setLocalParts((prev) => [...prev, newPart]);
      setLocalSelectedIds((prev) => prev.includes(newId) ? prev : [...prev, newId]);
      setNewPromptPartName('');
      setPromptPartSavedName(trimmed);
      setTimeout(() => setPromptPartSavedName(null), 2000);
    } catch (e) {
      console.error('[MeetingDialogueStep] saveNewPromptPart:', e);
    } finally {
      setIsSavingPromptPart(false);
    }
  }

  // ── Dialogue helpers ────────────────────────────────────────────────────

  function sendMessage() {
    if (!messageText.trim()) return;
    const isSelf = activeSpeakerId === 'self';
    const partType = getActiveSpeakerType();
    const msg: DialogueMessage = {
      id: generateId(),
      speaker: getActiveSpeakerName(),
      partId: isSelf ? undefined : activeSpeakerId,
      partType,
      isSelf,
      text: messageText.trim(),
      timestamp: formatTime(new Date()),
    };
    setMessages((prev) => [...prev, msg]);
    setMessageText('');
  }

  // FIX 4 — pre-close / relational-check helpers

  function handleTryClose() {
    setTrayOpen(false);
    setPromptPhase('pre-close');
  }

  function handleCloseConfirm() {
    onAdvance(JSON.stringify({
      space_type: spaceType,
      opening_prompts: openingPrompts,
      messages,
      parts_present: localSelectedIds,
    }));
  }

  function handleCloseWithRelational() {
    const edges = Object.entries(pairFeelings)
      .filter(([, feelings]) => feelings.length > 0)
      .map(([key, feelings]) => {
        const sepIdx = key.indexOf('→');
        const fromId = key.slice(0, sepIdx);
        const toId   = key.slice(sepIdx + 1);
        return { fromId, toId, feelings };
      });
    onAdvance(JSON.stringify({
      space_type: spaceType,
      opening_prompts: openingPrompts,
      messages,
      parts_present: localSelectedIds,
      relational_edges: edges.length > 0 ? edges : undefined,
    }));
  }

  function getRelationalPairs(): Array<{ fromId: string; fromName: string; toId: string; toName: string }> {
    const pairs: Array<{ fromId: string; fromName: string; toId: string; toName: string }> = [];
    for (const from of selectedParts) {
      // part → Self
      pairs.push({ fromId: from.id, fromName: from.display_name, toId: 'self', toName: 'Self' });
      // part → other parts
      for (const to of selectedParts) {
        if (from.id !== to.id) {
          pairs.push({ fromId: from.id, fromName: from.display_name, toId: to.id, toName: to.display_name });
        }
      }
    }
    return pairs;
  }

  function togglePairFeeling(fromId: string, toId: string, feeling: string) {
    const key = `${fromId}→${toId}`;
    setPairFeelings((prev) => {
      const current = prev[key] ?? [];
      const updated = current.includes(feeling)
        ? current.filter((f) => f !== feeling)
        : [...current, feeling];
      return { ...prev, [key]: updated };
    });
  }

  // ── FIX 7 — Unblend flow ─────────────────────────────────────────────────

  async function handleSaveUnblendNewPart() {
    const trimmed = newUnblendName.trim();
    if (!trimmed || isSavingUnblendPart) return;
    setIsSavingUnblendPart(true);
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
      setLocalParts((prev) => [...prev, newPart]);
      setLocalSelectedIds((prev) => prev.includes(newId) ? prev : [...prev, newId]);
      setUnblendPartName(trimmed);
      setNewUnblendName('');
      setUnblendMode('support-card');
    } catch (e) {
      console.error('[MeetingDialogueStep] saveUnblendNewPart:', e);
    } finally {
      setIsSavingUnblendPart(false);
    }
  }

  function dismissUnblend() {
    setUnblendMode(null);
    setUnblendTargetPartId(null);
    setUnblendPartName('');
    setNewUnblendName('');
  }

  // ── Add Part flow ─────────────────────────────────────────────────────────

  async function handleSaveAddPartNew() {
    const trimmed = addPartNewName.trim();
    if (!trimmed || isSavingAddPart) return;
    setIsSavingAddPart(true);
    try {
      const db = getDatabase();
      const newId = generateId();
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO parts (id, name, type, discovered_via, created_at, updated_at)
         VALUES (?, ?, 'unknown', 'meeting_room', ?, ?)`,
        [newId, trimmed, now, now],
      );
      await db.runAsync(
        `INSERT OR IGNORE INTO part_profiles (part_id, updated_at) VALUES (?, ?)`,
        [newId, now],
      );
      const newPart: PartRow = { id: newId, display_name: trimmed, type: 'unknown' };
      setLocalParts((prev) => prev.some((p) => p.id === newId) ? prev : [...prev, newPart]);
      setAddPartSelectedId(newId);
      setAddPartNewName('');
      setAddPartSavedConfirm(trimmed);
      setTimeout(() => setAddPartSavedConfirm(''), 2000);
      onPartSaved?.(newPart);
    } catch (e) {
      console.error('[MeetingDialogueStep] handleSaveAddPartNew:', e);
    } finally {
      setIsSavingAddPart(false);
    }
  }

  async function handleAddPartToMeeting() {
    if (!addPartSelectedId) return;

    let actualId = addPartSelectedId;
    let actualName = 'Unknown part';

    if (actualId === 'unknown') {
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
        const newPart: PartRow = { id: actualId, display_name: actualName, type: 'unknown' };
        setLocalParts((prev) => prev.some((p) => p.id === actualId) ? prev : [...prev, newPart]);
        onPartSaved?.(newPart);
      } catch (e) {
        console.error('[MeetingDialogueStep] handleAddPartToMeeting unknown:', e);
        return;
      }
    } else {
      const found = localParts.find((p) => p.id === actualId);
      actualName = found?.display_name ?? 'Unknown part';
    }

    // Add to room participants
    setLocalSelectedIds((prev) => prev.includes(actualId) ? prev : [...prev, actualId]);

    // Add to relMap nodes if available (functional form — avoids stale closure)
    if (onRelMapUpdate) {
      onRelMapUpdate((prev) =>
        prev.nodes.some((n) => n.id === actualId)
          ? prev
          : { ...prev, nodes: [...prev.nodes, { id: actualId, name: actualName, partType: 'unknown', addedDuringSession: true }] },
      );
    }

    // Set up feel-towards cycle: new part → each existing participant
    const existingParticipants = localSelectedIds.filter((id) => id !== actualId);

    setAddedPartId(actualId);
    setAddedPartName(actualName);
    setAddPartFeelingTargets(existingParticipants);
    setAddPartFeelingIndex(0);
    setAddPartFeelings([]);
    setAddPartPhase('feel-towards-cycle');
  }

  function handleAddPartFeelContinue() {
    const targetId = addPartFeelingTargets[addPartFeelingIndex];
    if (addedPartId && targetId && onRelMapUpdate) {
      const edge = {
        fromId: addedPartId,
        toId: targetId,
        feelings: addPartFeelings,
        isSelfLike: addPartFeelings.some((f) => FEEL_TOWARDS_SELF_LIKE.includes(f)),
      };
      onRelMapUpdate((prev) => addOrReplaceEdge(prev, edge));
    }
    const next = addPartFeelingIndex + 1;
    if (next >= addPartFeelingTargets.length) {
      setAddPartPhase('self-qualities');
    } else {
      setAddPartFeelingIndex(next);
      setAddPartFeelings([]);
    }
  }

  function toggleAddPartFeeling(f: string) {
    setAddPartFeelings((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  }

  function renderAddPartChipGroup(
    chips: string[],
    selected: string[],
    chipStyle: object,
    chipSelStyle: object,
    textColor: string,
    textSelColor: string,
  ) {
    return (
      <View style={ap.chips}>
        {chips.map((chip) => {
          const sel = selected.includes(chip);
          return (
            <TouchableOpacity
              key={chip}
              style={[ap.chip, chipStyle, sel && chipSelStyle]}
              onPress={() => toggleAddPartFeeling(chip)}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 13, color: sel ? textSelColor : textColor, fontWeight: '500' }}>
                {chip}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // ── Add Part flow ─────────────────────────────────────────────────────────

  if (showAddPart) {
    // ── Phase: select ──────────────────────────────────────────────────────
    if (addPartPhase === 'select') {
      return (
        <View style={{ flex: 1, backgroundColor: '#1A1917' }}>
          <View style={hdr.row}>
            <TouchableOpacity
              onPress={() => { setShowAddPart(false); setAddPartPhase('select'); setAddPartSelectedId(null); setAddPartNewName(''); }}
              hitSlop={12}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            {/* TEXT: dialogue-add-part heading */}
            <Text style={hdr.title}>Who else is joining?</Text>
            <View style={{ width: 28 }} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={ap.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={ap.heading}>Who else is joining the meeting?</Text>
            {localParts.filter((p) => !localSelectedIds.includes(p.id)).map((p) => {
              const sel = addPartSelectedId === p.id;
              const color = TYPE_COLOR[p.type] ?? '#6B6860';
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[ap.partRow, sel && { borderColor: color }]}
                  onPress={() => setAddPartSelectedId(sel ? null : p.id)}
                  activeOpacity={0.75}
                >
                  {sel ? <Ionicons name="checkmark-circle" size={20} color={color} /> : <View style={ap.radio} />}
                  <View style={[ap.typeDot, { backgroundColor: color }]} />
                  <Text style={[ap.partName, sel && { color: '#FFFFFF' }]}>{p.display_name}</Text>
                </TouchableOpacity>
              );
            })}
            {/* Unknown part option */}
            <TouchableOpacity
              style={[ap.partRow, addPartSelectedId === 'unknown' && { borderColor: '#6B6860' }]}
              onPress={() => setAddPartSelectedId(addPartSelectedId === 'unknown' ? null : 'unknown')}
              activeOpacity={0.75}
            >
              {addPartSelectedId === 'unknown' ? <Ionicons name="checkmark-circle" size={20} color="#6B6860" /> : <View style={ap.radio} />}
              <View style={[ap.typeDot, { backgroundColor: '#6B6860' }]} />
              <Text style={ap.partName}>Unknown part</Text>
            </TouchableOpacity>
            {/* Inline new part save */}
            <View style={ap.newPartRow}>
              <TextInput
                style={ap.newPartInput}
                value={addPartNewName}
                onChangeText={setAddPartNewName}
                placeholder="Name a new part..."
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              <TouchableOpacity
                style={[ap.saveBtn, (!addPartNewName.trim() || isSavingAddPart) && ap.saveBtnDisabled]}
                onPress={handleSaveAddPartNew}
                disabled={!addPartNewName.trim() || isSavingAddPart}
                activeOpacity={0.8}
              >
                <Text style={ap.saveBtnText}>{isSavingAddPart ? '…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
            {addPartSavedConfirm ? <Text style={ap.savedConfirm}>✓ {addPartSavedConfirm} saved</Text> : null}
            <View style={{ height: 100 }} />
          </ScrollView>
          <View style={hdr.footer}>
            <TouchableOpacity
              style={[hdr.btn, !addPartSelectedId && { opacity: 0.4 }]}
              onPress={handleAddPartToMeeting}
              disabled={!addPartSelectedId}
              activeOpacity={0.85}
            >
              <Text style={hdr.btnText}>Add to meeting →</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // ── Phase: feel-towards-cycle ──────────────────────────────────────────
    if (addPartPhase === 'feel-towards-cycle') {
      const targetId = addPartFeelingTargets[addPartFeelingIndex];
      const targetName = localParts.find((p) => p.id === targetId)?.display_name ?? 'this part';
      const progressLabel = `${addPartFeelingIndex + 1} of ${addPartFeelingTargets.length}`;

      return (
        <View style={{ flex: 1, backgroundColor: '#1A1917' }}>
          <View style={hdr.row}>
            <View style={{ width: 28 }} />
            {/* TEXT: dialogue-add-part feel-towards */}
            <Text style={hdr.title}>{addedPartName} → {targetName}</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{progressLabel}</Text>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={ap.content} showsVerticalScrollIndicator={false}>
            <Text style={ap.heading}>
              How does {addedPartName} feel towards {targetName}?
            </Text>
            <Text style={ap.groupLabel}>PARTS PRESENT</Text>
            {renderAddPartChipGroup(FEEL_TOWARDS_REACTIVE, addPartFeelings, ap.chip, ap.chipSel, 'rgba(255,255,255,0.7)', '#FFFFFF')}
            <Text style={[ap.groupLabel, { marginTop: 14 }]}>SELF-LIKE PART PRESENT</Text>
            {renderAddPartChipGroup(FEEL_TOWARDS_SELF_LIKE, addPartFeelings, { ...ap.chip, borderColor: '#22C55E' }, { ...ap.chip, borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.2)' }, 'rgba(255,255,255,0.85)', '#FFFFFF')}
            <Text style={[ap.groupLabel, { marginTop: 14 }]}>SELF ENERGY PRESENT</Text>
            {renderAddPartChipGroup(FEEL_TOWARDS_SELF_QUALITIES, addPartFeelings, { ...ap.chip, borderColor: '#B88A00' }, { ...ap.chip, borderColor: '#B88A00', backgroundColor: '#B88A00' }, 'rgba(255,255,255,0.7)', '#FFFFFF')}
            <View style={{ height: 100 }} />
          </ScrollView>
          <View style={hdr.footer}>
            <TouchableOpacity style={hdr.btn} onPress={handleAddPartFeelContinue} activeOpacity={0.85}>
              <Text style={hdr.btnText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // ── Phase: self-qualities ──────────────────────────────────────────────
    if (addPartPhase === 'self-qualities') {
      return (
        <View style={{ flex: 1, backgroundColor: '#1A1917' }}>
          <View style={hdr.row}>
            <View style={{ width: 28 }} />
            <Text style={hdr.title}>Self Qualities</Text>
            <View style={{ width: 28 }} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={sq.content} showsVerticalScrollIndicator={false}>
            {/* TEXT: dialogue-add-part self-qualities body */}
            <Text style={sq.body}>
              {addedPartName} is now in the meeting. Here are the qualities of Self as you return to the dialogue:
            </Text>
            <Text style={sq.rowLabel}>THE 8 Cs</Text>
            <View style={sq.pills}>
              {SELF_CS.map((q) => (
                <View key={q} style={sq.pill}>
                  <Text style={sq.pillText}>{q}</Text>
                </View>
              ))}
            </View>
            <Text style={[sq.rowLabel, { marginTop: 16 }]}>THE 5 Ps</Text>
            <View style={sq.pills}>
              {SELF_PS.map((q) => (
                <View key={q} style={sq.pill}>
                  <Text style={sq.pillText}>{q}</Text>
                </View>
              ))}
            </View>
            <View style={{ height: 80 }} />
          </ScrollView>
          <View style={hdr.footer}>
            <TouchableOpacity
              style={hdr.btn}
              onPress={() => { setShowAddPart(false); setAddPartPhase('select'); setAddPartSelectedId(null); }}
              activeOpacity={0.85}
            >
              <Text style={hdr.btnText}>Return to meeting →</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
  }

  // ── Unblend mode screens ─────────────────────────────────────────────────

  if (unblendMode === 'support-card') {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1917' }}>
        <View style={hdr.row}>
          <TouchableOpacity onPress={dismissUnblend} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <Text style={hdr.title}>Unblend</Text>
          <View style={{ width: 28 }} />
        </View>
        <UnblendSupportCard partName={unblendPartName || getActiveSpeakerName()} onHaveSpace={dismissUnblend} />
      </View>
    );
  }

  if (unblendMode === 'choice') {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1917' }}>
        <View style={hdr.row}>
          <TouchableOpacity onPress={dismissUnblend} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          {/* TEXT: meeting-space reframe overlay */}
          <Text style={hdr.title}>What's happening?</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 16 }}>
          {/* Choice 1: pulled into a part */}
          <TouchableOpacity
            style={ub.choiceCard}
            onPress={() => setUnblendMode('select-room-part')}
            activeOpacity={0.8}
          >
            <Ionicons name="git-branch-outline" size={24} color="#9B9A94" style={{ marginBottom: 8 }} />
            <Text style={ub.choiceTitle}>I'm getting pulled into a part</Text>
            <Text style={ub.choiceSub}>A part in the room is blending with me</Text>
          </TouchableOpacity>

          {/* Choice 2: new part arising */}
          <TouchableOpacity
            style={ub.choiceCard}
            onPress={() => setUnblendMode('new-part-form')}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={24} color="#9B9A94" style={{ marginBottom: 8 }} />
            <Text style={ub.choiceTitle}>A new part is arising</Text>
            <Text style={ub.choiceSub}>Something new has entered the space</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (unblendMode === 'select-room-part') {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1917' }}>
        <View style={hdr.row}>
          <TouchableOpacity onPress={() => setUnblendMode('choice')} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <Text style={hdr.title}>Which part?</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 8 }}>
          <Text style={ub.subtitle}>Which meeting room part is blending with you?</Text>
          {selectedParts.map((p) => {
            const color = TYPE_COLOR[p.type] ?? '#6B6860';
            const sel = unblendTargetPartId === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[pr.partCard, { borderColor: sel ? color : 'rgba(255,255,255,0.1)' }]}
                onPress={() => {
                  setUnblendTargetPartId(p.id);
                  setUnblendPartName(p.display_name);
                  setUnblendMode('support-card');
                }}
                activeOpacity={0.75}
              >
                <View style={[pr.typeDot, { backgroundColor: color }]} />
                <Text style={pr.partName}>{p.display_name}</Text>
                {sel && <Ionicons name="checkmark-circle" size={18} color={color} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  if (unblendMode === 'new-part-form') {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1917' }}>
        <View style={hdr.row}>
          <TouchableOpacity onPress={() => setUnblendMode('choice')} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <Text style={hdr.title}>Name the part</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 16 }}>
          <Text style={ub.subtitle}>What name comes for this part that has entered the space?</Text>
          <View style={ub.newPartRow}>
            <TextInput
              style={ub.newPartInput}
              value={newUnblendName}
              onChangeText={setNewUnblendName}
              placeholder="Name a part..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoFocus
            />
            <TouchableOpacity
              style={[ub.saveBtn, (!newUnblendName.trim() || isSavingUnblendPart) && ub.saveBtnDisabled]}
              onPress={handleSaveUnblendNewPart}
              disabled={!newUnblendName.trim() || isSavingUnblendPart}
              activeOpacity={0.75}
            >
              <Text style={ub.saveBtnText}>{isSavingUnblendPart ? '...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Opening prompt 1 ──────────────────────────────────────────────────────

  if (promptPhase === 'prompt-1') {
    const firstPart = firstPartId ? getPartById(firstPartId) : null;
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={pr.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* TEXT: meeting-space prompt-1 heading/body */}
          <Text style={pr.heading}>Who speaks first?</Text>
          <Text style={pr.body}>The loudest part, the most activated, or whoever comes forward.</Text>
          <View style={pr.partList}>
            {selectedParts.map((p) => {
              const color = TYPE_COLOR[p.type] ?? '#6B6860';
              const selected = firstPartId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[pr.partCard, { borderColor: selected ? color : 'rgba(255,255,255,0.1)' }]}
                  onPress={() => setFirstPartId(p.id)}
                  activeOpacity={0.75}
                >
                  <View style={[pr.typeDot, { backgroundColor: color }]} />
                  <Text style={pr.partName}>{p.display_name}</Text>
                  {selected && <Ionicons name="checkmark-circle" size={18} color={color} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {firstPart && (
            <>
              <Text style={pr.inputLabel}>
                What is {firstPart.display_name} saying, showing, or feeling right now?
              </Text>
              <TextInput
                style={pr.input}
                value={firstPartInput}
                onChangeText={setFirstPartInput}
                placeholder="Let it speak — an image, a word, a feeling, an impulse..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                textAlignVertical="top"
              />
            </>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
        <View style={pr.footer}>
          <TouchableOpacity
            style={[pr.nextBtn, !firstPartId && pr.nextBtnDisabled]}
            onPress={() => {
              if (!firstPartId) return;
              const p = getPartById(firstPartId);
              setOpeningPrompts((prev) => [
                ...prev,
                { partId: firstPartId, partName: p?.display_name ?? '', content: firstPartInput },
              ]);
              setNewPromptPartName('');
              setPromptPartSavedName(null);
              setPromptPhase('prompt-2');
            }}
            disabled={!firstPartId}
            activeOpacity={0.85}
          >
            <Text style={pr.nextBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Opening prompt 2 ──────────────────────────────────────────────────────

  if (promptPhase === 'prompt-2') {
    const remainingParts = selectedParts.filter((p) => p.id !== firstPartId);
    const secondPart = secondPartId ? getPartById(secondPartId) : null;
    if (!secondPartId && remainingParts.length > 0) {
      setSecondPartId(remainingParts[0].id);
    }
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={pr.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* TEXT: meeting-space prompt-2 heading/body */}
          <Text style={pr.heading}>Now invite another part to respond.</Text>
          <View style={pr.partList}>
            {remainingParts.map((p) => {
              const color = TYPE_COLOR[p.type] ?? '#6B6860';
              const selected = secondPartId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[pr.partCard, { borderColor: selected ? color : 'rgba(255,255,255,0.1)' }]}
                  onPress={() => setSecondPartId(p.id)}
                  activeOpacity={0.75}
                >
                  <View style={[pr.typeDot, { backgroundColor: color }]} />
                  <Text style={pr.partName}>{p.display_name}</Text>
                  {selected && <Ionicons name="checkmark-circle" size={18} color={color} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* FIX 6 — inline new-part save */}
          <Text style={pr.orLabel}>Note a new part:</Text>
          <View style={pr.newPartRow}>
            <TextInput
              style={pr.newPartInput}
              value={newPromptPartName}
              onChangeText={setNewPromptPartName}
              placeholder="Name a part that's present..."
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
            <TouchableOpacity
              style={[pr.saveBtn, (!newPromptPartName.trim() || isSavingPromptPart) && pr.saveBtnDisabled]}
              onPress={saveNewPromptPart}
              disabled={!newPromptPartName.trim() || isSavingPromptPart}
              activeOpacity={0.75}
            >
              <Text style={pr.saveBtnText}>{isSavingPromptPart ? '...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          {promptPartSavedName && (
            <Text style={pr.savedConfirm}>✓ {promptPartSavedName} saved and added to meeting</Text>
          )}

          {secondPart && (
            <>
              <Text style={pr.inputLabel}>
                What does {secondPart.display_name} want the other parts to know?
              </Text>
              <TextInput
                style={pr.input}
                value={secondPartInput}
                onChangeText={setSecondPartInput}
                placeholder="Whatever arises..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                textAlignVertical="top"
              />
            </>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
        <View style={pr.footer}>
          <TouchableOpacity
            style={[pr.nextBtn, !secondPartId && pr.nextBtnDisabled]}
            onPress={() => {
              if (!secondPartId) return;
              const p = getPartById(secondPartId);
              setOpeningPrompts((prev) => [
                ...prev,
                { partId: secondPartId, partName: p?.display_name ?? '', content: secondPartInput },
              ]);
              setNewPromptPartName('');
              setPromptPartSavedName(null);
              setPromptPhase('prompt-3');
            }}
            disabled={!secondPartId}
            activeOpacity={0.85}
          >
            <Text style={pr.nextBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Opening prompt 3 — Self response ─────────────────────────────────────

  if (promptPhase === 'prompt-3') {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={pr.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* TEXT: meeting-space prompt-3 heading/body */}
          <Text style={pr.heading}>From the place of Self...</Text>
          <Text style={pr.body}>
            What do you — as the host of this meeting — want these parts to hear?
          </Text>
          <TextInput
            style={pr.input}
            value={selfInput}
            onChangeText={setSelfInput}
            placeholder="From curiosity and care..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            textAlignVertical="top"
            autoFocus
          />
          <View style={{ height: 100 }} />
        </ScrollView>
        <View style={pr.footer}>
          <TouchableOpacity
            style={pr.nextBtn}
            onPress={() => {
              setOpeningPrompts((prev) => [...prev, { partName: 'Self', content: selfInput }]);

              // FIX 4 — pre-populate dialogue with the 3 opening prompt responses
              const now = new Date();
              const firstPart  = firstPartId  ? getPartById(firstPartId)  : null;
              const secondPart = secondPartId ? getPartById(secondPartId) : null;
              const initial: DialogueMessage[] = [];
              if (firstPart && firstPartInput.trim()) {
                initial.push({
                  id: generateId(),
                  speaker: firstPart.display_name,
                  partId: firstPart.id,
                  partType: firstPart.type,
                  isSelf: false,
                  text: firstPartInput.trim(),
                  timestamp: formatTime(now),
                });
              }
              if (secondPart && secondPartInput.trim()) {
                initial.push({
                  id: generateId(),
                  speaker: secondPart.display_name,
                  partId: secondPart.id,
                  partType: secondPart.type,
                  isSelf: false,
                  text: secondPartInput.trim(),
                  timestamp: formatTime(now),
                });
              }
              if (selfInput.trim()) {
                initial.push({
                  id: generateId(),
                  speaker: 'Self',
                  partId: undefined,
                  partType: 'self',
                  isSelf: true,
                  text: selfInput.trim(),
                  timestamp: formatTime(now),
                });
              }
              setMessages(initial);
              setActiveSpeakerId(selectedParts[0]?.id ?? 'self');
              setPromptPhase('dialogue');
            }}
            activeOpacity={0.85}
          >
            <Text style={pr.nextBtnText}>Open the meeting</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Pre-close phase ───────────────────────────────────────────────────────

  if (promptPhase === 'pre-close') {
    return (
      <View style={{ flex: 1 }}>
        <View style={hdr.row}>
          <TouchableOpacity onPress={() => setPromptPhase('dialogue')} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          {/* TEXT: meeting-space pre-close header */}
          <Text style={hdr.title}>Before we close</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={pc.content} showsVerticalScrollIndicator={false}>
          {/* TEXT: meeting-space pre-close heading */}
          <Text style={pc.heading}>Before we close</Text>
          {/* TEXT: meeting-space pre-close body */}
          <Text style={pc.body}>
            The dialogue will be saved to your practice log.{'\n\n'}
            You can optionally note how the parts are feeling towards each other right now — a quick relational check.
          </Text>
        </ScrollView>
        <View style={pr.footer}>
          <TouchableOpacity
            style={pc.noteRelBtn}
            onPress={() => setPromptPhase('relational-check')}
            activeOpacity={0.85}
          >
            <Text style={pc.noteRelBtnText}>Note how parts are feeling (optional)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={pr.nextBtn} onPress={handleCloseConfirm} activeOpacity={0.85}>
            <Text style={pr.nextBtnText}>End meeting</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Relational-check phase ────────────────────────────────────────────────

  if (promptPhase === 'relational-check') {
    const pairs = getRelationalPairs();
    const ALL_FEELINGS = [...FEEL_TOWARDS_REACTIVE, ...FEEL_TOWARDS_SELF_LIKE, ...FEEL_TOWARDS_SELF_QUALITIES];
    return (
      <View style={{ flex: 1 }}>
        <View style={hdr.row}>
          <TouchableOpacity onPress={() => setPromptPhase('pre-close')} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          {/* TEXT: meeting-space relational-check header */}
          <Text style={hdr.title}>Relational check</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={rc.content}
          showsVerticalScrollIndicator={false}
        >
          {/* TEXT: meeting-space relational-summary heading */}
          <Text style={rc.heading}>Before we close — quick relational check</Text>
          {/* TEXT: meeting-space relational-summary body */}
          <Text style={rc.body}>
            How are the parts feeling towards each other right now? Tap each to note what's present.
          </Text>
          {pairs.map(({ fromId, fromName, toId, toName }) => {
            const key = `${fromId}→${toId}`;
            const selected = pairFeelings[key] ?? [];
            return (
              <View key={key} style={rc.pairBlock}>
                <Text style={rc.pairLabel}>{fromName} → {toName}</Text>
                <View style={rc.chips}>
                  {ALL_FEELINGS.map((feeling) => {
                    const isSel = selected.includes(feeling);
                    return (
                      <TouchableOpacity
                        key={feeling}
                        style={[rc.chip, isSel && rc.chipSel]}
                        onPress={() => togglePairFeeling(fromId, toId, feeling)}
                        activeOpacity={0.75}
                      >
                        <Text style={[rc.chipText, isSel && rc.chipTextSel]}>{feeling}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>
        <View style={pr.footer}>
          <TouchableOpacity style={pr.nextBtn} onPress={handleCloseWithRelational} activeOpacity={0.85}>
            <Text style={pr.nextBtnText}>Done — end meeting</Text>
          </TouchableOpacity>
          <TouchableOpacity style={pc.skipBtn} onPress={handleCloseConfirm} activeOpacity={0.75}>
            <Text style={pc.skipBtnText}>Skip — end meeting without relational check</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Free dialogue canvas ──────────────────────────────────────────────────

  const activeSpeakerColor = activeSpeakerId === 'self'
    ? '#B88A00'
    : TYPE_COLOR[getActiveSpeakerType() ?? 'unknown'] ?? '#6B6860';

  // All speakers: selected parts + Self
  const speakers = [
    ...selectedParts,
    { id: 'self', display_name: 'Self', type: 'self' as PartType },
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* Message list */}
      <FlatList
        ref={(r) => { (listRef as { current: typeof r }).current = r; }}
        data={messages}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={dl.messageList}
        renderItem={({ item, index }) => {
          const showName = index === 0 || messages[index - 1].speaker !== item.speaker;
          const partColor = item.isSelf ? '#B88A00' : (TYPE_COLOR[item.partType ?? 'unknown'] ?? '#6B6860');
          // FIX 5 — avatar
          const avatarInitials = item.isSelf ? 'S' : getInitials(item.speaker);

          return (
            <View style={[dl.msgRow, item.isSelf && dl.msgRowRight]}>
              {/* Avatar — left for parts, right for Self */}
              {!item.isSelf && (
                <View style={[dl.avatar, { backgroundColor: partColor }]}>
                  <Text style={dl.avatarText}>{avatarInitials}</Text>
                </View>
              )}
              <View style={[dl.msgWrapper, item.isSelf && dl.msgWrapperRight]}>
                {!item.isSelf && showName && (
                  <Text style={[dl.msgName, { color: partColor }]}>{item.speaker}</Text>
                )}
                <View style={[
                  dl.bubble,
                  { backgroundColor: partColor },
                  item.isSelf && dl.bubbleRight,
                ]}>
                  <Text style={dl.bubbleText}>{item.text}</Text>
                </View>
                <Text style={[dl.timestamp, item.isSelf && dl.timestampRight]}>
                  {item.timestamp}
                </Text>
              </View>
              {item.isSelf && (
                <View style={[dl.avatar, { backgroundColor: partColor }]}>
                  <Text style={dl.avatarText}>{avatarInitials}</Text>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={dl.emptyState}>
            <Text style={dl.emptyText}>The space is open. Begin when you're ready.</Text>
          </View>
        }
        onContentSizeChange={() => {
          if (messages.length > 0) listRef.current?.scrollToEnd({ animated: false });
        }}
      />

      {/* Input area */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Speaker selector with right-fade scroll affordance */}
        <View style={dl.speakerBarWrap}>
          <ScrollView
            horizontal
            style={dl.speakerBar}
            contentContainerStyle={dl.speakerBarContent}
            showsHorizontalScrollIndicator={false}
          >
            {speakers.map((spk) => {
              const color = spk.id === 'self' ? '#B88A00' : TYPE_COLOR[spk.type as PartType] ?? '#6B6860';
              const active = activeSpeakerId === spk.id;
              return (
                <TouchableOpacity
                  key={spk.id}
                  style={[dl.speakerChip, { backgroundColor: color, opacity: active ? 1 : 0.35 }]}
                  onPress={() => setActiveSpeakerId(spk.id)}
                  activeOpacity={0.75}
                >
                  <Text style={dl.speakerChipText}>{spk.display_name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Right-edge fade overlay */}
          <View style={dl.speakerBarFade} pointerEvents="none" />
        </View>
        {showScrollHint && (
          <Text style={dl.scrollHint}>← scroll to see more →</Text>
        )}

        {/* Text input row */}
        <View style={dl.inputRow}>
          <TextInput
            style={dl.textInput}
            value={messageText}
            onChangeText={setMessageText}
            placeholder={`${getActiveSpeakerName()} says...`}
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
          />
          <TouchableOpacity
            style={[dl.sendBtn, { backgroundColor: activeSpeakerColor }]}
            onPress={sendMessage}
            disabled={!messageText.trim()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Outside-tap dismissal overlay (behind tray) */}
      {trayOpen && (
        <TouchableOpacity
          style={dl.trayDismissOverlay}
          onPress={() => setTrayOpen(false)}
          activeOpacity={1}
        />
      )}

      {/* Collapsible support tray — tray items (visible when open) */}
      {/* Positions shifted up from original (toggle at 116 instead of 88) */}
      {trayOpen && (
        <>
          <View style={[dl.trayItem, { bottom: 176 }]}>
            <TouchableOpacity style={dl.trayBtn} onPress={handleTryClose} activeOpacity={0.85}>
              <Ionicons name="exit-outline" size={18} color="#9B9A94" />
            </TouchableOpacity>
            <View style={dl.trayLabelPill}>
              <Text style={dl.trayLabelText}>End meeting</Text>
            </View>
          </View>
          {/* New: Self Qualities — bottom: 232 */}
          <View style={[dl.trayItem, { bottom: 232 }]}>
            <TouchableOpacity style={dl.trayBtn} onPress={() => { setTrayOpen(false); setShowSelfQualities(true); }} activeOpacity={0.85}>
              <Ionicons name="star-outline" size={18} color="#9B9A94" />
            </TouchableOpacity>
            <View style={dl.trayLabelPill}>
              <Text style={dl.trayLabelText}>Self qualities</Text>
            </View>
          </View>
          {/* New: Add Part — bottom: 288 */}
          <View style={[dl.trayItem, { bottom: 288 }]}>
            <TouchableOpacity style={dl.trayBtn} onPress={() => { setTrayOpen(false); setShowAddPart(true); setAddPartPhase('select'); setAddPartSelectedId(null); }} activeOpacity={0.85}>
              <Ionicons name="add-circle-outline" size={18} color="#9B9A94" />
            </TouchableOpacity>
            <View style={dl.trayLabelPill}>
              <Text style={dl.trayLabelText}>Add part</Text>
            </View>
          </View>
          {/* Ground — shifted to 344 */}
          <View style={[dl.trayItem, { bottom: 344 }]}>
            <TouchableOpacity style={dl.trayBtn} onPress={() => { setTrayOpen(false); onGround?.(); }} activeOpacity={0.85}>
              <Ionicons name="leaf-outline" size={18} color="#9B9A94" />
            </TouchableOpacity>
            <View style={dl.trayLabelPill}>
              <Text style={dl.trayLabelText}>Ground</Text>
            </View>
          </View>
          {/* Unblend — shifted to 400 */}
          <View style={[dl.trayItem, { bottom: 400 }]}>
            <TouchableOpacity style={dl.trayBtn} onPress={() => { setTrayOpen(false); setShowFullUnblend(true); }} activeOpacity={0.85}>
              <Ionicons name="git-branch-outline" size={18} color="#9B9A94" />
            </TouchableOpacity>
            <View style={dl.trayLabelPill}>
              <Text style={dl.trayLabelText}>Unblend</Text>
            </View>
          </View>
          {/* Rules — shifted to 456 */}
          <View style={[dl.trayItem, { bottom: 456 }]}>
            <TouchableOpacity style={dl.trayBtn} onPress={() => { setTrayOpen(false); setShowRules(true); }} activeOpacity={0.85}>
              <Ionicons name="list-outline" size={18} color="#9B9A94" />
            </TouchableOpacity>
            <View style={dl.trayLabelPill}>
              <Text style={dl.trayLabelText}>Rules</Text>
            </View>
          </View>
          {/* Reframe — shifted to 512 */}
          <View style={[dl.trayItem, { bottom: 512 }]}>
            <TouchableOpacity style={dl.trayBtn} onPress={() => { setTrayOpen(false); setShowReframe(true); }} activeOpacity={0.85}>
              <Ionicons name="compass-outline" size={18} color="#9B9A94" />
            </TouchableOpacity>
            <View style={dl.trayLabelPill}>
              <Text style={dl.trayLabelText}>Reframe</Text>
            </View>
          </View>
        </>
      )}

      {/* Tray toggle button — bottom: 116 clears input bar (≥ 8px gap) */}
      <TouchableOpacity
        style={dl.trayToggle}
        onPress={() => setTrayOpen((v) => !v)}
        activeOpacity={0.85}
      >
        <Ionicons name={trayOpen ? 'close' : 'ellipsis-horizontal'} size={20} color="#9B9A94" />
      </TouchableOpacity>

      {/* FullUnblendFlow overlay */}
      <FullUnblendFlow
        visible={showFullUnblend}
        onComplete={(result) => {
          setShowFullUnblend(false);
          // Parts saved via onPartSaved callback — no unblend_log persisted here (meeting log is the record)
        }}
        onDismiss={() => setShowFullUnblend(false)}
        parts={localParts}
        onPartSaved={(p) => {
          setLocalParts((prev) => [...prev, p]);
          setLocalSelectedIds((prev) => prev.includes(p.id) ? prev : [...prev, p.id]);
          onPartSaved?.(p);
        }}
        context="meeting-room"
      />

      {/* Rules modal */}
      <Modal visible={showRules} animationType="slide" transparent onRequestClose={() => setShowRules(false)}>
        <View style={mo.overlay}>
          <View style={mo.sheet}>
            <Text style={mo.heading}>Meeting agreements</Text>
            {RULES.map((rule, i) => (
              <View key={i} style={mo.ruleRow}>
                <Text style={mo.ruleNum}>{i + 1}</Text>
                <Text style={mo.ruleText}>{rule}</Text>
              </View>
            ))}
            <TouchableOpacity style={mo.closeBtn} onPress={() => setShowRules(false)} activeOpacity={0.85}>
              <Text style={mo.closeBtnText}>Return to meeting</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reframe modal */}
      <Modal visible={showReframe} animationType="slide" transparent onRequestClose={() => setShowReframe(false)}>
        <View style={mo.overlay}>
          <View style={mo.sheet}>
            <Text style={mo.heading}>Return to the space.</Text>
            <Text style={mo.body}>
              Take a breath. Remember where you are.{'\n\n'}
              You are the host — present, curious, not merged with any part.{'\n\n'}
              The parts in this meeting:
            </Text>
            <View style={mo.partsList}>
              {selectedParts.map((p) => {
                const color = TYPE_COLOR[p.type] ?? '#6B6860';
                return (
                  <View key={p.id} style={mo.partRow}>
                    <View style={[mo.dot, { backgroundColor: color }]} />
                    <Text style={mo.partName}>{p.display_name}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={mo.body}>
              Each of them is here. Each of them is safe.{'\n'}
              You don't need to fix anything — just witness.
            </Text>
            <TouchableOpacity style={mo.closeBtn} onPress={() => setShowReframe(false)} activeOpacity={0.85}>
              <Text style={mo.closeBtnText}>I'm back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Self Qualities modal — same slide-up sheet as Rules */}
      <Modal visible={showSelfQualities} animationType="slide" transparent onRequestClose={() => setShowSelfQualities(false)}>
        <View style={mo.overlay}>
          <View style={mo.sheet}>
            {/* TEXT: dialogue-self-qualities heading */}
            <Text style={mo.heading}>Qualities of Self</Text>
            {/* TEXT: dialogue-self-qualities body */}
            <Text style={mo.body}>
              A reminder of what's available when Self is present in this meeting:
            </Text>
            <Text style={sq.rowLabel}>THE 8 Cs</Text>
            <View style={sq.pills}>
              {SELF_CS.map((q) => (
                <View key={q} style={sq.pill}>
                  <Text style={sq.pillText}>{q}</Text>
                </View>
              ))}
            </View>
            <Text style={[sq.rowLabel, { marginTop: 12 }]}>THE 5 Ps</Text>
            <View style={sq.pills}>
              {SELF_PS.map((q) => (
                <View key={q} style={sq.pill}>
                  <Text style={sq.pillText}>{q}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={mo.closeBtn} onPress={() => setShowSelfQualities(false)} activeOpacity={0.85}>
              <Text style={mo.closeBtnText}>Back to meeting</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pr = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 30, marginBottom: 12 },
  body: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 24, marginBottom: 20 },
  partList: { gap: 8, marginBottom: 20 },
  partCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1.5, padding: 14,
  },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  partName: { flex: 1, fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  orLabel: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 8 },
  newPartRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  newPartInput: {
    flex: 1, backgroundColor: '#2A2927', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#FFFFFF',
  },
  saveBtn: {
    borderWidth: 1.5, borderColor: '#3B5BA5', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#3B5BA5' },
  savedConfirm: { fontSize: 12, color: '#4CAF50', marginBottom: 12 },
  inputLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 10, lineHeight: 20, marginTop: 16 },
  input: {
    backgroundColor: '#2A2927', borderRadius: 12, padding: 14,
    fontSize: 15, color: '#FFFFFF', minHeight: 100, lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1917',
  },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#3B5BA5', borderRadius: 14, paddingVertical: 16,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

const dl = StyleSheet.create({
  // FIX 5 — message row layout with avatars
  messageList: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 100, gap: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, maxWidth: '85%' },
  msgRowRight: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  // Avatar
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    opacity: 0.9, flexShrink: 0, marginTop: 2,
  },
  avatarText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  // Bubble content
  msgWrapper: { flex: 1, gap: 2 },
  msgWrapperRight: { alignItems: 'flex-end' },
  msgName: { fontSize: 11, fontWeight: '600', marginLeft: 2 },
  bubble: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleRight: { borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 15, color: '#FFFFFF', lineHeight: 22 },
  timestamp: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 2 },
  timestampRight: { textAlign: 'right', marginRight: 2 },
  emptyState: { paddingTop: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' },
  // Speaker bar + input
  speakerBarWrap: { position: 'relative', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: '#1A1917' },
  speakerBar: { backgroundColor: '#1A1917' },
  speakerBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  speakerBarFade: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 32,
    backgroundColor: 'rgba(26,25,23,0.7)',
  },
  scrollHint: {
    fontSize: 11, color: 'rgba(255,255,255,0.3)',
    textAlign: 'center', paddingBottom: 2, fontStyle: 'italic',
    backgroundColor: '#1A1917',
  },
  speakerChip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  speakerChipText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingBottom: 12, gap: 8,
    backgroundColor: '#1A1917',
  },
  textInput: {
    flex: 1, backgroundColor: '#2A2927', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: '#FFFFFF', maxHeight: 100,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  // Collapsible tray
  trayDismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9,
  },
  trayToggle: {
    position: 'absolute', bottom: 88, right: 20,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#2A2927', borderWidth: 1, borderColor: '#3A3937',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 11,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
  trayItem: {
    position: 'absolute', right: 20,
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    zIndex: 11,
  },
  trayBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1E1E1C', borderWidth: 1, borderColor: '#2A2927',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
  },
  trayLabelPill: {
    backgroundColor: '#1E1E1C', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: '#2A2927',
  },
  trayLabelText: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
});

const hdr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  title: {
    flex: 1, fontSize: 15, fontWeight: '600',
    color: 'rgba(255,255,255,0.75)', textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1917',
  },
  btn: {
    backgroundColor: '#3B5BA5', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

// Self Qualities overlay styles
const sq = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },
  body: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 24, marginBottom: 20 },
  rowLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1, marginBottom: 10,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1, borderColor: 'rgba(184,138,0,0.4)',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  pillText: { fontSize: 13, color: '#B88A00', fontWeight: '500' },
});

// Add Part flow styles
const ap = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  heading: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', lineHeight: 28, marginBottom: 16 },
  groupLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1, marginBottom: 10,
  },
  partRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', flexShrink: 0,
  },
  typeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  partName: { flex: 1, fontSize: 15, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  newPartRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 8 },
  newPartInput: {
    flex: 1, backgroundColor: '#2A2927', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#FFFFFF',
  },
  saveBtn: { backgroundColor: '#3B5BA5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  savedConfirm: { fontSize: 12, color: '#B88A00', marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5, borderColor: '#6B6860',
  },
  chipSel: { backgroundColor: '#2A2927', borderColor: '#6B6860' },
});

// FIX 7 — unblend choice styles
const ub = StyleSheet.create({
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 22, marginBottom: 8 },
  choiceCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    padding: 20, alignItems: 'center',
  },
  choiceTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 6, textAlign: 'center' },
  choiceSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20 },
  newPartRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  newPartInput: {
    flex: 1, backgroundColor: '#2A2927', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#FFFFFF',
  },
  saveBtn: {
    borderWidth: 1.5, borderColor: '#3B5BA5', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#3B5BA5' },
});

const mo = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: '#242220', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40, gap: 14,
  },
  heading: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  body: { fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 22 },
  ruleRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  ruleNum: { fontSize: 12, fontWeight: '700', color: '#B88A00', width: 16 },
  ruleText: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 20 },
  partsList: { gap: 6, marginVertical: 4 },
  partRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  partName: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  closeBtn: {
    backgroundColor: '#3B5BA5', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  closeBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

// FIX 4 — Pre-close styles
const pc = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 30, marginBottom: 12 },
  body: { fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 24 },
  noteRelBtn: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 2,
  },
  noteRelBtnText: { fontSize: 15, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecorationLine: 'underline' },
});

// FIX 4 — Relational-check styles
const rc = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, gap: 16 },
  heading: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', lineHeight: 28 },
  body: { fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 22 },
  pairBlock: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    gap: 10,
  },
  pairLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
  },
  chipSel: { backgroundColor: 'rgba(59,91,165,0.3)', borderColor: '#3B5BA5' },
  chipText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  chipTextSel: { color: '#FFFFFF' },
});
