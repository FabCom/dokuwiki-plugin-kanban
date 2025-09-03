<?php
/**
 * Kanban Error Manager
 * Centralizes error handling, logging, and response formatting
 * 
 * @version 1.0.0
 * @date 2025-09-03
 */

class KanbanErrorManager
{
    const LEVEL_INFO = 'INFO';
    const LEVEL_WARNING = 'WARNING';
    const LEVEL_ERROR = 'ERROR';
    const LEVEL_SECURITY = 'SECURITY';
    const LEVEL_CRITICAL = 'CRITICAL';
    
    private static $isProductionMode = null;
    private static $logFile = null;
    
    /**
     * Initialize error manager
     */
    public static function init() {
        // Auto-detect production mode
        if (self::$isProductionMode === null) {
            self::$isProductionMode = !in_array($_SERVER['HTTP_HOST'] ?? '', [
                'localhost', '127.0.0.1', '::1', 'dev.local', 'test.local'
            ]);
        }
        
        // Set log file path
        if (self::$logFile === null) {
            self::$logFile = dirname(__FILE__) . '/../logs/kanban_errors.log';
            
            // Create logs directory if needed
            $logDir = dirname(self::$logFile);
            if (!is_dir($logDir)) {
                mkdir($logDir, 0755, true);
            }
        }
    }
    
    /**
     * Send standardized JSON response
     * 
     * @param bool $success Success status
     * @param string $message User-friendly message
     * @param array $data Optional data payload
     * @param string $errorCode Optional error code for debugging
     * @param int $httpCode HTTP status code
     */
    public static function sendResponse($success, $message, $data = [], $errorCode = null, $httpCode = 200) {
        self::init();
        
        // Set appropriate HTTP status code
        if (!$success && $httpCode === 200) {
            $httpCode = 400; // Bad Request by default for errors
        }
        
        http_response_code($httpCode);
        header('Content-Type: application/json; charset=utf-8');
        
        $response = [
            'success' => $success,
            'message' => $message,
            'timestamp' => date('c')
        ];
        
        // Add data if provided
        if (!empty($data)) {
            $response['data'] = $data;
        }
        
        // Add error code only in development mode
        if (!$success && $errorCode && !self::$isProductionMode) {
            $response['error_code'] = $errorCode;
            $response['debug_mode'] = true;
        }
        
        echo json_encode($response, JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    /**
     * Send authentication error response
     */
    public static function sendAuthError($message = null) {
        $message = $message ?: 'Authentification requise';
        self::logSecurity('Authentication failed', [
            'message' => $message,
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
        ]);
        
        self::sendResponse(false, $message, [], 'AUTH_REQUIRED', 401);
    }
    
    /**
     * Send authorization error response
     */
    public static function sendAuthorizationError($resource = null) {
        $message = 'Permissions insuffisantes';
        if ($resource && !self::$isProductionMode) {
            $message .= " pour l'accès à : $resource";
        }
        
        self::logSecurity('Authorization failed', [
            'resource' => $resource,
            'user' => self::getCurrentUser()
        ]);
        
        self::sendResponse(false, $message, [], 'INSUFFICIENT_PERMISSIONS', 403);
    }
    
    /**
     * Send validation error response
     */
    public static function sendValidationError($field, $constraint = null) {
        $message = "Données invalides";
        
        if (!self::$isProductionMode && $field) {
            $message .= " : $field";
            if ($constraint) {
                $message .= " ($constraint)";
            }
        }
        
        self::logWarning('Validation failed', [
            'field' => $field,
            'constraint' => $constraint
        ]);
        
        self::sendResponse(false, $message, [], 'VALIDATION_FAILED', 400);
    }
    
    /**
     * Send server error response
     */
    public static function sendServerError($internalMessage = null, $userMessage = null) {
        $message = $userMessage ?: 'Erreur interne du serveur';
        
        self::logError('Server error', [
            'internal_message' => $internalMessage,
            'user_message' => $userMessage
        ]);
        
        self::sendResponse(false, $message, [], 'SERVER_ERROR', 500);
    }
    
    /**
     * Log message with level and context
     */
    public static function log($level, $message, $context = []) {
        self::init();
        
        $timestamp = date('Y-m-d H:i:s');
        $user = self::getCurrentUser();
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
        
        $logEntry = sprintf(
            "[%s] [%s] %s (User: %s, IP: %s)\n",
            $timestamp,
            $level,
            $message,
            $user,
            $ip
        );
        
        // Add context if provided
        if (!empty($context)) {
            $logEntry .= "Context: " . json_encode($context, JSON_UNESCAPED_UNICODE) . "\n";
        }
        
        // Add user agent for security logs
        if ($level === self::LEVEL_SECURITY) {
            $logEntry .= "User-Agent: $userAgent\n";
        }
        
        $logEntry .= "---\n";
        
        // Write to log file
        file_put_contents(self::$logFile, $logEntry, FILE_APPEND | LOCK_EX);
        
        // Also write to system error log for critical issues
        if (in_array($level, [self::LEVEL_ERROR, self::LEVEL_CRITICAL, self::LEVEL_SECURITY])) {
            error_log("Kanban $level: $message (User: $user, IP: $ip)");
        }
    }
    
    /**
     * Log info message
     */
    public static function logInfo($message, $context = []) {
        self::log(self::LEVEL_INFO, $message, $context);
    }
    
    /**
     * Log warning message
     */
    public static function logWarning($message, $context = []) {
        self::log(self::LEVEL_WARNING, $message, $context);
    }
    
    /**
     * Log error message
     */
    public static function logError($message, $context = []) {
        self::log(self::LEVEL_ERROR, $message, $context);
    }
    
    /**
     * Log security-related message
     */
    public static function logSecurity($message, $context = []) {
        self::log(self::LEVEL_SECURITY, $message, $context);
    }
    
    /**
     * Log critical message
     */
    public static function logCritical($message, $context = []) {
        self::log(self::LEVEL_CRITICAL, $message, $context);
    }
    
    /**
     * Get current user safely
     */
    private static function getCurrentUser() {
        global $INFO;
        
        // Try multiple sources for user information
        if (isset($_SERVER['REMOTE_USER']) && !empty($_SERVER['REMOTE_USER'])) {
            return $_SERVER['REMOTE_USER'];
        }
        
        if (isset($INFO['client']) && !empty($INFO['client'])) {
            return $INFO['client'];
        }
        
        if (function_exists('auth_quickaclcheck') && isset($GLOBALS['conf'])) {
            global $INPUT;
            if ($INPUT->server->str('REMOTE_USER')) {
                return $INPUT->server->str('REMOTE_USER');
            }
        }
        
        return 'anonymous';
    }
    
    /**
     * Handle uncaught exceptions
     */
    public static function handleException($exception) {
        self::logCritical('Uncaught exception', [
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => self::$isProductionMode ? 'hidden' : $exception->getTraceAsString()
        ]);
        
        self::sendServerError(
            $exception->getMessage(),
            'Une erreur critique est survenue'
        );
    }
    
    /**
     * Set production mode manually
     */
    public static function setProductionMode($isProduction) {
        self::$isProductionMode = $isProduction;
    }
    
    /**
     * Get error statistics for monitoring
     */
    public static function getErrorStats($hours = 24) {
        self::init();
        
        if (!file_exists(self::$logFile)) {
            return ['total' => 0, 'by_level' => []];
        }
        
        $cutoff = time() - ($hours * 3600);
        $stats = ['total' => 0, 'by_level' => []];
        
        $lines = file(self::$logFile, FILE_IGNORE_NEW_LINES);
        foreach ($lines as $line) {
            if (preg_match('/^\[([^\]]+)\] \[([^\]]+)\]/', $line, $matches)) {
                $timestamp = strtotime($matches[1]);
                $level = $matches[2];
                
                if ($timestamp >= $cutoff) {
                    $stats['total']++;
                    $stats['by_level'][$level] = ($stats['by_level'][$level] ?? 0) + 1;
                }
            }
        }
        
        return $stats;
    }
}
