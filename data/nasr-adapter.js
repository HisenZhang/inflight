// NASR Adapter Module - Handles FAA NASR data loading and parsing
// NASR data is valid for 30 days from effective date

const NASR_BASE_URL = 'https://nasr.hisenz.com';
const NASR_VALIDITY_DAYS = 30;

// Parse NASR CSV format (quoted fields)
function parseNASRCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result.map(val => val.trim());
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
    for (const [key, fixes] of bodyRoutes) {
        const [starCode, routeType, routeName, bodySeq] = key.split('|');

        // Only use the first BODY route per STAR
        if (!stars.has(starCode)) {
            fixes.sort((a, b) => a.seq - b.seq);
            const fixNames = fixes.map(f => f.fix);
            // REVERSE - NASR stores procedures from endpoint to startpoint
            fixNames.reverse();

            // Collect all transitions for this STAR
            const transitions = [];
            for (const [transKey, transFixes] of transitionRoutes) {
                if (transKey.startsWith(`${starCode}|TRANSITION|`)) {
                    transFixes.sort((a, b) => a.seq - b.seq);
                    const transFixNames = transFixes.map(f => f.fix);
                    // REVERSE - NASR stores transitions from endpoint to startpoint
                    transFixNames.reverse();

                    // After reversal, first fix is the external entry point
                    transitions.push({
                        name: transKey.split('|')[2],
                        entryFix: transFixNames[0],
                        fixes: transFixNames
                    });
                }
            }

            stars.set(starCode, {
                body: fixNames,
                transitions: transitions
            });
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
    const bodyRoutes = new Map();

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

            if (!dpCode || routeType !== 'BODY' || !point || !routeName) continue;

            // Key by DP_CODE, ROUTE_NAME, and BODY_SEQ (same as STARs)
            const key = `${dpCode}|${routeType}|${routeName}|${bodySeq}`;

            if (!bodyRoutes.has(key)) {
                bodyRoutes.set(key, []);
            }

            bodyRoutes.get(key).push({ seq: pointSeq, fix: point });
        } catch (error) {
            continue;
        }
    }

    // Pick the first transition for each DP
    for (const [key, fixes] of bodyRoutes) {
        const [dpCode] = key.split('|');

        // Only use the first route per DP
        if (!dps.has(dpCode)) {
            fixes.sort((a, b) => a.seq - b.seq);
            const fixNames = fixes.map(f => f.fix);

            dps.set(dpCode, fixNames);
        }
    }

    return dps;
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
            { id: 'nasr_dps', filename: 'DP_RTE.csv', label: 'DPs', parser: parseNASRDPs }
        ];

        const parsedData = {};
        const rawCSV = {};

        // Download and parse each file individually
        for (const fileInfo of filesToDownload) {
            const startTime = Date.now();
            onStatusUpdate(`[...] DOWNLOADING NASR ${fileInfo.label}`, 'loading');

            const csvData = await fetchNASRFile(fileInfo.filename);
            const downloadTime = Date.now() - startTime;

            onStatusUpdate(`[...] PARSING NASR ${fileInfo.label}`, 'loading');
            const parseStartTime = Date.now();
            const parsed = fileInfo.parser(csvData);
            const parseTime = Date.now() - parseStartTime;

            // Store parsed data
            const dataKey = fileInfo.id.replace('nasr_', '');
            parsedData[dataKey] = parsed;
            rawCSV[`${dataKey}CSV`] = csvData;

            // Track file metadata
            const metadata = {
                id: fileInfo.id,
                filename: fileInfo.filename,
                label: fileInfo.label,
                timestamp: Date.now(),
                downloadTime,
                parseTime,
                recordCount: parsed.size || 0,
                sizeBytes: csvData.length,
                source: 'NASR'
            };

            fileMetadata.set(fileInfo.id, metadata);

            // Notify about file completion
            if (onFileLoaded) {
                onFileLoaded(metadata);
            }

            onStatusUpdate(`[OK] NASR ${fileInfo.label} (${metadata.recordCount} RECORDS)`, 'success');
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
    parseNASRAirports,
    parseNASRRunways,
    parseNASRNavaids,
    parseNASRFixes,
    parseNASRFrequencies,
    parseNASRAirways,
    parseNASRSTARs,
    parseNASRDPs
};
