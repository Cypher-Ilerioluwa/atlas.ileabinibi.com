// Netlify Function: sends a push notification to everyone when something new is added
// (a chat message, a shared song, a new article / event / record ...).
// Called by the database (supabase/migrations/0012_push_new_content.sql), never by the browser.
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_WEBHOOK_SECRET
import { timingSafeEqual } from 'node:crypto';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { buildNotification, WATCHED_TABLES } from '../lib/pushContent.mjs';

const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const same = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && timingSafeEqual(x, y); };

export default async (req) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_WEBHOOK_SECRET } = process.env;
  if (req.method === 'GET') {   // setup check: shows which settings are present, never their values
    const missing = Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_WEBHOOK_SECRET }).filter(([, v]) => !v).map(([k]) => k);
    return json(200, { function: 'notify-new', deployed: true, ready: missing.length === 0, missing });
  }
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !PUSH_WEBHOOK_SECRET) return json(500, { error: 'Not configured yet.' });
  if (!same(req.headers.get('x-webhook-secret'), PUSH_WEBHOOK_SECRET)) return json(401, { error: 'Unauthorized' });

  let evt; try { evt = await req.json(); } catch { return json(400, { error: 'Bad JSON' }); }
  if (!WATCHED_TABLES.includes(evt.table)) return json(200, { sent: 0, note: 'Table not watched.' });
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // names for the message text
  const names = { rooms: {}, communities: {} };
  try {
    const r = evt.record || {};
    if (evt.table === 'chat_messages' && r.room && r.room !== 'general') { const { data } = await db.from('communities').select('preferred_name').eq('slug', r.room).maybeSingle(); if (data) names.rooms[r.room] = data.preferred_name; }
    if (evt.table === 'media_shares' && r.community_id) { const { data } = await db.from('communities').select('preferred_name').eq('id', r.community_id).maybeSingle(); if (data) names.communities[r.community_id] = data.preferred_name; }
  } catch { /* the text just uses the short name */ }

  const note = buildNotification(evt, names);
  if (!note) return json(200, { sent: 0, note: 'Nothing to send.' });

  // everyone with push on, except the person who made it and anyone who switched this kind off
  const off = note.kind === 'chat' ? 'chat_messages' : 'new_content';
  const [{ data: subs, error }, { data: muted }] = await Promise.all([
    db.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').is('expired_at', null).limit(20000),
    db.from('notification_prefs').select('user_id').eq(off, false),
  ]);
  if (error) return json(500, { error: error.message });
  const skip = new Set((muted || []).map(p => p.user_id)); if (note.authorId) skip.add(note.authorId);
  const targets = (subs || []).filter(s => !skip.has(s.user_id));

  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.org', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const payload = JSON.stringify({ title: note.title, body: note.body, url: note.url, tag: note.tag, open: note.open || null });
  let sent = 0, failed = 0; const dead = [];
  for (let i = 0; i < targets.length; i += 100) {   // 100 at a time
    await Promise.all(targets.slice(i, i + 100).map(async s => {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600, topic: note.tag }); sent++; }
      catch (e) { failed++; if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.id); }
    }));
  }
  if (dead.length) await db.from('push_subscriptions').update({ expired_at: new Date().toISOString() }).in('id', dead);
  return json(200, { sent, failed, expired: dead.length });
};
