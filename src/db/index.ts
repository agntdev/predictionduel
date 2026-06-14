import Database from "better-sqlite3";
import { ALL_SCHEMA_SQL, MIGRATE_DUELS_NOTIFICATION } from "./schema.js";

let _db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database("predictionduel.db");
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
  }
  return _db;
}

export function initSchema(db: Database.Database = getDb()): void {
  db.transaction(() => {
    for (const sql of ALL_SCHEMA_SQL) {
      db.exec(sql);
    }
  })();

  try {
    db.exec(MIGRATE_DUELS_NOTIFICATION);
  } catch {
    // column already exists — migration already applied
  }
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = undefined;
  }
}
