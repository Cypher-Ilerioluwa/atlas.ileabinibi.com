// Shared behaviour: mobile menu, service worker, online/offline feedback.
import { labelAccountLink } from './core.js';
labelAccountLink();
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.dataset.open !== 'true';
    nav.dataset.open = String(open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.dataset.open === 'true') { nav.dataset.open = 'false'; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); } });
}

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
