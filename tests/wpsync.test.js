import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePost, htmlToText, decode } from '../netlify/lib/wpSync.mjs';

const tag = name => ({ taxonomy: 'post_tag', name });
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
  assert.deepEqual(p.editors, ['Ọlá Adé', 'Tunde Bello']); assert.equal(p.author, 'Ada Obi'); assert.equal(p.title, 'Ọ̀ṣun & the grove – a visit');
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
