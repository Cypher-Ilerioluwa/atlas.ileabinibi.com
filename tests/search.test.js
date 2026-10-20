import test from 'node:test';
import assert from 'node:assert/strict';
import { norm, matches } from '../src/js/search.js';
import { places } from '../src/js/data/places.demo.js';

test('norm strips tone marks and underdots', () => {
  assert.equal(norm('Ilé-Ifẹ̀'), 'ile-ife');
  assert.equal(norm('Òṣogbo'), 'osogbo');
  assert.equal(norm('Ọ̀yọ́'), 'oyo');
});
test('plain-ASCII queries find diacritic names, display text untouched', () => {
  const p = places.find(x => x.id === 'ile-ife');
  assert.equal(p.name, 'Ilé-Ifẹ̀');
  assert.ok(matches([p.name, p.alt], 'ife'));
  assert.ok(matches([p.name], 'ILE IFE'));
  assert.ok(!matches([p.name], 'lagos'));
});
test('demo data has unique ids and valid coordinates', () => {
  const ids = new Set(places.map(p => p.id));
  assert.equal(ids.size, places.length);
  for (const p of places) { assert.ok(Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180, p.id); }
});
