# DATA Tab

The DATA tab manages the aviation database and your saved flight tracks.

## Overview

Before using InFlight, you must load the aviation database containing waypoint information for airports, navaids, and fixes. The database is downloaded once and cached in your browser for offline use.

## Database Section

### Loading the Database

**First Time Setup:**

1. Click the **LOAD DATABASE** button
2. Wait for the download to complete (30-60 seconds depending on connection speed)
3. Database is automatically cached in browser storage

**What Gets Loaded:**

- **FAA NASR Data** (US domestic):
  - Airports (ICAO codes)
  - Navaids (VOR, NDB, DME, etc.)
  - Fixes (intersection points)
  - Airways and routes
  - SID/STAR procedures

- **OurAirports Data** (Worldwide):
  - Additional airport information
  - IATA codes
  - Runways
  - Frequencies

### Database Status

Once loaded, you'll see statistics:

```
STATUS: LOADED
Airports: ~20,000
Navaids: ~3,000
Fixes: ~50,000
Airways: ~1,000
Total Waypoints: ~73,000
```

### Database Management Buttons

**REINDEX Button:**
- Rebuilds the database index
- Use if search is slow or returning incorrect results
- Takes 5-10 seconds

**CLEAR ALL Button:**
- Removes all cached database data
- You'll need to reload the database
- Use if you suspect corrupted data or want to free up space

> ⚠️ **Warning**: CLEAR ALL is permanent and cannot be undone. You'll need to re-download the database.

## Advanced Section

Click the **ADVANCED** header to expand detailed database inspection:

- **Airports** - Count and sample entries
- **Navaids** - Breakdown by type (VOR, NDB, etc.)
- **Fixes** - Waypoint counts
- **Airways** - Route network information
- **Storage Usage** - Browser storage consumption

This section is useful for troubleshooting or verifying data integrity.

## Flight Tracks Section

### Managing Saved Tracks

InFlight automatically saves your GPS tracks when you fly. This section lists all recorded flights.

**Track Information Displayed:**
- **Departure → Destination** (if available)
- **Date and Time** of recording
- **Duration** of flight
- **Distance** flown
- **Number of GPS points** recorded

### Track Actions

**For Each Track:**
- **EXPORT GPX** - Download as GPX file for use in:
  - ForeFlight
  - Garmin Pilot
  - Google Earth
  - Flight analysis software

- **DELETE** - Remove individual track

**Bulk Actions:**
- **REFRESH** - Reload the tracks list
- **CLEAR ALL TRACKS** - Delete all saved flights

### Exporting Tracks

GPX files include:
- GPS coordinates and timestamps
- Altitude data (if available)
- Track points with metadata
- Compatible with most aviation and mapping software

> 💡 **Tip**: Export tracks regularly to backup your flight history, as they're stored in browser cache.

## Storage Considerations

### How Much Space is Used?

- **Database**: ~50-100 MB
- **Flight Tracks**: ~100 KB - 1 MB per flight (varies by duration)
- **Cached Navlogs**: Minimal (<1 MB)

### Browser Storage Limits

Most modern browsers allow 50 MB - 1 GB of storage per website. InFlight uses IndexedDB for efficient storage.

### Clearing Storage

**To free up space:**
1. Export any tracks you want to keep
2. Click **CLEAR ALL TRACKS**
3. If needed, click **CLEAR ALL** to remove database (requires re-download)

## Offline Usage

Once the database is loaded, InFlight works offline for:
- ✅ Route calculation
- ✅ Navigation log generation
- ✅ GPS tracking
- ✅ Moving map display

**Requires Internet:**
- ❌ Initial database download
- ❌ Winds aloft data
- ❌ Opening AirNav links

## Troubleshooting

### Database Won't Load

**Problem**: Load button doesn't work or fails midway

**Solutions:**
1. Check internet connection
2. Clear browser cache and try again
3. Try a different browser
4. Check available storage space

### Database Loaded but Searches Don't Work

**Problem**: Waypoints not found or autocomplete empty

**Solutions:**
1. Click **REINDEX** button
2. If still broken, **CLEAR ALL** and reload
3. Check browser console for errors

### Tracks Not Appearing

**Problem**: Recorded flight doesn't show up

**Solutions:**
1. Click **REFRESH** button
2. Check if GPS was active during flight
3. Verify flight duration was >1 minute

### "Out of Storage" Error

**Problem**: Browser reports insufficient storage

**Solutions:**
1. Export important tracks
2. Click **CLEAR ALL TRACKS**
3. Clear other website data in browser settings
4. Use Incognito/Private mode has lower limits - use regular window

## Best Practices

1. **Load once, use forever** - Database persists across sessions
2. **Export tracks regularly** - Browser cache can be cleared accidentally
3. **Check status** before flights - Ensure database is loaded
4. **Monitor storage** - Keep some free space for tracks
5. **Update periodically** - CLEAR ALL and reload for fresh data (every 6 months)

## Next Steps

- **[Enter your route](tab-route.md)** - Plan your first flight

---

**Database ready?** Proceed to the [ROUTE](tab-route.md) tab to plan your flight!
