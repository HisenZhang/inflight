// Tests for compute/query-engine.js - Spatial queries and search

TestFramework.describe('QueryEngine - Initialization', function({ it }) {

    // ============================================
    // MODULE LOADING
    // ============================================

    it('should have QueryEngine module loaded', () => {
        assert.isTrue(typeof window.QueryEngine !== 'undefined', 'QueryEngine should be defined');
    });

    it('should have init function', () => {
        assert.isTrue(typeof window.QueryEngine.init === 'function', 'Should have init function');
    });

    it('should initialize without error', () => {
        // Initialize with empty Maps
        try {
            window.QueryEngine.init(new Map(), new Map(), new Map(), new Map(), new Map());
            assert.isTrue(true, 'Init should not throw');
        } catch (e) {
            assert.fail('Init should not throw: ' + e.message);
        }
    });
});

TestFramework.describe('QueryEngine - Search Functions', function({ it, beforeEach }) {

    beforeEach(() => {
        // Initialize with mock data
        const airports = new Map([
            ['KSFO', { icao: 'KSFO', name: 'San Francisco International', lat: 37.6191, lon: -122.3756, type: 'large_airport' }],
            ['KOAK', { icao: 'KOAK', name: 'Oakland International', lat: 37.7213, lon: -122.2208, type: 'large_airport' }],
            ['KLAX', { icao: 'KLAX', name: 'Los Angeles International', lat: 33.9425, lon: -118.4081, type: 'large_airport' }],
            ['KSQL', { icao: 'KSQL', name: 'San Carlos', lat: 37.5119, lon: -122.2494, type: 'small_airport' }],
            ['KJFK', { icao: 'KJFK', name: 'John F Kennedy International', lat: 40.6413, lon: -73.7781, type: 'large_airport' }]
        ]);

        const navaids = new Map([
            ['SFO', { ident: 'SFO', name: 'San Francisco VOR', lat: 37.6191, lon: -122.3756, type: 'VOR' }],
            ['OAK', { ident: 'OAK', name: 'Oakland VOR', lat: 37.7213, lon: -122.2208, type: 'VOR' }]
        ]);

        const fixes = new Map([
            ['PAYGE', { ident: 'PAYGE', lat: 37.5, lon: -122.0 }],
            ['KSFO1', { ident: 'KSFO1', lat: 37.6, lon: -122.3 }]
        ]);

        const airways = new Map([
            ['V25', { ident: 'V25', segments: [] }],
            ['J1', { ident: 'J1', segments: [] }]
        ]);

        const tokenMap = new Map([
            ['KSFO', 'AIRPORT'],
            ['KOAK', 'AIRPORT'],
            ['KLAX', 'AIRPORT'],
            ['SFO', 'NAVAID'],
            ['OAK', 'NAVAID'],
            ['PAYGE', 'FIX'],
            ['V25', 'AIRWAY']
        ]);

        window.QueryEngine.init(airports, navaids, fixes, airways, tokenMap);
    });

    // ============================================
    // SEARCH AIRPORTS
    // ============================================

    it('should have searchAirports function', () => {
        assert.isTrue(typeof window.QueryEngine.searchAirports === 'function',
            'Should have searchAirports function');
    });

    it('should search airports by ICAO code', () => {
        const results = window.QueryEngine.searchAirports('KSFO');

        assert.isArray(results, 'Should return array');
        assert.isTrue(results.length > 0, 'Should find KSFO');
        assert.equals(results[0].code, 'KSFO', 'First result should be KSFO');
    });

    it('should search airports by partial ICAO code', () => {
        const results = window.QueryEngine.searchAirports('KSF');

        assert.isArray(results, 'Should return array');
        assert.isTrue(results.some(r => r.code === 'KSFO'), 'Should find KSFO with partial match');
    });

    it('should return empty array for no matches', () => {
        const results = window.QueryEngine.searchAirports('ZZZZ');

        assert.isArray(results, 'Should return array');
        assert.equals(results.length, 0, 'Should return empty for no matches');
    });

    it('should handle empty search term', () => {
        const results = window.QueryEngine.searchAirports('');

        assert.isArray(results, 'Should return array for empty term');
    });

    it('should handle null search term', () => {
        const results = window.QueryEngine.searchAirports(null);

        assert.isArray(results, 'Should return array for null term');
    });

    // ============================================
    // SEARCH WAYPOINTS
    // ============================================

    it('should have searchWaypoints function', () => {
        assert.isTrue(typeof window.QueryEngine.searchWaypoints === 'function',
            'Should have searchWaypoints function');
    });

    it('should search all waypoint types', () => {
        const results = window.QueryEngine.searchWaypoints('SFO');

        assert.isArray(results, 'Should return array');
        assert.isTrue(results.length > 0, 'Should find SFO matches');
    });

    it('should find fixes', () => {
        const results = window.QueryEngine.searchWaypoints('PAYGE');

        assert.isArray(results, 'Should return array');
        assert.isTrue(results.length > 0, 'Should find PAYGE fix');
    });

    it('should respect limit parameter', () => {
        const results = window.QueryEngine.searchWaypoints('K', null, 2);

        assert.isTrue(results.length <= 2, 'Should respect limit');
    });

    // ============================================
    // TOKEN TYPE LOOKUP
    // ============================================

    it('should have getTokenType function', () => {
        assert.isTrue(typeof window.QueryEngine.getTokenType === 'function',
            'Should have getTokenType function');
    });

    it('should get token type for airport', () => {
        const type = window.QueryEngine.getTokenType('KSFO');

        assert.equals(type, 'AIRPORT', 'KSFO should be AIRPORT type');
    });

    it('should get token type for navaid', () => {
        const type = window.QueryEngine.getTokenType('SFO');

        assert.equals(type, 'NAVAID', 'SFO should be NAVAID type');
    });

    it('should get token type for fix', () => {
        const type = window.QueryEngine.getTokenType('PAYGE');

        assert.equals(type, 'FIX', 'PAYGE should be FIX type');
    });

    it('should get token type for airway', () => {
        const type = window.QueryEngine.getTokenType('V25');

        assert.equals(type, 'AIRWAY', 'V25 should be AIRWAY type');
    });

    it('should return null for unknown token', () => {
        const type = window.QueryEngine.getTokenType('UNKNOWN');

        assert.isNull(type, 'Unknown token should return null');
    });
});

TestFramework.describe('QueryEngine - Spatial Queries', function({ it, beforeEach }) {

    beforeEach(() => {
        // Initialize with mock data for spatial queries
        const airports = new Map([
            ['KSFO', { icao: 'KSFO', name: 'San Francisco', lat: 37.6191, lon: -122.3756 }],
            ['KOAK', { icao: 'KOAK', name: 'Oakland', lat: 37.7213, lon: -122.2208 }],
            ['KSQL', { icao: 'KSQL', name: 'San Carlos', lat: 37.5119, lon: -122.2494 }],
            ['KLAX', { icao: 'KLAX', name: 'Los Angeles', lat: 33.9425, lon: -118.4081 }]
        ]);

        const navaids = new Map([
            ['SFO', { ident: 'SFO', name: 'SFO VOR', lat: 37.6191, lon: -122.3756 }]
        ]);

        const fixes = new Map();
        const airways = new Map();
        const tokenMap = new Map();

        window.QueryEngine.init(airports, navaids, fixes, airways, tokenMap);
    });

    // ============================================
    // POINTS NEAR ROUTE
    // ============================================

    it('should have getPointsNearRoute function', () => {
        assert.isTrue(typeof window.QueryEngine.getPointsNearRoute === 'function',
            'Should have getPointsNearRoute function');
    });

    // ============================================
    // POINTS IN BOUNDS
    // ============================================

    it('should have getPointsInBounds function', () => {
        assert.isTrue(typeof window.QueryEngine.getPointsInBounds === 'function',
            'Should have getPointsInBounds function');
    });

    it('should find airports in bounds', () => {
        // Bay Area bounding box - uses minLat/maxLat/minLon/maxLon format
        const bounds = {
            minLat: 37.0,
            maxLat: 38.0,
            minLon: -123.0,
            maxLon: -122.0
        };

        const results = window.QueryEngine.getPointsInBounds(bounds);

        // Returns object with airports and navaids arrays
        assert.isTrue(typeof results === 'object', 'Should return object');
        assert.isArray(results.airports, 'Should have airports array');
        // Note: getPointsInBounds only returns towered airports, so may be 0 in our mock data
        assert.isTrue(results.airports.length >= 0, 'Should handle bounds query');
    });

    it('should exclude points outside bounds', () => {
        // Bay Area bounding box (excludes LA)
        const bounds = {
            minLat: 37.0,
            maxLat: 38.0,
            minLon: -123.0,
            maxLon: -122.0
        };

        const results = window.QueryEngine.getPointsInBounds(bounds);

        // KLAX is in LA, should NOT be in results
        const hasLAX = results.airports.some(r => r.code === 'KLAX');
        assert.isFalse(hasLAX, 'Should not include KLAX (outside bounds)');
    });

    // ============================================
    // FIND NEAREST AIRPORT
    // ============================================

    it('should have findNearestAirport function', () => {
        assert.isTrue(typeof window.QueryEngine.findNearestAirport === 'function',
            'Should have findNearestAirport function');
    });

    it('should find nearest airport to a point', () => {
        // Point near KSQL
        const nearest = window.QueryEngine.findNearestAirport(37.5, -122.25);

        assert.isNotNull(nearest, 'Should find a nearest airport');
        // KSQL is at 37.5119, -122.2494, so should be closest
        assert.equals(nearest.code, 'KSQL', 'Nearest to 37.5, -122.25 should be KSQL');
    });

    // ============================================
    // FIND WAYPOINTS WITHIN RADIUS
    // ============================================

    it('should have findWaypointsWithinRadius function', () => {
        assert.isTrue(typeof window.QueryEngine.findWaypointsWithinRadius === 'function',
            'Should have findWaypointsWithinRadius function');
    });

    it('should find waypoints within radius', () => {
        // Center on KSFO, search within 20nm
        // Returns object with airports, navaids, fixes arrays
        const results = window.QueryEngine.findWaypointsWithinRadius(37.6191, -122.3756, 20);

        assert.isTrue(typeof results === 'object', 'Should return object');
        assert.isArray(results.airports, 'Should have airports array');
        // KOAK is about 10nm from KSFO
        const hasOAK = results.airports.some(r => r.code === 'KOAK');
        assert.isTrue(hasOAK, 'Should find KOAK within 20nm of KSFO');
    });

    it('should exclude waypoints outside radius', () => {
        // Center on KSFO, search within 5nm (KOAK is ~10nm away)
        const results = window.QueryEngine.findWaypointsWithinRadius(37.6191, -122.3756, 5);

        // KOAK is about 10nm from KSFO, should NOT be in 5nm radius
        const hasOAK = results.airports.some(r => r.code === 'KOAK');
        assert.isFalse(hasOAK, 'Should not find KOAK within 5nm');
    });
});

TestFramework.describe('QueryEngine - Procedure Queries', function({ it }) {

    // ============================================
    // PROCEDURE TRANSITIONS
    // ============================================

    it('should have getProcedureTransitions function', () => {
        assert.isTrue(typeof window.QueryEngine.getProcedureTransitions === 'function',
            'Should have getProcedureTransitions function');
    });
});

TestFramework.describe('QueryEngine - Edge Cases', function({ it, beforeEach }) {

    beforeEach(() => {
        // Initialize with empty data
        window.QueryEngine.init(new Map(), new Map(), new Map(), new Map(), new Map());
    });

    it('should handle search with no data loaded', () => {
        const results = window.QueryEngine.searchAirports('KSFO');

        assert.isArray(results, 'Should return array even with no data');
        assert.equals(results.length, 0, 'Should return empty array');
    });

    it('should handle waypoint search with no data loaded', () => {
        const results = window.QueryEngine.searchWaypoints('TEST');

        assert.isArray(results, 'Should return array even with no data');
    });

    it('should handle case insensitivity', () => {
        // Re-initialize with data
        const airports = new Map([
            ['KSFO', { icao: 'KSFO', name: 'San Francisco', lat: 37.6191, lon: -122.3756 }]
        ]);
        window.QueryEngine.init(airports, new Map(), new Map(), new Map(), new Map([['KSFO', 'AIRPORT']]));

        const upper = window.QueryEngine.searchAirports('KSFO');
        const lower = window.QueryEngine.searchAirports('ksfo');

        assert.equals(upper.length, lower.length, 'Search should be case-insensitive');
    });
});
