import test from 'node:test';
import assert from 'node:assert/strict';
import { esc, clip, topicsHtml, communityStripHtml, latestHtml, upcomingHtml, sharePageSource, siteJsonLd, skeleton } from '../scripts/prerender.mjs';

test('clip cuts at a word and adds an ellipsis', () => { assert.equal(clip('Hello world this is long', 14), 'Hello world…'); assert.equal(clip('short', 20), 'short'); assert.equal(clip(null, 5), ''); });
test('esc neutralises markup and build placeholders', () => { assert.equal(esc('<b>"x"</b> {{title}}'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt; &#123;&#123;title}}'); });
test('topics: eight plain links, visible without JavaScript', () => { const h = topicsHtml(); assert.equal((h.match(/<a /g) || []).length, 8); assert.ok(!h.includes('reveal')); assert.ok(h.includes('Popular events')); });
test('community strip: every community once visibly and once hidden from screen readers', () => {
  const h = communityStripHtml([{ slug: 'ibadan', preferred_name: 'Ìbàdàn' }, { slug: 'eko', preferred_name: 'Èkó (Lagos)' }]);
  assert.equal((h.match(/class="cm-chip"/g) || []).length, 4); assert.equal((h.match(/aria-hidden="true"><a/g) || []).length, 1); assert.ok(h.includes('/city/?c=eko')); assert.equal(communityStripHtml([]), '');
});
test('latest posts: newest first, three at most, escaped, credited to Ilẹ̀ Abínibí', () => {
  const rows = [1, 2, 3, 4].map(i => ({ slug: 's' + i, title: `T${i} <i>`, summary: 'x', topic: 'history', published_at: `2026-01-0${i}T00:00:00Z` }));
  const h = latestHtml(rows); assert.equal((h.match(/<article/g) || []).length, 3); assert.ok(h.indexOf('T4') < h.indexOf('T3')); assert.ok(!h.includes('<i>')); assert.ok(h.includes('href="https://ileabinibi.com/"'));
});
test('upcoming events: past events are left out, undated ones kept', () => {
  const h = upcomingHtml([{ slug: 'a', name: 'Past', date_start: '2020-01-01' }, { slug: 'b', name: 'Soon', date_start: '2026-12-01' }, { slug: 'c', name: 'Undated' }], '2026-10-27');
  assert.ok(!h.includes('Past')); assert.ok(h.includes('Soon') && h.includes('Undated')); assert.ok(h.indexOf('Soon') < h.indexOf('Undated'));
});
test('a share page has the card tags, readable text and valid structured data, and cannot be injected into', () => {
  const html = sharePageSource({ slug: 'x', title: 'Ọlọ́jọ́ </title><script>alert(1)</script>', summary: 'A summary', body: 'One.\n\nTwo <img src=x onerror=1> {{title}}', topic: 'culture', published_at: '2026-10-20T00:00:00Z', cover_url: 'http://insecure/x.jpg' }, 'https://atlas.ileabinibi.com');
  assert.match(html, /ogtype="article"/); assert.ok(!html.includes('<script>alert')); assert.ok(!html.includes('<img src=x')); assert.ok(!html.includes('{{title}}'));
  assert.ok(html.includes('image=""'));                                    // an insecure cover image is not used
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]); assert.equal(ld['@type'], 'Article'); assert.equal(ld.author.name, 'Ilẹ̀ Abínibí');
  assert.match(html, /location\.replace\("\/post\/\?s=x"\)/);
});
test('site JSON-LD links the search box to the Atlas search page', () => { const d = JSON.parse(siteJsonLd('https://a.b').match(/>(.*)</s)[1]); assert.equal(d['@graph'][1].potentialAction.target.urlTemplate, 'https://a.b/search/?q={search_term_string}'); });
test('skeletons are decorative', () => { for (const k of Object.keys(skeleton)) assert.match(skeleton[k](2), /aria-hidden="true"/); });
