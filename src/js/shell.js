// Shared behaviour: mobile menu, service worker, online/offline feedback.
import { labelAccountLink } from './core.js';
import './ui.js';
import { startNotifications } from './notify.js';
(window.requestIdleCallback ? window.requestIdleCallback(() => startNotifications()) : setTimeout(startNotifications, 800));
labelAccountLink();
const toastEl = document.getElementById('toast');
let toastTimer;
export function toast(msg, ms = 3500) {
  if (!toastEl) return;
  toastEl.textContent = msg; toastEl.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
}
window.addEventListener('offline', () => toast('You are offline. Saved pages still work.'));
window.addEventListener('online', () => toast('Back online.'));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w && w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) toast('A new version is ready. Reload to update.', 8000);
        });
      });
    } catch (e) { console.warn('Service worker not registered', e); }
  });
}
