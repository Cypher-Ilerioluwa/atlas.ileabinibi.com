import { getContext, loadCommunities } from './api.js';
import { loadMedia, shareMedia, deleteMedia, lookupMeta, joinListening } from './media.js';
import { loadEngagement, toggleLike, avatarHtml } from './content.js';
import { parseMediaUrl, PLATFORMS, ALLOWED_EMBED, kindLabel, SUPPORTED_TEXT } from './media-embed.js';
import { esc, matches } from './search.js';
import { setCrumbs, setTheme } from './core.js';
import { toast } from './shell.js';

const $ = id => document.getElementById(id);
const TABS = [['all', 'All'], ['playlist', 'Playlists'], ['track', 'Tracks and albums'], ['video', 'Videos'], ['party', 'Listening parties']];
let ctx, user = null, items = [], comms = new Map(), tab = 'all', q = '', current = null, listening = null, ytReady = null;
const url = new URL(location);
setCrumbs([['Home', '/'], ['Media']]);
const fmtWhen = t => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const ago = t => { const m = Math.round((Date.now() - new Date(t)) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };

const visible = () => items.filter(m => {
  if ($('mc').value && m.community_id !== $('mc').value) return false; if ($('mp').value && m.platform !== $('mp').value) return false;
  if (tab === 'playlist' && m.kind !== 'playlist') return false; if (tab === 'track' && !['track', 'album', 'artist', 'episode', 'show'].includes(m.kind)) return false; if (tab === 'video' && m.kind !== 'video') return false; if (tab === 'party' && !m.invite) return false;
  return matches([m.title, m.artist, m.note, comms.get(m.community_id)?.preferred_name], q);
});
function tabs() { $('mtabs').innerHTML = TABS.map(([k, t]) => `<button class="chip" role="tab" data-t="${k}" aria-pressed="${k === tab}">${t}${k === 'party' ? ` <span class="muted small">${items.filter(m => m.invite).length}</span>` : ''}</button>`).join(''); }
function cover(m) { const P = PLATFORMS[m.platform]; return m.cover_url ? `<img class="mcover" src="${esc(m.cover_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<div class="mcover ph" style="--pc:${P.color}"><span>${P.glyph}</span></div>`; }
function card(m) {
  const P = PLATFORMS[m.platform], can = user && (m.user_id === user.id || ctx.isEditor), c = comms.get(m.community_id);
  return `<article class="mcard reveal ${current?.id === m.id ? 'playing' : ''}" data-id="${esc(m.id)}">${cover(m)}
    <div class="mbody"><div class="mmeta"><span class="plat" style="--pc:${P.color}">${P.label}</span><span>${kindLabel(m.kind)}</span>${c ? `<a href="/city/?c=${encodeURIComponent(c.slug)}">${esc(c.preferred_name)}</a>` : ''}</div>
      <h3>${esc(m.title)}</h3>${m.artist ? `<p class="mart">${esc(m.artist)}</p>` : ''}
      ${m.invite ? `<div class="invite">🎧 ${m.listen_at ? 'Listening party · ' + esc(fmtWhen(m.listen_at)) : 'Invitation: listen together'}</div>` : ''}
      ${m.note ? `<p class="mnote">${esc(m.note)}</p>` : ''}
      <div class="mby">${avatarHtml(m.author_name, m.author_avatar, 'av')}<span>${esc(m.author_name)}${m.author_role ? ` <span class="role">${esc(m.author_role)}</span>` : ''} · ${ago(m.created_at)}</span></div>
      <div class="mact"><button class="btn btn-sm" data-play="${esc(m.id)}">${current?.id === m.id ? 'Playing' : 'Play'}</button><button class="btn btn-sm btn-ghost" data-share="${esc(m.id)}">Share to a community</button>${can ? `<button class="btn btn-sm btn-ghost" data-del="${esc(m.id)}" aria-label="Remove">Remove</button>` : ''}</div></div></article>`;
}
function feed() {
  const list = visible();
  $('mfeed').innerHTML = list.length ? `<div class="mgrid">${list.map(card).join('')}</div>` : `<div class="empty"><h3>Nothing here yet</h3><p>Be the first to share something with a community.</p><button class="btn" data-add>Share music</button></div>`;
}

// ---------- player ----------
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
async function autoNext(m, frame) {   // best effort: YouTube single videos and SoundCloud tell us when they finish
  try {
    if (m.platform === 'youtube' && m.kind === 'video') {
      if (!window.YT?.Player) { await new Promise((res, rej) => { window.onYouTubeIframeAPIReady = res; loadScript('https://www.youtube.com/iframe_api').catch(rej); setTimeout(rej, 6000); }); }
      new window.YT.Player(frame, { events: { onStateChange: e => { if (e.data === 0) step(1); } } });
    } else if (m.platform === 'soundcloud') {
      if (!window.SC?.Widget) await loadScript('https://w.soundcloud.com/player/api.js');
      window.SC.Widget(frame).bind(window.SC.Widget.Events.FINISH, () => step(1));
    }
  } catch { /* the platform's own player keeps working without auto-next */ }
}
function stage(m) {
  const box = $('mdock'), slot = $('mstage'); listening?.leave(); listening = null;
  if (!m) { box.innerHTML = ''; box.classList.remove('is-pip'); slot.style.minHeight = ''; slot.hidden = true; return; }
  const wasHidden = slot.hidden; slot.hidden = false;
  const p = parseMediaUrl(m.url), P = PLATFORMS[m.platform], list = visible(), i = list.findIndex(x => x.id === m.id), nxt = list.slice(i + 1, i + 4);
  const embedOk = p.ok && p.embedUrl && ALLOWED_EMBED.test(p.embedUrl);
  box.innerHTML = `<div class="stage-card" style="--pc:${P.color}"><div class="stage-top"><span class="plat" style="--pc:${P.color}">${P.label}</span><span class="pip-title">${esc(m.title)}</span><span class="muted small stage-sub">${kindLabel(m.kind)} · ${esc(comms.get(m.community_id)?.preferred_name || '')}</span>
      <span class="stage-win"><button class="iconbtn" type="button" data-step="-1" aria-label="Previous" ${i <= 0 ? 'disabled' : ''}>⏮</button><button class="iconbtn" type="button" data-step="1" aria-label="Next" ${i < 0 || i >= list.length - 1 ? 'disabled' : ''}>⏭</button><button class="iconbtn" type="button" data-pip-toggle aria-label="Minimise or expand the player" id="pipbtn">▾</button><button class="iconbtn" type="button" data-close-player aria-label="Close the player">✕</button></span></div>
    ${embedOk ? `<iframe id="mframe" class="mframe" data-kind="${esc(m.kind)}" style="height:${p.height}px;--fh:${p.height}px" src="${esc(p.embedUrl)}" title="${esc(m.title)}" allow="autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-presentation allow-storage-access-by-user-activation allow-top-navigation-by-user-activation" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`
      : `<div class="linkout"><p>${P.label} does not allow playing inside other apps.</p><a class="btn btn-gold" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">Open in ${P.label}</a></div>`}
    <h3>${esc(m.title)}</h3>${m.artist ? `<p class="mart">${esc(m.artist)}</p>` : ''}
    <div class="stage-ctl">
      <button class="btn btn-sm btn-ghost" id="slike" data-like>♡ <b id="lc">0</b></button><button class="btn btn-sm btn-ghost" data-share="${esc(m.id)}">Share to a community</button>${embedOk ? `<a class="btn btn-sm btn-ghost" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">Open in ${P.label}</a>` : ''}</div>
    <div class="listeners" id="lis"></div>
    ${nxt.length ? `<div class="upnext"><b>Up next</b>${nxt.map(x => `<button class="un" data-play="${esc(x.id)}"><span class="plat sm" style="--pc:${PLATFORMS[x.platform].color}">${PLATFORMS[x.platform].glyph}</span><span>${esc(x.title)}</span></button>`).join('')}</div>` : ''}</div>`;
  const frame = $('mframe'); if (frame) autoNext(m, frame);
  if (wasHidden) { const r = slot.getBoundingClientRect(); setPip(r.bottom < 70 || r.top > innerHeight); } else syncPipBtn();
  loadEngagement('media', m.id, user?.id).then(e => { $('lc').textContent = e.likes; $('slike').dataset.liked = e.liked; $('slike').firstChild.textContent = e.liked ? '♥ ' : '♡ '; }).catch(() => {});
  joinListening(m.id, user, list2 => { const n = list2.length; $('lis') && ($('lis').innerHTML = n ? `<span class="livedot"></span>${n} listening now ${list2.slice(0, 4).map(u => avatarHtml(u.name, u.avatar, 'av')).join('')}` : ''); }).then(h => { listening = h; });
}
function play(id) { current = items.find(m => m.id === id) || null; stage(current); feed(); history.replaceState(null, '', current ? `?m=${current.id}` : location.pathname); }
// ---------- mini player (picture-in-picture style) ----------
// The player is one element that is switched between "full" (in the page) and "mini" (floating, always visible).
// It is never moved in the page, so the music does not restart when it switches.
let pipLocked = false;
function syncPipBtn() { const d = $('mdock'), b = $('pipbtn'); if (b && d) { const on = d.classList.contains('is-pip'); b.textContent = on ? '▴' : '▾'; b.setAttribute('aria-label', on ? 'Expand the player' : 'Minimise the player'); } }
function setPip(on) {
  const d = $('mdock'), slot = $('mstage'); if (!d || slot.hidden || d.classList.contains('is-pip') === on) return syncPipBtn();
  if (on) slot.style.minHeight = d.offsetHeight + 'px'; else slot.style.minHeight = '';   // keep the page from jumping
  d.classList.toggle('is-pip', on); syncPipBtn();
}
if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { if (!$('mstage').hidden && !pipLocked) setPip(e.intersectionRatio < 0.5); }, { rootMargin: '-64px 0px 0px 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }).observe($('mstage'));   // mini once less than half of it is on screen
function closePlayer() { current = null; pipLocked = false; stage(null); feed(); history.replaceState(null, '', location.pathname); }

// A short "Pick something to play" pop-up, shown only the very first time this browser opens the page.
function firstVisitHint() {
  try { if (localStorage.getItem('atlas.media.hint') === '1') return; localStorage.setItem('atlas.media.hint', '1'); } catch { return; }   // storage blocked: skip rather than nag every visit
  const el = document.createElement('div'); el.className = 'hint-pop'; el.setAttribute('role', 'status');
  el.innerHTML = '<div class="hint-card"><div class="sunmark" aria-hidden="true"></div><h3>Pick something to play</h3><p>Press Play on any card. The player follows you as you scroll.</p></div>';
  document.body.append(el); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  const done = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 450); };
  setTimeout(done, 4500); el.addEventListener('click', done);
}
firstVisitHint();

function step(n) { const list = visible(), i = list.findIndex(m => m.id === current?.id), t = list[i + n]; if (t) play(t.id); }

// ---------- dialogs ----------
const commOptions = sel => [...comms.values()].map(c => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.preferred_name)}</option>`).join('');
function needSignIn() { toast('Sign in to share music.'); setTimeout(() => { location.href = '/account/?next=/media/'; }, 900); }
function addDialog() {
  if (!user || ctx.banned) return needSignIn();
  const dlg = $('dlg'); let meta = {};
  dlg.innerHTML = `<form method="dialog" id="mf"><h2>Share music</h2><p class="muted small">Accepted: ${esc(SUPPORTED_TEXT)}.</p>
    <div class="fgrid"><div class="fld"><label for="mu">Link *</label><input id="mu" type="text" inputmode="url" placeholder="Paste a track, album or playlist link" autocomplete="off"><p class="hint" id="mhint" aria-live="polite"></p></div>
    <div class="fld twothird"><label for="mt">Title *</label><input id="mt" type="text" maxlength="120"></div><div class="fld third"><label for="ma">Artist or curator</label><input id="ma" type="text" maxlength="120"></div>
    <div class="fld"><label for="mcm">Share with community *</label><select id="mcm"><option value="">Choose a community</option>${commOptions('')}</select></div>
    <div class="fld"><label for="mn">Say something (optional)</label><textarea id="mn" rows="2" maxlength="280"></textarea></div>
    <div class="fld"><label class="chk"><input type="checkbox" id="mi"> Invite this community to listen together</label></div><div class="fld" id="mwhen" hidden><label for="mw">When (optional)</label><input id="mw" type="datetime-local"></div></div>
    <p id="merr" role="alert" class="small" style="color:var(--danger)"></p><div class="bar"><button class="btn btn-gold" value="go">Share</button><button class="btn btn-ghost" value="cancel" formnovalidate>Cancel</button></div></form>`;
  dlg.showModal();
  let timer; $('mu').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(async () => {
    const r = parseMediaUrl($('mu').value); const h = $('mhint');
    if (!$('mu').value.trim()) { h.textContent = ''; return; }
    if (!r.ok) { h.textContent = r.reason; h.style.color = 'var(--danger)'; return; }
    h.style.color = 'var(--ok)'; h.textContent = `Recognised: ${r.label} ${kindLabel(r.kind).toLowerCase()}`;
    meta = await lookupMeta($('mu').value); if (meta.title && !$('mt').value) $('mt').value = meta.title; if (meta.artist && !$('ma').value) $('ma').value = meta.artist;
  }, 350); });
  $('mi').addEventListener('change', () => { $('mwhen').hidden = !$('mi').checked; });
  dlg.querySelector('form').addEventListener('submit', async e => {
    if (e.submitter?.value !== 'go') return; e.preventDefault(); const err = $('merr'); err.textContent = '';
    const b = e.submitter; b.disabled = true;
    try { const m = await shareMedia(user, { url: $('mu').value, title: $('mt').value, artist: $('ma').value, note: $('mn').value, community_id: $('mcm').value, invite: $('mi').checked, listen_at: $('mw').value ? new Date($('mw').value).toISOString() : null, cover_url: meta.cover || null });
      dlg.close(); toast($('mi').checked ? 'Shared, and the community has been invited.' : 'Shared with the community.'); items = await loadMedia(); tabs(); feed(); play(m.id); }
    catch (ex) { err.textContent = /slow down/i.test(ex.message) ? 'Slow down a little.' : ex.message; b.disabled = false; }
  });
}
function shareDialog(id) {
  if (!user || ctx.banned) return needSignIn();
  const m = items.find(x => x.id === id), dlg = $('dlg');
  dlg.innerHTML = `<form method="dialog"><h2>Share to a community</h2><p class="muted">“${esc(m.title)}” will be added to the community you choose. Sharing stays inside Ilẹ̀ Abínibí Atlas.</p>
    <div class="fld"><label for="sc">Community *</label><select id="sc"><option value="">Choose a community</option>${commOptions('')}</select></div><div class="fld"><label for="sn">Say something (optional)</label><textarea id="sn" rows="2" maxlength="280"></textarea></div>
    <div class="fld"><label class="chk"><input type="checkbox" id="si"> Invite them to listen together</label></div><p id="serr" role="alert" class="small" style="color:var(--danger)"></p><div class="bar"><button class="btn btn-gold" value="go">Share</button><button class="btn btn-ghost" value="cancel" formnovalidate>Cancel</button></div></form>`;
  dlg.showModal();
  dlg.querySelector('form').addEventListener('submit', async e => {
    if (e.submitter?.value !== 'go') return; e.preventDefault(); const b = e.submitter; b.disabled = true;
    try { await shareMedia(user, { url: m.url, title: m.title, artist: m.artist, note: $('sn').value, community_id: $('sc').value, invite: $('si').checked, cover_url: m.cover_url, shared_from: m.id.startsWith?.('m-') ? null : m.id }); dlg.close(); toast('Shared with the community.'); items = await loadMedia(); tabs(); feed(); }
    catch (ex) { $('serr').textContent = ex.message; b.disabled = false; }
  });
}

// ---------- events ----------
document.addEventListener('click', async e => {
  const t = e.target;
  const pl = t.closest('[data-play]'); if (pl) return play(pl.dataset.play);
  const sh = t.closest('[data-share]'); if (sh) return shareDialog(sh.dataset.share);
  const st = t.closest('[data-step]'); if (st) return step(+st.dataset.step);
  if (t.closest('[data-close-player]')) return closePlayer();
  if (t.closest('[data-pip-toggle]')) { const mini = $('mdock').classList.contains('is-pip'); if (mini) { pipLocked = false; setPip(false); $('mstage').scrollIntoView({ behavior: 'smooth', block: 'center' }); } else { pipLocked = true; setPip(true); } return; }
  if (t.closest('#m-add') || t.closest('[data-add]')) return addDialog();
  const del = t.closest('[data-del]'); if (del && confirm('Remove this from the community?')) { try { await deleteMedia(del.dataset.del); if (current?.id === del.dataset.del) { current = null; pipLocked = false; stage(null); } items = await loadMedia(); tabs(); feed(); toast('Removed.'); } catch (err) { toast(err.message); } return; }
  const tb = t.closest('[data-t]'); if (tb) { tab = tb.dataset.t; tabs(); feed(); return; }
  if (t.closest('[data-like]')) { if (!user) return needSignIn(); const b = $('slike'), liked = b.dataset.liked === 'true'; try { await toggleLike('media', current.id, user, liked); const n = +$('lc').textContent + (liked ? -1 : 1); $('lc').textContent = Math.max(0, n); b.dataset.liked = String(!liked); b.firstChild.textContent = liked ? '♡ ' : '♥ '; } catch (err) { toast(err.message); } }
});
$('dlg').addEventListener('click', e => { if (e.target === $('dlg')) $('dlg').close(); });
['mc', 'mp'].forEach(id => $(id).addEventListener('change', feed)); $('mq').addEventListener('input', e => { q = e.target.value; feed(); });

(async () => {
  try { ctx = await getContext(); } catch { ctx = {}; }
  if (ctx.user) user = { id: ctx.user.id, name: ctx.profile?.display_name || ctx.user.email.split('@')[0], avatar: ctx.profile?.avatar_path || null, role: ctx.isAdmin ? 'admin' : ctx.isEditor ? 'editor' : null };
  try {
    (await loadCommunities()).rows.forEach(c => comms.set(c.id, c));
    $('mc').insertAdjacentHTML('beforeend', [...comms.values()].map(c => `<option value="${esc(c.id)}">${esc(c.preferred_name)}</option>`).join(''));
    $('mp').insertAdjacentHTML('beforeend', Object.entries(PLATFORMS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join(''));
    items = await loadMedia(); tabs(); feed();
    const want = url.searchParams.get('m'); if (want && items.some(m => m.id === want)) { play(want); document.querySelector(`[data-id="${CSS.escape(want)}"]`)?.scrollIntoView({ block: 'center' }); }
  } catch (e) { $('mfeed').innerHTML = `<div class="empty"><h3>Could not load</h3><p>${esc(e.message)}</p></div>`; }
})();
