# DETAILS Design Document: PredictionDuel Bot

## SCREENS

### 1. Main Menu
- **Trigger**: `/start`, `/help`, or `🏠 Меню` from any screen.
- **Message**:
  ```
  🏹 Prediction Duel Bot

  What would you like to do?

  🔹 Create a new duel /newduel
  🔹 View active duels /duels
  🔹 View your predictions /mypreds
  🔹 View duel history /history
  🔹 View leaderboard /leaderboard
  🔹 Challenge a top predictor /challenge
  🔹 View your stats /stats
  🔹 Export your data /export
  ```
- **Keyboard**:
  ```
  [[Create a new duel], [View active duels], [View your predictions], [View duel history], [View leaderboard], [Challenge a top predictor], [View your stats], [Export your data]]
  ```
- **Transitions**:
  - `Create a new duel` → `New Duel Type Selection`
  - `View active duels` → `Duel List (Open)`
  - `View your predictions` → `My Predictions (Pending/Won/Lost)`
  - `View duel history` → `Duel History`
  - `View leaderboard` → `Leaderboard`
  - `Challenge a top predictor` → `Challenge Top Predictor`
  - `View your stats` → `User Stats`
  - `Export your data` → `Export Predictions`

---

### 2. Admin Commands (Restricted)
- **Trigger**: `/admin_resolve` or `/admin_event` (only for admin users).
- **Message**:
  ```
  🔐 Admin Panel

  🔹 Manual Resolve Duel /admin_resolve
  🔹 Create/Update Event /admin_event
  ```
- **Keyboard**:
  ```
  [[Manual Resolve Duel], [Create/Update Event], [Main Menu]]
  ```
- **Transitions**:
  - `Manual Resolve Duel` → `Admin Resolve Duel`
  - `Create/Update Event` → `Admin Event Creation`
  - `Main Menu` → `Main Menu`

---

### 3. Admin Resolve Duel
- **Trigger**: `/admin_resolve` from Admin Panel.
- **Message**:
  ```
  🔧 Enter duel ID and outcome to resolve manually:
  Format: <duel_id> <outcome>
  ```
- **Keyboard**:
  ```
  [[Cancel]]
  ```
- **Transitions**:
  - User input → `Admin Resolve Confirmation`
  - `Cancel` → `Admin Panel`

---

### 4. Admin Event Creation
- **Trigger**: `/admin_event` from Admin Panel.
- **Message**:
  ```
  🧩 Create/Update an Event

  🔹 Type: crypto/sports/games/weather/other
  🔹 Source Ref: (free text)
  🔹 Event At: (ISO date)
  ```
- **Keyboard**:
  ```
  [[Cancel]]
  ```
- **Transitions**:
  - User input → `Admin Event Confirmation`
  - `Cancel` → `Admin Panel`

---

## COMPONENTS

### 1. Resolver Job
- **Purpose**: Periodically check for resolved events and update duels.
- **Logic**:
  - Every 60s, scan all open duels where `deadline <= now`.
  - Query event source (API or manual) for outcome.
  - If outcome found: update duel status, calculate reputation deltas, notify users.
  - If no outcome after 1 hour: mark as unresolved (admin must resolve).
  - On restart: re-scan all unresolved duels to ensure no missed resolutions.

### 2. Prediction Replacement Handler
- **Purpose**: Allow users to replace predictions before deadline.
- **Logic**:
  - On prediction input, check if user already has a prediction for the duel.
  - If yes: delete existing prediction and stake, insert new ones atomically.
  - Enforce `deadline > now` check on transaction commit to prevent race conditions.

### 3. Reputation Floor Enforcer
- **Purpose**: Ensure reputation cannot drop below 0.
- **Logic**:
  - On resolution, calculate reputation delta.
  - Clamp final reputation to `MAX(0, current_reputation + delta)`.

---

## TRANSITIONS

| State | Input | Next State | Side Effects |
| --- | --- | --- | --- |
| `Main Menu` | `/admin_resolve` | `Admin Resolve Duel` | None |
| `Admin Resolve Duel` | User input | `Admin Resolve Confirmation` | Validate duel and outcome |
| `Admin Resolve Confirmation` | `Confirm` | `Duel Resolved` | Update duel status, calculate reputation, notify users |
| `Admin Panel` | `/admin_event` | `Admin Event Creation` | None |
| `Admin Event Creation` | User input | `Admin Event Confirmation` | Insert/update event in DB |
| `Duel Card` | `🎯 Pick` → `Prediction Selection` | None |
| `Prediction Selection` | `Outcome X` → `Stake Selection` | None |
| `Stake Selection` | `Custom` → `Custom Stake Input` | None |
| `Custom Stake Input` | User input → `Prediction Confirmation` | Validate stake amount |
| `Prediction Confirmation` | `Confirm` → `Prediction Locked` | Insert prediction and stake into DB |
| `Resolver Job` | Tick | Auto | Check deadlines, resolve duels, update reputation |

---

## DATA

### 1. Users Table
```sql
CREATE TABLE users (
  tg_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  reputation INTEGER DEFAULT 1000 CHECK(reputation >= 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Events Table
```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('crypto', 'sports', 'game', 'weather', 'other')),
  source_kind TEXT CHECK(source_kind IN ('api', 'manual')),
  source_ref TEXT NOT NULL,
  event_at DATETIME NOT NULL
);
```

### 3. Duels Table
```sql
CREATE TABLE duels (
  id INTEGER PRIMARY KEY,
  creator_tg_id INTEGER NOT NULL REFERENCES users(tg_id),
  event_id INTEGER NOT NULL REFERENCES events(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  deadline DATETIME NOT NULL,
  status TEXT CHECK(status IN ('open', 'resolved', 'cancelled')),
  outcome TEXT,
  resolved_at DATETIME,
  FOREIGN KEY (creator_tg_id) REFERENCES users(tg_id)
);
```

### 4. Predictions Table
```sql
CREATE TABLE predictions (
  id INTEGER PRIMARY KEY,
  duel_id INTEGER NOT NULL REFERENCES duels(id),
  user_tg_id INTEGER NOT NULL REFERENCES users(tg_id),
  outcome TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (duel_id, user_tg_id)
);
```

### 5. Stakes Table
```sql
CREATE TABLE stakes (
  id INTEGER PRIMARY KEY,
  prediction_id INTEGER NOT NULL REFERENCES predictions(id),
  amount INTEGER NOT NULL CHECK(amount >= 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 6. Leaderboard View
```sql
CREATE VIEW v_leaderboard AS
SELECT 
  u.tg_id,
  u.name AS display_name,
  u.reputation,
  RANK() OVER (ORDER BY u.reputation DESC) AS rank
FROM users u
ORDER BY u.reputation DESC;
```

---

## ACCEPTANCE NOTES

1. **Auto-Resolve Logic**:
   - Resolver tick runs every 60s, resolving duels with `deadline <= now`.
   - Reputation updates use `MAX(0, current_reputation + stake * (1 if correct else -1))`.

2. **Admin Commands**:
   - `/admin_resolve` allows manual resolution with outcome validation.
   - `/admin_event` creates/updates events with source_kind and source_ref.

3. **Event Source Handling**:
   - Events have `source_kind` (api/manual) and `source_ref` for API queries.
   - Admins can create manual events via `/admin_event`.

4. **Cancelled Duels**:
   - Admin can resolve with `cancel` outcome, refunding stakes and leaving reputation unchanged.

5. **Resolver Resilience**:
   - On restart, resolver re-scans all unresolved duels to ensure no missed resolutions.

6. **Data Model**:
   - Defined tables for users, events, duels, predictions, stakes, and leaderboard view.

7. **Reputation Floor**:
   - Reputation cannot drop below 0; negative deltas are clamped.

8. **Prediction Replacement**:
   - Users can replace predictions before deadline via atomic transaction.

9. **Deadline Race Condition**:
   - On prediction/stake submission, check `deadline > now` to prevent late entries.

10. **Timezone Handling**:
    - Deadlines stored in UTC; rendered in user's local time based on Telegram language.

11. **External Dependencies**:
    - Crypto: CoinGecko, Sports: API-Sports, Weather: OpenWeatherMap.
    - SQLite for persistence, Telegram Bot API for messaging.

12. **Non-Goals**:
    - No real-crypto staking, live scores, private challenges, or social sharing.

13. **Feature Traceability**:
    - All General features mapped to design sections (see traceability table in UX Spec).