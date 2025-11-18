# IN-FLIGHT User Guide

**Free, offline-capable flight planning and navigation for VFR and IFR pilots.**

IN-FLIGHT is a web-based flight planning tool that generates navigation logs and tracks GPS position—no subscriptions, no account required, works offline after initial setup.

> **DISCLAIMER**
> This is a flight planning tool, not a certified navigation system. Use it for planning and backup, not as your primary navigation source. Always verify routes and data against current charts and NOTAMs.

## What It Does

- Parses IFR route syntax (airways, SIDs, STARs, DPs)
- Generates navigation logs with magnetic courses, distances, ETEs
- Displays GPS moving map with auto-waypoint advancement
- Calculates fuel burn with multi-altitude wind interpolation
- Works offline after initial database load (70,000+ airports, 10,000+ navaids)

**What it's NOT:** An approach plate viewer, weather briefing tool, or certified GPS. Bring your own charts and weather.

## Quick Start

1. **[Load the database](tab-data)** (one-time, ~5MB)
2. **[Enter a route](tab-route)** like `KISP APE EWC ETG J217 HNK STELA1 KBDL`
3. **Hit COMPUTE** to expand airways and procedures
4. **[Review navlog](tab-navlog)** with courses, distances, fuel
5. GPS auto-enables when you grant location permissions

## Common Use Cases

### VFR Cross-Country Planning

- Verify hand-calculated headings and distances
- Run what-if scenarios with different altitudes
- Get accurate ground speeds with interpolated winds
- Print or save navlogs for reference

### IFR Route Planning

Enter routes using standard FMS syntax:
```
KBOS PAYGE SSOXS V3 SAX J57 LRP LENDY6 KLGA
```

COMPUTE expands SIDs, airways, and STARs into a full navlog with fuel and time calculations. Edit the route string for ATC reroutes—no clicking through menus.

**Note:** For filing IFR, you typically file the route as-is (e.g., `KBOS PAYGE3 V3 SAX J57 LENDY6 KLGA`). IN-FLIGHT expands procedures to show you every waypoint for situational awareness and navlog generation.

### Training Aid

Practice FMS route entry syntax without sim time. Context-aware autocomplete shows only relevant airways/fixes based on your current position in the route.

### Backup Navigation

Install as a PWA for offline access. If your primary EFB fails, you still have navlog and moving map.

## Key Features

**Context-Aware Autocomplete:** After typing a fix, see only airways from that fix. After typing an airway, see only fixes on that airway. Same logic as FMS autocomplete.

**Multi-Altitude Wind Interpolation:** Climbing through multiple altitudes on a leg? IN-FLIGHT calculates blended wind for accurate ground speed and fuel burn.

**Automatic Flight Logging:** GPS auto-detects takeoff (>50 kts), logs track with timestamps, detects landing (<30 kts). Exports as GeoJSON.

**Auto-Waypoint Advancement:** Moving map advances to next leg when passing abeam waypoint. Optional text-to-speech announcements.

**One-Tap Diversions:** Click any airport for instant route, fuel remaining, and ETA from current position.

## Detailed Guides

- **[ROUTE Tab](tab-route)** - Route entry syntax and autocomplete
- **[NAVLOG Tab](tab-navlog)** - Navigation log and fuel calculations
- **[MAP Tab](tab-map)** - GPS moving map and tracking
- **[DATA Tab](tab-data)** - Database management and flight exports
- **[CHKLST Tab](tab-chklst)** - Customizable checklists
- **[STATS Tab](tab-stats)** - Flight statistics

## Requirements & Limitations

**Required:**
- Modern browser (Chrome/Firefox/Safari/Edge)
- Internet for initial database load (~5MB, one-time)
- Location permission for GPS features

**Data Coverage:**
- 70,000+ airports, 10,000+ navaids (global)
- US domestic procedures (SIDs/STARs/DPs)
- No oceanic routes or NAT tracks

**Not Included:**
- Approach plates (use FAA charts/ForeFlight)
- NOTAMs/TFRs (check official sources)
- Weather imagery (use AWC/ForeFlight)
- Weight & balance

**Important:** Aviation data is not AIRAC-cycle certified. Always verify against current charts.

## Troubleshooting

- **[FAQ](faq)** - Common questions
- **[Troubleshooting Guide](troubleshooting)** - Technical issues
- **[GitHub Issues](https://github.com/HisenZhang/inflight/issues)** - Bug reports

**Ready to fly?** → **[Load the database](tab-data)** and start planning.
