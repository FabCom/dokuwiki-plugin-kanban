/**
 * Kanban Plugin JavaScript - Modular Architecture
 * Core functionality with delegation to specialized modules
 * @version 2.1.0
 */

(function() {
    'use strict';

    // Global kanban data store
    let kanbanBoards = {};

    /**
     * Initialize all kanban boards on page load
     */
    function initializeKanbanBoards() {
        // Export kanbanBoards to global scope for modules
        window.kanbanBoards = kanbanBoards;
        const boards = document.querySelectorAll('.kanban-board');
        
        boards.forEach(board => {
            const boardId = board.id;
            
            try {
                // Load data from JSON script tag
                const jsonScript = board.querySelector('.kanban-data');
                if (jsonScript) {
                    const boardData = JSON.parse(jsonScript.textContent);
                    boardData.title = board.dataset.title || boardData.title || 'Kanban Board';
                    
                    // Store in global data
                    kanbanBoards[boardId] = boardData;
                    
                    // Render the complete board
                    renderBoard(board, boardData);
                    
                    // Initialize interactions
                    initializeBoardInteractions(board);
                }
            } catch (error) {
                console.error('Erreur lors du chargement du tableau kanban:', error);
                showErrorInBoard(board, 'Erreur de chargement des données');
            }
        });
    }

    /**
     * Render complete kanban board from JSON data
     */
    function renderBoard(boardContainer, boardData) {
        const contentContainer = boardContainer.querySelector('.kanban-content-container');
        
        let html = `
            <div class="kanban-header">
                <h2 class="kanban-title">${escapeHtml(boardData.title)}</h2>`;
        
        // Add actions - always show fullscreen button, conditionally show edit button
        html += `<div class="kanban-actions">`;
        
        // Bouton plein écran - toujours visible
        html += `
            <button class="kanban-btn kanban-btn-secondary kanban-fullscreen-btn" onclick="window.KanbanPlugin.toggleFullscreen('${boardContainer.id}')" title="Affichage plein écran">
                📏 Plein écran
            </button>`;
        
        // Add edit actions if editable
        if (boardContainer.dataset.editable === 'true') {
            const isEditingMode = boardContainer.dataset.editingMode === 'true';
            
            if (isEditingMode) {
                // Mode édition - le bouton "Réorganiser colonnes" sera ajouté par lockmanagement.js
                html += `
                    <button class="kanban-btn kanban-lock-button" onclick="window.KanbanPlugin.lockBoard('${boardContainer.id}')" title="Terminer l'édition et déverrouiller">
                        ✅ Terminer l'édition
                    </button>`;
            } else {
                // Mode lecture - afficher le bouton d'édition
                html += `
                    <button class="kanban-btn kanban-lock-button" onclick="window.KanbanPlugin.lockBoard('${boardContainer.id}')" title="Commencer l'édition">
                        ✏️ Éditer
                    </button>`;
            }
        }
        
        html += `</div>`;
        html += `</div>`;
        
        // Add filters section (always show unless explicitly disabled)
        html += generateFiltersHTML(boardContainer.id);
        
        html += `<div class="kanban-columns">`;
        
        // Vérifier si le kanban est vide
        if (!boardData.columns || boardData.columns.length === 0) {
            // Affichage pour kanban vide
            if (boardContainer.dataset.editable === 'true') {
                html += `
                    <div class="kanban-empty-state">
                        <div class="kanban-empty-icon">📋</div>
                        <h3 class="kanban-empty-title">Tableau kanban vide</h3>
                        <p class="kanban-empty-description">
                            Ce tableau kanban ne contient encore aucune colonne.<br>
                            Cliquez sur <strong>"Gérer les colonnes"</strong> pour commencer à organiser vos tâches.
                        </p>
                        <button class="kanban-btn kanban-btn-primary kanban-btn-large" onclick="window.showColumnOrderModal && window.showColumnOrderModal('${boardContainer.id}')">
                            ➕ Créer ma première colonne
                        </button>
                    </div>
                `;
            } else {
                html += `
                    <div class="kanban-empty-state">
                        <div class="kanban-empty-icon">📋</div>
                        <h3 class="kanban-empty-title">Tableau kanban vide</h3>
                        <p class="kanban-empty-description">
                            Ce tableau kanban ne contient encore aucune colonne.<br>
                            Contactez l'administrateur pour ajouter du contenu.
                        </p>
                    </div>
                `;
            }
        } else {
            // Render columns normalement
            boardData.columns.forEach((column, index) => {
                html += renderColumn(column, index, boardContainer.dataset.editable === 'true');
            });
        }
        
        html += `</div>`;
        
        contentContainer.innerHTML = html;
        contentContainer.removeAttribute('data-loading');
        
        // Charger les indicateurs de discussion de façon asynchrone (seulement si il y a des cartes)
        if (boardData.columns && boardData.columns.length > 0) {
            setTimeout(() => {
                initializeDiscussionIndicators(boardContainer);
            }, 100);
        }
    }

    /**
     * Initialise les indicateurs de discussion pour toutes les cartes
     */
    async function initializeDiscussionIndicators(boardContainer) {
        if (window.KanbanDiscussions && window.KanbanDiscussions.updateAllDiscussionIndicators) {
            const pageId = window.JSINFO?.id || 'playground:kanban';
            await window.KanbanDiscussions.updateAllDiscussionIndicators(pageId);
        }
    }

    /**
     * Render a single column
     */
    function renderColumn(column, index, editable) {
        let html = `
            <div class="kanban-column" id="${column.id}" data-column-index="${index}">
                <div class="kanban-column-header">
                    <h3 class="kanban-column-title">${escapeHtml(column.title)}</h3>`;
        
        if (editable) {
            html += `
                    <div class="kanban-column-actions">
                        <button class="kanban-btn-icon" onclick="KanbanPlugin.addCard('${column.id}')" title="Ajouter carte">+</button>
                    </div>`;
        }
        
        html += `
                </div>
                <div class="kanban-cards" data-column="${column.id}">`;
        
        // Render cards
        column.cards.forEach(card => {
            html += renderCard(card);
        });
        
        html += `
                </div>
            </div>`;
        
        return html;
    }

    /**
     * Render a single card from JSON data
     */
    function renderCard(cardData) {
        const priorityClass = `priority-${cardData.priority || 'normal'}`;
        
        // Préparer les tooltips pour les icônes
        let creatorTooltip = '';
        let modifierTooltip = '';
        
        if (cardData.creator) {
            const createdDate = cardData.created ? formatDate(cardData.created) : '';
            creatorTooltip = `Créé par ${cardData.creator}${createdDate ? ' le ' + createdDate : ''}`;
        }
        
        if (cardData.lastModifiedBy && cardData.lastModified && 
            cardData.lastModified !== cardData.created) {
            const modifiedDate = formatDate(cardData.lastModified);
            modifierTooltip = `Modifié par ${cardData.lastModifiedBy} le ${modifiedDate}`;
        }
        
        let html = `
            <div class="kanban-card ${priorityClass}" id="${cardData.id}" draggable="true">
                <div class="kanban-card-actions">
                    ${creatorTooltip ? `<span class="kanban-info-icon kanban-creator-icon kanban-tooltip" title="${creatorTooltip}">🏗️</span>` : ''}
                    ${modifierTooltip ? `<span class="kanban-info-icon kanban-modifier-icon kanban-tooltip" title="${modifierTooltip}">🔧</span>` : ''}
                    <button onclick="window.KanbanPlugin.viewCard('${cardData.id}')" title="Consulter" class="kanban-view-btn">👁️</button>
                    <button onclick="window.KanbanPlugin.editCard('${cardData.id}')" title="Éditer">✏️</button>
                    <button onclick="window.KanbanPlugin.deleteCard('${cardData.id}')" title="Supprimer">×</button>
                </div>`;
        
        // Tags en haut (avant le titre)
        if (cardData.tags && cardData.tags.length > 0) {
            html += `<div class="kanban-card-tags">`;
            cardData.tags.forEach(tag => {
                if (tag.trim()) {
                    html += `<span class="kanban-tag">${escapeHtml(tag.trim())}</span>`;
                }
            });
            html += `</div>`;
        }
        
        html += `
                <div class="kanban-card-header">
                    <h4 class="kanban-card-title" contenteditable="true">${escapeHtml(cardData.title)}</h4>
                </div>`;
        
        // Description
        if (cardData.description) {
            html += `<div class="kanban-card-description">${escapeHtml(cardData.description)}</div>`;
        }
        
        // Due date if present
        if (cardData.dueDate) {
            const dueDate = formatDate(cardData.dueDate);
            html += `<div class="kanban-card-due-date">`;
            html += `<span class="due-date" data-date="${cardData.dueDate}">📅 Échéance: ${dueDate}</span>`;
            html += `</div>`;
        }
        
        // Footer avec assignee et icônes de contenu
        html += `<div class="kanban-card-footer">`;
        
        // Liens internes (icône + nombre)
        const internalLinksCount = (cardData.internalLinks && cardData.internalLinks.length) || 0;
        if (internalLinksCount > 0) {
            html += `<span class="kanban-content-indicator kanban-tooltip" title="${internalLinksCount} lien${internalLinksCount > 1 ? 's' : ''} interne${internalLinksCount > 1 ? 's' : ''}">🔗 ${internalLinksCount}</span>`;
        }
        
        // Liens externes (icône + nombre)
        const externalLinksCount = (cardData.externalLinks && cardData.externalLinks.length) || 0;
        if (externalLinksCount > 0) {
            html += `<span class="kanban-content-indicator kanban-tooltip" title="${externalLinksCount} lien${externalLinksCount > 1 ? 's' : ''} externe${externalLinksCount > 1 ? 's' : ''}">🌐 ${externalLinksCount}</span>`;
        }
        
        // Médias (préparé pour implémentation future)
        const mediaCount = (cardData.media && cardData.media.length) || 0;
        if (mediaCount > 0) {
            html += `<span class="kanban-content-indicator kanban-tooltip" title="${mediaCount} média${mediaCount > 1 ? 's' : ''} lié${mediaCount > 1 ? 's' : ''}">📎 ${mediaCount}</span>`;
        }
        
        // Assignee
        if (cardData.assignee) {
            html += `<span class="kanban-assignee">👤 ${escapeHtml(cardData.assignee)}</span>`;
        }
        
        html += `</div>`; // Close footer
        html += `</div>`; // Close card
        
        return html;
    }

    /**
     * Format date consistently - Delegate to utils module
     */
    function formatDate(dateString) {
        if (window.KanbanUtils && window.KanbanUtils.formatDate) {
            return window.KanbanUtils.formatDate(dateString);
        }
        // Fallback if utils not loaded
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('fr-FR');
        } catch (error) {
            return dateString;
        }
    }

    /**
     * Get current user - Delegate to utils module
     */
    function getCurrentUser() {
        if (window.KanbanUtils && window.KanbanUtils.getCurrentUser) {
            return window.KanbanUtils.getCurrentUser();
        }
        // Fallback if utils not loaded
        return JSINFO?.kanban_user || JSINFO?.userinfo?.name || JSINFO?.client || 'Utilisateur';
    }

    /**
     * Get current date time - Delegate to utils module
     */
    function getCurrentDateTime() {
        if (window.KanbanUtils && window.KanbanUtils.getCurrentDateTime) {
            return window.KanbanUtils.getCurrentDateTime();
        }
        // Fallback if utils not loaded
        return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }

    /**
     * Add a new card to a column
     */
    function addCard(columnId) {
        const column = document.getElementById(columnId);
        const board = column.closest('.kanban-board');
        const boardId = board.id;
        const boardData = kanbanBoards[boardId];
        
        // Find the column in data
        const columnData = boardData.columns.find(col => col.id === columnId);
        if (!columnData) return;
        
        // Create new card data
        const cardId = window.KanbanUtils?.generateId('card') || 'card_' + Date.now();
        const newCardData = {
            id: cardId,
            title: 'Nouvelle carte',
            description: '',
            priority: 'normal',
            assignee: '',
            creator: getCurrentUser(),
            created: getCurrentDateTime().split(' ')[0], // Just date
            tags: [],
            dueDate: ''
        };
        
        // Show modal for editing
        showCardModal(newCardData, function(updatedData) {
            // Add to column data
            columnData.cards.push(updatedData);
            
            // Render new card in DOM
            const cardsContainer = column.querySelector('.kanban-cards');
            cardsContainer.insertAdjacentHTML('beforeend', renderCard(updatedData));
            
            // Setup interactions for new card
            const newCard = document.getElementById(cardId);
            if (board.dataset.sortable === 'true') {
                setupCardDragAndDrop(newCard);
            }
            
            // Save changes
            saveChanges(boardId, 'add_card');
        });
    }

    /**
     * View card in read-only modal
     */
    function viewCard(cardId) {
        const cardElement = document.getElementById(cardId);
        const board = cardElement.closest('.kanban-board');
        const boardId = board.id;
        const boardData = kanbanBoards[boardId];
        
        // Find card in data
        let cardData = null;
        for (let column of boardData.columns) {
            const found = column.cards.find(card => card.id === cardId);
            if (found) {
                cardData = found;
                break;
            }
        }
        
        if (!cardData) {
            showNotification('Carte non trouvée', 'error');
            return;
        }
        
        // Deleguer to modal module si disponible
        if (window.KanbanModal && window.KanbanModal.showCardViewModal) {
            window.KanbanModal.showCardViewModal(cardData);
        } else {
            showNotification('Module modal non disponible', 'error');
        }
    }

    /**
     * Edit an existing card
     */
    function editCard(cardId) {
        const cardElement = document.getElementById(cardId);
        const board = cardElement.closest('.kanban-board');
        const boardId = board.id;
        const boardData = kanbanBoards[boardId];
        
        // Find card in data
        let cardData = null;
        for (let column of boardData.columns) {
            cardData = column.cards.find(card => card.id === cardId);
            if (cardData) break;
        }
        
        if (!cardData) return;
        
        showCardModal(cardData, function(updatedData) {
            // Update card data with modification metadata
            updatedData.lastModified = getCurrentDateTime();
            updatedData.lastModifiedBy = getCurrentUser();
            
            // Update card in data
            Object.assign(cardData, updatedData);
            
            // Re-render card in DOM
            cardElement.outerHTML = renderCard(cardData);
            
            // Re-setup interactions
            const newCardElement = document.getElementById(cardId);
            if (board.dataset.sortable === 'true') {
                setupCardDragAndDrop(newCardElement);
            }
            
            // Save changes
            saveChanges(boardId, 'edit_card');
        });
    }

    /**
     * Delete a card with confirmation
     */
    function deleteCard(cardId) {
        if (window.KanbanModal && window.KanbanModal.showConfirmModal) {
            window.KanbanModal.showConfirmModal(
                'Êtes-vous sûr de vouloir supprimer cette carte ?',
                () => performDeleteCard(cardId)
            );
        } else {
            // Fallback to browser confirm
            if (confirm('Êtes-vous sûr de vouloir supprimer cette carte ?')) {
                performDeleteCard(cardId);
            }
        }
    }

    /**
     * Perform actual card deletion
     */
    function performDeleteCard(cardId) {
        const cardElement = document.getElementById(cardId);
        const board = cardElement.closest('.kanban-board');
        const boardId = board.id;
        const boardData = kanbanBoards[boardId];
        
        // Remove from data
        for (let column of boardData.columns) {
            const cardIndex = column.cards.findIndex(card => card.id === cardId);
            if (cardIndex !== -1) {
                column.cards.splice(cardIndex, 1);
                break;
            }
        }
        
        // Remove from DOM
        cardElement.remove();
        
        // Save changes
        saveChanges(boardId, 'delete_card');
    }

    /**
     * Show column order modal
     */
    function showColumnOrderModal(boardId) {
        const board = document.getElementById(boardId);
        const boardData = kanbanBoards[boardId];
        
        if (!boardData || !boardData.columns) {
            showNotification('Données du tableau non trouvées', 'error');
            return;
        }
        
        if (window.KanbanModalColumns && window.KanbanModalColumns.showColumnOrderModal) {
            window.KanbanModalColumns.showColumnOrderModal(boardData, function(newOrder, updatedTitles, deletedColumns, addedColumns) {
                // Apply new order, updated titles, deletions, and additions
                reorderColumns(boardId, newOrder, updatedTitles, deletedColumns, addedColumns);
            });
        } else {
            showNotification('Module modal colonnes non disponible', 'error');
        }
    }

    /**
     * Reorder columns based on new order array, update titles, handle deletions and additions
     */
    function reorderColumns(boardId, newOrder, updatedTitles, deletedColumns, addedColumns) {
        const board = document.getElementById(boardId);
        const boardData = kanbanBoards[boardId];
        
        // Create a new columns array that will replace the current one
        const newColumns = [];
        
        // First, process existing columns according to newOrder (excluding deleted ones)
        if (newOrder && newOrder.length > 0) {
            newOrder.forEach(originalIndex => {
                // Skip if this column is marked for deletion
                if (deletedColumns && deletedColumns.includes(originalIndex)) {
                    return;
                }
                
                if (boardData.columns[originalIndex]) {
                    const column = { ...boardData.columns[originalIndex] };
                    
                    // Apply title update if any
                    if (updatedTitles && updatedTitles[originalIndex]) {
                        column.title = updatedTitles[originalIndex];
                    }
                    
                    newColumns.push(column);
                }
            });
        }
        
        // Add new columns at the end
        if (addedColumns && addedColumns.length > 0) {
            addedColumns.forEach(newColumn => {
                newColumns.push(newColumn);
            });
        }
        
        // Replace the columns array
        boardData.columns = newColumns;
        
        console.log('Reorder complete:', {
            originalCount: boardData.columns.length,
            newOrder: newOrder,
            deletedColumns: deletedColumns,
            addedColumns: addedColumns,
            finalCount: newColumns.length
        });
        
        // Re-render the board
        renderBoard(board, boardData);
        // Re-initialize interactions
        initializeBoardInteractions(board);
        // Réappliquer le mode édition si actif
        if (board.dataset.editingMode === 'true' && window.KanbanLockManagement) {
            window.KanbanLockManagement.enableBoardEditing(board);
            // Ne pas appeler updateLockUI car cela interfère avec l'état actuel
        }
        // Save changes
        saveChanges(boardId, 'manage_columns');
        showNotification('Colonnes mises à jour avec succès', 'success');
    }
    function addColumn(boardId) {
        const board = document.getElementById(boardId);
        const boardData = kanbanBoards[boardId];
        
        const columnTitle = prompt('Nom de la nouvelle colonne:');
        if (!columnTitle) return;

        const newColumn = {
            id: window.KanbanUtils?.generateId('col') || 'col_' + Date.now(),
            title: columnTitle,
            cards: []
        };

        // Check if board was empty before
        const wasEmpty = !boardData.columns || boardData.columns.length === 0;
        
        // Add to data
        if (!boardData.columns) {
            boardData.columns = [];
        }
        boardData.columns.push(newColumn);

        if (wasEmpty) {
            // If board was empty, re-render the entire board to remove empty state
            renderBoard(board, boardData);
            // Re-initialize interactions
            initializeBoardInteractions(board);
            // Restore editing mode if it was active
            if (board.dataset.editingMode === 'true' && window.KanbanLockManagement) {
                window.KanbanLockManagement.enableBoardEditing(board);
            }
        } else {
            // Add to existing DOM
            const columnsContainer = board.querySelector('.kanban-columns');
            columnsContainer.insertAdjacentHTML('beforeend', 
                renderColumn(newColumn, boardData.columns.length - 1, board.dataset.editable === 'true'));
        }

        // Save changes
        saveChanges(boardId, 'add_column');
    }

    /**
     * Delete a column with confirmation
     */
    function deleteColumn(columnId) {
        if (window.KanbanModal && window.KanbanModal.showConfirmModal) {
            window.KanbanModal.showConfirmModal(
                'Êtes-vous sûr de vouloir supprimer cette colonne et toutes ses cartes ?',
                () => performDeleteColumn(columnId)
            );
        } else {
            // Fallback to browser confirm
            if (confirm('Êtes-vous sûr de vouloir supprimer cette colonne et toutes ses cartes ?')) {
                performDeleteColumn(columnId);
            }
        }
    }

    /**
     * Perform actual column deletion
     */
    function performDeleteColumn(columnId) {
        const column = document.getElementById(columnId);
        const board = column.closest('.kanban-board');
        const boardId = board.id;
        const boardData = kanbanBoards[boardId];
        
        // Remove from data
        const columnIndex = boardData.columns.findIndex(col => col.id === columnId);
        if (columnIndex !== -1) {
            boardData.columns.splice(columnIndex, 1);
        }
        
        // Check if board becomes empty after deletion
        if (boardData.columns.length === 0) {
            // Re-render entire board to show empty state
            renderBoard(board, boardData);
        } else {
            // Just remove from DOM
            column.remove();
        }
        
        // Save changes
        saveChanges(boardId, 'delete_column');
    }

    /**
     * Save changes to server
     */
    function saveChanges(boardId, changeType) {
        const boardData = kanbanBoards[boardId];
        
        const formData = new FormData();
        formData.append('call', 'kanban');
        formData.append('action', 'save_board');
        formData.append('board_id', boardId);
        formData.append('board_data', JSON.stringify(boardData));
        formData.append('change_type', changeType);
        formData.append('page_id', JSINFO.id);
        
        fetch(DOKU_BASE + 'lib/exe/ajax.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Tableau sauvegardé', 'success');
            } else {
                showNotification('Erreur de sauvegarde: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            showNotification('Erreur de sauvegarde', 'error');
        });
    }

    /**
     * Lock a kanban board for editing - Delegate to lock management module
     */
    function lockBoard(boardId) {
        if (window.KanbanLockManagement && window.KanbanLockManagement.lockBoard) {
            return window.KanbanLockManagement.lockBoard(boardId);
        } else {
            console.error('KanbanLockManagement module not available');
            showNotification('Module de gestion des verrous non disponible', 'error');
            return Promise.resolve(false);
        }
    }

    /**
     * Unlock a kanban board - Delegate to lock management module
     */
    function unlockBoard(boardId) {
        if (window.KanbanLockManagement && window.KanbanLockManagement.unlockBoard) {
            return window.KanbanLockManagement.unlockBoard(boardId);
        } else {
            console.error('KanbanLockManagement module not available');
            showNotification('Module de gestion des verrous non disponible', 'error');
            return Promise.resolve(false);
        }
    }

    /**
     * Check if a kanban board is locked - Delegate to lock management module
     */
    function checkBoardLock(boardId) {
        if (window.KanbanLockManagement && window.KanbanLockManagement.checkBoardLock) {
            return window.KanbanLockManagement.checkBoardLock(boardId);
        } else {
            console.error('KanbanLockManagement module not available');
            return Promise.resolve({ locked: false, locked_by: null });
        }
    }

    /**
     * Show modal for card editing - Delegate to modal module
     */
    function showCardModal(cardData, callback) {
        if (window.KanbanModal && window.KanbanModal.showCardModal) {
            return window.KanbanModal.showCardModal(cardData, callback);
        } else {
            console.error('KanbanModal module not available');
            // Fallback to browser prompt
            const title = prompt('Titre de la carte:', cardData.title);
            if (title !== null) {
                const updatedData = Object.assign({}, cardData, { title });
                callback(updatedData);
            }
        }
    }

    /**
     * Initialize board interactions - Delegate to lock management
     */
    function initializeBoardInteractions(board) {
        // Initialize lock management
        if (window.KanbanLockManagement && window.KanbanLockManagement.initializeBoardLockManagement) {
            window.KanbanLockManagement.initializeBoardLockManagement(board);
        } else {
            console.warn('KanbanLockManagement module not available');
        }
        
        // Initialize filters system with delay to ensure DOM is ready
        if (window.KanbanFilters) {
            const boardId = board.id;
            
            // Check if filters instance already exists to avoid double initialization
            if (window.kanbanFiltersInstances && window.kanbanFiltersInstances[boardId]) {
                console.log('Filters already initialized for:', boardId);
                return;
            }
            
            setTimeout(() => {
                const filtersInstance = new window.KanbanFilters(boardId);
                filtersInstance.initialize();
                
                // Store filters instance for later access
                if (!window.kanbanFiltersInstances) {
                    window.kanbanFiltersInstances = {};
                }
                window.kanbanFiltersInstances[boardId] = filtersInstance;
            }, 100);
        } else {
            console.warn('KanbanFilters module not available');
        }
        
        if (board.dataset.sortable === 'true') {
            // Setup drag and drop for existing cards (will be disabled until unlocked)
            const cards = board.querySelectorAll('.kanban-card');
            cards.forEach(card => {
                if (window.KanbanDragDrop) {
                    window.KanbanDragDrop.setupCardDragAndDrop(card);
                }
            });
            
            // Setup drop zones
            const columns = board.querySelectorAll('.kanban-cards');
            columns.forEach(column => {
                if (window.KanbanDragDrop) {
                    window.KanbanDragDrop.setupColumnDropZone(column);
                }
            });
        }
    }

    /**
     * Setup drag and drop for a card - Delegate to module
     */
    function setupCardDragAndDrop(card) {
        if (window.KanbanDragDrop) {
            window.KanbanDragDrop.setupCardDragAndDrop(card);
        } else {
            console.warn('KanbanDragDrop module not available');
        }
    }

    /**
     * Setup drop zone for a column - Delegate to module
     */
    function setupColumnDropZone(column) {
        if (window.KanbanDragDrop) {
            window.KanbanDragDrop.setupColumnDropZone(column);
        } else {
            console.warn('KanbanDragDrop module not available');
        }
    }

    /**
     * Move card in data structure
     */
    function moveCardInData(cardId, targetColumnId) {
        // Find the board
        let boardData = null;
        let cardData = null;
        let sourceColumn = null;
        
        for (let boardId in kanbanBoards) {
            boardData = kanbanBoards[boardId];
            for (let column of boardData.columns) {
                const cardIndex = column.cards.findIndex(card => card.id === cardId);
                if (cardIndex !== -1) {
                    cardData = column.cards[cardIndex];
                    sourceColumn = column;
                    column.cards.splice(cardIndex, 1);
                    break;
                }
            }
            if (cardData) break;
        }
        
        // Add to target column
        if (cardData && boardData) {
            const targetColumn = boardData.columns.find(col => col.id === targetColumnId);
            if (targetColumn) {
                targetColumn.cards.push(cardData);
            }
        }
    }

    /**
     * Show notification - Delegate to utils module
     */
    function showNotification(message, type = 'info') {
        if (window.KanbanUtils && window.KanbanUtils.showNotification) {
            window.KanbanUtils.showNotification(message, type);
        } else {
            // Fallback if utils not loaded
            const notification = document.createElement('div');
            notification.className = `kanban-notification kanban-notification-${type}`;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }
    }

    /**
     * Show error in board
     */
    function showErrorInBoard(board, message) {
        const contentContainer = board.querySelector('.kanban-content-container');
        contentContainer.innerHTML = `<div class="kanban-error">❌ ${escapeHtml(message)}</div>`;
    }

    /**
     * Escape HTML to prevent XSS - Delegate to utils module
     */
    function escapeHtml(text) {
        if (window.KanbanUtils && window.KanbanUtils.escapeHtml) {
            return window.KanbanUtils.escapeHtml(text);
        }
        // Fallback if utils not loaded
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Global API
    window.KanbanPlugin = {
        addCard,
        editCard,
        viewCard,
        deleteCard,
        addColumn,
        deleteColumn,
        showColumnOrderModal,
        
        // Lock management
        lockBoard,
        unlockBoard,
        checkBoardLock,
        
        // For debugging
        getBoardData: (boardId) => kanbanBoards[boardId],
        getAllBoards: () => kanbanBoards
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeKanbanBoards);
    } else {
        initializeKanbanBoards();
    }

    // Export functions needed by modules
    window.moveCardInData = moveCardInData;
    window.saveChanges = saveChanges;
    window.showColumnOrderModal = showColumnOrderModal; // Direct export for fallback
    window.refreshBoardData = refreshBoardData; // Export for refresh functionality

    function refreshBoardData(boardId) {
        const board = document.getElementById(boardId);
        if (!board) return;
        
        // Requête AJAX pour récupérer les données les plus récentes
        const formData = new FormData();
        formData.append('call', 'kanban');
        formData.append('action', 'get_board_data');
        formData.append('page_id', JSINFO.id);
        
        fetch(DOKU_BASE + 'lib/exe/ajax.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.board_data) {
                // Mettre à jour les données locales
                const boardData = data.board_data;
                boardData.title = board.dataset.title || boardData.title || 'Kanban Board';
                window.kanbanBoards[boardId] = boardData;
                
                // Réafficher le tableau avec les nouvelles données
                renderBoard(board, boardData);
                initializeBoardInteractions(board);
                
                showNotification('Tableau mis à jour', 'success');
            } else {
                // Fallback : recharger depuis le JSON embarqué
                const jsonScript = board.querySelector('.kanban-data');
                if (jsonScript) {
                    try {
                        const boardData = JSON.parse(jsonScript.textContent);
                        boardData.title = board.dataset.title || boardData.title || 'Kanban Board';
                        window.kanbanBoards[boardId] = boardData;
                        renderBoard(board, boardData);
                        initializeBoardInteractions(board);
                    } catch (error) {
                        console.error('Erreur lors du rechargement des données kanban:', error);
                    }
                }
            }
        })
        .catch(error => {
            console.error('Erreur lors de la récupération des données:', error);
            showNotification('Erreur lors de la mise à jour', 'error');
        });
    }

    /**
     * Toggle fullscreen mode for kanban board
     */
    function toggleFullscreen(boardId) {
        const board = document.getElementById(boardId);
        if (!board) return;

        const isFullscreen = board.classList.contains('kanban-fullscreen');
        
        if (isFullscreen) {
            // Exit fullscreen
            board.classList.remove('kanban-fullscreen');
            document.body.classList.remove('kanban-fullscreen-active');
            
            // Update button text
            const fullscreenBtn = board.querySelector('.kanban-fullscreen-btn');
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = '📏 Plein écran';
                fullscreenBtn.title = 'Affichage plein écran';
            }
            
            // Remove escape key listener
            document.removeEventListener('keydown', handleFullscreenEscape);
            
        } else {
            // Enter fullscreen
            board.classList.add('kanban-fullscreen');
            document.body.classList.add('kanban-fullscreen-active');
            
            // Update button text
            const fullscreenBtn = board.querySelector('.kanban-fullscreen-btn');
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = '📐 Réduire';
                fullscreenBtn.title = 'Quitter le plein écran';
            }
            
            // Add escape key listener
            document.addEventListener('keydown', handleFullscreenEscape);
            
            // Scroll to top of board
            board.scrollIntoView({ behavior: 'smooth' });
        }
    }

    /**
     * Handle escape key to exit fullscreen
     */
    function handleFullscreenEscape(event) {
        if (event.key === 'Escape') {
            const fullscreenBoard = document.querySelector('.kanban-board.kanban-fullscreen');
            if (fullscreenBoard) {
                toggleFullscreen(fullscreenBoard.id);
            }
        }
    }

    /**
     * Generate filters HTML for the kanban board
     */
    function generateFiltersHTML(boardId) {
        return `
        <div class="kanban-filters-container" id="filters-${boardId}">
            <div class="kanban-filters-section">
                <!-- Barre de recherche toujours visible -->
                <div class="kanban-search-bar">
                    <input type="text" 
                           class="kanban-search-input" 
                           placeholder="🔍 Rechercher (min. 3 caractères) dans titres, descriptions, tags..."
                           id="search-${boardId}">
                    
                    <button type="button" 
                            class="btn btn-sm btn-outline-primary kanban-filters-toggle"
                            id="toggle-filters-${boardId}">
                        <span class="toggle-text">📋 Filtres</span>
                        <span class="toggle-icon">▼</span>
                    </button>
                    
                    <button type="button" 
                            class="btn btn-sm kanban-clear-filters" 
                            id="clear-filters-${boardId}"
                            style="display: none;">
                        ✖ Effacer
                    </button>
                </div>
                
                <!-- Panneau de filtres avancés (masqué par défaut) -->
                <div class="kanban-advanced-filters" 
                     id="advanced-filters-${boardId}">
                     
                    <div class="kanban-filter-group">
                        <label class="kanban-filter-label">🏷️ Tags</label>
                        <div class="kanban-tags-filter" id="tags-filter-${boardId}">
                            <!-- Généré dynamiquement par JavaScript -->
                        </div>
                    </div>
                    
                    <div class="kanban-filter-group">
                        <label class="kanban-filter-label">⚡ Priorité</label>
                        <div class="kanban-priorities-filter" id="priorities-filter-${boardId}">
                            <label class="kanban-filter-checkbox">
                                <input type="checkbox" value="high" data-filter="priority">
                                <span class="kanban-priority-badge priority-high">🔴 Haute</span>
                            </label>
                            <label class="kanban-filter-checkbox">
                                <input type="checkbox" value="medium" data-filter="priority">
                                <span class="kanban-priority-badge priority-medium">🟡 Moyenne</span>
                            </label>
                            <label class="kanban-filter-checkbox">
                                <input type="checkbox" value="normal" data-filter="priority">
                                <span class="kanban-priority-badge priority-normal">🟢 Normale</span>
                            </label>
                            <label class="kanban-filter-checkbox">
                                <input type="checkbox" value="low" data-filter="priority">
                                <span class="kanban-priority-badge priority-low">🔵 Basse</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="kanban-filter-group">
                        <label class="kanban-filter-label">👤 Assigné à</label>
                        <div class="kanban-assignees-filter" id="assignees-filter-${boardId}">
                            <!-- Généré dynamiquement par JavaScript -->
                        </div>
                    </div>
                    
                    <div class="kanban-filter-group">
                        <label class="kanban-filter-label">📅 Échéance</label>
                        <div class="kanban-date-filter">
                            <select class="kanban-date-range-select" id="date-filter-${boardId}" data-filter="dateRange">
                                <option value="">Toutes les dates</option>
                                <option value="overdue">En retard</option>
                                <option value="today">Aujourd'hui</option>
                                <option value="tomorrow">Demain</option>
                                <option value="this-week">Cette semaine</option>
                                <option value="next-week">Semaine prochaine</option>
                                <option value="this-month">Ce mois</option>
                                <option value="next-month">Mois prochain</option>
                                <option value="no-date">Sans date</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- Statut des filtres -->
                <div class="kanban-filter-status" 
                     id="filter-status-${boardId}" 
                     style="display: none;">
                    <span class="kanban-filter-count"></span>
                    <div class="kanban-active-filters"></div>
                </div>
            </div>
        </div>`;
    }

    // Export functions to global scope for access from HTML
    window.KanbanPlugin = window.KanbanPlugin || {};
    window.KanbanPlugin.toggleFullscreen = toggleFullscreen;

})();
