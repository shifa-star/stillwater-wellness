# Journey member accounts

Sign-in is off on the public site. `journey/auth-config.js` keeps `enabled: false` and a placeholder publishable key. Marks and reflections stay in this browser under `onenessJourney.progress.<buyer|advocate>.<cohort start>`. That key has no member id. VIP Membership links are unchanged.

When sign-in is later turned on, the page uses Supabase Auth and the `journey_progress` table. There is no separate Node server. A member can read and write only their own rows, and only with an active enrollment. Device reflections are not copied into the account. Sign-out drops that sign-in's unsaved typing and shows the device record again.

Dashboard steps, the test project, and rollback are in `docs/supabase-setup.md`. The SQL is `supabase/migrations/20261109032500_journey_member_progress.sql`.

Do not put the service-role key or the database password in this repo.
