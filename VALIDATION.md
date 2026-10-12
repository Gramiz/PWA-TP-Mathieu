# Vide-frigo — Tests

Vérifications du 12 octobre 2026.

Application : https://vide-frigo-mathieu-tp.netlify.app
Dépôt : https://github.com/Gramiz/PWA-TP-Mathieu

## Tests sur iPhone

L’installation, la caméra et le mode avion avec reconnexion ont été testés sur iPhone. Ces essais ont été faits sur le téléphone ; les tests ci-dessous utilisent un navigateur automatisé.

## Tests automatisés

| Vérification | Résultat |
|---|---|
| API : création, doublons, suppression, séparation des appareils, validation des données et erreurs | 5 tests réussis |
| Manifest et icônes | Aucun problème relevé ; tailles 192×192 et 512×512 |
| Ouverture et rechargement hors ligne | Interface et aliments accessibles |
| Fermeture puis réouverture hors ligne | Aliments conservés |
| Ajout avec photo hors ligne, puis reconnexion | Aliment et photo reçus dans Netlify Blobs |
| Suppression hors ligne, puis reconnexion | Aliment supprimé du serveur |
| Refus caméra simulé | Message affiché ; ajout sans photo possible |
| Serveur indisponible, réponse HTTP 503 | Action conservée dans la file, puis renvoyée |
| Background Sync, événement déclenché avec l’onglet fermé | Envoi effectué et file vidée |
| Nouvelle version après un déploiement Netlify | Bannière affichée, caches remplacés, données conservées |
| Navigation inconnue hors ligne | Page de secours affichée |
| HTML initial et fichiers de visibilité | Contenu public présent ; fichiers accessibles en HTTP 200 |
| Largeurs 320, 390 et 1200 px | Aucun débordement horizontal |
| Bandeau d’installation | Instructions iPhone au clic, fermeture possible et masquage dans l’app installée |

La caméra et la demande native d’installation sont simulées dans les tests automatisés. Le test Background Sync vérifie le traitement de l’événement ; il ne mesure pas le délai choisi par le navigateur.

## Lighthouse

Mesure en mode mobile sur le site Netlify, avec Lighthouse 13.5 :

| Mesure | Résultat |
|---|---|
| Performance | 100 |
| Accessibilité | 100 |
| Bonnes pratiques | 100 |
| SEO | 100 |
| LCP | 1,0 s |
| CLS | 0 |
| TBT | 0 ms |
| Erreurs de console | Aucune |

Les déplacements au chargement ont été corrigés en réservant la place du statut réseau et de la liste. Le badge Netlify a été désactivé dans les réglages du projet pour supprimer ses erreurs CSP. Les en-têtes de sécurité ont été conservés.

Les scores proviennent d’un test Lighthouse. L’INP en usage réel n’a pas été mesuré. Le navigateur automatisé Firefox n’a pas pu démarrer sur cette machine.

## Relancer les tests

```bash
npm test
npm run test:browser
node tests/sync-engines.mjs
TEST_URL=https://vide-frigo-mathieu-tp.netlify.app node tests/production.mjs
```

Le serveur local doit être lancé pour les tests locaux. `tests/update-production.mjs` permet de tester une mise à jour pendant un nouveau déploiement. Les rapports et captures sont dans `test-results/`, ignoré par Git. Les aliments créés pendant les tests sont des exemples, pas les données du frigo personnel.

## Rendu

Le code, le README, le document technique et l’application déployée sont disponibles. La fiche du Class Hub reste à remplir.
