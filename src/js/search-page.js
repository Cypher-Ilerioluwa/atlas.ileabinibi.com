import { loadCommunities, loadArticles, loadEvents, loadLibrary } from './api.js';
import { loadMedia } from './media.js';
import { esc, matches, norm } from './search.js';
import { setCrumbs } from './core.js';
import { PLATFORMS } from './media-embed.js';

const $ = id => document.getElementById(id), u = new URL(location);
let data = { communities: [], posts: [], events: [], records: [], music: [] }, tab = u.searchParams.get('type') || 'all', q = u.searchParams.get('q') || '';
setCrumbs([['Home', '/'], ['Search']]);
const hl = t => { const s = esc(t || ''); const words = norm(q).split(/\s+/).filter(w => w.length > 1); if (!words.length) return s; let out = s; try { const plain = norm(t || ''); const spans = []; words.forEach(w => { let i = plain.indexOf(w); while (i >= 0) { spans.push([i, i + w.length]); i = plain.indexOf(w, i + w.length); } }); if (!spans.length || plain.length !== (t || '').length) return s; spans.sort((a, b) => a[0] - b[0]); const merged = []; spans.forEach(sp => { const l = merged[merged.length - 1]; if (l && sp[0] <= l[1]) l[1] = Math.max(l[1], sp[1]); else merged.push([...sp]); }); let res = '', pos = 0; merged.forEach(([a, b]) => { res += esc(t.slice(pos, a)) + '<mark>' + esc(t.slice(a, b)) + '</mark>'; pos = b; }); return res + esc(t.slice(pos)); } catch { return s; } };
const snip = t => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > 140 ? s.slice(0, 139) + '…' : s; };
const SETS = {
  communities: () => data.communities.filter(c => matches([c.preferred_name, c.alt, c.country, c.summary], q)).map(c => ({ kind: 'Community', title: c.preferred_name, sub: c.country, text: snip(c.summary), href: `/city/?c=${encodeURIComponent(c.slug)}` })),
  posts: () => data.posts.filter(a => matches([a.title, a.summary, a.region_text, a.body], q)).map(a => ({ kind: 'Post', title: a.title, sub: a.region_text || '', text: snip(a.summary || a.body), href: `/post/?s=${encodeURIComponent(a.slug)}` })),
  events: () => data.events.filter(e => matches([e.name, e.summary, e.location_text, e.region_text], q)).map(e => ({ kind: 'Event', title: e.name, sub: [e.location_text, e.date_start].filter(Boolean).join(' · '), text: snip(e.summary), href: `/post/?t=event&s=${encodeURIComponent(e.slug)}` })),
  records: () => data.records.filter(r => matches([r.title || r.name || r.preferred_name, r.summary], q)).map(r => ({ kind: r._label, title: r.title || r.name || r.preferred_name, sub: '', text: snip(r.summary), href: `/post/?t=${r._type}&s=${encodeURIComponent(r.slug)}` })),
  music: () => data.music.filter(m => matches([m.title, m.artist, m.note], q)).map(m => ({ kind: PLATFORMS[m.platform]?.label || 'Music', title: m.title, sub: m.artist || '', text: snip(m.note), href: `/media/?m=${encodeURIComponent(m.id)}` }))
};
const LABELS = { all: 'All', communities: 'Communities', posts: 'Posts', events: 'Events', records: 'Records and people', music: 'Music' };
function draw() {
  const sets = Object.fromEntries(Object.keys(SETS).map(k => [k, q.trim() ? SETS[k]() : []])), total = Object.values(sets).flat().length;
  $('stabs').innerHTML = Object.entries(LABELS).map(([k, t]) => `<button class="chip" role="tab" data-t="${k}" aria-pressed="${k === tab}">${t}${q.trim() ? ` <span class="small">${k === 'all' ? total : sets[k].length}</span>` : ''}</button>`).join('');
  if (!q.trim()) {
    let recent = []; try { recent = JSON.parse(localStorage.getItem('atlas-recent') || '[]'); } catch {}
    $('sres').innerHTML = `<div class="empty" style="margin-bottom:var(--space-5)"><h3>What are you looking for?</h3><p>Try a town, a tradition, a festival or an artist. Tone marks are optional.</p></div>${recent.length ? `<h2 style="font-size:var(--step-1)">Continue reading</h2><div class="stack">${recent.map(r => `<a class="sres" href="/post/?${r.t === 'article' ? '' : 't=' + r.t + '&'}s=${encodeURIComponent(r.s)}"><b>${esc(r.title)}</b></a>`).join('')}</div>` : ''}`; return;
  }
  const rows = (tab === 'all' ? Object.values(sets).flat() : sets[tab] || []);
  $('sres').innerHTML = rows.length ? `<p class="muted small">${rows.length} result${rows.length === 1 ? '' : 's'}</p><div class="stack">${rows.map(r => `<a class="sres reveal" href="${r.href}"><span class="k">${esc(r.kind)}</span><b>${hl(r.title)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}${r.text ? `<p>${hl(r.text)}</p>` : ''}</a>`).join('')}</div>` : `<div class="empty"><h3>No results for “${esc(q)}”</h3><p>Check the spelling or try a shorter word.</p></div>`;
}
$('sf').addEventListener('submit', e => { e.preventDefault(); q = $('sq').value; const n = new URL(location); q ? n.searchParams.set('q', q) : n.searchParams.delete('q'); history.replaceState(null, '', n); draw(); });
$('sq').addEventListener('input', e => { q = e.target.value; draw(); });
$('stabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; draw(); } });
(async () => {
  $('sq').value = q;
  try {
    const [c, a, ev, music, ...lib] = await Promise.all([loadCommunities(), loadArticles(), loadEvents(), loadMedia().catch(() => []), ...['heritage_records', 'landmarks', 'people', 'institutions', 'organisations'].map(k => loadLibrary(k).catch(() => []))]);
    const L = [['heritage_record', 'Record'], ['landmark', 'Landmark'], ['person', 'Person'], ['institution', 'Institution'], ['organisation', 'Organisation']];
    data = { communities: c.rows, posts: a, events: ev, music, records: lib.flatMap((rows, i) => rows.map(r => ({ ...r, _type: L[i][0], _label: L[i][1] }))) };
    draw(); if (q) $('sq').blur();
  } catch (e) { $('sres').innerHTML = `<div class="empty"><h3>Could not load</h3><p>${esc(e.message)}</p></div>`; }
})();
