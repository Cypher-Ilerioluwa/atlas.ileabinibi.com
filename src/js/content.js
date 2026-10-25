// Posts, credits and contributor pages (works with Supabase, or the preview data).
import { config } from './config.js';
import { getClient } from './supabase.js';
import { isConfigured, slugify } from './core.js';
import { demoStore, demoSave, newId } from './api.js';

export const TYPES = {
  article: { view: 'articles_public', table: 'articles', label: 'Article', title: r => r.title, date: r => r.published_at },
  event: { view: 'events_public', table: 'events', label: 'Event', title: r => r.name, date: r => r.date_start },
  heritage_record: { view: 'heritage_records_public', table: 'heritage_records', label: 'Heritage record', title: r => r.title, date: r => r.last_reviewed_at },
  landmark: { view: 'landmarks_public', table: 'landmarks', label: 'Landmark', title: r => r.name, date: r => r.last_reviewed_at },
  person: { view: 'people_public', table: 'people', label: 'Notable person', title: r => r.preferred_name, date: r => r.last_reviewed_at },
  institution: { view: 'institutions_public', table: 'institutions', label: 'Institution', title: r => r.name, date: r => r.last_reviewed_at },
  organisation: { view: 'organisations_public', table: 'organisations', label: 'Organisation', title: r => r.name, date: r => r.last_confirmed_at }
};
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
export const avatarUrl = p => (p && config.supabaseUrl ? `${config.supabaseUrl}/storage/v1/object/public/avatars/${p}` : null);
export const initials = n => (n || '?').trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
export const avatarHtml = (name, path, cls = 'av') => { const u = avatarUrl(path); return u ? `<img class="${cls}" src="${u}" alt="" loading="lazy">` : `<span class="${cls}" aria-hidden="true">${initials(name)}</span>`; };
const typeOf = tbl => Object.entries(TYPES).find(([, v]) => v.table === tbl)?.[0];

/** credits for many items at once: Map(content_id -> [{role, position, id, slug, name, avatar}]) */
export async function loadCredits(type, ids) {
  const out = new Map(); if (!ids.length) return out;
  let rows;
  if (!isConfigured()) {
    const d = demoStore(); rows = d.content_contributors.filter(r => r.content_type === type && ids.includes(r.content_id)).map(r => ({ ...r, c: d.contributors.find(x => x.id === r.contributor_id) }));
  } else {
    const data = must(await (await getClient()).from('content_contributors').select('content_id, role, position, contributors(id, slug, display_name, avatar_path)').eq('content_type', type).in('content_id', ids));
    rows = data.map(r => ({ ...r, c: r.contributors }));
  }
  rows.filter(r => r.c).sort((a, b) => a.position - b.position).forEach(r => out.set(r.content_id, [...(out.get(r.content_id) || []), { role: r.role, position: r.position, id: r.c.id, slug: r.c.slug, name: r.c.display_name, avatar: r.c.avatar_path }]));
  return out;
}

export async function loadPost(type, slug) {
  const T = TYPES[type]; if (!T) return null;
  let item;
  if (!isConfigured()) item = demoStore()[T.table].find(r => r.slug === slug && r.status !== 'draft');
  else item = (await (await getClient()).from(T.view).select('*').eq('slug', slug).maybeSingle()).data;
  if (!item) return null;
  const credits = (await loadCredits(type, [item.id])).get(item.id) || [];
  return { type, item, credits };
}

export async function loadContributor(slug) {
  let c, links;
  if (!isConfigured()) { const d = demoStore(); c = d.contributors.find(x => x.slug === slug); links = c ? d.content_contributors.filter(r => r.contributor_id === c.id) : []; }
  else {
    const db = await getClient(); c = (await db.from('contributors').select('*').eq('slug', slug).maybeSingle()).data;
    links = c ? must(await db.from('content_contributors').select('content_type, content_id, role, position').eq('contributor_id', c.id)) : [];
  }
  if (!c) return null;
  const items = [];
  for (const [type, T] of Object.entries(TYPES)) {
    const ids = links.filter(l => l.content_type === type).map(l => l.content_id); if (!ids.length) continue;
    let rows;
    if (!isConfigured()) rows = demoStore()[T.table].filter(r => ids.includes(r.id) && r.status === 'published');
    else rows = must(await (await getClient()).from(T.view).select('*').in('id', ids));
    rows.forEach(r => items.push({ type, item: r, role: links.find(l => l.content_id === r.id).role }));
  }
  return { contributor: c, items };
}

// ---------- admin: credit lists ----------
export async function getCreditsText(type, id) {
  const m = await loadCredits(type, [id]);
  return (m.get(id) || []).map(c => `${c.name} | ${c.role}`).join('\n');
}
export async function setCreditsText(type, id, text) {
  const credits = text.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [name, role] = l.split('|').map(x => x.trim()); return { name, role: role || 'editor' }; });
  if (isConfigured()) { const { error } = await (await getClient()).rpc('admin_set_credits', { c_type: type, c_id: id, credits }); if (error) throw new Error(error.message); return; }
  const d = demoStore(); d.content_contributors = d.content_contributors.filter(r => !(r.content_type === type && r.content_id === id));
  credits.forEach((cr, i) => {
    let c = d.contributors.find(x => x.display_name.toLowerCase() === cr.name.toLowerCase());
    if (!c) { c = { id: newId(), slug: slugify(cr.name), display_name: cr.name, avatar_path: null, bio: null }; d.contributors.push(c); }
    d.content_contributors.push({ content_type: type, content_id: id, contributor_id: c.id, role: i === 0 ? 'author' : (['author', 'editor', 'contributor'].includes(cr.role) ? cr.role : 'editor'), position: i });
  });
  demoSave();
}
export { typeOf };

// ---------- discovery ----------
export async function searchAll(q, { communities, articles, records }) {
  const { matches } = await import('./search.js'); const out = [];
  communities.filter(c => matches([c.preferred_name, c.alt, c.country, c.summary], q)).slice(0, 4).forEach(c => out.push({ kind: 'Community', title: c.preferred_name, sub: c.country, href: `/city/?c=${encodeURIComponent(c.slug)}` }));
  articles.filter(a => matches([a.title, a.summary, a.region_text], q)).slice(0, 4).forEach(a => out.push({ kind: 'Post', title: a.title, sub: a.region_text || '', href: `/post/?s=${encodeURIComponent(a.slug)}` }));
  records.filter(r => matches([r.title, r.summary], q)).slice(0, 3).forEach(r => out.push({ kind: 'Record', title: r.title, sub: '', href: `/post/?t=heritage_record&s=${encodeURIComponent(r.slug)}` }));
  return out;
}

// ---------- likes, saves and comments ----------
const isDemo = () => !isConfigured();
export async function loadEngagement(type, id, userId) {
  if (isDemo()) {
    const d = demoStore(); d.likes ||= []; d.saves ||= []; d.comments ||= [];
    return { likes: d.likes.filter(l => l.t === type && l.i === id).length, liked: d.likes.some(l => l.t === type && l.i === id && l.u === userId), saved: d.saves.some(l => l.t === type && l.i === id && l.u === userId), comments: d.comments.filter(c => c.content_type === type && c.content_id === id) };
  }
  const c = await getClient(), q = t => c.from(t).select('*', { count: 'exact', head: true });
  const likes = (await c.from('post_likes').select('user_id', { count: 'exact', head: true }).eq('content_type', type).eq('content_id', id)).count || 0;
  let liked = false, saved = false;
  if (userId) {
    liked = Boolean((await c.from('post_likes').select('user_id').eq('content_type', type).eq('content_id', id).eq('user_id', userId).maybeSingle()).data);
    saved = Boolean((await c.from('saved_records').select('record_id').eq('record_type', type).eq('record_id', id).eq('user_id', userId).maybeSingle()).data);
  }
  const comments = must(await c.from('post_comments').select('*').eq('content_type', type).eq('content_id', id).order('created_at', { ascending: true }).limit(200));
  return { likes, liked, saved, comments };
}
export async function toggleLike(type, id, user, liked) {
  if (isDemo()) { const d = demoStore(); d.likes ||= []; if (liked) d.likes = d.likes.filter(l => !(l.t === type && l.i === id && l.u === user.id)); else d.likes.push({ t: type, i: id, u: user.id }); demoSave(); return; }
  const c = await getClient();
  must(liked ? await c.from('post_likes').delete().eq('content_type', type).eq('content_id', id).eq('user_id', user.id) : await c.from('post_likes').insert({ content_type: type, content_id: id, user_id: user.id }));
}
export async function toggleSave(type, id, user, saved) {
  if (isDemo()) { const d = demoStore(); d.saves ||= []; if (saved) d.saves = d.saves.filter(l => !(l.t === type && l.i === id && l.u === user.id)); else d.saves.push({ t: type, i: id, u: user.id }); demoSave(); return; }
  const c = await getClient();
  must(saved ? await c.from('saved_records').delete().eq('record_type', type).eq('record_id', id).eq('user_id', user.id) : await c.from('saved_records').insert({ record_type: type, record_id: id, user_id: user.id }));
}
export async function addComment(type, id, user, body) {
  if (isDemo()) { const d = demoStore(); d.comments ||= []; const row = { id: newId(), content_type: type, content_id: id, user_id: user.id, author_name: user.name, author_avatar: null, author_role: user.role || null, body, created_at: new Date().toISOString() }; d.comments.push(row); demoSave(); return row; }
  return must(await (await getClient()).from('post_comments').insert({ content_type: type, content_id: id, user_id: user.id, body }).select().single());
}
export async function deleteComment(id) {
  if (isDemo()) { const d = demoStore(); d.comments = (d.comments || []).filter(c => c.id !== id); demoSave(); return; }
  must(await (await getClient()).from('post_comments').delete().eq('id', id));
}
export async function listSaved(userId) {
  let links;
  if (isDemo()) links = (demoStore().saves || []).filter(l => l.u === userId).map(l => ({ record_type: l.t, record_id: l.i }));
  else links = must(await (await getClient()).from('saved_records').select('record_type, record_id').eq('user_id', userId));
  const out = [];
  for (const [type, T] of Object.entries(TYPES)) {
    const ids = links.filter(l => l.record_type === type).map(l => l.record_id); if (!ids.length) continue;
    const rows = isDemo() ? demoStore()[T.table].filter(r => ids.includes(r.id)) : must(await (await getClient()).from(T.view).select('*').in('id', ids));
    rows.forEach(r => out.push({ type, item: r }));
  }
  return out;
}
