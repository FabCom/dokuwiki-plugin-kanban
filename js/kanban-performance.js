/**
 * Kanban Performance Enhancements
 * Client-side optimization and pagination handling
 * 
 * @version 1.0.0
 * @date 2025-09-03
 */

// Wait for jQuery to be available
(function() {
    'use strict';
    
    function initKanbanPerformance() {
        // Check if jQuery is available
        if (typeof jQuery === 'undefined') {
            // Retry after a short delay
            setTimeout(initKanbanPerformance, 100);
            return;
        }
        
        // jQuery is available, proceed with initialization
        (function($) {
    
    // Performance configuration
    var perfConfig = {
        paginationEnabled: true,
        cardsPerPage: 50,
        cacheTimeout: 300000, // 5 minutes
        enableVirtualScrolling: true,
        debounceDelay: 300,
        maxVisibleCards: 100
    };
    
    // Cache for board data
    var boardCache = {
        data: null,
        timestamp: 0,
        pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCards: 0
        }
    };
    
    // Performance monitoring
    var perfStats = {
        loadTimes: [],
        cacheHits: 0,
        cacheMisses: 0,
        renderTimes: []
    };
    
    /**
     * Initialize performance enhancements
     */
    function initPerformanceEnhancements() {
        // Enable debounced save operations
        if (window.kanbanSaveBoardDebounced) {
            window.kanbanSaveBoardOriginal = window.kanbanSaveBoard;
            window.kanbanSaveBoard = debounce(window.kanbanSaveBoardOriginal, perfConfig.debounceDelay);
        }
        
        // Override board loading with pagination
        if (window.kanbanLoadBoard) {
            window.kanbanLoadBoardOriginal = window.kanbanLoadBoard;
            window.kanbanLoadBoard = loadBoardWithPagination;
        }
        
        // Add pagination controls
        addPaginationControls();
        
        // Add performance monitoring
        addPerformanceMonitoring();
        
        console.log('Kanban performance enhancements initialized');
    }
    
    /**
     * Load board with pagination support
     */
    function loadBoardWithPagination(pageId, boardId, page) {
        var startTime = performance.now();
        page = page || 1;
        
        // Check cache first
        if (isCacheValid() && boardCache.pagination.currentPage === page) {
            perfStats.cacheHits++;
            renderBoardFromCache();
            updatePaginationUI();
            
            var loadTime = performance.now() - startTime;
            perfStats.loadTimes.push(loadTime);
            console.log('Board loaded from cache in ' + loadTime.toFixed(2) + 'ms');
            return;
        }
        
        perfStats.cacheMisses++;
        
        // Determine if we should use pagination
        var shouldPaginate = perfConfig.paginationEnabled && page > 1;
        var action = shouldPaginate ? 'load_board_paginated' : 'load_board';
        
        var requestData = {
            call: 'kanban',
            action: action,
            page_id: pageId,
            board_id: boardId || 'default'
        };
        
        if (shouldPaginate) {
            requestData.page = page;
            requestData.page_size = perfConfig.cardsPerPage;
        }
        
        $.ajax({
            url: DOKU_BASE + 'doku.php',
            type: 'POST',
            data: requestData,
            dataType: 'json',
            success: function(response) {
                var loadTime = performance.now() - startTime;
                perfStats.loadTimes.push(loadTime);
                
                if (response.success) {
                    // Update cache
                    boardCache.data = response.data.board_data;
                    boardCache.timestamp = Date.now();
                    
                    if (response.data.pagination) {
                        boardCache.pagination = response.data.pagination;
                    }
                    
                    renderBoard(response.data.board_data);
                    updatePaginationUI();
                    
                    console.log('Board loaded in ' + loadTime.toFixed(2) + 'ms');
                    console.log('Pagination:', boardCache.pagination);
                } else {
                    console.error('Failed to load board:', response.message);
                    showMessage('Erreur lors du chargement: ' + response.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                var loadTime = performance.now() - startTime;
                console.error('AJAX error loading board:', error);
                showMessage('Erreur de connexion lors du chargement', 'error');
            }
        });
    }
    
    /**
     * Check if cached data is still valid
     */
    function isCacheValid() {
        return boardCache.data !== null && 
               (Date.now() - boardCache.timestamp) < perfConfig.cacheTimeout;
    }
    
    /**
     * Render board from cached data
     */
    function renderBoardFromCache() {
        if (boardCache.data) {
            renderBoard(boardCache.data);
        }
    }
    
    /**
     * Enhanced board rendering with virtual scrolling
     */
    function renderBoard(boardData) {
        var startTime = performance.now();
        
        if (!boardData || !boardData.columns) {
            console.warn('Invalid board data for rendering');
            return;
        }
        
        // Use virtual scrolling for large boards
        if (perfConfig.enableVirtualScrolling && getTotalCardCount(boardData) > perfConfig.maxVisibleCards) {
            renderBoardVirtual(boardData);
        } else {
            renderBoardStandard(boardData);
        }
        
        var renderTime = performance.now() - startTime;
        perfStats.renderTimes.push(renderTime);
        console.log('Board rendered in ' + renderTime.toFixed(2) + 'ms');
    }
    
    /**
     * Standard board rendering
     */
    function renderBoardStandard(boardData) {
        // Use original rendering logic
        if (window.kanbanRenderBoard) {
            window.kanbanRenderBoard(boardData);
        } else {
            console.warn('Original render function not found');
        }
    }
    
    /**
     * Virtual scrolling board rendering (simplified)
     */
    function renderBoardVirtual(boardData) {
        // For now, just use standard rendering
        // TODO: Implement proper virtual scrolling
        renderBoardStandard(boardData);
    }
    
    /**
     * Add pagination controls to the interface
     */
    function addPaginationControls() {
        var paginationHtml = $('<div id="kanban-pagination" class="kanban-pagination" style="display:none;">' +
            '<div class="pagination-info">' +
                '<span id="pagination-current">Page 1</span> sur ' +
                '<span id="pagination-total">1</span> ' +
                '(<span id="pagination-cards-count">0</span> cartes)' +
            '</div>' +
            '<div class="pagination-controls">' +
                '<button id="pagination-first" title="Première page">&laquo;</button>' +
                '<button id="pagination-prev" title="Page précédente">&lsaquo;</button>' +
                '<span id="pagination-pages"></span>' +
                '<button id="pagination-next" title="Page suivante">&rsaquo;</button>' +
                '<button id="pagination-last" title="Dernière page">&raquo;</button>' +
            '</div>' +
            '<div class="pagination-size">' +
                'Cartes par page: ' +
                '<select id="pagination-size-select">' +
                    '<option value="25">25</option>' +
                    '<option value="50" selected>50</option>' +
                    '<option value="100">100</option>' +
                '</select>' +
            '</div>' +
        '</div>');
        
        // Insert pagination controls
        var kanbanContainer = $('#kanban-board-container, .kanban-container').first();
        if (kanbanContainer.length) {
            kanbanContainer.after(paginationHtml);
            
            // Bind events
            bindPaginationEvents();
        }
    }
    
    /**
     * Bind pagination event handlers
     */
    function bindPaginationEvents() {
        $('#pagination-first').on('click', function() {
            if (boardCache.pagination.currentPage > 1) {
                loadPage(1);
            }
        });
        
        $('#pagination-prev').on('click', function() {
            if (boardCache.pagination.currentPage > 1) {
                loadPage(boardCache.pagination.currentPage - 1);
            }
        });
        
        $('#pagination-next').on('click', function() {
            if (boardCache.pagination.currentPage < boardCache.pagination.totalPages) {
                loadPage(boardCache.pagination.currentPage + 1);
            }
        });
        
        $('#pagination-last').on('click', function() {
            if (boardCache.pagination.currentPage < boardCache.pagination.totalPages) {
                loadPage(boardCache.pagination.totalPages);
            }
        });
        
        $('#pagination-size-select').on('change', function() {
            perfConfig.cardsPerPage = parseInt($(this).val());
            boardCache.data = null; // Invalidate cache
            loadPage(1); // Reload with new page size
        });
    }
    
    /**
     * Load specific page
     */
    function loadPage(page) {
        var pageId = window.kanbanCurrentPageId || $('input[name="id"]').val();
        var boardId = window.kanbanCurrentBoardId || 'default';
        
        if (pageId) {
            loadBoardWithPagination(pageId, boardId, page);
        }
    }
    
    /**
     * Update pagination UI
     */
    function updatePaginationUI() {
        var pagination = boardCache.pagination;
        
        if (pagination.totalPages > 1) {
            $('#kanban-pagination').show();
        } else {
            $('#kanban-pagination').hide();
            return;
        }
        
        $('#pagination-current').text('Page ' + pagination.currentPage);
        $('#pagination-total').text(pagination.totalPages);
        $('#pagination-cards-count').text(pagination.totalCards);
        
        // Update button states
        $('#pagination-first, #pagination-prev').prop('disabled', pagination.currentPage <= 1);
        $('#pagination-next, #pagination-last').prop('disabled', pagination.currentPage >= pagination.totalPages);
        
        // Update page numbers (simplified)
        var pagesHtml = '';
        var startPage = Math.max(1, pagination.currentPage - 2);
        var endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);
        
        for (var i = startPage; i <= endPage; i++) {
            var activeClass = i === pagination.currentPage ? ' active' : '';
            pagesHtml += '<button class="pagination-page' + activeClass + '" data-page="' + i + '">' + i + '</button>';
        }
        
        $('#pagination-pages').html(pagesHtml);
        
        // Bind page number clicks
        $('.pagination-page').on('click', function() {
            var page = parseInt($(this).data('page'));
            if (page !== pagination.currentPage) {
                loadPage(page);
            }
        });
    }
    
    /**
     * Add performance monitoring interface #TODO
     */
/*     function addPerformanceMonitoring() {
        // Add to admin interfaces only
        if (window.JSINFO && window.JSINFO.isadmin) {
            var perfButton = $('<button id="kanban-perf-stats" style="position:fixed;top:10px;right:10px;z-index:9999;">Perf Stats</button>');
            $('body').append(perfButton);
            
            perfButton.on('click', showPerformanceStats);
        }
    } */
    
    /**
     * Show performance statistics
     */
    function showPerformanceStats() {
        var avgLoadTime = perfStats.loadTimes.length > 0 
            ? (perfStats.loadTimes.reduce(function(a, b) { return a + b; }) / perfStats.loadTimes.length).toFixed(2)
            : 0;
            
        var avgRenderTime = perfStats.renderTimes.length > 0
            ? (perfStats.renderTimes.reduce(function(a, b) { return a + b; }) / perfStats.renderTimes.length).toFixed(2)
            : 0;
            
        var hitRate = (perfStats.cacheHits + perfStats.cacheMisses) > 0
            ? ((perfStats.cacheHits / (perfStats.cacheHits + perfStats.cacheMisses)) * 100).toFixed(1)
            : 0;
        
        // Get server-side cache stats
        $.ajax({
            url: DOKU_BASE + 'doku.php',
            type: 'POST',
            data: {
                call: 'kanban',
                action: 'get_cache_stats'
            },
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    showStatsModal(avgLoadTime, avgRenderTime, hitRate, response.data);
                }
            },
            error: function() {
                showStatsModal(avgLoadTime, avgRenderTime, hitRate, {});
            }
        });
    }
    
    /**
     * Show statistics modal
     */
    function showStatsModal(avgLoadTime, avgRenderTime, clientHitRate, serverStats) {
        var statsHtml = '<div id="perf-stats-modal" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;border:1px solid #ccc;z-index:10000;max-width:500px;">' +
            '<h3>Statistiques de Performance Kanban</h3>' +
            '<h4>Client-side</h4>' +
            '<p>Temps de chargement moyen: ' + avgLoadTime + 'ms</p>' +
            '<p>Temps de rendu moyen: ' + avgRenderTime + 'ms</p>' +
            '<p>Taux de cache hit: ' + clientHitRate + '%</p>' +
            '<p>Cache hits: ' + perfStats.cacheHits + '</p>' +
            '<p>Cache misses: ' + perfStats.cacheMisses + '</p>';
            
        if (serverStats.hit_rate) {
            statsHtml += '<h4>Server-side</h4>' +
                '<p>Taux de cache hit serveur: ' + serverStats.hit_rate + '</p>' +
                '<p>Cache hits serveur: ' + serverStats.hits + '</p>' +
                '<p>Cache misses serveur: ' + serverStats.misses + '</p>' +
                '<p>Cache mémoire: ' + serverStats.memory_cache_size + ' entrées</p>' +
                '<p>Cache session: ' + serverStats.session_cache_size + ' entrées</p>';
        }
        
        statsHtml += '<br><button onclick="$(\'#perf-stats-modal\').remove()">Fermer</button>' +
            '<button onclick="clearServerCache()" style="margin-left:10px;">Vider Cache Serveur</button>' +
            '</div>';
        
        $('body').append(statsHtml);
    }
    
    /**
     * Clear server-side cache
     */
    function clearServerCache() {
        $.ajax({
            url: DOKU_BASE + 'doku.php',
            type: 'POST',
            data: {
                call: 'kanban',
                action: 'clear_cache'
            },
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    alert('Cache serveur vidé avec succès');
                    boardCache.data = null; // Invalidate client cache too
                } else {
                    alert('Erreur: ' + response.message);
                }
            }
        });
    }
    
    // Utility functions
    
    /**
     * Debounce function calls
     */
    function debounce(func, wait) {
        var timeout;
        return function executedFunction() {
            var context = this;
            var args = arguments;
            var later = function() {
                timeout = null;
                func.apply(context, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Count total cards in board data
     */
    function getTotalCardCount(boardData) {
        if (!boardData || !boardData.columns) return 0;
        
        var total = 0;
        boardData.columns.forEach(function(column) {
            if (column.cards) {
                total += column.cards.length;
            }
        });
        return total;
    }
    
    /**
     * Show user message
     */
    function showMessage(message, type) {
        // Use DokuWiki's message system if available
        if (window.dw_message) {
            window.dw_message(message, type);
        } else {
            console.log(type + ': ' + message);
        }
    }
    
    // Initialize when document is ready
    $(document).ready(function() {
        // Only initialize if we're on a kanban page
        if ($('#kanban-board, .kanban-board').length > 0) {
            initPerformanceEnhancements();
        }
    });
    
    // Expose functions globally for integration
    window.kanbanPerformance = {
        loadBoardWithPagination: loadBoardWithPagination,
        clearCache: function() { boardCache.data = null; },
        getStats: function() { return perfStats; },
        config: perfConfig
    };
    
        })(jQuery); // End of jQuery wrapper
    }
    
    // Start initialization
    initKanbanPerformance();
})();
