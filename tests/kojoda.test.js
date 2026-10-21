// Compares the Kọ́jọ́dá module with the ORIGINAL calendar code (docs/reference/kojoda-original.html),
// executed unchanged in a sandbox with a controllable clock.
process.env.TZ = 'Africa/Lagos';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as K from '../src/js/calendar/kojoda.js';

const html = readFileSync(new URL('../docs/reference/kojoda-original.html', import.meta.url), 'utf8');
const code = html.slice(html.indexOf('const CONFIG'), html.indexOf('function getFestival'));
const sandbox = { __now: Date.now() };
sandbox.Date = class extends Date { constructor(...a) { if (a.length === 0) super(sandbox.__now); else super(...a); } static now() { return sandbox.__now; } };
vm.createContext(sandbox);
const ref = vm.runInContext(code + '\n;({ CONFIG, THEMES, QUARTERS, FESTIVALS, getTodayDayOfYear, getGregorianDate })', sandbox);
const at = (y, m, d, h = 12, mi = 0) => { sandbox.__now = new Date(y, m, d, h, mi).getTime(); };   // local time (Lagos)
const ab = t => t.replace('Yorùbá', 'Abínibí').replace('Yoruba', 'Abínibí');

test('structure matches the original', () => {
  assert.equal(K.CONFIG.daysPerMonth, ref.CONFIG.daysPerMonth); assert.equal(K.CONFIG.daysPerWeek, ref.CONFIG.daysPerWeek);
  assert.equal(K.CONFIG.weeksPerMonth, ref.CONFIG.weeksPerMonth); assert.equal(K.CONFIG.monthsPerYear, ref.CONFIG.monthsPerYear); assert.equal(K.CONFIG.totalDays, ref.CONFIG.totalDays);
  assert.equal(JSON.stringify(K.QUARTERS), JSON.stringify(ref.QUARTERS));
  assert.equal(K.MONTHS.length, 13);
  ref.THEMES.forEach((t, i) => { assert.equal(K.MONTHS[i].name, t.name); assert.equal(K.MONTHS[i].season, t.season); assert.equal(K.MONTHS[i].primary, t.primary); });
});
test('every festival matches the original (names, descriptions, types, icons)', () => {
  const rk = Object.keys(ref.FESTIVALS).map(Number), mk = Object.keys(K.FESTIVALS).map(Number);
  assert.equal(JSON.stringify(mk.sort((a, b) => a - b)), JSON.stringify(rk.sort((a, b) => a - b)));
  for (const k of rk) { const r = ref.FESTIVALS[k], m = K.FESTIVALS[k]; assert.equal(m.name, ab(r.name), 'name ' + k); assert.equal(m.desc, ab(r.desc), 'desc ' + k); assert.equal(m.type, r.type); assert.equal(m.icon, r.icon); }
});
test('Gregorian -> Kọ́jọ́dá day number equals the original for every day 2019-2045 at 00:00, 12:00 and 23:59', () => {
  let checked = 0;
  for (let y = 2019; y <= 2045; y++) for (let m = 0; m < 12; m++) { const n = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= n; d++) for (const [h, mi] of [[0, 0], [12, 0], [23, 59]]) {
      at(y, m, d, h, mi); const expected = ref.getTodayDayOfYear(), got = K.fromGregorian({ year: y, month: m, day: d }).doy;
      if (got !== expected) assert.fail(`${y}-${m + 1}-${d} ${h}:${mi} original=${expected} module=${got}`); checked++; } }
  assert.ok(checked > 29000, 'checked ' + checked);
});
test('Kọ́jọ́dá day -> Gregorian date equals the original for every day of the cycle (several cycles)', () => {
  for (const [y, m, d] of [[2024, 5, 3], [2025, 8, 15], [2026, 9, 20], [2027, 5, 2], [2028, 1, 29], [2028, 5, 3], [2030, 11, 31]]) {
    at(y, m, d); const cy = K.cycleYearOf({ year: y, month: m, day: d });
    for (let doy = 0; doy < 364; doy++) { const r = ref.getGregorianDate(doy), g = K.toGregorianByDoy(cy, doy); assert.deepEqual([r.getFullYear(), r.getMonth(), r.getDate()], [g.year, g.month, g.day], `${y}-${m + 1}-${d} doy ${doy}`); }
  }
});
test('cycle boundaries and the extra days (as in the original: they stay on the last day)', () => {
  const f = s => K.fromGregorian(s);
  assert.equal(f('2026-06-03').doy, 0); assert.equal(f('2026-06-03').month, 'Òkúdù'); assert.equal(f('2026-06-03').festival.name, 'Odun Tuntun');
  assert.equal(f('2026-06-02').doy, 363); assert.equal(f('2026-06-02').extraDays, 1); assert.equal(f('2026-06-02').cycleYear, 2025);
  assert.equal(f('2026-06-01').doy, 363); assert.equal(f('2026-06-01').extraDays, 0);
  assert.equal(K.gregorianDaysInCycle(2025), 365); assert.equal(K.gregorianDaysInCycle(2027), 366);
  assert.equal(f('2028-06-02').doy, 363); assert.equal(f('2028-06-02').extraDays, 2);   // leap-year cycle: two extra days
  assert.equal(f('2026-07-01').monthNumber, 2); assert.equal(f('2026-07-01').dayOfMonth, 1);   // day 28 = first day of month 2
});
test('derived values: week, weekday, quarter and month structure', () => {
  const x = K.describe(0); assert.deepEqual([x.dayOfYear, x.weekOfYear, x.dayOfWeek, x.weekOfMonth, x.quarter, x.monthNumber], [1, 1, 1, 1, 'Q1', 1]);
  const y = K.describe(363); assert.deepEqual([y.dayOfYear, y.weekOfYear, y.dayOfWeek, y.weekOfMonth, y.quarter, y.monthNumber, y.dayOfMonth], [364, 91, 4, 7, 'Q4', 13, 28]);
  const z = K.describe(28 * 3 + 5); assert.deepEqual([z.monthNumber, z.dayOfMonth, z.weekOfMonth, z.dayOfWeek, z.quarter], [4, 6, 2, 2, 'Q2']);
});
test('round trip: Kọ́jọ́dá -> Gregorian -> Kọ́jọ́dá', () => {
  for (const cy of [2024, 2025, 2026, 2027, 2028]) for (let m = 1; m <= 13; m++) for (const d of [1, 14, 28]) {
    const g = K.toGregorian(cy, m, d), back = K.fromGregorian(g); assert.equal(back.cycleYear, cy); assert.equal(back.monthNumber, m); assert.equal(back.dayOfMonth, d); }
});
test('input validation', () => {
  assert.throws(() => K.toGregorian(2026, 14, 1)); assert.throws(() => K.toGregorian(2026, 1, 29)); assert.throws(() => K.fromGregorian('not a date'));
});
test('upcoming festivals are sorted and not in the past', () => {
  const u = K.upcomingFestivals('2026-10-20', 6); assert.equal(u.length, 6);
  for (let i = 1; i < u.length; i++) assert.ok(u[i].daysAway >= u[i - 1].daysAway); assert.ok(u[0].daysAway >= 0);
});
