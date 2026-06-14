import { Bot, type Context, InlineKeyboard } from "grammy";
import { registerUser } from "./db/users.js";
import {
  getDuelById,
  parseDuelOutcomes,
  replacePrediction,
} from "./db/predictions.js";
import { getState, resetState, transition } from "./state.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN environment variable is not set");
}

export const bot = new Bot(token);

bot.command("start", async (ctx: Context) => {
  const tgId = ctx.from?.id;
  const name = ctx.from?.first_name ?? "Unknown";
  if (!tgId) {
    await ctx.reply("Could not identify your Telegram account. Please try again.");
    return;
  }

  const user = registerUser(tgId, name);
  await ctx.reply(
    `Welcome to PredictionDuel, ${user.name}!\n\n` +
    `Your reputation: ${user.reputation} points. Use /help to see available commands.`,
  );
});

bot.command("help", async (ctx: Context) => {
  await ctx.reply(
    `/start — Register and get main menu\n` +
    `/help — Command reference\n` +
    `/newduel — Create a new prediction duel\n` +
    `/duels — List open duels\n` +
    `/duel <id> — Show duel details\n` +
    `/predict <duel_id> <outcome> — Make a prediction\n` +
    `/mypreds — Your predictions\n` +
    `/history — Past duels\n` +
    `/leaderboard — Top predictors\n` +
    `/challenge <user> — Challenge a predictor\n` +
    `/stats — Your stats\n` +
    `/export — Export your predictions`,
  );
});

bot.command("newduel", async (ctx: Context) => {
  await ctx.reply("New duel creation will be implemented in a follow-up task.");
});

bot.command("duels", async (ctx: Context) => {
  await ctx.reply("Duel listing will be implemented in a follow-up task.");
});

bot.command("duel", async (ctx: Context) => {
  await ctx.reply("Duel details will be implemented in a follow-up task.");
});

bot.command("predict", async (ctx: Context) => {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return;

  const match = String(ctx.match ?? "").trim();
  const args = match ? match.split(/\s+/) : [];
  const duelIdArg = args[0];
  const outcomeArg = args.slice(1).join(" ").trim();

  const duelId = Number(duelIdArg);
  if (!duelIdArg || isNaN(duelId) || duelId <= 0) {
    await ctx.reply("Usage: /predict <duel_id> [outcome]");
    return;
  }

  const duel = getDuelById(duelId);
  if (!duel) {
    await ctx.reply(`Duel #${duelId} does not exist.`);
    return;
  }

  if (duel.status !== "open") {
    await ctx.reply(
      `Duel #${duelId} is ${duel.status}. You can only predict on open duels.`,
    );
    return;
  }

  const now = new Date().toISOString();
  if (duel.deadline < now) {
    await ctx.reply(`Duel #${duelId} has passed its deadline. Picks are closed.`);
    return;
  }

  if (outcomeArg) {
    transition(chatId, "predict_stake", {
      predict: { duelId, predictedOutcome: outcomeArg, stake: 0 },
    });
    await ctx.reply(
      `⚔️ Duel #${duelId}: ${duel.title}\nYour pick: *${outcomeArg}*\n\n💰 Choose stake amount:`,
      { parse_mode: "Markdown", reply_markup: stakeKeyboard() },
    );
  } else {
    const outcomes = parseDuelOutcomes(duel);
    transition(chatId, "predict_pick", { predict: { duelId } });
    await ctx.reply(
      `🎯 Duel #${duelId}: ${duel.title}\nChoose your prediction:`,
      { reply_markup: pickKeyboard(duelId, outcomes) },
    );
  }
});

bot.command("mypreds", async (ctx: Context) => {
  await ctx.reply("Your predictions will be available in a follow-up task.");
});

bot.command("history", async (ctx: Context) => {
  await ctx.reply("History will be implemented in a follow-up task.");
});

bot.command("leaderboard", async (ctx: Context) => {
  await ctx.reply("Leaderboard will be implemented in a follow-up task.");
});

bot.command("challenge", async (ctx: Context) => {
  await ctx.reply("Challenge will be implemented in a follow-up task.");
});

bot.command("stats", async (ctx: Context) => {
  await ctx.reply("Stats will be implemented in a follow-up task.");
});

bot.command("export", async (ctx: Context) => {
  await ctx.reply("Export will be implemented in a follow-up task.");
});

bot.command("admin_resolve", async (ctx: Context) => {
  await ctx.reply("Admin resolve will be implemented in a follow-up task.");
});

bot.command("admin_event", async (ctx: Context) => {
  await ctx.reply("Admin event management will be implemented in a follow-up task.");
});

// --- prediction keyboard helpers ---

function pickKeyboard(duelId: number, outcomes: string[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < outcomes.length; i++) {
    kb.text(outcomes[i], `pick:${duelId}:${i}`);
    if (i > 0 && i % 2 === 1) kb.row();
  }
  kb.row().text("Cancel", "cancel:flow");
  return kb;
}

function stakeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("0", "stake:0")
    .row()
    .text("10", "stake:10").text("25", "stake:25")
    .row()
    .text("50", "stake:50").text("100", "stake:100")
    .row()
    .text("Custom", "stake:custom")
    .row()
    .text("Cancel", "cancel:flow");
}

function confirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Confirm", "confirm:stake")
    .row()
    .text("Cancel", "cancel:flow");
}

// --- prediction callback handler ---

async function handlePredictionCallback(ctx: Context, data: string): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) {
    await ctx.answerCallbackQuery();
    return;
  }

  const stateCtx = getState(chatId);

  if (data === "cancel:flow") {
    await ctx.answerCallbackQuery();
    resetState(chatId);
    await ctx.reply("Prediction cancelled.");
    return;
  }

  if (data.startsWith("pick:")) {
    const parts = data.split(":");
    const duelId = Number(parts[1]);
    const outcomeIdx = Number(parts[2]);

    const duel = getDuelById(duelId);
    if (!duel) {
      await ctx.answerCallbackQuery({ text: "Duel not found." });
      resetState(chatId);
      return;
    }

    const outcomes = parseDuelOutcomes(duel);
    const outcome = outcomes[outcomeIdx];
    if (!outcome) {
      await ctx.answerCallbackQuery({ text: "Invalid outcome selection." });
      return;
    }

    transition(chatId, "predict_stake", {
      predict: { duelId, predictedOutcome: outcome, stake: 0 },
    });
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `⚔️ Duel #${duelId}: ${duel.title}\nYour pick: *${outcome}*\n\n💰 Choose stake amount:`,
      { parse_mode: "Markdown", reply_markup: stakeKeyboard() },
    );
    return;
  }

  if (data === "stake:custom") {
    transition(chatId, "predict_stake");
    await ctx.answerCallbackQuery();
    await ctx.reply("Enter your stake amount (0–10000 points):");
    return;
  }

  if (data.startsWith("stake:")) {
    const amount = Number(data.split(":")[1]);
    if (isNaN(amount) || amount < 0 || amount > 10000) {
      await ctx.answerCallbackQuery({ text: "Invalid stake amount." });
      return;
    }

    const predict = stateCtx.predict;
    if (!predict.duelId || !predict.predictedOutcome) {
      await ctx.answerCallbackQuery({ text: "Prediction state is incomplete. Start over with /predict." });
      resetState(chatId);
      return;
    }

    transition(chatId, "predict_confirming", { predict: { stake: amount } });
    const duel = getDuelById(predict.duelId);
    const duelTitle = duel ? duel.title : `#${predict.duelId}`;
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `⚔️ Duel: ${duelTitle}\n📋 Your pick: *${predict.predictedOutcome}*\n💰 Stake: *${amount}* points\n\nConfirm your prediction?`,
      { parse_mode: "Markdown", reply_markup: confirmKeyboard() },
    );
    return;
  }

  if (data === "confirm:stake") {
    const predict = stateCtx.predict;
    if (!predict.duelId || !predict.predictedOutcome || predict.stake === undefined) {
      await ctx.answerCallbackQuery({ text: "Prediction state is incomplete. Start over with /predict." });
      resetState(chatId);
      return;
    }

    const duel = getDuelById(predict.duelId);
    if (!duel) {
      await ctx.answerCallbackQuery({ text: "Duel no longer exists." });
      resetState(chatId);
      return;
    }

    if (duel.status !== "open") {
      await ctx.answerCallbackQuery({ text: "This duel is no longer open." });
      resetState(chatId);
      return;
    }

    if (duel.deadline < new Date().toISOString()) {
      await ctx.answerCallbackQuery({ text: "Picks are closed — deadline has passed." });
      resetState(chatId);
      return;
    }

    try {
      const result = replacePrediction(
        predict.duelId,
        userId,
        predict.predictedOutcome,
        predict.stake,
      );

      resetState(chatId);
      await ctx.answerCallbackQuery();
      if (result.replaced) {
        await ctx.reply(
          `🔁 Your prediction has been updated.\n⚔️ Duel #${predict.duelId}: ${duel.title}\n📋 Outcome: *${predict.predictedOutcome}*\n💰 Stake: *${predict.stake}* points (locked)`,
          { parse_mode: "Markdown" },
        );
      } else {
        await ctx.reply(
          `🔒 Locked in: *${predict.predictedOutcome}* for *${predict.stake}* points on Duel #${predict.duelId}: ${duel.title}`,
          { parse_mode: "Markdown" },
        );
      }
    } catch (err) {
      await ctx.answerCallbackQuery({ text: "Failed to save prediction. Please try again." });
      console.error("replacePrediction error:", err);
    }
    return;
  }

  await ctx.answerCallbackQuery({ text: `Unknown prediction action: ${data}` });
}

bot.on("callback_query", async (ctx: Context) => {
  const data = ctx.callbackQuery?.data;
  if (!data) {
    await ctx.answerCallbackQuery();
    return;
  }

  if (
    data.startsWith("pick:") ||
    data.startsWith("stake:") ||
    data.startsWith("confirm:") ||
    data === "cancel:flow"
  ) {
    await handlePredictionCallback(ctx, data);
    if (ctx.callbackQuery?.message) {
      try {
        await ctx.api.deleteMessage(
          ctx.callbackQuery.message.chat.id,
          ctx.callbackQuery.message.message_id,
        );
      } catch {
        // ignore deletion errors
      }
    }
    return;
  }

  if (data.startsWith("cat:")) {
    await ctx.answerCallbackQuery({ text: "Event type selection will be implemented in a follow-up task." });
  } else if (data.startsWith("ev:")) {
    await ctx.answerCallbackQuery({ text: "Event selection will be implemented in a follow-up task." });
  } else if (data.startsWith("duel:")) {
    await ctx.answerCallbackQuery({ text: "Duel card will be implemented in a follow-up task." });
  } else {
    await ctx.answerCallbackQuery({ text: `Unknown action: ${data}` });
  }

  if (ctx.callbackQuery?.message) {
    try {
      await ctx.api.deleteMessage(
        ctx.callbackQuery.message.chat.id,
        ctx.callbackQuery.message.message_id,
      );
    } catch {
      // ignore deletion errors
    }
  }
});

bot.on("message:text", async (ctx: Context) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const stateCtx = getState(chatId);
  if (stateCtx.state !== "predict_stake") return;

  const text = ctx.message?.text ?? "";
  const amount = Number(text);

  if (ctx.message?.text && ctx.message.text.startsWith("/")) return;

  if (isNaN(amount) || !Number.isInteger(amount) || amount < 0 || amount > 10000) {
    await ctx.reply("Please enter a valid integer stake amount between 0 and 10000:");
    return;
  }

  const predict = stateCtx.predict;
  if (!predict.duelId || !predict.predictedOutcome) {
    resetState(chatId);
    await ctx.reply("Prediction state is incomplete. Please start over with /predict.");
    return;
  }

  transition(chatId, "predict_confirming", { predict: { stake: amount } });
  const duel = getDuelById(predict.duelId);
  const duelTitle = duel ? duel.title : `#${predict.duelId}`;
  await ctx.reply(
    `⚔️ Duel: ${duelTitle}\n📋 Your pick: *${predict.predictedOutcome}*\n💰 Stake: *${amount}* points\n\nConfirm your prediction?`,
    { parse_mode: "Markdown", reply_markup: confirmKeyboard() },
  );
});

export function startBot(onStart?: (botInfo: { username: string }) => void): void {
  bot.start({
    onStart: (botInfo) => {
      console.log(`Bot @${botInfo.username} started (long polling)`);
      onStart?.(botInfo);
    },
  });
}

export function stopBot(): void {
  bot.stop();
}