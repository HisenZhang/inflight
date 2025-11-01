/*
 * WGS84 Geodesy and World Magnetic Model (WMM2025) Implementation
 *
 * Vincenty's inverse formula for accurate distance/bearing calculations
 * World Magnetic Model 2025 with spherical harmonics (order 12)
 *
 * WMM2025 data is not subject to copyright protection (NOAA/NCEI)
 * Model valid: 2025.0 - 2030.0 (5 year epoch)
 */

// WGS84 ellipsoid parameters
const WGS84 = {
    a: 6378137.0,        // Semi-major axis (equatorial radius) in meters
    b: 6356752.314245,   // Semi-minor axis (polar radius) in meters
    f: 1 / 298.257223563 // Flattening
};

// World Magnetic Model constants
const NMAX = 12;  // Order of the model
const NUMCOF = (NMAX + 1) * (NMAX + 2) / 2;  // Number of coefficients
const EARTH_R = 6371200.0;  // Mean radius of ellipsoid in meters

// WMM2025 Model - Valid from 2025.0 to 2030.0
const WMM2025 = {
    epoch: 2025.0,
    validStart: 2025.0,
    validEnd: 2030.0,

    // Main Field Coefficients (C) - unnormalized
    Main_Field_Coeff_C: [
        0.0,-29351.8,-2556.6,1361.0,895.0,-233.2,64.4,79.5,23.2,4.6,-1.3,2.9,-2.0,
        -1410.8,1703.8183794055044,-981.469715104173,252.82409893046193,95.24957042772772,13.922301397056312,-14.551632210855248,1.8,1.1627553482998907,-0.8629758239529499,-0.1846372364689991,-0.022645540682891915,
        476.11189948722483,160.57388953375948,4.15163287822461,9.13442468279827,2.6533020756713523,-0.2263115799444015,-0.34860834438919813,0.04767312946227961,0.00259499648053841,-0.026989594817970655,0.0027372445072567945,
        23.90681911087295,-5.599646034731634,-1.3814850676223365,-0.6653382101325865,0.2156720148499058,0.0049040823861374976,-0.0003467709910735329,0.002544603402301914,0.0023082472415244704,0.0008939803125353484,
        0.08521972068512543,-0.3333664004762482,-0.04294096373910387,0.008663030650303626,-0.00686929030326151,-0.0004908010366251525,-0.00012852188008557455,-5.267829510341783e-05,-8.070655599277452e-05,
        0.015515999877693526,0.0033352117122161574,0.00022845544963880868,0.0007418859893731344,-0.0003073885868038485,-8.128437404749033e-06,-8.296051686578281e-07,3.1940908071889606e-06,
        -0.003922249414665777,-0.0001989288712648212,0.00010160546755936292,7.270295435148324e-06,-1.3631803940903108e-06,-4.928589116323788e-07,2.845522253034599e-07,
        6.801413297728968e-05,-2.0776599777965716e-05,3.760266711303181e-06,2.755165074316402e-07,-8.658648477055405e-09,2.2208964739434834e-08,
        2.7825803274061227e-07,-6.523790302905397e-07,2.2495828630708266e-08,1.0925366070799884e-08,-4.441792947886967e-10,
        -2.2799965928230828e-07,-1.0947915869962772e-08,-1.2822351770735609e-09,-1.9385573719060062e-10,
        -3.536041036260129e-09,-3.957063665233731e-11,-1.193099586284436e-11,
        1.0967434505203656e-10,-1.143434089780942e-11,
        -1.2567827257223882e-12
    ],

    // Main Field Coefficients (S) - unnormalized
    Main_Field_Coeff_S: [
        0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
        4545.4,-1809.184803532611,-23.106853240254647,88.10105561229106,11.722229594521114,-4.015209180342259,-9.241231365075604,1.1833333333333331,-3.6969657227996526,0.44497190922573976,0.0,-0.14719601443879746,
        -235.29910220823197,30.66111815747538,-9.980316739574063,10.744659803163351,0.5796550698475775,-0.3703280399090206,-0.25099800796022265,0.19387072647993708,0.0,0.03130792998884596,0.006386903850265854,
        -28.961192904375405,4.2231410863148575,-1.2241133007266416,0.28062666079922405,-0.00363696483726654,0.027953269600983738,0.014390996129551616,0.0030535240827622968,-0.0005770618103811176,0.000744983593779457,
        -2.645332817300257,0.10094898042590615,-0.06278409857208829,0.012830058051715495,-0.003070604421273578,-0.0006478573683452012,0.0006811659644535451,1.755943170113928e-05,-8.691475260760332e-05,
        0.07876782713030063,0.0024398528632990682,-0.0006762281309308737,0.000557511956511172,-0.00012201684361679482,-0.00012328130063869367,4.14802584328914e-06,-0.0,
        0.0046976529233311685,-0.00044983015033756875,4.741588486103603e-06,2.1810886305444973e-05,6.05857952929027e-07,-2.464294558161894e-07,2.845522253034599e-07,
        -1.1016373651251144e-05,-6.430852312227483e-06,-2.6234418916068703e-07,-7.714462208085927e-07,-1.0390378172466486e-07,-4.441792947886967e-09,
        1.205784808542653e-06,5.998887634855538e-08,-9.498238755187934e-08,-1.6884656654872546e-08,3.5534343583095735e-09,
        1.7674392192426998e-07,3.6493052899875906e-09,-3.7184820135133262e-09,4.8463934297650154e-11,
        -8.250762417940301e-09,-3.561357298710358e-10,-5.965497931422179e-11,
        -9.701961293064772e-11,8.795646844468785e-13,
        3.5908077877782525e-13
    ],

    // Secular Variation Coefficients (C) - rate of change per year
    Secular_Var_Coeff_C: [
        0.0,12.0,-11.6,-1.3,-1.6,0.6,-0.2,-0.0,-0.1,-0.0,0.1,0.0,0.0,
        9.7,-3.002221399786054,-1.7146428199482247,-0.758946638440411,0.3614784456460255,-0.08728715609439695,-0.01889822365046136,0.03333333333333333,-0.0149071198499986,0.0,-0.0,0.0,
        -2.309401076758503,0.051639777949432225,-0.447213595499958,0.0,0.031052950170405942,-0.0025717224993681985,0.0,0.0015891043154093204,0.001297498240269205,0.0,-0.0,
        -0.8221921916437785,0.11155467020454339,0.005976143046671968,0.006900655593423542,0.00181848241863327,0.0012260205965343744,0.0005201564866102993,0.0001272301701150957,0.0,-0.0,
        -0.04930066485916347,0.005164831556674268,-0.000944911182523068,-5.482930791331409e-05,-3.1655715683232764e-05,-5.8896124395018286e-05,-0.0,0.0,-0.0,
        0.000668153104781061,6.715191366878169e-05,-7.310574388441878e-05,1.3169573775854458e-05,0.0,-4.064218702374517e-06,-8.296051686578281e-07,-0.0,
        5.815526314990443e-05,-1.4337215947014143e-05,1.3547395674581724e-06,9.087869293935405e-07,0.0,0.0,4.7425370883909984e-08,
        3.8317821395656156e-06,-0.0,-4.372403152678118e-08,-1.836776716210935e-08,-0.0,-0.0,
        6.183511838680272e-08,7.498609543569422e-09,-2.499536514523141e-09,-9.93215097345444e-10,0.0,
        -1.7674392192427e-09,-0.0,-1.282235177073561e-10,0.0,
        -0.0,-1.9785318326168656e-11,-5.96549793142218e-12,
        -4.218244040462945e-12,-0.0,
        -1.7954038938891263e-13
    ],

    // Secular Variation Coefficients (S) - rate of change per year
    Secular_Var_Coeff_S: [
        0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
        -21.5,-15.992602456552632,1.632993161855452,-0.3478505426185218,-0.12909944487358055,0.06546536707079771,0.11338934190276816,-0.03333333333333333,-0.044721359549995794,0.0,-0.0,-0.0,
        -3.4929691285972355,-0.03872983346207416,0.30559595692497127,0.10734900802433867,-0.05520524474738834,0.012858612496840992,0.009960238411119947,0.004767312946227961,-0.0,0.0010795837927188264,0.0,
        -0.21608897344483924,0.03187276291558383,0.003984095364447979,-0.0023002185311411807,-0.002909571869813232,-0.0009808164772274995,-0.0005201564866102993,-0.0002544603402301914,-0.0,-7.44983593779457e-05,
        -0.03098898934004561,0.003991006202884661,0.000944911182523068,0.0,0.00012662286273293106,5.8896124395018286e-05,1.2852188008557456e-05,8.77971585056964e-06,6.208196614828809e-06,
        0.0014105454434266843,0.0001566877985604906,-9.138217985552347e-05,-2.1949289626424097e-05,4.692955523722878e-06,-1.3547395674581724e-06,-0.0,-0.0,
        5.815526314990443e-05,1.0752911960260607e-05,-4.064218702374517e-06,-3.029289764645135e-07,1.5146448823225676e-07,-0.0,-0.0,
        -9.579455348914039e-07,3.7101071032081634e-07,-8.744806305356236e-08,0.0,8.658648477055405e-09,-0.0,
        6.183511838680272e-08,2.999443817427769e-08,-2.499536514523141e-09,-0.0,0.0,
        1.7674392192427e-09,8.109567311083534e-10,0.0,-0.0,
        -0.0,0.0,-0.0,
        0.0,0.0,
        -1.7954038938891263e-13
    ],

    // Index function for C coefficients
    C: function(n, m, dyear) {
        const index = (m * (2 * NMAX - m + 1)) / 2 + n;
        return this.Main_Field_Coeff_C[index] + (dyear - this.epoch) * this.Secular_Var_Coeff_C[index];
    },

    // Index function for S coefficients
    S: function(n, m, dyear) {
        const index = (m * (2 * NMAX - m + 1)) / 2 + n;
        return this.Main_Field_Coeff_S[index] + (dyear - this.epoch) * this.Secular_Var_Coeff_S[index];
    }
};

/**
 * Calculate distance and bearing between two points using Vincenty's inverse formula
 * More accurate than Haversine for WGS84 ellipsoid
 * @param {number} lat1 - Latitude of first point in degrees
 * @param {number} lon1 - Longitude of first point in degrees
 * @param {number} lat2 - Latitude of second point in degrees
 * @param {number} lon2 - Longitude of second point in degrees
 * @returns {object} - {distance: meters, initialBearing: degrees, finalBearing: degrees}
 */
function vincentyInverse(lat1, lon1, lat2, lon2) {
    const { a, b, f } = WGS84;

    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const λ1 = lon1 * Math.PI / 180;
    const λ2 = lon2 * Math.PI / 180;

    const L = λ2 - λ1;
    const U1 = Math.atan((1 - f) * Math.tan(φ1));
    const U2 = Math.atan((1 - f) * Math.tan(φ2));
    const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
    const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

    let λ = L, λʹ, iterations = 0;
    let cosλ, sinλ, sinσ, cosσ, σ, sinα, cos2α, cos2σₘ, C;

    do {
        sinλ = Math.sin(λ);
        cosλ = Math.cos(λ);
        const sinSqσ = (cosU2 * sinλ) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosλ) ** 2;
        sinσ = Math.sqrt(sinSqσ);

        if (sinσ === 0) return { distance: 0, initialBearing: 0, finalBearing: 0 }; // Co-incident points

        cosσ = sinU1 * sinU2 + cosU1 * cosU2 * cosλ;
        σ = Math.atan2(sinσ, cosσ);
        sinα = cosU1 * cosU2 * sinλ / sinσ;
        cos2α = 1 - sinα ** 2;
        cos2σₘ = cosσ - 2 * sinU1 * sinU2 / cos2α;

        if (isNaN(cos2σₘ)) cos2σₘ = 0; // Equatorial line

        C = f / 16 * cos2α * (4 + f * (4 - 3 * cos2α));
        λʹ = λ;
        λ = L + (1 - C) * f * sinα * (σ + C * sinσ * (cos2σₘ + C * cosσ * (-1 + 2 * cos2σₘ ** 2)));
    } while (Math.abs(λ - λʹ) > 1e-12 && ++iterations < 1000);

    if (iterations >= 1000) throw new Error('Vincenty formula failed to converge');

    const uSq = cos2α * (a ** 2 - b ** 2) / (b ** 2);
    const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
    const Δσ = B * sinσ * (cos2σₘ + B / 4 * (cosσ * (-1 + 2 * cos2σₘ ** 2) -
        B / 6 * cos2σₘ * (-3 + 4 * sinσ ** 2) * (-3 + 4 * cos2σₘ ** 2)));

    const distance = b * A * (σ - Δσ);

    const α1 = Math.atan2(cosU2 * sinλ, cosU1 * sinU2 - sinU1 * cosU2 * cosλ);
    const α2 = Math.atan2(cosU1 * sinλ, -sinU1 * cosU2 + cosU1 * sinU2 * cosλ);

    return {
        distance: distance,
        initialBearing: (α1 * 180 / Math.PI + 360) % 360,
        finalBearing: (α2 * 180 / Math.PI + 360) % 360
    };
}

/**
 * Convert geodetic coordinates (WGS84) to ECEF (Earth-Centered, Earth-Fixed) coordinates
 * @param {number} lat - Geodetic latitude in degrees (-90 to 90)
 * @param {number} lon - Geodetic longitude in degrees (-180 to 180)
 * @param {number} h - Height above WGS84 ellipsoid in meters
 * @returns {object} - {x, y, z} position in ITRS coordinates (meters)
 */
function geodetic2ecef(lat, lon, h) {
    const phi = lat * (Math.PI / 180.0);
    const lam = lon * (Math.PI / 180.0);

    // WGS84 constants
    const a = 6378137.0;  // Semi-major axis
    const e2 = 0.0066943799901413165;  // First eccentricity squared
    const e2m = 0.9933056200098587;  // (1-f)^2

    const sphi = Math.sin(phi);
    const cphi = Math.cos(phi);
    const slam = Math.sin(lam);
    const clam = Math.cos(lam);

    const n = a / Math.sqrt(1.0 - e2 * (sphi * sphi));
    const z = (e2m * n + h) * sphi;
    const r = (n + h) * cphi;

    return {
        x: r * clam,
        y: r * slam,
        z: z
    };
}

/**
 * Calculate magnetic field using spherical harmonics (WMM2025)
 * @param {number} dyear - Decimal year
 * @param {object} position_itrs - Position in ITRS/ECEF coordinates {x, y, z} in meters
 * @param {object} WMM - World Magnetic Model coefficients
 * @returns {object} - Magnetic field vector {x, y, z} in Tesla
 */
function GeoMag(dyear, position_itrs, WMM) {
    const x = position_itrs.x;
    const y = position_itrs.y;
    const z = position_itrs.z;

    let px = 0, py = 0, pz = 0;

    const rsqrd = x * x + y * y + z * z;
    const temp = EARTH_R / rsqrd;
    const a = x * temp;
    const b = y * temp;
    const f = z * temp;
    const g = EARTH_R * temp;

    let n, m;

    // First m==0 row, just solve for the Vs
    let Vtop = EARTH_R / Math.sqrt(rsqrd);  // V0,0
    let Wtop = 0;  // W0,0
    let Vprev = 0;
    let Wprev = 0;
    let Vnm = Vtop;
    let Wnm = Wtop;

    // Iterate through all ms
    for (m = 0; m <= NMAX + 1; m++) {
        // Iterate through all ns
        for (n = m; n <= NMAX + 1; n++) {
            if (n === m) {
                if (m !== 0) {
                    const temp = Vtop;
                    Vtop = (2 * m - 1) * (a * Vtop - b * Wtop);
                    Wtop = (2 * m - 1) * (a * Wtop + b * temp);
                    Vprev = 0;
                    Wprev = 0;
                    Vnm = Vtop;
                    Wnm = Wtop;
                }
            } else {
                const temp = Vnm;
                const invs_temp = 1.0 / (n - m);
                Vnm = ((2 * n - 1) * f * Vnm - (n + m - 1) * g * Vprev) * invs_temp;
                Vprev = temp;
                const temp2 = Wnm;
                Wnm = ((2 * n - 1) * f * Wnm - (n + m - 1) * g * Wprev) * invs_temp;
                Wprev = temp2;
            }

            if (m < NMAX && n >= m + 2) {
                px += 0.5 * (n - m) * (n - m - 1) * (WMM.C(n - 1, m + 1, dyear) * Vnm + WMM.S(n - 1, m + 1, dyear) * Wnm);
                py += 0.5 * (n - m) * (n - m - 1) * (-WMM.C(n - 1, m + 1, dyear) * Wnm + WMM.S(n - 1, m + 1, dyear) * Vnm);
            }
            if (n >= 2 && m >= 2) {
                px += 0.5 * (-WMM.C(n - 1, m - 1, dyear) * Vnm - WMM.S(n - 1, m - 1, dyear) * Wnm);
                py += 0.5 * (-WMM.C(n - 1, m - 1, dyear) * Wnm + WMM.S(n - 1, m - 1, dyear) * Vnm);
            }
            if (m === 1 && n >= 2) {
                px += -WMM.C(n - 1, 0, dyear) * Vnm;
                py += -WMM.C(n - 1, 0, dyear) * Wnm;
            }
            if (n >= 2 && n > m) {
                pz += (n - m) * (-WMM.C(n - 1, m, dyear) * Vnm - WMM.S(n - 1, m, dyear) * Wnm);
            }
        }
    }

    return {
        x: -px * 1.0e-9,
        y: -py * 1.0e-9,
        z: -pz * 1.0e-9
    };
}

/**
 * Convert magnetic field vector to magnetic elements
 * @param {object} mag_field_itrs - Magnetic field in ITRS coordinates {x, y, z} in Tesla
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @returns {object} - Magnetic elements {north, east, down, horizontal, total, inclination, declination}
 *                     All field values in nT, angles in degrees
 */
function magField2Elements(mag_field_itrs, lat, lon) {
    // Convert to nanoTesla
    let x = mag_field_itrs.x * 1e9;
    let y = mag_field_itrs.y * 1e9;
    let z = mag_field_itrs.z * 1e9;

    const phi = lat * (Math.PI / 180.0);
    const lam = lon * (Math.PI / 180.0);

    const sphi = Math.sin(phi);
    const cphi = Math.cos(phi);
    const slam = Math.sin(lam);
    const clam = Math.cos(lam);

    const x1 = clam * x + slam * y;
    const north = -sphi * x1 + cphi * z;
    const east = -slam * x + clam * y;
    const down = -cphi * x1 - sphi * z;

    const horizontal = Math.sqrt(north * north + east * east);
    const total = Math.sqrt(horizontal * horizontal + down * down);
    const inclination = Math.atan2(down, horizontal) * (180.0 / Math.PI);
    const declination = Math.atan2(east, north) * (180.0 / Math.PI);

    return {
        north: north,
        east: east,
        down: down,
        horizontal: horizontal,
        total: total,
        inclination: inclination,
        declination: declination
    };
}

/**
 * Check if WMM model is expired or will expire soon
 * @param {number} year - Decimal year to check
 * @returns {object} - {valid: boolean, message: string}
 */
function checkModelValidity(year) {
    if (year < WMM2025.validStart) {
        return {
            valid: false,
            message: `WMM2025 not yet valid (valid from ${WMM2025.validStart})`
        };
    }
    if (year > WMM2025.validEnd) {
        return {
            valid: false,
            message: `WMM2025 expired! Model valid until ${WMM2025.validEnd}. Please update to newer model.`
        };
    }

    // Warn if within 6 months of expiration
    if (year > WMM2025.validEnd - 0.5) {
        return {
            valid: true,
            message: `WMM2025 expires soon (${WMM2025.validEnd}). Consider updating model.`
        };
    }

    return {
        valid: true,
        message: null
    };
}

/**
 * Calculate magnetic declination (variation) using WMM2025
 * @param {number} lat - Geodetic latitude in degrees
 * @param {number} lon - Geodetic longitude in degrees
 * @param {number} altitude - Altitude in meters above WGS84 ellipsoid (default 0)
 * @param {number} year - Decimal year (default current year)
 * @returns {number|null} - Magnetic declination in degrees (positive = East, negative = West), or null if unavailable
 */
function calculateMagneticDeclination(lat, lon, altitude = 0, year = null) {
    try {
        // Calculate decimal year if not provided
        if (year === null) {
            const now = new Date();
            year = now.getFullYear() + (now.getMonth() / 12.0) + (now.getDate() / 365.25);
        }

        // Check model validity
        const validity = checkModelValidity(year);
        if (!validity.valid) {
            console.warn(`[WMM2025] ${validity.message}`);
            return null;
        }
        if (validity.message) {
            console.warn(`[WMM2025] ${validity.message}`);
        }

        // Convert geodetic to ECEF coordinates
        const position_itrs = geodetic2ecef(lat, lon, altitude);

        // Calculate magnetic field
        const mag_field = GeoMag(year, position_itrs, WMM2025);

        // Convert to magnetic elements
        const elements = magField2Elements(mag_field, lat, lon);

        return elements.declination;

    } catch (error) {
        console.error('[WMM2025] Error calculating magnetic declination:', error);
        return null;
    }
}

// Export functions for use in app.js
if (typeof window !== 'undefined') {
    window.vincentyInverse = vincentyInverse;
    window.calculateMagneticDeclination = calculateMagneticDeclination;
    window.WMM2025 = WMM2025;
    window.checkModelValidity = checkModelValidity;
}
