/**
 * Elaboration Session
 * Route: /elaboration-session?partId=[id]&elaborationId=[id]
 *
 * Ground button: required from Step 2 (appearance) onward IF part type is 'exile'.
 * Not shown for Manager/Firefighter parts.
 *
 * Steps (11 total):
 *   1. arrival        — no ground button
 *   2. appearance     — saves to part_profiles.appearance
 *   3. location       — saves to part_profiles.body_location
 *   4. job            — saves to part_profiles.job
 *   5. origins        — saves to part_profiles.origin_story
 *   6. beliefs        — saves to part_profiles.beliefs
 *   7. fears          — saves to part_profiles.fears
 *   8. relationship   — saves to part_profiles.relationship_to_self
 *   9. burdens        — saves to part_profiles.burdens
 *  10. gifts          — saves to part_profiles.gifts
 *  11. closing        — saves feel_towards, completes session
 *
 * DB: Creates elaboration_sessions row on mount, updates on completion/exit.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getDatabase } from '@/lib/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type StepId =
  | 'arrival'
  | 'appearance'
  | 'location'
  | 'job'
  | 'origins'
  | 'beliefs'
  | 'fears'
  | 'relationship'
  | 'burdens'
  | 'gifts'
  | 'closing';

type PartType = 'manager' | 'firefighter' | 'exile' | 'self';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_ORDER: StepId[] = [
  'arrival', 'appearance', 'location', 'job', 'origins',
  'beliefs', 'fears', 'relationship', 'burdens', 'gifts', 'closing',
];

const STEP_DOT: Record<StepId, number> = {
  arrival:      0,
  appearance:   1,
  location:     2,
  job:          3,
  origins:      4,
  beliefs:      5,
  fears:        6,
  relationship: 7,
  burdens:      8,
  gifts:        9,
  closing:      10,
};

const TOTAL_DOTS = 11;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Step Dots ────────────────────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  return (
    <View style={dotSt.row}>
      {Array.from({ length: TOTAL_DOTS }).map((_, i) => (
        <View
          key={i}
          style={[
            dotSt.dot,
            i === current ? dotSt.active : i < current ? dotSt.past : dotSt.future,
          ]}
        />
      ))}
    </View>
  );
}

const dotSt = StyleSheet.create({
  row:    { flexDirection: 'row', gap: 5, justifyContent: 'center', paddingVertical: 14 },
  dot:    { height: 7, borderRadius: 4, width: 7 },
  active: { backgroundColor: 'rgba(255,255,255,0.9)', width: 16 },
  past:   { backgroundColor: 'rgba(255,255,255,0.35)' },
  future: { backgroundColor: 'rgba(255,255,255,0.12)' },
});

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
          <Text style={ov.returnBtnText}>I feel steadier — return to elaboration</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [ov.endBtn, pressed && { opacity: 0.85 }]}
          onPress={onEndAndSave}
        >
          <Text style={ov.endBtnText}>End elaboration and save</Text>
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
  headline:      { fontSize: 26, fontWeight: '700', color: '#FFFFFF', marginBottom: 6, textAlign: 'center' },
  subhead:       { fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 24, textAlign: 'center' },
  breathWrapper: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  circle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  instruction:   { fontSize: 16, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 26, marginBottom: 4 },
  buttons:       { width: '100%', marginTop: 40, gap: 12 },
  returnBtn:     { backgroundColor: '#3B5BA5', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  returnBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  endBtn:        { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  endBtnText:    { color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: '500' },
});

// ─── Shared sub-components ────────────────────────────────────────────────────

function ReflectionInput({
  placeholder,
  value,
  onChangeText,
}: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
}) {
  return (
    <TextInput
      style={shared.input}
      placeholder={placeholder}
      placeholderTextColor="rgba(255,255,255,0.3)"
      multiline
      textAlignVertical="top"
      value={value}
      onChangeText={onChangeText}
    />
  );
}

function ContinueBtn({
  label = 'Continue',
  onPress,
  disabled = false,
}: {
  label?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        shared.continueBtn,
        disabled && shared.continueBtnDisabled,
        pressed && !disabled && { opacity: 0.85 },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={shared.continueBtnText}>{label}</Text>
    </Pressable>
  );
}

const shared = StyleSheet.create({
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 88,
  },
  continueBtn:         { backgroundColor: '#3B5BA5', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  continueBtnDisabled: { opacity: 0.35 },
  continueBtnText:     { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ElaborationSessionScreen() {
  const { partId, elaborationId } = useLocalSearchParams<{
    partId: string;
    elaborationId?: string;
  }>();

  const [sessionId]  = useState(() => elaborationId ?? generateId());
  const [startedAt]  = useState(() => nowIso());
  const sessionRowInserted = useRef(!!elaborationId);
  const sessionCompleted   = useRef(false);

  const [partName, setPartName] = useState('');
  const [partType, setPartType] = useState<PartType>('manager');

  const [stepId, setStepId]           = useState<StepId>('arrival');
  const [stepHistory, setStepHistory] = useState<StepId[]>([]);

  // Step inputs
  const [appearance,       setAppearance]       = useState('');
  const [bodyLocation,     setBodyLocation]     = useState('');
  const [job,              setJob]              = useState('');
  const [originStory,      setOriginStory]      = useState('');
  const [beliefs,          setBeliefs]          = useState('');
  const [fears,            setFears]            = useState('');
  const [relationshipSelf, setRelationshipSelf] = useState('');
  const [burdens,          setBurdens]          = useState('');
  const [gifts,            setGifts]            = useState('');
  const [feelTowards,      setFeelTowards]      = useState('');

  const [showGrounding, setShowGrounding] = useState(false);

  // ── Load part info ──────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      if (!partId) return;
      const db = getDatabase();
      db.getFirstAsync<{ display_name: string; type: string }>(
        `SELECT COALESCE(custom_name, name) AS display_name, type FROM parts WHERE id = ?`,
        [partId],
      ).then((row) => {
        if (row) {
          setPartName(row.display_name);
          setPartType(row.type as PartType);
        }
      }).catch(() => undefined);
    }, [partId]),
  );

  // ── Resume existing session ─────────────────────────────────────────────────

  useEffect(() => {
    if (!elaborationId) return;
    const db = getDatabase();
    db.getFirstAsync<{ steps_json: string | null }>(
      `SELECT steps_json FROM elaboration_sessions WHERE id = ?`,
      [elaborationId],
    ).then((row) => {
      if (!row?.steps_json) return;
      try {
        const s = JSON.parse(row.steps_json) as Record<string, string | null>;
        if (s.appearance)            setAppearance(s.appearance);
        if (s.body_location)         setBodyLocation(s.body_location);
        if (s.job)                   setJob(s.job);
        if (s.origin_story)          setOriginStory(s.origin_story);
        if (s.beliefs)               setBeliefs(s.beliefs);
        if (s.fears)                 setFears(s.fears);
        if (s.relationship_to_self)  setRelationshipSelf(s.relationship_to_self);
        if (s.burdens)               setBurdens(s.burdens);
        if (s.gifts)                 setGifts(s.gifts);
        if (s.feel_towards)          setFeelTowards(s.feel_towards);

        // Resume at first unfilled step
        const order: { id: StepId; key: string }[] = [
          { id: 'appearance',   key: 'appearance'          },
          { id: 'location',     key: 'body_location'       },
          { id: 'job',          key: 'job'                 },
          { id: 'origins',      key: 'origin_story'        },
          { id: 'beliefs',      key: 'beliefs'             },
          { id: 'fears',        key: 'fears'               },
          { id: 'relationship', key: 'relationship_to_self'},
          { id: 'burdens',      key: 'burdens'             },
          { id: 'gifts',        key: 'gifts'               },
          { id: 'closing',      key: 'feel_towards'        },
        ];
        let resumeStep: StepId = 'arrival';
        for (const { id, key } of order) {
          if (!s[key]) { resumeStep = id; break; }
          resumeStep = id; // keep advancing; if all filled → land on last
        }
        // If all fields filled, resume at closing
        if (order.every(({ key }) => !!s[key])) resumeStep = 'closing';
        setStepId(resumeStep);
      } catch { /* noop */ }
    }).catch(() => undefined);
  }, [elaborationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create session row on mount ─────────────────────────────────────────────

  useEffect(() => {
    if (!partId || sessionRowInserted.current) return;
    sessionRowInserted.current = true;
    const db = getDatabase();
    db.runAsync(
      `INSERT INTO elaboration_sessions
         (id, part_id, steps_json, status, started_at)
       VALUES (?, ?, '{}', 'in_progress', ?)`,
      [sessionId, partId, startedAt],
    ).catch((e) => console.error('[ElaborationSession] insert:', e));
  }, [partId, sessionId, startedAt]);

  // ── DB helpers ──────────────────────────────────────────────────────────────

  async function saveProfileField(field: string, value: string) {
    if (!partId) return;
    const db  = getDatabase();
    const now = nowIso();
    await db.runAsync(
      // field name comes from internal constants only — never user input
      `INSERT INTO part_profiles (part_id, ${field}, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(part_id) DO UPDATE SET
         ${field} = excluded.${field},
         updated_at = excluded.updated_at`,
      [partId, value.trim() || null, now],
    );
  }

  async function saveSession(status: 'in_progress' | 'completed') {
    if (sessionCompleted.current) return;
    sessionCompleted.current = true;

    const stepsJson = JSON.stringify({
      appearance,
      body_location:        bodyLocation,
      job,
      origin_story:         originStory,
      beliefs,
      fears,
      relationship_to_self: relationshipSelf,
      burdens,
      gifts,
      feel_towards:         feelTowards,
    });

    const db = getDatabase();
    await db.runAsync(
      `UPDATE elaboration_sessions
       SET status = ?, steps_json = ?, completed_at = ?
       WHERE id = ?`,
      [status, stepsJson, status === 'completed' ? nowIso() : null, sessionId],
    );

    if (status === 'completed') {
      await db.runAsync(
        `UPDATE parts SET is_elaborated = 1, updated_at = ? WHERE id = ?`,
        [nowIso(), partId],
      ).catch(() => undefined);
    }
  }

  // ── Exit handlers ───────────────────────────────────────────────────────────

  function handleExitConfirm() {
    Alert.alert(
      'End this elaboration?',
      'Your progress has been saved.',
      [
        { text: 'Continue Elaborating', style: 'cancel' },
        {
          text: 'End & Save',
          onPress: async () => {
            await saveSession('in_progress');
            router.replace(`/part-profile?id=${partId}`);
          },
        },
      ],
    );
  }

  async function handleGroundEndAndSave() {
    await saveSession('in_progress');
    router.replace(`/part-profile?id=${partId}`);
  }

  // ── Step navigation ─────────────────────────────────────────────────────────

  function navigateToStep(next: StepId) {
    setStepHistory((prev) => [...prev, stepId]);
    setStepId(next);
  }

  function handleBack() {
    if (stepHistory.length > 0) {
      const prev = stepHistory[stepHistory.length - 1];
      setStepHistory((h) => h.slice(0, -1));
      setStepId(prev);
    } else {
      handleExitConfirm();
    }
  }

  // ── Android hardware back ───────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (stepHistory.length > 0) {
          const prev = stepHistory[stepHistory.length - 1];
          setStepHistory((h) => h.slice(0, -1));
          setStepId(prev);
          return true;
        }
        handleExitConfirm();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stepHistory]),
  );

  // ── Step helpers ────────────────────────────────────────────────────────────

  async function continueWithField(field: string | null, value: string, next: StepId) {
    if (field) {
      await saveProfileField(field, value).catch(() => undefined);
    }
    navigateToStep(next);
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const showGroundButton = partType === 'exile' && stepId !== 'arrival';
  const currentDot       = STEP_DOT[stepId];

  // ── Step renderers ──────────────────────────────────────────────────────────

  function renderArrival() {
    return (
      <View style={sc.card}>
        <Text style={sc.eyebrow}>ELABORATION</Text>
        <Text style={sc.heading}>
          You're going to spend some time getting to know {partName || 'this part'} more deeply.
        </Text>
        <Text style={sc.body}>
          There are no right answers here — just curiosity and presence.
        </Text>
        <Text style={sc.body}>
          Take a breath and turn your attention inward.
        </Text>
        <ContinueBtn onPress={() => navigateToStep('appearance')} />
      </View>
    );
  }

  function renderAppearance() {
    return (
      <View style={sc.card}>
        <Text style={sc.heading}>
          When you sense {partName || 'this part'}, what do you notice?
        </Text>
        <Text style={sc.body}>
          Does it have a shape, a color, a texture, an image, or a felt sense in your body?
        </Text>
        <ReflectionInput
          placeholder="Describe what you notice…"
          value={appearance}
          onChangeText={setAppearance}
        />
        <ContinueBtn
          onPress={() => continueWithField('appearance', appearance, 'location')}
        />
      </View>
    );
  }

  function renderLocation() {
    return (
      <View style={sc.card}>
        <Text style={sc.heading}>
          Where do you feel {partName || 'this part'} in your body?
        </Text>
        <Text style={sc.body}>
          Is there a place it tends to show up — chest, stomach, shoulders, throat?
        </Text>
        <ReflectionInput
          placeholder="A body location or sensation…"
          value={bodyLocation}
          onChangeText={setBodyLocation}
        />
        <ContinueBtn
          onPress={() => continueWithField('body_location', bodyLocation, 'job')}
        />
      </View>
    );
  }

  function renderJob() {
    return (
      <View style={sc.card}>
        <Text style={sc.heading}>
          What is {partName || 'this part'} trying to do for you?
        </Text>
        <Text style={sc.body}>
          What does it believe its job is?
        </Text>
        <ReflectionInput
          placeholder="Its role or intention…"
          value={job}
          onChangeText={setJob}
        />
        <ContinueBtn
          onPress={() => continueWithField('job', job, 'origins')}
        />
      </View>
    );
  }

  function renderOrigins() {
    return (
      <View style={sc.card}>
        <Text style={sc.heading}>
          How long has {partName || 'this part'} been around?
        </Text>
        <Text style={sc.body}>
          Is there a sense of when it first showed up or what called it into being?
        </Text>
        <ReflectionInput
          placeholder="A time, a memory, a sense…"
          value={originStory}
          onChangeText={setOriginStory}
        />
        <ContinueBtn
          onPress={() => continueWithField('origin_story', originStory, 'beliefs')}
        />
      </View>
    );
  }

  function renderBeliefs() {
    return (
      <View style={sc.card}>
        <Text style={sc.heading}>
          What does {partName || 'this part'} believe?
        </Text>
        <Text style={sc.body}>
          About you, about the world, about what will happen if it stops doing its job?
        </Text>
        <ReflectionInput
          placeholder="What it believes to be true…"
          value={beliefs}
          onChangeText={setBeliefs}
        />
        <ContinueBtn
          onPress={() => continueWithField('beliefs', beliefs, 'fears')}
        />
      </View>
    );
  }

  function renderFears() {
    return (
      <View style={sc.card}>
        <Text style={sc.heading}>
          What is {partName || 'this part'} most afraid of?
        </Text>
        <Text style={sc.body}>
          What is it working to prevent?
        </Text>
        <ReflectionInput
          placeholder="What it worries will happen…"
          value={fears}
          onChangeText={setFears}
        />
        <ContinueBtn
          onPress={() => continueWithField('fears', fears, 'relationship')}
        />
      </View>
    );
  }

  function renderRelationship() {
    return (
      <View style={sc.card}>
        <Text style={sc.heading}>
          How does {partName || 'this part'} feel about you?
        </Text>
        <Text style={sc.body}>
          About the part of you that is here, noticing it right now.
        </Text>
        <Text style={sc.body}>
          Does it trust you? Is it skeptical? Relieved? Distant?
        </Text>
        <ReflectionInput
          placeholder="How it feels toward you…"
          value={relationshipSelf}
          onChangeText={setRelationshipSelf}
        />
        <ContinueBtn
          onPress={() => continueWithField('relationship_to_self', relationshipSelf, 'burdens')}
        />
      </View>
    );
  }

  function renderBurdens() {
    return (
      <View style={sc.card}>
        <Text style={sc.heading}>
          What has {partName || 'this part'} been carrying?
        </Text>
        <Text style={sc.body}>
          What beliefs, feelings, or responsibilities has it taken on that feel heavy?
        </Text>
        <ReflectionInput
          placeholder="What it carries…"
          value={burdens}
          onChangeText={setBurdens}
        />
        <ContinueBtn
          onPress={() => continueWithField('burdens', burdens, 'gifts')}
        />
      </View>
    );
  }

  function renderGifts() {
    return (
      <View style={sc.card}>
        <Text style={sc.heading}>
          If {partName || 'this part'} didn't have to work so hard — if it could just be itself — what might it offer?
        </Text>
        <Text style={sc.body}>
          What are its natural gifts or qualities?
        </Text>
        <ReflectionInput
          placeholder="What it could offer…"
          value={gifts}
          onChangeText={setGifts}
        />
        <ContinueBtn
          onPress={() => continueWithField('gifts', gifts, 'closing')}
        />
      </View>
    );
  }

  function renderClosing() {
    return (
      <View style={sc.card}>
        <Text style={sc.heading}>
          You've spent real time with {partName || 'this part'} today.
        </Text>
        <Text style={sc.body}>
          What you've learned here lives in this part's profile — you can return and add more anytime.
        </Text>

        <Text style={sc.prompt}>
          How do you feel toward {partName || 'this part'} now?
        </Text>
        <ReflectionInput
          placeholder="How you feel toward it now… (optional)"
          value={feelTowards}
          onChangeText={setFeelTowards}
        />

        <ContinueBtn
          label="Complete"
          onPress={async () => {
            if (feelTowards.trim()) {
              await saveProfileField('feel_towards', feelTowards).catch(() => undefined);
            }
            await saveSession('completed');
            router.replace(`/part-profile?id=${partId}`);
          }}
        />
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={ms.root} edges={['top', 'bottom']}>
      {/* Grounding overlay — covers entire screen */}
      <GroundingOverlay
        visible={showGrounding}
        onReturn={() => setShowGrounding(false)}
        onEndAndSave={handleGroundEndAndSave}
      />

      {/* Header */}
      <View style={ms.header}>
        <Pressable onPress={handleBack} hitSlop={12} style={ms.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.7)" />
        </Pressable>
        <Text style={ms.headerTitle} numberOfLines={1}>
          {partName ? `Elaboration — ${partName}` : 'Elaboration'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Step dots */}
      <StepDots current={currentDot} />

      {/* Content */}
      <KeyboardAvoidingView
        style={ms.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={ms.scroll}
          contentContainerStyle={ms.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {stepId === 'arrival'      && renderArrival()}
          {stepId === 'appearance'   && renderAppearance()}
          {stepId === 'location'     && renderLocation()}
          {stepId === 'job'          && renderJob()}
          {stepId === 'origins'      && renderOrigins()}
          {stepId === 'beliefs'      && renderBeliefs()}
          {stepId === 'fears'        && renderFears()}
          {stepId === 'relationship' && renderRelationship()}
          {stepId === 'burdens'      && renderBurdens()}
          {stepId === 'gifts'        && renderGifts()}
          {stepId === 'closing'      && renderClosing()}
        </ScrollView>

        {/* Ground button — exile parts from step 2 onward */}
        {showGroundButton && (
          <View style={ms.groundRow}>
            <Pressable
              style={({ pressed }) => [ms.groundBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setShowGrounding(true)}
            >
              <Ionicons name="shield-outline" size={14} color="#FFFFFF" />
              <Text style={ms.groundBtnText}>Ground</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Step card shared styles ──────────────────────────────────────────────────

const sc = StyleSheet.create({
  card: {
    gap: 16,
    paddingBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 32,
  },
  body: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 26,
  },
  prompt: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 23,
    marginTop: 4,
  },
});

// ─── Screen-level styles ──────────────────────────────────────────────────────

const ms = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A1917' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn:     { padding: 4 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },

  kav:           { flex: 1 },
  scroll:        { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 40 },

  groundRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  groundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#6B6860',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  groundBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
});

// Keep STEP_ORDER in module scope for potential reuse
void STEP_ORDER;
