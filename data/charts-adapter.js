/**
 * Charts Adapter - Fetches and parses FAA d-TPP chart metadata
 *
 * Data source: https://aeronav.faa.gov/d-tpp/YYMM/xml_data/d-TPP_Metafile.xml
 * Chart PDFs: https://aeronav.faa.gov/d-tpp/YYMM/PDFNAME.PDF
 *
 * Parses XML metadata for:
 * - Instrument approach procedures (IAP)
 * - Airport diagrams (APD)
 * - Departure procedures (DP/ODP)
 * - Standard terminal arrivals (STAR)
 * - Minimums (MIN)
 *
 * Chart codes:
 * - IAP: Instrument Approach Procedures
 * - APD: Airport Diagrams
 * - DP: Departure Procedures
 * - ODP: Obstacle Departure Procedures
 * - STAR: Standard Terminal Arrival Routes
 * - MIN: Takeoff/Alternate/Radar Minimums
 * - HOT: Hot Spot diagrams
 *
 * @module ChartsAdapter
 */

window.ChartsAdapter = {
    /**
     * Gets current TPP cycle (YYMM format)
     * TPP cycles are valid for 28 days
     * @returns {string} Current cycle like '2511' for Nov 2025
     */
    getCurrentCycle() {
        const now = new Date();
        const year = now.getFullYear() % 100;
        const month = now.getMonth() + 1;
        return `${year}${month.toString().padStart(2, '0')}`;
    },

    /**
     * Fetches d-TPP metadata XML for current cycle
     * Uses CORS proxy to bypass CORS restrictions
     * @returns {Promise<string>} XML data
     */
    async fetchChartMetadata() {
        const cycle = this.getCurrentCycle();
        const faaUrl = `https://aeronav.faa.gov/d-tpp/${cycle}/xml_data/d-TPP_Metafile.xml`;

        // Use custom CORS proxy (same domain as NASR data)
        const corsProxy = 'https://cors.hisenz.com/?url=';
        const url = corsProxy + encodeURIComponent(faaUrl);

        console.log(`[ChartsAdapter] Fetching chart metadata for cycle ${cycle}...`);
        console.log(`[ChartsAdapter] FAA URL: ${faaUrl}`);
        console.log(`[ChartsAdapter] Using CORS proxy: ${corsProxy}`);
        const startTime = Date.now();

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch chart metadata: ${response.status} ${response.statusText}`);
        }

        const xml = await response.text();
        const downloadTime = Date.now() - startTime;

        console.log(`[ChartsAdapter] Downloaded chart metadata (${(xml.length / 1024 / 1024).toFixed(2)} MB) in ${downloadTime}ms`);

        return xml;
    },

    /**
     * Parses XML chart metadata into structured data
     * @param {string} xmlData - Raw XML string
     * @returns {Object} Parsed chart data
     */
    parseChartMetadata(xmlData) {
        console.log('[ChartsAdapter] Parsing chart metadata XML...');
        console.log('[ChartsAdapter] XML data length:', xmlData.length);
        const startTime = Date.now();

        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlData, 'text/xml');

        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            console.error('[ChartsAdapter] XML parse error:', parserError.textContent);
            throw new Error(`XML parsing error: ${parserError.textContent}`);
        }

        const root = doc.querySelector('digital_tpp');
        if (!root) {
            console.error('[ChartsAdapter] No digital_tpp root element found!');
            console.error('[ChartsAdapter] First 500 chars of XML:', xmlData.substring(0, 500));
            throw new Error('Invalid XML structure: no digital_tpp root element');
        }

        const cycle = root.getAttribute('cycle');
        const fromDate = root.getAttribute('from_edate');
        const toDate = root.getAttribute('to_edate');

        console.log(`[ChartsAdapter] TPP Cycle: ${cycle} (${fromDate} to ${toDate})`);

        const chartsMap = new Map();
        let totalCharts = 0;

        const airports = doc.querySelectorAll('airport_name');
        console.log(`[ChartsAdapter] Found ${airports.length} airports in XML`);

        airports.forEach(airport => {
            const icao = airport.getAttribute('icao_ident');
            const ident = airport.getAttribute('apt_ident');
            const name = airport.getAttribute('ID');
            const military = airport.getAttribute('military') === 'M';

            if (!icao) {
                return;
            }

            const records = airport.querySelectorAll('record');
            const charts = [];

            records.forEach(record => {
                const chartCode = this._getTextContent(record, 'chart_code');
                const chartName = this._getTextContent(record, 'chart_name');
                const pdfName = this._getTextContent(record, 'pdf_name');
                const chartSeq = this._getTextContent(record, 'chartseq');

                if (!pdfName || !chartCode || !chartName) {
                    return;
                }

                charts.push({
                    code: chartCode,
                    name: chartName,
                    pdfName: pdfName,
                    sequence: chartSeq,
                    url: `https://aeronav.faa.gov/d-tpp/${cycle}/${pdfName}`
                });

                totalCharts++;
            });

            if (charts.length > 0) {
                chartsMap.set(icao, {
                    icao: icao,
                    ident: ident,
                    name: name,
                    military: military,
                    charts: charts
                });
            }
        });

        const parseTime = Date.now() - startTime;

        console.log(`[ChartsAdapter] Parsed ${totalCharts} charts for ${chartsMap.size} airports in ${parseTime}ms`);

        return {
            cycle: cycle,
            fromDate: fromDate,
            toDate: toDate,
            chartsMap: chartsMap,
            totalCharts: totalCharts,
            totalAirports: chartsMap.size
        };
    },

    /**
     * Helper to get text content from XML element
     * @private
     */
    _getTextContent(parent, tagName) {
        const element = parent.querySelector(tagName);
        return element ? element.textContent.trim() : null;
    },

    /**
     * Loads chart metadata and returns parsed data
     * @param {Function} onStatusUpdate - Optional callback for status updates
     * @returns {Promise<Object>} Parsed chart data
     */
    async loadChartData(onStatusUpdate) {
        try {
            console.log('[ChartsAdapter] Starting chart data load...');

            if (onStatusUpdate) {
                onStatusUpdate('[...] DOWNLOADING CHART METADATA');
            }

            const xmlData = await this.fetchChartMetadata();
            console.log('[ChartsAdapter] Fetch complete, XML length:', xmlData ? xmlData.length : 0);

            if (onStatusUpdate) {
                onStatusUpdate('[...] PARSING CHART METADATA');
            }

            const chartData = this.parseChartMetadata(xmlData);
            console.log('[ChartsAdapter] Parse complete, chartsMap size:', chartData.chartsMap.size);

            if (onStatusUpdate) {
                onStatusUpdate(`[✓] CHARTS (${chartData.totalCharts} for ${chartData.totalAirports} airports)`);
            }

            const result = {
                success: true,
                data: chartData,
                rawXML: xmlData
            };

            console.log('[ChartsAdapter] Returning result:', {
                success: result.success,
                dataKeys: Object.keys(result.data),
                chartsMapSize: result.data.chartsMap.size,
                rawXMLLength: result.rawXML ? result.rawXML.length : 0
            });

            return result;

        } catch (error) {
            console.error('[ChartsAdapter] Error loading chart data:', error);
            console.error('[ChartsAdapter] Error stack:', error.stack);

            if (onStatusUpdate) {
                onStatusUpdate(`[!] CHARTS FAILED: ${error.message}`);
            }

            return {
                success: false,
                error: error.message
            };
        }
    },

    /**
     * Gets charts for a specific airport
     * @param {Map} chartsMap - Charts data map
     * @param {string} icao - Airport ICAO code
     * @returns {Array|null} Array of charts or null if not found
     */
    getChartsForAirport(chartsMap, icao) {
        const airportData = chartsMap.get(icao);
        return airportData ? airportData.charts : null;
    },

    /**
     * Groups charts by type for display
     * @param {Array} charts - Array of chart objects
     * @returns {Object} Charts grouped by type
     */
    groupChartsByType(charts) {
        const grouped = {
            APD: [],
            IAP: [],
            DP: [],
            ODP: [],
            STAR: [],
            MIN: [],
            HOT: [],
            OTHER: []
        };

        charts.forEach(chart => {
            const type = chart.code;
            if (grouped[type]) {
                grouped[type].push(chart);
            } else {
                grouped.OTHER.push(chart);
            }
        });

        return grouped;
    },

    /**
     * Groups approach charts by approach type (ILS, RNAV, VOR, etc.)
     * @param {Array} iapCharts - Array of IAP chart objects
     * @returns {Object} Charts grouped by approach type
     */
    groupApproachesByType(iapCharts) {
        const grouped = {
            ILS: [],
            RNAV: [],
            GPS: [],
            VOR: [],
            NDB: [],
            LOC: [],
            OTHER: []
        };

        iapCharts.forEach(chart => {
            const name = chart.name.toUpperCase();

            if (name.startsWith('ILS ') || name.includes(' ILS ')) {
                grouped.ILS.push(chart);
            } else if (name.startsWith('RNAV')) {
                grouped.RNAV.push(chart);
            } else if (name.startsWith('GPS') || name.includes('(GPS)')) {
                grouped.GPS.push(chart);
            } else if (name.startsWith('VOR')) {
                grouped.VOR.push(chart);
            } else if (name.startsWith('NDB')) {
                grouped.NDB.push(chart);
            } else if (name.startsWith('LOC')) {
                grouped.LOC.push(chart);
            } else {
                grouped.OTHER.push(chart);
            }
        });

        return grouped;
    },

    /**
     * Gets human-readable chart type name
     * @param {string} code - Chart code
     * @returns {string} Human-readable name
     */
    getChartTypeName(code) {
        const typeNames = {
            'APD': 'Airport Diagram',
            'IAP': 'Approach Procedures',
            'DP': 'Departure Procedures',
            'ODP': 'Obstacle Departure Procedures',
            'STAR': 'Standard Arrivals',
            'MIN': 'Minimums',
            'HOT': 'Hot Spots'
        };

        return typeNames[code] || code;
    }
};
