# Plugin Kanban - Support des vues incluses

## Vue d'ensemble

Le plugin Kanban prend maintenant en charge l'inclusion de vues kanban dans d'autres pages grâce à la nouvelle syntaxe `<kanbanview>`. Cette fonctionnalité permet d'afficher :

- Un tableau kanban complet d'une autre page
- Une colonne spécifique d'un kanban
- Une carte spécifique d'un kanban
- Des vues en lecture seule

## Syntaxes supportées

### 1. Afficher un kanban complet

```
<kanbanview board="namespace:page" />
```

Exemple :
```
<kanbanview board="projets:mon_projet" />
```

### 2. Afficher une colonne spécifique

```
<kanbanview board="namespace:page" column="id_colonne" />
```

Exemple :
```
<kanbanview board="projets:mon_projet" column="en_cours" />
```

### 3. Afficher une carte spécifique

```
<kanbanview board="namespace:page" card="id_carte" />
```

Exemple :
```
<kanbanview board="projets:mon_projet" card="tache_123" />
```

### 4. Options avancées

```
<kanbanview board="namespace:page" 
           readonly="true"
           height="300px"
           width="80%" />
```

**Note :** Le titre est généré automatiquement à partir du kanban source et inclut un lien vers la page complète.

## Attributs disponibles

| Attribut | Description | Valeurs | Obligatoire |
|----------|-------------|---------|-------------|
| `board` | Page contenant le kanban source | `namespace:page` | ✅ Oui |
| `column` | ID de la colonne à afficher | `string` | ❌ Non |
| `card` | ID de la carte à afficher | `string` | ❌ Non |
| `readonly` | Mode lecture seule | `true`/`false` | ❌ Non (défaut: `false`) |
| `height` | Hauteur du conteneur | CSS valide | ❌ Non (défaut: `auto`) |
| `width` | Largeur du conteneur | CSS valide | ❌ Non (défaut: `100%`) |

**Note :** L'attribut `title` a été supprimé. Le titre est maintenant généré automatiquement depuis le kanban source et inclut un lien cliquable vers la page complète.

## Exemples d'utilisation

### Dashboard de projet

```wiki
====== Dashboard du Projet Alpha ======

===== État des tâches =====
<kanbanview board="projets:alpha" readonly="true" />

===== Tâches urgentes =====
<kanbanview board="projets:alpha" column="urgent" height="200px" />

===== Tâche en vedette =====
<kanbanview board="projets:alpha" card="feature_xyz" />
```

### Page de rapport

```wiki
====== Rapport hebdomadaire ======

===== Équipe Développement =====
<kanbanview board="equipes:dev" column="en_cours" readonly="true" />

===== Équipe Design =====
<kanbanview board="equipes:design" column="en_cours" readonly="true" />
```

### Page d'accueil avec résumé

```wiki
====== Accueil ======

===== Projets actifs =====
<kanbanview board="admin:projets_actifs" readonly="true" height="400px" />
```

## Fonctionnalités des vues

### Titre automatique avec lien

- Chaque vue affiche automatiquement le titre du kanban source
- Le titre est un lien cliquable vers la page kanban complète
- Pour les vues partielles, une indication du type de vue est ajoutée (ex: "Colonne: todo")

### Indicateurs de contenu

Les cartes dans les vues affichent les mêmes indicateurs que dans le kanban original :

- **🔗** Liens internes DokuWiki
- **🌐** Liens externes
- **📎** Fichiers média attachés
- **💬** Discussions (chargées de façon asynchrone)

### Interaction avec les cartes

- **Mode normal** : Clic sur une carte ouvre la modale de détails
- **Mode readonly** : Pas d'interaction, cartes en lecture seule
- Même apparence que dans le kanban original

## Sécurité et permissions

- **Permissions DokuWiki** : L'utilisateur doit avoir les droits de lecture sur la page source
- **Validation** : Tous les paramètres sont validés et nettoyés
- **Sécurité** : Protection contre les attaques XSS
- **Isolation** : Les vues en `readonly` ne permettent aucune modification

## Architecture technique

### Composants créés

1. **`syntax/kanbanview.php`** - Parser pour la syntaxe `<kanbanview>`
2. **`action/data.php`** - API pour récupérer les données JSON
3. **`js/kanban-view.js`** - Classe JavaScript pour l'affichage
4. **Styles CSS** - Styles spécifiques aux vues

### Flux de données

1. **Parse** : Le parser détecte `<kanbanview>` et extrait les attributs
2. **Rendu** : Génération du HTML avec configuration JSON
3. **Chargement** : JavaScript charge les données via AJAX
4. **Affichage** : Rendu dynamique selon les paramètres

## Dépannage

### Erreurs courantes

**"Attribut board requis"**
- Vérifiez que l'attribut `board` est bien spécifié
- Format attendu : `namespace:page`

**"Pas d'autorisation pour lire la page"**
- L'utilisateur n'a pas les droits de lecture sur la page source
- Vérifiez les permissions DokuWiki

**"Page introuvable"**
- La page spécifiée dans `board` n'existe pas
- Vérifiez l'orthographe de l'ID de page

**"Aucune donnée kanban trouvée"**
- La page source ne contient pas de bloc `<kanban>`
- Vérifiez le contenu de la page source

**"Colonne/Carte introuvable"**
- L'ID spécifié n'existe pas dans le kanban source
- Vérifiez les IDs dans le JSON du kanban

### Mode debug

Pour diagnostiquer les problèmes, vérifiez :

1. **Console du navigateur** : Messages d'erreur JavaScript
2. **Logs du serveur** : Erreurs PHP côté serveur
3. **Onglet Réseau** : Requêtes AJAX et réponses
4. **Source de la page** : HTML généré

## Limitations

- Les vues ne peuvent pas être modifiées (mode lecture uniquement pour les inclusions)
- Pas de drag & drop dans les vues incluses
- Les permissions sont héritées de la page source
- Une vue ne peut référencer qu'un seul kanban source

## Compatibilité

- Compatible avec le plugin include existant
- Fonctionne avec tous les navigateurs modernes
- Respecte la Content Security Policy
- Compatible avec l'authentification DokuWiki
