# Journey member accounts

This change adds a member API and a browser account policy for Oneness Journey. It does **not** turn sign-in on for the public site, and it does not migrate anyone.

The public page at `/journey/` still keeps marks and reflections in this browser, under the existing device key `onenessJourney.progress.<buyer|advocate>.<cohort start>`. That key has no member id. VIP Membership links are unchanged. Nothing in this change calls n8n, GoHighLevel, OneSASSY, or Rhea, and it sends no email.

## What is implemented

- A Node member API (`journey/member-api.js`) that stores progress only after a server session. The browser cannot choose the member. Reads and writes are partitioned by member, cohort start date, and lane (`buyer` or `advocate`).
- Session cookies are random, HttpOnly, and stored only as a hash. A client-supplied `memberId`, `owner`, `sub`, or `email` is rejected.
- Production sign-in, when later configured, is OpenID Connect authorization code with PKCE. The API checks the identity token (RS256, issuer, audience, expiry, nonce, `email_verified: true`). The one-time login state is bound to an HttpOnly cookie so a link alone cannot sign someone in.
- The API refuses to start in test mode unless it is bound to loopback and has a test secret of at least 16 characters. Test sign-in accepts only `member-a` and `member-b`. There is no mailer and no homegrown magic link.
- Until `JOURNEY_AUTH_MODE=oidc` and the variables below are set, the API accepts no real members. `GET /health` reports `acceptsMembers: false`.
- The shipped browser config (`journey/auth-config.js`) is `enabled: false` and has an empty `apiBase`. The page does not call the API. The account panel says progress is not saved to an account and is not synced.
- Signed-in saves, once the flag is turned on, go to the API and are not written into the device key. Device reflections are not copied into an account. If the API cannot be reached at sign-in, device notes stay hidden so they are not shown as account progress. A failed save is labeled "Not saved to your account." Sign-out drops the account view, including unsaved typing from that sign-in, and returns to the device record. Switching accounts discards the previous view before loading the next one.

## What was tested here

Node 22, with mock members only:

- Unauthenticated progress reads and writes are rejected. A missing or forged session gets `{ "signedIn": false }` from `/me` and no progress.
- A forged session cookie is rejected.
- Member B cannot read or overwrite member A's cohort row, including when B sends A's id.
- Buyer and advocate lanes are separate. Cohort `2026-11-09` and `2027-01-04` are separate.
- A stale `ifRevision` does not overwrite the saved row.
- A cross-site `Origin`, a missing `X-Journey-Request` header, and a non-JSON body are rejected.
- Logout removes the server session.
- The progress file is mode `0600`. A corrupt file refuses to start instead of wiping rows.
- Test sign-in is not available in disabled mode, OIDC mode, from a non-loopback address, or with `X-Forwarded-For` pretending to be loopback.
- OIDC login against a local stand-in issuer: PKCE, nonce, state cookie, replay, missing cookie, bad signature, `alg: none`, wrong audience, expired token, and `email_verified: false`.
- The client secret does not appear in API responses.
- Device reflections are not imported. A failed save is not described as saved. Sign-out and account switch do not reveal the other person's text.
- Existing day-engine tests in `journey/progress.test.js` still pass.

Not tested against a live identity provider, a public hostname, or real members. Those are not configured.

## What is not live

- `journey/auth-config.js` keeps `enabled: false`. The public page will not offer sign-in until a later change sets `enabled: true` and `apiBase` to the API's https origin.
- No identity provider, API host, DNS record, or TLS certificate was created.
- No production session secret, client secret, or member list is in this repo.
- GitHub Pages only serves files. Publishing this repo does not run `journey/member-api.js`.
- n8n tables (Bot Contacts, 5DC Early Buyers, and the others) remain enrollment records. They are not website login.

## Why this shape

The site is static. A member id in the browser, a shared localStorage key, or a public webhook cannot keep one person's reflections away from another. The smallest design that can be tested in this repo is a small Node API with server sessions, plus a real OIDC provider later. GoHighLevel and a new CRM are not required.

## Try it on this machine

```bash
node journey/progress.test.js
node journey/account.test.js
node journey/member-api.test.js
node journey/local-member-demo.js
```

The demo listens on `127.0.0.1` only, turns the account panel on for that local page, and offers Local test member A and B. No email is sent. Stop it with Ctrl-C. The committed `auth-config.js` stays off.

## Live prerequisites

Do all of this before changing `auth-config.js`. This pull request does not do it.

1. A Node.js 22 process you control, reached only through TLS. GitHub Pages cannot host it. Bind it to `127.0.0.1` and put a reverse proxy in front. Prefer a hostname on the same site as the page, for example `journey-api.onenesswellnesslifestyles.com`, so the session cookie is same-site. This repo does not buy a server. If you do not already have a machine to run Node, that host is a separate cost.
2. An OpenID Connect provider with a confidential client. A $0 option that fits a small cohort is [Supabase Auth on the Free plan](https://supabase.com/pricing): $0 per month, 50,000 monthly active users, two free projects, paused after a week of inactivity. This API does not use the Supabase database. Do not put the Supabase service-role key in this repo or in the browser.
3. The provider must sign ID tokens with RS256 and set `email_verified` to boolean `true` only after it has verified the email. Redirect URI, exactly:

   `https://journey-api.onenesswellnesslifestyles.com/auth/callback`

   Use the hostname you actually chose. Scopes: `openid email`.
4. Email delivery is the provider's job, not this repo. Supabase's built-in mailer sends only to addresses on the project team and is limited to 2 messages per hour, so it cannot mail the cohort. Custom SMTP is allowed on the Free plan; the default custom-SMTP cap starts at 30 messages per hour until you raise it. The mail host's own price is separate (many have a free tier). Social sign-in, if the provider offers it, does not need that mailer. This change did not configure either.
5. Environment on the API host only. Never commit these values.

   | Variable | Purpose |
   | --- | --- |
   | `JOURNEY_AUTH_MODE` | `oidc` |
   | `JOURNEY_HOST` | `127.0.0.1` |
   | `JOURNEY_PORT` | port the proxy targets, for example `8787` |
   | `JOURNEY_COOKIE_SECURE` | `1` |
   | `JOURNEY_COOKIE_SAMESITE` | `Lax` when the API is a subdomain of `onenesswellnesslifestyles.com`. Use `None` only if the API must live on another site, and only with `Secure`. |
   | `JOURNEY_ALLOWED_ORIGIN` | `https://app.onenesswellnesslifestyles.com` |
   | `JOURNEY_SUCCESS_URL` | `https://app.onenesswellnesslifestyles.com/journey/` |
   | `JOURNEY_OIDC_ISSUER` | issuer URL, no trailing slash |
   | `JOURNEY_OIDC_CLIENT_ID` | confidential client id |
   | `JOURNEY_OIDC_CLIENT_SECRET` | client secret |
   | `JOURNEY_OIDC_REDIRECT_URI` | the callback URL from step 3 |
   | `JOURNEY_DATA_FILE` | path outside the repo, for example `/var/lib/oneness-journey/progress.json` |
   | `JOURNEY_SESSION_TTL_SECONDS` | optional, default `43200` (12 hours) |

   Do not set `JOURNEY_AUTH_MODE=test` on that host. Do not set `JOURNEY_TEST_SECRET` there. Do not trust `X-Forwarded-For`.

   Start with `node journey/member-api.js`. `GET /health` should show `"auth":"oidc","acceptsMembers":true`.
6. Only after that health check passes, a **later** change may set `journey/auth-config.js` to `enabled: true` and `apiBase` to `https://journey-api.onenesswellnesslifestyles.com` (no secret in that file). Deploy the static site after that, not before. Until that file changes, the public page stays device-only even if the API is running.

## Rollback

1. Set `enabled` back to `false` and `apiBase` to `""` in `journey/auth-config.js`, then publish the static site. The journey page returns to device progress. VIP links stay as they are.
2. Stop the Node process and unset its environment. Existing device keys in browsers are left as they were. This change does not migrate them.
3. The progress file is not in git. To retire stored rows, delete `JOURNEY_DATA_FILE` on the server. Do not commit it.
4. Nothing in n8n, GoHighLevel, or the VIP course was changed, so there is nothing to undo there.

## Costs

No service was purchased for this work.

- The static site stays on GitHub Pages at no extra cost. Pages cannot run the API.
- Supabase Auth Free, if you choose it later, is $0 within the limits above. It is not connected now.
- A new virtual server, if you do not already have one, is a separate purchase. This work does not pick or buy one.
- Cohort email, if members sign in with email, needs the identity provider's mail path. Supabase's included mailer is not enough for real members (team addresses only, 2 per hour). Budget the SMTP host you choose; this repo does not send mail and did not open an account.
- Cloudflare Workers is not a substitute for this Node process. The Free plan allows 100,000 requests a day and 10 ms of CPU per request, which is the wrong runtime for this server.

Checked against Supabase pricing and Auth rate-limit docs, and Cloudflare Workers pricing, on 8 November 2026. Those limits can change.
