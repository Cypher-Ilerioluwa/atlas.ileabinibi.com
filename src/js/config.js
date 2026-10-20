// PUBLIC configuration only. The Supabase anon key is designed to be public and is protected by
// Row Level Security. NEVER put a service-role key or a VAPID private key in this repository.
export const config = {
  siteUrl: 'https://atlas.ileabinibi.com',
  supabaseUrl: '',      // e.g. https://xxxx.supabase.co  (set when the project exists)
  supabaseAnonKey: '',  // public anon key
  vapidPublicKey: ''    // public Web Push key
};
