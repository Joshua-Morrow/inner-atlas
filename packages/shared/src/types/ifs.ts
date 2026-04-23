/**
 * Inner Atlas — IFS Domain Types
 * Core type definitions for Internal Family Systems therapy support
 */

// ─── Part Types ──────────────────────────────────────────────
export type PartType = 'manager' | 'firefighter' | 'exile' | 'self';

export type ActivationStatus = 'high' | 'moderate' | 'low';

export type PartStatus = 'named' | 'shadowed' | 'unknown';

export type DiscoverySource =
  | 'first_mapping'
  | 'mini_achiever'
  | 'mini_protector'
  | 'mini_connector'
  | 'mini_escape_artist'
  | 'mini_tender_places'
  | 'mini_body_speaks'
  | 'manual'
  | 'trailhead';

export interface Part {
  id: string;
  name: string;
  custom_name: string | null;
  display_name: string; // COALESCE(custom_name, name) — computed
  type: PartType;
  backend_classification: string | null; // NEVER shown in UI
  intensity: number; // 1-10
  activation_status: ActivationStatus;
  icon_id: string | null;
  color_hex: string | null;
  position_x: number | null;
  position_y: number | null;
  discovered_via: DiscoverySource | null;
  status: PartStatus;
  is_elaborated: boolean;
  is_refined: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Part Profile ────────────────────────────────────────────
export interface Manifestations {
  cognitive: string | null;
  emotional: string | null;
  somatic: string | null;
  behavioral: string | null;
}

export interface Appearance {
  color: string | null;
  shape: string | null;
  texture: string | null;
  movement: string | null;
  temperature: string | null;
  sound: string | null;
  age: string | null;
  image_uri: string | null;
}

export interface PartProfile {
  part_id: string;
  triggers_json: string | null;
  manifestations_json: string | null;
  somatic_locations_json: string | null;
  developmental_history: string | null;
  earliest_memory: string | null;
  part_perspective: string | null;
  burden_description: string | null;
  gift_description: string | null;
  feel_towards: string | null;
  appearance_json: string | null;
  custom_attributes_json: string | null;
  updated_at: string;
}

// ─── Relationships ───────────────────────────────────────────
export type RelationshipType =
  | 'harmonious'
  | 'conflicting'
  | 'protective'
  | 'neutral'
  | 'polarized';

export type RelationshipDirection = 'a_to_b' | 'b_to_a' | 'mutual';

export type RelationshipStatus = 'confirmed' | 'inferred' | 'shadowed';

export interface PartRelationship {
  id: string;
  part_a_id: string;
  part_b_id: string;
  relationship_type: RelationshipType;
  direction: RelationshipDirection;
  strength: number; // 1-10
  status: RelationshipStatus;
  created_at: string;
  updated_at: string;
}

// ─── Assessments ─────────────────────────────────────────────
export type AssessmentType =
  | 'first_mapping'
  | 'mini_achiever'
  | 'mini_protector'
  | 'mini_connector'
  | 'mini_escape_artist'
  | 'mini_tender_places'
  | 'mini_body_speaks';

export type AssessmentStatus = 'in_progress' | 'complete' | 'abandoned';

export type AssessmentCluster = 'A' | 'B' | 'C' | 'D';

export interface AssessmentSession {
  id: string;
  assessment_type: AssessmentType;
  status: AssessmentStatus;
  current_phase: string | null;
  current_cluster: AssessmentCluster | null;
  responses_json: string | null;
  inferences_json: string | null; // NEVER shown to user
  started_at: string;
  completed_at: string | null;
}

export interface NamingMoment {
  id: string;
  session_id: string;
  cluster: AssessmentCluster;
  working_title: string;
  user_chosen_name: string | null;
  feel_towards: string | null; // micro-capture — never scored
  part_id: string | null;
  created_at: string;
}

// ─── Shadowed Nodes ──────────────────────────────────────────
export interface ShadowedNode {
  id: string;
  inferred_type: string | null;
  inferred_backend_classification: string | null; // NEVER shown to user
  connected_to_part_id: string | null;
  revealed_by_assessment: string | null;
  map_position_x: number | null;
  map_position_y: number | null;
  created_at: string;
}

// ─── Clinical Features ──────────────────────────────────────
export interface InnerDialogue {
  id: string;
  title: string | null;
  participants_json: string | null;
  messages_json: string | null;
  created_at: string;
  updated_at: string;
}

export type TrailheadEntryType = 'thought' | 'feeling' | 'sensation' | 'impulse';

export interface Trailhead {
  id: string;
  entry_type: TrailheadEntryType;
  entry_description: string | null;
  body_location: string | null;
  intensity_initial: number | null;
  trail_chain_json: string | null;
  exile_id: string | null;
  status: 'in_progress' | 'complete';
  started_at: string;
  completed_at: string | null;
}

export interface ElaborationSession {
  id: string;
  part_id: string;
  completed_tabs_json: string | null;
  session_data_json: string | null;
  started_at: string;
  completed_at: string | null;
}

export type UpdateType =
  | 'part_activation'
  | 'insight'
  | 'relationship_change'
  | 'progress'
  | 'system_observation'
  | 'other';

export interface Update {
  id: string;
  update_type: UpdateType;
  part_id: string | null;
  intensity: number | null;
  content_json: string | null;
  context_tags_json: string | null;
  created_at: string;
}

// ─── Self-Energy ─────────────────────────────────────────────
export interface EightCs {
  calm: number;        // 1-7
  curious: number;
  compassionate: number;
  connected: number;
  confident: number;
  creative: number;
  courageous: number;
  clear: number;
}

export interface SelfEnergyCheckin {
  id: string;
  check_type: 'quick' | 'full';
  overall_percentage: number; // 0-100
  eight_cs_json: string | null;
  blended_parts_json: string | null;
  notes: string | null;
  created_at: string;
}

// ─── Body Map ────────────────────────────────────────────────
export interface BodyPlacement {
  id: string;
  part_id: string;
  x_position: number;
  y_position: number; // 0-1 normalized
  view: 'front' | 'back';
  intensity: number;
  sensation_notes: string | null;
  updated_at: string;
}

// ─── Practice ────────────────────────────────────────────────
export interface PracticeSession {
  id: string;
  technique_id: string;
  completed_at: string;
  reflection_note: string | null;
  parts_tagged_json: string | null;
  duration_minutes: number | null;
}

// ─── System Snapshots ────────────────────────────────────────
export interface SystemSnapshot {
  id: string;
  label: string | null;
  parts_json: string | null;
  relationships_json: string | null;
  self_energy_baseline: number | null;
  created_at: string;
}

// ─── Milestones ──────────────────────────────────────────────
export interface Milestone {
  id: string;
  milestone_key: string;
  earned_at: string;
}

// ─── Profile ─────────────────────────────────────────────────
export type UserRole = 'individual' | 'client' | 'therapist';

export interface Profile {
  id: string;
  display_name: string | null;
  role: UserRole;
  onboarding_complete: boolean;
  assessment_complete: boolean;
  settings_json: string;
  created_at: string;
  updated_at: string;
}
