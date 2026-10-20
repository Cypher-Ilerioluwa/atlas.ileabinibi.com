import { loadLibrary, loadCommunities } from './api.js';
import { esc, matches } from './search.js';
import { label } from './core.js';

const $ = id => document.getElementById(id);
const EV = { documented: 'Documented', oral_tradition: 'Oral tradition', scholarly_interpretation: 'Scholarly interpretation', disputed: 'Disputed account', community_submitted: 'Community submitted', under_review: 'Under review' };
const KINDS = {
  heritage_records: { tab: 'Heritage records', title: r => r.title, sub: r => [label(r.category), r.period_text, r.language].filter(Boolean).join(' · ') },
  landmarks: { tab: 'Landmarks', title: r => r.name, sub: r => r.visitor_info ? 'Visitor information available' : '' },
  people: { tab: 'Notable people', title: r => r.preferred_name, sub: () => '' },
  institutions: { tab: 'Traditional institutions', title: r => r.name, sub: () => '' },
  organisations: { tab: 'Organisations and services', title: r => r.name, sub: r => [r.category, r.service_area].filter(Boolean).join(' · ') }
};
let kind = KINDS[location.hash.slice(1)] ? location.hash.slice(1) : 'heritage_records', rows = [], names = new Map(), q = '';

function draw() {
  $('demo-note').hidden = !rows.some(r => !r.last_reviewed_at && !r.last_confirmed_at);
  const k = KINDS[kind], list = rows.filter(r => matches([k.title(r), r.summary, r.body, names.get(r.community_id)], q));
  $('libout').innerHTML = list.length ? list.map(r => `<article class="article"><div class="eyebrow">${esc(k.tab)}${r.evidence ? ` · <span class="badge ${esc(r.evidence)}">${esc(EV[r.evidence] || r.evidence)}</span>` : ''}${r.verified ? ' · verified' : ''}</div>
    <h3>${esc(k.title(r))}</h3><p class="muted small">${[names.get(r.community_id) && `<a href="/city/?c=${encodeURIComponent(slugOf(r.community_id))}">${esc(names.get(r.community_id))}</a>`, esc(k.sub(r))].filter(Boolean).join(' · ')}</p>
    ${r.summary ? `<p>${esc(r.summary)}</p>` : ''}${r.body && r.body !== r.summary ? `<details><summary>Read more</summary><p class="body" style="margin-top:.6rem">${esc(r.body)}</p></details>` : ''}
    ${r.contributor_credit ? `<p class="small muted">Credit: ${esc(r.contributor_credit)}</p>` : ''}</article>`).join('')
    : `<div class="empty"><h3>Nothing found</h3><p>${q ? 'Try a shorter search.' : 'Nothing has been published in this section yet.'}</p></div>`;
}
const slugs = new Map(); const slugOf = id => slugs.get(id) || '';
async function open(k) {
  kind = k; location.hash = k; q = $('lq').value = '';
  document.querySelectorAll('#libtabs .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
  $('libout').innerHTML = '<div class="loading"><span class="spinner"></span> Loading…</div>';
  try { rows = await loadLibrary(k); draw(); } catch (e) { $('libout').innerHTML = `<div class="empty"><h3>Could not load</h3><p>${esc(e.message)}</p></div>`; }
}
$('libtabs').innerHTML = Object.entries(KINDS).map(([k, v]) => `<button class="chip" role="tab" data-k="${k}" aria-pressed="false">${v.tab}</button>`).join('');
$('libtabs').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) open(b.dataset.k); });
$('lq').addEventListener('input', e => { q = e.target.value; draw(); });
(async () => {
  try { const r = await loadCommunities(); r.rows.forEach(c => { names.set(c.id, c.preferred_name); slugs.set(c.id, c.slug); }); } catch {}
  open(kind);
})();
