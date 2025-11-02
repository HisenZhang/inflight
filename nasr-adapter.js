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

            const navaid = {
                id: `nasr_nav_${navId}`,
                ident: navId,
                name: values[nameIdx]?.trim() || '',
                type: values[typeIdx]?.trim() || '',
                lat,
                lon,
                elevation: values[elevIdx] ? parseFloat(values[elevIdx]) : null,
                frequency: values[freqIdx] ? parseFloat(values[freqIdx]) : null,
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

            const fix = {
                id: `nasr_fix_${fixId}`,
                ident: fixId,
                name: fixId, // Fixes don't have separate names
                type: values[useIdx]?.trim() || 'FIX',
                lat,
                lon,
                country: values[countryIdx]?.trim() || 'US',
                state: values[stateIdx]?.trim() || '',
                artcc: values[artccLowIdx]?.trim() || values[artccHighIdx]?.trim() || '',
                waypointType: 'fix',
                source: 'nasr'
            };

            fixes.set(fixId, fix);
        } catch (error) {
            continue;
        }
    }

    return fixes;
}

// Parse COM.csv - Communication frequencies
function parseNASRFrequencies(csvText) {
    const lines = csvText.split('\n');
    const headers = parseNASRCSVLine(lines[0]);

    const commLocIdx = headers.indexOf('COMM_LOC_ID');
    const typeIdx = headers.indexOf('COMM_TYPE');
    const nameIdx = headers.indexOf('COMM_OUTLET_NAME');
    const facilityIdIdx = headers.indexOf('FACILITY_ID');

    const frequencies = new Map();

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = parseNASRCSVLine(lines[i]);
            const locId = values[commLocIdx]?.trim().toUpperCase();

            if (!locId) continue;

            const freq = {
                type: values[typeIdx]?.trim() || '',
                description: values[nameIdx]?.trim() || '',
                facility: values[facilityIdIdx]?.trim() || ''
            };

            if (!frequencies.has(locId)) {
                frequencies.set(locId, []);
            }
            frequencies.get(locId).push(freq);
        } catch (error) {
            continue;
        }
    }

    return frequencies;
}

// Load all NASR data
async function loadNASRData(onStatusUpdate) {
    try {
        // Check NASR validity
        onStatusUpdate('[...] CHECKING NASR DATA VALIDITY', 'loading');
        const info = await getNASRInfo();

        if (!info.isValid) {
            throw new Error(`NASR data expired ${Math.abs(info.daysRemaining)} days ago`);
        }

        onStatusUpdate(`[...] NASR DATA VALID (${info.daysRemaining} DAYS REMAINING)`, 'loading');

        // Download files
        onStatusUpdate('[...] DOWNLOADING NASR AIRPORTS', 'loading');
        const airportsCSV = await fetchNASRFile('APT_BASE.csv');

        onStatusUpdate('[...] DOWNLOADING NASR RUNWAYS', 'loading');
        const runwaysCSV = await fetchNASRFile('APT_RWY.csv');

        onStatusUpdate('[...] DOWNLOADING NASR NAVAIDS', 'loading');
        const navaidsCSV = await fetchNASRFile('NAV_BASE.csv');

        onStatusUpdate('[...] DOWNLOADING NASR FIXES', 'loading');
        const fixesCSV = await fetchNASRFile('FIX_BASE.csv');

        onStatusUpdate('[...] DOWNLOADING NASR FREQUENCIES', 'loading');
        const frequenciesCSV = await fetchNASRFile('COM.csv');

        // Parse data
        onStatusUpdate('[...] PARSING NASR DATA', 'loading');
        const airports = parseNASRAirports(airportsCSV);
        const runways = parseNASRRunways(runwaysCSV);
        const navaids = parseNASRNavaids(navaidsCSV);
        const fixes = parseNASRFixes(fixesCSV);
        const frequencies = parseNASRFrequencies(frequenciesCSV);

        onStatusUpdate('[OK] NASR DATA LOADED', 'success');

        return {
            source: 'nasr',
            info,
            data: {
                airports,
                runways,
                navaids,
                fixes,
                frequencies
            },
            rawCSV: {
                airportsCSV,
                runwaysCSV,
                navaidsCSV,
                fixesCSV,
                frequenciesCSV
            }
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
    parseNASRFrequencies
};
