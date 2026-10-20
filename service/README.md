# Afterhours shared service

Build from the repository root with `npm run build:service`.
The builder bundles the shared game model, furniture definitions, session rules
and Worker adapter into `dist/server/index.js`.

Apply `drizzle/0000_world.sql` and bind D1 as `DB`. Configure `FRONTEND_ORIGIN`
with the verified HTTPS origin of the public Uno client. The client runtime
configuration must point to this service's verified HTTPS origin.

The Cloudflare deployment uses `worker/cloudflare.mjs` and a SQLite-backed
`SharedWorld` Durable Object to serialize API requests. The coordinator keeps
no player data; D1 remains the authoritative save store. The portable adapter
stores one world snapshot with optimistic
revision checks. Trades and purchases commit atomically; failed writes leave
all ownership unchanged. It caps guest accounts at 100, connected players at five, daily API
requests at 12,000, and world storage at 1.7 MB. Room-level persistence, moderation operations and live account-recovery
acceptance tests are required before an unrestricted launch.

Supabase identities are verified with their project's public signing keys.
Google linking retains the same identity-to-character mapping; no client ID
or wallet is trusted. See ../PLAYTEST-SETUP.md for the free managed setup.
The limited public playtest is deployed. See ../PLAYTEST-SETUP.md for measured
limits, recovery results and the remaining broad-launch work.
