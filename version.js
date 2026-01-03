/**
 * IN-FLIGHT Version Management
 *
 * Single source of truth for all version numbers.
 * Update this file when releasing a new version.
 *
 * Versioning follows Semantic Versioning (semver.org):
 * - MAJOR: Breaking changes, incompatible API changes
 * - MINOR: New features, backwards-compatible
 * - PATCH: Bug fixes, backwards-compatible
 *
 * CACHE_VERSION: Increment whenever you want to force PWA updates
 * - Format: flight-planning-v{number}
 * - Increment {number} for ANY code change that should trigger update
 *
 * IMPORTANT: When releasing a new version:
 * 1. Update MAJOR.MINOR.PATCH (semantic version)
 * 2. Increment CACHE_VERSION by 1
 * 3. Update BUILD_DATE to today's date
 * 4. Update RELEASE_NAME with release description
 * 5. Sync package.json version (npm version script can automate)
 */

const AppVersion = {
    // Semantic version (sync with package.json)
    MAJOR: 3,
    MINOR: 6,
    PATCH: 1,

    // Full version string
    get VERSION() {
        return `${this.MAJOR}.${this.MINOR}.${this.PATCH}`;
    },

    // Service worker cache version
    // Increment this number to force PWA updates
    CACHE_VERSION: 166,

    // Full cache name for service worker
    get CACHE_NAME() {
        return `flight-planning-v${this.CACHE_VERSION}`;
    },

    // Build metadata (optional)
    BUILD_DATE: '2026-01-02',

    // Release name (optional)
    RELEASE_NAME: 'Simplified PROC button - direct SID/STAR display without modal',

    /**
     * Get full version info object
     */
    getVersionInfo() {
        return {
            version: this.VERSION,
            cacheName: this.CACHE_NAME,
            cacheVersion: this.CACHE_VERSION,
            buildDate: this.BUILD_DATE,
            releaseName: this.RELEASE_NAME
        };
    },

    /**
     * Display version info in console
     */
    logVersionInfo() {
        console.log(`%c IN-FLIGHT v${this.VERSION} `, 'background: #ff00ff; color: #000; font-weight: bold; padding: 4px;');
        console.log(`Cache: ${this.CACHE_NAME}`);
        console.log(`Build: ${this.BUILD_DATE}`);
        if (this.RELEASE_NAME) {
            console.log(`Release: ${this.RELEASE_NAME}`);
        }
    }
};

// Export for service worker (self context) and browser (window context)
if (typeof self !== 'undefined') {
    self.AppVersion = AppVersion;
}
if (typeof window !== 'undefined') {
    window.AppVersion = AppVersion;
    // Log version info on load (development aid)
    AppVersion.logVersionInfo();
}
