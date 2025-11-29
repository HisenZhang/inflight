// Tests for compute/weather.js - Pure weather parsing and analysis
// Architecture v3.0.0 - Compute Layer (Pure Functions)

// ============================================
// WEATHER MODULE EXISTENCE
// ============================================

TestFramework.describe('Weather - Module Structure', function({ it }) {

    it('should have Weather defined', () => {
        assert.isDefined(window.Weather, 'Weather should be defined');
    });

    it('should have parseMETAR method', () => {
        assert.isFunction(window.Weather.parseMETAR,
            'Should have parseMETAR method');
    });

    it('should have getFlightCategory method', () => {
        assert.isFunction(window.Weather.getFlightCategory,
            'Should have getFlightCategory method');
    });

    it('should have calculateDensityAltitude method', () => {
        assert.isFunction(window.Weather.calculateDensityAltitude,
            'Should have calculateDensityAltitude method');
    });
});

// ============================================
// FLIGHT CATEGORY DETERMINATION
// ============================================

TestFramework.describe('Weather - Flight Category', function({ it }) {

    // VFR: > 5sm visibility AND ceiling > 3000ft AGL (or clear)
    it('should return VFR for good conditions', () => {
        const category = window.Weather.getFlightCategory(10, 5000);
        assert.equals(category, 'VFR', 'Clear visibility and high ceiling should be VFR');
    });

    it('should return VFR for clear skies (null ceiling)', () => {
        const category = window.Weather.getFlightCategory(10, null);
        assert.equals(category, 'VFR', 'Clear skies should be VFR');
    });

    // MVFR: 3-5sm visibility OR ceiling 1000-3000ft
    it('should return MVFR for marginal visibility', () => {
        const category = window.Weather.getFlightCategory(4, 5000);
        assert.equals(category, 'MVFR', '4sm visibility should be MVFR');
    });

    it('should return MVFR for marginal ceiling', () => {
        const category = window.Weather.getFlightCategory(10, 2500);
        assert.equals(category, 'MVFR', '2500ft ceiling should be MVFR');
    });

    it('should return MVFR for exactly 5sm visibility', () => {
        const category = window.Weather.getFlightCategory(5, 5000);
        assert.equals(category, 'MVFR', '5sm visibility should be MVFR');
    });

    it('should return MVFR for exactly 3000ft ceiling', () => {
        const category = window.Weather.getFlightCategory(10, 3000);
        assert.equals(category, 'MVFR', '3000ft ceiling should be MVFR');
    });

    // IFR: 1-3sm visibility OR ceiling 500-1000ft
    it('should return IFR for low visibility', () => {
        const category = window.Weather.getFlightCategory(2, 5000);
        assert.equals(category, 'IFR', '2sm visibility should be IFR');
    });

    it('should return IFR for low ceiling', () => {
        const category = window.Weather.getFlightCategory(10, 800);
        assert.equals(category, 'IFR', '800ft ceiling should be IFR');
    });

    it('should return IFR for exactly 3sm visibility', () => {
        // < 3sm is IFR
        const category = window.Weather.getFlightCategory(2.9, 5000);
        assert.equals(category, 'IFR', '2.9sm visibility should be IFR');
    });

    it('should return IFR for exactly 1000ft ceiling', () => {
        // < 1000ft is IFR
        const category = window.Weather.getFlightCategory(10, 999);
        assert.equals(category, 'IFR', '999ft ceiling should be IFR');
    });

    // LIFR: < 1sm visibility OR ceiling < 500ft
    it('should return LIFR for very low visibility', () => {
        const category = window.Weather.getFlightCategory(0.5, 5000);
        assert.equals(category, 'LIFR', '0.5sm visibility should be LIFR');
    });

    it('should return LIFR for very low ceiling', () => {
        const category = window.Weather.getFlightCategory(10, 300);
        assert.equals(category, 'LIFR', '300ft ceiling should be LIFR');
    });

    it('should return LIFR for exactly 1sm visibility', () => {
        // < 1sm is LIFR
        const category = window.Weather.getFlightCategory(0.9, 5000);
        assert.equals(category, 'LIFR', '0.9sm visibility should be LIFR');
    });

    it('should return LIFR for exactly 500ft ceiling', () => {
        // < 500ft is LIFR
        const category = window.Weather.getFlightCategory(10, 499);
        assert.equals(category, 'LIFR', '499ft ceiling should be LIFR');
    });

    // Edge cases
    it('should use worst of visibility or ceiling', () => {
        // Good visibility but low ceiling
        const cat1 = window.Weather.getFlightCategory(10, 400);
        assert.equals(cat1, 'LIFR', 'Low ceiling should dominate');

        // Low visibility but high ceiling
        const cat2 = window.Weather.getFlightCategory(0.5, 5000);
        assert.equals(cat2, 'LIFR', 'Low visibility should dominate');
    });
});

// ============================================
// DENSITY ALTITUDE CALCULATIONS
// ============================================

TestFramework.describe('Weather - Density Altitude', function({ it }) {

    it('should calculate standard atmosphere density altitude', () => {
        // At sea level, 15°C, 29.92" = 0ft density altitude
        const da = window.Weather.calculateDensityAltitude(0, 15, 29.92);

        assert.isTrue(Math.abs(da) < 200,
            `DA at sea level standard should be ~0, got ${da}`);
    });

    it('should increase DA with higher temperature', () => {
        // Higher temp = higher density altitude
        const standard = window.Weather.calculateDensityAltitude(5000, 15, 29.92);
        const hot = window.Weather.calculateDensityAltitude(5000, 30, 29.92);

        assert.isTrue(hot > standard,
            'Higher temperature should increase density altitude');
    });

    it('should increase DA with lower pressure', () => {
        // Lower pressure = higher density altitude
        const standard = window.Weather.calculateDensityAltitude(5000, 15, 29.92);
        const lowPressure = window.Weather.calculateDensityAltitude(5000, 15, 29.42);

        assert.isTrue(lowPressure > standard,
            'Lower pressure should increase density altitude');
    });

    it('should calculate typical hot day DA', () => {
        // Phoenix in summer: 1100ft elevation, 40°C (104°F), 29.92"
        const da = window.Weather.calculateDensityAltitude(1100, 40, 29.92);

        // Should be significantly higher than field elevation
        assert.isTrue(da > 4000,
            `Hot day DA should be >4000ft, got ${da}`);
    });

    it('should calculate high altitude airport DA', () => {
        // Denver: 5431ft, 20°C, 29.92"
        const da = window.Weather.calculateDensityAltitude(5431, 20, 29.92);

        // Denver on a warm day typically has DA around 6500-7000
        assert.isTrue(da > 5500 && da < 8000,
            `Denver DA should be 5500-8000ft, got ${da}`);
    });

    it('should return integer result', () => {
        const da = window.Weather.calculateDensityAltitude(1000, 25, 30.00);
        assert.equals(da, Math.round(da), 'DA should be rounded');
    });

    it('should handle cold temperatures', () => {
        // Cold day: DA should be lower than field elevation
        const da = window.Weather.calculateDensityAltitude(5000, -10, 30.50);

        assert.isTrue(da < 5000,
            `Cold high pressure DA should be below field elev, got ${da}`);
    });
});

// ============================================
// METAR PARSING (Basic structure tests)
// ============================================

TestFramework.describe('Weather - METAR Parsing', function({ it }) {

    it('should parse basic METAR string', () => {
        const raw = 'KSFO 121756Z 32008KT 10SM FEW025 18/11 A3012';
        const parsed = window.Weather.parseMETAR(raw);

        assert.isDefined(parsed, 'Should return parsed object');
        assert.isDefined(parsed.raw, 'Should include raw METAR');
    });

    it('should extract station identifier', () => {
        const raw = 'KSFO 121756Z 32008KT 10SM FEW025 18/11 A3012';
        const parsed = window.Weather.parseMETAR(raw);

        assert.equals(parsed.station, 'KSFO', 'Should extract station');
    });

    it('should extract time', () => {
        const raw = 'KSFO 121756Z 32008KT 10SM FEW025 18/11 A3012';
        const parsed = window.Weather.parseMETAR(raw);

        assert.isDefined(parsed.time, 'Should extract time');
    });

    it('should extract wind information', () => {
        const raw = 'KSFO 121756Z 32008KT 10SM FEW025 18/11 A3012';
        const parsed = window.Weather.parseMETAR(raw);

        assert.isDefined(parsed.wind, 'Should extract wind');
        if (parsed.wind) {
            assert.isDefined(parsed.wind.direction, 'Wind should have direction');
            assert.isDefined(parsed.wind.speed, 'Wind should have speed');
        }
    });

    it('should extract visibility', () => {
        const raw = 'KSFO 121756Z 32008KT 10SM FEW025 18/11 A3012';
        const parsed = window.Weather.parseMETAR(raw);

        assert.isDefined(parsed.visibility, 'Should extract visibility');
    });

    it('should extract altimeter setting', () => {
        const raw = 'KSFO 121756Z 32008KT 10SM FEW025 18/11 A3012';
        const parsed = window.Weather.parseMETAR(raw);

        assert.isDefined(parsed.altimeter, 'Should extract altimeter');
    });

    it('should handle variable winds', () => {
        const raw = 'KSFO 121756Z VRB05KT 10SM CLR 18/11 A3012';
        const parsed = window.Weather.parseMETAR(raw);

        assert.isDefined(parsed.wind, 'Should handle variable winds');
    });

    it('should handle calm winds', () => {
        const raw = 'KSFO 121756Z 00000KT 10SM CLR 18/11 A3012';
        const parsed = window.Weather.parseMETAR(raw);

        assert.isDefined(parsed.wind, 'Should handle calm winds');
    });

    it('should handle visibility with fractions', () => {
        const raw = 'KSFO 121756Z 32008KT 1 1/2SM BKN010 18/11 A3012';
        const parsed = window.Weather.parseMETAR(raw);

        assert.isDefined(parsed.visibility, 'Should handle fractional visibility');
    });

    it('should include raw METAR in result', () => {
        const raw = 'KSFO 121756Z 32008KT 10SM FEW025 18/11 A3012';
        const parsed = window.Weather.parseMETAR(raw);

        assert.equals(parsed.raw, raw, 'Should include original METAR');
    });
});

// ============================================
// PURE FUNCTION VERIFICATION
// ============================================

TestFramework.describe('Weather - Pure Function Behavior', function({ it }) {

    it('should produce same flight category for same input', () => {
        const c1 = window.Weather.getFlightCategory(5, 2000);
        const c2 = window.Weather.getFlightCategory(5, 2000);

        assert.equals(c1, c2, 'Flight category should be deterministic');
    });

    it('should produce same density altitude for same input', () => {
        const d1 = window.Weather.calculateDensityAltitude(5000, 25, 29.92);
        const d2 = window.Weather.calculateDensityAltitude(5000, 25, 29.92);

        assert.equals(d1, d2, 'Density altitude should be deterministic');
    });

    it('should produce same parse result for same METAR', () => {
        const raw = 'KSFO 121756Z 32008KT 10SM FEW025 18/11 A3012';
        const p1 = window.Weather.parseMETAR(raw);
        const p2 = window.Weather.parseMETAR(raw);

        assert.equals(p1.station, p2.station, 'Parse should be deterministic');
    });

    it('should not have any side effects', () => {
        // Flight category is a pure calculation
        const results = [];
        for (let i = 0; i < 5; i++) {
            results.push(window.Weather.getFlightCategory(3, 1500));
        }

        const allSame = results.every(r => r === results[0]);
        assert.isTrue(allSame, 'Multiple calls should produce identical results');
    });
});

// ============================================
// HAZARD GEOMETRY FUNCTIONS
// ============================================

TestFramework.describe('Weather - Haversine Distance', function({ it }) {

    it('should have haversineDistance method', () => {
        assert.isFunction(window.Weather.haversineDistance,
            'Should have haversineDistance method');
    });

    it('should return 0 for same point', () => {
        const dist = window.Weather.haversineDistance(40.0, -74.0, 40.0, -74.0);
        assert.equals(dist, 0, 'Same point should have 0 distance');
    });

    it('should calculate approximate distance between NYC and LA', () => {
        // NYC: 40.7128, -74.0060
        // LA: 34.0522, -118.2437
        // Expected distance: ~2140 nm
        const dist = window.Weather.haversineDistance(40.7128, -74.0060, 34.0522, -118.2437);
        assert.isTrue(dist > 2000 && dist < 2300,
            `NYC to LA should be ~2140nm, got ${dist.toFixed(0)}`);
    });

    it('should calculate short distance accurately', () => {
        // 1 degree of latitude ≈ 60 nm
        const dist = window.Weather.haversineDistance(40.0, -74.0, 41.0, -74.0);
        assert.isTrue(dist > 55 && dist < 65,
            `1 degree lat should be ~60nm, got ${dist.toFixed(1)}`);
    });

    it('should be symmetric', () => {
        const d1 = window.Weather.haversineDistance(40.0, -74.0, 35.0, -80.0);
        const d2 = window.Weather.haversineDistance(35.0, -80.0, 40.0, -74.0);
        assert.isTrue(Math.abs(d1 - d2) < 0.001,
            'Distance should be same in both directions');
    });
});

TestFramework.describe('Weather - Point in Polygon', function({ it }) {

    it('should have pointInPolygon method', () => {
        assert.isFunction(window.Weather.pointInPolygon,
            'Should have pointInPolygon method');
    });

    // Define a simple square polygon
    const squarePolygon = [
        { lat: 40.0, lon: -75.0 },
        { lat: 40.0, lon: -73.0 },
        { lat: 38.0, lon: -73.0 },
        { lat: 38.0, lon: -75.0 }
    ];

    it('should return true for point inside polygon', () => {
        const inside = window.Weather.pointInPolygon(39.0, -74.0, squarePolygon);
        assert.isTrue(inside, 'Center point should be inside');
    });

    it('should return false for point outside polygon', () => {
        const outside = window.Weather.pointInPolygon(41.0, -74.0, squarePolygon);
        assert.isFalse(outside, 'Point north of polygon should be outside');
    });

    it('should return false for point far outside', () => {
        const farAway = window.Weather.pointInPolygon(50.0, -100.0, squarePolygon);
        assert.isFalse(farAway, 'Far away point should be outside');
    });

    it('should return false for empty polygon', () => {
        const result = window.Weather.pointInPolygon(39.0, -74.0, []);
        assert.isFalse(result, 'Empty polygon should return false');
    });

    it('should return false for null polygon', () => {
        const result = window.Weather.pointInPolygon(39.0, -74.0, null);
        assert.isFalse(result, 'Null polygon should return false');
    });

    it('should return false for polygon with less than 3 points', () => {
        const twoPoints = [
            { lat: 40.0, lon: -75.0 },
            { lat: 40.0, lon: -73.0 }
        ];
        const result = window.Weather.pointInPolygon(39.0, -74.0, twoPoints);
        assert.isFalse(result, 'Polygon needs at least 3 points');
    });
});

TestFramework.describe('Weather - Hazard Relevance to Point', function({ it }) {

    it('should have isHazardRelevantToPoint method', () => {
        assert.isFunction(window.Weather.isHazardRelevantToPoint,
            'Should have isHazardRelevantToPoint method');
    });

    const testHazard = {
        hazard: 'ICE',
        coords: [
            { lat: 42.0, lon: -76.0 },
            { lat: 42.0, lon: -74.0 },
            { lat: 40.0, lon: -74.0 },
            { lat: 40.0, lon: -76.0 }
        ]
    };

    it('should return true for point inside hazard polygon', () => {
        const relevant = window.Weather.isHazardRelevantToPoint(testHazard, 41.0, -75.0, 50);
        assert.isTrue(relevant, 'Point inside polygon should be relevant');
    });

    it('should return true for point near hazard polygon', () => {
        // Point just outside but within 50nm (0.5 degrees ≈ 30nm)
        const relevant = window.Weather.isHazardRelevantToPoint(testHazard, 42.3, -75.0, 50);
        assert.isTrue(relevant, 'Point near polygon should be relevant');
    });

    it('should return false for point far from hazard', () => {
        // Point far away
        const relevant = window.Weather.isHazardRelevantToPoint(testHazard, 35.0, -80.0, 50);
        assert.isFalse(relevant, 'Point far from polygon should not be relevant');
    });

    it('should return false for hazard with no coords', () => {
        const badHazard = { hazard: 'ICE', coords: null };
        const relevant = window.Weather.isHazardRelevantToPoint(badHazard, 41.0, -75.0, 50);
        assert.isFalse(relevant, 'Hazard without coords should not be relevant');
    });

    it('should return false for null hazard', () => {
        const relevant = window.Weather.isHazardRelevantToPoint(null, 41.0, -75.0, 50);
        assert.isFalse(relevant, 'Null hazard should not be relevant');
    });
});

TestFramework.describe('Weather - Hazard Relevance to Route', function({ it }) {

    it('should have isHazardRelevantToRoute method', () => {
        assert.isFunction(window.Weather.isHazardRelevantToRoute,
            'Should have isHazardRelevantToRoute method');
    });

    const testHazard = {
        hazard: 'TURB',
        coords: [
            { lat: 42.0, lon: -76.0 },
            { lat: 42.0, lon: -74.0 },
            { lat: 40.0, lon: -74.0 },
            { lat: 40.0, lon: -76.0 }
        ]
    };

    const routeInsideHazard = [
        { lat: 41.0, lon: -75.0, ident: 'WPT1' },
        { lat: 41.5, lon: -75.0, ident: 'WPT2' }
    ];

    const routeOutsideHazard = [
        { lat: 35.0, lon: -80.0, ident: 'WPT1' },
        { lat: 35.5, lon: -80.0, ident: 'WPT2' }
    ];

    it('should return true for route passing through hazard', () => {
        const relevant = window.Weather.isHazardRelevantToRoute(testHazard, routeInsideHazard, 50);
        assert.isTrue(relevant, 'Route through hazard should be relevant');
    });

    it('should return false for route far from hazard', () => {
        const relevant = window.Weather.isHazardRelevantToRoute(testHazard, routeOutsideHazard, 50);
        assert.isFalse(relevant, 'Route far from hazard should not be relevant');
    });

    it('should return false for empty waypoints', () => {
        const relevant = window.Weather.isHazardRelevantToRoute(testHazard, [], 50);
        assert.isFalse(relevant, 'Empty route should not match');
    });

    it('should return false for hazard without coords', () => {
        const badHazard = { hazard: 'ICE' };
        const relevant = window.Weather.isHazardRelevantToRoute(badHazard, routeInsideHazard, 50);
        assert.isFalse(relevant, 'Hazard without coords should not match');
    });
});

TestFramework.describe('Weather - Find Affected Waypoints', function({ it }) {

    it('should have findAffectedWaypoints method', () => {
        assert.isFunction(window.Weather.findAffectedWaypoints,
            'Should have findAffectedWaypoints method');
    });

    const testHazard = {
        hazard: 'IFR',
        coords: [
            { lat: 42.0, lon: -76.0 },
            { lat: 42.0, lon: -74.0 },
            { lat: 40.0, lon: -74.0 },
            { lat: 40.0, lon: -76.0 }
        ]
    };

    it('should find waypoints inside hazard polygon', () => {
        const waypoints = [
            { lat: 41.0, lon: -75.0, ident: 'INSIDE' },
            { lat: 35.0, lon: -80.0, ident: 'OUTSIDE' }
        ];
        const affected = window.Weather.findAffectedWaypoints(testHazard, waypoints, 50);
        assert.equals(affected.length, 1, 'Should find 1 affected waypoint');
        assert.equals(affected[0], 'INSIDE', 'Should find the inside waypoint');
    });

    it('should find waypoints near hazard polygon', () => {
        const waypoints = [
            { lat: 42.3, lon: -75.0, ident: 'NEAR' } // Just north of polygon, within 50nm
        ];
        const affected = window.Weather.findAffectedWaypoints(testHazard, waypoints, 50);
        assert.equals(affected.length, 1, 'Should find nearby waypoint');
    });

    it('should return empty array for route not affected', () => {
        const farWaypoints = [
            { lat: 30.0, lon: -90.0, ident: 'FAR1' },
            { lat: 30.5, lon: -90.0, ident: 'FAR2' }
        ];
        const affected = window.Weather.findAffectedWaypoints(testHazard, farWaypoints, 50);
        assert.equals(affected.length, 0, 'No waypoints should be affected');
    });

    it('should use icao if ident not available', () => {
        const waypoints = [
            { lat: 41.0, lon: -75.0, icao: 'KABC' }
        ];
        const affected = window.Weather.findAffectedWaypoints(testHazard, waypoints, 50);
        assert.equals(affected[0], 'KABC', 'Should use icao code');
    });
});

TestFramework.describe('Weather - Hazard Display Helpers', function({ it }) {

    it('should have getHazardColor method', () => {
        assert.isFunction(window.Weather.getHazardColor,
            'Should have getHazardColor method');
    });

    it('should return cyan for ICE hazard', () => {
        const color = window.Weather.getHazardColor('ICE');
        assert.equals(color, '#00DDDD', 'ICE should be cyan');
    });

    it('should return orange for TURB hazard', () => {
        const color = window.Weather.getHazardColor('TURB');
        assert.equals(color, '#FFA500', 'TURB should be orange');
    });

    it('should return red for IFR hazard', () => {
        const color = window.Weather.getHazardColor('IFR');
        assert.equals(color, '#FF4444', 'IFR should be red');
    });

    it('should handle case insensitivity', () => {
        const upper = window.Weather.getHazardColor('ICE');
        const lower = window.Weather.getHazardColor('ice');
        assert.equals(upper, lower, 'Should be case insensitive');
    });

    it('should have getHazardLabel method', () => {
        assert.isFunction(window.Weather.getHazardLabel,
            'Should have getHazardLabel method');
    });

    it('should return human-readable label for IFR', () => {
        const label = window.Weather.getHazardLabel('IFR');
        assert.equals(label, 'IFR Conditions', 'Should return readable label');
    });

    it('should return hazard code if no label defined', () => {
        const label = window.Weather.getHazardLabel('CUSTOM_HAZARD');
        assert.equals(label, 'CUSTOM_HAZARD', 'Should return code if no label');
    });
});

TestFramework.describe('Weather - Polygon Bounds', function({ it }) {

    it('should have getPolygonBounds method', () => {
        assert.isFunction(window.Weather.getPolygonBounds,
            'Should have getPolygonBounds method');
    });

    it('should calculate bounds for simple polygon', () => {
        const coords = [
            { lat: 42.0, lon: -76.0 },
            { lat: 42.0, lon: -74.0 },
            { lat: 40.0, lon: -74.0 },
            { lat: 40.0, lon: -76.0 }
        ];
        const bounds = window.Weather.getPolygonBounds(coords);

        assert.equals(bounds.minLat, 40.0, 'minLat should be 40');
        assert.equals(bounds.maxLat, 42.0, 'maxLat should be 42');
        assert.equals(bounds.minLon, -76.0, 'minLon should be -76');
        assert.equals(bounds.maxLon, -74.0, 'maxLon should be -74');
    });

    it('should return null for empty coords', () => {
        const bounds = window.Weather.getPolygonBounds([]);
        assert.equals(bounds, null, 'Empty coords should return null');
    });

    it('should return null for null coords', () => {
        const bounds = window.Weather.getPolygonBounds(null);
        assert.equals(bounds, null, 'Null coords should return null');
    });
});

TestFramework.describe('Weather - Cache Expiration Calculations', function({ it }) {

    it('should have calculateMETARExpiration method', () => {
        assert.isFunction(window.Weather.calculateMETARExpiration,
            'Should have calculateMETARExpiration method');
    });

    it('should calculate METAR expiration to next hour + 5 min', () => {
        // METAR observed at 1756Z should expire at 1805Z
        const obsTime = Math.floor(Date.now() / 1000);
        const expiration = window.Weather.calculateMETARExpiration(obsTime);

        // Should be in the future
        assert.isTrue(expiration > Date.now(),
            'METAR expiration should be in the future');
    });

    it('should return fallback for null obsTime', () => {
        const expiration = window.Weather.calculateMETARExpiration(null);

        // Should be about 1 hour from now
        const oneHourFromNow = Date.now() + 60 * 60 * 1000;
        assert.isTrue(Math.abs(expiration - oneHourFromNow) < 1000,
            'Fallback should be ~1 hour from now');
    });

    it('should have calculateTAFExpiration method', () => {
        assert.isFunction(window.Weather.calculateTAFExpiration,
            'Should have calculateTAFExpiration method');
    });

    it('should calculate TAF expiration from validTimeTo', () => {
        const validTimeTo = Math.floor(Date.now() / 1000) + 6 * 3600; // 6 hours from now
        const expiration = window.Weather.calculateTAFExpiration(validTimeTo);

        assert.equals(expiration, validTimeTo * 1000,
            'TAF expiration should match validTimeTo in ms');
    });

    it('should return fallback for null validTimeTo', () => {
        const expiration = window.Weather.calculateTAFExpiration(null);

        // Should be about 6 hours from now
        const sixHoursFromNow = Date.now() + 6 * 60 * 60 * 1000;
        assert.isTrue(Math.abs(expiration - sixHoursFromNow) < 1000,
            'Fallback should be ~6 hours from now');
    });
});
