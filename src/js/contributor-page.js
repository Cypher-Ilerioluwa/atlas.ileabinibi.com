import { loadContributor, loadCredits, TYPES, avatarHtml } from './content.js';
import { postCard } from './post-card.js';
import { esc } from './search.js';
import { setCrumbs } from './core.js';

const $ = id => document.getElementById(id), slug = new URLSearchParams(location.search).get('c');
let items = [], tab = 'all';
const GROUPS = { all: 'All work', article: 'Articles', event: 'Events', records: 'Records and places' };
const inTab = x => tab === 'all' || (tab === 'records' ? !['article', 'event'].includes(x.type) : x.type === tab);
const ROLE = { author: 'Author', editor: 'Editor', contributor: 'Contributor' };
async function draw(c) {
  const list = items.filter(inTab);
  const credits = {}; for (const t of Object.keys(TYPES)) { const ids = list.filter(x => x.type === t).map(x => x.item.id); if (ids.length) credits[t] = await loadCredits(t, ids); }
  $('list').innerHTML = list.length ? list.map(x => postCard(x.item, { type: x.type, credits: credits[x.type]?.get(x.item.id) || [], eyebrow: `${TYPES[x.type].label} · ${ROLE[x.role]}` })).join('') : '<div class="empty"><h3>Nothing here yet</h3></div>';
}
(async () => {
  try {
    const r = slug && await loadContributor(slug);
    if (!r) { setCrumbs([['Home', '/'], ['Contributors']]); return $('who').innerHTML = '<div class="empty"><h2>Contributor not found</h2><a class="btn" href="/posts/">Browse posts</a></div>'; }
    const c = r.contributor; items = r.items; document.title = `${c.display_name} | Ilẹ̀ Abínibí Atlas`;
    setCrumbs([['Home', '/'], ['Posts', '/posts/'], [c.display_name]]);
    const n = k => items.filter(x => k === 'all' || (k === 'records' ? !['article', 'event'].includes(x.type) : x.type === k)).length;
    $('who').innerHTML = `<div class="profile-head">${avatarHtml(c.display_name, c.avatar_path, 'av')}<div><div class="eyebrow">Contributor</div><h1 style="font-size:var(--step-3);margin:0">${esc(c.display_name)}</h1>${c.bio ? `<p class="muted">${esc(c.bio)}</p>` : ''}<p class="muted small">${n('all')} published ${n('all') === 1 ? 'item' : 'items'}: ${items.filter(x => x.role === 'author').length} as author, ${items.filter(x => x.role !== 'author').length} as editor or contributor</p></div></div>
      <div class="hub-tabs" role="tablist">${Object.entries(GROUPS).map(([k, v]) => `<button class="chip" data-t="${k}" aria-pressed="${k === 'all'}">${v} <span class="muted small">${n(k)}</span></button>`).join('')}</div><div class="stack" id="list"></div>`;
    $('who').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; document.querySelectorAll('[data-t]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw(c); } });
    draw(c);
  } catch (e) { $('who').innerHTML = `<div class="empty"><h2>Could not load</h2><p>${esc(e.message)}</p></div>`; }
})();
