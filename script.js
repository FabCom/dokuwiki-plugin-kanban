/**
 * Kanban Plugin JavaScript
 * Handles all interactive functionality for the kanban boards
 */

window.KanbanPlugin = (function() {
    'use strict';

    // Private variables
    let draggedCard = null;
    let isDragging = false;
    let isPageUnloading = false; // Flag to prevent saves during page unload

    /**
     * Get current user name from DokuWiki
     */
    function getCurrentUser() {
        // Priority 1: Try the kanban-specific JSINFO (most reliable)
        if (window.JSINFO && JSINFO.kanban_user && JSINFO.kanban_user !== 'Anonyme') {
            console.log('👤 Utilisateur détecté via JSINFO.kanban_user:', JSINFO.kanban_user);
            return JSINFO.kanban_user;
        }
        
        // Priority 2: Try meta tag injected by PHP
        const metaKanbanUser = document.querySelector('meta[name="kanban-user"]');
        if (metaKanbanUser && metaKanbanUser.content && metaKanbanUser.content !== 'Anonyme') {
            console.log('👤 Utilisateur détecté via meta kanban-user:', metaKanbanUser.content);
            return metaKanbanUser.content;
        }
        
        // Priority 3: Try standard DokuWiki user variables
        if (window.JSINFO && JSINFO.user && JSINFO.user !== '' && JSINFO.user !== 'Anonyme') {
            console.log('👤 Utilisateur détecté via JSINFO.user:', JSINFO.user);
            return JSINFO.user;
        }
        
        // Priority 4: Try other globals
        if (window.dw && dw.user && dw.user !== '' && dw.user !== 'Anonyme') {
            console.log('👤 Utilisateur détecté via dw.user:', dw.user);
            return dw.user;
        }
        
        if (window.INFO && INFO.user && INFO.user !== '' && INFO.user !== 'Anonyme') {
            console.log('👤 Utilisateur détecté via INFO.user:', INFO.user);
            return INFO.user;
        }
        
        // Priority 5: Standard meta tag
        const metaUser = document.querySelector('meta[name="user"]');
        if (metaUser && metaUser.content && metaUser.content !== 'Anonyme') {
            console.log('👤 Utilisateur détecté via meta user:', metaUser.content);
            return metaUser.content;
        }
        
        // Debug plus détaillé
        const debugInfo = {
            JSINFO_exists: typeof window.JSINFO !== 'undefined',
            JSINFO_kanban_user: window.JSINFO?.kanban_user,
            JSINFO_user: window.JSINFO?.user,
            JSINFO_id: window.JSINFO?.id,
            JSINFO_client: window.JSINFO?.client,
            JSINFO_debug: window.JSINFO?.kanban_debug,
            meta_kanban_user: document.querySelector('meta[name="kanban-user"]')?.content,
            meta_user: document.querySelector('meta[name="user"]')?.content,
            all_metas: Array.from(document.querySelectorAll('meta')).map(m => ({name: m.name, content: m.content})),
            full_JSINFO: window.JSINFO
        };
        
        console.log('⚠️ Aucun utilisateur détecté - Debug Info:', debugInfo);
        
        // Affichage visible pour debug
        if (window.console && console.warn) {
            console.warn('🚨 KANBAN: Utilisateur non détecté, utilisation du fallback');
        }
        
        // En dernier recours, utiliser un nom par défaut plutôt que "Inconnu"
        return 'Utilisateur';
    }

    /**
     * Get current date in ISO format for database storage
     */
    function getCurrentDateTime() {
        return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }

    /**
     * Get current date in French format for display
     */
    function getCurrentDate() {
        const now = new Date();
        const timestamp = now.getTime();
        return now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
    }

    /**
     * Add filter and sort controls to a board
     */
    function addControlsToBoard(board) {
        if (board.querySelector('.kanban-controls')) return; // Already added
        
        const controls = document.createElement('div');
        controls.className = 'kanban-controls';
        controls.innerHTML = `
            <div class="kanban-filter-group">
                <label>Filtrer par priorité:</label>
                <select class="kanban-filter-select" data-filter="priority">
                    <option value="">Toutes</option>
                    <option value="low">Basse</option>
                    <option value="normal">Normale</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Haute</option>
                </select>
            </div>
            
            <div class="kanban-filter-group">
                <label>Filtrer par assigné:</label>
                <select class="kanban-filter-select" data-filter="assignee">
                    <option value="">Tous</option>
                </select>
            </div>
            
            <div class="kanban-filter-group">
                <label>Trier par:</label>
                <button class="kanban-sort-btn" data-sort="priority">Priorité</button>
                <button class="kanban-sort-btn" data-sort="dueDate">Échéance</button>
                <button class="kanban-sort-btn" data-sort="created">Date création</button>
            </div>
        `;
        
        board.insertBefore(controls, board.querySelector('.kanban-columns'));
        
        // Populate assignee filter
        populateAssigneeFilter(board);
        
        // Add event listeners
        setupControlListeners(board);
    }

    /**
     * Populate assignee filter with unique values
     */
    function populateAssigneeFilter(board) {
        const assigneeSelect = board.querySelector('[data-filter="assignee"]');
        const assignees = new Set();
        
        board.querySelectorAll('.kanban-assignee').forEach(element => {
            const assignee = element.textContent.trim();
            if (assignee) assignees.add(assignee);
        });
        
        assignees.forEach(assignee => {
            const option = document.createElement('option');
            option.value = assignee;
            option.textContent = assignee;
            assigneeSelect.appendChild(option);
        });
    }

    /**
     * Setup event listeners for controls
     */
    function setupControlListeners(board) {
        // Filter listeners
        board.querySelectorAll('.kanban-filter-select').forEach(select => {
            select.addEventListener('change', () => applyFilters(board));
        });
        
        // Sort listeners
        board.querySelectorAll('.kanban-sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Toggle active state
                board.querySelectorAll('.kanban-sort-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const sortBy = btn.dataset.sort;
                sortCards(board, sortBy);
            });
        });
    }

    /**
     * Apply filters to cards
     */
    function applyFilters(board) {
        const priorityFilter = board.querySelector('[data-filter="priority"]').value;
        const assigneeFilter = board.querySelector('[data-filter="assignee"]').value;
        
        board.querySelectorAll('.kanban-card').forEach(card => {
            let visible = true;
            
            // Priority filter
            if (priorityFilter) {
                const cardPriority = Array.from(card.classList)
                    .find(cls => cls.startsWith('priority-'))?.replace('priority-', '') || 'normal';
                if (cardPriority !== priorityFilter) visible = false;
            }
            
            // Assignee filter
            if (assigneeFilter) {
                const cardAssignee = card.querySelector('.kanban-assignee')?.textContent.trim() || '';
                if (cardAssignee !== assigneeFilter) visible = false;
            }
            
            card.classList.toggle('filtered-out', !visible);
        });
    }

    /**
     * Sort cards within columns
     */
    function sortCards(board, sortBy) {
        board.querySelectorAll('.kanban-column').forEach(column => {
            const cardsContainer = column.querySelector('.kanban-cards');
            const cards = Array.from(cardsContainer.querySelectorAll('.kanban-card'));
            
            cards.sort((a, b) => {
                let aValue, bValue;
                
                switch (sortBy) {
                    case 'priority':
                        const priorityOrder = { low: 1, normal: 2, medium: 3, high: 4 };
                        aValue = priorityOrder[Array.from(a.classList).find(cls => cls.startsWith('priority-'))?.replace('priority-', '') || 'normal'];
                        bValue = priorityOrder[Array.from(b.classList).find(cls => cls.startsWith('priority-'))?.replace('priority-', '') || 'normal'];
                        return bValue - aValue; // High to low
                        
                    case 'dueDate':
                        aValue = a.querySelector('.kanban-due-date')?.dataset.date || '9999-12-31';
                        bValue = b.querySelector('.kanban-due-date')?.dataset.date || '9999-12-31';
                        return new Date(aValue) - new Date(bValue); // Earliest first
                        
                    case 'created':
                        aValue = a.querySelector('.kanban-card-date')?.textContent.trim() || '01/01/1970';
                        bValue = b.querySelector('.kanban-card-date')?.textContent.trim() || '01/01/1970';
                        // Convert DD/MM/YYYY to Date
                        const parseDate = (dateStr) => {
                            const [day, month, year] = dateStr.split('/');
                            return new Date(year, month - 1, day);
                        };
                        return parseDate(bValue) - parseDate(aValue); // Newest first
                        
                    default:
                        return 0;
                }
            });
            
            // Re-append cards in sorted order
            cards.forEach(card => cardsContainer.appendChild(card));
        });
        
        // Save changes if board is editable
        if (board.dataset.editable === 'true') {
            saveChanges(board.id, false, 'sort_cards');
        }
    }

    /**
     * Initialize kanban boards on page load
     */
    function init() {
        console.log('Kanban Plugin: Initializing...');
        
        // Initialize all kanban boards on the page
        document.querySelectorAll('.kanban-board').forEach(initializeBoard);
        
        // Set up global event listeners
        setupGlobalEventListeners();
        
        console.log('Kanban Plugin: Initialization complete');
    }

    /**
     * Initialize kanban board
     */
    function initializeBoard(board) {
        if (board.dataset.initialized === 'true') return;
        
        setupDragAndDrop(board);
        setupCardDoubleClick(board);
        addControlsToBoard(board);
        
        // Mark as initialized
        board.dataset.initialized = 'true';
    }    /**
     * Set up drag and drop functionality
     */
    function setupDragAndDrop(board) {
        const cards = board.querySelectorAll('.kanban-card');
        const columns = board.querySelectorAll('.kanban-cards');

        // Setup cards
        cards.forEach(card => {
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragend', handleDragEnd);
        });

        // Setup drop zones (columns)
        columns.forEach(column => {
            column.addEventListener('dragover', handleDragOver);
            column.addEventListener('drop', handleDrop);
            column.addEventListener('dragenter', handleDragEnter);
            column.addEventListener('dragleave', handleDragLeave);
        });
    }

    /**
     * Set up editable content
     */
    function setupEditableContent(board) {
        // Save content on blur
        board.addEventListener('blur', function(e) {
            if (e.target.contentEditable === 'true' && !isPageUnloading) {
                // Determine change type based on the element being edited
                let changeType = 'edit_card';
                if (e.target.classList.contains('kanban-title')) {
                    changeType = 'edit_title';
                } else if (e.target.classList.contains('kanban-column-title')) {
                    changeType = 'edit_column';
                }
                saveChanges(board.id, false, changeType);
            }
        }, true);

        // Handle Enter key in contenteditable
        board.addEventListener('keydown', function(e) {
            if (e.target.contentEditable === 'true' && e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
        }, true);
    }

    /**
     * Setup double-click events on cards for editing
     */
    function setupCardDoubleClick(board) {
        board.querySelectorAll('.kanban-card').forEach(card => {
            card.addEventListener('dblclick', function(e) {
                e.preventDefault();
                e.stopPropagation();
                editCard(this.id);
            });
        });
    }

    /**
     * Set up global event listeners
     */
    function setupGlobalEventListeners() {
        // Detect page unloading to prevent unnecessary saves
        window.addEventListener('beforeunload', function() {
            isPageUnloading = true;
        });
        
        // Setup keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Escape key to cancel editing
            if (e.key === 'Escape' && document.activeElement.contentEditable === 'true') {
                document.activeElement.blur();
            }
        });
    }

    /**
     * Drag and drop event handlers
     */
    function handleDragStart(e) {
        draggedCard = this;
        isDragging = true;
        this.classList.add('dragging');
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.outerHTML);
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        draggedCard = null;
        isDragging = false;
        
        // Remove drag-over classes from all columns
        document.querySelectorAll('.kanban-cards').forEach(column => {
            column.classList.remove('drag-over');
        });
    }

    function handleDragOver(e) {
        if (isDragging) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        }
    }

    function handleDragEnter(e) {
        if (isDragging) {
            this.classList.add('drag-over');
        }
    }

    function handleDragLeave(e) {
        // Only remove class if we're actually leaving the column
        if (!this.contains(e.relatedTarget)) {
            this.classList.remove('drag-over');
        }
    }

    function handleDrop(e) {
        if (isDragging && draggedCard) {
            e.preventDefault();
            
            // Remove drag-over effect
            this.classList.remove('drag-over');
            
            // Move the card
            this.appendChild(draggedCard);
            
            // Update last modified info
            updateLastModified(draggedCard);
            
            // Save changes
            const board = this.closest('.kanban-board');
            if (board && board.dataset.editable === 'true' && !isPageUnloading) {
                saveChanges(board.id, false, 'move_card');
            }
        }
    }

    /**
     * Update last modified info for a card
     */
    function updateLastModified(cardElement) {
        const cardData = {
            lastModifiedBy: getCurrentUser(),
            lastModified: getCurrentDate()
        };
        
        updateCardMeta(cardElement, { ...extractCardData(cardElement), ...cardData });
    }

    /**
     * Add a new column
     */
    function addColumn(boardId) {
        const board = document.getElementById(boardId);
        const columnsContainer = board.querySelector('.kanban-columns');
        
        const columnId = 'column_' + Date.now();
        
        const columnHtml = `
            <div class="kanban-column" id="${columnId}">
                <div class="kanban-column-header">
                    <h3 class="kanban-column-title" contenteditable="true">Nouvelle Colonne</h3>
                    <div class="kanban-column-actions">
                        <button class="kanban-btn-icon" onclick="KanbanPlugin.addCard('${columnId}')" title="Ajouter carte">+</button>
                        <button class="kanban-btn-icon" onclick="KanbanPlugin.deleteColumn('${columnId}')" title="Supprimer colonne">×</button>
                    </div>
                </div>
                <div class="kanban-cards" data-column="${columnId}"></div>
            </div>
        `;
        
        columnsContainer.insertAdjacentHTML('beforeend', columnHtml);
        
        // Setup drag and drop for new column
        const newColumn = document.getElementById(columnId);
        if (board.dataset.sortable === 'true') {
            setupDragAndDrop(board);
        }
        if (board.dataset.editable === 'true') {
            setupEditableContent(board);
        }
        
        // Focus on the title
        const titleElement = newColumn.querySelector('.kanban-column-title');
        titleElement.focus();
        
        saveChanges(boardId, false, 'add_column');
    }

    /**
     * Add a new card to a column
     */
    function addCard(columnId) {
        const column = document.getElementById(columnId);
        if (!column) return;
        
        const board = column.closest('.kanban-board');
        const cardsContainer = column.querySelector('.kanban-cards');
        
        const cardId = 'card_' + Date.now();
        const currentUser = getCurrentUser();
        const currentDateTime = getCurrentDateTime();
        
        console.log('🆕 Création nouvelle carte:', {
            user: currentUser,
            dateTime: currentDateTime,
            cardId: cardId
        });
        
        // Create new card data with proper metadata
        const newCardData = {
            id: cardId,
            title: 'Nouvelle Carte',
            description: '',
            priority: 'normal',
            assignee: '',
            tags: [],
            creator: currentUser,
            created: currentDateTime  // Garde le format ISO: "2025-08-29 09:04:33"
            // Note: pas de lastModified car c'est une création, pas une modification
        };
        
        // Open modal for immediate editing instead of inline editing
        showCardModal(newCardData, function(updatedData) {
            console.log('💾 Données de la nouvelle carte sauvegardées:', updatedData);
            
            // Create the card HTML with complete data
            const cardHtml = generateCardHtml(updatedData);
            cardsContainer.insertAdjacentHTML('beforeend', cardHtml);
            
            // Setup drag and drop for new card
            const newCard = document.getElementById(cardId);
            if (board.dataset.sortable === 'true') {
                newCard.addEventListener('dragstart', handleDragStart);
                newCard.addEventListener('dragend', handleDragEnd);
            }
            
            // Save the board with the new card
            saveChanges(board.id, false, 'add_card');
        });
    }

    /**
     * Generate complete card HTML from card data
     */
    function generateCardHtml(cardData) {
        const priorityClass = `priority-${cardData.priority || 'normal'}`;
        
        let html = `
            <div class="kanban-card ${priorityClass}" id="${cardData.id}" draggable="true">
                <div class="kanban-card-actions">
                    <button onclick="KanbanPlugin.editCard('${cardData.id}')" title="Éditer">✏️</button>
                    <button onclick="KanbanPlugin.deleteCard('${cardData.id}')" title="Supprimer">×</button>
                </div>
                
                <div class="kanban-card-header">
                    <h4 class="kanban-card-title" contenteditable="true">${escapeHtml(cardData.title)}</h4>
                </div>`;
        
        // Description
        if (cardData.description) {
            html += `<div class="kanban-card-description">${escapeHtml(cardData.description)}</div>`;
        }
        
        // Footer with metadata
        html += `<div class="kanban-card-footer">`;
        
        // Priority indicator
        if (cardData.priority && cardData.priority !== 'normal') {
            html += `<span class="kanban-priority">${escapeHtml(cardData.priority)}</span>`;
        }
        
        // Assignee
        if (cardData.assignee) {
            html += `<span class="kanban-assignee">${escapeHtml(cardData.assignee)}</span>`;
        }
        
        // Tags
        if (cardData.tags && cardData.tags.length > 0) {
            cardData.tags.forEach(tag => {
                if (tag.trim()) {
                    html += `<span class="kanban-tag">${escapeHtml(tag.trim())}</span>`;
                }
            });
        }
        
        html += `</div>`; // Close footer
        
        // Card metadata
        if (cardData.creator || cardData.created) {
            html += `<div class="kanban-card-meta">`;
            
            // Creator with avatar
            if (cardData.creator) {
                html += `<div class="kanban-card-creator">`;
                const creatorInitial = cardData.creator.charAt(0).toUpperCase();
                html += `<div class="kanban-card-avatar">${creatorInitial}</div>`;
                html += `<span>${escapeHtml(cardData.creator)}</span>`;
                html += `</div>`;
            }
            
            // Created date
            if (cardData.created) {
                const createdDate = new Date(cardData.created).toLocaleDateString('fr-FR');
                html += `<div class="kanban-card-date">${createdDate}</div>`;
            }
            
            // Last modified info - only show if actually modified
            if (cardData.lastModifiedBy && cardData.lastModified && 
                cardData.lastModified !== cardData.created) {
                html += `<div class="kanban-last-modified">`;
                html += `<span class="modified-by">Modifié par ${escapeHtml(cardData.lastModifiedBy)}</span>`;
                
                const modifiedDate = new Date(cardData.lastModified);
                if (!isNaN(modifiedDate.getTime())) {
                    html += `<span class="modified-date"> le ${modifiedDate.toLocaleDateString('fr-FR')}</span>`;
                }
                html += `</div>`;
            }
            
            html += `</div>`; // Close meta
        }
        
        // Due date if present
        if (cardData.dueDate) {
            html += `<div class="kanban-card-due-date">`;
            const dueDate = new Date(cardData.dueDate).toLocaleDateString('fr-FR');
            html += `<span class="due-date">Échéance: ${dueDate}</span>`;
            html += `</div>`;
        }
        
        html += `</div>`; // Close card
        
        return html;
    }

    /**
     * Edit a card with modal
     */
    function editCard(cardId) {
        const card = document.getElementById(cardId);
        if (!card) return;
        
        const board = card.closest('.kanban-board');
        const cardData = extractCardData(card);
        
        showCardModal(cardData, function(updatedData) {
            console.log('🔄 Mise à jour de la carte avec:', updatedData);
            
            // Add modification metadata
            const currentUser = getCurrentUser();
            const currentDateTime = getCurrentDateTime();
            
            updatedData.lastModified = currentDateTime;
            updatedData.lastModifiedBy = currentUser;
            
            console.log('📝 Ajout métadonnées modification:', {
                lastModified: updatedData.lastModified,
                lastModifiedBy: updatedData.lastModifiedBy
            });
            
            updateCardDisplay(card, updatedData);
            console.log('✅ DOM mis à jour, sauvegarde...');
            saveChanges(board.id, false, 'edit_card');
        });
    }

    /**
     * Extract card data from DOM element
     */
    function extractCardData(cardElement) {
        const titleElement = cardElement.querySelector('.kanban-card-title');
        const descElement = cardElement.querySelector('.kanban-card-description');
        const creatorElement = cardElement.querySelector('.kanban-card-creator span');
        const dateElement = cardElement.querySelector('.kanban-card-date');
        const tagElements = cardElement.querySelectorAll('.kanban-tag');
        
        return {
            id: cardElement.id,
            title: titleElement ? titleElement.textContent.trim() : '',
            description: descElement ? descElement.textContent.trim() : '',
            priority: cardElement.className.match(/priority-(\w+)/)?.[1] || 'normal',
            assignee: '', // À extraire selon le format
            creator: creatorElement ? creatorElement.textContent.trim() : '',
            created: dateElement ? dateElement.textContent.trim() : '',
            tags: Array.from(tagElements).map(tag => tag.textContent.trim())
        };
    }

    /**
     * Show card editing modal
     */
    function showCardModal(cardData, onSave) {
        // Create modal HTML
        const modal = document.createElement('div');
        modal.className = 'kanban-modal';
        modal.innerHTML = `
            <div class="kanban-modal-content">
                <div class="kanban-modal-header">
                    <h3>Éditer la carte</h3>
                    <button class="kanban-modal-close" type="button">×</button>
                </div>
                
                <div class="kanban-modal-field">
                    <label for="card-title">Titre *</label>
                    <input type="text" id="card-title" value="${escapeHtml(cardData.title)}" required>
                </div>
                
                <div class="kanban-modal-field">
                    <label for="card-description">Description</label>
                    <textarea id="card-description" placeholder="Description de la carte...">${escapeHtml(cardData.description)}</textarea>
                </div>
                
                <div class="kanban-modal-field">
                    <label for="card-priority">Priorité</label>
                    <select id="card-priority">
                        <option value="low" ${cardData.priority === 'low' ? 'selected' : ''}>Faible</option>
                        <option value="normal" ${cardData.priority === 'normal' ? 'selected' : ''}>Normale</option>
                        <option value="medium" ${cardData.priority === 'medium' ? 'selected' : ''}>Moyenne</option>
                        <option value="high" ${cardData.priority === 'high' ? 'selected' : ''}>Élevée</option>
                    </select>
                </div>
                
                                <div class="kanban-modal-field">
                    <label for="card-assignee">Assigné à</label>
                    <input type="text" id="card-assignee" value="${escapeHtml(cardData.assignee || '')}" placeholder="Nom d'utilisateur">
                </div>
                
                <div class="kanban-modal-field">
                    <label for="card-due-date">Date d'échéance</label>
                    <input type="date" id="card-due-date" value="${cardData.dueDate || ''}" placeholder="YYYY-MM-DD">
                </div>
                
                <div class="kanban-modal-field">
                    <label for="card-tags">Tags (séparés par des virgules)</label>
                    <input type="text" id="card-tags" value="${cardData.tags ? cardData.tags.join(', ') : ''}" placeholder="urgent, bug, feature">
                    <div id="card-tags-display" class="kanban-modal-tags-display"></div>
                </div>
                
                <div class="kanban-modal-field">
                    <label>Créé par</label>
                    <div>${escapeHtml(cardData.creator)} le ${escapeHtml(cardData.created)}</div>
                </div>
                
                <div class="kanban-modal-actions">
                    <button class="kanban-modal-btn kanban-modal-btn-danger" type="button" id="delete-card-btn">
                        Supprimer
                    </button>
                    <button class="kanban-modal-btn kanban-modal-btn-secondary" type="button" id="cancel-btn">
                        Annuler
                    </button>
                    <button class="kanban-modal-btn kanban-modal-btn-primary" type="button" id="save-btn">
                        Sauvegarder
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus on title
        const titleInput = modal.querySelector('#card-title');
        titleInput.focus();
        titleInput.select();
        
        // Update tags display
        updateTagsDisplay();
        
        // Event listeners
        modal.querySelector('.kanban-modal-close').addEventListener('click', closeModal);
        modal.querySelector('#cancel-btn').addEventListener('click', closeModal);
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeModal();
        });
        
        modal.querySelector('#card-tags').addEventListener('input', updateTagsDisplay);
        
        modal.querySelector('#save-btn').addEventListener('click', function() {
            const updatedData = {
                ...cardData,
                title: modal.querySelector('#card-title').value.trim(),
                description: modal.querySelector('#card-description').value.trim(),
                priority: modal.querySelector('#card-priority').value,
                assignee: modal.querySelector('#card-assignee').value.trim(),
                dueDate: modal.querySelector('#card-due-date').value.trim(),
                tags: modal.querySelector('#card-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag)
            };
            
            // Only add lastModified info if this is actually a modification (not creation)
            // Check if card already exists in DOM (meaning it's an edit, not creation)
            const existingCard = document.getElementById(cardData.id);
            if (existingCard) {
                // This is an existing card being edited
                const currentUser = getCurrentUser();
                // Make sure we only store the clean username, not "Modifié par xxx"
                updatedData.lastModifiedBy = currentUser.replace(/^Modifié par\s+/, '');
                updatedData.lastModified = getCurrentDate();
                console.log('✏️ Modification carte existante:', updatedData);
            } else {
                // This is a new card creation - don't add lastModified
                console.log('🆕 Nouvelle carte créée:', updatedData);
            }
            
            console.log('📝 Données de la modal avant sauvegarde:', updatedData);
            
            if (!updatedData.title) {
                alert('Le titre est obligatoire !');
                return;
            }
            
            onSave(updatedData);
            closeModal();
        });
        
        modal.querySelector('#delete-card-btn').addEventListener('click', function() {
            if (confirm('Êtes-vous sûr de vouloir supprimer cette carte ?')) {
                deleteCard(cardData.id);
                closeModal();
            }
        });
        
        function updateTagsDisplay() {
            const tagsInput = modal.querySelector('#card-tags');
            const tagsDisplay = modal.querySelector('#card-tags-display');
            const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
            
            tagsDisplay.innerHTML = tags.map(tag => 
                `<div class="kanban-modal-tag">
                    ${escapeHtml(tag)}
                    <button type="button" onclick="this.parentElement.remove(); updateTagsInput();">×</button>
                </div>`
            ).join('');
        }
        
        function closeModal() {
            document.body.removeChild(modal);
        }
        
        // Handle Escape key
        function handleEscape(e) {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        }
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Update card display with new data
     */
    function updateCardDisplay(cardElement, cardData) {
        console.log('🎨 Mise à jour affichage carte:', cardData);
        
        // Update classes
        cardElement.className = cardElement.className.replace(/priority-\w+/, `priority-${cardData.priority}`);
        
        // Update title
        const titleElement = cardElement.querySelector('.kanban-card-title');
        if (titleElement) {
            titleElement.textContent = cardData.title;
        }
        
        // Update description
        let descElement = cardElement.querySelector('.kanban-card-description');
        if (cardData.description) {
            if (!descElement) {
                descElement = document.createElement('div');
                descElement.className = 'kanban-card-description';
                cardElement.querySelector('.kanban-card-header').after(descElement);
            }
            descElement.textContent = cardData.description;
        } else if (descElement) {
            descElement.remove();
        }
        
        // Update footer with tags, priority, assignee
        updateCardFooter(cardElement, cardData);
        
        // Update meta information (creator, date) if present
        updateCardMeta(cardElement, cardData);
        
        // Update due date display
        updateCardDueDate(cardElement, cardData);
        
        console.log('✅ Affichage carte mis à jour');
    }

    /**
     * Update card footer with metadata
     */
    function updateCardFooter(cardElement, cardData) {
        let footer = cardElement.querySelector('.kanban-card-footer');
        if (!footer) {
            footer = document.createElement('div');
            footer.className = 'kanban-card-footer';
            cardElement.appendChild(footer);
        }
        
        footer.innerHTML = '';
        
        // Priority
        if (cardData.priority !== 'normal') {
            footer.innerHTML += `<span class="kanban-priority">${escapeHtml(cardData.priority)}</span>`;
        }
        
        // Tags
        if (cardData.tags && cardData.tags.length > 0) {
            cardData.tags.forEach(tag => {
                if (tag.trim()) {
                    footer.innerHTML += `<span class="kanban-tag">${escapeHtml(tag.trim())}</span>`;
                }
            });
        }
        
        // Assignee
        if (cardData.assignee) {
            footer.innerHTML += `<span class="kanban-assignee">${escapeHtml(cardData.assignee)}</span>`;
        }
    }

    /**
     * Update card meta information
     */
    function updateCardMeta(cardElement, cardData) {
        let metaElement = cardElement.querySelector('.kanban-card-meta');
        if (!metaElement && (cardData.creator || cardData.created)) {
            metaElement = document.createElement('div');
            metaElement.className = 'kanban-card-meta';
            cardElement.appendChild(metaElement);
        }
        
        if (metaElement && (cardData.creator || cardData.created)) {
            let metaContent = '';
            
            if (cardData.creator) {
                metaContent += `<span class="kanban-card-creator">Par <span>${escapeHtml(cardData.creator)}</span></span>`;
            }
            
            if (cardData.created) {
                metaContent += `<span class="kanban-card-date">${escapeHtml(cardData.created)}</span>`;
            }
            
            // Add last modified info
            if (cardData.lastModifiedBy || cardData.lastModified) {
                metaContent += `<div class="kanban-last-modified">`;
                if (cardData.lastModifiedBy) {
                    metaContent += `<span class="modified-by">${escapeHtml(cardData.lastModifiedBy)}</span>`;
                }
                if (cardData.lastModified) {
                    metaContent += `<span class="modified-date">${escapeHtml(cardData.lastModified)}</span>`;
                }
                metaContent += `</div>`;
            }
            
            metaElement.innerHTML = metaContent;
        } else if (metaElement && !cardData.creator && !cardData.created) {
            metaElement.remove();
        }
    }

    /**
     * Update card due date display
     */
    function updateCardDueDate(cardElement, cardData) {
        let dueDateElement = cardElement.querySelector('.kanban-due-date');
        
        if (cardData.dueDate) {
            if (!dueDateElement) {
                dueDateElement = document.createElement('div');
                dueDateElement.className = 'kanban-due-date';
                // Insert after description or header
                const insertAfter = cardElement.querySelector('.kanban-card-description') || 
                                  cardElement.querySelector('.kanban-card-header');
                insertAfter.after(dueDateElement);
            }
            
            const dueDate = new Date(cardData.dueDate);
            const today = new Date();
            const isOverdue = dueDate < today;
            const isToday = dueDate.toDateString() === today.toDateString();
            
            dueDateElement.className = 'kanban-due-date';
            if (isOverdue) dueDateElement.classList.add('overdue');
            else if (isToday) dueDateElement.classList.add('today');
            
            dueDateElement.dataset.date = cardData.dueDate;
            dueDateElement.innerHTML = `⏰ ${dueDate.toLocaleDateString('fr-FR')}`;
        } else if (dueDateElement) {
            dueDateElement.remove();
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Delete a column
     */
    function deleteColumn(columnId) {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette colonne et toutes ses cartes ?')) {
            const column = document.getElementById(columnId);
            const board = column.closest('.kanban-board');
            
            column.remove();
            
            if (board.dataset.editable === 'true') {
                saveChanges(board.id, false, 'delete_column');
            }
        }
    }

    /**
     * Delete a card
     */
    function deleteCard(cardId) {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette carte ?')) {
            const card = document.getElementById(cardId);
            const board = card.closest('.kanban-board');
            
            card.remove();
            
            if (board.dataset.editable === 'true') {
                saveChanges(board.id, false, 'delete_card');
            }
        }
    }

    /**
     * Save changes to the board
     */
    function saveChanges(boardId, showMessage = false, changeType = 'modification') {
        // Don't save if page is unloading
        if (isPageUnloading) {
            return;
        }
        
        const board = document.getElementById(boardId);
        if (!board) return;

        const boardData = extractBoardData(board);
        console.log('💾 Sauvegarde données:', boardData);
        
        // Get current page ID from DokuWiki
        const pageId = window.JSINFO?.id || window.location.search.match(/[?&]id=([^&]+)/)?.[1] || '';
        
        // Save via AJAX
        const formData = new FormData();
        formData.append('call', 'kanban');
        formData.append('action', 'save_board');
        formData.append('board_id', boardId);
        formData.append('board_data', JSON.stringify(boardData));
        formData.append('change_type', changeType);
        formData.append('page_id', pageId);

        console.log('📡 Envoi vers serveur - FormData:', {
            call: 'kanban',
            action: 'save_board',
            board_id: boardId,
            board_data: JSON.stringify(boardData),
            change_type: changeType,
            page_id: pageId
        });

        fetch(DOKU_BASE + 'lib/exe/ajax.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            console.log('📨 Réponse serveur:', data);
            if (data.success && showMessage) {
                showNotification('Tableau sauvegardé avec succès', 'success');
            } else if (data.error) {
                console.error('❌ Erreur serveur:', data.error);
                showNotification('Erreur: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('❌ Erreur lors de la sauvegarde:', error);
            // Only show error message for manual saves to avoid spam during page unload
            if (showMessage) {
                showNotification('Erreur lors de la sauvegarde', 'error');
            }
        });
    }

    /**
     * Load board data from server
     */
    function loadBoardData(boardId) {
        // Get current page ID from DokuWiki
        const pageId = window.JSINFO?.id || window.location.search.match(/[?&]id=([^&]+)/)?.[1] || '';
        
        const formData = new FormData();
        formData.append('call', 'kanban');
        formData.append('action', 'load_board');
        formData.append('board_id', boardId);
        formData.append('page_id', pageId);

        fetch(DOKU_BASE + 'lib/exe/ajax.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.data) {
                applyBoardData(boardId, data.data);
            }
        })
        .catch(error => {
            console.error('Erreur lors du chargement:', error);
        });
    }

    /**
     * Extract board data from DOM
     */
    function extractBoardData(board) {
        console.log('📤 Extraction des données du tableau...');
        const columns = [];
        
        board.querySelectorAll('.kanban-column').forEach((column, index) => {
            const columnData = {
                id: column.id,
                title: column.querySelector('.kanban-column-title').textContent.trim(),
                cards: []
            };
            
            column.querySelectorAll('.kanban-card').forEach(card => {
                const cardData = {
                    id: card.id,
                    title: card.querySelector('.kanban-card-title').textContent.trim(),
                    description: '',
                    priority: 'normal',
                    assignee: '',
                    dueDate: '',
                    tags: [],
                    creator: '',
                    created: '',
                    lastModifiedBy: '',
                    lastModified: ''
                };
                
                // Extract description if present
                const descElement = card.querySelector('.kanban-card-description');
                if (descElement) {
                    cardData.description = descElement.textContent.trim();
                }
                
                // Extract priority from class
                const priorityClass = Array.from(card.classList).find(cls => cls.startsWith('priority-'));
                if (priorityClass) {
                    cardData.priority = priorityClass.replace('priority-', '');
                }
                
                // Extract assignee from footer
                const assigneeElement = card.querySelector('.kanban-assignee');
                if (assigneeElement) {
                    cardData.assignee = assigneeElement.textContent.trim();
                }
                
                // Extract tags from footer
                const tagElements = card.querySelectorAll('.kanban-tag');
                cardData.tags = Array.from(tagElements).map(tag => tag.textContent.trim());
                
                // Extract creator from meta
                const creatorElement = card.querySelector('.kanban-card-creator span');
                if (creatorElement) {
                    cardData.creator = creatorElement.textContent.trim();
                }
                
                // Extract created date from meta
                const dateElement = card.querySelector('.kanban-card-date');
                if (dateElement) {
                    cardData.created = dateElement.textContent.trim();
                }
                
                // Extract due date
                const dueDateElement = card.querySelector('.kanban-due-date');
                if (dueDateElement) {
                    cardData.dueDate = dueDateElement.dataset.date || dueDateElement.textContent.trim();
                }
                
                // Extract last modified info
                const lastModifiedElement = card.querySelector('.kanban-last-modified');
                if (lastModifiedElement) {
                    const modifiedBy = lastModifiedElement.querySelector('.modified-by');
                    const modifiedDate = lastModifiedElement.querySelector('.modified-date');
                    if (modifiedBy) cardData.lastModifiedBy = modifiedBy.textContent.trim();
                    if (modifiedDate) cardData.lastModified = modifiedDate.textContent.trim();
                }
                
                console.log(`📋 Carte ${cardData.id}:`, cardData);
                columnData.cards.push(cardData);
            });
            
            columns.push(columnData);
        });
        
        const boardData = {
            title: board.querySelector('.kanban-title').textContent.trim(),
            columns: columns
        };
        
        console.log('📊 Données complètes du tableau:', boardData);
        return boardData;
    }

    /**
     * Apply board data to DOM
     */
    function applyBoardData(boardId, data) {
        const board = document.getElementById(boardId);
        if (!board || !data) return;

        // Update title
        const titleElement = board.querySelector('.kanban-title');
        if (titleElement && data.title) {
            titleElement.textContent = data.title;
        }

        // Update columns and cards positions
        if (data.columns) {
            data.columns.forEach((columnData, index) => {
                const column = document.getElementById(columnData.id);
                if (column) {
                    // Update column title
                    const columnTitle = column.querySelector('.kanban-column-title');
                    if (columnTitle) {
                        columnTitle.textContent = columnData.title;
                    }

                    // Reorder cards
                    const cardsContainer = column.querySelector('.kanban-cards');
                    columnData.cards.forEach(cardData => {
                        const card = document.getElementById(cardData.id);
                        if (card) {
                            cardsContainer.appendChild(card);
                            
                            // Update card content
                            const cardTitle = card.querySelector('.kanban-card-title');
                            if (cardTitle) {
                                cardTitle.textContent = cardData.title;
                            }
                        }
                    });
                }
            });
        }
    }

    /**
     * Show notification message
     */
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `kanban-notification kanban-notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    /**
     * Public API
     */
    return {
        init: init,
        addColumn: addColumn,
        addCard: addCard,
        editCard: editCard,
        deleteColumn: deleteColumn,
        deleteCard: deleteCard,
        
        // Debug functions
        getCurrentUser: getCurrentUser,
        debugUserDetection: function() {
            const user = getCurrentUser();
            console.log('🔍 Debug détection utilisateur:', {
                detected: user,
                JSINFO: window.JSINFO,
                meta_kanban: document.querySelector('meta[name="kanban-user"]')?.content
            });
            alert(`Utilisateur détecté: ${user}\nVoir console pour détails`);
            return user;
        }
    };

})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', KanbanPlugin.init);
} else {
    KanbanPlugin.init();
}
