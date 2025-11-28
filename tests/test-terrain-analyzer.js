// Tests for compute/terrain-analyzer.js - MORA terrain analysis

TestFramework.describe('Terrain Analyzer - MORA Data', function({ it }) {

    // ============================================
    // MORA DATA STATUS
    // ============================================

    it('should report MORA data loaded status', () => {
        const loaded = window.TerrainAnalyzer.isMORADataLoaded();

        assert.isTrue(typeof loaded === 'boolean', 'Should return boolean');
    });

    // ============================================
    // MORA LOOKUP FUNCTIONS
    // ============================================

    it('should have getMORAForGrid function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.getMORAForGrid === 'function',
            'Should have getMORAForGrid function');
    });

    it('should have getMORAInBounds function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.getMORAInBounds === 'function',
            'Should have getMORAInBounds function');
    });

    it('should have getGridMORAData function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.getGridMORAData === 'function',
            'Should have getGridMORAData function');
    });
});

TestFramework.describe('Terrain Analyzer - Analysis Functions', function({ it }) {

    // ============================================
    // ROUTE ANALYSIS
    // ============================================

    it('should have analyzeRouteTerrain function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.analyzeRouteTerrain === 'function',
            'Should have analyzeRouteTerrain');
    });

    it('should have getTerrainProfile function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.getTerrainProfile === 'function',
            'Should have getTerrainProfile');
    });

    it('should have getLegAnalysis function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.getLegAnalysis === 'function',
            'Should have getLegAnalysis');
    });

    it('should have getLastAnalysis function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.getLastAnalysis === 'function',
            'Should have getLastAnalysis');
    });

    // ============================================
    // TERRAIN CLEARANCE
    // ============================================

    it('should have checkTerrainClearance function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.checkTerrainClearance === 'function',
            'Should have checkTerrainClearance');
    });

    it('should have getMinimumSafeAltitude function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.getMinimumSafeAltitude === 'function',
            'Should have getMinimumSafeAltitude');
    });

    it('should get minimum safe altitude (null without analysis)', () => {
        const msa = window.TerrainAnalyzer.getMinimumSafeAltitude(null);

        // With no analysis, should return default or null
        assert.isTrue(msa === null || typeof msa === 'number', 'Should return number or null');
    });

    // ============================================
    // TERRAIN PROFILE ACCESS
    // ============================================

    it('should get terrain profile (null without analysis)', () => {
        const profile = window.TerrainAnalyzer.getTerrainProfile();

        assert.isTrue(profile === null || Array.isArray(profile), 'Should return array or null');
    });

    it('should get leg analysis (null without analysis)', () => {
        const legs = window.TerrainAnalyzer.getLegAnalysis();

        assert.isTrue(legs === null || Array.isArray(legs), 'Should return array or null');
    });

    it('should get last analysis (null initially)', () => {
        const analysis = window.TerrainAnalyzer.getLastAnalysis();

        // Initially null or previous analysis
        assert.isTrue(analysis === null || typeof analysis === 'object',
            'Should return null or analysis object');
    });
});

TestFramework.describe('Terrain Analyzer - Cache Management', function({ it }) {

    // ============================================
    // CACHE OPERATIONS
    // ============================================

    it('should have initTerrainDB function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.initTerrainDB === 'function',
            'Should have initTerrainDB function');
    });

    it('should have getCacheStats function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.getCacheStats === 'function',
            'Should have getCacheStats function');
    });

    it('should have clearTerrainCache function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.clearTerrainCache === 'function',
            'Should have clearTerrainCache function');
    });

    it('should have clearAllCache function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.clearAllCache === 'function',
            'Should have clearAllCache function');
    });

    it('should have preloadRegion function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.preloadRegion === 'function',
            'Should have preloadRegion function');
    });

    it('should get cache stats', async () => {
        const stats = await window.TerrainAnalyzer.getCacheStats();

        assert.isTrue('memoryEntries' in stats, 'Should have memoryEntries');
        assert.isTrue('dbEntries' in stats, 'Should have dbEntries');
        assert.isTrue(typeof stats.memoryEntries === 'number', 'memoryEntries should be number');
    });
});

TestFramework.describe('Terrain Analyzer - Elevation Queries', function({ it }) {

    // ============================================
    // ELEVATION QUERY FUNCTIONS
    // ============================================

    it('should have getElevationAtPoint function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.getElevationAtPoint === 'function',
            'Should have getElevationAtPoint function');
    });

    it('should have getElevationsForPoints function', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.getElevationsForPoints === 'function',
            'Should have getElevationsForPoints function');
    });
});

TestFramework.describe('Terrain Analyzer - Constants', function({ it }) {

    // ============================================
    // EXPORTED CONSTANTS
    // ============================================

    it('should export MIN_TERRAIN_CLEARANCE_FT', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.MIN_TERRAIN_CLEARANCE_FT === 'number',
            'Should have MIN_TERRAIN_CLEARANCE_FT constant');
        assert.equals(window.TerrainAnalyzer.MIN_TERRAIN_CLEARANCE_FT, 1000,
            'Standard IFR clearance should be 1000ft');
    });

    it('should export MOUNTAINOUS_THRESHOLD_FT', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.MOUNTAINOUS_THRESHOLD_FT === 'number',
            'Should have MOUNTAINOUS_THRESHOLD_FT constant');
        assert.equals(window.TerrainAnalyzer.MOUNTAINOUS_THRESHOLD_FT, 5000,
            'Mountainous threshold should be 5000ft');
    });

    it('should export MOUNTAINOUS_CLEARANCE_FT', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.MOUNTAINOUS_CLEARANCE_FT === 'number',
            'Should have MOUNTAINOUS_CLEARANCE_FT constant');
        assert.equals(window.TerrainAnalyzer.MOUNTAINOUS_CLEARANCE_FT, 2000,
            'Mountainous clearance should be 2000ft');
    });

    it('should export MORA_GRID_SIZE_DEG', () => {
        assert.isTrue(typeof window.TerrainAnalyzer.MORA_GRID_SIZE_DEG === 'number',
            'Should have MORA_GRID_SIZE_DEG constant');
        assert.equals(window.TerrainAnalyzer.MORA_GRID_SIZE_DEG, 1.0,
            'MORA grid size should be 1 degree');
    });
});

TestFramework.describe('Terrain Analyzer - Complete API', function({ it }) {

    // ============================================
    // PUBLIC API COMPLETENESS
    // ============================================

    it('should expose all expected functions', () => {
        const ta = window.TerrainAnalyzer;

        // Core analysis functions
        assert.isTrue(typeof ta.analyzeRouteTerrain === 'function', 'Should have analyzeRouteTerrain');
        assert.isTrue(typeof ta.checkTerrainClearance === 'function', 'Should have checkTerrainClearance');
        assert.isTrue(typeof ta.getMinimumSafeAltitude === 'function', 'Should have getMinimumSafeAltitude');
        assert.isTrue(typeof ta.getTerrainProfile === 'function', 'Should have getTerrainProfile');
        assert.isTrue(typeof ta.getLegAnalysis === 'function', 'Should have getLegAnalysis');
        assert.isTrue(typeof ta.getLastAnalysis === 'function', 'Should have getLastAnalysis');

        // MORA functions
        assert.isTrue(typeof ta.getGridMORAData === 'function', 'Should have getGridMORAData');
        assert.isTrue(typeof ta.loadMORAData === 'function', 'Should have loadMORAData');
        assert.isTrue(typeof ta.getMORAForGrid === 'function', 'Should have getMORAForGrid');
        assert.isTrue(typeof ta.getMORAInBounds === 'function', 'Should have getMORAInBounds');
        assert.isTrue(typeof ta.isMORADataLoaded === 'function', 'Should have isMORADataLoaded');

        // Elevation functions
        assert.isTrue(typeof ta.getElevationAtPoint === 'function', 'Should have getElevationAtPoint');
        assert.isTrue(typeof ta.getElevationsForPoints === 'function', 'Should have getElevationsForPoints');

        // Cache functions
        assert.isTrue(typeof ta.initTerrainDB === 'function', 'Should have initTerrainDB');
        assert.isTrue(typeof ta.preloadRegion === 'function', 'Should have preloadRegion');
        assert.isTrue(typeof ta.getCacheStats === 'function', 'Should have getCacheStats');
        assert.isTrue(typeof ta.clearTerrainCache === 'function', 'Should have clearTerrainCache');
        assert.isTrue(typeof ta.clearAllCache === 'function', 'Should have clearAllCache');
    });
});
