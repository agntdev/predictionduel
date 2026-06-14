import { getDb } from "./index.js";

export interface EventRow {
  id: number;
  name: string;
  type: string;
  source_kind: "api" | "manual";
  source_ref: string | null;
  event_at: string | null;
  last_resolver_check: string | null;
}

export function insertEvent(
  name: string,
  type: string,
  sourceKind: "api" | "manual",
  sourceRef: string | null
): number {
  const db = getDb();
  const info = db
    .prepare(
      "INSERT INTO events (name, type, source_kind, source_ref) VALUES (?, ?, ?, ?)"
    )
    .run(name, type, sourceKind, sourceRef);
  return Number(info.lastInsertRowid);
}

export function getEventById(id: number): EventRow | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM events WHERE id = ?")
    .get(id) as EventRow | undefined;
}
