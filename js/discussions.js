/**
 * Kanban Card Discussions Management
 * Gère les            const response = await fetch(DOKU_BASE + 'doku.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    call: 'kanban',
                    action: 'get_discussions',
                    id: discussionPageId,
                    sectok: window.sectok || ''
                })
            });

            if (!response.ok) {
                throw new Error('Erreur lors du chargement des discussions');
            }

            const responseText = await response.text();
            
            try {
                const data = JSON.parse(responseText);
                return data.discussions || [];
            } catch (e) {
                throw new Error('Réponse serveur invalide');
            }ées aux cartes via les pages discussion DokuWiki
 */

(function() {
    'use strict';

    // Configuration
    const DISCUSSION_PREFIX = 'discussion:';
    const CARD_DISCUSSION_SUFFIX = ':card_';

    /**
     * Génère le nom de la page de discussion pour une carte
     * @param {string} pageId - ID de la page (ex: "playground:kanban")
     * @param {string} cardId - ID de la carte
     * @returns {string} - Nom de la page discussion (ex: "discussion:playground:kanban:card_1756473369236")
     */
    function getCardDiscussionPageId(pageId, cardId) {
        return DISCUSSION_PREFIX + pageId + CARD_DISCUSSION_SUFFIX + cardId;
    }

    /**
     * Structure d'un message de discussion
     */
    function createDiscussionMessage(user, message, timestamp = null) {
        return {
            id: generateMessageId(),
            user: user,
            message: message,
            timestamp: timestamp || new Date().toISOString(),
            edited: null
        };
    }

    /**
     * Génère un ID unique pour un message
     */
    function generateMessageId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Charge les discussions d'une carte depuis DokuWiki
     * @param {string} pageId - ID de la page kanban
     * @param {string} cardId - ID de la carte
     * @returns {Promise<Array>} - Liste des messages de discussion
     */
    async function loadCardDiscussions(pageId, cardId) {
        try {
            const discussionPageId = getCardDiscussionPageId(pageId, cardId);
            
            // Appel AJAX vers DokuWiki pour récupérer le contenu de la page
            const response = await fetch(DOKU_BASE + 'lib/exe/ajax.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    call: 'kanban',
                    action: 'get_discussions',
                    id: discussionPageId,
                    sectok: window.sectok || ''
                })
            });

            if (!response.ok) {
                console.error('Response not OK:', response.status, response.statusText);
                const responseText = await response.text();
                console.error('Response text:', responseText);
                throw new Error('Erreur lors du chargement des discussions');
            }

            const responseText = await response.text();            
            const data = JSON.parse(responseText);
            return data.discussions || [];
            
        } catch (error) {
            console.error('Erreur chargement discussions:', error);
            return [];
        }
    }

    /**
     * Sauvegarde les discussions d'une carte dans DokuWiki
     * @param {string} pageId - ID de la page kanban
     * @param {string} cardId - ID de la carte
     * @param {Array} discussions - Liste des messages
     * @returns {Promise<boolean>} - Succès de la sauvegarde
     */
    async function saveCardDiscussions(pageId, cardId, discussions) {
        try {
            const discussionPageId = getCardDiscussionPageId(pageId, cardId);
            
            // Préparation des données JSON
            const discussionData = {
                cardId: cardId,
                pageId: pageId,
                lastUpdate: new Date().toISOString(),
                messages: discussions
            };

            // Appel AJAX vers DokuWiki pour sauvegarder
            const response = await fetch(DOKU_BASE + 'lib/exe/ajax.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    call: 'kanban',
                    action: 'save_discussions',
                    id: discussionPageId,
                    data: JSON.stringify(discussionData),
                    sectok: window.sectok || ''
                })
            });

            if (!response.ok) {
                console.error('Save response not OK:', response.status, response.statusText);
                const responseText = await response.text();
                console.error('Save response text:', responseText);
                throw new Error('Erreur lors de la sauvegarde');
            }

            const responseText = await response.text();
            
            try {
                const result = JSON.parse(responseText);
                return result.success === true;
            } catch (e) {
                console.error('JSON parse error:', e, 'Response:', responseText);
                return false;
            }
            
        } catch (error) {
            console.error('Erreur sauvegarde discussions:', error);
            return false;
        }
    }

    /**
     * Ajoute un nouveau message à la discussion d'une carte
     * @param {string} pageId - ID de la page kanban
     * @param {string} cardId - ID de la carte
     * @param {string} message - Contenu du message
     * @param {string} user - Nom de l'utilisateur
     * @returns {Promise<boolean>} - Succès de l'ajout
     */
    async function addDiscussionMessage(pageId, cardId, message, user) {
        try {
            // Charge les discussions existantes
            const discussions = await loadCardDiscussions(pageId, cardId);
            
            // Crée le nouveau message
            const newMessage = createDiscussionMessage(user, message);
            discussions.push(newMessage);
            
            // Sauvegarde
            return await saveCardDiscussions(pageId, cardId, discussions);
            
        } catch (error) {
            console.error('Erreur ajout message:', error);
            return false;
        }
    }

    /**
     * Formate un message pour l'affichage
     * @param {Object} message - Objet message
     * @returns {string} - HTML du message formaté
     */
    function formatDiscussionMessage(message) {
        const timestamp = new Date(message.timestamp);
        const formattedDate = timestamp.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const escapeHtml = window.KanbanModalCore?.escapeHtml || function(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };

        return `
            <div class="discussion-message" data-message-id="${message.id}">
                <div class="discussion-message-header">
                    <span class="discussion-user">👤 ${escapeHtml(message.user)}</span>
                    <span class="discussion-timestamp">${formattedDate}</span>
                    ${message.edited ? '<span class="discussion-edited">(modifié)</span>' : ''}
                </div>
                <div class="discussion-message-content">
                    ${escapeHtml(message.message).replace(/\n/g, '<br>')}
                </div>
            </div>
        `;
    }

    /**
     * Génère le HTML de la section discussion pour une carte
     * @param {string} pageId - ID de la page kanban
     * @param {string} cardId - ID de la carte
     * @param {Array} discussions - Liste des messages
     * @returns {string} - HTML de la section discussion
     */
    function generateDiscussionSection(pageId, cardId, discussions = []) {
        const messagesHtml = discussions.map(formatDiscussionMessage).join('');
        
        return `
            <div class="kanban-modal-section kanban-discussions-section">
                <h4 class="kanban-modal-section-title">💬 Discussion</h4>
                
                <div class="discussions-container" id="discussions-${cardId}">
                    ${messagesHtml || '<div class="no-discussions">Aucune discussion pour cette carte.</div>'}
                </div>
                
                <div class="discussion-form">
                    <textarea 
                        id="new-discussion-${cardId}" 
                        placeholder="Ajouter un commentaire..."
                        rows="3"
                        class="discussion-input"
                    ></textarea>
                    <div class="discussion-form-actions">
                        <button 
                            type="button" 
                            class="btn btn-primary discussion-submit"
                            data-page-id="${pageId}"
                            data-card-id="${cardId}"
                        >
                            Publier
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Compte le nombre de messages de discussion pour une carte
     * @param {string} pageId - ID de la page kanban
     * @param {string} cardId - ID de la carte
     * @returns {Promise<number>} - Nombre de messages
     */
    async function getDiscussionCount(pageId, cardId) {
        try {
            const discussions = await loadCardDiscussions(pageId, cardId);
            return discussions.length;
        } catch (error) {
            console.error('Erreur comptage discussions:', error);
            return 0;
        }
    }

    /**
     * Met à jour l'indicateur de discussion sur une carte
     * @param {string} cardId - ID de la carte
     * @param {number} count - Nombre de messages
     */
    function updateCardDiscussionIndicator(cardId, count) {
        // Utiliser l'ID directement, pas data-card-id
        const cardElement = document.getElementById(cardId);
        
        if (!cardElement) return;

        // Supprimer l'ancien indicateur s'il existe
        const oldIndicator = cardElement.querySelector('.discussion-indicator');
        if (oldIndicator) {
            oldIndicator.remove();
        }

        // Ajouter le nouvel indicateur si count > 0
        if (count > 0) {
            const indicator = document.createElement('span');
            indicator.className = 'kanban-content-indicator kanban-tooltip discussion-indicator';
            indicator.innerHTML = `💬 ${count}`;
            indicator.title = `${count} message${count > 1 ? 's' : ''} de discussion`;
            
            // Ajouter l'indicateur dans le footer de la carte, avec les autres indicateurs
            const cardFooter = cardElement.querySelector('.kanban-card-footer');
            
            if (cardFooter) {
                // Insérer avant l'assignee s'il existe, sinon à la fin
                const assignee = cardFooter.querySelector('.kanban-assignee');
                if (assignee) {
                    cardFooter.insertBefore(indicator, assignee);
                } else {
                    cardFooter.appendChild(indicator);
                }
            }
        }
    }

    /**
     * Charge et met à jour les indicateurs pour toutes les cartes visibles
     * @param {string} pageId - ID de la page kanban
     */
    async function updateAllDiscussionIndicators(pageId) {
        const cards = document.querySelectorAll('.kanban-card');
        
        for (const card of cards) {
            const cardId = card.getAttribute('id');
            if (cardId) {
                const count = await getDiscussionCount(pageId, cardId);
                updateCardDiscussionIndicator(cardId, count);
            }
        }
    }

    // Export des fonctions publiques
    window.KanbanDiscussions = {
        loadCardDiscussions,
        saveCardDiscussions,
        addDiscussionMessage,
        generateDiscussionSection,
        formatDiscussionMessage,
        getCardDiscussionPageId,
        getDiscussionCount,
        updateCardDiscussionIndicator,
        updateAllDiscussionIndicators
    };

})();
