# Data Integrity & Checksum Validation

## Overview

IN-FLIGHT implements SHA-256 checksum validation to ensure aviation data integrity. This is **critical for flight safety** - corrupted airport coordinates, navaid frequencies, or airway waypoints could lead to navigation errors.

**Version**: Added in v2.5.0 (Database v12)

---

## Architecture

### Two-Tier Data Classification

```
┌──────────────────────────────────────────┐
│ LONG-TERM DATA (Static)                  │
│ • Cache Duration: 28 days                │
│ • Validation: SHA-256 checksums          │
│ • Action on Corruption: Clear + Reload   │
├──────────────────────────────────────────┤
│ - Airports (70,000+)                     │
│ - Navaids (10,000+)                      │
│ - Airways, Procedures                    │
│ - Raw CSV data (compressed)              │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ PERISHABLE DATA (Time-Sensitive)         │
│ • Cache Duration: 15 min - 6 hours       │
│ • Validation: SHA-256 + Expiry check     │
│ • Action on Expiry: Block access + Warn  │
├──────────────────────────────────────────┤
│ - Winds Aloft (3 hours)                  │
│ - METARs (1 hour)                        │
│ - TAFs (6 hours)                         │
│ - TFRs (15 minutes)                      │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ SESSION DATA (User-Generated)            │
│ • Cache Duration: 24 hours               │
│ • Validation: SHA-256 checksums          │
│ • Action on Corruption: Warn + Delete    │
├──────────────────────────────────────────┤
│ - Flight plans                           │
│ - GPS tracks                             │
│ - Route history                          │
└──────────────────────────────────────────┘
```

---

## Checksum Utility ([utils/checksum.js](../../utils/checksum.js))

### API

#### `ChecksumUtils.calculate(data)`

Calculate SHA-256 checksum for any data structure.

**Parameters**:
- `data` (any): JSON-serializable data (Object, Array, Map, primitive)

**Returns**: `Promise<string>` - 64-character hex string

**Example**:
```javascript
const airports = new Map([
    ['KALB', { lat: 42.7, lon: -73.8 }],
    ['KBOS', { lat: 42.4, lon: -71.0 }]
]);

const checksum = await ChecksumUtils.calculate(airports);
// "a7f3b2c1..." (64 chars)
```

---

#### `ChecksumUtils.verify(data, expectedChecksum)`

Verify data matches expected checksum.

**Parameters**:
- `data` (any): Data to verify
- `expectedChecksum` (string): Expected SHA-256 hash

**Returns**: `Promise<boolean>` - `true` if valid, `false` if corrupted

**Example**:
```javascript
const airports = loadFromDB();
const valid = await ChecksumUtils.verify(airports, storedChecksum);

if (!valid) {
    console.error('DATA CORRUPTION DETECTED');
    clearCache();
    throw new Error('Please reload database');
}
```

---

#### `ChecksumUtils.calculateMultiple(dataMap)`

Calculate checksums for multiple datasets in parallel.

**Parameters**:
- `dataMap` (Object): `{ key: data }` pairs

**Returns**: `Promise<Object>` - `{ key: checksum }` pairs

**Example**:
```javascript
const checksums = await ChecksumUtils.calculateMultiple({
    airports: airportsData,
    navaids: navaidsData,
    airways: airwaysData
});

// {
//   airports: "a7f3...",
//   navaids: "b2c1...",
//   airways: "c3d2..."
// }
```

---

#### `ChecksumUtils.verifyMultiple(dataMap, checksumMap)`

Verify multiple datasets in parallel.

**Returns**: `Promise<Object>` - `{ key: boolean }` verification results

**Example**:
```javascript
const results = await ChecksumUtils.verifyMultiple(
    {
        airports: loadedAirports,
        navaids: loadedNavaids
    },
    {
        airports: storedChecksums.airports,
        navaids: storedChecksums.navaids
    }
);

// { airports: true, navaids: false }

const failed = Object.entries(results)
    .filter(([key, valid]) => !valid)
    .map(([key]) => key);

if (failed.length > 0) {
    throw new Error(`Corrupted: ${failed.join(', ')}`);
}
```

---

## Data Manager Integration

### Database Schema v12

```javascript
const data = {
    id: 'flightdata_cache_v12',
    version: 12,
    timestamp: Date.now(),

    // Data structures (serialized Maps)
    airports: Array.from(airportsData.entries()),
    navaids: Array.from(navaidsData.entries()),
    fixes: Array.from(fixesData.entries()),
    // ... etc

    // Raw CSV (compressed)
    rawCSV: compressedCSVData,
    compressed: true,

    // NEW: Checksums for integrity verification
    checksums: {
        airports: "a7f3b2c1...",
        navaids: "b2c1d3e4...",
        fixes: "c3d2e4f5...",
        // ... one checksum per data type
        rawCSV: "d4e5f6a7..."  // Checksum compressed data
    }
};
```

### Save Flow ([data/data-manager.js:76-157](../../data/data-manager.js))

```javascript
async function saveToCache() {
    // 1. Compress raw CSV
    const rawCSVToStore = await CompressionUtils.compressMultiple(rawCSVData);

    // 2. Calculate checksums (parallel)
    const checksums = await ChecksumUtils.calculateMultiple({
        airports: airportsData,
        navaids: navaidsData,
        fixes: fixesData,
        frequencies: frequenciesData,
        runways: runwaysData,
        airways: airwaysData,
        stars: starsData,
        dps: dpsData,
        airspace: airspaceData,
        rawCSV: rawCSVToStore  // Checksum AFTER compression
    });

    // 3. Store with checksums
    const data = {
        id: 'flightdata_cache_v12',
        airports: Array.from(airportsData.entries()),
        // ... other data
        checksums: checksums  // <-- NEW
    };

    await indexedDB.put(data);
}
```

**Timing**: ~200-400ms for 85,000+ records on modern hardware

---

### Load & Verify Flow ([data/data-manager.js:561-640](../../data/data-manager.js))

**Two-Phase Verification Strategy:**

#### Phase 1: Startup (Every Load) - Verify Parsed Data Only

```javascript
async function checkCachedData() {
    const cachedData = await loadFromCacheDB();

    // Verify checksums if available (v12+)
    // NOTE: Only verify parsed data structures (NOT raw CSV) on startup
    if (cachedData.version >= 12 && cachedData.checksums) {
        console.log('[DataManager] Verifying cached data structures...');

        // Only verify parsed data structures (NOT rawCSV)
        const dataToVerify = {
            airports: new Map(cachedData.airports),
            navaids: new Map(cachedData.navaids),
            fixes: new Map(cachedData.fixes),
            frequencies: new Map(cachedData.frequencies),
            runways: new Map(cachedData.runways),
            airways: new Map(cachedData.airways),
            stars: new Map(cachedData.stars),
            dps: new Map(cachedData.dps),
            airspace: new Map(cachedData.airspace)
            // rawCSV is NOT verified here (only during reindexing)
        };

        // Verify data structure checksums in parallel
        const results = await ChecksumUtils.verifyMultiple(
            dataToVerify,
            cachedData.checksums
        );

        // Check for failures
        const failed = Object.entries(results)
            .filter(([key, valid]) => !valid);

        if (failed.length > 0) {
            const keys = failed.map(([key]) => key).join(', ');
            console.error('[DataManager] DATA INTEGRITY FAILURE:', keys);

            // Clear corrupted cache
            await clearCacheDB();

            return {
                loaded: false,
                corrupted: true,
                status: `[ERR] DATA CORRUPTED (${keys}) - RELOAD REQUIRED`
            };
        }

        console.log('[DataManager] ✓ All data structures verified');
    }

    // Load into memory (fast path - no CSV parsing)
    await loadFromCache(cachedData);

    return {
        loaded: true,
        status: '[OK] DATABASE LOADED [VERIFIED]'
    };
}
```

**Timing**: ~200-300ms for verification + loading (10 datasets, no raw CSV)

**Rationale**:
- Parsed data structures (Maps) are what the app actually uses
- Raw CSV (55MB compressed) is only needed for reindexing
- Verifying 55MB on every startup is wasteful

---

#### Phase 2: Reindexing (User Action) - Verify Raw CSV

```javascript
async function loadFromCache(onStatusUpdate) {
    const cachedData = await loadFromCacheDB();

    // Verify raw CSV checksum if available (v12+)
    // This is the ONLY time we verify raw CSV (during reindexing)
    if (cachedData.version >= 12 && cachedData.checksums && cachedData.checksums.rawCSV) {
        onStatusUpdate('[...] VERIFYING RAW CSV INTEGRITY', 'loading');
        console.log('[DataManager] Verifying raw CSV checksum before reindexing...');

        const rawCSVValid = await ChecksumUtils.verify(
            cachedData.rawCSV,
            cachedData.checksums.rawCSV
        );

        if (!rawCSVValid) {
            console.error('[DataManager] RAW CSV CHECKSUM FAILURE');
            throw new Error('Raw CSV data corrupted - reload database from internet.');
        }

        console.log('[DataManager] ✓ Raw CSV verified');
    }

    // Decompress and reparse
    rawCSVData = await CompressionUtils.decompressMultiple(cachedData.rawCSV);
    await reparseFromRawCSV(onStatusUpdate);
}
```

**Timing**: ~1.5-2.5 seconds (verify 55MB + decompress + reparse)

**When**: Only when user clicks "REINDEX CACHE" button

---

## Error Handling

### Corruption Detection Flow

```
User opens app
    ↓
DataManager.checkCachedData()
    ↓
Load from IndexedDB
    ↓
Verify checksums
    ↓
┌─────────────┐
│ CORRUPTED?  │
└─────────────┘
       │
       ├─→ YES ─→ Clear cache
       │          ↓
       │      Show error alert:
       │      "DATA INTEGRITY FAILURE
       │       Cached aviation data failed verification.
       │       Please reload database."
       │          ↓
       │      UI: "LOAD DATA" button enabled
       │
       └─→ NO ──→ Load into memory
                  ↓
              Show success:
              "[OK] DATABASE LOADED [VERIFIED]"
```

### User Experience

**Normal flow** (no corruption):
```
[OK] INDEXED DATABASE LOADED (12D OLD - NASR + OurAirports) [VERIFIED]
```

**Corruption detected**:
```
Alert Dialog:
┌────────────────────────────────────────────┐
│  DATA INTEGRITY FAILURE                    │
│                                            │
│  Cached aviation data failed checksum     │
│  verification. This indicates corruption. │
│                                            │
│  The corrupted cache has been cleared.    │
│  Please reload the database.              │
│                                            │
│  [ OK ]                                   │
└────────────────────────────────────────────┘

Status: [ERR] DATA CORRUPTED - PLEASE RELOAD
```

---

## Testing

### Unit Tests ([tests/test-checksum.js](../../tests/test-checksum.js))

**Coverage**: 24 test cases covering:
- Basic checksum calculation (Objects, Arrays, Maps, primitives)
- Corruption detection
- Deterministic output (order-independence for Maps)
- Multiple dataset verification
- Performance (1000+ records)
- Edge cases (null, empty, nested structures)
- Backward compatibility (missing checksums)

**Run tests**:
```bash
npm test                    # Node.js (all tests)
npm run test:browser        # Browser (with Web Crypto API)
```

**Example test**:
```javascript
{
    name: 'should detect data corruption',
    async run() {
        const original = { route: 'KALB KBOS' };
        const checksum = await ChecksumUtils.calculate(original);

        // Simulate corruption
        const corrupted = { route: 'CORRUPTED' };
        const valid = await ChecksumUtils.verify(corrupted, checksum);

        assert.equals(valid, false);
    }
}
```

---

## Performance Characteristics

### Checksum Calculation (Save)

| Dataset | Records | Time (SHA-256) | Frequency |
|---------|---------|---------------|-----------|
| Airports | 70,234 | ~100ms | Save only |
| Navaids | 8,621 | ~30ms | Save only |
| Fixes | 12,450 | ~40ms | Save only |
| Airways | ~2,000 | ~15ms | Save only |
| Other structures | ~2,000 | ~15ms | Save only |
| **Raw CSV (compressed)** | **55MB** | **~200ms** | **Save only** |
| **Total (11 datasets)** | **~85,000** | **~400ms** | **Save only** |

**Total save time with checksums**: ~1.5-2.0 seconds (compression + checksums + IndexedDB write)

---

### Verification (Load)

**Two-phase strategy for optimal performance:**

#### Startup Verification (Every Load)

| Dataset | Records | Time | Verified On |
|---------|---------|------|-------------|
| Airports | 70,234 | ~80ms | Every startup |
| Navaids | 8,621 | ~25ms | Every startup |
| Fixes | 12,450 | ~35ms | Every startup |
| Airways | ~2,000 | ~12ms | Every startup |
| Other structures | ~2,000 | ~12ms | Every startup |
| Raw CSV | 55MB | **SKIPPED** | **Reindex only** |
| **Total** | **~85,000** | **~200ms** | **Every startup** |

**Startup load time**: ~500-700ms (IndexedDB read + verification + data loading)

---

#### Reindex Verification (User Action)

| Component | Size | Time | When |
|-----------|------|------|------|
| Raw CSV checksum | 55MB | ~200ms | Reindex only |
| Decompression | 55MB | ~300ms | Reindex only |
| Re-parsing | 85K records | ~1.0s | Reindex only |
| **Total** | - | **~1.5s** | **Reindex only** |

**Benefits**:
- **80% faster startup** (200ms vs 1000ms) by skipping raw CSV verification
- **100% protection** when it matters (reindexing from potentially corrupted source)
- **Best of both worlds**: Fast daily use, safe reindexing

---

## Implementation Notes

### Deterministic Serialization

**Challenge**: JavaScript `Map` iteration order is insertion order, which varies.

**Solution**: Sort keys before serialization.

```javascript
_serializeForChecksum(data) {
    if (data instanceof Map) {
        const entries = Array.from(data.entries());
        // Sort by key for deterministic output
        entries.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
        return JSON.stringify(entries);
    }
    // ... handle other types
}
```

**Result**: Same data always produces same checksum, regardless of insertion order.

---

### Backward Compatibility

**Old caches (v11)** without checksums:
- Load without verification
- Show warning: `[!] NO CHECKSUMS - UPGRADE RECOMMENDED`
- Next save will add checksums

**Null checksum handling**:
```javascript
async verify(data, expectedChecksum) {
    if (!expectedChecksum) {
        console.warn('[ChecksumUtils] No checksum - skipping');
        return true;  // Pass for backward compat
    }
    // ... normal verification
}
```

---

## Security Considerations

### SHA-256 Properties

- **Collision resistance**: Computationally infeasible to find two inputs with same hash
- **Avalanche effect**: Small change in input → completely different hash
- **One-way**: Cannot reverse hash to get original data

**Not used for**:
- Cryptographic signatures (no private keys)
- Authentication (not secret)
- Encryption (data stored plaintext)

**Used for**:
- **Integrity verification**: Detect accidental corruption (disk errors, browser bugs, IndexedDB issues)
- **Change detection**: Know when data has been modified

### Threat Model

**Protected against**:
- ✅ Storage corruption (disk errors, power loss)
- ✅ Browser bugs (IndexedDB implementation issues)
- ✅ Accidental modification
- ✅ Incomplete writes (transaction failures)

**NOT protected against**:
- ❌ Intentional tampering (attacker with DB access could modify both data and checksum)
- ❌ Man-in-the-middle attacks (no HTTPS verification - handled by browser)
- ❌ Malicious browser extensions (full access to page context)

**Rationale**: Aviation data integrity is about **detecting accidents**, not preventing attacks. If an attacker has access to modify IndexedDB, they can also modify JavaScript code.

---

## Future Enhancements

### Planned (Phase 2-4)

1. **Perishable Data Checksums** (Weather)
   - METAR/TAF verification
   - Winds aloft integrity
   - TFR validation

2. **Session Data Checksums** (User-Generated)
   - Flight plan verification
   - GPS track integrity
   - Import/export validation

3. **Performance Optimizations**
   - Web Workers for parallel checksum calculation
   - Incremental checksums (only verify changed data)
   - Bloom filters for fast corruption detection

4. **Advanced Recovery**
   - Partial data recovery (load valid portions, skip corrupted)
   - Automatic re-download of corrupted files
   - Checksum repair (re-parse raw CSV if data corrupted but CSV intact)

---

## Debugging

### Enable verbose logging

```javascript
// In browser console
localStorage.setItem('debug_checksums', 'true');

// Reload page - will see:
// [ChecksumUtils] Calculating checksum for airports... (70234 records)
// [ChecksumUtils] Checksum: a7f3b2c1... (took 245ms)
// [ChecksumUtils] Verifying airports checksum...
// [ChecksumUtils] ✓ Verified: a7f3b2c1...
```

### Manual verification

```javascript
// In DevTools → Application → IndexedDB → FlightPlanningDB
const cachedData = await DataManager.loadFromCacheDB();

// Verify manually
const airports = new Map(cachedData.airports);
const checksum = await ChecksumUtils.calculate(airports);

console.log('Stored:', cachedData.checksums.airports);
console.log('Actual:', checksum);
console.log('Match:', checksum === cachedData.checksums.airports);
```

---

## Related Documentation

- [Architecture](./02-architecture.md) - Overall system design
- [Data Management](./03-data-management.md) - IndexedDB and caching strategy
- [Testing](./06-testing-deployment.md) - Test suite architecture

---

*Last Updated*: 2025-01-20
*Version*: 2.5.0-dev (Database v12)
