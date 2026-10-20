# Free, limited Afterhours playtest

Status (20 October 2026): the compiled Uno app and shared service are deployed at
https://afterhours-playtest.matthewtmattei.workers.dev/ on the Free plans.
Guest entry and persistent saves are verified. Google recovery is not enabled
yet: its consent configuration is created, and its web client is prepared;
creating the client and connecting its secret to Supabase await owner approval.
The downloadable v0.5.0 preview is separate from this newer playtest work.

Verified on the live HTTPS app: real Turnstile-protected guest signup, a daily
reward, furniture purchase and placement, and returning to the same character
after reload via **Join shared world > Continue my character**. The name,
245-credit balance, reward claim and room layout remained intact. A named music
track saved to the server. Invalid identity tokens return 401; invalid CAPTCHA
tokens are rejected by Supabase with `captcha_failed`.

A private D1 export was restored into an isolated **local D1** instance. The
entire restored world matched the export exactly, including one identity and
character, one room, nine furniture items and one song. The live database was
not overwritten. This verifies the export format and local restoration, not a
remote disaster-recovery exercise or recovery of Supabase identities.

Still unverified live: Google linking and recovery from a fresh browser,
two-player trades, full-capacity and daily-limit behavior, and provider CPU/usage
under load. Keep this an operator test until those checks pass; the five-player
cap does not make it ready for broad social promotion.

The first test uses Cloudflare Workers static assets for the compiled Uno app,
D1 for authoritative game saves, Supabase Auth for guest identities and Google
linking, and Cloudflare Turnstile for guest signup protection. Use the Free plans.
No custom domain, paid plan, email service, or purchase is needed for this test.

## Scope and limits

- Five connected players, 100 total characters, and a 1.7 MB world snapshot.
- At most 12,000 API requests per UTC day. One active player uses roughly
  1–5 requests/second, so this is a short supervised test, not all-day hosting.
- Exhaustion pauses play; it does not erase characters. Static solo play remains
  available while the shared service is paused.
- Guest progress belongs to a stable, signed account ID. Linking Google retains
  that ID. Returning from another device loads its existing saved character.
- Unlinked guests cannot recover after their browser credentials are lost.
  Local/legacy guest characters and managed playtest characters are separate.
  Existing Google characters are not merged with another guest.
- The single world document deliberately keeps purchases and trades atomic.
  It needs room-level storage and load testing before a broad social launch.
- Free platform quotas, CPU limits, outages, and abuse can stop service before
  the application cap does. These limits are not a capacity guarantee.

## Accounts the owner needs to create

1. Create a **Cloudflare Free** account. Enable Workers, choose a workers.dev
   subdomain, and create a D1 database named `afterhours-playtest`.
   The app address will be `https://afterhours-playtest.YOUR-SUBDOMAIN.workers.dev`.
2. Create a **Supabase Free** project. Enable anonymous sign-ins and manual
   identity linking. Use an asymmetric JWT signing key (ES256 or RS256).
   Copy the project URL and its **publishable** key.
3. In Google Cloud, configure an OAuth web client for this playtest. Set its
   redirect URI to the callback shown in Supabase's Google-provider settings.
   Enable that provider in Supabase using the client ID and secret. Keep
   Google's consent screen in Testing and explicitly add the test players.
4. In Supabase URL Configuration, set the site URL to the app's HTTPS origin.
   Add the exact redirect URL
   `https://afterhours-playtest.YOUR-SUBDOMAIN.workers.dev/game/account-callback.html`.
   Do not add a wildcard. The sign-in leaves the Uno iframe, completes in the
   main browser page, then returns to the Uno app.
5. Create a Turnstile widget for that exact hostname. Enable CAPTCHA protection
   in Supabase Auth and put the Turnstile **secret** there. Use only its public
   site key in the app configuration.

Do not paste Google secrets, Supabase secret/service-role keys, or Turnstile
secrets into this repository or chat. They belong in the providers' dashboards.
The Worker only needs the public Supabase URL to verify signatures.

## Build and prepare

From the repository root, with Node 22+, Python 3, .NET 10 and wasm-tools:

```sh
npm ci
npm test
npm run build:service
npm run build:uno
node scripts/prepare-playtest.mjs --origin=https://afterhours-playtest.YOUR-SUBDOMAIN.workers.dev --supabase-url=https://YOUR-PROJECT.supabase.co --publishable-key=sb_publishable_YOUR-KEY --turnstile-site-key=YOUR-PUBLIC-SITE-KEY --database-id=YOUR-D1-UUID
```

The preparation script verifies the compiled Uno bundle, copies it into a fresh
`release/playtest-*` folder, checks Cloudflare's asset size limit, and writes
ignored `service/wrangler.json`. It performs no deployment or purchase.
Public configuration is injected into that copy; local solo defaults stay usable.

Authenticate and deploy with the Cloudflare CLI (version checked for this setup):

```sh
npx wrangler@4.151.3 login
npx wrangler@4.151.3 d1 migrations apply afterhours-playtest --remote --config service/wrangler.json
npx wrangler@4.151.3 deploy --config service/wrangler.json
```

The API and compiled Uno client share one origin. Keep Workers and Supabase on
their Free plans. Do not enable paid upgrades as part of these steps.

## Required checks before inviting test players

1. Open the actual HTTPS app in two browsers. Join as guests, buy furniture,
   edit a room, save a song, and trade a piece. Refresh both browsers.
2. Link one guest to Google. Verify its name, wallet, furniture IDs, room layout,
   songs and friend list remain intact. Sign in on a fresh browser and compare.
3. Cancel Google sign-in, try an already-linked Google account, and test a
   temporary network outage. No path should silently create a replacement guest.
4. Verify real CAPTCHA rejection and expired-token rejection. Local tests use
   signed test keys and a mocked OAuth provider; they cannot certify the
   production provider configuration.
5. Exercise the five-player/full-world/daily-limit messages. Measure actual
   Worker CPU and D1 reads/writes during a supervised session.
6. Export D1 and restore the export into a **separate test database**. Verify the
   same account ID still owns its room, song and furniture. Never use a restore
   rehearsal to overwrite the live database.

## Saves, moderation and operating the test

Keep regular private exports outside this repository:

```sh
npx wrangler@4.151.3 d1 export afterhours-playtest --remote --output=PRIVATE-BACKUP-PATH.sql --config service/wrangler.json
```

The database contains private player progress, chats, whispers and reports.
Restrict access to the operator. D1 backups do not back up Supabase identities;
preserve the Supabase project and use its supported export/recovery procedures.
Changing or deleting the auth project breaks the link to saved characters.

Host a supervised, invited test. Reports are recorded, but a full moderation
console and escalation process are still open work. Before public promotion,
add those operations, a privacy/retention policy, room-level storage, reliable
backup/restore drills, abuse controls, and measured load capacity.

## Provider references

- [Supabase guest accounts and linking](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Google OAuth setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase CAPTCHA configuration](https://supabase.com/docs/guides/auth/auth-captcha)
- [Cloudflare Workers free limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Supabase free-project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
