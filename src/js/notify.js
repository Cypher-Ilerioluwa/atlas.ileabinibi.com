// Unread notification count beside the navigation, live. Works on every page.
import { signedInHint } from './core.js';
let count = 0, baseTitle = document.title, started = false;
const cap = n => (n > 99 ? '99+' : String(n));
function apply(bump) {
  document.querySelectorAll('[data-nbadge]').forEach(b => {
    const was = b.hidden; b.hidden = count < 1; b.textContent = cap(count); b.setAttribute('aria-label', `${count} unread notification${count === 1 ? '' : 's'}`);
    if (count > 0 && (bump || was)) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  });
  document.title = count > 0 ? `(${cap(count)}) ${baseTitle.replace(/^\(\d+\+?\)\s/, '')}` : baseTitle.replace(/^\(\d+\+?\)\s/, '');
  try { count > 0 ? navigator.setAppBadge?.(count) : navigator.clearAppBadge?.(); } catch {}
  document.querySelectorAll('.hdr-account').forEach(a => a.setAttribute('aria-label', count > 0 ? `Dashboard, ${count} unread` : 'Dashboard'));
}
export const getCount = () => count;
export function setCount(n) { count = Math.max(0, n | 0); apply(false); dispatchEvent(new CustomEvent('atlas-unread', { detail: count })); }
export function refreshBadges() { apply(false); }
// a new notification arrives (live from the server, or from the preview)
addEventListener('atlas-notify', e => { count += 1; apply(true); dispatchEvent(new CustomEvent('atlas-unread', { detail: count })); const n = e.detail || {}; const t = document.getElementById('toast'); if (t && n.title) { t.textContent = '🔔 ' + n.title; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 4500); } try { navigator.vibrate?.(15); } catch {} });
export async function startNotifications() {
  if (started || !signedInHint()) return; started = true;
  try {
    const { getContext } = await import('./api.js'); const ctx = await getContext(); if (!ctx.user || !ctx.api) return;
    setCount(await ctx.api.unread());
    ctx.api.watchNotifications?.(row => dispatchEvent(new CustomEvent('atlas-notify', { detail: row })));
    document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible') setCount(await ctx.api.unread().catch(() => count)); });
  } catch { /* the badge simply stays hidden */ }
}
