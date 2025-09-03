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
        
        // Add filters CSS
        $event->data['link'][] = [
            'type' => 'text/css',
            'rel' => 'stylesheet',
            'href' => DOKU_BASE . 'lib/plugins/kanban/css/filters.css'
        ];

        // Add JavaScript modules in correct dependency order
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/utils.js'
        ];
        
        // Modal modules (core first, then specialized modules)
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/modal-core.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/modal-cards.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/modal-columns.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/modal-links.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/modal-media.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/discussions.js'
        ];
        
        $event->data['script'][] = [
            'type' => 'text/javascript',
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/modal-main.js'
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
            'src' => DOKU_BASE . 'lib/plugins/kanban/js/filters.js'
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
                case 'get_board_data':
                    $this->getBoardData();
                    break;
                case 'renew_lock':
                    $this->renewLock();
                    break;
                case 'get_discussions':
                    $this->getCardDiscussions();
                    break;
                case 'save_discussions':
                    $this->saveCardDiscussions();
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
        
        // If content is empty, return empty structure without default columns
        if (empty($content)) {
            return [
                'title' => 'Kanban Board',
                'columns' => []
            ];
        }
        
        // Try to parse as JSON
        $columns = json_decode($content, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            // Invalid JSON, return empty structure instead of defaults
            return [
                'title' => 'Kanban Board',
                'columns' => []
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
            // Récupérer le nom d'utilisateur de plusieurs sources possibles
            global $conf;
            $currentUser = 'Utilisateur'; // Fallback par défaut
            
            // Source 1: Variable globale DokuWiki
            if (!empty($_SERVER['REMOTE_USER'])) {
                $currentUser = $_SERVER['REMOTE_USER'];
            }
            // Source 2: INFO structure
            elseif (!empty($INFO['client'])) {
                $currentUser = $INFO['client'];
            }
            // Source 3: Userinfo name
            elseif (!empty($INFO['userinfo']['name'])) {
                $currentUser = $INFO['userinfo']['name'];
            }
            // Source 4: Userinfo mail comme fallback
            elseif (!empty($INFO['userinfo']['mail'])) {
                $currentUser = $INFO['userinfo']['mail'];
            }
            
            error_log("Kanban Debug - lockBoard: Utilisateur détecté = '$currentUser' (sources: REMOTE_USER='" . ($_SERVER['REMOTE_USER'] ?? 'vide') . "', client='" . ($INFO['client'] ?? 'vide') . "', name='" . ($INFO['userinfo']['name'] ?? 'vide') . "')");
            
            // Créer notre propre fichier de verrouillage avec timestamp
            $lockDir = DOKU_INC . 'data/locks/';
            if (!is_dir($lockDir)) {
                mkdir($lockDir, 0755, true);
            }
            $lockFile = $lockDir . str_replace(':', '_', $pageId) . '.kanban.lock';
            
            // Stocker utilisateur et timestamp (format: "utilisateur|timestamp")
            $lockData = $currentUser . '|' . time();
            file_put_contents($lockFile, $lockData);
            
            $lockedBy = $currentUser;
            error_log("Kanban Debug - lockBoard: Verrou créé pour '$currentUser' dans $lockFile avec timestamp");
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
                $lockContent = file_get_contents($lockFile);
                
                // Vérifier si le format inclut un timestamp
                if (strpos($lockContent, '|') !== false) {
                    list($lockUser, $lockTime) = explode('|', $lockContent, 2);
                    
                    // Vérifier l'expiration (15 minutes = 900 secondes, comme DokuWiki)
                    global $conf;
                    $locktime = isset($conf['locktime']) ? $conf['locktime'] : 900;
                    
                    if (time() - $lockTime > $locktime) {
                        // Verrou expiré, le supprimer
                        unlink($lockFile);
                        error_log("Kanban Debug - checkBoardLock: Verrou expiré pour '$lockUser', supprimé");
                        $lockedBy = null;
                    } else {
                        $lockedBy = $lockUser;
                    }
                } else {
                    // Ancien format sans timestamp, considérer comme expiré
                    unlink($lockFile);
                    error_log("Kanban Debug - checkBoardLock: Ancien verrou sans timestamp supprimé");
                    $lockedBy = null;
                }
            }
        }
        
        // Récupérer l'utilisateur actuel avec la même logique que lockBoard
        $currentUser = 'Utilisateur'; // Fallback par défaut
        
        if (!empty($_SERVER['REMOTE_USER'])) {
            $currentUser = $_SERVER['REMOTE_USER'];
        } elseif (!empty($INFO['client'])) {
            $currentUser = $INFO['client'];
        } elseif (!empty($INFO['userinfo']['name'])) {
            $currentUser = $INFO['userinfo']['name'];
        } elseif (!empty($INFO['userinfo']['mail'])) {
            $currentUser = $INFO['userinfo']['mail'];
        }
        
        // Si la page est verrouillée par l'utilisateur actuel, considérer comme "pas verrouillée" côté client
        $isLockedByOther = $lockedBy && ($lockedBy !== $currentUser);
        
        // Debug logging
        error_log("Kanban Debug - checkBoardLock: pageId=$pageId, lockedBy=" . var_export($lockedBy, true) . ", currentUser=" . var_export($currentUser, true) . ", isLockedByOther=" . var_export($isLockedByOther, true));
        
        echo json_encode([
            'locked' => $isLockedByOther,
            'locked_by' => $isLockedByOther ? $lockedBy : null,
            'page_id' => $pageId
        ]);
    }

    /**
     * Get current board data from the page
     */
    private function getBoardData()
    {
        global $INPUT;
        
        $pageId = $INPUT->str('page_id');
        if (empty($pageId)) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de page manquant']);
            return;
        }

        // Get the current page content
        $text = rawWiki($pageId);
        if ($text === false) {
            http_response_code(404);
            echo json_encode(['error' => 'Page non trouvée']);
            return;
        }

        // Extract kanban data from the page
        $boardData = $this->extractKanbanData($text);
        
        if ($boardData) {
            echo json_encode([
                'success' => true,
                'board_data' => $boardData
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'error' => 'Aucune donnée kanban trouvée'
            ]);
        }
    }

    /**
     * Renew lock for a board
     */
    private function renewLock()
    {
        global $INPUT, $INFO;
        
        $pageId = $INPUT->str('page_id');
        if (empty($pageId)) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de page manquant']);
            return;
        }

        // Récupérer l'utilisateur actuel
        $currentUser = 'Utilisateur';
        if (!empty($_SERVER['REMOTE_USER'])) {
            $currentUser = $_SERVER['REMOTE_USER'];
        } elseif (!empty($INFO['client'])) {
            $currentUser = $INFO['client'];
        } elseif (!empty($INFO['userinfo']['name'])) {
            $currentUser = $INFO['userinfo']['name'];
        } elseif (!empty($INFO['userinfo']['mail'])) {
            $currentUser = $INFO['userinfo']['mail'];
        }

        // Vérifier que l'utilisateur actuel détient le verrou
        $lockFile = DOKU_INC . 'data/locks/' . str_replace(':', '_', $pageId) . '.kanban.lock';
        
        if (!file_exists($lockFile)) {
            http_response_code(404);
            echo json_encode(['error' => 'Aucun verrou trouvé']);
            return;
        }

        $lockContent = file_get_contents($lockFile);
        if (strpos($lockContent, '|') !== false) {
            list($lockUser, $lockTime) = explode('|', $lockContent, 2);
            
            if ($lockUser !== $currentUser) {
                http_response_code(403);
                echo json_encode(['error' => 'Verrou détenu par un autre utilisateur']);
                return;
            }
        } else {
            // Ancien format, supprimer et dire qu'il n'y a plus de verrou
            unlink($lockFile);
            http_response_code(404);
            echo json_encode(['error' => 'Verrou expiré ou invalide']);
            return;
        }

        // Renouveler le verrou avec nouveau timestamp
        $lockData = $currentUser . '|' . time();
        file_put_contents($lockFile, $lockData);

        echo json_encode([
            'success' => true,
            'message' => 'Verrou renouvelé',
            'renewed_at' => time()
        ]);
    }

    /**
     * Extract kanban data from wiki text
     */
    private function extractKanbanData($text)
    {
        // Find kanban blocks in the text
        $pattern = '/\<kanban[^>]*\>(.*?)\<\/kanban\>/s';
        preg_match($pattern, $text, $matches);
        
        if (!isset($matches[1])) {
            return null;
        }
        
        $content = trim($matches[1]);
        
        // Si le contenu est vide, retourner un kanban vide
        if (empty($content)) {
            return [
                'title' => 'Kanban Board',
                'columns' => []
            ];
        }
        
        // Try to parse as JSON first
        $jsonData = json_decode($content, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            // If it's a complete board structure, return it
            if (isset($jsonData['columns'])) {
                return $jsonData;
            }
            // If it's just columns, wrap in board structure
            if (is_array($jsonData) && isset($jsonData[0]['id'])) {
                return [
                    'title' => 'Kanban Board',
                    'columns' => $jsonData
                ];
            }
        }
        
        // Fallback: parse as simple column list (seulement si contenu non vide)
        $columnsArray = explode(',', $content);
        $columns = array();
        foreach ($columnsArray as $columnTitle) {
            $title = trim($columnTitle);
            if (!empty($title)) {
                $columns[] = array(
                    'id' => uniqid('col_'),
                    'title' => $title,
                    'cards' => array()
                );
            }
        }
        
        return [
            'title' => 'Kanban Board',
            'columns' => $columns
        ];
    }

    /**
     * Get card discussions from a discussion page
     */
    private function getCardDiscussions()
    {
        global $INPUT;
        
        $discussionPageId = $INPUT->str('id');
        
        if (!$discussionPageId) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de page de discussion requis']);
            return;
        }

        try {
            // Utiliser les fonctions DokuWiki pour lire une page
            $discussionContent = rawWiki($discussionPageId);
            
            if (empty($discussionContent)) {
                // Page n'existe pas ou est vide
                echo json_encode(['discussions' => []]);
                return;
            }
            
            // Essayer de parser le JSON
            $discussionData = json_decode($discussionContent, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                // Si ce n'est pas du JSON valide, considérer comme vide
                echo json_encode(['discussions' => []]);
                return;
            }
            
            // Vérifier la structure attendue
            if (isset($discussionData['messages']) && is_array($discussionData['messages'])) {
                echo json_encode(['discussions' => $discussionData['messages']]);
            } else {
                echo json_encode(['discussions' => []]);
            }
            
        } catch (Exception $e) {
            error_log("Erreur lecture discussions: " . $e->getMessage());
            echo json_encode(['discussions' => []]);
        }
    }

    /**
     * Save card discussions to a discussion page
     */
    private function saveCardDiscussions()
    {
        global $INPUT, $INFO;
        
        $discussionPageId = $INPUT->str('id');
        $discussionData = $INPUT->str('data');
        
        if (!$discussionPageId || !$discussionData) {
            http_response_code(400);
            echo json_encode(['error' => 'Données requises manquantes']);
            return;
        }

        try {
            // Vérifier que les données sont du JSON valide
            $decodedData = json_decode($discussionData, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                http_response_code(400);
                echo json_encode(['error' => 'Données JSON invalides']);
                return;
            }
            
            // Obtenir l'utilisateur courant
            $currentUser = 'Anonyme';
            if (!empty($INFO['userinfo']['name'])) {
                $currentUser = $INFO['userinfo']['name'];
            } elseif (!empty($INFO['userinfo']['mail'])) {
                $currentUser = $INFO['userinfo']['mail'];
            }
            
            // Ajouter des métadonnées de sauvegarde
            $decodedData['lastSavedBy'] = $currentUser;
            $decodedData['lastSavedAt'] = date('c');
            
            // Reformater en JSON propre
            $jsonContent = json_encode($decodedData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            
            // Utiliser saveWikiText pour sauvegarder
            $summary = 'Mise à jour des discussions de carte (automatique)';
            
            // Sauvegarder la page
            saveWikiText($discussionPageId, $jsonContent, $summary);
            
            echo json_encode(['success' => true]);
            
        } catch (Exception $e) {
            error_log("Erreur sauvegarde discussions: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Erreur lors de la sauvegarde']);
        }
    }
}
