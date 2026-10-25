// App-feel helpers: splash, progress bar, header shadow, bottom tab bar, "More" sheet, auto-hiding bars, scroll reveal.
import { setTheme, getTheme } from './core.js';
import { install, canInstall, isStandalone } from './install.js';
import './keyboard.js';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, root = document.documentElement;
const $ = id => document.getElementById(id);

// ---- splash: the bar follows the real loading stages ----
(function splash() {
  const sp = $('splash'); if (!sp || !root.dataset.splash) return;
  const fill = $('sp-fill'), t0 = performance.now(); let pct = 12; const set = n => { pct = Math.max(pct, n); fill.style.width = pct + '%'; }; set(18);
  document.addEventListener('DOMContentLoaded', () => set(55)); const doneLoad = () => set(85);
  document.readyState === 'complete' ? doneLoad() : addEventListener('load', doneLoad);
  const fonts = document.fonts?.ready || Promise.resolve();
  Promise.all([new Promise(r => (document.readyState === 'complete' ? r() : addEventListener('load', r))), Promise.race([fonts, new Promise(r => setTimeout(r, 2500))])]).then(() => {
    set(100); const wait = Math.max(0, 650 - (performance.now() - t0)); setTimeout(() => { sp.classList.add('out'); setTimeout(() => { sp.remove(); delete root.dataset.splash; }, 420); }, wait);
  });
})();

// ---- thin top progress bar on navigation ----
const bar = $('topbar')?.firstElementChild; let pt;
function progressStart() { if (!bar) return; clearInterval(pt); let w = 8; $('topbar').classList.add('on'); bar.style.width = w + '%'; pt = setInterval(() => { w += (88 - w) * .12; bar.style.width = w + '%'; }, 180); }
export function progressDone() { if (!bar) return; clearInterval(pt); bar.style.width = '100%'; setTimeout(() => { $('topbar').classList.remove('on'); bar.style.width = '0'; }, 280); }
document.addEventListener('click', e => { const a = e.target.closest('a[href]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return; const u = new URL(a.href, location); if (u.origin === location.origin && u.pathname + u.search !== location.pathname + location.search && !a.hasAttribute('download')) progressStart(); });
addEventListener('pageshow', progressDone); addEventListener('beforeunload', () => { try { progressStart(); } catch {} });
export const progress = { start: progressStart, done: progressDone };

// ---- header shadow and auto-hiding bars (dashboard tabs) ----
const hdr = $('site-header'); let lastY = scrollY, hideTick = false;
function onScroll() {
  const y = scrollY; hdr && hdr.classList.toggle('scrolled', y > 6);
  const d = y - lastY;
  if (Math.abs(d) > 8 || y < 40) document.querySelectorAll('[data-autohide]').forEach(el => el.classList.toggle('hide', d > 0 && y > 140));
  if (Math.abs(d) > 8) lastY = y;
}
addEventListener('scroll', () => { if (!hideTick) { hideTick = true; requestAnimationFrame(() => { onScroll(); hideTick = false; }); } }, { passive: true }); onScroll();
new MutationObserver(() => document.querySelectorAll('.dnav:not([data-autohide])').forEach(n => n.setAttribute('data-autohide', ''))).observe(document.body, { childList: true, subtree: true });

// ---- bottom tab bar ----
const path = location.pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
const tabFor = p => p === '/' ? 'home' : /^\/(map|city|post)/.test(p) ? 'map' : p.startsWith('/community') ? 'community' : p.startsWith('/events') ? 'events' : null;
const tab = tabFor(path);
document.querySelectorAll('#tabbar [data-tab]').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); });
if (!tab) $('more-btn')?.setAttribute('aria-current', 'page');
const vib = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };
$('tabbar')?.addEventListener('click', e => { if (e.target.closest('a,button')) vib(8); });

// ---- smart "More" sheet ----
const sheet = $('more-sheet'), back = $('sheet-backdrop'), moreBtn = $('more-btn');
document.querySelectorAll('.sheet-tiles a').forEach(a => { if (path.startsWith(a.dataset.path)) a.setAttribute('aria-current', 'page'); });
function syncSheet() {
  const th = getTheme() === 'dark' ? 'dark' : 'light'; document.querySelectorAll('#sheet-theme button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.theme === th)));
  const ib = $('sheet-install'); if (ib) ib.hidden = !canInstall() || isStandalone();
}
function openSheet() { if (!sheet) return; syncSheet(); sheet.hidden = back.hidden = false; requestAnimationFrame(() => { sheet.classList.add('open'); back.classList.add('open'); }); moreBtn.setAttribute('aria-expanded', 'true'); document.body.classList.add('sheet-open'); }
function closeSheet() { if (!sheet || sheet.hidden) return; sheet.classList.remove('open'); back.classList.remove('open'); moreBtn.setAttribute('aria-expanded', 'false'); document.body.classList.remove('sheet-open'); setTimeout(() => { sheet.hidden = back.hidden = true; }, reduce ? 0 : 300); }
moreBtn?.addEventListener('click', () => (sheet.hidden ? openSheet() : closeSheet())); back?.addEventListener('click', closeSheet);
addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
sheet?.addEventListener('click', e => { if (e.target.closest('.sheet-tiles a')) closeSheet(); const t = e.target.closest('#sheet-theme [data-theme]'); if (t) { setTheme(t.dataset.theme); syncSheet(); } if (e.target.closest('#sheet-install')) { closeSheet(); install(); } });
let sy = null, dy = 0; sheet?.addEventListener('touchstart', e => { sy = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none'; }, { passive: true });
sheet?.addEventListener('touchmove', e => { if (sy === null) return; dy = Math.max(0, e.touches[0].clientY - sy); sheet.style.transform = `translateY(${dy}px)`; }, { passive: true });
sheet?.addEventListener('touchend', () => { sheet.style.transition = ''; sheet.style.transform = ''; if (dy > 90) closeSheet(); sy = null; }, { passive: true });

// ---- tab strips: keep the chosen tab in view ----
document.addEventListener('click', e => { const b = e.target.closest('.navtabs button, .hub-tabs button, .subnav button, .filterbar .chip, .dnav button'); if (b) setTimeout(() => b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }), 30); });

// ---- scroll reveal ----
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }) : null;
function scan(r = document) { r.querySelectorAll('.reveal:not(.in)').forEach((el, i) => { if (!io || reduce) { el.classList.add('in'); return; } el.style.setProperty('--d', Math.min(i % 8, 7) * 55 + 'ms'); io.observe(el); }); }
scan(); new MutationObserver(m => { for (const x of m) for (const n of x.addedNodes) if (n.nodeType === 1) { if (n.matches?.('.reveal')) scan(n.parentNode); else if (n.querySelector?.('.reveal')) scan(n); } }).observe(document.body, { childList: true, subtree: true });

export function countUp(el, to, ms = 900) {
  if (reduce || !to) { el.textContent = to; return; }
  const t0 = performance.now(); const tick = t => { const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(to * e); if (p < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
}
export const skeletonCards = (n = 3) => Array.from({ length: n }, () => '<div class="article sk"><div class="skel" style="height:.8rem;width:30%"></div><div class="skel" style="height:1.4rem;width:70%;margin:.7rem 0"></div><div class="skel" style="height:.9rem"></div><div class="skel" style="height:.9rem;width:85%;margin-top:.4rem"></div></div>').join('');
