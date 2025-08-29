# Migration vers le format JSON - Plugin Kanban

## 🎯 Objectif

Cette migration fait évoluer le plugin kanban d'un format de stockage markdown/wiki vers un format JSON pur, facilitant grandement le développement et la maintenance.

## 📋 Changements effectués

### 1. **Format de stockage**

**Avant (format markdown):**
```markdown
<kanban title="Mon Projet">
## À faire
* Analyser les besoins [priority:high] [assignee:Jean] [tags:urgent,analyse]
* Créer maquettes [priority:medium] [assignee:Paul]

## En cours  
* Développer API [priority:high] [assignee:Sophie] [tags:dev,backend]

## Terminé
* Configuration projet [priority:low] [assignee:Marie] [tags:setup]
</kanban>
```

**Après (format JSON):**
```json
<kanban title="Mon Projet">
[
    {
        "id": "col_1",
        "title": "À faire",
        "cards": [
            {
                "id": "card_1",
                "title": "Analyser les besoins",
                "priority": "high",
                "assignee": "Jean",
                "tags": ["urgent", "analyse"],
                "creator": "Jean",
                "created": "2025-08-29 10:00:00"
            }
        ]
    },
    {
        "id": "col_2",
        "title": "En cours",
        "cards": []
    },
    {
        "id": "col_3",
        "title": "Terminé",
        "cards": []
    }
]
</kanban>
```

### 2. **Modifications techniques**

#### Fichier `syntax.php`
- ✅ `parseKanbanContent()` : Parser JSON au lieu de markdown
- ✅ Suppression de `parseCard()` (plus nécessaire)
- ✅ `renderKanbanContent()` : Utilise les IDs persistants des colonnes
- ✅ Validation et valeurs par défaut automatiques

#### Fichier `action.php`
- ✅ `generateKanbanContent()` : Génère du JSON formaté
- ✅ `parseKanbanContentToData()` : Parser JSON au lieu de markdown
- ✅ Suppression de `parseCardFromWiki()` (plus nécessaire)
- ✅ Structure de données normalisée

## 🎉 Avantages

### 1. **Développement facilité**
- Parser JSON natif au lieu de regex complexes
- Structure de données prévisible
- Validation automatique des données
- Débogage plus facile

### 2. **Maintenabilité**
- Code plus lisible et compréhensible
- Moins de code de parsing manuel
- Gestion d'erreurs simplifiée
- Tests plus faciles

### 3. **Extensibilité**
- Ajout facile de nouveaux champs
- Structure flexible pour futures fonctionnalités
- Compatibilité avec outils externes
- Interopérabilité améliorée

### 4. **Robustesse**
- IDs persistants pour colonnes et cartes
- Validation automatique des données
- Gestion des cas d'erreur
- Valeurs par défaut intelligentes

## 🔧 Structure JSON complète

```json
[
    {
        "id": "col_unique_id",           // ID persistant de la colonne
        "title": "Nom de la colonne",    // Titre affiché
        "cards": [
            {
                "id": "card_unique_id",          // ID persistant de la carte
                "title": "Titre de la carte",    // Titre principal
                "description": "Description",    // Description détaillée
                "priority": "high",              // low|normal|medium|high
                "assignee": "nom_utilisateur",   // Utilisateur assigné
                "tags": ["tag1", "tag2"],        // Tableau de tags
                "creator": "nom_createur",       // Créateur de la carte
                "created": "2025-08-29 10:00:00", // Date de création
                "dueDate": "2025-09-15",         // Date d'échéance (optionnel)
                "lastModified": "2025-08-29 11:30:00",      // Dernière modification
                "lastModifiedBy": "nom_modificateur"        // Dernier modificateur
            }
        ]
    }
]
```

## 📝 Champs disponibles

### Colonne
- `id` : Identifiant unique (généré automatiquement)
- `title` : Titre de la colonne
- `cards` : Tableau des cartes

### Carte
- `id` : Identifiant unique (généré automatiquement)
- `title` : Titre de la carte (**requis**)
- `description` : Description détaillée (optionnel)
- `priority` : Priorité (`low`, `normal`, `medium`, `high`)
- `assignee` : Utilisateur assigné (optionnel)
- `tags` : Tableau de tags (optionnel)
- `creator` : Créateur de la carte (automatique)
- `created` : Date de création (automatique)
- `dueDate` : Date d'échéance (optionnel)
- `lastModified` : Dernière modification (automatique)
- `lastModifiedBy` : Dernier modificateur (automatique)

## 🚀 Migration automatique

Le système gère automatiquement :

1. **Contenus vides** : Créé une structure par défaut avec 3 colonnes
2. **JSON invalide** : Fallback vers la structure par défaut
3. **Champs manquants** : Ajout automatique des valeurs par défaut
4. **IDs manquants** : Génération automatique d'IDs uniques

## 📊 Compatibilité

- ❌ **Pas de rétrocompatibilité** avec l'ancien format markdown
- ✅ **Migration manuelle** nécessaire pour les tableaux existants
- ✅ **Nouveaux tableaux** utilisent automatiquement le format JSON
- ✅ **Validation** automatique des données

## 🎯 Prochaines étapes

Avec cette base JSON solide, nous pouvons maintenant facilement implémenter :

1. **Nouvelles fonctionnalités** :
   - Dates d'échéance avec notifications
   - Commentaires sur les cartes
   - Pièces jointes
   - Historique des modifications

2. **Import/Export** :
   - Export JSON/CSV/Excel
   - Import depuis autres outils (Trello, Jira, etc.)
   - API REST

3. **Recherche et filtres avancés** :
   - Recherche textuelle globale
   - Filtres complexes
   - Tri multi-critères

Cette migration constitue une base solide pour toutes les évolutions futures du plugin ! 🎉
