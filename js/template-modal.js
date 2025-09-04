/**
 * Gestionnaire de templates de tableaux Kanban
 * Affiche une modal de sélection quand un tableau est vide
 */

class KanbanTemplateModal {
    constructor() {
        this.isVisible = false;
        this.selectedTemplate = null;
        this.currentTemplates = null;
        this.init();
    }

    init() {
        this.createModalHTML();
        this.bindEvents();
    }

    /**
     * Créer la modal HTML
     */
    createModalHTML() {
        const modalHTML = `
            <div id="template-modal" class="template-modal" style="display: none;">
                <div class="template-modal-overlay"></div>
                <div class="template-modal-content">
                    <div class="template-modal-header">
                        <h3>🎯 Créer un nouveau tableau</h3>
                        <p>Choisissez un template pour démarrer rapidement</p>
                        <button class="template-modal-close" aria-label="Fermer">&times;</button>
                    </div>
                    
                    <div class="template-modal-body">
                        <div class="template-categories">
                            <button class="template-category active" data-category="all">Tous</button>
                            <button class="template-category" data-category="business">Business</button>
                            <button class="template-category" data-category="editorial">Éditorial</button>
                            <button class="template-category" data-category="quality">Qualité</button>
                            <button class="template-category" data-category="development">Développement</button>
                            <button class="template-category" data-category="government">Gouvernement</button>
                        </div>
                        
                        <div class="template-grid" id="template-grid">
                            <!-- Templates seront injectés ici -->
                        </div>
                    </div>
                    
                    <div class="template-modal-footer">
                        <button class="template-btn template-btn-secondary" id="create-empty-board">
                            📋 Créer un tableau vide
                        </button>
                        <button class="template-btn template-btn-primary" id="create-from-template" disabled>
                            ✨ Créer avec ce template
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * Lier les événements
     */
    bindEvents() {
        const modal = document.getElementById('template-modal');
        const closeBtn = modal.querySelector('.template-modal-close');
        const overlay = modal.querySelector('.template-modal-overlay');
        const createEmptyBtn = document.getElementById('create-empty-board');
        const createTemplateBtn = document.getElementById('create-from-template');
        
        // Fermer la modal
        [closeBtn, overlay].forEach(element => {
            element.addEventListener('click', () => this.hide());
        });
        
        // Escape pour fermer
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
        
        // Catégories de templates
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('template-category')) {
                this.selectCategory(e.target.dataset.category);
            }
            
            if (e.target.closest('.template-card')) {
                this.selectTemplate(e.target.closest('.template-card'));
            }
        });
        
        // Créer tableau vide
        createEmptyBtn.addEventListener('click', () => {
            this.createEmptyBoard();
        });
        
        // Créer avec template
        createTemplateBtn.addEventListener('click', () => {
            this.createBoardFromTemplate();
        });
    }

    /**
     * Afficher la modal
     */
    show() {
        this.isVisible = true;
        this.loadTemplates();
        
        const modal = document.getElementById('template-modal');
        modal.style.display = 'block';
        
        // Animation d'entrée
        requestAnimationFrame(() => {
            modal.classList.add('template-modal-show');
        });
    }

    /**
     * Masquer la modal
     */
    hide() {
        this.isVisible = false;
        this.selectedTemplate = null;
        
        const modal = document.getElementById('template-modal');
        modal.classList.remove('template-modal-show');
        
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    /**
     * Charger les templates depuis le serveur
     */
    async loadTemplates() {
        try {
            const response = await fetch(`${DOKU_BASE}lib/exe/ajax.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    call: 'kanban',
                    action: 'get_templates',
                    sectok: window.token || ''
                })
            });

            const data = await response.json();
            console.log('Réponse AJAX templates:', data); // Debug
            
            if (data.success && data.data && data.data.templates) {
                this.currentTemplates = data.data.templates;
                this.renderTemplates(this.currentTemplates);
            } else {
                console.error('Erreur lors du chargement des templates:', data.error || 'Données manquantes');
                // Fallback avec templates par défaut
                this.currentTemplates = this.getDefaultTemplates();
                this.renderTemplates(this.currentTemplates);
            }
        } catch (error) {
            console.error('Erreur AJAX:', error);
            // Fallback avec templates par défaut
            this.currentTemplates = this.getDefaultTemplates();
            this.renderTemplates(this.currentTemplates);
        }
    }

    /**
     * Templates par défaut côté client (fallback)
     */
    getDefaultTemplates() {
        return {
            'project-standard': {
                'name': 'Gestion de projet classique',
                'description': 'Workflow de gestion de projet traditionnel',
                'icon': '📊',
                'category': 'business',
                'columns': [
                    {'title': '💡 Idées', 'color': '#fff3cd'},
                    {'title': '📋 Planifié', 'color': '#e9ecef'},
                    {'title': '🏃 En cours', 'color': '#d1ecf1'},
                    {'title': '⏸️ En attente', 'color': '#f8d7da'},
                    {'title': '✅ Terminé', 'color': '#d4edda'}
                ]
            },
            'content-editorial': {
                'name': 'Processus éditorial/Content',
                'description': 'Workflow de création et publication de contenu',
                'icon': '📝',
                'category': 'editorial',
                'columns': [
                    {'title': '💭 Idées d\'articles', 'color': '#fff3cd'},
                    {'title': '✍️ Rédaction', 'color': '#d1ecf1'},
                    {'title': '📖 Relecture', 'color': '#cce5ff'},
                    {'title': '🎨 Mise en forme', 'color': '#e2e3e5'},
                    {'title': '✅ Prêt à publier', 'color': '#d4edda'},
                    {'title': '🌐 Publié', 'color': '#c3e6cb'}
                ]
            },
            'quality-audit': {
                'name': 'Processus qualité/Audit',
                'description': 'Audit et amélioration continue',
                'icon': '🏥',
                'category': 'quality',
                'columns': [
                    {'title': '🔍 À auditer', 'color': '#fff3cd'},
                    {'title': '📊 En audit', 'color': '#d1ecf1'},
                    {'title': '⚠️ Non-conformités', 'color': '#f8d7da'},
                    {'title': '🔧 Actions correctives', 'color': '#cce5ff'},
                    {'title': '✅ Conforme', 'color': '#d4edda'}
                ]
            },
            'dev-agile': {
                'name': 'Développement logiciel (Scrum/Agile)',
                'description': 'Workflow de développement avec intégration continue',
                'icon': '🔧',
                'category': 'development',
                'columns': [
                    {'title': '📋 Backlog', 'color': '#e9ecef'},
                    {'title': '📝 À faire', 'color': '#fff3cd'},
                    {'title': '🔄 En cours', 'color': '#d1ecf1'},
                    {'title': '🧪 En test', 'color': '#f8d7da'},
                    {'title': '👀 Code Review', 'color': '#d4edda'},
                    {'title': '🚀 Prêt à déployer', 'color': '#cce5ff'},
                    {'title': '✅ Terminé', 'color': '#d4edda'}
                ]
            },
            'policy-monitoring': {
                'name': 'Veille sur les politiques publiques',
                'description': 'Suivi et analyse des politiques publiques et réglementations',
                'icon': '🏛️',
                'category': 'government',
                'columns': [
                    {'title': '👀 Politiques à surveiller', 'color': '#fff3cd'},
                    {'title': '📚 Sources d\'information', 'color': '#e9ecef'},
                    {'title': '📊 Informations recueillies', 'color': '#d1ecf1'},
                    {'title': '🔍 Analyse des impacts', 'color': '#cce5ff'},
                    {'title': '⚡ Actions à entreprendre', 'color': '#f8d7da'},
                    {'title': '✅ Suivi terminé', 'color': '#d4edda'}
                ]
            }
        };
    }

    /**
     * Afficher les templates dans la grille
     */
    renderTemplates(templates, category = 'all') {
        const grid = document.getElementById('template-grid');
        grid.innerHTML = '';
        
        Object.entries(templates).forEach(([templateId, template]) => {
            // Filtrer par catégorie
            if (category !== 'all' && template.category !== category) {
                return;
            }
            
            const templateCard = this.createTemplateCard(templateId, template);
            grid.appendChild(templateCard);
        });
    }

    /**
     * Créer une carte de template
     */
    createTemplateCard(templateId, template) {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.dataset.templateId = templateId;
        
        // Créer l'aperçu des colonnes
        const columnsPreview = template.columns.map(col => 
            `<div class="template-column-preview" style="background-color: ${col.color}">
                ${col.title.split(' ')[0]}
            </div>`
        ).join('');
        
        card.innerHTML = `
            <div class="template-card-header">
                <span class="template-icon">${template.icon}</span>
                <h4>${template.name}</h4>
            </div>
            <p class="template-description">${template.description}</p>
            <div class="template-columns-preview">
                ${columnsPreview}
            </div>
            <div class="template-meta">
                ${template.columns.length} colonnes
            </div>
        `;
        
        return card;
    }

    /**
     * Sélectionner une catégorie
     */
    selectCategory(category) {
        // Mettre à jour les boutons de catégorie
        document.querySelectorAll('.template-category').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        // Utiliser les templates déjà chargés ou fallback
        const templates = this.currentTemplates || this.getDefaultTemplates();
        this.renderTemplates(templates, category);
    }

    /**
     * Sélectionner un template
     */
    selectTemplate(templateCard) {
        // Désélectionner les autres
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Sélectionner le nouveau
        templateCard.classList.add('selected');
        this.selectedTemplate = templateCard.dataset.templateId;
        
        // Activer le bouton de création
        document.getElementById('create-from-template').disabled = false;
    }

    /**
     * Créer un tableau vide
     */
    async createEmptyBoard() {
        try {
            const response = await fetch(`${DOKU_BASE}lib/exe/ajax.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    call: 'kanban',
                    action: 'create_empty_board',
                    page: getCurrentPageId(),
                    sectok: window.token || ''
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.hide();
                location.reload(); // Recharger pour afficher le nouveau tableau
            } else {
                alert('Erreur lors de la création du tableau: ' + data.error);
            }
        } catch (error) {
            console.error('Erreur lors de la création:', error);
            alert('Erreur lors de la création du tableau');
        }
    }

    /**
     * Créer un tableau depuis un template
     */
    async createBoardFromTemplate() {
        if (!this.selectedTemplate) return;
        
        try {
            const response = await fetch(`${DOKU_BASE}lib/exe/ajax.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    call: 'kanban',
                    action: 'create_board_from_template',
                    template_id: this.selectedTemplate,
                    page: getCurrentPageId(),
                    sectok: window.token || ''
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.hide();
                location.reload(); // Recharger pour afficher le nouveau tableau
            } else {
                alert('Erreur lors de la création du tableau: ' + data.error);
            }
        } catch (error) {
            console.error('Erreur lors de la création:', error);
            alert('Erreur lors de la création du tableau');
        }
    }
}

// Fonction utilitaire pour récupérer l'ID de la page courante
function getCurrentPageId() {
    return JSINFO && JSINFO.id ? JSINFO.id : 'unknown';
}

// Initialiser le gestionnaire de templates quand le DOM est prêt
function initTemplateModal() {
    if (document.body) {
        window.templateModal = new KanbanTemplateModal();
    } else {
        // Si le body n'est pas encore disponible, attendre un peu
        setTimeout(initTemplateModal, 100);
    }
}

// Démarrer l'initialisation
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTemplateModal);
} else {
    // Le DOM est déjà chargé
    initTemplateModal();
}
