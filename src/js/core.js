// Lightweight shared helpers loaded on every page (no Supabase library here).
import { config } from './config.js';
export const isConfigured = () => Boolean(config.supabaseUrl && config.supabaseAnonKey);

// Demo mode exists only while Supabase is unconfigured. It never touches real accounts.
export const demoRole = () => { if (isConfigured()) return null; try { return sessionStorage.getItem('atlas-demo-role'); } catch { return null; } };
export const setDemoRole = r => { try { r ? sessionStorage.setItem('atlas-demo-role', r) : (sessionStorage.removeItem('atlas-demo-role'), sessionStorage.removeItem('atlas-demo-db')); } catch {} };

// Synchronous "probably signed in" hint so the header can label itself without loading the auth library.
export function signedInHint() {
  if (demoRole()) return true;
  try { return Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k) && localStorage.getItem(k)); } catch { return false; }
}
export function labelAccountLink(signedIn = signedInHint()) {
  const a = document.getElementById('acct-link'); if (a) a.textContent = signedIn ? 'Dashboard' : 'Sign in / Sign up';
  document.querySelectorAll('[data-acct-label] b').forEach(b => { b.textContent = signedIn ? 'Dashboard' : 'Sign in / Sign up'; });
  document.querySelectorAll('[data-acct-icon]').forEach(x => x.classList.toggle('on', signedIn));
}

// Theme: 'light' (default) | 'dark' | 'system'
export const getTheme = () => { try { return localStorage.getItem('atlas-theme') || 'light'; } catch { return 'light'; } };
export function setTheme(t) {
  try { t === 'light' ? localStorage.removeItem('atlas-theme') : localStorage.setItem('atlas-theme', t); } catch {}
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
}
export const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
export const fmtDateTime = d => d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
export const label = s => String(s ?? '').replace(/_/g, ' ');
export const slugify = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Breadcrumb bar. items = [[label, href?], ...]; the last item is the current page. */
export function crumbsHtml(items) {
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const home = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>';
  return `<nav class="crumbs" aria-label="Breadcrumb"><div class="wrap"><ol>${items.map(([l, h], i) => `<li${i === items.length - 1 ? ' aria-current="page"' : ''}>${h && i < items.length - 1 ? `<a href="${h}">${i === 0 ? home : ''}<span>${esc(l)}</span></a>` : `<span>${esc(l)}</span>`}</li>`).join('')}</ol></div></nav>`;
}
export function setCrumbs(items) {
  document.querySelector('.crumbs')?.remove();
  document.querySelector('.site-header').insertAdjacentHTML('afterend', crumbsHtml(items));
}
