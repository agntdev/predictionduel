import { initSchema } from "./db/index.js";
import { startBot } from "./bot.js";

initSchema();
startBot();