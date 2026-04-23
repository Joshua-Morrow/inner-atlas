# Inner Atlas — Setup Guide

## Pre-Build Checklist

### Accounts
- [ ] GitHub account — create repo named `inner-atlas`
- [ ] Expo account — expo.dev (free) — needed for OTA updates and builds
- [ ] Apple Developer — $99/year (iOS TestFlight + App Store)
- [ ] Google Play Developer — $25 one-time (Android)

**Not needed for Phase 0-3:**
- ~~Supabase account~~ — only needed if/when cloud sync is added (Phase 5+)

### Software
- [ ] Node.js v20+ — nodejs.org
- [ ] Git — git-scm.com
- [ ] Cursor IDE — cursor.com (or Antigravity if available)
- [ ] Claude Code — install via Extensions panel
- [ ] Expo Go on your phone — for live testing
- [ ] Xcode (Mac App Store) — for iOS simulator + builds

### Content Files (all complete ✓)
- [x] `docs/content/assessment-questions.json`
- [x] `docs/content/naming-moment-descriptions.json`
- [x] `docs/content/name-chips.json`
- [x] `docs/content/techniques-library.json`
- [x] `docs/content/wiki-articles.json`

---

## Phase 0 — First Claude Code Prompt

Paste this after running `/init` in Claude Code:

```
Create a new Expo managed workflow project called 'inner-atlas' using TypeScript.

Set up this folder structure:
  apps/mobile          ← Expo app with Expo Router (iOS + Android + Web)
  packages/shared      ← shared business logic and IFS domain models
  packages/ui          ← shared component library

This app uses LOCAL-FIRST storage. The primary database is SQLite via expo-sqlite.
There is NO Supabase, NO cloud backend, and NO authentication required in Phase 0-3.
All data lives on the user's device.

Install these packages:
  expo-sqlite                   (local database — SQLCipher encryption support)
  expo-file-system              (backup export/import)
  expo-sharing                  (share backup file via iOS/Android share sheet)
  expo-local-authentication     (Face ID / Touch ID / PIN app lock)
  expo-secure-store             (PIN hash + encryption key storage)
  expo-router                   (navigation)
  nativewind                    (styling)
  tailwindcss
  zustand                       (state management)
  @tanstack/react-query
  react-native-skia             (parts map canvas)
  expo-font
  crypto-js                     (AES-256 backup file encryption)

DO NOT install @supabase/supabase-js — it is not needed until Phase 5.

On first launch, initialize:
  1. Generate SQLCipher encryption key via Crypto.getRandomValues(), store in expo-secure-store key 'db_encryption_key'
  2. Open encrypted SQLite database using that key
  3. Run schema migrations from docs/architecture/SCHEMA.md
  4. Enable PRAGMA foreign_keys = ON

Initialize SQLite database on first launch using the schema in
docs/architecture/SCHEMA.md. Database file: inner-atlas.db.
Enable foreign keys: PRAGMA foreign_keys = ON.

Initialize a git repository.
CLAUDE.md is already at root — do not recreate.
docs/ folder is already set up — do not recreate.

Design system colors (from docs/design/DESIGN_SYSTEM.md):
  Manager: #3B5BA5
  Firefighter: #C2600A
  Exile: #7C3D9B
  Self: #B88A00
  Background: #FAFAF8
  Text: #1C1B19

Verify setup: npx expo start — app should launch on phone via Expo Go.
```

---

## Phase Sequence

| Phase | What Gets Built | Done When |
|---|---|---|
| 0 | SQLite DB init, navigation shell, design system, dashboard | App runs on phone with empty state |
| 1 | Parts Inventory, First Mapping Assessment, Part Profiles, Fog Map | Client can build a parts map |
| 2 | Inner Dialogue, Techniques Library, Loggers, Map editing | Client can do IFS work |
| 3 | Mini-Assessments, Elaboration, Refine, Self-Energy Check-In, Wiki | All V1 features complete |
| 4 | Export/Import, Clinical Metrics Export, settings, testing, distribution | App in clients' hands |
| 5+ | Cloud sync (opt-in), therapist portal, couples | Future scope |

---

## Session Workflow

1. Open Cursor/Antigravity, open `inner-atlas/` folder
2. Update `CLAUDE.md` Current Phase field
3. Open Claude Code → `/init`
4. Open Lovable prototype on second screen (visual reference only)
5. State session goal: `"Today I am building Phase 1 Step 1.3"`
6. Use Planning Mode for every new feature
7. Test on device after each step
8. `git add . && git commit -m "Phase X Step Y" && git push`

---

## Data Privacy Notes for Onboarding Screen

When users first launch the app, display:

> Your data stays on this device. Inner Atlas does not send your information anywhere — no servers, no cloud storage, no accounts required. If you lose or replace this device, export your data first from Settings → Export My Data.
>
> If you want to share progress with your therapist, you can export a metrics summary from Settings at any time. This summary contains only scores and trends — never your part names, dialogues, or personal notes.

---

## Clinical Metrics Export — What It Contains

Available in Settings → Share with Therapist.

**Included:**
- Assessment cluster scores (A/B/C/D) and system type inference
- Self-energy trend (% over time, not content)
- Activation frequency by part type (manager/firefighter/exile counts)
- Technique completion history (which techniques, how often)
- Milestones earned

**Excluded (never in export):**
- Part names or custom names
- Dialogue content
- Part profile text fields
- Naming moment responses
- Trailhead descriptions
- Update notes
- Any personally identifiable content

Client sends this file through SimplePractice, secure message, or any channel they choose.
