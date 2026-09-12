import { Bot, InlineKeyboard, InputFile } from "grammy";
import fs from "fs";
import { MarketingDraft } from "./types.js";
import { marketingDb } from "./database.js";
import { config } from "../config/config.js";

export const telegramReview = {
  /**
   * Envía la tarjeta de revisión interactiva (Human-in-the-Loop) a Telegram con metadatos de coste.
   */
  async sendReviewCard(bot: Bot, draft: MarketingDraft): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text("🚀 Aprobar y Publicar", `mkt_pub_${draft.id}`)
      .text("🔄 Regenerar", `mkt_reg_${draft.id}`)
      .text("❌ Descartar", `mkt_rej_${draft.id}`);

    if (draft.format === "youtube_long" || draft.format === "youtube_short") {
      keyboard.row().text("📜 Ver Guión Detallado", `mkt_scr_${draft.id}`);
    }

    const techFooter = `\n\n⚙️ _Stack: LLM: ${draft.llmModel || "gemini"} | Voz: ${draft.voiceProvider || "edge-free"} | Img: ${draft.imageProvider || "flux-free"}_`;

    let summaryText = "";

    if (draft.format === "social_post" && draft.socialContent) {
      summaryText =
        `🎯 *PROPUESTA DE CONTENIDO (Human-in-the-Loop)*\n\n` +
        `📌 *Tema:* ${draft.topic}\n` +
        `📝 *Título:* ${draft.socialContent.title}\n\n` +
        `💬 *Texto:* \n${draft.socialContent.copy}\n\n` +
        `🏷️ *Tags:* ${draft.socialContent.hashtags.join(" ")}` +
        techFooter;
    } else if (draft.videoScript) {
      summaryText =
        `🎬 *GUION DE VIDEO (${draft.format === "youtube_long" ? "Larga Duración" : "Short"})*\n\n` +
        `📌 *Título:* ${draft.videoScript.title}\n` +
        `⏱️ *Duración estimada:* ~${Math.round(draft.videoScript.totalEstimatedDurationSeconds / 60)} min\n` +
        `🎞️ *Escenas:* ${draft.videoScript.scenes.length} bloques estructurados\n\n` +
        `🎣 *Hook:* "${draft.videoScript.hook}"` +
        techFooter;
    } else {
      summaryText = `📢 *Borrador:* ${draft.topic}` + techFooter;
    }

    // 1. Enviar imagen si existe
    const hasImage = draft.imageUrls && draft.imageUrls.length > 0 && fs.existsSync(draft.imageUrls[0]);
    if (hasImage) {
      try {
        await bot.api.sendPhoto(draft.userId, new InputFile(draft.imageUrls[0]), {
          caption: summaryText,
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } catch (err: any) {
        // Fallback sin Markdown si hay caracteres conflictivos en el copy
        await bot.api.sendPhoto(draft.userId, new InputFile(draft.imageUrls[0]), {
          caption: summaryText.replace(/[*_`]/g, ""),
          reply_markup: keyboard,
        });
      }
    } else {
      await bot.api.sendMessage(draft.userId, summaryText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }

    // 2. Enviar audio si existe
    const hasAudio = draft.audioUrls && draft.audioUrls.length > 0 && fs.existsSync(draft.audioUrls[0]);
    if (hasAudio) {
      try {
        await bot.api.sendVoice(draft.userId, new InputFile(draft.audioUrls[0]), {
          caption: `🎙️ Locución (${draft.voiceProvider || "Edge-TTS Neural"}): "${draft.topic}"`,
        });
      } catch (err: any) {
        console.warn("⚠️ Falló envío de audio voice:", err.message);
      }
    }
  },

  /**
   * Maneja el callback de los botones interactivos pulsados en Telegram.
   */
  async handleCallback(bot: Bot, ctx: any): Promise<boolean> {
    const data: string = ctx.callbackQuery?.data || "";
    if (!data.startsWith("mkt_")) return false;

    const parts = data.split("_");
    const action = parts[1]; // pub, reg, rej, scr
    const draftId = parts.slice(2).join("_");

    const draft = marketingDb.getDraft(draftId);
    if (!draft) {
      await ctx.answerCallbackQuery({ text: "⚠️ Borrador no encontrado o expirado." });
      return true;
    }

    if (action === "pub") {
      const channelId = config.marketing?.telegramChannelId;

      if (channelId) {
        // Si hay canal configurado, publicar de forma real
        try {
          const hasImage = draft.imageUrls && draft.imageUrls.length > 0 && fs.existsSync(draft.imageUrls[0]);
          let channelMsg: any = null;

          const publishCaption = draft.socialContent
            ? `${draft.socialContent.title}\n\n${draft.socialContent.copy}\n\n${draft.socialContent.hashtags.join(" ")}`
            : `${draft.videoScript?.title || draft.topic}`;

          if (hasImage) {
            channelMsg = await bot.api.sendPhoto(channelId, new InputFile(draft.imageUrls[0]), {
              caption: publishCaption.slice(0, 1024),
            });
          } else {
            channelMsg = await bot.api.sendMessage(channelId, publishCaption);
          }

          draft.channelPublished = true;
          draft.channelMessageId = channelMsg.message_id;
          marketingDb.updateStatus(draftId, "published");
          marketingDb.saveDraft(draft);

          await ctx.answerCallbackQuery({ text: "🚀 ¡Publicado en el canal de Telegram!" });
          await ctx.editMessageReplyMarkup({ reply_markup: undefined });
          await ctx.reply(`✅ *¡Borrador #${draftId.slice(0, 8)} publicado en el canal oficial!*`, { parse_mode: "Markdown" });
          return true;
        } catch (publishErr: any) {
          console.error("❌ Error publicando en canal de Telegram:", publishErr.message);
          marketingDb.updateStatus(draftId, "approved");
          await ctx.answerCallbackQuery({ text: "⚠️ Error de permisos al publicar en canal. Marcado como aprobado." });
          await ctx.reply(`⚠️ Aprobado, pero falló el envío al canal (${publishErr.message}). Verifica que el bot sea administrador del canal.`);
          return true;
        }
      } else {
        // Si NO hay canal configurado: no inventar publicación, solo marcar como aprobado
        marketingDb.updateStatus(draftId, "approved");
        await ctx.answerCallbackQuery({ text: "✅ Aprobado y listo." });
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.reply(
          `✅ *Borrador #${draftId.slice(0, 8)} APROBADO*\n\n` +
          `_Nota: No hay canal de Telegram configurado en \`MARKETING_TELEGRAM_CHANNEL_ID\`. ` +
          `El contenido está aprobado y almacenado en base de datos para copiar o publicar cuando desees._`,
          { parse_mode: "Markdown" }
        );
        return true;
      }
    }

    if (action === "reg") {
      marketingDb.updateStatus(draftId, "regenerating");
      await ctx.answerCallbackQuery({ text: "🔄 Regenerando borrador con nuevo ángulo..." });
      await ctx.reply(`🔄 *Regenerando nueva propuesta para:* "${draft.topic}"...`, { parse_mode: "Markdown" });
      try {
        const { marketingManager } = await import("./manager.js");
        await marketingManager.createAndReviewDraft(draft.topic, draft.format, draft.userId, bot);
      } catch (regErr: any) {
        await ctx.reply(`❌ Error al regenerar: ${regErr.message}`);
      }
      return true;
    }

    if (action === "rej") {
      marketingDb.updateStatus(draftId, "rejected");
      await ctx.answerCallbackQuery({ text: "❌ Descartado." });
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      await ctx.reply(`❌ Borrador #${draftId.slice(0, 8)} descartado.`);
      return true;
    }

    if (action === "scr") {
      if (draft.videoScript) {
        let scriptMsg = `📜 *GUIÓN COMPLETO: ${draft.videoScript.title}*\n\n`;
        for (const scene of draft.videoScript.scenes) {
          scriptMsg += `🎬 *Escena ${scene.sceneNumber} (${scene.timestamp})*\n`;
          scriptMsg += `🗣️ _"${scene.narration}"_\n`;
          scriptMsg += `🖼️ Visual: \`${scene.visualPrompt}\`\n\n`;
        }
        await ctx.reply(scriptMsg.slice(0, 4000), { parse_mode: "Markdown" });
        await ctx.answerCallbackQuery();
      }
      return true;
    }

    return false;
  },
};
