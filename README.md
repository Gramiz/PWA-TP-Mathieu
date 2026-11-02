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

## TD Android A0 : Vide-frigo en TWA

Le dossier `twa/` contient le projet Android généré avec Bubblewrap 1.13.2 depuis le manifest de Vide-frigo. Le package est `app.netlify.vide_frigo_mathieu_tp.twa`. L’icône, le nom et les couleurs viennent du manifest. L’app affiche la PWA dans Chrome, sans barre d’adresse quand l’association du domaine est vérifiée.

Le minimum Android est API 26 ; le projet Bubblewrap compile et cible API 36. A0 a été testé le 2 novembre 2026 sur l’émulateur Android API 36.1 disponible sur la machine. Le minimum par défaut du générateur (21) a été relevé pour être compatible avec Android Browser Helper 2.7.4 ; les dépôts Gradle utilisent Google et Maven Central.

La clé de signature et les mots de passe sont dans `twa/.secrets/`, ignoré par Git. Il faut sauvegarder ce dossier dans un emplacement privé : la même clé est nécessaire pour mettre l’APK à jour. Ne pas publier `signing.env` ou `android.keystore`.

Pour reconstruire sur cette machine, après installation de Bubblewrap :

```bash
npm install -g @bubblewrap/cli@1.13.2
cd twa
set -a
. ./.secrets/signing.env
set +a
bubblewrap build --config=.local/bubblewrap.json
```

`.local/bubblewrap.json` contient les chemins du JDK et du SDK de cette machine ; ce dossier est également ignoré par Git. Sur une autre machine, configurer Bubblewrap avec son JDK et son SDK Android. Les sorties locales sont `twa/app-release-signed.apk` et `twa/app-release-bundle.aab` ; elles ne sont pas commitées.

Installation et contrôle, avec ADB accessible dans le terminal :

```bash
adb install -r app-release-signed.apk
adb shell pm verify-app-links --re-verify app.netlify.vide_frigo_mathieu_tp.twa
adb shell pm get-app-links app.netlify.vide_frigo_mathieu_tp.twa
```

L’association est publiée dans `public/.well-known/assetlinks.json` et servie par Netlify en HTTPS, HTTP 200, `application/json`, sans redirection. La signature de l’APK correspond à cette empreinte. Android renvoie `verified`, le vérificateur Google Digital Asset Links renvoie `linked: true` et Vide-frigo s’ouvre sans barre d’adresse dans l’émulateur. Le contrôle automatique PWA Quality Criteria intégré à Bubblewrap n’a pas pu s’exécuter ; ces vérifications ont été réalisées séparément.

A0 est terminé. Le projet natif des TD suivants est dans `android/`.

## TD Android A1 : Carnet

Le dossier `android/` reprend le starter du professeur : même package `corsica.universita.carnet`, thème, dépendances, configuration Firebase et clé debug du cours. Il servira aussi aux TD suivants. Les versions du catalogue Gradle et les SDK 26 → 37 sont conservés.

A1 ajoute `data/Note.kt`, le formulaire et la liste dans `NotesListScreen.kt`, ainsi que les textes et pluriels dans `strings.xml`. On peut ajouter et supprimer des notes ; leur date de création et le compteur s’affichent. Un texte vide ou composé d’espaces ne peut pas être ajouté.

À l’étape A1, les notes utilisaient `remember { mutableStateListOf<Note>() }` et le brouillon utilisait `rememberSaveable`. À la rotation, la liste redevient donc vide et le brouillon reste. Il n’y a ni ViewModel ni Room à cette étape.

Pour compiler puis installer, depuis `android/` :

```bash
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`local.properties` indique le chemin du SDK de la machine et reste hors Git. La clé `android/debug.keystore` est celle du starter, conservée localement. Pour reconstruire depuis un clone, recopier la clé fournie par le professeur à cet emplacement ; ne pas générer une autre clé.

Dans Android Studio, ouvrir `android/`. Pour le contrôle demandé par le cours, lancer Layout Inspector sur Carnet et retrouver `Scaffold`, `Column`, `Row` et la liste. Le starter demande une version récente d’Android Studio compatible avec AGP 9.4.1.

Vérifié dans l’émulateur Android API 36.1 : ajout de trois notes, compteur, suppression, bouton désactivé pour une saisie blanche, brouillon conservé après rotation et liste remise à zéro. Les deux échecs du cours ont aussi été reproduits avec des variantes temporaires : liste ordinaire non observable, puis brouillon en `remember` perdu à la rotation. La version A1 corrigée est disponible dans le commit `a800e34` ; le dossier `android/` évolue avec les TD suivants. Les captures locales sont dans `test-results/` ; la vérification visuelle de l’arbre dans Layout Inspector reste à faire dans Android Studio.

## TD Android A2 : cycle de vie

`NotesViewModel` porte désormais la liste dans un `StateFlow<List<Note>>`. Chaque note a un identifiant `Long`. L’écran collecte la liste et le brouillon avec `collectAsStateWithLifecycle` ; les ajouts et suppressions passent par le ViewModel. La liste n’est plus stockée dans le composable.

Le brouillon est enregistré dans un `SavedStateHandle`. La liste et le brouillon survivent à une rotation ; après une mort du process en arrière-plan, seul le brouillon est restauré. La liste vide est attendue : le stockage disque arrive au TD A4.

`MainActivity` écrit les événements de son cycle de vie dans Logcat avec le tag `Carnet` et un identifiant d’instance. Le ViewModel trace aussi sa création, pour vérifier qu’une rotation ne le recrée pas.

```bash
adb logcat -s Carnet
# Mettre l’app en arrière-plan avant cette commande :
adb shell am kill corsica.universita.carnet
# Revenir par les applications récentes, sans forcer l’arrêt ni retirer la tâche.
```

L’option « Ne pas conserver les activités » se trouve dans les options développeur d’Android. Elle détruit l’Activity quand on la quitte ; elle ne simule pas à elle seule la mort du process. La désactiver après l’essai.

Contrôles A2 réalisés dans l’émulateur API 36.1 : ajout et suppression par identifiant, liste et brouillon conservés à la rotation, deux instances d’Activity et une seule création du ViewModel dans Logcat. Une variante temporaire sans sauvegarde a montré la perte du brouillon à la mort du process. Avec la version finale, `am kill` a arrêté le process ; au retour, le PID a changé, le brouillon a été restauré et la liste était vide. L’interrupteur réel « Ne pas conserver les activités » a aussi été testé, puis désactivé, avec rétablissement des réglages initiaux. Les traces et captures restent dans `test-results/`, hors Git.

## TD Android A3 : Intents et App Links

Chaque note a une action Partager (`ACTION_SEND`, `text/plain`) qui ouvre le sélecteur Android. Carnet accepte aussi le texte partagé par une autre application et le place dans le brouillon. `MainActivity` traite les Intents au premier lancement et dans `onNewIntent`, avec `launchMode="singleTop"`. Une rotation ne réapplique pas le texte de l’Intent initial au brouillon déjà modifié.

Le bouton « Ouvrir ma PWA » ouvre Vide-frigo dans un navigateur. Le sélecteur `CATEGORY_APP_BROWSER` évite que l’App Link renvoie immédiatement dans Carnet.

Dans `android/local.properties`, ajouter :

```properties
PWA_HOST=vide-frigo-mathieu-tp.netlify.app
```

Ce fichier reste local. Le manifest utilise `${pwaHost}` dans un filtre `VIEW` HTTPS avec `autoVerify`. `assetlinks.json` conserve l’entrée de la TWA et ajoute celle de `corsica.universita.carnet` avec l’empreinte SHA-256 réelle de la clé debug du cours. Le nom de package et l’empreinte doivent correspondre à l’APK installé.

Après compilation, installation et publication du fichier :

```bash
adb shell pm verify-app-links --re-verify corsica.universita.carnet
adb shell pm get-app-links corsica.universita.carnet
adb shell am start -a android.intent.action.VIEW -d https://vide-frigo-mathieu-tp.netlify.app/
```

Un lien vers Vide-frigo doit ouvrir Carnet et remplir son brouillon avec l’URL. Le bouton d’ouverture de la PWA permet de retourner au site dans le navigateur.

A3 vérifié dans l’émulateur API 36.1 : réception `ACTION_SEND` au démarrage et dans l’Activity déjà ouverte, partage d’une note via le sélecteur Android vers Carnet, partage réel depuis Chrome vers Carnet, et bouton d’ouverture du site dans Chrome sans boucle vers l’app. Le brouillon modifié survit à la rotation sans rejouer l’Intent d’origine. Un lien HTTPS implicite ouvre Carnet à chaud et à froid et préremplit le brouillon ; Android indique `verified`. Google Digital Asset Links confirme les associations de Carnet et de la TWA. `assembleDebug` et `lintDebug` réussissent ; les versions du starter sont conservées.

Chrome peut partager dans une tâche Android distincte : elle a alors son propre ViewModel. Les notes restent en mémoire dans leur tâche d’origine jusqu’au stockage disque prévu en A4. Les captures et les traces des essais sont dans `test-results/`, ignoré par Git.
