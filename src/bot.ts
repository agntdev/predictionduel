import { Bot, type Context, InlineKeyboard } from "grammy";
import { transition, getState } from "./state.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN environment variable is not set");
}

export const bot = new Bot(token);

const EVENT_CATEGORIES = [
  { id: "crypto", label: "Crypto" },
  { id: "sports", label: "Sports" },
  { id: "game", label: "Game" },
  { id: "weather", label: "Weather" },
  { id: "other", label: "Other" },
] as const;

type EventCategory = (typeof EVENT_CATEGORIES)[number]["id"];

bot.command("start", async (ctx: Context) => {
  await ctx.reply("Welcome to PredictionDuel! Use /help to see available commands.");
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

  transition(chatId, "new_duel_type", { newDuel: { eventType: "", searchTerm: "", eventId: null, eventName: "", title: "", description: "", deadline: "", outcomes: [] } });

  const keyboard = new InlineKeyboard();
  for (const cat of EVENT_CATEGORIES) {
    keyboard.row().text(cat.label, `cat:${cat.id}`);
  }

  const msg = await ctx.reply("Choose an event category for your duel:", { reply_markup: keyboard });
  transition(chatId, "new_duel_type", { lastMessageId: msg.message_id });
});

bot.command("duels", async (ctx: Context) => {
  await ctx.reply("Duel listing will be implemented in a follow-up task.");
});

bot.command("duel", async (ctx: Context) => {
  await ctx.reply("Duel details will be implemented in a follow-up task.");
});

bot.command("predict", async (ctx: Context) => {
  await ctx.reply("Prediction flow will be implemented in a follow-up task.");
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

bot.on("callback_query", async (ctx: Context) => {
  const data = ctx.callbackQuery?.data;
  if (!data) {
    await ctx.answerCallbackQuery();
    return;
  }

  if (data.startsWith("cat:")) {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.answerCallbackQuery();
      return;
    }
    const typeId = data.slice(4) as EventCategory;

    if (!EVENT_CATEGORIES.some((c) => c.id === typeId)) {
      await ctx.answerCallbackQuery({ text: "Invalid event category." });
      return;
    }

    const current = getState(chatId);
    transition(chatId, "new_duel_search_term", {
      newDuel: { eventType: typeId },
    });

    if (current.lastMessageId) {
      try {
        await ctx.api.deleteMessage(chatId, current.lastMessageId);
      } catch {
        // ignore deletion errors
      }
    }

    await ctx.answerCallbackQuery({ text: `Category: ${typeId}` });
    const msg = await ctx.reply("Now send a search term to find events (e.g. 'bitcoin', 'world cup'):");
    transition(chatId, "new_duel_search_term", { lastMessageId: msg.message_id });
  } else if (data.startsWith("ev:")) {
    await ctx.answerCallbackQuery({ text: "Event selection will be implemented in a follow-up task." });
  } else if (data.startsWith("pick:")) {
    await ctx.answerCallbackQuery({ text: "Prediction picking will be implemented in a follow-up task." });
  } else if (data.startsWith("stake:")) {
    await ctx.answerCallbackQuery({ text: "Stake selection will be implemented in a follow-up task." });
  } else if (data.startsWith("confirm:")) {
    await ctx.answerCallbackQuery({ text: "Confirmation will be implemented in a follow-up task." });
  } else if (data.startsWith("duel:")) {
    await ctx.answerCallbackQuery({ text: "Duel card will be implemented in a follow-up task." });
  } else {
    await ctx.answerCallbackQuery({ text: `Unknown action: ${data}` });
  }

  if (ctx.callbackQuery?.message) {
    try {
      await ctx.api.deleteMessage(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message.message_id);
    } catch {
      // ignore deletion errors
    }
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