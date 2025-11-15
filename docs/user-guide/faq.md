# Frequently Asked Questions (FAQ)

Common questions about InFlight answered.

## General Questions

### Is InFlight approved for actual flight operations?

**No.** InFlight is **not FAA approved** and is intended for **educational use only**. It should not be used for actual flight operations. Always use certified, approved navigation equipment and official aeronautical charts for real flights.

### Does InFlight work offline?

**Partially.** Once the database is loaded:
- ✅ Route calculation works offline
- ✅ Navigation log generation works offline
- ✅ GPS tracking works offline
- ✅ Map display works offline
- ❌ Winds aloft requires internet (initial fetch)
- ❌ AirNav links require internet

### What devices can I use InFlight on?

Any modern device with a web browser:
- Desktop/laptop computers (Windows, Mac, Linux)
- Tablets (iPad, Android tablets)
- Smartphones (iPhone, Android phones)
- Any device with GPS for tracking features

Recommended: Tablet or laptop for best experience.

### Does InFlight require an account or login?

**No.** InFlight runs entirely in your browser with no account, login, or registration required. All data is stored locally on your device.

### Is my flight data private?

**Yes.** All data stays on your device:
- No server uploads
- No tracking or analytics
- No personal information collected
- GPX exports contain only GPS coordinates

### How much does InFlight cost?

**Free.** InFlight is free and open-source.

## Database Questions

### How often should I update the database?

**Every 6 months recommended.** To update:
1. Go to DATA tab
2. Click CLEAR ALL
3. Click LOAD DATABASE

Database includes FAA NASR and OurAirports data which is periodically updated.

### How much storage does the database use?

Approximately **50-100 MB** of browser storage. Most devices have plenty of available space.

### Can I use my own database?

Currently, no. The database is loaded from FAA NASR and OurAirports sources. Custom database import is a potential future feature.

### Does the database include international waypoints?

**Limited.** Coverage includes:
- ✅ United States (comprehensive)
- ✅ Canada (limited)
- ✅ Mexico (limited)
- ❌ Oceanic waypoints
- ❌ NAT tracks
- ❌ Most international locations

For international flight planning, use official tools.

## Route Planning Questions

### What route syntax does InFlight support?

InFlight supports standard ICAO flight plan format:
- Direct routing (waypoint to waypoint)
- Airways (Victor, Jet, RNAV)
- SID/STAR procedures
- Mixed routing (combination of above)

See [Route Tab Guide](tab-route.md) for details.

### Can I plan IFR routes?

**Yes**, but remember InFlight is for educational use only. You can plan IFR routes with airways and procedures, but you must file and fly using approved methods.

### Why can't I find a specific waypoint?

Several possibilities:
- Typo in waypoint name
- Waypoint not in database (oceanic, international)
- Database not loaded
- Waypoint recently added (database may be outdated)

### Do I need to enable wind correction?

**No, it's optional.** Wind correction provides:
- More accurate headings
- Ground speed calculations
- ETE and ETA estimates
- Required for fuel planning

You can calculate routes without it for basic distance and bearing.

### Can I save my routes?

**Yes, two ways:**
1. **Export Navlog** - Download as JSON file (NAVLOG tab → EXPORT)
2. **Recent Routes** - Last 10 routes automatically saved (ROUTE tab)

## Navigation & GPS Questions

### Does InFlight require GPS?

**No, not required.** GPS is only needed for:
- Moving map tracking
- Real-time position display
- Flight recording

Route planning works without GPS.

### How accurate is the GPS tracking?

GPS accuracy depends on your device and environment:
- **Good conditions**: ±5-15 meters
- **Typical**: ±15-50 meters
- **Poor conditions**: ±50-100+ meters

This is not approved for navigation. Use certified GPS equipment.

### Why doesn't the map auto-advance to the next waypoint?

Auto-advance triggers when you're within **2 nautical miles** of the next waypoint. If it's not advancing:
- Ensure GPS is ACTIVE
- Check you're actually close to waypoint
- Verify H-ACC is reasonable (<100M)
- May take 5-10 seconds to detect

You can manually advance with NEXT button.

### Can I use InFlight for actual in-flight navigation?

**No.** InFlight is for educational use only. Always use:
- Certified panel-mount GPS
- Certified portable aviation GPS
- Official aeronautical charts
- Proper VFR/IFR navigation procedures

### Do waypoint announcements work on all devices?

**Mostly.** Text-to-speech support varies:
- ✅ Chrome (desktop and mobile) - Full support
- ✅ Safari (iOS/Mac) - Full support
- ⚠️ Firefox - Limited TTS support
- ⚠️ iOS - Works but limited customization
- ❌ Older browsers - No support

## Fuel Planning Questions

### How accurate are fuel calculations?

Fuel calculations are **estimates only** based on:
- Your specified burn rate
- Calculated flight time
- Wind-corrected ground speeds

Actual fuel burn varies with:
- Power settings
- Mixture leaning
- Altitude
- Weather
- Aircraft condition

**Always verify fuel physically and follow POH procedures.**

### Why don't I see fuel statistics?

Fuel planning requires:
1. **Wind correction enabled** (for time calculations)
2. **Fuel planning enabled** in ROUTE tab
3. **Route calculated** with both enabled

### Can I customize fuel reserve requirements?

**Yes.** In ROUTE tab fuel settings:
- **VFR Day**: 30 minutes
- **VFR Night / IFR**: 45 minutes

These match FAA requirements.

### What if I run out of fuel according to the plan?

**Plan a fuel stop or reduce distance.** InFlight will warn if fuel is insufficient:
- Red highlighting in navlog
- "INSUFFICIENT FUEL" message
- Endurance less than legal reserve

Never depart without adequate fuel.

## Checklist Questions

### Can I customize the checklist?

Currently, no. The checklist is fixed for Piper Cherokee 140. Future versions may support:
- Multiple aircraft types
- Custom checklist editor
- Import/export checklists

### Is the checklist approved for my aircraft?

**No.** The checklist is generic for PA-28-140 and may not match your specific aircraft. Always use the official POH checklist for your aircraft.

### Does the checklist include emergency procedures?

**No.** Only normal operations checklists are included. For emergencies, reference your POH Emergency Procedures section.

### Can I print the checklist?

Use browser print function (Ctrl+P / Cmd+P) or screenshot. For cockpit use, consider:
- Mounting tablet with checklist visible
- Printing from browser to PDF
- Using paper POH checklist

## Flight Recording Questions

### Where are my recorded flights stored?

Recorded flights are stored:
1. **Current flight**: In browser memory (STATS tab)
2. **Completed flights**: In browser IndexedDB (DATA tab)

All storage is local to your device.

### Can I export flight tracks?

**Yes.** Export as GPX format:
- **Current flight**: STATS tab → EXPORT
- **Saved flights**: DATA tab → EXPORT GPX

GPX files work with ForeFlight, Garmin Pilot, Google Earth, and other apps.

### How long are tracks stored?

Tracks are stored indefinitely in browser cache until:
- You clear browser data
- You delete tracks (DATA tab → CLEAR ALL TRACKS)
- Browser storage is full and browser evicts old data

**Best practice**: Export tracks regularly for backup.

### Why is my track not recording?

Check:
- GPS is ACTIVE (STATS tab)
- Recording status shows ACTIVE
- Track points (PTS) incrementing
- In AUTO mode, ground speed > 30 KT
- In MANUAL mode, START button clicked

## Performance Questions

### Why is InFlight slow?

Common causes:
- Initial database load (first time only)
- Complex route calculation (30-60 seconds normal)
- Many browser tabs open (close extras)
- Old/slow device (upgrade if possible)
- Poor internet for wind data

### Why does route calculation take so long?

Complex routes with airways and procedures require:
- Airway expansion (many waypoints)
- Wind data fetching (internet delay)
- Multiple calculations per leg

**Normal**: 10-30 seconds
**Complex routes**: 30-60 seconds

Be patient - calculation will complete.

### Can I speed up InFlight?

**Tips:**
- Use faster internet connection for initial load
- Close other browser tabs
- Use modern browser (Chrome recommended)
- Use desktop/laptop instead of older mobile device
- Disable wind correction if not needed (faster calculation)

## Technical Questions

### What browsers are supported?

**Recommended:**
- Google Chrome (desktop/mobile)
- Mozilla Firefox (desktop/mobile)
- Safari (macOS/iOS)
- Microsoft Edge

**Minimum requirements:**
- ES6 JavaScript support
- IndexedDB support
- Geolocation API (for GPS features)
- Speech Synthesis API (for announcements)

### Does InFlight work on Internet Explorer?

**No.** IE11 and older are not supported. Use a modern browser.

### Is InFlight open source?

Check the project repository for licensing information.

### Can I contribute to InFlight?

Contributions are welcome! Check the GitHub repository for:
- Bug reports
- Feature requests
- Pull requests
- Documentation improvements

### Where is the data stored?

All data is stored locally in your browser using:
- **IndexedDB**: Database, flight tracks, navlogs
- **localStorage**: Settings and preferences
- **Memory**: Current session data

Nothing is stored on external servers.

## Limitations & Known Issues

### Why can't I plan oceanic routes?

InFlight database includes only US domestic waypoints. Oceanic waypoints (NAT tracks, Pacific routes) are not included. Use official oceanic flight planning tools.

### Why are some airports missing?

The database includes:
- All FAA NASR airports (US)
- OurAirports data (worldwide)

Very small private airports or recently added airports may not be included. Database is updated periodically.

### Can InFlight replace ForeFlight/Garmin Pilot?

**No.** InFlight is educational only. Professional apps like ForeFlight and Garmin Pilot offer:
- FAA approval
- Current charts and plates
- NOTAMs and TFRs
- Weather integration
- Certified navigation
- Regular updates

Use InFlight for learning and practice, not actual operations.

### Why don't I see NOTAMs or TFRs?

InFlight does not include:
- NOTAMs (Notices to Airmen)
- TFRs (Temporary Flight Restrictions)
- Airspace status
- Special use airspace status

**Always check official sources** (1800wxbrief.com, ForeFlight, etc.) for NOTAMs and TFRs before flight.

---

**Didn't find your answer?** Check the [Troubleshooting](troubleshooting.md) guide or individual [tab guides](README.md).
