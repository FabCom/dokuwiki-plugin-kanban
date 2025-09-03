/**
 * Kanban Filters and Search System
 * Handles filtering and searching within kanban boards
 */

class KanbanFilters {
    constructor(kanbanId) {
        this.kanbanId = kanbanId;
        this.kanbanElement = document.getElementById(kanbanId);
        this.activeFilters = {
            search: '',
            tags: [],
            assignees: [],
            priorities: [],
            dateRange: null
        };
        this.originalData = null;
        this.filteredData = null;
        this.init();
    }

    init() {
        this.toggleInProgress = false; // Flag to prevent double events
        this.createFilterUI();
        this.bindEvents();
        this.extractOriginalData();
        
        // Initialize display - show all cards by default
        this.showAllCards();
    }

    /**
     * Public initialize method for external calling
     */
    initialize() {
        return this.init();
    }

    /**
     * Show all cards (remove any filtering)
     */
    showAllCards() {
        const allCards = this.kanbanElement.querySelectorAll('.kanban-card');
        allCards.forEach(cardElement => {
            cardElement.style.display = '';
            cardElement.classList.remove('filtering-out');
        });

        // Remove empty-filtered class from columns
        const columns = this.kanbanElement.querySelectorAll('.kanban-column');
        columns.forEach(column => {
            column.classList.remove('empty-filtered');
        });
    }

    /**
     * Create the filter UI elements
     */
    createFilterUI() {
        const kanbanElement = this.kanbanElement;
        if (!kanbanElement) {
            console.error('Kanban element not found for ID:', this.kanbanId);
            return;
        }

        // Find the filters container that was already rendered by PHP
        const filtersContainer = kanbanElement.querySelector('.kanban-filters-container');
        if (!filtersContainer) {
            console.warn('Filters container not found for kanban:', this.kanbanId);
            console.log('Available elements in kanban:', kanbanElement.innerHTML);
            return;
        }

        console.log('Filters container found for:', this.kanbanId);
        // The HTML is already there, we just need to populate dynamic elements
        this.populateDynamicFilters();
    }

    /**
     * Populate dynamic filter content (tags, assignees)
     */
    populateDynamicFilters() {
        // Extract data from current kanban board
        this.extractOriginalData();
        
        // Populate tags filter
        this.populateTagsFilter();
        
        // Populate assignees filter
        this.populateAssigneesFilter();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        console.log('Binding events for kanban:', this.kanbanId); // Debug log
        const searchInput = document.getElementById(`search-${this.kanbanId}`);
        const filtersToggle = document.getElementById(`toggle-filters-${this.kanbanId}`);
        const clearFilters = document.getElementById(`clear-filters-${this.kanbanId}`);
        const advancedFilters = document.getElementById(`advanced-filters-${this.kanbanId}`);

        // Search input
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchValue = e.target.value.toLowerCase();
                
                // Only apply filters if search has 3+ characters or is empty
                if (searchValue.length >= 3 || searchValue.length === 0) {
                    this.activeFilters.search = searchValue;
                    this.applyFilters();
                } else {
                    // If less than 3 characters, show all cards
                    this.activeFilters.search = '';
                    this.applyFilters();
                }
            });
        } else {
            console.warn('Search input not found:', `search-${this.kanbanId}`);
        }

        // Filters toggle
        if (filtersToggle) {
            // Remove any existing listeners to prevent double binding
            const newToggleButton = filtersToggle.cloneNode(true);
            filtersToggle.parentNode.replaceChild(newToggleButton, filtersToggle);
            
            newToggleButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Prevent double events
                if (this.toggleInProgress) {
                    console.log('Toggle already in progress, ignoring click');
                    return;
                }
                
                this.toggleInProgress = true;
                console.log('Toggle button clicked!'); // Debug log
                
                const isVisible = advancedFilters.classList.contains('active');
                
                if (isVisible) {
                    advancedFilters.classList.remove('active');
                } else {
                    advancedFilters.classList.add('active');
                    this.populateFilterOptions();
                }
                
                // Update text and icon
                const textSpan = newToggleButton.querySelector('.toggle-text');
                const iconSpan = newToggleButton.querySelector('.toggle-icon');
                if (textSpan) textSpan.textContent = isVisible ? '📋 Filtres' : '📋 Masquer';
                if (iconSpan) iconSpan.textContent = isVisible ? '▼' : '▲';
                
                console.log('Filters panel visibility:', !isVisible); // Debug log
                console.log('Advanced filters element:', advancedFilters); // Debug log
                console.log('Advanced filters classes:', advancedFilters.className); // Debug log
                console.log('Advanced filters computed display:', window.getComputedStyle(advancedFilters).display); // Debug log
                
                // Reset flag after a short delay
                setTimeout(() => {
                    this.toggleInProgress = false;
                }, 100);
            });
        } else {
            console.warn('Filters toggle button not found:', `toggle-filters-${this.kanbanId}`);
        }

        // Clear filters
        if (clearFilters) {
            clearFilters.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }

        // Filter checkboxes and selects
        if (advancedFilters) {
            advancedFilters.addEventListener('change', (e) => {
                this.handleFilterChange(e);
            });
        }
    }

    /**
     * Extract original data from kanban
     */
    extractOriginalData() {
        const dataScript = this.kanbanElement.querySelector('script.kanban-data');
        if (dataScript) {
            try {
                this.originalData = JSON.parse(dataScript.textContent);
                this.filteredData = JSON.parse(JSON.stringify(this.originalData)); // Deep copy
            } catch (e) {
                console.error('Failed to parse kanban data:', e);
            }
        }
    }

    /**
     * Populate filter options based on current data
     */
    populateFilterOptions() {
        this.populateTagsFilter();
        this.populateAssigneesFilter();
    }

    /**
     * Populate tags filter with all available tags
     */
    populateTagsFilter() {
        const tagsContainer = document.getElementById(`tags-filter-${this.kanbanId}`);
        if (!tagsContainer || !this.originalData) return;

        const allTags = new Set();
        this.originalData.columns.forEach(column => {
            column.cards.forEach(card => {
                if (card.tags) {
                    card.tags.forEach(tag => allTags.add(tag));
                }
            });
        });

        tagsContainer.innerHTML = Array.from(allTags).map(tag => `
            <label class="kanban-filter-checkbox">
                <input type="checkbox" value="${tag}" data-filter="tags">
                <span class="kanban-tag">#${tag}</span>
            </label>
        `).join('');
    }

    /**
     * Populate assignees filter with all available assignees
     */
    populateAssigneesFilter() {
        const assigneesContainer = document.getElementById(`assignees-filter-${this.kanbanId}`);
        if (!assigneesContainer || !this.originalData) return;

        const allAssignees = new Set();
        this.originalData.columns.forEach(column => {
            column.cards.forEach(card => {
                if (card.assignee) {
                    allAssignees.add(card.assignee);
                }
            });
        });

        assigneesContainer.innerHTML = Array.from(allAssignees).map(assignee => `
            <label class="kanban-filter-checkbox">
                <input type="checkbox" value="${assignee}" data-filter="assignees">
                <span class="kanban-assignee">👤 ${assignee}</span>
            </label>
        `).join('');
    }

    /**
     * Handle filter changes
     */
    handleFilterChange(e) {
        const filterType = e.target.dataset.filter;
        const value = e.target.value;

        switch (filterType) {
            case 'tags':
                this.toggleArrayFilter('tags', value, e.target.checked);
                break;
            case 'assignees':
                this.toggleArrayFilter('assignees', value, e.target.checked);
                break;
            case 'priority':
                this.toggleArrayFilter('priorities', value, e.target.checked);
                break;
            case 'dateRange':
                this.activeFilters.dateRange = value || null;
                break;
        }

        this.applyFilters();
    }

    /**
     * Toggle array-based filters (tags, assignees, priorities)
     */
    toggleArrayFilter(filterType, value, checked) {
        if (checked) {
            if (!this.activeFilters[filterType].includes(value)) {
                this.activeFilters[filterType].push(value);
            }
        } else {
            this.activeFilters[filterType] = this.activeFilters[filterType].filter(item => item !== value);
        }
    }

    /**
     * Apply all active filters to the kanban data
     */
    applyFilters() {
        if (!this.originalData) {
            console.warn('No original data available for filtering');
            return;
        }

        // If no filters are active, show all cards
        if (!this.hasActiveFilters()) {
            this.filteredData = JSON.parse(JSON.stringify(this.originalData));
            this.updateKanbanDisplay();
            this.updateFilterStatus();
            return;
        }

        // Start with original data
        this.filteredData = JSON.parse(JSON.stringify(this.originalData));

        // Apply filters to each column
        this.filteredData.columns.forEach(column => {
            column.cards = column.cards.filter(card => this.matchesFilters(card));
        });

        this.updateKanbanDisplay();
        this.updateFilterStatus();
    }

    /**
     * Check if a card matches all active filters
     */
    matchesFilters(card) {
        // Search filter
        if (this.activeFilters.search) {
            const searchText = this.activeFilters.search;
            
            // Build searchable text from all card fields
            const searchableFields = [
                card.title || '',
                card.description || '',
                (card.tags || []).join(' '),
                card.assignee || '',
                card.creator || '',
                card.dueDate || ''
            ];
            
            // Add internal links text
            if (card.internalLinks) {
                card.internalLinks.forEach(link => {
                    searchableFields.push(link.text || '');
                    searchableFields.push(link.target || '');
                });
            }
            
            // Add external links text  
            if (card.externalLinks) {
                card.externalLinks.forEach(link => {
                    searchableFields.push(link.text || '');
                    searchableFields.push(link.url || '');
                });
            }
            
            const cardText = searchableFields.join(' ').toLowerCase();

            if (!cardText.includes(searchText)) {
                return false;
            }
        }

        // Tags filter
        if (this.activeFilters.tags.length > 0) {
            const cardTags = card.tags || [];
            if (!this.activeFilters.tags.some(tag => cardTags.includes(tag))) {
                return false;
            }
        }

        // Assignees filter
        if (this.activeFilters.assignees.length > 0) {
            if (!card.assignee || !this.activeFilters.assignees.includes(card.assignee)) {
                return false;
            }
        }

        // Priority filter
        if (this.activeFilters.priorities.length > 0) {
            const cardPriority = card.priority || 'normal';
            if (!this.activeFilters.priorities.includes(cardPriority)) {
                return false;
            }
        }

        // Date range filter
        if (this.activeFilters.dateRange) {
            if (!this.matchesDateFilter(card, this.activeFilters.dateRange)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if a card matches the date filter
     */
    matchesDateFilter(card, dateRange) {
        const dueDate = card.dueDate ? new Date(card.dueDate) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (dateRange) {
            case 'overdue':
                return dueDate && dueDate < today;
            case 'today':
                return dueDate && dueDate.toDateString() === today.toDateString();
            case 'tomorrow':
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                return dueDate && dueDate.toDateString() === tomorrow.toDateString();
            case 'this-week':
                const weekEnd = new Date(today);
                weekEnd.setDate(weekEnd.getDate() + (7 - today.getDay()));
                return dueDate && dueDate >= today && dueDate <= weekEnd;
            case 'next-week':
                const nextWeekStart = new Date(today);
                nextWeekStart.setDate(nextWeekStart.getDate() + (7 - today.getDay()) + 1);
                const nextWeekEnd = new Date(nextWeekStart);
                nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
                return dueDate && dueDate >= nextWeekStart && dueDate <= nextWeekEnd;
            case 'this-month':
                return dueDate && dueDate.getMonth() === today.getMonth() && dueDate.getFullYear() === today.getFullYear();
            case 'no-date':
                return !dueDate;
            default:
                return true;
        }
    }

    /**
     * Update the kanban display with filtered data
     */
    updateKanbanDisplay() {
        // Hide/show cards based on filtered data
        const allCards = this.kanbanElement.querySelectorAll('.kanban-card');
        
        // Get list of visible card IDs from filtered data
        const visibleCardIds = new Set();
        if (this.filteredData && this.filteredData.columns) {
            this.filteredData.columns.forEach(column => {
                if (column.cards) {
                    column.cards.forEach(card => {
                        visibleCardIds.add(card.id);
                    });
                }
            });
        }
        
        // Show/hide cards
        allCards.forEach(cardElement => {
            const cardId = cardElement.id; // Use the element's id attribute instead of data-card-id
            if (visibleCardIds.has(cardId)) {
                cardElement.style.display = '';
                cardElement.classList.remove('filtering-out');
            } else {
                cardElement.style.display = 'none';
                cardElement.classList.add('filtering-out');
            }
        });
        
        // Update empty column states
        const columns = this.kanbanElement.querySelectorAll('.kanban-column');
        columns.forEach(column => {
            const visibleCards = column.querySelectorAll('.kanban-card:not([style*="display: none"])');
            if (visibleCards.length === 0) {
                column.classList.add('empty-filtered');
            } else {
                column.classList.remove('empty-filtered');
            }
        });
    }

    /**
     * Update filter status display
     */
    updateFilterStatus() {
        const statusContainer = document.getElementById(`filter-status-${this.kanbanId}`);
        const clearButton = document.getElementById(`clear-filters-${this.kanbanId}`);
        
        if (!statusContainer) return;

        const hasActiveFilters = this.hasActiveFilters();
        
        if (hasActiveFilters) {
            const totalCards = this.countTotalCards(this.originalData);
            const filteredCards = this.countTotalCards(this.filteredData);
            
            statusContainer.style.display = 'block';
            statusContainer.querySelector('.kanban-filter-count').textContent = 
                `📊 ${filteredCards} cartes affichées sur ${totalCards}`;
            
            this.updateActiveFiltersList();
            
            if (clearButton) {
                clearButton.style.display = 'inline-block';
            }
        } else {
            statusContainer.style.display = 'none';
            if (clearButton) {
                clearButton.style.display = 'none';
            }
        }
    }

    /**
     * Check if there are active filters
     */
    hasActiveFilters() {
        return this.activeFilters.search !== '' ||
               this.activeFilters.tags.length > 0 ||
               this.activeFilters.assignees.length > 0 ||
               this.activeFilters.priorities.length > 0 ||
               this.activeFilters.dateRange !== null;
    }

    /**
     * Count total cards in data
     */
    countTotalCards(data) {
        if (!data) return 0;
        return data.columns.reduce((total, column) => total + column.cards.length, 0);
    }

    /**
     * Update the list of active filters
     */
    updateActiveFiltersList() {
        const activeFiltersContainer = document.querySelector(`#kanban-filter-status-${this.kanbanId} .kanban-active-filters`);
        if (!activeFiltersContainer) return;

        const activeFiltersList = [];

        if (this.activeFilters.search) {
            activeFiltersList.push(`🔍 "${this.activeFilters.search}"`);
        }

        if (this.activeFilters.tags.length > 0) {
            activeFiltersList.push(`🏷️ ${this.activeFilters.tags.map(tag => `#${tag}`).join(', ')}`);
        }

        if (this.activeFilters.assignees.length > 0) {
            activeFiltersList.push(`👤 ${this.activeFilters.assignees.join(', ')}`);
        }

        if (this.activeFilters.priorities.length > 0) {
            const priorityEmojis = { high: '🔴', medium: '🟡', normal: '🟢', low: '🔵' };
            activeFiltersList.push(`⭐ ${this.activeFilters.priorities.map(p => priorityEmojis[p] || p).join(', ')}`);
        }

        if (this.activeFilters.dateRange) {
            const dateLabels = {
                'overdue': '⏰ En retard',
                'today': '📅 Aujourd\'hui',
                'tomorrow': '📅 Demain',
                'this-week': '📅 Cette semaine',
                'next-week': '📅 Semaine prochaine',
                'this-month': '📅 Ce mois',
                'no-date': '📅 Sans date'
            };
            activeFiltersList.push(dateLabels[this.activeFilters.dateRange] || this.activeFilters.dateRange);
        }

        activeFiltersContainer.innerHTML = activeFiltersList.map(filter => 
            `<span class="kanban-active-filter">${filter}</span>`
        ).join('');
    }

    /**
     * Clear all filters
     */
    clearAllFilters() {
        // Reset filter state
        this.activeFilters = {
            search: '',
            tags: [],
            assignees: [],
            priorities: [],
            dateRange: null
        };

        // Clear UI elements
        const searchInput = document.getElementById(`search-${this.kanbanId}`);
        if (searchInput) {
            searchInput.value = '';
        }

        // Clear checkboxes
        const advancedFilters = document.getElementById(`advanced-filters-${this.kanbanId}`);
        if (advancedFilters) {
            const checkboxes = advancedFilters.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => checkbox.checked = false);

            const selects = advancedFilters.querySelectorAll('select');
            selects.forEach(select => select.value = '');
        }

        // Apply filters (which will show all cards)
        this.applyFilters();
    }

    /**
     * Get current filter state for external use
     */
    getFilterState() {
        return {
            ...this.activeFilters,
            hasActiveFilters: this.hasActiveFilters(),
            filteredCount: this.countTotalCards(this.filteredData),
            totalCount: this.countTotalCards(this.originalData)
        };
    }
}

// Global function to initialize filters for a kanban
window.initKanbanFilters = function(kanbanId) {
    if (!window.kanbanFilters) {
        window.kanbanFilters = {};
    }
    window.kanbanFilters[kanbanId] = new KanbanFilters(kanbanId);
    return window.kanbanFilters[kanbanId];
};

// Export KanbanFilters class to global scope
window.KanbanFilters = KanbanFilters;

// Auto-initialize filters when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Find all kanban boards and initialize filters
    const kanbanBoards = document.querySelectorAll('.kanban-board[id^="kanban_"]');
    kanbanBoards.forEach(board => {
        if (!board.classList.contains('kanban-read-only')) {
            window.initKanbanFilters(board.id);
        }
    });
});
