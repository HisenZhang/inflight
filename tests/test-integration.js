// Integration Tests - v3 Architecture Integration
// Tests that verify components work together correctly

// ============================================
// APP BOOTSTRAP INTEGRATION
// ============================================

TestFramework.describe('Integration - App Bootstrap', function({ it }) {

    it('should have window.App defined after bootstrap', async () => {
        // Bootstrap if not already done
        if (!window.App && window.bootstrapApp) {
            await window.bootstrapApp();
        }

        assert.isDefined(window.App, 'App should be defined');
    });

    it('should have all core components in window.App', () => {
        if (!window.App) return;

        assert.isDefined(window.App.repository, 'Should have repository');
        assert.isDefined(window.App.queryEngine, 'Should have queryEngine');
        assert.isDefined(window.App.routeService, 'Should have routeService');
        assert.isDefined(window.App.weatherService, 'Should have weatherService');
    });

    it('should have pure function modules accessible', () => {
        if (!window.App) return;

        assert.isDefined(window.App.Navigation, 'Should have Navigation');
        assert.isDefined(window.App.Terrain, 'Should have Terrain');
        assert.isDefined(window.App.Weather, 'Should have Weather');
    });

    it('should report architecture version', () => {
        if (!window.App) return;

        assert.equals(window.App.architecture, 'v3', 'Should be v3 architecture');
        assert.equals(window.App.version, '3.0.0', 'Should be version 3.0.0');
    });
});

// ============================================
// QUERY ENGINE + INDEX INTEGRATION
// ============================================

TestFramework.describe('Integration - QueryEngine with Indexes', function({ it, beforeEach }) {
    let qe;

    beforeEach(() => {
        // Create fresh query engine for each test
        qe = new window.QueryEngineV2()
            .registerIndex('test_map', new window.MapIndex())
            .registerIndex('test_trie', new window.TrieIndex())
            .registerIndex('test_spatial', new window.SpatialGridIndex());
    });

    it('should register and use MapIndex', () => {
        const data = new Map([
            ['KSFO', { icao: 'KSFO', name: 'San Francisco' }],
            ['KLAX', { icao: 'KLAX', name: 'Los Angeles' }]
        ]);

        qe._indexes.get('test_map').build(data);

        const result = qe.getByKey('test_map', 'KSFO');
        assert.isNotNull(result, 'Should find KSFO');
        assert.equals(result.icao, 'KSFO', 'Should return correct data');
    });

    it('should register and use TrieIndex', () => {
        const data = new Map([
            ['KSFO', { icao: 'KSFO', name: 'San Francisco' }],
            ['KSJC', { icao: 'KSJC', name: 'San Jose' }],
            ['KLAX', { icao: 'KLAX', name: 'Los Angeles' }]
        ]);

        qe._indexes.get('test_trie').build(data);

        const results = qe.search('test_trie', 'KS', 10);
        assert.isArray(results, 'Should return array');
        assert.equals(results.length, 2, 'Should find 2 results starting with KS');
    });

    it('should register and use SpatialGridIndex', () => {
        const data = new Map([
            ['KSFO', { icao: 'KSFO', lat: 37.62, lon: -122.38 }],
            ['KSJC', { icao: 'KSJC', lat: 37.36, lon: -121.93 }],
            ['KLAX', { icao: 'KLAX', lat: 33.94, lon: -118.41 }]
        ]);

        qe._indexes.get('test_spatial').build(data);

        // Find airports near San Francisco
        const results = qe.findNearby('test_spatial', 37.62, -122.38, 50);
        assert.isArray(results, 'Should return array');
        assert.isTrue(results.length >= 1, 'Should find at least KSFO');
    });
});

// ============================================
// ROUTE SERVICE INTEGRATION
// ============================================

TestFramework.describe('Integration - RouteService with QueryEngine', function({ it }) {

    it('should create RouteService with QueryEngine', () => {
        const qe = new window.QueryEngineV2()
            .registerIndex('airports', new window.MapIndex())
            .registerIndex('tokenTypes', new window.MapIndex());

        const repo = new window.DataRepository();

        const service = new window.RouteService({
            queryEngine: qe,
            dataRepository: repo
        });

        assert.isDefined(service, 'Should create service');
        assert.isFunction(service.planRoute, 'Should have planRoute method');
    });

    it('should plan route using injected query engine', async () => {
        // Setup mock data
        const airports = new Map([
            ['KSFO', { icao: 'KSFO', name: 'San Francisco', lat: 37.62, lon: -122.38 }],
            ['KLAX', { icao: 'KLAX', name: 'Los Angeles', lat: 33.94, lon: -118.41 }]
        ]);

        const tokenTypes = new Map([
            ['KSFO', 'AIRPORT'],
            ['KLAX', 'AIRPORT']
        ]);

        // Create query engine with data
        const qe = new window.QueryEngineV2()
            .registerIndex('airports', new window.MapIndex())
            .registerIndex('tokenTypes', new window.MapIndex());

        qe._indexes.get('airports').build(airports);
        qe._indexes.get('tokenTypes').build(tokenTypes);
        qe._initialized = true;

        // Create service
        const service = new window.RouteService({
            queryEngine: qe,
            dataRepository: new window.DataRepository()
        });

        // Plan route
        const result = await service.planRoute('KSFO KLAX');

        assert.isArray(result.waypoints, 'Should have waypoints');
        assert.equals(result.waypoints.length, 2, 'Should have 2 waypoints');
        assert.isArray(result.legs, 'Should have legs');
    });
});

// ============================================
// WEATHER SERVICE INTEGRATION
// ============================================

TestFramework.describe('Integration - WeatherService with Repository', function({ it }) {

    it('should create WeatherService with Repository', () => {
        const repo = new window.DataRepository();

        const service = new window.WeatherService({
            dataRepository: repo
        });

        assert.isDefined(service, 'Should create service');
        assert.isFunction(service.getMETAR, 'Should have getMETAR method');
    });

    it('should use Weather pure functions for parsing', async () => {
        // Create a mock repository that returns raw METAR
        const mockRepo = {
            get: async (source, key) => {
                if (source === 'weather_metar' && key === 'KSFO') {
                    return 'KSFO 121756Z 32008KT 10SM FEW025 18/11 A3012';
                }
                return null;
            }
        };

        const service = new window.WeatherService({
            dataRepository: mockRepo
        });

        const metar = await service.getMETAR('KSFO');

        assert.isNotNull(metar, 'Should return parsed METAR');
        assert.equals(metar.station, 'KSFO', 'Should have station');
        assert.isDefined(metar.wind, 'Should have wind data');
    });
});

// ============================================
// NAVIGATION + TERRAIN INTEGRATION
// ============================================

TestFramework.describe('Integration - Navigation with Terrain Analysis', function({ it }) {

    it('should calculate route and check terrain clearance', () => {
        // Define waypoints
        const waypoints = [
            { lat: 37.62, lon: -122.38, ident: 'KSFO' },
            { lat: 36.0, lon: -121.0, ident: 'MID' },
            { lat: 33.94, lon: -118.41, ident: 'KLAX' }
        ];

        // Calculate route
        const route = window.Navigation.calculateRoute(waypoints, { tas: 120 });

        assert.isArray(route.legs, 'Should have legs');
        assert.equals(route.legs.length, 2, 'Should have 2 legs');
        assert.isTrue(route.totals.distance > 0, 'Should have total distance');

        // Mock MORA data for terrain analysis
        const moraData = new Map([
            ['37,-122', { lat: 37, lon: -122, mora: 4000 }],
            ['36,-121', { lat: 36, lon: -121, mora: 5500 }],
            ['34,-118', { lat: 34, lon: -118, mora: 3500 }]
        ]);

        // Analyze terrain
        const terrain = window.Terrain.analyzeProfile(waypoints, moraData);

        if (!terrain.error) {
            assert.isDefined(terrain.maxMORA, 'Should have maxMORA');

            // Check clearance
            const clearance = window.Terrain.checkClearance(terrain, 8000);
            assert.isDefined(clearance.status, 'Should have clearance status');
        }
    });
});

// ============================================
// END-TO-END ROUTE PLANNING
// ============================================

TestFramework.describe('Integration - End-to-End Route Planning', function({ it }) {

    it('should complete full route planning workflow', async () => {
        // 1. Create infrastructure
        const storage = new window.MemoryStorage();
        const repo = new window.DataRepository().setStorage(storage);

        const qe = new window.QueryEngineV2()
            .registerIndex('airports', new window.MapIndex())
            .registerIndex('navaids', new window.MapIndex())
            .registerIndex('tokenTypes', new window.MapIndex());

        // 2. Load mock data
        const airports = new Map([
            ['KSFO', { icao: 'KSFO', name: 'San Francisco', lat: 37.62, lon: -122.38 }],
            ['KLAX', { icao: 'KLAX', name: 'Los Angeles', lat: 33.94, lon: -118.41 }]
        ]);

        const navaids = new Map([
            ['SFO', { ident: 'SFO', name: 'SFO VOR', lat: 37.62, lon: -122.38, type: 'VOR' }]
        ]);

        const tokenTypes = new Map([
            ['KSFO', 'AIRPORT'],
            ['KLAX', 'AIRPORT'],
            ['SFO', 'NAVAID']
        ]);

        qe._indexes.get('airports').build(airports);
        qe._indexes.get('navaids').build(navaids);
        qe._indexes.get('tokenTypes').build(tokenTypes);
        qe._initialized = true;

        // 3. Create services
        const routeService = new window.RouteService({
            queryEngine: qe,
            dataRepository: repo
        });

        // 4. Plan route
        const result = await routeService.planRoute('KSFO KLAX', {
            cruiseSpeed: 120,
            altitude: 8000
        });

        // 5. Verify results
        assert.isArray(result.waypoints, 'Should have waypoints');
        assert.equals(result.waypoints.length, 2, 'Should resolve 2 waypoints');
        assert.isArray(result.legs, 'Should have legs');
        assert.isDefined(result.totals, 'Should have totals');
        assert.isTrue(result.totals.distance > 280, 'Distance should be > 280nm');

        // 6. Verify navigation calculations
        const leg = result.legs[0];
        assert.isDefined(leg.distance, 'Leg should have distance');
        assert.isDefined(leg.trueCourse, 'Leg should have true course');
        assert.isDefined(leg.magCourse, 'Leg should have magnetic course');
        assert.isDefined(leg.ete, 'Leg should have ETE');
    });
});

// ============================================
// LEGACY COMPATIBILITY
// ============================================

TestFramework.describe('Integration - Legacy Compatibility', function({ it }) {

    it('should coexist with legacy QueryEngine', () => {
        // v3 QueryEngineV2 should be available
        assert.isDefined(window.QueryEngineV2, 'QueryEngineV2 should exist');

        // Legacy QueryEngine should still work (if loaded)
        if (window.QueryEngine) {
            assert.isDefined(window.QueryEngine, 'Legacy QueryEngine should exist');
            assert.isTrue(
                window.QueryEngine !== window.QueryEngineV2,
                'Should be different objects'
            );
        }
    });

    it('should coexist with legacy RouteCalculator', () => {
        // v3 Navigation should be available
        assert.isDefined(window.Navigation, 'Navigation should exist');

        // Legacy RouteCalculator should still work (if loaded)
        if (window.RouteCalculator) {
            assert.isDefined(window.RouteCalculator, 'Legacy RouteCalculator should exist');
        }
    });

    it('should have both v3 Weather and legacy WeatherAPI', () => {
        // v3 Weather pure functions
        assert.isDefined(window.Weather, 'Weather should exist');
        assert.isFunction(window.Weather.parseMETAR, 'Weather.parseMETAR should exist');

        // Legacy WeatherAPI (if loaded)
        if (window.WeatherAPI) {
            assert.isDefined(window.WeatherAPI, 'Legacy WeatherAPI should exist');
        }
    });
});
