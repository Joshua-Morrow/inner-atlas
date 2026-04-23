# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

Inner Atlas is a clinical IFS (Internal Family Systems) therapy support tool. Clients identify, name, and map their internal parts — supporting work between and during therapy sessions. V1 is a free, local-only tool for a solo IFS practitioner (Joshua) and his clients.

**Core metaphor:** An interactive atlas of the internal system — parts as territories, Self as the cartographer.

---

## Current Build Phase

**[ UPDATE THIS EACH SESSION ]**

Last completed:
- [x] Phase 0 Foundation — complete as of 2026-03-17
- [x] Phase 1 Parts Core — complete as of 2026-03-23
- [ ] Phase 2 Clinical Tools — partially complete (see below)
- [ ] Phase 2.5 Part Images + Node Shape Redesign
- [ ] Phase 3 Depth Features
- [ ] Phase 4 Polish + Distribution

**What's actually built so far (as of 2026-04-22):**

**Phase 2 — 2026-04-22 Graph Layout Round 2 — Edge Routing, SVG RelMap, New Types, Hit-Area Fix:**
- `lib/graph-layout.ts`: `clipLineToNodeBoundaries` + `routeAroundObstacles` + `Obstacle` interface added. Edges clip to node surfaces and route around obstacle nodes (up to 2 waypoints, SVG bezier path).
- `PartsMapCanvas.tsx`: All edges clipped + routed. `buildEdgePath` builds 0/1/2-waypoint SVG paths. Activation chain → sequential pairs only (DB order-preserved). New types `protective` (solid #5B7FB8) and `activation_chain` (dashed #B88A00 + arrowhead). Hit-area rewritten as ellipse matching visible node extent (nodeBottomY); `+28` hack removed; console.log removed.
- `PartsMapNode.tsx`: Removed trailing transparent hit-area Circle.
- `MeetingRelMap.tsx`: Full SVG rewrite; Self anchored at bottom-center (canvasHeight-70); force layout biased upward (centerY=40%); edges clipped + routed; touch via absolutely-positioned TouchableOpacity over pointerEvents=none SVG wrapper.
- `new-relationship.tsx`: `protective` + `activation_chain` types added (picker, Step 3 UI, DB writes). Protective writes side='a'/'b'. Chain writes side='1','2','3'... with reorder controls.
- `lib/database.ts`: `getMapRelationships` orders chain members by CAST(side AS INTEGER).
- `app/(tabs)/explore.tsx`: Protective added to REL_LEGEND.

**Phase 2 — 2026-04-22 Graph Layout System + Focus Mode:**
- `lib/graph-layout.ts` (new): Fruchterman-Reingold force-directed layout, pure TS, no deps. Forces: repulsion, spring, centering, group attraction. Collision resolution, cooling schedule, early convergence.
- Parts Map: force layout wired into `PartsMapCanvas` (after radial seed); Self always pinned at center; dragged parts (position_x != null) pinned at saved DB position; layout edges use alliance/polarization/chain spring constants.
- Tap diagnostic: hit radius bumped from +18 to +28; `gs.x0/gs.y0` fallback for Android pure-tap bug; console.log diagnostic.
- `onPartPress` changed to `(part: MapPart | null) => void` — empty-canvas tap passes null.
- Focus Mode (both maps): tapping a node dims all unrelated edges/labels; tapping the focused node or empty space exits focus.
- Feeling label collision avoidance: AABB + node-circle checks, up to 6 slide attempts perpendicular to edge.
- Reset Layout button now shows `Alert.alert` confirmation before clearing positions.
- `MeetingRelMap`: ring layout replaced with force layout (useMemo, one-shot, no persistence); nodes wrapped in TouchableOpacity for focus mode.

**Phase 2 — 2026-04-22 Map/Relationships Integration: Prompt B + Prompt C:**
- Parts Map: Self label y-position fixed (was `size * 0.35`, now `4` — label was rendering below visual center)
- Parts Map: Atlas/Feelings toggle in Map header; feel-towards edges rendered as bezier curves with arrowhead dots (quadratic bezier t=0.85) + feeling label overlays; structural edges faded to 25% opacity in Feelings mode; legend switches between structural/feeling descriptions
- NodeDetailSheet: shows "Feeling connections" panel (from + to) when `viewMode === 'feelings'`
- `explore.tsx`: reads `mode=feelings` URL param on focus; sets Feelings toggle automatically when navigated from Relationships
- Relationships screen: converted to tabbed layout (Structures + Feelings tabs); Feelings tab groups edges by from-part with chips; "View on Map" button; gold "Add Feeling Connection" footer button
- New screen `/feeling-edge-detail`: view current feelings, edit (3-group chip selector), delete with confirmation, history timeline
- New screen `/add-feeling-connection`: 3-step manual flow (select from-part → select to-part → chip selector); shows "Existing — will update" for known pairs; calls `upsertFeelingEdge` source='manual'
- Routes registered: `feeling-edge-detail`, `add-feeling-connection`

**Phase 2 — 2026-04-22 Map/Relationships Integration: Data Foundation:**
- DB: `feel_towards_edges` + `feel_towards_history` tables added to `runMigrations()` newTables array
- DB: `FeelingEdge` + `FeelingEdgeHistory` interfaces; `upsertFeelingEdge` (history snapshot on update, `__self__` sentinel resolution), `getAllFeelingEdges`, `getFeelingEdgesForPart`, `getFeelingEdgeHistory`, `deleteFeelingEdge` helpers in `lib/database.ts`
- Meeting Space: `saveSession()` now writes all feel-towards edges to `feel_towards_edges` on complete; history tracked automatically on re-run; `sessionRowId` captured for consistent INSERT/UPDATE referencing
- Meeting Space: Screen 4 filter fix — parts that Part Y has already expressed feelings toward in-session are excluded from `otherParticipants` picker (outgoing-only; no historical data consulted)
- MeetingFeelTowardsSeq: Screen 1 Continue button disabled when no feelings selected and freeText empty; Screen 4 filter also excludes `currentTargetId`

**What's actually built so far (as of 2026-04-15):**

**Phase 2 — 2026-04-15 Elaboration v3:**
- Getting to Know: 3-stage progressive part exploration screen (`/getting-to-know`); Stages 1–3 mapped to part_profiles columns; accent-colored header + left-bar cards; auto-save on blur + Save button
- Elaboration menu: new "Getting to Know" Section A with 3 stage cards + status badges; Guided Explorations now 11 items (added Permissions + Exile Contact); Memories renamed to "Story, History & Memories"
- Descriptor Explorer: all category trays now start collapsed; collapsed tray with selections shows "X selected" summary in type colour
- Guided Explorations: "Explore deeper" collapsible read-only prompt section on all topics; Permissions (consent_given + safety_needs + agreement_requested) and Exile Contact (exile_contact_notes) added; desires_needs pre-populates from gtk_needs_from_self if desires is empty
- DB migrations: 14 new part_profiles columns (gtk_* + permissions + exile_contact_notes)

**What's actually built so far (as of 2026-04-13):**

**Phase 0** — Scaffold, DB init (SQLCipher, 15 tables), NativeWind v4, navigation shell, tab bar, dashboard empty state.

**Phase 1** — Full First Mapping Assessment (Phases 1–3: The Moment, Clusters A–D + Naming Moments, Connections + Three-Screen Reveal). Parts Map Fog of War (pure RN, shadowed nodes, bottom-sheet tap detail). Two-state Dashboard. Manual Add Part. Parts Inventory (my-parts). Part Profile (3-zone full view + action buttons).

**Phase 2 (complete items)** — Inner Dialogue (multi-party, start/session/review). Techniques Library v2 (6-week program, 3 category sections, Practice Log button). Technique Detail (collapsible tutorial + framing). Technique Session (dynamic 5-step-type runner, ground button weeks 3–6, inline completion, saves to practice_sessions). Technique Log (compliance strip, session history, week filter). Breathing Timer (standalone). Update Logger. Trailhead (entry, session, review, ground button, exile discovery, DB save, Part Profile Trailhead History + Activity Log). Elaboration v2 (menu-driven explorer hub: 4 descriptor sections with word chip selection + tag input, 8 guided explorations with freetext + tag columns, part_memories table, ground button for exile memories). Relationships Layer 1 (polarizations + alliances data model, list, 3-step creation wizard, inline-editable profile, member management, part-profile Relationships section, dashboard card, dialogue-start/dialogue relationshipId support). Refine Part (full redesign: 4 sections, clear buttons, cascade delete).

**Phase 2 (pending verification)** — Refine tabbed sections fix, Elaboration menu status badges, descriptor explorer Save button.

**Phase 2 — 2026-04-03 session additions:**
- Dashboard: removed Add Part + Breathing Timer quick actions; 9-button 3-column outlined grid
- My Parts: FAB replaced with full-width labeled "Add Part" button pinned to bottom
- Technique sessions: record actual time spent; log shows "Time spent: X min Y sec"
- Technique session back arrow: goes to previous step; step 0 shows quit confirmation; "Quit" header button
- Technique session quit: saves `status: "incomplete"` in notes_json; resume from technique-detail
- Part Profile activity log: technique tap → `/technique-log?sessionId=…` (auto-expands)
- RFB breathing rate slider (4.0–7.0s, step 0.1); rate saved + shown in log

**Phase 2 — 2026-04-13 session (Round 2 — 12 Bug Fixes):**
- Bell sound: path corrected to `@/assets/Bell.mp3`; `Audio.setAudioModeAsync({ playsInSilentModeIOS: true })` added (RFBTimerStep + MindfulnessPracticeStep)
- Mindfulness "sit with" note: `handleAddNote` in MindfulnessPracticeStep now wires to `ExperienceLogEntry.onAddNote` — checkmark persists text
- Mindfulness practice log: `technique-log.tsx` condition extended to `mindfulness-practice` step type
- Removed floating unblend button from `ExperienceLogStep` (redundant in Unblending week)
- "Unknown part" option added to part-linking phase (ExperienceLogStep) and identify-part phase (UnblendCycleStep)
- Ground button hidden during `part-linking` phase via `experienceLogPhase` state + `onPhaseChange` prop
- Inline new-part save in `UnblendCycleStep` identify-part phase (localParts state, DB write, auto-select, confirm)
- `UnblendSupportCard`: `selectedFeelings` prop renders amber feeling pills row in unblending mode
- Inquiry picker: filters out already-answered questions; shows completion state when all answered
- `MeetingDialogueStep`: 4 support buttons replaced with single collapsible tray (toggle at bottom:88, items at 148–372, dismiss overlay, `onGround` prop)
- Speaker chip row: horizontal scroll affordance with right-fade overlay + 3s scroll hint text
- `RelationalSnapshot.tsx` (new): static Self/parts diagram from meeting-space session data
- `technique-log.tsx`: extracts + renders `relational_snapshot` from notes_json in SessionCard (expanded)
- `technique-session.tsx` `saveSession`: builds relational snapshot from feel-towards step response and writes to notes_json

**Phase 2 — 2026-04-12 session 5 (Week 6 Meeting Space Fixes):**
- `MeetingGroundCheckStep.tsx` (new): per-part feel-towards loop for meeting-space ground check; parts header strip with status; multi-part blending check; new parts saved to DB and added to meeting room via `onNewPartsAdded`
- `technique-session.tsx`: FIX 1 — Continue disabled with < 2 parts on multi-select (label shows "Select N more"); FIX 2 — `unblend-cycle` for `meeting-space` renders `MeetingGroundCheckStep`
- `MeetingDialogueStep.tsx`: FIX 3 — live `localParts`/`localSelectedIds` state; FIX 4 — dialogue pre-populated with 3 opening prompt responses; FIX 5 — 32px circular avatar per message; FIX 6 — inline new-part save in opening prompts; FIX 7 — unblend button → two-option choice modal; FIX 8 — "Close meeting" outlined pill button at bottom-left

**Phase 2 — 2026-04-12 session 4 (Week 3 Unblending Fixes):**
- `ExperienceEntry` interface extended: `noticeText?`, `additionalNotes?`, `linkedPartId?`, `linkedPartName?`
- `ExperienceLogEntry`: tap → expand with "sit with" TextInput + save; long-press → delete; renders noticeText (gold), linkedPartName (blue), additionalNotes (bullets)
- `UnblendSupportCard.onHaveSpace` signature: `(noticeText?: string) => void` — unblending mode passes note text on dismiss
- `ExperienceLogStep`: full phase machine (`'log' | 'unblend-support' | 'part-linking'`); after each unblend, links entry to a part (select from atlas or save inline); floating unblend button at `bottom: 208` for on-demand unblend; FAB at `bottom: 80`; removed `router.push('/add-part')`
- `technique-session.tsx`: `ExperienceLogStep` receives `parts={parts}`; ground button at `bottom: 144` for `experience-log` steps (override via inline style)

**Phase 2 — 2026-04-12 session 3 (Week 2 Parts Mindfulness):**
- New `'mindfulness-practice'` step type (added to TechniqueStep union + SELF_MANAGING_TYPES)
- parts-mindfulness now has 2 steps: `before` (input) + `mindfulness-practice` (combined)
- `MindfulnessPracticeStep`: dual-zone layout — breathing circle (top, fixed) + log (scrollable)
- Timer Start/Pause/Resume with 5s breath phase, elapsed counter, duration picker (5/10/15/20 min)
- Bell sound at each breath transition (expo-av, same pattern as RFB, silent fail)
- After each log entry: UnblendSupportCard in mindfulness mode ("Something arose.")
- `UnblendSupportCard` now has `mode?: 'unblending' | 'mindfulness'` prop

**Phase 2 — 2026-04-12 session 2 (Week 1 RFB Fixes):**
- RFB timer step is now self-managing (`isRFBTimer` flag + `RFBTimerStep` component)
- Pre-start screen: duration input (1–60 min), rate slider, bell sound toggle (Switch)
- Active timer: breathing circle + controls + "I'm done" button
- Bell sounds via expo-av: fresh Audio.Sound per transition, overlapping naturally, silent on failure
- `assets/sounds/copper-bell-ding.mp3` placeholder created — replace with actual file
- BreathingCircle accepts optional `onPhaseChange` callback via stable ref pattern

**Phase 2 — 2026-04-12 session (Pre-Technique Global Fixes):**
- Removed duplicate `after` step from all 6 technique steps arrays — inline CompletionScreen is the one end screen
- Ground button: icon changed to `leaf-outline`, size 20, color #9B9A94, bg #1E1E1C with border, label "Ground"
- Unblend button: icon changed to `git-branch-outline` everywhere (InquiryQuestionsStep, MeetingDialogueStep)
- All support buttons standardized to right side: ground at bottom:100, unblend at bottom:164, rules at bottom:228, reframe at bottom:292 — all 52×52 with #1E1E1C bg + #2A2927 border
- Practice log: complex step types now render readable content (experience-log, unblend-cycle, inquiry-questions, meeting-dialogue) instead of raw JSON
- Technique detail: dismiss (×) button next to "Resume last session" — clears incomplete session with confirmation alert
- Inline part save: "Note a new part" in part-select step now saves to DB, auto-selects, shows confirmation — no navigation away
- parts state in technique-session uses setParts for immediate update after inline save

**Phase 2 — 2026-04-03 session 2 additions (Technique Flow Improvements):**
- New step types: `experience-log`, `unblend-cycle`, `inquiry-questions`, `meeting-space-setup`, `meeting-rules`, `meeting-dialogue`
- Shared constants: `FEEL_TOWARDS_SELF_QUALITIES`, `FEEL_TOWARDS_REACTIVE`, `INQUIRY_QUESTIONS` in techniques-data.ts
- New components: `UnblendSupportCard`, `ExperienceLogEntry`, `ExperienceLogStep`, `UnblendCycleStep`, `InquiryQuestionsStep`, `MeetingSpaceSetupStep`, `MeetingRulesStep`, `MeetingDialogueStep`
- Parts Mindfulness: live experience log with + button and category modal
- Unblending: experience log with UnblendSupportCard after each entry
- Feel Towards: full unblend-cycle loop with expanded chip list (Self-energy + Reactive groups)
- Inquiry: unblend-cycle + rotating question picker + floating Unblend button
- Meeting Space: multi-select parts + space setup + rules + full dialogue canvas with support buttons

---

## Dev Commands

All commands run from the project root unless noted.

```bash
# Start dev server (opens Expo Go on device or simulator)
npm run start          # or: cd apps/mobile && npx expo start

# Platform-specific
npm run ios            # iOS simulator
npm run android        # Android emulator
npm run web            # Web browser

# Lint
cd apps/mobile && npm run lint

# Reset to blank Expo project (destructive — rarely needed)
cd apps/mobile && npm run reset-project
```

No test runner is configured yet. TypeScript is checked via `tsc` (config at `apps/mobile/tsconfig.json`).

---

## Monorepo Structure

```
apps/mobile/           ← Expo managed workflow app (iOS + Android + Web)
  app/                 ← Expo Router file-based routes
    _layout.tsx        ← Root Stack navigator
    (tabs)/            ← Tab group (currently default Expo scaffold)
  components/          ← App-level components
  hooks/               ← App-level hooks
  constants/           ← Colors, layout constants

packages/shared/       ← Business logic + IFS domain types (no RN deps)
  src/types/ifs.ts     ← All domain interfaces (Part, Profile, Assessment, etc.)
  src/types/design-system.ts
  src/index.ts

packages/ui/           ← Shared component library (to be built)
  src/index.ts

docs/                  ← Reference docs for Claude Code sessions (read before building)
```

Import alias `@/` maps to `apps/mobile/` (configured in tsconfig).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo (managed workflow) |
| Navigation | Expo Router (file-based) |
| Database | expo-sqlite — LOCAL ON-DEVICE, encrypted with SQLCipher |
| App Lock | expo-local-authentication (Face ID / Touch ID / PIN) |
| Secure Storage | expo-secure-store (keys, PIN hash) |
| Backup Encryption | crypto-js AES-256 |
| State | Zustand + React Query |
| UI | NativeWind (Tailwind for RN) |
| Map Canvas | React Native Skia |
| Targets | iOS, Android, Web |
| Cloud sync | Supabase — opt-in only, Phase 5+, NOT built yet |

---

## Storage Model: Local-First (Critical)

**All data lives on the user's device. No accounts. No cloud. Nothing transmitted.**

- PHI (parts profiles, dialogue logs, assessment data) never leaves the device
- Therapist accesses only a content-free Clinical Metrics Export — never parts content
- Do NOT add Supabase, cloud storage, or any network data transmission unless explicitly instructed

**Database init sequence (first launch):**
1. Generate SQLCipher key via `Crypto.getRandomValues()` → store in expo-secure-store key `db_encryption_key`
2. Open encrypted SQLite DB using that key — DB file: `inner-atlas.db`
3. Run schema migrations from `docs/architecture/SCHEMA.md`
4. `PRAGMA foreign_keys = ON`

---

## Key Rules

### IFS Terminology (Non-Negotiable)
- Say "part" NOT "emotion" or "aspect of yourself"
- Say "active" NOT "triggered"
- Say "blended with" NOT "controlled by"
- Say "Self-energy" NOT "mindfulness" or "calm state"
- Say "system" for the totality of parts
- Say "unburdening" NOT "healing"
- Never use clinical pathology language (no "symptoms," "disorder," "dysfunction")

### Part Naming (Critical UX Rule)
- Backend classifications (Perfectionist, Abandoned Child, etc.) are NEVER shown to users
- Users name every part themselves via a guided Naming Moment after each discovery
- `part.display_name` = `COALESCE(custom_name, name)` — this is the ONLY label shown in UI
- Micro-capture after naming: "How do you feel toward [name] right now?" (Self-energy data, never scored)
- Every naming moment ends with an opening, not a closure

### Security Rules (Non-Negotiable)
- Database is ALWAYS encrypted at rest via SQLCipher — never open unencrypted DB
- PIN hash stored ONLY in expo-secure-store — never in SQLite, never logged
- Encryption key stored ONLY in expo-secure-store — never hardcoded, never logged
- Never render any app content before app lock authentication passes
- Ground button MUST be visible on all Trailhead (step >= self_checkin), Exile Elaboration, and Meeting Space screens
- All SQLite queries use parameterized statements — no string interpolation

### Design System Colors
- Manager: `#3B5BA5` (deep blue) / light: `#EEF2FF`
- Firefighter: `#C2600A` (amber) / light: `#FFF7ED`
- Exile: `#7C3D9B` (violet) / light: `#F5F0FF`
- Self: `#B88A00` (gold) / light: `#FFFBEB`
- Background: `#FAFAF8` / Surface: `#FFFFFF` / Border: `#E5E3DE`
- Text primary: `#1C1B19` / Text secondary: `#6B6860`

### Node Shapes (Parts Map)
- Manager = rounded rectangle (12px radius), solid fill, white label text
- Firefighter = 8-point starburst polygon
- Exile = soft circle, slightly smaller than Manager
- Self = large octagon (20% bigger), gold fill, radiant subtle glow
- Shadowed/undiscovered nodes = same shapes but darkened, blurred, in "fog"

---

## Self-Annealing Repair Loop

When any tool, script, or build step fails:

1. **Analyze** — Read the full stack trace. Identify the exact line and cause. State your diagnosis before touching code.
2. **Patch** — Fix only the specific component that failed. One change at a time.
3. **Test** — Run the minimal test confirming the broken thing now works.
4. **Document** — Add a `> ⚠ Learned [date]: [what] — [why] — [how fixed]` note to the relevant doc in `docs/`.
5. **Update Progress** — Append a brief summary to `progress.md`.

---

## Session Files (Project Root)

| File | Purpose |
|---|---|
| `task_plan.md` | Current phase checklist — update as tasks complete |
| `progress.md` | Session log — append after every session |
| `findings.md` | Constraints, API quirks, library gotchas |

These are the project's memory between sessions. Never delete them.

---

## Docs Index

Read the relevant doc before building any feature:

- `docs/architecture/SCHEMA.md` ← full SQLite schema
- `docs/architecture/TECH_STACK.md` ← storage model detail
- `docs/architecture/FEATURE_INTEGRATION_MAP.md`
- `docs/features/ASSESSMENT_REDESIGN.md` ← most critical feature doc
- `docs/features/SECURITY_AND_BACKUP.md` ← security, backup, ground button spec
- `docs/features/PARTS_MAP_FOG_OF_WAR.md`
- `docs/ifs-domain/IFS_PRIMER.md`
- `docs/ifs-domain/PARTS_DATABASE.md`
- `docs/ifs-domain/ASSESSMENT_LOGIC.md`
- `docs/design/DESIGN_SYSTEM.md`
- `docs/content/` ← JSON content files (assessment questions, techniques, wiki)
