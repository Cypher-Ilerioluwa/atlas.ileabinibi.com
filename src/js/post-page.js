import { loadPost, loadCredits, TYPES, avatarHtml } from './content.js';
import { loadCommunities, loadArticles, TOPIC_LABEL } from './api.js';
import { postCard, creditsHtml } from './post-card.js';
import { esc } from './search.js';
import { setCrumbs, fmtDate } from './core.js';
import { toast } from './shell.js';
import * as K from './calendar/kojoda.js';

const $ = id => document.getElementById(id), q = new URLSearchParams(location.search);
const type = TYPES[q.get('t')] ? q.get('t') : 'article', slug = q.get('s');
const EV = { documented: 'Documented', oral_tradition: 'Oral tradition', scholarly_interpretation: 'Scholarly interpretation', disputed: 'Disputed account', community_submitted: 'Community submitted', under_review: 'Under review' };

(async () => {
  try {
    const post = slug && await loadPost(type, slug);
    if (!post) { setCrumbs([['Home', '/'], ['Posts', '/posts/'], ['Not found']]); return $('post').innerHTML = '<div class="empty"><h2>Post not found</h2><p>It may have been moved or is not published.</p><a class="btn" href="/posts/">Browse all posts</a></div>'; }
    const { item, credits } = post, T = TYPES[type], title = T.title(item);
    const comms = (await loadCommunities()).rows, comm = comms.find(c => c.id === item.community_id);
    document.title = `${title} | Ilẹ̀ Abínibí Atlas`;
    setCrumbs([['Home', '/'], comm ? ['Map', '/map/'] : ['Posts', '/posts/'], ...(comm ? [[comm.preferred_name, `/city/?c=${encodeURIComponent(comm.slug)}`]] : []), [title]]);
    let meta = [];
    if (type === 'article') meta = [TOPIC_LABEL[item.topic], item.region_text, fmtDate(item.published_at)];
    if (type === 'event') { const kd = item.date_start ? K.fromGregorian(item.date_start) : null; meta = ['Event', item.location_text, item.date_start ? fmtDate(item.date_start) + (item.date_end ? ' – ' + fmtDate(item.date_end) : '') : 'Date to be confirmed', kd ? `${kd.month}, day ${kd.dayOfMonth} (Kọ́jọ́dá)` : null]; }
    if (type === 'heritage_record') meta = [item.category && item.category.replace(/_/g, ' '), item.period_text, item.language];
    const paras = (item.body || item.summary || '').trim();
    $('post').innerHTML = `<div class="eyebrow">${esc(T.label)}${item.evidence ? ` · <span class="badge ${esc(item.evidence)}">${esc(EV[item.evidence] || item.evidence)}</span>` : ''}</div>
      <h1>${esc(title)}</h1>
      <div class="postmeta">${meta.filter(Boolean).map(m => `<span>${esc(m)}</span>`).join('<span class="sep">·</span>')}${comm ? `<span class="sep">·</span><a href="/city/?c=${encodeURIComponent(comm.slug)}">${esc(comm.preferred_name)}</a>` : ''}</div>
      ${creditsHtml(credits)}
      ${item.cover_url ? `<img class="cover" src="${esc(item.cover_url)}" alt="" loading="lazy">` : ''}
      ${item.summary && item.summary !== item.body ? `<p class="lede">${esc(item.summary)}</p>` : ''}
      <div class="body">${esc(paras)}</div>
      ${item.external_url ? `<div class="source-note">Originally published on ileabinibi.com <a class="btn btn-sm btn-ghost" href="${esc(item.external_url)}" rel="noopener">Read the original</a></div>` : ''}
      ${item.sources ? `<div class="credit-box"><h2>Sources</h2><p style="margin:0;white-space:pre-line">${esc(item.sources)}</p></div>` : ''}
      ${credits.length ? `<div class="credit-box"><h2>Contributors</h2>${credits.map((c, i) => `<div class="credit-row">${avatarHtml(c.name, c.avatar, 'av')}<div><a href="/contributor/?c=${encodeURIComponent(c.slug)}">${esc(c.name)}</a><br><span class="role">${i === 0 ? 'Author' : c.role === 'editor' ? 'Editor' : 'Contributor'}</span></div><a class="btn btn-sm btn-ghost" style="margin-left:auto" href="/contributor/?c=${encodeURIComponent(c.slug)}">All work</a></div>`).join('')}</div>` : ''}
      <p style="display:flex;gap:.6rem;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" id="share" type="button">Copy link</button>${type === 'article' || type === 'event' ? `<a class="btn btn-ghost btn-sm" href="/contribute/?type=edit">Suggest a correction</a>` : ''}${comm ? `<a class="btn btn-ghost btn-sm" href="/city/?c=${encodeURIComponent(comm.slug)}">More from ${esc(comm.preferred_name)}</a>` : ''}</p>`;
    $('share').onclick = async () => { try { await navigator.clipboard.writeText(location.href); toast('Link copied.'); } catch { toast('Copy the address bar link.'); } };
    if (type === 'article') {
      const rel = (await loadArticles(item.community_id || undefined)).filter(a => a.slug !== item.slug).slice(0, 3);
      if (rel.length) { const cr = await loadCredits('article', rel.map(r => r.id)); $('post').insertAdjacentHTML('beforeend', `<h2 style="font-size:var(--step-2);margin-top:var(--space-6)">Keep reading</h2><div class="stack">${rel.map(r => postCard(r, { credits: cr.get(r.id) || [] })).join('')}</div>`); }
    }
  } catch (e) { $('post').innerHTML = `<div class="empty"><h2>Could not load this post</h2><p>${esc(e.message)}</p></div>`; }
})();
