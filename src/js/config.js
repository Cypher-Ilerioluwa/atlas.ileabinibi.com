// PUBLIC configuration only. The Supabase anon key is designed to be public and is protected by
// Row Level Security. NEVER put a service-role key or a VAPID private key in this repository.
export const config = {
  siteUrl: 'https://atlas.ileabinibi.com',
  supabaseUrl: 'https://plmzclmsngwxyamsvxla.supabase.co',      // e.g. https://xxxx.supabase.co  (set when the project exists)
  supabaseAnonKey: 'sb_publishable_I6QUUnUU6iC9ghW49Y_QIA_71P0b6wd',  // public anon key
  vapidPublicKey: 'BFao0-lELRzhy4BVASKkd2ETuqoywKwDNeWgQXQTIWXx-vVgtcjfRKLzRSiHxp4rU_q6Npt-V5DzrHZLWl2c5pY'    // public Web Push key
};
