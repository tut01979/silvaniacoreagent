import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Bot } from "grammy";
import { ContentFormat, MarketingDraft } from "./types.js";
import { marketingDb } from "./database.js";
import { scriptWriter } from "./services/scriptWriter.js";
import { imageGenerator } from "./services/imageGenerator.js";
import { voiceStudio } from "./services/voiceStudio.js";
import { videoAssembler, SceneMediaInput, getAudioDuration, getFfmpegBinary } from "./services/videoAssembler.js";
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
        draft.imageError = err.message || "Error al generar imagen con FLUX";
      }

      // 3. Generación de Audio (Edge-TTS Free por defecto)
      try {
        const voiceRes = await voiceStudio.generateNarration(scriptRes.data.copy, userId);
        draft.audioUrls.push(voiceRes.audioPath);
        draft.voiceProvider = voiceRes.provider;
      } catch (err: any) {
        console.warn("⚠️ Falló generación de audio:", err.message);
      }
    } else if (format === "youtube_long" || format === "youtube_short" || format === "tiktok") {
      const isTikTok = format === "tiktok";
      const isShort = format === "youtube_short" || isTikTok;
      const minutes = format === "youtube_long" ? 8 : 1;

      // 1. Guión Estructurado (LLM)
      const scriptRes = isTikTok
        ? await scriptWriter.generateTikTokScript(topic)
        : await scriptWriter.generateYouTubeScript(topic, minutes);
      draft.videoScript = scriptRes.data;
      draft.llmModel = scriptRes.llmModel;

      // Cap de escenas: min(escenas, 3) si el tema contiene "3 escena" / "corto" / "short" / "prueba"; si no, max 5 en P0
      const isShortTest = /3\s*escena|corto|short|prueba|test|60s/i.test(topic);
      const maxScenes = isShortTest ? 3 : 5;
      const rawScenes = scriptRes.data.scenes || [];
      const numScenesToRender = Math.min(Math.max(rawScenes.length, 1), maxScenes);
      const scenesToRender = rawScenes.slice(0, numScenesToRender);

      // Dimensiones según formato
      const imgDimensions = isShort ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
      let coverImagePath: string | null = null;

      // 2. Miniatura / Portada Visual de Alto CTR (FLUX Free con fallback)
      try {
        const thumbPrompt = isTikTok
          ? `${scriptRes.data.title}, TikTok cover concept, 9:16 vertical, eye-catching, high contrast, viral aesthetic, photorealistic`
          : `${scriptRes.data.title}, YouTube thumbnail concept, eye-catching, high contrast, vibrant cinematic lighting, photorealistic`;
        const imgRes = await imageGenerator.generateImage(thumbPrompt, {
          ...imgDimensions,
          sceneIndex: 1,
          sceneTitle: scriptRes.data.title,
        });
        coverImagePath = imgRes.filePath;
        draft.imageUrls.push(imgRes.filePath);
        draft.imageProvider = imgRes.provider;
      } catch (err: any) {
        console.warn("⚠️ Falló miniatura visual:", err.message);
        draft.imageError = err.message || "Error al generar miniatura con FLUX";
      }

      // 3. Locución Completa del Guión: Hook + TODAS las escenas usadas en el MP4
      const narrationBlocks: string[] = [];
      if (scriptRes.data.hook && scriptRes.data.hook.trim().length > 0) {
        narrationBlocks.push(scriptRes.data.hook.trim());
      }
      for (const scene of scenesToRender) {
        if (scene.narration && scene.narration.trim().length > 0) {
          narrationBlocks.push(scene.narration.trim());
        }
      }
      const fullNarrationText = narrationBlocks.join("\n\n").trim();
      let realAudioDuration = 0;

      if (fullNarrationText.length > 0) {
        console.log(`🎙️ [Marketing Video] Sintetizando locución completa: Hook + ${scenesToRender.length} escenas (${fullNarrationText.length} caracteres narrados) para "${scriptRes.data.title}"...`);
        try {
          const voiceRes = await voiceStudio.generateNarration(fullNarrationText, userId);
          draft.audioUrls.push(voiceRes.audioPath);
          draft.voiceProvider = voiceRes.provider;

          // Medir y loggear duración real del audio sintetizado con ffprobe / ffmpeg
          const ffmpegBin = getFfmpegBinary();
          realAudioDuration = await getAudioDuration(voiceRes.audioPath, ffmpegBin);
          draft.realDurationSeconds = realAudioDuration;
          console.log(`🎙️ [Marketing Video] Audio sintetizado: duración real = ${realAudioDuration.toFixed(1)}s (ffprobe), caracteres narrados = ${fullNarrationText.length}, ruta = ${voiceRes.audioPath}`);
        } catch (err: any) {
          console.warn("⚠️ Falló locución completa de vídeo:", err.message);
          draft.videoError = "Error al sintetizar el audio: " + err.message;
        }
      }

      // 4. Generación de imágenes por escena (1 por escena, N = min(escenas, maxScenes))
      const sceneMediaList: SceneMediaInput[] = [];
      let networkImageCount = 0;
      let localFallbackCount = 0;
      console.log(`🎨 [Marketing Video] Generando ${scenesToRender.length} imágenes para escenas (cap max: ${maxScenes})...`);

      for (let i = 0; i < scenesToRender.length; i++) {
        const scene = scenesToRender[i];
        const sceneTitle = (scene.onScreenText || scene.visualPrompt || `Escena ${i + 1}`).slice(0, 60);
        const visualPrompt = scene.visualPrompt && scene.visualPrompt.trim().length > 0
          ? `${scriptRes.data.title}, ${scene.visualPrompt.trim()}`
          : `${scriptRes.data.title}, scene ${scene.sceneNumber || i + 1}`;

        let sceneImgPath: string | null = null;
        try {
          const imgRes = await imageGenerator.generateImage(visualPrompt, {
            ...imgDimensions,
            seed: Math.floor(Math.random() * 1000000) + (i + 1) * 333,
            sceneIndex: i + 1,
            sceneTitle,
            allowFallback: true,
          });
          sceneImgPath = imgRes.filePath;
          if (imgRes.isLocalFallback) {
            localFallbackCount++;
          } else {
            networkImageCount++;
          }
        } catch (sceneImgErr: any) {
          console.warn(`⚠️ [Marketing Video] Falló generación escena ${i + 1}: ${sceneImgErr.message}`);
        }

        if (sceneImgPath && fs.existsSync(sceneImgPath)) {
          sceneMediaList.push({
            sceneNumber: scene.sceneNumber || i + 1,
            narrationText: scene.narration || "",
            imagePath: sceneImgPath,
          });
          console.log(`🖼️ [Marketing Video] Escena ${i + 1}/${scenesToRender.length}: OK -> ${sceneImgPath}`);
        }
      }

      // Si alguna escena falló, completar con fallback local para que N escenas tengan N imágenes distintas
      if (sceneMediaList.length < scenesToRender.length) {
        const { generateLocalSceneCard } = await import("./services/imageGenerator.js");
        const tempDir = config.tempDir || "./temp";
        for (let i = sceneMediaList.length; i < scenesToRender.length; i++) {
          const fallbackPath = path.join(tempDir, `mkt_fallback_${Date.now()}_${i + 1}.jpg`);
          const scene = scenesToRender[i];
          const sceneTitle = (scene.onScreenText || scene.visualPrompt || `Escena ${i + 1}`).slice(0, 60);
          generateLocalSceneCard(fallbackPath, imgDimensions.width, imgDimensions.height, i + 1, sceneTitle);
          sceneMediaList.push({
            sceneNumber: scene.sceneNumber || i + 1,
            narrationText: scene.narration || "",
            imagePath: fallbackPath,
          });
          localFallbackCount++;
        }
      }

      const distinctImages = new Set(sceneMediaList.map(s => path.resolve(s.imagePath)));
      console.log(`📊 [Marketing Video] sceneImageCount = ${sceneMediaList.length}/${scenesToRender.length}. Distintas = ${distinctImages.size} (${networkImageCount} red, ${localFallbackCount} fallback local)`);
      console.log(`📂 [Marketing Video] Rutas:\n` + sceneMediaList.map((s, idx) => `  [Escena ${idx + 1}] ${s.imagePath}`).join("\n"));

      // Validación: si se pretendían múltiples escenas pero hay 1 sola imagen idéntica (y no se solicitó single still)
      if (scenesToRender.length > 1 && distinctImages.size <= 1) {
        const errorMsg = `Solo se obtuvo ${distinctImages.size} imagen distinta para ${scenesToRender.length} escenas. Ensamblado cancelado para evitar video estático con imagen fija.`;
        console.error(`❌ [Marketing Video] ${errorMsg}`);
        draft.videoError = errorMsg;
      } else if (draft.audioUrls.length > 0 && fs.existsSync(draft.audioUrls[0]) && sceneMediaList.length > 0) {
        try {
          console.log(`🎬 [Marketing Video] Ensamblando MP4 con ${sceneMediaList.length} escenas (${distinctImages.size} imágenes distintas, ${networkImageCount} red, ${localFallbackCount} local)...`);
          const videoRes = await videoAssembler.assembleVideo(
            sceneMediaList,
            draft.audioUrls[0],
            `mkt_video_${draftId}.mp4`,
            {
              width: imgDimensions.width,
              height: imgDimensions.height,
              timeoutMs: 150000,
            }
          );
          draft.videoPath = videoRes.videoPath;
          draft.sceneImageCount = videoRes.sceneCount;
          draft.distinctImageCount = videoRes.distinctImageCount;
          draft.networkImageCount = networkImageCount;
          draft.localFallbackImageCount = localFallbackCount;
          draft.realDurationSeconds = videoRes.durationSeconds;
        } catch (assembleErr: any) {
          console.warn("⚠️ [Marketing Video] Error ensamblando vídeo MP4 con FFmpeg:", assembleErr.message);
          draft.videoError = assembleErr.message;
        }
      } else if (draft.audioUrls.length === 0) {
        draft.videoError = "No se pudo generar la pista de audio requerida para el vídeo.";
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
