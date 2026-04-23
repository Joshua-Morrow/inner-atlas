/**
 * Trailhead v2 — All database read/write functions for trailhead tables.
 * All saves are incremental: write immediately, never batch.
 */

import { getDatabase } from '@/lib/database';
import type {
  ChainEntryWithPart,
  EntryType,
  LoopOutcome,
  PartSummary,
  SessionPhase,
  SessionStatus,
  TrailheadChainEntry,
  TrailheadExileContact,
  TrailheadSelfCheck,
  TrailheadSession,
  TrailSummaryRow,
} from '@/lib/trailhead-types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function createTrailheadSession(data: {
  entryType: EntryType;
  entryDescription: string;
  entryIntensity: number | null;
  entryBodyRegions: string | null;
  entrySensationNotes: string | null;
  initialSelfEnergy: number;
}): Promise<number> {
  const db = getDatabase();
  const now = nowIso();
  const result = await db.runAsync(
    `INSERT INTO trailhead_sessions
      (user_id, status, entry_type, entry_description, entry_intensity,
       entry_body_regions, entry_sensation_notes, initial_self_energy,
       current_phase, created_at, updated_at)
     VALUES (1, 'active', ?, ?, ?, ?, ?, ?, 'first_contact', ?, ?)`,
    [
      data.entryType,
      data.entryDescription,
      data.entryIntensity,
      data.entryBodyRegions,
      data.entrySensationNotes,
      data.initialSelfEnergy,
      now,
      now,
    ]
  );
  return result.lastInsertRowId as number;
}

export async function getTrailheadSession(id: number): Promise<TrailheadSession | null> {
  const db = getDatabase();
  return db.getFirstAsync<TrailheadSession>(
    `SELECT * FROM trailhead_sessions WHERE id = ?`,
    [id]
  );
}

export async function updateTrailheadSession(
  id: number,
  updates: Partial<{
    title: string | null;
    status: SessionStatus;
    currentPhase: SessionPhase;
    currentLoopPartId: string | null;
    exilePartId: string | null;
    pausedAtPhase: string | null;
    pausedAtCard: string | null;
    completedAt: string | null;
  }>
): Promise<void> {
  const db = getDatabase();
  const sets: string[] = ['updated_at = ?'];
  const vals: (string | number | null)[] = [nowIso()];

  if ('title' in updates)             { sets.push('title = ?');               vals.push(updates.title ?? null); }
  if ('status' in updates)            { sets.push('status = ?');              vals.push(updates.status!); }
  if ('currentPhase' in updates)      { sets.push('current_phase = ?');       vals.push(updates.currentPhase!); }
  if ('currentLoopPartId' in updates) { sets.push('current_loop_part_id = ?'); vals.push(updates.currentLoopPartId ?? null); }
  if ('exilePartId' in updates)       { sets.push('exile_part_id = ?');       vals.push(updates.exilePartId ?? null); }
  if ('pausedAtPhase' in updates)     { sets.push('paused_at_phase = ?');     vals.push(updates.pausedAtPhase ?? null); }
  if ('pausedAtCard' in updates)      { sets.push('paused_at_card = ?');      vals.push(updates.pausedAtCard ?? null); }
  if ('completedAt' in updates)       { sets.push('completed_at = ?');        vals.push(updates.completedAt ?? null); }

  vals.push(id);
  await db.runAsync(
    `UPDATE trailhead_sessions SET ${sets.join(', ')} WHERE id = ?`,
    vals
  );
}

export async function listTrailheadSessions(): Promise<TrailSummaryRow[]> {
  const db = getDatabase();
  return db.getAllAsync<TrailSummaryRow>(
    `SELECT
       s.id, s.title, s.entry_type, s.entry_description, s.entry_intensity,
       s.status, s.current_phase, s.exile_part_id,
       s.created_at, s.updated_at, s.completed_at,
       COUNT(ce.id) AS part_count
     FROM trailhead_sessions s
     LEFT JOIN trailhead_chain_entries ce ON ce.session_id = s.id
     GROUP BY s.id
     ORDER BY s.updated_at DESC`
  );
}

export async function recordReentry(sessionId: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE trailhead_sessions
     SET reentry_count = reentry_count + 1,
         last_reentry_at = ?,
         paused_at_phase = NULL,
         paused_at_card = NULL,
         updated_at = ?
     WHERE id = ?`,
    [nowIso(), nowIso(), sessionId]
  );
}

// ─── Chain Entries ────────────────────────────────────────────────────────────

export async function createChainEntry(data: {
  sessionId: number;
  partId: string | null;
  partIsNew: number;
  chainPosition: number;
}): Promise<number> {
  const db = getDatabase();
  const now = nowIso();
  const result = await db.runAsync(
    `INSERT INTO trailhead_chain_entries
      (session_id, part_id, part_is_new, chain_position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.sessionId, data.partId, data.partIsNew, data.chainPosition, now, now]
  );
  return result.lastInsertRowId as number;
}

export async function updateChainEntry(
  id: number,
  updates: Partial<Omit<TrailheadChainEntry, 'id' | 'session_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  const db = getDatabase();
  const sets: string[] = ['updated_at = ?'];
  const vals: (string | number | null)[] = [nowIso()];

  const fieldMap: Record<string, string> = {
    part_id: 'part_id',
    part_is_new: 'part_is_new',
    chain_position: 'chain_position',
    part_role: 'part_role',
    self_energy_at_contact: 'self_energy_at_contact',
    other_parts_blending: 'other_parts_blending',
    blending_notes: 'blending_notes',
    unblending_achieved: 'unblending_achieved',
    unblending_notes: 'unblending_notes',
    somatic_body_regions: 'somatic_body_regions',
    somatic_sensation_desc: 'somatic_sensation_desc',
    somatic_intensity: 'somatic_intensity',
    part_energy_quality: 'part_energy_quality',
    role_duration: 'role_duration',
    part_message_to_self: 'part_message_to_self',
    part_stance_toward_self: 'part_stance_toward_self',
    fear_if_stopped: 'fear_if_stopped',
    role_burden_experience: 'role_burden_experience',
    has_concerns: 'has_concerns',
    concern_description: 'concern_description',
    safety_needs: 'safety_needs',
    fear_of_going_deeper: 'fear_of_going_deeper',
    self_presence_felt: 'self_presence_felt',
    consent_given: 'consent_given',
    consent_notes: 'consent_notes',
    agreement_requested: 'agreement_requested',
    protecting_against: 'protecting_against',
    next_layer_notes: 'next_layer_notes',
    loop_outcome: 'loop_outcome',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in updates) {
      sets.push(`${col} = ?`);
      vals.push((updates as Record<string, string | number | null>)[key] ?? null);
    }
  }

  vals.push(id);
  await db.runAsync(
    `UPDATE trailhead_chain_entries SET ${sets.join(', ')} WHERE id = ?`,
    vals
  );
}

export async function getChainEntries(sessionId: number): Promise<ChainEntryWithPart[]> {
  const db = getDatabase();
  return db.getAllAsync<ChainEntryWithPart>(
    `SELECT ce.*,
            COALESCE(p.custom_name, p.name) AS part_display_name,
            p.type AS part_type
     FROM trailhead_chain_entries ce
     LEFT JOIN parts p ON p.id = ce.part_id
     WHERE ce.session_id = ?
     ORDER BY ce.chain_position ASC`,
    [sessionId]
  );
}

export async function getChainEntry(id: number): Promise<TrailheadChainEntry | null> {
  const db = getDatabase();
  return db.getFirstAsync<TrailheadChainEntry>(
    `SELECT * FROM trailhead_chain_entries WHERE id = ?`,
    [id]
  );
}

// ─── Exile Contact ────────────────────────────────────────────────────────────

export async function createExileContact(sessionId: number): Promise<number> {
  const db = getDatabase();
  const now = nowIso();
  const result = await db.runAsync(
    `INSERT INTO trailhead_exile_contact (session_id, created_at, updated_at) VALUES (?, ?, ?)`,
    [sessionId, now, now]
  );
  return result.lastInsertRowId as number;
}

export async function updateExileContact(
  id: number,
  updates: Partial<Omit<TrailheadExileContact, 'id' | 'session_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  const db = getDatabase();
  const sets: string[] = ['updated_at = ?'];
  const vals: (string | number | null)[] = [nowIso()];

  const fieldMap: Record<string, string> = {
    part_id: 'part_id',
    self_energy_at_transition: 'self_energy_at_transition',
    transition_grounding_used: 'transition_grounding_used',
    apparent_age_quality: 'apparent_age_quality',
    somatic_body_regions: 'somatic_body_regions',
    somatic_sensation_desc: 'somatic_sensation_desc',
    what_it_carries: 'what_it_carries',
    what_it_needs_to_hear: 'what_it_needs_to_hear',
    witnessing_complete: 'witnessing_complete',
    response_when_witnessed: 'response_when_witnessed',
    exile_felt_seen: 'exile_felt_seen',
    contact_notes: 'contact_notes',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in updates) {
      sets.push(`${col} = ?`);
      vals.push((updates as Record<string, string | number | null>)[key] ?? null);
    }
  }

  vals.push(id);
  await db.runAsync(
    `UPDATE trailhead_exile_contact SET ${sets.join(', ')} WHERE id = ?`,
    vals
  );
}

export async function getExileContact(sessionId: number): Promise<TrailheadExileContact | null> {
  const db = getDatabase();
  return db.getFirstAsync<TrailheadExileContact>(
    `SELECT * FROM trailhead_exile_contact WHERE session_id = ?`,
    [sessionId]
  );
}

// ─── Self Checks ──────────────────────────────────────────────────────────────

export async function createSelfCheck(data: {
  sessionId: number;
  chainEntryId: number | null;
  phase: string;
  energyLevel: number;
  groundingUsed?: number;
  groundingType?: string | null;
}): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO trailhead_self_checks
      (session_id, chain_entry_id, phase, energy_level, grounding_used, grounding_type, checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.sessionId,
      data.chainEntryId,
      data.phase,
      data.energyLevel,
      data.groundingUsed ?? 0,
      data.groundingType ?? null,
      nowIso(),
    ]
  );
}

export async function getSelfChecks(sessionId: number): Promise<TrailheadSelfCheck[]> {
  const db = getDatabase();
  return db.getAllAsync<TrailheadSelfCheck>(
    `SELECT * FROM trailhead_self_checks WHERE session_id = ? ORDER BY checked_at ASC`,
    [sessionId]
  );
}

// ─── Parts ────────────────────────────────────────────────────────────────────

export async function getProtectorParts(): Promise<PartSummary[]> {
  const db = getDatabase();
  return db.getAllAsync<PartSummary>(
    `SELECT id, COALESCE(custom_name, name) AS display_name, type
     FROM parts
     WHERE type IN ('manager', 'firefighter')
     ORDER BY type, display_name`
  );
}

export async function getAllParts(): Promise<PartSummary[]> {
  const db = getDatabase();
  return db.getAllAsync<PartSummary>(
    `SELECT id, COALESCE(custom_name, name) AS display_name, type
     FROM parts
     ORDER BY type, display_name`
  );
}

export async function createPartForTrailhead(
  name: string,
  type: 'manager' | 'firefighter'
): Promise<string> {
  const db = getDatabase();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO parts (id, name, type, discovered_via, status, created_at, updated_at)
     VALUES (?, ?, ?, 'trailhead', 'named', ?, ?)`,
    [id, name.trim(), type, now, now]
  );
  await db.runAsync(
    `INSERT INTO part_profiles (part_id, updated_at) VALUES (?, ?)`,
    [id, now]
  );
  return id;
}

export async function createExilePartForTrailhead(name: string): Promise<string> {
  const db = getDatabase();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO parts (id, name, type, discovered_via, status, created_at, updated_at)
     VALUES (?, ?, 'exile', 'trailhead', 'named', ?, ?)`,
    [id, name.trim(), now, now]
  );
  await db.runAsync(
    `INSERT INTO part_profiles (part_id, updated_at) VALUES (?, ?)`,
    [id, now]
  );
  return id;
}

// ─── Integration: write relationships + elaboration data ─────────────────────

export async function writeProtectionRelationships(sessionId: number): Promise<void> {
  const db = getDatabase();
  const entries = await getChainEntries(sessionId);
  const session = await getTrailheadSession(sessionId);
  if (!session) return;

  const now = nowIso();

  // Build ordered list: chain entries + exile if present
  const orderedIds: string[] = entries
    .filter((e) => e.part_id)
    .map((e) => e.part_id!);
  if (session.exile_part_id) orderedIds.push(session.exile_part_id);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry.part_id) continue;
    if (entry.consent_given !== 'yes' && entry.consent_given !== 'hesitant') continue;

    const nextPartId = orderedIds[i + 1];
    if (!nextPartId) continue;

    // Check for existing relationship
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM part_relationships
       WHERE part_a_id = ? AND part_b_id = ? AND relationship_type = 'protects'`,
      [entry.part_id, nextPartId]
    );

    if (!existing) {
      const relId = Date.now().toString(36) + Math.random().toString(36).slice(2);
      await db.runAsync(
        `INSERT INTO part_relationships
          (id, part_a_id, part_b_id, relationship_type, direction, status, created_at, updated_at)
         VALUES (?, ?, ?, 'protects', 'a_to_b', 'confirmed', ?, ?)`,
        [relId, entry.part_id, nextPartId, now, now]
      );
    }
  }
}

export async function writeElaborationData(sessionId: number): Promise<void> {
  const db = getDatabase();
  const entries = await getChainEntries(sessionId);
  const exileContact = await getExileContact(sessionId);
  const now = nowIso();

  for (const entry of entries) {
    if (!entry.part_id) continue;

    // Ensure part_profiles row exists
    const existing = await db.getFirstAsync<{ part_id: string }>(
      `SELECT part_id FROM part_profiles WHERE part_id = ?`,
      [entry.part_id]
    );
    if (!existing) {
      await db.runAsync(
        `INSERT INTO part_profiles (part_id, updated_at) VALUES (?, ?)`,
        [entry.part_id, now]
      );
    }

    // fear_if_stopped → fears (append if already has content)
    if (entry.fear_if_stopped) {
      const cur = await db.getFirstAsync<{ fears: string | null }>(
        `SELECT fears FROM part_profiles WHERE part_id = ?`,
        [entry.part_id]
      );
      const merged = cur?.fears
        ? `${cur.fears}\n---\n${entry.fear_if_stopped}`
        : entry.fear_if_stopped;
      await db.runAsync(
        `UPDATE part_profiles SET fears = ?, updated_at = ? WHERE part_id = ?`,
        [merged, now, entry.part_id]
      );
    }

    // role_burden_experience → burden_description (append)
    if (entry.role_burden_experience) {
      const cur = await db.getFirstAsync<{ burden_description: string | null }>(
        `SELECT burden_description FROM part_profiles WHERE part_id = ?`,
        [entry.part_id]
      );
      const merged = cur?.burden_description
        ? `${cur.burden_description}\n---\n${entry.role_burden_experience}`
        : entry.role_burden_experience;
      await db.runAsync(
        `UPDATE part_profiles SET burden_description = ?, updated_at = ? WHERE part_id = ?`,
        [merged, now, entry.part_id]
      );
    }
  }

  // Exile contact data → exile part_profiles
  if (exileContact?.part_id && exileContact.response_when_witnessed) {
    const existing = await db.getFirstAsync<{ part_id: string }>(
      `SELECT part_id FROM part_profiles WHERE part_id = ?`,
      [exileContact.part_id]
    );
    if (!existing) {
      await db.runAsync(
        `INSERT INTO part_profiles (part_id, updated_at) VALUES (?, ?)`,
        [exileContact.part_id, now]
      );
    }
    await db.runAsync(
      `UPDATE part_profiles
       SET part_perspective = ?, updated_at = ?
       WHERE part_id = ?`,
      [exileContact.response_when_witnessed, now, exileContact.part_id]
    );
  }
}
