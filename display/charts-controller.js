/**
 * Charts Controller - Manages chart display and selection
 * @module ChartsController
 */

window.ChartsController = {
    /**
     * Shows chart selection modal for an airport
     * @param {string} icao - Airport ICAO code
     * @param {string} name - Airport name for display
     */
    showChartsModal(icao, name) {
        const charts = window.DataManager.getCharts(icao);

        if (!charts || charts.length === 0) {
            this._showNoChartsMessage(icao, name);
            return;
        }

        const cycle = window.DataManager.getChartsCycle();
        this._renderChartsModal(icao, name, charts, cycle);
    },

    /**
     * Renders the charts selection modal
     * @private
     */
    _renderChartsModal(icao, name, charts, cycle) {
        // Group charts by type
        const grouped = window.ChartsAdapter.groupChartsByType(charts);

        // Build modal HTML
        let modalHTML = `
            <div id="charts-modal" class="modal-overlay">
                <div class="modal-content charts-modal">
                    <div class="modal-header">
                        <h2>${name} (${icao})</h2>
                        <button class="modal-close" onclick="ChartsController.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="text-secondary text-sm mb-md">
                            <strong>TPP Cycle:</strong> ${cycle || 'Unknown'} |
                            <strong>Total Charts:</strong> ${charts.length}
                        </p>
                        <p class="text-warning text-xs mb-md">
                            ⚠️ Requires internet connection to view charts
                        </p>
        `;

        // Airport Diagrams (APD)
        if (grouped.APD.length > 0) {
            modalHTML += this._renderChartGroup('Airport Diagrams', grouped.APD);
        }

        // Approach Procedures (IAP)
        if (grouped.IAP.length > 0) {
            modalHTML += this._renderChartGroup('Instrument Approaches', grouped.IAP);
        }

        // Departure Procedures (DP + ODP)
        const departures = [...grouped.DP, ...grouped.ODP];
        if (departures.length > 0) {
            modalHTML += this._renderChartGroup('Departure Procedures', departures);
        }

        // Standard Arrivals (STAR)
        if (grouped.STAR.length > 0) {
            modalHTML += this._renderChartGroup('Standard Arrivals', grouped.STAR);
        }

        // Minimums (MIN)
        if (grouped.MIN.length > 0) {
            modalHTML += this._renderChartGroup('Minimums', grouped.MIN);
        }

        // Hot Spots (HOT)
        if (grouped.HOT.length > 0) {
            modalHTML += this._renderChartGroup('Hot Spots', grouped.HOT);
        }

        // Other
        if (grouped.OTHER.length > 0) {
            modalHTML += this._renderChartGroup('Other', grouped.OTHER);
        }

        modalHTML += `
                    </div>
                </div>
            </div>
        `;

        // Inject modal into DOM
        const existingModal = document.getElementById('charts-modal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add event listener to close on overlay click
        const modal = document.getElementById('charts-modal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Add keyboard listener for ESC key
        this._escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        };
        document.addEventListener('keydown', this._escapeHandler);
    },

    /**
     * Renders a group of charts
     * @private
     */
    _renderChartGroup(title, charts) {
        let html = `
            <div class="chart-group">
                <h3 class="chart-group-title">${title} (${charts.length})</h3>
                <div class="chart-list">
        `;

        charts.forEach(chart => {
            html += `
                <a href="${chart.url}"
                   target="_blank"
                   rel="noopener noreferrer"
                   class="chart-item">
                    <span class="chart-name">${chart.name}</span>
                    <span class="chart-icon">↗</span>
                </a>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    },

    /**
     * Shows message when no charts are available
     * @private
     */
    _showNoChartsMessage(icao, name) {
        const modalHTML = `
            <div id="charts-modal" class="modal-overlay">
                <div class="modal-content charts-modal">
                    <div class="modal-header">
                        <h2>${name} (${icao})</h2>
                        <button class="modal-close" onclick="ChartsController.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="text-center text-secondary">
                            <p class="text-lg mb-md">No charts available for this airport</p>
                            <p class="text-sm">
                                Charts are only available for airports with published instrument procedures,
                                airport diagrams, or other FAA Terminal Procedures Publications.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('charts-modal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add event listener to close on overlay click
        const modal = document.getElementById('charts-modal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Add keyboard listener for ESC key
        this._escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        };
        document.addEventListener('keydown', this._escapeHandler);
    },

    /**
     * Closes the charts modal
     */
    closeModal() {
        const modal = document.getElementById('charts-modal');
        if (modal) {
            modal.remove();
        }

        // Remove keyboard listener
        if (this._escapeHandler) {
            document.removeEventListener('keydown', this._escapeHandler);
            this._escapeHandler = null;
        }
    }
};
