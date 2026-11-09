# Supabase setup for Oneness Journey

The public page stays device-only until `journey/auth-config.js` has `enabled: true` and a real publishable key. This test project is `hwytpirbouqdssfncnrl` (`https://hwytpirbouqdssfncnrl.supabase.co`). Do not put the service-role key or the database password in the repo or in that file.

VIP Membership links are not part of this setup.

## 1. Run the SQL

In the Supabase dashboard, open **SQL Editor**, paste the file `supabase/migrations/20261109032500_journey_member_progress.sql`, and run it.

That creates:

- `enrollments` — one lower-case email, optional `user_id`, `program`, `active`, `created_at`. The browser can read only its own row. It cannot insert, update, or delete enrollments.
- `journey_progress` — one row per member and step key (`user_id`, `key`, `completed`, `notes`, `updated_at`). A member can read and write only their own rows, and only while `is_enrolled()` is true.
- `is_enrolled()` — security definer, fixed `search_path`, true only when `auth.uid()` has an active enrollment.

The Journey page stores each mark under a key like `2026-11-09/buyer/day/1/reflection`. Buyer and advocate, and each cohort date, use different keys. The owner column is forced to `auth.uid()` on write.

## 2. Turn off open sign-up

**Authentication → Sign In / Up** (the providers / email settings): turn **off** “Allow new users to sign up”.

The page calls `signInWithOtp` with `shouldCreateUser: false`. A person who is not already a user does not get an account from the email form.

Leave email confirmation on.

## 3. Site URL and redirects

**Authentication → URL configuration**

- Site URL: `https://app.onenesswellnesslifestyles.com`
- Redirect URLs, add both:
  - `https://app.onenesswellnesslifestyles.com/journey/`
  - `https://app.onenesswellnesslifestyles.com/journey/**`

The magic link sends the member back to the Journey page. For a local test only, you may also allow `http://127.0.0.1:8765/journey/**` on this test project. Do not use a production member list there.

## 4. Add a member

Signing up is not enrollment. Both rows have to exist, and they have to share the same user id.

1. **Authentication → Users → Add user.** Enter the member’s email. Confirm the email (or invite them) so they can sign in. Copy the user UUID.
2. **Table Editor → enrollments → Insert row.**
   - `email`: the same address in lower case
   - `user_id`: the UUID from step 1
   - `program`: `oneness-journey`
   - `active`: true

If `user_id` is empty, `is_enrolled()` stays false and progress saves are rejected. Do not insert enrollments from the browser.

There is no separate Node server to start.

## 5. Publishable key

**Project Settings → API.** Copy the anon / publishable key (it is public). Put it in `journey/auth-config.js` as `supabaseAnonKey`, replacing `YOUR_SUPABASE_ANON_KEY`.

Leave `enabled` false until you have added yourself as a user and an enrollment and signed in on a test copy of the page. The shipped default is `enabled: false`, so the live site does not call Supabase and does not load the library.

Do not copy the service-role key. It bypasses row security.

## 6. Before a real cohort

- This free project pauses after a week without activity. Open the dashboard before the cohort if it has been quiet.
- The built-in email sender is only for team addresses and is limited to about 2 messages an hour. Set **Authentication → Emails → SMTP** to your own mail host before you invite the cohort. Until then, use the dashboard “Add user” path and the test inbox, not a member mailing.

## Rollback

Set `enabled` back to `false` and publish the site. The journey page returns to device progress. VIP links stay as they are. The Supabase tables can stay; the page will not read them while sign-in is off. To retire the test data, delete the rows in the dashboard. Nothing in n8n, GoHighLevel, or the VIP course is part of this setup.
