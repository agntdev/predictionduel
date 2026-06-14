import {
  getOpenDuelsPastDeadline,
  getDuelsNeedingNotification,
  markDuelNotified,
  updateLastResolverCheck,
  resolveDuel,
  type ResolvableDuel,
} from "./db/resolver.js";
import { bot } from "./bot.js";

const TICK_INTERVAL_MS = 30_000;

function determineOutcome(_duel: ResolvableDuel): string | null {
  return null;
}

async function sendUnresolvedNotifications(): Promise<void> {
  const adminTgIdStr = process.env.ADMIN_TG_ID;
  const adminTgId = adminTgIdStr ? Number(adminTgIdStr) : null;

  const duels = getDuelsNeedingNotification();

  for (const duel of duels) {
    const msg =
      `⚠️ Duel #${duel.duel_id} "${duel.duel_title}" has been unresolved ` +
      `for over 1 hour (deadline: ${duel.deadline}).`;

    if (adminTgId && !isNaN(adminTgId)) {
      try {
        await bot.api.sendMessage(adminTgId, msg);
      } catch (err) {
        console.error(`Resolver: Failed to notify admin about duel #${duel.duel_id}:`, err);
      }
    }

    try {
      await bot.api.sendMessage(duel.creator_tg_id, msg);
    } catch (err) {
      console.error(`Resolver: Failed to notify creator ${duel.creator_tg_id} about duel #${duel.duel_id}:`, err);
    }

    markDuelNotified(duel.duel_id);
    console.log(`Resolver: Sent 1-hour unresolved notification for duel #${duel.duel_id}`);
  }
}

async function tick(): Promise<void> {
  try {
    await sendUnresolvedNotifications();

    const duels = getOpenDuelsPastDeadline();

    for (const duel of duels) {
      try {
        const outcome = determineOutcome(duel);
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
