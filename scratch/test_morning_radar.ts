import axios from "axios";
import { resolveAndCleanNewsUrl } from "../src/services/newsUrlResolver.js";
import { llmService } from "../src/services/llm.js";

async function testFetchNews(query: string, locale: string = "es") {
  console.log(`🔍 Buscando noticias para "${query}" con locale "${locale}"...`);
  const encodedQuery = encodeURIComponent(query);
  const hl = locale.startsWith("en") ? "en-US" : "es";
  const gl = locale.startsWith("en") ? "US" : "ES";
  const ceid = locale.startsWith("en") ? "US:en" : "ES:es";

  const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  const { data: xml } = await axios.get(url, { timeout: 8000 });

  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  console.log(`Encontrados ${items.length} items en Google News RSS.`);

  const extract = (item: string, regex: RegExp) => {
    const match = item.match(regex);
    if (!match) return "";
    let content = match[1] || "";
    content = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
    content = content.replace(/<[^>]+>/g, "").trim();
    return content
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  };

  const results: any[] = [];
  for (let i = 0; i < Math.min(items.length, 3); i++) {
    const item = items[i];
    const title = extract(item, /<title>([\s\S]*?)<\/title>/);
    const link = extract(item, /<link>([\s\S]*?)<\/link>/);
    const source = extract(item, /<source[^>]*>([\s\S]*?)<\/source>/);

    console.log(`\nItem ${i + 1}:`);
    console.log(`- Título crudo: ${title}`);
    console.log(`- Fuente: ${source}`);
    console.log(`- Link RSS: ${link}`);

    const resolvedUrl = await resolveAndCleanNewsUrl(link);
    console.log(`- Link resuelto: ${resolvedUrl}`);

    results.push({ title, source, url: resolvedUrl });
  }

  if (results.length > 0) {
    console.log("\nProbando LLM para generar frase de impacto...");
    const sample = results[0];
    const prompt = `Resume en 1 frase concisa (máximo 1 línea) el impacto o contexto para un profesional o ejecutivo de la siguiente noticia. Tono neutro, directo y profesional, sin opiniones subjetivas. Idioma: ${locale}.

Noticia: "${sample.title}"
Fuente: ${sample.source}`;

    const res = await llmService.chatSimple([
      { role: "system", content: "Eres un analista ejecutivo de inteligencia estratégica." },
      { role: "user", content: prompt }
    ]);

    console.log(`- Frase generada: ${res.content?.trim()}`);
  }
}

async function main() {
  try {
    await testFetchNews("economía finanzas", "es");
  } catch (err: any) {
    console.error("Error en test:", err);
  }
}

main();
