import { google } from "googleapis";
import fs from "fs";
import { MarketingDraft } from "../types.js";
import { config } from "../../config/config.js";
import { PublishResult } from "./socialPublisher.js";

export const youtubePublisher = {
  /**
   * Sube un vídeo o Short de forma nativa al canal de YouTube oficial (@silvania_ai).
   */
  async publishVideo(draft: MarketingDraft): Promise<PublishResult> {
    const { youtubeClientId, youtubeClientSecret, youtubeRefreshToken } = config.marketing;

    if (!youtubeClientId || !youtubeClientSecret || !youtubeRefreshToken) {
      return { platform: "YouTube", success: false, error: "Faltan credenciales de YouTube (YOUTUBE_REFRESH_TOKEN)" };
    }

    if (!draft.videoPath || !fs.existsSync(draft.videoPath)) {
      return { platform: "YouTube", success: false, error: "No hay archivo de vídeo MP4 generado para subir" };
    }

    try {
      console.log(`🎬 [YouTubePublisher] Inicializando cliente OAuth2 para YouTube...`);
      const oauth2Client = new google.auth.OAuth2(youtubeClientId, youtubeClientSecret);
      oauth2Client.setCredentials({ refresh_token: youtubeRefreshToken });

      const youtube = google.youtube({ version: "v3", auth: oauth2Client });

      const isShort = draft.format === "youtube_short" || draft.format === "tiktok";
      let title = draft.videoScript?.title || draft.topic;

      // Optimizar título para Shorts si aplica
      if (isShort && !title.toLowerCase().includes("#shorts")) {
        title = `${title.slice(0, 90)} #Shorts`;
      }

      const description = draft.videoScript?.description ||
        `${title}\n\n` +
        `🚀 Tu oficina ejecutiva en Telegram con Google Workspace: https://silvania.ai\n` +
        `📢 Canal oficial en Telegram: https://t.me/silvania_ai\n\n` +
        `#SilvaniaAI #Productividad #Telegram #GoogleWorkspace #IA`;

      const tags = draft.videoScript?.tags || [
        "SilvaniaAI",
        "Productividad",
        "Google Workspace",
        "Telegram",
        "Inteligencia Artificial",
        "CoreAgent"
      ];

      console.log(`🎬 [YouTubePublisher] Subiendo vídeo MP4 (${draft.videoPath}) a @silvania_ai: "${title}"...`);

      const res = await youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title: title.slice(0, 100),
            description: description.slice(0, 5000),
            tags: tags.slice(0, 20),
            categoryId: "28", // Science & Technology
            defaultLanguage: "es",
            defaultAudioLanguage: "es"
          },
          status: {
            privacyStatus: "public",
            selfDeclaredMadeForKids: false
          }
        },
        media: {
          body: fs.createReadStream(draft.videoPath)
        }
      });

      const videoId = res.data.id;
      const videoUrl = isShort
        ? `https://www.youtube.com/shorts/${videoId}`
        : `https://www.youtube.com/watch?v=${videoId}`;

      console.log(`✅ [YouTubePublisher] ¡Vídeo publicado con éxito en @silvania_ai! URL: ${videoUrl}`);

      return {
        platform: "YouTube",
        success: true,
        messageId: videoId || undefined,
        url: videoUrl
      };
    } catch (err: any) {
      console.error("❌ [YouTubePublisher] Error al subir vídeo a YouTube:", err.response?.data?.error?.message || err.message);
      return {
        platform: "YouTube",
        success: false,
        error: err.response?.data?.error?.message || err.message
      };
    }
  }
};
