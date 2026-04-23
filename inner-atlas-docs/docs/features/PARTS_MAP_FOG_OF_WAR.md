# Inner Atlas — Parts Map: Fog of War

## Visual Design

Background: #1A1917 (warm dark, not pure black)

### Discovered Nodes
- Glow in type color (Manager=indigo, Firefighter=amber, Exile=violet, Self=gold)
- Display USER'S CHOSEN NAME (never backend classification)
- Size scales with intensity: base + (intensity * 4px)
- Small indicator badges: elaborated (filled dot, bottom-right), refined (diamond, top-right)

### Shadowed Nodes (in fog)
- Desaturated, semi-transparent type color
- No label text
- Slow pulsing animation (4s cycle)

### Unnamed Exile (from Cluster D)
- Slightly brighter than other shadows
- Label: "Unknown — waiting to be known"
- Faster pulse (2s cycle)

### Self Node
- Gold octagon, 20% larger, radiant glow
- Always at canvas center (z-index above all)

### Fog Effect
- Covers 60-70% of canvas after First Mapping Assessment
- Warm dark gradient, lifts per-region as mini-assessments complete
- Rendered as gradient layer above canvas, below UI controls

### Relationship Lines
- Harmonious: 3px solid #2D6A4F
- Conflicting: 3px solid #991B1B
- Protective: 3px dashed #1D4E89 (directed arrow toward protected)
- Neutral: 2px dashed #92400E
- Inferred (from Phase 3): same style but 50% opacity

## Layout

Initial: Self at center. Managers upper-left, Firefighters lower-right, Exiles lower-left.
Force-directed spring within quadrants. Min node distance: 120px.
Stored x/y positions override auto-layout on subsequent loads.
"Reset Layout" button re-runs auto-layout.

## Gestures

- Pinch: zoom (0.5x-3x)
- Two-finger pan: move viewport
- Tap named node: Part Profile (bottom sheet mobile / right panel desktop)
- Tap shadowed node: "This part hasn't been discovered yet. [Mini-assessment] can reveal what's here."
- Long-press: enter drag mode for repositioning
- Tap+hold one node, tap another: opens relationship creator sheet
- Tap relationship line: edit/delete sheet

## Persistent UI

- Bottom-left: legend card (collapsible)
- Top-right: Self Access orb (gold, shows Self-energy %)
- Bottom-right: "[X] parts in your system / Your system is larger than this map"
- Bottom: "Explore the fog" button (animated gradient, appears after First Mapping complete)

## Technical Notes

Canvas: React Native Skia
- Skia for: background, fog gradient, node shapes (especially starburst), lines, glows
- Gesture Handler for: pan, pinch, tap, long-press
Force layout: D3-force simulation only (no DOM) -> positions applied to Skia canvas
Performance: parts map with 15+ nodes must render without lag on iPhone 11 era hardware
