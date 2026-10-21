// App-feel helpers: header shadow, bottom tab bar, "More" sheet, scroll reveal, count-up, press feedback.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// header gets a shadow once the page scrolls
const hdr = document.getElementById('site-header');
const onScroll = () => hdr && hdr.classList.toggle('scrolled', scrollY > 6);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

// active tab in the bottom bar (matches the current section)
const path = location.pathname.replace(/index\.html$/, '');
const tabFor = p => p === '/' ? 'home' : p.startsWith('/map') || p.startsWith('/city') || p.startsWith('/post') ? 'map' : p.startsWith('/community') ? 'community' : p.startsWith('/events') ? 'events' : null;
const t = tabFor(path);
document.querySelectorAll('#tabbar [data-tab]').forEach(a => { if (a.dataset.tab === t) a.setAttribute('aria-current', 'page'); });
if (!t) document.getElementById('more-btn')?.setAttribute('aria-current', 'page');
const vib = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };
document.getElementById('tabbar')?.addEventListener('click', e => { if (e.target.closest('a,button')) vib(8); });

// "More" bottom sheet
const sheet = document.getElementById('more-sheet'), back = document.getElementById('sheet-backdrop'), moreBtn = document.getElementById('more-btn');
function openSheet() { if (!sheet) return; sheet.hidden = back.hidden = false; requestAnimationFrame(() => { sheet.classList.add('open'); back.classList.add('open'); }); moreBtn.setAttribute('aria-expanded', 'true'); sheet.querySelector('a')?.focus(); }
function closeSheet() { if (!sheet || sheet.hidden) return; sheet.classList.remove('open'); back.classList.remove('open'); moreBtn.setAttribute('aria-expanded', 'false'); setTimeout(() => { sheet.hidden = back.hidden = true; }, reduce ? 0 : 280); }
moreBtn?.addEventListener('click', openSheet); back?.addEventListener('click', closeSheet);
addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
// drag the sheet down to close
let sy = null; sheet?.addEventListener('touchstart', e => { sy = e.touches[0].clientY; }, { passive: true });
sheet?.addEventListener('touchend', e => { if (sy !== null && e.changedTouches[0].clientY - sy > 60) closeSheet(); sy = null; }, { passive: true });

// scroll reveal: any element with .reveal fades and rises into view (also for elements added later)
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }) : null;
function scan(root = document) { root.querySelectorAll('.reveal:not(.in)').forEach((el, i) => { if (!io || reduce) { el.classList.add('in'); return; } el.style.setProperty('--d', Math.min(i % 8, 7) * 55 + 'ms'); io.observe(el); }); }
scan(); new MutationObserver(m => { for (const x of m) for (const n of x.addedNodes) if (n.nodeType === 1) { if (n.matches?.('.reveal')) scan(n.parentNode); else if (n.querySelector?.('.reveal')) scan(n); } }).observe(document.body, { childList: true, subtree: true });

// count-up numbers: <span data-count="27">
export function countUp(el, to, ms = 900) {
  if (reduce || !to) { el.textContent = to; return; }
  const t0 = performance.now(); const tick = t => { const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(to * e); if (p < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
}
export const skeletonCards = (n = 3) => Array.from({ length: n }, () => '<div class="article sk"><div class="skel" style="height:.8rem;width:30%"></div><div class="skel" style="height:1.4rem;width:70%;margin:.7rem 0"></div><div class="skel" style="height:.9rem"></div><div class="skel" style="height:.9rem;width:85%;margin-top:.4rem"></div></div>').join('');
