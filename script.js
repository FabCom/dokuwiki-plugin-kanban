/**
 * Kanban Plugin JavaScript - JSON-First Architecture
 * @version 2.0.0
 */

(function() {
    'use strict';

    // Global kanban data store
    let kanbanBoards = {};

    /**
     * Initialize all kanban boards on page load
     */
    function initializeKanbanBoards() {
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
                    <button class="kanban-btn kanban-btn-primary" onclick="KanbanPlugin.addColumn('${boardContainer.id}')">
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
                    <button onclick="KanbanPlugin.editCard('${cardData.id}')" title="Éditer">✏️</button>
                    <button onclick="KanbanPlugin.deleteCard('${cardData.id}')" title="Supprimer">×</button>
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
        
        // Footer avec assignee seulement
        html += `<div class="kanban-card-footer">`;
        
        // Assignee
        if (cardData.assignee) {
            html += `<span class="kanban-assignee">👤 ${escapeHtml(cardData.assignee)}</span>`;
        }
        
        html += `</div>`; // Close footer
        html += `</div>`; // Close card
        
        return html;
    }

    /**
     * Format date consistently
     */
    function formatDate(dateString) {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                // Si ce n'est pas une date valide, retourner tel quel
                return dateString;
            }
            return date.toLocaleDateString('fr-FR');
        } catch (error) {
            return dateString;
        }
    }

    /**
     * Get current user from JSINFO
     */
    function getCurrentUser() {
        return JSINFO?.kanban_user || JSINFO?.userinfo?.name || JSINFO?.client || 'Utilisateur';
    }

    /**
     * Get current date time
     */
    function getCurrentDateTime() {
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
        const cardId = 'card_' + Date.now();
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
     * Delete a card
     */
    function deleteCard(cardId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette carte ?')) {
            return;
        }
        
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
     * Add a new column
     */
    function addColumn(boardId) {
        const board = document.getElementById(boardId);
        const boardData = kanbanBoards[boardId];
        
        const columnTitle = prompt('Nom de la nouvelle colonne:');
        if (!columnTitle) return;
        
        const newColumn = {
            id: 'col_' + Date.now(),
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
     * Delete a column
     */
    function deleteColumn(columnId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette colonne et toutes ses cartes ?')) {
            return;
        }
        
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
     * Lock a kanban board for editing
     */
    function lockBoard(boardId) {
        const board = document.getElementById(boardId);
        
        const formData = new FormData();
        formData.append('call', 'kanban');
        formData.append('action', 'lock_board');
        formData.append('page_id', JSINFO.id);
        
        return fetch(DOKU_BASE + 'lib/exe/ajax.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Marquer le tableau comme étant en mode édition
                if (board) board.dataset.editingMode = 'true';
                
                showNotification('Mode édition activé', 'success');
                updateLockUI(boardId, false, null); // isLocked=false car c'est notre verrou
                return true;
            } else {
                showNotification('Impossible d\'activer l\'édition: ' + data.error, 'error');
                return false;
            }
        })
        .catch(error => {
            console.error('Erreur d\'activation de l\'édition:', error);
            showNotification('Erreur d\'activation de l\'édition', 'error');
            return false;
        });
    }

    /**
     * Unlock a kanban board
     */
    function unlockBoard(boardId) {
        const board = document.getElementById(boardId);
        
        const formData = new FormData();
        formData.append('call', 'kanban');
        formData.append('action', 'unlock_board');
        formData.append('page_id', JSINFO.id);
        
        return fetch(DOKU_BASE + 'lib/exe/ajax.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Désactiver le mode édition
                if (board) board.dataset.editingMode = 'false';
                
                showNotification('Édition terminée', 'success');
                updateLockUI(boardId, false, null);
                return true;
            } else {
                showNotification('Erreur de fin d\'édition: ' + data.error, 'error');
                return false;
            }
        })
        .catch(error => {
            console.error('Erreur de fin d\'édition:', error);
            showNotification('Erreur de fin d\'édition', 'error');
            return false;
        });
    }

    /**
     * Check if a kanban board is locked
     */
    function checkBoardLock(boardId) {
        const formData = new FormData();
        formData.append('call', 'kanban');
        formData.append('action', 'check_lock');
        formData.append('page_id', JSINFO.id);
        
        return fetch(DOKU_BASE + 'lib/exe/ajax.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            updateLockUI(boardId, data.locked, data.locked_by);
            return data;
        })
        .catch(error => {
            console.error('Erreur de vérification du verrouillage:', error);
            return { locked: false, locked_by: null };
        });
    }

    /**
     * Update lock UI elements
     */
    function updateLockUI(boardId, isLocked, lockedBy) {
        const board = document.getElementById(boardId);
        if (!board) return;
        
        // Dans le système DokuWiki:
        // - isLocked = false signifie "pas verrouillé" OU "verrouillé par moi"  
        // - isLocked = true + lockedBy = nom signifie "verrouillé par quelqu'un d'autre"
        
        // Update lock button
        const lockButton = board.querySelector('.kanban-lock-button');
        if (lockButton) {
            if (isLocked) {
                // Verrouillé par quelqu'un d'autre
                lockButton.textContent = '🔒 Verrouillé';
                lockButton.onclick = null;
                lockButton.title = `Verrouillé par ${lockedBy}`;
                lockButton.disabled = true;
            } else {
                // Pas verrouillé OU verrouillé par moi
                lockButton.textContent = '✏️ Éditer';
                lockButton.onclick = () => lockBoard(boardId);
                lockButton.title = 'Commencer l\'édition (verrouille le tableau)';
                lockButton.disabled = false;
            }
        }
        
        // Update board state selon la logique DokuWiki
        if (isLocked) {
            // Verrouillé par quelqu'un d'autre
            board.classList.add('kanban-locked', 'kanban-locked-other');
            disableBoardEditing(board);
            showLockNotification(board, lockedBy);
        } else {
            // Pas verrouillé OU verrouillé par moi 
            board.classList.remove('kanban-locked-other');
            
            // Si on vient de cliquer sur "Éditer", passer en mode édition
            // Sinon rester en mode lecture seule
            if (board.dataset.editingMode === 'true') {
                board.classList.add('kanban-locked');
                enableBoardEditing(board);
                hideLockNotification(board);
                
                // Changer le bouton en "Terminer l'édition"
                const lockButton = board.querySelector('.kanban-lock-button');
                if (lockButton) {
                    lockButton.textContent = '✅ Terminer l\'édition';
                    lockButton.onclick = () => unlockBoard(boardId);
                    lockButton.title = 'Terminer l\'édition et déverrouiller';
                }
            } else {
                // Mode lecture seule par défaut
                board.classList.remove('kanban-locked');
                disableBoardEditing(board);
                hideLockNotification(board);
            }
        }
    }

    /**
     * Disable board editing
     */
    function disableBoardEditing(board) {
        // Disable add card buttons
        board.querySelectorAll('.kanban-add-card').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        });
        
        // Hide card action buttons (edit, delete)
        board.querySelectorAll('.kanban-card-actions').forEach(actions => {
            actions.style.display = 'none';
        });
        
        // Disable card titles editing
        board.querySelectorAll('.kanban-card-title').forEach(title => {
            title.contentEditable = 'false';
            title.style.cursor = 'default';
        });
        
        // Disable card drag and drop
        board.querySelectorAll('.kanban-card').forEach(card => {
            card.draggable = false;
            card.style.cursor = 'default';
        });
        
        // Disable column management buttons
        board.querySelectorAll('.kanban-column-header button').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        });
        
        // Hide "Ajouter Colonne" button
        board.querySelectorAll('button[onclick*="addColumn"]').forEach(btn => {
            btn.style.display = 'none';
        });
        
        // Add visual indicator
        board.classList.add('kanban-read-only');
    }

    /**
     * Enable board editing
     */
    function enableBoardEditing(board) {
        // Enable add card buttons
        board.querySelectorAll('.kanban-add-card').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        });
        
        // Show card action buttons (edit, delete)
        board.querySelectorAll('.kanban-card-actions').forEach(actions => {
            actions.style.display = 'flex';
        });
        
        // Enable card titles editing
        board.querySelectorAll('.kanban-card-title').forEach(title => {
            title.contentEditable = 'true';
            title.style.cursor = 'text';
        });
        
        // Enable card drag and drop
        board.querySelectorAll('.kanban-card').forEach(card => {
            card.draggable = true;
            card.style.cursor = 'move';
        });
        
        // Enable column management buttons
        board.querySelectorAll('.kanban-column-header button').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        });
        
        // Show "Ajouter Colonne" button
        board.querySelectorAll('button[onclick*="addColumn"]').forEach(btn => {
            btn.style.display = 'inline-block';
        });
        
        // Remove visual indicator
        board.classList.remove('kanban-read-only');
    }

    /**
     * Show lock notification
     */
    function showLockNotification(board, lockedBy) {
        let notification = board.querySelector('.kanban-lock-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'kanban-lock-notification';
            board.insertBefore(notification, board.firstChild);
        }
        
        notification.innerHTML = `
            <div class="kanban-lock-message">
                🔒 Ce tableau est actuellement en cours d'édition par <strong>${escapeHtml(lockedBy)}</strong>
                <button onclick="window.KanbanPlugin.checkBoardLock('${board.id}')" class="btn-refresh">🔄 Actualiser</button>
            </div>
        `;
        notification.style.display = 'block';
    }

    /**
     * Hide lock notification
     */
    function hideLockNotification(board) {
        const notification = board.querySelector('.kanban-lock-notification');
        if (notification) {
            notification.style.display = 'none';
        }
    }

    /**
     * Show modal for card editing
     */
    function showCardModal(cardData, callback) {
        // Create modal HTML
        const modal = document.createElement('div');
        modal.className = 'kanban-modal-overlay';
        modal.innerHTML = `
            <div class="kanban-modal">
                <div class="kanban-modal-header">
                    <h3>Éditer la carte</h3>
                    <button class="kanban-modal-close">×</button>
                </div>
                <div class="kanban-modal-body">
                    <form class="kanban-card-form">
                        <!-- Section: Informations principales -->
                        <div class="kanban-modal-section">
                            <h4 class="kanban-modal-section-title">📝 Informations principales</h4>
                            <div class="form-group">
                                <label for="card-title">Titre *</label>
                                <input type="text" id="card-title" name="title" value="${escapeHtml(cardData.title)}" 
                                       required placeholder="Titre de la carte...">
                            </div>
                            
                            <div class="form-group">
                                <label for="card-description">Description</label>
                                <textarea id="card-description" name="description" rows="3" 
                                          placeholder="Descritpion...">${escapeHtml(cardData.description || '')}</textarea>
                            </div>
                            
                            <div class="form-group">
                                <label for="card-tags">🏷️ Tags (séparés par des virgules)</label>
                                <input type="text" id="card-tags" name="tags" 
                                       value="${cardData.tags ? cardData.tags.join(', ') : ''}"
                                       placeholder="tag1, tag2, ...">
                            </div>
                        </div>

                        <!-- Section: Organisation -->
                        <div class="kanban-modal-section">
                            <h4 class="kanban-modal-section-title">🎯 Organisation</h4>
                            <div class="form-group-row">
                                <div class="form-group form-group-half">
                                    <label for="card-priority">Priorité</label>
                                    <select id="card-priority" name="priority">
                                        <option value="low" ${cardData.priority === 'low' ? 'selected' : ''}>🟢 Basse</option>
                                        <option value="normal" ${cardData.priority === 'normal' ? 'selected' : ''}>⚪ Normale</option>
                                        <option value="medium" ${cardData.priority === 'medium' ? 'selected' : ''}>🟡 Moyenne</option>
                                        <option value="high" ${cardData.priority === 'high' ? 'selected' : ''}>🔴 Haute</option>
                                    </select>
                                </div>
                                
                                <div class="form-group form-group-half">
                                    <label for="card-assignee">👤 Assigné à</label>
                                    <input type="text" id="card-assignee" name="assignee" 
                                           value="${escapeHtml(cardData.assignee || '')}" 
                                           placeholder="@utilisateur">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="card-due-date">📅 Date d'échéance</label>
                                <input type="date" id="card-due-date" name="dueDate" value="${cardData.dueDate || ''}">
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" class="kanban-btn kanban-btn-primary">💾 Sauvegarder</button>
                            <button type="button" class="kanban-btn kanban-btn-secondary kanban-modal-cancel">❌ Annuler</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners
        const form = modal.querySelector('.kanban-card-form');
        const closeBtn = modal.querySelector('.kanban-modal-close');
        const cancelBtn = modal.querySelector('.kanban-modal-cancel');
        
        function closeModal() {
            document.body.removeChild(modal);
        }
        
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeModal();
        });
        
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(form);
            const updatedData = Object.assign({}, cardData);
            
            updatedData.title = formData.get('title');
            updatedData.description = formData.get('description');
            updatedData.priority = formData.get('priority');
            updatedData.assignee = formData.get('assignee');
            updatedData.dueDate = formData.get('dueDate');
            updatedData.tags = formData.get('tags').split(',').map(tag => tag.trim()).filter(tag => tag);
            
            closeModal();
            callback(updatedData);
        });
        
        // Focus on title field
        modal.querySelector('#card-title').focus();
    }

    /**
     * Initialize board interactions (drag & drop, etc.)
     */
    function initializeBoardInteractions(board) {
        // Disable editing by default (read-only mode)
        disableBoardEditing(board);
        
        // Check lock status and update UI accordingly
        checkBoardLock(board.id);
        
        if (board.dataset.sortable === 'true') {
            // Setup drag and drop for existing cards (will be disabled until unlocked)
            const cards = board.querySelectorAll('.kanban-card');
            cards.forEach(card => setupCardDragAndDrop(card));
            
            // Setup drop zones
            const columns = board.querySelectorAll('.kanban-cards');
            columns.forEach(column => setupColumnDropZone(column));
        }
    }

    /**
     * Setup drag and drop for a card
     */
    function setupCardDragAndDrop(card) {
        card.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', card.id);
            card.classList.add('dragging');
        });
        
        card.addEventListener('dragend', function(e) {
            card.classList.remove('dragging');
        });
    }

    /**
     * Setup drop zone for a column
     */
    function setupColumnDropZone(column) {
        column.addEventListener('dragover', function(e) {
            e.preventDefault();
            column.classList.add('drag-over');
        });
        
        column.addEventListener('dragleave', function(e) {
            column.classList.remove('drag-over');
        });
        
        column.addEventListener('drop', function(e) {
            e.preventDefault();
            column.classList.remove('drag-over');
            
            const cardId = e.dataTransfer.getData('text/plain');
            const card = document.getElementById(cardId);
            
            if (card && card.parentNode !== column) {
                // Move card in data
                moveCardInData(cardId, column.dataset.column);
                
                // Move card in DOM
                column.appendChild(card);
                
                // Save changes
                const board = column.closest('.kanban-board');
                saveChanges(board.id, 'move_card');
            }
        });
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
     * Show notification
     */
    function showNotification(message, type = 'info') {
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

    /**
     * Show error in board
     */
    function showErrorInBoard(board, message) {
        const contentContainer = board.querySelector('.kanban-content-container');
        contentContainer.innerHTML = `<div class="kanban-error">❌ ${escapeHtml(message)}</div>`;
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Global API
    window.KanbanPlugin = {
        addCard,
        editCard,
        deleteCard,
        addColumn,
        deleteColumn,
        
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

    // Auto-unlock on page unload
    // Smart tooltip positioning
    function initializeSmartTooltips() {
        document.addEventListener('mouseover', function(e) {
            if (e.target.classList.contains('kanban-tooltip')) {
                const tooltip = e.target;
                setTimeout(() => {
                    const tooltipRect = tooltip.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const column = tooltip.closest('.kanban-column');
                    
                    if (column) {
                        const columnRect = column.getBoundingClientRect();
                        const isFirstColumn = column.previousElementSibling === null;
                        const isLastColumn = column.nextElementSibling === null;
                        
                        // Ajouter des classes pour le positionnement CSS
                        tooltip.classList.remove('tooltip-left', 'tooltip-right', 'tooltip-center');
                        
                        if (isFirstColumn) {
                            tooltip.classList.add('tooltip-left');
                        } else if (isLastColumn) {
                            tooltip.classList.add('tooltip-right');
                        } else {
                            tooltip.classList.add('tooltip-center');
                        }
                    }
                }, 10);
            }
        });
    }

    // Initialize smart tooltips
    initializeSmartTooltips();

    window.addEventListener('beforeunload', function() {
        Object.keys(kanbanBoards).forEach(boardId => {
            const board = document.getElementById(boardId);
            if (board && board.classList.contains('kanban-locked')) {
                // Synchronous unlock request
                const formData = new FormData();
                formData.append('call', 'kanban');
                formData.append('action', 'unlock_board');
                formData.append('page_id', JSINFO.id);
                
                // Use sendBeacon for reliable unload handling
                if (navigator.sendBeacon) {
                    navigator.sendBeacon(DOKU_BASE + 'lib/exe/ajax.php', formData);
                }
            }
        });
    });

})();
