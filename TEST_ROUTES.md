# Test Routes for New Features

This document contains test routes to verify the new lat/long coordinate and DCT keyword support.

## Feature: Lat/Long Coordinates

### Test 1: Simple DDMM/DDDMM Format
```
KORD 4149/08736 KABQ
```
**Expected**: Chicago O'Hare → coordinate (41°49'N 87°36'W) → Albuquerque

### Test 2: DDMMSS/DDDMMSS Format (with seconds)
```
340730/1061530 KABQ
```
**Expected**: Coordinate (34°07'30"N 106°15'30"W) → Albuquerque

### Test 3: Random RNAV Route (Multiple Coordinates)
```
KDEN 3950/10430 3920/11200 KSLC
```
**Expected**: Denver → coordinate → coordinate → Salt Lake City

### Test 4: Mixed Route with Coordinates and Named Waypoints
```
KORD 4149/08736 3407/10615 KABQ
```
**Expected**: Chicago → coordinate → coordinate → Albuquerque

## Feature: DCT (Direct) Keyword

### Test 5: Simple DCT Route
```
KORD DCT IOW DCT KMSP
```
**Expected**: Chicago → direct to Iowa Falls (IOW VOR) → direct to Minneapolis
**Note**: DCT should be filtered out, route should work as: KORD IOW KMSP

### Test 6: Mixed DCT with Named Waypoints
```
KJFK DCT MERIT DCT EGLL
```
**Expected**: JFK → direct to MERIT VOR → direct to London Heathrow

### Test 7: DCT with Coordinates
```
KDEN DCT 3950/10430 DCT KSLC
```
**Expected**: Denver → coordinate → Salt Lake City

## Feature: ARTCC Waypoints (Already Supported)

### Test 8: ARTCC Fix (National Reference System waypoints)
```
KORD KA03W KABQ
```
**Expected**: Chicago → ARTCC waypoint KA03W → Albuquerque
**Note**: KA03W is a real ARTCC fix in NASR data (30°30'N, 104°00'W)

### Test 8b: More ARTCC Waypoints
```
KDEN KD36Q KD39S KSLC
```
**Expected**: Denver → ARTCC waypoint → ARTCC waypoint → Salt Lake City

### Test 8c: ARTCC Waypoint Examples
Real ARTCC waypoints that exist in NASR:
- **K-series**: KA03W, KA06W, KD36Q, KD39S, KL09G, KL12G
- **Named fixes**: MODAE, MODEM, MODGE (not MOD27 - that was a hypothetical example)

**Note**: The FAA tutorial examples (KP49G3, KD34U4, KL16O, MOD27) were hypothetical and don't exist in the actual NASR database

## Complex Routes

### Test 9: Everything Combined
```
KORD V44 SWANN DCT 3950/10430 DCT KSLC
```
**Expected**: Chicago → airway V44 → SWANN → coordinate → Salt Lake City

### Test 10: IFR-Style Route with Coordinates
```
KLAX 3350/11745 3407/10615 KABQ
```
**Expected**: Los Angeles → coordinate → coordinate → Albuquerque

## Testing Notes

1. All coordinates assume North/West hemisphere (US-centric) unless N/S/E/W suffix is provided
2. DCT keyword should be silently filtered out (it's implicit between waypoints)
3. ARTCC waypoints like KA03W, KA06W should already work (loaded from NASR FIX_BASE.csv)
4. Coordinates should display in the nav log with formatted lat/lon (e.g., "34°07'N 106°15'W")
5. Error messages should indicate "VERIFY WAYPOINT IDENTIFIERS OR COORDINATE FORMAT" for invalid inputs

## Bug Fixes Applied

- **Route Expander**: Updated to recognize lat/long coordinates and DCT keywords before database validation
- **Coordinate Validation**: Coordinates are now validated in the route expander before being passed to the calculator
- This prevents "Unknown token" errors for valid coordinate formats
