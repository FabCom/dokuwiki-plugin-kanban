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
        
        // Ensure DokuWiki context is available
        $this->ensureDokuWikiContext();
    }
    
    /**
     * Ensure DokuWiki context and functions are available
     */
    private function ensureDokuWikiContext() {
        // Check if essential DokuWiki functions are available
        if (!function_exists('rawWiki') || !function_exists('saveWikiText')) {
            // Try to load DokuWiki context
            if (defined('DOKU_INC')) {
                // We're in DokuWiki context but functions not loaded
                require_once(DOKU_INC . 'inc/pageutils.php');
                require_once(DOKU_INC . 'inc/parserutils.php');
                require_once(DOKU_INC . 'inc/io.php');
                require_once(DOKU_INC . 'inc/common.php');
            } else {
                // Try to detect DokuWiki base directory
                $dokuwikiBase = dirname(dirname(dirname(__DIR__)));
                if (file_exists($dokuwikiBase . '/inc/init.php')) {
                    define('DOKU_INC', $dokuwikiBase . '/');
                    require_once(DOKU_INC . 'inc/init.php');
                }
            }
        }
        
        // Final check - if still not available, log error
        if (!function_exists('rawWiki')) {
            KanbanErrorManager::logError('DokuWiki context not available - rawWiki function missing');
        }
        if (!function_exists('saveWikiText')) {
            KanbanErrorManager::logError('DokuWiki context not available - saveWikiText function missing');
        }
    }
    
    /**
     * Safe wrapper for rawWiki with fallback
     */
    private function safeRawWiki($pageId) {
        if (function_exists('rawWiki')) {
            return rawWiki($pageId);
        }
        
        // Fallback: try to read file directly
        if (defined('DOKU_INC')) {
            if (function_exists('wikiFN')) {
                $file = wikiFN($pageId);
                if (file_exists($file)) {
                    if (function_exists('io_readFile')) {
                        return io_readFile($file);
                    } else {
                        return file_get_contents($file);
                    }
                }
            }
        }
        
        // Last resort: try to construct the path manually
        if (defined('DOKU_INC')) {
            $file = DOKU_INC . 'data/pages/' . str_replace(':', '/', $pageId) . '.txt';
            if (file_exists($file)) {
                return file_get_contents($file);
            }
        }
        
        KanbanErrorManager::logError('Cannot read page content - no available method', ['page_id' => $pageId]);
        return false;
    }

    /**
     * Safe wrapper for saveWikiText with fallback and proper user context
     */
    private function safeSaveWikiText($pageId, $content, $summary) {
        global $INFO, $ID;
        
        KanbanErrorManager::logInfo('safeSaveWikiText started', [
            'page_id' => $pageId,
            'content_length' => strlen($content),
            'summary' => $summary,
            'saveWikiText_exists' => function_exists('saveWikiText'),
            'DOKU_INC_defined' => defined('DOKU_INC'),
            'wikiFN_exists' => function_exists('wikiFN')
        ]);
        
        // Set page context for saveWikiText
        $oldID = $ID;
        $ID = $pageId;
        
        // Initialize INFO array if not set
        if (!isset($INFO)) {
            $INFO = [];
        }
        
        try {
            if (function_exists('saveWikiText')) {
                KanbanErrorManager::logInfo('Attempting saveWikiText', [
                    'page_id' => $pageId,
                    'user' => KanbanAuthManager::getCurrentUser(),
                    'summary' => $summary,
                    'content_preview' => substr($content, 0, 200) . '...'
                ]);
                
                error_log("KANBAN DEBUG: About to call saveWikiText for page: $pageId");
                error_log("KANBAN DEBUG: Global vars - \$ID=" . ($ID ?? 'null') . ", \$INFO=" . (isset($INFO) ? 'set' : 'null') . ", user=" . ($_SERVER['REMOTE_USER'] ?? 'null'));
                
                // Call saveWikiText without sectok - it should work in AJAX context
                $saveResult = saveWikiText($pageId, $content, $summary);
                
                error_log("KANBAN DEBUG: saveWikiText completed for page: $pageId, result type: " . gettype($saveResult));
                
                KanbanErrorManager::logInfo('saveWikiText completed', [
                    'page_id' => $pageId,
                    'result' => $saveResult,
                    'result_type' => gettype($saveResult)
                ]);
                
                return true; // saveWikiText doesn't return a boolean, so assume success if no exception
            } else {
                // Fallback: direct file write (less ideal, no versioning)
                KanbanErrorManager::logWarning('saveWikiText not available, using fallback', [
                    'page_id' => $pageId
                ]);
                
                if (defined('DOKU_INC') && function_exists('wikiFN')) {
                    $file = wikiFN($pageId);
                    $dir = dirname($file);
                    
                    KanbanErrorManager::logInfo('Using file fallback', [
                        'page_id' => $pageId,
                        'file_path' => $file,
                        'dir_exists' => is_dir($dir),
                        'file_exists' => file_exists($file)
                    ]);
                    
                    // Create directory if needed
                    if (!is_dir($dir)) {
                        if (function_exists('io_makeFileDir')) {
                            io_makeFileDir($file);
                        } else {
                            mkdir($dir, 0755, true);
                        }
                    }
                    
                    // Write file
                    if (function_exists('io_saveFile')) {
                        $result = io_saveFile($file, $content);
                        KanbanErrorManager::logInfo('io_saveFile result', [
                            'page_id' => $pageId,
                            'result' => $result
                        ]);
                        return $result;
                    } else {
                        $result = file_put_contents($file, $content) !== false;
                        KanbanErrorManager::logInfo('file_put_contents result', [
                            'page_id' => $pageId,
                            'result' => $result
                        ]);
                        return $result;
                    }
                }
                
                KanbanErrorManager::logError('No method available to save page content', [
                    'page_id' => $pageId
                ]);
                return false;
            }
        } catch (Exception $e) {
            KanbanErrorManager::logError('Exception in safeSaveWikiText', [
                'page_id' => $pageId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        } finally {
            // Restore original ID
            $ID = $oldID;
        }
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
        // DEBUG: Force log to Apache error log
        error_log("KANBAN DEBUG: saveBoardData called - pageId=$pageId, boardId=$boardId, changeType=$changeType, dataCount=" . (is_array($data) ? count($data) : 'not_array'));
        
        // DEBUG: Log entrée de la fonction
        KanbanErrorManager::logInfo('saveBoardData called', [
            'page_id' => $pageId,
            'board_id' => $boardId,
            'change_type' => $changeType,
            'data_type' => gettype($data),
            'data_count' => is_array($data) ? count($data) : 0
        ]);
        
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
        
        KanbanErrorManager::logInfo('saveBoardData permissions OK, calling saveToPageContent');
        error_log("KANBAN DEBUG: Permissions OK, about to call saveToPageContent for pageId=$pageId");
        
        try {
            $result = $this->saveToPageContent($pageId, $boardId, $data, $changeType);
            error_log("KANBAN DEBUG: saveToPageContent returned: " . ($result ? 'true' : 'false') . " for pageId=$pageId");
            return $result;
        } catch (Exception $e) {
            error_log("KANBAN DEBUG: Exception in saveBoardData: " . $e->getMessage() . " for pageId=$pageId");
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
        KanbanErrorManager::logInfo('saveToPageContent started', [
            'page_id' => $pageId,
            'board_id' => $boardId,
            'change_type' => $changeType,
            'data_count' => is_array($data) ? count($data) : 0
        ]);
        
        // Ensure DokuWiki context is available
        $this->ensureDokuWikiContext();
        
        try {
            // Read current page content
            $pageContent = $this->safeRawWiki($pageId);
            if ($pageContent === false) {
                KanbanErrorManager::logError('Failed to read page content', ['page_id' => $pageId]);
                return false;
            }
            
            KanbanErrorManager::logInfo('Page content read successfully', [
                'page_id' => $pageId,
                'content_length' => strlen($pageContent)
            ]);
            
            // Generate new kanban content
            $kanbanContent = $this->generateKanbanContent($data);
            
            KanbanErrorManager::logInfo('Kanban content generated', [
                'page_id' => $pageId,
                'kanban_content_length' => strlen($kanbanContent)
            ]);
            
            // Replace or add kanban block
            $pattern = '/(<kanban[^>]*>).*?(<\/kanban>)/s';
            if (preg_match($pattern, $pageContent)) {
                // Replace existing kanban block
                $newContent = preg_replace($pattern, '$1' . "\n" . $kanbanContent . "\n" . '$2', $pageContent);
                KanbanErrorManager::logInfo('Replaced existing kanban block', ['page_id' => $pageId]);
            } else {
                // No kanban block found - add one for import operations
                if (strpos($changeType, 'import') !== false) {
                    // For imports, create a new kanban block
                    $kanbanBlock = "<kanban>\n" . $kanbanContent . "\n</kanban>";
                    
                    if (trim($pageContent) === '') {
                        // Empty page - just add the kanban block
                        $newContent = $kanbanBlock;
                    } else {
                        // Append to existing content
                        $newContent = $pageContent . "\n\n" . $kanbanBlock;
                    }
                    KanbanErrorManager::logInfo('Created new kanban block for import', ['page_id' => $pageId]);
                } else {
                    // For normal saves, require existing kanban block
                    KanbanErrorManager::logWarning('No kanban block found in page content', ['page_id' => $pageId]);
                    return false;
                }
            }
            
            // Generate change summary
            $summary = $this->generateChangeSummary($changeType, $data);
            
            KanbanErrorManager::logInfo('Saving page content', [
                'page_id' => $pageId,
                'summary' => $summary,
                'content_length' => strlen($newContent)
            ]);
            
            // Save using DokuWiki's saveWikiText function for proper versioning
            KanbanErrorManager::logInfo('About to save with safeSaveWikiText', [
                'page_id' => $pageId,
                'summary' => $summary,
                'saveWikiText_available' => function_exists('saveWikiText')
            ]);
            
            try {
                // Use our safe wrapper that handles context and fallbacks
                $success = $this->safeSaveWikiText($pageId, $newContent, $summary);
                
                // DEBUG: Force log to Apache error log
                error_log("KANBAN DEBUG: safeSaveWikiText returned: " . ($success ? 'true' : 'false') . " for page: $pageId");
                
                if ($success) {
                    // Clear cache after successful save
                    $this->cacheManager->clearAllCaches();
                    KanbanErrorManager::logInfo('Successfully saved page content with versioning', ['page_id' => $pageId]);
                    error_log("KANBAN DEBUG: Save completed successfully for page: $pageId");
                    return true;
                } else {
                    KanbanErrorManager::logError('safeSaveWikiText returned false', ['page_id' => $pageId]);
                    error_log("KANBAN DEBUG: safeSaveWikiText failed for page: $pageId");
                    return false;
                }
                
            } catch (Exception $saveException) {
                error_log("KANBAN DEBUG: Exception in save: " . $saveException->getMessage() . " for page: $pageId");
                KanbanErrorManager::logError('Failed to save page content', [
                    'page_id' => $pageId,
                    'error' => $saveException->getMessage(),
                    'trace' => $saveException->getTraceAsString()
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
        
        $pageContent = $this->safeRawWiki($pageId);
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
        error_log("KANBAN DEBUG: generateKanbanContent called with data type: " . gettype($data) . ", structure: " . (is_array($data) ? json_encode(array_keys($data)) : 'not_array'));
        
        // CORRECTION: $data peut être soit un tableau de colonnes directement, soit un objet avec 'columns'
        if (is_array($data)) {
            // Si c'est un tableau avec la clé 'columns', l'utiliser
            if (isset($data['columns']) && is_array($data['columns'])) {
                $columns = $data['columns'];
            } 
            // Sinon, considérer que $data EST le tableau de colonnes
            else {
                $columns = $data;
            }
        } else {
            error_log("KANBAN DEBUG: generateKanbanContent - data is not array, returning empty");
            return '[]';
        }
        
        error_log("KANBAN DEBUG: generateKanbanContent - using " . count($columns) . " columns");
        
        // Generate JSON content with proper formatting
        return json_encode($columns, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
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
            case 'import_replace':
                return "Kanban: Import complet - Remplacement ($cardCount cartes, $columnCount colonnes)";
            case 'import_merge':
                return "Kanban: Import complet - Fusion ($cardCount cartes, $columnCount colonnes)";
            case 'import_append':
                return "Kanban: Import complet - Ajout ($cardCount cartes, $columnCount colonnes)";
            case 'import_single_card':
                return "Kanban: Import d'une carte ($cardCount cartes, $columnCount colonnes)";
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
        
        $content = $this->safeRawWiki($pageId);
        return $content && strpos($content, '<kanban') !== false;
    }
}
