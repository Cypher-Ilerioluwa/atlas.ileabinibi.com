import { config } from './config.js';
let client;
export const isConfigured = () => Boolean(config.supabaseUrl && config.supabaseAnonKey);
export async function getClient() {
  if (!isConfigured()) throw new Error('Supabase is not configured yet. Fill in src/js/config.js.');
  if (!client) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }
  return client;
}
