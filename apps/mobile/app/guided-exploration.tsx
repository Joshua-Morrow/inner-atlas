/**
 * Guided Exploration
 * Route: /guided-exploration?partId=[id]&explorationId=[id]
 *
 * Freetext exploration for guided topics.
 * Tag input + free-write. Auto-saves on blur. Save button navigates back.
 * Floating shield ground button shown on memories for exile parts.
 * "Explore deeper" collapsible prompt section on all explorations.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

import { getDatabase } from '@/lib/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type PartType = 'manager' | 'firefighter' | 'exile' | 'self';

interface PartRow {
  id: string;
  display_name: string;
  type: PartType;
}

type ExplorationId =
  | 'voice_phrases'
  | 'desires_needs'
  | 'behavioral_patterns'
  | 'memories'
  | 'world_perspective'
  | 'fears'
  | 'strengths'
  | 'weaknesses'
  | 'part_inheritance'
  | 'permissions'
  | 'exile_contact';

interface AdditionalField {
  label: string;
  field: string;
  placeholder: string;
}

interface ExplorationConfig {
  title: string;
  prompt: string;
  profileField: string | null; // null = memories (special case)
  tagsField?: string;
  introTexts?: string[];
  tagLabel?: string;
  tagPlaceholder?: string;
  writeLabel?: string;
  writePlaceholder?: string;
  exploreDeeper?: string[];
  additionalFields?: AdditionalField[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<PartType, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
};

const EXPLORATION_CONFIG: Record<ExplorationId, ExplorationConfig> = {
  voice_phrases: {
    title: 'Voice & Phrases',
    prompt:
      'What does this part sound like? What phrases does it commonly use or repeat? What is its tone — harsh, worried, soothing, demanding?',
    profileField: 'voice_phrases',
    tagsField: 'voice_phrases_tags',
    exploreDeeper: [
      'What is the tone of this part\'s voice — harsh, pleading, worried, demanding, quiet?',
      'What phrases does this part repeat most often?',
      'Does this part speak differently to different people or in different situations?',
      'Is there anything this part wants to say that it hasn\'t been able to?',
    ],
  },
  desires_needs: {
    title: 'Desires & Needs',
    prompt:
      'What does this part want or need? What is it reaching toward or longing for? What would satisfy it?',
    profileField: 'desires',
    tagsField: 'desires_tags',
    exploreDeeper: [
      'What does this part need to feel safe?',
      'What does this part want most for you?',
      'What does this part need from you that it hasn\'t been getting?',
      'If this part could have one thing in your life, what would it be?',
    ],
  },
  behavioral_patterns: {
    title: 'Behavioral Patterns',
    prompt:
      'How does this part behave when it\'s active? What does it make you do or avoid doing? What patterns show up?',
    profileField: 'behavioral_patterns',
    tagsField: 'behavioral_patterns_tags',
    exploreDeeper: [
      'What does this part typically make you do — or stop you from doing?',
      'How does this part influence your relationships?',
      'What behaviour patterns does this part drive in times of stress?',
      'Are there situations where this part\'s patterns are helpful? Where they cause problems?',
    ],
  },
  memories: {
    title: 'Story, History & Memories',
    prompt:
      'Are there memories that arise when you focus on this part? What situations or times does it connect to?',
    profileField: null,
    tagsField: 'memories_tags',
    exploreDeeper: [
      'When did you first notice this part in your life?',
      'What significant events might have shaped this part?',
      'Is there an earliest memory that feels connected to this part?',
      'What has this part witnessed or been through that you\'re aware of?',
      'How has this part changed or evolved over time?',
    ],
  },
  world_perspective: {
    title: 'World Perspective & Beliefs',
    prompt:
      'How does this part see the world? What does it believe is true — about people, about safety, about what you need to do to survive or succeed?',
    profileField: 'beliefs',
    tagsField: 'world_perspective_tags',
    exploreDeeper: [
      'What does this part believe about you?',
      'What does this part believe about other people?',
      'What does this part believe about the world or about safety?',
      'What outdated beliefs might this part still be carrying?',
      'What does this part most fear is true?',
    ],
  },
  fears: {
    title: 'Fears',
    prompt:
      'What is this part most afraid of? What does it believe will happen if it stops doing its job? What is the worst case scenario it is trying to prevent?',
    profileField: 'fears',
    tagsField: 'fears_tags',
    exploreDeeper: [
      'What is this part trying to prevent?',
      'What does it think would happen if it stopped doing its job?',
      'What does this part most fear about you being seen or known?',
      'Is there a fear under the fear — something even deeper it is protecting against?',
    ],
  },
  strengths: {
    title: 'Strengths',
    prompt:
      'What is this part good at? What does it bring — what capabilities, qualities, or gifts does it have even if it\'s currently using them in a difficult way?',
    profileField: 'strengths',
    tagsField: 'strengths_tags',
    exploreDeeper: [
      'What has this part helped you survive or navigate?',
      'What quality does this part carry that you actually value?',
      'If this part were to become an ally rather than a burden, what would it offer?',
      'What would others who know you well say this part contributes?',
    ],
  },
  weaknesses: {
    title: 'Weaknesses',
    prompt:
      'What are the costs or limitations of this part\'s approach? Where does it fall short or create problems? What can\'t it do?',
    profileField: 'weaknesses',
    tagsField: 'weaknesses_tags',
    exploreDeeper: [
      'What does this part\'s way of operating cost you in relationships?',
      'Where does this part\'s strategy backfire or create problems?',
      'What does this part prevent you from experiencing or having?',
      'What would it mean to rely on this part a little less?',
    ],
  },
  part_inheritance: {
    title: 'Part Inheritance',
    prompt: '',
    profileField: 'inheritance_notes',
    tagsField: 'inheritance_tags',
    introTexts: [
      'Parts often carry patterns that were learned — absorbed from people around us, from culture, from stories that shaped us.',
      "This isn't about blame. It's about understanding where a part learned what it knows.",
    ],
    tagLabel: 'This part reminds me of...',
    tagPlaceholder: 'Add a person, character, or influence...',
    writeLabel: 'Tell me more',
    writePlaceholder:
      'What patterns, qualities, or behaviors does this part share with them? How did you come to carry this?',
    exploreDeeper: [
      'Do you recognise this part in anyone else — a parent, sibling, or caregiver?',
      'Does this part feel like it was passed down or learned from someone?',
      'Are the beliefs this part holds ones you chose, or ones you absorbed from others?',
      'What might this part have needed to take on this role for you?',
    ],
  },
  permissions: {
    title: 'Permissions',
    prompt: '',
    profileField: 'consent_given',
    writePlaceholder:
      'Has this part given any consent or willingness to allow deeper exploration? Note what you sense.',
    additionalFields: [
      {
        label: 'Safety needs',
        field: 'safety_needs',
        placeholder:
          'What would this part need to feel safe enough to allow more contact?',
      },
      {
        label: 'Agreement requested',
        field: 'agreement_requested',
        placeholder:
          'What agreement or commitment does this part want from Self?',
      },
    ],
    exploreDeeper: [
      'Does this part have concerns about going deeper? What are they?',
      'What would this part need to feel safe enough to allow more contact with what it protects?',
      'What agreement or commitment does this part want from Self?',
      'Is this part aware of Self\'s presence — that you are not alone in this?',
    ],
  },
  exile_contact: {
    title: 'Exile Contact',
    prompt: 'What was it like when this part was first witnessed by Self?',
    profileField: 'exile_contact_notes',
    exploreDeeper: [
      'How did this part respond when it felt seen and understood?',
      'What does this part most need to hear from Self?',
      'What is this part carrying that it wants Self to know about?',
      'What does it feel like for this part to not be alone anymore?',
    ],
  },
};

const INHERITANCE_PROMPTS = [
  {
    id: 'family',
    question:    'Is there a family member, caregiver, or significant person from your past that this part reminds you of?',
    followUp:    'What did you absorb from them that this part now carries?',
    memoryTitle: 'Inheritance — family/caregiver',
  },
  {
    id: 'cultural',
    question:    'Is there a cultural message, belief system, or community value that shaped how this part operates?',
    followUp:    'What did that context teach this part about how to survive or belong?',
    memoryTitle: 'Inheritance — cultural/community',
  },
  {
    id: 'character',
    question:    'Is there a character from a book, film, show, or story that this part resembles or was shaped by?',
    followUp:    'What about that character resonated or became a template?',
    memoryTitle: 'Inheritance — character/story',
  },
] as const;

const MEMORY_PROMPTS = [
  'How old does this part feel or seem?',
  'Is there a time when it first showed up?',
  'What was happening in your life when this part took on its role?',
];

// ─── Grounding Overlay ────────────────────────────────────────────────────────

function GroundingOverlay({
  visible,
  onReturn,
  onEndAndSave,
}: {
  visible: boolean;
  onReturn: () => void;
  onEndAndSave: () => void;
}) {
  const breathAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      breathAnim.setValue(1);
      return undefined;
    }
    breathAnim.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1.8, duration: 5000, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 1,   duration: 5000, useNativeDriver: true }),
      ]),
      { iterations: 3 },
    );
    loop.start();
    return () => { loop.stop(); breathAnim.setValue(1); };
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
      <View style={ov.buttons}>
        <Pressable
          style={({ pressed }) => [ov.returnBtn, pressed && { opacity: 0.85 }]}
          onPress={onReturn}
        >
          <Text style={ov.returnBtnText}>I feel steadier — return</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [ov.endBtn, pressed && { opacity: 0.85 }]}
          onPress={onEndAndSave}
        >
          <Text style={ov.endBtnText}>End and save</Text>
        </Pressable>
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
    zIndex: 100,
  },
  headline:     { fontSize: 26, fontWeight: '700', color: '#FFFFFF', marginBottom: 6, textAlign: 'center' },
  subhead:      { fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 24, textAlign: 'center' },
  breathWrapper:{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  circle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  instruction:  { fontSize: 16, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 26, marginBottom: 4 },
  buttons:      { width: '100%', marginTop: 40, gap: 12 },
  returnBtn:    { backgroundColor: '#3B5BA5', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  returnBtnText:{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  endBtn:       { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  endBtnText:   { color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: '500' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GuidedExplorationScreen() {
  const { partId, explorationId } = useLocalSearchParams<{
    partId: string;
    explorationId: string;
  }>();

  const [part, setPart] = useState<PartRow | null>(null);
  const [mainText, setMainText] = useState('');
  const [additionalTexts, setAdditionalTexts] = useState<Record<string, string>>({});
  const [memories, setMemories] = useState<
    { id: string; title: string | null; content: string; created_at: string }[]
  >([]);
  const [promptTexts, setPromptTexts] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [showGrounding, setShowGrounding] = useState(false);
  const [showExploreDeeper, setShowExploreDeeper] = useState(false);
  const [expandedInheritanceCards, setExpandedInheritanceCards] = useState<
    Record<string, boolean>
  >({});

  const explorationIdSafe = (explorationId ?? 'voice_phrases') as ExplorationId;
  const config = EXPLORATION_CONFIG[explorationIdSafe];

  useFocusEffect(
    useCallback(() => {
      if (!partId) return;
      const db = getDatabase();

      db.getFirstAsync<PartRow>(
        `SELECT id, COALESCE(custom_name, name) AS display_name, type
         FROM parts WHERE id = ?`,
        [partId],
      ).then((row) => { if (row) setPart(row); })
        .catch(() => undefined);

      if (config?.profileField) {
        const field = config.profileField;
        // For desires_needs, also fetch gtk_needs_from_self for pre-population
        const extraCol =
          explorationIdSafe === 'desires_needs' ? ', gtk_needs_from_self' : '';
        db.getFirstAsync<Record<string, string | null>>(
          `SELECT ${field}${extraCol} FROM part_profiles WHERE part_id = ?`,
          [partId],
        ).then((row) => {
          const mainVal = row?.[field] ?? '';
          if (mainVal.trim()) {
            setMainText(mainVal);
          } else if (
            explorationIdSafe === 'desires_needs' &&
            row?.['gtk_needs_from_self'] &&
            (row['gtk_needs_from_self'] as string).trim()
          ) {
            setMainText(row['gtk_needs_from_self'] as string);
          } else {
            setMainText(mainVal);
          }
        }).catch(() => undefined);
      }

      // Load tags
      if (config?.tagsField) {
        const tagsField = config.tagsField;
        db.getFirstAsync<Record<string, string | null>>(
          `SELECT ${tagsField} FROM part_profiles WHERE part_id = ?`,
          [partId],
        ).then((row) => {
          const raw = row?.[tagsField];
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as unknown;
              setTags(Array.isArray(parsed) ? (parsed as string[]) : []);
            } catch { setTags([]); }
          }
        }).catch(() => undefined);
      }

      // Load additional fields (e.g. permissions)
      if (config?.additionalFields && config.additionalFields.length > 0) {
        const addFields = config.additionalFields.map((f) => f.field);
        const cols = addFields.join(', ');
        db.getFirstAsync<Record<string, string | null>>(
          `SELECT ${cols} FROM part_profiles WHERE part_id = ?`,
          [partId],
        ).then((row) => {
          if (row) {
            const vals: Record<string, string> = {};
            for (const f of addFields) {
              vals[f] = row[f] ?? '';
            }
            setAdditionalTexts(vals);
          }
        }).catch(() => undefined);
      }

      if (explorationIdSafe === 'memories') {
        db.getAllAsync<{
          id: string;
          title: string | null;
          content: string;
          created_at: string;
        }>(
          `SELECT id, title, content, created_at
           FROM part_memories WHERE part_id = ?
           ORDER BY created_at DESC`,
          [partId],
        ).then((rows) => setMemories(rows ?? []))
          .catch(() => undefined);
      }
    }, [partId, explorationIdSafe]),
  );

  const typeColor     = part ? TYPE_COLOR[part.type] : '#3B5BA5';
  const isMemories    = explorationIdSafe === 'memories';
  const isInheritance = explorationIdSafe === 'part_inheritance';
  const isExile       = part?.type === 'exile';
  const showGround    = isInheritance || (isMemories && isExile);

  // ── Tag operations ────────────────────────────────────────────────────────

  function addTag() {
    const trimmed = tagDraft.trim();
    if (!trimmed || tags.includes(trimmed)) {
      setTagDraft('');
      return;
    }
    const next = [...tags, trimmed];
    setTags(next);
    setTagDraft('');
    saveTagsToDb(next).catch(() => undefined);
  }

  function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    saveTagsToDb(next).catch(() => undefined);
  }

  async function saveTagsToDb(nextTags: string[]) {
    if (!partId || !config?.tagsField) return;
    const db  = getDatabase();
    const now = new Date().toISOString();
    const col  = config.tagsField;
    const json = JSON.stringify(nextTags);
    await db.runAsync(
      `INSERT INTO part_profiles (part_id, ${col}, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(part_id) DO UPDATE SET
         ${col} = excluded.${col},
         updated_at = excluded.updated_at`,
      [partId, json, now],
    );
  }

  // ── Auto-save main text on blur ──────────────────────────────────────────

  async function saveMainText() {
    if (!partId || !config?.profileField) return;
    const db    = getDatabase();
    const now   = new Date().toISOString();
    const field = config.profileField;
    try {
      await db.runAsync(
        `INSERT INTO part_profiles (part_id, ${field}, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(part_id) DO UPDATE SET
           ${field} = excluded.${field},
           updated_at = excluded.updated_at`,
        [partId, mainText.trim() || null, now],
      );
    } catch (e) {
      console.error('[GuidedExploration] saveMainText:', e);
    }
  }

  // ── Auto-save additional field on blur ───────────────────────────────────

  async function saveAdditionalField(field: string, value: string) {
    if (!partId) return;
    const db  = getDatabase();
    const now = new Date().toISOString();
    try {
      await db.runAsync(
        `INSERT INTO part_profiles (part_id, ${field}, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(part_id) DO UPDATE SET
           ${field} = excluded.${field},
           updated_at = excluded.updated_at`,
        [partId, value.trim() || null, now],
      );
    } catch (e) {
      console.error('[GuidedExploration] saveAdditionalField:', e);
    }
  }

  // ── Save free-write memory row on blur ───────────────────────────────────

  const savedFreewriteRef = useRef<string | null>(null);

  async function saveFreewriteMemory() {
    if (!partId || !isMemories) return;
    const content = mainText.trim();
    if (!content || content === savedFreewriteRef.current) return;
    savedFreewriteRef.current = content;
    const db  = getDatabase();
    const now = new Date().toISOString();
    const id  = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      await db.runAsync(
        `INSERT INTO part_memories (id, part_id, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, partId, content, now, now],
      );
      const rows = await db.getAllAsync<{
        id: string; title: string | null; content: string; created_at: string;
      }>(
        `SELECT id, title, content, created_at FROM part_memories
         WHERE part_id = ? ORDER BY created_at DESC`,
        [partId],
      );
      setMemories(rows ?? []);
      setMainText('');
      savedFreewriteRef.current = null;
    } catch (e) {
      console.error('[GuidedExploration] saveFreewriteMemory:', e);
    }
  }

  // ── Save prompted memory on blur ─────────────────────────────────────────

  const savedPromptRefs = useRef<Record<string, string>>({});

  async function savePromptMemory(promptText: string, content: string) {
    if (!partId || !content.trim()) return;
    if (savedPromptRefs.current[promptText] === content.trim()) return;
    savedPromptRefs.current[promptText] = content.trim();
    const db  = getDatabase();
    const now = new Date().toISOString();
    const id  = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      await db.runAsync(
        `INSERT INTO part_memories (id, part_id, title, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, partId, promptText, content.trim(), now, now],
      );
    } catch (e) {
      console.error('[GuidedExploration] savePromptMemory:', e);
    }
  }

  // ── Save all and navigate back ────────────────────────────────────────────

  async function handleSave() {
    if (!partId) { router.back(); return; }
    const db  = getDatabase();
    const now = new Date().toISOString();
    try {
      if (config.profileField) {
        const field = config.profileField;
        await db.runAsync(
          `INSERT INTO part_profiles (part_id, ${field}, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(part_id) DO UPDATE SET
             ${field} = excluded.${field},
             updated_at = excluded.updated_at`,
          [partId, mainText.trim() || null, now],
        );
      }
      // Save free-write as memory if unsaved
      if (isMemories && mainText.trim() && mainText.trim() !== savedFreewriteRef.current) {
        const content = mainText.trim();
        savedFreewriteRef.current = content;
        const memId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await db.runAsync(
          `INSERT INTO part_memories (id, part_id, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [memId, partId, content, now, now],
        );
      }
      await saveTagsToDb(tags);
      // Save additional fields
      if (config.additionalFields) {
        for (const af of config.additionalFields) {
          const val = additionalTexts[af.field] ?? '';
          await db.runAsync(
            `INSERT INTO part_profiles (part_id, ${af.field}, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(part_id) DO UPDATE SET
               ${af.field} = excluded.${af.field},
               updated_at = excluded.updated_at`,
            [partId, val.trim() || null, now],
          );
        }
      }
    } catch (e) {
      console.error('[GuidedExploration] handleSave:', e);
    }
    router.back();
  }

  if (!config) return null;

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Grounding overlay — covers entire screen */}
      <GroundingOverlay
        visible={showGrounding}
        onReturn={() => setShowGrounding(false)}
        onEndAndSave={handleSave}
      />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={18} color="#6B6860" />
        </Pressable>
        <Text style={s.title}>{config.title}</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Prompt / Intro */}
          {isInheritance && config.introTexts ? (
            config.introTexts.map((text, i) => (
              <View key={i} style={s.promptCard}>
                <Text style={s.promptText}>{text}</Text>
              </View>
            ))
          ) : config.prompt ? (
            <View style={s.promptCard}>
              <Text style={s.promptText}>{config.prompt}</Text>
            </View>
          ) : null}

          {/* Tag input */}
          {config.tagsField ? (
            <View style={s.tagBlock}>
              <Text style={[s.tagLabel, { color: typeColor }]}>
                {config.tagLabel ?? 'Quick tags (tap to remove)'}
              </Text>
              <View style={s.tagInputRow}>
                <TextInput
                  style={s.tagInput}
                  value={tagDraft}
                  onChangeText={setTagDraft}
                  placeholder={config.tagPlaceholder ?? 'Type a word or phrase...'}
                  placeholderTextColor="#C5C3BE"
                  returnKeyType="done"
                  onSubmitEditing={addTag}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[s.tagAddBtn, { backgroundColor: typeColor }]}
                  onPress={addTag}
                  activeOpacity={0.8}
                >
                  <Text style={s.tagAddBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
              {tags.length > 0 && (
                <View style={s.tagChips}>
                  {tags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        s.tagChip,
                        { backgroundColor: `${typeColor}26`, borderColor: typeColor },
                      ]}
                      onPress={() => removeTag(tag)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.tagChipText, { color: typeColor }]}>{tag}</Text>
                      <Text style={[s.tagChipX, { color: typeColor }]}>×</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* Main input */}
          <View style={s.inputBlock}>
            <Text style={[s.inputLabel, { color: typeColor }]}>
              {config.writeLabel ?? 'Or write freely...'}
            </Text>
            <TextInput
              style={s.textInput}
              value={mainText}
              onChangeText={setMainText}
              onBlur={isMemories ? saveFreewriteMemory : saveMainText}
              multiline
              placeholder={
                config.writePlaceholder ??
                (isMemories
                  ? 'Write freely about any memories that come up…'
                  : 'Your thoughts here…')
              }
              placeholderTextColor="#C5C3BE"
              textAlignVertical="top"
            />
          </View>

          {/* Additional fields (permissions etc.) */}
          {config.additionalFields && config.additionalFields.map((af) => (
            <View key={af.field} style={s.inputBlock}>
              <Text style={[s.inputLabel, { color: typeColor }]}>{af.label}</Text>
              <TextInput
                style={s.textInput}
                value={additionalTexts[af.field] ?? ''}
                onChangeText={(v) =>
                  setAdditionalTexts((prev) => ({ ...prev, [af.field]: v }))
                }
                onBlur={() =>
                  saveAdditionalField(af.field, additionalTexts[af.field] ?? '')
                }
                multiline
                placeholder={af.placeholder}
                placeholderTextColor="#C5C3BE"
                textAlignVertical="top"
              />
            </View>
          ))}

          {/* Explore deeper — collapsible read-only prompt cards */}
          {config.exploreDeeper && config.exploreDeeper.length > 0 && (
            <View style={s.exploreDeeperBlock}>
              <TouchableOpacity
                style={s.exploreDeeperHeader}
                onPress={() => setShowExploreDeeper((prev) => !prev)}
                activeOpacity={0.75}
              >
                <Text style={s.exploreDeeperTitle}>Explore deeper</Text>
                <Ionicons
                  name={showExploreDeeper ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#6B6860"
                />
              </TouchableOpacity>
              {showExploreDeeper && (
                <View style={s.exploreDeeperCards}>
                  {config.exploreDeeper.map((prompt, i) => (
                    <View key={i} style={s.exploreDeeperCard}>
                      <Text style={s.exploreDeeperText}>{prompt}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Inheritance expandable prompt cards */}
          {isInheritance && (
            <View style={s.promptedBlock}>
              <Text style={s.promptedHeader}>Some things to consider (optional)</Text>
              {INHERITANCE_PROMPTS.map((prompt) => {
                const isExpanded = expandedInheritanceCards[prompt.id] ?? false;
                return (
                  <View key={prompt.id} style={s.inheritanceCard}>
                    <Pressable
                      style={s.inheritanceCardHeader}
                      onPress={() =>
                        setExpandedInheritanceCards((prev) => ({
                          ...prev,
                          [prompt.id]: !prev[prompt.id],
                        }))
                      }
                    >
                      <Text style={s.inheritanceCardQuestion}>{prompt.question}</Text>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="#6B6860"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                    </Pressable>
                    {isExpanded && (
                      <View style={s.inheritanceCardExpanded}>
                        <Text style={s.promptedQuestion}>{prompt.followUp}</Text>
                        <TextInput
                          style={s.promptedInput}
                          value={promptTexts[prompt.memoryTitle] ?? ''}
                          onChangeText={(v) =>
                            setPromptTexts((prev) => ({
                              ...prev,
                              [prompt.memoryTitle]: v,
                            }))
                          }
                          onBlur={() =>
                            savePromptMemory(
                              prompt.memoryTitle,
                              promptTexts[prompt.memoryTitle] ?? '',
                            )
                          }
                          multiline
                          placeholder="Your reflection…"
                          placeholderTextColor="#C5C3BE"
                          textAlignVertical="top"
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Prompted memory inputs — memories only */}
          {isMemories && (
            <View style={s.promptedBlock}>
              <Text style={s.promptedHeader}>Guided reflections</Text>
              <Text style={s.promptedSub}>
                Optional — explore at your own pace
              </Text>
              {MEMORY_PROMPTS.map((prompt) => (
                <View key={prompt} style={s.promptedItem}>
                  <Text style={s.promptedQuestion}>{prompt}</Text>
                  <TextInput
                    style={s.promptedInput}
                    value={promptTexts[prompt] ?? ''}
                    onChangeText={(v) =>
                      setPromptTexts((prev) => ({ ...prev, [prompt]: v }))
                    }
                    onBlur={() =>
                      savePromptMemory(prompt, promptTexts[prompt] ?? '')
                    }
                    multiline
                    placeholder="Your reflection…"
                    placeholderTextColor="#C5C3BE"
                    textAlignVertical="top"
                  />
                </View>
              ))}
            </View>
          )}

          {/* Saved memories list — memories only */}
          {isMemories && memories.length > 0 && (
            <View style={s.memoriesBlock}>
              <Text style={s.memoriesHeader}>Saved memories</Text>
              {memories.map((mem) => {
                const dateStr = mem.created_at
                  ? new Date(mem.created_at).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })
                  : '';
                return (
                  <View key={mem.id} style={s.memoryCard}>
                    {mem.title && (
                      <Text style={s.memoryTitle}>{mem.title}</Text>
                    )}
                    <Text style={s.memoryContent}>{mem.content}</Text>
                    {dateStr && (
                      <Text style={s.memoryDate}>{dateStr}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating ground button — exile memories only, above Save button */}
      {showGround && (
        <TouchableOpacity
          style={s.groundFloating}
          onPress={() => setShowGrounding(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="shield-outline" size={22} color="#FFFFFF" />
          <Text style={s.groundFloatingLabel}>Ground</Text>
        </TouchableOpacity>
      )}

      {/* Save button — pinned to bottom */}
      <View style={s.saveBar}>
        <TouchableOpacity
          onPress={handleSave}
          style={s.saveBtn}
          activeOpacity={0.85}
        >
          <Text style={s.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#FAFAF8' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
    backgroundColor: '#FFFFFF',
  },
  backBtn:     { padding: 4 },
  title:       { fontSize: 18, fontWeight: '700', color: '#1C1B19' },

  scroll:        { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100, gap: 16 },

  promptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E3DE',
  },
  promptText: { fontSize: 15, color: '#6B6860', lineHeight: 23 },

  // Tag input
  tagBlock:    { gap: 8 },
  tagLabel:    { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  tagInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  tagInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1C1B19',
  },
  tagAddBtn: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagAddBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  tagChips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagChipText: { fontSize: 14, fontWeight: '500' },
  tagChipX:    { fontSize: 16, fontWeight: '400', marginTop: -1 },

  inputBlock: { gap: 8 },
  inputLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 14,
    fontSize: 15,
    color: '#1C1B19',
    minHeight: 120,
    lineHeight: 22,
  },

  // Explore deeper collapsible
  exploreDeeperBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    overflow: 'hidden',
  },
  exploreDeeperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  exploreDeeperTitle: { fontSize: 15, fontWeight: '600', color: '#1C1B19' },
  exploreDeeperCards: { gap: 8, padding: 12, paddingTop: 4 },
  exploreDeeperCard: {
    backgroundColor: '#F5F4F1',
    borderRadius: 8,
    padding: 12,
  },
  exploreDeeperText: { fontSize: 14, color: '#6B6860', lineHeight: 20 },

  promptedBlock: { gap: 12 },
  promptedHeader: { fontSize: 16, fontWeight: '600', color: '#1C1B19' },
  promptedSub: { fontSize: 13, color: '#A09D96', marginTop: -8 },
  promptedItem: { gap: 8 },
  promptedQuestion: { fontSize: 14, fontWeight: '500', color: '#6B6860', lineHeight: 20 },
  promptedInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 12,
    fontSize: 15,
    color: '#1C1B19',
    minHeight: 80,
    lineHeight: 22,
  },

  // Inheritance expandable cards
  inheritanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    overflow: 'hidden',
  },
  inheritanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 14,
    gap: 10,
  },
  inheritanceCardQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#6B6860',
    lineHeight: 20,
  },
  inheritanceCardExpanded: {
    borderTopWidth: 1,
    borderTopColor: '#E5E3DE',
    padding: 14,
    gap: 10,
  },

  memoriesBlock: { gap: 10 },
  memoriesHeader: { fontSize: 16, fontWeight: '600', color: '#1C1B19' },
  memoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 14,
    gap: 6,
  },
  memoryTitle:   { fontSize: 13, fontWeight: '600', color: '#6B6860' },
  memoryContent: { fontSize: 15, color: '#1C1B19', lineHeight: 22 },
  memoryDate:    { fontSize: 12, color: '#A09D96' },

  // Floating ground button
  groundFloating: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    zIndex: 50,
    backgroundColor: '#6B6860',
    borderRadius: 28,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  groundFloatingLabel: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },

  // Save bar
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#FAFAF8',
    borderTopWidth: 1,
    borderTopColor: '#E5E3DE',
    elevation: 8,
    zIndex: 999,
  },
  saveBtn: {
    backgroundColor: '#3B5BA5',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
