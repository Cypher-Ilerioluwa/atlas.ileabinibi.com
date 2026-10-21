import { loadCommunities, loadArticles, loadEvents, TOPICS, TOPIC_LABEL } from './api.js';
import { esc } from './search.js';
import { fmtDate, setCrumbs } from './core.js';
import { loadCredits } from './content.js';
import { postCard } from './post-card.js';
import { skeletonCards } from './ui.js';

const $ = id => document.getElementById(id);
const slug = new URLSearchParams(location.search).get('c');
const EV = { documented: 'Documented', oral_tradition: 'Oral tradition', scholarly_interpretation: 'Scholarly interpretation', disputed: 'Disputed account', community_submitted: 'Community submitted', under_review: 'Under review' };
let articles = [], topic = new URLSearchParams(location.search).get('topic') || 'all';

let credits = new Map(), shown = 8;
function drawPosts() {
  const list = articles.filter(a => topic === 'all' || a.topic === topic), page = list.slice(0, shown);
  $('posts').innerHTML = list.length ? page.map(a => postCard(a, { credits: credits.get(a.id) || [] })).join('') + (list.length > shown ? '<p style="text-align:center"><button class="btn btn-ghost" id="more">Load more</button></p>' : '')
    : `<div class="empty"><h3>No ${topic === 'all' ? '' : esc(TOPIC_LABEL[topic]) + ' '}posts yet</h3><p>Be the first to add one for this community.</p><a class="btn" href="/contribute/?type=article&community=${encodeURIComponent(slug)}${topic !== 'all' ? '&topic=' + topic : ''}">Contribute a post</a></div>`;
  $('more')?.addEventListener('click', () => { shown += 8; drawPosts(); });
}
function drawFilters() {
  const count = t => t === 'all' ? articles.length : articles.filter(a => a.topic === t).length;
  $('filters').innerHTML = ['all', ...TOPICS].map(t => `<button type="button" class="chip" data-t="${t}" aria-pressed="${topic === t}">${t === 'all' ? 'All' : TOPIC_LABEL[t]} <span class="muted small">${count(t)}</span></button>`).join('');
}
$('filters').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; topic = b.dataset.t; drawFilters(); drawPosts();
  const u = new URL(location); topic === 'all' ? u.searchParams.delete('topic') : u.searchParams.set('topic', topic); history.replaceState(null, '', u);
});

(async () => {
  try {
    const { rows, demo } = await loadCommunities(), c = rows.find(r => r.slug === slug);
    if (!c) { $('city-head').innerHTML = '<div class="empty"><h2>Community not found</h2><p>It may not be published yet.</p><a class="btn" href="/map/">Back to the map</a></div>'; return; }
    document.title = `${c.preferred_name} | Ilẹ̀ Abínibí Atlas`;
    setCrumbs([['Home', '/'], ['Map', '/map/'], [c.preferred_name]]);
    $('city-head').innerHTML = `<h1 style="font-size:var(--step-3)">${esc(c.preferred_name)}</h1>
      <p class="muted">${c.alt ? 'Also: ' + esc(c.alt) + ' · ' : ''}${esc(c.country)} · <span class="badge ${esc(c.evidence)}">${esc(EV[c.evidence] || c.evidence)}</span></p>
      <h2 style="font-size:var(--step-1)">History and key information</h2><p>${esc(c.summary || 'No summary published yet.')}</p>
      ${demo ? '<p class="notice"><strong>Demonstration entry.</strong> Not yet editorially reviewed.</p>' : ''}
      <p><a class="btn btn-ghost" href="/map/?place=${encodeURIComponent(c.slug)}">Show on the map</a> <a class="btn" href="/contribute/?community=${encodeURIComponent(c.slug)}">Contribute to this community</a> <a class="btn btn-ghost" href="/community/?room=${encodeURIComponent(c.slug)}#discuss">Join the discussion</a></p>`;
    $('posts').innerHTML = skeletonCards(2);
    articles = await loadArticles(c.id); credits = await loadCredits('article', articles.map(a => a.id));
    $('filterbar').hidden = false; drawFilters(); drawPosts();
    const today = new Date().toISOString().slice(0, 10);
    const evs = (await loadEvents()).filter(e => e.community_id === c.id && (e.date_end || e.date_start || '9') >= today).slice(0, 5);
    if (evs.length) { $('city-events').hidden = false; $('city-events-list').innerHTML = evs.map(e => `<div class="post"><b>${esc(e.name)}</b><br><span class="muted small">${fmtDate(e.date_start)} · ${esc(e.location_text || e.region_text || '')}</span></div>`).join(''); }
  } catch (e) { $('city-head').innerHTML = `<div class="empty"><h2>Could not load this community</h2><p>${esc(e.message)}</p></div>`; }
})();
