/* Account sign-in for Oneness Journey.
   enabled stays false on the public site. The page does not call Supabase
   until a later change sets enabled to true AND replaces the placeholder key.
   supabaseAnonKey is the public publishable key only.
   Never put a secret API key or the database password in this file. */
window.ONENESS_JOURNEY_AUTH = {
  enabled: false,
  supabaseUrl: "https://hwytpirbouqdssfncnrl.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY"
};
