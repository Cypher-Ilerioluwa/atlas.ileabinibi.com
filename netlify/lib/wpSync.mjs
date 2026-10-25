// Imports posts from the WordPress site (ileabinibi.com) into the Atlas, using tags the editors add on WordPress.
//   atlas                        import this post (required)
//   atlas:type:<kind>            article (default) | event | heritage | landmark | person | institution | organisation
//   atlas:topic:<topic>          history | people | language | culture | food | spirituality | names | popular_event
//   atlas:community:<slug>       the community this belongs to, e.g. atlas:community:ile-ife
//   atlas:editor:<Name>          one tag per co-editor; the WordPress author is the lead author
//   atlas:date:YYYY-MM-DD        event start date (optional: atlas:enddate:YYYY-MM-DD)
//   atlas:category:<category>    heritage record category (or the category for an organisation)

const WP = (process.env.WP_BASE_URL || 'https://ileabinibi.com').replace(/\/$/, '');
const UA = 'IleAbinibiAtlasSync/1.0 (+https://atlas.ileabinibi.com)';
const TOPICS = ['history', 'people', 'language', 'culture', 'food', 'spirituality', 'names', 'popular_event'];
const RECORD_CATEGORIES = ['oral_history', 'document', 'photograph', 'audio', 'video', 'biography', 'proverb', 'folktale', 'craft', 'practice', 'timeline', 'research_note', 'terminology', 'community_record', 'article'];
const KINDS = { article: 'articles', event: 'events', heritage: 'heritage_records', heritage_record: 'heritage_records', landmark: 'landmarks', person: 'people', people: 'people', institution: 'institutions', organisation: 'organisations' };
const CONTENT_TYPE = { articles: 'article', events: 'event', heritage_records: 'heritage_record', landmarks: 'landmark', people: 'person', institutions: 'institution', organisations: 'organisation' };

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
export const decode = s => String(s || '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
export const htmlToText = html => decode(String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, '')).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

// ---- keep only simple, safe formatting from the WordPress HTML ----
const KEEP = new Set(['p', 'br', 'h2', 'h3', 'h4', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'figure', 'figcaption', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);
const ALIAS = { b: 'strong', i: 'em', h1: 'h2', h5: 'h4', h6: 'h4' };
const attr = (s, n) => { const m = new RegExp(`\\b${n}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(s); return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : ''; };
const esc = t => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** rewrite(href) returns a new href, or null to drop the link (keeping its text). */
export function sanitizeHtml(html, rewrite = h => h) {
  const cleaned = String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|iframe|object|embed|form|svg|noscript)[\s\S]*?<\/\1>/gi, '').replace(/<(script|style|iframe|object|embed|form|svg|noscript)[^>]*\/?>/gi, '');
  const open = []; let out = '';
  out = cleaned.replace(/<(\/?)([a-z][a-z0-9]*)([^>]*)>/gi, (m, close, rawTag, attrs) => {
    const tag = ALIAS[rawTag.toLowerCase()] || rawTag.toLowerCase(); if (!KEEP.has(tag)) return '';
    if (close) { if (tag === 'a') return open.pop() === 'a' ? '</a>' : ''; return tag === 'br' || tag === 'hr' || tag === 'img' ? '' : `</${tag}>`; }
    if (tag === 'a') { let href = attr(attrs, 'href').trim(); if (!/^(https?:|mailto:|\/|#)/i.test(href)) href = ''; href = href ? rewrite(href) : null; if (!href) { open.push('x'); return ''; } open.push('a'); return `<a href="${esc(href)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>`; }
    if (tag === 'img') { const src = attr(attrs, 'src').trim(); if (!/^https:\/\//i.test(src)) return ''; return `<img src="${esc(src)}" alt="${esc(attr(attrs, 'alt'))}" loading="lazy">`; }
    return tag === 'br' || tag === 'hr' ? `<${tag}>` : `<${tag}>`;
  });
  while (open.length) { if (open.pop() === 'a') out += '</a>'; }
  return out.replace(/<p>\s*(&nbsp;|\s)*<\/p>/gi, '').replace(/\n{3,}/g, '\n\n').trim();
}

// When a post has no atlas:topic / atlas:community tag, work them out from its ordinary WordPress tags and categories.
const TOPIC_HINTS = [['spirituality', /ifa|orisha|religion|obi|divination|sango|egungun|spirit/], ['language', /language|alphabet|greeting|proverb|vocab/], ['food', /food|recipe|cuisine|dish/], ['popular_event', /festival|event|felabration|carnival/],
  ['history', /history|kingdom|empire|oba|ooni|alaafin|awujale|royal/], ['names', /names?$|naming/], ['people', /biograph|people|notable/], ['culture', /culture|fashion|aso|adire|gele|art|music|wedding|tribal/]];
const COMMUNITY_HINTS = [[/lagos|eko/, 'eko'], [/ijebu/, 'ijebu-ode'], [/(^|-)oyo($|-)/, 'oyo-ile'], [/(^|-)ife($|-)|ile-ife/, 'ile-ife'], [/ibadan/, 'ibadan'], [/abeokuta|egba/, 'abeokuta'], [/osogbo|osun/, 'osogbo'], [/ilorin/, 'ilorin'], [/ogbomosho|ogbomoso/, 'ogbomoso'], [/akure/, 'akure'], [/ekiti/, 'ado-ekiti'], [/ijesha|ilesa/, 'ile-ijesa']];
export function inferTopic(slugs) { const text = slugs.join(' '); for (const [topic, re] of TOPIC_HINTS) if (re.test(text)) return topic; return 'culture'; }
export function inferCommunity(slugs) { for (const sl of slugs) for (const [re, c] of COMMUNITY_HINTS) if (re.test(sl)) return c; return null; }

// Raw WordPress user names such as "admin" are replaced by an editorial credit. WP_AUTHOR_NAME sets what that credit says.
function authorName(name) { const fallback = process.env.WP_AUTHOR_NAME || 'Ilẹ̀ Abínibí Editorial'; return !name || /^(admin|administrator|editor|ileabinibi|wp)$/i.test(name) ? fallback : name; }

/** Turns one WordPress REST post (fetched with _embed) into a plain object, or null if it is not tagged for the Atlas. */
export function parsePost(post) {
  const all = (post._embedded?.['wp:term'] || []).flat().filter(Boolean);
  const terms = all.filter(t => t.taxonomy === 'post_tag').map(t => decode(t.name).trim());
  const plainSlugs = all.filter(t => !decode(t.name).toLowerCase().startsWith('atlas') && t.slug).map(t => String(t.slug).toLowerCase());
  if (!terms.some(t => t.toLowerCase() === 'atlas')) return null;
  const pick = prefix => { const t = terms.find(x => x.toLowerCase().startsWith(prefix)); return t ? t.slice(prefix.length).trim() : null; };
  const kind = (pick('atlas:type:') || 'article').toLowerCase(), table = KINDS[kind] || 'articles';
  const topic = (pick('atlas:topic:') || '').toLowerCase().replace(/[\s-]/g, '_');
  const category = (pick('atlas:category:') || '').toLowerCase().replace(/[\s-]/g, '_');
  const body = htmlToText(post.content?.rendered), summary = htmlToText(post.excerpt?.rendered) || body.slice(0, 240);
  const day = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);
  return {
    contentHtml: post.content?.rendered || '', id: post.id, table, title: htmlToText(post.title?.rendered) || 'Untitled', summary: summary.length > 400 ? summary.slice(0, 397).replace(/\s\S*$/, '') + '…' : summary, body,
    link: post.link, publishedAt: post.date_gmt ? post.date_gmt + 'Z' : new Date().toISOString(),
    topic: TOPICS.includes(topic) ? topic : inferTopic(plainSlugs), recordCategory: RECORD_CATEGORIES.includes(category) ? category : 'article', category: pick('atlas:category:'),
    communitySlug: (pick('atlas:community:') || '').toLowerCase() || inferCommunity(plainSlugs), dateStart: day(pick('atlas:date:')), dateEnd: day(pick('atlas:enddate:')),
    editors: terms.filter(t => t.toLowerCase().startsWith('atlas:editor:')).map(t => t.slice('atlas:editor:'.length).trim()).filter(Boolean),
    author: authorName(decode(post._embedded?.author?.[0]?.name || '').trim()), modified: post.modified_gmt ? post.modified_gmt + 'Z' : null, cover: post._embedded?.['wp:featuredmedia']?.[0]?.source_url || null
  };
}

// Optional: WP_USER + WP_APP_PASSWORD (a WordPress Application Password) lets the import read the site even if its REST API is restricted to logged-in users.
const authHeader = () => (process.env.WP_USER && process.env.WP_APP_PASSWORD ? { authorization: 'Basic ' + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString('base64') } : {});
async function wpGet(path) {
  const r = await fetch(WP + path, { headers: { 'user-agent': UA, accept: 'application/json', ...authHeader() } });
  if (!r.ok) throw new Error(`ileabinibi.com answered ${r.status} for ${path.split('?')[0]}`);
  return r.json();
}

export async function runSync({ url, key, db: injected }) {
  let db = injected;
  if (!db) { const { createClient } = await import('@supabase/supabase-js'); db = createClient(url, key, { auth: { persistSession: false } }); }
  const out = { found: 0, created: 0, updated: 0, archived: 0, errors: [] };
  const tags = await wpGet('/wp-json/wp/v2/tags?slug=atlas&_fields=id');
  if (!tags.length) { out.errors.push('The tag “atlas” does not exist on WordPress yet. Create it and tag a post.'); return out; }
  // 1) a light list of every tagged post (id + last-modified) so removals can be detected cheaply
  let index = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await wpGet(`/wp-json/wp/v2/posts?tags=${tags[0].id}&per_page=100&page=${page}&_fields=id,modified_gmt`);
    index = index.concat(batch); if (batch.length < 100) break;
  }
  // 2) full content only for posts that are new or changed since the last import
  const known = new Map();
  for (const t of Object.keys(CONTENT_TYPE)) { const { data } = await db.from(t).select('external_id, external_modified').eq('source', 'wordpress'); (data || []).forEach(r => known.set(Number(r.external_id), r.external_modified)); }
  const changed = index.filter(r => !known.has(r.id) || !known.get(r.id) || new Date(known.get(r.id)) < new Date(r.modified_gmt + 'Z')).map(r => r.id);
  const everyTagged = new Set(index.map(r => r.id));
  let posts = [];
  for (let i = 0; i < changed.length; i += 40) posts = posts.concat(await wpGet(`/wp-json/wp/v2/posts?include=${changed.slice(i, i + 40).join(',')}&per_page=40&_embed=1`));
  const parsed = posts.map(parsePost).filter(Boolean); out.found = index.length; out.checked = changed.length;
  const norm = u => String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  const linkMap = new Map(parsed.map(p => [norm(p.link), p]));
  const siteHost = norm(WP).split('/')[0];
  const rewrite = href => { if (href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:')) return href.startsWith('/') ? null : href; const hit = linkMap.get(norm(href)); if (hit) return `/post/?${hit.table === 'articles' ? '' : 't=' + CONTENT_TYPE[hit.table] + '&'}s=wp-${hit.id}`; return norm(href).split('/')[0] === siteHost ? null : href; };   // links to your own site that are not imported are dropped, so readers stay in the app
  const comms = new Map(); const community = async slug => { if (!slug) return null; if (!comms.has(slug)) comms.set(slug, (await db.from('communities').select('id, preferred_name').eq('slug', slug).maybeSingle()).data || null); return comms.get(slug); };
  const keep = Object.fromEntries(Object.keys(CONTENT_TYPE).map(t => [t, []]));   // keyed by table name

  for (const p of parsed) {
    try {
      const c = await community(p.communitySlug), common = { source: 'wordpress', external_id: p.id, external_url: p.link, external_modified: p.modified, cover_url: p.cover, status: 'published' };
      const html = sanitizeHtml(p.contentHtml, rewrite);
      let row;
      if (p.table === 'articles') row = { slug: `wp-${p.id}`, title: p.title, summary: p.summary, body: p.body || p.summary, body_html: html, topic: p.topic, community_id: c?.id || null, region_text: c?.preferred_name || null, author_credit: p.author, sources: null, published_at: p.publishedAt, ...common };
      else if (p.table === 'events') row = { slug: `wp-${p.id}`, name: p.title, summary: p.summary, body: p.body, body_html: html, community_id: c?.id || null, region_text: c?.preferred_name || null, date_start: p.dateStart, date_end: p.dateEnd, confidence: p.dateStart ? 'confirmed' : 'tentative', ...common };
      else if (p.table === 'heritage_records') row = { slug: `wp-${p.id}`, category: p.recordCategory, title: p.title, summary: p.summary, body: p.body, body_html: html, community_id: c?.id || null, contributor_credit: p.author, ...common };
      else if (p.table === 'landmarks') row = { slug: `wp-${p.id}`, name: p.title, summary: p.summary, body: p.body, body_html: html, community_id: c?.id || null, ...common };
      else if (p.table === 'people') row = { slug: `wp-${p.id}`, preferred_name: p.title, summary: p.summary, body: p.body, body_html: html, living: false, ...common };
      else if (p.table === 'institutions') row = { slug: `wp-${p.id}`, name: p.title, summary: p.summary, body: p.body, body_html: html, community_id: c?.id || null, ...common };
      else row = { slug: `wp-${p.id}`, name: p.title, category: p.category || 'Organisation', summary: p.summary, body_html: html, community_id: c?.id || null, ...common };
      const ex = (await db.from(p.table).select('id').eq('source', 'wordpress').eq('external_id', p.id).maybeSingle()).data;
      let id;
      if (ex) { const { error } = await db.from(p.table).update(row).eq('id', ex.id); if (error) throw new Error(error.message); id = ex.id; out.updated++; }
      else { const { data, error } = await db.from(p.table).insert(row).select('id').single(); if (error) throw new Error(error.message); id = data.id; out.created++; }
      keep[p.table].push(p.id);
      // credits: WordPress author first, then each atlas:editor tag
      const people = [p.author, ...p.editors].filter(Boolean).filter((n, i, a) => a.findIndex(m => m.toLowerCase() === n.toLowerCase()) === i);
      if (people.length) {
        await db.from('content_contributors').delete().eq('content_type', CONTENT_TYPE[p.table]).eq('content_id', id);
        for (const [i, name] of people.entries()) {
          const { data: cid, error } = await db.rpc('ensure_contributor', { p_user: null, p_name: name }); if (error) throw new Error(error.message);
          await db.from('content_contributors').insert({ content_type: CONTENT_TYPE[p.table], content_id: id, contributor_id: cid, role: i === 0 ? 'author' : 'editor', position: i });
        }
      }
    } catch (e) { out.errors.push(`Post ${p.id}: ${e.message}`); }
  }
  // posts that lost the tag or were deleted are archived, not deleted
  for (const table of Object.keys(CONTENT_TYPE)) {
    try {
      const { data } = await db.from(table).select('id, external_id').eq('source', 'wordpress').eq('status', 'published');
      const gone = (data || []).filter(r => !everyTagged.has(Number(r.external_id))).map(r => r.id);
      if (gone.length) { await db.from(table).update({ status: 'archived' }).in('id', gone); out.archived += gone.length; }
    } catch (e) { out.errors.push(`Archiving in ${table}: ${e.message}`); }
  }
  return out;
}
