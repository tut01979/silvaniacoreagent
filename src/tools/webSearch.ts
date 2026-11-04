import axios from "axios";
import * as cheerio from "cheerio";
import { config } from "../config/config.js";
import { youtubeSearch } from "./youtube.js";
import { resolveAndCleanNewsUrl } from "../services/newsUrlResolver.js";
import { formatNewsLink, formatWebLink } from "../services/linkFormatter.js";

const SEP = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  date?: string;
}

// ═══════════════════════════════════════════════════════════════
// Motor 1: DuckDuckGo HTML (extrae URLs reales)
// ═══════════════════════════════════════════════════════════════
async function searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      timeout: 5000,
    });

    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".result__body").each((_, el) => {
      if (results.length >= maxResults) return false;

      const title = $(el).find(".result__a").text().trim();
      const href = $(el).find(".result__url").attr("href") || "";
      const snippet = $(el).find(".result__snippet").text().trim();

      let realUrl = href;
      try {
        const ddgUrl = new URL(href);
        realUrl = ddgUrl.searchParams.get('uddg') || href;
      } catch {
        realUrl = href;
      }

      if (title && realUrl) {
        results.push({ title, url: realUrl, snippet: snippet || 'Sin descripción' });
      }
    });

    return results;
  } catch (err) {
    console.error("❌ DuckDuckGo error:", err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// Motor 2: Búsqueda Local (negocios, empresas, clínicas, etc.)
// ═══════════════════════════════════════════════════════════════
async function searchLocal(query: string, maxResults: number): Promise<SearchResult[]> {
  const cityMatch = query.match(/en\s+([A-Za-záéíóúñÁÉÍÓÚÑ\s]+)|cerca\s+de\s+([A-Za-záéíóúñÁÉÍÓÚÑ\s]+)|([A-Za-záéíóúñÁÉÍÓÚÑ]+)\s*$/i);
  const targetCity = cityMatch ? (cityMatch[1] || cityMatch[2] || cityMatch[3]).trim().toLowerCase() : null;

  const searchQuery = `${query} dirección teléfono contacto`;
  const encodedQuery = encodeURIComponent(searchQuery);
  const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}&kl=es-es`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 5000,
    });

    const $ = cheerio.load(html);
    const rawResults: SearchResult[] = [];

    $(".result__body").each((_, el) => {
      const title = $(el).find(".result__a").text().trim();
      const href = $(el).find(".result__url").attr("href") || "";
      const snippet = $(el).find(".result__snippet").text().trim();

      let realUrl = href;
      try {
        const ddgUrl = new URL(href);
        realUrl = ddgUrl.searchParams.get('uddg') || href;
      } catch {
        realUrl = href;
      }

      if (title && realUrl) {
        rawResults.push({ title, url: realUrl, snippet: snippet || '' });
      }
    });

    const verifiedResults: SearchResult[] = [];
    const trustedDomains = ['google.com/maps', 'maps.google', 'g.page', 'facebook.com', 'instagram.com', 'linkedin.com', 'yelp.com', 'tripadvisor.com', 'paginasamarillas.es', 'qdq.com', '11870.com', 'infobel.com'];
    const contactIndicators = [/\b\d{9}\b|\+34\s?\d{9}/, /tel[eé]fono/i, /m[oó]vil/i, /contacto/i, /direcci[oó]n/i, /calle/i, /avenida/i];

    for (const result of rawResults) {
      const urlLower = result.url.toLowerCase();
      const snippetLower = result.snippet.toLowerCase();
      const titleLower = result.title.toLowerCase();

      const isTrustedDomain = trustedDomains.some(domain => urlLower.includes(domain));
      const hasContactData = contactIndicators.some(pattern => pattern.test(snippetLower));
      
      const cityInResult = targetCity && (snippetLower.includes(targetCity) || titleLower.includes(targetCity));

      if (isTrustedDomain || (hasContactData && (!targetCity || cityInResult))) {
        const phoneMatch = result.snippet.match(/\b\d{9}\b|\+34\s?\d{9}/);
        const phone = phoneMatch ? `📞 **Teléfono:** ${phoneMatch[0]}` : '';

        verifiedResults.push({
          title: result.title,
          url: result.url,
          snippet: `${result.snippet.slice(0, 200)}${phone ? `\n${phone}` : ''}`,
          source: isTrustedDomain ? '✅ Verificado' : '📍 Local',
        });
      }
    }

    if (verifiedResults.length < maxResults) {
      const mapsResults = await searchGoogleMaps(query, maxResults - verifiedResults.length);
      verifiedResults.push(...mapsResults);
    }

    return verifiedResults.slice(0, maxResults);
  } catch (err) {
    console.error("❌ Local search error:", err);
    return [];
  }
}

async function searchGoogleMaps(query: string, maxResults: number): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.google.com/search?q=${encodedQuery}&hl=es&gl=ES`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      timeout: 5000,
    });

    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    // Buscar selectores comunes de negocios en Google Search
    $(".rllt__details").each((_, el) => {
      if (results.length >= maxResults) return false;
      const title = $(el).parent().find(".OSrXXb").text().trim() || "Negocio Local";
      const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(title)}`;
      results.push({
        title,
        url: mapsUrl,
        snippet: 'Ver en Google Maps para dirección y teléfono',
        source: '📍 Maps',
      });
    });

    return results;
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// Motor 3: Google News RSS
// ═══════════════════════════════════════════════════════════════
async function searchGoogleNews(query: string, maxResults: number): Promise<SearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=es&gl=ES&ceid=ES:es`;
    const { data: xml } = await axios.get(url, { timeout: 5000 });
    
    // Extraer items
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const results: SearchResult[] = [];

    for (let i = 0; i < Math.min(items.length, maxResults); i++) {
      const item = items[i];
      
      // Función auxiliar para extraer contenido y limpiar CDATA/Tags
      const extract = (regex: RegExp) => {
        const match = item.match(regex);
        if (!match) return "";
        let content = match[1] || "";
        // Limpiar CDATA
        content = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
        // Limpiar cualquier otro tag XML residual
        content = content.replace(/<[^>]+>/g, "").trim();
        // Decodificar entidades HTML básicas
        return content
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      };

      const title = extract(/<title>([\s\S]*?)<\/title>/);
      const link = extract(/<link>([\s\S]*?)<\/link>/);
      const pubDate = extract(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const source = extract(/<source[^>]*>([\s\S]*?)<\/source>/);

      if (title && link) {
        const dateStr = pubDate ? new Date(pubDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';
        results.push({
          title,
          url: link,
          snippet: source ? `Fuente: ${source}` : 'Noticia',
          date: dateStr,
          source: source,
        });
      }
    }
    const resolvedResults = await Promise.all(
      results.map(async (r) => {
        const cleanUrl = await resolveAndCleanNewsUrl(r.url);
        return { ...r, url: cleanUrl };
      })
    );
    return resolvedResults;
  } catch (err) {
    console.error("❌ Google News error:", err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// Motor 4: Brave Search API
// ═══════════════════════════════════════════════════════════════
async function searchBrave(query: string, maxResults: number): Promise<SearchResult[]> {
  const apiKey = config.search?.braveApiKey;
  if (!apiKey) return [];

  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodedQuery}&count=${maxResults}&country=es&safesearch=off&spellcheck=1`;

    const { data } = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
      timeout: 5000,
    });

    const results: SearchResult[] = [];
    if (data.web?.results) {
      for (const r of data.web.results) {
        results.push({
          title: r.title,
          url: r.url,
          snippet: r.description || 'Sin descripción',
          source: '🦁 Brave',
        });
      }
    }

    if (data.locations?.results) {
      for (const loc of data.locations.results) {
        results.unshift({
          title: loc.title,
          url: `https://www.google.com/maps/search/${encodeURIComponent(loc.title)}`,
          snippet: `${loc.address || ''} ${loc.phone ? `📞 ${loc.phone}` : ''}`.trim(),
          source: '📍 Brave Local',
        });
      }
    }

    return results;
  } catch (err) {
    console.error('❌ Brave Search error:', err);
    return [];
  }
}

export async function webSearch(query: string, searchType: string = "web", maxResults: number = 5): Promise<string> {
  try {
    const queryLower = query.toLowerCase();
    const isYoutubeQuery = searchType === 'youtube' || searchType === 'video' ||
                           queryLower.includes("youtube") || 
                           /canal\s+(de\s+)?youtube/i.test(queryLower) ||
                           /v[ií]deo(s)?\s+de/i.test(queryLower) ||
                           /buscar\s+(en\s+)?youtube/i.test(queryLower);

    if (isYoutubeQuery) {
      try {
        const ytRes = await youtubeSearch(query, maxResults);
        if (!ytRes.startsWith("❌") && !ytRes.startsWith("⚠️")) {
          return ytRes;
        }
        console.warn("⚠️ YouTube search yielded error or empty, falling back to web search:", ytRes);
      } catch (err: any) {
        console.error("❌ YouTube search failed, falling back to web search:", err);
      }
    }

    let results: SearchResult[] = [];

    if (searchType === 'news') {
      // Obtener noticias de Google News y DuckDuckGo en paralelo
      const [googleNews, ddgNews] = await Promise.all([
        searchGoogleNews(query, maxResults * 2).catch(() => [] as SearchResult[]),
        searchDuckDuckGo(query + " noticias", maxResults).catch(() => [] as SearchResult[])
      ]);
      
      results = [...googleNews, ...ddgNews];
      
      // Eliminar duplicados por URL
      results = results.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
      
      // Filtrar enlaces rotos de Google News RSS que no pudieron decodificarse
      results = results.filter(r => !r.url.includes("news.google.com/rss/articles"));

      // Priorizar medios prestigiosos de España, Europa y del mundo
      const mainSources = [
        'elpais', 'el pais', 'abc', 'elmundo', 'el mundo', 'rtve', 'bbc', 'reuters', 
        'antena 3', 'antena3', 'elconfidencial', 'el confidencial', 'lavanguardia', 
        'la vanguardia', 'efe', 'expansion', 'expansión', 'cnn', 'nytimes', 'guardian',
        'coindesk', 'cointelegraph'
      ];
      
      results.sort((a, b) => {
        const aText = (a.source || "").toLowerCase() + " " + a.url.toLowerCase() + " " + a.title.toLowerCase();
        const bText = (b.source || "").toLowerCase() + " " + b.url.toLowerCase() + " " + b.title.toLowerCase();
        
        const aIsMain = mainSources.some(src => aText.includes(src)) ? 1 : 0;
        const bIsMain = mainSources.some(src => bText.includes(src)) ? 1 : 0;
        
        return bIsMain - aIsMain;
      });
      
      results = results.slice(0, maxResults);
    } else if (searchType === 'local') {
      // Ejecutar Brave Local y searchLocal en paralelo
      const [braveResults, localResults] = await Promise.allSettled([
        searchBrave(query, maxResults),
        searchLocal(query, maxResults)
      ]);
      
      if (braveResults.status === 'fulfilled') results.push(...braveResults.value);
      if (localResults.status === 'fulfilled') results.push(...localResults.value);
      
      // Eliminar duplicados por URL
      results = results.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
    } else {
      // Ejecutar Brave y DuckDuckGo en paralelo
      const [braveResults, ddgResults] = await Promise.allSettled([
        searchBrave(query, maxResults),
        searchDuckDuckGo(query, maxResults)
      ]);

      if (braveResults.status === 'fulfilled') results.push(...braveResults.value);
      if (ddgResults.status === 'fulfilled') results.push(...ddgResults.value);
      
      // Eliminar duplicados por URL
      results = results.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
    }

    // Omitir estrictamente cualquier ítem o titular sin URL https/http válida devuelta por el motor
    results = results.filter(
      r => r && r.title && r.url && /^https?:\/\/\S+/i.test(r.url.trim()) && !r.url.includes("news.google.com/rss/articles")
    );

    // Detección directa de dominio o URL en la consulta (ej: "Silvania.ai", "mercadona.es")
    const rawDomainMatch = query.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, " ").match(/(?:https?:\/\/)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/i);
    if (rawDomainMatch) {
      let candidateDomain = rawDomainMatch[1].replace(/\/+$/, "").toLowerCase();
      const ignoredDomains = ["google.com", "duckduckgo.com", "bing.com", "yahoo.com", "wikipedia.org", "youtube.com", "t.me", "telegram.org"];
      const isIgnored = ignoredDomains.some(d => candidateDomain.includes(d));
      if (!isIgnored) {
        const directUrl = candidateDomain.startsWith("http") ? candidateDomain : `https://${candidateDomain}`;
        const alreadyPresent = results.some(r => r.url.toLowerCase().includes(candidateDomain));
        if (!alreadyPresent) {
          results.unshift({
            title: `Sitio Web Oficial (${candidateDomain})`,
            url: directUrl,
            snippet: `Portal corporativo directo detectado para "${candidateDomain}".`,
            source: '🌐 Web Oficial Directa'
          });
        }
      }
    }

    const manualLinks = `
🚀 **ENLACES ADICIONALES (DIRECTORIOS, MAPS Y SOLVENCIA)**
────────────────────────────
📍 **Google Maps:** https://www.google.com/maps/search/${encodeURIComponent(query)}
📒 **Páginas Amarillas:** https://www.paginasamarillas.es/resultados.html?what=${encodeURIComponent(query)}
💼 **LinkedIn (Empresas):** https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(query)}
🏢 **Informe de Solvencia / Registro (Informa):** https://www.informa.es/buscador?q=${encodeURIComponent(query)}
`;

    if (results.length === 0) {
      return `❌ **Sin resultados directos para:** "${query}"\n\n${manualLinks}`;
    }

    let formatted = "";
    if (searchType === 'news') {
      formatted = results.map((r) =>
        `${formatNewsLink(r.title, r.url)}\n` +
        `> 📅 ${r.date || 'Reciente'}  |  🌐 ${r.source || 'Web'}\n` +
        `> 📝 ${r.snippet}`
      ).join('\n\n');
    } else {
      formatted = results.map((r) => {
        const isLocal = r.source?.includes('Local') || r.source?.includes('Maps');
        const linkStr = isLocal ? `📍 [${r.title}](${r.url})` : formatWebLink(r.title, r.url);
        return `${linkStr}\n` +
               `> 📝 ${r.snippet}`;
      }).join('\n\n');
    }

    const typeLabel = searchType === 'news' ? '📰 NOTICIAS' : searchType === 'local' ? '📍 NEGOCIOS LOCALES' : '🌐 RESULTADOS WEB';
    const disclaimer = `\n\n${SEP}\n_⚠️ REGLA OBLIGATORIA: Cada titular o resultado listado al usuario DEBE incluir su URL devuelta por la herramienta en formato Markdown [Titular](url_https_completa). Si un ítem no tiene URL, omítelo por completo._\n_Encontrados ${results.length} resultados._`;

    return `✨ **${typeLabel} PARA:** "${query}"\n${SEP}\n\n${formatted}\n\n${manualLinks}${disclaimer}`;

  } catch (error: any) {
    return `❌ Error en la búsqueda: ${error.message}`;
  }
}

/**
 * Lee e inspecciona directamente el contenido de una página web a partir de su URL.
 */
export async function readUrl(rawUrl: string): Promise<string> {
  let targetUrl = rawUrl.trim();
  
  // Limpiar posibles comillas o espacios residuales
  targetUrl = targetUrl.replace(/^[<"']+|[>"']+$/g, "").trim();

  // Si no tiene protocolo, asumir https://
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = "https://" + targetUrl;
  }

  try {
    console.log(`🌐 [readUrl] Solicitando contenido de: ${targetUrl}...`);
    const { data: html } = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      timeout: 12000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(html);

    // 1. Extraer datos estructurados JSON-LD (Schema.org)
    const jsonLdData: { emails: string[]; phones: string[]; addresses: string[]; legalNames: string[]; cifs: string[] } = {
      emails: [],
      phones: [],
      addresses: [],
      legalNames: [],
      cifs: []
    };

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const rawJson = $(el).html();
        if (!rawJson) return;
        const parsed = JSON.parse(rawJson);
        const parseEntity = (item: any) => {
          if (!item || typeof item !== "object") return;
          if (item.telephone && typeof item.telephone === "string") {
            const ph = item.telephone.trim();
            if (ph && !jsonLdData.phones.includes(ph)) jsonLdData.phones.push(ph);
          }
          if (item.email && typeof item.email === "string") {
            const em = item.email.trim();
            if (em && !jsonLdData.emails.includes(em)) jsonLdData.emails.push(em);
          }
          if (item.legalName && typeof item.legalName === "string") {
            const ln = item.legalName.trim();
            if (ln && !jsonLdData.legalNames.includes(ln)) jsonLdData.legalNames.push(ln);
          }
          if (item.taxID && typeof item.taxID === "string") {
            const tax = item.taxID.trim();
            if (tax && !jsonLdData.cifs.includes(tax)) jsonLdData.cifs.push(tax);
          }
          if (item.address) {
            if (typeof item.address === "string") {
              if (!jsonLdData.addresses.includes(item.address)) jsonLdData.addresses.push(item.address);
            } else if (typeof item.address === "object") {
              const parts = [
                item.address.streetAddress,
                item.address.postalCode,
                item.address.addressLocality,
                item.address.addressRegion,
                item.address.addressCountry
              ].filter(Boolean);
              if (parts.length > 0) {
                const addrStr = parts.join(", ");
                if (!jsonLdData.addresses.includes(addrStr)) jsonLdData.addresses.push(addrStr);
              }
            }
          }
          if (Array.isArray(item["@graph"])) {
            item["@graph"].forEach(parseEntity);
          }
        };
        if (Array.isArray(parsed)) parsed.forEach(parseEntity);
        else parseEntity(parsed);
      } catch {}
    });

    // 2. Extraer redes sociales, contactos y enlaces clave desde links
    const socialLinks: Record<string, string> = {};
    const directContacts: { emails: string[]; phones: string[]; contactPages: string[] } = {
      emails: [...jsonLdData.emails],
      phones: [...jsonLdData.phones],
      contactPages: []
    };

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href")?.trim();
      if (!href) return;

      if (href.startsWith("mailto:")) {
        const email = href.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
        if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !directContacts.emails.includes(email) && directContacts.emails.length < 8) {
          directContacts.emails.push(email);
        }
        return;
      }

      if (href.startsWith("tel:")) {
        const phone = href.replace(/^tel:/i, "").split("?")[0].replace(/[^\d+]/g, " ").replace(/\s+/g, " ").trim();
        if (phone && phone.length >= 8 && !directContacts.phones.includes(phone) && directContacts.phones.length < 8) {
          directContacts.phones.push(phone);
        }
        return;
      }

      let fullUrl = href;
      if (href.startsWith("//")) fullUrl = "https:" + href;
      else if (href.startsWith("/")) {
        try {
          const u = new URL(targetUrl);
          fullUrl = `${u.origin}${href}`;
        } catch {}
      }

      // Redes sociales oficiales
      if (/linkedin\.com\/(?:company|in)\/[^/?#\s]+/i.test(fullUrl) && !socialLinks.LinkedIn) {
        socialLinks.LinkedIn = fullUrl;
      } else if (/instagram\.com\/[^/?#\s]+/i.test(fullUrl) && !socialLinks.Instagram && !fullUrl.includes("/p/") && !fullUrl.includes("/explore/")) {
        socialLinks.Instagram = fullUrl;
      } else if (/(?:twitter\.com|x\.com)\/[^/?#\s]+/i.test(fullUrl) && !socialLinks["Twitter/X"] && !fullUrl.includes("/status/")) {
        socialLinks["Twitter/X"] = fullUrl;
      } else if (/facebook\.com\/[^/?#\s]+/i.test(fullUrl) && !socialLinks.Facebook && !fullUrl.includes("/sharer")) {
        socialLinks.Facebook = fullUrl;
      } else if (/youtube\.com\/(?:c\/|channel\/|user\/|@)[^/?#\s]+/i.test(fullUrl) && !socialLinks.YouTube) {
        socialLinks.YouTube = fullUrl;
      } else if (/tiktok\.com\/@[^/?#\s]+/i.test(fullUrl) && !socialLinks.TikTok) {
        socialLinks.TikTok = fullUrl;
      } else if (/(?:wa\.me|api\.whatsapp\.com\/send)/i.test(fullUrl) && !socialLinks.WhatsApp) {
        socialLinks.WhatsApp = fullUrl;
      }

      // Enlace a página dedicada de contacto
      if (/\b(?:contacto|contact|donde-estamos|ubicacion|contactar|atencion-al-cliente)\b/i.test(fullUrl) && !directContacts.contactPages.includes(fullUrl) && directContacts.contactPages.length < 3) {
        directContacts.contactPages.push(fullUrl);
      }
    });

    // Extraer perfiles sociales de meta tags si existen
    const twitterHandle = $("meta[name='twitter:site']").attr("content") || $("meta[name='twitter:creator']").attr("content");
    if (twitterHandle && !socialLinks["Twitter/X"]) {
      const cleanHandle = twitterHandle.replace(/^@/, "").trim();
      if (cleanHandle && !cleanHandle.includes(" ") && cleanHandle.length > 1) {
        socialLinks["Twitter/X"] = `https://x.com/${cleanHandle}`;
      }
    }

    // 3. Extraer correos, teléfonos, CIF y dirección física del texto del body (incluyendo footer/header)
    const bodyText = $("body").text();

    const textEmails = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const em of textEmails) {
      const cleanEm = em.trim().toLowerCase();
      if (!/\.(png|jpg|jpeg|gif|webp|svg|css|js|ico)$/i.test(cleanEm) && !directContacts.emails.includes(cleanEm) && directContacts.emails.length < 8) {
        directContacts.emails.push(cleanEm);
      }
    }

    const textPhones = bodyText.match(/(?:\+34\s*)?(?:[6789]\d{2}(?:[\s.-]?\d{3}){2}|[6789]\d{2}(?:[\s.-]?\d{2}){3}|9[0-9]{2}[\s.-]?\d{3}[\s.-]?\d{3})/g) || [];
    for (const ph of textPhones) {
      const cleanPh = ph.trim().replace(/\s+/g, " ");
      if (cleanPh.length >= 9 && !directContacts.phones.includes(cleanPh) && directContacts.phones.length < 8) {
        directContacts.phones.push(cleanPh);
      }
    }

    const cifsFound = [...jsonLdData.cifs];
    const cifMatches = bodyText.match(/\b(?:CIF|NIF|N\.I\.F\.|C\.I\.F\.)[:\s]+([A-HJ-NP-SUVW][0-9]{7}[0-9A-J]|[0-9]{8}[A-Z])\b/gi) || [];
    for (const m of cifMatches) {
      const cleanCif = m.trim().replace(/\s+/g, " ");
      if (!cifsFound.includes(cleanCif) && cifsFound.length < 3) {
        cifsFound.push(cleanCif);
      }
    }

    const addressesFound = [...jsonLdData.addresses];
    $("address, footer, .footer, #footer, .contact, #contact, .contacto, #contacto").each((_, el) => {
      const txt = $(el).text().replace(/\s+/g, " ").trim();
      const addrMatch = txt.match(/(?:c\/|calle|avda\.?|avenida|paseo|plaza|pol[íi]gono\s+ind(?:ustrial)?\.?|carretera|ctra\.?)\s+[^,\n.]{3,60}(?:,\s*\d{1,5})?/i);
      if (addrMatch && !addressesFound.includes(addrMatch[0].trim()) && addressesFound.length < 3) {
        addressesFound.push(addrMatch[0].trim());
      }
    });

    // Extraer metadatos clave
    const title = $("title").text().trim() || $("meta[property='og:title']").attr("content") || "Página Web";
    const description = $("meta[name='description']").attr("content") || $("meta[property='og:description']").attr("content") || "";

    // Eliminar scripts, estilos y elementos ruidosos
    $("script, style, noscript, svg, iframe, canvas").remove();

    // Extraer encabezados principales
    const headings: string[] = [];
    $("h1, h2, h3").each((_, el) => {
      const hText = $(el).text().trim();
      if (hText && !headings.includes(hText) && headings.length < 10) {
        headings.push(`• ${hText}`);
      }
    });

    // Extraer texto principal
    const rawText = $("body").text().replace(/\s+/g, " ").trim();
    let cleanContent = rawText.slice(0, 4000);
    if (!cleanContent || cleanContent.length < 50) {
      if (description) {
        cleanContent = `[Contenido cargado dinámicamente mediante JS / SPA]\nDescripción corporativa oficial: ${description}`;
      }
    }

    let output = `🌐 **CONTENIDO DE LA PÁGINA:** [${title}](${targetUrl})\n${SEP}\n\n`;
    if (description) {
      output += `📝 **Descripción:** ${description}\n\n`;
    }

    // Bloque exhaustivo de datos de contacto
    output += `📞 **DATOS DE CONTACTO EXTRAÍDOS:**\n`;
    output += `• **Email(s):** ${directContacts.emails.length > 0 ? directContacts.emails.join(", ") : "No detectado en esta página"}\n`;
    output += `• **Teléfono(s):** ${directContacts.phones.length > 0 ? directContacts.phones.join(", ") : "No detectado en esta página"}\n`;
    if (addressesFound.length > 0) {
      output += `• **Dirección / Ubicación:** ${addressesFound.join(" | ")}\n`;
    }
    if (cifsFound.length > 0) {
      output += `• **Razón Social / CIF:** ${cifsFound.join(", ")}\n`;
    }
    if (directContacts.contactPages.length > 0) {
      output += `• **Página de Contacto Oficial:** ${directContacts.contactPages.join(", ")}\n`;
    }
    output += `\n`;

    if (Object.keys(socialLinks).length > 0) {
      output += `📱 **Redes Sociales Encontradas:**\n` +
        Object.entries(socialLinks).map(([net, url]) => `• **${net}:** [${net}](${url})`).join("\n") + `\n\n`;
    } else {
      output += `📱 **Redes Sociales:** No se encontraron perfiles de redes sociales en el código de esta página web.\n\n`;
    }
    if (headings.length > 0) {
      output += `📌 **Estructura y Secciones Clave:**\n${headings.join("\n")}\n\n`;
    }
    output += `📄 **Texto Extraído:**\n${cleanContent}`;

    return output;
  } catch (err: any) {
    console.error(`❌ [readUrl] Error al acceder a ${targetUrl}:`, err.message);
    return `❌ No se pudo leer el contenido de ${targetUrl}: ${err.message}. Verifica que la URL sea accesible públicamente.`;
  }
}

