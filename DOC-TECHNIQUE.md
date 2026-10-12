# Vide-frigo — Document technique

Mathieu ROBERT · 12 octobre 2026 · Version finale

Application : https://vide-frigo-mathieu-tp.netlify.app
Dépôt : https://github.com/Gramiz/PWA-TP-Mathieu

## 1. Présentation

Vide-frigo permet de noter les aliments de son frigo et leur date limite. La liste reste accessible sans connexion. Les modifications sont enregistrées sur le téléphone avant leur envoi au serveur.

## 2. Contexte et objectifs

On peut ajouter un aliment avec une photo facultative, le modifier et le supprimer. La liste est triée par date. Les trois bonus sont présents : partage, push et résolution des conflits.

## 3. Architecture

J’ai utilisé HTML, CSS et JavaScript sans framework. `idb` simplifie IndexedDB ; esbuild regroupe le Service Worker dans un fichier classique.

```text
Page ↔ IndexedDB (aliments et actions en attente)
Page ↔ Service Worker ↔ Cache API (interface)
Page ou Service Worker → API Netlify → Netlify Blobs
```

Netlify héberge l’interface, l’API et les fonctions push. Netlify Blobs conserve les données en région européenne, avec des lectures cohérentes. En local, Node utilise la même API avec un stockage disque. Le build prépare les fichiers et le CLI Netlify les publie.

## 4. Cache et hors ligne

| Ressource | Stratégie | Stockage | Raison |
|---|---|---|---|
| HTML | Cache First, versionné | Cache API | Ouvrir l’interface sans réseau et garder la même version que le JavaScript |
| CSS, JS, icônes et manifest | Cache First | Cache API | Charger les fichiers sans connexion ni CDN |
| Aliments et photos | Lecture et écriture locales | IndexedDB | Consulter et modifier la liste hors ligne |
| Requêtes API | Network Only | Serveur et outbox locale | Envoyer les actions sans mettre les réponses privées en cache |

Après une première ouverture en ligne, la liste et ses modifications fonctionnent en mode avion. Un message indique l’envoi différé. Une navigation vers une page non cachée affiche `offline.html` si le réseau manque.

## 5. Mise à jour

La bannière **Mettre à jour** laisse l’utilisateur choisir le moment du rechargement. Au clic, le Service Worker reçoit `SKIP_WAITING` ; la page se recharge à `controllerchange`. Le cache dépend du contenu des fichiers et les anciens caches sont supprimés à l’activation. `sw.js` n’est pas caché. Deux déploiements ont permis de vérifier ce fonctionnement.

## 6. Données et synchronisation

IndexedDB contient trois stores :

- `foods` : UUID, nom, date limite, photo, date de création et version serveur.
- `outbox` : ajouts, modifications et suppressions, avec identifiant d’action, version connue et éventuel conflit.
- `meta` : identifiant d’appareil, dernier envoi et verrou temporaire de synchronisation.

Une transaction enregistre l’aliment et son action ensemble. La liste est triée en JavaScript, sans index. Les photos JPEG sont limitées à 640 pixels et 400 000 caractères encodés.

Les actions partent dans l’ordre et sont retirées après confirmation ; un échec les laisse en attente. Background Sync assure l’envoi, avec un repli sur `online`, au lancement et au retour au premier plan. Un verrou empêche deux envois simultanés.

Les identifiants d’action évitent les doublons. La version connue passe dans `If-Match` et le JSON, car le proxy Netlify peut retirer l’en-tête. Les écritures conditionnelles par ETag protègent les requêtes simultanées. Une version dépassée reçoit `412`. L’outbox garde le conflit et propose **Garder ma version** (renvoi avec la version actuelle) ou **Prendre celle du serveur** (remplacement local). Les deux choix ont été testés avec deux onglets hors ligne.

## 7. Permissions et capacité de l’appareil

| Capacité | Déclenchement | Utilité | En cas de refus |
|---|---|---|---|
| Caméra, avec `getUserMedia` | Clic sur Prendre une photo | Photographier l’aliment | Message et ajout sans photo |
| Partage, avec `navigator.share` | Clic sur Partager la liste | Envoyer les noms et dates par le menu du téléphone | Annulation signalée ; API absente expliquée |

Le microphone n’est pas demandé. La caméra s’arrête après la capture, la fermeture, l’ajout ou le passage en arrière-plan.

Le bandeau Installer utilise la demande native ou explique les étapes Safari. Il disparaît dans l’application installée.

## 8. Notifications

`web-push` envoie les notifications ; le Service Worker traite `push` et `notificationclick`. La permission est demandée au clic sur **Activer les notifications**, avec un message en cas de refus. Sur iPhone, il faut utiliser l’app installée.

Netlify conserve l’abonnement. Une fonction vérifie les dates à 8 h UTC et envoie au maximum un rappel par jour si une date est atteinte. Le clic ouvre l’app. Les boutons permettent de tester ou désactiver les rappels. Un vrai push envoyé depuis Netlify a été reçu dans Chrome.

## 9. Visibilité : SEO et agents IA

Titres, formulaire et exemples figurent dans le HTML initial. Les aliments personnels viennent d’IndexedDB et restent absents du HTML public.

La page contient titre, description, canonical, Open Graph et JSON-LD `WebApplication`. `robots.txt` indique un choix explicite pour les sept agents IA du cours : accès au contenu public, API exclue. `sitemap.xml` référence l’accueil avec la date du build. `llms.txt` et le HTML renvoient aussi à `presentation.md`, une présentation Markdown ; elle est en `noindex` pour éviter un doublon dans les résultats de recherche. Le build utilise `SITE_URL` ou l’URL Netlify.

## 10. Sécurité et vie privée

Les données passent en HTTPS. Un identifiant aléatoire sépare les appareils. Le serveur valide les champs et photos ; les noms sont affichés avec `textContent`. Aucun outil de suivi n’est ajouté. La clé privée VAPID reste dans les variables serveur et `.env`, ignoré par Git ; le navigateur reçoit seulement la clé publique. Désactiver les push supprime l’abonnement serveur.

CSP, HSTS, nosniff, Referrer-Policy, X-Frame-Options et Permissions-Policy sont définis dans `netlify.toml`. Le badge Netlify est désactivé pour supprimer ses erreurs CSP sans modifier cette politique.

## 11. Mesures et tests

Lighthouse 13.5, mode mobile, sur Netlify le 12 octobre 2026 :

| Mesure | Résultat |
|---|---|
| Performance / Accessibilité / Bonnes pratiques / SEO | 98 / 100 / 100 / 100 |
| LCP / CLS / TBT | 1,0 s / 0 / 0 ms |

L’INP en conditions réelles n’a pas été mesuré. La place du statut réseau et de la liste est réservée pour éviter les décalages. Aucune erreur de console n’a été relevée.

Les 12 tests unitaires et les scénarios navigateur couvrent l’API, le hors ligne, les photos, la synchronisation, les erreurs, les mises à jour et les bonus. Le partage est simulé ; les conflits et push sont vérifiés sur Netlify. Background Sync fonctionne dans le test avec l’onglet fermé. Les trois fichiers de visibilité répondent `200`. L’installation, la caméra et le mode avion avec reconnexion ont aussi été testés sur iPhone. Détails dans `VALIDATION.md`.

## 12. Limites et suite

La première visite nécessite une connexion. Sans Background Sync, la page doit être ouverte pour envoyer. Effacer le stockage fait perdre la liste ; il n’y a pas de restauration sur un autre appareil. Firefox n’a pas démarré dans les tests. Les bonus restent à essayer sur iPhone et le rappel quotidien reste à observer. Il utilise les données synchronisées. La fiche du Hub reste à déposer.
