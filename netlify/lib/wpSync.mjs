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

/** Turns one WordPress REST post (fetched with _embed) into a plain object, or null if it is not tagged for the Atlas. */
export function parsePost(post) {
  const terms = (post._embedded?.['wp:term'] || []).flat().filter(t => t && t.taxonomy === 'post_tag').map(t => decode(t.name).trim());
  if (!terms.some(t => t.toLowerCase() === 'atlas')) return null;
  const pick = prefix => { const t = terms.find(x => x.toLowerCase().startsWith(prefix)); return t ? t.slice(prefix.length).trim() : null; };
  const kind = (pick('atlas:type:') || 'article').toLowerCase(), table = KINDS[kind] || 'articles';
  const topic = (pick('atlas:topic:') || '').toLowerCase().replace(/[\s-]/g, '_');
  const category = (pick('atlas:category:') || '').toLowerCase().replace(/[\s-]/g, '_');
  const body = htmlToText(post.content?.rendered), summary = htmlToText(post.excerpt?.rendered) || body.slice(0, 240);
  const day = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);
  return {
    id: post.id, table, title: htmlToText(post.title?.rendered) || 'Untitled', summary: summary.length > 400 ? summary.slice(0, 397).replace(/\s\S*$/, '') + '…' : summary, body,
    link: post.link, publishedAt: post.date_gmt ? post.date_gmt + 'Z' : new Date().toISOString(),
    topic: TOPICS.includes(topic) ? topic : 'culture', recordCategory: RECORD_CATEGORIES.includes(category) ? category : 'article', category: pick('atlas:category:'),
    communitySlug: (pick('atlas:community:') || '').toLowerCase() || null, dateStart: day(pick('atlas:date:')), dateEnd: day(pick('atlas:enddate:')),
    editors: terms.filter(t => t.toLowerCase().startsWith('atlas:editor:')).map(t => t.slice('atlas:editor:'.length).trim()).filter(Boolean),
    author: decode(post._embedded?.author?.[0]?.name || '').trim() || null, cover: post._embedded?.['wp:featuredmedia']?.[0]?.source_url || null
  };
}

async function wpGet(path) {
  const r = await fetch(WP + path, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!r.ok) throw new Error(`ileabinibi.com answered ${r.status} for ${path.split('?')[0]}`);
  return r.json();
}

export async function runSync({ url, key }) {
  const { createClient } = await import('@supabase/supabase-js');   // loaded here so parsing can be tested without it
  const db = createClient(url, key, { auth: { persistSession: false } });
  const out = { found: 0, created: 0, updated: 0, archived: 0, errors: [] };
  const tags = await wpGet('/wp-json/wp/v2/tags?slug=atlas&_fields=id');
  if (!tags.length) { out.errors.push('The tag “atlas” does not exist on WordPress yet. Create it and tag a post.'); return out; }
  let posts = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await wpGet(`/wp-json/wp/v2/posts?tags=${tags[0].id}&per_page=100&page=${page}&_embed=1`);
    posts = posts.concat(batch); if (batch.length < 100) break;
  }
  const parsed = posts.map(parsePost).filter(Boolean); out.found = parsed.length;
  const comms = new Map(); const community = async slug => { if (!slug) return null; if (!comms.has(slug)) comms.set(slug, (await db.from('communities').select('id, preferred_name').eq('slug', slug).maybeSingle()).data || null); return comms.get(slug); };
  const keep = Object.fromEntries(Object.keys(CONTENT_TYPE).map(t => [t, []]));

  for (const p of parsed) {
    try {
      const c = await community(p.communitySlug), common = { source: 'wordpress', external_id: p.id, external_url: p.link, cover_url: p.cover, status: 'published' };
      let row;
      if (p.table === 'articles') row = { slug: `wp-${p.id}`, title: p.title, summary: p.summary, body: p.body || p.summary, topic: p.topic, community_id: c?.id || null, region_text: c?.preferred_name || null, author_credit: p.author, sources: 'Originally published on ileabinibi.com', published_at: p.publishedAt, ...common };
      else if (p.table === 'events') row = { slug: `wp-${p.id}`, name: p.title, summary: p.summary, body: p.body, community_id: c?.id || null, region_text: c?.preferred_name || null, date_start: p.dateStart, date_end: p.dateEnd, confidence: p.dateStart ? 'confirmed' : 'tentative', ...common };
      else if (p.table === 'heritage_records') row = { slug: `wp-${p.id}`, category: p.recordCategory, title: p.title, summary: p.summary, body: p.body, community_id: c?.id || null, contributor_credit: p.author, ...common };
      else if (p.table === 'landmarks') row = { slug: `wp-${p.id}`, name: p.title, summary: p.summary, body: p.body, community_id: c?.id || null, ...common };
      else if (p.table === 'people') row = { slug: `wp-${p.id}`, preferred_name: p.title, summary: p.summary, body: p.body, living: false, ...common };
      else if (p.table === 'institutions') row = { slug: `wp-${p.id}`, name: p.title, summary: p.summary, body: p.body, community_id: c?.id || null, ...common };
      else row = { slug: `wp-${p.id}`, name: p.title, category: p.category || 'Organisation', summary: p.summary, community_id: c?.id || null, ...common };
      const ex = (await db.from(p.table).select('id').eq('source', 'wordpress').eq('external_id', p.id).maybeSingle()).data;
      let id;
      if (ex) { const { error } = await db.from(p.table).update(row).eq('id', ex.id); if (error) throw new Error(error.message); id = ex.id; out.updated++; }
      else { const { data, error } = await db.from(p.table).insert(row).select('id').single(); if (error) throw new Error(error.message); id = data.id; out.created++; }
      keep[CONTENT_TYPE[p.table]].push(p.id);
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
    const { data } = await db.from(table).select('id, external_id').eq('source', 'wordpress').eq('status', 'published');
    const gone = (data || []).filter(r => !keep[CONTENT_TYPE[table]].includes(Number(r.external_id))).map(r => r.id);
    if (gone.length) { await db.from(table).update({ status: 'archived' }).in('id', gone); out.archived += gone.length; }
  }
  return out;
}
