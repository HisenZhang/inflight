# Quick Start: Plan Your First Flight in 5 Minutes

This guide assumes you're a pilot who knows what a navlog is and has filed flight plans before. If you just want to see how InFlight works, follow along with the example route below.

## Example Flight: San Francisco to Las Vegas (IFR)

We'll plan **KSFO → KLAS** with the OFFSHORE TWO departure and KEPEC THREE arrival.

### Step 1: Load the Database (One-Time Setup)

Before planning any route, you need the airport/navaid database:

1. Click [**DATA**](tab-data) tab
2. Click **LOAD DATA** button
3. Wait ~10-30 seconds for download
4. Confirm you see database stats (70,000+ airports, 10,000+ navaids)

**This is a one-time step.** Data is cached in your browser—even works offline afterward.

### Step 2: Enter the Route

Click [**ROUTE**](tab-route) tab and enter:

**Filed Route:**
```
KSFO JCOBY4 BSR J501 DRK WYNDE3 KLAS
```

**What this means:**
- Depart KALB departure
- Proceed to BSR (Big Sur VOR)
- Fly airway J501 to DRK (Drakesbad VOR)
- Arrive KORD via WYNDE THREE arrival

**Enter it like this:**
- **Departure:** `KSFO`
- **Route:** `JCOBY4 BSR J501 DRK WYNDE3`
- **Destination:** `KLAS`

Hit **COMPUTE**.

**What happens:**
- App auto-expands JCOBY4 SID (all transition fixes)
- Expands all intermediate fixes on J501
- Auto-expands WYNDE3 STAR
- Calculates distance/bearing for each leg
- Applies magnetic variation (WMM2025)

You should see a green success message and waypoint count.

### Step 3: Add Aircraft Performance (Optional but Recommended)

Scroll down in the ROUTE tab and expand **"Wind Correction & Time"**:

**For a typical light single (C172, PA28, etc.):**
- **Cruise Altitude:** `9500` (IFR eastbound)
- **True Airspeed:** `120` knots
- **Forecast Period:** Select based on your departure time

Click **COMPUTE** again.

**What happens:**
- App fetches winds aloft from NOAA for your altitude
- Calculates wind-corrected headings and ground speeds
- Estimates time en route for each leg

**No internet?** You can manually enter winds in the NAVLOG tab later.

### Step 4: Add Fuel Planning (Optional)

If you want fuel calculations, expand **"Fuel Planning"** in ROUTE tab:

**Example for C172:**
- **Fuel Capacity:** `40` gallons
- **Fuel Burn Rate:** `8.5` GPH
- **Reserve Fuel:** `5` gallons (45 min VFR, adjust for IFR)
- **Starting Fuel:** `38` gallons (if not full)

Click **COMPUTE** again.

**What happens:**
- Calculates fuel burn for each leg
- Shows fuel remaining at each waypoint
- Warns if you don't have enough fuel + reserves

### Step 5: Review the Navigation Log

Click [**NAVLOG**](tab-navlog) tab.

You'll see a table like this:

| Waypoint | Type | Freq | MC | Dist | GS | ETE | Fuel |
|----------|------|------|----|----|----|----|------|
| KSFO | APT | — | — | — | — | — | 38.0 |
| GROVE | FIX | — | 232° | 12nm | 118kt | 0:06 | 37.2 |
| BSR | VOR | 114.8 | 141° | 97nm | 125kt | 0:46 | 30.7 |
| ... | ... | ... | ... | ... | ... | ... | ... |

**What to look for:**
- **MC (Magnetic Course):** Heading to fly (wind-corrected if enabled)
- **Dist:** Distance from previous waypoint
- **GS (Ground Speed):** Accounts for wind
- **ETE (Estimated Time En Route):** For each leg
- **Fuel:** Remaining at each waypoint

**Click airport codes** to open AirNav for runway/frequency info.

### Step 6: View the Route on the Map

Click [**MAP**](tab-map) tab.

You'll see your route plotted on an interactive map with:
- Departure and arrival airports (blue/green markers)
- Route line connecting all waypoints
- Zoom controls (ROUTE, DEST, 50NM, 25NM)

**To enable GPS tracking:**
1. Click **"Enable GPS"** button
2. Grant location permission in browser
3. Your position appears as a cyan aircraft symbol
4. Distance/bearing to next waypoint updates live

### Step 7: Fly the Route (GPS Tracking)

Once GPS is enabled:

**Moving Map Features:**
- **Auto-waypoint advancement:** App automatically switches to next waypoint when you pass within ~2nm
- **TTS announcements:** Optional voice callouts ("Approaching GROVE, next waypoint BSR, heading 141")
- **Haptic feedback:** Device vibrates on waypoint passage (mobile devices)

**Navigation Panel (left side):**
- Shows next waypoint
- Required magnetic heading
- Distance and time remaining
- Current ground speed
- GPS accuracy

**Quick Diversion:**
- Click any airport on the map
- App instantly computes direct route with fuel/time

### Step 8: Export Your Flight (Optional)

After landing, go to [**DATA**](tab-data) tab:

- Click **"Flight Tracks"** section
- Your flight is automatically saved
- Click **"Export"** to download GeoJSON
- Import into Google Earth, ForeFlight, or other tools for post-flight analysis

## VFR Example: Palo Alto to Hayward

For a simple VFR flight, the process is even easier:

**ROUTE tab:**
- **Departure:** `KPAO`
- **Route:** `VPFYI` (visual checkpoint: Dumbarton Bridge)
- **Destination:** `KHWD`
- Click **COMPUTE**

**Add winds manually in NAVLOG tab** (if no internet):
- Click "Add Wind" button
- Enter altitude, direction, speed (e.g., "3000ft, 280°, 15kt")

That's it. Print the navlog or keep it on your iPad.

## Common Workflows

### Filing IFR: Build the Route String

InFlight's autocomplete helps you build routes quickly:

1. Type departure airport: `KBOS`
2. Type SID name: Start typing `SSOXS` → autocomplete shows PAYGE
3. Type last SID fix: `SSOXS`
4. Type airway: Start typing `V3` → autocomplete shows airways from SSOXS
5. Type next fix: Start typing on V3 → autocomplete shows only fixes on V3
6. Continue building route...
7. Type STAR: `LENDY6`
8. Type destination: `KLGA`

**Result:** `KBOS PAYGE SSOXS V3 SAX J57 LRP LENDY6 KLGA`

### Checking a Pre-Filed Route

Already have a route from ForeFlight/FltPlan? Paste it into InFlight to verify:

1. Copy route string from your EFB
2. Paste into InFlight ROUTE tab
3. Hit COMPUTE
4. Compare navlog distance/times with your EFB

Useful as a cross-check before departure.

### Planning Multiple Altitudes

Want to see if 7,500 or 9,500 is better for winds?

1. Enter route with altitude `7500`, click COMPUTE
2. Go to NAVLOG, note total time and fuel
3. Go back to ROUTE, change altitude to `9500`, click COMPUTE
4. Compare NAVLOG results

Pick the most efficient altitude, then file.

### Pre-Loading for Offline Use

Going somewhere with no cell service? Pre-load your route:

1. Plan route while connected to internet
2. Load winds aloft (automatic if connected)
3. Install app as PWA (browser prompts, or use browser menu)
4. Route data is now cached offline
5. Turn on airplane mode → app still works

Great for remote airports or in-flight use.

## Tips for New Users

**Route Entry:**
- You can use `DCT` for direct routing: `KSFO DCT KOAK` means direct from SFO to Oakland
- Separate waypoints with spaces, not commas
- Airport codes can be ICAO (KSFO) or IATA (SFO)—both work
- If route won't compute, check for typos in waypoint names

**Winds Aloft:**
- If automatic wind fetch fails, enter winds manually in NAVLOG tab
- You can enter multiple wind layers (3000ft, 6000ft, 9000ft) for better accuracy
- App interpolates between altitudes for climbing/descending legs

**GPS Tracking:**
- Works best on mobile devices (phone/tablet)
- Desktop GPS accuracy depends on WiFi positioning (less accurate)
- You must grant location permission in browser settings
- For best results, use tablet with cellular GPS (even without SIM)

**Fuel Planning:**
- "Reserve" means fuel you won't use (VFR: 30-45min, IFR: 45min-1hr+)
- App warns if fuel remaining drops below reserve
- Fuel calculations assume constant power/mixture—adjust in cruise

**Database Updates:**
- Data from OurAirports (community-maintained)
- Reload database weekly/monthly for updated info
- Always verify critical data (frequencies, runway lengths) against current charts

## What's Next?

Now that you've planned a basic flight, learn more about specific features:

- **[ROUTE Tab Guide](tab-route)** - Master route syntax, autocomplete, procedures
- **[NAVLOG Tab Guide](tab-navlog)** - Customize navlog, add winds, interpret data
- **[MAP Tab Guide](tab-map)** - GPS features, zoom controls, diversions
- **[FAQ](faq)** - Common questions answered

---

**Still confused?** Check [Troubleshooting](troubleshooting) or [open an issue on GitHub](https://github.com/HisenZhang/inflight/issues).
