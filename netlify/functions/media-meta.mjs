// Looks up the title, artist and cover of a shared music link, so members don't have to type them.
// POST { url } with a signed-in member's Authorization header. Only links from supported streaming platforms are looked up.
import { createClient } from '@supabase/supabase-js';
import { parseMediaUrl } from '../../src/js/media-embed.js';

const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const OEMBED = {
  spotify: u => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
  youtube: u => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  youtube_music: u => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u.replace('music.youtube.com', 'www.youtube.com'))}`,
  soundcloud: u => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  deezer: u => `https://api.deezer.com/oembed?format=json&url=${encodeURIComponent(u)}`
};
export default async req => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key) return json(500, { error: 'Not configured' });
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /i, '');
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: u } = token ? await db.auth.getUser(token) : { data: null };
  if (!u?.user) return json(401, { error: 'Sign in required' });
  let body; try { body = await req.json(); } catch { return json(400, { error: 'Bad JSON' }); }
  const p = parseMediaUrl(body.url); if (!p.ok) return json(400, { error: p.reason });
  const make = OEMBED[p.platform]; if (!make) return json(200, { platform: p.platform, title: null });   // no public lookup for this platform
  try {
    const r = await fetch(make(p.url), { headers: { 'user-agent': 'IleAbinibiAtlas/1.0' }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return json(200, { platform: p.platform, title: null });
    const j = await r.json();
    return json(200, { platform: p.platform, title: String(j.title || '').slice(0, 120) || null, artist: String(j.author_name || '').slice(0, 120) || null, cover: /^https:\/\//.test(j.thumbnail_url || '') ? j.thumbnail_url : null });
  } catch { return json(200, { platform: p.platform, title: null }); }
};
