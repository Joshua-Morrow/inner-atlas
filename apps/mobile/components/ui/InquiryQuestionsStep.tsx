/**
 * InquiryQuestionsStep — self-contained renderer for 'inquiry-questions' step type.
 *
 * Phases: fixed (first 3 questions) → picker (choose remaining) → asking (respond)
 * Collapsible tray (Ground + Unblend) visible throughout.
 * Ground button suppressed in parent (technique-session.tsx) when this step is active.
 */

import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { FullUnblendFlow, type UnblendResult } from './FullUnblendFlow';
import {
  INQUIRY_QUESTIONS,
  INQUIRY_FIXED_QUESTION_INDICES,
  type TechniqueStep,
} from '@/lib/techniques-data';
import { getDatabase } from '@/lib/database';

type PartType = 'manager' | 'firefighter' | 'exile' | 'self' | 'unknown';
interface PartRow { id: string; display_name: string; type: PartType; }

interface Props {
  step: TechniqueStep;
  targetPartName: string;
  selectedPartId: string | null;
  onAdvance: (data: string) => void;
  onGround?: () => void;
  parts?: PartRow[];
  onPartSaved?: (part: PartRow) => void;
}

type Phase = 'fixed' | 'picker' | 'asking';

interface QuestionResponse { question: string; response: string; }

const FIXED_QUESTIONS = INQUIRY_FIXED_QUESTION_INDICES
  .map((i) => INQUIRY_QUESTIONS[i])
  .filter((q): q is string => q != null);

// Track original INQUIRY_QUESTIONS index for each picker question (for part_profiles column mapping)
const PICKER_QUESTION_ENTRIES = INQUIRY_QUESTIONS
  .map((q, i) => ({ question: q, index: i }))
  .filter(({ index }) => !INQUIRY_FIXED_QUESTION_INDICES.includes(index));

// Maps INQUIRY_QUESTIONS index → part_profiles column
// Column names come from a hardcoded map (not user input) — safe for dynamic SQL reference.
const COLUMN_MAP: Record<number, string> = {
  0:  'part_perspective',
  1:  'body_location',
  2:  'job',
  3:  'fears',
  4:  'developmental_history',
  5:  'gift_description',
  6:  'desires',
  7:  'appearance',
  8:  'voice_phrases',   // appends to existing
  9:  'voice_phrases',   // appends to existing
  10: 'behavioral_patterns',
  11: 'key_trigger',
};

export function InquiryQuestionsStep({ step: _step, targetPartName, selectedPartId, onAdvance, onGround, parts = [], onPartSaved }: Props) {
  const [phase, setPhase] = useState<Phase>('fixed');
  const [fixedIndex, setFixedIndex] = useState(0);
  const [currentResponse, setCurrentResponse] = useState('');
  const [pickerEntry, setPickerEntry] = useState<{ question: string; index: number } | null>(null);
  const [responses, setResponses] = useState<QuestionResponse[]>([]);

  // Tray + FullUnblendFlow state
  const [trayOpen, setTrayOpen] = useState(false);
  const [showFullUnblend, setShowFullUnblend] = useState(false);
  const [unblendLog, setUnblendLog] = useState<UnblendResult[]>([]);

  // Save a single inquiry response to the corresponding part_profiles field.
  // Only writes if the field is empty (except voice_phrases which appends).
  // Called on "Next question" (fixed phase) and "Save answer" (asking phase).
  async function saveResponseToPartProfile(questionIndex: number, responseText: string) {
    if (!selectedPartId || !responseText.trim()) return;
    try {
      const db = getDatabase();
      const now = new Date().toISOString();

      // Ensure part_profiles row exists before UPDATE
      await db.runAsync(
        `INSERT OR IGNORE INTO part_profiles (part_id, updated_at) VALUES (?, ?)`,
        [selectedPartId, now],
      );

      const column = COLUMN_MAP[questionIndex];
      if (!column) return;

      if (column === 'voice_phrases') {
        // voice_phrases: append to existing value
        const existing = await db.getFirstAsync<{ voice_phrases: string | null }>(
          'SELECT voice_phrases FROM part_profiles WHERE part_id = ?',
          [selectedPartId],
        );
        const existingText = existing?.voice_phrases ?? '';
        const newText = existingText
          ? `${existingText}\n${responseText.trim()}`
          : responseText.trim();
        await db.runAsync(
          `UPDATE part_profiles SET voice_phrases = ?, updated_at = ? WHERE part_id = ?`,
          [newText, now, selectedPartId],
        );
      } else {
        // Other fields: only write if currently empty (don't overwrite Elaboration data)
        const existing = await db.getFirstAsync<Record<string, string | null>>(
          `SELECT ${column} FROM part_profiles WHERE part_id = ?`,
          [selectedPartId],
        );
        if (!existing?.[column]) {
          await db.runAsync(
            `UPDATE part_profiles SET ${column} = ?, updated_at = ? WHERE part_id = ?`,
            [responseText.trim(), now, selectedPartId],
          );
        }
      }
    } catch (e) {
      console.error('[InquiryQuestionsStep] saveResponseToPartProfile:', e);
    }
  }

  function saveCurrentResponse(question: string) {
    if (currentResponse.trim()) {
      setResponses((prev) => [...prev, { question, response: currentResponse.trim() }]);
    }
    setCurrentResponse('');
  }

  function handleDone() {
    onAdvance(JSON.stringify({
      responses,
      questions_asked: responses.length,
      unblend_log: unblendLog.length > 0 ? unblendLog : undefined,
    }));
  }

  function handleUnblendComplete(result: UnblendResult) {
    setUnblendLog((prev) => [...prev, result]);
    setShowFullUnblend(false);
  }

  // Shared tray JSX (rendered at the bottom of every phase view)
  function renderTray() {
    return (
      <>
        {/* Dismiss overlay */}
        {trayOpen && (
          <TouchableOpacity
            style={tr.dismissOverlay}
            onPress={() => setTrayOpen(false)}
            activeOpacity={1}
          />
        )}
        {/* Ground item */}
        {trayOpen && (
          <View style={[tr.item, { bottom: 148 }]}>
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
        {/* Unblend item */}
        {trayOpen && (
          <View style={[tr.item, { bottom: 204 }]}>
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
        {/* Toggle */}
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
          onComplete={handleUnblendComplete}
          onDismiss={() => setShowFullUnblend(false)}
          parts={parts}
          onPartSaved={onPartSaved ?? (() => {})}
          context="inquiry"
        />
      </>
    );
  }

  // ── Picker phase ──────────────────────────────────────────────────────────
  if (phase === 'picker') {
    const answeredQuestions = new Set(responses.map((r) => r.question));
    const unansweredEntries = PICKER_QUESTION_ENTRIES.filter(
      ({ question }) => !answeredQuestions.has(question),
    );
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={pk.content}
          showsVerticalScrollIndicator={false}
        >
          {/* TEXT: inquiry picker heading */}
          <Text style={pk.heading}>What else would you like to ask?</Text>
          {/* TEXT: inquiry picker body */}
          <Text style={pk.body}>
            Choose a question that stands out to you, or finish here.
          </Text>
          {unansweredEntries.length === 0 ? (
            <View style={pk.completeState}>
              <Ionicons name="checkmark-circle-outline" size={32} color="#B88A00" />
              <Text style={pk.completeText}>You've explored all the questions.</Text>
            </View>
          ) : (
            unansweredEntries.map(({ question, index }) => (
              <TouchableOpacity
                key={index}
                style={pk.row}
                onPress={() => { setPickerEntry({ question, index }); setPhase('asking'); }}
                activeOpacity={0.75}
              >
                <Text style={pk.rowText}>{question}</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
        <View style={foot.wrap}>
          <TouchableOpacity style={foot.doneBtn} onPress={handleDone} activeOpacity={0.85}>
            <Text style={foot.doneBtnText}>I'm done asking</Text>
          </TouchableOpacity>
        </View>
        {renderTray()}
      </View>
    );
  }

  // ── Asking phase (after picker selection) ─────────────────────────────────
  if (phase === 'asking' && pickerEntry) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={qs.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* TEXT: inquiry question framing */}
          <Text style={qs.questionFrame}>
            From that separate-but-connected place, ask {targetPartName}:
          </Text>
          <Text style={qs.questionText}>{pickerEntry.question}</Text>
          {/* TEXT: inquiry asking instruction */}
          <Text style={qs.hint}>
            Ask this gently. Then wait. Write what arises — an image, a word, a feeling, a sense of knowing. Don't think up the answer.
          </Text>
          <TextInput
            style={qs.input}
            value={currentResponse}
            onChangeText={setCurrentResponse}
            placeholder="What arose..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            textAlignVertical="top"
            autoFocus
          />
          <View style={{ height: 120 }} />
        </ScrollView>
        <View style={foot.wrap}>
          <TouchableOpacity
            style={foot.nextBtn}
            onPress={async () => {
              await saveResponseToPartProfile(pickerEntry.index, currentResponse);
              saveCurrentResponse(pickerEntry.question);
              setPhase('picker');
            }}
            activeOpacity={0.85}
          >
            <Text style={foot.nextBtnText}>Save answer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={foot.secondaryBtn}
            onPress={() => {
              saveCurrentResponse(pickerEntry.question);
              setPhase('picker');
            }}
            activeOpacity={0.85}
          >
            <Text style={foot.secondaryBtnText}>Back to questions</Text>
          </TouchableOpacity>
        </View>
        {renderTray()}
      </View>
    );
  }

  // ── Fixed questions phase ─────────────────────────────────────────────────
  const currentQuestion = FIXED_QUESTIONS[fixedIndex];
  const isLastFixed = fixedIndex === FIXED_QUESTIONS.length - 1;
  const currentQuestionOriginalIndex = INQUIRY_FIXED_QUESTION_INDICES[fixedIndex] ?? 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={qs.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={qs.counter}>
          Question {fixedIndex + 1} of {FIXED_QUESTIONS.length}
        </Text>
        {/* TEXT: inquiry question framing */}
        <Text style={qs.questionFrame}>
          From that separate-but-connected place, ask {targetPartName}:
        </Text>
        <Text style={qs.questionText}>{currentQuestion}</Text>
        {/* TEXT: inquiry fixed-question instruction */}
        <Text style={qs.hint}>
          Ask this gently. Then wait. Write what arises — an image, a word, a feeling, a sense of knowing. Don't think up the answer.
        </Text>
        <TextInput
          style={qs.input}
          value={currentResponse}
          onChangeText={setCurrentResponse}
          placeholder="What arose..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
          textAlignVertical="top"
        />
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={foot.wrap}>
        <TouchableOpacity
          style={foot.nextBtn}
          onPress={async () => {
            await saveResponseToPartProfile(currentQuestionOriginalIndex, currentResponse);
            saveCurrentResponse(currentQuestion);
            if (isLastFixed) {
              setPhase('picker');
            } else {
              setFixedIndex((i) => i + 1);
            }
          }}
          activeOpacity={0.85}
        >
          <Text style={foot.nextBtnText}>Next question</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {renderTray()}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const qs = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },
  counter: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 12, letterSpacing: 0.5 },
  // TEXT: inquiry question framing
  questionFrame: { fontSize: 13, color: '#B88A00', lineHeight: 20, marginBottom: 8, fontWeight: '500' },
  questionText: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 32, marginBottom: 16 },
  hint: { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 22, marginBottom: 20, fontStyle: 'italic' },
  input: { backgroundColor: '#2A2927', borderRadius: 12, padding: 14, fontSize: 15, color: '#FFFFFF', minHeight: 120, lineHeight: 22 },
});

const pk = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 30, marginBottom: 12 },
  body: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 24, marginBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  rowText: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 20 },
  completeState: { alignItems: 'center', gap: 12, paddingTop: 24 },
  completeText: { fontSize: 15, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', textAlign: 'center' },
});

const foot = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1917',
    gap: 10,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B5BA5',
    borderRadius: 14,
    paddingVertical: 16,
  },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  doneBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.65)' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
});

// ── Collapsible tray styles ───────────────────────────────────────────────────

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
