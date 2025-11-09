# ARTCC Waypoints Guide

## What are ARTCC Waypoints?

ARTCC (Air Route Traffic Control Center) waypoints are part of the **National Reference System (NRS)** - a grid of computer navigation fixes used for RNAV navigation, especially at high altitudes (FL390+).

## Status in Your App

✅ **FULLY SUPPORTED** - These are already loaded from NASR FIX_BASE.csv as regular fixes.

## Real ARTCC Waypoints in NASR Database

### K-Series Waypoints (Western US Grid)

These follow a pattern of K + Letter + Number + Letter:

**KA-series** (around 30°N, 104°W - New Mexico/Texas):
- KA03W, KA06W, KA09Q, KA09U, KA09W, KA12O, KA12Q, KA12S, KA12U, KA12W

**KD-series** (around 36-60°N - Northern routes):
- KD36Q, KD39Q, KD39S, KD42Q, KD42S, KD42U, KD45Q, KD45S, KD45U, KD45W

**KL-series** (around LA/Pacific routes):
- KL09G, KL12G, KL15G, KL15I, KL15M, KL18E, KL18G, KL18I, KL18K

### Named ARTCC Waypoints

Regular named fixes that are part of ARTCC routes:
- MODAE, MODDA, MODDS, MODEE, MODEL, MODEM, MODGE, MODIE, MODIN, MODJY

## FAA Tutorial Examples (NOT in Database)

❌ The following examples from FAA training materials are **hypothetical** and don't exist in real NASR data:
- KP49G3 - Not found
- KD34U4 - Not found (but KD34U exists without the "4")
- KL16O - Not found (but KL15I, KL18E exist)
- MOD27 - Not found (but MODEM, MODGE exist)

## How to Use ARTCC Waypoints

### Example Routes

**Test with real ARTCC waypoints:**
```
KORD KA03W KABQ
```
(Chicago → ARTCC waypoint in New Mexico → Albuquerque)

```
KDEN KD36Q KD39S KSLC
```
(Denver → ARTCC waypoints → Salt Lake City)

**Mixed with coordinates:**
```
KLAX 3407/10615 KA03W KABQ
```
(Los Angeles → coordinate → ARTCC waypoint → Albuquerque)

## How to Find ARTCC Waypoints

1. They're loaded automatically from NASR FIX_BASE.csv
2. Type in the route input - autocomplete will show them
3. They appear as type "FIX" or "NRS" (National Reference System)
4. Most are 5 characters: K + Letter + 2 digits + Letter (e.g., KA03W, KD36Q)

## Why the Confusion?

The FAA Aeronautical Information Manual (AIM) uses **generic examples** for training purposes. These examples don't correspond to actual waypoint identifiers in the NASR database. The actual ARTCC waypoints follow a systematic naming convention based on their geographic grid position.

## Checking if a Waypoint Exists

Use the autocomplete feature in the app:
1. Start typing the waypoint identifier (e.g., "KA03")
2. If it exists, it will appear in the dropdown
3. If not found, try nearby grid positions (e.g., KA06W, KA09W instead of KA05W)
