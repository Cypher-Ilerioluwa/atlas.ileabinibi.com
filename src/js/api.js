// One API for the whole app. Live mode = Supabase (Row Level Security is the real gatekeeper).
// Demo mode = sample data kept in sessionStorage, only when Supabase is not configured.
import { config } from './config.js';
import { getClient } from './supabase.js';
import { isConfigured, demoRole, slugify } from './core.js';
import { places } from './data/places.demo.js';

export const TOPICS = ['history', 'people', 'language', 'culture', 'food', 'spirituality', 'names', 'popular_event'];
export const TOPIC_LABEL = { history: 'History', people: 'People', language: 'Language', culture: 'Culture', food: 'Food', spirituality: 'Spirituality', names: 'Names', popular_event: 'Popular events' };
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const nowIso = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const dayOffset = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// ---------------- demo database ----------------
function seedDemo() {
  const communities = places.map(p => ({ id: 'c-' + p.id, slug: p.id, preferred_name: p.name, alt: p.alt, kind: 'town', country: p.country, region: p.region, lat: p.lat, lng: p.lng, summary: p.summary, evidence: p.evidence, status: 'published', created_at: nowIso(), demo: true }));
  const first = communities[0].id;
  return {
    communities,
    articles: [
      { id: uid(), slug: 'sample-history', community_id: first, topic: 'history', title: 'Sample post: how a history article looks', summary: 'Layout sample only.', body: 'This is a sample post that shows how a community article is laid out. It contains no real research.', status: 'published', published_at: nowIso(), created_at: nowIso(), author_credit: 'Demo', demo: true },
      { id: uid(), slug: 'sample-food', community_id: first, topic: 'food', title: 'Sample post: how a food article looks', summary: 'Layout sample only.', body: 'Another layout sample. Real posts appear here after an administrator approves a contribution.', status: 'published', published_at: nowIso(), created_at: nowIso(), author_credit: 'Demo', demo: true }],
    events: [
      { id: uid(), slug: 'sample-upcoming', name: 'Sample upcoming event', community_id: first, summary: 'Layout sample only.', location_text: 'Sample venue', region_text: 'Sample region', date_start: dayOffset(12), status: 'published', created_at: nowIso(), demo: true },
      { id: uid(), slug: 'sample-past', name: 'Sample past event', community_id: first, summary: 'Layout sample only.', location_text: 'Sample venue', region_text: 'Sample region', date_start: dayOffset(-25), status: 'published', created_at: nowIso(), demo: true }],
    heritage_records: [], landmarks: [], people: [], institutions: [], organisations: [],
    proverbs: [
      { id: uid(), text_original: 'Ìwà lẹ̀wà ọmọ ènìyàn.', translation: 'Good character is a person’s beauty.', meaning: 'Sample entry. Spelling and meaning await review by an Abínibí-language editor.', status: 'published', created_at: nowIso(), demo: true }],
    quiz_questions: [],
    subs: [
      { id: uid(), user_id: 'demo-user', kind: 'article', title: 'Sample pending article', region_text: 'Sample region', payload: { topic: 'culture', body: 'Demo only' }, consent_given: true, status: 'submitted', created_at: nowIso() },
      { id: uid(), user_id: 'demo-user', kind: 'event', title: 'Sample rejected event', region_text: 'Sample region', payload: {}, consent_given: true, status: 'rejected', editor_feedback: 'Sample feedback: please add the exact venue.', created_at: nowIso() },
      { id: uid(), user_id: 'demo-other', kind: 'edit', title: 'Sample edit request from another member', region_text: 'Sample region', payload: { reason: 'Demo only' }, consent_given: true, status: 'under_review', created_at: nowIso() }],
    notifs: [{ id: uid(), kind: 'system', title: 'Welcome to the demo', body: 'Notifications from administrators and decisions on your submissions appear here.', link: null, read_at: null, created_at: nowIso() }],
    prefs: { submission_updates: true, event_reminders: true, announcements: false },
    profile: { display_name: 'Demo member', bio: '', avatar_path: null },
    users: [{ id: 'admin-1', email: 'cypherilerioluwa@gmail.com', display_name: 'Cypher Ilerioluwa', roles: ['admin'], banned: false, created_at: nowIso(), last_sign_in_at: nowIso(), submissions: 0 },
            { id: 'demo-user', email: 'member@example.org', display_name: 'Demo member', roles: [], banned: false, created_at: nowIso(), last_sign_in_at: null, submissions: 2 },
            { id: 'demo-other', email: 'editor@example.org', display_name: 'Sample editor', roles: ['community_editor'], banned: false, created_at: nowIso(), last_sign_in_at: null, submissions: 1 }],
    corr: [{ id: uid(), record_type: 'communities', message: 'Sample correction request: please check this name’s spelling.', contact_email: 'reader@example.org', status: 'open', created_at: nowIso() }],
    audit: [], chat: [{ id: uid(), user_id: 'demo-other', author_name: 'Sample editor', body: 'Welcome to the discussion room (demo messages stay in this tab).', created_at: nowIso() }]
  };
}
let demoDb;
function db() {
  if (demoDb) return demoDb;
  try { demoDb = JSON.parse(sessionStorage.getItem('atlas-demo-db')); } catch {}
  return demoDb || (demoDb = seedDemo());
}
const persist = () => { try { sessionStorage.setItem('atlas-demo-db', JSON.stringify(demoDb)); } catch {} };

// ---------------- public data (no sign-in needed) ----------------
export async function loadCommunities() {
  if (!isConfigured()) return { demo: true, rows: db().communities };
  const rows = must(await (await getClient()).from('communities_public').select('*').order('preferred_name'));
  return { demo: false, rows: rows.map(r => ({ ...r, region: r.kind === 'diaspora' ? 'Diaspora' : r.country })) };
}
export async function loadArticles(communityId) {
  if (!isConfigured()) return db().articles.filter(a => !communityId || a.community_id === communityId);
  let q = (await getClient()).from('articles_public').select('*').order('published_at', { ascending: false }).limit(200);
  if (communityId) q = q.eq('community_id', communityId);
  return must(await q);
}
export async function loadEvents() {
  if (!isConfigured()) return db().events;
  return must(await (await getClient()).from('events_public').select('*').order('date_start', { ascending: true, nullsFirst: false }).limit(500));
}
export async function loadProverbs() {
  if (!isConfigured()) return db().proverbs;
  return must(await (await getClient()).from('proverbs').select('*').eq('status', 'published').limit(200));
}
export async function loadQuizRows() {
  if (!isConfigured()) return db().quiz_questions;
  return must(await (await getClient()).from('quiz_questions').select('*').eq('status', 'published').limit(200));
}

// ---------------- discussion room ----------------
export async function chatApi(onChange) {
  if (!isConfigured()) {
    return { live: false, history: async () => db().chat.slice(-50), send: async (user, body) => { const m = { id: uid(), user_id: user.id, author_name: user.name, body, created_at: nowIso() }; db().chat.push(m); persist(); onChange({ type: 'insert', row: m }); },
             remove: async id => { db().chat = db().chat.filter(m => m.id !== id); persist(); onChange({ type: 'delete', id }); }, close() {} };
  }
  const c = await getClient();
  const ch = c.channel('room-general').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: 'room=eq.general' },
    p => onChange(p.eventType === 'DELETE' ? { type: 'delete', id: p.old.id } : { type: 'insert', row: p.new })).subscribe();
  return { live: true,
    history: async () => must(await c.from('chat_messages').select('*').eq('room', 'general').order('created_at', { ascending: false }).limit(50)).reverse(),
    send: async (user, body) => must(await c.from('chat_messages').insert({ user_id: user.id, body })),
    remove: async id => must(await c.from('chat_messages').delete().eq('id', id)), close() { c.removeChannel(ch); } };
}

// ---------------- signed-in context ----------------
export async function getContext() {
  const dr = demoRole();
  if (dr) {
    const admin = dr === 'admin', user = { id: admin ? 'admin-1' : 'demo-user', email: admin ? 'cypherilerioluwa@gmail.com' : 'member@example.org' };
    return { mode: 'demo', user, roles: admin ? ['admin'] : [], isAdmin: admin, isEditor: admin, api: demoApi(user, admin) };
  }
  if (!isConfigured()) return { mode: 'none' };
  const c = await getClient();
  const { data: { session } } = await c.auth.getSession();
  if (!session) return { mode: 'live', user: null };
  const user = session.user;
  const roles = (must(await c.from('user_roles').select('role').eq('user_id', user.id)) || []).map(r => r.role);
  const profile = (await c.from('profiles').select('*').eq('id', user.id).maybeSingle()).data;
  return { mode: 'live', user, roles, profile, banned: Boolean(profile?.banned), isAdmin: roles.includes('admin'), isEditor: roles.some(r => ['admin', 'community_editor', 'research_editor'].includes(r)), api: liveApi(c, user, session) };
}

const b64ToU8 = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map(ch => ch.charCodeAt(0))); };
const ADMIN_TABLES = ['communities', 'articles', 'events', 'heritage_records', 'landmarks', 'people', 'institutions', 'organisations', 'proverbs', 'quiz_questions'];
const SAFE_NAME = n => n.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);

function liveApi(c, user, session) {
  const rpc = async (fn, args) => must(await c.rpc(fn, args));
  return {
    mode: 'live',
    profile: async () => (await c.from('profiles').select('*').eq('id', user.id).maybeSingle()).data || {},
    updateProfile: async f => must(await c.from('profiles').update(f).eq('id', user.id)),
    async uploadAvatar(file) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 1048576) throw new Error('Use a JPEG, PNG or WebP image under 1 MB.');
      const path = `${user.id}/avatar-${Date.now()}.${file.type.split('/')[1]}`;
      const { error } = await c.storage.from('avatars').upload(path, file, { contentType: file.type }); if (error) throw new Error(error.message);
      must(await c.from('profiles').update({ avatar_path: path }).eq('id', user.id)); return path;
    },
    avatarUrl: p => p ? c.storage.from('avatars').getPublicUrl(p).data.publicUrl : null,
    async changePassword(pw) { const { error } = await c.auth.updateUser({ password: pw }); if (error) throw new Error(error.message); },
    async deleteAccount() { await rpc('delete_my_account'); await c.auth.signOut(); },
    signOut: () => c.auth.signOut(),
    mySubmissions: async () => must(await c.from('submissions').select('*').eq('user_id', user.id).order('created_at', { ascending: false })),
    async submit(row, files = []) {
      const id = uid(); const media = [];
      for (const f of files.slice(0, 5)) {
        if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type) || f.size > 10485760) throw new Error(`“${f.name}” must be a JPEG, PNG, WebP or PDF under 10 MB.`);
        const path = `${user.id}/${id}/${Date.now()}-${SAFE_NAME(f.name)}`;
        const { error } = await c.storage.from('private-submissions').upload(path, f, { contentType: f.type }); if (error) throw new Error(error.message);
        media.push(path);
      }
      return must(await c.from('submissions').insert({ ...row, id, user_id: user.id, status: 'submitted', payload: { ...row.payload, media } }).select().single());
    },
    notifications: async () => must(await c.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)),
    markRead: async id => { let q = c.from('notifications').update({ read_at: nowIso() }).is('read_at', null); q = id === 'all' ? q.eq('user_id', user.id) : q.eq('id', id); must(await q); },
    unread: async () => (await c.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)).count || 0,
    prefs: async () => (await c.from('notification_prefs').select('*').eq('user_id', user.id).maybeSingle()).data || { submission_updates: true, event_reminders: true, announcements: false },
    savePrefs: async p => must(await c.from('notification_prefs').upsert({ user_id: user.id, ...p, updated_at: nowIso() })),
    async pushState() {
      if (!('serviceWorker' in navigator && 'PushManager' in window)) return 'unsupported';
      if (Notification.permission === 'denied') return 'denied';
      const reg = await navigator.serviceWorker.ready; return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
    },
    async pushSubscribe() {
      if (!('serviceWorker' in navigator && 'PushManager' in window)) throw new Error('Push notifications are not supported in this browser.');
      if (!config.vapidPublicKey) throw new Error('Push is not configured yet: the VAPID public key is missing in config.js.');
      if (await Notification.requestPermission() !== 'granted') throw new Error('Permission was not granted in the browser.');
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(config.vapidPublicKey) });
      const j = sub.toJSON();
      must(await c.from('push_subscriptions').upsert({ user_id: user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200), expired_at: null }, { onConflict: 'endpoint' }));
    },
    async pushUnsubscribe() {
      const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
      if (sub) { must(await c.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)); await sub.unsubscribe(); }
    },
    // ---- admin / editor ----
    async counts() {
      const o = {};
      for (const t of ADMIN_TABLES) {
        const a = await c.from(t).select('id', { count: 'exact', head: true }), p = await c.from(t).select('id', { count: 'exact', head: true }).eq('status', 'published');
        o[t] = { total: a.count ?? 0, published: p.count ?? 0 };
      }
      for (const s of ['submitted', 'under_review', 'changes_requested', 'approved', 'rejected']) o['sub_' + s] = (await c.from('submissions').select('id', { count: 'exact', head: true }).eq('status', s)).count ?? 0;
      o.corrections_open = (await c.from('correction_requests').select('id', { count: 'exact', head: true }).eq('status', 'open')).count ?? 0;
      return o;
    },
    list: async t => must(await c.from(t).select('*').order('created_at', { ascending: false }).limit(500)),
    async save(t, row) {
      if (row.id) { const { id, ...rest } = row; return must(await c.from(t).update(rest).eq('id', id).select().single()); }
      return must(await c.from(t).insert({ ...row, ...(t === 'proverbs' || t === 'quiz_questions' ? {} : { created_by: user.id }) }).select().single());
    },
    remove: async (t, id) => must(await c.from(t).delete().eq('id', id)),
    submissions: async () => must(await c.from('submissions').select('*').order('created_at', { ascending: false }).limit(300)),
    async decide(id, status, fb) {
      if (status === 'approved') return rpc('approve_submission', { sub_id: id, feedback: fb || null });
      must(await c.from('submissions').update({ status, editor_feedback: fb || null }).eq('id', id));
      must(await c.from('moderation_decisions').insert({ submission_id: id, decided_by: user.id, decision: status, notes: fb || null }));
    },
    async mediaLinks(paths) { const out = []; for (const p of paths || []) { const { data } = await c.storage.from('private-submissions').createSignedUrl(p, 600); if (data) out.push({ path: p, url: data.signedUrl }); } return out; },
    corrections: async () => must(await c.from('correction_requests').select('*').order('created_at', { ascending: false }).limit(300)),
    setCorrection: async (id, s) => must(await c.from('correction_requests').update({ status: s }).eq('id', id)),
    users: () => rpc('admin_list_users'),
    setRole: (email, role, grant) => rpc('admin_set_role', { target_email: email, target_role: role, make_grant: grant }),
    setBan: (id, ban, reason) => rpc('admin_set_ban', { target: id, ban, reason: reason || null }),
    editUser: (id, name) => rpc('admin_edit_user', { target: id, new_name: name }),
    deleteUser: id => rpc('admin_delete_user', { target: id }),
    sendNotification: (audience, emails, title, body, link) => rpc('admin_send_notification', { audience, emails, n_title: title, n_body: body || null, n_link: link || null }),
    async sendPush(payload) {
      const r = await fetch('/.netlify/functions/send-push', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + session.access_token }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Push request failed'); return j;
    },
    audit: async () => must(await c.from('audit_log').select('*').order('at', { ascending: false }).limit(200))
  };
}

function demoApi(user, admin) {
  const log = (action, type, id, detail) => { db().audit.unshift({ id: db().audit.length + 1, action, target_type: type, target_id: id, detail, at: nowIso() }); persist(); };
  const D = () => db();
  return {
    mode: 'demo',
    profile: async () => D().profile, updateProfile: async f => { Object.assign(D().profile, f); persist(); },
    uploadAvatar: async () => { throw new Error('Picture upload is only available on the live site.'); }, avatarUrl: () => null,
    changePassword: async () => { throw new Error('Password changes are only available on the live site.'); },
    deleteAccount: async () => { sessionStorage.clear(); },
    signOut: async () => { sessionStorage.removeItem('atlas-demo-role'); },
    mySubmissions: async () => D().subs.filter(s => s.user_id === user.id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    async submit(row) { const r = { ...row, id: uid(), user_id: user.id, status: 'submitted', created_at: nowIso() }; D().subs.push(r); persist(); return r; },
    notifications: async () => [...D().notifs].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    markRead: async id => { D().notifs.forEach(n => { if (id === 'all' || n.id === id) n.read_at = n.read_at || nowIso(); }); persist(); },
    unread: async () => D().notifs.filter(n => !n.read_at).length,
    prefs: async () => D().prefs, savePrefs: async p => { Object.assign(D().prefs, p); persist(); },
    pushState: async () => 'demo', pushSubscribe: async () => { throw new Error('Push needs the live site (HTTPS) with Supabase connected.'); }, pushUnsubscribe: async () => {},
    async counts() {
      const o = {}; for (const t of ADMIN_TABLES) o[t] = { total: (D()[t] || []).length, published: (D()[t] || []).filter(r => r.status === 'published').length };
      for (const s of ['submitted', 'under_review', 'changes_requested', 'approved', 'rejected']) o['sub_' + s] = D().subs.filter(x => x.status === s).length;
      o.corrections_open = D().corr.filter(x => x.status === 'open').length; return o;
    },
    list: async t => [...(D()[t] || [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
    async save(t, row) {
      if (row.id) { const i = D()[t].findIndex(r => r.id === row.id); D()[t][i] = { ...D()[t][i], ...row, updated_at: nowIso() }; log('UPDATE', t, row.id, { new_status: row.status }); persist(); return D()[t][i]; }
      const r = { ...row, id: uid(), created_at: nowIso() }; D()[t].push(r); log('INSERT', t, r.id, { new_status: r.status }); persist(); return r;
    },
    remove: async (t, id) => { D()[t] = D()[t].filter(r => r.id !== id); log('DELETE', t, id, {}); persist(); },
    submissions: async () => D().subs,
    async decide(id, status, fb) {
      const s = D().subs.find(x => x.id === id); s.status = status; s.editor_feedback = fb;
      if (status === 'approved' && s.kind === 'article') D().articles.push({ id: uid(), slug: slugify(s.title), community_id: s.community_id || null, topic: s.payload.topic || 'culture', title: s.title, summary: s.payload.summary, body: s.payload.body || '', status: 'published', published_at: nowIso(), created_at: nowIso(), author_credit: 'Demo' });
      if (status === 'approved' && s.kind === 'event') D().events.push({ id: uid(), slug: slugify(s.title), name: s.title, community_id: s.community_id || null, summary: s.payload.summary, location_text: s.payload.location, region_text: s.region_text, date_start: s.payload.date_start || null, status: 'published', created_at: nowIso() });
      if (s.user_id === user.id) D().notifs.push({ id: uid(), kind: 'submission', title: 'Decision on your submission: ' + status.replace('_', ' '), body: s.title, link: '/account/#posts', read_at: null, created_at: nowIso() });
      log('UPDATE', 'submissions', id, { new_status: status }); persist();
    },
    mediaLinks: async () => [],
    corrections: async () => D().corr, setCorrection: async (id, s) => { D().corr.find(c => c.id === id).status = s; log('UPDATE', 'correction_requests', id, { new_status: s }); persist(); },
    users: async () => D().users,
    async setRole(email, role, grant) {
      const u = D().users.find(x => x.email.toLowerCase() === email.trim().toLowerCase()); if (!u) throw new Error('No user with that email. They must create an account first.');
      if (grant) { if (!u.roles.includes(role)) u.roles.push(role); }
      else { if (role === 'admin' && D().users.filter(x => x.roles.includes('admin')).length <= 1) throw new Error('Cannot remove the last administrator.'); u.roles = u.roles.filter(r => r !== role); }
      log(grant ? 'INSERT' : 'DELETE', 'user_roles', u.id, { role }); persist();
    },
    async setBan(id, ban) { if (id === user.id) throw new Error('You cannot ban yourself.'); D().users.find(u => u.id === id).banned = ban; log('UPDATE', 'profiles', id, { banned: ban }); persist(); },
    async editUser(id, name) { D().users.find(u => u.id === id).display_name = name; persist(); },
    async deleteUser(id) { if (id === user.id) throw new Error('Use the danger zone in Settings to delete your own account.'); D().users = D().users.filter(u => u.id !== id); log('DELETE', 'users', id, {}); persist(); },
    async sendNotification(audience, emails, title, body) {
      const n = audience === 'selected' ? D().users.filter(u => emails.includes(u.email)).length : D().users.length;
      D().notifs.push({ id: uid(), kind: 'message', title, body, link: null, read_at: null, created_at: nowIso() }); persist(); return n;
    },
    sendPush: async () => { throw new Error('Push delivery needs the live site with the Netlify function configured.'); },
    audit: async () => D().audit
  };
}
