# DETAILS Design Document: PredictionDuel Bot

## SCREENS

### 1. New Duel Type Selection
- **Trigger**: `Create a new duel` from Main Menu.
- **Message**:
  ```
  🎯 Choose an event type for your duel:
  ```
- **Keyboard**:
  ```
  [[Crypto], [Sports], [Games], [Weather], [Other]]
  ```
- **Transitions**:
  - `Crypto` → `New Duel Search Term (Crypto)`
  - `Sports` → `New Duel Search Term (Sports)`
  - `Games` → `New Duel Search Term (Games)`
  - `Weather` → `New Duel Search Term (Weather)`
  - `Other` → `New Duel Manual Event`

---

### 2. New Duel Search Term (Crypto)
- **Trigger**: `Crypto` from New Duel Type Selection.
- **Message**:
  ```
  🔍 Enter a crypto symbol (e.g., BTC, ETH) to find an event:
  ```
- **Keyboard**:
  ```
  [[Cancel]]
  ```
- **Transitions**:
  - User input → `New Duel Event Selection (Crypto)`

---

### 3. New Duel Event Selection (Crypto)
- **Trigger**: Valid crypto symbol input.
- **Message**:
  ```
  📈 Found events for BTC:
  - BTC/USD price > $50,000 by 2024-01-01
  - BTC/USD price < $40,000 by 2024-01-01
  ```
- **Keyboard**:
  ```
  [[Select Event 1], [Select Event 2], [Cancel]]
  ```
- **Transitions**:
  - `Select Event 1` → `New Duel Title Input`
  - `Cancel` → `Main Menu`

---

### 4. New Duel Title Input
- **Trigger**: Event selected.
- **Message**:
  ```
  📝 Enter title (1-120 chars) and description (≤500 chars):
  ```
- **Keyboard**:
  ```
  [[Cancel]]
  ```
- **Transitions**:
  - User input → `New Duel Deadline Input`

---

### 5. New Duel Deadline Input
- **Trigger**: Title/description input.
- **Message**:
  ```
  ⏰ Set deadline (must be before event date and not in the past):
  ```
- **Keyboard**:
  ```
  [[Cancel]]
  ```
- **Transitions**:
  - Valid future deadline → `New Duel Outcome Options Input`
  - Deadline in past → `New Duel Deadline Error`

---

### 6. New Duel Deadline Error
- **Trigger**: Deadline in past.
- **Message**:
  ```
  ⚠️ Deadline cannot be in the past. Please set a valid deadline:
  ```
- **Keyboard**:
  ```
  [[Cancel]]
  ```
- **Transitions**:
  - Valid future deadline → `New Duel Outcome Options Input`

---

### 7. New Duel Outcome Options Input
- **Trigger**: Valid deadline.
- **Message**:
  ```
  🎲 Enter outcome options (2-6, comma-separated):
  ```
- **Keyboard**:
  ```
  [[Cancel]]
  ```
- **Transitions**:
  - User input → `New Duel Confirmation`

---

### 8. New Duel Confirmation
- **Trigger**: Outcome options input.
- **Message**:
  ```
  ✅ Confirm your duel:
  - Title: [Title]
  - Description: [Description]
  - Event: [Event Name]
  - Deadline: [Deadline]
  - Outcomes: [Outcomes]
  ```
- **Keyboard**:
  ```
  [[Confirm], [Cancel]]
  ```
- **Transitions**:
  - `Confirm` → `Duel Created`
  - `Cancel` → `Main Menu`

---

### 9. Challenge Top Predictor
- **Trigger**: `/challenge <user>` or button from Leaderboard.
- **Message**:
  ```
  🏆 [Name] challenged you to a duel! Use /newduel to create one.
  ```
- **Keyboard**:
  ```
  [[Accept Challenge], [Decline]]
  ```
- **Transitions**:
  - `Accept Challenge` → `New Duel Type Selection`
  - `Decline` → `Main Menu`

---

### 10. Export Predictions
- **Trigger**: `/export` from Main Menu.
- **Message**:
  ```
  📤 Exporting your prediction history to CSV. One moment...
  ```
- **Side Effects**:
  - Generate CSV with headers: `duel_id,title,event_type,deadline,picked,stake,result,reputation_delta,resolved_at`
  - Send CSV as DM attachment.

---

## COMPONENTS

### 4. Admin Notification on Unresolved Events
- **Purpose**: Notify admin and creator when event can't be resolved.
- **Logic**:
  - After 1 hour of unresolved status, send:
    - To admin: `⚠️ Unresolved duel #N requires manual resolution`
    - To creator: `⚠️ Your duel #N hasn't resolved yet. An admin will handle it soon.`

---

## TRANSITIONS

| State | Input | Next State | Side Effects |
| --- | --- | --- | --- |
| `New Duel Deadline Input` | Past deadline | `New Duel Deadline Error` | Show error |
| `New Duel Deadline Error` | Future deadline | `New Duel Outcome Options Input` | Proceed |
| `Admin Notification Component` | 1h unresolved | Auto | Send admin/creator notifications |
| `Challenge Top Predictor` | `Accept Challenge` | `New Duel Type Selection` | Start challenge flow |
| `Export Predictions` | `/export` | Auto | Generate and send CSV |

---

## DATA

### 7. Events Table (Extended)
```sql
ALTER TABLE events ADD COLUMN last_resolver_check DATETIME;
```

---

## ACCEPTANCE NOTES

1. **/newduel Flow**:
   - 7-step process: type → search → title/description → deadline (with past validation) → outcomes → confirmation → creation.

2. **Deadline Validation**:
   - Reject deadlines in the past with clear error and retry prompt.

3. **Unresolved Event Handling**:
   - After 1 hour of unresolved status, admin and creator notified via DM.

4. **/challenge Command**:
   - Sends challenge message with "Accept Challenge" button to target user.

5. **/export Command**:
   - CSV format includes all specified fields, sent as DM attachment with user's data only.