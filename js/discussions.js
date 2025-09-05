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
    const CACHE_DURATION = 60000; // 1 minute
    const BATCH_CACHE_DURATION = 120000; // 2 minutes pour les batch
    
    // Cache pour les discussions
    const discussionCache = new Map();
    const discussionCountCache = new Map();
    const batchCountCache = new Map();

    /**
     * Cache helpers
     */
    function getCacheKey(pageId, cardId, type = 'discussions') {
        return `${type}:${pageId}:${cardId}`;
    }

    function isCacheValid(cacheEntry, duration = CACHE_DURATION) {
        return cacheEntry && (Date.now() - cacheEntry.timestamp < duration);
    }

    function setCacheEntry(key, data, timestamp = Date.now()) {
        const cache = key.startsWith('discussions:') ? discussionCache : 
                     key.startsWith('count:') ? discussionCountCache : 
                     batchCountCache;
        cache.set(key, { data, timestamp });
    }

    function getCacheEntry(key) {
        const cache = key.startsWith('discussions:') ? discussionCache : 
                     key.startsWith('count:') ? discussionCountCache : 
                     batchCountCache;
        return cache.get(key);
    }

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
     * Charge les discussions d'une carte depuis DokuWiki (avec cache)
     * @param {string} pageId - ID de la page kanban
     * @param {string} cardId - ID de la carte
     * @returns {Promise<Array>} - Liste des messages de discussion
     */
    async function loadCardDiscussions(pageId, cardId) {
        const cacheKey = getCacheKey(pageId, cardId, 'discussions');
        const cached = getCacheEntry(cacheKey);
        
        // Vérifier le cache
        if (isCacheValid(cached)) {
            return cached.data;
        }
        
        try {
            const discussionPageId = getCardDiscussionPageId(pageId, cardId);
            
            // Appel AJAX vers DokuWiki
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
            
            // Structure de réponse du gestionnaire AJAX : {success: true, message: '', data: {discussions: []}}
            if (data.success) {
                const discussions = data.data?.discussions || [];
                
                // Mettre en cache
                setCacheEntry(cacheKey, discussions);
                
                return discussions;
            } else {
                console.error('API Error:', data.message);
                throw new Error(data.message || 'Erreur lors du chargement des discussions');
            }
            
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
                if (result.success === true) {
                    // Invalider le cache pour cette carte
                    invalidateCardCache(pageId, cardId);
                    
                    // Mettre à jour le cache avec les nouvelles données
                    const discussionCacheKey = getCacheKey(pageId, cardId, 'discussions');
                    const countCacheKey = getCacheKey(pageId, cardId, 'count');
                    setCacheEntry(discussionCacheKey, discussions);
                    setCacheEntry(countCacheKey, discussions.length);
                }
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
            const result = await saveCardDiscussions(pageId, cardId, discussions);
            return result;
            
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
     * Compte le nombre de messages de discussion pour une carte (avec cache)
     * @param {string} pageId - ID de la page kanban
     * @param {string} cardId - ID de la carte
     * @returns {Promise<number>} - Nombre de messages
     */
    async function getDiscussionCount(pageId, cardId) {
        const cacheKey = getCacheKey(pageId, cardId, 'count');
        const cached = getCacheEntry(cacheKey);
        
        // Vérifier le cache
        if (isCacheValid(cached)) {
            return cached.data;
        }
        
        try {
            const discussions = await loadCardDiscussions(pageId, cardId);
            const count = discussions.length;
            
            // Mettre en cache
            setCacheEntry(cacheKey, count);
            
            return count;
        } catch (error) {
            console.error('Erreur comptage discussions:', error);
            return 0;
        }
    }

    /**
     * Charge les comptes de discussion pour plusieurs cartes en batch (optimisé pour les tris)
     * @param {string} pageId - ID de la page kanban
     * @param {Array<string>} cardIds - Liste des IDs de cartes
     * @returns {Promise<Object>} - Objet avec cardId -> count
     */
    async function getBatchDiscussionCounts(pageId, cardIds) {
        const batchKey = `batch:${pageId}:${cardIds.sort().join(',')}`;
        const cached = getCacheEntry(batchKey);
        
        // Vérifier le cache batch
        if (isCacheValid(cached, BATCH_CACHE_DURATION)) {
            return cached.data;
        }
        
        const results = {};
        const uncachedCards = [];
        
        // Vérifier le cache individuel pour chaque carte
        for (const cardId of cardIds) {
            const cacheKey = getCacheKey(pageId, cardId, 'count');
            const cached = getCacheEntry(cacheKey);
            
            if (isCacheValid(cached)) {
                results[cardId] = cached.data;
            } else {
                uncachedCards.push(cardId);
            }
        }
        
        // Charger les cartes non mises en cache
        if (uncachedCards.length > 0) {
            // Charger en parallèle avec limitation
            const batchSize = 5; // Limiter à 5 appels parallèles
            for (let i = 0; i < uncachedCards.length; i += batchSize) {
                const batch = uncachedCards.slice(i, i + batchSize);
                const promises = batch.map(async (cardId) => {
                    const count = await getDiscussionCount(pageId, cardId);
                    results[cardId] = count;
                    return { cardId, count };
                });
                
                await Promise.all(promises);
            }
        }
        
        // Mettre en cache le batch complet
        setCacheEntry(batchKey, results);
        
        return results;
    }

    /**
     * Invalide le cache pour une carte spécifique (à appeler lors des modifications)
     * @param {string} pageId - ID de la page kanban
     * @param {string} cardId - ID de la carte
     */
    function invalidateCardCache(pageId, cardId) {
        const discussionCacheKey = getCacheKey(pageId, cardId, 'discussions');
        const countCacheKey = getCacheKey(pageId, cardId, 'count');
        
        discussionCache.delete(discussionCacheKey);
        discussionCountCache.delete(countCacheKey);
        
        // Invalider les caches batch qui contiennent cette carte
        for (const [key, value] of batchCountCache.entries()) {
            if (key.includes(pageId) && value.data[cardId] !== undefined) {
                batchCountCache.delete(key);
            }
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
        getBatchDiscussionCounts,
        invalidateCardCache,
        updateCardDiscussionIndicator,
        updateAllDiscussionIndicators
    };

})();
