# Inner Atlas — Findings & Constraints

Constraints, API quirks, and library gotchas discovered during build.
Format: `> ⚠ Learned [date]: [what failed] — [why it failed] — [how it was fixed]`

---

## Parts Map — SVG Canvas

> ⚠ Learned 2026-04-20: viewBox manipulation for pan/zoom causes touch offset — `pageY` from PanResponder is screen-absolute (includes status bar) but SVG element starts below the header, so Y coordinate is offset by header height — fixed by switching to fixed viewBox + `<G transform="translate scale">` approach where PanResponder screen coords convert to canvas space via `(pageXY - pan) / scale`.

> ⚠ Learned 2026-04-20: PanResponder.create() captures a snapshot of state at creation time — any state values used in callbacks go stale — always mirror state to refs (`panRef`, `scaleRef`, `draggingPartIdRef`) that are updated synchronously alongside `setState` calls.

---

## Navigation — Session Screens

> ⚠ RECURRING PATTERN: Session screens (trailhead, technique, dialogue) must use `router.replace()` on ALL exit paths. `router.push()` on exit accumulates stack entries causing multiple back presses to navigate through ghost screens.

> ⚠ Learned 2026-03-21: `BackHandler.removeEventListener` — API removed from TypeScript types in modern RN. Use the subscription pattern: `const sub = BackHandler.addEventListener('hardwareBackPress', handler); return () => sub.remove();`

> ⚠ Learned 2026-03-21 (BUG — nav stack accumulation from profile screen): List-item `onPress` handlers in `part-profile.tsx` (Trailhead History, Activity Log) used bare `router.push()` with no guard. Rapid double-taps stacked duplicate screens. Fix: shared `isNavigating = useRef(false)` guard with 500ms cooldown on all navigation calls in the file. Define `navigateTo(path)` helper at component level; use it everywhere instead of `router.push()` directly.

> ⚠ RECURRING PATTERN 2026-03-21: Multiple navigation fires per tap occur when `onPress` handlers are inside re-rendering list components. The `isNavigating` boolean ref approach can still allow multiple fires if the component re-renders between taps. Fix with debounced navigation (800ms window using `Date.now()` comparison): define `useDebounceNav()` hook at file top, call it in the component (`const debounceNav = useDebounceNav()`), wrap ALL navigation calls: `onPress={() => debounceNav(() => router.push(...))}`. Apply to all list-item navigation in the app. Also apply to the "View Profile" FAB/bottom-sheet button in `explore.tsx`.

> ⚠ DEFINITIVE PATTERN 2026-03-21: Never use `router.push()` directly in list item `onPress` handlers on Android. Always wrap with a `navigatingRef` guard (1000ms reset) AND use `TouchableOpacity` not `Pressable`. `Pressable` fires multiple events in scroll containers on Android. Additionally, never define `navigateToItem`-style functions inside `.map()` callbacks — they are recreated on every render, defeating closure-based guards. Pattern: `const navigatingRef = useRef(false); const safeNavigate = useCallback((href: string) => { if (navigatingRef.current) return; navigatingRef.current = true; router.push(href as any); setTimeout(() => { navigatingRef.current = false; }, 1000); }, []);`. Applied to: `part-profile.tsx`, `my-parts.tsx`, `explore.tsx`, `updates.tsx`, `dialogue.tsx`.

> ⚠ DEFINITIVE NAVIGATION RULE 2026-03-21: `router.back()` — return to previous screen already in stack. Use for ALL back buttons on detail/review screens. `router.push()` — navigate to a new screen not yet in stack. `router.replace()` — replace current screen with a different screen (e.g. session completion replacing the session screen with the list). NEVER use `router.push()` or `router.replace()` with a specific route as a "back" action — that creates a new instance of the target instead of returning to the existing one. Root cause of nav stack accumulation in `trailhead-review.tsx`: back button was using `router.replace('/part-profile?id=...')` instead of `router.back()`. The part-profile was already in the stack — replace pushed a new copy. Fix: always `router.back()` on detail/review screen back buttons.

> ⚠ Learned 2026-03-21 (BUG — "Continue Trailhead" button not showing): Two root causes. (1) `trailhead-session.tsx` INSERT was setting `completed_at = startedAt` (non-null from creation) instead of `null`. This meant `completed_at` was always non-null, making it unreliable as a completion signal. Fix: INSERT now uses literal `null` for `completed_at`. (2) `trailhead-review.tsx` `isComplete` condition was `status === 'complete'` — correct in isolation but fragile against legacy rows with null status or rows created before the explicit INSERT was added. Fix: `isComplete = status === 'complete' && !!completed_at`. A session is only complete when BOTH signals agree.

---

## NativeWind v4

**Setup (confirmed working pattern for NativeWind v4 + Expo managed workflow + New Architecture):**

- `babel.config.js`: use `jsxImportSource: 'nativewind'` inside `babel-preset-expo` options — NOT a separate `nativewind/babel` plugin. The old v2 plugin approach does not work in v4.
- `metro.config.js`: wrap `getDefaultConfig(__dirname)` with `withNativeWind(config, { input: './global.css' })`.
- `tailwind.config.js`: must include `presets: [require('nativewind/preset')]` — without this, NativeWind-specific utilities won't work.
- `global.css`: standard Tailwind directives. Import at the top of `app/_layout.tsx` (before any other imports).
- TypeScript: `jsxImportSource: 'nativewind'` in babel config also handles `className` type augmentation on RN components.

**Custom color naming:** Tailwind color names cannot contain dots or slashes. Used `text-primary` and `text-secondary` as keys (not `text.primary`) to allow `text-text-primary` class usage.

---

## expo-sqlite v16 + SQLCipher

**Encryption approach:**
- expo-sqlite v16 bundles SQLCipher on iOS and Android.
- Set encryption key via `PRAGMA key = '...'` as the FIRST statement after `openDatabaseAsync` — before any schema operations.
- The key is a 64-char hex string generated by `expo-crypto.getRandomBytesAsync(32)`, stored in `expo-secure-store` key `db_encryption_key`.
- Key interpolation in the PRAGMA statement is safe here because the key is machine-generated (not user input). This is the only acceptable exception to the no-interpolation rule.
- Web target: SQLCipher is NOT available on web (uses wa-sqlite). Encryption is silently skipped on web. PHI should not be stored in web builds.

**Schema note:** `display_name TEXT GENERATED ALWAYS AS (COALESCE(custom_name, name)) VIRTUAL` — this is a SQLite computed column. expo-sqlite supports this. Do not try to INSERT or UPDATE the `display_name` column directly.

---

## react-native-worklets (for Skia)

- Version `0.5.1` — babel plugin is `'react-native-worklets/plugin'`.
- Must be included even if Skia components are not yet rendered, as Skia registers itself on import.
- With New Architecture (`newArchEnabled: true`), react-native-reanimated v4 does NOT need its own babel plugin — only the worklets plugin is needed.

---

## Metro + Monorepo (watchFolders / nodeModulesPaths)

> ⚠ Learned 2026-03-17: Metro ENOENT on `<root>/node_modules` at startup — Root `package.json` declares `workspaces`, which causes Metro to detect the repo root and add `<root>/node_modules` to its watch list — Fixed by setting `config.watchFolders` and `config.resolver.nodeModulesPaths` explicitly in metro.config.js.

> ⚠ Learned 2026-03-20: Root `node_modules` in monorepo causes `EXPO_ROUTER_APP_ROOT` bundle failure — Running `npm install` from repo root with a `workspaces` field hoists ALL packages from `apps/mobile` up to `root/node_modules`, leaving `apps/mobile/node_modules` empty. Metro then resolves packages from root, which puts Metro's own module resolution at the repo root rather than `apps/mobile/`, breaking Expo Router's app root detection. **Root `node_modules` must never exist** — all packages install to `apps/mobile/node_modules` only. Root `package.json` must NOT have a `workspaces` field. `metro.config.js` must explicitly set `watchFolders = [projectRoot]` and `nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')]` pointing to `apps/mobile`. If root `node_modules` accidentally appears, delete it and run `npm install` from inside `apps/mobile/`.

**Canonical metro.config.js (apps/mobile/metro.config.js):**
```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.watchFolders = [projectRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './global.css' });
```

**Recovery steps if root node_modules reappears:**
1. `rmdir /s /q C:\Projects\inner-atlas\node_modules` (Windows) or `rm -rf node_modules` (Unix)
2. `cd apps/mobile && npm install`
3. `rmdir /s /q .expo && npx expo start --clear`

---

## Expo Router + NativeWind

- `global.css` import must be the very first import in `app/_layout.tsx` — before React Navigation imports. Metro processes CSS imports in order.
- `SafeAreaView` from `react-native-safe-area-context` supports `className` via NativeWind. Use it instead of RN's built-in `SafeAreaView`.

---

## Skia + Expo Go on Android

> ⚠ Learned 2026-03-19: Parts Map crashed on Android with "Expected arraybuffer as first parameter" from `MakePicture` in `@shopify/react-native-skia` — Skia requires a custom native build (JSI + native module registration) that is NOT available in Expo Go on Android. Expo Go ships a fixed set of native modules and cannot load Skia's native bindings at runtime. Fix: rewrote `apps/mobile/app/(tabs)/explore.tsx` as a pure React Native implementation — dark View background, absolute-positioned Views for glow halos + shadowed nodes, layered semi-transparent Views to simulate fog gradients, RN shadow props for the Self node glow. All interaction logic, DB loading, and navigation kept identical. **Skia can be re-introduced in Phase 4 when the project moves to EAS custom dev builds** (`eas build --profile development`), at which point the full Canvas fog/blur implementation from the previous session can be restored.

---

## @expo/vector-icons (Ionicons)

> ⚠ Learned 2026-03-19: Ionicons crashes with `ReferenceError: Property 'Ionicons' doesn't exist` if the import is missing — `@expo/vector-icons` is not globally available; it must be explicitly imported in every file that uses it. Fix: add `import { Ionicons } from '@expo/vector-icons';` at the top of any file that references `<Ionicons>` or `Ionicons.glyphMap`. Affected file: `my-parts.tsx`.

---

## Button Visibility on Device (List Screens)

> ⚠ Learned 2026-03-19: Primary action buttons must always be outside ScrollView/FlatList and pinned to the bottom — Buttons inside a scroll container with short content lists may appear visible in dev but disappear on device due to flex/scroll container differences. When `emptyState` has `flex: 1` inside a flex parent it consumes all remaining height, making a sibling footer View invisible on device even though it looks fine in the simulator. Standard pattern for all list screens: `SafeAreaView` as root, `ScrollView` with `flex: 1` for content (including empty states), pinned `View` outside the scroll for the primary action button. `emptyState` must NOT use `flex: 1` — use `paddingTop` for vertical centering instead. This pattern applies to `dialogue.tsx`, `my-parts.tsx`, and any future list screen with a primary action button.

> ⚠ RECURRING PATTERN (confirmed 2026-03-21): All list screens with a primary action button must use SafeAreaView → ScrollView + pinned button pattern. Button must be OUTSIDE ScrollView as a sibling View. `elevation: 8` required on Android footer View. Use `TouchableOpacity` (not `Pressable`) for the primary action button. This applies to every list screen in the app without exception — confirmed on `dialogue.tsx`, `my-parts.tsx`, `updates.tsx`.

---

## Three-Screen Reveal (reveal_3) — Issues Found 2026-03-19

> ⚠ Learned 2026-03-19: Exile node not pulsing on reveal_3 — The `nodePulse` animation loop is only started inside `transitionTo` for confirm steps (`cA_confirm` … `cD_confirm`, `reveal_1`). `reveal_3` was never added to that condition, so `exilePulse` (a separate `Animated.Value`) sat at 1 with no loop running. Fix: added a dedicated `exilePulse` ref and a separate `reveal_3` branch in `transitionTo` that starts a `Animated.loop(Animated.sequence([…]))` at 600ms each way (1200ms total) with `Easing.inOut(Easing.ease)`. Required adding `Easing` to the react-native import.

> ⚠ Learned 2026-03-19: Exile node fog visual looked like a lighter purple disc on a white background — was using `rgba(124,61,155,0.15)` background on `#FAFAF8` page. Fix: wrapped node in a dark `#1A1917` circle (180×180) with two semi-transparent concentric overlay layers (black outer, violet-tinted mid) to simulate fog/mist depth. Node itself kept at `opacity: 0.5` with dashed border. An additional inner overlay further blurs the node boundary. The pulsing `Animated.View` now uses `exilePulse` rather than `nodePulse`.

> ⚠ Learned 2026-03-19: "Explore the fog" button not navigating to Map tab — `router.replace('/(tabs)')` resolves to the first tab (`index.tsx`, the Home screen), not the Map tab. The Map tab is the `explore` screen in the tabs group. Fix: changed to `router.replace('/(tabs)/explore')` to navigate directly to the Map tab.

---

---

## React Native 0.81.x + React 19 + TypeScript JSX Compatibility (npm workspaces)

> ⚠ Learned 2026-03-20: `'View' cannot be used as a JSX component` (TS2786/TS2607) across ALL files — npm workspace package hoisting caused dual module identity for `React.Component` — fixed by installing `@types/react` at root level.

**Root cause:**
npm workspace configuration in root `package.json` hoists `react-native` to `root/node_modules/react-native`. When TypeScript processes react-native's type files (e.g. `View.d.ts`), it resolves `import type * as React from 'react'` via `root/node_modules/react/index.js` (the JS module), then finds `@types/react` from the tsconfig's typeRoots (`apps/mobile/node_modules/@types/react`).

Meanwhile, app `.tsx` files resolve `react` directly to `apps/mobile/node_modules/@types/react` (as a pure type resolution).

These two resolution paths produce DIFFERENT module identity strings in TypeScript's cache:
- View.d.ts context: `react/index.js@19.1.0` → types: `@types/react/index.d.ts@19.1.17`
- App files: `@types/react/index.d.ts@19.1.17` (direct)

TypeScript treats `React.Component` from each path as a DIFFERENT type, causing the JSX class component check (`typeof View extends new(props: any, context: any) => Component<any, any, any>`) to fail — even though both point to the same physical file.

**Fix:** This issue was caused by npm workspace hoisting. With workspaces removed from root `package.json` and all deps installed only in `apps/mobile/node_modules`, both resolution contexts find the same `@types/react` package — no root-level workaround needed. `apps/mobile/package.json` already declares `@types/react` as a devDependency.

**Additional fix:** `TextInput.focus()` not in react-native's TextInput type definition (uses `Constructor<TimerMixin>` not `Constructor<NativeMethods>`). Fix: type the ref as `useRef<TextInput & { focus(): void }>(null)`.

**IMPORTANT:** Never run `npm install` from the repo root. Always run from `apps/mobile/`. Running from root will re-hoist all packages and recreate the EXPO_ROUTER_APP_ROOT failure.

---

## Metro Config — EXPO_ROUTER_APP_ROOT Bundle Error

> ⚠ Learned 2026-03-20: `process.env.EXPO_ROUTER_APP_ROOT - First argument of require.context should be a string` means Metro cannot resolve the Expo Router app root, typically because metro.config.js has overly restrictive `resolver.nodeModulesPaths` or stale workspace config — After long sessions with many file changes, always verify metro.config.js and babel.config.js are intact before testing. The correct metro.config.js is the minimal form: `getDefaultConfig(__dirname)` wrapped with `withNativeWind`. Do not add custom `nodeModulesPaths` unless specifically debugging a root node_modules ENOENT issue (see "Metro + Monorepo" finding above — that issue is resolved once root node_modules exists from npm workspace install). The correct babel plugin for Reanimated is `react-native-reanimated/plugin`; `react-native-worklets/plugin` is for Skia worklets and does not satisfy Expo Router's bundler requirements.

---

## Expo Router — Session Navigation (router.replace vs router.push)

> ⚠ Learned 2026-03-20: Always use `router.replace()` not `router.push()` when navigating away from a completed or exited session screen. `router.push()` adds the destination to the stack, so pressing back returns to the completed session — a loop the user cannot escape without multiple back presses. `router.replace()` removes the session screen from the stack and replaces it with the destination, so the back button skips the completed session entirely. Applies to: technique-session.tsx (End & Save, completion screen Return button, grounding overlay End button, exit modal End & Save), dialogue-session.tsx (End & Save button, grounding overlay End button). Destination for techniques is `/techniques`; destination for dialogues is `/dialogue?id=<partId>` when a primary part exists, or `/my-parts` as fallback.

---

## expo-router Version Compatibility on Windows

> ⚠ Learned 2026-03-20: `expo-router ~6.0.23` causes `EXPO_ROUTER_APP_ROOT` bundle failure on Windows — The v6 resolver interacts poorly with the monorepo watchFolders config on Windows paths, producing `First argument of require.context should be a string`. If this recurs: downgrade to `expo-router@~5.0.0`. NOTE (2026-03-27): expo-router is currently at `~6.0.23` in package.json — the downgrade was not applied. If EXPO_ROUTER_APP_ROOT reappears after enabling `newArchEnabled: true`, downgrade expo-router to ~5.0.0 as the fix.

---

## Pinned Bottom Buttons — Android

> ⚠ DEFINITIVE PATTERN (confirmed 2026-03-21): All pinned bottom action buttons must use `position: 'absolute'` with `bottom: 0`, `left: 0`, `right: 0`, `elevation: 8` on the wrapping View. Wrap the whole screen in `SafeAreaView` with `edges={['top', 'bottom']}` from `react-native-safe-area-context`. Do NOT put the button inside the `ScrollView` — it will be hidden on device when content is short. Do NOT use `flex: 1` on empty-state Views — use `paddingTop` for centering instead.

---

## newArchEnabled — EAS Builds Require true

> ⚠ Architecture note (2026-03-27): `newArchEnabled: true` is REQUIRED in `app.json` for EAS builds — `react-native-reanimated` v4 and `react-native-worklets` 0.5.1 both require New Architecture (Fabric + TurboModules). EAS builds fail with these packages when `newArchEnabled: false`.

> ⚠ If Expo Go local dev breaks with `newArchEnabled: true`: The prior fix of setting `newArchEnabled: false` was paired with `expo-router ~5.0.0` to avoid the EXPO_ROUTER_APP_ROOT error. If that error reappears with New Architecture enabled and expo-router ~6.x, check whether `expo-router` needs to be pinned at `~5.0.0`. The `android/gradle.properties` override (`newArchEnabled=true`) is NOT viable in Expo managed workflow — the android directory is generated by EAS during prebuild and any local file would be overwritten. The only lever for managed workflow is `app.json`.

> ⚠ react-native-worklets@0.5.1 requires New Architecture. It must remain as a dependency because `@shopify/react-native-skia` registers itself on import even when Skia components are not rendered. No replacement is available — requirement is satisfied by `newArchEnabled: true` in app.json.

---

## ImageBackground — Touch Absorption on Android (Part Profile)

> ⚠ Learned 2026-04-15: `ImageBackground` absorbs all touch events for child buttons on Android — The `editImageBtn` (camera icon, top-right) in `part-profile.tsx` WITH IMAGE path was nested inside `<ImageBackground>`. On Android, `ImageBackground` renders an `<Image>` that intercepts touch events before they reach absolutely-positioned child `TouchableOpacity` elements. The button appeared to render correctly but produced no response. Fix: replace `ImageBackground` with `<View style={[styles.imageHeader]}>` + `<Image style={StyleSheet.absoluteFillObject}>` as the first child. All other children (gradient overlay, back button, edit image button, name/type) sit as siblings above the image layer and receive touches normally. The gradient `View` was also given `pointerEvents="none"` since it is decorative. Additionally, the `initialsWrapper` View in the WITHOUT IMAGE path was given `pointerEvents="none"` — it is a full-height decorative watermark that was missing this prop, potentially absorbing touches before they reached the "Add Image" button beneath it (in z-order). Rule: any purely decorative absolute-positioned View that spans significant screen area MUST have `pointerEvents="none"`.

> ⚠ Learned 2026-04-15 (Parts Map — PanResponder stale closure): PanResponder is created once via `useRef`, so all callbacks capture the initial value of any React state variable (stale closure). Fix: mirror the state in a ref (`transformRef`) and update the ref synchronously in a combined setter: `const setTransform = useCallback((t: Transform) => { transformRef.current = t; setTransformState(t); }, [])`. Always read `transformRef.current` inside PanResponder callbacks, never the state variable.

> ⚠ Learned 2026-04-15 (Parts Map — SVG onPress vs PanResponder conflict): When PanResponder has `onStartShouldSetPanResponder: () => true`, it owns ALL touches including those on SVG children with `onPress`. The SVG `onPress` on `G` elements will NOT fire reliably. Solution: remove `onPress` from SVG elements entirely. Implement tap detection in PanResponder's `onPanResponderRelease`: if `isDragging` is false and elapsed time < 300ms, convert screen coordinates to canvas coordinates (`canvasX = (screenX - transform.x) / scale`) and hit-test against all node positions using radius comparison.

> ⚠ DEFINITIVE RULE (2026-04-15): Never use `ImageBackground` when interactive children (buttons, touchable elements) sit over the image. `ImageBackground` is safe only for purely decorative / non-interactive overlays. For interactive content over a background image, use `View + Image (absoluteFill)` instead.

