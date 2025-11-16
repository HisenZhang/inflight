# STATS Tab

Real-time flight monitoring, GPS tracking, and fuel calculations.

## Flight Status

**Large indicator at top:**

- **ON GROUND:** GPS < 40 knots or no GPS
- **IN FLIGHT:** GPS > 40 knots (auto-detected)

Automatic. No button to press.

## System Status

**Internet:** ONLINE / OFFLINE / CHECKING...

**GPS:** CHECKING... / ACTIVE / DENIED / UNAVAILABLE

**GPS H-ACC:** Horizontal accuracy (±feet) - lower is better

**GPS V-ACC:** Vertical accuracy (±feet) - lower is better

Typical in-flight: ±10-50 feet horizontal.

## Fuel Statistics

**Only shows if fuel planning enabled in ROUTE tab.**

**REM (Remaining):** Fuel left right now (gallons)

**ENDUR (Endurance):** How long you can fly on remaining fuel (H:MM)

**USED:** Fuel burned since takeoff (gallons)

**START:** Fuel on board at engine start (gallons)

**Auto-calculated** using:
- Flight time
- Burn rate from ROUTE tab
- Updates every second in flight

**Color coding:**
- Green: Remaining > reserve + 30 min
- Yellow: Remaining < reserve + 30 min
- Red: Remaining < reserve (land immediately)

**This is an estimate.** Always monitor actual fuel gauges.

## Flight Time & Performance

**TIME:** Flight duration since takeoff (HH:MM:SS)

**T/O:** Takeoff time (24-hour local time)

**AVG GS:** Average ground speed since takeoff (knots)

**DIST:** Total distance traveled from GPS track (nautical miles)

All auto-calculated from GPS data.

## GPS Track Recording

**Mode: AUTO (default) or MANUAL**

**AUTO mode:**
- Starts recording when airborne (>40kt)
- Stops when landed (<40kt for 10+ seconds)
- Zero pilot workload

**MANUAL mode:**
- Click **START** to begin recording
- Click **STOP** to end recording
- Use for ground testing or specific segments

**REC status:**
- INACTIVE: Not recording
- ACTIVE (red): Recording GPS track

**PTS (Points):** Number of GPS positions logged

**Buttons:**
- **EXPORT:** Download current track as GeoJSON file
- **CLEAR:** Delete current track (saved tracks stay in DATA tab)

Track format: GeoJSON LineString with timestamp, position, altitude, speed, heading, accuracy.

## Logbook Times

**Manual entry fields:**

**Hobbs Start/End:** Engine hour meter before/after flight

**Tach Start/End:** Tachometer reading before/after flight

**Totals auto-calculate:** END - START

Use these for logbook entries and maintenance tracking.

## How It All Works

**Takeoff detection:** GPS speed > 40 knots → starts flight timer and fuel tracking

**In-flight updates:** Every 1 second while flying

**Landing detection:** GPS speed < 40 knots for 10+ seconds → stops timer, saves track

**Track saved to:** localStorage (view/export in DATA tab)

**No internet required** except for initial database load.

## Typical Workflow

**Before flight:**
1. Verify GPS is ACTIVE
2. Enter Hobbs/Tach START
3. Set track mode (AUTO recommended)

**During flight:**
1. Monitor fuel remaining vs. ETE
2. Check track is recording (PTS increasing)
3. Glance at AVG GS for performance check

**After landing:**
1. Track stops automatically (AUTO mode)
2. Enter Hobbs/Tach END (totals auto-calculate)
3. Click EXPORT to save track
4. Check DIST and TIME for logbook

## Troubleshooting

**Flight status stuck ON GROUND:**
- Check GPS is ACTIVE
- Need >40kt ground speed
- Wait 5-10 seconds after takeoff

**No fuel stats:**
- Enable fuel planning in ROUTE tab
- Must have calculated route first

**Track not recording:**
- GPS must be ACTIVE
- AUTO mode: need >40kt to start
- MANUAL mode: click START button

**GPS accuracy poor (>100ft):**
- Move device to window
- Wait for better satellite lock
- Typical in-flight: ±10-50ft

---

**Monitor your flight in real-time.** All data updates automatically—just fly the airplane.
