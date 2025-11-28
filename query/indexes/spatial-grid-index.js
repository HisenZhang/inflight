// Spatial Grid Index - Grid-Based Spatial Queries
// Architecture v3.0.0 - Query Layer Indexes

(function() {
    'use strict';

    /**
     * Grid-based spatial index for location queries.
     * Divides space into grid cells for efficient spatial lookups.
     * Best for: "Find nearby", "Find in bounds" queries
     *
     * @extends IndexStrategy
     */
    class SpatialGridIndex extends window.IndexStrategy {
        /**
         * Create a spatial grid index
         * @param {number} gridSizeDeg - Grid cell size in degrees (default 1.0)
         */
        constructor(gridSizeDeg = 1.0) {
            super();
            this._grid = new Map();
            this._gridSize = gridSizeDeg;
            this._size = 0;
        }

        /**
         * Generate grid cell key from lat/lon
         * @private
         */
        _toKey(lat, lon) {
            const latCell = Math.floor(lat / this._gridSize);
            const lonCell = Math.floor(lon / this._gridSize);
            return `${latCell},${lonCell}`;
        }

        /**
         * Build spatial index from data
         * @param {Map|Object} data - Items with lat/lon properties
         * @returns {SpatialGridIndex} this for chaining
         */
        build(data) {
            this._grid.clear();
            this._size = 0;

            const entries = data instanceof Map
                ? data.entries()
                : Object.entries(data);

            for (const [id, item] of entries) {
                if (item.lat != null && item.lon != null) {
                    const key = this._toKey(item.lat, item.lon);

                    if (!this._grid.has(key)) {
                        this._grid.set(key, []);
                    }

                    this._grid.get(key).push({ id, ...item });
                    this._size++;
                }
            }

            return this;
        }

        /**
         * Query by radius or bounds
         * @param {Object} params - Query parameters
         * @param {number} params.lat - Center latitude (for radius query)
         * @param {number} params.lon - Center longitude (for radius query)
         * @param {number} params.radiusNM - Search radius in nautical miles
         * @param {Object} params.bounds - Bounding box {minLat, maxLat, minLon, maxLon}
         * @returns {Array} Array of items in search area
         */
        query(params) {
            const { lat, lon, radiusNM, bounds } = params;

            if (bounds) {
                return this._queryBounds(bounds);
            }

            if (lat != null && lon != null && radiusNM != null) {
                return this._queryRadius(lat, lon, radiusNM);
            }

            return [];
        }

        /**
         * Find items within radius of a point
         * @private
         */
        _queryRadius(lat, lon, radiusNM) {
            const results = [];

            // Convert radius to approximate grid cells
            // 1 degree latitude ≈ 60 nautical miles
            const gridRadius = Math.ceil(radiusNM / 60 / this._gridSize) + 1;

            const centerLatCell = Math.floor(lat / this._gridSize);
            const centerLonCell = Math.floor(lon / this._gridSize);

            // Search surrounding cells
            for (let dLat = -gridRadius; dLat <= gridRadius; dLat++) {
                for (let dLon = -gridRadius; dLon <= gridRadius; dLon++) {
                    const key = `${centerLatCell + dLat},${centerLonCell + dLon}`;
                    const cell = this._grid.get(key);

                    if (cell) {
                        results.push(...cell);
                    }
                }
            }

            return results;
        }

        /**
         * Find items within bounding box
         * @private
         */
        _queryBounds(bounds) {
            const { minLat, maxLat, minLon, maxLon } = bounds;
            const results = [];

            const minLatCell = Math.floor(minLat / this._gridSize);
            const maxLatCell = Math.floor(maxLat / this._gridSize);
            const minLonCell = Math.floor(minLon / this._gridSize);
            const maxLonCell = Math.floor(maxLon / this._gridSize);

            // Search all cells in bounds
            for (let latCell = minLatCell; latCell <= maxLatCell; latCell++) {
                for (let lonCell = minLonCell; lonCell <= maxLonCell; lonCell++) {
                    const key = `${latCell},${lonCell}`;
                    const cell = this._grid.get(key);

                    if (cell) {
                        // Filter to only items actually within bounds
                        for (const item of cell) {
                            if (item.lat >= minLat && item.lat <= maxLat &&
                                item.lon >= minLon && item.lon <= maxLon) {
                                results.push(item);
                            }
                        }
                    }
                }
            }

            return results;
        }

        /**
         * Update not supported (rebuild instead)
         */
        update(key, value) {
            console.warn('[SpatialGridIndex] update() not supported, use rebuild');
        }

        /**
         * Delete not supported (rebuild instead)
         */
        delete(key) {
            console.warn('[SpatialGridIndex] delete() not supported, use rebuild');
        }

        /**
         * Clear all entries
         */
        clear() {
            this._grid.clear();
            this._size = 0;
        }

        /**
         * Get entry count
         * @returns {number} Number of indexed items
         */
        get size() {
            return this._size;
        }

        /**
         * Get number of grid cells
         * @returns {number} Number of cells with data
         */
        get cellCount() {
            return this._grid.size;
        }
    }

    // Export to window
    window.SpatialGridIndex = SpatialGridIndex;

})();
