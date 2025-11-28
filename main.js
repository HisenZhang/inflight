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
        console.log('[App] Bootstrapping v3 architecture...');
        const startTime = performance.now();

        try {
            // 1. Create storage adapter
            console.log('[App] Creating storage adapter...');
            const storage = new window.MemoryStorage();
            // TODO: Use IndexedDBStorage in production
            // const storage = new IndexedDBStorage('InFlightDB');
            // await storage.init();

            // 2. Create data repository with sources
            console.log('[App] Creating data repository...');
            const repository = new window.DataRepository()
                .setStorage(storage);

            // Register data sources (will be implemented with concrete sources)
            // .registerSource('airports', new NASRSource({...}), new VersionStrategy(...))
            // .registerSource('navaids', new NASRSource({...}), new VersionStrategy(...))
            // .registerSource('fixes', new NASRSource({...}), new VersionStrategy(...))
            // .registerSource('airways', new NASRSource({...}), new VersionStrategy(...))
            // .registerSource('terrain', new TerrainSource(), new PermanentStrategy())
            // .registerSource('weather_metar', new WeatherSource({type: 'metar'}), new TTLStrategy(5 * 60 * 1000));

            // 3. Create query engine with indexes
            console.log('[App] Creating query engine...');
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

            // 4. Initialize query engine (loads data, builds indexes)
            // Note: Will initialize when data sources are registered
            // await queryEngine.initialize(repository);

            // 5. Create services
            console.log('[App] Creating services...');
            const routeService = new window.RouteService({
                queryEngine,
                dataRepository: repository
            });

            const weatherService = new window.WeatherService({
                dataRepository: repository
            });

            // 6. Export to window.App
            window.App = {
                // Core components
                repository,
                queryEngine,

                // Services
                routeService,
                weatherService,

                // Version info
                version: '3.0.0',
                architecture: 'v3',

                // Utility functions
                isReady: () => queryEngine.isReady(),
                getStats: () => queryEngine.getStats()
            };

            // 7. Legacy compatibility (during migration)
            // Keep old globals working
            window.QueryEngineV2Instance = queryEngine;

            const elapsed = Math.round(performance.now() - startTime);
            console.log(`[App] Bootstrap complete in ${elapsed}ms`);
            console.log('[App] v3 architecture ready');

            return window.App;

        } catch (error) {
            console.error('[App] Bootstrap failed:', error);
            throw error;
        }
    }

    /**
     * Initialize with data (call after data sources are ready)
     */
    async function initializeWithData(dataConfig) {
        if (!window.App) {
            await bootstrap();
        }

        console.log('[App] Initializing with data...');

        // Register data sources from config
        for (const [name, config] of Object.entries(dataConfig)) {
            window.App.repository.registerSource(
                name,
                config.source,
                config.strategy
            );
        }

        // Initialize query engine
        await window.App.queryEngine.initialize(window.App.repository);

        console.log('[App] Data initialization complete');
        console.log('[App] Stats:', window.App.getStats());
    }

    // Export bootstrap functions
    window.bootstrapApp = bootstrap;
    window.initializeAppWithData = initializeWithData;

    // Auto-bootstrap when DOM is ready (optional)
    // Uncomment to auto-start:
    // document.addEventListener('DOMContentLoaded', bootstrap);

})();
