# Spec: applause that pays, traces while away, weekly chart

Status: approved for build 2026-10-20 ("do 1-2-3"). Built in the same session.

Goal: close the Coke Music loop (make, play, get a real reaction, earn, show it) and let a
small playtest group feel known even when they are rarely online at the same time.

Scope: shared world only (`session-core.mjs`, worker build, `dist/online.js`, `dist/game-core.js`).
Solo play keeps simulated resident applause and pays nothing for it.

## Architecture Brief

- **Module structure.** Server rules live in `session-core.mjs`; economy rules that touch a
  player's save live in `dist/game-core.js` (`Game.dispatch`), which the Cloudflare worker
  bundles unchanged. Client rendering lives in `dist/online.js` panels.
- **State model.** One world JSON document (`world_state.body`, 1.7 MB cap).
  - `user.away: [{id, kind, text, time}]`, newest first, capped at 30. `user.awaySeen: number`.
  - `db.chart: {week, entries: {[userId:songId]: {user, artist, title, listeners: [ids], plays, first}}}`,
    capped at 200 entries.
  - `db.chartHistory: [{week, top: [{rank, artist, title, listeners}]}]`, capped at 8 weeks.
  - `game.awards: [{week, rank, title}]` in the player's save, capped at 20, validated in `validate()`.
  - Applause bookkeeping goes in `game.rewards` under day-scoped keys (existing pattern).
- **Data flow.** `vote` action → performance.votes (existing) → `applause` dispatch on the
  performer's game (credits, XP) → performer notification. `tick` at set end → chart entry.
  `tick` on week rollover → `chartAward` dispatch for the top 3 → `away` trace → `chartHistory`.
  `joinRoom` into someone's home and `friend` requests → `away` trace for an offline owner.
  `snapshot` exposes `away` (unseen only), `chart` (top 10 + last week), friends' `lastSeen`.
- **Platform constraints.** Every action runs on a cloned world and commits whole, so a
  failed payout cannot half-apply. All new lists are capped to protect the 1.7 MB document.
- **Economy numbers (decided here; the user can change them).**
  - Applause pays the performer **5 ✦ and 3 XP** per real listener.
  - A listener pays the same artist **once per UTC day**; an artist earns at most
    **50 ✦ per UTC day** from applause (10 listeners). Votes beyond the caps still count on the chart.
  - Set completion keeps its existing 40 ✦ for the first 5 sets a day.
  - Weekly chart (ISO week, UTC, resets Monday 00:00 UTC): score = unique listeners who
    applauded the track that week; ties go to more plays, then the earlier first play.
    A track needs at least 1 applause to place. Awards: **#1 150 ✦, #2 100 ✦, #3 60 ✦**,
    plus an award entry on the profile.
- **Testing.** `tests/test-session.mjs` covers payouts, both caps, self-vote rejection,
  chart ranking and rollover, awards, visit traces, away-seen, and lastSeen exposure.
  Headless Chromium against `npm start` covers the panels.
- **Capability inventory.**

| Capability | Status |
| --- | --- |
| Applause credits the performer | implemented |
| Anti-farming caps | implemented |
| Away feed: room visits, friend requests, chart results | implemented |
| Friends' last seen | implemented |
| Weekly chart, top 10 + last week's top 3 | implemented |
| Gold/platinum record furniture award | **substituted**: credits + profile award (no record art exists) |
| Push or email notification while away | **omitted**: the card shows on return |
| Notes left in someone else's room | **omitted**: notes are owner-only today |

## Design Brief

- **Direction.** Existing app chrome: midnight panels, acid accent `#dfed8c` (`--acid`),
  muted `#92929f` (`--muted`), DM Sans, 13 px body. No new colours.
- **Away card.** A standard `W.panel` titled "While you were away", eyebrow "SINCE YOUR LAST VISIT".
  One row per item: glyph (⌂ visit, ♡ friend, ★ chart), text, relative time in `--muted`.
  Primary button "Got it". At most 10 rows, then "and N more".
- **Chart panel.** `W.panel` "This week's chart", eyebrow "WEEK nn · RESETS MONDAY".
  Rows: rank (tabular numerals, 22 px column), title in 13 px 700, artist in muted, listeners
  count on the right ("4 ♡"). Your own entries get the acid rank number plus "you" text,
  so the cue is not colour alone. Last week's top 3 below with ① ② ③.
- **Stage panel.** The fine print states the applause rule in one sentence; a
  "Weekly chart ↗" button sits under the lineup.
- **Friends list.** Status text becomes "Here now", "Seen 12 min ago", "Seen 3 h ago", "Seen Mon".
- **Responsive.** Panels already scroll and fit 390 px; rows truncate titles with ellipsis.

## Interaction Brief

- **Flows.**
  1. Bob applauds Alice's set → Alice gets a toast "Bob applauded “Night drive” · +5 ✦"
     (or without the credit part when capped); the stage counter updates as before.
  2. Alice returns after Bob visited her room → on the first snapshot after connecting,
     the away card opens; "Got it" sends `awaySeen` and closes it.
  3. Anyone opens Stage → Weekly chart → sees the top 10 and last week's winners.
- **Empty states.** Chart: "No applause yet this week. Play a set and the chart opens."
  Away card: not shown when empty. Friends: unchanged.
- **Loading.** Data arrives in the snapshot; panels render from current state.
- **Errors.** Server errors surface through the existing toast path. Self-applause and
  repeat applause keep their existing messages.
- **Animation.** None new; panels use the existing modal transition.
- **Accessibility.** Rows are text, readable by screen readers; the "you" marker is text.
  "Got it" receives focus through the existing modal.
- **Runtime verification.** Two headless browser sessions against `npm start`: B applauds A,
  A's coins rise by 5; A leaves, B visits A's room, A rejoins and sees the card; the chart lists the track.

## Design Graph Brief

```
Shared navigator / stage
├─ Stage panel [modal]            ← state.stage, state.queue
│  └─ Weekly chart ↗              → Chart panel
├─ Chart panel [modal]            ← state.chart {empty: "No applause yet", error: n/a, snapshot-only}
│  ├─ ThisWeek rows (≤10)         ← chart.top
│  └─ LastWeek rows (≤3)          ← chart.last     {empty: hidden}
├─ Away card [modal]              ← state.away     {empty: not opened}
│  └─ Got it                      ⇒ user.awaySeen (action awaySeen)
└─ Friends panel                  ← state.friends[].lastSeen
```

```
vote ──⇒ stage.votes ──⇒ game.coins/xp/rewards (Game.dispatch 'applause')
                    └──⇒ user.notifications
tick(set end) ──⇒ db.chart.entries
tick(week rollover) ──⇒ game.awards + coins (Game.dispatch 'chartAward') ──⇒ user.away ──⇒ db.chartHistory
joinRoom(home, offline owner) / friend ──⇒ user.away
snapshot ← user.away (time > awaySeen), db.chart (top 10), db.chartHistory[0], friends lastSeen
```

| Check | Result | Notes |
| --- | --- | --- |
| Sources | PASS | Every panel reads snapshot fields defined above |
| Single writer | PASS | Coins only via `Game.dispatch`; chart only in `tick`; away via one `trace()` helper |
| Data states | PASS | Empty states named; loading n/a (snapshot); errors via toast |
| Failure paths | PASS | Cloned-world commit; dispatch throws roll back the action |
| Routes | PASS | Chart opened from stage panel; away card from apply() |
| Data shape | PASS | Entries keyed by user+song; titles snapshotted at play time |
| Color cue | PASS | Own rows say "you"; ranks are numerals |
| Tokens | PASS | Uses existing --acid / --muted |
| Motion | PASS | No new motion |
| Type assets | PASS | DM Sans already loaded |

## Implementation Plan

1. `game-core.js`: `applause` and `chartAward` dispatch cases; `awards` in `validate()`. Tests.
2. `session-core.mjs`: payout in `vote`; `trace()` helper; visit and friend traces;
   `awaySeen` action; chart accrual at set end; week rollover with awards and history;
   snapshot fields. Tests in `test-session.mjs`; update the 280 → 285 expectation.
3. `online.js`: applause toast copy (server notification), away card, chart panel,
   stage panel button and copy, friends last-seen text.
4. `npm test`, `npm run build:service`, headless two-player check, commit.

## Unresolved Questions

- Gold and platinum record furniture needs new art; until then the top 3 get credits and a profile award. Commission art?
- Away traces are in-app only. No push or email while away. Acceptable for the playtest?
- Notes in someone else's room are not possible today, so "notes left for you" is omitted.
- Are 5 ✦ per applause, 50 ✦ a day, and 150/100/60 for the chart the right numbers?
- Weeks reset Monday 00:00 UTC, which is Sunday 20:00 in Montreal (EDT). Keep UTC?
