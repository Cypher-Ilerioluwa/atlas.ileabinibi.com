import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

execFileSync('node', ['scripts/build.mjs'], { env: { ...process.env, SKIP_LIVE: '1' }, stdio: 'pipe' });
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const pages = walk('dist').filter(f => f.endsWith('.html')).map(f => ({ f, html: readFileSync(f, 'utf8') }));
const attr = (html, re) => (html.match(re) || [])[1];
const text = s => String(s).replace(/&#39;/g, "'").replace(/&amp;/g, '&');

test('every page has a short title and description, so search results are not cut off', () => {
  for (const { f, html } of pages) {
    if (/noindex/.test(html) && !/index, follow/.test(html)) continue;
    const t = text(attr(html, /<title>(.*?)<\/title>/s)), d = text(attr(html, /<meta name="description" content="(.*?)">/s));
    assert.ok(t.length <= 62, `${f}: title is ${t.length} characters: ${t}`);
    assert.ok(d.length >= 40 && d.length <= 160, `${f}: description is ${d.length} characters`);
  }
});
test('every page declares a language, a canonical address on the Atlas domain and a large share card', () => {
  for (const { f, html } of pages) {
    assert.match(html, /<html lang="en">/, f);
    assert.match(attr(html, /rel="canonical" href="([^"]+)"/), /^https:\/\/atlas\.ileabinibi\.com\//, f);
    assert.match(html, /twitter:card" content="summary_large_image"/, f);
    assert.match(html, /og:image:width" content="1200"/, f);
  }
});
test('all pages carry the footer links to Privacy, Terms and Contact', () => {
  for (const { f, html } of pages.filter(p => !p.f.endsWith('404.html') || true)) for (const l of ['/privacy/', '/terms/', '/contact/']) assert.ok(html.includes(`href="${l}"`), `${f} is missing ${l}`);
});
test('images in the page source have alternative text', () => {
  for (const { f, html } of pages) for (const img of html.match(/<img\b[^>]*>/g) || []) assert.match(img, /\balt=/, `${f}: ${img.slice(0, 80)}`);
});
test('the home page has structured data that parses, real content links and no loose placeholders', () => {
  const home = pages.find(p => p.f === 'dist/index.html').html, ld = attr(home, /<script type="application\/ld\+json">(.*?)<\/script>/s);
  const data = JSON.parse(ld); assert.equal(data['@graph'].length, 2); assert.equal(data['@graph'][1].potentialAction['@type'], 'SearchAction');
  assert.ok(home.includes('class="topic"') && home.includes('/posts/?topic=history'));          // topics are real links before any script runs
  assert.ok(home.includes('class="cm-chip"'));                                                    // the community strip too
  assert.doesNotMatch(home, /<!--prerender|\{\{\w+\}\}/);
  assert.match(home, /<noscript>/);
});
test('the legal pages exist and the share image is 1200 x 630', () => {
  for (const p of ['privacy', 'terms', 'contact']) assert.ok(pages.some(x => x.f === `dist/${p}/index.html`), p);
  const png = readFileSync('dist/assets/img/og-default.png'); assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630);
});
