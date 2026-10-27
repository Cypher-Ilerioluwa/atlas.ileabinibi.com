// Messenger-style community chat: room list, rich messages, photos, replies, reactions, mentions, edit, pin, read receipts.
import { createChat, createLobby, searchChat } from './chat-backend.js';
import { highlight, snippet, fold } from './chat-search.js';
import { esc } from './search.js';
import { avatarHtml } from './content.js';
import { toast } from './shell.js';
import { config } from './config.js';
import { communityBadge } from './community-badge.js';

const QUICK = ['❤️', '👍', '😂', '🙏', '🔥', '👏', '😮', '😢'];
const PICK = ['😀', '😂', '😍', '🙏', '👍', '👏', '🔥', '❤️', '🎉', '😮', '😢', '🤝', '🌍', '☀️', '🥁', '🍲', '💬', '✨', '🙌', '😊', '🤔', '💯', '👋', '🌟'];
const hm = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayLabel = t => { const d = new Date(t), n = new Date(), y = new Date(Date.now() - 864e5); const same = (a, b) => a.toDateString() === b.toDateString(); return same(d, n) ? 'Today' : same(d, y) ? 'Yesterday' : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); };
const short = t => { const d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() ? hm(t) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
const imgUrl = p => (!p ? '' : p.startsWith('data:') ? p : `${config.supabaseUrl}/storage/v1/object/public/chat-media/${p}`);
const initials = n => (n || '?').trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
const badge = r => (r === 'admin' ? '<span class="rb admin">Admin</span>' : r === 'editor' ? '<span class="rb">Editor</span>' : '');
export function rich(body, me = '') {
  const keep = []; const hold = h => { keep.push(h); return `\u0000${keep.length - 1}\u0000`; };
  let t = String(body).replace(/(https?:\/\/[^\s<]+)/g, u => hold(`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u.length > 46 ? u.slice(0, 44) + '…' : u)}</a>`)).replace(/(^|\s)(\/[a-z]+\/\?[^\s<]+)/g, (m, s, u) => s + hold(`<a href="${esc(u)}" class="inlink">Open in the app →</a>`));
  t = esc(t).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|[\s(])_([^_\n]+)_/g, '$1<i>$2</i>').replace(/~([^~\n]+)~/g, '<s>$1</s>')
    .replace(/@([\p{L}\p{N}_]{2,32})/gu, (m, n) => `<span class="mention${me && n.toLowerCase() === me ? ' me' : ''}">@${n}</span>`).replace(/\n/g, '<br>');
  return t.replace(/\u0000(\d+)\u0000/g, (m, i) => keep[+i]);
}

export async function mountChat(el, { ctx, rooms, initialRoom, directOpen }) {
  const user = ctx.user ? { id: ctx.user.id, name: ctx.profile?.display_name || ctx.user.email.split('@')[0], avatar: ctx.profile?.avatar_path || null, role: ctx.isAdmin ? 'admin' : ctx.isEditor ? 'editor' : null } : null;
  const can = Boolean(user) && !ctx.banned, myTag = user ? user.name.replace(/\s+/g, '').toLowerCase() : '';
  const mobile = () => matchMedia('(max-width:900px)').matches;
  let imgT, room = rooms.some(r => r.id === initialRoom) ? initialRoom : 'general', be, lobby, msgs = [], reacts = [], reads = new Map(), online = [], typers = new Map(), replyTo = null, editing = null, unreadFrom = null, atBottom = true, newCount = 0, idleT, markT, tick, pendingImg = null, last = new Map(), unread = new Map(), lastTap = [0, ''];
  const roomOf = id => rooms.find(r => r.id === id) || rooms[0], roomName = () => roomOf(room).name;

  el.innerHTML = `<div class="cx2" id="cx2" data-view="list">
    <aside class="rl" aria-label="Rooms"><div class="rl-head"><h2>Messages</h2><label class="visually-hidden" for="rl-q">Search rooms and messages</label><input id="rl-q" type="search" placeholder="Search rooms and messages" autocomplete="off" enterkeyhint="search">
      <div class="rl-filters" role="group" aria-label="Search filter"><button type="button" class="sf on" data-sf="all" aria-pressed="true">All</button><button type="button" class="sf" data-sf="photo" aria-pressed="false">📷 Photos</button><button type="button" class="sf" data-sf="link" aria-pressed="false">🔗 Links and music</button></div></div><ul class="rl-list" id="rl-list"></ul></aside>
    <section class="cx" aria-label="Conversation"><header class="cx-head"><button class="cx-back" id="cx-back" type="button" aria-label="Back to rooms">‹</button><span class="cx-ava" id="cx-ava"></span>
      <div class="cx-title"><b id="cx-name"></b><div class="cx-sub"><span class="livedot" aria-hidden="true"></span><span id="cx-online">Connecting…</span></div></div>
      <button type="button" class="cx-find-btn" id="cx-find-btn" aria-expanded="false" aria-controls="cx-find" aria-label="Search this room"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg></button><button type="button" class="cx-stack" id="cx-stack" aria-expanded="false" aria-label="Who is online"></button><div class="cx-people" id="cx-people" hidden></div></header>
      <div class="cx-find" id="cx-find" hidden><div class="cx-find-bar"><input id="cx-fq" type="search" placeholder="Search in this room" aria-label="Search messages in this room" autocomplete="off" enterkeyhint="search"><button type="button" id="cx-fx" aria-label="Close search">✕</button></div><ul class="cx-fhits" id="cx-fhits" aria-live="polite"></ul></div>
      <button class="cx-pin" id="cx-pin" type="button" hidden></button><div class="cx-typing" id="cx-typing" aria-live="polite"></div>
      <div class="cx-log" id="cx-log" role="log" aria-label="Messages"></div><button type="button" class="cx-down" id="cx-down" hidden aria-label="Jump to newest">↓ <span id="cx-new"></span></button>
      ${can ? `<div class="cx-compose" id="cx-compose"><div class="cx-ment" id="cx-ment" hidden></div><div class="cx-reply" id="cx-reply" hidden></div><div class="cx-att" id="cx-att" hidden></div>
        <form id="cx-form" class="cx-form"><button type="button" class="cx-ico" id="cx-emoji" aria-label="Emoji">☺</button><button type="button" class="cx-ico" id="cx-attach" aria-label="Attach a photo"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9-9a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6l8.3-8.3"/></svg></button><input id="cx-file" type="file" accept="image/jpeg,image/png,image/webp" hidden>
        <label class="visually-hidden" for="cx-text">Message</label><textarea id="cx-text" rows="1" maxlength="500" placeholder="Message" autocomplete="off" enterkeyhint="send"></textarea><button class="cx-send" type="submit" aria-label="Send"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 20.5V3.5L21.5 12 3 20.5zM5.2 17.2L16 12 5.2 6.8v3.9L11 12l-5.8 1.3v3.9z"/></svg></button></form><div class="cx-picker" id="cx-picker" hidden>${PICK.map(e => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div></div>`
        : `<div class="cx-compose cx-lock">${ctx.banned ? 'Your account cannot post right now.' : 'Sign in to join the conversation.'} ${ctx.banned ? '' : '<a class="btn btn-gold btn-sm" href="/account/?next=/community/">Sign in / Sign up</a>'}</div>`}
      <div class="mm-back" id="mm-back" hidden></div><div class="mm" id="mm" hidden role="menu"></div></section></div>`;
  const $ = id => el.querySelector('#' + id), root = $('cx2'), log = $('cx-log');

  // ---------- room list ----------
  // message search state (room list)
  let hits = null, sf = 'all', sT = 0, sSeq = 0, windowed = false;
  const hitLine = (h, q) => `<i>${esc(h.user_id === user?.id ? 'You' : h.author_name)}:</i> ${h.image_path && !h.body ? '📷 Photo' : highlight(snippet(h.body, q, 90), q)}`;
  function hitsHtml() {
    if (hits == null) return '';
    const q = ($('rl-q').value || '').trim();
    if (hits === 'loading') return '<li class="rl-sec">Messages</li><li class="rl-note"><span class="spinner"></span> Searching…</li>';
    if (hits.error) return `<li class="rl-sec">Messages</li><li class="rl-note">${esc(hits.error)}</li>`;
    const shown = hits.filter(h => rooms.some(r => r.id === h.room));
    return `<li class="rl-sec">Messages${shown.length ? ` · ${shown.length}${hits.length >= 40 ? '+' : ''}` : ''}</li>` + (shown.length ? shown.map(h => `<li><button type="button" class="rl-hit" data-hit="${esc(h.id)}" data-hroom="${esc(h.room)}" data-at="${esc(h.created_at)}"><span class="rl-av">${communityBadge(roomOf(h.room), 40)}</span><span class="rl-main"><b>${esc(roomOf(h.room).name)}<time>${short(h.created_at)}</time></b><small>${hitLine(h, q)}</small></span></button></li>`).join('') : '<li class="rl-note">No messages found.</li>');
  }
  function queueSearch() {
    clearTimeout(sT); const q = ($('rl-q').value || '').trim(), active = q.length >= 2 || sf !== 'all';
    if (!active) { hits = null; sSeq++; drawRooms(); return; }
    hits = 'loading'; drawRooms(); const my = ++sSeq;
    sT = setTimeout(async () => { try { const r = await searchChat({ q, kind: sf }); if (my === sSeq) { hits = r; drawRooms(); } } catch (e) { if (my === sSeq) { hits = { error: e.message }; drawRooms(); } } }, 280);
  }
  function drawRooms() {
    const q = fold($('rl-q').value || '').trim(), list = rooms.filter(r => fold(r.name).includes(q));
    const general = list.filter(r => r.id === 'general'), rest = list.filter(r => r.id !== 'general').sort((a, b) => (last.get(b.id)?.created_at || '').localeCompare(last.get(a.id)?.created_at || '') || a.name.localeCompare(b.name));
    const roomsHtml = [...general, ...rest].map(r => { const l = last.get(r.id), n = unread.get(r.id) || 0;
      return `<li><button type="button" class="rl-item ${r.id === room ? 'on' : ''}" data-room="${esc(r.id)}"><span class="rl-av">${communityBadge(r, 48)}</span><span class="rl-main"><b>${esc(r.name)}</b><small>${l ? `${l.image_path && !l.body ? '📷 Photo' : esc((l.user_id === user?.id ? 'You' : l.author_name) + ': ' + (l.body || '').slice(0, 60))}` : 'No messages yet'}</small></span><span class="rl-meta">${l ? `<time>${short(l.created_at)}</time>` : ''}${n ? `<i class="ub">${n > 99 ? '99+' : n}</i>` : ''}</span></button></li>`; }).join('');
    $('rl-list').innerHTML = ((hits != null && roomsHtml ? '<li class="rl-sec">Rooms</li>' : '') + roomsHtml + hitsHtml()) || '<li class="muted" style="padding:1rem">No rooms match.</li>';
  }
  async function loadLobby() {
    lobby = await createLobby({ user, onEvent: ev => {
      if (ev.type !== 'lobby_message') return; const m = ev.row, cur = m.room === room && root.dataset.view === 'chat' && document.visibilityState === 'visible';
      last.set(m.room, m); if (!cur && m.user_id !== user?.id) unread.set(m.room, (unread.get(m.room) || 0) + 1); drawRooms(); } });
    const { msgs: all, reads: mine } = await lobby.summary(), readAt = new Map(mine.map(r => [r.room, r.last_read_at]));
    all.forEach(m => { if (!last.has(m.room)) last.set(m.room, m); if (readAt.has(m.room) && new Date(m.created_at) > new Date(readAt.get(m.room)) && m.user_id !== user?.id) unread.set(m.room, (unread.get(m.room) || 0) + 1); });
    drawRooms();
  }

  // ---------- conversation ----------
  const reactionsFor = id => { const m = new Map(); reacts.filter(r => r.message_id === id).forEach(r => { const o = m.get(r.emoji) || { n: 0, mine: false }; o.n++; if (user && r.user_id === user.id) o.mine = true; m.set(r.emoji, o); }); return m; };
  const seenBy = m => [...reads.values()].filter(r => r.user_id !== m.user_id && (!user || r.user_id !== user.id) && new Date(r.last_read_at) >= new Date(m.created_at));
  function render() {
    let html = '', prev = null, prevDay = '';
    msgs.forEach(m => {
      const day = dayLabel(m.created_at); if (day !== prevDay) { html += `<div class="cx-day"><span>${esc(day)}</span></div>`; prevDay = day; prev = null; }
      if (unreadFrom === m.id) html += '<div class="cx-unread"><span>New messages</span></div>';
      const mine = user && m.user_id === user.id, grouped = prev && prev.user_id === m.user_id && new Date(m.created_at) - new Date(prev.created_at) < 3e5 && unreadFrom !== m.id;
      const orig = m.reply_to && msgs.find(x => x.id === m.reply_to), rx = reactionsFor(m.id), seen = mine && !m.state ? seenBy(m) : [];
      html += `<div class="cm ${mine ? 'mine' : ''} ${grouped ? 'grp' : ''} ${m.pinned ? 'pinned' : ''} ${m.state || ''}" data-id="${esc(m.id)}">${mine ? '' : `<button class="cm-av" data-person="${esc(m.user_id)}" aria-label="${esc(m.author_name)}">${grouped ? '' : avatarHtml(m.author_name, m.author_avatar, 'av')}</button>`}
        <div class="cm-body">${grouped || mine ? '' : `<div class="cm-name"><button data-person="${esc(m.user_id)}">${esc(m.author_name)}</button>${badge(m.author_role)}</div>`}
          <div class="cm-bubble">${m.pinned ? '<span class="cm-pinmark" title="Pinned">📌</span>' : ''}${orig ? `<button type="button" class="cm-quote" data-jump="${esc(orig.id)}"><b>${esc(orig.author_name)}</b><span>${esc(orig.image_path && !orig.body ? '📷 Photo' : orig.body.slice(0, 90))}</span></button>` : m.reply_to ? '<div class="cm-quote gone"><span>Original message was deleted</span></div>' : ''}
            ${m.image_path ? `<button class="cm-img" data-img="${esc(m.image_path)}"><img src="${esc(imgUrl(m.image_path))}" alt="Photo shared in the chat" loading="lazy"></button>` : ''}
            ${m.body ? `<span class="cm-text">${rich(m.body, myTag)}</span>` : ''}<span class="cm-time">${m.edited_at ? 'edited · ' : ''}${hm(m.created_at)}${m.state === 'sending' ? ' ⏳' : ''}</span>
            ${can && !m.state ? `<div class="cm-tools"><button type="button" data-heart title="Like">♡</button><button type="button" data-reply title="Reply">↩</button><button type="button" data-more title="More">⋯</button></div>` : ''}</div>
          ${m.state === 'failed' ? '<div class="cm-fail">Not sent. <button data-retry>Retry</button> <button data-discard>Discard</button></div>' : ''}
          ${rx.size ? `<div class="cm-reacts">${[...rx].map(([e, o]) => `<button type="button" class="rx ${o.mine ? 'mine' : ''}" data-rx="${e}" ${can ? '' : 'disabled'}>${e} <b>${o.n}</b></button>`).join('')}</div>` : ''}
          ${mine && !m.state ? `<div class="cm-receipt ${seen.length ? 'seen' : ''}" title="${seen.length ? 'Seen by ' + esc(seen.map(s => s.author_name).join(', ')) : 'Sent'}"><span class="ticks">${seen.length ? '✓✓' : '✓'}</span> ${seen.length ? 'Seen' + (seen.length > 1 ? ' by ' + seen.length : ' by ' + esc(seen[0].author_name)) : 'Sent'}</div>` : ''}</div></div>`;
      prev = m;
    });
    const keep = atBottom, h = log.scrollHeight - log.scrollTop;
    log.innerHTML = html || '<div class="empty"><h3>No messages yet</h3><p>Say hello and start the conversation.</p></div>';
    log.scrollTop = keep ? log.scrollHeight : log.scrollHeight - h;
    const pin = [...msgs].reverse().find(m => m.pinned); $('cx-pin').hidden = !pin; if (pin) { $('cx-pin').dataset.id = pin.id; $('cx-pin').innerHTML = `<span>📌 Pinned</span><b>${esc(pin.author_name)}:</b> ${esc((pin.body || '📷 Photo').slice(0, 80))}`; }
  }
  function header() {
    $('cx-name').textContent = roomName(); $('cx-ava').innerHTML = communityBadge(roomOf(room), 44);
    $('cx-online').textContent = online.length ? `${online.length} online` : (be?.live ? 'No one else online' : 'Preview room');
    $('cx-stack').innerHTML = online.slice(0, 4).map(u => avatarHtml(u.name, u.avatar, 'av')).join('') + (online.length > 4 ? `<span class="av more">+${online.length - 4}</span>` : '');
    $('cx-people').innerHTML = `<b>Online now</b>${online.map(u => `<div class="cx-person">${avatarHtml(u.name, u.avatar, 'av')}<span>${esc(u.name)}${user && u.id === user.id ? ' (you)' : ''}</span>${badge(u.role)}</div>`).join('') || '<p class="muted small">Nobody yet.</p>'}`;
  }
  function typingBar() {
    const now = Date.now(); [...typers].forEach(([k, v]) => { if (v.until < now) typers.delete(k); });
    const t = [...typers.values()].map(v => v.user).filter(u => !user || u.id !== user.id);
    $('cx-typing').innerHTML = t.length ? `<div class="cx-typ"><span class="avs">${t.slice(0, 3).map(u => avatarHtml(u.name, u.avatar, 'av')).join('')}</span><span>${esc(t.length === 1 ? t[0].name + ' is typing' : t.length === 2 ? t[0].name + ' and ' + t[1].name + ' are typing' : t.length + ' people are typing')}</span><i class="dots"><b></b><b></b><b></b></i></div>` : '';
  }
  const near = () => log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  function scheduleRead() { clearTimeout(markT); markT = setTimeout(() => { if (document.visibilityState === 'visible' && near() && !windowed && user && root.dataset.view === 'chat') { be?.markRead(); unread.set(room, 0); drawRooms(); } }, 1000); }
  const sorted = () => msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  function onEvent(ev) {
    if (ev.type === 'message' && windowed) { if (ev.row.user_id !== user?.id) { newCount++; $('cx-down').hidden = false; $('cx-new').textContent = newCount; } return; }
    if (ev.type === 'message') { if (msgs.some(m => m.id === ev.row.id)) return; msgs.push(ev.row); sorted(); const mine = user && ev.row.user_id === user.id; if (mine) atBottom = true; else if (!atBottom) { newCount++; $('cx-down').hidden = false; $('cx-new').textContent = newCount; } render(); if (atBottom) scheduleRead(); typers.delete(ev.row.user_id); typingBar(); }
    else if (ev.type === 'message_updated') { const i = msgs.findIndex(m => m.id === ev.row.id); if (i >= 0) { msgs[i] = { ...msgs[i], ...ev.row }; render(); } }
    else if (ev.type === 'message_deleted') { msgs = msgs.filter(m => m.id !== ev.id); render(); }
    else if (ev.type === 'reaction') { if (ev.op === 'add') { if (!reacts.some(r => r.id === ev.row.id)) reacts.push(ev.row); } else reacts = reacts.filter(r => !(r.message_id === ev.row.message_id && r.user_id === ev.row.user_id && r.emoji === ev.row.emoji)); render(); }
    else if (ev.type === 'read') { reads.set(ev.row.user_id, ev.row); render(); }
    else if (ev.type === 'presence') { online = ev.users; header(); }
    else if (ev.type === 'typing') { const u = ev.user; if (u.on) typers.set(u.id, { user: u, until: Date.now() + 4000 }); else typers.delete(u.id); typingBar(); }
  }
  function focusMsg(id) { const t = log.querySelector(`.cm[data-id="${CSS.escape(id)}"]`); if (!t) return false; t.scrollIntoView({ block: 'center' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1600); return true; }
  async function open(r, focus) {
    windowed = false; $('cx-find').hidden = true; $('cx-fq').value = ''; $('cx-fhits').innerHTML = ''; room = r; be?.close(); msgs = []; reacts = []; reads = new Map(); online = []; typers.clear(); replyTo = null; editing = null; unreadFrom = null; newCount = 0; atBottom = true; closeMenu();
    setReply(null); header(); log.innerHTML = '<div class="loading"><span class="spinner"></span> Loading messages…</div>'; $('cx-online').textContent = 'Connecting…'; typingBar(); drawRooms();
    const u = new URL(location); u.searchParams.set('room', r); history.replaceState(history.state, '', u);
    if ($('cx-text')) $('cx-text').placeholder = `Message ${roomName()}`;
    try {
      be = await createChat({ room: r, user, onEvent });
      const h = await be.history(focus); msgs = h.messages; reacts = h.reactions; h.reads.forEach(x => reads.set(x.user_id, x));
      const mine = user && reads.get(user.id); if (mine) { const first = msgs.find(m => new Date(m.created_at) > new Date(mine.last_read_at) && m.user_id !== user.id); unreadFrom = first ? first.id : null; }
      if (focus && msgs.some(m => m.id === focus.id)) { windowed = !!h.windowed; unreadFrom = null; render(); header(); atBottom = false; focusMsg(focus.id); $('cx-down').hidden = !windowed && near(); if (!windowed) scheduleRead(); return; }
      render(); header(); log.scrollTop = unreadFrom ? Math.max(0, (log.querySelector('.cx-unread')?.offsetTop || 0) - 60) : log.scrollHeight; atBottom = !unreadFrom; scheduleRead();
    } catch (e) { log.innerHTML = `<div class="empty"><h3>Could not load the room</h3><p>${esc(e.message)}</p></div>`; }
  }
  function showChat(r, focus) { root.dataset.view = 'chat'; if (mobile()) { document.body.classList.add('chat-open'); history.pushState({ chat: r }, ''); } open(r, focus); }
  function showList() { root.dataset.view = 'list'; document.body.classList.remove('chat-open'); closeMenu(); }
  addEventListener('popstate', () => { if (root.dataset.view === 'chat' && mobile()) showList(); });
  // never leave the page locked: if the list is showing (or the page comes back from the cache), the chat's scroll lock must be off
  const unlock = () => { if (root.dataset.view !== 'chat' || !mobile()) document.body.classList.remove('chat-open'); };
  addEventListener('pageshow', unlock); addEventListener('resize', unlock); document.addEventListener('visibilitychange', unlock); unlock();
  $('cx-back').addEventListener('click', () => { if (history.state?.chat) history.back(); else showList(); });
  $('rl-list').addEventListener('click', e => {
    const h = e.target.closest('[data-hit]'); if (h) return showChat(h.dataset.hroom, { id: h.dataset.hit, at: h.dataset.at });
    const b = e.target.closest('[data-room]'); if (b) showChat(b.dataset.room);
  });
  $('rl-q').addEventListener('input', queueSearch);
  $('rl-q').addEventListener('keydown', e => { if (e.key === 'Escape') { e.target.value = ''; queueSearch(); } });
  el.querySelector('.rl-filters').addEventListener('click', e => { const b = e.target.closest('[data-sf]'); if (!b) return; sf = b.dataset.sf; el.querySelectorAll('.rl-filters .sf').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); queueSearch(); });
  $('cx-stack').addEventListener('click', () => { const p = $('cx-people'); p.hidden = !p.hidden; $('cx-stack').setAttribute('aria-expanded', String(!p.hidden)); });
  $('cx-pin').addEventListener('click', () => { const t = log.querySelector(`.cm[data-id="${CSS.escape($('cx-pin').dataset.id)}"]`); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1400); } });
  log.addEventListener('scroll', () => { atBottom = near(); if (atBottom) { newCount = 0; $('cx-down').hidden = true; scheduleRead(); } else if (log.scrollHeight - log.scrollTop - log.clientHeight > 220) $('cx-down').hidden = false; }, { passive: true });
  // ---------- search inside the open room ----------
  const fp = $('cx-find'), fq = $('cx-fq'), fh = $('cx-fhits'); let fT = 0, fSeq = 0;
  function findOpen(on) { fp.hidden = !on; $('cx-find-btn').setAttribute('aria-expanded', on); if (on) { fp.style.top = el.querySelector('.cx-head').offsetHeight + 'px'; fq.focus(); fq.select(); } else { fq.blur(); } }
  function findRun() {
    clearTimeout(fT); const q = fq.value.trim(); if (q.length < 2) { fh.innerHTML = q ? '<li class="rl-note">Type at least 2 letters.</li>' : ''; fSeq++; return; }
    fh.innerHTML = '<li class="rl-note"><span class="spinner"></span> Searching…</li>'; const my = ++fSeq;
    fT = setTimeout(async () => { try { const r = await searchChat({ q, room }); if (my !== fSeq) return;
      fh.innerHTML = r.length ? r.map(h => `<li><button type="button" class="rl-hit" data-fhit="${esc(h.id)}" data-at="${esc(h.created_at)}"><span class="rl-main"><b>${esc(h.user_id === user?.id ? 'You' : h.author_name)} <time>${short(h.created_at)}</time></b><small>${h.image_path && !h.body ? '📷 Photo' : highlight(snippet(h.body, q, 110), q)}</small></span></button></li>`).join('') : '<li class="rl-note">No messages found in this room.</li>';
    } catch (e) { if (my === fSeq) fh.innerHTML = `<li class="rl-note">${esc(e.message)}</li>`; } }, 260);
  }
  $('cx-find-btn').addEventListener('click', () => findOpen(fp.hidden));
  $('cx-fx').addEventListener('click', () => findOpen(false));
  fq.addEventListener('input', findRun);
  fq.addEventListener('keydown', e => { if (e.key === 'Escape') findOpen(false); });
  fh.addEventListener('click', async e => { const b = e.target.closest('[data-fhit]'); if (!b) return; findOpen(false); if (!focusMsg(b.dataset.fhit)) await open(room, { id: b.dataset.fhit, at: b.dataset.at }); });
  $('cx-down').addEventListener('click', () => { if (windowed) { open(room); return; } log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' }); });

  // ---------- message actions ----------
  const find = id => msgs.find(m => m.id === id);
  async function react(id, emoji) { const had = reacts.some(r => r.message_id === id && r.user_id === user.id && r.emoji === emoji); try { had ? await be.unreact(id, emoji) : await be.react(id, emoji); } catch (err) { toast(err.message); } }
  function closeMenu() { $('mm').hidden = $('mm-back').hidden = true; }
  function openMenu(id) {
    const m = find(id); if (!m || m.state) return; const mine = user && m.user_id === user.id, mm = $('mm');
    mm.innerHTML = `${can ? `<div class="mm-emojis">${QUICK.map(e => `<button data-mr="${e}" aria-label="React ${e}">${e}</button>`).join('')}</div>` : ''}<div class="mm-list">${can ? '<button data-ma="reply">↩ Reply</button>' : ''}${m.body ? '<button data-ma="copy">⧉ Copy text</button>' : ''}${mine && m.body ? '<button data-ma="edit">✎ Edit</button>' : ''}${ctx.isEditor ? `<button data-ma="pin">📌 ${m.pinned ? 'Unpin' : 'Pin to the top'}</button>` : ''}${mine || ctx.isEditor ? '<button data-ma="del" class="danger">🗑 Delete</button>' : ''}</div>`;
    mm.dataset.id = id; mm.hidden = $('mm-back').hidden = false;
  }
  $('mm-back').addEventListener('click', closeMenu);
  $('mm').addEventListener('click', async e => {
    const id = $('mm').dataset.id, m = find(id); const em = e.target.closest('[data-mr]'); if (em) { closeMenu(); return react(id, em.dataset.mr); }
    const a = e.target.closest('[data-ma]')?.dataset.ma; if (!a) return; closeMenu();
    if (a === 'reply') setReply(id);
    if (a === 'copy') { try { await navigator.clipboard.writeText(m.body); toast('Copied.'); } catch { toast('Could not copy.'); } }
    if (a === 'edit') { editing = id; setReply(null); const ta = $('cx-text'); ta.value = m.body; ta.focus(); setBar(`<div><b>Editing message</b><span>${esc(m.body.slice(0, 100))}</span></div><button type="button" aria-label="Cancel" data-cancel>×</button>`); }
    if (a === 'pin') { try { await be.pin(id, !m.pinned); } catch (err) { toast(err.message); } }
    if (a === 'del' && confirm('Delete this message?')) try { await be.remove(id); } catch (err) { toast(err.message); }
  });
  let pressT; const startPress = e => { const b = e.target.closest('.cm-bubble'); if (!b || e.target.closest('a,button')) return; const id = b.closest('.cm').dataset.id; pressT = setTimeout(() => { navigator.vibrate?.(12); openMenu(id); }, 480); };
  const endPress = () => clearTimeout(pressT);
  log.addEventListener('touchstart', startPress, { passive: true }); log.addEventListener('touchend', endPress); log.addEventListener('touchmove', endPress, { passive: true }); log.addEventListener('touchcancel', endPress);
  log.addEventListener('contextmenu', e => { const b = e.target.closest('.cm-bubble'); if (b) { e.preventDefault(); openMenu(b.closest('.cm').dataset.id); } });
  log.addEventListener('click', async e => {
    const msgEl = e.target.closest('.cm'), id = msgEl?.dataset.id;
    const jump = e.target.closest('[data-jump]'); if (jump) { const t = log.querySelector(`.cm[data-id="${CSS.escape(jump.dataset.jump)}"]`); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1400); } return; }
    const img = e.target.closest('[data-img]');
    if (img) {   // one tap opens the photo; a quick second tap likes the message
      const now = Date.now(); if (can && lastTap[1] === id && now - lastTap[0] < 320 && !find(id).state) { clearTimeout(imgT); lastTap = [0, '']; navigator.vibrate?.(8); heartBurst(msgEl); return react(id, '❤️'); }
      lastTap = [now, id]; clearTimeout(imgT); imgT = setTimeout(() => lightbox(imgUrl(img.dataset.img)), 330); return;
    }
    if (e.target.closest('[data-reply]')) return setReply(id); if (e.target.closest('[data-more]')) return openMenu(id); if (e.target.closest('[data-heart]')) return react(id, '❤️');
    const rx = e.target.closest('[data-rx]'); if (rx) return react(id, rx.dataset.rx);
    const person = e.target.closest('[data-person]'); if (person) return profileCard(person.dataset.person);
    if (e.target.closest('[data-retry]')) return resend(id); if (e.target.closest('[data-discard]')) { msgs = msgs.filter(m => m.id !== id); return render(); }
    if (msgEl && !e.target.closest('a')) {   // double tap / double click = like
      const now = Date.now(); if (can && lastTap[1] === id && now - lastTap[0] < 320 && !find(id).state) { lastTap = [0, '']; navigator.vibrate?.(8); heartBurst(msgEl); return react(id, '❤️'); } lastTap = [now, id];
      log.querySelectorAll('.cm.show').forEach(x => { if (x !== msgEl) x.classList.remove('show'); }); msgEl.classList.toggle('show');
    }
  });
  function heartBurst(node) { const h = document.createElement('span'); h.className = 'burst'; h.textContent = '❤️'; node.querySelector('.cm-bubble').append(h); setTimeout(() => h.remove(), 800); }
  function lightbox(src) { const d = document.createElement('div'); d.className = 'lb'; d.innerHTML = `<button aria-label="Close">×</button><img src="${esc(src)}" alt="Photo">`; d.addEventListener('click', () => d.remove()); document.body.append(d); }
  function profileCard(uid) {
    const m = [...msgs].reverse().find(x => x.user_id === uid), on = online.some(u => u.id === uid); if (!m) return;
    const card = $('mm'); card.innerHTML = `<div class="pc">${avatarHtml(m.author_name, m.author_avatar, 'av big')}<b>${esc(m.author_name)}</b>${badge(m.author_role)}<span class="muted small">${on ? '● Online now' : 'Not online'}</span>${can && user.id !== uid ? `<button class="btn btn-sm" data-mention="${esc(m.author_name)}">Mention</button>` : ''}</div>`; card.dataset.id = ''; card.hidden = $('mm-back').hidden = false;
    card.querySelector('[data-mention]')?.addEventListener('click', ev => { closeMenu(); const ta = $('cx-text'); ta.value += `${ta.value && !ta.value.endsWith(' ') ? ' ' : ''}@${ev.target.dataset.mention.replace(/\s+/g, '')} `; ta.focus(); });
  }

  // ---------- composer ----------
  const setBar = html => { const b = $('cx-reply'); b.hidden = !html; b.innerHTML = html || ''; };
  function setReply(id) { replyTo = id; editing = null; if (!$('cx-reply')) return; const m = id && find(id); setBar(m ? `<div><b>Replying to ${esc(m.author_name)}</b><span>${esc((m.body || '📷 Photo').slice(0, 100))}</span></div><button type="button" aria-label="Cancel reply" data-cancel>×</button>` : ''); if (m) $('cx-text').focus(); }
  function setAtt(file) { pendingImg = file; const a = $('cx-att'); a.hidden = !file; a.innerHTML = file ? `<div class="att"><img src="${URL.createObjectURL(file)}" alt="Photo to send"><button type="button" aria-label="Remove photo" data-noatt>×</button></div>` : ''; }
  async function send() {
    const ta = $('cx-text'), body = ta.value.trim(); if (!body && !pendingImg) return;
    if (windowed) await open(room);   // sending from an old search result: go back to the newest messages first
    if (editing) { try { await be.edit(editing, body); } catch (err) { toast(err.message); } editing = null; setBar(''); ta.value = ''; grow(); return; }
    const file = pendingImg, reply = replyTo, temp = { id: 'tmp-' + Math.random().toString(36).slice(2), room, user_id: user.id, author_name: user.name, author_avatar: user.avatar, author_role: user.role, body, reply_to: reply, image_path: file ? URL.createObjectURL(file) : null, created_at: new Date().toISOString(), state: 'sending', _file: file };
    msgs.push(temp); atBottom = true; ta.value = ''; grow(); setReply(null); setAtt(null); render(); be.typing(false); await commit(temp);
  }
  async function commit(temp) {
    try { const path = temp._file ? await be.uploadImage(temp._file) : null, row = await be.send(temp.body, temp.reply_to, path); msgs = msgs.filter(m => m.id !== temp.id); if (!msgs.some(m => m.id === row.id)) msgs.push(row); sorted(); render(); }
    catch (err) { const m = msgs.find(x => x.id === temp.id); if (m) { m.state = 'failed'; render(); } toast(/slow down/i.test(err.message) ? 'Slow down a little.' : err.message, 4000); }
  }
  async function resend(id) { const m = find(id); if (!m) return; m.state = 'sending'; m.created_at = new Date().toISOString(); render(); await commit(m); }
  const grow = () => { const ta = $('cx-text'); ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 130) + 'px'; };
  function mentions() {
    const ta = $('cx-text'), before = ta.value.slice(0, ta.selectionStart), m = /(?:^|\s)@([\p{L}\p{N}_]*)$/u.exec(before), box = $('cx-ment');
    if (!m) { box.hidden = true; return; }
    const names = new Map(); [...msgs.map(x => [x.user_id, x.author_name, x.author_avatar]), ...online.map(u => [u.id, u.name, u.avatar])].forEach(([id, n, a]) => { if (id !== user.id && n) names.set(id, [n, a]); });
    const list = [...names.values()].filter(([n]) => n.replace(/\s+/g, '').toLowerCase().startsWith(m[1].toLowerCase())).slice(0, 5);
    box.hidden = !list.length; box.innerHTML = list.map(([n, a]) => `<button type="button" data-name="${esc(n)}">${avatarHtml(n, a, 'av')}<span>${esc(n)}</span></button>`).join('');
  }
  if (can) {
    const ta = $('cx-text'), form = $('cx-form');
    ta.addEventListener('input', () => { grow(); mentions(); be?.typing(true); clearTimeout(idleT); idleT = setTimeout(() => be?.typing(false), 2500); });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window && matchMedia('(max-width:900px)').matches)) { const first = $('cx-ment').querySelector('button'); if (!$('cx-ment').hidden && first) { e.preventDefault(); first.click(); return; } e.preventDefault(); form.requestSubmit(); } if (e.key === 'Escape') { setReply(null); editing = null; setBar(''); } });
    form.addEventListener('submit', e => { e.preventDefault(); send(); ta.focus(); });
    $('cx-reply').addEventListener('click', e => { if (e.target.closest('[data-cancel]')) { setReply(null); editing = null; setBar(''); ta.value = ''; grow(); } });
    $('cx-ment').addEventListener('click', e => { const b = e.target.closest('[data-name]'); if (!b) return; const pos = ta.selectionStart, before = ta.value.slice(0, pos).replace(/@[\p{L}\p{N}_]*$/u, `@${b.dataset.name.replace(/\s+/g, '')} `); ta.value = before + ta.value.slice(pos); ta.focus(); $('cx-ment').hidden = true; });
    $('cx-emoji').addEventListener('click', () => { $('cx-picker').hidden = !$('cx-picker').hidden; });
    $('cx-picker').addEventListener('click', e => { const b = e.target.closest('[data-e]'); if (b) { ta.setRangeText(b.dataset.e, ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); grow(); } });
    $('cx-attach').addEventListener('click', () => $('cx-file').click());
    $('cx-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 3145728) return toast('Choose a JPEG, PNG or WebP photo under 3 MB.'); setAtt(f); });
    $('cx-att').addEventListener('click', e => { if (e.target.closest('[data-noatt]')) setAtt(null); });
  }
  document.addEventListener('visibilitychange', scheduleRead);
  tick = setInterval(typingBar, 1000);
  try { await loadLobby(); } catch (e) { $('rl-list').innerHTML = `<li class="muted" style="padding:1rem">${esc(e.message)}</li>`; }
  header();
  if (directOpen || !mobile()) { root.dataset.view = 'chat'; await open(room); if (mobile() && directOpen) { document.body.classList.add('chat-open'); history.pushState({ chat: room }, ''); } }
  return { close() { clearInterval(tick); be?.close(); lobby?.close(); document.body.classList.remove('chat-open'); } };
}
