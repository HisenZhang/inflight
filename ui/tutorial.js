// Interactive Tutorial System
// Provides step-by-step guidance through flight planning workflow

const TUTORIAL_STEPS = [
    {
        id: 'welcome',
        title: 'WELCOME TO IN-FLIGHT',
        message: 'This interactive tutorial will guide you through planning a flight from Albany (KALB) to Chicago O\'Hare (KORD). Click NEXT to begin.',
        action: null,
        highlight: null
    },
    {
        id: 'load-data',
        title: 'STEP 1: LOAD DATABASE',
        message: 'First, we need to load the aviation database. This includes airports, waypoints, and airways for the United States. The database is cached locally for offline use.',
        action: async () => {
            // Switch to DATA tab
            document.querySelector('[data-tab="data"]').click();
            await sleep(500);

            // Check if already loaded
            let cacheResult = await DataManager.checkCachedData();
            if (!cacheResult.loaded) {
                // Click the load data button
                const loadBtn = document.getElementById('loadDataBtn');
                if (loadBtn && !loadBtn.disabled) {
                    loadBtn.click();

                    // Poll every second until data is loaded (max 30 seconds)
                    let attempts = 0;
                    const maxAttempts = 30;
                    while (attempts < maxAttempts) {
                        await sleep(1000);
                        cacheResult = await DataManager.checkCachedData();
                        if (cacheResult.loaded) {
                            break;
                        }
                        attempts++;
                    }
                }
            }
        },
        highlight: '[data-tab="data"]',
        waitForCompletion: true
    },
    {
        id: 'nav-to-route',
        title: 'STEP 2: NAVIGATE TO ROUTE TAB',
        message: 'Now that the database is loaded, let\'s navigate to the ROUTE tab where we\'ll plan our flight.',
        action: async () => {
            document.querySelector('[data-tab="route"]').click();
            await sleep(300);
        },
        highlight: '[data-tab="route"]'
    },
    {
        id: 'enter-departure',
        title: 'STEP 3: ENTER DEPARTURE AIRPORT',
        message: 'We\'ll depart from Albany International Airport. Its ICAO code is KALB. Watch the autocomplete as we type!',
        action: async () => {
            const input = document.getElementById('departureInput');
            if (input) {
                await typeTextWithAutocomplete(input, 'KALB');
                await sleep(500);
            }
        },
        highlight: '#departureInput',
        waitForCompletion: true
    },
    {
        id: 'enter-route',
        title: 'STEP 4: ENTER ROUTE',
        message: 'The route defines our path through the airspace. We\'ll fly via waypoint PAYGE, then airway Q822, then waypoint FNT, then the WYNDE3 arrival procedure. Watch the autocomplete suggestions as we type!',
        action: async () => {
            const input = document.getElementById('routeInput');
            if (input) {
                // Type slowly to demonstrate autocomplete
                await typeTextWithAutocomplete(input, 'PAYGE Q822 FNT WYNDE3');
                await sleep(500);
            }
        },
        highlight: '#routeInput',
        waitForCompletion: true
    },
    {
        id: 'enter-destination',
        title: 'STEP 5: ENTER DESTINATION',
        message: 'Our destination is Chicago O\'Hare International Airport (KORD). Watch autocomplete show airport info!',
        action: async () => {
            const input = document.getElementById('destinationInput');
            if (input) {
                await typeTextWithAutocomplete(input, 'KORD');
                await sleep(500);
            }
        },
        highlight: '#destinationInput',
        waitForCompletion: true
    },
    {
        id: 'enable-winds',
        title: 'STEP 6: ENABLE WIND CORRECTION',
        message: 'IN-FLIGHT can calculate wind correction for more accurate ground speeds and headings. Let\'s enable this feature.',
        action: async () => {
            const toggle = document.getElementById('enableWindsToggle');
            if (toggle && !toggle.classList.contains('active')) {
                toggle.click();
                await sleep(300);
            }
        },
        highlight: '#enableWindsToggle',
        waitForCompletion: true
    },
    {
        id: 'enter-altitude',
        title: 'STEP 7: SET CRUISE ALTITUDE',
        message: 'We\'ll cruise at 7,000 feet MSL. This altitude is important for wind calculations.',
        action: async () => {
            const input = document.getElementById('altitudeInput');
            if (input) {
                await typeText(input, '7000');
                await sleep(500);
            }
        },
        highlight: '#altitudeInput',
        waitForCompletion: true
    },
    {
        id: 'enter-speed',
        title: 'STEP 8: SET TRUE AIRSPEED',
        message: 'Our aircraft\'s true airspeed will be 140 knots. This is used to calculate ground speed with wind correction.',
        action: async () => {
            const input = document.getElementById('tasInput');
            if (input) {
                await typeText(input, '140');
                await sleep(500);
            }
        },
        highlight: '#tasInput',
        waitForCompletion: true
    },
    {
        id: 'ready-to-calculate',
        title: 'STEP 9: READY TO CALCULATE',
        message: 'All parameters are entered! Now let\'s calculate the route. Click NEXT to compute your flight plan.',
        action: null,
        highlight: '#calculateBtn'
    },
    {
        id: 'calculate',
        title: 'STEP 10: CALCULATING ROUTE',
        message: 'Computing your flight plan... IN-FLIGHT will resolve waypoints, airways, and navigation data. The app will automatically switch to the NAVLOG tab to show your results.',
        action: async () => {
            const btn = document.getElementById('calculateBtn');
            if (btn && !btn.disabled) {
                btn.click();
                // Wait for calculation and auto-switch to NAVLOG
                await sleep(1500);
            }
        },
        highlight: '#calculateBtn',
        waitForCompletion: true
    },
    {
        id: 'navlog-overview',
        title: 'STEP 11: NAVIGATION LOG',
        message: 'Here\'s your complete flight plan! The NAVLOG shows each waypoint with distance, bearing, time, and fuel calculations. Let\'s explore the different sections.',
        action: null,
        highlight: '#navlogTable'
    },
    {
        id: 'wind-aloft-table',
        title: 'STEP 11A: WIND ALOFT DATA',
        message: 'The wind aloft table shows forecast winds at your cruise altitude (7,000 ft). This data is fetched from NOAA and used to calculate wind correction angles and ground speeds for each leg.',
        action: null,
        highlight: '#windAltitudeTable'
    },
    {
        id: 'navlog-departure',
        title: 'STEP 11B: DEPARTURE AIRPORT',
        message: 'KALB (Albany International) is your departure airport. Notice the airport icon and full name. This row shows your starting position.',
        action: async () => {
            // Highlight first waypoint row (KALB) with breathing glow
            const firstRow = document.querySelector('#navlogTable tbody .wpt-row:nth-of-type(1)');
            if (firstRow) {
                firstRow.classList.add('tutorial-glow-highlight');
                // Scroll into view
                firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        },
        highlight: null,  // No glow box - using direct breathing glow
        waitForCompletion: true
    },
    {
        id: 'navlog-waypoint',
        title: 'STEP 11C: EN-ROUTE WAYPOINT',
        message: 'PAYGE is an en-route waypoint (fix). The NAVLOG shows magnetic course (CRS), distance (DIST), estimated time en route (ETE), and wind correction angle (WCA) for this leg.',
        action: async () => {
            // Clear previous highlight
            const prevRow = document.querySelector('#navlogTable tbody .wpt-row:nth-of-type(1)');
            if (prevRow) prevRow.classList.remove('tutorial-glow-highlight');

            // Highlight second waypoint row (PAYGE - en route waypoint)
            const paygeRow = document.querySelector('#navlogTable tbody .wpt-row:nth-of-type(2)');
            if (paygeRow) {
                paygeRow.classList.add('tutorial-glow-highlight');
                paygeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        },
        highlight: null,  // No glow box - using direct breathing glow
        waitForCompletion: true
    },
    {
        id: 'navlog-leg-info',
        title: 'STEP 11D: LEG INFORMATION',
        message: 'Each leg shows:\n• CRS: Magnetic course\n• WCA: Wind correction angle\n• HDG: Magnetic heading\n• DIST: Distance in nautical miles\n• GS: Ground speed (TAS ± wind)\n• ETE: Estimated time en route\n• FUEL: Fuel consumed\n\nCumulative totals appear in the rightmost columns.',
        action: async () => {
            // Clear previous waypoint highlight
            const paygeRow = document.querySelector('#navlogTable tbody .wpt-row:nth-of-type(2)');
            if (paygeRow) paygeRow.classList.remove('tutorial-glow-highlight');
        },
        highlight: '#navlogTable table thead',
        waitForCompletion: true
    },
    {
        id: 'navlog-destination',
        title: 'STEP 11E: DESTINATION AIRPORT',
        message: 'KORD (Chicago O\'Hare) is your destination. The cumulative columns show total distance, flight time, and fuel for the entire route. You can print this NAVLOG for cockpit reference!',
        action: async () => {
            // Highlight last waypoint row (KORD - destination)
            const rows = document.querySelectorAll('#navlogTable tbody .wpt-row');
            const lastRow = rows[rows.length - 1];
            if (lastRow) {
                lastRow.classList.add('tutorial-glow-highlight');
                lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        },
        highlight: null,  // No glow box - using direct breathing glow
        waitForCompletion: true
    },
    {
        id: 'view-map',
        title: 'STEP 12: VIEW ROUTE ON MAP',
        message: 'Now let\'s switch to the MAP tab to see your route visualized on an interactive map with your flight path and waypoints.',
        action: async () => {
            // Clear all navlog waypoint row highlights before switching tabs
            const rows = document.querySelectorAll('#navlogTable tbody .wpt-row');
            rows.forEach(row => row.classList.remove('tutorial-glow-highlight'));

            document.querySelector('[data-tab="map"]').click();
            await sleep(800);
        },
        highlight: '[data-tab="map"]',
        waitForCompletion: true
    },
    {
        id: 'map-overview',
        title: 'STEP 12A: MAP DISPLAY',
        message: 'The interactive map shows your complete route from KALB to KORD. The magenta line is your flight path, and markers show waypoints and airports. You can click and drag to pan around.',
        action: null,
        highlight: '#mapContainer'
    },
    {
        id: 'map-zoom-route',
        title: 'STEP 12B: ROUTE BUTTON',
        message: 'The ROUTE button shows your complete flight path from departure to destination. This displays the entire route regardless of your current GPS position.',
        action: null,
        highlight: '[data-zoom="full"]'
    },
    {
        id: 'map-zoom-dest',
        title: 'STEP 12C: DEST BUTTON',
        message: 'The DEST button zooms to show both your current GPS position and the destination airport. The view dynamically adjusts as you get closer to your destination.',
        action: null,
        highlight: '[data-zoom="destination"]'
    },
    {
        id: 'map-zoom-50nm',
        title: 'STEP 12D: 50NM BUTTON',
        message: 'The 50NM button shows a 50 nautical mile radius centered on your current GPS position. Great for medium-range situational awareness when GPS is active.',
        action: null,
        highlight: '[data-zoom="surrounding-50"]'
    },
    {
        id: 'map-zoom-25nm',
        title: 'STEP 12E: 25NM BUTTON',
        message: 'The 25NM button shows a 25 nautical mile radius centered on your current GPS position. Perfect for close-range navigation and identifying nearby waypoints.',
        action: null,
        highlight: '[data-zoom="surrounding-25"]'
    },
    {
        id: 'map-zoom-manual',
        title: 'STEP 12F: MANUAL ZOOM',
        message: 'The + and − buttons let you manually zoom in and out. You can also use your mouse wheel or pinch gestures on touch devices for precise control.',
        action: null,
        highlight: '#zoomInBtn'
    },
    {
        id: 'map-nav-panel',
        title: 'STEP 12G: NAVIGATION PANEL',
        message: 'The navigation panel at the bottom shows real-time flight data when GPS is enabled:\n• Next waypoint (WPT)\n• Required heading (HDG)\n• Distance to waypoint (DIST)\n• Estimated time en route (ETE)\n• Ground speed (GS)\n• Cross-track error (XTK)\n\nPerfect for in-flight navigation!',
        action: null,
        highlight: '#navigationPanel'
    },
    {
        id: 'complete',
        title: 'TUTORIAL COMPLETE!',
        message: 'Congratulations! You\'ve successfully planned a flight route. You can now:\n\n• Plan your own routes\n• Use the interactive map\n• Enable GPS for live tracking\n• Print your navigation log\n• Use the app offline\n\nHappy flying!',
        action: null,
        highlight: null,
        showRestart: true
    }
];

class Tutorial {
    constructor() {
        this.currentStep = 0;
        this.isActive = false;
        this.overlay = null;
        this.popout = null;
        this.highlightElement = null;
    }

    async start() {
        if (this.isActive) return;

        this.isActive = true;
        this.currentStep = 0;

        // Prepare clean environment for tutorial
        this.prepareEnvironment();

        // Create overlay and popout elements
        this.createUI();

        // Show first step
        await this.showStep(0);
    }

    prepareEnvironment() {
        // Dismiss PWA install banner if present
        const installBanner = document.getElementById('pwa-install-banner');
        if (installBanner) {
            installBanner.classList.remove('visible');
        }

        // Dismiss update banner if present
        const updateBanner = document.getElementById('update-banner');
        if (updateBanner) {
            updateBanner.classList.remove('visible');
        }

        // Clear crash recovery state if present
        if (typeof window.CrashRecovery !== 'undefined' && window.CrashRecovery.clearRecovery) {
            window.CrashRecovery.clearRecovery();
        }

        // Clear any existing route data to start fresh
        localStorage.removeItem('lastRoute');

        // Switch to welcome tab
        const welcomeTab = document.querySelector('[data-tab="welcome"]');
        if (welcomeTab) {
            welcomeTab.click();
        }
    }

    createUI() {
        // Create dark overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'tutorial-overlay';
        this.overlay.className = 'tutorial-overlay';
        document.body.appendChild(this.overlay);

        // Create popout container
        this.popout = document.createElement('div');
        this.popout.id = 'tutorial-popout';
        this.popout.className = 'tutorial-popout';
        this.popout.innerHTML = `
            <div class="tutorial-header">
                <div class="tutorial-step-indicator"></div>
                <button class="tutorial-close" onclick="tutorial.stop()">✕</button>
            </div>
            <div class="tutorial-title"></div>
            <div class="tutorial-message"></div>
            <div class="tutorial-actions">
                <button class="btn btn-secondary tutorial-prev" onclick="tutorial.prevStep()">BACK</button>
                <button class="btn btn-primary tutorial-next" onclick="tutorial.nextStep()">NEXT</button>
            </div>
        `;
        document.body.appendChild(this.popout);

        // Create highlight box
        this.highlightElement = document.createElement('div');
        this.highlightElement.className = 'tutorial-highlight';
        document.body.appendChild(this.highlightElement);

        // Create arrow pointing from callout to highlight
        this.arrowElement = document.createElement('div');
        this.arrowElement.className = 'tutorial-arrow';
        document.body.appendChild(this.arrowElement);

        // Update highlight position on scroll or resize
        this.updateHighlightBound = () => this.updateHighlightPosition();
        window.addEventListener('scroll', this.updateHighlightBound);
        window.addEventListener('resize', this.updateHighlightBound);
    }

    updateHighlightPosition() {
        if (this.currentHighlightSelector) {
            const target = document.querySelector(this.currentHighlightSelector);
            if (target) {
                const rect = target.getBoundingClientRect();
                const padding = 8;
                this.highlightElement.style.top = `${rect.top + window.scrollY - padding}px`;
                this.highlightElement.style.left = `${rect.left + window.scrollX - padding}px`;
                this.highlightElement.style.width = `${rect.width + padding * 2}px`;
                this.highlightElement.style.height = `${rect.height + padding * 2}px`;

                // Update arrow position
                this.updateArrowPosition(rect);
            }
        }
    }

    updateArrowPosition(targetRect) {
        // Position arrow from callout (top-right) to target element
        const calloutRect = this.popout.getBoundingClientRect();

        // Arrow starts from bottom-left of callout
        const startX = calloutRect.left;
        const startY = calloutRect.bottom;

        // Arrow points to center-top of target
        const endX = targetRect.left + targetRect.width / 2;
        const endY = targetRect.top;

        // Calculate arrow length and angle
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Position and rotate arrow
        this.arrowElement.style.left = `${startX + window.scrollX}px`;
        this.arrowElement.style.top = `${startY + window.scrollY}px`;
        this.arrowElement.style.height = `${length}px`;
        this.arrowElement.style.transformOrigin = 'top left';

        const angle = Math.atan2(deltaX, -deltaY) * (180 / Math.PI);
        this.arrowElement.style.transform = `rotate(${angle}deg)`;
        this.arrowElement.style.display = 'block';
    }

    async showStep(index) {
        if (index < 0 || index >= TUTORIAL_STEPS.length) return;

        this.currentStep = index;
        const step = TUTORIAL_STEPS[index];

        // Update step indicator
        const indicator = this.popout.querySelector('.tutorial-step-indicator');
        indicator.textContent = `STEP ${index + 1} OF ${TUTORIAL_STEPS.length}`;

        // Update title and message
        this.popout.querySelector('.tutorial-title').textContent = step.title;
        this.popout.querySelector('.tutorial-message').textContent = step.message;

        // Update button states
        const prevBtn = this.popout.querySelector('.tutorial-prev');
        const nextBtn = this.popout.querySelector('.tutorial-next');

        // Hide back button (one-way tutorial)
        prevBtn.style.display = 'none';

        // Show restart button on final step
        if (step.showRestart) {
            nextBtn.textContent = 'FINISH';
            prevBtn.textContent = '↻ RESTART TUTORIAL';
            prevBtn.style.display = 'inline-block';
            prevBtn.onclick = () => {
                tutorial.stop();
                setTimeout(() => tutorial.start(), 300);
            };
        } else if (index === TUTORIAL_STEPS.length - 1) {
            nextBtn.textContent = 'FINISH';
        } else {
            nextBtn.textContent = 'NEXT';
        }

        // Highlight element if specified
        if (step.highlight) {
            this.highlightTarget(step.highlight);
        } else {
            this.clearHighlight();
        }

        // Position popout
        this.positionPopout(step.highlight);

        // Wait a moment for user to see the prompt before executing action
        await sleep(300);

        // Execute step action if this is automatic
        if (step.action && step.waitForCompletion) {
            nextBtn.disabled = true;
            nextBtn.textContent = 'WORKING...';
            try {
                await step.action();
            } catch (error) {
                console.error('Tutorial step error:', error);
            }
            nextBtn.disabled = false;
            if (index === TUTORIAL_STEPS.length - 1) {
                nextBtn.textContent = 'FINISH';
            } else {
                nextBtn.textContent = 'NEXT';
            }

            // Refresh highlight position after action completes
            // (in case the action changed page layout or switched tabs)
            if (step.highlight) {
                await sleep(100);
                const target = document.querySelector(step.highlight);
                if (target) {
                    const rect = target.getBoundingClientRect();
                    const padding = 8;
                    this.highlightElement.style.top = `${rect.top + window.scrollY - padding}px`;
                    this.highlightElement.style.left = `${rect.left + window.scrollX - padding}px`;
                    this.highlightElement.style.width = `${rect.width + padding * 2}px`;
                    this.highlightElement.style.height = `${rect.height + padding * 2}px`;
                    this.updateArrowPosition(rect);
                }
            }
        }
    }

    highlightTarget(selector) {
        this.currentHighlightSelector = selector;

        const target = document.querySelector(selector);
        if (!target) {
            this.clearHighlight();
            return;
        }

        const rect = target.getBoundingClientRect();
        const padding = 8;

        this.highlightElement.style.display = 'block';
        this.highlightElement.style.top = `${rect.top + window.scrollY - padding}px`;
        this.highlightElement.style.left = `${rect.left + window.scrollX - padding}px`;
        this.highlightElement.style.width = `${rect.width + padding * 2}px`;
        this.highlightElement.style.height = `${rect.height + padding * 2}px`;

        // Update arrow pointing to this element
        this.updateArrowPosition(rect);

        // Scroll element into view if needed
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    clearHighlight() {
        this.currentHighlightSelector = null;
        this.highlightElement.style.display = 'none';
        this.arrowElement.style.display = 'none';
    }

    positionPopout(highlightSelector) {
        // Callout is fixed to top-right by CSS
        // Just ensure it's visible
        this.popout.style.display = 'block';
    }

    async nextStep() {
        const step = TUTORIAL_STEPS[this.currentStep];

        // Execute action if present and not already executed
        if (step.action && !step.waitForCompletion) {
            try {
                await step.action();
            } catch (error) {
                console.error('Tutorial step error:', error);
            }
        }

        // Move to next step or finish
        if (this.currentStep >= TUTORIAL_STEPS.length - 1) {
            this.stop();
            // Return to welcome tab after tutorial
            const welcomeTab = document.querySelector('[data-tab="welcome"]');
            if (welcomeTab) {
                welcomeTab.click();
            }
        } else {
            await this.showStep(this.currentStep + 1);
        }
    }

    async prevStep() {
        if (this.currentStep > 0) {
            await this.showStep(this.currentStep - 1);
        }
    }

    stop() {
        this.isActive = false;

        // Remove event listeners
        if (this.updateHighlightBound) {
            window.removeEventListener('scroll', this.updateHighlightBound);
            window.removeEventListener('resize', this.updateHighlightBound);
            this.updateHighlightBound = null;
        }

        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }

        if (this.popout) {
            this.popout.remove();
            this.popout = null;
        }

        if (this.highlightElement) {
            this.highlightElement.remove();
            this.highlightElement = null;
        }

        if (this.arrowElement) {
            this.arrowElement.remove();
            this.arrowElement = null;
        }

        this.currentHighlightSelector = null;

        // Restore environment after tutorial
        this.restoreEnvironment();
    }

    restoreEnvironment() {
        // Restore PWA install banner if it should be visible
        if (typeof window.showInstallBanner === 'function') {
            const installBanner = document.getElementById('pwa-install-banner');
            // Only show if not dismissed and not installed
            if (installBanner && !localStorage.getItem('pwa-install-dismissed') &&
                !window.matchMedia('(display-mode: standalone)').matches) {
                setTimeout(() => window.showInstallBanner(), 500);
            }
        }

        // Restore update banner if there's a pending update
        const updateBanner = document.getElementById('update-banner');
        if (updateBanner && updateBanner.dataset.hasUpdate === 'true') {
            setTimeout(() => updateBanner.classList.add('visible'), 500);
        }

        // Note: We don't restore crash recovery - tutorial clears it intentionally
        // Note: We don't restore lastRoute - user should start fresh after tutorial
    }
}

// Utility functions
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeText(input, text) {
    input.focus();
    input.value = '';

    // Temporarily disable autocomplete to avoid errors during typing
    const autocompleteAttr = input.getAttribute('autocomplete');
    input.setAttribute('autocomplete', 'off');

    // Store original oninput handler and temporarily disable it
    const originalOninput = input.oninput;
    input.oninput = null;

    for (let char of text) {
        input.value += char;
        await sleep(50);
    }

    // Restore autocomplete and input handler
    if (autocompleteAttr) {
        input.setAttribute('autocomplete', autocompleteAttr);
    } else {
        input.removeAttribute('autocomplete');
    }
    input.oninput = originalOninput;

    // Now trigger the change event after all text is entered
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Blur the input to close any autocomplete dropdowns
    input.blur();

    // Small delay to let autocomplete close
    await sleep(100);
}

async function typeTextWithAutocomplete(input, text) {
    input.focus();
    input.value = '';

    const words = text.split(' ');

    for (let i = 0; i < words.length; i++) {
        const word = words[i];

        // Type the word character by character
        for (let char of word) {
            input.value += char;

            // Trigger input event to show autocomplete
            input.dispatchEvent(new Event('input', { bubbles: true }));

            await sleep(150); // Slower typing to see autocomplete
        }

        // After typing the word, wait a bit to show the autocomplete dropdown
        await sleep(600);

        // Try to click the first autocomplete suggestion if it exists
        const autocompleteDropdown = document.querySelector('.autocomplete-suggestions');
        if (autocompleteDropdown && autocompleteDropdown.children.length > 0) {
            const firstSuggestion = autocompleteDropdown.children[0];
            if (firstSuggestion) {
                // Click the suggestion
                firstSuggestion.click();
                await sleep(300);
            }
        }

        // Add space if not the last word
        if (i < words.length - 1) {
            input.value += ' ';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(400);
        }
    }

    // Final events
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Blur to close autocomplete
    input.blur();

    // Small delay to let autocomplete close
    await sleep(100);
}

// Global tutorial instance
const tutorial = new Tutorial();

// Auto-start function (called from button)
function startTutorial() {
    tutorial.start();
}
