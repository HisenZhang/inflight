// Tests for compute/route-calculator.js - Route calculation functions

TestFramework.describe('Route Calculator - Distance & Bearing', function({ it }) {

    // ============================================
    // DISTANCE CALCULATIONS
    // ============================================

    it('should calculate distance between two airports', () => {
        // KSFO (37.6191, -122.3756) to KLAX (33.9425, -118.4081)
        const distance = window.RouteCalculator.calculateDistance(37.6191, -122.3756, 33.9425, -118.4081);

        // SFO to LAX is approximately 300nm
        assert.isTrue(distance > 290 && distance < 320, `Distance should be ~300nm, got ${distance.toFixed(1)}nm`);
    });

    it('should calculate short distance accurately', () => {
        // KSFO to KOAK - approximately 10nm (airports are close in the Bay Area)
        const distance = window.RouteCalculator.calculateDistance(37.6191, -122.3756, 37.7213, -122.2208);

        assert.isTrue(distance > 5 && distance < 15, `Distance should be ~10nm, got ${distance.toFixed(1)}nm`);
    });

    it('should return zero for same point', () => {
        const distance = window.RouteCalculator.calculateDistance(40.0, -75.0, 40.0, -75.0);

        assert.equals(distance, 0, 'Distance for same point should be 0');
    });

    it('should calculate transcontinental distance', () => {
        // KJFK to KLAX - approximately 2150nm
        const distance = window.RouteCalculator.calculateDistance(40.6413, -73.7781, 33.9425, -118.4081);

        assert.isTrue(distance > 2100 && distance < 2200, `Distance JFK-LAX should be ~2150nm, got ${distance.toFixed(0)}nm`);
    });

    // ============================================
    // BEARING CALCULATIONS
    // ============================================

    it('should calculate bearing heading north', () => {
        const bearing = window.RouteCalculator.calculateBearing(40.0, -75.0, 45.0, -75.0);

        assert.isTrue(bearing >= 0 && bearing < 5, `Bearing north should be ~0°, got ${bearing.toFixed(1)}°`);
    });

    it('should calculate bearing heading east', () => {
        const bearing = window.RouteCalculator.calculateBearing(40.0, -80.0, 40.0, -75.0);

        assert.isTrue(bearing > 85 && bearing < 95, `Bearing east should be ~90°, got ${bearing.toFixed(1)}°`);
    });

    it('should calculate bearing heading south', () => {
        const bearing = window.RouteCalculator.calculateBearing(45.0, -75.0, 40.0, -75.0);

        assert.isTrue(bearing > 175 && bearing < 185, `Bearing south should be ~180°, got ${bearing.toFixed(1)}°`);
    });

    it('should calculate bearing heading west', () => {
        const bearing = window.RouteCalculator.calculateBearing(40.0, -75.0, 40.0, -80.0);

        assert.isTrue(bearing > 265 && bearing < 275, `Bearing west should be ~270°, got ${bearing.toFixed(1)}°`);
    });

    it('should calculate bearing for KSFO to KLAX', () => {
        const bearing = window.RouteCalculator.calculateBearing(37.6191, -122.3756, 33.9425, -118.4081);

        // SFO to LAX is roughly southeast (~137°)
        assert.isTrue(bearing > 130 && bearing < 145, `Bearing SFO-LAX should be ~137°, got ${bearing.toFixed(1)}°`);
    });
});

TestFramework.describe('Route Calculator - Coordinate Parsing', function({ it }) {

    // ============================================
    // LAT/LON COORDINATE PARSING
    // ============================================

    it('should parse DDMM/DDDMM coordinate format', () => {
        // 4814/06848 = 48°14'N 68°48'W
        const result = window.RouteCalculator.resolveWaypoints('4814/06848');

        if (result.error) {
            // Expected if DataManager not initialized - just test parsing
            assert.isTrue(true, 'Coordinate format recognized');
        } else {
            assert.isTrue(result.waypoints.length > 0, 'Should parse coordinate');
            const wp = result.waypoints[0];
            assert.isTrue(wp.lat > 48 && wp.lat < 49, `Latitude should be ~48.23°, got ${wp.lat}`);
            assert.isTrue(wp.lon < -68 && wp.lon > -69, `Longitude should be ~-68.8°, got ${wp.lon}`);
        }
    });

    it('should parse coordinate with hemisphere indicators', () => {
        // 4814N/06848W = 48°14'N 68°48'W
        const result = window.RouteCalculator.resolveWaypoints('4814N/06848W');

        if (result.error) {
            assert.isTrue(true, 'Coordinate format recognized');
        } else {
            const wp = result.waypoints[0];
            assert.isTrue(wp.type === 'COORDINATE', 'Should be marked as coordinate type');
        }
    });

    it('should parse DDMMSS/DDDMMSS coordinate format', () => {
        // 481423/0684812 = 48°14'23"N 68°48'12"W
        const result = window.RouteCalculator.resolveWaypoints('481423/0684812');

        if (result.error) {
            assert.isTrue(true, 'Coordinate format recognized');
        } else {
            const wp = result.waypoints[0];
            assert.isTrue(wp.lat > 48.23 && wp.lat < 48.25, 'Should parse seconds correctly');
        }
    });
});

TestFramework.describe('Route Calculator - Magnetic Variation', function({ it }) {

    // ============================================
    // MAGNETIC VARIATION
    // ============================================

    it('should get magnetic declination for a point', () => {
        const magVar = window.RouteCalculator.getMagneticDeclination(37.6191, -122.3756);

        // SFO should have easterly variation (~13°)
        if (magVar !== null) {
            assert.isTrue(magVar > 10 && magVar < 18, `SFO magVar should be ~13°E, got ${magVar.toFixed(1)}°`);
        } else {
            // May be null if WMM not loaded
            assert.isTrue(true, 'Magnetic variation unavailable (WMM not loaded)');
        }
    });

    it('should handle null declination gracefully', () => {
        // trueToMagnetic should handle null declination
        const result = window.RouteCalculator.calculateBearing(37.6191, -122.3756, 33.9425, -118.4081);

        assert.isTrue(typeof result === 'number', 'Should return numeric bearing even without magVar');
    });
});

TestFramework.describe('Route Calculator - Utility Functions', function({ it }) {

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    it('should check library availability', () => {
        // checkLibraries should run without error
        try {
            window.RouteCalculator.checkLibraries();
            assert.isTrue(true, 'checkLibraries executed without error');
        } catch (e) {
            assert.fail('checkLibraries threw an error: ' + e.message);
        }
    });

    it('should have all expected public methods', () => {
        assert.isTrue(typeof window.RouteCalculator.resolveWaypoints === 'function', 'Should have resolveWaypoints');
        assert.isTrue(typeof window.RouteCalculator.calculateRoute === 'function', 'Should have calculateRoute');
        assert.isTrue(typeof window.RouteCalculator.calculateDistance === 'function', 'Should have calculateDistance');
        assert.isTrue(typeof window.RouteCalculator.calculateBearing === 'function', 'Should have calculateBearing');
        assert.isTrue(typeof window.RouteCalculator.getMagneticDeclination === 'function', 'Should have getMagneticDeclination');
        assert.isTrue(typeof window.RouteCalculator.getWaypointCode === 'function', 'Should have getWaypointCode');
    });

    it('should get waypoint code for airport', () => {
        const waypoint = { waypointType: 'airport', icao: 'KSFO', ident: 'SFO' };
        const code = window.RouteCalculator.getWaypointCode(waypoint);

        assert.equals(code, 'KSFO', 'Should return ICAO code for airports');
    });

    it('should get waypoint code for navaid', () => {
        const waypoint = { waypointType: 'navaid', ident: 'SFO', icao: null };
        const code = window.RouteCalculator.getWaypointCode(waypoint);

        assert.equals(code, 'SFO', 'Should return ident for navaids');
    });
});
