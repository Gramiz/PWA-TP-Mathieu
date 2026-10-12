# Vide-frigo — Document technique

Mathieu ROBERT · 12 octobre 2026 · Version finale

Application : https://vide-frigo-mathieu-tp.netlify.app
Dépôt : https://github.com/Gramiz/PWA-TP-Mathieu

## 1. Présentation

Vide-frigo permet de noter les aliments de son frigo et leur date limite. L’application sert à retrouver ce qu’on a, même sans connexion. Les modifications sont enregistrées sur le téléphone avant leur envoi au serveur.

## 2. Contexte et objectifs

J’ai choisi ce sujet pour le TP PWA. On peut ajouter un aliment avec une photo facultative, consulter la liste par date limite et supprimer un aliment consommé. Je n’ai pas prévu de compte, de recettes, de scanner ou de partage entre appareils.

## 3. Architecture

J’ai choisi HTML, CSS et JavaScript sans framework pour travailler directement avec les APIs du cours. `idb` simplifie IndexedDB. Le Service Worker est écrit dans le projet ; esbuild regroupe son code dans un fichier classique.

```text
Page ↔ IndexedDB (aliments et actions en attente)
Page ↔ Service Worker ↔ Cache API (interface)
Page ou Service Worker → API Netlify → Netlify Blobs
```

Netlify héberge l’interface et la fonction `foods.mjs`. Netlify Blobs conserve les données entre les déploiements, en région européenne et avec des lectures cohérentes. En local, un serveur Node utilise la même API avec un stockage disque. Le build ajoute `idb`, les URLs et la version du cache ; le CLI Netlify publie le résultat.

## 4. Cache et hors ligne

| Ressource | Stratégie | Stockage | Raison |
|---|---|---|---|
| HTML | Cache First, versionné | Cache API | Ouvrir l’interface sans réseau et garder la même version que le JavaScript |
| CSS, JS, icônes et manifest | Cache First | Cache API | Charger les fichiers sans connexion ni CDN |
| Aliments et photos | Lecture et écriture locales | IndexedDB | Consulter et modifier la liste hors ligne |
| Requêtes API | Network Only | Serveur et outbox locale | Envoyer les actions sans mettre les réponses privées en cache |

Après une première ouverture en ligne, la liste reste accessible en mode avion. L’ajout et la suppression fonctionnent toujours ; un message indique l’envoi différé. Une navigation impossible vers une page non cachée affiche `offline.html`. La caméra ou le stockage indisponible sont signalés.

## 5. Mise à jour

La bannière **Mettre à jour** évite un rechargement pendant une saisie. Après le clic, le nouveau Service Worker reçoit `SKIP_WAITING` et la page se recharge à `controllerchange`. Le cache est versionné selon les fichiers ; les anciens caches sont supprimés à l’activation. `sw.js` n’est pas caché. Le fonctionnement a été testé entre deux déploiements Netlify.

## 6. Données et synchronisation

IndexedDB contient trois stores :

- `foods` : identifiant UUID, nom, date limite, photo et date de création.
- `outbox` : actions d’ajout ou de suppression, numérotées dans l’ordre.
- `meta` : identifiant d’appareil, dernier envoi et verrou temporaire de synchronisation.

L’aliment et son action sont enregistrés dans une même transaction. Il n’y a pas d’index ; la liste est triée en JavaScript. Les photos sont compressées en JPEG, limitées à 640 pixels et à 400 000 caractères encodés.

Les actions sont envoyées dans l’ordre et retirées après confirmation du serveur. En cas d’échec, elles restent en attente. L’envoi utilise Background Sync, avec un repli sur `online`, au lancement et au retour au premier plan. Un verrou évite deux envois simultanés.

Les UUID évitent les doublons et le serveur garde une trace des suppressions. Il n’y a pas de gestion des conflits : cette version ne propose ni édition d’un aliment ni frigo partagé.

## 7. Permissions et capacité de l’appareil

| Capacité | Déclenchement | Utilité | En cas de refus |
|---|---|---|---|
| Caméra, avec `getUserMedia` | Clic sur Prendre une photo | Photographier l’aliment | Message et ajout possible sans photo |

Le microphone n’est pas demandé. La caméra s’arrête après la capture, la fermeture, l’ajout ou le passage en arrière-plan.

Le bandeau Installer utilise la demande native ou explique les étapes Safari. Il disparaît dans l’application installée.

## 8. Notifications

Je n’ai pas ajouté de notifications. Elles sont facultatives dans le sujet et ne sont pas nécessaires pour cette version.

## 9. Visibilité : SEO et agents IA

Les titres, le formulaire et les exemples sont dans le HTML initial. Les aliments personnels viennent d’IndexedDB et ne sont pas publiés dans ce HTML.

La page contient titre, description, canonical, Open Graph et JSON-LD `WebApplication`. `robots.txt` autorise GPTBot et ClaudeBot à lire les pages publiques qui décrivent l’app, mais exclut l’API. `sitemap.xml` référence l’accueil ; `llms.txt` renvoie à cette page. Le build utilise `SITE_URL` ou l’URL Netlify.

## 10. Sécurité et vie privée

Nom, date et photo sont stockés sur l’appareil puis envoyés en HTTPS. Un identifiant aléatoire dans IndexedDB sépare les données des appareils. Le serveur vérifie les champs et les photos, sans fournir de liste publique. Les noms sont affichés avec `textContent`. Aucun secret Netlify ni outil de suivi n’est présent côté client.

CSP, HSTS, nosniff, Referrer-Policy, X-Frame-Options et Permissions-Policy sont définis dans `netlify.toml`. Le badge Netlify est désactivé pour supprimer ses erreurs CSP sans modifier cette politique.

## 11. Mesures et tests

Lighthouse 13.5, mode mobile, sur Netlify le 12 octobre 2026 :

| Mesure | Résultat |
|---|---|
| Performance / Accessibilité / Bonnes pratiques / SEO | 100 / 100 / 100 / 100 |
| LCP / CLS / TBT | 1,0 s / 0 / 0 ms |

L’INP en conditions réelles n’a pas été mesuré. La place du statut réseau et de la liste est réservée pour éviter les décalages. Aucune erreur de console n’a été relevée.

Les tests automatisés couvrent l’API, le hors ligne, les photos, la synchronisation, les erreurs et la mise à jour. Background Sync a été testé avec l’onglet fermé. Les vérifications HTTP confirment le contenu HTML et les trois fichiers en `200`. J’ai aussi testé l’installation, la caméra et le mode avion avec reconnexion sur iPhone. Voir `VALIDATION.md`.

## 12. Limites et suite

La première visite nécessite une connexion. Sans Background Sync, la page doit être ouverte pour terminer l’envoi. Effacer les données du site fait perdre la liste et l’identifiant d’appareil. Il n’y a pas de restauration serveur ou de partage entre appareils. Firefox n’a pas pu démarrer pendant les tests automatisés. La fiche du Hub reste à déposer. Une autre version pourrait ajouter la restauration des données.
