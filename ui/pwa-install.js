// PWA Install UI Handler
// Manages the install prompt and UI for Progressive Web App installation

let deferredPrompt = null;
let installBannerDismissed = false;

// Initialize PWA install handling
function initPWAInstall() {
    console.log('[PWA Install] Setting up event listeners...');

    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('[PWA Install] beforeinstallprompt event fired!');

        // Prevent the default mini-infobar from appearing on mobile
        e.preventDefault();

        // Save the event so it can be triggered later
        deferredPrompt = e;

        // Show install section in Welcome tab
        showInstallSection();

        // Show custom install banner if not dismissed
        if (!installBannerDismissed && !isPWAInstalled()) {
            console.log('[PWA Install] Showing install banner');
            showInstallBanner();
        } else {
            console.log('[PWA Install] Not showing banner - dismissed:', installBannerDismissed, 'installed:', isPWAInstalled());
        }
    });

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed successfully');
        hideInstallBanner();
        hideInstallSection();
        deferredPrompt = null;

        // Show success message
        showInstallSuccess();
    });

    // Check if already installed and hide everything
    if (isPWAInstalled()) {
        hideInstallBanner();
        hideInstallSection();
    } else if (isIOS() && !isPWAInstalled()) {
        // On iOS, show install section even without beforeinstallprompt
        // (iOS Safari doesn't fire this event)
        console.log('[PWA Install] iOS detected - showing install instructions');
        showInstallSection();
    }
}

// Check if PWA is already installed
function isPWAInstalled() {
    // Check if running in standalone mode
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}

// Detect iOS devices
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Detect Android devices
function isAndroid() {
    return /Android/.test(navigator.userAgent);
}

// Show the install section in Welcome tab
function showInstallSection() {
    const section = document.getElementById('pwa-install-section');
    const instructions = document.getElementById('pwa-install-instructions');
    const button = document.getElementById('pwa-install-button');

    if (!section || isPWAInstalled()) return;

    section.style.display = 'block';

    // Platform-specific instructions
    if (isIOS()) {
        if (instructions) {
            instructions.innerHTML = '<strong>iOS:</strong> Tap Share <span style="color: var(--color-primary);">⎋</span> then "Add to Home Screen"';
        }
        if (button) {
            button.style.display = 'none'; // Hide button on iOS (doesn't support programmatic install)
        }
    } else if (isAndroid()) {
        if (instructions) {
            instructions.innerHTML = '<strong>Android/Chrome:</strong> Tap the button below or use browser menu and select "Install app"';
        }
        if (button && deferredPrompt) {
            button.style.display = 'block';
        }
    } else {
        if (instructions) {
            instructions.innerHTML = '<strong>Desktop:</strong> Click the install button in your browser\'s address bar or below';
        }
        if (button && deferredPrompt) {
            button.style.display = 'block';
        }
    }
}

// Hide the install section
function hideInstallSection() {
    const section = document.getElementById('pwa-install-section');
    if (section) {
        section.style.display = 'none';
    }
}

// Show the install banner
function showInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
        banner.classList.add('visible');
    }
}

// Hide the install banner
function hideInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
        banner.classList.remove('visible');
    }
}

// Handle install button click
async function handleInstallClick() {
    if (!deferredPrompt) {
        console.log('No install prompt available');
        return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`User response to install prompt: ${outcome}`);

    if (outcome === 'accepted') {
        // User accepted - banner will be hidden by appinstalled event
        console.log('User accepted the install prompt');
    } else {
        // User dismissed - hide banner but don't mark as permanently dismissed
        hideInstallBanner();
    }

    // Clear the deferred prompt
    deferredPrompt = null;
}

// Handle dismiss button click
function handleInstallDismiss() {
    installBannerDismissed = true;
    hideInstallBanner();

    // Store dismissal in localStorage (expires after 7 days)
    const dismissalData = {
        timestamp: Date.now(),
        expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };
    localStorage.setItem('pwa-install-dismissed', JSON.stringify(dismissalData));
}

// Check if dismissal has expired
function checkDismissalExpiry() {
    const dismissalData = localStorage.getItem('pwa-install-dismissed');
    if (dismissalData) {
        try {
            const data = JSON.parse(dismissalData);
            if (Date.now() > data.expires) {
                // Dismissal expired, clear it
                localStorage.removeItem('pwa-install-dismissed');
                installBannerDismissed = false;
                return false;
            }
            installBannerDismissed = true;
            return true;
        } catch (e) {
            localStorage.removeItem('pwa-install-dismissed');
            return false;
        }
    }
    return false;
}

// Show success message after installation
function showInstallSuccess() {
    const statusEl = document.getElementById('pwa-install-status');
    if (statusEl) {
        statusEl.textContent = '✓ APP INSTALLED SUCCESSFULLY';
        statusEl.style.color = 'var(--color-success, #00ff00)';
        statusEl.style.display = 'block';

        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[PWA Install] Initializing...');
    checkDismissalExpiry();
    initPWAInstall();

    // Debug: Check if elements exist
    const banner = document.getElementById('pwa-install-banner');
    const section = document.getElementById('pwa-install-section');
    console.log('[PWA Install] Banner element:', banner ? 'Found' : 'Missing');
    console.log('[PWA Install] Section element:', section ? 'Found' : 'Missing');
    console.log('[PWA Install] Already installed:', isPWAInstalled());
});
