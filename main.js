// Main Bootstrap - Application Initialization
// Architecture v3.0.0 - Bootstrap Sequence

(function() {
    'use strict';

    /**
     * Bootstrap the IN-FLIGHT application with v3 architecture.
     *
     * Initialization sequence:
     * 1. Create storage adapter
     * 2. Create data repository with sources
     * 3. Create query engine with indexes
     * 4. Initialize query engine (loads data, builds indexes)
     * 5. Create services
     * 6. Export to window.App
     */
    async function bootstrap() {
        console.log('[App v3] Bootstrapping v3 architecture...');
        const startTime = performance.now();

        try {
            // 1. Create storage adapter
            const storage = new window.MemoryStorage();

            // 2. Create data repository with sources
            const repository = new window.DataRepository()
                .setStorage(storage);

            // 3. Create query engine with indexes
            const queryEngine = new window.QueryEngineV2()
                .registerIndex('airports', new window.MapIndex())
                .registerIndex('airports_search', new window.TrieIndex())
                .registerIndex('airports_spatial', new window.SpatialGridIndex())
                .registerIndex('navaids', new window.MapIndex())
                .registerIndex('navaids_search', new window.TrieIndex())
                .registerIndex('navaids_spatial', new window.SpatialGridIndex())
                .registerIndex('fixes', new window.MapIndex())
                .registerIndex('fixes_search', new window.TrieIndex())
                .registerIndex('fixes_spatial', new window.SpatialGridIndex())
                .registerIndex('airways', new window.MapIndex())
                .registerIndex('tokenTypes', new window.MapIndex());

            // 4. Create services
            const routeService = new window.RouteService({
                queryEngine,
                dataRepository: repository
            });

            const weatherService = new window.WeatherService({
                dataRepository: repository
            });

            // 5. Export to window.App
            window.App = {
                // Core components
                repository,
                queryEngine,
                storage,

                // Services
                routeService,
                weatherService,

                // Pure function modules (v3)
                Navigation: window.Navigation,
                Terrain: window.Terrain,
                Weather: window.Weather,

                // Version info
                version: '3.0.0',
                architecture: 'v3',

                // Utility functions
                isReady: () => queryEngine.isReady(),
                getStats: () => queryEngine.getStats(),

                // Initialize from legacy DataManager
                initFromLegacy: initFromLegacyDataManager
            };

            const elapsed = Math.round(performance.now() - startTime);
            console.log(`[App v3] Bootstrap complete in ${elapsed}ms`);

            return window.App;

        } catch (error) {
            console.error('[App v3] Bootstrap failed:', error);
            throw error;
        }
    }

    /**
     * Initialize v3 query engine from legacy DataManager data.
     * Called after DataManager has loaded data from IndexedDB.
     */
    async function initFromLegacyDataManager() {
        if (!window.App) {
            console.warn('[App v3] App not bootstrapped yet');
            return false;
        }

        if (!window.DataManager) {
            console.warn('[App v3] Legacy DataManager not available');
            return false;
        }

        // Check if legacy data is loaded
        if (!window.DataManager.isDataLoaded || !window.DataManager.isDataLoaded()) {
            console.log('[App v3] Waiting for legacy data to load...');
            return false;
        }

        console.log('[App v3] Initializing from legacy DataManager...');
        const startTime = performance.now();

        try {
            // Get data from legacy system
            const airports = window.DataManager.getAirportsMap ?
                window.DataManager.getAirportsMap() : new Map();
            const navaids = window.DataManager.getNavaidsMap ?
                window.DataManager.getNavaidsMap() : new Map();
            const fixes = window.DataManager.getFixesMap ?
                window.DataManager.getFixesMap() : new Map();
            const airways = window.DataManager.getAirwaysMap ?
                window.DataManager.getAirwaysMap() : new Map();

            // Build indexes directly
            const qe = window.App.queryEngine;

            if (airports.size > 0) {
                console.log(`[App v3] Building airport indexes (${airports.size} entries)`);
                qe._indexes.get('airports')?.build(airports);
                qe._indexes.get('airports_search')?.build(airports);
                qe._indexes.get('airports_spatial')?.build(airports);
            }

            if (navaids.size > 0) {
                console.log(`[App v3] Building navaid indexes (${navaids.size} entries)`);
                qe._indexes.get('navaids')?.build(navaids);
                qe._indexes.get('navaids_search')?.build(navaids);
                qe._indexes.get('navaids_spatial')?.build(navaids);
            }

            if (fixes.size > 0) {
                console.log(`[App v3] Building fix indexes (${fixes.size} entries)`);
                qe._indexes.get('fixes')?.build(fixes);
                qe._indexes.get('fixes_search')?.build(fixes);
                qe._indexes.get('fixes_spatial')?.build(fixes);
            }

            if (airways.size > 0) {
                console.log(`[App v3] Building airway indexes (${airways.size} entries)`);
                qe._indexes.get('airways')?.build(airways);
            }

            // Build token type index
            const tokenTypes = new Map();
            for (const [code] of airports) tokenTypes.set(code, 'AIRPORT');
            for (const [code] of navaids) tokenTypes.set(code, 'NAVAID');
            for (const [code] of fixes) tokenTypes.set(code, 'FIX');
            for (const [code] of airways) tokenTypes.set(code, 'AIRWAY');
            qe._indexes.get('tokenTypes')?.build(tokenTypes);

            qe._initialized = true;

            const elapsed = Math.round(performance.now() - startTime);
            console.log(`[App v3] Legacy data loaded in ${elapsed}ms`);
            console.log('[App v3] Stats:', window.App.getStats());

            return true;

        } catch (error) {
            console.error('[App v3] Failed to init from legacy:', error);
            return false;
        }
    }

    /**
     * Initialize with custom data sources (for future use)
     */
    async function initializeWithData(dataConfig) {
        if (!window.App) {
            await bootstrap();
        }

        console.log('[App v3] Initializing with data sources...');

        for (const [name, config] of Object.entries(dataConfig)) {
            window.App.repository.registerSource(
                name,
                config.source,
                config.strategy
            );
        }

        await window.App.queryEngine.initialize(window.App.repository);

        console.log('[App v3] Data initialization complete');
        console.log('[App v3] Stats:', window.App.getStats());
    }

    // Export bootstrap functions
    window.bootstrapApp = bootstrap;
    window.initializeAppWithData = initializeWithData;
    window.initFromLegacyDataManager = initFromLegacyDataManager;

    // Auto-bootstrap when script loads (after app.js has initialized)
    bootstrap().then(() => {
        // Try to init from legacy if data already loaded
        setTimeout(() => {
            if (window.DataManager && window.DataManager.isDataLoaded &&
                window.DataManager.isDataLoaded()) {
                initFromLegacyDataManager();
            }
        }, 100);
    }).catch(err => {
        console.error('[App v3] Auto-bootstrap failed:', err);
    });

})();
