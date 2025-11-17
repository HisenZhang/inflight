// Test Route Expansion and Token Resolution
// Tests the refactored QueryEngine and RouteExpander integration

const { test, assert } = window.TestFramework;

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
    console.log('[TestSetup] Token map contents:', Array.from(mockTokenMap.entries()));

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

// Test QueryEngine initialization
test('QueryEngine.init() should initialize with token map', () => {
    const mockData = setupMockData();

    window.QueryEngine.init(
        mockData.airports,
        mockData.navaids,
        mockData.fixes,
        mockData.tokenMap
    );

    assert.isTrue(true, 'QueryEngine initialized without error');
});

// Test QueryEngine.getTokenType()
test('QueryEngine.getTokenType() should return correct types', () => {
    const mockData = setupMockData();

    window.QueryEngine.init(
        mockData.airports,
        mockData.navaids,
        mockData.fixes,
        mockData.tokenMap
    );

    // Test airport
    const kordType = window.QueryEngine.getTokenType('KORD');
    console.log('[Test] KORD type:', kordType);
    assert.equals(kordType, 'AIRPORT', 'KORD should be AIRPORT');

    // Test navaid
    const mipType = window.QueryEngine.getTokenType('MIP');
    console.log('[Test] MIP type:', mipType);
    assert.equals(mipType, 'NAVAID', 'MIP should be NAVAID');

    // Test fix
    const gerType = window.QueryEngine.getTokenType('GERBS');
    console.log('[Test] GERBS type:', gerType);
    assert.equals(gerType, 'FIX', 'GERBS should be FIX');

    // Test airway
    const airwayType = window.QueryEngine.getTokenType('J146');
    console.log('[Test] J146 type:', airwayType);
    assert.equals(airwayType, 'AIRWAY', 'J146 should be AIRWAY');

    // Test procedure
    const procType = window.QueryEngine.getTokenType('MIP4');
    console.log('[Test] MIP4 type:', procType);
    assert.equals(procType, 'PROCEDURE', 'MIP4 should be PROCEDURE');
});

// Test RouteExpander initialization
test('RouteExpander should initialize with airway and procedure data', () => {
    const mockData = setupMockData();

    window.RouteExpander.setAirwaysData(mockData.airways);
    window.RouteExpander.setStarsData(mockData.stars);
    window.RouteExpander.setDpsData(mockData.dps);

    const stats = window.RouteExpander.getStats();
    console.log('[Test] RouteExpander stats:', stats);

    assert.equals(stats.airways, 1, 'Should have 1 airway');
    assert.equals(stats.stars, 1, 'Should have 1 STAR');
});

// Test airway expansion
test('RouteExpander should expand airway J146', () => {
    const mockData = setupMockData();
    setupMockDataManager(mockData);

    window.QueryEngine.init(
        mockData.airports,
        mockData.navaids,
        mockData.fixes,
        mockData.tokenMap
    );

    window.RouteExpander.setAirwaysData(mockData.airways);
    window.RouteExpander.setStarsData(mockData.stars);
    window.RouteExpander.setDpsData(mockData.dps);

    const result = window.RouteExpander.expandRoute('GERBS J146 MIP');
    console.log('[Test] Expansion result:', result);

    assert.isNull(result.errors, 'Should have no errors');
    assert.isTrue(result.expanded.length > 3, 'Should expand to more than 3 waypoints');
    assert.includes(result.expanded, 'GERBS', 'Should include GERBS');
    assert.includes(result.expanded, 'MIP', 'Should include MIP');
    assert.includes(result.expanded, 'FIXO1', 'Should include intermediate fix FIXO1');
});

// Test procedure expansion
test('RouteExpander should expand procedure MIP4', () => {
    const mockData = setupMockData();
    setupMockDataManager(mockData);

    window.QueryEngine.init(
        mockData.airports,
        mockData.navaids,
        mockData.fixes,
        mockData.tokenMap
    );

    window.RouteExpander.setAirwaysData(mockData.airways);
    window.RouteExpander.setStarsData(mockData.stars);
    window.RouteExpander.setDpsData(mockData.dps);

    const result = window.RouteExpander.expandRoute('MIP MIP4');
    console.log('[Test] Procedure expansion result:', result);

    assert.isNull(result.errors, 'Should have no errors');
    assert.isTrue(result.expanded.length > 2, 'Should expand to more than 2 waypoints');
});

// Test full route expansion
test('RouteExpander should expand full route with airway and procedure', () => {
    const mockData = setupMockData();
    setupMockDataManager(mockData);

    window.QueryEngine.init(
        mockData.airports,
        mockData.navaids,
        mockData.fixes,
        mockData.tokenMap
    );

    window.RouteExpander.setAirwaysData(mockData.airways);
    window.RouteExpander.setStarsData(mockData.stars);
    window.RouteExpander.setDpsData(mockData.dps);

    const result = window.RouteExpander.expandRoute('KORD MOBLE ADIME GERBS J146 MIP MIP4 KLGA');
    console.log('[Test] Full route expansion:', result);
    console.log('[Test] Expanded string:', result.expandedString);
    console.log('[Test] Errors:', result.errors);

    assert.isNull(result.errors, 'Should have no expansion errors');
    assert.isTrue(result.expanded.length > 8, 'Should expand to more than 8 waypoints');
});

// Test TRANSITION.PROCEDURE format (FAA chart standard)
test('RouteExpander should expand TRANSITION.PROCEDURE format (KAYYS.WYNDE3)', () => {
    const mockData = setupMockData();
    setupMockDataManager(mockData);

    window.QueryEngine.init(
        mockData.airports,
        mockData.navaids,
        mockData.fixes,
        mockData.tokenMap
    );

    window.RouteExpander.setAirwaysData(mockData.airways);
    window.RouteExpander.setStarsData(mockData.stars);
    window.RouteExpander.setDpsData(mockData.dps);

    const result = window.RouteExpander.expandRoute('KORD KAYYS.WYNDE3 KLGA');
    console.log('[Test] TRANSITION.PROCEDURE expansion:', result);
    console.log('[Test] Expanded string:', result.expandedString);
    console.log('[Test] Errors:', result.errors);

    assert.isNull(result.errors, 'Should have no expansion errors');
    assert.includes(result.expanded, 'KAYYS', 'Should include transition fix KAYYS');
    assert.includes(result.expanded, 'WYNDE', 'Should include procedure fix WYNDE');
    assert.includes(result.expanded, 'BAAKE', 'Should include procedure fix BAAKE');
    assert.notIncludes(result.expanded, 'KAYYS.WYNDE3', 'Should not include unexpanded notation');
});

console.log('\n=== Running Route Expansion Tests ===\n');
