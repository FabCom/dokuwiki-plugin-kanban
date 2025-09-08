/**
 * KanbanView - Classe pour l'inclusion de vues kanban
 * 
 * Permet d'afficher des kanban, colonnes ou cartes spécifiques
 * dans d'autres pages via la syntaxe <kanbanview>
 */
class KanbanView {
    constructor(element, config) {
        this.element = element;
        this.config = config;
        this.loadingElement = element.querySelector('.kanban-view-loading');
        this.contentElement = element.querySelector('.kanban-view-content');
        
        // Enregistrer cette instance dans le registre global
        window.KanbanViewInstances = window.KanbanViewInstances || [];
        window.KanbanViewInstances.push(this);
        
        this.init();
    }
    
    async init() {
        try {
            // Charger les données du kanban source
            const boardData = await this.loadBoardData();
            
            if (!boardData) {
                this.showError('Impossible de charger les données du kanban');
                return;
            }
            
            // Filtrer et afficher selon la configuration
            this.renderView(boardData);
            
        } catch (error) {
            console.error('Erreur lors du chargement de la vue kanban:', error);
            this.showError('Erreur lors du chargement: ' + error.message);
        }
    }
    
    async loadBoardData() {
        // Construire l'URL pour récupérer les données
        const url = this.buildDataUrl();
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Données récupérées pour le kanban:', data); // Ajoutez cette ligne

            return data;
            
        } catch (error) {
            console.error('Erreur réseau:', error);
            return null;
        }
    }
    
    buildDataUrl() {
        // URL pour récupérer les données JSON du kanban
        const baseUrl = DOKU_BASE + 'doku.php';
        const params = new URLSearchParams({
            do: 'kanban_data',
            id: this.config.board,
            view: 'json'
        });
        
        return `${baseUrl}?${params.toString()}`;
    }
    
    renderView(boardData) {
        this.hideLoading();
        
        // Créer le titre avec lien vers la page source
        this.createBoardTitle(boardData);
        
        // Filtrer et afficher selon le type de vue
        if (this.config.card) {
            this.renderCard(boardData);
        } else if (this.config.column) {
            this.renderColumn(boardData);
        } else {
            this.renderBoard(boardData);
        }
    }
    
    /**
     * Créer le titre du kanban avec lien vers la page source
     */
    createBoardTitle(boardData) {
        const title = document.createElement('h3');
        title.className = 'kanban-view-title';
        
        const link = document.createElement('a');
        link.href = `${DOKU_BASE}doku.php?id=${this.config.board}`;
        link.textContent = boardData.title || this.config.board;
        link.title = `Voir le kanban complet : ${this.config.board}`;
        
        // Style du lien
        link.style.color = 'var(--main-bg)';
        link.style.textDecoration = 'none';
        
        link.addEventListener('mouseover', () => {
            link.style.textDecoration = 'underline';
        });
        
        link.addEventListener('mouseout', () => {
            link.style.textDecoration = 'none';
        });
        
        title.appendChild(link);
        
        // Ajouter une indication du type de vue
        if (this.config.column) {
            const indicator = document.createElement('span');
            indicator.style.opacity = '0.8';
            indicator.style.marginLeft = '10px';
            indicator.style.fontSize = '0.9em';
            indicator.textContent = `(Colonne: ${this.config.column})`;
            title.appendChild(indicator);
        } else if (this.config.card) {
            const indicator = document.createElement('span');
            indicator.style.opacity = '0.8';
            indicator.style.marginLeft = '10px';
            indicator.style.fontSize = '0.9em';
            indicator.textContent = `(Carte: ${this.config.card})`;
            title.appendChild(indicator);
        }
        
        // Pour les vues cartes uniques, placer le titre au niveau principal pour l'affichage inline
        if (this.config.card) {
            this.element.insertBefore(title, this.contentElement);
        } else {
            this.contentElement.appendChild(title);
        }
    }
    
    renderCard(boardData) {
        const card = this.findCard(boardData, this.config.card);
        
        if (!card) {
            this.showError(`Carte "${this.config.card}" introuvable`);
            return;
        }
        
        // Appliquer la classe single-card au kanban-view principal
        this.element.classList.add('single-card');
        
        // Mettre à jour le titre existant avec le nom de la carte
        this.updateBoardTitle(card.title || 'Carte sans titre', 'card');
        
        // Créer une vue de carte
        const boardElement = document.createElement('div');
        boardElement.className = 'kanban-board';
        
        if (this.config.readonly === 'true') {
            boardElement.classList.add('kanban-read-only');
        }
        
        // Container pour la carte
        const columnsContainer = document.createElement('div');
        columnsContainer.className = 'kanban-columns';
        
        const columnElement = document.createElement('div');
        columnElement.className = 'kanban-column';
        
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'kanban-cards';
        
        const cardElement = this.createCardElement(card, true); // Enhanced for single view
        cardsContainer.appendChild(cardElement);
        
        columnElement.appendChild(cardsContainer);
        columnsContainer.appendChild(columnElement);
        boardElement.appendChild(columnsContainer);
        
        this.contentElement.appendChild(boardElement);
    }
    
    renderColumn(boardData) {
        const column = this.findColumn(boardData, this.config.column);
        
        if (!column) {
            this.showError(`Colonne "${this.config.column}" introuvable`);
            return;
        }
        
        // Appliquer la classe single-column au kanban-view principal
        this.element.classList.add('single-column');
        
        // Mettre à jour le titre existant avec le nom de la colonne
        this.updateBoardTitle(column.title || 'Colonne sans titre', 'column');
        
        // Créer une vue de colonne 
        const boardElement = document.createElement('div');
        boardElement.className = 'kanban-board';
        
        if (this.config.readonly === 'true') {
            boardElement.classList.add('kanban-read-only');
        }
        
        // Container des colonnes
        const columnsContainer = document.createElement('div');
        columnsContainer.className = 'kanban-columns';
        
        const columnElement = this.createColumnElement(column, true); // Enhanced for single view
        columnsContainer.appendChild(columnElement);
        boardElement.appendChild(columnsContainer);
        
        this.contentElement.appendChild(boardElement);
    }
    
    /**
     * Mettre à jour le titre existant pour créer une hiérarchie
     */
    updateBoardTitle(newTitle, viewType) {
        // Pour les cartes uniques, chercher le titre au niveau principal
        const titleContainer = this.config.card ? this.element : this.contentElement;
        const existingTitle = titleContainer.querySelector('.kanban-view-title');
        
        if (existingTitle) {
            // Récupérer le titre original du tableau
            const link = existingTitle.querySelector('a');
            const originalBoardTitle = link ? link.textContent : existingTitle.textContent;
            
            // Créer le titre hiérarchique
            if (link) {
                link.textContent = `${originalBoardTitle} > ${newTitle}`;
            } else {
                existingTitle.textContent = `${originalBoardTitle} > ${newTitle}`;
            }
            
            // Supprimer l'ancien indicateur s'il existe
            const oldIndicator = existingTitle.querySelector('span');
            if (oldIndicator) {
                oldIndicator.remove();
            }
        }
    }
    
    renderBoard(boardData) {
        if (!boardData.columns || !Array.isArray(boardData.columns)) {
            this.showError('Structure de données kanban invalide');
            return;
        }
        
        // Utiliser la même structure que le kanban original
        const boardElement = document.createElement('div');
        boardElement.className = 'kanban-board';
        
        if (this.config.readonly === 'true') {
            boardElement.classList.add('kanban-read-only');
        }
        
        // Container des colonnes - même structure que l'original
        const columnsContainer = document.createElement('div');
        columnsContainer.className = 'kanban-columns';
        
        // Créer les colonnes
        boardData.columns.forEach(column => {
            const columnElement = this.createColumnElement(column);
            columnsContainer.appendChild(columnElement);
        });
        
        boardElement.appendChild(columnsContainer);
        this.contentElement.appendChild(boardElement);
    }
    
    createColumnElement(column, isSingleView = false) {
        // Utiliser la même structure que le kanban original
        const columnDiv = document.createElement('div');
        columnDiv.className = 'kanban-column';
        columnDiv.dataset.columnId = column.id;
        
        // En-tête de colonne - ne l'afficher que si ce n'est pas une vue carte seule
        if (!isSingleView || this.config.column) {
            const header = document.createElement('div');
            header.className = 'kanban-column-header';
            
            const title = document.createElement('h3');
            title.className = 'kanban-column-title';
            title.textContent = column.title || column.id;
            header.appendChild(title);
            
            columnDiv.appendChild(header);
        }
        
        // Container des cartes - même structure que l'original
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'kanban-cards';
        
        if (column.cards && Array.isArray(column.cards)) {
            column.cards.forEach(card => {
                const cardElement = this.createCardElement(card, isSingleView);
                cardsContainer.appendChild(cardElement);
            });
        }
        
        columnDiv.appendChild(cardsContainer);
        
        return columnDiv;
    }
    
    createCardElement(card, isSingleView = false) {
        // Utiliser la même structure que le kanban original
        const cardDiv = document.createElement('div');
        cardDiv.className = 'kanban-card';
        cardDiv.dataset.cardId = card.id;
        
        // Ajouter la classe de priorité si définie
        if (card.priority) {
            cardDiv.classList.add('priority-' + card.priority.toLowerCase());
        }
        
        // Gestion des clics améliorée
        if (this.config.readonly !== 'true') {
            cardDiv.style.cursor = 'pointer';
            cardDiv.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Clic sur carte:', card.id, 'Page:', this.config.board);
                this.handleCardClick(card, isSingleView);
            });
        } else {
            // En mode readonly, ajouter un bouton d'actions pour la modale et le lien
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'kanban-card-actions';
            
            // Bouton pour ouvrir la modale de détails
            const viewBtn = document.createElement('button');
            viewBtn.className = 'kanban-view-btn';
            viewBtn.innerHTML = '👁️';
            viewBtn.title = 'Voir les détails';
            viewBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openCardModal(card);
            });
            actionsDiv.appendChild(viewBtn);
            
            // Bouton pour aller au tableau complet avec mise en évidence
            const linkBtn = document.createElement('button');
            linkBtn.className = 'kanban-copy-link-btn';
            linkBtn.innerHTML = '🔗';
            linkBtn.title = 'Aller au tableau complet';
            linkBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.goToFullBoard(card.id);
            });
            actionsDiv.appendChild(linkBtn);
            
            cardDiv.appendChild(actionsDiv);
        }
        
        // Tags en haut (même structure que l'original)
        if (card.tags && Array.isArray(card.tags) && card.tags.length > 0) {
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'kanban-card-tags';
            
            card.tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'kanban-tag';
                tagElement.textContent = tag;
                tagsContainer.appendChild(tagElement);
            });
            
            cardDiv.appendChild(tagsContainer);
        }
        
        // Header avec titre (même structure que l'original)
        const header = document.createElement('div');
        header.className = 'kanban-card-header';
        
        const title = document.createElement('h4');
        title.className = 'kanban-card-title';
        title.textContent = card.title || 'Sans titre';
        header.appendChild(title);
        
        cardDiv.appendChild(header);
        
        // Description (même structure que l'original)
        if (card.description) {
            const description = document.createElement('div');
            description.className = 'kanban-card-description';
            description.textContent = card.description;
            cardDiv.appendChild(description);
        }
        
        // Indicateurs de contenu (comme dans l'original)
        this.addContentIndicators(cardDiv, card);
        
        // Footer avec métadonnées (même structure que l'original)
        const footer = document.createElement('div');
        footer.className = 'kanban-card-footer';
        
        // Assignee
        if (card.assignee && card.assignee.trim() !== '') {
            const assignee = document.createElement('span');
            assignee.className = 'kanban-assignee';
            assignee.innerHTML = '👤 ' + this.sanitizeHtml(card.assignee);
            footer.appendChild(assignee);
        }
        
        // Due date
        if (card.dueDate) {
            const dueDate = document.createElement('span');
            dueDate.className = 'kanban-last-modified';
            dueDate.innerHTML = '📅 ' + this.sanitizeHtml(card.dueDate);
            footer.appendChild(dueDate);
        }
        
        // Ajouter le footer seulement s'il y a du contenu
        if (footer.children.length > 0) {
            cardDiv.appendChild(footer);
        }
        
        return cardDiv;
    }
    
    /**
     * Gérer le clic sur une carte selon le contexte
     */
    handleCardClick(card, isSingleView) {
        // Toujours ouvrir la modale de détails plutôt que rediriger
        this.openCardModal(card);
    }
    
    /**
     * Rediriger vers le tableau complet avec mise en évidence d'une carte
     */
    goToFullBoard(cardId) {
        const baseUrl = window.location.origin + window.location.pathname;
        const params = new URLSearchParams();
        params.set('id', this.config.board);
        
        // Use the card navigation system with hash fragment
        // Le système attend le préfixe 'card_' pour les fragments
        const newUrl = `${baseUrl}?${params.toString()}#${cardId}`;
        console.log('Redirection vers:', newUrl);
        window.location.href = newUrl;
    }
    
    findCard(boardData, cardId) {
        if (!boardData.columns) return null;
        
        for (const column of boardData.columns) {
            if (column.cards && Array.isArray(column.cards)) {
                const card = column.cards.find(c => c.id === cardId);
                if (card) return card;
            }
        }
        
        return null;
    }
    
    findColumn(boardData, columnId) {
        if (!boardData.columns) return null;
        
        return boardData.columns.find(c => c.id === columnId);
    }
    
    /**
     * Trouver la colonne qui contient une carte donnée
     */
    findColumnContainingCard(boardData, cardId) {
        if (!boardData.columns) return null;
        
        for (const column of boardData.columns) {
            if (column.cards && Array.isArray(column.cards)) {
                const card = column.cards.find(c => c.id === cardId);
                if (card) return column;
            }
        }
        
        return null;
    }
    
    sanitizeHtml(html) {
        // Basique sanitization - dans un vrai projet, utilisez DOMPurify
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
    }
    
    /**
     * Ajouter les indicateurs de contenu comme dans le kanban original
     */
    addContentIndicators(cardElement, card) {
        
        // Indicateurs de liens internes, externes et médias
        let indicatorsHtml = '';
        let internalLinksCount = 0;
        let externalLinksCount = 0;
        let mediaFilesCount = 0;
        
        // Vérifier d'abord les propriétés structurées (comme dans votre kanban.txt)
        if (card.internalLinks && Array.isArray(card.internalLinks)) {
            internalLinksCount = card.internalLinks.length;
        }
        
        if (card.externalLinks && Array.isArray(card.externalLinks)) {
            externalLinksCount = card.externalLinks.length;
        }
        
        if (card.media && Array.isArray(card.media)) {
            mediaFilesCount = card.media.length;
        }
        
        // Si pas de propriétés structurées, compter dans la description
        if (internalLinksCount === 0 && externalLinksCount === 0 && mediaFilesCount === 0 && card.description) {
            internalLinksCount = (card.description.match(/\[\[([^\]]*)\]\]/g) || []).length;
            externalLinksCount = (card.description.match(/https?:\/\/[^\s\]]+/g) || []).length;
            mediaFilesCount = (card.description.match(/\{\{([^}]*)\}\}/g) || []).length;
        }
        
        
        if (internalLinksCount > 0) {
            indicatorsHtml += `<span class="kanban-content-indicator kanban-tooltip" title="${internalLinksCount} lien${internalLinksCount > 1 ? 's' : ''} interne${internalLinksCount > 1 ? 's' : ''}">🔗 ${internalLinksCount}</span>`;
        }
        
        if (externalLinksCount > 0) {
            indicatorsHtml += `<span class="kanban-content-indicator kanban-tooltip" title="${externalLinksCount} lien${externalLinksCount > 1 ? 's' : ''} externe${externalLinksCount > 1 ? 's' : ''}">🌐 ${externalLinksCount}</span>`;
        }
        
        if (mediaFilesCount > 0) {
            indicatorsHtml += `<span class="kanban-content-indicator kanban-tooltip" title="${mediaFilesCount} média${mediaFilesCount > 1 ? 's' : ''} lié${mediaFilesCount > 1 ? 's' : ''}">📎 ${mediaFilesCount}</span>`;
        }
        
        // Indicateur de discussions (sera mis à jour de façon asynchrone)
        const hasVisibleIndicators = indicatorsHtml.trim().length > 0;
        
        // Ajouter le container des indicateurs s'il y en a
        if (hasVisibleIndicators) {
            const indicatorsContainer = document.createElement('div');
            indicatorsContainer.className = 'kanban-card-indicators';
            indicatorsContainer.innerHTML = indicatorsHtml;
            
            
            // Insérer après la description, avant le footer
            const footer = cardElement.querySelector('.kanban-card-footer');
            if (footer) {
                cardElement.insertBefore(indicatorsContainer, footer);
            } else {
                cardElement.appendChild(indicatorsContainer);
            }
        }
        
        // Initialiser les indicateurs de discussions de façon asynchrone
        this.initDiscussionIndicator(cardElement, card.id);
    }
    
    /**
     * Mettre à jour l'indicateur de discussions pour une carte spécifique
     */
    async updateCardDiscussionIndicator(cardId) {
        if (typeof window.KanbanDiscussions !== 'undefined' && window.KanbanDiscussions.getDiscussionCount) {
            try {
                // Trouver l'élément de la carte
                const cardElement = this.element.querySelector(`[data-card-id="${cardId}"]`);
                if (!cardElement) {
                    console.warn('Carte non trouvée pour mise à jour:', cardId);
                    return;
                }

                const count = await window.KanbanDiscussions.getDiscussionCount(this.config.board, cardId);
                
                // Trouver ou créer le container d'indicateurs
                let indicatorsContainer = cardElement.querySelector('.kanban-card-indicators');
                if (!indicatorsContainer && count > 0) {
                    indicatorsContainer = document.createElement('div');
                    indicatorsContainer.className = 'kanban-card-indicators';
                    
                    const footer = cardElement.querySelector('.kanban-card-footer');
                    if (footer) {
                        cardElement.insertBefore(indicatorsContainer, footer);
                    } else {
                        cardElement.appendChild(indicatorsContainer);
                    }
                }
                
                if (indicatorsContainer) {
                    // Supprimer l'ancien indicateur de discussion s'il existe
                    const oldDiscussionIndicator = indicatorsContainer.querySelector('.discussion-indicator');
                    if (oldDiscussionIndicator) {
                        oldDiscussionIndicator.remove();
                    }
                    
                    // Créer le nouvel indicateur seulement s'il y a des discussions
                    if (count > 0) {
                        const discussionIndicator = document.createElement('span');
                        discussionIndicator.className = 'kanban-content-indicator kanban-tooltip discussion-indicator';
                        discussionIndicator.setAttribute('data-tooltip-text', `${count} message${count > 1 ? 's' : ''} de discussion`);
                        discussionIndicator.innerHTML = `💬 ${count}`;
                        indicatorsContainer.appendChild(discussionIndicator);
                    }
                    
                    // Supprimer le container s'il est vide
                    if (indicatorsContainer.children.length === 0) {
                        indicatorsContainer.remove();
                    }
                }
                
            } catch (error) {
                console.error('Erreur mise à jour indicateur discussions:', error);
            }
        }
    }

    /**
     * Initialiser l'indicateur de discussions
     */
    async initDiscussionIndicator(cardElement, cardId) {
        if (typeof window.KanbanDiscussions !== 'undefined' && window.KanbanDiscussions.getDiscussionCount) {
            try {
                const count = await window.KanbanDiscussions.getDiscussionCount(this.config.board, cardId);
                
                if (count > 0) {
                    // Trouver ou créer le container d'indicateurs
                    let indicatorsContainer = cardElement.querySelector('.kanban-card-indicators');
                    if (!indicatorsContainer) {
                        indicatorsContainer = document.createElement('div');
                        indicatorsContainer.className = 'kanban-card-indicators';
                        
                        const footer = cardElement.querySelector('.kanban-card-footer');
                        if (footer) {
                            cardElement.insertBefore(indicatorsContainer, footer);
                        } else {
                            cardElement.appendChild(indicatorsContainer);
                        }
                    }
                    
                    // Supprimer l'ancien indicateur de discussion s'il existe
                    const oldDiscussionIndicator = indicatorsContainer.querySelector('.discussion-indicator');
                    if (oldDiscussionIndicator) {
                        oldDiscussionIndicator.remove();
                    }
                    
                    // Créer le nouvel indicateur
                    const discussionIndicator = document.createElement('span');
                    discussionIndicator.className = 'kanban-content-indicator kanban-tooltip discussion-indicator';
                    discussionIndicator.setAttribute('data-tooltip-text', `${count} message${count > 1 ? 's' : ''} de discussion`);
                    discussionIndicator.innerHTML = `💬 ${count}`;
                    
                    indicatorsContainer.appendChild(discussionIndicator);
                } else {
                    // Supprimer l'indicateur vide de discussion qui avait été créé
                    const emptyIndicator = cardElement.querySelector('.kanban-discussion-indicator');
                    if (emptyIndicator) {
                        emptyIndicator.remove();
                    }
                }
                
            } catch (error) {
                console.warn('Erreur lors du chargement des indicateurs de discussions:', error);
                // Supprimer l'indicateur vide en cas d'erreur
                const emptyIndicator = cardElement.querySelector('.kanban-discussion-indicator');
                if (emptyIndicator) {
                    emptyIndicator.remove();
                }
            }
        } else {
            console.log('KanbanDiscussions non disponible');
            // Supprimer l'indicateur vide si le module n'est pas disponible
            const emptyIndicator = cardElement.querySelector('.kanban-discussion-indicator');
            if (emptyIndicator) {
                emptyIndicator.remove();
            }
        }
    }
    
    /**
     * Ouvrir la modale de détails de carte
     */
    openCardModal(card) {
        console.log('Tentative d\'ouverture de modale pour:', card.id);
        
        // Utiliser le système de modales existant si disponible
        if (typeof window.KanbanModal !== 'undefined' && window.KanbanModal.showCardViewModal) {
            console.log('Utilisation de KanbanModal.showCardViewModal');
            window.KanbanModal.showCardViewModal(card, this.config.board);
        } else if (typeof window.KanbanModalCards !== 'undefined' && window.KanbanModalCards.showCardViewModal) {
            console.log('Utilisation de KanbanModalCards.showCardViewModal');
            window.KanbanModalCards.showCardViewModal(card, this.config.board);
        } else {
            console.log('Fallback vers URL directe');
            // Fallback : rediriger vers la page du kanban avec ancre
            const url = `${DOKU_BASE}doku.php?id=${this.config.board}#${card.id}`;
            window.open(url, '_blank');
        }
    }
    
    showError(message) {
        this.hideLoading();
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'kanban-view-error error';
        errorDiv.textContent = '❌ ' + message;
        
        this.contentElement.appendChild(errorDiv);
    }
    
    hideLoading() {
        if (this.loadingElement) {
            this.loadingElement.style.display = 'none';
        }
    }
}

// Registre global des instances KanbanView pour les notifications
window.KanbanViewInstances = window.KanbanViewInstances || [];

// Rendre la classe disponible globalement
window.KanbanView = KanbanView;

// Fonction globale pour notifier toutes les vues qu'une discussion a été mise à jour
window.notifyKanbanViewDiscussionUpdate = function(sourcePageId, cardId) {
    window.KanbanViewInstances.forEach(instance => {
        if (instance.config && instance.config.board === sourcePageId) {
            instance.updateCardDiscussionIndicator(cardId);
        }
    });
};
