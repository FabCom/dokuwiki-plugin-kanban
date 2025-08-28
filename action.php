<?php
/**
 * DokuWiki Plugin Kanban (Action Component)
 *
 * @license GPL 2 http://www.gnu.org/licenses/gpl-2.0.html
 * @author  Kanban Plugin Team
 */

use dokuwiki\Extension\ActionPlugin;
use dokuwiki\Extension\EventHandler;
use dokuwiki\Extension\Event;

class action_plugin_kanban extends ActionPlugin
{
    /**
     * Registers a callback function for a given event
     *
     * @param EventHandler $controller DokuWiki's event controller object
     * @return void
     */
    public function register(EventHandler $controller)
    {
        $controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE', $this, 'addAssets');
        $controller->register_hook('AJAX_CALL_UNKNOWN', 'BEFORE', $this, 'handleAjax');
    }

    /**
     * Add CSS and JavaScript assets
     */
    public function addAssets(Event $event, $param)
    {
        // Only add assets if kanban syntax is present on the page
        if (!$this->hasKanbanContent()) {
            return;
        }

        // Add CSS
        $event->data['link'][] = [
            'type' => 'text/css',
            'rel' => 'stylesheet',
            'href' => DOKU_BASE . 'lib/plugins/kanban/style.css'
        ];

        // Add JavaScript
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/script.js'
        ];
    }

    /**
     * Handle AJAX requests
     */
    public function handleAjax(Event $event, $param)
    {
        if ($event->data !== 'kanban') {
            return;
        }

        // Prevent DokuWiki from looking for the action elsewhere
        $event->preventDefault();
        $event->stopPropagation();

        global $INPUT;
        
        $action = $INPUT->str('action');
        
        header('Content-Type: application/json');
        
        try {
            switch ($action) {
                case 'save_board':
                    $this->saveBoardData();
                    break;
                case 'load_board':
                    $this->loadBoardData();
                    break;
                default:
                    http_response_code(400);
                    echo json_encode(['error' => 'Action non reconnue']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
        
        exit;
    }

    /**
     * Save kanban board data
     */
    private function saveBoardData()
    {
        global $INPUT, $ID;
        
        $boardId = $INPUT->str('board_id');
        $boardData = $INPUT->str('board_data');
        
        if (empty($boardId) || empty($boardData)) {
            http_response_code(400);
            echo json_encode(['error' => 'Données manquantes']);
            return;
        }
        
        // Parse board data
        $data = json_decode($boardData, true);
        if (!$data) {
            http_response_code(400);
            echo json_encode(['error' => 'Données JSON invalides']);
            return;
        }
        
        // Check permissions
        if (!auth_quickaclcheck($ID) >= AUTH_EDIT) {
            http_response_code(403);
            echo json_encode(['error' => 'Permissions insuffisantes']);
            return;
        }
        
        // Save to meta file
        $metaFile = metaFN($ID, '.kanban');
        $kanbanData = [];
        
        if (file_exists($metaFile)) {
            $existing = file_get_contents($metaFile);
            $kanbanData = json_decode($existing, true) ?: [];
        }
        
        $kanbanData[$boardId] = $data;
        
        if (file_put_contents($metaFile, json_encode($kanbanData, JSON_PRETTY_PRINT))) {
            echo json_encode(['success' => true, 'message' => 'Tableau sauvegardé']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Erreur lors de la sauvegarde']);
        }
    }

    /**
     * Load kanban board data
     */
    private function loadBoardData()
    {
        global $INPUT, $ID;
        
        $boardId = $INPUT->str('board_id');
        
        if (empty($boardId)) {
            http_response_code(400);
            echo json_encode(['error' => 'ID du tableau manquant']);
            return;
        }
        
        $metaFile = metaFN($ID, '.kanban');
        
        if (!file_exists($metaFile)) {
            echo json_encode(['data' => null]);
            return;
        }
        
        $kanbanData = json_decode(file_get_contents($metaFile), true);
        
        if (isset($kanbanData[$boardId])) {
            echo json_encode(['data' => $kanbanData[$boardId]]);
        } else {
            echo json_encode(['data' => null]);
        }
    }

    /**
     * Check if current page content contains kanban syntax
     */
    private function hasKanbanContent()
    {
        global $ID;
        
        if (empty($ID)) {
            return false;
        }
        
        $content = rawWiki($ID);
        return strpos($content, '<kanban') !== false;
    }
}
