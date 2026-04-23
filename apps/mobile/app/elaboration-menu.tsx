/**
 * Elaboration Menu
 * Route: /elaboration-menu?partId=[id]
 *
 * Hub for all elaboration activities for a single part.
 * Section A: Getting to Know (3 stages)
 * Section B: Descriptor Explorers (word selection)
 * Section C: Guided Explorations (freetext)
 */

import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
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

interface ProfileRow {
  // Existing guided exploration fields
  elaboration_data_json: string | null;
  voice_phrases: string | null;
  desires: string | null;
  behavioral_patterns: string | null;
  fears: string | null;
  beliefs: string | null;
  strengths: string | null;
  weaknesses: string | null;
  inheritance_notes: string | null;
  // Getting to Know — Stage 1
  body_location: string | null;
  gtk_first_impression: string | null;
  part_perspective: string | null;
  feel_towards: string | null;
  // Getting to Know — Stage 2
  job: string | null;
  key_trigger: string | null;
  gtk_needs_from_self: string | null;
  gtk_relationship_quality: string | null;
  gtk_concerns: string | null;
  // Getting to Know — Stage 3
  developmental_history: string | null;
  gtk_what_carries: string | null;
  gtk_origin_wound: string | null;
  gtk_unburdened_vision: string | null;
  gift_description: string | null;
  gtk_gift_to_system: string | null;
  // Guided Exploration v3
  consent_given: string | null;
  safety_needs: string | null;
  agreement_requested: string | null;
  exile_contact_notes: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<PartType, string> = {
  manager:     '#3B5BA5',
  firefighter: '#C2600A',
  exile:       '#7C3D9B',
  self:        '#B88A00',
};

const GETTING_TO_KNOW_STAGES = [
  { id: '1', label: 'Stage 1 — First Contact',      accentColor: '#1E3A5F' },
  { id: '2', label: 'Stage 2 — Getting Acquainted',  accentColor: '#0F766E' },
  { id: '3', label: 'Stage 3 — The Deeper Story',    accentColor: '#7C3D9B' },
] as const;

const DESCRIPTOR_SECTIONS = [
  { id: 'emotions',    label: 'Emotions & Feelings'      },
  { id: 'personality', label: 'Personality Qualities'    },
  { id: 'attitude',    label: 'Attitude & Disposition'   },
  { id: 'appearance',  label: 'Appearance'               },
] as const;

const GUIDED_EXPLORATIONS = [
  { id: 'voice_phrases',       label: 'Voice & Phrases'              },
  { id: 'desires_needs',       label: 'Desires & Needs'              },
  { id: 'behavioral_patterns', label: 'Behavioral Patterns'          },
  { id: 'memories',            label: 'Story, History & Memories'    },
  { id: 'part_inheritance',    label: 'Part Inheritance'             },
  { id: 'world_perspective',   label: 'World Perspective & Beliefs'  },
  { id: 'fears',               label: 'Fears'                        },
  { id: 'strengths',           label: 'Strengths'                    },
  { id: 'weaknesses',          label: 'Weaknesses'                   },
  { id: 'permissions',         label: 'Permissions'                  },
  { id: 'exile_contact',       label: 'Exile Contact'                },
] as const;

type GuidedId = typeof GUIDED_EXPLORATIONS[number]['id'];
type StageId  = typeof GETTING_TO_KNOW_STAGES[number]['id'];

type ElaborationSection = {
  selected: string[];
  custom?: string;
  custom_tags?: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nonEmpty(val: string | null | undefined): boolean {
  return !!(val && val.trim().length > 0);
}

function getStageStatus(
  stageId: StageId,
  profile: ProfileRow | null,
): 'empty' | 'has_notes' {
  if (!profile) return 'empty';
  if (stageId === '1') {
    return (
      nonEmpty(profile.body_location) ||
      nonEmpty(profile.gtk_first_impression) ||
      nonEmpty(profile.part_perspective) ||
      nonEmpty(profile.feel_towards)
    ) ? 'has_notes' : 'empty';
  }
  if (stageId === '2') {
    return (
      nonEmpty(profile.job) ||
      nonEmpty(profile.fears) ||
      nonEmpty(profile.gtk_needs_from_self) ||
      nonEmpty(profile.gtk_relationship_quality) ||
      nonEmpty(profile.key_trigger) ||
      nonEmpty(profile.behavioral_patterns) ||
      nonEmpty(profile.gtk_concerns)
    ) ? 'has_notes' : 'empty';
  }
  // Stage 3
  return (
    nonEmpty(profile.developmental_history) ||
    nonEmpty(profile.gtk_what_carries) ||
    nonEmpty(profile.gtk_origin_wound) ||
    nonEmpty(profile.gtk_unburdened_vision) ||
    nonEmpty(profile.gift_description)
  ) ? 'has_notes' : 'empty';
}

function getGuidedStatus(
  id: GuidedId,
  profile: ProfileRow | null,
  memoryCount: number,
): 'empty' | 'has_notes' {
  if (!profile) return 'empty';

  if (id === 'memories') return memoryCount > 0 ? 'has_notes' : 'empty';

  if (id === 'permissions') {
    return (
      nonEmpty(profile.consent_given) ||
      nonEmpty(profile.safety_needs) ||
      nonEmpty(profile.agreement_requested)
    ) ? 'has_notes' : 'empty';
  }

  if (id === 'exile_contact') {
    return nonEmpty(profile.exile_contact_notes) ? 'has_notes' : 'empty';
  }

  const fieldMap: Partial<Record<GuidedId, string | null>> = {
    voice_phrases:       profile.voice_phrases,
    desires_needs:       profile.desires,
    behavioral_patterns: profile.behavioral_patterns,
    world_perspective:   profile.beliefs,
    fears:               profile.fears,
    strengths:           profile.strengths,
    weaknesses:          profile.weaknesses,
    part_inheritance:    profile.inheritance_notes,
  };
  const val = fieldMap[id];
  return val && val.trim().length > 0 ? 'has_notes' : 'empty';
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ElaborationMenuScreen() {
  const { partId } = useLocalSearchParams<{ partId: string }>();

  const [part, setPart]               = useState<PartRow | null>(null);
  const [profile, setProfile]         = useState<ProfileRow | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);
  const [elaborationData, setElaborationData] = useState<
    Record<string, ElaborationSection>
  >({});

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

      db.getFirstAsync<ProfileRow>(
        `SELECT elaboration_data_json,
                voice_phrases, desires, behavioral_patterns, fears, beliefs,
                strengths, weaknesses, inheritance_notes,
                body_location, gtk_first_impression, part_perspective, feel_towards,
                job, key_trigger, gtk_needs_from_self, gtk_relationship_quality, gtk_concerns,
                developmental_history, gtk_what_carries, gtk_origin_wound,
                gtk_unburdened_vision, gift_description, gtk_gift_to_system,
                consent_given, safety_needs, agreement_requested, exile_contact_notes
         FROM part_profiles WHERE part_id = ?`,
        [partId],
      ).then((row) => {
        if (row) {
          setProfile(row);
          if (row.elaboration_data_json) {
            try {
              const parsed = JSON.parse(row.elaboration_data_json) as
                Record<string, ElaborationSection>;
              setElaborationData(parsed);
            } catch { /* noop */ }
          }
        }
      }).catch(() => undefined);

      db.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM part_memories WHERE part_id = ?`,
        [partId],
      ).then((row) => { if (row) setMemoryCount(row.cnt); })
        .catch(() => undefined);
    }, [partId]),
  );

  const typeColor = part ? TYPE_COLOR[part.type] : '#3B5BA5';

  function descriptorHasContent(sectionId: string): boolean {
    const data = elaborationData[sectionId];
    if (!data) return false;
    const hasSelected   = (data.selected?.length ?? 0) > 0;
    const hasCustomTags = (data.custom_tags?.length ?? 0) > 0;
    const hasLegacy     = !!(data.custom && data.custom.trim().length > 0);
    return hasSelected || hasCustomTags || hasLegacy;
  }

  function getDescriptorStatus(sectionId: string): string {
    const data  = elaborationData[sectionId];
    const count = data?.selected?.length ?? 0;
    if (!descriptorHasContent(sectionId)) return 'Not yet explored';
    return `${count} word${count === 1 ? '' : 's'}`;
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={s.backBtn}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={18} color="#6B6860" />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>
          Explore {part?.display_name ?? '…'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section A — Getting to Know ───────────────────────────────── */}
        <Text style={s.sectionLabel}>Getting to Know</Text>

        {GETTING_TO_KNOW_STAGES.map((stage) => {
          const status   = getStageStatus(stage.id, profile);
          const hasNotes = status === 'has_notes';
          return (
            <TouchableOpacity
              key={stage.id}
              style={s.card}
              activeOpacity={0.75}
              onPress={() =>
                router.push(
                  `/getting-to-know?partId=${partId}&stageId=${stage.id}` as never,
                )
              }
            >
              {/* Left accent bar */}
              <View
                style={[
                  s.cardAccentBar,
                  { backgroundColor: stage.accentColor },
                ]}
              />
              <View style={s.cardInner}>
                <View style={s.cardTop}>
                  <Text style={s.cardLabel}>{stage.label}</Text>
                  <View style={s.cardRight}>
                    {hasNotes && (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#22C55E"
                        style={{ marginRight: 6 }}
                      />
                    )}
                    <Ionicons name="chevron-forward" size={16} color="#C5C3BE" />
                  </View>
                </View>
                <Text
                  style={[
                    s.cardStatus,
                    hasNotes && { color: '#22C55E' },
                  ]}
                >
                  {hasNotes ? 'Has notes' : 'Not yet explored'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ── Section B — Descriptor Explorers ──────────────────────────── */}
        <Text style={[s.sectionLabel, { marginTop: 8 }]}>
          Descriptor Explorers
        </Text>

        {DESCRIPTOR_SECTIONS.map((sec) => {
          const statusText = getDescriptorStatus(sec.id);
          const hasContent = descriptorHasContent(sec.id);
          return (
            <TouchableOpacity
              key={sec.id}
              style={s.plainCard}
              activeOpacity={0.75}
              onPress={() =>
                router.push(
                  `/descriptor-explorer?partId=${partId}&sectionId=${sec.id}` as never,
                )
              }
            >
              <View style={s.cardTop}>
                <Text style={s.cardLabel}>{sec.label}</Text>
                <View style={s.cardRight}>
                  {hasContent && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#22C55E"
                      style={{ marginRight: 6 }}
                    />
                  )}
                  <Ionicons name="chevron-forward" size={16} color="#C5C3BE" />
                </View>
              </View>
              <Text
                style={[
                  s.cardStatus,
                  hasContent && { color: typeColor },
                ]}
              >
                {statusText}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* ── Section C — Guided Explorations ───────────────────────────── */}
        <Text style={[s.sectionLabel, { marginTop: 8 }]}>
          Guided Explorations
        </Text>

        {GUIDED_EXPLORATIONS.map((exp) => {
          const status   = getGuidedStatus(exp.id, profile, memoryCount);
          const hasNotes = status === 'has_notes';
          return (
            <TouchableOpacity
              key={exp.id}
              style={s.plainCard}
              activeOpacity={0.75}
              onPress={() =>
                router.push(
                  `/guided-exploration?partId=${partId}&explorationId=${exp.id}` as never,
                )
              }
            >
              <View style={s.cardTop}>
                <Text style={s.cardLabel}>{exp.label}</Text>
                <View style={s.cardRight}>
                  {hasNotes && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#22C55E"
                      style={{ marginRight: 6 }}
                    />
                  )}
                  <Ionicons name="chevron-forward" size={16} color="#C5C3BE" />
                </View>
              </View>
              <Text
                style={[
                  s.cardStatus,
                  hasNotes && { color: '#22C55E' },
                ]}
              >
                {hasNotes ? 'Has notes' : 'Not yet explored'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: '#E5E3DE',
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

  scroll:        { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 10 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6860',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
    marginTop: 4,
  },

  // Card with left accent bar (Getting to Know)
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardAccentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardInner: {
    flex: 1,
    padding: 16,
    gap: 6,
  },

  // Plain card (Descriptor + Guided — no accent bar)
  plainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E3DE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    gap: 6,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel:  { fontSize: 16, fontWeight: '600', color: '#1C1B19', flex: 1 },
  cardStatus: { fontSize: 13, color: '#A09D96' },
  cardRight:  { flexDirection: 'row', alignItems: 'center' },
});
