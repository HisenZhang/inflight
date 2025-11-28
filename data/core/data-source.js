// Data Source - Abstract Base Class
// Architecture v3.0.0 - Data Layer Core

(function() {
    'use strict';

    /**
     * Abstract base class for all data sources.
     * Implements the Template Method pattern for data loading.
     *
     * Implementations: NASRSource, OurAirportsSource, WeatherSource, TerrainSource
     *
     * @abstract
     */
    class DataSource {
        /**
         * Create a new data source
         * @param {Object} config - Configuration options for the source
         */
        constructor(config = {}) {
            this.config = config;
            this.name = this.constructor.name;
        }

        /**
         * Fetch raw data from the source.
         * MUST be implemented by subclasses.
         *
         * @abstract
         * @returns {Promise<any>} Raw data from source
         * @throws {Error} If not implemented
         */
        async fetch() {
            throw new Error(`${this.name}.fetch() not implemented`);
        }

        /**
         * Parse raw data into usable format.
         * MUST be implemented by subclasses.
         *
         * @abstract
         * @param {any} rawData - Raw data from fetch()
         * @returns {Promise<any>} Parsed data
         * @throws {Error} If not implemented
         */
        async parse(rawData) {
            throw new Error(`${this.name}.parse() not implemented`);
        }

        /**
         * Validate parsed data.
         * MAY be overridden by subclasses.
         * Default implementation returns true.
         *
         * @param {any} data - Parsed data to validate
         * @returns {Promise<boolean>} True if valid, false otherwise
         */
        async validate(data) {
            return true;
        }

        /**
         * Transform data before returning.
         * MAY be overridden by subclasses.
         * Default implementation returns data unchanged.
         *
         * @param {any} data - Validated data to transform
         * @returns {Promise<any>} Transformed data
         */
        async transform(data) {
            return data;
        }

        /**
         * Load data from source.
         * Template method - orchestrates fetch → parse → validate → transform.
         * DO NOT override this method.
         *
         * @returns {Promise<any>} Fully processed data
         * @throws {Error} If validation fails
         */
        async load() {
            const raw = await this.fetch();
            const parsed = await this.parse(raw);

            if (!await this.validate(parsed)) {
                throw new Error(`${this.name} validation failed`);
            }

            return await this.transform(parsed);
        }
    }

    // Export to window
    window.DataSource = DataSource;

})();
