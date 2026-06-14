import { getDb } from "./index.js";

export interface DuelListItem {
  duel_id: number;
  duel_title: string;
  duel_deadline: string;
  event_type: string | null;
  prediction_count: number;
}

export function listOpenDuels(
  eventType: string | null,
  limit: number,
  offset: number,
): DuelListItem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT
        d.id          AS duel_id,
        d.title       AS duel_title,
        d.deadline    AS duel_deadline,
        e.type        AS event_type,
        (SELECT COUNT(*) FROM predictions WHERE duel_id = d.id) AS prediction_count
      FROM duels d
      LEFT JOIN events e ON e.id = d.event_id
      WHERE d.status = 'open'
        AND d.deadline > datetime('now')
        AND (@eventType IS NULL OR e.type = @eventType)
      ORDER BY d.deadline ASC
      LIMIT @limit OFFSET @offset`,
    )
    .all({ eventType, limit, offset }) as DuelListItem[];
}

export function countOpenDuels(eventType: string | null): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total
      FROM duels d
      LEFT JOIN events e ON e.id = d.event_id
      WHERE d.status = 'open'
        AND d.deadline > datetime('now')
        AND (@eventType IS NULL OR e.type = @eventType)`,
    )
    .get({ eventType }) as { total: number };
  return row.total;
}