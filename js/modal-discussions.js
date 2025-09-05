/**
 * Kanban Plugin JavaScript - Modal Discussions Module
 * Shared discussion tab functionality for card modals
 * @version 2.1.0
 */

(function() {
    'use strict';

    /**
     * Génère le HTML de l'onglet discussion
     * @param {string} cardId - ID de la carte
     * @returns {string} - HTML de l'onglet discussion
     */
    function generateDiscussionTab(cardId) {
        return `
            <div id="discussion-section-${cardId}">
                <div class="discussions-loading">Chargement des discussions...</div>
            </div>
        `;
    }

    /**
     * Charge et affiche les discussions d'une carte dans l'onglet
     * @param {Object} cardData - Données de la carte
     * @param {string|null} sourcePageId - ID de la page source (optionnel)
     */
    async function loadDiscussionsInTab(cardData, sourcePageId = null) {
        try {
            // Utiliser le sourcePageId si fourni, sinon fallback sur la page courante
            const pageId = sourcePageId || window.JSINFO?.id || 'playground:kanban';
            const discussionSection = document.getElementById(`discussion-section-${cardData.id}`);
            
            if (!discussionSection) {
                return; // Section non trouvée
            }

            // Afficher un loading
            discussionSection.innerHTML = `
                <div class="kanban-modal-section kanban-discussions-section">
                    <h4 class="kanban-modal-section-title">💬 Discussion</h4>
                    <div class="discussions-loading">Chargement des discussions...</div>
                </div>
            `;

            // Charger les discussions si le module est disponible
            if (window.KanbanDiscussions) {
                const discussions = await window.KanbanDiscussions.loadCardDiscussions(pageId, cardData.id);
                const discussionHtml = window.KanbanDiscussions.generateDiscussionSection(pageId, cardData.id, discussions);
                discussionSection.innerHTML = discussionHtml;
                
                // Mettre à jour le badge de compteur dans l'onglet
                updateDiscussionBadge(discussions.length);
                
                // Ajouter l'event listener pour le bouton publier
                setupDiscussionEvents(pageId, cardData.id);
            } else {
                // Module discussions non chargé
                discussionSection.innerHTML = `
                    <div class="kanban-modal-section kanban-discussions-section">
                        <h4 class="kanban-modal-section-title">💬 Discussion</h4>
                        <div class="discussions-error">Module discussions non disponible</div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Erreur chargement discussions:', error);
            const discussionSection = document.getElementById(`discussion-section-${cardData.id}`);
            if (discussionSection) {
                discussionSection.innerHTML = `
                    <div class="kanban-modal-section kanban-discussions-section">
                        <h4 class="kanban-modal-section-title">💬 Discussion</h4>
                        <div class="discussions-error">Erreur lors du chargement des discussions</div>
                    </div>
                `;
            }
        }
    }

    /**
     * Met à jour le badge de compteur de discussion dans l'onglet
     * @param {number} count - Nombre de discussions
     */
    function updateDiscussionBadge(count) {
        const badge = document.querySelector('.discussion-count-badge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'inline';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    /**
     * Configure les événements de la section discussion
     * @param {string} pageId - ID de la page
     * @param {string} cardId - ID de la carte
     */
    function setupDiscussionEvents(pageId, cardId) {
        const submitBtn = document.querySelector(`.discussion-submit[data-card-id="${cardId}"]`);
        const textarea = document.getElementById(`new-discussion-${cardId}`);
        
        if (submitBtn && textarea) {
            // Auto-resize du textarea
            function autoResize() {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            }
            
            // Raccourcis clavier
            function handleKeydown(e) {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    publishMessage();
                }
            }
            
            // Fonction de publication
            async function publishMessage() {
                const message = textarea.value.trim();
                if (!message) {
                    alert('Veuillez saisir un message');
                    return;
                }

                // Feedback visuel amélioré
                const btnText = submitBtn.querySelector('.btn-text');
                const btnLoader = submitBtn.querySelector('.btn-loader');
                
                submitBtn.disabled = true;
                if (btnText && btnLoader) {
                    btnText.style.display = 'none';
                    btnLoader.style.display = 'inline';
                } else {
                    // Fallback si pas de structure btn-text/btn-loader
                    submitBtn.textContent = 'Publication...';
                }

                try {
                    const user = window.JSINFO?.kanban_user || window.JSINFO?.kanban_user_name || window.JSINFO?.userinfo?.name || window.JSINFO?.client || 'Anonyme';
                    const success = await window.KanbanDiscussions.addDiscussionMessage(pageId, cardId, message, user);
                    
                    if (success) {
                        // Rechargement des discussions
                        const discussions = await window.KanbanDiscussions.loadCardDiscussions(pageId, cardId);
                        const discussionSection = document.getElementById(`discussion-section-${cardId}`);
                        const discussionHtml = window.KanbanDiscussions.generateDiscussionSection(pageId, cardId, discussions);
                        discussionSection.innerHTML = discussionHtml;
                        
                        // Mettre à jour le badge
                        updateDiscussionBadge(discussions.length);
                        
                        // Mettre à jour l'indicateur sur la carte dans le tableau principal
                        if (window.KanbanDiscussions && window.KanbanDiscussions.updateCardDiscussionIndicator) {
                            window.KanbanDiscussions.updateCardDiscussionIndicator(cardId, discussions.length);
                        }
                        
                        // Notifier les vues kanbanview de la mise à jour
                        if (window.notifyKanbanViewDiscussionUpdate) {
                            window.notifyKanbanViewDiscussionUpdate(pageId, cardId);
                        }
                        
                        // Remettre en place les événements (récursif)
                        setupDiscussionEvents(pageId, cardId);
                        
                        // Scroll automatique vers le bas
                        setTimeout(() => {
                            const discussionsContainer = document.getElementById(`discussions-${cardId}`);
                            if (discussionsContainer) {
                                discussionsContainer.scrollTop = discussionsContainer.scrollHeight;
                            }
                        }, 100);
                        
                    } else {
                        alert('Erreur lors de la publication du message');
                    }
                } catch (error) {
                    console.error('Erreur publication message:', error);
                    alert('Erreur lors de la publication du message');
                } finally {
                    // Réactiver le bouton
                    submitBtn.disabled = false;
                    if (btnText && btnLoader) {
                        btnText.style.display = 'inline';
                        btnLoader.style.display = 'none';
                    } else {
                        submitBtn.textContent = 'Publier';
                    }
                }
            }
            
            // Event listeners
            textarea.addEventListener('input', autoResize);
            textarea.addEventListener('keydown', handleKeydown);
            submitBtn.addEventListener('click', publishMessage);
            
            // Auto-resize initial
            autoResize();
            
            // Focus et scroll initial vers le bas
            setTimeout(() => {
                const discussionsContainer = document.getElementById(`discussions-${cardId}`);
                if (discussionsContainer) {
                    discussionsContainer.scrollTop = discussionsContainer.scrollHeight;
                }
            }, 100);
        }
    }

    /**
     * Configure le scroll automatique vers le dernier message lors du clic sur l'onglet discussion
     * @param {HTMLElement} modal - Élément modal
     */
    function setupDiscussionTabScroll(modal) {
        const discussionTabButton = modal.querySelector('[data-tab="tab-discussion"]');
        if (discussionTabButton) {
            discussionTabButton.addEventListener('click', () => {
                setTimeout(() => {
                    const discussionsContainer = modal.querySelector('.discussions-container');
                    if (discussionsContainer) {
                        discussionsContainer.scrollTop = discussionsContainer.scrollHeight;
                    }
                }, 100); // Petit délai pour s'assurer que le contenu est visible
            });
        }
    }

    // Export des fonctions publiques
    window.KanbanModalDiscussions = {
        generateDiscussionTab,
        loadDiscussionsInTab,
        updateDiscussionBadge,
        setupDiscussionEvents,
        setupDiscussionTabScroll
    };

})();
