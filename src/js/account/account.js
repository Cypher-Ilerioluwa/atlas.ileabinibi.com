import { getContext, withTimeout } from '../api.js';
import { getClient } from '../supabase.js';
import { isConfigured, demoRole, setDemoRole, labelAccountLink, getTheme, setTheme, fmtDate, fmtDateTime, label } from '../core.js';
import { esc } from '../search.js';
import { toast } from '../shell.js';
import { setCrumbs } from '../core.js';
import { install as installApp, isStandalone } from '../install.js';
import { setCount, refreshBadges } from '../notify.js';
import { listSaved, loadCredits } from '../content.js';
import { postCard as articleCard } from '../post-card.js';
setCrumbs([['Home', '/'], ['Account']]);

const root = document.getElementById('acct-root'), $ = id => document.getElementById(id);
const next = (() => { const n = new URLSearchParams(location.search).get('next') || ''; return /^\/(?!\/)/.test(n) ? n : ''; })();
let ctx, section = 'overview';


// ---------------------------------------------------------------- signed out
const strength = pw => { let n = 0; if (pw.length >= 10) n++; if (pw.length >= 14) n++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) n++; if (/\d/.test(pw)) n++; if (/[^A-Za-z0-9]/.test(pw)) n++; if (!pw) return 0; return pw.length < 10 ? 1 : Math.max(2, Math.min(n, 5)); };
const STR = [['0%', 'var(--line)', ''], ['20%', 'var(--danger)', 'Too short'], ['40%', '#C9731B', 'Weak'], ['65%', 'var(--brand-gold)', 'Fair'], ['85%', '#7BA05B', 'Good'], ['100%', 'var(--ok)', 'Strong']];
function friendly(err) {
  const m = String(err?.message || err || '');
  if (/invalid login/i.test(m)) return 'That email and password do not match. Check them, or reset your password.';
  if (/not confirmed/i.test(m)) return 'Please confirm your email first. Use the link we sent you, or resend it below.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Please wait a few minutes and try again.';
  if (/network|fetch/i.test(m)) return 'We could not reach the server. Check your connection and try again.';
  return m || 'Something went wrong. Please try again.';
}
function authView(c) {
  let mode = 'signin';
  const hashErr = new URLSearchParams(location.hash.slice(1)).get('error_description');
  root.innerHTML = `<div class="auth-shell">
    <aside class="auth-side"><div><h2>Welcome to the Atlas</h2><p>Join people from every community, keep your contributions together and hear when an editor decides.</p></div>
      <ul class="auth-points"><li><span class="ic">✎</span><div><b>Contribute your knowledge</b>Articles, corrections and events from anywhere.</div></li><li><span class="ic">✓</span><div><b>Follow your submissions</b>See each one as pending, published or needing changes.</div></li><li><span class="ic">◎</span><div><b>Join the conversation</b>Chat, quizzes and news from your community.</div></li></ul>
      <p class="small" style="margin:0">Mapping Our Roots. Connecting Our People.</p></aside>
    <section class="auth-main"><div class="auth-box">
      ${c.mode === 'none' ? `<div class="alert info setup-card"><b>Sign-in is not available yet.</b> You can look around with sample data:<div style="margin-top:.6rem;display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn btn-ghost" id="dm-user" type="button">Preview as member</button><button class="btn btn-ghost" id="dm-admin" type="button">Preview as admin</button></div></div>` : ''}
      <div id="view"></div></div></section></div>`;
  $('dm-user')?.addEventListener('click', () => { setDemoRole('user'); location.hash = ''; location.reload(); });
  $('dm-admin')?.addEventListener('click', () => { setDemoRole('admin'); location.hash = '#admin'; location.reload(); });
  const view = $('view');
  const msg = (cls, t) => { const m = $('amsg'); m.className = 'alert ' + cls; m.textContent = t; m.hidden = !t; };

  function draw() {
    const forgot = mode === 'forgot', signup = mode === 'signup';
    view.innerHTML = `<h1>${forgot ? 'Reset your password' : signup ? 'Create your account' : 'Welcome back'}</h1><p class="sub">${forgot ? 'Enter your email and we will send you a reset link.' : signup ? 'It takes a minute. We will email you a link to confirm.' : 'Sign in to open your dashboard.'}</p>
    ${forgot ? '' : `<div class="seg-tabs" role="tablist" aria-label="Sign in or sign up"><button role="tab" type="button" data-m="signin" aria-selected="${!signup}">Sign in</button><button role="tab" type="button" data-m="signup" aria-selected="${signup}">Sign up</button></div>`}
    <form class="auth-form" id="form" novalidate><div id="amsg" class="alert" role="alert" hidden></div>
      ${signup ? '<div class="fld"><label for="dn">Your name</label><input id="dn" type="text" maxlength="80" autocomplete="name" placeholder="How should we show your name?"></div>' : ''}
      <div class="fld"><label for="em">Email</label><input id="em" type="email" required autocomplete="email" inputmode="email" placeholder="you@example.com"></div>
      ${forgot ? '' : `<div class="fld"><label for="pw">Password</label><div class="iw"><input id="pw" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="${signup ? 'At least 10 characters' : 'Your password'}"><button type="button" class="toggle" id="showpw" aria-pressed="false">Show</button></div>
        ${signup ? '<div class="meter" aria-hidden="true"><i id="mbar"></i></div><p class="meter-label" id="mlab" aria-live="polite">Use 10 or more characters.</p>' : ''}</div>
        ${signup ? '' : '<div class="between"><span></span><button type="button" class="linkbtn" data-m="forgot">Forgot password?</button></div>'}`}
      <button class="btn btn-gold block" id="go" type="submit">${forgot ? 'Send reset link' : signup ? 'Create account' : 'Sign in'}</button>
      ${forgot ? '<p class="fine" style="text-align:center"><button type="button" class="linkbtn" data-m="signin">Back to sign in</button></p>' : signup ? '<p class="fine">By creating an account you agree to share only what you have the right to share, and that editors review contributions before they are published.</p>' : '<p class="fine" style="text-align:center">New here? <button type="button" class="linkbtn" data-m="signup">Create an account</button></p>'}
    </form>`;
    if (hashErr && mode === 'signin') msg('err', hashErr.replace(/\+/g, ' ') + ' Request a new link by resetting your password or signing up again.');
    view.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.m; draw(); $('em')?.focus(); }));
    $('showpw')?.addEventListener('click', e => { const s = $('pw').type === 'password'; $('pw').type = s ? 'text' : 'password'; e.target.textContent = s ? 'Hide' : 'Show'; e.target.setAttribute('aria-pressed', String(s)); });
    $('pw')?.addEventListener('input', () => { if (!signup) return; const [w, col, t] = STR[strength($('pw').value)]; $('mbar').style.width = w; $('mbar').style.background = col; $('mlab').textContent = $('pw').value ? t : 'Use 10 or more characters.'; });
    $('form').addEventListener('submit', submit);
  }
  async function submit(e) {
    e.preventDefault(); const btn = $('go'), email = $('em').value.trim(), pw = $('pw')?.value || '';
    msg('', '');
    if (!/^\S+@\S+\.\S+$/.test(email)) { msg('err', 'Enter a valid email address.'); return $('em').focus(); }
    if (mode === 'signup' && pw.length < 10) { msg('err', 'Use a password of at least 10 characters.'); return $('pw').focus(); }
    if (mode === 'signin' && !pw) { msg('err', 'Enter your password.'); return $('pw').focus(); }
    if (!isConfigured()) return msg('info', 'Sign-in is not available yet.');
    const label0 = btn.textContent; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Please wait…';
    try {
      const db = await getClient();
      if (mode === 'signin') {
        const { error } = await db.auth.signInWithPassword({ email, password: pw });
        if (error) { if (/not confirmed/i.test(error.message)) { sentView(email, 'confirm'); return; } throw error; }
        labelAccountLink(true); location.href = next || '/account/'; return;
      }
      if (mode === 'signup') {
        const { data, error } = await db.auth.signUp({ email, password: pw, options: { data: { display_name: $('dn').value.trim() }, emailRedirectTo: location.origin + '/account/' } });
        if (error) throw error;
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('That email already has an account. Sign in, or reset your password.');
        if (data.session) { labelAccountLink(true); location.href = next || '/account/'; return; }
        return sentView(email, 'confirm');
      }
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/reset-password/' }); if (error) throw error;
      return sentView(email, 'reset');
    } catch (err) { msg('err', friendly(err)); }
    btn.disabled = false; btn.textContent = label0;
  }
  function sentView(email, kind) {
    view.innerHTML = `<div class="sent"><div class="big" aria-hidden="true">✉</div><h1 style="font-size:var(--step-2)">Check your email</h1>
      <p>${kind === 'reset' ? 'If an account exists for' : 'We sent a confirmation link to'} <b>${esc(email)}</b>${kind === 'reset' ? ', a reset link is on its way.' : '. Open it to activate your account, then sign in.'}</p>
      <p class="fine">Nothing there? Check spam. The link works once and expires.</p><div id="amsg" class="alert" role="status" hidden></div>
      <p><button class="btn btn-ghost" type="button" id="resend">${kind === 'reset' ? 'Send again' : 'Resend email'}</button> <button class="btn" type="button" id="back">Back to sign in</button></p></div>`;
    $('back').onclick = () => { mode = 'signin'; draw(); };
    $('resend').onclick = async e => {
      const b = e.target; b.disabled = true;
      try { const db = await getClient(); const r = kind === 'reset' ? await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/reset-password/' }) : await db.auth.resend({ type: 'signup', email, options: { emailRedirectTo: location.origin + '/account/' } }); if (r.error) throw r.error; msg('ok', 'Sent again.'); setTimeout(() => { b.disabled = false; }, 30000); }
      catch (err) { msg('err', friendly(err)); b.disabled = false; }
    };
  }
  draw();
}

// ---------------------------------------------------------------- dashboard
const PENDING = ['submitted', 'under_review'];
const initials = n => (n || '?').trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
async function dashboard() {
  const api = ctx.api, prof = await api.profile(), unread = await api.unread().catch(() => 0);
  const tabs = [['overview', 'Overview'], ['account', 'Account'], ['posts', 'Posts'], ['saved', 'Saved'], ['notifications', 'Notifications'], ['settings', 'Settings']];
  root.innerHTML = `<div class="dash"><nav class="dnav" aria-label="Dashboard">${tabs.map(([k, t]) => `<button type="button" data-s="${k}">${t}${k === 'notifications' ? '<b class="nbadge inline" data-nbadge hidden></b>' : ''}</button>`).join('')}
    ${ctx.isEditor ? '<div class="sep"></div><button type="button" data-s="admin">Admin</button>' : ''}<div class="sep"></div><button type="button" id="logout">Log out</button></nav><section id="dpanel" class="panel" aria-live="polite"></section></div>`;
  if (ctx.mode === 'demo') root.insertAdjacentHTML('afterbegin', `<p class="notice" style="margin-top:var(--space-4)"><strong>Demo mode.</strong> Sample data kept in this tab only; nothing is real or saved. <button class="btn btn-ghost" id="exit-demo" type="button">Exit demo</button></p>`);
  $('exit-demo')?.addEventListener('click', () => { setDemoRole(null); location.href = '/account/'; });
  root.querySelector('.dnav').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) go(b.dataset.s); });
  $('logout').onclick = async () => { await ctx.api.signOut(); setDemoRole(null); setCount(0); labelAccountLink(false); location.href = '/account/'; };
  const go = s => { if (s === 'admin' && !ctx.isEditor) s = 'overview'; section = s; history.replaceState(null, '', '#' + s); render(); };
  window.addEventListener('hashchange', () => go(location.hash.slice(1) || 'overview'));
  setCount(unread); go(location.hash.slice(1) || 'overview');
}
async function render() {
  document.querySelectorAll('.dnav [data-s]').forEach(b => b.dataset.s === section ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  const p = $('dpanel'); p.innerHTML = '<div class="loading"><span class="spinner"></span> Loading…</div>';
  const dog = setTimeout(() => { if (p.querySelector(':scope > .loading')) { p.innerHTML = '<div class="empty"><h3>This is taking too long</h3><p>Check your connection, then try again.</p><button class="btn" id="retry" type="button">Try again</button></div>'; $('retry').onclick = render; } }, 15000);
  try { await ({ overview, account, posts, saved, notifications, settings, admin }[section] || overview)(p); } catch (e) { p.innerHTML = `<div class="empty"><h3>Something went wrong</h3><p>${esc(e.message)}</p><button class="btn" id="retry" type="button">Try again</button></div>`; $('retry').onclick = render; }
  clearTimeout(dog);
}

async function overview(p) {
  const subs = await ctx.api.mySubmissions(), prof = await ctx.api.profile(), by = f => subs.filter(s => f(s.status)).length;
  p.innerHTML = `<div class="dash-head">${avatar(prof, 'avatar')}<div><h1 style="font-size:var(--step-2);margin:0">Welcome${prof.display_name ? ', ' + esc(prof.display_name.split(' ')[0]) : ''}</h1><p class="muted" style="margin:0">${esc(ctx.user.email)}${ctx.roles?.length ? ' · ' + esc(ctx.roles.map(label).join(', ')) : ''}</p></div><a class="btn btn-gold" href="/contribute/" style="margin-left:auto">New contribution</a></div>
  <div class="stats"><div class="stat st-approved"><b>${by(s => s === 'approved')}</b>Published</div><div class="stat"><b>${by(s => PENDING.includes(s))}</b>Pending review</div><div class="stat"><b>${by(s => s === 'changes_requested')}</b>Needs changes</div><div class="stat st-rejected"><b>${by(s => s === 'rejected')}</b>Rejected</div></div>
  <h2 style="font-size:var(--step-1)">Recent activity</h2>${subs.length ? `<div class="posts list">${subs.slice(0, 6).map(postCard).join('')}</div>` : '<div class="empty"><h3>No submissions yet</h3><p>Share an article, a correction or an event.</p><a class="btn" href="/contribute/">Contribute</a></div>'}`;
}
const avatar = (prof, cls) => { const u = ctx.api.avatarUrl(prof.avatar_path); return u ? `<img class="${cls}" src="${esc(u)}" alt="Your profile picture">` : `<div class="${cls}" aria-hidden="true">${esc(initials(prof.display_name || ctx.user.email))}</div>`; };
const postCard = s => `<article class="post"><div class="thumb" aria-hidden="true">${esc(label(s.kind)[0].toUpperCase())}</div><div class="pb"><span class="status ${s.status}">${esc(label(s.status))}</span> <span class="muted small">${esc(label(s.kind))} · ${fmtDate(s.created_at)}</span><h3>${esc(s.title)}</h3><p class="muted small" style="margin:0">${esc(s.region_text || '')}</p>${s.editor_feedback ? `<p class="small"><b>Editor:</b> ${esc(s.editor_feedback)}</p>` : ''}</div></article>`;

async function account(p) {
  const prof = await ctx.api.profile();
  p.innerHTML = `<h1 style="font-size:var(--step-2)">Account</h1>
  <form id="pf" class="card formcard stack"><div class="dash-head" style="margin:0">${avatar(prof, 'avatar big')}<div><label class="btn btn-ghost" for="av" style="cursor:pointer">Change picture</label><input id="av" type="file" accept="image/jpeg,image/png,image/webp" hidden><p class="hint small muted" style="margin:.3rem 0 0">JPEG, PNG or WebP, up to 1 MB.</p></div></div>
  <div class="fld"><label for="dn">Display name</label><input id="dn" type="text" maxlength="80" value="${esc(prof.display_name || '')}"></div>
  <div class="fld"><label for="bio">About you</label><textarea id="bio" rows="3" maxlength="600">${esc(prof.bio || '')}</textarea></div>
  <div class="fld"><label for="eml">Email</label><input id="eml" type="email" value="${esc(ctx.user.email)}" disabled><p class="hint">Contact an administrator to change your sign-in email.</p></div>
  <div><button class="btn" type="submit">Save profile</button></div></form>
  <form id="pwf" class="card formcard stack" style="margin-top:var(--space-5)"><h2 style="font-size:var(--step-1);margin:0">Change password</h2>
  <div class="fld"><label for="np">New password</label><input id="np" type="password" autocomplete="new-password" minlength="10"><p class="hint">At least 10 characters.</p></div><div class="fld"><label for="np2">Repeat new password</label><input id="np2" type="password" autocomplete="new-password"></div><div><button class="btn" type="submit">Update password</button></div></form>`;
  $('pf').onsubmit = async e => { e.preventDefault(); try { await ctx.api.updateProfile({ display_name: $('dn').value.trim() || null, bio: $('bio').value.trim() || null }); toast('Profile saved.'); } catch (err) { toast(err.message, 5000); } };
  $('av').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { await ctx.api.uploadAvatar(f); toast('Picture updated.'); account(p); } catch (err) { toast(err.message, 5000); } };
  $('pwf').onsubmit = async e => { e.preventDefault(); if ($('np').value.length < 10) return toast('Use at least 10 characters.'); if ($('np').value !== $('np2').value) return toast('The passwords do not match.'); try { await ctx.api.changePassword($('np').value); toast('Password updated.'); $('pwf').reset(); } catch (err) { toast(err.message, 5000); } };
}

async function posts(p) {
  const subs = await ctx.api.mySubmissions(); let view = localStorage.getItem('atlas-post-view') || 'list', f = 'all';
  const draw = () => {
    const l = subs.filter(s => f === 'all' || (f === 'pending' ? PENDING.includes(s.status) : s.status === f));
    $('plist').className = 'posts ' + view; $('plist').innerHTML = l.length ? l.map(postCard).join('') : '<div class="empty" style="grid-column:1/-1"><h3>Nothing here</h3><p>No posts match this filter.</p></div>';
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  };
  p.innerHTML = `<div class="section-head"><h1 style="font-size:var(--step-2);margin:0">My posts</h1><div class="viewtoggle" role="group" aria-label="Display style"><button data-view="list" aria-pressed="false">List</button><button data-view="grid" aria-pressed="false">Grid</button><button data-view="boxed" aria-pressed="false">Boxed</button></div></div>
  <div class="chips" style="margin-bottom:var(--space-4)" role="group" aria-label="Filter">${[['all', 'All'], ['pending', 'Pending'], ['approved', 'Published'], ['changes_requested', 'Needs changes'], ['rejected', 'Rejected']].map(([k, t]) => `<button class="chip" data-f="${k}" aria-pressed="${k === 'all'}">${t}</button>`).join('')}</div><div id="plist"></div>`;
  draw();
  p.onclick = e => { const v = e.target.closest('[data-view]'), fl = e.target.closest('[data-f]'); if (v) { view = v.dataset.view; localStorage.setItem('atlas-post-view', view); draw(); } if (fl) { f = fl.dataset.f; document.querySelectorAll('[data-f]').forEach(b => b.setAttribute('aria-pressed', String(b === fl))); draw(); } };
}

async function notifications(p) {
  let list = await ctx.api.notifications(), filter = 'all';
  const day = d => { const t = new Date(d), n = new Date(), y = new Date(Date.now() - 864e5), same = (a, b) => a.toDateString() === b.toDateString(); return same(t, n) ? 'Today' : same(t, y) ? 'Yesterday' : 'Earlier'; };
  const ICON = { submission: '📝', message: '✉️', system: '🔔' };
  const draw = () => {
    const unread = list.filter(n => !n.read_at).length, shown = list.filter(n => filter === 'all' || !n.read_at);
    setCount(unread);
    $('nlist').innerHTML = shown.length ? ['Today', 'Yesterday', 'Earlier'].map(g => { const rows = shown.filter(n => day(n.created_at) === g); return rows.length ? `<h2 class="ngrp">${g}</h2>` + rows.map(n => `<article class="notif ${n.read_at ? '' : 'unread'}" data-id="${esc(n.id)}" ${n.link ? `data-link="${esc(n.link)}"` : ''} tabindex="0"><span class="nic" aria-hidden="true">${ICON[n.kind] || '🔔'}</span><div class="nbody"><h3>${esc(n.title)}</h3>${n.body ? `<p>${esc(n.body)}</p>` : ''}<span class="muted small">${esc(label(n.kind))} · ${fmtDateTime(n.created_at)}</span></div>${n.read_at ? '' : '<i class="udot" aria-label="Unread"></i>'}</article>`).join('') : ''; }).join('')
      : `<div class="empty"><h3>${filter === 'all' ? 'No notifications yet' : 'You are all caught up'}</h3><p>Decisions on your posts and messages from the team appear here.</p></div>`;
    $('readall').disabled = !unread; $('ncount-all').textContent = list.length; $('ncount-unread').textContent = unread;
  };
  p.innerHTML = `<div class="section-head"><h1 style="font-size:var(--step-2);margin:0">Notifications</h1><button class="btn btn-ghost btn-sm" id="readall">Mark all as read</button></div>
    <div class="navtabs" role="tablist"><button class="chip" role="tab" data-f="all" aria-pressed="true">All <span class="muted small" id="ncount-all">0</span></button><button class="chip" role="tab" data-f="unread" aria-pressed="false">Unread <span class="muted small" id="ncount-unread">0</span></button></div><div id="nlist" class="nlist"></div>`;
  draw();
  const mark = async id => { const n = list.find(x => x.id === id); if (n && !n.read_at) { n.read_at = new Date().toISOString(); draw(); try { await ctx.api.markRead(id); } catch { /* keeps local state */ } } };
  p.onclick = async e => {
    const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; p.querySelectorAll('[data-f]').forEach(b => b.setAttribute('aria-pressed', String(b === f))); return draw(); }
    const card = e.target.closest('.notif'); if (card) { await mark(card.dataset.id); if (card.dataset.link) location.href = card.dataset.link; }
  };
  p.onkeydown = e => { if (e.key === 'Enter' && e.target.matches('.notif')) e.target.click(); };
  $('readall').onclick = async () => { list.forEach(n => { n.read_at = n.read_at || new Date().toISOString(); }); draw(); try { await ctx.api.markRead('all'); toast('All marked as read.'); } catch (err) { toast(err.message); } };
  const live = e => { if (section === 'notifications') { ctx.api.notifications().then(l => { list = l; draw(); }); } };
  addEventListener('atlas-notify', live, { once: true });
}

async function saved(p) {
  const items = await listSaved(ctx.user.id);
  p.innerHTML = `<h1 style="font-size:var(--step-2)">Saved</h1>` + (items.length ? '<div class="stack" id="slist"></div>' : '<div class="empty"><h3>Nothing saved yet</h3><p>Tap the bookmark on any post to keep it here.</p><a class="btn" href="/posts/">Browse posts</a></div>');
  if (!items.length) return;
  const types = [...new Set(items.map(i => i.type))], cr = {}; for (const t of types) cr[t] = await loadCredits(t, items.filter(i => i.type === t).map(i => i.item.id));
  $('slist').innerHTML = items.map(i => articleCard(i.item, { type: i.type, credits: cr[i.type].get(i.item.id) || [], eyebrow: 'Saved' })).join('');
}

async function settings(p) {
  const prefs = await withTimeout(ctx.api.prefs().catch(() => null), 8000, null) || { submission_updates: true, event_reminders: true, announcements: false }, push = await withTimeout(ctx.api.pushState().catch(() => 'unsupported'), 6000, 'off'), theme = getTheme();
  const installed = isStandalone();
  const sw = (id, t, d, on) => `<label class="switch" for="${id}"><span><b>${t}</b><br><span class="muted small">${d}</span></span><input type="checkbox" id="${id}" ${on ? 'checked' : ''}></label>`;
  p.innerHTML = `<h1 style="font-size:var(--step-2)">Settings</h1>
  <div class="card stack"><h2 style="font-size:var(--step-1);margin:0">Appearance</h2><div class="seg" role="group" aria-label="Theme">${[['light', 'Light (default)'], ['dark', 'Dark'], ['system', 'Match my device']].map(([k, t]) => `<button class="chip" data-theme="${k}" aria-pressed="${theme === k}">${t}</button>`).join('')}</div></div>
  <div class="card stack" style="margin-top:var(--space-4)"><h2 style="font-size:var(--step-1);margin:0">App</h2>
    <div class="switch"><span><b>Install the app</b><br><span class="muted small">${installed ? 'The app is installed on this device.' : 'Add Ilẹ̀ Abínibí Atlas to your home screen or desktop.'}</span></span><button class="btn btn-ghost" id="install" ${installed ? 'disabled' : ''}>${installed ? 'Installed' : 'Install'}</button></div>
    <div class="switch"><span><b>Updates</b><br><span class="muted small" id="upd">Check for the latest version of the app.</span></span><button class="btn btn-ghost" id="chk">Check for updates</button></div></div>
  <div class="card" style="margin-top:var(--space-4)"><h2 style="font-size:var(--step-1)">Notifications</h2>
    ${sw('p1', 'Updates on my submissions', 'Approved, rejected or changes requested.', prefs.submission_updates)}${sw('p2', 'Event reminders', 'Events you follow.', prefs.event_reminders)}${sw('p3', 'Announcements', 'News from the Atlas team.', prefs.announcements)}
    <div class="switch"><span><b>Push notifications on this device</b><br><span class="muted small" id="pushnote">${{ on: 'On for this device.', off: 'Off. Turning on asks your browser for permission.', denied: 'Blocked in your browser settings. Allow notifications for this site to enable.', unsupported: 'Not supported in this browser.', demo: 'Available on the live site.' }[push]}</span></span><button class="btn ${push === 'on' ? 'btn-ghost' : ''}" id="pushbtn" ${['denied', 'unsupported'].includes(push) ? 'disabled' : ''}>${push === 'on' ? 'Turn off' : 'Turn on'}</button></div></div>
  <div class="danger-zone"><h2>Danger zone</h2><p>Deleting your account permanently removes your profile, notifications and submissions. This cannot be undone.</p><button class="btn btn-danger" id="delacct">Delete my account…</button></div>`;
  p.onclick = e => { const t = e.target.closest('[data-theme]'); if (t) { setTheme(t.dataset.theme); p.querySelectorAll('[data-theme]').forEach(b => b.setAttribute('aria-pressed', String(b === t))); } };
  ['p1', 'p2', 'p3'].forEach(id => $(id).onchange = async () => { try { await ctx.api.savePrefs({ submission_updates: $('p1').checked, event_reminders: $('p2').checked, announcements: $('p3').checked }); toast('Saved.'); } catch (err) { toast(err.message, 5000); } });
  $('install').onclick = () => installApp();
  $('chk').onclick = async () => { const b = $('chk'); b.disabled = true; try { const reg = await navigator.serviceWorker?.getRegistration(); if (!reg) { $('upd').textContent = 'No installed version to update (offline support is off in this browser).'; } else { await reg.update(); $('upd').textContent = reg.waiting || reg.installing ? 'A new version is ready. Reload this page to use it.' : 'You have the latest version.'; } } catch { $('upd').textContent = 'Could not check. Are you online?'; } b.disabled = false; };
  $('pushbtn').onclick = async e => { const b = e.target; b.disabled = true; try { if (push === 'on') await ctx.api.pushUnsubscribe(); else await ctx.api.pushSubscribe(); toast(push === 'on' ? 'Push turned off.' : 'Push turned on.'); settings(p); } catch (err) { toast(err.message, 6000); b.disabled = false; } };
  $('delacct').onclick = () => {
    const d = $('dlg'); d.innerHTML = `<form method="dialog"><h2 style="color:var(--danger)">Delete your account?</h2><p><b>This is permanent.</b> Your profile, notifications and submissions will be erased and cannot be recovered.</p><div class="fld"><label for="cf">Type <b>DELETE</b> to confirm</label><input id="cf" type="text" autocomplete="off"></div><div class="bar"><button class="btn btn-danger" id="cfgo" value="go" disabled>Delete permanently</button><button class="btn btn-ghost" value="cancel" formnovalidate>Cancel</button></div></form>`;
    d.showModal(); $('cf').oninput = () => { $('cfgo').disabled = $('cf').value !== 'DELETE'; };
    d.querySelector('form').onsubmit = async e => { if (e.submitter?.value !== 'go') return; e.preventDefault(); try { await ctx.api.deleteAccount(); setDemoRole(null); location.href = '/'; } catch (err) { toast(err.message, 7000); } };
  };
}

async function admin(p) { const { mountAdmin } = await import('../admin/admin.js'); await mountAdmin(p, ctx); }

(async () => {
  try { ctx = await getContext(); } catch (e) { ctx = { mode: 'none' }; }
  labelAccountLink(Boolean(ctx.user));
  if (ctx.mode === 'live' && ctx.user) getClient().then(c => c.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') location.reload(); })).catch(() => {});
  if (ctx.mode === 'none' || !ctx.user) return authView(ctx);
  if (ctx.banned) toast('Your account is restricted. You can still read the site.', 6000);
  if (next) return location.replace(next);
  dashboard();
})();
