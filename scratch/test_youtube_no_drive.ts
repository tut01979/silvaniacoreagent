// Test script to validate that youtubeGetTranscript does not save to Drive unless explicitly asked
import { youtubeGetTranscript } from "../src/tools/youtube.js";

async function testYoutubeNoDrive() {
  console.log("=== INICIANDO PRUEBAS DE TRANSCRIPCIÓN SIN DRIVE POR DEFECTO ===");

  // ID de video de prueba rápido (ej. de música o corto disponible para subtítulos)
  const videoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"; 
  const userId = 99999;

  console.log("-> Solicitando transcripción simple sin pasar saveToDrive...");
  const resultRaw = await youtubeGetTranscript(videoUrl, userId, false);

  console.log("\n-> Resultado de la transcripción (Snippet):");
  console.log(resultRaw.slice(0, 300) + "...\n");

  const hasDriveLink = resultRaw.includes("Archivo completo guardado en Drive") || resultRaw.includes("drive.google.com");
  
  console.log(`-> No se generaron enlaces a Drive: ${!hasDriveLink ? "✅ PASÓ" : "❌ FALLÓ"}`);
  console.log(`-> Trae contenido de transcripción verídico: ${resultRaw.includes("🎥 **Transcripción de YouTube") ? "✅ PASÓ" : "❌ FALLÓ"}`);

  if (!hasDriveLink && resultRaw.includes("🎥 **Transcripción de YouTube")) {
    console.log("\n✅ TODAS LAS PRUEBAS DE TRANSCRIPCIÓN SIN AUTO-DRIVE PASARON CON ÉXITO.");
  } else {
    console.error("\n❌ ALGUNAS PRUEBAS FALLARON.");
  }
}

testYoutubeNoDrive().catch(err => {
  console.error("❌ Fallo en la prueba:", err);
});
