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
        // Performance: Créer et afficher le modal immédiatement avec un contenu minimal
        const modal = window.KanbanModalCore.createModal('kanban-card-modal', 'Éditer la carte');
        
        // Stocker le cardId dans le modal pour pouvoir nettoyer l'état du bouton
        modal.dataset.cardId = cardData.id;
        
        // Afficher le modal avec un loading temporaire
        modal.querySelector('.kanban-modal-body').innerHTML = `
            <div class="kanban-modal-loading">
                <div class="kanban-loading-spinner">
                    <div class="kanban-spinner"></div>
                    <span>Chargement du formulaire...</span>
                </div>
            </div>
        `;
        
        // Afficher immédiatement le modal
        modal.style.display = 'block';
        
        // Générer le contenu de façon asynchrone pour ne pas bloquer l'UI
        setTimeout(() => {
            try {
                // Créer le système d'onglets pour la modale d'édition
                const tabsContainer = createTabsContainer();
                const form = createCardForm(cardData);
                
                // Structure avec onglets - utiliser le générateur de tab discussion externe
                const discussionTab = window.KanbanModalDiscussions 
                    ? window.KanbanModalDiscussions.generateDiscussionTab(cardData.id)
                    : `<div id="discussion-section-${cardData.id}"><div class="discussions-loading">Module discussions non disponible</div></div>`;
                
                modal.querySelector('.kanban-modal-body').innerHTML = `
                    ${tabsContainer}
                    <div class="tab-content">
                        <div id="tab-info" class="tab-pane active">
                            ${form}
                        </div>
                        <div id="tab-discussion" class="tab-pane">
                            ${discussionTab}
                        </div>
                    </div>
                `;

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
                    
                    // Extract external links from form
                    const externalLinksList = modal.querySelector('#external-links-list-inline');
                    const externalLinks = [];
                    if (externalLinksList) {
                        externalLinksList.querySelectorAll('.external-link-item').forEach(item => {
                            externalLinks.push({
                                url: item.dataset.url,
                                text: item.dataset.text || ''
                            });
                        });
                    }
                    updatedData.externalLinks = externalLinks;
                    
                    // Keep existing media attachments
                    if (cardData.media) {
                        updatedData.media = cardData.media;
                    }
                    
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
                    // Nettoyer l'état du bouton d'édition
                    if (modal.dataset.cardId && window.KanbanPlugin?.hideEditingLoading) {
                        window.KanbanPlugin.hideEditingLoading(modal.dataset.cardId);
                    }
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

                // Bind add media button
                const addMediaBtn = modal.querySelector('#add-media');
                if (addMediaBtn && window.KanbanMediaManager) {
                    addMediaBtn.addEventListener('click', () => {
                        window.KanbanMediaManager.showMediaBrowser((selectedMedia) => {
                            if (selectedMedia) {
                                addMediaToCard(modal, cardData, selectedMedia);
                            }
                        });
                    });
                }

                // Bind add external link button
                const addExternalLinkBtn = modal.querySelector('#add-external-link');
                if (addExternalLinkBtn) {
                    addExternalLinkBtn.addEventListener('click', () => {
                        showExternalLinkModal((url, title) => {
                            if (url) {
                                addExternalLinkToCard(modal, url, title);
                            }
                        });
                    });
                }

                // Bind remove link buttons
                bindRemoveLinkButtons(modal);
                
                // Bind remove media buttons
                bindRemoveMediaButtons(modal, cardData);
                
                // Setup tabs functionality pour la modale d'édition
                setupTabsEvents(modal);
                
                // Charger les discussions de façon asynchrone en utilisant le module externe
                if (window.KanbanModalDiscussions) {
                    // Pour la modale d'édition, on utilise la page courante comme sourcePageId
                    const sourcePageId = window.JSINFO?.id || 'playground:kanban';
                    window.KanbanModalDiscussions.loadDiscussionsInTab(cardData, sourcePageId);
                }
                
                // Focus on title field
                const titleField = modal.querySelector('#card-title');
                if (titleField) {
                    titleField.focus();
                }
                
                // Supprimer l'overlay de chargement de la carte s'il existe
                const loadingOverlay = document.querySelector(`.kanban-card-loading-overlay[data-card-id="${cardData.id}"]`);
                if (loadingOverlay) {
                    loadingOverlay.remove();
                }
                
            } catch (error) {
                console.error('Erreur lors de la création du formulaire modal:', error);
                modal.querySelector('.kanban-modal-body').innerHTML = `
                    <div class="kanban-modal-error">
                        <p>❌ Erreur lors du chargement du formulaire</p>
                        <button onclick="window.KanbanModalCore.closeModal(this.closest('.kanban-modal-overlay'))" class="kanban-btn">Fermer</button>
                    </div>
                `;
            }
        }, 1); // Très court délai pour permettre l'affichage du modal

        return modal;
    }

    /**
     * Show card in read-only modal
     */
    function showCardViewModal(cardData, sourcePageId = null) {
        const modal = window.KanbanModalCore.createModal('kanban-card-view-modal', 'Consulter la carte');
        
        // Créer le système d'onglets
        const tabsContainer = createTabsContainer();
        const form = createCardViewForm(cardData);
        
        // Structure avec onglets - utiliser le générateur de tab discussion externe
        const discussionTab = window.KanbanModalDiscussions 
            ? window.KanbanModalDiscussions.generateDiscussionTab(cardData.id)
            : `<div id="discussion-section-${cardData.id}"><div class="discussions-loading">Module discussions non disponible</div></div>`;
        
        modal.querySelector('.kanban-modal-body').innerHTML = `
            ${tabsContainer}
            <div class="tab-content">
                <div id="tab-info" class="tab-pane active">
                    ${form}
                </div>
                <div id="tab-discussion" class="tab-pane">
                    ${discussionTab}
                </div>
            </div>
        `;

        // Add footer with edit option and export
        const footer = document.createElement('div');
        footer.className = 'kanban-modal-footer';
        footer.innerHTML = `
            <button type="button" class="kanban-btn kanban-btn-info kanban-export-card-json" 
                    onclick="window.KanbanCards.exportCardToJSON('${cardData.id}')" 
                    title="Exporter cette carte en JSON">
                📄 Export JSON
            </button>
            <button type="button" class="kanban-btn kanban-btn-secondary kanban-modal-close">Fermer</button>
        `;
        
        const innerModal = modal.querySelector('.kanban-modal');
        innerModal.appendChild(footer);

        // Bind close button
        footer.querySelector('.kanban-modal-close').addEventListener('click', () => {
            window.KanbanModalCore.closeModal(modal);
        });

        // Setup tabs functionality
        setupTabsEvents(modal);

        // Charger les discussions de façon asynchrone en utilisant le module externe
        if (window.KanbanModalDiscussions) {
            window.KanbanModalDiscussions.loadDiscussionsInTab(cardData, sourcePageId);
        }

        // Supprimer l'overlay de chargement de la carte s'il existe
        const loadingOverlay = document.querySelector(`.kanban-card-loading-overlay[data-card-id="${cardData.id}"]`);
        if (loadingOverlay) {
            loadingOverlay.remove();
        }

        modal.style.display = 'block';
        return modal;
    }

    /**
     * Crée le container des onglets
     */
    function createTabsContainer() {
        return `
            <div class="kanban-modal-tabs">
                <button class="tab-button active" data-tab="tab-info">
                    📋 Informations
                </button>
                <button class="tab-button" data-tab="tab-discussion">
                    💬 Discussion
                    <span class="discussion-count-badge" style="display: none;">0</span>
                </button>
            </div>
        `;
    }

    /**
     * Configure les événements des onglets
     */
    function setupTabsEvents(modal) {
        const tabButtons = modal.querySelectorAll('.tab-button');
        const tabPanes = modal.querySelectorAll('.tab-pane');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                
                // Désactiver tous les onglets
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabPanes.forEach(pane => pane.classList.remove('active'));
                
                // Activer l'onglet sélectionné
                button.classList.add('active');
                const targetPane = modal.querySelector(`#${targetTab}`);
                if (targetPane) {
                    targetPane.classList.add('active');
                    
                    // Si c'est l'onglet discussion, scroll vers le dernier message
                    if (targetTab === 'tab-discussion') {
                        if (window.KanbanModalDiscussions && window.KanbanModalDiscussions.setupDiscussionTabScroll) {
                            window.KanbanModalDiscussions.setupDiscussionTabScroll(targetPane);
                        } else {
                            // Fallback si le module n'est pas disponible
                            setTimeout(() => {
                                const discussionsContainer = targetPane.querySelector('.discussions-container');
                                if (discussionsContainer) {
                                    discussionsContainer.scrollTop = discussionsContainer.scrollHeight;
                                }
                            }, 100);
                        }
                    }
                }
            });
        });
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
                        <label>🌐 Liens externes</label>
                        <div class="external-links-section-inline">
                            <div class="section-header-inline">
                                <span id="external-links-count">${cardData.externalLinks ? cardData.externalLinks.length : 0} lien(s) externe(s)</span>
                                <button type="button" class="kanban-btn-small" id="add-external-link">+ Ajouter un lien</button>
                            </div>
                            <div id="external-links-list-inline" class="external-links-list">
                                ${createExternalLinksListHTML(cardData.externalLinks || [])}
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>📎 Médias attachés</label>
                        <div class="media-section-inline">
                            <div class="section-header-inline">
                                <span id="media-count">${cardData.media ? cardData.media.length : 0} média(s) attaché(s)</span>
                                <button type="button" class="kanban-btn-small" id="add-media">+ Ajouter un média</button>
                            </div>
                            <div id="media-list-inline" class="media-list">
                                ${createMediaListHTML(cardData.media || [])}
                            </div>
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
     * Create external links list HTML
     */
    function createExternalLinksListHTML(externalLinks) {
        if (!externalLinks || externalLinks.length === 0) {
            return '<p class="no-links-message">Aucun lien externe ajouté</p>';
        }

        const escapeHtml = window.KanbanModalCore.escapeHtml;
        return externalLinks.map(link => `
            <div class="external-link-item" data-url="${escapeHtml(link.url)}" data-text="${escapeHtml(link.text || '')}">
                <div class="link-info">
                    <div class="link-url">🌐 ${escapeHtml(link.url)}</div>
                    ${link.text ? `<div class="link-text">${escapeHtml(link.text)}</div>` : ''}
                </div>
                <button type="button" class="remove-external-link-btn" title="Supprimer">×</button>
            </div>
        `).join('');
    }

    /**
     * Create media list HTML
     */
    function createMediaListHTML(media) {
        if (!media || media.length === 0) {
            return '<p class="no-media-message">Aucun média attaché</p>';
        }

        const escapeHtml = window.KanbanModalCore.escapeHtml;
        return media.map(mediaItem => `
            <div class="media-item-inline" data-media-id="${mediaItem.id}" data-media-name="${mediaItem.name || ''}" data-media-type="${mediaItem.type || 'file'}">
                <div class="media-info-inline">
                    <div class="media-icon-inline">${getMediaIcon(mediaItem.type || 'file')}</div>
                    <div class="media-details-inline">
                        <a href="${escapeHtml(mediaItem.url || '#')}" target="_blank" class="media-link-inline" title="Ouvrir ${escapeHtml(mediaItem.name || mediaItem.id)}">
                            <div class="media-name-inline">📎 ${escapeHtml(mediaItem.name || mediaItem.id)}</div>
                            ${mediaItem.type ? `<div class="media-type-inline">${escapeHtml(mediaItem.type)}</div>` : ''}
                        </a>
                    </div>
                </div>
                <button type="button" class="remove-media-btn" title="Supprimer ce média" data-media-id="${mediaItem.id}">×</button>
            </div>
        `).join('');
    }

    /**
     * Get media icon by type
     */
    function getMediaIcon(type) {
        const icons = {
            image: '🖼️',
            video: '🎬',
            document: '📄',
            file: '📎'
        };
        return icons[type] || icons.file;
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

            <!-- Section: Organisation -->
            <div class="kanban-modal-section">
                <h4 class="kanban-modal-section-title">🎯 Organisation</h4>
                
                <div class="view-group-row">
                    <div class="view-group view-group-half">
                        <label>Priorité</label>
                        <div class="view-content priority-${cardData.priority || 'normal'}">
                            ${getPriorityDisplay(cardData.priority)}
                        </div>
                    </div>
                    
                    ${cardData.assignee ? `
                    <div class="view-group view-group-half">
                        <label>� Assigné à</label>
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
                
                <!-- Liens externes -->
                <div class="view-group">
                    <label>🌐 Liens externes</label>
                    <div class="view-content">
                        ${cardData.externalLinks && cardData.externalLinks.length > 0 ? 
                            cardData.externalLinks.map(link => 
                                `<div class="external-link-item">
                                    <a href="${escapeHtml(link.url)}" target="_blank" class="external-link-readonly" title="Ouvrir ${escapeHtml(link.text || link.url)}">
                                        🌐 ${escapeHtml(link.text || link.url)}
                                    </a>
                                    ${link.url !== (link.text || link.url) ? `<small class="link-target">(${escapeHtml(link.url)})</small>` : ''}
                                </div>`
                            ).join('') 
                            : '<em>Aucun lien externe</em>'
                        }
                    </div>
                </div>
                
                <!-- Médias attachés -->
                <div class="view-group">
                    <label>📎 Médias attachés</label>
                    <div class="view-content">
                        ${cardData.media && cardData.media.length > 0 ? 
                            cardData.media.map(media => {
                                const mediaName = escapeHtml(media.name || media.id);
                                const mediaUrl = media.url || `${DOKU_BASE}lib/exe/fetch.php?media=${encodeURIComponent(media.id)}`;
                                const mediaType = media.type || 'file';
                                const mediaIcon = getMediaIcon(mediaType);
                                
                                return `<div class="media-item-readonly">
                                    <a href="${escapeHtml(mediaUrl)}" target="_blank" class="media-link-readonly" title="Ouvrir ${mediaName}">
                                        ${mediaIcon} ${mediaName}
                                    </a>
                                    ${media.type ? `<small class="media-type">(${escapeHtml(media.type)})</small>` : ''}
                                </div>`;
                            }).join('') 
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
        // Handle internal links removal
        const internalLinksList = modal.querySelector('#internal-links-list-inline');
        if (internalLinksList) {
            internalLinksList.querySelectorAll('.remove-link-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    btn.closest('.internal-link-item').remove();
                    updateInternalLinksCount(modal);
                    if (internalLinksList.children.length === 0) {
                        internalLinksList.innerHTML = '<p class="no-links-message">Aucun lien interne ajouté</p>';
                    }
                });
            });
        }

        // Handle external links removal
        const externalLinksList = modal.querySelector('#external-links-list-inline');
        if (externalLinksList) {
            externalLinksList.querySelectorAll('.remove-external-link-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    btn.closest('.external-link-item').remove();
                    updateExternalLinksCount(modal);
                    if (externalLinksList.children.length === 0) {
                        externalLinksList.innerHTML = '<p class="no-links-message">Aucun lien externe ajouté</p>';
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

    /**
     * Show external link input modal
     */
    function showExternalLinkModal(callback) {
        const modal = window.KanbanModalCore.createModal('kanban-external-link-modal', 'Ajouter un lien externe');
        
        const form = `
            <form id="external-link-form">
                <div class="form-group">
                    <label for="external-url">URL *</label>
                    <input type="url" id="external-url" name="url" required 
                           placeholder="https://example.com" class="form-control">
                </div>
                <div class="form-group">
                    <label for="external-title">Titre (optionnel)</label>
                    <input type="text" id="external-title" name="title" 
                           placeholder="Titre du lien" class="form-control">
                </div>
            </form>
        `;
        
        modal.querySelector('.kanban-modal-body').innerHTML = form;

        // Add footer
        const footer = document.createElement('div');
        footer.className = 'kanban-modal-footer';
        footer.innerHTML = `
            <button type="submit" class="kanban-btn kanban-btn-primary" form="external-link-form">✅ Ajouter</button>
            <button type="button" class="kanban-btn kanban-btn-secondary kanban-modal-cancel">❌ Annuler</button>
        `;
        
        const innerModal = modal.querySelector('.kanban-modal');
        innerModal.appendChild(footer);

        // Bind form submission
        const formElement = modal.querySelector('#external-link-form');
        formElement.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(formElement);
            const url = formData.get('url');
            const title = formData.get('title');
            
            if (url) {
                callback(url, title);
                window.KanbanModalCore.closeModal(modal);
            }
        });

        // Bind cancel button
        modal.querySelector('.kanban-modal-cancel').addEventListener('click', () => {
            window.KanbanModalCore.closeModal(modal);
        });

        // Focus on URL input
        setTimeout(() => {
            const urlInput = modal.querySelector('#external-url');
            if (urlInput) urlInput.focus();
        }, 100);
    }

    /**
     * Add external link to card
     */
    function addExternalLinkToCard(modal, url, title) {
        const linksList = modal.querySelector('#external-links-list-inline');
        const noLinksMessage = linksList.querySelector('.no-links-message');
        
        if (noLinksMessage) {
            noLinksMessage.remove();
        }
        
        // Check if link already exists
        const existingLinks = linksList.querySelectorAll('.external-link-item');
        for (let item of existingLinks) {
            if (item.dataset.url === url) {
                // Link already exists, don't add duplicate
                return;
            }
        }
        
        const escapeHtml = window.KanbanModalCore.escapeHtml;
        const linkItem = document.createElement('div');
        linkItem.className = 'external-link-item';
        linkItem.innerHTML = `
            <div class="link-info">
                <div class="link-url">🌐 ${escapeHtml(url)}</div>
                ${title ? `<div class="link-text">${escapeHtml(title)}</div>` : ''}
            </div>
            <button type="button" class="remove-external-link-btn" title="Supprimer">×</button>`;
        
        linkItem.dataset.url = url;
        linkItem.dataset.title = title || '';
        
        // Bind remove button
        linkItem.querySelector('.remove-external-link-btn').addEventListener('click', () => {
            linkItem.remove();
            updateExternalLinksCount(modal);
            if (linksList.children.length === 0) {
                linksList.innerHTML = '<p class="no-links-message">Aucun lien externe ajouté</p>';
            }
        });
        
        linksList.appendChild(linkItem);
        updateExternalLinksCount(modal);
    }

    /**
     * Update external links count display
     */
    function updateExternalLinksCount(modal) {
        const countSpan = modal.querySelector('#external-links-count');
        const linksList = modal.querySelector('#external-links-list-inline');
        if (countSpan && linksList) {
            const count = linksList.querySelectorAll('.external-link-item').length;
            countSpan.textContent = `${count} lien(s) externe(s)`;
        }
    }

    /**
     * Show media browser modal (inspired by QuillJS)
     */
    function showMediaBrowserModal(cardData, parentModal) {
        // Temporarily hide parent modal
        parentModal.style.display = 'none';
        
        // Create media browser modal
        const mediaModal = createMediaBrowserModal();
        document.body.appendChild(mediaModal);
        
        // Load initial media list
        loadMediaList('', mediaModal);
        
        // Setup event handlers
        setupMediaModalHandlers(mediaModal, cardData, parentModal);
    }

    /**
     * Create media browser modal HTML
     */
    function createMediaBrowserModal() {
        const modal = document.createElement('div');
        modal.className = 'kanban-modal kanban-media-browser-modal';
        modal.id = 'kanban-media-browser';
        
        modal.innerHTML = `
            <div class="kanban-modal-overlay"></div>
            <div class="kanban-modal-content">
                <div class="kanban-modal-header">
                    <h3>📎 Sélectionner un média</h3>
                    <button class="kanban-modal-close">×</button>
                </div>
                <div class="kanban-modal-body">
                    <!-- Breadcrumb navigation -->
                    <div class="media-breadcrumb" id="media-breadcrumb"></div>
                    
                    <!-- Media content -->
                    <div class="media-browser-content">
                        <div class="media-folders" id="media-folders">
                            <h4>📁 Dossiers</h4>
                            <div class="media-folders-list" id="media-folders-list">
                                <div class="loading-message">Chargement...</div>
                            </div>
                        </div>
                        <div class="media-files" id="media-files">
                            <h4>📎 Fichiers</h4>
                            <div class="media-files-list" id="media-files-list">
                                <div class="loading-message">Chargement...</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="kanban-modal-footer">
                    <button type="button" class="kanban-btn-secondary" id="cancel-media-selection">Annuler</button>
                </div>
            </div>
        `;
        
        return modal;
    }

    /**
     * Setup media modal event handlers
     */
    function setupMediaModalHandlers(mediaModal, cardData, parentModal) {
        // Close modal handlers
        const closeModal = () => {
            mediaModal.remove();
            parentModal.style.display = 'block';
        };
        
        mediaModal.querySelector('.kanban-modal-close').onclick = closeModal;
        mediaModal.querySelector('#cancel-media-selection').onclick = closeModal;
        mediaModal.querySelector('.kanban-modal-overlay').onclick = closeModal;
        
        // Media selection handler will be setup when rendering files
    }

    /**
     * Load media list using DokuWiki endpoints
     */
    function loadMediaList(namespace, mediaModal) {
        updateBreadcrumb(namespace, mediaModal);
        loadFolders(namespace, mediaModal);
        loadFiles(namespace, mediaModal);
    }

    /**
     * Load folders using DokuWiki media manager
     */
    function loadFolders(namespace, mediaModal) {
        const foldersList = mediaModal.querySelector('#media-folders-list');
        foldersList.innerHTML = '<div class="loading-message">Chargement des dossiers...</div>';
        
        // Use DokuWiki standard media manager AJAX
        const formData = new FormData();
        formData.append('call', 'media');
        formData.append('do', 'list');
        formData.append('ns', namespace || '');
        
        fetch(DOKU_BASE + 'lib/exe/ajax.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.text())
        .then(html => {
            processFoldersResponse(html, foldersList, namespace, mediaModal);
        })
        .catch(error => {
            console.error('Error loading folders:', error);
            foldersList.innerHTML = '<div class="error-message">Erreur de chargement</div>';
        });
    }

    /**
     * Load files using DokuWiki media manager
     */
    function loadFiles(namespace, mediaModal) {
        const filesList = mediaModal.querySelector('#media-files-list');
        filesList.innerHTML = '<div class="loading-message">Chargement des fichiers...</div>';
        
        // Use QuillJS media-list endpoint if available, fallback to standard DokuWiki
        const useQuillJSEndpoint = window.location.pathname.includes('quilljs') || true; // Try QuillJS first
        
        if (useQuillJSEndpoint) {
            const url = DOKU_BASE + 'lib/plugins/quilljs/ajax/media-list.php?call=media&do=list&ns=' + encodeURIComponent(namespace || '');
            
            fetch(url, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                renderMediaFiles(data, filesList, mediaModal);
            })
            .catch(error => {
                console.error('QuillJS endpoint failed, using fallback:', error);
                loadFilesStandard(namespace, mediaModal);
            });
        } else {
            loadFilesStandard(namespace, mediaModal);
        }
    }

    /**
     * Load files using standard DokuWiki approach (fallback)
     */
    function loadFilesStandard(namespace, mediaModal) {
        const filesList = mediaModal.querySelector('#media-files-list');
        
        const formData = new FormData();
        formData.append('call', 'media');
        formData.append('do', 'list');
        formData.append('ns', namespace || '');
        
        fetch(DOKU_BASE + 'lib/exe/ajax.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.text())
        .then(html => {
            processFilesResponse(html, filesList, mediaModal);
        })
        .catch(error => {
            console.error('Error loading files:', error);
            filesList.innerHTML = '<div class="error-message">Erreur de chargement</div>';
        });
    }

    /**
     * Process folders response from DokuWiki
     */
    function processFoldersResponse(html, container, currentNamespace, mediaModal) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const folders = [];
        const folderElements = tempDiv.querySelectorAll('a[href*="ns="], .folder');
        
        folderElements.forEach(element => {
            const href = element.getAttribute('href') || '';
            const text = element.textContent || element.innerText || '';
            
            const nsMatch = href.match(/ns=([^&]*)/);
            if (nsMatch) {
                const folderNs = decodeURIComponent(nsMatch[1]);
                if (folderNs !== currentNamespace) { // Avoid current folder
                    folders.push({
                        namespace: folderNs,
                        name: text.trim(),
                        displayName: folderNs.split(':').pop() || text.trim()
                    });
                }
            }
        });
        
        renderFolders(folders, container, mediaModal);
    }

    /**
     * Process files response from DokuWiki standard AJAX
     */
    function processFilesResponse(html, container, mediaModal) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const files = [];
        const fileElements = tempDiv.querySelectorAll('a[href*="media="], .media');
        
        fileElements.forEach(element => {
            const href = element.getAttribute('href') || '';
            const text = element.textContent || element.innerText || '';
            
            const mediaMatch = href.match(/media=([^&]*)/);
            if (mediaMatch) {
                const mediaId = decodeURIComponent(mediaMatch[1]);
                const fileName = mediaId.split(':').pop() || mediaId;
                
                files.push({
                    id: mediaId,
                    name: fileName,
                    type: getMediaTypeFromExtension(mediaId),
                    namespace: mediaId.substring(0, mediaId.lastIndexOf(':')) || ''
                });
            }
        });
        
        renderMediaFiles(files, container, mediaModal);
    }

    /**
     * Render folders list
     */
    function renderFolders(folders, container, mediaModal) {
        if (folders.length === 0) {
            container.innerHTML = '<div class="no-content-message">Aucun sous-dossier</div>';
            return;
        }
        
        let html = '';
        folders.forEach(folder => {
            html += `
                <div class="folder-item" data-namespace="${folder.namespace}">
                    <span class="folder-icon">📁</span>
                    <span class="folder-name">${escapeHtml(folder.displayName)}</span>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Add click handlers
        container.querySelectorAll('.folder-item').forEach(item => {
            item.onclick = () => {
                const namespace = item.dataset.namespace;
                loadMediaList(namespace, mediaModal);
            };
        });
    }

    /**
     * Render media files (works with both QuillJS and standard format)
     */
    function renderMediaFiles(files, container, mediaModal) {
        // Handle different response formats
        let fileList = files;
        if (files.success !== undefined) {
            // QuillJS format
            fileList = files.files || [];
        } else if (Array.isArray(files)) {
            // Standard array format
            fileList = files;
        } else {
            fileList = [];
        }
        
        if (fileList.length === 0) {
            container.innerHTML = '<div class="no-content-message">Aucun fichier</div>';
            return;
        }
        
        let html = '';
        fileList.forEach(file => {
            const fileIcon = getMediaIcon(file.type);
            html += `
                <div class="media-file-item" data-media-id="${file.id}" data-media-name="${file.name}" data-media-type="${file.type}">
                    <div class="file-icon">${fileIcon}</div>
                    <div class="file-info">
                        <div class="file-name">${escapeHtml(file.name)}</div>
                        <div class="file-type">${file.type || 'file'}</div>
                    </div>
                    <button type="button" class="btn-select-media">Sélectionner</button>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Add selection handlers
        container.querySelectorAll('.btn-select-media').forEach(btn => {
            btn.onclick = () => {
                const fileItem = btn.closest('.media-file-item');
                const mediaData = {
                    id: fileItem.dataset.mediaId,
                    name: fileItem.dataset.mediaName,
                    type: fileItem.dataset.mediaType
                };
                
                handleMediaSelection(mediaData, mediaModal);
            };
        });
    }

    /**
     * Handle media selection
     */
    function handleMediaSelection(mediaData, mediaModal) {
        // Get parent modal and card data from the calling context
        const parentModal = document.querySelector('.kanban-modal[style*="display: none"]');
        const cardData = window.currentEditingCardData; // We'll need to set this
        
        if (parentModal && cardData) {
            addMediaToCard(parentModal, cardData, mediaData);
        }
        
        // Close media browser modal
        mediaModal.remove();
        if (parentModal) {
            parentModal.style.display = 'block';
        }
    }

    /**
     * Update breadcrumb navigation
     */
    function updateBreadcrumb(namespace, mediaModal) {
        const breadcrumb = mediaModal.querySelector('#media-breadcrumb');
        if (!breadcrumb) return;
        
        const parts = namespace ? namespace.split(':') : [];
        let html = '<span class="breadcrumb-item" data-namespace="">🏠 Racine</span>';
        
        let currentPath = '';
        parts.forEach((part, index) => {
            currentPath = index === 0 ? part : currentPath + ':' + part;
            html += ` <span class="breadcrumb-separator">›</span> `;
            html += `<span class="breadcrumb-item" data-namespace="${currentPath}">${escapeHtml(part)}</span>`;
        });
        
        breadcrumb.innerHTML = html;
        
        // Add click handlers
        breadcrumb.querySelectorAll('.breadcrumb-item').forEach(item => {
            item.onclick = () => {
                const ns = item.dataset.namespace;
                loadMediaList(ns, mediaModal);
            };
        });
    }

    /**
     * Simple HTML escape function
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Get media type from file extension
     */
    function getMediaTypeFromExtension(mediaId) {
        const ext = mediaId.split('.').pop()?.toLowerCase() || '';
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        const videoExts = ['mp4', 'webm', 'ogg', 'avi', 'mov'];
        const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
        
        if (imageExts.includes(ext)) return 'image';
        if (videoExts.includes(ext)) return 'video';  
        if (docExts.includes(ext)) return 'document';
        return 'file';
    }

    /**
     * Add media to card
     */
    function addMediaToCard(modal, cardData, mediaItem) {
        // Initialize media array if it doesn't exist
        if (!cardData.media) {
            cardData.media = [];
        }
        
        // Check if media already exists
        const existingMedia = cardData.media.find(media => media.id === mediaItem.id);
        if (existingMedia) {
            alert('Ce média est déjà attaché à cette carte.');
            return;
        }
        
        // Add media to card data
        cardData.media.push(mediaItem);
        
        // Update the display
        updateMediaDisplay(modal, cardData);
    }

    /**
     * Update media display in modal
     */
    function updateMediaDisplay(modal, cardData) {
        const mediaList = modal.querySelector('#media-list-inline');
        const mediaCount = modal.querySelector('#media-count');
        
        if (mediaList) {
            mediaList.innerHTML = createMediaListHTML(cardData.media || []);
            // Re-bind remove buttons after updating display
            bindRemoveMediaButtons(modal, cardData);
        }
        
        if (mediaCount) {
            const count = cardData.media ? cardData.media.length : 0;
            mediaCount.textContent = `${count} média(s) attaché(s)`;
        }
    }

    /**
     * Bind remove media buttons
     */
    function bindRemoveMediaButtons(modal, cardData) {
        const removeButtons = modal.querySelectorAll('.remove-media-btn');
        removeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const mediaItem = button.closest('.media-item-inline');
                const mediaId = button.dataset.mediaId || mediaItem.dataset.mediaId;
                
                if (!mediaId) {
                    console.error('Media ID not found for removal');
                    return;
                }
                
                // Confirm removal
                if (confirm('Êtes-vous sûr de vouloir supprimer ce média de la carte ?')) {
                    // Remove from card data
                    if (cardData.media) {
                        cardData.media = cardData.media.filter(media => media.id !== mediaId);
                    }
                    
                    // Update display
                    updateMediaDisplay(modal, cardData);
                }
            });
        });
    }

    /**
     * Export a single card to JSON format
     */
    async function exportCardToJSON(cardId) {
        // Find the card data in the global kanban boards
        let cardData = null;
        let boardId = null;
        
        // Search through all boards to find the card
        for (const [bid, boardData] of Object.entries(window.kanbanBoards || {})) {
            if (boardData.columns) {
                for (const column of boardData.columns) {
                    if (column.cards) {
                        const foundCard = column.cards.find(card => card.id === cardId);
                        if (foundCard) {
                            cardData = foundCard;
                            boardId = bid;
                            break;
                        }
                    }
                }
            }
            if (cardData) break;
        }
        
        if (!cardData) {
            if (window.showNotification) {
                window.showNotification('Carte non trouvée pour l\'export', 'error');
            }
            return;
        }
        
        // Load discussions for this card
        let discussions = [];
        try {
            if (window.KanbanDiscussions && window.KanbanDiscussions.loadCardDiscussions) {
                const pageId = window.JSINFO?.id || '';
                discussions = await window.KanbanDiscussions.loadCardDiscussions(pageId, cardId);
                // Ensure discussions is an array
                if (!Array.isArray(discussions)) {
                    discussions = [];
                }
            }
        } catch (error) {
            console.warn('Failed to load discussions for export:', error);
            discussions = [];
        }
        
        // Create export data structure
        const exportData = {
            metadata: {
                card_id: cardData.id,
                page_id: window.JSINFO?.id || '',
                export_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
                export_format_version: '1.0',
                source_board_id: boardId
            },
            card: {
                id: cardData.id,
                title: cardData.title || '',
                description: cardData.description || cardData.content || '',
                priority: cardData.priority || 'normal',
                assignee: cardData.assignee || '',
                dueDate: cardData.dueDate || cardData.due_date || '',
                tags: cardData.tags || [],
                created: cardData.created || cardData.created_date || '',
                creator: cardData.creator || cardData.createdBy || '',
                lastModified: cardData.lastModified || cardData.modified_date || '',
                lastModifiedBy: cardData.lastModifiedBy || cardData.last_modified_by || '',
                internalLinks: cardData.internalLinks || [],
                externalLinks: cardData.externalLinks || [],
                media: cardData.media || [],
                discussions: discussions,
                discussion_count: discussions.length
            }
        };
        
        // Convert to JSON string
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // Create download link
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const filename = `card_${cardData.id}_${new Date().toISOString().slice(0, 10)}.json`;
        
        // Create temporary download link
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up the URL object
        URL.revokeObjectURL(url);
        
        if (window.showNotification) {
            window.showNotification(`Carte exportée: ${filename}`, 'success');
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
        updateInternalLinksCount,
        showExternalLinkModal,
        addExternalLinkToCard,
        updateExternalLinksCount,
        showMediaBrowserModal,
        addMediaToCard,
        updateMediaDisplay,
        bindRemoveMediaButtons,
        exportCardToJSON
    };
    
    // Export also to KanbanCards for easier access
    window.KanbanCards = window.KanbanCards || {};
    window.KanbanCards.exportCardToJSON = exportCardToJSON;

})();
