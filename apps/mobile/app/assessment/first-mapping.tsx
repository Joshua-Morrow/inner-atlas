/**
 * First Mapping Assessment — Phase 1 + Phase 2 Clusters A, B, C, D
 *
 * Phase 1 "The Moment": 5 questions (free_text, single_choice, yes_no_conditional)
 * Phase 2:
 *   Cluster A "Standards & Effort":   4 sliders + 1 free_text  → Manager
 *   Cluster B "Relief & Escape":      3 sliders + 1 choice + 1 free_text → Firefighter
 *   Cluster C "Connection & Rels.":   3 sliders + 1 choice + 1 free_text → Manager (relational)
 *   Cluster D "The Voice Inside":     1 slider + 1 choice + 2 sliders + 1 free_text → Manager (critic)
 *     └─ exile node placed silently if cD_q3 or cD_q5 ≥ 4
 *
 * Inference stored in assessment_sessions.inferences_json — NEVER shown to user.
 * Part display_name = COALESCE(custom_name, name) — always user's chosen name.
 */

import { Fragment, useCallback, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { getDatabase } from '@/lib/database';
import { inferPhase1, type Phase1Responses } from '@/lib/assessment-inference';

// ─── Types ────────────────────────────────────────────────────────────────────

type FreeTextQ = {
  id: string; text: string; type: 'free_text';
  placeholder: string; required: boolean;
};
type SingleChoiceQ = {
  id: string; text: string; type: 'single_choice';
  required: boolean; options: { value: string; label: string }[];
};
type YesNoConditionalQ = {
  id: string; text: string; type: 'yes_no_conditional';
  required: boolean; options: { value: string; label: string }[];
  conditionalPlaceholder: string;
};
type SliderQ = {
  id: string; text: string; type: 'slider';
  minLabel: string; maxLabel: string; required: boolean;
};

type P1Question = FreeTextQ | SingleChoiceQ | YesNoConditionalQ;
type ClusterQuestion = SliderQ | FreeTextQ | SingleChoiceQ;

type ClusterKey = 'A' | 'B' | 'C' | 'D';
type ClusterQStep = { q: ClusterKey; i: number };

type Step =
  | 'intro'
  | number
  | 'p1_done'
  | 'cA_intro'
  | ClusterQStep
  | 'cA_naming' | 'cA_chips' | 'cA_confirm'
  | 'cB_intro' | 'cB_safety'
  | 'cB_naming' | 'cB_chips' | 'cB_confirm'
  | 'cC_intro'
  | 'cC_naming' | 'cC_chips' | 'cC_confirm'
  | 'cD_intro'
  | 'cD_naming' | 'cD_chips' | 'cD_confirm'
  | 'p3_intro'
  | 'p3_q1' | 'p3_q2' | 'p3_q3'
  | 'p3_self_energy'
  | 'reveal_1' | 'reveal_2' | 'reveal_3'
  | 'saving'
  | 'done';

interface P1Responses {
  p1_q1: string; p1_q2: string; p1_q3: string;
  p1_q4_answer: string; p1_q4_text: string; p1_q5: string;
}
interface CAResponses { cA_q1: number; cA_q2: number; cA_q3: number; cA_q4: number; cA_q5: string; }
interface CBResponses { cB_q1: number; cB_q2: number; cB_q3: number; cB_q4: string; cB_q5: string; }
interface CCResponses { cC_q1: number; cC_q2: number; cC_q3: number; cC_q4: string; cC_q5: string; }
interface CDResponses { cD_q1: number; cD_q2: string; cD_q3: number; cD_q4: string; cD_q5: number; }

interface NamingState {
  selectedChip: string;
  customName: string;
  feelTowards: string;
}

const EMPTY_NAMING: NamingState = { selectedChip: '', customName: '', feelTowards: '' };

// ─── Phase 1 Question Data ─────────────────────────────────────────────────────

const P1_QUESTIONS: P1Question[] = [
  {
    id: 'p1_q1', type: 'free_text', required: true,
    text: 'Briefly describe what happened — just a sentence or two is enough.',
    placeholder: 'Something came up at work, a conversation with someone, a feeling out of nowhere...',
  },
  {
    id: 'p1_q2', type: 'free_text', required: false,
    text: 'Where did you feel it in your body first?',
    placeholder: 'Chest, stomach, shoulders, throat — anywhere it landed...',
  },
  {
    id: 'p1_q3', type: 'single_choice', required: true,
    text: 'When it hit, what did you do — or want to do?',
    options: [
      { value: 'withdrew', label: 'I pulled back, got quiet, or wanted to disappear' },
      { value: 'acted_out', label: 'I said something, pushed back, or got reactive' },
      { value: 'went_busy', label: 'I got busy, distracted myself, or pushed through' },
      { value: 'went_numb', label: 'I went a bit flat or disconnected from it' },
      { value: 'tried_to_fix', label: 'I tried to solve it, manage it, or control the situation' },
      { value: 'something_else', label: 'Something else' },
    ],
  },
  {
    id: 'p1_q4', type: 'yes_no_conditional', required: true,
    text: 'Afterward, was there a second voice — something that commented on how you handled it?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
      { value: 'not_sure', label: 'Not sure' },
    ],
    conditionalPlaceholder: "Something like 'you overreacted' or 'you should have said more'...",
  },
  {
    id: 'p1_q5', type: 'single_choice', required: true,
    text: 'How often does something like this happen for you?',
    options: [
      { value: 'rarely', label: 'Rarely — this was unusual' },
      { value: 'sometimes', label: 'Sometimes — a few times a month' },
      { value: 'often', label: 'Often — a few times a week' },
      { value: 'very_often', label: "Very often — it's basically the background noise of my life" },
    ],
  },
];

// ─── Cluster A — Standards & Effort ───────────────────────────────────────────

const CA_QUESTIONS: ClusterQuestion[] = [
  {
    id: 'cA_q1', type: 'slider', required: true,
    text: "When you're working on something that matters to you, there's often a part watching — evaluating how well you're doing. How present is that for you?",
    minLabel: 'Barely there', maxLabel: 'Constant presence',
  },
  {
    id: 'cA_q2', type: 'slider', required: true,
    text: 'When you finish something — a project, a conversation, a task — how quickly can you let yourself feel like it was good enough?',
    minLabel: 'Easily — I move on', maxLabel: "Rarely — there's always something I should have done better",
  },
  {
    id: 'cA_q3', type: 'slider', required: true,
    text: 'If you make a mistake — especially one others might see — what happens inside?',
    minLabel: 'I notice it and move on', maxLabel: 'It stays with me — I replay it, pick it apart',
  },
  {
    id: 'cA_q4', type: 'slider', required: true,
    text: 'Is there a sense that if you relaxed your standards — even a little — something would go wrong?',
    minLabel: 'Not really', maxLabel: 'Yes — the standards feel load-bearing',
  },
  {
    id: 'cA_q5', type: 'free_text', required: false,
    text: "In your own words — what does the part of you that monitors your performance feel like it's trying to protect you from?",
    placeholder: 'Failure, humiliation, being seen as less than, letting people down...',
  },
];

const CA_NAMING = {
  heading: "There's a part of you that holds the bar.",
  description: "You know the one. The part that's watching when you work — checking, evaluating, sometimes raising the standard just as you're about to reach it. It notices every gap between where you are and where you think you should be. It might sound like an internal coach, or a disappointed voice, or just a low hum of not quite yet. It's been with you for a long time. And it's been working hard — probably harder than you've ever acknowledged.",
  protectiveReframe: "This part didn't show up to torture you. It showed up because at some point, staying on top of things felt like the safest way to move through the world. High standards were its way of protecting you — from failure, from judgment, from something that felt worse than the effort.",
  requiredPhrase1: 'This part is not its standards. Those are a role it took on.',
  requiredPhrase2: 'This part has been working very hard for a very long time.',
  bridge: "Before we give it a name — what does it feel like to recognize it as a part? Not you. Something that's been trying to help. Take a moment with that. Then, when you're ready, let's name it.",
};

const CA_CHIPS = [
  { value: 'The Standard-Keeper', register: 'functional' },
  { value: 'The Driver', register: 'functional' },
  { value: 'The Watchman', register: 'evocative' },
  { value: 'The Iron Fist', register: 'evocative' },
  { value: 'The Taskmaster', register: 'evocative' },
  { value: 'Alex', register: 'personal' },
];

// ─── Cluster B — Relief & Escape ──────────────────────────────────────────────

const CB_QUESTIONS: ClusterQuestion[] = [
  {
    id: 'cB_q1', type: 'slider', required: true,
    text: "When stress or emotional pressure reaches a certain point, there's usually something you reach for — a behavior, a habit, a way of getting space. How familiar is that pattern for you?",
    minLabel: 'Not very — I generally sit with it', maxLabel: 'Very familiar — there\'s a reliable go-to',
  },
  {
    id: 'cB_q2', type: 'slider', required: true,
    text: "When you use that relief strategy — whatever it is — how much of it feels like a choice versus something that just happens?",
    minLabel: 'Mostly a choice', maxLabel: "It happens before I've decided to do it",
  },
  {
    id: 'cB_q3', type: 'slider', required: true,
    text: "Afterward — after you've gotten that relief — is there usually a part that has an opinion about it?",
    minLabel: 'Not really — I feel fine', maxLabel: "Yes — there's criticism, regret, or a cycle that starts up",
  },
  {
    id: 'cB_q4', type: 'single_choice', required: true,
    text: 'How long has this pattern been with you?',
    options: [
      { value: 'recent', label: 'It developed in the last few years' },
      { value: 'some_years', label: "It's been around for quite a while" },
      { value: 'long_time', label: 'For as long as I can remember' },
      { value: 'unsure', label: "I'm not sure" },
    ],
  },
  {
    id: 'cB_q5', type: 'free_text', required: false,
    text: 'What do you think this part of you is actually trying to do — when it reaches for relief?',
    placeholder: 'Get a break, feel something different, not feel anything, survive...',
  },
];

const CB_NAMING = {
  heading: "There's a part of you that finds the exit.",
  description: "When things get to be too much — when the pressure reaches a certain point — this part knows exactly what to do. It has a reliable move. Maybe it's a behavior, a habit, a place it goes, something it reaches for. The thing is, it works. It relieves something. That's the whole point. This part isn't random — it's strategic. It found something that interrupts the feeling, and it uses it. Over and over, because it had to.",
  protectiveReframe: "This part didn't start as a problem. It started as a solution. Somewhere, something was too much to bear in the moment, and this part stepped in to make it survivable. That's not weakness. That's what protective parts do when there's nothing else available. It's been carrying that job ever since.",
  requiredPhrase1: "This part is not its behavior. That's what it learned to do.",
  requiredPhrase2: 'This part has been working very hard for a very long time.',
  bridge: "This part often gets a lot of judgment — from others, maybe from another part of you. But right now, we're just meeting it. Not fixing it. Just acknowledging that it exists, and that it has a reason. When you're ready, let's give it a name.",
};

const CB_CHIPS = [
  { value: 'The Pressure Valve', register: 'functional' },
  { value: 'The Escape Artist', register: 'functional' },
  { value: 'The Relief-Seeker', register: 'functional' },
  { value: 'The Unraveler', register: 'evocative' },
  { value: 'The One Who Needs a Break', register: 'evocative' },
  { value: 'Riley', register: 'personal' },
];

// ─── Cluster C — Connection & Relationships ───────────────────────────────────

const CC_QUESTIONS: ClusterQuestion[] = [
  {
    id: 'cC_q1', type: 'slider', required: true,
    text: "When someone you care about is upset — with you, with something, with anyone — what happens inside you?",
    minLabel: 'I stay pretty steady', maxLabel: 'Something in me mobilizes — to fix it, smooth it, or move away',
  },
  {
    id: 'cC_q2', type: 'slider', required: true,
    text: "Is there a part of you that keeps track of how others seem to be feeling toward you — picking up signals, monitoring the temperature?",
    minLabel: "Not really — I don't track it closely", maxLabel: "Yes — it's like a background sensor that's always running",
  },
  {
    id: 'cC_q3', type: 'slider', required: true,
    text: "When you need something from someone — support, space, help — how easy is it to ask directly?",
    minLabel: 'Pretty easy — I ask when I need to', maxLabel: 'Hard — I often manage without asking, or hint rather than ask',
  },
  {
    id: 'cC_q4', type: 'single_choice', required: true,
    text: "In conflict or tension with someone close, what does the part of you that wants to preserve the connection tend to do?",
    options: [
      { value: 'accommodates', label: 'It accommodates — gives way to keep the peace' },
      { value: 'caretakes', label: "It turns toward the other person — focuses on their feelings" },
      { value: 'withdraws', label: 'It pulls back — distances until things cool down' },
      { value: 'minimizes', label: "It minimizes — acts like it's not a big deal" },
      { value: 'manages', label: 'It manages the situation — tries to steer the outcome' },
      { value: 'mix', label: 'A mix of several of these' },
    ],
  },
  {
    id: 'cC_q5', type: 'free_text', required: false,
    text: "What do you think this part is most afraid would happen if it stopped doing its job in relationships?",
    placeholder: 'The relationship would fall apart, people would leave, conflict would spiral...',
  },
];

const CC_NAMING = {
  heading: "There's a part of you that keeps watch over your relationships.",
  description: "It monitors the temperature. It notices when someone seems off, when there's tension in the air, when you might have said something wrong. It adjusts. It softens edges, smooths things over, turns toward people when they're struggling — even when you're struggling too. This part works constantly in the background of your relationships, and most of the time, you don't even notice it's doing it. It just feels like you.",
  protectiveReframe: "This part learned that closeness has conditions — that staying connected requires effort, adjustment, sometimes self-erasure. So it got very good at managing the relational field. It didn't do this because you're weak or overly anxious. It did this because connection mattered — enough to protect at significant cost.",
  requiredPhrase1: "This part is not its role in relationships. That's a job it took on.",
  requiredPhrase2: 'This part has been working very hard for a very long time.',
  bridge: "There's often a lot of tenderness toward this part when people meet it — because it's been giving so much for so long. See if you can sense that. Then, when you're ready, let's give it a name.",
};

const CC_CHIPS = [
  { value: 'The Accommodator', register: 'functional' },
  { value: 'The Peacekeeper', register: 'functional' },
  { value: 'The Bridge-Builder', register: 'functional' },
  { value: 'The Sentinel', register: 'evocative' },
  { value: 'The One Who Holds It Together', register: 'evocative' },
  { value: 'Jordan', register: 'personal' },
];

// ─── Cluster D — The Voice Inside ─────────────────────────────────────────────

const CD_QUESTIONS: ClusterQuestion[] = [
  {
    id: 'cD_q1', type: 'slider', required: true,
    text: "Is there a voice inside that comments on you — on how you're doing, what you should have said, whether you're getting it right?",
    minLabel: "Barely — I don't hear it much", maxLabel: "It's almost constant",
  },
  {
    id: 'cD_q2', type: 'single_choice', required: true,
    text: "When that voice speaks, what's its general tone?",
    options: [
      { value: 'harsh', label: 'Harsh — critical, contemptuous, disappointed' },
      { value: 'worried', label: 'Worried — anxious, vigilant, scanning for problems' },
      { value: 'comparing', label: 'Comparative — measuring me against others or a standard' },
      { value: 'coaching', label: 'Coaching — pushing me to do better, work harder' },
      { value: 'quiet_flat', label: "It's more of an absence — things go flat or numb" },
      { value: 'mix', label: 'A mix' },
    ],
  },
  {
    id: 'cD_q3', type: 'slider', required: true,
    text: "When that voice is active, what do you tend to do — on the inside?",
    minLabel: "I engage with it — argue back, comply, try to satisfy it",
    maxLabel: "I shut down — go quiet, go flat, try to disappear from myself",
  },
  {
    id: 'cD_q4', type: 'free_text', required: false,
    text: "If you turn toward the harshest thing this voice says — not to agree with it, just to notice it — what does it say about you?",
    placeholder: "That I'm not enough, that I'm a disappointment, that something is wrong with me...",
  },
  {
    id: 'cD_q5', type: 'slider', required: true,
    text: "There's often something underneath that voice — something it's been trying to protect you from feeling. How much do you sense something there?",
    minLabel: "Not really — it's just a voice", maxLabel: "Yes — something heavier is underneath",
  },
];

const CD_NAMING = {
  heading: "There's a part of you that keeps a running commentary.",
  description: "The voice that notices what you did wrong before you've even finished doing it. The one that can take a moment of success and find the flaw in it before you've had time to feel good. It evaluates, compares, anticipates criticism — sometimes by delivering it first. It can be harsh. It can be relentless. And it has probably been with you for so long that you've stopped noticing how loud it actually is.",
  protectiveReframe: "Here's something that might be surprising: this voice is trying to protect you. Not kindly, not skillfully — but sincerely. It learned, somewhere, that if it criticized you first, it could prevent something worse. External criticism. Failure. Humiliation. Rejection. It got out in front of all of it by making sure you never got comfortable, never rested, never forgot the gap between where you are and where you should be.",
  requiredPhrase1: "This part is not its criticism. That voice took on a job.",
  requiredPhrase2: 'This part has been working very hard for a very long time.',
  bridge: "This part often feels like the most unwelcome guest in the whole system. But it showed up for a reason. It's been trying, in its way, to keep you safe. When you're ready, let's give it a name.",
};

const CD_CHIPS = [
  { value: 'The Critic', register: 'functional' },
  { value: 'The Inner Judge', register: 'functional' },
  { value: 'The Harsh One', register: 'evocative' },
  { value: 'The Overseer', register: 'evocative' },
  { value: 'The Voice', register: 'evocative' },
  { value: 'Sam', register: 'personal' },
];

// ─── Cluster lookup maps ───────────────────────────────────────────────────────

const CLUSTER_QUESTIONS: Record<ClusterKey, ClusterQuestion[]> = {
  A: CA_QUESTIONS, B: CB_QUESTIONS, C: CC_QUESTIONS, D: CD_QUESTIONS,
};
const CLUSTER_LABELS: Record<ClusterKey, string> = {
  A: 'Standards & Effort', B: 'Relief & Escape',
  C: 'Connection & Relationships', D: 'The Voice Inside',
};
const CLUSTER_COLORS: Record<ClusterKey, string> = {
  A: '#3B5BA5', B: '#C2600A', C: '#3B5BA5', D: '#3B5BA5',
};
const CLUSTER_NAMING: Record<ClusterKey, typeof CA_NAMING> = {
  A: CA_NAMING, B: CB_NAMING, C: CC_NAMING, D: CD_NAMING,
};
const CLUSTER_CHIPS: Record<ClusterKey, typeof CA_CHIPS> = {
  A: CA_CHIPS, B: CB_CHIPS, C: CC_CHIPS, D: CD_CHIPS,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isClusterQ(step: Step): step is ClusterQStep {
  return typeof step === 'object' && step !== null && 'q' in step;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FreeTextInput({
  placeholder, value, onChange, minHeight = 120,
}: {
  placeholder: string; value: string; onChange: (v: string) => void; minHeight?: number;
}) {
  return (
    <TextInput
      style={{
        backgroundColor: '#FFFFFF', borderColor: '#E5E3DE', borderWidth: 1,
        borderRadius: 12, padding: 16, fontSize: 16, lineHeight: 24,
        minHeight, color: '#1C1B19', textAlignVertical: 'top',
      }}
      multiline placeholder={placeholder} placeholderTextColor="#6B6860"
      value={value} onChangeText={onChange}
    />
  );
}

function SingleChoiceInput({
  options, value, onChange, accentColor = '#3B5BA5', accentLight = '#EEF2FF',
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  accentColor?: string;
  accentLight?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value} onPress={() => onChange(opt.value)}
            style={{
              borderRadius: 12, padding: 16, borderWidth: 1,
              borderColor: selected ? accentColor : '#E5E3DE',
              backgroundColor: selected ? accentLight : '#FFFFFF',
            }}
          >
            <Text style={{
              fontSize: 15, lineHeight: 22,
              color: selected ? accentColor : '#1C1B19',
              fontWeight: selected ? '500' : '400',
            }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function YesNoConditionalInput({
  options, choiceValue, conditionalValue, conditionalPlaceholder,
  onChangeChoice, onChangeConditional,
}: {
  options: { value: string; label: string }[]; choiceValue: string; conditionalValue: string;
  conditionalPlaceholder: string; onChangeChoice: (v: string) => void;
  onChangeConditional: (v: string) => void;
}) {
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {options.map((opt) => {
          const selected = choiceValue === opt.value;
          return (
            <Pressable
              key={opt.value} onPress={() => onChangeChoice(opt.value)}
              style={{
                flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
                borderWidth: 1,
                borderColor: selected ? '#3B5BA5' : '#E5E3DE',
                backgroundColor: selected ? '#EEF2FF' : '#FFFFFF',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '500', color: selected ? '#3B5BA5' : '#1C1B19' }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {choiceValue === 'yes' && (
        <View>
          <Text style={{ color: '#6B6860', fontSize: 14, marginBottom: 8 }}>
            What did it say — even roughly?
          </Text>
          <TextInput
            style={{
              backgroundColor: '#FFFFFF', borderColor: '#E5E3DE', borderWidth: 1,
              borderRadius: 12, padding: 16, fontSize: 15, lineHeight: 22,
              minHeight: 100, color: '#1C1B19', textAlignVertical: 'top',
            }}
            multiline placeholder={conditionalPlaceholder} placeholderTextColor="#6B6860"
            value={conditionalValue} onChangeText={onChangeConditional}
          />
        </View>
      )}
    </View>
  );
}

function SliderInput({
  value, onChange, minLabel, maxLabel, color = '#3B5BA5',
}: {
  value: number;
  onChange: (v: number) => void;
  minLabel: string; maxLabel: string;
  color?: string;
}) {
  const STEPS = [1, 2, 3, 4, 5];
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
        {STEPS.map((v, i) => {
          const active = value >= v;
          const selected = value === v;
          return (
            <Fragment key={v}>
              {i > 0 && (
                <View style={{
                  flex: 1, height: 3, borderRadius: 1.5,
                  backgroundColor: active ? color : '#E5E3DE',
                }} />
              )}
              <Pressable
                onPress={() => onChange(v)}
                hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
              >
                <View style={{
                  width: selected ? 30 : 22,
                  height: selected ? 30 : 22,
                  borderRadius: 15,
                  backgroundColor: active ? color : '#FFFFFF',
                  borderWidth: 2,
                  borderColor: active ? color : '#E5E3DE',
                  shadowColor: selected ? color : 'transparent',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: selected ? 0.35 : 0,
                  shadowRadius: 6,
                  elevation: selected ? 3 : 0,
                }} />
              </Pressable>
            </Fragment>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, color: '#6B6860', flex: 1 }}>{minLabel}</Text>
        <Text style={{ fontSize: 12, color: '#6B6860', flex: 1, textAlign: 'right' }}>{maxLabel}</Text>
      </View>
    </View>
  );
}

/** 8-point starburst: two overlapping squares rotated 45° from each other. */
function StarburstNode({ label, sublabel, size = 90 }: { label: string; sublabel?: string; size?: number }) {
  const sq = size * 0.72;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute', width: sq, height: sq,
        backgroundColor: '#C2600A',
        shadowColor: '#C2600A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
      }} />
      <View style={{
        position: 'absolute', width: sq, height: sq,
        backgroundColor: '#C2600A',
        transform: [{ rotate: '45deg' }],
      }} />
      <View style={{ zIndex: 2, alignItems: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>{sublabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** Rounded-rect Manager node (used for A, C, D confirms). */
function ManagerNode({
  label, sublabel, color = '#3B5BA5',
}: { label: string; sublabel?: string; color?: string }) {
  return (
    <View style={{
      backgroundColor: color,
      borderRadius: 12,
      paddingHorizontal: 28, paddingVertical: 18,
      shadowColor: color,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 8,
      minWidth: 160,
      alignItems: 'center',
    }}>
      <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
        {label}
      </Text>
      {sublabel ? (
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>{sublabel}</Text>
      ) : null}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FirstMappingScreen() {
  const [step, setStep] = useState<Step>('intro');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [p1Responses, setP1Responses] = useState<P1Responses>({
    p1_q1: '', p1_q2: '', p1_q3: '',
    p1_q4_answer: '', p1_q4_text: '', p1_q5: '',
  });
  const [caResponses, setCAResponses] = useState<CAResponses>({
    cA_q1: 0, cA_q2: 0, cA_q3: 0, cA_q4: 0, cA_q5: '',
  });
  const [cbResponses, setCBResponses] = useState<CBResponses>({
    cB_q1: 0, cB_q2: 0, cB_q3: 0, cB_q4: '', cB_q5: '',
  });
  const [ccResponses, setCCResponses] = useState<CCResponses>({
    cC_q1: 0, cC_q2: 0, cC_q3: 0, cC_q4: '', cC_q5: '',
  });
  const [cdResponses, setCDResponses] = useState<CDResponses>({
    cD_q1: 0, cD_q2: '', cD_q3: 0, cD_q4: '', cD_q5: 0,
  });

  const [namingA, setNamingA] = useState<NamingState>({ ...EMPTY_NAMING });
  const [namingB, setNamingB] = useState<NamingState>({ ...EMPTY_NAMING });
  const [namingC, setNamingC] = useState<NamingState>({ ...EMPTY_NAMING });
  const [namingD, setNamingD] = useState<NamingState>({ ...EMPTY_NAMING });

  const [p3Responses, setP3Responses] = useState({ p3_q1: 0, p3_q2: 0, p3_q3: '' });
  const [eightCs, setEightCs] = useState({
    curious: false, calm: false, compassionate: false, confident: false,
    creative: false, courageous: false, connected: false, clear: false,
  });

  // Part IDs for cross-referencing (exile node → cD part)
  const partIdRef = useRef<Partial<Record<ClusterKey, string>>>({});

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const nodeScale = useRef(new Animated.Value(0)).current;
  const nodePulse = useRef(new Animated.Value(1)).current;
  const exilePulse = useRef(new Animated.Value(1)).current;

  // ── Transition ───────────────────────────────────────────────────────────

  const transitionTo = useCallback(
    (nextStep: Step) => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
        setStep(nextStep);
        const isConfirmStep = (s: Step) =>
          s === 'cA_confirm' || s === 'cB_confirm' || s === 'cC_confirm' || s === 'cD_confirm'
          || s === 'reveal_1';
        if (isConfirmStep(nextStep)) {
          nodeScale.setValue(0);
          nodePulse.setValue(1);
          Animated.spring(nodeScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start(() => {
            Animated.loop(
              Animated.sequence([
                Animated.timing(nodePulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
                Animated.timing(nodePulse, { toValue: 1, duration: 900, useNativeDriver: true }),
              ])
            ).start();
          });
        }
        if (nextStep === 'reveal_3') {
          exilePulse.setValue(1);
          Animated.loop(
            Animated.sequence([
              Animated.timing(exilePulse, {
                toValue: 1.08, duration: 600,
                easing: Easing.inOut(Easing.ease), useNativeDriver: true,
              }),
              Animated.timing(exilePulse, {
                toValue: 1, duration: 600,
                easing: Easing.inOut(Easing.ease), useNativeDriver: true,
              }),
            ])
          ).start();
        }
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    },
    [fadeAnim, nodeScale, nodePulse, exilePulse]
  );

  // ── Safety card trigger (Cluster B) ───────────────────────────────────────

  function shouldShowSafetyCard(): boolean {
    return cbResponses.cB_q1 >= 4 || cbResponses.cB_q2 >= 4;
  }

  // ── DB writes ─────────────────────────────────────────────────────────────

  async function handlePhase1Complete() {
    setStep('saving');
    const id = generateId();
    setSessionId(id);
    try {
      const db = getDatabase();
      const phase1Rs: Phase1Responses = {
        p1_q1: p1Responses.p1_q1,
        p1_q2: p1Responses.p1_q2,
        p1_q3: p1Responses.p1_q3,
        p1_q4_answer: p1Responses.p1_q4_answer,
        p1_q4_text: p1Responses.p1_q4_text || undefined,
        p1_q5: p1Responses.p1_q5,
      };
      const inferences = inferPhase1(phase1Rs);
      await db.runAsync(
        `INSERT INTO assessment_sessions
           (id, assessment_type, status, current_phase, current_cluster, responses_json, inferences_json, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, 'first_mapping', 'in_progress', 'phase2', 'A',
          JSON.stringify({ phase1: p1Responses }),
          JSON.stringify({ phase1: inferences }),
          new Date().toISOString(),
        ]
      );
    } catch (err) {
      console.error('Phase 1 save error:', err);
    }
    transitionTo('p1_done');
  }

  async function handleClusterAComplete() {
    setStep('saving');
    try {
      const db = getDatabase();
      const chosenName = namingA.customName.trim() || namingA.selectedChip;
      const chipTitle = namingA.selectedChip || CA_CHIPS[0].value;
      const hasCustom = namingA.customName.trim().length > 0;
      const partId = generateId();
      const namingId = generateId();
      partIdRef.current.A = partId;

      await db.runAsync(
        `INSERT INTO parts
           (id, name, custom_name, type, backend_classification, intensity,
            discovered_via, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          partId, chipTitle, hasCustom ? namingA.customName.trim() : null,
          'manager', 'Perfectionist/Analyzer/Planner', 5,
          'first_mapping', 'named', new Date().toISOString(), new Date().toISOString(),
        ]
      );
      await db.runAsync(
        `INSERT INTO assessment_naming_moments
           (id, session_id, cluster, working_title, user_chosen_name, feel_towards, part_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [namingId, sessionId, 'A', chipTitle, chosenName, namingA.feelTowards, partId, new Date().toISOString()]
      );
      if (sessionId) {
        await db.runAsync(
          `UPDATE assessment_sessions SET responses_json = ?, current_cluster = ? WHERE id = ?`,
          [JSON.stringify({ phase1: p1Responses, clusterA: caResponses }), 'B', sessionId]
        );
      }
    } catch (err) {
      console.error('Cluster A save error:', err);
    }
    transitionTo('cB_intro');
  }

  async function handleClusterBComplete() {
    setStep('saving');
    try {
      const db = getDatabase();
      const chosenName = namingB.customName.trim() || namingB.selectedChip;
      const chipTitle = namingB.selectedChip || CB_CHIPS[0].value;
      const hasCustom = namingB.customName.trim().length > 0;
      const partId = generateId();
      const namingId = generateId();
      partIdRef.current.B = partId;

      await db.runAsync(
        `INSERT INTO parts
           (id, name, custom_name, type, backend_classification, intensity,
            discovered_via, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          partId, chipTitle, hasCustom ? namingB.customName.trim() : null,
          'firefighter', 'Escape Artist/Distractor/Relief-Seeker', 5,
          'first_mapping', 'named', new Date().toISOString(), new Date().toISOString(),
        ]
      );
      await db.runAsync(
        `INSERT INTO assessment_naming_moments
           (id, session_id, cluster, working_title, user_chosen_name, feel_towards, part_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [namingId, sessionId, 'B', chipTitle, chosenName, namingB.feelTowards, partId, new Date().toISOString()]
      );
      if (sessionId) {
        await db.runAsync(
          `UPDATE assessment_sessions SET responses_json = ?, current_cluster = ? WHERE id = ?`,
          [JSON.stringify({ phase1: p1Responses, clusterA: caResponses, clusterB: cbResponses }), 'C', sessionId]
        );
      }
    } catch (err) {
      console.error('Cluster B save error:', err);
    }
    transitionTo('cC_intro');
  }

  async function handleClusterCComplete() {
    setStep('saving');
    try {
      const db = getDatabase();
      const chosenName = namingC.customName.trim() || namingC.selectedChip;
      const chipTitle = namingC.selectedChip || CC_CHIPS[0].value;
      const hasCustom = namingC.customName.trim().length > 0;
      const partId = generateId();
      const namingId = generateId();
      partIdRef.current.C = partId;

      await db.runAsync(
        `INSERT INTO parts
           (id, name, custom_name, type, backend_classification, intensity,
            discovered_via, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          partId, chipTitle, hasCustom ? namingC.customName.trim() : null,
          'manager', 'Pleaser/Peacemaker/Caretaker', 5,
          'first_mapping', 'named', new Date().toISOString(), new Date().toISOString(),
        ]
      );
      await db.runAsync(
        `INSERT INTO assessment_naming_moments
           (id, session_id, cluster, working_title, user_chosen_name, feel_towards, part_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [namingId, sessionId, 'C', chipTitle, chosenName, namingC.feelTowards, partId, new Date().toISOString()]
      );
      if (sessionId) {
        await db.runAsync(
          `UPDATE assessment_sessions SET responses_json = ?, current_cluster = ? WHERE id = ?`,
          [JSON.stringify({ phase1: p1Responses, clusterA: caResponses, clusterB: cbResponses, clusterC: ccResponses }), 'D', sessionId]
        );
      }
    } catch (err) {
      console.error('Cluster C save error:', err);
    }
    transitionTo('cD_intro');
  }

  async function handleClusterDComplete() {
    setStep('saving');
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      const chosenName = namingD.customName.trim() || namingD.selectedChip;
      const chipTitle = namingD.selectedChip || CD_CHIPS[0].value;
      const hasCustom = namingD.customName.trim().length > 0;
      const partId = generateId();
      const namingId = generateId();
      partIdRef.current.D = partId;

      await db.runAsync(
        `INSERT INTO parts
           (id, name, custom_name, type, backend_classification, intensity,
            discovered_via, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          partId, chipTitle, hasCustom ? namingD.customName.trim() : null,
          'manager', 'Inner Critic/Comparer/Perfectionist', 5,
          'first_mapping', 'named', now, now,
        ]
      );
      await db.runAsync(
        `INSERT INTO assessment_naming_moments
           (id, session_id, cluster, working_title, user_chosen_name, feel_towards, part_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [namingId, sessionId, 'D', chipTitle, chosenName, namingD.feelTowards, partId, now]
      );

      // Exile node placement — silent, no naming prompt
      const exileSignalHigh = cdResponses.cD_q3 >= 4 || cdResponses.cD_q5 >= 4;
      if (exileSignalHigh) {
        const shadowId = generateId();
        await db.runAsync(
          `INSERT INTO shadowed_nodes
             (id, inferred_type, inferred_backend_classification,
              connected_to_part_id, revealed_by_assessment, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            shadowId, 'exile', 'Shamed One/Worthless One/Unlovable One',
            partId, 'first_mapping', now,
          ]
        );
      }

      if (sessionId) {
        await db.runAsync(
          `UPDATE assessment_sessions
             SET responses_json = ?, current_cluster = ?, status = ?
           WHERE id = ?`,
          [
            JSON.stringify({
              phase1: p1Responses,
              clusterA: caResponses, clusterB: cbResponses,
              clusterC: ccResponses, clusterD: cdResponses,
            }),
            'D', 'phase3_ready', sessionId,
          ]
        );
      }
    } catch (err) {
      console.error('Cluster D save error:', err);
    }
    transitionTo('p3_intro');
  }

  async function handlePhase3Complete() {
    setStep('saving');
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      const partAId = partIdRef.current.A;
      const partBId = partIdRef.current.B;

      // Infer protective relationship between A (manager) and B (firefighter)
      if (partAId && partBId && (p3Responses.p3_q1 >= 3 || p3Responses.p3_q2 >= 3)) {
        const relId = generateId();
        const relType = p3Responses.p3_q2 >= 3 ? 'polarized' : 'protective';
        const strength = Math.min(10, Math.max(1, Math.round((p3Responses.p3_q1 + p3Responses.p3_q2) * 1.2)));
        await db.runAsync(
          `INSERT INTO part_relationships
             (id, part_a_id, part_b_id, relationship_type, direction, strength, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [relId, partAId, partBId, relType, 'mutual', strength, 'inferred', now, now]
        );
      }

      // Self-energy baseline — 8 C's (stored as 1=absent, 7=present; never scored or shown)
      const checkinId = generateId();
      const eightCsJson = JSON.stringify({
        curious: eightCs.curious ? 7 : 1,
        calm: eightCs.calm ? 7 : 1,
        compassionate: eightCs.compassionate ? 7 : 1,
        connected: eightCs.connected ? 7 : 1,
        confident: eightCs.confident ? 7 : 1,
        creative: eightCs.creative ? 7 : 1,
        courageous: eightCs.courageous ? 7 : 1,
        clear: eightCs.clear ? 7 : 1,
      });
      await db.runAsync(
        `INSERT INTO self_energy_checkins
           (id, check_type, overall_percentage, eight_cs_json, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [checkinId, 'full', 0, eightCsJson, p3Responses.p3_q3, now]
      );

      // Mark session complete
      if (sessionId) {
        await db.runAsync(
          `UPDATE assessment_sessions
             SET status = ?, current_phase = ?, responses_json = ?, completed_at = ?
           WHERE id = ?`,
          [
            'complete', 'phase3',
            JSON.stringify({
              phase1: p1Responses,
              clusterA: caResponses, clusterB: cbResponses,
              clusterC: ccResponses, clusterD: cdResponses,
              phase3: p3Responses,
            }),
            now, sessionId,
          ]
        );
      }
    } catch (err) {
      console.error('Phase 3 save error:', err);
    }
    transitionTo('reveal_1');
  }

  // ── canContinue ───────────────────────────────────────────────────────────

  function canContinue(): boolean {
    if (
      step === 'intro' || step === 'p1_done' ||
      step === 'cA_intro' || step === 'cA_naming' || step === 'cA_confirm' ||
      step === 'cB_intro' || step === 'cB_safety' || step === 'cB_naming' || step === 'cB_confirm' ||
      step === 'cC_intro' || step === 'cC_naming' || step === 'cC_confirm' ||
      step === 'cD_intro' || step === 'cD_naming' || step === 'cD_confirm' ||
      step === 'p3_intro' || step === 'p3_q3' || step === 'p3_self_energy' ||
      step === 'reveal_1' || step === 'reveal_2' || step === 'reveal_3'
    ) {
      return true;
    }

    if (typeof step === 'number') {
      const q = P1_QUESTIONS[step];
      if (!q.required) return true;
      switch (q.id) {
        case 'p1_q1': return p1Responses.p1_q1.trim().length > 0;
        case 'p1_q3': return p1Responses.p1_q3.length > 0;
        case 'p1_q4': return p1Responses.p1_q4_answer.length > 0;
        case 'p1_q5': return p1Responses.p1_q5.length > 0;
        default: return true;
      }
    }

    if (isClusterQ(step)) {
      const { q, i } = step;
      const clusterQ = CLUSTER_QUESTIONS[q][i];
      if (!clusterQ.required) return true;

      if (clusterQ.type === 'slider') {
        const sliderMap: Record<ClusterKey, number[]> = {
          A: [caResponses.cA_q1, caResponses.cA_q2, caResponses.cA_q3, caResponses.cA_q4, 0],
          B: [cbResponses.cB_q1, cbResponses.cB_q2, cbResponses.cB_q3, 0, 0],
          C: [ccResponses.cC_q1, ccResponses.cC_q2, ccResponses.cC_q3, 0, 0],
          D: [cdResponses.cD_q1, 0, cdResponses.cD_q3, 0, cdResponses.cD_q5],
        };
        return (sliderMap[q][i] ?? 0) >= 1;
      }

      if (clusterQ.type === 'single_choice') {
        if (q === 'B' && i === 3) return cbResponses.cB_q4 !== '';
        if (q === 'C' && i === 3) return ccResponses.cC_q4 !== '';
        if (q === 'D' && i === 1) return cdResponses.cD_q2 !== '';
      }

      return true;
    }

    if (step === 'cA_chips') return namingA.selectedChip !== '' || namingA.customName.trim() !== '';
    if (step === 'cB_chips') return namingB.selectedChip !== '' || namingB.customName.trim() !== '';
    if (step === 'cC_chips') return namingC.selectedChip !== '' || namingC.customName.trim() !== '';
    if (step === 'cD_chips') return namingD.selectedChip !== '' || namingD.customName.trim() !== '';

    if (step === 'p3_q1') return p3Responses.p3_q1 >= 1;
    if (step === 'p3_q2') return p3Responses.p3_q2 >= 1;

    return true;
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  function handleBack() {
    if (step === 'intro') { router.back(); return; }
    if (typeof step === 'number') { transitionTo(step === 0 ? 'intro' : step - 1); return; }
    if (step === 'p1_done') { transitionTo(P1_QUESTIONS.length - 1); return; }
    if (step === 'cA_intro') { transitionTo('p1_done'); return; }

    if (isClusterQ(step)) {
      const { q, i } = step;
      const introMap: Record<ClusterKey, Step> = {
        A: 'cA_intro', B: 'cB_intro', C: 'cC_intro', D: 'cD_intro',
      };
      transitionTo(i === 0 ? introMap[q] : { q, i: i - 1 });
      return;
    }

    if (step === 'cA_naming') { transitionTo({ q: 'A', i: CA_QUESTIONS.length - 1 }); return; }
    if (step === 'cA_chips') { transitionTo('cA_naming'); return; }

    if (step === 'cB_safety') { transitionTo({ q: 'B', i: CB_QUESTIONS.length - 1 }); return; }
    if (step === 'cB_naming') {
      transitionTo(shouldShowSafetyCard() ? 'cB_safety' : { q: 'B', i: CB_QUESTIONS.length - 1 });
      return;
    }
    if (step === 'cB_chips') { transitionTo('cB_naming'); return; }

    if (step === 'cC_naming') { transitionTo({ q: 'C', i: CC_QUESTIONS.length - 1 }); return; }
    if (step === 'cC_chips') { transitionTo('cC_naming'); return; }

    if (step === 'cD_naming') { transitionTo({ q: 'D', i: CD_QUESTIONS.length - 1 }); return; }
    if (step === 'cD_chips') { transitionTo('cD_naming'); return; }

    if (step === 'p3_q1') { transitionTo('p3_intro'); return; }
    if (step === 'p3_q2') { transitionTo('p3_q1'); return; }
    if (step === 'p3_q3') { transitionTo('p3_q2'); return; }
    if (step === 'p3_self_energy') { transitionTo('p3_q3'); return; }
  }

  function handleContinue() {
    if (step === 'intro') { transitionTo(0); return; }

    if (typeof step === 'number') {
      if (step < P1_QUESTIONS.length - 1) { transitionTo(step + 1); }
      else { handlePhase1Complete(); }
      return;
    }

    if (step === 'p1_done') { transitionTo('cA_intro'); return; }

    if (isClusterQ(step)) {
      const { q, i } = step;
      const qs = CLUSTER_QUESTIONS[q];
      if (i < qs.length - 1) {
        transitionTo({ q, i: i + 1 });
      } else {
        // End of cluster questions — route to safety card or naming
        if (q === 'B' && shouldShowSafetyCard()) {
          transitionTo('cB_safety');
        } else {
          const namingMap: Record<ClusterKey, Step> = {
            A: 'cA_naming', B: 'cB_naming', C: 'cC_naming', D: 'cD_naming',
          };
          transitionTo(namingMap[q]);
        }
      }
      return;
    }

    if (step === 'cA_intro') { transitionTo({ q: 'A', i: 0 }); return; }
    if (step === 'cA_naming') { transitionTo('cA_chips'); return; }
    if (step === 'cA_chips') { transitionTo('cA_confirm'); return; }
    if (step === 'cA_confirm') { handleClusterAComplete(); return; }

    if (step === 'cB_intro') { transitionTo({ q: 'B', i: 0 }); return; }
    if (step === 'cB_safety') { transitionTo('cB_naming'); return; }
    if (step === 'cB_naming') { transitionTo('cB_chips'); return; }
    if (step === 'cB_chips') { transitionTo('cB_confirm'); return; }
    if (step === 'cB_confirm') { handleClusterBComplete(); return; }

    if (step === 'cC_intro') { transitionTo({ q: 'C', i: 0 }); return; }
    if (step === 'cC_naming') { transitionTo('cC_chips'); return; }
    if (step === 'cC_chips') { transitionTo('cC_confirm'); return; }
    if (step === 'cC_confirm') { handleClusterCComplete(); return; }

    if (step === 'cD_intro') { transitionTo({ q: 'D', i: 0 }); return; }
    if (step === 'cD_naming') { transitionTo('cD_chips'); return; }
    if (step === 'cD_chips') { transitionTo('cD_confirm'); return; }
    if (step === 'cD_confirm') { handleClusterDComplete(); return; }

    if (step === 'p3_intro') { transitionTo('p3_q1'); return; }
    if (step === 'p3_q1') { transitionTo('p3_q2'); return; }
    if (step === 'p3_q2') { transitionTo('p3_q3'); return; }
    if (step === 'p3_q3') { transitionTo('p3_self_energy'); return; }
    if (step === 'p3_self_energy') { handlePhase3Complete(); return; }
    if (step === 'reveal_1') { transitionTo('reveal_2'); return; }
    if (step === 'reveal_2') { transitionTo('reveal_3'); return; }
    if (step === 'reveal_3') { router.replace('/(tabs)/explore'); return; }
  }

  function continueLabel(): string {
    if (step === 'intro') return 'Begin';
    if (typeof step === 'number' && step === P1_QUESTIONS.length - 1) return 'Continue';
    if (step === 'cA_naming' || step === 'cB_naming' || step === 'cC_naming' || step === 'cD_naming') return 'Name this part';
    if (step === 'cA_chips' || step === 'cB_chips' || step === 'cC_chips' || step === 'cD_chips') return 'Confirm';
    if (step === 'cA_confirm' || step === 'cB_confirm' || step === 'cC_confirm' || step === 'cD_confirm') return 'Done';
    if (step === 'p3_intro') return 'Begin';
    if (step === 'p3_self_energy') return 'See my map';
    if (step === 'reveal_1' || step === 'reveal_2') return 'Next';
    if (step === 'reveal_3') return 'Explore the fog';
    return 'Continue';
  }

  // ── Derived display values ────────────────────────────────────────────────

  const p1QIdx = typeof step === 'number' ? step : -1;
  const clusterQInfo = isClusterQ(step) ? {
    q: step.q,
    i: step.i,
    label: CLUSTER_LABELS[step.q],
    color: CLUSTER_COLORS[step.q],
    total: CLUSTER_QUESTIONS[step.q].length,
  } : null;
  const p3QIdx = step === 'p3_q1' ? 0 : step === 'p3_q2' ? 1 : step === 'p3_q3' ? 2 : -1;

  const showProgress = p1QIdx >= 0 || clusterQInfo !== null || p3QIdx >= 0;
  const progressLabel = p1QIdx >= 0 ? 'The Moment' : p3QIdx >= 0 ? 'The Connections' : clusterQInfo?.label ?? '';
  const progressColor = p3QIdx >= 0 ? '#B88A00' : clusterQInfo?.color ?? '#6B6860';
  const progressCurrent = p1QIdx >= 0 ? p1QIdx + 1 : p3QIdx >= 0 ? p3QIdx + 1 : (clusterQInfo?.i ?? 0) + 1;
  const progressTotal = p1QIdx >= 0 ? P1_QUESTIONS.length : p3QIdx >= 0 ? 3 : clusterQInfo?.total ?? 0;
  const progressPct = showProgress ? (progressCurrent / progressTotal) * 100 : 0;


  const noBackSteps: Step[] = [
    'cA_confirm', 'cB_intro', 'cB_confirm',
    'cC_intro', 'cC_confirm', 'cD_intro', 'cD_confirm',
    'saving', 'done',
    'p3_intro', 'reveal_1', 'reveal_2', 'reveal_3',
  ];
  const showBack = !noBackSteps.includes(step as Step);
  const showBottomBar = step !== 'saving' && step !== 'done' &&
    step !== 'p3_self_energy' && step !== 'reveal_1' && step !== 'reveal_2' && step !== 'reveal_3';

  const chosenNameA = namingA.customName.trim() || namingA.selectedChip;
  const chosenNameB = namingB.customName.trim() || namingB.selectedChip;
  const chosenNameC = namingC.customName.trim() || namingC.selectedChip;
  const chosenNameD = namingD.customName.trim() || namingD.selectedChip;

  // Derived from cluster D responses — same threshold as exile node placement
  const hasExile = cdResponses.cD_q3 >= 4 || cdResponses.cD_q5 >= 4;

  // Dynamic Phase 3 question texts using chosen part names
  const nameA = chosenNameA || 'the first part';
  const nameB = chosenNameB || 'the second part';
  const nameC = chosenNameC || 'the third part';
  const p3Q1Text = `${nameA} and ${nameB} — do they ever seem to be responding to the same thing? Like ${nameA} tries to hold something together, and when that doesn't work, ${nameB} shows up?`;
  const p3Q2Text = `Does ${nameA} ever seem to react to ${nameB}? Like one of them triggers or activates the other?`;
  const p3Q3Text = `When you think about ${nameA}, ${nameB}, and ${nameC} all together — how do you feel toward them as a group?`;

  // ── Reusable NamingChips + Confirm renders ────────────────────────────────

  function renderChipsScreen(
    clusterKey: ClusterKey,
    chips: typeof CA_CHIPS,
    naming: NamingState,
    setNaming: React.Dispatch<React.SetStateAction<NamingState>>,
    accentColor: string,
    accentLight: string,
  ) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
            <Pressable onPress={handleBack} style={{ padding: 8, marginLeft: -8 }}>
              <Text style={{ color: '#6B6860', fontSize: 20 }}>←</Text>
            </Pressable>
          </View>

          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={{
                color: '#6B6860', fontSize: 12, fontWeight: '600',
                letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14, marginTop: 8,
              }}>
                Naming Moment
              </Text>
              <Text style={{ color: '#1C1B19', fontSize: 20, fontWeight: '600', lineHeight: 28, marginBottom: 8 }}>
                What name fits this part?
              </Text>
              <Text style={{ color: '#6B6860', fontSize: 15, lineHeight: 24, marginBottom: 28 }}>
                You can use one of these, or give it your own.
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
                {chips.map((chip) => {
                  const selected = naming.selectedChip === chip.value;
                  return (
                    <Pressable
                      key={chip.value}
                      onPress={() => setNaming((n) => ({ ...n, selectedChip: selected ? '' : chip.value }))}
                      style={{
                        paddingHorizontal: 16, paddingVertical: 12, borderRadius: 100,
                        borderWidth: 1.5,
                        borderColor: selected ? accentColor : '#E5E3DE',
                        backgroundColor: selected ? accentLight : '#FFFFFF',
                      }}
                    >
                      <Text style={{
                        fontSize: 15, fontWeight: selected ? '600' : '400',
                        color: selected ? accentColor : '#1C1B19',
                      }}>
                        {chip.value}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ color: '#6B6860', fontSize: 14, marginBottom: 10 }}>
                Or give it your own name
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#FFFFFF', borderColor: '#E5E3DE', borderWidth: 1,
                  borderRadius: 12, padding: 16, fontSize: 16, color: '#1C1B19', minHeight: 56,
                }}
                placeholder="Something that feels right..."
                placeholderTextColor="#6B6860"
                value={naming.customName}
                onChangeText={(v) => setNaming((n) => ({ ...n, customName: v }))}
                returnKeyType="done"
              />
            </ScrollView>
          </Animated.View>

          <View style={{
            paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16,
            borderTopWidth: 1, borderTopColor: '#E5E3DE',
          }}>
            <Pressable
              onPress={handleContinue}
              disabled={!canContinue()}
              style={{
                backgroundColor: canContinue() ? accentColor : '#E5E3DE',
                borderRadius: 12, paddingVertical: 16, alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: canContinue() ? '#FFFFFF' : '#6B6860' }}>
                Confirm
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  function renderConfirmScreen(
    chosenName: string,
    sublabel: string,
    naming: NamingState,
    setNaming: React.Dispatch<React.SetStateAction<NamingState>>,
    nodeElement: React.ReactNode,
  ) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ alignItems: 'center', paddingTop: 56, paddingBottom: 40 }}>
                <Animated.View style={{ transform: [{ scale: Animated.multiply(nodeScale, nodePulse) }] }}>
                  {nodeElement}
                </Animated.View>
              </View>

              <Text style={{ color: '#1C1B19', fontSize: 19, fontWeight: '500', lineHeight: 28, marginBottom: 8 }}>
                How do you feel toward {chosenName || 'this part'} right now?
              </Text>
              <Text style={{ color: '#6B6860', fontSize: 14, lineHeight: 22, marginBottom: 20 }}>
                There's no right answer. Just notice.
              </Text>
              <FreeTextInput
                placeholder="Curious, grateful, tired, wary, something else entirely..."
                value={naming.feelTowards}
                onChange={(v) => setNaming((n) => ({ ...n, feelTowards: v }))}
                minHeight={100}
              />
            </ScrollView>
          </Animated.View>

          <View style={{
            paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16,
            borderTopWidth: 1, borderTopColor: '#E5E3DE',
          }}>
            <Pressable
              onPress={handleContinue}
              style={{ backgroundColor: '#3B5BA5', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Done</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Render: Saving ────────────────────────────────────────────────────────

  if (step === 'saving') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#6B6860', fontSize: 16 }}>Saving…</Text>
      </SafeAreaView>
    );
  }

  // ── Render: Phase 3 — Self-energy 8 C's check-in (standalone) ───────────

  if (step === 'p3_self_energy') {
    const EIGHT_CS: { key: keyof typeof eightCs; label: string; description: string }[] = [
      { key: 'curious', label: 'Curious', description: 'Interested rather than anxious' },
      { key: 'calm', label: 'Calm', description: 'A sense of steadiness inside' },
      { key: 'compassionate', label: 'Compassionate', description: 'Warmth without needing to fix' },
      { key: 'confident', label: 'Confident', description: 'A quiet sense of capability' },
      { key: 'creative', label: 'Creative', description: 'Flexibility, possibility' },
      { key: 'courageous', label: 'Courageous', description: 'Able to stay with difficulty' },
      { key: 'connected', label: 'Connected', description: 'Present with yourself and others' },
      { key: 'clear', label: 'Clear', description: 'A sense of perspective' },
    ];
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          >
            <View style={{ paddingTop: 32, marginBottom: 28 }}>
              <Text style={{
                color: '#B88A00', fontSize: 12, fontWeight: '600',
                letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
              }}>
                The Connections
              </Text>
              <Text style={{ color: '#1C1B19', fontSize: 22, fontWeight: '600', lineHeight: 30, marginBottom: 12 }}>
                One more thing.
              </Text>
              <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26 }}>
                As you sit with everything you've just explored — which of these feels present for you right now? Just notice. There's no right answer.
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              {EIGHT_CS.map(({ key, label, description }) => {
                const active = eightCs[key];
                return (
                  <Pressable
                    key={key}
                    onPress={() => setEightCs((c) => ({ ...c, [key]: !c[key] }))}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: active ? '#FFFBEB' : '#FFFFFF',
                      borderRadius: 12, padding: 16, borderWidth: 1,
                      borderColor: active ? '#B88A00' : '#E5E3DE',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 16, fontWeight: active ? '600' : '400',
                        color: active ? '#B88A00' : '#1C1B19', marginBottom: 2,
                      }}>
                        {label}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#6B6860', lineHeight: 18 }}>
                        {description}
                      </Text>
                    </View>
                    <View style={{
                      width: 24, height: 24, borderRadius: 12, marginLeft: 12,
                      backgroundColor: active ? '#B88A00' : 'transparent',
                      borderWidth: active ? 0 : 1.5, borderColor: '#E5E3DE',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {active && (
                        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>✓</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>

        <View style={{
          paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16,
          borderTopWidth: 1, borderTopColor: '#E5E3DE',
        }}>
          <Pressable
            onPress={handleContinue}
            style={{ backgroundColor: '#B88A00', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>See my map</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Three-Screen Reveal ───────────────────────────────────────────

  if (step === 'reveal_1') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          >
            <View style={{ paddingTop: 40, marginBottom: 32 }}>
              <Text style={{
                color: '#B88A00', fontSize: 12, fontWeight: '600',
                letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
              }}>
                Your Map
              </Text>
              <Text style={{ color: '#1C1B19', fontSize: 24, fontWeight: '700', lineHeight: 32, marginBottom: 12 }}>
                This is your system.
              </Text>
              <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26 }}>
                As much of it as we can see from here.
              </Text>
            </View>

            {/* Node grid — 2×2 */}
            <Animated.View style={{
              transform: [{ scale: Animated.multiply(nodeScale, nodePulse) }],
              marginBottom: 32,
            }}>
              <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <ManagerNode label={chosenNameA || 'Part A'} sublabel="Manager" />
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <StarburstNode label={chosenNameB || 'Part B'} sublabel="Firefighter" size={90} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <ManagerNode label={chosenNameC || 'Part C'} sublabel="Manager" />
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <ManagerNode label={chosenNameD || 'Part D'} sublabel="Manager" />
                </View>
              </View>
            </Animated.View>

            <Text style={{ color: '#6B6860', fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
              Four parts. Each one doing a job. Each one with a reason.
            </Text>
          </ScrollView>
        </Animated.View>

        <View style={{
          paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16,
          borderTopWidth: 1, borderTopColor: '#E5E3DE',
        }}>
          <Pressable
            onPress={handleContinue}
            style={{ backgroundColor: '#3B5BA5', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Next</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'reveal_2') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          >
            <View style={{ paddingTop: 40, marginBottom: 32 }}>
              <Text style={{
                color: '#3B5BA5', fontSize: 12, fontWeight: '600',
                letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
              }}>
                A Pattern Worth Seeing
              </Text>
              <Text style={{ color: '#1C1B19', fontSize: 24, fontWeight: '700', lineHeight: 32, marginBottom: 16 }}>
                They're not fighting each other.
              </Text>
              <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26, marginBottom: 16 }}>
                They're protecting the same thing.
              </Text>
            </View>

            {/* Relationship highlight */}
            <View style={{
              backgroundColor: '#FFFFFF', borderRadius: 16,
              borderWidth: 1, borderColor: '#E5E3DE',
              padding: 24, marginBottom: 24, alignItems: 'center',
            }}>
              <ManagerNode label={chosenNameA || 'Part A'} sublabel="Manager" />
              <View style={{ height: 32, width: 2, backgroundColor: '#E5E3DE', marginVertical: 8 }} />
              <Text style={{ color: '#6B6860', fontSize: 13, marginBottom: 8, fontStyle: 'italic' }}>
                protective relationship
              </Text>
              <View style={{ height: 32, width: 2, backgroundColor: '#E5E3DE', marginVertical: 8 }} />
              <StarburstNode label={chosenNameB || 'Part B'} sublabel="Firefighter" size={90} />
            </View>

            <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26 }}>
              {chosenNameA || 'The first part'} holds a standard. When that pressure
              becomes too much, {chosenNameB || 'the second part'} finds the exit. Two
              parts — one system. Both trying to keep you safe.
            </Text>
          </ScrollView>
        </Animated.View>

        <View style={{
          paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16,
          borderTopWidth: 1, borderTopColor: '#E5E3DE',
        }}>
          <Pressable
            onPress={handleContinue}
            style={{ backgroundColor: '#3B5BA5', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Next</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'reveal_3') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          >
            <View style={{ paddingTop: 40, marginBottom: 32 }}>
              <Text style={{
                color: '#6B6860', fontSize: 12, fontWeight: '600',
                letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
              }}>
                What Comes Next
              </Text>
              <Text style={{ color: '#1C1B19', fontSize: 24, fontWeight: '700', lineHeight: 32, marginBottom: 16 }}>
                A question worth following.
              </Text>
              <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26 }}>
                What happened that made these connections necessary? That's the question that lives in the fog.
              </Text>
            </View>

            {hasExile && (
              <View style={{ alignItems: 'center', marginBottom: 32 }}>
                {/* Fog container — dark background with vignette layers */}
                <View style={{
                  width: 180, height: 180, borderRadius: 90,
                  backgroundColor: '#1A1917',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 24,
                  elevation: 8,
                }}>
                  {/* Outer fog ring — darkest mist layer */}
                  <View style={{
                    position: 'absolute', width: 160, height: 160, borderRadius: 80,
                    backgroundColor: 'rgba(26,25,23,0.7)',
                  }} />
                  {/* Mid fog ring — violet-tinted mist */}
                  <View style={{
                    position: 'absolute', width: 130, height: 130, borderRadius: 65,
                    backgroundColor: 'rgba(40,20,50,0.5)',
                  }} />
                  {/* Pulsing exile node */}
                  <Animated.View style={{ transform: [{ scale: exilePulse }] }}>
                    <View style={{
                      width: 80, height: 80, borderRadius: 40,
                      backgroundColor: 'rgba(124,61,155,0.25)',
                      borderWidth: 1.5, borderColor: 'rgba(124,61,155,0.6)',
                      borderStyle: 'dashed',
                      alignItems: 'center', justifyContent: 'center',
                      opacity: 0.5,
                    }}>
                      <Text style={{
                        color: 'rgba(197,168,219,0.7)', fontSize: 11,
                        fontWeight: '500', textAlign: 'center', paddingHorizontal: 6,
                      }}>
                        Unknown{'\n'}waiting
                      </Text>
                    </View>
                  </Animated.View>
                  {/* Inner fog overlay — softens node edges */}
                  <View style={{
                    position: 'absolute', width: 110, height: 110, borderRadius: 55,
                    backgroundColor: 'rgba(26,25,23,0.25)',
                  }} pointerEvents="none" />
                </View>
                <Text style={{
                  color: '#6B6860', fontSize: 14, lineHeight: 22,
                  marginTop: 16, textAlign: 'center', fontStyle: 'italic',
                }}>
                  Something is here. It's waiting to be known.
                </Text>
              </View>
            )}

            <View style={{
              backgroundColor: '#FFFFFF', borderRadius: 12,
              borderLeftWidth: 3, borderLeftColor: '#7C3D9B',
              padding: 16, marginBottom: 24,
            }}>
              <Text style={{ color: '#6B6860', fontSize: 15, lineHeight: 24, fontStyle: 'italic' }}>
                "What happened that made these connections necessary? That question is worth following."
              </Text>
            </View>
          </ScrollView>
        </Animated.View>

        <View style={{
          paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16,
          borderTopWidth: 1, borderTopColor: '#E5E3DE',
        }}>
          <Pressable
            onPress={handleContinue}
            style={{ backgroundColor: '#3B5BA5', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Explore the fog</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: done (fallback — not normally reached) ────────────────────────

  if (step === 'done') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
          <Text style={{ color: '#1C1B19', fontSize: 22, fontWeight: '600', lineHeight: 30, marginBottom: 16 }}>
            Assessment complete.
          </Text>
        </View>
        <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            style={{ backgroundColor: '#3B5BA5', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Return to Atlas</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Chips screens (full-screen, no shared chrome) ─────────────────

  if (step === 'cA_chips') {
    return renderChipsScreen('A', CA_CHIPS, namingA, setNamingA, '#3B5BA5', '#EEF2FF');
  }
  if (step === 'cB_chips') {
    return renderChipsScreen('B', CB_CHIPS, namingB, setNamingB, '#C2600A', '#FFF7ED');
  }
  if (step === 'cC_chips') {
    return renderChipsScreen('C', CC_CHIPS, namingC, setNamingC, '#3B5BA5', '#EEF2FF');
  }
  if (step === 'cD_chips') {
    return renderChipsScreen('D', CD_CHIPS, namingD, setNamingD, '#3B5BA5', '#EEF2FF');
  }

  // ── Render: Confirm screens (full-screen, no shared chrome) ──────────────

  if (step === 'cA_confirm') {
    return renderConfirmScreen(
      chosenNameA, 'Manager', namingA, setNamingA,
      <ManagerNode label={chosenNameA || 'This part'} sublabel="Manager" />,
    );
  }
  if (step === 'cB_confirm') {
    return renderConfirmScreen(
      chosenNameB, 'Firefighter', namingB, setNamingB,
      <StarburstNode label={chosenNameB || 'This part'} sublabel="Firefighter" size={110} />,
    );
  }
  if (step === 'cC_confirm') {
    return renderConfirmScreen(
      chosenNameC, 'Manager', namingC, setNamingC,
      <ManagerNode label={chosenNameC || 'This part'} sublabel="Manager" />,
    );
  }
  if (step === 'cD_confirm') {
    return renderConfirmScreen(
      chosenNameD, 'Manager', namingD, setNamingD,
      <ManagerNode label={chosenNameD || 'This part'} sublabel="Manager" />,
    );
  }

  // ── Render: Cluster question helpers ─────────────────────────────────────

  function getClusterSliderValue(q: ClusterKey, i: number): number {
    const sliderMap: Record<ClusterKey, number[]> = {
      A: [caResponses.cA_q1, caResponses.cA_q2, caResponses.cA_q3, caResponses.cA_q4, 0],
      B: [cbResponses.cB_q1, cbResponses.cB_q2, cbResponses.cB_q3, 0, 0],
      C: [ccResponses.cC_q1, ccResponses.cC_q2, ccResponses.cC_q3, 0, 0],
      D: [cdResponses.cD_q1, 0, cdResponses.cD_q3, 0, cdResponses.cD_q5],
    };
    return sliderMap[q][i] ?? 0;
  }

  function setClusterSliderValue(q: ClusterKey, i: number, v: number) {
    const key = `c${q}_q${i + 1}`;
    if (q === 'A') setCAResponses((r) => ({ ...r, [key]: v }));
    else if (q === 'B') setCBResponses((r) => ({ ...r, [key]: v }));
    else if (q === 'C') setCCResponses((r) => ({ ...r, [key]: v }));
    else if (q === 'D') setCDResponses((r) => ({ ...r, [key]: v }));
  }

  function getClusterFreeTextValue(q: ClusterKey): string {
    if (q === 'A') return caResponses.cA_q5;
    if (q === 'B') return cbResponses.cB_q5;
    if (q === 'C') return ccResponses.cC_q5;
    return cdResponses.cD_q4;
  }

  function setClusterFreeTextValue(q: ClusterKey, v: string) {
    if (q === 'A') setCAResponses((r) => ({ ...r, cA_q5: v }));
    else if (q === 'B') setCBResponses((r) => ({ ...r, cB_q5: v }));
    else if (q === 'C') setCCResponses((r) => ({ ...r, cC_q5: v }));
    else if (q === 'D') setCDResponses((r) => ({ ...r, cD_q4: v }));
  }

  function getClusterSingleChoiceValue(q: ClusterKey): string {
    if (q === 'B') return cbResponses.cB_q4;
    if (q === 'C') return ccResponses.cC_q4;
    if (q === 'D') return cdResponses.cD_q2;
    return '';
  }

  function setClusterSingleChoiceValue(q: ClusterKey, v: string) {
    if (q === 'B') setCBResponses((r) => ({ ...r, cB_q4: v }));
    else if (q === 'C') setCCResponses((r) => ({ ...r, cC_q4: v }));
    else if (q === 'D') setCDResponses((r) => ({ ...r, cD_q2: v }));
  }

  // ── Render: Standard layout ───────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
        }}>
          {showBack && (
            <Pressable onPress={handleBack} style={{ padding: 8, marginLeft: -8 }}>
              <Text style={{ color: '#6B6860', fontSize: 20 }}>←</Text>
            </Pressable>
          )}

          {showProgress && (
            <>
              <View style={{
                flex: 1, marginHorizontal: 12, height: 3,
                backgroundColor: '#E5E3DE', borderRadius: 2,
              }}>
                <View style={{
                  height: 3, width: `${progressPct}%`,
                  backgroundColor: progressColor,
                  borderRadius: 2,
                }} />
              </View>
              <Text style={{ color: '#6B6860', fontSize: 13 }}>
                {progressCurrent}/{progressTotal}
              </Text>
            </>
          )}

          {!showProgress && !showBack && <View style={{ height: 36 }} />}
        </View>

        {/* Content */}
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Phase 1: Intro ── */}
            {step === 'intro' && (
              <View style={{ paddingTop: 24 }}>
                <Text style={{
                  color: '#6B6860', fontSize: 12, fontWeight: '600',
                  letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
                }}>
                  The Moment
                </Text>
                <Text style={{ color: '#1C1B19', fontSize: 22, fontWeight: '600', lineHeight: 30, marginBottom: 20 }}>
                  Let's start somewhere specific.
                </Text>
                <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26 }}>
                  Before we look at patterns, let's start with something specific. Think of a
                  recent moment — in the last week or two — when you had a strong reaction to
                  something. It doesn't have to be dramatic. Just a moment where something in
                  you shifted.
                </Text>
              </View>
            )}

            {/* ── Phase 1: Questions ── */}
            {p1QIdx >= 0 && (() => {
              const q = P1_QUESTIONS[p1QIdx];
              return (
                <View style={{ paddingTop: 24 }}>
                  <Text style={{
                    color: '#6B6860', fontSize: 12, fontWeight: '600',
                    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
                  }}>
                    {progressLabel}
                  </Text>
                  <Text style={{
                    color: '#1C1B19', fontSize: 19, fontWeight: '500',
                    lineHeight: 28, marginBottom: 28,
                  }}>
                    {q.text}
                  </Text>

                  {q.type === 'free_text' && (
                    <FreeTextInput
                      placeholder={q.placeholder}
                      value={q.id === 'p1_q1' ? p1Responses.p1_q1 : p1Responses.p1_q2}
                      onChange={(v) => setP1Responses((r) => ({
                        ...r, [q.id === 'p1_q1' ? 'p1_q1' : 'p1_q2']: v,
                      }))}
                    />
                  )}

                  {q.type === 'single_choice' && (
                    <SingleChoiceInput
                      options={q.options}
                      value={q.id === 'p1_q3' ? p1Responses.p1_q3 : p1Responses.p1_q5}
                      onChange={(v) => setP1Responses((r) => ({
                        ...r, [q.id === 'p1_q3' ? 'p1_q3' : 'p1_q5']: v,
                      }))}
                    />
                  )}

                  {q.type === 'yes_no_conditional' && (
                    <YesNoConditionalInput
                      options={q.options}
                      choiceValue={p1Responses.p1_q4_answer}
                      conditionalValue={p1Responses.p1_q4_text}
                      conditionalPlaceholder={q.conditionalPlaceholder}
                      onChangeChoice={(v) => setP1Responses((r) => ({ ...r, p1_q4_answer: v }))}
                      onChangeConditional={(v) => setP1Responses((r) => ({ ...r, p1_q4_text: v }))}
                    />
                  )}
                </View>
              );
            })()}

            {/* ── Phase 1 → Phase 2 Transition ── */}
            {step === 'p1_done' && (
              <View style={{ paddingTop: 32 }}>
                <Text style={{
                  color: '#6B6860', fontSize: 12, fontWeight: '600',
                  letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
                }}>
                  The Moment
                </Text>
                <Text style={{ color: '#1C1B19', fontSize: 22, fontWeight: '600', lineHeight: 30, marginBottom: 20 }}>
                  Thank you for sharing that.
                </Text>
                <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26 }}>
                  Now let's look at some broader patterns — the ones that show up not just in
                  one moment, but across your life.
                </Text>
              </View>
            )}

            {/* ── Cluster A: Intro ── */}
            {step === 'cA_intro' && (
              <View style={{ paddingTop: 32 }}>
                <Text style={{
                  color: '#3B5BA5', fontSize: 12, fontWeight: '600',
                  letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
                }}>
                  Standards & Effort
                </Text>
                <Text style={{ color: '#1C1B19', fontSize: 22, fontWeight: '600', lineHeight: 30, marginBottom: 20 }}>
                  The part that holds the bar — and keeps raising it.
                </Text>
                <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26 }}>
                  These questions are about the internal experience of effort, standards, and
                  what happens when you fall short.
                </Text>
              </View>
            )}

            {/* ── Cluster B: Intro (no-shame opening) ── */}
            {step === 'cB_intro' && (
              <View style={{ paddingTop: 32 }}>
                <Text style={{
                  color: '#C2600A', fontSize: 12, fontWeight: '600',
                  letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
                }}>
                  Relief & Escape
                </Text>
                <Text style={{ color: '#1C1B19', fontSize: 22, fontWeight: '600', lineHeight: 30, marginBottom: 20 }}>
                  The part that finds a way out when things get to be too much.
                </Text>
                <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26, marginBottom: 16 }}>
                  These questions are about what happens when pressure builds — and how you find relief.
                </Text>
                <View style={{
                  backgroundColor: '#FFF7ED', borderRadius: 12,
                  borderLeftWidth: 3, borderLeftColor: '#C2600A',
                  padding: 16,
                }}>
                  <Text style={{ color: '#6B6860', fontSize: 15, lineHeight: 24, fontStyle: 'italic' }}>
                    There's no right way to answer these. Whatever this part does — it had a reason.
                    We're not here to judge it.
                  </Text>
                </View>
              </View>
            )}

            {/* ── Cluster C: Intro ── */}
            {step === 'cC_intro' && (
              <View style={{ paddingTop: 32 }}>
                <Text style={{
                  color: '#3B5BA5', fontSize: 12, fontWeight: '600',
                  letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
                }}>
                  Connection & Relationships
                </Text>
                <Text style={{ color: '#1C1B19', fontSize: 22, fontWeight: '600', lineHeight: 30, marginBottom: 20 }}>
                  The part that manages how safe it is to be close.
                </Text>
                <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26 }}>
                  These questions are about what happens in relationships — especially when
                  there's tension, need, or the possibility of disappointment.
                </Text>
              </View>
            )}

            {/* ── Cluster D: Intro ── */}
            {step === 'cD_intro' && (
              <View style={{ paddingTop: 32 }}>
                <Text style={{
                  color: '#3B5BA5', fontSize: 12, fontWeight: '600',
                  letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
                }}>
                  The Voice Inside
                </Text>
                <Text style={{ color: '#1C1B19', fontSize: 22, fontWeight: '600', lineHeight: 30, marginBottom: 20 }}>
                  The part that comments on you — and what it might be covering.
                </Text>
                <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26 }}>
                  These questions are about the internal commentary — the voice that evaluates,
                  judges, or sometimes goes very quiet.
                </Text>
              </View>
            )}

            {/* ── Phase 3: Intro ── */}
            {step === 'p3_intro' && (
              <View style={{ paddingTop: 32 }}>
                <Text style={{
                  color: '#B88A00', fontSize: 12, fontWeight: '600',
                  letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
                }}>
                  The Connections
                </Text>
                <Text style={{ color: '#1C1B19', fontSize: 22, fontWeight: '600', lineHeight: 30, marginBottom: 20 }}>
                  You've met four parts.
                </Text>
                <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26, marginBottom: 16 }}>
                  {chosenNameA || 'The first part'}, {chosenNameB || 'the second'},{' '}
                  {chosenNameC || 'the third'}, and {chosenNameD || 'the fourth'}.
                  Each of them has been doing a job — working hard, for a long time.
                </Text>
                <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26 }}>
                  Before we show you what this looks like, there are a couple of questions about how they relate to each other.
                </Text>
              </View>
            )}

            {/* ── Phase 3: Q1 & Q2 (sliders) ── */}
            {(step === 'p3_q1' || step === 'p3_q2') && (
              <View style={{ paddingTop: 24 }}>
                <Text style={{
                  color: '#B88A00', fontSize: 12, fontWeight: '600',
                  letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
                }}>
                  The Connections
                </Text>
                <Text style={{
                  color: '#1C1B19', fontSize: 19, fontWeight: '500',
                  lineHeight: 28, marginBottom: 32,
                }}>
                  {step === 'p3_q1' ? p3Q1Text : p3Q2Text}
                </Text>
                <SliderInput
                  value={step === 'p3_q1' ? p3Responses.p3_q1 : p3Responses.p3_q2}
                  onChange={(v) =>
                    setP3Responses((r) => step === 'p3_q1' ? { ...r, p3_q1: v } : { ...r, p3_q2: v })
                  }
                  minLabel={step === 'p3_q1' ? 'Not really — they feel separate' : 'Not that I notice'}
                  maxLabel={step === 'p3_q1' ? 'Yes — they seem to be in the same system' : 'Yes — there\'s a cycle'}
                  color="#B88A00"
                />
              </View>
            )}

            {/* ── Phase 3: Q3 (free text — self-access baseline) ── */}
            {step === 'p3_q3' && (
              <View style={{ paddingTop: 24 }}>
                <Text style={{
                  color: '#B88A00', fontSize: 12, fontWeight: '600',
                  letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
                }}>
                  The Connections
                </Text>
                <Text style={{
                  color: '#1C1B19', fontSize: 19, fontWeight: '500',
                  lineHeight: 28, marginBottom: 32,
                }}>
                  {p3Q3Text}
                </Text>
                <FreeTextInput
                  placeholder="Tired, grateful, frustrated, curious, something else..."
                  value={p3Responses.p3_q3}
                  onChange={(v) => setP3Responses((r) => ({ ...r, p3_q3: v }))}
                />
              </View>
            )}

            {/* ── Cluster B: Safety Card ── */}
            {step === 'cB_safety' && (
              <View style={{ paddingTop: 32 }}>
                <Text style={{
                  color: '#C2600A', fontSize: 12, fontWeight: '600',
                  letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
                }}>
                  Before You Continue
                </Text>
                <Text style={{ color: '#1C1B19', fontSize: 20, fontWeight: '600', lineHeight: 28, marginBottom: 20 }}>
                  This part is carrying something heavy.
                </Text>
                <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26, marginBottom: 20 }}>
                  When relief behaviors are strong — when they feel automatic, urgent, or hard
                  to stop — that's often a sign that something underneath is working very hard
                  to stay covered.
                </Text>
                <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26, marginBottom: 20 }}>
                  This work is worth doing. And sometimes it's worth doing with support.
                  If you have a therapist, this would be good material to bring.
                </Text>
                <View style={{
                  backgroundColor: '#FFF7ED', borderRadius: 12,
                  borderLeftWidth: 3, borderLeftColor: '#C2600A',
                  padding: 16,
                }}>
                  <Text style={{ color: '#6B6860', fontSize: 15, lineHeight: 24, fontStyle: 'italic' }}>
                    You can continue at any time. There's nothing wrong with what you've shared.
                    This part showed up for a reason — and we're going to name it with care.
                  </Text>
                </View>
              </View>
            )}

            {/* ── Cluster Questions (all clusters) ── */}
            {clusterQInfo !== null && (() => {
              const { q, i, label, color } = clusterQInfo;
              const clusterQ = CLUSTER_QUESTIONS[q][i];

              return (
                <View style={{ paddingTop: 24 }}>
                  <Text style={{
                    color: color, fontSize: 12, fontWeight: '600',
                    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
                  }}>
                    {label}
                  </Text>
                  <Text style={{
                    color: '#1C1B19', fontSize: 19, fontWeight: '500',
                    lineHeight: 28, marginBottom: 32,
                  }}>
                    {clusterQ.text}
                  </Text>

                  {clusterQ.type === 'slider' && (
                    <SliderInput
                      value={getClusterSliderValue(q, i)}
                      onChange={(v) => setClusterSliderValue(q, i, v)}
                      minLabel={(clusterQ as SliderQ).minLabel}
                      maxLabel={(clusterQ as SliderQ).maxLabel}
                      color={color}
                    />
                  )}

                  {clusterQ.type === 'free_text' && (
                    <FreeTextInput
                      placeholder={(clusterQ as FreeTextQ).placeholder}
                      value={getClusterFreeTextValue(q)}
                      onChange={(v) => setClusterFreeTextValue(q, v)}
                    />
                  )}

                  {clusterQ.type === 'single_choice' && (
                    <SingleChoiceInput
                      options={(clusterQ as SingleChoiceQ).options}
                      value={getClusterSingleChoiceValue(q)}
                      onChange={(v) => setClusterSingleChoiceValue(q, v)}
                      accentColor={color}
                      accentLight={q === 'B' ? '#FFF7ED' : '#EEF2FF'}
                    />
                  )}
                </View>
              );
            })()}

            {/* ── Naming Moments — Description ── */}
            {(step === 'cA_naming' || step === 'cB_naming' || step === 'cC_naming' || step === 'cD_naming') && (() => {
              const clusterKey = step === 'cA_naming' ? 'A' : step === 'cB_naming' ? 'B' : step === 'cC_naming' ? 'C' : 'D';
              const naming = CLUSTER_NAMING[clusterKey as ClusterKey];
              const color = CLUSTER_COLORS[clusterKey as ClusterKey];

              return (
                <View style={{ paddingTop: 32 }}>
                  <Text style={{
                    color: color, fontSize: 12, fontWeight: '600',
                    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
                  }}>
                    Naming Moment
                  </Text>
                  <Text style={{
                    color: '#1C1B19', fontSize: 22, fontWeight: '700',
                    lineHeight: 30, marginBottom: 24,
                  }}>
                    {naming.heading}
                  </Text>

                  <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26, marginBottom: 24 }}>
                    {naming.description}
                  </Text>

                  <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26, marginBottom: 28 }}>
                    {naming.protectiveReframe}
                  </Text>

                  <View style={{
                    backgroundColor: '#FFFFFF', borderRadius: 12,
                    borderLeftWidth: 3, borderLeftColor: color,
                    padding: 16, marginBottom: 24, gap: 12,
                  }}>
                    <Text style={{ color: '#1C1B19', fontSize: 15, lineHeight: 24, fontStyle: 'italic' }}>
                      "{naming.requiredPhrase1}"
                    </Text>
                    <Text style={{ color: '#1C1B19', fontSize: 15, lineHeight: 24, fontStyle: 'italic' }}>
                      "{naming.requiredPhrase2}"
                    </Text>
                  </View>

                  <Text style={{ color: '#6B6860', fontSize: 16, lineHeight: 26 }}>
                    {naming.bridge}
                  </Text>
                </View>
              );
            })()}

          </ScrollView>
        </Animated.View>

        {/* Bottom bar */}
        {showBottomBar && (
          <View style={{
            paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16,
            borderTopWidth: 1, borderTopColor: '#E5E3DE',
          }}>
            <Pressable
              onPress={handleContinue}
              disabled={!canContinue()}
              style={{
                backgroundColor: canContinue() ? '#3B5BA5' : '#E5E3DE',
                borderRadius: 12, paddingVertical: 16, alignItems: 'center',
              }}
            >
              <Text style={{
                fontSize: 16, fontWeight: '600',
                color: canContinue() ? '#FFFFFF' : '#6B6860',
              }}>
                {continueLabel()}
              </Text>
            </Pressable>
          </View>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
