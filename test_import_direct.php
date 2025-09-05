<?php
/**
 * Test direct d'import JSON sans contexte DokuWiki complet
 */

// Simulate minimal environment
define('DOKU_INC', '/var/www/html/wiki/');

// Test if we can load our classes directly
echo "=== TEST CHARGEMENT CLASSES ===\n";

$kanbanDir = __DIR__;
echo "Kanban dir: $kanbanDir\n";

// Test KanbanExportManager
$exportManagerPath = $kanbanDir . '/KanbanExportManager.php';
if (file_exists($exportManagerPath)) {
    echo "✅ KanbanExportManager.php exists\n";
    
    try {
        require_once($exportManagerPath);
        echo "✅ KanbanExportManager loaded\n";
        
        if (class_exists('KanbanExportManager')) {
            echo "✅ KanbanExportManager class available\n";
            
            if (method_exists('KanbanExportManager', 'importFromJSON')) {
                echo "✅ importFromJSON method exists\n";
                
                // Test with simple JSON
                $testJson = json_encode([
                    'metadata' => [
                        'kanban_id' => 'test_simple',
                        'page_id' => 'playground:kanban',
                        'export_date' => date('Y-m-d H:i:s'),
                        'export_format_version' => '1.0',
                        'total_columns' => 1,
                        'total_cards' => 1
                    ],
                    'board' => [
                        'title' => 'Simple Test',
                        'columns' => [
                            [
                                'id' => 'simple_col',
                                'title' => 'Colonne Simple',
                                'cards' => [
                                    [
                                        'id' => 'simple_card',
                                        'title' => 'Carte Simple',
                                        'description' => 'Test minimal',
                                        'discussions' => [],
                                        'discussion_count' => 0
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]);
                
                echo "\n=== TEST IMPORT DIRECT ===\n";
                echo "JSON length: " . strlen($testJson) . " chars\n";
                
                try {
                    $result = KanbanExportManager::importFromJSON($testJson, 'playground:kanban', 'merge');
                    
                    echo "✅ Import direct réussi\n";
                    echo "Success: " . ($result['success'] ? 'YES' : 'NO') . "\n";
                    echo "Message: " . ($result['message'] ?? 'N/A') . "\n";
                    
                    if (!$result['success']) {
                        echo "Error: " . ($result['error'] ?? 'N/A') . "\n";
                        echo "Details: " . print_r($result['details'] ?? [], true) . "\n";
                    }
                    
                } catch (Exception $e) {
                    echo "❌ Import failed: " . $e->getMessage() . "\n";
                    echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
                    echo "Trace:\n" . $e->getTraceAsString() . "\n";
                }
                
            } else {
                echo "❌ importFromJSON method not found\n";
            }
        } else {
            echo "❌ KanbanExportManager class not found\n";
        }
    } catch (Exception $e) {
        echo "❌ Error loading KanbanExportManager: " . $e->getMessage() . "\n";
    }
} else {
    echo "❌ KanbanExportManager.php not found at: $exportManagerPath\n";
}

echo "\n=== TEST DEPENDENCIES ===\n";

// Check required dependencies
$dependencies = [
    'KanbanDataManager.php',
    'KanbanAuthManager.php', 
    'KanbanErrorManager.php',
    'KanbanCacheManager.php'
];

foreach ($dependencies as $dep) {
    $path = $kanbanDir . '/' . $dep;
    if (file_exists($path)) {
        echo "✅ $dep exists\n";
        try {
            require_once($path);
            echo "  ✅ Loaded successfully\n";
        } catch (Exception $e) {
            echo "  ❌ Load failed: " . $e->getMessage() . "\n";
        }
    } else {
        echo "❌ $dep NOT found\n";
    }
}

echo "\n=== TEST SIMULATION AJAX ===\n";

// Simulate the AJAX environment
$_POST = [
    'call' => 'kanban',
    'action' => 'import_json',
    'id' => 'playground:kanban',
    'import_mode' => 'merge',
    'json_data' => $testJson ?? '',
    'sectok' => 'test_token'
];

echo "Simulated POST data:\n";
foreach ($_POST as $key => $value) {
    if ($key === 'json_data') {
        echo "  $key: " . strlen($value) . " chars\n";
    } else {
        echo "  $key: $value\n";
    }
}

echo "\n=== SIMULATION COMPLETE ===\n";
?>
