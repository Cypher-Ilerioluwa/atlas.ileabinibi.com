import { esc } from './search.js';
import { avatarHtml } from './content.js';
import { fmtDate } from './core.js';
import { TOPIC_LABEL } from './api.js';

export function creditsHtml(credits = [], { avatars = true } = {}) {
  if (!credits.length) return '';
  const [first, ...rest] = credits;
  const a = c => (c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>` : `<a href="/contributor/?c=${encodeURIComponent(c.slug)}">${esc(c.name)}</a>`);
  return `<div class="credits">${avatars ? avatarHtml(first.name, first.avatar, 'av') : ''}<span>By ${a(first)}</span>${rest.length ? `<span class="sep">·</span><span class="role">${rest.some(r => r.role === 'editor') ? 'Edited by' : 'With'}</span> ${rest.map(a).join(', ')}` : ''}</div>`;
}
const plain = s => String(s || '').replace(/\s+/g, ' ').trim();
export function describe(item, n = 190) { const t = plain(item.summary) || plain(item.body); return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : t; }

/** A list card: topic, title (major heading), description, credits, Read more button. */
export function postCard(item, { type = 'article', credits = [], eyebrow, extra = '' } = {}) {
  const title = item.title || item.name || item.preferred_name, href = `/post/?${type === 'article' ? '' : 't=' + type + '&'}s=${encodeURIComponent(item.slug)}`;
  const topic = eyebrow || (type === 'article' ? TOPIC_LABEL[item.topic] || 'Post' : '');
  return `<article class="article postcard hover reveal"><div class="eyebrow">${esc(topic)}${item.region_text ? ` · <span class="muted" style="text-transform:none;letter-spacing:0">${esc(item.region_text)}</span>` : ''}</div>
    <h3><a href="${href}">${esc(title)}</a></h3><p class="desc">${esc(describe(item))}</p>${extra}
    <div class="foot">${creditsHtml(credits) || '<span></span>'}<a class="btn btn-sm" href="${href}">Read more…</a></div></article>`;
}
export const dateOf = item => fmtDate(item.published_at || item.date_start || item.last_reviewed_at);
