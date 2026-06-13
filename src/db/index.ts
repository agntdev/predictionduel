import fs from 'fs';
import path from 'path';
import initSqlJs, { type Database } from 'sql.js';
import type { Duel, Event, Prediction, Stake, DuelStatus, SourceKind, EventType } from '../types';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  tg_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  reputation INTEGER NOT NULL DEFAULT 1000,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('crypto','sports','game','weather','other')),
  source_kind TEXT NOT NULL CHECK(source_kind IN ('api','manual')),
  source_ref TEXT,
  event_at TEXT,
  last_resolver_check TEXT,
  failed_checks INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS duels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_tg_id INTEGER NOT NULL REFERENCES users(tg_id),
  event_id INTEGER NOT NULL REFERENCES events(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','cancelled')),
  outcome TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  duel_id INTEGER NOT NULL REFERENCES duels(id),
  user_tg_id INTEGER NOT NULL REFERENCES users(tg_id),
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(duel_id, user_tg_id)
);

CREATE TABLE IF NOT EXISTS stakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prediction_id INTEGER NOT NULL REFERENCES predictions(id),
  amount INTEGER NOT NULL CHECK(amount >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_duels_status_deadline ON duels(status, deadline);
CREATE INDEX IF NOT EXISTS idx_predictions_duel_id ON predictions(duel_id);
CREATE INDEX IF NOT EXISTS idx_stakes_prediction_id ON stakes(prediction_id);
`;

export interface Statement {
  all(...params: any[]): Record<string, any>[];
  get(...params: any[]): Record<string, any> | undefined;
  run(...params: any[]): void;
  finalize(): void;
}

export class DatabaseSync {
  private db: Database;
  private filePath: string;
  private statements: Map<string, sqljsStatement> = new Map();

  constructor(sqliteDb: Database, filePath: string) {
    this.db = sqliteDb;
    this.filePath = filePath;
  }

  prepare(sql: string): Statement {
    let stmt = this.statements.get(sql);
    if (stmt) {
      stmt.reset();
      return stmt;
    }
    stmt = new sqljsStatement(this.db, sql);
    this.statements.set(sql, stmt);
    return stmt;
  }

  exec(sql: string): void {
    this.db.run(sql);
    this.persist();
  }

  transaction<T>(fn: () => T): T {
    this.db.run('BEGIN');
    try {
      const result = fn();
      this.db.run('COMMIT');
      this.persist();
      return result;
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
  }

  persist(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = this.db.export();
    fs.writeFileSync(this.filePath, Buffer.from(data));
  }

  close(): void {
    this.statements.forEach((s) => s.free());
    this.statements.clear();
    this.db.close();
  }
}

class sqljsStatement implements Statement {
  private stmt: ReturnType<Database['prepare']>;

  constructor(db: Database, sql: string) {
    this.stmt = db.prepare(sql);
  }

  all(...params: any[]): Record<string, any>[] {
    if (params.length > 0) this.stmt.bind(params);
    const rows: Record<string, any>[] = [];
    while (this.stmt.step()) {
      rows.push(this.stmt.getAsObject());
    }
    this.stmt.reset();
    this.stmt.freemem();
    return rows;
  }

  get(...params: any[]): Record<string, any> | undefined {
    if (params.length > 0) this.stmt.bind(params);
    if (this.stmt.step()) {
      const row = this.stmt.getAsObject();
      this.stmt.reset();
      this.stmt.freemem();
      return row;
    }
    this.stmt.reset();
    this.stmt.freemem();
    return undefined;
  }

  run(...params: any[]): void {
    if (params.length > 0) this.stmt.bind(params);
    this.stmt.step();
    this.stmt.reset();
    this.stmt.freemem();
  }

  reset(): void {
    this.stmt.reset();
    this.stmt.freemem();
  }

  finalize(): void {
    this.free();
  }

  free(): void {
    this.stmt.free();
  }
}

const SQL = initSqlJs;

export async function createDb(dbPath: string): Promise<DatabaseSync> {
  const resolved = path.resolve(dbPath);
  let buffer: Buffer | undefined;

  if (fs.existsSync(resolved)) {
    buffer = fs.readFileSync(resolved);
  }

  const sqlModule = await SQL();
  const db = new sqlModule.Database(buffer);
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode = WAL');
  db.run(SCHEMA_SQL);

  const wrapper = new DatabaseSync(db, resolved);
  wrapper.persist();
  return wrapper;
}

export function findOpenDuelsPastDeadline(
  db: DatabaseSync
): (Duel & { event: Event })[] {
  const stmt = db.prepare(`
    SELECT d.*, e.id as eid, e.name as ename, e.type as etype,
           e.source_kind as esource_kind, e.source_ref as esource_ref,
           e.event_at as eevent_at, e.last_resolver_check as elast_resolver_check,
           e.failed_checks as efailed_checks, e.created_at as ecreated_at
    FROM duels d
    JOIN events e ON d.event_id = e.id
    WHERE d.status = 'open' AND d.deadline <= datetime('now')
  `);
  const rows = stmt.all();
  return rows.map((r: any) => ({
    id: r.id,
    creator_tg_id: r.creator_tg_id,
    event_id: r.event_id,
    title: r.title,
    description: r.description,
    deadline: r.deadline,
    status: r.status as DuelStatus,
    outcome: r.outcome ?? null,
    resolved_at: r.resolved_at ?? null,
    created_at: r.created_at,
    event: {
      id: r.eid,
      name: r.ename,
      type: r.etype as EventType,
      source_kind: r.esource_kind as SourceKind,
      source_ref: r.esource_ref ?? null,
      event_at: r.eevent_at ?? null,
      last_resolver_check: r.elast_resolver_check ?? null,
      failed_checks: r.efailed_checks ?? 0,
      created_at: r.ecreated_at,
    },
  }));
}

export function findPredictionsForDuel(
  db: DatabaseSync,
  duelId: number
): (Prediction & { stake: Stake | null })[] {
  const rows = db.prepare(`
    SELECT p.*, s.id as sid, s.amount as samount, s.created_at as screated_at
    FROM predictions p
    LEFT JOIN stakes s ON s.prediction_id = p.id
    WHERE p.duel_id = ?
  `).all(duelId);
  return rows.map((r: any) => ({
    id: r.id,
    duel_id: r.duel_id,
    user_tg_id: r.user_tg_id,
    outcome: r.outcome,
    created_at: r.created_at,
    stake: r.sid
      ? { id: r.sid, prediction_id: r.id, amount: r.samount, created_at: r.screated_at }
      : null,
  }));
}

export function resolveDuel(
  db: DatabaseSync,
  duelId: number,
  outcome: string
): void {
  db.prepare(`
    UPDATE duels SET status = 'resolved', outcome = ?, resolved_at = datetime('now')
    WHERE id = ?
  `).run(outcome, duelId);
}

export function cancelDuel(
  db: DatabaseSync,
  duelId: number
): void {
  db.prepare(`
    UPDATE duels SET status = 'cancelled', resolved_at = datetime('now')
    WHERE id = ?
  `).run(duelId);
}

export function updateReputation(
  db: DatabaseSync,
  userId: number,
  delta: number
): number {
  db.prepare(
    'UPDATE users SET reputation = MAX(0, reputation + ?) WHERE tg_id = ?'
  ).run(delta, userId);
  const row = db.prepare(
    'SELECT reputation FROM users WHERE tg_id = ?'
  ).get(userId);
  return (row as any)?.reputation ?? 0;
}

export function updateEventCheck(
  db: DatabaseSync,
  eventId: number,
  failed: boolean
): void {
  db.prepare(`
    UPDATE events SET
      last_resolver_check = datetime('now'),
      failed_checks = CASE WHEN ? THEN failed_checks + 1 ELSE 0 END
    WHERE id = ?
  `).run(failed ? 1 : 0, eventId);
}

export function getDuelEventId(
  db: DatabaseSync,
  duelId: number
): number | undefined {
  const row = db.prepare('SELECT event_id FROM duels WHERE id = ?').get(duelId);
  return (row as any)?.event_id ?? undefined;
}
