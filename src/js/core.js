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
  const a = document.getElementById('acct-link'); if (!a) return;
  a.textContent = signedIn ? 'Dashboard' : 'Sign in / Sign up';
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
