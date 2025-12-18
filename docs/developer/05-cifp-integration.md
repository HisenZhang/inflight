# CIFP Integration Guide

## Overview

IN-FLIGHT uses **FAA CIFP** (Coded Instrument Flight Procedures) data selectively for:
- **MORA Grid** - Minimum Off-Route Altitude (official FAA source)
- **Airspace** - Controlled airspace (Class B/C/D) and Special Use Airspace
- **Procedures** - SIDs, STARs, and Approach procedures

CIFP data is loaded **in addition to** NASR, not as a replacement. NASR provides basic airport/navaid data, while CIFP provides procedure geometry and airspace boundaries.

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ DataManager                                                  │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  NASR    │  │OurAirpts │  │  CIFP    │                  │
│  │ (25 MB)  │  │ (5 MB)   │  │ (9 MB)   │                  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
│       │             │             │                         │
│       ▼             ▼             ▼                         │
│  ┌─────────────────────────────────────┐                   │
│  │  Merged Aviation Database           │                   │
│  │  - Airports (NASR + OurAirports)    │                   │
│  │  - Navaids (NASR)                   │                   │
│  │  - Fixes (NASR)                     │                   │
│  │  - Airways (NASR)                   │                   │
│  │  - MORA Grid (CIFP)        ← NEW    │                   │
│  │  - Airspaces (CIFP)        ← NEW    │                   │
│  │  - Procedures (CIFP)       ← NEW    │                   │
│  └─────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### CIFP Data Source

**File:** [data/sources/cifp-source.js](../../data/sources/cifp-source.js)

```javascript
class CIFPSource extends window.DataSource {
    async fetch() {
        // Download FAACIFP18 from FAA or proxy
        const response = await fetch(`${CIFP_BASE_URL}/FAACIFP18`);
        return await response.text();
    }

    async parse(rawData) {
        // Parse ARINC 424-18 records
        return {
            moraGrid: Map,       // AS records
            airspaces: Map,      // UC records
            suaAirspaces: Map,   // UR records
            sids: Map,           // PD records
            stars: Map,          // PE records
            approaches: Map      // PF/HF records
        };
    }
}
```

## ARINC 424 Format

### Record Structure

CIFP uses **ARINC 424-18** format:
- **132 bytes per record** (fixed-width)
- **Section codes** identify record type (col 5-6)
- **Continuation records** for complex data

### Example Record

```
SUSAAS                          N49000000W124000000                      05700
│││││└─ Section Code (AS = MORA)
│││└─── ICAO Code
││└──── Customer/Area Code (USA)
│└───── Record Type (S = Standard)
└────── Customer Code
```

### Supported Section Codes

| Code | Type | Description | Implementation |
|------|------|-------------|----------------|
| **AS** | MORA | Grid MORA (1° grid) | ✅ Implemented |
| **UC** | Airspace | Controlled airspace (Class B/C/D) | ✅ Implemented |
| **UR** | Airspace | Special use airspace (MOA, Restricted, etc.) | ✅ Implemented |
| **PD** | Procedure | SID (Standard Instrument Departure) | ✅ Implemented |
| **PE** | Procedure | STAR (Standard Terminal Arrival) | ✅ Implemented |
| **PF** | Procedure | Approach (airport) | ✅ Implemented |
| **HF** | Procedure | Approach (heliport) | ✅ Implemented |

## Coordinate Parsing

CIFP uses degrees/minutes/seconds format:

### Latitude (9 chars)
```
N47384725 = N 47° 38' 47.25"
│└─┬──┬──┬─
│  │  │  └─ Hundredths of seconds (25)
│  │  └──── Seconds (47)
│  └─────── Minutes (38)
└────────── Hemisphere (N/S)
Result: 47.6464583°
```

### Longitude (10 chars)
```
W122182910 = W 122° 18' 29.10"
│ └─┬──┬──┬─
│   │  │  └─ Hundredths of seconds (10)
│   │  └──── Seconds (29)
│   └─────── Minutes (18)
└─────────── Hemisphere (E/W)
Result: -122.3080833°
```

### Implementation

[data/sources/cifp-source.js:442-472](../../data/sources/cifp-source.js#L442-L472)

```javascript
_parseLatitude(str) {
    const hemisphere = str[0];
    const degrees = parseInt(str.substring(1, 3));
    const minutes = parseInt(str.substring(3, 5));
    const seconds = parseInt(str.substring(5, 7));
    const hundredths = parseInt(str.substring(7, 9));

    let lat = degrees + (minutes / 60) + ((seconds + hundredths / 100) / 3600);
    if (hemisphere === 'S') lat = -lat;
    return lat;
}
```

## MORA Grid (AS Records)

### Data Structure

```javascript
moraGrid: Map {
    "49,-124" => {
        lat: 49,      // SW corner latitude
        lon: -124,    // SW corner longitude
        mora: 5700,   // MORA in feet
        source: 'cifp'
    }
}
```

### Grid System

- **Size:** 1° × 1° grid (matches FAA CIFP specification)
- **Key:** SW corner coordinates (e.g., "49,-124")
- **Coverage:** Global (US from FAA CIFP, worldwide from terrain-derived)
- **Update:** Every 28 days (AIRAC cycle)

### Usage

[compute/terrain-analyzer.js:300-341](../../compute/terrain-analyzer.js#L300-L341)

```javascript
// TerrainAnalyzer now accepts CIFP MORA data
await TerrainAnalyzer.loadMORAData(cifpMoraGrid);

// Lookup MORA for a coordinate
const mora = TerrainAnalyzer.getMORAForLocation(lat, lon);
console.log(`MORA: ${mora} feet`);
```

### Fallback Strategy

1. **Try IndexedDB cache** (offline)
2. **Use CIFP data** if available (preferred)
3. **Fetch NASR CSV** as fallback

## Airspace (UC/UR Records)

### Controlled Airspace (UC)

**Class B/C/D airspace with precise boundaries**

```javascript
airspaces: Map {
    "KSEA_C_1" => {
        icao: "KSEA",
        type: "C",           // Class C
        center: "SEA",
        lowerLimit: "SFC",   // Surface
        lowerUnit: "A",      // AGL
        upperLimit: "04100", // 4,100 feet
        upperUnit: "M",      // MSL
        boundary: [
            {
                lat: 47.6464583,
                lon: -122.3080833,
                boundaryCode: "C", // Circle
                seqNum: 1
            },
            // ... more boundary points
        ]
    }
}
```

**Boundary Codes:**
- `C` - Circle (center + radius)
- `G` - Great circle
- `H` - Rhumb line
- `L` - Arc (left/right)

### Special Use Airspace (UR)

**MOA, Restricted, Warning, etc.**

```javascript
suaAirspaces: Map {
    "R-2501_R" => {
        designation: "R-2501",
        type: "R",          // Restricted
        timeCode: "C",      // Continuous (blank = part-time)
        boundary: [...]
    }
}
```

**SUA Types:**
- `A` - Alert Area
- `M` - MOA (Military Operations Area)
- `P` - Prohibited
- `R` - Restricted
- `W` - Warning
- `U` - Special Air Traffic Rule (SATR)

### Future: Map Display

*Not yet implemented - placeholder for v3.5*

```javascript
// display/map-display.js (future)
function drawAirspace(airspace) {
    // Render airspace boundary on map
    // Support circles, arcs, great circles
}
```

## Procedures (PD/PE/PF/HF Records)

### SID (PD Records)

**Standard Instrument Departure**

```javascript
sids: Map {
    "KSEA_HAROB3_" => {
        airport: "KSEA",
        ident: "HAROB3",
        routeType: "1",     // Engine-out SID
        transition: "",     // Common route
        waypoints: [
            {
                seqNum: 10,
                ident: "HAROB",
                icao: "EA",     // Enroute waypoint
                pathTerminator: "IF" // Initial Fix
            },
            // ... more waypoints
        ]
    }
}
```

### STAR (PE Records)

**Standard Terminal Arrival Route**

```javascript
stars: Map {
    "KLAD_LENDY4_" => {
        airport: "KLAD",
        ident: "LENDY4",
        routeType: "1",
        transition: "",
        waypoints: [...]
    }
}
```

### Approaches (PF/HF Records)

**Instrument Approach Procedures**

```javascript
approaches: Map {
    "KSEA_D16I_RW16L" => {
        airport: "KSEA",
        ident: "D16I",      // ILS or LOC DME RWY 16L
        routeType: "I",     // ILS
        runway: "RW16L",
        waypoints: [
            {
                seqNum: 10,
                ident: "ISEAT",
                pathTerminator: "CF", // Course to Fix
                altitude: "10000",
                altitudeDescriptor: "+" // At or above
            },
            // ... more waypoints
        ]
    }
}
```

### Path Terminators

ARINC 424 defines **leg types** for procedure geometry:

| Code | Description | Example |
|------|-------------|---------|
| `IF` | Initial Fix | Start of procedure |
| `TF` | Track to Fix | Direct to waypoint |
| `CF` | Course to Fix | Fly heading to waypoint |
| `RF` | Radius to Fix | Curved path (RNAV) |
| `AF` | Arc to Fix | DME arc |
| `CA` | Course to Altitude | Climb on heading |
| `FA` | Fix to Altitude | Climb to altitude |
| `FM` | Fix to Manual | Vectors expected |
| `VM` | Heading to Manual | Fly heading until vectors |
| `HA` | Hold to Altitude | Holding pattern |
| `HF` | Hold to Fix | Holding pattern |
| `HM` | Hold to Manual | Holding pattern |

### Future: Procedure Visualization

*Not yet implemented - placeholder for v3.6*

```javascript
// compute/procedures.js (future)
const ProcedureEngine = {
    decodeLeg(pathTerminator, leg) {
        switch (pathTerminator) {
            case 'TF': return this.trackToFix(leg);
            case 'RF': return this.radiusToFix(leg);
            case 'CF': return this.courseToFix(leg);
            // ...
        }
    }
};
```

## Update Cycle

CIFP data follows **AIRAC (Aeronautical Information Regulation And Control)** cycle:

- **Update Frequency:** Every 28 days
- **Effective Date:** Documented in CIFP file
- **Download URL:** `https://nasr.hisenz.com/cifp/FAACIFP18`

### Version Management

[data/sources/cifp-source.js:67-78](../../data/sources/cifp-source.js#L67-L78)

```javascript
{
    cycle: "2513",              // YYMM + cycle (1-13)
    effectiveDate: "2025-12-25",
    expiryDate: "2026-01-22",   // +28 days
    recordTypes: ['AS', 'UC', 'UR', 'PD', 'PE', 'PF', 'HF']
}
```

## Testing

### Unit Tests

[tests/test-cifp-parser.js](../../tests/test-cifp-parser.js)

```bash
npm test               # Run all tests
npm run test:browser   # Interactive browser tests
```

**Test Coverage:**
- ✅ ARINC 424 coordinate parsing (lat/lon)
- ✅ MORA record parsing (AS)
- ✅ Controlled airspace parsing (UC)
- ✅ Special use airspace parsing (UR)
- ✅ SID/STAR/Approach parsing (PD/PE/PF/HF)
- ✅ Data validation
- ✅ Expiry date calculation

### Manual Testing

```javascript
// Browser console
const cifp = new CIFPSource();
const data = await cifp.load();

console.log('MORA Grid:', data.moraGrid.size);
console.log('Airspaces:', data.airspaces.size);
console.log('SIDs:', data.sids.size);
console.log('STARs:', data.stars.size);
console.log('Approaches:', data.approaches.size);
```

## Data Size Comparison

### Current Implementation (v3.5+)

| Source | Files | Size (compressed) | Records | Purpose |
|--------|-------|-------------------|---------|---------|
| **NASR** | 5 CSV files | **31.0 MB** | ~120,000 | Airports, Navaids, Fixes, Frequencies |
| OurAirports | 4 CSV files | ~5 MB | ~45,000 | Worldwide airports (supplement) |
| **CIFP** | FAACIFP18 | **9.1 MB** | ~100,000 | Airways, Procedures, Airspace, MORA |
| **Total** | 10 files | **45.1 MB** | **~265,000** | Complete aviation database |

### What Changed

**Old (pre-CIFP):**
- NASR: 9 CSV files (34.6 MB) - All procedures from CSV
- Airways, SIDs, STARs from NASR CSV format

**New (CIFP primary):**
- NASR: 5 CSV files (31.0 MB) - **10.5% smaller!**
- CIFP: FAACIFP18 (9.1 MB) - Official FAA ARINC 424 format
- **Net increase: +5.1 MB** for official FAA procedures

### Files Removed from NASR

These are now provided by CIFP (better quality):
- ❌ `AWY_BASE.csv` - Airways (now CIFP ER records)
- ❌ `STAR_RTE.csv` - STARs (now CIFP PE records)
- ❌ `DP_RTE.csv` - SIDs (now CIFP PD records)
- ❌ `CLS_ARSP.csv` - Airspace (now CIFP UC records)

### Storage Efficiency

- CIFP is **official FAA source** (ARINC 424-18)
- CIFP includes **precise procedure geometry** (path terminators)
- CIFP includes **altitude constraints** for approaches
- CIFP airways are **up-to-date** (28-day AIRAC cycle)
- NASR download is **faster** (fewer files, smaller size)

## Future Enhancements

### v3.5: Airspace Display
- [ ] Render controlled airspace on map
- [ ] Render special use airspace
- [ ] Support arc/circle boundary types
- [ ] Altitude-aware filtering

### v3.6: Procedure Visualization
- [ ] Display SID/STAR routes on map
- [ ] Display approach procedures
- [ ] Path terminator engine (TF, RF, CF, etc.)
- [ ] Altitude constraint visualization

### v3.7: Advanced Features
- [ ] Vertical guidance (VNAV)
- [ ] LPV approach minimums
- [ ] RNP AR procedures
- [ ] Procedure turn calculations

## References

- [ARINC 424-18 Specification](https://aviation-ia.com/aeec/projects/spec424/)
- [FAA CIFP Download](https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/cifp/download/)
- [CIFP Readme (PDF)](https://aeronav.faa.gov/Upload_313-d/cifp/CIFP%20Readme.pdf)
- [AIRAC Cycle Schedule](https://aeronav.faa.gov/content/aeronav/DOLES/Product_Schedule.pdf)

---

**Last Updated:** 2025-12-08
**IN-FLIGHT Version:** v3.4.1 (CIFP integration)
