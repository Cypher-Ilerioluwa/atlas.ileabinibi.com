// Static build: src/ -> dist/. Injects shared partials, per-page meta, active nav,
// sitemap.xml, robots.txt and a cache version for the service worker.
// Usage: node scripts/build.mjs   (SITE_URL overrides the production origin)
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const SITE = (process.env.SITE_URL || 'https://atlas.ileabinibi.com').replace(/\/$/, '');
const SRC = 'src', OUT = 'dist';
rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true });
rmSync(join(OUT, 'partials'), { recursive: true, force: true });

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
  const vars = { title: attrs.title, desc: attrs.desc, canonical, site: SITE, robots: noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large' };
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
