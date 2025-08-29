<?php
/**
 * DokuWiki Plugin Kanban (Syntax Component)
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
            'columns' => 'À faire,En cours,Terminé',
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
    private function parseKanbanContent($content)
    {
        $content = trim($content);
        
        // If content is empty, return default structure
        if (empty($content)) {
            return array(
                array(
                    'id' => uniqid('col_'),
                    'title' => 'À faire',
                    'cards' => array()
                ),
                array(
                    'id' => uniqid('col_'),
                    'title' => 'En cours',
                    'cards' => array()
                ),
                array(
                    'id' => uniqid('col_'),
                    'title' => 'Terminé',
                    'cards' => array()
                )
            );
        }
        
        // Try to parse as JSON
        $data = json_decode($content, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            // Invalid JSON, return default structure
            return array(
                array(
                    'id' => uniqid('col_'),
                    'title' => 'À faire',
                    'cards' => array()
                ),
                array(
                    'id' => uniqid('col_'),
                    'title' => 'En cours',
                    'cards' => array()
                ),
                array(
                    'id' => uniqid('col_'),
                    'title' => 'Terminé',
                    'cards' => array()
                )
            );
        }
        
        // Validate and ensure required fields
        if (!is_array($data)) {
            $data = array();
        }
        
        foreach ($data as $index => $column) {
            // Ensure column has required fields
            if (!isset($column['id'])) {
                $data[$index]['id'] = uniqid('col_');
            }
            if (!isset($column['title'])) {
                $data[$index]['title'] = 'Colonne ' . ($index + 1);
            }
            if (!isset($column['cards']) || !is_array($column['cards'])) {
                $data[$index]['cards'] = array();
            }
            
            // Validate cards
            foreach ($data[$index]['cards'] as $cardIndex => $card) {
                if (!isset($card['id'])) {
                    $data[$index]['cards'][$cardIndex]['id'] = uniqid('card_');
                }
                if (!isset($card['title'])) {
                    $data[$index]['cards'][$cardIndex]['title'] = 'Carte sans titre';
                }
                
                // Set default values for optional fields
                $defaultCard = array(
                    'description' => '',
                    'priority' => 'normal',
                    'assignee' => '',
                    'tags' => array(),
                    'creator' => '',
                    'created' => date('Y-m-d H:i:s')
                );
                
                $data[$index]['cards'][$cardIndex] = array_merge($defaultCard, $card);
            }
        }
        
        return $data;
    }

    /**
     * Render kanban board start
     */
    private function renderKanbanStart($renderer, $attributes)
    {
        $id = $attributes['id'];
        $title = htmlspecialchars($attributes['title']);
        $editable = $attributes['editable'] === 'true' ? 'true' : 'false';
        $sortable = $attributes['sortable'] === 'true' ? 'true' : 'false';
        
        $renderer->doc .= '<div class="kanban-board" id="' . $id . '" data-editable="' . $editable . '" data-sortable="' . $sortable . '">';
        $renderer->doc .= '<div class="kanban-header">';
        $renderer->doc .= '<h2 class="kanban-title">' . $title . '</h2>';
        
        if ($editable === 'true') {
            $renderer->doc .= '<div class="kanban-actions">';
            $renderer->doc .= '<button class="kanban-btn kanban-btn-primary" onclick="KanbanPlugin.addColumn(\'' . $id . '\')">Ajouter Colonne</button>';
            $renderer->doc .= '</div>';
        }
        
        $renderer->doc .= '</div>';
        $renderer->doc .= '<div class="kanban-columns" id="' . $id . '_columns">';
    }

    /**
     * Render kanban content (columns and cards)
     */
    private function renderKanbanContent($renderer, $columns)
    {
        foreach ($columns as $columnIndex => $column) {
            $columnId = $column['id'];
            
            $renderer->doc .= '<div class="kanban-column" id="' . $columnId . '" data-column-index="' . $columnIndex . '">';
            $renderer->doc .= '<div class="kanban-column-header">';
            $renderer->doc .= '<h3 class="kanban-column-title" contenteditable="true">' . htmlspecialchars($column['title']) . '</h3>';
            $renderer->doc .= '<div class="kanban-column-actions">';
            $renderer->doc .= '<button class="kanban-btn-icon" onclick="KanbanPlugin.addCard(\'' . $columnId . '\')" title="Ajouter carte">+</button>';
            $renderer->doc .= '<button class="kanban-btn-icon" onclick="KanbanPlugin.deleteColumn(\'' . $columnId . '\')" title="Supprimer colonne">×</button>';
            $renderer->doc .= '</div>';
            $renderer->doc .= '</div>';
            
            $renderer->doc .= '<div class="kanban-cards" data-column="' . $columnId . '">';
            
            foreach ($column['cards'] as $card) {
                $this->renderCard($renderer, $card);
            }
            
            $renderer->doc .= '</div>';
            $renderer->doc .= '</div>';
        }
    }

    /**
     * Render individual card
     */
    private function renderCard($renderer, $card)
    {
        $cardId = $card['id'];
        $priorityClass = 'priority-' . $card['priority'];
        
        // Get current user info
        global $INFO;
        $currentUser = $INFO['userinfo']['name'] ?? $INFO['client'] ?? 'Anonyme';
        
        // Set default values for new fields
        $card['description'] = $card['description'] ?? '';
        $card['creator'] = $card['creator'] ?? $currentUser;
        $card['created'] = $card['created'] ?? date('Y-m-d H:i:s');
        $card['assignee'] = $card['assignee'] ?? '';
        $card['tags'] = $card['tags'] ?? [];
        
        $renderer->doc .= '<div class="kanban-card ' . $priorityClass . '" id="' . $cardId . '" draggable="true">';
        
        // Card actions (edit/delete)
        $renderer->doc .= '<div class="kanban-card-actions">';
        $renderer->doc .= '<button onclick="KanbanPlugin.editCard(\'' . $cardId . '\')" title="Éditer">✏️</button>';
        $renderer->doc .= '<button onclick="KanbanPlugin.deleteCard(\'' . $cardId . '\')" title="Supprimer">×</button>';
        $renderer->doc .= '</div>';
        
        // Card content
        $renderer->doc .= '<div class="kanban-card-header">';
        $renderer->doc .= '<h4 class="kanban-card-title" contenteditable="true">' . htmlspecialchars($card['title']) . '</h4>';
        $renderer->doc .= '</div>';
        
        // Description
        if (!empty($card['description'])) {
            $renderer->doc .= '<div class="kanban-card-description">' . htmlspecialchars($card['description']) . '</div>';
        }
        
        $renderer->doc .= '<div class="kanban-card-footer">';
        
        // Priority indicator
        if ($card['priority'] !== 'normal') {
            $renderer->doc .= '<span class="kanban-priority">' . htmlspecialchars($card['priority']) . '</span>';
        }
        
        // Assignee
        if (!empty($card['assignee'])) {
            $renderer->doc .= '<span class="kanban-assignee">' . htmlspecialchars($card['assignee']) . '</span>';
        }
        
        // Tags
        if (!empty($card['tags'])) {
            foreach ($card['tags'] as $tag) {
                $renderer->doc .= '<span class="kanban-tag">' . htmlspecialchars($tag) . '</span>';
            }
        }
        
        $renderer->doc .= '</div>'; // Close kanban-card-footer
        
        // Card metadata
        $renderer->doc .= '<div class="kanban-card-meta">';
        
        // Creator with avatar
        $renderer->doc .= '<div class="kanban-card-creator">';
        $creatorInitial = strtoupper(substr($card['creator'], 0, 1));
        $renderer->doc .= '<div class="kanban-card-avatar">' . $creatorInitial . '</div>';
        $renderer->doc .= '<span>' . htmlspecialchars($card['creator']) . '</span>';
        $renderer->doc .= '</div>';
        
        // Created date
        $createdDate = date('d/m/Y', strtotime($card['created']));
        $renderer->doc .= '<div class="kanban-card-date">' . $createdDate . '</div>';
        
        $renderer->doc .= '</div>'; // Close kanban-card-meta
        
        $renderer->doc .= '</div>'; // Close kanban-card
    }

    /**
     * Render kanban board end
     */
    private function renderKanbanEnd($renderer)
    {
        $renderer->doc .= '</div>'; // Close kanban-columns
        $renderer->doc .= '</div>'; // Close kanban-board
    }
}
