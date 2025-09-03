/**
 * Kanban Plugin JavaScript - Modal Columns Module
 * Column editing and organization modals
 * @version 2.1.0
 */

(function() {
    'use strict';

    /**
     * Show column editing modal
     */
    function showColumnModal(columnData, callback) {
        const modal = window.KanbanModalCore.createModal('kanban-column-modal', 'Éditer la colonne');
        
        const form = createColumnForm(columnData);
        modal.querySelector('.kanban-modal-body').innerHTML = form;

        // Add footer
        const footer = document.createElement('div');
        footer.className = 'kanban-modal-footer';
        footer.innerHTML = `
            <button type="submit" class="kanban-btn kanban-btn-primary" form="kanban-column-form">💾 Sauvegarder</button>
            <button type="button" class="kanban-btn kanban-btn-secondary kanban-modal-cancel">❌ Annuler</button>
        `;
        
        const innerModal = modal.querySelector('.kanban-modal');
        innerModal.appendChild(footer);

        // Bind form submission
        const formElement = modal.querySelector('#kanban-column-form');
        formElement.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(formElement);
            const updatedData = Object.assign({}, columnData);
            updatedData.title = formData.get('title');
            
            callback(updatedData);
            window.KanbanModalCore.closeModal(modal);
        });

        // Bind cancel button
        modal.querySelector('.kanban-modal-cancel').addEventListener('click', () => {
            window.KanbanModalCore.closeModal(modal);
        });

        modal.style.display = 'block';
        return modal;
    }

    /**
     * Show column order modal for reordering columns
     */
    function showColumnOrderModal(boardData, callback) {
        const modal = window.KanbanModalCore.createModal('kanban-column-order-modal', 'Réorganiser les colonnes');
        
        const form = createColumnOrderForm(boardData);
        modal.querySelector('.kanban-modal-body').innerHTML = form;

        // Update button states helper
        function updateButtonStates() {
            const items = modal.querySelectorAll('.column-order-item');
            items.forEach((item, index) => {
                const upBtn = item.querySelector('.move-up');
                const downBtn = item.querySelector('.move-down');
                
                upBtn.disabled = index === 0;
                downBtn.disabled = index === items.length - 1;
            });
        }

        // Add footer
        const footer = document.createElement('div');
        footer.className = 'kanban-modal-footer';
        footer.innerHTML = `
            <button type="button" class="kanban-btn kanban-btn-primary" id="apply-column-order">Appliquer</button>
            <button type="button" class="kanban-btn kanban-btn-secondary kanban-modal-cancel">Annuler</button>
        `;
        
        const innerModal = modal.querySelector('.kanban-modal');
        innerModal.appendChild(footer);

        // Setup drag and drop for column items
        const columnsList = modal.querySelector('#columns-order-list');
        let draggedItem = null;

        // Prevent drag operations on input fields
        columnsList.addEventListener('mousedown', function(e) {
            if (e.target.classList.contains('column-title-field')) {
                // Disable dragging on the parent item when clicking on input
                const item = e.target.closest('.column-order-item');
                if (item) {
                    item.draggable = false;
                    // Re-enable dragging after a short delay
                    setTimeout(() => {
                        item.draggable = true;
                    }, 100);
                }
            }
        });

        // Prevent drag start when originating from input fields
        columnsList.addEventListener('dragstart', function(e) {
            // Don't allow drag if it started from an input field
            if (e.target.closest('.column-title-input')) {
                e.preventDefault();
                return false;
            }
            
            if (e.target.classList.contains('column-order-item')) {
                draggedItem = e.target;
                e.target.style.opacity = '0.5';
            }
        });

        // Handle input field events to prevent interference
        columnsList.addEventListener('click', function(e) {
            if (e.target.classList.contains('column-title-field')) {
                e.stopPropagation();
            }
        });

        columnsList.addEventListener('dblclick', function(e) {
            if (e.target.classList.contains('column-title-field')) {
                e.stopPropagation();
                // Select all text on double-click
                e.target.select();
            }
        });

        // Handle focus events to ensure proper text selection
        columnsList.addEventListener('focus', function(e) {
            if (e.target.classList.contains('column-title-field')) {
                // Disable parent dragging while input has focus
                const item = e.target.closest('.column-order-item');
                if (item) {
                    item.draggable = false;
                }
            }
        }, true);

        columnsList.addEventListener('blur', function(e) {
            if (e.target.classList.contains('column-title-field')) {
                // Re-enable parent dragging when input loses focus
                const item = e.target.closest('.column-order-item');
                if (item) {
                    item.draggable = true;
                }
            }
        }, true);

        columnsList.addEventListener('dragend', function(e) {
            if (e.target.classList.contains('column-order-item')) {
                e.target.style.opacity = '';
                draggedItem = null;
                updateButtonStates();
            }
        });

        columnsList.addEventListener('dragover', function(e) {
            e.preventDefault();
        });

        columnsList.addEventListener('drop', function(e) {
            e.preventDefault();
            const target = e.target.closest('.column-order-item');
            if (target && draggedItem && target !== draggedItem) {
                const rect = target.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                
                if (e.clientY < midY) {
                    columnsList.insertBefore(draggedItem, target);
                } else {
                    columnsList.insertBefore(draggedItem, target.nextSibling);
                }
                updateButtonStates();
            }
        });

        // Bind move buttons and delete buttons
        columnsList.addEventListener('click', function(e) {
            if (e.target.classList.contains('move-up')) {
                const item = e.target.closest('.column-order-item');
                const prev = item.previousElementSibling;
                if (prev) {
                    columnsList.insertBefore(item, prev);
                    updateButtonStates();
                }
            } else if (e.target.classList.contains('move-down')) {
                const item = e.target.closest('.column-order-item');
                const next = item.nextElementSibling;
                if (next) {
                    columnsList.insertBefore(next, item);
                    updateButtonStates();
                }
            } else if (e.target.classList.contains('delete-column')) {
                const item = e.target.closest('.column-order-item');
                const columnIndex = parseInt(e.target.dataset.columnIndex);
                const columnTitle = boardData.columns[columnIndex].title;
                const cardCount = boardData.columns[columnIndex].cards ? boardData.columns[columnIndex].cards.length : 0;
                
                if (cardCount > 0) {
                    const confirmMessage = `La colonne "${columnTitle}" contient ${cardCount} carte(s). Êtes-vous sûr de vouloir la supprimer ? Toutes les cartes seront perdues.`;
                    if (!confirm(confirmMessage)) {
                        return;
                    }
                } else {
                    const confirmMessage = `Êtes-vous sûr de vouloir supprimer la colonne "${columnTitle}" ?`;
                    if (!confirm(confirmMessage)) {
                        return;
                    }
                }
                
                // Mark item for deletion
                item.classList.add('marked-for-deletion');
                item.style.opacity = '0.5';
                item.style.textDecoration = 'line-through';
                
                // Disable the delete button
                e.target.disabled = true;
                e.target.textContent = '❌';
                e.target.title = 'Marqué pour suppression';
                
                updateButtonStates();
            }
        });

        // Add new column button
        modal.querySelector('#add-new-column').addEventListener('click', () => {
            const columnTitle = prompt('Nom de la nouvelle colonne:');
            if (!columnTitle || !columnTitle.trim()) return;
            
            // Add to boardData temporarily for the modal
            const newColumn = {
                id: 'col_' + Date.now(),
                title: columnTitle.trim(),
                cards: []
            };
            boardData.columns.push(newColumn);
            
            // Add to DOM
            const newIndex = boardData.columns.length - 1;
            const newItem = document.createElement('li');
            newItem.className = 'column-order-item new-column';
            newItem.draggable = true;
            newItem.dataset.originalIndex = newIndex;
            
            newItem.innerHTML = `
                <div class="column-order-content">
                    <span class="column-order-handle">≡</span>
                    <div class="column-info">
                        <div class="column-title-input">
                            <input type="text" class="column-title-field" value="${window.KanbanModalCore.escapeHtml(newColumn.title)}" 
                                   placeholder="Nom de la colonne" data-column-index="${newIndex}">
                        </div>
                        <small>0 carte(s)</small>
                    </div>
                    <div class="column-order-controls">
                        <button type="button" class="kanban-btn-icon move-up" title="Monter">↑</button>
                        <button type="button" class="kanban-btn-icon move-down" title="Descendre">↓</button>
                        <button type="button" class="kanban-btn-icon delete-column" title="Supprimer la colonne" data-column-index="${newIndex}">🗑️</button>
                    </div>
                </div>
            `;
            
            columnsList.appendChild(newItem);
            updateButtonStates();
            
            // Focus on the new column's title input
            const titleInput = newItem.querySelector('.column-title-field');
            titleInput.focus();
            titleInput.select();
        });

        // Apply button
        modal.querySelector('#apply-column-order').addEventListener('click', () => {
            const items = modal.querySelectorAll('.column-order-item');
            const deletedColumns = [];
            const newOrder = [];
            const updatedTitles = {};
            const addedColumns = [];
            
            // Process items and identify deletions, additions, and changes
            Array.from(items).forEach((item, newIndex) => {
                const originalIndex = parseInt(item.dataset.originalIndex);
                
                if (item.classList.contains('marked-for-deletion')) {
                    deletedColumns.push(originalIndex);
                } else if (item.classList.contains('new-column')) {
                    // This is a new column
                    const titleInput = item.querySelector('.column-title-field');
                    const newTitle = titleInput.value.trim();
                    if (newTitle) {
                        addedColumns.push({
                            id: boardData.columns[originalIndex].id,
                            title: newTitle,
                            cards: []
                        });
                    }
                } else {
                    newOrder.push(originalIndex);
                    
                    // Check for title changes
                    const titleInput = item.querySelector('.column-title-field');
                    const newTitle = titleInput.value.trim();
                    if (newTitle && newTitle !== boardData.columns[originalIndex].title) {
                        updatedTitles[originalIndex] = newTitle;
                    }
                }
            });
            
            callback(newOrder, updatedTitles, deletedColumns, addedColumns);
            window.KanbanModalCore.closeModal(modal);
        });

        // Cancel button
        modal.querySelector('.kanban-modal-cancel').addEventListener('click', () => {
            window.KanbanModalCore.closeModal(modal);
        });

        // Initial button state update
        setTimeout(updateButtonStates, 100);

        modal.style.display = 'block';
        return modal;
    }

    /**
     * Create column form HTML
     */
    function createColumnForm(columnData) {
        const escapeHtml = window.KanbanModalCore.escapeHtml;

        return `
            <form class="kanban-column-form" id="kanban-column-form">
                <div class="kanban-modal-section">
                    <h4 class="kanban-modal-section-title">🏛️ Configuration de la colonne</h4>
                    <div class="form-group">
                        <label for="column-title">Titre *</label>
                        <input type="text" id="column-title" name="title" value="${escapeHtml(columnData.title)}" 
                               required placeholder="Nom de la colonne...">
                    </div>
                    
                    <div class="form-group">
                        <label>📊 Statistiques</label>
                        <div class="view-content">
                            <p>🗂️ Nombre de cartes : <strong>${columnData.cards ? columnData.cards.length : 0}</strong></p>
                        </div>
                    </div>
                </div>
            </form>
        `;
    }

    /**
     * Create column order form HTML
     */
    function createColumnOrderForm(boardData) {
        const escapeHtml = window.KanbanModalCore.escapeHtml;

        let html = `
            <div class="kanban-modal-section">
                <h4 class="kanban-modal-section-title">📋 Gestion des colonnes</h4>
                <p class="help-text">Réorganisez l'ordre des colonnes et modifiez leurs noms. Faites glisser les colonnes ou utilisez les boutons flèches.</p>
                
                <div class="columns-order-container">
                    <ul id="columns-order-list" class="columns-order-list">
        `;

        boardData.columns.forEach((column, index) => {
            html += `
                <li class="column-order-item" draggable="true" data-original-index="${index}">
                    <div class="column-order-content">
                        <span class="column-order-handle">≡</span>
                        <div class="column-info">
                            <div class="column-title-input">
                                <input type="text" class="column-title-field" value="${escapeHtml(column.title)}" 
                                       placeholder="Nom de la colonne" data-column-index="${index}">
                            </div>
                            <small>${column.cards ? column.cards.length : 0} carte(s)</small>
                        </div>
                        <div class="column-order-controls">
                            <button type="button" class="kanban-btn-icon move-up" title="Monter">↑</button>
                            <button type="button" class="kanban-btn-icon move-down" title="Descendre">↓</button>
                            <button type="button" class="kanban-btn-icon delete-column" title="Supprimer la colonne" data-column-index="${index}">🗑️</button>
                        </div>
                    </div>
                </li>
            `;
        });

        html += `
                    </ul>
                    
                    <div class="add-column-section">
                        <button type="button" class="kanban-btn kanban-btn-primary add-new-column" id="add-new-column">
                            ➕ Ajouter une nouvelle colonne
                        </button>
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    // Export functions to global scope
    window.KanbanModalColumns = {
        showColumnModal,
        showColumnOrderModal,
        createColumnForm,
        createColumnOrderForm
    };

})();
