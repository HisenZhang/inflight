# MAP Tab: GPS Moving Map

This is where IN-FLIGHT turns into an in-flight navigation tool. The MAP tab gives you a moving map display with your aircraft position, route visualization, and real-time guidance—think of it as a basic FMS map page in your browser.

**What this is:** Situational awareness, backup navigation, and route monitoring.

**What this is NOT:** A certified GPS navigator. Don't use this for primary navigation. It's a planning tool and backup reference.

## What You're Looking At

### Route Visualization

Your planned route appears as a series of connected waypoints:

**Waypoint markers:**
- **Cyan circles** = Airports
- **Magenta circles** = Navaids (VOR, NDB, DME)
- **White circles** = Fixes (intersections, GPS waypoints)
- **Amber circles** = Reporting points (ATC expects you to report these)

**Route lines:**
- **White solid lines** = Your planned route connecting each waypoint
- **Yellow line** = Active leg (from your position to next waypoint)
- **Dotted line** = GPS track trail (where you've been)

### Airspace Visualization

IN-FLIGHT displays controlled airspace around airports for situational awareness:

**Class B Airspace (Blue circles):**
- Major airports (30nm radius typical)
- Two-ring display: lighter outer ring (surface-10,000'), darker inner core (surface-higher altitude)
- Example: KORD (Chicago O'Hare), KSFO (San Francisco)

**Class C Airspace (Magenta circles):**
- Medium airports (10nm radius typical)
- Two-ring display: lighter outer ring, darker inner core
- Example: KMDW (Chicago Midway), KBUR (Burbank)

**Class D Airspace (Blue dashed circles):**
- Towered airports (5nm radius typical)
- Single dashed ring
- Example: Most towered regional airports

**What you see:**
- Airspace renders automatically when airports are visible on map
- Scales with zoom level (appears/disappears based on view)
- Does NOT show altitude limits (2D representation only)

**IMPORTANT LIMITATIONS:**
- **General approximations only** - simplified circular representation
- **NOT accurate boundaries** - actual airspace has irregular shapes, cutouts, and shelves
- **No altitude information** - vertical limits not depicted
- **For situational awareness ONLY** - do NOT use for flight planning or navigation
- ✅ **Always refer to current sectional charts** for exact boundaries, altitudes, and operating requirements
- ✅ Use to get a general sense of nearby controlled airspace locations only

### Airways and Fixes (Detailed Zoom Levels)

IN-FLIGHT displays the airway system and navigation fixes at closer zoom levels for enhanced situational awareness.

**Airway Visualization:**
- **Solid grey lines** = Low altitude airways (Victor, RNAV T, colored airways)
- **Dashed grey lines** = High altitude airways (Jet routes, Q-routes)
- Airways appear automatically at 50NM and 25NM zoom
- Opacity adjusts based on zoom: 60% at 50NM, 80% at 25NM

**Fix Markers:**
- **Small triangles** = Navigation fixes (intersections, waypoints)
- Appears at 25NM and 5NM zoom levels
- At 50NM and 25NM: Shows only reporting points + fixes that are part of airways
- At 5NM: Shows all fixes for detailed approach planning

**Airway Filter (LOW/HIGH/ALL button):**
- **LOW**: Shows only low altitude airways (Victor, RNAV T, colored airways)
  - Use for flights below FL180
  - Matches FAA Low Altitude Enroute charts
- **HIGH**: Shows only high altitude airways (Jet routes, Q-routes)
  - Use for flights at/above FL180
  - Matches FAA High Altitude Enroute charts
- **ALL**: Shows all airways regardless of altitude
  - Use for mixed altitude planning or complete airway structure

**Progressive Detail by Zoom Level:**

| Zoom Mode | Airways | Fixes | Best For |
|-----------|---------|-------|----------|
| ROUTE | Hidden | Hidden | Complete route overview |
| 50NM | Shown (60%) | Hidden | Enroute strategic view with airway structure |
| 25NM | Shown (80%) | Shown | Tactical navigation, airway + fix details |
| 5NM | Hidden | Shown | Approach planning, fix-by-fix navigation |

**What you see:**
- Airways connect navaids (VORs) and fixes to create the IFR route structure
- Airway names displayed on the line (may stack if multiple airways share segments)
- Fixes show navigation intersections you might reference in clearances
- All airways include both segment endpoints (navaids and fixes)

**Why this is useful:**
- **"Cleared to KSFO via V244, direct KSBA"** - See V244 airway on map
- **"Hold at PORTE intersection"** - Locate PORTE fix visually
- **"Cross BRINY at or above 8000"** - Find BRINY on the map
- **Altitude planning** - Toggle LOW/HIGH to see relevant airways for your cruise altitude

**IMPORTANT LIMITATIONS:**
- **Situational awareness only** - Airways shown for reference, not navigation
- **No MEA/MOCA/altitude limits** - Consult enroute charts for altitude restrictions
- **Simplified representation** - Airways may have complex routing not fully depicted
- **Not all fixes shown** - Only reporting points and airway fixes at 50NM/25NM zoom
- ✅ **Always refer to current enroute charts** for exact routing, altitudes, and restrictions
- ✅ Use IFR-certified GPS for actual airway navigation

### GPS Position (When Enabled)

**Your aircraft:**
- **Cyan triangle** pointing in direction of travel
- Updates in real-time (every 1-5 seconds depending on device)
- Leaves a dotted trail showing your path

**Accuracy indicator:**
- Blue circle around aircraft symbol
- Radius = horizontal GPS accuracy
- Smaller circle = better accuracy
- Typical: 5-25 meter radius in clear conditions

### Navigation Panel (Bottom of Screen)

**Top row (large text):**
- **WPT**: Next waypoint identifier (where you're going)
- **HDG**: Required magnetic heading to fly
- **DIST**: Distance remaining to next waypoint (NM)
- **ETE**: Estimated time en route (minutes)

**Bottom row (small text):**
- **GS**: GPS ground speed (knots)
- **ETA**: Estimated time of arrival at waypoint (Zulu time)
- **H-ACC**: Horizontal GPS accuracy (±meters)
- **V-ACC**: Vertical GPS accuracy (±meters)

**This is your primary reference** during GPS-guided flight. Glance down for heading, distance, and ETE.

## Enabling GPS

### First Time Setup

1. Click MAP tab
2. Browser prompts: "Allow location access?"
3. Click **Allow** (required for GPS tracking)
4. GPS status changes to "ACTIVE" (green)
5. Your position appears as cyan triangle

**Permissions are saved**—you won't need to grant them again on subsequent flights.

### GPS Status Indicators

**CHECKING... (Yellow)**
- Browser is requesting permission or initializing
- Wait a few seconds

**ACTIVE (Green)**
- GPS successfully tracking
- Position updating in real-time
- Ready to navigate

**DENIED (Red)**
- You clicked "Block" on permission prompt
- Fix: Click lock icon in address bar → Location → Allow → Refresh page

**UNAVAILABLE (Red)**
- Device doesn't have GPS (desktop without WiFi positioning)
- Browser doesn't support Geolocation API (unlikely)
- Use GPS-enabled device (phone/tablet with cellular)

### GPS Accuracy: What to Expect

**Excellent (±5-12 meters):**
- Clear sky view
- Good satellite geometry
- Tablet with cellular GPS (even without SIM)

**Good (±15-30 meters):**
- Some obstruction (clouds, light tree cover)
- Phone GPS in cockpit
- Sufficient for enroute navigation

**Marginal (±50-100 meters):**
- Heavy clouds, urban areas, or tree cover
- WiFi-only positioning on ground
- Don't rely on this for terminal navigation

**Poor (±100+ meters):**
- Buildings, hangars, heavy obstruction
- Desktop computer with WiFi positioning
- Not usable for navigation

**In-flight:** GPS accuracy is typically excellent (±10-20m) with clear sky view. Much better than on the ground.

## Zoom Controls

Located at top-right of map.

### Preset Zoom Modes

**ROUTE (default):**
- Shows entire route from departure to destination
- Frames only the route waypoints (current GPS position may be outside view)
- Good for: Pre-flight planning, overall route awareness, consistent route overview
- Use when: Checking the big picture or viewing the complete flight plan

**DEST:**
- Zooms to destination airport area
- Shows: Arrival waypoints, local navaids, airport
- Auto-shows airways/fixes when within 50nm of destination
- Good for: Approach planning, reviewing STAR
- Use when: Within 50nm of destination

**50NM:**
- Medium-range view: 50 nautical mile radius around your aircraft
- Shows: Airways (60% opacity), upcoming waypoints, route ahead
- Fixes hidden (cleaner view)
- Good for: Enroute navigation, airway structure awareness
- **Use this for most of your flight**

**25NM:**
- Close-range view: 25 nautical mile radius
- Shows: Airways (80% opacity) AND fixes (reporting points + airway fixes)
- Good for: Terminal area, tactical navigation with airway/fix details
- Use when: Approaching airport or navigating complex airspace

**5NM:**
- Approach view: 5 nautical mile radius
- Shows: All fixes (100% opacity), no airways
- Good for: Approach planning, fix-by-fix navigation, holding patterns
- Use when: Final approach or complex terminal procedures

### Airway Filter Button (LOW/HIGH/ALL)

**Located:** Next to zoom controls

**Cycles through:**
1. **LOW** - Shows only low altitude airways (Victor, RNAV T, colored airways)
2. **HIGH** - Shows only high altitude airways (Jet routes, Q-routes)
3. **ALL** - Shows all airways

**When to use:**
- **Below FL180:** Use LOW filter to match your Low Altitude Enroute chart
- **At/Above FL180:** Use HIGH filter to match your High Altitude Enroute chart
- **Mixed altitude planning:** Use ALL to see complete airway network

**Visual distinction:**
- Low altitude airways = Solid lines
- High altitude airways = Dashed lines

### Manual Zoom (+ and − Buttons)

**+ button**: Zoom in for more detail
**− button**: Zoom out for wider view

**Tip:** After manual zoom, clicking any preset (ROUTE/DEST/50NM/25NM/5NM) returns to standard views.

## Auto-Waypoint Advancement

**The magic feature:** IN-FLIGHT automatically advances to the next waypoint when you pass abeam the current one.

### How It Works

**Trigger distance:** Within 2 nautical miles of next waypoint

**What happens:**
1. Device vibrates (mobile devices) - two short pulses
2. TTS announces waypoint passage (if audio enabled)
3. Navigation panel updates to next leg
4. Yellow line re-draws to new active waypoint
5. Guidance (HDG/DIST/ETE) updates automatically

**Why this matters:** You don't have to manually click "NEXT" during the flight. IN-FLIGHT does it for you, just like an FMS.

### Manual Waypoint Control

**PREV button (◄):**
- Go back to previous waypoint
- Use if: You passed a waypoint early and want to re-sequence
- Or: ATC vectors you backwards in the route

**NEXT button (►):**
- Skip to next waypoint
- Use if: ATC says "proceed direct to [waypoint]" that's ahead in route
- Or: You want to skip a waypoint

**Important:** Auto-advancement overrides manual selection. If you manually advance, but you're still 50nm away, it will keep that waypoint until you get within 2nm.

## Voice Announcements (TTS)

When you pass within 2nm of a waypoint, IN-FLIGHT announces:

**Example announcement:**
> "Approaching K O R D. Next waypoint B S R, heading 1 4 1, distance 97 nautical miles, E T E 47 minutes."

**What's included:**
- Current waypoint (spelled out letter by letter)
- Next waypoint (spelled out)
- Magnetic heading (digit by digit with leading zeros)
- Distance in nautical miles
- ETE if wind correction is enabled

**Heading callout format:**
- 90° → "zero nine zero"
- 270° → "two seven zero"
- 5° → "zero zero five"

This matches standard aviation phraseology for clarity.

**Volume:** Uses system TTS at maximum volume. Adjust device volume before flight.

**Voice:** Uses default system voice. No customization currently available.

**To disable:** Mute device volume or turn off TTS in browser settings. (Future: UI toggle planned)

## Haptic Feedback (Vibration)

**When it triggers:** Waypoint passage (within 2nm)

**Pattern:** Two short vibrations (100ms each), separated by 50ms pause

**Devices:**
- ✅ Works on mobile phones/tablets
- ❌ Desktop browsers don't support vibration API

**Why it's useful:** Alerts you to waypoint passage without looking at the screen. Great for single-pilot IFR when head-down configuring avionics.

## One-Tap Diversions

**Scenario:** Weather ahead, fuel concern, emergency, or just want to land early.

### How to Divert

1. **Click any airport on the map** (cyan circle)
2. Popup appears with airport info
3. **Click "DCT" button** in popup
4. Navigation updates instantly:
   - Yellow line points to diversion airport
   - HDG shows magnetic heading to airport
   - DIST shows direct distance
   - ETE updates based on current GS

**IN-FLIGHT automatically:**
- Calculates direct great-circle route to airport
- Updates fuel remaining (if fuel planning enabled)
- Shows new ETA

**To cancel diversion:**
- Click NEXT or PREV to return to planned route
- Or go to ROUTE tab and recalculate

**Practical use:** You're flying KSFO→KLAS, encounter headwinds stronger than planned, fuel is tight. Click KBIH (Bishop Airport, en route) and divert. Instant new heading and fuel estimate.

## Reading GPS Data

### Ground Speed (GS)

**What it is:** Actual speed over the ground from GPS

**How it's calculated:** Position change over time (very accurate when moving)

**Typical values:**
- 0-5 knots when stationary (GPS jitter)
- 80-150 knots for light GA aircraft in cruise
- Updates every 1-5 seconds

**Use it to:**
- Compare against planned GS from navlog
- Calculate actual ETE: `(Distance ÷ GS) × 60`
- Verify winds aloft accuracy

**Example:** Navlog says 120kt GS, but GPS shows 105kt → stronger headwind than forecast. Recalculate ETE and fuel.

### Horizontal Accuracy (H-ACC)

**What it is:** GPS position uncertainty (error radius)

**Good values:**
- ±5-10m: Excellent (differential GPS, WAAS)
- ±10-25m: Good (standard GPS, clear sky)
- ±25-50m: Acceptable for enroute navigation

**Marginal values:**
- ±50-100m: Use with caution (some obstruction)
- ±100m+: Don't rely on this for navigation

**Factors:**
- Satellite count (more satellites = better accuracy)
- Satellite geometry (spread out = better)
- Atmospheric conditions
- Obstructions (buildings, trees, clouds)

**In-flight:** Typically ±10-20m in cruise. Much better than on the ground.

### Vertical Accuracy (V-ACC)

**What it is:** GPS altitude uncertainty

**Typical values:**
- ±10-30m in flight (acceptable)
- ±50m+ on ground (poor satellite geometry)

**IMPORTANT WARNING:**
- GPS altitude is **NOT** approved for vertical navigation
- **Use your barometric altimeter** for altitude
- GPS altitude is MSL (not pressure altitude)
- Good for terrain awareness, not for flying assigned altitudes

## Practical Use During Flight

### Pre-Flight (On the Ground)

1. ✅ Load route in ROUTE tab, hit COMPUTE
2. ✅ Go to MAP tab, grant GPS permission
3. ✅ Wait for GPS lock (H-ACC < 30m)
4. ✅ Verify your position shows correctly on map
5. ✅ Set zoom to 50NM
6. ✅ Check first waypoint shows in navigation panel

### Takeoff and Departure

1. ✅ Keep iPad/tablet mounted and visible
2. ✅ Glance at HDG after takeoff—should match departure heading
3. ✅ Monitor yellow line to first waypoint
4. ✅ If flying SID, watch waypoint advancement

**Tip:** If you're getting vectors from departure, use NEXT button to skip SID waypoints manually.

### Enroute

**Best settings:**
- Zoom: **50NM**
- Monitor: HDG, DIST, ETE
- Glance interval: Every 5-10 minutes (don't fixate)

**What to watch:**
- **Cross-track error**: How far off the route line you are
  - Deviation visible as offset from white route line
  - Adjust heading to get back on course
- **Upcoming waypoints**: See them approaching on map
- **Heading changes**: Anticipate turns at waypoints

**Workflow:**
1. Fly assigned heading from ATC or navlog MH
2. Glance at map to confirm tracking
3. Note next waypoint distance
4. When waypoint announcement plays, acknowledge mentally
5. Check new heading for next leg
6. Adjust heading indicator to new HDG

### Terminal Area and Approach

**Best settings:**
- Zoom: **25NM** or **DEST**
- Reference: Airport position relative to you
- Monitor: Pattern entry, local waypoints

**What to watch:**
- Airport location (cyan circle)
- Approach course alignment
- Local navaids if flying VOR/ILS approach

**Switching to approach mode:**
1. At 10-20nm from airport, zoom to DEST
2. Reference airport diagram for pattern entry
3. Use GPS for situational awareness only
4. Fly approach per ATC instructions or published procedure

### Landing and Taxi

GPS continues tracking on the ground:
- Shows taxi movement on airport
- Useful for unfamiliar airports (which taxiway am I on?)
- Not a substitute for airport diagram

## Troubleshooting

### "GPS Permission Denied"

**Fix for Chrome/Edge:**
1. Click lock icon left of URL
2. Location → Allow
3. Refresh page

**Fix for Firefox:**
1. Click info icon (i) left of URL
2. Permissions → Location → Allow
3. Refresh page

**Fix for Safari (iOS):**
1. iOS Settings → Safari → Location Services
2. Set to "Ask" or "Allow"
3. Close and reopen IN-FLIGHT

### "GPS Not Updating" or Stuck Position

**Possible causes:**
- Phone in airplane mode with WiFi on (GPS disabled)
- Heavy cloud cover or cockpit obstruction
- Device GPS hardware issue

**Fixes:**
1. Toggle airplane mode OFF (enable cellular), then back ON
   - This re-enables GPS on iOS devices
2. Wait 30-60 seconds for satellite acquisition
3. Move device to window for clear sky view
4. Restart browser/app

**iOS airplane mode tip:** Airplane mode disables GPS. You need cellular enabled (even without SIM) for GPS to work. Turn on airplane mode, then manually re-enable WiFi AND Bluetooth, but cellular stays off (legal in US cockpits).

### Inaccurate Position (Shows Wrong Location)

**Causes:**
- WiFi positioning instead of GPS (desktop/tablet without cellular)
- Device calibration needed
- GPS hasn't fully locked yet

**Fixes:**
1. Check H-ACC value—wait until it's < 50m
2. Use device with cellular GPS (phone or cellular iPad)
3. Test with Maps app to verify device GPS works
4. Calibrate compass (iOS: Settings → Privacy → Location → System Services → Compass Calibration)

### No Voice Announcements

**Causes:**
- Device muted
- TTS not supported in browser
- Volume too low

**Fixes:**
1. Check device volume (side buttons)
2. Check mute switch (iOS devices)
3. Test TTS: Open browser console, type `speechSynthesis.speak(new SpeechSynthesisUtterance("test"))`
4. Use Chrome or Safari (best TTS support)

### No Vibration on Waypoint Passage

**Expected behavior:**
- Desktop browsers: No vibration (not supported)
- iOS Safari: Limited vibration support
- Android Chrome: Full vibration support

**Fixes:**
1. Confirm device is mobile (desktop can't vibrate)
2. Check device vibration enabled in system settings
3. Some browsers block vibration—try Chrome on Android

## Tips for Effective Use

### Battery Management

GPS is **power-hungry**. Expect 2-4 hours on a typical tablet battery.

**Solutions:**
- Use external power in cockpit (USB charger, cigarette lighter adapter)
- Lower screen brightness (50-70% is readable in most conditions)
- Close other apps
- Enable low-power mode (iOS) before flight

**Recommended:** Always have external power. Don't rely on battery for long flights.

### Screen Visibility

**Bright sun:** Increase brightness to 80-100%
**Night flight:** Decrease brightness to 20-30%, enable dark mode (future feature)
**Tablet mounting:** Use kneeboard or yoke mount for easy viewing

### Backup Navigation

**Never rely solely on IN-FLIGHT GPS:**
- ✅ Have paper charts or certified EFB (ForeFlight, Garmin Pilot)
- ✅ Know how to navigate with VORs and pilotage
- ✅ Monitor panel-mounted GPS (if equipped)
- ✅ File flight plans with ATC for IFR

**IN-FLIGHT is a backup tool**, not primary navigation.

### Cross-Check with Other Instruments

Compare IN-FLIGHT GPS with:
- **Panel GPS**: Position, ground speed, track
- **DME**: Distance to VORs
- **ADF/VOR bearings**: Radial accuracy
- **Heading indicator**: Required heading vs. actual

**Discrepancies?** Trust certified instruments. Use IN-FLIGHT for situational awareness.

## Advanced Scenarios

### ATC Vectors Off Route

**Scenario:** ATC says "turn left heading 270, vectors for traffic."

**How to handle:**
1. Fly assigned heading (270)
2. Watch map—you'll deviate from white route line
3. Keep navigation panel visible for next waypoint awareness
4. When ATC says "resume own navigation," turn to HDG shown in panel
5. Rejoin route line

**IN-FLIGHT continues showing:**
- Distance/bearing to next waypoint
- Updated ETE
- Your track trail (dotted line) showing vectors

### Direct-To Clearance

**Scenario:** ATC says "proceed direct KBIH."

**If KBIH is on your route:**
1. Click NEXT button until KBIH appears as active waypoint
2. Turn to new HDG shown in navigation panel
3. IN-FLIGHT updates guidance automatically

**If KBIH is NOT on your route:**
1. Click KBIH airport on map
2. Click DCT button in popup
3. Turn to new HDG
4. Or manually add to route in ROUTE tab for full navlog update

### Lost Communication (Nordo)

If you lose comms and need to navigate via last clearance:

1. Reference your last ATC clearance
2. Use MAP for situational awareness
3. Follow filed route (white line on map)
4. Squawk 7600
5. Continue as filed to destination

IN-FLIGHT shows your planned route even if off course. Use it to rejoin.

### Practice Approaches

**Scenario:** Flying practice approaches under VFR.

1. Load approach waypoints in ROUTE tab (if you've entered them)
2. MAP shows your position relative to approach course
3. Use for situational awareness, not primary guidance
4. Fly approach per published procedure/ATC vectors

**Not a substitute for approach plates.**

## What's Next?

After using the GPS moving map:

- **[STATS Tab](tab-stats)** - Monitor fuel consumption, flight time, and track recording
- **[DATA Tab](tab-data)** - Export GPS tracks, manage database, review past flights

---

**Ready to navigate?** Enable GPS, set zoom to 50NM, and start your flight!
