# Afterhours shared service

Build from the repository root with `npm run build:service`.
The builder bundles the shared game model, furniture definitions, session rules
and Worker adapter into `dist/server/index.js`.

Apply `drizzle/0000_world.sql` and bind D1 as `DB`. Configure `FRONTEND_ORIGIN`
with the verified HTTPS origin of the public Uno client. The client runtime
configuration must point to this service's verified HTTPS origin.

This bounded playtest backend stores one world snapshot with optimistic
revision checks. Trades and purchases commit atomically; failed writes leave
all ownership unchanged. It caps guest accounts at 100 and world storage at
1.7 MB. Room-level persistence, moderation operations and recoverable accounts
are required before an unrestricted launch.

No production deployment has been completed. The Sites publishing helper was
blocked by the current session's approval configuration.
