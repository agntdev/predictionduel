import { initSchema } from "./db/index.js";
import { startBot } from "./bot.js";
import { startResolver } from "./resolver.js";

initSchema();
startBot(() => {
  startResolver();
});