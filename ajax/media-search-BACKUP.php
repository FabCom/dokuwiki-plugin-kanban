<?php
/**
 * AJAX endpoint pour la recherche globale de médias DokuWiki - Plugin Kanban
 * SECURITY ENHANCED - Version sécurisée avec validation complète
 * 
 * @author Security Team
 * @version 2.0.0 - Security enhanced
 */

if (!defined('DOKU_INC')) define('DOKU_INC', dirname(__FILE__) . '/../../../../');
require_once(DOKU_INC . 'inc/init.php');
require_once(DOKU_INC . 'inc/media.php');
require_once(DOKU_INC . 'inc/auth.php');

// Load security validator
require_once(dirname(__FILE__) . '/../KanbanAjaxValidator.php');

// Initialize security validator
$validator = new KanbanAjaxValidator();

// SECURITY: Validate AJAX request with strict requirements
$validationResult = $validator->validateAjaxRequest([
    'require_auth' => true,
    'require_ajax_header' => true,
    'allowed_methods' => ['GET', 'POST'],
    'min_auth_level' => AUTH_READ
]);

if (!$validationResult['success']) {
    header('Content-Type: application/json');
    echo json_encode($validationResult);
    exit;
}

// SECURITY: Get and validate search parameters securely
$query = $_GET['q'] ?? $_POST['q'] ?? $_GET['query'] ?? $_POST['query'] ?? '';
$maxResults = $_GET['limit'] ?? $_POST['limit'] ?? 50;

// SECURITY: Validate search query
$queryValidation = $validator->validateSearchQuery($query, $maxResults);
if (!$queryValidation['success']) {
    header('Content-Type: application/json');
    echo json_encode($queryValidation);
    exit;
}

$query = $queryValidation['data']['query'];
$maxResults = $queryValidation['data']['limit'];

header('Content-Type: application/json');

/**
 * SECURITY ENHANCED: Recherche sécurisée dans les médias avec contrôle ACL strict
 * 
 * @param string $query Search query (validated)
 * @param int $maxResults Maximum results (validated)
 * @return array Search results with security checks
 */
function searchMediaSecurely($query, $maxResults = 50) {
    global $conf;
    
    $mediadir = $conf['mediadir'];
    $results = [];
    $query = strtolower($query);
    $processedFiles = 0;
    
    // SECURITY: Strict validation of media directory
    if (!is_dir($mediadir) || !is_readable($mediadir)) {
        error_log("Kanban SECURITY: Media directory not accessible: $mediadir");
        return ['error' => 'Media directory not accessible'];
    }
    
    // SECURITY: Récursion sécurisée avec limites strictes
    $scanDirectory = function($dir, $namespace = '') use (&$results, $query, $maxResults, &$scanDirectory, &$processedFiles) {
        // SECURITY: Limite le nombre de fichiers traités pour éviter DoS
        if (count($results) >= $maxResults || $processedFiles > 1000) {
            return;
        }
        
        // SECURITY: Validation du chemin pour éviter path traversal
        $realDir = realpath($dir);
        $realMediaDir = realpath($GLOBALS['conf']['mediadir']);
        
        if (!$realDir || strpos($realDir, $realMediaDir) !== 0) {
            error_log("Kanban SECURITY: Path traversal attempt blocked: $dir");
            return;
        }
        
        $handle = @opendir($dir);
        if (!$handle) {
            return;
        }
        
        while (($item = readdir($handle)) !== false) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            
            $processedFiles++;
            
            // SECURITY: Limite stricte pour éviter l'épuisement des ressources
            if ($processedFiles > 1000) {
                break;
            }
            
            $itemPath = $dir . '/' . $item;
            $itemNamespace = $namespace ? $namespace . ':' . $item : $item;
            
            if (is_dir($itemPath)) {
                // SECURITY: Vérifier les permissions sur le namespace avant descente
                $testId = $itemNamespace . ':*';
                $auth = auth_quickaclcheck($testId);
                
                if ($auth >= AUTH_READ) {
                    $scanDirectory($itemPath, $itemNamespace);
                }
            } else {
                // SECURITY: Validation stricte du fichier
                if (!is_file($itemPath) || !is_readable($itemPath)) {
                    continue;
                }
                
                // SECURITY: Vérifier les permissions spécifiques du fichier
                $mediaId = $itemNamespace;
                $auth = auth_quickaclcheck($mediaId);
                
                if ($auth >= AUTH_READ) {
                    // SECURITY: Recherche sécurisée (pas d'exécution de code)
                    $itemLower = strtolower($item);
                    if (strpos($itemLower, $query) !== false) {
                        // SECURITY: Validation de l'extension avant inclusion
                        $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
                        $allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'pdf', 'mp4', 'avi', 'mp3'];
                        
                        if (in_array($ext, $allowedExts)) {
                            $results[] = [
                                'id' => $mediaId,
                                'name' => pathinfo($item, PATHINFO_FILENAME),
                                'filename' => $item,
                                'namespace' => $namespace,
                                'path' => $itemPath,
                                'ext' => $ext,
                                'size' => filesize($itemPath),
                                'url' => DOKU_BASE . 'lib/exe/fetch.php?media=' . rawurlencode($mediaId)
                            ];
                        }
                    }
                }
            }
        }
        
        closedir($handle);
    };
    
    // SECURITY: Commencer la recherche avec validation
    try {
        $scanDirectory($mediadir);
    } catch (Exception $e) {
        error_log("Kanban SECURITY: Search error: " . $e->getMessage());
        return ['error' => 'Search error occurred'];
    }
    
    return $results;
}
        }
        
        if (!is_dir($dir)) {
            return;
        }
        
        $handle = opendir($dir);
        if (!$handle) {
            return;
        }
        
        while (false !== ($entry = readdir($handle)) && count($results) < $maxResults) {
            if ($entry === '.' || $entry === '..') continue;
            
            $fullPath = $dir . '/' . $entry;
            $mediaId = ($namespace ? $namespace . ':' : '') . $entry;
            
            if (is_dir($fullPath)) {
                // Vérifier les permissions sur le dossier
                if (auth_quickaclcheck($mediaId . ':*') >= AUTH_READ) {
                    $scanDirectory($fullPath, $mediaId);
                }
            } else if (is_file($fullPath)) {
                // Vérifier que c'est un fichier média supporté
                $ext = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
                $supportedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf', 'doc', 'docx', 'txt', 'mp4', 'avi', 'mov', 'webm', 'ogv'];
                
                if (in_array($ext, $supportedTypes)) {
                    // Vérifier les permissions sur le fichier
                    if (auth_quickaclcheck($mediaId) >= AUTH_READ) {
                        // Vérifier si le nom contient la recherche
                        if (strpos(strtolower($entry), $query) !== false) {
                            $filesize = filesize($fullPath);
                            $mtime = filemtime($fullPath);
                            
                            // Déterminer le type de média
                            $imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
                            $videoTypes = ['mp4', 'avi', 'mov', 'webm', 'ogv'];
                            
                            $mediaType = 'document';
                            if (in_array($ext, $imageTypes)) {
                                $mediaType = 'image';
                            } else if (in_array($ext, $videoTypes)) {
                                $mediaType = 'video';
                            }
                            
                            $result = [
                                'type' => 'file',
                                'mediaType' => $mediaType,
                                'id' => $mediaId,
                                'name' => pathinfo($entry, PATHINFO_FILENAME),
                                'filename' => $entry,
                                'namespace' => $namespace,
                                'ext' => $ext,
                                'size' => $filesize,
                                'mtime' => $mtime,
                                'url' => DOKU_BASE . 'lib/exe/fetch.php?media=' . rawurlencode($mediaId)
                            ];
                            
                            // Ajouter thumbnail pour les images
                            if ($mediaType === 'image') {
                                $thumbToken = media_get_token($mediaId, 150, 150);
                                $result['thumb'] = DOKU_BASE . 'lib/exe/fetch.php?media=' . rawurlencode($mediaId) . '&w=150&h=150&tok=' . $thumbToken;
                            }
                            
                            $results[] = $result;
                        }
                    }
                }
            }
        }
        
        closedir($handle);
    };
    
    // Commencer la recherche depuis la racine des médias
    $scanDirectory($mediadir);
    
    return $results;
}

try {
    $results = searchMediaGlobally($query, $maxResults);
    
    // S'assurer que $results est un tableau
    if (!is_array($results)) {
        $results = [];
    }
    
    echo json_encode([
        'success' => true,
        'query' => $query,
        'results' => $results,
        'count' => count($results),
        'maxResults' => $maxResults
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Search error: ' . $e->getMessage()
    ]);
}
?>
