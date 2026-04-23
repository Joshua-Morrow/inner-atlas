/**
 * Trailhead v2 — TypeScript types for all trailhead data structures.
 */

export type EntryType = 'thought' | 'feeling' | 'sensation' | 'impulse';
export type SessionStatus = 'active' | 'paused' | 'complete' | 'abandoned';
export type SessionPhase =
  | 'entry'
  | 'initial_self_check'
  | 'first_contact'
  | 'loop'
  | 'exile_transition'
  | 'exile_contact'
  | 'integration';
export type LoopOutcome = 'deeper' | 'exile_sensed' | 'refused';
export type ConsentValue = 'yes' | 'hesitant' | 'no';
export type PartType = 'manager' | 'firefighter' | 'exile' | 'self' | 'unknown';

export interface TrailheadSession {
  id: number;
  user_id: number;
  title: string | null;
  status: SessionStatus;
  entry_type: EntryType;
  entry_description: string;
  entry_intensity: number | null;
  entry_body_regions: string | null;
  entry_sensation_notes: string | null;
  initial_self_energy: number | null;
  current_phase: SessionPhase;
  current_loop_part_id: string | null;
  exile_part_id: string | null;
  paused_at_phase: string | null;
  paused_at_card: string | null;
  reentry_count: number;
  last_reentry_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TrailheadChainEntry {
  id: number;
  session_id: number;
  part_id: string | null;
  part_is_new: number;
  chain_position: number;
  part_role: string | null;
  self_energy_at_contact: number | null;
  other_parts_blending: string | null;
  blending_notes: string | null;
  unblending_achieved: number;
  unblending_notes: string | null;
  somatic_body_regions: string | null;
  somatic_sensation_desc: string | null;
  somatic_intensity: number | null;
  part_energy_quality: string | null;
  role_duration: string | null;
  part_message_to_self: string | null;
  part_stance_toward_self: string | null;
  fear_if_stopped: string | null;
  role_burden_experience: string | null;
  has_concerns: number | null;
  concern_description: string | null;
  safety_needs: string | null;
  fear_of_going_deeper: string | null;
  self_presence_felt: number | null;
  consent_given: ConsentValue | null;
  consent_notes: string | null;
  agreement_requested: string | null;
  protecting_against: string | null;
  next_layer_notes: string | null;
  loop_outcome: LoopOutcome | null;
  created_at: string;
  updated_at: string;
}

export interface TrailheadExileContact {
  id: number;
  session_id: number;
  part_id: string | null;
  self_energy_at_transition: number | null;
  transition_grounding_used: number;
  apparent_age_quality: string | null;
  somatic_body_regions: string | null;
  somatic_sensation_desc: string | null;
  what_it_carries: string | null;
  what_it_needs_to_hear: string | null;
  witnessing_complete: number;
  response_when_witnessed: string | null;
  exile_felt_seen: number | null;
  contact_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrailheadSelfCheck {
  id: number;
  session_id: number;
  chain_entry_id: number | null;
  phase: string;
  energy_level: number;
  grounding_used: number;
  grounding_type: string | null;
  checked_at: string;
}

/** Minimal part info needed within session UI */
export interface PartSummary {
  id: string;
  display_name: string;
  type: PartType;
}

/** Row returned by the trail list query */
export interface TrailSummaryRow {
  id: number;
  title: string | null;
  entry_type: EntryType;
  entry_description: string;
  entry_intensity: number | null;
  status: SessionStatus;
  current_phase: SessionPhase;
  exile_part_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  part_count: number;
}

/** One entry in the trail chain with display info */
export interface ChainEntryWithPart extends TrailheadChainEntry {
  part_display_name: string | null;
  part_type: PartType | null;
}
