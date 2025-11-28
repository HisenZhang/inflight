# Architecture Refactoring Proposal

## Executive Summary

This document analyzes the current data caching architecture in IN-FLIGHT and proposes a unified design using established design patterns. The goal is to consolidate scattered data management into a cohesive, maintainable system.

---

## Current State: Data Cache Audit

### 7 Separate Data Management Systems

| Module | Storage Backend | In-Memory Cache | Responsibilities |
|--------|----------------|-----------------|------------------|
| **DataManager** | IndexedDB (`FlightPlanningDB`) | 12+ Maps | Aviation static data, raw CSV, checksums |
| **TerrainAnalyzer** | IndexedDB (`TerrainElevationDB`) | 2 Maps | MORA/elevation data |
| **WeatherAPI** | None | 4 Maps + 3 arrays | METAR/TAF/PIREP/SIGMET |
| **WindsAloft** | None | Object with 3 caches | Winds aloft forecasts |
| **FlightState** | localStorage | 2 objects | Flight plan, navigation |
| **FlightTracker** | localStorage | Arrays/variables | GPS tracks, flight stats |
| **ChartsAdapter** | Via DataManager | None | FAA chart metadata |

### Identified Architectural Problems

#### 1. **Multiple IndexedDB Databases**
```
FlightPlanningDB (DataManager)
    └── flightdata store

TerrainElevationDB (TerrainAnalyzer)
    ├── elevations store
    └── mora_grid store
```
- Two separate databases for related aviation data
- No shared connection management
- Duplicate initialization logic

#### 2. **Inconsistent Cache Patterns**
```javascript
// DataManager: Full persistence with compression
rawCSVToStore = await window.CompressionUtils.compressMultiple(rawCSVData);

// WeatherAPI: In-memory with TTL
weatherCache[type].set(key, { data, timestamp: Date.now() });

// FlightState: localStorage with 24h expiry
localStorage.setItem(NAVLOG_STORAGE_KEY, JSON.stringify(saveData));

// TerrainAnalyzer: IndexedDB + memory with no expiry
terrainCache.set(cacheKey, elevFeet);
await saveToDB(cacheKey, lat, lon, elevFeet);
```

#### 3. **Code Duplication**
- IndexedDB initialization: 2 locations (~60 lines each)
- Cache expiry checking: 4 different implementations
- Checksum verification: Only in DataManager (should be shared)
- Compression: Only for raw CSV (could apply to terrain data)

#### 4. **Cross-Layer Dependencies**
```
Compute Layer
├── TerrainAnalyzer → owns IndexedDB (should be Data layer)
├── WeatherAPI → owns cache (should be Data layer)
├── WindsAloft → owns cache (should be Data layer)
└── QueryEngine → depends on DataManager
```

#### 5. **No Abstraction for Storage**
- Each module directly uses `indexedDB.open()`, `localStorage.setItem()`
- No way to swap storage backends (e.g., for testing)
- No unified error handling or retry logic

---

## Proposed Architecture: Unified Data Layer

### Design Patterns Applied

#### 1. **Repository Pattern**
Abstracts data storage behind a consistent interface.

```javascript
// Base repository interface
class Repository {
    async get(key) {}
    async getAll() {}
    async put(key, value) {}
    async delete(key) {}
    async clear() {}
    async count() {}
}
```

#### 2. **Adapter Pattern**
Normalizes different storage backends (IndexedDB, localStorage, Memory).

```javascript
// Storage adapters
class IndexedDBAdapter extends StorageAdapter {}
class LocalStorageAdapter extends StorageAdapter {}
class MemoryAdapter extends StorageAdapter {}
```

#### 3. **Unit of Work Pattern**
Manages transactions across multiple repositories.

```javascript
class UnitOfWork {
    constructor() {
        this.airports = new AirportRepository();
        this.terrain = new TerrainRepository();
        this.weather = new WeatherRepository();
    }

    async commit() {}
    async rollback() {}
}
```

#### 4. **Cache-Aside Pattern**
Standardizes caching strategy across all data access.

```javascript
class CachedRepository extends Repository {
    constructor(repository, cacheStrategy) {
        this.repository = repository;
        this.cache = new Map();
        this.strategy = cacheStrategy; // TTL, LRU, etc.
    }

    async get(key) {
        if (this.cache.has(key) && !this.strategy.isExpired(key)) {
            return this.cache.get(key);
        }
        const value = await this.repository.get(key);
        this.cache.set(key, value);
        return value;
    }
}
```

### Proposed Directory Structure

```
data/
├── core/
│   ├── storage-adapter.js      # Abstract storage interface
│   ├── indexeddb-adapter.js    # IndexedDB implementation
│   ├── localstorage-adapter.js # localStorage implementation
│   ├── memory-adapter.js       # In-memory (volatile) storage
│   └── cache-strategy.js       # TTL, LRU, validity-window strategies
│
├── repositories/
│   ├── base-repository.js      # Abstract repository base
│   ├── aviation-repository.js  # Airports, navaids, fixes, airways
│   ├── terrain-repository.js   # MORA, elevation data
│   ├── weather-repository.js   # METAR, TAF, PIREP, SIGMET
│   ├── winds-repository.js     # Winds aloft forecasts
│   ├── flight-repository.js    # Flight plans, tracks, history
│   └── charts-repository.js    # FAA chart metadata
│
├── adapters/
│   ├── nasr-adapter.js         # (existing) NASR CSV parser
│   ├── ourairports-adapter.js  # (existing) OurAirports parser
│   └── charts-adapter.js       # (existing) FAA charts parser
│
├── services/
│   ├── data-service.js         # Unified data access facade
│   ├── cache-service.js        # Cache management & statistics
│   └── sync-service.js         # Background data refresh
│
└── data-manager.js             # (refactored) Backward-compatible facade
```

### Single Database Architecture

```javascript
// Unified IndexedDB database
const DB_NAME = 'InFlightDB';
const DB_VERSION = 1;

const STORES = {
    // Aviation static data
    airports: { keyPath: 'icao', indexes: ['iata', 'type', 'region'] },
    navaids: { keyPath: 'ident', indexes: ['type', 'region'] },
    fixes: { keyPath: 'ident', indexes: ['region'] },
    airways: { keyPath: 'id' },
    procedures: { keyPath: 'id', indexes: ['airport', 'type'] },
    charts: { keyPath: 'icao' },

    // Terrain data
    terrain: { keyPath: 'key', indexes: ['region'] },
    mora: { keyPath: 'key' },

    // User data
    flightPlans: { keyPath: 'id', indexes: ['timestamp'] },
    tracks: { keyPath: 'id', indexes: ['timestamp'] },

    // Metadata
    metadata: { keyPath: 'key' }  // Cache timestamps, checksums, etc.
};
```

### Cache Strategy Configuration

```javascript
// Different strategies for different data types
const CACHE_STRATEGIES = {
    // Static aviation data: Long-lived, based on NASR cycle (28 days)
    aviation: {
        type: 'validity-period',
        getExpiry: (data) => data.nasrInfo?.expiryDate || Date.now() + 28 * 24 * 60 * 60 * 1000
    },

    // Weather data: Short TTL
    metar: { type: 'ttl', duration: 5 * 60 * 1000 },      // 5 minutes
    taf: { type: 'ttl', duration: 30 * 60 * 1000 },       // 30 minutes
    pirep: { type: 'ttl', duration: 10 * 60 * 1000 },     // 10 minutes

    // Winds aloft: Validity window based
    winds: {
        type: 'validity-window',
        checkValidity: (data) => Utils.isWithinUseWindow(data.metadata.useWindow)
    },

    // Terrain: Permanent (geographic data doesn't change)
    terrain: { type: 'permanent' },

    // User data: Based on user action (manual clear)
    userdata: { type: 'manual' }
};
```

---

## Implementation: Phased Approach

### Phase 1: Core Infrastructure (Low Risk)
1. Create `storage-adapter.js` - abstract storage interface
2. Create `indexeddb-adapter.js` - unified IndexedDB wrapper
3. Create `memory-adapter.js` - volatile storage for weather/winds
4. Create `cache-strategy.js` - standardized cache expiry

**Estimated changes:** ~500 lines new code, 0 breaking changes

### Phase 2: Repository Layer (Medium Risk)
1. Create base repository class
2. Migrate TerrainAnalyzer to use new repository (currently isolated)
3. Add WeatherRepository (replace in-memory cache in WeatherAPI)
4. Add WindsRepository (replace in-memory cache in WindsAloft)

**Estimated changes:** ~800 lines new code, deprecation warnings added

### Phase 3: Database Consolidation (Higher Risk)
1. Create migration script for existing IndexedDB data
2. Merge `TerrainElevationDB` into unified `InFlightDB`
3. Update DataManager to use repositories internally
4. Add backward-compatible facade methods

**Estimated changes:** ~400 lines new code, database migration required

### Phase 4: Cleanup (Breaking Changes)
1. Remove deprecated direct storage access
2. Remove duplicate code from modules
3. Update documentation
4. Update tests

---

## Example: Refactored TerrainAnalyzer

### Before (Current)
```javascript
// terrain-analyzer.js - 150 lines of IndexedDB management
const TERRAIN_DB_NAME = 'TerrainElevationDB';
const TERRAIN_DB_VERSION = 4;

async function initTerrainDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open(TERRAIN_DB_NAME, TERRAIN_DB_VERSION);
        request.onerror = () => { /* ... */ };
        request.onsuccess = () => { /* ... */ };
        request.onupgradeneeded = (event) => { /* ... */ };
    });
}

async function loadFromDB(key) { /* 20 lines */ }
async function saveToDB(key, lat, lon, elevation) { /* 15 lines */ }
async function batchSaveToDB(entries) { /* 20 lines */ }
async function loadMORAFromDB() { /* 25 lines */ }
async function saveMORAToDB(entries) { /* 20 lines */ }
```

### After (Refactored)
```javascript
// terrain-analyzer.js - Data access through repository
const terrainRepo = DataService.getRepository('terrain');
const moraRepo = DataService.getRepository('mora');

async function getElevationAtPoint(lat, lon) {
    const cacheKey = toGridKey(lat, lon);

    // Repository handles cache-aside pattern internally
    const cached = await terrainRepo.get(cacheKey);
    if (cached) return cached.elevation;

    // Fetch from API
    const elevation = await fetchFromAPI(lat, lon);

    // Repository handles persistence
    await terrainRepo.put(cacheKey, { lat, lon, elevation });

    return elevation;
}
```

---

## Benefits of Proposed Architecture

### 1. **Single Source of Truth**
- One database, one cache manager
- Consistent data access patterns
- Easier debugging and monitoring

### 2. **Testability**
- Storage adapters can be mocked
- Repositories can be tested in isolation
- No need for real IndexedDB in unit tests

### 3. **Maintainability**
- ~400 lines of duplicated code removed
- Clear separation of concerns
- Standardized error handling

### 4. **Extensibility**
- Easy to add new data sources
- Can swap storage backends (e.g., SQLite for Electron)
- Plugin architecture for custom caches

### 5. **Performance**
- Shared connection pool for IndexedDB
- Optimized batch operations
- Unified cache warming on startup

---

## Migration Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during DB migration | High | Create backup before migration, version-aware migration scripts |
| Breaking changes to public APIs | Medium | Facade pattern for backward compatibility, deprecation warnings |
| Performance regression | Low | Benchmark before/after, shared connection pool |
| Test coverage gaps | Medium | Add integration tests for repositories |

---

## Recommended First Steps

1. **Review and approve this proposal** with stakeholders
2. **Create `storage-adapter.js`** as foundation (Phase 1)
3. **Write tests** for storage adapters using memory adapter
4. **Pilot with TerrainAnalyzer** (lowest risk, isolated module)
5. **Gather metrics** on cache hit rates, DB operations

---

## Appendix: Current Cache Statistics

```javascript
// DataManager Maps
airportsData: ~70,000 entries
navaidsData: ~10,000 entries
fixesData: ~30,000 entries
airwaysData: ~5,000 entries
tokenTypeMap: ~115,000 entries

// TerrainAnalyzer
moraCache: ~65,000 entries (1° global grid)
terrainCache: dynamic (route-dependent)

// WeatherAPI
weatherCache.metar: dynamic (per-airport requests)
weatherCache.taf: dynamic
weatherCache.pirep: dynamic
bulkPireps: ~hundreds of items
bulkSigmets: ~tens of items
bulkGairmets: ~tens of items

// WindsAloft
windsCacheByPeriod: 3 entries (06/12/24 hour forecasts)

// FlightState (localStorage)
saved_navlog: 1 entry (~5-50KB)
route_history: up to 10 entries

// FlightTracker (localStorage)
flight_tracks: variable (GPS point arrays)
```

---

*Document created: 2025-11-28*
*Status: Proposal for review*
