# MAP Tab

The MAP tab displays a moving map with real-time GPS tracking and tactical navigation guidance.

## Overview

The MAP tab provides a vector-based tactical display showing:
- Your planned route
- Current GPS position (when enabled)
- Waypoints with color-coded markers
- Real-time navigation guidance
- Distance rings and bearings
- Automatic waypoint progression

## Map Display

### Route Visualization

The map shows your complete route with:

**Waypoint Markers:**
- **Cyan circles** = Airports
- **Magenta circles** = Navaids
- **White circles** = Fixes
- **Amber circles** = Reporting points

**Route Lines:**
- **Solid white lines** = Your flight path
- Connects waypoints in sequence
- Shows planned ground track

**Waypoint Labels:**
- Code displayed next to each marker
- Type information (AIRPORT, VOR, FIX)
- Elevation (for airports)

### GPS Position Indicator

When GPS is enabled:

**Aircraft Symbol:**
- **Green triangle** pointing in direction of travel
- Real-time position updates
- Leaves track trail (dotted line)

**Accuracy Circle:**
- Blue circle around aircraft
- Radius = horizontal GPS accuracy
- Smaller = better accuracy

**Current Leg Indicator:**
- **Yellow line** from aircraft to next waypoint
- Shows required ground track

## Zoom Controls

Located at top of map display.

### Preset Zoom Modes

**ROUTE** (default):
- Shows entire route from departure to destination
- Best for overview and flight planning

**DEST**:
- Zooms to destination airport area
- Shows local waypoints and route terminus
- Useful for approach planning

**50NM**:
- Tactical view: 50 NM radius around aircraft
- Good for enroute navigation
- Shows upcoming waypoints

**25NM**:
- Close tactical view: 25 NM radius
- Best for terminal area navigation
- High detail around position

### Manual Zoom

**+ Button**:
- Zoom in (increase detail)
- Up to 5x magnification

**− Button**:
- Zoom out (decrease detail)
- Back to preset levels

> 💡 **Tip**: Use 50NM or 25NM during flight for best situational awareness

## GPS Tracking

### Enabling GPS

**First Time:**
1. Browser will request location permission
2. Click "Allow" or "Grant Permission"
3. GPS icon shows "ACTIVE"

**Subsequent Uses:**
- GPS activates automatically when you view MAP tab
- No permission required if previously granted

### GPS Status Indicators

**CHECKING...** (Yellow):
- Requesting permission or initializing
- Wait a few seconds

**ACTIVE** (Green):
- GPS successfully tracking
- Position updating in real-time

**DENIED** (Red):
- Location permission denied
- Go to browser settings to enable
- Instructions in [Troubleshooting](#gps-permission-denied)

**UNAVAILABLE** (Red):
- Device doesn't support GPS
- Browser doesn't support Geolocation API
- Use desktop browser or GPS-enabled device

## Navigation Panel

The navigation panel at the bottom shows real-time guidance.

### Primary Row (Large Display)

| Field | Description | Example |
|-------|-------------|---------|
| **WPT** | Next waypoint code | `KORD` |
| **HDG** | Required magnetic heading | `268°` |
| **DIST** | Distance to next waypoint | `45.2 NM` |
| **ETE** | Estimated time enroute | `23 MIN` |

### Secondary Row (Small Display)

| Field | Description | Example |
|-------|-------------|---------|
| **GS** | GPS ground speed | `118 KT` |
| **ETA** | Estimated time of arrival | `14:23Z` |
| **H-ACC** | Horizontal GPS accuracy | `±12 M` |
| **V-ACC** | Vertical GPS accuracy | `±18 M` |

### Navigation Buttons

**◄ PREV**:
- Manually go to previous waypoint
- Updates guidance to that leg
- Useful for missed approaches or re-routing

**NEXT ►**:
- Manually advance to next waypoint
- Updates guidance to that leg
- Useful for skipping waypoints

> 💡 **Automatic Progression**: The map auto-advances when within 2 NM of next waypoint

## Waypoint Interaction

### Clicking Waypoints

Click any waypoint marker to see details:

**Popup Shows:**
- Waypoint code and type
- Position (lat/lon)
- Elevation (if applicable)
- Frequencies (if airport/navaid)

**For Route Waypoints:**
- **DCT** button: Set as next waypoint (go-direct)
- Updates navigation panel
- GPS guidance changes to new target

### Going Direct

To divert to a waypoint:

1. Click waypoint on map
2. Click **DCT** button in popup
3. Navigation updates to direct course
4. GPS guides you to new target

Clears diversion: Use PREV/NEXT buttons to return to planned route

## Waypoint Passage Features

When you pass within 2 NM of the next waypoint (automatic):

### Haptic Feedback

**Device Vibrates:**
- Two short pulses (100ms each)
- Separated by 50ms pause
- Works on mobile devices that support vibration

**When It Triggers:**
- Approaching threshold (2 NM)
- Auto-advances to next leg
- Only on proximity-based switching (not manual)

### Voice Announcements

**Text-to-Speech (TTS) Announces:**

Example announcement:
> "Approaching K A L B. Next waypoint K O R D, heading 0 9 0, distance 45 nautical miles, E T E 23 minutes"

**Announcement Includes:**
- Waypoint just passed (spelled out)
- Next waypoint (spelled out)
- Magnetic heading (digit by digit with leading zeros)
- Distance in nautical miles
- ETE if available (omitted if wind correction disabled)

**Heading Format:**
- 90° announced as "0 9 0"
- 270° announced as "2 7 0"
- 5° announced as "0 0 5"

This matches standard aviation phraseology.

**Voice Settings:**
- Uses system default TTS voice
- Rate: 1.0 (normal speed)
- Volume: 1.0 (maximum)
- Cannot be customized currently

> 💡 **Tip**: Adjust device volume before flight to comfortable level

### Disabling Announcements

Currently not configurable in UI. To disable:
- Mute device volume
- Use browser settings to block TTS
- Feature roadmap: Add toggle in settings

## Understanding GPS Data

### Horizontal Accuracy (H-ACC)

Indicates GPS position uncertainty.

**Good Accuracy:**
```
H-ACC: ±5 M    (Excellent - differential GPS)
H-ACC: ±12 M   (Good - clear sky)
H-ACC: ±25 M   (Acceptable)
```

**Poor Accuracy:**
```
H-ACC: ±50 M   (Marginal - some obstruction)
H-ACC: ±100 M+ (Poor - buildings/trees)
```

**Factors Affecting Accuracy:**
- Satellite count and geometry
- Atmospheric conditions
- Urban canyons / buildings
- Tree cover
- Device quality

### Vertical Accuracy (V-ACC)

Altitude accuracy from GPS.

**Typical Values:**
```
V-ACC: ±10 M   (Excellent)
V-ACC: ±25 M   (Good)
V-ACC: ±50 M   (Acceptable)
V-ACC: ±100 M+ (Poor)
```

> ⚠️ **Important**: GPS altitude is **NOT** approved for vertical navigation. Use barometric altimeter for altitude.

### Ground Speed (GS)

Derived from GPS position changes.

**Accuracy:**
- Very accurate when moving
- May show 0-5 KT when stationary (GPS jitter)
- Updates every 1-5 seconds

**Uses:**
- Verify TAS and wind calculations
- Monitor actual vs. planned performance
- Calculate actual ETE to waypoint

## Map Features

### Distance Rings

Concentric circles around waypoints (in 50NM and 25NM modes):
- Help judge distances visually
- Scale adjusts with zoom level
- Grayed out for minimal distraction

### Bearing Lines

Radial lines from waypoints (in DEST mode):
- Show cardinal directions
- Help orient map mentally
- Useful for visual approaches

### Track Trail

Your GPS history displayed as dotted line:
- Shows where you've been
- Helps identify drift/deviation
- Automatically recorded in STATS tab

## Tactical Scenarios

### Enroute Navigation

**Best Settings:**
- Zoom: **50NM** or **25NM**
- Keep navigation panel visible
- Monitor HDG and DIST

**What to Watch:**
- Cross-track error (offset from yellow line)
- Upcoming waypoints
- Required heading changes

### Terminal Area

**Best Settings:**
- Zoom: **25NM** or manual zoom in
- Switch to DEST for approach view

**What to Watch:**
- Airport position relative to aircraft
- Local waypoints (fixes, navaids)
- Pattern altitude/entry

### Diversion

If you need to divert:

1. Click destination airport on map
2. Click **DCT** button
3. Follow new HDG guidance
4. Or manually enter diversion in ROUTE tab

## Troubleshooting

### GPS Permission Denied

**Browser Settings:**

**Chrome/Edge:**
1. Click lock icon in address bar
2. Location → Allow
3. Refresh page

**Firefox:**
1. Click info icon in address bar
2. Permissions → Location → Allow
3. Refresh page

**Safari (iOS):**
1. Settings → Safari → Location
2. Select "Ask" or "Allow"
3. Close and reopen InFlight

### GPS Not Updating

**Problem**: Position frozen or not moving

**Solutions:**
1. Check device has clear sky view
2. Move away from buildings/trees
3. Wait 30-60 seconds for satellites
4. Restart browser
5. Toggle airplane mode off/on (mobile)

### Inaccurate Position

**Problem**: GPS shows wrong location

**Solutions:**
1. Wait for better accuracy (H-ACC improves)
2. Move to open area
3. Check device GPS is working (use Maps app)
4. Calibrate compass (mobile)

### Map Not Displaying

**Problem**: MAP tab is blank or empty

**Solutions:**
1. Calculate route in ROUTE tab first
2. Ensure database is loaded
3. Check browser console for errors
4. Try different browser

### Waypoint Announcements Not Working

**Problem**: No voice announcements

**Solutions:**
1. Check device volume
2. Unmute device
3. Test TTS in browser (e.g., "speechSynthesis.speak()")
4. Some browsers don't support TTS (use Chrome/Safari)
5. Check browser TTS permissions

### Vibration Not Working

**Problem**: Device doesn't vibrate

**Solutions:**
1. Desktop browsers don't support vibration (mobile only)
2. Check device vibration is enabled in system settings
3. Some devices block vibration in web apps
4. iOS has limited vibration support

## Best Practices

1. **Grant permissions** before takeoff
2. **Test GPS** on ground first
3. **Monitor accuracy** - H-ACC < 50M for reliable navigation
4. **Use 50NM zoom** for most enroute flying
5. **Keep device charged** - GPS drains battery quickly
6. **Have backup** - Carry paper charts and certified GPS
7. **Mount device** securely in cockpit for easy viewing
8. **Don't fixate** on screen - maintain visual scan

## Performance Tips

### Battery Life

GPS tracking is power-intensive:
- Use external power/charger in flight
- Lower screen brightness
- Close other apps
- Enable low-power mode when available

### Data Usage

Map and GPS features use minimal data:
- Route display: Offline (no data)
- GPS tracking: Offline (no data)
- Wind data: ~100 KB (one-time download)
- AirNav links: Online

### Screen Always-On

Prevent screen from sleeping:

**iOS**: Enable Guided Access
**Android**: Use "Stay Awake" developer option
**Alternative**: Tap screen periodically

## Advanced Features

### Custom Zoom Levels

After using +/− buttons:
- Preset buttons (ROUTE, DEST, 50NM, 25NM) restore standard views
- Manual zoom persists until preset selected

### Multi-Touch Gestures

**Pinch Zoom** (mobile):
- Not currently supported
- Use +/− buttons instead

**Pan/Drag**:
- Not currently supported
- Map auto-centers on aircraft

Roadmap: Add pan and pinch in future update

## Next Steps

- **[Track Flight](tab-stats.md)** - Monitor fuel, time, and recording
- **[GPS Tracking Guide](features/gps-tracking.md)** - Advanced GPS features
- **[Export Track](features/flight-recording.md)** - Save your flight as GPX

---

**Ready to fly?** Enable GPS and start tracking your flight in real-time!
