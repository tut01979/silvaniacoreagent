import { YoutubeTranscript } from "youtube-transcript";
import axios from "axios";
import { formatVideoLink } from "../services/linkFormatter.js";
import { userContextStore } from "../services/context.js";
import fs from "fs";
import path from "path";

const RE_YOUTUBE = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;

function retrieveVideoId(urlOrId: string): string | null {
  const cleanId = urlOrId.trim();
  if (cleanId.length === 11) {
    return cleanId;
  }
  const match = cleanId.match(RE_YOUTUBE);
  return match ? match[1] : null;
}

/**
 * Obtiene la transcripción (subtítulos) de un video de YouTube dada su URL o ID.
 */
function cleanupDuplicateLines(text: string): string {
  if (!text) return "";
  
  // 1. Dividir por líneas para colapsar líneas duplicadas consecutivas
  const lines = text.split(/\r?\n/);
  const cleanedLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i].trim();
    if (!current) continue;
    if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1].trim() === current) {
      continue;
    }
    cleanedLines.push(lines[i]);
  }

  let result = cleanedLines.join("\n");

  // 2. Colapsar palabras consecutivas repetidas en el texto continuo
  const words = result.split(/\s+/);
  if (words.length === 0) return "";

  let textClean = words.join(" ");
  // Colapsar frases repetidas consecutivas de hasta 50 caracteres (ej: "Hola a todos Hola a todos")
  textClean = textClean.replace(/\b([\w\sáéíóúÁÉÍÓÚñÑüÜ]{3,50})\s+\1\b/gi, "$1");
  textClean = textClean.replace(/\b([\w\sáéíóúÁÉÍÓÚñÑüÜ]{3,50})\s+\1\b/gi, "$1"); // Doble pasada para triplicados

  return textClean;
}

/**
 * Obtiene la transcripción (subtítulos) de un video de YouTube dada su URL o ID.
 * Procesa el texto eliminando repeticiones y guarda el entregable completo en Drive.
 */
export async function youtubeGetTranscript(urlOrId: string, userId?: number, saveToDrive?: boolean): Promise<string> {
  const videoId = retrieveVideoId(urlOrId);
  let rawText = "";
  
  try {
    console.log(`📥 Obteniendo transcripción de YouTube para: ${urlOrId} (ID: ${videoId})`);
    
    // Intentar primero con la librería youtube-transcript en español
    let transcript;
    try {
      transcript = await YoutubeTranscript.fetchTranscript(urlOrId, { lang: 'es' });
    } catch (langError: any) {
      console.warn(`⚠️ Transcripción en español no disponible (${langError.message}). Intentando idioma por defecto...`);
      transcript = await YoutubeTranscript.fetchTranscript(urlOrId);
    }
    
    if (transcript && transcript.length > 0) {
      rawText = transcript.map(t => t.text).join(" ");
    }
  } catch (error: any) {
    console.warn(`⚠️ [youtube] Error en scraper directo (${error.message}). Intentando fallback en youtube-transcript.ai...`);
  }

  // Fallback a API de youtube-transcript.ai
  if (!rawText && videoId) {
    try {
      // Intentar primero en español (lang=es)
      console.log(`📥 [youtube] Intentando obtener transcripción en español (lang=es)...`);
      const fallbackUrlEs = `https://youtube-transcript.ai/transcript/${videoId}.txt?lang=es`;
      const { data: textEs } = await axios.get(fallbackUrlEs, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000
      });

      if (textEs && textEs.trim().length > 0 && !textEs.includes("We're sorry, YouTube is currently blocking us")) {
        rawText = textEs;
      }
    } catch (fallbackEsErr: any) {
      console.warn(`⚠️ [youtube] Fallback en español falló (${fallbackEsErr.message}), intentando sin filtro de idioma...`);
      try {
        const fallbackUrlDefault = `https://youtube-transcript.ai/transcript/${videoId}.txt`;
        const { data: textDefault } = await axios.get(fallbackUrlDefault, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 10000
        });

        if (textDefault && textDefault.trim().length > 0 && !textDefault.includes("We're sorry, YouTube is currently blocking us")) {
          rawText = textDefault;
        }
      } catch (fallbackDefaultErr: any) {
        console.error("❌ [youtube] Todos los fallbacks de youtube-transcript.ai fallaron:", fallbackDefaultErr.message);
      }
    }
  }

  if (rawText) {
    const cleanedTranscript = cleanupDuplicateLines(rawText);
    const effectiveUserId = userId || 0;
    
    // Guardar en Drive si saveToDrive !== false y es larga (>1500 caracteres), o si se pidió explícitamente
    const shouldSaveToDrive = (saveToDrive === true || (saveToDrive !== false && cleanedTranscript.length > 1500)) && Boolean(effectiveUserId);
    let driveLinkMsg = "";

    if (shouldSaveToDrive && effectiveUserId) {
      try {
        console.log(`📁 [youtube] Guardando transcripción completa en Google Drive (silvania/transcripciones/transcripcion_${videoId}.md)...`);
        const { driveMemoryService } = await import("../services/driveMemory.js");
        const { runGog } = await import("./gogWrapper.js");
        const { generateDriveLink } = await import("../services/linkGenerator.js");
        
        const folderId = await driveMemoryService.getOrCreateFolderPath(["silvania", "transcripciones"], effectiveUserId);
        const fileName = `transcripcion_${videoId}.md`;
        const tempName = `temp_yt_${videoId}.md`;
        const tempPath = path.join(process.cwd(), "temp", tempName);
        
        if (!fs.existsSync(path.join(process.cwd(), "temp"))) {
          fs.mkdirSync(path.join(process.cwd(), "temp"), { recursive: true });
        }
        
        const fileContent = `# Transcripción de YouTube\n\n**Video:** https://www.youtube.com/watch?v=${videoId}\n\n${cleanedTranscript}`;
        fs.writeFileSync(tempPath, fileContent);
        
        const uploadRes = await runGog(`drive upload "${tempPath}" --parent=${folderId} --name="${fileName}" --json`, effectiveUserId);
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
        
        try {
          const parsed = JSON.parse(uploadRes);
          const file = parsed.file || parsed;
          const fileLink = generateDriveLink(file.id, false);
          const folderLink = generateDriveLink(folderId, true);
          driveLinkMsg = `\n\n📂 **Archivo completo guardado en Drive:** [Abrir Transcripción](${fileLink})\n> 🆔 ID: \`${file.id}\` | 🌐 Enlace: ${fileLink}\n📁 **Carpeta:** [Abrir silvania/transcripciones](${folderLink})\n> 🆔 Carpeta ID: \`${folderId}\` | 🌐 Enlace: ${folderLink}`;
        } catch {
          driveLinkMsg = `\n\n📂 **Archivo guardado en Drive:** (Subida procesada con éxito)`;
        }
      } catch (driveErr: any) {
        console.error("❌ [youtube] Error guardando transcripción en Drive:", driveErr.message);
      }
    }

    // Si la transcripción es larga o se guardó en Drive, devolver resumen de ~800-1200 caracteres para no saturar Telegram
    if (shouldSaveToDrive || cleanedTranscript.length > 1500) {
      const summarySnippet = cleanedTranscript.slice(0, 1000) + "...";
      return `🎥 **Transcripción de YouTube (Resumen)**\n\n**Video:** https://www.youtube.com/watch?v=${videoId}\n\n${summarySnippet}${driveLinkMsg}\n\n💡 _La transcripción completa está guardada en tu Google Drive para evitar saturar el chat de Telegram._`;
    }

    // Retornar directamente si es corta y no se guardó en Drive
    return `🎥 **Transcripción de YouTube:**\n\n**Video:** https://www.youtube.com/watch?v=${videoId}\n\n${cleanedTranscript}`;
  }

  return `❌ La transcripción no está disponible para este video (puede ser debido a que no tiene subtítulos generados o YouTube está bloqueando el acceso de red para este video).\n\n💡 **Alternativas disponibles:**\n1. Puedo buscar otros videos de este mismo canal si me lo solicitas.\n2. Si me indicas el tema general, puedo buscar información relacionada en la web o consultar otro video.`;
}

/**
 * Si el idioma del usuario/config es 'es' (por defecto en Silvania) o el mensaje/consulta va en español,
 * añade "en español" al query en la primera búsqueda para evitar devolver tutoriales en inglés salvo petición explícita.
 */
export function buildSpanishAwareYoutubeQuery(rawQuery: string, userId?: number, messageHint?: string): string {
  const q = String(rawQuery || "").trim();
  if (!q) return q;

  // Si ya contiene español / castellano, mantener tal cual
  if (/\b(español|espanol|castellano)\b/i.test(q)) {
    return q;
  }

  // Si explícitamente pide otro idioma, respetar
  const combinedText = `${q} ${messageHint || ""}`;
  if (/\b(en\s+ingl[eé]s|in\s+english|english\s+only|en\s+franc[eé]s|in\s+french|en\s+alem[aá]n|en\s+portugu[eê]s|en\s+italiano)\b/i.test(combinedText)) {
    return q;
  }

  let userLang = "es";
  const effectiveUserId = userId || userContextStore.getStore()?.userId;
  if (effectiveUserId) {
    try {
      const confPath = path.join(process.cwd(), "data", `user_${effectiveUserId}`, "config.json");
      if (fs.existsSync(confPath)) {
        const conf = JSON.parse(fs.readFileSync(confPath, "utf8"));
        if (conf.language || conf.locale || conf.lang) {
          userLang = String(conf.language || conf.locale || conf.lang).toLowerCase();
        }
      }
    } catch {}
  }

  const isSpanishMessage =
    /[áéíóúñ¿¡]/i.test(combinedText) ||
    /\b(videos|vídeos|sobre|curso|tutorial|tutoriales| aprender|como|cómo|guia|guía|para|principiantes|buscar|ver|quiero|me\s+gustaria)\b/i.test(combinedText);

  if (userLang.startsWith("es") || isSpanishMessage) {
    return `${q} en español`;
  }

  return q;
}

/**
 * Busca videos en YouTube utilizando el scraper de la página de resultados.
 */
export async function youtubeSearch(query: string, maxResults: number = 5, userId?: number): Promise<string> {
  try {
    const effectiveUserId = userId || userContextStore.getStore()?.userId;
    const effectiveQuery = buildSpanishAwareYoutubeQuery(query, effectiveUserId);
    console.log(`🔍 Buscando videos en YouTube para: "${effectiveQuery}" (original: "${query}")`);
    
    // Detectar si el usuario pide el último video o busca un canal/creador
    const queryLower = effectiveQuery.toLowerCase();
    const sortByDate = queryLower.includes("ultimo") || 
                       queryLower.includes("último") || 
                       queryLower.includes("reciente") || 
                       queryLower.includes("nuevo") || 
                       queryLower.includes("subido") || 
                       queryLower.includes("hoy") || 
                       queryLower.includes("canal");

    const encodedQuery = encodeURIComponent(effectiveQuery);
    const url = `https://www.youtube.com/results?search_query=${encodedQuery}${sortByDate ? "&sp=CAI%253D" : ""}`;

    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      timeout: 10000,
    });

    const match = html.match(/ytInitialData\s*=\s*({.+?});/);
    if (!match) {
      return "⚠️ No se pudo extraer la información de búsqueda de YouTube (estructura de página no coincidente).";
    }

    const json = JSON.parse(match[1]);
    const contents = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
    if (!contents) {
      return "⚠️ No se encontraron contenidos en los resultados de búsqueda de YouTube.";
    }

    const results: { title: string; url: string; publishTime: string; viewCount: string; duration: string }[] = [];
    for (const section of contents) {
      const itemSection = section.itemSectionRenderer;
      if (!itemSection?.contents) continue;
      for (const item of itemSection.contents) {
        const video = item.videoRenderer;
        if (video) {
          // Descartar videos programados en el futuro (upcomingEventData)
          if (video.upcomingEventData !== undefined) continue;

          const title = video.title?.runs?.[0]?.text || video.title?.accessibility?.accessibilityData?.label;
          const videoId = video.videoId;
          const publishTime = video.publishedTimeText?.simpleText;
          const viewCount = video.viewCountText?.simpleText;
          const lengthText = video.lengthText?.simpleText;

          // Descartar si no tiene duración (típico de videos vacíos o programados)
          if (!lengthText && !video.badges?.some((b: any) => b.metadataBadgeRenderer?.label === "EN DIRECTO")) {
            continue;
          }

          if (title && videoId) {
            results.push({
              title,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              publishTime: publishTime || 'N/A',
              viewCount: viewCount || 'N/A',
              duration: lengthText || 'N/A'
            });
          }
          if (results.length >= maxResults) break;
        }
      }
      if (results.length >= maxResults) break;
    }

    if (results.length === 0) {
      return `❌ No se encontraron videos para la búsqueda: "${query}".`;
    }

    const formatted = results.map((r, i) => 
      `${formatVideoLink(r.title, r.url)}\n` +
      `> 📅 Publicado: ${r.publishTime}  |  👀 Vistas: ${r.viewCount}  |  ⏱️ Duración: ${r.duration}`
    ).join("\n\n");

    const SEP = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
    return `✨ **RESULTADOS DE YOUTUBE PARA:** "${query}"\n${SEP}\n\n${formatted}\n\n_Encontrados ${results.length} videos._`;
  } catch (error: any) {
    console.error("Error en youtubeSearch:", error);
    return `❌ Error al buscar videos en YouTube: ${error.message}`;
  }
}

