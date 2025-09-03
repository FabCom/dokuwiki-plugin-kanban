<?php
/**
 * Kanban Security Policy Manager
 * Content Security Policy and XSS protection utilities
 * 
 * @author Security Team
 * @version 2.0.0 - Security enhanced
 */

class KanbanSecurityPolicy 
{
    private static $nonces = [];
    private static $cspEnabled = true;
    
    /**
     * Generate a cryptographically secure nonce for inline scripts
     * 
     * @param string $context Context identifier (e.g., 'kanban-main', 'kanban-config')
     * @return string Base64 encoded nonce
     */
    public static function generateNonce($context = 'default')
    {
        if (!isset(self::$nonces[$context])) {
            self::$nonces[$context] = base64_encode(random_bytes(16));
        }
        
        return self::$nonces[$context];
    }
    
    /**
     * Get all generated nonces for CSP header
     * 
     * @return array Array of nonces indexed by context
     */
    public static function getNonces()
    {
        return self::$nonces;
    }
    
    /**
     * Set Content Security Policy header for Kanban plugin
     * 
     * @param bool $strict Whether to use strict CSP or relaxed
     */
    public static function setCSPHeader($strict = false)
    {
        if (!self::$cspEnabled) {
            return;
        }
        
        $nonces = self::getNonces();
        $nonceList = array_map(function($nonce) {
            return "'nonce-$nonce'";
        }, $nonces);
        
        if ($strict) {
            // Strict CSP - only nonces and specific domains
            $csp = "default-src 'self'; " .
                   "script-src 'self' " . implode(' ', $nonceList) . "; " .
                   "style-src 'self' 'unsafe-inline'; " .
                   "img-src 'self' data: blob:; " .
                   "connect-src 'self'; " .
                   "font-src 'self'; " .
                   "object-src 'none'; " .
                   "base-uri 'self'; " .
                   "form-action 'self'";
        } else {
            // Relaxed CSP - compatible with DokuWiki
            $csp = "script-src 'self' 'unsafe-inline' " . implode(' ', $nonceList) . "; " .
                   "object-src 'none'; " .
                   "base-uri 'self'";
        }
        
        // Only set header if not already sent
        if (!headers_sent()) {
            header("Content-Security-Policy: $csp");
            self::logSecurity("CSP header set: $csp");
        } else {
            self::logSecurity("CSP header skipped - headers already sent: $csp");
        }
    }
    
    /**
     * Sanitize user input for safe JavaScript injection
     * 
     * @param string $input User input to sanitize
     * @param string $type Type of input ('username', 'pageid', 'text')
     * @return string Sanitized input
     */
    public static function sanitizeForJS($input, $type = 'text')
    {
        if (!is_string($input)) {
            return '';
        }
        
        $input = trim($input);
        
        switch ($type) {
            case 'username':
                // Username should only contain safe characters
                if (!preg_match('/^[a-zA-Z0-9@._-]+$/', $input)) {
                    self::logSecurity("Suspicious username sanitized: $input");
                    return 'User_' . substr(md5($input), 0, 8);
                }
                return substr($input, 0, 50); // Limit length
                
            case 'pageid':
                // Page ID should follow DokuWiki format
                if (!preg_match('/^[a-zA-Z0-9:_-]+$/', $input)) {
                    self::logSecurity("Invalid page ID sanitized: $input");
                    return '';
                }
                return $input;
                
            case 'text':
            default:
                // General text - remove dangerous characters
                $input = preg_replace('/[<>"\']/', '', $input);
                return substr($input, 0, 200); // Limit length
        }
    }
    
    /**
     * Create safe JSON for JavaScript injection with extra encoding
     * 
     * @param mixed $data Data to encode
     * @return string Safe JSON string
     */
    public static function safeJsonEncode($data)
    {
        return json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE);
    }
    
    /**
     * Generate safe inline script tag with nonce
     * 
     * @param string $script JavaScript code
     * @param string $context Context for nonce generation
     * @return string HTML script tag with nonce
     */
    public static function inlineScript($script, $context = 'default')
    {
        $nonce = self::generateNonce($context);
        $safeScript = htmlspecialchars($script, ENT_QUOTES, 'UTF-8');
        
        return '<script type="text/javascript" nonce="' . 
               htmlspecialchars($nonce, ENT_QUOTES, 'UTF-8') . '">' . 
               $script . '</script>';
    }
    
    /**
     * Validate and sanitize HTML attributes
     * 
     * @param string $attribute Attribute value
     * @param string $type Type of attribute ('class', 'id', 'data-*')
     * @return string Sanitized attribute
     */
    public static function sanitizeAttribute($attribute, $type = 'general')
    {
        $attribute = trim($attribute);
        
        switch ($type) {
            case 'class':
                return preg_replace('/[^a-zA-Z0-9_-]/', '', $attribute);
                
            case 'id':
                return preg_replace('/[^a-zA-Z0-9_-]/', '', $attribute);
                
            case 'data':
                return preg_replace('/[^a-zA-Z0-9:._-]/', '', $attribute);
                
            default:
                return htmlspecialchars($attribute, ENT_QUOTES, 'UTF-8');
        }
    }
    
    /**
     * Check if string contains potential XSS patterns
     * 
     * @param string $input Input to check
     * @return bool True if suspicious patterns found
     */
    public static function detectXSSPatterns($input)
    {
        $patterns = [
            '/<script[^>]*>/i',
            '/javascript:/i',
            '/on\w+\s*=/i',
            '/<iframe[^>]*>/i',
            '/<object[^>]*>/i',
            '/<embed[^>]*>/i',
            '/expression\s*\(/i',
            '/vbscript:/i',
            '/data:text\/html/i'
        ];
        
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $input)) {
                self::logSecurity("XSS pattern detected: $pattern in input: " . substr($input, 0, 100));
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Enable or disable CSP functionality
     * 
     * @param bool $enabled Whether CSP should be enabled
     */
    public static function setCSPEnabled($enabled)
    {
        self::$cspEnabled = (bool)$enabled;
    }
    
    /**
     * Log security events
     * 
     * @param string $message Security message
     */
    private static function logSecurity($message)
    {
        global $conf;
        
        if ($conf['plugin']['kanban']['log_security_events'] ?? true) {
            $user = $_SERVER['REMOTE_USER'] ?? 'anonymous';
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            error_log("Kanban SECURITY [CSP]: $message (User: $user, IP: $ip)");
        }
    }
}
