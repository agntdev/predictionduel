export type ChatState =
  | "idle"
  | "new_duel_type"
  | "new_duel_search_term"
  | "new_duel_event_selection"
  | "new_duel_title"
  | "new_duel_deadline"
  | "new_duel_outcomes"
  | "new_duel_confirming"
  | "predict_pick"
  | "predict_stake"
  | "predict_confirming"
  | "challenge_pending";

export interface NewDuelFlow {
  eventType: string;
  searchTerm: string;
  eventId: number | null;
  eventName: string;
  title: string;
  description: string;
  deadline: string;
  outcomes: string[];
}

export interface PredictFlow {
  duelId: number;
  predictedOutcome: string;
  stake: number;
}

export interface ChallengeFlow {
  challengerTgId: number;
  challengerName: string;
  targetTgId: number;
  targetName: string;
  duelId: number;
}

export interface ChatContext {
  state: ChatState;
  newDuel: Partial<NewDuelFlow>;
  predict: Partial<PredictFlow>;
  challenge: Partial<ChallengeFlow>;
  lastMessageId: number | null;
}

const chatStates = new Map<number, ChatContext>();

function emptyContext(): ChatContext {
  return {
    state: "idle",
    newDuel: {},
    predict: {},
    challenge: {},
    lastMessageId: null,
  };
}

export function getState(chatId: number): ChatContext {
  let ctx = chatStates.get(chatId);
  if (!ctx) {
    ctx = emptyContext();
    chatStates.set(chatId, ctx);
  }
  return ctx;
}

export function setState(chatId: number, ctx: ChatContext): void {
  chatStates.set(chatId, ctx);
}

export function resetState(chatId: number): ChatContext {
  const ctx = emptyContext();
  chatStates.set(chatId, ctx);
  return ctx;
}

export function updateState(chatId: number, patch: Partial<ChatContext>): ChatContext {
  const current = getState(chatId);
  const updated: ChatContext = {
    state: patch.state ?? current.state,
    newDuel: { ...current.newDuel, ...(patch.newDuel ?? {}) },
    predict: { ...current.predict, ...(patch.predict ?? {}) },
    challenge: { ...current.challenge, ...(patch.challenge ?? {}) },
    lastMessageId: patch.lastMessageId ?? current.lastMessageId,
  };
  chatStates.set(chatId, updated);
  return updated;
}

export function transition(
  chatId: number,
  state: ChatState,
  data?: Partial<Pick<ChatContext, "newDuel" | "predict" | "challenge" | "lastMessageId">>,
): ChatContext {
  return updateState(chatId, { state, ...(data ?? {}) });
}

export function clearChat(chatId: number): void {
  chatStates.delete(chatId);
}

export function isIdle(chatId: number): boolean {
  return getState(chatId).state === "idle";
}
