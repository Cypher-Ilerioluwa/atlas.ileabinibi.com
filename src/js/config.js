// PUBLIC configuration only. The Supabase anon key is designed to be public and is protected by
// Row Level Security. NEVER put a service-role key or a VAPID private key in this repository.
export const config = {
  siteUrl: 'https://atlas.ileabinibi.com',
  // Every item in the Atlas is credited to this author, linking to the main website.
  authorName: 'Ilẹ̀ Abínibí',
  authorUrl: 'https://ileabinibi.com/',
  supabaseUrl: 'https://plmzclmsngwxyamsvxla.supabase.co',      // e.g. https://xxxx.supabase.co  (set when the project exists)
  supabaseAnonKey: 'sb_publishable_I6QUUnUU6iC9ghW49Y_QIA_71P0b6wd',  // public anon key
  vapidPublicKey: 'BPEWFyJIpQdYZzJn7dSu1KMTuloWeRYhYoEqz6XqZKTfI81n1k_dWaJjnhLi-nHNy9VzLvp5DhkaoIPZV0YqQpA'    // public Web Push key
};
