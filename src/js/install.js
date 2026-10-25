// Install the app. Android and desktop browsers can show a real install prompt.
// iPhone and iPad cannot: Apple only allows "Add to Home Screen" from the Share menu, so we guide people through it.
const ua = navigator.userAgent || '';
export const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let deferred = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; dispatchEvent(new Event('atlas-installable')); });
addEventListener('appinstalled', () => { deferred = null; hideBanner(); toast('Installed. Find the Atlas on your home screen.'); });
const toast = m => document.getElementById('toast') && (document.getElementById('toast').textContent = m, document.getElementById('toast').hidden = false, setTimeout(() => { document.getElementById('toast').hidden = true; }, 3500));

export const canInstall = () => !isStandalone() && (Boolean(deferred) || isIOS);
export function showIosCoach() { const c = document.getElementById('ios-coach'); if (!c) return; c.hidden = false; requestAnimationFrame(() => c.classList.add('open')); }
function hideCoach() { const c = document.getElementById('ios-coach'); if (!c) return; c.classList.remove('open'); setTimeout(() => { c.hidden = true; }, 250); }
export async function install() {
  if (deferred) { deferred.prompt(); const r = await deferred.userChoice; deferred = null; return r.outcome === 'accepted'; }
  if (isIOS) { showIosCoach(); return false; }
  toast('Use your browser menu: “Install app” or “Add to Home Screen”.'); return false;
}
function hideBanner() { const b = document.getElementById('install-banner'); if (b) { b.classList.remove('show'); setTimeout(() => { b.hidden = true; }, 300); } }
// gentle, once-in-a-while suggestion: after a few page views and some time on the site, never again for 14 days after "Not now"
function maybeBanner() {
  try {
    if (isStandalone() || !canInstall()) return;
    const views = +sessionStorage.getItem('atlas-views') || 0; if (views < 2) return;
    const until = +localStorage.getItem('atlas-install-until') || 0; if (Date.now() < until) return;
    const b = document.getElementById('install-banner'); if (!b) return; b.hidden = false; requestAnimationFrame(() => b.classList.add('show'));
  } catch {}
}
try { sessionStorage.setItem('atlas-views', String((+sessionStorage.getItem('atlas-views') || 0) + 1)); } catch {}
document.addEventListener('click', e => {
  if (e.target.closest('#ib-go')) { hideBanner(); install(); }
  if (e.target.closest('#ib-x')) { hideBanner(); try { localStorage.setItem('atlas-install-until', String(Date.now() + 14 * 864e5)); } catch {} }
  if (e.target.closest('#ios-coach [data-close]') || e.target.id === 'ios-coach') hideCoach();
  if (e.target.closest('[data-install]')) install();
});
setTimeout(maybeBanner, 12000); addEventListener('atlas-installable', () => setTimeout(maybeBanner, 8000));
