/**
 * Dev-only seed utility — bypasses the assessment flow for rapid testing.
 *
 * Call seedTestData() to populate the DB with a representative completed
 * first-mapping session: 4 named parts (one per cluster), 1 shadowed exile
 * node, 1 part relationship, and 1 self-energy check-in.
 *
 * This file should never be imported in production code paths.
 * It is tree-shaken away in release builds because every call site
 * is guarded by `if (__DEV__)`.
 */

import * as Crypto from 'expo-crypto';
import { getDatabase } from './database';

const now = () => new Date().toISOString();

export async function seedTestData(): Promise<void> {
  const db = getDatabase();

  // ── IDs ──────────────────────────────────────────────────────────────────────
  const sessionId   = Crypto.randomUUID();
  const partAId     = Crypto.randomUUID(); // Manager  — Cluster A
  const partBId     = Crypto.randomUUID(); // Firefighter — Cluster B
  const partCId     = Crypto.randomUUID(); // Manager  — Cluster C
  const partDId     = Crypto.randomUUID(); // Manager  — Cluster D
  const shadowId    = Crypto.randomUUID(); // Shadowed exile
  const relationId  = Crypto.randomUUID(); // Relationship A↔B
  const checkinId   = Crypto.randomUUID(); // Self-energy baseline

  const ts = now();

  await db.withTransactionAsync(async () => {

    // ── 1. Assessment session ─────────────────────────────────────────────────
    await db.runAsync(
      `INSERT OR REPLACE INTO assessment_sessions
         (id, assessment_type, status, current_phase, current_cluster,
          responses_json, inferences_json, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        'first_mapping',
        'complete',
        'phase3',
        'D',
        JSON.stringify({ seeded: true }),
        JSON.stringify({ manager: 4, firefighter: 3, exile: 2, inner_critic: 3 }),
        ts,
        ts,
      ],
    );

    // ── 2. Named parts ────────────────────────────────────────────────────────

    // Cluster A — Manager
    await db.runAsync(
      `INSERT OR REPLACE INTO parts
         (id, name, custom_name, type, backend_classification,
          intensity, activation_status, discovered_via, status,
          is_elaborated, is_refined, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [partAId, 'The Architect', null, 'manager', 'Perfectionist',
       7, 'high', 'first_mapping', 'named', 0, 0, ts, ts],
    );

    // Cluster B — Firefighter
    await db.runAsync(
      `INSERT OR REPLACE INTO parts
         (id, name, custom_name, type, backend_classification,
          intensity, activation_status, discovered_via, status,
          is_elaborated, is_refined, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [partBId, 'The Escape Hatch', null, 'firefighter', 'Escape Artist',
       6, 'moderate', 'first_mapping', 'named', 0, 0, ts, ts],
    );

    // Cluster C — Manager (relational)
    await db.runAsync(
      `INSERT OR REPLACE INTO parts
         (id, name, custom_name, type, backend_classification,
          intensity, activation_status, discovered_via, status,
          is_elaborated, is_refined, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [partCId, 'The Peacemaker', null, 'manager', 'Peacemaker',
       5, 'moderate', 'first_mapping', 'named', 0, 0, ts, ts],
    );

    // Cluster D — Manager (inner critic)
    await db.runAsync(
      `INSERT OR REPLACE INTO parts
         (id, name, custom_name, type, backend_classification,
          intensity, activation_status, discovered_via, status,
          is_elaborated, is_refined, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [partDId, 'The Critic', null, 'manager', 'Inner Critic',
       8, 'high', 'first_mapping', 'named', 0, 0, ts, ts],
    );

    // ── 3. Shadowed exile node ────────────────────────────────────────────────
    await db.runAsync(
      `INSERT OR REPLACE INTO shadowed_nodes
         (id, inferred_type, inferred_backend_classification,
          connected_to_part_id, revealed_by_assessment,
          map_position_x, map_position_y, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [shadowId, 'exile', 'Abandoned Child', partDId,
       'first_mapping', null, null, ts],
    );

    // ── 4. Part relationship (A ↔ B — protective) ────────────────────────────
    await db.runAsync(
      `INSERT OR REPLACE INTO part_relationships
         (id, part_a_id, part_b_id, relationship_type, direction,
          strength, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [relationId, partAId, partBId, 'protective', 'mutual',
       7, 'inferred', ts, ts],
    );

    // ── 5. Self-energy check-in (baseline) ───────────────────────────────────
    await db.runAsync(
      `INSERT OR REPLACE INTO self_energy_checkins
         (id, check_type, overall_percentage, eight_cs_json,
          blended_parts_json, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        checkinId,
        'full',
        42,
        JSON.stringify({
          calm: 4, curious: 5, compassionate: 3, connected: 3,
          confident: 4, creative: 3, courageous: 3, clear: 4,
        }),
        JSON.stringify([partAId, partDId]),
        'Seeded baseline — dev only',
        ts,
      ],
    );
  });
}
