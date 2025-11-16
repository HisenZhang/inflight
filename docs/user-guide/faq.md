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

**Yes.** Use browser print function (Ctrl+P / Cmd+P). InFlight automatically switches to a printer-friendly layout with:
- High-contrast black text on white background
- Hidden buttons and UI elements
- Optimized formatting for paper

For cockpit use, consider:
- Printing from browser to PDF
- Mounting tablet with checklist visible
- Using paper POH checklist

See [Printing Guide](#printing-questions) for details.

## Printing Questions

### Can I print my flight plan?

**Yes.** InFlight has built-in printer-friendly formatting:

**To print:**
1. Open the tab(s) you want to print (NAVLOG, STATS, CHKLST, etc.)
2. Press **Ctrl+P** (Windows/Linux) or **Cmd+P** (Mac)
3. Review print preview
4. Click Print or save as PDF

### What gets printed?

**InFlight prints only the currently active tab.** This gives you clean, focused output.

**To print a specific tab:**
1. Click on the tab you want (NAVLOG, STATS, CHKLST, etc.)
2. Press **Ctrl+P / Cmd+P**
3. Only that tab's content will appear in print preview

**Available for printing:**
- ✅ **WELCOME tab**: App info and disclaimer
- ✅ **DATA tab**: Database status and system checks
- ✅ **ROUTE tab**: Route input with departure, route, destination
- ✅ **NAVLOG tab**: Complete navigation log table (most common!)
- ✅ **STATS tab**: Flight statistics and fuel planning
- ✅ **CHKLST tab**: All checklists (auto-expanded for printing)
- ⚠️ **MAP tab**: Shows helpful message (canvas graphics can't print)

**Automatically optimized for printing:**
- Tab navigation buttons → Hidden
- Input buttons (CALCULATE, CLEAR, etc.) → Hidden
- Help text and instructions → Hidden
- Action buttons → Hidden
- Collapsed checklists → Auto-expanded
- All UI chrome → Hidden

### Does it work on color and black-and-white printers?

**Yes!** InFlight's print styles work on both:

**Color printers:**
- Airports: Dark blue
- Navaids: Dark magenta
- Reporting points: Dark orange (underlined)
- Other elements: Professional colors
- Clear, vibrant output

**Grayscale/B&W printers:**
- Colors convert to different gray shades
- High contrast maintained
- All text remains readable
- Reporting points underlined for visibility
- Professional black-on-white appearance

### How do I print just the navlog?

**Easy!** InFlight automatically prints only the active tab:
1. Click on **NAVLOG tab**
2. Press **Ctrl+P / Cmd+P**
3. Only the navlog will appear in print preview
4. Print or save as PDF

The printed navlog includes:
- **Time generated** - When the navlog was calculated
- **Filed altitude** - Your planned cruising altitude
- **Filed speed** - Your true airspeed (TAS) used for calculations
- **Route summary** - User route, expanded route, distance, waypoints
- **Wind altitude table** - Winds and temperatures at different altitudes (if enabled)
- **Complete waypoint table** - All waypoints with coordinates, frequencies, and leg details
- Clean, borderless layout optimized for paper

**Same for any tab:**
- Want just the checklist? Click CHKLST tab, then print
- Want just stats? Click STATS tab, then print
- Want route details? Click ROUTE tab, then print

**Tip:** Save as PDF for digital archival without using paper/ink.

### Why does the print preview look different from the screen?

InFlight uses special **print-only styles** that activate when printing:
- **Screen**: Dark theme (black background, bright colors) optimized for displays
- **Print**: Light theme (white background, dark text) optimized for paper

This ensures:
- Good contrast on white paper
- Readable text (no light cyan/magenta on white)
- Professional appearance
- Efficient ink usage

### What happens if I try to print the MAP tab?

Instead of a blank page, you'll see a helpful message explaining that the interactive map cannot be printed (canvas graphics don't work on paper) and directing you to use the NAVLOG tab for a printable reference with all waypoint coordinates and headings.

### Do collapsed checklists expand when printing?

**Yes!** All checklists automatically expand when printing, even if they're collapsed on screen. This ensures you get the complete checklist on paper without having to manually expand each section first.

### Why does the wind altitude table show fewer rows than legs?

The wind altitude table displays winds and temperatures at **6 sample points** along your route (every 20% of total distance). This provides useful altitude planning data without overwhelming detail:

**Sample points:**
- 0% - Departure
- 20% - First quarter
- 40% - Midpoint area
- 60% - Past midpoint
- 80% - Final quarter
- 100% - Destination

Each wind cell shows **direction/speed/temperature** (e.g., "280°/25KT/-8°C") to help you choose the best altitude for favorable winds and comfortable temperatures.

This gives you a clear picture of how winds and temperatures change at different altitudes as you progress along your route, without the clutter of showing every single leg.

**For detailed leg-by-leg wind corrections**, the NAVLOG tab shows wind calculations (including temperature) for every individual segment.

### Can I print in landscape orientation?

**Yes.** In the print dialog:
1. Look for "Layout" or "Orientation" setting
2. Choose "Landscape"
3. Print or save

Landscape may work better for wide navlog tables.

### The colors are too light when printed. What's wrong?

If colors appear washed out:
1. **Check printer settings**: Ensure "Print background colors" is enabled
2. **Browser settings**: Chrome → Print dialog → More settings → Enable "Background graphics"
3. **Printer quality**: Set to "Best" or "High Quality" mode
4. **Ink levels**: Check if cartridges need replacement

InFlight uses dark colors specifically to avoid this issue, but browser/printer settings can affect output.

### Can I save the print output as PDF?

**Yes.** In the print dialog:
1. Look for "Destination" or "Printer" dropdown
2. Select "Save as PDF" or "Microsoft Print to PDF"
3. Choose location and filename
4. Save

**Benefits:**
- Digital backup of flight plan
- Easy sharing via email
- Archive old flights
- No paper/ink needed

### Do I need to print every flight?

**No.** Printing is optional. Many pilots prefer:
- **Digital-only**: Keep tablet with InFlight open in cockpit
- **PDF archive**: Save as PDF for records
- **Hybrid**: Print critical flights, keep others digital

For training/education, printing can be helpful for study and review.

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
