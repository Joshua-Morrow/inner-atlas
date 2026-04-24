# Inner Atlas — Session Progress Log

---

## Session: 2026-04-23 — Parts Map: Group Hulls, Hit Area Fix, Line Quality, Combined Mode

**Files changed:** `lib/graph-layout.ts`, `components/map/PartsMapCanvas.tsx`, `app/(tabs)/explore.tsx`, `components/map/NodeDetailSheet.tsx`

- `lib/graph-layout.ts`: Added `convexHull` (Jarvis march gift-wrapping), `expandHull` (centroid-push), and `hullToSmoothPath` (Catmull-Rom→cubic bezier smooth blob) exported helpers. Fixed `routeAroundObstacles`: intersection threshold tightened from `padding * 0.5` → `padding * 0.8`; endpoint exclusion zone widened from `0.05/0.95` → `0.08/0.92` for better near-endpoint obstacle detection.
- `PartsMapCanvas.tsx`: Group hull rendering — alliances get soft green blob, activation chains get soft gold blob (convex hull of 8-point node approximations, expanded 18px, smooth SVG path); hulls prepended to edges array so they render beneath edges and nodes. Alliance edge lines removed (hull replaces visual); chain lines + arrowheads remain. Hit area fix: replaced old `visibleCenterY/halfHeight` formula with explicit `hitCenterY/hitRadiusY` per type; long-press threshold `0.85→0.9`; `DEV_SHOW_HIT_AREAS` constant + red dashed Ellipse overlay for debugging; `[HitTest]` console.log on tap. Force layout: activation_chain gets sequential pairs at restLength 85/stiffness 0.14; alliance all-pairs at 90/0.12; polarization 240/0.04; protective 140/0.06. `computeInitialLayout` seeds both alliance and activation_chain groups near each other. Combined view mode: `structuralBaseOpacity` 0.5 (was binary atlas/feelings); feeling edges shown in combined mode at 0.65 opacity; `showFeelingEdges` replaces `viewMode === 'feelings'` check. `buildEdgePath` upgraded to cubic bezier (C command) for 0-waypoint and 1-waypoint cases.
- `explore.tsx`: `MapViewMode` extended to `'atlas' | 'feelings' | 'combined'`; Combined toggle button added. `prevRelIdsRef` tracks relationship IDs; `loadData` auto-resets layout positions when a new alliance or activation_chain relationship is detected. `REL_LEGEND` updated with `hull` flag + new colors (alliance `#4A9B73`, chain `#C8A44A`); legend renders hull swatches (rounded rect with `legendHullSwatch` style) for hull items, three-way conditional rendering for combined mode showing both structural and feeling entries.
- `NodeDetailSheet.tsx`: `viewMode` prop type extended to include `'combined'`.
- TypeScript: Clean — only pre-existing `trailhead/session.tsx:623` error.

---

## Session: 2026-04-23 — Round 3 Fixes: RelMap Pan/Zoom, Self Routing, Node Sizes, Relationship Display

**Files changed:** `components/ui/MeetingRelMap.tsx`, `components/map/PartsMapCanvas.tsx`, `lib/map-nodes.ts`, `app/relationships.tsx`

- `MeetingRelMap.tsx`: Full pan/zoom implementation using PanResponder (same pattern as PartsMapCanvas). Canvas sized to `SCREEN_HEIGHT - 220`; expands by 110px per node beyond 4. Layout tuned for compact (≤4 nodes): repulsionStrength 14000, centeringForce 0.004; spread (>4): 9000 / 0.007. Node layout radii: Self +20 (was +8), others +26 (was +16). Replaced ScrollView+TouchableOpacity overlays with PanResponder tap detection using `canvasOffsetRef` (measured via `View.measure` on layout). "pinch to zoom · drag to pan" hint shown when nodeCount > 3, hidden after first interaction.
- `PartsMapCanvas.tsx`: Self routing fix — obstacle radius inflated by +20 for Self (type 'self' or id '__self__'); `routeAroundObstacles` padding increased 10→16 for both structural and feeling edges; `pushControlPointAwayFromSelf` helper added — pushes bezier control point away from Self when it falls within clearance radius (Self visual + 28px). All three fixes together prevent edges from visually passing through Self node.
- `lib/map-nodes.ts`: NODE_SIZES reduced 25% across all types (self 44→33, manager/firefighter 32→24, exile 30→23, freed/unknown 28→21, shadowed 26→20). Intensity formula unchanged — now starts from smaller base giving tighter overall range.
- `app/relationships.tsx`: Protective and activation_chain relationships now shown in Structures tab. Added `protectives` and `activationChains` state arrays; updated type defs; added "Protective" and "Activation Chains" sections with appropriate icons (shield-checkmark, git-network) and member display (protector→protected for protective; ordered chip row for chains).
- TypeScript: Clean — only pre-existing `trailhead/session.tsx:623` error.

---

## Session: 2026-04-22 — Graph Layout Round 2: Edge Routing, SVG RelMap, New Types, Hit-Area Fix

**Files changed:** `lib/graph-layout.ts`, `components/map/PartsMapCanvas.tsx`, `components/map/PartsMapNode.tsx`, `components/ui/MeetingRelMap.tsx`, `app/new-relationship.tsx`, `lib/database.ts`, `app/(tabs)/explore.tsx`

- `lib/graph-layout.ts`: Added `clipLineToNodeBoundaries` (clips edge endpoints to node circle boundaries) and `routeAroundObstacles` (bends edge around nodes the straight line would cross, up to 2 waypoints). Pure helpers, no simulation changes.
- `PartsMapCanvas.tsx`: All structural + feeling edges now use `clipLineToNodeBoundaries` (lines stop at node surfaces) and `routeAroundObstacles` (bends around intervening nodes). `buildEdgePath` helper builds SVG path string for 0/1/2 waypoints. Activation chain edges now render sequential pairs only (not all-pairs). New types `protective` (solid #5B7FB8) and `activation_chain` (dashed #B88A00) with arrowhead dots for chains. `parts` added to edges useMemo dependency array.
- `PartsMapCanvas.tsx` hit-area fix: Tap and long-press both use ellipse hit test matching visible node extent (`nodeBottomY` based). Tap threshold `normalized < 1.0`, long-press `< 0.85`. Removed `+28`/`+14` radius hacks and `console.log` diagnostic.
- `PartsMapNode.tsx`: Removed trailing transparent hit-area `<Circle>` (cy=botY/2) — tap detection is handled entirely in PartsMapCanvas now.
- `MeetingRelMap.tsx`: Full SVG rewrite (react-native-svg). Self pinned at bottom-center (selfY = canvasHeight - 70). Other nodes via runLayout with centerY = canvasHeight*0.40, repulsionStrength 6500, centeringForce 0.008. Synthetic Self→part edges restLength 160, stiffness 0.025. Edges use clip + obstacle routing. Touch via absolutely-positioned TouchableOpacity over SVG (pointerEvents="none" wrapper on SVG). Focus mode preserved.
- `new-relationship.tsx`: Added `protective` and `activation_chain` types. Protective: protector(s)/protected(s) sides, writes side='a'/'b'. Activation Chain: ordered list with up/down reorder controls, writes side='1','2','3'... for position ordering. Updated `canContinue`, `handleCreate`, name placeholder.
- `lib/database.ts`: `getMapRelationships` now orders members by `CAST(side AS INTEGER)` for `activation_chain` type — ensures chain renders in correct sequence.
- `app/(tabs)/explore.tsx`: Added 'Protective' (#5B7FB8, solid) to `REL_LEGEND`.
- TypeScript: Clean — only pre-existing `trailhead/session.tsx:623` error.

---

## Session: 2026-04-22 — Graph Layout System + Focus Mode

**Files changed:** `lib/graph-layout.ts` (new), `components/map/PartsMapCanvas.tsx`, `components/map/PartsMapNode.tsx`, `app/(tabs)/explore.tsx`, `components/ui/MeetingRelMap.tsx`

- Force-directed layout (`lib/graph-layout.ts`): Fruchterman-Reingold + collision constraints, pure TS, no deps. Forces: repulsion (Coulomb), spring attraction (Hooke), centering, group attraction (loose type clustering). Cooling schedule, early convergence, O(n²) repulsion (fine for ≤30 nodes).
- `PartsMapCanvas.tsx`: force layout wired in after radial seed; runs every time parts/relationships change; Self always pinned at center; user-dragged parts (position_x != null) pinned at saved position; layout edges: alliance (restLength 110, k 0.08), polarization (restLength 220, k 0.04), chain (restLength 140, k 0.06).
- Tap diagnostic: hit radius bumped from +18 to +28; fallback to gs.x0/gs.y0 when gs.moveX/gs.moveY both zero (Android pure-tap bug); console.log diagnostic added.
- `onPartPress` now `(part: MapPart | null) => void`; empty-canvas tap calls with null.
- Focus Mode (`PartsMapCanvas`): `focusedPartId` prop drives `connectedPartIds` useMemo; structural/feeling edges dim to 0.08/0.06 when unfocused; nodes dim to 0.35x opacity via new `dimmed` prop on `PartsMapNode`.
- Feeling label collision avoidance: AABB overlap check against other placed labels + node circles; up to 6 slide attempts (±14px increments, perpendicular to edge).
- Reset Layout: now shows `Alert.alert` confirmation before clearing positions.
- Focus Mode (`explore.tsx`): `focusedPartId` state; `handlePartPress` toggles focus on tap, clears on re-tap or null; passed to canvas.
- `MeetingRelMap.tsx`: ring-based `computePositions` replaced with `runLayout` useMemo (keyed on node/edge count + canvasWidth); Self pinned at center; synthetic weak Self→all edges prevent corner drift; 250 iterations.
- Focus Mode (`MeetingRelMap`): `focusedNodeId` state; nodes wrapped in `TouchableOpacity`; transparent overlay clears focus on empty-area tap; edges dim to 0.1 opacity; labels hidden when edge dimmed.
- TypeScript: clean (only pre-existing trailhead/session.tsx:623 error).

---

## Session: 2026-04-22 — Map/Relationships Integration: Prompt B (Map Fixes + Feel-Towards Layer) + Prompt C (Relationships Screen Upgrade)

**Files changed:** `components/map/PartsMapNode.tsx`, `components/map/PartsMapCanvas.tsx`, `components/map/NodeDetailSheet.tsx`, `app/(tabs)/explore.tsx`, `app/relationships.tsx`, `app/feeling-edge-detail.tsx` (new), `app/add-feeling-connection.tsx` (new), `app/_layout.tsx`, `components/ui/MeetingFeelTowardsSeq.tsx`

**Prompt A fixes (MeetingFeelTowardsSeq.tsx):**
- Screen 4 filter: added `n.id !== currentTargetId &&` to prevent current meeting target appearing as selectable destination for Part Y's feel-towards
- Screen 1 Continue button: disabled (opacity 0.4) when no feelings selected and freeText is empty

**Prompt B — Parts Map Fixes + Feel-Towards Toggle Layer:**
- Bug 1 (tap registration): Added `useEffect` syncs for `panRef`/`scaleRef` as safety layer on stale closure guard
- Bug 2 (Self label): Fixed `y` from `size * 0.35` → `4` in `PartsMapNode.tsx` — label no longer renders below visual center
- Feature (feel-towards layer): Atlas/Feelings toggle added to Map header; `feelingEdges` state + `getAllFeelingEdges()` in `loadData`; feeling edges rendered as bezier curves with arrowhead dots (t=0.85 quadratic bezier) and feeling label overlays in `PartsMapCanvas.tsx`; structural edges faded to 25% opacity in Feelings mode; legend switches between structural/feeling descriptions; `NodeDetailSheet` shows feeling connections panel when in Feelings mode

**Prompt C — Relationships Screen Upgrade:**
- `relationships.tsx` rewritten as tabbed screen (Structures + Feelings tabs); Feelings tab shows edges grouped by from-part with chips + "View on Map" button; footer switches to gold "Add Feeling Connection" button in Feelings tab
- `feeling-edge-detail.tsx` (new): view/edit/delete + history timeline for a single feeling edge; accessible via `edgeId` param
- `add-feeling-connection.tsx` (new): 3-step manual flow — select from-part → select to-part (shows "Existing — will update" for known pairs) → chip selector (three groups); calls `upsertFeelingEdge` source='manual'
- `_layout.tsx`: registered `feeling-edge-detail` and `add-feeling-connection` routes
- `explore.tsx`: `useLocalSearchParams` reads `mode=feelings` param; `useFocusEffect` sets viewMode to 'feelings' when navigated from Relationships screen

**TypeScript:** Clean — only pre-existing `trailhead/session.tsx:623` error remains.

---

## Session: 2026-04-22 — Map/Relationships Integration: Data Foundation + Meeting Space Fixes

**Files changed:** `lib/database.ts`, `app/technique-session.tsx`, `components/ui/MeetingFeelTowardsSeq.tsx`

- **TASK 1 — New DB tables:** Added `feel_towards_edges` and `feel_towards_history` to `newTables` in `runMigrations()`. Both use IF NOT EXISTS — safe on existing installs.
- **TASK 2 — DB helpers:** Added `FeelingEdge` + `FeelingEdgeHistory` interfaces and five helpers in a clearly-labeled `=== FEEL TOWARDS EDGES ===` section: `upsertFeelingEdge` (with history snapshot on update + `__self__` resolution), `getAllFeelingEdges`, `getFeelingEdgesForPart`, `getFeelingEdgeHistory`, `deleteFeelingEdge`. ID generation uses same `Date.now().toString(36) + Math.random().toString(36).slice(2)` pattern as `generateId()` in technique-session.tsx.
- **TASK 3 — Meeting Space persistence:** Refactored `saveSession()` to capture `sessionRowId = resumeSessionIdRef.current ?? generateId()` before INSERT/UPDATE. INSERT now uses `sessionRowId` instead of inline `generateId()`. Added feel-towards write block after practice_sessions block: collects `relMap.edges` plus any `relational_edges` from meeting-dialogue step response, maps `'self'` node ids to real Self part ids (or `__self__` sentinel), calls `upsertFeelingEdge` for each edge with feelings.
- **TASK 4 — Filter fix:** In `MeetingFeelTowardsSeq.tsx` Screen 4 (`part-feels-others`), computed `partYAlreadyExpressed` Set from `relMap.edges` filtered to `fromId === partYId`, then added `!partYAlreadyExpressed.has(n.id)` to the `otherParticipants` filter. Session-only; no historical data consulted.
- **TASK 5 — MeetingRelMap:** Already correct — no changes needed. Verified arrowhead dots, feeling labels, `perpOffset`, `hasReverse` bidirectional logic all present.
- **TypeScript:** Clean — only pre-existing `trailhead/session.tsx:623` error remains.

---

## Session: 2026-04-20 — Parts Map Fixes (Touch, Self Node, Lines, Spacing, Drag, Legend)

**Files changed:** `components/map/PartsMapCanvas.tsx` (full rewrite), `components/map/PartsMapNode.tsx` (isDragging prop + drag ring), `app/(tabs)/explore.tsx` (features + legends), `lib/database.ts` (clearAllMapPositions)

- **BUG 1 — Touch offset fixed:** Replaced viewBox pan/zoom with `<G transform="translate scale">` approach. SVG viewBox is now fixed at `0 0 screenW screenH`. All pan/zoom encoded in transform. Touch coords from PanResponder convert to canvas space via `(pageXY - pan) / scale`.
- **BUG 2 — Self node fixed:** Synthetic `__self__` injected when no `type='self'` part in DB (only when other parts exist). Self always placed at canvas center.
- **BUG 3 — Overlapping lines fixed:** Edge specs grouped by canonical pair key. Parallel lines rendered with perpendicular offset proportional to index.
- **BUG 4 — Node spacing fixed:** Replaced grid fallback with radial layout. Self at center, parts on rings grouped by alliance/polarization relationships.
- **BUG 5 — Drag-to-reposition added:** Long-press (>420ms) enters drag mode for a node. Canvas does NOT pan while dragging. Position saved to DB on release. `dragTick` forces re-render.
- **FIX 6 — Relationship line legend added:** Small dashed-line legend card above node type legend (bottom-left overlay).
- **FIX 7 — Reset Layout button added:** Appears in header when `hasCustomPositions` is true. Calls `clearAllMapPositions()` then reloads data and increments `layoutResetKey`.

---

## Session: 2026-04-15 — Elaboration Feature Redesign v3

### Item 1 — Getting to Know (new feature)

**Database (`lib/database.ts`):**
- 14 new migrations added to `runMigrations()` — all use try/catch (safe to re-run)
- GTK Stage 1: `gtk_how_noticed`, `gtk_first_impression`
- GTK Stage 2: `gtk_needs_from_self`, `gtk_relationship_quality`, `gtk_concerns`
- GTK Stage 3: `gtk_origin_wound`, `gtk_what_carries`, `gtk_unburdened_vision`, `gtk_gift_to_system`
- Guided v3: `consent_given`, `safety_needs`, `agreement_requested`, `exile_contact_notes`
- Note: `part_perspective`, `feel_towards`, `job`, `fears`, `key_trigger`, `behavioral_patterns`,
  `developmental_history`, `gift_description` already existed — re-used, no new columns

**New file: `app/getting-to-know.tsx`:**
- Route: `/getting-to-know?partId=&stageId=1|2|3`
- Stage 1 (First Contact, `#1E3A5F`): body_location, gtk_first_impression, part_perspective, feel_towards
- Stage 2 (Getting Acquainted, `#0F766E`): job, fears, gtk_needs_from_self, gtk_relationship_quality, key_trigger, behavioral_patterns, gtk_concerns
- Stage 3 (The Deeper Story, `#7C3D9B`): developmental_history, gtk_what_carries, gtk_origin_wound, gtk_unburdened_vision, gift_description
- Accent-colored header border + stage banner; left 4px accent bar per prompt card
- Auto-save on blur per field (upsert); Save button saves all fields, router.back()
- SafeAreaView edges=['top','bottom'], TouchableOpacity, KeyboardAvoidingView

**`app/_layout.tsx`:** Added `getting-to-know` Stack.Screen

**`app/elaboration-menu.tsx` (full rewrite):**
- New `GETTING_TO_KNOW_STAGES` constant (3 stages with accentColor)
- `ProfileRow` interface expanded with all GTK + new exploration columns
- `getStageStatus()` helper checks relevant columns per stage
- `getGuidedStatus()` extended for `permissions` (3 fields) and `exile_contact`
- Section A: "Getting to Know" — 3 stage cards with left accent bars, TouchableOpacity
- Section B: "Descriptor Explorers" (unchanged content)
- Section C: "Guided Explorations" — now includes `permissions` + `exile_contact`
- Memories renamed to "Story, History & Memories"
- All new cards use TouchableOpacity per CLAUDE.md

### Item 2 — Descriptor Explorer: trays closed by default

**`app/descriptor-explorer.tsx`:**
- `expandedCategories` initial state changed from `new Set(first 3)` to `new Set()`
- All trays start collapsed
- When collapsed AND `selectedInCat > 0`: renders `"X selected"` summary line in typeColor beneath header
- `collapsedSummary` + `collapsedSummaryText` styles added

### Item 3 — Guided Explorations: enhanced questions + new topics

**`app/guided-exploration.tsx` (full rewrite):**
- `ExplorationConfig` extended: `exploreDeeper?: string[]`, `additionalFields?: AdditionalField[]`, `tagsField?: string` (optional)
- `ExplorationId` union extended with `'permissions'` and `'exile_contact'`
- Memories title → "Story, History & Memories"
- `exploreDeeper` prompts added to all 9 existing explorations
- `permissions` config: consent_given + safety_needs + agreement_requested additional fields
- `exile_contact` config: exile_contact_notes
- Tag block conditionally rendered only when `config.tagsField` is set
- Prompt card conditionally rendered only when `config.prompt` is non-empty
- `additionalTexts` state + load/save for extra fields
- `showExploreDeeper` toggle state; collapsible "Explore deeper" section (read-only cards, background `#F5F4F1`)
- desires_needs: pre-populates from `gtk_needs_from_self` if `desires` is empty on mount

**TypeScript:** Zero errors in all modified files (pre-existing error in trailhead/session.tsx unrelated)

---

## Session: 2026-04-15 — Phase 2.5 Parts Map Rebuild: SVG Canvas Foundation

### Parts Map SVG Rebuild — Prompt 1

**Packages installed:** `react-native-svg@15.12.1`

**Database (`lib/database.ts`):**
- Migrations: `is_burdened INTEGER DEFAULT 0`, `map_visible INTEGER DEFAULT 1` on `parts`
- Added `MapPart` interface + `getMapParts()` — single query joining `part_images` for `circle_uri`
- Added `savePartMapPosition()`, `setPartBurdened()`, `MapRelationship` interface, `getMapRelationships()`
- All helpers use synchronous `getDatabase()` (confirmed pattern — not async)

**New file: `lib/map-nodes.ts`:**
- `DEV_CHAIN_STYLE` toggle (`hanging-links` | `broken-shackle`)
- Node size constants + intensity scaling (`getNodeSize`)
- Type color constants (`getNodeColor`, supports `freed_*` variants)
- SVG path generators: `hexagonPath` (Manager), `shieldPath` (Firefighter), `roundedSquarePath` (Exile), `invertedTrianglePath` (Unknown)
- `nodeBottomY`, `getHangingLinks`, `brokenShacklePath`

**New component: `components/map/PartsMapNode.tsx`:**
- Renders correct shape per type (hexagon, shield, rounded-square, circle, inverted-triangle)
- Image inset via ClipPath + SvgImage with color tint layer
- Chain indicator (hanging-links or broken-shackle) per DEV_CHAIN_STYLE
- Selection ring (shape-matched), badges (elaborated dot, refined diamond)
- NO onPress — tap detection handled by canvas PanResponder

**New component: `components/map/PartsMapCanvas.tsx`:**
- SVG pan+zoom via PanResponder, NO Reanimated (newArchEnabled:false compatible)
- Stale closure fix: transform mirrored in ref (`transformRef`); `setTransform` updates both
- Pinch zoom: captures start state at first 2-finger touch; computes scale delta from start dist
- Tap detection: on release, if not dragging + elapsed < 300ms → hit-test canvas coords against all nodes
- Canvas coords formula: canvasX = (screenX - transform.x) / scale
- Initial transform centers canvas (grid nodes at CANVAS_W/2, CANVAS_H/2 appear at screen center)
- Relationship edges: quadratic bezier with perpendicular offset; green for alliance, red-dashed for polarization

**New component: `components/map/NodeDetailSheet.tsx`:**
- Modal slide-up sheet; part name, type pill, color dot
- "View Profile" → router.push to part-profile
- "Mark as Burdened" / "Remove Chain" for Manager/Firefighter only
- "Log Update" → router.push to log-update

**Replaced `app/(tabs)/explore.tsx`:**
- Filename preserved (explore.tsx = "Map" tab)
- Header: "Your Atlas" + part count badge
- Canvas or empty state
- Legend overlay (bottom-left, non-interactive)
- NodeDetailSheet triggered by canvas tap

**TypeScript:** zero new errors

---

## Session: 2026-04-15 — Phase 2.5 Part Image System + My Parts Grid Redesign

### PROMPT A — Core Image System

**Packages installed:** `expo-image-picker@~17.0.10`, `expo-image-manipulator@~14.0.8`

**Database (`lib/database.ts`):**
- Migration: `ALTER TABLE parts ADD COLUMN current_image_id TEXT`
- New table: `part_images` (id, part_id, rect_uri, circle_uri, original_uri, is_current, created_at)
- Added `PartImage` interface
- Added `getPartCurrentImage`, `getPartImages`, `deletePartImage` helper functions
- File deletion uses `expo-file-system/legacy` (v19 moved legacy API to subpath)

**New screen: `app/part-image-picker.tsx`:**
- Step 1: source selection (library / camera) with bottom sheet
- Step 2: rectangle crop (3:4 ratio) — draggable + BR-corner-resizable crop frame via PanResponder
- Step 3: circle crop (1:1 ratio) — same crop tool with circular border-radius overlay
- Live preview (60×80 rect, 64×64 circle) using clipped absolute-position Image trick
- Save: ImageManipulator v14 `.manipulate().crop().renderAsync()` → FileSystem.copyAsync → DB insert → back
- Route registered in `_layout.tsx`
- app.json: added expo-image-picker plugin with photo + camera permissions

**Updated `app/part-profile.tsx`:**
- Zone 1: ImageBackground when current_image_id set (rect image + gradient + edit button); "Add Image" prompt when no image
- State: partImages, activeTab, viewerImage, deletingImage; images loaded in useFocusEffect
- Tab bar: appears when 2+ images exist — "Profile" | "Images" tabs
- Images tab: 2-column grid of image cards with Current badge + dates
- Full-screen image viewer modal: rect + circle side-by-side, delete for non-current images with Alert confirmation

### PROMPT B — My Parts 2-Column Card Redesign

**New component: `components/ui/PartCard.tsx`:**
- 2-column card (CARD_W = (screenW - 32 - 12) / 2, CARD_H = CARD_W × 1.4)
- Image variant: ImageBackground with rect_uri + type badge + frosted glass overlay
- Fallback: type-color background + initials watermark + frosted overlay
- Frosted overlay: 36% height, rgba(15,14,13,0.72), left accent bar in type color
- Each card loads its own current image via `getPartCurrentImage` on mount

**Updated `app/my-parts.tsx`:**
- ScrollView + map → FlatList numColumns=2
- Query updated to include current_image_id
- columnWrapperStyle gap=12, paddingBottom=120 for pinned Add Part button

**TypeScript:** zero new errors (pre-existing error in trailhead/session.tsx unrelated)

---

## Session: 2026-04-15 (Fourth Pass — Prompt 9: Queue Propagation + Relational Map + Self Qualities Modal)

### FIX 1 — New parts (existing selection) not added to feel-towards queue
- `handleScreen2Continue` existing-part branch now calls `setPartQueue(prev => ...)`, `onRelMapUpdate(prev => ...)`, and `onPartAdded(part)` — all three fire before `setPhase('part-is-present')`.
- Previously, only inline-saved and 'unknown' parts were queued; selecting an already-saved part was silently dropped.

### FIX 2 — Stale relMap closures in all onRelMapUpdate calls
- `onRelMapUpdate` prop type changed from `(map: RelationalMap) => void` to `Dispatch<SetStateAction<RelationalMap>>` in both `MeetingFeelTowardsSeq` and `MeetingDialogueStep`.
- All `onRelMapUpdate(...)` calls in `MeetingFeelTowardsSeq` converted to functional form `prev => ...`:
  - `handleScreen1Continue` — Self→PartY edge
  - `handleSaveNewPart` — new node add
  - `handleScreen2Continue` (unknown + existing branches) — new node add
  - `handleScreen5Continue` — PartY→target edge
- All `onRelMapUpdate(...)` calls in `MeetingDialogueStep` converted to functional form:
  - `handleAddPartToMeeting` — new node add
  - `handleAddPartFeelContinue` — edge write
- `technique-session.tsx` passes `setRelMap` which is `React.Dispatch<React.SetStateAction<RelationalMap>>` — no change needed.

### FIX 3 — Self Qualities modal (same pattern as Rules)
- Removed `if (showSelfQualities) { return ... }` early-return full-screen swap.
- Added `<Modal visible={showSelfQualities} animationType="slide" transparent>` using `mo.overlay` + `mo.sheet` (same bottom-sheet style as Rules and Reframe).
- 8 Cs and 5 Ps rendered as gold `sq.pill` chips. "Back to meeting" button uses `mo.closeBtn` style.
- No router navigation involved.

### TypeScript
`npx tsc --noEmit` — zero new errors. Pre-existing error in `trailhead/session.tsx:623` remains.

---

## Session: 2026-04-15 (Fourth Pass — Prompt 8: Meeting Space Feel-Towards Cycle Redesign)

### Part 1 — MeetingFeelTowardsSeq.tsx full rewrite (6-phase machine)
- Removed `FullUnblendFlow` entirely. New phase type: `'feel-towards' | 'something-present' | 'part-is-present' | 'part-feels-others' | 'part-feels-one' | 'self-qualities'`.
- Screen 1 (feel-towards): chip picker for Part Y, always-active Continue, writes Self→PartY edge to relMap.
- Screen 2 (something-present): carried feelings strip, single-select part picker (excludes Part Y + Self), inline new-part save, Unknown part option (creates sequential DB entry), writes context to nextPartY state.
- Screen 3 (part-is-present): renders `UnblendSupportCard` directly; both `onHaveSpace` and `onStayedBlended` advance to `part-feels-others`.
- Screen 4 (part-feels-others): multi-select of other room participants (excludes Part Y and Self), records partYTargets.
- Screen 5 (part-feels-one): loops through partYTargets writing PartY→target edges to relMap.
- Screen 6 (self-qualities): 8Cs + 5Ps display-only pills; Continue resets Part Y state and returns to Screen 1 for SAME queueIndex.
- `handleSaveNewPart`: saves to DB with `discovered_via='meeting_room'`, writes activity log, adds to queue/map/localParts.
- `handleScreen2Continue`: handles `'unknown'` (creates `Unknown` / `Unknown N` DB entry) or named part.

### Part 2 — relational-map.ts addOrReplaceEdge
- `addOrReplaceEdge` was already fully implemented in a prior session — no changes needed.

### Part 3 — MeetingDialogueStep.tsx tray additions (Self Qualities + Add Part)
- Added `relMap?` and `onRelMapUpdate?` props.
- New tray items: **Self Qualities** (star-outline icon, offset 232) and **Add Part** (add-circle-outline icon, offset 288). Existing items shifted up 112px (Ground→344, Unblend→400, Rules→456, Reframe→512).
- Self Qualities overlay: non-interactive pills for 8Cs + 5Ps over a semi-transparent backdrop.
- Add Part flow: 3 sub-phases (select existing / inline new → feel-towards cycle per selected part → self-qualities reminder). Writes edges to relMap via `addOrReplaceEdge` + calls `onRelMapUpdate`.
- `technique-session.tsx`: `MeetingDialogueStep` now receives `relMap={relMap}` and `onRelMapUpdate={setRelMap}`.

### Part 4 — MeetingRelMap.tsx offset parallel edges
- `renderEdge()` now accepts `perpOffset: number = 0`.
- Perpendicular shift: `perpX = (-dy / length) * perpOffset`, `perpY = (dx / length) * perpOffset`. Applied to both endpoints and midpoint.
- Arrowhead circle uses offset `to` position `(tx, ty)`.
- In the edge loop: if a reverse edge exists (`e.fromId === edge.toId && e.toId === edge.fromId`), `perpOffset = 3` is applied. Because the perpendicular direction naturally flips between A→B and B→A, both edges land on opposite sides of the original line — no overlap.

### TypeScript
`npx tsc --noEmit` — zero new errors. Pre-existing error in `trailhead/session.tsx:623` remains.

---

## Session: 2026-04-15 (Fourth Pass — Prompt 7: Feel Towards / Inquiry / Unblending Fixes)

### FIX 1 — Self-like chip routing corrected (3 files)

- **`apps/mobile/components/ui/UnblendCycleStep.tsx`** — `isSelfEnergy()`: FEEL_TOWARDS_SELF_LIKE chips moved from `hasSelf` to `hasReactive` check. Selecting only self-like chips now routes to the unblend cycle ("A part is present"), not to "You're meeting [Part] from Self."

- **`apps/mobile/components/ui/MeetingGroundCheckStep.tsx`** — Same fix applied to `isSelfEnergy()` parameter function.

- **`apps/mobile/components/ui/MeetingFeelTowardsSeq.tsx`** — `isSelfOnlyResponse()` was already correct (already excluded `hasSelfLike`). No change needed.

### FIX 2 — "The part won't separate" flow (4 files)

- **`apps/mobile/components/ui/UnblendSupportCard.tsx`** — Added `onStayedBlended?(notes?: string)` prop. In unblending mode, new outlined "The part won't separate" button appears above the primary "I have a little more space now" button. Tapping it shows a support screen with: Option A (acknowledgement + reframe body text), horizontal divider, "If you'd like more support:" label, three expandable Option B cards (each with `TextInput`). "Continue the practice →" pinned button collects non-empty prompt inputs, calls `onStayedBlended`, and returns parent to `log` phase.

- **`apps/mobile/components/ui/ExperienceLogEntry.tsx`** — Added `stayedBlended?: boolean` to `ExperienceEntry` interface. Entry card row renders an amber "stayed with" pill (`backgroundColor: '#FFF7ED', color: '#C2600A'`) in place of the shield-checkmark icon when `stayedBlended === true`.

- **`apps/mobile/components/ui/ExperienceLogStep.tsx`** — Added `handleStayedBlended(notes?)`: creates entry with `stayedBlended: true` from `pendingEntry` (preserving category/description), appends `additionalNotes` from prompt text, adds to `entries`, returns to `log` phase. `UnblendSupportCard` now receives `onStayedBlended={handleStayedBlended}`.

- **`apps/mobile/app/technique-log.tsx`** — `ComplexStepRenderer` experience-log branch: added `stayedBlended?: boolean` to parsed type; renders amber "stayed with" pill in the entry row when true.

### TypeScript
`npx tsc --noEmit` — zero new errors. Pre-existing error in `trailhead/session.tsx:623` remains.

---

## Session: 2026-04-14 (Fourth Pass — Prompt 6b: Meeting Space Flow Redesign)

**Goal:** Replace MeetingGroundCheckStep with new sequential feel-towards flow; add MeetingRelMap display; wire relational map data model throughout technique-session.

### New Files

- **`apps/mobile/lib/relational-map.ts`** — TypeScript interfaces: `MapNode`, `MapEdge`, `RelationalMap`, `MapNodePartType`. Helper: `addOrReplaceEdge()`.

- **`apps/mobile/components/ui/MeetingFeelTowardsSeq.tsx`** — Sequential feel-towards component.
  - Phase machine: `feel-towards` → (reactive/self-like) → `FullUnblendFlow` overlay → `part-z-feel-others` → back to `feel-towards`
  - `isSelfOnlyResponse()`: advance queue when only Self-quality chips selected + no freetext
  - Queue grows dynamically as new parts added via unblending
  - For `'unknown'` result from FullUnblendFlow: creates DB entry with sequential naming ("Unknown", "Unknown 2", …), `part_profiles` row, `updates` activity log entry
  - For named parts: writes `updates` activity log entry
  - Part Z feel-others: Part Z checks feel-towards every other current room member
  - Progress indicator ("N of M parts") updates live as queue grows
  - `backRef` prop for technique-session back-interception: unblend → dismiss; part-z → feel-towards; queueIndex > 0 → previous part; queueIndex === 0 → bubble up

- **`apps/mobile/components/ui/MeetingRelMap.tsx`** — Read-only relational map canvas.
  - Layout: ≤4 other nodes → single circle; 5–8 → two rings; 9+ → three rings
  - Edges: midpoint-centered rotated View lines; arrowhead circles at `to` end; feeling label at midpoint
  - "New" badge (green dot) on parts added during session
  - "Before You Meet" header + "Continue to meeting rules" pinned button

### Changed Files

- **`apps/mobile/lib/techniques-data.ts`**
  - Added `'meeting-feel-towards'` and `'meeting-relational-map'` to TechniqueStep type union
  - Replaced meeting-space 6-step array with new 7-step array: `host-intro` (instruction) → `part-select` (part-select, multi) → `where-to-meet` (meeting-space-setup) → `feel-towards-seq` (meeting-feel-towards) → `relational-map` (meeting-relational-map) → `meeting-rules` → `meeting-dialogue`

- **`apps/mobile/app/technique-session.tsx`**
  - Removed `MeetingGroundCheckStep` import; added `MeetingFeelTowardsSeq`, `MeetingRelMap`, `RelationalMap`, `MapNodePartType` imports
  - Added `'meeting-feel-towards'`, `'meeting-relational-map'` to `SELF_MANAGING_TYPES`
  - Added `meetingFeelTowardsBackRef` ref and `relMap` state (RelationalMap, initialized with Self node)
  - `handleBack()`: added MeetingFeelTowardsSeq intercept (delegates to `backRef.current()`)
  - `handleContinue()`: when advancing from meeting-space part-select, initializes `relMap` nodes from `selectedPartIds`
  - `saveSession()`: replaced old unblend-cycle snapshot parsing with `notesObj.relational_map = relMap`; also builds backward-compat `relational_snapshot`
  - `spaceType` extraction: updated key from `'build-space'` to `'where-to-meet'`
  - Replaced `MeetingGroundCheckStep` renderer (unblend-cycle meeting-space branch) with simple `UnblendCycleStep` (meeting-space no longer has unblend-cycle)
  - Added `meeting-feel-towards` renderer (MeetingFeelTowardsSeq with `initialPartIds=selectedPartIds`, `relMap`, `onRelMapUpdate=setRelMap`, `onPartAdded` updates both `parts` and `selectedPartIds`, `backRef`)
  - Added `meeting-relational-map` renderer (MeetingRelMap with `relMap`, `onContinue=advanceStep`)
  - Ground button: simplified condition (suppress for `unblend-cycle`, `meeting-feel-towards`, `meeting-relational-map`, `experience-log`, `inquiry-questions`, `meeting-dialogue`)

### TypeScript
`npx tsc --noEmit` — zero new errors. Pre-existing error in `trailhead/session.tsx:623` remains.

---

## Session: 2026-04-14 (Fourth Pass — Prompt 6: Meeting Space Fixes)

**Goal:** FIX 1 inline new-part save in part selector (already done). FIX 2 dialogue message attribution lost in saveSession. FIX 3 readOnly URL param for dialogue-session. FIX 4A pre-close relational check in MeetingDialogueStep. FIX 4B arrowhead markers in RelationalSnapshot.

### Changes

- **`apps/mobile/components/ui/MeetingDialogueStep.tsx`**
  - FIX 1: Audited — inline new-part save already fully implemented in `part-select` step. Skipped.
  - FIX 4A: Extended `PromptPhase` with `'pre-close' | 'relational-check'`. Added `pairFeelings: Record<string, string[]>` state. Replaced `Alert`-based close with `handleTryClose()` → pre-close phase → optional relational-check phase. Pre-close: back to dialogue, "Note feelings (optional)" → relational-check, "End meeting" → `handleCloseConfirm()`. Relational-check: scrollable pair list with ALL_FEELINGS chips, "Done — end meeting" → `handleCloseWithRelational()`, "Skip" → `handleCloseConfirm()`. Pair key: `${fromId}→${toId}` with `indexOf('→')` split.

- **`apps/mobile/app/technique-session.tsx`**
  - FIX 2: Widened `dialogueData` message type to include `partId?` and `isSelf?`. Fixed `saveSession` mapping: `part_id: m.isSelf ? null : (m.partId ?? null)` for messages, `part_id: op.partId ?? null` for opening_prompts.
  - FIX 4A: Added `relational_edges` extraction from `dialogueData` into `snapshotEdges` in `saveSession`.

- **`apps/mobile/app/dialogue-session.tsx`**
  - FIX 3: Added `readOnly` URL param — `readOnlyParam === '1'` sets read-only mode alongside existing `status === 'complete'` check.

- **`apps/mobile/components/ui/RelationalSnapshot.tsx`**
  - FIX 4B: Added small circle arrowhead (width:6, height:6, borderRadius:3) at `to` node position of each edge. Gold `rgba(184,138,0,0.5)` for Self edges, white `rgba(255,255,255,0.3)` for part-to-part edges.
  - Changed default `size` prop from 280 to 300.

### TypeScript
`npx tsc --noEmit` — zero new errors. Pre-existing error in `trailhead/session.tsx:623` remains.

---

## Session: 2026-04-14 (Fourth Pass — Prompt 5: Inquiry + FullUnblendFlow Wiring)

**Goal:** Remove "Stay with that answer" delay from Inquiry, add collapsible tray, wire `FullUnblendFlow` into Inquiry / Feel Towards / Meeting Room.

### Changes

- **`apps/mobile/components/ui/InquiryQuestionsStep.tsx`** (rewrite)
  - FIX 1: Removed `answerSavedMsg` state, `setAnswerSavedMsg(true)` call, `setTimeout` delay, `{answerSavedMsg && …}` render block, `answerSavedText` style. "Save answer" now calls `setPhase('picker')` immediately.
  - FIX 1: Removed `introFrame` text block from fixed questions phase.
  - FIX 2: Replaced `FloatingUnblendBtn` + Modal with collapsible tray (toggle `bottom: 88`, Ground `bottom: 148`, Unblend `bottom: 204`). Added `onGround?` prop. Removed `fab` and `u` style blocks.
  - FIX 3: Added `parts`, `onPartSaved` props. Added `showFullUnblend`, `unblendLog` state. Tray Unblend triggers `FullUnblendFlow`. `handleDone()` includes `unblend_log` in JSON.

- **`apps/mobile/components/ui/FullUnblendFlow.tsx`**
  - Narrowed `PartRow.type` from `PartType | string` to `PartType` (always saves `'unknown'`).

- **`apps/mobile/components/ui/UnblendCycleStep.tsx`**
  - FIX 3: Added `onPartSaved?` prop. Added `showFullUnblend`, `unblendLog` state. Tray Unblend now triggers `FullUnblendFlow` instead of `setPhaseAndNotify('unblend-support')`. `FullUnblendFlow` rendered at bottom of feel-towards/check-again view. `unblend_log` added to `handleSelfSitContinue` JSON output.

- **`apps/mobile/components/ui/MeetingDialogueStep.tsx`**
  - FIX 3: Added `onPartSaved?` prop. Added `showFullUnblend` state. Tray Unblend button (bottom: 288) now calls `setShowFullUnblend(true)` instead of `setUnblendMode('choice')`. `FullUnblendFlow` rendered with `context="meeting-room"` and `onPartSaved` propagates to `localParts` + `localSelectedIds` + parent.

- **`apps/mobile/app/technique-session.tsx`**
  - FIX 2/3: `InquiryQuestionsStep` now receives `onGround`, `parts`, `onPartSaved`. Ground button suppressed for `inquiry-questions` step type. `UnblendCycleStep` and `MeetingDialogueStep` receive `onPartSaved`.

- **`apps/mobile/app/technique-log.tsx`**
  - FIX 3: `inquiry-questions` parsed type extended with `unblend_log?`. Renders "Unblended N time(s): [part names]" when present.

### TypeScript
`npx tsc --noEmit` — zero new errors. Pre-existing error in `trailhead/session.tsx:623` remains.

---

## Session: 2026-04-14 (Fourth Pass — Prompt 4: Feel Towards Fixes)

**Goal:** Fix self-like chip styling, chip order, back button interception, and self-sit-with note in log.

### Changes

- **`apps/mobile/components/ui/UnblendCycleStep.tsx`**
  - FIX 1: Added `React` import for `React.MutableRefObject`. Added `onPhaseChange?` and `returnToBaseRef?` props. Added `setPhaseAndNotify()` helper. Added `useEffect` to register `() => setPhaseAndNotify('feel-towards')` on `returnToBaseRef`. Replaced all `setPhase(` calls with `setPhaseAndNotify(`.
  - FIX 1: "SELF-LIKE ENERGY PRESENT" → "SELF-LIKE PART PRESENT" label. `selfLikeChip` changed to `{ backgroundColor: 'transparent', borderColor: '#22C55E' }`. `selfLikeChipSelected` → `rgba(34,197,94,0.2)` fill. Added `selfLikeChipText` style. Updated JSX to use `selfLikeChipText` for self-like chip text.
  - FIX 2: Chip order changed to PARTS PRESENT → SELF-LIKE PART PRESENT → SELF-ENERGY PRESENT.

- **`apps/mobile/components/ui/MeetingGroundCheckStep.tsx`**
  - FIX 1: Same label, style, and JSX fixes as UnblendCycleStep for self-like chips.
  - FIX 2: Chip order changed to PARTS PRESENT → SELF-LIKE PART PRESENT → SELF-ENERGY PRESENT.

- **`apps/mobile/app/technique-session.tsx`**
  - FIX 3: Added `unblendCyclePhaseRef` and `unblendCycleReturnRef` refs. `handleBack()` now intercepts when `unblend-cycle` step is in a non-base phase. Passes `onPhaseChange` and `returnToBaseRef` to `UnblendCycleStep`.

- **`apps/mobile/app/technique-log.tsx`**
  - FIX 4: Added `self_sit_note?` to unblend-cycle parsed type. Renders it as gold italic text "Self sit-with: [note]" at the end of the unblend-cycle session card.

### TypeScript
`npx tsc --noEmit` — zero new errors. Pre-existing error in `trailhead/session.tsx:623` remains.

---

## Session: 2026-04-14 (Fourth Pass — Prompt 3: Unblending Fixes)

**Goal:** Fix back button navigation, tray button order, and sitWithNotes rendering.

### Changes

- **`apps/mobile/app/technique-session.tsx`**
  - Added `experienceLogPhaseRef` and `expLogReturnToLogRef` refs for sub-phase tracking.
  - `handleBack()` now checks if `currentStep.type === 'experience-log'` and phase is not `'log'` — if so, calls `expLogReturnToLogRef.current()` to return to log phase instead of navigating back.
  - Passes `onPhaseChange` and `returnToLogRef` to `ExperienceLogStep`.

- **`apps/mobile/components/ui/ExperienceLogStep.tsx`**
  - Added `returnToLogRef?: React.MutableRefObject<(() => void) | null>` prop.
  - `useEffect` registers `() => setPhaseAndNotify('log')` on the ref when mounted; clears on unmount.
  - Tray swap: Notice moved to `bottom: 148` (closer to toggle), Ground moved to `bottom: 204` (further up).

- **`apps/mobile/components/ui/UnblendCycleStep.tsx`**
  - Tray swap: Unblend moved to `bottom: 148` (closer to toggle), Ground moved to `bottom: 204` (further up).

- **`apps/mobile/components/ui/ExperienceLogEntry.tsx`**
  - Added `sitWithSection` block in expanded state: renders non-empty `sitWithNotes` entries with labels Body/Visual/Emotion/Voice/Memory at 13px `#9B9A94`. Section label "What you noticed" at 11px. Only shown when card is expanded and `sitWithNotes` has entries.

### TypeScript
`npx tsc --noEmit` — zero new errors. Pre-existing error in `trailhead/session.tsx:623` remains.

---

## Session: 2026-04-14 (Fourth Pass — Prompt 2: Parts Mindfulness Bell Fix)

**Goal:** Fix bell sound require path in MindfulnessPracticeStep.

### Changes — `apps/mobile/components/ui/MindfulnessPracticeStep.tsx`

- **FIX 1 — Bell require path:** Changed `require('@/assets/Bell.mp3')` to `require('../../assets/Bell.mp3')`. Component lives at `components/ui/`, so `../../assets/Bell.mp3` is the correct static literal relative path to `apps/mobile/assets/Bell.mp3`. `Audio.setAudioModeAsync`, fresh-instance-per-ring pattern, and `setOnPlaybackStatusUpdate` unload were already correct.

### TypeScript
`npx tsc --noEmit` — zero new errors. Pre-existing error in `trailhead/session.tsx:623` remains.

---

## Session: 2026-04-14 (Fourth Pass — Prompt 1: RFB Fixes)

**Goal:** Fix RFB bell sound, add working countdown timer, and update "I'm done" button styling.

### Changes — `apps/mobile/app/technique-session.tsx` (RFBTimerStep)

- **FIX 1 — Bell sound:** Confirmed `require('@/assets/Bell.mp3')` path, `Bell.mp3` at `assets/Bell.mp3`, `app.json` `"assets"` array, and `Audio.setAudioModeAsync` before each play — all already correct. No code change needed.
- **FIX 2 — Countdown timer:** Added `secondsLeft`, `timerComplete` state and `intervalRef`. Added `useEffect` keyed to `timerStarted` that runs a 1-second `setInterval` decrementing `secondsLeft`; sets `timerComplete` when it reaches zero. "Begin breathing" `onPress` now initializes `secondsLeft` from `durationInput` before flipping `timerStarted`. MM:SS countdown display added to active timer screen below BreathingCircle.
- **FIX 3 — Done button styling:** Base `doneBtn` now has `borderWidth: 1, borderColor: '#3A3937'` and text at `rgba(255,255,255,0.4)`. When `timerComplete` is true, `doneBtnActive` overlay applies `backgroundColor/borderColor: '#3B5BA5'` and `doneBtnTextActive` applies `color: '#FFFFFF'`. Button is always a `TouchableOpacity` (never disabled).

### TypeScript
`npx tsc --noEmit` — zero new errors. Pre-existing error in `trailhead/session.tsx:623` remains.

---

## Session: 2026-04-13 (Techniques Third Pass — 9 Sections)

**Goal:** Implement 9 remaining spec sections across technique-session, ExperienceLogStep, UnblendCycleStep, technique-log, and RelationalSnapshot.

### New Features

- **Section 3 — Sit-With-Part phase in ExperienceLogStep:** After UnblendSupportCard dismisses (non-quickUnblend path), enters a new `'sit-with-part'` phase showing 5 prompted TextInput cards (body, appearance, feel-towards, voice/sound, quality). `saveSitWithToProfile()` writes non-empty responses to `part_profiles` columns (`body_location`, `appearance`, `feel_towards`, `voice_phrases`) and inserts a `part_memories` row for the quality response. Transitions to `'part-linking'` after Continue. Phase type extended to `'log' | 'unblend-support' | 'sit-with-part' | 'part-linking'`.

- **Section 4 — GroundingOverlay rewrite:** Full-screen overlay with ScrollView layout. Added breathing rate slider (4.0–7.0s) with rate label, bell toggle (Switch), and expo-av bell pattern from RFBTimerStep. Two footer buttons: "Return to session" and "End & save now." Removed centered breathWrapper in favour of flex flow.

- **Section 5 — ExperienceLogStep collapsible tray:** FAB replaced with a single toggle button at `bottom: 88`. When open: Ground at `bottom: 148`, Notice/Add at `bottom: 204`. Full-screen dismiss overlay at zIndex 9.

- **Section 6 — technique-log unblend-cycle render fix:** `free_text` line now uses gold italic style (`cr.noticeTextLine`); `in_self_note` uses gray italic (`cr.descLine`).

- **Section 7 — UnblendCycleStep collapsible tray:** Added `onGround` and `selectedPartId` props. In feel-towards/check-again phases: collapsible tray at bottom (toggle at 88, Ground at 148, Unblend at 204). Ground calls `onGround?.()`, Unblend calls `setPhase('unblend-support')` for quick in-loop unblend.

- **Section 10 — Self sit-with timer in UnblendCycleStep:** After `handleFinishInSelf`, enters `'self-sit-with'` phase. 120-second countdown (MM:SS via useEffect setInterval). Optional TextInput for free-form Self-energy note. "Skip timer" link. Continue saves note to `feel_towards` in `part_profiles` (appends with `\n---\n`); calls `onAdvance` with extended JSON including `self_sit_note`.

- **Section 14 — Meeting Space saves inner_dialogue + meeting_room updates:** In `saveSession` after building relational snapshot: parses meeting-dialogue step response, generates UUID dialogueId, builds participants/allMessages arrays, INSERTs into `inner_dialogues` with status='complete'. Writes `meeting_dialogue_id` into notesObj before practice_sessions INSERT. After INSERT: loops `selectedPartIds`, INSERTs meeting_room updates into `updates` table.

- **Section 15 — technique-log meeting-dialogue link:** `ParsedSession` extended with `meeting_dialogue_id?`. Renderer shows "View Dialogue →" button when dialogueId is set; navigates to `/dialogue-session?dialogueId=…`.

- **Section 16 — RelationalSnapshot View-based connection lines:** Replaced legend with inline View lines. Each edge: centered at midpoint (`left: midX - length/2, top: midY - 0.75`), rotated via `transform: [{ rotate }]`. First feeling shown as label at midpoint (+N if more). Self-connected edges rendered gold/amber; part-to-part edges rendered in faint white.

### TypeScript
`npx tsc --noEmit` — 3 new errors fixed (dead style comparison in technique-session, onPhaseChange type too narrow in ExperienceLogStep, missing useEffect import in UnblendCycleStep). One pre-existing error in `app/trailhead/session.tsx:623` remains (unrelated).

---

## Session: 2026-04-13 (Round 2 — 12 Bug Fixes)

**Goal:** Fix bell sound silence, mindfulness "sit with" save, mindfulness log rendering, remove redundant unblend button from Unblending, add "Unknown part" option, hide ground button during part-linking, inline new-part save in Feel Towards/Inquiry/Meeting Space, show selected feelings on UnblendSupportCard, remove answered questions from Inquiry picker, collapsible support tray in Meeting Space, horizontal scroll affordance for speaker chips, and relational snapshot at session close.

### New Files

- **`components/ui/RelationalSnapshot.tsx`** — Static diagram of Self/part relationships from a Meeting Space session. Self (48px gold circle) at canvas center; other nodes (36px type-colored circles) arranged in a circle via angle math. Edge legend below (no SVG). Exported: `RelationshipNode`, `RelationshipEdge` interfaces. Default size 280.

### Modified Files

- **`app/technique-session.tsx`**
  - FIX 1: Bell require path changed to `require('@/assets/Bell.mp3')`; added `Audio.setAudioModeAsync({ playsInSilentModeIOS: true })` before each play for iOS silent mode.
  - Added `experienceLogPhase` state; passed `onPhaseChange` to `ExperienceLogStep`; ground button hidden during `part-linking` phase.
  - Passed `onGround` callback to `MeetingDialogueStep` so tray Ground button can trigger `GroundingOverlay`.
  - In `saveSession`: extracts `unblend-cycle` step response to build `relational_snapshot` (nodes + edges) from feel-towards data; writes into `notes_json` of the saved practice_session.

- **`components/ui/MindfulnessPracticeStep.tsx`**
  - FIX 1 (bell): same path + `setAudioModeAsync` fix.
  - FIX 2: `handleAddNote(id, note)` updates `additionalNotes` array on entry; wired to `ExperienceLogEntry.onAddNote` — checkmark now persists "sit with" text.
  - FIX 3: `technique-log.tsx` condition extended to include `mindfulness-practice` step type for experience-log rendered view.

- **`components/ui/ExperienceLogStep.tsx`**
  - FIX 4: Removed floating unblend button entirely from this component (redundant — Unblending step already has external unblend).
  - FIX 5: Added "Unknown part" selectable row above "Name a new part" section in part-linking phase.
  - FIX 6: Added `onPhaseChange` prop; parent hides ground button when phase is `part-linking`.

- **`components/ui/UnblendSupportCard.tsx`**
  - FIX 8: Added `selectedFeelings?: string[]` prop; renders amber feeling pills row above body text when present in unblending mode.

- **`components/ui/UnblendCycleStep.tsx`**
  - FIX 7: Added `localParts` state; `handleSaveIdentifyNewPart` saves to DB, adds to `localParts`, auto-selects — no navigation away. "Unknown part" card added to identify-part phase.
  - FIX 8: Passes reactive `selectedFeelings` (filtered subset of chip selections) to `UnblendSupportCard`.

- **`components/ui/InquiryQuestionsStep.tsx`**
  - FIX 9: Picker builds `answeredQuestions` set from prior responses; filters out already-answered entries from `PICKER_QUESTION_ENTRIES`; shows completion state when none remain.

- **`components/ui/MeetingDialogueStep.tsx`**
  - FIX 10: Replaced 4 scattered absolute buttons with a collapsible tray. Single 48×48 toggle button (`ellipsis-horizontal`/`close`) at `bottom: 88, right: 20`. Tray items at `bottom: 148/204/260/316/372` with `row-reverse` layout (button + label pill). Full-screen dismiss overlay (zIndex 9) when tray open. `onGround` prop wires Ground tray item to parent GroundingOverlay.
  - FIX 11: Speaker chip bar wrapped in `speakerBarWrap`; right-fade overlay (`speakerBarFade`); `scrollHint` text shown for 3 seconds on mount.

- **`app/technique-log.tsx`**
  - FIX 3: Added `mindfulness-practice` to experience-log renderer condition.
  - FIX 12: Imports `RelationalSnapshot`; added `RelationalSnapshotData` interface and `relational_snapshot` field to `ParsedSession`; extracts from `notes_json` in `loadSessions`; renders `<RelationalSnapshot>` in `SessionCard` when expanded and snapshot has nodes.

- **`app.json`** — Added `"assets": ["./assets/Bell.mp3"]` for bundling.

- **`CLAUDE.md`** — Build date updated to 2026-04-13.

### TypeScript
`npx tsc --noEmit` — zero new errors. One pre-existing error in `app/trailhead/session.tsx:623` (dynamic router.replace string, unrelated).

---

## Session: 2026-04-12 (Week 6 Meeting Space Fixes)

**Goal:** Fix multi-part selection enforcement, per-part ground check, dialogue pre-population, part avatars, inline part save, unblend choice modal, and close meeting button design.

### New Files

- **`components/ui/MeetingGroundCheckStep.tsx`** — Per-part Self-energy ground check for Meeting Space. Scrollable parts header shows all meeting room parts with green checkmarks when resolved. Runs independent feel-towards → identify-part → unblend-support → multi-part-check → check-again loop per part. New parts saved to DB and propagated via `onNewPartsAdded` callback. Multi-part blending check after each unblend: "Does this part have feelings about other parts here?"

### Modified Files

- **`app/technique-session.tsx`** — FIX 1: Continue button disabled with < 2 parts selected on meeting-space multi-select screen; label shows "Select N more". FIX 2: `unblend-cycle` step renders `MeetingGroundCheckStep` for meeting-space, passing `onNewPartsAdded` that updates both `parts` and `selectedPartIds`.

- **`components/ui/MeetingDialogueStep.tsx`** — FIX 3: `localParts`/`localSelectedIds` state reads live parts including ground check additions. FIX 4: prompt-3 → dialogue transition pre-populates `messages` with 3 opening prompt responses as history. FIX 5: 32px circular avatar per message (type-color bg, initials) — left of bubble for parts, right for Self. FIX 6: Inline new-part save in opening prompt-1 and prompt-2 selectors. FIX 7: Unblend button opens two-option choice modal (pulled-in → room part select; new part → name form → DB save → room). FIX 8: "Close meeting" replaced with visible outlined pill button at `bottom: 80, left: 16`.

---

## Session: 2026-04-12 (Week 5 Inquiry Fixes)

**Goal:** Fix inline part save, remove "I'm done asking" from fixed question screens, add "Save answer" button to asking phase, align ground/unblend button styles, save inquiry responses to part_profiles.

### Changes

- **`InquiryQuestionsStep.tsx`** — Full rewrite.
  - Added `selectedPartId: string | null` prop for part_profiles save.
  - Added `saveResponseToPartProfile(questionIndex, responseText)`: maps INQUIRY_QUESTIONS indices to part_profiles columns via hardcoded `COLUMN_MAP`; `voice_phrases` appends; all other fields only write if empty (preserves Elaboration data); `INSERT OR IGNORE` ensures row exists.
  - Replaced `PICKER_QUESTIONS` (strings only) with `PICKER_QUESTION_ENTRIES` (tracks original INQUIRY_QUESTIONS index) so picker questions can look up their column mapping.
  - Fixed question phase: removed "I'm done asking" button — only "Next question" button remains. Calls `saveResponseToPartProfile` + `saveCurrentResponse` on advance.
  - Asking phase: replaced "I'm done asking" with "Save answer" (primary, calls `saveResponseToPartProfile` + returns to picker) + "Back to questions" (secondary, returns to picker without part_profiles save).
  - Picker phase: "I'm done asking" remains as the sole exit point — unchanged.
  - Added `// TEXT:` comments above all phase headings.
  - Shadow on fab.btn matched to ground button shadow values.

- **`technique-session.tsx`** — Added `selectedPartId={selectedPartId}` prop to `<InquiryQuestionsStep>`.

### FIX 1 (inline part save)
Already implemented in prior session (pre-technique Fix 6). Confirmed present: `PartSelectStep` component with inline `handleSaveNewPart`, auto-select, and "✓ [name] saved and selected" confirmation.

### Button alignment (FIX 3)
Ground button: parent renders `position: absolute, bottom: 100, right: 20, leaf-outline`. Unblend button: `InquiryQuestionsStep.FloatingUnblendBtn` at `position: absolute, bottom: 164, right: 20, git-branch-outline`. Both 52×52, #1E1E1C bg, #2A2927 border, 9px label. Already correctly positioned.

### TypeScript
Run `npx tsc --noEmit` to verify.

---

## Session: 2026-04-12 (Week 3 Unblending Fixes)

**Goal:** Fix button overlap, save noticeText from UnblendSupportCard, entry expansion with "sit with" notes, phase machine with part-linking, and remove router.push('/add-part').

### Changes

- **`ExperienceLogEntry.tsx`** — Full rewrite. `ExperienceEntry` interface extended with `noticeText?`, `additionalNotes?`, `linkedPartId?`, `linkedPartName?`. Entry card now taps to expand (shows "sit with" TextInput + save button); long-press reveals delete. Renders noticeText (gold italic), linkedPartName (blue), and additionalNotes (bullet list).

- **`UnblendSupportCard.tsx`** — `onHaveSpace` signature changed to `(noticeText?: string) => void`. Unblending mode dismissal now passes `note.trim() || undefined` to the handler. Mindfulness mode dismissal passes `undefined`. All existing callers with 0-arg functions remain TypeScript-compatible (optional param).

- **`ExperienceLogStep.tsx`** — Full rewrite. Phase machine: `'log' | 'unblend-support' | 'part-linking'`. After UnblendSupportCard dismisses, attaches `noticeText` to pending entry and transitions to part-linking screen. Part-linking: radio-select from existing parts list OR inline save new part to DB (INSERT into `parts` + `part_profiles`). Skip option commits entry without link. Floating unblend button (`bottom: 208`, `git-branch-outline`) for on-demand unblend without adding a new entry. FAB moved to `bottom: 80` (was 88). Removed `router.push('/add-part')` link entirely.

- **`technique-session.tsx`** — Two changes: (1) `ExperienceLogStep` now receives `parts={parts}` prop for part-linking screen. (2) Ground button uses inline style override `{ bottom: 144 }` when `currentStep?.type === 'experience-log'` (above + FAB at 80 and floating unblend at 208).

### TypeScript
- `npx tsc --noEmit` returns 1 pre-existing error in `app/trailhead/session.tsx:623` (dynamic `router.replace` string — unrelated to this session). Zero new errors.

---

## Session: 2026-04-12 (Week 2 Parts Mindfulness)

**Goal:** Combine timer + experience log onto one screen; differentiate mindfulness support card copy.

### Changes

**`techniques-data.ts`** — Added `'mindfulness-practice'` to `TechniqueStep.type` union. Replaced parts-mindfulness `timer` + `experience-log` steps with a single `mindfulness-practice` step. Steps: `before` + `mindfulness-practice`.

**`MindfulnessPracticeStep.tsx`** (new): Zone A (fixed): breathing circle animates only when running + Inhale/Exhale label + elapsed time + controls (duration picker / sound toggle / Start-Pause-Resume). Zone B (scrollable): experience log + ExperienceLogEntry cards. + FAB at bottom:80 right:20. After each entry: UnblendSupportCard in mindfulness mode (timer continues in background via hooks). Bell sounds via expo-av. "Done practicing" pinned footer calls onAdvance.

**`UnblendSupportCard.tsx`** — Added `mode?: 'unblending' | 'mindfulness'` prop. Mindfulness mode: "Something arose." heading, "Notice it as a part" body, "Noted — back to breathing" button, no note input.

**`technique-session.tsx`** — Added `'mindfulness-practice'` to `SELF_MANAGING_TYPES`, imported + rendered `MindfulnessPracticeStep`.

---

## Session: 2026-04-12 (Week 1 RFB Fixes)

**Goal:** Add pre-start screen, timer duration + sound controls, and bell sounds to RFB timer step.

### Changes

**RFBTimerStep component** — new self-managing component (replaces generic timer rendering for RFB):
- Pre-start screen: duration input (numeric, 1–60 min, default 10), breathing rate slider, bell sound toggle with Switch
- Active timer: breathing circle + rate slider + sound toggle all visible and adjustable; "I'm done" advances to next step
- Bell sounds: `Audio.Sound.createAsync` from `expo-av` creates a fresh instance per transition so rings overlap naturally; fails silently on error
- Sound enabled/disabled via ref pattern — toggle works immediately without restarting animation

**BreathingCircle** — added optional `onPhaseChange` callback (fires at each inhale↔exhale transition). Uses a stable ref pattern (`onPhaseChangeRef.current`) to avoid restarting the animation when the callback changes.

**isSelfManaging** — RFB timer step now enters the self-managing render path (`isRFBTimer` flag).

**Assets** — `assets/sounds/copper-bell-ding.mp3` placeholder created. Replace with actual bell audio file.

**expo-av** — already installed (`~16.0.8`), no new install needed.

---

## Session: 2026-04-12 (Pre-Technique Global Fixes)

**Goal:** Fix 7 global issues affecting all techniques before technique-specific work.

### Changes

**Fix 1 — No duplicate end screen:** Removed `after` input step from all 6 techniques (`rfb`, `parts-mindfulness`, `unblending`, `feel-towards`, `inquiry`, `meeting-space`) in `techniques-data.ts`. The `CompletionScreen` in `technique-session.tsx` is the single canonical end screen.

**Fix 2 — Differentiated icons:** Ground button now uses `leaf-outline` (grounding = earth). Unblend button now uses `git-branch-outline` (branching = separation). Updated in `technique-session.tsx`, `InquiryQuestionsStep.tsx`, `MeetingDialogueStep.tsx`.

**Fix 3 — Standardized button stack (bottom-right):** All support buttons now on right side. Ground: `bottom:100 right:20`. Unblend: `bottom:164 right:20`. Rules: `bottom:228 right:20`. Reframe: `bottom:292 right:20`. All 52×52, `#1E1E1C` bg, `#2A2927` border, `#9B9A94` icon, 9px label.

**Fix 4 — Practice log readable content:** `ComplexStepRenderer` component added to `technique-log.tsx`. Parses and renders `experience-log` (category badges + unblend indicator), `unblend-cycle` (feeling/cycles/parts), `inquiry-questions` (Q&A pairs), `meeting-dialogue` (space, parts, opening, messages preview).

**Fix 5 — Clear incomplete session:** `×` dismiss button added next to "Resume last session" in `technique-detail.tsx`. Shows confirmation alert, deletes from `practice_sessions`, clears state.

**Fix 6 — Inline part save:** `PartSelectStep` in `technique-session.tsx` now manages its own `newPartName` state. "Save Part" button inserts into `parts` + `part_profiles` tables, auto-selects the new part, shows 2-second confirmation. No navigation away from session.

**Fix 7 — Immediate state update:** `setParts` passed via `onPartSaved` callback so `parts` state updates instantly after inline save.

**TypeScript:** Zero errors across all modified files.

---

## Session: 2026-04-03 (Technique Flow Improvements — Clinical Rebuilds)

**Goal:** Rebuild the inner session flows for Parts Mindfulness, Unblending, Feel Towards, Inquiry, and The Meeting Space.

### Architecture additions

- **New step types:** `experience-log`, `unblend-cycle`, `inquiry-questions`, `meeting-space-setup`, `meeting-rules`, `meeting-dialogue`
- **New shared constants:** `FEEL_TOWARDS_SELF_QUALITIES`, `FEEL_TOWARDS_REACTIVE`, `INQUIRY_QUESTIONS`, `INQUIRY_FIXED_QUESTION_INDICES` in `techniques-data.ts`
- **New interface fields:** `unblending_mode?: boolean`, `multi_select?: boolean` on `TechniqueStep`

### New components

- `components/ui/UnblendSupportCard.tsx` — shown when reactive part detected; guides user to create inner space
- `components/ui/ExperienceLogEntry.tsx` — single log entry card with category badge, optional description, long-press delete, unblended indicator
- `components/ui/ExperienceLogStep.tsx` — running log of inner experiences; + FAB opens category modal; Done button advances; unblending_mode triggers UnblendSupportCard after each entry
- `components/ui/UnblendCycleStep.tsx` — stateful loop: feel-towards chips → identify-part → unblend-support → check-again; exits when Self-energy confirmed
- `components/ui/InquiryQuestionsStep.tsx` — 3 fixed questions → picker → asking; floating Unblend button throughout
- `components/ui/MeetingSpaceSetupStep.tsx` — 5 space options incl. non-visual; optional description
- `components/ui/MeetingRulesStep.tsx` — 6 meeting agreements display
- `components/ui/MeetingDialogueStep.tsx` — full dialogue canvas: 3 opening prompts → free dialogue with speaker chips, message bubbles, Rules/Unblend/Reframe support buttons, Close meeting header action

### Technique step updates

- **Parts Mindfulness:** replaced `parts-log` input with `experience-log` step
- **Unblending:** replaced multi-step flow with `before` → `experience-log` (unblending_mode) → `after`
- **Feel Towards:** replaced chip-select loop with `part-select` → `unblend-cycle` → `after`
- **Inquiry:** replaced manual Q steps with `part-select` → `arrive` → `unblend-cycle` → `inquiry-questions` → `after`
- **Meeting Space:** full rebuild: `arrive` → `part-select` (multi_select) → `meeting-space-setup` → `unblend-cycle` → `meeting-rules` → `meeting-dialogue` → `after`

### technique-session.tsx changes

- Added `selectedPartIds: string[]` state for multi-select
- Added `handleTogglePart` for multi-select part-select steps
- Added `getTargetPartName()` helper using selectedPartId/newPartText
- Added `[part]` substitution in all step headings/bodies
- Added `handleComplexStepAdvance(stepId, data)` — saves step data and advances
- Self-managing step types bypass the standard ScrollView+footer and render full-screen components
- Ground button hidden only during meeting-dialogue canvas (has its own support buttons)
- `selectedPartIds` saved to `notes_json` on session save

### DB changes

None — all new data stored in `notes_json` blobs within existing `practice_sessions` table.

---

## Session: 2026-04-03 (Dashboard Cleanup + Techniques Fixes)

**Goal:** Clean up dashboard quick actions, improve My Parts Add Part button, fix 6 Techniques issues.

### Part A — Dashboard

- **A1** Removed "Add Part" button from dashboard quick action grid
- **A2** Removed "Breathing Timer" button from dashboard quick action grid
- **A3** Replaced floating FAB in My Parts with full-width pinned "Add Part" button (Ionicons + label, #3B5BA5, position absolute bottom)
- **A4** Redesigned remaining 9 dashboard cards into 3-column outlined grid (white bg, colored border + icon per card, min 80px height)

### Part B — Techniques Fixes

- **B1** Sessions now record actual start time (`sessionStartRef`) and save `actual_duration_seconds` to `notes_json` and `duration_minutes` column. Log displays "Time spent: X min Y sec" instead of suggested time.
- **B2** Back arrow in session goes to previous step (not quit modal). Step 0 back shows quit Alert. Added "Quit" text button in header top-right. Quit saves `status: "incomplete"` to `notes_json`.
- **B3** Part Profile activity log technique tap navigates to `/technique-log?sessionId=[id]`. Technique-log auto-expands and scrolls to matching session card.
- **B4** Technique-detail queries for incomplete sessions on focus; shows "Resume last session" secondary button with saved timestamp. Session screen accepts `resumeId` param, restores step responses + chip selections + step index, and UPDATEs the existing row instead of INSERTing on save.
- **B5** RFB technique timer step shows breathing rate slider (4.0–7.0s, step 0.1, default 5.0). `BreathingCircle` animation speed responds to slider in real time. Rate saved to `notes_json.rfb_breathing_rate`. RFB session cards in log show "Rate: X.Xs".

### TypeScript: zero new errors ✓

---

## Session: 2026-03-27 (Techniques Redesign)

**Goal:** Redesign Techniques feature as a 6-week IFS therapy adjunct program.

### What was built

- **`lib/techniques-data.ts`** — Completely rewritten. New `Technique` and `TechniqueStep` interfaces. 6 techniques (rfb, parts-mindfulness, unblending, feel-towards, inquiry, meeting-space), each with week number, category, tutorial_text, framing_title/body, before/after prompts, and typed steps array. `getTechniqueById` + `getTechnique` (alias) exports. `TECHNIQUE_CATEGORIES` export for grouped rendering.

- **`app/techniques.tsx`** — Redesigned library screen. 3 category sections (SOMATIC FOUNDATION / AWARENESS PRACTICES / RELATIONAL PRACTICES) with section headers. Card shows week badge, title, subtitle, duration. "Practice Log" secondary button pinned to bottom, navigates to `/technique-log`. Switched from Pressable to TouchableOpacity throughout.

- **`app/technique-detail.tsx`** — Rebuilt: collapsible tutorial (tap to expand), framing section (large heading + body), week pill + duration. "Begin Practice" button pinned to bottom passes `partId` param if present. Removed old part-selector, steps preview, and about/when-to-use sections.

- **`app/technique-session.tsx`** — Fully rebuilt. Dynamic step rendering for 5 step types: `instruction`, `timer` (breathing circle), `input` (multiline text), `chip-select` (multi-select pills, gold when selected), `part-select` (DB parts list + new part text input). Step dots row (past/current/future). Ground button (shield) for weeks 3–6 with GroundingOverlay (3× breathing animation). Inline completion screen after last step. Saves to `practice_sessions` with full `notes_json`. Exit alert on back press.

- **`app/technique-log.tsx`** (new) — Practice log screen. Horizontal week filter pills. Weekly compliance strip (7 day dots, filled = practiced, 5/7 target). FlatList of session cards with collapsible step responses. Empty state. Queries `practice_sessions` LEFT JOIN `parts`.

- **`app/_layout.tsx`** — Registered `technique-log` route.

- **`app/part-profile.tsx`** — Fixed `display_name` → `title` references after Technique interface rename.

### DB changes
None — `notes_json` and `part_id` columns already present in existing migrations.

### TypeScript
`npx tsc --noEmit` — zero errors.

---

## Session: 2026-03-25 (Cycles Feature)

**Goal:** Implement full Cycles feature — activation history chart, update-saved confirmation screen, log-update improvements, dashboard mini widget, part profile mini chart.

### What was built

**DB (Part 1)**
- Added `cycle_annotations` table via `runMigrations()` newTables array in `lib/database.ts`

**Cycles Chart Screen (Parts 2–5) — `app/cycles.tsx`**
- Pure RN Views chart (no SVG, no Skia) — rotated Views for diagonal line segments
- Time range chips: 7D / 30D / 90D / 6M / All (default 30D, gold selected state)
- Part filter: horizontal scrollable chips with type-color avatar circles
- Dark canvas (#1A1917), Y-axis 0–5 labels, horizontal gridlines, X-axis date labels
- Data lines per part (type color), filled dots (intensity set) vs outlined dots (null)
- Tap dot → tooltip (part name, date, activation type, intensity, notes preview)
- Alliance relationship lines (blue 70% opacity), polarization side lines (A/B colors)
- Annotation bands (color fill at 15% opacity + label) or vertical line for point-in-time
- Legend row below chart
- "Add Context" button + annotation modal (label, dates, 6 color chips, notes)
- Annotations list with long-press delete confirmation
- Empty state: chart icon + message + "Log an Update" button → /log-update
- ?partId= query param pre-filters to specific part
- useFocusEffect reloads on focus and time range change

**Update Saved Screen (Part 6) — `app/update-saved.tsx`**
- Animated spring checkmark (scale 0→1)
- Part name + type-colored pill
- Activation type + intensity display
- "View Cycles" (gold) + "Back to Atlas" (light) buttons
- Optional third button "Continue to Trailhead/Elaboration" when exploreOption set
- 5-second countdown auto-navigate with clearInterval on unmount

**Log Update Modifications (Part 6) — `app/log-update.tsx`**
- Intensity section moved immediately after activation type (before "What happened?")
- Label changed: "How activated? (optional but helpful for tracking cycles)"
- Hint added: "Intensity ratings build your Cycles map over time"
- Dots enlarged: 32px (was 28px)
- After save: navigates to /update-saved with params instead of router.back()

**Dashboard Mini Widget (Part 7) — `app/(tabs)/index.tsx`**
- "Cycles" card added to ReturningState grid (after Updates)
- Mini cycles preview widget: dark canvas 100px, last 7 days, top 3 most-recently-active parts
- Only shown when >= 2 updates in last 7 days
- Tap widget → router.push('/cycles')

**Part Profile Cycles Section (Part 8) — `app/part-profile.tsx`**
- State: partCycleUpdates, cyclesChartWidth
- useFocusEffect queries last 30 days updates for this part
- "Activation History" section in Zone 3 (before Activity Log), only when >= 1 update
- 140px dark mini chart using part's type color
- "View all →" pressable → /cycles?partId=

**Routes — `app/_layout.tsx`**
- cycles + update-saved screens registered

**TypeScript:** Zero errors (`npx tsc --noEmit` passes cleanly)

### Files modified/created
- `lib/database.ts` — cycle_annotations table
- `app/cycles.tsx` — NEW
- `app/update-saved.tsx` — NEW
- `app/log-update.tsx` — intensity reorder, labels, dots, navigation
- `app/(tabs)/index.tsx` — Cycles card + mini widget
- `app/part-profile.tsx` — Cycles section
- `app/_layout.tsx` — route registrations
- `task_plan.md` — Cycles phase checklist added
- `progress.md` — this entry

---

## Session: 2026-03-23 (State Reconciliation)

**Goal:** Update all session files to reflect current build state.

### Phase completion summary (as of 2026-03-23)

**Phase 0 — COMPLETE**
- Monorepo scaffold, Expo managed workflow, app.json, all dependencies
- NativeWind v4 config, Expo Router navigation shell, tab bar
- Database service (SQLCipher, 15 tables), root layout DB init
- Dashboard empty state, map placeholder

**Phase 1 — COMPLETE**
- First Mapping Assessment (all 3 phases: The Moment, Clusters A–D + Naming Moments, Connections + Three-Screen Reveal)
- Parts Map Fog of War (pure RN implementation, shadowed nodes, bottom-sheet tap detail)
- Two-state Dashboard (first-time + returning)
- Manual Add Part screen (guided form, 5 profile fields, schema migration)
- Parts Inventory screen (my-parts.tsx)
- Part Profile screen (3-zone view + action buttons)
- Assessment decoupled from onboarding

**Phase 2 — COMPLETE (pending device verification of 3 items)**
- Inner Dialogue (multi-party): start/session/review
- Techniques Library: browsable library + timed session
- Breathing Timer: standalone
- Update Logger
- Trailhead: entry, session, review, ground button, exile discovery, DB save, Part Profile Trailhead History + Activity Log
- Elaboration v2: menu-driven explorer hub, 4 descriptor sections (word chips + tag input), 8 guided explorations (freetext + tags + memories), part_memories table, ground button for exile memories, Part Profile Descriptors + Memories sections
- Relationships Layer 1: polarizations + alliances data model (3 new tables), list screen, 3-step creation wizard, inline-editable profile, member management, Part Profile Relationships section, dashboard card, dialogue-start/dialogue relationshipId support
- Refine Part: full redesign (4 sections, clear buttons, cascade delete)

**Pending device verification:**
- Refine tabbed sections fix
- Elaboration menu status badges
- Descriptor explorer Save button

### Files updated this session
- `CLAUDE.md` — Current Build Phase section updated to reflect Phase 0+1 complete, Phase 2 nearly complete
- `task_plan.md` — Phase 2 items marked complete; Phase 2 Remaining, Phase 2.5, Phase 3 (Assessment Redesign + Additional Features), Phase 4 (Polish), and Deferred sections added
- `findings.md` — Added: expo-router v6 Windows downgrade fix, pinned bottom button definitive pattern, newArchEnabled: false note

---

## Session: 2026-03-21f (Relationships Layer 1)

**Goal:** Build Relationships data model, profile screens, and relationship dialogue for Polarizations and Alliances.

### What was built this session

**DB migrations (database.ts):**
- New tables: `relationships`, `relationship_members`, `polarization_details`
- `part_relationships`: added `relationship_id TEXT` column
- `inner_dialogues`: added `relationship_id TEXT` column

**New screens (5 files):**
- `app/relationships.tsx` — List screen with Polarizations + Alliances sections. Auto-creates relationship entries from existing orphaned `part_relationships` rows on first load. "New Relationship" button pinned to bottom.
- `app/new-relationship.tsx` — 3-step wizard: type selection → name → members (Side A/B for polarization; flat list for alliance). Inserts into all three tables on create.
- `app/relationship-profile.tsx` — Full profile. Inline name editing + all section fields editable on tap/blur with auto-save. Polarization shows: sides, wants/fears per side, costs, history, mediation, progress. Alliance shows: members, function, protection, history. Activity log shows linked dialogues with Start Dialogue button.
- `app/relationship-members.tsx` — Add/remove parts, A/B side assignment for polarizations, Done button.

**Existing screen updates:**
- `app/part-profile.tsx`: Added `RelationshipMembershipRow` type, relationships query in useFocusEffect, Relationships section (cards with type pill + role) in Zone 3 above Activity Log.
- `app/(tabs)/index.tsx`: Added "Relationships" card (git-compare icon) to dashboard feature grid.
- `app/dialogue-start.tsx`: Added `relationshipId` param support — loads relationship member part_ids as pre-selected participants, stores `relationship_id` on the new inner_dialogue row, shows relationship name in header.
- `app/dialogue.tsx`: Added `relationshipId` param support — filters dialogues by `relationship_id`, shows relationship name in header.
- `app/_layout.tsx`: Registered 4 new routes — relationships, new-relationship, relationship-profile, relationship-members.

### TypeScript
Zero errors (`npx tsc --noEmit` clean).

---

## Session: 2026-03-22b (Elaboration + Refine Enhancements)

**Goal:** Four polish changes — guided exploration Save button, tag-style custom input, floating shield ground button, and full Refine screen redesign.

### What was built this session

**DB migrations (database.ts):**
- `part_profiles` 8 new tag columns: `voice_phrases_tags`, `desires_tags`, `behavioral_patterns_tags`, `memories_tags`, `world_perspective_tags`, `fears_tags`, `strengths_tags`, `weaknesses_tags` (JSON arrays, one per guided exploration type)

**`app/guided-exploration.tsx` (3 changes):**
- **Save button** — pinned absolute footer bar; `handleSave()` writes all fields + tags, then `router.back()`. Auto-save on blur retained.
- **Tag input** — single-line text + Add button (or Return key) above the free-write field. Tags display as type-colored removable chips. Saves to `[explorationId]_tags` column in `part_profiles`.
- **Floating shield ground button** — replaced pill with floating circular shield (56×56, `#6B6860`, bottom-right at `bottom:100`). Full `GroundingOverlay` component (dark overlay, animated breathing circle 5s in/out × 3, "Feel your feet on the floor", "Notice three things you can see right now", return / end-and-save buttons). Exile memories only.

**`app/descriptor-explorer.tsx` (Change 2):**
- Replaced multiline custom text input with tag input system. Tags stored as `custom_tags: string[]` in `elaboration_data_json[sectionId]`. Load migration: if legacy `custom` string present and no `custom_tags`, converts to single-item array. Type-colored removable chips (0.15 opacity background).

**`app/refine-part.tsx` (Change 4 — full redesign):**
- Header renamed "Edit [part name]".
- Four sections: Identity (name + type with Unknown added), Core Profile (11 fields), Extended Fields (5 fields), Danger Zone.
- Every field has a `Clear` button — confirms via `Alert.alert` before clearing.
- `Delete This Part` — outlined red button, two-step Alert confirmation, cascades: `part_profiles`, `part_memories`, `part_relationships`, `relationship_members`, `elaboration_sessions`, `updates`, `trailheads (exile_id)`, then `parts`. Routes to `/my-parts` on confirm.
- "Changes update everywhere in your atlas" footer note.

### TypeScript
Zero errors — `npx tsc --noEmit` clean.

---

## Session: 2026-03-22 (Elaboration v2 — Menu-Driven Explorer)

**Goal:** Replace linear elaboration session with a menu-driven explorer hub.

### What was built this session

**New content file:**
- `lib/elaboration-descriptors.ts` — 4 descriptor sections (Emotions & Feelings, Personality Qualities, Attitude & Disposition, Appearance) with 40+ categories and hundreds of clinically-informed IFS words. Typed TypeScript constants.

**DB migrations (database.ts):**
- `part_profiles` new columns: `voice_phrases`, `desires`, `behavioral_patterns`, `strengths`, `weaknesses`, `elaboration_data_json`
- New table: `part_memories` (id, part_id, title, content, memory_date, created_at, updated_at)

**New screens (3 files):**
- `app/elaboration-menu.tsx` — Hub screen. Section A: 4 descriptor explorer cards with selection count + progress bar. Section B: 8 guided exploration cards with in-progress status detection.
- `app/descriptor-explorer.tsx` — Word chip selection UI. Custom text input (auto-save on blur), search bar (filters all categories simultaneously), collapsible category sections (first 3 expanded by default), part-type-colored selected chips, sticky summary bar.
- `app/guided-exploration.tsx` — Freetext exploration for 8 topics (voice, desires, behavioral patterns, memories, world perspective, fears, strengths, weaknesses). Auto-save on blur. Ground button shown on memories exploration for exile parts. Memories exploration includes free write + 3 guided reflection prompts, each saving as separate part_memories rows.

**Updated screens:**
- `app/elaborate.tsx` — "Begin Elaboration" now routes to `/elaboration-menu`. Description text updated.
- `app/part-profile.tsx` — Elaboration Notes section (voice, desires, behavioral patterns, strengths, weaknesses); Descriptors section (type-colored chips from elaboration_data_json); Memories section (expandable cards + Add Memory modal); activity log elaboration tap → /elaboration-menu; new styles.
- `app/refine-part.tsx` — Added 5 new fields throughout (PROFILE_FIELDS, interface, state, DB load/save).
- `app/_layout.tsx` — Registered 3 new routes: elaboration-menu, descriptor-explorer, guided-exploration.

### TypeScript
Zero errors — `npx tsc --noEmit` clean.

---

## Session: 2026-03-21e (Elaboration feature)

**Goal:** Build full Elaboration feature — entry, session, review, DB migrations, part profile integration.

### What was built this session

**New screens:**
- `app/elaborate.tsx` — Entry screen. partId-optional selector for all parts (Manager/Firefighter/Exile). Pre-selected display if partId provided. Begin Elaboration button pinned to bottom.
- `app/elaboration-session.tsx` — 11-step guided session. Dark background (warm, contemplative). Ground button for exile parts from step 2 onward. Each step saves field to part_profiles immediately on Continue (upsert). exit confirmation Alert modal. BackHandler for Android hardware back. Previous step navigation via stepHistory stack.
- `app/elaboration-review.tsx` — Read-only review. Shows step label + response for each filled step. Continue Elaboration (in_progress) or Start New Elaboration (completed) pinned to bottom. Back uses router.back() only.

**DB migrations (database.ts):**
- part_profiles: body_location, origin_story, beliefs, relationship_to_self, burdens, gifts
- elaboration_sessions: status TEXT, steps_json TEXT

**part-profile.tsx integration:**
- Elaborate action button wired to `/elaborate?partId=${id}`
- ProfileRow + SQL query extended to include 6 new fields
- PROFILE_FIELDS extended to 11 entries (6 new fields shown if non-empty)
- ElaborationRow type + elaborations state added
- Elaboration History section added (after Trailhead History)
- Activity Log: 'elaboration' type added — layers icon, gold color, step count summary, taps to elaboration-review

**refine-part.tsx integration:**
- 6 new fields added to ProfileFields, PROFILE_FIELDS, load query, save query

**_layout.tsx:** Routes registered — elaborate, elaboration-session, elaboration-review.

### TypeScript
Zero errors (`npx tsc --noEmit` clean).

---

## Session: 2026-03-21d (Back button nav stack fix — trailhead-review)

**Goal:** Fix nav stack accumulation caused by back button using `router.replace()` to part-profile.

### What was built this session

**Root cause:** `trailhead-review.tsx` back button used `router.replace('/part-profile?id=...')`. Since part-profile is already in the stack, this pushed a new copy instead of returning to the existing one.

**Fix applied:**
- `trailhead-review.tsx` back button: `router.replace(...)` → `router.back()`
- Converted back button from `Pressable` → `TouchableOpacity` (consistent with anti-multi-fire pattern)
- Converted exile link from `Pressable` → `TouchableOpacity`
- Removed unused `Pressable` import
- Added definitive navigation rule to `findings.md`

**Audit result — other detail/review screens:**
- `update-detail.tsx` back button: already `router.back()` — correct
- `refine-part.tsx` back button + post-save: already `router.back()` — correct
- `coming-soon.tsx` back button: already `router.back()` — correct

### TypeScript
Zero errors (`npx tsc --noEmit` clean).

---

## Session: 2026-03-21c (Definitive nav stack fix — safeNavigate + TouchableOpacity)

**Goal:** Permanently fix nav stack accumulation from all list screens.

### What was built this session

**Root cause analysis:**
- `part-profile.tsx` had `navigateToItem` defined **inside** `.map()` callback — recreated on every render, defeating any closure-based guard
- All list items in `part-profile.tsx`, `my-parts.tsx`, `explore.tsx`, `updates.tsx`, `dialogue.tsx` used `Pressable` — fires multiple events in Android scroll containers
- Previous `useDebounceNav` hook (time-based 800ms) was insufficient against Pressable's multi-fire

**Fix applied across 5 files:**
- Replaced `useDebounceNav` pattern with `navigatingRef = useRef(false)` + `safeNavigate` (`useCallback`, 1000ms reset)
- Replaced all `Pressable` in scroll-container list items with `TouchableOpacity` (`activeOpacity={0.7}`)
- Moved `navigateToItem` out of `.map()` — now an inline `navTarget` const + `safeNavigate(navTarget)` in `onPress`
- Files changed: `part-profile.tsx`, `my-parts.tsx`, `explore.tsx` (BottomSheet), `updates.tsx` (UpdateCard), `dialogue.tsx`

### TypeScript
Zero errors (`npx tsc --noEmit` clean).

---

## Session: 2026-03-21b (Persistent bug fixes — nav guard + Continue button)

**Goal:** Fix two persistent bugs: nav stack accumulation from part-profile, and Continue Trailhead button not showing.

### What was built this session

**Bug 1 — Nav stack accumulation from part-profile.tsx:**
- Added `useRef` import and `isNavigating = useRef(false)` guard
- Added `navigateTo(path)` helper (500ms cooldown) used by all navigation calls in the file
- Applied to: Trailhead History `onPress`, Activity Log `navigateToItem()`, all `handleAction()` branches
- Root cause: bare `router.push()` calls with no protection against rapid/double taps

**Bug 2 — "Continue Trailhead" button not showing:**
- `trailhead-session.tsx`: Fixed INSERT — `completed_at` was being set to `startedAt` (non-null from creation). Now uses literal `null`.
- `trailhead-review.tsx`: Changed `isComplete` condition from `status === 'complete'` to `status === 'complete' && !!completed_at`. A session is only considered complete when both signals agree — catches legacy rows with null status and rows where `completed_at` was non-null on creation.
- Added `isNavigating` guard to back button, `handleContinue`, and `handleStartNew` in trailhead-review.tsx
- Added `console.log` for status/completed_at diagnostic

### TypeScript
Zero errors (`npx tsc --noEmit` clean).

---

## Session: 2026-03-21 (Navigation bug fixes)

**Goal:** Fix three Trailhead navigation bugs.

### What was built this session

**Bug 1 — Back button goes to previous step (all three session screens):**
- `trailhead-session.tsx`: Added `stepHistory: StepId[]` state. Added `navigateToStep(next)` that pushes current step to history before advancing. Added `handlePrevStep()` that pops history (or shows exit modal at first step). Replaced all `setStepId(x)` calls with `navigateToStep(x)`. Changed back chevron to call `handlePrevStep`. Added `useFocusEffect + BackHandler` to intercept Android hardware back.
- `technique-session.tsx`: `handleBack()` already handled prev-step / exit-modal correctly. Added `useFocusEffect + BackHandler` calling `handleBack()`.
- `dialogue-session.tsx`: Added `useFocusEffect + BackHandler` — intercepts in active mode (calls `handleEndAndSave`), allows exit in read-only mode. Fixed on-screen back button to call `handleEndAndSave` in active mode instead of `router.back()`.

**Bug 2 — Stack accumulation audit:**
- All exit paths in `trailhead-session.tsx` already used `router.replace()` — no changes needed.
- All exit paths in `technique-session.tsx` already used `router.replace()` — no changes needed.
- Documented the pattern in `findings.md`.

**Bug 3 — In-progress trailhead "Continue" button:**
- `trailhead-review.tsx`: Added "Continue Trailhead" button (pinned below ScrollView) when `status !== 'complete'`. Navigates to `/trailhead-session?trailheadId=[id]&partId=[part_id]`. Added "Start New Trailhead with this part" button for completed sessions.
- `trailhead-session.tsx`: Now accepts `trailheadId` param. If provided: uses existing ID as `sessionId`, skips DB insert, loads `steps_json` from DB, pre-fills all step state, and resumes from the last logical step (determined by which fields are populated in `steps_json`).

### Errors encountered
- `BackHandler.removeEventListener` is removed from TypeScript types in modern RN. Fixed by using subscription pattern: `const sub = BackHandler.addEventListener(...); return () => sub.remove();`

### TypeScript
Zero errors (`npx tsc --noEmit` clean).

---

## Session: 2026-03-17 (Phase 0 completion)

**Goal:** Audit project state and complete Phase 0 gaps left by previous session.

### What was already done (previous session)
- Monorepo structure created (apps/mobile, packages/shared, packages/ui)
- Expo app scaffolded with Expo Router, all required plugins in app.json
- All dependencies declared and installed (NativeWind, Skia, SQLite, Zustand, React Query, etc.)
- IFS domain types complete — `packages/shared/src/types/ifs.ts` (279 lines, comprehensive)
- Design system constants complete — `packages/shared/src/types/design-system.ts`
- Comprehensive documentation in place (14 docs + 5 JSON content files)
- app.json properly configured: bundle IDs, Face ID permission, newArchEnabled, all plugins

### What was done this session (Phase 0 completion)
- Created `apps/mobile/babel.config.js` — NativeWind v4 babel plugin (`jsxImportSource: 'nativewind'`) + react-native-worklets plugin for Skia
- Created `apps/mobile/metro.config.js` — `withNativeWind` wrapper pointing to `global.css`
- Created `apps/mobile/tailwind.config.js` — NativeWind preset + Inner Atlas custom color palette
- Created `apps/mobile/global.css` — Tailwind directives
- Created `apps/mobile/lib/database.ts` — Database service: SQLCipher key generation (expo-crypto → expo-secure-store key `db_encryption_key`), `openDatabaseAsync`, PRAGMA key, PRAGMA foreign_keys, all 15 CREATE TABLE statements
- Created `docs/architecture/db-init.sql` — annotated SQL reference copy of schema
- Updated `apps/mobile/app/_layout.tsx` — imports `global.css`, initializes DB on mount, blocks render until DB ready
- Updated `apps/mobile/app/(tabs)/index.tsx` — replaced default Expo template with Inner Atlas dashboard (empty state, NativeWind className)
- Updated `apps/mobile/app/(tabs)/explore.tsx` — replaced default template with Map placeholder
- Updated `apps/mobile/app/(tabs)/_layout.tsx` — Inner Atlas tab colors (manager blue / text-secondary), "Map" tab label, map.fill icon
- Updated `apps/mobile/constants/theme.ts` — tint colors updated to Inner Atlas manager blue / self gold
- Created session memory files (progress.md, task_plan.md, findings.md)

### Errors encountered
None during implementation. Verify on device before marking Phase 0 complete.

### Pending verification
- [ ] `npm run start` (from project root) launches without Metro errors
- [ ] App loads on device/simulator: Inner Atlas dashboard visible, no React errors
- [ ] NativeWind styles render (check bg-background, text-text-primary, etc. are applied)
- [ ] Database initializes on first launch (expo-secure-store key `db_encryption_key` is set)
- [ ] No SQLCipher PRAGMA error in console

### Next step
Phase 1 Step 1.1 — First Mapping Assessment flow. Read `docs/features/ASSESSMENT_REDESIGN.md` before starting.

---

## Session: 2026-03-17 (Phase 1 start — Assessment Phase 1 The Moment)

**Goal:** Build First Mapping Assessment, Phase 1 only (5 questions, backend inference, no results shown).

### What was built this session

- Created `apps/mobile/lib/assessment-inference.ts` — Phase 1 inference engine. Maps p1_q3 (action pattern), p1_q4 (inner critic signal), p1_q5 (frequency multiplier) to `{manager, firefighter, exile, inner_critic}` signals (0–5) + Phase 2 cluster weight multipliers. Output stored in DB only, never shown to user.
- Created `apps/mobile/app/assessment/_layout.tsx` — Stack layout for assessment routes (headerShown: false, full screen, no tab bar).
- Created `apps/mobile/app/assessment/first-mapping.tsx` — Full Phase 1 flow:
  - Intro screen ("The Moment")
  - 5 question screens with fade transitions (opacity animated)
  - 3 input types: `free_text` (multiline TextInput), `single_choice` (pressable option rows), `yes_no_conditional` (horizontal chips + conditional text)
  - `canContinue` validation: required fields block Continue; optional fields (p1_q2) always allow advance
  - On completion: runs inference, writes `assessment_sessions` row to encrypted SQLite (type=first_mapping, status=in_progress, current_phase=phase2, responses_json, inferences_json)
  - Done state shows Phase 1 transition copy + "Return to Atlas" button
- Updated `apps/mobile/app/_layout.tsx` — added `assessment` Stack.Screen
- Updated `apps/mobile/app/(tabs)/index.tsx` — "Begin Mapping" card is now a Pressable that routes to `/assessment/first-mapping`

### Inference logic summary (backend only)
- withdrew/went_numb → exile +2
- acted_out → firefighter +2
- went_busy → firefighter +1, manager +1
- tried_to_fix → manager +3
- inner critic present → inner_critic +2, manager +1
- very_often frequency → ×1.5 multiplier; often → ×1.2
- cluster_weights: clusterA boosted by manager, clusterB by firefighter, clusterD by inner_critic+exile

### Not yet built
- Phase 2 clusters (A–D) + Naming Moment screens
- Phase 3 connections
- Three-screen reveal

### Next step
Phase 1 — Build Phase 2 Cluster A (Standards & Effort): 5 slider/free-text questions + Naming Moment screen.

---

## Session: 2026-03-17 (Phase 2 Cluster A — Standards & Effort)

**Goal:** Build First Mapping Assessment Phase 2 Cluster A complete flow.

### What was built this session

Extended `apps/mobile/app/assessment/first-mapping.tsx` to include Phase 2 Cluster A after Phase 1:

**Step flow added:**
- `p1_done` — Phase 1 → Phase 2 transition screen ("Thank you for sharing that. Now let's look at broader patterns...")
- `cA_intro` — Cluster A intro ("Standards & Effort — the part that holds the bar")
- `{ q: 'A', i: 0–4 }` — 4 slider questions + 1 free text question
- `cA_naming` — Full-screen Naming Moment: description paragraph + protective reframe + two required phrases (verbatim from spec) + bridge text
- `cA_chips` — Name chip selection: 6 chips (functional → evocative → personal) + open text field; either chip or text required to enable Confirm
- `cA_confirm` — Node appears with spring + pulse animation (manager blue rounded rect, white text), micro-capture "How do you feel toward [name] right now?" (stored in assessment_naming_moments.feel_towards, never scored)

**New components:**
- `SliderInput` — 5-step discrete selector with connected track, active fill, selected dot glow
- Phase label switched from gray to `#3B5BA5` manager blue during Cluster A questions

**DB writes:**
- `handlePhase1Complete()` — inserts `assessment_sessions` row (type=first_mapping, phase=phase2, cluster=A)
- `handleClusterAComplete()` — inserts `parts` row (type=manager, backend_classification=Perfectionist/Analyzer/Planner, never shown), inserts `assessment_naming_moments` row, updates `assessment_sessions.responses_json` with full phase1+clusterA responses

**TypeScript:** `tsc --noEmit` passes with zero errors.

### Key decisions
- `name` field on part = chip selected (or CA_CHIPS[0] as fallback) — the "working title" that never changes
- `custom_name` = populated only if user typed their own name in the open field
- `display_name` = COALESCE(custom_name, name) via SQLite computed column — always user's chosen name
- Back navigation works through entire flow; cA_confirm has no back button (part has been named)
- Node animation: spring scale in from 0 → pulse loop (×1.06) to suggest living presence

### Next step
Phase 2 Clusters B, C, D — then Phase 3 Connections — then Three-Screen Reveal.

---

## Session: 2026-03-18 (Phase 2 Clusters B, C, D)

**Goal:** Build Clusters B, C, D in first-mapping.tsx and wire complete flow through to Phase 3 placeholder.

### What was built this session

Extended `apps/mobile/app/assessment/first-mapping.tsx` to include Phase 2 Clusters B, C, D:

**Cluster B — Relief & Escape (Firefighter)**
- Intro screen with no-shame opening (amber `#C2600A` accent, warm italic callout)
- 3 slider questions + 1 single_choice + 1 free_text (optional)
- Safety card step (`cB_safety`) — triggered if `cB_q1 >= 4 OR cB_q2 >= 4` (automatic/compulsive relief pattern); non-judgmental, non-pathologizing, encourages therapy support
- Naming Moment: required phrases from spec verbatim
- Name chips: The Pressure Valve, The Escape Artist, The Relief-Seeker, The Unraveler, The One Who Needs a Break, Riley
- `cB_confirm`: 8-point starburst node (`StarburstNode` — two overlapping squares rotated 45°), amber color
- DB: inserts `parts` row (type=firefighter, backend_classification=Escape Artist/Distractor/Relief-Seeker)

**Cluster C — Connection & Relationships (Manager/relational)**
- Intro, 3 sliders + 1 single_choice + 1 free_text
- Naming Moment + chips: The Accommodator, The Peacekeeper, The Bridge-Builder, The Sentinel, The One Who Holds It Together, Jordan
- `cC_confirm`: Manager rounded-rect node (blue `#3B5BA5`)
- DB: inserts `parts` row (type=manager, backend_classification=Pleaser/Peacemaker/Caretaker)

**Cluster D — The Voice Inside (Manager/inner critic)**
- Intro, 1 slider + 1 single_choice + 2 sliders + 1 free_text — harsh voice framing, non-pathologizing
- Naming Moment + chips: The Critic, The Inner Judge, The Harsh One, The Overseer, The Voice, Sam
- `cD_confirm`: Manager rounded-rect node (blue `#3B5BA5`)
- Exile node placement: if `cD_q3 >= 4 OR cD_q5 >= 4`, inserts row into `shadowed_nodes` (type=exile, label="Unknown — waiting to be known") — SILENT, no naming prompt shown, seeds first cliffhanger
- DB: inserts `parts` row + optionally `shadowed_nodes` row; updates `assessment_sessions.status = 'phase3_ready'`

**Phase 3 placeholder**
- Screen showing all four named parts by chosen name
- "Return to Atlas" button → `/(tabs)`

**Refactors (same file)**
- `ClusterQStep` now covers `q: 'A' | 'B' | 'C' | 'D'`
- Unified cluster question renderer in main render — handles slider/single_choice/free_text for all clusters
- `SliderInput` now accepts `color` prop (amber for B, blue for others)
- `SingleChoiceInput` now accepts `accentColor`/`accentLight` props
- `StarburstNode` component (8-point starburst via two overlapping 45°-rotated squares)
- `ManagerNode` component (rounded-rect, parameterized color)
- Naming screens factored into `renderChipsScreen()` and `renderConfirmScreen()` helpers to reduce duplication
- Back navigation disabled at cluster boundaries (can't go back past a confirmed naming)
- Progress bar uses amber for Cluster B questions

**TypeScript:** `tsc --noEmit` passes with zero errors.

### Flow wired
`intro → P1 questions → p1_done → cA_intro → cA questions → cA_naming → cA_chips → cA_confirm
→ cB_intro → cB questions → [cB_safety?] → cB_naming → cB_chips → cB_confirm
→ cC_intro → cC questions → cC_naming → cC_chips → cC_confirm
→ cD_intro → cD questions → cD_naming → cD_chips → cD_confirm
→ phase3_placeholder → Return to Atlas`

### Next step
Phase 3 Connections — dynamic questions using named parts — then Three-Screen Reveal.

---

## Session: 2026-03-18 (Phase 3 — The Connections + Three-Screen Reveal)

**Goal:** Build Phase 3 of the First Mapping Assessment — dynamic relationship questions, 8 C's self-energy baseline, and Three-Screen Reveal.

### What was built this session

Extended `apps/mobile/app/assessment/first-mapping.tsx` to include Phase 3 and the Three-Screen Reveal:

**Phase 3 — The Connections (step flow):**
- `p3_intro` — transition screen: "You've met four parts. Before we show you what this looks like, a couple of questions about how they relate."
- `p3_q1` — slider: dynamic template "[nameA] and [nameB] — do they ever seem to be responding to the same thing?" (min: not really / max: yes, same system)
- `p3_q2` — slider: dynamic template "Does [nameA] ever seem to react to [nameB]? Like one of them triggers or activates the other?" (min: not that I notice / max: yes, there's a cycle)
- `p3_q3` — free text (optional): "When you think about [nameA], [nameB], and [nameC] all together — how do you feel toward them as a group?" (self-access baseline)
- `p3_self_energy` — standalone full-screen: 8 C's check-in (curious, calm, compassionate, confident, creative, courageous, connected, clear); yes/no toggle tiles; gold accent; "See my map" button

**Part relationship inference:**
- If p3_q1 >= 3 OR p3_q2 >= 3: inserts row into `part_relationships` (between Cluster A manager and Cluster B firefighter)
- `relationship_type` = 'polarized' if p3_q2 >= 3, else 'protective'
- `strength` = `min(10, round((q1 + q2) * 1.2))`

**Self-energy baseline DB write:**
- `self_energy_checkins`: check_type='full', overall_percentage=0, eight_cs_json={each C: 1 or 7}, notes=p3_q3 text
- Session updated: status='complete', current_phase='phase3', completed_at set

**Three-Screen Reveal (step flow):**
- `reveal_1` — "This is your system. As much of it as we can see from here." All four named nodes animating in (spring + pulse) in a 2×2 grid. Shows ManagerNode (A), StarburstNode (B), ManagerNode (C), ManagerNode (D).
- `reveal_2` — "They're not fighting each other. They're protecting the same thing." Protective relationship highlighted: nameA → nameB with connecting line and description.
- `reveal_3` — "What happened that made these connections necessary? That question is worth following." If exile signal triggered (cD_q3 >= 4 or cD_q5 >= 4): pulsing shadowed exile node (dashed violet circle, foggy glow) with "Something is here. It's waiting to be known." Quote card. "Explore the fog" → `router.replace('/(tabs)')`.

**Step type changes:**
- Removed `phase3_placeholder`
- Added: `p3_intro | p3_q1 | p3_q2 | p3_q3 | p3_self_energy | reveal_1 | reveal_2 | reveal_3`

**Progress tracking:**
- Phase 3 question steps (p3_q1/2/3) show progress bar labeled "The Connections" in Self gold (#B88A00), steps 1–3

**New state vars:**
- `p3Responses: { p3_q1: number; p3_q2: number; p3_q3: string }`
- `eightCs: { curious, calm, compassionate, confident, creative, courageous, connected, clear }` (boolean toggles)

**TypeScript:** `tsc --noEmit` passes with zero errors.

### Full flow wired (complete Phase 2 + 3)
```
intro → P1 questions → p1_done → cA_intro → cA questions → cA_naming → cA_chips → cA_confirm
→ cB_intro → cB questions → [cB_safety?] → cB_naming → cB_chips → cB_confirm
→ cC_intro → cC questions → cC_naming → cC_chips → cC_confirm
→ cD_intro → cD questions → cD_naming → cD_chips → cD_confirm
→ p3_intro → p3_q1 → p3_q2 → p3_q3 → p3_self_energy
→ reveal_1 → reveal_2 → reveal_3 → Return to Atlas
```

### Next step
Phase 4 — Parts Map canvas (Skia), Elaboration screens, or Mini-Assessment library.

---

## Session: 2026-03-19 (Parts Map — Fog of War Canvas)

**Goal:** Build the Parts Map canvas screen with Skia fog-of-war rendering.

### What was built this session

**`apps/mobile/app/(tabs)/explore.tsx`** — Full Parts Map screen (replaced placeholder):
- Hybrid architecture: Skia Canvas for atmosphere/fog/effects, RN Pressables for interactive nodes
- **Skia Canvas (absoluteFill):**
  - Dark background (#1A1917)
  - Glow halos: translucent type-colored circles behind each named node
  - Shadowed nodes: low-opacity blurred circles (exile=0.55, others=0.38 opacity), drawn via `BlurMask`
  - Dual fog gradients:
    - Horizontal: transparent left → dense right (starts at 32% width, peaks at 82% opacity)
    - Vertical: transparent top → dark bottom (starts at 44% height, peaks at 58% opacity)
    - Combined covers ~60-70% of canvas; shadowed nodes visible but obscured beneath fog
- **Named node Pressables (above canvas, fog-free):**
  - Manager: rounded rect (80×48px, 12px radius, #3B5BA5)
  - Firefighter: two overlapping squares rotated 45° (72px, #C2600A)
  - Exile: circle (64px diameter, #7C3D9B)
  - Self: large rounded rect (96px, 8px radius, #B88A00) — approximates octagon
  - Each with drop shadow (shadowColor = type color)
- **Quadrant layout (auto; uses stored position_x/y if set):**
  - Managers → upper-left (2-column grid, 140px spacing)
  - Firefighters → lower-right (~65% x, ~64% y)
  - Exiles → lower-left (~73% y)
  - Self → canvas center
  - Shadowed nodes → right ~70% x, mid ~50% y
- **Empty state:** shown if 0 parts + 0 shadowed nodes; links to First Mapping assessment
- **Bottom sheet (on named node tap):**
  - Spring slide-up animation (tension:80, friction:12)
  - Shows display_name (large), type label pill (type color), "View Profile" button, "Close" button
  - Backdrop Pressable dismisses on outside tap
  - Tap on shadowed node → nothing (not wired)
- **Bottom bar:** parts count + "Your system is larger than this map" sub-label (if shadowed nodes exist)
- **"Explore the fog" button:** floating at bottom, navigates to `/fog-explore`
- **DB query:** uses `COALESCE(custom_name, name) AS display_name` to avoid reliance on VIRTUAL column

**`apps/mobile/app/fog-explore.tsx`** — Placeholder screen for mini-assessment library:
- Lists all 6 planned mini-assessments with "Coming soon" badge
- Back button → `router.back()`

**`apps/mobile/app/_layout.tsx`** — Added `fog-explore` Stack.Screen (headerShown: false)

**`.expo/types/router.d.ts`** — Added `/fog-explore` to Expo Router's typed route declarations

**TypeScript:** `tsc --noEmit` passes with zero errors.

### Architecture notes
- Shadowed nodes are drawn in Skia (before fog) so the fog overlay naturally obscures them
- Named node Pressables are RN views (always above Canvas in z-order) so they appear fog-free
- Pulsing animation on shadowed nodes deferred — requires Reanimated shared values in Skia
- Self octagon approximated as large rounded rect; true Skia Path octagon deferred

### Next step
Elaboration screens (Part Profile view), or Mini-Assessment Library build-out.

---

## Session: 2026-03-19 (Part Profile — Full 6-Tab Screen)

**Goal:** Replace part-profile.tsx placeholder with full Part Profile screen.

### What was built this session

**`apps/mobile/app/part-profile.tsx`** — Full 6-tab Part Profile screen (replaced placeholder):

**Header + Identity:**
- Back button → `router.back()` (← Map)
- `display_name` as large 28px heading (COALESCE(custom_name, name))
- Type pill with part-type color (Manager/Firefighter/Exile/Self)
- Horizontal scrollable tab bar, active tab underlined with part-type color

**Tab 1 — Overview:**
- "First encountered [date]" label
- "How do you feel toward [name] right now?" — multiline TextInput, auto-saves to `part_profiles.feel_towards` on blur
- "What you know about this part so far" — multiline TextInput, auto-saves to `part_profiles.custom_attributes_json` as `{notes: string}` on blur (no standalone notes column in schema)
- Relationship summary: lists `part_relationships` rows involving this part with connected part name + type-colored relationship label pill

**Tab 2 — Dialogue:**
- Placeholder banner + lists existing `inner_dialogues` rows (LIKE query on participants_json)
- "Start Dialogue" button (disabled placeholder, Phase 2)

**Tab 3 — Trailhead:**
- Placeholder banner + "Begin Trailhead" button (disabled placeholder, Phase 2)

**Tab 4 — Elaboration:**
- Placeholder banner + "Begin Elaboration" button (disabled placeholder, Phase 2)

**Tab 5 — Refine:**
- Editable `custom_name` TextInput pre-populated with current custom_name or name
- Helper text: "Renaming updates everywhere in your atlas."
- Explicit "Save Name" button → writes to `parts.custom_name`, updates `display_name` state

**Tab 6 — Updates:**
- Placeholder banner + lists existing `updates` rows for this part
- "Log Update" button (disabled placeholder, Phase 2)

**Save behavior:**
- feel_towards + notes: `onBlur` → upsert `part_profiles` via INSERT ... ON CONFLICT DO UPDATE
- custom_name: explicit button → UPDATE `parts`
- KeyboardAvoidingView (ios: 'padding') wraps entire screen

**TypeScript:** `tsc --noEmit` passes with zero errors.

### Architecture notes
- Notes stored as `custom_attributes_json.notes` (no standalone notes column in part_profiles)
- Relationship query passes `id` three times: once for the CASE expression, twice for the WHERE clause
- Dialogue query uses LIKE on participants_json (simple; full-text search deferred)
- Sub-components (PlaceholderBanner, ActionButton, ListRow) defined after export default — referenced via module-level styles, safe since all module-level code executes before render

### Next step
Mini-Assessment Library build-out, or Fog Explore screen detail.

---

## Session: 2026-03-19 (Assessment restructure — dashboard + Add Part)

**Goal:** Schema migration, decouple assessment from onboarding, build two-state dashboard, build manual Add Part screen.

### What was built this session

**Task 1 — Schema migration (`apps/mobile/lib/database.ts`):**
- Added 5 new columns to `part_profiles` CREATE TABLE: `appearance TEXT`, `job TEXT`, `key_trigger TEXT`, `key_identifier TEXT`, `fears TEXT`
- Added `runMigrations()` function: safely ALTERs existing DBs via try/catch (SQLite has no ADD COLUMN IF NOT EXISTS)
- `runMigrations()` called from `initDatabase()` after CREATE TABLE

**Task 2 — Assessment decoupled from onboarding:**
- Removed "Begin Mapping" hard-wire from `index.tsx`
- Assessment route `/assessment/first-mapping` still exists, now entered from dashboard cards

**Task 3 — Two-state dashboard (`apps/mobile/app/(tabs)/index.tsx`):**
- Full rewrite; state determined by `COUNT(*) FROM parts` on `useFocusEffect`
- **First-time state** (0 parts): app name centered, subtitle, two equal cards — "Explore Your System" → assessment, "Add a Part" → `/add-part`
- **Returning state** (parts exist): header with settings icon, 2-column feature card grid (8 cards: Add Part, Parts Map, Dialogue, Trailhead, Elaborate, Techniques, Updates, Take Assessment), backup reminder in amber if `last_backup_at` in SecureStore is null or > 30 days old
- Card grid uses white cards with subtle shadow on `#FAFAF8` background (glassmorphism values preserved in code)
- Dev seed button preserved in both states

**Task 4 — Manual Add Part screen (`apps/mobile/app/add-part.tsx`):**
- 6 form fields: Name* (required), Appearance, Job, Key Trigger, Key Identifier, Fears
- Part type selector: Manager / Firefighter / Exile chips (none = default, maps to manager in DB)
- Save: "Add to My Atlas" — inserts `parts` row + `part_profiles` row, navigates to map tab
- Back: confirms discard if any field has content (Alert)
- Wired into `_layout.tsx` (Stack.Screen) and `router.d.ts`

**TypeScript:** `tsc --noEmit` passes with zero errors.

### Next step
Build Part Profile detail screen or Mini-Assessment Library build-out.

---

## Session: 2026-03-19 (Part Profile fields + My Parts screen)

**Goal:** Two fixes after Add Part restructure — surface 5 new profile fields, build My Parts list screen.

### FIX 1 — Part Profile new fields (part-profile.tsx)

- Added `ExtraField` type + `EXTRA_FIELD_SQL` map + `EXTRA_FIELD_LABELS` at module level (outside component)
- Added 5 new state vars: `appearance`, `job`, `keyTrigger`, `keyIdentifier`, `fears`
- Updated profile query to SELECT all 7 part_profile fields in one query
- Added `saveField(field, value)` useCallback — type-safe upsert per column, no string interpolation of values
- **Overview tab:** 5 new fields rendered below Relationships section — small uppercase `fieldLabel` style, TextInput with "Not yet added — tap to edit" placeholder, auto-saves on blur
- **Refine tab:** Same 5 fields rendered as editable TextInputs below the Save Name button, auto-saves on blur

### FIX 2 — My Parts screen (my-parts.tsx)

- Created `apps/mobile/app/my-parts.tsx` — scrollable part list with:
  - JOIN query: `parts LEFT JOIN part_profiles` for display_name, type, job, appearance in one query
  - Cards: large display_name, type pill (design system colors), one-line preview (job → appearance → "Tap to explore")
  - Header: "My Parts" + count badge ("N parts")
  - Empty state: icon + "No parts added yet" + "Add a Part" button → `/add-part`
  - Floating "+" FAB (bottom-right) → `/add-part`
  - Tap card → `/part-profile?id=<id>`
  - Refreshes on focus via `useFocusEffect`

### Dashboard updates (index.tsx)

- Added "My Parts" card (first position, `people-outline` icon) → `/my-parts`
- Reordered: My Parts, Add Part, Parts Map, Dialogue, Trailhead, Elaborate, Techniques, Updates, Assessment
- 9-card grid: last card (Assessment) renders full-width (`glassCardFull` style) when `cards.length % 2 !== 0`

### Wiring

- `_layout.tsx`: added `my-parts` Stack.Screen (headerShown: false)
- `router.d.ts`: added `/my-parts` to all three union types

**TypeScript:** `tsc --noEmit` passes with zero errors.

### Next step
Mini-Assessment Library, Elaboration screens, or Fog Explore detail.

---

## Session: 2026-03-19 (Part Profile Redesign — 3-Zone View + Launch-Pad)

**Goal:** Replace 6-tab Part Profile with a cleaner view-and-launch-pad model.

### What was built this session

**`apps/mobile/app/part-profile.tsx`** — Full rewrite (3-zone single scrollable screen):

- **Zone 1 — Image Header (220px + safe area):** Type-color solid background with dark vignette overlay (faux gradient). Large semi-transparent initials centered as decorative element. display_name overlaid at bottom in white text with soft shadow. Type pill (white/20% opacity bg, white text) below name. Back button floats top-left with safe-area-aware padding.
- **Zone 2 — Action Buttons:** 5 cards in a horizontal flex row (Dialogue, Trailhead, Elaborate, Refine, Updates). Each card: icon above label, white bg, 12px radius, subtle shadow, flex:1 distribution. Icon color = part type color. Dialogue/Trailhead/Elaborate/Updates → `/coming-soon?feature=<name>`. Refine → `/refine-part?id=<id>`.
- **Zone 3 — Profile Info (read-only):** "About This Part" section header. Each of the 5 profile fields shown only if non-empty as a card (rgba(255,255,255,0.6) bg, 12px radius, uppercase label + value). If all fields empty: single italic prompt directing user to Refine.

**`apps/mobile/app/refine-part.tsx`** — New screen extracted from old Refine tab:
- Header: "Refine [part name]" + back button
- Name TextInput (auto-saves on blur → `parts.custom_name`)
- Type chip selector: Manager / Firefighter / Exile (saves on tap → `parts.type`)
- 5 profile field TextInputs with auto-save on blur (appearance, job, key_trigger, key_identifier, fears)
- Footer note: "Changes update everywhere in your atlas."

**`apps/mobile/app/coming-soon.tsx`** — Reusable placeholder:
- Receives `feature` as query param
- Displays feature name as heading + "This feature is coming soon." + back button

**`apps/mobile/app/_layout.tsx`** — Added `refine-part` and `coming-soon` Stack.Screens (headerShown: false)

**`.expo/types/router.d.ts`** — Added `/refine-part` and `/coming-soon` to all three Expo Router union types

**TypeScript:** `tsc --noEmit` passes with zero errors.

### Architecture notes
- Old 6-tab structure fully removed — no tab bar, no tab state
- Profile fields are read-only on the profile screen; editing happens only in Refine
- Faux gradient achieved with dark semi-transparent overlay (no expo-linear-gradient required)
- `router.push` uses template string pattern (`/refine-part?id=${id}`) consistent with rest of codebase

### Next step
Mini-Assessment Library build-out, or Elaboration screens.

---

## Session: 2026-03-19 (Inner Dialogue — Phase 2 Feature 1)

**Goal:** Build Inner Dialogue feature — list screen, session screen, wired from Part Profile.

### What was built this session

**`apps/mobile/app/dialogue.tsx`** — Dialogue List screen:
- Route: `/dialogue?id=<part_id>`
- Header: "Dialogue with [part name]" + back button
- `useFocusEffect` refreshes list on focus
- Queries `inner_dialogues WHERE participants_json LIKE '%' || ? || '%' ORDER BY updated_at DESC`
- Cards: date + first-message preview (70-char truncated)
- Empty state: chatbubbles icon + "No dialogues yet" + description copy
- "Begin New Dialogue" full-width button → `/dialogue-session?partId=<id>`
- Tap card → `/dialogue-session?partId=<id>&dialogueId=<id>` (resume)

**`apps/mobile/app/dialogue-session.tsx`** — Dialogue Session screen:
- Route: `/dialogue-session?partId=<uuid>[&dialogueId=<uuid>]`
- Dark background #1A1917 — chat atmosphere
- New dialogue: creates `inner_dialogues` row on first message sent
- Resume: loads `messages_json` from existing row on mount
- **Chat bubbles:** "You" right-aligned #3B5BA5, part left-aligned type-color; part name shown above first part bubble only
- **Auto-scroll:** FlatList `onContentSizeChange` + `onLayout` scroll to bottom
- **Voice toggle:** "You" / "[part name]" chips — determines `participant_id` in message
- **Send:** disabled when input empty; saves to `messages_json` JSON array on every send
- **Ground button:** fixed bottom-right above input, neutral #6B6860, shield icon + "Ground" label
- **Grounding overlay:** full-screen dark overlay, `Animated.loop` breathing circle (5s in / 5s out, 3 cycles), two CTA buttons
  - "I feel steadier — return to dialogue" → dismisses overlay
  - "End dialogue and save" → `router.back()` to dialogue list
- **Header:** "End & Save" button (top right) → `router.back()`
- **Storage:** `messages_json: [{participant_id, text, timestamp}]`, `participants_json: [{part_id, name, color, is_self}]`

**`apps/mobile/app/part-profile.tsx`** — Dialogue action button now routes to `/dialogue?id=<id>` (previously `coming-soon`)

**`apps/mobile/app/_layout.tsx`** — Added `dialogue` and `dialogue-session` Stack.Screens (headerShown: false)

**`.expo/types/router.d.ts`** — Added `/dialogue` and `/dialogue-session` to all three Expo Router union types

**TypeScript:** `tsc --noEmit` passes with zero errors.

### Architecture notes
- `messages_json` stored as full JSON array per dialogue row — load all, append, save all
- Ground button `pointerEvents="box-none"` on container so FlatList remains scrollable through transparent areas
- Grounding animation uses `Animated.loop` with `iterations: 3`; cleanup function in `useEffect` stops loop on visibility change
- `dialogueId` state initialized from param; set after first INSERT so subsequent sends use UPDATE

### Next step
Mini-Assessment Library build-out, or Elaboration screens.

---

## Session: 2026-03-20 (Inner Dialogue — Multi-Party Redesign)

**Goal:** Replace two-party dialogue implementation with full multi-party support across three screens.

### Schema migrations (`apps/mobile/lib/database.ts`)
- Added two migrations to `runMigrations()`:
  - `ALTER TABLE inner_dialogues ADD COLUMN status TEXT DEFAULT 'active'`
  - `ALTER TABLE inner_dialogues ADD COLUMN part_id TEXT` (primary part — for back-navigation)
- Migrations are additive; all existing dialogues preserved

### Message + participants format (backwards-compatible parse helpers)
- New messages: `{id, part_id: string|null, content, created_at}` — `part_id=null` = Self
- Old messages: `{participant_id, text, timestamp}` — handled by `parseMessages()`
- New participants_json: `["uuid1", "uuid2"]` (string array)
- Old participants_json: `[{part_id, name, color, is_self}]` — handled by `parseParticipantIds()`

### Screen 1 — `apps/mobile/app/dialogue.tsx` (rewritten)
- Header: "Dialogues — [part name]"
- Query covers both formats: `WHERE participants_json LIKE '%' || ? || '%' OR part_id = ?`
- Cards: date, title (or "Untitled dialogue"), Self + part avatars, 60-char preview
- "Start Dialogue" pinned button → `/dialogue-start?partId=<id>`

### Screen 2 — `apps/mobile/app/dialogue-start.tsx` (new)
- Optional intention text input
- Self chip: fixed gold, non-removable
- Pre-selected part chip(s): removable unless only one remains; Add Part modal bottom sheet
- "Begin Dialogue" disabled until ≥1 part; creates `inner_dialogues` row → `/dialogue-session?dialogueId=<id>`

### Screen 3 — `apps/mobile/app/dialogue-session.tsx` (full rewrite)
- Receives `dialogueId` only (no `partId`); loads dialogue + participants from DB
- `status='complete'` → read-only mode; `status='active'` → active mode
- Participant selector chips (horizontal scroll); active chip full opacity, others 0.5
- Send button color = active speaker's type-color; Self = gold
- Part bubbles: left-aligned, type-color + alpha bg, 28px avatar + initials; name shown above every bubble (multi-party) or first-only (single)
- Self bubbles: right-aligned, gold (#B88A00)
- "Continue this dialogue": sets status='active' inline, no full reload
- "End & Save": status='complete', navigates via `router.replace` to dialogue list
- Ground button + grounding overlay preserved from previous implementation

### Wiring
- `_layout.tsx`: added `dialogue-start` Stack.Screen (headerShown: false)
- `router.d.ts`: added `/dialogue-start` to all three union types

**TypeScript:** `tsc --noEmit` passes with zero errors.

### Next step
Mini-Assessment Library build-out, or Elaboration screens.

---

## Session: 2026-03-20 (Dialogue Session — Add Part + Create Part mid-dialogue)

**Goal:** Add two mid-dialogue features to `dialogue-session.tsx`: add existing parts and create new parts without leaving the session.

### What was built this session

**`apps/mobile/app/dialogue-session.tsx`** — Two additions to active mode:

**Addition 1 — "+ Add" chip in speaker chips row:**
- `ScrollView horizontal` chips row extended with a `+ Add` chip at the end
- Chip: dashed border, `#6B6860` color, "+" icon + "Add" label; same height as speaker chips
- Tapping calls `handleOpenAddPart()`: queries `parts` NOT IN current participants → opens `AddPartModal`
- `AddPartModal` (new sub-component): bottom-sheet Modal
  - Each row: 36px type-color avatar + initials, display_name, type pill
  - Tap a part: updates `participants_json` in DB, appends to state, switches `activeSpeakerId`, dismisses
  - Empty state ("All your parts are in this dialogue"): "Create New Part" button
  - Non-empty list footer: `+ Something new is emerging…` → opens Create Part modal

**Addition 2 — Create New Part mid-dialogue:**
- `CreatePartModal` (new sub-component): slide-up form
  - Fields: Name* (required), job (optional), type chips (Manager/Firefighter/Exile/Unknown)
  - "Add to Dialogue" button disabled until name entered; note: "You can add more details later."
  - On confirm: inserts `parts` + `part_profiles` rows, updates `participants_json`, adds chip, switches active speaker, dismisses both modals
- `PartType` extended with `'unknown'`; `TYPE_COLOR` + `TYPE_LABEL` maps updated

**No new routes or DB migrations needed.**

**TypeScript:** `tsc --noEmit` passes with zero errors.

### Next step
Mini-Assessment Library build-out, or Elaboration screens.

---

## Session: 2026-03-20 (Techniques Library)

**Goal:** Build the Techniques Library feature — 3 screens + data layer.

### What was built this session

**`apps/mobile/lib/techniques-data.ts`** — Typed TypeScript copy of docs/content/techniques-library.json (outside Metro watch scope). Exports `TECHNIQUES` array, `getTechnique(id)` helper, and `getVisibleSteps(steps, choiceValues)` for conditional branching in feel_towards and meeting_space.

**`apps/mobile/app/techniques.tsx`** — Techniques Library list. 5 cards with left gold accent bar, icon, name, tagline, duration. Taps to detail screen.

**`apps/mobile/app/technique-detail.tsx`** — Technique detail with full description, meta row (time/steps/prerequisite), optional part selector chips (type-color avatars, single-select), safety note for meeting_space. "Begin Practice" → session.

**`apps/mobile/app/technique-session.tsx`** — Full step runner:
- Progress bar, header (back + technique name + "X / Y" counter), dark background
- Renders all step types: instruction, breathing_anchor (auto-advance timer, pauses during grounding), free_text, multi_prompt (fields + dynamic list style), single_choice (branching gated)
- Ground button: step 3 onward (stepIndex >= 2), right-aligned above Continue
- Grounding overlay: full-screen, animated breathing circle, return/end options
- Exit modal on back at step 0; saves partial session to DB
- Completion screen: duration, feel-towards question (saves to part_profiles), "Return to Techniques"
- DB: writes to practice_sessions; updates part_profiles.feel_towards on complete

**Wiring:** `_layout.tsx` + `router.d.ts` + dashboard Techniques card updated.

**TypeScript:** `tsc --noEmit` passes with zero errors.

### Next step
Mini-Assessment Library, Elaboration screens, or Three-Screen Reveal.

---

## Session: 2026-03-20 (Technique Additions + TypeScript Fix)

**Goal:** Complete 5 additions from the previous timed-out session: Feel Towards branching, in-session logging, Breathing Timer, Resonance Frequency Breathing, Practice History in Part Profile. Fix TypeScript to zero errors.

### What was built / completed

**FIX — Feel Towards branching (technique-session.tsx)**
- Split `self_present` option into `self_curious`, `self_open`, `self_warm` in `ft_assess` step
- Added 4 new steps (A/B/C/D) gated with `conditional_show_if: ['self_curious', 'self_open', 'self_warm']`: body awareness → sensing part response → what do you notice in the part → closing
- `[quality]` text substitution: maps choice value → curiosity/openness/warmth
- `ft_reassess` and `ft_closing` gated to non-self values only
- `BreathingCircle` component: gold animated circle in breathing_anchor step type
- `LogModal` component: floating notebook button (bottom-left), numbered list, saves to `notes_json`
- `saveSession()` writes `notes_json` JSON array + `part_id`; `saveFeelingTowards()` separate upsert on Return
- Completion screen shows logged entries under "What came up during practice"

**ADDITION 2 — Breathing Timer (`apps/mobile/app/breathing-timer.tsx`)**
- Animated gold circle (scale 0.6 → 1.0 → 0.6), uses refs to avoid stale closure issues
- Pace slider 2.0–10.0s, Hold slider 0.0–4.0s via `@react-native-community/slider`
- Bell haptics via `expo-haptics` (mutable toggle), breath counter, start/pause/stop controls
- Wired to dashboard ("Breathing" card), `_layout.tsx`, `router.d.ts`

**ADDITION 3 — Resonance Frequency Breathing technique**
- Added as 6th technique in `lib/techniques-data.ts`
- 5 steps: intro × 2 → 300s breathing_anchor → reflect → closing
- Added `pulse-outline` icon to `techniques.tsx` icon map

**ADDITION 4 — Practice History in Part Profile**
- DB migration: `ALTER TABLE practice_sessions ADD COLUMN notes_json TEXT`
- DB migration: `ALTER TABLE practice_sessions ADD COLUMN part_id TEXT`
- `part-profile.tsx`: queries `practice_sessions` by part_id or parts_tagged_json match
- Practice History section: technique name, date, duration; expandable notes per session

**Navigation fix**: All session exit paths in `technique-session.tsx` use `router.replace`

**TypeScript zero errors — root cause and fix:**
- Root cause: npm workspace hoisted `react-native` to `root/node_modules` but `@types/react` was only in `apps/mobile/node_modules/@types/react`. This caused TypeScript to resolve `React.Component` in react-native's `.d.ts` files via `root/node_modules/react/index.js` → then types, giving a different module identity than when app files resolved `react` directly to `@types/react`. The two `React.Component` types had different module identities in TypeScript's cache, causing all JSX component checks to fail.
- Fix: installed `@types/react@19.1.17` as devDependency in root `package.json`. This placed `@types/react` at `root/node_modules/@types/react`, ensuring both contexts resolve to the same package ID.
- Also fixed: `dialogue-session.tsx` ref typed as `useRef<TextInput & { focus(): void }>` since `focus()` is not in react-native's TextInput type declaration.

### Files changed this session
- `apps/mobile/lib/techniques-data.ts` — self_curious/open/warm split, 4 new FT steps, RFB technique
- `apps/mobile/lib/database.ts` — two new migrations
- `apps/mobile/app/technique-session.tsx` — full rewrite: FT branching, BreathingCircle, LogModal, log save
- `apps/mobile/app/breathing-timer.tsx` — new file
- `apps/mobile/app/part-profile.tsx` — Practice History section
- `apps/mobile/app/_layout.tsx` — breathing-timer route added
- `apps/mobile/app/(tabs)/index.tsx` — Breathing dashboard card
- `apps/mobile/app/techniques.tsx` — resonance_frequency_breathing icon
- `apps/mobile/.expo/types/router.d.ts` — /breathing-timer route added
- `apps/mobile/app/dialogue-session.tsx` — ref type fix
- Root `package.json` — @types/react@19.1.17 devDependency

### TypeScript: zero errors ✓

---

## Session: 2026-03-20 (Metro / EXPO_ROUTER_APP_ROOT fix)

**Goal:** Fix EXPO_ROUTER_APP_ROOT bundle error caused by root node_modules conflicting with Metro.

### Root cause identified
Running `npm install` from repo root (with `workspaces` in root `package.json`) hoisted ALL packages from `apps/mobile` up to `root/node_modules`, leaving `apps/mobile/node_modules` empty. Metro resolved everything from root, breaking Expo Router's app root detection.

### File changes
- `apps/mobile/metro.config.js` — added explicit `watchFolders = [projectRoot]` and `resolver.nodeModulesPaths = [apps/mobile/node_modules]`
- Root `package.json` — removed `workspaces` field and root-level `@types/react` devDependency (both caused the hoisting problem; `@types/react` is already declared in `apps/mobile/package.json`)
- `findings.md` — updated "Metro + Monorepo" entry with root cause + recovery steps; updated TypeScript section to remove outdated root-install workaround

### Pending terminal steps (user must run)
1. `rmdir /s /q C:\Projects\inner-atlas\node_modules`
2. `cd C:\Projects\inner-atlas\apps\mobile && npm install`
3. `rmdir /s /q .expo`

---

## Session: 2026-03-21 (Update Logger)

**Goal:** Build Update Logger — 3 screens for clients to log part activations between sessions.

### What was built

**`apps/mobile/app/updates.tsx`** — Updates List
- Route: `/updates?partId=<uuid>` (optional)
- Global mode (no partId): all updates, sorted newest first
- Part mode: filters to specific part, header shows "Updates — [name]"
- Cards: part name + type-color pill, activation type icon, datetime, 80-char snippet
- Empty state with guidance copy; useFocusEffect refresh
- "Log Update" button pinned to bottom

**`apps/mobile/app/log-update.tsx`** — Log Update form
- Pre-selects part from partId param; chip removable/changeable
- Part selector bottom sheet; "Something new is emerging..." → /add-part
- Activation type chips: Activated | Noticed | Reflected on | Worked with | Milestone
- 5-dot intensity selector (no default, tap-to-clear)
- Three text areas: What activated / What did you notice / How did you respond
- "Explore further?" chips: Trailhead | Elaboration → /coming-soon after save
- Animated "Update logged" toast (800ms) before navigate
- Confirm discard Alert on back if any field is filled

**`apps/mobile/app/update-detail.tsx`** — Update Detail / Edit / Delete
- Read-only view of all populated fields
- "Edit" (header right) → in-place editing; becomes "Save"
- Intensity shown as filled dots (view) / interactive selector (edit)
- "Delete this update" button with Alert confirmation; navigates back on delete

### Wiring changes
- `apps/mobile/app/_layout.tsx` — added `updates`, `log-update`, `update-detail` Stack.Screens
- `apps/mobile/app/part-profile.tsx` — `updates` action now routes to `/updates?partId=[id]`
- `apps/mobile/app/(tabs)/index.tsx` — Updates card routes to `/updates`
- `apps/mobile/.expo/types/router.d.ts` — all three new routes added to typed union

### TypeScript: zero errors ✓
4. `npx expo start --clear`

---

## Session: 2026-03-20 (Breathing Timer audio + Dialogue routing fix)

**Goal:** Two targeted fixes.

### FIX 1 — Breathing Timer bell sound (`apps/mobile/app/breathing-timer.tsx`)

**Root cause:** `bell()` only called `expo-haptics` — no audio playback was wired despite expo-av being installed.

**Fix:**
- Added `Audio` import from `expo-av`
- Added `generateBellWavUri()` — generates a 440 Hz sine wave with exponential decay (800ms, 8kHz mono 16-bit PCM) as a WAV data URI at runtime. No external audio asset needed; pure JS `DataView` + `btoa`.
- Combined mount/cleanup `useEffect`: sets up audio session via `Audio.setAudioModeAsync` (`playsInSilentModeIOS: true`, `shouldDuckAndroid: true`), preloads WAV into `soundRef` via `Audio.Sound.createAsync`; unloads on unmount.
- `bell()` now: plays haptic + calls `sound.stopAsync()` then `sound.playFromPositionAsync(0)` so rapid re-triggers work correctly.
- Mute toggle suppresses both haptic and sound.

### FIX 2 — Dialogue flow from dashboard (`apps/mobile/app/my-parts.tsx`, `apps/mobile/app/(tabs)/index.tsx`)

**Root cause:** Dashboard Dialogue card pushed `/my-parts` with no context; tapping a part always went to `/part-profile`.

**Fix:**
- `my-parts.tsx`: added `useLocalSearchParams` to read `mode` query param. When `mode === 'dialogue'`:
  - Header title changes to "Choose a Part"
  - Blue banner shown below header: "Select a part to begin a dialogue"
  - Card tap navigates to `/dialogue-start?partId=<id>` instead of `/part-profile?id=<id>`
- `index.tsx`: Dialogue card `onPress` now pushes `{ pathname: '/my-parts', params: { mode: 'dialogue' } }`
- Normal browsing (no mode param) behavior unchanged.

**TypeScript:** zero errors (no new types introduced).

---

## Session: 2026-03-21 (Trailhead Feature — Phase 2)

**Goal:** Build full Trailhead flow — entry screen + 7-step guided session.

### What was built this session

**`apps/mobile/app/trailhead.tsx`** — Entry screen:
- Route: `/trailhead?partId=[id]` (partId optional)
- If partId provided: shows pre-selected part name, skip selector
- If no partId: loads all Manager + Firefighter parts from DB, chip selector grid
- Explanation copy: "A trailhead follows a protective part back to what it's protecting."
- Begin Trailhead button — disabled until part selected
- Empty state if no protective parts yet

**`apps/mobile/app/trailhead-session.tsx`** — Session screen:
- Route: `/trailhead-session?partId=[protector_part_id]`
- Creates trailheads DB row on mount (status: in_progress)
- Updates row on completion (status: complete or in_progress, exile_id, entry_description with step JSON)
- **Ground button mandatory from Step 2 (self_checkin) onward** — per SECURITY_AND_BACKUP.md spec
- Grounding overlay: breathing animation (5s in/5s out, 3 cycles), "Return" + "End and save" — identical pattern to technique-session.tsx
- 7 steps with branching:
  - Step 1: Orientation (no ground button)
  - Step 2: Self Check-In — unblending sub-step if Frustrated/Overwhelmed/Afraid
  - Step 3: Making Contact — optional reflection input
  - Step 4: Asking the Protector — optional reflection input
  - Step 5: Following the Trail — 3-way choice → Step 6 (yes/not_sure) or Step 7b (nothing)
  - Step 6: Sensing the Exile — 2 optional inputs, different framing for yes vs not_sure
  - Step 7a: Discovery Close — inline exile naming; creates parts + part_relationships row; navigates to new part profile
  - Step 7b: Gentle Close — gentle ending when nothing came up
- Step dots indicator at top (7 dots, active/past/future states)
- Dark canvas atmosphere (#1A1917) matching technique-session
- IFS-appropriate language throughout (no clinical/pathology terms)

**`apps/mobile/app/_layout.tsx`** — Added `trailhead` and `trailhead-session` Stack.Screens

**`apps/mobile/app/part-profile.tsx`** — Trailhead action button now navigates to `/trailhead?partId=<id>` (was coming-soon)

**`apps/mobile/app/(tabs)/index.tsx`** — Dashboard Trailhead card now navigates to `/trailhead` (was Alert)

### IFS clinical compliance
- Language: "part", "active", "Self-energy" — no clinical pathology terms
- Exile discovery: user names the part, chooses type (Exile/Unknown) — backend classification never shown
- Ground button mandatory per spec from self_checkin step onward
- part_relationships row created with type 'protective', direction 'a_to_b'
- New part discovered_via = 'trailhead'

### Next step
Elaboration screens, Mini-Assessment Library, or Self-Energy Check-In.

---

## Session: 2026-03-21 (Trailhead Save Fix + Part Activity Log)

**Goal:** Fix trailhead session saving and add Trailhead History + Activity Log to Part Profile.

### Task 1 — Fix Trailhead Session Saving

**Root cause — DB schema mismatch:**
The `trailheads` table was missing columns required by the session flow:
- `part_id TEXT` — the protector part that was worked with
- `steps_json TEXT` — JSON of all step responses (was incorrectly stored in `entry_description`)
- `exile_discovered INTEGER DEFAULT 0` — 0/1 flag
- `discovered_part_id TEXT` — nullable, set when exile is named + added
- `created_at TEXT` — session creation timestamp

**`apps/mobile/lib/database.ts`** — Added 5 migrations to `runMigrations()`:
- `ALTER TABLE trailheads ADD COLUMN part_id TEXT`
- `ALTER TABLE trailheads ADD COLUMN steps_json TEXT`
- `ALTER TABLE trailheads ADD COLUMN exile_discovered INTEGER DEFAULT 0`
- `ALTER TABLE trailheads ADD COLUMN discovered_part_id TEXT`
- `ALTER TABLE trailheads ADD COLUMN created_at TEXT`

**`apps/mobile/app/trailhead-session.tsx`** — Three fixes:
1. **INSERT on mount** — now inserts `part_id` and `created_at` correctly; removed `trail_chain_json` usage
2. **completeSession UPDATE** — now writes `steps_json`, `exile_discovered`, `discovered_part_id`; previously wrote to `entry_description`
3. **Back button exit modal** — calls `Alert.alert` with "Keep going" / "End & Save" instead of bare `router.back()`

**All exit paths save correctly:**
- Step 7a exile added → `status: complete`, exile saved
- Step 7a "Not yet" → `status: complete`, no exile
- Step 7b gentle close → `status: complete`, no exile
- Ground "End and save" → `status: in_progress`, exile preserved if already added
- Back button "End & Save" → `status: in_progress`, exile preserved if already added

### Task 2 — Trailhead History + Activity Log

**`apps/mobile/app/part-profile.tsx`** — Two new Zone 3 sections:

**Trailhead History:** Queries `trailheads WHERE part_id = ?` with LEFT JOIN for discovered part name. Cards show date, status, exile note. Tappable → `/trailhead-review`.

**Activity Log:** Combined feed of Updates + Dialogues + Technique Sessions + Trailheads sorted newest first. Each item has type icon + color, label, date, one-line summary. Navigation to relevant detail screens. Section hidden when no activity exists.

**`apps/mobile/app/trailhead-review.tsx`** — New read-only screen:
- Route: `/trailhead-review?id=<uuid>`
- Shows step cards (label + response) for any step with content
- Exile discovery card with link to discovered part's profile
- Back → part profile via `trailhead.part_id`

**`apps/mobile/app/_layout.tsx`** — Added `trailhead-review` route.

**`apps/mobile/.expo/types/router.d.ts`** — Added `/trailhead-review` to all four typed route union types.

### TypeScript: zero errors ✓

### Next step
Elaboration screens, Mini-Assessment Library, or Self-Energy Check-In.

---

## Session: 2026-03-23 (Refine + Elaboration screen fixes)

**Goal:** Four UI fixes across refine-part, descriptor-explorer, and elaboration-menu.

### What was changed this session

**FIX 1 — `app/refine-part.tsx` — Tabbed interface:**
- Replaced single long scrollable page with 4-tab interface: Identity | Core Profile | Extended | Danger Zone
- Tab row: horizontal ScrollView with pill-style buttons; selected tab uses part type-color bg + white text; unselected has transparent bg + #E5E3DE border
- Each tab renders only its own content section
- Save button hidden on Danger Zone tab (destructive-only)
- Save is now tab-scoped: Identity saves parts table (name + type); Core saves core profile fields; Extended saves extended fields — no cross-tab overwrites

**FIX 2 — `app/descriptor-explorer.tsx` — Save button:**
- Removed old absolute-positioned summaryBar
- Added unified bottom bar (outside ScrollView) containing summary chips (conditional) + always-visible Save button
- handleSave: persists current selections + custom_tags then routes back
- Auto-save on every chip toggle retained

**FIX 3 — `app/elaboration-menu.tsx` — Descriptor card progress:**
- Removed progress bar entirely from descriptor explorer cards
- 0 words + no custom tags → "Not yet explored" in secondary text, no indicator
- Any content → "X words" in type-color text + green checkmark (Ionicons checkmark-circle, #22C55E) in top-right
- Updated elaboration data type to include `custom_tags?: string[]`

**FIX 4 — `app/elaboration-menu.tsx` — Guided exploration status:**
- Removed "In Progress" label
- No content → "Not yet explored", no indicator
- Any content → "Has notes" in #22C55E + green checkmark in top-right
- getGuidedStatus return type updated: 'empty' | 'has_notes'

### TypeScript: zero errors ✓

### Next step
Pending device verification of Clusters B–D, Phase 3. Or next feature build.

---

## Session: 2026-03-25 (Part Inheritance Exploration)

**Goal:** Add "Part Inheritance" guided exploration to the Elaboration feature.

### What was built this session

**DB migrations (database.ts):**
- `part_profiles`: added `inheritance_tags TEXT` and `inheritance_notes TEXT` columns

**elaboration-menu.tsx:**
- Added `part_inheritance` entry to `GUIDED_EXPLORATIONS` (after 'Memories')
- Added `inheritance_notes` to `ProfileRow` interface and DB query
- Updated `getGuidedStatus` to handle `part_inheritance` via `inheritance_notes`

**guided-exploration.tsx:**
- Added `'part_inheritance'` to `ExplorationId` union type
- Extended `ExplorationConfig` with optional `introTexts`, `tagLabel`, `tagPlaceholder`, `writeLabel`, `writePlaceholder` fields
- Added `INHERITANCE_PROMPTS` constant (3 expandable prompt cards: family/caregiver, cultural/community, character/story)
- Added `EXPLORATION_CONFIG` entry for `part_inheritance` (saves to `inheritance_notes` + `inheritance_tags`)
- Added `expandedInheritanceCards` state; `isInheritance` flag; `showGround` now true for ALL part types on this exploration
- Render: dual intro text cards, custom tag label/placeholder, custom write label/placeholder, expandable prompt cards section
- Expandable cards auto-save to `part_memories` with titles "Inheritance — family/caregiver", "Inheritance — cultural/community", "Inheritance — character/story"
- Added `inheritanceCard`, `inheritanceCardHeader`, `inheritanceCardQuestion`, `inheritanceCardExpanded` styles

**part-profile.tsx:**
- Added `inheritance_tags` and `inheritance_notes` to `ProfileRow` interface and DB query
- Added "Part Inheritance" section in Zone 3: type-colored tag chips + notes text + related memories (title starts with "Inheritance —")

**refine-part.tsx:**
- Added `inheritance_notes` to `ProfileFields` and `EXTENDED_FIELDS`
- Added `inheritanceTags` (string[]) and `inheritanceTagDraft` state
- DB load now fetches `inheritance_notes` and `inheritance_tags`
- Extended tab: renders existing fields then special "Part Inheritance" section with add/remove tags + notes FieldRow
- Extended tab save includes `inheritance_notes` and `inheritance_tags`

### TypeScript: zero errors ✓

---

## Session: 2026-04-15 — Add Image Fix + Parts Map SVG + Unblending Routing Fix

### Add Image Button Fix (Part Profile)
- Root cause 1: `ImageBackground` absorbed child touch events on Android — replaced WITH IMAGE branch header with `View` + `Image (absoluteFillObject)` sibling; gradient `View` given `pointerEvents="none"`
- Root cause 2: `initialsWrapper` (decorative watermark) lacked `pointerEvents="none"` — absorbed touches in WITHOUT IMAGE branch
- Both branches now pass touches through decorative layers to `TouchableOpacity` buttons correctly
- Added finding to `findings.md`

### Parts Map SVG Rebuild (Phase 2.5)
- See earlier session entry "Phase 2.5 Parts Map Rebuild: SVG Canvas Foundation" for full detail
- Key architectural notes: stale closure fix via `transformRef`; tap detection via PanResponder release + canvas coordinate hit-testing (avoids SVG onPress / PanResponder conflict)

### Unblending Routing Fix (ExperienceLogStep.tsx)
- **Bug:** "Continue the practice →" on the "This part has good reasons" (won't-separate) screen was returning to the practice log instead of routing to "Stay with it a moment" (sit-with-part)
- **Root cause:** `handleStayedBlended` was finalizing the entry and calling `setPhaseAndNotify('log')` directly
- **Fix:** `handleStayedBlended` now transitions to `'sit-with-part'` (mirrors `handleHaveSpace` path); attaches `stayedBlended: true` + notes to `pendingEntry` before transition; `quickUnblend` edge case preserved with early return to `'log'`
- No changes to `UnblendSupportCard.tsx` — `onStayedBlended` callback was already correct

### TypeScript: zero new errors ✓ (pre-existing trailhead/session.tsx:623 remains)

---

## Session: 2026-04-12 (Week 4 Feel Towards Fixes)

**Goal:** Fix chip group order (Parts Present first), expand both chip lists, add // TEXT: comments.

### Changes
- `apps/mobile/lib/techniques-data.ts`: Added 5 items to `FEEL_TOWARDS_SELF_QUALITIES` (Creative, Loving, Appreciative, Understanding, Empathetic); added 2 items to `FEEL_TOWARDS_REACTIVE` (Indifferent, Not Self liking). Constants propagate automatically to Feel Towards, Inquiry, and Meeting Space.
- `apps/mobile/components/ui/UnblendCycleStep.tsx`: Swapped chip group render order — PARTS PRESENT renders first, SELF-ENERGY PRESENT second. Renamed label "SELF-ENERGY" → "SELF-ENERGY PRESENT". Added `// TEXT: feel-towards` comments above all editable strings.

### TypeScript: zero errors in changed files ✓

---

## Session: 2026-04-20 — Image Picker Rewrite + Tap Target Fix

### FIX A — part-image-picker.tsx full rewrite (739 → 293 lines)
- Replaced custom PanResponder crop overlay with native `expo-image-picker` crop
- New flow: source-select → native 3:4 rect crop → auto circle computation → review → save
- `computeDefaultCircle`: uses `ImageManipulator` to center-square crop the rect result for a default circle
- "Retake Circle Crop" button re-launches picker with `aspect: [1, 1]`
- No PanResponder, no CropFrameOverlay, no CropPreview, no gesture code
- DB write logic preserved exactly from prior version
- TypeScript: zero new errors

### FIX B — part-profile.tsx tap target improvements
- `editImageBtn`: width/height 32→40, added `zIndex: 10`, `hitSlop` on TouchableOpacity
- `addImageBtn`: paddingHorizontal 10→14, paddingVertical 5→8, `backgroundColor` darkened, added `zIndex: 10`, `hitSlop` on TouchableOpacity

---

## Session: 2026-04-24 — Parts Map Fix Batch A: Keys, Hulls, Polarization, Zoom, Spacing, Self Routing

**Files changed:** `lib/database.ts`, `lib/graph-layout.ts`, `components/map/PartsMapCanvas.tsx`

- **Duplicate React key fix:** Structural `<Path>` keys namespaced `sp-${relId}-${idx}`; chain arrow `<Circle>` keys namespaced `ca-${relId}-${idx}`; feeling edge `<G>` loop converted from `for…of` to `forEach((fe, feIdx) =>` with `key="fe-${feIdx}"` and `continue` → `return`. Eliminates potential hull-vs-edge ID collision and ensures unique keys across all SVG children.
- **hullToSmoothPath fixed:** Rewrote with correct Catmull-Rom→cubic bezier using a wrapping `pt(i)` accessor; removed mixed-indexing bug where `p2` used `(i+2)%n` into original hull while `p0b` used `i-1` into extended `pts` array. Control point formula corrected: `cp1 = p1 + (p2-p0)*t/3`, `cp2 = p2 - (p3-p1)*t/3`. Call site tension updated `0.4→0.35`.
- **`routeAroundObstacles` threshold:** `padding * 0.8 → 0.9` for more aggressive obstacle detection.
- **Polarization group-vs-group rendering:** `database.ts`: `MapRelationship` extended with `member_sides: (string|null)[]`; `getMapRelationships` now selects `side` column. `PartsMapCanvas.tsx` edges useMemo: 1v1 = single line; 1vN = one line per group member; NvM = nearest representative of each side (centroid-nearest). Old null-side data falls back to all-pairs.
- **Default zoom 0.75:** `useState(1)→0.75`, `useRef(1)→0.75` for `scaleRef` and `lastScale`.
- **Spacing improvements:** Repulsion `8000→28000`; centering `0.005→0.002`; `iterations 300→400`; `initialTemperature 60`. Collision radius `+18→+45` px. Alliance spring stiffness `0.12→0.07` restLength `90→95`; chain `0.14→0.09` / `85→90`; polarization `0.04→0.035` / `240→260`. Seed radii: `CANVAS_DIAG*0.28` / `CANVAS_DIAG*0.22`.
- **Self routing clearance:** Obstacle radius `+20→+35`; `selfClearance` `+28→+45`.

