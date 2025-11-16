# DATA Tab

Database management and GPS track storage.

## Database Loading

**First time:** Click **LOAD DATABASE**. Downloads FAA + OurAirports data (~5MB), parses it, builds indexes. Takes 10-30 seconds.

**Status shows:**
```text
Airports: 70,412
Navaids: 10,238
Fixes: 45,891
Airways: 1,247
Total Waypoints: 126,541
```

**Cached for 7 days.** Offline-capable after first load.

## Database Buttons

**LOAD DATABASE:** Fetches fresh data from internet. Use this first time or to update every 6 months.

**REINDEX:** Rebuilds indexes from cached data (no internet needed). Use after app updates if route parsing breaks.

**CLEAR ALL:** Wipes everything—database cache AND saved flight tracks. You'll need to reload.

## Flight Tracks

**List of saved GPS tracks** from STATS tab recordings.

Each shows:
- Route (if entered)
- Date/time
- Duration
- Distance
- Point count

**EXPORT GPX:** Download individual track as GeoJSON file.

**DELETE:** Remove track.

**CLEAR ALL TRACKS:** Delete all saved tracks (keeps database).

## What Gets Stored

**IndexedDB (7-day cache):**
- Raw CSV data from FAA/OurAirports
- Parsed airports, navaids, fixes, airways, procedures
- Spatial indexes for fast lookups

**localStorage:**
- Saved GPS flight tracks
- Checklist states
- Recent route queries

## When to Reload

- Every 6-12 months (NASR/AIRAC cycle updates)
- After clearing browser cache
- If data seems outdated

Don't reload constantly—it's cached for offline use.

---

**Database loaded?** Head to [ROUTE](tab-route.md) to plan your first flight.
