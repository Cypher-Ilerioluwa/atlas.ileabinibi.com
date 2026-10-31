// A small strip of Yorùbá letters (ẹ ọ ṣ and tone marks) above the keyboard, for search boxes, chat and comments.
// Most phones have no easy way to type these. Tap a letter and it is inserted where the cursor is.
export const BASE = ['ẹ', 'ọ', 'ṣ', 'Ẹ', 'Ọ', 'Ṣ'];
export const TONES = ['à', 'á', 'è', 'é', 'ẹ\u0300', 'ẹ\u0301', 'ì', 'í', 'ò', 'ó', 'ọ\u0300', 'ọ\u0301', 'ù', 'ú', 'ǹ', 'ń'];
const ELIGIBLE = 'textarea, input[data-yo], input[type=search]';
const coarse = matchMedia('(pointer: coarse)').matches;

export function insertAtCursor(el, s) {
  const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a;
  el.setRangeText(s, a, b, 'end'); el.dispatchEvent(new Event('input', { bubbles: true }));
}
let bar = null, target = null;
function build() {
  bar = document.createElement('div'); bar.className = 'yk'; bar.hidden = true; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Yorùbá letters');
  bar.innerHTML = `<div class="yk-row">${[...BASE, ...TONES].map(k => `<button type="button" tabindex="-1" data-k="${k}">${k}</button>`).join('')}</div><button type="button" tabindex="-1" class="yk-x" aria-label="Hide the letter bar">✕</button>`;
  bar.addEventListener('pointerdown', e => e.preventDefault());   // keep the keyboard open and the cursor in place
  bar.addEventListener('click', e => {
    if (e.target.closest('.yk-x')) { try { sessionStorage.setItem('atlas-yk-off', '1'); } catch { /* ignore */ } hide(); return; }
    const k = e.target.closest('[data-k]')?.dataset.k; if (k && target) insertAtCursor(target, k);
  });
  document.body.append(bar);
}
function place() {
  if (!bar || bar.hidden || !target) return;
  const vv = window.visualViewport;
  if (coarse) { bar.style.cssText = `left:0;right:0;bottom:${Math.max(0, innerHeight - (vv ? vv.offsetTop + vv.height : innerHeight))}px`; return; }
  const r = target.getBoundingClientRect(), w = Math.min(560, innerWidth - 16), top = r.top > 70 ? r.top - 48 : r.bottom + 6;
  bar.style.cssText = `left:${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px;top:${top}px;width:${w}px`;
}
function show(el) { try { if (sessionStorage.getItem('atlas-yk-off')) return; } catch { /* ignore */ } if (!bar) build(); target = el; bar.hidden = false; place(); }
function hide() { if (bar) bar.hidden = true; target = null; }

document.addEventListener('focusin', e => { const el = e.target; if (!el.matches?.(ELIGIBLE) || el.matches('[data-no-yo]')) return; if (!coarse && el.matches('input[type=search]')) return; show(el); });   // on computers only the writing boxes get it
document.addEventListener('focusout', e => { if (e.target === target) setTimeout(() => { if (document.activeElement !== target) hide(); }, 120); });
addEventListener('scroll', place, { passive: true }); addEventListener('resize', place);
window.visualViewport?.addEventListener('resize', place); window.visualViewport?.addEventListener('scroll', place);
