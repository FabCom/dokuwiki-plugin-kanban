<?php
/**
 * Kanban Plugin Action Component - REFACTORED
 * Modular architecture with delegated responsibilities
 * 
 * @version 2.0.0
 * @date 2025-09-03
 */

if (!defined('DOKU_INC')) die();

use dokuwiki\Extension\ActionPlugin;
use dokuwiki\Extension\EventHandler;
use dokuwiki\Extension\Event;

class action_plugin_kanban extends ActionPlugin
{
    private $lockManager;
    
    function __construct()
    {
        // Load all required components
        require_once(dirname(__FILE__) . '/KanbanLockManager.php');
        require_once(dirname(__FILE__) . '/KanbanAuthManager.php');
        require_once(dirname(__FILE__) . '/KanbanSecurityPolicy.php');
        require_once(dirname(__FILE__) . '/KanbanErrorManager.php');
        require_once(dirname(__FILE__) . '/KanbanDataManager.php');
        require_once(dirname(__FILE__) . '/KanbanAssetManager.php');
        require_once(dirname(__FILE__) . '/KanbanAjaxHandler.php');
        
        // Initialize lock manager (kept for backward compatibility)
        $this->lockManager = new KanbanLockManager();
        
        // Set exception handler for this plugin
        set_exception_handler([KanbanErrorManager::class, 'handleException']);
    }
    
    /**
     * Registers a callback function for a given event
     *
     * @param EventHandler $controller DokuWiki's event controller object
     * @return void
     */
    public function register(EventHandler $controller)
    {
        $controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE', $this, 'addAssets');
        $controller->register_hook('AJAX_CALL_UNKNOWN', 'BEFORE', $this, 'handleAjax');
        $controller->register_hook('DOKUWIKI_STARTED', 'AFTER', $this, 'setSecurityHeaders');
        // Add user info using asset manager
        $controller->register_hook('DOKUWIKI_STARTED', 'AFTER', $this, 'addUserInfoToJSINFO');
    }

    /**
     * Add CSS and JavaScript assets - DELEGATED to KanbanAssetManager
     */
    public function addAssets(Event $event, $param)
    {
        KanbanAssetManager::addAssets($event, $param);
    }

    /**
     * Set Content Security Policy and other security headers - DELEGATED to KanbanAssetManager
     */
    public function setSecurityHeaders(Event $event, $param) {
        KanbanAssetManager::setSecurityHeaders($event, $param);
    }
    
    /**
     * Add user information to JSINFO for frontend access - DELEGATED to KanbanAssetManager
     */
    public function addUserInfoToJSINFO(Event $event, $param)
    {
        KanbanAssetManager::addUserInfoToJSINFO($event, $param);
    }

    /**
     * Handle AJAX requests - DELEGATED to KanbanAjaxHandler
     */
    public function handleAjax(Event $event, $param)
    {
        $ajaxHandler = new KanbanAjaxHandler();
        $ajaxHandler->handleAjax($event, $param);
    }
    
    // === LEGACY UTILITY METHODS (kept for backward compatibility) ===
    
    /**
     * Validate user authentication - LEGACY (now handled by KanbanAuthManager)
     * @deprecated Use KanbanAuthManager::isAuthenticated() instead
     */
    private function validateAuthentication()
    {
        return KanbanAuthManager::isAuthenticated();
    }

    /**
     * Get current authenticated user - LEGACY (now handled by KanbanAuthManager)
     * @deprecated Use KanbanAuthManager::getCurrentUser() instead
     */
    private function getCurrentUser()
    {
        return KanbanAuthManager::getCurrentUser();
    }
    
    /**
     * Check if page has kanban content - LEGACY (now handled by KanbanDataManager)
     * @deprecated Use KanbanDataManager::hasKanbanContent() instead
     */
    private function hasKanbanContent()
    {
        $dataManager = new KanbanDataManager();
        return $dataManager->hasKanbanContent();
    }
}
