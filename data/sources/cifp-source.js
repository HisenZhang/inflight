// CIFP Data Source - FAA Coded Instrument Flight Procedures (ARINC 424-18)
// Architecture v3.0.0 - Data Layer
// Selectively loads: MORA (AS), Airspace (UC/UR), Procedures (PD/PE/PF/HF)

(function() {
    'use strict';

    // CIFP download URL - FAA AeroNav (updated every 28 days, AIRAC cycle)
    // Using CORS proxy to bypass CORS restrictions
    const CIFP_BASE_URL = 'https://aeronav.faa.gov/Upload_313-d/cifp';
    const CIFP_FILENAME = 'CIFP_251127.zip'; // Update with current cycle
    const CORS_PROXY = 'https://cors.hisenz.com?url=';
    const CIFP_VALIDITY_DAYS = 28; // AIRAC cycle

    /**
     * Data source for FAA CIFP (Coded Instrument Flight Procedures).
     * Loads ARINC 424-18 formatted data for:
     * - MORA grid (AS records)
     * - Controlled airspace (UC records)
     * - Special use airspace (UR records)
     * - Airways (ER records)
     * - SID/STAR/Approaches (PD/PE/PF/HF records)
     */
    class CIFPSource extends window.DataSource {
        constructor(config = {}) {
            super(config);
            // Load MORA, Airspace, Procedures, AND Airways
            // P = Procedures (all types), ER = Airways, UC/UR = Airspace, AS = MORA
            this._recordTypesToLoad = config.recordTypes || ['AS', 'UC', 'UR', 'ER', 'P'];
        }

        /**
         * Fetch CIFP data from FAA AeroNav via CORS proxy
         * @returns {Promise<Object>} {text: raw CIFP text, info: metadata}
         */
        async fetch() {
            const cifpUrl = `${CIFP_BASE_URL}/${CIFP_FILENAME}`;
            const proxiedUrl = `${CORS_PROXY}${encodeURIComponent(cifpUrl)}`;

            console.log('[CIFPSource] Fetching CIFP data from FAA AeroNav...');
            console.log('[CIFPSource] File:', CIFP_FILENAME);
            console.log('[CIFPSource] Via CORS proxy:', proxiedUrl);

            // Download CIFP file (ZIP format) via CORS proxy
            const response = await fetch(proxiedUrl);
            if (!response.ok) {
                throw new Error(`CIFP download failed: ${response.status} ${response.statusText}`);
            }

            // Get the ZIP file as ArrayBuffer
            const zipBuffer = await response.arrayBuffer();
            console.log(`[CIFPSource] Downloaded ${(zipBuffer.byteLength / 1024 / 1024).toFixed(1)} MB (compressed)`);

            // Use JSZip to extract FAACIFP18 file
            if (!window.JSZip) {
                throw new Error('JSZip library not loaded - required for CIFP extraction');
            }

            const zip = await window.JSZip.loadAsync(zipBuffer);
            console.log('[CIFPSource] ZIP contents:', Object.keys(zip.files).join(', '));

            // Find FAACIFP18 file (case-insensitive)
            const cifpFileName = Object.keys(zip.files).find(name =>
                name.toUpperCase().includes('FAACIFP18')
            );

            if (!cifpFileName) {
                throw new Error('FAACIFP18 file not found in ZIP archive');
            }

            console.log('[CIFPSource] Extracting:', cifpFileName);
            const text = await zip.file(cifpFileName).async('string');
            console.log(`[CIFPSource] Extracted ${(text.length / 1024 / 1024).toFixed(1)} MB (uncompressed)`);

            // Extract effective date from filename (CIFP_YYMMDD.zip)
            const effectiveDate = this._extractEffectiveDateFromFilename(CIFP_FILENAME);
            const cycle = CIFP_FILENAME.replace('CIFP_', '').replace('.zip', '');

            const info = {
                cycle: cycle,
                effectiveDate: effectiveDate,
                source: 'FAA AeroNav',
                fileName: cifpFileName
            };

            console.log('[CIFPSource] Cycle:', cycle, 'Effective:', effectiveDate);

            return { text, info };
        }

        /**
         * Extract effective date from CIFP filename
         * @param {string} filename - CIFP filename (e.g., CIFP_251127.zip)
         * @returns {string} Effective date (YYYY-MM-DD)
         */
        _extractEffectiveDateFromFilename(filename) {
            // Extract YYMMDD from filename (e.g., CIFP_251127.zip -> 251127)
            const match = filename.match(/CIFP_(\d{6})/);
            if (match) {
                const dateStr = match[1];
                const yy = dateStr.substring(0, 2);
                const mm = dateStr.substring(2, 4);
                const dd = dateStr.substring(4, 6);
                const year = 2000 + parseInt(yy);
                return `${year}-${mm}-${dd}`;
            }

            // Fallback to current date if parsing fails
            const today = new Date();
            return today.toISOString().split('T')[0];
        }

        /**
         * Parse CIFP ARINC 424 records
         * @param {Object} rawData - {text, info}
         * @returns {Promise<Object>} Parsed CIFP data
         */
        async parse(rawData) {
            const { text, info } = rawData;
            const lines = text.split('\n');

            console.log(`[CIFPSource] Parsing ${lines.length.toLocaleString()} CIFP records...`);

            const data = {
                moraGrid: new Map(),        // AS records - MORA grid (lat,lon → MORA ft)
                airspaces: new Map(),       // UC records - Controlled airspace
                suaAirspaces: new Map(),    // UR records - Special use airspace
                airways: new Map(),         // ER records - Airways (enroute)
                sids: new Map(),            // PD records - Departure procedures
                stars: new Map(),           // PE records - Arrival procedures
                approaches: new Map(),      // PF/HF records - Approach procedures
                info: {
                    cycle: info.cycle,
                    effectiveDate: info.effectiveDate,
                    expiryDate: this._calculateExpiry(info.effectiveDate),
                    recordTypes: this._recordTypesToLoad
                }
            };

            let recordCount = 0;
            let parsedCount = 0;
            const sectionCodeCounts = new Map(); // Track section code distribution
            const procedureSubsectionCounts = new Map(); // Track P subsection codes (D/E/F)

            for (const line of lines) {
                if (line.length < 132) continue; // ARINC 424 is 132 bytes fixed-width

                recordCount++;

                const sectionCode = line.substring(4, 6).trim();

                // Track section code distribution for debugging
                sectionCodeCounts.set(sectionCode, (sectionCodeCounts.get(sectionCode) || 0) + 1);

                // Track procedure subsections (P records)
                if (sectionCode === 'P') {
                    const subsectionCode = line.substring(12, 13);
                    procedureSubsectionCounts.set(subsectionCode, (procedureSubsectionCounts.get(subsectionCode) || 0) + 1);
                }

                // Only parse record types we care about
                if (!this._recordTypesToLoad.includes(sectionCode)) {
                    continue;
                }

                parsedCount++;

                try {
                    switch (sectionCode) {
                        case 'AS':
                            this._parseMORARecord(line, data.moraGrid);
                            break;
                        case 'UC':
                            this._parseControlledAirspace(line, data.airspaces);
                            break;
                        case 'UR':
                            this._parseSpecialUseAirspace(line, data.suaAirspaces);
                            break;
                        case 'ER':
                            this._parseAirway(line, data.airways);
                            break;
                        case 'P':
                            // Procedures - check subsection code to determine type
                            const subsectionCode = line.substring(12, 13); // Position 13 (0-indexed 12)
                            if (subsectionCode === 'D') {
                                this._parseSID(line, data.sids);
                            } else if (subsectionCode === 'E') {
                                this._parseSTAR(line, data.stars);
                            } else if (subsectionCode === 'F') {
                                this._parseApproach(line, data.approaches);
                            }
                            break;
                    }
                } catch (error) {
                    console.warn(`[CIFPSource] Failed to parse ${sectionCode} record:`, error.message);
                }
            }

            console.log(`[CIFPSource] Parsed ${parsedCount.toLocaleString()} of ${recordCount.toLocaleString()} records`);

            // Log section code distribution for debugging
            console.log('[CIFPSource] Section code distribution:',
                Array.from(sectionCodeCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 15)
                    .map(([code, count]) => `${code}:${count}`)
                    .join(', ')
            );

            // Log procedure subsection distribution (D=SID, E=STAR, F=Approach)
            console.log('[CIFPSource] Procedure subsections (P records):',
                Array.from(procedureSubsectionCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([code, count]) => `${code}:${count}`)
                    .join(', ')
            );

            console.log(`[CIFPSource] MORA: ${data.moraGrid.size}, Airspace: ${data.airspaces.size}, SUA: ${data.suaAirspaces.size}`);
            console.log(`[CIFPSource] Airways: ${data.airways.size}, SIDs: ${data.sids.size}, STARs: ${data.stars.size}, Approaches: ${data.approaches.size}`);

            // Post-process airways: sort by sequence and simplify to fix identifiers only
            this._postProcessAirways(data.airways);

            return data;
        }

        /**
         * Post-process airways: sort by sequence number and convert to simple fix array
         * Compatible with NASR airway format: { id, fixes: ['FIX1', 'FIX2', ...] }
         * @private
         */
        _postProcessAirways(airways) {
            for (const [airwayId, airway] of airways.entries()) {
                // Sort waypoints by sequence number
                airway.fixes.sort((a, b) => a.seqNum - b.seqNum);

                // Convert to simple array of fix identifiers (compatible with NASR format)
                airway.fixes = airway.fixes.map(f => f.ident);

                console.log(`[CIFPSource] Airway ${airwayId}: ${airway.fixes.length} fixes`);
            }
        }

        /**
         * Validate parsed CIFP data
         * @param {Object} data - Parsed data
         * @returns {Promise<boolean>} True if valid
         */
        async validate(data) {
            // At least one dataset should have data
            return data.moraGrid.size > 0 ||
                   data.airspaces.size > 0 ||
                   data.approaches.size > 0;
        }

        /**
         * Parse Grid MORA record (AS - Section 4.1.24)
         * Format: 1-degree grid, 100-foot increments
         * @private
         */
        _parseMORARecord(line, moraGrid) {
            // AS record format (ARINC 424-18 section 4.1.24)
            const lat = this._parseLatitude(line.substring(32, 41));   // Lat (5.36)
            const lon = this._parseLongitude(line.substring(41, 51));  // Lon (5.37)
            const mora = parseInt(line.substring(66, 71));             // MORA (5.119) in feet

            if (isNaN(lat) || isNaN(lon) || isNaN(mora)) return;

            // Grid key is SW corner (1-degree grid)
            const gridLat = Math.floor(lat);
            const gridLon = Math.floor(lon);
            const key = `${gridLat},${gridLon}`;

            moraGrid.set(key, {
                lat: gridLat,
                lon: gridLon,
                mora,
                source: 'cifp'
            });
        }

        /**
         * Parse Controlled Airspace record (UC - Section 4.1.23.1)
         * @private
         */
        _parseControlledAirspace(line, airspaces) {
            const icao = line.substring(6, 10).trim();                 // ICAO (5.14)
            const airspaceType = line.substring(10, 11);               // Type (5.128)
            const airspaceCenter = line.substring(11, 16).trim();      // Center (5.214)
            const sectionCode = line.substring(16, 17);                // Multi CD (5.130)
            const seqNum = parseInt(line.substring(38, 42));           // Seq (5.12)

            // Boundary definition
            const boundaryCode = line.substring(18, 19);               // Boundary (5.118)
            const lat = this._parseLatitude(line.substring(32, 41));
            const lon = this._parseLongitude(line.substring(41, 51));

            // Altitude limits (5.121)
            const lowerLimit = line.substring(81, 86).trim();
            const lowerUnit = line.substring(86, 87);
            const upperLimit = line.substring(87, 92).trim();
            const upperUnit = line.substring(92, 93);

            const key = `${icao}_${airspaceType}_${seqNum}`;

            if (!airspaces.has(key)) {
                airspaces.set(key, {
                    icao,
                    type: airspaceType, // 'C', 'D', 'R', etc.
                    center: airspaceCenter,
                    lowerLimit,
                    lowerUnit,
                    upperLimit,
                    upperUnit,
                    boundary: []
                });
            }

            // Add boundary point
            if (!isNaN(lat) && !isNaN(lon)) {
                airspaces.get(key).boundary.push({
                    lat,
                    lon,
                    boundaryCode, // 'C' = circle, 'G' = great circle, 'H' = rhumb, 'L' = arc
                    seqNum
                });
            }
        }

        /**
         * Parse Special Use Airspace record (UR - Section 4.1.23.2)
         * @private
         */
        _parseSpecialUseAirspace(line, suaAirspaces) {
            const designation = line.substring(6, 16).trim();          // Designation (5.129)
            const type = line.substring(16, 17);                       // Type (5.128)
            const seqNum = parseInt(line.substring(38, 42));

            const boundaryCode = line.substring(18, 19);
            const lat = this._parseLatitude(line.substring(32, 41));
            const lon = this._parseLongitude(line.substring(41, 51));

            // Time code (5.131)
            const timeCode = line.substring(94, 95); // 'C' = continuous, blank = part-time

            const key = `${designation}_${type}`;

            if (!suaAirspaces.has(key)) {
                suaAirspaces.set(key, {
                    designation,
                    type, // 'A' = Alert, 'M' = MOA, 'P' = Prohibited, 'R' = Restricted, 'W' = Warning
                    timeCode,
                    boundary: []
                });
            }

            if (!isNaN(lat) && !isNaN(lon)) {
                suaAirspaces.get(key).boundary.push({
                    lat,
                    lon,
                    boundaryCode,
                    seqNum
                });
            }
        }

        /**
         * Parse Airway record (ER - Section 4.1.17)
         * @private
         */
        _parseAirway(line, airways) {
            const airwayIdent = line.substring(13, 18).trim();     // Route identifier (5.8)
            const seqNum = parseInt(line.substring(26, 29));       // Sequence number (5.12)
            const waypointIdent = line.substring(29, 34).trim();   // Fix identifier (5.13)
            const waypointIcao = line.substring(34, 36).trim();    // ICAO region (5.14)

            if (!airwayIdent || !waypointIdent) return;

            const key = airwayIdent;

            if (!airways.has(key)) {
                airways.set(key, {
                    id: airwayIdent,
                    fixes: []
                });
            }

            // Add waypoint to airway (will be sorted by seqNum later)
            airways.get(key).fixes.push({
                ident: waypointIdent,
                icao: waypointIcao,
                seqNum
            });
        }

        /**
         * Parse SID record (PD - Section 4.1.9)
         * @private
         */
        _parseSID(line, sids) {
            const airport = line.substring(6, 10).trim();
            const sidIdent = line.substring(13, 19).trim();
            const routeType = line.substring(19, 20);
            const transIdent = line.substring(20, 25).trim();
            const seqNum = parseInt(line.substring(26, 29));

            const waypointIdent = line.substring(29, 34).trim();
            const waypointIcao = line.substring(34, 36).trim();
            const pathTerm = line.substring(47, 49).trim();           // Path terminator (5.21)

            const key = `${airport}_${sidIdent}_${transIdent}`;

            if (!sids.has(key)) {
                sids.set(key, {
                    airport,
                    ident: sidIdent,
                    routeType,
                    transition: transIdent,
                    waypoints: []
                });
            }

            sids.get(key).waypoints.push({
                seqNum,
                ident: waypointIdent,
                icao: waypointIcao,
                pathTerminator: pathTerm
            });
        }

        /**
         * Parse STAR record (PE - Section 4.1.10)
         * @private
         */
        _parseSTAR(line, stars) {
            const airport = line.substring(6, 10).trim();
            const starIdent = line.substring(13, 19).trim();
            const routeType = line.substring(19, 20);
            const transIdent = line.substring(20, 25).trim();
            const seqNum = parseInt(line.substring(26, 29));

            const waypointIdent = line.substring(29, 34).trim();
            const waypointIcao = line.substring(34, 36).trim();
            const pathTerm = line.substring(47, 49).trim();

            const key = `${airport}_${starIdent}_${transIdent}`;

            if (!stars.has(key)) {
                stars.set(key, {
                    airport,
                    ident: starIdent,
                    routeType,
                    transition: transIdent,
                    waypoints: []
                });
            }

            stars.get(key).waypoints.push({
                seqNum,
                ident: waypointIdent,
                icao: waypointIcao,
                pathTerminator: pathTerm
            });
        }

        /**
         * Parse Approach record (PF/HF - Section 4.1.11)
         * @private
         */
        _parseApproach(line, approaches) {
            const airport = line.substring(6, 10).trim();
            const apchIdent = line.substring(13, 19).trim();
            const routeType = line.substring(19, 20);
            const runway = line.substring(20, 25).trim();
            const seqNum = parseInt(line.substring(26, 29));

            const waypointIdent = line.substring(29, 34).trim();
            const pathTerm = line.substring(47, 49).trim();

            // Altitude constraints (5.29, 5.30)
            const alt1 = line.substring(84, 89).trim();
            const altDesc = line.substring(82, 83); // '+' = at or above, '-' = at or below

            const key = `${airport}_${apchIdent}_${runway}`;

            if (!approaches.has(key)) {
                approaches.set(key, {
                    airport,
                    ident: apchIdent,
                    routeType,
                    runway,
                    waypoints: []
                });
            }

            approaches.get(key).waypoints.push({
                seqNum,
                ident: waypointIdent,
                pathTerminator: pathTerm,
                altitude: alt1,
                altitudeDescriptor: altDesc
            });
        }

        /**
         * Parse ARINC 424 latitude (9 chars: N47384725)
         * @private
         */
        _parseLatitude(str) {
            if (!str || str.length < 9) return NaN;
            const hemisphere = str[0];
            const degrees = parseInt(str.substring(1, 3));
            const minutes = parseInt(str.substring(3, 5));
            const seconds = parseInt(str.substring(5, 7));
            const hundredths = parseInt(str.substring(7, 9));

            let lat = degrees + (minutes / 60) + ((seconds + hundredths / 100) / 3600);
            if (hemisphere === 'S') lat = -lat;

            return lat;
        }

        /**
         * Parse ARINC 424 longitude (10 chars: W122182910)
         * @private
         */
        _parseLongitude(str) {
            if (!str || str.length < 10) return NaN;
            const hemisphere = str[0];
            const degrees = parseInt(str.substring(1, 4));
            const minutes = parseInt(str.substring(4, 6));
            const seconds = parseInt(str.substring(6, 8));
            const hundredths = parseInt(str.substring(8, 10));

            let lon = degrees + (minutes / 60) + ((seconds + hundredths / 100) / 3600);
            if (hemisphere === 'W') lon = -lon;

            return lon;
        }

        /**
         * Calculate CIFP expiry date (28 days from effective)
         * @private
         */
        _calculateExpiry(effectiveDate) {
            const date = new Date(effectiveDate);
            date.setDate(date.getDate() + CIFP_VALIDITY_DAYS);
            return date.toISOString().split('T')[0];
        }
    }

    // Export to window
    window.CIFPSource = CIFPSource;

})();
