import test from 'node:test';
import assert from 'node:assert/strict';
import { fold, matches, matchRanges, snippet, highlight, messageMatches } from '../src/js/chat-search.js';

test('accents and capitals are ignored, including Yoruba under-dots', () => {
  assert.equal(fold('Ìbàdàn'), 'ibadan'); assert.equal(fold('ọ̀ṣẹ̀'), 'ose'); assert.equal(fold('ÈKÓ'), 'eko');
  assert.ok(matches('Welcome to Ìbàdàn!', 'ibadan')); assert.ok(matches('Ọdún Ọlọ́jọ́', 'olojo')); assert.ok(matches('Ṣàngó festival', 'sango'));
  assert.ok(!matches('hello', 'world'));
});
test('match ranges point at the ORIGINAL text, even when letters were decomposed', () => {
  const t = 'Báwo ni Ìbàdàn?', [r] = matchRanges(t, 'ibadan');
  assert.equal(t.slice(r[0], r[1]), 'Ìbàdàn');
  assert.deepEqual(matchRanges('aaa', 'a').length, 3);
});
test('highlight wraps matches and escapes everything else', () => {
  assert.equal(highlight('Go to Ìbàdàn <b>now</b>', 'ibadan'), 'Go to <mark>Ìbàdàn</mark> &lt;b&gt;now&lt;/b&gt;');
  assert.equal(highlight('<script>', 'zz'), '&lt;script&gt;');
  assert.ok(!highlight('x <img onerror=1> y', 'img').includes('<img'));
});
test('snippet keeps the match visible in long messages', () => {
  const long = 'lorem ipsum '.repeat(30) + 'the Ọlọ́jọ́ festival starts tomorrow ' + 'dolor sit '.repeat(30);
  const s = snippet(long, 'olojo', 80); assert.ok(s.length <= 84); assert.ok(matches(s, 'olojo')); assert.ok(s.startsWith('…') && s.endsWith('…'));
  assert.equal(snippet('short text', 'text'), 'short text');
});
test('filters: photos, links and shared music; short queries need a filter', () => {
  const photo = { body: '', image_path: 'x.jpg', author_name: 'Ada' }, link = { body: 'listen https://open.spotify.com/x', author_name: 'Ọlá' }, song = { body: '🎧 Listen with me: Song\n/media/?m=abc', author_name: 'Tunde' }, plain = { body: 'hello Ìbàdàn', author_name: 'Sade' };
  assert.ok(messageMatches(photo, '', 'photo')); assert.ok(!messageMatches(plain, '', 'photo'));
  assert.ok(messageMatches(link, '', 'link')); assert.ok(messageMatches(song, '', 'link')); assert.ok(!messageMatches(plain, '', 'link'));
  assert.ok(messageMatches(plain, 'ibadan')); assert.ok(messageMatches(plain, 'sade'));        // sender names are searched too
  assert.ok(!messageMatches(plain, 'i')); assert.ok(!messageMatches(plain, ''));                // one letter: too short
  assert.ok(messageMatches(song, 'song', 'link')); assert.ok(!messageMatches(link, 'zzz', 'link'));
});
