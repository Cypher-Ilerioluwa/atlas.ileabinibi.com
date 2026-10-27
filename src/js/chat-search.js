// Helpers for searching chat messages: accent-insensitive matching (so "ibadan" finds "Ìbàdàn" and "ose" finds "ọ̀ṣẹ̀"),
// a short snippet around the match, and highlighting. Pure functions, no network.
import { esc } from './search.js';

const strip = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const fold = s => strip(String(s || ''));

// the folded text, with for every folded character the range it came from in the original text
function foldMap(text) {
  let out = ''; const from = [], to = []; let pos = 0;
  for (const ch of String(text || '')) { const f = strip(ch); for (let i = 0; i < f.length; i++) { from.push(pos); to.push(pos + ch.length); } out += f; pos += ch.length; }
  return { out, from, to };
}
/** [start, end) ranges of the original text where q matches (accent and case insensitive). */
export function matchRanges(text, q) {
  const needle = fold(q).trim(); if (needle.length < 1) return [];
  const { out, from, to } = foldMap(text), ranges = []; let i = 0;
  while ((i = out.indexOf(needle, i)) !== -1) { ranges.push([from[i], to[i + needle.length - 1]]); i += needle.length; }
  return ranges;
}
export const matches = (text, q) => matchRanges(text, q).length > 0;

/** A window of the text around the first match, with … where it was cut. */
export function snippet(text, q, width = 80) {
  const t = String(text || '').replace(/\s+/g, ' ').trim(); if (t.length <= width) return t;
  const r = matchRanges(t, q)[0]; if (!r) return t.slice(0, width - 1).trimEnd() + '…';
  const start = Math.max(0, Math.min(r[0] - 24, t.length - width)), end = Math.min(t.length, start + width);
  return (start > 0 ? '…' : '') + t.slice(start, end).trim() + (end < t.length ? '…' : '');
}
/** HTML-safe text with every match wrapped in <mark>. */
export function highlight(text, q) {
  const t = String(text || ''), rs = matchRanges(t, q); if (!rs.length) return esc(t);
  let html = '', at = 0; for (const [a, b] of rs) { html += esc(t.slice(at, a)) + '<mark>' + esc(t.slice(a, b)) + '</mark>'; at = b; }
  return html + esc(t.slice(at));
}
export const isLink = m => /(https?:\/\/|\/media\/\?m=)/i.test(m?.body || '');
/** Does a message pass the text query and the Photos / Links filter? (used by the offline preview) */
export function messageMatches(m, q, kind = 'all') {
  if (kind === 'photo' && !m.image_path) return false;
  if (kind === 'link' && !isLink(m)) return false;
  return fold(q).trim().length < 2 ? kind !== 'all' : matches(m.body, q) || matches(m.author_name, q);
}
