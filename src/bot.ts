import { Bot, InlineKeyboard, type Context } from "grammy";
import { registerUser } from "./db/users.js";
import { listOpenDuels, countOpenDuels } from "./db/duels.js";

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

const EVENT_TYPES = ["crypto", "sports", "game", "weather", "other"] as const;

function languageToTimezone(langCode?: string): string {
  if (!langCode) return "UTC";
  const lang = langCode.toLowerCase();
  const map: Record<string, string> = {
    ru: "Europe/Moscow",
    ua: "Europe/Kyiv",
    by: "Europe/Minsk",
    de: "Europe/Berlin",
    fr: "Europe/Paris",
    it: "Europe/Rome",
    es: "Europe/Madrid",
    pt: "America/Sao_Paulo",
    ar: "Asia/Riyadh",
    zh: "Asia/Shanghai",
    ja: "Asia/Tokyo",
    ko: "Asia/Seoul",
    tr: "Europe/Istanbul",
    fa: "Asia/Tehran",
    hi: "Asia/Kolkata",
  };
  return map[lang] ?? "UTC";
}

function formatDeadline(deadlineStr: string, langCode?: string): string {
  const deadline = new Date(deadlineStr);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "expired";
  }

  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  let relative: string;
  if (minutes < 60) {
    relative = `${minutes}m`;
  } else if (hours < 24) {
    const rem = minutes % 60;
    relative = rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  } else if (days < 7) {
    relative = `${days}d`;
  } else {
    const weeks = Math.floor(days / 7);
    relative = `${weeks}w`;
  }

  const tz = languageToTimezone(langCode);
  let abs: string;
  try {
    abs = deadline.toLocaleString("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "short" });
  } catch {
    abs = deadline.toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
  }

  return `in ${relative} (${abs} ${tz})`;
}

function buildDuelListKeyboard(
  items: { id: number }[],
  filterType: string | undefined,
  page: number,
  totalPages: number,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const item of items) {
    keyboard.text(`⚔️ #${item.id}`, `duel:open:${item.id}`).row();
  }

  const filterLabel = filterType ?? "all";

  if (totalPages > 1) {
    if (page > 0) {
      keyboard.text("« Prev", `duels:page:${page - 1}:${filterLabel}`);
    }
    keyboard.text(`${page + 1}/${totalPages}`, "duels:noop");
    if (page < totalPages - 1) {
      keyboard.text("Next »", `duels:page:${page + 1}:${filterLabel}`);
    }
    keyboard.row();
  }

  keyboard
    .text("Crypto", "cat:filter:crypto")
    .text("Sports", "cat:filter:sports")
    .text("Games", "cat:filter:game")
    .row()
    .text("Weather", "cat:filter:weather")
    .text("Other", "cat:filter:other")
    .text("All", "cat:filter:all");

  return keyboard;
}

function buildDuelsMessage(
  items: ReturnType<typeof listOpenDuels>,
  filterType: string | undefined,
  page: number,
  total: number,
  langCode?: string,
): string {
  const filterLabel = filterType ? ` "${filterType}"` : "";
  let text = `⚔️ <b>Open Duels</b>${filterLabel} (${total} total)\n\n`;

  if (items.length === 0) {
    text += "No open duels found.\n";
  } else {
    for (const duel of items) {
      const deadlineStr = formatDeadline(duel.deadline, langCode);
      const picks = duel.prediction_count;
      const eventType = duel.event_type ? ` [${duel.event_type}]` : "";
      text += `⚔️ <b>#${duel.id}</b> · ${escapeHtml(duel.title)}${eventType}\n`;
      text += `   closes ${deadlineStr} · ${picks} pick${picks !== 1 ? "s" : ""}\n`;
    }
    text += "\n";
  }

  return text;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function renderDuels(
  ctx: Context,
  filterType: string | undefined,
  page: number,
  messageId?: number,
): Promise<void> {
  const PAGE_SIZE = 10;
  const items = listOpenDuels(filterType, page, PAGE_SIZE);
  const total = countOpenDuels(filterType);
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const langCode = ctx.from?.language_code;
  const text = buildDuelsMessage(items, filterType, page, total, langCode);
  const keyboard = buildDuelListKeyboard(items, filterType ?? undefined, page, totalPages);

  if (messageId) {
    try {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        messageId,
        text,
        { parse_mode: "HTML", reply_markup: keyboard },
      );
    } catch {
      // fall through to send new
    }
  } else {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  }
}

bot.command("duels", async (ctx: Context) => {
  const text = ctx.message?.text ?? "";
  const arg = text.replace(/^\/duels(@\S+)?\s*/, "").trim();
  const filterType = EVENT_TYPES.includes(arg as typeof EVENT_TYPES[number]) ? arg : undefined;

  await renderDuels(ctx, filterType, 0);
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

  if (data.startsWith("cat:filter:")) {
    const filterType = data.slice("cat:filter:".length);
    const resolved = filterType === "all" ? undefined : filterType;
    await ctx.answerCallbackQuery();
    await renderDuels(ctx, resolved, 0, ctx.callbackQuery?.message?.message_id);
    return;
  }

  if (data.startsWith("duels:page:")) {
    const parts = data.slice("duels:page:".length).split(":");
    const page = parseInt(parts[0], 10) || 0;
    const filterType = parts.slice(1).join(":") === "all" ? undefined : parts.slice(1).join(":");
    await ctx.answerCallbackQuery();
    await renderDuels(ctx, filterType, page, ctx.callbackQuery?.message?.message_id);
    return;
  }

  if (data === "duels:noop") {
    await ctx.answerCallbackQuery();
    return;
  }

  if (data.startsWith("cat:")) {
    await ctx.answerCallbackQuery({ text: "Event type selection will be implemented in a follow-up task." });
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