import test from 'node:test';
import assert from 'node:assert/strict';
import { VERIFIED, fromGregorian } from '../src/js/calendar/kojoda.js';

test('module refuses to convert while unverified', () => {
  assert.equal(VERIFIED, false);
  assert.equal(fromGregorian(new Date(2026, 5, 3)).verified, false);
});
// Once the reference source is imported, replace these with real expected values taken from
// https://kojoda.netlify.app/ (year start, month boundaries, 364/365/366-day handling).
test.todo('year start date maps to Month 1 Day 1');
test.todo('last day of Month 1 and first day of Month 2');
test.todo('final day(s) of the year and any extra/leap day rule');
test.todo('round trip toGregorian(fromGregorian(d)) === d over several years');
