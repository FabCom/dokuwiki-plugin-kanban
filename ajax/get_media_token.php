<?php
/**
 * AJAX endpoint pour calculer le token d'une image avec nouvelles dimensions
 * SECURITY ENHANCED - Version sécurisée avec validation complète
 * 
 * @author Security Team
 * @version 2.0.0 - Security enhanced
 */

if (!defined('DOKU_INC')) define('DOKU_INC', dirname(__FILE__) . '/../../../../');
require_once(DOKU_INC . 'inc/init.php');

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

// SECURITY: Get and validate parameters securely
$media = $_GET['media'] ?? $_POST['media'] ?? '';
$width = $_GET['w'] ?? $_POST['w'] ?? 0;
$height = $_GET['h'] ?? $_POST['h'] ?? 0;

// SECURITY: Validate media parameter
if (empty($media)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => 'Missing media parameter'
    ]);
    exit;
}

// SECURITY: Validate media ID format and permissions
if (!preg_match('/^[a-zA-Z0-9:_.-]+$/', $media)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => 'Invalid media ID format'
    ]);
    exit;
}

// SECURITY: Check media access permissions
$mediaAuth = auth_quickaclcheck($media);
if ($mediaAuth < AUTH_READ) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => 'Access denied to media file'
    ]);
    exit;
}

// SECURITY: Validate dimensions
$width = max(0, min((int)$width, 2000));  // Max 2000px
$height = max(0, min((int)$height, 2000)); // Max 2000px

// SECURITY: Check if media file actually exists
global $conf;
$mediaFile = $conf['mediadir'] . '/' . str_replace(':', '/', $media);
if (!file_exists($mediaFile) || !is_readable($mediaFile)) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => 'Media file not found or not accessible'
    ]);
    exit;
}

try {
    // SECURITY: Calculate token safely with validated parameters
    $token = media_get_token($media, $width, $height);
    
    // Return secure JSON response
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'token' => $token,
        'media' => $media,
        'width' => $width,
        'height' => $height
    ]);
    
} catch (Exception $e) {
    error_log("Kanban SECURITY: Media token error: " . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => 'Token generation failed'
    ]);
}
?>
