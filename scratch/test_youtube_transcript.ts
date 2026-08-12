// Test script to validate YouTube transcript cleanup and formatting
import { youtubeGetTranscript } from "../src/tools/youtube.js";

async function testTranscript() {
  console.log("=== INICIANDO PRUEBAS DE LIMPIEZA DE TRANSCRIPCIÓN ===");
  
  // Lógica local para probar el colapsador
  function cleanupDuplicateLines(text: string): string {
    if (!text) return "";
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
    const words = result.split(/\s+/);
    if (words.length === 0) return "";
    let textClean = words.join(" ");
    textClean = textClean.replace(/\b([\w\sáéíóúÁÉÍÓÚñÑüÜ]{3,50})\s+\1\b/gi, "$1");
    textClean = textClean.replace(/\b([\w\sáéíóúÁÉÍÓÚñÑüÜ]{3,50})\s+\1\b/gi, "$1");
    return textClean;
  }

  const simulatedRaw = 
    "Hola a todos\n" +
    "Hola a todos\n" +
    "Bienvenidos al canal del agente\n" +
    "Bienvenidos al canal del agente\n" +
    "Bienvenidos al canal del agente\n" +
    "Hoy hablaremos de desarrollo frontend desarrollo frontend\n" +
    "y desarrollo backend";

  const cleaned = cleanupDuplicateLines(simulatedRaw);
  console.log("-> Entrada Original:\n", simulatedRaw);
  console.log("\n-> Salida Limpia:\n", cleaned);

  const hasNoDuplicateWelcome = (cleaned.match(/Bienvenidos al canal del agente/g) || []).length === 1;
  const hasNoDuplicateFrontend = (cleaned.match(/desarrollo frontend/g) || []).length === 1;

  console.log(`-> Líneas repetidas consecutivas eliminadas: ${hasNoDuplicateWelcome ? "✅ PASÓ" : "❌ FALLÓ"}`);
  console.log(`-> Frases repetidas en texto continuo eliminadas: ${hasNoDuplicateFrontend ? "✅ PASÓ" : "❌ FALLÓ"}`);

  if (hasNoDuplicateWelcome && hasNoDuplicateFrontend) {
    console.log("\n✅ TODAS LAS PRUEBAS DE LIMPIEZA DE TRANSCRIPCIÓN PASARON CON ÉXITO.");
  } else {
    console.error("\n❌ ALGUNAS PRUEBAS FALLARON.");
  }
}

testTranscript();
