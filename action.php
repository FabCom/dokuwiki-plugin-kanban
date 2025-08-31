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
        // Ajouter user info AVANT TPL_METAHEADER_OUTPUT
        $controller->register_hook('DOKUWIKI_STARTED', 'AFTER', $this, 'addUserInfoToJSINFO');
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

        // Add JavaScript modules in correct dependency order
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/utils.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/modal.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/lockmanagement.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/dragdrop.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/script.js'
        ];
        
        // User info est ajouté via DOKUWIKI_STARTED hook
    }
    
    /**
     * Add user information to JSINFO for frontend access
     */
    public function addUserInfoToJSINFO(Event $event, $param)
    {
        global $JSINFO, $INFO, $conf, $ACT;
        
        // Ensure JSINFO array exists
        if (!is_array($JSINFO)) {
            $JSINFO = array();
        }
        
        // Try multiple sources for user information
        $currentUser = 'Anonyme';
        $userId = '';
        $userName = '';
        $userMail = '';
        
        // Primary: Check if user is logged in via INFO
        if (isset($INFO['client']) && !empty($INFO['client'])) {
            $userId = $INFO['client'];
            $currentUser = $INFO['client'];
            
            // Get full name if available
            if (isset($INFO['userinfo']['name']) && !empty($INFO['userinfo']['name'])) {
                $userName = $INFO['userinfo']['name'];
                $currentUser = $userName; // Prefer full name over ID
            }
            
            if (isset($INFO['userinfo']['mail'])) {
                $userMail = $INFO['userinfo']['mail'];
            }
        }
        
        // Fallback: Check $_SERVER for auth info
        if ($currentUser === 'Anonyme') {
            if (!empty($_SERVER['REMOTE_USER'])) {
                $currentUser = $_SERVER['REMOTE_USER'];
                $userId = $_SERVER['REMOTE_USER'];
            } elseif (!empty($_SERVER['PHP_AUTH_USER'])) {
                $currentUser = $_SERVER['PHP_AUTH_USER'];
                $userId = $_SERVER['PHP_AUTH_USER'];
            }
        }
        
        // Additional check: DokuWiki auth
        if ($currentUser === 'Anonyme' && function_exists('auth_ismanager') && function_exists('auth_quickaclcheck')) {
            global $ID;
            if (auth_quickaclcheck($ID) > 0) {
                // User has permissions, try to get username
                if (isset($_SESSION['auth']['user'])) {
                    $currentUser = $_SESSION['auth']['user'];
                    $userId = $_SESSION['auth']['user'];
                }
            }
        }
        
        // Development fallback: if we're in development/testing and no user is detected
        if ($currentUser === 'Anonyme' && (
            strpos($_SERVER['HTTP_HOST'] ?? '', 'localhost') !== false ||
            strpos($_SERVER['SERVER_NAME'] ?? '', 'localhost') !== false ||
            isset($_GET['debug_user'])
        )) {
            // Use a development user name if specified
            if (isset($_GET['debug_user']) && !empty($_GET['debug_user'])) {
                $currentUser = 'dev_' . preg_replace('/[^a-zA-Z0-9_]/', '', $_GET['debug_user']);
                $userId = $currentUser;
            } elseif (defined('KANBAN_DEV_USER')) {
                $currentUser = KANBAN_DEV_USER;
                $userId = KANBAN_DEV_USER;
            }
        }
        
        // If no user detected, create a fallback based on IP or generate a temp user
        if ($currentUser === 'Anonyme') {
            // Option 1: Use IP-based identification for demo/development
            $clientIP = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            $tempUser = 'Utilisateur_' . substr(md5($clientIP), 0, 6);
            
            // Option 2: Use a simple browser-based identification
            $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
            if (strpos($userAgent, 'Chrome') !== false) {
                $tempUser = 'Demo_Chrome_User';
            } elseif (strpos($userAgent, 'Firefox') !== false) {
                $tempUser = 'Demo_Firefox_User';
            } else {
                $tempUser = 'Demo_User';
            }
            
            $currentUser = $tempUser;
            $userId = $tempUser;
            
            error_log("Kanban: No auth detected, using fallback user: $currentUser");
        }
        
                // Debug logging plus visible
        $debugData = [
            'INFO_client' => $INFO['client'] ?? 'null',
            'INFO_userinfo_name' => $INFO['userinfo']['name'] ?? 'null',
            'INFO_userinfo_mail' => $INFO['userinfo']['mail'] ?? 'null',
            'REMOTE_USER' => $_SERVER['REMOTE_USER'] ?? 'null',
            'PHP_AUTH_USER' => $_SERVER['PHP_AUTH_USER'] ?? 'null',
            'detected_user' => $currentUser,
            'session_auth' => $_SESSION['auth'] ?? 'null',
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
        // Keep minimal logging for debugging if needed
        // error_log("Kanban Debug - User detection: " . json_encode($debugData));
        
        $JSINFO['kanban_user'] = $currentUser;
        $JSINFO['kanban_user_id'] = $userId;
        $JSINFO['kanban_user_name'] = $userName;
        $JSINFO['kanban_user_mail'] = $userMail;
        
        // Also add to script directly via inline JS
        $JSINFO['kanban_debug'] = [
            'user_detected' => $currentUser,
            'timestamp' => date('Y-m-d H:i:s'),
            'method' => !empty($INFO['client']) ? 'INFO' : (!empty($_SERVER['REMOTE_USER']) ? 'SERVER' : 'unknown')
        ];
        
        // Add HTML meta tag for JavaScript access
        global $JSINFO;
        if (!isset($JSINFO['kanban_html_injection'])) {
            $JSINFO['kanban_html_injection'] = '<meta name="kanban-user" content="' . htmlspecialchars($currentUser) . '">';
        }
        
        // Force add to HTML output directly
        $event->data['meta'][] = [
            'name' => 'kanban-user',
            'content' => htmlspecialchars($currentUser)
        ];
        $event->data['meta'][] = [
            'name' => 'kanban-user-name', 
            'content' => htmlspecialchars($userName)
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
                case 'lock_board':
                    $this->lockBoard();
                    break;
                case 'unlock_board':
                    $this->unlockBoard();
                    break;
                case 'check_lock':
                    $this->checkBoardLock();
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
     * Generate kanban content from data structure (JSON format)
     */
    private function generateKanbanContent($data)
    {
        // Extract columns from the data structure
        $columns = array();
        
        if (isset($data['columns']) && is_array($data['columns'])) {
            $columns = $data['columns'];
        }
        
        // Clean up the data structure for JSON storage
        foreach ($columns as $index => $column) {
            // Ensure required fields
            if (!isset($column['id'])) {
                $columns[$index]['id'] = uniqid('col_');
            }
            if (!isset($column['title'])) {
                $columns[$index]['title'] = 'Colonne ' . ($index + 1);
            }
            if (!isset($column['cards'])) {
                $columns[$index]['cards'] = array();
            }
            
            // Clean up cards
            foreach ($columns[$index]['cards'] as $cardIndex => $card) {
                if (!isset($card['id'])) {
                    $columns[$index]['cards'][$cardIndex]['id'] = uniqid('card_');
                }
                if (!isset($card['title'])) {
                    $columns[$index]['cards'][$cardIndex]['title'] = 'Carte sans titre';
                }
                
                // Remove empty or null values to keep JSON clean
                $cleanCard = array();
                foreach ($card as $key => $value) {
                    if ($value !== null && $value !== '' && !(is_array($value) && empty($value))) {
                        $cleanCard[$key] = $value;
                    }
                }
                $columns[$index]['cards'][$cardIndex] = $cleanCard;
            }
        }
        
        // Generate formatted JSON with proper indentation
        return json_encode($columns, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
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
        $pattern = '/<kanban([^>]*id="' . preg_quote($boardId, '/') . '"[^>]*)>(.*?)<\/kanban>/s';
        
        if (preg_match($pattern, $currentContent, $matches)) {
            $kanbanTag = $matches[1];
            $kanbanContent = trim($matches[2]);
            
            // Extract title from kanban tag attributes
            $title = 'Kanban Board'; // default
            if (preg_match('/title=["\']([^"\']*)["\']/', $kanbanTag, $titleMatch)) {
                $title = $titleMatch[1];
            }
            
            // Parse the kanban content
            $data = $this->parseKanbanContentToData($kanbanContent);
            $data['title'] = $title; // Override with extracted title
            return $data;
        }
        
        // If no specific ID match, try to find first kanban block
        $pattern = '/<kanban([^>]*)>(.*?)<\/kanban>/s';
        if (preg_match($pattern, $currentContent, $matches)) {
            $kanbanTag = $matches[1];
            $kanbanContent = trim($matches[2]);
            
            // Extract title from kanban tag attributes
            $title = 'Kanban Board'; // default
            if (preg_match('/title=["\']([^"\']*)["\']/', $kanbanTag, $titleMatch)) {
                $title = $titleMatch[1];
            }
            
            // Parse the kanban content
            $data = $this->parseKanbanContentToData($kanbanContent);
            $data['title'] = $title; // Override with extracted title
            return $data;
        }
        
        return null;
    }

    /**
     * Parse kanban wiki content to data structure
     */
    private function parseKanbanContentToData($content)
    {
        $content = trim($content);
        
        // If content is empty, return default structure
        if (empty($content)) {
            return [
                'title' => 'Kanban Board',
                'columns' => [
                    [
                        'id' => uniqid('col_'),
                        'title' => 'À faire',
                        'cards' => []
                    ],
                    [
                        'id' => uniqid('col_'),
                        'title' => 'En cours',
                        'cards' => []
                    ],
                    [
                        'id' => uniqid('col_'),
                        'title' => 'Terminé',
                        'cards' => []
                    ]
                ]
            ];
        }
        
        // Try to parse as JSON
        $columns = json_decode($content, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            // Invalid JSON, return default structure
            return [
                'title' => 'Kanban Board',
                'columns' => [
                    [
                        'id' => uniqid('col_'),
                        'title' => 'À faire',
                        'cards' => []
                    ],
                    [
                        'id' => uniqid('col_'),
                        'title' => 'En cours',
                        'cards' => []
                    ],
                    [
                        'id' => uniqid('col_'),
                        'title' => 'Terminé',
                        'cards' => []
                    ]
                ]
            ];
        }
        
        // Validate and ensure required fields
        if (!is_array($columns)) {
            $columns = [];
        }
        
        foreach ($columns as $index => $column) {
            // Ensure column has required fields
            if (!isset($column['id'])) {
                $columns[$index]['id'] = uniqid('col_');
            }
            if (!isset($column['title'])) {
                $columns[$index]['title'] = 'Colonne ' . ($index + 1);
            }
            if (!isset($column['cards']) || !is_array($column['cards'])) {
                $columns[$index]['cards'] = [];
            }
            
            // Validate cards
            foreach ($columns[$index]['cards'] as $cardIndex => $card) {
                if (!isset($card['id'])) {
                    $columns[$index]['cards'][$cardIndex]['id'] = uniqid('card_');
                }
                if (!isset($card['title'])) {
                    $columns[$index]['cards'][$cardIndex]['title'] = 'Carte sans titre';
                }
                
                // Set default values for optional fields
                $defaultCard = [
                    'description' => '',
                    'priority' => 'normal',
                    'assignee' => '',
                    'tags' => [],
                    'creator' => '',
                    'created' => date('Y-m-d H:i:s')
                ];
                
                $columns[$index]['cards'][$cardIndex] = array_merge($defaultCard, $card);
            }
        }
        
        return [
            'title' => 'Kanban Board',
            'columns' => $columns
        ];
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

    /**
     * Lock a kanban board for editing
     */
    private function lockBoard()
    {
        global $INPUT, $INFO, $ID, $USERINFO;
        
        $pageId = $INPUT->str('page_id');
        if (empty($pageId)) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de page manquant']);
            return;
        }
        
        // Sauvegarder l'ID actuel et utiliser l'ID de la page kanban
        $originalID = $ID;
        $ID = $pageId;
        
        // Vérifier les permissions d'écriture
        $pageInfo = pageinfo();
        if (!$pageInfo['writable']) {
            $ID = $originalID; // Restaurer l'ID original
            http_response_code(403);
            echo json_encode(['error' => 'Permission d\'écriture refusée']);
            return;
        }
        
        // Vérifier si déjà verrouillé
        $lockedBy = checklock($pageId);
        if ($lockedBy) {
            $ID = $originalID; // Restaurer l'ID original
            http_response_code(409);
            echo json_encode([
                'error' => 'Page déjà verrouillée',
                'locked_by' => $lockedBy,
                'locked' => true
            ]);
            return;
        }
        
        // Verrouiller la page
        lock($pageId);
        
        // Vérifier immédiatement si le verrouillage a fonctionné
        $lockedBy = checklock($pageId);
        
        // Debug logging
        error_log("Kanban Debug - lockBoard: pageId=$pageId, après lock() lockedBy=" . var_export($lockedBy, true));
        
        // Si le verrouillage natif ne fonctionne pas, utiliser une approche alternative
        if (!$lockedBy) {
            // Utiliser la même structure que DokuWiki pour le nom d'utilisateur
            // Examiner $INFO pour voir ce qui est disponible
            $currentUser = 'Utilisateur';
            
            if (!empty($INFO['userinfo']['name'])) {
                $currentUser = $INFO['userinfo']['name'];
            } elseif (!empty($INFO['userinfo']['mail'])) {
                $currentUser = $INFO['userinfo']['mail'];
            }
            
            error_log("Kanban Debug - lockBoard: INFO structure = " . print_r($INFO, true));
            
            // Créer notre propre fichier de verrouillage
            $lockDir = DOKU_INC . 'data/locks/';
            if (!is_dir($lockDir)) {
                mkdir($lockDir, 0755, true);
            }
            $lockFile = $lockDir . str_replace(':', '_', $pageId) . '.kanban.lock';
            file_put_contents($lockFile, $currentUser);
            
            $lockedBy = $currentUser;
            error_log("Kanban Debug - lockBoard: Utilisation système alternatif, currentUser=" . var_export($currentUser, true));
        }
        
        // Restaurer l'ID original
        $ID = $originalID;
        
        echo json_encode([
            'success' => true,
            'message' => 'Board verrouillé pour édition',
            'locked' => true,
            'locked_by' => $lockedBy
        ]);
    }

    /**
     * Unlock a kanban board
     */
    private function unlockBoard()
    {
        global $INPUT;
        
        $pageId = $INPUT->str('page_id');
        if (empty($pageId)) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de page manquant']);
            return;
        }
        
        // Déverrouiller la page
        $unlocked = unlock($pageId);
        
        // Supprimer aussi notre fichier backup si il existe
        $lockFile = DOKU_INC . 'data/locks/' . str_replace(':', '_', $pageId) . '.kanban.lock';
        if (file_exists($lockFile)) {
            unlink($lockFile);
        }
        
        echo json_encode([
            'success' => true,
            'message' => $unlocked ? 'Board déverrouillé' : 'Aucun verrou à supprimer',
            'locked' => false,
            'unlocked' => $unlocked
        ]);
    }

    /**
     * Check if a kanban board is locked
     */
    private function checkBoardLock()
    {
        global $INPUT, $INFO;
        
        $pageId = $INPUT->str('page_id');
        if (empty($pageId)) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de page manquant']);
            return;
        }
        
        $lockedBy = checklock($pageId);
        
        // Si le verrouillage DokuWiki ne retourne rien, vérifier notre fichier backup
        if (!$lockedBy) {
            $lockFile = DOKU_INC . 'data/locks/' . str_replace(':', '_', $pageId) . '.kanban.lock';
            if (file_exists($lockFile)) {
                $lockedBy = file_get_contents($lockFile);
            }
        }
        
        // Debug logging
        error_log("Kanban Debug - checkBoardLock: pageId=$pageId, lockedBy=" . var_export($lockedBy, true));
        
        echo json_encode([
            'locked' => (bool)$lockedBy,
            'locked_by' => $lockedBy ?: null,
            'page_id' => $pageId
        ]);
    }
}
