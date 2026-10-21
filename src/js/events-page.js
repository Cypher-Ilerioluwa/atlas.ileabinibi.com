import { loadEvents, loadCommunities } from './api.js';
import { esc, matches } from './search.js';
import { fmtDate, setCrumbs } from './core.js';
import * as K from './calendar/kojoda.js';
import { loadCredits } from './content.js';
import { creditsHtml } from './post-card.js';

const $ = id => document.getElementById(id);
let credits = new Map(), events = [], names = new Map(), when = 'upcoming', q = '';
const today = new Date().toISOString().slice(0, 10);
const endOf = e => e.date_end || e.date_start;
const isPast = e => endOf(e) && endOf(e) < today;

function draw() {
  const upcoming = events.filter(e => !isPast(e)), past = events.filter(isPast);
  $('when').innerHTML = [['upcoming', `Upcoming (${upcoming.length})`], ['past', `Past (${past.length})`], ['all', 'All']].map(([k, t]) => `<button class="chip" type="button" data-w="${k}" aria-pressed="${when === k}">${t}</button>`).join('');
  let list = when === 'upcoming' ? upcoming : when === 'past' ? past.reverse() : events;
  list = list.filter(e => matches([e.name, e.location_text, e.region_text, e.summary, names.get(e.community_id)], q));
  $('ev-list').innerHTML = list.length ? list.map(e => {
    const d = e.date_start ? new Date(e.date_start + 'T00:00:00') : null;
    return `<article class="ev ${isPast(e) ? 'past' : ''}"><div class="date">${d ? `<b>${d.getDate()}</b><span>${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}</span>` : '<span>Date to be confirmed</span>'}</div>
      <div><h3>${esc(e.name)}</h3><p class="muted small">${[names.get(e.community_id), e.location_text, e.region_text].filter(Boolean).map(esc).join(' · ')}${e.date_end ? ' · until ' + fmtDate(e.date_end) : ''}</p>
      ${e.summary ? `<p>${esc(e.summary)}</p>` : ''}${e.organiser ? `<p class="small muted">Organiser: ${esc(e.organiser)}</p>` : ''}${e.date_start ? `<p class="small"><b>Kọ́jọ́dá:</b> ${esc(K.fromGregorian(e.date_start).month)}, day ${K.fromGregorian(e.date_start).dayOfMonth}</p>` : ''}<p class="small muted">${e.confidence === 'confirmed' ? 'Date confirmed' : 'Date not yet confirmed by an editor'}</p>
      <div class="foot" style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center">${creditsHtml(credits.get(e.id) || []) || '<span></span>'}<a class="btn btn-sm" href="/post/?t=event&s=${encodeURIComponent(e.slug)}">Read more…</a></div></div></article>`;
  }).join('') : `<div class="empty"><h3>No ${when === 'all' ? '' : when + ' '}events found</h3><p>Know of one? Share it with the community.</p><a class="btn" href="/contribute/?type=event">Share an event</a></div>`;
}
$('when').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { when = b.dataset.w; draw(); } });
$('eq').addEventListener('input', e => { q = e.target.value; draw(); });
(async () => {
  setCrumbs([['Home', '/'], ['Events']]);
  try { events = await loadEvents(); credits = await loadCredits('event', events.map(e => e.id)); (await loadCommunities()).rows.forEach(c => names.set(c.id, c.preferred_name)); draw(); }
  catch (e) { $('ev-list').innerHTML = `<div class="empty"><h3>Could not load events</h3><p>${esc(e.message)}</p></div>`; }
})();
