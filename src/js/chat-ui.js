// Discussion room UI: header with community + typing, presence, replies, reactions, read receipts.
import { createChat } from './chat-backend.js';
import { esc } from './search.js';
import { avatarHtml, avatarUrl } from './content.js';
import { toast } from './shell.js';
import { isConfigured } from './core.js';

const EMOJI = ['👍', '❤️', '😂', '🙏', '🔥', '👏', '😮', '😢'];
const PICK = ['😀', '😂', '😍', '🙏', '👍', '👏', '🔥', '❤️', '🎉', '😮', '😢', '🤝', '🌍', '☀️', '🥁', '🍲', '💬', '✨', '🙌', '😊', '🤔', '💯', '👋', '🌟'];
const hm = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayLabel = t => { const d = new Date(t), n = new Date(), y = new Date(Date.now() - 864e5); const same = (a, b) => a.toDateString() === b.toDateString(); return same(d, n) ? 'Today' : same(d, y) ? 'Yesterday' : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); };
const link = s => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

export async function mountChat(el, { ctx, rooms, initialRoom }) {
  const user = ctx.user ? { id: ctx.user.id, name: ctx.profile?.display_name || ctx.user.email.split('@')[0], avatar: ctx.profile?.avatar_path || null } : null;
  const can = Boolean(user) && !ctx.banned;
  let room = rooms.some(r => r.id === initialRoom) ? initialRoom : 'general', be, msgs = [], reacts = [], reads = new Map(), online = [], typers = new Map(), replyTo = null, unreadFrom = null, atBottom = true, newCount = 0, idleT, markT, tick;
  const roomName = () => rooms.find(r => r.id === room)?.name || 'General';

  el.innerHTML = `<div class="cx"><header class="cx-head"><div class="cx-title"><label class="visually-hidden" for="cx-room">Community</label><select id="cx-room" class="cx-room">${rooms.map(r => `<option value="${esc(r.id)}" ${r.id === room ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
      <div class="cx-sub"><span class="livedot" aria-hidden="true"></span><span id="cx-online">Connecting…</span></div></div>
      <button type="button" class="cx-stack" id="cx-stack" aria-expanded="false" aria-label="Who is online"></button><div class="cx-people" id="cx-people" hidden></div></header>
    <div class="cx-typing" id="cx-typing" aria-live="polite"></div>
    <div class="cx-log" id="cx-log" role="log" aria-label="Messages"><div class="loading"><span class="spinner"></span> Loading messages…</div></div>
    <button type="button" class="cx-down" id="cx-down" hidden aria-label="Jump to newest">↓ <span id="cx-new"></span></button>
    ${can ? `<div class="cx-compose"><div class="cx-reply" id="cx-reply" hidden></div><form id="cx-form" class="cx-form"><button type="button" class="cx-emoji" id="cx-emoji" aria-label="Add emoji">☺</button><label class="visually-hidden" for="cx-text">Message</label><textarea id="cx-text" rows="1" maxlength="500" placeholder="Message ${esc(roomName())}" autocomplete="off"></textarea><button class="cx-send" type="submit" aria-label="Send"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 20.5V3.5L21.5 12 3 20.5zM5.2 17.2L16 12 5.2 6.8v3.9L11 12l-5.8 1.3v3.9z"/></svg></button></form><div class="cx-picker" id="cx-picker" hidden>${PICK.map(e => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div></div>`
      : `<div class="cx-compose cx-lock">${ctx.banned ? 'Your account cannot post right now.' : 'Sign in to join the conversation.'} ${ctx.banned ? '' : '<a class="btn btn-gold btn-sm" href="/account/?next=/community/">Sign in / Sign up</a>'}</div>`}</div>`;
  const $ = id => el.querySelector('#' + id), log = $('cx-log');

  // ---------- rendering ----------
  const reactionsFor = id => { const m = new Map(); reacts.filter(r => r.message_id === id).forEach(r => { const o = m.get(r.emoji) || { n: 0, mine: false }; o.n++; if (user && r.user_id === user.id) o.mine = true; m.set(r.emoji, o); }); return m; };
  const seenBy = m => [...reads.values()].filter(r => r.user_id !== m.user_id && (!user || r.user_id !== user.id) && new Date(r.last_read_at) >= new Date(m.created_at));
  function render() {
    let html = '', prev = null, prevDay = '';
    msgs.forEach(m => {
      const day = dayLabel(m.created_at); if (day !== prevDay) { html += `<div class="cx-day"><span>${esc(day)}</span></div>`; prevDay = day; prev = null; }
      if (unreadFrom === m.id) html += '<div class="cx-unread"><span>New messages</span></div>';
      const mine = user && m.user_id === user.id, grouped = prev && prev.user_id === m.user_id && new Date(m.created_at) - new Date(prev.created_at) < 3e5 && unreadFrom !== m.id;
      const orig = m.reply_to && msgs.find(x => x.id === m.reply_to), rx = reactionsFor(m.id), seen = mine ? seenBy(m) : [];
      html += `<div class="cm ${mine ? 'mine' : ''} ${grouped ? 'grp' : ''}" data-id="${esc(m.id)}">${mine ? '' : `<span class="cm-av">${grouped ? '' : avatarHtml(m.author_name, m.author_avatar, 'av')}</span>`}
        <div class="cm-body">${grouped || mine ? '' : `<div class="cm-name">${esc(m.author_name)}</div>`}
          <div class="cm-bubble">${orig ? `<button type="button" class="cm-quote" data-jump="${esc(orig.id)}"><b>${esc(orig.author_name)}</b><span>${esc(orig.body.slice(0, 90))}</span></button>` : m.reply_to ? '<div class="cm-quote gone"><span>Original message was deleted</span></div>' : ''}
            <span class="cm-text">${link(m.body)}</span><span class="cm-time">${hm(m.created_at)}</span>
            <div class="cm-tools">${can ? `<button type="button" data-react-open title="React">☺</button><button type="button" data-reply title="Reply">↩</button>` : ''}${user && (mine || ctx.isEditor) ? '<button type="button" data-del title="Delete">🗑</button>' : ''}</div></div>
          ${can ? `<div class="cm-pick" hidden>${EMOJI.map(e => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div>` : ''}
          ${rx.size ? `<div class="cm-reacts">${[...rx].map(([e, o]) => `<button type="button" class="rx ${o.mine ? 'mine' : ''}" data-rx="${e}" ${can ? '' : 'disabled'}>${e} <b>${o.n}</b></button>`).join('')}</div>` : ''}
          ${mine ? `<div class="cm-receipt ${seen.length ? 'seen' : ''}" title="${seen.length ? 'Seen by ' + esc(seen.map(s => s.author_name).join(', ')) : 'Sent'}"><span class="ticks">${seen.length ? '✓✓' : '✓'}</span> ${seen.length ? 'Seen' + (seen.length > 1 ? ' by ' + seen.length : ' by ' + esc(seen[0].author_name)) : 'Sent'}</div>` : ''}</div></div>`;
      prev = m;
    });
    const keep = atBottom, h = log.scrollHeight - log.scrollTop;
    log.innerHTML = html || '<div class="empty"><h3>No messages yet</h3><p>Start the conversation.</p></div>';
    if (keep) log.scrollTop = log.scrollHeight; else log.scrollTop = log.scrollHeight - h;
  }
  function header() {
    const names = online.map(u => u.name);
    $('cx-online').textContent = online.length ? `${online.length} online` : (be?.live ? 'No one else online' : 'Preview room');
    const shown = online.slice(0, 4);
    $('cx-stack').innerHTML = shown.map(u => avatarHtml(u.name, u.avatar, 'av')).join('') + (online.length > 4 ? `<span class="av more">+${online.length - 4}</span>` : '');
    $('cx-people').innerHTML = `<b>Online now</b>${online.map(u => `<div class="cx-person">${avatarHtml(u.name, u.avatar, 'av')}<span>${esc(u.name)}${user && u.id === user.id ? ' (you)' : ''}</span></div>`).join('') || '<p class="muted small">Nobody yet.</p>'}`;
  }
  function typingBar() {
    const now = Date.now(); [...typers].forEach(([k, v]) => { if (v.until < now) typers.delete(k); });
    const t = [...typers.values()].map(v => v.user).filter(u => !user || u.id !== user.id);
    $('cx-typing').innerHTML = t.length ? `<div class="cx-typ"><span class="avs">${t.slice(0, 3).map(u => avatarHtml(u.name, u.avatar, 'av')).join('')}</span><span>${esc(t.length === 1 ? t[0].name + ' is typing' : t.length === 2 ? t[0].name + ' and ' + t[1].name + ' are typing' : t.length + ' people are typing')}</span><i class="dots"><b></b><b></b><b></b></i></div>` : '';
  }
  const near = () => log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  const setReply = id => { replyTo = id; const m = msgs.find(x => x.id === id), b = $('cx-reply'); if (!b) return; b.hidden = !m; if (m) b.innerHTML = `<div><b>Replying to ${esc(m.author_name)}</b><span>${esc(m.body.slice(0, 100))}</span></div><button type="button" aria-label="Cancel reply" data-cancel>×</button>`; if (m) $('cx-text').focus(); };
  function scheduleRead() { clearTimeout(markT); markT = setTimeout(() => { if (document.visibilityState === 'visible' && near() && user) be?.markRead(); }, 1200); }

  // ---------- events from the backend ----------
  function onEvent(ev) {
    if (ev.type === 'message') { if (msgs.some(m => m.id === ev.row.id)) return; msgs.push(ev.row); const mine = user && ev.row.user_id === user.id; if (mine) atBottom = true; else if (!atBottom) { newCount++; $('cx-down').hidden = false; $('cx-new').textContent = newCount; } render(); if (atBottom) scheduleRead(); typers.delete(ev.row.user_id); typingBar(); }
    else if (ev.type === 'message_deleted') { msgs = msgs.filter(m => m.id !== ev.id); render(); }
    else if (ev.type === 'reaction') { if (ev.op === 'add') { if (!reacts.some(r => r.id === ev.row.id)) reacts.push(ev.row); } else reacts = reacts.filter(r => !(r.message_id === ev.row.message_id && r.user_id === ev.row.user_id && r.emoji === ev.row.emoji)); render(); }
    else if (ev.type === 'read') { reads.set(ev.row.user_id, ev.row); render(); }
    else if (ev.type === 'presence') { online = ev.users; header(); }
    else if (ev.type === 'typing') { const u = ev.user; if (u.on) typers.set(u.id, { user: u, until: Date.now() + 4000 }); else typers.delete(u.id); typingBar(); }
  }

  async function open(r) {
    room = r; be?.close(); msgs = []; reacts = []; reads = new Map(); online = []; typers.clear(); replyTo = null; unreadFrom = null; newCount = 0; atBottom = true;
    log.innerHTML = '<div class="loading"><span class="spinner"></span> Loading messages…</div>'; $('cx-online').textContent = 'Connecting…'; typingBar();
    const u = new URL(location); u.searchParams.set('room', r); history.replaceState(null, '', u);
    if ($('cx-text')) $('cx-text').placeholder = `Message ${roomName()}`;
    try {
      be = await createChat({ room: r, user, onEvent });
      const h = await be.history(); msgs = h.messages; reacts = h.reactions; h.reads.forEach(x => reads.set(x.user_id, x));
      const mine = user && reads.get(user.id); if (mine) { const first = msgs.find(m => new Date(m.created_at) > new Date(mine.last_read_at) && m.user_id !== user.id); unreadFrom = first ? first.id : null; }
      render(); header(); log.scrollTop = unreadFrom ? Math.max(0, (log.querySelector('.cx-unread')?.offsetTop || 0) - 60) : log.scrollHeight; atBottom = !unreadFrom; scheduleRead();
    } catch (e) { log.innerHTML = `<div class="empty"><h3>Could not load the room</h3><p>${esc(e.message)}</p></div>`; }
  }

  // ---------- interactions ----------
  $('cx-room').addEventListener('change', e => open(e.target.value));
  $('cx-stack').addEventListener('click', () => { const p = $('cx-people'); p.hidden = !p.hidden; $('cx-stack').setAttribute('aria-expanded', String(!p.hidden)); });
  log.addEventListener('scroll', () => { atBottom = near(); if (atBottom) { newCount = 0; $('cx-down').hidden = true; scheduleRead(); } else if (log.scrollHeight - log.scrollTop - log.clientHeight > 220) $('cx-down').hidden = false; }, { passive: true });
  $('cx-down').addEventListener('click', () => { log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' }); });
  log.addEventListener('click', async e => {
    const msgEl = e.target.closest('.cm'); const id = msgEl?.dataset.id;
    if (e.target.closest('[data-jump]')) { const t = log.querySelector(`.cm[data-id="${CSS.escape(e.target.closest('[data-jump]').dataset.jump)}"]`); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1400); } return; }
    if (e.target.closest('[data-reply]')) return setReply(id);
    if (e.target.closest('[data-react-open]')) { const p = msgEl.querySelector('.cm-pick'); log.querySelectorAll('.cm-pick').forEach(x => { if (x !== p) x.hidden = true; }); p.hidden = !p.hidden; return; }
    const pe = e.target.closest('.cm-pick [data-e]'); if (pe) { msgEl.querySelector('.cm-pick').hidden = true; return toggleReaction(id, pe.dataset.e); }
    const rx = e.target.closest('[data-rx]'); if (rx) return toggleReaction(id, rx.dataset.rx);
    if (e.target.closest('[data-del]')) { if (confirm('Delete this message?')) try { await be.remove(id); } catch (err) { toast(err.message); } return; }
    if (msgEl && !e.target.closest('a')) { log.querySelectorAll('.cm.show').forEach(x => { if (x !== msgEl) x.classList.remove('show'); }); msgEl.classList.toggle('show'); }   // touch: tap a message for tools
  });
  async function toggleReaction(id, emoji) {
    const had = reacts.some(r => r.message_id === id && r.user_id === user.id && r.emoji === emoji);
    try { had ? await be.unreact(id, emoji) : await be.react(id, emoji); if (!be.live) { /* preview emits events itself */ } } catch (err) { toast(err.message); }
  }
  if (can) {
    const ta = $('cx-text'), form = $('cx-form');
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 130) + 'px'; };
    ta.addEventListener('input', () => { grow(); be?.typing(true); clearTimeout(idleT); idleT = setTimeout(() => be?.typing(false), 2500); });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } if (e.key === 'Escape') setReply(null); });
    form.addEventListener('submit', async e => {
      e.preventDefault(); const body = ta.value.trim(); if (!body || !be) return; ta.disabled = true;
      try { await be.send(body, replyTo); ta.value = ''; grow(); setReply(null); clearTimeout(idleT); be.typing(false); atBottom = true; }
      catch (err) { toast(/slow down/i.test(err.message) ? 'Slow down a little.' : err.message, 4000); }
      ta.disabled = false; ta.focus();
    });
    $('cx-reply').addEventListener('click', e => { if (e.target.closest('[data-cancel]')) setReply(null); });
    $('cx-emoji').addEventListener('click', () => { $('cx-picker').hidden = !$('cx-picker').hidden; });
    $('cx-picker').addEventListener('click', e => { const b = e.target.closest('[data-e]'); if (b) { ta.setRangeText(b.dataset.e, ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); grow(); } });
  }
  document.addEventListener('visibilitychange', scheduleRead);
  tick = setInterval(typingBar, 1000);
  await open(room);
  return { close() { clearInterval(tick); be?.close(); } };
}
