<?php
/**
 * Kanban Authorization Manager
 * Centralized authorization and permission management
 * 
 * @author Security Team
 * @version 2.0.0 - Security enhanced
 */

class KanbanAuthManager 
{
    private static $cacheManager = null;
    
    /**
     * Get cache manager instance
     */
    private static function getCacheManager() {
        if (self::$cacheManager === null) {
            require_once(dirname(__FILE__) . '/KanbanCacheManager.php');
            self::$cacheManager = KanbanCacheManager::getInstance();
        }
        return self::$cacheManager;
    }
    
    /**
     * Check if user can read a page/media
     * 
     * @param string $pageId Page or media ID
     * @return bool True if read access allowed
     */
    public static function canRead($pageId)
    {
        if (empty($pageId)) {
            return false;
        }
        
        $user = self::getCurrentUser();
        $cacheManager = self::getCacheManager();
        
        // Try to get from cache first
        $cachedResult = $cacheManager->getCachedACL($user, $pageId, 'read');
        if ($cachedResult !== null) {
            return $cachedResult;
        }
        
        global $conf;
        
        // If ACL is disabled, allow read access
        if (!$conf['useacl']) {
            $hasAccess = true;
            $cacheManager->cacheACL($user, $pageId, 'read', $hasAccess);
            return $hasAccess;
        }
        
        $authLevel = auth_quickaclcheck($pageId);
        $hasAccess = $authLevel >= AUTH_READ;
        
        // Cache the result
        $cacheManager->cacheACL($user, $pageId, 'read', $hasAccess);
        
        self::logAccess('READ', $pageId, $hasAccess, $authLevel);
        
        return $hasAccess;
    }
    
    /**
     * Check if user can edit a page
     * 
     * @param string $pageId Page ID
     * @return bool True if edit access allowed
     */
    public static function canEdit($pageId)
    {
        if (empty($pageId)) {
            return false;
        }
        
        $user = self::getCurrentUser();
        $cacheManager = self::getCacheManager();
        
        // Try to get from cache first
        $cachedResult = $cacheManager->getCachedACL($user, $pageId, 'edit');
        if ($cachedResult !== null) {
            return $cachedResult;
        }
        
        global $conf;
        
        // If ACL is disabled, check basic authentication
        if (!$conf['useacl']) {
            $hasAccess = !empty($_SERVER['REMOTE_USER']);
            $cacheManager->cacheACL($user, $pageId, 'edit', $hasAccess);
            return $hasAccess;
        }
        
        $authLevel = auth_quickaclcheck($pageId);
        $hasAccess = $authLevel >= AUTH_EDIT;
        
        // Cache the result
        $cacheManager->cacheACL($user, $pageId, 'edit', $hasAccess);
        
        self::logAccess('EDIT', $pageId, $hasAccess, $authLevel);
        
        return $hasAccess;
    }
    
    /**
     * Check if user can upload media
     * 
     * @param string $namespace Media namespace
     * @return bool True if upload access allowed
     */
    public static function canUpload($namespace = '')
    {
        $user = self::getCurrentUser();
        $cacheManager = self::getCacheManager();
        $testId = $namespace ? $namespace . ':test' : 'test';
        
        // Try to get from cache first
        $cachedResult = $cacheManager->getCachedACL($user, $testId, 'upload');
        if ($cachedResult !== null) {
            return $cachedResult;
        }
        
        global $conf;
        
        // If ACL is disabled, check basic authentication
        if (!$conf['useacl']) {
            $hasAccess = !empty($_SERVER['REMOTE_USER']);
            $cacheManager->cacheACL($user, $testId, 'upload', $hasAccess);
            return $hasAccess;
        }
        
        // Check upload permission for namespace
        $authLevel = auth_quickaclcheck($testId);
        $hasAccess = $authLevel >= AUTH_UPLOAD;
        
        // Cache the result
        $cacheManager->cacheACL($user, $testId, 'upload', $hasAccess);
        
        self::logAccess('UPLOAD', $testId, $hasAccess, $authLevel);
        
        return $hasAccess;
    }
    
    /**
     * Check if user can create new pages
     * 
     * @param string $pageId Page ID
     * @return bool True if create access allowed
     */
    public static function canCreate($pageId)
    {
        if (empty($pageId)) {
            return false;
        }
        
        global $conf;
        
        // If ACL is disabled, check basic authentication
        if (!$conf['useacl']) {
            return !empty($_SERVER['REMOTE_USER']);
        }
        
        $authLevel = auth_quickaclcheck($pageId);
        $hasAccess = $authLevel >= AUTH_CREATE;
        
        self::logAccess('CREATE', $pageId, $hasAccess, $authLevel);
        
        return $hasAccess;
    }
    
    /**
     * Check if user can delete pages
     * 
     * @param string $pageId Page ID
     * @return bool True if delete access allowed
     */
    public static function canDelete($pageId)
    {
        if (empty($pageId)) {
            return false;
        }
        
        global $conf;
        
        // If ACL is disabled, check basic authentication
        if (!$conf['useacl']) {
            return !empty($_SERVER['REMOTE_USER']);
        }
        
        $authLevel = auth_quickaclcheck($pageId);
        $hasAccess = $authLevel >= AUTH_DELETE;
        
        self::logAccess('DELETE', $pageId, $hasAccess, $authLevel);
        
        return $hasAccess;
    }
    
    /**
     * Check if user is manager/admin
     * 
     * @return bool True if user has admin rights
     */
    public static function isAdmin()
    {
        global $conf;
        
        // If ACL is disabled, treat authenticated users as admin
        if (!$conf['useacl']) {
            return !empty($_SERVER['REMOTE_USER']);
        }
        
        $authLevel = auth_quickaclcheck('*');
        $isAdmin = $authLevel >= AUTH_ADMIN;
        
        self::logAccess('ADMIN', '*', $isAdmin, $authLevel);
        
        return $isAdmin;
    }
    
    /**
     * Check media access permissions
     * 
     * @param string $mediaId Media ID
     * @param int $requiredLevel Required permission level
     * @return bool True if access allowed
     */
    public static function canAccessMedia($mediaId, $requiredLevel = AUTH_READ)
    {
        if (empty($mediaId)) {
            return false;
        }
        
        global $conf;
        
        // If ACL is disabled, check basic authentication for write operations
        if (!$conf['useacl']) {
            if ($requiredLevel > AUTH_READ) {
                return !empty($_SERVER['REMOTE_USER']);
            }
            return true;
        }
        
        $authLevel = auth_quickaclcheck($mediaId);
        $hasAccess = $authLevel >= $requiredLevel;
        
        self::logAccess('MEDIA', $mediaId, $hasAccess, $authLevel, $requiredLevel);
        
        return $hasAccess;
    }
    
    /**
     * Get current authenticated user
     * 
     * @return string|null Current user or null if not authenticated
     */
    public static function getCurrentUser()
    {
        return $_SERVER['REMOTE_USER'] ?? null;
    }
    
    /**
     * Check if user is authenticated
     * 
     * @return bool True if user is authenticated
     */
    public static function isAuthenticated()
    {
        return !empty($_SERVER['REMOTE_USER']);
    }
    
    /**
     * Get user's permission level for a page/media
     * 
     * @param string $pageId Page or media ID
     * @return int Permission level (0-255)
     */
    public static function getPermissionLevel($pageId)
    {
        if (empty($pageId)) {
            return 0;
        }
        
        global $conf;
        
        // If ACL is disabled, return admin level for authenticated users
        if (!$conf['useacl']) {
            return self::isAuthenticated() ? AUTH_ADMIN : 0;
        }
        
        return auth_quickaclcheck($pageId);
    }
    
    /**
     * Require specific permission or throw error
     * 
     * @param string $pageId Page ID
     * @param int $requiredLevel Required permission level
     * @param string $action Action being performed
     * @throws Exception If permission denied
     */
    public static function requirePermission($pageId, $requiredLevel, $action = 'access')
    {
        $authLevel = self::getPermissionLevel($pageId);
        
        if ($authLevel < $requiredLevel) {
            $user = self::getCurrentUser() ?? 'anonymous';
            $error = "Permission denied for action '$action' on '$pageId' (required: $requiredLevel, got: $authLevel)";
            
            self::logSecurity("PERMISSION DENIED: $error", $user);
            
            throw new Exception("Permissions insuffisantes pour $action", 403);
        }
    }
    
    /**
     * Log access attempts for security auditing
     * 
     * @param string $action Action being performed
     * @param string $resource Resource being accessed
     * @param bool $granted Whether access was granted
     * @param int $userLevel User's permission level
     * @param int $requiredLevel Required permission level
     */
    private static function logAccess($action, $resource, $granted, $userLevel, $requiredLevel = null)
    {
        global $conf;
        
        // Only log if security logging is enabled
        if (!($conf['plugin']['kanban']['log_security_events'] ?? true)) {
            return;
        }
        
        $user = self::getCurrentUser() ?? 'anonymous';
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $status = $granted ? 'GRANTED' : 'DENIED';
        $requiredText = $requiredLevel ? " (required: $requiredLevel)" : '';
        
        error_log("Kanban AUTH [$action]: $status for user '$user' on '$resource' " .
                 "(level: $userLevel$requiredText, IP: $ip)");
    }
    
    /**
     * Log security events
     * 
     * @param string $message Security message
     * @param string $user User involved
     */
    private static function logSecurity($message, $user = null)
    {
        global $conf;
        
        if ($conf['plugin']['kanban']['log_security_events'] ?? true) {
            $user = $user ?? self::getCurrentUser() ?? 'anonymous';
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            error_log("Kanban SECURITY [AUTH]: $message (User: $user, IP: $ip)");
        }
    }
}
