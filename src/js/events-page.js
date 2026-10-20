import { loadEvents, loadCommunities } from './api.js';
import { esc, matches } from './search.js';
import { fmtDate } from './core.js';

const $ = id => document.getElementById(id);
let events = [], names = new Map(), when = 'upcoming', q = '';
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
      ${e.summary ? `<p>${esc(e.summary)}</p>` : ''}${e.organiser ? `<p class="small muted">Organiser: ${esc(e.organiser)}</p>` : ''}<p class="small muted">${e.confidence === 'confirmed' ? 'Date confirmed' : 'Date not yet confirmed by an editor'}${e.demo ? ' · sample event' : ''}</p></div></article>`;
  }).join('') : `<div class="empty"><h3>No ${when === 'all' ? '' : when + ' '}events found</h3><p>Know of one? Share it with the community.</p><a class="btn" href="/contribute/?type=event">Share an event</a></div>`;
}
$('when').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { when = b.dataset.w; draw(); } });
$('eq').addEventListener('input', e => { q = e.target.value; draw(); });
(async () => {
  try { events = await loadEvents(); (await loadCommunities()).rows.forEach(c => names.set(c.id, c.preferred_name)); draw(); }
  catch (e) { $('ev-list').innerHTML = `<div class="empty"><h3>Could not load events</h3><p>${esc(e.message)}</p></div>`; }
})();
