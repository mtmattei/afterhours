# Spec: native XAML outer UI around the WebView room

Status: **draft, awaiting answers to Unresolved Questions.** Written 2026-10-23. No code changed yet.

Goal: the Uno app draws its own menus, wardrobe, room browser and beat studio in XAML.
The isometric canvas room keeps running in `WebView2` as JavaScript, along with everything
this spec does not name.

Scope:
- **Moves to XAML:** top bar, left rail (nav, room hopping list, resident card), the
  room-journey strip, the game dock and profile menu, plus three panels:
  wardrobe, room browser (solo and shared navigator) and beat studio (editor and song library).
- **Stays in the WebView:** canvas room, room heading, scene controls, action bar, chat
  sidebar, now-playing strip, and every other panel (profile, journal, arcade, stage,
  catalog, companion, room tools, help, friends, trade, chart, away card). XAML menus open them.
- **Unchanged:** `npm start`, the standalone HTML and the Worker. The JS chrome hides only
  when the page loads with `?host=uno`.

Evidence used: `dist/game.js` (`look`, `studio`, `directory`, `openNavigator`, `window.AfterhoursWorld`),
`dist/app.js`, `dist/online.js` (`roomDirectory`, `joinRoom`), `dist/style.css` tokens,
`uno/Afterhours.Uno` (Uno.Sdk 6.7.30, Uno 6.7.135, `net10.0-browserwasm` only, empty `UnoFeatures`),
the Uno WebView2 docs, and the WebView JS embedded in
`uno.winui/6.7.135/uno-runtime/net10.0/webassembly/Uno.UI.dll`.

---

## Architecture Brief

### Targets and SDK

- `net10.0-browserwasm` only, **native (DOM) renderer**: `SkiaRenderer` is absent from
  `UnoFeatures`. XAML elements and the WebView `<iframe>` share one DOM, so XAML flyouts
  stack above the iframe in normal z-order.
- Uno.Sdk **6.7.30** stays pinned in `uno/global.json`.
- `UnoFeatures`: `Hosting; MVUX; Navigation; Toolkit`. Four features, all new to this project (see Unresolved Questions).

### Decisions

**D1. The JavaScript game stays the single owner of game state.**
Reason: `game-core.js` is bundled unchanged into the Cloudflare Worker, and `online.js`
routes the same actions to the shared service. A C# copy would fork those rules.
Tradeoff: every XAML surface depends on the bridge, and XAML shows state the game pushes.
It never computes economy, quests or validation itself.

**D2. The bridge is an app-owned `JSImport`/`JSExport` channel through the host page.**
Reason: the Uno 6.7.135 WASM WebView implements `executeScript` as `contentWindow.eval`,
but its JS never calls `DispatchWebMessage`, so `WebMessageReceived` does not fire on
WASM. The game is served same-origin from `game/`, which lets the frame call
`parent.AfterhoursUno.fromGame(json)` directly. One owned channel in both directions avoids
depending on internal `unoExports` names. The current compatibility shim already depends on them.
Tradeoff: the channel is WASM-specific. A future desktop head needs `WebMessageReceived`
plus `ExecuteScriptAsync` behind the same `IGameBridge` interface.

**D3. MVUX with Navigation Extensions.**
Reason: the bridge is a push stream with real async states: the WebView is not ready, the
game has not answered, or the frame failed. Those map directly to `IFeed` and FeedView
Progress/Error states. Each draft has a clear owner as an `IState` (wardrobe outfit,
studio song). Navigation `!` routes give the three panels flyout pages and drop the
hand-toggled overlays.
Tradeoff: about five new Uno.Extensions/Toolkit packages, a larger WASM download, and the
`--in-process` MSBuild path on the Windows build host needs re-verification. MVVM with
`CommunityToolkit.Mvvm` and a plain `Frame` is smaller, at the cost of hand-written
loading and error handling for every panel.

**D4. Panels open as flyout pages over the room. The WebView is never navigated away.**
Reason: reloading the iframe loses the live room, audio and online session. `MainPage`
owns the `WebView2` for the whole session, and panels are `!` routes that open above it.
Tradeoff: panels stay modal over the room, like the current JS dialogs.

**D5. The game renders the avatar preview as an image.**
Reason: `avatar-renderer.js` tints sprite pixels through `getImageData`, and XAML has no cheap
per-pixel tint on the DOM renderer. The game returns a PNG data URL for `(outfit, pose)`,
and XAML shows it in an `Image`.
Tradeoff: one bridge round trip per wardrobe change, about 10–30 ms locally. Results are
cached by key and the latest request wins.

**D6. Audio, WAV export and playback timing stay in JavaScript.**
Reason: `music.js` (WebAudio) also drives jukeboxes, the stage and room music. The studio
sends the draft and receives `playhead` and `playback` messages.
Tradeoff: user-activation rules for the frame's AudioContext (Risk R3).

### Shell and regions

```
App.xaml.cs  UseToolkitNavigation · NavigateAsync<Shell>
Shell (UserControl, ContentControl host; no Region.Attached inside)
└─ MainPage   Grid[Region.Attached]
   ├─ TopBar  (brand, Music toggle, Furniture shop, coins, profile MenuFlyout)
   ├─ Rail    (nav, room hopping, resident card)         ≥ Normal(960): column; < 960: collapsed icons; < 700: hidden
   ├─ GameView WebView2                                  always present; never navigated by routes
   ├─ BottomBar utu:TabBar                               < 700 only
   └─ LoadingPanel (existing)                            covers GameView until bridge `ready`
```

### Route registration

```csharp
views.Register(
    new ViewMap(ViewModel: typeof(ShellModel)),
    new ViewMap<MainPage, MainModel>(),
    new DataViewMap<RoomsPage, RoomsModel, RoomFilter>(),
    new ViewMap<CreateRoomDialog, CreateRoomModel>(),
    new ViewMap<WardrobePage, WardrobeModel>(),
    new ViewMap<StudioPage, StudioModel>());
routes.Register(
    new RouteMap("", View: views.FindByViewModel<ShellModel>(), Nested:
    [
        new RouteMap("Main", View: views.FindByViewModel<MainModel>(), IsDefault: true),
        new RouteMap("Rooms", View: views.FindByViewModel<RoomsModel>()),
        new RouteMap("CreateRoom", View: views.FindByViewModel<CreateRoomModel>()),
        new RouteMap("Wardrobe", View: views.FindByViewModel<WardrobeModel>()),
        new RouteMap("Studio", View: views.FindByViewModel<StudioModel>()),
    ]));
```

Opened with `!` from MainPage: `!Rooms` (data `RoomFilter`), `!Wardrobe`, `!Studio`; `!CreateRoom` from RoomsPage.
The studio's Editor/Library tabs and the room browser's filter tabs use **inline Visibility regions**
inside their page, with no routes.

### Services (DI, `IHostBuilder`)

| Service | Lifetime | Role |
|---|---|---|
| `IGameBridge` → `WasmGameBridge` | Singleton | Owns the JS channel. Exposes `IAsyncEnumerable<HostSnapshot> Snapshots`, `IAsyncEnumerable<Playback> Playback`, `Task<BridgeReply> SendAsync(Intent, ct)` with request IDs and a 5 s timeout |
| `HostInterop` (static partial) | n/a | `[JSImport] Post(string)` and `[JSExport] Receive(string)`; the only C# touching JS |
| `BridgeJsonContext` | n/a | `System.Text.Json` source-generated context (trimming-safe) |

### Bridge protocol (version 1)

Game → XAML (`parent.AfterhoursUno.fromGame`). Every message carries `{v:1, type}`.

| type | When | Payload |
|---|---|---|
| `ready` | game boot done | `mode` (`solo`/`shared`), `wardrobe` catalog (hair, tops, bottoms, colour lists, presets) |
| `snapshot` | after any `game.save` / online apply, throttled to one per animation frame | `hud` (coins, name, level, xp band, questsReady, nextQuest, daily), `room` (key, title, kind), `rooms[]` (key, name, description, kind, owner, count, door, art, favorite, recent rank), `outfit`, `spriteIndex`, `songs[]`, `draft`, `connected` |
| `playback` | music start/stop, each step | `running`, `songId`, `step` |
| `reply` | each intent | `id`, `ok`, `error`, `result` |

XAML → game (`AfterhoursHost.receive` in the frame). Each intent calls **the same JS function the old button called**:

| intent | Calls |
|---|---|
| `room.enterPublic {index}` / `room.visitOwn` / `room.enter {key}` | `enterRoom`, `visitRoom`, or `AfterhoursOnline.joinRoom` when connected |
| `room.create {name, description, tags}` | `act('room', …)` then `visitRoom` |
| `panel.open {name}` | `journal`, `arcade`, `stagePanel`, `catalog`, `petPanel`, `roomTools`, `profile`, help, join/leave shared |
| `music.toggle` | the existing room-music toggle |
| `wardrobe.preview {outfit, pose}` | `AfterhoursAvatar.preview` on an offscreen canvas → `toDataURL` |
| `wardrobe.save {outfit}` / `wardrobe.classic {index}` | `act('outfit', …)` / the `classicLook` save path |
| `studio.play {draft}` / `studio.stop` / `studio.playSong {id}` | `playSong`, `stopMusic` |
| `studio.saveDraft {draft}` / `studio.save {draft}` | `saveDraft`, `act('song', …)` |
| `studio.export {draft}` | `music.wav` → `download` |
| `studio.perform / disc / delete {id}` | `queueSong`, `act('disc')`, `act('deleteSong')` |

The JS half lives in a new `dist/host-bridge.js`, written as a UMD factory `createHostBridge(world, post)` in the
`wardrobe.js` style so Node tests can drive it with a fake `world`.

### Models

- `MainModel(IGameBridge, INavigator)`: `IFeed<Hud> Hud`, `IListFeed<RoomStop> PublicRooms`,
  `IFeed<BridgeStatus> Status`; commands `EnterPublic(RoomStop)`, `VisitHome`, `OpenPanel(string)`,
  `ToggleMusic`, `Retry`.
- `RoomsModel(IGameBridge, INavigator, RoomFilter)`: `IState<RoomFilter> Filter`, `IState<string> Query`
  (initial `""`; Feed.Combine starts as None when any parent is None), `IListFeed<RoomEntry> Rooms` =
  Combine(snapshot.rooms, Filter, Query).Select(filter); `Enter(RoomEntry)` closes the flyout on success.
- `CreateRoomModel`: `IState<string>` Name/Description/Tags, `Create` → `room.create`, inline error.
- `WardrobeModel(IGameBridge)`: `IFeed<WardrobeCatalog> Catalog`, `IState<Outfit> Draft` (seeded from the snapshot),
  `IState<Pose> Pose`, `IFeed<AvatarPreview> Preview` = Combine(Draft, Pose).SelectAsync(preview);
  `ApplyPreset(int)`, `Pick(OutfitChoice)`, `Save`, `UseClassic(int)`.
- `StudioModel(IGameBridge)`: `IState<SongDraft> Draft` (**single writer while open**, seeded once
  from the snapshot; later draft echoes from the game are ignored), `IListFeed<Lane> Lanes` = Draft.Select,
  `IFeed<Playback> Playback`, `IListFeed<Song> Songs`; undo stack inside the model (max 40); commands
  `ToggleStep(StepCell)`, `ToggleMute(int)`, `Solo(int)`, `SetVolume`, `SetTempo`, `SetLength`, `Undo`, `Clear`,
  `NewTrack`, `PlayPause`, `Save`, `Export`, `PlaySong`, `EditSong`, `Perform`, `PressDisc`, `Delete`.
  Every draft edit sends `studio.saveDraft`, debounced to 300 ms.
- Records: `Hud`, `RoomStop`, `RoomEntry(Key,…)`, `RoomFilter`, `Outfit`, `WardrobeCatalog`, `AvatarPreview(Key, Uri)`,
  `SongDraft`, `Lane`, `StepCell(Row, Step, On, BarStart)`, `Song(Id,…)`, `Playback`. All `partial record`, no `required`.

### Platform constraints

- Keyboard: room keys (arrows/WASD, 1/2, R) work only while the iframe has focus. On flyout close, focus
  returns to `GameView` (R4).
- The JS panels still open inside the iframe's `<dialog>`, so they centre on the room area.
- Hosted mode: `game/index.html?host=uno` sets `data-host="uno"` on `<html>`. CSS hides `.topbar`, `.rail`,
  `.room-journey`, `.game-dock` and the top tools. The game skips the `look`/`studio`/`directory` modals
  and forwards those openings to XAML (`open {panel}` message). This covers JS entry points such as the
  "Make a beat" button and online panels.

### Testing and validation

- `tests/test-host-bridge.cjs` (Node): every intent calls the expected `world` function; replies carry
  the request ID; errors become `ok:false`; snapshots are throttled; a `?host` without `uno` leaves standalone behaviour alone.
- `npm test` and `npm run build:uno` stay green; `verify-uno.mjs` also checks the published `host-bridge.js`.
- Runtime: Playwright (Chromium at `/opt/pw-browsers`) against `npm run start:uno`, at 1440, 1000, 800 and 390 px:
  open each panel, change an outfit and save, build and save a track, play it and watch the playhead, filter
  and enter a room, create a room, and run the two-tab shared-world check from `PLAYTEST-SETUP.md`.
  Screenshots go to `docs/screenshots/`.

### Capability inventory

| Capability | Status | Choice |
|---|---|---|
| Top bar: brand, coins, profile menu, music toggle, furniture shop | implemented | XAML; menu items call `panel.open` |
| Rail nav + room hopping list + resident/XP card + daily gift | implemented | XAML from `snapshot.hud` |
| Room-journey strip | implemented | merged into rail room hopping (XAML) |
| Game dock (Stage, Catalog, My rooms, Companion, Room tools) | implemented | XAML commands → `panel.open` / `!Rooms` |
| Room browser: All / Mine / Favorites / Recent, search | implemented | `RoomsPage` |
| Shared navigator: owner, guest count, doorbell | implemented | same page, `kind=shared` rows |
| Create a room | implemented | `CreateRoomDialog` |
| Wardrobe: presets, hair/top/bottom, colours, skin, poses | implemented | `WardrobePage` |
| Wardrobe preview | **substituted** | game renders the PNG (D5) |
| Classic sprite picker | implemented | wardrobe footer list |
| Studio editor: 4 lanes, 16/32 steps, mute/solo/volume, tempo, pack, undo, clear | implemented | `StudioPage` |
| Studio audio, playhead, WAV export | **substituted** | stays in JS (D6) |
| Song library: play, edit, perform, press disc, delete | implemented | Library tab + delete dialog |
| Profile, journal, arcade, stage, catalog, companion, room tools, help, friends, trade, chart, away card | **omitted** (stay JS) | opened from XAML menus |
| Chat sidebar, room heading, now-playing | **omitted** (stay JS) | inside the WebView |
| Standalone HTML, `npm start` | implemented | unchanged without `?host=uno` |

---

## Design Brief

- **Direction:** match the current app chrome: midnight panels, one acid accent, a condensed display face.
  No new colours. The XAML should be indistinguishable from today's CSS at a glance.
- **Theme:** keep Fluent `XamlControlsResources` (the project's existing theme), `RequestedTheme="Dark"` only,
  because the CSS declares `color-scheme: dark` and has no light palette. Controls are tuned with Fluent
  lightweight keys (`ButtonBackground*`, `ToggleButtonBackgroundChecked*`, `TextControl*`, `FlyoutPresenter*`).
  Material/Simple themes are not adopted.

### Tokens (`Themes/Tokens.xaml`, merged in App.xaml; values from `dist/style.css :root`)

| Key | Value | Use |
|---|---|---|
| `SurfaceBaseBrush` | `#14141B` | page, WebView backdrop |
| `SurfacePanelBrush` | `#1C1C25` | rail, flyouts, cards |
| `SurfaceRaisedBrush` | `? pending`, read from `.directory-room` / `.furniture-card` CSS during build | cards, chips |
| `LineBrush` | `#FFFFFF0C` | dividers, card strokes |
| `InkBrush` | `#F3F1E9` | primary text |
| `MutedBrush` | `#92929F` | secondary text (6.3:1 on base) |
| `AcidBrush` | `#DFED8C` | accent fill, active nav, rank numerals |
| `OnAcidBrush` | `#14141B` | text on acid fills |

- **Type ramp** (styles in `Themes/Type.xaml`): `DisplayText` Barlow Condensed SemiBold 34; `TitleText` DM Sans Bold 18;
  `BodyText` DM Sans Regular 13; `LabelText` DM Sans Bold 13; `EyebrowText` Space Grotesk Medium 10, caps
  (CharacterSpacing 150 on the DOM renderer; R6). No literal `FontSize` in pages.
- **Fonts:** `Assets/Fonts/DMSans_Regular.ttf`, `DMSans_Bold.ttf`, `BarlowCondensed_SemiBold.ttf`,
  `SpaceGrotesk_Medium.ttf`: static instances, underscore names, OFL, family by `ms-appx:///…#Family`.
- **Spacing/radii:** 4-pt steps (4, 8, 12, 16, 24, 32); radii 8 (chips, steps), 12 (cards), 16 (flyouts).
- **Scopes:** tokens, type and control lightweight keys live in App.xaml. Page-only templates (step cell, swatch,
  room card) live in each page's `Page.Resources`.
- **Templates:** `RoomCardTemplate` (art 140 px, name, description, kind tag), `RoomStopTemplate` (rail),
  `SwatchTemplate` (32 px circle, selected ring + check glyph), `ChoiceChipTemplate`, `StepCellTemplate`
  (ToggleButton 28×36, bar-start tick), `SongCardTemplate` (sleeve by pack, actions row).
- **Room art:** `game/assets/room-atlas.webp` (3 stacked rows), `side-b.webp` and `my-room.webp`, by URL relative to
  the app base. Atlas rows are cropped by a clipped container with a `TranslateTransform`, from a C# crop
  table that mirrors `.destination-art`.
- **Adaptive** (`utu:ResponsiveLayout` app-wide: Narrow 700 / Normal 960 / Wide 1200 / Widest 1600, matching the CSS):
  - Widest/Wide: rail 220 px with labels; flyouts on the right: Rooms 480, Wardrobe 760, Studio 1040 (capped to 92% width).
  - Normal: rail 72 px icons only; same flyouts.
  - Narrow and below: rail hidden, bottom `utu:TabBar` (Explore, My room, Studio, Look, More); flyouts full-screen from the bottom.
  - Column widths stay fixed and Responsive values sit on elements, per the house rule.

## Interaction Brief

### Flows

1. **Boot:** LoadingPanel → WebView navigates to `game/index.html?host=uno` → `ready` → LoadingPanel hides.
   With no `ready` within 15 s, it shows the existing retry state.
2. **Explore:** rail "Explore" → `!Rooms` (All) → filter, search → tap card → `room.enter` → on reply ok the
   flyout closes and focus returns to the room. Shared doorbell rooms reply `waiting`: the card shows "Ringing…"
   and the flyout stays open.
3. **My rooms:** dock or tab → `!Rooms` with `RoomFilter.Mine` → "＋ Create a room" → `!CreateRoom` → create →
   reply → both close and the room loads.
4. **Look:** rail "My look" → `!Wardrobe` → pick preset/parts/colours (preview updates) → "Save look" →
   `wardrobe.save` → flyout closes; the toast appears in the room as today.
5. **Studio:** rail "Beat studio" or the room's "Make a beat" (JS forwards `open studio`) → `!Studio` Editor tab →
   toggle steps, tempo, pack → Play (playhead runs) → Save track → Library tab → Perform → flyout closes, stage panel
   opens in the room.
6. **Other panels:** rail/dock/profile items → `panel.open` → JS dialog inside the room.

### Input

- Pointer and touch on all XAML; Tab order rail → top bar → WebView → bottom bar.
- Studio keys while the board has focus: Space play/pause, Ctrl+Z undo, arrows move between steps, Enter toggles.
- Esc closes any flyout (Navigation default) and returns focus to the room.

### States per async node

| Node | Value | Progress | None | Error |
|---|---|---|---|---|
| MainPage `Hud` | top bar + rail | skeleton rail, coins "—" | n/a: `ready` always sends one | "Can't reach your world" + Retry |
| Rooms list | cards | 4 skeleton cards | "No rooms match this search." / "No favourites yet." | inline banner + Retry |
| Wardrobe preview | image | previous image + 40% dim | n/a | last good image + "Preview unavailable" |
| Studio songs | grid | skeleton cards | "Your first track is waiting." + New track | banner + Retry |
| Any intent reply | close / refresh | button disabled + label ("Saving…") | n/a | `InfoBar` in the panel with the game's message; 5 s timeout → "The room didn't answer. Try again." |

### Visual states

Nav item: Normal / PointerOver / Pressed / Selected (acid bar **plus** bold label) / Disabled.
Step cell: Off / On (acid fill **plus** inner dot) / Current (outline ring) / BarStart (left tick).
Swatch: Normal / Selected (ring **plus** check glyph). Mute/Solo: toggled (acid **plus** letter weight).

### Motion

- Flyout: Toolkit drawer default open/close. Reduced motion: no slide (R5).
- Preview cross-fade 120 ms `EaseOut` (`Motion.Fast`). Reduced: instant swap.
- Playhead: an overlay ring that snaps one step at a time with no tween. A single element moves, so cells are
  not rebuilt on each tick.

### Accessibility

- `AutomationProperties.Name` on every icon-only button. Step cells are named "Kick step 5, on". Swatches carry
  the colour name. Room cards read "Side B, public room".
- The selected/on state is never carried by colour alone (cues above).
- Text contrast: Ink and Muted on Base and Panel ≥ 4.5:1; OnAcid on Acid ≥ 12:1.
- Focus visuals: Fluent defaults, kept.

### Runtime verification (uno-verify via Playwright on WASM)

At each breakpoint: rail state, flyout size, bottom bar. Per flow above: screenshots plus DOM assertions
(coins change after a purchase made in the room; outfit persists after reload; a saved track appears in the
library after reload; the playhead moves while playing; Esc returns keyboard control to the room).

## Spec Graph Brief

### Route tree

```
Shell (ContentControl host; no Region.Attached)
└─ Main         ViewMap<MainPage, MainModel>  IsDefault
   ├─ Rooms !       flyout · DataViewMap<RoomsPage, RoomsModel, RoomFilter>
   │  └─ CreateRoom !   dialog · ViewMap<CreateRoomDialog, CreateRoomModel>   back: '-' to Rooms
   ├─ Wardrobe !    flyout · ViewMap<WardrobePage, WardrobeModel>
   └─ Studio !      flyout · ViewMap<StudioPage, StudioModel>
      └─ [Visibility region] Editor (default) | Library        inline content
```

Back: `-` closes a flyout. Entering a room closes Rooms and CreateRoom with `-` twice. No route ever clears Main.

### Page trees

```
MainPage @page
├─ TopBar   ← Hud {Progress: "—"}           MenuFlyout ⇒ OpenPanel
├─ Rail     ← Hud, PublicRooms              → !Rooms · !Studio · !Wardrobe · EnterPublic · VisitHome
├─ GameView WebView2                        platform glue (xaml-lint: allow codebehind - bridge host)
├─ BottomBar utu:TabBar  [Responsive Visibility]
└─ Status   ← FeedView(Status) {Progress, Error→Retry}

RoomsPage @page
├─ FilterTabs [Visibility region: All|Mine|Favorites|Recent]  ⇒ Filter
├─ Search TextBox  ⇒ Query (PropertyChanged)
├─ RoomsRepeater ← FeedView(Rooms) {Value, Progress, None, Error}  Navigation n/a → Enter cmd
└─ CreateButton → !CreateRoom

WardrobePage @page
├─ Preview Image ← FeedView(Preview) {Value, Progress(dim), Error(last good)}
├─ Poses (3 toggles) ⇒ Pose
├─ Presets / Hair / Top / Bottoms / Skin  ← Catalog, Draft  ⇒ Pick / ApplyPreset
└─ Footer: Classic list ⇒ UseClassic · Save ⇒ Save

StudioPage @page
├─ Tabs [Visibility region: Editor|Library]
├─ Editor: Name/Pack ⇒ Draft · Lanes ItemsRepeater ← Lanes  ⇒ ToggleStep/Mute/Solo/Volume
│          PlayheadRing ← Playback.step · Tempo/Length/Undo/Clear · Play/Save/New/Export
└─ Library: SongsRepeater ← FeedView(Songs) {Value, Progress, None, Error} ⇒ PlaySong/EditSong/Perform/PressDisc/Delete
```

### Data-flow graph

```
JS game ──fromGame──▶ HostInterop.Receive ──▶ WasmGameBridge
   ├─ Snapshots ──▶ MainModel.Hud, .PublicRooms
   │            ├─▶ RoomsModel.Rooms  (Combine with Filter, Query)
   │            ├─▶ WardrobeModel.Draft (seed once)
   │            └─▶ StudioModel.Draft (seed once), .Songs
   ├─ Playback  ──▶ StudioModel.Playback
   └─ Replies   ──▶ SendAsync awaiters
XAML commands ──SendAsync──▶ HostInterop.Post ──toGame──▶ host-bridge.js ──▶ AfterhoursWorld / act()
Writers: Filter, Query ⇐ RoomsPage only · Wardrobe Draft/Pose ⇐ WardrobeModel commands only ·
         Studio Draft ⇐ StudioModel commands only (game echoes ignored while open) · game state ⇐ JS only
```

### Design graph

```
App.xaml @App  (Dark only → StaticResource is correct)
├─ SurfaceBaseBrush #14141B ── MainPage, GameView backdrop
├─ SurfacePanelBrush #1C1C25 ── Rail, FlyoutPresenter keys, cards
├─ SurfaceRaisedBrush ? pending ── RoomCardTemplate, ChoiceChipTemplate
├─ LineBrush #FFFFFF0C ── dividers, card strokes
├─ InkBrush / MutedBrush ── type styles
├─ AcidBrush #DFED8C   cue: + bold label (nav) · + dot (step) · + check (swatch)
│  └─ NavItem.Selected, StepCell.On, Swatch.Selected, Primary button
├─ OnAcidBrush #14141B ── Primary button text, StepCell dot
├─ Motion.Fast Duration 0:0:0.12 · ExponentialEase EaseOut  reduced: instant
├─ Type.Display  ms-appx:///Assets/Fonts/BarlowCondensed_SemiBold.ttf#Barlow Condensed SemiBold
├─ Type.Body     ms-appx:///Assets/Fonts/DMSans_Regular.ttf#DM Sans · DMSans_Bold.ttf#DM Sans Bold
└─ Type.Eyebrow  ms-appx:///Assets/Fonts/SpaceGrotesk_Medium.ttf#Space Grotesk Medium
StudioPage.Resources @studio: StepCellTemplate, SongCardTemplate
WardrobePage.Resources @wardrobe: SwatchTemplate, ChoiceChipTemplate
RoomsPage.Resources @rooms: RoomCardTemplate
```

### Spec gate

| Check | Result | Nodes | Resolution |
|---|---|---|---|
| Registration | PASS | all five views | RoomsPage takes `RoomFilter` via DataViewMap |
| Region host | PASS | Main, panels | `!` routes need no named region |
| Shell safety | PASS | Shell | no Region.Attached in Shell |
| Cross-page links | PASS | Studio→stage | stage stays JS; `panel.open stage` after `-` |
| Back stack | PASS | Rooms→CreateRoom | `-` twice on success |
| Sources | PASS | every bound node | all in data-flow graph |
| Feed vs state | PASS | Filter, Query, Draft, Pose | user-editable → IState |
| Single writer | PASS (with precedence) | Studio Draft | XAML is the writer while open; game echoes ignored |
| FeedView states | PASS | Hud, Rooms, Preview, Songs | table above; Lanes n/a (derived from local state) |
| Failure paths | PASS | every intent | InfoBar + timeout |
| Data shape | PASS | RoomEntry | covers public/mine/shared, door, owner, count |
| Tokens | **FAIL** | SurfaceRaisedBrush | `? pending` → Unresolved Questions |
| Theme-awareness | PASS | all brushes | dark-only app; StaticResource |
| Scope | PASS | templates | page scoped |
| Color cue | PASS | nav, step, swatch, mute | second cue named |
| Contrast | PASS | Acid/OnAcid, Muted | text-safe |
| Encodings | n/a | — | no value-scaled visuals |
| Motion | PASS | preview fade, drawer | reduced fallback named; drawer depends on R5 |
| Type assets | **FAIL** | four font files | not in repo yet; WASM `ms-appx` font path unverified (R6) → Unresolved Questions |
| UnoFeatures | PASS | Hosting, MVUX, Navigation, Toolkit | listed |
| Targets | PASS | bridge | WASM only; desktop path named in D2 |
| Pending | PASS | SurfaceRaisedBrush | marked |
| Capabilities | PASS | 3 substituted/omitted groups | repeated in Unresolved Questions |

---

## Implementation Plan

0. **Spikes** (each time-boxed; failures go to the Debug Checkpoint): R1 bridge, R2 flyout over iframe,
   R3 audio activation, R6 fonts, R7 build/payload. Throwaway branch, results recorded here.
1. **Game hosted mode:** `dist/host-bridge.js` + `?host=uno` CSS/JS hooks + `tests/test-host-bridge.cjs`.
   `npm test`. Commit `feat: add host bridge and hosted mode to the game client`.
2. **XAML foundation:** UnoFeatures, `IHostBuilder` + `UseToolkitNavigation`, Shell, `IGameBridge`/`HostInterop`,
   tokens, fonts, MainPage with WebView + top bar + rail + bottom bar. `npm run build:uno`, Playwright boot check.
   Commit.
3. **Room browser** (Rooms + CreateRoom), solo and shared. Verify flows 2–3. Commit.
4. **Wardrobe.** Verify flow 4, reload persistence. Commit.
5. **Studio** (editor, playhead, library). Verify flow 5. Commit.
6. **Docs and checks:** README Uno section, RELEASE-NOTES, `verify-uno.mjs` checks `host-bridge.js`, new screenshots. Commit.

## Quality Gates

| Phase | Gate (skill) | Done when |
|---|---|---|
| 1–6 | Build + tests | `npm test` green; `npm run build:uno` 0 warnings; CI `validate.yml` green |
| 2–5 | `uno-verify` (Playwright on WASM; App MCP n/a for this head) | each touched flow exercised at 4 widths, screenshots saved |
| 3–5 | `uno-component-states` | Progress/None/Error exist per table; Retry proven by killing the bridge |
| 2–5 | `uno-build-log` | entry per milestone in `docs/fleet/BUILD-LOG.md` |
| 5 | `uno-completeness-audit` scoped to the four surfaces | report lists gaps with evidence |
| 6 | `uno-break-it`, then `gold-standard-pass`, then `uno-audit` | findings fixed or listed below |
| any "ready to demo" claim | full `uno-completeness-audit` → `docs/COMPLETENESS.md` | report saved |

## Risks

- **R1 API:** JS→C# through `[JSExport]` called by the frame via `parent`. Proven on .NET 10 WASM, unproven in
  this app's published bundle. Spike 15 min: one round trip in `release/uno`.
- **R2 Layout:** XAML flyout over the iframe: z-order, pointer capture after the iframe had focus, light dismiss
  when clicking the room. Spike 15 min.
- **R3 Audio:** the frame's AudioContext may refuse to start after a click in the parent document. Chrome
  propagates user activation up to ancestors, never down to child frames. Mitigations to test: iframe
  `allow="autoplay"` set by the interop shim before navigation; resume on the frame's first pointer event.
  Spike 15 min in Chromium, plus a manual Safari check.
- **R4 Focus:** returning keyboard focus to the iframe after a flyout closes (`GameView.Focus` vs
  `iframe.contentWindow.focus()` via the shim). Spike 10 min.
- **R5 Motion:** the Toolkit drawer has no reduced-motion switch. The fallback is a plain `Flyout` presenter with
  no transition when `prefers-reduced-motion` matches.
- **R6 Fonts/text:** `ms-appx` font URIs and `TextBlock.CharacterSpacing` on the WASM DOM renderer. Spike 10 min.
  The Fonts.css comment says base64 `@font-face` avoids late text reflow.
- **R7 Build:** Extensions + Toolkit size and time on WASM, and the `--in-process` task-host path on the Windows
  host. Measure the bundle before and after.
- **R8 Compatibility shim:** `AfterhoursInterop.js` wraps internal `unoExports` for the 6.7.135 ID mismatch. It
  stays as is; D2 avoids adding more internal dependencies.

## Unresolved Questions

- **New dependencies:** approve the `Hosting; MVUX; Navigation; Toolkit` UnoFeatures (D3)? The
  alternative is MVVM + plain Frame.
- **Chat sidebar, room heading and now-playing** stay in the WebView for this pass. Move chat later?
- **Other panels** (profile, journal, arcade, stage, catalog, companion, room tools, help, friends, trade, chart,
  away card) stay JS dialogs centred on the room area. Acceptable for this pass?
- **Wardrobe preview is rendered by JS** (substituted). OK?
- **Studio audio, playhead and WAV export stay in JS** (substituted). OK?
- **Fonts:** add four OFL TTFs (DM Sans ×2, Barlow Condensed, Space Grotesk) to `Assets/Fonts`?
- **SurfaceRaisedBrush:** take the card colour from the current CSS during the build (default), or set one now?
- **Phone layout:** bottom TabBar below 700 px with full-screen bottom sheets. Is the phone a target for the playtest?
- **Studio size:** right drawer up to 1040 px (spec), or a full-window page with the room hidden while composing?
- **Spec location:** the root `SPEC.md` holds the shipped applause spec, so this one lives in `docs/specs/`. Keep it here?
