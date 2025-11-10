// Checklist Controller - Handles checklist interactions and persistence
// ============================================

const ChecklistController = (() => {
    const STORAGE_KEY = 'checklist_state';
    let elements = {};

    // ============================================
    // INITIALIZATION
    // ============================================

    function init() {
        cacheElements();
        setupEventListeners();
        loadChecklistState();
    }

    function cacheElements() {
        elements = {
            resetBtn: document.getElementById('resetChecklistBtn'),
            checkboxes: document.querySelectorAll('.checklist-checkbox'),
            sections: document.querySelectorAll('.checklist-card'),
            titles: document.querySelectorAll('.checklist-title-collapsible')
        };
    }

    function setupEventListeners() {
        // Reset button
        if (elements.resetBtn) {
            elements.resetBtn.addEventListener('click', resetChecklist);
        }

        // Save state and check section completion when checkbox is clicked
        elements.checkboxes.forEach(checkbox => {
            checkbox.addEventListener('click', () => {
                // Toggle 'checked' class on click
                checkbox.classList.toggle('checked');
                saveChecklistState();
                checkSectionCompletion();
            });
        });

        // Collapsible section titles
        elements.titles.forEach(title => {
            title.addEventListener('click', (e) => {
                const card = e.currentTarget.closest('.checklist-card');
                toggleSection(card);
            });
        });
    }

    // ============================================
    // PERSISTENCE
    // ============================================

    function saveChecklistState() {
        try {
            const state = {};
            elements.checkboxes.forEach((checkbox, index) => {
                state[`checkbox_${index}`] = checkbox.classList.contains('checked');
            });

            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            console.log('[ChecklistController] State saved');
        } catch (error) {
            console.error('[ChecklistController] Failed to save state:', error);
        }
    }

    function loadChecklistState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;

            const state = JSON.parse(saved);
            elements.checkboxes.forEach((checkbox, index) => {
                const key = `checkbox_${index}`;
                if (state[key] !== undefined) {
                    if (state[key]) {
                        checkbox.classList.add('checked');
                    } else {
                        checkbox.classList.remove('checked');
                    }
                }
            });

            checkSectionCompletion();
            console.log('[ChecklistController] State loaded');
        } catch (error) {
            console.error('[ChecklistController] Failed to load state:', error);
        }
    }

    function resetChecklist() {
        if (confirm('Reset all checklist items? This will uncheck everything.')) {
            elements.checkboxes.forEach(checkbox => {
                checkbox.classList.remove('checked');
            });

            // Collapse all sections except the first
            elements.sections.forEach((section, index) => {
                if (index === 0) {
                    expandSection(section);
                } else {
                    collapseSection(section);
                }
            });

            checkSectionCompletion();
            saveChecklistState();
            console.log('[ChecklistController] Checklist reset');
        }
    }

    // ============================================
    // ACCORDION FUNCTIONALITY
    // ============================================

    function toggleSection(card) {
        if (card.classList.contains('collapsed')) {
            expandSection(card);
        } else {
            collapseSection(card);
        }
    }

    function expandSection(card) {
        const itemsContainer = card.querySelector('.checklist-items');
        const chevron = card.querySelector('.checklist-chevron');

        card.classList.remove('collapsed');
        if (itemsContainer) itemsContainer.style.display = 'flex';
        if (chevron) chevron.textContent = '▼';
    }

    function collapseSection(card) {
        const itemsContainer = card.querySelector('.checklist-items');
        const chevron = card.querySelector('.checklist-chevron');

        card.classList.add('collapsed');
        if (itemsContainer) itemsContainer.style.display = 'none';
        if (chevron) chevron.textContent = '►';
    }

    function checkSectionCompletion() {
        elements.sections.forEach((section, sectionIndex) => {
            const checkboxes = section.querySelectorAll('.checklist-checkbox');
            const allChecked = Array.from(checkboxes).every(cb => cb.classList.contains('checked'));
            const title = section.querySelector('.checklist-title');

            if (allChecked && checkboxes.length > 0) {
                // Section complete - mark title as complete (green)
                if (title) title.classList.add('completed');

                // Collapse it and expand next
                collapseSection(section);

                const nextSection = elements.sections[sectionIndex + 1];
                if (nextSection && nextSection.classList.contains('collapsed')) {
                    expandSection(nextSection);
                }
            } else {
                // Section incomplete - remove completed style
                if (title) title.classList.remove('completed');
            }
        });
    }

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        init
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ChecklistController.init);
} else {
    ChecklistController.init();
}
