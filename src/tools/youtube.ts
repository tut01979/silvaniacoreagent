import { YoutubeTranscript } from "youtube-transcript";
import axios from "axios";
import { formatVideoLink } from "../services/linkFormatter.js";

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
export async function youtubeGetTranscript(urlOrId: string): Promise<string> {
  const videoId = retrieveVideoId(urlOrId);
  
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
      const fullText = transcript.map(t => t.text).join(" ");
      return `🎥 **Transcripción de YouTube:**\n\n${fullText}`;
    }
  } catch (error: any) {
    console.warn(`⚠️ [youtube] Error en scraper directo (${error.message}). Intentando fallback en youtube-transcript.ai...`);
  }

  // Fallback a API de youtube-transcript.ai
  if (videoId) {
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
        return `🎥 **Transcripción de YouTube:**\n\n${textEs}`;
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
          return `🎥 **Transcripción de YouTube:**\n\n${textDefault}`;
        }
      } catch (fallbackDefaultErr: any) {
        console.error("❌ [youtube] Todos los fallbacks de youtube-transcript.ai fallaron:", fallbackDefaultErr.message);
      }
    }
  }

  return `❌ La transcripción no está disponible para este video (puede ser debido a que no tiene subtítulos generados o YouTube está bloqueando el acceso de red para este video).\n\n💡 **Alternativas disponibles:**\n1. Puedo buscar otros videos de este mismo canal si me lo solicitas.\n2. Si me indicas el tema general, puedo buscar información relacionada en la web o consultar otro video.`;
}

/**
 * Busca videos en YouTube utilizando el scraper de la página de resultados.
 */
export async function youtubeSearch(query: string, maxResults: number = 5): Promise<string> {
  try {
    console.log(`🔍 Buscando videos en YouTube para: ${query}`);
    
    // Detectar si el usuario pide el último video o busca un canal/creador
    const queryLower = query.toLowerCase();
    const sortByDate = queryLower.includes("ultimo") || 
                       queryLower.includes("último") || 
                       queryLower.includes("reciente") || 
                       queryLower.includes("nuevo") || 
                       queryLower.includes("subido") || 
                       queryLower.includes("hoy") || 
                       queryLower.includes("canal");

    const encodedQuery = encodeURIComponent(query);
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

