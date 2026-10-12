import { getDeviceToken } from './db.js';
const $ = selector => document.querySelector(selector);
let shareText = '';
export function setShareFoods(foods) {
  shareText = foods.map(food => `${food.name} — ${food.date.split('-').reverse().join('/')}`).join('\n');
}

export function setupShare() {
  $('#share-button').addEventListener('click', async () => {
    try {
      if (!shareText) { $('#share-message').textContent = 'Ajoutez au moins un aliment à partager.'; return; }
      if (!navigator.share) { $('#share-message').textContent = 'Le partage natif n’est pas disponible dans ce navigateur.'; return; }
      await navigator.share({ title: 'Mon frigo', text: shareText });
      $('#share-message').textContent = 'Liste partagée.';
    } catch (error) { $('#share-message').textContent = error.name === 'AbortError' ? 'Partage annulé.' : 'Le partage n’a pas pu s’ouvrir. Réessayez.'; }
  });
}

async function pushRequest(method, body) {
  const response = await fetch('/api/push', { method, headers: { Authorization: `Bearer ${await getDeviceToken()}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Service de notifications indisponible.'); return result;
}
export async function setupPush(registration) {
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!registration || !('PushManager' in window) || !('Notification' in window) || (apple && !standalone)) {
    $('#push-message').textContent = apple && !standalone ? 'Sur iPhone, installez d’abord l’app sur l’écran d’accueil pour activer les rappels.' : 'Les notifications push ne sont pas disponibles dans ce navigateur.';
    $('#push-button').disabled = true; return;
  }
  let subscription = await registration.pushManager.getSubscription();
  let serverRegistered = false;
  function refresh() {
    $('#push-button').textContent = subscription ? 'Désactiver les notifications' : 'Activer les notifications';
    $('#push-test-button').hidden = !subscription || !serverRegistered;
  }
  async function registerExisting() {
    if (!subscription || !navigator.onLine) return;
    try { await pushRequest('POST', { subscription: subscription.toJSON() }); serverRegistered = true; refresh(); }
    catch (error) { $('#push-message').textContent = error.message; }
  }
  refresh(); await registerExisting();
  window.addEventListener('online', registerExisting);
  $('#push-button').addEventListener('click', async () => {
    if (!navigator.onLine) { $('#push-message').textContent = 'Reconnectez-vous pour modifier les notifications.'; return; }
    $('#push-button').disabled = true;
    try {
      if (subscription) {
        await pushRequest('DELETE'); await subscription.unsubscribe(); subscription = null; serverRegistered = false;
        $('#push-message').textContent = 'Notifications désactivées.';
      } else {
        // Request permission immediately inside the click, before network awaits.
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') { $('#push-message').textContent = 'Notifications refusées. Vous pouvez les autoriser dans les paramètres du site.'; return; }
        const { publicKey } = await pushRequest('GET');
        const padded = publicKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - publicKey.length % 4) % 4);
        const applicationServerKey = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
        await pushRequest('POST', { subscription: subscription.toJSON() }); serverRegistered = true;
        $('#push-message').textContent = 'Rappels activés. Vous pouvez envoyer une notification de test.';
      }
    } catch (error) { $('#push-message').textContent = error.name === 'NotAllowedError' ? 'Notifications refusées. Vérifiez les autorisations de l’app.' : error.name === 'AbortError' ? 'Les notifications ne sont pas disponibles ici. Essayez dans l’app installée ou hors navigation privée.' : error.message || 'Les notifications n’ont pas pu être activées.'; }
    finally { $('#push-button').disabled = false; refresh(); }
  });
  $('#push-test-button').addEventListener('click', async () => {
    $('#push-test-button').disabled = true;
    try { await pushRequest('POST', { action: 'test' }); $('#push-message').textContent = 'Notification envoyée.'; }
    catch (error) { $('#push-message').textContent = error.message; }
    finally { $('#push-test-button').disabled = false; }
  });
  $('#push-button').disabled = false;
}
