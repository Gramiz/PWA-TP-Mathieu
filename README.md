# Vide-frigo

Projet réalisé pour le TP Progressive Web Apps, en HTML, CSS et JavaScript, sans framework.

- Application : https://vide-frigo-mathieu-tp.netlify.app
- Dépôt : https://github.com/Gramiz/PWA-TP-Mathieu
- [Document technique](DOC-TECHNIQUE.md)

On peut ajouter un aliment avec sa date limite, prendre une photo facultative, le modifier et le supprimer. La liste est triée par date limite. Les ajouts et suppressions fonctionnent hors ligne et sont envoyés au serveur à la reconnexion.

## Lancer le projet

Il faut Node.js 22 ou plus et npm.

```bash
npm ci
npm run dev
```

Ouvrir http://localhost:8888.

Le serveur local conserve les données reçues dans `.local-data/`. Ce dossier n’est pas publié sur GitHub. Pour tester sur téléphone, utiliser l’URL HTTPS de Netlify : une adresse IP locale en HTTP ne permet pas d’utiliser toutes les APIs PWA.

Après une modification, lancer `npm run build`, puis recharger la page. Si une nouvelle version est proposée, cliquer sur **Mettre à jour**.

## Installer l’application

Le bandeau **Installer** ouvre la demande du navigateur quand elle est disponible. Sur iPhone, ouvrir le site dans Safari, puis choisir **Partager → Sur l’écran d’accueil → Ajouter**. Le bandeau rappelle ces étapes.

## Bonus

- **Partager la liste** ouvre le menu natif du téléphone avec les noms et les dates. L’annulation ou l’absence de l’API est indiquée.
- **Activer les notifications** permet de recevoir un rappel le matin pour les dates atteintes. Sur iPhone, utiliser l’app installée. Le bouton **Tester une notification** envoie un vrai push depuis Netlify. Les rappels peuvent être désactivés.
- **Modifier** permet de changer un aliment. Si deux onglets modifient la même version hors ligne, le serveur refuse la seconde écriture avec `412`. L’app propose de garder la version locale ou celle du serveur.

Les rappels sont planifiés à 8 h UTC, soit 9 h en hiver et 10 h en été à Paris. Ils utilisent les données déjà reçues par le serveur.

## Tests

```bash
npm test
```

Avec le serveur local lancé dans un autre terminal :

```bash
npm run test:browser
node tests/sync-engines.mjs
node tests/bonuses.mjs
```

Les tests navigateur utilisent Google Chrome sur macOS. Sur un autre système, définir `CHROME_PATH` avec le chemin de Chrome ou Chromium. La caméra est simulée pendant ces tests.

Pour vérifier le site publié :

```bash
TEST_URL=https://vide-frigo-mathieu-tp.netlify.app node tests/production.mjs
```

L’installation, la caméra et le mode avion ont aussi été testés sur iPhone. Le test automatisé Firefox n’a pas pu démarrer sur la machine de développement.

Lighthouse mobile sur Netlify, le 12 octobre 2026 : **98** en performance et **100** en accessibilité, bonnes pratiques et SEO ; **CLS : 0**. Les rapports locaux sont dans `test-results/`, qui est ignoré par Git.

## Déployer sur Netlify

Le projet utilise des fichiers statiques, des fonctions serveur et Netlify Blobs. Déposer uniquement `dist/` par glisser-déposer ne suffit donc pas.

Pour republier sur le projet Netlify existant :

```bash
npx netlify login
npx netlify link
SITE_URL=https://vide-frigo-mathieu-tp.netlify.app npm run build
npx netlify deploy --prod --no-build
```

Il faut avoir accès au projet Netlify. Pour créer son propre site, utiliser `npx netlify sites:create` et remplacer `SITE_URL` par sa nouvelle URL. On peut aussi importer le dépôt dans Netlify ; `netlify.toml` indique la commande de build et les dossiers à publier.

Pour les push, configurer les clés serveur une seule fois : `node scripts/configure-push.mjs`, après connexion du CLI Netlify. Cette commande conserve les clés existantes et n’affiche pas la clé privée. Les variables `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` sont nécessaires aux fonctions. Le fichier `.env` est ignoré par Git.

Les données sont conservées dans Netlify Blobs et restent présentes entre les déploiements. Le badge Netlify a été désactivé dans les réglages du projet, car il provoquait des erreurs avec la CSP.

## Vérifier le contenu public

```bash
curl -s https://vide-frigo-mathieu-tp.netlify.app/
curl -I https://vide-frigo-mathieu-tp.netlify.app/robots.txt
curl -I https://vide-frigo-mathieu-tp.netlify.app/sitemap.xml
curl -I https://vide-frigo-mathieu-tp.netlify.app/llms.txt
curl -I https://vide-frigo-mathieu-tp.netlify.app/presentation.md
```

Le HTML contient les titres, le formulaire et les exemples. Les fichiers répondent `200`. Le HTML lie aussi une présentation Markdown ; le sitemap indique la date du build et robots.txt précise les règles des sept agents IA du cours. Les aliments personnels ne sont pas dans le contenu public.

## Fichiers du projet

```text
public/                Interface, Service Worker, manifest et fichiers SEO
netlify/functions/     Fonction serveur
netlify/lib/api.js     Code d’API commun au serveur local et à Netlify
scripts/               Build et serveur local
tests/                Tests de l’API et de la PWA
netlify.toml           Configuration Netlify et en-têtes de sécurité
```

La version actuelle ne propose pas de compte, de recettes ou de scanner. Les données appartiennent à cet appareil ; elles ne sont pas récupérées automatiquement sur un autre téléphone.

Il reste à déclarer l’URL, le dépôt, la description et les capacités **caméra et partage**, ainsi que les bonus **push et conflits** sur le Class Hub.
