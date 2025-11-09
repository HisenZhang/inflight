// Tests for utils/formatters.js

TestFramework.describe('Utils.formatters', function({ it }) {

    // ============================================
    // COORDINATE FORMATTING
    // ============================================

    it('should format latitude correctly', () => {
        const result = window.Utils.formatCoordinate(37.6191, 'lat');
        assert.isString(result);
        assert.isTrue(result.includes('37°'), 'Should include degrees');
        assert.isTrue(result.includes('N'), 'Should include hemisphere');
    });

    it('should format negative latitude correctly', () => {
        const result = window.Utils.formatCoordinate(-33.9461, 'lat');
        assert.isTrue(result.includes('S'), 'Should include S for negative latitude');
    });

    it('should format longitude correctly', () => {
        const result = window.Utils.formatCoordinate(-122.3756, 'lon');
        assert.isString(result);
        assert.isTrue(result.includes('122°'), 'Should include degrees');
        assert.isTrue(result.includes('W'), 'Should include hemisphere');
    });

    it('should format positive longitude correctly', () => {
        const result = window.Utils.formatCoordinate(151.1772, 'lon');
        assert.isTrue(result.includes('E'), 'Should include E for positive longitude');
    });

    it('should handle null coordinates', () => {
        const result = window.Utils.formatCoordinate(null, 'lat');
        assert.equals(result, 'N/A');
    });

    // ============================================
    // FREQUENCY FORMATTING
    // ============================================

    it('should format VOR frequency correctly', () => {
        const result = window.Utils.formatNavaidFrequency(113.90, 'VOR');
        assert.isTrue(result.includes('MHZ'), 'Should include MHZ for VOR');
        assert.isTrue(result.includes('113.90'), 'Should include frequency value');
    });

    it('should format NDB frequency correctly', () => {
        const result = window.Utils.formatNavaidFrequency(405, 'NDB');
        assert.isTrue(result.includes('KHZ'), 'Should include KHZ for NDB');
        assert.isTrue(result.includes('405'), 'Should include frequency value');
    });

    it('should auto-detect NDB by frequency range', () => {
        const result = window.Utils.formatNavaidFrequency(350);
        assert.isTrue(result.includes('KHZ'), 'Should auto-detect NDB by frequency');
    });

    // ============================================
    // DISTANCE FORMATTING
    // ============================================

    it('should format distance correctly', () => {
        const result = window.Utils.formatDistance(25.3);
        assert.equals(result, '25.3NM');
    });

    it('should format distance with custom decimals', () => {
        const result = window.Utils.formatDistance(25.376, 2);
        assert.equals(result, '25.38NM');
    });

    it('should handle null distance', () => {
        const result = window.Utils.formatDistance(null);
        assert.equals(result, 'N/A');
    });

    // ============================================
    // TIME FORMATTING
    // ============================================

    it('should format duration in minutes only', () => {
        const result = window.Utils.formatDuration(45);
        assert.equals(result, '45M');
    });

    it('should format duration with hours and minutes', () => {
        const result = window.Utils.formatDuration(135);
        assert.equals(result, '2H 15M');
    });

    it('should handle zero duration', () => {
        const result = window.Utils.formatDuration(0);
        assert.equals(result, '0M');
    });

    it('should format time correctly', () => {
        const date = new Date('2024-01-01T14:30:00');
        const result = window.Utils.formatTime(date);
        assert.equals(result, '14:30');
    });

    // ============================================
    // HEADING FORMATTING
    // ============================================

    it('should format heading with padding', () => {
        const result = window.Utils.formatHeading(45, true);
        assert.equals(result, '045°');
    });

    it('should format heading without padding', () => {
        const result = window.Utils.formatHeading(45, false);
        assert.equals(result, '45°');
    });

    it('should normalize heading > 360', () => {
        const result = window.Utils.formatHeading(375, false);
        assert.equals(result, '15°');
    });

    it('should normalize negative heading', () => {
        const result = window.Utils.formatHeading(-10, false);
        assert.equals(result, '350°');
    });

    // ============================================
    // CARDINAL DIRECTION
    // ============================================

    it('should return correct cardinal for North', () => {
        const result = window.Utils.getCardinalDirection(0);
        assert.equals(result, 'N');
    });

    it('should return correct cardinal for Northeast', () => {
        const result = window.Utils.getCardinalDirection(45);
        assert.equals(result, 'NE');
    });

    it('should return correct cardinal for South', () => {
        const result = window.Utils.getCardinalDirection(180);
        assert.equals(result, 'S');
    });

    // ============================================
    // VALIDATION
    // ============================================

    it('should validate correct latitude', () => {
        assert.isTrue(window.Utils.isValidLatitude(37.6191));
    });

    it('should reject latitude > 90', () => {
        assert.isFalse(window.Utils.isValidLatitude(91));
    });

    it('should reject latitude < -90', () => {
        assert.isFalse(window.Utils.isValidLatitude(-91));
    });

    it('should validate correct longitude', () => {
        assert.isTrue(window.Utils.isValidLongitude(-122.3756));
    });

    it('should reject longitude > 180', () => {
        assert.isFalse(window.Utils.isValidLongitude(181));
    });

    it('should reject longitude < -180', () => {
        assert.isFalse(window.Utils.isValidLongitude(-181));
    });

    it('should validate correct coordinate pair', () => {
        assert.isTrue(window.Utils.isValidCoordinate(37.6191, -122.3756));
    });

    it('should reject invalid coordinate pair', () => {
        assert.isFalse(window.Utils.isValidCoordinate(91, -122.3756));
    });
});
