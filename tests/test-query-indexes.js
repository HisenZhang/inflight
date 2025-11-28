// Tests for query/core/* and query/indexes/*
// Architecture v3.0.0 - Query Layer (Index Strategies)

// ============================================
// INDEX STRATEGY ABSTRACT BASE
// ============================================

TestFramework.describe('IndexStrategy - Abstract Base Class', function({ it }) {

    it('should have IndexStrategy defined', () => {
        assert.isDefined(window.IndexStrategy, 'IndexStrategy should be defined');
    });

    it('should be a class/constructor', () => {
        assert.isFunction(window.IndexStrategy, 'IndexStrategy should be a constructor');
    });

    it('should throw on direct build() call', () => {
        const strategy = new window.IndexStrategy();
        assert.throws(() => {
            strategy.build([]);
        }, 'Abstract build() should throw');
    });

    it('should throw on direct query() call', () => {
        const strategy = new window.IndexStrategy();
        assert.throws(() => {
            strategy.query({});
        }, 'Abstract query() should throw');
    });

    it('should throw on direct update() call', () => {
        const strategy = new window.IndexStrategy();
        assert.throws(() => {
            strategy.update('key', 'value');
        }, 'Abstract update() should throw');
    });

    it('should throw on direct delete() call', () => {
        const strategy = new window.IndexStrategy();
        assert.throws(() => {
            strategy.delete('key');
        }, 'Abstract delete() should throw');
    });

    it('should throw on direct clear() call', () => {
        const strategy = new window.IndexStrategy();
        assert.throws(() => {
            strategy.clear();
        }, 'Abstract clear() should throw');
    });

    it('should throw on size property access', () => {
        const strategy = new window.IndexStrategy();
        assert.throws(() => {
            const s = strategy.size;
        }, 'Abstract size should throw');
    });
});

// ============================================
// MAP INDEX TESTS
// ============================================

TestFramework.describe('MapIndex - Simple Key-Value Index', function({ it, beforeEach }) {
    let index;

    beforeEach(() => {
        index = new window.MapIndex();
    });

    it('should have MapIndex defined', () => {
        assert.isDefined(window.MapIndex, 'MapIndex should be defined');
    });

    it('should implement IndexStrategy interface', () => {
        assert.isFunction(index.build, 'Should have build method');
        assert.isFunction(index.query, 'Should have query method');
        assert.isFunction(index.update, 'Should have update method');
        assert.isFunction(index.delete, 'Should have delete method');
        assert.isFunction(index.clear, 'Should have clear method');
    });

    it('should build from Map', () => {
        const data = new Map([
            ['KSFO', { name: 'San Francisco' }],
            ['KLAX', { name: 'Los Angeles' }]
        ]);

        const result = index.build(data);
        assert.equals(result, index, 'build() should return this for chaining');
        assert.equals(index.size, 2, 'Should have 2 entries');
    });

    it('should build from Array with id property', () => {
        const data = [
            { id: 'KSFO', name: 'San Francisco' },
            { id: 'KLAX', name: 'Los Angeles' }
        ];

        index.build(data);
        assert.equals(index.size, 2, 'Should have 2 entries from array');
    });

    it('should build from Array with key property', () => {
        const data = [
            { key: 'KSFO', name: 'San Francisco' },
            { key: 'KLAX', name: 'Los Angeles' }
        ];

        index.build(data);
        assert.equals(index.size, 2, 'Should have 2 entries from array with key');
    });

    it('should query by key', () => {
        const data = new Map([
            ['KSFO', { name: 'San Francisco', lat: 37.62 }]
        ]);
        index.build(data);

        const result = index.query({ key: 'KSFO' });
        assert.isNotNull(result, 'Should find KSFO');
        assert.equals(result.name, 'San Francisco', 'Should return correct data');
    });

    it('should return null for missing key', () => {
        index.build(new Map());
        const result = index.query({ key: 'MISSING' });
        assert.isNull(result, 'Should return null for missing key');
    });

    it('should update entries', () => {
        index.build(new Map([['KSFO', { name: 'SFO' }]]));
        index.update('KSFO', { name: 'San Francisco International' });

        const result = index.query({ key: 'KSFO' });
        assert.equals(result.name, 'San Francisco International', 'Should update value');
    });

    it('should delete entries', () => {
        index.build(new Map([['KSFO', { name: 'SFO' }]]));
        index.delete('KSFO');

        const result = index.query({ key: 'KSFO' });
        assert.isNull(result, 'Should not find deleted key');
        assert.equals(index.size, 0, 'Size should be 0');
    });

    it('should clear all entries', () => {
        index.build(new Map([
            ['KSFO', { name: 'SFO' }],
            ['KLAX', { name: 'LAX' }]
        ]));
        index.clear();

        assert.equals(index.size, 0, 'Size should be 0 after clear');
    });

    it('should report correct size', () => {
        index.build(new Map([
            ['A', 1], ['B', 2], ['C', 3]
        ]));
        assert.equals(index.size, 3, 'Size should be 3');
    });
});

// ============================================
// TRIE INDEX TESTS
// ============================================

TestFramework.describe('TrieIndex - Prefix Search Index', function({ it, beforeEach }) {
    let index;

    beforeEach(() => {
        index = new window.TrieIndex();
    });

    it('should have TrieIndex defined', () => {
        assert.isDefined(window.TrieIndex, 'TrieIndex should be defined');
    });

    it('should implement IndexStrategy interface', () => {
        assert.isFunction(index.build, 'Should have build method');
        assert.isFunction(index.query, 'Should have query method');
        assert.isFunction(index.clear, 'Should have clear method');
    });

    it('should build from Map', () => {
        const data = new Map([
            ['KSFO', { name: 'San Francisco' }],
            ['KLAX', { name: 'Los Angeles' }],
            ['KSQL', { name: 'San Carlos' }]
        ]);

        const result = index.build(data);
        assert.equals(result, index, 'build() should return this for chaining');
        assert.equals(index.size, 3, 'Should have 3 entries');
    });

    it('should find exact matches', () => {
        index.build(new Map([
            ['KSFO', { name: 'San Francisco' }]
        ]));

        const results = index.query({ prefix: 'KSFO', limit: 10 });
        assert.isArray(results, 'Should return array');
        assert.equals(results.length, 1, 'Should find 1 match');
        assert.equals(results[0].key, 'KSFO', 'Should find KSFO');
    });

    it('should find prefix matches', () => {
        index.build(new Map([
            ['KSFO', { name: 'San Francisco' }],
            ['KSQL', { name: 'San Carlos' }],
            ['KSJC', { name: 'San Jose' }],
            ['KLAX', { name: 'Los Angeles' }]
        ]));

        const results = index.query({ prefix: 'KS', limit: 10 });
        assert.equals(results.length, 3, 'Should find 3 KS* airports');
    });

    it('should be case-insensitive', () => {
        index.build(new Map([
            ['KSFO', { name: 'San Francisco' }]
        ]));

        const upper = index.query({ prefix: 'KSFO', limit: 10 });
        const lower = index.query({ prefix: 'ksfo', limit: 10 });
        const mixed = index.query({ prefix: 'kSfO', limit: 10 });

        assert.equals(upper.length, 1, 'Upper case should find match');
        assert.equals(lower.length, 1, 'Lower case should find match');
        assert.equals(mixed.length, 1, 'Mixed case should find match');
    });

    it('should respect limit parameter', () => {
        index.build(new Map([
            ['KSFO', {}], ['KSQL', {}], ['KSJC', {}],
            ['KSAN', {}], ['KSNA', {}]
        ]));

        const results = index.query({ prefix: 'KS', limit: 2 });
        assert.equals(results.length, 2, 'Should respect limit');
    });

    it('should return empty array for no matches', () => {
        index.build(new Map([
            ['KSFO', {}]
        ]));

        const results = index.query({ prefix: 'ZZZ', limit: 10 });
        assert.isArray(results, 'Should return array');
        assert.equals(results.length, 0, 'Should have no matches');
    });

    it('should return empty array for empty prefix', () => {
        index.build(new Map([['KSFO', {}]]));

        const results = index.query({ prefix: '', limit: 10 });
        assert.isArray(results, 'Should return array');
    });

    it('should clear all entries', () => {
        index.build(new Map([['A', 1], ['B', 2]]));
        index.clear();

        assert.equals(index.size, 0, 'Size should be 0 after clear');
    });

    it('should sort results alphabetically', () => {
        index.build(new Map([
            ['KSQL', {}], ['KSFO', {}], ['KSJC', {}]
        ]));

        const results = index.query({ prefix: 'KS', limit: 10 });
        const keys = results.map(r => r.key);

        assert.equals(keys[0], 'KSFO', 'First should be KSFO');
        assert.equals(keys[1], 'KSJC', 'Second should be KSJC');
        assert.equals(keys[2], 'KSQL', 'Third should be KSQL');
    });
});

// ============================================
// SPATIAL GRID INDEX TESTS
// ============================================

TestFramework.describe('SpatialGridIndex - Spatial Queries', function({ it, beforeEach }) {
    let index;

    beforeEach(() => {
        index = new window.SpatialGridIndex(1.0); // 1 degree grid
    });

    it('should have SpatialGridIndex defined', () => {
        assert.isDefined(window.SpatialGridIndex, 'SpatialGridIndex should be defined');
    });

    it('should implement IndexStrategy interface', () => {
        assert.isFunction(index.build, 'Should have build method');
        assert.isFunction(index.query, 'Should have query method');
        assert.isFunction(index.clear, 'Should have clear method');
    });

    it('should accept grid size in constructor', () => {
        const smallGrid = new window.SpatialGridIndex(0.5);
        assert.isDefined(smallGrid, 'Should accept different grid sizes');
    });

    it('should build from Map with lat/lon', () => {
        const data = new Map([
            ['KSFO', { lat: 37.62, lon: -122.38 }],
            ['KLAX', { lat: 33.94, lon: -118.41 }]
        ]);

        const result = index.build(data);
        assert.equals(result, index, 'build() should return this for chaining');
        assert.equals(index.size, 2, 'Should have 2 entries');
    });

    it('should skip entries without lat/lon', () => {
        const data = new Map([
            ['KSFO', { lat: 37.62, lon: -122.38 }],
            ['INVALID', { name: 'No coordinates' }]
        ]);

        index.build(data);
        assert.equals(index.size, 1, 'Should only index entries with coordinates');
    });

    it('should find points within radius', () => {
        const data = new Map([
            ['KSFO', { lat: 37.62, lon: -122.38, name: 'SFO' }],
            ['KOAK', { lat: 37.72, lon: -122.22, name: 'OAK' }],
            ['KLAX', { lat: 33.94, lon: -118.41, name: 'LAX' }]
        ]);
        index.build(data);

        // Search near SFO (37.62, -122.38) within 20nm
        // OAK is ~10nm away, LAX is ~340nm away
        const results = index.query({ lat: 37.62, lon: -122.38, radiusNM: 20 });

        assert.isArray(results, 'Should return array');
        // Note: This returns candidates from grid cells, not exact distance filtered
        assert.isTrue(results.length >= 1, 'Should find at least KSFO area');
    });

    it('should find points within bounds', () => {
        const data = new Map([
            ['KSFO', { lat: 37.62, lon: -122.38 }],
            ['KOAK', { lat: 37.72, lon: -122.22 }],
            ['KLAX', { lat: 33.94, lon: -118.41 }]
        ]);
        index.build(data);

        // Bay Area bounds
        const results = index.query({
            bounds: {
                minLat: 37.0,
                maxLat: 38.0,
                minLon: -123.0,
                maxLon: -122.0
            }
        });

        assert.isArray(results, 'Should return array');
        const ids = results.map(r => r.id);
        assert.isTrue(ids.includes('KSFO') || ids.includes('KOAK'),
            'Should find Bay Area airports');
        assert.isFalse(ids.includes('KLAX'), 'Should not include LAX');
    });

    it('should return empty array for no matches', () => {
        const data = new Map([
            ['KSFO', { lat: 37.62, lon: -122.38 }]
        ]);
        index.build(data);

        // Search far from any data
        const results = index.query({
            bounds: {
                minLat: 0, maxLat: 1,
                minLon: 0, maxLon: 1
            }
        });

        assert.isArray(results, 'Should return array');
        assert.equals(results.length, 0, 'Should find no matches');
    });

    it('should clear all entries', () => {
        index.build(new Map([
            ['KSFO', { lat: 37.62, lon: -122.38 }]
        ]));
        index.clear();

        assert.equals(index.size, 0, 'Size should be 0 after clear');
    });

    it('should handle crossing grid boundaries', () => {
        // Test with points on grid boundaries
        const data = new Map([
            ['A', { lat: 37.0, lon: -122.0 }],  // On grid boundary
            ['B', { lat: 37.5, lon: -122.5 }],  // Inside grid cell
            ['C', { lat: 38.0, lon: -122.0 }]   // On next grid boundary
        ]);
        index.build(data);

        assert.equals(index.size, 3, 'Should handle boundary points');
    });
});

// ============================================
// QUERY ENGINE v2 TESTS
// ============================================

TestFramework.describe('QueryEngine v2 - Index Coordinator', function({ it, beforeEach }) {
    let engine;

    beforeEach(() => {
        // Check if new QueryEngineV2 exists, otherwise skip
        if (typeof window.QueryEngineV2 === 'undefined') {
            // Tests will fail gracefully, marking what needs implementing
            engine = null;
        } else {
            engine = new window.QueryEngineV2();
        }
    });

    it('should have QueryEngineV2 defined', () => {
        assert.isDefined(window.QueryEngineV2, 'QueryEngineV2 should be defined');
    });

    it('should be a class/constructor', () => {
        assert.isFunction(window.QueryEngineV2, 'QueryEngineV2 should be a constructor');
    });

    it('should allow registering indexes', () => {
        if (!engine) return;

        const mapIndex = new window.MapIndex();
        const result = engine.registerIndex('airports', mapIndex);

        assert.equals(result, engine, 'registerIndex should return this for chaining');
    });

    it('should initialize with data repository', async () => {
        if (!engine) return;

        const mapIndex = new window.MapIndex();
        engine.registerIndex('airports', mapIndex);

        // Mock repository
        const mockRepo = {
            loadAll: async () => ({
                airports: new Map([['KSFO', { name: 'SFO' }]])
            })
        };

        const result = await engine.initialize(mockRepo);
        assert.equals(result, engine, 'initialize should return this');
    });

    it('should query by key from index', () => {
        if (!engine) return;

        const mapIndex = new window.MapIndex();
        mapIndex.build(new Map([['KSFO', { name: 'SFO', lat: 37.62 }]]));
        engine.registerIndex('airports', mapIndex);

        const result = engine.getByKey('airports', 'KSFO');
        assert.isNotNull(result, 'Should find KSFO');
        assert.equals(result.name, 'SFO', 'Should return correct data');
    });

    it('should search with prefix from trie index', () => {
        if (!engine) return;

        const trieIndex = new window.TrieIndex();
        trieIndex.build(new Map([
            ['KSFO', {}], ['KSQL', {}], ['KLAX', {}]
        ]));
        engine.registerIndex('airports_search', trieIndex);

        const results = engine.search('airports_search', 'KS', 10);
        assert.equals(results.length, 2, 'Should find 2 KS* airports');
    });

    it('should find in bounds from spatial index', () => {
        if (!engine) return;

        const spatialIndex = new window.SpatialGridIndex();
        spatialIndex.build(new Map([
            ['KSFO', { lat: 37.62, lon: -122.38 }],
            ['KLAX', { lat: 33.94, lon: -118.41 }]
        ]));
        engine.registerIndex('airports_spatial', spatialIndex);

        const results = engine.findInBounds('airports_spatial', {
            minLat: 37, maxLat: 38, minLon: -123, maxLon: -122
        });

        assert.isArray(results, 'Should return array');
    });

    it('should find nearby from spatial index', () => {
        if (!engine) return;

        const spatialIndex = new window.SpatialGridIndex();
        spatialIndex.build(new Map([
            ['KSFO', { lat: 37.62, lon: -122.38 }],
            ['KOAK', { lat: 37.72, lon: -122.22 }]
        ]));
        engine.registerIndex('airports_spatial', spatialIndex);

        const results = engine.findNearby('airports_spatial', 37.62, -122.38, 20);
        assert.isArray(results, 'Should return array');
    });

    it('should get token type', () => {
        if (!engine) return;

        const tokenIndex = new window.MapIndex();
        tokenIndex.build(new Map([
            ['KSFO', 'AIRPORT'],
            ['SFO', 'NAVAID'],
            ['V25', 'AIRWAY']
        ]));
        engine.registerIndex('tokenTypes', tokenIndex);

        assert.equals(engine.getTokenType('KSFO'), 'AIRPORT', 'Should return AIRPORT');
        assert.equals(engine.getTokenType('SFO'), 'NAVAID', 'Should return NAVAID');
        assert.equals(engine.getTokenType('V25'), 'AIRWAY', 'Should return AIRWAY');
        assert.isNull(engine.getTokenType('UNKNOWN'), 'Should return null for unknown');
    });

    it('should provide convenience methods', () => {
        if (!engine) return;

        // Set up indexes
        const airportIndex = new window.MapIndex();
        airportIndex.build(new Map([['KSFO', { name: 'SFO' }]]));

        const navaidIndex = new window.MapIndex();
        navaidIndex.build(new Map([['SFO', { name: 'SFO VOR' }]]));

        const fixIndex = new window.MapIndex();
        fixIndex.build(new Map([['PAYGE', { name: 'PAYGE' }]]));

        const airwayIndex = new window.MapIndex();
        airwayIndex.build(new Map([['V25', { name: 'V25' }]]));

        engine
            .registerIndex('airports', airportIndex)
            .registerIndex('navaids', navaidIndex)
            .registerIndex('fixes', fixIndex)
            .registerIndex('airways', airwayIndex);

        assert.equals(engine.getAirport('KSFO').name, 'SFO', 'getAirport should work');
        assert.equals(engine.getNavaid('SFO').name, 'SFO VOR', 'getNavaid should work');
        assert.equals(engine.getFix('PAYGE').name, 'PAYGE', 'getFix should work');
        assert.equals(engine.getAirway('V25').name, 'V25', 'getAirway should work');
    });

    it('should report stats', () => {
        if (!engine) return;

        const airportIndex = new window.MapIndex();
        airportIndex.build(new Map([['A', 1], ['B', 2]]));

        const navaidIndex = new window.MapIndex();
        navaidIndex.build(new Map([['X', 1]]));

        engine
            .registerIndex('airports', airportIndex)
            .registerIndex('navaids', navaidIndex);

        const stats = engine.getStats();
        assert.equals(stats.airports, 2, 'Should report airports count');
        assert.equals(stats.navaids, 1, 'Should report navaids count');
    });
});
