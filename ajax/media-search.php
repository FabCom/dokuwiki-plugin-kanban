<?php
/**
 * AJAX endpoint pour la recherche globale de médias DokuWiki - Plugin Kanban
 * Inspiré de lib/plugins/quilljs/ajax/media-search.php
 */

if (!defined('DOKU_INC')) define('DOKU_INC', dirname(__FILE__) . '/../../../../');
require_once(DOKU_INC . 'inc/init.php');
require_once(DOKU_INC . 'inc/media.php');
require_once(DOKU_INC . 'inc/auth.php');

// Initialiser l'environnement DokuWiki
global $INPUT, $conf, $INFO;

// Vérifier que c'est une requête AJAX ou POST
$isAjax = (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && $_SERVER['HTTP_X_REQUESTED_WITH'] === 'XMLHttpRequest');
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';

if (!$isAjax && !$isPost) {
    http_response_code(400);
    header('Content-Type: application/json');
    die(json_encode(['success' => false, 'message' => 'Bad Request']));
}

// Récupérer les paramètres depuis GET ou POST
$query = $_REQUEST['q'] ?? $_REQUEST['query'] ?? '';
$maxResults = (int)($_REQUEST['limit'] ?? 50);

if (strlen($query) < 2) {
    http_response_code(400);
    header('Content-Type: application/json');
    die(json_encode(['success' => false, 'message' => 'Query too short (minimum 2 characters)']));
}

header('Content-Type: application/json');

/**
 * Recherche récursive dans tous les dossiers de médias accessibles
 */
function searchMediaGlobally($query, $maxResults = 50) {
    global $conf;
    
    $mediadir = $conf['mediadir'];
    $results = [];
    $query = strtolower($query);
    
    // Fonction récursive pour parcourir les dossiers
    $scanDirectory = function($dir, $namespace = '') use (&$results, $query, $maxResults, &$scanDirectory) {
        if (count($results) >= $maxResults) {
            return;
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
