# Inner Atlas — Security & Backup

## Overview

Three interlocking security features:

1. **Database Encryption** — data encrypted at rest on device, protects against file system access
2. **App Lock** — PIN or biometric, protects against casual access on an unlocked device
3. **Backup & Restore** — full data export with optional AES encryption, user-controlled storage

These are distinct layers. A user can have app lock without backup encryption, or vice versa. All are optional except database encryption, which is on by default.

---

## 1. Database Encryption (at rest — always on)

### What it does
The SQLite database file (`inner-atlas.db`) is encrypted on disk using SQLCipher. If someone accesses the device via USB/file system tools, they see an encrypted blob rather than readable data.

### Implementation
- Use `expo-sqlite` with SQLCipher encryption enabled
- Encryption key is derived from a device-specific identifier stored in `expo-secure-store`
- Key generation happens on first launch and is transparent to the user
- No user action required — this is always on

### What it protects against
- File system inspection on a rooted/jailbroken device
- Device backup extraction via iTunes/ADB
- Basic forensic tools

### What it does NOT protect against
- Someone using the app while it's unlocked (→ App Lock handles this)
- A sophisticated attacker with the device and significant time/tools
- The user themselves choosing to export and share their data

### Claude Code instructions
```
Initialize expo-sqlite with encryption enabled using a key stored in expo-secure-store.
Key name: 'db_encryption_key'
Generate on first launch using Crypto.getRandomValues() if key doesn't exist.
All database operations proceed identically — encryption is transparent.
```

---

## 2. App Lock (optional — user configures in Settings)

### What it does
Requires authentication before the app becomes usable. Prevents casual snooping on an unlocked device — a partner, family member, or anyone who picks up the phone.

### Options
- **Biometric** (Face ID / Touch ID / fingerprint) — preferred, lowest friction
- **PIN** (4–6 digit numeric code) — fallback if biometric unavailable or not preferred
- **Off** — default until user enables in Settings

### Lock timeout options
- Immediately (every time app backgrounds)
- After 1 minute
- After 5 minutes
- After 15 minutes

### PIN storage
- Stored as bcrypt hash in `expo-secure-store`
- Never stored plaintext anywhere
- No recovery mechanism — if PIN is forgotten, user must reinstall (data preserved if backup exists)
- Display clear warning: "If you forget your PIN, you will need to reinstall the app. Make sure you have a backup."

### UI
**Settings → Privacy & Security:**
```
App Lock
  [Toggle] Require authentication to open app
  
  Authentication method:
    ○ Face ID / Touch ID  (show only if available)
    ● PIN
  
  Lock after:
    ○ Immediately
    ● 1 minute
    ○ 5 minutes
    ○ 15 minutes
  
  [Change PIN]  (only shown if PIN active)
```

**Lock screen:**
- App logo centered on dark background (matches map canvas color #1A1917)
- PIN keypad or biometric prompt
- No visible content from the app behind the lock screen
- On biometric failure: fall back to PIN entry

### Claude Code instructions
```
Use expo-local-authentication for biometric checks.
Store PIN hash with expo-secure-store key: 'app_lock_pin_hash'
Store lock settings with expo-secure-store key: 'app_lock_settings'
Lock screen component: apps/mobile/components/LockScreen.tsx
Check lock state in root layout _layout.tsx on app focus/resume.
Do not render any app content until authentication passes.
```

---

## 3. Backup & Restore

### 3a. Full Data Backup

**Location:** Settings → Back Up My Data

**What it exports:**
All tables serialized to JSON in a single file:
```json
{
  "version": "1.0",
  "exported_at": "2026-03-12T10:00:00Z",
  "app_version": "1.0.0",
  "encrypted": false,
  "data": {
    "parts": [...],
    "part_profiles": [...],
    "part_relationships": [...],
    "assessment_sessions": [...],
    "assessment_naming_moments": [...],
    "shadowed_nodes": [...],
    "inner_dialogues": [...],
    "trailheads": [...],
    "elaboration_sessions": [...],
    "updates": [...],
    "self_energy_checkins": [...],
    "body_placements": [...],
    "practice_sessions": [...],
    "system_snapshots": [...],
    "milestones": [...]
  }
}
```

**File format:** `.iabackup` (JSON under the hood, custom extension for easy identification)

**Filename:** `inner-atlas-backup-YYYY-MM-DD.iabackup`

**Encryption flow:**
```
[Back Up My Data]
  ↓
"Would you like to password-protect this backup?"
  [Skip — save without password]  [Set a password]
  ↓                                      ↓
Save unencrypted                   Enter password (twice)
file to share sheet                      ↓
                               AES-256 encrypt with crypto-js
                               encrypted: true in file header
                                         ↓
                               Save to share sheet
```

**After export:** iOS/Android share sheet opens — user chooses destination (Files, Google Drive, iCloud, email, AirDrop, USB via Files app, etc.)

**Disclosure shown before every export:**
> "This file contains your Inner Atlas data including parts profiles and session history. It is sensitive personal information. Store it somewhere only you can access. If you set a password, it cannot be recovered if forgotten."

### 3b. Backup Reminder (Dashboard)

**Location:** Persistent but unobtrusive indicator on Dashboard

**Logic:**
- Track `last_backup_at` timestamp in `expo-secure-store`
- If never backed up: show amber indicator "No backup yet"
- If backed up > 30 days ago: show amber indicator "Back up recommended"
- If backed up ≤ 30 days ago: show subtle green indicator or nothing

**UI component (Dashboard, top area near header):**
```
[🔒 Last backed up 3 days ago]          ← green, minimal
[⚠ Back up recommended — 32 days ago]  ← amber, tappable → Settings
[⚠ No backup yet]                       ← amber, tappable → Settings
```

Tapping the indicator navigates to Settings → Back Up My Data.

**First launch onboarding screen (after assessment complete, before map reveal):**
> "Your Inner Atlas data lives on this device. We recommend backing it up regularly so your work is never lost.
>
> Head to Settings → Back Up My Data to save a copy to Google Drive, iCloud, or anywhere you choose.
>
> [Got it]  [Go to Backup Settings]"

### 3c. Restore from Backup

**Location:** Settings → Restore from Backup  
Also offered on first launch as alternative to starting fresh.

**Flow:**
```
[Restore from Backup]
  ↓
File picker → user selects .iabackup file
  ↓
If encrypted: prompt for password
  ↓
Validate file structure and version
  ↓
Warning: "This will replace all current data. 
         This cannot be undone. Continue?"
  [Cancel]  [Replace my data]
  ↓
Write all tables from backup to SQLite
  ↓
Navigate to Dashboard with restored data
```

**Version compatibility:** If backup `version` field is newer than app can handle, show error: "This backup was made with a newer version of Inner Atlas. Please update the app to restore it."

### 3d. Clinical Metrics Export

**Location:** Settings → Share Progress with Therapist

**What it contains (ONLY):**
- Assessment cluster scores (A/B/C/D numerical values)
- System type inference (e.g., "Manager-dominant" — never specific part names)
- Self-energy trend (% values over time, no notes)
- Activation frequency by part type (counts only, no names)
- Technique completion history (which techniques, count, no reflection notes)
- Milestones earned (keys only, e.g., "first_assessment_complete")

**What it NEVER contains:**
- Any part names or custom names
- Any dialogue content
- Any profile text fields
- Any naming moment responses
- Any update notes or trailhead descriptions
- Any personally identifiable content

**Format:** PDF or plain text — readable without the app

**Disclosure shown before export:**
> "This summary contains only scores and trends — no names, notes, or personal content. You control where it goes. Share it through SimplePractice, secure message, or any channel you and your therapist use."

---

## 4. Ground Button (Safety Exit During Deep Techniques)

### What it does
Provides a visible, always-accessible exit during emotionally activating sessions — Trailhead, Elaboration, and Meeting Space technique. Pauses the session and offers a brief grounding exercise.

### When it appears
- All Trailhead steps from Step 3 (Self Check-In) onward
- Elaboration sessions when working with Exile parts
- Meeting Space technique steps (all steps from anchor onward)
- Any technique step with `type: "breathing_anchor"` or marked `show_ground_button: true`

### UI
- Fixed position: bottom-right corner, above navigation bar
- Small but clearly visible: shield or anchor icon + "Ground" label
- Color: neutral — does not use any part-type color
- Does not interfere with session content

### Ground flow
```
[Ground] tapped
  ↓
Session pauses (progress saved)
  ↓
Full-screen grounding overlay:

  "Let's slow down."
  
  Take a breath with me.
  [Animated breathing circle — 5s in, 5s out, 3 cycles]
  
  Feel your feet on the floor.
  Notice three things you can see right now.
  
  [I feel steadier — return to session]
  [End session and save progress]
  [End session without saving]
```

**After grounding, if returning to session:** Resume at the exact step where the user left off.

**After grounding, if ending session:** Navigate to Dashboard. Session marked `status: 'paused'` — can be resumed later.

### Crisis reference (persistent, not intrusive)
In Settings → Support, and accessible from the ground overlay's "End session" path:
> "If you're feeling overwhelmed and need support, you can reach the 988 Suicide & Crisis Lifeline by calling or texting **988**."

This is not shown during normal use — only surfaced when a user is already in the ground flow and choosing to end a session.

### Claude Code instructions
```
Ground button component: apps/mobile/components/GroundButton.tsx
Props: { sessionId, onResume, onEndWithSave, onEndWithoutSave }
Grounding overlay: apps/mobile/components/GroundingOverlay.tsx
Breathing animation: use Reanimated or simple Animated API, 5s in / 5s out
Show on: all Trailhead screens step_id >= 'tl_self_checkin'
Show on: all Elaboration screens where part.type === 'exile'
Show on: all Meeting Space screens step_id >= 'ms_anchor'
Show on: any technique step with show_ground_button: true
```

---

## Settings Screen Structure

```
Settings
  ├── Privacy & Security
  │     ├── App Lock (toggle + configure)
  │     ├── Database encryption (info only — always on)
  │     └── Clear all data (destructive, confirmation required)
  ├── Backup & Restore
  │     ├── Back Up My Data
  │     ├── Restore from Backup
  │     └── Share Progress with Therapist
  └── Support
        └── Crisis & Support Resources
```
