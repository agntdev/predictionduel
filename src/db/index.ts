import Database from "better-sqlite3";
import { ALL_SCHEMA_SQL } from "./schema.js";

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
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = undefined;
  }
}
