# Validation du TP Vide-frigo

Dernière vérification : 12 octobre 2026.
URL publique : https://vide-frigo-mathieu-tp.netlify.app
Dépôt public : https://github.com/Gramiz/PWA-TP-Mathieu

## Fonctionnalités vérifiées

- [x] HTTPS public et affichage mobile.
- [x] Manifest sans erreur, icônes 192×192 et 512×512, standalone et couleurs.
- [x] Installation et caméra réelle sur iPhone : confirmées par l’auteur.
- [x] Mode avion, réouverture, ajout/suppression et reconnexion sur iPhone : confirmés par l’auteur. Ces confirmations sont distinctes des tests automatisés.
- [x] Chromium : interface et données hors ligne, tri et persistance après fermeture/réouverture.
- [x] Page de secours sur une navigation inconnue hors ligne.
- [x] Outbox et repli online : aliment avec photo créé hors ligne, conservé après rechargement, puis reçu dans Netlify Blobs réel. Suppression synchronisée et isolation par appareil vérifiées.
- [x] Background Sync Chromium : événement déclenché via DevTools avec l’onglet fermé ; réception serveur et file vidée. Le navigateur décide du moment d’exécution automatique.
- [x] Photo simulée : capture, compression, arrêt du flux et réception serveur ; refus caméra simulé sans bloquer l’ajout.
- [x] HTTP 503 : actions conservées et nouvel envoi au lancement.
- [x] Redéploiement réel : bannière, activation du nouveau SW, nettoyage des caches et conservation des données sans effacement manuel.
- [x] Contenu public dans le HTML initial ; robots.txt, sitemap.xml et llms.txt répondent 200. Canonical, titre, description, Open Graph et JSON-LD présents.
- [x] README de lancement et document technique liés dans le dépôt public.
- [ ] Déclaration sur le Class Hub : prise en charge par l’auteur.

## Correction du chargement et du widget Netlify

L’ancien audit mesurait un CLS de 0,244 et des erreurs CSP du widget Netlify. Le bandeau d’installation a ensuite supprimé le gros décalage de l’en-tête ; la mesure avant la présente correction était de 0,019. L’espace réservé au statut réseau et à la liste supprime les petits déplacements restants.

Le badge est désactivé via Project configuration → General → Powered by Netlify badge. La modification concerne ce projet seulement ; la CSP stricte est conservée.

Lighthouse 13.5 mobile **sur la production après correction** :

| Mesure | Résultat |
|---|---|
| Performance | 100 |
| Accessibilité | 100 |
| Bonnes pratiques | 100 |
| SEO | 100 |
| LCP | 1,0 s |
| CLS | 0 |
| TBT | 0 ms |
| Erreurs console / CSP | Aucune |

Ces résultats sont des mesures de laboratoire, sans revendication d’INP terrain. Connexion lente et CPU ralenti : mise en page stable. Pas de débordement à 320, 390 et 1200 px. Le test de production avec photo hors ligne et synchronisation Blobs passe après redéploiement.

## Limites et preuves

Le navigateur automatisé Firefox ne démarre pas sur cette machine ; il n’est pas présenté comme testé. L’installation et les essais caméra sur iPhone sont déclarés par l’auteur. La publication Hub n’a pas été effectuée par l’agent.

Tests reproductibles : `npm test`, `npm run test:browser`, `node tests/sync-engines.mjs` et `TEST_URL=https://vide-frigo-mathieu-tp.netlify.app node tests/production.mjs`. Le test de mise à jour s’exécute avec `tests/update-production.mjs` pendant un nouveau déploiement. Rapports et captures : `test-results/`, ignoré par Git. Les données de test sont synthétiques.
