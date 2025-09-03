<?php
/**
 * AJAX endpoint pour calculer le token d'une image avec nouvelles dimensions
 * Copie de lib/plugins/quilljs/ajax/get_media_token.php pour le plugin kanban
 */

if (!defined('DOKU_INC')) define('DOKU_INC', dirname(__FILE__) . '/../../../../');
require_once(DOKU_INC . 'inc/init.php');

// Vérifier que c'est une requête AJAX
if (!isset($_SERVER['HTTP_X_REQUESTED_WITH']) || $_SERVER['HTTP_X_REQUESTED_WITH'] !== 'XMLHttpRequest') {
    http_response_code(400);
    die('Bad Request');
}

// Récupérer les paramètres
$media = $_GET['media'] ?? '';
$width = (int)($_GET['w'] ?? 0);
$height = (int)($_GET['h'] ?? 0);

if (empty($media)) {
    http_response_code(400);
    die('Missing media parameter');
}

// Calculer le nouveau token
$token = media_get_token($media, $width, $height);

// Retourner le token en JSON
header('Content-Type: application/json');
echo json_encode([
    'token' => $token,
    'media' => $media,
    'width' => $width,
    'height' => $height
]);
?>
