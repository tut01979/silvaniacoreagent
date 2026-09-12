import axios from "axios";
import { resolveAndCleanNewsUrl } from "./newsUrlResolver.js";
import { llmService } from "./llm.js";

export interface RadarItem {
  title: string;
  blurb: string;
  url: string;
  source: string;
}

export interface RadarSection {
  category: string;
  items: RadarItem[];
}

interface CacheEntry {
  timestamp: number;
  markdown: string;
}

// Caché en memoria por locale (8 horas de validez)
const radarCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

/**
 * Normaliza el locale a un código simple ('es', 'en', 'pt', etc.).
 */
function normalizeLocale(rawLocale?: string): string {
  if (!rawLocale) return "es";
  const lower = rawLocale.toLowerCase().trim();
  if (lower.startsWith("en")) return "en";
  if (lower.startsWith("pt")) return "pt";
  if (lower.startsWith("fr")) return "fr";
  if (lower.startsWith("de")) return "de";
  if (lower.startsWith("it")) return "it";
  return "es";
}

/**
 * Parámetros de Google News RSS según idioma.
 */
function getNewsRssParams(locale: string): { hl: string; gl: string; ceid: string } {
  switch (locale) {
    case "en":
      return { hl: "en-US", gl: "US", ceid: "US:en" };
    case "pt":
      return { hl: "pt-BR", gl: "BR", ceid: "BR:pt-419" };
    case "fr":
      return { hl: "fr", gl: "FR", ceid: "FR:fr" };
    case "de":
      return { hl: "de", gl: "DE", ceid: "DE:de" };
    case "it":
      return { hl: "it", gl: "IT", ceid: "IT:it" };
    case "es":
    default:
      return { hl: "es", gl: "ES", ceid: "ES:es" };
  }
}

/**
 * Títulos y queries de las 3 secciones por idioma.
 */
function getSectionConfigs(locale: string) {
  if (locale === "en") {
    return [
      {
        id: "economy",
        category: "Economy",
        query: "top economy markets finance news today",
        preferredSources: ["reuters", "bloomberg", "ft.com", "financial times", "wsj", "cnbc", "bbc", "guardian"],
      },
      {
        id: "ai",
        category: "Artificial Intelligence",
        query: "artificial intelligence AI tech news today",
        preferredSources: ["techcrunch", "the verge", "mit technology review", "wired", "venturebeat", "ars technica"],
      },
      {
        id: "world",
        category: "World",
        query: "world news geopolitics international relations",
        preferredSources: ["reuters", "bbc", "ap news", "apnews", "the guardian", "cnn", "nytimes"],
      },
    ];
  }

  // Default: Español
  return [
    {
      id: "economy",
      category: "Economía",
      query: "noticias economía finanzas mercados empresas",
      preferredSources: ["reuters", "bloomberg", "el país", "elpais", "el economista", "eleconomista", "expansión", "expansion", "cinco días", "cincodias", "el confidencial", "europa press", "ft"],
    },
    {
      id: "ai",
      category: "Inteligencia Artificial",
      query: "noticias inteligencia artificial IA tecnología",
      preferredSources: ["xataka", "techcrunch", "the verge", "mit technology review", "wired", "el país", "el confidencial"],
    },
    {
      id: "world",
      category: "Situación mundial",
      query: "noticias internacional geopolítica mundo",
      preferredSources: ["reuters", "bbc", "el país", "elpais", "efe", "europa press", "el mundo", "elmundo", "ap news", "the guardian"],
    },
  ];
}

/**
 * Limpieza de CDATA y etiquetas XML/HTML residuales.
 */
function cleanXmlText(raw: string): string {
  if (!raw) return "";
  let text = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  text = text.replace(/<[^>]+>/g, "").trim();
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Corta un texto en un límite seguro respetando palabras completas.
 */
function truncateText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const cut = trimmed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut) + "…";
}

/**
 * Busca noticias en Google News RSS y decodifica URLs reales.
 */
async function fetchNewsForSection(
  query: string,
  preferredSources: string[],
  locale: string,
  limit: number = 2
): Promise<RadarItem[]> {
  try {
    const { hl, gl, ceid } = getNewsRssParams(locale);
    const encodedQuery = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

    const { data: xml } = await axios.get(url, {
      timeout: 7000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
    });

    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    if (items.length === 0) return [];

    const parsedItems: { title: string; link: string; source: string; score: number }[] = [];

    for (let i = 0; i < Math.min(items.length, 15); i++) {
      const itemXml = items[i];

      const rawTitle = (itemXml.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
      const rawLink = (itemXml.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
      const rawSource = (itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || "";

      const cleanTitle = cleanXmlText(rawTitle);
      const cleanSource = cleanXmlText(rawSource);

      if (!cleanTitle || !rawLink) continue;

      // Calcular puntuación de relevancia por fuente preferida
      const sourceLower = (cleanSource + " " + cleanTitle).toLowerCase();
      const isPreferred = preferredSources.some((src) => sourceLower.includes(src));
      const score = isPreferred ? 2 : 1;

      parsedItems.push({
        title: cleanTitle,
        link: rawLink.trim(),
        source: cleanSource || (locale === "en" ? "News" : "Noticia"),
        score,
      });
    }

    // Ordenar por fuentes preferentes
    parsedItems.sort((a, b) => b.score - a.score);

    const validItems: RadarItem[] = [];

    // Resolver URLs de los mejores candidatos
    for (const candidate of parsedItems) {
      if (validItems.length >= limit) break;

      try {
        const resolvedUrl = await resolveAndCleanNewsUrl(candidate.link);
        
        // Validación estricta: URL válida http/https y no residual de Google News RSS
        if (
          !resolvedUrl ||
          !resolvedUrl.startsWith("http") ||
          resolvedUrl.includes("news.google.com/rss/articles")
        ) {
          continue;
        }

        // Limpiar el titular (quitar sufijo " - NombreFuente" si coincide)
        let displayTitle = candidate.title;
        if (candidate.source && displayTitle.includes(` - ${candidate.source}`)) {
          displayTitle = displayTitle.replace(` - ${candidate.source}`, "").trim();
        }
        displayTitle = truncateText(displayTitle, 90);

        validItems.push({
          title: displayTitle,
          blurb: "", // Se completará con LLM
          url: resolvedUrl,
          source: candidate.source,
        });
      } catch (err: any) {
        console.warn(`[MorningRadar] Error resolviendo URL de ${candidate.title}:`, err.message);
      }
    }

    return validItems;
  } catch (err: any) {
    console.warn(`[MorningRadar] Error en búsqueda de noticias para "${query}":`, err.message);
    return [];
  }
}

/**
 * Genera una frase concisa de contexto o impacto para un ejecutivo mediante LLM.
 */
async function generateBlurbForNews(title: string, source: string, locale: string): Promise<string> {
  try {
    const languageName = locale === "en" ? "inglés" : locale === "pt" ? "portugués" : "español";
    const prompt = `Resume en exactamente una frase breve (máximo 1 línea, sin viñetas, máx. 120 caracteres) el impacto o contexto para un profesional/ejecutivo de esta noticia. Tono neutro, directo y profesional. Sin opiniones subjetivas. Idioma: ${languageName}.

Titular: "${title}"
Fuente: ${source}`;

    const res = await llmService.chatSimple([
      { role: "system", content: "Eres un analista ejecutivo de inteligencia estratégica y síntesis de noticias." },
      { role: "user", content: prompt },
    ]);

    let blurb = (res.content || "").trim();
    // Limpiar comillas iniciales/finales o prefijos como "Impacto:"
    blurb = blurb.replace(/^["'\s]+|["'\s]+$/g, "");
    blurb = blurb.replace(/^(Impacto|Contexto|Resumen):\s*/i, "");
    return truncateText(blurb, 130);
  } catch (err: any) {
    console.warn("[MorningRadar] Falló generación de frase de impacto por LLM:", err.message);
    return "";
  }
}

export const morningRadarService = {
  /**
   * Obtiene y genera el bloque Markdown del Radar del día.
   * Si ocurre cualquier error, devuelve null para no afectar el resto del briefing matutino.
   */
  async getMorningRadarMarkdown(userLocale?: string): Promise<string | null> {
    try {
      const locale = normalizeLocale(userLocale);

      // 1. Comprobar caché en memoria
      const cached = radarCache.get(locale);
      const now = Date.now();
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        console.log(`⚡ [MorningRadar] Utilizando radar en caché para locale "${locale}" (${Math.round((now - cached.timestamp) / (1000 * 60))} min transcurridos).`);
        return cached.markdown;
      }

      console.log(`🌐 [MorningRadar] Generando radar matutino fresco para locale "${locale}"...`);

      const sectionConfigs = getSectionConfigs(locale);
      const radarSections: RadarSection[] = [];

      // 2. Obtener noticias de cada sección en paralelo
      const sectionPromises = sectionConfigs.map(async (cfg) => {
        // Máximo 1–2 noticias por sección (1 si son densas)
        const items = await fetchNewsForSection(cfg.query, cfg.preferredSources, locale, 1);
        return {
          category: cfg.category,
          items,
        };
      });

      const resolvedSections = await Promise.all(sectionPromises);

      for (const sec of resolvedSections) {
        if (sec.items.length > 0) {
          radarSections.push(sec);
        }
      }

      if (radarSections.length === 0) {
        console.warn("⚠️ [MorningRadar] No se obtuvieron noticias válidas para ninguna sección.");
        return null;
      }

      // 3. Generar frases de impacto con LLM para cada noticia obtenida
      for (const sec of radarSections) {
        for (const item of sec.items) {
          const blurb = await generateBlurbForNews(item.title, item.source, locale);
          item.blurb = blurb;
        }
      }

      // 4. Construir formato Markdown del bloque Radar
      // Render Markdown claro:
      // 📰 *Radar del día*
      // *Economía*
      // • Titular — Contexto [Fuente](url)
      const radarTitle = locale === "en" ? "Daily Radar" : "Radar del día";
      const lines: string[] = [`📰 *${radarTitle}*`];

      for (const sec of radarSections) {
        lines.push(`\n*${sec.category}*`);
        for (const item of sec.items) {
          const sourceLabel = item.source || (locale === "en" ? "Read" : "Leer");
          if (item.blurb) {
            lines.push(`• ${item.title} — ${item.blurb} [${sourceLabel}](${item.url})`);
          } else {
            lines.push(`• ${item.title} [${sourceLabel}](${item.url})`);
          }
        }
      }

      const markdown = lines.join("\n").trim();

      // Guardar en caché si es válido
      if (markdown) {
        radarCache.set(locale, {
          timestamp: now,
          markdown,
        });
        console.log(`✅ [MorningRadar] Radar generado y guardado en caché (${markdown.length} caracteres).`);
      }

      return markdown;
    } catch (err: any) {
      console.error("❌ [MorningRadar] Error imprevisto generando el radar matutino:", err.message);
      return null;
    }
  },

  /**
   * Limpia la caché del radar (útil para pruebas o recargas forzadas).
   */
  clearCache() {
    radarCache.clear();
  },
};
