import * as K from './calendar/kojoda.js';
import { esc } from './search.js';
import { setCrumbs } from './core.js';
import { toast } from './shell.js';
import { countUp } from './ui.js';

const $ = id => document.getElementById(id);
const M3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const todayG = K.todayParts(), today = K.fromGregorian(todayG);
const url = new URLSearchParams(location.search);
const st = { tab: ['kojoda', 'gregorian', 'convert', 'festivals'].includes(url.get('tab')) ? url.get('tab') : 'kojoda', cy: today.cycleYear, mi: today.monthIndex, sel: null, gy: todayG.year, gm: todayG.month, ftype: 'all' };
if (url.get('m')) { st.mi = Math.min(12, Math.max(0, +url.get('m') - 1)); }
if (url.get('cy')) st.cy = +url.get('cy') || st.cy;
setCrumbs([['Home', '/'], ['Kọ́jọ́dá calendar']]);
const small = () => matchMedia('(max-width:900px)').matches;
const gLabel = g => `${g.day} ${M3[g.month]}`;
const full = g => K.gregorianLabel(g);
const typeColor = t => `var(--fest-${t})`;
const cycleSpan = cy => `${gLabel(K.toGregorianByDoy(cy, 0))} ${cy} – ${gLabel(K.toGregorianByDoy(cy, 363))} ${K.toGregorianByDoy(cy, 363).year}`;
const ring = (pct, id) => { const c = 2 * Math.PI * 42; return `<svg class="ring" viewBox="0 0 100 100" role="img" aria-label="${pct}% of the year"><circle cx="50" cy="50" r="42" class="ring-bg"/><circle cx="50" cy="50" r="42" class="ring-fg" id="${id}" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-to="${c * (1 - pct / 100)}"/><text x="50" y="55" text-anchor="middle" class="ring-t">${Math.round(pct)}%</text></svg>`; };
const animateRings = () => requestAnimationFrame(() => document.querySelectorAll('.ring-fg').forEach(r => { r.style.strokeDashoffset = r.dataset.to; }));

// ---------- hero: today ----------
function hero() {
  const t = today, next = K.upcomingFestivals(todayG, 1)[0], fest = t.festival;
  const pct = (t.dayOfYear / 364) * 100;
  $('kj-hero').style.setProperty('--kj', K.MONTHS[t.monthIndex].primary);
  $('kj-hero').innerHTML = `<div class="kj-hero-main"><div class="eyebrow">Today in Kọ́jọ́dá</div>
    <h1><span class="kj-mon">${esc(t.month)}</span> <span class="kj-day">Day <b data-count="${t.dayOfMonth}">${t.dayOfMonth}</b> of 28</span></h1>
    <p class="kj-sub">Month ${t.monthNumber} of 13 · ${esc(t.season)} · ${full(todayG)}</p>
    <div class="kj-pills"><span>${t.quarter}</span><span>Week ${t.weekOfMonth} of 7</span><span>Day ${t.dayOfWeek} of 4</span><span>Day ${t.dayOfYear} of 364</span></div>
    ${t.extraDays ? '<p class="kj-note">Today is an extra Gregorian day beyond the 364-day cycle, so it stays on the last day.</p>' : ''}
    <div class="kj-today-fest">${fest ? `<span class="fdot" style="background:${typeColor(fest.type)}"></span><b>${esc(fest.name)}</b> today · ${esc(fest.desc)}`
      : next ? `Next festival: <b>${esc(next.festival.name)}</b> ${next.daysAway === 0 ? 'today' : next.daysAway === 1 ? 'tomorrow' : 'in ' + next.daysAway + ' days'} (${full(next.date)})` : ''}</div>
    <p class="kj-actions"><button class="btn btn-gold" type="button" data-go="today">Open this month</button> <button class="btn btn-ghost" type="button" data-go="convert">Convert a date</button></p></div>
    <div class="kj-hero-ring">${ring(pct, 'ring-year')}<span>of the year</span></div>`;
  animateRings(); const c = $('kj-hero').querySelector('[data-count]'); if (c) countUp(c, +c.dataset.count, 700);
}

// ---------- detail ----------
function detailHtml(cy, doy) {
  const d = K.describe(doy), g = K.toGregorianByDoy(cy, doy), f = d.festival, pctY = (d.dayOfYear / 364) * 100, pctM = (d.dayOfMonth / 28) * 100;
  const extra = doy === 363 ? K.gregorianDaysInCycle(cy) - 364 : 0;
  return `<div class="kj-detail" style="--kj:${K.MONTHS[d.monthIndex].primary}"><button class="kj-x" type="button" data-close aria-label="Close">×</button>
    <div class="eyebrow">${esc(d.month)} · Month ${d.monthNumber}</div><h2>Day ${d.dayOfMonth}</h2><p class="muted">${full(g)}</p>
    <div class="kj-rings">${ring(pctM, 'ring-m')}<div><b>Month</b><br><span class="muted small">day ${d.dayOfMonth} of 28</span></div>${ring(pctY, 'ring-y')}<div><b>Year</b><br><span class="muted small">day ${d.dayOfYear} of 364</span></div></div>
    ${f ? `<div class="kj-fest" style="--ft:${typeColor(f.type)}"><span class="fi">${f.icon}</span><div><b>${esc(f.name)}</b><br><span class="muted">${esc(f.desc)}</span><br><span class="role">${esc(K.FESTIVAL_TYPES[f.type])}</span></div></div>` : ''}
    <dl class="kj-info"><div><dt>Position</dt><dd>${esc(d.month)}, day ${d.dayOfMonth}</dd></div><div><dt>Structure</dt><dd>Day ${d.dayOfWeek} of 4 · Week ${d.weekOfMonth} of 7</dd></div><div><dt>Annual cycle</dt><dd>Week ${d.weekOfYear} of 91 · ${esc(d.season)}</dd></div><div><dt>Quarter</dt><dd>${d.quarter}</dd></div><div><dt>Gregorian</dt><dd>${full(g)}</dd></div></dl>
    ${extra ? `<p class="kj-note">This cycle has ${extra} extra Gregorian day${extra > 1 ? 's' : ''} after day 364. They stay on this last day.</p>` : ''}</div>`;
}
function openDetail(cy, doy) {
  st.sel = doy; markSelected();
  const html = detailHtml(cy, doy);
  if (small()) { const dlg = $('dlg'); dlg.innerHTML = html; if (!dlg.open) dlg.showModal(); } else { const a = $('kj-aside'); if (a) a.innerHTML = html; }
  animateRings();
}
function markSelected() { document.querySelectorAll('.kj-cell').forEach(c => c.setAttribute('aria-pressed', String(+c.dataset.doy === st.sel && (c.dataset.cy ? +c.dataset.cy === st.cy : true)))); }
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) { $('dlg').close(); } });
$('dlg').addEventListener('click', e => { if (e.target === $('dlg')) $('dlg').close(); });

// ---------- Kọ́jọ́dá month ----------
function monthView(dir = 0) {
  const mo = K.MONTHS[st.mi], start = st.mi * 28;
  let rows = '';
  for (let w = 0; w < 7; w++) {
    rows += `<div class="kj-row" style="--r:${w}"><div class="kj-wk" title="Week ${st.mi * 7 + w + 1} of the year">${st.mi * 7 + w + 1}</div>`;
    for (let d = 0; d < 4; d++) {
      const doy = start + w * 4 + d, g = K.toGregorianByDoy(st.cy, doy), f = K.FESTIVALS[doy];
      const isToday = st.cy === today.cycleYear && doy === today.doy;
      rows += `<button class="kj-cell${isToday ? ' today' : ''}${f ? ' fest' : ''}" type="button" data-doy="${doy}" aria-pressed="${st.sel === doy}" aria-label="${esc(mo.name)} day ${w * 4 + d + 1}, ${full(g)}${f ? ', ' + esc(f.name) : ''}"><span class="n">${w * 4 + d + 1}</span><span class="g">${gLabel(g)}</span>${f ? `<i class="fd" style="background:${typeColor(f.type)}"></i>` : ''}</button>`;
    }
    rows += '</div>';
  }
  $('kj-panel').innerHTML = `<div class="kj-layout" style="--kj:${mo.primary}"><div class="kj-main">
    <div class="kj-bar"><button class="iconbtn" type="button" data-nav="-1" aria-label="Previous month">‹</button>
      <button class="kj-title" type="button" id="kj-pick" aria-haspopup="true"><b>Month ${st.mi + 1} · ${esc(mo.name)}</b><span>${esc(mo.season)} · cycle ${esc(cycleSpan(st.cy))}</span></button>
      <button class="iconbtn" type="button" data-nav="1" aria-label="Next month">›</button><button class="btn btn-ghost btn-sm" type="button" data-go="today">Today</button></div>
    <div class="kj-stats"><div><b>${start + 1}</b><span>First day</span></div><div><b>${st.mi * 7 + 1}</b><span>First week</span></div><div><b>4</b><span>Days a week</span></div><div><b>${K.QUARTERS[st.mi]}</b><span>Quarter</span></div></div>
    <div class="kj-grid ${dir > 0 ? 'from-r' : dir < 0 ? 'from-l' : ''}" role="group" aria-label="${esc(mo.name)}"><div class="kj-head"><span>Wk</span><span>Day 1</span><span>Day 2</span><span>Day 3</span><span>Day 4</span></div>${rows}</div>
    <div class="kj-legend">${Object.entries(K.FESTIVAL_TYPES).map(([k, v]) => `<span><i style="background:${typeColor(k)}"></i>${esc(v)}</span>`).join('')}</div></div>
    <aside class="kj-aside" id="kj-aside" aria-live="polite"><div class="kj-empty"><div class="sunmark" aria-hidden="true"></div><h3>Choose a day</h3><p class="muted">Select any day to see its place in the year, its festival and its Gregorian date.</p></div></aside></div>`;
  if (st.sel !== null && !small()) openDetail(st.cy, st.sel); else if (!small() && st.cy === today.cycleYear && st.mi === today.monthIndex) openDetail(st.cy, today.doy);
  const u = new URL(location); u.searchParams.set('m', st.mi + 1); u.searchParams.delete('tab'); history.replaceState(null, '', u);
}
function picker() {
  const dlg = $('dlg');
  dlg.innerHTML = `<div class="kj-detail"><button class="kj-x" type="button" data-close aria-label="Close">×</button><h2 style="font-size:var(--step-1)">Choose a month</h2><div class="kj-months">${K.MONTHS.map((m, i) => `<button type="button" class="kj-m${i === st.mi ? ' on' : ''}" data-m="${i}" style="--c:${m.primary}"><b>${i + 1}</b><span>${esc(m.name)}</span><small>${esc(m.season)}</small></button>`).join('')}</div></div>`;
  dlg.showModal();
}
function shift(n) { st.mi += n; if (st.mi > 12) { st.mi = 0; st.cy++; } if (st.mi < 0) { st.mi = 12; st.cy--; } st.sel = null; monthView(n); }

// ---------- Gregorian month ----------
function gregView() {
  const first = new Date(st.gy, st.gm, 1), pad = (first.getDay() + 6) % 7, days = new Date(st.gy, st.gm + 1, 0).getDate();
  let cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="dow">${d}</div>`).join('') + '<span></span>'.repeat(pad);
  for (let d = 1; d <= days; d++) {
    const k = K.fromGregorian({ year: st.gy, month: st.gm, day: d }), isToday = st.gy === todayG.year && st.gm === todayG.month && d === todayG.day;
    cells += `<button class="kj-cell g${isToday ? ' today' : ''}${k.festival ? ' fest' : ''}" type="button" data-gd="${d}" style="--kj:${K.MONTHS[k.monthIndex].primary}" aria-label="${d} ${M3[st.gm]} ${st.gy}: ${esc(k.month)} day ${k.dayOfMonth}${k.festival ? ', ' + esc(k.festival.name) : ''}"><span class="n">${d}</span><span class="g">${esc(k.month.slice(0, 4))} ${k.dayOfMonth}</span>${k.festival ? `<i class="fd" style="background:${typeColor(k.festival.type)}"></i>` : ''}</button>`;
  }
  $('kj-panel').innerHTML = `<div class="kj-main"><div class="kj-bar"><button class="iconbtn" type="button" data-gnav="-1" aria-label="Previous month">‹</button><div class="kj-title static"><b>${new Date(st.gy, st.gm, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b><span>Each day shows its Kọ́jọ́dá month and day</span></div><button class="iconbtn" type="button" data-gnav="1" aria-label="Next month">›</button><button class="btn btn-ghost btn-sm" type="button" data-go="gtoday">Today</button></div><div class="kj-grid g7">${cells}</div></div>`;
}

// ---------- convert ----------
function convertView() {
  const iso = `${todayG.year}-${String(todayG.month + 1).padStart(2, '0')}-${String(todayG.day).padStart(2, '0')}`;
  $('kj-panel').innerHTML = `<div class="kj-convert"><form class="card reveal in" id="c1"><h2>Gregorian to Kọ́jọ́dá</h2><div class="fld"><label for="gd">Gregorian date</label><input id="gd" type="date" value="${iso}"></div><div id="r1" class="kj-result" aria-live="polite"></div></form>
    <form class="card reveal in" id="c2"><h2>Kọ́jọ́dá to Gregorian</h2><div class="row"><div class="fld"><label for="kc">Cycle starting 3 June of</label><input id="kc" type="number" min="1900" max="2200" value="${today.cycleYear}"></div>
    <div class="fld"><label for="km">Month</label><select id="km">${K.MONTHS.map((m, i) => `<option value="${i + 1}" ${i === today.monthIndex ? 'selected' : ''}>${i + 1}. ${esc(m.name)}</option>`).join('')}</select></div>
    <div class="fld"><label for="kd">Day</label><select id="kd">${Array.from({ length: 28 }, (_, i) => `<option ${i + 1 === today.dayOfMonth ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div></div><div id="r2" class="kj-result" aria-live="polite"></div></form></div>`;
  const r1 = () => { try { const v = $('gd').value; if (!v) return ($('r1').innerHTML = '<p class="muted">Choose a date.</p>'); const k = K.fromGregorian(v); $('r1').innerHTML = `<div class="kj-big">${esc(k.month)} · day ${k.dayOfMonth}</div><p>Month ${k.monthNumber} of 13 · ${esc(k.season)}<br>Week ${k.weekOfMonth} of 7 · Day ${k.dayOfWeek} of 4 · ${k.quarter}<br>Day ${k.dayOfYear} of 364${k.extraDays ? ' (extra Gregorian day, kept on the last day)' : ''}</p>${k.festival ? `<p class="kj-fest" style="--ft:${typeColor(k.festival.type)}"><span class="fi">${k.festival.icon}</span><span><b>${esc(k.festival.name)}</b><br>${esc(k.festival.desc)}</span></p>` : ''}`; } catch (e) { $('r1').innerHTML = `<p class="muted">${esc(e.message)}</p>`; } };
  const r2 = () => { try { const g = K.toGregorian(+$('kc').value, +$('km').value, +$('kd').value); $('r2').innerHTML = `<div class="kj-big">${full(g)}</div><p>${esc(K.MONTHS[$('km').value - 1].name)}, day ${$('kd').value} of the cycle that begins on 3 June ${$('kc').value}.</p>`; } catch (e) { $('r2').innerHTML = `<p class="muted">${esc(e.message)}</p>`; } };
  ['gd'].forEach(i => $(i).addEventListener('input', r1)); ['kc', 'km', 'kd'].forEach(i => $(i).addEventListener('input', r2)); r1(); r2();
}

// ---------- festivals ----------
function festView() {
  const types = ['all', ...Object.keys(K.FESTIVAL_TYPES)], up = K.upcomingFestivals(todayG, 4);
  const list = Object.entries(K.FESTIVALS).map(([k, f]) => ({ doy: +k, f, g: K.toGregorianByDoy(st.cy, +k) })).filter(x => st.ftype === 'all' || x.f.type === st.ftype);
  const byMonth = {}; list.forEach(x => { const m = Math.floor(x.doy / 28); (byMonth[m] ||= []).push(x); });
  $('kj-panel').innerHTML = `<div class="kj-fests"><div class="kj-next">${up.map(u => `<div class="kj-nextcard reveal in" style="--ft:${typeColor(u.festival.type)}"><span class="fi">${u.festival.icon}</span><div><b>${esc(u.festival.name)}</b><br><span class="muted small">${u.daysAway === 0 ? 'Today' : u.daysAway === 1 ? 'Tomorrow' : 'In ' + u.daysAway + ' days'} · ${gLabel(u.date)}</span></div></div>`).join('')}</div>
    <div class="chips" role="group" aria-label="Festival type" style="margin-bottom:var(--space-4)">${types.map(t => `<button class="chip" type="button" data-ft="${t}" aria-pressed="${st.ftype === t}">${t === 'all' ? 'All' : esc(K.FESTIVAL_TYPES[t])}</button>`).join('')}</div>
    <p class="muted small">Cycle starting ${cycleSpan(st.cy).split(' – ')[0]} ${st.cy ? '' : ''}</p>
    ${Object.keys(byMonth).map(m => `<section class="kj-fm"><h3 style="--c:${K.MONTHS[m].primary}">Month ${+m + 1} · ${esc(K.MONTHS[m].name)}</h3>${byMonth[m].map(x => `<button class="kj-frow" type="button" data-fd="${x.doy}" style="--ft:${typeColor(x.f.type)}"><span class="fi">${x.f.icon}</span><span class="ft"><b>${esc(x.f.name)}</b><small>${esc(x.f.desc)}</small></span><span class="fdate">${gLabel(x.g)}<small>Day ${(x.doy % 28) + 1}</small></span></button>`).join('')}</section>`).join('') || '<div class="empty"><h3>No festivals of this type</h3></div>'}</div>`;
}

// ---------- routing and events ----------
function show(tab, dir) {
  st.tab = tab; document.querySelectorAll('#kj-tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $('kj-panel').classList.remove('swap'); void $('kj-panel').offsetWidth; $('kj-panel').classList.add('swap');
  ({ kojoda: () => monthView(dir || 0), gregorian: gregView, convert: convertView, festivals: festView }[tab])();
}
$('kj-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); });
document.addEventListener('click', e => {
  const t = e.target;
  const c = t.closest('.kj-cell[data-doy]'); if (c) return openDetail(st.cy, +c.dataset.doy);
  const g = t.closest('.kj-cell[data-gd]'); if (g) { const k = K.fromGregorian({ year: st.gy, month: st.gm, day: +g.dataset.gd }); const dlg = $('dlg'); dlg.innerHTML = detailHtml(k.cycleYear, k.doy); dlg.showModal(); return animateRings(); }
  const n = t.closest('[data-nav]'); if (n) return shift(+n.dataset.nav);
  const gn = t.closest('[data-gnav]'); if (gn) { st.gm += +gn.dataset.gnav; if (st.gm > 11) { st.gm = 0; st.gy++; } if (st.gm < 0) { st.gm = 11; st.gy--; } return gregView(); }
  const go = t.closest('[data-go]'); if (go) { const w = go.dataset.go; if (w === 'today') { st.cy = today.cycleYear; st.mi = today.monthIndex; st.sel = today.doy; show('kojoda'); $('kj-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); } if (w === 'gtoday') { st.gy = todayG.year; st.gm = todayG.month; gregView(); } if (w === 'convert') { show('convert'); $('kj-panel').scrollIntoView({ behavior: 'smooth' }); } return; }
  if (t.closest('#kj-pick')) return picker();
  const m = t.closest('[data-m]'); if (m) { st.mi = +m.dataset.m; st.sel = null; $('dlg').close(); return monthView(); }
  const ft = t.closest('[data-ft]'); if (ft) { st.ftype = ft.dataset.ft; return festView(); }
  const fd = t.closest('[data-fd]'); if (fd) { const doy = +fd.dataset.fd; const dlg = $('dlg'); dlg.innerHTML = detailHtml(st.cy, doy); dlg.showModal(); animateRings(); }
});
document.addEventListener('keydown', e => {
  if (e.target.matches('input,select,textarea') || st.tab !== 'kojoda') return;
  if (e.key === 'ArrowLeft') shift(-1); if (e.key === 'ArrowRight') shift(1);
  if (e.key.toLowerCase() === 't') { st.cy = today.cycleYear; st.mi = today.monthIndex; monthView(); toast(`${today.month}, day ${today.dayOfMonth}`); }
});
let sx = 0, sy2 = 0; const area = $('kj-panel');
area.addEventListener('touchstart', e => { sx = e.changedTouches[0].clientX; sy2 = e.changedTouches[0].clientY; }, { passive: true });
area.addEventListener('touchend', e => { if (st.tab !== 'kojoda') return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy2; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) shift(dx < 0 ? 1 : -1); }, { passive: true });

hero(); show(st.tab);
