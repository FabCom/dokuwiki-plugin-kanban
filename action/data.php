<?php
/**
 * DokuWiki Plugin Kanban - Data Action Component
 * 
 * Fournit les données JSON pour les vues kanban incluses
 *
 * @license GPL 2 http://www.gnu.org/licenses/gpl-2.0.html
 * @author  Kanban Plugin Team
 */

use dokuwiki\Extension\ActionPlugin;
use dokuwiki\Extension\EventHandler;
use dokuwiki\Extension\Event;

class action_plugin_kanban_data extends ActionPlugin
{
    /**
     * Registers a callback function for a given event
     *
     * @param EventHandler $controller DokuWiki's event controller object
     * @return void
     */
    public function register(EventHandler $controller)
    {
        $controller->register_hook('ACTION_ACT_PREPROCESS', 'BEFORE', $this, 'handle_kanban_data');
    }

    /**
     * Handle kanban data requests
     *
     * @param Event $event  event object by reference
     * @param mixed $param  [the parameters passed as fifth argument to register_hook() when this handler was registered]
     * @return void
     */
    public function handle_kanban_data(Event $event, $param)
    {
        global $ACT, $ID, $INPUT;

        if ($ACT !== 'kanban_data') {
            return;
        }

        // SECURITY: Load security managers
        require_once(dirname(__FILE__) . '/../KanbanAuthManager.php');
        require_once(dirname(__FILE__) . '/../KanbanSecurityPolicy.php');

        // Empêcher le traitement normal de DokuWiki
        $event->preventDefault();
        $event->stopPropagation();

        // SECURITY: Validate request
        if (!$this->validateRequest()) {
            $this->sendError('Requête invalide', 400);
            return;
        }

        // Récupérer l'ID de la page demandée
        $pageId = $INPUT->str('id');
        if (empty($pageId)) {
            $this->sendError('ID de page manquant', 400);
            return;
        }

        // SECURITY: Sanitize page ID
        $pageId = KanbanSecurityPolicy::sanitizeForJS($pageId, 'pageid');
        
        // Vérifier les permissions de lecture
        if (!$this->canReadPage($pageId)) {
            $this->sendError('Accès refusé', 403);
            return;
        }

        // Vérifier que la page existe
        if (!page_exists($pageId)) {
            $this->sendError('Page introuvable', 404);
            return;
        }

        try {
            // Extraire les données kanban de la page
            $kanbanData = $this->extractKanbanData($pageId);
            
            if ($kanbanData === null) {
                $this->sendError('Aucune donnée kanban trouvée', 404);
                return;
            }

            // SECURITY: Sanitize output data
            $kanbanData = $this->sanitizeKanbanData($kanbanData);

            // Envoyer les données JSON
            $this->sendJson($kanbanData);

        } catch (Exception $e) {
            error_log("Kanban data error: " . $e->getMessage());
            $this->sendError('Erreur interne du serveur', 500);
        }
    }

    /**
     * Valider la requête
     */
    private function validateRequest()
    {
        global $INPUT;

        // Vérifier que c'est une requête AJAX
        if (!$INPUT->server->str('HTTP_X_REQUESTED_WITH') === 'XMLHttpRequest') {
            return false;
        }

        // Vérifier la méthode HTTP
        if ($INPUT->server->str('REQUEST_METHOD') !== 'GET') {
            return false;
        }

        return true;
    }

    /**
     * Vérifier les permissions de lecture sur une page
     */
    private function canReadPage($pageId)
    {
        global $AUTH;

        if (!$AUTH) {
            return true; // Pas d'authentification = accès libre
        }

        $perm = auth_quickaclcheck($pageId);
        return $perm >= AUTH_READ;
    }

    /**
     * Extraire les données kanban d'une page
     */
    private function extractKanbanData($pageId)
    {
        // Lire le contenu de la page
        $content = rawWiki($pageId);
        
        if (empty($content)) {
            return null;
        }

        // Chercher les blocs kanban dans le contenu
        $pattern = '/<kanban[^>]*title=["\']([^"\']+)["\'][^>]*>(.*?)<\/kanban>/s';
        
        if (!preg_match($pattern, $content, $matches)) {
            return null;
        }

        $kanbanTitle = trim($matches[1]); // Titre extrait
        $kanbanContent = trim($matches[2]);
        
        // Parser le contenu JSON
        $jsonData = json_decode($kanbanContent, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            // Essayer de parser comme structure de colonnes directe
            return $this->parseAlternativeFormat($kanbanContent);
        }

        // Si c'est une structure complète avec 'columns'
        if (isset($jsonData['columns'])) {
            return $jsonData;
        }

        // Si c'est directement un tableau de colonnes
        if (is_array($jsonData) && isset($jsonData[0]['id'])) {
            return [
                'title' => $kanbanTitle,
                'columns' => $jsonData
            ];
        }

        return null;
    }

    /**
     * Parser un format alternatif si JSON échoue
     */
    private function parseAlternativeFormat($content)
    {
        // Structure par défaut vide
        return [
            'title' => 'Kanban Board',
            'columns' => []
        ];
    }

    /**
     * SECURITY: Sanitize kanban data before sending
     */
    private function sanitizeKanbanData($data)
    {
        if (!is_array($data)) {
            return [];
        }

        $sanitized = [];
        
        // Sanitize title
        if (isset($data['title'])) {
            $sanitized['title'] = KanbanSecurityPolicy::sanitizeForJS($data['title'], 'text');
        }

        // Sanitize columns
        if (isset($data['columns']) && is_array($data['columns'])) {
            $sanitized['columns'] = [];
            
            foreach ($data['columns'] as $column) {
                if (!is_array($column)) continue;
                
                $sanitizedColumn = [
                    'id' => KanbanSecurityPolicy::sanitizeForJS($column['id'] ?? '', 'columnid'),
                    'title' => KanbanSecurityPolicy::sanitizeForJS($column['title'] ?? '', 'text'),
                    'cards' => []
                ];

                // Sanitize cards
                if (isset($column['cards']) && is_array($column['cards'])) {
                    foreach ($column['cards'] as $card) {
                        if (!is_array($card)) continue;
                        
                        $sanitizedCard = [
                            'id' => KanbanSecurityPolicy::sanitizeForJS($card['id'] ?? '', 'cardid'),
                            'title' => KanbanSecurityPolicy::sanitizeForJS($card['title'] ?? '', 'text'),
                            'description' => KanbanSecurityPolicy::sanitizeForJS($card['description'] ?? '', 'html'),
                            'assignee' => KanbanSecurityPolicy::sanitizeForJS($card['assignee'] ?? '', 'username'),
                            'dueDate' => KanbanSecurityPolicy::sanitizeForJS($card['dueDate'] ?? '', 'date'),
                            'priority' => KanbanSecurityPolicy::sanitizeForJS($card['priority'] ?? '', 'text'),
                            'tags' => [],
                            'internalLinks' => [],
                            'externalLinks' => [],
                            'media' => []
                        ];

                        // Sanitize tags
                        if (isset($card['tags']) && is_array($card['tags'])) {
                            foreach ($card['tags'] as $tag) {
                                $sanitizedCard['tags'][] = KanbanSecurityPolicy::sanitizeForJS($tag, 'text');
                            }
                        }

                        // Sanitize internal links
                        if (isset($card['internalLinks']) && is_array($card['internalLinks'])) {
                            foreach ($card['internalLinks'] as $link) {
                                if (is_array($link)) {
                                    $sanitizedCard['internalLinks'][] = [
                                        'target' => KanbanSecurityPolicy::sanitizeForJS($link['target'] ?? '', 'text'),
                                        'text' => KanbanSecurityPolicy::sanitizeForJS($link['text'] ?? '', 'text')
                                    ];
                                }
                            }
                        }

                        // Sanitize external links
                        if (isset($card['externalLinks']) && is_array($card['externalLinks'])) {
                            foreach ($card['externalLinks'] as $link) {
                                if (is_array($link)) {
                                    $sanitizedCard['externalLinks'][] = [
                                        'url' => KanbanSecurityPolicy::sanitizeForJS($link['url'] ?? '', 'url'),
                                        'text' => KanbanSecurityPolicy::sanitizeForJS($link['text'] ?? '', 'text')
                                    ];
                                }
                            }
                        }

                        // Sanitize media
                        if (isset($card['media']) && is_array($card['media'])) {
                            foreach ($card['media'] as $media) {
                                if (is_array($media)) {
                                    $sanitizedCard['media'][] = [
                                        'id' => KanbanSecurityPolicy::sanitizeForJS($media['id'] ?? '', 'text'),
                                        'name' => KanbanSecurityPolicy::sanitizeForJS($media['name'] ?? '', 'text'),
                                        'type' => KanbanSecurityPolicy::sanitizeForJS($media['type'] ?? '', 'text'),
                                        'url' => KanbanSecurityPolicy::sanitizeForJS($media['url'] ?? '', 'url'),
                                        'thumb' => KanbanSecurityPolicy::sanitizeForJS($media['thumb'] ?? '', 'url')
                                    ];
                                }
                            }
                        }

                        $sanitizedColumn['cards'][] = $sanitizedCard;
                    }
                }

                $sanitized['columns'][] = $sanitizedColumn;
            }
        }

        return $sanitized;
    }

    /**
     * Envoyer une réponse JSON
     */
    private function sendJson($data)
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    /**
     * Envoyer une erreur
     */
    private function sendError($message, $code = 400)
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        
        echo json_encode([
            'error' => $message,
            'code' => $code
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
