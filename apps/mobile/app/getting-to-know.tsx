/**
 * Getting to Know
 * Route: /getting-to-know?partId=[id]&stageId=[1|2|3]
 *
 * Three-stage progressive exploration of a single part.
 * Stage 1: First Contact
 * Stage 2: Getting Acquainted
 * Stage 3: The Deeper Story
 *
 * Each stage renders prompt cards. Auto-saves on blur.
 * Save button pinned to bottom, outside ScrollView.
 */

import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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

type StageId = '1' | '2' | '3';

interface PromptConfig {
  question: string;
  field: string;
}

interface StageConfig {
  title: string;
  stageLabel: string;
  accentColor: string;
  prompts: PromptConfig[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<StageId, StageConfig> = {
  '1': {
    title: 'First Contact',
    stageLabel: 'Stage 1 of 3',
    accentColor: '#1E3A5F',
    prompts: [
      {
        question:
          'How do you first notice this part? Where in your body, or how does it show up in your mind?',
        field: 'body_location',
      },
      {
        question:
          'What is your first impression of this part — its energy, presence, or quality?',
        field: 'gtk_first_impression',
      },
      {
        question: 'What does this part seem to want you to know, right now?',
        field: 'part_perspective',
      },
      {
        question: 'How do you feel toward this part as you turn toward it?',
        field: 'feel_towards',
      },
    ],
  },
  '2': {
    title: 'Getting Acquainted',
    stageLabel: 'Stage 2 of 3',
    accentColor: '#0F766E',
    prompts: [
      {
        question: 'What does this part do — what is its job in your system?',
        field: 'job',
      },
      {
        question:
          'What does this part most want to protect you from, or what does it most fear would happen?',
        field: 'fears',
      },
      {
        question: 'What does this part most need from you right now?',
        field: 'gtk_needs_from_self',
      },
      {
        question: 'How does this part feel toward you — toward Self?',
        field: 'gtk_relationship_quality',
      },
      {
        question: 'What activates or triggers this part most?',
        field: 'key_trigger',
      },
      {
        question:
          'How does this part express itself — through thoughts, feelings, actions, body sensations?',
        field: 'behavioral_patterns',
      },
      {
        question: 'What does this part seem most concerned or worried about?',
        field: 'gtk_concerns',
      },
    ],
  },
  '3': {
    title: 'The Deeper Story',
    stageLabel: 'Stage 3 of 3',
    accentColor: '#7C3D9B',
    prompts: [
      {
        question:
          'When did this part first appear in your life, or when do you think it took on this role?',
        field: 'developmental_history',
      },
      {
        question:
          'What does this part seem to be carrying — a belief, a wound, or an old experience?',
        field: 'gtk_what_carries',
      },
      {
        question:
          'What has it been like for this part to carry this role for so long?',
        field: 'gtk_origin_wound',
      },
      {
        question:
          'What would this part look like if it was no longer needed in this role?',
        field: 'gtk_unburdened_vision',
      },
      {
        question:
          'What gift or quality might this part bring to your system if it were freed from its burden?',
        field: 'gift_description',
      },
    ],
  },
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GettingToKnowScreen() {
  const { partId, stageId } = useLocalSearchParams<{
    partId: string;
    stageId: string;
  }>();

  const stageIdSafe: StageId = (stageId as StageId) ?? '1';
  const config = STAGE_CONFIG[stageIdSafe];

  const [partName, setPartName] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      if (!partId || !config) return;
      const db = getDatabase();

      db.getFirstAsync<{ display_name: string }>(
        `SELECT COALESCE(custom_name, name) AS display_name FROM parts WHERE id = ?`,
        [partId],
      )
        .then((row) => { if (row) setPartName(row.display_name); })
        .catch(() => undefined);

      const fields = config.prompts.map((p) => p.field);
      const cols = fields.join(', ');
      db.getFirstAsync<Record<string, string | null>>(
        `SELECT ${cols} FROM part_profiles WHERE part_id = ?`,
        [partId],
      )
        .then((row) => {
          const values: Record<string, string> = {};
          for (const field of fields) {
            values[field] = row?.[field] ?? '';
          }
          setFieldValues(values);
        })
        .catch(() => undefined);
    }, [partId, stageIdSafe]),
  );

  async function saveField(field: string, value: string) {
    if (!partId) return;
    const db = getDatabase();
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
      console.error('[GettingToKnow] saveField:', e);
    }
  }

  async function handleSave() {
    if (!partId) { router.back(); return; }
    const db = getDatabase();
    const now = new Date().toISOString();
    try {
      for (const prompt of config.prompts) {
        const value = fieldValues[prompt.field] ?? '';
        await db.runAsync(
          `INSERT INTO part_profiles (part_id, ${prompt.field}, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(part_id) DO UPDATE SET
             ${prompt.field} = excluded.${prompt.field},
             updated_at = excluded.updated_at`,
          [partId, value.trim() || null, now],
        );
      }
    } catch (e) {
      console.error('[GettingToKnow] handleSave:', e);
    }
    router.back();
  }

  if (!config) return null;

  const { accentColor, title, stageLabel } = config;

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: accentColor }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={s.backBtn}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={18} color="#6B6860" />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Stage banner */}
      <View style={[s.stageBanner, { backgroundColor: accentColor }]}>
        <Text style={s.stageBannerLabel}>{stageLabel}</Text>
        {partName ? (
          <Text style={s.stageBannerPart} numberOfLines={1}>
            {partName}
          </Text>
        ) : null}
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
          {config.prompts.map((prompt) => (
            <View key={prompt.field} style={s.cardWrapper}>
              <View style={s.card}>
                <View
                  style={[s.accentBar, { backgroundColor: accentColor }]}
                />
                <View style={s.cardBody}>
                  <Text style={s.cardQuestion}>{prompt.question}</Text>
                  <TextInput
                    style={s.cardInput}
                    value={fieldValues[prompt.field] ?? ''}
                    onChangeText={(v) =>
                      setFieldValues((prev) => ({
                        ...prev,
                        [prompt.field]: v,
                      }))
                    }
                    onBlur={() =>
                      saveField(
                        prompt.field,
                        fieldValues[prompt.field] ?? '',
                      )
                    }
                    multiline
                    textAlignVertical="top"
                    placeholder="Your thoughts here…"
                    placeholderTextColor="#C5C3BE"
                  />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Save button — pinned to bottom outside ScrollView */}
      <View style={s.saveBar}>
        <TouchableOpacity
          onPress={handleSave}
          style={[s.saveBtn, { backgroundColor: accentColor }]}
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
  root: { flex: 1, backgroundColor: '#FAFAF8' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  backBtn: { padding: 4 },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1B19',
    flex: 1,
    textAlign: 'center',
  },

  stageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  stageBannerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stageBannerPart: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100, gap: 16 },

  cardWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderRadius: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardBody: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  cardQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1B19',
    lineHeight: 22,
  },
  cardInput: {
    backgroundColor: '#F5F4F1',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    padding: 12,
    fontSize: 15,
    color: '#1C1B19',
    minHeight: 80,
    lineHeight: 22,
  },

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
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
