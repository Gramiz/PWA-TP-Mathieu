# Vide-frigo — Technical Design Doc

Auteur : Mathieu · 12 octobre 2026 · Statut : final
Production : https://vide-frigo-mathieu-tp.netlify.app · Dépôt public : https://github.com/Gramiz/PWA-TP-Mathieu.

## 1. TL;DR
Vide-frigo conserve une liste d’aliments avec leurs dates limites et une photo facultative. L’utilisateur ajoute, consulte et supprime les entrées, même sans connexion. Le choix principal est une écriture locale atomique avec outbox, suivie d’un envoi au serveur.

## 2. Contexte et objectifs
Sujet libre du TP PWA : retrouver ses aliments par date limite. V1 : ajout (nom/date/photo), liste triée et suppression, toutes les briques PWA obligatoires. Non-objectifs : comptes, restauration multi-appareil, recettes, scanner, notifications, deuxième capacité et résolution de conflits.

## 3. Architecture
HTML/CSS/JavaScript sans framework pour comprendre les mécanismes du cours ; `idb` simplifie les transactions IndexedDB. Un SW manuel garde le contrôle du cache, des mises à jour et de Background Sync. Le build assemble seulement le SW avec esbuild au format classique pour Firefox ; les modules de la page restent natifs. Netlify sert les fichiers et la fonction Node `foods.mjs` ; Netlify Blobs conserve les entrées par appareil (store site-wide, région européenne, cohérence forte). Le serveur local Node utilise le même gestionnaire avec stockage disque. Le build copie `idb` localement, remplace les URLs publiques et calcule l’empreinte du cache. Netlify exécute `npm run build` depuis Git ou le CLI publie un build préparé.

```text
Page ↔ IndexedDB (foods, outbox, meta) ↔ envoi HTTP ↔ fonction ↔ Blobs
Page ↔ Service Worker ↔ Cache API (interface)
              ↘ Background Sync ↔ IndexedDB ↔ même API
```

## 4. Cache et hors ligne
| Ressource | Stratégie | Stockage | Justification |
|---|---|---|---|
| HTML de l’interface | Cache First, versionné | Cache API | Même version que les modules JS ; mise à jour proposée |
| CSS/JS/idb/icônes/manifest | Cache First, précache | Cache API | Chargement sans réseau et aucune dépendance CDN |
| Aliments/photos/actions | Local d’abord | IndexedDB | Consultation et écriture hors ligne |
| API | Network Only | Serveur + outbox locale | Ne jamais mettre les écritures ou données privées en cache HTTP |

Le frigo fonctionne après un premier chargement en ligne réussi. Une navigation non précachée qui échoue reçoit `offline.html`. Hors ligne, un message indique l’envoi différé ; aucune action métier ne nécessite d’être désactivée. La caméra indisponible affiche un message. Les erreurs de stockage conservent la saisie. Voir `public/sw.js` et `public/app.js`.

## 5. Mise à jour
Installation : un bandeau propose Installer hors mode standalone. Le bouton utilise `beforeinstallprompt` quand disponible ; sur iPhone il explique Partager → Sur l’écran d’accueil → Ajouter. Fermeture mémorisée uniquement pour la session. Aucun dialogue natif d’installation forcé au chargement.

Une bannière propose **Mettre à jour** : cela évite un rechargement automatique pendant une saisie. `registration.waiting` et `updatefound` détectent le SW prêt. Après clic : message `SKIP_WAITING`, puis rechargement à `controllerchange`. Le nouveau SW supprime uniquement les anciens caches `vide-frigo-*` et prend le contrôle. Le build génère la version depuis le contenu des fichiers ; `sw.js` n’est pas précaché.

## 6. Données et synchronisation
`foods` : clé UUID, nom, date ISO, photo JPEG facultative, date de création. `outbox` : séquence auto-incrémentée, action save/delete et payload. `meta` : jeton d’appareil, dernier envoi et bail d’exclusion. Les photos sont limitées à 640 px, compressées en JPEG et plafonnées à 400 000 caractères. Aliments et actions sont écrits dans une transaction commune.

`sync.js` envoie dans l’ordre, avec timeout de 12 s. Une action n’est retirée qu’après réponse HTTP réussie et acquittement JSON valide. Échec : la file reste intacte. Le SW traite `sync` ; la page rejoue à `online`, au lancement et au retour au premier plan. Un bail IndexedDB évite deux traitements simultanés page/SW. Les UUID rendent les créations idempotentes ; les suppressions laissent une tombstone serveur pour prévenir une recréation par rejeu. Pas de résolution de conflits : aucune édition et aucun partage de frigo entre appareils dans la v1.

## 7. Permissions et capacité
| API | Déclenchement | Pourquoi | Refus |
|---|---|---|---|
| Caméra (`getUserMedia`) | Bouton Prendre une photo | Photo facultative de l’aliment, sans accès au micro | Message et ajout sans photo |

Le flux s’arrête après capture, fermeture, ajout ou passage en arrière-plan. Aucun accès caméra au chargement. `public/app.js` contient capture, compression et erreurs.

## 8. Notifications
Aucune : les notifications push sont un bonus exclu du périmètre demandé.

## 9. Visibilité : SEO et agents IA
Le HTML initial contient titres, formulaire et exemples publics ; les aliments personnels viennent d’IndexedDB. Titre, description, canonical, Open Graph et JSON-LD `WebApplication` décrivent ce contenu. `robots.txt` ouvre le contenu public à GPTBot et ClaudeBot, avec justification, mais exclut l’API. Sitemap : accueil uniquement. `llms.txt` renvoie à la présentation. Les URLs absolues sont générées avec `SITE_URL` ou l’URL Netlify. Pas de jumelle Markdown ni de WebMCP, non requis par le sujet.

## 10. Sécurité et vie privée
Nom, date et photo sont stockés sur l’appareil puis envoyés en HTTPS au serveur. Un jeton aléatoire d’appareil reste dans IndexedDB ; son empreinte délimite les clés serveur. Ce jeton sert de capacité d’accès, sans constituer un compte utilisateur. Le serveur valide noms, UUID, dates et JPEG, limite les tailles, contrôle Origin et ne propose aucune liste publique. Le rendu des noms utilise `textContent`. Aucun secret Netlify côté client. CSP, nosniff, Referrer-Policy, X-Frame-Options, HSTS et Permissions-Policy sont configurés dans `netlify.toml`. Pas de tracker.

## 11. Mesures
Lighthouse 13.5 mobile sur Netlify, le 12 octobre 2026, après stabilisation : performance **100**, accessibilité **100**, bonnes pratiques **100**, SEO **100** ; LCP **1,0 s**, CLS **0**, TBT **0 ms**. Aucune erreur console ou CSP. Ce sont des mesures de laboratoire ; aucun INP terrain n’est revendiqué. Le statut réseau et la liste disposent d’un espace réservé pour éviter les décalages. Le badge Netlify est désactivé dans les réglages du projet, sans assouplir la CSP.

Les 5 tests API et les scénarios PWA passent : hors ligne, persistance, tri, secours, envoi serveur, photo simulée, refus, HTTP 503, suppression et mise à jour. Background Sync est déclenché via DevTools avec l’onglet fermé. Netlify public : HTML/fichiers répondent 200 ; création avec photo hors ligne, envoi réel vers Blobs et suppression revérifiés après correction. Un redéploiement a validé la bannière et la conservation des données. L’auteur confirme installation, caméra et mode avion/reconnexion sur iPhone ; cette preuve utilisateur est distincte des tests automatisés. Voir `VALIDATION.md`.

## 12. Limites connues et suite
Premier accès sans réseau impossible. Sans Background Sync, la page doit être ouverte lors de la reconnexion ou relancée. Le navigateur peut évincer le stockage ; effacer les données du site perd aussi l’identifiant d’appareil. Pas de restauration serveur, d’authentification personnelle ou de synchronisation multi-appareil. Le navigateur automatisé Firefox ne démarre pas dans cet environnement ; les tests iPhone sont déclarés par l’auteur. La fiche du Class Hub sera déposée par l’auteur. Une éventuelle v2 pourrait proposer une restauration serveur, hors périmètre du TP.
