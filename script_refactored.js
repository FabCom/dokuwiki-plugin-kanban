/**
 * Kanban Plugin JavaScript - Refactored Architecture
 * @version 2.1.0
 * 
 * Architecture modulaire :
 * - script.js : Core & initialisation
 * - dragdrop.js : Gestion drag & drop
 * - utils.js : Utilitaires & debugging
 */

(function() {
    'use strict';

    // Global kanban data store
    let kanbanBoards = {};

    /**
     * Initialize all kanban boards on page load
     */
    function initializeKanbanBoards() {
        console.log('🚀 Initialisation des boards Kanban (architecture refactorisée)');
        
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
                    
                    console.log(`✅ Board ${boardId} initialisé avec ${boardData.columns.length} colonnes`);
                }
            } catch (error) {
                console.error('❌ Erreur lors du chargement du tableau kanban:', error);
                showErrorInBoard(board, 'Erreur de chargement des données');
            }
        });
        
        // Export kanbanBoards to global scope for modules
        window.kanbanBoards = kanbanBoards;
    }

    /**
     * Render complete kanban board from JSON data
     */
    function renderBoard(boardContainer, boardData) {
        const contentContainer = boardContainer.querySelector('.kanban-content-container');
        
        let html = `
            <div class="kanban-header">
                <h2 class="kanban-title">${KanbanUtils.escapeHtml(boardData.title)}</h2>
                <div class="kanban-actions">
                    <button class="kanban-btn kanban-btn-lock" id="lock-btn-${boardContainer.id}">
                        <span class="lock-icon">🔓</span>
                        <span class="lock-text">Déverrouiller l'édition</span>
                    </button>
                </div>
            </div>
            <div class="kanban-columns">`;
        
        // Render columns
        boardData.columns.forEach((column, index) => {
            html += renderColumn(column, index, false); // Start in read-only mode
        });
        
        html += `
                <div class="kanban-column kanban-add-column" style="display: none;">
                    <button class="kanban-btn kanban-btn-add-column" onclick="KanbanPlugin.addColumn('${boardContainer.id}')">
                        + Ajouter une colonne
                    </button>
                </div>
            </div>`;
        
        contentContainer.innerHTML = html;
    }

    /**
     * Render a single column
     */
    function renderColumn(column, index, editable) {
        let html = `
            <div class="kanban-column" id="${column.id}" data-column-index="${index}" ${editable ? 'draggable="true"' : ''}>
                <div class="kanban-column-header">
                    ${editable ? '<div class="kanban-column-drag-handle" title="Glisser pour réorganiser">⋮⋮</div>' : ''}
                    <h3 class="kanban-column-title" ${editable ? 'contenteditable="true"' : ''}>${KanbanUtils.escapeHtml(column.title)}</h3>`;
        
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
     * Render a single card
     */
    function renderCard(cardData) {
        const priorityClass = cardData.priority ? `priority-${cardData.priority}` : '';
        const createdDate = new Date(cardData.created).toLocaleDateString();
        
        return `
            <div class="kanban-card ${priorityClass}" id="${cardData.id}" draggable="true">
                <div class="kanban-card-header">
                    <div class="kanban-card-title" contenteditable="false">${KanbanUtils.escapeHtml(cardData.title)}</div>
                    <div class="kanban-card-actions" style="display: none;">
                        <button class="kanban-btn-icon" onclick="KanbanPlugin.editCard('${cardData.id}')" title="Éditer">✏️</button>
                        <button class="kanban-btn-icon" onclick="KanbanPlugin.deleteCard('${cardData.id}')" title="Supprimer">🗑️</button>
                    </div>
                </div>
                ${cardData.description ? `<div class="kanban-card-description">${KanbanUtils.escapeHtml(cardData.description)}</div>` : ''}
                <div class="kanban-card-footer">
                    <div class="kanban-card-creator">
                        <div class="kanban-card-avatar">${cardData.creator.charAt(0).toUpperCase()}</div>
                        <span>${KanbanUtils.escapeHtml(cardData.creator)}</span>
                    </div>
                    <div class="kanban-card-date">${createdDate}</div>
                </div>
            </div>`;
    }

    /**
     * Initialize board interactions
     */
    function initializeBoardInteractions(board) {
        const boardId = board.id;
        
        console.log(`🔧 Initialisation des interactions pour ${boardId}`);
        
        // Initialize in read-only mode by default
        disableBoardEditing(board);
        
        // Setup lock/unlock button
        setupLockButton(board);
        
        // Check lock status
        checkBoardLock(boardId);
        
        // Initialize drag & drop in disabled state
        if (window.KanbanDragDrop) {
            KanbanDragDrop.initializeDragDrop(board, false);
        }
    }

    /**
     * Setup lock/unlock button functionality
     */
    function setupLockButton(board) {
        const lockBtn = board.querySelector(`#lock-btn-${board.id}`);
        if (!lockBtn) return;
        
        lockBtn.addEventListener('click', function() {
            const isLocked = lockBtn.classList.contains('locked');
            
            if (isLocked) {
                // Try to unlock
                unlockBoard(board.id);
            } else {
                // Lock the board
                lockBoard(board.id);
            }
        });
    }

    /**
     * Lock board for editing
     */
    function lockBoard(boardId) {
        const board = document.getElementById(boardId);
        const lockBtn = board.querySelector(`#lock-btn-${boardId}`);
        
        // Disable editing
        disableBoardEditing(board);
        
        // Update lock button
        lockBtn.classList.add('locked');
        lockBtn.querySelector('.lock-icon').textContent = '🔓';
        lockBtn.querySelector('.lock-text').textContent = 'Déverrouiller l\'édition';
        
        console.log(`🔒 Board ${boardId} verrouillé`);
        
        // Save lock state (simplified for now)
        localStorage.setItem(`kanban_lock_${boardId}`, 'false');
    }

    /**
     * Unlock board for editing
     */
    function unlockBoard(boardId) {
        const board = document.getElementById(boardId);
        const lockBtn = board.querySelector(`#lock-btn-${boardId}`);
        
        // Enable editing
        enableBoardEditing(board);
        
        // Update lock button
        lockBtn.classList.remove('locked');
        lockBtn.querySelector('.lock-icon').textContent = '🔒';
        lockBtn.querySelector('.lock-text').textContent = 'Verrouiller l\'édition';
        
        console.log(`🔓 Board ${boardId} déverrouillé`);
        
        // Save lock state (simplified for now)
        localStorage.setItem(`kanban_lock_${boardId}`, 'true');
    }

    /**
     * Check board lock status
     */
    function checkBoardLock(boardId) {
        const isUnlocked = localStorage.getItem(`kanban_lock_${boardId}`) === 'true';
        
        if (isUnlocked) {
            unlockBoard(boardId);
        } else {
            lockBoard(boardId);
        }
    }

    /**
     * Enable board editing mode
     */
    function enableBoardEditing(board) {
        console.log(`✅ Activation du mode édition pour ${board.id}`);
        
        // Show add column button
        const addColumnBtn = board.querySelector('.kanban-add-column');
        if (addColumnBtn) {
            addColumnBtn.style.display = 'flex';
        }
        
        // Enable column management
        board.querySelectorAll('.kanban-column-actions').forEach(actions => {
            actions.style.display = 'flex';
        });
        
        // Enable card actions
        board.querySelectorAll('.kanban-card-actions').forEach(actions => {
            actions.style.display = 'flex';
        });
        
        // Enable contenteditable elements
        board.querySelectorAll('.kanban-column-title').forEach(title => {
            title.contentEditable = 'true';
        });
        
        // Show drag handles
        board.querySelectorAll('.kanban-column-drag-handle').forEach(handle => {
            handle.style.display = 'block';
        });
        
        // Enable drag & drop
        if (window.KanbanDragDrop) {
            KanbanDragDrop.initializeDragDrop(board, true);
        }
    }

    /**
     * Disable board editing mode
     */
    function disableBoardEditing(board) {
        console.log(`🚫 Désactivation du mode édition pour ${board.id}`);
        
        // Hide add column button
        const addColumnBtn = board.querySelector('.kanban-add-column');
        if (addColumnBtn) {
            addColumnBtn.style.display = 'none';
        }
        
        // Hide column management
        board.querySelectorAll('.kanban-column-actions').forEach(actions => {
            actions.style.display = 'none';
        });
        
        // Hide card actions
        board.querySelectorAll('.kanban-card-actions').forEach(actions => {
            actions.style.display = 'none';
        });
        
        // Disable contenteditable elements
        board.querySelectorAll('.kanban-column-title').forEach(title => {
            title.contentEditable = 'false';
        });
        
        // Hide drag handles
        board.querySelectorAll('.kanban-column-drag-handle').forEach(handle => {
            handle.style.display = 'none';
        });
        
        // Disable drag & drop
        if (window.KanbanDragDrop) {
            KanbanDragDrop.initializeDragDrop(board, false);
        }
    }

    /**
     * Show error in board
     */
    function showErrorInBoard(board, message) {
        const contentContainer = board.querySelector('.kanban-content-container');
        contentContainer.innerHTML = `
            <div class="kanban-error">
                <h3>Erreur de chargement</h3>
                <p>${KanbanUtils.escapeHtml(message)}</p>
            </div>`;
    }

    /**
     * Move card in data structure
     */
    function moveCardInData(cardId, targetColumnId) {
        console.log(`📋 Déplacement carte ${cardId} vers colonne ${targetColumnId}`);
        
        // Find the board and card
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
                console.log(`✅ Carte déplacée de "${sourceColumn.title}" vers "${targetColumn.title}"`);
            }
        }
    }

    /**
     * Move column in data structure based on DOM order
     */
    function moveColumnInData(boardId, draggedColumnId) {
        console.log(`🏛️ Synchronisation colonne ${draggedColumnId} dans board ${boardId}`);
        
        const board = document.getElementById(boardId);
        const boardData = kanbanBoards[boardId];
        
        if (!board || !boardData) {
            console.log('❌ Board ou données introuvables');
            return;
        }
        
        // Get current DOM order
        const columnsContainer = board.querySelector('.kanban-columns');
        const domColumns = Array.from(columnsContainer.querySelectorAll('.kanban-column'));
        const domOrder = domColumns.map(col => col.id);
        
        console.log('📋 Ordre DOM:', domOrder);
        console.log('📋 Ordre données avant:', boardData.columns.map(col => col.id));
        
        // Rebuild data structure based on DOM order
        const newColumnsData = [];
        domOrder.forEach(columnId => {
            const existingColumn = boardData.columns.find(col => col.id === columnId);
            if (existingColumn) {
                newColumnsData.push(existingColumn);
            }
        });
        
        // Update board data
        boardData.columns = newColumnsData;
        
        console.log('📋 Ordre données après:', boardData.columns.map(col => col.id));
        
        // Update column indices
        if (window.KanbanUtils) {
            KanbanUtils.updateColumnIndices(boardId);
        }
        
        // Save changes
        saveChanges(boardId, 'move_column');
    }

    /**
     * Save changes (placeholder for real save functionality)
     */
    function saveChanges(boardId, action) {
        console.log(`💾 Sauvegarde: ${action} sur board ${boardId}`);
        // This would typically save to server
        // For now, just update localStorage
        localStorage.setItem(`kanban_data_${boardId}`, JSON.stringify(kanbanBoards[boardId]));
    }

    // Export functions to global scope for backwards compatibility
    window.moveCardInData = moveCardInData;
    window.moveColumnInData = moveColumnInData;
    window.saveChanges = saveChanges;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeKanbanBoards);
    } else {
        initializeKanbanBoards();
    }

})();
