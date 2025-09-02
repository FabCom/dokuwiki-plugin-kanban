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

        columnsList.addEventListener('dragstart', function(e) {
            if (e.target.classList.contains('column-order-item')) {
                draggedItem = e.target;
                e.target.style.opacity = '0.5';
            }
        });

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

        // Bind move buttons
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
            }
        });

        // Apply button
        modal.querySelector('#apply-column-order').addEventListener('click', () => {
            const items = modal.querySelectorAll('.column-order-item');
            const newOrder = Array.from(items).map(item => parseInt(item.dataset.originalIndex));
            callback(newOrder);
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
                <h4 class="kanban-modal-section-title">📋 Ordre des colonnes</h4>
                <p class="help-text">Faites glisser les colonnes pour les réorganiser, ou utilisez les boutons flèches.</p>
                
                <div class="columns-order-container">
                    <ul id="columns-order-list" class="columns-order-list">
        `;

        boardData.columns.forEach((column, index) => {
            html += `
                <li class="column-order-item" draggable="true" data-original-index="${index}">
                    <div class="column-order-content">
                        <span class="column-order-handle">≡</span>
                        <div class="column-info">
                            <strong>${escapeHtml(column.title)}</strong>
                            <small>${column.cards ? column.cards.length : 0} carte(s)</small>
                        </div>
                        <div class="column-order-controls">
                            <button type="button" class="kanban-btn-icon move-up" title="Monter">↑</button>
                            <button type="button" class="kanban-btn-icon move-down" title="Descendre">↓</button>
                        </div>
                    </div>
                </li>
            `;
        });

        html += `
                    </ul>
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
