import type { BotAPI, ResolverConfig } from "../types";
import type { DatabaseSync } from "../db/index";
import {
  findOpenDuelsPastDeadline,
  findPredictionsForDuel,
  resolveDuel,
  updateReputation,
  updateEventCheck,
  getDuelEventId,
} from "../db/index";
import { resolveEventOutcome } from "../services/event-sources";

const DEFAULT_CONFIG: ResolverConfig = {
  tickIntervalMs: 60_000,
  maxFailedChecks: 60,
  dbPath: "data/predictionduel.db",
};

export function createResolver(
  db: DatabaseSync,
  bot: BotAPI,
  config: Partial<ResolverConfig> = {}
) {
  const resolvedConfig: ResolverConfig = { ...DEFAULT_CONFIG, ...config };
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  async function tick(): Promise<void> {
    if (running) return;
    running = true;
    try {
      const duels = findOpenDuelsPastDeadline(db);
      for (const duel of duels) {
        await processDuel(duel);
      }
    } finally {
      running = false;
    }
  }

  async function processDuel(
    duel: Awaited<ReturnType<typeof findOpenDuelsPastDeadline>>[number]
  ): Promise<void> {
    const event = duel.event;

    if (event.failed_checks >= resolvedConfig.maxFailedChecks) {
      return;
    }

    if (event.source_kind === "manual") {
      return;
    }

    const outcome = await resolveEventOutcome(event);

    if (outcome === null) {
      updateEventCheck(db, event.id, true);

      if (event.failed_checks + 1 >= resolvedConfig.maxFailedChecks) {
        try {
          await bot.sendMessage(
            duel.creator_tg_id,
            `Your duel \"${duel.title}\" (#${duel.id}) could not be auto-resolved after ${resolvedConfig.maxFailedChecks} attempts. An admin will handle it.`
          );
        } catch {
          // user may have blocked the bot
        }
      }
      return;
    }

    runResolution(db, bot, duel.id, outcome, duel);
  }

  function start(): void {
    if (timer) return;
    timer = setInterval(tick, resolvedConfig.tickIntervalMs);
    // run first tick after a short delay to let everything initialize
    setTimeout(tick, 5_000);
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { start, stop, tick };
}

function runResolution(
  db: DatabaseSync,
  bot: BotAPI,
  duelId: number,
  outcome: string,
  duel: { title: string; creator_tg_id: number }
): void {
  const predictions = findPredictionsForDuel(db, duelId);
  const eventId = getDuelEventId(db, duelId);

  db.transaction(() => {
    resolveDuel(db, duelId, outcome);
    if (eventId != null) updateEventCheck(db, eventId, false);

    for (const pred of predictions) {
      const stakeAmount = pred.stake?.amount ?? 0;
      const isWinner = pred.outcome === outcome;
      const delta = isWinner ? stakeAmount : -stakeAmount;
      const newReputation = updateReputation(db, pred.user_tg_id, delta);

      const deltaStr = isWinner ? `+${stakeAmount}` : `${delta}`;
      const statusLabel = isWinner ? "Right" : "Wrong";
      bot
        .sendMessage(
          pred.user_tg_id,
          `${statusLabel}: ${deltaStr} pts. New reputation: ${newReputation}. Duel: "${duel.title}" (#${duelId})`
        )
        .catch(() => {
          // user may have blocked the bot
        });
    }
  });
}

export type Resolver = ReturnType<typeof createResolver>;
