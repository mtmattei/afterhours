# Build log — Afterhours XAML migration

Append only. Milestones, not edits. Decisions live in `docs/specs/xaml-outer-ui-SPEC.md`.

| Stat | Value |
|---|---|
| Sessions | 1 (single coordinator, no fleet threads) |
| Milestones logged | 3 |
| Brief → first recognizable XAML chrome | 2 h 35 min (14:35 first spec → 17:10 wave 1 runnable) |
| Runtime checks | wave 0: 13/13 · wave 1: 30/30 · wave 2: 40/40 |
| WASM framework download (brotli) | 5.53 MB baseline → 6.49 MB wave 0 → 6.63 MB wave 1 → 6.41 MB wave 2 (sum of `_framework/*.br`) |

## 2026-10-23 15:35 — Wave 0: same-page hosting proven (go)

Brief (verbatim):
> "start wave 0"

Came back: 1 session, 8 publish/verify iterations, 44 min from first spike commit to verdict.
Numbers: 13/13 Chromium checks · max save 212 KB parses in 20–42 ms in C# (too slow to push whole) ·
+0.96 MB brotli for Hosting/Toolkit/MVUX/Navigation · cold Release build 159 s
Shots: docs/spikes/wave0/
Surprises: `BrowserHtmlElement` inherits `pointer-events: none` on the native renderer (CSS workaround);
Toolkit `ExtendedSplashScreen` requests a lowercase `appmanifest.js` that 404s on case-sensitive hosts;
publishing over an old `release/uno` silently served the previous assembly (fixed in `eafc1f9`).
Threads: 0 (single session)

## 2026-10-23 17:10 — Wave 1: XAML chrome around the JavaScript room (first runnable)

Brief (verbatim):
> "approve all four, start wave 1"

Came back: 1 session, 7 publish iterations, 1 h 35 min from approval to 30/30.
Numbers: 30/30 checks at 1440/1000/800/390 px, solo and two-player shared · 72 Node + 9 xUnit tests ·
1,216 lines across host.mjs, MainPage, ChatPanel, MainModel, services and themes ·
52 IL2026 + 3 IL2104 allowed trim warnings (all MVUX-generated or Uno.Extensions), 0 others
Shots: docs/screenshots/xaml/wave1/
Surprises: MVUX commands ignore Enter from `utu:CommandExtensions` unless the method takes the
TextBox text as its parameter; Playwright `fill()` does not update an Uno TextBox (real keystrokes do);
Uno keeps collapsed elements' boxes, so visibility checks need `checkVisibility()`;
`AutomationProperties.Name` emits no `aria-label` on the native WASM Release build (open, R11).
Threads: 0 (single session)

## 2026-10-23 18:13 — Wave 2: shop, inventory, blueprints and gift wrap in XAML

Brief (verbatim):
> "start wave 2'"

Came back: 1 session, about 1 h from the wave 1 push (17:12) to 40/40.
Numbers: 40/40 checks at 1440/1000/800/390 px, solo and two-player shared · 73 Node + 16 xUnit tests ·
683 new lines across the three panel models, shop records, views and converters · first shop open: title 0.9 s,
cards 2.4 s (`GridView` took 4.8 s, so the grid is an `ItemsRepeater`) · reopen instant ·
framework download 6.41 MB brotli (sum of `_framework/*.br`; earlier entries may have been measured differently)
Shots: docs/screenshots/xaml/wave2/
Surprises: MVUX hands a record read through a state to converters as a generated `Bindable…ViewModel` proxy,
so the detail art lost its clip until it bound a value-type `ClipRect`; `ItemsUpdatingScrollMode` (Uno0001)
slipped past the warning regex; the game's `<dialog>` top layer covered the XAML drawer until `openPanel`
closed it first; R11 confirmed: no aria output on the native WASM renderer, screen readers need Skia.
Threads: 0 (single session)
