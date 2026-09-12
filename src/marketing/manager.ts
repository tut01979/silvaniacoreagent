import crypto from "crypto";
import { Bot } from "grammy";
import { ContentFormat, MarketingDraft } from "./types.js";
import { marketingDb } from "./database.js";
import { scriptWriter } from "./services/scriptWriter.js";
import { imageGenerator } from "./services/imageGenerator.js";
import { voiceStudio } from "./services/voiceStudio.js";
import { telegramReview } from "./telegramReview.js";
import { config } from "../config/config.js";

export const marketingManager = {
  /**
   * Genera un nuevo borrador de marketing optimizado para bajo coste y alta calidad,
   * y envía la tarjeta de aprobación Human-in-the-Loop a Telegram.
   */
  async createAndReviewDraft(
    topic: string,
    format: ContentFormat,
    userId: number,
    bot: Bot
  ): Promise<MarketingDraft> {
    const draftId = crypto.randomUUID();
    const now = new Date().toISOString();

    console.log(`🚀 MarketingManager [Low-Cost P0]: Iniciando para "${topic}" [${format}]...`);

    let draft: MarketingDraft = {
      id: draftId,
      userId,
      topic,
      format,
      status: "pending_review",
      imageUrls: [],
      audioUrls: [],
      targetChannels: ["telegram_channel"],
      createdAt: now,
      updatedAt: now,
    };

    if (format === "social_post") {
      // 1. Redacción de Post y Prompt de Imagen (LLM)
      const scriptRes = await scriptWriter.generateSocialPost(topic);
      draft.socialContent = scriptRes.data;
      draft.llmModel = scriptRes.llmModel;

      // 2. Generación de Imagen (FLUX Free por defecto)
      try {
        const imgRes = await imageGenerator.generateImage(scriptRes.data.imagePrompt, { width: 1200, height: 675 });
        draft.imageUrls.push(imgRes.filePath);
        draft.imageProvider = imgRes.provider;
      } catch (err: any) {
        console.warn("⚠️ Falló generación de imagen:", err.message);
      }

      // 3. Generación de Audio (Edge-TTS Free por defecto)
      try {
        const voiceRes = await voiceStudio.generateNarration(scriptRes.data.copy, userId);
        draft.audioUrls.push(voiceRes.audioPath);
        draft.voiceProvider = voiceRes.provider;
      } catch (err: any) {
        console.warn("⚠️ Falló generación de audio:", err.message);
      }
    } else if (format === "youtube_long" || format === "youtube_short") {
      const minutes = format === "youtube_long" ? 8 : 1;

      // 1. Guión Estructurado (LLM)
      const scriptRes = await scriptWriter.generateYouTubeScript(topic, minutes);
      draft.videoScript = scriptRes.data;
      draft.llmModel = scriptRes.llmModel;

      // 2. Miniatura de Alto CTR (FLUX Free)
      try {
        const thumbPrompt = `${scriptRes.data.title}, YouTube thumbnail concept, eye-catching, high contrast, vibrant cinematic lighting, photorealistic`;
        const imgRes = await imageGenerator.generateImage(thumbPrompt, { width: 1280, height: 720 });
        draft.imageUrls.push(imgRes.filePath);
        draft.imageProvider = imgRes.provider;
      } catch (err: any) {
        console.warn("⚠️ Falló miniatura:", err.message);
      }

      // 3. Locución del Gancho (Hook + Escena 1) con Edge-TTS
      try {
        const hookText = `${scriptRes.data.hook}. ${scriptRes.data.scenes[0]?.narration || ""}`;
        const voiceRes = await voiceStudio.generateNarration(hookText, userId);
        draft.audioUrls.push(voiceRes.audioPath);
        draft.voiceProvider = voiceRes.provider;
      } catch (err: any) {
        console.warn("⚠️ Falló locución:", err.message);
      }
    }

    // Persistir en SQLite
    marketingDb.saveDraft(draft);

    // Notificar al administrador con la tarjeta interactiva
    await telegramReview.sendReviewCard(bot, draft);

    return draft;
  },

  /**
   * Obtiene el último borrador del usuario para consultar estado con /marketing status.
   */
  getLastDraft(userId: number): MarketingDraft | null {
    const drafts = marketingDb.listUserDrafts(userId, 1);
    return drafts.length > 0 ? drafts[0] : null;
  },
};
