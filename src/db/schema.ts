export const CREATE_USERS = `CREATE TABLE IF NOT EXISTS users (
  tg_id       INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  reputation  INTEGER NOT NULL DEFAULT 1000,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
)`;

export const CREATE_EVENTS = `CREATE TABLE IF NOT EXISTS events (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  name                 TEXT    NOT NULL,
  type                 TEXT    NOT NULL CHECK(type IN ('crypto', 'sports', 'game', 'weather', 'other')),
  source_kind          TEXT    NOT NULL CHECK(source_kind IN ('api', 'manual')),
  source_ref           TEXT,
  event_at             TEXT,
  last_resolver_check  TEXT
)`;

export const CREATE_DUELS = `CREATE TABLE IF NOT EXISTS duels (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_tg_id  INTEGER NOT NULL REFERENCES users(tg_id),
  event_id       INTEGER REFERENCES events(id),
  title          TEXT    NOT NULL,
  description    TEXT,
  deadline       TEXT    NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'cancelled')),
  outcome        TEXT,
  resolved_at    TEXT
)`;

export const CREATE_PREDICTIONS = `CREATE TABLE IF NOT EXISTS predictions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  duel_id     INTEGER NOT NULL REFERENCES duels(id),
  user_tg_id  INTEGER NOT NULL REFERENCES users(tg_id),
  outcome     TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(duel_id, user_tg_id)
)`;

export const CREATE_STAKES = `CREATE TABLE IF NOT EXISTS stakes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  prediction_id   INTEGER NOT NULL REFERENCES predictions(id),
  amount          INTEGER NOT NULL CHECK(amount >= 0),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
)`;

export const DROP_LEADERBOARD_VIEW = `DROP VIEW IF EXISTS v_leaderboard`;

export const CREATE_LEADERBOARD_VIEW = `CREATE VIEW v_leaderboard AS
SELECT
  tg_id          AS user_tg_id,
  name           AS display_name,
  reputation,
  RANK() OVER (ORDER BY reputation DESC) AS rank
FROM users`;

export const ALL_SCHEMA_SQL = [
  CREATE_USERS,
  CREATE_EVENTS,
  CREATE_DUELS,
  CREATE_PREDICTIONS,
  CREATE_STAKES,
  DROP_LEADERBOARD_VIEW,
  CREATE_LEADERBOARD_VIEW,
] as const;
