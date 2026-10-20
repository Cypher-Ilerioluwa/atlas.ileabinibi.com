import { isConfigured, getClient } from './supabase.js';
const $ = id => document.getElementById(id);
let mode = 'signin';
const next = (() => { const n = new URLSearchParams(location.search).get('next') || '/'; return /^\/(?!\/)/.test(n) ? n : '/'; })();
const text = { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link' };
$('cfg').hidden = isConfigured();

function setMode(m) {
  mode = m;
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  $('go').textContent = text[m]; $('name-row').hidden = m !== 'signup'; $('pw-row').hidden = m === 'forgot';
  $('pw-hint').hidden = m !== 'signup'; $('pw').autocomplete = m === 'signup' ? 'new-password' : 'current-password'; $('msg').textContent = '';
}
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('showpw').addEventListener('click', e => { const s = $('pw').type === 'password'; $('pw').type = s ? 'text' : 'password'; e.target.textContent = s ? 'Hide' : 'Show'; e.target.setAttribute('aria-pressed', String(s)); });

$('form').addEventListener('submit', async e => {
  e.preventDefault(); const msg = $('msg'), btn = $('go'); msg.style.color = '';
  const email = $('em').value.trim(), pw = $('pw').value;
  if (!/^\S+@\S+\.\S+$/.test(email)) return msg.textContent = 'Enter a valid email address.';
  if (mode !== 'forgot' && pw.length < (mode === 'signup' ? 10 : 1)) return msg.textContent = mode === 'signup' ? 'Use a password of at least 10 characters.' : 'Enter your password.';
  if (!isConfigured()) return msg.textContent = 'Accounts are not connected yet, so this action cannot run.';
  btn.disabled = true; msg.textContent = 'Working…';
  try {
    const c = await getClient();
    if (mode === 'signin') {
      const { error } = await c.auth.signInWithPassword({ email, password: pw }); if (error) throw error; location.href = next;
    } else if (mode === 'signup') {
      const { error } = await c.auth.signUp({ email, password: pw, options: { data: { display_name: $('dn').value.trim() }, emailRedirectTo: location.origin + '/login/' } }); if (error) throw error;
      msg.textContent = 'Check your email and open the confirmation link, then sign in.';
    } else {
      const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/reset-password/' }); if (error) throw error;
      msg.textContent = 'If an account exists for that email, a reset link has been sent.';
    }
  } catch (err) { msg.style.color = 'var(--danger)'; msg.textContent = err.message || 'Something went wrong. Try again.'; }
  finally { btn.disabled = false; }
});
