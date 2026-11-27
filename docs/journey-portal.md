# Sanctuary client portal

Private editions live at `/journey-portal/` on `https://app.onenesswellnesslifestyles.com`. This folder is not published until the pull request is merged. Do not put a service role key or a database password in the site, in chat, or in n8n until you choose a secret store.

The same Supabase project as Oneness Journey is used: `hwytpirbouqdssfncnrl` (`https://hwytpirbouqdssfncnrl.supabase.co`). Journey enrollments are separate tables. This portal does not change them.

## 1. Run the migration

In the Supabase dashboard, open **SQL Editor**, paste `supabase/migrations/20261127010000_journey_portal.sql`, and run it.

That creates editions, scans, readings, call summaries, letters, sleep logs, reminder preferences, and an intake log. Row security is on for every table. The publishable anon key cannot read another client's rows. Draft call summaries stay hidden from the client until they are approved.

`portal_record_intake` is not granted to the browser. Leave it that way.

## 2. Publishable anon key

Open `journey-portal/auth-config.js`.

- Set `enabled` to `true` only after the SQL has been run.
- Paste the publishable anon key into `supabaseAnonKey`. The same public key already used by Oneness Journey is acceptable. Do not paste the service role key.

## 3. First admin

1. **Authentication → Users → Add user** for `shifa@shifaali-scott.com`. Confirm the email.
2. Copy her user UUID.
3. Insert one row in `portal_profiles`:
   - `user_id`: that UUID
   - `email`: `shifa@shifaali-scott.com`
   - `role`: `admin`
4. Her sign-in is also treated as admin when the JWT email is `shifa@shifaali-scott.com`.

## 4. Turn off open sign-up

**Authentication → Sign In / Up**: turn off “Allow new users to sign up”.

The portal calls `signInWithOtp` with `shouldCreateUser: false`, and password sign-in never calls sign-up. A new email cannot create an account from the page.

Add this redirect URL:

`https://app.onenesswellnesslifestyles.com/journey-portal/**`

## 5. Invite a client

On the Review screen, enter the client's email and name, then choose **Create edition**. That writes an edition row only.

Then, in **Authentication → Users → Invite**, invite that same email. When they open the sign-in link, `portal_claim_edition` attaches their user id to the edition. Until that user exists, they cannot sign in.

## 6. Intake contract for a future workflow

Do not run an n8n workflow for this until the date Clan Mother set. The health story form at `onenesswellnesslifestyles.com/health-history` already posts to a GoHighLevel inbound webhook. A later workflow may call the database function below. It must not call it with the service role key from a browser, and that key must not be written into the repo.

Function: `public.portal_record_intake(p_kind text, p_payload jsonb) returns uuid`

`p_kind` is `health_story` or `call_summary`.

Health story payload:

```json
{ "email": "client@example.com", "display_name": "Client Name" }
```

This creates a draft edition for that lower-case email if one does not exist yet.

Call summary payload:

```json
{
  "email": "client@example.com",
  "title": "Call notes",
  "body": "Plain language notes."
}
```

This creates a summary with status `draft`. The client cannot read it. Clan Mother approves, edits, or rejects it on the Review screen. Only `approved` summaries appear in What's new.

How to call it later, without putting a secret in git:

1. In the SQL editor, create a login role that is not the service role. Example name: `portal_intake_login`.
2. `grant execute on function public.portal_record_intake(text, jsonb) to portal_intake_login;`
3. Store that role's database password in the n8n credential, not in this repository.
4. The workflow uses the Supabase connection string for that role and calls `select public.portal_record_intake('health_story', '{"email":"..."}'::jsonb);`

Every call is also stored in `portal_intake_events`, which only an admin can read.

## 7. Email reminders

Reminders are email only. There is no text-message path.

`portal_reminder_prefs` stores `email_opt_in` and `cadence` (`off` or `weekly`) for the signed-in user. Nothing sends mail from that table yet.

Sign-in mail uses Supabase Auth. The built-in sender is only for team addresses and is limited to about 2 messages an hour. Before inviting clients, set **Authentication → Emails → SMTP** to a mail host you already have. Do not turn on a paid texting product.

A later scheduled job can read `portal_reminder_prefs` where `email_opt_in` is true and `cadence` is `weekly`, then send through that same SMTP host. Do not add that job until Clan Mother asks.

## Rollback

Set `enabled` to `false` in `journey-portal/auth-config.js`. The page stays on the sign-in explanation and does not read editions. The tables can remain.
