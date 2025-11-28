// Tests for data/data-manager.js - Data caching and management

TestFramework.describe('DataManager - Module Loading', function({ it }) {

    // ============================================
    // MODULE EXISTENCE
    // ============================================

    it('should have DataManager module loaded', () => {
        assert.isTrue(typeof window.DataManager !== 'undefined', 'DataManager should be defined');
    });

    // ============================================
    // CONSTANTS
    // ============================================

    it('should export TOKEN_TYPE constants', () => {
        assert.equals(window.DataManager.TOKEN_TYPE_AIRPORT, 'AIRPORT', 'Should have TOKEN_TYPE_AIRPORT');
        assert.equals(window.DataManager.TOKEN_TYPE_NAVAID, 'NAVAID', 'Should have TOKEN_TYPE_NAVAID');
        assert.equals(window.DataManager.TOKEN_TYPE_FIX, 'FIX', 'Should have TOKEN_TYPE_FIX');
        assert.equals(window.DataManager.TOKEN_TYPE_AIRWAY, 'AIRWAY', 'Should have TOKEN_TYPE_AIRWAY');
        assert.equals(window.DataManager.TOKEN_TYPE_PROCEDURE, 'PROCEDURE', 'Should have TOKEN_TYPE_PROCEDURE');
    });

    it('should export WAYPOINT_TYPE constants', () => {
        assert.equals(window.DataManager.WAYPOINT_TYPE_AIRPORT, 'airport', 'Should have WAYPOINT_TYPE_AIRPORT');
        assert.equals(window.DataManager.WAYPOINT_TYPE_NAVAID, 'navaid', 'Should have WAYPOINT_TYPE_NAVAID');
        assert.equals(window.DataManager.WAYPOINT_TYPE_FIX, 'fix', 'Should have WAYPOINT_TYPE_FIX');
    });

    it('should export SOURCE constants', () => {
        assert.equals(window.DataManager.SOURCE_NASR, 'nasr', 'Should have SOURCE_NASR');
        assert.equals(window.DataManager.SOURCE_OURAIRPORTS, 'ourairports', 'Should have SOURCE_OURAIRPORTS');
    });

    it('should export AIRPORT_TYPE constants', () => {
        assert.equals(window.DataManager.AIRPORT_TYPE_LARGE, 'large_airport', 'Should have AIRPORT_TYPE_LARGE');
        assert.equals(window.DataManager.AIRPORT_TYPE_MEDIUM, 'medium_airport', 'Should have AIRPORT_TYPE_MEDIUM');
        assert.equals(window.DataManager.AIRPORT_TYPE_SMALL, 'small_airport', 'Should have AIRPORT_TYPE_SMALL');
        assert.equals(window.DataManager.AIRPORT_TYPE_HELIPORT, 'heliport', 'Should have AIRPORT_TYPE_HELIPORT');
        assert.equals(window.DataManager.AIRPORT_TYPE_SEAPLANE, 'seaplane_base', 'Should have AIRPORT_TYPE_SEAPLANE');
        assert.equals(window.DataManager.AIRPORT_TYPE_CLOSED, 'closed', 'Should have AIRPORT_TYPE_CLOSED');
    });
});

TestFramework.describe('DataManager - Core Functions', function({ it }) {

    // ============================================
    // INITIALIZATION FUNCTIONS
    // ============================================

    it('should have initDB function', () => {
        assert.isTrue(typeof window.DataManager.initDB === 'function', 'Should have initDB');
    });

    it('should have checkCachedData function', () => {
        assert.isTrue(typeof window.DataManager.checkCachedData === 'function', 'Should have checkCachedData');
    });

    // ============================================
    // DATA LOADING FUNCTIONS
    // ============================================

    it('should have loadData function', () => {
        assert.isTrue(typeof window.DataManager.loadData === 'function', 'Should have loadData');
    });

    it('should have loadFromCache function', () => {
        assert.isTrue(typeof window.DataManager.loadFromCache === 'function', 'Should have loadFromCache');
    });

    // ============================================
    // CACHE MANAGEMENT FUNCTIONS
    // ============================================

    it('should have clearCache function', () => {
        assert.isTrue(typeof window.DataManager.clearCache === 'function', 'Should have clearCache');
    });

    it('should have clearInMemoryData function', () => {
        assert.isTrue(typeof window.DataManager.clearInMemoryData === 'function', 'Should have clearInMemoryData');
    });

    it('should have rebuildTokenTypeMap function', () => {
        assert.isTrue(typeof window.DataManager.rebuildTokenTypeMap === 'function', 'Should have rebuildTokenTypeMap');
    });

    it('should have getFileStatus function', () => {
        assert.isTrue(typeof window.DataManager.getFileStatus === 'function', 'Should have getFileStatus');
    });
});

TestFramework.describe('DataManager - Data Access Functions', function({ it }) {

    // ============================================
    // GETTER FUNCTIONS
    // ============================================

    it('should have getAirport function', () => {
        assert.isTrue(typeof window.DataManager.getAirport === 'function', 'Should have getAirport');
    });

    it('should have getAirportByIATA function', () => {
        assert.isTrue(typeof window.DataManager.getAirportByIATA === 'function', 'Should have getAirportByIATA');
    });

    it('should have getNavaid function', () => {
        assert.isTrue(typeof window.DataManager.getNavaid === 'function', 'Should have getNavaid');
    });

    it('should have getFix function', () => {
        assert.isTrue(typeof window.DataManager.getFix === 'function', 'Should have getFix');
    });

    it('should have getFixCoordinates function', () => {
        assert.isTrue(typeof window.DataManager.getFixCoordinates === 'function', 'Should have getFixCoordinates');
    });

    it('should have getFrequencies function', () => {
        assert.isTrue(typeof window.DataManager.getFrequencies === 'function', 'Should have getFrequencies');
    });

    it('should have getRunways function', () => {
        assert.isTrue(typeof window.DataManager.getRunways === 'function', 'Should have getRunways');
    });

    it('should have getAirspaceClass function', () => {
        assert.isTrue(typeof window.DataManager.getAirspaceClass === 'function', 'Should have getAirspaceClass');
    });

    it('should have getDataStats function', () => {
        assert.isTrue(typeof window.DataManager.getDataStats === 'function', 'Should have getDataStats');
    });

    it('should have getDpsData function', () => {
        assert.isTrue(typeof window.DataManager.getDpsData === 'function', 'Should have getDpsData');
    });

    it('should have getStarsData function', () => {
        assert.isTrue(typeof window.DataManager.getStarsData === 'function', 'Should have getStarsData');
    });

    it('should have getCharts function', () => {
        assert.isTrue(typeof window.DataManager.getCharts === 'function', 'Should have getCharts');
    });
});

TestFramework.describe('DataManager - Data Access (No Data Loaded)', function({ it }) {

    // ============================================
    // GRACEFUL HANDLING WITH NO DATA
    // ============================================

    it('should return null for unknown airport', () => {
        const result = window.DataManager.getAirport('ZZZZ');

        // Should return null or undefined for non-existent airport
        assert.isTrue(result === null || result === undefined, 'Should return null/undefined for unknown airport');
    });

    it('should return null for unknown IATA code', () => {
        const result = window.DataManager.getAirportByIATA('ZZZ');

        assert.isTrue(result === null || result === undefined, 'Should return null/undefined for unknown IATA');
    });

    it('should return null for unknown navaid', () => {
        const result = window.DataManager.getNavaid('ZZZ');

        assert.isTrue(result === null || result === undefined, 'Should return null/undefined for unknown navaid');
    });

    it('should return null for unknown fix', () => {
        const result = window.DataManager.getFix('ZZZZZ');

        assert.isTrue(result === null || result === undefined, 'Should return null/undefined for unknown fix');
    });

    it('should handle empty ICAO gracefully', () => {
        const result = window.DataManager.getAirport('');

        assert.isTrue(result === null || result === undefined, 'Should handle empty ICAO');
    });

    it('should handle null ICAO gracefully', () => {
        const result = window.DataManager.getAirport(null);

        assert.isTrue(result === null || result === undefined, 'Should handle null ICAO');
    });

    it('should return data stats', () => {
        const stats = window.DataManager.getDataStats();

        assert.isTrue(typeof stats === 'object', 'Should return stats object');
        // Stats object should have expected properties
        assert.isTrue('airports' in stats || 'totalAirports' in stats || typeof stats.airports === 'number',
            'Should have airport count');
    });
});

TestFramework.describe('DataManager - Cache Status', function({ it }) {

    // ============================================
    // FILE STATUS
    // ============================================

    it('should get file status', () => {
        const status = window.DataManager.getFileStatus();

        assert.isTrue(typeof status === 'object', 'Should return status object');
    });
});

TestFramework.describe('DataManager - Memory Management', function({ it }) {

    // ============================================
    // IN-MEMORY DATA CLEARING
    // ============================================

    it('should clear in-memory data without error', () => {
        try {
            window.DataManager.clearInMemoryData();
            assert.isTrue(true, 'clearInMemoryData should not throw');
        } catch (e) {
            assert.fail('clearInMemoryData should not throw: ' + e.message);
        }
    });

    it('should rebuild token type map without error', () => {
        try {
            window.DataManager.rebuildTokenTypeMap();
            assert.isTrue(true, 'rebuildTokenTypeMap should not throw');
        } catch (e) {
            assert.fail('rebuildTokenTypeMap should not throw: ' + e.message);
        }
    });
});
