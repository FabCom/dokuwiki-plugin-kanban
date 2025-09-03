# 🔒 Audit de Sécurité et Améliorations - Plugin Kanban

**Date de création**: 3 septembre 2025  
**Version analysée**: Plugin Kanban DokuWiki  
**Statut**: En cours de correction

---

## 🚨 **RISQUES DE SÉCURITÉ CRITIQUES** (Urgence 1)

### [x] 1. Authentification dangereuse - `action.php:120-180` ✅ CORRIGÉ

**Risque**: Contournement d'authentification en mode développement  
**Impact**: ⚠️ CRITIQUE - Accès non autorisé aux données  
**Fichier**: `/lib/plugins/kanban/action.php`  
**Lignes**: 120-180  

~~PROBLÈME: Fallbacks dangereux~~
```php
// AVANT (DANGEREUX):
if ($currentUser === 'Anonyme') {
    $clientIP = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    $tempUser = 'Utilisateur_' . substr(md5($clientIP), 0, 6);
}

// APRÈS (SÉCURISÉ):
// SECURITY FIX: Remove dangerous fallbacks - enforce strict authentication
// Only allow development fallbacks if explicitly enabled in configuration
```

**Actions requises**:
- [x] Supprimer les fallbacks automatiques d'utilisateurs
- [x] Imposer l'authentification stricte pour toutes les actions d'écriture  
- [x] Ajouter des logs de sécurité pour les tentatives d'accès non autorisé
- [x] Ajouter fonction `validateAuthentication()` et `getCurrentUser()`
- [x] Sécuriser `saveBoardData()` et `lockBoard()`
- [x] Ajouter configuration sécurisée par défaut
- [x] Fix JavaScript : méthode `resetFilterStatus` manquante
- [ ] Tester en mode production sans fallbacks

**Date de correction**: 3 septembre 2025  
**Status**: ✅ AUTHENTIFICATION SÉCURISÉE - Connexion obligatoire pour modifications

---

### [ ] 2. Système de verrouillage faible - `action.php:700-850`
**Risque**: Race conditions, verrous orphelins  
**Impact**: ⚠️ CRITIQUE - Corruption de données concurrentes  
**Fichier**: `/lib/plugins/kanban/action.php`  
**Lignes**: 700-850  

```php
// PROBLÈME: Création de verrous sans vérification atomique
$lockData = $currentUser . '|' . time();
file_put_contents($lockFile, $lockData);
```

**Actions requises**:
- [ ] Implémenter un verrouillage atomique avec `flock()`
- [ ] Ajouter la vérification de propriété des verrous
- [ ] Implémenter un nettoyage automatique des verrous expirés
- [ ] Tester les scenarios de concurrence

---

### [ ] 3. Validation insuffisante des endpoints AJAX
**Risque**: Injection de paramètres, accès non autorisé  
**Impact**: ⚠️ ÉLEVÉ - Accès à des fichiers non autorisés  
**Fichiers concernés**:
- `/ajax/media-search.php`
- `/ajax/media-upload.php`
- `/ajax/media-list.php`

**Actions requises**:
- [ ] Renforcer la validation des paramètres de recherche
- [ ] Ajouter des whitelist pour les extensions de fichiers
- [ ] Valider tous les namespaces avant traitement
- [ ] Implémenter la limitation de taux (rate limiting)

---

### [ ] 4. Contrôle d'accès ACL incomplet
**Risque**: Bypass des permissions DokuWiki  
**Impact**: ⚠️ ÉLEVÉ - Accès non autorisé aux pages/médias  
**Fichiers**: Tous les fichiers AJAX  

**Actions requises**:
- [ ] Auditer tous les appels `auth_quickaclcheck()`
- [ ] Vérifier les permissions avant chaque action CRUD
- [ ] Implémenter une couche d'autorisation centralisée
- [ ] Tester avec différents niveaux de permissions

---

## ⚠️ **RISQUES DE SÉCURITÉ MODÉRÉS** (Urgence 2)

### [ ] 5. XSS potentiel - `syntax.php:200-220`
**Risque**: Injection JavaScript via nom d'utilisateur  
**Impact**: 🔶 MODÉRÉ - Exécution de code côté client  

```php
$renderer->doc .= 'JSINFO.kanban_user = ' . json_encode($currentUser) . ';';
```

**Actions requises**:
- [ ] Valider et échapper `$currentUser` avant injection
- [ ] Utiliser CSP (Content Security Policy) headers
- [ ] Tester avec des noms d'utilisateurs malveillants

---

### [ ] 6. Gestion d'erreurs incohérente
**Risque**: Fuite d'informations sensibles  
**Impact**: 🔶 MODÉRÉ - Information disclosure  

**Actions requises**:
- [ ] Standardiser les messages d'erreur
- [ ] Masquer les détails techniques en production
- [ ] Implémenter un logging centralisé

---

## 💻 **AMÉLIORATIONS DE CODE** (Urgence 3)

### [ ] 7. Refactorisation architecture
**Problème**: Classe `action.php` de 1123 lignes  
**Impact**: Maintenabilité difficile  

**Actions requises**:
- [ ] Créer `KanbanAuthManager` pour l'authentification
- [ ] Créer `KanbanLockManager` pour les verrous
- [ ] Créer `KanbanDataManager` pour le CRUD
- [ ] Créer `KanbanValidator` pour la validation

---

### [ ] 8. Duplication de code avec QuillJS
**Problème**: Code dupliqué dans `ajax/media-*`  
**Impact**: Maintenance double  

**Actions requises**:
- [ ] Créer une librairie commune `DokuWikiMediaManager`
- [ ] Factoriser les fonctions communes
- [ ] Créer des interfaces standardisées

---

### [ ] 9. Performance et cache
**Problème**: Pas de cache ACL, requêtes répétitives  
**Impact**: Performance dégradée  

**Actions requises**:
- [ ] Implémenter un cache ACL en session
- [ ] Optimiser les requêtes JSON volumineuses
- [ ] Ajouter la pagination pour gros tableaux

---

## 🚀 **NOUVELLES FONCTIONNALITÉS** (Urgence 4)

### [ ] 10. Audit trail et logs
**Fonctionnalité**: Historique complet des modifications  

**Actions requises**:
- [ ] Créer table de logs des modifications
- [ ] Enregistrer utilisateur, timestamp, détails
- [ ] Interface de consultation des logs
- [ ] Export des rapports d'activité

---

### [ ] 11. Permissions granulaires
**Fonctionnalité**: Contrôle d'accès fin  

**Actions requises**:
- [ ] Définir les niveaux: `read`, `edit`, `admin`, `delete`
- [ ] Implémenter la configuration par groupe
- [ ] Interface d'administration des permissions
- [ ] Tests de régression des permissions

---

### [ ] 12. Templates de cartes
**Fonctionnalité**: Modèles prédéfinis  

**Actions requises**:
- [ ] Système de templates JSON
- [ ] Interface de création de templates
- [ ] Validation des champs obligatoires
- [ ] Import/export de templates

---

### [ ] 13. Notifications et collaboration
**Fonctionnalité**: Alertes en temps réel  

**Actions requises**:
- [ ] Système de mentions (@utilisateur)
- [ ] Notifications par email
- [ ] WebSocket pour temps réel
- [ ] Historique des notifications

---

### [ ] 14. Métriques et reporting
**Fonctionnalité**: Analytics d'utilisation  

**Actions requises**:
- [ ] Calcul des temps de cycle
- [ ] Graphiques de progression
- [ ] Export PDF/Excel
- [ ] Dashboard d'administration

---

## 📋 **PLAN D'EXÉCUTION**

### Phase 1: Sécurité Critique (Semaine 1-2)
- [ ] Correction authentification dangereuse
- [ ] Refonte système de verrouillage
- [ ] Sécurisation endpoints AJAX
- [ ] Tests de sécurité complets

### Phase 2: Stabilisation (Semaine 3-4)
- [ ] Validation ACL systématique
- [ ] Gestion d'erreurs standardisée
- [ ] Logs de sécurité
- [ ] Tests de régression

### Phase 3: Refactorisation (Semaine 5-6)
- [ ] Modularisation architecture
- [ ] Factorisation code commun
- [ ] Optimisations performance
- [ ] Documentation technique

### Phase 4: Fonctionnalités (Semaine 7+)
- [ ] Audit trail
- [ ] Permissions granulaires
- [ ] Templates et collaboration
- [ ] Métriques et reporting

---

## 📝 **NOTES DE DÉVELOPPEMENT**

### Configuration sécurisée recommandée
```php
// conf/default.php - Ajouts sécurité
$conf['kanban_require_auth'] = true;
$conf['kanban_log_security_events'] = true;
$conf['kanban_max_lock_time'] = 900; // 15 minutes
$conf['kanban_enable_fallback_auth'] = false; // PRODUCTION: false
```

### Checklist tests de sécurité
- [ ] Test authentification avec utilisateurs anonymes
- [ ] Test bypass ACL avec paramètres manipulés
- [ ] Test injection dans tous les champs
- [ ] Test race conditions sur verrous
- [ ] Test upload de fichiers malveillants
- [ ] Test XSS dans noms d'utilisateurs
- [ ] Test permissions avec différents groupes

---

## 📞 **CONTACTS & RESSOURCES**

**Responsable sécurité**: À définir  
**Lead développeur**: À définir  
**Documentation**: Ce fichier + code source  
**Tests**: `/tests/security/` (à créer)  

---

**Dernière mise à jour**: 3 septembre 2025  
**Prochaine révision**: Après chaque correction majeure
