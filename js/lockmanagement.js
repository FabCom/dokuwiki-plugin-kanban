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
        
        // Disable card titles editing
        board.querySelectorAll('.kanban-card-title').forEach(title => {
            title.contentEditable = 'false';
            title.style.cursor = 'default';
        });
        
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
        
        // Hide "Ajouter Colonne" button
        board.querySelectorAll('button[onclick*="addColumn"]').forEach(btn => {
            btn.style.display = 'none';
        });
        
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
        
        // Enable card titles editing
        board.querySelectorAll('.kanban-card-title').forEach(title => {
            title.contentEditable = 'true';
            title.style.cursor = 'text';
        });
        
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
        
        // Show "Ajouter Colonne" button
        board.querySelectorAll('button[onclick*="addColumn"]').forEach(btn => {
            btn.style.display = 'inline-block';
        });
        
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
                <button onclick="window.KanbanLockManagement.checkBoardLock('${board.id}')" class="btn-refresh">🔄 Actualiser</button>
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
        initializeBoardLockManagement
    };

    console.log('🔒 KanbanLockManagement module loaded');

})();
