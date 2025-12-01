// Test Route Expansion and Token Resolution
// Tests the refactored QueryEngine and RouteExpander integration

// Mock data setup
function setupMockData() {
    // Create mock Maps for airports, navaids, fixes
    const mockAirports = new Map([
        ['KORD', { icao: 'KORD', lat: 41.9786, lon: -87.9048, name: 'Chicago O\'Hare' }],
        ['KLGA', { icao: 'KLGA', lat: 40.7769, lon: -73.8740, name: 'LaGuardia' }]
    ]);

    const mockNavaids = new Map([
        ['MIP', { ident: 'MIP', lat: 40.5, lon: -80.5, type: 'VOR', name: 'Miport' }]
    ]);

    const mockFixes = new Map([
        ['MOBLE', { ident: 'MOBLE', lat: 41.5, lon: -86.5 }],
        ['ADIME', { ident: 'ADIME', lat: 41.0, lon: -85.0 }],
        ['GERBS', { ident: 'GERBS', lat: 40.8, lon: -83.0 }],
        ['KAYYS', { ident: 'KAYYS', lat: 41.2, lon: -87.5 }],
        ['WYNDE', { ident: 'WYNDE', lat: 41.1, lon: -87.3 }],
        ['BAAKE', { ident: 'BAAKE', lat: 40.9, lon: -87.1 }]
    ]);

    const mockAirways = new Map([
        ['J146', {
            id: 'J146',
            fixes: ['GERBS', 'FIXO1', 'FIXO2', 'MIP']
        }]
    ]);

    const mockStars = new Map([
        ['MIP.MIP4', {
            body: { fixes: ['MIP', 'FIXS1', 'FIXS2', 'KLGA'] }
        }],
        ['WYNDE3', {
            body: { fixes: ['WYNDE', 'BAAKE', 'KLGA'] },
            transitions: [
                { name: 'KAYYS', fixes: ['KAYYS', 'WYNDE'] },
                { name: 'MTHEW', fixes: ['MTHEW', 'WYNDE'] }
            ]
        }]
    ]);

    const mockDps = new Map();

    // Build token type map
    const mockTokenMap = new Map();

    // Add airports
    for (const [code] of mockAirports) {
        if (code.length >= 4) {
            mockTokenMap.set(code, 'AIRPORT');
        }
    }

    // Add navaids
    for (const [ident] of mockNavaids) {
        mockTokenMap.set(ident, 'NAVAID');
    }

    // Add fixes
    for (const [ident] of mockFixes) {
        mockTokenMap.set(ident, 'FIX');
    }

    // Add airways
    for (const [id] of mockAirways) {
        mockTokenMap.set(id, 'AIRWAY');
    }

    // Add STARs (both full and short form)
    for (const [id] of mockStars) {
        mockTokenMap.set(id, 'PROCEDURE');
        const match = id.match(/\.([A-Z]{3,}\d+)$/);
        if (match) {
            mockTokenMap.set(match[1], 'PROCEDURE');
        }
    }
    // Also add WYNDE3 base procedure
    mockTokenMap.set('WYNDE3', 'PROCEDURE');

    console.log('[TestSetup] Created mock token map with', mockTokenMap.size, 'entries');

    return {
        airports: mockAirports,
        navaids: mockNavaids,
        fixes: mockFixes,
        airways: mockAirways,
        stars: mockStars,
        dps: mockDps,
        tokenMap: mockTokenMap
    };
}

// Initialize mock DataManager
function setupMockDataManager(mockData) {
    window.DataManager = {
        getAirport: (code) => mockData.airports.get(code),
        getNavaid: (ident) => mockData.navaids.get(ident),
        getFix: (ident) => mockData.fixes.get(ident),
        getAirportByIATA: () => null,
        getFixCoordinates: (ident) => {
            const fix = mockData.fixes.get(ident);
            if (fix) return { lat: fix.lat, lon: fix.lon };
            const navaid = mockData.navaids.get(ident);
            if (navaid) return { lat: navaid.lat, lon: navaid.lon };
            const airport = mockData.airports.get(ident);
            if (airport) return { lat: airport.lat, lon: airport.lon };
            return null;
        }
    };
}

TestFramework.describe('QueryEngine - Token Type Resolution', function({ it }) {
    it('should initialize with token map', () => {
        const mockData = setupMockData();
        window.QueryEngine.init(
            mockData.airports,
            mockData.navaids,
            mockData.fixes,
            mockData.airways,
            mockData.tokenMap
        );
        assert.isTrue(true, 'QueryEngine initialized without error');
    });

    it('should return correct type for KORD (AIRPORT)', () => {
        const mockData = setupMockData();
        window.QueryEngine.init(mockData.airports, mockData.navaids, mockData.fixes, mockData.airways, mockData.tokenMap);
        const type = window.QueryEngine.getTokenType('KORD');
        assert.equals(type, 'AIRPORT', 'KORD should be AIRPORT');
    });

    it('should return correct type for MIP (NAVAID)', () => {
        const mockData = setupMockData();
        window.QueryEngine.init(mockData.airports, mockData.navaids, mockData.fixes, mockData.airways, mockData.tokenMap);
        const type = window.QueryEngine.getTokenType('MIP');
        assert.equals(type, 'NAVAID', 'MIP should be NAVAID');
    });

    it('should return correct type for GERBS (FIX)', () => {
        const mockData = setupMockData();
        window.QueryEngine.init(mockData.airports, mockData.navaids, mockData.fixes, mockData.airways, mockData.tokenMap);
        const type = window.QueryEngine.getTokenType('GERBS');
        assert.equals(type, 'FIX', 'GERBS should be FIX');
    });

    it('should return correct type for J146 (AIRWAY)', () => {
        const mockData = setupMockData();
        window.QueryEngine.init(mockData.airports, mockData.navaids, mockData.fixes, mockData.airways, mockData.tokenMap);
        const type = window.QueryEngine.getTokenType('J146');
        assert.equals(type, 'AIRWAY', 'J146 should be AIRWAY');
    });
});

TestFramework.describe('RouteExpander - Basic Expansion', function({ it }) {
    it('should initialize with airway and procedure data', () => {
        const mockData = setupMockData();
        window.RouteExpander.setAirwaysData(mockData.airways);
        window.RouteExpander.setStarsData(mockData.stars);
        window.RouteExpander.setDpsData(mockData.dps);
        const stats = window.RouteExpander.getStats();
        assert.equals(stats.airways, 1, 'Should have 1 airway');
    });

    it('should expand airway J146', () => {
        const mockData = setupMockData();
        setupMockDataManager(mockData);
        window.QueryEngine.init(mockData.airports, mockData.navaids, mockData.fixes, mockData.airways, mockData.tokenMap);
        window.RouteExpander.setAirwaysData(mockData.airways);
        window.RouteExpander.setStarsData(mockData.stars);
        window.RouteExpander.setDpsData(mockData.dps);

        const result = window.RouteExpander.expandRoute('GERBS J146 MIP');
        console.log('[Test] Expansion result:', result);

        assert.isNull(result.errors, 'Should have no errors');
        assert.isTrue(result.expanded.length > 3, 'Should expand to more than 3 waypoints');
        assert.contains(result.expanded, 'GERBS', 'Should include GERBS');
        assert.contains(result.expanded, 'MIP', 'Should include MIP');
        assert.contains(result.expanded, 'FIXO1', 'Should include intermediate fix FIXO1');
    });

    it('should expand procedure MIP4', () => {
        const mockData = setupMockData();
        setupMockDataManager(mockData);
        window.QueryEngine.init(mockData.airports, mockData.navaids, mockData.fixes, mockData.airways, mockData.tokenMap);
        window.RouteExpander.setAirwaysData(mockData.airways);
        window.RouteExpander.setStarsData(mockData.stars);
        window.RouteExpander.setDpsData(mockData.dps);

        const result = window.RouteExpander.expandRoute('MIP MIP4');
        console.log('[Test] Procedure expansion result:', result);

        assert.isNull(result.errors, 'Should have no errors');
        assert.isTrue(result.expanded.length > 2, 'Should expand to more than 2 waypoints');
    });

    it('should expand full route with airway and procedure', () => {
        const mockData = setupMockData();
        setupMockDataManager(mockData);
        window.QueryEngine.init(mockData.airports, mockData.navaids, mockData.fixes, mockData.airways, mockData.tokenMap);
        window.RouteExpander.setAirwaysData(mockData.airways);
        window.RouteExpander.setStarsData(mockData.stars);
        window.RouteExpander.setDpsData(mockData.dps);

        const result = window.RouteExpander.expandRoute('KORD MOBLE ADIME GERBS J146 MIP MIP4 KLGA');
        console.log('[Test] Full route expansion:', result);

        assert.isNull(result.errors, 'Should have no expansion errors');
        assert.isTrue(result.expanded.length > 8, 'Should expand to more than 8 waypoints');
    });

    it('should expand TRANSITION.PROCEDURE format (KAYYS.WYNDE3)', () => {
        const mockData = setupMockData();
        setupMockDataManager(mockData);
        window.QueryEngine.init(mockData.airports, mockData.navaids, mockData.fixes, mockData.airways, mockData.tokenMap);
        window.RouteExpander.setAirwaysData(mockData.airways);
        window.RouteExpander.setStarsData(mockData.stars);
        window.RouteExpander.setDpsData(mockData.dps);

        const result = window.RouteExpander.expandRoute('KORD KAYYS.WYNDE3 KLGA');
        console.log('[Test] TRANSITION.PROCEDURE expansion:', result);

        assert.isNull(result.errors, 'Should have no expansion errors');
        assert.contains(result.expanded, 'KAYYS', 'Should include transition fix KAYYS');
        assert.contains(result.expanded, 'WYNDE', 'Should include procedure fix WYNDE');
        assert.contains(result.expanded, 'BAAKE', 'Should include procedure fix BAAKE');
        assert.notContains(result.expanded, 'KAYYS.WYNDE3', 'Should not include unexpanded notation');
    });
});

TestFramework.describe('RouteExpander - Airway After Procedure (Q128 Bug Fix)', function({ it }) {
    it('should expand airway when it follows a waypoint (standard pattern)', () => {
        // Test: SYRAH Q128 KD54S - standard pattern where airway is in position i+1
        const mockAirports = new Map([
            ['KSFO', { icao: 'KSFO', lat: 37.62, lon: -122.38, name: 'San Francisco' }]
        ]);
        const mockNavaids = new Map();
        const mockFixes = new Map([
            ['SYRAH', { ident: 'SYRAH', lat: 37.5, lon: -122.0 }],
            ['KD54S', { ident: 'KD54S', lat: 38.0, lon: -120.0 }],
            ['LDORA', { ident: 'LDORA', lat: 39.0, lon: -118.0 }]
        ]);
        const mockAirways = new Map([
            ['Q128', { id: 'Q128', fixes: ['SYRAH', 'KD54S', 'LDORA'] }]
        ]);
        const mockDps = new Map();
        const mockStars = new Map();

        const mockTokenMap = new Map();
        for (const [code] of mockAirports) mockTokenMap.set(code, 'AIRPORT');
        for (const [ident] of mockFixes) mockTokenMap.set(ident, 'FIX');
        for (const [id] of mockAirways) mockTokenMap.set(id, 'AIRWAY');

        window.DataManager = {
            getAirport: (code) => mockAirports.get(code),
            getNavaid: (ident) => mockNavaids.get(ident),
            getFix: (ident) => mockFixes.get(ident),
            getAirportByIATA: () => null,
            getFixCoordinates: (ident) => mockFixes.get(ident)
        };

        window.QueryEngine.init(mockAirports, mockNavaids, mockFixes, mockAirways, mockTokenMap);
        window.RouteExpander.setAirwaysData(mockAirways);
        window.RouteExpander.setStarsData(mockStars);
        window.RouteExpander.setDpsData(mockDps);

        // Standard route: WAYPOINT AIRWAY WAYPOINT
        const result = window.RouteExpander.expandRoute('SYRAH Q128 KD54S');
        console.log('[Test] Standard airway expansion:', result);

        assert.isNull(result.errors, 'Should have no errors');
        assert.contains(result.expanded, 'SYRAH', 'Should include SYRAH');
        assert.contains(result.expanded, 'KD54S', 'Should include KD54S');
        assert.notContains(result.expanded, 'Q128', 'Q128 should be expanded, not kept as token');
    });

    it('should expand airway immediately after DP', () => {
        // Mock data with a DP that ends at a fix, followed by an airway
        const mockAirports = new Map([
            ['KSFO', { icao: 'KSFO', lat: 37.62, lon: -122.38, name: 'San Francisco' }],
            ['KEWR', { icao: 'KEWR', lat: 40.69, lon: -74.17, name: 'Newark' }]
        ]);

        const mockNavaids = new Map();

        const mockFixes = new Map([
            ['SYRAH', { ident: 'SYRAH', lat: 37.5, lon: -122.0 }],
            ['TRUKN', { ident: 'TRUKN', lat: 37.4, lon: -121.5 }],
            ['KD54S', { ident: 'KD54S', lat: 38.0, lon: -120.0 }],
            ['MIDDL', { ident: 'MIDDL', lat: 38.5, lon: -119.0 }],
            ['LDORA', { ident: 'LDORA', lat: 39.0, lon: -118.0 }]
        ]);

        const mockAirways = new Map([
            ['Q128', {
                id: 'Q128',
                fixes: ['SYRAH', 'KD54S', 'MIDDL', 'LDORA']
            }]
        ]);

        // DP: TRUKN2 with SYRAH transition
        const mockDps = new Map([
            ['TRUKN2', {
                name: 'TRUKN2',
                type: 'DP',
                body: { name: 'TRUKN', fixes: ['TRUKN'] },
                transitions: [
                    { name: 'SYRAH', entryFix: 'SYRAH', fixes: ['SYRAH'] }
                ]
            }]
        ]);

        const mockStars = new Map();

        // Build token type map
        const mockTokenMap = new Map();
        for (const [code] of mockAirports) {
            mockTokenMap.set(code, 'AIRPORT');
        }
        for (const [ident] of mockFixes) {
            mockTokenMap.set(ident, 'FIX');
        }
        for (const [id] of mockAirways) {
            mockTokenMap.set(id, 'AIRWAY');
        }
        mockTokenMap.set('TRUKN2', 'PROCEDURE');

        // Setup mocks
        window.DataManager = {
            getAirport: (code) => mockAirports.get(code),
            getNavaid: (ident) => mockNavaids.get(ident),
            getFix: (ident) => mockFixes.get(ident),
            getAirportByIATA: () => null,
            getFixCoordinates: (ident) => {
                const fix = mockFixes.get(ident);
                if (fix) return { lat: fix.lat, lon: fix.lon };
                const airport = mockAirports.get(ident);
                if (airport) return { lat: airport.lat, lon: airport.lon };
                return null;
            }
        };

        window.QueryEngine.init(
            mockAirports,
            mockNavaids,
            mockFixes,
            mockAirways,
            mockTokenMap
        );

        window.RouteExpander.setAirwaysData(mockAirways);
        window.RouteExpander.setStarsData(mockStars);
        window.RouteExpander.setDpsData(mockDps);

        // Test: SYRAH.TRUKN2 expands to [...SYRAH], then Q128 should connect from SYRAH
        // Route: DP with transition, then immediately an airway
        const result = window.RouteExpander.expandRoute('SYRAH.TRUKN2 SYRAH Q128 KD54S LDORA');
        console.log('[Test] DP + Airway expansion:', result);
        console.log('[Test] Expanded:', result.expanded);
        console.log('[Test] Errors:', result.errors);

        // The expanded route should include the airway fixes
        assert.contains(result.expanded, 'SYRAH', 'Should include SYRAH');
        assert.contains(result.expanded, 'KD54S', 'Should include KD54S from airway');
        // Q128 should NOT be in the expanded list (it should be expanded, not kept as token)
        assert.notContains(result.expanded, 'Q128', 'Q128 airway should be expanded, not kept as token');
    });
});

console.log('\n=== Route Expansion Tests Loaded ===\n');
