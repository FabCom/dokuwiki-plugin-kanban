# Plugin Kanban pour DokuWiki

Un plugin DokuWiki avancé pour créer des tableaux Kanban interactifs type Trello avec système d'inclusion et fonctionnalités étendues.

## ✨ Fonctionnalités principales

### 📋 Tableaux Kanban complets
- **Syntaxe simple** : Utilisation de balises `<kanban>`
- **Interface Trello-like** : Colonnes et cartes visuelles avec drag & drop
- **Édition temps réel** : Modification directe via modales intuitives
- **Sauvegarde AJAX** : Sauvegarde automatique sans rechargement
- **Responsive** : Interface adaptative mobile et desktop

### 🎯 Système de gestion avancé
- **Priorités colorées** : 4 niveaux (faible, normale, moyenne, élevée)
- **Assignation** : Attribution des cartes aux utilisateurs
- **Étiquettes (tags)** : Classification et organisation flexible
- **Indicateurs de contenu** : Affichage des liens, médias et discussions

### 🔍 Système d'inclusion KanbanView
- **Inclusion flexible** : Intégrer des vues kanban dans n'importe quelle page
- **Vues spécialisées** : Affichage de tableaux complets, colonnes ou cartes individuelles
- **Affichage inline** : Colonnes horizontales et cartes en ligne pour économiser l'espace
- **Titres hiérarchiques** : Navigation "Tableau > Colonne" ou "Tableau > Carte"
- **Modes d'affichage** : Readonly et interactif selon les besoins

### 🛡️ Sécurité et performance
- **Gestion d'accès** : Contrôle des permissions basé sur DokuWiki
- **Validation d'entrée** : Sanitisation complète des données
- **CSP sécurisé** : Content Security Policy adaptatif
- **Cache intelligent** : Optimisation des performances
- **Verrouillage** : Prévention des conflits d'édition simultanée

### 🎨 Fonctionnalités d'interface
- **Filtres avancés** : Par priorité, assigné, tags, dates
- **Recherche** : Recherche temps réel dans les cartes
- **Discussions** : Système de commentaires intégré
- **Gestion de médias** : Upload et insertion d'images/fichiers
- **Templates** : Modèles de cartes réutilisables

## 🚀 Installation

1. **Via Git (recommandé)**
   ```bash
   cd lib/plugins/
   git clone https://github.com/FabCom/dokuwiki-plugin-kanban.git kanban
   ```

2. **Téléchargement manuel**
   - Télécharger et décompresser dans `lib/plugins/kanban/`
   - Activer le plugin dans l'administration DokuWiki

3. **Configuration**
   - Vérifier les permissions d'écriture
   - Configurer via l'administration si nécessaire

## 📖 Utilisation

### 1. Tableau Kanban complet

```wiki
<kanban title="Projet Web" editable="true" sortable="true">
## 📋 À faire
* Analyser les besoins [priority:high] [assignee:jean.dupont] [tags:analyse,urgent]
  > Description détaillée de la tâche d'analyse
* Créer maquettes [priority:medium] [assignee:marie.martin] [tags:design]

## 🔄 En cours  
* Développer API REST [priority:high] [assignee:paul.bernard] [tags:dev,backend]
* Tests unitaires [priority:medium] [assignee:sophie.durand] [tags:test]

## ✅ Terminé
* Initialisation projet [priority:low] [assignee:jean.dupont] [tags:setup]
</kanban>
```

### 2. Inclusion de vues spécialisées

#### Afficher une colonne spécifique (inline)
```wiki
<kanbanview board="projets:mon_kanban" column="todo" readonly="false">
</kanbanview>
```

#### Afficher une carte individuelle (inline)
```wiki
<kanbanview board="projets:mon_kanban" card="card_abc123" readonly="true">
</kanbanview>
```

#### Afficher le tableau complet en inclusion
```wiki
<kanbanview board="projets:mon_kanban" readonly="true">
</kanbanview>
```

### 3. Attributs et options

#### Tableau Kanban (`<kanban>`)
- `title` : Titre du tableau
- `editable` : Autoriser l'édition (`true`/`false`)
- `sortable` : Autoriser le drag & drop (`true`/`false`)
- `id` : Identifiant unique (auto-généré si omis)

#### KanbanView (`<kanbanview>`)
- `board` : ID de la page contenant le kanban source
- `column` : Nom de la colonne à afficher (optionnel)
- `card` : ID de la carte à afficher (optionnel)
- `readonly` : Mode lecture seule (`true`/`false`)

### 4. Format des cartes

```wiki
* Titre de la carte [priority:high] [assignee:nom.utilisateur] [tags:tag1,tag2] [due:2025-12-31]
  > Description optionnelle de la carte
  > Peut contenir plusieurs lignes
```

#### Attributs de carte
- `priority` : `low`, `normal`, `medium`, `high`, `urgent`
- `assignee` : Nom d'utilisateur (format: `prenom.nom`)
- `tags` : Liste de tags séparés par des virgules
- `due` : Date d'échéance (format: `YYYY-MM-DD`)

## 🎛️ Interface utilisateur

### Tableaux Kanban
- **Modales d'édition** : Interface intuitive pour cartes et colonnes
- **Drag & Drop** : Déplacement fluide entre colonnes
- **Boutons d'action** : Ajout, modification, suppression avec confirmations
- **Indicateurs visuels** : Priorités colorées, compteurs de contenu

### Filtres et recherche
- **Filtres multiples** : Priorité, assigné, tags, dates
- **Recherche temps réel** : Dans titres et descriptions
- **Réinitialisation** : Retour à la vue complète

### Gestion de contenu
- **Éditeur riche** : Support Markdown dans les descriptions
- **Upload de médias** : Glisser-déposer d'images et fichiers
- **Liens intelligents** : Détection automatique des liens internes/externes
- **Discussions** : Commentaires et historique

## ⚙️ Configuration

### Options globales (`conf/default.php`)
```php
$conf['default_editable'] = 1;      // Édition par défaut
$conf['default_sortable'] = 1;      // Drag & drop par défaut
$conf['auto_save'] = 1;             // Sauvegarde automatique
$conf['max_columns'] = 10;          // Limite de colonnes
$conf['max_cards_per_column'] = 50; // Limite de cartes
$conf['enable_discussions'] = 1;    // Système de discussions
$conf['enable_media_upload'] = 1;   // Upload de médias
```

### Sécurité
- **CSP adaptatif** : Content Security Policy selon les besoins
- **Validation stricte** : Sanitisation de toutes les entrées
- **Permissions DokuWiki** : Respect des ACL existantes

## 🗃️ Architecture et stockage

### Structure des données
```
data/
└── pages/
    └── projets/
        ├── mon_kanban.txt        # Page DokuWiki
        └── mon_kanban.kanban     # Données JSON du kanban
```

### Composants du plugin
```
kanban/
├── syntax/
│   ├── kanban.php           # Syntaxe <kanban>
│   └── kanbanview.php       # Syntaxe <kanbanview>
├── action/
│   └── data.php             # API données sécurisées
├── js/
│   ├── script.js            # Kanban principal
│   ├── kanban-view.js       # Système d'inclusion
│   ├── modal-*.js           # Modales spécialisées
│   ├── filters.js           # Filtres et recherche
│   └── discussions.js       # Système de discussions
├── css/
│   ├── style.css            # Styles principaux
│   └── filters.css          # Styles des filtres
└── Classes PHP/
    ├── KanbanDataManager.php     # Gestion des données
    ├── KanbanSecurityPolicy.php  # Sécurité
    ├── KanbanAuthManager.php     # Authentification
    └── ...                       # Autres gestionnaires
```

## 🎨 Personnalisation

### CSS principal
```css
.kanban-board { /* Conteneur principal */ }
.kanban-column { /* Colonnes */ }
.kanban-card { /* Cartes */ }
.kanban-view.single-column { /* Vue colonne inline */ }
.kanban-view.single-card { /* Vue carte inline */ }
```

### Classes de priorité
```css
.priority-low { background: #28a745; }      /* Vert */
.priority-normal { background: #6c757d; }   /* Gris */
.priority-medium { background: #fd7e14; }   /* Orange */
.priority-high { background: #dc3545; }     /* Rouge */
.priority-urgent { background: #6f42c1; }   /* Violet */
```

## 🔧 API et intégration

### AJAX Endpoints
- `?do=kanban_data` : Récupération des données
- `?do=kanban_save` : Sauvegarde des modifications
- `?do=kanban_upload` : Upload de médias
- `?do=kanban_discussion` : Gestion des discussions

### Hooks DokuWiki
- Intégration native avec le système d'événements
- Respect du workflow de sauvegarde DokuWiki
- Support des plugins de sécurité tiers

## 📊 Cas d'usage

### 1. Gestion de projet
```wiki
<kanban title="Développement App Mobile">
## Backlog
* Spécifications techniques [priority:high] [assignee:chef.projet]
* Wireframes UI [priority:medium] [assignee:designer]

## Sprint 1
* Login utilisateur [priority:high] [assignee:dev.backend]
* Interface connexion [priority:high] [assignee:dev.frontend]
</kanban>
```

### 2. Dashboard de synthèse
```wiki
== Projets en cours ==
<kanbanview board="projets:app_mobile" column="en_cours" readonly="true">
</kanbanview>

== Tâches urgentes ==
<kanbanview board="projets:site_web" column="urgent" readonly="true">
</kanbanview>
```

### 3. Suivi individuel
```wiki
== Mes tâches ==
Projet A: <kanbanview board="projets:a" card="task_123" readonly="false">
</kanbanview>

Projet B: <kanbanview board="projets:b" card="task_456" readonly="false">
</kanbanview>
```

## 🐛 Débogage

### Logs
- Erreurs dans `data/logs/` (si activé)
- Console navigateur pour debug JavaScript
- Validation PHP avec `php -l`

### Diagnostic
```bash
# Vérifier les permissions
ls -la data/pages/
ls -la data/meta/

# Tester la syntaxe
php -l lib/plugins/kanban/action.php
```

## 🤝 Contribution

### Développement
1. Fork du repository
2. Branche feature : `git checkout -b feature/nouvelle-fonctionnalite`
3. Commit : `git commit -am 'Ajout nouvelle fonctionnalité'`
4. Push : `git push origin feature/nouvelle-fonctionnalite`
5. Pull Request

### Rapports de bugs
- Issues GitHub avec reproduction détaillée
- Version DokuWiki et configuration
- Logs d'erreur si disponibles

### Documentation
- Amélioration de ce README
- Exemples d'usage
- Traductions

## 📄 Licence

**GPL v2** - Compatible avec DokuWiki

## 🔗 Liens

- **Repository** : https://github.com/FabCom/dokuwiki-plugin-kanban
- **Documentation** : Voir `KANBANVIEW_DOCUMENTATION.md`
- **DokuWiki** : https://www.dokuwiki.org/

---

*Plugin développé pour DokuWiki avec focus sur la sécurité, les performances et l'expérience utilisateur.*
