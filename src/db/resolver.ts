import { getDb } from "./index.js";

export interface ResolvableDuel {
  duel_id: number;
  duel_title: string;
  creator_tg_id: number;
  event_id: number;
  event_name: string;
  event_type: string;
  source_kind: string;
  source_ref: string | null;
  last_resolver_check: string | null;
  possible_outcomes: string | null;
}

export interface UnresolvedDuel {
  duel_id: number;
  duel_title: string;
  creator_tg_id: number;
  deadline: string;
}

export function getOpenDuelsPastDeadline(): ResolvableDuel[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT
        d.id                 AS duel_id,
        d.title              AS duel_title,
        d.creator_tg_id      AS creator_tg_id,
        e.id                 AS event_id,
        e.name               AS event_name,
        e.type               AS event_type,
        e.source_kind        AS source_kind,
        e.source_ref         AS source_ref,
        e.last_resolver_check AS last_resolver_check,
        d.possible_outcomes  AS possible_outcomes
      FROM duels d
      JOIN events e ON e.id = d.event_id
      WHERE d.status = 'open'
        AND d.deadline < datetime('now')
      ORDER BY d.deadline ASC`
    )
    .all() as ResolvableDuel[];
}

export function updateLastResolverCheck(eventId: number): void {
  const db = getDb();
  db.prepare(
    "UPDATE events SET last_resolver_check = datetime('now') WHERE id = ?"
  ).run(eventId);
}

export function resolveDuel(duelId: number, outcome: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE duels SET status = 'resolved', outcome = ?, resolved_at = datetime('now') WHERE id = ?"
  ).run(outcome, duelId);
}

export function getDuelsNeedingNotification(): UnresolvedDuel[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT
        id          AS duel_id,
        title       AS duel_title,
        creator_tg_id,
        deadline
      FROM duels
      WHERE status = 'open'
        AND deadline < datetime('now', '-1 hour')
        AND notification_sent_at IS NULL
      ORDER BY deadline ASC`
    )
    .all() as UnresolvedDuel[];
}

export function markDuelNotified(duelId: number): void {
  const db = getDb();
  db.prepare(
    "UPDATE duels SET notification_sent_at = datetime('now') WHERE id = ?"
  ).run(duelId);
}
