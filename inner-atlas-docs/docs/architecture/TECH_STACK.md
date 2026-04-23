# Inner Atlas — Tech Stack

## Platform Targets (all first-class from day one)

- iOS (App Store, min iOS 16)
- Android (Google Play, min Android 10 / API 29)
- Web (Expo web for desktop sessions)
- macOS + Windows — Phase 5 only

## Core Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo (managed workflow) |
| Navigation | Expo Router (file-based) |
| Local Database | expo-sqlite (SQLite, on-device, no server) |
| DB Encryption | expo-sqlite with SQLCipher (via expo-sqlite encryption) |
| App Lock | expo-local-authentication (Face ID / Touch ID / PIN) |
| State | Zustand + React Query |
| UI | NativeWind (Tailwind for RN) |
| Map Canvas | React Native Skia |
| Backup Export | expo-file-system + expo-sharing + crypto-js (AES) |
| Cloud Sync (opt-in) | Supabase — Phase 5+ only, NOT built yet |

## Storage Architecture: Local-First

**Default mode: all data lives on the user's device.** No account required. No server. Nothing leaves the device unless the user explicitly chooses to export.

### Storage Tiers

**Tier 1 — Local Only (default, all of Phase 0–4)**
- `expo-sqlite` stores all user data on device
- Database encrypted at rest using SQLCipher (see Security section)
- No account required
- User manually backs up via Settings → Back Up My Data
- Import/restore from backup file on any device

**Tier 2 — Cloud Sync (opt-in, Phase 5+)**
- User creates account and explicitly enables sync
- Supabase PostgreSQL with RLS
- Requires explicit consent + BAA for therapy clients
- Off by default, never nudged

**Tier 3 — Clinical Metrics Export (Phase 1, both tiers)**
- Content-free summary for therapist review
- No part names, no dialogue content, no personal notes
- Client sends through their own channel

## Security Architecture

See `docs/features/SECURITY_AND_BACKUP.md` for full spec.

### Database Encryption (at rest)
- SQLite database encrypted using SQLCipher via `expo-sqlite`
- Encryption key derived from device-specific identifier + optional user passphrase
- Protects against tech-savvy snooping if device is accessed via file system
- Transparent to app — all queries work identically

### App Lock
- Optional PIN (4–6 digit) or biometric (Face ID / Touch ID / fingerprint)
- Configured in Settings → Privacy & Security
- Locks after configurable timeout (immediately, 1 min, 5 min, 15 min)
- Uses `expo-local-authentication` for biometrics
- PIN stored as bcrypt hash in `expo-secure-store` (never plaintext)
- Protects against casual access on unlocked device

### Backup Encryption
- Backup files optionally encrypted with AES-256 via `crypto-js`
- User sets a backup password at export time
- Password is NOT stored anywhere — if lost, backup is unrecoverable
- Unencrypted backups are valid but clearly labeled "unprotected"

## File Structure

```
inner-atlas/
  apps/
    mobile/          ← Expo app (iOS + Android + Web)
  packages/
    shared/          ← business logic, IFS models
    ui/              ← shared component library
  docs/              ← reference files
  CLAUDE.md
```

## Why Not Supabase by Default

1. PHI in cloud requires ongoing HIPAA compliance (BAA, audit logging, breach notification)
2. Users disclose more in a private local journal — clinical value improves
3. Therapist needs only clinical metrics, not parts content
4. Local-first is simpler to build and test in Phase 0–3
5. Cloud sync can be added later as opt-in without architectural change

## Phase 0 Dependencies to Install

```
expo-sqlite                  ← primary local database (with SQLCipher support)
expo-file-system             ← backup export/import
expo-sharing                 ← share exported backup file
expo-local-authentication    ← Face ID / Touch ID / PIN app lock
expo-secure-store            ← store PIN hash and encryption key material
expo-router                  ← navigation
nativewind                   ← styling
tailwindcss
zustand                      ← state management
@tanstack/react-query
react-native-skia            ← parts map canvas
expo-font
crypto-js                    ← AES encryption for backup files
```

Supabase SDK is NOT installed until Phase 5.

## Web Platform Note

On Expo Web, expo-sqlite runs via WebAssembly. Safari aggressively manages storage and may clear the database if the app is unused for extended periods. The web version should:
- Warn users prominently that web storage is less reliable than native
- Prompt backup more frequently on web
- Recommend the iOS or Android app for primary use

SQLCipher encryption is not available on web — the web version uses unencrypted SQLite. App Lock (PIN/biometric) is also not available on web. Disclose this in web onboarding.
