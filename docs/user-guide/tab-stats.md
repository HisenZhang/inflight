# STATS Tab

The STATS tab monitors real-time flight statistics, system status, and GPS track recording.

## Overview

The STATS tab provides comprehensive flight monitoring including:
- Flight status and timing
- GPS and internet connectivity
- Fuel tracking (if fuel planning enabled)
- Flight time and distance
- GPS track recording controls
- Logbook time entry

## Flight Status

### Status Display

Large, prominent display at top of tab:

**ON GROUND** (Default):
- Aircraft not moving
- GPS shows < 30 knots ground speed
- Or GPS not active

**IN FLIGHT** (Automatic):
- Detected when ground speed > 30 knots
- Triggers automatic tracking
- Flight timer starts
- Fuel tracking begins (if enabled)

> 💡 **Automatic Detection**: No manual start required - system detects takeoff automatically

## System Status

### Internet Connectivity

Shows current internet status:

**ONLINE** (Green):
- Active internet connection
- Can fetch wind data
- AirNav links will work

**OFFLINE** (Red):
- No internet connection
- Cached data still works
- Cannot download winds
- Limited functionality

**CHECKING...** (Yellow):
- Initial status
- Testing connection
- Wait a few seconds

### GPS Status

**CHECKING...** (Yellow):
- Initializing GPS
- Waiting for permission
- Wait for status update

**ACTIVE** (Green):
- GPS successfully tracking
- Position updates available
- Accuracy being measured

**DENIED** (Red):
- Location permission denied
- GPS cannot activate
- See [MAP Tab](tab-map.md#gps-permission-denied) for fixing

**UNAVAILABLE** (Red):
- Device doesn't support GPS
- Browser too old
- Hardware issue

### GPS Accuracy

**GPS H-ACC** (Horizontal Accuracy):
```
±12 M    (Good)
±50 M    (Marginal)
±100 M   (Poor)
```

**GPS V-ACC** (Vertical Accuracy):
```
±18 M    (Good)
±50 M    (Marginal)
±100 M   (Poor)
```

Lower numbers = better accuracy.

## Fuel Statistics

Appears only when fuel planning is enabled in ROUTE tab.

### Fuel Card Display

**REM** (Remaining):
- Fuel currently remaining
- Updates in real-time during flight
- Example: `18.5 GAL`

**ENDUR** (Endurance):
- Flight time possible with remaining fuel
- Accounts for reserve requirement
- Example: `1:15` (1 hour 15 minutes)

**USED** (Fuel Used):
- Fuel burned since takeoff
- Cumulative total
- Example: `12.5 GAL`

**START** (Fuel on Board):
- Initial fuel at engine start
- Does not change during flight
- Reference value
- Example: `31.0 GAL`

### Fuel Tracking

**How It Works:**

1. Flight detected (>30 KT ground speed)
2. Timer starts
3. Fuel burn calculated: `(Time ÷ 60) × Burn Rate`
4. Remaining updated: `Start Fuel - Used Fuel`
5. Endurance calculated: `(Remaining - Reserve) ÷ Burn Rate × 60`

**Fuel Warnings:**

Low fuel situations are highlighted:

**Adequate** (Normal color):
- Fuel remaining > reserve + 30 minutes

**Low** (Yellow):
- Fuel remaining < reserve + 30 minutes
- Monitor closely

**Critical** (Red):
- Fuel remaining < reserve
- Land immediately
- Not enough fuel for legal flight

> ⚠️ **Important**: Fuel calculations are **estimates only**. Always monitor actual fuel gauges and follow aircraft procedures.

## Flight Time & Performance

### Flight Time

**TIME** (Flight Time):
- Time since takeoff detected
- HH:MM:SS format
- Example: `02:15:30` (2 hours, 15 minutes, 30 seconds)

**T/O** (Takeoff Time):
- Local time when flight started
- 24-hour format
- Example: `14:23` (2:23 PM)

### Performance Metrics

**AVG GS** (Average Ground Speed):
- Mean ground speed since takeoff
- Calculated from GPS data
- Example: `118 KT`
- Useful for fuel and time estimates

**DIST** (Distance Flown):
- Total distance traveled
- Calculated from GPS track
- Example: `234.5 NM`
- Great circle distance, not route distance

## GPS Track Recording

Controls for recording your flight path.

### Recording Modes

**AUTO** (Default):
- Automatically starts recording when airborne
- Stops when on ground
- No manual intervention required
- Recommended for most users

**MANUAL**:
- You control start/stop
- Click START button to begin recording
- Click STOP button to end recording
- Useful for ground testing or specific segments

**Toggle Mode:**
- Click **MANUAL** button to switch to manual mode
- Click **AUTO** button to return to automatic

### Recording Status

**REC** (Recording Status):

**INACTIVE** (Default):
- Not currently recording
- Waiting for takeoff (AUTO mode)
- Or waiting for START (MANUAL mode)

**ACTIVE** (Red):
- Currently recording GPS track
- Position being logged
- Points accumulating

**PTS** (Track Points):
- Number of GPS positions recorded
- Example: `1,247`
- More points = higher resolution track

### Manual Recording Controls

In MANUAL mode:

**START Button**:
- Begin recording GPS track
- Status changes to ACTIVE
- Points start accumulating

**STOP Button**:
- End recording
- Save track to storage
- Status returns to INACTIVE

> 💡 **Tip**: Use AUTO mode for normal operations - it handles everything automatically

### Track Management

**EXPORT Button**:
- Download current/last track as GPX file
- Opens save dialog
- File named with date/time

**CLEAR Button**:
- Delete current track points
- Does not delete saved tracks (see DATA tab)
- Confirmation required

**REFRESH** (implicit):
- Track automatically updates in real-time
- No manual refresh needed

## Logbook Times

Manual entry fields for recording aircraft times.

### Hobbs Time

Engine hour meter reading.

**HOBBS START**:
- Engine hour meter before flight
- Example: `2,456.3`

**HOBBS END**:
- Engine hour meter after flight
- Example: `2,459.5`

**HOBBS TOTAL**:
- Automatically calculated
- END - START
- Example: `3.2 HR`

### Tachometer Time

Engine tachometer reading.

**TACH START**:
- Tach reading before flight
- Example: `1,823.7`

**TACH END**:
- Tach reading after flight
- Example: `1,826.4`

**TACH TOTAL**:
- Automatically calculated
- END - START
- Example: `2.7 HR`

### Using Logbook Times

**Recording Procedure:**

1. Before flight: Record Hobbs and Tach START
2. After landing: Record Hobbs and Tach END
3. TOTAL automatically calculates
4. Use for logbook entries
5. Export track for additional records

**Logbook Entry:**
- Copy HOBBS TOTAL to logbook
- Or use TACH TOTAL if required
- Add to personal flight log
- Track for maintenance intervals

> 💡 **Tip**: Take photo of meters before/after flight as backup

## Real-Time Updates

The STATS tab updates automatically while visible:

**Update Frequencies:**
- Flight status: 1 second
- GPS accuracy: 2 seconds
- Fuel remaining: 1 second (during flight)
- Flight time: 1 second
- Track points: Per GPS update (~1-5 seconds)

**Background Updates:**
- Continue even when tab not visible
- Flight tracking persists
- Switch to other tabs freely

## Using STATS In-Flight

### Pre-Flight

1. Verify GPS is ACTIVE
2. Check internet if you need wind data
3. Enter HOBBS START and TACH START
4. Set track mode to AUTO (or prepare MANUAL)

### During Flight

1. Monitor fuel remaining (if enabled)
2. Check endurance vs. ETE
3. Verify track is recording (PTS increasing)
4. Glance at AVG GS for performance check

### Post-Flight

1. Verify recording stopped (AUTO mode)
2. Enter HOBBS END and TACH END
3. Note HOBBS TOTAL for logbook
4. Click EXPORT to save track
5. Clear track if desired (or keep for DATA tab)

## Exporting Tracks

GPX export for use in other applications.

**GPX Format Includes:**
- GPS coordinates (lat/lon)
- Timestamps
- Altitude (if available)
- Track metadata

**Compatible With:**
- ForeFlight
- Garmin Pilot
- Google Earth
- Strava / Fitness apps
- GPX viewers
- Flight analysis software

**Export Process:**

1. Click **EXPORT** button
2. Save dialog appears
3. Choose location/name
4. File downloads: `track_20251115_142300.gpx`

## Track Storage

**Current Track:**
- Held in memory during flight
- Persists until cleared or page reload

**Saved Tracks:**
- Automatically saved to IndexedDB when flight ends
- View and manage in DATA tab
- Multiple flights stored
- Export individually from DATA tab

## Troubleshooting

### Flight Status Stuck on "ON GROUND"

**Problem**: Status doesn't change to IN FLIGHT

**Solutions:**
1. Check GPS is ACTIVE
2. Verify ground speed > 30 KT
3. May take 5-10 seconds after takeoff
4. Ensure GPS has clear sky view

### Fuel Not Showing

**Problem**: No fuel statistics displayed

**Solutions:**
1. Fuel planning must be enabled in ROUTE tab
2. Route must be calculated
3. Wind correction also required (for time calc)
4. Reload route and enable options

### Track Not Recording

**Problem**: Points stay at 0

**Solutions:**
1. Check GPS is ACTIVE
2. Verify recording status is ACTIVE
3. In MANUAL mode, click START
4. In AUTO mode, ensure airborne (>30 KT)
5. Check browser permissions

### Hobbs/Tach Totals Wrong

**Problem**: Calculated totals incorrect

**Solutions:**
1. Check START value is less than END value
2. Verify decimal placement
3. Re-enter values carefully
4. Clear and re-enter if needed

### Export Fails

**Problem**: GPX export doesn't work

**Solutions:**
1. Check browser allows downloads
2. Verify track has points (PTS > 0)
3. Try different browser
4. Check disk space

## Advanced Features

### Flight Detection Sensitivity

**Takeoff Threshold**: 30 knots ground speed
**Landing Threshold**: < 30 knots for 10 seconds

**Prevents False Triggers:**
- Taxi operations don't start flight
- Brief slowdowns don't end flight
- Robust against GPS noise

### Track Resolution

**Point Recording:**
- New point every GPS update
- Typically 1-5 seconds
- Higher frequency = better track detail
- More storage used

**Optimization:**
- Points with insufficient movement filtered
- Reduces file size
- Maintains track accuracy

## Best Practices

1. **Check GPS before flight** - Ensure ACTIVE status
2. **Use AUTO mode** - Less workload in cockpit
3. **Monitor fuel closely** - Don't rely solely on estimates
4. **Record Hobbs/Tach** - Habit for every flight
5. **Export tracks regularly** - Backup before clearing
6. **Verify track recording** - Check PTS incrementing
7. **Don't fixate on screen** - Quick glances only

## Privacy & Data

**What's Stored:**
- GPS coordinates and times
- Flight statistics
- Hobbs/Tach entries

**What's NOT Stored:**
- No personal information
- No server uploads
- All data local to device

**Sharing:**
- GPX exports contain only GPS data
- No identifying information
- Safe to share publicly

## Next Steps

- **[Flight Recording Guide](features/flight-recording.md)** - Advanced track features
- **[Data Management](tab-data.md)** - Managing saved tracks
- **[GPS Tracking](features/gps-tracking.md)** - Understanding GPS data

---

**Monitor your flight in real-time and track your progress with the STATS tab!**
