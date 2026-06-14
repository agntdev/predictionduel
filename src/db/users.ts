import { getDb } from "./index.js";

export interface UserRow {
  tg_id: number;
  name: string;
  reputation: number;
  created_at: string;
}

export function registerUser(tgId: number, name: string): UserRow {
  const db = getDb();
  const existing = db
    .prepare("SELECT tg_id, name, reputation, created_at FROM users WHERE tg_id = ?")
    .get(tgId) as UserRow | undefined;

  if (existing) {
    if (existing.name !== name) {
      db.prepare("UPDATE users SET name = ? WHERE tg_id = ?").run(name, tgId);
    }
    return existing;
  }

  db.prepare("INSERT INTO users (tg_id, name) VALUES (?, ?)").run(tgId, name);
  return {
    tg_id: tgId,
    name,
    reputation: 1000,
    created_at: new Date().toISOString(),
  };
}

export function getUserByName(name: string): UserRow | undefined {
  const db = getDb();
  return db
    .prepare("SELECT tg_id, name, reputation, created_at FROM users WHERE name = ?")
    .get(name) as UserRow | undefined;
}
