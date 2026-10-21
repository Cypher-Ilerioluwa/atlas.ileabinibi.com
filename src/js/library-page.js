import { loadLibrary, loadCommunities } from './api.js';
import { esc, matches } from './search.js';
import { label, setCrumbs } from './core.js';
import { loadCredits } from './content.js';
import { postCard } from './post-card.js';

const $ = id => document.getElementById(id);
const EV = { documented: 'Documented', oral_tradition: 'Oral tradition', scholarly_interpretation: 'Scholarly interpretation', disputed: 'Disputed account', community_submitted: 'Community submitted', under_review: 'Under review' };
const TYPE_OF = { heritage_records: 'heritage_record', landmarks: 'landmark', people: 'person', institutions: 'institution', organisations: 'organisation' };
const KINDS = {
  heritage_records: { tab: 'Heritage records', title: r => r.title, sub: r => [label(r.category), r.period_text, r.language].filter(Boolean).join(' · ') },
  landmarks: { tab: 'Landmarks', title: r => r.name, sub: r => r.visitor_info ? 'Visitor information available' : '' },
  people: { tab: 'Notable people', title: r => r.preferred_name, sub: () => '' },
  institutions: { tab: 'Traditional institutions', title: r => r.name, sub: () => '' },
  organisations: { tab: 'Organisations and services', title: r => r.name, sub: r => [r.category, r.service_area].filter(Boolean).join(' · ') }
};
let kind = KINDS[location.hash.slice(1)] ? location.hash.slice(1) : 'heritage_records', rows = [], names = new Map(), q = '';

let credits = new Map();
function draw() {
  const k = KINDS[kind], list = rows.filter(r => matches([k.title(r), r.summary, r.body, names.get(r.community_id)], q));
  $('libout').innerHTML = list.length ? list.map(r => postCard({ ...r, title: k.title(r), region_text: names.get(r.community_id) || '' }, { type: TYPE_OF[kind], credits: credits.get(r.id) || [], eyebrow: `${k.tab}${r.evidence ? ' · ' + (EV[r.evidence] || r.evidence) : ''}${k.sub(r) ? ' · ' + k.sub(r) : ''}` })).join('')
    : `<div class="empty"><h3>Nothing found</h3><p>${q ? 'Try a shorter search.' : 'Nothing has been published in this section yet.'}</p></div>`;
}
const slugs = new Map(); const slugOf = id => slugs.get(id) || '';
async function open(k) {
  kind = k; location.hash = k; q = $('lq').value = '';
  document.querySelectorAll('#libtabs .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
  $('libout').innerHTML = '<div class="loading"><span class="spinner"></span> Loading…</div>';
  try { rows = await loadLibrary(k); credits = await loadCredits(TYPE_OF[k], rows.map(r => r.id)); draw(); } catch (e) { $('libout').innerHTML = `<div class="empty"><h3>Could not load</h3><p>${esc(e.message)}</p></div>`; }
}
$('libtabs').innerHTML = Object.entries(KINDS).map(([k, v]) => `<button class="chip" role="tab" data-k="${k}" aria-pressed="false">${v.tab}</button>`).join('');
$('libtabs').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) open(b.dataset.k); });
$('lq').addEventListener('input', e => { q = e.target.value; draw(); });
setCrumbs([['Home', '/'], ['Library']]);
(async () => {
  try { const r = await loadCommunities(); r.rows.forEach(c => { names.set(c.id, c.preferred_name); slugs.set(c.id, c.slug); }); } catch {}
  open(kind);
})();
