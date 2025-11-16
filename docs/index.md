---
layout: home
title: InFlight Documentation
titleTemplate: Flight Planning & Navigation

hero:
  name: InFlight
  text: Flight Planning & Navigation
  tagline: In-browser flight planning—works offline, open source, blazing fast. No signup required.
  actions:
    - theme: brand
      text: Quick Start
      link: /user-guide/quick-start
    - theme: alt
      text: User Guide
      link: /user-guide/
    - theme: alt
      text: View on GitHub
      link: https://github.com/HisenZhang/inflight

features:
  - icon: 🌐
    title: In-Browser, Works Offline
    details: Everything runs in your browser. No servers, no cloud. Load the database once and use it forever—even with airplane mode on. 70,000+ airports and waypoints stored locally on your device.
  - icon: 💯
    title: Open Source & Free Forever
    details: No subscription ($0/month forever). No "premium" features locked behind paywalls. No ads. Fully open source. The entire app is yours to use, audit, and modify.
  - icon: ⚡
    title: Blazing Fast
    details: Pure JavaScript with no build step. Loads instantly. Route calculations in milliseconds. No waiting for server responses. Context-aware autocomplete responds immediately.
  - icon: 📱
    title: Works Everywhere
    details: Any device with a browser. iPhone, iPad, Android, Windows, Mac, Linux. Same experience on all platforms. Install as PWA or just bookmark it. No app store needed.
  - icon: 🧠
    title: FMS-Level Intelligence
    details: Type "KALB PAYGE Q822 FNT WYNDE3 KORD" and watch it auto-expand the SID/STAR, resolve all airway waypoints, and calculate wind-corrected headings. Just like a real FMS.
  - icon: ✈️
    title: Built by Pilots
    details: Real IFR route syntax. Multi-altitude wind interpolation. Auto-waypoint advancement. One-tap diversions. Automatic flight logging. Features pilots actually need, not marketing fluff.
---

# InFlight: Your Free, In-browser EFB

**TL;DR:** If you've ever wanted ForeFlight's route planning without the subscription, or SkyVector's interface but offline-capable, this is it.

InFlight is a web-based flight planning tool that works like an EFB should: **in-browser, offline-capable, and actually useful in the cockpit**. No login required, no servers, no cloud sync nonsense. Just load the data once and you're good to go—even with airplane mode on. Open source and free forever.

## What Makes This Different?

### It Understands Your Routes

Type a route like:
```text
KILN APE EWC ETG J217 HNK STELA1 KBDL
```

Hit COMPUTE and it:
- Auto-expands the SID from KBOS runway 04R/22L
- Resolves the STAR transition into KLGA based on your arrival fix
- Fills in all the intermediate fixes on V3 and J57
- Calculates magnetic courses, distances, and fuel burn for each leg

**No manual waypoint entry.** It's not a calculator you feed data into—it's a flight planner that does the work.

### Context-Aware Autocomplete

When you're building a route, the autocomplete **actually helps** instead of overwhelming you:

- After typing a fix, it shows airways **that depart from that fix**
- After typing an airway, it shows fixes **on that airway**
- Want to file direct? Type `DCT` and pick any airport/navaid/waypoint

This is how FMS autocomplete works. This is **not** how most flight planning websites work.

### Winds Aloft

The app interpolates between altitudes for each leg. If you're climbing from 4,000 to 7,000 feet over a 40nm segment, it calculates the **blended wind** for that leg—not just one altitude's wind.

This matters for fuel planning. A lot.

### Real GPS Navigation

Enable GPS and the map becomes a moving map display:

- **Auto-waypoint advancement**: Switches to the next leg when you pass abeam the current fix
- **Distance/bearing to active waypoint**: Updates in real-time
- **TTS announcements**: Optional voice callouts for waypoint passage (great for single-pilot IFR)
- **One-tap diversion**: Click any airport to compute a new route from your current position

It's not trying to be a primary navigation instrument, but it's **way** better than fumbling with a paper chart in IMC.

### Automatic Flight Logging

When you enable GPS tracking:

1. **Takeoff detection**: Starts logging when you hit 50+ knots groundspeed
2. **Flight tracking**: Records actual track, times, and fuel burn
3. **Landing detection**: Stops logging when you slow below 30 knots
4. **GeoJSON export**: Download your actual flight path for analysis (import into Google Earth, flight debrief tools, etc.)

No "start flight" button to forget. It just works.

## Practical Workflows

### VFR Cross-Country Planning

1. Enter route: `KSFO KHAF` (or any VFR route)
2. Load winds aloft from your weather briefing
3. Set aircraft performance (TAS, fuel burn)
4. Get navlog with magnetic headings, times, and fuel for each leg

Print the navlog or keep it on your iPad. Works offline, no subscription.

### IFR with Procedures

1. Enter filed route: `KALB PAYGE Q822 FNT WYNDE3 KORD`
2. App expands SID/STAR and resolves all airway waypoints
3. Review the full route with all intermediate fixes
4. Use the navlog for your flight plan form or tablet backup

If ATC amends your route, just edit and recompute. Takes 10 seconds.

### In-Flight Diversion Planning

1. Enable GPS on the MAP tab
2. Encounter weather/emergency
3. Click nearest suitable airport
4. App computes direct route with updated fuel/time
5. Brief the approach while still navigating

The fuel calculations update automatically based on your current fuel state.

### Altitude Selection for Winds

1. Load winds aloft for multiple altitudes
2. Enter different cruising altitudes in the NAVLOG tab
3. Compare actual ground speeds and fuel burn
4. Pick the most efficient altitude before calling ATC

Most online planners make you do this manually. InFlight just shows you the numbers.

## What It's NOT

Let's be clear about limitations:

- **Not certified for primary navigation**: This is a planning tool, not an IFR-certified GPS
- **Not a full EFB replacement**: No approach plates, A/FD, or weather imagery
- **Not a cloud service**: Your flight plans live in your browser only (export as JSON to save)
- **Not a weather briefer**: You bring the winds/weather; the app does the math

Think of it as **the route planning and navlog part of ForeFlight**, but free and offline.

## Who This Is For

- **Student pilots** learning cross-country planning (beats the E6B for ground speed calculations)
- **IFR pilots** who want a free route planner that understands airways and procedures
- **CFIIs** teaching students how FMS route entry works
- **Pilots with iPads** who want a backup EFB without paying for a second subscription
- **International pilots** who need global airport/navaid data without regional restrictions

If you've ever been frustrated by flight planning websites that:
- Don't understand SID/STAR syntax
- Make you click through 15 waypoints to file an airway
- Don't work offline
- Charge $99/year for basic features

...then this might be your new favorite tool.

## Quick Links

### For Pilots

- **[Quick Start Guide](user-guide/quick-start)** - Get flying in 5 minutes
- **[ROUTE Tab Guide](user-guide/tab-route)** - Master route entry syntax
- **[NAVLOG Tab Guide](user-guide/tab-navlog)** - Customize your navigation log
- **[MAP Tab Guide](user-guide/tab-map)** - Use GPS moving map features
- **[FAQ](user-guide/faq)** - Common questions answered

### For Developers

- **[Design Principles](developer/01-design-principles)** - Philosophy and goals
- **[Architecture Overview](developer/02-architecture)** - How it's built
- **[Route Processing](developer/04-route-processing)** - Parser internals
- **[Testing & Deployment](developer/06-testing-deployment)** - Host your own instance
- **[Contributing Guide](CONTRIBUTING)** - Submit improvements

## Technical Highlights

For the curious:

- **Offline-first PWA**: Install it, load the data once, use it forever—even in airplane mode
- **70,000+ airports**: Full global database (ICAO/IATA codes, frequencies, runways)
- **10,000+ navaids**: VOR, NDB, DME, TACAN with accurate coordinates
- **Vincenty's formula**: Proper geodetic distance on WGS84 ellipsoid (not flat-earth math)
- **WMM2025 magnetic variation**: Accurate magnetic courses anywhere on Earth
- **Client-side only**: No server, no login, no tracking. Your routes stay on your device.

## Get Started

1. **Load the app** - [inflight.pages.dev](https://inflight.pages.dev) (or your local deployment)
2. **Click "LOAD DATA"** - Fetches airport/navaid database (one-time, ~5MB)
3. **Enter a route** - Try: `KSFO JCOBY4 BSR J501 DRK WYNDE3 KLAS`
4. **Hit COMPUTE** - Watch it expand into a full IFR flight plan

That's it. No signup, no payment info, no tutorial wizard. Just planning.

---

**Open Source • MIT Licensed • Free Forever**

[View on GitHub](https://github.com/HisenZhang/inflight) | [Report Issues](https://github.com/HisenZhang/inflight/issues)
