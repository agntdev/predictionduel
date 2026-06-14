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
  possible_outcomes: string | null;
}

export interface PredictionRow {
  id: number;
  duel_id: number;
  user_tg_id: number;
  outcome: string;
  created_at: string;
}

export interface StakeRow {
  id: number;
  prediction_id: number;
  amount: number;
  created_at: string;
}

export function getDuelById(duelId: number): DuelRow | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM duels WHERE id = ?")
    .get(duelId) as DuelRow | undefined;
}

export function getPrediction(duelId: number, userTgId: number): PredictionRow | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM predictions WHERE duel_id = ? AND user_tg_id = ?")
    .get(duelId, userTgId) as PredictionRow | undefined;
}

export function getStake(predictionId: number): StakeRow | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM stakes WHERE prediction_id = ?")
    .get(predictionId) as StakeRow | undefined;
}

export function replacePrediction(
  duelId: number,
  userTgId: number,
  outcome: string,
  stakeAmount: number,
): { prediction: PredictionRow; stake: StakeRow; replaced: boolean } {
  const db = getDb();

  const replaced = db.transaction(() => {
    const existing = db
      .prepare("SELECT id FROM predictions WHERE duel_id = ? AND user_tg_id = ?")
      .get(duelId, userTgId) as { id: number } | undefined;

    let result = false;
    if (existing) {
      db.prepare("DELETE FROM stakes WHERE prediction_id = ?").run(existing.id);
      db.prepare("DELETE FROM predictions WHERE id = ?").run(existing.id);
      result = true;
    }

    const info = db
      .prepare("INSERT INTO predictions (duel_id, user_tg_id, outcome) VALUES (?, ?, ?)")
      .run(duelId, userTgId, outcome);

    const predictionId = Number(info.lastInsertRowid);
    db
      .prepare("INSERT INTO stakes (prediction_id, amount) VALUES (?, ?)")
      .run(predictionId, stakeAmount);

    return result;
  })();

  const prediction = getPrediction(duelId, userTgId)!;
  const stake = getStake(prediction.id)!;

  return { prediction, stake, replaced };
}

export function parseDuelOutcomes(duel: DuelRow): string[] {
  if (!duel.possible_outcomes) return ["Yes", "No"];
  return duel.possible_outcomes.split(",").map((o) => o.trim()).filter(Boolean);
}