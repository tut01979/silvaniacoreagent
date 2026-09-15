import { Bot, InlineKeyboard, InputFile } from "grammy";
import fs from "fs";
import { MarketingDraft } from "./types.js";
import { marketingDb } from "./database.js";
import { config } from "../config/config.js";
import { socialPublisher } from "./services/socialPublisher.js";

export const telegramReview = {
  /**
   * Envía la tarjeta de revisión interactiva (Human-in-the-Loop) a Telegram con metadatos de coste y multired.
   */
  async sendReviewCard(bot: Bot, draft: MarketingDraft): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text("🚀 Aprobar y Publicar", `mkt_pub_${draft.id}`)
      .text("🔄 Regenerar", `mkt_reg_${draft.id}`)
      .text("❌ Descartar", `mkt_rej_${draft.id}`)
      .row()
      .text("📦 Pack Multirredes (X, LinkedIn, FB, TikTok)", `mkt_pack_${draft.id}`);

    if (draft.format === "youtube_long" || draft.format === "youtube_short" || draft.format === "tiktok") {
      keyboard.text("📜 Ver Guión Detallado", `mkt_scr_${draft.id}`);
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
      const formatLabel = draft.format === "youtube_long" ? "YouTube Largo" : draft.format === "tiktok" ? "TikTok (9:16)" : "YouTube Short";
      const durationSeconds = draft.videoScript.totalEstimatedDurationSeconds || 60;
      const durationLabel = durationSeconds < 60 ? `~${durationSeconds} seg` : `~${Math.round(durationSeconds / 60)} min`;
      summaryText =
        `🎬 *GUION DE VIDEO (${formatLabel})*\n\n` +
        `📌 *Título:* ${draft.videoScript.title}\n` +
        `⏱️ *Duración estimada:* ${durationLabel}\n` +
        `🎞️ *Escenas:* ${draft.videoScript.scenes.length} bloques estructurados\n\n` +
        `🎣 *Hook:* "${draft.videoScript.hook}"` +
        techFooter;
    } else {
      summaryText = `📢 *Borrador:* ${draft.topic}` + techFooter;
    }

    // 1. Enviar imagen si existe
    const hasImage = draft.imageUrls && draft.imageUrls.length > 0 && fs.existsSync(draft.imageUrls[0]);
    if (hasImage) {
      if (summaryText.length <= 1000) {
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
        // Si el texto supera los 1000 caracteres, Telegram rechaza caption > 1024.
        // Enviamos la imagen primero y el texto completo con los botones interactivos después.
        // Enviar foto primero y texto completo después
        await bot.api.sendPhoto(draft.userId, new InputFile(draft.imageUrls[0]));
        try {
          await bot.api.sendMessage(draft.userId, summaryText, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          });
        } catch (err: any) {
          await bot.api.sendMessage(draft.userId, summaryText.replace(/[*_`]/g, ""), {
            reply_markup: keyboard,
          });
        }
      }
    } else {
      try {
        await bot.api.sendMessage(draft.userId, summaryText, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } catch (err: any) {
        await bot.api.sendMessage(draft.userId, summaryText.replace(/[*_`]/g, ""), {
          reply_markup: keyboard,
        });
      }
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

    // Solo administradores autorizados pueden interactuar con marketing
    const userId = ctx.from?.id;
    const adminIds = config.marketing?.adminIds || [1572946817];
    if (!userId || !adminIds.includes(userId)) {
      await ctx.answerCallbackQuery({ text: "⛔ No tienes permisos para gestionar marketing." });
      return true;
    }

    const parts = data.split("_");
    const action = parts[1]; // pub, reg, rej, scr, pack
    const draftId = parts.slice(2).join("_");

    const draft = marketingDb.getDraft(draftId);
    if (!draft) {
      await ctx.answerCallbackQuery({ text: "⚠️ Borrador no encontrado o expirado." });
      return true;
    }

    // Acción: Generar y mostrar el pack adaptado a cada red social
    if (action === "pack") {
      await ctx.answerCallbackQuery({ text: "📦 Generando Pack Multirredes..." });
      const pack = socialPublisher.generateSocialPack(draft);

      const msg = 
        `📦 *PACK MULTIRREDES LISTO (Copia y Pega)*\n\n` +
        `𝕏 *X / Twitter (Optimizado < 280 caracteres):*\n` +
        `\`\`\`text\n${pack.twitter}\n\`\`\`\n\n` +
        `💼 *LinkedIn (Profesional B2B):*\n` +
        `\`\`\`text\n${pack.linkedin}\n\`\`\`\n\n` +
        `📘 *Facebook:*\n` +
        `\`\`\`text\n${pack.facebook}\n\`\`\`\n\n` +
        `🎵 *TikTok:*\n` +
        `\`\`\`text\n${pack.tiktok}\n\`\`\`\n\n` +
        `🎬 *YouTube (Título & Descripción):*\n` +
        `*Título:* \`${pack.youtube.title}\`\n\n` +
        `*Descripción:*\n\`\`\`text\n${pack.youtube.description.slice(0, 1000)}\n\`\`\``;

      await ctx.reply(msg, { parse_mode: "Markdown" });
      return true;
    }

    if (action === "pub") {
      const channelId = config.marketing?.telegramChannelId;
      const socialPack = socialPublisher.generateSocialPack(draft);
      const publishReport: string[] = [];

      // 1. Enviar a Webhook Multirredes (Make / n8n / Zapier) si está activo
      if (config.marketing?.webhookUrl) {
        const webhookRes = await socialPublisher.dispatchToWebhook(draft, socialPack);
        if (webhookRes.success) {
          publishReport.push(`🌐 *Webhook Multicanal (Make/n8n):* Disparado con éxito`);
        } else {
          publishReport.push(`⚠️ *Webhook Multicanal:* ${webhookRes.error}`);
        }
      }

      // 2. Publicar en X (Twitter) de forma nativa si las claves están configuradas
      if (config.marketing?.twitterApiKey && config.marketing?.twitterAccessToken) {
        const imagePath = draft.imageUrls && draft.imageUrls.length > 0 ? draft.imageUrls[0] : undefined;
        const twitterRes = await socialPublisher.publishToTwitter(socialPack.twitter, imagePath);
        if (twitterRes.success) {
          const tweetLink = twitterRes.url ? `\n🔗 [Ver Tweet en X](${twitterRes.url})` : "";
          publishReport.push(`🕇 *X (Twitter):* Publicado en @Silvania_AI${tweetLink}`);
        } else {
          publishReport.push(`⚠️ *X (Twitter):* ${twitterRes.error}`);
        }
      }

      // 3. Enviar a Facebook Page si está configurado
      if (config.marketing?.facebookPageAccessToken) {
        const fbRes = await socialPublisher.publishToFacebook(socialPack.facebook);
        if (fbRes.success) {
          publishReport.push(`📘 *Facebook Page:* Publicado (ID: ${fbRes.messageId})`);
        } else {
          publishReport.push(`⚠️ *Facebook:* ${fbRes.error}`);
        }
      }

      // 4. Publicación en Canal Oficial de Telegram
      if (channelId && channelId.trim().length > 0) {
        try {
          console.log(`📢 [Marketing] Publicando borrador #${draftId} en canal ${channelId}...`);
          const hasImage = draft.imageUrls && draft.imageUrls.length > 0 && fs.existsSync(draft.imageUrls[0]);
          let channelMsg: any = null;

          const publishCaption = draft.socialContent
            ? `${draft.socialContent.title}\n\n${draft.socialContent.copy}\n\n${draft.socialContent.hashtags.join(" ")}`
            : `${draft.videoScript?.title || draft.topic}`;

          if (hasImage) {
            if (publishCaption.length <= 1000) {
              channelMsg = await bot.api.sendPhoto(channelId, new InputFile(draft.imageUrls[0]), {
                caption: publishCaption,
              });
            } else {
              // Si el copy es largo, foto primero y post completo después
              await bot.api.sendPhoto(channelId, new InputFile(draft.imageUrls[0]));
              channelMsg = await bot.api.sendMessage(channelId, publishCaption);
            }
          } else {
            channelMsg = await bot.api.sendMessage(channelId, publishCaption);
          }

          draft.status = "published";
          draft.channelPublished = true;
          draft.channelMessageId = channelMsg.message_id;
          draft.publishedAt = new Date().toISOString();
          draft.updatedAt = new Date().toISOString();
          marketingDb.saveDraft(draft);

          let postLinkNote = "";
          const channelUrl = config.marketing?.telegramChannelUrl;
          if (channelUrl) {
            const cleanUrl = channelUrl.endsWith("/") ? channelUrl.slice(0, -1) : channelUrl;
            postLinkNote = `\n🔗 [Ver en el canal](${cleanUrl}/${channelMsg.message_id})`;
          }

          publishReport.unshift(`📢 *Canal Telegram:* Publicado con éxito${postLinkNote}`);

          await ctx.answerCallbackQuery({ text: "🚀 ¡Aprobado y publicado!" });
          await ctx.editMessageReplyMarkup({ reply_markup: undefined });

          const reportText = 
            `✅ *¡Borrador #${draftId.slice(0, 8)} APROBADO!*\n\n` +
            publishReport.join("\n") + "\n\n" +
            `💡 _Toca el botón abajo para obtener los textos listos para pegar en X, LinkedIn, TikTok y YouTube:_`;

          const followUpKeyboard = new InlineKeyboard().text("📦 Ver Pack Multirredes (1-Click)", `mkt_pack_${draftId}`);
          await ctx.reply(reportText, { parse_mode: "Markdown", reply_markup: followUpKeyboard });
          return true;
        } catch (publishErr: any) {
          console.error("❌ Error publicando en canal de Telegram:", publishErr.message);
          draft.status = "approved_saved";
          draft.updatedAt = new Date().toISOString();
          marketingDb.saveDraft(draft);
          await ctx.answerCallbackQuery({ text: "⚠️ Error al enviar al canal. Guardado en SQLite." });
          await ctx.reply(`⚠️ Aprobado y guardado en SQLite, pero falló el envío al canal (${publishErr.message}).`);
          return true;
        }
      } else {
        // Si NO hay canal configurado: no inventar publicación, marcar como approved_saved
        console.log(`ℹ️ [Marketing] Skip publish: no hay canal configurado en MARKETING_TELEGRAM_CHANNEL_ID. Guardando borrador #${draftId}...`);
        draft.status = "approved_saved";
        draft.updatedAt = new Date().toISOString();
        marketingDb.saveDraft(draft);
        await ctx.answerCallbackQuery({ text: "✅ Aprobado y guardado." });
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });

        publishReport.push(`💾 *SQLite Local:* Guardado`);

        const reportText = 
          `✅ *Borrador #${draftId.slice(0, 8)} APROBADO Y GUARDADO*\n\n` +
          publishReport.join("\n") + "\n\n" +
          `💡 *Para publicarlo automáticamente en Telegram:*\n` +
          `Configura la variable \`MARKETING_TELEGRAM_CHANNEL_ID\` en Railway.\n\n` +
          `_Toca abajo para copiar los textos formateados para tus otras redes:_`;

        const followUpKeyboard = new InlineKeyboard().text("📦 Ver Pack Multirredes (1-Click)", `mkt_pack_${draftId}`);
        await ctx.reply(reportText, { parse_mode: "Markdown", reply_markup: followUpKeyboard });
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
