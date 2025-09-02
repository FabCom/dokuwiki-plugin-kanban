/**
 * Kanban Plugin JavaScript - Modal Cards Module
 * Card editing and viewing modals
 * @version 2.1.0
 */

(function() {
    'use strict';

    /**
     * Show card editing modal
     */
    function showCardModal(cardData, callback) {
        const modal = window.KanbanModalCore.createModal('kanban-card-modal', 'Éditer la carte');
        
        const form = createCardForm(cardData);
        modal.querySelector('.kanban-modal-body').innerHTML = form;

        // Add footer
        const footer = document.createElement('div');
        footer.className = 'kanban-modal-footer';
        footer.innerHTML = `
            <button type="submit" class="kanban-btn kanban-btn-primary" form="kanban-card-form">💾 Sauvegarder</button>
            <button type="button" class="kanban-btn kanban-btn-secondary kanban-modal-cancel">❌ Annuler</button>
        `;
        
        const innerModal = modal.querySelector('.kanban-modal');
        innerModal.appendChild(footer);

        // Bind form submission
        const formElement = modal.querySelector('#kanban-card-form');
        formElement.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(formElement);
            const updatedData = Object.assign({}, cardData);
            
            // Basic fields
            updatedData.title = formData.get('title');
            updatedData.description = formData.get('description');
            updatedData.priority = formData.get('priority');
            updatedData.assignee = formData.get('assignee');
            updatedData.dueDate = formData.get('dueDate');
            
            // Parse tags
            const tagsInput = formData.get('tags');
            updatedData.tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
            
            // Extract internal links from form
            const internalLinksList = modal.querySelector('#internal-links-list-inline');
            const internalLinks = [];
            if (internalLinksList) {
                internalLinksList.querySelectorAll('.internal-link-item').forEach(item => {
                    internalLinks.push({
                        target: item.dataset.target,
                        text: item.dataset.text || ''
                    });
                });
            }
            updatedData.internalLinks = internalLinks;
            
            // Keep existing metadata
            if (!updatedData.created) {
                updatedData.created = window.KanbanUtils?.getCurrentDateTime()?.split(' ')[0] || new Date().toISOString().split('T')[0];
            }
            if (!updatedData.creator) {
                updatedData.creator = window.KanbanUtils?.getCurrentUser() || 'Utilisateur';
            }
            
            callback(updatedData);
            window.KanbanModalCore.closeModal(modal);
        });

        // Bind cancel button
        modal.querySelector('.kanban-modal-cancel').addEventListener('click', () => {
            window.KanbanModalCore.closeModal(modal);
        });

        // Bind add internal link button
        const addLinkBtn = modal.querySelector('#add-internal-link');
        if (addLinkBtn && window.KanbanModalLinks) {
            addLinkBtn.addEventListener('click', () => {
                window.KanbanModalLinks.showPageBrowserModal((selectedPage) => {
                    if (selectedPage) {
                        addInternalLinkToCard(modal, selectedPage.id, selectedPage.title);
                    }
                });
            });
        }

        // Bind remove link buttons
        bindRemoveLinkButtons(modal);

        modal.style.display = 'block';
        return modal;
    }

    /**
     * Show card in read-only modal
     */
    function showCardViewModal(cardData) {
        const modal = window.KanbanModalCore.createModal('kanban-card-view-modal', 'Consulter la carte');
        
        const form = createCardViewForm(cardData);
        modal.querySelector('.kanban-modal-body').innerHTML = form;

        // Add footer with edit option
        const footer = document.createElement('div');
        footer.className = 'kanban-modal-footer';
        footer.innerHTML = `
            <button type="button" class="kanban-btn kanban-btn-secondary kanban-modal-close">Fermer</button>
        `;
        
        const innerModal = modal.querySelector('.kanban-modal');
        innerModal.appendChild(footer);

        // Bind close button
        footer.querySelector('.kanban-modal-close').addEventListener('click', () => {
            window.KanbanModalCore.closeModal(modal);
        });

        modal.style.display = 'block';
        return modal;
    }

    /**
     * Create card form HTML
     */
    function createCardForm(cardData) {
        const escapeHtml = window.KanbanModalCore.escapeHtml;

        return `
            <form class="kanban-card-form" id="kanban-card-form">
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
                        <div class="internal-links-section-inline">
                            <div class="section-header-inline">
                                <span id="internal-links-count">${cardData.internalLinks ? cardData.internalLinks.length : 0} lien(s) interne(s)</span>
                                <button type="button" class="kanban-btn-small" id="add-internal-link">+ Ajouter un lien</button>
                            </div>
                            <div id="internal-links-list-inline" class="internal-links-list">
                                ${createInternalLinksListHTML(cardData.internalLinks || [])}
                            </div>
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
            </form>
        `;
    }

    /**
     * Create internal links list HTML
     */
    function createInternalLinksListHTML(internalLinks) {
        if (!internalLinks || internalLinks.length === 0) {
            return '<p class="no-links-message">Aucun lien interne ajouté</p>';
        }

        const escapeHtml = window.KanbanModalCore.escapeHtml;
        return internalLinks.map(link => `
            <div class="internal-link-item" data-target="${link.target}" data-text="${link.text || ''}">
                <div class="link-info">
                    <div class="link-target">🔗 ${escapeHtml(link.target)}</div>
                    ${link.text ? `<div class="link-text">${escapeHtml(link.text)}</div>` : ''}
                </div>
                <button type="button" class="remove-link-btn" title="Supprimer">×</button>
            </div>
        `).join('');
    }

    /**
     * Create internal links display
     */
    function createInternalLinksDisplay(cardData) {
        const escapeHtml = window.KanbanModalCore.escapeHtml;
        
        if (!cardData.internalLinks || cardData.internalLinks.length === 0) {
            return '<span id="internal-links-count">0 lien(s) interne(s)</span>';
        }

        let html = `<div id="internal-links-display">`;
        html += `<span id="internal-links-count">${cardData.internalLinks.length} lien(s) interne(s)</span>`;
        html += `<div class="internal-links-list-preview">`;
        
        cardData.internalLinks.forEach(link => {
            const displayText = link.text || link.target;
            html += `<div class="internal-link-preview">
                <a href="${DOKU_BASE}doku.php?id=${encodeURIComponent(link.target)}" target="_blank" class="internal-link-readonly">
                    🔗 ${escapeHtml(displayText)}
                </a>
            </div>`;
        });
        
        html += `</div></div>`;
        return html;
    }

    /**
     * Update internal links display after modification
     */
    function updateInternalLinksDisplay(modal, cardData) {
        const linksDisplay = modal.querySelector('#internal-links-display');
        if (linksDisplay) {
            linksDisplay.outerHTML = createInternalLinksDisplay(cardData);
        }
    }

    /**
     * Create card view form HTML (read-only)
     */
    function createCardViewForm(cardData) {
        const escapeHtml = window.KanbanModalCore.escapeHtml;
        const formatDate = window.KanbanModalCore.formatDate;

        const form = `
            <!-- Section: Informations principales -->
            <div class="kanban-modal-section">
                <h4 class="kanban-modal-section-title">📝 Informations</h4>
                
                <div class="view-group">
                    <label>Titre</label>
                    <div class="view-content view-title">${escapeHtml(cardData.title)}</div>
                </div>
                
                ${cardData.description ? `
                <div class="view-group">
                    <label>Description</label>
                    <div class="view-content">${escapeHtml(cardData.description)}</div>
                </div>
                ` : ''}
                
                <div class="view-group-row">
                    <div class="view-group view-group-half">
                        <label>Priorité</label>
                        <div class="view-content priority-${cardData.priority || 'normal'}">
                            ${getPriorityDisplay(cardData.priority)}
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

                <!-- Tags -->
                ${cardData.tags && cardData.tags.length > 0 ? `
                <div class="view-group">
                    <label>🏷️ Tags</label>
                    <div class="view-content">
                        <div class="kanban-tags-readonly">
                            ${cardData.tags.map(tag => `<span class="kanban-tag">${escapeHtml(tag)}</span>`).join('')}
                        </div>
                    </div>
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
     * Get priority display text
     */
    function getPriorityDisplay(priority) {
        switch (priority) {
            case 'low': return '🟢 Basse';
            case 'medium': return '🟡 Moyenne';
            case 'high': return '🔴 Haute';
            default: return '⚪ Normale';
        }
    }

    /**
     * Add internal link to card
     */
    function addInternalLinkToCard(modal, target, text) {
        const linksList = modal.querySelector('#internal-links-list-inline');
        const noLinksMessage = linksList.querySelector('.no-links-message');
        
        if (noLinksMessage) {
            noLinksMessage.remove();
        }
        
        // Check if link already exists
        const existingLinks = linksList.querySelectorAll('.internal-link-item');
        for (let item of existingLinks) {
            if (item.dataset.target === target) {
                // Link already exists, don't add duplicate
                return;
            }
        }
        
        const escapeHtml = window.KanbanModalCore.escapeHtml;
        const linkItem = document.createElement('div');
        linkItem.className = 'internal-link-item';
        linkItem.innerHTML = `
            <div class="link-info">
                <div class="link-target">🔗 ${escapeHtml(target)}</div>
                ${text && text !== target ? `<div class="link-text">${escapeHtml(text)}</div>` : ''}
            </div>
            <button type="button" class="remove-link-btn" title="Supprimer">×</button>`;
        
        linkItem.dataset.target = target;
        linkItem.dataset.text = text || '';
        
        // Bind remove button
        linkItem.querySelector('.remove-link-btn').addEventListener('click', () => {
            linkItem.remove();
            updateInternalLinksCount(modal);
            if (linksList.children.length === 0) {
                linksList.innerHTML = '<p class="no-links-message">Aucun lien interne ajouté</p>';
            }
        });
        
        linksList.appendChild(linkItem);
        updateInternalLinksCount(modal);
    }

    /**
     * Bind remove link buttons
     */
    function bindRemoveLinkButtons(modal) {
        const linksList = modal.querySelector('#internal-links-list-inline');
        if (linksList) {
            linksList.querySelectorAll('.remove-link-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    btn.closest('.internal-link-item').remove();
                    updateInternalLinksCount(modal);
                    if (linksList.children.length === 0) {
                        linksList.innerHTML = '<p class="no-links-message">Aucun lien interne ajouté</p>';
                    }
                });
            });
        }
    }

    /**
     * Update internal links count display
     */
    function updateInternalLinksCount(modal) {
        const countSpan = modal.querySelector('#internal-links-count');
        const linksList = modal.querySelector('#internal-links-list-inline');
        if (countSpan && linksList) {
            const count = linksList.querySelectorAll('.internal-link-item').length;
            countSpan.textContent = `${count} lien(s) interne(s)`;
        }
    }

    // Export functions to global scope
    window.KanbanModalCards = {
        showCardModal,
        showCardViewModal,
        createCardForm,
        createCardViewForm,
        updateInternalLinksDisplay,
        addInternalLinkToCard,
        bindRemoveLinkButtons,
        updateInternalLinksCount
    };

})();
