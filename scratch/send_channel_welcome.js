import { Bot } from "grammy";
import { config } from "../dist/config/config.js";

async function postWelcome() {
  const bot = new Bot(config.telegram.token);
  const channelId = "-1004408880136";
  const welcomeText = 
    `👋 <b>¡Te damos la bienvenida al Canal Oficial de Silvania.ai!</b>\n\n` +
    `Aquí compartiremos demostraciones en vídeo, casos de uso reales y novedades sobre el desarrollo de <b>Silvania CoreAgent</b>, el asistente ejecutivo para Telegram integrado con <b>Google Workspace</b>.\n\n` +
    `🚀 <b>¿Qué puedes hacer con Silvania CoreAgent?</b>\n` +
    `• 📁 Consultar y organizar archivos en Google Drive por texto o voz.\n` +
    `• ✉️ Redactar y enviar correos en Gmail bajo orden directa.\n` +
    `• 📅 Agendar reuniones y consultar tu calendario de Google Calendar.\n` +
    `• 📊 Crear tablas de facturación y registros en Google Sheets.\n` +
    `• 🌐 Investigar páginas web y empresas en tiempo real sin alucinaciones.\n\n` +
    `🔗 <b>Pruébalo ahora:</b> @Silvania_Core_Agent_Bot\n` +
    `🌐 <b>Web oficial:</b> https://silvania.ai/coreagent\n\n` +
    `<i>Build in public · Fase 0 Early Access</i>`;

  try {
    const msg = await bot.api.sendMessage(channelId, welcomeText, { parse_mode: "HTML" });
    console.log(`✅ Mensaje inaugural publicado con éxito en el canal. Message ID: ${msg.message_id}`);
  } catch (err) {
    console.error("❌ Error enviando mensaje al canal:", err.message);
  }
}

postWelcome();
