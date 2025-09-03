/**
 * Kanban Plugin - Lock Management Module
 * Gestion collaborative des verrous d'édition
 */

(function() {
    'use strict';

    /**
     * Lock a kanban board for editing
     */
    function lockBoard(boardId) {
        const board = document.getElementById(boardId);
        
        const formData = new FormData();
        formData.append('call', 'kanban');
        formData.append('action', 'lock_board');
        formData.append('page_id', JSINFO.id);
        
        return fetch(DOKU_BASE + 'lib/exe/ajax.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Marquer le tableau comme étant en mode édition
                if (board) board.dataset.editingMode = 'true';
                
                showNotification('Mode édition activé', 'success');
                updateLockUI(boardId, false, null); // isLocked=false car c'est notre verrou
                
                // Démarrer le renouvellement automatique du verrou
                startLockRenewal(boardId);
                
                // Démarrer le monitoring d'inactivité
                startInactivityMonitoring(boardId);
                
                return true;
            } else {
                showNotification('Impossible d\'activer l\'édition: ' + data.error, 'error');
                return false;
            }
        })
        .catch(error => {
            console.error('Erreur d\'activation de l\'édition:', error);
            showNotification('Erreur d\'activation de l\'édition', 'error');
            return false;
        });
    }

    /**
     * Unlock a kanban board
     */
    function unlockBoard(boardId) {
        const board = document.getElementById(boardId);
        
        const formData = new FormData();
        formData.append('call', 'kanban');
        formData.append('action', 'unlock_board');
        formData.append('page_id', JSINFO.id);
        
        return fetch(DOKU_BASE + 'lib/exe/ajax.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Désactiver le mode édition
                if (board) board.dataset.editingMode = 'false';
                
                // Arrêter le renouvellement du verrou
                stopLockRenewal(boardId);
                
                // Arrêter le monitoring d'inactivité
                stopInactivityMonitoring(boardId);
                
                showNotification('Édition terminée', 'success');
                updateLockUI(boardId, false, null);
                return true;
            } else {
                showNotification('Erreur de fin d\'édition: ' + data.error, 'error');
                return false;
            }
        })
        .catch(error => {
            console.error('Erreur de fin d\'édition:', error);
            showNotification('Erreur de fin d\'édition', 'error');
            return false;
        });
    }

    // Variables pour gérer le renouvellement des verrous
    const lockRenewalIntervals = new Map();
    
    // Variables pour la gestion de l'inactivité et des notifications
    const inactivityTimers = new Map();
    const countdownIntervals = new Map();
    const lastActivityTimes = new Map();
    const INACTIVITY_WARNING_TIME = 5 * 60 * 1000; // 5 minutes
    const AUTO_UNLOCK_TIME = 15 * 60 * 1000; // 15 minutes

    /**
     * Start automatic lock renewal for a board
     */
    function startLockRenewal(boardId) {
        // Arrêter un éventuel renouvellement existant
        stopLockRenewal(boardId);
        
        // Renouveler le verrou toutes les 10 minutes (600 secondes)
        // Soit 2/3 du timeout DokuWiki de 15 minutes
        const renewalInterval = setInterval(() => {
            renewLock(boardId);
        }, 600000); // 10 minutes
        
        lockRenewalIntervals.set(boardId, renewalInterval);
        console.log(`Lock renewal started for board ${boardId}`);
    }

    /**
     * Stop automatic lock renewal for a board
     */
    function stopLockRenewal(boardId) {
        const interval = lockRenewalIntervals.get(boardId);
        if (interval) {
            clearInterval(interval);
            lockRenewalIntervals.delete(boardId);
            console.log(`Lock renewal stopped for board ${boardId}`);
        }
    }

    /**
     * Renew lock for a board
     */
    function renewLock(boardId) {
        const formData = new FormData();
        formData.append('call', 'kanban');
        formData.append('action', 'renew_lock');
        formData.append('page_id', JSINFO.id);
        
        fetch(DOKU_BASE + 'lib/exe/ajax.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                console.warn('Lock renewal failed for board ' + boardId + ':', data.error);
                // En cas d'échec, arrêter le renouvellement et vérifier l'état
                stopLockRenewal(boardId);
                checkBoardLock(boardId);
            }
        })
        .catch(error => {
            console.error('Lock renewal error for board ' + boardId + ':', error);
        });
    }

    /**
     * Start inactivity monitoring for a board
     */
    function startInactivityMonitoring(boardId) {
        // Mettre à jour le timestamp d'activité
        lastActivityTimes.set(boardId, Date.now());
        
        // Arrêter un éventuel timer existant
        stopInactivityMonitoring(boardId);
        
        // Démarrer le timer d'inactivité (5 minutes)
        const inactivityTimer = setTimeout(() => {
            showInactivityWarning(boardId);
        }, INACTIVITY_WARNING_TIME);
        
        inactivityTimers.set(boardId, inactivityTimer);
        
        // Écouter les événements d'activité
        setupActivityListeners(boardId);
    }

    /**
     * Stop inactivity monitoring for a board
     */
    function stopInactivityMonitoring(boardId) {
        // Arrêter le timer d'inactivité
        const timer = inactivityTimers.get(boardId);
        if (timer) {
            clearTimeout(timer);
            inactivityTimers.delete(boardId);
        }
        
        // Arrêter le décompte s'il est actif
        stopCountdown(boardId);
        
        // Supprimer les listeners d'activité
        removeActivityListeners(boardId);
        
        // Nettoyer le timestamp
        lastActivityTimes.delete(boardId);
    }

    /**
     * Reset inactivity timer when user is active
     */
    function resetInactivityTimer(boardId) {
        const currentTime = Date.now();
        lastActivityTimes.set(boardId, currentTime);
        
        // Redémarrer le monitoring
        startInactivityMonitoring(boardId);
        
        // Arrêter le décompte s'il est actif
        stopCountdown(boardId);
    }

    /**
     * Show inactivity warning and start countdown
     */
    function showInactivityWarning(boardId) {
        const timeRemaining = AUTO_UNLOCK_TIME - INACTIVITY_WARNING_TIME; // 10 minutes restantes
        let remainingSeconds = Math.floor(timeRemaining / 1000);
        
        // Créer la notification de décompte
        const countdownNotification = document.createElement('div');
        countdownNotification.id = `countdown-${boardId}`;
        countdownNotification.className = 'kanban-countdown-notification';
        countdownNotification.innerHTML = `
            <div class="countdown-content">
                <strong>⚠️ Attention</strong>
                <p>Votre session d'édition sera automatiquement fermée dans <span class="countdown-time">${formatTime(remainingSeconds)}</span></p>
                <button class="btn-continue-editing" onclick="KanbanLockManager.continueEditing('${boardId}')">Continuer l'édition</button>
                <button class="btn-save-exit" onclick="KanbanLockManager.saveAndExit('${boardId}')">Sauvegarder et fermer</button>
            </div>
        `;
        
        // Ajouter au DOM
        document.body.appendChild(countdownNotification);
        
        // Démarrer le décompte
        const countdownInterval = setInterval(() => {
            remainingSeconds--;
            
            if (remainingSeconds <= 0) {
                // Temps écoulé - fermer automatiquement
                clearInterval(countdownInterval);
                autoCloseEditing(boardId);
            } else {
                // Mettre à jour l'affichage
                const timeElement = countdownNotification.querySelector('.countdown-time');
                if (timeElement) {
                    timeElement.textContent = formatTime(remainingSeconds);
                }
            }
        }, 1000);
        
        countdownIntervals.set(boardId, countdownInterval);
    }

    /**
     * Stop countdown notification
     */
    function stopCountdown(boardId) {
        // Arrêter l'intervalle
        const interval = countdownIntervals.get(boardId);
        if (interval) {
            clearInterval(interval);
            countdownIntervals.delete(boardId);
        }
        
        // Supprimer la notification
        const notification = document.getElementById(`countdown-${boardId}`);
        if (notification) {
            notification.remove();
        }
    }

    /**
     * Format time in MM:SS format
     */
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * Setup activity listeners for a board
     */
    function setupActivityListeners(boardId) {
        const board = document.getElementById(boardId);
        if (!board) return;
        
        const activityHandler = () => resetInactivityTimer(boardId);
        
        // Événements à surveiller
        const events = ['click', 'keydown', 'mousemove', 'scroll'];
        
        events.forEach(event => {
            board.addEventListener(event, activityHandler);
            // Stocker les handlers pour pouvoir les supprimer
            if (!board._activityHandlers) board._activityHandlers = [];
            board._activityHandlers.push({event, handler: activityHandler});
        });
    }

    /**
     * Remove activity listeners for a board
     */
    function removeActivityListeners(boardId) {
        const board = document.getElementById(boardId);
        if (!board || !board._activityHandlers) return;
        
        board._activityHandlers.forEach(({event, handler}) => {
            board.removeEventListener(event, handler);
        });
        
        delete board._activityHandlers;
    }

    /**
     * Continue editing - reset timers
     */
    function continueEditing(boardId) {
        resetInactivityTimer(boardId);
        showNotification('Session d\'édition prolongée', 'success');
    }

    /**
     * Save and exit editing mode
     */
    function saveAndExit(boardId) {
        // Sauvegarder les modifications en cours s'il y en a
        // (à implémenter selon le système de sauvegarde du kanban)
        
        // Fermer le mode édition
        unlockBoard(boardId);
        showNotification('Modifications sauvegardées, édition fermée', 'success');
    }

    /**
     * Auto close editing after timeout
     */
    function autoCloseEditing(boardId) {
        stopCountdown(boardId);
        unlockBoard(boardId);
        showNotification('Session d\'édition fermée automatiquement après inactivité', 'warning');
    }

    /**
     * Check if a kanban board is locked
     */
    function checkBoardLock(boardId) {
        const formData = new FormData();
        formData.append('call', 'kanban');
        formData.append('action', 'check_lock');
        formData.append('page_id', JSINFO.id);
        
        return fetch(DOKU_BASE + 'lib/exe/ajax.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            updateLockUI(boardId, data.locked, data.locked_by);
            return data;
        })
        .catch(error => {
            console.error('Erreur de vérification du verrouillage:', error);
            return { locked: false, locked_by: null };
        });
    }

    /**
     * Update lock UI elements
     */
    function updateLockUI(boardId, isLocked, lockedBy) {
        const board = document.getElementById(boardId);
        if (!board) return;
        
        // Dans le système DokuWiki:
        // - isLocked = false signifie "pas verrouillé" OU "verrouillé par moi"  
        // - isLocked = true + lockedBy = nom signifie "verrouillé par quelqu'un d'autre"
        
        // Update lock button
        const lockButton = board.querySelector('.kanban-lock-button');
        if (lockButton) {
            if (isLocked) {
                // Verrouillé par quelqu'un d'autre
                lockButton.textContent = '🔒 Verrouillé';
                lockButton.onclick = null;
                lockButton.title = `Verrouillé par ${lockedBy}`;
                lockButton.disabled = true;
            } else {
                // Pas verrouillé OU verrouillé par moi
                lockButton.textContent = '✏️ Éditer';
                lockButton.onclick = () => lockBoard(boardId);
                lockButton.title = 'Commencer l\'édition (verrouille le tableau)';
                lockButton.disabled = false;
            }
        }
        
        // Update board state selon la logique DokuWiki
        if (isLocked) {
            // Verrouillé par quelqu'un d'autre
            board.classList.add('kanban-locked', 'kanban-locked-other');
            disableBoardEditing(board);
            showLockNotification(board, lockedBy);
        } else {
            // Pas verrouillé OU verrouillé par moi 
            board.classList.remove('kanban-locked-other');
            
            // Si on vient de cliquer sur "Éditer", passer en mode édition
            // Sinon rester en mode lecture seule
            if (board.dataset.editingMode === 'true') {
                board.classList.add('kanban-locked');
                enableBoardEditing(board);
                hideLockNotification(board);
                
                // Changer le bouton en "Terminer l'édition"
                const lockButton = board.querySelector('.kanban-lock-button');
                if (lockButton) {
                    lockButton.textContent = '✅ Terminer l\'édition';
                    lockButton.onclick = () => unlockBoard(boardId);
                    lockButton.title = 'Terminer l\'édition et déverrouiller';
                }
            } else {
                // Mode lecture seule par défaut
                board.classList.remove('kanban-locked');
                disableBoardEditing(board);
                hideLockNotification(board);
            }
        }
    }

    /**
     * Disable board editing
     */
    function disableBoardEditing(board) {
        // Disable add card buttons
        board.querySelectorAll('.kanban-add-card').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        });
        
        // Hide card action buttons (edit, delete)
        board.querySelectorAll('.kanban-card-actions').forEach(actions => {
            actions.style.display = 'none';
        });
        
        // Disable card titles editing (removed - no longer inline editable)
        // Card titles are now only editable through the modal
        
        // Disable card drag and drop
        board.querySelectorAll('.kanban-card').forEach(card => {
            card.draggable = false;
            card.style.cursor = 'default';
        });
        
        // Disable column management buttons
        board.querySelectorAll('.kanban-column-header button').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        });
        
        // Remove column reorder button if present
        const reorderButton = board.querySelector('.kanban-reorder-button');
        if (reorderButton) {
            reorderButton.remove();
        }
        
        // Add visual indicator
        board.classList.add('kanban-read-only');
    }

    /**
     * Enable board editing
     */
    function enableBoardEditing(board) {
        // Enable add card buttons
        board.querySelectorAll('.kanban-add-card').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        });
        
        // Show card action buttons (edit, delete)
        board.querySelectorAll('.kanban-card-actions').forEach(actions => {
            actions.style.display = 'flex';
        });
        
        // Enable card titles editing (removed - no longer inline editable)
        // Card titles are now only editable through the modal
        
        // Enable card drag and drop
        board.querySelectorAll('.kanban-card').forEach(card => {
            card.draggable = true;
            card.style.cursor = 'move';
        });
        
        // Enable column management buttons
        board.querySelectorAll('.kanban-column-header button').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        });
        
        // Add column reorder button if not present
        const actionsDiv = board.querySelector('.kanban-actions');
        if (actionsDiv && !actionsDiv.querySelector('.kanban-reorder-button')) {
            const lockButton = actionsDiv.querySelector('.kanban-lock-button');
            const reorderButton = document.createElement('button');
            reorderButton.className = 'kanban-btn kanban-btn-secondary kanban-reorder-button';
            reorderButton.innerHTML = '🔄 Réorganiser colonnes';
            reorderButton.title = 'Réorganiser les colonnes';
            reorderButton.onclick = function() {
                // Direct call - should work since script.js loads after lockmanagement.js
                if (window.showColumnOrderModal) {
                    window.showColumnOrderModal(board.id);
                } else if (window.KanbanPlugin && window.KanbanPlugin.showColumnOrderModal) {
                    window.KanbanPlugin.showColumnOrderModal(board.id);
                } else {
                    console.error('showColumnOrderModal function not available');
                    alert('Fonction de réorganisation non disponible. Veuillez recharger la page.');
                }
            };
            
            // Insert after lock button
            if (lockButton && lockButton.nextSibling) {
                actionsDiv.insertBefore(reorderButton, lockButton.nextSibling);
            } else {
                actionsDiv.appendChild(reorderButton);
            }
        }
        
        // Remove visual indicator
        board.classList.remove('kanban-read-only');
    }

    /**
     * Show lock notification
     */
    function showLockNotification(board, lockedBy) {
        let notification = board.querySelector('.kanban-lock-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'kanban-lock-notification';
            board.insertBefore(notification, board.firstChild);
        }
        
        const escapeHtml = window.KanbanUtils?.escapeHtml || ((text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        });
        
        notification.innerHTML = `
            <div class="kanban-lock-message">
                🔒 Ce tableau est actuellement en cours d'édition par <strong>${escapeHtml(lockedBy)}</strong>
                <button onclick="window.KanbanLockManagement.checkBoardLock('${board.id}'); window.refreshBoardData && window.refreshBoardData('${board.id}')" class="btn-refresh">🔄 Actualiser</button>
            </div>
        `;
        notification.style.display = 'block';
    }

    /**
     * Hide lock notification
     */
    function hideLockNotification(board) {
        const notification = board.querySelector('.kanban-lock-notification');
        if (notification) {
            notification.style.display = 'none';
        }
    }

    /**
     * Auto-unlock on page unload
     */
    function setupAutoUnlock() {
        window.addEventListener('beforeunload', function() {
            // Arrêter tous les renouvellements de verrous
            lockRenewalIntervals.forEach((interval, boardId) => {
                clearInterval(interval);
                console.log(`Lock renewal stopped for board ${boardId} due to page unload`);
            });
            lockRenewalIntervals.clear();
            
            // Get all boards that might be locked by current user
            const boards = document.querySelectorAll('.kanban-board.kanban-locked:not(.kanban-locked-other)');
            
            boards.forEach(board => {
                // Synchronous unlock request
                const formData = new FormData();
                formData.append('call', 'kanban');
                formData.append('action', 'unlock_board');
                formData.append('page_id', JSINFO.id);
                
                // Use sendBeacon for reliable unload handling
                if (navigator.sendBeacon) {
                    navigator.sendBeacon(DOKU_BASE + 'lib/exe/ajax.php', formData);
                }
            });
        });
    }

    /**
     * Initialize board lock management
     */
    function initializeBoardLockManagement(board) {
        // Disable editing by default (read-only mode)
        disableBoardEditing(board);
        
        // Check lock status and update UI accordingly
        checkBoardLock(board.id);
    }

    // Helper function for notifications
    function showNotification(message, type = 'info') {
        if (window.KanbanUtils && window.KanbanUtils.showNotification) {
            window.KanbanUtils.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // Setup auto-unlock when module loads
    setupAutoUnlock();

    // Export to global scope
    window.KanbanLockManagement = {
        lockBoard,
        unlockBoard,
        checkBoardLock,
        updateLockUI,
        enableBoardEditing,
        disableBoardEditing,
        showLockNotification,
        hideLockNotification,
        initializeBoardLockManagement,
        continueEditing,
        saveAndExit
    };

    // Alias pour compatibilité avec les boutons HTML
    window.KanbanLockManager = window.KanbanLockManagement;

})();
