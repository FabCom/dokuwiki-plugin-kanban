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
                case 'force_unlock':
                    $this->forceUnlockBoard();
                    break;
                case 'get_templates':
                    $this->getTemplates();
                    break;
                case 'create_empty_board':
                    $this->createEmptyBoard();
                    break;
                case 'create_board_from_template':
                    $this->createBoardFromTemplate();
                    break;
                case 'export_csv':
                    $this->exportToCSV();
                    break;
                case 'export_json':
                    $this->exportToJSON();
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
            $errorMessage = $result['error'] ?? 'Erreur de verrouillage inconnue';
            KanbanErrorManager::logWarning('Lock acquisition failed', [
                'page_id' => $pageId,
                'user' => $currentUser,
                'result' => $result
            ]);
            
            KanbanErrorManager::sendResponse(false, $errorMessage, [
                'locked' => true,
                'locked_by' => $result['locked_by'] ?? null
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
     * Get card discussions
     */
    private function getCardDiscussions() {
        global $INPUT;
        
        $pageId = $INPUT->str('id');
        
        if (empty($pageId)) {
            KanbanErrorManager::sendValidationError('id', 'Discussion page ID required');
            return;
        }
        
        // Check if page exists and get content
        if (!page_exists($pageId)) {
            // Return empty discussions if page doesn't exist yet
            KanbanErrorManager::sendResponse(true, 'Discussions récupérées', [
                'discussions' => []
            ]);
            return;
        }
        
        // Get page content
        $pageContent = rawWiki($pageId);
        
        try {
            // Parse JSON content
            $discussions = [];
            if (!empty($pageContent)) {
                $decoded = json_decode($pageContent, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    // Le format stocké contient {messages: [...]} - extraire les messages
                    if (isset($decoded['messages']) && is_array($decoded['messages'])) {
                        $discussions = $decoded['messages'];
                    } else if (is_array($decoded)) {
                        // Ancien format : tableau direct
                        $discussions = $decoded;
                    }
                }
            }
            
            KanbanErrorManager::sendResponse(true, 'Discussions récupérées', [
                'discussions' => $discussions
            ]);
            
        } catch (Exception $e) {
            KanbanErrorManager::logError('Error loading discussions', [
                'page_id' => $pageId,
                'error' => $e->getMessage()
            ]);
            KanbanErrorManager::sendServerError('Erreur lors du chargement des discussions');
        }
    }
    
    /**
     * Save card discussions
     */
    private function saveCardDiscussions() {
        global $INPUT;
        
        $pageId = $INPUT->str('id');
        $data = $INPUT->str('data');
        
        if (empty($pageId)) {
            KanbanErrorManager::sendValidationError('id', 'Discussion page ID required');
            return;
        }
        
        if (empty($data)) {
            KanbanErrorManager::sendValidationError('data', 'Discussion data required');
            return;
        }
        
        // Check permissions - use canEdit instead of canWrite
        if (!KanbanAuthManager::canEdit($pageId)) {
            KanbanErrorManager::sendResponse(false, 'Permission refusée', [], 'ACCESS_DENIED', 403);
            return;
        }
        
        try {
            // Validate JSON data
            $inputData = json_decode($data, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                KanbanErrorManager::sendValidationError('data', 'Invalid JSON format');
                return;
            }
            
            // Le format attendu est celui généré par le JavaScript : 
            // {cardId: '', pageId: '', lastUpdate: '', messages: [...]}
            if (isset($inputData['messages']) && is_array($inputData['messages'])) {
                // Format complet avec métadonnées
                $discussionData = $inputData;
            } else if (is_array($inputData)) {
                // Format ancien : tableau direct de messages - créer la structure complète
                $discussionData = [
                    'cardId' => basename($pageId), // Extraire l'ID de la carte du nom de page
                    'pageId' => str_replace('discussion:', '', str_replace(':card_', ':', $pageId)),
                    'lastUpdate' => date('c'),
                    'messages' => $inputData,
                    'lastSavedBy' => KanbanAuthManager::getCurrentUser(),
                    'lastSavedAt' => date('c')
                ];
            } else {
                KanbanErrorManager::sendValidationError('data', 'Invalid data format');
                return;
            }
            
            // Save to DokuWiki page
            $summary = 'Mise à jour des discussions de carte';
            
            // Use DokuWiki's saveWikiText function - it doesn't return a value
            saveWikiText($pageId, json_encode($discussionData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), $summary);
            
            // Check if the save was successful by verifying the page exists and has content
            if (page_exists($pageId)) {
                KanbanErrorManager::sendResponse(true, 'Discussions sauvegardées');
            } else {
                KanbanErrorManager::sendServerError('Erreur lors de la sauvegarde des discussions');
            }
            
        } catch (Exception $e) {
            KanbanErrorManager::logError('Error saving discussions', [
                'page_id' => $pageId,
                'error' => $e->getMessage()
            ]);
            KanbanErrorManager::sendServerError('Erreur lors de la sauvegarde des discussions');
        }
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
    
    /**
     * Force unlock a board (admin function)
     */
    private function forceUnlockBoard() {
        global $INPUT, $INFO;
        
        // Check if user has admin permissions
        if (!isset($INFO['isadmin']) || !$INFO['isadmin']) {
            KanbanErrorManager::sendResponse(false, 'Permission refusée - Admin requis', [], 'ADMIN_REQUIRED', 403);
            return;
        }
        
        $pageId = $INPUT->str('page_id');
        
        if (empty($pageId)) {
            KanbanErrorManager::sendValidationError('page_id', 'Page ID required for force unlock');
            return;
        }
        
        $adminUser = KanbanAuthManager::getCurrentUser();
        $result = $this->lockManager->forceReleaseLock($pageId, $adminUser);
        
        if ($result['success']) {
            KanbanErrorManager::sendResponse(true, $result['message'], [
                'previous_owner' => $result['previous_owner'] ?? null
            ]);
        } else {
            KanbanErrorManager::sendResponse(false, $result['error'], [], 'FORCE_UNLOCK_FAILED', 500);
        }
    }
    
    /**
     * Get available templates
     */
    private function getTemplates() {
        require_once(dirname(__FILE__) . '/KanbanTemplateManager.php');
        
        try {
            $templates = KanbanTemplateManager::getAvailableTemplates();
            $categories = KanbanTemplateManager::getTemplateCategories();
            
            KanbanErrorManager::sendResponse(true, 'Templates loaded successfully', [
                'templates' => $templates,
                'categories' => $categories
            ]);
        } catch (Exception $e) {
            KanbanErrorManager::logError('Template loading failed', [
                'error' => $e->getMessage()
            ]);
            KanbanErrorManager::sendServerError('Failed to load templates');
        }
    }
    
    /**
     * Create empty board
     */
    private function createEmptyBoard() {
        global $INPUT;
        
        // SECURITY: Validate authentication
        if (!KanbanAuthManager::isAuthenticated()) {
            KanbanErrorManager::logSecurity('Empty board creation denied - authentication failed');
            KanbanErrorManager::sendAuthError();
            return;
        }
        
        $pageId = $INPUT->str('page');
        
        if (empty($pageId)) {
            KanbanErrorManager::sendValidationError('page', 'Page ID required');
            return;
        }
        
        // SECURITY: Validate page ID format
        if (!preg_match('/^[a-zA-Z0-9:_-]+$/', $pageId)) {
            KanbanErrorManager::logSecurity('Invalid page ID format for empty board', ['page_id' => $pageId]);
            KanbanErrorManager::sendValidationError('page', 'Invalid format');
            return;
        }
        
        try {
            // Create basic empty board structure
            $boardData = [
                'board_id' => 'board_' . time() . '_' . uniqid(),
                'title' => 'Nouveau tableau',
                'description' => '',
                'created_at' => date('c'),
                'created_by' => KanbanAuthManager::getCurrentUser(),
                'columns' => [
                    [
                        'id' => 'col_todo_' . time(),
                        'title' => '📋 À faire',
                        'color' => '#fff3cd',
                        'wip_limit' => null,
                        'cards' => []
                    ],
                    [
                        'id' => 'col_progress_' . time(),
                        'title' => '🏃 En cours',
                        'color' => '#d1ecf1',
                        'wip_limit' => 3,
                        'cards' => []
                    ],
                    [
                        'id' => 'col_done_' . time(),
                        'title' => '✅ Terminé',
                        'color' => '#d4edda',
                        'wip_limit' => null,
                        'cards' => []
                    ]
                ]
            ];
            
            // Save board data
            $success = $this->dataManager->saveBoardData($pageId, $boardData['board_id'], $boardData, 'creation');
            
            if ($success) {
                // Clear cache
                $this->cacheManager->clearAllCaches();
                
                KanbanErrorManager::sendResponse(true, 'Empty board created successfully', [
                    'board_id' => $boardData['board_id']
                ]);
            } else {
                KanbanErrorManager::sendResponse(false, 'Failed to create empty board', [], 'SAVE_FAILED', 500);
            }
        } catch (Exception $e) {
            KanbanErrorManager::logError('Empty board creation failed', [
                'page_id' => $pageId,
                'error' => $e->getMessage()
            ]);
            KanbanErrorManager::sendServerError('Failed to create empty board');
        }
    }
    
    /**
     * Create board from template
     */
    private function createBoardFromTemplate() {
        global $INPUT;
        
        // SECURITY: Validate authentication
        if (!KanbanAuthManager::isAuthenticated()) {
            KanbanErrorManager::logSecurity('Template board creation denied - authentication failed');
            KanbanErrorManager::sendAuthError();
            return;
        }
        
        $pageId = $INPUT->str('page');
        $templateId = $INPUT->str('template_id');
        
        if (empty($pageId) || empty($templateId)) {
            KanbanErrorManager::sendValidationError('required_fields', 'Page and template_id required');
            return;
        }
        
        // SECURITY: Validate page ID format
        if (!preg_match('/^[a-zA-Z0-9:_-]+$/', $pageId)) {
            KanbanErrorManager::logSecurity('Invalid page ID format for template board', ['page_id' => $pageId]);
            KanbanErrorManager::sendValidationError('page', 'Invalid format');
            return;
        }
        
        // SECURITY: Validate template ID format
        if (!preg_match('/^[a-z0-9_-]+$/', $templateId)) {
            KanbanErrorManager::logSecurity('Invalid template ID format', ['template_id' => $templateId]);
            KanbanErrorManager::sendValidationError('template_id', 'Invalid format');
            return;
        }
        
        try {
            require_once(dirname(__FILE__) . '/KanbanTemplateManager.php');
            
            // Create board from template
            $boardData = KanbanTemplateManager::createBoardFromTemplate($templateId, $pageId);
            
            if (!$boardData) {
                KanbanErrorManager::sendValidationError('template_id', 'Template not found');
                return;
            }
            
            // Add creation metadata
            $boardData['created_by'] = KanbanAuthManager::getCurrentUser();
            
            // Save board data
            $success = $this->dataManager->saveBoardData($pageId, $boardData['board_id'], $boardData, 'creation');
            
            if ($success) {
                // Clear cache
                $this->cacheManager->clearAllCaches();
                
                KanbanErrorManager::sendResponse(true, 'Board created from template successfully', [
                    'board_id' => $boardData['board_id'],
                    'template_id' => $templateId,
                    'template_name' => $boardData['title']
                ]);
            } else {
                KanbanErrorManager::sendResponse(false, 'Failed to create board from template', [], 'SAVE_FAILED', 500);
            }
        } catch (Exception $e) {
            KanbanErrorManager::logError('Template board creation failed', [
                'page_id' => $pageId,
                'template_id' => $templateId,
                'error' => $e->getMessage()
            ]);
            KanbanErrorManager::sendServerError('Failed to create board from template');
        }
    }
    
    /**
     * Export kanban board to CSV
     */
    private function exportToCSV() {
        global $INPUT, $ID;
        
        // Load export manager
        require_once(dirname(__FILE__) . '/KanbanExportManager.php');
        
        $boardId = $INPUT->str('board_id');
        $pageId = $INPUT->str('id') ?: $ID;
        
        if (!$boardId) {
            KanbanErrorManager::sendResponse(false, 'ID de tableau manquant', [], 'MISSING_BOARD_ID', 400);
            return;
        }
        
        // Vérification des permissions de lecture
        if (auth_quickaclcheck($pageId) < AUTH_READ) {
            KanbanErrorManager::sendResponse(false, 'Permissions insuffisantes', [], 'INSUFFICIENT_PERMISSIONS', 403);
            return;
        }
        
        try {
            // Chargement des données du tableau avec pageId
            $boardData = $this->dataManager->loadBoardData($pageId, null);
            
            KanbanErrorManager::logInfo('CSV export - Board data loaded', [
                'board_id' => $boardId,
                'page_id' => $pageId,
                'board_data_exists' => $boardData ? 'yes' : 'no',
                'board_data_structure' => $boardData ? array_keys($boardData) : 'null'
            ]);
            
            if (!$boardData) {
                KanbanErrorManager::sendResponse(false, 'Tableau non trouvé', [], 'BOARD_NOT_FOUND', 404);
                return;
            }
            
            // Utiliser directement les données du kanban sans formatage supplémentaire
            $exportData = [
                'title' => $boardData['title'] ?? 'Kanban Board',
                'columns' => $boardData['columns'] ?? []
            ];
            
            KanbanErrorManager::logInfo('CSV export - Using direct data', [
                'board_id' => $boardId,
                'columns_count' => count($exportData['columns']),
                'total_cards' => array_sum(array_map(function($col) {
                    return count($col['cards'] ?? []);
                }, $exportData['columns']))
            ]);
            
            if (empty($exportData['columns'])) {
                KanbanErrorManager::sendResponse(false, 'Aucune colonne trouvée pour l\'export', [], 'NO_COLUMNS', 404);
                return;
            }
            
            // Génération et envoi du CSV
            KanbanExportManager::exportToCSV($boardId, $exportData);
            
        } catch (Exception $e) {
            KanbanErrorManager::logError('CSV export failed', [
                'board_id' => $boardId,
                'page_id' => $pageId,
                'error' => $e->getMessage()
            ]);
            KanbanErrorManager::sendServerError('Erreur lors de l\'export CSV');
        }
    }
    
    /**
     * Export kanban board to JSON format
     */
    private function exportToJSON() {
        global $INPUT;
        
        $boardId = $INPUT->str('board_id');
        $pageId = $INPUT->str('id') ?: $INPUT->str('page_id');
        
        // SECURITY: Validate required parameters
        if (empty($boardId) || empty($pageId)) {
            KanbanErrorManager::sendValidationError('required_fields', 'board_id and page_id required');
            return;
        }
        
        // SECURITY: Check read permissions
        if (!KanbanAuthManager::canRead($pageId)) {
            KanbanErrorManager::logSecurity('JSON export denied - no read permission', [
                'page_id' => $pageId,
                'user' => KanbanAuthManager::getCurrentUser()
            ]);
            KanbanErrorManager::sendResponse(false, 'Permission denied', [], 'PERMISSION_DENIED', 403);
            return;
        }
        
        try {
            // Charger les données du board
            $boardData = $this->dataManager->loadBoardData($pageId, $boardId);
            
            KanbanErrorManager::logInfo('JSON export - Board data loaded', [
                'board_id' => $boardId,
                'page_id' => $pageId,
                'board_data_exists' => $boardData ? 'yes' : 'no',
                'board_data_structure' => $boardData ? array_keys($boardData) : 'null'
            ]);
            
            if (!$boardData) {
                KanbanErrorManager::sendResponse(false, 'Tableau non trouvé', [], 'BOARD_NOT_FOUND', 404);
                return;
            }
            
            // Utiliser directement les données du kanban comme pour le CSV
            $exportData = [
                'title' => $boardData['title'] ?? 'Kanban Board',
                'columns' => $boardData['columns'] ?? []
            ];
            
            KanbanErrorManager::logInfo('JSON export - Using direct data', [
                'board_id' => $boardId,
                'columns_count' => count($exportData['columns']),
                'total_cards' => array_sum(array_map(function($col) {
                    return count($col['cards'] ?? []);
                }, $exportData['columns']))
            ]);
            
            if (empty($exportData['columns'])) {
                KanbanErrorManager::sendResponse(false, 'Aucune colonne trouvée pour l\'export', [], 'NO_COLUMNS', 404);
                return;
            }
            
            // Load export manager and export to JSON
            require_once(dirname(__FILE__) . '/KanbanExportManager.php');
            
            // Génération et envoi du JSON
            KanbanExportManager::exportToJSON($boardId, $exportData, $pageId);
            
        } catch (Exception $e) {
            KanbanErrorManager::logError('JSON export failed', [
                'board_id' => $boardId,
                'page_id' => $pageId,
                'error' => $e->getMessage()
            ]);
            KanbanErrorManager::sendServerError('Erreur lors de l\'export JSON');
        }
    }

    /**
     * Formate les données pour l'export
     */
    private function formatDataForExport($boardData, $boardId) {
        KanbanErrorManager::logInfo('formatDataForExport called', [
            'board_id' => $boardId,
            'board_data_exists' => $boardData ? 'yes' : 'no',
            'board_data_type' => gettype($boardData),
            'board_data_structure' => is_array($boardData) ? 'array with ' . count($boardData) . ' items' : 'not_array'
        ]);
        
        // Les données kanban sont directement un tableau de colonnes
        if (!$boardData || !is_array($boardData)) {
            KanbanErrorManager::logInfo('formatDataForExport - Invalid board data', [
                'board_data_exists' => $boardData ? 'yes' : 'no',
                'is_array' => is_array($boardData) ? 'yes' : 'no'
            ]);
            return null;
        }
        
        // Formater les données pour l'export - pas besoin de chercher un board spécifique
        $exportData = [
            'title' => 'Kanban Board',
            'columns' => []
        ];
        
        // Les données sont directement les colonnes
        foreach ($boardData as $column) {
            if (!isset($column['id'])) continue;
            
            $formattedColumn = [
                'id' => $column['id'] ?? '',
                'title' => $column['title'] ?? 'Colonne',
                'cards' => []
            ];
            
            if (isset($column['cards']) && is_array($column['cards'])) {
                KanbanErrorManager::logInfo('Processing column cards', [
                    'column_id' => $column['id'],
                    'column_title' => $column['title'],
                    'cards_count' => count($column['cards'])
                ]);
                
                foreach ($column['cards'] as $cardIndex => $card) {
                    KanbanErrorManager::logInfo('Processing card', [
                        'column_id' => $column['id'],
                        'card_index' => $cardIndex,
                        'card_data' => $card
                    ]);
                    
                    $formattedCard = [
                        'id' => $card['id'] ?? 'card_' . $cardIndex,
                        'title' => $card['title'] ?? $card['name'] ?? 'Carte sans titre',
                        'content' => $card['description'] ?? $card['content'] ?? '',
                        'priority' => $card['priority'] ?? '',
                        'assignee' => $card['assignee'] ?? '',
                        'due_date' => $card['dueDate'] ?? $card['due_date'] ?? '',
                        'tags' => $card['tags'] ?? [],
                        'created_date' => $card['created'] ?? $card['created_date'] ?? '',
                        'creator' => $card['creator'] ?? $card['createdBy'] ?? '',
                        'modified_date' => $card['lastModified'] ?? $card['modified_date'] ?? '',
                        'internal_links' => $this->extractInternalLinksFromCard($card),
                        'external_links' => $this->extractExternalLinksFromCard($card),
                        'media_links' => $this->extractMediaLinksFromCard($card)
                    ];
                    
                    $formattedColumn['cards'][] = $formattedCard;
                }
            }
            
            $exportData['columns'][] = $formattedColumn;
        }
        
        KanbanErrorManager::logInfo('formatDataForExport - Export data formatted', [
            'columns_count' => count($exportData['columns']),
            'total_cards' => array_sum(array_map(function($col) {
                return count($col['cards'] ?? []);
            }, $exportData['columns']))
        ]);
        
        return $exportData;
    }
    
    /**
     * Extrait les liens internes du contenu
     */
    private function extractInternalLinks($content) {
        $links = [];
        if (preg_match_all('/\[\[([^\]]+)\]\]/', $content, $matches)) {
            $links = $matches[1];
        }
        return $links;
    }
    
    /**
     * Extrait les liens externes du contenu
     */
    private function extractExternalLinks($content) {
        $links = [];
        if (preg_match_all('/https?:\/\/[^\s\]]+/', $content, $matches)) {
            $links = $matches[0];
        }
        return $links;
    }
    
    /**
     * Extrait les liens media du contenu
     */
    private function extractMediaLinks($content) {
        $links = [];
        if (preg_match_all('/\{\{([^\}]+)\}\}/', $content, $matches)) {
            $links = $matches[1];
        }
        return $links;
    }
    
    /**
     * Extrait les liens internes d'une carte (depuis la structure de données)
     */
    private function extractInternalLinksFromCard($card) {
        $links = [];
        
        // Liens depuis la structure de données
        if (isset($card['internalLinks']) && is_array($card['internalLinks'])) {
            foreach ($card['internalLinks'] as $link) {
                $links[] = $link['target'] ?? $link['text'] ?? '';
            }
        }
        
        // Liens depuis la description
        if (isset($card['description'])) {
            $contentLinks = $this->extractInternalLinks($card['description']);
            $links = array_merge($links, $contentLinks);
        }
        
        return array_unique(array_filter($links));
    }
    
    /**
     * Extrait les liens externes d'une carte (depuis la structure de données)
     */
    private function extractExternalLinksFromCard($card) {
        $links = [];
        
        // Liens depuis la structure de données
        if (isset($card['externalLinks']) && is_array($card['externalLinks'])) {
            foreach ($card['externalLinks'] as $link) {
                $links[] = $link['url'] ?? '';
            }
        }
        
        // Liens depuis la description
        if (isset($card['description'])) {
            $contentLinks = $this->extractExternalLinks($card['description']);
            $links = array_merge($links, $contentLinks);
        }
        
        return array_unique(array_filter($links));
    }
    
    /**
     * Extrait les liens media d'une carte (depuis la structure de données)
     */
    private function extractMediaLinksFromCard($card) {
        $links = [];
        
        // Médias depuis la structure de données
        if (isset($card['media']) && is_array($card['media'])) {
            foreach ($card['media'] as $media) {
                $links[] = $media['name'] ?? $media['id'] ?? '';
            }
        }
        
        // Liens depuis la description
        if (isset($card['description'])) {
            $contentLinks = $this->extractMediaLinks($card['description']);
            $links = array_merge($links, $contentLinks);
        }
        
        return array_unique(array_filter($links));
    }
}
