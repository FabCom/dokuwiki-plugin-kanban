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
        global $INPUT;
        
        $boardId = $INPUT->str('board_id');
        $boardData = $INPUT->str('board_data');
        $changeType = $INPUT->str('change_type', 'modification');
        $pageId = $INPUT->str('id') ?: $INPUT->str('page_id');
        
        if (empty($boardId) || empty($boardData) || empty($pageId)) {
            error_log("Kanban Plugin: Missing required data - boardId: $boardId, pageId: $pageId, boardData length: " . strlen($boardData));
            http_response_code(400);
            echo json_encode(['error' => 'Données manquantes (ID page, board ID ou données)']);
            return;
        }
        
        // Parse board data
        $data = json_decode($boardData, true);
        if (!$data) {
            error_log("Kanban Plugin: Invalid JSON data: $boardData");
            http_response_code(400);
            echo json_encode(['error' => 'Données JSON invalides']);
            return;
        }
        
        // Debug: Log des données décodées
        error_log("Kanban Debug - Données reçues et décodées: " . print_r($data, true));
        
        // Check permissions
        if (!auth_quickaclcheck($pageId) >= AUTH_EDIT) {
            error_log("Kanban Plugin: Insufficient permissions for page: $pageId");
            http_response_code(403);
            echo json_encode(['error' => 'Permissions insuffisantes']);
            return;
        }
        
        // Save to page content using DokuWiki versioning
        if ($this->saveToPageContent($pageId, $boardId, $data, $changeType)) {
            echo json_encode(['success' => true, 'message' => 'Tableau sauvegardé avec versioning']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Erreur lors de la sauvegarde']);
        }
    }

    /**
     * Save kanban data to page content with DokuWiki versioning
     */
    private function saveToPageContent($pageId, $boardId, $data, $changeType)
    {
        try {
            // Get current page content
            $currentContent = rawWiki($pageId);
            if ($currentContent === false) {
                error_log("Kanban Plugin: Failed to read page content for ID: $pageId");
                return false;
            }
            
            // Generate new kanban content from data
            $newKanbanContent = $this->generateKanbanContent($data);
            
            // Find and replace the kanban block with the same ID
            $pattern = '/(<kanban[^>]*id="' . preg_quote($boardId, '/') . '"[^>]*>)(.*?)(<\/kanban>)/s';
            
            if (preg_match($pattern, $currentContent)) {
                // Replace existing kanban block
                $newContent = preg_replace($pattern, '$1' . "\n" . $newKanbanContent . "\n" . '$3', $currentContent);
            } else {
                // If no specific ID match, try to find by position or create new block
                $pattern = '/(<kanban[^>]*>)(.*?)(<\/kanban>)/s';
                if (preg_match($pattern, $currentContent)) {
                    $newContent = preg_replace($pattern, '$1' . "\n" . $newKanbanContent . "\n" . '$3', $currentContent, 1);
                } else {
                    error_log("Kanban Plugin: No kanban block found in page content for ID: $pageId");
                    return false; // No kanban block found
                }
            }
            
            // Generate change summary based on change type
            $summary = $this->generateChangeSummary($changeType, $data);
            
            error_log("Kanban Plugin: Saving page content for ID: $pageId with summary: $summary");
            
            // Save using DokuWiki's saveWikiText (handles versioning automatically)
            saveWikiText($pageId, $newContent, $summary, false);
            
            error_log("Kanban Plugin: Successfully saved page content for ID: $pageId");
            return true;
            
        } catch (Exception $e) {
            error_log("Kanban Plugin: Error in saveToPageContent: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Generate kanban content from data structure
     */
    private function generateKanbanContent($data)
    {
        $content = '';
        
        if (isset($data['columns']) && is_array($data['columns'])) {
            foreach ($data['columns'] as $column) {
                $content .= "## " . ($column['title'] ?? 'Sans titre') . "\n";
                
                if (isset($column['cards']) && is_array($column['cards'])) {
                    foreach ($column['cards'] as $card) {
                        $cardLine = "* " . ($card['title'] ?? 'Carte sans titre');
                        
                        // Add card attributes
                        $attributes = [];
                        if (!empty($card['description'])) {
                            // Escape description for wiki format (replace newlines and brackets)
                            $desc = str_replace(["\n", "[", "]"], ["\\n", "&#91;", "&#93;"], $card['description']);
                            $attributes[] = "description:" . $desc;
                        }
                        if (!empty($card['priority']) && $card['priority'] !== 'normal') {
                            $attributes[] = "priority:" . $card['priority'];
                        }
                        if (!empty($card['assignee'])) {
                            $attributes[] = "assignee:" . $card['assignee'];
                        }
                        if (!empty($card['tags']) && is_array($card['tags'])) {
                            $attributes[] = "tags:" . implode(',', $card['tags']);
                        }
                        if (!empty($card['creator'])) {
                            $attributes[] = "creator:" . $card['creator'];
                        }
                        if (!empty($card['created'])) {
                            $attributes[] = "created:" . $card['created'];
                        }
                        
                        if (!empty($attributes)) {
                            $cardLine .= " [" . implode("] [", $attributes) . "]";
                        }
                        
                        // Debug log pour voir ce qui est généré
                        error_log("Kanban Debug - Carte générée: " . $cardLine);
                        
                        $content .= $cardLine . "\n";
                    }
                }
                $content .= "\n";
            }
        }
        
        return trim($content);
    }

    /**
     * Generate change summary for versioning
     */
    private function generateChangeSummary($changeType, $data)
    {
        $boardTitle = $data['title'] ?? 'Kanban Board';
        
        switch ($changeType) {
            case 'add_card':
                return "Kanban: Nouvelle carte ajoutée dans \"$boardTitle\"";
            case 'move_card':
                return "Kanban: Carte déplacée dans \"$boardTitle\"";
            case 'edit_card':
                return "Kanban: Carte modifiée dans \"$boardTitle\"";
            case 'delete_card':
                return "Kanban: Carte supprimée dans \"$boardTitle\"";
            case 'add_column':
                return "Kanban: Nouvelle colonne ajoutée dans \"$boardTitle\"";
            case 'edit_column':
                return "Kanban: Colonne modifiée dans \"$boardTitle\"";
            case 'delete_column':
                return "Kanban: Colonne supprimée dans \"$boardTitle\"";
            case 'edit_title':
                return "Kanban: Titre du tableau modifié: \"$boardTitle\"";
            default:
                return "Kanban: Modifications apportées à \"$boardTitle\"";
        }
    }

    /**
     * Load kanban board data
     */
    private function loadBoardData()
    {
        global $INPUT;
        
        $boardId = $INPUT->str('board_id');
        $pageId = $INPUT->str('id') ?: $INPUT->str('page_id');
        
        if (empty($boardId) || empty($pageId)) {
            http_response_code(400);
            echo json_encode(['error' => 'ID du tableau ou de la page manquant']);
            return;
        }
        
        // Load from page content instead of meta file
        $data = $this->loadFromPageContent($pageId, $boardId);
        
        if ($data !== null) {
            echo json_encode(['data' => $data]);
        } else {
            echo json_encode(['data' => null]);
        }
    }

    /**
     * Load kanban data from page content
     */
    private function loadFromPageContent($pageId, $boardId)
    {
        // Get current page content
        $currentContent = rawWiki($pageId);
        if ($currentContent === false) {
            return null;
        }
        
        // Find kanban block with the same ID
        $pattern = '/<kanban[^>]*id="' . preg_quote($boardId, '/') . '"[^>]*>(.*?)<\/kanban>/s';
        
        if (preg_match($pattern, $currentContent, $matches)) {
            // Parse the kanban content
            $kanbanContent = trim($matches[1]);
            return $this->parseKanbanContentToData($kanbanContent);
        }
        
        // If no specific ID match, try to find first kanban block
        $pattern = '/<kanban[^>]*>(.*?)<\/kanban>/s';
        if (preg_match($pattern, $currentContent, $matches)) {
            $kanbanContent = trim($matches[1]);
            return $this->parseKanbanContentToData($kanbanContent);
        }
        
        return null;
    }

    /**
     * Parse kanban wiki content to data structure
     */
    private function parseKanbanContentToData($content)
    {
        $data = [
            'title' => 'Kanban Board',
            'columns' => []
        ];
        
        $lines = explode("\n", $content);
        $currentColumn = null;
        
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;
            
            // Column header (starts with ##)
            if (preg_match('/^##\s*(.+)$/', $line, $matches)) {
                if ($currentColumn !== null) {
                    $data['columns'][] = $currentColumn;
                }
                $currentColumn = [
                    'id' => uniqid('col_'),
                    'title' => trim($matches[1]),
                    'cards' => []
                ];
                continue;
            }
            
            // Card (starts with *)
            if (preg_match('/^\*\s*(.+)$/', $line, $matches) && $currentColumn !== null) {
                $cardContent = trim($matches[1]);
                $card = $this->parseCardFromWiki($cardContent);
                $currentColumn['cards'][] = $card;
            }
        }
        
        // Add last column
        if ($currentColumn !== null) {
            $data['columns'][] = $currentColumn;
        }
        
        return $data;
    }

    /**
     * Parse individual card from wiki format
     */
    private function parseCardFromWiki($content)
    {
        $card = [
            'id' => uniqid('card_'),
            'title' => $content,
            'description' => '',
            'priority' => 'normal',
            'assignee' => '',
            'tags' => [],
            'creator' => '',
            'created' => ''
        ];
        
        // Parse card format: Title [priority:high] [assignee:John] [tags:urgent,bug] [creator:admin] [created:2024-01-01] [description:...]
        if (preg_match('/^(.*?)\s*(?:\[(.*?)\])*$/', $content, $matches)) {
            $card['title'] = trim($matches[1]);
            
            // Parse all attribute blocks
            if (preg_match_all('/\[([^\]]+)\]/', $content, $attrMatches)) {
                foreach ($attrMatches[1] as $attrBlock) {
                    if (strpos($attrBlock, ':') !== false) {
                        list($key, $value) = explode(':', $attrBlock, 2);
                        $key = trim($key);
                        $value = trim($value);
                        
                        if ($key === 'tags') {
                            $card['tags'] = array_map('trim', explode(',', $value));
                        } elseif ($key === 'description') {
                            // Decode description (restore newlines and brackets)
                            $card['description'] = str_replace(["\\n", "&#91;", "&#93;"], ["\n", "[", "]"], $value);
                        } else {
                            $card[$key] = $value;
                        }
                    }
                }
            }
        }
        
        return $card;
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
