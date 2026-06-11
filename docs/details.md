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

### 2. New Duel Type Selection
- **Trigger**: `/newduel` or `Create a new duel` from Main Menu.
- **Message**:
  ```
  What kind of event is your duel about?
  ```
- **Keyboard**:
  ```
  [[Crypto], [Sports], [Games], [Weather], [Other]]
  ```
- **Transitions**:
  - `Crypto` → `Event Search (Crypto)`
  - `Sports` → `Event Search (Sports)`
  - `Games` → `Event Search (Games)`
  - `Weather` → `Event Search (Weather)`
  - `Other` → `Manual Event Creation`

---

### 3. Event Search (Crypto)
- **Trigger**: `Crypto` from New Duel Type Selection.
- **Message**:
  ```
  🔍 Search for a crypto event (e.g., BTC, ETH, etc.):
  ```
- **Keyboard**:
  ```
  [[Cancel]]
  ```
- **Transitions**:
  - User input → `Event Selection (Crypto)`
  - `Cancel` → `Main Menu`

---

### 4. Event Selection (Crypto)
- **Trigger**: User input from Event Search (Crypto).
- **Message**:
  ```
  Here are some crypto events matching your search:

  [Event 1] (ID: 123)
  [Event 2] (ID: 456)
  [Event 3] (ID: 789)

  Select an event or type a new one.
  ```
- **Keyboard**:
  ```
  [[Event 1], [Event 2], [Event 3], [New Event]]
  ```
- **Transitions**:
  - `Event X` → `Duel Title and Description`
  - `New Event` → `Manual Event Creation`

---

### 5. Duel Title and Description
- **Trigger**: Event selected or manually created.
- **Message**:
  ```
  📝 Enter a title for your duel (1–120 characters):
  ```
- **Keyboard**:
  ```
  [[Cancel]]
  ```
- **Transitions**:
  - User input → `Duel Description`
  - `Cancel` → `Main Menu`

---

### 6. Duel Description
- **Trigger**: Title input.
- **Message**:
  ```
  📝 Enter a description for your duel (≤ 500 characters):
  ```
- **Keyboard**:
  ```
  [[Cancel]]
  ```
- **Transitions**:
  - User input → `Duel Deadline`
  - `Cancel` → `Main Menu`

---

### 7. Duel Deadline
- **Trigger**: Description input.
- **Message**:
  ```
  ⏰ When should this duel close? (Must be before the event date.)
  Format: ISO date (e.g., 2025-04-05T14:30:00Z) or relative (e.g., in 3h)
  ```
- **Keyboard**:
  ```
  [[Cancel]]
  ```
- **Transitions**:
  - User input → `Duel Outcome Options`
  - `Cancel` → `Main Menu`

---

### 8. Duel Outcome Options
- **Trigger**: Deadline input.
- **Message**:
  ```
  🎯 What are the possible outcomes for this duel? (2–6 options, comma-separated)
  Example: yes,no or home,away,draw
  ```
- **Keyboard**:
  ```
  [[Cancel]]
  ```
- **Transitions**:
  - User input → `Duel Confirmation`
  - `Cancel` → `Main Menu`

---

### 9. Duel Confirmation
- **Trigger**: Outcome options input.
- **Message**:
  ```
  ✅ Confirm your duel:

  🎯 Title: [Title]
  📝 Description: [Description]
  📅 Deadline: [Deadline]
  🎲 Outcomes: [Outcome 1], [Outcome 2], [Outcome 3], ...

  Are you sure you want to create this duel?
  ```
- **Keyboard**:
  ```
  [[Confirm], [Cancel]]
  ```
- **Transitions**:
  - `Confirm` → `Duel Created`
  - `Cancel` → `Main Menu`

---

### 10. Duel Created
- **Trigger**: Confirmation accepted.
- **Message**:
  ```
  🎉 Duel #N created!

  Share it with others: /duel N
  ```
- **Keyboard**:
  ```
  [[Main Menu]]
  ```
- **Transitions**:
  - `Main Menu` → `Main Menu`

---

### 11. Duel List (Open)
- **Trigger**: `/duels` or `View active duels` from Main Menu.
- **Message**:
  ```
  ⚔️ Active Duels

  Filter by type:
  ```
- **Keyboard**:
  ```
  [[Crypto], [Sports], [Games], [Weather], [All]]
  ```
- **Transitions**:
  - `Crypto` → `Duel List (Crypto)`
  - `Sports` → `Duel List (Sports)`
  - `Games` → `Duel List (Games)`
  - `Weather` → `Duel List (Weather)`
  - `All` → `Duel List (All)`

---

### 12. Duel List (Crypto)
- **Trigger**: `Crypto` from Duel List (Open).
- **Message**:
  ```
  ⚔️ Active Crypto Duels

  [Duel 1] · [Title] · Closes in [Time] · [Participants]
  [Duel 2] · [Title] · Closes in [Time] · [Participants]
  ...
  ```
- **Keyboard**:
  ```
  [[Next Page], [Main Menu]]
  ```
- **Transitions**:
  - `Next Page` → `Duel List (Crypto) Page 2`
  - `Main Menu` → `Main Menu`

---

### 13. Duel Card
- **Trigger**: `Duel X` from Duel List.
- **Message**:
  ```
  ⚔️ Duel #N: [Title]

  📝 [Description]
  📅 Closes in [Time]
  🎲 Outcomes: [Outcome 1], [Outcome 2], [Outcome 3], ...
  🧑‍🤝‍🧑 Participants: [Count]

  Your pick: [Outcome] · Stake: [N] points
  ```
- **Keyboard**:
  ```
  [[🎯 Pick], [📊 Stats], [🔔 Remind me at deadline], [Main Menu]]
  ```
- **Transitions**:
  - `🎯 Pick` → `Prediction Selection`
  - `📊 Stats` → `Duel Stats`
  - `🔔 Remind me at deadline` → `Reminder Set`
  - `Main Menu` → `Main Menu`

---

### 14. Prediction Selection
- **Trigger**: `🎯 Pick` from Duel Card.
- **Message**:
  ```
  🎯 Choose your prediction:

  [Outcome 1]
  [Outcome 2]
  [Outcome 3]
  ...
  ```
- **Keyboard**:
  ```
  [[Outcome 1], [Outcome 2], [Outcome 3], [Cancel]]
  ```
- **Transitions**:
  - `Outcome X` → `Stake Selection`
  - `Cancel` → `Duel Card`

---

### 15. Stake Selection
- **Trigger**: Outcome selected.
- **Message**:
  ```
  💰 Stake your points:

  [0] [10] [25] [50] [100] [Custom]
  ```
- **Keyboard**:
  ```
  [[0], [10], [25], [50], [100], [Custom], [Cancel]]
  ```
- **Transitions**:
  - `0` → `Prediction Confirmation`
  - `10` → `Prediction Confirmation`
  - `25` → `Prediction Confirmation`
  - `50` → `Prediction Confirmation`
  - `100` → `Prediction Confirmation`
  - `Custom` → `Custom Stake Input`
  - `Cancel` → `Duel Card`

---

### 16. Custom Stake Input
- **Trigger**: `Custom` from Stake Selection.
- **Message**:
  ```
  💰 Enter a custom stake (0–10,000 points):
  ```
- **Keyboard**:
  ```
  [[Cancel]]
  ```
- **Transitions**:
  - User input → `Prediction Confirmation`
  - `Cancel` → `Stake Selection`

---

### 17. Prediction Confirmation
- **Trigger**: Stake selected.
- **Message**:
  ```
  ✅ Confirm your prediction:

  🎯 Outcome: [Outcome]
  💰 Stake: [N] points

  Are you sure?
  ```
- **Keyboard**:
  ```
  [[Confirm], [Cancel]]
  ```
- **Transitions**:
  - `Confirm` → `Prediction Locked`
  - `Cancel` → `Duel Card`

---

### 18. Prediction Locked
- **Trigger**: Prediction confirmed.
- **Message**:
  ```
  🔐 Locked in: [Outcome] for [N] points.

  Good luck!
  ```
- **Keyboard**:
  ```
  [[Main Menu]]
  ```
- **Transitions**:
  - `Main Menu` → `Main Menu`

---

### 19. My Predictions (Pending/Won/Lost)
- **Trigger**: `/mypreds` or `View your predictions` from Main Menu.
- **Message**:
  ```
  🧾 My Predictions

  🔹 Pending (N)
  🔹 Won (M)
  🔹 Lost (K)
  ```
- **Keyboard**:
  ```
  [[Pending], [Won], [Lost], [Main Menu]]
  ```
- **Transitions**:
  - `Pending` → `Pending Predictions`
  - `Won` → `Won Predictions`
  - `Lost` → `Lost Predictions`
  - `Main Menu` → `Main Menu`

---

### 20. Pending Predictions
- **Trigger**: `Pending` from My Predictions.
- **Message**:
  ```
  ⏳ Pending Predictions

  [Duel 1] · [Title] · Closes in [Time] · [Outcome] · Stake: [N]
  [Duel 2] · [Title] · Closes in [Time] · [Outcome] · Stake: [N]
  ...
  ```
- **Keyboard**:
  ```
  [[Next Page], [Main Menu]]
  ```
- **Transitions**:
  - `Next Page` → `Pending Predictions Page 2`
  - `Main Menu` → `Main Menu`

---

### 21. Duel History
- **Trigger**: `/history` or `View duel history` from Main Menu.
- **Message**:
  ```
  📜 Duel History

  [Duel 1] · [Title] · [Outcome] · [Your Pick] · [Result]
  [Duel 2] · [Title] · [Outcome] · [Your Pick] · [Result]
  ...
  ```
- **Keyboard**:
  ```
  [[Next Page], [Main Menu]]
  ```
- **Transitions**:
  - `Next Page` → `Duel History Page 2`
  - `Main Menu` → `Main Menu`

---

### 22. Leaderboard
- **Trigger**: `/leaderboard` or `View leaderboard` from Main Menu.
- **Message**:
  ```
  🏆 Leaderboard (Top 20)

  1. [Name] · 1240 (87% acc · 52 picks)
  2. [Name] · 1180 (82% acc · 45 picks)
  ...
  ```
- **Keyboard**:
  ```
  [[Next Page], [Main Menu]]
  ```
- **Transitions**:
  - `Next Page` → `Leaderboard Page 2`
  - `Main Menu` → `Main Menu`

---

### 23. Challenge Top Predictor
- **Trigger**: `/challenge` or `Challenge a top predictor` from Main Menu.
- **Message**:
  ```
  🏅 Who would you like to challenge?

  [Top Predictor 1]
  [Top Predictor 2]
  [Top Predictor 3]
  ...
  ```
- **Keyboard**:
  ```
  [[Top Predictor 1], [Top Predictor 2], [Top Predictor 3], [Cancel]]
  ```
- **Transitions**:
  - `Top Predictor X` → `Challenge Sent`
  - `Cancel` → `Main Menu`

---

### 24. Challenge Sent
- **Trigger**: Top predictor selected.
- **Message**:
  ```
  🏆 Challenge sent to [Name]!

  They'll receive a notification and can respond with /newduel.
  ```
- **Keyboard**:
  ```
  [[Main Menu]]
  ```
- **Transitions**:
  - `Main Menu` → `Main Menu`

---

### 25. User Stats
- **Trigger**: `/stats` or `View your stats` from Main Menu.
- **Message**:
  ```
  📊 Your Stats

  Total picks: N
  Correct: M
  Accuracy: P%
  Current streak: S
  Reputation: R
  Rank: #K
  ```
- **Keyboard**:
  ```
  [[Main Menu]]
  ```
- **Transitions**:
  - `Main Menu` → `Main Menu`

---

### 26. Export Predictions
- **Trigger**: `/export` or `Export your data` from Main Menu.
- **Message**:
  ```
  📤 Exporting your prediction history...

  A CSV file with your data is being generated and will be sent to you shortly.
  ```
- **Keyboard**:
  ```
  [[Main Menu]]
  ```
- **Transitions**:
  - `Main Menu` → `Main Menu`

---

## COMPONENTS

### 1. Inline Keyboard Generator
- **Purpose**: Dynamically generate inline keyboards for event selection, duel filtering, and prediction options.
- **Inputs**:
  - List of items (e.g., events, outcomes, filters).
  - Maximum items per row (default 2).
- **Output**: Telegram inline keyboard with buttons for each item.

### 2. Duel Card Renderer
- **Purpose**: Render a consistent duel card with title, description, deadline, outcome options, and user pick.
- **Inputs**:
  - Duel ID, title, description, deadline, outcome options, user pick.
- **Output**: Formatted message with duel details and inline actions.

### 3. Prediction Confirmation Dialog
- **Purpose**: Confirm a user's prediction and stake before locking it in.
- **Inputs**:
  - Outcome, stake amount.
- **Output**: Confirmation message with inline buttons for confirmation or cancellation.

### 4. Leaderboard Paginator
- **Purpose**: Paginate the leaderboard to show top 20 users per page.
- **Inputs**:
  - Current page number, total users.
- **Output**: Formatted leaderboard with pagination controls.

### 5. Duel List Paginator
- **Purpose**: Paginate the list of active duels.
- **Inputs**:
  - Current page number, total duels.
- **Output**: Formatted duel list with pagination controls.

### 6. Reminder Scheduler
- **Purpose**: Schedule a reminder for the user when a duel's deadline is approaching.
- **Inputs**:
  - Duel ID, user ID, deadline.
- **Output**: Scheduled message to the user at the deadline.

---

## TRANSITIONS

| State | Input | Next State | Side Effects |
| --- | --- | --- | --- |
| `Main Menu` | `/newduel` | `New Duel Type Selection` | None |
| `New Duel Type Selection` | `Crypto` | `Event Search (Crypto)` | None |
| `Event Search (Crypto)` | User input | `Event Selection (Crypto)` | Query crypto API for events |
| `Event Selection (Crypto)` | `Event X` | `Duel Title and Description` | Select event |
| `Duel Title and Description` | User input | `Duel Description` | Store title |
| `Duel Description` | User input | `Duel Deadline` | Store description |
| `Duel Deadline` | User input | `Duel Outcome Options` | Store deadline |
| `Duel Outcome Options` | User input | `Duel Confirmation` | Store outcomes |
| `Duel Confirmation` | `Confirm` | `Duel Created` | Insert duel into DB |
| `Main Menu` | `/duels` | `Duel List (Open)` | None |
| `Duel List (Open)` | `Crypto` | `Duel List (Crypto)` | None |
| `Duel List (Crypto)` | `Duel X` | `Duel Card` | None |
| `Duel Card` | `🎯 Pick` | `Prediction Selection` | None |
| `Prediction Selection` | `Outcome X` | `Stake Selection` | None |
| `Stake Selection` | `Custom` | `Custom Stake Input` | None |
| `Custom Stake Input` | User input | `Prediction Confirmation` | Store stake |
| `Prediction Confirmation` | `Confirm` | `Prediction Locked` | Insert prediction and stake into DB |
| `Main Menu` | `/mypreds` | `My Predictions (Pending/Won/Lost)` | None |
| `My Predictions (Pending