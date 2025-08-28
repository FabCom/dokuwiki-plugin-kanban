/**
 * Kanban Plugin JavaScript
 * Handles all interactive functionality for the kanban boards
 */

window.KanbanPlugin = (function() {
    'use strict';

    // Private variables
    let draggedCard = null;
    let isDragging = false;

    /**
     * Initialize kanban boards on page load
     */
    function init() {
        console.log('Kanban Plugin: Initializing...');
        
        // Initialize all kanban boards on the page
        document.querySelectorAll('.kanban-board').forEach(initBoard);
        
        // Set up global event listeners
        setupGlobalEventListeners();
        
        console.log('Kanban Plugin: Initialization complete');
    }

    /**
     * Initialize a single kanban board
     */
    function initBoard(board) {
        const boardId = board.id;
        const isEditable = board.dataset.editable === 'true';
        const isSortable = board.dataset.sortable === 'true';
        
        console.log(`Kanban Plugin: Initializing board ${boardId}`);
        
        if (isSortable) {
            setupDragAndDrop(board);
        }
        
        if (isEditable) {
            setupEditableContent(board);
        }
        
        // Load saved data
        loadBoardData(boardId);
    }

    /**
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
            if (e.target.contentEditable === 'true') {
                saveChanges(board.id);
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
     * Set up global event listeners
     */
    function setupGlobalEventListeners() {
        // Auto-save on page unload
        window.addEventListener('beforeunload', function() {
            document.querySelectorAll('.kanban-board').forEach(board => {
                if (board.dataset.editable === 'true') {
                    saveChanges(board.id);
                }
            });
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
            
            // Save changes
            const board = this.closest('.kanban-board');
            if (board && board.dataset.editable === 'true') {
                saveChanges(board.id);
            }
        }
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
        titleElement.select();
        
        saveChanges(boardId);
    }

    /**
     * Add a new card to a column
     */
    function addCard(columnId) {
        const column = document.getElementById(columnId);
        const cardsContainer = column.querySelector('.kanban-cards');
        
        const cardId = 'card_' + Date.now();
        
        const cardHtml = `
            <div class="kanban-card priority-normal" id="${cardId}" draggable="true">
                <div class="kanban-card-header">
                    <h4 class="kanban-card-title" contenteditable="true">Nouvelle Carte</h4>
                    <button class="kanban-card-delete" onclick="KanbanPlugin.deleteCard('${cardId}')" title="Supprimer">×</button>
                </div>
                <div class="kanban-card-footer"></div>
            </div>
        `;
        
        cardsContainer.insertAdjacentHTML('beforeend', cardHtml);
        
        // Setup drag and drop for new card
        const newCard = document.getElementById(cardId);
        const board = newCard.closest('.kanban-board');
        
        if (board.dataset.sortable === 'true') {
            newCard.addEventListener('dragstart', handleDragStart);
            newCard.addEventListener('dragend', handleDragEnd);
        }
        
        // Focus on the title
        const titleElement = newCard.querySelector('.kanban-card-title');
        titleElement.focus();
        titleElement.select();
        
        saveChanges(board.id);
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
                saveChanges(board.id);
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
                saveChanges(board.id);
            }
        }
    }

    /**
     * Save board changes via AJAX
     */
    function saveBoard(boardId) {
        saveChanges(boardId, true);
    }

    /**
     * Save changes to the board
     */
    function saveChanges(boardId, showMessage = false) {
        const board = document.getElementById(boardId);
        if (!board) return;

        const boardData = extractBoardData(board);
        
        // Save via AJAX
        const formData = new FormData();
        formData.append('call', 'kanban');
        formData.append('action', 'save_board');
        formData.append('board_id', boardId);
        formData.append('board_data', JSON.stringify(boardData));

        fetch(DOKU_BASE + 'lib/exe/ajax.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && showMessage) {
                showNotification('Tableau sauvegardé avec succès', 'success');
            } else if (data.error) {
                showNotification('Erreur: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Erreur lors de la sauvegarde:', error);
            if (showMessage) {
                showNotification('Erreur lors de la sauvegarde', 'error');
            }
        });
    }

    /**
     * Load board data from server
     */
    function loadBoardData(boardId) {
        const formData = new FormData();
        formData.append('call', 'kanban');
        formData.append('action', 'load_board');
        formData.append('board_id', boardId);

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
                    tags: []
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
                
                columnData.cards.push(cardData);
            });
            
            columns.push(columnData);
        });
        
        return {
            title: board.querySelector('.kanban-title').textContent.trim(),
            columns: columns
        };
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
        deleteColumn: deleteColumn,
        deleteCard: deleteCard,
        saveBoard: saveBoard
    };

})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', KanbanPlugin.init);
} else {
    KanbanPlugin.init();
}
