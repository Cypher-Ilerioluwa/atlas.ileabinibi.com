// Build-time HTML for the parts of the site that are otherwise filled in by JavaScript, so that search engines,
// link previews and slow phones see real content. Pure functions: the build supplies the data.
import { communityBadge } from '../src/js/community-badge.js';

export const TOPICS = ['history', 'people', 'language', 'culture', 'food', 'spirituality', 'names', 'popular_event'];
export const TOPIC_LABEL = { history: 'History', people: 'People', language: 'Language', culture: 'Culture', food: 'Food', spirituality: 'Spirituality', names: 'Names', popular_event: 'Popular events' };
const TOPIC_ICON = { history: '🏛', people: '👥', language: '🗣', culture: '🥁', food: '🍲', spirituality: '✨', names: '🏷', popular_event: '🎉' };
export const HOUSE = { name: 'Ilẹ̀ Abínibí', url: 'https://ileabinibi.com/' };

export const esc = s => String(s ?? '').replace(/[&<>"'{]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '{': '&#123;' }[c]));   // { is escaped so page text can never be mistaken for a build placeholder
const plain = s => String(s || '').replace(/\s+/g, ' ').trim();
export function clip(s, n) { const t = plain(s); return t.length <= n ? t : t.slice(0, n - 1).replace(/\s\S*$/, '').replace(/[,.;:!?-]+$/, '') + '…'; }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmt = iso => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const sharePath = slug => `/p/${encodeURIComponent(slug)}/`;

export const topicsHtml = () => TOPICS.map(t => `<a class="topic" href="/posts/?topic=${t}"><span aria-hidden="true">${TOPIC_ICON[t]}</span><b>${TOPIC_LABEL[t]}</b></a>`).join('');

// grey placeholder shapes (shimmering) shown until live data arrives
export const skeleton = {
  cards: n => Array.from({ length: n }, () => '<div class="article sk" aria-hidden="true"><div class="skel" style="height:.9rem;width:30%"></div><div class="skel" style="height:1.4rem;width:85%;margin-top:.8rem"></div><div class="skel" style="height:4rem;margin-top:.8rem"></div></div>').join(''),
  rows: n => Array.from({ length: n }, () => '<div class="ev sk" aria-hidden="true"><div class="skel" style="height:56px;width:56px;border-radius:12px"></div><div style="flex:1"><div class="skel" style="height:1rem;width:70%"></div><div class="skel" style="height:.8rem;width:45%;margin-top:.5rem"></div></div></div>').join(''),
  tiles: n => Array.from({ length: n }, () => '<div class="stat-tile sk" aria-hidden="true"><div class="skel" style="height:2rem;width:50%"></div><div class="skel" style="height:.8rem;width:70%;margin-top:.5rem"></div></div>').join(''),
  widgets: n => Array.from({ length: n }, () => '<div class="widget sk" aria-hidden="true"><div class="skel" style="height:.8rem;width:35%"></div><div class="skel" style="height:1.3rem;width:80%;margin-top:.7rem"></div><div class="skel" style="height:3rem;margin-top:.7rem"></div></div>').join(''),
  lines: n => Array.from({ length: n }, () => '<div class="tm sk" aria-hidden="true"><div class="skel" style="height:36px;width:36px;border-radius:50%"></div><div style="flex:1"><div class="skel" style="height:.9rem;width:40%"></div><div class="skel" style="height:.9rem;width:90%;margin-top:.4rem"></div></div></div>').join(''),
};

/** The scrolling strip of communities, each with its emblem. The second copy is hidden from assistive technology. */
export function communityStripHtml(comms) {
  if (!comms?.length) return '';
  const one = (hidden) => comms.map(c => `<a class="cm-chip" href="/city/?c=${encodeURIComponent(c.slug)}"${hidden ? ' tabindex="-1"' : ''}>${communityBadge({ id: c.slug, name: c.preferred_name }, 34)}<span>${esc(c.preferred_name)}</span></a>`).join('');
  return `<div class="cm-track"><div class="cm-set">${one(false)}</div><div class="cm-set" aria-hidden="true">${one(true)}</div></div>`;
}

export function latestHtml(articles, n = 3) {
  const rows = [...(articles || [])].sort((a, b) => String(b.published_at).localeCompare(String(a.published_at))).slice(0, n);
  return rows.map(a => `<article class="article postcard hover"><div class="eyebrow">${esc(TOPIC_LABEL[a.topic] || 'Post')}${a.region_text ? ` · <span class="muted" style="text-transform:none;letter-spacing:0">${esc(a.region_text)}</span>` : ''}</div>
    <h3><a href="${sharePath(a.slug)}">${esc(a.title)}</a></h3><p class="desc">${esc(clip(a.summary || a.body, 190))}</p>
    <div class="foot"><div class="credits"><span>By <a href="${HOUSE.url}" target="_blank" rel="noopener">${HOUSE.name}</a></span></div><a class="btn btn-sm" href="${sharePath(a.slug)}">Read more…</a></div></article>`).join('');
}

export function upcomingHtml(events, todayIso, n = 3) {
  const rows = (events || []).filter(e => !e.date_start || (e.date_end || e.date_start) >= todayIso)
    .sort((a, b) => String(a.date_start || '9').localeCompare(String(b.date_start || '9'))).slice(0, n);
  return rows.map(e => { const d = e.date_start ? new Date(e.date_start + 'T00:00:00Z') : null;
    return `<a class="ev" href="/post/?t=event&amp;s=${encodeURIComponent(e.slug)}" style="text-decoration:none;color:inherit"><div class="date">${d ? `<b>${d.getUTCDate()}</b><span>${MONTHS[d.getUTCMonth()]}</span>` : '<b>?</b><span>TBC</span>'}</div><div><b>${esc(e.name)}</b><br><span class="muted small">${esc(e.location_text || '')}</span></div></a>`; }).join('');
}

// ---------- structured data ----------
export const jsonLdScript = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
export function siteJsonLd(site) {
  return jsonLdScript({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', '@id': site + '/#org', name: 'Ilẹ̀ Abínibí', url: 'https://ileabinibi.com/', logo: site + '/assets/icons/icon-512.png' },
    { '@type': 'WebSite', '@id': site + '/#site', url: site + '/', name: 'Ilẹ̀ Abínibí Atlas', inLanguage: 'en', publisher: { '@id': site + '/#org' },
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: site + '/search/?q={search_term_string}' }, 'query-input': 'required name=search_term_string' } },
  ] });
}

// ---------- one article as a static, shareable page (link previews, search engines) ----------
const BOTS = '(bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|slack|discord|linkedin|embedly|preview|pinterest)';
export function sharePageSource(a, site) {
  const title = plain(a.title), desc = clip(a.summary || a.body, 155) || 'A story from the Ilẹ̀ Abínibí Atlas.';
  const image = /^https:\/\//.test(a.cover_url || '') ? a.cover_url : '';
  const paras = String(a.body || a.summary || '').split(/\n{2,}/).map(p => plain(p)).filter(Boolean);
  const url = `${site}${sharePath(a.slug)}`, live = `/post/?s=${encodeURIComponent(a.slug)}`;
  const ld = jsonLdScript({ '@context': 'https://schema.org', '@type': 'Article', headline: clip(title, 110), description: desc, mainEntityOfPage: url,
    ...(a.published_at ? { datePublished: a.published_at } : {}), author: { '@type': 'Organization', name: HOUSE.name, url: HOUSE.url },
    publisher: { '@type': 'Organization', name: HOUSE.name, logo: { '@type': 'ImageObject', url: site + '/assets/icons/icon-512.png' } }, image: image || site + '/assets/img/og-default.png', inLanguage: 'en' });
  return `<!--page title="${esc(clip(title, 58))}" desc="${esc(desc)}" nav="posts" ogtype="article" image="${esc(image)}"-->
<!doctype html>
<html lang="en">
<head>
<!--include:head-->
${ld}
<script>if(!/${BOTS}/i.test(navigator.userAgent))location.replace(${JSON.stringify(live)});</script>
</head>
<body>
<!--include:header-->
<main id="main"><div class="wrap narrow"><article class="postpage static-post">
  <div class="eyebrow">${esc(TOPIC_LABEL[a.topic] || 'Post')}</div>
  <h1>${esc(title)}</h1>
  <div class="postmeta">${a.region_text ? `<span>${esc(a.region_text)}</span><span class="sep">·</span>` : ''}${a.published_at ? `<span>${esc(fmt(a.published_at))}</span><span class="sep">·</span>` : ''}<span>By <a href="${HOUSE.url}" rel="noopener">${HOUSE.name}</a></span></div>
  ${image ? `<img class="cover" src="${esc(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
  <div class="prose">${paras.map(p => `<p>${esc(p)}</p>`).join('')}</div>
  <p class="static-cta"><a class="btn btn-gold" href="${live}">Open in the Atlas to like, comment and share</a></p>
</article></div></main>
<!--include:footer-->
</body>
</html>
`;
}
