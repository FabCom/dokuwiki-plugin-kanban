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
        
        // DEBUG: Log TOUTES les requêtes AJAX (même celles d'autres plugins)
        if ($call === 'kanban') {
            KanbanErrorManager::logInfo('AJAX Request for Kanban received', [
                'call' => $call,
                'action' => $INPUT->str('action'),
                'method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
                'referer' => $_SERVER['HTTP_REFERER'] ?? 'unknown'
            ]);
        }
        
        // Only handle calls for our plugin
        if ($call !== 'kanban') {
            return;
        }
        
        // Prevent other plugins from handling this call
        $event->preventDefault();
        $event->stopPropagation();
        
        $action = $INPUT->str('action');
        
        // DEBUG: Log toutes les requêtes AJAX
        KanbanErrorManager::logInfo('AJAX Request received', [
            'call' => $call,
            'action' => $action,
            'method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown',
            'all_post_keys' => array_keys($_POST),
            'all_get_keys' => array_keys($_GET),
            'user' => KanbanAuthManager::getCurrentUser()
        ]);
        
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
                case 'import_json':
                    $this->importFromJSON();
                    break;
                case 'import_board':
                    $this->importFromJSON(); // Alias pour import_json
                    break;
                case 'delete_media':
                    $this->deleteMediaFile();
                    break;
                case 'move_to_trash':
                    $this->moveMediaToTrash();
                    break;
                case 'restore_from_trash':
                    $this->restoreMediaFromTrash();
                    break;
                case 'delete_permanent':
                    $this->deleteMediaPermanently();
                    break;
                case 'list_trash':
                    $this->listTrashContents();
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
     * Import kanban data from JSON format
     */
    private function importFromJSON() {
        global $INPUT;
        
        $pageId = $INPUT->str('id') ?: $INPUT->str('page_id');
        $jsonData = $INPUT->str('json_data');
        $importMode = $INPUT->str('import_mode', 'merge'); // merge, replace, append
        $targetColumn = $INPUT->str('target_column'); // Pour import de carte seule
        
        // DEBUG: Log all received parameters
        KanbanErrorManager::logInfo('importFromJSON called', [
            'page_id' => $pageId,
            'json_data_length' => strlen($jsonData ?: ''),
            'import_mode' => $importMode,
            'target_column' => $targetColumn,
            'all_params' => $INPUT->arr(''),
            'user' => KanbanAuthManager::getCurrentUser()
        ]);
        
        // SECURITY: Validate authentication
        if (!KanbanAuthManager::isAuthenticated()) {
            KanbanErrorManager::logSecurity('JSON import denied - authentication failed');
            KanbanErrorManager::sendAuthError();
            return;
        }
        
        // SECURITY: Check edit permissions
        if (!KanbanAuthManager::canEdit($pageId)) {
            KanbanErrorManager::logSecurity('JSON import denied - no edit permission', [
                'page_id' => $pageId,
                'user' => KanbanAuthManager::getCurrentUser()
            ]);
            KanbanErrorManager::sendResponse(false, 'Permission denied', [], 'PERMISSION_DENIED', 403);
            return;
        }
        
        // SECURITY: Validate required parameters
        if (empty($pageId) || empty($jsonData)) {
            KanbanErrorManager::logError('importFromJSON - missing required parameters', [
                'page_id_empty' => empty($pageId),
                'json_data_empty' => empty($jsonData),
                'page_id_value' => $pageId,
                'json_data_length' => strlen($jsonData ?: '')
            ]);
            KanbanErrorManager::sendValidationError('required_fields', 'page_id and json_data required');
            return;
        }
        
        try {
            // Load export manager and import from JSON
            require_once(dirname(__FILE__) . '/KanbanExportManager.php');
            
            // Préparer les options d'import
            $importOptions = [
                'target_column' => $targetColumn
            ];
            
            $result = KanbanExportManager::importFromJSON($jsonData, $pageId, $importMode, $importOptions);
            
            if ($result['success']) {
                // Clear cache after successful import
                if ($this->cacheManager) {
                    $this->cacheManager->clearAllCaches();
                }
                
                KanbanErrorManager::logInfo('JSON import successful', [
                    'page_id' => $pageId,
                    'import_mode' => $importMode,
                    'stats' => $result['stats'] ?? []
                ]);
                
                KanbanErrorManager::sendResponse(true, $result['message'], [
                    'stats' => $result['stats'] ?? [],
                    'import_mode' => $importMode
                ]);
            } else {
                KanbanErrorManager::sendResponse(false, $result['error'], [
                    'details' => $result['details'] ?? []
                ], 'IMPORT_ERROR', 400);
            }
            
        } catch (Exception $e) {
            KanbanErrorManager::logError('JSON import failed', [
                'page_id' => $pageId,
                'import_mode' => $importMode,
                'error' => $e->getMessage()
            ]);
            KanbanErrorManager::sendServerError('Erreur lors de l\'import JSON');
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
    
    /**
     * Supprime un fichier média
     */
    private function deleteMediaFile() {
        global $INPUT;
        
        // Vérification de l'authentification
        if (!KanbanAuthManager::isAuthenticated()) {
            KanbanErrorManager::logSecurity('Delete media operation denied - authentication failed');
            KanbanErrorManager::sendAuthError();
            return;
        }
        
        $mediaId = $INPUT->str('media_id');
        
        if (empty($mediaId)) {
            KanbanErrorManager::sendResponse(false, 'ID de média manquant', [], 'MISSING_MEDIA_ID', 400);
            return;
        }
        
        // Décoder l'ID média pour obtenir le chemin réel
        $mediaPath = base64_decode($mediaId);
        
        // Vérification de sécurité: le fichier doit être dans le répertoire data/media
        $mediaRoot = DOKU_INC . 'data/media/';
        $fullPath = $mediaRoot . $mediaPath;
        
        // Sécurité: vérifier que le chemin est bien dans le répertoire média autorisé
        $realPath = realpath($fullPath);
        $realMediaRoot = realpath($mediaRoot);
        
        if ($realPath === false || strpos($realPath, $realMediaRoot) !== 0) {
            KanbanErrorManager::logSecurity('Delete media denied - invalid path', [
                'media_id' => $mediaId,
                'media_path' => $mediaPath,
                'user' => KanbanAuthManager::getCurrentUser()
            ]);
            KanbanErrorManager::sendResponse(false, 'Chemin de fichier non autorisé', [], 'INVALID_PATH', 403);
            return;
        }
        
        // Vérifier les permissions sur le média
        if (!KanbanAuthManager::canDelete($mediaPath)) {
            KanbanErrorManager::logSecurity('Delete media denied - insufficient permissions', [
                'media_id' => $mediaId,
                'media_path' => $mediaPath,
                'user' => KanbanAuthManager::getCurrentUser()
            ]);
            KanbanErrorManager::sendResponse(false, 'Permissions insuffisantes pour supprimer ce fichier', [], 'ACCESS_DENIED', 403);
            return;
        }
        
        // Vérifier que le fichier existe
        if (!file_exists($fullPath)) {
            KanbanErrorManager::sendResponse(false, 'Fichier non trouvé', [], 'FILE_NOT_FOUND', 404);
            return;
        }
        
        // Tentative de suppression
        try {
            // Supprimer le fichier
            $result = unlink($fullPath);
            
            if ($result) {
                // Nettoyer le cache
                $this->cacheManager->clearAllCaches();
                
                // Log de l'action
                KanbanErrorManager::logInfo('Média supprimé avec succès', [
                    'media_id' => $mediaId,
                    'media_path' => $mediaPath,
                    'user' => KanbanAuthManager::getCurrentUser()
                ]);
                
                KanbanErrorManager::sendResponse(true, 'Fichier supprimé avec succès', [
                    'media_id' => $mediaId
                ]);
            } else {
                KanbanErrorManager::sendResponse(false, 'Impossible de supprimer le fichier', [], 'DELETE_FAILED', 500);
            }
            
        } catch (Exception $e) {
            KanbanErrorManager::logError('Erreur lors de la suppression du média', [
                'media_id' => $mediaId,
                'error' => $e->getMessage(),
                'user' => KanbanAuthManager::getCurrentUser()
            ]);
            
            KanbanErrorManager::sendResponse(false, 'Erreur lors de la suppression: ' . $e->getMessage(), [], 'DELETE_ERROR', 500);
        }
    }
    
    /**
     * Déplace un fichier média vers la corbeille
     */
    private function moveMediaToTrash() {
        global $INPUT;
        
        // Buffer any unexpected output
        ob_start();
        
        try {
            // DEBUG: Log entry
            KanbanErrorManager::logInfo('moveMediaToTrash called', [
                'media_id' => $INPUT->str('media_id'),
                'media_namespace' => $INPUT->str('media_namespace'),
                'media_filename' => $INPUT->str('media_filename')
            ]);
            
            if (!KanbanAuthManager::isAuthenticated()) {
                KanbanErrorManager::logSecurity('Move to trash operation denied - authentication failed');
                ob_end_clean(); // Clear any output
                KanbanErrorManager::sendAuthError();
                return;
            }
            
            $mediaId = $INPUT->str('media_id');
            $mediaNamespace = $INPUT->str('media_namespace', '');
            $mediaFilename = $INPUT->str('media_filename');
            
            if (empty($mediaId) || empty($mediaFilename)) {
                ob_end_clean();
                KanbanErrorManager::sendResponse(false, 'Paramètres manquants', [], 'MISSING_PARAMS', 400);
                return;
            }
            
            // Décoder le média ID (format: namespace:filename)
            $sourceMediaId = base64_decode($mediaId);
            $sourceFile = mediaFN($sourceMediaId);
            
            // Extraire namespace et filename
            $parts = explode(':', $sourceMediaId);
            $sourceNs = count($parts) > 1 ? implode(':', array_slice($parts, 0, -1)) : '';
            $fileName = array_pop($parts);
            
            KanbanErrorManager::logInfo('Processing move to trash', [
                'sourceMediaId' => $sourceMediaId,
                'sourceFile' => $sourceFile,
                'sourceNs' => $sourceNs,
                'fileName' => $fileName
            ]);
            
            // Vérifications de sécurité
            if (!file_exists($sourceFile)) {
                ob_end_clean();
                KanbanErrorManager::sendResponse(false, 'Fichier source non trouvé', [], 'FILE_NOT_FOUND', 404);
                return;
            }
            
            // Créer le namespace de corbeille s'il n'existe pas (comme QuillJS)
            $trashNs = 'corbeille';
            $trashDir = mediaFN($trashNs . ':dummy');
            $trashDir = dirname($trashDir);
            if (!is_dir($trashDir)) {
                if (!mkdir($trashDir, 0755, true)) {
                    ob_end_clean();
                    KanbanErrorManager::sendResponse(false, 'Impossible de créer le dossier corbeille', [], 'MKDIR_FAILED', 500);
                    return;
                }
            }
            
            // Construire le chemin de destination avec extension préservée (comme QuillJS)
            $fileInfo = pathinfo($fileName);
            $baseName = $fileInfo['filename'];
            $extension = isset($fileInfo['extension']) ? '.' . $fileInfo['extension'] : '';
            
            // Ajouter un suffixe pour éviter les conflits si fichier existe déjà (comme QuillJS)
            $counter = 0;
            do {
                $trashFileName = $baseName . ($counter > 0 ? '_' . $counter : '') . $extension;
                $trashMediaId = $trashNs . ':' . $trashFileName;
                $destFile = mediaFN($trashMediaId);
                $counter++;
            } while (file_exists($destFile) && $counter < 100);
            
            if ($counter >= 100) {
                ob_end_clean();
                KanbanErrorManager::sendResponse(false, 'Impossible de trouver un nom unique dans la corbeille', [], 'NAME_CONFLICT', 500);
                return;
            }
            
            KanbanErrorManager::logInfo('Destination file path', [
                'destFile' => $destFile,
                'trashMediaId' => $trashMediaId
            ]);
            
            // Créer le dossier de destination si nécessaire
            $destDir = dirname($destFile);
            if (!is_dir($destDir)) {
                if (!mkdir($destDir, 0755, true)) {
                    ob_end_clean();
                    KanbanErrorManager::sendResponse(false, 'Impossible de créer le dossier de destination', [], 'MKDIR_FAILED', 500);
                    return;
                }
            }
            
            // Déplacer le fichier
            if (rename($sourceFile, $destFile)) {
                KanbanErrorManager::logInfo('File moved to trash successfully', [
                    'source' => $sourceFile,
                    'dest' => $destFile
                ]);
                
                // Créer un fichier de métadonnées pour faciliter la restauration (comme QuillJS)
                $metaFile = $destFile . '.meta.json';
                $metaData = [
                    'original_path' => $sourceMediaId,
                    'original_namespace' => $sourceNs,
                    'original_filename' => $fileName,
                    'deleted_date' => date('Y-m-d H:i:s'),
                    'deleted_by' => $_SERVER['REMOTE_USER'] ?? 'unknown'
                ];
                file_put_contents($metaFile, json_encode($metaData, JSON_PRETTY_PRINT));
                
                KanbanErrorManager::sendResponse(true, 'Fichier déplacé vers la corbeille avec succès', [
                    'media_id' => $mediaId,
                    'trash_path' => $trashMediaId,
                    'meta_file' => basename($metaFile)
                ]);
            } else {
                ob_end_clean();
                KanbanErrorManager::sendResponse(false, 'Impossible de déplacer le fichier', [], 'MOVE_FAILED', 500);
            }
            
        } catch (Exception $e) {
            KanbanErrorManager::logError('Erreur lors du déplacement vers la corbeille', [
                'error' => $e->getMessage(),
                'user' => KanbanAuthManager::getCurrentUser()
            ]);
            
            KanbanErrorManager::sendResponse(false, 'Erreur: ' . $e->getMessage(), [], 'MOVE_ERROR', 500);
        } finally {
            // Clear any output buffer
            ob_end_clean();
        }
    }
    
    /**
     * Restaure un fichier média depuis la corbeille (comme QuillJS)
     */
    private function restoreMediaFromTrash() {
        global $INPUT;
        
        // Buffer any unexpected output
        ob_start();
        
        try {
            if (!KanbanAuthManager::isAuthenticated()) {
                KanbanErrorManager::logSecurity('Restore operation denied - authentication failed');
                ob_end_clean();
                KanbanErrorManager::sendAuthError();
                return;
            }
            
            $trashPath = $INPUT->str('trash_path');
            
            if (empty($trashPath)) {
                ob_end_clean();
                KanbanErrorManager::sendResponse(false, 'Chemin de corbeille manquant', [], 'MISSING_PARAMS', 400);
                return;
            }
            
            $trashNs = 'corbeille';
            $trashFile = mediaFN($trashNs . ':' . $trashPath);
            // mediaFN retourne déjà le chemin complet depuis DOKU_INC
            $trashFileAbs = $trashFile;
            $metaFile = $trashFileAbs . '.meta.json';
            
            KanbanErrorManager::logInfo('Restoring file', [
                'trashPath' => $trashPath,
                'trashNs' => $trashNs,
                'trashFile' => $trashFile,
                'trashFileAbs' => $trashFileAbs,
                'metaFile' => $metaFile,
                'trashFile_exists' => file_exists($trashFileAbs),
                'metaFile_exists' => file_exists($metaFile)
            ]);
            
            if (!file_exists($trashFileAbs)) {
                ob_end_clean();
                KanbanErrorManager::sendResponse(false, 'Fichier non trouvé dans la corbeille', [], 'FILE_NOT_FOUND', 404);
                return;
            }
            
            // Lire les métadonnées
            if (!file_exists($metaFile)) {
                ob_end_clean();
                KanbanErrorManager::sendResponse(false, 'Métadonnées de restauration non trouvées', [], 'META_NOT_FOUND', 404);
                return;
            }
            
            $meta = json_decode(file_get_contents($metaFile), true);
            if (!$meta || !isset($meta['original_path'])) {
                ob_end_clean();
                KanbanErrorManager::sendResponse(false, 'Métadonnées invalides', [], 'INVALID_META', 400);
                return;
            }
            
            $originalPath = $meta['original_path'];
            $originalNs = $meta['original_namespace'] ?? '';
            
            KanbanErrorManager::logInfo('Restore metadata', [
                'originalPath' => $originalPath,
                'originalNs' => $originalNs,
                'deletedBy' => $meta['deleted_by'] ?? 'unknown',
                'deletedDate' => $meta['deleted_date'] ?? 'unknown'
            ]);
            
            // Vérifier les permissions de restauration (comme QuillJS)
            $authLevel = auth_quickaclcheck($originalNs ? $originalNs . ':test' : 'test');
            if ($authLevel < AUTH_UPLOAD) {
                ob_end_clean();
                KanbanErrorManager::sendResponse(false, 'Permissions insuffisantes pour restaurer dans le namespace original', [], 'INSUFFICIENT_PERMS', 403);
                return;
            }
            
            $destFile = mediaFN($originalPath);
            
            // Vérifier si le fichier de destination existe déjà (comme QuillJS)
            if (file_exists($destFile)) {
                // Proposer un nouveau nom comme QuillJS
                $pathInfo = pathinfo($destFile);
                $counter = 1;
                do {
                    $newName = $pathInfo['dirname'] . '/' . $pathInfo['filename'] . '_restored_' . $counter . '.' . $pathInfo['extension'];
                    $counter++;
                } while (file_exists($newName));
                $destFile = $newName;
                $originalPath = str_replace(dirname(mediaFN('dummy')), '', $destFile);
                $originalPath = ltrim($originalPath, '/');
                $originalPath = str_replace('/', ':', $originalPath);
            }
            
            // Créer le dossier de destination si nécessaire
            $destDir = dirname($destFile);
            if (!is_dir($destDir)) {
                if (!mkdir($destDir, 0755, true)) {
                    ob_end_clean();
                    KanbanErrorManager::sendResponse(false, 'Impossible de créer le dossier de destination', [], 'MKDIR_FAILED', 500);
                    return;
                }
            }
            
            // Restaurer le fichier
            if (rename($trashFileAbs, $destFile)) {
                // Supprimer le fichier de métadonnées
                unlink($metaFile);
                
                KanbanErrorManager::logInfo('File restored successfully', [
                    'source' => $trashFileAbs,
                    'dest' => $destFile,
                    'restoredPath' => $originalPath
                ]);
                
                ob_end_clean();
                KanbanErrorManager::sendResponse(true, 'Fichier restauré avec succès', [
                    'restored_path' => $originalPath
                ]);
            } else {
                ob_end_clean();
                KanbanErrorManager::sendResponse(false, 'Échec de la restauration du fichier', [], 'RESTORE_FAILED', 500);
            }
            
        } catch (Exception $e) {
            KanbanErrorManager::logError('Erreur lors de la restauration', [
                'error' => $e->getMessage(),
                'user' => KanbanAuthManager::getCurrentUser()
            ]);
            
            ob_end_clean();
            KanbanErrorManager::sendResponse(false, 'Erreur: ' . $e->getMessage(), [], 'RESTORE_ERROR', 500);
        }
    }

    /**
     * Supprime définitivement un fichier média (depuis la corbeille)
     */
    private function deleteMediaPermanently() {
        global $INPUT;
        
        if (!KanbanAuthManager::isAuthenticated()) {
            KanbanErrorManager::logSecurity('Permanent delete operation denied - authentication failed');
            KanbanErrorManager::sendAuthError();
            return;
        }
        
        $mediaId = $INPUT->str('media_id');
        $mediaFilename = $INPUT->str('media_filename');
        
        if (empty($mediaId) || empty($mediaFilename)) {
            KanbanErrorManager::sendResponse(false, 'Paramètres manquants', [], 'MISSING_PARAMS', 400);
            return;
        }
        
        try {
            // Décoder le chemin (doit être dans la corbeille)
            $mediaPath = base64_decode($mediaId);
            
            // Si le chemin contient 'corbeille/', le convertir en namespace DokuWiki
            if (strpos($mediaPath, 'corbeille/') === 0) {
                // Convertir corbeille/filename en corbeille:filename pour mediaFN
                $trashFilename = str_replace('corbeille/', '', $mediaPath);
                $trashFile = mediaFN('corbeille:' . $trashFilename);
                // mediaFN retourne déjà le chemin complet depuis DOKU_INC
                $fullPath = $trashFile;
            } else {
                // Chemin legacy - construire le chemin manuellement
                $fullPath = DOKU_INC . 'data/media/' . $mediaPath;
            }
            
            KanbanErrorManager::logInfo('Permanent deletion attempt', [
                'mediaId' => $mediaId,
                'mediaPath' => $mediaPath,
                'fullPath' => $fullPath,
                'file_exists' => file_exists($fullPath)
            ]);
            
            // Vérifier que le fichier est bien dans la corbeille
            if (strpos($mediaPath, 'corbeille') === false) {
                KanbanErrorManager::logSecurity('Attempt to permanently delete file not in trash', [
                    'media_path' => $mediaPath,
                    'user' => KanbanAuthManager::getCurrentUser()
                ]);
                KanbanErrorManager::sendResponse(false, 'Seuls les fichiers dans la corbeille peuvent être supprimés définitivement', [], 'NOT_IN_TRASH', 403);
                return;
            }
            
            // Vérifications de sécurité standard
            $realPath = realpath($fullPath);
            $realMediaRoot = realpath(DOKU_INC . 'data/media/');
            
            KanbanErrorManager::logInfo('Path validation', [
                'realPath' => $realPath,
                'realMediaRoot' => $realMediaRoot,
                'realPath_valid' => $realPath !== false,
                'path_contains_root' => $realPath !== false && strpos($realPath, $realMediaRoot) === 0
            ]);
            
            if ($realPath === false || strpos($realPath, $realMediaRoot) !== 0) {
                KanbanErrorManager::logSecurity('Invalid path for permanent deletion', [
                    'media_path' => $mediaPath,
                    'fullPath' => $fullPath,
                    'realPath' => $realPath,
                    'user' => KanbanAuthManager::getCurrentUser()
                ]);
                KanbanErrorManager::sendResponse(false, 'Chemin non autorisé', [], 'INVALID_PATH', 403);
                return;
            }
            
            if (!file_exists($fullPath)) {
                KanbanErrorManager::sendResponse(false, 'Fichier non trouvé', [], 'FILE_NOT_FOUND', 404);
                return;
            }
            
            // Suppression définitive
            if (unlink($fullPath)) {
                // Supprimer aussi le fichier de métadonnées s'il existe
                $metaFile = $fullPath . '.meta.json';
                if (file_exists($metaFile)) {
                    unlink($metaFile);
                }
                
                // Nettoyer le cache
                $this->cacheManager->clearAllCaches();
                
                KanbanErrorManager::logInfo('Média supprimé définitivement', [
                    'media_path' => $mediaPath,
                    'fullPath' => $fullPath,
                    'meta_deleted' => file_exists($metaFile),
                    'user' => KanbanAuthManager::getCurrentUser()
                ]);
                
                KanbanErrorManager::sendResponse(true, 'Fichier supprimé définitivement', [
                    'media_id' => $mediaId
                ]);
            } else {
                KanbanErrorManager::sendResponse(false, 'Impossible de supprimer le fichier', [], 'DELETE_FAILED', 500);
            }
            
        } catch (Exception $e) {
            KanbanErrorManager::logError('Erreur lors de la suppression définitive', [
                'error' => $e->getMessage(),
                'user' => KanbanAuthManager::getCurrentUser()
            ]);
            
            KanbanErrorManager::sendResponse(false, 'Erreur: ' . $e->getMessage(), [], 'DELETE_ERROR', 500);
        }
    }

    /**
     * Liste le contenu de la corbeille (comme QuillJS)
     */
    private function listTrashContents() {
        // Buffer any unexpected output
        ob_start();
        
        try {
            if (!KanbanAuthManager::isAuthenticated()) {
                KanbanErrorManager::logSecurity('List trash operation denied - authentication failed');
                ob_end_clean();
                KanbanErrorManager::sendAuthError();
                return;
            }
            
            // Lister les fichiers dans la corbeille (comme QuillJS)
            $trashNs = 'corbeille';
            $trashDir = mediaFN($trashNs . ':dummy');
            $trashDir = dirname($trashDir);
            
            $trashItems = [];
            
            if (is_dir($trashDir)) {
                $iterator = new RecursiveIteratorIterator(
                    new RecursiveDirectoryIterator($trashDir, RecursiveDirectoryIterator::SKIP_DOTS)
                );
                
                foreach ($iterator as $file) {
                    if ($file->isFile() && !str_ends_with($file->getFilename(), '.meta.json')) {
                        $relativePath = str_replace($trashDir . '/', '', $file->getPathname());
                        $metaFile = $file->getPathname() . '.meta.json';
                        
                        $item = [
                            'filename' => $file->getFilename(),
                            'path' => $relativePath,
                            'size' => $file->getSize(),
                            'deleted_date' => date('Y-m-d H:i:s', $file->getMTime()),
                            'can_restore' => false
                        ];
                        
                        // Lire les métadonnées si disponibles (comme QuillJS)
                        if (file_exists($metaFile)) {
                            $meta = json_decode(file_get_contents($metaFile), true);
                            if ($meta) {
                                $item['original_path'] = $meta['original_path'] ?? '';
                                $item['original_namespace'] = $meta['original_namespace'] ?? '';
                                $item['original_filename'] = $meta['original_filename'] ?? '';
                                $item['deleted_date'] = $meta['deleted_date'] ?? $item['deleted_date'];
                                $item['deleted_by'] = $meta['deleted_by'] ?? 'unknown';
                                
                                // Vérifier si on peut restaurer (permissions sur le namespace original)
                                $originalNs = $meta['original_namespace'] ?? '';
                                $authLevel = auth_quickaclcheck($originalNs ? $originalNs . ':test' : 'test');
                                $item['can_restore'] = ($authLevel >= AUTH_UPLOAD);
                            }
                        }
                        
                        $trashItems[] = $item;
                    }
                }
            }
            
            // Trier par date de suppression (plus récent en premier) comme QuillJS
            usort($trashItems, function($a, $b) {
                return strcmp($b['deleted_date'], $a['deleted_date']);
            });
            
            KanbanErrorManager::logInfo('Trash contents listed', [
                'item_count' => count($trashItems),
                'user' => KanbanAuthManager::getCurrentUser()
            ]);
            
            ob_end_clean();
            KanbanErrorManager::sendResponse(true, 'Liste de la corbeille récupérée', $trashItems);
            
        } catch (Exception $e) {
            KanbanErrorManager::logError('Erreur lors de la liste de la corbeille', [
                'error' => $e->getMessage(),
                'user' => KanbanAuthManager::getCurrentUser()
            ]);
            
            ob_end_clean();
            KanbanErrorManager::sendResponse(false, 'Erreur: ' . $e->getMessage(), [], 'LIST_ERROR', 500);
        }
    }
}
