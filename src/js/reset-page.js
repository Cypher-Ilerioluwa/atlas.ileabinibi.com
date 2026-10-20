import { isConfigured, getClient } from './supabase.js';
const $ = id => document.getElementById(id);
(async () => {
  if (!isConfigured()) return $('state').textContent = 'Accounts are not connected yet.';
  const c = await getClient();
  let ready = false;
  const show = () => { ready = true; $('state').hidden = true; $('form').hidden = false; };
  c.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') show(); });
  setTimeout(() => { if (!ready) $('state').textContent = 'This reset link is missing or has expired. Request a new one from the sign-in page.'; }, 2500);
  $('form').addEventListener('submit', async e => {
    e.preventDefault(); const msg = $('msg'); msg.style.color = '';
    if ($('pw').value.length < 10) return msg.textContent = 'Use at least 10 characters.';
    if ($('pw').value !== $('pw2').value) return msg.textContent = 'The two passwords do not match.';
    const { error } = await c.auth.updateUser({ password: $('pw').value });
    if (error) { msg.style.color = 'var(--danger)'; return msg.textContent = error.message; }
    msg.textContent = 'Password changed. Redirecting to sign in…'; await c.auth.signOut(); setTimeout(() => location.href = '/login/', 1500);
  });
})();
