<?php
/**
 * DEBUG Upload - Version de debug pour identifier le problème
 */

if (!defined('DOKU_INC')) define('DOKU_INC', dirname(__FILE__) . '/../../../../');
require_once(DOKU_INC . 'inc/init.php');

error_log("DEBUG: Upload debug script started");

// Test 1: Vérifier que le validateur peut être chargé
try {
    require_once(dirname(__FILE__) . '/../KanbanAjaxValidator.php');
    error_log("DEBUG: KanbanAjaxValidator loaded successfully");
} catch (Exception $e) {
    error_log("DEBUG: Failed to load KanbanAjaxValidator: " . $e->getMessage());
    die(json_encode(['error' => 'Validator load failed', 'details' => $e->getMessage()]));
}

// Test 2: Vérifier que le validateur peut être instancié
try {
    $validator = new KanbanAjaxValidator();
    error_log("DEBUG: KanbanAjaxValidator instantiated successfully");
} catch (Exception $e) {
    error_log("DEBUG: Failed to instantiate KanbanAjaxValidator: " . $e->getMessage());
    die(json_encode(['error' => 'Validator instantiation failed', 'details' => $e->getMessage()]));
}

// Test 3: Validation simple
try {
    $validationResult = $validator->validateAjaxRequest([
        'require_auth' => false,
        'require_ajax_header' => false,
        'allowed_methods' => ['GET', 'POST'],
        'require_csrf_token' => false,
        'min_auth_level' => AUTH_READ
    ]);
    error_log("DEBUG: Basic validation result: " . json_encode($validationResult));
} catch (Exception $e) {
    error_log("DEBUG: Validation failed: " . $e->getMessage());
    die(json_encode(['error' => 'Validation failed', 'details' => $e->getMessage()]));
}

header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'message' => 'Debug upload test passed',
    'validation_result' => $validationResult,
    'server_vars' => [
        'REQUEST_METHOD' => $_SERVER['REQUEST_METHOD'] ?? 'unknown',
        'REMOTE_USER' => $_SERVER['REMOTE_USER'] ?? 'none',
        'HTTP_X_REQUESTED_WITH' => $_SERVER['HTTP_X_REQUESTED_WITH'] ?? 'none'
    ]
]);
?>
