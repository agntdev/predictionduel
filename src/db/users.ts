import { getDb } from "./index.js";

export interface UserRow {
  tg_id: number;
  name: string;
  reputation: number;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  reputation: number;
}

export function getLeaderboard(limit: number = 10): LeaderboardEntry[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT rank, display_name, reputation FROM v_leaderboard ORDER BY rank LIMIT ?")
    .all(limit) as { rank: number; display_name: string; reputation: number }[];

  return rows.map((r) => ({
    rank: r.rank,
    name: r.display_name,
    reputation: Math.max(r.reputation, 0),
  }));
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
