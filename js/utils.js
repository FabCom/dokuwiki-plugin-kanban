/**
 * Kanban Plugin - Utilities Module
 * Fonctions utilitaires réutilisables
 */

(function() {
    'use strict';

    /**
     * Escape HTML to prevent XSS attacks
     */
    function escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Initialize smart tooltip positioning
     */
    function initializeSmartTooltips() {
        document.addEventListener('mouseover', function(e) {
            if (e.target.classList.contains('kanban-tooltip')) {
                const tooltip = e.target;
                setTimeout(() => {
                    const tooltipRect = tooltip.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const column = tooltip.closest('.kanban-column');
                    
                    if (column) {
                        const columnRect = column.getBoundingClientRect();
                        const isFirstColumn = column.previousElementSibling === null;
                        const isLastColumn = column.nextElementSibling === null;
                        
                        // Ajouter des classes pour le positionnement CSS
                        tooltip.classList.remove('tooltip-left', 'tooltip-right', 'tooltip-center');
                        
                        if (isFirstColumn) {
                            tooltip.classList.add('tooltip-left');
                        } else if (isLastColumn) {
                            tooltip.classList.add('tooltip-right');
                        } else {
                            tooltip.classList.add('tooltip-center');
                        }
                    }
                }, 10);
            }
        });
    }

    /**
     * Show notification message
     */
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `kanban-notification kanban-notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    /**
     * Format date consistently
     */
    function formatDate(dateString) {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                // Si ce n'est pas une date valide, retourner tel quel
                return dateString;
            }
            return date.toLocaleDateString('fr-FR');
        } catch (error) {
            return dateString;
        }
    }

    /**
     * Get current user from JSINFO
     */
    function getCurrentUser() {
        return JSINFO?.kanban_user || JSINFO?.userinfo?.name || JSINFO?.client || 'Utilisateur';
    }

    /**
     * Get current date time
     */
    function getCurrentDateTime() {
        return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }

    /**
     * Generate unique ID with prefix
     */
    function generateId(prefix = 'item') {
        return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Deep clone an object
     */
    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }

    // Initialize smart tooltips automatically
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSmartTooltips);
    } else {
        initializeSmartTooltips();
    }

    // Export to global scope
    window.KanbanUtils = {
        escapeHtml,
        initializeSmartTooltips,
        showNotification,
        formatDate,
        getCurrentUser,
        getCurrentDateTime,
        generateId,
        deepClone
    };

    console.log('🔧 KanbanUtils module loaded');

})();