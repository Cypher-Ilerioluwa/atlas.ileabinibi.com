// Media data: shared music and playlists, always shared to a community.
import { getClient } from './supabase.js';
import { isConfigured } from './core.js';
import { demoStore, demoSave, newId } from './api.js';
import { parseMediaUrl } from './media-embed.js';

const friendly = m => (/schema cache|media_shares|does not exist|relation .* not found/i.test(m || '')
  ? 'Music sharing is not switched on yet. An administrator needs to run supabase/migrations/0010_media.sql in Supabase (see docs/GO_LIVE.md, Part S).' : m);
const must = ({ data, error }) => { if (error) throw new Error(friendly(error.message)); return data; };
export async function loadMedia() {
  if (!isConfigured()) return [...demoStore().media_shares].filter(m => m.status === 'published').sort((a, b) => b.created_at.localeCompare(a.created_at));
  return must(await (await getClient()).from('media_shares').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(300));
}
export async function shareMedia(user, f) {
  const p = parseMediaUrl(f.url); if (!p.ok) throw new Error(p.reason);
  if (!f.community_id) throw new Error('Choose a community to share with.');
  if (!f.title || !f.title.trim()) throw new Error('Give it a title.');
  const row = { community_id: f.community_id, url: p.url, platform: p.platform, kind: p.kind, title: f.title.trim().slice(0, 120), artist: (f.artist || '').trim().slice(0, 120) || null, note: (f.note || '').trim().slice(0, 280) || null, cover_url: f.cover_url || null, invite: Boolean(f.invite), listen_at: f.listen_at || null, shared_from: f.shared_from || null };
  if (!isConfigured()) { const m = { ...row, id: newId(), user_id: user.id, author_name: user.name, author_avatar: null, author_role: null, status: 'published', created_at: new Date().toISOString() }; demoStore().media_shares.push(m); demoSave(); return m; }
  const c = await getClient();
  return must(await c.from('media_shares').insert({ ...row, user_id: user.id }).select().single());
}
export async function deleteMedia(id) {
  if (!isConfigured()) { const d = demoStore(); d.media_shares = d.media_shares.filter(m => m.id !== id); demoSave(); return; }
  must(await (await getClient()).from('media_shares').delete().eq('id', id));
}
/** Title, artist and cover from the platform, via a server function (live site only). */
export async function lookupMeta(url) {
  if (!isConfigured()) return { title: null };
  const c = await getClient(), { data: { session } } = await c.auth.getSession(); if (!session) return { title: null };
  try {
    const r = await fetch('/.netlify/functions/media-meta', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ url }) });
    return r.ok ? await r.json() : { title: null };
  } catch { return { title: null }; }
}
/** Who is listening to this item right now (live site: realtime presence). */
export async function joinListening(id, user, onCount) {
  if (!isConfigured() || !user) { onCount(user ? [user] : []); return { leave() {} }; }
  const c = await getClient(), ch = c.channel('listen:' + id, { config: { presence: { key: user.id } } });
  ch.on('presence', { event: 'sync' }, () => onCount(Object.values(ch.presenceState()).map(a => a[0]).filter(Boolean)));
  ch.subscribe(s => { if (s === 'SUBSCRIBED') ch.track({ id: user.id, name: user.name, avatar: user.avatar || null }); });
  return { leave() { c.removeChannel(ch); } };
}
