import axios from "axios";
import * as cheerio from "cheerio";

async function testReadUrl() {
  const url = "https://silvania.ai";
  console.log(`🌐 Probando lectura de ${url}...`);

  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(res.data);
    const title = $("title").text().trim();
    $("script, style, noscript, nav, footer, svg").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim();

    console.log("✅ Título:", title);
    console.log("✅ Texto extraído (primeros 300 chars):", text.slice(0, 300));
  } catch (err: any) {
    console.error("❌ Error leyendo URL:", err.message);
  }
}

testReadUrl();
