import { MONTHS, DOW, daysInMonth, firstWeekday, iso } from './calendar/gregorian.js';
import { VERIFIED, fromGregorian, SOURCE } from './calendar/kojoda.js';
import { esc } from './search.js';

const $ = id => document.getElementById(id);
const now = new Date();
const todayIso = iso(now.getFullYear(), now.getMonth(), now.getDate());
let y = now.getFullYear(), m = now.getMonth(), sel = todayIso;

function describe(isoDate) {
  const [yy, mm, dd] = isoDate.split('-').map(Number);
  const long = new Date(yy, mm - 1, dd).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const k = fromGregorian(new Date(yy, mm - 1, dd));
  return `<strong>${esc(long)}</strong><br><span class="muted small">${k.verified ? '' : 'Kọ́jọ́dá date: not shown until the calendar rules are verified.'}</span>`;
}

function render() {
  $('cal-title').textContent = `${MONTHS[m]} ${y}`;
  let h = DOW.map(d => `<div class="dow" role="columnheader">${d}</div>`).join('');
  h += '<div class="pad" role="gridcell"></div>'.repeat(firstWeekday(y, m));
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const k = iso(y, m, d);
    h += `<button type="button" role="gridcell" data-date="${k}" data-today="${k === todayIso}" aria-pressed="${k === sel}" aria-label="${d} ${MONTHS[m]} ${y}">${d}</button>`;
  }
  $('cal-grid').innerHTML = h;
  $('cal-selected').innerHTML = describe(sel);
}
const shift = n => { m += n; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } render(); };
$('prev').onclick = () => shift(-1); $('next').onclick = () => shift(1);
$('today').onclick = () => { y = now.getFullYear(); m = now.getMonth(); sel = todayIso; render(); };
$('cal-grid').onclick = e => { const b = e.target.closest('button[data-date]'); if (b) { sel = b.dataset.date; render(); $('cal-grid').querySelector(`[data-date="${sel}"]`)?.focus(); } };

const status = $('kojoda-status');
status.hidden = VERIFIED;
status.innerHTML = '<strong>Kọ́jọ́dá dates are not available yet.</strong> The Atlas will show them only after its conversion has been checked against the original calendar.';
$('kojoda-body').innerHTML = `The Kọ́jọ́dá view will follow the rules of the reference calendar at <a href="${SOURCE}" rel="noopener">kojoda.netlify.app</a>. Until those rules are imported and tested, no Kọ́jọ́dá month, day or conversion is displayed here.`;

document.querySelectorAll('[data-system]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.system === 'kojoda';
  document.querySelectorAll('[data-system]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  $('gregorian').hidden = k; $('kojoda').hidden = !k; status.hidden = VERIFIED;
}));
render();
