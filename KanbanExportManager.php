<?php
/**
 * Kanban Data Exchange Manager
 * Gère l'export CSV/JSON et l'import JSON des tableaux kanban
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
    
    /**
     * ===== IMPORT FUNCTIONS =====
     */
    
    /**
     * Importe des données JSON dans un kanban existant
     */
    public static function importFromJSON($jsonData, $pageId, $importMode = 'merge', $importOptions = []) {
        // Valider le JSON
        $validation = self::validateImportJSON($jsonData);
        if (!$validation['valid']) {
            return [
                'success' => false,
                'error' => $validation['error'],
                'details' => $validation['details'] ?? []
            ];
        }
        
        // Utiliser les données décodées de la validation
        $decodedData = $validation['data'];
        $importType = $validation['type'];
        
        // Charger les données actuelles du board
        require_once(dirname(__FILE__) . '/KanbanDataManager.php');
        $dataManager = new KanbanDataManager();
        $currentData = $dataManager->loadBoardData($pageId);
        
        // Gestion spéciale pour l'import de carte seule
        if ($importType === 'single_card') {
            $targetColumn = $validation['target_column'] ?? $importOptions['target_column'] ?? null;
            return self::importSingleCard($decodedData, $pageId, $dataManager, $currentData, $importMode, $targetColumn);
        }
        
        // Effectuer l'import selon le mode pour les boards complets
        switch ($importMode) {
            case 'replace':
                return self::replaceBoard($decodedData, $pageId, $dataManager);
            case 'merge':
                return self::mergeBoard($decodedData, $currentData, $pageId, $dataManager);
            case 'append':
                return self::appendToBoard($decodedData, $currentData, $pageId, $dataManager);
            default:
                return [
                    'success' => false,
                    'error' => 'Mode d\'import non supporté: ' . $importMode
                ];
        }
    }
    
    /**
     * Valide la structure du JSON d'import
     */
    private static function validateImportJSON($jsonData) {
        if (empty($jsonData)) {
            return [
                'valid' => false,
                'error' => 'Données JSON vides'
            ];
        }
        
        // Décoder si c'est une chaîne
        if (is_string($jsonData)) {
            $data = json_decode($jsonData, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return [
                    'valid' => false,
                    'error' => 'JSON invalide: ' . json_last_error_msg()
                ];
            }
        } else {
            $data = $jsonData;
        }
        
        // Vérifier la structure de base
        if (!is_array($data)) {
            return [
                'valid' => false,
                'error' => 'Le JSON doit être un objet'
            ];
        }
        
        // Détecter le type d'import (board complet ou carte unique)
        if (isset($data['metadata']) && isset($data['board'])) {
            // Import de board complet
            return self::validateBoardImport($data);
        } elseif (isset($data['metadata']) && isset($data['card'])) {
            // Import de carte unique
            return self::validateCardImport($data);
        } elseif (isset($data['columns'])) {
            // Format simple (colonnes directement)
            return [
                'valid' => true,
                'type' => 'simple_board',
                'data' => $data
            ];
        } else {
            return [
                'valid' => false,
                'error' => 'Structure JSON non reconnue. Attendu: board avec métadonnées, carte unique ou format simple.'
            ];
        }
    }
    
    /**
     * Valide un import de board complet
     */
    private static function validateBoardImport($data) {
        $errors = [];
        
        // Vérifier les métadonnées
        if (!isset($data['metadata']['export_format_version'])) {
            $errors[] = 'Version de format manquante';
        }
        
        // Vérifier la structure du board
        if (!isset($data['board']['columns']) || !is_array($data['board']['columns'])) {
            $errors[] = 'Colonnes du board manquantes ou invalides';
        }
        
        // Valider chaque colonne
        foreach ($data['board']['columns'] as $colIndex => $column) {
            if (!isset($column['id']) || !isset($column['title'])) {
                $errors[] = "Colonne {$colIndex}: ID ou titre manquant";
            }
            
            if (isset($column['cards']) && is_array($column['cards'])) {
                foreach ($column['cards'] as $cardIndex => $card) {
                    if (!isset($card['id']) || !isset($card['title'])) {
                        $errors[] = "Colonne {$colIndex}, carte {$cardIndex}: ID ou titre manquant";
                    }
                }
            }
        }
        
        if (!empty($errors)) {
            return [
                'valid' => false,
                'error' => 'Erreurs de validation du board',
                'details' => $errors
            ];
        }
        
        return [
            'valid' => true,
            'type' => 'full_board',
            'data' => $data['board']
        ];
    }
    
    /**
     * Valide un import de carte unique
     */
    private static function validateCardImport($data) {
        $errors = [];
        
        if (!isset($data['card']['id']) || !isset($data['card']['title'])) {
            $errors[] = 'Carte: ID ou titre manquant';
        }
        
        if (!empty($errors)) {
            return [
                'valid' => false,
                'error' => 'Erreurs de validation de la carte',
                'details' => $errors
            ];
        }
        
        return [
            'valid' => true,
            'type' => 'single_card',
            'data' => $data['card'],
            'target_column' => $data['target_column'] ?? null
        ];
    }
    
    /**
     * Remplace complètement le board
     */
    private static function replaceBoard($jsonData, $pageId, $dataManager) {
        try {
            // DEBUG: Log l'entrée de replaceBoard
            error_log("KANBAN DEBUG: replaceBoard called");
            error_log("KANBAN DEBUG: jsonData is array: " . (is_array($jsonData) ? 'yes' : 'no'));
            
            // Extraire les colonnes selon la structure JSON
            $columns = [];
            if (isset($jsonData['board']['columns'])) {
                $columns = $jsonData['board']['columns'];
                error_log("KANBAN DEBUG: replaceBoard - found board.columns with " . count($columns) . " columns");
            } elseif (isset($jsonData['columns'])) {
                $columns = $jsonData['columns'];
                error_log("KANBAN DEBUG: replaceBoard - found direct columns with " . count($columns) . " columns");
            } else {
                error_log("KANBAN DEBUG: replaceBoard - NO COLUMNS FOUND!");
                error_log("KANBAN DEBUG: jsonData has board key: " . (isset($jsonData['board']) ? 'yes' : 'no'));
                error_log("KANBAN DEBUG: jsonData has columns key: " . (isset($jsonData['columns']) ? 'yes' : 'no'));
            }
            
            error_log("KANBAN DEBUG: replaceBoard - extracted " . count($columns) . " columns");
            
            // Sauvegarder les discussions séparément
            $discussionStats = self::saveImportedDiscussions($pageId, $columns);
            
            // Nettoyer les discussions des données de board
            $cleanedColumns = self::cleanDiscussionsFromBoardData($columns);
            
            error_log("KANBAN DEBUG: replaceBoard - cleanedColumns count: " . count($cleanedColumns));
            error_log("KANBAN DEBUG: replaceBoard - about to call saveBoardData");
            
            $result = $dataManager->saveBoardData($pageId, 'main', $cleanedColumns, 'import_replace');
            
            if ($result) {
                return [
                    'success' => true,
                    'message' => 'Board remplacé avec succès',
                    'stats' => [
                        'columns_imported' => count($cleanedColumns),
                        'cards_imported' => self::countTotalCards(['columns' => $cleanedColumns]),
                        'discussions_saved' => $discussionStats['discussions_saved'],
                        'discussion_errors' => $discussionStats['discussion_errors']
                    ]
                ];
            } else {
                return [
                    'success' => false,
                    'error' => 'Erreur lors de la sauvegarde du board'
                ];
            }
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => 'Erreur lors du remplacement: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Fusionne avec le board existant
     */
    private static function mergeBoard($jsonData, $currentData, $pageId, $dataManager) {
        try {
            // DEBUG: Log les données avant fusion
            KanbanErrorManager::logInfo('mergeBoard - début', [
                'page_id' => $pageId,
                'current_data_type' => gettype($currentData),
                'current_data_structure' => is_array($currentData) ? array_keys($currentData) : 'not_array',
                'import_data_structure' => is_array($jsonData) ? array_keys($jsonData) : 'not_array'
            ]);
            
            // DEBUG: Plus de détails sur les données d'import
            error_log("KANBAN DEBUG: mergeBoard - jsonData is array: " . (is_array($jsonData) ? 'yes' : 'no'));
            if (isset($jsonData['board'])) {
                error_log("KANBAN DEBUG: mergeBoard - jsonData has board key");
                if (isset($jsonData['board']['columns'])) {
                    error_log("KANBAN DEBUG: mergeBoard - jsonData[board][columns] count: " . count($jsonData['board']['columns']));
                }
            }
            
            // Logique de fusion
            $mergedData = self::mergeBoardData($currentData, $jsonData);
            
            // DEBUG: Log le résultat de la fusion
            KanbanErrorManager::logInfo('mergeBoard - après fusion', [
                'merged_columns_count' => count($mergedData['columns'] ?? []),
                'stats' => $mergedData['stats'] ?? []
            ]);
            
            error_log("KANBAN DEBUG: mergeBoard - mergedData columns count: " . count($mergedData['columns'] ?? []));
            
            // Sauvegarder les discussions séparément AVANT de nettoyer les données
            $discussionStats = self::saveImportedDiscussions($pageId, $mergedData['columns']);
            
            // Nettoyer les discussions des données de board
            $cleanedColumns = self::cleanDiscussionsFromBoardData($mergedData['columns']);
            
            // Sauvegarder le board sans les discussions
            $result = $dataManager->saveBoardData($pageId, 'main', $cleanedColumns, 'import_merge');
            
            if ($result) {
                $stats = $mergedData['stats'];
                $stats['discussions_saved'] = $discussionStats['discussions_saved'];
                $stats['discussion_errors'] = $discussionStats['discussion_errors'];
                
                return [
                    'success' => true,
                    'message' => 'Données fusionnées avec succès',
                    'stats' => $stats
                ];
            } else {
                return [
                    'success' => false,
                    'error' => 'Erreur lors de la sauvegarde des données fusionnées'
                ];
            }
        } catch (Exception $e) {
            KanbanErrorManager::logError('mergeBoard - exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return [
                'success' => false,
                'error' => 'Erreur lors de la fusion: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Ajoute à la fin du board existant
     */
    private static function appendToBoard($jsonData, $currentData, $pageId, $dataManager) {
        try {
            $appendedData = self::appendBoardData($currentData, $jsonData);
            
            // Sauvegarder les discussions séparément
            $discussionStats = self::saveImportedDiscussions($pageId, $appendedData['columns']);
            
            // Nettoyer les discussions des données de board
            $cleanedColumns = self::cleanDiscussionsFromBoardData($appendedData['columns']);
            
            $result = $dataManager->saveBoardData($pageId, 'main', $cleanedColumns, 'import_append');
            
            if ($result) {
                $stats = $appendedData['stats'];
                $stats['discussions_saved'] = $discussionStats['discussions_saved'];
                $stats['discussion_errors'] = $discussionStats['discussion_errors'];
                
                return [
                    'success' => true,
                    'message' => 'Données ajoutées avec succès',
                    'stats' => $stats
                ];
            } else {
                return [
                    'success' => false,
                    'error' => 'Erreur lors de la sauvegarde des données ajoutées'
                ];
            }
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => 'Erreur lors de l\'ajout: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Importe une carte seule
     */
    private static function importSingleCard($cardData, $pageId, $dataManager, $currentData, $importMode, $targetColumn = null) {
        try {
            // Extraire les colonnes actuelles
            $columns = [];
            if (is_array($currentData)) {
                if (isset($currentData['columns'])) {
                    $columns = $currentData['columns'];
                } elseif (isset($currentData[0]['id'])) {
                    $columns = $currentData;
                }
            }
            
            if (empty($columns)) {
                return [
                    'success' => false,
                    'error' => 'Aucune colonne trouvée dans le board pour y placer la carte'
                ];
            }
            
            // Chercher si la carte existe déjà dans une colonne
            $foundInColumn = null;
            $foundCardIndex = null;
            
            foreach ($columns as $columnIndex => $column) {
                if (!isset($column['cards'])) continue;
                
                foreach ($column['cards'] as $cardIndex => $existingCard) {
                    if (isset($existingCard['id']) && $existingCard['id'] === $cardData['id']) {
                        $foundInColumn = $columnIndex;
                        $foundCardIndex = $cardIndex;
                        break 2;
                    }
                }
            }
            
            $stats = ['cards_added' => 0, 'cards_updated' => 0];
            
            if ($foundInColumn !== null) {
                // Carte existe - mettre à jour
                if ($importMode === 'replace') {
                    $columns[$foundInColumn]['cards'][$foundCardIndex] = $cardData;
                } else { // merge
                    $columns[$foundInColumn]['cards'][$foundCardIndex] = self::mergeCard(
                        $columns[$foundInColumn]['cards'][$foundCardIndex], 
                        $cardData
                    );
                }
                $stats['cards_updated'] = 1;
                $message = 'Carte mise à jour avec succès';
            } else {
                // Nouvelle carte - utiliser la colonne cible ou la première colonne
                $targetColumnIndex = 0; // par défaut
                
                if ($targetColumn !== null) {
                    // Chercher la colonne par ID ou index
                    if (is_numeric($targetColumn)) {
                        // Index de colonne
                        if (isset($columns[$targetColumn])) {
                            $targetColumnIndex = $targetColumn;
                        }
                    } else {
                        // ID de colonne
                        foreach ($columns as $index => $column) {
                            if (isset($column['id']) && $column['id'] === $targetColumn) {
                                $targetColumnIndex = $index;
                                break;
                            }
                        }
                    }
                }
                
                if (!isset($columns[$targetColumnIndex]['cards'])) {
                    $columns[$targetColumnIndex]['cards'] = [];
                }
                $columns[$targetColumnIndex]['cards'][] = $cardData;
                $stats['cards_added'] = 1;
                $message = $targetColumn ? 
                    "Carte ajoutée dans la colonne spécifiée" : 
                    "Carte ajoutée dans la première colonne";
            }
            
            // Sauvegarder les discussions si présentes
            $discussionStats = ['discussions_saved' => 0, 'discussion_errors' => 0];
            if (isset($cardData['discussions']) && !empty($cardData['discussions'])) {
                $discussionStats = self::saveImportedDiscussions($pageId, [$columns[$foundInColumn ?? 0]]);
            }
            
            // Nettoyer les discussions des données de board
            $cleanedColumns = self::cleanDiscussionsFromBoardData($columns);
            
            // Sauvegarder
            $result = $dataManager->saveBoardData($pageId, 'main', $cleanedColumns, 'import_single_card');
            
            if ($result) {
                $stats['discussions_saved'] = $discussionStats['discussions_saved'];
                $stats['discussion_errors'] = $discussionStats['discussion_errors'];
                
                return [
                    'success' => true,
                    'message' => $message,
                    'stats' => $stats,
                    'target_column' => $foundInColumn !== null ? $foundInColumn : 0
                ];
            } else {
                return [
                    'success' => false,
                    'error' => 'Erreur lors de la sauvegarde de la carte'
                ];
            }
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => 'Erreur lors de l\'import de la carte: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Logique de fusion des données de board
     */
    private static function mergeBoardData($currentData, $importData) {
        // DEBUG: Log les structures de données
        KanbanErrorManager::logInfo('mergeBoardData - début', [
            'current_data_keys' => is_array($currentData) ? array_keys($currentData) : 'not_array',
            'import_data_keys' => is_array($importData) ? array_keys($importData) : 'not_array'
        ]);
        
        // Extraire les colonnes selon la structure
        $mergedColumns = [];
        if (is_array($currentData)) {
            if (isset($currentData['columns'])) {
                // Structure complète du board
                $mergedColumns = $currentData['columns'];
            } elseif (isset($currentData[0]['id'])) {
                // Tableau direct de colonnes
                $mergedColumns = $currentData;
            }
        }
        
        // Extraire les colonnes d'import
        $importColumns = [];
        if (is_array($importData)) {
            if (isset($importData['board']['columns'])) {
                // Format JSON export complet
                $importColumns = $importData['board']['columns'];
            } elseif (isset($importData['columns'])) {
                // Structure board simple
                $importColumns = $importData['columns'];
            } elseif (isset($importData[0]['id'])) {
                // Tableau direct de colonnes
                $importColumns = $importData;
            }
        }
        
        KanbanErrorManager::logInfo('mergeBoardData - colonnes extraites', [
            'merged_columns_count' => count($mergedColumns),
            'import_columns_count' => count($importColumns)
        ]);
        
        $stats = [
            'columns_added' => 0,
            'columns_updated' => 0,
            'cards_added' => 0,
            'cards_updated' => 0
        ];
        
        // Index des colonnes existantes par ID
        $existingColumns = [];
        foreach ($mergedColumns as $index => $column) {
            if (isset($column['id'])) {
                $existingColumns[$column['id']] = $index;
            }
        }
        
        // Traiter chaque colonne d'import
        foreach ($importColumns as $importColumn) {
            if (!isset($importColumn['id'])) {
                continue; // Skip colonnes sans ID
            }
            
            $columnId = $importColumn['id'];
            
            if (isset($existingColumns[$columnId])) {
                // Colonne existe - fusionner les cartes
                $existingIndex = $existingColumns[$columnId];
                $mergeResult = self::mergeColumnCards(
                    $mergedColumns[$existingIndex], 
                    $importColumn
                );
                $mergedColumns[$existingIndex] = $mergeResult['column'];
                $stats['cards_added'] += $mergeResult['cards_added'];
                $stats['cards_updated'] += $mergeResult['cards_updated'];
                $stats['columns_updated']++;
            } else {
                // Nouvelle colonne - ajouter
                $mergedColumns[] = $importColumn;
                $stats['columns_added']++;
                $stats['cards_added'] += count($importColumn['cards'] ?? []);
            }
        }
        
        KanbanErrorManager::logInfo('mergeBoardData - résultat', [
            'final_columns_count' => count($mergedColumns),
            'stats' => $stats
        ]);
        
        return [
            'columns' => $mergedColumns,
            'stats' => $stats
        ];
    }
    
    /**
     * Fusionne les cartes de deux colonnes
     */
    private static function mergeColumnCards($existingColumn, $importColumn) {
        $existingCards = $existingColumn['cards'] ?? [];
        $importCards = $importColumn['cards'] ?? [];
        
        $stats = ['cards_added' => 0, 'cards_updated' => 0];
        
        // Index des cartes existantes par ID
        $existingCardIds = [];
        foreach ($existingCards as $index => $card) {
            $existingCardIds[$card['id']] = $index;
        }
        
        // Traiter chaque carte d'import
        foreach ($importCards as $importCard) {
            $cardId = $importCard['id'];
            
            if (isset($existingCardIds[$cardId])) {
                // Carte existe - mettre à jour (garder les données les plus récentes)
                $existingCard = $existingCards[$existingCardIds[$cardId]];
                $mergedCard = self::mergeCard($existingCard, $importCard);
                $existingCards[$existingCardIds[$cardId]] = $mergedCard;
                $stats['cards_updated']++;
            } else {
                // Nouvelle carte - ajouter
                $existingCards[] = $importCard;
                $stats['cards_added']++;
            }
        }
        
        $existingColumn['cards'] = $existingCards;
        
        return [
            'column' => $existingColumn,
            'cards_added' => $stats['cards_added'],
            'cards_updated' => $stats['cards_updated']
        ];
    }
    
    /**
     * Fusionne deux cartes (priorité aux données les plus récentes)
     */
    private static function mergeCard($existingCard, $importCard) {
        // Logique simple: utiliser les données d'import sauf si vides
        $merged = $existingCard;
        
        foreach ($importCard as $key => $value) {
            if ($key === 'discussions') {
                // Fusionner les discussions par ID
                $merged['discussions'] = self::mergeDiscussions(
                    $existingCard['discussions'] ?? [], 
                    $value ?? []
                );
            } elseif (!empty($value) || !isset($merged[$key])) {
                $merged[$key] = $value;
            }
        }
        
        return $merged;
    }
    
    /**
     * Fusionne les discussions de deux cartes
     */
    private static function mergeDiscussions($existing, $import) {
        $existingIds = [];
        foreach ($existing as $discussion) {
            $existingIds[$discussion['id']] = $discussion;
        }
        
        foreach ($import as $discussion) {
            if (!isset($existingIds[$discussion['id']])) {
                $existing[] = $discussion;
            }
        }
        
        // Trier par timestamp
        usort($existing, function($a, $b) {
            return strcmp($a['timestamp'] ?? '', $b['timestamp'] ?? '');
        });
        
        return $existing;
    }
    
    /**
     * Sauvegarde les discussions des cartes importées
     */
    private static function saveImportedDiscussions($pageId, $columns) {
        $discussionsSaved = 0;
        $discussionErrors = 0;
        
        foreach ($columns as $column) {
            if (!isset($column['cards'])) continue;
            
            foreach ($column['cards'] as $card) {
                if (!isset($card['discussions']) || empty($card['discussions']) || !isset($card['id'])) {
                    continue;
                }
                
                try {
                    // Format: discussion:pageId:card_cardId
                    $discussionPageId = 'discussion:' . $pageId . ':card_' . $card['id'];
                    
                    // Préparer les données de discussion selon le format attendu
                    $discussionData = [
                        'cardId' => $card['id'],
                        'pageId' => $pageId,
                        'lastUpdate' => date('c'),
                        'messages' => $card['discussions']
                    ];
                    
                    // Sauvegarder via l'action AJAX existante
                    // Utiliser KanbanDataManager pour la cohérence
                    $dataManager = new KanbanDataManager();
                    $content = json_encode($discussionData, JSON_PRETTY_PRINT);
                    
                    // Sauvegarder la page de discussion
                    if (function_exists('saveWikiText')) {
                        saveWikiText($discussionPageId, $content, 'Import discussions pour carte ' . $card['id']);
                        $discussionsSaved++;
                    } else {
                        KanbanErrorManager::logError('saveWikiText not available for discussion save', [
                            'discussion_page_id' => $discussionPageId
                        ]);
                        $discussionErrors++;
                    }
                    
                } catch (Exception $e) {
                    KanbanErrorManager::logError('Failed to save discussions for card', [
                        'card_id' => $card['id'],
                        'page_id' => $pageId,
                        'error' => $e->getMessage()
                    ]);
                    $discussionErrors++;
                }
            }
        }
        
        return [
            'discussions_saved' => $discussionsSaved,
            'discussion_errors' => $discussionErrors
        ];
    }
    
    /**
     * Nettoie les discussions des données de board avant sauvegarde
     */
    private static function cleanDiscussionsFromBoardData($columns) {
        $cleanedColumns = [];
        
        foreach ($columns as $column) {
            $cleanedColumn = $column;
            
            if (isset($cleanedColumn['cards'])) {
                $cleanedCards = [];
                foreach ($cleanedColumn['cards'] as $card) {
                    $cleanedCard = $card;
                    // Retirer les discussions du board - elles sont sauvées séparément
                    unset($cleanedCard['discussions']);
                    unset($cleanedCard['discussion_count']);
                    $cleanedCards[] = $cleanedCard;
                }
                $cleanedColumn['cards'] = $cleanedCards;
            }
            
            $cleanedColumns[] = $cleanedColumn;
        }
        
        return $cleanedColumns;
    }
    
    /**
     * Logique d'ajout des données à la fin
     */
    private static function appendBoardData($currentData, $importData) {
        $columns = $currentData['columns'] ?? [];
        $importColumns = $importData['columns'] ?? [];
        
        $stats = [
            'columns_added' => count($importColumns),
            'cards_added' => 0
        ];
        
        // Générer des IDs uniques pour éviter les conflits
        foreach ($importColumns as $column) {
            // Renommer la colonne si ID existe déjà
            $originalId = $column['id'];
            $counter = 1;
            while (self::columnIdExists($columns, $column['id'])) {
                $column['id'] = $originalId . '_imported_' . $counter;
                $counter++;
            }
            
            // Renommer les cartes si IDs existent déjà
            if (isset($column['cards'])) {
                foreach ($column['cards'] as &$card) {
                    $originalCardId = $card['id'];
                    $cardCounter = 1;
                    while (self::cardIdExists($columns, $card['id'])) {
                        $card['id'] = $originalCardId . '_imported_' . $cardCounter;
                        $cardCounter++;
                    }
                }
                $stats['cards_added'] += count($column['cards']);
            }
            
            $columns[] = $column;
        }
        
        return [
            'columns' => $columns,
            'stats' => $stats
        ];
    }
    
    /**
     * Vérifie si un ID de colonne existe déjà
     */
    private static function columnIdExists($columns, $id) {
        foreach ($columns as $column) {
            if ($column['id'] === $id) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Vérifie si un ID de carte existe déjà
     */
    private static function cardIdExists($columns, $cardId) {
        foreach ($columns as $column) {
            if (isset($column['cards'])) {
                foreach ($column['cards'] as $card) {
                    if ($card['id'] === $cardId) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
