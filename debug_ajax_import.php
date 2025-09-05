<?php
/**
 * Script de débogage pour tester les requêtes AJAX import
 */

// Simulation d'une requête AJAX pour debug
$_POST['call'] = 'kanban';
$_POST['action'] = 'import_json'; 
$_POST['id'] = 'playground:kanban';
$_POST['import_mode'] = 'merge';
$_POST['json_data'] = json_encode([
    'metadata' => [
        'kanban_id' => 'test_debug',
        'page_id' => 'playground:kanban',
        'export_date' => date('Y-m-d H:i:s'),
        'export_format_version' => '1.0',
        'total_columns' => 1,
        'total_cards' => 1
    ],
    'board' => [
        'title' => 'Test Import Debug',
        'columns' => [
            [
                'id' => 'test_col',
                'title' => 'Colonne Test',
                'cards' => [
                    [
                        'id' => 'test_card',
                        'title' => 'Carte Test',
                        'description' => 'Description test',
                        'discussions' => [],
                        'discussion_count' => 0
                    ]
                ]
            ]
        ]
    ]
]);

echo "=== DEBUG AJAX IMPORT REQUEST ===\n";
echo "POST parameters:\n";
echo "- call: " . ($_POST['call'] ?? 'NOT SET') . "\n";
echo "- action: " . ($_POST['action'] ?? 'NOT SET') . "\n";
echo "- id: " . ($_POST['id'] ?? 'NOT SET') . "\n";
echo "- import_mode: " . ($_POST['import_mode'] ?? 'NOT SET') . "\n";
echo "- json_data length: " . strlen($_POST['json_data'] ?? '') . " chars\n";

echo "\n=== TEST JSON DECODE ===\n";
$jsonData = $_POST['json_data'] ?? '';
$decoded = json_decode($jsonData, true);
if ($decoded === null) {
    echo "❌ JSON decode failed: " . json_last_error_msg() . "\n";
} else {
    echo "✅ JSON decode successful\n";
    echo "- Has metadata: " . (isset($decoded['metadata']) ? 'YES' : 'NO') . "\n";
    echo "- Has board: " . (isset($decoded['board']) ? 'YES' : 'NO') . "\n";
    if (isset($decoded['board']['columns'])) {
        echo "- Columns count: " . count($decoded['board']['columns']) . "\n";
    }
}

echo "\n=== TEST CLASS LOADING ===\n";

// Test KanbanExportManager
if (file_exists(__DIR__ . '/KanbanExportManager.php')) {
    echo "✅ KanbanExportManager.php exists\n";
    
    try {
        require_once(__DIR__ . '/KanbanExportManager.php');
        echo "✅ KanbanExportManager loaded\n";
        
        if (class_exists('KanbanExportManager')) {
            echo "✅ KanbanExportManager class exists\n";
            
            if (method_exists('KanbanExportManager', 'importFromJSON')) {
                echo "✅ importFromJSON method exists\n";
            } else {
                echo "❌ importFromJSON method NOT found\n";
            }
        } else {
            echo "❌ KanbanExportManager class NOT found\n";
        }
    } catch (Exception $e) {
        echo "❌ Error loading KanbanExportManager: " . $e->getMessage() . "\n";
    }
} else {
    echo "❌ KanbanExportManager.php NOT found\n";
}

echo "\n=== TEST AJAX HANDLER ===\n";

// Test KanbanAjaxHandler
if (file_exists(__DIR__ . '/KanbanAjaxHandler.php')) {
    echo "✅ KanbanAjaxHandler.php exists\n";
    
    try {
        require_once(__DIR__ . '/KanbanAjaxHandler.php');
        echo "✅ KanbanAjaxHandler loaded\n";
        
        if (class_exists('KanbanAjaxHandler')) {
            echo "✅ KanbanAjaxHandler class exists\n";
        } else {
            echo "❌ KanbanAjaxHandler class NOT found\n";
        }
    } catch (Exception $e) {
        echo "❌ Error loading KanbanAjaxHandler: " . $e->getMessage() . "\n";
    }
} else {
    echo "❌ KanbanAjaxHandler.php NOT found\n";
}

echo "\n=== TEST SIMULATION D'IMPORT ===\n";

try {
    // Simuler l'import directement
    if (class_exists('KanbanExportManager') && method_exists('KanbanExportManager', 'importFromJSON')) {
        $result = KanbanExportManager::importFromJSON($_POST['json_data'], $_POST['id'], $_POST['import_mode']);
        
        echo "Import result:\n";
        echo "- Success: " . ($result['success'] ? 'YES' : 'NO') . "\n";
        echo "- Message: " . ($result['message'] ?? 'N/A') . "\n";
        if (!$result['success']) {
            echo "- Error: " . ($result['error'] ?? 'N/A') . "\n";
            echo "- Details: " . print_r($result['details'] ?? [], true) . "\n";
        }
    } else {
        echo "❌ Cannot simulate import - method not available\n";
    }
} catch (Exception $e) {
    echo "❌ Import simulation failed: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

echo "\n=== END DEBUG ===\n";
?>
