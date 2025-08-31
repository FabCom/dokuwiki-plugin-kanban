/**
 * Kanban Plugin - Utilities Module
 * Fonctions utilitaires réutilisables
 */

(function() {
    'use strict';

    // Module Utils
    const UtilsModule = {
        
        /**
         * Escape HTML to prevent XSS
         */
        escapeHtml: function(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        /**
         * Generate unique ID
         */
        generateId: function(prefix = 'item') {
            return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        },

        /**
         * Show notification
         */
        showNotification: function(message, type = 'info') {
            // Implementation for DokuWiki notifications if needed
            console.log(`[${type.toUpperCase()}] ${message}`);
        },

        /**
         * Deep clone object
         */
        deepClone: function(obj) {
            return JSON.parse(JSON.stringify(obj));
        }
    };
    
    // Export to global scope
    window.KanbanUtils = UtilsModule;
    
    console.log('[Utils] Module utilities chargé ✅');
    
})();