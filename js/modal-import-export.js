/**
 * Kanban Import/Export Modal
 * Modale unifiée pour gérer les imports et exports de données
 * @version 1.0.0
 */

(function() {
    'use strict';

    /**
     * Affiche la modale Import/Export
     */
    function showImportExportModal(boardId) {
        const modal = window.KanbanModalCore.createModal('kanban-import-export-modal', 'Import / Export');
        
        // Contenu de la modale avec onglets
        modal.querySelector('.kanban-modal-body').innerHTML = `
            <div class="kanban-modal-tabs">
                <button class="tab-button active" data-tab="tab-export">
                    📤 Export
                </button>
                <button class="tab-button" data-tab="tab-import">
                    📥 Import
                </button>
            </div>
            
            <div class="tab-content">
                <!-- Onglet Export -->
                <div id="tab-export" class="tab-pane active">
                    ${generateExportTabContent(boardId)}
                </div>
                
                <!-- Onglet Import -->
                <div id="tab-import" class="tab-pane">
                    ${generateImportTabContent(boardId)}
                </div>
            </div>
        `;

        // Footer
        const footer = document.createElement('div');
        footer.className = 'kanban-modal-footer';
        footer.innerHTML = `
            <button type="button" class="kanban-btn kanban-btn-secondary kanban-modal-close">Fermer</button>
        `;
        
        const innerModal = modal.querySelector('.kanban-modal');
        innerModal.appendChild(footer);

        // Configuration des onglets
        setupTabsEvents(modal);
        
        // Configuration des événements d'export
        setupExportEvents(modal, boardId);
        
        // Configuration des événements d'import
        setupImportEvents(modal, boardId);

        // Fermeture
        footer.querySelector('.kanban-modal-close').addEventListener('click', () => {
            window.KanbanModalCore.closeModal(modal);
        });

        modal.style.display = 'block';
        return modal;
    }

    /**
     * Génère le contenu de l'onglet Export
     */
    function generateExportTabContent(boardId) {
        return `
            <div class="import-export-section">
                <h4>📊 Exporter le tableau complet</h4>
                <p>Exportez toutes les données du tableau (colonnes, cartes, discussions) dans différents formats.</p>
                
                <div class="export-options">
                    <div class="export-option">
                        <div class="export-option-info">
                            <strong>📄 Export JSON</strong>
                            <p>Format complet avec métadonnées, discussions et liens. Idéal pour la sauvegarde ou la migration.</p>
                        </div>
                        <button class="kanban-btn kanban-btn-primary export-json-btn" data-board-id="${boardId}">
                            Télécharger JSON
                        </button>
                    </div>
                    
                    <div class="export-option">
                        <div class="export-option-info">
                            <strong>📊 Export CSV</strong>
                            <p>Format tabulaire pour tableurs (Excel, Google Sheets). Discussions non incluses.</p>
                        </div>
                        <button class="kanban-btn kanban-btn-info export-csv-btn" data-board-id="${boardId}">
                            Télécharger CSV
                        </button>
                    </div>
                </div>
                
                <div class="export-stats" id="export-stats-${boardId}">
                    <div class="stats-loading">
                        <span class="loading-spinner">⏳</span>
                        Calcul des statistiques...
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Génère le contenu de l'onglet Import
     */
    function generateImportTabContent(boardId) {
        return `
            <div class="import-export-section">
                <h4>📥 Importer des données</h4>
                <p>Importez des données JSON depuis un autre tableau kanban ou une sauvegarde.</p>
                
                <div class="import-zone">
                    <div class="file-drop-zone" id="file-drop-zone-${boardId}">
                        <div class="drop-zone-content">
                            <div class="drop-zone-icon">📁</div>
                            <p><strong>Glissez-déposez</strong> un fichier JSON ici</p>
                            <p>ou</p>
                            <button type="button" class="kanban-btn kanban-btn-secondary file-select-btn">
                                Choisir un fichier
                            </button>
                            <input type="file" id="file-input-${boardId}" accept=".json" style="display: none;">
                        </div>
                    </div>
                    
                    <div class="import-options" id="import-options-${boardId}" style="display: none;">
                        <h5>Options d'import</h5>
                        
                        <!-- Section pour carte seule -->
                        <div class="single-card-options" id="single-card-options-${boardId}" style="display: none;">
                            <div class="card-column-selection">
                                <label for="target-column-${boardId}">Colonne de destination :</label>
                                <select id="target-column-${boardId}" class="target-column-select">
                                    <!-- Options remplies dynamiquement -->
                                </select>
                            </div>
                        </div>
                        
                        <!-- Options pour tableau complet -->
                        <div class="board-import-options" id="board-import-options-${boardId}">
                            <div class="import-mode-selection">
                                <label class="import-mode-option">
                                    <input type="radio" name="import_mode_${boardId}" value="merge" checked>
                                    <div class="mode-info">
                                        <strong>🔄 Fusionner</strong>
                                        <p>Combine avec les données existantes. Met à jour les cartes en conflit.</p>
                                    </div>
                                </label>
                                
                                <label class="import-mode-option">
                                    <input type="radio" name="import_mode_${boardId}" value="append">
                                    <div class="mode-info">
                                        <strong>➕ Ajouter</strong>
                                        <p>Ajoute les nouvelles colonnes et cartes à la fin. Renomme en cas de conflit.</p>
                                    </div>
                                </label>
                                
                                <label class="import-mode-option">
                                    <input type="radio" name="import_mode_${boardId}" value="replace">
                                    <div class="mode-info">
                                        <strong>🔄 Remplacer</strong>
                                        <p><strong>⚠️ Attention:</strong> Remplace complètement le tableau existant.</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        <div class="import-preview" id="import-preview-${boardId}">
                            <!-- Aperçu des données à importer -->
                        </div>
                        
                        <div class="import-actions">
                            <button type="button" class="kanban-btn kanban-btn-primary import-confirm-btn" disabled>
                                Importer les données
                            </button>
                            <button type="button" class="kanban-btn kanban-btn-secondary import-cancel-btn">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
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
                const targetPane = modal.querySelector('#' + targetTab);
                if (targetPane) {
                    targetPane.classList.add('active');
                }
            });
        });
    }

    /**
     * Configure les événements d'export
     */
    function setupExportEvents(modal, boardId) {
        // Export JSON
        const exportJsonBtn = modal.querySelector('.export-json-btn');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => {
                if (window.KanbanPlugin && window.KanbanPlugin.exportToJSON) {
                    window.KanbanPlugin.exportToJSON(boardId);
                }
            });
        }
        
        // Export CSV
        const exportCsvBtn = modal.querySelector('.export-csv-btn');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => {
                if (window.KanbanPlugin && window.KanbanPlugin.exportToCSV) {
                    window.KanbanPlugin.exportToCSV(boardId);
                }
            });
        }
        
        // Charger les statistiques d'export
        loadExportStats(modal, boardId);
    }

    /**
     * Charge les statistiques d'export
     */
    function loadExportStats(modal, boardId) {
        const statsContainer = modal.querySelector(`#export-stats-${boardId}`);
        if (!statsContainer) return;
        
        // Calculer depuis les données locales
        const boardData = window.kanbanBoards && window.kanbanBoards[boardId];
        if (boardData && boardData.columns) {
            let totalCards = 0;
            let totalDiscussions = 0;
            
            boardData.columns.forEach(column => {
                if (column.cards) {
                    totalCards += column.cards.length;
                    column.cards.forEach(card => {
                        totalDiscussions += (card.discussions && card.discussions.length) || 0;
                    });
                }
            });
            
            statsContainer.innerHTML = `
                <div class="export-stats-grid">
                    <div class="stat-item">
                        <span class="stat-value">${boardData.columns.length}</span>
                        <span class="stat-label">Colonnes</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${totalCards}</span>
                        <span class="stat-label">Cartes</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${totalDiscussions}</span>
                        <span class="stat-label">Discussions</span>
                    </div>
                </div>
            `;
        } else {
            statsContainer.innerHTML = `
                <div class="stats-error">
                    <span>❌ Impossible de charger les statistiques</span>
                </div>
            `;
        }
    }

    /**
     * Configure les événements d'import
     */
    function setupImportEvents(modal, boardId) {
        const dropZone = modal.querySelector(`#file-drop-zone-${boardId}`);
        const fileInput = modal.querySelector(`#file-input-${boardId}`);
        const fileSelectBtn = modal.querySelector('.file-select-btn');
        const importOptions = modal.querySelector(`#import-options-${boardId}`);
        const importPreview = modal.querySelector(`#import-preview-${boardId}`);
        const importConfirmBtn = modal.querySelector('.import-confirm-btn');
        const importCancelBtn = modal.querySelector('.import-cancel-btn');
        
        let importData = null;
        
        // Sélection de fichier
        if (fileSelectBtn && fileInput) {
            fileSelectBtn.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleFileSelection(e.target.files[0]);
                }
            });
        }
        
        // Drag & Drop
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                
                if (e.dataTransfer.files.length > 0) {
                    handleFileSelection(e.dataTransfer.files[0]);
                }
            });
        }
        
        // Gestion du fichier sélectionné
        function handleFileSelection(file) {
            if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
                showNotification('Veuillez sélectionner un fichier JSON', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    importData = JSON.parse(e.target.result);
                    showImportPreview(importData);
                    importOptions.style.display = 'block';
                    importConfirmBtn.disabled = false;
                } catch (error) {
                    showNotification('Fichier JSON invalide: ' + error.message, 'error');
                    importData = null;
                    importConfirmBtn.disabled = true;
                }
            };
            reader.readAsText(file);
        }
        
        // Aperçu des données d'import
        function showImportPreview(data) {
            let previewHtml = '<h6>Aperçu des données à importer :</h6>';
            
            const singleCardOptions = modal.querySelector(`#single-card-options-${boardId}`);
            const boardImportOptions = modal.querySelector(`#board-import-options-${boardId}`);
            
            if (data.metadata && data.board) {
                // Import de board complet
                const board = data.board;
                const totalCards = board.columns ? board.columns.reduce((sum, col) => sum + (col.cards ? col.cards.length : 0), 0) : 0;
                
                previewHtml += `
                    <div class="import-preview-content">
                        <div class="preview-stats">
                            <span><strong>Type:</strong> Tableau complet</span>
                            <span><strong>Colonnes:</strong> ${board.columns ? board.columns.length : 0}</span>
                            <span><strong>Cartes:</strong> ${totalCards}</span>
                        </div>
                        <div class="preview-columns">
                            ${board.columns ? board.columns.map(col => 
                                `<span class="preview-column">${col.title} (${col.cards ? col.cards.length : 0})</span>`
                            ).join('') : ''}
                        </div>
                    </div>
                `;
                
                // Afficher les options de board, masquer les options de carte
                singleCardOptions.style.display = 'none';
                boardImportOptions.style.display = 'block';
                
            } else if (data.metadata && data.card) {
                // Import de carte unique
                previewHtml += `
                    <div class="import-preview-content">
                        <div class="preview-stats">
                            <span><strong>Type:</strong> Carte unique</span>
                            <span><strong>Titre:</strong> ${data.card.title}</span>
                            ${data.card.description ? `<span><strong>Description:</strong> ${data.card.description.substring(0, 50)}...</span>` : ''}
                        </div>
                    </div>
                `;
                
                // Charger et afficher les colonnes disponibles
                loadAvailableColumns(boardId, singleCardOptions);
                
                // Afficher les options de carte, masquer les options de board
                singleCardOptions.style.display = 'block';
                boardImportOptions.style.display = 'none';
                
            } else {
                previewHtml += `<div class="preview-error">⚠️ Format de données non reconnu</div>`;
                
                // Masquer toutes les options spécifiques
                singleCardOptions.style.display = 'none';
                boardImportOptions.style.display = 'block';
            }
            
            importPreview.innerHTML = previewHtml;
        }
        
        // Charger les colonnes disponibles pour l'import de carte
        function loadAvailableColumns(boardId, singleCardOptions) {
            const select = singleCardOptions.querySelector('.target-column-select');
            
            // DEBUG: Vérifier la disponibilité des données
            console.log('loadAvailableColumns - DEBUG:', {
                boardId: boardId,
                kanbanBoardsAvailable: !!window.kanbanBoards,
                boardDataAvailable: !!(window.kanbanBoards && window.kanbanBoards[boardId]),
                boardKeys: window.kanbanBoards ? Object.keys(window.kanbanBoards) : 'N/A'
            });
            
            // Récupérer les données du board depuis window.kanbanBoards
            const boardData = window.kanbanBoards && window.kanbanBoards[boardId];
            if (!boardData || !boardData.columns) {
                select.innerHTML = '<option value="">Aucune colonne trouvée</option>';
                console.warn('Aucune donnée de board trouvée pour:', boardId);
                return;
            }
            
            // Construire les options du select
            select.innerHTML = '<option value="">Choisir une colonne...</option>';
            
            boardData.columns.forEach((column, index) => {
                const columnId = column.id || index;
                const title = column.title || `Colonne ${index + 1}`;
                const cardCount = (column.cards && column.cards.length) || 0;
                
                const option = document.createElement('option');
                option.value = columnId;
                option.textContent = `${title} (${cardCount} cartes)`;
                select.appendChild(option);
            });
            
            console.log('Colonnes chargées pour import:', boardData.columns.length);
        }
        
        // Confirmation d'import
        if (importConfirmBtn) {
            importConfirmBtn.addEventListener('click', () => {
                const selectedMode = modal.querySelector(`input[name="import_mode_${boardId}"]:checked`);
                const targetColumnSelect = modal.querySelector(`#target-column-${boardId}`);
                
                if (importData && selectedMode) {
                    // Pour l'import de carte seule, récupérer la colonne cible
                    const targetColumn = (importData.metadata && importData.card && targetColumnSelect) 
                        ? targetColumnSelect.value 
                        : null;
                    
                    performImport(importData, selectedMode.value, boardId, targetColumn);
                }
            });
        }
        
        // Annulation d'import
        if (importCancelBtn) {
            importCancelBtn.addEventListener('click', () => {
                importData = null;
                importOptions.style.display = 'none';
                importConfirmBtn.disabled = true;
                if (fileInput) {
                    fileInput.value = '';
                }
            });
        }
    }

    /**
     * Effectue l'import des données
     */
    async function performImport(importData, importMode, boardId, targetColumn = null) {
        const pageId = window.JSINFO?.id || 'playground:kanban';
        
        // Essayer d'obtenir le sectok de plusieurs sources
        let sectok = '';
        if (window.JSINFO?.sectok) {
            sectok = window.JSINFO.sectok;
        } else if (window.sectok) {
            sectok = window.sectok;
        } else if (typeof jQuery !== 'undefined') {
            // Essayer de récupérer depuis un input hidden ou meta tag
            const tokenInput = jQuery('input[name="sectok"]');
            if (tokenInput.length) {
                sectok = tokenInput.val();
            } else {
                const tokenMeta = jQuery('meta[name="sectok"]');
                if (tokenMeta.length) {
                    sectok = tokenMeta.attr('content');
                }
            }
        }
        
        // DEBUG: Vérifier tous les paramètres avant envoi
        console.log('performImport - DEBUG:', {
            pageId: pageId,
            importMode: importMode,
            boardId: boardId,
            importDataKeys: Object.keys(importData || {}),
            sectokAvailable: !!sectok,
            sectokValue: sectok,
            sectokSource: window.JSINFO?.sectok ? 'JSINFO' : window.sectok ? 'window' : sectok ? 'DOM' : 'missing',
            jsInfoAvailable: typeof window.JSINFO !== 'undefined',
            jsInfoId: window.JSINFO?.id,
            dokuBaseAvailable: typeof DOKU_BASE !== 'undefined',
            dokuBaseValue: DOKU_BASE,
            jqueryAvailable: typeof jQuery !== 'undefined'
        });
        
        try {
            // Vérifications préliminaires
            if (!importData) {
                throw new Error('Aucune donnée à importer');
            }
            
            if (!pageId) {
                throw new Error('Page ID non disponible');
            }
            
            if (typeof DOKU_BASE === 'undefined') {
                throw new Error('DOKU_BASE non défini');
            }
            
            // Désactiver le bouton pendant l'import
            const importBtn = document.querySelector('.import-confirm-btn');
            if (importBtn) {
                importBtn.disabled = true;
                importBtn.innerHTML = '⏳ Import en cours...';
            }
            
            // Préparer les paramètres
            const requestParams = {
                call: 'kanban',
                action: 'import_board',
                page_id: pageId,
                board_id: boardId,
                json_data: JSON.stringify(importData),
                import_mode: importMode
            };
            
            // Ajouter la colonne cible pour l'import de carte seule
            if (targetColumn) {
                requestParams.target_column = targetColumn;
            }
            
            // Ajouter le sectok seulement s'il est disponible
            if (sectok) {
                requestParams.sectok = sectok;
            }
            
            console.log('performImport - Envoi requête avec paramètres:', {
                url: DOKU_BASE + 'lib/exe/ajax.php',
                paramsKeys: Object.keys(requestParams),
                jsonDataLength: requestParams.json_data.length,
                sectokPresent: !!requestParams.sectok,
                sectokValue: requestParams.sectok || 'N/A'
            });
            
            const response = await fetch(DOKU_BASE + 'lib/exe/ajax.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(requestParams)
            });
            
            console.log('performImport - Réponse reçue:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries())
            });
            
            if (!response.ok) {
                // Essayer de lire le texte de la réponse pour debug
                const responseText = await response.text();
                console.error('performImport - Réponse d\'erreur:', responseText);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                showNotification(result.message || 'Import réussi', 'success');
                
                // Recharger la page pour afficher les nouvelles données
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                showNotification(result.message || 'Erreur lors de l\'import', 'error');
                console.error('Import error:', result);
            }
            
        } catch (error) {
            console.error('Import failed:', error);
            showNotification('Erreur lors de l\'import: ' + error.message, 'error');
        } finally {
            // Réactiver le bouton
            const importBtn = document.querySelector('.import-confirm-btn');
            if (importBtn) {
                importBtn.disabled = false;
                importBtn.innerHTML = 'Importer les données';
            }
        }
    }

    /**
     * Affiche une notification
     */
    function showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            alert(message);
        }
    }

    // Export functions to global scope
    window.KanbanImportExport = {
        showImportExportModal
    };

})();
