import { Bot } from "grammy";
import { getYouTubeAuthUrl } from "./authHelper.js";
import { youtubePublisher } from "../marketing/services/youtubePublisher.js";

/**
 * Envía al administrador el estado actual de OAuth de YouTube, por qué puede fallar
 * (`invalid_grant` / app en modo Testing de 7 días) y las opciones de reconexión inmediata.
 */
export async function sendYouTubeOAuthPrompt(bot: Bot, userId: number): Promise<void> {
  const health = await youtubePublisher.checkAuthHealth();
  const ytUrl = getYouTubeAuthUrl(userId, "youtube");

  if (health.ok) {
    await bot.api.sendMessage(
      userId,
      `✅ *YouTube OAuth Conectado (${health.source === "db" ? "Token Dinámico DB" : "Env Railway"})*\n\n` +
      `📺 *Canal:* \`${health.channelTitle || "@silvania_ai"}\`\n` +
      `🟢 *Estado:* Token válido y listo para publicar.\n\n` +
      (ytUrl ? `Si deseas cambiar de canal o reautorizar:\n${ytUrl}` : ""),
      { parse_mode: "Markdown", link_preview_options: { is_disabled: true } }
    );
    return;
  }

  const lines: string[] = [
    `🎬 *Reconexión de YouTube (${health.channelTitle || "@silvania_ai"})*`,
    ``,
    `❌ *Estado actual:* \`${health.errorCode || "invalid_grant"}\``,
    `_${health.errorDescription || "Token expirado o revocado."}_`,
    ``,
    `💡 *Por qué pasa esto:* En Google Cloud Console, si la pantalla de consentimiento OAuth del proyecto (\`760882162591\`) está en modo *Testing / Pruebas*, Google caduca automáticamente el \`refresh_token\` cada **7 días**. Al pasarla a *In Production*, el token deja de caducar semanalmente.`,
    ``,
  ];

  if (ytUrl) {
    lines.push(`1️⃣ *Reconectar desde aquí (recomendado):*`);
    lines.push(`${ytUrl}`);
    lines.push(``);
    lines.push(`_(Nota: si Google muestra \`redirect_uri_mismatch\`, añade \`https://silvania.ai/auth/google/callback\` en URIs de redireccionamiento autorizados de tu cliente OAuth de YouTube en GCP, o usa el método 2 abajo)_.`);
    lines.push(``);
  }

  lines.push(`2️⃣ *Método alternativo instantáneo (OAuth Playground sin redeploy):*`);
  lines.push(`Genera un \`refresh_token\` para los scopes de YouTube (\`youtube.upload\`, \`youtube.force-ssl\`) con tus credenciales de YouTube y envíamelo aquí mismo con:`);
  lines.push(`\`/marketing youtube token TU_REFRESH_TOKEN\``);
  lines.push(`_(Lo validaré, guardaré cifrado en Firestore/SQLite y borraré tu mensaje del chat automáticamente)_.`);

  await bot.api.sendMessage(userId, lines.join("\n"), {
    parse_mode: "Markdown",
    link_preview_options: { is_disabled: true },
  });
}
