import test from 'node:test';
import assert from 'node:assert/strict';
import { daysInMonth, firstWeekday, iso } from '../src/js/calendar/gregorian.js';
test('days in month incl. leap February', () => { assert.equal(daysInMonth(2024, 1), 29); assert.equal(daysInMonth(2026, 1), 28); assert.equal(daysInMonth(2026, 9), 31); });
test('Monday-first weekday of 1 Oct 2026 (a Thursday)', () => { assert.equal(firstWeekday(2026, 9), 3); });
test('iso formatting', () => { assert.equal(iso(2026, 9, 5), '2026-10-05'); });
