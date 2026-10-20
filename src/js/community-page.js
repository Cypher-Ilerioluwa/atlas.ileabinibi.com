import { getContext, chatApi, loadCommunities, loadQuizRows, loadProverbs, loadArticles, loadEvents, TOPIC_LABEL } from './api.js';
import { esc } from './search.js';
import { fmtDate, fmtDateTime, isConfigured } from './core.js';
import { toast } from './shell.js';

const $ = id => document.getElementById(id);
const panel = $('hub-panel');
let ctx, chat, communities = [], demo = false;
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (arr, n) => shuffle(arr).slice(0, n);

// ---------- discussion room ----------
async function discuss() {
  const name = ctx.user ? (ctx.profile?.display_name || ctx.user.email.split('@')[0]) : '';
  const can = Boolean(ctx.user) && !ctx.banned;
  panel.innerHTML = `<p class="small muted"><span class="livedot" aria-hidden="true"></span>${isConfigured() ? 'Live: messages appear instantly for everyone.' : 'Demo room: messages stay in this browser tab.'} Be respectful, and keep sacred or private information out of public chat.</p>
  <div class="chat"><div class="chat-log" id="log" role="log" aria-live="polite" aria-label="Discussion messages"><div class="loading"><span class="spinner"></span> Loading messages…</div></div>
  ${can ? `<form class="chat-form" id="cf"><label class="visually-hidden" for="cm">Message</label><input id="cm" type="text" maxlength="500" placeholder="Write a message" autocomplete="off" required><button class="btn" type="submit">Send</button></form>`
    : `<div class="chat-form"><span class="muted">${ctx.banned ? 'Your account cannot post right now.' : 'Sign in to join the conversation.'}</span> ${ctx.banned ? '' : '<a class="btn btn-gold" href="/account/?next=/community/">Sign in / Sign up</a>'}</div>`}</div>`;
  const log = $('log');
  const row = m => `<div class="msg ${ctx.user && m.user_id === ctx.user.id ? 'mine' : ''}" data-id="${esc(m.id)}"><small>${esc(m.author_name)} · ${fmtDateTime(m.created_at)}${ctx.user && (m.user_id === ctx.user.id || ctx.isEditor) ? ' <button type="button" data-del="' + esc(m.id) + '">Delete</button>' : ''}</small>${esc(m.body)}</div>`;
  const stick = () => { log.scrollTop = log.scrollHeight; };
  chat?.close();
  try {
    chat = await chatApi(ev => {
      if (ev.type === 'insert' && !log.querySelector(`[data-id="${CSS.escape(String(ev.row.id))}"]`)) { log.insertAdjacentHTML('beforeend', row(ev.row)); stick(); }
      if (ev.type === 'delete') log.querySelector(`[data-id="${CSS.escape(String(ev.id))}"]`)?.remove();
    });
    const hist = await chat.history();
    log.innerHTML = hist.length ? hist.map(row).join('') : '<p class="muted">No messages yet. Say hello.</p>'; stick();
  } catch (e) { log.innerHTML = `<p class="muted">Could not load the discussion: ${esc(e.message)}</p>`; return; }
  log.onclick = async e => { const b = e.target.closest('[data-del]'); if (b) try { await chat.remove(b.dataset.del); } catch (err) { toast(err.message); } };
  $('cf')?.addEventListener('submit', async e => {
    e.preventDefault(); const i = $('cm'), body = i.value.trim(); if (!body) return;
    i.disabled = true;
    try { await chat.send({ id: ctx.user.id, name }, body); i.value = ''; if (log.querySelector('p.muted')) log.innerHTML = ''; } catch (err) { toast(err.message, 5000); }
    i.disabled = false; i.focus();
  });
}

// ---------- quiz ----------
async function buildQuestions() {
  const qs = [];
  const countries = [...new Set(communities.map(c => c.country))];
  if (countries.length >= 3) pick(communities, 8).forEach(c => qs.push({ q: `In which country is ${c.preferred_name}?`, opts: shuffle([c.country, ...pick(countries.filter(x => x !== c.country), 3)]), a: c.country, why: `${c.preferred_name} is listed under ${c.country}.` }));
  try { (await loadQuizRows()).forEach(r => { const o = r.options; qs.push({ q: r.question, opts: shuffle(o), a: o[r.answer_index], why: r.explanation }); }); } catch {}
  return pick(qs, 8);
}
function runQuiz(qs, title, again) {
  let i = 0, score = 0;
  const show = () => {
    if (i >= qs.length) { panel.innerHTML = `<div class="card"><h2>${esc(title)} complete</h2><p style="font-size:var(--step-2);font-family:var(--font-display)">${score} / ${qs.length}</p><button class="btn" id="again">Play again</button></div>`; $('again').onclick = again; return; }
    const q = qs[i];
    panel.innerHTML = `<div class="card"><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${qs.length}" aria-valuenow="${i}"><i style="width:${i / qs.length * 100}%"></i></div>
      <p class="muted small">Question ${i + 1} of ${qs.length}</p>${q.clue ? `<p style="font-size:var(--step-1)">${esc(q.clue)}</p>` : ''}<h2 style="font-size:var(--step-1)">${esc(q.q)}</h2>
      <div id="opts">${q.opts.map(o => `<button class="opt" type="button" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div><p id="fb" aria-live="polite"></p><button class="btn" id="nx" hidden>${i + 1 === qs.length ? 'See score' : 'Next'}</button></div>`;
    $('opts').onclick = e => {
      const b = e.target.closest('.opt'); if (!b) return; const ok = b.dataset.o === q.a; if (ok) score++;
      [...document.querySelectorAll('.opt')].forEach(x => { x.disabled = true; if (x.dataset.o === q.a) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      $('fb').textContent = (ok ? 'Correct. ' : `Not quite. The answer is ${q.a}. `) + (q.why || ''); $('nx').hidden = false; $('nx').focus();
    };
    $('nx').onclick = () => { i++; show(); };
  };
  show();
}
async function quiz() {
  const qs = await buildQuestions();
  if (!qs.length) return panel.innerHTML = '<div class="empty"><h3>No quiz questions yet</h3><p>Questions appear once communities are published.</p></div>';
  runQuiz(qs, 'Quiz', quiz);
}
async function guess() {
  const withText = communities.filter(c => c.summary && c.summary.length > 40);
  if (withText.length < 4) return panel.innerHTML = '<div class="empty"><h3>Not enough communities yet</h3><p>This game needs at least four published communities with descriptions.</p></div>';
  const qs = pick(withText, 6).map(c => {
    const first = c.summary.split(/(?<=[.!?])\s/)[0], clue = first.split(c.preferred_name.split(' (')[0]).join('…');
    return { clue, q: 'Which community is this?', opts: shuffle([c.preferred_name, ...pick(withText.filter(x => x.id !== c.id).map(x => x.preferred_name), 3)]), a: c.preferred_name, why: 'Open it on the map for more.' };
  });
  runQuiz(qs, 'Guess the community', guess);
}
async function proverbs() {
  const list = await loadProverbs();
  panel.innerHTML = list.length ? `<div class="stack">${list.map(p => `<article class="card"><p class="proverb" lang="yo">${esc(p.text_original)}</p><p>${esc(p.translation)}</p>${p.meaning ? `<p class="muted small">${esc(p.meaning)}</p>` : ''}${p.source ? `<p class="muted small">Source: ${esc(p.source)}</p>` : ''}</article>`).join('')}</div>`
    : '<div class="empty"><h3>No proverbs published yet</h3><p>Proverbs are added and reviewed by editors.</p></div>';
}
async function updates() {
  const [arts, evs] = await Promise.all([loadArticles(), loadEvents()]);
  const items = [...arts.map(a => ({ t: a.published_at, h: `<div class="eyebrow">${esc(TOPIC_LABEL[a.topic] || 'Post')}</div><h3>${esc(a.title)}</h3><p class="muted small">${a.region_text ? esc(a.region_text) + ' · ' : ''}${fmtDate(a.published_at)}</p>` })),
    ...evs.map(e => ({ t: e.date_start, h: `<div class="eyebrow">Event</div><h3>${esc(e.name)}</h3><p class="muted small">${fmtDate(e.date_start)} · ${esc(e.location_text || e.region_text || '')}</p>` }))].sort((a, b) => String(b.t).localeCompare(String(a.t))).slice(0, 20);
  panel.innerHTML = items.length ? `<div class="stack">${items.map(i => `<article class="post">${i.h}</article>`).join('')}</div>` : '<div class="empty"><h3>Nothing yet</h3><p>Approved posts and events from members will show up here.</p></div>';
}

const TABS = { discuss, quiz, guess, proverbs, updates };
async function open(t) {
  document.querySelectorAll('#hubtabs .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === t)));
  if (t !== 'discuss') { chat?.close(); chat = null; }
  panel.innerHTML = '<div class="loading"><span class="spinner"></span> Loading…</div>';
  try { await TABS[t](); } catch (e) { panel.innerHTML = `<div class="empty"><h3>Something went wrong</h3><p>${esc(e.message)}</p></div>`; }
  history.replaceState(null, '', '#' + t);
}
$('hubtabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) open(b.dataset.tab); });
(async () => {
  try { ctx = await getContext(); } catch { ctx = { user: null }; }
  ctx.user = ctx.user || null;
  try { const r = await loadCommunities(); communities = r.rows; demo = r.demo; } catch {}
  open(TABS[location.hash.slice(1)] ? location.hash.slice(1) : 'discuss');
})();
