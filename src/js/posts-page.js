import { loadArticles, loadCommunities, TOPICS, TOPIC_LABEL } from './api.js';
import { loadCredits } from './content.js';
import { postCard } from './post-card.js';
import { esc, matches } from './search.js';
import { setCrumbs } from './core.js';
import { skeletonCards } from './ui.js';

const $ = id => document.getElementById(id), pu = new URLSearchParams(location.search);
let all = [], topic = TOPICS.includes(pu.get('topic')) ? pu.get('topic') : 'all', q = '', comm = '', shown = 8;
const names = new Map(); setCrumbs([['Home', '/'], ['All posts']]);
async function draw() {
  const list = all.filter(a => (topic === 'all' || a.topic === topic) && (!comm || a.community_id === comm) && matches([a.title, a.summary, a.region_text, names.get(a.community_id)], q));
  $('filters').innerHTML = ['all', ...TOPICS].map(t => `<button class="chip" data-t="${t}" aria-pressed="${t === topic}">${t === 'all' ? 'All' : TOPIC_LABEL[t]} <span class="muted small">${all.filter(a => (t === 'all' || a.topic === t)).length}</span></button>`).join('');
  const page = list.slice(0, shown), cr = await loadCredits('article', page.map(a => a.id));
  $('posts').innerHTML = page.length ? page.map(a => postCard(a, { credits: cr.get(a.id) || [] })).join('') : '<div class="empty"><h3>No posts found</h3><p>Try another topic, or contribute one.</p><a class="btn" href="/contribute/?type=article">Contribute a post</a></div>';
  $('more').hidden = list.length <= shown;
}
$('filters').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { topic = b.dataset.t; shown = 8; draw(); } });
$('pq').addEventListener('input', e => { q = e.target.value; shown = 8; draw(); });
$('pc').addEventListener('change', e => { comm = e.target.value; shown = 8; draw(); });
$('more').addEventListener('click', () => { shown += 8; draw(); });
(async () => {
  $('posts').innerHTML = skeletonCards(3);
  try { const [a, c] = await Promise.all([loadArticles(), loadCommunities()]); all = a; c.rows.forEach(x => names.set(x.id, x.preferred_name)); $('pc').insertAdjacentHTML('beforeend', c.rows.filter(x => a.some(p => p.community_id === x.id)).map(x => `<option value="${esc(x.id)}">${esc(x.preferred_name)}</option>`).join('')); draw(); }
  catch (e) { $('posts').innerHTML = `<div class="empty"><h3>Could not load posts</h3><p>${esc(e.message)}</p></div>`; }
})();
