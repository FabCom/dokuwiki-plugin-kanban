/**
 * Kanban Plugin - Drag & Drop Module
 * Extrait du code fonctionnel pour une meilleure organisation
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
            });
            
            card.addEventListener('dragend', function(e) {
                card.classList.remove('dragging');
            });
        },

        /**
         * Setup drop zone for a column
         */
        setupColumnDropZone: function(column) {
            column.addEventListener('dragover', function(e) {
                e.preventDefault();
                column.classList.add('drag-over');
            });
            
            column.addEventListener('dragleave', function(e) {
                column.classList.remove('drag-over');
            });
            
            column.addEventListener('drop', function(e) {
                e.preventDefault();
                column.classList.remove('drag-over');
                
                const cardId = e.dataTransfer.getData('text/plain');
                const card = document.getElementById(cardId);
                
                if (card && card.parentNode !== column) {
                    // Move card in data (call global function)
                    if (window.moveCardInData) {
                        window.moveCardInData(cardId, column.dataset.column);
                    }
                    
                    // Move card in DOM
                    column.appendChild(card);
                    
                    // Save changes (call global function)
                    const board = column.closest('.kanban-board');
                    if (window.saveChanges) {
                        window.saveChanges(board.id, 'move_card');
                    }
                }
            });
        }
    };
    
    // Export to global scope
    window.KanbanDragDrop = DragDropModule;
    
    console.log('[DragDrop] Module drag & drop chargé ✅');
    
})();
