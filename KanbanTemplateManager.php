<?php
/**
 * Kanban Template Manager
 * Gestion des templates de tableaux Kanban prédéfinis
 * 
 * @author Development Team
 * @version 1.0.0
 */

class KanbanTemplateManager 
{
    /**
     * Templates de tableaux prédéfinis
     */
    private static function getDefaultTemplates() {
        return [
            'project-standard' => [
                'name' => 'Gestion de projet classique',
                'description' => 'Workflow de gestion de projet traditionnel',
                'icon' => '📊',
                'category' => 'projet',
                'columns' => [
                    ['title' => '💡 Idées', 'color' => '#fff3cd', 'wip_limit' => null],
                    ['title' => '📋 Planifié', 'color' => '#e9ecef', 'wip_limit' => null],
                    ['title' => '🏃 En cours', 'color' => '#d1ecf1', 'wip_limit' => 5],
                    ['title' => '⏸️ En attente', 'color' => '#f8d7da', 'wip_limit' => null],
                    ['title' => '✅ Terminé', 'color' => '#d4edda', 'wip_limit' => null]
                ]
            ],
            
            'content-editorial' => [
                'name' => 'Processus éditorial/Content',
                'description' => 'Workflow de création et publication de contenu',
                'icon' => '📝',
                'category' => 'editorial',
                'columns' => [
                    ['title' => '💭 Idées d\'articles', 'color' => '#fff3cd', 'wip_limit' => null],
                    ['title' => '✍️ Rédaction', 'color' => '#d1ecf1', 'wip_limit' => 3],
                    ['title' => '📖 Relecture', 'color' => '#cce5ff', 'wip_limit' => 2],
                    ['title' => '🎨 Mise en forme', 'color' => '#e2e3e5', 'wip_limit' => 2],
                    ['title' => '✅ Prêt à publier', 'color' => '#d4edda', 'wip_limit' => null],
                    ['title' => '🌐 Publié', 'color' => '#c3e6cb', 'wip_limit' => null]
                ]
            ],
            
            'quality-audit' => [
                'name' => 'Processus qualité/Audit',
                'description' => 'Audit et amélioration continue',
                'icon' => '🏥',
                'category' => 'quality',
                'columns' => [
                    ['title' => '🔍 À auditer', 'color' => '#fff3cd', 'wip_limit' => null],
                    ['title' => '📊 En audit', 'color' => '#d1ecf1', 'wip_limit' => 2],
                    ['title' => '⚠️ Non-conformités', 'color' => '#f8d7da', 'wip_limit' => null],
                    ['title' => '🔧 Actions correctives', 'color' => '#cce5ff', 'wip_limit' => 5],
                    ['title' => '✅ Conforme', 'color' => '#d4edda', 'wip_limit' => null]
                ]
            ],
            
            'dev-agile' => [
                'name' => 'Développement logiciel (Scrum/Agile)',
                'description' => 'Workflow de développement avec intégration continue',
                'icon' => '🔧',
                'category' => 'development',
                'columns' => [
                    ['title' => '📋 Backlog', 'color' => '#e9ecef', 'wip_limit' => null],
                    ['title' => '📝 À faire', 'color' => '#fff3cd', 'wip_limit' => 5],
                    ['title' => '🔄 En cours', 'color' => '#d1ecf1', 'wip_limit' => 3],
                    ['title' => '🧪 En test', 'color' => '#f8d7da', 'wip_limit' => 2],
                    ['title' => '👀 Code Review', 'color' => '#d4edda', 'wip_limit' => 3],
                    ['title' => '🚀 Prêt à déployer', 'color' => '#cce5ff', 'wip_limit' => null],
                    ['title' => '✅ Terminé', 'color' => '#d4edda', 'wip_limit' => null]
                ]
            ],
            
            'policy-monitoring' => [
                'name' => 'Veille thématique',
                'description' => 'Suivi et analyse d\'une thématique spécifique',
                'icon' => '🏛️',
                'category' => 'Veille',
                'columns' => [
                    ['title' => '👀 Politiques à surveiller', 'color' => '#fff3cd', 'wip_limit' => null],
                    ['title' => '📚 Sources d\'information', 'color' => '#e9ecef', 'wip_limit' => null],
                    ['title' => '📊 Informations recueillies', 'color' => '#d1ecf1', 'wip_limit' => null],
                    ['title' => '🔍 Analyse des impacts', 'color' => '#cce5ff', 'wip_limit' => 3],
                    ['title' => '⚡ Actions à entreprendre', 'color' => '#f8d7da', 'wip_limit' => 5],
                    ['title' => '✅ Suivi terminé', 'color' => '#d4edda', 'wip_limit' => null]
                ]
            ]
        ];
    }
    
    /**
     * Récupérer tous les templates disponibles
     */
    public static function getAvailableTemplates() {
        return self::getDefaultTemplates();
    }
    
    /**
     * Récupérer un template spécifique
     */
    public static function getTemplate($templateId) {
        $templates = self::getDefaultTemplates();
        return isset($templates[$templateId]) ? $templates[$templateId] : null;
    }
    
    /**
     * Créer un tableau à partir d'un template
     */
    public static function createBoardFromTemplate($templateId, $pageId) {
        $template = self::getTemplate($templateId);
        
        if (!$template) {
            return false;
        }
        
        $boardData = [
            'board_id' => 'board_' . time() . '_' . uniqid(),
            'title' => $template['name'],
            'description' => $template['description'],
            'created_at' => date('c'),
            'created_from_template' => $templateId,
            'columns' => []
        ];
        
        // Créer les colonnes à partir du template
        foreach ($template['columns'] as $index => $columnTemplate) {
            $boardData['columns'][] = [
                'id' => 'col_' . $index . '_' . time(),
                'title' => $columnTemplate['title'],
                'color' => $columnTemplate['color'],
                'wip_limit' => $columnTemplate['wip_limit'],
                'cards' => []
            ];
        }
        
        return $boardData;
    }
    
    /**
     * Récupérer les catégories de templates
     */
    public static function getTemplateCategories() {
        return [
            'all' => 'Tous',
            'projet' => 'Projets',
            'editorial' => 'Éditorial',
            'quality' => 'Qualité',
            'development' => 'Développement',
            'veille' => 'Veille'
        ];
    }
}
