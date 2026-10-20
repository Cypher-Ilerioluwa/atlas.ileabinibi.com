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
test('pilot content is loaded for every section in demo mode', async () => {
  const { loadLibrary, loadEvents, loadProverbs, loadQuizRows, loadCommunities } = await import('../src/js/api.js');
  assert.equal((await loadCommunities()).rows.length, 27);
  assert.ok((await loadArticles()).length >= 20);
  assert.equal((await loadEvents()).length, 4);
  for (const k of ['heritage_records', 'landmarks', 'people', 'institutions', 'organisations']) assert.ok((await loadLibrary(k)).length >= 1, k);
  assert.equal((await loadProverbs()).length, 1);
  assert.ok((await loadQuizRows()).length >= 10);
});
test('withTimeout resolves with the fallback when a promise never settles', async () => {
  const { withTimeout } = await import('../src/js/api.js');
  assert.equal(await withTimeout(new Promise(() => {}), 30, 'fallback'), 'fallback');
  assert.equal(await withTimeout(Promise.resolve('ok'), 30, 'fallback'), 'ok');
});
