/**
 * Kanban Plugin - Drag & Drop Module
 * Support for card reordering within columns and between columns
 */

(function() {
    'use strict';

    // Module DragDrop
    const DragDropModule = {
        
        /**
         * Setup drag and drop for a card
         */
        setupCardDragAndDrop: function(card) {
            card.addEventListener('dragstart', function(e) {
                e.dataTransfer.setData('text/plain', card.id);
                card.classList.add('dragging');
                
                // Store original column for comparison
                e.dataTransfer.setData('source-column', card.closest('.kanban-cards').dataset.column);
            });
            
            card.addEventListener('dragend', function(e) {
                card.classList.remove('dragging');
                
                // Clean up any visual indicators
                document.querySelectorAll('.drag-over, .drop-indicator').forEach(el => {
                    el.classList.remove('drag-over', 'drop-indicator');
                });
            });
        },

        /**
         * Setup drop zone for a column (between columns and within column reordering)
         */
        setupColumnDropZone: function(column) {
            // Handle dragover for the column container
            column.addEventListener('dragover', function(e) {
                e.preventDefault();
                
                const draggingCard = document.querySelector('.dragging');
                if (!draggingCard) return;
                
                column.classList.add('drag-over');
                
                // Handle reordering within the same column
                const afterElement = getDragAfterElement(column, e.clientY);
                const dropIndicator = getOrCreateDropIndicator();
                
                if (afterElement == null) {
                    column.appendChild(dropIndicator);
                } else {
                    column.insertBefore(dropIndicator, afterElement);
                }
            });
            
            column.addEventListener('dragleave', function(e) {
                // Only remove drag-over if we're actually leaving the column
                if (!column.contains(e.relatedTarget)) {
                    column.classList.remove('drag-over');
                    removeDropIndicator();
                }
            });
            
            column.addEventListener('drop', function(e) {
                e.preventDefault();
                column.classList.remove('drag-over');
                removeDropIndicator();
                
                const cardId = e.dataTransfer.getData('text/plain');
                const sourceColumnId = e.dataTransfer.getData('source-column');
                const targetColumnId = column.dataset.column;
                const card = document.getElementById(cardId);
                
                if (!card) return;
                
                // Determine drop position
                const afterElement = getDragAfterElement(column, e.clientY);
                let targetIndex = 0;
                
                if (afterElement) {
                    const cards = Array.from(column.querySelectorAll('.kanban-card:not(.dragging)'));
                    targetIndex = cards.indexOf(afterElement);
                } else {
                    // Drop at the end
                    targetIndex = column.querySelectorAll('.kanban-card:not(.dragging)').length;
                }
                
                // Move card in DOM
                if (afterElement == null) {
                    column.appendChild(card);
                } else {
                    column.insertBefore(card, afterElement);
                }
                
                // Update data
                if (sourceColumnId === targetColumnId) {
                    // Reordering within same column
                    if (window.reorderCardInColumn) {
                        window.reorderCardInColumn(cardId, targetColumnId, targetIndex);
                    }
                } else {
                    // Moving between columns
                    if (window.moveCardInData) {
                        window.moveCardInData(cardId, targetColumnId, targetIndex);
                    }
                }
                
                // Save changes
                const board = column.closest('.kanban-board');
                if (window.saveChanges) {
                    window.saveChanges(board.id, sourceColumnId === targetColumnId ? 'reorder_card' : 'move_card');
                }
            });
        }
    };
    
    /**
     * Get the element after which we should insert the dragged item
     */
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    /**
     * Create or get existing drop indicator
     */
    function getOrCreateDropIndicator() {
        let indicator = document.querySelector('.drop-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'drop-indicator';
            indicator.style.cssText = `
                height: 2px;
                background-color: #007cba;
                margin: 4px 0;
                border-radius: 1px;
                opacity: 0.8;
                pointer-events: none;
            `;
        }
        return indicator;
    }
    
    /**
     * Remove drop indicator
     */
    function removeDropIndicator() {
        const indicator = document.querySelector('.drop-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    // Export to global scope
    window.KanbanDragDrop = DragDropModule;
    
    console.log('[DragDrop] Module drag & drop avec réordonnancement chargé ✅');
    
})();
