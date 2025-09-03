<?php
/**
 * Kanban Plugin - Media List AJAX Endpoint
 * 
 * Provides media file listing with proper ACL checks
 * Inspired by QuillJS plugin but independent implementation
 * 
 * @license GPL 2 (http://www.gnu.org/licenses/gpl.html)
 * @author  Kanban Plugin Team
 */

// Include DokuWiki core
if (!defined('DOKU_INC')) {
    define('DOKU_INC', dirname(__FILE__) . '/../../../../');
}
require_once(DOKU_INC . 'inc/init.php');
require_once(DOKU_INC . 'inc/media.php');

// Security check
$currentUser = $_SERVER['REMOTE_USER'] ?? null;
$isAuthenticated = !empty($currentUser);
$isCLI = php_sapi_name() === 'cli';
$isAjax = isset($_SERVER['HTTP_X_REQUESTED_WITH']) && $_SERVER['HTTP_X_REQUESTED_WITH'] === 'XMLHttpRequest';

// Allow access for CLI testing or authenticated AJAX requests
if (!$isCLI && !$isAjax) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Bad Request - AJAX required']);
    exit;
}

// Check authentication for web requests (skip for CLI)
if (!$isCLI && $conf['useacl'] && !$isAuthenticated) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Authentication required']);
    exit;
}

// For web requests, check if user has at least read access to media
if (!$isCLI && $conf['useacl']) {
    $mediaAuth = auth_quickaclcheck('*');
    if ($mediaAuth < AUTH_READ) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Insufficient permissions to access media']);
        exit;
    }
}

/**
 * Get media list for a given namespace with ACL checks
 */
function getMediaList($namespace = '') {
    global $conf;
    
    $mediadir = $conf['mediadir'];
    $result = [
        'namespace' => $namespace,
        'folders' => [],
        'files' => [],
        'breadcrumb' => []
    ];
    
    // Sanitize namespace
    $namespace = cleanID($namespace);
    $dir = $mediadir . '/' . str_replace(':', '/', $namespace);
    
    // Security check - ensure we're within media directory
    $realMediaDir = realpath($mediadir);
    $realTargetDir = realpath($dir);
    
    if (!$realTargetDir || strpos($realTargetDir, $realMediaDir) !== 0) {
        return $result;
    }
    
    // Check ACL permissions for this namespace
    if (!auth_quickaclcheck($namespace . ':*') >= AUTH_READ) {
        return $result;
    }
    
    // Build breadcrumb
    $result['breadcrumb'] = buildBreadcrumb($namespace);
    
    // Read directory contents
    if (is_dir($dir)) {
        $items = scandir($dir);
        
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            
            $fullPath = $dir . '/' . $item;
            $itemNamespace = $namespace ? $namespace . ':' . $item : $item;
            
            if (is_dir($fullPath)) {
                // Check ACL for subdirectory
                if (auth_quickaclcheck($itemNamespace . ':*') >= AUTH_READ) {
                    $result['folders'][] = [
                        'name' => $item,
                        'namespace' => $itemNamespace,
                        'path' => $itemNamespace
                    ];
                }
            } else {
                // Check if it's a valid media file
                $info = pathinfo($item);
                $ext = isset($info['extension']) ? strtolower($info['extension']) : '';
                
                if (isValidMediaExtension($ext)) {
                    // Check ACL for file
                    if (auth_quickaclcheck($itemNamespace) >= AUTH_READ) {
                        $mediaInfo = getMediaInfo($fullPath, $itemNamespace);
                        if ($mediaInfo) {
                            $result['files'][] = $mediaInfo;
                        }
                    }
                }
            }
        }
    }
    
    // Sort results
    usort($result['folders'], function($a, $b) {
        return strcmp($a['name'], $b['name']);
    });
    
    usort($result['files'], function($a, $b) {
        return strcmp($a['name'], $b['name']);
    });
    
    return $result;
}

/**
 * Build breadcrumb navigation
 */
function buildBreadcrumb($namespace) {
    $breadcrumb = [
        ['name' => 'Racine', 'namespace' => '', 'path' => '']
    ];
    
    if ($namespace) {
        $parts = explode(':', $namespace);
        $current = '';
        
        foreach ($parts as $part) {
            $current = $current ? $current . ':' . $part : $part;
            $breadcrumb[] = [
                'name' => $part,
                'namespace' => $current,
                'path' => $current
            ];
        }
    }
    
    return $breadcrumb;
}

/**
 * Get media file information
 */
function getMediaInfo($filePath, $mediaId) {
    $info = pathinfo($filePath);
    $ext = isset($info['extension']) ? strtolower($info['extension']) : '';
    
    // File size
    $size = filesize($filePath);
    $sizeHuman = formatBytes($size);
    
    // File type
    $type = getMediaType($ext);
    
    // Modification date
    $mtime = filemtime($filePath);
    
    // Base result
    $result = [
        'id' => $mediaId,
        'name' => $info['basename'],
        'filename' => $info['filename'],
        'extension' => $ext,
        'type' => $type,
        'size' => $size,
        'size_human' => $sizeHuman,
        'mtime' => $mtime,
        'mtime_human' => date('Y-m-d H:i:s', $mtime),
        'url' => ml($mediaId),
        'path' => $filePath
    ];
    
        // Add thumbnail for images
    if ($type === 'image') {
        // Use DokuWiki's media_get_token for proper authentication
        $token = media_get_token($mediaId, 150, 150);
        $result['thumb'] = DOKU_BASE . 'lib/exe/fetch.php?media=' . rawurlencode($mediaId) . '&w=150&h=150&tok=' . $token;
    }
    
    return $result;
}

/**
 * Check if extension is valid for media
 */
function isValidMediaExtension($ext) {
    global $conf;
    
    $allowedExtensions = [
        // Images
        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp',
        // Documents
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'odt', 'ods', 'odp', 'rtf', 'txt',
        // Audio
        'mp3', 'wav', 'ogg', 'aac', 'm4a',
        // Video
        'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm',
        // Archives
        'zip', 'rar', '7z', 'tar', 'gz'
    ];
    
    return in_array($ext, $allowedExtensions);
}

/**
 * Determine media type from extension
 */
function getMediaType($ext) {
    $imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    $audioExts = ['mp3', 'wav', 'ogg', 'aac', 'm4a'];
    $videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    $docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'txt'];
    
    if (in_array($ext, $imageExts)) return 'image';
    if (in_array($ext, $audioExts)) return 'audio';
    if (in_array($ext, $videoExts)) return 'video';
    if (in_array($ext, $docExts)) return 'document';
    
    return 'file';
}

/**
 * Format bytes to human readable
 */
function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB'];
    
    for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
        $bytes /= 1024;
    }
    
    return round($bytes, $precision) . ' ' . $units[$i];
}

/**
 * Search media files
 */
function searchMedia($query, $namespace = '') {
    global $conf;
    
    $mediadir = $conf['mediadir'];
    $results = [
        'query' => $query,
        'namespace' => $namespace,
        'files' => []
    ];
    
    // Search recursively
    $searchDir = $mediadir;
    if ($namespace) {
        $searchDir .= '/' . str_replace(':', '/', $namespace);
    }
    
    if (is_dir($searchDir)) {
        searchMediaRecursive($searchDir, $query, $namespace, $results['files']);
    }
    
    // Sort by relevance (name match first, then content)
    usort($results['files'], function($a, $b) use ($query) {
        $aScore = (stripos($a['name'], $query) !== false) ? 1 : 0;
        $bScore = (stripos($b['name'], $query) !== false) ? 1 : 0;
        
        if ($aScore !== $bScore) {
            return $bScore - $aScore;
        }
        
        return strcmp($a['name'], $b['name']);
    });
    
    return $results;
}

/**
 * Recursive media search
 */
function searchMediaRecursive($dir, $query, $baseNamespace, &$results) {
    $items = scandir($dir);
    
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        
        $fullPath = $dir . '/' . $item;
        
        if (is_dir($fullPath)) {
            $newNamespace = $baseNamespace ? $baseNamespace . ':' . $item : $item;
            if (auth_quickaclcheck($newNamespace . ':*') >= AUTH_READ) {
                searchMediaRecursive($fullPath, $query, $newNamespace, $results);
            }
        } else {
            // Check if filename matches query
            if (stripos($item, $query) !== false) {
                $info = pathinfo($item);
                $ext = isset($info['extension']) ? strtolower($info['extension']) : '';
                
                if (isValidMediaExtension($ext)) {
                    $mediaId = $baseNamespace ? $baseNamespace . ':' . $item : $item;
                    
                    if (auth_quickaclcheck($mediaId) >= AUTH_READ) {
                        $mediaInfo = getMediaInfo($fullPath, $mediaId);
                        if ($mediaInfo) {
                            $results[] = $mediaInfo;
                        }
                    }
                }
            }
        }
    }
}

// Main execution
header('Content-Type: application/json');

try {
    $action = $_GET['action'] ?? 'list';
    $namespace = $_GET['ns'] ?? '';
    $query = $_GET['q'] ?? '';
    
    switch ($action) {
        case 'list':
            $result = getMediaList($namespace);
            break;
            
        case 'search':
            $result = searchMedia($query, $namespace);
            break;
            
        default:
            throw new Exception('Invalid action');
    }
    
    echo json_encode($result);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
