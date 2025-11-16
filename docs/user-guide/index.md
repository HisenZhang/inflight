# InFlight User Guide

**For professional student pilots and IFR-rated pilots who want a free, offline-capable flight planning tool.**

InFlight is a web-based EFB alternative that handles the route planning and navigation log parts of flight planning—without subscriptions, logins, or internet dependency after initial setup.

> **DISCLAIMER**
> This is a flight planning tool, not a certified navigation system. Use it for planning and backup, not as your primary navigation source. Always verify routes and data against current charts and NOTAMs.

## What You Get

Think of InFlight as **the middle section of ForeFlight**—the route planning, navlog, and moving map parts—but:
- Free and open source
- Works offline after initial database load
- No account required
- Runs in any modern browser
- Understands IFR route syntax (airways, SIDs, STARs)

**What it's NOT:** An approach plate viewer, weather briefing tool, or certified GPS. Bring your own charts and weather.

## Quick Start (5 Minutes)

If you just want to get flying:

1. **[Load the database](tab-data)** (one-time, ~5MB download)
2. **[Enter a route](tab-route)** like `KSFO JCOBY4 BSR J501 DRK WYNDE3 KLAS`
3. **Hit COMPUTE** and watch it auto-expand to a full IFR flight plan
4. **[Review your navlog](tab-navlog)** with magnetic courses, distances, ETEs
5. **[Enable GPS](tab-map)** for in-flight tracking (optional)

That's it. No tutorial, no signup, no payment method.

## How Pilots Actually Use This

### For VFR Students: Cross-Country Planning Made Easy

You're required to do VFR cross-country planning by hand for training, but InFlight is great for:
- **Checking your work**: Did you calculate that magnetic heading correctly?
- **What-if scenarios**: "What if I cruise at 4,500 instead of 3,500?"
- **Multi-altitude wind analysis**: Enter winds at 3k/6k/9k and see actual ground speeds

Enter your route, set your aircraft performance (TAS, GPH), load winds from your briefing, and get a full navlog. Print it or keep it on your iPad for reference.

### For IFR Pilots: Route Planning Without the Headache

Filing IFR means dealing with airways, SIDs, and STARs. Most flight planning sites make you:
- Click through 15 waypoints to file an airway
- Manually expand procedures
- Hope the autocomplete understands what you're trying to do

**InFlight understands FMS syntax:**
```
KBOS PAYGE SSOXS V3 SAX J57 LRP LENDY6 KLGA
```

Hit COMPUTE and it:
- Expands the SID from your departure runway
- Resolves all fixes on V3 and J57
- Auto-selects the STAR transition based on your arrival fix
- Calculates fuel, time, and magnetic courses for each leg

**ATC reroutes you?** Edit the route string and hit COMPUTE again. Takes 10 seconds.

### For CFIs: Teaching FMS Route Entry

If you're teaching instrument students how to enter routes into a G1000 or FMS, InFlight is a perfect training aid:
- Same route syntax as real avionics
- Context-aware autocomplete (shows airways from current fix, or fixes on current airway)
- Immediate visual feedback when route parsing succeeds/fails

Students can practice route entry at home without needing sim time.

### For iPad Users: The Free Backup EFB

Got ForeFlight/Garmin Pilot/FltPlan Go as your primary EFB? Great. Use InFlight as your **free backup**:
- Install as PWA (works offline)
- Pre-load your route before departure
- If your primary EFB dies, you still have navlog + moving map
- Export flight tracks as GeoJSON for debrief

No monthly fee for redundancy.

## Tab-by-Tab Guides

### Core Workflow
- **[ROUTE Tab](tab-route)** - Enter routes, understand autocomplete, use procedures
- **[NAVLOG Tab](tab-navlog)** - Read the navigation log, adjust altitudes/winds, calculate fuel
- **[MAP Tab](tab-map)** - GPS moving map, waypoint advancement, diversions

### Data Management
- **[DATA Tab](tab-data)** - Load/update database, export flight tracks

### Extras
- **[WELCOME Tab](tab-welcome)** - App overview
- **[CHKLST Tab](tab-chklst)** - Pre-flight checklist (Piper Cherokee 140 default, customizable)
- **[STATS Tab](tab-stats)** - Flight statistics and logging

## Real Features You'll Actually Use

### Intelligent Route Autocomplete

After you type a fix, autocomplete shows **only airways departing from that fix**.
After you type an airway, autocomplete shows **only fixes on that airway**.

This is how FMS autocomplete works. This is not how SkyVector works.

### Multi-Altitude Wind Interpolation

If you're climbing through 4,000-7,000 feet on a leg, InFlight calculates the **blended wind** for that segment—not just one altitude. This matters for accurate fuel planning.

### Automatic Flight Logging

Enable GPS and it automatically:
- Detects takeoff (>50 knots groundspeed)
- Logs your track with timestamps
- Detects landing (<30 knots)
- Exports as GeoJSON for post-flight analysis

No "start recording" button to forget.

### One-Tap Diversions

Flying the route, encounter weather/emergency? Click any airport on the map and InFlight instantly computes:
- Direct route from current position
- Updated fuel remaining
- New ETA based on current fuel state

Useful for VFR pilots diverting around weather or IFR pilots briefing alternates.

### Auto-Waypoint Advancement

GPS-enabled moving map automatically switches to the next leg when you pass abeam the active waypoint. Optional TTS announcements call out waypoint passage ("Approaching KSFO").

Great for single-pilot IFR when you're head-down configuring approach modes.

## What You Need

**Required:**
- Modern web browser (Chrome/Firefox/Safari/Edge)
- Internet connection for initial database load (~5MB, one-time)
- Location permission (for GPS features)

**Optional:**
- GPS-enabled device (phone/tablet) for moving map
- Internet connection for winds aloft links (or enter manually)

**Not Required:**
- Account creation
- Payment method
- Subscription
- Cloud storage

## Limitations (Know Before You Fly)

**Data Coverage:**
- Global airport/navaid database (70,000+ airports, 10,000+ navaids)
- US domestic procedures (SIDs/STARs)
- No oceanic routes, no North Atlantic Tracks

**What's Missing:**
- Approach plates (use ForeFlight/Garmin Pilot/FAA charts)
- NOTAMs and TFRs (check NOTAM sources)
- Weather imagery (get briefing from 1800wxbrief/ForeFlight/AWC)
- Weight & balance calculations

**GPS Accuracy:**
- Depends on your device (usually 5-30 meters)
- Not certified for primary navigation
- Use as backup/situational awareness only

**Data Currency:**
- Airport/navaid data from OurAirports (updated regularly)
- No AIRAC cycle guarantee
- **Always verify critical data against current charts**

## Need Help?

- **Quick answers:** Check the [FAQ](faq)
- **Not working?** See [Troubleshooting](troubleshooting)
- **Specific feature:** Read the relevant tab guide (above)
- **Found a bug?** [Report it on GitHub](https://github.com/HisenZhang/inflight/issues)

---

**Ready to plan a flight?** → **[Load the database](tab-data)** and start routing.
