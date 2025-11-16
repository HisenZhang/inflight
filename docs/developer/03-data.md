# Data Sources and Management

## Overview

InFlight stores all aviation data locally in IndexedDB after a one-time download. The data layer uses a two-source strategy: FAA NASR data (primary) and OurAirports (fallback/supplement).

## Data Sources

### Primary: NASR (FAA National Airspace System Resources)

**Endpoint:** `https://nasr.hisenz.com`

NASR provides authoritative US aviation data updated every 28 days.

**Files Downloaded (8 CSV files):**

| File | Purpose | Records | Size |
|------|---------|---------|------|
| `APT_BASE.csv` | US airports | ~70,000 | ~15MB |
| `APT_RWY.csv` | Runway data | ~25,000 | ~3MB |
| `NAV_BASE.csv` | Navaids (VOR/NDB) | ~10,000 | ~2MB |
| `FIX_BASE.csv` | IFR waypoints | ~15,000 | ~1MB |
| `FRQ.csv` | Airport frequencies | ~30,000 | ~2MB |
| `AWY_BASE.csv` | Airways | ~800 | ~500KB |
| `STAR_RTE.csv` | STAR procedures | ~2,000 | ~1MB |
| `DP_RTE.csv` | Departure procedures | ~1,500 | ~1MB |

**Implementation:** [data/nasr-adapter.js:577-666](../../data/nasr-adapter.js#L577-L666)

### Fallback: OurAirports

**Source:** GitHub repository via CORS proxy

**Purpose:** Supplements NASR with worldwide airport coverage.

**Files Downloaded (4 CSV files):**

| File | Purpose | Records |
|------|---------|---------|
| `airports.csv` | Worldwide airports | ~45,000 |
| `navaids.csv` | Worldwide navaids | ~10,000 |
| `airport-frequencies.csv` | Frequencies | ~30,000 |
| `runways.csv` | Runway data | ~40,000 |

**Implementation:** [data/ourairports-adapter.js:223-306](../../data/ourairports-adapter.js#L223-L306)

### Loading Strategy

Both sources download in parallel using `Promise.allSettled()`:

```javascript
const [nasrResult, oaResult] = await Promise.allSettled([
    NASRAdapter.loadNASRData(),
    OurAirportsAdapter.loadOurAirportsData()
]);
```

**Fallback Behavior:**
- **NASR + OurAirports** → Merge both (best case)
- **NASR only** → US coverage only (acceptable)
- **OurAirports only** → Worldwide but less accurate US data
- **Both fail** → Critical error (app cannot function)

## CSV Parsing

### NASR Format

NASR uses RFC 4180 CSV with quoted fields:

```csv
ARPT_ID,ICAO_ID,ARPT_NAME,LAT_DECIMAL,LONG_DECIMAL,ELEV
"00A","","Arroyo Seco Municipal",34.32,-115.89,420
```

**Parser:** [data/nasr-adapter.js:8-26](../../data/nasr-adapter.js#L8-L26)

```javascript
function parseNASRCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result.map(val => val.trim());
}
```

### Data Transformations

#### Frequency Conversion

NASR stores VOR frequencies in kilohertz; InFlight converts to megahertz:

**Implementation:** [data/nasr-adapter.js:194-200](../../data/nasr-adapter.js#L194-L200)

```javascript
// NASR stores: 110200 (kHz)
// InFlight stores: 110.2 (MHz)
if (frequency && frequency >= 10000 && navaidType !== 'NDB') {
    frequency = frequency / 1000;
}
```

#### Procedure Sequence Reversal

NASR stores STAR/DP procedures **backwards** (runway → entry fix). InFlight reverses them to normal flight direction:

**Implementation:** [data/nasr-adapter.js:409-410](../../data/nasr-adapter.js#L409-L410)

```javascript
// NASR order: RUNWAY → FIX3 → FIX2 → FIX1 (backwards)
// InFlight order: FIX1 → FIX2 → FIX3 → RUNWAY (normal)
fixNames.reverse();
```

## IndexedDB Schema

### Database Configuration

**Constants:** [data/data-manager.js:4-7](../../data/data-manager.js#L4-L7)

```javascript
const DB_NAME = 'FlightPlanningDB';
const DB_VERSION = 7;
const STORE_NAME = 'flightdata';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;  // 7 days
```

### Single Object Store Design

InFlight uses a **simplified schema** with one object store containing one cache document:

```javascript
IndexedDB: FlightPlanningDB (version 7)
  └── Object Store: flightdata
      └── Document: flightdata_cache_v9
          ├── airports: [[code, {...}], ...]  // Serialized Map
          ├── navaids: [[ident, {...}], ...]
          ├── fixes: [[ident, {...}], ...]
          ├── airways: [[id, {...}], ...]
          ├── stars: [[id, {...}], ...]
          ├── dps: [[id, {...}], ...]
          ├── frequencies: [[code, [...]], ...]
          ├── runways: [[code, [...]], ...]
          ├── timestamp: 1699564823000
          ├── version: 9
          ├── fileMetadata: {...}
          └── rawCSV: {...}  // Raw CSV strings for reindexing
```

**Why one document?**
- Simpler than managing 11 separate stores
- Atomic cache updates (all-or-nothing)
- Faster serialization/deserialization

### Initialization

**Implementation:** [data/data-manager.js:34-49](../../data/data-manager.js#L34-L49)

```javascript
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
```

## In-Memory Data Structures

All data is kept in JavaScript Maps for O(1) lookups:

**Globals:** [data/data-manager.js:13-28](../../data/data-manager.js#L13-L28)

```javascript
let airportsData = new Map();      // Map<icaoCode, airport>
let iataToIcao = new Map();        // Map<iata, icao> (JFK → KJFK)
let navaidsData = new Map();       // Map<ident, navaid>
let fixesData = new Map();         // Map<ident, fix>
let frequenciesData = new Map();   // Map<code, frequency[]>
let runwaysData = new Map();       // Map<code, runway[]>
let airwaysData = new Map();       // Map<airwayId, {id, fixes[]}>
let starsData = new Map();         // Map<procedureKey, starData>
let dpsData = new Map();           // Map<procedureKey, dpData>
let tokenTypeMap = new Map();      // Map<token, type> (fast lookup)
```

**Example Data:**

```javascript
// airportsData.get('KJFK')
{
    id: 'nasr_KJFK',
    icao: 'KJFK',
    type: 'medium_airport',
    name: 'John F Kennedy International',
    lat: 40.6413,
    lon: -73.7781,
    elevation: 13,  // feet MSL
    municipality: 'New York',
    country: 'US',
    waypointType: 'airport',
    source: 'nasr'
}

// navaidsData.get('DPA')
{
    id: 'nasr_nav_DPA',
    ident: 'DPA',
    name: 'Dupage',
    type: 'VOR',
    lat: 41.9845,
    lon: -88.0876,
    elevation: 689,
    frequency: 110.2,  // MHz
    country: 'US',
    waypointType: 'navaid',
    source: 'nasr'
}

// tokenTypeMap.get('KJFK')
'AIRPORT'

// tokenTypeMap.get('V25')
'AIRWAY'
```

## Data Merge Strategy

**Function:** [data/data-manager.js:275-403](../../data/data-manager.js#L275-L403)

### Priority Rules

1. **NASR has priority** → US airports/navaids are authoritative
2. **OurAirports fills gaps** → Adds missing international data
3. **No overwrites** → If NASR has entry, OurAirports skipped

### Merge Algorithm

```javascript
// 1. Index NASR data first (priority)
if (nasrData) {
    for (const [code, airport] of nasrData.data.airports) {
        airportsData.set(code, airport);
    }
    // ... navaids, fixes, airways, STARs, DPs
}

// 2. Merge OurAirports (selective - only missing)
if (ourairportsData) {
    for (const [code, airport] of ourairportsData.data.airports) {
        if (!airportsData.has(code)) {  // Check if missing
            airportsData.set(code, airport);
        }
    }
    // ... same for navaids
}
```

**Result:** ~90,000 worldwide airports (70K NASR + 20K OurAirports)

## Token Type Map

The token type map enables O(1) lookups for route parsing and autocomplete.

**Building:** [data/data-manager.js:551-636](../../data/data-manager.js#L551-L636)

```javascript
function buildTokenTypeMap() {
    tokenTypeMap.clear();

    // 1. Airports (4-letter ICAO codes)
    for (const [code, airport] of airportsData) {
        // Include KJFK, exclude JFK (IATA) to avoid ambiguity
        if (code.length >= 4 || (code.length === 3 && /\d/.test(code))) {
            tokenTypeMap.set(code, 'AIRPORT');
        }
    }

    // 2. Navaids
    for (const [ident, navaid] of navaidsData) {
        if (!tokenTypeMap.has(ident)) {
            tokenTypeMap.set(ident, 'NAVAID');
        }
    }

    // 3. Fixes
    for (const [ident, fix] of fixesData) {
        if (!tokenTypeMap.has(ident)) {
            tokenTypeMap.set(ident, 'FIX');
        }
    }

    // 4. Airways
    for (const [id, airway] of airwaysData) {
        tokenTypeMap.set(id, 'AIRWAY');
    }

    // 5. Procedures (STARs and DPs) - Two keys per procedure
    for (const [id, star] of starsData) {
        tokenTypeMap.set(id, 'PROCEDURE');           // GLAND.BLUMS5
        tokenTypeMap.set(star.name, 'PROCEDURE');    // BLUMS5
    }
}
```

**Usage:**

```javascript
DataManager.getTokenType('KJFK')    // → 'AIRPORT'
DataManager.getTokenType('DPA')     // → 'NAVAID'
DataManager.getTokenType('V25')     // → 'AIRWAY'
DataManager.getTokenType('BLUMS5')  // → 'PROCEDURE'
DataManager.getTokenType('XYZ')     // → null (not found)
```

## Caching Strategy

### Cache Lifecycle

**Check Cache:** [data/data-manager.js:405-437](../../data/data-manager.js#L405-L437)

```
App Startup
    ↓
checkCachedData()
    ├─→ Load from IndexedDB
    ├─→ Check version (must be 9)
    ├─→ Calculate age = (now - timestamp) / (1 day)
    ├─→ If age < 7 days:
    │       loadFromCache() → Instant (no parsing)
    │       Status: "OK (2D OLD)"
    ├─→ If age >= 7 days:
    │       loadFromCache() → Load but mark as stale
    │       Status: "WARNING (8D OLD - UPDATE RECOMMENDED)"
    └─→ If no cache: Return {loaded: false}
```

### Cache Restoration

Two restoration paths are available:

#### Fast Path (Instant)

Used when cache is valid (< 7 days):

```javascript
// Convert arrays back to Maps (O(n) conversion, no parsing)
airportsData = new Map(cachedData.airports);
navaidsData = new Map(cachedData.navaids);
// ... etc
buildTokenTypeMap();  // Rebuild index
```

**Performance:** < 200ms for 90,000+ entries

#### Reparse Path (Smart Reindexing)

Used when parser logic changes:

```javascript
// Extract raw CSV from cache
rawCSVData = cachedData.rawCSV;
// Re-parse with current parser code
await reparseFromRawCSV(onStatusUpdate);
// Store updated indexes
await saveToCache();
```

**Why store raw CSV?**
- Enables backward compatibility when parsers change
- Faster than re-downloading (~5MB vs network fetch)
- Maintains data integrity across app updates

### Cache Expiration

**Duration:** 7 days (168 hours)

**Rationale:**
- NASR data valid for 28 days (updated every 28 days)
- 7-day cache balances freshness with offline capability
- Conservative approach for aviation data

**What happens after expiration?**
- Data still loads from cache (graceful degradation)
- User sees warning: "DATABASE STALE (8D OLD)"
- Recommendation to update shown in UI
- App continues to function normally

## Data Access API

**Module:** `window.DataManager`

### Synchronous Getters

All data access is synchronous (after initial load):

```javascript
// Airports
DataManager.getAirport('KJFK')
// → {id, icao, name, lat, lon, elevation, ...}

DataManager.getAirportByIATA('JFK')
// → {icao: 'KJFK', ...} (uses iataToIcao lookup)

// Navaids
DataManager.getNavaid('DPA')
// → {id, ident, type, frequency, lat, lon, ...}

// Fixes
DataManager.getFix('PAYGE')
// → {id, ident, lat, lon, artcc, isReportingPoint, ...}

// Coordinates (searches all three: fixes, navaids, airports)
DataManager.getFixCoordinates('PAYGE')
// → {lat: 41.234, lon: -87.456}

// Frequencies
DataManager.getFrequencies('KJFK')
// → [{type: 'TWR', frequency: 119.1, ...}, ...]

// Runways
DataManager.getRunways('KJFK')
// → [{ident: '04L', length: 11351, ...}, ...]

// Token type lookup (fast O(1))
DataManager.getTokenType('V25')
// → 'AIRWAY'

// Statistics
DataManager.getDataStats()
// → {airports: 70234, navaids: 10456, fixes: 15234, ...}

// File status
DataManager.getFileStatus()
// → {nasr_airports: {loaded: true, daysOld: 2, ...}, ...}
```

### No Business Logic

The data layer provides **only CRUD operations**:

```javascript
// ✅ Good: Simple data access
const airport = DataManager.getAirport('KJFK');

// ❌ Bad: Business logic belongs in Compute Engine
const nearbyAirports = DataManager.findAirportsNear(lat, lon, radius);  // WRONG!
```

**Why?**
- Separation of concerns
- Data layer is testable in isolation
- Compute Engine handles queries, searches, calculations

## Error Handling

### Network Failures

```javascript
try {
    const data = await NASRAdapter.loadNASRData();
} catch (error) {
    console.error('[DataManager] NASR failed:', error);
    // Fall back to OurAirports or cached data
}
```

### Parse Errors

```javascript
// Robust CSV parsing skips malformed lines
lines.forEach((line, index) => {
    try {
        const fields = parseNASRCSVLine(line);
        // ... process fields
    } catch (error) {
        console.warn(`[NASRAdapter] Skipping line ${index}:`, error);
        // Continue parsing other lines
    }
});
```

### Missing Data

```javascript
// All getters return null if not found (no exceptions)
const airport = DataManager.getAirport('INVALID');
// → null (not undefined, not Error)

// Caller must handle nulls
if (airport) {
    useAirport(airport);
} else {
    showError('Airport not found');
}
```

## File Metadata Tracking

Each data file is tracked individually:

**Implementation:** [data/data-manager.js:649-696](../../data/data-manager.js#L649-L696)

```javascript
DataManager.getFileStatus()
// Returns:
{
    nasr_airports: {
        id: 'nasr_airports',
        name: 'NASR Airports',
        source: 'NASR',
        loaded: true,
        timestamp: 1699564823000,
        daysOld: 2,
        expired: false,
        recordCount: 70234,
        downloadTime: 2345,   // ms
        parseTime: 1234,      // ms
        sizeBytes: 5234567
    },
    // ... 10 more files
}
```

**Use cases:**
- Display data status in UI
- Debug data loading issues
- Monitor cache freshness per file

## Performance Characteristics

| Operation | Complexity | Typical Time |
|-----------|------------|--------------|
| Initial data load | O(n) | 5-10 seconds |
| Cache restore | O(n) | < 200ms |
| Airport lookup | O(1) | < 1ms |
| Navaid lookup | O(1) | < 1ms |
| Token type lookup | O(1) | < 1ms |
| Build token map | O(n) | ~500ms |
| Cache save | O(n) | ~1 second |

**Memory Usage:**
- Raw data: ~50MB (Maps in memory)
- IndexedDB cache: ~50MB (serialized)
- Token type map: ~2MB (70,000+ entries)

**Total:** ~100MB RAM usage

## Data Coordinate Systems

### Geographic Coordinates

All coordinates use **WGS84 decimal degrees**:

```javascript
{
    lat: 40.6413,   // Decimal degrees (-90 to +90)
    lon: -73.7781   // Decimal degrees (-180 to +180)
}
```

**Conventions:**
- North latitude: positive
- South latitude: negative
- East longitude: positive (Asia, Europe east)
- West longitude: negative (Americas)

### Frequency Formats

**Storage:**
```javascript
frequency: 110.2  // MHz (for VOR/VORTAC/DME)
frequency: 420    // kHz (for NDB, unchanged)
```

**Display:**
```javascript
formatFrequency(110.2)  // → "110.20"
formatFrequency(420)    // → "420 kHz"
```

### Elevation

**Storage:** Feet MSL (Mean Sea Level)

```javascript
elevation: 13  // feet MSL
```

**Why feet?**
- Aviation standard in US
- FAA NASR provides feet
- Flight levels use feet (FL180 = 18,000 ft)

---

**Last Updated:** January 2025
