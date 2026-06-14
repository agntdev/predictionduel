import { getDb } from "./index.js";

export interface DuelRow {
  id: number;
  creator_tg_id: number;
  event_id: number | null;
  title: string;
  description: string | null;
  deadline: string;
  status: string;
  outcome: string | null;
  resolved_at: string | null;
}

export interface DuelListItem {
  id: number;
  creator_tg_id: number;
  creator_name: string;
  event_id: number | null;
  event_name: string | null;
  event_type: string | null;
  title: string;
  description: string | null;
  deadline: string;
  status: string;
  prediction_count: number;
}

export function listDuelById(id: number): DuelRow | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM duels WHERE id = ?")
    .get(id) as DuelRow | undefined;
}

export function listOpenDuels(filterType?: string, page = 0, pageSize = 10): DuelListItem[] {
  const db = getDb();

  const hasFilter = typeof filterType === "string" && filterType.length > 0;
  const whereClause = hasFilter
    ? "WHERE d.status = 'open' AND e.type = ?"
    : "WHERE d.status = 'open'";

  const sql = `
    SELECT
      d.id,
      d.creator_tg_id,
      d.event_id,
      d.title,
      d.description,
      d.deadline,
      d.status,
      u.name AS creator_name,
      e.name AS event_name,
      e.type AS event_type,
      COUNT(p.id) AS prediction_count
    FROM duels d
    LEFT JOIN events e ON d.event_id = e.id
    LEFT JOIN users u ON d.creator_tg_id = u.tg_id
    LEFT JOIN predictions p ON p.duel_id = d.id
    ${whereClause}
    GROUP BY d.id
    ORDER BY d.deadline ASC
    LIMIT ? OFFSET ?
  `;

  const params = hasFilter
    ? [filterType, pageSize, page * pageSize]
    : [pageSize, page * pageSize];

  return db.prepare(sql).all(...params) as DuelListItem[];
}

export function countOpenDuels(filterType?: string): number {
  const db = getDb();

  const hasFilter = typeof filterType === "string" && filterType.length > 0;
  const whereClause = hasFilter
    ? "WHERE d.status = 'open' AND e.type = ?"
    : "WHERE d.status = 'open'";

  const sql = `
    SELECT COUNT(*) AS cnt
    FROM duels d
    LEFT JOIN events e ON d.event_id = e.id
    ${whereClause}
  `;

  const params = hasFilter ? [filterType] : [];
  const row = db.prepare(sql).get(...params) as { cnt: number };
  return row.cnt;
}
