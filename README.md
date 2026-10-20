# Afterhours

A social music world inspired by the rituals of Habbo Hotel and Coke Music:
walk in, take a seat, meet someone, make a track, perform it, collect furniture,
and make a room your own.

**Playable development build — not historical feature parity or a finished public service.**
Original generated artwork and synthesized music; no original game assets are included.

## Play locally

Install Node.js 22 or newer, then:

```sh
npm start
```

Open **http://127.0.0.1:4176**. Solo progress stays in the browser.
Choose **Join shared world** for a separate persistent online character.
Open **http://localhost:4176** in a second browser tab to test another character.
The local service binds only to this computer. Shared progress is stored in
`local-data/world.json`; protect that file and keep backups.

The standalone `Afterhours.html` download supports solo play without a server.

## What you can play

- Four public rooms, smooth tile walking, directional avatars, chairs and sofas.
- Up to twelve personal rooms, search, favorites, history, lighting and doors.
- Fifteen furniture types; purchase, move, rotate, pick up, undo and blueprints.
- Usable lights, vending machine, dice, message board, portals and jukebox.
- Four-lane 16/32-step sequencer, three synthesized sound packs, mute/solo,
  volume, tempo, undo, named library, collectible discs and WAV export.
- Stage queue, performances, daily reward caps, quests, XP, badges and wallet.
- Adoptable tabby with needs, feeding, play, training, tricks and following.
- Tile Rush, Snow Jam and Pop Quiz against resident opponents.
- Real shared presence, local speech, shouts, private whispers, friend requests,
  room doorbells, owner controls, seat reservations, shared listening and
  two-party furniture trades.

Resident characters are NPCs. Real connected players are identified separately.
Shared progress is owned by the service; the client cannot import a solo wallet.
Room scripts, minigames, companion presentation and most object interactions
remain client-side. See [the detailed roadmap](REMAKE-ROADMAP.txt) for limits.

## Uno Platform WebAssembly

`uno/` is a real Uno Platform / WinUI application targeting .NET 10 Browser
WebAssembly. Its XAML shell hosts the canvas game in Uno's WebView2.
The room renderer remains JavaScript; it has not been rewritten as native XAML.

Install .NET 10 and the Uno prerequisites, then run:

```sh
npm run build:uno
```

The build copies the game into Uno's web assets and publishes the application
to `release/uno`. Serve that directory over HTTP; WebAssembly does not run from
a `file:` URL. `npm run start:uno` serves it with the local shared-world API.

The build also verifies the compiled runtime, the WebView compatibility script,
and every bundled game file. To create a portable ZIP after publishing, run
`python scripts/package-wasm.py` (Python 3 required for packaging).
The ZIP includes `PLAY.txt` and a Node launcher; players do not need .NET.

On this Windows build host, MSBuild's separate task host cannot connect. The
build script offers `--in-process` to run the same packaged tasks inside
MSBuild. It preserves linking, trimming, resources and native compilation.
This compatibility option is pinned to the checked-in SDK/package versions.

## Shared service and deployment

`server.mjs` is the dependency-free local Node service. `session-core.mjs`
contains ownership, wallet, trade, seats, friendship and performance rules.
`service/` builds a portable Worker with a D1 migration and atomic revision
checks. This is a bounded playtest backend, capped at 100 guest characters
and a 1.7 MB world snapshot. It needs room-level storage and operational
moderation before a large public launch.

```sh
npm test
npm run build:service
```

The public Uno client and shared service are separate deployments. Apply the
service's migration, set its `FRONTEND_ORIGIN` to the verified deployed client
origin, and set `window.AFTERHOURS_API` in the client's `game/runtime-config.js`
to the verified service origin. Do not expose guest tokens or world data.

No public deployment is claimed by this repository. The prepared Sites
publication was blocked by this session's publishing approval configuration.
The user's requested public release remains pending completion of the roadmap
and release gates.

## Layout

| Folder/file | Purpose |
| --- | --- |
| `dist/` | Editable game client, original art and styles |
| `uno/` | Uno XAML/C# application and build configuration |
| `service/` | Worker adapter, schema and portable service build |
| `tests/` | Game, movement, seating, service and database checks |
| `scripts/` | Repeatable build and packaging tools |
| `ART-PROMPTS.txt` / `GAME-OBJECTS-PROMPT.txt` | Art provenance and prompts |

## Release gates still open

Full avatar customization, four-facing/stacked/wall furniture, beds and pools,
groups, direct messages, marketplace, collaborative building/music, complete
classic minigames, recoverable cross-device accounts, moderation operations,
accessibility audit, load testing, security review and historical parity audit.
