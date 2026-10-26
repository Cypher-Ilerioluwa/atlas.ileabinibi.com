// A small round emblem for each community (its "profile picture").
// Every community gets its own colour pair and woven pattern, always the same one for the same community,
// with its initials on top. The General community uses the Ilẹ̀ Abínibí logo.
import { esc } from './search.js';

const PALETTE = [['#1f7a63', '#0f3d33'], ['#c4511f', '#6e2a10'], ['#3556a8', '#16264f'], ['#8f3d80', '#4a1b42'],
  ['#d09214', '#7a5008'], ['#1f7391', '#0e3a4d'], ['#85602b', '#3d2b12'], ['#b02b45', '#59121f'], ['#4d7c2a', '#25400f'], ['#6a4ab0', '#2f1f63']];
const W = 'rgba(255,255,255,.2)';
// patterns inspired by woven and adire cloth, drawn on a 64 x 64 square
const MOTIFS = [
  () => [10, 18, 26, 34].map(r => `<circle cx="32" cy="32" r="${r}" fill="none" stroke="${W}" stroke-width="3"/>`).join(''),                                   // rings
  () => [-16, 0, 16, 32, 48].flatMap(x => [-16, 0, 16, 32, 48].map(y => `<path d="M${x + 8} ${y}l8 8-8 8-8-8z" fill="${W}"/>`)).join(''),                        // diamonds
  () => [4, 18, 32, 46, 60].map(y => `<path d="M-2 ${y}l12-9 12 9 12-9 12 9 12-9 12 9" fill="none" stroke="${W}" stroke-width="3"/>`).join(''),                 // zigzag
  () => [8, 24, 40, 56].flatMap(x => [8, 24, 40, 56].map(y => `<circle cx="${x}" cy="${y}" r="3.2" fill="${W}"/>`)).join(''),                                    // dots
  () => Array.from({ length: 12 }, (_, i) => `<path d="M32 32L${32 + 50 * Math.cos(i * Math.PI / 6)} ${32 + 50 * Math.sin(i * Math.PI / 6)}" stroke="${W}" stroke-width="3"/>`).join(''), // sun rays
  () => [0, 16, 32, 48].flatMap((x, i) => [0, 16, 32, 48].filter((_, j) => (i + j) % 2 === 0).map(y => `<rect x="${x}" y="${y}" width="16" height="16" fill="${W}"/>`)).join(''), // checks
];
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const initials = n => String(n || '?').replace(/\(.*?\)/g, ' ').trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase() || '?';

// room: { id (slug or 'general'), name }.  size in pixels.
export function communityBadge(room, size = 46) {
  const id = room?.id || room?.slug || 'general', name = room?.name || room?.preferred_name || '';
  if (id === 'general') return `<span class="cbadge general" style="--s:${size}px" role="img" aria-label="General"><img src="/assets/img/logo.png" alt="" width="${size}" height="${size}"></span>`;
  const h = hash(id), [c1, c2] = PALETTE[h % PALETTE.length], motif = MOTIFS[(h >>> 4) % MOTIFS.length]();
  const fs = size >= 40 ? 22 : 24;
  return `<span class="cbadge" style="--s:${size}px;background:linear-gradient(145deg,${c1},${c2})" role="img" aria-label="${esc(name)}"><svg viewBox="0 0 64 64" aria-hidden="true">${motif}<text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-family="Source Sans 3,system-ui,sans-serif" font-weight="800" font-size="${fs}" fill="#fff" stroke="rgba(0,0,0,.25)" stroke-width=".8" paint-order="stroke">${esc(initials(name))}</text></svg></span>`;
}
