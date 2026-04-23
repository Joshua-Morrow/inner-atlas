# Inner Atlas — Assessment Redesign

CRITICAL: This replaces the old 3-tier 44-part linear assessment entirely.
The old design is NOT to be used. Full spec follows.

## Why Redesigned

Old 3-tier system was: too long, redundant with Elaboration, felt like a survey.
New design is: narrative-driven, fog-of-war discovery, 12-18 minutes, ends with cliffhanger.

## Assessment 1: First Mapping Assessment

Location: /assessment/first-mapping
Duration: 12-18 minutes total

### Phase 1 — The Moment (2-3 min)

Ground user in a specific recent reactive moment.
5 questions about body sensations, actions, second voice, aftermath, frequency.
Backend inference maps responses to likely part types for Phase 2 weighting.
Inference stored in assessment_sessions.inferences_json — NEVER shown to user.

### Phase 2 — The Patterns (8-10 min)

4 clusters, each ending in a full-screen Naming Moment.

CLUSTER A — Standards & Effort
  Questions: performance standards, self-evaluation, fear of failure
  Reveals: Manager/Protector pattern
  Ends with: Naming Moment A

CLUSTER B — Relief & Escape
  Questions: how user seeks relief when overwhelmed
  Reveals: Firefighter pattern
  Ends with: Naming Moment B

CLUSTER C — Connection & Relationships
  Questions: relational patterns, closeness, conflict management
  Reveals: Relational Protector (Manager or Firefighter)
  Ends with: Naming Moment C

CLUSTER D — The Voice Inside
  Questions: inner critic, self-judgment, quiet/numb feelings
  Reveals: Inner Critic pattern (and/or Suppressor)
  Also: ALWAYS places shadowed Exile node if quiet/numb prominent
  Exile node: NO naming prompt — placed as "Unknown — waiting to be known"
  This is the FIRST PLANTED CLIFFHANGER

### Phase 3 — The Connections (3-4 min)

Dynamic questions generated from named parts.
Surfaces 1-2 protective relationships between them.
Final question: Self-access baseline (how do you feel toward all named parts?)
Self-access stored in self_energy_checkins — NEVER scored or labeled.

### Three-Screen Reveal

Screen 1: Full map animates in with named nodes + shadowed ghost nodes in fog
  Copy: "This is your system — as much of it as we can see from here."

Screen 2: One protective relationship highlighted
  Framed as loyalty: "They're not fighting each other. They're protecting the same thing."

Screen 3: Cliffhanger
  Dotted lines pulse into fog. Shadowed nodes glow.
  Copy: "What happened that made these connections necessary? That question is worth following."
  Button: "Explore the fog" -> mini-assessment library

## Naming Moment — Required Spec

Every naming moment is a FULL-SCREEN transition (not modal, not inline card).

Required elements:
1. Warm description paragraph (3-4 sentences, lived experiential language — from naming-moment-descriptions.json)
2. "This part is not its [role/behavior/belief]. That's a role it took on." (exact)
3. Name chip row (5-6 chips): functional -> evocative -> personal
4. Open text field: "Or give it your own name"
5. Confirm button -> map animation (node fades in with pulse, shows user's chosen name)
6. Micro-capture: "How do you feel toward [name] right now?" (stored, never scored)

CRITICAL: Node label always shows USER'S CHOSEN NAME. Never backend classification.

## Mini-Assessment Library (6 Assessments)

Each: 8-12 minutes, lifts fog in specific region, ends with cliffhanger.

| Assessment | Parts Covered | Special Requirements |
|---|---|---|
| The Achiever | Perfectionist, Analyzer, Planner, Comparer, Rationalizer, Restrainer | None |
| The Protector | Controller, Hypervigilant, Rule-Keeper, Skeptic, Tension-Holder, Suppressor, Timer | None |
| The Connector | Pleaser, Caretaker, Peacemaker, Minimizer, Optimist + 4 Exile types | None |
| The Escape Artist | ALL 16 Firefighters | No-shame opening screen + safety card if Self-Harmer/Substance User indicated |
| The Tender Places | ALL 17 Exiles | Orienting screen + "go gently" + therapy pointer at end |
| The Body Speaks | Body-holding parts + body map integration | Integrates body_placements table |

THERAPY POINTER (appears ONCE, ONLY at end of The Tender Places):
"The next step — meeting these parts with something other than protection —
is work that often goes deepest with a guide. That's what IFS therapy is for."

## Content Files YOU Must Write

Before building Phase 1:
- docs/content/assessment-questions.json — actual questions per phase/cluster
- docs/content/naming-moment-descriptions.json — warm description paragraphs per cluster
- docs/content/name-chips.json — 5-6 name chips per cluster (functional->evocative->personal)

## Data Structures

```typescript
interface Part {
  id: string
  userId: string
  name: string                 // from naming moment working title
  customName?: string          // user's own text
  displayName: string          // computed: customName ?? name — ALWAYS shown in UI
  type: 'manager'|'firefighter'|'exile'|'self'
  backendClassification: string // NEVER shown in UI
  intensity: number            // 1-10
  discoveredVia: string
  status: 'named'|'shadowed'|'unknown'
  positionX?: number
  positionY?: number
}

interface ShadowedNode {
  id: string
  userId: string
  inferredType: string
  inferredBackendClassification: string  // NEVER shown in UI
  connectedToPartId?: string
  revealedByAssessment: string
}
```
