// NASR Adapter Module - Handles FAA NASR data loading and parsing
// NASR data is valid for 30 days from effective date

const NASR_BASE_URL = 'https://nasr.hisenz.com';
const NASR_VALIDITY_DAYS = 30;

// Note: String literals are used directly for waypointType, source, and type properties
// JavaScript engines automatically intern identical strings, providing memory efficiency
// without needing explicit constants (avoids global scope conflicts)

// Parse NASR CSV format (quoted fields)
// Optimized: uses array join instead of string concatenation for 2-3x speed
function parseNASRCSVLine(line) {
    const result = [];
    const currentChars = [];
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(currentChars.join('').trim());
            currentChars.length = 0; // Clear array (faster than = [])
        } else {
            currentChars.push(char);
        }
    }
    result.push(currentChars.join('').trim());
    return result;
}

// Get NASR data info and validity
async function getNASRInfo() {
    try {
        const response = await fetch(`${NASR_BASE_URL}/info`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const info = await response.json();
        const effectiveDate = new Date(info.effectiveDate);
        const expiryDate = new Date(effectiveDate);
        expiryDate.setDate(expiryDate.getDate() + NASR_VALIDITY_DAYS);

        const daysRemaining = Math.floor((expiryDate - Date.now()) / (24 * 60 * 60 * 1000));

        return {
            effectiveDate: info.effectiveDate,
            updated: info.updated,
            filesCount: info.filesCount,
            expiryDate: expiryDate.toISOString(),
            daysRemaining,
            isValid: daysRemaining > 0
        };
    } catch (error) {
        console.error('Error fetching NASR info:', error);
        throw error;
    }
}

// Get total size of all NASR files from /info endpoint
async function getNASRTotalSize() {
    const filesToDownload = [
        'APT_BASE.csv',
        'APT_RWY.csv',
        'NAV_BASE.csv',
        'FIX_BASE.csv',
        'FRQ.csv',
        'AWY_BASE.csv',
        'STAR_RTE.csv',
        'DP_RTE.csv',
        'CLS_ARSP.csv'
    ];

    try {
        console.log('[NASR] Getting total size from /info endpoint...');
        // Get file sizes from info endpoint (HEAD requests don't return Content-Length on Cloudflare)
        const info = await getNASRInfo();
        if (!info || !info.files) {
            console.warn('[NASR] No info or files returned');
            return null;
        }

        console.log(`[NASR] Got info with ${info.files.length} files`);

        // Build a map of filename -> size from info
        const sizeMap = new Map();
        info.files.forEach(file => {
            sizeMap.set(file.name, file.size);
        });

        // Calculate total for files we actually download
        let totalBytes = 0;
        const fileDetails = [];

        for (const filename of filesToDownload) {
            const size = sizeMap.get(filename) || 0;
            totalBytes += size;
            fileDetails.push({
                name: filename,
                bytes: size,
                mb: size ? (size / (1024 * 1024)).toFixed(1) : null
            });
        }

        const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);

        console.log(`[NASR] Total size calculated: ${totalMB}MB for ${filesToDownload.length} files`);

        return {
            totalBytes,
            totalMB,
            files: fileDetails
        };
    } catch (error) {
        console.error('[NASR] Error getting total size:', error);
        return null;
    }
}

// Fetch NASR CSV file
async function fetchNASRFile(filename) {
    const response = await fetch(`${NASR_BASE_URL}/files/${filename}`);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${filename}`);
    return await response.text();
}

// Parse APT_BASE.csv - Airport base data
function parseNASRAirports(csvText) {
    const lines = csvText.split('\n');
    const headers = parseNASRCSVLine(lines[0]);

    const arptIdIdx = headers.indexOf('ARPT_ID');
    const icaoIdIdx = headers.indexOf('ICAO_ID');
    const nameIdx = headers.indexOf('ARPT_NAME');
    const cityIdx = headers.indexOf('CITY');
    const stateIdx = headers.indexOf('STATE_NAME');
    const countryIdx = headers.indexOf('COUNTRY_CODE');
    const latIdx = headers.indexOf('LAT_DECIMAL');
    const lonIdx = headers.indexOf('LONG_DECIMAL');
    const elevIdx = headers.indexOf('ELEV');
    const typeIdx = headers.indexOf('FACILITY_USE_CODE');
    const ownerIdx = headers.indexOf('OWNERSHIP_TYPE_CODE');
    const fuelTypesIdx = headers.indexOf('FUEL_TYPES');

    const airports = new Map();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = parseNASRCSVLine(lines[i]);

            const arptId = values[arptIdIdx]?.trim();
            const icaoId = values[icaoIdIdx]?.trim();
            const lat = parseFloat(values[latIdx]);
            const lon = parseFloat(values[lonIdx]);

            // Use ICAO if available, otherwise FAA LID
            const identifier = icaoId || arptId;

            if (!identifier || isNaN(lat) || isNaN(lon)) continue;

            const fuelTypes = values[fuelTypesIdx]?.trim() || '';

            const airport = {
                id: `nasr_${identifier}`,
                icao: identifier.toUpperCase(),
                type: values[typeIdx] === 'PU' ? 'medium_airport' : 'small_airport',
                name: values[nameIdx]?.trim() || '',
                lat,
                lon,
                elevation: values[elevIdx] ? parseFloat(values[elevIdx]) : null,
                municipality: values[cityIdx]?.trim() || '',
                country: values[countryIdx]?.trim() || 'US',
                fuelTypes: fuelTypes || null,
                waypointType: 'airport',
                source: 'nasr'
            };

            airports.set(identifier.toUpperCase(), airport);
        } catch (error) {
            // Skip malformed lines
            continue;
        }
    }

    return airports;
}

// Parse APT_RWY.csv - Runway data
function parseNASRRunways(csvText) {
    const lines = csvText.split('\n');
    const headers = parseNASRCSVLine(lines[0]);

    const arptIdIdx = headers.indexOf('ARPT_ID');
    const rwyIdIdx = headers.indexOf('RWY_ID');
    const lengthIdx = headers.indexOf('RWY_LEN');
    const widthIdx = headers.indexOf('RWY_WIDTH');
    const surfaceIdx = headers.indexOf('SURFACE_TYPE_CODE');

    const runways = new Map();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = parseNASRCSVLine(lines[i]);
            const arptId = values[arptIdIdx]?.trim().toUpperCase();

            if (!arptId) continue;

            const runway = {
                leIdent: values[rwyIdIdx]?.split('/')[0]?.trim() || '',
                heIdent: values[rwyIdIdx]?.split('/')[1]?.trim() || '',
                length: values[lengthIdx] ? parseInt(values[lengthIdx]) : null,
                width: values[widthIdx] ? parseInt(values[widthIdx]) : null,
                surface: values[surfaceIdx]?.trim() || 'UNK'
            };

            if (!runways.has(arptId)) {
                runways.set(arptId, []);
            }
            runways.get(arptId).push(runway);
        } catch (error) {
            continue;
        }
    }

    return runways;
}

// Parse NAV_BASE.csv - Navaid data
function parseNASRNavaids(csvText) {
    const lines = csvText.split('\n');
    const headers = parseNASRCSVLine(lines[0]);

    const navIdIdx = headers.indexOf('NAV_ID');
    const typeIdx = headers.indexOf('NAV_TYPE');
    const nameIdx = headers.indexOf('NAME');
    const cityIdx = headers.indexOf('CITY');
    const stateIdx = headers.indexOf('STATE_CODE');
    const countryIdx = headers.indexOf('COUNTRY_CODE');
    const latIdx = headers.indexOf('LAT_DECIMAL');
    const lonIdx = headers.indexOf('LONG_DECIMAL');
    const elevIdx = headers.indexOf('ELEV');
    const freqIdx = headers.indexOf('FREQ');

    const navaids = new Map();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = parseNASRCSVLine(lines[i]);
            const navId = values[navIdIdx]?.trim().toUpperCase();
            const lat = parseFloat(values[latIdx]);
            const lon = parseFloat(values[lonIdx]);

            if (!navId || isNaN(lat) || isNaN(lon)) continue;

            const navaidType = values[typeIdx]?.trim() || '';
            let frequency = values[freqIdx] ? parseFloat(values[freqIdx]) : null;

            // Convert VOR/VORTAC/DME frequencies from kHz to MHz
            // NASR stores VOR frequencies in kHz (e.g., 110200 for 110.20 MHz)
            // NDB frequencies are already in kHz and should stay that way
            if (frequency && frequency >= 10000 && navaidType !== 'NDB') {
                frequency = frequency / 1000; // Convert kHz to MHz
            }

            const navaid = {
                id: `nasr_nav_${navId}`,
                ident: navId,
                name: values[nameIdx]?.trim() || '',
                type: navaidType,
                lat,
                lon,
                elevation: values[elevIdx] ? parseFloat(values[elevIdx]) : null,
                frequency: frequency,
                country: values[countryIdx]?.trim() || 'US',
                waypointType: 'navaid',
                source: 'nasr'
            };

            navaids.set(navId, navaid);
        } catch (error) {
            continue;
        }
    }

    return navaids;
}

// Parse FIX_BASE.csv - Waypoint/Fix data
function parseNASRFixes(csvText) {
    const lines = csvText.split('\n');
    const headers = parseNASRCSVLine(lines[0]);

    const fixIdIdx = headers.indexOf('FIX_ID');
    const stateIdx = headers.indexOf('STATE_CODE');
    const countryIdx = headers.indexOf('COUNTRY_CODE');
    const latIdx = headers.indexOf('LAT_DECIMAL');
    const lonIdx = headers.indexOf('LONG_DECIMAL');
    const useIdx = headers.indexOf('FIX_USE_CODE');
    const artccHighIdx = headers.indexOf('ARTCC_ID_HIGH');
    const artccLowIdx = headers.indexOf('ARTCC_ID_LOW');

    const fixes = new Map();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = parseNASRCSVLine(lines[i]);
            const fixId = values[fixIdIdx]?.trim().toUpperCase();
            const lat = parseFloat(values[latIdx]);
            const lon = parseFloat(values[lonIdx]);

            if (!fixId || isNaN(lat) || isNaN(lon)) continue;

            const fixUseCode = values[useIdx]?.trim() || 'FIX';
            const fix = {
                id: `nasr_fix_${fixId}`,
                ident: fixId,
                name: fixId, // Fixes don't have separate names
                type: fixUseCode,
                lat,
                lon,
                country: values[countryIdx]?.trim() || 'US',
                state: values[stateIdx]?.trim() || '',
                artcc: values[artccLowIdx]?.trim() || values[artccHighIdx]?.trim() || '',
                waypointType: 'fix',
                isReportingPoint: fixUseCode === 'RP', // Mark reporting points
                source: 'nasr'
            };

            fixes.set(fixId, fix);
        } catch (error) {
            continue;
        }
    }

    return fixes;
}

// Parse FRQ.csv - Airport frequencies
function parseNASRFrequencies(csvText) {
    const lines = csvText.split('\n');
    const headers = parseNASRCSVLine(lines[0]);

    const facilityIdx = headers.indexOf('SERVICED_FACILITY');
    const freqIdx = headers.indexOf('FREQ');
    const useIdx = headers.indexOf('FREQ_USE');

    const frequencies = new Map();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = parseNASRCSVLine(lines[i]);
            const arptId = values[facilityIdx]?.trim().toUpperCase();
            const freqValue = values[freqIdx]?.trim();

            if (!arptId || !freqValue) continue;

            const freq = {
                type: values[useIdx]?.trim() || 'COMM',
                description: values[useIdx]?.trim() || '',
                frequency: parseFloat(freqValue) // Already in MHz
            };

            if (!frequencies.has(arptId)) {
                frequencies.set(arptId, []);
            }
            frequencies.get(arptId).push(freq);
        } catch (error) {
            continue;
        }
    }

    return frequencies;
}

// Parse AWY_BASE.csv - Airways
function parseNASRAirways(csvText) {
    const lines = csvText.split('\n');
    const headers = parseNASRCSVLine(lines[0]);

    const awyIdIdx = headers.indexOf('AWY_ID');
    const awyStringIdx = headers.indexOf('AIRWAY_STRING');

    const airways = new Map();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = parseNASRCSVLine(lines[i]);
            const awyId = values[awyIdIdx]?.trim().toUpperCase();
            const awyString = values[awyStringIdx]?.trim();

            if (!awyId || !awyString) continue;

            // Parse airway string into array of fixes
            const fixes = awyString.split(/\s+/).filter(f => f.length > 0);

            airways.set(awyId, {
                id: awyId,
                fixes: fixes
            });
        } catch (error) {
            continue;
        }
    }

    return airways;
}

// Parse STAR_RTE.csv - STAR procedures
function parseNASRSTARs(csvText) {
    const lines = csvText.split('\n');
    const headers = parseNASRCSVLine(lines[0]);

    const starCodeIdx = headers.indexOf('STAR_COMPUTER_CODE');
    const routeTypeIdx = headers.indexOf('ROUTE_PORTION_TYPE');
    const routeNameIdx = headers.indexOf('ROUTE_NAME');
    const bodySeqIdx = headers.indexOf('BODY_SEQ');
    const pointSeqIdx = headers.indexOf('POINT_SEQ');
    const pointIdx = headers.indexOf('POINT');

    const stars = new Map();
    const bodyRoutes = new Map(); // BODY portions
    const transitionRoutes = new Map(); // TRANSITION portions

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = parseNASRCSVLine(lines[i]);
            const starCode = values[starCodeIdx]?.trim();
            const routeType = values[routeTypeIdx]?.trim();
            const routeName = values[routeNameIdx]?.trim();
            const bodySeq = values[bodySeqIdx]?.trim();
            const pointSeq = parseInt(values[pointSeqIdx]);
            const point = values[pointIdx]?.trim().toUpperCase();

            if (!starCode || !point || !routeName) continue;
            if (routeType !== 'BODY' && routeType !== 'TRANSITION') continue;

            const key = `${starCode}|${routeType}|${routeName}|${bodySeq}`;

            if (routeType === 'BODY') {
                if (!bodyRoutes.has(key)) {
                    bodyRoutes.set(key, []);
                }
                bodyRoutes.get(key).push({ seq: pointSeq, fix: point });
            } else if (routeType === 'TRANSITION') {
                if (!transitionRoutes.has(key)) {
                    transitionRoutes.set(key, []);
                }
                transitionRoutes.get(key).push({ seq: pointSeq, fix: point });
            }
        } catch (error) {
            continue;
        }
    }

    console.log(`[NASR] Processing ${bodyRoutes.size} STAR body routes, ${transitionRoutes.size} transitions`);

    // Store STARs with their body and transitions
    // Store all route variants, not just the first one
    for (const [key, fixes] of bodyRoutes) {
        const [starCode, routeType, routeName, bodySeq] = key.split('|');

        fixes.sort((a, b) => a.seq - b.seq);
        const fixNames = fixes.map(f => f.fix);
        // REVERSE - NASR stores procedures from endpoint to startpoint
        fixNames.reverse();

        // Collect all transitions for this specific STAR route variant
        const transitions = [];
        for (const [transKey, transFixes] of transitionRoutes) {
            if (transKey.startsWith(`${starCode}|TRANSITION|`)) {
                transFixes.sort((a, b) => a.seq - b.seq);
                const transFixNames = transFixes.map(f => f.fix);
                // REVERSE - NASR stores transitions from endpoint to startpoint
                transFixNames.reverse();

                // After reversal, first fix is the external entry point
                // Strip " TRANSITION" suffix from transition name (e.g., "RAMRD TRANSITION" -> "RAMRD")
                const transName = transKey.split('|')[2].replace(/\s+TRANSITION$/i, '');
                transitions.push({
                    name: transName,
                    entryFix: transFixNames[0],
                    fixes: transFixNames
                });
            }
        }

        // Extract procedure name from STAR_COMPUTER_CODE format: ENTRYFIX.PROCCODE
        // Example: GLAND.BLUMS5 -> entryFix=GLAND, procName=BLUMS5
        const dotPos = starCode.indexOf('.');
        const entryFix = dotPos > 0 ? starCode.substring(0, dotPos) : routeName;
        const procName = dotPos > 0 ? starCode.substring(dotPos + 1) : starCode;

        // Store with standardized structure
        const starData = {
            computerCode: starCode,
            name: procName,
            type: 'STAR',
            body: {
                name: entryFix,
                fixes: fixNames
            },
            transitions: transitions
        };

        // Index by procedure name (e.g., BLUMS5)
        if (!stars.has(procName)) {
            stars.set(procName, starData);
        }

        // Also index by full computer code (e.g., GLAND.BLUMS5)
        if (!stars.has(starCode)) {
            stars.set(starCode, starData);
        }
    }

    return stars;
}

// Parse DP_RTE.csv - Departure procedures
function parseNASRDPs(csvText) {
    const lines = csvText.split('\n');
    const headers = parseNASRCSVLine(lines[0]);

    const dpCodeIdx = headers.indexOf('DP_COMPUTER_CODE');
    const routeTypeIdx = headers.indexOf('ROUTE_PORTION_TYPE');
    const routeNameIdx = headers.indexOf('ROUTE_NAME');
    const bodySeqIdx = headers.indexOf('BODY_SEQ');
    const pointSeqIdx = headers.indexOf('POINT_SEQ');
    const pointIdx = headers.indexOf('POINT');

    const dps = new Map();
    const bodyRoutes = new Map(); // BODY portions
    const transitionRoutes = new Map(); // TRANSITION portions

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = parseNASRCSVLine(lines[i]);
            const dpCode = values[dpCodeIdx]?.trim();
            const routeType = values[routeTypeIdx]?.trim();
            const routeName = values[routeNameIdx]?.trim();
            const bodySeq = values[bodySeqIdx]?.trim();
            const pointSeq = parseInt(values[pointSeqIdx]);
            const point = values[pointIdx]?.trim().toUpperCase();

            if (!dpCode || !point || !routeName) continue;
            if (routeType !== 'BODY' && routeType !== 'TRANSITION') continue;

            const key = `${dpCode}|${routeType}|${routeName}|${bodySeq}`;

            if (routeType === 'BODY') {
                if (!bodyRoutes.has(key)) {
                    bodyRoutes.set(key, []);
                }
                bodyRoutes.get(key).push({ seq: pointSeq, fix: point });
            } else if (routeType === 'TRANSITION') {
                if (!transitionRoutes.has(key)) {
                    transitionRoutes.set(key, []);
                }
                transitionRoutes.get(key).push({ seq: pointSeq, fix: point });
            }
        } catch (error) {
            continue;
        }
    }

    console.log(`[NASR] Processing ${bodyRoutes.size} DP body routes, ${transitionRoutes.size} transitions`);

    // Store DPs with their body and transitions using standardized structure
    // DP_COMPUTER_CODE format: PROCCODE.EXITFIX (e.g., HIDEY1.HIDEY)
    for (const [key, fixes] of bodyRoutes) {
        const [dpCode, routeType, routeName, bodySeq] = key.split('|');

        fixes.sort((a, b) => a.seq - b.seq);
        const fixNames = fixes.map(f => f.fix);
        // REVERSE - NASR stores DPs from endpoint (runway) to startpoint (entry fix)
        fixNames.reverse();

        // Extract procedure name from DP_COMPUTER_CODE format: PROCCODE.EXITFIX
        // Example: HIDEY1.HIDEY -> procName=HIDEY1, exitFix=HIDEY
        const dotPos = dpCode.indexOf('.');
        const procName = dotPos > 0 ? dpCode.substring(0, dotPos) : dpCode;
        const exitFix = dotPos > 0 ? dpCode.substring(dotPos + 1) : routeName;

        // Collect all transitions for this DP
        const transitions = [];
        for (const [transKey, transFixes] of transitionRoutes) {
            if (transKey.startsWith(`${dpCode}|TRANSITION|`)) {
                transFixes.sort((a, b) => a.seq - b.seq);
                const transFixNames = transFixes.map(f => f.fix);
                // REVERSE - NASR stores transitions from endpoint to startpoint
                transFixNames.reverse();

                // After reversal, first fix is the external entry point
                // Strip " TRANSITION" suffix from transition name (e.g., "RAMRD TRANSITION" -> "RAMRD")
                const transName = transKey.split('|')[2].replace(/\s+TRANSITION$/i, '');
                transitions.push({
                    name: transName,
                    entryFix: transFixNames[0],
                    fixes: transFixNames
                });
            }
        }

        // Store with standardized structure
        const dpData = {
            computerCode: dpCode,
            name: procName,
            type: 'DP',
            body: {
                name: exitFix,
                fixes: fixNames
            },
            transitions: transitions
        };

        // Index by procedure name (e.g., HIDEY1)
        if (!dps.has(procName)) {
            dps.set(procName, dpData);
        }

        // Also index by full computer code (e.g., HIDEY1.HIDEY)
        if (!dps.has(dpCode)) {
            dps.set(dpCode, dpData);
        }
    }

    return dps;
}

// Parse CLS_ARSP.csv - Class Airspace data
function parseNASRAirspaceClass(csvText) {
    const lines = csvText.split('\n');
    const headers = parseNASRCSVLine(lines[0]);

    const arptIdIdx = headers.indexOf('ARPT_ID');
    const classBIdx = headers.indexOf('CLASS_B_AIRSPACE');
    const classCIdx = headers.indexOf('CLASS_C_AIRSPACE');
    const classDIdx = headers.indexOf('CLASS_D_AIRSPACE');
    const classEIdx = headers.indexOf('CLASS_E_AIRSPACE');
    const airspaceHrsIdx = headers.indexOf('AIRSPACE_HRS');

    const airspaceData = new Map();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = parseNASRCSVLine(lines[i]);
            const arptId = values[arptIdIdx]?.trim().toUpperCase();

            if (!arptId) continue;

            // Determine airspace class (priority: B > C > D > E)
            let airspaceClass = null;
            if (values[classBIdx] === 'Y') {
                airspaceClass = 'B';
            } else if (values[classCIdx] === 'Y') {
                airspaceClass = 'C';
            } else if (values[classDIdx] === 'Y') {
                airspaceClass = 'D';
            } else if (values[classEIdx] === 'Y') {
                airspaceClass = 'E';
            }

            if (airspaceClass) {
                const airspaceHrs = values[airspaceHrsIdx]?.trim() || null;
                airspaceData.set(arptId, {
                    arptId: arptId,
                    class: airspaceClass,
                    hours: airspaceHrs
                });
            }
        } catch (error) {
            console.warn(`Error parsing CLS_ARSP line ${i}:`, error);
        }
    }

    console.log(`[NASRAdapter] Parsed ${airspaceData.size} airspace class records`);
    return airspaceData;
}

// Load all NASR data with individual file tracking
async function loadNASRData(onStatusUpdate, onFileLoaded) {
    try {
        const fileMetadata = new Map();

        // Check NASR validity
        onStatusUpdate('[...] CHECKING NASR DATA VALIDITY', 'loading');
        const info = await getNASRInfo();

        if (!info.isValid) {
            throw new Error(`NASR data expired ${Math.abs(info.daysRemaining)} days ago`);
        }

        onStatusUpdate(`[...] NASR DATA VALID (${info.daysRemaining} DAYS REMAINING)`, 'loading');

        // Define files to download
        const filesToDownload = [
            { id: 'nasr_airports', filename: 'APT_BASE.csv', label: 'AIRPORTS', parser: parseNASRAirports },
            { id: 'nasr_runways', filename: 'APT_RWY.csv', label: 'RUNWAYS', parser: parseNASRRunways },
            { id: 'nasr_navaids', filename: 'NAV_BASE.csv', label: 'NAVAIDS', parser: parseNASRNavaids },
            { id: 'nasr_fixes', filename: 'FIX_BASE.csv', label: 'FIXES', parser: parseNASRFixes },
            { id: 'nasr_frequencies', filename: 'FRQ.csv', label: 'FREQUENCIES', parser: parseNASRFrequencies },
            { id: 'nasr_airways', filename: 'AWY_BASE.csv', label: 'AIRWAYS', parser: parseNASRAirways },
            { id: 'nasr_stars', filename: 'STAR_RTE.csv', label: 'STARs', parser: parseNASRSTARs },
            { id: 'nasr_dps', filename: 'DP_RTE.csv', label: 'DPs', parser: parseNASRDPs },
            { id: 'nasr_airspace', filename: 'CLS_ARSP.csv', label: 'AIRSPACE', parser: parseNASRAirspaceClass }
        ];

        const parsedData = {};
        const rawCSV = {};

        // Download and parse all files in parallel
        onStatusUpdate('[...] DOWNLOADING NASR FILES IN PARALLEL', 'loading');

        const downloadPromises = filesToDownload.map(async (fileInfo) => {
            const startTime = Date.now();
            const csvData = await fetchNASRFile(fileInfo.filename);
            const downloadTime = Date.now() - startTime;

            const parseStartTime = Date.now();
            const parsed = fileInfo.parser(csvData);
            const parseTime = Date.now() - parseStartTime;

            return { fileInfo, csvData, parsed, downloadTime, parseTime };
        });

        const results = await Promise.all(downloadPromises);

        // Process results and build metadata
        for (const result of results) {
            const dataKey = result.fileInfo.id.replace('nasr_', '');
            parsedData[dataKey] = result.parsed;
            rawCSV[`${result.fileInfo.id}CSV`] = result.csvData;  // Use full ID to avoid collision with OurAirports

            // Track file metadata
            const metadata = {
                id: result.fileInfo.id,
                filename: result.fileInfo.filename,
                label: result.fileInfo.label,
                timestamp: Date.now(),
                downloadTime: result.downloadTime,
                parseTime: result.parseTime,
                recordCount: result.parsed.size || 0,
                sizeBytes: result.csvData.length,
                source: 'NASR'
            };

            fileMetadata.set(result.fileInfo.id, metadata);

            // Notify about file completion
            if (onFileLoaded) {
                onFileLoaded(metadata);
            }

            onStatusUpdate(`[OK] NASR ${result.fileInfo.label} (${metadata.recordCount} RECORDS)`, 'success');
        }

        onStatusUpdate('[OK] NASR DATA LOADED', 'success');

        return {
            source: 'nasr',
            info,
            data: parsedData,
            rawCSV,
            fileMetadata
        };
    } catch (error) {
        console.error('NASR loading error:', error);
        throw error;
    }
}

// Export
window.NASRAdapter = {
    loadNASRData,
    getNASRInfo,
    getNASRTotalSize,
    parseNASRAirports,
    parseNASRRunways,
    parseNASRNavaids,
    parseNASRFixes,
    parseNASRFrequencies,
    parseNASRAirways,
    parseNASRSTARs,
    parseNASRDPs,
    parseNASRAirspaceClass
};
