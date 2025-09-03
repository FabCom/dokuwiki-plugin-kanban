<?php
/**
 * Kanban Asset Manager
 * Handles CSS/JS asset loading and security headers
 * 
 * @version 1.0.0
 * @date 2025-09-03
 */

use dokuwiki\Extension\Event;

class KanbanAssetManager
{
    /**
     * Add all required CSS and JavaScript assets
     * 
     * @param Event $event DokuWiki event
     * @param mixed $param Event parameters
     */
    public static function addAssets(Event $event, $param) {
        // Only add assets if kanban syntax is present on the page
        global $ID;
        if (empty($ID)) return;
        
        $content = rawWiki($ID);
        if (!$content || strpos($content, '<kanban') === false) {
            return;
        }
        
        // Add CSS files
        self::addCSSAssets($event);
        
        // Add JavaScript files in dependency order
        self::addJSAssets($event);
    }
    
    /**
     * Add CSS assets
     */
    private static function addCSSAssets(Event $event) {
        // Note: style.css is automatically included by DokuWiki from plugin root
        
        // Add filters styles
        $event->data['link'][] = [
            'type' => 'text/css',
            'rel' => 'stylesheet',
            'href' => DOKU_BASE . 'lib/plugins/kanban/css/filters.css'
        ];
        
        // Add performance styles
        $event->data['link'][] = [
            'type' => 'text/css',
            'rel' => 'stylesheet',
            'href' => DOKU_BASE . 'lib/plugins/kanban/css/kanban-performance.css'
        ];
    }
    
    /**
     * Add JavaScript assets in correct dependency order
     */
    private static function addJSAssets(Event $event) {
        // Core utilities - must be loaded first
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/utils.js'
        ];
        
        // Modal core - foundation for all modal functionality
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/modal-core.js'
        ];
        
        // Specialized modal modules
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/modal-cards.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/modal-columns.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/modal-links.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/modal-media.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/discussions.js'
        ];
        
        // Template modal - for creating boards from templates
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/modal-template.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/modal-main.js'
        ];
        
        // Core functionality scripts
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/lockmanagement.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/dragdrop.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/filters.js'
        ];
        
        // Performance enhancements - load before main script
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/kanban-performance.js'
        ];
        
        // Main script - must be loaded last
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/script.js'
        ];
    }
    
    /**
     * Set Content Security Policy and other security headers
     * 
     * @param Event $event DokuWiki event
     * @param mixed $param Event parameters
     */
    public static function setSecurityHeaders(Event $event, $param) {
        // Only apply CSP if Kanban is being used on this page
        if (strpos($_SERVER['REQUEST_URI'], 'kanban') !== false || 
            (isset($_GET['id']) && preg_match('/kanban/', $_GET['id']))) {
            
            // Check if headers haven't been sent yet
            if (!headers_sent()) {
                // Load security policy class
                require_once(dirname(__FILE__) . '/KanbanSecurityPolicy.php');
                
                // Set CSP headers using security policy
                KanbanSecurityPolicy::setCSPHeader(false); // false = relaxed for DokuWiki compatibility
                
                // Additional security headers
                header('X-Content-Type-Options: nosniff');
                header('X-Frame-Options: SAMEORIGIN');
                header('Referrer-Policy: strict-origin-when-cross-origin');
            }
        }
    }
    
    /**
     * Add user information to JSINFO for frontend access
     * 
     * @param Event $event DokuWiki event
     * @param mixed $param Event parameters
     */
    public static function addUserInfoToJSINFO(Event $event, $param) {
        global $JSINFO, $INFO, $conf, $ACT;
        
        // Ensure JSINFO array exists
        if (!is_array($JSINFO)) {
            $JSINFO = array();
        }
        
        // Load required classes
        require_once(dirname(__FILE__) . '/KanbanAuthManager.php');
        require_once(dirname(__FILE__) . '/KanbanSecurityPolicy.php');
        
        // Get current user safely
        $currentUser = KanbanAuthManager::getCurrentUser();
        
        // Fallback for development environments
        if ($currentUser === 'anonymous' && self::isDevelopmentEnvironment()) {
            $currentUser = 'dev_user';
            KanbanErrorManager::logInfo('Development fallback user used', ['user' => $currentUser]);
        }
        
        // Security validation and sanitization
        if (!$currentUser || KanbanSecurityPolicy::detectXSSPatterns($currentUser)) {
            KanbanErrorManager::logSecurity('Invalid or suspicious username detected', ['user' => $currentUser]);
            $currentUser = 'anonymous';
        }
        
        // Safely add to JSINFO
        $JSINFO['kanban_user'] = KanbanSecurityPolicy::sanitizeForJS($currentUser, 'username');
        
        // Add page ID if available
        if (isset($INFO['id'])) {
            $pageId = KanbanSecurityPolicy::sanitizeForJS($INFO['id'], 'pageid');
            $JSINFO['kanban_page_id'] = $pageId;
        }
        
        KanbanErrorManager::logInfo('User info added to JSINFO', [
            'user' => $currentUser,
            'page_id' => $INFO['id'] ?? 'unknown'
        ]);
    }
    
    /**
     * Check if we're in a development environment
     */
    private static function isDevelopmentEnvironment() {
        $devHosts = ['localhost', '127.0.0.1', '::1', 'dev.local', 'test.local'];
        return in_array($_SERVER['HTTP_HOST'] ?? '', $devHosts);
    }
}
