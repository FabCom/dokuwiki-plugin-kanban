/**
 * Kanban Plugin JavaScript - Modal System
 * Main modal API that delegates to specialized modules
 * @version 2.1.0
 */

(function() {
    'use strict';

    // Main modal API that delegates to modules
    window.KanbanModal = {
        // Core modal functions
        createModal: function(id, title, bodyContent) {
            return window.KanbanModalCore?.createModal(id, title, bodyContent);
        },
        
        closeModal: function(modal) {
            return window.KanbanModalCore?.closeModal(modal);
        },
        
        showConfirmModal: function(message, onConfirm, onCancel) {
            return window.KanbanModalCore?.showConfirmModal(message, onConfirm, onCancel);
        },

        // Card modals
        showCardModal: function(cardData, callback) {
            return window.KanbanModalCards?.showCardModal(cardData, callback);
        },
        
        showCardViewModal: function(cardData) {
            return window.KanbanModalCards?.showCardViewModal(cardData);
        },

        // Column modals
        showColumnModal: function(columnData, callback) {
            return window.KanbanModalColumns?.showColumnModal(columnData, callback);
        },
        
        showColumnOrderModal: function(boardData, callback) {
            return window.KanbanModalColumns?.showColumnOrderModal(boardData, callback);
        },

        // Links modals
        showInternalLinksModal: function(cardData, onSave) {
            return window.KanbanModalLinks?.showInternalLinksModal(cardData, onSave);
        },

        // Utility functions
        escapeHtml: function(text) {
            return window.KanbanModalCore?.escapeHtml(text);
        },
        
        formatDate: function(dateString) {
            return window.KanbanModalCore?.formatDate(dateString);
        }
    };

    // Also maintain backward compatibility
    if (!window.showCardModal) {
        window.showCardModal = window.KanbanModal.showCardModal;
        window.showCardViewModal = window.KanbanModal.showCardViewModal;
        window.showColumnModal = window.KanbanModal.showColumnModal;
        window.showColumnOrderModal = window.KanbanModal.showColumnOrderModal;
        window.showConfirmModal = window.KanbanModal.showConfirmModal;
    }

})();
