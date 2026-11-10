# Journey member accounts

Member sign-in is enabled. `journey/auth-config.js` uses the Supabase publishable anon key. Marks made before sign-in stay in this browser under `onenessJourney.progress.<buyer|advocate>.<cohort start>` and are not copied into an account. VIP Membership links are unchanged.

The page uses Supabase Auth and the `journey_progress` table. There is no separate Node server. A member can read and write only their own rows, and only with an active enrollment. Sign-out drops that sign-in's unsaved typing and shows the device record again.

Dashboard steps, the test project, and rollback are in `docs/supabase-setup.md`. The SQL is `supabase/migrations/20261109032500_journey_member_progress.sql`.

Do not put the service-role key or the database password in this repo.
