// Runs the ileabinibi.com import every hour (Netlify scheduled function; runs on the published production deploy).
import { runSync } from '../lib/wpSync.mjs';
export default async () => {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key) { console.log('wp-sync skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'); return; }
  try { console.log('wp-sync', JSON.stringify(await runSync({ url, key }))); } catch (e) { console.error('wp-sync failed:', e.message); }
};
export const config = { schedule: '@hourly' };
