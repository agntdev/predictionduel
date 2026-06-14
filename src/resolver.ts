import {
  getOpenDuelsPastDeadline,
  updateLastResolverCheck,
  resolveDuel,
  type ResolvableDuel,
} from "./db/resolver.js";
import { resolveEventOutcome } from "./external/index.js";

const TICK_INTERVAL_MS = 30_000;

async function determineOutcome(duel: ResolvableDuel): Promise<string | null> {
  if (duel.source_kind !== "api" || !duel.source_ref) return null;
  return resolveEventOutcome(duel.event_type, duel.source_ref);
}

async function tick(): Promise<void> {
  try {
    const duels = getOpenDuelsPastDeadline();

    for (const duel of duels) {
      try {
        const outcome = await determineOutcome(duel);
        if (outcome !== null) {
          resolveDuel(duel.duel_id, outcome);
          console.log(
            `Resolver: Duel #${duel.duel_id} "${duel.duel_title}" resolved with outcome: ${outcome}`
          );
        }
        updateLastResolverCheck(duel.event_id);
      } catch (err) {
        console.error(`Resolver: Error processing duel #${duel.duel_id}:`, err);
      }
    }
  } catch (err) {
    console.error("Resolver tick error:", err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startResolver(): void {
  if (intervalId !== null) return;
  console.log(`Resolver job started (tick interval: ${TICK_INTERVAL_MS}ms)`);
  tick();
  intervalId = setInterval(tick, TICK_INTERVAL_MS);
}

export function stopResolver(): void {
  if (intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
  console.log("Resolver job stopped");
}
