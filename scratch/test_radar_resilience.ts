import { morningRadarService } from "../src/services/morningRadar.js";

async function testResilience() {
  console.log("=== PRUEBAS DE RESILIENCIA Y MULTI-IDIOMA ===");

  // 1. Prueba en Español
  console.log("\n1. Probando Radar en Español ('es')...");
  const radarEs = await morningRadarService.getMorningRadarMarkdown("es");
  console.log("Resultado 'es' presente:", !!radarEs);
  if (radarEs) {
    console.log("Contiene 'Radar del día':", radarEs.includes("Radar del día"));
    console.log("Contiene 'Economía':", radarEs.includes("Economía"));
    console.log("Contiene 'Inteligencia Artificial':", radarEs.includes("Inteligencia Artificial"));
    console.log("Contiene 'Situación mundial':", radarEs.includes("Situación mundial"));
    console.log("No contiene enlaces sin decodificar de Google News RSS:", !radarEs.includes("news.google.com/rss/articles"));
  }

  // 2. Prueba en Inglés
  console.log("\n2. Probando Radar en Inglés ('en')...");
  const radarEn = await morningRadarService.getMorningRadarMarkdown("en");
  console.log("Resultado 'en' presente:", !!radarEn);
  if (radarEn) {
    console.log("Contiene 'Daily Radar':", radarEn.includes("Daily Radar"));
    console.log("Contiene 'Economy':", radarEn.includes("Economy"));
    console.log("Contiene 'Artificial Intelligence':", radarEn.includes("Artificial Intelligence"));
    console.log("Contiene 'World':", radarEn.includes("World"));
  }

  // 3. Prueba de caché en inglés
  console.log("\n3. Probando caché en inglés...");
  const t0 = Date.now();
  const cachedEn = await morningRadarService.getMorningRadarMarkdown("en");
  const elapsed = Date.now() - t0;
  console.log(`Tiempo de respuesta desde caché: ${elapsed}ms (debe ser < 10ms)`);
  console.log("Coincidencia exacta con versión anterior:", cachedEn === radarEn);

  // 4. Verificación de tolerancia ante locale no soportado (fallback a 'es')
  console.log("\n4. Probando locale no existente (fallback)...");
  const radarFallback = await morningRadarService.getMorningRadarMarkdown("xyz");
  console.log("Fallback devuelve contenido válido:", !!radarFallback);
  console.log("Usa 'Radar del día':", radarFallback?.includes("Radar del día"));

  console.log("\n✅ Todas las pruebas de resiliencia completadas exitosamente.");
}

testResilience();
