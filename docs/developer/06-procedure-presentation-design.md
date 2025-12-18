# Procedure Presentation Design - IN-FLIGHT

## Overview

This document outlines how to present **SIDs, STARs, and Approaches** in IN-FLIGHT using the CIFP data we now have available.

---

## Current State

### What We Have (CIFP Data Already Parsed)

```javascript
window.App.cifpData = {
    sids: Map,       // ~2,000 SID procedures
    stars: Map,      // ~2,000 STAR procedures
    approaches: Map  // ~5,000 approach procedures
};

// Example SID structure
{
    airport: "KSEA",
    ident: "HAROB3",
    transition: "HAROB",
    waypoints: [
        { ident: "HAROB", seqNum: 10, pathTerminator: "IF" },
        { ident: "ISBRG", seqNum: 20, pathTerminator: "TF" },
        { ident: "JAWBN", seqNum: 30, pathTerminator: "TF" }
    ]
}
```

### What Users Need

Pilots use procedures for **three main scenarios**:

1. **Route Planning** - Select SID/STAR before flight
2. **En Route Reference** - View procedure on map during flight
3. **Approach Briefing** - Study approach plate before landing

---

## Design Philosophy

### Core Principles

1. **Non-Intrusive** - Procedures are **reference only**, not automatic insertion
2. **Context-Aware** - Show procedures relevant to current route/position
3. **Layered Display** - Procedures overlay on map, don't clutter route
4. **Tap to View** - User chooses when to see procedure details

### UI Location Options

| Location | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **MAP tab** | Natural for visualization | Limited space | ✅ **Best - overlay mode** |
| **PLAN tab** | Route planning context | No map visualization | ✅ **Good - selector only** |
| **DATA tab** | Technical info | Not discovery-friendly | ❌ Not recommended |
| New **PROC tab** | Dedicated space | Adds tab complexity | 🟡 Optional future |

---

## Recommended Implementation

### Phase 1: MAP Tab Overlay (MVP)

**Add procedure overlay toggle to MAP tab**

```
┌─────────────────────────────────────────────────────┐
│ [FULL] [DEST] [50NM] [25NM] [5NM]   🔧 ▼           │  ← Existing zoom bar
│                                                     │
│  ┌────────────────────────────────────┐            │
│  │         Vector Map (SVG)           │            │
│  │                                    │            │
│  │   [Route with waypoints]          │            │
│  │                                    │            │
│  │   👆 Tap airport to see          │            │
│  │      available procedures         │            │
│  └────────────────────────────────────┘            │
│                                                     │
│  🔘 PIREPS  🔘 SIGMETS  🔘 MORA  🔘 PROC     │  ← Add toggle
└─────────────────────────────────────────────────────┘
```

**Interaction Flow:**

1. **Enable Procedures** - Toggle "PROC" checkbox (like MORA/weather)
2. **Tap Airport** - Tap destination airport icon on map
3. **Procedure Menu** - Modal shows available SIDs/STARs/Approaches
4. **Select & View** - Procedure overlays on map with waypoints/path

---

### Phase 2: PLAN Tab Integration

**Add procedure selector in route input area**

```
┌─────────────────────────────────────────────────────┐
│ ROUTE                                               │
│ ┌─────────────────────────────────────────────┐    │
│ │ KSEA HAROB3.HAROB KSEA J1 BTG KPDX          │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ DEPARTURE PROCEDURES (KSEA)                        │
│ ┌─────────────────────────────────────────────┐    │
│ │ Select SID: [NONE ▼]                        │    │
│ │  ⚬ HAROB3 (HAROB, JAWBN, ISBRG transitions) │    │
│ │  ⚬ SUMMA7 (SUMMA, BANGR, OZETT transitions) │    │
│ │  ⚬ ELMAA2 (ELMAA transition)                │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ ARRIVAL PROCEDURES (KPDX)                          │
│ ┌─────────────────────────────────────────────┐    │
│ │ Select STAR: [NONE ▼]                       │    │
│ │  ⚬ WHAMY4 (COUGA, HRMNS transitions)        │    │
│ │  ⚬ LAVAA3 (BTG, KRATR transitions)          │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ [CALCULATE ROUTE]                                  │
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- **Auto-detect** departure/arrival airports from route
- **List available** procedures from CIFP data
- **Insert waypoints** into route string when selected
- **Show on map** when MAP tab is active

---

## Procedure Display Styles

### SID Visualization

```svg
<!-- SID: Departure path from runway to entry fix -->
<g id="procedure-sid" opacity="0.7">
    <!-- Runway start (bold) -->
    <circle cx="100" cy="200" r="8" fill="#00ff00" stroke="#003300" stroke-width="2"/>
    <text class="proc-label">RWY16L</text>

    <!-- Waypoints (hollow circles) -->
    <circle cx="150" cy="150" r="6" fill="none" stroke="#00ff00" stroke-width="2"/>
    <text class="proc-label">HAROB</text>

    <circle cx="200" cy="100" r="6" fill="none" stroke="#00ff00" stroke-width="2"/>
    <text class="proc-label">ISBRG</text>

    <!-- Path (dashed green line) -->
    <path d="M 100,200 L 150,150 L 200,100"
          stroke="#00ff00"
          stroke-width="3"
          stroke-dasharray="8,4"
          fill="none"/>
</g>
```

**Style Guide:**
- **Color:** Green (`#00ff00` with `#003300` dark outline)
- **Line:** Dashed (8px dash, 4px gap)
- **Waypoints:** Hollow circles (6px radius)
- **Labels:** Small text above waypoint
- **Opacity:** 0.7 (semi-transparent to not hide route)

---

### STAR Visualization

```svg
<!-- STAR: Arrival path from entry fix to final approach fix -->
<g id="procedure-star" opacity="0.7">
    <!-- Entry fix (hollow circle) -->
    <circle cx="100" cy="100" r="6" fill="none" stroke="#00aaff" stroke-width="2"/>
    <text class="proc-label">KRATR</text>

    <!-- Intermediate fixes -->
    <circle cx="150" cy="150" r="6" fill="none" stroke="#00aaff" stroke-width="2"/>
    <text class="proc-label">WHAMY</text>

    <!-- Final approach fix (solid) -->
    <circle cx="200" cy="200" r="8" fill="#00aaff" stroke="#003366" stroke-width="2"/>
    <text class="proc-label">FAF</text>

    <!-- Path (dashed blue line) -->
    <path d="M 100,100 L 150,150 L 200,200"
          stroke="#00aaff"
          stroke-width="3"
          stroke-dasharray="8,4"
          fill="none"/>
</g>
```

**Style Guide:**
- **Color:** Cyan (`#00aaff` with `#003366` dark outline)
- **Line:** Dashed (8px dash, 4px gap)
- **Waypoints:** Hollow circles (6px radius)
- **FAF:** Solid circle (8px radius) to mark final approach fix
- **Opacity:** 0.7

---

### Approach Visualization

```svg
<!-- Approach: Final approach from FAF to runway -->
<g id="procedure-approach" opacity="0.8">
    <!-- FAF (solid magenta) -->
    <circle cx="100" cy="100" r="8" fill="#ff00ff" stroke="#660066" stroke-width="2"/>
    <text class="proc-label">ISEAT (FAF)</text>
    <text class="proc-alt">3000↓</text>  <!-- Altitude constraint -->

    <!-- Step-down fix -->
    <circle cx="150" cy="150" r="6" fill="none" stroke="#ff00ff" stroke-width="2"/>
    <text class="proc-label">CFBGD</text>
    <text class="proc-alt">2100↓</text>

    <!-- Runway threshold (solid) -->
    <circle cx="200" cy="200" r="10" fill="#ff00ff" stroke="#660066" stroke-width="3"/>
    <text class="proc-label">RWY16L</text>
    <text class="proc-alt">DA 423'</text>

    <!-- Path (solid magenta line - final approach is precise) -->
    <path d="M 100,100 L 150,150 L 200,200"
          stroke="#ff00ff"
          stroke-width="4"
          fill="none"/>

    <!-- Glide slope indicator (optional for ILS) -->
    <path d="M 100,100 L 200,200"
          stroke="#ff00ff"
          stroke-width="1"
          stroke-dasharray="2,2"
          opacity="0.5"/>
</g>
```

**Style Guide:**
- **Color:** Magenta (`#ff00ff` with `#660066` dark outline)
- **Line:** Solid (precision approach) or Dashed (non-precision)
- **Altitude:** Show constraints next to waypoints
- **FAF/MAP:** Bold markers (Final Approach Fix, Missed Approach Point)
- **Opacity:** 0.8 (slightly more visible than SID/STAR)

---

## Procedure Selector Modal

### Design (Mobile-First)

```
┌───────────────────────────────────────────────┐
│  PROCEDURES - KSEA (Seattle-Tacoma Intl)  ✕  │
├───────────────────────────────────────────────┤
│                                               │
│  🛫 DEPARTURE PROCEDURES (SIDs)              │
│  ┌─────────────────────────────────────────┐ │
│  │ ⚬ HAROB3 - via HAROB, JAWBN, ISBRG     │ │
│  │ ⚬ SUMMA7 - via SUMMA, BANGR, OZETT     │ │
│  │ ⚬ ELMAA2 - via ELMAA                   │ │
│  │ ⚬ SEATT9 - via SEATT                   │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  🛬 ARRIVAL PROCEDURES (STARs)               │
│  ┌─────────────────────────────────────────┐ │
│  │ ⚬ KRATR2 - via BTG, COUGA              │ │
│  │ ⚬ BANGR4 - via BANGR                   │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  🛬 APPROACHES                                │
│  ┌─────────────────────────────────────────┐ │
│  │ ⚬ ILS or LOC RWY 16L (I16L)            │ │
│  │ ⚬ ILS or LOC RWY 16R (I16R)            │ │
│  │ ⚬ RNAV (GPS) RWY 16C (R16C)            │ │
│  │ ⚬ VOR RWY 16L (V16L)                   │ │
│  │ (Showing 4 of 12 approaches)  [MORE...] │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  [HIDE PROCEDURES]  [COPY PROCEDURE NAME]    │
└───────────────────────────────────────────────┘
```

**Interaction:**
- **Tap procedure** → Highlights on map (dashed overlay)
- **Tap again** → Deselects and hides overlay
- **Copy name** → Copies procedure ID (e.g., "HAROB3") to clipboard for route input

---

## Implementation Roadmap

### MVP (Minimal Viable Product) - 2-3 Days

**Goal:** Show procedures on map for situational awareness

1. ✅ Add "PROC" toggle to MAP tab (like MORA toggle)
2. ✅ Add tap handler for airport icons
3. ✅ Build procedure selector modal
4. ✅ Draw SID/STAR/Approach overlays (basic lines + waypoints)
5. ✅ Color-code by type (Green=SID, Cyan=STAR, Magenta=Approach)

**Files to modify:**
- [display/map-display.js](../../display/map-display.js) - Add `drawProcedures()` function
- [index.html](../../index.html) - Add procedure toggle + modal HTML
- [styles.css](../../styles.css) - Add procedure overlay styles

---

### Phase 2 (Enhanced) - 1 Week

**Goal:** Add route planning integration

1. ✅ Add procedure selectors to PLAN tab
2. ✅ Auto-detect departure/arrival airports
3. ✅ Insert procedure waypoints into route
4. ✅ Show altitude constraints on approach
5. ✅ Add missed approach procedure

---

### Phase 3 (Advanced) - 2 Weeks

**Goal:** Full path terminator engine

1. ⬜ Implement path terminator decoder (TF, RF, CF, IF, etc.)
2. ⬜ Draw curved paths (RF legs - Radius to Fix)
3. ⬜ Draw holding patterns (HA, HF, HM legs)
4. ⬜ Show course/altitude restrictions
5. ⬜ Add vertical profile view (optional)

---

## Path Terminator Reference

CIFP procedures use **ARINC 424 path terminators** to define leg geometry:

| Code | Type | Description | Complexity |
|------|------|-------------|------------|
| **IF** | Initial Fix | Procedure start point | ⭐ Easy |
| **TF** | Track to Fix | Direct to waypoint | ⭐ Easy |
| **CF** | Course to Fix | Fly heading to waypoint | ⭐⭐ Medium |
| **DF** | Direct to Fix | Direct (redundant with TF) | ⭐ Easy |
| **RF** | Radius to Fix | **Curved path** (RNAV only) | ⭐⭐⭐⭐⭐ Hard |
| **AF** | Arc to Fix | DME arc | ⭐⭐⭐ Medium |
| **CA** | Course to Altitude | Climb on heading | ⭐⭐ Medium |
| **FA** | Fix to Altitude | Climb to altitude | ⭐⭐ Medium |
| **FM** | Fix to Manual | Vectors expected | ⭐ Easy |
| **VM** | Heading to Manual | Fly heading (vectors) | ⭐⭐ Medium |
| **HA/HF/HM** | Holding patterns | Various holding types | ⭐⭐⭐⭐ Hard |

**MVP Implementation:**
- Support: IF, TF, DF (straight lines only)
- Display: "⚠ Advanced path" for RF, AF, HA, HF, HM

**Future:**
- Decode all path terminators
- Draw curved paths (RF requires arc math)
- Render holding patterns

---

## Accessibility & Mobile Considerations

### Touch Targets

- **Procedure toggle:** 48×48px minimum (fat finger friendly)
- **Airport tap:** 60px radius around icon
- **Procedure list items:** 56px height

### Performance

- **Layer rendering:** Procedures in separate SVG `<g>` layer
- **Conditional display:** Only show when toggle enabled
- **Viewport culling:** Don't render procedures outside bounds

### Offline Support

- **All procedure data cached** in IndexedDB (via CIFP)
- **No external requests** for procedure display
- **Works in airplane mode** ✈

---

## Summary: Recommended Approach

### Start With (MVP - Weekend Project)

1. Add **"PROC" toggle** to MAP tab
2. **Tap airport** → Show modal with procedures
3. **Select procedure** → Draw on map (simple lines)
4. **Color-code:** Green (SID), Cyan (STAR), Magenta (Approach)

### Add Later (Phase 2)

5. PLAN tab procedure selectors
6. Auto-insert waypoints into route
7. Altitude constraints display

### Future (Phase 3)

8. Path terminator engine (RF, HA, HF)
9. Curved paths and holding patterns
10. Vertical profile view

---

**This gets procedures visible quickly, then iteratively improves the experience!**

---

*Last Updated: 2025-12-08*
*IN-FLIGHT v3.5+ (CIFP Procedures)*
