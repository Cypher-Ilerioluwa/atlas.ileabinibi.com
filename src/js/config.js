// PUBLIC configuration only. The Supabase anon key is designed to be public and is protected by
// Row Level Security. NEVER put a service-role key or a VAPID private key in this repository.
export const config = {
  siteUrl: 'https://atlas.ileabinibi.com',
  // Every item in the Atlas is credited to this author, linking to the main website.
  authorName: 'Ilẹ̀ Abínibí',
  authorUrl: 'https://ileabinibi.com/',
  supabaseUrl: 'https://hfzgraxolvkfkhilvszt.supabase.co',      // e.g. https://xxxx.supabase.co  (set when the project exists)
  supabaseAnonKey: 'sb_publishable_86zyF9GB-eIi3mKbO1GeAw_NTi691Hr',  // public anon key
  vapidPublicKey: 'BGSdKUcnqTqKCKF-ywTTYf964BmU12D4XOQlHhwGxv05qcxqF1kboL4Bzzl5VhaKIYlj_iXbkYRUy7SGjid5imI'    // public Web Push key
};
