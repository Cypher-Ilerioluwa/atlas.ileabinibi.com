import test from 'node:test';
import assert from 'node:assert/strict';
import { communityBadge, initials } from '../src/js/community-badge.js';
import { buildNotification } from '../netlify/lib/pushContent.mjs';

const SLUGS = ['ile-ife','oyo-ile','ibadan','abeokuta','ijebu-ode','osogbo','eko','ilorin','ogbomoso','ile-ijesa','ado-ekiti','akure','ondo','owo','ketu','save','freetown','salvador-bahia','rio-de-janeiro','recife','havana','matanzas','port-of-spain','oyotunji-village','new-york-city','houston','london'];
test('the General community uses the Ilẹ̀ Abínibí logo', () => {
  const h = communityBadge({ id: 'general', name: 'General' }, 48);
  assert.match(h, /class="cbadge general"/); assert.match(h, /\/assets\/img\/logo\.png/);
});
test('every community badge is stable, safe and (mostly) unique', () => {
  const html = SLUGS.map(s => communityBadge({ id: s, name: s }, 46));
  assert.deepEqual(html, SLUGS.map(s => communityBadge({ id: s, name: s }, 46)));   // same community, same badge
  const looks = new Set(html.map(h => h.match(/linear-gradient\(([^)]*)\)/)[1] + h.match(/<svg[^>]*>(.*?)<text/s)[1].length));
  assert.ok(looks.size >= 18, `only ${looks.size} different looks for ${SLUGS.length} communities`);
  assert.ok(html.every(h => !h.includes('undefined') && !h.includes('NaN')));
  assert.ok(!communityBadge({ id: 'x', name: '<img src=x onerror=alert(1)>' }, 40).includes('<img src=x'));   // names are escaped
});
test('initials ignore bracketed text and handle odd names', () => {
  assert.equal(initials('Èkó (Lagos)'), 'È'); assert.equal(initials('New York City'), 'NY'); assert.equal(initials(''), '?'); assert.equal(initials(null), '?');
});
test('a song shared to General says so in the notification', () => {
  const n = buildNotification({ type: 'INSERT', table: 'media_shares', record: { id: 'm1', status: 'published', title: 'Song', artist: 'A', community_id: null } }, {}, Date.now());
  assert.equal(n.body, 'Song · A (General)');
});
