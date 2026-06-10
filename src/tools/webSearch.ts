import axios from "axios";
import * as cheerio from "cheerio";
import { config } from "../config/config.js";

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
    return results;
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
    let results: SearchResult[] = [];

    if (searchType === 'news') {
      results = await searchGoogleNews(query, maxResults);
      if (results.length === 0) {
        results = await searchDuckDuckGo(query + " noticias", maxResults);
      }
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

    const manualLinks = `
🚀 **ENLACES DE BÚSQUEDA ADICIONALES**
────────────────────────────
📍 **Google Maps:** https://www.google.com/maps/search/${encodeURIComponent(query)}
📒 **Páginas Amarillas:** https://www.paginasamarillas.es/resultados.html?what=${encodeURIComponent(query)}
💼 **LinkedIn:** https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(query)}
🏢 **Informa (Empresas):** https://www.informa.es/buscador?q=${encodeURIComponent(query)}
`;

    if (results.length === 0) {
      return `❌ **Sin resultados directos para:** "${query}"\n\n${manualLinks}`;
    }

    let formatted = "";
    if (searchType === 'news') {
      formatted = results.map((r, i) =>
        `📰 **${i + 1}. ${r.title}**\n> 📅 ${r.date || 'Reciente'}  |  🌐 ${r.source || 'Web'}\n> 🔗 ${r.url}\n\n${r.snippet}`
      ).join('\n\n');
    } else {
      formatted = results.map((r, i) => {
        const icon = r.source?.includes('Local') || r.source?.includes('Maps') ? '📍' : '🔍';
        return `${icon} **${i + 1}. ${r.title}**\n> 🔗 ${r.url}\n\n${r.snippet}`;
      }).join('\n\n');
    }

    const typeLabel = searchType === 'news' ? '📰 NOTICIAS' : searchType === 'local' ? '📍 NEGOCIOS LOCALES' : '🌐 RESULTADOS WEB';
    const disclaimer = `\n\n${SEP}\n_⚠️ Datos en tiempo real. Si un dato específico no aparece, es posible que no esté indexado._\n_Encontrados ${results.length} resultados._`;

    return `✨ **${typeLabel} PARA:** "${query}"\n${SEP}\n\n${formatted}\n\n${manualLinks}${disclaimer}`;

  } catch (error: any) {
    return `❌ Error en la búsqueda: ${error.message}`;
  }
}
