import { loadPost, loadCredits, TYPES, avatarHtml, loadEngagement, toggleLike, toggleSave, addComment, deleteComment } from './content.js';
import { getContext, loadCommunities, loadArticles, TOPIC_LABEL } from './api.js';
import { postCard, creditsHtml } from './post-card.js';
import { sanitize, readingMinutes } from './sanitize.js';
import { esc } from './search.js';
import { setCrumbs, fmtDate, fmtDateTime } from './core.js';
import { toast } from './shell.js';
import * as K from './calendar/kojoda.js';
import { config } from './config.js';

const $ = id => document.getElementById(id), q = new URLSearchParams(location.search);
const type = TYPES[q.get('t')] ? q.get('t') : 'article', slug = q.get('s');
const EV = { documented: 'Documented', oral_tradition: 'Oral tradition', scholarly_interpretation: 'Scholarly interpretation', disputed: 'Disputed account', community_submitted: 'Community submitted', under_review: 'Under review' };
let user = null, eng = { likes: 0, liked: false, saved: false, comments: [] }, ctx = {}, itemId = null;
const need = () => { toast('Sign in to do that.'); setTimeout(() => { location.href = '/account/?next=' + encodeURIComponent(location.pathname + location.search); }, 900); };

function bar() {
  return `<div class="actbar" id="actbar"><button type="button" data-like class="${eng.liked ? 'on' : ''}" aria-pressed="${eng.liked}"><span>${eng.liked ? '♥' : '♡'}</span> <b>${eng.likes}</b><i class="vh"> likes</i></button>
    <a href="#comments" class="btn-like"><span>💬</span> <b>${eng.comments.length}</b><i class="vh"> comments</i></a>
    <button type="button" data-save class="${eng.saved ? 'on' : ''}" aria-pressed="${eng.saved}"><span>${eng.saved ? '★' : '☆'}</span> <i>${eng.saved ? 'Saved' : 'Save'}</i></button>
    <button type="button" data-share><span>↗</span> <i>Share</i></button></div>`;
}
function comments() {
  const can = user && !ctx.banned;
  return `<section class="comments" id="comments"><h2>Comments <span class="muted">${eng.comments.length}</span></h2>
    ${can ? `<form id="cform" class="cform">${avatarHtml(user.name, user.avatar, 'av')}<div><label class="visually-hidden" for="ctext">Add a comment</label><textarea id="ctext" rows="2" maxlength="1000" placeholder="Add a comment" enterkeyhint="send"></textarea><div class="cform-bar"><span class="muted small" id="ccount">0 / 1000</span><button class="btn btn-sm btn-gold" type="submit">Post</button></div></div></form>`
      : `<p class="muted">${ctx.banned ? 'Commenting is paused for this account.' : '<a href="/account/?next=' + encodeURIComponent(location.pathname + location.search) + '">Sign in</a> to join the conversation.'}</p>`}
    <div class="clist" id="clist">${eng.comments.length ? eng.comments.map(c => `<article class="comment" data-id="${esc(c.id)}">${avatarHtml(c.author_name, c.author_avatar, 'av')}<div><div class="cmeta"><b>${esc(c.author_name)}</b>${c.author_role ? `<span class="rb${c.author_role === 'admin' ? ' admin' : ''}">${c.author_role === 'admin' ? 'Admin' : 'Editor'}</span>` : ''}<span class="muted small">${fmtDateTime(c.created_at)}</span></div><p>${esc(c.body)}</p>${user && (c.user_id === user.id || ctx.isEditor) ? '<button class="linkbtn small" data-delc>Delete</button>' : ''}</div></article>`).join('') : '<p class="muted">No comments yet. Start the conversation.</p>'}</div></section>`;
}
function wire(item, title) {
  $('post').addEventListener('click', async e => {
    if (e.target.closest('[data-like]')) { if (!user) return need(); try { await toggleLike(type, itemId, user, eng.liked); eng.likes += eng.liked ? -1 : 1; eng.liked = !eng.liked; refreshBar(); } catch (err) { toast(err.message); } }
    if (e.target.closest('[data-save]')) { if (!user) return need(); try { await toggleSave(type, itemId, user, eng.saved); eng.saved = !eng.saved; refreshBar(); toast(eng.saved ? 'Saved to your dashboard.' : 'Removed from saved.'); } catch (err) { toast(err.message); } }
    if (e.target.closest('[data-share]')) { const data = { title, text: title, url: location.href }; try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(location.href); toast('Link copied.'); } } catch { /* cancelled */ } }
    const del = e.target.closest('[data-delc]'); if (del && confirm('Delete this comment?')) { const id = del.closest('.comment').dataset.id; try { await deleteComment(id); eng.comments = eng.comments.filter(c => c.id !== id); refreshComments(); } catch (err) { toast(err.message); } }
  });
  $('post').addEventListener('input', e => { if (e.target.id === 'ctext') $('ccount').textContent = e.target.value.length + ' / 1000'; });
  $('post').addEventListener('submit', async e => { if (e.target.id !== 'cform') return; e.preventDefault(); const t = $('ctext'), body = t.value.trim(); if (!body) return; t.disabled = true; try { const row = await addComment(type, itemId, user, body); eng.comments.push(row); refreshComments(); refreshBar(); } catch (err) { toast(/slow down/i.test(err.message) ? 'Slow down a little.' : err.message); t.disabled = false; } });
}
const refreshBar = () => { document.querySelectorAll('#actbar').forEach(b => b.outerHTML = bar()); };
const refreshComments = () => { $('comments').outerHTML = comments(); };

(async () => {
  try {
    const post = slug && await loadPost(type, slug);
    if (!post) { setCrumbs([['Home', '/'], ['Posts', '/posts/'], ['Not found']]); return $('post').innerHTML = '<div class="empty"><h2>Post not found</h2><p>It may have been moved or is not published.</p><a class="btn" href="/posts/">Browse all posts</a></div>'; }
    const { item, credits } = post, T = TYPES[type], title = T.title(item); itemId = item.id;
    try { ctx = await getContext(); } catch { ctx = {}; }
    if (ctx.user) user = { id: ctx.user.id, name: ctx.profile?.display_name || ctx.user.email.split('@')[0], avatar: ctx.profile?.avatar_path || null, role: ctx.isAdmin ? 'admin' : ctx.isEditor ? 'editor' : null };
    const comms = (await loadCommunities()).rows, comm = comms.find(c => c.id === item.community_id);
    document.title = `${title} | Ilẹ̀ Abínibí Atlas`;
    { const l = document.createElement('link'); l.rel = 'canonical'; l.href = config.siteUrl.replace(/\/$/, '') + location.pathname + location.search; document.head.querySelector('link[rel=canonical]')?.remove(); document.head.append(l); }   // always the atlas.ileabinibi.com address
    setCrumbs([['Home', '/'], comm ? ['Map', '/map/'] : ['Posts', '/posts/'], ...(comm ? [[comm.preferred_name, `/city/?c=${encodeURIComponent(comm.slug)}`]] : []), [title]]);
    const text = item.body || item.summary || '', mins = readingMinutes(text);
    let meta = [];
    if (type === 'article') meta = [TOPIC_LABEL[item.topic], item.region_text, fmtDate(item.published_at)];
    if (type === 'event') { const kd = item.date_start ? K.fromGregorian(item.date_start) : null; meta = ['Event', item.location_text, item.date_start ? fmtDate(item.date_start) + (item.date_end ? ' – ' + fmtDate(item.date_end) : '') : 'Date to be confirmed', kd ? `${kd.month}, day ${kd.dayOfMonth} (Kọ́jọ́dá)` : null]; }
    if (type === 'heritage_record') meta = [item.category && item.category.replace(/_/g, ' '), item.period_text, item.language];
    eng = await loadEngagement(type, itemId, user?.id).catch(() => eng);
    const bodyHtml = item.body_html ? sanitize(item.body_html) : `<p>${esc(text).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    $('post').innerHTML = `<div class="eyebrow">${esc(T.label)}${item.evidence ? ` · <span class="badge ${esc(item.evidence)}">${esc(EV[item.evidence] || item.evidence)}</span>` : ''}</div>
      <h1>${esc(title)}</h1>
      <div class="postmeta">${meta.filter(Boolean).map(m => `<span>${esc(m)}</span>`).join('<span class="sep">·</span>')}${comm ? `<span class="sep">·</span><a href="/city/?c=${encodeURIComponent(comm.slug)}">${esc(comm.preferred_name)}</a>` : ''}<span class="sep">·</span><span>${mins} min read</span></div>
      ${creditsHtml(credits)}
      ${bar()}
      ${item.cover_url ? `<img class="cover" src="${esc(item.cover_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
      ${item.summary && item.summary !== item.body && !item.body_html ? `<p class="lede">${esc(item.summary)}</p>` : ''}
      <div class="body richbody">${bodyHtml}</div>
      ${item.sources ? `<div class="credit-box"><h2>Sources</h2><p style="margin:0;white-space:pre-line">${esc(item.sources)}</p></div>` : ''}
      ${credits.length ? `<div class="credit-box"><h2>Contributors</h2>${credits.map((c, i) => { const href = c.url || `/contributor/?c=${encodeURIComponent(c.slug)}`, ext = c.url ? ' target="_blank" rel="noopener"' : ''; return `<div class="credit-row">${avatarHtml(c.name, c.avatar, 'av')}<div><a href="${esc(href)}"${ext}>${esc(c.name)}</a><br><span class="role">${i === 0 ? 'Author' : c.role === 'editor' ? 'Editor' : 'Contributor'}</span></div><a class="btn btn-sm btn-ghost" style="margin-left:auto" href="${esc(href)}"${ext}>${c.url ? 'Visit website' : 'All work'}</a></div>`; }).join('')}</div>` : ''}
      ${bar()}
      ${comments()}
      <p style="display:flex;gap:.6rem;flex-wrap:wrap">${type === 'article' || type === 'event' ? '<a class="btn btn-ghost btn-sm" href="/contribute/?type=edit">Suggest a correction</a>' : ''}${comm ? `<a class="btn btn-ghost btn-sm" href="/city/?c=${encodeURIComponent(comm.slug)}">More from ${esc(comm.preferred_name)}</a>` : ''}</p>`;
    wire(item, title);
    const rp = $('readbar') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'readbar', innerHTML: '<i></i>' });
    const upd = () => { const a = $('post'), r = a.getBoundingClientRect(), p = Math.min(1, Math.max(0, (innerHeight - r.top) / (r.height + innerHeight * .4))); rp.firstChild.style.width = (p * 100) + '%'; };
    addEventListener('scroll', upd, { passive: true }); upd();
    if (type === 'article') {
      const rel = (await loadArticles(item.community_id || undefined)).filter(a => a.slug !== item.slug).slice(0, 3);
      if (rel.length) { const cr = await loadCredits('article', rel.map(r => r.id)); $('post').insertAdjacentHTML('beforeend', `<h2 style="font-size:var(--step-2);margin-top:var(--space-6)">Keep reading</h2><div class="stack">${rel.map(r => postCard(r, { credits: cr.get(r.id) || [] })).join('')}</div>`); }
    }
    try { const seen = JSON.parse(localStorage.getItem('atlas-recent') || '[]').filter(x => x.s !== slug || x.t !== type); seen.unshift({ t: type, s: slug, title, at: Date.now() }); localStorage.setItem('atlas-recent', JSON.stringify(seen.slice(0, 8))); } catch {}
  } catch (e) { $('post').innerHTML = `<div class="empty"><h2>Could not load this post</h2><p>${esc(e.message)}</p></div>`; }
})();
