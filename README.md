# Vide-frigo

TP Progressive Web Apps — HTML, CSS et JavaScript, **sans framework**.

URL Netlify : **https://vide-frigo-mathieu-tp.netlify.app**.
Dépôt public : **https://github.com/Gramiz/PWA-TP-Mathieu**.

La version publique a été testée avec création et photo hors ligne, rechargement, synchronisation réelle vers Netlify Blobs et suppression.
La mise à jour a aussi été validée entre deux déploiements Netlify, avec bannière et conservation des données sans effacement manuel du cache.

Ajouter un aliment (nom, date limite, photo caméra facultative), consulter les dates les plus proches en premier et supprimer un aliment consommé. Installation, fonctionnement hors ligne, synchronisation vers un serveur et mise à jour proposée.

## Lancer en local

Node.js 22 ou plus et npm sont nécessaires.

```bash
npm ci
npm run dev
```

Ouvrir **http://localhost:8888**. Le serveur Node local utilise le même gestionnaire d’API que Netlify et conserve les données reçues dans `.local-data/` (ignoré par Git). `localhost` autorise Service Worker et caméra sans HTTPS. Une adresse IP en HTTP sur le réseau local ne suffit pas pour ces APIs : utiliser la version Netlify HTTPS sur téléphone.

Après une modification : `npm run build`, puis recharger. Si le Service Worker affiche une bannière, cliquer sur **Mettre à jour**. Les noms des caches sont générés à partir du contenu des fichiers.

## Vérifier

```bash
npm test
# Avec le serveur local lancé dans un autre terminal :
npm run test:browser
# Handler Background Sync, onglet fermé :
node tests/sync-engines.mjs
```

Les tests navigateur utilisent Google Chrome sur macOS par défaut. Pour un autre système, définir `CHROME_PATH` avec le chemin de Chrome ou Chromium. La caméra est **simulée**, pas la caméra personnelle. Ces tests couvrent le hors ligne, la persistance, la synchronisation HTTP, les photos, les erreurs serveur, le refus caméra, la suppression et la mise à jour. Les sorties se trouvent dans `test-results/`, ignoré par Git.

Pour tenter également le repli sur Firefox : `npx playwright install firefox`, puis `TEST_FIREFOX=1 node tests/sync-engines.mjs`. Le navigateur automatisé Firefox n’a pas pu démarrer sur la machine de développement ; ce test ne vaut pas une validation déjà obtenue.

Pour mesurer en mobile avec Lighthouse :

```bash
npx lighthouse http://localhost:8888 --only-categories=performance,accessibility,best-practices,seo --view
```

## Déployer sur Netlify

**Ne pas déposer seulement `dist/` par glisser-déposer** : la synchronisation nécessite aussi la fonction serveur et Netlify Blobs.

### Depuis un dépôt Git public (recommandé pour le rendu)

1. Publier ce projet dans un dépôt public GitHub ou GitLab.
2. Dans Netlify, importer ce dépôt comme nouveau projet. La configuration `netlify.toml` définit déjà `npm run build`, `dist/` et `netlify/functions/`.
3. Déployer, puis ouvrir l’URL HTTPS sur téléphone. Netlify fournit `URL` pendant le build : canonical, Open Graph, sitemap et llms.txt utilisent cette URL.
4. Si un domaine personnalisé est utilisé, définir `SITE_URL` dans les variables de build et redéployer.

### Avec le CLI

```bash
npx netlify login
npx netlify sites:create
```

Suivre le dialogue pour créer et lier le projet. Si nécessaire, lancer `npx netlify link`.

```bash
# Remplacer cette URL par celle du projet Netlify créé :
SITE_URL=https://votre-projet.netlify.app npm run build
npx netlify deploy --prod --no-build
```

La fonction `foods.mjs` écrit dans un store Netlify Blobs **lié au site**, avec lectures cohérentes et région `eu-central-1`. Les données persistent entre déploiements. Aucun secret de compte Netlify ne doit être placé dans le code client. L’API ne nécessite pas de base externe.

## Validation sur l’URL publiée

- DevTools → Application : manifest valide, icônes, Service Worker actif, IndexedDB.
- Installer depuis Chrome Android ou via Partager → Sur l’écran d’accueil dans Safari iPhone.
- Charger une fois en ligne, passer en mode avion et relancer : interface et aliments disponibles. Ajouter un aliment, éventuellement avec photo, et supprimer une entrée. Revenir en ligne : les actions en attente partent au serveur.
- Hors ligne, ouvrir une URL inconnue : page de secours avec retour au frigo.
- Refuser l’accès caméra : message compréhensible ; ajout sans photo toujours possible.
- Modifier du contenu et redéployer : bannière, bouton Mettre à jour, nouvelle version sans effacement manuel du cache.
- Sur les navigateurs sans Background Sync, rouvrir l’app ou la garder ouverte lors de la reconnexion.

```bash
curl -s https://votre-projet.netlify.app/
curl -I https://votre-projet.netlify.app/robots.txt
curl -I https://votre-projet.netlify.app/sitemap.xml
curl -I https://votre-projet.netlify.app/llms.txt
```

Le HTML doit contenir la titres, le formulaire et les exemples ; les trois fichiers doivent répondre `200`.

## Livrables et périmètre

- [Document technique](DOC-TECHNIQUE.md) : architecture, choix, mesures et limites.
- [Résultats de validation](VALIDATION.md) : acquis locaux et vérifications restant à effectuer.
- Dépôt public : https://github.com/Gramiz/PWA-TP-Mathieu.
- Class Hub : déclarer nom, URL, dépôt, description et capacité **caméra**.

Pas de notifications push, deuxième capacité, résolution de conflits, compte utilisateur, recettes ou scanner. Les données sont propres à cet appareil : le serveur reçoit une copie, sans proposer de restauration multi-appareil.

## Mettre à jour le dépôt public

Le dépôt public est configuré sur `main`. Pour publier de nouvelles modifications depuis ce dossier :

```bash
git add .
git commit -m "Mise à jour de Vide-frigo"
git push
```

Le `.gitignore` exclut dépendances, build, données locales, configuration Netlify locale et résultats temporaires. Les livrables sont prêts à être déclarés sur le Class Hub.

## Structure

```text
public/                HTML, CSS, modules JS, SW, manifest, icônes, visibilité
netlify/functions/     API Netlify
netlify/lib/api.js     Validation et stockage, communs au local et à Netlify
scripts/               Build et serveur local sans framework
tests/                 API et scénarios PWA dans Chromium
netlify.toml           Déploiement, route API et en-têtes
```
