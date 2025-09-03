<?php
/**
 * Kanban Lock Manager - Atomic Locking System
 * Secure lock management with atomic operations and automatic cleanup
 * 
 * @author Security Team
 * @version 2.0.0 - Security enhanced
 */

class KanbanLockManager 
{
    private $lockDir;
    private $maxLockTime;
    private $lockPrefix = 'kanban_';
    
    public function __construct() 
    {
        global $conf;
        
        $this->lockDir = DOKU_INC . 'data/locks/';
        $this->maxLockTime = $conf['plugin']['kanban']['max_lock_time'] ?? 900; // 15 minutes default
        
        // Ensure lock directory exists with proper permissions
        if (!is_dir($this->lockDir)) {
            if (!mkdir($this->lockDir, 0755, true)) {
                throw new Exception("Cannot create lock directory: " . $this->lockDir);
            }
        }
    }
    
    /**
     * Acquire an atomic lock for a page
     * 
     * @param string $pageId DokuWiki page ID
     * @param string $user Authenticated user
     * @return array Lock result with status and info
     */
    public function acquireLock($pageId, $user)
    {
        if (empty($pageId) || empty($user)) {
            return $this->errorResult("Invalid parameters for lock acquisition");
        }
        
        // Validate page ID format for security
        if (!preg_match('/^[a-zA-Z0-9:_-]+$/', $pageId)) {
            $this->logSecurity("Invalid page ID format for lock: $pageId", $user);
            return $this->errorResult("Invalid page ID format");
        }
        
        $lockFile = $this->getLockFilePath($pageId);
        
        // Clean up expired locks first
        $this->cleanupExpiredLocks();
        
        // Try DokuWiki native lock first
        $nativeLock = $this->tryNativeLock($pageId);
        if ($nativeLock['success']) {
            $this->logSecurity("Native lock acquired for page: $pageId", $user);
            return $nativeLock;
        }
        
        // Fall back to our atomic lock system
        return $this->acquireAtomicLock($lockFile, $pageId, $user);
    }
    
    /**
     * Release a lock for a page
     * 
     * @param string $pageId DokuWiki page ID
     * @param string $user Authenticated user
     * @return array Release result
     */
    public function releaseLock($pageId, $user)
    {
        if (empty($pageId) || empty($user)) {
            return $this->errorResult("Invalid parameters for lock release");
        }
        
        $lockFile = $this->getLockFilePath($pageId);
        
        // Try DokuWiki native unlock first
        $unlocked = unlock($pageId);
        
        // Also remove our custom lock file if it exists
        if (file_exists($lockFile)) {
            $lockInfo = $this->readLockFile($lockFile);
            
            // Verify ownership before releasing
            if ($lockInfo && $lockInfo['user'] === $user) {
                if (unlink($lockFile)) {
                    $this->logSecurity("Custom lock released for page: $pageId", $user);
                } else {
                    $this->logSecurity("Failed to remove custom lock file: $lockFile", $user);
                }
            } else {
                $this->logSecurity("Lock release denied - not owner. Page: $pageId, Lock owner: " . 
                                 ($lockInfo['user'] ?? 'unknown') . ", Requestor: $user", $user);
                return $this->errorResult("Not authorized to release this lock");
            }
        }
        
        return [
            'success' => true,
            'message' => $unlocked ? 'Lock released successfully' : 'No lock to release',
            'locked' => false
        ];
    }
    
    /**
     * Check if a page is locked and by whom
     * 
     * @param string $pageId DokuWiki page ID
     * @param string $currentUser Current authenticated user
     * @return array Lock status information
     */
    public function checkLock($pageId, $currentUser = null)
    {
        if (empty($pageId)) {
            return $this->errorResult("Invalid page ID for lock check");
        }
        
        // Check DokuWiki native lock first
        $nativeLockUser = checklock($pageId);
        if ($nativeLockUser) {
            $isLockedByOther = $currentUser && ($nativeLockUser !== $currentUser);
            return [
                'locked' => $isLockedByOther,
                'locked_by' => $isLockedByOther ? $nativeLockUser : null,
                'lock_type' => 'native',
                'page_id' => $pageId
            ];
        }
        
        // Check our custom lock
        $lockFile = $this->getLockFilePath($pageId);
        if (file_exists($lockFile)) {
            $lockInfo = $this->readLockFile($lockFile);
            
            if ($lockInfo) {
                // Check if lock is expired
                if ($this->isLockExpired($lockInfo['timestamp'])) {
                    $this->logSecurity("Expired lock detected and removed: $pageId", $lockInfo['user']);
                    unlink($lockFile);
                    return ['locked' => false, 'locked_by' => null, 'page_id' => $pageId];
                }
                
                $isLockedByOther = $currentUser && ($lockInfo['user'] !== $currentUser);
                return [
                    'locked' => $isLockedByOther,
                    'locked_by' => $isLockedByOther ? $lockInfo['user'] : null,
                    'lock_type' => 'custom',
                    'expires_at' => $lockInfo['timestamp'] + $this->maxLockTime,
                    'page_id' => $pageId
                ];
            }
        }
        
        return ['locked' => false, 'locked_by' => null, 'page_id' => $pageId];
    }
    
    /**
     * Renew a lock to extend its expiration
     * 
     * @param string $pageId DokuWiki page ID
     * @param string $user Authenticated user
     * @return array Renewal result
     */
    public function renewLock($pageId, $user)
    {
        if (empty($pageId) || empty($user)) {
            return $this->errorResult("Invalid parameters for lock renewal");
        }
        
        $lockFile = $this->getLockFilePath($pageId);
        
        if (!file_exists($lockFile)) {
            return $this->errorResult("No lock found to renew");
        }
        
        $lockInfo = $this->readLockFile($lockFile);
        if (!$lockInfo || $lockInfo['user'] !== $user) {
            $this->logSecurity("Lock renewal denied - not owner. Page: $pageId", $user);
            return $this->errorResult("Not authorized to renew this lock");
        }
        
        // Renew the lock with atomic operation
        $lockData = $this->createLockData($user);
        if ($this->writeAtomicLock($lockFile, $lockData)) {
            $this->logSecurity("Lock renewed for page: $pageId", $user);
            return [
                'success' => true,
                'message' => 'Lock renewed successfully',
                'renewed_at' => time(),
                'expires_at' => time() + $this->maxLockTime
            ];
        }
        
        return $this->errorResult("Failed to renew lock");
    }
    
    /**
     * Clean up all expired locks
     * 
     * @return int Number of locks cleaned up
     */
    public function cleanupExpiredLocks()
    {
        $cleaned = 0;
        $pattern = $this->lockDir . $this->lockPrefix . '*.lock';
        
        foreach (glob($pattern) as $lockFile) {
            $lockInfo = $this->readLockFile($lockFile);
            
            if ($lockInfo && $this->isLockExpired($lockInfo['timestamp'])) {
                if (unlink($lockFile)) {
                    $cleaned++;
                    $this->logSecurity("Expired lock cleaned: " . basename($lockFile), 'system');
                }
            }
        }
        
        return $cleaned;
    }
    
    /**
     * Try to acquire DokuWiki native lock
     */
    private function tryNativeLock($pageId)
    {
        global $ID;
        $originalID = $ID;
        $ID = $pageId;
        
        // Check write permissions
        $pageInfo = pageinfo();
        if (!$pageInfo['writable']) {
            $ID = $originalID;
            return $this->errorResult("Page not writable");
        }
        
        // Check if already locked
        $lockedBy = checklock($pageId);
        if ($lockedBy) {
            $ID = $originalID;
            return $this->errorResult("Page already locked by: $lockedBy");
        }
        
        // Try to acquire lock
        lock($pageId);
        $lockedBy = checklock($pageId);
        
        $ID = $originalID;
        
        if ($lockedBy) {
            return [
                'success' => true,
                'locked_by' => $lockedBy,
                'lock_type' => 'native'
            ];
        }
        
        return $this->errorResult("Native lock failed");
    }
    
    /**
     * Acquire atomic lock using file locking
     */
    private function acquireAtomicLock($lockFile, $pageId, $user)
    {
        // Check if already locked by reading existing file
        if (file_exists($lockFile)) {
            $lockInfo = $this->readLockFile($lockFile);
            
            if ($lockInfo) {
                if ($this->isLockExpired($lockInfo['timestamp'])) {
                    // Lock expired, remove it
                    unlink($lockFile);
                    $this->logSecurity("Expired lock removed: $pageId", $user);
                } else {
                    // Lock still valid
                    $this->logSecurity("Lock acquisition failed - already locked: $pageId", $user);
                    return $this->errorResult("Page locked by: " . $lockInfo['user']);
                }
            }
        }
        
        // Create lock atomically
        $lockData = $this->createLockData($user);
        
        if ($this->writeAtomicLock($lockFile, $lockData)) {
            $this->logSecurity("Atomic lock acquired for page: $pageId", $user);
            return [
                'success' => true,
                'locked_by' => $user,
                'lock_type' => 'atomic',
                'expires_at' => time() + $this->maxLockTime
            ];
        }
        
        return $this->errorResult("Failed to acquire atomic lock");
    }
    
    /**
     * Write lock data atomically using flock
     */
    private function writeAtomicLock($lockFile, $lockData)
    {
        $tempFile = $lockFile . '.tmp.' . uniqid();
        
        // Write to temporary file first
        $fp = fopen($tempFile, 'w');
        if (!$fp) {
            return false;
        }
        
        // Acquire exclusive lock
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            unlink($tempFile);
            return false;
        }
        
        // Write data
        $written = fwrite($fp, $lockData);
        
        // Release lock and close
        flock($fp, LOCK_UN);
        fclose($fp);
        
        if ($written === false) {
            unlink($tempFile);
            return false;
        }
        
        // Atomically move temp file to final location
        if (rename($tempFile, $lockFile)) {
            chmod($lockFile, 0644);
            return true;
        }
        
        unlink($tempFile);
        return false;
    }
    
    /**
     * Read lock file safely
     */
    private function readLockFile($lockFile)
    {
        if (!file_exists($lockFile)) {
            return null;
        }
        
        $content = file_get_contents($lockFile);
        if ($content === false) {
            return null;
        }
        
        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            // Try legacy format: "user|timestamp"
            $parts = explode('|', $content, 2);
            if (count($parts) === 2) {
                return [
                    'user' => $parts[0],
                    'timestamp' => (int)$parts[1]
                ];
            }
            return null;
        }
        
        return $data;
    }
    
    /**
     * Create lock data structure
     */
    private function createLockData($user)
    {
        return json_encode([
            'user' => $user,
            'timestamp' => time(),
            'pid' => getmypid(),
            'version' => '2.0'
        ], JSON_UNESCAPED_UNICODE);
    }
    
    /**
     * Check if lock is expired
     */
    private function isLockExpired($timestamp)
    {
        return (time() - $timestamp) > $this->maxLockTime;
    }
    
    /**
     * Get information about a lock
     * 
     * @param string $pageId The page identifier
     * @return array Lock information including status, owner, and expiration
     */
    public function getLockInfo($pageId)
    {
        if (empty($pageId)) {
            return [
                'locked' => false,
                'locked_by' => null,
                'lock_type' => null,
                'expires_at' => null
            ];
        }

        // Try DokuWiki native lock first
        $nativeLock = checklock($pageId);
        if ($nativeLock) {
            return [
                'locked' => true,
                'locked_by' => $nativeLock,
                'lock_type' => 'native',
                'expires_at' => null // DokuWiki doesn't expose expiration time
            ];
        }

        // Check atomic lock file
        $lockFile = $this->getLockFilePath($pageId);
        if (!file_exists($lockFile)) {
            return [
                'locked' => false,
                'locked_by' => null,
                'lock_type' => null,
                'expires_at' => null
            ];
        }

        // Read lock file atomically
        $handle = fopen($lockFile, 'r');
        if (!$handle) {
            error_log("Kanban Lock Manager: Cannot read lock file: $lockFile");
            return [
                'locked' => false,
                'locked_by' => null,
                'lock_type' => null,
                'expires_at' => null
            ];
        }

        if (flock($handle, LOCK_SH)) {
            $lockData = fread($handle, filesize($lockFile));
            flock($handle, LOCK_UN);
            fclose($handle);

            if (empty($lockData)) {
                return [
                    'locked' => false,
                    'locked_by' => null,
                    'lock_type' => null,
                    'expires_at' => null
                ];
            }

            // Parse lock data
            $parts = explode('|', $lockData);
            if (count($parts) >= 2) {
                $lockedBy = trim($parts[0]);
                $timestamp = intval($parts[1]);
                $expiresAt = $timestamp + $this->maxLockTime;

                // Check if lock is expired
                if (time() > $expiresAt) {
                    // Lock expired, clean it up
                    fclose($handle);
                    $this->cleanupExpiredLock($pageId);
                    return [
                        'locked' => false,
                        'locked_by' => null,
                        'lock_type' => null,
                        'expires_at' => null
                    ];
                }

                return [
                    'locked' => true,
                    'locked_by' => $lockedBy,
                    'lock_type' => 'atomic',
                    'expires_at' => $expiresAt
                ];
            }
        } else {
            fclose($handle);
            error_log("Kanban Lock Manager: Cannot acquire read lock for: $lockFile");
        }

        return [
            'locked' => false,
            'locked_by' => null,
            'lock_type' => null,
            'expires_at' => null
        ];
    }

    /**
     * Get lock status in a simplified format for AJAX responses
     * 
     * @param string $pageId The page identifier
     * @return array Lock status information
     */
    public function getLockStatus($pageId)
    {
        $lockInfo = $this->getLockInfo($pageId);
        
        return [
            'locked' => $lockInfo['locked'],
            'locked_by' => $lockInfo['locked_by'],
            'lock_type' => $lockInfo['lock_type'],
            'expires_at' => $lockInfo['expires_at'],
            'can_override' => false, // For future implementation
            'timestamp' => time()
        ];
    }

    /**
     * Clean up an expired lock file safely
     * 
     * @param string $pageId The page identifier
     * @return bool Success status
     */
    private function cleanupExpiredLock($pageId)
    {
        $lockFile = $this->getLockFilePath($pageId);
        
        if (!file_exists($lockFile)) {
            return true;
        }

        // Double-check expiration while holding exclusive lock
        $handle = fopen($lockFile, 'r+');
        if (!$handle) {
            return false;
        }

        if (flock($handle, LOCK_EX)) {
            $lockData = fread($handle, filesize($lockFile));
            $parts = explode('|', $lockData);
            
            if (count($parts) >= 2) {
                $timestamp = intval($parts[1]);
                $expiresAt = $timestamp + $this->maxLockTime;

                // Only delete if still expired
                if (time() > $expiresAt) {
                    flock($handle, LOCK_UN);
                    fclose($handle);
                    unlink($lockFile);
                    error_log("Kanban Lock Manager: Cleaned up expired lock for: $pageId");
                    return true;
                }
            }
            
            flock($handle, LOCK_UN);
        }
        
        fclose($handle);
        return false;
    }

    /**
     * Get the file path for a page lock
     * 
     * @param string $pageId The page identifier
     * @return string The lock file path
     */
    private function getLockFilePath($pageId)
    {
        // Sanitize page ID for filesystem
        $safePageId = str_replace([':', '/', '\\'], '_', $pageId);
        return $this->lockDir . $safePageId . '.kanban.lock';
    }

    /**
     * Create error result
     */
    private function errorResult($message)
    {
        return [
            'success' => false,
            'error' => $message,
            'locked' => false
        ];
    }
    
    /**
     * Log security events
     */
    private function logSecurity($message, $user)
    {
        global $conf;
        
        if ($conf['plugin']['kanban']['log_security_events'] ?? true) {
            error_log("Kanban SECURITY [Lock]: $message (User: $user, IP: " . 
                     ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . ")");
        }
    }
}
