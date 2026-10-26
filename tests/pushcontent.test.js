import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNotification } from '../netlify/lib/pushContent.mjs';

const NOW = Date.parse('2026-10-26T12:00:00Z');
test('a chat message names the sender and the room, and skips the sender', () => {
  const n = buildNotification({ type: 'INSERT', table: 'chat_messages', record: { room: 'ibadan', user_id: 'u1', author_name: 'Ada', body: 'Báwo ni  gbogbo   yín' } }, { rooms: { ibadan: 'Ìbàdàn' } }, NOW);
  assert.equal(n.kind, 'chat'); assert.equal(n.title, 'Ada · Ìbàdàn'); assert.equal(n.body, 'Báwo ni gbogbo yín'); assert.equal(n.authorId, 'u1'); assert.equal(n.url, '/community/?room=ibadan');
});
test('chat: general room, photo-only message, empty message, long text', () => {
  assert.equal(buildNotification({ type: 'INSERT', table: 'chat_messages', record: { room: 'general', body: '', image_path: 'x.jpg', author_name: 'Ọlá' } }, {}, NOW).body, 'Sent a photo');
  assert.equal(buildNotification({ type: 'INSERT', table: 'chat_messages', record: { room: 'general', body: '', author_name: 'Ọlá' } }, {}, NOW), null);
  const n = buildNotification({ type: 'INSERT', table: 'chat_messages', record: { room: 'general', body: 'a'.repeat(400), author_name: 'x' } }, {}, NOW);
  assert.ok(n.body.length <= 140 && n.body.endsWith('…')); assert.match(n.title, /General$/);
});
test('shared music: title, artist, community and link', () => {
  const n = buildNotification({ type: 'INSERT', table: 'media_shares', record: { id: 'm1', status: 'published', title: 'Ifamitunlese', artist: 'Hondread', community_id: 'c1', user_id: 'u9' } }, { communities: { c1: 'Èkó (Lagos)' } }, NOW);
  assert.equal(n.title, 'New music shared'); assert.equal(n.body, 'Ifamitunlese · Hondread (Èkó (Lagos))'); assert.equal(n.url, '/media/?m=m1'); assert.equal(n.authorId, 'u9');
  assert.equal(buildNotification({ type: 'INSERT', table: 'media_shares', record: { id: 'm2', status: 'hidden', title: 't' } }, {}, NOW), null);
  assert.equal(buildNotification({ type: 'INSERT', table: 'media_shares', record: { id: 'm3', status: 'published', title: 't', invite: true } }, {}, NOW).title, 'New listening invitation');
});
test('new content: articles, other types, drafts, and bulk imports of old posts', () => {
  const art = buildNotification({ type: 'INSERT', table: 'articles', record: { status: 'published', slug: 'ife-origins', title: 'Origins of Ilé-Ifẹ̀', published_at: '2026-10-26T10:00:00Z' } }, {}, NOW);
  assert.equal(art.title, 'New article on the Atlas'); assert.equal(art.body, 'Origins of Ilé-Ifẹ̀'); assert.equal(art.url, '/post/?s=ife-origins');
  const ev = buildNotification({ type: 'INSERT', table: 'events', record: { status: 'published', slug: 'olojo', name: 'Ọlọ́jọ́ Festival' } }, {}, NOW);
  assert.equal(ev.url, '/post/?t=event&s=olojo'); assert.equal(ev.title, 'New event on the Atlas');
  assert.equal(buildNotification({ type: 'INSERT', table: 'people', record: { status: 'published', slug: 'oduduwa', preferred_name: 'Odùduwà' } }, {}, NOW).body, 'Odùduwà');
  assert.equal(buildNotification({ type: 'INSERT', table: 'articles', record: { status: 'draft', slug: 'x', title: 'x' } }, {}, NOW), null);
  assert.equal(buildNotification({ type: 'INSERT', table: 'articles', record: { status: 'published', slug: 'old', title: 'Old', published_at: '2025-01-01T00:00:00Z' } }, {}, NOW), null);
});
test('a draft that is approved notifies once; later edits do not', () => {
  const rec = { status: 'published', slug: 's', title: 'T' };
  assert.ok(buildNotification({ type: 'UPDATE', table: 'articles', record: rec, old_record: { status: 'draft' } }, {}, NOW));
  assert.equal(buildNotification({ type: 'UPDATE', table: 'articles', record: rec, old_record: { status: 'published' } }, {}, NOW), null);
});
test('unknown tables send nothing; notification tags are valid Web Push topics', () => {
  assert.equal(buildNotification({ type: 'INSERT', table: 'profiles', record: {} }, {}, NOW), null);
  const n = buildNotification({ type: 'INSERT', table: 'chat_messages', record: { room: 'ilé-ifẹ̀ & co', body: 'hi', author_name: 'a' } }, {}, NOW);
  assert.match(n.tag, /^[A-Za-z0-9_-]{1,32}$/);
});
