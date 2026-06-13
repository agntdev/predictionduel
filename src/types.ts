import type { Api } from "grammy";

export type DuelStatus = "open" | "resolved" | "cancelled";
export type EventType = "crypto" | "sports" | "game" | "weather" | "other";
export type SourceKind = "api" | "manual";

export interface User {
  tg_id: number;
  name: string;
  reputation: number;
  created_at: string;
}

export interface Event {
  id: number;
  name: string;
  type: EventType;
  source_kind: SourceKind;
  source_ref: string | null;
  event_at: string | null;
  last_resolver_check: string | null;
  failed_checks: number;
  created_at: string;
}

export interface Duel {
  id: number;
  creator_tg_id: number;
  event_id: number;
  title: string;
  description: string;
  deadline: string;
  status: DuelStatus;
  outcome: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface Prediction {
  id: number;
  duel_id: number;
  user_tg_id: number;
  outcome: string;
  created_at: string;
}

export interface Stake {
  id: number;
  prediction_id: number;
  amount: number;
  created_at: string;
}

export interface ResolutionResult {
  duelId: number;
  outcome: string;
  winners: { user_tg_id: number; stake: number; reputationDelta: number }[];
  losers: { user_tg_id: number; stake: number; reputationDelta: number }[];
}

export interface ResolverConfig {
  tickIntervalMs: number;
  maxFailedChecks: number;
  dbPath: string;
}

export interface EventSourceResolver {
  (event: Event): Promise<string | null>;
}

export type BotAPI = Api;
