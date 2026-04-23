# Inner Atlas — Task Plan

## Phase 0: Foundation

- [x] Monorepo structure (apps/mobile, packages/shared, packages/ui)
- [x] Expo managed workflow scaffold
- [x] app.json — bundle IDs, plugins, Face ID permission, newArchEnabled
- [x] All dependencies installed (NativeWind, Skia, SQLite, Zustand, React Query, etc.)
- [x] IFS domain types — `packages/shared/src/types/ifs.ts`
- [x] Design system constants — `packages/shared/src/types/design-system.ts`
- [x] Navigation shell — Expo Router with tab layout
- [x] NativeWind v4 configuration (babel.config.js, metro.config.js, tailwind.config.js, global.css)
- [x] Database service — `apps/mobile/lib/database.ts` (SQLCipher + all 15 tables)
- [x] db-init.sql reference file — `docs/architecture/db-init.sql`
- [x] Root layout — imports global.css, initializes DB before rendering
- [x] Dashboard screen — empty state (replaces default Expo template)
- [x] Map placeholder screen
- [x] Tab bar — Inner Atlas colors (manager blue active, text-secondary inactive)
- [ ] **VERIFY** — App launches on device via Expo Go with no errors
- [ ] **VERIFY** — NativeWind className styles render correctly
- [ ] **VERIFY** — Database initializes (check SecureStore key is set on first run)

**Phase 0 is complete when:** App runs on device showing the Inner Atlas dashboard with no errors.

---

## Phase 1: Parts Core

- [x] First Mapping Assessment — Phase 1: The Moment (5 questions, inference, DB write)
- [x] First Mapping Assessment — Phase 2: Clusters A–D + Naming Moments
- [x] First Mapping Assessment — Phase 3: Connections + Three-Screen Reveal
- [x] Naming Moment screen (part of assessment flow)
- [x] Parts Map screen (Skia canvas — fog of war, node shapes)
- [x] Assessment results → create parts in DB
- [x] Assessment restructure — decoupled from onboarding (2026-03-19)
- [x] Two-state dashboard — first-time + returning states (2026-03-19)
- [x] Manual Add Part screen — guided form, all 5 new profile fields (2026-03-19)
- [x] Schema migration — appearance, job, key_trigger, key_identifier, fears columns (2026-03-19)
- [x] Parts Inventory screen (list of named parts) — my-parts.tsx
- [x] Part Profile screen — full 3-zone view + action buttons

---

## Phase 2: Clinical Tools

- [x] Inner Dialogue (multi-party) — start/session/review (2026-03-23)
- [x] Techniques Library (2026-03-23) — browsable library, session with timer
- [x] Breathing Timer (2026-03-23) — standalone breathing timer
- [x] Update Logger (2026-03-21)
- [x] Relationships Layer 1 (2026-03-21) — polarizations + alliances data model, list, creation wizard, profile (inline edit), member management, part-profile section, dashboard card, dialogue integration
- [x] Trailhead flow (2026-03-21) — entry + session, ground button, exile discovery + relationship, DB save
- [x] Trailhead session save fix (2026-03-21) — schema migrations, correct INSERT/UPDATE columns, back button exit modal
- [x] Trailhead Review screen (2026-03-21) — trailhead-review.tsx, read-only session view
- [x] Part Profile: Trailhead History section (2026-03-21)
- [x] Part Profile: Activity Log section (2026-03-21) — combined feed from all 4 tables
- [x] Elaboration v2 (2026-03-22) — menu-driven explorer, descriptor word chips (4 sections), guided explorations (8 topics), part memories table + UI, part profile Descriptors + Memories sections, refine-part new fields
- [x] Refine Part redesign (2026-03-22) — 4 sections, clear buttons, cascade delete

**Phase 2 — Pending verification:**
- [ ] Verify Refine tabbed sections fix
- [ ] Verify Elaboration menu status badges
- [ ] Verify descriptor explorer Save button

---

## Phase 2.5: Part Images + Node Shape Redesign

- [ ] Schema: add `image_uri TEXT` to `parts` table via migration
- [ ] expo-image-picker integration — camera roll, camera, file upload
- [ ] My Parts cards redesign — glassmorphism card with image filling top portion, frosted glass overlay at bottom with part name + one-line descriptor (job field preview)
- [ ] Map node shape redesign:
  - Self → large gold circle, image inset, gold ring with glow
  - Exile → rounded square, image inset, violet border
  - Manager → hexagon, image inset, blue border
  - Firefighter → shield, image inset, amber border
  - Freed/Unburdened → smaller circle, image inset, lighter luminous version of original type color
  - Shadowed nodes → same shapes, no image, darkened, fog overlay
- [ ] Map relationship lines between connected parts
- [ ] Alliance members clustered on map
- [ ] Polarization tension line visual treatment
- [ ] Fallback when no image: type color fill + part initials centered
- [ ] Part Profile header: large image at top of profile screen

---

## Phase 3: Assessment Redesign

- [ ] New question architecture mapping to 54-part database
- [ ] Proper filtering logic — parts only surface if threshold crossed
- [ ] Scenario-based reaction mapping questions
- [ ] 54 naming moments (draft for clinical review first)
- [ ] Shadowed exile nodes as cliffhanger
- [ ] Assessment as optional feature / sales funnel — not mandatory onboarding

---

## Phase 2: Cycles Feature (2026-03-25)

- [x] Schema: `cycle_annotations` table added via runMigrations() newTables array
- [x] `app/cycles.tsx` — activation history chart screen (pure RN Views, no SVG/Skia)
  - [x] Time range chips: 7D / 30D / 90D / 6M / All (default 30D)
  - [x] Part filter chips with type-color avatars
  - [x] Chart: dark canvas, Y-axis 0–5 labels + gridlines, X-axis date labels
  - [x] Data lines: rotated View segments per part (type color)
  - [x] Data points: filled (intensity set) or outlined (intensity null)
  - [x] Tap dot tooltip: part name, date, activation type, intensity, notes preview
  - [x] Alliance lines (blue 70% opacity) and polarization side lines
  - [x] Annotation bands (color fill + label)
  - [x] Legend row below chart
  - [x] "Add Context" → annotation modal
  - [x] Annotations list (long-press to delete)
  - [x] Empty state when no updates
  - [x] ?partId= pre-filter support
  - [x] useFocusEffect data reload
- [x] `app/update-saved.tsx` — confirmation screen after log-update
  - [x] Animated spring checkmark
  - [x] Part name + type pill
  - [x] Two primary buttons: View Cycles, Back to Atlas
  - [x] Optional third button for trailhead/elaboration explore
  - [x] 5-second countdown auto-navigate
- [x] `app/log-update.tsx` modified:
  - [x] Intensity section moved BEFORE "What happened?" section
  - [x] Intensity label updated to include cycles tracking context
  - [x] Intensity hint added: "builds your Cycles map over time"
  - [x] Dots enlarged to 32px
  - [x] After save: navigates to /update-saved instead of router.back()
- [x] `app/(tabs)/index.tsx` modified:
  - [x] "Cycles" card added after "Updates" in ReturningState
  - [x] Mini cycles preview widget (dark canvas, 100px height, last 7 days, top 3 parts)
- [x] `app/part-profile.tsx` modified:
  - [x] "Activation History" section in Zone 3 (before Activity Log)
  - [x] 140px mini chart, last 30 days, part's type color
  - [x] "View all →" → /cycles?partId=
- [x] `app/_layout.tsx`: routes for cycles + update-saved added

---

## Phase 3: Additional Features

- [ ] Body Map feature (somatic experience, body regions)
- [ ] Self-Energy Check-in as standalone feature
- [ ] Wiki / DataLinks in-app reference
- [ ] Mini-assessments (6) — reconsider scope
- [ ] App Lock (PIN + biometric)
- [ ] Backup & Restore with optional encryption
- [ ] Settings screen (Privacy, Backup, Support)
- [ ] "Buy Me a Coffee" donation button
- [ ] Practice info / IFS consultation links
- [ ] About & Support section

---

## Phase 3: Depth Features (existing)

- [x] Elaboration — entry + session + review, ground button (exile), DB migrations, part profile integration (2026-03-21)
- [x] Elaboration v2 — menu-driven explorer, descriptor word chips (4 sections), guided explorations (8 topics), part memories table + UI, part profile Descriptors + Memories sections, refine-part new fields (2026-03-22)
- [ ] Body Map
- [ ] Wiki
- [ ] System Snapshots

---

## Phase 4: Polish + Distribution

- [ ] Glassmorphism effects (require EAS build)
- [ ] SafeAreaView deprecation fixes
- [ ] Content review — all text/copy
- [ ] Technique text revisions
- [ ] Elaboration guided prompt revisions
- [ ] Node shape visual refinements
- [ ] Data Export / Import
- [ ] Clinical Metrics Export
- [ ] Settings screen
- [ ] App Lock (Face ID / PIN)
- [ ] Backup reminder
- [ ] Onboarding screen
- [ ] EAS build setup for iOS TestFlight
- [ ] App store submission copy

---

## Deferred / Future

- [ ] Couples Connection feature
- [ ] Therapist Portal
- [ ] Cloud sync (Supabase, opt-in)
- [ ] Selective export (specific parts only)
- [ ] Freed/Unburdened parts unlock mechanism
- [ ] AI-assisted dialogue responses
- [ ] Push notifications
