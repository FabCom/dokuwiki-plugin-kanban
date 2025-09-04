<?php
/**
 * DokuWiki Plugin Kanban - KanbanView Syntax Component
 * 
 * Permet d'inclure des vues kanban dans d'autres pages
 * Syntaxes supportées :
 * - <kanbanview board="namespace:page" />
 * - <kanbanview board="namespace:page" column="column1" />  
 * - <kanbanview board="namespace:page" card="card123" />
 * - <kanbanview board="namespace:page" readonly="true" />
 *
 * @license GPL 2 http://www.gnu.org/licenses/gpl-2.0.html
 * @author  Kanban Plugin Team
 */

use dokuwiki\Extension\SyntaxPlugin;

class syntax_plugin_kanban_kanbanview extends SyntaxPlugin
{
    /**
     * @return string Syntax mode type
     */
    public function getType()
    {
        return 'substition';
    }

    /**
     * @return string Paragraph type
     */
    public function getPType()
    {
        return 'block';
    }

    /**
     * @return int Sort order - the parser runs from low to high
     */
    public function getSort()
    {
        return 190; // Avant le kanban principal
    }

    /**
     * Connect lookup pattern to lexer.
     *
     * @param string $mode Parser mode
     */
    public function connectTo($mode)
    {
        // Pattern pour balise auto-fermante ou avec contenu
        $this->Lexer->addSpecialPattern('<kanbanview\b[^>]*/?>', $mode, 'plugin_kanban_kanbanview');
    }

    /**
     * Handle matches of the kanbanview syntax
     *
     * @param string $match The match of the syntax
     * @param int    $state The state of the handler
     * @param int    $pos The position in the document
     * @param Doku_Handler $handler The handler
     * @return array Data for the renderer
     */
    public function handle($match, $state, $pos, Doku_Handler $handler)
    {
        // Parse attributes from the kanbanview tag
        $attributes = $this->parseAttributes($match);
        
        // Valider que 'board' est spécifié
        if (empty($attributes['board'])) {
            return array('error', 'Attribut "board" requis pour kanbanview');
        }
        
        return array('kanbanview', $attributes);
    }

    /**
     * Render xhtml output or metadata
     *
     * @param string         $mode      Renderer mode (supported modes: xhtml)
     * @param Doku_Renderer  $renderer  The renderer
     * @param array          $data      The data from the handler() function
     * @return bool If rendering was successful.
     */
    public function render($mode, Doku_Renderer $renderer, $data)
    {
        if ($mode !== 'xhtml') {
            return false;
        }

        list($type, $content) = $data;

        switch ($type) {
            case 'kanbanview':
                // Vérifier si on est en mode édition (pour éviter les conflits avec QuillJS)
                global $ACT;
                if ($ACT === 'edit' || $ACT === 'preview') {
                    // En mode édition, afficher un placeholder simple
                    $this->renderEditModePlaceholder($renderer, $content);
                } else {
                    // En mode normal, afficher la vue kanban
                    $this->renderKanbanView($renderer, $content);
                }
                return true;
                
            case 'error':
                $renderer->doc .= '<div class="error">Erreur KanbanView: ' . htmlspecialchars($content) . '</div>';
                return true;
        }

        return false;
    }

    /**
     * Parse attributes from the kanbanview tag
     */
    private function parseAttributes($match)
    {
        $attributes = array(
            'board' => '',        // Page contenant le kanban (requis)
            'column' => '',       // ID de colonne spécifique (optionnel)
            'card' => '',         // ID de carte spécifique (optionnel)
            'readonly' => 'false', // Mode lecture seule (défaut: false)
            'height' => 'auto',   // Hauteur du conteneur (optionnel)
            'width' => '100%'     // Largeur du conteneur (optionnel)
        );

        // Extract attributes from tag
        if (preg_match_all('/(\w+)=["\']([^"\']*)["\']/', $match, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $attributes[$match[1]] = $match[2];
            }
        }

        return $attributes;
    }

    /**
     * Render placeholder en mode édition pour éviter les conflits avec QuillJS
     */
    private function renderEditModePlaceholder($renderer, $attributes)
    {
        $board = htmlspecialchars($attributes['board']);
        $column = htmlspecialchars($attributes['column']);
        $card = htmlspecialchars($attributes['card']);
        $readonly = $attributes['readonly'] === 'true' ? 'true' : 'false';
        
        $placeholderText = "📋 Vue Kanban";
        if ($column) {
            $placeholderText .= " (Colonne: $column)";
        } elseif ($card) {
            $placeholderText .= " (Carte: $card)";
        }
        if ($readonly === 'true') {
            $placeholderText .= " [Lecture seule]";
        }
        
        $renderer->doc .= '<div class="kanban-view-placeholder" style="
            background: #f8f9fa;
            border: 2px dashed #6c757d;
            padding: 20px;
            text-align: center;
            margin: 15px 0;
            border-radius: 6px;
            color: #6c757d;
            font-style: italic;
        ">';
        $renderer->doc .= '<strong>' . $placeholderText . '</strong><br>';
        $renderer->doc .= '<small>Source: ' . $board . '</small>';
        $renderer->doc .= '</div>';
    }

    /**
     * Render kanban view inclusion
     */
    private function renderKanbanView($renderer, $attributes)
    {
        global $INFO;
        
        // SECURITY: Load security policy manager
        require_once(dirname(__FILE__) . '/../KanbanAuthManager.php');
        require_once(dirname(__FILE__) . '/../KanbanSecurityPolicy.php');
        
        // Générer un ID unique pour cette vue
        $viewId = uniqid('kanbanview_');
        
        // SECURITY: Sanitize all attributes
        $board = KanbanSecurityPolicy::sanitizeForJS($attributes['board'], 'pageid');
        $column = KanbanSecurityPolicy::sanitizeForJS($attributes['column'], 'columnid');
        $card = KanbanSecurityPolicy::sanitizeForJS($attributes['card'], 'cardid');
        $readonly = $attributes['readonly'] === 'true' ? 'true' : 'false';
        $height = KanbanSecurityPolicy::sanitizeForJS($attributes['height'], 'css');
        $width = KanbanSecurityPolicy::sanitizeForJS($attributes['width'], 'css');
        
        // SECURITY: Validate board page ID
        if (!$this->isValidPageId($board)) {
            $renderer->doc .= '<div class="error">Erreur KanbanView: ID de page invalide</div>';
            return;
        }
        
        // Vérifier les permissions de lecture sur la page source
        if (!$this->canReadPage($board)) {
            $renderer->doc .= '<div class="error">Erreur KanbanView: Pas d\'autorisation pour lire la page ' . htmlspecialchars($board) . '</div>';
            return;
        }
        
        // Créer le conteneur de la vue
        $style = '';
        if ($height !== 'auto') {
            $style .= 'height: ' . htmlspecialchars($height) . '; ';
        }
        if ($width !== '100%') {
            $style .= 'width: ' . htmlspecialchars($width) . '; ';
        }
        if ($style) {
            $style = ' style="' . trim($style) . '"';
        }
        
        $renderer->doc .= '<div class="kanban-view" id="' . $viewId . '"' . $style . 
                          ' data-board="' . htmlspecialchars($board) . '"' .
                          ' data-column="' . htmlspecialchars($column) . '"' .
                          ' data-card="' . htmlspecialchars($card) . '"' .
                          ' data-readonly="' . $readonly . '">';
        
        // Message de chargement
        $renderer->doc .= '<div class="kanban-view-loading">⏳ Chargement de la vue kanban...</div>';
        
        // Conteneur pour le contenu
        $renderer->doc .= '<div class="kanban-view-content"></div>';
        
        $renderer->doc .= '</div>';
        
        // SECURITY: Generate safe JavaScript configuration
        $currentUser = KanbanAuthManager::getCurrentUser();
        $currentUser = KanbanSecurityPolicy::sanitizeForJS($currentUser ?: 'Anonymous', 'username');
        $currentPageId = KanbanSecurityPolicy::sanitizeForJS($INFO['id'] ?? '', 'pageid');
        
        // SECURITY: Detect potential XSS
        if (KanbanSecurityPolicy::detectXSSPatterns($currentUser . $currentPageId . $board)) {
            error_log("Kanban SECURITY: XSS attempt blocked in kanbanview.php");
            $renderer->doc .= '<div class="error">Erreur de sécurité détectée</div>';
            return;
        }
        
        // JavaScript pour initialiser la vue
        $jsCode = '
        document.addEventListener("DOMContentLoaded", function() {
            if (typeof KanbanView === "undefined") {
                console.error("KanbanView class not loaded");
                return;
            }
            
            var viewElement = document.getElementById("' . $viewId . '");
            if (viewElement) {
                var config = {
                    viewId: "' . $viewId . '",
                    board: ' . KanbanSecurityPolicy::safeJsonEncode($board) . ',
                    column: ' . KanbanSecurityPolicy::safeJsonEncode($column) . ',
                    card: ' . KanbanSecurityPolicy::safeJsonEncode($card) . ',
                    readonly: ' . $readonly . ',
                    currentUser: ' . KanbanSecurityPolicy::safeJsonEncode($currentUser) . ',
                    currentPage: ' . KanbanSecurityPolicy::safeJsonEncode($currentPageId) . '
                };
                
                new KanbanView(viewElement, config);
            }
        });';
        
        $renderer->doc .= KanbanSecurityPolicy::inlineScript($jsCode, 'kanbanview-init-' . $viewId);
    }
    
    /**
     * Valider un ID de page DokuWiki
     */
    private function isValidPageId($pageId)
    {
        // Vérifier le format de base d'un ID de page DokuWiki
        return preg_match('/^[a-zA-Z0-9_:.-]+$/', $pageId);
    }
    
    /**
     * Vérifier les permissions de lecture sur une page
     */
    private function canReadPage($pageId)
    {
        // Utiliser l'API DokuWiki pour vérifier les permissions
        global $AUTH;
        
        if (!$AUTH) {
            return true; // Pas d'authentification = accès libre
        }
        
        $perm = auth_quickaclcheck($pageId);
        return $perm >= AUTH_READ;
    }
}
