<?php
/**
 * Kanban Cache Manager
 * Handles performance optimizations through caching
 * 
 * @version 1.0.0
 * @date 2025-09-03
 */

class KanbanCacheManager
{
    private static $instance = null;
    private $sessionCache = [];
    private $memoryCache = [];
    private $cacheStats = [];
    
    // Cache configuration
    private $config = [
        'acl_cache_ttl' => 300,        // 5 minutes for ACL cache
        'board_cache_ttl' => 600,      // 10 minutes for board data cache
        'pagination_size' => 50,       // Cards per page
        'max_cache_size' => 1000,      // Maximum items in memory cache
        'enable_session_cache' => true, // Use session for ACL cache
        'enable_memory_cache' => true,  // Use memory for temporary cache
    ];
    
    /**
     * Singleton pattern
     */
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        // Initialize session cache if not exists
        if ($this->config['enable_session_cache'] && !isset($_SESSION['kanban_cache'])) {
            $_SESSION['kanban_cache'] = [];
        }
        
        // Initialize cache stats
        $this->cacheStats = [
            'hits' => 0,
            'misses' => 0,
            'writes' => 0,
            'evictions' => 0
        ];
    }
    
    /**
     * Cache ACL permission result
     * 
     * @param string $user Username
     * @param string $pageId Page ID
     * @param string $permission Permission type (read/edit/delete)
     * @param bool $result Permission result
     */
    public function cacheACL($user, $pageId, $permission, $result) {
        if (!$this->config['enable_session_cache']) {
            return;
        }
        
        $key = $this->getACLCacheKey($user, $pageId, $permission);
        $cacheEntry = [
            'result' => $result,
            'timestamp' => time(),
            'ttl' => $this->config['acl_cache_ttl']
        ];
        
        $_SESSION['kanban_cache'][$key] = $cacheEntry;
        $this->cacheStats['writes']++;
        
        // Clean expired entries periodically
        if (rand(1, 100) === 1) { // 1% chance
            $this->cleanExpiredACLCache();
        }
    }
    
    /**
     * Get cached ACL permission result
     * 
     * @param string $user Username
     * @param string $pageId Page ID
     * @param string $permission Permission type
     * @return bool|null Permission result or null if not cached
     */
    public function getCachedACL($user, $pageId, $permission) {
        if (!$this->config['enable_session_cache'] || !isset($_SESSION['kanban_cache'])) {
            $this->cacheStats['misses']++;
            return null;
        }
        
        $key = $this->getACLCacheKey($user, $pageId, $permission);
        
        if (!isset($_SESSION['kanban_cache'][$key])) {
            $this->cacheStats['misses']++;
            return null;
        }
        
        $cacheEntry = $_SESSION['kanban_cache'][$key];
        
        // Check if expired
        if (time() - $cacheEntry['timestamp'] > $cacheEntry['ttl']) {
            unset($_SESSION['kanban_cache'][$key]);
            $this->cacheStats['misses']++;
            return null;
        }
        
        $this->cacheStats['hits']++;
        return $cacheEntry['result'];
    }
    
    /**
     * Cache board data with compression for large boards
     * 
     * @param string $pageId Page ID
     * @param array $boardData Board data
     */
    public function cacheBoardData($pageId, $boardData) {
        if (!$this->config['enable_memory_cache']) {
            return;
        }
        
        // Check cache size limit
        if (count($this->memoryCache) >= $this->config['max_cache_size']) {
            $this->evictOldestCache();
        }
        
        $key = "board_data_" . md5($pageId);
        $cacheEntry = [
            'data' => $this->compressBoardData($boardData),
            'timestamp' => time(),
            'ttl' => $this->config['board_cache_ttl'],
            'size' => strlen(json_encode($boardData))
        ];
        
        $this->memoryCache[$key] = $cacheEntry;
        $this->cacheStats['writes']++;
    }
    
    /**
     * Get cached board data
     * 
     * @param string $pageId Page ID
     * @return array|null Board data or null if not cached
     */
    public function getCachedBoardData($pageId) {
        if (!$this->config['enable_memory_cache']) {
            $this->cacheStats['misses']++;
            return null;
        }
        
        $key = "board_data_" . md5($pageId);
        
        if (!isset($this->memoryCache[$key])) {
            $this->cacheStats['misses']++;
            return null;
        }
        
        $cacheEntry = $this->memoryCache[$key];
        
        // Check if expired
        if (time() - $cacheEntry['timestamp'] > $cacheEntry['ttl']) {
            unset($this->memoryCache[$key]);
            $this->cacheStats['misses']++;
            return null;
        }
        
        $this->cacheStats['hits']++;
        return $this->decompressBoardData($cacheEntry['data']);
    }
    
    /**
     * Paginate board data for large boards
     * 
     * @param array $boardData Complete board data
     * @param int $page Page number (1-based)
     * @param int $pageSize Cards per page
     * @return array Paginated result with metadata
     */
    public function paginateBoardData($boardData, $page = 1, $pageSize = null) {
        $pageSize = $pageSize ?: $this->config['pagination_size'];
        $page = max(1, $page);
        
        if (!isset($boardData['columns']) || !is_array($boardData['columns'])) {
            return [
                'board_data' => $boardData,
                'pagination' => [
                    'current_page' => 1,
                    'total_pages' => 1,
                    'total_cards' => 0,
                    'page_size' => $pageSize,
                    'has_more' => false
                ]
            ];
        }
        
        // Count total cards across all columns
        $totalCards = 0;
        foreach ($boardData['columns'] as $column) {
            if (isset($column['cards']) && is_array($column['cards'])) {
                $totalCards += count($column['cards']);
            }
        }
        
        // If small board, return as-is
        if ($totalCards <= $pageSize) {
            return [
                'board_data' => $boardData,
                'pagination' => [
                    'current_page' => 1,
                    'total_pages' => 1,
                    'total_cards' => $totalCards,
                    'page_size' => $pageSize,
                    'has_more' => false
                ]
            ];
        }
        
        // Paginate cards
        $totalPages = ceil($totalCards / $pageSize);
        $currentPage = min($page, $totalPages);
        $offset = ($currentPage - 1) * $pageSize;
        
        $paginatedBoard = $boardData;
        $currentOffset = 0;
        
        foreach ($paginatedBoard['columns'] as &$column) {
            if (!isset($column['cards']) || !is_array($column['cards'])) {
                continue;
            }
            
            $columnCards = $column['cards'];
            $columnCardCount = count($columnCards);
            
            // Skip cards before offset
            if ($currentOffset + $columnCardCount <= $offset) {
                $column['cards'] = [];
                $currentOffset += $columnCardCount;
                continue;
            }
            
            // Determine slice range for this column
            $startInColumn = max(0, $offset - $currentOffset);
            $remainingQuota = $pageSize - ($currentOffset + $startInColumn - $offset);
            $endInColumn = min($columnCardCount, $startInColumn + $remainingQuota);
            
            $column['cards'] = array_slice($columnCards, $startInColumn, $endInColumn - $startInColumn);
            $currentOffset += $columnCardCount;
            
            // Stop if we've filled the page
            if ($endInColumn - $startInColumn >= $remainingQuota) {
                break;
            }
        }
        
        return [
            'board_data' => $paginatedBoard,
            'pagination' => [
                'current_page' => $currentPage,
                'total_pages' => $totalPages,
                'total_cards' => $totalCards,
                'page_size' => $pageSize,
                'has_more' => $currentPage < $totalPages
            ]
        ];
    }
    
    /**
     * Clear all caches
     */
    public function clearAllCaches() {
        $this->memoryCache = [];
        if ($this->config['enable_session_cache'] && isset($_SESSION['kanban_cache'])) {
            $_SESSION['kanban_cache'] = [];
        }
        
        $this->cacheStats = [
            'hits' => 0,
            'misses' => 0,
            'writes' => 0,
            'evictions' => 0
        ];
    }
    
    /**
     * Get cache statistics
     * 
     * @return array Cache performance statistics
     */
    public function getCacheStats() {
        $hitRate = $this->cacheStats['hits'] + $this->cacheStats['misses'] > 0 
            ? round($this->cacheStats['hits'] / ($this->cacheStats['hits'] + $this->cacheStats['misses']) * 100, 2)
            : 0;
            
        return array_merge($this->cacheStats, [
            'hit_rate' => $hitRate . '%',
            'memory_cache_size' => count($this->memoryCache),
            'session_cache_size' => isset($_SESSION['kanban_cache']) ? count($_SESSION['kanban_cache']) : 0
        ]);
    }
    
    // === PRIVATE HELPER METHODS ===
    
    /**
     * Generate cache key for ACL
     */
    private function getACLCacheKey($user, $pageId, $permission) {
        return 'acl_' . md5($user . '|' . $pageId . '|' . $permission);
    }
    
    /**
     * Clean expired ACL cache entries
     */
    private function cleanExpiredACLCache() {
        if (!isset($_SESSION['kanban_cache'])) {
            return;
        }
        
        $now = time();
        $cleaned = 0;
        
        foreach ($_SESSION['kanban_cache'] as $key => $entry) {
            if (strpos($key, 'acl_') === 0 && 
                isset($entry['timestamp']) && 
                isset($entry['ttl']) &&
                $now - $entry['timestamp'] > $entry['ttl']) {
                
                unset($_SESSION['kanban_cache'][$key]);
                $cleaned++;
            }
        }
        
        if ($cleaned > 0) {
            require_once(dirname(__FILE__) . '/KanbanErrorManager.php');
            KanbanErrorManager::logInfo("Cleaned $cleaned expired ACL cache entries");
        }
    }
    
    /**
     * Evict oldest cache entry when memory limit reached
     */
    private function evictOldestCache() {
        if (empty($this->memoryCache)) {
            return;
        }
        
        $oldestKey = null;
        $oldestTime = PHP_INT_MAX;
        
        foreach ($this->memoryCache as $key => $entry) {
            if ($entry['timestamp'] < $oldestTime) {
                $oldestTime = $entry['timestamp'];
                $oldestKey = $key;
            }
        }
        
        if ($oldestKey) {
            unset($this->memoryCache[$oldestKey]);
            $this->cacheStats['evictions']++;
        }
    }
    
    /**
     * Compress board data for storage efficiency
     */
    private function compressBoardData($boardData) {
        // Simple compression: remove unnecessary whitespace and compress JSON
        $json = json_encode($boardData, JSON_UNESCAPED_UNICODE);
        
        // Use gzip compression if available and data is large
        if (function_exists('gzcompress') && strlen($json) > 1024) {
            return [
                'compressed' => true,
                'data' => base64_encode(gzcompress($json, 6))
            ];
        }
        
        return [
            'compressed' => false,
            'data' => $json
        ];
    }
    
    /**
     * Decompress board data
     */
    private function decompressBoardData($compressedData) {
        if ($compressedData['compressed']) {
            $json = gzuncompress(base64_decode($compressedData['data']));
        } else {
            $json = $compressedData['data'];
        }
        
        return json_decode($json, true);
    }
}
