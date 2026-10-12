# Validation du TP Vide-frigo

Date : 11 octobre 2026. Aucun résultat de production ou téléphone réel n’est supposé.

## Réalisé et vérifié localement

- Build sans framework ; bibliothèques `idb` et `@netlify/blobs` ; aucune vulnérabilité dans les dépendances de production au contrôle npm.
- Cinq tests API : création persistée, rejeu idempotent, suppression, isolation par appareil, validation d’entrées et refus d’origine étrangère, échec du stockage sans faux succès.
- Chromium : Service Worker actif, ouverture et rechargement hors ligne, ajout hors ligne, tri, données conservées après fermeture/réouverture.
- Navigation inconnue hors ligne : page de secours et retour au frigo.
- Reconnexion : file vidée et entrées reçues au serveur local (vérification par GET authentifié).
- Background Sync Chromium : événement déclenché via DevTools avec l’onglet de l’application fermé ; entrée reçue au serveur et outbox vidée. Cela vérifie le handler, sans promettre un délai automatique du navigateur.
- Caméra simulée : capture, compression JPEG, photo locale et reçue au serveur, arrêt du flux.
- Refus caméra simulé : message et ajout sans photo.
- HTTP 503 en restant connecté : file conservée et envoi à la réouverture.
- Suppression hors ligne puis reçue au serveur.
- Nouveau build : bannière de mise à jour, activation après clic, ancien cache supprimé, données conservées.
- Mise en page desktop et mobile 390 px ; absence de débordement horizontal et d’erreur JavaScript.
- Lighthouse 13.5 mobile local : performance 99, accessibilité 100, bonnes pratiques 100, SEO 100. LCP 1,7 s ; CLS 0,059 ; TBT 0 ms. L’INP nécessite des mesures terrain et n’est pas déduit du TBT.
- `curl` local : contenu public présent ; robots.txt, sitemap.xml, llms.txt, manifest et deux icônes répondent 200.
- `netlify build --offline` : build et packaging de la fonction `foods.mjs` réussis.

Le test Firefox automatisé n’a pas pu démarrer son profil de navigateur sur cette machine. Le SW est produit au format classique et le repli online est vérifié sous Chromium ; le scénario sur Firefox/Safari reste à effectuer sur un navigateur réel.

## Vérifié sur Netlify

URL publique : https://vide-frigo-mathieu-tp.netlify.app (publication du 11 octobre 2026).

- Accès HTTPS sans connexion Netlify : 200.
- HTML initial : titres, formulaire, exemples et URLs absolues de production présents, y compris après le retrait des paragraphes explicatifs.
- robots.txt, sitemap.xml, llms.txt, manifest et icônes : 200.
- En-tête Content-Security-Policy présent.
- Chromium mobile simulé : interface rechargée hors ligne ; ajout avec photo JPEG capturée par caméra simulée ; données conservées après rechargement.
- Reconnexion : outbox vidée après acquittement ; aliment et photo retrouvés par GET dans le stockage Netlify Blobs réel.
- Un autre identifiant d’appareil ne peut pas lire cette entrée.
- Suppression hors ligne puis reconnexion : entrée supprimée du serveur (404), sans erreur JavaScript.
- Deuxième déploiement réel : session déjà ouverte, bannière reçue, clic Mettre à jour, nouveau cache actif et ancien supprimé ; aliment local et copie Blobs conservés. Aucun effacement manuel du cache.

Commande reproductible : `TEST_URL=https://vide-frigo-mathieu-tp.netlify.app node tests/production.mjs`. Les données de test sont synthétiques et supprimées après vérification.

## Audit de conformité après épuration de l’interface

Bandeau d’installation ajouté ensuite : visible sur mobile, instructions Safari au clic sur Installer, fermeture conservée dans la session, masqué en standalone et demande native simulée vérifiés. Publication confirmée sur Netlify. Il ne remplace pas le test d’installation sur un vrai téléphone.

- Tests API : 5/5 ; scénario de production avec photo hors ligne, rechargement, réception Blobs et suppression : réussi.
- Manifest : aucune erreur de parsing ; icônes vérifiées à 192×192 et 512×512. Le diagnostic Chrome dans un profil normal ne signale aucune erreur d’installabilité. Cela ne remplace pas l’installation sur téléphone.
- HTML demandé avec User-Agent GPTBot : 200 et exemples publics présents. La suppression des paragraphes ne supprime donc pas le contenu public du HTML initial.
- Page de secours testée sur Netlify avec réseau coupé : affichée pour une navigation inconnue.
- **Nouvelles mesures de production**, distinctes des anciennes mesures locales : performance **87**, accessibilité **100**, bonnes pratiques **92**, SEO **100** ; LCP **1,1 s**, CLS **0,244**, TBT **0 ms**.
- **Point à corriger** : le CLS dépasse le seuil recommandé de 0,1. Lighthouse identifie le déplacement de `main` ; la cause exacte du décalage reste à isoler.
- Des styles et scripts inline dans un document `about:srcdoc` du widget Netlify sont bloqués par la CSP. La CSP du projet n’a pas été affaiblie pour masquer ces erreurs.
- Dépôt public : https://github.com/Gramiz/PWA-TP-Mathieu ; URL renseignée dans le README et le document technique.
- Installation réelle, caméra sur téléphone, repli Safari/Firefox et dépôt sur le Class Hub : restent à effectuer.

## À vérifier avant de rendre

- [x] Authentification Netlify, déploiement HTTPS public et stockage Blobs réels.
- [x] Dépôt public ; URLs renseignées dans le README et le document technique.
- [ ] Manifest sans erreur dans DevTools et installation réelle sur téléphone.
- [ ] Caméra réelle après clic, refus de permission et fonctionnement en mode avion.
- [ ] Background Sync sur Chromium, notamment onglet fermé ; repli online sur Safari/Firefox.
- [x] Redéploiement Netlify : nouvelle version proposée sans vider le cache.
- [x] Requêtes HTTP sans authentification sur la production : contenu public HTML et réponses 200 des trois fichiers.
- [ ] Fiche du Class Hub : nom, URL, dépôt, description, caméra.

## Reproduire les preuves

`npm test`, `npm run test:browser`, Lighthouse et commandes `curl` du README. Les rapports et captures locaux sont dans `test-results/` et ne sont pas livrés comme résultats de production.
