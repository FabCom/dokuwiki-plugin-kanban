/**
 * Kanban Plugin - Modal Module
 * Gestion des modals (cartes, colonnes, paramètres)
 */

(function() {
    'use strict';

    /**
     * Show modal fo                    <div class="form-group">
                        <label for="card-due-date">📅 Date d'échéance</label>
                        <input type="date" id="card-due-date" name="dueDate" value="${cardData.dueDate || ''}">
                    </div>
                </div>
                
                <!-- Section: Contenu lié -->
                <div class="kanban-modal-section">
                    <h4 class="kanban-modal-section-title">🔗 Contenu lié</h4>
                    
                    <div class="form-group">
                        <label>🔗 Liens internes</label>
                        <div class="linked-content-info">
                            <span id="internal-links-count">${cardData.internalLinks ? cardData.internalLinks.length : 0} lien(s) interne(s)</span>
                            <button type="button" class="kanban-btn-small" id="manage-internal-links">Gérer les liens</button>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>📎 Médias attachés</label>
                        <div class="linked-content-info">
                            <span id="media-count">${cardData.media ? cardData.media.length : 0} média(s) attaché(s)</span>
                            <button type="button" class="kanban-btn-small" id="manage-media" disabled title="Fonctionnalité à venir">Gérer les médias</button>
                        </div>
                    </div>
                </div>
                
                <div class="form-actions">`editing
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
        
        // Event listener pour la gestion des liens internes
        const manageLinksBtn = modal.querySelector('#manage-internal-links');
        if (manageLinksBtn) {
            manageLinksBtn.addEventListener('click', function() {
                showInternalLinksModal(cardData, function(links) {
                    // Mettre à jour les liens internes dans cardData
                    cardData.internalLinks = links;
                    // Mettre à jour l'affichage du nombre de liens
                    const linksCount = modal.querySelector('#internal-links-count');
                    if (linksCount) {
                        linksCount.textContent = `${links.length} lien(s) interne(s)`;
                    }
                });
            });
        }
        
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
                
                <!-- Section: Contenu lié -->
                <div class="kanban-modal-section">
                    <h4 class="kanban-modal-section-title">🔗 Contenu lié</h4>
                    
                    <div class="form-group">
                        <label>🔗 Liens internes</label>
                        <div class="linked-content-info">
                            <span id="internal-links-count">${cardData.internalLinks ? cardData.internalLinks.length : 0} lien(s) interne(s)</span>
                            <button type="button" class="kanban-btn-small" id="manage-internal-links">Gérer les liens</button>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>📎 Médias attachés</label>
                        <div class="linked-content-info">
                            <span id="media-count">${cardData.media ? cardData.media.length : 0} média(s) attaché(s)</span>
                            <button type="button" class="kanban-btn-small" id="manage-media" disabled title="Fonctionnalité à venir">Gérer les médias</button>
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

    /**
     * Show modal for card viewing (read-only)
     */
    function showCardViewModal(cardData) {
        const modal = createModal('kanban-card-view-modal', '📋 Consultation de carte');
        
        // Ajouter la classe read-only pour le styling
        modal.classList.add('kanban-modal-readonly');
        
        const form = createCardViewForm(cardData);
        modal.querySelector('.kanban-modal-body').appendChild(form);
        
        // Event listeners (seulement fermeture)
        const closeBtn = modal.querySelector('.kanban-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeModal(modal));
        }
        
        return modal;
    }

    /**
     * Create card view form HTML (read-only)
     */
    function createCardViewForm(cardData) {
        const escapeHtml = window.KanbanUtils?.escapeHtml || ((text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        });

        const formatDate = window.KanbanUtils?.formatDate || ((dateString) => {
            if (!dateString) return '';
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return dateString;
                return date.toLocaleDateString('fr-FR');
            } catch(e) {
                return dateString;
            }
        });

        const form = document.createElement('div');
        form.className = 'kanban-card-view';
        form.innerHTML = `
            <!-- Section: Informations principales -->
            <div class="kanban-modal-section">
                <h4 class="kanban-modal-section-title">📝 Informations principales</h4>
                <div class="view-group">
                    <label>Titre</label>
                    <div class="view-content kanban-card-title-view">${escapeHtml(cardData.title)}</div>
                </div>
                
                ${cardData.description ? `
                <div class="view-group">
                    <label>Description</label>
                    <div class="view-content kanban-card-description-view">${escapeHtml(cardData.description)}</div>
                </div>
                ` : ''}
                
                ${cardData.tags && cardData.tags.length > 0 ? `
                <div class="view-group">
                    <label>🏷️ Tags</label>
                    <div class="view-content kanban-tags-view">
                        ${cardData.tags.map(tag => `<span class="kanban-tag-readonly">${escapeHtml(tag)}</span>`).join('')}
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- Section: Organisation -->
            <div class="kanban-modal-section">
                <h4 class="kanban-modal-section-title">🎯 Organisation</h4>
                <div class="view-group-row">
                    <div class="view-group view-group-half">
                        <label>Priorité</label>
                        <div class="view-content priority-${cardData.priority || 'normal'}">
                            ${cardData.priority === 'low' ? '🟢 Basse' : 
                              cardData.priority === 'medium' ? '🟡 Moyenne' : 
                              cardData.priority === 'high' ? '🔴 Haute' : '⚪ Normale'}
                        </div>
                    </div>
                    
                    ${cardData.assignee ? `
                    <div class="view-group view-group-half">
                        <label>👤 Assigné à</label>
                        <div class="view-content">${escapeHtml(cardData.assignee)}</div>
                    </div>
                    ` : ''}
                </div>
                
                ${cardData.dueDate ? `
                <div class="view-group">
                    <label>📅 Date d'échéance</label>
                    <div class="view-content">${formatDate(cardData.dueDate)}</div>
                </div>
                ` : ''}
            </div>

            <!-- Section: Contenu lié -->
            <div class="kanban-modal-section">
                <h4 class="kanban-modal-section-title">🔗 Contenu lié</h4>
                
                <!-- Liens internes -->
                <div class="view-group">
                    <label>🔗 Liens internes</label>
                    <div class="view-content">
                        ${cardData.internalLinks && cardData.internalLinks.length > 0 ? 
                            cardData.internalLinks.map(link => 
                                `<div class="internal-link-item">
                                    <a href="${DOKU_BASE}doku.php?id=${encodeURIComponent(link.target)}" target="_blank" class="internal-link-readonly">
                                        📄 ${escapeHtml(link.text || link.target)}
                                    </a>
                                    ${link.target !== (link.text || link.target) ? `<small class="link-target">(${escapeHtml(link.target)})</small>` : ''}
                                </div>`
                            ).join('') 
                            : '<em>Aucun lien interne</em>'
                        }
                    </div>
                </div>
                
                <!-- Médias (préparé pour future implémentation) -->
                <div class="view-group">
                    <label>📎 Médias attachés</label>
                    <div class="view-content">
                        ${cardData.media && cardData.media.length > 0 ? 
                            cardData.media.map(media => 
                                `<div class="media-item-readonly">📎 ${escapeHtml(media.name || media.url)}</div>`
                            ).join('') 
                            : '<em>Aucun média attaché</em>'
                        }
                    </div>
                </div>
            </div>

            <!-- Section: Métadonnées -->
            <div class="kanban-modal-section">
                <h4 class="kanban-modal-section-title">ℹ️ Métadonnées</h4>
                
                ${cardData.creator ? `
                <div class="view-group">
                    <label>🏗️ Créé par</label>
                    <div class="view-content">${escapeHtml(cardData.creator)}${cardData.created ? ` le ${formatDate(cardData.created)}` : ''}</div>
                </div>
                ` : ''}
                
                ${cardData.lastModifiedBy && cardData.lastModified ? `
                <div class="view-group">
                    <label>🔧 Dernière modification</label>
                    <div class="view-content">${escapeHtml(cardData.lastModifiedBy)} le ${formatDate(cardData.lastModified)}</div>
                </div>
                ` : ''}
            </div>
        `;
        
        return form;
    }

    /**
     * Show internal links modal for adding internal page links to a card
     */
    function showInternalLinksModal(cardData, onSave) {
        const modal = createModal('kanban-internal-links-modal', 'Gérer les liens internes');
        
        const form = createInternalLinksForm(cardData);
        // Get the modal body and clear it first
        const modalBody = modal.querySelector('.kanban-modal-body');
        modalBody.innerHTML = ''; // Clear any existing content
        modalBody.appendChild(form);
        
        // Add footer with action buttons - Create footer and append to the inner modal
        const footer = document.createElement('div');
        footer.className = 'kanban-modal-footer';
        footer.innerHTML = 
            '<button type="button" class="kanban-btn kanban-btn-primary" id="saveInternalLinks">Enregistrer</button>' +
            '<button type="button" class="kanban-btn kanban-btn-secondary" id="cancelInternalLinks">Annuler</button>';
        
        // Append footer to the inner modal (not the overlay)
        const innerModal = modal.querySelector('.kanban-modal');
        innerModal.appendChild(footer);
        
        // Bind events
        bindInternalLinksEvents(modal, cardData, onSave);
        
        // Modal is already appended by createModal, no need to append again
        modal.style.display = 'block';
        
        // Load existing internal links
        loadCardInternalLinks(modal, cardData);
        
        return modal;
    }

    /**
     * Create internal links management form
     */
    function createInternalLinksForm(cardData) {
        const form = document.createElement('form');
        form.className = 'kanban-internal-links-form';
        form.innerHTML = 
            '<div class="internal-links-section">' +
                '<div class="section-header">' +
                    '<h4>Liens internes vers des pages</h4>' +
                    '<button type="button" class="kanban-btn-small" id="addInternalLink">+ Ajouter un lien</button>' +
                '</div>' +
                '<div id="internalLinksList" class="internal-links-list">' +
                    '<p class="no-links-message">Aucun lien interne ajouté</p>' +
                '</div>' +
            '</div>' +
            
            '<div class="add-link-section" id="addLinkSection" style="display: none;">' +
                '<div class="form-group">' +
                    '<label>Page à lier :</label>' +
                    '<div class="input-with-button">' +
                        '<input type="text" id="linkTarget" placeholder="nom:de:page ou rechercher..." class="kanban-input">' +
                        '<button type="button" id="browsePagesBtn" class="kanban-btn-icon" title="Parcourir les pages">📁</button>' +
                    '</div>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label>Texte du lien (optionnel) :</label>' +
                    '<input type="text" id="linkText" placeholder="Laissez vide pour utiliser le nom de la page" class="kanban-input">' +
                '</div>' +
                '<div class="form-actions">' +
                    '<button type="button" id="confirmAddLink" class="kanban-btn kanban-btn-primary kanban-btn-small">Ajouter</button>' +
                    '<button type="button" id="cancelAddLink" class="kanban-btn kanban-btn-secondary kanban-btn-small">Annuler</button>' +
                '</div>' +
            '</div>' +
            
            '<div class="page-browser" id="pageBrowser" style="display: none;">' +
                '<div class="browser-header">' +
                    '<h5>Parcourir les pages</h5>' +
                    '<button type="button" id="closeBrowser" class="close-btn">×</button>' +
                '</div>' +
                '<div class="browser-search">' +
                    '<input type="text" id="pageSearch" placeholder="Rechercher une page..." class="kanban-input">' +
                '</div>' +
                '<div class="browser-content">' +
                    '<div class="namespaces-list" id="namespacesList">' +
                        '<div class="namespace-header">📁 Dossiers</div>' +
                        '<div id="namespacesContent"></div>' +
                    '</div>' +
                    '<div class="pages-list" id="pagesList">' +
                        '<div class="pages-header">📄 Pages</div>' +
                        '<div id="pagesContent"></div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        
        return form;
    }

    /**
     * Bind events for internal links modal
     */
    function bindInternalLinksEvents(modal, cardData, onSave) {
        // Close modal
        modal.querySelector('.kanban-modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Save links
        modal.querySelector('#saveInternalLinks').addEventListener('click', () => {
            const links = saveCardInternalLinks(modal);
            onSave(links);
            document.body.removeChild(modal);
        });
        
        // Cancel
        modal.querySelector('#cancelInternalLinks').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Add link button
        modal.querySelector('#addInternalLink').addEventListener('click', () => {
            modal.querySelector('#addLinkSection').style.display = 'block';
            modal.querySelector('#linkTarget').focus();
        });
        
        // Browse pages button
        modal.querySelector('#browsePagesBtn').addEventListener('click', () => {
            modal.querySelector('#pageBrowser').style.display = 'block';
            loadPageBrowser(modal);
        });
        
        // Close browser
        modal.querySelector('#closeBrowser').addEventListener('click', () => {
            modal.querySelector('#pageBrowser').style.display = 'none';
        });
        
        // Confirm add link
        modal.querySelector('#confirmAddLink').addEventListener('click', () => {
            addInternalLinkToList(modal);
        });
        
        // Cancel add link
        modal.querySelector('#cancelAddLink').addEventListener('click', () => {
            modal.querySelector('#addLinkSection').style.display = 'none';
            modal.querySelector('#linkTarget').value = '';
            modal.querySelector('#linkText').value = '';
        });
        
        // Page search with debounce
        let searchTimer = null;
        modal.querySelector('#pageSearch').addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                searchPages(modal, e.target.value);
            }, 300);
        });
    }

    /**
     * Load existing internal links for a card
     */
    function loadCardInternalLinks(modal, cardData) {
        if (cardData.internalLinks && cardData.internalLinks.length > 0) {
            const linksList = modal.querySelector('#internalLinksList');
            const noLinksMessage = linksList.querySelector('.no-links-message');
            if (noLinksMessage) {
                noLinksMessage.remove();
            }
            
            cardData.internalLinks.forEach(link => {
                addLinkToList(modal, link.target, link.text || '');
            });
        }
    }

    /**
     * Load page browser with namespaces and pages using DokuWiki LinkWizard
     */
    function loadPageBrowser(modal) {
        const namespacesContent = modal.querySelector('#namespacesContent');
        const pagesContent = modal.querySelector('#pagesContent');
        
        // Show loading states
        namespacesContent.innerHTML = '<div class="loading">Chargement...</div>';
        pagesContent.innerHTML = '<div class="loading">Chargement...</div>';
        
        // Use DokuWiki's LinkWizard AJAX endpoint for page listing
        const xhr = new XMLHttpRequest();
        xhr.open('POST', DOKU_BASE + 'lib/exe/ajax.php');
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    separateNamespacesAndPages(xhr.responseText, namespacesContent, pagesContent, modal);
                } catch (error) {
                    console.error('Error parsing LinkWizard response:', error);
                    namespacesContent.innerHTML = '<div class="error">Erreur de parsing</div>';
                    pagesContent.innerHTML = '<div class="error">Erreur de parsing</div>';
                }
            } else {
                namespacesContent.innerHTML = '<div class="error">Erreur (' + xhr.status + ')</div>';
                pagesContent.innerHTML = '<div class="error">Erreur (' + xhr.status + ')</div>';
            }
        };
        
        xhr.onerror = function() {
            namespacesContent.innerHTML = '<div class="error">Erreur de connexion</div>';
            pagesContent.innerHTML = '<div class="error">Erreur de connexion</div>';
        };
        
        // Send request to DokuWiki LinkWizard - empty query to get all pages
        const params = 'call=linkwiz&q=';
        xhr.send(params);
    }

    /**
     * Separate namespaces and pages from LinkWizard response
     */
    function separateNamespacesAndPages(responseText, namespacesDiv, pagesDiv, modal) {
        const lines = responseText.split('\n').filter(line => line.trim());
        const namespaces = new Set();
        const pages = [];
        
        // Parse the LinkWizard response format
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;
            
            // LinkWizard returns lines like: "namespace:page\tTitle"
            const parts = trimmedLine.split('\t');
            const pageId = parts[0];
            const pageTitle = parts[1] || pageId;
            
            // Extract namespace from page ID
            const nsIndex = pageId.lastIndexOf(':');
            if (nsIndex > 0) {
                const ns = pageId.substring(0, nsIndex);
                namespaces.add(ns);
            } else {
                namespaces.add(''); // Root namespace
            }
            
            pages.push({
                id: pageId,
                title: pageTitle,
                namespace: nsIndex > 0 ? pageId.substring(0, nsIndex) : ''
            });
        });
        
        // Populate namespaces
        const namespacesArray = Array.from(namespaces).sort();
        namespacesDiv.innerHTML = namespacesArray.map(ns => {
            const displayName = ns === '' ? '🏠 Racine' : `📁 ${ns}`;
            return `<div class="namespace-item" data-ns="${ns}">${displayName}</div>`;
        }).join('');
        
        // Bind namespace clicks
        namespacesDiv.querySelectorAll('.namespace-item').forEach(item => {
            item.addEventListener('click', () => {
                const ns = item.dataset.ns;
                filterPagesByNamespace(modal, ns, pages);
                // Highlight selected namespace
                namespacesDiv.querySelectorAll('.namespace-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
            });
        });
        
        // Show all pages initially
        filterPagesByNamespace(modal, null, pages);
    }

    /**
     * Filter pages by namespace
     */
    function filterPagesByNamespace(modal, namespace, allPages) {
        const pagesContent = modal.querySelector('#pagesContent');
        
        const filteredPages = allPages.filter(page => {
            if (namespace === null) return true; // Show all
            return page.namespace === namespace;
        });
        
        if (filteredPages.length === 0) {
            pagesContent.innerHTML = '<div class="no-results">Aucune page trouvée</div>';
            return;
        }
        
        pagesContent.innerHTML = filteredPages.map(page => 
            `<div class="page-item" data-page="${page.id}" title="${page.title}">📄 ${page.title}</div>`
        ).join('');
        
        // Bind page clicks
        pagesContent.querySelectorAll('.page-item').forEach(item => {
            item.addEventListener('click', () => {
                const pageName = item.dataset.page;
                modal.querySelector('#linkTarget').value = pageName;
                modal.querySelector('#pageBrowser').style.display = 'none';
            });
        });
    }

    /**
     * Search pages by name using DokuWiki LinkWizard
     */
    function searchPages(modal, query) {
        if (!query.trim()) {
            loadPageBrowser(modal); // Reload all pages
            return;
        }
        
        const pagesContent = modal.querySelector('#pagesContent');
        const namespacesContent = modal.querySelector('#namespacesContent');
        
        // Show loading state
        pagesContent.innerHTML = '<div class="loading">Recherche...</div>';
        
        // Use DokuWiki's LinkWizard AJAX endpoint for page search
        const xhr = new XMLHttpRequest();
        xhr.open('POST', DOKU_BASE + 'lib/exe/ajax.php');
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    const lines = xhr.responseText.split('\n').filter(line => line.trim());
                    const pages = [];
                    
                    lines.forEach(line => {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) return;
                        
                        const parts = trimmedLine.split('\t');
                        const pageId = parts[0];
                        const pageTitle = parts[1] || pageId;
                        
                        pages.push({
                            id: pageId,
                            title: pageTitle
                        });
                    });
                    
                    if (pages.length === 0) {
                        pagesContent.innerHTML = '<div class="no-results">Aucun résultat pour "' + query + '"</div>';
                        return;
                    }
                    
                    pagesContent.innerHTML = pages.map(page => 
                        `<div class="page-item" data-page="${page.id}" title="${page.title}">🔍 ${page.title}</div>`
                    ).join('');
                    
                    // Bind page clicks
                    pagesContent.querySelectorAll('.page-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const pageName = item.dataset.page;
                            modal.querySelector('#linkTarget').value = pageName;
                            modal.querySelector('#pageBrowser').style.display = 'none';
                        });
                    });
                    
                } catch (error) {
                    console.error('Error parsing search response:', error);
                    pagesContent.innerHTML = '<div class="error">Erreur de recherche</div>';
                }
            } else {
                pagesContent.innerHTML = '<div class="error">Erreur (' + xhr.status + ')</div>';
            }
        };
        
        xhr.onerror = function() {
            pagesContent.innerHTML = '<div class="error">Erreur de connexion</div>';
        };
        
        // Send search query to DokuWiki LinkWizard
        const params = 'call=linkwiz&q=' + encodeURIComponent(query);
        xhr.send(params);
    }

    /**
     * Add internal link to the list
     */
    function addInternalLinkToList(modal) {
        const target = modal.querySelector('#linkTarget').value.trim();
        const text = modal.querySelector('#linkText').value.trim();
        
        if (!target) {
            alert('Veuillez spécifier une page à lier');
            return;
        }
        
        addLinkToList(modal, target, text);
        
        // Reset form
        modal.querySelector('#addLinkSection').style.display = 'none';
        modal.querySelector('#linkTarget').value = '';
        modal.querySelector('#linkText').value = '';
    }

    /**
     * Add link to the list (helper function)
     */
    function addLinkToList(modal, target, text) {
        const linksList = modal.querySelector('#internalLinksList');
        const noLinksMessage = linksList.querySelector('.no-links-message');
        
        if (noLinksMessage) {
            noLinksMessage.remove();
        }
        
        const linkItem = document.createElement('div');
        linkItem.className = 'internal-link-item';
        linkItem.innerHTML = 
            `<div class="link-info">
                <div class="link-target">🔗 ${escapeHtml(target)}</div>
                ${text ? `<div class="link-text">📝 ${escapeHtml(text)}</div>` : ''}
            </div>
            <button type="button" class="remove-link-btn" title="Supprimer">×</button>`;
        
        linkItem.dataset.target = target;
        linkItem.dataset.text = text;
        
        // Bind remove button
        linkItem.querySelector('.remove-link-btn').addEventListener('click', () => {
            linkItem.remove();
            if (linksList.children.length === 0) {
                linksList.innerHTML = '<p class="no-links-message">Aucun lien interne ajouté</p>';
            }
        });
        
        linksList.appendChild(linkItem);
    }

    /**
     * Save internal links for a card
     */
    function saveCardInternalLinks(modal) {
        const linksList = modal.querySelector('#internalLinksList');
        const links = [];
        
        linksList.querySelectorAll('.internal-link-item').forEach(item => {
            links.push({
                target: item.dataset.target,
                text: item.dataset.text || ''
            });
        });
        
        return links;
    }

    /**
     * Escape HTML to prevent XSS
     */
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
        showCardViewModal,
        showColumnModal,
        showColumnOrderModal,
        showConfirmModal,
        showInternalLinksModal,
        createModal,
        closeModal
    };

    console.log('🎨 KanbanModal module loaded');

})();
