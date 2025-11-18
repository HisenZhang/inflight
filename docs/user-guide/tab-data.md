# DATA Tab

The DATA tab manages the aviation database and stores your GPS flight tracks.

## Database Loading

When you first use IN-FLIGHT, click **LOAD DATABASE** to download FAA and OurAirports data. This downloads about 5MB and takes 10-30 seconds to parse and index.

Once loaded, the status panel shows the counts:

```text
Airports: 70,412
Navaids: 10,238
Fixes: 45,891
Airways: 1,247
Total Waypoints: 126,541
```

The database is cached for 7 days, so IN-FLIGHT works offline after the initial load.

## Database Buttons

**LOAD DATABASE** fetches fresh data from the internet. Use this on first launch or every 6 months to get updates.

**REINDEX** rebuilds the indexes from cached data without downloading anything. This is useful after app updates if route parsing stops working.

**CLEAR ALL** wipes everything including the database cache and all saved flight tracks. You'll need to reload after this.

## Flight Tracks

This section lists all GPS tracks saved from the STATS tab. Each track shows the route (if you entered departure/destination), date and time, flight duration, distance traveled, and the number of GPS points recorded.

You can click **EXPORT GPX** to download an individual track as a GeoJSON file, or click **DELETE** to remove it. The **CLEAR ALL TRACKS** button deletes all saved tracks while keeping the database intact.

## What Gets Stored

IN-FLIGHT uses IndexedDB to cache the raw CSV data from FAA and OurAirports, along with the parsed airports, navaids, fixes, airways, and procedures. It also builds spatial indexes for fast lookups. This cache lasts 7 days.

Your browser's localStorage holds saved GPS flight tracks, checklist states, and recent route queries.

## When to Reload

You should reload the database every 6-12 months when NASR and AIRAC cycles update, or after clearing your browser cache, or if the data seems outdated. You don't need to reload constantly since it's designed for offline use.

---

**Database loaded?** Head to the [ROUTE](tab-route.md) tab to plan your first flight.
