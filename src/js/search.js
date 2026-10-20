// Diacritic-insensitive matching for Abínibí names. Display text is never altered.
export function norm(s = '') {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u1e63/g, 's').replace(/\u1e62/g, 'S').toLowerCase();
}
export function matches(haystackParts, query) {
  const q = norm(query.trim());
  if (!q) return true;
  const h = norm(haystackParts.join(' '));
  return q.split(/\s+/).every(t => h.includes(t));
}
export function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
