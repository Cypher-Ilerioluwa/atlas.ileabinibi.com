// Admin tab: mounted inside the dashboard. Hiding sections is a convenience; the database enforces rights.
import { esc } from '../search.js';
import { toast } from '../shell.js';
import { fmtDateTime as fmt, label, slugify } from '../core.js';
import { TABLES, ROLES, SUBMISSION_STATUSES, FUNCTIONS } from './schema.js';
import { getCreditsText, setCreditsText, typeOf } from '../content.js';

const fail = e => toast(e.message || 'Something went wrong.', 6000);
const $ = id => document.getElementById(id);
let ctx, api, host, panel, communities = [];

const CONTENT = () => Object.keys(TABLES).filter(k => k !== 'media_shares');
export async function mountAdmin(el, c) {
  ctx = c; api = c.api; host = el;
  const primary = [['monitor', 'Monitoring'], ['submissions', 'Submissions'], ...(ctx.isAdmin ? [['users', 'Users']] : []), ['content', 'Content'], ['media_shares', 'Music'],
    ...(ctx.isAdmin ? [['messages', 'Messages'], ['push', 'Push'], ['sync', 'Website import']] : []), ['corrections', 'Corrections'], ...(ctx.isAdmin ? [['audit', 'Audit trail']] : []), ['functions', 'All functions']];
  host.innerHTML = `<div class="admin-wrap"><h2>Admin</h2><div class="navtabs subnav" id="subnav" role="tablist" aria-label="Admin sections">${primary.map(([k, t]) => `<button class="chip" type="button" role="tab" data-s="${k}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>
    <div class="navtabs subnav second" id="subnav2" role="tablist" aria-label="Content sections" hidden>${CONTENT().map(k => `<button class="chip" type="button" role="tab" data-s="${k}" aria-pressed="false">${esc(TABLES[k].label)}</button>`).join('')}</div><div id="apanel" class="panel"></div></div>`;
  panel = $('apanel');
  host.querySelectorAll('#subnav, #subnav2').forEach(n => n.onclick = e => { const b = e.target.closest('[data-s]'); if (b) show(b.dataset.s); });
  try { communities = await api.list('communities'); } catch {}
  show('monitor');
}
async function show(s) {
  if (s === 'content') s = lastContent;
  const isContent = CONTENT().includes(s); if (isContent) lastContent = s;
  host.querySelectorAll('#subnav [data-s]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.s === (isContent ? 'content' : s))));
  $('subnav2').hidden = !isContent; host.querySelectorAll('#subnav2 [data-s]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.s === s)));
  panel.innerHTML = '<div class="loading"><span class="spinner"></span> Loading…</div>';
  try {
    if (s === 'monitor') await monitor(); else if (s === 'submissions') await submissions(); else if (s === 'users') await users();
    else if (TABLES[s]) await content(s); else if (s === 'messages') messages(); else if (s === 'push') push(); else if (s === 'sync') sync();
    else if (s === 'corrections') await corrections(); else if (s === 'audit') await audit(); else functions();
  } catch (e) { panel.innerHTML = `<div class="empty"><h3>Could not load</h3><p>${esc(e.message)}</p></div>`; }
}
let lastContent = 'articles';

async function monitor() {
  const c = await api.counts(), pending = c.sub_submitted + c.sub_under_review;
  let u = []; if (ctx.isAdmin) try { u = await api.users(); } catch {}
  panel.innerHTML = `<h3>Monitoring</h3><div class="stats">
    ${ctx.isAdmin ? `<div class="stat"><b>${u.length}</b>registered users</div><div class="stat"><b>${u.filter(x => x.banned).length}</b>banned users</div>` : ''}
    <div class="stat"><b>${pending}</b>submissions waiting</div><div class="stat"><b>${c.sub_changes_requested}</b>awaiting changes</div>
    <div class="stat st-approved"><b>${c.sub_approved}</b>approved</div><div class="stat st-rejected"><b>${c.sub_rejected}</b>rejected</div>
    <div class="stat"><b>${c.articles.published}</b>published articles <span class="muted small">(of ${c.articles.total})</span></div>
    <div class="stat"><b>${c.events.published}</b>published events</div><div class="stat"><b>${c.corrections_open}</b>open corrections</div></div>
    <h3>All content</h3><table class="tbl"><thead><tr><th>Section</th><th>Published</th><th>Total</th></tr></thead><tbody>${Object.entries(TABLES).map(([k, v]) => `<tr><td>${esc(v.label)}</td><td>${c[k].published}</td><td>${c[k].total}</td></tr>`).join('')}</tbody></table>`;
}

// ---------- content editor ----------
function fieldHtml(f, row) {
  let v = row[f.name] ?? ''; if (f.type === 'lines' && Array.isArray(v)) v = v.join('\n');
  const id = 'f_' + f.name, req = f.required ? ' required' : '';
  if (f.type === 'checkbox') return `<label class="chk"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
  let ctl;
  if (f.type === 'textarea' || f.type === 'lines') ctl = `<textarea id="${id}" name="${f.name}" rows="${f.type === 'lines' ? 5 : 4}"${req}>${esc(v)}</textarea>`;
  else if (f.type === 'select') ctl = `<select id="${id}" name="${f.name}"${req}>${f.required ? '' : '<option value=""></option>'}${f.options.map(o => `<option value="${o}" ${o === v ? 'selected' : ''}>${esc(label(o))}</option>`).join('')}</select>`;
  else if (f.type === 'community') ctl = `<select id="${id}" name="${f.name}"><option value="">None</option>${communities.map(c => `<option value="${c.id}" ${c.id === v ? 'selected' : ''}>${esc(c.preferred_name)}</option>`).join('')}</select>`;
  else ctl = `<input id="${id}" name="${f.name}" type="${f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}" ${f.type === 'number' ? 'step="any"' : ''} value="${esc(v)}"${req}>`;
  return `<div class="fld"><label for="${id}">${esc(f.label)}</label>${ctl}</div>`;
}
function collect(def, form, existing) {
  const fd = new FormData(form), row = existing.id ? { id: existing.id } : {};
  for (const f of def.fields) {
    const raw = fd.get(f.name);
    if (f.type === 'checkbox') row[f.name] = fd.has(f.name);
    else if (f.type === 'number') row[f.name] = raw === '' || raw == null ? null : Number(raw);
    else if (f.type === 'lines') row[f.name] = String(raw || '').split('\n').map(x => x.trim()).filter(Boolean);
    else row[f.name] = raw === '' || raw == null ? null : String(raw).trim();
  }
  if ('slug' in def.fields.reduce((o, f) => (o[f.name] = 1, o), {}) && !row.slug) row.slug = slugify(row[def.title]) + '-' + Math.random().toString(36).slice(2, 6);
  if (row.status === 'published') { if ('slug' in row) row.last_reviewed_at = new Date().toISOString(); if (def === TABLES.articles) row.published_at = row.published_at || new Date().toISOString(); }
  if (!existing.id) for (const k of Object.keys(row)) if (row[k] === null) delete row[k];
  return row;
}
async function content(table) {
  const def = TABLES[table]; let rows = await api.list(table), q = '', st = 'all';
  const hasSlug = def.fields.some(f => f.name === 'slug');
  const draw = () => {
    const list = rows.filter(r => (st === 'all' || r.status === st) && (!q || String(r[def.title]).toLowerCase().includes(q)));
    panel.querySelector('tbody').innerHTML = list.map(r => `<tr><td><b>${esc(String(r[def.title]).slice(0, 90))}</b>${hasSlug ? `<br><span class="muted small">/${esc(r.slug)}</span>` : ''}</td><td><span class="badge ${r.status === 'published' ? 'documented' : 'scholarly_interpretation'}">${esc(r.status)}</span></td><td>${fmt(r.updated_at || r.created_at)}</td>
      <td class="acts"><button class="chip" data-a="edit" data-id="${r.id}">Edit</button> <button class="chip" data-a="toggle" data-id="${r.id}">${r.status === 'published' ? (table === 'media_shares' ? 'Hide' : 'Unpublish') : 'Publish'}</button>${ctx.isAdmin ? ` <button class="chip" data-a="del" data-id="${r.id}">Delete</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nothing here yet.</td></tr>';
  };
  panel.innerHTML = `<div class="section-head"><h3 style="margin:0">${esc(def.label)}</h3>${def.noNew ? '' : '<span><button class="btn btn-ghost" data-a="pubAll">Publish all drafts</button> <button class="btn" data-a="new">New</button></span>'}</div>
  <div class="bar"><input type="search" id="fq" placeholder="Filter" aria-label="Filter by name"><select id="fs" aria-label="Filter by status"><option value="all">All statuses</option><option>draft</option><option>published</option><option>hidden</option><option>archived</option></select></div>
  <table class="tbl"><thead><tr><th>Name</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody></tbody></table>`;
  draw(); $('fq').oninput = e => { q = e.target.value.toLowerCase(); draw(); }; $('fs').onchange = e => { st = e.target.value; draw(); };
  const refresh = async () => { rows = await api.list(table); draw(); };
  panel.onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const row = rows.find(r => r.id === b.dataset.id);
    try {
      if (b.dataset.a === 'new') return edit(def, table, {}, refresh);
      if (b.dataset.a === 'pubAll') {
        const drafts = rows.filter(r => r.status === 'draft');
        if (!drafts.length) return toast('There are no drafts to publish.');
        if (!confirm(`Publish ${drafts.length} draft ${drafts.length === 1 ? 'item' : 'items'} in “${def.label}” now? They become visible to everyone.`)) return;
        let done = 0; for (const r of drafts) { try { await api.save(table, { id: r.id, status: 'published', ...(table === 'articles' ? { published_at: r.published_at || new Date().toISOString() } : {}) }); done++; } catch (err) { fail(err); break; } }
        toast(`Published ${done} of ${drafts.length}.`); return refresh();
      }
      if (b.dataset.a === 'edit') return edit(def, table, row, refresh);
      if (b.dataset.a === 'toggle') { const pub = row.status !== 'published'; await api.save(table, { id: row.id, status: pub ? 'published' : (table === 'media_shares' ? 'hidden' : 'draft'), ...(pub && table === 'articles' ? { published_at: row.published_at || new Date().toISOString() } : {}) }); toast(pub ? 'Published.' : 'Unpublished.'); await refresh(); }
      if (b.dataset.a === 'del' && confirm(`Delete “${row[def.title]}” permanently? This cannot be undone.`)) { await api.remove(table, row.id); toast('Deleted.'); await refresh(); }
    } catch (err) { fail(err); }
  };
}
const CREDIT_TYPES = ['articles', 'events', 'heritage_records', 'landmarks', 'people', 'institutions', 'organisations'];
function edit(def, table, row, done) {
  const dlg = $('dlg'), withCredits = CREDIT_TYPES.includes(table), ctype = typeOf(table);
  dlg.innerHTML = `<form method="dialog" id="ef"><h2>${row.id ? 'Edit' : 'New'}: ${esc(def.label)}</h2><div class="fgrid">${def.fields.map(f => `<div class="${['textarea', 'lines'].includes(f.type) || f.name === 'summary' ? '' : 'half'}">${fieldHtml(f, row)}</div>`).join('')}</div>
  ${withCredits ? `<div class="fld"><label for="f_credits">Credits: one person per line as Name | role (the first line is the author)</label><textarea id="f_credits" rows="3" placeholder="Ada Obi | author&#10;Tunde Bello | editor"></textarea></div>` : ''}
  <div class="bar"><button class="btn" value="save">Save</button><button class="btn btn-ghost" value="cancel" formnovalidate>Cancel</button></div></form>`;
  dlg.showModal();
  if (withCredits && row.id) getCreditsText(ctype, row.id).then(t => { const x = $('f_credits'); if (x) x.value = t; }).catch(() => {});
  dlg.querySelector('#ef').addEventListener('submit', async e => {
    if (e.submitter?.value !== 'save') return; e.preventDefault();
    try {
      const saved = await api.save(table, collect(def, e.target, row)), credits = $('f_credits')?.value ?? null;
      if (withCredits && credits !== null && (credits.trim() || row.id)) await setCreditsText(ctype, saved.id || row.id, credits);
      dlg.close(); toast('Saved.'); await done();
    } catch (err) { fail(err); }
  });
}

// ---------- submissions ----------
async function submissions() {
  const subs = await api.submissions(); let f = 'open';
  const cname = id => communities.find(c => c.id === id)?.preferred_name;
  const draw = () => {
    const list = subs.filter(s => f === 'all' || (f === 'open' ? ['submitted', 'under_review', 'changes_requested'].includes(s.status) : s.status === f));
    $('subs').innerHTML = list.map(s => `<article class="card sub" data-id="${s.id}" style="margin-bottom:var(--space-4)"><div class="eyebrow">${esc(label(s.kind))}</div><h3>${esc(s.title)}</h3>
      <p class="muted small"><span class="status ${s.status}">${esc(label(s.status))}</span> · ${fmt(s.created_at)} · <b>Place:</b> ${esc(s.region_text || '-')}${s.community_id ? ' · ' + esc(cname(s.community_id) || '') : ''} · consent ${s.consent_given ? 'given' : 'NOT given'}</p>
      <details><summary>Read the submission</summary><div class="card" style="margin-top:.5rem">${Object.entries(s.payload || {}).filter(([k, v]) => v && k !== 'media').map(([k, v]) => `<p><b>${esc(label(k))}:</b> ${esc(String(v))}</p>`).join('') || '<p class="muted">No details.</p>'}<div class="media" data-m='${esc(JSON.stringify((s.payload || {}).media || []))}'></div></div></details>
      <div class="fld"><label for="fb-${s.id}">Feedback to the contributor</label><textarea id="fb-${s.id}" rows="2">${esc(s.editor_feedback || '')}</textarea></div>
      <div class="bar">${[['under_review', 'Mark under review'], ['changes_requested', 'Request changes'], ['approved', s.kind === 'edit' ? 'Approve and apply' : 'Approve and publish'], ['rejected', 'Reject']].map(([v, t]) => `<button class="chip" data-d="${v}">${t}</button>`).join('')}</div></article>`).join('') || '<div class="empty"><h3>Nothing in this view</h3></div>';
  };
  panel.innerHTML = `<h3>Submissions</h3><div class="bar"><label class="visually-hidden" for="rf">Show</label><select id="rf"><option value="open">Needs attention</option><option value="all">All</option>${SUBMISSION_STATUSES.map(s => `<option value="${s}">${label(s)}</option>`).join('')}</select></div>
<div id="subs"></div>`;
  draw(); $('rf').onchange = e => { f = e.target.value; draw(); };
  panel.addEventListener('toggle', async e => { const m = e.target.querySelector?.('.media'); if (e.target.open && m && !m.dataset.done) { m.dataset.done = 1; const paths = JSON.parse(m.dataset.m || '[]'); if (paths.length) { try { const l = await api.mediaLinks(paths); m.innerHTML = '<p><b>Files (links expire in 10 minutes):</b></p>' + l.map(x => `<p><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.path.split('/').pop())}</a></p>`).join(''); } catch {} } } }, true);
  panel.onclick = async e => {
    const b = e.target.closest('[data-d]'); if (!b) return; const card = b.closest('.sub'), s = subs.find(x => x.id === card.dataset.id), fb = card.querySelector('textarea').value;
    if (['changes_requested', 'rejected'].includes(b.dataset.d) && !fb.trim()) return toast('Add feedback so the contributor knows why.');
    if (b.dataset.d === 'approved' && !confirm(s.kind === 'edit' ? 'Apply this correction now?' : 'Publish this submission now?')) return;
    try { await api.decide(s.id, b.dataset.d, fb); s.status = b.dataset.d; s.editor_feedback = fb; toast('Decision recorded.'); draw(); } catch (err) { fail(err); }
  };
}

// ---------- users ----------
async function users() {
  let list = await api.users(), q = '';
  const draw = () => {
    panel.querySelector('tbody').innerHTML = list.filter(u => !q || (u.email + ' ' + (u.display_name || '')).toLowerCase().includes(q)).map(u => `<tr><td><b>${esc(u.display_name || '(no name)')}</b><br><span class="muted small">${esc(u.email)}</span></td>
      <td>${(u.roles || []).map(r => `<span class="badge documented">${esc(label(r))}</span>`).join(' ') || '<span class="muted">member</span>'}${u.banned ? ' <span class="status rejected">banned</span>' : ''}</td><td>${u.submissions ?? 0}</td><td class="small">${fmt(u.created_at)}<br>${fmt(u.last_sign_in_at)}</td>
      <td class="acts"><button class="chip" data-a="role" data-id="${u.id}">Roles</button> <button class="chip" data-a="name" data-id="${u.id}">Edit</button> <button class="chip" data-a="ban" data-id="${u.id}">${u.banned ? 'Unban' : 'Ban'}</button> <button class="chip" data-a="del" data-id="${u.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">No users.</td></tr>';
  };
  panel.innerHTML = `<h3>Users</h3><div class="bar"><input type="search" id="uq" placeholder="Search name or email" aria-label="Search users"></div>
  <table class="tbl"><thead><tr><th>User</th><th>Rights</th><th>Posts</th><th>Joined / last seen</th><th>Actions</th></tr></thead><tbody></tbody></table>
`;
  draw(); $('uq').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
  const reload = async () => { list = await api.users(); draw(); };
  panel.onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const u = list.find(x => x.id === b.dataset.id); const dlg = $('dlg');
    try {
      if (b.dataset.a === 'ban') { let reason = null; if (!u.banned) { reason = prompt(`Ban ${u.email}? They will not be able to submit or chat. Reason (shown only to admins):`); if (reason === null) return; } await api.setBan(u.id, !u.banned, reason); toast(u.banned ? 'Unbanned.' : 'Banned.'); await reload(); }
      if (b.dataset.a === 'del' && confirm(`Permanently delete ${u.email} and everything they submitted? This cannot be undone.`) && prompt('Type DELETE to confirm.') === 'DELETE') { await api.deleteUser(u.id); toast('User deleted.'); await reload(); }
      if (b.dataset.a === 'name') { const n = prompt('Display name', u.display_name || ''); if (n !== null) { await api.editUser(u.id, n); toast('Saved.'); await reload(); } }
      if (b.dataset.a === 'role') {
        dlg.innerHTML = `<form method="dialog"><h2>Rights for ${esc(u.email)}</h2><p>Current: ${(u.roles || []).map(label).join(', ') || 'member'}</p><div class="fld"><label for="rr">Role</label><select id="rr">${ROLES.map(r => `<option>${r}</option>`).join('')}</select></div>
          <div class="bar"><button class="btn" value="grant">Grant (promote)</button><button class="btn btn-ghost" value="revoke">Revoke (demote)</button><button class="btn btn-ghost" value="cancel" formnovalidate>Close</button></div></form>`;
        dlg.showModal();
        dlg.querySelector('form').addEventListener('submit', async ev => { const v = ev.submitter?.value; if (v === 'cancel') return; ev.preventDefault(); try { await api.setRole(u.email, $('rr').value, v === 'grant'); dlg.close(); toast(v === 'grant' ? 'Role granted.' : 'Role revoked.'); await reload(); } catch (err) { fail(err); } });
      }
    } catch (err) { fail(err); }
  };
}

// ---------- messages & push ----------
function audienceForm(withLink) {
  return `<div class="fld"><label for="aud">Send to</label><select id="aud"><option value="all">Everyone</option><option value="editors">Editors and admins</option><option value="contributors">Members who have submitted something</option><option value="selected">Chosen people (emails)</option></select></div>
  <div class="fld" id="emw" hidden><label for="ems">Email addresses</label><textarea id="ems" rows="3" placeholder="one@example.org, two@example.org"></textarea></div>
  <div class="fld"><label for="mt">Title *</label><input id="mt" type="text" maxlength="120"></div><div class="fld"><label for="mb">Message</label><textarea id="mb" rows="4" maxlength="1000"></textarea></div>
  ${withLink ? '<div class="fld"><label for="ml">Link when opened (optional)</label><input id="ml" type="text" placeholder="/events/"></div>' : ''}`;
}
const emails = () => $('ems').value.split(/[\s,;]+/).filter(x => /\S+@\S+/.test(x));
function wireAudience() { $('aud').onchange = () => { $('emw').hidden = $('aud').value !== 'selected'; }; }
function messages() {
  panel.innerHTML = `<h3>Send an in-app notification</h3><form id="mf" class="card formcard">${audienceForm(true)}<button class="btn" type="submit">Send notification</button></form>`;
  wireAudience();
  $('mf').onsubmit = async e => {
    e.preventDefault(); if (!$('mt').value.trim()) return toast('Add a title.'); if ($('aud').value === 'selected' && !emails().length) return toast('Add at least one email.');
    if (!confirm(`Send this to ${$('aud').selectedOptions[0].text.toLowerCase()}?`)) return;
    try { const n = await api.sendNotification($('aud').value, emails(), $('mt').value.trim(), $('mb').value.trim(), $('ml').value.trim()); toast(`Sent to ${n} ${n === 1 ? 'person' : 'people'}.`); $('mf').reset(); } catch (err) { fail(err); }
  };
}
function push() {
  panel.innerHTML = `<h3>Send a push notification</h3><form id="pf" class="card formcard"><div class="fld"><label for="aud">Send to</label><select id="aud"><option value="all">Everyone who turned push on</option><option value="selected">Chosen people (emails)</option></select></div>
  <div class="fld" id="emw" hidden><label for="ems">Email addresses</label><textarea id="ems" rows="3"></textarea></div><div class="fld"><label for="mt">Title *</label><input id="mt" type="text" maxlength="120"></div><div class="fld"><label for="mb">Message</label><textarea id="mb" rows="3" maxlength="300"></textarea></div>
  <div class="fld"><label for="ml">Opens (optional)</label><input id="ml" type="text" placeholder="/events/"></div><label class="chk"><input type="checkbox" id="alsoin" checked> Also save as an in-app notification</label><button class="btn" type="submit">Send push</button></form>
  <p><button class="btn btn-ghost" type="button" id="pcheck">Check push setup</button></p><p id="pres" role="status"></p>`;
  wireAudience();
  $('pcheck').onclick = async () => { try { const r = await api.pushStatus(); $('pres').textContent = r.ready ? 'Push function is deployed and fully configured.' : `Push function is deployed, but these settings are missing in Netlify: ${r.missing.join(', ')}.`; } catch (err) { $('pres').textContent = 'Could not reach the push function: ' + err.message; } };
  $('pf').onsubmit = async e => {
    e.preventDefault(); if (!$('mt').value.trim()) return toast('Add a title.'); if ($('aud').value === 'selected' && !emails().length) return toast('Add at least one email.');
    if (!confirm('Send this push notification now?')) return;
    const b = e.submitter; b.disabled = true;
    try {
      const r = await api.sendPush({ audience: $('aud').value, emails: emails(), title: $('mt').value.trim(), body: $('mb').value.trim(), url: $('ml').value.trim() || undefined });
      $('pres').textContent = `Delivered to ${r.sent} device(s). Failed: ${r.failed}. Expired and removed: ${r.expired || 0}.`;
      if ($('alsoin').checked) await api.sendNotification($('aud').value === 'all' ? 'all' : 'selected', emails(), $('mt').value.trim(), $('mb').value.trim(), $('ml').value.trim());
    } catch (err) { fail(err); $('pres').textContent = 'Not sent: ' + err.message; }
    b.disabled = false;
  };
}

function sync() {
  panel.innerHTML = `<h3>Website import</h3><p>Posts tagged <b>atlas</b> on your WordPress site are imported every hour. Only new or changed posts are downloaded. Topic and community are worked out from the post's ordinary tags, or set exactly with the tags below.</p>
  <div class="card" style="margin-bottom:var(--space-4)"><b>Tags to use on WordPress</b><ul style="margin:.5rem 0 0;padding-left:1.2rem">
  <li><code>atlas</code>: import this post</li><li><code>atlas:type:article</code> (or event, heritage, landmark, person, institution, organisation)</li><li><code>atlas:topic:history</code> (history, people, language, culture, food, spirituality, names, popular_event)</li>
  <li><code>atlas:community:ile-ife</code>: the community’s slug</li><li><code>atlas:editor:Ọlá Adé</code>: one tag per co-editor</li><li><code>atlas:date:2026-08-14</code> and optional <code>atlas:enddate:2026-08-16</code>: for events</li><li><code>atlas:category:craft</code>: for heritage records</li></ul></div>
  <p><button class="btn btn-ghost" type="button" id="wcheck">Check connection</button> <button class="btn" type="button" id="wsync">Sync now</button></p><div id="wres" role="status"></div>`;
  $('wcheck').onclick = async () => { try { const r = await api.wpStatus(); $('wres').innerHTML = r.ready ? '<p>The import function is deployed and configured.</p>' : `<p>The import function is deployed, but these Netlify settings are missing: <b>${esc((r.missing || []).join(', '))}</b>.</p>`; } catch (err) { $('wres').textContent = 'Could not reach the import function: ' + err.message; } };
  $('wsync').onclick = async e => { const b = e.target; b.disabled = true; $('wres').innerHTML = '<div class="loading"><span class="spinner"></span> Importing…</div>';
    try { const r = await api.wpSync(); $('wres').innerHTML = `<div class="card"><b>Done.</b> Found ${r.found} tagged post${r.found === 1 ? '' : 's'}; ${r.checked ?? r.found} new or changed. New: ${r.created}. Updated: ${r.updated}. Archived (tag removed): ${r.archived}.${r.errors?.length ? `<br>Problems:<ul>${r.errors.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`; } catch (err) { $('wres').textContent = 'Import failed: ' + err.message; } b.disabled = false; };
}

async function corrections() {
  const rows = await api.corrections();
  panel.innerHTML = `<h3>Correction requests</h3>` + (rows.map(c => `<article class="card" style="margin-bottom:var(--space-4)"><p><b>${esc(label(c.record_type))}</b> · ${fmt(c.created_at)}</p><p>${esc(c.message)}</p><p class="muted small">Contact: ${esc(c.contact_email || 'none given')}</p><div class="bar"><label class="visually-hidden" for="c-${c.id}">Status</label><select id="c-${c.id}" data-id="${c.id}">${['open', 'in_review', 'resolved', 'declined'].map(s => `<option ${s === c.status ? 'selected' : ''} value="${s}">${label(s)}</option>`).join('')}</select></div></article>`).join('') || '<div class="empty"><h3>No correction requests</h3></div>');
  panel.onchange = async e => { const s = e.target.closest('select[data-id]'); if (s) try { await api.setCorrection(s.dataset.id, s.value); toast('Status updated.'); } catch (err) { fail(err); } };
}
async function audit() {
  const rows = await api.audit();
  panel.innerHTML = `<h3>Audit trail</h3><table class="tbl"><thead><tr><th>When</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead><tbody>${rows.map(r => `<tr><td>${fmt(r.at)}</td><td>${esc(r.action)}</td><td>${esc(r.target_type)}<br><span class="muted small">${esc(r.target_id || '')}</span></td><td class="small">${esc(JSON.stringify(r.detail || {}))}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No activity yet.</td></tr>'}</tbody></table>`;
}
function functions() {
  panel.innerHTML = `<h3>All functions</h3><table class="tbl"><thead><tr><th>Area</th><th>Function</th><th>State</th></tr></thead><tbody>${FUNCTIONS.map(([a, f, s]) => `<tr><td>${esc(a)}</td><td>${esc(f)}</td><td><span class="badge ${s.startsWith('Built') ? 'documented' : s.startsWith('Not') ? 'scholarly_interpretation' : 'oral_tradition'}">${esc(s)}</span></td></tr>`).join('')}</tbody></table>`;
}
