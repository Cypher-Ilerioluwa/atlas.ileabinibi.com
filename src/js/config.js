// PUBLIC configuration only. The Supabase anon key is designed to be public and is protected by
// Row Level Security. NEVER put a service-role key or a VAPID private key in this repository.
export const config = {
  siteUrl: 'https://atlas.ileabinibi.com',
  // Every item in the Atlas is credited to this author, linking to the main website.
  authorName: 'Ilẹ̀ Abínibí',
  authorUrl: 'https://ileabinibi.com/',
  supabaseUrl: '',      // e.g. https://xxxx.supabase.co  (set when the project exists)
  supabaseAnonKey: '',  // public anon key
  vapidPublicKey: ''    // public Web Push key
};
