# Inner Atlas — Clinical V1
## Master Context File for Claude Code
> Update the "Current Phase" section at the start of every session.

---

## What This App Is

Inner Atlas is a clinical IFS (Internal Family Systems) therapy support tool. It helps clients identify, name, and map their internal parts — and supports ongoing work between and during therapy sessions. This is V1: a free, unrestricted clinical tool for a solo IFS practitioner (Joshua) and his clients.

**Core metaphor:** An interactive atlas of the internal system — parts as territories, Self as the cartographer.

**Tone:** Warm, professional, clinically grounded, non-pathologizing, discovery-oriented.

---

## Current Build Phase

**[ UPDATE THIS EACH SESSION ]**

Example: "Phase 0 complete. Starting Phase 1 Step 1.1 — Parts Inventory Screen."

Last completed:
- [ ] Phase 0 Foundation
- [ ] Phase 1 Parts Core
- [ ] Phase 2 Clinical Tools
- [ ] Phase 3 Depth Features
- [ ] Phase 4 Polish + Distribution

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
| Auth | None required (local-only mode) |
| Cloud sync | Supabase — opt-in only, Phase 5+, NOT built yet |

### Storage Model: Local-First (Critical)

**All data lives on the user's device by default. No accounts. No cloud. Nothing transmitted.**

This is a deliberate architectural and clinical decision:
- PHI (parts profiles, dialogue logs, assessment data) never leaves the device in default mode
- Minimizes HIPAA exposure for solo practitioner use
- Users disclose more in a private local journal than a cloud database
- Therapist accesses only a content-free Clinical Metrics Export — never the parts content itself

Do NOT add Supabase, cloud storage, or any network data transmission unless explicitly instructed. Cloud sync is a Phase 5+ feature, opt-in, with explicit consent.

**Monorepo structure:**
- `apps/mobile/` — Expo app (iOS + Android + Web)
- `packages/shared/` — business logic, IFS domain models
- `packages/ui/` — shared component library
- `docs/` — all reference files for agents

---

## Key Rules — Read Before Every Session

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
- Working titles are provisional only — never treated as the part's identity
- Display the USER'S CHOSEN NAME as the primary label everywhere in the app
- Every naming moment ends with an opening, not a closure
- Micro-capture after naming: "How do you feel toward [name] right now?" (Self-energy data, never scored)

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

### Security Rules (Non-Negotiable)
- Database is ALWAYS encrypted at rest via SQLCipher — never open unencrypted db
- PIN hash stored ONLY in expo-secure-store — never in SQLite, never logged
- Encryption key stored ONLY in expo-secure-store — never hardcoded, never logged
- Never render any app content before app lock authentication passes
- Ground button MUST be visible on all Trailhead (step >= self_checkin), Exile Elaboration, and Meeting Space screens
- Backup reminder reads `last_backup_at` from expo-secure-store — update on every successful backup
- See docs/features/SECURITY_AND_BACKUP.md for full spec

### Data Rules
- expo-sqlite is the only database in Phase 0-3
- Do NOT add Supabase or any cloud storage
- Do NOT add authentication screens in Phase 0-3 (no login required)
- Backend classifications stored in DB but NEVER exposed in any UI component
- `part.display_name` (computed from custom_name or name) is the only label shown in UI
- All SQLite queries use parameterized statements — no string interpolation
- PRAGMA foreign_keys = ON always

---

## Self-Annealing Repair Loop (Follow on Every Error)

When any tool, script, or build step fails, do not guess at a fix. Follow this loop in order:

**1. Analyze**
Read the full stack trace and error message before touching any code. Identify the exact line and cause. State your diagnosis out loud before proposing a fix.

**2. Patch**
Fix only the specific component that failed. Do not refactor surrounding code while fixing an error — one change at a time.

**3. Test**
Verify the fix works before moving on. Run the minimal test that confirms the broken thing now works. Do not assume the fix worked.

**4. Document the Learning**
After a confirmed fix, update the relevant doc in `docs/` with the new constraint or finding. Format:
```
> ⚠ Learned [date]: [what failed] — [why it failed] — [how it was fixed]
```
Add this to whichever doc governs that area (TECH_STACK.md for dependency issues, SCHEMA.md for database errors, the relevant feature doc for feature-level bugs). This ensures the same error never repeats across sessions.

**5. Update Progress**
At the end of every session, append a brief summary to `progress.md` in the project root:
- What was completed
- Any errors encountered and how they were resolved
- What the next step is

`progress.md` is session memory. Claude Code has no memory between sessions — this file is how continuity is maintained.

### Session Files (Create in Project Root)

Maintain these three files in the project root alongside `CLAUDE.md`:

| File | Purpose |
|---|---|
| `task_plan.md` | Current phase checklist — update as tasks complete |
| `progress.md` | Session log — append after every session |
| `findings.md` | Constraints, API quirks, library gotchas discovered during build |

These are living documents. Never delete them. They are the project's memory between Claude Code sessions.

---

## Docs Index

- `docs/PROJECT_OVERVIEW.md`
- `docs/SCOPE.md`
- `docs/SETUP_GUIDE.md`
- `docs/architecture/TECH_STACK.md` ← storage model detail
- `docs/architecture/SCHEMA.md` ← full SQLite schema
- `docs/architecture/FEATURE_INTEGRATION_MAP.md`
- `docs/ifs-domain/IFS_PRIMER.md`
- `docs/ifs-domain/PARTS_DATABASE.md`
- `docs/ifs-domain/TERMINOLOGY.md`
- `docs/ifs-domain/ASSESSMENT_LOGIC.md`
- `docs/design/DESIGN_SYSTEM.md`
- `docs/features/ASSESSMENT_REDESIGN.md` ← most critical feature doc
- `docs/features/PARTS_MAP_FOG_OF_WAR.md`
- `docs/features/SECURITY_AND_BACKUP.md` ← security, backup, ground button spec
- `docs/content/` ← JSON content files (assessment questions, techniques, wiki)
