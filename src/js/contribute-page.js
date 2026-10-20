import { getContext, loadCommunities, loadArticles, loadEvents, TOPICS, TOPIC_LABEL } from './api.js';
import { esc } from './search.js';
import { setDemoRole } from './core.js';
import { toast } from './shell.js';

const $ = id => document.getElementById(id), root = $('contrib');
const params = new URLSearchParams(location.search);
let ctx, communities = [], type = ['article', 'edit', 'event'].includes(params.get('type')) ? params.get('type') : 'article';

const TYPES = { article: ['Write an article', 'Share research, history, stories, language, food or any topic about a community.'], edit: ['Correct or improve', 'Fix a mistake or add to an existing article or event.'], event: ['Add an event', 'Tell people about something happening in your community.'] };
const fld = (id, label, ctl, hint = '') => `<div class="fld" id="w-${id}"><label for="${id}">${label}</label>${ctl}${hint ? `<p class="hint">${hint}</p>` : ''}<p class="errmsg" hidden></p></div>`;
const inp = (id, o = '') => `<input id="${id}" name="${id}" type="text" ${o}>`;

function formHtml() {
  const commOpts = `<option value="">Not listed / not sure</option>${communities.map(c => `<option value="${esc(c.id)}" ${c.slug === params.get('community') ? 'selected' : ''}>${esc(c.preferred_name)} (${esc(c.country)})</option>`).join('')}`;
  const common = fld('community', 'Community (if it is listed)', `<select id="community" name="community">${commOpts}</select>`) +
    fld('region', 'City, town or exact region this is about *', inp('region', 'required maxlength="160" placeholder="For example: Ìbàdàn, Oyo State, Nigeria"'), 'Required. Be as exact as you can, so editors can place your submission.');
  const consent = `<div class="fld" id="w-consent"><label class="chk"><input type="checkbox" id="consent"> I wrote this or have the right to share it, and I agree it may be edited and published after review. *</label><p class="errmsg" hidden></p></div>`;
  const files = fld('files', 'Photos or documents (optional)', '<input id="files" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple>', 'Up to 5 files, 10 MB each. Only share what you are allowed to share.');
  let body;
  if (type === 'article') body = fld('title', 'Title *', inp('title', 'required maxlength="200"')) +
    fld('topic', 'Topic *', `<select id="topic">${TOPICS.map(t => `<option value="${t}" ${t === params.get('topic') ? 'selected' : ''}>${TOPIC_LABEL[t]}</option>`).join('')}</select>`) +
    fld('summary', 'Short summary', '<textarea id="summary" rows="2" maxlength="400"></textarea>') +
    fld('body', 'Article *', '<textarea id="body" rows="12"></textarea>', 'At least 200 characters. Write what you know and say where it comes from.') +
    fld('sources', 'Sources', '<textarea id="sources" rows="3"></textarea>', 'People, books, documents or oral accounts this is based on.') +
    fld('credit', 'Name to credit (optional)', inp('credit', 'maxlength="120"'));
  else if (type === 'edit') body = fld('ttype', 'What do you want to correct? *', '<select id="ttype"><option value="article">An article</option><option value="event">An event</option><option value="community">A community page</option><option value="other">Something else</option></select>') +
    `<div id="target-wrap">${fld('target', 'Which one? *', '<select id="target"></select>')}</div>` +
    fld('ptitle', 'New title (only if it should change)', inp('ptitle', 'maxlength="200"')) + fld('psummary', 'New summary (only if it should change)', '<textarea id="psummary" rows="2"></textarea>') +
    fld('pbody', 'New or corrected text (only if it should change)', '<textarea id="pbody" rows="8"></textarea>') +
    fld('reason', 'What is wrong, and how do you know? *', '<textarea id="reason" rows="4"></textarea>', 'Editors use this to check your correction.') +
    fld('sources', 'Sources', '<textarea id="sources" rows="3"></textarea>');
  else body = fld('title', 'Event name *', inp('title', 'required maxlength="200"')) + fld('summary', 'What is it? *', '<textarea id="summary" rows="3" maxlength="600"></textarea>') +
    fld('body', 'More details', '<textarea id="body" rows="5"></textarea>') + fld('location', 'Venue or place *', inp('location', 'maxlength="200"')) +
    `<div class="row">${fld('d1', 'Starts *', '<input id="d1" type="date">')}${fld('d2', 'Ends (optional)', '<input id="d2" type="date">')}</div>` + fld('organiser', 'Organiser', inp('organiser', 'maxlength="160"'), 'Do not enter private phone numbers or home addresses.');
  return `<form id="cform" class="card formcard" novalidate>${common}${body}${files}${consent}<p id="formmsg" role="alert" class="small" style="color:var(--danger)"></p><button class="btn" type="submit" id="send">Submit for review</button></form>`;
}
function draw() {
  root.innerHTML = `<div class="typecards" role="group" aria-label="What would you like to do?">${Object.entries(TYPES).map(([k, [t, d]]) => `<button type="button" class="typecard" data-type="${k}" aria-pressed="${type === k}"><b>${t}</b><span class="muted small">${d}</span></button>`).join('')}</div><div id="form-slot">${formHtml()}</div>`;
  $('ttype') && loadTargets(); $('ttype')?.addEventListener('change', loadTargets);
  $('cform').addEventListener('submit', submit);
}
async function loadTargets() {
  const t = $('ttype').value, wrap = $('target-wrap');
  if (t === 'article' || t === 'event') {
    wrap.innerHTML = fld('target', 'Which one? *', '<select id="target"><option value="">Loading…</option></select>');
    const rows = t === 'article' ? await loadArticles() : await loadEvents();
    $('target').innerHTML = rows.length ? rows.map(r => `<option value="${esc(r.id)}">${esc(r.title || r.name)}</option>`).join('') : '<option value="">Nothing published yet</option>';
  } else wrap.innerHTML = fld('target', 'Name or address of the page *', inp('target', 'maxlength="200"'));
}
const err = (id, msg) => { const w = $('w-' + id); w.classList.add('err'); const e = w.querySelector('.errmsg'); e.textContent = msg; e.hidden = false; return w; };
async function submit(e) {
  e.preventDefault();
  document.querySelectorAll('.fld.err').forEach(w => { w.classList.remove('err'); w.querySelector('.errmsg').hidden = true; });
  const v = id => ($(id)?.value || '').trim(), bad = [];
  if (v('region').length < 2) bad.push(err('region', 'Tell us the city, town or exact region.'));
  if (type !== 'edit' && !v('title')) bad.push(err('title', 'Add a title.'));
  if (type === 'article' && v('body').length < 200) bad.push(err('body', 'Write at least 200 characters.'));
  if (type === 'event') { if (!v('summary')) bad.push(err('summary', 'Describe the event.')); if (!v('location')) bad.push(err('location', 'Add the venue or place.')); if (!v('d1')) bad.push(err('d1', 'Add the start date.')); if (v('d2') && v('d2') < v('d1')) bad.push(err('d2', 'The end date is before the start date.')); }
  if (type === 'edit') { if (!v('target')) bad.push(err('target', 'Choose what you are correcting.')); if (v('reason').length < 10) bad.push(err('reason', 'Explain what is wrong.')); }
  if (!$('consent').checked) bad.push(err('consent', 'Please confirm before submitting.'));
  if (bad.length) { bad[0].querySelector('input,select,textarea')?.focus(); return; }
  const btn = $('send'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Sending…';
  const payload = type === 'article' ? { topic: v('topic'), summary: v('summary'), body: v('body'), sources: v('sources'), author_credit: v('credit') }
    : type === 'event' ? { summary: v('summary'), body: v('body'), location: v('location'), date_start: v('d1'), date_end: v('d2'), organiser: v('organiser') }
    : { target_type: v('ttype'), target_id: ['article', 'event'].includes(v('ttype')) ? v('target') : null, target_label: $('target').tagName === 'SELECT' ? $('target').selectedOptions[0]?.text : v('target'), proposed_title: v('ptitle'), proposed_summary: v('psummary'), proposed_body: v('pbody'), reason: v('reason'), sources: v('sources') };
  const title = type === 'edit' ? `Correction: ${payload.target_label}`.slice(0, 200) : v('title');
  try {
    await ctx.api.submit({ kind: type, title, community_id: v('community') || null, region_text: v('region'), payload, consent_given: true }, [...($('files').files || [])]);
    root.innerHTML = `<div class="card formcard"><h2>Thank you</h2><p>Your submission is with the editors. You will see its status, and any feedback, in your dashboard and notifications.</p><p><a class="btn" href="/account/#posts">View my posts</a> <a class="btn btn-ghost" href="/contribute/">Add another</a></p></div>`;
  } catch (ex) { $('formmsg').textContent = ex.message; btn.disabled = false; btn.textContent = 'Submit for review'; toast('Could not submit. ' + ex.message, 6000); }
}
root.addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (b) { type = b.dataset.type; draw(); } });

(async () => {
  try { ctx = await getContext(); } catch (e) { ctx = { mode: 'none' }; }
  if (ctx.mode === 'none') return root.innerHTML = `<div class="card"><h2>Accounts are not connected yet</h2><p>Contributions need sign-in, which needs the Supabase connection. You can preview the form with sample data.</p><p><button class="btn" id="dm">Preview as a member</button></p></div>`, $('dm').onclick = () => { setDemoRole('user'); location.reload(); };
  if (!ctx.user) return root.innerHTML = `<div class="card"><h2>Sign in to contribute</h2><p>An account lets us credit you, tell you when an editor decides, and keep your submissions together.</p><p><a class="btn" href="/account/?next=/contribute/">Sign in / Sign up</a></p></div>`;
  if (ctx.banned) return root.innerHTML = '<div class="card"><h2>Contributions are paused for this account</h2><p>Please contact the administrators if you think this is a mistake.</p></div>';
  try { communities = (await loadCommunities()).rows; } catch {}
  draw();
  if (ctx.mode === 'demo') root.insertAdjacentHTML('afterbegin', '<p class="notice" style="margin-bottom:var(--space-4)"><strong>Demo mode.</strong> Submissions are kept in this browser tab only.</p>');
})();
