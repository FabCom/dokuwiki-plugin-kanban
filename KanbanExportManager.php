<?php
/**
 * Kanban Export Manager
 * Gère l'export CSV et JSON des tableaux kanban
 */

class KanbanExportManager {
    
    /**
     * Génère un export JSON du kanban
     */
    public static function exportToJSON($kanbanId, $data, $pageId = '') {
        // Nettoyer la sortie avant d'envoyer les headers
        if (ob_get_level()) {
            ob_clean();
        }
        
        $filename = "kanban_{$kanbanId}_" . date('Y-m-d') . ".json";
        
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: no-cache, must-revalidate');
        header('Expires: Sat, 26 Jul 1997 05:00:00 GMT');
        
        // Créer une structure JSON propre avec métadonnées
        $exportData = [
            'metadata' => [
                'kanban_id' => $kanbanId,
                'page_id' => $pageId ?? '',
                'export_date' => date('Y-m-d H:i:s'),
                'export_format_version' => '1.0',
                'total_columns' => count($data['columns'] ?? []),
                'total_cards' => self::countTotalCards($data)
            ],
            'board' => [
                'title' => $data['title'] ?? 'Kanban Board',
                'columns' => self::enrichColumnsWithDiscussions($data['columns'] ?? [], $pageId)
            ]
        ];
        
        echo json_encode($exportData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        return true;
    }
    
    /**
     * Compte le nombre total de cartes
     */
    private static function countTotalCards($data) {
        $count = 0;
        if (isset($data['columns']) && is_array($data['columns'])) {
            foreach ($data['columns'] as $column) {
                if (isset($column['cards']) && is_array($column['cards'])) {
                    $count += count($column['cards']);
                }
            }
        }
        return $count;
    }
    
    /**
     * Génère un export CSV du kanban
     */
    public static function exportToCSV($kanbanId, $data) {
        // Nettoyer la sortie avant d'envoyer les headers
        if (ob_get_level()) {
            ob_clean();
        }
        
        $filename = "kanban_{$kanbanId}_" . date('Y-m-d') . ".csv";
        
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: no-cache, must-revalidate');
        header('Expires: Sat, 26 Jul 1997 05:00:00 GMT');
        
        return self::generateCSV($data);
    }
    
    /**
     * Génère le contenu CSV
     */
    private static function generateCSV($data) {
        $output = fopen('php://output', 'w');
        
        // Headers CSV avec toutes les propriétés
        fputcsv($output, [
            'ID',
            'Titre',
            'Description', 
            'Colonne',
            'Priorité',
            'Assigné',
            'Échéance',
            'Tags',
            'Date création',
            'Créateur',
            'Dernière modification',
            'Modifié par',
            'Liens internes',
            'Liens externes',
            'Médias'
        ], ';');
        
                // Données
        if (isset($data['columns']) && is_array($data['columns'])) {
            foreach ($data['columns'] as $column) {
                if (isset($column['cards']) && is_array($column['cards'])) {
                    foreach ($column['cards'] as $card) {
                        // Skip empty cards
                        if (empty($card) || !is_array($card)) {
                            continue;
                        }
                        
                        fputcsv($output, [
                            $card['id'] ?? '',
                            $card['title'] ?? '',
                            $card['description'] ?? $card['content'] ?? '',
                            $column['title'] ?? '',
                            $card['priority'] ?? '',
                            $card['assignee'] ?? '',
                            $card['dueDate'] ?? $card['due_date'] ?? '',
                            implode(', ', $card['tags'] ?? []),
                            $card['created'] ?? $card['created_date'] ?? '',
                            $card['creator'] ?? $card['created_by'] ?? '',
                            $card['lastModified'] ?? $card['modified_date'] ?? '',
                            $card['lastModifiedBy'] ?? $card['last_modified_by'] ?? '',
                            self::formatInternalLinks($card['internalLinks'] ?? []),
                            self::formatExternalLinks($card['externalLinks'] ?? []),
                            count($card['media'] ?? []) > 0 ? implode(', ', array_map(function($m) { 
                                return $m['id'] ?? ''; 
                            }, $card['media'])) : ''
                        ], ';');
                    }
                }
            }
        }
        
        fclose($output);
    }
    
    /**
     * Formate les liens internes pour l'export CSV
     */
    private static function formatInternalLinks($links) {
        if (empty($links) || !is_array($links)) {
            return '';
        }
        
        $formatted = [];
        foreach ($links as $link) {
            if (is_array($link)) {
                $formatted[] = $link['target'] ?? '';
            } else {
                $formatted[] = (string)$link;
            }
        }
        
        return implode(', ', array_filter($formatted));
    }
    
    /**
     * Formate les liens externes pour l'export CSV
     */
    private static function formatExternalLinks($links) {
        if (empty($links) || !is_array($links)) {
            return '';
        }
        
        $formatted = [];
        foreach ($links as $link) {
            if (is_array($link)) {
                $formatted[] = $link['url'] ?? $link['text'] ?? '';
            } else {
                $formatted[] = (string)$link;
            }
        }
        
        return implode(', ', array_filter($formatted));
    }
    
    /**
     * Récupère les discussions d'une carte
     */
    public static function getCardDiscussions($pageId, $cardId) {
        // Générer l'ID de la page de discussion pour cette carte
        $discussionPageId = 'discussion:' . $pageId . ':card_' . $cardId;
        
        // Vérifier si la page de discussion existe
        if (!page_exists($discussionPageId)) {
            return [];
        }
        
        // Récupérer le contenu de la page
        $pageContent = rawWiki($discussionPageId);
        
        if (empty($pageContent)) {
            return [];
        }
        
        try {
            // Parser le JSON
            $decoded = json_decode($pageContent, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                // Le format stocké contient {messages: [...]} - extraire les messages
                if (isset($decoded['messages']) && is_array($decoded['messages'])) {
                    return $decoded['messages'];
                } else if (is_array($decoded)) {
                    // Ancien format : tableau direct
                    return $decoded;
                }
            }
        } catch (Exception $e) {
            error_log("Kanban Export: Error loading discussions for card {$cardId}: " . $e->getMessage());
        }
        
        return [];
    }
    
    /**
     * Enrichit les colonnes avec les discussions des cartes
     */
    private static function enrichColumnsWithDiscussions($columns, $pageId) {
        if (empty($columns) || !is_array($columns)) {
            return [];
        }
        
        $enrichedColumns = [];
        
        foreach ($columns as $column) {
            $enrichedColumn = $column;
            
            if (isset($column['cards']) && is_array($column['cards'])) {
                $enrichedCards = [];
                
                foreach ($column['cards'] as $card) {
                    $enrichedCard = $card;
                    
                    // Ajouter les discussions à chaque carte
                    if (isset($card['id']) && !empty($pageId)) {
                        $discussions = self::getCardDiscussions($pageId, $card['id']);
                        $enrichedCard['discussions'] = $discussions;
                        $enrichedCard['discussion_count'] = count($discussions);
                    } else {
                        $enrichedCard['discussions'] = [];
                        $enrichedCard['discussion_count'] = 0;
                    }
                    
                    $enrichedCards[] = $enrichedCard;
                }
                
                $enrichedColumn['cards'] = $enrichedCards;
            }
            
            $enrichedColumns[] = $enrichedColumn;
        }
        
        return $enrichedColumns;
    }
}
