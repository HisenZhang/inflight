/**
 * Charts Controller - Manages chart display and selection
 * @module ChartsController
 */

// Autocomplete state
let selectedChartsIndex = -1;
let chartsAutocompleteResults = [];
let isProcessingChartsSelection = false;

window.ChartsController = {
    /**
     * Initialize charts tab functionality
     */
    init() {
        const searchBtn = document.getElementById('chartsSearchBtn');
        const airportInput = document.getElementById('chartsAirportInput');
        const autocompleteDropdown = document.getElementById('chartsAutocompleteDropdown');

        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.searchCharts());
        }

        if (airportInput) {
            // Search on Enter key (only if autocomplete is not showing)
            airportInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !autocompleteDropdown.classList.contains('show')) {
                    this.searchCharts();
                }
            });

            // Autocomplete input handler
            airportInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
                this.handleAutocompleteInput(e);
            });

            // Autocomplete keyboard navigation
            airportInput.addEventListener('keydown', (e) => {
                this.handleAutocompleteKeydown(e);
            });

            // Hide autocomplete on blur (with delay for click handling)
            airportInput.addEventListener('blur', () => {
                setTimeout(() => {
                    if (!isProcessingChartsSelection) {
                        this.hideAutocomplete();
                    }
                }, 200);
            });
        }

        // Prevent autocomplete hide when clicking on it
        if (autocompleteDropdown) {
            autocompleteDropdown.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });
        }

        // Load and display recent charts history
        this.displayChartsHistory();
    },

    /**
     * Update route airports quick select bar
     * Called when a route is calculated or cleared
     * @param {Array} airports - Array of airport objects with icao property
     */
    updateRouteAirports(airports) {
        const container = document.getElementById('chartsRouteAirports');
        const list = document.getElementById('chartsRouteAirportsList');
        if (!container || !list) return;

        if (!airports || airports.length === 0) {
            container.style.display = 'none';
            return;
        }

        // Build buttons for each airport
        list.innerHTML = airports.map((apt, index) => {
            const isFirst = index === 0;
            const isLast = index === airports.length - 1;
            let className = 'route-airport-btn';
            if (isFirst) className += ' departure';
            else if (isLast) className += ' destination';

            return `<button class="${className}" onclick="ChartsController.showChartsForAirport('${apt.icao}')">${apt.icao}</button>`;
        }).join('');

        container.style.display = 'flex';
    },

    /**
     * Search for charts for entered airport
     */
    searchCharts() {
        const airportInput = document.getElementById('chartsAirportInput');
        if (!airportInput) return;

        const code = airportInput.value.trim().toUpperCase();
        if (!code) {
            this.showError('Please enter an airport code (ICAO or IATA)');
            return;
        }

        this.showChartsForAirport(code);
    },

    /**
     * Shows charts for an airport (called from navlog or search)
     * @param {string} code - Airport ICAO or IATA code
     * @param {string} name - Optional airport name for display
     */
    showChartsForAirport(code, name) {
        // Switch to charts tab
        const chartsTab = document.querySelector('[data-tab="charts"]');
        if (chartsTab) {
            chartsTab.click();
        }

        // Set input value
        const airportInput = document.getElementById('chartsAirportInput');
        if (airportInput) {
            airportInput.value = code;
        }

        const charts = window.DataManager.getCharts(code);

        if (!charts || charts.length === 0) {
            this._showNoCharts(code, name);
            return;
        }

        // Get airport info if not provided
        // Try ICAO first, then IATA
        let airport = window.DataManager.getAirport(code);
        if (!airport && code.length === 3) {
            airport = window.DataManager.getAirportByIATA(code);
        }

        const displayCode = airport ? airport.icao : code;
        const displayName = name || (airport ? airport.name : code);

        const cycle = window.DataManager.getChartsCycle();
        this._renderCharts(displayCode, displayName, charts, cycle);
    },

    /**
     * Renders charts in the tab
     * @private
     */
    _renderCharts(icao, name, charts, cycle) {
        const resultsDiv = document.getElementById('chartsResults');
        const contentDiv = document.getElementById('chartsResultsContent');
        const placeholderDiv = document.getElementById('chartsPlaceholder');

        if (!resultsDiv || !contentDiv) return;

        // Save to history
        this.saveToHistory(icao);

        // Group charts by type
        const grouped = window.ChartsAdapter.groupChartsByType(charts);

        // Build content HTML with cleaner structure
        let contentHTML = `
            <div class="data-section">
                <h3 class="section-header">${icao} - ${name}</h3>
                <div class="data-info">
                    <p><strong>TPP Cycle:</strong> ${cycle || 'Unknown'}</p>
                    <p style="margin-bottom: 0;"><strong>Total Charts:</strong> ${charts.length}</p>
                </div>
            </div>
        `;

        // Airport Diagrams (APD)
        if (grouped.APD.length > 0) {
            contentHTML += this._renderChartGroup('AIRPORT DIAGRAMS', grouped.APD, 'airport');
        }

        // Instrument Approach Procedures (IAP) - organized by type
        if (grouped.IAP.length > 0) {
            const approachGroups = window.ChartsAdapter.groupApproachesByType(grouped.IAP);

            contentHTML += `<div class="data-section">
                <h3 class="section-header">INSTRUMENT APPROACHES (${grouped.IAP.length})</h3>`;

            if (approachGroups.ILS.length > 0) {
                contentHTML += this._renderApproachSubgroup('ILS', approachGroups.ILS);
            }
            if (approachGroups.RNAV.length > 0) {
                contentHTML += this._renderApproachSubgroup('RNAV (GPS)', approachGroups.RNAV);
            }
            if (approachGroups.GPS.length > 0) {
                contentHTML += this._renderApproachSubgroup('GPS', approachGroups.GPS);
            }
            if (approachGroups.VOR.length > 0) {
                contentHTML += this._renderApproachSubgroup('VOR', approachGroups.VOR);
            }
            if (approachGroups.NDB.length > 0) {
                contentHTML += this._renderApproachSubgroup('NDB', approachGroups.NDB);
            }
            if (approachGroups.LOC.length > 0) {
                contentHTML += this._renderApproachSubgroup('LOC', approachGroups.LOC);
            }
            if (approachGroups.OTHER.length > 0) {
                contentHTML += this._renderApproachSubgroup('OTHER', approachGroups.OTHER);
            }

            contentHTML += `</div>`;
        }

        // Departure Procedures (DP + ODP)
        const departures = [...grouped.DP, ...grouped.ODP];
        if (departures.length > 0) {
            contentHTML += this._renderChartGroup('DEPARTURE PROCEDURES', departures, 'navaid');
        }

        // Standard Arrivals (STAR)
        if (grouped.STAR.length > 0) {
            contentHTML += this._renderChartGroup('STANDARD ARRIVALS', grouped.STAR, 'navaid');
        }

        // Minimums (MIN)
        if (grouped.MIN.length > 0) {
            contentHTML += this._renderChartGroup('TAKEOFF/ALTERNATE MINIMUMS', grouped.MIN, 'secondary');
        }

        // Hot Spots (HOT)
        if (grouped.HOT.length > 0) {
            contentHTML += this._renderChartGroup('HOT SPOTS', grouped.HOT, 'warning');
        }

        // Other
        if (grouped.OTHER.length > 0) {
            contentHTML += this._renderChartGroup('OTHER CHARTS', grouped.OTHER, 'secondary');
        }

        contentDiv.innerHTML = contentHTML;
        resultsDiv.style.display = 'block';
        if (placeholderDiv) {
            placeholderDiv.style.display = 'none';
        }
    },

    /**
     * Renders a chart group section
     * @private
     * @param {string} title - Group title
     * @param {Array} charts - Array of charts
     * @param {string} colorClass - Color class for title (airport, navaid, warning, etc.)
     */
    _renderChartGroup(title, charts, colorClass = 'primary') {
        let html = `
            <div class="data-section">
                <h3 class="section-header text-${colorClass}">${title} (${charts.length})</h3>
                <div class="chart-list">
        `;

        charts.forEach(chart => {
            const cleanName = this._cleanChartName(chart.name);
            html += `
                <button class="btn btn-secondary chart-btn" onclick="window.open('${chart.url}', '_blank')">
                    ${cleanName}
                </button>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    },

    /**
     * Renders approach subgroup with proper formatting
     * @private
     */
    _renderApproachSubgroup(typeLabel, charts) {
        let html = `
            <div class="chart-subgroup">
                <div class="chart-subgroup-header">
                    <span class="text-sm font-bold text-primary">${typeLabel}</span>
                    <span class="text-secondary text-xs"> (${charts.length})</span>
                </div>
                <div class="chart-list">
        `;

        charts.forEach(chart => {
            const formattedName = this._formatApproachName(chart.name);
            html += `
                <button class="btn btn-secondary chart-btn" onclick="window.open('${chart.url}', '_blank')">
                    ${formattedName}
                </button>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    },

    /**
     * Cleans and formats chart name (simple charts)
     * @private
     */
    _cleanChartName(name) {
        // Just return the name with runway highlighting
        return name.replace(/RWY\s+(\d{1,2}[LCR]?)/gi, (_match, rwy) => {
            return `RWY <span class="text-airport font-bold">${rwy}</span>`;
        });
    },

    /**
     * Formats approach chart name with color coding
     * @private
     */
    _formatApproachName(name) {
        let formattedName = name;

        // Highlight runway numbers
        formattedName = formattedName.replace(/RWY\s+(\d{1,2}[LCR]?)/gi, (_match, rwy) => {
            return `RWY <span class="text-airport font-bold">${rwy}</span>`;
        });

        // Highlight approach types
        const nameUpper = name.toUpperCase();

        if (nameUpper.startsWith('ILS ') || nameUpper.includes(' ILS ')) {
            formattedName = formattedName.replace(/\bILS\b/i, '<span class="text-reporting font-bold">ILS</span>');
        } else if (nameUpper.startsWith('RNAV')) {
            formattedName = formattedName.replace(/\bRNAV\b/i, '<span class="text-navaid font-bold">RNAV</span>');
        } else if (nameUpper.startsWith('GPS')) {
            formattedName = formattedName.replace(/\bGPS\b/i, '<span class="text-navaid font-bold">GPS</span>');
        } else if (nameUpper.startsWith('VOR')) {
            formattedName = formattedName.replace(/\bVOR\b/i, '<span class="text-metric font-bold">VOR</span>');
        } else if (nameUpper.startsWith('NDB')) {
            formattedName = formattedName.replace(/\bNDB\b/i, '<span class="text-reporting font-bold">NDB</span>');
        } else if (nameUpper.startsWith('LOC')) {
            formattedName = formattedName.replace(/\bLOC\b/i, '<span class="text-reporting font-bold">LOC</span>');
        }

        return formattedName;
    },

    /**
     * Shows no charts message
     * @private
     */
    _showNoCharts(icao, name) {
        const resultsDiv = document.getElementById('chartsResults');
        const contentDiv = document.getElementById('chartsResultsContent');
        const placeholderDiv = document.getElementById('chartsPlaceholder');

        if (!resultsDiv || !contentDiv) return;

        const displayName = name || icao;
        contentDiv.innerHTML = `
            <div class="data-section">
                <h3 class="section-header">${icao} - ${displayName}</h3>
                <div class="data-info">
                    <p class="text-warning">No charts available for this airport.</p>
                    <p style="margin-bottom: 0;">Charts are only available for US airports with published instrument procedures. This airport may be international (non-US), may not have instrument approaches, or may be a small VFR-only airport.</p>
                </div>
            </div>
        `;

        resultsDiv.style.display = 'block';
        if (placeholderDiv) {
            placeholderDiv.style.display = 'none';
        }
    },

    /**
     * Shows error message
     * @private
     */
    showError(message) {
        const resultsDiv = document.getElementById('chartsResults');
        const contentDiv = document.getElementById('chartsResultsContent');
        const placeholderDiv = document.getElementById('chartsPlaceholder');

        if (!resultsDiv || !contentDiv) return;

        contentDiv.innerHTML = `
            <div class="data-section">
                <h3 class="section-header text-warning">ERROR</h3>
                <div class="data-info">
                    <p class="text-warning">${message}</p>
                </div>
            </div>
        `;

        resultsDiv.style.display = 'block';
        if (placeholderDiv) {
            placeholderDiv.style.display = 'none';
        }
    },

    /**
     * Handle autocomplete input
     * @private
     */
    handleAutocompleteInput(e) {
        const value = e.target.value.toUpperCase();

        if (value.length < 1) {
            this.hideAutocomplete();
            return;
        }

        const results = window.QueryEngine?.searchAirports(value) || [];
        chartsAutocompleteResults = results;
        this.displayAutocomplete(results);
    },

    /**
     * Display autocomplete results
     * @private
     */
    displayAutocomplete(results) {
        const dropdown = document.getElementById('chartsAutocompleteDropdown');
        if (!dropdown) return;

        if (results.length === 0) {
            dropdown.innerHTML = '<div class="autocomplete-empty">No airports found</div>';
            dropdown.classList.add('show');
            return;
        }

        let html = '';
        results.forEach((result, index) => {
            html += `
                <div class="autocomplete-item type-airport" data-index="${index}">
                    <span class="code">${result.code}</span>
                    <span class="name">${result.name !== result.code ? result.name : ''}</span>
                    <span class="location">${result.location}</span>
                </div>
            `;
        });

        dropdown.innerHTML = html;
        dropdown.classList.add('show');
        selectedChartsIndex = -1;

        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.getAttribute('data-index'));
                this.selectAutocompleteItem(index);
            });
        });
    },

    /**
     * Hide autocomplete dropdown
     * @private
     */
    hideAutocomplete() {
        if (isProcessingChartsSelection) return;

        const dropdown = document.getElementById('chartsAutocompleteDropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
            dropdown.innerHTML = '';
        }
        selectedChartsIndex = -1;
        chartsAutocompleteResults = [];
    },

    /**
     * Handle autocomplete keyboard navigation
     * @private
     */
    handleAutocompleteKeydown(e) {
        const dropdown = document.getElementById('chartsAutocompleteDropdown');
        if (!dropdown || !dropdown.classList.contains('show')) {
            return;
        }

        const items = dropdown.querySelectorAll('.autocomplete-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedChartsIndex = Math.min(selectedChartsIndex + 1, items.length - 1);
            this.updateAutocompleteSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedChartsIndex = Math.max(selectedChartsIndex - 1, -1);
            this.updateAutocompleteSelection(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedChartsIndex >= 0) {
                this.selectAutocompleteItem(selectedChartsIndex);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.hideAutocomplete();
        }
    },

    /**
     * Update autocomplete selection highlighting
     * @private
     */
    updateAutocompleteSelection(items) {
        items.forEach((item, index) => {
            if (index === selectedChartsIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    },

    /**
     * Select an autocomplete item
     * @private
     */
    selectAutocompleteItem(index) {
        const result = chartsAutocompleteResults[index];
        if (!result) return;

        isProcessingChartsSelection = true;

        const airportInput = document.getElementById('chartsAirportInput');
        if (airportInput) {
            airportInput.value = result.code;
        }

        setTimeout(() => {
            isProcessingChartsSelection = false;
            this.hideAutocomplete();
            // Automatically search for charts
            this.searchCharts();
        }, 100);
    },

    /**
     * Save airport to charts history
     * @private
     */
    saveToHistory(icao) {
        const MAX_HISTORY = 10;
        let history = JSON.parse(localStorage.getItem('chartsHistory') || '[]');

        // Remove duplicates
        history = history.filter(item => item !== icao);

        // Add to beginning
        history.unshift(icao);

        // Limit size
        if (history.length > MAX_HISTORY) {
            history = history.slice(0, MAX_HISTORY);
        }

        localStorage.setItem('chartsHistory', JSON.stringify(history));
        this.displayChartsHistory();
    },

    /**
     * Display recent charts history
     */
    displayChartsHistory() {
        const history = JSON.parse(localStorage.getItem('chartsHistory') || '[]');
        const historyDiv = document.getElementById('chartsHistory');
        const historyList = document.getElementById('chartsHistoryList');

        if (!historyDiv || !historyList) return;

        if (history.length === 0) {
            historyDiv.style.display = 'none';
            return;
        }

        historyDiv.style.display = 'block';
        historyList.innerHTML = '';

        history.forEach(icao => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.textContent = icao;
            item.addEventListener('click', () => {
                const airportInput = document.getElementById('chartsAirportInput');
                if (airportInput) {
                    airportInput.value = icao;
                }
                this.showChartsForAirport(icao);
            });
            historyList.appendChild(item);
        });
    }
};
