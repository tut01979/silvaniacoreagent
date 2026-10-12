import { Bot, InlineKeyboard, InputFile } from "grammy";
import fs from "fs";
import path from "path";
import { MarketingDraft, CampaignPackDraft } from "./types.js";
import { marketingDb } from "./database.js";
import { config } from "../config/config.js";
import { socialPublisher } from "./services/socialPublisher.js";

function formatImageBreakdown(draft: MarketingDraft): string {
  const net = draft.networkImageCount ?? (draft.distinctImageCount || 0);
  const loc = draft.localFallbackImageCount ?? 0;
  if (net > 0 && loc > 0) return `${net} red, ${loc} slides corporativos`;
  if (net > 0 && loc === 0) return `${net} imágenes red`;
  if (loc > 0 && net === 0) return `${loc} slides corporativos`;
  return `${draft.distinctImageCount || draft.sceneImageCount || 1} imágenes`;
}

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
      const platformTag = draft.targetPlatform && draft.targetPlatform !== "generic"
        ? ` (${draft.targetPlatform.toUpperCase()})`
        : "";
      summaryText =
        `🎯 *PROPUESTA DE CONTENIDO${platformTag} (Human-in-the-Loop)*\n\n` +
        `📌 *Tema:* ${draft.topic}\n` +
        `📝 *Título:* ${draft.socialContent.title}\n\n` +
        `💬 *Texto:* \n${draft.socialContent.copy}\n\n` +
        `🏷️ *Tags:* ${draft.socialContent.hashtags.join(" ")}` +
        techFooter;
    } else if (draft.videoScript) {
      const formatLabel = draft.format === "youtube_long" ? "YouTube Largo (16:9)" : draft.format === "tiktok" ? "TikTok (9:16)" : "YouTube Short";
      const scenesInScript = draft.videoScript.scenes.length;
      const imgBreakdown = formatImageBreakdown(draft);
      const realDurStr = draft.realDurationSeconds
        ? `${Math.floor(draft.realDurationSeconds / 60)}:${Math.round(draft.realDurationSeconds % 60) < 10 ? "0" : ""}${Math.round(draft.realDurationSeconds % 60)}`
        : null;
      const durLabel = realDurStr ? `${realDurStr} (audio real)` : `~${Math.round((draft.videoScript.totalEstimatedDurationSeconds || 60) / 60)} min (guion)`;

      const videoStatus = draft.videoPath
        ? `\n🎥 *Vídeo MP4:* ✅ MP4 ${realDurStr || ""} (audio real) · ${scenesInScript} escenas (${imgBreakdown})`
        : draft.videoError
        ? `\n⚠️ *Vídeo MP4:* ${draft.videoError}`
        : "";
      summaryText =
        `🎬 *GUION DE VIDEO (${formatLabel})*\n\n` +
        `📌 *Título:* ${draft.videoScript.title}\n` +
        `⏱️ *Duración:* ${durLabel}\n` +
        `🎞️ *Escenas:* ${scenesInScript} escenas (${imgBreakdown})` +
        videoStatus + `\n\n` +
        `🎣 *Hook:* "${draft.videoScript.hook}"` +
        techFooter;
    } else {
      summaryText = `📢 *Borrador:* ${draft.topic}` + techFooter;
    }

    const hasImage = Boolean(draft.imageUrls && draft.imageUrls.length > 0 && fs.existsSync(draft.imageUrls[0]));

    // Si la imagen falló pero se intentó, avisar explícitamente en la tarjeta sin fingir que hay creativo
    if (!hasImage && draft.imageError) {
      summaryText = `⚠️ *Imagen no generada:* ${draft.imageError}\n\n` + summaryText;
    }

    // 1. Enviar imagen si existe
    if (hasImage) {
      if (summaryText.length <= 1000) {
        try {
          await bot.api.sendPhoto(draft.userId, new InputFile(draft.imageUrls[0]), {
            caption: summaryText,
            parse_mode: "Markdown",
            reply_markup: keyboard,
          });
        } catch (err: any) {
          // Fallback sin Markdown o con foto y texto separados
          try {
            await bot.api.sendPhoto(draft.userId, new InputFile(draft.imageUrls[0]), {
              caption: summaryText.slice(0, 1000).replace(/[*_`]/g, ""),
              reply_markup: keyboard,
            });
          } catch {
            await bot.api.sendPhoto(draft.userId, new InputFile(draft.imageUrls[0]));
            await bot.api.sendMessage(draft.userId, summaryText.replace(/[*_`]/g, ""), {
              reply_markup: keyboard,
            });
          }
        }
      } else {
        // Si el texto supera los 1000 caracteres, Telegram rechaza caption > 1024.
        // Enviamos la imagen primero y el texto completo con los botones interactivos después.
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
        const audioTitle = draft.videoScript?.title || draft.socialContent?.title || draft.topic;
        await bot.api.sendVoice(draft.userId, new InputFile(draft.audioUrls[0]), {
          caption: `🎙️ Locución Completa (${draft.voiceProvider || "Edge-TTS Neural"}): "${audioTitle}"`,
        });
      } catch (err: any) {
        console.warn("⚠️ Falló envío de audio voice:", err.message);
      }
    }

    // 3. Si es un guión de vídeo, adjuntar el guión completo particionado para que no se corte en Telegram
    if (draft.videoScript && draft.videoScript.scenes && draft.videoScript.scenes.length > 0) {
      try {
        let scriptMsg = `📜 *GUIÓN COMPLETO: ${draft.videoScript.title}*\n🎣 *Hook:* "${draft.videoScript.hook}"\n\n`;
        for (const scene of draft.videoScript.scenes) {
          const sceneBlock = `🎬 *Escena ${scene.sceneNumber} (${scene.timestamp})*\n🗣️ _"${scene.narration}"_\n🖼️ Visual: \`${scene.visualPrompt}\`${scene.onScreenText ? `\n🔤 En pantalla: _${scene.onScreenText}_` : ""}\n\n`;
          if ((scriptMsg + sceneBlock).length > 3800) {
            try {
              await bot.api.sendMessage(draft.userId, scriptMsg, { parse_mode: "Markdown" });
            } catch {
              await bot.api.sendMessage(draft.userId, scriptMsg.replace(/[*_`]/g, ""));
            }
            scriptMsg = sceneBlock;
          } else {
            scriptMsg += sceneBlock;
          }
        }
        if (scriptMsg.trim().length > 0) {
          try {
            await bot.api.sendMessage(draft.userId, scriptMsg, { parse_mode: "Markdown" });
          } catch {
            await bot.api.sendMessage(draft.userId, scriptMsg.replace(/[*_`]/g, ""));
          }
        }
      } catch (scriptErr: any) {
        console.warn("⚠️ Falló envío de guión completo en Telegram:", scriptErr.message);
      }
    }

    // 4. Enviar vídeo MP4 generado al administrador para revisión HITL
    if (draft.videoPath && fs.existsSync(draft.videoPath)) {
      try {
        const stats = fs.statSync(draft.videoPath);
        const maxTgBytes = 49 * 1024 * 1024; // 49 MB límite seguro Telegram Bot API
        const realDurStr = draft.realDurationSeconds
          ? `${Math.floor(draft.realDurationSeconds / 60)}:${Math.round(draft.realDurationSeconds % 60) < 10 ? "0" : ""}${Math.round(draft.realDurationSeconds % 60)}`
          : `${Math.round(draft.videoScript?.totalEstimatedDurationSeconds || 60)}s`;
        const scenesInScript = draft.videoScript?.scenes.length || draft.sceneImageCount || 1;
        const imgBreakdown = formatImageBreakdown(draft);
        const videoCaption = `🎬 *MP4 ${realDurStr} (audio real) · ${scenesInScript} escenas (${imgBreakdown})*\n📌 "${draft.videoScript?.title || draft.topic}"\n\n⚙️ _Revisa el vídeo arriba. Para publicarlo en el canal oficial pulsa "Aprobar y Publicar"._`;

        if (stats.size <= maxTgBytes) {
          console.log(`🎬 [telegramReview] Enviando MP4 (${(stats.size / (1024 * 1024)).toFixed(2)} MB) al admin ${draft.userId}...`);
          try {
            await bot.api.sendVideo(draft.userId, new InputFile(draft.videoPath), {
              caption: videoCaption,
              parse_mode: "Markdown",
              supports_streaming: true,
            });
          } catch (sendErr: any) {
            // Fallback sin Markdown si Telegram rechaza caracteres
            await bot.api.sendVideo(draft.userId, new InputFile(draft.videoPath), {
              caption: videoCaption.replace(/[*_`]/g, ""),
              supports_streaming: true,
            });
          }
        } else {
          // Si supera 50MB, subir a Google Drive si el admin tiene tier beta/permisos
          let uploaded = false;
          const { isBetaUser } = await import("../services/authHelper.js");
          if (isBetaUser(draft.userId)) {
            try {
              const { driveMemoryService } = await import("../services/driveMemory.js");
              const folderId = await driveMemoryService.getOrCreateFolderPath(["silvania", "marketing", "videos"], draft.userId);
              const fileName = path.basename(draft.videoPath);
              const fileId = await driveMemoryService.uploadOrReplace(draft.userId, draft.videoPath, fileName, folderId);
              if (fileId) {
                const driveLink = `https://drive.google.com/file/d/${fileId}/view`;
                draft.videoUrl = driveLink;
                marketingDb.saveDraft(draft);
                await bot.api.sendMessage(
                  draft.userId,
                  `🎬 *Vídeo MP4 generado (${(stats.size / (1024 * 1024)).toFixed(1)} MB)*\nSupera el límite de Telegram (50MB).\n\n📂 **Guardado en tu Google Drive:** [Abrir Vídeo](${driveLink})\n📁 Carpeta: \`silvania/marketing/videos\``,
                  { parse_mode: "Markdown" }
                );
                uploaded = true;
              }
            } catch (driveErr: any) {
              console.warn("⚠️ Falló subida de vídeo pesado a Google Drive:", driveErr.message);
            }
          }
          if (!uploaded) {
            await bot.api.sendMessage(
              draft.userId,
              `🎬 *Vídeo MP4 generado (${(stats.size / (1024 * 1024)).toFixed(1)} MB)*\nSupera los 50MB de Telegram. Archivo local guardado en servidor:\n\`${draft.videoPath}\``,
              { parse_mode: "Markdown" }
            );
          }
        }
      } catch (videoSendErr: any) {
        console.warn("⚠️ Falló envío de vídeo MP4 en Telegram:", videoSendErr.message);
      }
    } else if (draft.videoError) {
      try {
        await bot.api.sendMessage(
          draft.userId,
          `⚠️ *Aviso VideoAssembler:* No se pudo ensamblar el archivo MP4:\n_${draft.videoError}_\n\n(El guión y audio están disponibles arriba).`,
          { parse_mode: "Markdown" }
        );
      } catch (err: any) {
        console.warn("⚠️ Falló envío de aviso videoError:", err.message);
      }
    }
  },

  /**
   * Maneja el callback de los botones interactivos pulsados en Telegram.
   */
  async handleCallback(bot: Bot, ctx: any): Promise<boolean> {
    const data: string = ctx.callbackQuery?.data || "";
    if (!data.startsWith("mkt_")) return false;

    // 1. Responder de inmediato al callback query para evitar timeout en Telegram (400: query is too old)
    await ctx.answerCallbackQuery().catch(() => {});

    // Solo administradores autorizados pueden interactuar con marketing
    const userId = ctx.from?.id;
    const adminIds = config.marketing?.adminIds || [1572946817];
    if (!userId || !adminIds.includes(userId)) {
      await ctx.answerCallbackQuery({ text: "⛔ No tienes permisos para gestionar marketing." }).catch(() => {});
      return true;
    }

    const parts = data.split("_");
    const action = parts[1]; // pub, reg, rej, scr, pack
    const draftId = parts.slice(2).join("_");

    const draft = marketingDb.getDraft(draftId);
    if (!draft) {
      await ctx.answerCallbackQuery({ text: "⚠️ Borrador no encontrado o expirado." }).catch(() => {});
      return true;
    }

    // Acción: Generar y mostrar el pack adaptado a cada red social
    if (action === "pack") {
      await ctx.answerCallbackQuery({ text: "📦 Generando Pack Multirredes..." }).catch(() => {});
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
          const hasVideo = Boolean(draft.videoPath && fs.existsSync(draft.videoPath));
          const hasImage = draft.imageUrls && draft.imageUrls.length > 0 && fs.existsSync(draft.imageUrls[0]);
          let channelMsg: any = null;

          const publishCaption = draft.socialContent
            ? `${draft.socialContent.title}\n\n${draft.socialContent.copy}\n\n${draft.socialContent.hashtags.join(" ")}`
            : `${draft.videoScript?.title || draft.topic}`;

          if (hasVideo && fs.statSync(draft.videoPath!).size <= 49 * 1024 * 1024) {
            try {
              channelMsg = await bot.api.sendVideo(channelId, new InputFile(draft.videoPath!), {
                caption: publishCaption.slice(0, 1000),
                supports_streaming: true,
              });
            } catch {
              channelMsg = await bot.api.sendVideo(channelId, new InputFile(draft.videoPath!));
              await bot.api.sendMessage(channelId, publishCaption);
            }
          } else if (hasImage) {
            if (publishCaption.length <= 1000) {
              try {
                channelMsg = await bot.api.sendPhoto(channelId, new InputFile(draft.imageUrls[0]), {
                  caption: publishCaption,
                });
              } catch {
                await bot.api.sendPhoto(channelId, new InputFile(draft.imageUrls[0]));
                channelMsg = await bot.api.sendMessage(channelId, publishCaption);
              }
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

          await ctx.answerCallbackQuery({ text: "🚀 ¡Aprobado y publicado!" }).catch(() => {});
          await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});

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
          await ctx.answerCallbackQuery({ text: "⚠️ Error al enviar al canal. Guardado en SQLite." }).catch(() => {});
          await ctx.reply(`⚠️ Aprobado y guardado en SQLite, pero falló el envío al canal (${publishErr.message}).`);
          return true;
        }
      } else {
        // Si NO hay canal configurado: no inventar publicación, marcar como approved_saved
        console.log(`ℹ️ [Marketing] Skip publish: no hay canal configurado en MARKETING_TELEGRAM_CHANNEL_ID. Guardando borrador #${draftId}...`);
        draft.status = "approved_saved";
        draft.updatedAt = new Date().toISOString();
        marketingDb.saveDraft(draft);
        await ctx.answerCallbackQuery({ text: "✅ Aprobado y guardado." }).catch(() => {});
        await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});

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
      await ctx.answerCallbackQuery({ text: "🔄 Regenerando borrador con nuevo ángulo..." }).catch(() => {});
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
      await ctx.answerCallbackQuery({ text: "❌ Descartado." }).catch(() => {});
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
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
        await ctx.answerCallbackQuery().catch(() => {});
      }
      return true;
    }

    return false;
  },

  /**
   * Envía el resumen consolidado de una campaña multicanal completa (Human-in-the-Loop)
   */
  async sendCampaignPackCard(bot: Bot, pack: CampaignPackDraft): Promise<void> {
    const ytScenes = pack.youtubeLongDraft?.videoScript?.scenes.length || 0;
    const ytDur = pack.youtubeLongDraft?.realDurationSeconds
      ? `${Math.floor(pack.youtubeLongDraft.realDurationSeconds / 60)}:${Math.round(pack.youtubeLongDraft.realDurationSeconds % 60) < 10 ? "0" : ""}${Math.round(pack.youtubeLongDraft.realDurationSeconds % 60)} min`
      : "~2-3 min";

    const ttScenes = pack.tiktokShortDraft?.videoScript?.scenes.length || 0;
    const ttDur = pack.tiktokShortDraft?.realDurationSeconds
      ? `${Math.round(pack.tiktokShortDraft.realDurationSeconds)}s`
      : "~40s";

    const msg =
      `📦 *CAMPAÑA OMNICANAL GENERADA CON ÉXITO*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 *Tema Central:* "${pack.topic}"\n\n` +
      `🎬 *YouTube Largo (16:9):*\n` +
      `  • Estado: ${pack.youtubeLongDraft?.videoPath ? "✅ Vídeo MP4 listo" : "Borrador generado"}\n` +
      `  • Capacidad: ${ytScenes} escenas · ${ytDur} (audio real)\n` +
      `  • Formato: Admite hasta 30 escenas extendidas sin cortes.\n\n` +
      `📱 *TikTok / Shorts (9:16):*\n` +
      `  • Estado: ${pack.tiktokShortDraft?.videoPath ? "✅ Vídeo MP4 listo" : "Borrador generado"}\n` +
      `  • Formato: ${ttScenes} escenas condensadas · ${ttDur} de alto impacto viral\n\n` +
      `💼 *LinkedIn Post:*\n` +
      `  • Estado: ✅ Redactado (storytelling B2B + aprendizajes profesionales)\n\n` +
      `𝕏 *X / Twitter:*\n` +
      `  • Estado: ✅ Gancho viral optimizado (< 280 caracteres)\n\n` +
      `✈️ *Telegram Digest:*\n` +
      `  • Estado: ✅ Resumen visual con viñetas para el canal\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 _Revisa cada pieza arriba de forma individual. Cada una cuenta con sus controles HITL interactivos de aprobación o regeneración._`;

    try {
      await bot.api.sendMessage(pack.userId, msg, { parse_mode: "Markdown" });
    } catch {
      await bot.api.sendMessage(pack.userId, msg.replace(/[*_`]/g, ""));
    }
  },
};
