# DATA Tab: Database and Flight Tracks

This is your housekeeping tab—loading the aviation database and managing flight tracks. Think of it as the "Settings" for data, not features.

**You'll use this twice:**
1. **Once when you first install** - Load the database
2. **After every flight** - Export your GPS track

## Loading the Aviation Database (Required)

Before you can plan any routes, you need the airport and navaid database.

### First-Time Setup

1. Click **LOAD DATA** button
2. Wait ~10-30 seconds while downloading
3. Status changes to "LOADED" with waypoint counts
4. Done—database is now cached in your browser

**What you're downloading:**
- 70,000+ airports worldwide (ICAO and IATA codes)
- 10,000+ navaids (VOR, NDB, DME, TACAN)
- Airways (V-routes, J-routes, Q-routes)
- SID/STAR procedures (US domestic)
- Fixes and intersections

**File size:** ~5-10 MB (one-time download)

**Where it's stored:** Browser IndexedDB (local storage on your device)

**Do you need to reload it?** No. Once loaded, it persists. Even works offline.

### Database Status Display

After loading, you'll see:

```text
STATUS: LOADED
Airports: 70,412
Navaids: 10,238
Fixes: 45,891
Airways: 1,247
Total Waypoints: 126,541
Last Updated: 2025-01-15
```text

**This confirms the database is ready.** You can now plan routes.

### When to Reload the Database

**Good reasons to reload:**
- Every 6-12 months (data updates)
- After browser cache is cleared
- If autocomplete stops working (data corruption)

**How to reload:**
1. Click **CLEAR ALL** (removes old data)
2. Click **LOAD DATA** (re-downloads fresh copy)

**Bad reasons to reload:**
- "Just to be safe" before every flight (unnecessary—data doesn't expire)
- Weekly updates (overkill—aviation data doesn't change that fast)

## Database Management

### REINDEX Button

**What it does:** Rebuilds the search index for autocomplete

**When to use it:**
- Autocomplete is slow or broken
- Waypoint searches return no results
- After importing large custom waypoint files (future feature)

**How long:** 5-10 seconds

**You shouldn't need this often.** Only if something seems broken.

### CLEAR ALL Button

**What it does:** Deletes the entire database from browser storage

**When to use it:**
- Reloading fresh data (see above)
- Freeing up storage space
- Troubleshooting corrupted data

**Warning:** This is permanent. You'll need to reload the database afterward.

**Storage freed:** ~50-100 MB

## Flight Tracks

Every time you enable GPS and fly, InFlight automatically records your track. This section manages those saved flights.

### What Gets Recorded

**Automatic logging when:**
- GPS is enabled in MAP tab
- You're moving >50 knots (takeoff detection)
- Until you slow <30 knots (landing detection)

**Track includes:**
- GPS coordinates (lat/lon) every 5-10 seconds
- Timestamps
- Altitude (if available from device GPS)
- Ground speed

**Track does NOT include:**
- Attitude (pitch/roll)
- Heading
- Fuel data

### Viewing Saved Tracks

Each track shows:
- **Route:** KSFO → KLAS (if you entered departure/destination)
- **Date/Time:** When the flight started
- **Duration:** How long you flew (e.g., "2:15")
- **Distance:** Total distance from GPS track (e.g., "391 NM")
- **Points:** Number of GPS coordinates recorded (e.g., "487 points")

**Example:**
```text
KSFO → KHAF
2025-01-15 14:23 PST
Duration: 0:12
Distance: 18.5 NM
Points: 95
[EXPORT GPX] [DELETE]
```text

### Exporting Flight Tracks

**Why export:**
- Backup your flight history
- Import into ForeFlight/Garmin Pilot for logbook
- Analyze in Google Earth
- Share with flight instructor for debrief
- Prove you flew somewhere (for student pilots)

**How to export:**
1. Find the flight in the list
2. Click **EXPORT GPX** button
3. File downloads: `track_KSFO_KHAF_20250115.gpx`
4. Save to cloud/email to yourself

**GPX format** is universal:
- ✅ ForeFlight
- ✅ Garmin Pilot
- ✅ Google Earth
- ✅ CloudAhoy (flight debrief)
- ✅ SkyVector
- ✅ Most EFBs and flight analysis tools

### Deleting Tracks

**Individual track:**
- Click **DELETE** next to the track
- Confirmation prompt appears
- Track removed permanently

**All tracks:**
- Click **CLEAR ALL TRACKS** button
- Confirmation prompt
- All flight history deleted

**Before deleting:** Export any tracks you want to keep. Browser storage is not backed up.

### Track Storage

**Typical size per flight:**
- 15-minute flight: ~50 KB
- 1-hour flight: ~200 KB
- 3-hour flight: ~600 KB

**Browser storage limits:**
- Chrome/Firefox: 50-100 MB per site (plenty for 100+ flights)
- Safari: Similar limits
- Private/Incognito mode: Lower limits (don't use for long-term storage)

**To free up space:**
1. Export important tracks
2. Click CLEAR ALL TRACKS
3. You now have room for new flights

## Advanced Section (Optional)

Click **ADVANCED** to expand database details:

**What you see:**
- Detailed waypoint counts by type
- Database schema version
- Storage usage breakdown
- Index statistics

**Who needs this:**
- Developers
- Users troubleshooting data issues
- Curious pilots who want to see what's under the hood

**Most pilots:** Can ignore this section entirely.

## Offline Capability

**Once database is loaded, these work offline:**
- ✅ Route planning (ROUTE tab)
- ✅ Navlog generation (NAVLOG tab)
- ✅ GPS tracking (MAP tab)
- ✅ Moving map display

**Still requires internet:**
- ❌ Initial database load (one-time)
- ❌ Winds aloft data (can enter manually)
- ❌ AirNav airport links

**Practical use:** Load the database at home with WiFi. Then use InFlight in airplane mode during the flight. Everything works.

## Troubleshooting

### "LOAD DATA button doesn't work"

**Possible causes:**
- No internet connection
- Browser blocking the download
- Insufficient storage space

**Fixes:**
1. Check internet connection (try loading another website)
2. Check available storage (Settings → Storage on phone/tablet)
3. Try different browser (Chrome recommended)
4. Disable browser extensions (adblockers can interfere)
5. Use regular window (not Incognito/Private)

### "Database loaded but waypoints not found"

**Symptoms:**
- Autocomplete shows nothing
- "Waypoint not found" errors in ROUTE tab
- Empty search results

**Fixes:**
1. Click **REINDEX** button (wait 10 seconds)
2. If still broken: **CLEAR ALL** → **LOAD DATA** (re-download)
3. Check browser console for JavaScript errors (F12 key)

### "Flight track not appearing"

**Causes:**
- GPS wasn't enabled during flight
- Flight was too short (<1 minute)
- Browser crashed before saving
- Storage quota exceeded

**Fixes:**
1. Click **REFRESH** button in Flight Tracks section
2. Check if GPS was "ACTIVE" during flight (MAP tab)
3. Export other tracks and delete to free space
4. Try recording a test flight (taxi around ramp)

### "Out of storage" error

**Browser says:** "QuotaExceededError" or "Storage full"

**Fixes:**
1. Export all important tracks
2. Click **CLEAR ALL TRACKS**
3. Clear other websites' data (browser settings)
4. Close other tabs (some browsers share storage pool)
5. Don't use Incognito mode (lower storage limits)

### Database loads but seems outdated

**Example:** New airport or navaid not appearing

**Fix:**
1. Check when database was last updated (shown in status)
2. **CLEAR ALL** to remove old data
3. **LOAD DATA** to download latest version
4. Data is updated monthly from OurAirports

**Note:** InFlight uses community-sourced data (OurAirports). Some minor airports or brand-new waypoints may not be included. Always verify critical data against current charts.

## Workflow for New Users

**Day 1 (setup):**
1. Open InFlight
2. Go to DATA tab
3. Click LOAD DATA
4. Wait for completion
5. Move to ROUTE tab and start planning

**Regular use:**
- Don't touch DATA tab (database persists)
- After each flight, export GPS track
- Every 6 months, reload database for updates

**That's it.** DATA tab is "set it and forget it."

## Best Practices

**Do:**
- ✅ Export tracks regularly (weekly if flying often)
- ✅ Check database status before first flight
- ✅ Reload database every 6-12 months
- ✅ Keep 100+ MB free storage for tracks

**Don't:**
- ❌ Clear database before every flight (unnecessary)
- ❌ Use Incognito mode for regular flights (data won't persist)
- ❌ Ignore "out of storage" warnings (export and delete old tracks)
- ❌ Assume tracks are backed up (they're browser-local only)

## What's Next?

**Database loaded?** You're ready to plan routes.

- **[ROUTE Tab](tab-route)** - Enter your first flight plan
- **[Quick Start](quick-start)** - 5-minute walkthrough

**Have flight tracks?** Export them before you forget.

---

**One-time setup complete?** You won't need to visit this tab often. Head to [ROUTE tab](tab-route) and start planning!
