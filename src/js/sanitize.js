// Shows imported formatting (headings, lists, tables, images, links) without letting anything unsafe in.
const ALLOWED = new Set(['P', 'BR', 'H2', 'H3', 'H4', 'STRONG', 'EM', 'U', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'IMG', 'FIGURE', 'FIGCAPTION', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'SVG', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA']);
function clean(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === 3) continue;
    if (child.nodeType !== 1) { child.remove(); continue; }
    const tag = child.tagName;
    if (DROP.has(tag)) { child.remove(); continue; }
    if (!ALLOWED.has(tag)) { clean(child); child.replaceWith(...child.childNodes); continue; }
    for (const a of [...child.attributes]) { const n = a.name.toLowerCase(); if (!((tag === 'A' && n === 'href') || (tag === 'IMG' && (n === 'src' || n === 'alt')))) child.removeAttribute(a.name); }
    if (tag === 'A') { const h = (child.getAttribute('href') || '').trim(); if (!/^(https?:|mailto:|\/(?!\/)|#)/i.test(h)) { child.replaceWith(...child.childNodes); continue; } if (/^https?:/i.test(h)) { child.setAttribute('target', '_blank'); child.setAttribute('rel', 'noopener noreferrer'); } }
    if (tag === 'IMG') { const s = (child.getAttribute('src') || '').trim(); if (!/^https:\/\//i.test(s)) { child.remove(); continue; } child.setAttribute('loading', 'lazy'); child.setAttribute('referrerpolicy', 'no-referrer'); }
    clean(child);
  }
}
export function sanitize(html) {
  const doc = new DOMParser().parseFromString('<body>' + String(html || ''), 'text/html'); clean(doc.body);
  doc.body.querySelectorAll('table').forEach(t => { const w = doc.createElement('div'); w.className = 'tablewrap'; t.replaceWith(w); w.append(t); });
  return doc.body.innerHTML;
}
export const readingMinutes = text => Math.max(1, Math.round(String(text || '').trim().split(/\s+/).filter(Boolean).length / 200));
