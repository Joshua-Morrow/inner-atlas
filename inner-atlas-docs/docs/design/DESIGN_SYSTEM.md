# Inner Atlas — Design System

## Color System

### Part Type Colors
| Role | Hex | Usage |
|---|---|---|
| Manager (primary) | `#3B5BA5` | Node fill, badges |
| Manager (light) | `#EEF2FF` | Backgrounds, chips |
| Firefighter (primary) | `#C2600A` | Node fill, badges |
| Firefighter (light) | `#FFF7ED` | Backgrounds, chips |
| Exile (primary) | `#7C3D9B` | Node fill, badges |
| Exile (light) | `#F5F0FF` | Backgrounds, chips |
| Self (primary) | `#B88A00` | Node fill, orb, badges |
| Self (light) | `#FFFBEB` | Backgrounds, chips |

### App Neutrals
| Role | Hex |
|---|---|
| Background primary | `#FAFAF8` |
| Background secondary | `#F3F2EF` |
| Surface | `#FFFFFF` |
| Border | `#E5E3DE` |
| Text primary | `#1C1B19` |
| Text secondary | `#6B6860` |
| Text muted | `#A09D96` |

### Semantic Colors
| Role | Hex |
|---|---|
| Harmonious relationship | `#2D6A4F` |
| Conflicting / Polarized relationship | `#991B1B` |
| Protective relationship | `#1D4E89` |
| Neutral relationship | `#92400E` |

---

## Typography

| Scale | Size | Weight | Font | Notes |
|---|---|---|---|---|
| Display XL | 32px | Bold | Fraunces | App name, major feature headers |
| Heading 1 | 24px | Semibold | Inter | Screen titles |
| Heading 2 | 20px | Semibold | Inter | Section headers |
| Body | 16px | Regular | Inter | Line-height 1.6 |
| Caption | 13px | Regular | Inter | Color: text-secondary |
| Label | 12px | Medium | Inter | Uppercase tracking |
| Mono | 14px | Regular | JetBrains Mono | Question numbers, data |

---

## Node Shapes (Parts Map)

**Manager nodes:** Rounded rectangle — 12px border radius, solid type fill, white label text
- Default size: 80×48px
- Intensity scaling: +10% per intensity level above baseline

**Firefighter nodes:** Irregular starburst — 8-point star or jagged polygon using Skia path
- Default size: 72×72px

**Exile nodes:** Soft circle — perfect circle, slightly smaller than Manager
- Default size: 64×64px

**Self node:** Large octagon — 20% larger than part nodes, gold fill, radiant subtle glow
- Default size: 96×96px

**Shadowed/Undiscovered nodes:** Same shapes as above, but:
- Darkened fill (desaturated, ~40% opacity)
- Blurred edges (Skia blur filter)
- "Fog" layer covers the surrounding area
- Label shows only "?" or "Unknown — waiting to be known"

**Node indicators:**
- Elaborated: small filled dot, bottom-right corner
- Refined: small diamond outline, top-right corner
- Shadowed/inferred: no name shown, dimmed

---

## Relationship Line Styles

| Type | Color | Style | Spec |
|---|---|---|---|
| Harmonious | `#2D6A4F` | Solid | 3px solid |
| Conflicting/Polarized | `#991B1B` | Solid | 3px solid |
| Protective | `#1D4E89` | Dashed | 3px dashed, 8px dash / 4px gap |
| Neutral | `#92400E` | Dashed | 2px dashed, 6px dash / 3px gap |
| Inferred/Shadowed | Gray | Dotted | 1px dotted, trails into fog |

Arrow heads: Directed for protective lines, undirected for all others.

---

## Component Standards

- **Border radius:** 8px (cards), 12px (modals), 4px (buttons), 24px (pills/chips)
- **Shadow:** `0 2px 8px rgba(0,0,0,0.08)` for cards; `0 4px 20px rgba(0,0,0,0.12)` for modals
- **Spacing scale:** 4px base unit — multiples: 4, 8, 12, 16, 24, 32, 48, 64
- **Touch targets:** Minimum 44×44px on mobile for all interactive elements
- **Transitions:** 200ms ease for micro-interactions, 350ms ease for screen transitions
- **Loading states:** Skeleton screens (not spinners) for content-heavy views

---

## Navigation

Icon-only bottom tab bar on mobile. Icon-only left rail on desktop/web. No text labels by default. Tooltip on hover/long-press shows section name.

| Tab | Icon | Route |
|---|---|---|
| Dashboard | Home | /dashboard |
| Parts | Grid | /parts |
| Map | Network/nodes | /map |
| Dialogue | Chat bubbles | /dialogue |
| Practices | Leaf | /practices |
| Wiki | Book | /wiki |
| Profile | Person | /profile |

Active tab: icon fills with accent blue (`#3B5BA5`), small dot indicator below.

---

## Map Canvas Atmosphere

The parts map uses a **warm dark background** for the canvas area (not the rest of the app):
- Canvas background: `#1A1916` (warm near-black)
- Fog layer: radial gradient from `#1A1916` to `rgba(26,25,22,0.0)` — creates fog-of-war effect
- Node labels: white text on colored node fill
- Grid/ambient: very subtle warm grid lines at low opacity (optional, can be toggled off)
