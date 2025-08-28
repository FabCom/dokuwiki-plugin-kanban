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
            
            // Save changes
            const board = this.closest('.kanban-board');
            if (board && board.dataset.editable === 'true' && !isPageUnloading) {
                saveChanges(board.id, false, 'move_card');
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
        
        saveChanges(boardId, false, 'add_column');
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
        
        // Focus on the title and select all text
        const titleElement = newCard.querySelector('.kanban-card-title');
        titleElement.focus();
        
        // Select all text in the element
        setTimeout(() => {
            if (window.getSelection && document.createRange) {
                const range = document.createRange();
                range.selectNodeContents(titleElement);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }, 10);
        
        saveChanges(board.id, false, 'add_card');
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
                    <input type="text" id="card-assignee" value="${escapeHtml(cardData.assignee)}" placeholder="Nom d'utilisateur">
                </div>
                
                <div class="kanban-modal-field">
                    <label for="card-tags">Tags</label>
                    <input type="text" id="card-tags" value="${cardData.tags.join(', ')}" placeholder="Tag1, Tag2, Tag3">
                    <div class="kanban-modal-tags" id="card-tags-display"></div>
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
                tags: modal.querySelector('#card-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag)
            };
            
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
            
            metaElement.innerHTML = metaContent;
        } else if (metaElement && !cardData.creator && !cardData.created) {
            metaElement.remove();
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
                    tags: [],
                    creator: '',
                    created: ''
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
        deleteCard: deleteCard
    };

})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', KanbanPlugin.init);
} else {
    KanbanPlugin.init();
}
