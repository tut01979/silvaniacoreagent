import axios from "axios";
import { TwitterApi } from "twitter-api-v2";
import fs from "fs";
import path from "path";
import { MarketingDraft, SocialPost, VideoScript } from "../types.js";
import { config } from "../../config/config.js";

export interface FormattedSocialPack {
  twitter: string;
  linkedin: string;
  facebook: string;
  instagram: string;
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

/**
 * Calcula la longitud ponderada de un tweet según las reglas oficiales de X (Twitter):
 * - URLs (http/https/t.me) cuentan exactamente 23 caracteres.
 * - Emojis y caracteres de planos extendidos cuentan 2 caracteres.
 * - Caracteres ASCII estándar cuentan 1 carácter.
 */
export function getTwitterWeightedLength(text: string): number {
  const urlRegex = /https?:\/\/[^\s]+|t\.me\/[^\s]+/gi;
  const withoutUrls = text.replace(urlRegex, "");
  const urlCount = (text.match(urlRegex) || []).length;
  let len = urlCount * 23;
  for (const ch of withoutUrls) {
    const code = ch.codePointAt(0) || 0;
    if (code > 0x7FF || ch.length > 1 || /[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(ch)) {
      len += 2;
    } else {
      len += 1;
    }
  }
  return len;
}

/**
 * Trunca un texto de forma inteligente para que nunca exceda el límite de X (280 chars ponderados)
 */
export function truncateForTwitter(text: string, maxWeighted: number = 265): string {
  if (getTwitterWeightedLength(text) <= maxWeighted) return text;
  let trimmed = text.trim();
  while (getTwitterWeightedLength(`${trimmed}...`) > maxWeighted && trimmed.length > 20) {
    const lastSpace = trimmed.lastIndexOf(" ");
    if (lastSpace > 15) {
      trimmed = trimmed.slice(0, lastSpace).trim();
    } else {
      trimmed = trimmed.slice(0, -5).trim();
    }
  }
  return `${trimmed}...`;
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

    const cleanTitle = post.title.replace(/\*\*/g, "").trim();
    const cleanCopy = post.copy.replace(/\*\*/g, "").trim();
    const tagsStr = post.hashtags
      .map(t => (t.startsWith("#") ? t : `#${t}`).replace(/\s+/g, ""))
      .join(" ");

    // 1. X / Twitter (Máximo 280 caracteres ponderados, margen de seguridad a 260)
    const fixedTwitterCta = `👉 t.me/silvania_ai ${tagsStr.split(" ").slice(0, 2).join(" ")}`.trim();
    const ctaWeighted = getTwitterWeightedLength(fixedTwitterCta);
    const availableForTitleAndBody = 255 - ctaWeighted - 4; // 4 por los saltos de línea

    let mainText = cleanTitle;
    if (cleanCopy && cleanTitle.length < 80) {
      const remaining = availableForTitleAndBody - getTwitterWeightedLength(cleanTitle) - 4;
      if (remaining > 30) {
        mainText = `${cleanTitle}\n\n${cleanCopy.slice(0, remaining)}...`;
      }
    }
    const truncatedMain = truncateForTwitter(mainText, availableForTitleAndBody);
    const twitterCopy = `${truncatedMain}\n\n${fixedTwitterCta}`.trim();

    // 2. LinkedIn (Estructurado, saltos de línea limpios, enfoque profesional)
    const linkedinCopy = 
      `🚀 ${cleanTitle}\n\n` +
      `${cleanCopy}\n\n` +
      `💡 ¿Cómo automatizas tú estas tareas en tu día a día?\n\n` +
      `🔗 Descubre más y accede al asistente en Telegram: https://silvania.ai/coreagent\n\n` +
      `${tagsStr}`;

    // 3. Facebook (Tono conversacional, invitando a interactuar)
    const facebookCopy =
      `✨ ${cleanTitle}\n\n` +
      `${cleanCopy}\n\n` +
      `👉 Pruébalo ahora mismo gratis en Telegram: https://t.me/Silvania_Core_Agent_Bot\n` +
      `📢 Únete a nuestro canal oficial de novedades: https://t.me/silvania_ai\n\n` +
      `${tagsStr}`;

    // 4. Instagram (Enfoque visual, invitando al link en bio y bot)
    const instagramCopy =
      `✨ ${cleanTitle}\n\n` +
      `${cleanCopy}\n\n` +
      `🔗 Enlace en bio: silvania.ai\n` +
      `👉 Pruébalo gratis en Telegram: @Silvania_Core_Agent_Bot\n\n` +
      `${tagsStr}`;

    // 5. TikTok (Descripción corta + gancho + tags de alto volumen)
    const tiktokCopy = 
      `🔥 ${cleanTitle.slice(0, 60)} | Asistente IA para Google Workspace\n` +
      `¿Lo usarías en tu oficina? Comenta 👇\n\n` +
      `#SilvaniaAI #Productividad #InteligenciaArtificial #Telegram #GoogleWorkspace #TechTok #Emprendimiento`;

    // 6. YouTube (Título SEO + Descripción con capítulos y enlaces)
    const ytTitle = draft.videoScript?.title || `${cleanTitle} | Silvania.ai`;
    const ytDescription = 
      `En este vídeo te mostramos cómo usar Silvania CoreAgent para optimizar tu trabajo diario con Google Workspace directamente desde Telegram.\n\n` +
      `📌 Enlaces oficiales:\n` +
      `• Web: https://silvania.ai\n` +
      `• Bot en Telegram: https://t.me/Silvania_Core_Agent_Bot\n` +
      `• Canal de Novedades: https://t.me/silvania_ai\n\n` +
      `${cleanCopy}\n\n` +
      `Capítulos:\n00:00 Introducción y problema\n00:15 Demostración en directo\n00:45 Conclusiones y acceso\n\n` +
      `${tagsStr}`;

    return {
      twitter: twitterCopy,
      linkedin: linkedinCopy,
      facebook: facebookCopy,
      instagram: instagramCopy,
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
  async publishToFacebook(message: string, imagePath?: string): Promise<PublishResult> {
    const pageToken = config.marketing?.facebookPageAccessToken;
    const pageId = config.marketing?.facebookPageId;

    if (!pageToken || !pageId) {
      return { platform: "Facebook", success: false, error: "Faltan claves (FACEBOOK_PAGE_ACCESS_TOKEN / FACEBOOK_PAGE_ID)" };
    }

    try {
      console.log("📘 [Marketing] Publicando en Facebook Page Silvania.ai...");
      if (imagePath && fs.existsSync(imagePath)) {
        try {
          const fileBuffer = fs.readFileSync(imagePath);
          const blob = new Blob([fileBuffer], { type: "image/png" });
          const form = new FormData();
          form.append("source", blob, "image.png");
          form.append("caption", message);
          form.append("access_token", pageToken);

          const res = await axios.post(`https://graph.facebook.com/v19.0/${pageId}/photos`, form);
          const photoId = res.data?.id;
          const postUrl = photoId ? `https://facebook.com/${photoId}` : `https://facebook.com/${pageId}`;
          return { platform: "Facebook", success: true, messageId: photoId, url: postUrl };
        } catch (imgErr: any) {
          console.warn("⚠️ Falló subida con foto a Facebook, intentando solo texto:", imgErr.response?.data?.error?.message || imgErr.message);
        }
      }

      const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
      const res = await axios.post(url, {
        message,
        access_token: pageToken
      });
      const postId = res.data?.id;
      const postUrl = postId ? `https://facebook.com/${postId}` : `https://facebook.com/${pageId}`;
      return { platform: "Facebook", success: true, messageId: postId, url: postUrl };
    } catch (err: any) {
      console.error("❌ Error publicando en Facebook:", err.response?.data?.error?.message || err.message);
      return { platform: "Facebook", success: false, error: err.response?.data?.error?.message || err.message };
    }
  },

  /**
   * Publica de forma directa en Instagram (@silvania.ai) usando la Instagram Graph API
   * Soporta tanto publicación de imágenes individuales como de Reels de vídeo
   */
  async publishToInstagram(caption: string, imagePath?: string, videoPath?: string): Promise<PublishResult> {
    const pageToken = config.marketing?.facebookPageAccessToken;
    const igAccountId = config.marketing?.instagramAccountId;
    const publicUrl = config.marketing?.publicUrl || (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : "https://silvania.ai");

    if (!pageToken || !igAccountId) {
      return { platform: "Instagram", success: false, error: "Faltan claves (FACEBOOK_PAGE_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ACCOUNT_ID)" };
    }

    try {
      console.log("📸 [Marketing] Iniciando publicación en Instagram @silvania.ai...");
      let containerId: string | undefined;

      // 1. Si hay vídeo MP4, publicarlo como REEL
      if (videoPath && fs.existsSync(videoPath)) {
        const filename = path.basename(videoPath);
        const targetTempPath = path.join(process.cwd(), "temp", filename);
        if (videoPath !== targetTempPath && !fs.existsSync(targetTempPath)) {
          try { fs.copyFileSync(videoPath, targetTempPath); } catch (_) {}
        }
        const mediaUrl = `${publicUrl}/marketing-media/${filename}`;
        console.log(`🎬 [Instagram] Creando contenedor Reel desde URL: ${mediaUrl}...`);

        const createRes = await axios.post(`https://graph.facebook.com/v19.0/${igAccountId}/media`, {
          media_type: "REELS",
          video_url: mediaUrl,
          caption,
          access_token: pageToken
        }, { timeout: 30000 });

        containerId = createRes.data?.id;

        // Esperar procesamiento del vídeo en Instagram
        if (containerId) {
          console.log(`⏳ [Instagram] Esperando procesamiento del Reel (${containerId})...`);
          let attempts = 0;
          let isFinished = false;
          while (attempts < 15 && !isFinished) {
            await new Promise(r => setTimeout(r, 4000));
            attempts++;
            try {
              const statusRes = await axios.get(`https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${pageToken}`);
              const status = statusRes.data?.status_code;
              console.log(`⏳ [Instagram] Estado del contenedor (intento ${attempts}): ${status}`);
              if (status === "FINISHED") {
                isFinished = true;
                break;
              } else if (status === "ERROR") {
                throw new Error("El procesamiento del Reel en Instagram devolvió ERROR.");
              }
            } catch (pollErr: any) {
              console.warn(`⚠️ [Instagram] Error consultando estado: ${pollErr.message}`);
            }
          }
        }
      } else if (imagePath && fs.existsSync(imagePath)) {
        // 2. Si hay imagen, publicarla en el feed
        const filename = path.basename(imagePath);
        const targetTempPath = path.join(process.cwd(), "temp", filename);
        if (imagePath !== targetTempPath && !fs.existsSync(targetTempPath)) {
          try { fs.copyFileSync(imagePath, targetTempPath); } catch (_) {}
        }
        const mediaUrl = `${publicUrl}/marketing-media/${filename}`;
        console.log(`🖼️ [Instagram] Creando contenedor de imagen desde URL: ${mediaUrl}...`);

        const createRes = await axios.post(`https://graph.facebook.com/v19.0/${igAccountId}/media`, {
          image_url: mediaUrl,
          caption,
          access_token: pageToken
        }, { timeout: 20000 });

        containerId = createRes.data?.id;
      }

      if (!containerId) {
        return { platform: "Instagram", success: false, error: "No se proporcionó imagen ni vídeo para Instagram" };
      }

      // 3. Publicar el contenedor en Instagram
      console.log(`🚀 [Instagram] Publicando contenedor ${containerId}...`);
      const publishRes = await axios.post(`https://graph.facebook.com/v19.0/${igAccountId}/media_publish`, {
        creation_id: containerId,
        access_token: pageToken
      }, { timeout: 25000 });

      const mediaId = publishRes.data?.id;
      let permalink = "https://www.instagram.com/silvania.ai/";
      if (mediaId) {
        try {
          const permRes = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}?fields=permalink&access_token=${pageToken}`);
          if (permRes.data?.permalink) {
            permalink = permRes.data.permalink;
          }
        } catch (_) {}
      }

      console.log(`✅ [Instagram] ¡Publicado con éxito en @silvania.ai! Permalink: ${permalink}`);
      return { platform: "Instagram", success: true, messageId: mediaId, url: permalink };
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.message;
      console.error("❌ Error publicando en Instagram:", errMsg);
      return { platform: "Instagram", success: false, error: errMsg };
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
      // Truncado estricto con cálculo ponderado (máx 265) para garantizar aceptación en X
      const safeText = truncateForTwitter(text, 265);
      let tweetRes: any;

      if (imagePath && fs.existsSync(imagePath)) {
        try {
          const mediaId = await client.v1.uploadMedia(imagePath);
          tweetRes = await rwClient.v2.tweet({
            text: safeText,
            media: { media_ids: [mediaId] }
          });
        } catch (mediaErr: any) {
          console.warn("⚠️ Falló subida de imagen a Twitter, publicando solo texto:", mediaErr.message);
          tweetRes = await rwClient.v2.tweet(safeText);
        }
      } else {
        tweetRes = await rwClient.v2.tweet(safeText);
      }

      const tweetId = tweetRes?.data?.id;
      const tweetUrl = tweetId ? `https://x.com/Silvania_AI/status/${tweetId}` : undefined;
      console.log(`✅ Tweet publicado con éxito: ${tweetUrl || tweetId}`);
      return { platform: "X (Twitter)", success: true, messageId: tweetId, url: tweetUrl };
    } catch (err: any) {
      console.error("❌ Error publicando en X (Twitter):", err?.data || err.message);
      const isUnauthorized = err?.data?.status === 401 || err?.status === 401 || (err?.message && err.message.toLowerCase().includes("unauthorized"));
      const errorMsg = isUnauthorized 
        ? "Claves de X no autorizadas (Error 401: regenerar Access Token & Secret en Developer Portal con permisos Read/Write)" 
        : (err?.data?.detail || err.message);
      return { platform: "X (Twitter)", success: false, error: errorMsg };
    }
  },

  /**
   * Publica de forma directa en LinkedIn Personal/Company usando la LinkedIn v2 UGC Posts API
   * Soporta publicación con imagen nativa (upload binario a assets), enlaces a vídeos o solo texto.
   */
  async publishToLinkedIn(text: string, linkUrl?: string, imagePath?: string): Promise<PublishResult> {
    const token = config.marketing?.linkedinAccessToken;
    const author = config.marketing?.linkedinPersonUrn || "urn:li:person:5hWnXvuzlV";

    if (!token) {
      return { platform: "LinkedIn", success: false, error: "Falta token de LinkedIn (LINKEDIN_ACCESS_TOKEN)" };
    }

    try {
      console.log(`💼 [Marketing] Publicando en LinkedIn como ${author}...`);
      let assetUrn: string | undefined;

      // 1. Si se proporciona imagen local, registrar y subir binario a LinkedIn DMS
      if (imagePath && fs.existsSync(imagePath)) {
        try {
          console.log(`🖼️ [LinkedIn] Registrando subida de imagen (${path.basename(imagePath)})...`);
          const regRes = await axios.post("https://api.linkedin.com/v2/assets?action=registerUpload", {
            registerUploadRequest: {
              recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
              owner: author,
              serviceRelationships: [
                {
                  relationshipType: "OWNER",
                  identifier: "urn:li:userGeneratedContent"
                }
              ]
            }
          }, {
            headers: {
              "Authorization": `Bearer ${token}`,
              "X-Restli-Protocol-Version": "2.0.0",
              "Content-Type": "application/json"
            },
            timeout: 15000
          });

          const uploadUrl = regRes.data?.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
          const registeredAsset = regRes.data?.value?.asset;

          if (uploadUrl && registeredAsset) {
            console.log(`🖼️ [LinkedIn] Subiendo binario de imagen (${registeredAsset})...`);
            const imageBuffer = fs.readFileSync(imagePath);
            await axios.put(uploadUrl, imageBuffer, {
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": imagePath.endsWith(".png") ? "image/png" : "image/jpeg"
              },
              timeout: 25000
            });
            assetUrn = registeredAsset;
            console.log(`✅ [LinkedIn] Imagen subida y asociada con éxito: ${assetUrn}`);
          }
        } catch (imgErr: any) {
          console.warn("⚠️ [LinkedIn] Falló subida de imagen, continuando publicación con enlace/texto:", imgErr.response?.data?.message || imgErr.message);
        }
      }

      // 2. Determinar categoría y adjunto: IMAGEN > ENLACE / VÍDEO > TEXTO PLANO
      let shareMediaCategory = "NONE";
      let mediaArray: any[] | undefined = undefined;

      if (assetUrn) {
        shareMediaCategory = "IMAGE";
        mediaArray = [
          {
            status: "READY",
            media: assetUrn,
            title: { text: "Silvania CoreAgent" }
          }
        ];
      } else if (linkUrl) {
        shareMediaCategory = "ARTICLE";
        mediaArray = [
          {
            status: "READY",
            originalUrl: linkUrl
          }
        ];
      }

      const body: any = {
        author: author,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: text
            },
            shareMediaCategory,
            ...(mediaArray ? { media: mediaArray } : {})
          }
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
      };

      const res = await axios.post("https://api.linkedin.com/v2/ugcPosts", body, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json"
        },
        timeout: 20000
      });

      const shareUrn = res.data?.id; // e.g. "urn:li:share:7525976108299620352"
      const postUrl = shareUrn ? `https://www.linkedin.com/feed/update/${shareUrn}` : "https://www.linkedin.com/feed/";
      console.log(`✅ [Marketing] Publicado en LinkedIn con éxito: ${postUrl}`);
      return { platform: "LinkedIn", success: true, messageId: shareUrn, url: postUrl };
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message;
      console.error("❌ Error publicando en LinkedIn:", errMsg);
      return { platform: "LinkedIn", success: false, error: errMsg };
    }
  }
};
