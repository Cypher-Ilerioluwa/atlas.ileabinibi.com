import test from 'node:test';
import assert from 'node:assert/strict';
const store = {}; globalThis.sessionStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
store['atlas-demo-role'] = 'admin';
const { getContext, loadArticles, loadEvents } = await import('../src/js/api.js');
const { slugify } = await import('../src/js/core.js');

test('slugify folds tone marks', () => { assert.equal(slugify('Ọ̀ṣun-Òṣogbo Grove'), 'osun-osogbo-grove'); });
test('demo admin: contribute, approve (publishes), notify, audit', async () => {
  const { api, isAdmin } = await getContext(); assert.ok(isAdmin);
  const sub = await api.submit({ kind: 'article', title: 'Test article', region_text: 'Ìbàdàn', payload: { topic: 'history', body: 'x'.repeat(250) }, consent_given: true });
  assert.equal((await api.mySubmissions()).some(s => s.id === sub.id), true);
  const before = (await loadArticles()).length;
  await api.decide(sub.id, 'approved', 'ok');
  assert.equal((await loadArticles()).length, before + 1);
  assert.ok((await api.notifications()).some(n => /approved/.test(n.title)));
  assert.ok((await api.audit()).length >= 1);
});
test('demo admin: guards on roles, bans and self-delete', async () => {
  const { api } = await getContext();
  await assert.rejects(api.setRole('cypherilerioluwa@gmail.com', 'admin', false), /last administrator/);
  await assert.rejects(api.setRole('nobody@example.org', 'admin', true), /No user/);
  await assert.rejects(api.setBan('admin-1', true), /yourself/);
  await assert.rejects(api.deleteUser('admin-1'), /danger zone/);
});
test('events sample includes upcoming and past', async () => {
  const ev = await loadEvents(), today = new Date().toISOString().slice(0, 10);
  assert.ok(ev.some(e => e.date_start >= today) && ev.some(e => e.date_start < today));
});
