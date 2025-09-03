<?php
/**
 * Kanban AJAX Handler
 * Handles all AJAX requests and routing
 * 
 * @version 1.0.0
 * @date 2025-09-03
 */

use dokuwiki\Extension\Event;

class KanbanAjaxHandler
{
    private $dataManager;
    private $lockManager;
    private $cacheManager;
    
    public function __construct() {
        // Load required dependencies
        require_once(dirname(__FILE__) . '/KanbanDataManager.php');
        require_once(dirname(__FILE__) . '/KanbanLockManager.php');
        require_once(dirname(__FILE__) . '/KanbanAuthManager.php');
        require_once(dirname(__FILE__) . '/KanbanErrorManager.php');
        require_once(dirname(__FILE__) . '/KanbanCacheManager.php');
        
        $this->dataManager = new KanbanDataManager();
        $this->lockManager = new KanbanLockManager();
        $this->cacheManager = KanbanCacheManager::getInstance();
    }
    
    /**
     * Handle AJAX requests
     * 
     * @param Event $event DokuWiki event
     * @param mixed $param Event parameters
     */
    public function handleAjax($event, $param) {
        global $INPUT;
        
        $call = $INPUT->str('call');
        
        // Only handle calls for our plugin
        if ($call !== 'kanban') {
            return;
        }
        
        // Prevent other plugins from handling this call
        $event->preventDefault();
        $event->stopPropagation();
        
        $action = $INPUT->str('action');
        
        try {
            switch ($action) {
                case 'save_board':
                    $this->saveBoardData();
                    break;
                case 'load_board':
                    $this->loadBoardData();
                    break;
                case 'load_board_paginated':
                    $this->loadBoardDataPaginated();
                    break;
                case 'lock_board':
                    $this->lockBoard();
                    break;
                case 'unlock_board':
                    $this->unlockBoard();
                    break;
                case 'check_lock':
                    $this->checkBoardLock();
                    break;
                case 'renew_lock':
                    $this->renewLock();
                    break;
                case 'get_board_data':
                    $this->getBoardData();
                    break;
                case 'get_discussions':
                    $this->getCardDiscussions();
                    break;
                case 'save_discussions':
                    $this->saveCardDiscussions();
                    break;
                case 'get_cache_stats':
                    $this->getCacheStats();
                    break;
                case 'clear_cache':
                    $this->clearCache();
                    break;
                default:
                    KanbanErrorManager::sendResponse(false, 'Action non reconnue', [], 'UNKNOWN_ACTION', 400);
            }
        } catch (Exception $e) {
            KanbanErrorManager::logError('AJAX exception', [
                'action' => $action ?? 'unknown',
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            KanbanErrorManager::sendServerError($e->getMessage());
        }
        
        exit;
    }
    
    /**
     * Save kanban board data
     */
    private function saveBoardData() {
        global $INPUT;
        
        // SECURITY: Validate authentication before any write operation
        if (!KanbanAuthManager::isAuthenticated()) {
            KanbanErrorManager::logSecurity('Save operation denied - authentication failed');
            KanbanErrorManager::sendAuthError();
            return;
        }
        
        $boardId = $INPUT->str('board_id');
        $boardData = $INPUT->str('board_data');
        $changeType = $INPUT->str('change_type', 'modification');
        $pageId = $INPUT->str('id') ?: $INPUT->str('page_id');
        
        // SECURITY: Validate all required parameters
        if (empty($boardId) || empty($boardData) || empty($pageId)) {
            KanbanErrorManager::logSecurity('Save operation denied - missing required data', [
                'user' => KanbanAuthManager::getCurrentUser(),
                'has_board_id' => !empty($boardId),
                'has_board_data' => !empty($boardData),
                'has_page_id' => !empty($pageId)
            ]);
            KanbanErrorManager::sendValidationError('required_fields', 'board_id, board_data, page_id required');
            return;
        }
        
        // SECURITY: Validate page ID format
        if (!preg_match('/^[a-zA-Z0-9:_-]+$/', $pageId)) {
            KanbanErrorManager::logSecurity('Invalid page ID format', ['page_id' => $pageId]);
            KanbanErrorManager::sendValidationError('page_id', 'Invalid format');
            return;
        }
        
        // Parse board data
        $data = json_decode($boardData, true);
        if (!$data) {
            KanbanErrorManager::logWarning('Invalid JSON data in save operation', [
                'board_data' => substr($boardData, 0, 200) . '...' // Truncate for log
            ]);
            KanbanErrorManager::sendValidationError('board_data', 'Invalid JSON format');
            return;
        }
        
        // Use data manager to save
        if ($this->dataManager->saveBoardData($pageId, $boardId, $data, $changeType)) {
            KanbanErrorManager::sendResponse(true, 'Tableau sauvegardé avec versioning');
        } else {
            KanbanErrorManager::sendServerError('Save operation failed', 'Erreur lors de la sauvegarde');
        }
    }
    
    /**
     * Load kanban board data
     */
    private function loadBoardData() {
        global $INPUT;
        
        $pageId = $INPUT->str('page_id') ?: $INPUT->str('id');
        $boardId = $INPUT->str('board_id');
        
        if (empty($pageId)) {
            KanbanErrorManager::sendValidationError('page_id', 'Page ID required');
            return;
        }
        
        $data = $this->dataManager->loadBoardData($pageId, $boardId);
        
        if ($data !== false) {
            KanbanErrorManager::sendResponse(true, 'Données chargées', $data);
        } else {
            KanbanErrorManager::sendServerError('Load operation failed', 'Erreur lors du chargement');
        }
    }
    
    /**
     * Lock a kanban board for editing
     */
    private function lockBoard() {
        global $INPUT;
        
        // SECURITY: Validate authentication for lock operations
        if (!KanbanAuthManager::isAuthenticated()) {
            KanbanErrorManager::logSecurity('Lock operation denied - authentication failed');
            KanbanErrorManager::sendAuthError();
            return;
        }
        
        $pageId = $INPUT->str('page_id');
        
        // SECURITY: Validate page ID
        if (empty($pageId) || !preg_match('/^[a-zA-Z0-9:_-]+$/', $pageId)) {
            KanbanErrorManager::logSecurity('Invalid page ID for lock operation', ['page_id' => $pageId]);
            KanbanErrorManager::sendValidationError('page_id', 'Invalid page ID format');
            return;
        }
        
        // Get authenticated user
        $currentUser = KanbanAuthManager::getCurrentUser();
        if (!$currentUser) {
            KanbanErrorManager::logSecurity('Lock denied - no valid user');
            KanbanErrorManager::sendAuthError('Utilisateur non authentifié');
            return;
        }
        
        // SECURITY: Check write permissions using centralized auth manager
        if (!KanbanAuthManager::canEdit($pageId)) {
            KanbanErrorManager::logSecurity('Lock denied - insufficient edit permissions', [
                'page_id' => $pageId,
                'user' => $currentUser
            ]);
            KanbanErrorManager::sendAuthorizationError($pageId);
            return;
        }
        
        // Use atomic lock manager
        $result = $this->lockManager->acquireLock($pageId, $currentUser);
        
        if ($result['success']) {
            KanbanErrorManager::sendResponse(true, 'Board verrouillé pour édition', [
                'locked' => true,
                'locked_by' => $currentUser,
                'lock_type' => $result['lock_type'] ?? 'atomic',
                'expires_at' => $result['expires_at'] ?? null
            ]);
        } else {
            KanbanErrorManager::sendResponse(false, $result['error'], [
                'locked' => true
            ], 'LOCK_CONFLICT', 409);
        }
    }
    
    /**
     * Unlock a kanban board
     */
    private function unlockBoard() {
        global $INPUT;
        
        if (!KanbanAuthManager::isAuthenticated()) {
            KanbanErrorManager::sendAuthError();
            return;
        }
        
        $pageId = $INPUT->str('page_id');
        $currentUser = KanbanAuthManager::getCurrentUser();
        
        if (empty($pageId)) {
            KanbanErrorManager::sendValidationError('page_id', 'Page ID required');
            return;
        }
        
        $result = $this->lockManager->releaseLock($pageId, $currentUser);
        
        if ($result['success']) {
            KanbanErrorManager::sendResponse(true, 'Board déverrouillé', [
                'locked' => false
            ]);
        } else {
            KanbanErrorManager::sendResponse(false, $result['error'], [], 'UNLOCK_FAILED');
        }
    }
    
    /**
     * Check board lock status
     */
    private function checkBoardLock() {
        global $INPUT;
        
        $pageId = $INPUT->str('page_id');
        
        if (empty($pageId)) {
            KanbanErrorManager::sendValidationError('page_id', 'Page ID required');
            return;
        }
        
        $lockStatus = $this->lockManager->getLockStatus($pageId);
        KanbanErrorManager::sendResponse(true, 'Statut du verrou', $lockStatus);
    }
    
    /**
     * Renew lock for a board
     */
    private function renewLock() {
        global $INPUT;
        
        if (!KanbanAuthManager::isAuthenticated()) {
            KanbanErrorManager::sendAuthError();
            return;
        }
        
        $pageId = $INPUT->str('page_id');
        $currentUser = KanbanAuthManager::getCurrentUser();
        
        if (empty($pageId)) {
            KanbanErrorManager::sendValidationError('page_id', 'Page ID required');
            return;
        }
        
        $result = $this->lockManager->renewLock($pageId, $currentUser);
        
        if ($result['success']) {
            KanbanErrorManager::sendResponse(true, 'Verrou renouvelé', [
                'expires_at' => $result['expires_at'] ?? null
            ]);
        } else {
            KanbanErrorManager::sendResponse(false, $result['error'], [], 'RENEW_FAILED');
        }
    }
    
    /**
     * Get board data with lock information
     */
    private function getBoardData() {
        global $INPUT;
        
        $pageId = $INPUT->str('page_id') ?: $INPUT->str('id');
        
        if (empty($pageId)) {
            KanbanErrorManager::sendValidationError('page_id', 'Page ID required');
            return;
        }
        
        // Load board data
        $boardData = $this->dataManager->loadBoardData($pageId);
        
        if ($boardData === false) {
            KanbanErrorManager::sendServerError('Failed to load board data');
            return;
        }
        
        // Get lock status
        $lockStatus = $this->lockManager->getLockStatus($pageId);
        
        // Combine data
        $response = [
            'board_data' => $boardData,
            'lock_status' => $lockStatus
        ];
        
        KanbanErrorManager::sendResponse(true, 'Données du tableau', $response);
    }
    
    /**
     * Get card discussions (placeholder)
     */
    private function getCardDiscussions() {
        // TODO: Implement card discussions functionality
        KanbanErrorManager::sendResponse(true, 'Discussions récupérées', [
            'discussions' => []
        ]);
    }
    
    /**
     * Save card discussions (placeholder)
     */
    private function saveCardDiscussions() {
        // TODO: Implement card discussions functionality
        KanbanErrorManager::sendResponse(true, 'Discussions sauvegardées');
    }
    
    /**
     * Load board data with pagination
     */
    private function loadBoardDataPaginated() {
        global $INPUT;
        
        $pageId = $INPUT->str('page_id');
        $page = max(1, $INPUT->int('page', 1));
        $pageSize = max(10, min(100, $INPUT->int('page_size', 50))); // Min 10, max 100
        
        if (empty($pageId)) {
            KanbanErrorManager::sendResponse(false, 'Page ID manquant', [], 'MISSING_PAGE_ID', 400);
            return;
        }
        
        // Check permissions
        if (!KanbanAuthManager::canRead($pageId)) {
            KanbanErrorManager::sendResponse(false, 'Permission refusée', [], 'ACCESS_DENIED', 403);
            return;
        }
        
        // Load board data
        $boardData = $this->dataManager->loadBoardData($pageId);
        
        if ($boardData === false) {
            KanbanErrorManager::sendServerError('Failed to load board data');
            return;
        }
        
        // Apply pagination
        $paginatedResult = $this->cacheManager->paginateBoardData($boardData, $page, $pageSize);
        
        // Get lock status
        $lockStatus = $this->lockManager->getLockStatus($pageId);
        
        // Combine data
        $response = [
            'board_data' => $paginatedResult['board_data'],
            'pagination' => $paginatedResult['pagination'],
            'lock_status' => $lockStatus
        ];
        
        KanbanErrorManager::sendResponse(true, 'Données paginées du tableau', $response);
    }
    
    /**
     * Get cache statistics
     */
    private function getCacheStats() {
        // Check if user has admin permissions (basic security)
        global $INFO;
        if (!isset($INFO['isadmin']) || !$INFO['isadmin']) {
            KanbanErrorManager::sendResponse(false, 'Permission refusée - Admin requis', [], 'ADMIN_REQUIRED', 403);
            return;
        }
        
        $stats = $this->cacheManager->getCacheStats();
        KanbanErrorManager::sendResponse(true, 'Statistiques du cache', $stats);
    }
    
    /**
     * Clear all caches
     */
    private function clearCache() {
        global $INFO;
        
        // Check if user has admin permissions
        if (!isset($INFO['isadmin']) || !$INFO['isadmin']) {
            KanbanErrorManager::sendResponse(false, 'Permission refusée - Admin requis', [], 'ADMIN_REQUIRED', 403);
            return;
        }
        
        $this->cacheManager->clearAllCaches();
        KanbanErrorManager::sendResponse(true, 'Cache vidé avec succès');
    }
}
