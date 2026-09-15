import axios from "axios";
import { TwitterApi } from "twitter-api-v2";
import fs from "fs";
import { MarketingDraft, SocialPost, VideoScript } from "../types.js";
import { config } from "../../config/config.js";

export interface FormattedSocialPack {
  twitter: string;
  linkedin: string;
  facebook: string;
  tiktok: string;
  youtube: {
    title: string;
    description: string;
    tags: string;
  };
}

export interface PublishResult {
  platform: string;
  success: boolean;
  messageId?: string;
  url?: string;
  error?: string;
}

export const socialPublisher = {
  /**
   * Adapta y formatea el contenido del borrador para cada red social respetando
   * sus restricciones de longitud, estilo y algoritmos de distribución.
   */
  generateSocialPack(draft: MarketingDraft): FormattedSocialPack {
    const topic = draft.topic;
    const post: SocialPost = draft.socialContent || {
      title: draft.videoScript?.title || topic,
      copy: draft.videoScript?.description || topic,
      hashtags: draft.videoScript?.tags || ["#SilvaniaAI", "#Productividad", "#IA"],
      imagePrompt: "",
      callToAction: "Pruébalo gratis en t.me/Silvania_Core_Agent_Bot"
    };

    const tagsStr = post.hashtags.map(t => t.startsWith("#") ? t : `#${t}`).join(" ");

    // 1. X / Twitter (Máximo 280 caracteres)
    let twitterCopy = `${post.title}\n\n${post.copy.slice(0, 140)}...\n\n👉 t.me/silvania_ai ${tagsStr.split(" ").slice(0, 3).join(" ")}`;
    if (twitterCopy.length > 280) {
      twitterCopy = `${post.title}\n\n👉 t.me/silvania_ai ${tagsStr.split(" ").slice(0, 3).join(" ")}`;
    }

    // 2. LinkedIn (Estructurado, saltos de línea limpios, enfoque profesional)
    const linkedinCopy = 
      `🚀 ${post.title}\n\n` +
      `${post.copy}\n\n` +
      `💡 ¿Cómo automatizas tú estas tareas en tu día a día?\n\n` +
      `🔗 Descubre más y accede al asistente en Telegram: https://silvania.ai/coreagent\n\n` +
      `${tagsStr}`;

    // 3. Facebook (Tono conversacional, invitando a interactuar)
    const facebookCopy =
      `✨ ${post.title}\n\n` +
      `${post.copy}\n\n` +
      `👉 Pruébalo ahora mismo gratis en Telegram: https://t.me/Silvania_Core_Agent_Bot\n` +
      `📢 Únete a nuestro canal oficial de novedades: https://t.me/silvania_ai\n\n` +
      `${tagsStr}`;

    // 4. TikTok (Descripción corta + gancho + tags de alto volumen)
    const tiktokCopy = 
      `🔥 ${post.title.slice(0, 60)} | Asistente IA para Google Workspace\n` +
      `¿Lo usarías en tu oficina? Comenta 👇\n\n` +
      `#SilvaniaAI #Productividad #InteligenciaArtificial #Telegram #GoogleWorkspace #TechTok #Emprendimiento`;

    // 5. YouTube (Título SEO + Descripción con capítulos y enlaces)
    const ytTitle = draft.videoScript?.title || `${post.title} | Silvania.ai`;
    const ytDescription = 
      `En este vídeo te mostramos cómo usar Silvania CoreAgent para optimizar tu trabajo diario con Google Workspace directamente desde Telegram.\n\n` +
      `📌 Enlaces oficiales:\n` +
      `• Web: https://silvania.ai\n` +
      `• Bot en Telegram: https://t.me/Silvania_Core_Agent_Bot\n` +
      `• Canal de Novedades: https://t.me/silvania_ai\n\n` +
      `${post.copy}\n\n` +
      `Capítulos:\n00:00 Introducción y problema\n00:15 Demostración en directo\n00:45 Conclusiones y acceso\n\n` +
      `${tagsStr}`;

    return {
      twitter: twitterCopy,
      linkedin: linkedinCopy,
      facebook: facebookCopy,
      tiktok: tiktokCopy,
      youtube: {
        title: ytTitle,
        description: ytDescription,
        tags: post.hashtags.join(", ")
      }
    };
  },

  /**
   * Envía el contenido aprobado a través de Webhook unificado (Make / n8n / Zapier)
   * para distribución automática a múltiples redes (Facebook, Twitter, LinkedIn, etc.)
   */
  async dispatchToWebhook(draft: MarketingDraft, socialPack: FormattedSocialPack): Promise<PublishResult> {
    const webhookUrl = config.marketing?.webhookUrl;
    if (!webhookUrl || webhookUrl.trim().length === 0) {
      return { platform: "Webhook Multirredes", success: false, error: "No configurado (MARKETING_WEBHOOK_URL)" };
    }

    try {
      const payload = {
        draftId: draft.id,
        topic: draft.topic,
        format: draft.format,
        socialPack,
        hasImage: draft.imageUrls.length > 0,
        hasAudio: draft.audioUrls.length > 0,
        imageUrl: draft.imageUrls[0] || null,
        audioUrl: draft.audioUrls[0] || null,
        timestamp: new Date().toISOString()
      };

      const response = await axios.post(webhookUrl, payload, { timeout: 10000 });
      return { platform: "Webhook Multirredes", success: true, url: webhookUrl };
    } catch (err: any) {
      console.error("❌ Error enviando a webhook de marketing:", err.message);
      return { platform: "Webhook Multirredes", success: false, error: err.message };
    }
  },

  /**
   * Publica de forma directa en Facebook Page mediante Meta Graph API (si está configurado)
   */
  async publishToFacebook(message: string): Promise<PublishResult> {
    const pageToken = config.marketing?.facebookPageAccessToken;
    const pageId = config.marketing?.facebookPageId;

    if (!pageToken || !pageId) {
      return { platform: "Facebook", success: false, error: "Faltan claves (FACEBOOK_PAGE_ACCESS_TOKEN / FACEBOOK_PAGE_ID)" };
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
      const res = await axios.post(url, {
        message,
        access_token: pageToken
      });
      return { platform: "Facebook", success: true, messageId: res.data?.id };
    } catch (err: any) {
      console.error("❌ Error publicando en Facebook:", err.response?.data?.error?.message || err.message);
      return { platform: "Facebook", success: false, error: err.response?.data?.error?.message || err.message };
    }
  },

  /**
   * Publica de forma directa y nativa en X (Twitter) usando Twitter API v2
   */
  async publishToTwitter(text: string, imagePath?: string): Promise<PublishResult> {
    const { twitterApiKey, twitterApiSecret, twitterAccessToken, twitterAccessSecret } = config.marketing;

    if (!twitterApiKey || !twitterApiSecret || !twitterAccessToken || !twitterAccessSecret) {
      return { platform: "X (Twitter)", success: false, error: "Faltan claves de X en variables de entorno" };
    }

    try {
      console.log("🐦 [Marketing] Publicando tweet en @Silvania_AI...");
      const client = new TwitterApi({
        appKey: twitterApiKey,
        appSecret: twitterApiSecret,
        accessToken: twitterAccessToken,
        accessSecret: twitterAccessSecret,
      });

      const rwClient = client.readWrite;
      let tweetRes: any;

      if (imagePath && fs.existsSync(imagePath)) {
        try {
          const mediaId = await client.v1.uploadMedia(imagePath);
          tweetRes = await rwClient.v2.tweet({
            text: text.slice(0, 280),
            media: { media_ids: [mediaId] }
          });
        } catch (mediaErr: any) {
          console.warn("⚠️ Falló subida de imagen a Twitter, publicando solo texto:", mediaErr.message);
          tweetRes = await rwClient.v2.tweet(text.slice(0, 280));
        }
      } else {
        tweetRes = await rwClient.v2.tweet(text.slice(0, 280));
      }

      const tweetId = tweetRes?.data?.id;
      const tweetUrl = tweetId ? `https://x.com/Silvania_AI/status/${tweetId}` : undefined;
      console.log(`✅ Tweet publicado con éxito: ${tweetUrl || tweetId}`);
      return { platform: "X (Twitter)", success: true, messageId: tweetId, url: tweetUrl };
    } catch (err: any) {
      console.error("❌ Error publicando en X (Twitter):", err?.data || err.message);
      return { platform: "X (Twitter)", success: false, error: err?.data?.detail || err.message };
    }
  }
};
