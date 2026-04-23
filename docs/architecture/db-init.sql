-- Inner Atlas — Database Init SQL
-- Reference copy of the schema. The live version is in apps/mobile/lib/database.ts.
-- All queries in the app use parameterized statements (no string interpolation).
-- SQLCipher key is set via PRAGMA key before any other statement (see database.ts).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  role TEXT DEFAULT 'individual',        -- individual | client | therapist
  onboarding_complete INTEGER DEFAULT 0,
  assessment_complete INTEGER DEFAULT 0,
  settings_json TEXT DEFAULT '{}',
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                    -- original assessment working title — never changes
  custom_name TEXT,                      -- user-assigned via Naming Moment or Refine
  display_name TEXT GENERATED ALWAYS AS (COALESCE(custom_name, name)) VIRTUAL,
  type TEXT NOT NULL,                    -- manager | firefighter | exile | self
  backend_classification TEXT,           -- NEVER shown in UI
  intensity INTEGER DEFAULT 5,           -- 1-10
  activation_status TEXT DEFAULT 'moderate', -- high | moderate | low
  icon_id TEXT,
  color_hex TEXT,
  position_x REAL,
  position_y REAL,
  discovered_via TEXT,                   -- first_mapping | mini_[name] | manual | trailhead
  status TEXT DEFAULT 'named',           -- named | shadowed | unknown
  is_elaborated INTEGER DEFAULT 0,
  is_refined INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS part_profiles (
  part_id TEXT PRIMARY KEY REFERENCES parts(id),
  triggers_json TEXT,
  manifestations_json TEXT,              -- {cognitive, emotional, somatic, behavioral}
  somatic_locations_json TEXT,
  developmental_history TEXT,
  earliest_memory TEXT,
  part_perspective TEXT,
  burden_description TEXT,
  gift_description TEXT,
  feel_towards TEXT,
  appearance_json TEXT,                  -- {color, shape, texture, movement, temperature, sound, age, image_uri}
  custom_attributes_json TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS part_relationships (
  id TEXT PRIMARY KEY,
  part_a_id TEXT REFERENCES parts(id),
  part_b_id TEXT REFERENCES parts(id),
  relationship_type TEXT,                -- harmonious | conflicting | protective | neutral | polarized
  direction TEXT,                        -- a_to_b | b_to_a | mutual
  strength INTEGER DEFAULT 5,            -- 1-10
  status TEXT DEFAULT 'confirmed',       -- confirmed | inferred | shadowed
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS assessment_sessions (
  id TEXT PRIMARY KEY,
  assessment_type TEXT,                  -- first_mapping | mini_achiever | mini_protector | mini_connector | mini_escape_artist | mini_tender_places | mini_body_speaks
  status TEXT DEFAULT 'in_progress',     -- in_progress | complete | abandoned
  current_phase TEXT,
  current_cluster TEXT,                  -- A | B | C | D
  responses_json TEXT,                   -- all raw user responses
  inferences_json TEXT,                  -- backend inference results — NEVER shown to user
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS assessment_naming_moments (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES assessment_sessions(id),
  cluster TEXT,                          -- A | B | C | D
  working_title TEXT,                    -- chip selected
  user_chosen_name TEXT,                 -- confirmed name (becomes part.custom_name)
  feel_towards TEXT,                     -- micro-capture — never scored
  part_id TEXT REFERENCES parts(id),
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS shadowed_nodes (
  id TEXT PRIMARY KEY,
  inferred_type TEXT,
  inferred_backend_classification TEXT,  -- NEVER shown to user
  connected_to_part_id TEXT REFERENCES parts(id),
  revealed_by_assessment TEXT,
  map_position_x REAL,
  map_position_y REAL,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS inner_dialogues (
  id TEXT PRIMARY KEY,
  title TEXT,
  participants_json TEXT,                -- [{part_id, name, color, is_self}]
  messages_json TEXT,                    -- [{participant_id, text, timestamp}]
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS trailheads (
  id TEXT PRIMARY KEY,
  entry_type TEXT,                       -- thought | feeling | sensation | impulse
  entry_description TEXT,
  body_location TEXT,
  intensity_initial INTEGER,
  trail_chain_json TEXT,                 -- ordered part_ids
  exile_id TEXT REFERENCES parts(id),
  status TEXT DEFAULT 'in_progress',     -- in_progress | complete
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS elaboration_sessions (
  id TEXT PRIMARY KEY,
  part_id TEXT REFERENCES parts(id),
  completed_tabs_json TEXT,
  session_data_json TEXT,
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS updates (
  id TEXT PRIMARY KEY,
  update_type TEXT,                      -- part_activation | insight | relationship_change | progress | system_observation | other
  part_id TEXT REFERENCES parts(id),
  intensity INTEGER,                     -- 1-10
  content_json TEXT,
  context_tags_json TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS self_energy_checkins (
  id TEXT PRIMARY KEY,
  check_type TEXT DEFAULT 'quick',       -- quick | full
  overall_percentage INTEGER,            -- 0-100
  eight_cs_json TEXT,                    -- {calm, curious, compassionate, connected, confident, creative, courageous, clear} each 1-7
  blended_parts_json TEXT,               -- [part_id, ...]
  notes TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS body_placements (
  id TEXT PRIMARY KEY,
  part_id TEXT REFERENCES parts(id),
  x_position REAL,
  y_position REAL,                       -- 0-1 normalized
  view TEXT DEFAULT 'front',             -- front | back
  intensity INTEGER DEFAULT 5,
  sensation_notes TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id TEXT PRIMARY KEY,
  technique_id TEXT,                     -- references techniques-library.json id field
  completed_at TEXT,
  reflection_note TEXT,
  parts_tagged_json TEXT,
  duration_minutes INTEGER
);

CREATE TABLE IF NOT EXISTS system_snapshots (
  id TEXT PRIMARY KEY,
  label TEXT,
  parts_json TEXT,
  relationships_json TEXT,
  self_energy_baseline INTEGER,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  milestone_key TEXT UNIQUE,
  earned_at TEXT
);
