<?php
/**
 * DokuWiki Plugin Kanban (Syntax Component) - JSON-First Architecture
 *
 * @license GPL 2 http://www.gnu.org/licenses/gpl-2.0.html
 * @author  Kanban Plugin Team
 */

use dokuwiki\Extension\SyntaxPlugin;

class syntax_plugin_kanban extends SyntaxPlugin
{
    /**
     * @return string Syntax mode type
     */
    public function getType()
    {
        return 'container';
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
        return 200;
    }

    /**
     * Connect lookup pattern to lexer.
     *
     * @param string $mode Parser mode
     */
    public function connectTo($mode)
    {
        $this->Lexer->addEntryPattern('<kanban.*?>(?=.*?</kanban>)', $mode, 'plugin_kanban');
    }

    public function postConnect()
    {
        $this->Lexer->addExitPattern('</kanban>', 'plugin_kanban');
    }

    /**
     * Handle matches of the kanban syntax
     *
     * @param string $match The match of the syntax
     * @param int    $state The state of the handler
     * @param int    $pos The position in the document
     * @param Doku_Handler $handler The handler
     * @return array Data for the renderer
     */
    public function handle($match, $state, $pos, Doku_Handler $handler)
    {
        switch ($state) {
            case DOKU_LEXER_ENTER:
                // Parse attributes from opening tag
                $attributes = $this->parseAttributes($match);
                return array('kanban_start', $attributes);

            case DOKU_LEXER_UNMATCHED:
                // Parse kanban content
                return array('kanban_content', $this->parseKanbanContent($match));

            case DOKU_LEXER_EXIT:
                return array('kanban_end', '');
        }

        return array();
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
            case 'kanban_start':
                $this->renderKanbanStart($renderer, $content);
                return true;

            case 'kanban_content':
                $this->renderKanbanContent($renderer, $content);
                return true;

            case 'kanban_end':
                $this->renderKanbanEnd($renderer);
                return true;
        }

        return false;
    }

    /**
     * Parse attributes from the opening kanban tag
     */
    private function parseAttributes($match)
    {
        $attributes = array(
            'id' => uniqid('kanban_'),
            'title' => 'Kanban Board',
            'columns' => '',
            'editable' => 'true',
            'sortable' => 'true'
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
     * Parse kanban content (JSON format)
     */
    public function parseKanbanContent($content)
    {
        $content = trim($content);
        
        // If content is empty, return empty structure
        if (empty($content)) {
            return [];
        }
        
        // Try to parse as JSON
        $jsonData = json_decode($content, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            // If it's a complete board structure
            if (isset($jsonData['columns'])) {
                return $jsonData['columns'];
            }
            // If it's just the columns array
            if (is_array($jsonData) && isset($jsonData[0]['id'])) {
                return $jsonData;
            }
        }
        
        // Fallback to empty structure if parsing fails
        return [];
    }

    /**
     * Render kanban board start - JSON-First approach
     */
    private function renderKanbanStart($renderer, $attributes)
    {
        $id = $attributes['id'];
        $title = htmlspecialchars($attributes['title']);
        $editable = $attributes['editable'] === 'true' ? 'true' : 'false';
        $sortable = $attributes['sortable'] === 'true' ? 'true' : 'false';
        
        // Container principal avec attributs de configuration
        $renderer->doc .= '<div class="kanban-board" id="' . $id . '" 
                                data-editable="' . $editable . '" 
                                data-sortable="' . $sortable . '"
                                data-title="' . $title . '">';
    }

    /**
     * Render kanban content - JSON-First approach
     */
    private function renderKanbanContent($renderer, $columns)
    {
        global $INFO;
        
        // Convertir les données en JSON pour JavaScript
        $boardData = array(
            'title' => '',  // Sera récupéré depuis data-title
            'columns' => $columns
        );
        
        $jsonData = json_encode($boardData, JSON_UNESCAPED_UNICODE);
        
        // Container pour les données JSON (lu par JavaScript)
        $renderer->doc .= '<script type="application/json" class="kanban-data">' . $jsonData . '</script>';
        
        // Ajouter les informations utilisateur pour le système de verrouillage
        // Utiliser la même logique que dans action.php
        $currentUser = 'Utilisateur';
        
        if (!empty($INFO['userinfo']['name'])) {
            $currentUser = $INFO['userinfo']['name'];
        } elseif (!empty($INFO['userinfo']['mail'])) {
            $currentUser = $INFO['userinfo']['mail'];
        }
        
        $pageId = $INFO['id'] ?? '';
        
        // Debug logging pour comprendre la structure de $INFO
        error_log("Kanban Debug - syntax.php: currentUser=" . var_export($currentUser, true) . ", INFO structure=" . print_r($INFO, true));
        
        $renderer->doc .= '<script type="text/javascript">';
        $renderer->doc .= 'if (typeof JSINFO === "undefined") JSINFO = {};';
        $renderer->doc .= 'JSINFO.kanban_user = ' . json_encode($currentUser) . ';';
        $renderer->doc .= 'JSINFO.kanban_page_id = ' . json_encode($pageId) . ';';
        $renderer->doc .= '</script>';
        
        // Container vide pour le contenu généré par JavaScript
        $renderer->doc .= '<div class="kanban-content-container" data-loading="true">';
        $renderer->doc .= '<div class="kanban-loading">⏳ Chargement du tableau kanban...</div>';
        $renderer->doc .= '</div>';
    }

    /**
     * Render kanban board end - JSON-First approach
     */
    private function renderKanbanEnd($renderer)
    {
        $renderer->doc .= '</div>'; // Close kanban-board
    }
}
