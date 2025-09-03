<?php
/**
 * Kanban AJAX Security Validator
 * Centralized validation and security for all AJAX endpoints
 * 
 * @author Security Team
 * @version 2.0.0 - Security enhanced
 */

class KanbanAjaxValidator 
{
    private $allowedFileExtensions = [
        'images' => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'],
        'documents' => ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'],
        'media' => ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mp3', 'wav', 'ogg'],
        'archives' => ['zip', 'rar', '7z', 'tar', 'gz']
    ];
    
    private $maxFileSize = 10485760; // 10MB default
    private $maxSearchResults = 100;
    
    public function __construct() 
    {
        global $conf;
        
        // Load configuration
        $this->maxFileSize = $conf['plugin']['kanban']['max_file_size'] ?? $this->maxFileSize;
        $this->maxSearchResults = $conf['plugin']['kanban']['max_search_results'] ?? $this->maxSearchResults;
        
        // Merge custom allowed extensions if defined
        if (!empty($conf['plugin']['kanban']['allowed_extensions'])) {
            $customExtensions = explode(',', $conf['plugin']['kanban']['allowed_extensions']);
            $this->allowedFileExtensions['custom'] = array_map('trim', $customExtensions);
        }
    }
    
    /**
     * Validate AJAX request requirements
     * 
     * @param array $requirements Configuration array
     * @return array Validation result
     */
    public function validateAjaxRequest($requirements = [])
    {
        $defaults = [
            'require_auth' => true,
            'require_ajax_header' => true,
            'allowed_methods' => ['POST'],
            'require_csrf_token' => false,
            'min_auth_level' => AUTH_READ
        ];
        
        $requirements = array_merge($defaults, $requirements);
        
        // Check request method
        if (!in_array($_SERVER['REQUEST_METHOD'], $requirements['allowed_methods'])) {
            return $this->errorResponse('Method not allowed', 405);
        }
        
        // Check AJAX header
        if ($requirements['require_ajax_header']) {
            $isAjax = isset($_SERVER['HTTP_X_REQUESTED_WITH']) && 
                     $_SERVER['HTTP_X_REQUESTED_WITH'] === 'XMLHttpRequest';
            $isCLI = php_sapi_name() === 'cli';
            
            if (!$isAjax && !$isCLI) {
                return $this->errorResponse('AJAX request required', 400);
            }
        }
        
        // Check authentication
        if ($requirements['require_auth']) {
            $authResult = $this->validateAuthentication($requirements['min_auth_level']);
            if (!$authResult['success']) {
                return $authResult;
            }
            $userData = $authResult['data'] ?? [];
        } else {
            $userData = [];
        }
        
        // Check CSRF token if required
        if ($requirements['require_csrf_token']) {
            $tokenResult = $this->validateCSRFToken();
            if (!$tokenResult['success']) {
                return $tokenResult;
            }
        }
        
        return $this->successResponse('Request validated', $userData);
    }
    
    /**
     * Validate user authentication and permissions
     * 
     * @param int $minAuthLevel Minimum required authentication level
     * @return array Validation result
     */
    public function validateAuthentication($minAuthLevel = AUTH_READ)
    {
        global $conf, $INFO;
        
        $currentUser = $_SERVER['REMOTE_USER'] ?? null;
        $isAuthenticated = !empty($currentUser);
        
        // Skip auth check if ACL is disabled
        if (!$conf['useacl']) {
            return $this->successResponse('ACL disabled, access granted', [
                'user' => $_SERVER['REMOTE_USER'] ?? 'anonymous',
                'auth_level' => AUTH_ADMIN // Full access when ACL disabled
            ]);
        }
        
        // Check basic authentication
        if (!$isAuthenticated) {
            $this->logSecurity('Authentication failed - no REMOTE_USER', 'anonymous');
            return $this->errorResponse('Authentication required', 401);
        }
        
        // Check minimum auth level for media operations
        $authLevel = auth_quickaclcheck('*');
        if ($authLevel < $minAuthLevel) {
            $this->logSecurity("Insufficient permissions - required: $minAuthLevel, got: $authLevel", $currentUser);
            return $this->errorResponse('Insufficient permissions', 403);
        }
        
        return $this->successResponse('Authentication validated', [
            'user' => $currentUser,
            'auth_level' => $authLevel
        ]);
    }
    
    /**
     * Validate and sanitize namespace parameter
     * 
     * @param string $namespace Raw namespace input
     * @return array Validation result with cleaned namespace
     */
    public function validateNamespace($namespace)
    {
        // Clean namespace
        $namespace = trim($namespace);
        $namespace = str_replace(['\\', '/'], ':', $namespace);
        
        // Remove dangerous characters
        $namespace = preg_replace('/[^a-zA-Z0-9:_-]/', '', $namespace);
        $namespace = trim($namespace, ':');
        
        // Check for path traversal attempts
        if (strpos($namespace, '..') !== false) {
            $this->logSecurity('Path traversal attempt in namespace: ' . $namespace, $this->getCurrentUser());
            return $this->errorResponse('Invalid namespace - path traversal detected', 400);
        }
        
        // Validate namespace permissions
        if (!empty($namespace)) {
            $testId = $namespace . ':test';
            $authLevel = auth_quickaclcheck($testId);
            if ($authLevel < AUTH_READ) {
                return $this->errorResponse('Access denied to namespace: ' . $namespace, 403);
            }
        }
        
        return $this->successResponse('Namespace validated', ['namespace' => $namespace]);
    }
    
    /**
     * Validate file upload parameters and file itself
     * 
     * @param array $file $_FILES array element
     * @param string $namespace Target namespace
     * @return array Validation result
     */
    public function validateFileUpload($file, $namespace = '')
    {
        // Check if file was uploaded
        if (!isset($file) || !is_array($file)) {
            return $this->errorResponse('No file provided', 400);
        }
        
        // Check upload errors
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errorMsg = $this->getUploadErrorMessage($file['error'], $file);
            return $this->errorResponse($errorMsg, 400);
        }
        
        // Validate file size
        if ($file['size'] > $this->maxFileSize) {
            return $this->errorResponse('File too large: ' . $this->formatBytes($file['size']) . 
                                      ' (limit: ' . $this->formatBytes($this->maxFileSize) . ')', 413);
        }
        
        // Validate file extension
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!$this->isAllowedExtension($extension)) {
            $this->logSecurity('Upload blocked - disallowed extension: ' . $extension, $this->getCurrentUser());
            return $this->errorResponse('File type not allowed: .' . $extension, 415);
        }
        
        // Validate filename
        if (!$this->isValidFilename($file['name'])) {
            return $this->errorResponse('Invalid filename', 400);
        }
        
        // Check upload permissions for namespace
        $namespaceResult = $this->validateNamespace($namespace);
        if (!$namespaceResult['success']) {
            return $namespaceResult;
        }
        
        $mediaId = ($namespace ? $namespace . ':' : '') . $file['name'];
        $authLevel = auth_quickaclcheck($mediaId);
        if ($authLevel < AUTH_UPLOAD) {
            return $this->errorResponse('Upload permission denied for this location', 403);
        }
        
        return $this->successResponse('File upload validated', [
            'extension' => $extension,
            'media_id' => $mediaId,
            'namespace' => $namespaceResult['data']['namespace']
        ]);
    }
    
    /**
     * Validate search query parameters
     * 
     * @param string $query Search query
     * @param int $limit Result limit
     * @return array Validation result
     */
    public function validateSearchQuery($query, $limit = 50)
    {
        // Sanitize query
        $query = trim($query);
        
        // Check minimum length
        if (strlen($query) < 2) {
            return $this->errorResponse('Search query too short (minimum 2 characters)', 400);
        }
        
        // Check maximum length
        if (strlen($query) > 100) {
            return $this->errorResponse('Search query too long (maximum 100 characters)', 400);
        }
        
        // Sanitize query for safety
        $query = preg_replace('/[<>"\']/', '', $query);
        
        // Validate limit
        $limit = max(1, min((int)$limit, $this->maxSearchResults));
        
        // Check for potential SQL injection patterns (even though we don't use SQL)
        $dangerousPatterns = ['union', 'select', 'insert', 'delete', 'drop', 'script', 'javascript'];
        $queryLower = strtolower($query);
        
        foreach ($dangerousPatterns as $pattern) {
            if (strpos($queryLower, $pattern) !== false) {
                $this->logSecurity('Suspicious search query blocked: ' . $query, $this->getCurrentUser());
                return $this->errorResponse('Invalid search query', 400);
            }
        }
        
        return $this->successResponse('Search query validated', [
            'query' => $query,
            'limit' => $limit
        ]);
    }
    
    /**
     * Validate CSRF token
     * 
     * @return array Validation result
     */
    public function validateCSRFToken()
    {
        $token = $_POST['sectok'] ?? $_GET['sectok'] ?? '';
        
        if (empty($token)) {
            return $this->errorResponse('CSRF token missing', 403);
        }
        
        if (!checkSecurityToken($token)) {
            $this->logSecurity('Invalid CSRF token provided', $this->getCurrentUser());
            return $this->errorResponse('Invalid CSRF token', 403);
        }
        
        return $this->successResponse('CSRF token validated');
    }
    
    /**
     * Check if file extension is allowed
     * 
     * @param string $extension File extension
     * @return bool True if allowed
     */
    private function isAllowedExtension($extension)
    {
        foreach ($this->allowedFileExtensions as $category => $extensions) {
            if (in_array($extension, $extensions)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Validate filename for security
     * 
     * @param string $filename Original filename
     * @return bool True if valid
     */
    private function isValidFilename($filename)
    {
        // Check for dangerous characters
        if (preg_match('/[<>:"|?*\x00-\x1f]/', $filename)) {
            return false;
        }
        
        // Check for reserved names (Windows)
        $reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
        $basename = strtoupper(pathinfo($filename, PATHINFO_FILENAME));
        
        if (in_array($basename, $reserved)) {
            return false;
        }
        
        // Check length
        if (strlen($filename) > 255) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Get current authenticated user
     * 
     * @return string|null Current user or null
     */
    private function getCurrentUser()
    {
        return $_SERVER['REMOTE_USER'] ?? null;
    }
    
    /**
     * Get upload error message
     * 
     * @param int $errorCode PHP upload error code
     * @param array $file File info
     * @return string Error message
     */
    private function getUploadErrorMessage($errorCode, $file)
    {
        $fileName = $file['name'] ?? 'unknown file';
        
        switch ($errorCode) {
            case UPLOAD_ERR_INI_SIZE:
                return "File too large: $fileName exceeds server limit";
            case UPLOAD_ERR_FORM_SIZE:
                return "File too large: $fileName exceeds form limit";
            case UPLOAD_ERR_PARTIAL:
                return "Upload interrupted: $fileName was only partially uploaded";
            case UPLOAD_ERR_NO_FILE:
                return "No file uploaded";
            case UPLOAD_ERR_NO_TMP_DIR:
                return "Server error: missing temporary folder";
            case UPLOAD_ERR_CANT_WRITE:
                return "Server error: cannot write to disk";
            case UPLOAD_ERR_EXTENSION:
                return "Upload blocked by server extension";
            default:
                return "Unknown upload error: $errorCode";
        }
    }
    
    /**
     * Format bytes to human readable size
     * 
     * @param int $bytes Bytes
     * @return string Formatted size
     */
    private function formatBytes($bytes)
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        
        $bytes /= pow(1024, $pow);
        
        return round($bytes, 2) . ' ' . $units[$pow];
    }
    
    /**
     * Create success response
     * 
     * @param string $message Success message
     * @param array $data Additional data
     * @return array Response array
     */
    private function successResponse($message, $data = [])
    {
        return [
            'success' => true,
            'message' => $message,
            'data' => $data
        ];
    }
    
    /**
     * Create error response
     * 
     * @param string $message Error message
     * @param int $httpCode HTTP status code
     * @return array Response array
     */
    private function errorResponse($message, $httpCode = 400)
    {
        http_response_code($httpCode);
        return [
            'success' => false,
            'error' => $message,
            'http_code' => $httpCode
        ];
    }
    
    /**
     * Log security events
     * 
     * @param string $message Security message
     * @param string $user User involved
     */
    private function logSecurity($message, $user = null)
    {
        global $conf;
        
        if ($conf['plugin']['kanban']['log_security_events'] ?? true) {
            $user = $user ?? 'anonymous';
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            error_log("Kanban SECURITY [AJAX]: $message (User: $user, IP: $ip)");
        }
    }
}
