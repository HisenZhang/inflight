/**
 * Weather API Tests
 * Tests for weather data fetching and parsing
 */

window.WeatherAPITests = TestFramework.describe('Weather API', function({ it }) {

    it('should determine VFR flight category', function() {
        const category = WeatherAPI.determineFlightCategory(10, 5000);
        assert.equals(category, 'VFR', 'Visibility 10SM, Ceiling 5000ft should be VFR');
    });

    it('should determine MVFR flight category (low ceiling)', function() {
        const category = WeatherAPI.determineFlightCategory(10, 2000);
        assert.equals(category, 'MVFR', 'Visibility 10SM, Ceiling 2000ft should be MVFR');
    });

    it('should determine MVFR flight category (low visibility)', function() {
        const category = WeatherAPI.determineFlightCategory(4, 5000);
        assert.equals(category, 'MVFR', 'Visibility 4SM, Ceiling 5000ft should be MVFR');
    });

    it('should determine IFR flight category', function() {
        const category = WeatherAPI.determineFlightCategory(2, 800);
        assert.equals(category, 'IFR', 'Visibility 2SM, Ceiling 800ft should be IFR');
    });

    it('should determine LIFR flight category', function() {
        const category = WeatherAPI.determineFlightCategory(0.5, 400);
        assert.equals(category, 'LIFR', 'Visibility 0.5SM, Ceiling 400ft should be LIFR');
    });

    it('should handle CLR ceiling as VFR', function() {
        const category = WeatherAPI.determineFlightCategory(10, 'CLR');
        assert.equals(category, 'VFR', 'Clear skies should be VFR');
    });

    it('should handle unknown values', function() {
        const category = WeatherAPI.determineFlightCategory('UNK', 'UNK');
        assert.equals(category, 'UNK', 'Unknown values should return UNK');
    });

    it('should calculate headwind component', function() {
        // Wind 360° at 10kt, runway 360°
        const components = WeatherAPI.calculateRunwayWindComponents(360, 360, 10);
        assert.equals(components.headwind, 10, 'Direct headwind should be 10kt');
        assert.equals(components.crosswind, 0, 'Crosswind should be 0kt');
    });

    it('should calculate crosswind component', function() {
        // Wind 090° at 10kt, runway 360°
        const components = WeatherAPI.calculateRunwayWindComponents(360, 90, 10);
        assert.equals(components.headwind, 0, 'Headwind should be ~0kt');
        assert.equals(Math.abs(components.crosswind), 10, 'Crosswind should be ~10kt');
    });

    it('should calculate tailwind component (negative headwind)', function() {
        // Wind 180° at 10kt, runway 360°
        const components = WeatherAPI.calculateRunwayWindComponents(360, 180, 10);
        assert.equals(components.headwind, -10, 'Tailwind should be -10kt');
        assert.equals(components.crosswind, 0, 'Crosswind should be 0kt');
    });

    it('should handle calm winds', function() {
        const components = WeatherAPI.calculateRunwayWindComponents(360, 0, 0);
        assert.equals(components.headwind, 0, 'Calm wind headwind should be 0');
        assert.equals(components.crosswind, 0, 'Calm wind crosswind should be 0');
    });

    it('should parse PIREP with icing hazard', function() {
        const pirep = {
            rawOb: 'UA /OV ORD /TM 1630 /FL080 /TP C172 /IC LGT RIME'
        };
        const hazards = WeatherAPI.parsePIREPHazards(pirep);
        assert.equals(hazards.hasIcing, true, 'Should detect icing');
        assert.equals(hazards.severity, 'LIGHT', 'Should detect light severity');
    });

    it('should parse PIREP with turbulence hazard', function() {
        const pirep = {
            rawOb: 'UA /OV ORD /TM 1630 /FL080 /TP C172 /TB MOD'
        };
        const hazards = WeatherAPI.parsePIREPHazards(pirep);
        assert.equals(hazards.hasTurbulence, true, 'Should detect turbulence');
        assert.equals(hazards.severity, 'MODERATE', 'Should detect moderate severity');
    });

    it('should parse PIREP with severe conditions', function() {
        const pirep = {
            rawOb: 'UA /OV ORD /TM 1630 /FL080 /TP C172 /TB SVR'
        };
        const hazards = WeatherAPI.parsePIREPHazards(pirep);
        assert.equals(hazards.hasTurbulence, true, 'Should detect turbulence');
        assert.equals(hazards.severity, 'SEVERE', 'Should detect severe severity');
    });

    it('should parse PIREP with no hazards', function() {
        const pirep = {
            rawOb: 'UA /OV ORD /TM 1630 /FL080 /TP C172 /SK FEW040'
        };
        const hazards = WeatherAPI.parsePIREPHazards(pirep);
        assert.equals(hazards.hasIcing, false, 'Should not detect icing');
        assert.equals(hazards.hasTurbulence, false, 'Should not detect turbulence');
    });

    it('should get flight category from METAR with clear skies', function() {
        const metar = {
            visib: 10,
            clouds: [
                { cover: 'SKC' }
            ]
        };
        const category = WeatherAPI.getFlightCategoryFromMETAR(metar);
        assert.equals(category, 'VFR', 'Clear skies with 10SM visibility should be VFR');
    });

    it('should get flight category from METAR with broken layer', function() {
        const metar = {
            visib: 10,
            clouds: [
                { cover: 'FEW', base: 5000 },
                { cover: 'BKN', base: 2500 }
            ]
        };
        const category = WeatherAPI.getFlightCategoryFromMETAR(metar);
        assert.equals(category, 'MVFR', 'BKN025 should be MVFR');
    });

    it('should get flight category from METAR with overcast layer', function() {
        const metar = {
            visib: 10,
            clouds: [
                { cover: 'OVC', base: 800 }
            ]
        };
        const category = WeatherAPI.getFlightCategoryFromMETAR(metar);
        assert.equals(category, 'IFR', 'OVC008 should be IFR');
    });

    it('should handle METAR with reduced visibility', function() {
        const metar = {
            visib: 2,
            clouds: [
                { cover: 'FEW', base: 5000 }
            ]
        };
        const category = WeatherAPI.getFlightCategoryFromMETAR(metar);
        assert.equals(category, 'IFR', '2SM visibility should be IFR');
    });
});
