// Admin-triggered import from ileabinibi.com. GET = setup check. POST (admin only) = run the import now.
import { createClient } from '@supabase/supabase-js';
import { runSync } from '../lib/wpSync.mjs';

const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
export default async req => {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  const missing = Object.entries({ SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key }).filter(([, v]) => !v).map(([k]) => k);
  if (req.method === 'GET') return json(200, { function: 'wp-sync', deployed: true, ready: missing.length === 0, missing });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (missing.length) return json(500, { error: 'Missing Netlify settings: ' + missing.join(', ') });
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /i, '');
  if (!token) return json(401, { error: 'Sign in required' });
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: u } = await db.auth.getUser(token);
  if (!u?.user) return json(401, { error: 'Invalid session' });
  const { data: role } = await db.from('user_roles').select('role').eq('user_id', u.user.id).eq('role', 'admin').maybeSingle();
  if (!role) return json(403, { error: 'Administrators only' });
  try { return json(200, await runSync({ url, key })); } catch (e) { return json(502, { error: e.message }); }
};
