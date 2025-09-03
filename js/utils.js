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
        // Créer les tooltips personnalisés pour éviter la duplication
        document.addEventListener('mouseover', function(e) {
            if (e.target.classList.contains('kanban-tooltip')) {
                const tooltip = e.target;
                
                // Supprimer l'attribut title pour éviter le tooltip natif
                if (tooltip.hasAttribute('title') && !tooltip.hasAttribute('data-tooltip-text')) {
                    tooltip.setAttribute('data-tooltip-text', tooltip.getAttribute('title'));
                    tooltip.removeAttribute('title');
                }
                
                // Créer le tooltip personnalisé
                if (!tooltip.querySelector('.custom-tooltip')) {
                    const tooltipText = tooltip.getAttribute('data-tooltip-text');
                    if (tooltipText) {
                        const customTooltip = document.createElement('div');
                        customTooltip.className = 'custom-tooltip';
                        customTooltip.textContent = tooltipText;
                        tooltip.appendChild(customTooltip);
                        
                        // Positionner le tooltip selon la colonne
                        setTimeout(() => {
                            const column = tooltip.closest('.kanban-column');
                            if (column) {
                                const isFirstColumn = column.previousElementSibling === null;
                                const isLastColumn = column.nextElementSibling === null;
                                
                                customTooltip.classList.remove('tooltip-left', 'tooltip-right', 'tooltip-center');
                                
                                if (isFirstColumn) {
                                    customTooltip.classList.add('tooltip-left');
                                } else if (isLastColumn) {
                                    customTooltip.classList.add('tooltip-right');
                                } else {
                                    customTooltip.classList.add('tooltip-center');
                                }
                            }
                        }, 10);
                    }
                }
            }
        });
        
        // Supprimer le tooltip quand on quitte l'élément
        document.addEventListener('mouseout', function(e) {
            if (e.target.classList.contains('kanban-tooltip')) {
                const customTooltip = e.target.querySelector('.custom-tooltip');
                if (customTooltip) {
                    customTooltip.remove();
                }
            }
        });
    }

    /**
     * Show notification message
     */
    function showNotification(message, type = 'info', options = {}) {
        const duration = options.duration || (type === 'error' ? 8000 : 3000);
        const isHtml = options.isHtml || false;
        const persistent = options.persistent || false;
        
        const notification = document.createElement('div');
        notification.className = `kanban-notification kanban-notification-${type}`;
        
        if (isHtml) {
            notification.innerHTML = message;
        } else {
            notification.textContent = message;
        }
        
        // Add close button for persistent notifications or errors
        if (persistent || type === 'error') {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'kanban-notification-close';
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: inherit;
                font-size: 16px;
                font-weight: bold;
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                cursor: pointer;
                opacity: 0.7;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            closeBtn.addEventListener('click', () => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                    updateNotificationPositions();
                }
            });
            notification.appendChild(closeBtn);
            notification.style.paddingRight = '35px';
        }
        
        // Position notification based on existing ones
        const existingNotifications = document.querySelectorAll('.kanban-notification');
        let topPosition = 80; // Base position
        
        existingNotifications.forEach((notif, index) => {
            topPosition += notif.offsetHeight + 10; // Stack with 10px gap
        });
        
        notification.style.top = topPosition + 'px';
        
        document.body.appendChild(notification);
        
        if (!persistent) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                    updateNotificationPositions();
                }
            }, duration);
        }
    }
    
    /**
     * Update positions of existing notifications after one is removed
     */
    function updateNotificationPositions() {
        const notifications = document.querySelectorAll('.kanban-notification');
        let topPosition = 80;
        
        notifications.forEach((notif, index) => {
            notif.style.top = topPosition + 'px';
            topPosition += notif.offsetHeight + 10;
        });
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

})();