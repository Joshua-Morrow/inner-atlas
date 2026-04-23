/**
 * Techniques library data — 6-week IFS therapy adjunct program.
 * One technique per week, each building on the last.
 */

export interface TechniqueStep {
  id: string;
  type:
    | 'instruction'
    | 'timer'
    | 'input'
    | 'chip-select'
    | 'part-select'
    | 'experience-log'
    | 'unblend-cycle'
    | 'inquiry-questions'
    | 'meeting-space-setup'
    | 'meeting-rules'
    | 'meeting-dialogue'
    | 'meeting-feel-towards'   // Week 6: sequential feel-towards + unblend per part
    | 'meeting-relational-map' // Week 6: read-only map display before rules screen
    | 'mindfulness-practice';  // Week 2: combined breathing timer + experience log
  heading: string;
  body?: string;
  input_placeholder?: string;
  chips?: string[];
  timer_minutes?: number;
  optional?: boolean;
  unblending_mode?: boolean;  // for experience-log: show unblend support after each entry
  multi_select?: boolean;     // for part-select: allow selecting multiple parts
}

export interface Technique {
  id: string;
  week: number;
  title: string;
  subtitle: string;
  duration_minutes: number;
  category: 'somatic' | 'awareness' | 'relational';
  requires_part: boolean;
  has_ground_button: boolean;
  tutorial_text: string;
  framing_title: string;
  framing_body: string;
  before_prompt: string;
  after_prompt: string;
  steps: TechniqueStep[];
}

// ─── Shared constants ─────────────────────────────────────────────────────────

export const FEEL_TOWARDS_SELF_QUALITIES = [
  'Curious', 'Compassionate', 'Calm', 'Open',
  'Connected', 'Clear', 'Confident', 'Courageous',
  'Creative', 'Loving', 'Appreciative', 'Understanding', 'Empathetic',
];

export const FEEL_TOWARDS_REACTIVE = [
  'Frustrated', 'Confused', 'Afraid', 'Angry', 'Judgmental', 'Disgusted', 'Hopeless',
  'Skeptical', 'Distant', 'Numb', 'Overwhelmed', 'Protective', 'Anxious',
  'Irritated', 'Impatient', 'Resigned', 'Resentful', 'Guilty', 'Ashamed',
  'Indifferent', 'Disappointed', 'Tired', 'Exhausted',
];

/** Self-like energy chips — shown after Self-energy present section, gold styling */
export const FEEL_TOWARDS_SELF_LIKE = [
  'Cooperative', 'Liking', 'Supportive', 'Sympathetic',
];

export const INQUIRY_QUESTIONS = [
  "Is there anything this part wants to share with you right now?",
  "Where do you feel this part inside your body?",
  "What job is this part doing?",
  "What is this part afraid of?",
  "How long has this part been doing this job?",
  "If the part it's protecting were healed and it didn't need to do this job anymore — what would it want to do instead?",
  "Is there anything this part would like help with right now?",
  "What does this part look like? Notice any image, age, expression, or quality of energy.",
  "What does this part feel emotionally?",
  "What does this part say — what are its thoughts or messages?",
  "How does this part influence your behavior?",
  "What situations or triggers bring this part forward most?",
];

// Fixed questions shown first in Inquiry (indices into INQUIRY_QUESTIONS)
export const INQUIRY_FIXED_QUESTION_INDICES = [0, 2, 3];

export const TECHNIQUES: Technique[] = [
  // ─── Week 1 — Resonance Frequency Breathing ───────────────────────────────
  {
    id: 'rfb',
    week: 1,
    title: 'Resonance Frequency Breathing',
    subtitle: 'Regulate your nervous system before inner work',
    duration_minutes: 10,
    category: 'somatic',
    requires_part: false,
    has_ground_button: false,
    tutorial_text:
      "Resonance frequency breathing is a simple paced breathing practice that activates your body's natural calming response. You breathe in for 5 seconds and out for 5 seconds, creating a rhythm that synchronizes your heart rate and nervous system. This is the foundation of all the inner work ahead — learning to arrive in your body before turning attention inward. You don't need to do anything special. Just breathe and notice.",
    framing_title: "Let's begin with your breath.",
    framing_body:
      "Before we start, take a moment to arrive here. You'll breathe at a gentle pace for a few minutes. There's nothing to figure out — just follow the rhythm and notice what's present.",
    before_prompt:
      "Before you begin — what's your state right now? What thoughts, feelings, or sensations are present?",
    after_prompt: 'How are you feeling now? What do you notice in your body and mind?',
    steps: [
      {
        id: 'before',
        type: 'input',
        heading: 'Before you begin',
        body: 'Take a moment to check in. No need to analyze — just notice.',
        input_placeholder: "What's present right now — thoughts, feelings, body sensations...",
        optional: false,
      },
      {
        id: 'timer',
        type: 'timer',
        heading: 'Follow the breath',
        body: 'Breathe in as the circle expands. Breathe out as it contracts. 5 seconds each way.',
        timer_minutes: 5,
      },
      {
        id: 'noticed',
        type: 'input',
        heading: 'What came up?',
        body: 'Optional — note anything that arose during the practice.',
        input_placeholder: 'Thoughts, images, sensations, anything at all...',
        optional: true,
      },
    ],
  },

  // ─── Week 2 — Parts Mindfulness ───────────────────────────────────────────
  {
    id: 'parts-mindfulness',
    week: 2,
    title: 'Parts Mindfulness',
    subtitle: 'Notice what arises without following it',
    duration_minutes: 10,
    category: 'somatic',
    requires_part: false,
    has_ground_button: false,
    tutorial_text:
      "Parts Mindfulness adapts traditional mindfulness for IFS. Instead of letting thoughts and feelings pass like clouds, you pause and notice each one as a part — a distinct voice or energy in your system. You're not analyzing or engaging, just naming and witnessing. Each time something arises — a thought, a feeling, a sensation, an impulse — you note it as \"a part that feels...\" or \"a part that wants...\". This trains you to notice your parts without blending with them.",
    framing_title: 'Sit with what arises.',
    framing_body:
      "You'll breathe gently and notice whatever comes up. When something arises — a thought, feeling, sensation, or urge — you'll note it as a part and let it be. Nothing to solve, nothing to follow. Just witness.",
    before_prompt: "Before you begin — what's your state right now?",
    after_prompt: 'How are you now? What do you notice?',
    steps: [
      {
        id: 'before',
        type: 'input',
        heading: 'Before you begin',
        body: "Check in briefly. What's present as you arrive?",
        input_placeholder: "What's present right now...",
        optional: false,
      },
      {
        id: 'mindfulness-practice',
        type: 'mindfulness-practice',
        heading: 'Sit and notice.',
        body: 'Breathe gently. When something arises and pulls your attention, tap + to note it as a part.',
      },
    ],
  },

  // ─── Week 3 — Unblending ──────────────────────────────────────────────────
  {
    id: 'unblending',
    week: 3,
    title: 'Unblending',
    subtitle: 'Create space between you and your parts',
    duration_minutes: 10,
    category: 'awareness',
    requires_part: false,
    has_ground_button: true,
    tutorial_text:
      "Unblending is the core IFS skill. When a part's feelings or thoughts feel like *your* feelings or thoughts, you are blended with it. Unblending creates a little space — not pushing the part away, but recognizing \"I see you, and I am not you.\" You acknowledge the part, you make room for it, and you sense yourself as something separate from it. The goal isn't calm — it's contact without merger. Even a small amount of space is enough to begin.",
    framing_title: 'Make room without pushing away.',
    framing_body:
      "You'll notice what's present and gently acknowledge each part as separate from you. You're not trying to fix or remove anything — just create a little breathing room between you and what you're experiencing.",
    before_prompt: "Before you begin — what's present? What are you blended with right now?",
    after_prompt: 'How are you now? Was there any sense of space, even a little?',
    steps: [
      {
        id: 'before',
        type: 'input',
        heading: "What's present right now?",
        body: "What feels most loud, heavy, or close? You don't need to know if it's a part yet.",
        input_placeholder: 'A feeling, thought, tension, urge...',
        optional: false,
      },
      {
        id: 'unblending-log',
        type: 'experience-log',
        heading: 'Notice. Separate. Return.',
        body: "When something arises, tap + to name it. Then you'll be guided to create a little space from it before returning here.",
        unblending_mode: true,
      },
    ],
  },

  // ─── Week 4 — The Feel Towards Question ───────────────────────────────────
  {
    id: 'feel-towards',
    week: 4,
    title: 'The Feel Towards Question',
    subtitle: 'Find your Self-energy toward each part',
    duration_minutes: 10,
    category: 'awareness',
    requires_part: true,
    has_ground_button: true,
    tutorial_text:
      "The Feel Towards Question is how IFS measures Self-energy. You pick a part, unblend from anything in the way, and ask: \"How do I feel toward this part right now?\" If the answer is anything other than curious, compassionate, calm, or open — another part is blended. You unblend from that one too and ask again. You repeat this until you sense a genuine warmth or openness toward the target part. That's Self-energy. It doesn't have to be perfect — even a small shift toward curiosity is enough to begin working with the part.",
    framing_title: 'How do you feel toward this part?',
    framing_body:
      "You'll choose a part to work with. Then you'll check in honestly about how you feel toward it — and if another part is in the way, you'll acknowledge that one first. The goal is to arrive at genuine curiosity or compassion, not a forced calm.",
    before_prompt: "Before you begin — what's your state right now?",
    after_prompt: 'How are you now? Did you find any Self-energy toward this part?',
    steps: [
      {
        id: 'part-select',
        type: 'part-select',
        heading: 'Which part are you working with?',
        body: "Choose a part from your atlas, or name one that's active right now.",
      },
      {
        id: 'unblend-cycle',
        type: 'unblend-cycle',
        heading: 'How do you feel toward [part] right now?',
      },
    ],
  },

  // ─── Week 5 — Inquiry ─────────────────────────────────────────────────────
  {
    id: 'inquiry',
    week: 5,
    title: 'Inquiry',
    subtitle: 'Ask the part directly and listen',
    duration_minutes: 15,
    category: 'relational',
    requires_part: true,
    has_ground_button: true,
    tutorial_text:
      "Inquiry is the practice of talking *with* a part rather than *about* it. First you unblend and find Self-energy toward the part. Then you ask the part direct questions — and you listen for what arises, rather than thinking up answers yourself. The part communicates in images, feelings, impulses, and words. Your job is to receive, not analyze. You're not interviewing the part — you're making contact with it. Even a small sense of response from the part is meaningful.",
    framing_title: 'Let the part speak.',
    framing_body:
      "You'll unblend, find a little Self-energy, and then ask this part some questions. Listen for what arises — don't try to think up the answer. The part may respond in images, feelings, a sense of knowing, or words. Receive whatever comes.",
    before_prompt: "Before you begin — what's present? Which part are you meeting today?",
    after_prompt: 'How are you now? What did you receive from this part?',
    steps: [
      {
        id: 'part-select',
        type: 'part-select',
        heading: 'Which part are you meeting?',
        body: "Choose a part from your atlas or name one that's active right now.",
      },
      {
        id: 'arrive',
        type: 'instruction',
        heading: 'Arrive with this part.',
        body: "Take a breath. Let yourself sense [part] — not thinking about it, but noticing it. Where do you feel it? What quality does it have? You're not analyzing yet. Just arriving.",
      },
      {
        id: 'unblend-cycle',
        type: 'unblend-cycle',
        heading: 'How do you feel toward [part] right now?',
      },
      {
        id: 'inquiry-questions',
        type: 'inquiry-questions',
        heading: 'Ask and listen.',
        body: "Ask each question and wait for what arises. Don't think up the answer — receive it. Write what comes.",
      },
    ],
  },

  // ─── Week 6 — The Meeting Space ───────────────────────────────────────────
  {
    id: 'meeting-space',
    week: 6,
    title: 'The Meeting Space',
    subtitle: 'Bring your parts together in dialogue',
    duration_minutes: 20,
    category: 'relational',
    requires_part: false,
    has_ground_button: true,
    tutorial_text:
      "The Meeting Space is an imaginal practice where you invite two or more parts into a shared space and let them encounter each other in your presence. You're the host — Self — holding the space while the parts interact. You'll hear from each part, sense how they feel about each other, and facilitate if needed. This builds directly on everything you've practiced: the breathing, the noticing, the unblending, the feeling toward, the inquiry. The meeting space is where parts begin to see each other, not just protect against each other.",
    framing_title: 'Hold the space. Let the parts meet.',
    framing_body:
      "You'll invite two or more parts into an imagined space and witness their encounter from a place of Self. You're not directing — you're present. Whatever arises between the parts is information.",
    before_prompt: "Before you begin — what's present? Which parts feel ready to meet?",
    after_prompt: 'How are you now? What did you witness in the meeting space?',
    steps: [
      {
        id: 'host-intro',
        type: 'instruction',
        heading: 'You are the host.',
        body: "The Meeting Space is an inner place where parts can encounter each other in your presence. You're not directing — you're holding the space from Self. Whatever arises between the parts is information.",
      },
      {
        id: 'part-select',
        type: 'part-select',
        heading: 'Who is present in the space?',
        body: 'Choose two or more parts from your atlas. Or name parts that feel present right now.',
        multi_select: true,
      },
      {
        id: 'where-to-meet',
        type: 'meeting-space-setup',
        heading: 'Build the space.',
      },
      {
        id: 'feel-towards-seq',
        type: 'meeting-feel-towards',
        heading: 'Getting present with each part',
      },
      {
        id: 'relational-map',
        type: 'meeting-relational-map',
        heading: 'Before You Meet',
      },
      {
        id: 'meeting-rules',
        type: 'meeting-rules',
        heading: 'Before the meeting begins.',
      },
      {
        id: 'meeting-dialogue',
        type: 'meeting-dialogue',
        heading: 'The Meeting Space',
      },
    ],
  },
];

export function getTechniqueById(id: string): Technique | undefined {
  return TECHNIQUES.find((t) => t.id === id);
}

/** Legacy alias — used by technique-detail.tsx */
export function getTechnique(id: string): Technique | undefined {
  return getTechniqueById(id);
}

export const TECHNIQUE_CATEGORIES: {
  key: Technique['category'];
  label: string;
}[] = [
  { key: 'somatic',    label: 'SOMATIC FOUNDATION' },
  { key: 'awareness',  label: 'AWARENESS PRACTICES' },
  { key: 'relational', label: 'RELATIONAL PRACTICES' },
];
