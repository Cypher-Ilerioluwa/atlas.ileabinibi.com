import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePost, htmlToText, decode, sanitizeHtml, inferTopic, inferCommunity } from '../netlify/lib/wpSync.mjs';

const tag = name => ({ taxonomy: 'post_tag', name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') });
const post = (tags, extra = {}) => ({ id: 77, link: 'https://ileabinibi.com/x/', date_gmt: '2026-10-01T09:30:00', title: { rendered: 'Ọ̀ṣun &amp; the grove &#8211; a visit' }, excerpt: { rendered: '<p>Short <b>summary</b>.</p>' }, content: { rendered: '<p>First paragraph.</p><p>Second&nbsp;one.<br>Line two.</p><script>x()</script>' },
  _embedded: { 'wp:term': [[{ taxonomy: 'category', name: 'News' }], tags.map(tag)], author: [{ name: 'Ada Obi' }], 'wp:featuredmedia': [{ source_url: 'https://ileabinibi.com/img.jpg' }] }, ...extra });

test('entity and html cleaning', () => {
  assert.equal(decode('Ọ̀ṣun &amp; &#8217;x&#8217; &hellip;'), 'Ọ̀ṣun & ’x’ …');
  assert.equal(htmlToText('<p>A</p><p>B<br>C</p><style>p{}</style>'), 'A\n\nB\nC');
});
test('posts without the atlas tag are ignored', () => { assert.equal(parsePost(post(['news', 'atlas:type:event'])), null); });
test('article with topic, community, editors and author', () => {
  const p = parsePost(post(['atlas', 'atlas:topic:History', 'atlas:community:ile-ife', 'atlas:editor:Ọlá Adé', 'atlas:editor:Tunde Bello']));
  assert.equal(p.table, 'articles'); assert.equal(p.topic, 'history'); assert.equal(p.communitySlug, 'ile-ife');
  assert.deepEqual(p.editors, ['Ọlá Adé', 'Tunde Bello']); assert.equal(p.author, 'Ilẹ̀ Abínibí'); assert.equal(p.wpAuthor, 'Ada Obi'); assert.equal(p.title, 'Ọ̀ṣun & the grove – a visit');
  assert.equal(p.summary, 'Short summary.'); assert.match(p.body, /First paragraph\.\n\nSecond one\.\nLine two\./); assert.equal(p.cover, 'https://ileabinibi.com/img.jpg'); assert.equal(p.publishedAt, '2026-10-01T09:30:00Z');
});
test('event with dates; unknown topic falls back; bad dates are dropped', () => {
  const e = parsePost(post(['atlas', 'atlas:type:event', 'atlas:date:2026-08-14', 'atlas:enddate:2026-08-16']));
  assert.equal(e.table, 'events'); assert.equal(e.dateStart, '2026-08-14'); assert.equal(e.dateEnd, '2026-08-16');
  assert.equal(parsePost(post(['atlas', 'atlas:type:event', 'atlas:date:14/08/2026'])).dateStart, null);
  assert.equal(parsePost(post(['atlas', 'atlas:topic:nonsense'])).topic, 'culture');
});
test('type mapping', () => {
  const t = k => parsePost(post(['atlas', 'atlas:type:' + k])).table;
  assert.deepEqual(['heritage', 'landmark', 'person', 'institution', 'organisation', 'whatever'].map(t), ['heritage_records', 'landmarks', 'people', 'institutions', 'organisations', 'articles']);
});

// ---- full import run against an in-memory database and a fake WordPress ----
import { runSync } from '../netlify/lib/wpSync.mjs';
function fakeDb(tables) {
  let seq = 0; const contributors = [];
  const make = name => {
    const q = { f: [], op: 'select', row: null };
    const rows = () => (tables[name] ||= []);
    const match = r => q.f.every(([c, v, kind]) => (kind === 'in' ? v.includes(r[c]) : r[c] === v));
    const run = single => {
      if (q.op === 'insert') { const r = { id: 'id' + ++seq, ...q.row }; rows().push(r); return { data: single ? { id: r.id } : [r], error: null }; }
      if (q.op === 'update') { rows().filter(match).forEach(r => Object.assign(r, q.row)); return { data: null, error: null }; }
      if (q.op === 'delete') { tables[name] = rows().filter(r => !match(r)); return { data: null, error: null }; }
      const found = rows().filter(match); return { data: single ? found[0] || null : found, error: null };
    };
    const api = { select() { return api; }, eq(c, v) { q.f.push([c, v]); return api; }, in(c, v) { q.f.push([c, v, 'in']); return api; }, update(r) { q.op = 'update'; q.row = r; return api; }, insert(r) { q.op = 'insert'; q.row = r; return api; }, delete() { q.op = 'delete'; return api; },
      maybeSingle: () => Promise.resolve(run(true)), single: () => Promise.resolve(run(true)), then: (res, rej) => Promise.resolve(run(false)).then(res, rej) };
    return api;
  };
  return { from: make, rpc: async (fn, a) => { let c = contributors.find(x => x.name === a.p_name); if (!c) { c = { name: a.p_name, id: 'ct' + ++seq }; contributors.push(c); } return { data: c.id, error: null }; }, tables };
}
test('a full import creates, updates, credits and archives (regression: archive step crashed)', async () => {
  const tables = { communities: [{ id: 'c1', slug: 'ile-ife', preferred_name: 'Ilé-Ifẹ̀' }], articles: [{ id: 'old1', source: 'wordpress', external_id: 999, status: 'published' }] };
  const posts = [post(['atlas', 'atlas:topic:history', 'atlas:community:ile-ife', 'atlas:editor:Tunde Bello'], { modified_gmt: '2026-10-01T10:00:00' }), post(['atlas', 'atlas:type:event', 'atlas:date:2026-08-14'], { id: 78, modified_gmt: '2026-10-01T10:00:00' })];
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async u => { u = String(u); calls.push(u); return { ok: true, status: 200, json: async () => (u.includes('/tags?') ? [{ id: 5 }] : u.includes('_fields=id,modified_gmt') ? posts.map(p => ({ id: p.id, modified_gmt: p.modified_gmt || '2026-10-01T10:00:00' })) : u.includes('include=') ? posts.filter(p => u.match(/include=([\d,]+)/)[1].split(',').map(Number).includes(p.id)) : posts) }; };
  try {
    const db = fakeDb(tables), r = await runSync({ db });
    assert.deepEqual([r.found, r.checked, r.created, r.updated, r.archived, r.errors.length], [2, 2, 2, 0, 1, 0]);
    assert.equal(tables.articles.find(a => a.id === 'old1').status, 'archived');
    const art = tables.articles.find(a => a.external_id === 77); assert.equal(art.topic, 'history'); assert.equal(art.community_id, 'c1'); assert.equal(art.author_credit, 'Ilẹ̀ Abínibí');
    assert.match(art.body_html, /<p>First paragraph\.<\/p>/); assert.ok(!/script/.test(art.body_html)); assert.equal(tables.events[0].date_start, '2026-08-14'); assert.equal(tables.events[0].confidence, 'confirmed');
    const credits = tables.content_contributors.filter(c => c.content_id === art.id); assert.deepEqual(credits.map(c => c.role), ['author', 'editor']);
    const again = await runSync({ db });   // nothing changed on WordPress: nothing is downloaded or duplicated
    assert.deepEqual([again.found, again.checked, again.created, again.updated, again.archived, again.errors.length], [2, 0, 0, 0, 0, 0]); assert.equal(tables.articles.filter(a => a.external_id === 77).length, 1);
    posts[0].modified_gmt = '2026-10-02T10:00:00';   // an edit on WordPress
    const edited = await runSync({ db }); assert.deepEqual([edited.checked, edited.updated, edited.created], [1, 1, 0]);
  } finally { globalThis.fetch = realFetch; }
});

test('sanitizer keeps simple formatting and removes anything unsafe', () => {
  const dirty = '<div class="wp-block"><h1 style="x">Title</h1><p onclick="evil()">Hi <b>there</b> <a href="javascript:alert(1)">bad</a> <a href="https://example.org/x" onclick="x()">ok</a></p><script>alert(1)</script><iframe src="https://evil"></iframe><img src="http://insecure/x.jpg"><img src="https://ileabinibi.com/a.jpg" alt="A &quot;pic&quot;" onerror="x()"><ul><li>One</li></ul><p>&nbsp;</p></div>';
  const out = sanitizeHtml(dirty);
  assert.equal(out, '<h2>Title</h2><p>Hi <strong>there</strong> bad <a href="https://example.org/x" target="_blank" rel="noopener noreferrer">ok</a></p><img src="https://ileabinibi.com/a.jpg" alt="A &quot;pic&quot;" loading="lazy"><ul><li>One</li></ul>');
  assert.ok(!/on\w+=|script|iframe|javascript:/i.test(out));
});
test('links to your own site become in-app links or plain text', () => {
  const rewrite = h => (h.includes('ileabinibi.com/other') ? '/post/?s=wp-9' : h.includes('ileabinibi.com') ? null : h);
  const out = sanitizeHtml('<p><a href="https://ileabinibi.com/other/">next</a> <a href="https://ileabinibi.com/about/">about</a> <a href="https://wikipedia.org/x">wiki</a></p>', rewrite);
  assert.equal(out, '<p><a href="/post/?s=wp-9">next</a> about <a href="https://wikipedia.org/x" target="_blank" rel="noopener noreferrer">wiki</a></p>');
});

test('topic and community are inferred from ordinary WordPress tags when no atlas tags are given', () => {
  assert.equal(inferTopic(['yoruba-food', 'yoruba-culture']), 'food');
  assert.equal(inferTopic(['ifa', 'orisha', 'yoruba-culture']), 'spirituality');
  assert.equal(inferTopic(['yoruba-language']), 'language');
  assert.equal(inferTopic(['yoruba-history', 'awujale']), 'history');
  assert.equal(inferTopic(['yoruba-fashion', 'aso-oke']), 'culture');
  assert.equal(inferCommunity(['lagos']), 'eko'); assert.equal(inferCommunity(['ijebu']), 'ijebu-ode'); assert.equal(inferCommunity(['oyo', 'tribal-marks']), 'oyo-ile'); assert.equal(inferCommunity(['yoruba-culture']), null);
  const p = parsePost({ ...post(['atlas', 'yoruba-food', 'lagos']), id: 1071 }); assert.equal(p.topic, 'food'); assert.equal(p.communitySlug, 'eko');
});
test('the author of every imported post is Ilẹ̀ Abínibí, whoever wrote it on WordPress', () => {
  const mk = name => parsePost({ ...post(['atlas']), _embedded: { ...post(['atlas'])._embedded, author: [{ name }] } }).author;
  assert.equal(mk('admin'), 'Ilẹ̀ Abínibí'); assert.equal(mk('Ada Obi'), 'Ilẹ̀ Abínibí'); assert.equal(mk(''), 'Ilẹ̀ Abínibí');
});
test('plain tags History, People, Language, Culture, Food, Spirituality, Names, Popular events choose the topic', () => {
  const t = name => parsePost(post(['atlas', name])).topic;
  assert.deepEqual(['History', 'People', 'Language', 'Culture', 'Food', 'Spirituality', 'Names', 'Popular events'].map(t),
    ['history', 'people', 'language', 'culture', 'food', 'spirituality', 'names', 'popular_event']);
  assert.equal(t('popular-events'), 'popular_event'); assert.equal(t('FOOD'), 'food');
});
test('topic tag precedence: atlas:topic: wins, then a plain topic tag, then a guess; categories count too', () => {
  assert.equal(parsePost(post(['atlas', 'Food', 'atlas:topic:history'])).topic, 'history');
  assert.equal(parsePost(post(['atlas', 'Names', 'lagos'])).topic, 'names');
  const viaCategory = parsePost({ ...post(['atlas']), _embedded: { ...post(['atlas'])._embedded, 'wp:term': [[{ taxonomy: 'category', name: 'Spirituality', slug: 'spirituality' }], [tag('atlas')]] } });
  assert.equal(viaCategory.topic, 'spirituality');
  assert.equal(parsePost(post(['atlas'])).topic, 'culture');   // no hint at all: default
});
test('links to other Atlas pages are absolute atlas.ileabinibi.com links that open in the same tab', () => {
  const out = sanitizeHtml('<p><a href="https://ileabinibi.com/other/">next</a></p>', () => 'https://atlas.ileabinibi.com/post/?s=wp-9');
  assert.equal(out, '<p><a href="https://atlas.ileabinibi.com/post/?s=wp-9">next</a></p>');
});
test('WordPress tables and figures survive sanitising', () => {
  const out = sanitizeHtml('<figure class="wp-block-table"><table class="x"><thead><tr><th>Yoruba</th><th>English</th></tr></thead><tbody><tr><td>Ṣẹ́rẹ́</td><td>January</td></tr></tbody></table></figure>');
  assert.equal(out, '<figure><table><thead><tr><th>Yoruba</th><th>English</th></tr></thead><tbody><tr><td>Ṣẹ́rẹ́</td><td>January</td></tr></tbody></table></figure>');
});
