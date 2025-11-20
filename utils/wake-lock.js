// Screen Wake Lock Manager
// Keeps the screen awake during flight operations

/**
 * WakeLock module - Manages screen wake lock to prevent screen from sleeping
 *
 * The Screen Wake Lock API prevents the screen from dimming or locking,
 * which is essential for navigation apps that need to display information
 * continuously during flight operations.
 *
 * @module WakeLock
 */
window.WakeLock = {
    wakeLock: null,
    isEnabled: false,
    isSupported: false,

    /**
     * Initialize wake lock system
     * Checks browser support and sets up visibility change handlers
     */
    init() {
        // Check if Wake Lock API is supported
        this.isSupported = 'wakeLock' in navigator;

        if (!this.isSupported) {
            console.log('[WakeLock] Screen Wake Lock API not supported in this browser');
            return false;
        }

        console.log('[WakeLock] Screen Wake Lock API supported');

        // Restore saved preference
        const savedPref = localStorage.getItem('wakeLockEnabled');
        if (savedPref === 'true') {
            this.enable();
        }

        // Handle visibility change - release lock when tab hidden, reacquire when visible
        document.addEventListener('visibilitychange', () => {
            if (this.isEnabled) {
                if (document.visibilityState === 'visible') {
                    console.log('[WakeLock] Tab visible, reacquiring wake lock');
                    this._requestWakeLock();
                } else {
                    console.log('[WakeLock] Tab hidden, wake lock will be released automatically');
                }
            }
        });

        return true;
    },

    /**
     * Request wake lock from the browser
     * @private
     */
    async _requestWakeLock() {
        if (!this.isSupported) {
            return false;
        }

        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            console.log('[WakeLock] Wake lock acquired successfully');

            // Listen for wake lock release
            this.wakeLock.addEventListener('release', () => {
                console.log('[WakeLock] Wake lock released');
            });

            return true;
        } catch (err) {
            console.error('[WakeLock] Failed to acquire wake lock:', err);
            return false;
        }
    },

    /**
     * Enable wake lock - keeps screen awake
     * @returns {Promise<boolean>} Success status
     */
    async enable() {
        if (!this.isSupported) {
            console.warn('[WakeLock] Cannot enable - not supported');
            return false;
        }

        this.isEnabled = true;
        localStorage.setItem('wakeLockEnabled', 'true');

        // Only request if tab is visible
        if (document.visibilityState === 'visible') {
            const success = await this._requestWakeLock();
            if (success) {
                console.log('[WakeLock] Enabled - screen will stay awake');
            }
            return success;
        } else {
            console.log('[WakeLock] Enabled - will acquire lock when tab becomes visible');
            return true;
        }
    },

    /**
     * Disable wake lock - allow screen to sleep normally
     */
    async disable() {
        this.isEnabled = false;
        localStorage.setItem('wakeLockEnabled', 'false');

        if (this.wakeLock !== null) {
            try {
                await this.wakeLock.release();
                this.wakeLock = null;
                console.log('[WakeLock] Disabled - screen can sleep normally');
            } catch (err) {
                console.error('[WakeLock] Error releasing wake lock:', err);
            }
        }
    },

    /**
     * Toggle wake lock on/off
     * @returns {Promise<boolean>} New enabled state
     */
    async toggle() {
        if (this.isEnabled) {
            await this.disable();
            return false;
        } else {
            await this.enable();
            return true;
        }
    },

    /**
     * Get current status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            supported: this.isSupported,
            enabled: this.isEnabled,
            active: this.wakeLock !== null && !this.wakeLock.released
        };
    }
};
