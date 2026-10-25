import { loadCommunities, loadArticles, loadEvents, loadLibrary, loadQuizRows, TOPICS, TOPIC_LABEL } from './api.js';
import { loadCredits, searchAll, avatarHtml } from './content.js';
import { recentMessages } from './chat-backend.js';
import { postCard } from './post-card.js';
import { esc } from './search.js';
import { fmtDate } from './core.js';
import { countUp } from './ui.js';
import * as K from './calendar/kojoda.js';
import { install, canInstall, isStandalone } from './install.js';

const $ = id => document.getElementById(id);
const todayG = K.todayParts(), kt = K.fromGregorian(todayG), M3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayKey = `${todayG.year}-${todayG.month + 1}-${todayG.day}`;
const daySeed = Math.floor(Date.UTC(todayG.year, todayG.month, todayG.day) / 864e5);
const TOPIC_ICON = { history: '🏛', people: '👥', language: '🗣', culture: '🥁', food: '🍲', spirituality: '✨', names: '🏷', popular_event: '🎉' };

// ---- today card (Kọ́jọ́dá) ----
function todayCard() {
  const next = K.upcomingFestivals(todayG, 1)[0], f = kt.festival;
  $('today-card').style.setProperty('--kj', K.MONTHS[kt.monthIndex].primary);
  $('today-card').innerHTML = `<div class="eyebrow">Today in Kọ́jọ́dá</div><div class="tc-main"><div class="tc-day"><b data-count="${kt.dayOfMonth}">${kt.dayOfMonth}</b><span>${esc(kt.month)}</span></div><div class="tc-info"><b>Month ${kt.monthNumber} · ${esc(kt.season)}</b><span>Week ${kt.weekOfMonth} of 7 · Day ${kt.dayOfWeek} of 4 · ${kt.quarter}</span><span class="muted">${K.gregorianLabel(todayG)}</span></div></div>
    <div class="tc-fest">${f ? `<i style="background:var(--fest-${f.type})"></i><span><b>${esc(f.name)}</b> today</span>` : next ? `<i style="background:var(--fest-${next.festival.type})"></i><span>Next: <b>${esc(next.festival.name)}</b>, ${next.daysAway === 1 ? 'tomorrow' : 'in ' + next.daysAway + ' days'}</span>` : ''}</div>
    <a class="btn btn-sm btn-gold" href="/kojoda/">Open the calendar</a>`;
  const c = $('today-card').querySelector('[data-count]'); countUp(c, +c.dataset.count, 800);
}

// ---- search suggestions ----
let pool = { communities: [], articles: [], records: [] };
function wireSearch() {
  const input = $('hq'), box = $('hsug'); let idx = -1;
  const close = () => { box.hidden = true; input.setAttribute('aria-expanded', 'false'); idx = -1; };
  input.addEventListener('input', async () => {
    const q = input.value.trim(); if (q.length < 2) return close();
    const res = await searchAll(q, pool);
    if (!res.length) { box.innerHTML = '<li class="none">No matches yet. Press Search to look everywhere.</li>'; box.hidden = false; return; }
    box.innerHTML = res.map((r, i) => `<li role="option" id="sg${i}"><a href="${r.href}"><span class="k">${esc(r.kind)}</span><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></a></li>`).join(''); box.hidden = false; input.setAttribute('aria-expanded', 'true'); idx = -1;
  });
  input.addEventListener('keydown', e => {
    const items = [...box.querySelectorAll('a')]; if (box.hidden || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % items.length; items[idx].focus(); }
    if (e.key === 'Escape') close();
  });
  box.addEventListener('keydown', e => { const items = [...box.querySelectorAll('a')], i = items.indexOf(document.activeElement); if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); } if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? input : items[i - 1]).focus(); } if (e.key === 'Escape') { close(); input.focus(); } });
  document.addEventListener('click', e => { if (!e.target.closest('.sbox')) close(); });
}

// ---- daily quiz with streak ----
const ls = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
function quizCard(rows) {
  if (!rows.length) return `<div class="widget"><div class="eyebrow">Daily quiz</div><h3>Test what you know</h3><p class="muted">Play a quick quiz about Abínibí communities.</p><a class="btn btn-sm" href="/community/#quiz">Play the quiz</a></div>`;
  const q = rows[daySeed % rows.length], opts = q.options, done = ls.get('atlas-daily'), streak = ls.get('atlas-streak') || { count: 0, last: null };
  const answered = done && done.day === dayKey;
  return `<div class="widget quiz" id="dq"><div class="eyebrow">Daily quiz${streak.count ? ` · <span class="streak">🔥 ${streak.count}-day streak</span>` : ''}</div><h3>${esc(q.question)}</h3>
    <div id="dq-opts">${opts.map((o, i) => `<button class="opt" type="button" data-i="${i}" ${answered ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div><p class="muted small" id="dq-fb" aria-live="polite">${answered ? 'You answered today’s question. Come back tomorrow for a new one.' : ''}</p></div>`;
}
function wireQuiz(rows) {
  const el = $('dq'); if (!el) return; const q = rows[daySeed % rows.length];
  const mark = (pick, ok) => { el.querySelectorAll('.opt').forEach((b, i) => { b.disabled = true; if (i === q.answer_index) b.classList.add('right'); else if (i === pick) b.classList.add('wrong'); }); };
  const d = ls.get('atlas-daily'); if (d && d.day === dayKey) mark(d.pick, d.ok);
  el.addEventListener('click', e => {
    const b = e.target.closest('.opt'); if (!b || b.disabled) return; const pick = +b.dataset.i, ok = pick === q.answer_index; mark(pick, ok);
    ls.set('atlas-daily', { day: dayKey, pick, ok });
    const s = ls.get('atlas-streak') || { count: 0, last: null }, y = new Date(todayG.year, todayG.month, todayG.day - 1), yk = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
    if (ok) { s.count = s.last === yk || s.last === dayKey ? s.count + (s.last === dayKey ? 0 : 1) : 1; s.last = dayKey; } else { s.count = 0; s.last = dayKey; }
    ls.set('atlas-streak', s);
    $('dq-fb').textContent = (ok ? 'Correct! ' : `Not quite. The answer is ${q.options[q.answer_index]}. `) + (q.explanation || '') + (ok && s.count > 1 ? ` 🔥 ${s.count}-day streak.` : '');
  });
}
function featuredCard(c) {
  if (!c) return '';
  return `<div class="widget"><div class="eyebrow">Community of the day</div><h3>${esc(c.preferred_name)}</h3><p class="muted small">${esc(c.country)}</p><p>${esc((c.summary || '').slice(0, 150))}${(c.summary || '').length > 150 ? '…' : ''}</p><a class="btn btn-sm" href="/city/?c=${encodeURIComponent(c.slug)}">Visit this community</a></div>`;
}
function festivalCard() {
  const list = K.upcomingFestivals(todayG, 3);
  return `<div class="widget"><div class="eyebrow">Festivals ahead</div>${list.map(u => `<div class="mini"><i style="background:var(--fest-${u.festival.type})"></i><div><b>${esc(u.festival.name)}</b><br><span class="muted small">${u.daysAway === 0 ? 'Today' : u.daysAway === 1 ? 'Tomorrow' : 'In ' + u.daysAway + ' days'} · ${u.date.day} ${M3[u.date.month]}</span></div></div>`).join('')}<a class="btn btn-sm btn-ghost" href="/kojoda/#festivals" onclick="location.href='/kojoda/?tab=festivals';return false">All festivals</a></div>`;
}

(async () => {
  todayCard(); wireSearch();
  // topics
  $('topics').innerHTML = TOPICS.map(t => `<a class="topic reveal" href="/posts/?topic=${t}"><span aria-hidden="true">${TOPIC_ICON[t]}</span><b>${TOPIC_LABEL[t]}</b></a>`).join('');
  $('install-btn').addEventListener('click', () => install());
  if (isStandalone()) $('install-cta').hidden = true;
  try {
    const [cm, articles, events, quiz, ...lib] = await Promise.all([loadCommunities(), loadArticles(), loadEvents(), loadQuizRows().catch(() => []), ...['heritage_records', 'landmarks', 'people', 'institutions', 'organisations'].map(k => loadLibrary(k).catch(() => []))]);
    const comms = cm.rows, records = lib.flat(); pool = { communities: comms, articles, records: lib[0] };
    const stats = [['Communities', comms.length, '/map/'], ['Posts', articles.length, '/posts/'], ['Records and places', records.length, '/library/'], ['Events', events.length, '/events/']];
    $('stats').innerHTML = stats.map(([l, n, h]) => `<a class="stat-tile reveal" href="${h}"><b data-n="${n}">0</b><span>${l}</span></a>`).join('');
    $('stats').querySelectorAll('[data-n]').forEach(el => countUp(el, +el.dataset.n, 1000));
    $('widgets').innerHTML = quizCard(quiz) + featuredCard(comms.length ? comms[daySeed % comms.length] : null) + festivalCard();
    wireQuiz(quiz);
    const latest = [...articles].sort((a, b) => String(b.published_at).localeCompare(String(a.published_at))).slice(0, 3), cr = await loadCredits('article', latest.map(a => a.id));
    $('latest').innerHTML = latest.length ? latest.map(a => postCard(a, { credits: cr.get(a.id) || [] })).join('') : '<div class="empty" style="grid-column:1/-1"><h3>No posts yet</h3><p>Be the first to contribute.</p><a class="btn" href="/contribute/">Contribute</a></div>';
    const iso = `${todayG.year}-${String(todayG.month + 1).padStart(2, '0')}-${String(todayG.day).padStart(2, '0')}`;
    const up = events.filter(e => !e.date_start || (e.date_end || e.date_start) >= iso).sort((a, b) => String(a.date_start || '9').localeCompare(String(b.date_start || '9'))).slice(0, 3);
    $('upcoming').innerHTML = up.length ? up.map(e => `<a class="ev reveal" href="/post/?t=event&s=${encodeURIComponent(e.slug)}" style="text-decoration:none;color:inherit"><div class="date">${e.date_start ? `<b>${new Date(e.date_start + 'T00:00:00').getDate()}</b><span>${M3[new Date(e.date_start + 'T00:00:00').getMonth()]}</span>` : '<span>TBC</span>'}</div><div><h3 style="font-size:var(--step-0)">${esc(e.name)}</h3><p class="muted small" style="margin:0">${[e.location_text, e.region_text].filter(Boolean).map(esc).join(' · ')}</p>${e.date_start ? `<p class="small" style="margin:.2rem 0 0"><b>Kọ́jọ́dá:</b> ${esc(K.fromGregorian(e.date_start).month)}, day ${K.fromGregorian(e.date_start).dayOfMonth}</p>` : ''}</div></a>`).join('') : '<div class="empty"><h3>No upcoming events</h3><a class="btn" href="/contribute/?type=event">Share an event</a></div>';
  } catch (e) { $('stats').innerHTML = ''; $('latest').innerHTML = `<div class="empty" style="grid-column:1/-1"><h3>Could not load the latest content</h3><p>${esc(e.message)}</p></div>`; }
  try {
    const m = await recentMessages('general', 3);
    $('teaser').innerHTML = (m.length ? m.map(x => `<div class="tm">${avatarHtml(x.author_name, x.author_avatar, 'av')}<div><b>${esc(x.author_name)}</b><p>${esc(x.body.slice(0, 120))}</p></div></div>`).join('') : '<p class="muted">No messages yet. Say hello.</p>') + '<a class="btn btn-sm" href="/community/#discuss">Join the discussion</a>';
  } catch { $('teaser').innerHTML = '<a class="btn btn-sm" href="/community/#discuss">Join the discussion</a>'; }
})();
