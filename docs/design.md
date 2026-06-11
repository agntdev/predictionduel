# DESIGN — PredictionDuel

Architecture, command set and conversation flows for the PredictionDuel
Telegram bot. Satisfies every entity, dependency and feature in
`docs/general.md`.

## 1. Architecture

```
Telegram ⇄ grammY bot (long polling)
              │
              ├─ command router  (/start /newduel /predict /duels …)
              ├─ callback router (cat:* ev:* pick:* stake:* confirm:*)
              ├─ session store   (per-chat finite-state machine)
              ├─ service layer   (duels, predictions, resolution, reputation)
              ├─ resolver job    (poll event sources on duel deadlines)
              └─ SQLite persistence (users, events, duels, predictions, stakes, reputation)
```

- **Runtime**: single Node.js process, grammY, long polling (no inbound ports).
- **State machine** per chat: `idle → new_duel_title → … → confirming`.
  Any `/command` or `🏠 Меню` resets to the flow root or to the main menu.
- **Persistence**: SQLite file on a volume. All reads/writes go through a
  repository layer so business rules (deadline math, reputation, double-pick
  prevention) live in one place.
- **Resolver**: a tick that wakes at a configurable cadence (default 60s)
  and resolves any `duel` whose `deadline` has passed by querying the
  appropriate event source (crypto price feed, sports API, weather API, or
  manual admin input).

## 2. Data model (implements General "Core Entities")

| Entity | Table | Fields |
| --- | --- | --- |
| **User** | `users` | `tg_id` PK, `name`, `reputation` (default 1000), `created_at` |
| **Event** | `events` | `id` PK, `name`, `type` (`crypto`/`sports`/`game`/`weather`/`other`), `source_kind` (`api`/`manual`), `source_ref` (symbol/team/keyword), `event_at` (when the real-world event happens) |
| **PredictionDuel** | `duels` | `id` PK, `creator_tg_id` FK→users, `event_id` FK→events, `title`, `description`, `deadline` (no more picks after this), `status` (`open`/`resolved`/`cancelled`), `outcome` NULL until resolved, `resolved_at` |
| **Prediction** | `predictions` | `id` PK, `duel_id` FK→duels, `user_tg_id` FK→users, `outcome` (free-text label, e.g. `yes`/`no`, `team A`, `>50k`), `created_at`. Unique `(duel_id, user_tg_id)` — one pick per user per duel. |
| **Stake** | `stakes` | `id` PK, `prediction_id` FK→predictions, `amount` (point units, non-negative integer), `created_at` |
| **Leaderboard** | view `v_leaderboard` | `user_tg_id`, `display_name`, `reputation`, `rank()` over `reputation` desc |
| **ReputationScore** | column on `users` | `reputation` (integer) — single source of truth; no separate table |

Relationships preserved exactly as General states: user 1—N duels
(created), user 1—N predictions, duel N—1 event, duel 1—N predictions,
prediction 1—1 stake.

## 3. Command set

| Command | Purpose |
| --- | --- |
| `/start` | register user (upsert `users`), short onboarding + main menu |
| `/help` | command reference |
| `/newduel` | create a new duel (event type → event → title/description → deadline → outcome options) |
| `/duels` | list open duels + filter buttons (crypto / sports / games / weather / all) |
| `/duel <id>` | show one duel: title, description, deadline, outcome options, participants, your pick |
| `/predict <duel_id> <outcome>` | quick pick; prompts to confirm stake |
| `/mypreds` | list your predictions grouped by status (pending / won / lost) |
| `/history` | past duels you participated in |
| `/leaderboard` | top-N predictors with reputation |
| `/challenge <user>` | (top-of-list convenience) send the top predictor a "challenge accepted?" nudge |
| `/stats` | your accuracy: total picks, correct, %, current streak |
| `/export` | DM yourself a CSV of your prediction history (privacy: only your own) |

Admin (not user-facing, restricted to `ADMIN_TG_ID`):

| Command | Purpose |
| --- | --- |
| `/admin_resolve <duel_id> <outcome>` | manual resolution (overrides the auto-resolver) |
| `/admin_event` | create/refresh an Event (type, source_ref, event_at) |

## 4. Conversation / UX flows

### 4.1 Create a duel (`/newduel`)
1. Bot shows event-type inline keyboard: `crypto` `sports` `games` `weather`
   `other` — CB `cat:<type>`.
2. For known type: bot asks for a search term (e.g. `BTC`, `Lakers vs Celtics`),
   queries the matching source API, lists candidate Events inline (CB
   `ev:<event_id>`). If no candidates → "No known event for that term; an admin
   can create one with /admin_event".
3. Bot asks for title (1–120 chars) and description (≤ 500 chars).
4. Bot asks for the **deadline** (when picks close, must be before
   `events.event_at`) — accepts ISO date or relative like `in 3h`.
5. Bot asks for outcome options: free-text comma-separated, e.g. `yes,no` or
   `home,away,draw`. Must be 2–6 distinct options.
6. Confirmation card with everything → CB `confirm:create` / `cancel:flow`.
7. On confirm: insert `duels` row with `status=open`; bot replies
   "Duel #N created — share it: /duel N".

### 4.2 Make a prediction (`/predict <duel_id> <outcome>` or from a duel's card)
1. Bot validates the duel is `open` and not past `deadline`; else
   "This duel is closed".
2. Bot shows the outcome buttons (CB `pick:<duel_id>:<outcome_idx>`).
3. User picks an outcome → bot shows the duel card again with a
   "💰 Stake points" prompt and quick-pick buttons (`0` `10` `25` `50` `100`
   `custom`). Custom → text step, integer 0–10 000.
4. CB `confirm:stake` → insert `predictions` (one-per-user enforced by the
   unique key) and `stakes`. Reply "Locked in: <outcome> for <n> points".

If the user re-predicts on the same duel before the deadline, the previous
prediction is replaced (single transaction: delete old `stakes` + old
`predictions`, insert new). After the deadline the duel rejects new picks.

### 4.3 Auto-resolve (System)
`resolver` tick every 60s:
- find `duels` with `status=open` and `deadline <= now`
- for each, fetch the event outcome from the appropriate source
  (crypto: latest price vs `source_ref`; sports: scoreboard; weather: condition;
  games: official result). If the source returns nothing, leave the duel
  `open` and try again next tick (max 1 hour, then admin must resolve).
- write the canonical `outcome`, set `status=resolved`, `resolved_at=now`
- for every `prediction` on that duel: if the predicted outcome matches
  the canonical one → user's `reputation += stake * 1`; else
  `reputation -= stake * 1` (floored at 0). Stakes are points only — no real
  currency moves.
- notify each participant: "✅ Right: +N" or "❌ Wrong: −N. New reputation: X".
- rebuild `v_leaderboard` (it's a view — always fresh).

### 4.4 View duels (`/duels`)
Paginated (10/page) list of `open` duels with type filter buttons
(`cat:filter:<type>`). Each row: `⚔️ #N · <title> · closes in <relative> · N picks`
→ CB `duel:open:<id>` opens the duel card (§4.5).

### 4.5 Duel card (`/duel <id>`)
- Title, description, event (name + type + source), deadline (relative),
  outcome options with current pick distribution.
- "Your pick: <outcome> · stake: <n>" or "You haven't picked yet".
- Inline actions: `🎯 Pick` (CB `pick:<id>:menu`), `📊 Stats`,
  `🔔 Remind me at deadline`.

### 4.6 Leaderboard (`/leaderboard`)
Top 20 by `reputation` desc: `1. <name> · 1240 (87% acc · 52 picks)`. Footer
"You: #<rank> · <reputation>". Page navigation `« Prev` `Next »`.

### 4.7 Challenge top predictor (`/challenge <user>` or button from leaderboard)
Sends the target a message: "🏆 <name> challenged you to a duel! /newduel to
answer." Posts also in the chat that initiated it. No blocking state — it's a
nudge, not a 1v1 protocol.

### 4.8 My predictions (`/mypreds`)
Grouped sections: `Pending (N)`, `Won (M)`, `Lost (K)`. Each row links back
to the duel card.

### 4.9 History (`/history`)
Last 50 resolved duels the user participated in, with their pick and the
result.

### 4.10 Stats (`/stats`)
Card: `Total picks: N · Correct: M · Accuracy: P% · Current streak: S ·
Reputation: R · Rank: #K`.

### 4.11 Export (`/export`)
Generates a CSV of the user's predictions and DMs it. Header:
`duel_id,title,event_type,deadline,picked,stake,result,reputation_delta,resolved_at`.

### 4.12 Admin — manual resolve (`/admin_resolve <duel_id> <outcome>`)
Validates outcome is one of the duel's options, then runs the same
resolution logic as the auto-resolver (§4.3). Used when the API source
fails or the event is `manual` type.

### 4.13 Admin — event management (`/admin_event`)
Text steps: type → source_ref (free text — the keyword the resolver queries
for) → event_at (when the real-world event happens). Insert/update an
`events` row so future duels can reference it.

## 5. Edge cases & rules

- **Deadline in the past** — `/newduel` rejects with a clear error and asks
  for a new deadline.
- **Event has no resolvable source** — duel stays `open`; admin must
  `/admin_resolve`. Bot DMs the creator after 1h of failed ticks.
- **Reputation floor** — `reputation` cannot drop below 0; negative deltas
  are clamped. (Stakes are still subtracted for accuracy, but a user can't
  go negative on the leaderboard.)
- **One pick per user per duel** — enforced by the unique
  `(duel_id, user_tg_id)` index; re-picking replaces atomically.
- **Deadline race** — if a pick arrives exactly at `deadline`, the
  transaction re-checks `deadline > now`; otherwise it rejects with
  "Picks are closed".
- **Cancelled duels** — admin can `/admin_resolve <id> cancel`; reputation
  is unchanged for all participants, stakes are refunded.
- **Timezone** — deadlines stored UTC, rendered in the user's local
  timezone (from Telegram `Language` if available, else UTC).
- **Restart safety** — every duel and prediction is a DB row; the resolver
  re-scans on every tick, so a crash mid-resolution is harmless.
- **Privacy** — `/export` only returns the caller's own data; no global
  user-data export.

## 6. External dependencies (mirrors General)

- **Telegram Bot API** via grammY — long polling, inline keyboards,
  callback queries, bot-initiated messages.
- **Crypto price API** (e.g. CoinGecko) for crypto events.
- **Sports API** (e.g. API-Sports) for sports events.
- **Weather API** (e.g. OpenWeatherMap) for weather events.
- **Database** — SQLite (users, events, duels, predictions, stakes).
- **Scheduled task system** — the in-process `resolver` tick. In a
  multi-instance deploy this would be a single leader-elected job; for
  preview scale, a single process is fine.

## 7. Non-goals (inherited from General)

No real-crypto staking, no real-time live scores, no private 1v1 challenges
beyond the `/challenge` nudge, no odds/derivatives, no team/league
forecasting, no social sharing, no ML accuracy boosters.

## 8. Feature → design traceability

| General feature | Design section |
| --- | --- |
| User registration via Telegram | 4.1 / `users` table |
| Create duel (title, desc, type, deadline) | 4.1 |
| Stake points on a prediction | 4.2 step 3 |
| Make a prediction for a duel | 4.2 |
| View active and past duels | 4.4, 4.5, 4.9 |
| Auto-resolve on outcome known | 4.3 |
| Update reputation on accuracy | 4.3 (last bullet) |
| Public leaderboard | 4.6 |
| Challenge top predictors | 4.7 |
| Resolve/win notifications | 4.3 (last bullet) |
| Personal history | 4.9 |
| Duel details (participants, picks) | 4.5 |
| Admin manual resolve | 4.12 |
| Multi event types (crypto, sports, games, weather, other) | 2, 4.1 step 1 |
| Export user statistics | 4.11 |
