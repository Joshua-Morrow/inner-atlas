/**
 * Inner Atlas — Database Service
 * Initializes the encrypted SQLite database on first launch.
 * Key stored in expo-secure-store. Never logged or exposed.
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'inner-atlas.db';
const ENCRYPTION_KEY_STORE_KEY = 'db_encryption_key';

let _db: SQLite.SQLiteDatabase | null = null;

async function getOrCreateEncryptionKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE_KEY);
  if (!key) {
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    key = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE_KEY, key);
  }
  return key;
}

const CREATE_TABLES_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  role TEXT DEFAULT 'individual',
  onboarding_complete INTEGER DEFAULT 0,
  assessment_complete INTEGER DEFAULT 0,
  settings_json TEXT DEFAULT '{}',
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  custom_name TEXT,
  display_name TEXT GENERATED ALWAYS AS (COALESCE(custom_name, name)) VIRTUAL,
  type TEXT NOT NULL,
  backend_classification TEXT,
  intensity INTEGER DEFAULT 5,
  activation_status TEXT DEFAULT 'moderate',
  icon_id TEXT,
  color_hex TEXT,
  position_x REAL,
  position_y REAL,
  discovered_via TEXT,
  status TEXT DEFAULT 'named',
  is_elaborated INTEGER DEFAULT 0,
  is_refined INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS part_profiles (
  part_id TEXT PRIMARY KEY REFERENCES parts(id),
  triggers_json TEXT,
  manifestations_json TEXT,
  somatic_locations_json TEXT,
  developmental_history TEXT,
  earliest_memory TEXT,
  part_perspective TEXT,
  burden_description TEXT,
  gift_description TEXT,
  feel_towards TEXT,
  appearance_json TEXT,
  appearance TEXT,
  job TEXT,
  key_trigger TEXT,
  key_identifier TEXT,
  fears TEXT,
  custom_attributes_json TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS part_relationships (
  id TEXT PRIMARY KEY,
  part_a_id TEXT REFERENCES parts(id),
  part_b_id TEXT REFERENCES parts(id),
  relationship_type TEXT,
  direction TEXT,
  strength INTEGER DEFAULT 5,
  status TEXT DEFAULT 'confirmed',
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS assessment_sessions (
  id TEXT PRIMARY KEY,
  assessment_type TEXT,
  status TEXT DEFAULT 'in_progress',
  current_phase TEXT,
  current_cluster TEXT,
  responses_json TEXT,
  inferences_json TEXT,
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS assessment_naming_moments (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES assessment_sessions(id),
  cluster TEXT,
  working_title TEXT,
  user_chosen_name TEXT,
  feel_towards TEXT,
  part_id TEXT REFERENCES parts(id),
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS shadowed_nodes (
  id TEXT PRIMARY KEY,
  inferred_type TEXT,
  inferred_backend_classification TEXT,
  connected_to_part_id TEXT REFERENCES parts(id),
  revealed_by_assessment TEXT,
  map_position_x REAL,
  map_position_y REAL,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS inner_dialogues (
  id TEXT PRIMARY KEY,
  title TEXT,
  participants_json TEXT,
  messages_json TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS trailheads (
  id TEXT PRIMARY KEY,
  entry_type TEXT,
  entry_description TEXT,
  body_location TEXT,
  intensity_initial INTEGER,
  trail_chain_json TEXT,
  exile_id TEXT REFERENCES parts(id),
  status TEXT DEFAULT 'in_progress',
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
  update_type TEXT,
  part_id TEXT REFERENCES parts(id),
  intensity INTEGER,
  content_json TEXT,
  context_tags_json TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS self_energy_checkins (
  id TEXT PRIMARY KEY,
  check_type TEXT DEFAULT 'quick',
  overall_percentage INTEGER,
  eight_cs_json TEXT,
  blended_parts_json TEXT,
  notes TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS body_placements (
  id TEXT PRIMARY KEY,
  part_id TEXT REFERENCES parts(id),
  x_position REAL,
  y_position REAL,
  view TEXT DEFAULT 'front',
  intensity INTEGER DEFAULT 5,
  sensation_notes TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id TEXT PRIMARY KEY,
  technique_id TEXT,
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
`;

// Adds columns introduced after initial schema deployment.
// SQLite does not support ADD COLUMN IF NOT EXISTS; catching the error is the standard approach.
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const migrations = [
    'ALTER TABLE part_profiles ADD COLUMN appearance TEXT',
    'ALTER TABLE part_profiles ADD COLUMN job TEXT',
    'ALTER TABLE part_profiles ADD COLUMN key_trigger TEXT',
    'ALTER TABLE part_profiles ADD COLUMN key_identifier TEXT',
    'ALTER TABLE part_profiles ADD COLUMN fears TEXT',
    // inner_dialogues — multi-party support
    "ALTER TABLE inner_dialogues ADD COLUMN status TEXT DEFAULT 'active'",
    'ALTER TABLE inner_dialogues ADD COLUMN part_id TEXT',
    // practice_sessions — session log + part reference
    'ALTER TABLE practice_sessions ADD COLUMN notes_json TEXT',
    'ALTER TABLE practice_sessions ADD COLUMN part_id TEXT',
    // trailheads — required columns for part-linked session tracking
    'ALTER TABLE trailheads ADD COLUMN part_id TEXT',
    'ALTER TABLE trailheads ADD COLUMN steps_json TEXT',
    'ALTER TABLE trailheads ADD COLUMN exile_discovered INTEGER DEFAULT 0',
    'ALTER TABLE trailheads ADD COLUMN discovered_part_id TEXT',
    'ALTER TABLE trailheads ADD COLUMN created_at TEXT',
    // part_profiles — elaboration fields
    'ALTER TABLE part_profiles ADD COLUMN body_location TEXT',
    'ALTER TABLE part_profiles ADD COLUMN origin_story TEXT',
    'ALTER TABLE part_profiles ADD COLUMN beliefs TEXT',
    'ALTER TABLE part_profiles ADD COLUMN relationship_to_self TEXT',
    'ALTER TABLE part_profiles ADD COLUMN burdens TEXT',
    'ALTER TABLE part_profiles ADD COLUMN gifts TEXT',
    // elaboration_sessions — status + steps tracking
    "ALTER TABLE elaboration_sessions ADD COLUMN status TEXT DEFAULT 'in_progress'",
    'ALTER TABLE elaboration_sessions ADD COLUMN steps_json TEXT',
    // part_relationships — link to new relationships table
    'ALTER TABLE part_relationships ADD COLUMN relationship_id TEXT',
    // inner_dialogues — link to relationship for relationship dialogue
    'ALTER TABLE inner_dialogues ADD COLUMN relationship_id TEXT',
    // part_profiles — elaboration v2 fields
    'ALTER TABLE part_profiles ADD COLUMN voice_phrases TEXT',
    'ALTER TABLE part_profiles ADD COLUMN desires TEXT',
    'ALTER TABLE part_profiles ADD COLUMN behavioral_patterns TEXT',
    'ALTER TABLE part_profiles ADD COLUMN strengths TEXT',
    'ALTER TABLE part_profiles ADD COLUMN weaknesses TEXT',
    'ALTER TABLE part_profiles ADD COLUMN elaboration_data_json TEXT',
    // guided exploration tag columns
    'ALTER TABLE part_profiles ADD COLUMN voice_phrases_tags TEXT',
    'ALTER TABLE part_profiles ADD COLUMN desires_tags TEXT',
    'ALTER TABLE part_profiles ADD COLUMN behavioral_patterns_tags TEXT',
    'ALTER TABLE part_profiles ADD COLUMN memories_tags TEXT',
    'ALTER TABLE part_profiles ADD COLUMN world_perspective_tags TEXT',
    'ALTER TABLE part_profiles ADD COLUMN fears_tags TEXT',
    'ALTER TABLE part_profiles ADD COLUMN strengths_tags TEXT',
    'ALTER TABLE part_profiles ADD COLUMN weaknesses_tags TEXT',
    // part_inheritance exploration
    'ALTER TABLE part_profiles ADD COLUMN inheritance_tags TEXT',
    'ALTER TABLE part_profiles ADD COLUMN inheritance_notes TEXT',
    // part images
    'ALTER TABLE parts ADD COLUMN current_image_id TEXT',
    // parts map — burdened state indicator
    'ALTER TABLE parts ADD COLUMN is_burdened INTEGER DEFAULT 0',
    // parts map — map visibility (freed parts can still appear)
    'ALTER TABLE parts ADD COLUMN map_visible INTEGER DEFAULT 1',
    // Getting to Know — Stage 1
    'ALTER TABLE part_profiles ADD COLUMN gtk_how_noticed TEXT',
    'ALTER TABLE part_profiles ADD COLUMN gtk_first_impression TEXT',
    // Getting to Know — Stage 2
    'ALTER TABLE part_profiles ADD COLUMN gtk_needs_from_self TEXT',
    'ALTER TABLE part_profiles ADD COLUMN gtk_relationship_quality TEXT',
    'ALTER TABLE part_profiles ADD COLUMN gtk_concerns TEXT',
    // Getting to Know — Stage 3
    'ALTER TABLE part_profiles ADD COLUMN gtk_origin_wound TEXT',
    'ALTER TABLE part_profiles ADD COLUMN gtk_what_carries TEXT',
    'ALTER TABLE part_profiles ADD COLUMN gtk_unburdened_vision TEXT',
    'ALTER TABLE part_profiles ADD COLUMN gtk_gift_to_system TEXT',
    // Guided Exploration v3 — Permissions topic
    'ALTER TABLE part_profiles ADD COLUMN consent_given TEXT',
    'ALTER TABLE part_profiles ADD COLUMN safety_needs TEXT',
    'ALTER TABLE part_profiles ADD COLUMN agreement_requested TEXT',
    // Guided Exploration v3 — Exile Contact topic
    'ALTER TABLE part_profiles ADD COLUMN exile_contact_notes TEXT',
  ];
  for (const sql of migrations) {
    try {
      await db.execAsync(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // New tables added after initial schema — safe to run every time (IF NOT EXISTS)
  const newTables = [
    `CREATE TABLE IF NOT EXISTS part_memories (
      id TEXT PRIMARY KEY,
      part_id TEXT NOT NULL REFERENCES parts(id),
      title TEXT,
      content TEXT NOT NULL,
      memory_date TEXT,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      what_costs TEXT,
      history_notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS relationship_members (
      id TEXT PRIMARY KEY,
      relationship_id TEXT NOT NULL REFERENCES relationships(id),
      member_type TEXT NOT NULL,
      part_id TEXT REFERENCES parts(id),
      coalition_id TEXT REFERENCES relationships(id),
      side TEXT,
      role_note TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS polarization_details (
      id TEXT PRIMARY KEY,
      relationship_id TEXT NOT NULL REFERENCES relationships(id),
      side_a_wants TEXT,
      side_b_wants TEXT,
      side_a_fears TEXT,
      side_b_fears TEXT,
      side_a_label TEXT,
      side_b_label TEXT,
      mediation_notes TEXT,
      progress_notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS cycle_annotations (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      color_hex TEXT DEFAULT '#B88A00',
      notes TEXT,
      created_at TEXT
    )`,
    // Trailhead v2 — full session-based guided IFS trail feature
    `CREATE TABLE IF NOT EXISTS trailhead_sessions (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id               INTEGER NOT NULL DEFAULT 1,
      title                 TEXT,
      status                TEXT NOT NULL DEFAULT 'active',
      entry_type            TEXT NOT NULL,
      entry_description     TEXT NOT NULL,
      entry_intensity       INTEGER,
      entry_body_regions    TEXT,
      entry_sensation_notes TEXT,
      initial_self_energy   INTEGER,
      current_phase         TEXT NOT NULL DEFAULT 'entry',
      current_loop_part_id  TEXT,
      exile_part_id         TEXT,
      paused_at_phase       TEXT,
      paused_at_card        TEXT,
      reentry_count         INTEGER DEFAULT 0,
      last_reentry_at       TEXT,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at          TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS trailhead_chain_entries (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id              INTEGER NOT NULL,
      part_id                 TEXT,
      part_is_new             INTEGER DEFAULT 0,
      chain_position          INTEGER NOT NULL,
      part_role               TEXT,
      self_energy_at_contact  INTEGER,
      other_parts_blending    TEXT,
      blending_notes          TEXT,
      unblending_achieved     INTEGER DEFAULT 0,
      unblending_notes        TEXT,
      somatic_body_regions    TEXT,
      somatic_sensation_desc  TEXT,
      somatic_intensity       INTEGER,
      part_energy_quality     TEXT,
      role_duration           TEXT,
      part_message_to_self    TEXT,
      part_stance_toward_self TEXT,
      fear_if_stopped         TEXT,
      role_burden_experience  TEXT,
      has_concerns            INTEGER,
      concern_description     TEXT,
      safety_needs            TEXT,
      fear_of_going_deeper    TEXT,
      self_presence_felt      INTEGER,
      consent_given           TEXT,
      consent_notes           TEXT,
      agreement_requested     TEXT,
      protecting_against      TEXT,
      next_layer_notes        TEXT,
      loop_outcome            TEXT,
      created_at              TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at              TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES trailhead_sessions(id),
      FOREIGN KEY (part_id) REFERENCES parts(id)
    )`,
    `CREATE TABLE IF NOT EXISTS trailhead_exile_contact (
      id                        INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id                INTEGER NOT NULL,
      part_id                   TEXT,
      self_energy_at_transition INTEGER,
      transition_grounding_used INTEGER DEFAULT 0,
      apparent_age_quality      TEXT,
      somatic_body_regions      TEXT,
      somatic_sensation_desc    TEXT,
      what_it_carries           TEXT,
      what_it_needs_to_hear     TEXT,
      witnessing_complete       INTEGER DEFAULT 0,
      response_when_witnessed   TEXT,
      exile_felt_seen           INTEGER,
      contact_notes             TEXT,
      created_at                TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at                TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES trailhead_sessions(id),
      FOREIGN KEY (part_id) REFERENCES parts(id)
    )`,
    `CREATE TABLE IF NOT EXISTS trailhead_self_checks (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      INTEGER NOT NULL,
      chain_entry_id  INTEGER,
      phase           TEXT NOT NULL,
      energy_level    INTEGER NOT NULL,
      grounding_used  INTEGER DEFAULT 0,
      grounding_type  TEXT,
      checked_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES trailhead_sessions(id),
      FOREIGN KEY (chain_entry_id) REFERENCES trailhead_chain_entries(id)
    )`,
    `CREATE TABLE IF NOT EXISTS part_images (
      id TEXT PRIMARY KEY,
      part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
      rect_uri TEXT NOT NULL,
      circle_uri TEXT NOT NULL,
      original_uri TEXT NOT NULL,
      is_current INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS feel_towards_edges (
      id TEXT PRIMARY KEY,
      from_part_id TEXT NOT NULL,
      to_part_id TEXT NOT NULL,
      feelings_json TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'manual',
      session_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (from_part_id) REFERENCES parts(id),
      FOREIGN KEY (to_part_id) REFERENCES parts(id)
    )`,
    `CREATE TABLE IF NOT EXISTS feel_towards_history (
      id TEXT PRIMARY KEY,
      edge_id TEXT NOT NULL,
      feelings_json TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'manual',
      session_id TEXT,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY (edge_id) REFERENCES feel_towards_edges(id)
    )`,
  ];
  for (const sql of newTables) {
    try {
      await db.execAsync(sql);
    } catch {
      // Table creation error — log but don't crash
    }
  }
  // DEV: verify feel_towards tables exist — remove after confirming
  try {
    const ftCount = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM feel_towards_edges'
    );
    console.log('[DB] feel_towards_edges table exists, row count:', ftCount?.count ?? 0);
  } catch (e) {
    console.error('[DB] feel_towards_edges table MISSING:', e);
  }
}

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  const encryptionKey = await getOrCreateEncryptionKey();
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // Set SQLCipher encryption key — must be first operation before any other query.
  // Key is machine-generated (not user input), so interpolation is safe here.
  await db.execAsync(`PRAGMA key = '${encryptionKey}';`);
  await db.execAsync(CREATE_TABLES_SQL);
  await runMigrations(db);

  _db = db;
  return db;
}

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.');
  return _db;
}

// ─── Part Image Types & Helpers ───────────────────────────────────────────────

export interface PartImage {
  id: string;
  part_id: string;
  rect_uri: string;
  circle_uri: string;
  original_uri: string;
  is_current: number;
  created_at: string;
}

export async function getPartCurrentImage(
  db: SQLite.SQLiteDatabase,
  partId: string,
): Promise<PartImage | null> {
  return db.getFirstAsync<PartImage>(
    `SELECT id, part_id, rect_uri, circle_uri, original_uri, is_current, created_at
     FROM part_images WHERE part_id = ? AND is_current = 1
     ORDER BY created_at DESC LIMIT 1`,
    [partId],
  );
}

export async function getPartImages(
  db: SQLite.SQLiteDatabase,
  partId: string,
): Promise<PartImage[]> {
  return db.getAllAsync<PartImage>(
    `SELECT id, part_id, rect_uri, circle_uri, original_uri, is_current, created_at
     FROM part_images WHERE part_id = ?
     ORDER BY created_at DESC`,
    [partId],
  );
}

// ─── Parts Map Helpers ────────────────────────────────────────────────────────

export interface MapPart {
  id: string;
  display_name: string;
  type: string;              // manager | firefighter | exile | self | freed | unknown
  intensity: number;
  activation_status: string;
  status: string;            // named | shadowed | unknown
  is_burdened: number;
  is_elaborated: number;
  is_refined: number;
  position_x: number | null;
  position_y: number | null;
  current_image_id: string | null;
  circle_uri: string | null; // joined from part_images
}

export async function getMapParts(): Promise<MapPart[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<MapPart>(`
    SELECT
      p.id,
      p.display_name,
      p.type,
      COALESCE(p.intensity, 5)    AS intensity,
      COALESCE(p.activation_status, 'moderate') AS activation_status,
      COALESCE(p.status, 'named') AS status,
      COALESCE(p.is_burdened, 0)  AS is_burdened,
      COALESCE(p.is_elaborated, 0) AS is_elaborated,
      COALESCE(p.is_refined, 0)   AS is_refined,
      p.position_x,
      p.position_y,
      p.current_image_id,
      pi.circle_uri
    FROM parts p
    LEFT JOIN part_images pi ON pi.id = p.current_image_id
    WHERE COALESCE(p.map_visible, 1) = 1
    ORDER BY p.created_at ASC
  `);
  return rows;
}

export async function savePartMapPosition(
  partId: string,
  x: number,
  y: number,
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE parts SET position_x = ?, position_y = ?, updated_at = ? WHERE id = ?',
    [x, y, new Date().toISOString(), partId],
  );
}

export async function clearAllMapPositions(): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE parts SET position_x = NULL, position_y = NULL, updated_at = ?',
    [new Date().toISOString()],
  );
}

export async function setPartBurdened(
  partId: string,
  isBurdened: boolean,
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE parts SET is_burdened = ?, updated_at = ? WHERE id = ?',
    [isBurdened ? 1 : 0, new Date().toISOString(), partId],
  );
}

export interface MapRelationship {
  id: string;
  name: string;
  type: string; // polarization | alliance
  member_part_ids: string[];
}

export async function getMapRelationships(): Promise<MapRelationship[]> {
  const db = getDatabase();
  const rels = await db.getAllAsync<{ id: string; name: string; type: string }>(
    'SELECT id, name, type FROM relationships ORDER BY created_at ASC',
  );
  const result: MapRelationship[] = [];
  for (const rel of rels) {
    // For activation chains, side stores position ('1','2',...) — order numerically.
    const orderBy = rel.type === 'activation_chain'
      ? 'ORDER BY CAST(side AS INTEGER) ASC'
      : '';
    const members = await db.getAllAsync<{ part_id: string }>(
      `SELECT part_id FROM relationship_members
       WHERE relationship_id = ? AND member_type = 'part' AND part_id IS NOT NULL
       ${orderBy}`,
      [rel.id],
    );
    result.push({ ...rel, member_part_ids: members.map((m) => m.part_id) });
  }
  return result;
}

export async function deletePartImage(
  db: SQLite.SQLiteDatabase,
  imageId: string,
  partId: string,
): Promise<void> {
  // Fetch file paths before deleting
  const row = await db.getFirstAsync<{ rect_uri: string; circle_uri: string; original_uri: string }>(
    `SELECT rect_uri, circle_uri, original_uri FROM part_images WHERE id = ?`,
    [imageId],
  );

  await db.runAsync(`DELETE FROM part_images WHERE id = ?`, [imageId]);

  // Clear current_image_id on the part if it referenced this image
  await db.runAsync(
    `UPDATE parts SET current_image_id = NULL
     WHERE id = ? AND current_image_id = ?`,
    [partId, imageId],
  );

  // Set the most recent remaining image as current (if any)
  const next = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM part_images WHERE part_id = ? ORDER BY created_at DESC LIMIT 1`,
    [partId],
  );
  if (next) {
    await db.runAsync(
      `UPDATE part_images SET is_current = 1 WHERE id = ?`,
      [next.id],
    );
    await db.runAsync(
      `UPDATE parts SET current_image_id = ? WHERE id = ?`,
      [next.id, partId],
    );
  }

  // Delete files from disk (best-effort — don't crash if file is gone)
  if (row) {
    const FileSystem = await import('expo-file-system/legacy');
    for (const uri of [row.rect_uri, row.circle_uri, row.original_uri]) {
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch { /* file may already be gone */ }
    }
  }
}

// === FEEL TOWARDS EDGES ===

export interface FeelingEdge {
  id: string;
  from_part_id: string;
  to_part_id: string;
  feelings_json: string;
  source: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
  from_part_name: string | null;
  from_part_type: string | null;
  to_part_name: string | null;
  to_part_type: string | null;
}

export interface FeelingEdgeHistory {
  id: string;
  edge_id: string;
  feelings_json: string;
  source: string;
  session_id: string | null;
  recorded_at: string;
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export async function upsertFeelingEdge(params: {
  fromPartId: string;
  toPartId: string;
  feelings: string[];
  source: 'meeting_space' | 'manual' | 'technique';
  sessionId?: string | null;
}): Promise<string> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const feelingsJson = JSON.stringify(params.feelings);

  let fromId = params.fromPartId;
  let toId = params.toPartId;
  if (fromId === '__self__' || toId === '__self__') {
    const selfPart = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM parts WHERE type = 'self' LIMIT 1",
    );
    if (!selfPart) return '';
    if (fromId === '__self__') fromId = selfPart.id;
    if (toId === '__self__') toId = selfPart.id;
  }

  const existing = await db.getFirstAsync<{ id: string; feelings_json: string }>(
    'SELECT id, feelings_json FROM feel_towards_edges WHERE from_part_id = ? AND to_part_id = ?',
    [fromId, toId],
  );

  if (existing) {
    const historyId = makeId();
    await db.runAsync(
      `INSERT INTO feel_towards_history (id, edge_id, feelings_json, source, session_id, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [historyId, existing.id, existing.feelings_json, params.source, params.sessionId ?? null, now],
    );
    await db.runAsync(
      `UPDATE feel_towards_edges
       SET feelings_json = ?, source = ?, session_id = ?, updated_at = ?
       WHERE id = ?`,
      [feelingsJson, params.source, params.sessionId ?? null, now, existing.id],
    );
    return existing.id;
  } else {
    const newId = makeId();
    await db.runAsync(
      `INSERT INTO feel_towards_edges
         (id, from_part_id, to_part_id, feelings_json, source, session_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, fromId, toId, feelingsJson, params.source, params.sessionId ?? null, now, now],
    );
    return newId;
  }
}

export async function getAllFeelingEdges(): Promise<FeelingEdge[]> {
  const db = getDatabase();
  return db.getAllAsync<FeelingEdge>(`
    SELECT
      fte.*,
      p_from.display_name as from_part_name,
      p_from.type as from_part_type,
      p_to.display_name as to_part_name,
      p_to.type as to_part_type
    FROM feel_towards_edges fte
    LEFT JOIN parts p_from ON p_from.id = fte.from_part_id
    LEFT JOIN parts p_to ON p_to.id = fte.to_part_id
    ORDER BY fte.updated_at DESC
  `);
}

export async function getFeelingEdgesForPart(partId: string): Promise<FeelingEdge[]> {
  const db = getDatabase();
  return db.getAllAsync<FeelingEdge>(`
    SELECT
      fte.*,
      p_from.display_name as from_part_name,
      p_from.type as from_part_type,
      p_to.display_name as to_part_name,
      p_to.type as to_part_type
    FROM feel_towards_edges fte
    LEFT JOIN parts p_from ON p_from.id = fte.from_part_id
    LEFT JOIN parts p_to ON p_to.id = fte.to_part_id
    WHERE fte.from_part_id = ? OR fte.to_part_id = ?
    ORDER BY fte.updated_at DESC
  `, [partId, partId]);
}

export async function getFeelingEdgeHistory(edgeId: string): Promise<FeelingEdgeHistory[]> {
  const db = getDatabase();
  return db.getAllAsync<FeelingEdgeHistory>(
    'SELECT * FROM feel_towards_history WHERE edge_id = ? ORDER BY recorded_at DESC',
    [edgeId],
  );
}

export async function deleteFeelingEdge(edgeId: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM feel_towards_history WHERE edge_id = ?', [edgeId]);
  await db.runAsync('DELETE FROM feel_towards_edges WHERE id = ?', [edgeId]);
}
