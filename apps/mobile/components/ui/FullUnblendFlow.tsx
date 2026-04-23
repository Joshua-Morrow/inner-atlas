/**
 * FullUnblendFlow — multi-phase in-technique unblend overlay.
 *
 * Renders as a full-screen absolute overlay (zIndex 100), never navigates away.
 *
 * Phases:
 *   log           → What's arising right now? (category + optional description)
 *   freewrite     → What else is coming up? (optional free text)
 *   part-selector → Does this feel like a part? (existing / unknown / inline-save)
 *   self-qualities → Qualities of Self reminder + optional note
 */

import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getDatabase } from '@/lib/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type PartType = 'manager' | 'firefighter' | 'exile' | 'self' | 'unknown';

interface PartRow {
  id: string;
  display_name: string;
  type: PartType;
}

export interface UnblendEntry {
  id: string;
  category: string;
  description?: string;
}

export interface UnblendResult {
  experiences: UnblendEntry[];
  freewriteNote?: string;
  linkedPartId?: string;
  linkedPartName?: string;
  selfQualitiesNote?: string;
  wasUnblended: boolean;
}

export interface FullUnblendFlowProps {
  visible: boolean;
  onComplete: (result: UnblendResult) => void;
  onDismiss: () => void;
  parts: PartRow[];
  onPartSaved: (part: PartRow) => void;
  context: 'inquiry' | 'feel-towards' | 'meeting-room';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Feeling',
  'Thought',
  'Body sensation',
  'Impulse',
  'Memory',
  'Visual / image',
  'External stimulus',
];

const SELF_CS = ['Calm', 'Curious', 'Clear', 'Compassionate', 'Confident', 'Creative', 'Courageous', 'Connected'];
const SELF_PS = ['Present', 'Patient', 'Playful', 'Persistent', 'Perspective'];

const CONTEXT_LABEL: Record<string, string> = {
  'inquiry':       'Inquiry',
  'feel-towards':  'Feel Towards',
  'meeting-room':  'Meeting Room',
};

type FlowPhase = 'log' | 'freewrite' | 'part-selector' | 'self-qualities';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FullUnblendFlow({ visible, onComplete, onDismiss, parts, onPartSaved, context }: FullUnblendFlowProps) {
  const [phase, setPhase]           = useState<FlowPhase>('log');
  const [entries, setEntries]       = useState<UnblendEntry[]>([]);
  const [freewriteNote, setFreewriteNote] = useState('');
  const [selfNote, setSelfNote]     = useState('');

  // Category picker modal (Phase 1)
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [selectedCat, setSelectedCat]         = useState<string | null>(null);
  const [entryDesc, setEntryDesc]             = useState('');

  // Part selector (Phase 3)
  const [localParts, setLocalParts]           = useState<PartRow[]>(parts);
  const [selectedLinkId, setSelectedLinkId]   = useState<string | null>(null);
  const [newPartName, setNewPartName]         = useState('');
  const [isSavingPart, setIsSavingPart]       = useState(false);
  const [savedConfirm, setSavedConfirm]       = useState<string | null>(null);

  const contextLabel = CONTEXT_LABEL[context] ?? 'practice';

  function reset() {
    setPhase('log');
    setEntries([]);
    setFreewriteNote('');
    setSelfNote('');
    setCatModalVisible(false);
    setSelectedCat(null);
    setEntryDesc('');
    setLocalParts(parts);
    setSelectedLinkId(null);
    setNewPartName('');
    setSavedConfirm(null);
  }

  function handleDismiss() {
    reset();
    onDismiss();
  }

  function handleAddEntry() {
    if (!selectedCat) return;
    const entry: UnblendEntry = {
      id:          generateId(),
      category:    selectedCat,
      description: entryDesc.trim() || undefined,
    };
    setEntries((prev) => [...prev, entry]);
    setSelectedCat(null);
    setEntryDesc('');
    setCatModalVisible(false);
  }

  async function handleSaveNewPart() {
    const trimmed = newPartName.trim();
    if (!trimmed || isSavingPart) return;
    setIsSavingPart(true);
    try {
      const db  = getDatabase();
      const now = new Date().toISOString();
      const id  = generateId();
      await db.runAsync(
        `INSERT INTO parts (id, name, type, status, created_at, updated_at)
         VALUES (?, ?, 'unknown', 'named', ?, ?)`,
        [id, trimmed, now, now],
      );
      await db.runAsync(
        `INSERT OR IGNORE INTO part_profiles (part_id, updated_at) VALUES (?, ?)`,
        [id, now],
      );
      const newPart: PartRow = { id, display_name: trimmed, type: 'unknown' };
      setLocalParts((prev) => [...prev, newPart]);
      setSelectedLinkId(id);
      setNewPartName('');
      setSavedConfirm(trimmed);
      onPartSaved(newPart);
      setTimeout(() => setSavedConfirm(null), 2000);
    } catch (e) {
      console.error('[FullUnblendFlow] saveNewPart:', e);
    } finally {
      setIsSavingPart(false);
    }
  }

  function handleComplete() {
    const linked = selectedLinkId && selectedLinkId !== 'unknown'
      ? localParts.find((p) => p.id === selectedLinkId)
      : undefined;
    const result: UnblendResult = {
      experiences:      entries,
      freewriteNote:    freewriteNote.trim() || undefined,
      linkedPartId:     selectedLinkId === 'unknown' ? 'unknown' : linked?.id,
      linkedPartName:   selectedLinkId === 'unknown' ? 'Unknown part' : linked?.display_name,
      selfQualitiesNote: selfNote.trim() || undefined,
      wasUnblended:     true,
    };
    reset();
    onComplete(result);
  }

  if (!visible) return null;

  // ── Phase 1 — Log ──────────────────────────────────────────────────────────
  if (phase === 'log') {
    return (
      <View style={fl.overlay}>
        {/* Header */}
        <View style={fl.header}>
          <TouchableOpacity onPress={handleDismiss} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <Text style={fl.headerTitle}>Unblend</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={fl.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* TEXT: full-unblend-log heading */}
          <Text style={fl.heading}>What's arising right now?</Text>
          {/* TEXT: full-unblend-log body */}
          <Text style={fl.body}>
            Notice what's present — a feeling, a thought, a body sensation. Log it here before we explore it together.
          </Text>

          {/* Entry list */}
          {entries.map((e) => (
            <View key={e.id} style={fl.entryChip}>
              <View style={fl.entryDot} />
              <Text style={fl.entryText}>
                {e.category}{e.description ? `: ${e.description}` : ''}
              </Text>
              <TouchableOpacity
                onPress={() => setEntries((prev) => prev.filter((x) => x.id !== e.id))}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={14} color="rgba(255,255,255,0.35)" />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add entry */}
          <TouchableOpacity
            style={fl.addBtn}
            onPress={() => { setSelectedCat(null); setEntryDesc(''); setCatModalVisible(true); }}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color="#9B9A94" />
            <Text style={fl.addBtnText}>{entries.length === 0 ? 'Add what arose' : '+ Add another'}</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={fl.footer}>
          <TouchableOpacity
            style={fl.continueBtn}
            onPress={() => setPhase('freewrite')}
            activeOpacity={0.85}
          >
            <Text style={fl.continueBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Category picker modal */}
        <Modal visible={catModalVisible} animationType="slide" transparent onRequestClose={() => setCatModalVisible(false)}>
          <View style={cm.overlay}>
            <View style={cm.sheet}>
              <View style={cm.handle} />
              <Text style={cm.label}>What arose?</Text>
              <View style={cm.chips}>
                {CATEGORIES.map((cat) => {
                  const sel = selectedCat === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[cm.chip, sel && cm.chipSel]}
                      onPress={() => setSelectedCat(cat)}
                      activeOpacity={0.75}
                    >
                      <Text style={[cm.chipText, sel && cm.chipTextSel]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {selectedCat && (
                <>
                  <Text style={cm.label}>Briefly describe it (optional)</Text>
                  <TextInput
                    style={cm.input}
                    value={entryDesc}
                    onChangeText={setEntryDesc}
                    placeholder="e.g. 'tightness in chest', 'urge to leave'"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoFocus
                  />
                </>
              )}
              <View style={cm.actions}>
                <TouchableOpacity
                  style={cm.cancelBtn}
                  onPress={() => setCatModalVisible(false)}
                  activeOpacity={0.75}
                >
                  <Text style={cm.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[cm.addEntryBtn, !selectedCat && cm.addEntryBtnDisabled]}
                  onPress={handleAddEntry}
                  disabled={!selectedCat}
                  activeOpacity={0.85}
                >
                  <Text style={cm.addEntryBtnText}>Add to log</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── Phase 2 — Freewrite ────────────────────────────────────────────────────
  if (phase === 'freewrite') {
    return (
      <View style={fl.overlay}>
        <View style={fl.header}>
          <TouchableOpacity onPress={() => setPhase('log')} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <Text style={fl.headerTitle}>Unblend</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={fl.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* TEXT: full-unblend-freewrite heading */}
          <Text style={fl.heading}>What else is coming up?</Text>
          {/* TEXT: full-unblend-freewrite placeholder */}
          <TextInput
            style={fl.bigInput}
            value={freewriteNote}
            onChangeText={setFreewriteNote}
            placeholder="Anything else present — images, sensations, thoughts, urges..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            textAlignVertical="top"
            autoFocus
          />
          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={fl.footer}>
          <TouchableOpacity
            style={fl.continueBtn}
            onPress={() => setPhase('part-selector')}
            activeOpacity={0.85}
          >
            <Text style={fl.continueBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Phase 3 — Part selector ────────────────────────────────────────────────
  if (phase === 'part-selector') {
    return (
      <View style={fl.overlay}>
        <View style={fl.header}>
          <TouchableOpacity onPress={() => setPhase('freewrite')} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <Text style={fl.headerTitle}>Unblend</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={fl.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* TEXT: full-unblend-part-selector heading */}
          <Text style={fl.heading}>Does this feel like a part?</Text>
          {/* TEXT: full-unblend-part-selector body */}
          <Text style={fl.body}>
            If what you noticed felt like a distinct part — something with its own voice, feeling, or role — you can link it here.
          </Text>

          {/* Existing parts */}
          {localParts.length > 0 && (
            <>
              <Text style={ps.sectionLabel}>YOUR PARTS</Text>
              {localParts.map((p) => {
                const sel = selectedLinkId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[ps.row, sel && ps.rowSel]}
                    onPress={() => setSelectedLinkId(sel ? null : p.id)}
                    activeOpacity={0.75}
                  >
                    {sel
                      ? <Ionicons name="checkmark-circle" size={20} color="#3B5BA5" />
                      : <View style={ps.radio} />}
                    <Text style={[ps.rowText, sel && ps.rowTextSel]}>{p.display_name}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Unknown part */}
          <TouchableOpacity
            style={[ps.row, selectedLinkId === 'unknown' && ps.rowSel]}
            onPress={() => setSelectedLinkId(selectedLinkId === 'unknown' ? null : 'unknown')}
            activeOpacity={0.75}
          >
            {selectedLinkId === 'unknown'
              ? <Ionicons name="checkmark-circle" size={20} color="#3B5BA5" />
              : <View style={ps.radio} />}
            <View style={{ flex: 1 }}>
              <Text style={[ps.rowText, selectedLinkId === 'unknown' && ps.rowTextSel]}>Unknown part</Text>
              <Text style={ps.rowSub}>Something is present — not sure which part yet</Text>
            </View>
          </TouchableOpacity>

          {/* Inline new part */}
          <Text style={ps.sectionLabel}>NAME A NEW PART</Text>
          <View style={ps.newPartRow}>
            <TextInput
              style={ps.newPartInput}
              value={newPartName}
              onChangeText={(v) => { setNewPartName(v); setSelectedLinkId(null); }}
              placeholder="e.g. The Protector, The Critic..."
              placeholderTextColor="rgba(255,255,255,0.25)"
            />
            <TouchableOpacity
              style={[ps.saveBtn, (!newPartName.trim() || isSavingPart) && ps.saveBtnDisabled]}
              onPress={handleSaveNewPart}
              disabled={!newPartName.trim() || isSavingPart}
              activeOpacity={0.85}
            >
              <Text style={ps.saveBtnText}>{isSavingPart ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          {savedConfirm ? <Text style={ps.confirm}>✓ {savedConfirm} saved and selected</Text> : null}

          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={fl.footer}>
          <TouchableOpacity style={fl.skipLink} onPress={() => { setSelectedLinkId(null); setPhase('self-qualities'); }} activeOpacity={0.75}>
            <Text style={fl.skipLinkText}>Skip — not sure yet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={fl.continueBtn}
            onPress={() => setPhase('self-qualities')}
            activeOpacity={0.85}
          >
            <Text style={fl.continueBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Phase 4 — Self qualities ───────────────────────────────────────────────
  return (
    <View style={fl.overlay}>
      <View style={fl.header}>
        <TouchableOpacity onPress={() => setPhase('part-selector')} hitSlop={12} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
        <Text style={fl.headerTitle}>Unblend</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={fl.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={sq.badge}>
          <Ionicons name="sunny-outline" size={16} color="#B88A00" />
          {/* TEXT: full-unblend-self-qualities badge */}
          <Text style={sq.badgeText}>Qualities of Self</Text>
        </View>

        {/* TEXT: full-unblend-self-qualities heading */}
        <Text style={fl.heading}>Qualities of Self</Text>

        {/* TEXT: full-unblend-self-qualities body */}
        <Text style={fl.body}>
          As you step back from this part, here are the qualities that can arise when Self is present:
        </Text>

        {/* The 8 Cs — display only */}
        <Text style={sq.rowLabel}>THE 8 Cs</Text>
        <View style={sq.pills}>
          {SELF_CS.map((q) => (
            <View key={q} style={sq.pill}>
              <Text style={sq.pillText}>{q}</Text>
            </View>
          ))}
        </View>

        {/* The 5 Ps — display only */}
        <Text style={[sq.rowLabel, { marginTop: 16 }]}>THE 5 Ps</Text>
        <View style={sq.pills}>
          {SELF_PS.map((q) => (
            <View key={q} style={sq.pill}>
              <Text style={sq.pillText}>{q}</Text>
            </View>
          ))}
        </View>

        {/* TEXT: full-unblend-self-qualities prompt */}
        <Text style={sq.prompt}>
          Do you notice any of these present, even a little?
        </Text>
        {/* TEXT: full-unblend-self-qualities placeholder */}
        <TextInput
          style={fl.bigInput}
          value={selfNote}
          onChangeText={setSelfNote}
          placeholder="Even a slight shift counts..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
          textAlignVertical="top"
        />
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={fl.footer}>
        <TouchableOpacity style={fl.returnBtn} onPress={handleComplete} activeOpacity={0.85}>
          <Text style={fl.returnBtnText}>Return to {contextLabel} →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const fl = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#1A1917',
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 30, marginBottom: 12 },
  body: { fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 24, marginBottom: 20 },
  bigInput: {
    backgroundColor: '#2A2927',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#FFFFFF',
    minHeight: 120,
    lineHeight: 22,
    marginTop: 4,
  },
  // Entry chips
  entryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  entryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#B88A00',
    flexShrink: 0,
  },
  entryText: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  addBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1917',
    gap: 10,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 16,
  },
  continueBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  skipLink: { alignItems: 'center', paddingVertical: 4 },
  skipLinkText: { fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  returnBtn: {
    backgroundColor: '#B88A00',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  returnBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

// Category modal
const cm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#242220',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginBottom: 8,
  },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: -4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipSel: { backgroundColor: '#B88A00', borderColor: '#B88A00' },
  chipText: { fontSize: 14, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  chipTextSel: { color: '#FFFFFF' },
  input: {
    backgroundColor: '#2A2927', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#FFFFFF',
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  addEntryBtn: { flex: 2, backgroundColor: '#3B5BA5', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  addEntryBtnDisabled: { opacity: 0.4 },
  addEntryBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

// Part selector
const ps = StyleSheet.create({
  sectionLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 10, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  rowSel: { borderColor: '#3B5BA5', backgroundColor: 'rgba(59,91,165,0.08)' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', flexShrink: 0 },
  rowText: { flex: 1, fontSize: 15, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  rowTextSel: { color: '#FFFFFF' },
  rowSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  newPartRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  newPartInput: {
    flex: 1,
    backgroundColor: '#2A2927',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
  },
  saveBtn: { backgroundColor: '#3B5BA5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  confirm: { fontSize: 12, color: '#B88A00', marginTop: 6 },
});

// Self qualities
const sq = StyleSheet.create({
  badge: {
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
  badgeText: { fontSize: 12, fontWeight: '600', color: '#B88A00' },
  rowLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1,
    borderColor: 'rgba(184,138,0,0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(184,138,0,0.06)',
  },
  pillText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  prompt: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 24, marginTop: 20, marginBottom: 12 },
});
