<?php
/**
 * AJAX endpoint pour l'upload de médias DokuWiki - Plugin Kanban
 * Version simplifiée inspirée de lib/plugins/quilljs/ajax/media-upload.php
 */

if (!defined('DOKU_INC')) define('DOKU_INC', dirname(__FILE__) . '/../../../../');
require_once(DOKU_INC . 'inc/init.php');
require_once(DOKU_INC . 'inc/media.php');
require_once(DOKU_INC . 'inc/auth.php');

// S'assurer que les constantes d'auth sont définies
if (!defined('AUTH_UPLOAD')) {
    define('AUTH_UPLOAD', 8);
}

// Mode debug (à désactiver en production)
$DEBUG_MODE = true;

// Fonction de debug
function debugLog($message) {
    global $DEBUG_MODE;
    if ($DEBUG_MODE) {
        error_log('Kanban Media Upload: ' . $message);
    }
}

debugLog('Upload request received from: ' . ($_SERVER['REMOTE_USER'] ?? 'anonymous'));

// Vérifier que c'est une requête AJAX POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['success' => false, 'message' => 'Method not allowed']));
}

if (!isset($_SERVER['HTTP_X_REQUESTED_WITH']) || $_SERVER['HTTP_X_REQUESTED_WITH'] !== 'XMLHttpRequest') {
    http_response_code(400);
    die(json_encode(['success' => false, 'message' => 'Bad Request']));
}

// Vérifier l'authentification
$isAuthenticated = !empty($_SERVER['REMOTE_USER']);
debugLog('Authentication check - User: ' . ($_SERVER['REMOTE_USER'] ?? 'none') . ', Authenticated: ' . ($isAuthenticated ? 'yes' : 'no'));

if (!$isAuthenticated && $conf['useacl']) {
    debugLog('Authentication failed: no REMOTE_USER and ACL is enabled');
    http_response_code(401);
    die(json_encode(['success' => false, 'message' => 'Authentication required']));
}

/**
 * Envoie une réponse JSON
 */
function sendResponse($success, $message, $data = null) {
    header('Content-Type: application/json');
    $response = [
        'success' => $success,
        'message' => $message
    ];
    if ($data !== null) {
        $response['data'] = $data;
    }
    echo json_encode($response);
    exit;
}

/**
 * Nettoie et valide le namespace
 */
function getCleanNamespace($ns) {
    $ns = trim($ns);
    $ns = str_replace(['\\', '/'], ':', $ns);
    $ns = preg_replace('/[^a-zA-Z0-9:_-]/', '', $ns);
    $ns = trim($ns, ':');
    return $ns;
}

/**
 * Calcule les permissions pour un namespace de média
 */
function getMediaAuth($namespace) {
    $testId = $namespace ? $namespace . ':test' : 'test';
    return auth_quickaclcheck($testId);
}

/**
 * Convertit les codes d'erreur PHP d'upload en messages détaillés
 */
function getUploadErrorMessage($errorCode, $file) {
    $fileName = $file['name'] ?? 'fichier inconnu';
    $fileSize = isset($file['size']) ? formatBytes($file['size']) : 'taille inconnue';
    
    switch ($errorCode) {
        case UPLOAD_ERR_INI_SIZE:
            return "Fichier trop volumineux: {$fileName} ({$fileSize}) dépasse la limite du serveur";
        case UPLOAD_ERR_FORM_SIZE:
            return "Fichier trop volumineux: {$fileName} ({$fileSize}) dépasse la limite du formulaire";
        case UPLOAD_ERR_PARTIAL:
            return "Upload interrompu: {$fileName} n'a été que partiellement uploadé";
        case UPLOAD_ERR_NO_FILE:
            return "Aucun fichier sélectionné";
        case UPLOAD_ERR_NO_TMP_DIR:
            return "Erreur serveur: dossier temporaire manquant";
        case UPLOAD_ERR_CANT_WRITE:
            return "Erreur serveur: impossible d'écrire {$fileName} sur le disque";
        case UPLOAD_ERR_EXTENSION:
            return "Upload bloqué: extension de {$fileName} interdite par le serveur";
        default:
            return "Erreur d'upload inconnue: {$fileName} (code {$errorCode})";
    }
}

/**
 * Formate les octets en unités lisibles
 */
function formatBytes($bytes, $precision = 2) {
    $units = array('B', 'KB', 'MB', 'GB', 'TB');
    
    for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
        $bytes /= 1024;
    }
    
    return round($bytes, $precision) . ' ' . $units[$i];
}

/**
 * Convertit une valeur PHP (comme "8M") en octets
 */
function convertToBytes($value) {
    $value = trim($value);
    $last = strtolower($value[strlen($value)-1]);
    $number = (int) $value;
    
    switch($last) {
        case 'g':
            $number *= 1024;
        case 'm':
            $number *= 1024;
        case 'k':
            $number *= 1024;
    }
    
    return $number;
}

// Traitement principal
try {
    // IMPORTANTE: Vérifier d'abord si le fichier était trop volumineux pour être reçu
    // Quand un fichier dépasse upload_max_filesize, PHP ne le met même pas dans $_FILES
    $contentLength = $_SERVER['CONTENT_LENGTH'] ?? 0;
    $maxFileSize = ini_get('upload_max_filesize');
    $maxFileSizeBytes = convertToBytes($maxFileSize);
    
    debugLog('Content-Length: ' . $contentLength . ', Max file size: ' . $maxFileSize . ' (' . $maxFileSizeBytes . ' bytes)');
    
    // Si la requête est vide mais qu'on a un Content-Length > 0, c'est probablement un fichier trop gros
    if (empty($_FILES) && $contentLength > 0) {
        if ($contentLength > $maxFileSizeBytes) {
            sendResponse(false, "Fichier trop volumineux (≈" . formatBytes($contentLength) . "), limite serveur: " . $maxFileSize);
        } else {
            sendResponse(false, "Erreur d'upload: fichier non reçu malgré Content-Length: " . formatBytes($contentLength));
        }
    }
    
    // Vérifier les fichiers uploadés
    if (!isset($_FILES['file'])) {
        sendResponse(false, 'Aucun fichier reçu');
    }
    
    $file = $_FILES['file'];
    
    // Vérifier les erreurs d'upload PHP - comme dans QuillJS
    if ($file['error'] !== UPLOAD_ERR_OK) {
        debugLog('Upload error: ' . $file['error']);
        $errorMessage = getUploadErrorMessage($file['error'], $file);
        sendResponse(false, $errorMessage);
    }
    
    $namespace = getCleanNamespace($_POST['namespace'] ?? '');
    
    debugLog('Processing file: ' . $file['name'] . ' to namespace: ' . $namespace . ', size: ' . $file['size']);
    
    // Vérifier les permissions d'upload
    $auth = getMediaAuth($namespace);
    if ($auth < AUTH_UPLOAD) {
        debugLog('Upload permission denied. Required: ' . AUTH_UPLOAD . ', Got: ' . $auth);
        sendResponse(false, 'Permissions insuffisantes pour uploader dans ce namespace');
    }
    
    // Construire l'ID du média
    $mediaId = ($namespace ? $namespace . ':' : '') . $file['name'];
    
    // Vérifier le token de sécurité (utiliser un token simple pour AJAX)
    global $INPUT;
    if (!isset($_POST['sectok'])) {
        $_POST['sectok'] = getSecurityToken();
    }
    
    // Utiliser la fonction native DokuWiki media_save
    $res = media_save(
        [
            'name' => $file['tmp_name'],
            'mime' => $file['type'],
            'ext' => strtolower(pathinfo($file['name'], PATHINFO_EXTENSION))
        ],
        $mediaId,
        false, // pas d'overwrite par défaut
        $auth,
        'copy_uploaded_file'
    );
    
    if (is_array($res)) {
        // Upload échoué
        debugLog('Upload failed: ' . $res[0]);
        sendResponse(false, 'Erreur d\'upload: ' . $res[0]);
    } else {
        // Upload réussi
        debugLog('Upload successful for: ' . $mediaId);
        
        // Générer les informations du fichier uploadé
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        $mediaType = in_array($ext, $imageTypes) ? 'image' : 'document';
        
        $fileInfo = [
            'id' => $mediaId,
            'name' => pathinfo($file['name'], PATHINFO_FILENAME),
            'filename' => $file['name'],
            'namespace' => $namespace,
            'ext' => $ext,
            'mediaType' => $mediaType,
            'size' => $file['size'],
            'url' => DOKU_BASE . 'lib/exe/fetch.php?media=' . rawurlencode($mediaId)
        ];
        
        // Ajouter thumbnail pour les images
        if ($mediaType === 'image') {
            $thumbToken = media_get_token($mediaId, 150, 150);
            $fileInfo['thumb'] = DOKU_BASE . 'lib/exe/fetch.php?media=' . rawurlencode($mediaId) . '&w=150&h=150&tok=' . $thumbToken;
        }
        
        sendResponse(true, 'Fichier uploadé avec succès', $fileInfo);
    }
    
} catch (Exception $e) {
    debugLog('Exception during upload: ' . $e->getMessage());
    sendResponse(false, 'Erreur serveur: ' . $e->getMessage());
}
?>
