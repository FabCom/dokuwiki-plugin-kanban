/**
 * Kanban Plugin - Modal Module
 * Gestion des modals (cartes, colonnes, paramètres)
 */

(function() {
    'use strict';

    /**
     * Show modal for card editing
     */
    function showCardModal(cardData, callback) {
        const modal = createModal('card-modal', 'Éditer la carte', createCardForm(cardData));
        
        // Event listeners
        const form = modal.querySelector('.kanban-card-form');
        
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
            
            closeModal(modal);
            callback(updatedData);
        });
        
        // Focus on title field
        modal.querySelector('#card-title').focus();
        
        return modal;
    }

    /**
     * Show modal for column editing
     */
    function showColumnModal(columnData, callback) {
        const modal = createModal('column-modal', 'Éditer la colonne', createColumnForm(columnData));
        
        // Event listeners
        const form = modal.querySelector('.kanban-column-form');
        
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(form);
            const updatedData = Object.assign({}, columnData);
            
            updatedData.title = formData.get('title');
            updatedData.description = formData.get('description') || '';
            updatedData.color = formData.get('color') || '';
            updatedData.limit = parseInt(formData.get('limit')) || 0;
            
            closeModal(modal);
            callback(updatedData);
        });
        
        // Focus on title field
        modal.querySelector('#column-title').focus();
        
        return modal;
    }

    /**
     * Create base modal structure
     */
    function createModal(id, title, bodyContent) {
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'kanban-modal-overlay';
        
        modal.innerHTML = `
            <div class="kanban-modal">
                <div class="kanban-modal-header">
                    <h3>${escapeHtml(title)}</h3>
                    <button class="kanban-modal-close">×</button>
                </div>
                <div class="kanban-modal-body">
                    ${bodyContent}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup close handlers
        setupModalCloseHandlers(modal);
        
        return modal;
    }

    /**
     * Create card form HTML
     */
    function createCardForm(cardData) {
        const escapeHtml = window.KanbanUtils?.escapeHtml || ((text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        });

        return `
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
                                  placeholder="Description...">${escapeHtml(cardData.description || '')}</textarea>
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
        `;
    }

    /**
     * Create column form HTML
     */
    function createColumnForm(columnData) {
        const escapeHtml = window.KanbanUtils?.escapeHtml || ((text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        });

        return `
            <form class="kanban-column-form">
                <div class="kanban-modal-section">
                    <h4 class="kanban-modal-section-title">🏛️ Configuration de la colonne</h4>
                    <div class="form-group">
                        <label for="column-title">Titre *</label>
                        <input type="text" id="column-title" name="title" value="${escapeHtml(columnData.title)}" 
                               required placeholder="Titre de la colonne...">
                    </div>
                    
                    <div class="form-group">
                        <label for="column-description">Description</label>
                        <textarea id="column-description" name="description" rows="2" 
                                  placeholder="Description de la colonne...">${escapeHtml(columnData.description || '')}</textarea>
                    </div>
                    
                    <div class="form-group-row">
                        <div class="form-group form-group-half">
                            <label for="column-color">🎨 Couleur</label>
                            <select id="column-color" name="color">
                                <option value="" ${!columnData.color ? 'selected' : ''}>Par défaut</option>
                                <option value="blue" ${columnData.color === 'blue' ? 'selected' : ''}>🔵 Bleu</option>
                                <option value="green" ${columnData.color === 'green' ? 'selected' : ''}>🟢 Vert</option>
                                <option value="yellow" ${columnData.color === 'yellow' ? 'selected' : ''}>🟡 Jaune</option>
                                <option value="red" ${columnData.color === 'red' ? 'selected' : ''}>🔴 Rouge</option>
                                <option value="purple" ${columnData.color === 'purple' ? 'selected' : ''}>🟣 Violet</option>
                            </select>
                        </div>
                        
                        <div class="form-group form-group-half">
                            <label for="column-limit">📊 Limite WIP</label>
                            <input type="number" id="column-limit" name="limit" 
                                   value="${columnData.limit || ''}" 
                                   placeholder="0 = illimité" min="0">
                        </div>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="kanban-btn kanban-btn-primary">💾 Sauvegarder</button>
                    <button type="button" class="kanban-btn kanban-btn-secondary kanban-modal-cancel">❌ Annuler</button>
                </div>
            </form>
        `;
    }

    /**
     * Setup modal close handlers
     */
    function setupModalCloseHandlers(modal) {
        const closeBtn = modal.querySelector('.kanban-modal-close');
        const cancelBtn = modal.querySelector('.kanban-modal-cancel');
        
        function closeModalHandler() {
            closeModal(modal);
        }
        
        closeBtn.addEventListener('click', closeModalHandler);
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModalHandler);
        }
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeModalHandler();
        });
        
        // Escape key to close
        function handleEscape(e) {
            if (e.key === 'Escape') {
                closeModalHandler();
                document.removeEventListener('keydown', handleEscape);
            }
        }
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Close and remove modal
     */
    function closeModal(modal) {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }

    /**
     * Show modal for column order management
     */
    function showColumnOrderModal(boardData, callback) {
        const modal = createModal('column-order-modal', 'Réorganiser les colonnes', createColumnOrderForm(boardData));
        
        // Event listeners
        const form = modal.querySelector('.kanban-column-order-form');
        const moveUpButtons = modal.querySelectorAll('.move-up');
        const moveDownButtons = modal.querySelectorAll('.move-down');
        
        // Update button states
        function updateButtonStates() {
            const items = form.querySelectorAll('.column-order-item');
            items.forEach((item, index) => {
                const moveUp = item.querySelector('.move-up');
                const moveDown = item.querySelector('.move-down');
                
                moveUp.disabled = index === 0;
                moveDown.disabled = index === items.length - 1;
            });
        }
        
        // Move up handler
        moveUpButtons.forEach(button => {
            button.addEventListener('click', function() {
                const item = this.closest('.column-order-item');
                const prev = item.previousElementSibling;
                if (prev) {
                    item.parentNode.insertBefore(item, prev);
                    updateButtonStates();
                }
            });
        });
        
        // Move down handler
        moveDownButtons.forEach(button => {
            button.addEventListener('click', function() {
                const item = this.closest('.column-order-item');
                const next = item.nextElementSibling;
                if (next) {
                    item.parentNode.insertBefore(next, item);
                    updateButtonStates();
                }
            });
        });
        
        // Initial button state update
        updateButtonStates();
        
        // Form submit
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get new order
            const items = form.querySelectorAll('.column-order-item');
            const newOrder = Array.from(items).map(item => parseInt(item.dataset.originalIndex));
            
            closeModal(modal);
            callback(newOrder);
        });
        
        return modal;
    }

    /**
     * Create column order form HTML
     */
    function createColumnOrderForm(boardData) {
        const escapeHtml = window.KanbanUtils?.escapeHtml || ((text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        });

        let html = `
            <form class="kanban-column-order-form">
                <div class="kanban-modal-section">
                    <h4 class="kanban-modal-section-title">🏛️ Ordre des colonnes</h4>
                    <p style="color: #6c757d; margin-bottom: 20px;">Utilisez les boutons ↑ ↓ pour réorganiser les colonnes.</p>
                    <div class="column-order-list">`;
        
        boardData.columns.forEach((column, index) => {
            const cardCount = column.cards ? column.cards.length : 0;
            html += `
                <div class="column-order-item" data-original-index="${index}">
                    <div class="column-order-info">
                        <div class="column-order-title">${escapeHtml(column.title)}</div>
                        <div class="column-order-meta">${cardCount} carte${cardCount !== 1 ? 's' : ''}</div>
                    </div>
                    <div class="column-order-actions">
                        <button type="button" class="kanban-btn-icon move-up" title="Monter">↑</button>
                        <button type="button" class="kanban-btn-icon move-down" title="Descendre">↓</button>
                    </div>
                </div>`;
        });
        
        html += `
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="kanban-btn kanban-btn-primary">💾 Appliquer l'ordre</button>
                    <button type="button" class="kanban-btn kanban-btn-secondary kanban-modal-cancel">❌ Annuler</button>
                </div>
            </form>
        `;
        
        return html;
    }
    function showConfirmModal(message, onConfirm, onCancel = null) {
        const modal = createModal('confirm-modal', 'Confirmation', `
            <div class="kanban-modal-section">
                <p class="confirm-message">${escapeHtml(message)}</p>
                <div class="form-actions">
                    <button type="button" class="kanban-btn kanban-btn-primary confirm-yes">✅ Confirmer</button>
                    <button type="button" class="kanban-btn kanban-btn-secondary confirm-no">❌ Annuler</button>
                </div>
            </div>
        `);
        
        const yesBtn = modal.querySelector('.confirm-yes');
        const noBtn = modal.querySelector('.confirm-no');
        
        yesBtn.addEventListener('click', () => {
            closeModal(modal);
            if (onConfirm) onConfirm();
        });
        
        noBtn.addEventListener('click', () => {
            closeModal(modal);
            if (onCancel) onCancel();
        });
        
        return modal;
    }

    // Helper function for escaping HTML (fallback)
    function escapeHtml(text) {
        if (window.KanbanUtils && window.KanbanUtils.escapeHtml) {
            return window.KanbanUtils.escapeHtml(text);
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Export to global scope
    window.KanbanModal = {
        showCardModal,
        showColumnModal,
        showColumnOrderModal,
        showConfirmModal,
        createModal,
        closeModal
    };

    console.log('🎨 KanbanModal module loaded');

})();
