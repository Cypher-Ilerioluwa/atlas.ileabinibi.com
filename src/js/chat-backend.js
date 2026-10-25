// Chat transport: Supabase Realtime (messages, reactions, read receipts, presence, typing) or a local preview.
import { getClient } from './supabase.js';
import { isConfigured } from './core.js';
import { demoStore, demoSave, newId } from './api.js';
const lobbyBus = new Set();

const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const now = () => new Date().toISOString();

export async function createChat({ room, user, onEvent }) {
  return isConfigured() ? live(room, user, onEvent) : preview(room, user, onEvent);
}

async function live(room, user, onEvent) {
  const c = await getClient();
  const me = user || { id: 'visitor-' + Math.random().toString(36).slice(2), name: 'Visitor', avatar: null };
  const ch = c.channel('chat:' + room, { config: { presence: { key: me.id }, broadcast: { self: false } } });
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `room=eq.${room}` }, p => {
    if (p.eventType === 'INSERT') onEvent({ type: 'message', row: p.new }); else if (p.eventType === 'UPDATE') onEvent({ type: 'message_updated', row: p.new }); else if (p.eventType === 'DELETE') onEvent({ type: 'message_deleted', id: p.old.id });
  });
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions' }, p => {
    if (p.eventType === 'INSERT') onEvent({ type: 'reaction', op: 'add', row: p.new }); else if (p.eventType === 'DELETE') onEvent({ type: 'reaction', op: 'remove', row: p.old });
  });
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reads', filter: `room=eq.${room}` }, p => { if (p.new && p.new.user_id) onEvent({ type: 'read', row: p.new }); });
  ch.on('presence', { event: 'sync' }, () => onEvent({ type: 'presence', users: Object.values(ch.presenceState()).map(a => a[0]).filter(u => u && u.tracked) }));
  ch.on('broadcast', { event: 'typing' }, ({ payload }) => onEvent({ type: 'typing', user: payload }));
  await new Promise(res => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; ch.subscribe(async s => { if (s === 'SUBSCRIBED') { if (user) await ch.track({ id: me.id, name: me.name, avatar: me.avatar, role: me.role || null, tracked: true }); fin(); } }); setTimeout(fin, 6000); });
  let lastTyping = 0;
  return {
    live: true,
    async history() {
      const messages = must(await c.from('chat_messages').select('*').eq('room', room).order('created_at', { ascending: false }).limit(60)).reverse();
      const ids = messages.map(m => m.id);
      const reactions = ids.length ? must(await c.from('chat_reactions').select('*').in('message_id', ids)) : [];
      const reads = must(await c.from('chat_reads').select('*').eq('room', room));
      return { messages, reactions, reads };
    },
    async send(body, replyTo, imagePath) { return must(await c.from('chat_messages').insert({ room, user_id: me.id, body: body || '', reply_to: replyTo || null, image_path: imagePath || null }).select().single()); },
    async uploadImage(file) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 3145728) throw new Error('Choose a JPEG, PNG or WebP photo under 3 MB.');
      const path = `${me.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60)}`;
      const { error } = await c.storage.from('chat-media').upload(path, file, { contentType: file.type }); if (error) throw new Error(error.message); return path;
    },
    async edit(id, body) { must(await c.from('chat_messages').update({ body }).eq('id', id)); },
    async pin(id, on) { must(await c.from('chat_messages').update({ pinned: on }).eq('id', id)); },
    async react(messageId, emoji) { must(await c.from('chat_reactions').insert({ message_id: messageId, user_id: me.id, emoji })); },
    async unreact(messageId, emoji) { must(await c.from('chat_reactions').delete().eq('message_id', messageId).eq('user_id', me.id).eq('emoji', emoji)); },
    async remove(id) { must(await c.from('chat_messages').delete().eq('id', id)); },
    typing(on) { const t = Date.now(); if (on && t - lastTyping < 1800) return; lastTyping = on ? t : 0; ch.send({ type: 'broadcast', event: 'typing', payload: { id: me.id, name: me.name, avatar: me.avatar, on } }); },
    async markRead() { if (user) await c.from('chat_reads').upsert({ room, user_id: me.id, last_read_at: now() }); },
    close() { c.removeChannel(ch); }
  };
}

// Preview: everything works locally, with a sample member who reads, reacts and types.
async function preview(room, user, onEvent) {
  const d = demoStore(); d.chat ||= []; d.chatReactions ||= []; d.chatReads ||= [];
  const sample = { id: 'demo-other', name: 'Sample editor', avatar: null, role: 'editor' };
  const timers = new Set(); const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
  later(() => onEvent({ type: 'presence', users: [user, sample].filter(Boolean) }), 50);
  if (!d.chat.some(m => m.room === room)) d.chat.push({ id: newId(), room, user_id: sample.id, author_name: sample.name, author_avatar: null, body: 'Welcome to the discussion room. This is a preview: messages stay in this tab.', reply_to: null, created_at: now() });
  return {
    live: false,
    async history() { const msgs = d.chat.filter(m => m.room === room).slice(-60); return { messages: msgs, reactions: d.chatReactions.filter(r => msgs.some(m => m.id === r.message_id)), reads: d.chatReads.filter(r => r.room === room) }; },
    async uploadImage(file) { if (!/^image\//.test(file.type) || file.size > 3145728) throw new Error('Choose a photo under 3 MB.'); return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); },
    async edit(id, body) { const m = d.chat.find(x => x.id === id); if (m) { m.body = body; m.edited_at = now(); demoSave(); onEvent({ type: 'message_updated', row: m }); } },
    async pin(id, on) { const m = d.chat.find(x => x.id === id); if (m) { m.pinned = on; demoSave(); onEvent({ type: 'message_updated', row: m }); } },
    async send(body, replyTo, imagePath) {
      const m = { id: newId(), room, user_id: user.id, author_name: user.name, author_avatar: null, author_role: user.role || null, body: body || '', image_path: imagePath || null, reply_to: replyTo || null, created_at: now() };
      d.chat.push(m); demoSave(); onEvent({ type: 'message', row: m }); lobbyBus.forEach(f => f({ type: 'lobby_message', row: m }));
      later(() => onEvent({ type: 'typing', user: { ...sample, on: true } }), 500);
      later(() => { onEvent({ type: 'typing', user: { ...sample, on: false } }); const r = { id: newId(), message_id: m.id, user_id: sample.id, emoji: '👍', created_at: now() }; d.chatReactions.push(r); onEvent({ type: 'reaction', op: 'add', row: r });
        const rd = { room, user_id: sample.id, author_name: sample.name, author_avatar: null, last_read_at: now() }; d.chatReads = d.chatReads.filter(x => !(x.room === room && x.user_id === sample.id)); d.chatReads.push(rd); onEvent({ type: 'read', row: rd }); demoSave(); }, 1900);
      return m;
    },
    async react(id, emoji) { const r = { id: newId(), message_id: id, user_id: user.id, emoji, created_at: now() }; d.chatReactions.push(r); demoSave(); onEvent({ type: 'reaction', op: 'add', row: r }); },
    async unreact(id, emoji) { const r = d.chatReactions.find(x => x.message_id === id && x.user_id === user.id && x.emoji === emoji); d.chatReactions = d.chatReactions.filter(x => x !== r); demoSave(); if (r) onEvent({ type: 'reaction', op: 'remove', row: r }); },
    async remove(id) { d.chat = d.chat.filter(m => m.id !== id); demoSave(); onEvent({ type: 'message_deleted', id }); },
    typing() {},
    async markRead() {},
    close() { timers.forEach(clearTimeout); }
  };
}

/** The newest few messages of a room, for previews. */
export async function recentMessages(room = 'general', n = 3) {
  if (!isConfigured()) { const d = demoStore(); return (d.chat || []).filter(m => m.room === room).slice(-n); }
  const c = await getClient();
  return must(await c.from('chat_messages').select('*').eq('room', room).order('created_at', { ascending: false }).limit(n)).reverse();
}

/** Room list: last message and unread count per room, live. */
export async function createLobby({ user, onEvent }) {
  if (!isConfigured()) {
    const d = demoStore(); lobbyBus.add(onEvent);
    return { summary: async () => ({ msgs: [...(d.chat || [])].reverse(), reads: (d.chatReads || []).filter(r => user && r.user_id === user.id) }), close() { lobbyBus.delete(onEvent); } };
  }
  const c = await getClient();
  const ch = c.channel('lobby').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, p => onEvent({ type: 'lobby_message', row: p.new })).subscribe();
  return {
    async summary() {
      const msgs = must(await c.from('chat_messages').select('room, body, author_name, user_id, image_path, created_at').order('created_at', { ascending: false }).limit(300));
      const reads = user ? must(await c.from('chat_reads').select('room, last_read_at').eq('user_id', user.id)) : [];
      return { msgs, reads };
    },
    close() { c.removeChannel(ch); }
  };
}
