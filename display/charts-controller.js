/**
 * Charts Controller - Manages chart display and selection
 * @module ChartsController
 */

window.ChartsController = {
    /**
     * Initialize charts tab functionality
     */
    init() {
        const searchBtn = document.getElementById('chartsSearchBtn');
        const airportInput = document.getElementById('chartsAirportInput');

        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.searchCharts());
        }

        if (airportInput) {
            // Search on Enter key
            airportInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchCharts();
                }
            });

            // Auto-uppercase input
            airportInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }
    },

    /**
     * Search for charts for entered airport
     */
    searchCharts() {
        const airportInput = document.getElementById('chartsAirportInput');
        if (!airportInput) return;

        const icao = airportInput.value.trim().toUpperCase();
        if (!icao) {
            this.showError('Please enter an airport ICAO code');
            return;
        }

        this.showChartsForAirport(icao);
    },

    /**
     * Shows charts for an airport (called from navlog or search)
     * @param {string} icao - Airport ICAO code
     * @param {string} name - Optional airport name for display
     */
    showChartsForAirport(icao, name) {
        // Switch to charts tab
        const chartsTab = document.querySelector('[data-tab="charts"]');
        if (chartsTab) {
            chartsTab.click();
        }

        // Set input value
        const airportInput = document.getElementById('chartsAirportInput');
        if (airportInput) {
            airportInput.value = icao;
        }

        const charts = window.DataManager.getCharts(icao);

        if (!charts || charts.length === 0) {
            this._showNoCharts(icao, name);
            return;
        }

        // Get airport name if not provided
        if (!name) {
            const airport = window.DataManager.getAirport(icao);
            name = airport ? airport.name : icao;
        }

        const cycle = window.DataManager.getChartsCycle();
        this._renderCharts(icao, name, charts, cycle);
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
    }
};
