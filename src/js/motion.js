// Small, tasteful motion helpers. Everything here is skipped for people who prefer reduced motion.
import { revealScan } from './ui.js';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// headings and call-to-action blocks fade up as they scroll into view (the observer lives in ui.js)
document.querySelectorAll('.section-head, .cm-section .wrap, .cta-pair').forEach(el => el.classList.add('reveal'));
revealScan();

// ---- back to top ----
const up = document.createElement('button');
up.type = 'button'; up.className = 'to-top'; up.setAttribute('aria-label', 'Back to top');
up.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
up.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
document.body.append(up);

// ---- one light scroll handler: back-to-top visibility and the hero sun drift ----
let ticking = false;
function onScroll() {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    const y = scrollY; up.classList.toggle('show', y > 700);
    if (!reduce && y < 900) document.documentElement.style.setProperty('--sy', y);
    ticking = false;
  });
}
addEventListener('scroll', onScroll, { passive: true }); onScroll();

// ---- button ripple ----
if (!reduce) document.addEventListener('pointerdown', e => {
  const b = e.target.closest?.('.btn'); if (!b || b.disabled) return;
  const r = b.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2, s = document.createElement('span');
  s.className = 'ripple'; s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  b.append(s); setTimeout(() => s.remove(), 650);
}, { passive: true });
