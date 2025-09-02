/**
 * Kanban Plugin JavaScript - Modal Core Module
 * Core modal functionality and utilities
 * @version 2.1.0
 */

(function() {
    'use strict';

    /**
     * Create a modal with basic structure
     */
    function createModal(id, title, bodyContent = '') {
        // Remove existing modal with same ID
        const existingModal = document.getElementById(id);
        if (existingModal) {
            document.body.removeChild(existingModal);
        }

        // Create modal structure
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'kanban-modal-overlay';
        modal.innerHTML = `
            <div class="kanban-modal">
                <div class="kanban-modal-header">
                    <h3 class="kanban-modal-title">${title}</h3>
                    <button type="button" class="kanban-modal-close" aria-label="Fermer">×</button>
                </div>
                <div class="kanban-modal-body">
                    ${bodyContent}
                </div>
            </div>
        `;

        // Force proper styling for centering
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '10000';

        // Add to DOM
        document.body.appendChild(modal);
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '10000';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

        // Setup close handlers
        setupModalCloseHandlers(modal);

        return modal;
    }

    /**
     * Setup modal close event handlers
     */
    function setupModalCloseHandlers(modal) {
        function closeModalHandler() {
            closeModal(modal);
        }

        // Close button
        const closeBtn = modal.querySelector('.kanban-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModalHandler);
        }

        // Click outside to close
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModalHandler();
            }
        });

        // Escape key to close
        function handleEscape(e) {
            if (e.key === 'Escape') {
                closeModalHandler();
                document.removeEventListener('keydown', handleEscape);
            }
        }
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Close and remove modal
     */
    function closeModal(modal) {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }

    /**
     * Show confirmation modal
     */
    function showConfirmModal(message, onConfirm, onCancel = null) {
        const modal = createModal('kanban-confirm-modal', 'Confirmation');
        
        modal.querySelector('.kanban-modal-body').innerHTML = `
            <div class="kanban-confirm-content">
                <p>${escapeHtml(message)}</p>
                <div class="kanban-confirm-actions">
                    <button type="button" class="kanban-btn kanban-btn-primary" id="confirm-yes">Confirmer</button>
                    <button type="button" class="kanban-btn kanban-btn-secondary" id="confirm-no">Annuler</button>
                </div>
            </div>
        `;

        // Bind buttons
        modal.querySelector('#confirm-yes').addEventListener('click', () => {
            if (onConfirm) onConfirm();
            closeModal(modal);
        });

        modal.querySelector('#confirm-no').addEventListener('click', () => {
            if (onCancel) onCancel();
            closeModal(modal);
        });

        modal.style.display = 'block';
        return modal;
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (window.KanbanUtils && window.KanbanUtils.escapeHtml) {
            return window.KanbanUtils.escapeHtml(text);
        }
        // Fallback if utils not loaded
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    /**
     * Format date consistently
     */
    function formatDate(dateString) {
        if (window.KanbanUtils && window.KanbanUtils.formatDate) {
            return window.KanbanUtils.formatDate(dateString);
        }
        // Fallback if utils not loaded
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('fr-FR');
        } catch (error) {
            return dateString;
        }
    }

    // Export functions to global scope
    window.KanbanModalCore = {
        createModal,
        setupModalCloseHandlers,
        closeModal,
        showConfirmModal,
        escapeHtml,
        formatDate
    };

})();
