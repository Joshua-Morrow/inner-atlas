# Assessment Logic — First Mapping Assessment & Mini-Assessments

## Overview

The assessment system has been redesigned from the original 3-tier model. The new system prioritizes engagement, curiosity, and time efficiency.

**The old model (3-tier):**
1. Parts Identification (44 parts × 5 questions = 220 questions)
2. Parts Specifics (detailed profiling per identified part)
3. Relationship Mapping

**Problem:** Too long, redundant with Elaboration feature, killed engagement.

**The new model:**
1. **First Mapping Assessment** — 12–18 min, produces ~4 named parts + 1 shadowed exile + initial map
2. **Mini-Assessment Library** — 6 optional assessments (8–12 min each), each lifts fog in one region

---

## First Mapping Assessment

### Goal
Produce the user's first parts map in one session. Maximize curiosity and forward momentum. Every discovery ends with a Naming Moment, not a closure.

### Structure: 3 Phases

**Phase 1 — The Moment (2–3 min)**
Ground the user in a specific recent reactive moment. 5 questions about:
- Body sensations during the moment
- Actions taken
- A second internal voice
- Aftermath feeling
- Frequency of this pattern

Backend: responses weighted to infer likely part types for Phase 2 question emphasis. NEVER shown to user.

**Phase 2 — The Patterns (8–10 min)**
Four clusters. Each ends in a Naming Moment.

| Cluster | Focus | Parts Inferred | Naming Outcome |
|---|---|---|---|
| A | Standards & Effort | Manager/Protector pattern | Named Manager node |
| B | Relief & Escape | Firefighter pattern | Named Firefighter node |
| C | Connection & Relationships | Relational Protector pattern | Named relational Manager node |
| D | The Voice Inside | Inner Critic / quiet-feeling | Named Inner Critic + shadowed Exile |

**Cluster D special rule:** If quiet/hollow/small feeling is prominent, the app places an UNNAMED shadowed Exile node on the map — NO naming prompt. Label: "Unknown — waiting to be known." This is the first planted cliffhanger. Do not ask the user to name it.

**Phase 3 — The Connections (3–4 min)**
Dynamic questions generated from the named parts discovered in Phase 2. Surfaces 1–2 protective relationships. Final question: Self-access baseline (how do you feel toward all named parts together?). Never scored.

### Three-Screen Reveal (After Phase 3)

1. **The Map** — full map animates into view with all named nodes glowing
2. **The Insight** — one specific relationship highlighted, framed as loyalty not dysfunction
3. **The Cliffhanger** — dotted lines pulse into fog, shadowed nodes glow; copy: "What happened that made these connections necessary? That question is worth following."

### Naming Moment Flow (After Each Cluster)

1. Warm description of the pattern in lived terms
2. Introduction as a part with protective purpose
3. Explicit statement: "This part is not its job/behavior/belief — that's a role it took on"
4. 5–6 suggested name chips (functional → evocative → personal)
5. Open text field for user's own name
6. Confirm button → node appears on map with chosen name + soft pulse animation
7. Micro-capture: "How do you feel toward [chosen name] right now?" — stored as self_energy data, NEVER scored

---

## Fog of War Map

### Concept
The map is not empty — it's partly hidden. Users can see there's more to discover.

- **Discovered nodes:** Glow in type color (teal=Manager, amber=Firefighter, lavender=Exile)
- **Display label:** Always `userChosenName` — never backend classification
- **Shadowed ghost nodes:** 3–6 visible in fog, pre-populated by inference
- **Fog coverage:** 60–70% of map after initial assessment; lifts as mini-assessments completed
- **Dotted trail lines:** Trail from discovered parts into fog, suggesting unknown connections

**Tapping a shadowed node:** "This part hasn't been discovered yet. [Mini-assessment name] can reveal what's here."

**Persistent elements:**
- Self Access orb (gold, center or side)
- Parts count display
- Text: "Your system is larger than this map"

**Explore the Fog button** → opens Mini-Assessment Library

---

## Mini-Assessment Library

6 assessments. Each 8–12 min. Each lifts fog in a specific map region, adds named nodes, ends with a cliffhanger.

### The Achiever
**Entry hook:** "There's a part of you that holds the bar high."
**Backend parts:** Perfectionist, Analyzer, Planner, Comparer, Rationalizer, Restrainer + exile gesture nodes
**Cliffhanger:** Hints at the exile underneath the achievement drive

### The Protector
**Entry hook:** "There's a part of you that watches for threats."
**Backend parts:** Controller, Hypervigilant, Rule-Keeper, Skeptic, Restrainer, Suppressor, Timer
**Cliffhanger:** What is this vigilance protecting?

### The Connector
**Entry hook:** "There's a part of you that needs the relationship to be okay."
**Backend parts:** Pleaser, Caretaker, Peacemaker, Minimizer, Optimist + Abandoned Child, Rejected Child, Unlovable One, Clinging One, Hiding One
**Cliffhanger:** The exile underneath the relational protection

### The Escape Artist
**Entry hook:** "There's a part of you that knows how to get some relief."
**Backend parts:** ALL 16 Firefighters
**Special requirement:** Opening screen uses NO shame framing. Safety card appears if Self-Harmer or Substance User responses are high (threshold: average ≥ 4.0 on relevant questions).

**Safety card copy:**
> "Some of what you described sounds intense. This kind of relief-seeking often points to something very painful underneath. You don't have to go there alone. [Link to resources / therapist prompt]"

**Cliffhanger:** What is being escaped?

### The Tender Places
**Entry hook:** "There are younger places inside you — parts that have been waiting."
**Backend parts:** ALL 17 Exiles + 2 special
**Special requirement:** Requires orienting screen before beginning. This assessment goes gently.

**Orienting screen copy:**
> "This part of your inner map tends to hold older, more tender material. You'll be guided through it gently. There's no pressure to go deeper than feels right."

**Therapy pointer** — appears ONCE in this assessment's cliffhanger ONLY:
> "The next step — meeting these parts with something other than protection — is work that often goes deepest with a guide. That's what IFS therapy is for."

**This is the ONLY place the therapy pointer appears in the entire app.**

### The Body Speaks
**Entry hook:** "Your body has been keeping the map."
**Backend parts:** Tension-Holder, Suppressor, Frozen One, Collapsed One, Trembling One, Physical-Agitator, Pain-Seeker, Sensation-Chaser
**Special feature:** Integrates body map silhouette — users indicate where sensations live in their body as they go

---

## Assessment Resumability

All assessments must be fully resumable:
- Save each response immediately to `assessment_sessions` table
- If user closes and returns, resume from last answered question
- Progress bar shows position through the current assessment
- Named parts from completed clusters are saved immediately — don't wait for assessment completion

---

## Backend Inference — NEVER Shown

The backend uses question responses to:
- Weight which clusters to emphasize in Phase 2
- Populate shadowed ghost nodes on the map
- Infer likely relational patterns for Phase 3 dynamic questions
- Place the unnamed exile shadow in Cluster D when warranted

All of this inference data is stored in `assessment_sessions.backend_inferences_json`. It is computational scaffolding only. No UI anywhere in the app references backend classification names.
