<?php
/**
 * Kanban Export Manager - Version simplifiée
 * Gère uniquement l'export CSV des tableaux kanban
 */

class KanbanExportManager {
    
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
}
