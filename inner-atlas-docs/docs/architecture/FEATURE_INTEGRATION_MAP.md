# Inner Atlas — Feature Integration Map

## Data Flow

First Mapping Assessment
  creates: parts (named nodes), shadowed_nodes, assessment_session, naming_moments
  creates: initial part_relationships (Phase 3 inference)
  creates: initial self_energy_checkin baseline
  populates: parts map fog-of-war canvas

Mini-Assessments (6)
  lifts fog in specific region
  creates: new named parts (each with naming moment)
  creates: new part_relationships
  converts: shadowed_nodes to named when discovered

Trailhead
  triggered by: Update log (activation type)
  follows: protection chain through existing parts
  discovers: new parts (adds to inventory + map)
  links to: Elaboration for the exile discovered

Elaboration
  accessed from: Part Profile (Elaborate button)
  populates: part_profiles in depth
  sets: is_elaborated = true on part record
  creates: elaboration_session (resumable)

Refine
  extends: parts table (custom_name, icon_id, color_hex)
  does NOT overwrite: original assessment data
  updates: Parts Map node appearance immediately

Self-Energy Check-In
  creates: self_energy_checkins record
  feeds: Dashboard gauge, Map Self Access orb

Update Logger
  creates: updates records
  feeds: Dashboard Recent Activity
  triggers: "Explore this further?" -> Trailhead or Elaboration

Dashboard
  reads: self_energy_checkins (gauge)
  reads: parts (system snapshot)
  reads: updates + practice_sessions + inner_dialogues (activity feed)
  refreshes on screen focus

## Navigation Flows

Assessment -> Map:
  Complete -> Reveal Screen 3 (Cliffhanger) -> "Explore the fog" -> Mini-Assessment Library
  OR dismiss -> Parts Map (fog visible)

Map -> Part Profile:
  Tap node -> Part Profile (bottom sheet mobile / right panel desktop)
  From Overview: Go Deeper -> Elaboration
  From Overview: Refine -> Refine feature

Update -> Continued Work:
  Log activation -> "Explore this further?" -> Trailhead OR Elaboration

Trailhead -> Exile:
  Trail complete -> "Exile discovered" -> Part Profile -> Elaboration
