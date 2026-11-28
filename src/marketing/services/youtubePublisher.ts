import { google } from "googleapis";
import fs from "fs";
import { MarketingDraft } from "../types.js";
import { config } from "../../config/config.js";
import { dbService } from "../../database/db.js";
import { PublishResult } from "./socialPublisher.js";

const YOUTUBE_TOKEN_KEY = "youtube_oauth";

export interface StoredYouTubeToken {
  refresh_token: string;
  client_id?: string;
  client_secret?: string;
  client_mode?: "youtube" | "beta";
  channel_title?: string;
  channel_id?: string;
  updated_at?: string;
  updated_by?: number;
}

export interface YouTubePublishResult extends PublishResult {
  needsReconnect?: boolean;
  errorCode?: string;
}

function extractGoogleOAuthError(err: any): { code: string; description: string; message: string; isInvalidGrant: boolean } {
  const data = err?.response?.data;
  const code =
    (typeof data?.error === "string" ? data.error : data?.error?.status || data?.error?.message) ||
    err?.code ||
    "unknown_error";
  const description =
    data?.error_description ||
    data?.error?.message ||
    err?.message ||
    "Error desconocido de YouTube OAuth";
  const full = `${code} ${description}`.toLowerCase();
  const isInvalidGrant =
    full.includes("invalid_grant") ||
    full.includes("expired or revoked") ||
    full.includes("token has been expired") ||
    full.includes("token has been revoked");
  return {
    code: String(code),
    description: String(description),
    message: isInvalidGrant
      ? `Token de YouTube expirado o revocado (invalid_grant: ${description}). Si la app de Google Cloud está en modo "Testing/Pruebas", Google caduca los tokens cada 7 días. Reconecta con /marketing youtube.`
      : `${code}: ${description}`,
    isInvalidGrant,
  };
}

export const youtubePublisher = {
  async resolveCredentials(): Promise<{
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    source: "db" | "env";
    channelTitle?: string;
  } | null> {
    try {
      const stored = (await dbService.getSystemToken(YOUTUBE_TOKEN_KEY)) as StoredYouTubeToken | null;
      if (stored?.refresh_token) {
        const useBetaCreds = stored.client_mode === "beta" && config.oauth.betaClientId && config.oauth.betaClientSecret;
        const clientId =
          stored.client_id ||
          (useBetaCreds ? config.oauth.betaClientId : config.marketing.youtubeClientId);
        const clientSecret =
          stored.client_secret ||
          (useBetaCreds ? config.oauth.betaClientSecret : config.marketing.youtubeClientSecret);
        if (clientId && clientSecret) {
          return {
            clientId,
            clientSecret,
            refreshToken: stored.refresh_token,
            source: "db",
            channelTitle: stored.channel_title,
          };
        }
      }
    } catch {}

    const { youtubeClientId, youtubeClientSecret, youtubeRefreshToken } = config.marketing;
    if (youtubeClientId && youtubeClientSecret && youtubeRefreshToken) {
      return {
        clientId: youtubeClientId,
        clientSecret: youtubeClientSecret,
        refreshToken: youtubeRefreshToken,
        source: "env",
      };
    }
    return null;
  },

  async hasCredentials(): Promise<boolean> {
    return (await this.resolveCredentials()) !== null;
  },

  async checkAuthHealth(): Promise<{
    ok: boolean;
    source?: "db" | "env";
    channelTitle?: string;
    channelId?: string;
    errorCode?: string;
    errorDescription?: string;
    needsReconnect: boolean;
  }> {
    const creds = await this.resolveCredentials();
    if (!creds) {
      return {
        ok: false,
        errorCode: "missing_credentials",
        errorDescription: "Faltan credenciales de YouTube (YOUTUBE_CLIENT_ID / YOUTUBE_REFRESH_TOKEN).",
        needsReconnect: true,
      };
    }
    try {
      const oauth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
      oauth2Client.setCredentials({ refresh_token: creds.refreshToken });
      await oauth2Client.getAccessToken();
      let channelTitle = creds.channelTitle;
      let channelId: string | undefined;
      try {
        const yt = google.youtube({ version: "v3", auth: oauth2Client });
        const ch = await yt.channels.list({ part: ["snippet"], mine: true });
        const item = ch.data.items?.[0];
        if (item) {
          channelTitle = item.snippet?.title || item.snippet?.customUrl || channelTitle;
          channelId = item.id || undefined;
        }
      } catch {
        // Token may only have youtube.upload scope (sufficient for uploading)
      }
      return {
        ok: true,
        source: creds.source,
        channelTitle: channelTitle || "@silvania_ai",
        channelId,
        needsReconnect: false,
      };
    } catch (err: any) {
      const parsed = extractGoogleOAuthError(err);
      return {
        ok: false,
        source: creds.source,
        errorCode: parsed.code,
        errorDescription: parsed.description,
        needsReconnect: true,
      };
    }
  },

  async saveYouTubeRefreshToken(
    refreshToken: string,
    opts: {
      clientId?: string;
      clientSecret?: string;
      clientMode?: "youtube" | "beta";
      updatedBy?: number;
    } = {}
  ): Promise<{ ok: boolean; channelTitle?: string; channelId?: string; error?: string }> {
    const clientId =
      opts.clientId ||
      (opts.clientMode === "beta" ? config.oauth.betaClientId : config.marketing.youtubeClientId);
    const clientSecret =
      opts.clientSecret ||
      (opts.clientMode === "beta" ? config.oauth.betaClientSecret : config.marketing.youtubeClientSecret);

    if (!clientId || !clientSecret) {
      return { ok: false, error: "Faltan YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET en el servidor." };
    }
    const cleanToken = refreshToken.trim();
    if (!cleanToken) {
      return { ok: false, error: "Refresh token vacío." };
    }

    try {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: cleanToken });
      await oauth2Client.getAccessToken();

      let channelTitle: string | undefined;
      let channelId: string | undefined;
      try {
        const yt = google.youtube({ version: "v3", auth: oauth2Client });
        const ch = await yt.channels.list({ part: ["snippet"], mine: true });
        const item = ch.data.items?.[0];
        if (item) {
          channelTitle = item.snippet?.title || item.snippet?.customUrl || undefined;
          channelId = item.id || undefined;
        }
      } catch {}

      const payload: StoredYouTubeToken = {
        refresh_token: cleanToken,
        client_id: clientId,
        client_secret: clientSecret,
        client_mode: opts.clientMode || "youtube",
        channel_title: channelTitle || "@silvania_ai",
        channel_id: channelId,
        updated_at: new Date().toISOString(),
        updated_by: opts.updatedBy,
      };
      await dbService.saveSystemToken(YOUTUBE_TOKEN_KEY, payload);
      console.log(`✅ [YouTubePublisher] Nuevo refresh_token guardado dinámicamente para ${payload.channel_title}.`);
      return { ok: true, channelTitle: payload.channel_title, channelId };
    } catch (err: any) {
      const parsed = extractGoogleOAuthError(err);
      return { ok: false, error: parsed.message };
    }
  },

  /**
   * Sube un vídeo o Short de forma nativa al canal de YouTube oficial (@silvania_ai).
   */
  async publishVideo(draft: MarketingDraft): Promise<YouTubePublishResult> {
    const creds = await this.resolveCredentials();

    if (!creds) {
      return {
        platform: "YouTube",
        success: false,
        needsReconnect: true,
        errorCode: "missing_credentials",
        error: "Faltan credenciales de YouTube (YOUTUBE_REFRESH_TOKEN). Usa /marketing youtube para conectar el canal.",
      };
    }

    if (!draft.videoPath || !fs.existsSync(draft.videoPath)) {
      return { platform: "YouTube", success: false, error: "No hay archivo de vídeo MP4 generado para subir" };
    }

    try {
      console.log(`🎬 [YouTubePublisher] Inicializando cliente OAuth2 para YouTube (origen=${creds.source})...`);
      const oauth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
      oauth2Client.setCredentials({ refresh_token: creds.refreshToken });

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

      // Intentar subir pista de subtítulos CC (.srt) si existe y el token tiene permisos
      if (videoId && draft.srtPath && fs.existsSync(draft.srtPath)) {
        try {
          await youtube.captions.insert({
            part: ["snippet"],
            requestBody: {
              snippet: {
                videoId,
                language: "es",
                name: "Español (Silvania AI)",
                isDraft: false,
              },
            },
            media: {
              mimeType: "application/octet-stream",
              body: fs.createReadStream(draft.srtPath),
            },
          });
          console.log(`💬 [YouTubePublisher] Pista de subtítulos CC (.srt) adjuntada al vídeo ${videoId}.`);
        } catch (capErr: any) {
          console.warn(`⚠️ [YouTubePublisher] No se pudo adjuntar pista CC (el vídeo ya lleva subtítulos quemados): ${capErr?.response?.data?.error?.message || capErr.message}`);
        }
      }

      return {
        platform: "YouTube",
        success: true,
        messageId: videoId || undefined,
        url: videoUrl
      };
    } catch (err: any) {
      const parsed = extractGoogleOAuthError(err);
      console.error(`❌ [YouTubePublisher] Error al subir vídeo a YouTube (${parsed.code}): ${parsed.description}`);
      return {
        platform: "YouTube",
        success: false,
        needsReconnect: parsed.isInvalidGrant,
        errorCode: parsed.code,
        error: parsed.message,
      };
    }
  }
};

