# IN-FLIGHT Architecture v2 Technical Specification

## Document Purpose

This specification defines a refactored architecture for the IN-FLIGHT flight planning application. It addresses fundamental design violations in the current codebase and establishes patterns that are:

- **Closed for modification, open for extension** (OCP)
- **Easy to test** (pure functions, dependency injection)
- **Properly layered** (dependencies flow downward only)

Use this document to implement the refactoring.

---

## Table of Contents

1. [Current Problems](#1-current-problems)
2. [Architecture Overview](#2-architecture-overview)
3. [Layer Specifications](#3-layer-specifications)
4. [Design Patterns](#4-design-patterns)
5. [Interface Contracts](#5-interface-contracts)
6. [File Structure](#6-file-structure)
7. [Migration Strategy](#7-migration-strategy)
8. [Testing Strategy](#8-testing-strategy)

---

## 1. Current Problems

### 1.1 Dependency Violations

```
CURRENT (WRONG):
DataManager (Data Layer)
    ├── calls RouteCalculator.calculateDistance() → Compute Layer
    ├── initializes QueryEngine.init() → Query Layer
    └── initializes RouteExpander.setAirwaysData() → Compute Layer

Low-level module controls high-level modules = inverted dependencies
```

### 1.2 Layer Violations

| Module | Declared Layer | Actually Does |
|--------|---------------|---------------|
| TerrainAnalyzer | Compute | Owns IndexedDB, fetches data, caches |
| WeatherAPI | Compute | Owns cache, fetches from network |
| WindsAloft | Compute | Owns cache, fetches from network |
| DataManager | Data | Builds indexes, initializes other modules |

### 1.3 Multiple Storage Systems

```
Current: 2 IndexedDB databases, inconsistent patterns
├── FlightPlanningDB (DataManager)
│   └── flightdata store
└── TerrainElevationDB (TerrainAnalyzer)
    ├── elevations store
    └── mora_grid store

Plus: localStorage in FlightState, FlightTracker
Plus: In-memory Maps everywhere with different expiry logic
```

### 1.4 Circular Dependencies

```
DataManager → RouteCalculator (uses calculateDistance)
RouteExpander → DataManager (uses getFixCoordinates)
RouteExpander → QueryEngine (uses getTokenType)
DataManager → QueryEngine (initializes)
QueryEngine → DataManager (imports constants)
```

### 1.5 Single Responsibility Violations

**DataManager does 8+ things:**
1. Fetches data from network
2. Parses CSV/XML
3. Caches to IndexedDB
4. Compresses data
5. Verifies checksums
6. Builds token type map (indexing)
7. Initializes other modules
8. Has query methods (deprecated but present)

---

## 2. Architecture Overview

### 2.1 Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ DISPLAY LAYER                                               │
│ app.js, ui-controller.js, map-display.js, etc.              │
│ - Renders UI                                                │
│ - Binds to Services only                                    │
│ - NO direct data/query access                               │
└─────────────────────────────────────────────────────────────┘
                            │ calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVICE LAYER                                               │
│ services/route-service.js, services/weather-service.js      │
│ - Orchestrates operations                                   │
│ - Combines Query + Compute results                          │
│ - Entry point for all business operations                   │
└─────────────────────────────────────────────────────────────┘
                            │ uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ COMPUTE LAYER (Pure Functions)                              │
│ compute/navigation.js, compute/terrain.js, compute/weather.js│
│ - Stateless calculations                                    │
│ - NO fetching, NO caching, NO storage                       │
│ - Input → Output only                                       │
└─────────────────────────────────────────────────────────────┘
                            │ uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ QUERY LAYER                                                 │
│ query/query-engine.js, query/indexes/*                      │
│ - Owns all indexes                                          │
│ - Spatial queries, search, lookups                          │
│ - Requests data from Repository                             │
└─────────────────────────────────────────────────────────────┘
                            │ uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ DATA LAYER                                                  │
│ data/repository.js, data/sources/*, data/cache/*            │
│ - Single source of truth for all data                       │
│ - Fetching, parsing, caching, persistence                   │
│ - NO business logic, NO indexing                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Dependency Rule

**Dependencies flow DOWN only. Never up, never sideways.**

```
Display → Service → Compute
                  → Query → Data
```

### 2.3 Data Flow

```
User Action
    ↓
Display calls Service
    ↓
Service calls Compute (pure calculation)
Service calls Query (data lookup)
    ↓
Query calls Data (if cache miss)
    ↓
Data returns to Query
Query returns to Service
    ↓
Service combines results
    ↓
Display renders result
```

---

## 3. Layer Specifications

### 3.1 Data Layer

**Location:** `data/`

**Responsibility:** Fetch, parse, cache, persist all data. Nothing else.

**Components:**

#### 3.1.1 DataSource (Abstract)

```javascript
// data/core/data-source.js

/**
 * Abstract base class for all data sources.
 * Implementations: NASRSource, OurAirportsSource, WeatherSource, TerrainSource
 */
class DataSource {
    constructor(config) {
        this.config = config;
        this.name = this.constructor.name;
    }

    // MUST implement
    async fetch() {
        throw new Error(`${this.name}.fetch() not implemented`);
    }

    async parse(rawData) {
        throw new Error(`${this.name}.parse() not implemented`);
    }

    // MAY override
    async validate(data) { return true; }
    async transform(data) { return data; }

    // Template method - DO NOT override
    async load() {
        const raw = await this.fetch();
        const parsed = await this.parse(raw);
        if (!await this.validate(parsed)) {
            throw new Error(`${this.name} validation failed`);
        }
        return await this.transform(parsed);
    }
}
```

#### 3.1.2 StorageAdapter (Abstract)

```javascript
// data/core/storage-adapter.js

/**
 * Abstract interface for storage backends.
 * Implementations: IndexedDBStorage, LocalStorageAdapter, MemoryStorage
 */
class StorageAdapter {
    async get(key) { throw new Error('not implemented'); }
    async set(key, value) { throw new Error('not implemented'); }
    async delete(key) { throw new Error('not implemented'); }
    async clear() { throw new Error('not implemented'); }
    async keys() { throw new Error('not implemented'); }
    async has(key) { throw new Error('not implemented'); }
}
```

#### 3.1.3 CacheStrategy (Abstract)

```javascript
// data/core/cache-strategy.js

/**
 * Abstract interface for cache validity strategies.
 * Implementations: TTLStrategy, ValidityWindowStrategy, VersionStrategy, PermanentStrategy
 */
class CacheStrategy {
    isValid(entry) { throw new Error('not implemented'); }
    createEntry(data, metadata = {}) {
        return { data, timestamp: Date.now(), ...metadata };
    }
}

// Concrete implementations
class TTLStrategy extends CacheStrategy {
    constructor(durationMs) {
        super();
        this.duration = durationMs;
    }
    isValid(entry) {
        return (Date.now() - entry.timestamp) < this.duration;
    }
}

class PermanentStrategy extends CacheStrategy {
    isValid(entry) { return true; }
}

class VersionStrategy extends CacheStrategy {
    constructor(isVersionValid) {
        super();
        this.isVersionValid = isVersionValid;
    }
    isValid(entry) {
        return this.isVersionValid(entry.version);
    }
}
```

#### 3.1.4 Repository

```javascript
// data/repository.js

/**
 * Main data access facade. All data flows through here.
 */
class DataRepository {
    constructor() {
        this._sources = new Map();
        this._caches = new Map();
        this._storage = null;
    }

    // Configuration
    setStorage(storageAdapter) {
        this._storage = storageAdapter;
        return this;
    }

    registerSource(name, source, cacheStrategy) {
        this._sources.set(name, source);
        this._caches.set(name, {
            strategy: cacheStrategy,
            memory: new Map()
        });
        return this;
    }

    // Data access
    async get(sourceName, key) {
        const cache = this._caches.get(sourceName);

        // L1: Memory
        if (cache.memory.has(key)) {
            const entry = cache.memory.get(key);
            if (cache.strategy.isValid(entry)) {
                return entry.data;
            }
        }

        // L2: Persistent storage
        if (this._storage) {
            const storeKey = `${sourceName}:${key}`;
            const stored = await this._storage.get(storeKey);
            if (stored && cache.strategy.isValid(stored)) {
                cache.memory.set(key, stored);
                return stored.data;
            }
        }

        // L3: Source
        const source = this._sources.get(sourceName);
        const data = await source.load();
        const entry = cache.strategy.createEntry(data);

        cache.memory.set(key, entry);
        if (this._storage) {
            await this._storage.set(`${sourceName}:${key}`, entry);
        }

        return data;
    }

    async getAll(sourceName) {
        return this.get(sourceName, '_all');
    }

    // Bulk operations
    async loadAll() {
        const results = {};
        for (const [name] of this._sources) {
            results[name] = await this.getAll(name);
        }
        return results;
    }

    async clearCache(sourceName) {
        const cache = this._caches.get(sourceName);
        if (cache) cache.memory.clear();
        if (this._storage) {
            // Clear all keys for this source
            const keys = await this._storage.keys();
            for (const key of keys) {
                if (key.startsWith(`${sourceName}:`)) {
                    await this._storage.delete(key);
                }
            }
        }
    }
}
```

#### 3.1.5 Concrete Sources

```javascript
// data/sources/nasr-source.js
class NASRSource extends DataSource {
    constructor(config) {
        super(config);
        this.baseUrl = config.baseUrl || 'https://nasr.hisenz.com/files/';
        this.parser = config.parser; // Injected parser
    }

    async fetch() {
        const url = `${this.baseUrl}${this.config.file}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`NASR fetch failed: ${response.status}`);
        return response.text();
    }

    async parse(csvText) {
        return this.parser.parse(csvText);
    }

    async validate(data) {
        return data && (data.size > 0 || data.length > 0);
    }
}

// data/sources/terrain-source.js
class TerrainSource extends DataSource {
    async fetch() {
        const url = 'https://nasr.hisenz.com/files/MORA.csv';
        const response = await fetch(url);
        return response.text();
    }

    async parse(csvText) {
        const lines = csvText.trim().split('\n').slice(1); // Skip header
        const grid = new Map();
        for (const line of lines) {
            const [lat, lon, mora, source] = line.split(',');
            const key = `${Math.floor(parseFloat(lat))},${Math.floor(parseFloat(lon))}`;
            grid.set(key, {
                lat: parseFloat(lat),
                lon: parseFloat(lon),
                mora: parseInt(mora, 10),
                source: source || 'TERRAIN'
            });
        }
        return grid;
    }
}

// data/sources/weather-source.js
class WeatherSource extends DataSource {
    constructor(config) {
        super(config);
        this.type = config.type; // 'metar', 'taf', 'pirep'
    }

    async fetch() {
        const url = this._buildAWCUrl();
        const response = await fetch(url);
        return response.text();
    }

    async parse(xmlText) {
        // Parse AWC XML response
        return WeatherParser.parse(xmlText, this.type);
    }
}
```

---

### 3.2 Query Layer

**Location:** `query/`

**Responsibility:** Index data, execute queries. Owns all indexes.

**Components:**

#### 3.2.1 IndexStrategy (Abstract)

```javascript
// query/core/index-strategy.js

/**
 * Abstract interface for index implementations.
 * Implementations: MapIndex, TrieIndex, SpatialGridIndex
 */
class IndexStrategy {
    build(data) { throw new Error('not implemented'); }
    query(params) { throw new Error('not implemented'); }
    update(key, value) { throw new Error('not implemented'); }
    delete(key) { throw new Error('not implemented'); }
    clear() { throw new Error('not implemented'); }
    get size() { throw new Error('not implemented'); }
}
```

#### 3.2.2 Concrete Indexes

```javascript
// query/indexes/map-index.js
class MapIndex extends IndexStrategy {
    constructor() {
        super();
        this._map = new Map();
    }

    build(data) {
        this._map.clear();
        if (data instanceof Map) {
            for (const [k, v] of data) this._map.set(k, v);
        } else if (Array.isArray(data)) {
            for (const item of data) this._map.set(item.id || item.key, item);
        }
        return this;
    }

    query({ key }) {
        return this._map.get(key) || null;
    }

    update(key, value) { this._map.set(key, value); }
    delete(key) { this._map.delete(key); }
    clear() { this._map.clear(); }
    get size() { return this._map.size; }
}

// query/indexes/trie-index.js
class TrieIndex extends IndexStrategy {
    constructor() {
        super();
        this._root = {};
        this._size = 0;
    }

    build(data) {
        this._root = {};
        this._size = 0;
        const entries = data instanceof Map ? data.entries() : Object.entries(data);
        for (const [key, value] of entries) {
            this._insert(key.toUpperCase(), value);
            this._size++;
        }
        return this;
    }

    _insert(key, value) {
        let node = this._root;
        for (const char of key) {
            if (!node[char]) node[char] = {};
            node = node[char];
        }
        node.$ = { key, value };
    }

    query({ prefix, limit = 10 }) {
        const upperPrefix = (prefix || '').toUpperCase();
        let node = this._root;
        for (const char of upperPrefix) {
            if (!node[char]) return [];
            node = node[char];
        }
        return this._collect(node, limit);
    }

    _collect(node, limit, results = []) {
        if (results.length >= limit) return results;
        if (node.$) results.push(node.$);
        for (const char of Object.keys(node).sort()) {
            if (char !== '$') this._collect(node[char], limit, results);
            if (results.length >= limit) break;
        }
        return results;
    }

    clear() { this._root = {}; this._size = 0; }
    get size() { return this._size; }
}

// query/indexes/spatial-grid-index.js
class SpatialGridIndex extends IndexStrategy {
    constructor(gridSizeDeg = 1.0) {
        super();
        this._grid = new Map();
        this._gridSize = gridSizeDeg;
        this._size = 0;
    }

    _toKey(lat, lon) {
        return `${Math.floor(lat / this._gridSize)},${Math.floor(lon / this._gridSize)}`;
    }

    build(data) {
        this._grid.clear();
        this._size = 0;
        const entries = data instanceof Map ? data.entries() : Object.entries(data);
        for (const [id, item] of entries) {
            if (item.lat != null && item.lon != null) {
                const key = this._toKey(item.lat, item.lon);
                if (!this._grid.has(key)) this._grid.set(key, []);
                this._grid.get(key).push({ id, ...item });
                this._size++;
            }
        }
        return this;
    }

    query({ lat, lon, radiusNM, bounds }) {
        if (bounds) return this._queryBounds(bounds);
        if (lat != null && lon != null && radiusNM != null) {
            return this._queryRadius(lat, lon, radiusNM);
        }
        return [];
    }

    _queryRadius(lat, lon, radiusNM) {
        const results = [];
        const gridRadius = Math.ceil(radiusNM / 60 / this._gridSize) + 1;
        const centerLat = Math.floor(lat / this._gridSize);
        const centerLon = Math.floor(lon / this._gridSize);

        for (let dLat = -gridRadius; dLat <= gridRadius; dLat++) {
            for (let dLon = -gridRadius; dLon <= gridRadius; dLon++) {
                const key = `${centerLat + dLat},${centerLon + dLon}`;
                const cell = this._grid.get(key);
                if (cell) results.push(...cell);
            }
        }
        return results;
    }

    _queryBounds({ minLat, maxLat, minLon, maxLon }) {
        const results = [];
        const minLatGrid = Math.floor(minLat / this._gridSize);
        const maxLatGrid = Math.floor(maxLat / this._gridSize);
        const minLonGrid = Math.floor(minLon / this._gridSize);
        const maxLonGrid = Math.floor(maxLon / this._gridSize);

        for (let latG = minLatGrid; latG <= maxLatGrid; latG++) {
            for (let lonG = minLonGrid; lonG <= maxLonGrid; lonG++) {
                const cell = this._grid.get(`${latG},${lonG}`);
                if (cell) results.push(...cell);
            }
        }
        return results;
    }

    clear() { this._grid.clear(); this._size = 0; }
    get size() { return this._size; }
}
```

#### 3.2.3 QueryEngine

```javascript
// query/query-engine.js

/**
 * Central query coordinator. Owns all indexes.
 */
class QueryEngine {
    constructor() {
        this._indexes = new Map();
        this._initialized = false;
    }

    // Setup
    registerIndex(name, strategy) {
        this._indexes.set(name, strategy);
        return this;
    }

    async initialize(dataRepository) {
        const data = await dataRepository.loadAll();

        // Build indexes from data
        if (data.airports) {
            this._indexes.get('airports')?.build(data.airports);
            this._indexes.get('airports_search')?.build(data.airports);
            this._indexes.get('airports_spatial')?.build(data.airports);
        }
        if (data.navaids) {
            this._indexes.get('navaids')?.build(data.navaids);
            this._indexes.get('navaids_spatial')?.build(data.navaids);
        }
        if (data.fixes) {
            this._indexes.get('fixes')?.build(data.fixes);
            this._indexes.get('fixes_spatial')?.build(data.fixes);
        }
        if (data.airways) {
            this._indexes.get('airways')?.build(data.airways);
        }

        this._buildTokenTypeIndex(data);
        this._initialized = true;
        return this;
    }

    _buildTokenTypeIndex(data) {
        const tokenTypes = new Map();

        if (data.airports) {
            for (const [code] of data.airports) {
                tokenTypes.set(code, 'AIRPORT');
            }
        }
        if (data.navaids) {
            for (const [code] of data.navaids) {
                tokenTypes.set(code, 'NAVAID');
            }
        }
        if (data.fixes) {
            for (const [code] of data.fixes) {
                tokenTypes.set(code, 'FIX');
            }
        }
        if (data.airways) {
            for (const [code] of data.airways) {
                tokenTypes.set(code, 'AIRWAY');
            }
        }

        this._indexes.get('tokenTypes')?.build(tokenTypes);
    }

    // Query methods
    getByKey(indexName, key) {
        return this._indexes.get(indexName)?.query({ key }) || null;
    }

    search(indexName, prefix, limit = 15) {
        return this._indexes.get(indexName)?.query({ prefix, limit }) || [];
    }

    findInBounds(indexName, bounds) {
        return this._indexes.get(indexName)?.query({ bounds }) || [];
    }

    findNearby(indexName, lat, lon, radiusNM) {
        return this._indexes.get(indexName)?.query({ lat, lon, radiusNM }) || [];
    }

    getTokenType(token) {
        return this._indexes.get('tokenTypes')?.query({ key: token }) || null;
    }

    // Convenience methods
    getAirport(icao) { return this.getByKey('airports', icao); }
    getNavaid(ident) { return this.getByKey('navaids', ident); }
    getFix(ident) { return this.getByKey('fixes', ident); }
    getAirway(ident) { return this.getByKey('airways', ident); }

    searchAirports(prefix, limit) { return this.search('airports_search', prefix, limit); }
    searchWaypoints(prefix, limit) {
        // Combine results from multiple indexes
        const airports = this.search('airports_search', prefix, limit);
        const navaids = this.search('navaids_search', prefix, limit);
        const fixes = this.search('fixes_search', prefix, limit);
        return [...airports, ...navaids, ...fixes].slice(0, limit);
    }

    getStats() {
        const stats = {};
        for (const [name, index] of this._indexes) {
            stats[name] = index.size;
        }
        return stats;
    }
}
```

---

### 3.3 Compute Layer

**Location:** `compute/`

**Responsibility:** Pure calculations. NO state, NO fetching, NO caching.

**Rule:** Every function must be pure - same input always produces same output.

#### 3.3.1 Navigation Module

```javascript
// compute/navigation.js

/**
 * Navigation calculations - all pure functions.
 * Uses Geodesy library for precision.
 */
const Navigation = {
    /**
     * Calculate distance between two points (Vincenty formula)
     * @param {number} lat1 - Start latitude
     * @param {number} lon1 - Start longitude
     * @param {number} lat2 - End latitude
     * @param {number} lon2 - End longitude
     * @returns {number} Distance in nautical miles
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        return Geodesy.vincentyDistance(lat1, lon1, lat2, lon2);
    },

    /**
     * Calculate initial bearing between two points
     * @returns {number} Bearing in degrees true (0-360)
     */
    calculateBearing(lat1, lon1, lat2, lon2) {
        return Geodesy.vincentyBearing(lat1, lon1, lat2, lon2);
    },

    /**
     * Calculate magnetic bearing
     * @returns {number} Bearing in degrees magnetic
     */
    calculateMagneticBearing(lat1, lon1, lat2, lon2) {
        const trueBearing = this.calculateBearing(lat1, lon1, lat2, lon2);
        const magVar = Geodesy.getMagneticDeclination(lat1, lon1);
        return (trueBearing - magVar + 360) % 360;
    },

    /**
     * Calculate wind correction
     * @param {number} course - Desired course in degrees
     * @param {number} tas - True airspeed in knots
     * @param {number} windDir - Wind direction (from) in degrees
     * @param {number} windSpeed - Wind speed in knots
     * @returns {{heading: number, groundSpeed: number, windCorrectionAngle: number}}
     */
    calculateWindCorrection(course, tas, windDir, windSpeed) {
        const courseRad = course * Math.PI / 180;
        const windRad = windDir * Math.PI / 180;

        const wca = Math.asin((windSpeed / tas) * Math.sin(windRad - courseRad));
        const heading = (course + wca * 180 / Math.PI + 360) % 360;

        const groundSpeed = Math.sqrt(
            tas * tas + windSpeed * windSpeed -
            2 * tas * windSpeed * Math.cos(courseRad - windRad + wca)
        );

        return {
            heading: Math.round(heading),
            groundSpeed: Math.round(groundSpeed),
            windCorrectionAngle: Math.round(wca * 180 / Math.PI)
        };
    },

    /**
     * Calculate leg data
     * @param {Object} from - Start waypoint {lat, lon, ...}
     * @param {Object} to - End waypoint {lat, lon, ...}
     * @param {Object} options - {tas, altitude, wind}
     * @returns {Object} Leg calculation results
     */
    calculateLeg(from, to, options = {}) {
        const distance = this.calculateDistance(from.lat, from.lon, to.lat, to.lon);
        const trueCourse = this.calculateBearing(from.lat, from.lon, to.lat, to.lon);
        const magCourse = this.calculateMagneticBearing(from.lat, from.lon, to.lat, to.lon);

        let heading = magCourse;
        let groundSpeed = options.tas || 120;
        let wca = 0;

        if (options.wind && options.tas) {
            const correction = this.calculateWindCorrection(
                trueCourse, options.tas, options.wind.direction, options.wind.speed
            );
            heading = correction.heading;
            groundSpeed = correction.groundSpeed;
            wca = correction.windCorrectionAngle;
        }

        const ete = groundSpeed > 0 ? (distance / groundSpeed) * 60 : 0; // minutes

        return {
            distance: Math.round(distance * 10) / 10,
            trueCourse: Math.round(trueCourse),
            magCourse: Math.round(magCourse),
            heading: Math.round(heading),
            groundSpeed: Math.round(groundSpeed),
            windCorrectionAngle: wca,
            ete: Math.round(ete),
            from: from.ident || from.icao || from.id,
            to: to.ident || to.icao || to.id
        };
    },

    /**
     * Calculate entire route
     * @param {Array} waypoints - Array of waypoints with lat/lon
     * @param {Object} options - Route options
     * @returns {Object} Route calculation with legs and totals
     */
    calculateRoute(waypoints, options = {}) {
        if (!waypoints || waypoints.length < 2) {
            return { legs: [], totals: { distance: 0, ete: 0 } };
        }

        const legs = [];
        let totalDistance = 0;
        let totalEte = 0;

        for (let i = 0; i < waypoints.length - 1; i++) {
            const leg = this.calculateLeg(waypoints[i], waypoints[i + 1], options);
            legs.push(leg);
            totalDistance += leg.distance;
            totalEte += leg.ete;
        }

        return {
            legs,
            totals: {
                distance: Math.round(totalDistance * 10) / 10,
                ete: Math.round(totalEte)
            }
        };
    }
};

window.Navigation = Navigation;
```

#### 3.3.2 Terrain Module

```javascript
// compute/terrain.js

/**
 * Terrain analysis - all pure functions.
 * Receives MORA data, returns analysis results.
 */
const Terrain = {
    STANDARD_CLEARANCE_FT: 1000,
    MOUNTAINOUS_CLEARANCE_FT: 2000,
    MOUNTAINOUS_THRESHOLD_FT: 5000,

    /**
     * Analyze terrain profile along route
     * @param {Array} waypoints - Route waypoints with lat/lon
     * @param {Map} moraData - MORA grid data
     * @returns {Object} Terrain analysis
     */
    analyzeProfile(waypoints, moraData) {
        if (!waypoints || waypoints.length < 2 || !moraData) {
            return { error: 'Insufficient data for analysis' };
        }

        // Find MORA grid cells along route
        const routeCells = this._findRouteCells(waypoints, moraData);

        if (routeCells.length === 0) {
            return { error: 'No MORA data for route' };
        }

        const moraValues = routeCells.map(c => c.mora);
        const maxMORA = Math.max(...moraValues);
        const minMORA = Math.min(...moraValues);
        const avgMORA = Math.round(moraValues.reduce((a, b) => a + b, 0) / moraValues.length);

        // Estimate terrain (MORA - clearance)
        const maxTerrain = Math.max(0, maxMORA - this.STANDARD_CLEARANCE_FT);
        const isMountainous = maxTerrain >= this.MOUNTAINOUS_THRESHOLD_FT;
        const requiredClearance = isMountainous
            ? this.MOUNTAINOUS_CLEARANCE_FT
            : this.STANDARD_CLEARANCE_FT;

        return {
            maxMORA,
            minMORA,
            avgMORA,
            maxTerrain,
            isMountainous,
            requiredClearance,
            gridCellCount: routeCells.length,
            cells: routeCells
        };
    },

    _findRouteCells(waypoints, moraData) {
        const cells = new Map();

        // Sample points along route
        for (let i = 0; i < waypoints.length - 1; i++) {
            const from = waypoints[i];
            const to = waypoints[i + 1];
            const samples = this._sampleSegment(from, to, 10); // Every 10nm

            for (const point of samples) {
                const key = `${Math.floor(point.lat)},${Math.floor(point.lon)}`;
                if (moraData.has(key) && !cells.has(key)) {
                    cells.set(key, moraData.get(key));
                }
            }
        }

        return Array.from(cells.values());
    },

    _sampleSegment(from, to, intervalNM) {
        const points = [from];
        const distance = Navigation.calculateDistance(from.lat, from.lon, to.lat, to.lon);
        const numSamples = Math.ceil(distance / intervalNM);

        for (let i = 1; i <= numSamples; i++) {
            const fraction = i / numSamples;
            points.push({
                lat: from.lat + fraction * (to.lat - from.lat),
                lon: from.lon + fraction * (to.lon - from.lon)
            });
        }

        return points;
    },

    /**
     * Check if altitude provides adequate clearance
     * @param {number} altitude - Cruise altitude in feet
     * @param {Object} analysis - Result from analyzeProfile
     * @returns {Object} Clearance check result
     */
    checkClearance(altitude, analysis) {
        if (!analysis || analysis.error) {
            return { status: 'UNKNOWN', message: analysis?.error || 'No analysis' };
        }

        const clearance = altitude - analysis.maxTerrain;

        if (clearance >= analysis.requiredClearance) {
            return {
                status: 'OK',
                message: `${clearance}ft clearance (${analysis.requiredClearance}ft required)`,
                clearance,
                required: analysis.requiredClearance,
                maxTerrain: analysis.maxTerrain,
                maxMORA: analysis.maxMORA
            };
        } else {
            return {
                status: 'UNSAFE',
                message: `Only ${clearance}ft clearance, need ${analysis.requiredClearance}ft`,
                clearance,
                required: analysis.requiredClearance,
                deficit: analysis.requiredClearance - clearance,
                recommendedAltitude: analysis.maxMORA,
                maxTerrain: analysis.maxTerrain,
                maxMORA: analysis.maxMORA
            };
        }
    }
};

window.Terrain = Terrain;
```

#### 3.3.3 Weather Module

```javascript
// compute/weather.js

/**
 * Weather parsing and analysis - all pure functions.
 */
const Weather = {
    /**
     * Parse raw METAR string
     * @param {string} raw - Raw METAR text
     * @returns {Object} Parsed METAR
     */
    parseMETAR(raw) {
        // Pure parsing logic
        const parts = raw.trim().split(/\s+/);
        // ... parsing implementation
        return { raw, station, time, wind, visibility, ceiling, temperature, altimeter };
    },

    /**
     * Determine flight category from conditions
     * @param {number} visibility - Visibility in statute miles
     * @param {number} ceiling - Ceiling in feet AGL (null if clear)
     * @returns {string} VFR | MVFR | IFR | LIFR
     */
    getFlightCategory(visibility, ceiling) {
        if (visibility < 1 || (ceiling !== null && ceiling < 500)) return 'LIFR';
        if (visibility < 3 || (ceiling !== null && ceiling < 1000)) return 'IFR';
        if (visibility <= 5 || (ceiling !== null && ceiling <= 3000)) return 'MVFR';
        return 'VFR';
    },

    /**
     * Calculate density altitude
     * @param {number} elevation - Field elevation in feet
     * @param {number} tempC - Temperature in Celsius
     * @param {number} altimeter - Altimeter setting in inHg
     * @returns {number} Density altitude in feet
     */
    calculateDensityAltitude(elevation, tempC, altimeter) {
        const pressureAlt = elevation + (29.92 - altimeter) * 1000;
        const isaTemp = 15 - (elevation / 1000) * 2;
        const tempDeviation = tempC - isaTemp;
        return Math.round(pressureAlt + (120 * tempDeviation));
    }
};

window.Weather = Weather;
```

---

### 3.4 Service Layer

**Location:** `services/`

**Responsibility:** Orchestrate operations across layers. Entry point for UI.

```javascript
// services/route-service.js

/**
 * Route planning service - orchestrates Data, Query, and Compute layers.
 */
class RouteService {
    constructor({ queryEngine, dataRepository }) {
        this._query = queryEngine;
        this._repo = dataRepository;
    }

    /**
     * Plan a complete route
     * @param {string} routeString - Route string like "KSFO V25 LAX"
     * @param {Object} options - Planning options
     * @returns {Object} Complete route plan
     */
    async planRoute(routeString, options = {}) {
        // 1. Parse and resolve waypoints (Query layer)
        const waypoints = await this._resolveWaypoints(routeString);

        // 2. Calculate navigation (Compute layer - pure)
        const route = Navigation.calculateRoute(waypoints, {
            tas: options.cruiseSpeed,
            wind: options.wind
        });

        // 3. Analyze terrain (Data + Compute)
        const moraData = await this._repo.get('terrain', 'mora');
        const terrain = Terrain.analyzeProfile(waypoints, moraData);

        // 4. Check clearance if altitude specified
        let clearance = null;
        if (options.altitude) {
            clearance = Terrain.checkClearance(options.altitude, terrain);
        }

        return {
            waypoints,
            legs: route.legs,
            totals: route.totals,
            terrain,
            clearance,
            options
        };
    }

    async _resolveWaypoints(routeString) {
        const tokens = routeString.trim().toUpperCase().split(/\s+/);
        const waypoints = [];

        for (const token of tokens) {
            const type = this._query.getTokenType(token);
            let waypoint = null;

            switch (type) {
                case 'AIRPORT':
                    waypoint = this._query.getAirport(token);
                    break;
                case 'NAVAID':
                    waypoint = this._query.getNavaid(token);
                    break;
                case 'FIX':
                    waypoint = this._query.getFix(token);
                    break;
                case 'AIRWAY':
                    // Expand airway - would need previous/next waypoint
                    continue;
                default:
                    console.warn(`Unknown token: ${token}`);
                    continue;
            }

            if (waypoint) {
                waypoints.push(waypoint);
            }
        }

        return waypoints;
    }

    /**
     * Search for waypoints (autocomplete)
     */
    searchWaypoints(query, limit = 15) {
        return this._query.searchWaypoints(query, limit);
    }

    /**
     * Get airport details
     */
    getAirport(icao) {
        return this._query.getAirport(icao);
    }
}

// services/weather-service.js

class WeatherService {
    constructor({ dataRepository }) {
        this._repo = dataRepository;
    }

    async getMETAR(station) {
        const raw = await this._repo.get('weather_metar', station);
        if (!raw) return null;
        return Weather.parseMETAR(raw);
    }

    async getRouteWeather(waypoints) {
        const stations = waypoints
            .filter(w => w.type === 'airport')
            .map(w => w.icao);

        const metars = await Promise.all(
            stations.map(s => this.getMETAR(s))
        );

        return stations.map((station, i) => ({
            station,
            metar: metars[i],
            category: metars[i]
                ? Weather.getFlightCategory(metars[i].visibility, metars[i].ceiling)
                : null
        }));
    }
}
```

---

## 4. Design Patterns

### 4.1 Patterns Used

| Pattern | Location | Purpose |
|---------|----------|---------|
| **Strategy** | IndexStrategy, CacheStrategy | Swap algorithms without changing clients |
| **Template Method** | DataSource.load() | Define skeleton, let subclasses fill details |
| **Repository** | DataRepository | Abstract data access behind consistent interface |
| **Decorator** | CachedRepository wrapping Repository | Add caching without modifying repository |
| **Facade** | RouteService, WeatherService | Simplified interface to complex subsystem |
| **Dependency Injection** | Service constructors | Inject dependencies, don't hardcode |

### 4.2 Extension Points

```
To add new data source:     Implement DataSource, register with DataRegistry
To add new index type:      Implement IndexStrategy, register with QueryEngine
To add new cache strategy:  Implement CacheStrategy, use with CachedRepository
To add new calculations:    Add pure functions to Compute modules
To add new workflow:        Create new Service class
```

---

## 5. Interface Contracts

### 5.1 DataSource Contract

```javascript
class DataSource {
    // MUST implement
    async fetch(): Promise<any>      // Fetch raw data from source
    async parse(raw): Promise<any>   // Parse raw data into usable format

    // MAY override
    async validate(data): Promise<boolean>  // Validate parsed data
    async transform(data): Promise<any>     // Transform data before return

    // DO NOT override
    async load(): Promise<any>       // Orchestrates fetch → parse → validate → transform
}
```

### 5.2 IndexStrategy Contract

```javascript
class IndexStrategy {
    build(data): this                // Build index from data, return self for chaining
    query(params): any               // Execute query with params
    update(key, value): void         // Update single entry
    delete(key): void                // Delete single entry
    clear(): void                    // Clear all entries
    get size(): number               // Return entry count
}
```

### 5.3 CacheStrategy Contract

```javascript
class CacheStrategy {
    isValid(entry): boolean          // Check if cache entry is still valid
    createEntry(data, metadata): object  // Create cache entry with metadata
}
```

### 5.4 StorageAdapter Contract

```javascript
class StorageAdapter {
    async get(key): Promise<any>     // Get value by key
    async set(key, value): Promise<void>  // Set value
    async delete(key): Promise<void> // Delete by key
    async clear(): Promise<void>     // Clear all
    async keys(): Promise<string[]>  // List all keys
    async has(key): Promise<boolean> // Check if key exists
}
```

---

## 6. File Structure

```
inflight/
├── data/
│   ├── core/
│   │   ├── data-source.js          # Abstract DataSource class
│   │   ├── storage-adapter.js      # Abstract StorageAdapter class
│   │   └── cache-strategy.js       # CacheStrategy + implementations
│   │
│   ├── storage/
│   │   ├── indexeddb-storage.js    # IndexedDB implementation
│   │   ├── localstorage-adapter.js # localStorage implementation
│   │   └── memory-storage.js       # In-memory (volatile) storage
│   │
│   ├── sources/
│   │   ├── nasr-source.js          # NASR data source
│   │   ├── ourairports-source.js   # OurAirports data source
│   │   ├── terrain-source.js       # MORA/terrain data source
│   │   ├── weather-source.js       # AWC weather data source
│   │   └── winds-source.js         # Winds aloft data source
│   │
│   ├── parsers/
│   │   ├── nasr-parser.js          # (existing) NASR CSV parsing
│   │   ├── ourairports-parser.js   # (existing) OurAirports parsing
│   │   └── weather-parser.js       # Weather XML/text parsing
│   │
│   └── repository.js               # Main DataRepository class
│
├── query/
│   ├── core/
│   │   └── index-strategy.js       # Abstract IndexStrategy class
│   │
│   ├── indexes/
│   │   ├── map-index.js            # Simple Map-based index
│   │   ├── trie-index.js           # Trie for prefix search
│   │   └── spatial-grid-index.js   # Grid-based spatial index
│   │
│   └── query-engine.js             # Main QueryEngine class
│
├── compute/
│   ├── navigation.js               # Navigation calculations (pure)
│   ├── terrain.js                  # Terrain analysis (pure)
│   ├── weather.js                  # Weather parsing/analysis (pure)
│   ├── route-lexer.js              # (existing) Route tokenization
│   ├── route-parser.js             # (existing) Route parsing
│   └── fuel.js                     # Fuel calculations (pure)
│
├── services/
│   ├── route-service.js            # Route planning orchestration
│   ├── weather-service.js          # Weather data orchestration
│   └── flight-service.js           # In-flight operations
│
├── state/
│   ├── flight-state.js             # (existing) Flight plan state
│   └── flight-tracker.js           # (existing) GPS tracking
│
├── display/
│   ├── app.js                      # (existing) Main coordinator
│   ├── ui-controller.js            # (existing) UI rendering
│   └── map-display.js              # (existing) Map rendering
│
├── lib/
│   └── geodesy.js                  # (existing) WGS84 + WMM2025
│
└── main.js                         # NEW: Application bootstrap
```

---

## 7. Migration Strategy

### Phase 1: Foundation (No Breaking Changes)

**Goal:** Create new infrastructure alongside existing code.

1. Create `data/core/` with abstract classes
2. Create `data/storage/` adapters
3. Create `query/core/` and `query/indexes/`
4. Create `query/query-engine.js` (new version)
5. Create `compute/navigation.js`, `compute/terrain.js`, `compute/weather.js`

**Test:** New code works independently, existing code unchanged.

### Phase 2: Data Layer Migration

**Goal:** Move data fetching/caching to new Repository.

1. Create concrete DataSource implementations
2. Create DataRepository with caching
3. Update TerrainAnalyzer to use new terrain source (removes its IndexedDB)
4. Update WeatherAPI to use new weather source (removes its cache)
5. Update WindsAloft to use new winds source

**Test:** Data flows through new Repository, old direct fetching removed.

### Phase 3: Query Layer Migration

**Goal:** QueryEngine owns initialization and indexes.

1. Update QueryEngine to call Repository (not receive data from DataManager)
2. Add spatial indexes for efficient lookups
3. Remove QueryEngine initialization from DataManager
4. Update consumers to use new QueryEngine methods

**Test:** QueryEngine self-initializes, spatial queries use indexes.

### Phase 4: Service Layer

**Goal:** UI uses Services instead of direct module access.

1. Create RouteService, WeatherService
2. Update Display layer to use Services
3. Remove direct DataManager/QueryEngine calls from UI

**Test:** All UI operations go through Services.

### Phase 5: Cleanup

**Goal:** Remove deprecated code.

1. Remove deprecated methods from DataManager
2. Remove old caching code from compute modules
3. Consolidate to single IndexedDB database
4. Update documentation

---

## 8. Testing Strategy

### 8.1 Unit Tests (Compute Layer)

```javascript
// tests/test-navigation.js
describe('Navigation', () => {
    describe('calculateDistance', () => {
        it('calculates SFO to LAX correctly', () => {
            const result = Navigation.calculateDistance(37.62, -122.38, 33.94, -118.41);
            assert.approximately(result, 337, 1);
        });

        it('returns 0 for same point', () => {
            assert.equals(Navigation.calculateDistance(40, -75, 40, -75), 0);
        });
    });

    describe('calculateWindCorrection', () => {
        it('calculates headwind correctly', () => {
            const result = Navigation.calculateWindCorrection(360, 120, 360, 20);
            assert.equals(result.groundSpeed, 100);
            assert.equals(result.windCorrectionAngle, 0);
        });
    });
});
// No mocks needed - pure functions
```

### 8.2 Unit Tests (Index Strategies)

```javascript
// tests/test-spatial-index.js
describe('SpatialGridIndex', () => {
    let index;

    beforeEach(() => {
        index = new SpatialGridIndex(1.0);
        index.build(new Map([
            ['KSFO', { lat: 37.62, lon: -122.38 }],
            ['KLAX', { lat: 33.94, lon: -118.41 }],
            ['KJFK', { lat: 40.64, lon: -73.78 }]
        ]));
    });

    it('finds nearby airports', () => {
        const results = index.query({ lat: 37.5, lon: -122.5, radiusNM: 50 });
        assert.includes(results.map(r => r.id), 'KSFO');
        assert.notIncludes(results.map(r => r.id), 'KLAX');
    });

    it('finds airports in bounds', () => {
        const results = index.query({
            bounds: { minLat: 33, maxLat: 38, minLon: -123, maxLon: -117 }
        });
        assert.equals(results.length, 2); // KSFO and KLAX
    });
});
```

### 8.3 Integration Tests (Services)

```javascript
// tests/test-route-service.js
describe('RouteService', () => {
    let service;
    let mockQuery;
    let mockRepo;

    beforeEach(() => {
        mockQuery = {
            getTokenType: (t) => mockTokenTypes[t],
            getAirport: (c) => mockAirports[c],
            getNavaid: (c) => mockNavaids[c]
        };
        mockRepo = {
            get: (source, key) => Promise.resolve(mockData[source])
        };
        service = new RouteService({ queryEngine: mockQuery, dataRepository: mockRepo });
    });

    it('plans simple route', async () => {
        const result = await service.planRoute('KSFO KLAX', { cruiseSpeed: 120 });

        assert.equals(result.waypoints.length, 2);
        assert.equals(result.legs.length, 1);
        assert.approximately(result.totals.distance, 337, 5);
    });
});
```

### 8.4 Contract Tests

```javascript
// tests/test-datasource-contract.js
function testDataSourceContract(SourceClass, config, mockFetch) {
    describe(`${SourceClass.name} implements DataSource`, () => {
        let source;

        beforeEach(() => {
            source = new SourceClass(config);
            global.fetch = mockFetch;
        });

        it('has fetch method', () => assert.isFunction(source.fetch));
        it('has parse method', () => assert.isFunction(source.parse));
        it('has validate method', () => assert.isFunction(source.validate));
        it('has load method', () => assert.isFunction(source.load));

        it('load returns data', async () => {
            const data = await source.load();
            assert.exists(data);
        });
    });
}

// Run for each implementation
testDataSourceContract(NASRSource, nasrConfig, mockNASRFetch);
testDataSourceContract(TerrainSource, {}, mockTerrainFetch);
testDataSourceContract(WeatherSource, { type: 'metar' }, mockWeatherFetch);
```

---

## Appendix A: Backward Compatibility

During migration, maintain backward compatibility:

```javascript
// data/data-manager.js (legacy facade)
window.DataManager = {
    // Delegate to new Repository
    getAirport(icao) {
        return window.App?.queryEngine?.getAirport(icao)
            || this._legacyAirports?.get(icao);
    },

    // Deprecated - log warning
    searchWaypoints(query) {
        console.warn('[DataManager] searchWaypoints is deprecated, use QueryEngine');
        return window.App?.queryEngine?.searchWaypoints(query) || [];
    },

    // ... other legacy methods
};
```

---

## Appendix B: Bootstrap Sequence

```javascript
// main.js - Application initialization

async function bootstrap() {
    console.log('[App] Bootstrapping...');

    // 1. Create storage
    const storage = new IndexedDBStorage('InFlightDB');
    await storage.init();

    // 2. Create data repository with sources
    const repository = new DataRepository()
        .setStorage(storage)
        .registerSource('airports', new NASRSource({ file: 'APT_BASE.csv', parser: AirportParser }), new VersionStrategy(isNASRValid))
        .registerSource('navaids', new NASRSource({ file: 'NAV_BASE.csv', parser: NavaidParser }), new VersionStrategy(isNASRValid))
        .registerSource('fixes', new NASRSource({ file: 'FIX_BASE.csv', parser: FixParser }), new VersionStrategy(isNASRValid))
        .registerSource('airways', new NASRSource({ file: 'AWY.csv', parser: AirwayParser }), new VersionStrategy(isNASRValid))
        .registerSource('terrain', new TerrainSource(), new PermanentStrategy())
        .registerSource('weather_metar', new WeatherSource({ type: 'metar' }), new TTLStrategy(5 * 60 * 1000));

    // 3. Create query engine with indexes
    const queryEngine = new QueryEngine()
        .registerIndex('airports', new MapIndex())
        .registerIndex('airports_search', new TrieIndex())
        .registerIndex('airports_spatial', new SpatialGridIndex())
        .registerIndex('navaids', new MapIndex())
        .registerIndex('navaids_spatial', new SpatialGridIndex())
        .registerIndex('fixes', new MapIndex())
        .registerIndex('fixes_spatial', new SpatialGridIndex())
        .registerIndex('airways', new MapIndex())
        .registerIndex('tokenTypes', new MapIndex());

    // 4. Initialize query engine (loads data, builds indexes)
    await queryEngine.initialize(repository);

    // 5. Create services
    const routeService = new RouteService({ queryEngine, dataRepository: repository });
    const weatherService = new WeatherService({ dataRepository: repository });

    // 6. Export for UI
    window.App = {
        repository,
        queryEngine,
        routeService,
        weatherService
    };

    // 7. Legacy compatibility
    window.QueryEngine = queryEngine;

    console.log('[App] Bootstrap complete');
}

document.addEventListener('DOMContentLoaded', bootstrap);
```

---

*Document Version: 1.0*
*Created: 2025-11-28*
*Status: Specification for Implementation*
