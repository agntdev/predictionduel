import { Bot, type Context, InlineKeyboard, InputFile } from "grammy";
import { getLeaderboard, getUserById, getUserByName, registerUser } from "./db/users.js";
import {
  getDuelById,
  getAllUserPredictions,
  parseDuelOutcomes,
  replacePrediction,
  getOpenDuels,
  createDuel,
} from "./db/predictions.js";
import { getState, resetState, transition } from "./state.js";
import type { NewDuelFlow } from "./state.js";

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
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  transition(chatId, "new_duel_type");
  await ctx.reply("🎯 Choose an event type for your duel:", {
    reply_markup: categoryKeyboard(),
  });
});

bot.command("duels", async (ctx: Context) => {
  const arg = String(ctx.match ?? "").trim();
  const validTypes = ["crypto", "sports", "game", "weather", "other"];
  const eventType = validTypes.includes(arg) ? arg : undefined;

  const duels = getOpenDuels(eventType);
  const msg = formatDuelsList(duels, eventType);

  await ctx.reply(msg, {
    parse_mode: "Markdown",
    reply_markup: duelsFilterKeyboard(eventType),
  });
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
  const entries = getLeaderboard(10);

  if (entries.length === 0) {
    await ctx.reply("🏆 *Leaderboard*\n\nNo users yet. Be the first to join with /start!", { parse_mode: "Markdown" });
    return;
  }

  const lines = entries.map(
    (e) => `#${e.rank} *${e.name}* — ${e.reputation} pts`,
  );

  await ctx.reply(
    `🏆 *Leaderboard*\n\n${lines.join("\n")}`,
    { parse_mode: "Markdown" },
  );
});

bot.command("challenge", async (ctx: Context) => {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  const userName = ctx.from?.first_name ?? "Unknown";
  if (!chatId || !userId) return;

  const arg = String(ctx.match ?? "").trim();
  if (!arg) {
    await ctx.reply(
      "Usage: /challenge <user_name or user_id>\n\n" +
      "Challenge another predictor to a duel. You can specify a user by name or numeric Telegram ID.",
    );
    return;
  }

  let target: { tg_id: number; name: string } | undefined;

  const numericId = Number(arg);
  if (!isNaN(numericId) && numericId > 0) {
    target = getUserById(numericId);
  } else {
    const name = arg.startsWith("@") ? arg.slice(1) : arg;
    target = getUserByName(name);
  }

  if (!target) {
    await ctx.reply(`User "${arg}" was not found. They must use /start first to register.`);
    return;
  }

  if (target.tg_id === userId) {
    await ctx.reply("You cannot challenge yourself.");
    return;
  }

  transition(chatId, "challenge_pending", {
    challenge: {
      challengerTgId: userId,
      challengerName: userName,
      targetTgId: target.tg_id,
      targetName: target.name,
      duelId: 0,
    },
  });

  await ctx.reply(
    `⚔️ *Challenge!*\n\n` +
    `${userName} has challenged ${target.name} to a prediction duel!\n\n` +
    `${target.name}, do you accept?`,
    {
      parse_mode: "Markdown",
      reply_markup: challengeKeyboard(),
    },
  );
});

bot.command("stats", async (ctx: Context) => {
  await ctx.reply("Stats will be implemented in a follow-up task.");
});

bot.command("export", async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Could not identify your account.");
    return;
  }

  const rows = getAllUserPredictions(userId);

  if (rows.length === 0) {
    await ctx.reply("You have no predictions to export.");
    return;
  }

  const headers = [
    "duel_id",
    "duel_title",
    "predicted_outcome",
    "stake_amount",
    "duel_status",
    "duel_deadline",
    "prediction_date",
    "username",
  ];

  const csvLines = [headers.join(",")];
  for (const row of rows) {
    const values = [
      row.duel_id,
      escapeCsv(row.duel_title),
      escapeCsv(row.predicted_outcome),
      row.stake_amount,
      row.duel_status,
      row.duel_deadline,
      row.prediction_date,
      escapeCsv(row.username),
    ];
    csvLines.push(values.join(","));
  }

  const csvContent = csvLines.join("\n");

  try {
    await ctx.api.sendDocument(
      userId,
      new InputFile(Buffer.from(csvContent, "utf-8"), "predictions.csv"),
      { caption: `📊 Exported ${rows.length} prediction(s).` },
    );
    await ctx.reply("📤 Your predictions have been sent to your DMs.");
  } catch {
    await ctx.reply(
      "❌ Could not send the file to your DMs. Please start a chat with me first using /start.",
    );
  }
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

function categoryKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Crypto", "cat:crypto")
    .row()
    .text("Sports", "cat:sports")
    .row()
    .text("Games", "cat:game")
    .row()
    .text("Weather", "cat:weather")
    .row()
    .text("Other", "cat:other")
    .row()
    .text("Cancel", "cancel:flow");
}

function challengeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Accept", "chl:accept")
    .text("Decline", "chl:decline");
}

function descriptionKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Skip description", "desc:skip");
}

function newDuelConfirmationKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Confirm", "newduel_conf:confirm")
    .text("Cancel", "newduel_conf:cancel");
}

function duelsFilterKeyboard(active?: string): InlineKeyboard {
  const types = [
    { label: "Crypto", value: "crypto" },
    { label: "Sports", value: "sports" },
    { label: "Games", value: "game" },
    { label: "Weather", value: "weather" },
    { label: "Other", value: "other" },
  ];
  const kb = new InlineKeyboard();
  for (let i = 0; i < types.length; i++) {
    const prefix = active === types[i].value ? "✅ " : "";
    kb.text(`${prefix}${types[i].label}`, `duels:filter:${types[i].value}`);
    if (i % 2 === 1) kb.row();
  }
  if (active) {
    kb.row().text("🔍 All duels", "duels:filter:all");
  }
  return kb;
}

function formatRelativeTime(diffMs: number): string {
  if (diffMs <= 0) return "ended";
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return days === 1 ? "1 day left" : `${days} days left`;
  }
  if (hours > 0) {
    return hours === 1 ? "1 hour left" : `${hours} hours left`;
  }
  if (minutes > 0) {
    return minutes === 1 ? "1 minute left" : `${minutes} minutes left`;
  }
  return "ending soon";
}
function escapeCsv(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function parseDeadline(input: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let normalized = trimmed
    .replace("T", " ")
    .replace(/\//g, "-")
    .replace(/\s+/, " ");

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    normalized += " 23:59";
  }

  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(normalized) &&
      !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const date = new Date(normalized.replace(" ", "T") + "Z");
  if (isNaN(date.getTime())) {
    const fallback = new Date(normalized + " UTC");
    if (isNaN(fallback.getTime())) return null;
    return fallback;
  }
  return date;
}

function validateSearchTerm(term: string, eventType: string): string | null {
  if (!term) return "Search term cannot be empty.";

  if (term.length > 200) return "Search term is too long (max 200 characters).";

  switch (eventType) {
    case "crypto": {
      if (!/^[a-zA-Z0-9 .-]+$/.test(term)) {
        return "Crypto symbols should only contain letters, numbers, spaces, dots, and hyphens.";
      }
      if (term.length < 1 || term.length > 20) {
        return "Crypto symbol should be 1–20 characters.";
      }
      break;
    }
    case "sports": {
      if (!/^[a-zA-Z0-9 '\-.,&]+$/.test(term)) {
        return "Team or match names should only contain letters, numbers, spaces, and basic punctuation.";
      }
      if (term.length > 80) {
        return "Team or match name is too long (max 80 characters).";
      }
      break;
    }
    case "game": {
      if (!/^[a-zA-Z0-9 '\-.,:;!?&]+$/.test(term)) {
        return "Game titles should only contain letters, numbers, spaces, and basic punctuation.";
      }
      if (term.length > 80) {
        return "Game title is too long (max 80 characters).";
      }
      break;
    }
    case "weather": {
      if (!/^[a-zA-Z0-9 ,.\-']+$/.test(term)) {
        return "City or region should only contain letters, numbers, spaces, commas, dots, hyphens, and apostrophes.";
      }
      if (term.length > 80) {
        return "City or region name is too long (max 80 characters).";
      }
      break;
    }
    case "other": {
      if (!/^[a-zA-Z0-9 '\-.,:;!?&]+$/.test(term)) {
        return "Search term contains invalid characters.";
      }
      break;
    }
    default:
      return "Invalid event type.";
  }

  return null;
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

  if (data.startsWith("chl:")) {
    await handleChallengeCallback(ctx, data);
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

  if (data === "desc:skip") {
    await handleDescriptionSkip(ctx);
  } else if (data.startsWith("newduel_conf:")) {
    await handleNewDuelConfirmationCallback(ctx, data);
  } else if (data.startsWith("cat:")) {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.answerCallbackQuery();
      return;
    }

    const stateCtx = getState(chatId);
    if (stateCtx.state !== "new_duel_type") {
      await ctx.answerCallbackQuery({ text: "This action is no longer active. Use /newduel to start." });
      return;
    }

    const category = data.split(":")[1];
    const validCategories = ["crypto", "sports", "game", "weather", "other"];
    if (!validCategories.includes(category)) {
      await ctx.answerCallbackQuery({ text: "Invalid event type." });
      return;
    }

    transition(chatId, "new_duel_search_term", {
      newDuel: { eventType: category },
    });

    const prompts: Record<string, string> = {
      crypto: "🔍 Enter a crypto symbol (e.g., BTC, ETH) to find an event:",
      sports: "🔍 Enter a team or match name to find an event:",
      game: "🔍 Enter a game title or event name to find an event:",
      weather: "🔍 Enter a city or region to find a weather event:",
      other: "🔍 Enter a keyword to search for an event:",
    };

    await ctx.answerCallbackQuery();
    await ctx.reply(prompts[category] ?? "🔍 Enter a search term to find an event:");
  } else if (data.startsWith("ev:")) {
    await ctx.answerCallbackQuery({ text: "Event selection will be implemented in a follow-up task." });
  } else if (data.startsWith("duel:")) {
    await ctx.answerCallbackQuery({ text: "Duel card will be implemented in a follow-up task." });
  } else if (data.startsWith("duels:filter:")) {
    await handleDuelsFilterCallback(ctx, data);
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

  if (ctx.message?.text && ctx.message.text.startsWith("/")) return;

  if (stateCtx.state === "predict_stake") {
    const text = ctx.message?.text ?? "";
    const amount = Number(text);

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
    return;
  }

  if (stateCtx.state === "new_duel_event_selection") {
    transition(chatId, "new_duel_title");
    await ctx.reply("📝 Enter a title for your duel (1–200 characters):");
    return;
  }

  if (stateCtx.state === "new_duel_title") {
    const raw = (ctx.message?.text ?? "").trim();

    if (!stateCtx.newDuel.title) {
      if (!raw || raw.length > 200) {
        await ctx.reply("❌ Title is required and must be 1–200 characters. Please try again:");
        return;
      }
      transition(chatId, "new_duel_title", { newDuel: { title: raw } });
      await ctx.reply(
        `✅ Title: *${raw}*\n\n📝 Now enter a description (max 500 characters), or skip:`,
        { parse_mode: "Markdown", reply_markup: descriptionKeyboard() },
      );
      return;
    }

    if (raw.length > 500) {
      await ctx.reply("❌ Description must be 500 characters or fewer. Please try again, or skip:");
      return;
    }

    transition(chatId, "new_duel_deadline", { newDuel: { description: raw } });
    await ctx.reply(
      `📝 Title: *${stateCtx.newDuel.title}*\n📄 Description: ${raw || "(none)"}\n\n⏳ Enter the deadline (UTC) in format:\n` +
      `\`YYYY-MM-DD HH:MM\`\nExample: \`2025-12-31 23:59\`\n` +
      `The deadline must be in the future.`,
      { parse_mode: "Markdown" },
    );
    return;
  }

  if (stateCtx.state === "new_duel_deadline") {
    const raw = (ctx.message?.text ?? "").trim();

    const deadline = parseDeadline(raw);
    if (!deadline) {
      await ctx.reply(
        `❌ Invalid date/time format. Please use:\n` +
        `\`YYYY-MM-DD HH:MM\` (e.g., \`2025-12-31 23:59\`)`,
        { parse_mode: "Markdown" },
      );
      return;
    }

    const now = new Date();
    if (deadline <= now) {
      const nowStr = now.toISOString().replace("T", " ").slice(0, 19);
      await ctx.reply(
        `❌ The deadline must be in the future.\n` +
        `Current UTC time: \`${nowStr}\`\n\n` +
        `Please enter a valid future deadline:\n\`YYYY-MM-DD HH:MM\``,
        { parse_mode: "Markdown" },
      );
      return;
    }

    transition(chatId, "new_duel_outcomes", {
      newDuel: { deadline: deadline.toISOString() },
    });
    await ctx.reply(
      `✅ Deadline set: *${deadline.toISOString().replace("T", " ").slice(0, 19)} UTC*\n\n` +
      `📋 Enter 2–6 distinct outcome options, separated by commas:\n` +
      `Example: \`Yes, No, Maybe\``,
      { parse_mode: "Markdown" },
    );
    return;
  }

  if (stateCtx.state === "new_duel_outcomes") {
    const raw = (ctx.message?.text ?? "").trim();
    if (!raw) {
      await ctx.reply(
        "Please enter 2–6 distinct outcome options, separated by commas:\n" +
        "Example: `Yes, No, Maybe`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    const outcomes = raw
      .split(/[,\n]/)
      .map((o) => o.trim())
      .filter(Boolean);

    if (outcomes.length < 2 || outcomes.length > 6) {
      await ctx.reply(
        `❌ You must provide between 2 and 6 outcome options. You entered ${outcomes.length}. Please try again:`,
      );
      return;
    }

    const unique = new Set(outcomes.map((o) => o.toLowerCase()));
    if (unique.size !== outcomes.length) {
      await ctx.reply(
        "❌ All outcome options must be distinct (case-insensitive). Please try again:",
      );
      return;
    }

    transition(chatId, "new_duel_confirming", { newDuel: { outcomes } });

    const newDuel = getState(chatId).newDuel;
    const summary = buildNewDuelSummary(newDuel);
    await ctx.reply(summary, {
      parse_mode: "Markdown",
      reply_markup: newDuelConfirmationKeyboard(),
    });
    return;
  }

  if (stateCtx.state === "new_duel_confirming") {
    await ctx.reply(
      "Please use the Confirm or Cancel buttons above to finalize your duel.",
    );
    return;
  }

  if (stateCtx.state === "new_duel_search_term") {
    const text = (ctx.message?.text ?? "").trim();

    const eventType = stateCtx.newDuel.eventType;
    if (!eventType) {
      resetState(chatId);
      await ctx.reply("Event type is missing. Please start over with /newduel.");
      return;
    }

    const error = validateSearchTerm(text, eventType);
    if (error) {
      await ctx.reply(`❌ ${error}\n\nPlease try again or use /newduel to restart.`);
      return;
    }

    transition(chatId, "new_duel_event_selection", {
      newDuel: { searchTerm: text },
    });

    await ctx.reply(
      `🔍 Searching for events matching *${text}* in ${eventType}...`,
      { parse_mode: "Markdown" },
    );
    return;
  }
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

// --- challenge callback handler ---

async function handleChallengeCallback(ctx: Context, data: string): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) {
    await ctx.answerCallbackQuery();
    return;
  }

  const stateCtx = getState(chatId);

  if (data === "chl:accept") {
    const challenge = stateCtx.challenge;
    if (!challenge.targetTgId || !challenge.challengerTgId) {
      await ctx.answerCallbackQuery({ text: "Challenge state is incomplete." });
      resetState(chatId);
      return;
    }

    if (userId !== challenge.targetTgId) {
      await ctx.answerCallbackQuery({ text: "Only the challenged user can accept this challenge." });
      return;
    }

    resetState(chatId);
    await ctx.answerCallbackQuery({ text: "Challenge accepted!" });
    await ctx.reply(
      `🤝 *Challenge accepted!*\n\n` +
      `${challenge.challengerName} vs ${challenge.targetName}\n\n` +
      `Create a duel with /newduel or make a prediction with /predict to get started!`,
      { parse_mode: "Markdown" },
    );
    return;
  }

  if (data === "chl:decline") {
    const challenge = stateCtx.challenge;
    if (!challenge.targetTgId) {
      await ctx.answerCallbackQuery();
      resetState(chatId);
      return;
    }

    if (userId !== challenge.targetTgId) {
      await ctx.answerCallbackQuery({ text: "Only the challenged user can decline this challenge." });
      return;
    }

    resetState(chatId);
    await ctx.answerCallbackQuery({ text: "Challenge declined." });
    await ctx.reply(
      `❌ ${challenge.targetName} declined the challenge from ${challenge.challengerName}.`,
    );
    return;
  }

  await ctx.answerCallbackQuery({ text: `Unknown challenge action: ${data}` });
}

async function handleDuelsFilterCallback(ctx: Context, data: string): Promise<void> {
  const parts = data.split(":");
  const filter = parts[2];
  const validTypes = ["crypto", "sports", "game", "weather", "other"];

  await ctx.answerCallbackQuery();

  if (filter === "all") {
    const duels = getOpenDuels();
    const msg = formatDuelsList(duels, undefined);
    await ctx.reply(msg, {
      parse_mode: "Markdown",
      reply_markup: duelsFilterKeyboard(),
    });
    return;
  }

  if (!validTypes.includes(filter)) {
    await ctx.reply("Invalid filter. Usage: /duels [crypto|sports|game|weather|other]");
    return;
  }

  const duels = getOpenDuels(filter);
  const msg = formatDuelsList(duels, filter);
  await ctx.reply(msg, {
    parse_mode: "Markdown",
    reply_markup: duelsFilterKeyboard(filter),
  });
}

async function handleDescriptionSkip(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    await ctx.answerCallbackQuery();
    return;
  }

  const stateCtx = getState(chatId);
  if (stateCtx.state !== "new_duel_title" || !stateCtx.newDuel.title) {
    await ctx.answerCallbackQuery({ text: "This action is no longer active. Use /newduel to start." });
    return;
  }

  await ctx.answerCallbackQuery();
  transition(chatId, "new_duel_deadline", { newDuel: { description: "" } });
  await ctx.reply(
    `📝 Title: *${stateCtx.newDuel.title}*\n📄 Description: (none)\n\n⏳ Enter the deadline (UTC) in format:\n` +
    `\`YYYY-MM-DD HH:MM\`\nExample: \`2025-12-31 23:59\`\n` +
    `The deadline must be in the future.`,
    { parse_mode: "Markdown" },
  );
}

async function handleNewDuelConfirmationCallback(ctx: Context, data: string): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) {
    await ctx.answerCallbackQuery();
    return;
  }

  const stateCtx = getState(chatId);

  if (stateCtx.state !== "new_duel_confirming") {
    await ctx.answerCallbackQuery({ text: "This action is no longer active. Use /newduel to start." });
    resetState(chatId);
    return;
  }

  if (data === "newduel_conf:cancel") {
    resetState(chatId);
    await ctx.answerCallbackQuery({ text: "Duel creation cancelled." });
    await ctx.reply("❌ Duel creation cancelled. Use /newduel to start again.");
    return;
  }

  if (data === "newduel_conf:confirm") {
    const newDuel = stateCtx.newDuel;
    if (!newDuel.title || !newDuel.deadline || !newDuel.outcomes || newDuel.outcomes.length === 0) {
      await ctx.answerCallbackQuery({ text: "Duel details are incomplete. Please start over with /newduel." });
      resetState(chatId);
      return;
    }

    const duel = createDuel({
      creatorTgId: userId,
      eventId: newDuel.eventId ?? null,
      title: newDuel.title,
      description: newDuel.description ?? null,
      deadline: newDuel.deadline,
      possibleOutcomes: newDuel.outcomes,
    });

    resetState(chatId);
    await ctx.answerCallbackQuery({ text: "Duel created!" });
    await ctx.reply(
      `✅ Duel #${duel.id} created!\n\n` +
      `📝 *${duel.title}*\n` +
      `📂 Category: ${newDuel.eventType ?? "unknown"}\n` +
      `⏳ Deadline: ${duel.deadline.replace("T", " ").slice(0, 19)} UTC\n` +
      `🎯 Outcomes: ${newDuel.outcomes.join(", ")}\n\n` +
      `Share it with /duel\\_${duel.id} or list all duels with /duels`,
      { parse_mode: "Markdown" },
    );
    return;
  }

  await ctx.answerCallbackQuery({ text: `Unknown confirmation action: ${data}` });
}

function buildNewDuelSummary(newDuel: Partial<NewDuelFlow>): string {
  const lines: string[] = ["📋 *New Duel Summary*\n"];
  if (newDuel.title) lines.push(`📝 Title: ${newDuel.title}`);
  if (newDuel.description) lines.push(`📄 Description: ${newDuel.description}`);
  if (newDuel.eventType) lines.push(`📂 Category: ${newDuel.eventType}`);
  if (newDuel.deadline) {
    lines.push(`⏳ Deadline: ${newDuel.deadline.replace("T", " ").slice(0, 19)} UTC`);
  }
  if (newDuel.outcomes && newDuel.outcomes.length > 0) {
    lines.push(`🎯 Outcomes: ${newDuel.outcomes.join(", ")}`);
  }
  lines.push("\n_Confirm to create this duel, or cancel to discard._");
  return lines.join("\n");
}

function formatDuelsList(duels: ReturnType<typeof getOpenDuels>, activeFilter?: string): string {
  if (duels.length === 0) {
    const scope = activeFilter ? `${activeFilter} ` : "";
    return `📭 No open ${scope}duels right now. Create one with /newduel!`;
  }

  const lines: string[] = [];
  const now = Date.now();

  for (const duel of duels) {
    const deadlineMs = new Date(duel.deadline + "Z").getTime();
    const diffMs = deadlineMs - now;
    const relative = formatRelativeTime(diffMs);
    const label = duel.event_type ? `${duel.event_type} ` : "";
    const utcDeadline = new Date(deadlineMs).toISOString().replace("T", " ").slice(0, 19) + " UTC";

    lines.push(
      `#${duel.id} — ${duel.title}`,
      `📂 ${label}| ⏳ ${relative} (${utcDeadline})`,
      `/duel\\_${duel.id}`,
    );
  }

  const header = activeFilter
    ? `⚔️ *Open ${activeFilter} duels* (${duels.length}):\n`
    : `⚔️ *Open duels* (${duels.length}):\n`;

  return header + "\n" + lines.join("\n");
}