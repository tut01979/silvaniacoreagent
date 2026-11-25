import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Bot } from "grammy";
import { ContentFormat, MarketingDraft, SocialPlatform, CampaignPackDraft } from "./types.js";
import { marketingDb } from "./database.js";
import { scriptWriter } from "./services/scriptWriter.js";
import { imageGenerator } from "./services/imageGenerator.js";
import { voiceStudio } from "./services/voiceStudio.js";
import { videoAssembler, SceneMediaInput, getAudioDuration, getFfmpegBinary, VisualStylePreset } from "./services/videoAssembler.js";
import { telegramReview } from "./telegramReview.js";
import { config } from "../config/config.js";
import { visualAssetSelector } from "./services/visualAssetSelector.js";
import { musicAssetSelector } from "./services/musicAssetSelector.js";
import { brandDriveAssets } from "./services/brandDriveAssets.js";
import { generateTimedSrtAndTranscript } from "./services/subtitleGenerator.js";

export const marketingManager = {
  /**
   * Genera un nuevo borrador de marketing optimizado para bajo coste y alta calidad,
   * y envía la tarjeta de aprobación Human-in-the-Loop a Telegram.
   */
  async createAndReviewDraft(
    topic: string,
    format: ContentFormat,
    userId: number,
    bot: Bot,
    options: { targetPlatform?: SocialPlatform; requestedScenes?: number } = {}
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
      targetPlatform: options.targetPlatform || "generic",
      createdAt: now,
      updatedAt: now,
    };

    const targetProduct = visualAssetSelector.detectProduct(topic);

    // 0. Revisar siempre Google Drive primero: verificar/crear carpetas canónicas y cargar marca/activos propios
    const brandBundle = await brandDriveAssets.loadBrandContextAndAssets(
      userId,
      topic,
      format === "social_post" ? 1 : 6
    );
    const brandParts: string[] = [];
    if (brandBundle.intrinsicCount > 0) brandParts.push(`${brandBundle.intrinsicCount} intrínsecas`);
    if (brandBundle.bankCount > 0) brandParts.push(`${brandBundle.bankCount} banco Drive`);
    if (brandParts.length > 0) {
      draft.brandDriveSummary = brandParts.join(" + ");
    }

    try {
    if (format === "social_post") {
      // 1. Redacción de Post y Prompt de Imagen (LLM) adaptado a la red elegida
      const targetPlatform = options.targetPlatform || "generic";
      draft.targetPlatform = targetPlatform;
      const scriptRes = await scriptWriter.generateSocialPost(topic, undefined, targetPlatform, brandBundle.brandRulesText || undefined);
      draft.socialContent = scriptRes.data;
      draft.llmModel = scriptRes.llmModel;

      // 2. Imagen: priorizar banco visual propio en Drive si existe; si no, FLUX / banco vectorial
      if (brandBundle.bankImages.length > 0 && fs.existsSync(brandBundle.bankImages[0].localPath)) {
        const tempMediaDir = path.resolve(process.cwd(), "temp_media");
        fs.mkdirSync(tempMediaDir, { recursive: true });
        const ext = path.extname(brandBundle.bankImages[0].localPath) || ".jpg";
        const persistentPostImg = path.join(tempMediaDir, `mkt_drive_post_${Date.now()}${ext}`);
        fs.copyFileSync(brandBundle.bankImages[0].localPath, persistentPostImg);
        draft.imageUrls.push(persistentPostImg);
        draft.imageProvider = "drive_banco_visual";
      } else {
        try {
          const imgRes = await imageGenerator.generateImage(`${topic} ${scriptRes.data.imagePrompt}`, {
            width: 1200,
            height: 675,
            sceneIndex: 1,
            totalScenes: 1,
            sceneTitle: scriptRes.data.title,
            product: targetProduct,
          });
          draft.imageUrls.push(imgRes.filePath);
          draft.imageProvider = imgRes.provider;
        } catch (err: any) {
          console.warn("⚠️ Falló generación de imagen:", err.message);
          draft.imageError = err.message || "Error al generar imagen con FLUX";
        }
      }

      // 3. Generación de Audio (Edge-TTS Free por defecto)
      try {
        const voiceRes = await voiceStudio.generateNarration(scriptRes.data.copy, userId);
        draft.audioUrls.push(voiceRes.audioPath);
        draft.voiceProvider = voiceRes.provider;
      } catch (err: any) {
        console.warn("⚠️ Falló generación de audio:", err.message);
      }
    } else if (format === "youtube_long" || format === "youtube_short" || format === "tiktok" || format === "whatsapp_video") {
      const isTikTok = format === "tiktok";
      const isWhatsApp = format === "whatsapp_video";
      const isShort = format === "youtube_short" || isTikTok || isWhatsApp;
      const durationMatch = topic.match(/(\d+(?:[.,]\d+)?)\s*(?:min(?:utos?)?|m\b)/i);
      const parsedMinutes = durationMatch ? parseFloat(durationMatch[1].replace(",", ".")) : null;
      const minutes = isShort
        ? 1
        : parsedMinutes && parsedMinutes > 0
          ? Math.min(15, Math.max(1, parsedMinutes))
          : 2;

      // 1. Guión Estructurado (LLM)
      const scriptRes = isWhatsApp
        ? await scriptWriter.generateWhatsAppVideoScript(topic, undefined, brandBundle.brandRulesText || undefined)
        : isTikTok
          ? await scriptWriter.generateTikTokScript(topic, undefined, brandBundle.brandRulesText || undefined)
          : await scriptWriter.generateYouTubeScript(topic, minutes, brandBundle.brandRulesText || undefined);
      draft.videoScript = scriptRes.data;
      draft.llmModel = scriptRes.llmModel;

      // Cap y selección de escenas según la red y duración pedida:
      // - YouTube (16:9): Capacidad extendida de hasta 30 escenas si se solicitan escenas o minutos largos (ej. 5 min -> ~13 escenas)
      // - WhatsApp (9:16): 3 escenas ágiles (~30 segundos)
      // - TikTok / Short (9:16): Condensado ágil a 3-4 escenas de alto impacto
      const isShortTest = /3\s*escena|corto|short|prueba|test|60s/i.test(topic);
      const explicitScenesMatch = topic.match(/(?:(\d+))\s*(?:escenas?|im[aá]genes?|fotos?)/i);
      const parsedRequested = explicitScenesMatch ? parseInt(explicitScenesMatch[1], 10) : options.requestedScenes;

      let maxScenes = 5;
      if (isWhatsApp) {
        maxScenes = 3;
      } else if (isTikTok || isShort) {
        maxScenes = 4;
      } else if (parsedRequested && parsedRequested > 0) {
        maxScenes = Math.min(30, Math.max(1, parsedRequested));
      } else if (isShortTest) {
        maxScenes = 3;
      } else if (parsedMinutes && parsedMinutes >= 3) {
        maxScenes = Math.min(20, Math.max(8, Math.round(minutes * 2.5)));
      } else {
        maxScenes = 8;
      }

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
          product: targetProduct,
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
      let sceneDurations: number[] = [];

      if (scenesToRender.length > 0) {
        console.log(`🎙️ [Marketing Video] Sintetizando locución estructurada con pausas y tempo dinámico: Hook + ${scenesToRender.length} escenas para "${scriptRes.data.title}"...`);
        try {
          const pacedRes = await voiceStudio.generatePacedNarration(
            scenesToRender.map((s, idx) => ({ sceneNumber: s.sceneNumber || idx + 1, narration: s.narration || "" })),
            scriptRes.data.hook,
            userId,
            { pauseSeconds: 0.35, tempo: 1.06 }
          );
          draft.audioUrls.push(pacedRes.audioPath);
          draft.voiceProvider = pacedRes.provider;
          realAudioDuration = pacedRes.totalDurationSeconds;
          draft.realDurationSeconds = realAudioDuration;
          sceneDurations = pacedRes.sceneDurations;
          console.log(`🎙️ [Marketing Video] Audio sintetizado: duración real = ${realAudioDuration.toFixed(1)}s (ffprobe), pausas = 350ms, tempo = x1.06, ruta = ${pacedRes.audioPath}`);
        } catch (err: any) {
          console.warn("⚠️ Falló locución estructurada, usando modo directo:", err.message);
          try {
            const voiceRes = await voiceStudio.generateNarration(fullNarrationText, userId);
            draft.audioUrls.push(voiceRes.audioPath);
            draft.voiceProvider = voiceRes.provider;
            const ffmpegBin = getFfmpegBinary();
            realAudioDuration = await getAudioDuration(voiceRes.audioPath, ffmpegBin);
            draft.realDurationSeconds = realAudioDuration;
          } catch (voiceErr: any) {
            draft.videoError = "Error al sintetizar el audio: " + voiceErr.message;
          }
        }

        // 3B. Generación automática de subtítulos .srt y transcripción completa
        if (draft.audioUrls.length > 0 && realAudioDuration > 0) {
          try {
            const effectiveDurations = sceneDurations.length === scenesToRender.length
              ? sceneDurations
              : scenesToRender.map(() => Number((realAudioDuration / scenesToRender.length).toFixed(2)));
            const srtRes = generateTimedSrtAndTranscript(scenesToRender, effectiveDurations, scriptRes.data.hook, 0.35);
            draft.srtPath = srtRes.srtPath;
            draft.transcriptText = srtRes.transcriptText;
            console.log(`💬 [Marketing Video] Subtítulos .srt generados (${srtRes.cueCount} bloques): ${srtRes.srtPath}`);
          } catch (srtErr: any) {
            console.warn("⚠️ No se pudo generar .srt:", srtErr.message);
          }
        }
      }

      // 4. Generación de imágenes por escena (1 por escena, N = min(escenas, maxScenes))
      console.log(`🎯 [Marketing Video] Producto y marca identificados: ${targetProduct.toUpperCase()} (Tema: "${topic}")`);

      const sceneMediaList: SceneMediaInput[] = [];
      const usedImages: string[] = [];
      let networkImageCount = 0;
      let localFallbackCount = 0;
      console.log(`🎨 [Marketing Video] Generando ${scenesToRender.length} imágenes para escenas (cap max: ${maxScenes})...`);

      // Planificar todos los beats visuales primero para ubicar con precisión inicio, medio y cierre intrínsecos
      const beatPlans: Array<{
        sceneIdx: number;
        beatIdxInScene: number;
        beatCount: number;
        beatDur: number;
        scene: any;
        beatSnippet: string;
      }> = [];

      for (let i = 0; i < scenesToRender.length; i++) {
        const scene = scenesToRender[i];
        const baseDur = sceneDurations[i] || 8;
        // Subdividir escenas largas (>10s) en cortes visuales de ~7-9s para que las imágenes cambien dinámicamente
        const beatCount = baseDur > 10 ? Math.min(4, Math.max(2, Math.round(baseDur / 8))) : 1;
        const beatDur = Number((baseDur / beatCount).toFixed(2));
        const narrationSentences = (scene.narration || "").split(/(?<=[.!?])\s+/).filter(Boolean);

        for (let b = 0; b < beatCount; b++) {
          const beatSnippet =
            narrationSentences.length > 0
              ? narrationSentences[Math.min(narrationSentences.length - 1, Math.floor((b / beatCount) * narrationSentences.length))]
              : scene.narration || "";
          beatPlans.push({
            sceneIdx: i,
            beatIdxInScene: b,
            beatCount,
            beatDur,
            scene,
            beatSnippet,
          });
        }
      }

      const totalBeats = beatPlans.length;
      const middleBeatIdx = Math.floor(totalBeats / 2);
      const lastBeatIdx = totalBeats - 1;
      let bankCursor = 0;

      const wantsOutroLogo = /logo.*final|principio.*final|al final.*logo|silvania\.ai/i.test(topic);
      const explicitTopicProduct = visualAssetSelector.detectExplicitCommercialProduct(topic);
      const isPureStory = !explicitTopicProduct;
      let lastSelectedCategory = "";
      const effectiveOutroPath =
        brandBundle.outroImagePath && fs.existsSync(brandBundle.outroImagePath)
          ? brandBundle.outroImagePath
          : wantsOutroLogo && brandBundle.introImagePath && fs.existsSync(brandBundle.introImagePath)
            ? brandBundle.introImagePath
            : null;

      for (let idx = 0; idx < beatPlans.length; idx++) {
        const plan = beatPlans[idx];
        const { sceneIdx: i, beatIdxInScene: b, beatCount, beatDur, scene, beatSnippet } = plan;

        let sceneImgPath: string | null = null;
        if (idx === 0 && brandBundle.introImagePath && fs.existsSync(brandBundle.introImagePath)) {
          sceneImgPath = brandBundle.introImagePath;
          console.log(`🏷️ [BrandDrive] Beat ${idx + 1}/${totalBeats}: Imagen intrínseca 01_inicio aplicada.`);
        } else if (idx === lastBeatIdx && effectiveOutroPath) {
          sceneImgPath = effectiveOutroPath;
          console.log(`🏷️ [BrandDrive] Beat ${idx + 1}/${totalBeats}: Logo/cierre final aplicado (${path.basename(effectiveOutroPath)}).`);
        } else if (totalBeats >= 3 && idx === middleBeatIdx && brandBundle.middleImagePath && fs.existsSync(brandBundle.middleImagePath)) {
          sceneImgPath = brandBundle.middleImagePath;
          console.log(`🏷️ [BrandDrive] Beat ${idx + 1}/${totalBeats}: Imagen intrínseca 02_medio aplicada.`);
        } else if (bankCursor < brandBundle.bankImages.length && fs.existsSync(brandBundle.bankImages[bankCursor].localPath)) {
          sceneImgPath = brandBundle.bankImages[bankCursor].localPath;
          console.log(`📂 [BrandDrive] Beat ${idx + 1}/${totalBeats}: Imagen propia '${brandBundle.bankImages[bankCursor].name}'.`);
          bankCursor++;
        } else {
          const sceneNarrativeContext = `${scene.onScreenText || ""} ${beatSnippet} ${scene.narration || ""}`.trim();
          const normSceneCtx = sceneNarrativeContext
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          let sceneProduct = explicitTopicProduct || undefined;
          if (/\bcoreagent\b|\bcore agent\b|gmail|calendar|google drive|ordenes por voz|asistente ejecutivo|productividad profesional/.test(normSceneCtx)) {
            sceneProduct = "coreagent";
          } else if (/\beva\b|ninos|jugando|escuela|escolar|profesora|fonema|logopedia|infantil/.test(normSceneCtx)) {
            sceneProduct = "eva";
          } else if (/marketing studio|marketing agent|campana publicitaria|hitl/.test(normSceneCtx)) {
            sceneProduct = "marketing";
          }

          const visualPrompt = scene.visualPrompt && scene.visualPrompt.trim().length > 0
            ? `${beatSnippet}. ${scene.visualPrompt.trim()}`
            : `${beatSnippet || scriptRes.data.title}`;

          try {
            const imgRes = await imageGenerator.generateImage(visualPrompt, {
              ...imgDimensions,
              seed: Math.floor(Math.random() * 1000000) + (i + 1) * 333 + b * 77,
              sceneIndex: sceneMediaList.length + 1,
              totalScenes: totalBeats,
              sceneTitle: `${scene.onScreenText || `Escena ${i + 1}`} ${beatSnippet}`.trim(),
              onScreenText: scene.onScreenText,
              subtitle: beatSnippet || scene.narration,
              allowFallback: true,
              product: sceneProduct,
              usedImages,
              targetEmotion: scene.visualMood || "",
              visualConcepts: Array.isArray(scene.visualConcepts) ? scene.visualConcepts : [],
              lastCategory: lastSelectedCategory,
              pureStorytelling: isPureStory,
            });
            lastSelectedCategory = imgRes.category || "";
            sceneImgPath = imgRes.filePath;
            if (imgRes.sourceAssetPath) {
              usedImages.push(imgRes.sourceAssetPath);
            }
            usedImages.push(imgRes.filePath);
            if (imgRes.isLocalFallback || imgRes.provider === "corporate_slide_canvas") {
              localFallbackCount++;
            } else {
              networkImageCount++;
            }
          } catch (sceneImgErr: any) {
            console.warn(`⚠️ [Marketing Video] Falló generación escena ${i + 1}.${b + 1}: ${sceneImgErr.message}`);
          }
        }

        if (sceneImgPath && fs.existsSync(sceneImgPath)) {
          sceneMediaList.push({
            sceneNumber: sceneMediaList.length + 1,
            narrationText: beatSnippet || scene.narration || "",
            imagePath: sceneImgPath,
            durationSeconds: beatDur,
          });
          console.log(`🖼️ [Marketing Video] Escena ${i + 1}.${b + 1}/${beatCount}: OK -> ${sceneImgPath} (${beatDur}s)`);
        }
      }

      // Si alguna escena falló, completar con fallback local para que N escenas tengan N imágenes distintas
      if (sceneMediaList.length < scenesToRender.length) {
        const { generateLocalSceneCard } = await import("./services/imageGenerator.js");
        const tempDir = config.tempDir || "./temp";
        for (let i = sceneMediaList.length; i < scenesToRender.length; i++) {
          const fallbackPath = path.join(tempDir, `mkt_fallback_${Date.now()}_${i + 1}.jpg`);
          const scene = scenesToRender[i];
          const sceneTitle = scene.onScreenText || `Escena ${i + 1}`;
          await generateLocalSceneCard(fallbackPath, imgDimensions.width, imgDimensions.height, i + 1, sceneTitle, scene.onScreenText, scenesToRender.length, scene.narration, targetProduct);
          sceneMediaList.push({
            sceneNumber: scene.sceneNumber || i + 1,
            narrationText: scene.narration || "",
            imagePath: fallbackPath,
            durationSeconds: sceneDurations[i],
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
          const fullNarrationText = scenesToRender.map((s: any) => s.narration || "").join(" ");
          const selectedMusic = musicAssetSelector.selectMusicForScript({
            product: targetProduct,
            topic,
            scriptText: fullNarrationText,
          });
          if (selectedMusic) {
            console.log(`🎵 [Marketing Video] Música seleccionada: ${selectedMusic.matchReason}`);
            draft.selectedMusicTitle = `${selectedMusic.title} (${selectedMusic.category})`;
            draft.selectedMusicReason = selectedMusic.matchReason;
          }

          const normalizedTopic = topic
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          let visualStyle: VisualStylePreset = "cinema_warm";
          if (/(pelicula vieja|vintage|retro|sepia|antiguo|clasico|blanco y negro)/.test(normalizedTopic)) {
            visualStyle = "vintage_film";
          } else if (targetProduct === "eva") {
            visualStyle = "modern_clean";
          } else if (targetProduct === "coreagent") {
            visualStyle = "high_contrast_tech";
          }
          const styleLabels: Record<VisualStylePreset, string> = {
            vintage_film: "Película Vieja (vintage)",
            high_contrast_tech: "Tech Alto Contraste",
            cinema_warm: "Cine Cálido",
            modern_clean: "Limpio Moderno",
          };
          draft.visualStyle = visualStyle;
          draft.visualEffectsSummary = `Zoom/Pan Ken Burns + transiciones xfade + estilo ${styleLabels[visualStyle]}`;

          console.log(`🎬 [Marketing Video] Ensamblando MP4 con ${sceneMediaList.length} escenas (${distinctImages.size} imágenes distintas, estilo=${visualStyle}, zoom+xfade activos)...`);
          const videoRes = await videoAssembler.assembleVideo(
            sceneMediaList,
            draft.audioUrls[0],
            `mkt_video_${draftId}.mp4`,
            {
              width: imgDimensions.width,
              height: imgDimensions.height,
              timeoutMs: Math.max(150000, scenesToRender.length * 15000),
              musicTrackPath: selectedMusic?.filePath,
              musicVolume: 0.14,
              visualStyle,
              enableZoomPan: true,
              transitionStyle: "auto",
              srtPath: draft.srtPath,
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
    } finally {
      brandBundle.cleanup();
    }

    // Persistir en SQLite
    marketingDb.saveDraft(draft);

    // Notificar al administrador con la tarjeta interactiva
    await telegramReview.sendReviewCard(bot, draft);

    return draft;
  },

  /**
   * Genera una campaña omnicanal unificada a partir de un único tema/concepto:
   * 1. YouTube Largo (16:9): vídeo extendido (soporta hasta 30 escenas si se solicitan, o duración >= 2 min).
   * 2. TikTok / Shorts (9:16): píldora vertical de alta retención (3-4 microescenas, ~40s).
   * 3. LinkedIn Post: copy profesional con storytelling y aprendizajes de negocio.
   * 4. X (Twitter) Post: gancho viral de alto impacto estrictamente < 280 caracteres.
   * 5. Telegram Post: resumen digest visual con viñetas para lectura en 20 segundos en el canal.
   */
  async createCampaignPack(topic: string, userId: number, bot: Bot): Promise<CampaignPackDraft> {
    const packId = crypto.randomUUID();
    const now = new Date().toISOString();

    console.log(`📦 [MarketingManager] Generando Campaña Omnicanal para "${topic}"...`);

    // Notificar al usuario que la campaña está en progreso
    await bot.api.sendMessage(
      userId,
      `🚀 *Campaña Omnicanal en Marcha...*\n\n` +
      `Generando ecosistema de contenidos multired para:\n` +
      `📌 _"${topic}"_\n\n` +
      `• 🎬 *YouTube Largo (16:9)*: Formato extendido (admite hasta 30 escenas y duración > 2 min)\n` +
      `• 📱 *TikTok / Shorts (9:16)*: Formato vertical condensado (3-4 escenas, ~40s)\n` +
      `• 💚 *WhatsApp 30s (9:16)*: Vídeo vertical de 30s con CTA + texto persuasivo\n` +
      `• 💼 *LinkedIn*: Storytelling B2B y aprendizajes\n` +
      `• 𝕏 *X / Twitter*: Gancho viral de síntesis (< 280 caracteres)\n` +
      `• ✈️ *Telegram*: Resumen digest para el canal\n\n` +
      `_Recibirás cada creativo arriba conforme se finalice..._`,
      { parse_mode: "Markdown" }
    ).catch(() => {});

    // 1. YouTube Largo (16:9)
    let youtubeLongDraft: MarketingDraft | undefined;
    try {
      youtubeLongDraft = await this.createAndReviewDraft(topic, "youtube_long", userId, bot);
    } catch (err: any) {
      console.warn("⚠️ Falló borrador de YouTube en campaña:", err.message);
    }

    // 2. TikTok / Short (9:16)
    let tiktokShortDraft: MarketingDraft | undefined;
    try {
      tiktokShortDraft = await this.createAndReviewDraft(topic, "tiktok", userId, bot);
    } catch (err: any) {
      console.warn("⚠️ Falló borrador de TikTok en campaña:", err.message);
    }

    // 2.5 WhatsApp 30s (9:16) + Texto Persuasivo
    let whatsappVideoDraft: MarketingDraft | undefined;
    try {
      whatsappVideoDraft = await this.createAndReviewDraft(topic, "whatsapp_video", userId, bot);
    } catch (err: any) {
      console.warn("⚠️ Falló borrador de WhatsApp 30s en campaña:", err.message);
    }

    // 3. LinkedIn Post
    let linkedinPostDraft: MarketingDraft | undefined;
    try {
      linkedinPostDraft = await this.createAndReviewDraft(topic, "social_post", userId, bot, { targetPlatform: "linkedin" });
    } catch (err: any) {
      console.warn("⚠️ Falló borrador de LinkedIn en campaña:", err.message);
    }

    // 4. X (Twitter) Post
    let xPostDraft: MarketingDraft | undefined;
    try {
      xPostDraft = await this.createAndReviewDraft(topic, "social_post", userId, bot, { targetPlatform: "x" });
    } catch (err: any) {
      console.warn("⚠️ Falló borrador de X en campaña:", err.message);
    }

    // 5. Telegram Digest Post
    let telegramPostDraft: MarketingDraft | undefined;
    try {
      telegramPostDraft = await this.createAndReviewDraft(topic, "social_post", userId, bot, { targetPlatform: "telegram" });
    } catch (err: any) {
      console.warn("⚠️ Falló borrador de Telegram en campaña:", err.message);
    }

    const campaignPack: CampaignPackDraft = {
      id: packId,
      userId,
      topic,
      createdAt: now,
      youtubeLongDraft,
      tiktokShortDraft,
      whatsappVideoDraft,
      linkedinPostDraft,
      xPostDraft,
      telegramPostDraft,
    };

    // Enviar tarjeta resumen de la campaña omnicanal
    await telegramReview.sendCampaignPackCard(bot, campaignPack);

    return campaignPack;
  },

  /**
   * Obtiene el último borrador del usuario para consultar estado con /marketing status.
   */
  getLastDraft(userId: number): MarketingDraft | null {
    const drafts = marketingDb.listUserDrafts(userId, 1);
    return drafts.length > 0 ? drafts[0] : null;
  },
};
