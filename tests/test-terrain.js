// Tests for compute/terrain.js - Pure terrain analysis calculations
// Architecture v3.0.0 - Compute Layer (Pure Functions)

// ============================================
// TERRAIN MODULE EXISTENCE
// ============================================

TestFramework.describe('Terrain - Module Structure', function({ it }) {

    it('should have Terrain defined', () => {
        assert.isDefined(window.Terrain, 'Terrain should be defined');
    });

    it('should have analyzeProfile method', () => {
        assert.isFunction(window.Terrain.analyzeProfile,
            'Should have analyzeProfile method');
    });

    it('should have checkClearance method', () => {
        assert.isFunction(window.Terrain.checkClearance,
            'Should have checkClearance method');
    });

    it('should have clearance constants', () => {
        assert.isDefined(window.Terrain.STANDARD_CLEARANCE_FT,
            'Should have STANDARD_CLEARANCE_FT');
        assert.isDefined(window.Terrain.MOUNTAINOUS_CLEARANCE_FT,
            'Should have MOUNTAINOUS_CLEARANCE_FT');
        assert.isDefined(window.Terrain.MOUNTAINOUS_THRESHOLD_FT,
            'Should have MOUNTAINOUS_THRESHOLD_FT');
    });

    it('should have correct clearance values', () => {
        assert.equals(window.Terrain.STANDARD_CLEARANCE_FT, 1000,
            'Standard clearance should be 1000ft');
        assert.equals(window.Terrain.MOUNTAINOUS_CLEARANCE_FT, 2000,
            'Mountainous clearance should be 2000ft');
        assert.equals(window.Terrain.MOUNTAINOUS_THRESHOLD_FT, 5000,
            'Mountainous threshold should be 5000ft');
    });
});

// ============================================
// TERRAIN PROFILE ANALYSIS
// ============================================

TestFramework.describe('Terrain - Profile Analysis', function({ it }) {

    it('should analyze simple route profile', () => {
        const waypoints = [
            { lat: 37.0, lon: -122.0 },
            { lat: 38.0, lon: -121.0 }
        ];

        const moraData = new Map([
            ['37,-122', { lat: 37, lon: -122, mora: 3500 }],
            ['37,-121', { lat: 37, lon: -121, mora: 4000 }],
            ['38,-122', { lat: 38, lon: -122, mora: 3000 }],
            ['38,-121', { lat: 38, lon: -121, mora: 3500 }]
        ]);

        const analysis = window.Terrain.analyzeProfile(waypoints, moraData);

        assert.isDefined(analysis.maxMORA, 'Should have maxMORA');
        assert.isDefined(analysis.minMORA, 'Should have minMORA');
        assert.isDefined(analysis.avgMORA, 'Should have avgMORA');
        assert.isDefined(analysis.maxTerrain, 'Should have maxTerrain');
        assert.isDefined(analysis.isMountainous, 'Should have isMountainous');
        assert.isDefined(analysis.requiredClearance, 'Should have requiredClearance');
    });

    it('should find max MORA along route', () => {
        const waypoints = [
            { lat: 37.5, lon: -122.5 },
            { lat: 37.5, lon: -121.5 }
        ];

        const moraData = new Map([
            ['37,-123', { lat: 37, lon: -123, mora: 3000 }],
            ['37,-122', { lat: 37, lon: -122, mora: 6500 }],  // Highest
            ['37,-121', { lat: 37, lon: -121, mora: 4000 }]
        ]);

        const analysis = window.Terrain.analyzeProfile(waypoints, moraData);

        assert.equals(analysis.maxMORA, 6500, 'Should find highest MORA');
    });

    it('should find min MORA along route', () => {
        const waypoints = [
            { lat: 37.5, lon: -122.5 },
            { lat: 37.5, lon: -121.5 }
        ];

        const moraData = new Map([
            ['37,-123', { lat: 37, lon: -123, mora: 3000 }],
            ['37,-122', { lat: 37, lon: -122, mora: 1500 }],  // Lowest
            ['37,-121', { lat: 37, lon: -121, mora: 4000 }]
        ]);

        const analysis = window.Terrain.analyzeProfile(waypoints, moraData);

        assert.equals(analysis.minMORA, 1500, 'Should find lowest MORA');
    });

    it('should detect mountainous terrain', () => {
        const waypoints = [
            { lat: 37.5, lon: -122.5 },
            { lat: 37.5, lon: -121.5 }
        ];

        const moraData = new Map([
            ['37,-122', { lat: 37, lon: -122, mora: 8500 }]  // High terrain
        ]);

        const analysis = window.Terrain.analyzeProfile(waypoints, moraData);

        assert.isTrue(analysis.isMountainous, 'Should detect mountainous terrain');
        assert.equals(analysis.requiredClearance, 2000,
            'Should require 2000ft clearance in mountains');
    });

    it('should detect non-mountainous terrain', () => {
        const waypoints = [
            { lat: 37.5, lon: -122.5 },
            { lat: 37.5, lon: -121.5 }
        ];

        const moraData = new Map([
            ['37,-122', { lat: 37, lon: -122, mora: 3000 }]  // Low terrain
        ]);

        const analysis = window.Terrain.analyzeProfile(waypoints, moraData);

        assert.isFalse(analysis.isMountainous, 'Should not be mountainous');
        assert.equals(analysis.requiredClearance, 1000,
            'Should require 1000ft clearance in non-mountainous');
    });

    it('should return error for insufficient waypoints', () => {
        const waypoints = [{ lat: 37, lon: -122 }];
        const moraData = new Map();

        const analysis = window.Terrain.analyzeProfile(waypoints, moraData);

        assert.isDefined(analysis.error, 'Should have error for single waypoint');
    });

    it('should return error for null waypoints', () => {
        const analysis = window.Terrain.analyzeProfile(null, new Map());
        assert.isDefined(analysis.error, 'Should have error for null waypoints');
    });

    it('should return error for null MORA data', () => {
        const waypoints = [
            { lat: 37, lon: -122 },
            { lat: 38, lon: -121 }
        ];

        const analysis = window.Terrain.analyzeProfile(waypoints, null);
        assert.isDefined(analysis.error, 'Should have error for null MORA data');
    });

    it('should return error when no MORA data for route', () => {
        const waypoints = [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 1 }
        ];

        const moraData = new Map([
            ['37,-122', { lat: 37, lon: -122, mora: 3000 }]  // Far from route
        ]);

        const analysis = window.Terrain.analyzeProfile(waypoints, moraData);
        assert.isDefined(analysis.error, 'Should have error when no MORA data covers route');
    });

    it('should include grid cell count', () => {
        const waypoints = [
            { lat: 37.5, lon: -122.5 },
            { lat: 38.5, lon: -121.5 }
        ];

        const moraData = new Map([
            ['37,-123', { lat: 37, lon: -123, mora: 3000 }],
            ['37,-122', { lat: 37, lon: -122, mora: 3500 }],
            ['38,-122', { lat: 38, lon: -122, mora: 4000 }],
            ['38,-121', { lat: 38, lon: -121, mora: 3800 }]
        ]);

        const analysis = window.Terrain.analyzeProfile(waypoints, moraData);

        assert.isDefined(analysis.gridCellCount, 'Should have gridCellCount');
        assert.isTrue(analysis.gridCellCount > 0, 'Should have counted grid cells');
    });
});

// ============================================
// CLEARANCE CHECKING
// ============================================

TestFramework.describe('Terrain - Clearance Checking', function({ it }) {

    it('should return OK for adequate clearance', () => {
        const analysis = {
            maxMORA: 5000,
            maxTerrain: 4000,
            isMountainous: false,
            requiredClearance: 1000
        };

        const result = window.Terrain.checkClearance(6000, analysis);

        assert.equals(result.status, 'OK', 'Should return OK status');
        assert.equals(result.clearance, 2000, 'Should calculate 2000ft clearance');
    });

    it('should return UNSAFE for inadequate clearance', () => {
        const analysis = {
            maxMORA: 8000,
            maxTerrain: 7000,
            isMountainous: true,
            requiredClearance: 2000
        };

        const result = window.Terrain.checkClearance(7500, analysis);

        assert.equals(result.status, 'UNSAFE', 'Should return UNSAFE status');
        assert.isDefined(result.deficit, 'Should have clearance deficit');
        assert.isDefined(result.recommendedAltitude, 'Should have recommended altitude');
    });

    it('should calculate deficit correctly', () => {
        const analysis = {
            maxMORA: 6000,
            maxTerrain: 5000,
            isMountainous: false,
            requiredClearance: 1000
        };

        // Flying at 5500, need 6000 (terrain + 1000), deficit = 500
        const result = window.Terrain.checkClearance(5500, analysis);

        assert.equals(result.status, 'UNSAFE', 'Should be unsafe');
        assert.equals(result.deficit, 500, 'Deficit should be 500ft');
    });

    it('should use mountainous clearance in mountains', () => {
        const analysis = {
            maxMORA: 9000,
            maxTerrain: 7000,
            isMountainous: true,
            requiredClearance: 2000
        };

        // Need 7000 + 2000 = 9000 for adequate clearance
        const result = window.Terrain.checkClearance(8500, analysis);

        assert.equals(result.status, 'UNSAFE', 'Should be unsafe in mountains at 8500');
        assert.equals(result.required, 2000, 'Should require 2000ft clearance');
    });

    it('should return UNKNOWN for error analysis', () => {
        const analysis = { error: 'No MORA data' };
        const result = window.Terrain.checkClearance(10000, analysis);

        assert.equals(result.status, 'UNKNOWN', 'Should return UNKNOWN for error');
        assert.isDefined(result.message, 'Should have error message');
    });

    it('should return UNKNOWN for null analysis', () => {
        const result = window.Terrain.checkClearance(10000, null);

        assert.equals(result.status, 'UNKNOWN', 'Should return UNKNOWN for null');
    });

    it('should include terrain info in result', () => {
        const analysis = {
            maxMORA: 5000,
            maxTerrain: 4000,
            isMountainous: false,
            requiredClearance: 1000
        };

        const result = window.Terrain.checkClearance(6000, analysis);

        assert.equals(result.maxTerrain, 4000, 'Should include maxTerrain');
        assert.equals(result.maxMORA, 5000, 'Should include maxMORA');
    });

    it('should handle exactly adequate clearance as OK', () => {
        const analysis = {
            maxMORA: 5000,
            maxTerrain: 4000,
            isMountainous: false,
            requiredClearance: 1000
        };

        // Exactly 1000ft clearance above terrain
        const result = window.Terrain.checkClearance(5000, analysis);

        assert.equals(result.status, 'OK', 'Exactly adequate clearance should be OK');
    });
});

// ============================================
// PURE FUNCTION VERIFICATION
// ============================================

TestFramework.describe('Terrain - Pure Function Behavior', function({ it }) {

    it('should produce same output for same input', () => {
        const waypoints = [
            { lat: 37.5, lon: -122.5 },
            { lat: 38.5, lon: -121.5 }
        ];

        const moraData = new Map([
            ['37,-122', { lat: 37, lon: -122, mora: 4500 }],
            ['38,-122', { lat: 38, lon: -122, mora: 5000 }]
        ]);

        const a1 = window.Terrain.analyzeProfile(waypoints, moraData);
        const a2 = window.Terrain.analyzeProfile(waypoints, moraData);

        assert.equals(a1.maxMORA, a2.maxMORA, 'maxMORA should be deterministic');
        assert.equals(a1.minMORA, a2.minMORA, 'minMORA should be deterministic');
    });

    it('should not modify input waypoints', () => {
        const waypoints = [
            { lat: 37.5, lon: -122.5 },
            { lat: 38.5, lon: -121.5 }
        ];
        const copy = JSON.stringify(waypoints);

        const moraData = new Map([['37,-122', { lat: 37, lon: -122, mora: 4500 }]]);

        window.Terrain.analyzeProfile(waypoints, moraData);

        assert.equals(JSON.stringify(waypoints), copy, 'Should not modify waypoints');
    });

    it('should not modify input MORA data', () => {
        const waypoints = [
            { lat: 37.5, lon: -122.5 },
            { lat: 38.5, lon: -121.5 }
        ];

        const moraData = new Map([['37,-122', { lat: 37, lon: -122, mora: 4500 }]]);
        const sizeBefore = moraData.size;

        window.Terrain.analyzeProfile(waypoints, moraData);

        assert.equals(moraData.size, sizeBefore, 'Should not modify MORA data');
    });

    it('checkClearance should produce same output for same input', () => {
        const analysis = {
            maxMORA: 5000,
            maxTerrain: 4000,
            isMountainous: false,
            requiredClearance: 1000
        };

        const c1 = window.Terrain.checkClearance(6000, analysis);
        const c2 = window.Terrain.checkClearance(6000, analysis);

        assert.equals(c1.status, c2.status, 'status should be deterministic');
        assert.equals(c1.clearance, c2.clearance, 'clearance should be deterministic');
    });
});
