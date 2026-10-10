import { Bot } from "grammy";
import { config } from "../dist/config/config.js";

async function getChannelInfo() {
  const bot = new Bot(config.telegram.token);
  try {
    const chat = await bot.api.getChat("@silvania_ai");
    console.log("=== DATOS DEL CANAL OBTENIDOS ===");
    console.log(`ID: ${chat.id}`);
    console.log(`Título: ${chat.title}`);
    console.log(`Username: @${chat.username}`);
    console.log(`Tipo: ${chat.type}`);
  } catch (err) {
    console.error("Error obteniendo info del canal:", err.message);
  }
}

getChannelInfo();
