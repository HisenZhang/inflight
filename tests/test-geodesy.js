// Tests for lib/geodesy.js - WGS84 Vincenty calculations and magnetic declination

TestFramework.describe('Geodesy - Vincenty Distance & Bearing', function({ it }) {

    // ============================================
    // VINCENTY DISTANCE CALCULATIONS
    // ============================================

    it('should calculate distance between two points (short distance)', () => {
        // KSFO to KOAK - approximately 10nm (airports are close in the Bay Area)
        const result = window.vincentyInverse(37.6191, -122.3756, 37.7213, -122.2208);
        const distanceNM = result.distance / 1852; // meters to nautical miles

        assert.isTrue(distanceNM > 5 && distanceNM < 15, `Distance should be ~10nm, got ${distanceNM.toFixed(1)}nm`);
    });

    it('should calculate distance between two points (long distance)', () => {
        // KJFK to EGLL - approximately 3000nm
        const result = window.vincentyInverse(40.6413, -73.7781, 51.4700, -0.4543);
        const distanceNM = result.distance / 1852;

        assert.isTrue(distanceNM > 2900 && distanceNM < 3100, `Distance should be ~3000nm, got ${distanceNM.toFixed(0)}nm`);
    });

    it('should return zero distance for coincident points', () => {
        const result = window.vincentyInverse(37.6191, -122.3756, 37.6191, -122.3756);

        assert.equals(result.distance, 0, 'Distance for same point should be 0');
    });

    it('should calculate distance across equator', () => {
        // Points across the equator
        const result = window.vincentyInverse(5.0, -60.0, -5.0, -60.0);
        const distanceNM = result.distance / 1852;

        // ~600nm for 10 degrees of latitude
        assert.isTrue(distanceNM > 590 && distanceNM < 610, `Should be ~600nm across equator, got ${distanceNM.toFixed(0)}nm`);
    });

    it('should calculate distance across the dateline', () => {
        // Tokyo to Honolulu (crosses dateline)
        const result = window.vincentyInverse(35.6762, 139.6503, 21.3069, -157.8583);
        const distanceNM = result.distance / 1852;

        assert.isTrue(distanceNM > 3300 && distanceNM < 3500, `Should be ~3400nm, got ${distanceNM.toFixed(0)}nm`);
    });

    // ============================================
    // VINCENTY BEARING CALCULATIONS
    // ============================================

    it('should calculate initial bearing (due north)', () => {
        const result = window.vincentyInverse(40.0, -75.0, 45.0, -75.0);

        // Should be close to 0 (north)
        assert.isTrue(result.initialBearing >= 0 && result.initialBearing < 2,
            `Initial bearing due north should be ~0°, got ${result.initialBearing.toFixed(1)}°`);
    });

    it('should calculate initial bearing (due east)', () => {
        const result = window.vincentyInverse(40.0, -80.0, 40.0, -75.0);

        // Should be close to 90 (east) - accounting for great circle curvature
        assert.isTrue(result.initialBearing > 85 && result.initialBearing < 95,
            `Initial bearing due east should be ~90°, got ${result.initialBearing.toFixed(1)}°`);
    });

    it('should calculate initial bearing (due south)', () => {
        const result = window.vincentyInverse(45.0, -75.0, 40.0, -75.0);

        // Should be close to 180 (south)
        assert.isTrue(result.initialBearing > 178 && result.initialBearing < 182,
            `Initial bearing due south should be ~180°, got ${result.initialBearing.toFixed(1)}°`);
    });

    it('should calculate initial bearing (due west)', () => {
        const result = window.vincentyInverse(40.0, -75.0, 40.0, -80.0);

        // Should be close to 270 (west)
        assert.isTrue(result.initialBearing > 265 && result.initialBearing < 275,
            `Initial bearing due west should be ~270°, got ${result.initialBearing.toFixed(1)}°`);
    });

    it('should calculate bearing for northeast track', () => {
        // KBOS to CYUL
        const result = window.vincentyInverse(42.3656, -71.0096, 45.4706, -73.7408);

        // Should be roughly northwest (~315°)
        assert.isTrue(result.initialBearing > 300 && result.initialBearing < 340,
            `Bearing BOS-YUL should be ~320°, got ${result.initialBearing.toFixed(1)}°`);
    });
});

TestFramework.describe('Geodesy - Magnetic Declination (WMM2025)', function({ it }) {

    // ============================================
    // MAGNETIC DECLINATION
    // ============================================

    it('should calculate magnetic declination for US East Coast (positive/east)', () => {
        // Boston area - should have westerly (negative) variation
        const declination = window.calculateMagneticDeclination(42.3656, -71.0096);

        // East coast US has westerly variation (negative) around -14 to -15 degrees
        assert.isTrue(declination !== null, 'Declination should not be null');
        assert.isTrue(declination < 0 && declination > -20,
            `Boston declination should be negative (west), got ${declination?.toFixed(1)}°`);
    });

    it('should calculate magnetic declination for US West Coast', () => {
        // San Francisco area
        const declination = window.calculateMagneticDeclination(37.6191, -122.3756);

        // West coast US has easterly variation (positive) around 12-14 degrees
        assert.isTrue(declination !== null, 'Declination should not be null');
        assert.isTrue(declination > 10 && declination < 18,
            `SFO declination should be ~13° E, got ${declination?.toFixed(1)}°`);
    });

    it('should calculate magnetic declination for equatorial region', () => {
        // Singapore area
        const declination = window.calculateMagneticDeclination(1.3521, 103.8198);

        assert.isTrue(declination !== null, 'Declination should not be null');
        // Low latitudes typically have smaller declination
        assert.isTrue(Math.abs(declination) < 10,
            `Singapore declination should be small, got ${declination?.toFixed(1)}°`);
    });

    it('should calculate magnetic declination for high latitude (Alaska)', () => {
        // Anchorage area
        const declination = window.calculateMagneticDeclination(61.2181, -149.9003);

        assert.isTrue(declination !== null, 'Declination should not be null');
        // Alaska has large easterly variation (positive)
        assert.isTrue(declination > 10 && declination < 25,
            `Anchorage declination should be ~15-20° E, got ${declination?.toFixed(1)}°`);
    });

    it('should calculate magnetic declination for Southern Hemisphere', () => {
        // Sydney, Australia
        const declination = window.calculateMagneticDeclination(-33.8688, 151.2093);

        assert.isTrue(declination !== null, 'Declination should not be null');
        // Sydney has easterly variation around 12 degrees
        assert.isTrue(declination > 8 && declination < 16,
            `Sydney declination should be ~12° E, got ${declination?.toFixed(1)}°`);
    });

    it('should calculate magnetic declination at different altitudes', () => {
        // Declination at sea level vs high altitude should be similar
        const declinationSea = window.calculateMagneticDeclination(40.0, -75.0, 0);
        const declinationHigh = window.calculateMagneticDeclination(40.0, -75.0, 10000);

        assert.isTrue(declinationSea !== null, 'Sea level declination should not be null');
        assert.isTrue(declinationHigh !== null, 'High altitude declination should not be null');
        // Should be within 1 degree of each other
        assert.isTrue(Math.abs(declinationSea - declinationHigh) < 1,
            'Declination should be similar at different altitudes');
    });

    // ============================================
    // WMM MODEL VALIDITY
    // ============================================

    it('should check model validity for current year', () => {
        const currentYear = new Date().getFullYear();
        const validity = window.checkModelValidity(currentYear);

        // WMM2025 valid from 2025.0 to 2030.0
        if (currentYear >= 2025 && currentYear <= 2029) {
            assert.isTrue(validity.valid, `Model should be valid for year ${currentYear}`);
        }
    });

    it('should warn about model expiration', () => {
        // 2029.8 is within 6 months of expiration
        const validity = window.checkModelValidity(2029.8);

        assert.isTrue(validity.valid, 'Model should still be valid');
        assert.isTrue(validity.message !== null, 'Should have warning message');
        assert.isTrue(validity.message.includes('expires soon'), 'Warning should mention expiration');
    });

    it('should report invalid for years before model epoch', () => {
        const validity = window.checkModelValidity(2024.0);

        assert.isFalse(validity.valid, 'Model should be invalid before 2025');
    });

    it('should report invalid for years after model validity', () => {
        const validity = window.checkModelValidity(2031.0);

        assert.isFalse(validity.valid, 'Model should be invalid after 2030');
    });
});
