// Test Suite: CIFP Parser (ARINC 424-18)
// Tests CIFP data source and ARINC 424 record parsing

TestFramework.describe('CIFP Data Source', function({ it, beforeEach }) {
    let cifpSource;

    beforeEach(() => {
        cifpSource = new window.CIFPSource();
    });

    // ============================================
    // ARINC 424 Coordinate Parsing
    // ============================================

    it('should parse ARINC 424 latitude format correctly', () => {
        // N47384725 = N 47° 38' 47.25"
        const testLat = 'N47384725';
        const parsed = cifpSource._parseLatitude(testLat);
        const expected = 47 + (38/60) + (47.25/3600);

        assert.isTrue(
            Math.abs(parsed - expected) < 0.0001,
            `Expected ~${expected}, got ${parsed}`
        );
    });

    it('should parse ARINC 424 south latitude correctly', () => {
        // S33565420 = S 33° 56' 54.20"
        const testLat = 'S33565420';
        const parsed = cifpSource._parseLatitude(testLat);
        const expected = -(33 + (56/60) + (54.20/3600));

        assert.isTrue(
            Math.abs(parsed - expected) < 0.0001,
            `Expected ~${expected}, got ${parsed}`
        );
    });

    it('should parse ARINC 424 longitude format correctly', () => {
        // W122182910 = W 122° 18' 29.10"
        const testLon = 'W122182910';
        const parsed = cifpSource._parseLongitude(testLon);
        const expected = -(122 + (18/60) + (29.10/3600));

        assert.isTrue(
            Math.abs(parsed - expected) < 0.0001,
            `Expected ~${expected}, got ${parsed}`
        );
    });

    it('should parse ARINC 424 east longitude correctly', () => {
        // E004330000 = E 004° 33' 00.00"
        const testLon = 'E004330000';
        const parsed = cifpSource._parseLongitude(testLon);
        const expected = 4 + (33/60);

        assert.isTrue(
            Math.abs(parsed - expected) < 0.0001,
            `Expected ~${expected}, got ${parsed}`
        );
    });

    // ============================================
    // MORA Record Parsing (AS)
    // ============================================

    it('should parse Grid MORA record (AS) correctly', () => {
        // Sample AS record from CIFP (Grid MORA)
        // This is a simplified test record with key fields populated
        const moraGrid = new Map();
        const testRecord = 'SUSAAS                          N49000000W124000000                      05700                                        ';

        cifpSource._parseMORARecord(testRecord, moraGrid);

        const key = '49,-124'; // SW corner of 1° grid
        assert.isTrue(moraGrid.has(key), 'MORA grid should have entry for 49,-124');

        const mora = moraGrid.get(key);
        assert.equals(mora.lat, 49, 'MORA latitude should be 49');
        assert.equals(mora.lon, -124, 'MORA longitude should be -124');
        assert.equals(mora.mora, 5700, 'MORA should be 5700 feet');
        assert.equals(mora.source, 'cifp', 'MORA source should be cifp');
    });

    // ============================================
    // Controlled Airspace Parsing (UC)
    // ============================================

    it('should parse controlled airspace record (UC) correctly', () => {
        const airspaces = new Map();
        // Sample UC record (Class C airspace boundary point)
        const testRecord = 'SUSAUCKSEA C SEA  1                  N47384720W122182900                                                                    ';

        cifpSource._parseControlledAirspace(testRecord, airspaces);

        // Check that airspace was created
        const keys = Array.from(airspaces.keys());
        assert.isTrue(keys.length > 0, 'Should create at least one airspace entry');

        const airspace = airspaces.get(keys[0]);
        assert.equals(airspace.icao, 'KSEA', 'ICAO should be KSEA');
        assert.equals(airspace.type, 'C', 'Type should be Class C');
        assert.isTrue(airspace.boundary.length > 0, 'Should have boundary points');
    });

    // ============================================
    // Special Use Airspace Parsing (UR)
    // ============================================

    it('should parse special use airspace record (UR) correctly', () => {
        const suaAirspaces = new Map();
        // Sample UR record (Restricted area)
        const testRecord = 'SUSAURR-2501  R                   N47300000W122500000                                                                    ';

        cifpSource._parseSpecialUseAirspace(testRecord, suaAirspaces);

        const keys = Array.from(suaAirspaces.keys());
        assert.isTrue(keys.length > 0, 'Should create at least one SUA entry');

        const sua = suaAirspaces.get(keys[0]);
        assert.isTrue(sua.designation.includes('R-2501'), 'Designation should include R-2501');
        assert.equals(sua.type, 'R', 'Type should be Restricted');
    });

    // ============================================
    // Airway Record Parsing (ER)
    // ============================================

    it('should parse airway record (ER) correctly', () => {
        const airways = new Map();
        // Sample ER records (airway waypoints)
        const testRecords = [
            'SUSAER    V23              010OAKLAEA                 TF                                                             ',
            'SUSAER    V23              020SJCVREA                 TF                                                             ',
            'SUSAER    V23              030MODEAEA                 TF                                                             '
        ];

        testRecords.forEach(record => {
            cifpSource._parseAirway(record, airways);
        });

        assert.isTrue(airways.has('V23'), 'Should create airway V23');

        const airway = airways.get('V23');
        assert.equals(airway.id, 'V23', 'Airway ID should be V23');
        assert.equals(airway.fixes.length, 3, 'Should have 3 waypoints');

        // Post-process to sort and simplify
        cifpSource._postProcessAirways(airways);

        assert.equals(airway.fixes[0], 'OAKLA', 'First fix should be OAKLA');
        assert.equals(airway.fixes[1], 'SJCVR', 'Second fix should be SJCVR');
        assert.equals(airway.fixes[2], 'MODEA', 'Third fix should be MODEA');
    });

    // ============================================
    // SID Record Parsing (PD)
    // ============================================

    it('should parse SID record (PD) correctly', () => {
        const sids = new Map();
        // Sample PD record (SID waypoint)
        const testRecord = 'SUSAPDKSEA   HAROB3            010HAROB EA                 IF                                                             ';

        cifpSource._parseSID(testRecord, sids);

        const keys = Array.from(sids.keys());
        assert.isTrue(keys.length > 0, 'Should create at least one SID entry');

        const sid = sids.get(keys[0]);
        assert.equals(sid.airport, 'KSEA', 'Airport should be KSEA');
        assert.isTrue(sid.ident.includes('HAROB'), 'SID ident should include HAROB');
        assert.isTrue(sid.waypoints.length > 0, 'Should have waypoints');
        assert.equals(sid.waypoints[0].ident, 'HAROB', 'First waypoint should be HAROB');
        assert.equals(sid.waypoints[0].pathTerminator, 'IF', 'Path terminator should be IF');
    });

    // ============================================
    // STAR Record Parsing (PE)
    // ============================================

    it('should parse STAR record (PE) correctly', () => {
        const stars = new Map();
        // Sample PE record (STAR waypoint)
        const testRecord = 'SUSAPEKLAD   LENDY4            010LENDYEA                 TF                                                             ';

        cifpSource._parseSTAR(testRecord, stars);

        const keys = Array.from(stars.keys());
        assert.isTrue(keys.length > 0, 'Should create at least one STAR entry');

        const star = stars.get(keys[0]);
        assert.equals(star.airport, 'KLAD', 'Airport should be KLAD');
        assert.isTrue(star.ident.includes('LENDY'), 'STAR ident should include LENDY');
        assert.isTrue(star.waypoints.length > 0, 'Should have waypoints');
    });

    // ============================================
    // Approach Record Parsing (PF)
    // ============================================

    it('should parse approach record (PF) correctly', () => {
        const approaches = new Map();
        // Sample PF record (ILS approach waypoint)
        const testRecord = 'SUSAPFKSEA   D16I  RW16L       010ISEATHA                 CF                  10000                                     ';

        cifpSource._parseApproach(testRecord, approaches);

        const keys = Array.from(approaches.keys());
        assert.isTrue(keys.length > 0, 'Should create at least one approach entry');

        const apch = approaches.get(keys[0]);
        assert.equals(apch.airport, 'KSEA', 'Airport should be KSEA');
        assert.isTrue(apch.runway.includes('16L'), 'Runway should include 16L');
        assert.isTrue(apch.waypoints.length > 0, 'Should have waypoints');
    });

    // ============================================
    // Data Validation
    // ============================================

    it('should validate parsed data correctly', async () => {
        const validData = {
            moraGrid: new Map([['49,-124', { mora: 5700 }]]),
            airspaces: new Map(),
            suaAirspaces: new Map(),
            sids: new Map(),
            stars: new Map(),
            approaches: new Map()
        };

        const isValid = await cifpSource.validate(validData);
        assert.isTrue(isValid, 'Should validate data with MORA entries');
    });

    it('should reject empty data', async () => {
        const emptyData = {
            moraGrid: new Map(),
            airspaces: new Map(),
            suaAirspaces: new Map(),
            sids: new Map(),
            stars: new Map(),
            approaches: new Map()
        };

        const isValid = await cifpSource.validate(emptyData);
        assert.isFalse(isValid, 'Should reject completely empty data');
    });

    // ============================================
    // Expiry Date Calculation
    // ============================================

    it('should calculate CIFP expiry date correctly (28 days)', () => {
        const effectiveDate = '2025-12-25';
        const expiry = cifpSource._calculateExpiry(effectiveDate);

        assert.equals(expiry, '2026-01-22', 'Expiry should be 28 days after effective date');
    });
});

console.log('[test-cifp-parser] CIFP parser tests loaded');
