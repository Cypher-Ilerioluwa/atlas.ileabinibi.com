// Netlify Function: admin-only Web Push sender.
// Needs env vars (Netlify > Site configuration > Environment variables, NEVER in the repo):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// POST JSON { audience: 'all'|'selected', emails?: string[], title, body, url? }  with  Authorization: Bearer <admin's Supabase access token>
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (req.method === 'GET') {   // setup check: shows which settings are present, never their values
    const missing = Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY }).filter(([, v]) => !v).map(([k]) => k);
    return json(200, { function: 'send-push', deployed: true, ready: missing.length === 0, missing, note: 'Sending requires POST from the admin panel.' });
  }
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return json(500, { error: 'Server is not configured for push yet.' });

  const token = (req.headers.get('authorization') || '').replace(/^Bearer /i, '');
  if (!token) return json(401, { error: 'Sign in required' });
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: u, error: ue } = await db.auth.getUser(token);
  if (ue || !u?.user) return json(401, { error: 'Invalid session' });
  const { data: role } = await db.from('user_roles').select('role').eq('user_id', u.user.id).eq('role', 'admin').maybeSingle();
  if (!role) return json(403, { error: 'Administrators only' });

  let body; try { body = await req.json(); } catch { return json(400, { error: 'Bad JSON' }); }
  const { audience = 'all', emails = [], title, body: text, url = '/account/#notifications' } = body;
  if (!title || String(title).length > 120) return json(400, { error: 'Title required (max 120 characters)' });

  // Resolve recipients, respecting each user's push preference.
  let ids = null;
  if (audience === 'selected') {
    const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
    const wanted = new Set(emails.map(e => String(e).toLowerCase()));
    ids = (users?.users || []).filter(x => wanted.has((x.email || '').toLowerCase())).map(x => x.id);
    if (!ids.length) return json(200, { sent: 0, failed: 0, note: 'No matching users.' });
  }
  let q = db.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').is('expired_at', null);
  if (ids) q = q.in('user_id', ids);
  const { data: subs, error } = await q.limit(5000);
  if (error) return json(500, { error: error.message });
  const { data: prefs } = await db.from('notification_prefs').select('user_id').eq('announcements', false);
  const optedOut = new Set((prefs || []).map(p => p.user_id));

  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.org', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const payload = JSON.stringify({ title, body: text || '', url });
  let sent = 0, failed = 0; const dead = [];
  await Promise.all((subs || []).filter(s => audience === 'selected' || !optedOut.has(s.user_id)).map(async s => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); sent++; }
    catch (e) { failed++; if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.id); }
  }));
  if (dead.length) await db.from('push_subscriptions').update({ expired_at: new Date().toISOString() }).in('id', dead);
  return json(200, { sent, failed, expired: dead.length });
};
