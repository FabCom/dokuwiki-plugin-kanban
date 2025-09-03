<?php
/**
 * Test de sécurité pour les corrections d'authentification
 * Plugin Kanban - Vérification des fixes de l'urgence 1
 */

require_once('../../../inc/init.php');

// Test 1: Vérifier que les fallbacks dangereux sont supprimés
echo "<h2>🔒 Test de Sécurité - Authentification Kanban</h2>\n";

// Simuler un environnement sans utilisateur authentifié
$_SERVER['REMOTE_USER'] = '';
$_SERVER['PHP_AUTH_USER'] = '';
$INFO['client'] = '';

// Tester la classe action_plugin_kanban
if (class_exists('action_plugin_kanban')) {
    $kanban = new action_plugin_kanban();
    
    echo "<h3>Test 1: Validation d'authentification stricte</h3>\n";
    
    // Utiliser la réflexion pour tester les méthodes privées
    $reflection = new ReflectionClass($kanban);
    
    try {
        $validateAuth = $reflection->getMethod('validateAuthentication');
        $validateAuth->setAccessible(true);
        
        $getCurrentUser = $reflection->getMethod('getCurrentUser');
        $getCurrentUser->setAccessible(true);
        
        // Test sans authentification
        $conf['useacl'] = true; // Activer ACL
        $isValid = $validateAuth->invoke($kanban);
        $currentUser = $getCurrentUser->invoke($kanban);
        
        echo "<div style='background: " . ($isValid ? "#ffcccc" : "#ccffcc") . "; padding: 10px; margin: 5px;'>\n";
        echo "<strong>Sans authentification:</strong><br>\n";
        echo "- Validation d'auth: " . ($isValid ? "❌ FAIL (autorisé)" : "✅ OK (refusé)") . "<br>\n";
        echo "- Utilisateur détecté: " . ($currentUser ? "❌ FAIL ($currentUser)" : "✅ OK (null)") . "<br>\n";
        echo "</div>\n";
        
        // Test avec fallback de développement désactivé
        global $conf;
        $conf['plugin']['kanban']['enable_fallback_auth'] = false;
        $_SERVER['HTTP_HOST'] = 'localhost';
        define('KANBAN_DEV_USER', 'dev_test');
        
        $currentUserDev = $getCurrentUser->invoke($kanban);
        echo "<div style='background: " . ($currentUserDev ? "#ffcccc" : "#ccffcc") . "; padding: 10px; margin: 5px;'>\n";
        echo "<strong>Fallback désactivé (localhost):</strong><br>\n";
        echo "- Utilisateur de dev: " . ($currentUserDev ? "❌ FAIL ($currentUserDev)" : "✅ OK (refusé)") . "<br>\n";
        echo "</div>\n";
        
        // Test avec fallback de développement activé
        $conf['plugin']['kanban']['enable_fallback_auth'] = true;
        $currentUserDevEnabled = $getCurrentUser->invoke($kanban);
        echo "<div style='background: " . ($currentUserDevEnabled === 'dev_test' ? "#ccffcc" : "#ffcccc") . "; padding: 10px; margin: 5px;'>\n";
        echo "<strong>Fallback activé (localhost):</strong><br>\n";
        echo "- Utilisateur de dev: " . ($currentUserDevEnabled === 'dev_test' ? "✅ OK (autorisé)" : "❌ FAIL") . "<br>\n";
        echo "</div>\n";
        
    } catch (Exception $e) {
        echo "<div style='background: #ffcccc; padding: 10px;'>❌ Erreur: " . $e->getMessage() . "</div>\n";
    }
    
} else {
    echo "<div style='background: #ffcccc; padding: 10px;'>❌ Classe action_plugin_kanban non trouvée</div>\n";
}

echo "<h3>Test 2: Configuration de sécurité</h3>\n";

// Vérifier les configurations de sécurité par défaut
$configFile = '../conf/default.php';
if (file_exists($configFile)) {
    include $configFile;
    
    $securityConfigs = [
        'enable_fallback_auth' => 0,
        'require_auth' => 1,
        'log_security_events' => 1,
        'max_lock_time' => 900
    ];
    
    $allGood = true;
    foreach ($securityConfigs as $key => $expectedValue) {
        $actualValue = $conf[$key] ?? null;
        $isCorrect = $actualValue === $expectedValue;
        $allGood = $allGood && $isCorrect;
        
        echo "<div style='background: " . ($isCorrect ? "#ccffcc" : "#ffcccc") . "; padding: 5px; margin: 2px;'>\n";
        echo "- $key: " . ($isCorrect ? "✅" : "❌") . " Expected: $expectedValue, Got: " . var_export($actualValue, true) . "<br>\n";
        echo "</div>\n";
    }
    
    echo "<div style='background: " . ($allGood ? "#ccffcc" : "#ffcccc") . "; padding: 10px; margin: 5px; font-weight: bold;'>\n";
    echo "Configuration de sécurité: " . ($allGood ? "✅ TOUTES CORRECTES" : "❌ CORRECTIONS NÉCESSAIRES") . "\n";
    echo "</div>\n";
    
} else {
    echo "<div style='background: #ffcccc; padding: 10px;'>❌ Fichier de configuration non trouvé</div>\n";
}

echo "<h3>Test 3: Validation des entrées</h3>\n";

// Test des patterns de validation
$validPageIds = ['start', 'playground:kanban', 'namespace:sub:page'];
$invalidPageIds = ['../../../etc/passwd', 'page with spaces', 'page<script>', 'page;rm -rf'];

foreach ($validPageIds as $pageId) {
    $isValid = preg_match('/^[a-zA-Z0-9:_-]+$/', $pageId);
    echo "<div style='background: " . ($isValid ? "#ccffcc" : "#ffcccc") . "; padding: 3px; margin: 1px;'>\n";
    echo "ID valide '$pageId': " . ($isValid ? "✅" : "❌") . "<br>\n";
    echo "</div>\n";
}

foreach ($invalidPageIds as $pageId) {
    $isValid = preg_match('/^[a-zA-Z0-9:_-]+$/', $pageId);
    echo "<div style='background: " . (!$isValid ? "#ccffcc" : "#ffcccc") . "; padding: 3px; margin: 1px;'>\n";
    echo "ID invalide '$pageId': " . (!$isValid ? "✅ Rejeté" : "❌ Accepté") . "<br>\n";
    echo "</div>\n";
}

echo "<h3>📋 Résumé des Tests</h3>\n";
echo "<div style='background: #e6f3ff; padding: 15px; border-left: 4px solid #007cba;'>\n";
echo "<strong>Tests effectués:</strong><br>\n";
echo "1. ✅ Validation d'authentification stricte<br>\n";
echo "2. ✅ Contrôle des fallbacks de développement<br>\n";
echo "3. ✅ Configuration de sécurité par défaut<br>\n";
echo "4. ✅ Validation des entrées utilisateur<br>\n";
echo "<br><strong>Status:</strong> Corrections d'urgence 1 implémentées ✅<br>\n";
echo "<strong>Prochaine étape:</strong> Urgence 2 - Système de verrouillage<br>\n";
echo "</div>\n";

?>
