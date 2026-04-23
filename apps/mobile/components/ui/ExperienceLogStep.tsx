/**
 * ExperienceLogStep — step renderer for 'experience-log' type.
 * Used in Parts Mindfulness (standard) and Unblending (unblending_mode).
 *
 * In unblending_mode each new entry cycles through three phases:
 *   'log'           → normal scrollable log
 *   'unblend-support' → UnblendSupportCard (full-screen)
 *   'part-linking'  → ask whether this was a part; link or skip
 *
 * Timer keeps running during all phase transitions because React preserves
 * hook state in components that stay mounted (early-return pattern).
 */

import React, { useEffect, useState } from 'react';
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
import { UnblendSupportCard } from './UnblendSupportCard';
import { ExperienceLogEntry, type ExperienceEntry } from './ExperienceLogEntry';
import type { TechniqueStep } from '@/lib/techniques-data';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimplePartRow {
  id: string;
  display_name: string;
}

type Phase = 'log' | 'unblend-support' | 'sit-with-part' | 'part-linking';

const SIT_WITH_PROMPTS: Array<{ label: string; placeholder: string }> = [
  { label: 'What do you notice about how this feels in your body?', placeholder: 'shape, weight, temperature, movement...' },
  { label: 'Does it have a color, texture, or visual quality?', placeholder: 'dark, bright, cloudy, jagged, soft...' },
  { label: 'What emotion or tone does it carry?', placeholder: 'anxious, heavy, urgent, quiet...' },
  { label: 'Does it have a sound, voice quality, or age?', placeholder: 'young, harsh, whispering, silent...' },
  { label: 'Is there a memory or image that surfaces?', placeholder: 'just note it lightly — no need to go in' },
];

const CATEGORIES = [
  'Thought',
  'Feeling',
  'Body sensation',
  'Impulse',
  'Memory',
  'Visual / image',
  'External stimulus',
];

interface ExperienceLogStepProps {
  step: TechniqueStep;
  onAdvance: (data: string) => void;
  /** Parts list for linking after unblend — threaded from technique-session */
  parts?: SimplePartRow[];
  /** Called whenever the internal phase changes */
  onPhaseChange?: (phase: 'log' | 'unblend-support' | 'sit-with-part' | 'part-linking') => void;
  /** Triggers the parent GroundingOverlay — passed from technique-session */
  onGround?: () => void;
  /** Ref that parent populates with a callback to reset phase to 'log' (back-button intercept) */
  returnToLogRef?: React.MutableRefObject<(() => void) | null>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExperienceLogStep({ step, onAdvance, parts = [], onPhaseChange, onGround, returnToLogRef }: ExperienceLogStepProps) {
  const unblendingMode = step.unblending_mode === true;

  // Entry list
  const [entries, setEntries] = useState<ExperienceEntry[]>([]);

  // Add-entry modal
  const [modalVisible, setModalVisible]     = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [description, setDescription]       = useState('');

  // Phase machine (unblending mode only)
  const [phase, setPhase]           = useState<Phase>('log');
  const [pendingEntry, setPendingEntry] = useState<ExperienceEntry | null>(null);
  // True when floating unblend button triggered the support card (no pending entry)
  const [quickUnblend, setQuickUnblend] = useState(false);

  // Tray state (log phase only)
  const [trayOpen, setTrayOpen] = useState(false);

  // Sit-with-part phase state
  const [sitWithInputs, setSitWithInputs] = useState<Record<number, string>>({});

  // Part-linking state
  const [selectedLinkPartId, setSelectedLinkPartId] = useState<string | null>(null);
  const [newPartName, setNewPartName]               = useState('');
  const [isSavingPart, setIsSavingPart]             = useState(false);

  // ── Phase helper ─────────────────────────────────────────────────────────────

  function setPhaseAndNotify(newPhase: Phase) {
    setPhase(newPhase);
    onPhaseChange?.(newPhase);
  }

  // Register return-to-log callback on the parent's ref so that the header
  // back button can reset this component to 'log' phase without navigating away.
  useEffect(() => {
    if (!returnToLogRef) return;
    returnToLogRef.current = () => setPhaseAndNotify('log');
    return () => { returnToLogRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnToLogRef]);

  // ── Modal open ──────────────────────────────────────────────────────────────

  function openModal() {
    setSelectedCategory(null);
    setDescription('');
    setModalVisible(true);
  }

  // ── Add entry ───────────────────────────────────────────────────────────────

  function handleAddEntry() {
    if (!selectedCategory) return;
    const entry: ExperienceEntry = {
      id: generateId(),
      category: selectedCategory,
      description: description.trim() || undefined,
      timestamp: formatTime(new Date()),
      unblended: false,
    };
    setModalVisible(false);

    if (unblendingMode) {
      setPendingEntry(entry);
      setQuickUnblend(false);
      setPhaseAndNotify('unblend-support');
    } else {
      setEntries((prev) => [...prev, entry]);
    }
  }

  // ── Floating unblend button (unblending mode, no new entry) ─────────────────

  function handleQuickUnblend() {
    setQuickUnblend(true);
    setPendingEntry(null);
    setPhaseAndNotify('unblend-support');
  }

  // ── UnblendSupportCard dismissed ────────────────────────────────────────────

  function handleHaveSpace(noticeText?: string) {
    if (quickUnblend) {
      // No pending entry — just return to log
      setQuickUnblend(false);
      setPhaseAndNotify('log');
      return;
    }

    // Attach noticeText to pending entry; move to sit-with-part (then part-linking)
    if (pendingEntry) {
      setPendingEntry({ ...pendingEntry, noticeText: noticeText || undefined });
    }
    setSitWithInputs({});
    setPhaseAndNotify('sit-with-part');
  }

  // ── UnblendSupportCard: part wouldn't separate ──────────────────────────────
  // "Continue the practice →" on the "This part has good reasons" screen fires
  // onStayedBlended. Rather than short-circuiting to log, we route to the same
  // sit-with-part phase as the normal "I have a little more space now" path.
  // The difference: stayedBlended: true + wont-separate notes are attached to
  // pendingEntry so the eventually-logged entry carries both flags.

  function handleStayedBlended(notes?: string) {
    if (quickUnblend) {
      // No pending entry (triggered via floating unblend button) — return to log
      setQuickUnblend(false);
      setPhaseAndNotify('log');
      return;
    }

    // Attach stayedBlended flag and any notes to the pending entry,
    // then continue to sit-with-part (same destination as onHaveSpace path)
    if (pendingEntry) {
      setPendingEntry({
        ...pendingEntry,
        stayedBlended: true,
        additionalNotes: notes ? [notes] : undefined,
      });
    }
    setSitWithInputs({});
    setPhaseAndNotify('sit-with-part');
  }

  // ── Sit-with-part: save prompt notes to part_profiles ───────────────────────

  async function saveSitWithToProfile(partId: string, notes: Record<number, string>) {
    try {
      const db  = getDatabase();
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT OR IGNORE INTO part_profiles (part_id, updated_at) VALUES (?, ?)`,
        [partId, now],
      );
      if (notes[0]) {
        await db.runAsync(
          `UPDATE part_profiles SET body_location = ?, updated_at = ?
           WHERE part_id = ? AND (body_location IS NULL OR body_location = '')`,
          [notes[0], now, partId],
        );
      }
      if (notes[1]) {
        await db.runAsync(
          `UPDATE part_profiles SET appearance = ?, updated_at = ?
           WHERE part_id = ? AND (appearance IS NULL OR appearance = '')`,
          [notes[1], now, partId],
        );
      }
      if (notes[2]) {
        await db.runAsync(
          `UPDATE part_profiles SET feel_towards = ?, updated_at = ?
           WHERE part_id = ? AND (feel_towards IS NULL OR feel_towards = '')`,
          [notes[2], now, partId],
        );
      }
      if (notes[3]) {
        await db.runAsync(
          `UPDATE part_profiles SET voice_phrases = ?, updated_at = ?
           WHERE part_id = ? AND (voice_phrases IS NULL OR voice_phrases = '')`,
          [notes[3], now, partId],
        );
      }
      if (notes[4]) {
        const memId  = generateId();
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        await db.runAsync(
          `INSERT INTO part_memories (id, part_id, title, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [memId, partId, `Noticed in Unblending — ${dateStr}`, notes[4], now, now],
        );
      }
    } catch (e) {
      console.error('[ExperienceLogStep] saveSitWithToProfile:', e);
    }
  }

  // ── Sit-with-part: advance to part-linking ───────────────────────────────────

  function handleSitWithContinue() {
    const nonEmpty: Record<number, string> = {};
    Object.entries(sitWithInputs).forEach(([k, v]) => {
      if (v.trim()) nonEmpty[Number(k)] = v.trim();
    });
    if (pendingEntry) {
      setPendingEntry({ ...pendingEntry, sitWithNotes: nonEmpty });
    }
    setSitWithInputs({});
    setSelectedLinkPartId(null);
    setNewPartName('');
    setPhaseAndNotify('part-linking');
  }

  // ── Part-linking: link existing part ────────────────────────────────────────

  function handleLinkPart() {
    if (!pendingEntry) { setPhaseAndNotify('log'); return; }

    const isUnknown = selectedLinkPartId === 'unknown';
    const linked = isUnknown ? undefined : parts.find((p) => p.id === selectedLinkPartId);
    const finalEntry: ExperienceEntry = {
      ...pendingEntry,
      unblended: true,
      linkedPartId:   isUnknown ? 'unknown' : linked?.id,
      linkedPartName: isUnknown ? 'Unknown part' : linked?.display_name,
    };
    setEntries((prev) => [...prev, finalEntry]);

    // Save sit-with notes to part_profiles for linked part
    const realPartId = !isUnknown ? linked?.id : undefined;
    if (realPartId && pendingEntry.sitWithNotes && Object.keys(pendingEntry.sitWithNotes).length > 0) {
      void saveSitWithToProfile(realPartId, pendingEntry.sitWithNotes as Record<number, string>);
    }

    setPendingEntry(null);
    setSelectedLinkPartId(null);
    setPhaseAndNotify('log');
  }

  // ── Part-linking: save new part inline ──────────────────────────────────────

  async function handleSaveNewPart() {
    const trimmed = newPartName.trim();
    if (!trimmed || !pendingEntry) return;
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

      const finalEntry: ExperienceEntry = {
        ...pendingEntry,
        unblended: true,
        linkedPartId:   id,
        linkedPartName: trimmed,
      };
      setEntries((prev) => [...prev, finalEntry]);

      // Save sit-with notes to newly created part's profile
      if (pendingEntry.sitWithNotes && Object.keys(pendingEntry.sitWithNotes).length > 0) {
        await saveSitWithToProfile(id, pendingEntry.sitWithNotes as Record<number, string>);
      }
    } catch {
      // If save fails, still commit the entry without a link
      if (pendingEntry) {
        setEntries((prev) => [...prev, { ...pendingEntry, unblended: true }]);
      }
    } finally {
      setIsSavingPart(false);
      setPendingEntry(null);
      setNewPartName('');
      setPhaseAndNotify('log');
    }
  }

  // ── Part-linking: skip ───────────────────────────────────────────────────────

  function handleSkipLink() {
    if (pendingEntry) {
      setEntries((prev) => [...prev, { ...pendingEntry, unblended: true }]);
      setPendingEntry(null);
    }
    setPhaseAndNotify('log');
  }

  // ── Entry mutations ──────────────────────────────────────────────────────────

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

  // ── Done ─────────────────────────────────────────────────────────────────────

  function handleDone() {
    onAdvance(JSON.stringify(entries));
  }

  // ─── Phase: unblend-support ─────────────────────────────────────────────────

  if (phase === 'unblend-support') {
    const partLabel = pendingEntry
      ? pendingEntry.description
        ? `${pendingEntry.category}: ${pendingEntry.description}`
        : pendingEntry.category
      : undefined;

    return (
      <UnblendSupportCard
        partName={partLabel}
        onHaveSpace={handleHaveSpace}
        onStayedBlended={handleStayedBlended}
      />
    );
  }

  // ─── Phase: sit-with-part ───────────────────────────────────────────────────

  if (phase === 'sit-with-part') {
    return (
      <View style={sw.root}>
        <ScrollView
          style={sw.scroll}
          contentContainerStyle={sw.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* TEXT: sit-with-part heading */}
          <Text style={sw.heading}>Stay with it a moment</Text>
          {/* TEXT: sit-with-part body */}
          <Text style={sw.body}>
            Before naming or identifying this part, just let yourself be with what you're noticing. There's no hurry.
          </Text>

          {SIT_WITH_PROMPTS.map((prompt, i) => (
            <View key={i} style={sw.promptCard}>
              <Text style={sw.promptLabel}>{prompt.label}</Text>
              <TextInput
                style={sw.promptInput}
                value={sitWithInputs[i] ?? ''}
                onChangeText={(v) => setSitWithInputs((prev) => ({ ...prev, [i]: v }))}
                placeholder={prompt.placeholder}
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                textAlignVertical="top"
              />
            </View>
          ))}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* TEXT: sit-with-part advance button */}
        <TouchableOpacity style={sw.continueBtn} onPress={handleSitWithContinue} activeOpacity={0.85}>
          <Text style={sw.continueBtnText}>Continue — identify this part →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Phase: part-linking ────────────────────────────────────────────────────

  if (phase === 'part-linking') {
    return (
      <View style={pl.root}>
        <ScrollView
          style={pl.scroll}
          contentContainerStyle={pl.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={pl.heading}>Was this a part?</Text>
          <Text style={pl.body}>
            If this felt like a distinct part of you — something with its own voice, feeling, or role — you can link it here.
          </Text>

          {parts.length > 0 && (
            <>
              <Text style={pl.sectionLabel}>YOUR PARTS</Text>
              <View style={pl.partsList}>
                {parts.map((p) => {
                  const selected = selectedLinkPartId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[pl.partRow, selected && pl.partRowSelected]}
                      onPress={() =>
                        setSelectedLinkPartId(selected ? null : p.id)
                      }
                      activeOpacity={0.75}
                    >
                      {selected
                        ? <Ionicons name="checkmark-circle" size={20} color="#3B5BA5" />
                        : <View style={pl.radioCircle} />}
                      <Text style={[pl.partName, selected && pl.partNameSelected]}>
                        {p.display_name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Unknown part option */}
          <TouchableOpacity
            style={[pl.partRow, selectedLinkPartId === 'unknown' && pl.partRowSelected]}
            onPress={() => setSelectedLinkPartId(selectedLinkPartId === 'unknown' ? null : 'unknown')}
            activeOpacity={0.75}
          >
            {selectedLinkPartId === 'unknown'
              ? <Ionicons name="checkmark-circle" size={20} color="#3B5BA5" />
              : <View style={pl.radioCircle} />}
            <View style={{ flex: 1 }}>
              <Text style={[pl.partName, selectedLinkPartId === 'unknown' && pl.partNameSelected]}>
                Unknown part
              </Text>
              <Text style={pl.partSubtext}>Something is present — I'm not sure which part yet</Text>
            </View>
          </TouchableOpacity>

          <Text style={pl.sectionLabel}>NAME A NEW PART</Text>
          <View style={pl.newPartRow}>
            <TextInput
              style={pl.newPartInput}
              value={newPartName}
              onChangeText={(v) => { setNewPartName(v); setSelectedLinkPartId(null); }}
              placeholder="e.g. The Critic, The Protector..."
              placeholderTextColor="rgba(255,255,255,0.25)"
            />
            <TouchableOpacity
              style={[pl.savePartBtn, (!newPartName.trim() || isSavingPart) && pl.savePartBtnDisabled]}
              onPress={handleSaveNewPart}
              disabled={!newPartName.trim() || isSavingPart}
              activeOpacity={0.85}
            >
              <Text style={pl.savePartBtnText}>
                {isSavingPart ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Footer — skip / link */}
        <View style={pl.footer}>
          <TouchableOpacity style={pl.skipBtn} onPress={handleSkipLink} activeOpacity={0.75}>
            <Text style={pl.skipBtnText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[pl.linkBtn, !selectedLinkPartId && pl.linkBtnDisabled]}
            onPress={handleLinkPart}
            disabled={!selectedLinkPartId}
            activeOpacity={0.85}
          >
            <Text style={pl.linkBtnText}>Link part</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Phase: log (default) ───────────────────────────────────────────────────

  return (
    <View style={s.root}>
      {/* Scrollable log area */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.heading}>{step.heading}</Text>
        {step.body ? <Text style={s.body}>{step.body}</Text> : null}

        {entries.length === 0 ? (
          <Text style={s.emptyState}>
            Nothing logged yet — sit quietly and notice what arises
          </Text>
        ) : (
          <View style={s.entriesList}>
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

      {/* Dismiss overlay — closes tray on outside tap */}
      {trayOpen && (
        <TouchableOpacity
          style={s.trayDismissOverlay}
          onPress={() => setTrayOpen(false)}
          activeOpacity={1}
        />
      )}

      {/* Tray item — Notice / Add (closer to toggle) */}
      {trayOpen && (
        <View style={[s.trayItem, { bottom: 148 }]}>
          <TouchableOpacity
            style={s.trayBtn}
            onPress={() => { setTrayOpen(false); openModal(); }}
            activeOpacity={0.85}
          >
            <Ionicons name="add-outline" size={20} color="#9B9A94" />
          </TouchableOpacity>
          <View style={s.trayLabelPill}>
            <Text style={s.trayLabelText}>Notice</Text>
          </View>
        </View>
      )}

      {/* Tray item — Ground (further from toggle) */}
      {trayOpen && (
        <View style={[s.trayItem, { bottom: 204 }]}>
          <TouchableOpacity
            style={s.trayBtn}
            onPress={() => { setTrayOpen(false); onGround?.(); }}
            activeOpacity={0.85}
          >
            <Ionicons name="leaf-outline" size={20} color="#9B9A94" />
          </TouchableOpacity>
          <View style={s.trayLabelPill}>
            <Text style={s.trayLabelText}>Ground</Text>
          </View>
        </View>
      )}

      {/* Tray toggle button — bottom: 88 clears the "Done noticing" footer */}
      <TouchableOpacity
        style={s.trayToggle}
        onPress={() => setTrayOpen((v) => !v)}
        activeOpacity={0.85}
      >
        <Ionicons name={trayOpen ? 'close' : 'ellipsis-horizontal'} size={20} color="#9B9A94" />
      </TouchableOpacity>

      {/* Done noticing button */}
      <View style={s.footer}>
        <TouchableOpacity style={s.doneBtn} onPress={handleDone} activeOpacity={0.85}>
          <Text style={s.doneBtnText}>Done noticing</Text>
        </TouchableOpacity>
      </View>

      {/* Add Experience Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.handle} />

            <Text style={m.label}>What arose?</Text>
            <View style={m.chips}>
              {CATEGORIES.map((cat) => {
                const selected = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[m.chip, selected && m.chipSelected]}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.75}
                  >
                    <Text style={[m.chipText, selected && m.chipTextSelected]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedCategory && (
              <>
                <Text style={m.label}>Briefly describe it</Text>
                <TextInput
                  style={m.input}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g. 'a tightness in my chest', 'the urge to check my phone'"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoFocus
                />
              </>
            )}

            <View style={m.actions}>
              <TouchableOpacity
                style={m.cancelBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.75}
              >
                <Text style={m.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.addBtn, !selectedCategory && m.addBtnDisabled]}
                onPress={handleAddEntry}
                activeOpacity={0.85}
                disabled={!selectedCategory}
              >
                <Text style={m.addBtnText}>Add to log</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles: log phase ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A1917',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 30,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyState: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 22,
  },
  entriesList: {
    gap: 10,
  },
  // Collapsible tray
  trayDismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9,
  },
  trayToggle: {
    position: 'absolute',
    bottom: 88,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A2927',
    borderWidth: 1,
    borderColor: '#3A3937',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 8,
  },
  trayItem: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  trayBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A2927',
    borderWidth: 1,
    borderColor: '#3A3937',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  trayLabelPill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trayLabelText: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
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

// ─── Styles: part-linking phase ───────────────────────────────────────────────

const pl = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A1917',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 23,
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1,
    marginBottom: 10,
  },
  partsList: {
    gap: 8,
    marginBottom: 28,
  },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  partRowSelected: {
    borderColor: '#3B5BA5',
    backgroundColor: 'rgba(59,91,165,0.12)',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    flexShrink: 0,
  },
  partName: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  partNameSelected: {
    color: '#FFFFFF',
  },
  partSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  newPartRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  newPartInput: {
    flex: 1,
    backgroundColor: '#2A2927',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
  },
  savePartBtn: {
    borderWidth: 1.5,
    borderColor: '#3B5BA5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  savePartBtnDisabled: {
    opacity: 0.4,
  },
  savePartBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B5BA5',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1917',
  },
  skipBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  linkBtn: {
    flex: 2,
    backgroundColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  linkBtnDisabled: {
    opacity: 0.4,
  },
  linkBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

// ─── Styles: sit-with-part phase ─────────────────────────────────────────────

const sw = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A1917' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 20 },
  heading: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 10 },
  body: { fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 24, marginBottom: 28 },
  promptCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    gap: 8,
  },
  promptLabel: { fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 20, fontWeight: '500' },
  promptInput: {
    backgroundColor: '#2A2927',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
    minHeight: 60,
    lineHeight: 20,
  },
  continueBtn: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#3B5BA5',
    paddingVertical: 18,
    alignItems: 'center',
    elevation: 8,
    zIndex: 10,
  },
  continueBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

// ─── Styles: add-entry modal ──────────────────────────────────────────────────

const m = StyleSheet.create({
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: '#B88A00',
    borderColor: '#B88A00',
  },
  chipText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#2A2927',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  addBtn: {
    flex: 2,
    backgroundColor: '#3B5BA5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
