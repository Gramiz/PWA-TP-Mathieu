import { dbPromise, saveFood, deleteFood, updateFood, resolveConflict } from './db.js';
import { flushOutbox } from './sync.js';
import { setupShare, setShareFoods, setupPush } from './capabilities.js';

const $ = selector => document.querySelector(selector);
const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
let registration;
let syncError = false;
let syncing = false;
let photoData = null;
let stream = null;
let startingCamera = false;
let saving = false;
let editingFood = null;

const foodIcon = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 11h18l-2 16H9zM5 6h22v5H5zM12 18h8"/></svg>';
const deleteIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/></svg>';

function message(text, error = false) {
  $('#form-message').textContent = text;
  $('#form-message').classList.toggle('error', error);
}
function networkState() {
  const offline = !navigator.onLine;
  $('#network-status').textContent = offline ? 'Hors ligne' : syncError ? 'Serveur injoignable' : 'En ligne';
  $('#network-status').classList.toggle('offline', offline || syncError);
  $('#offline-notice').hidden = !offline;
}
function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
async function render() {
  const db = await dbPromise;
  const [foods, outbox, lastSync] = await Promise.all([db.getAll('foods'), db.getAll('outbox'), db.get('meta', 'lastSync')]);
  const pendingIds = new Set(outbox.map(item => item.food?.id ?? item.id));
  const conflicts = outbox.filter(item => item.conflictServer);
  const conflictingIds = new Set(conflicts.map(item => item.food?.id ?? item.id));
  foods.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  setShareFoods(foods);
  $('#food-count').textContent = String(foods.length);
  $('#empty-state').hidden = foods.length !== 0;
  const rows = foods.map(food => {
    const row = document.createElement('li'); row.className = 'food-item';
    if (food.photoData) {
      const img = document.createElement('img'); img.className = 'food-image'; img.src = food.photoData; img.alt = `Photo : ${food.name}`; img.width = 58; img.height = 58; row.append(img);
    } else {
      const icon = document.createElement('div'); icon.className = 'food-placeholder'; icon.innerHTML = foodIcon; row.append(icon);
    }
    const details = document.createElement('div'); details.className = 'food-details';
    const name = document.createElement('h3'); name.className = 'food-name'; name.textContent = food.name;
    const date = document.createElement('p'); date.className = 'food-date';
    const time = document.createElement('time'); time.dateTime = food.date; time.textContent = dateFormatter.format(new Date(`${food.date}T12:00:00`));
    const past = food.date < localToday(); date.classList.toggle('past', past);
    date.append(past ? 'Date dépassée · ' : food.date === localToday() ? 'Date limite aujourd’hui · ' : 'Date limite · ', time);
    details.append(name, date);
    if (pendingIds.has(food.id)) { const label = document.createElement('span'); label.className = 'pending-label'; label.textContent = conflictingIds.has(food.id) ? 'Conflit à résoudre' : 'En attente d’envoi'; details.append(label); }
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'text-button edit-food-button'; edit.textContent = 'Modifier'; edit.setAttribute('aria-label', `Modifier ${food.name}`); edit.disabled = conflictingIds.has(food.id); edit.addEventListener('click', () => beginEdit(food));
    const button = document.createElement('button'); button.className = 'delete-button'; button.type = 'button'; button.setAttribute('aria-label', `Supprimer ${food.name}`); button.innerHTML = deleteIcon;
    button.disabled = conflictingIds.has(food.id);
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { await deleteFood(food.id); if (editingFood?.id === food.id) resetEditor(); await render(); message(`${food.name} retiré du frigo.`); await sync(); }
      catch { message('La suppression n’a pas pu être enregistrée. Réessayez.', true); button.disabled = false; }
    });
    const actions = document.createElement('div'); actions.className = 'food-actions'; actions.append(edit, button);
    row.append(details, actions); return row;
  });
  $('#food-list').replaceChildren(...rows);
  $('#conflict-panel').hidden = !conflicts.length;
  $('#conflict-list').replaceChildren(...conflicts.map(item => {
    const block = document.createElement('div'); block.className = 'conflict-item';
    const title = document.createElement('h3'); title.textContent = item.food?.name || item.conflictServer.name || 'Aliment supprimé';
    const yours = document.createElement('p'); yours.textContent = item.type === 'delete' ? 'Votre choix : supprimer l’aliment.' : `Votre version : ${item.food.name}, ${item.food.date.split('-').reverse().join('/')}.`;
    const server = document.createElement('p'); server.textContent = item.conflictServer.deleted ? 'Sur le serveur : aliment supprimé.' : `Sur le serveur : ${item.conflictServer.name}, ${item.conflictServer.date.split('-').reverse().join('/')}.`;
    block.append(title, yours, server);
    for (const [keepLocal, label] of [[true, 'Garder ma version'], [false, 'Prendre celle du serveur']]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'button secondary small'; button.textContent = label;
      button.addEventListener('click', async () => {
        button.disabled = true;
        try { await resolveConflict(item.sequence, keepLocal); await render(); await sync(); }
        catch { message('Le choix n’a pas pu être enregistré. Réessayez.', true); button.disabled = false; }
      });
      block.append(button);
    }
    return block;
  }));
  const count = outbox.length;
  $('#sync-status').textContent = conflicts.length ? `${conflicts.length} conflit${conflicts.length > 1 ? 's' : ''} à résoudre ci-dessous.` : syncing ? `Envoi au serveur… ${count} action${count > 1 ? 's' : ''} restante${count > 1 ? 's' : ''}.` : count ? `${count} action${count > 1 ? 's' : ''} en attente${syncError ? ' — nouvel essai à la prochaine ouverture ou reconnexion.' : ' — envoi au retour du réseau.'}` : lastSync ? 'Toutes les actions ont été envoyées au serveur.' : 'Vos aliments sont enregistrés sur cet appareil.';
  networkState();
}
async function scheduleBackgroundSync() {
  if (!registration || !('sync' in registration)) return;
  try { await registration.sync.register('vide-frigo-outbox'); } catch { /* online/open fallback remains available */ }
}
async function sync() {
  if (syncing) return;
  await scheduleBackgroundSync();
  if (!navigator.onLine) { await render(); return; }
  syncing = true; await render();
  try { await flushOutbox(); syncError = false; }
  catch { syncError = true; }
  finally { syncing = false; await render(); }
}

$('#food-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (saving) return;
  const name = $('#food-name').value.trim();
  const date = $('#food-date').value;
  if (!name) { message('Indiquez le nom de l’aliment.', true); $('#food-name').focus(); return; }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { message('Indiquez une date valide.', true); return; }
  saving = true; $('#add-button').disabled = true;
  try {
    if (editingFood) await updateFood({ ...editingFood, name, date, photoData }, editingFood.version ?? 1);
    else await saveFood({ id: crypto.randomUUID(), name, date, photoData, createdAt: Date.now() });
    const wasEditing = !!editingFood; resetEditor();
    message(`${name} ${wasEditing ? 'modifié' : 'ajouté'} et enregistré sur cet appareil.`);
    await render(); $('#food-name').focus(); await sync();
  } catch { message('L’aliment n’a pas pu être enregistré. Le stockage est peut-être plein ou indisponible. Votre saisie est conservée.', true); }
  finally { saving = false; $('#add-button').disabled = false; }
});

function beginEdit(food) {
  stopCamera(); editingFood = { ...food };
  $('#food-name').value = food.name; $('#food-date').value = food.date; photoData = food.photoData;
  $('#photo-preview-panel').hidden = !photoData;
  if (photoData) $('#photo-preview').src = photoData;
  $('#add-title').textContent = 'Modifier l’aliment'; $('#add-button').textContent = 'Enregistrer les modifications'; $('#cancel-edit-button').hidden = false;
  $('#food-name').focus();
}
function resetEditor() {
  editingFood = null; $('#food-form').reset(); clearPhoto(); stopCamera();
  $('#add-title').textContent = 'Ajouter un aliment'; $('#add-button').textContent = 'Ajouter au frigo'; $('#cancel-edit-button').hidden = true;
}
$('#cancel-edit-button').addEventListener('click', resetEditor);
setupShare();

function stopCamera() {
  stream?.getTracks().forEach(track => track.stop()); stream = null;
  $('#camera-video').srcObject = null; $('#camera-panel').hidden = true;
}
function clearPhoto() {
  photoData = null; $('#photo-preview').removeAttribute('src'); $('#photo-preview-panel').hidden = true; $('#camera-message').textContent = '';
}
$('#camera-button').addEventListener('click', async () => {
  if (startingCamera || stream) return;
  if (!navigator.mediaDevices?.getUserMedia) { $('#camera-message').textContent = 'La caméra n’est pas disponible dans ce navigateur. Vous pouvez ajouter l’aliment sans photo.'; return; }
  startingCamera = true; $('#camera-button').disabled = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
    if (document.hidden) { stopCamera(); return; }
    $('#camera-video').srcObject = stream; $('#camera-panel').hidden = false; await $('#camera-video').play();
    $('#camera-message').textContent = 'Cadrez votre aliment, puis cliquez sur Photographier.';
  } catch (error) {
    stopCamera();
    $('#camera-message').textContent = error.name === 'NotAllowedError' ? 'Accès à la caméra refusé. Vous pouvez ajouter l’aliment sans photo, ou autoriser la caméra dans les paramètres du site.' : 'La caméra n’a pas pu s’ouvrir. Vous pouvez ajouter l’aliment sans photo.';
  } finally { startingCamera = false; $('#camera-button').disabled = false; }
});
$('#capture-button').addEventListener('click', () => {
  const video = $('#camera-video');
  if (!video.videoWidth) { $('#camera-message').textContent = 'La caméra se prépare. Réessayez dans un instant.'; return; }
  try {
    const canvas = document.createElement('canvas'); const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', .72);
    if (data.length > 400000) { $('#camera-message').textContent = 'La photo est trop volumineuse. Réessayez avec un cadrage plus simple.'; return; }
    photoData = data; $('#photo-preview').src = photoData; $('#photo-preview-panel').hidden = false; stopCamera();
    $('#camera-message').textContent = 'Photo prête. Elle sera enregistrée avec l’aliment.';
  } catch { $('#camera-message').textContent = 'La photo n’a pas pu être prise. Vous pouvez continuer sans photo.'; }
});
$('#stop-camera-button').addEventListener('click', () => { stopCamera(); $('#camera-message').textContent = ''; });
$('#remove-photo-button').addEventListener('click', clearPhoto);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); else sync().catch(() => {}); });
window.addEventListener('pagehide', stopCamera);
window.addEventListener('online', () => { networkState(); sync().catch(() => {}); });
window.addEventListener('offline', () => { syncError = false; networkState(); render().catch(() => {}); });

let installPrompt;
const standaloneMode = window.matchMedia('(display-mode: standalone)');
const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installBannerDismissed = false;
try { installBannerDismissed = sessionStorage.getItem('vide-frigo-install-dismissed') === 'yes'; } catch { /* The banner still works without session storage. */ }
function hideInstallBanner() {
  $('#install-banner').hidden = true;
  document.body.classList.remove('install-banner-visible');
}
if (standaloneMode.matches || navigator.standalone || installBannerDismissed) hideInstallBanner();
standaloneMode.addEventListener('change', event => { if (event.matches) hideInstallBanner(); });
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
$('#install-button').addEventListener('click', async () => {
  if (installPrompt) {
    const prompt = installPrompt; installPrompt = null;
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === 'accepted') hideInstallBanner();
      return;
    } catch { /* Fall back to the browser's manual installation steps. */ }
  }
  $('#install-instructions').textContent = isAppleMobile
    ? 'Dans Safari : Partager → Sur l’écran d’accueil → Ajouter. Activez « Ouvrir comme app web » si cette option apparaît.'
    : 'Dans le menu de votre navigateur, choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ». Si vous avez ouvert ce lien dans une autre app, ouvrez-le d’abord dans votre navigateur.';
  $('#install-instructions').hidden = false;
  $('#install-button').setAttribute('aria-expanded', 'true');
});
$('#dismiss-install-button').addEventListener('click', () => {
  installBannerDismissed = true;
  try { sessionStorage.setItem('vide-frigo-install-dismissed', 'yes'); } catch { /* Optional preference. */ }
  hideInstallBanner();
});
window.addEventListener('appinstalled', () => { hideInstallBanner(); installPrompt = null; });
$('#ios-install-help').hidden = true;

function offerUpdate(worker) {
  if (!worker) return;
  $('#update-banner').hidden = false;
  $('#update-button').onclick = () => { stopCamera(); worker.postMessage({ type: 'SKIP_WAITING' }); };
}
let reloading = false;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if ($('#update-banner').hidden || reloading) return;
    reloading = true; location.reload();
  });
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'SYNC_FINISHED') render().catch(() => {});
  });
}
async function start() {
  networkState();
  try { await render(); }
  catch { message('Le stockage local est indisponible. Essayez dans un navigateur autorisant IndexedDB.', true); $('#add-button').disabled = true; return; }
  if ('serviceWorker' in navigator) {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker); });
      });
    } catch { message('Le mode hors ligne n’a pas pu être préparé. Vérifiez la connexion et rechargez la page.', true); }
  }
  await sync();
  // Setting up existing subscriptions never asks permission on page load.
  if (registration) navigator.serviceWorker.ready.then(reg => setupPush(reg)).catch(() => { $('#push-message').textContent = 'Les notifications n’ont pas pu être préparées.'; });
}
start().catch(() => message('L’application n’a pas pu démarrer. Rechargez la page.', true));
