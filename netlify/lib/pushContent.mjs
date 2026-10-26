// Turns a database change (sent by the Supabase trigger in 0012_push_new_content.sql) into a push notification.
// Pure functions, no network: easy to test. Returns null when nothing should be sent.
const CONTENT = {
  articles:         { label: 'article',            type: 'article',         field: 'title' },
  events:           { label: 'event',              type: 'event',           field: 'name' },
  heritage_records: { label: 'heritage record',    type: 'heritage_record', field: 'title' },
  landmarks:        { label: 'landmark',           type: 'landmark',        field: 'name' },
  people:           { label: 'notable person',     type: 'person',          field: 'preferred_name' },
  institutions:     { label: 'traditional institution', type: 'institution', field: 'name' },
  organisations:    { label: 'organisation',       type: 'organisation',    field: 'name' },
};
export const WATCHED_TABLES = ['chat_messages', 'media_shares', ...Object.keys(CONTENT)];
const MAX_AGE_MS = 3 * 24 * 3600 * 1000;   // a bulk import of old posts must not wake everyone up
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const topic = s => String(s || 'x').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'x';   // Web Push "Topic": a newer message replaces an undelivered older one

// names: { rooms: { slug: 'Ìbàdàn' }, communities: { id: 'Ìbàdàn' } } looked up by the caller
export function buildNotification({ type, table, record, old_record }, names = {}, now = Date.now()) {
  const r = record || {};
  if (table === 'chat_messages') {
    if (type !== 'INSERT') return null;
    const room = r.room || 'general', roomName = room === 'general' ? 'General' : (names.rooms?.[room] || room);
    const text = clip(r.body, 140) || (r.image_path ? 'Sent a photo' : '');
    if (!text) return null;
    const who = clip(r.author_name || 'Member', 40);
    return { kind: 'chat', authorId: r.user_id || null, title: `${who} · ${roomName}`, body: text, url: `/community/?room=${encodeURIComponent(room)}`, tag: topic('chat-' + room), open: `room=${encodeURIComponent(room)}` };
  }
  if (table === 'media_shares') {
    if (type !== 'INSERT' || r.status !== 'published') return null;
    const where = r.community_id ? names.communities?.[r.community_id] : 'General';
    return { kind: 'content', authorId: r.user_id || null, title: r.invite ? 'New listening invitation' : 'New music shared', body: clip([r.title, r.artist].filter(Boolean).join(' · ') + (where ? ` (${where})` : ''), 140), url: `/media/?m=${encodeURIComponent(r.id)}`, tag: topic('media-' + r.id) };
  }
  const c = CONTENT[table];
  if (c) {
    if (r.status !== 'published' || !r.slug) return null;
    if (type === 'UPDATE' && old_record?.status === 'published') return null;     // only the moment it goes live
    if (type !== 'INSERT' && type !== 'UPDATE') return null;
    if (r.published_at && now - new Date(r.published_at).getTime() > MAX_AGE_MS) return null;
    const name = clip(r[c.field], 120); if (!name) return null;
    return { kind: 'content', authorId: null, title: `New ${c.label} on the Atlas`, body: name, url: `/post/?${c.type === 'article' ? '' : 't=' + c.type + '&'}s=${encodeURIComponent(r.slug)}`, tag: topic(c.type + '-' + r.slug) };
  }
  return null;
}
