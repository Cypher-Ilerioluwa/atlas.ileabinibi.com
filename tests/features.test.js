import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, googleCalUrl, icsEscape, fold } from '../src/js/ics.js';
import { wrapLines } from '../src/js/share-card.js';
import { REASONS } from '../src/js/report.js';

test('calendar file: an all-day event with escaped text and CRLF line endings', () => {
  const ics = buildIcs({ uid: 'abc', title: 'Ọlọ́jọ́, the festival; of kings', start: '2026-10-14', end: '2026-10-16', location: 'Ilé-Ifẹ̀', description: 'Line one\nLine two', url: 'https://atlas.ileabinibi.com/post/?t=event&s=olojo', now: new Date('2026-10-01T08:30:00Z') });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261014') && ics.includes('DTEND;VALUE=DATE:20261017'));   // the end date is the day AFTER, as the standard requires
  assert.ok(ics.includes('DTSTAMP:20261001T083000Z') && ics.includes('UID:abc@atlas.ileabinibi.com'));
  assert.ok(ics.includes('SUMMARY:Ọlọ́jọ́\\, the festival\\; of kings')); assert.ok(ics.includes('Line one\\nLine two'));
  assert.ok(!/\n(?!$)/.test(ics.replace(/\r\n/g, '')));   // every line break is CRLF
});
test('calendar file: a one-day event ends the next day; long lines are folded at 75 bytes', () => {
  assert.ok(buildIcs({ uid: 'x', title: 't', start: '2026-12-31' }).includes('DTEND;VALUE=DATE:20270101'));
  const long = 'DESCRIPTION:' + 'Ọlọ́jọ́ '.repeat(30), folded = fold(long), enc = new TextEncoder();
  for (const l of folded.split('\r\n')) assert.ok(enc.encode(l).length <= 75, l);
  assert.equal(folded.replace(/\r\n /g, ''), long);
  assert.equal(icsEscape('a,b;c\\d'), 'a\\,b\\;c\\\\d');
});
test('Google Calendar link carries the title, the dates and the place', () => {
  const u = new URL(googleCalUrl({ title: 'Ọlọ́jọ́', start: '2026-10-14', end: '2026-10-15', location: 'Ilé-Ifẹ̀', url: 'https://x.y/' }));
  assert.equal(u.hostname, 'calendar.google.com'); assert.equal(u.searchParams.get('dates'), '20261014/20261016'); assert.equal(u.searchParams.get('text'), 'Ọlọ́jọ́'); assert.equal(u.searchParams.get('location'), 'Ilé-Ifẹ̀');
});
test('picture cards: text wraps to the width and long text ends with an ellipsis', () => {
  const measure = s => s.length * 10;
  assert.deepEqual(wrapLines(measure, 'one two three four', 100, 5), ['one two', 'three four']);
  const cut = wrapLines(measure, 'word '.repeat(60), 100, 3); assert.equal(cut.length, 3); assert.ok(cut[2].endsWith('…'));
  assert.deepEqual(wrapLines(measure, '', 100, 3), []);
  assert.ok(wrapLines(measure, 'supercalifragilisticexpialidocious', 100, 2).length <= 2);
});
test('reports offer clear reasons', () => { assert.deepEqual(Object.keys(REASONS), ['spam', 'abuse', 'adult', 'private', 'other']); });
