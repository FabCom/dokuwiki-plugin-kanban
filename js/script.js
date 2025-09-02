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
        
        // Add actions if editable
        if (boardContainer.dataset.editable === 'true') {
            html += `
                <div class="kanban-actions">
                    <button class="kanban-btn kanban-lock-button" onclick="window.KanbanPlugin.lockBoard('${boardContainer.id}')" title="Commencer l'édition">
                        ✏️ Éditer
                    </button>
                    <button class="kanban-btn kanban-btn-primary" onclick="window.KanbanPlugin.addColumn('${boardContainer.id}')">
                        Ajouter Colonne
                    </button>
                </div>`;
        }
        
        html += `</div><div class="kanban-columns">`;
        
        // Render columns
        boardData.columns.forEach((column, index) => {
            html += renderColumn(column, index, boardContainer.dataset.editable === 'true');
        });
        
        html += `</div>`;
        
        contentContainer.innerHTML = html;
        contentContainer.removeAttribute('data-loading');
    }

    /**
     * Render a single column
     */
    function renderColumn(column, index, editable) {
        let html = `
            <div class="kanban-column" id="${column.id}" data-column-index="${index}">
                <div class="kanban-column-header">
                    <h3 class="kanban-column-title" ${editable ? 'contenteditable="true"' : ''}>${escapeHtml(column.title)}</h3>`;
        
        if (editable) {
            html += `
                    <div class="kanban-column-actions">
                        <button class="kanban-btn-icon" onclick="KanbanPlugin.addCard('${column.id}')" title="Ajouter carte">+</button>
                        <button class="kanban-btn-icon" onclick="KanbanPlugin.deleteColumn('${column.id}')" title="Supprimer colonne">×</button>
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
        
        if (window.KanbanModal && window.KanbanModal.showColumnOrderModal) {
            window.KanbanModal.showColumnOrderModal(boardData, function(newOrder) {
                // Apply new order
                reorderColumns(boardId, newOrder);
            });
        } else {
            showNotification('Module modal non disponible', 'error');
        }
    }

    /**
     * Reorder columns based on new order array
     */
    function reorderColumns(boardId, newOrder) {
        const board = document.getElementById(boardId);
        const boardData = kanbanBoards[boardId];
        // Reorder data
        const reorderedColumns = newOrder.map(index => boardData.columns[index]);
        boardData.columns = reorderedColumns;
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
        saveChanges(boardId, 'reorder_columns');
        showNotification('Colonnes réorganisées avec succès', 'success');
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
        
        // Add to data
        boardData.columns.push(newColumn);
        
        // Add to DOM
        const columnsContainer = board.querySelector('.kanban-columns');
        columnsContainer.insertAdjacentHTML('beforeend', 
            renderColumn(newColumn, boardData.columns.length - 1, board.dataset.editable === 'true'));
        
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
        
        // Remove from DOM
        column.remove();
        
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

})();
