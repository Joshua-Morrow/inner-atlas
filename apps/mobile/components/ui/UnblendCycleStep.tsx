/**
 * UnblendCycleStep — self-contained renderer for 'unblend-cycle' step type.
 *
 * Internal phases:
 *   feel-towards → (reactive?) → identify-part → unblend-support → check-again → (loop)
 *   (Self-energy confirmed) → in-self → onAdvance()
 */

import { useEffect, useState } from 'react';
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
import { FullUnblendFlow, type UnblendResult } from './FullUnblendFlow';
import {
  FEEL_TOWARDS_SELF_QUALITIES,
  FEEL_TOWARDS_REACTIVE,
  FEEL_TOWARDS_SELF_LIKE,
  type TechniqueStep,
} from '@/lib/techniques-data';
import { getDatabase } from '@/lib/database';

type PartType = 'manager' | 'firefighter' | 'exile' | 'self' | 'unknown';
interface PartRow { id: string; display_name: string; type: PartType; }
const TYPE_COLOR: Record<PartType, string> = {
  manager: '#3B5BA5', firefighter: '#C2600A', exile: '#7C3D9B', self: '#B88A00', unknown: '#6B6860',
};

type Phase = 'feel-towards' | 'identify-part' | 'unblend-support' | 'check-again' | 'in-self' | 'self-sit-with';

interface IdentifiedPart { partId?: string; partName: string; feeling: string; }

import React from 'react';

interface Props {
  step: TechniqueStep;
  targetPartName: string;
  parts: PartRow[];
  onAdvance: (data: string) => void;
  onGround?: () => void;
  selectedPartId?: string;
  /** Called whenever the internal phase changes — used by parent for back-button interception */
  onPhaseChange?: (phase: string) => void;
  /** Ref that parent populates with a callback to reset phase to 'feel-towards' */
  returnToBaseRef?: React.MutableRefObject<(() => void) | null>;
  onPartSaved?: (part: PartRow) => void;
}

export function UnblendCycleStep({ step, targetPartName, parts, onAdvance, onGround, selectedPartId, onPhaseChange, returnToBaseRef, onPartSaved }: Props) {
  const [phase, setPhase] = useState<Phase>('feel-towards');
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);
  const [freeTextFeeling, setFreeTextFeeling] = useState('');
  const [identifiedParts, setIdentifiedParts] = useState<IdentifiedPart[]>([]);
  const [cycleCount, setCycleCount] = useState(0);
  const [inSelfNote, setInSelfNote] = useState('');
  // Local parts list — allows inline-saved parts to appear immediately
  const [localParts, setLocalParts] = useState<PartRow[]>(parts);
  // identify-part sub-state
  const [selectedPartForIdentify, setSelectedPartForIdentify] = useState<string | null>(null);
  const [newPartForIdentify, setNewPartForIdentify] = useState('');
  const [isSavingIdentifyPart, setIsSavingIdentifyPart] = useState(false);
  const [identifySavedConfirm, setIdentifySavedConfirm] = useState<string | null>(null);
  const [notSureYet, setNotSureYet] = useState(false);

  // Tray state (feel-towards / check-again phases only)
  const [trayOpen, setTrayOpen] = useState(false);

  // FullUnblendFlow state
  const [showFullUnblend, setShowFullUnblend] = useState(false);
  const [unblendLog, setUnblendLog] = useState<UnblendResult[]>([]);

  // Self sit-with phase state
  const [selfSitTimer, setSelfSitTimer]           = useState(120);
  const [selfSitTimerRunning, setSelfSitTimerRunning] = useState(false);
  const [selfSitNote, setSelfSitNote]             = useState('');

  const resolvedHeading = (step.heading ?? '').replace('[part]', targetPartName);
  const resolvedBody    = (step.body    ?? '').replace('[part]', targetPartName);

  // Phase helper — notifies parent whenever phase changes (for back-button interception)
  function setPhaseAndNotify(newPhase: Phase) {
    setPhase(newPhase);
    onPhaseChange?.(newPhase);
  }

  // Register return-to-base callback so header back button can reset to 'feel-towards'
  useEffect(() => {
    if (!returnToBaseRef) return;
    returnToBaseRef.current = () => setPhaseAndNotify('feel-towards');
    return () => { returnToBaseRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnToBaseRef]);

  function isSelfEnergy() {
    const hasSelf = selectedFeelings.some(
      (f) => FEEL_TOWARDS_SELF_QUALITIES.includes(f),
    );
    // Self-like chips are parts, not Self energy — treat like reactive for routing
    const hasReactive = selectedFeelings.some(
      (f) => FEEL_TOWARDS_REACTIVE.includes(f) || FEEL_TOWARDS_SELF_LIKE.includes(f),
    );
    return hasSelf && !hasReactive && !freeTextFeeling.trim();
  }

  function toggleFeeling(feeling: string) {
    setSelectedFeelings((prev) =>
      prev.includes(feeling) ? prev.filter((f) => f !== feeling) : [...prev, feeling],
    );
  }

  function handleThisIsHowIFeel() {
    if (isSelfEnergy()) {
      setPhaseAndNotify('in-self');
    } else {
      setPhaseAndNotify('identify-part');
    }
  }

  async function handleSaveIdentifyNewPart() {
    const trimmed = newPartForIdentify.trim();
    if (!trimmed || isSavingIdentifyPart) return;
    setIsSavingIdentifyPart(true);
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      const newId = (Date.now().toString(36) + Math.random().toString(36).slice(2));
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
      setSelectedPartForIdentify(newId);
      setNewPartForIdentify('');
      setNotSureYet(false);
      setIdentifySavedConfirm(trimmed);
      setTimeout(() => setIdentifySavedConfirm(null), 2000);
    } catch (e) {
      console.error('[UnblendCycleStep] handleSaveIdentifyNewPart:', e);
    } finally {
      setIsSavingIdentifyPart(false);
    }
  }

  function handleIdentifyContinue() {
    let partName = 'an unknown part';
    let partId: string | undefined;
    if (notSureYet || selectedPartForIdentify === 'unknown') {
      partName = selectedPartForIdentify === 'unknown' ? 'Unknown part' : 'an unknown part';
    } else if (selectedPartForIdentify) {
      const p = localParts.find((x) => x.id === selectedPartForIdentify);
      partName = p?.display_name ?? 'an unknown part';
      partId = selectedPartForIdentify;
    } else if (newPartForIdentify.trim()) {
      partName = newPartForIdentify.trim();
    }
    const reactiveFeeling = selectedFeelings.filter((f) =>
      FEEL_TOWARDS_REACTIVE.includes(f)).join(', ') || freeTextFeeling || 'reactivity';
    setIdentifiedParts((prev) => [...prev, { partId, partName, feeling: reactiveFeeling }]);
    setPhaseAndNotify('unblend-support');
  }

  function handleHaveSpace() {
    setCycleCount((n) => n + 1);
    setSelectedFeelings([]);
    setFreeTextFeeling('');
    setSelectedPartForIdentify(null);
    setNewPartForIdentify('');
    setNotSureYet(false);
    setPhaseAndNotify('check-again');
  }

  function handleFinishInSelf() {
    // Transition to self-sit-with card before advancing
    setSelfSitTimer(120);
    setSelfSitNote('');
    setPhaseAndNotify('self-sit-with');
  }

  // Self sit-with: 2-minute countdown, starts automatically on phase entry
  useEffect(() => {
    if (phase !== 'self-sit-with') return;
    setSelfSitTimerRunning(true);
    const id = setInterval(() => {
      setSelfSitTimer((t) => {
        if (t <= 1) {
          clearInterval(id);
          setSelfSitTimerRunning(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function handleSelfSitContinue() {
    const note = selfSitNote.trim();
    if (note && selectedPartId) {
      try {
        const db  = getDatabase();
        const now = new Date().toISOString();
        await db.runAsync(
          `INSERT OR IGNORE INTO part_profiles (part_id, updated_at) VALUES (?, ?)`,
          [selectedPartId, now],
        );
        const row = await db.getFirstAsync<{ feel_towards: string | null }>(
          `SELECT feel_towards FROM part_profiles WHERE part_id = ?`,
          [selectedPartId],
        );
        const existing = row?.feel_towards?.trim() ?? '';
        const newVal   = existing ? `${existing}\n---\n${note}` : note;
        await db.runAsync(
          `UPDATE part_profiles SET feel_towards = ?, updated_at = ? WHERE part_id = ?`,
          [newVal, now, selectedPartId],
        );
      } catch (e) {
        console.error('[UnblendCycleStep] handleSelfSitContinue save:', e);
      }
    }
    onAdvance(JSON.stringify({
      final_feeling:    selectedFeelings,
      free_text:        freeTextFeeling,
      cycle_count:      cycleCount,
      identified_parts: identifiedParts,
      in_self_note:     inSelfNote,
      self_sit_note:    note,
      unblend_log:      unblendLog.length > 0 ? unblendLog : undefined,
    }));
  }

  // ── Unblend support ───────────────────────────────────────────────────────
  if (phase === 'unblend-support') {
    const lastPart = identifiedParts[identifiedParts.length - 1];
    const reactiveSelections = selectedFeelings.filter((f) => FEEL_TOWARDS_REACTIVE.includes(f));
    const feelingsForCard = [
      ...reactiveSelections,
      ...(freeTextFeeling.trim() ? [freeTextFeeling.trim()] : []),
    ];
    return (
      <UnblendSupportCard
        partName={lastPart?.partName}
        onHaveSpace={handleHaveSpace}
        selectedFeelings={feelingsForCard.length > 0 ? feelingsForCard : undefined}
      />
    );
  }

  // ── In Self ───────────────────────────────────────────────────────────────
  if (phase === 'in-self') {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={is.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={is.badge}>
            <Ionicons name="sunny-outline" size={16} color="#B88A00" />
            {/* TEXT: feel-towards — in-self badge label */}
            <Text style={is.badgeText}>Self-energy present</Text>
          </View>
          {/* TEXT: feel-towards — in-self heading */}
          <Text style={is.heading}>You're meeting {targetPartName} from Self.</Text>
          {/* TEXT: feel-towards — in-self body */}
          <Text style={is.body}>
            Stay here for a moment. You don't need to do anything yet — just let {targetPartName} know you're present. Not to fix it. Just to be with it.
          </Text>
          {/* TEXT: feel-towards — in-self note placeholder */}
          <TextInput
            style={is.input}
            value={inSelfNote}
            onChangeText={setInSelfNote}
            placeholder="What do you notice as you hold this part from this place? (optional)"
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            textAlignVertical="top"
          />
          <View style={{ height: 100 }} />
        </ScrollView>
        <View style={foot.wrap}>
          <TouchableOpacity style={foot.btn} onPress={handleFinishInSelf} activeOpacity={0.85}>
            <Text style={foot.btnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Self sit-with ─────────────────────────────────────────────────────────
  if (phase === 'self-sit-with') {
    const mins    = Math.floor(selfSitTimer / 60);
    const secs    = selfSitTimer % 60;
    const timerStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={sw.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={is.badge}>
            <Ionicons name="sunny-outline" size={16} color="#B88A00" />
            <Text style={is.badgeText}>Self is present</Text>
          </View>
          {/* TEXT: feel-towards self-sit-with heading */}
          <Text style={sw.heading}>Rest here a moment</Text>
          {/* TEXT: feel-towards self-sit-with body */}
          <Text style={sw.body}>
            This is Self-to-part connection — you and {targetPartName}, present together. There's nothing to fix or change right now. Just notice what it's like to be here with them.
          </Text>
          {/* Countdown timer */}
          <Text style={sw.timer}>{timerStr}</Text>
          <TouchableOpacity
            style={sw.skipTimer}
            onPress={() => { setSelfSitTimerRunning(false); setSelfSitTimer(0); }}
            activeOpacity={0.75}
          >
            <Text style={sw.skipTimerText}>Skip timer</Text>
          </TouchableOpacity>
          {/* Optional note input */}
          <Text style={sw.inputLabel}>What do you notice? (optional)</Text>
          {/* TEXT: feel-towards self-sit-with placeholder */}
          <TextInput
            style={sw.input}
            value={selfSitNote}
            onChangeText={setSelfSitNote}
            placeholder="Anything that arises — a sense, an image, a quality of the connection..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            textAlignVertical="top"
          />
          <View style={{ height: 100 }} />
        </ScrollView>
        {/* TEXT: feel-towards self-sit-with advance */}
        <View style={foot.wrap}>
          <TouchableOpacity style={foot.btn} onPress={() => void handleSelfSitContinue()} activeOpacity={0.85}>
            <Text style={foot.btnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Identify part ─────────────────────────────────────────────────────────
  if (phase === 'identify-part') {
    const canContinue = notSureYet || !!selectedPartForIdentify || !!newPartForIdentify.trim();
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={ip.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* TEXT: feel-towards — identify-part heading */}
          <Text style={ip.heading}>Something is present.</Text>
          {/* TEXT: feel-towards — identify-part body */}
          <Text style={ip.body}>
            A part has feelings about {targetPartName}.{'\n'}
            See if you can sense it — do you recognize it?
          </Text>
          <View style={ip.partList}>
            {localParts.map((p) => {
              const color = TYPE_COLOR[p.type] ?? '#6B6860';
              const selected = selectedPartForIdentify === p.id && !notSureYet;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[ip.partCard, { borderColor: selected ? color : 'rgba(255,255,255,0.1)' }]}
                  onPress={() => { setSelectedPartForIdentify(p.id); setNewPartForIdentify(''); setNotSureYet(false); }}
                  activeOpacity={0.75}
                >
                  <View style={[ip.typeDot, { backgroundColor: color }]} />
                  <Text style={ip.partName}>{p.display_name}</Text>
                  {selected && <Ionicons name="checkmark-circle" size={18} color={color} />}
                </TouchableOpacity>
              );
            })}
            {/* Unknown part option */}
            <TouchableOpacity
              style={[ip.partCard, { borderColor: selectedPartForIdentify === 'unknown' ? '#6B6860' : 'rgba(255,255,255,0.1)' }]}
              onPress={() => { setSelectedPartForIdentify(selectedPartForIdentify === 'unknown' ? null : 'unknown'); setNewPartForIdentify(''); setNotSureYet(false); }}
              activeOpacity={0.75}
            >
              <View style={[ip.typeDot, { backgroundColor: '#6B6860' }]} />
              <View style={{ flex: 1 }}>
                <Text style={ip.partName}>Unknown part</Text>
                <Text style={ip.partSubText}>Something is present — not sure which part yet</Text>
              </View>
              {selectedPartForIdentify === 'unknown' && (
                <Ionicons name="checkmark-circle" size={18} color="#6B6860" />
              )}
            </TouchableOpacity>

            {/* Inline new part save */}
            <Text style={ip.orLabel}>OR NAME A NEW PART</Text>
            <View style={ip.newPartRow}>
              <TextInput
                style={ip.newPartInput}
                value={newPartForIdentify}
                onChangeText={(v) => { setNewPartForIdentify(v); setSelectedPartForIdentify(null); setNotSureYet(false); }}
                placeholder="Name a new part..."
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              <TouchableOpacity
                style={[ip.savePartBtn, (!newPartForIdentify.trim() || isSavingIdentifyPart) && ip.savePartBtnDisabled]}
                onPress={handleSaveIdentifyNewPart}
                disabled={!newPartForIdentify.trim() || isSavingIdentifyPart}
                activeOpacity={0.85}
              >
                <Text style={ip.savePartBtnText}>{isSavingIdentifyPart ? 'Saving…' : 'Save Part'}</Text>
              </TouchableOpacity>
            </View>
            {identifySavedConfirm && (
              <Text style={ip.savedConfirm}>✓ {identifySavedConfirm} saved and selected</Text>
            )}

            <TouchableOpacity
              style={[ip.notSureBtn, notSureYet && ip.notSureBtnSelected]}
              onPress={() => { setNotSureYet(true); setSelectedPartForIdentify(null); setNewPartForIdentify(''); }}
              activeOpacity={0.75}
            >
              <Text style={[ip.notSureText, notSureYet && ip.notSureTextSelected]}>Not sure yet</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
        <View style={foot.wrap}>
          <TouchableOpacity
            style={[foot.btn, !canContinue && foot.btnDisabled]}
            onPress={handleIdentifyContinue}
            disabled={!canContinue}
            activeOpacity={0.85}
          >
            <Text style={foot.btnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Feel-towards / Check-again ────────────────────────────────────────────
  const isCheckAgain = phase === 'check-again';
  const lastIdentified = identifiedParts[identifiedParts.length - 1];
  const hasSelection = selectedFeelings.length > 0 || !!freeTextFeeling.trim();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={ft.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isCheckAgain && lastIdentified && (
          <Text style={ft.cycleNote}>
            Cycle {cycleCount} — checking in after unblending from {lastIdentified.partName}
          </Text>
        )}
        {/* TEXT: feel-towards — feel-towards heading (check-again variant inline) */}
        <Text style={ft.heading}>
          {isCheckAgain ? `How do you feel toward ${targetPartName} now?` : resolvedHeading}
        </Text>
        {!isCheckAgain && resolvedBody ? <Text style={ft.body}>{resolvedBody}</Text> : null}

        {/* TEXT: feel-towards — "PARTS PRESENT" section label */}
        <Text style={ft.groupLabel}>PARTS PRESENT</Text>
        <View style={ft.chips}>
          {FEEL_TOWARDS_REACTIVE.map((chip) => {
            const sel = selectedFeelings.includes(chip);
            return (
              <TouchableOpacity
                key={chip}
                style={[ft.chip, ft.reactiveChip, sel && ft.reactiveChipSelected]}
                onPress={() => toggleFeeling(chip)}
                activeOpacity={0.75}
              >
                <Text style={[ft.chipText, sel && ft.chipTextSel]}>{chip}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TEXT: feel-towards — "SELF-LIKE PART PRESENT" section label */}
        <Text style={[ft.groupLabel, { marginTop: 16 }]}>SELF-LIKE PART PRESENT</Text>
        <View style={ft.chips}>
          {FEEL_TOWARDS_SELF_LIKE.map((chip) => {
            const sel = selectedFeelings.includes(chip);
            return (
              <TouchableOpacity
                key={chip}
                style={[ft.chip, ft.selfLikeChip, sel && ft.selfLikeChipSelected]}
                onPress={() => toggleFeeling(chip)}
                activeOpacity={0.75}
              >
                <Text style={[ft.selfLikeChipText, sel && ft.selfLikeChipTextSel]}>{chip}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TEXT: feel-towards — "SELF-ENERGY PRESENT" section label */}
        <Text style={[ft.groupLabel, { marginTop: 16 }]}>SELF-ENERGY PRESENT</Text>
        <View style={ft.chips}>
          {FEEL_TOWARDS_SELF_QUALITIES.map((chip) => {
            const sel = selectedFeelings.includes(chip);
            return (
              <TouchableOpacity
                key={chip}
                style={[ft.chip, ft.selfChip, sel && ft.selfChipSelected]}
                onPress={() => toggleFeeling(chip)}
                activeOpacity={0.75}
              >
                <Text style={[ft.chipText, sel && ft.selfChipTextSel]}>{chip}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TEXT: feel-towards — free text placeholder */}
        <TextInput
          style={ft.freeText}
          value={freeTextFeeling}
          onChangeText={setFreeTextFeeling}
          placeholder="Or describe it..."
          placeholderTextColor="rgba(255,255,255,0.3)"
        />
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={foot.wrap}>
        <TouchableOpacity
          style={[foot.btn, !hasSelection && foot.btnDisabled]}
          onPress={handleThisIsHowIFeel}
          disabled={!hasSelection}
          activeOpacity={0.85}
        >
          <Text style={foot.btnText}>This is how I feel</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Dismiss overlay — closes tray on outside tap */}
      {trayOpen && (
        <TouchableOpacity
          style={tr.dismissOverlay}
          onPress={() => setTrayOpen(false)}
          activeOpacity={1}
        />
      )}

      {/* Tray item — Unblend (closer to toggle) */}
      {trayOpen && (
        <View style={[tr.item, { bottom: 148 }]}>
          <TouchableOpacity
            style={tr.btn}
            onPress={() => { setTrayOpen(false); setShowFullUnblend(true); }}
            activeOpacity={0.85}
          >
            <Ionicons name="git-branch-outline" size={20} color="#9B9A94" />
          </TouchableOpacity>
          <View style={tr.labelPill}>
            <Text style={tr.labelText}>Unblend</Text>
          </View>
        </View>
      )}

      {/* Tray item — Ground (further from toggle) */}
      {trayOpen && (
        <View style={[tr.item, { bottom: 204 }]}>
          <TouchableOpacity
            style={tr.btn}
            onPress={() => { setTrayOpen(false); onGround?.(); }}
            activeOpacity={0.85}
          >
            <Ionicons name="leaf-outline" size={20} color="#9B9A94" />
          </TouchableOpacity>
          <View style={tr.labelPill}>
            <Text style={tr.labelText}>Ground</Text>
          </View>
        </View>
      )}

      {/* Tray toggle button — bottom: 88 clears the footer */}
      <TouchableOpacity
        style={tr.toggle}
        onPress={() => setTrayOpen((v) => !v)}
        activeOpacity={0.85}
      >
        <Ionicons name={trayOpen ? 'close' : 'ellipsis-horizontal'} size={20} color="#9B9A94" />
      </TouchableOpacity>

      {/* FullUnblendFlow overlay */}
      <FullUnblendFlow
        visible={showFullUnblend}
        onComplete={(result) => { setUnblendLog((prev) => [...prev, result]); setShowFullUnblend(false); }}
        onDismiss={() => setShowFullUnblend(false)}
        parts={localParts}
        onPartSaved={(p) => { setLocalParts((prev) => [...prev, p]); onPartSaved?.(p); }}
        context="feel-towards"
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const foot = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1917',
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
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

const ft = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },
  cycleNote: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12, fontStyle: 'italic' },
  heading: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 30, marginBottom: 12 },
  body: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 24, marginBottom: 20 },
  groupLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5 },
  selfChip: { borderColor: '#B88A00' },
  selfChipSelected: { backgroundColor: '#B88A00', borderColor: '#B88A00' },
  reactiveChip: { borderColor: '#6B6860' },
  reactiveChipSelected: { backgroundColor: '#2A2927', borderColor: '#6B6860' },
  selfLikeChip: { backgroundColor: 'transparent', borderColor: '#22C55E' },
  selfLikeChipSelected: { backgroundColor: 'rgba(34,197,94,0.2)', borderColor: '#22C55E' },
  chipText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  selfLikeChipText: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  selfChipTextSel: { color: '#FFFFFF' },
  selfLikeChipTextSel: { color: '#FFFFFF' },
  chipTextSel: { color: '#FFFFFF' },
  freeText: { marginTop: 16, backgroundColor: '#2A2927', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#FFFFFF' },
});

const is = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(184,138,0,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 20 },
  badgeText: { fontSize: 13, fontWeight: '600', color: '#B88A00' },
  heading: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 30, marginBottom: 12 },
  body: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 26, marginBottom: 24 },
  input: { backgroundColor: '#2A2927', borderRadius: 12, padding: 14, fontSize: 15, color: '#FFFFFF', minHeight: 100, lineHeight: 22 },
});

const ip = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 30, marginBottom: 12 },
  body: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 24, marginBottom: 20 },
  partList: { gap: 8 },
  partCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1.5, padding: 14 },
  typeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  partName: { flex: 1, fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  partSubText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  orLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginTop: 8 },
  newPartRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  newPartInput: { flex: 1, backgroundColor: '#2A2927', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#FFFFFF' },
  savePartBtn: { borderWidth: 1.5, borderColor: '#3B5BA5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  savePartBtnDisabled: { opacity: 0.4 },
  savePartBtnText: { fontSize: 14, fontWeight: '600', color: '#3B5BA5' },
  savedConfirm: { fontSize: 12, color: '#4CAF50', marginTop: 4 },
  notSureBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' },
  notSureBtnSelected: { borderColor: '#B88A00', backgroundColor: 'rgba(184,138,0,0.1)' },
  notSureText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  notSureTextSelected: { color: '#B88A00' },
});

// ── Collapsible tray styles (feel-towards / check-again phases) ───────────────

const tr = StyleSheet.create({
  dismissOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 9 },
  toggle: {
    position: 'absolute', bottom: 88, right: 20,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#2A2927', borderWidth: 1, borderColor: '#3A3937',
    alignItems: 'center', justifyContent: 'center', zIndex: 10, elevation: 8,
  },
  item: {
    position: 'absolute', right: 20,
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8, zIndex: 10,
  },
  btn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#2A2927', borderWidth: 1, borderColor: '#3A3937',
    alignItems: 'center', justifyContent: 'center', elevation: 8,
  },
  labelPill: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  labelText: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
});

// ── Self sit-with styles ──────────────────────────────────────────────────────

const sw = StyleSheet.create({
  content:    { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },
  heading:    { fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 10 },
  body:       { fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 24, marginBottom: 20 },
  timer:      { fontSize: 48, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginVertical: 16 },
  skipTimer:  { alignSelf: 'center', marginBottom: 20 },
  skipTimerText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecorationLine: 'underline' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.6, marginBottom: 8 },
  input:      { backgroundColor: '#2A2927', borderRadius: 12, padding: 14, fontSize: 15, color: '#FFFFFF', minHeight: 100, lineHeight: 22 },
});
