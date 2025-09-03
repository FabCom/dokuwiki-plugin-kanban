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
        this.eventsBindingDone = false; // Flag to prevent multiple binding
        this.createFilterUI();
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

        this.resetFilterStatus();
    }

    /**
     * Show only a specific card (useful for direct links)
     */
    showOnlyCard(cardId) {
        const allCards = this.kanbanElement.querySelectorAll('.kanban-card');
        const targetCard = document.getElementById(cardId);
        
        if (!targetCard) {
            console.warn(`Card with ID ${cardId} not found`);
            return;
        }

        allCards.forEach(cardElement => {
            if (cardElement.id === cardId) {
                cardElement.style.display = '';
                cardElement.classList.remove('filtering-out');
            } else {
                cardElement.style.display = 'none';
                cardElement.classList.add('filtering-out');
            }
        });

        // Update column visibility
        const columns = this.kanbanElement.querySelectorAll('.kanban-column');
        columns.forEach(column => {
            const visibleCards = column.querySelectorAll('.kanban-card:not(.filtering-out)');
            if (visibleCards.length === 0) {
                column.classList.add('empty-filtered');
            } else {
                column.classList.remove('empty-filtered');
            }
        });

        // Update filter status
        this.updateSingleCardFilterStatus(cardId);
    }

    /**
     * Reset filter status to show all cards
     */
    resetFilterStatus() {
        const statusElement = this.kanbanElement.querySelector('.filter-status');
        if (statusElement) {
            statusElement.textContent = 'Tous les éléments visibles';
        }
        
        // Reset filter form inputs
        const filterForm = this.kanbanElement.querySelector('.filter-form');
        if (filterForm) {
            const inputs = filterForm.querySelectorAll('input, select');
            inputs.forEach(input => {
                if (input.type === 'checkbox' || input.type === 'radio') {
                    input.checked = false;
                } else {
                    input.value = '';
                }
            });
        }
    }

    /**
     * Update filter status for single card view
     */
    updateSingleCardFilterStatus(cardId) {
        const statusElement = this.kanbanElement.querySelector('.filter-status');
        if (statusElement) {
            const card = document.getElementById(cardId);
            const cardTitle = card ? card.querySelector('.kanban-card-title')?.textContent : cardId;
            statusElement.textContent = `Affichage de la carte: ${cardTitle}`;
        }
    }

    /**
     * Create the filter UI elements
     */
    createFilterUI() {
        const kanbanElement = this.kanbanElement;
        if (!kanbanElement) {
            return;
        }

        // Find the filters container that was already rendered by PHP
        const filtersContainer = kanbanElement.querySelector('.kanban-filters-container');
        if (!filtersContainer) {
            // Try again in a moment - the content might still be loading
            setTimeout(() => {
                const retryContainer = kanbanElement.querySelector('.kanban-filters-container');
                if (retryContainer) {
                    this.populateDynamicFilters();
                    // Bind events only once
                    if (!this.eventsBindingDone) {
                        this.bindEvents();
                        this.eventsBindingDone = true;
                    }
                }
            }, 500);
            return;
        }

        // The HTML is already there, we just need to populate dynamic elements
        this.populateDynamicFilters();
        
        // Bind events only once
        if (!this.eventsBindingDone) {
            this.bindEvents();
            this.eventsBindingDone = true;
        }
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
        // Check if filters container exists before binding
        const filtersContainer = this.kanbanElement.querySelector('.kanban-filters-container');
        if (!filtersContainer) {
            return;
        }
        
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
            // Search input not found - may not be needed
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
                    return;
                }
                
                this.toggleInProgress = true;
                
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
                
                // Reset flag after a short delay
                setTimeout(() => {
                    this.toggleInProgress = false;
                }, 100);
            });
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

        // Sort buttons
        const sortButtons = this.kanbanElement.querySelectorAll('.kanban-sort-btn');
        let sortInProgress = false; // Flag to prevent double clicks
        
        sortButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Prevent multiple clicks during processing
                if (sortInProgress) {
                    return;
                }
                
                const sortType = button.dataset.sort;
                
                // CRITICAL: Save the state BEFORE any async operations
                const wasActiveBeforeClick = button.classList.contains('active');
                
                sortInProgress = true;
                
                try {
                    if (wasActiveBeforeClick) {
                        // If button was active, deactivate (clear all highlights)
                        button.classList.remove('active');
                        this.clearSortHighlights(true); // Hide status when deactivating
                        this.showSortingResults('Tri désactivé', 0);
                    } else {
                        // Remove active class from all other buttons first
                        sortButtons.forEach(btn => btn.classList.remove('active'));
                        
                        // Activate clicked button immediately
                        button.classList.add('active');
                        
                        // Apply sorting - even if this takes time, button state is already set
                        await this.applySorting(sortType);
                    }
                } catch (error) {
                    console.error('Error in sort button handler:', error);
                    // Reset button state on error
                    button.classList.remove('active');
                    this.showSortingResults('❌ Erreur lors du tri', 0);
                } finally {
                    sortInProgress = false;
                }
            });
        });
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
            case 'next-month':
                const nextMonth = new Date(today);
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                return dueDate && dueDate.getMonth() === nextMonth.getMonth() && dueDate.getFullYear() === nextMonth.getFullYear();
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
     * Update filter status for single card display
     */
    updateSingleCardFilterStatus(cardId) {
        const statusContainer = document.getElementById(`filter-status-${this.kanbanId}`);
        const clearButton = document.getElementById(`clear-filters-${this.kanbanId}`);
        
        if (!statusContainer) return;

        const cardElement = document.getElementById(cardId);
        const cardTitle = cardElement ? cardElement.querySelector('.kanban-card-title')?.textContent : 'Carte';
        
        statusContainer.style.display = 'block';
        statusContainer.querySelector('.kanban-filter-count').textContent = 
            `🎯 Affichage d'une seule carte: "${cardTitle}"`;
        
        // Show active filter for single card
        const activeFiltersDiv = statusContainer.querySelector('.kanban-active-filters');
        if (activeFiltersDiv) {
            activeFiltersDiv.innerHTML = `
                <span class="kanban-active-filter">
                    <span class="filter-label">🔗 Lien direct</span>
                    <button class="filter-remove" onclick="window.kanbanFiltersInstances['${this.kanbanId}'].showAllCards()">×</button>
                </span>
            `;
        }
        
        if (clearButton) {
            clearButton.style.display = 'inline-block';
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

    /**
     * Apply sorting to cards based on the selected criteria
     */
    async applySorting(sortType) {
        // Show loading indicator for potentially slow operations
        if (sortType === 'most-commented' || sortType === 'last-commented') {
            this.showSortingResults('⏳ Chargement des commentaires...', 0);
        } else {
            this.showSortingResults('⏳ Tri en cours...', 0);
        }
        
        // Clear previous highlighting
        this.clearSortHighlights(false); // Don't hide status, we'll update it

        try {
            switch (sortType) {
                case 'most-commented':
                    await this.highlightMostCommented();
                    break;
                case 'last-commented':
                    await this.highlightLastCommented();
                    break;
                case 'last-modified':
                    this.highlightLastModified();
                    break;
                case 'urgent':
                    this.highlightUrgent();
                    break;
                default:
                    console.warn('Unknown sort type:', sortType);
                    this.showSortingResults('❌ Type de tri inconnu', 0);
            }
        } catch (error) {
            console.error('Error in sorting:', error);
            this.showSortingResults('❌ Erreur lors du tri', 0);
            throw error; // Re-throw to be handled by caller
        }
    }

    /**
     * Clear all sort highlights from cards
     */
    clearSortHighlights(hideStatus = false) {
        const allCards = this.kanbanElement.querySelectorAll('.kanban-card');
        allCards.forEach(card => {
            card.classList.remove('highlight-top', 'highlight-recent', 'highlight-new', 'highlight-urgent');
        });
        
        // Only hide sorting status if explicitly requested (for deactivation)
        if (hideStatus) {
            const statusContainer = document.getElementById(`filter-status-${this.kanbanId}`);
            if (statusContainer) {
                statusContainer.style.display = 'none';
            }
        }
    }

    /**
     * Highlight the top 3 most commented cards (optimized avec batch loading)
     */
    async highlightMostCommented() {
        if (!this.originalData || !this.originalData.columns) return;

        console.log('highlightMostCommented: Starting...'); // Debug
        
        // Get current page ID
        const pageId = window.JSINFO?.id || 'playground:kanban';
        console.log('highlightMostCommented: Page ID =', pageId); // Debug
        
        // Collect all cards IDs for batch loading
        const cardsToCheck = [];
        const cardIds = [];
        this.originalData.columns.forEach(column => {
            if (column.cards) {
                column.cards.forEach(card => {
                    cardsToCheck.push(card);
                    cardIds.push(card.id);
                });
            }
        });
        
        console.log('📦 Batch loading discussions for', cardIds.length, 'cards...'); // Debug
        
        // Use batch loading for better performance
        let batchCounts = {};
        if (window.KanbanDiscussions && window.KanbanDiscussions.getBatchDiscussionCounts) {
            try {
                batchCounts = await window.KanbanDiscussions.getBatchDiscussionCounts(pageId, cardIds);
                console.log('✅ Batch loading completed:', batchCounts); // Debug
            } catch (error) {
                console.log('❌ Batch loading failed, falling back to individual calls:', error);
            }
        }
        
        // Process cards with comment counts
        const cardsWithComments = cardsToCheck.map(card => {
            let commentCount = 0;
            
            // First try embedded comment data (fastest)
            if (card.comments && Array.isArray(card.comments)) {
                commentCount = card.comments.length;
            } else if (card.comment_count) {
                commentCount = parseInt(card.comment_count) || 0;
            } else if (card.commentCount) {
                commentCount = parseInt(card.commentCount) || 0;
            } else if (batchCounts[card.id] !== undefined) {
                // Use batch-loaded count
                commentCount = batchCounts[card.id];
            }
            
            return { 
                id: card.id, 
                commentCount: commentCount 
            };
        });

        console.log('highlightMostCommented: Results =', cardsWithComments); // Debug

        // Sort by comment count (descending) and take top 3
        const top3 = cardsWithComments
            .filter(card => card.commentCount > 0) // Only cards with comments
            .sort((a, b) => b.commentCount - a.commentCount)
            .slice(0, 3);

        console.log('highlightMostCommented: Top 3 =', top3); // Debug

        // Highlight top 3 cards
        top3.forEach(card => {
            const cardElement = document.getElementById(card.id);
            if (cardElement) {
                cardElement.classList.add('highlight-top');
            }
        });

        this.showSortingResults(`Top 3 cartes les plus commentées`, top3.length);
    }

    /**
     * Highlight the last commented card (optimized avec batch loading)
     */
    async highlightLastCommented() {
        if (!this.originalData || !this.originalData.columns) return;
        
        // Get current page ID
        const pageId = window.JSINFO?.id || 'playground:kanban';
        
        let lastCommentedCard = null;
        let lastCommentDate = null;

        // Create array of cards to check
        const cardsToCheck = [];
        const cardIds = [];
        this.originalData.columns.forEach(column => {
            if (column.cards) {
                column.cards.forEach(card => {
                    cardsToCheck.push(card);
                    cardIds.push(card.id);
                });
            }
        });

        console.log('🕒 Checking last commented card for', cardIds.length, 'cards...'); // Debug

        // Use Promise.all to check all cards in parallel for better performance
        const cardPromises = cardsToCheck.map(async (card) => {
            let mostRecentDate = null;
            
            // Try different comment property names first (fast check)
            if (card.comments && Array.isArray(card.comments) && card.comments.length > 0) {
                const mostRecentComment = card.comments
                    .filter(comment => comment.date || comment.timestamp)
                    .sort((a, b) => {
                        const dateA = new Date(a.date || a.timestamp);
                        const dateB = new Date(b.date || b.timestamp);
                        return dateB - dateA;
                    })[0];
                
                if (mostRecentComment) {
                    mostRecentDate = mostRecentComment.date || mostRecentComment.timestamp;
                }
            } else if (card.lastComment) {
                mostRecentDate = card.lastComment.date || card.lastComment;
            } else {
                // Use cached discussions API (cache is handled in discussions.js)
                if (window.KanbanDiscussions && window.KanbanDiscussions.getDiscussionCount) {
                    try {
                        // Use lightweight check first - just get the count
                        const discussionCount = await window.KanbanDiscussions.getDiscussionCount(pageId, card.id);
                        console.log('🌐 API discussion count for card', card.id, '=', discussionCount); // Debug
                        
                        if (discussionCount > 0) {
                            // Only load full discussions if there are actually comments
                            const discussions = await window.KanbanDiscussions.loadCardDiscussions(pageId, card.id);
                            console.log('💬 Loaded discussions for card', card.id, ':', discussions); // Debug
                            
                            if (discussions && discussions.length > 0) {
                                const sortedDiscussions = discussions
                                    .filter(d => d.timestamp || d.date)
                                    .sort((a, b) => {
                                        const dateA = new Date(a.timestamp || a.date);
                                        const dateB = new Date(b.timestamp || b.date);
                                        return dateB - dateA;
                                    });
                                
                                if (sortedDiscussions.length > 0) {
                                    mostRecentDate = sortedDiscussions[0].timestamp || sortedDiscussions[0].date;
                                    console.log('📅 Most recent date for card', card.id, ':', mostRecentDate); // Debug
                                }
                            }
                        }
                    } catch (error) {
                        console.log('❌ Error getting discussions for card:', card.id, error);
                    }
                }
            }
            
            return {
                card: card,
                date: mostRecentDate ? new Date(mostRecentDate) : null
            };
        });

        // Wait for all card checks to complete
        const results = await Promise.all(cardPromises);
        console.log('highlightLastCommented: All results =', results); // Debug
        
        // Find the card with the most recent comment
        results.forEach(result => {
            if (result.date && (!lastCommentDate || result.date > lastCommentDate)) {
                lastCommentDate = result.date;
                lastCommentedCard = result.card;
                console.log('highlightLastCommented: New most recent card =', result.card.id, 'date =', result.date); // Debug
            }
        });

        console.log('highlightLastCommented: Final result - card:', lastCommentedCard?.id, 'date:', lastCommentDate); // Debug

        if (lastCommentedCard) {
            const cardElement = document.getElementById(lastCommentedCard.id);
            if (cardElement) {
                cardElement.classList.add('highlight-recent');
                console.log('highlightLastCommented: Highlighted card', lastCommentedCard.id); // Debug
            } else {
                console.log('highlightLastCommented: Card element not found for', lastCommentedCard.id); // Debug
            }
            this.showSortingResults(`Dernière carte commentée`, 1);
        } else {
            console.log('highlightLastCommented: No commented cards found'); // Debug
            this.showSortingResults(`Aucune carte avec commentaires`, 0);
        }
        
        console.log('highlightLastCommented: Completed'); // Debug
    }

    /**
     * Highlight the 3 last modified cards
     */
    highlightLastModified() {
        if (!this.originalData || !this.originalData.columns) return;

        // Collect all cards with modification dates
        const cardsWithDates = [];
        this.originalData.columns.forEach(column => {
            if (column.cards) {
                column.cards.forEach(card => {
                    // Try different modification date properties
                    let modifiedDate = null;
                    
                    if (card.lastModified) {
                        modifiedDate = new Date(card.lastModified);
                    } else if (card.modified) {
                        modifiedDate = new Date(card.modified);
                    } else if (card.updated) {
                        modifiedDate = new Date(card.updated);
                    } else if (card.created) {
                        // Fallback to creation date if no modification date
                        modifiedDate = new Date(card.created);
                    }
                    
                    if (modifiedDate && !isNaN(modifiedDate)) {
                        cardsWithDates.push({ 
                            id: card.id, 
                            modifiedDate: modifiedDate 
                        });
                    }
                });
            }
        });

        // Sort by modification date (descending) and take top 3
        const last3Modified = cardsWithDates
            .sort((a, b) => b.modifiedDate - a.modifiedDate)
            .slice(0, 3);

        // Highlight last 3 modified cards
        last3Modified.forEach(card => {
            const cardElement = document.getElementById(card.id);
            if (cardElement) {
                cardElement.classList.add('highlight-new'); // Reuse the same highlight class
            }
        });

        this.showSortingResults(`3 dernières cartes modifiées`, last3Modified.length);
    }

    /**
     * Highlight urgent cards (high priority + due soon)
     */
    highlightUrgent() {
        if (!this.originalData || !this.originalData.columns) return;

        const today = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(today.getDate() + 3);
        
        let count = 0;
        this.originalData.columns.forEach(column => {
            if (column.cards) {
                column.cards.forEach(card => {
                    const isHighPriority = card.priority === 'high';
                    const dueDate = card.dueDate ? new Date(card.dueDate) : null;
                    const isDueSoon = dueDate && dueDate <= threeDaysFromNow;
                    const isOverdue = dueDate && dueDate < today;

                    if (isHighPriority || isDueSoon || isOverdue) {
                        const cardElement = document.getElementById(card.id);
                        if (cardElement) {
                            cardElement.classList.add('highlight-urgent');
                            count++;
                        }
                    }
                });
            }
        });

        this.showSortingResults(`Cartes urgentes`, count);
    }

    /**
     * Show sorting results in the filter status
     */
    showSortingResults(message, count) {
        const statusContainer = document.getElementById(`filter-status-${this.kanbanId}`);
        if (statusContainer) {
            statusContainer.style.display = 'block';
            statusContainer.innerHTML = `
                <span class="kanban-filter-count">
                    📊 ${message}: ${count} carte(s)
                </span>
            `;
        }
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
