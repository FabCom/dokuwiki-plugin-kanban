# Plugin Kanban pour DokuWiki

Un plugin DokuWiki pour créer des tableaux Kanban interactifs type Trello directement dans les pages.

## ✨ Fonctionnalités

- 📋 **Syntaxe simple** : Utilisation de balises `<kanban>` 
- 🎨 **Interface Trello-like** : Colonnes et cartes visuelles
- ✏️ **Édition en ligne** : Modification directe sur la page
- 🔄 **Drag & Drop** : Déplacement des cartes entre colonnes
- 💾 **Sauvegarde AJAX** : Sauvegarde automatique sans rechargement
- 📱 **Responsive** : Fonctionne sur mobile et desktop
- 🎯 **Priorités** : Système de priorités colorées
- 🏷️ **Étiquettes** : Tags et assignation de cartes

## 🚀 Installation

1. Télécharger et décompresser dans `lib/plugins/kanban/`
2. Activer le plugin dans l'administration DokuWiki
3. Commencer à utiliser la syntaxe `<kanban>` dans vos pages

## 📖 Utilisation

### Syntaxe de base

```
<kanban title="Mon Projet" editable="true" sortable="true">
## À faire
* Analyser les besoins [priority:high] [assignee:Jean] [tags:urgent,analyse]
* Créer maquettes [priority:medium] [assignee:Marie]

## En cours  
* Développer API [priority:high] [assignee:Paul] [tags:dev,backend]
* Tests unitaires [priority:medium] [assignee:Sophie]

## Terminé
* Initialisation projet [priority:low] [assignee:Jean] [tags:setup]
</kanban>
```

### Attributs disponibles

- `title` : Titre du tableau (défaut: "Kanban Board")
- `editable` : Édition autorisée (défaut: "true")
- `sortable` : Glisser-déposer autorisé (défaut: "true") 
- `id` : Identifiant unique (généré automatiquement)

### Format des cartes

```
* Titre de la carte [priority:high] [assignee:Nom] [tags:tag1,tag2]
```

#### Priorités disponibles
- `low` : Priorité faible (vert)
- `normal` : Priorité normale (gris)
- `medium` : Priorité moyenne (orange)
- `high` : Priorité élevée (rouge)

## 🎛️ Interface

### Boutons d'action
- **Ajouter Colonne** : Créer une nouvelle colonne
- **Ajouter Carte** : Ajouter une carte dans une colonne
- **Sauvegarder** : Sauvegarder manuellement les modifications
- **Supprimer** : Supprimer colonnes ou cartes (avec confirmation)

### Édition en ligne
- Cliquer sur les titres pour les modifier directement
- Déplacer les cartes par glisser-déposer
- Sauvegarde automatique des modifications

## ⚙️ Configuration

Le plugin peut être configuré via l'interface d'administration :

- `default_editable` : Édition activée par défaut
- `default_sortable` : Glisser-déposer activé par défaut  
- `auto_save` : Sauvegarde automatique
- `max_columns` : Nombre maximum de colonnes
- `max_cards_per_column` : Nombre maximum de cartes par colonne

## 🗃️ Stockage

Les données sont sauvegardées dans des fichiers meta (`.kanban`) associés à chaque page, permettant :
- Versioning automatique avec la page
- Sauvegarde/restauration avec DokuWiki
- Performance optimale

## 🎨 Personnalisation

Le CSS peut être personnalisé en modifiant `style.css` ou en ajoutant des règles dans votre template.

Classes CSS principales :
- `.kanban-board` : Conteneur principal
- `.kanban-column` : Colonnes
- `.kanban-card` : Cartes individuelles
- `.priority-high`, `.priority-medium`, `.priority-low` : Priorités

## 🔧 Développement

Structure du plugin :
```
kanban/
├── syntax.php          # Composant de syntaxe
├── action.php          # Composant d'action (AJAX)
├── script.js           # JavaScript interactif
├── style.css           # Styles CSS
├── conf/
│   ├── default.php     # Configuration par défaut
│   └── metadata.php    # Métadonnées de config
└── lang/
    ├── en/lang.php     # Traductions anglaises
    └── fr/lang.php     # Traductions françaises
```

## 📄 Licence

GPL 2 - Compatible avec DokuWiki

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer des améliorations  
- Contribuer au code
- Améliorer la documentation
