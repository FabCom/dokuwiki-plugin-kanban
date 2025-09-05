<?php
/**
 * Kanban Data Manager
 * Handles all data persistence, loading, and content generation
 * 
 * @version 1.0.0
 * @date 2025-09-03
 */

class KanbanDataManager
{
    private $authManager;
    private $errorManager;
    private $cacheManager;
    
    public function __construct() {
        // Load required dependencies
        require_once(dirname(__FILE__) . '/KanbanAuthManager.php');
        require_once(dirname(__FILE__) . '/KanbanErrorManager.php');
        require_once(dirname(__FILE__) . '/KanbanCacheManager.php');
        
        $this->authManager = new KanbanAuthManager();
        $this->cacheManager = KanbanCacheManager::getInstance();
    }
    
    /**
     * Save kanban board data to page content
     * 
     * @param string $pageId Page ID
     * @param string $boardId Board ID
     * @param array $data Board data
     * @param string $changeType Type of change for summary
     * @return bool Success status
     */
    public function saveBoardData($pageId, $boardId, $data, $changeType = 'modification') {
        // Validate inputs
        if (empty($pageId) || empty($boardId) || empty($data)) {
            KanbanErrorManager::logWarning('Save board data called with missing parameters', [
                'page_id' => $pageId,
                'board_id' => $boardId,
                'has_data' => !empty($data)
            ]);
            return false;
        }
        
        // Check permissions
        if (!KanbanAuthManager::canEdit($pageId)) {
            KanbanErrorManager::logSecurity('Save board data denied - insufficient permissions', [
                'page_id' => $pageId,
                'user' => KanbanAuthManager::getCurrentUser()
            ]);
            return false;
        }
        
        try {
            return $this->saveToPageContent($pageId, $boardId, $data, $changeType);
        } catch (Exception $e) {
            KanbanErrorManager::logError('Exception in saveBoardData', [
                'page_id' => $pageId,
                'board_id' => $boardId,
                'message' => $e->getMessage()
            ]);
            return false;
        }
    }
    
    /**
     * Load kanban board data from page content
     * 
     * @param string $pageId Page ID
     * @param string $boardId Board ID
     * @return array|false Board data or false on failure
     */
    public function loadBoardData($pageId, $boardId = null) {
        if (empty($pageId)) {
            KanbanErrorManager::logWarning('Load board data called with empty page ID');
            return false;
        }
        
        // Check read permissions
        if (!KanbanAuthManager::canRead($pageId)) {
            KanbanErrorManager::logSecurity('Load board data denied - insufficient permissions', [
                'page_id' => $pageId,
                'user' => KanbanAuthManager::getCurrentUser()
            ]);
            return false;
        }
        
        try {
            return $this->loadFromPageContent($pageId, $boardId);
        } catch (Exception $e) {
            KanbanErrorManager::logError('Exception in loadBoardData', [
                'page_id' => $pageId,
                'board_id' => $boardId,
                'message' => $e->getMessage()
            ]);
            return false;
        }
    }
    
    /**
     * Save data to page content using DokuWiki versioning
     * 
     * @param string $pageId Page ID
     * @param string $boardId Board ID
     * @param array $data Board data
     * @param string $changeType Type of change
     * @return bool Success status
     */
    private function saveToPageContent($pageId, $boardId, $data, $changeType) {
        try {
            // Read current page content
            $pageContent = rawWiki($pageId);
            if ($pageContent === false) {
                KanbanErrorManager::logError('Failed to read page content', ['page_id' => $pageId]);
                return false;
            }
            
            // Generate new kanban content
            $kanbanContent = $this->generateKanbanContent($data);
            
            // Replace or add kanban block
            $pattern = '/(<kanban[^>]*>).*?(<\/kanban>)/s';
            if (preg_match($pattern, $pageContent)) {
                // Replace existing kanban block
                $newContent = preg_replace($pattern, '$1' . "\n" . $kanbanContent . "\n" . '$2', $pageContent);
            } else {
                KanbanErrorManager::logWarning('No kanban block found in page content', ['page_id' => $pageId]);
                return false;
            }
            
            // Generate change summary
            $summary = $this->generateChangeSummary($changeType, $data);
            
            KanbanErrorManager::logInfo('Saving page content', [
                'page_id' => $pageId,
                'summary' => $summary,
                'content_length' => strlen($newContent)
            ]);
            
            // Save using DokuWiki's saveWikiText function for proper versioning
            try {
                // Use saveWikiText() instead of io_saveFile() to enable DokuWiki versioning
                saveWikiText($pageId, $newContent, $summary);
                
                // Clear cache after successful save
                $this->cacheManager->clearAllCaches();
                KanbanErrorManager::logInfo('Successfully saved page content with versioning', ['page_id' => $pageId]);
                return true;
                
            } catch (Exception $saveException) {
                KanbanErrorManager::logError('Failed to save page content', [
                    'page_id' => $pageId,
                    'error' => $saveException->getMessage()
                ]);
                return false;
            }
            
        } catch (Exception $e) {
            KanbanErrorManager::logError('Exception in saveToPageContent', [
                'page_id' => $pageId,
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            return false;
        }
    }
    
    /**
     * Load data from page content
     * 
     * @param string $pageId Page ID
     * @param string $boardId Board ID
     * @return array|false Board data or false on failure
     */
    private function loadFromPageContent($pageId, $boardId = null) {
        // Try to get from cache first
        $cachedData = $this->cacheManager->getCachedBoardData($pageId);
        if ($cachedData !== null) {
            KanbanErrorManager::logInfo('Board data loaded from cache', ['page_id' => $pageId]);
            return $cachedData;
        }
        
        $pageContent = rawWiki($pageId);
        if ($pageContent === false) {
            KanbanErrorManager::logWarning('Page not found or not readable', ['page_id' => $pageId]);
            return false;
        }
        
        // Extract kanban content from page
        $pattern = '/<kanban[^>]*>(.*?)<\/kanban>/s';
        if (preg_match($pattern, $pageContent, $matches)) {
            $kanbanContent = trim($matches[1]);
            
            if (empty($kanbanContent)) {
                // Return empty board structure for new boards
                $defaultBoard = [
                    'title' => 'Nouveau tableau',
                    'columns' => [
                        ['title' => 'À faire', 'cards' => []],
                        ['title' => 'En cours', 'cards' => []],
                        ['title' => 'Terminé', 'cards' => []]
                    ]
                ];
                
                // Cache the default board
                $this->cacheManager->cacheBoardData($pageId, $defaultBoard);
                return $defaultBoard;
            }
            
            $boardData = $this->parseKanbanContentToData($kanbanContent);
            
            // Cache the parsed board data
            if ($boardData !== false) {
                $this->cacheManager->cacheBoardData($pageId, $boardData);
            }
            
            return $boardData;
        }
        
        KanbanErrorManager::logWarning('No kanban content found in page', ['page_id' => $pageId]);
        return false;
    }
    
    /**
     * Generate kanban content from data
     * 
     * @param array $data Board data
     * @return string Generated content
     */
    private function generateKanbanContent($data) {
        // CORRECTION: Sauvegarder en format JSON au lieu du format texte ancien
        if (!isset($data['columns']) || !is_array($data['columns'])) {
            return '[]';
        }
        
        // Generate JSON content with proper formatting
        return json_encode($data['columns'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    
    /**
     * Parse kanban content to data structure
     * 
     * @param string $content Raw kanban content
     * @return array Parsed data structure
     */
    private function parseKanbanContentToData($content) {
        // Try to parse as JSON first
        $decodedData = json_decode($content, true);
        
        if (json_last_error() === JSON_ERROR_NONE && is_array($decodedData)) {
            // Valid JSON content - return as board data
            return [
                'title' => 'Tableau Kanban',
                'columns' => $decodedData
            ];
        }
        
        // If not valid JSON, return empty board structure
        KanbanErrorManager::logWarning('Invalid kanban content format', [
            'content_preview' => substr($content, 0, 100),
            'json_error' => json_last_error_msg()
        ]);
        
        return [
            'title' => 'Nouveau tableau',
            'columns' => [
                ['title' => 'À faire', 'cards' => []],
                ['title' => 'En cours', 'cards' => []],
                ['title' => 'Terminé', 'cards' => []]
            ]
        ];
    }
    
    /**
     * Generate change summary for versioning
     * 
     * @param string $changeType Type of change
     * @param array $data Board data
     * @return string Change summary
     */
    private function generateChangeSummary($changeType, $data) {
        $cardCount = 0;
        $columnCount = isset($data['columns']) ? count($data['columns']) : 0;
        
        if (isset($data['columns'])) {
            foreach ($data['columns'] as $column) {
                if (isset($column['cards'])) {
                    $cardCount += count($column['cards']);
                }
            }
        }
        
        switch ($changeType) {
            case 'card_added':
                return "Kanban: Carte ajoutée ($cardCount cartes, $columnCount colonnes)";
            case 'card_moved':
                return "Kanban: Carte déplacée ($cardCount cartes, $columnCount colonnes)";
            case 'card_updated':
                return "Kanban: Carte modifiée ($cardCount cartes, $columnCount colonnes)";
            case 'card_deleted':
                return "Kanban: Carte supprimée ($cardCount cartes, $columnCount colonnes)";
            case 'column_added':
                return "Kanban: Colonne ajoutée ($cardCount cartes, $columnCount colonnes)";
            case 'column_updated':
                return "Kanban: Colonne modifiée ($cardCount cartes, $columnCount colonnes)";
            case 'column_deleted':
                return "Kanban: Colonne supprimée ($cardCount cartes, $columnCount colonnes)";
            default:
                return "Kanban: Tableau mis à jour ($cardCount cartes, $columnCount colonnes)";
        }
    }
    
    /**
     * Check if page has kanban content
     * 
     * @param string $pageId Page ID (optional, uses global $ID if not provided)
     * @return bool True if page has kanban content
     */
    public function hasKanbanContent($pageId = null) {
        global $ID;
        
        $pageId = $pageId ?: $ID;
        if (empty($pageId)) {
            return false;
        }
        
        $content = rawWiki($pageId);
        return $content && strpos($content, '<kanban') !== false;
    }
}
