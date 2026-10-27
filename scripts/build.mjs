// Static build: src/ -> dist/. Injects shared partials, per-page meta, active nav,
// sitemap.xml, robots.txt and a cache version for the service worker.
// Usage: node scripts/build.mjs   (SITE_URL overrides the production origin)
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { config } from '../src/js/config.js';
import { places } from '../src/js/data/places.demo.js';
import * as P from './prerender.mjs';

const SITE = (process.env.SITE_URL || 'https://atlas.ileabinibi.com').replace(/\/$/, '');
const SRC = 'src', OUT = 'dist';
rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true });
rmSync(join(OUT, 'partials'), { recursive: true, force: true });

// ---- live content at build time (optional): the public Supabase views, read with the public anon key ----
const SB = (process.env.SUPABASE_URL || config.supabaseUrl || '').replace(/\/$/, ''), KEY = process.env.SUPABASE_ANON_KEY || config.supabaseAnonKey || '';
async function rest(path) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`${path.split('?')[0]} -> HTTP ${r.status}`); return r.json();
}
let live = null;
if (SB && KEY && !process.env.SKIP_LIVE) {
  try {
    const [articles, events, comms] = await Promise.all([
      rest('articles_public?select=slug,title,summary,body,topic,region_text,published_at,cover_url&order=published_at.desc&limit=300'),
      rest('events_public?select=slug,name,date_start,date_end,location_text&order=date_start.asc.nullslast&limit=200'),
      rest('communities_public?select=slug,preferred_name&order=preferred_name')]);
    live = { articles, events, comms }; console.log(`Live content: ${articles.length} posts, ${events.length} events, ${comms.length} communities`);
  } catch (e) { console.warn('Live content not available at build time; using built-in placeholders:', e.message); }
}
const todayIso = new Date().toISOString().slice(0, 10);
const commList = live?.comms?.length ? live.comms : places.map(p => ({ slug: p.id, preferred_name: p.name }));

// ---- a static, shareable page for every published article: /p/<slug>/ ----
if (live) for (const a of live.articles.filter(x => x.slug && x.title)) { const d = join(OUT, 'p', a.slug); mkdirSync(d, { recursive: true }); writeFileSync(join(d, 'index.html'), P.sharePageSource(a, SITE)); }

const partials = Object.fromEntries(readdirSync(join(SRC, 'partials')).map(f => [f.replace('.html', ''), readFileSync(join(SRC, 'partials', f), 'utf8')]));
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const pages = walk(OUT).filter(p => p.endsWith('.html'));
const urls = [];

for (const file of pages) {
  let html = readFileSync(file, 'utf8');
  const m = html.match(/<!--page\s+([\s\S]*?)-->/);
  if (!m) throw new Error(`${file}: missing <!--page ... --> header`);
  const attrs = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map(a => [a[1], a[2]]));
  const noindex = /\bnoindex\b/.test(m[1]);
  const rel = '/' + relative(OUT, file).replace(/index\.html$/, '').replace(/\\/g, '/');
  const canonical = SITE + (rel === '/404.html' ? '/' : rel);
  html = html.replace(m[0], '');
  html = html.replace(/<!--include:(\w+)-->/g, (_, n) => { if (!partials[n]) throw new Error('missing partial ' + n); return partials[n]; });
  const isHome = rel === '/', image = attrs.image || SITE + '/assets/img/og-default.png';
  if (isHome) { html = html.replace('<!--prerender:topics-->', P.topicsHtml()).replace('<!--prerender:communities-->', P.communityStripHtml(commList));
    html = html.replace('<!--prerender:latest-->', live ? P.latestHtml(live.articles) || P.skeleton.cards(3) : P.skeleton.cards(3)).replace('<!--prerender:upcoming-->', live ? P.upcomingHtml(live.events, todayIso) || P.skeleton.rows(3) : P.skeleton.rows(3))
      .replace('<!--prerender:stats-->', P.skeleton.tiles(4)).replace('<!--prerender:widgets-->', P.skeleton.widgets(3)).replace('<!--prerender:teaser-->', P.skeleton.lines(3)); }
  html = html.replace(/<!--prerender:\w+-->/g, '');
  const vars = { title: attrs.title, desc: attrs.desc, canonical, site: SITE, image, ogtype: attrs.ogtype || 'website', jsonld: isHome ? P.siteJsonLd(SITE) : '', robots: noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large' };
  html = html.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
  if (attrs.nav) html = html.replace(`data-nav="${attrs.nav}"`, 'aria-current="page"');
  html = html.replace(/ data-nav="\w+"/g, '');
  writeFileSync(file, html);
  if (!noindex) urls.push(canonical);
}

const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.sort().map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /dashboard/\nDisallow: /admin/\nDisallow: /profile/\nSitemap: ${SITE}/sitemap.xml\n`);

const hash = createHash('sha1');
for (const f of walk(OUT).sort()) if (!f.endsWith('sw.js')) hash.update(readFileSync(f));
const pre = walk(OUT).map(f => '/' + relative(OUT, f).replace(/\\/g, '/'))
  .filter(f => /\.(css|js)$/.test(f) || f === '/manifest.webmanifest' || f === '/assets/img/logo.png' || (f.endsWith('/index.html') && !/^\/(account|reset-password)\//.test(f)))
  .filter(f => f !== '/sw.js').map(f => f.replace(/index\.html$/, ''));
const sw = join(OUT, 'sw.js');
writeFileSync(sw, readFileSync(sw, 'utf8').replace('__BUILD__', hash.digest('hex').slice(0, 10)).replace('__PRECACHE__', JSON.stringify(['/offline/', ...new Set(pre)])));
console.log(`Built ${pages.length} pages, ${urls.length} in sitemap -> ${OUT}/`);
