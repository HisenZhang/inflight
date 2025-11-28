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
