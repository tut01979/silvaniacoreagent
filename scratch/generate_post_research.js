import { Bot } from "grammy";
import { config } from "../dist/config/config.js";
import { marketingManager } from "../dist/marketing/manager.js";

async function generateFirstPost() {
  const bot = new Bot(config.telegram.token);
  const userId = 1572946817;
  const topic = "Cómo investigar clientes y empresas en tiempo real sin alucinaciones desde Telegram con Silvania";

  console.log(`🚀 Generando propuesta para: "${topic}"...`);
  await bot.api.sendMessage(userId, `🧠 **Silvania Marketing Studio en marcha...**\n\nInvestigando y redactando propuesta para:\n_${topic}_`, { parse_mode: "Markdown" });

  const draft = await marketingManager.createAndReviewDraft(topic, "social_post", userId, bot);
  console.log(`✅ Propuesta enviada a revisión. Draft ID: ${draft.id}`);
}

generateFirstPost().catch(err => {
  console.error("❌ Error generando post:", err.message);
  process.exit(1);
});
