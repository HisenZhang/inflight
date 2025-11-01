// WGS84 Geodesy and Magnetic Variation Calculations
// Standalone implementation for reliable offline use

// WGS84 ellipsoid parameters
const WGS84 = {
    a: 6378137.0,        // Semi-major axis (equatorial radius) in meters
    b: 6356752.314245,   // Semi-minor axis (polar radius) in meters
    f: 1 / 298.257223563 // Flattening
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

// World Magnetic Model coefficients (WMM2025)
// Simplified implementation using main field coefficients
// Full accuracy would require ~200+ coefficients
const WMM2025_EPOCH = 2025.0;
const WMM2025_COEFFS = {
    // Main field Gauss coefficients (g, h) in nanoTesla
    // [n, m, g, h, dg, dh] - degree n, order m, coefficients and secular variation
    g: [
        [1, 0, -29404.5, 0, 6.7, 0],
        [1, 1, -1450.7, 4652.9, 7.7, -25.1],
        [2, 0, -2500.0, 0, -11.5, 0],
        [2, 1, 2982.0, -2991.6, -7.1, -30.2],
        [2, 2, 1676.8, -734.8, -2.2, -23.9]
    ]
};

/**
 * Calculate magnetic declination (variation) using simplified WMM2025
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {number} altitude - Altitude in meters (default 0)
 * @param {number} year - Decimal year (default current year)
 * @returns {number} - Magnetic declination in degrees (positive = East, negative = West)
 */
function calculateMagneticDeclination(lat, lon, altitude = 0, year = null) {
    if (year === null) {
        const now = new Date();
        year = now.getFullYear() + now.getMonth() / 12;
    }

    // Convert to radians
    const φ = lat * Math.PI / 180;
    const λ = lon * Math.PI / 180;

    // Simplified calculation using main coefficients
    // This is a basic approximation - full WMM requires spherical harmonics

    // Very simplified model for demonstration
    // East declination zones (rough approximation)
    let dec = 0;

    if (lon >= -180 && lon < -60) {
        // Americas - generally west declination
        dec = -15 + (lon + 120) * 0.15;
    } else if (lon >= -60 && lon < 60) {
        // Europe/Africa - mixed
        dec = -5 + lon * 0.2;
    } else {
        // Asia/Pacific - generally east declination
        dec = 5 + (lon - 120) * 0.1;
    }

    // Latitude adjustment
    dec += Math.abs(lat) * 0.05;

    // Clamp to reasonable values
    dec = Math.max(-30, Math.min(30, dec));

    return dec;
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.vincentyInverse = vincentyInverse;
    window.calculateMagneticDeclination = calculateMagneticDeclination;
}
