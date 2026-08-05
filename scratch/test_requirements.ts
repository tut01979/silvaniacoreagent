import { isUltraSimpleCourtesy } from "../src/agent/agent.js";
import { formatFolderLink, formatFileLink, formatEmailLink, formatVideoLink, formatEventLink } from "../src/services/linkFormatter.js";
import { memoryManager } from "../src/services/memoryManager.js";
import { userContextStore } from "../src/services/context.js";
import { tools } from "../src/tools/index.js";

async function runTests() {
  const userId = 1572946817; // Usuario principal Jesús
  console.log("====================================================");
  console.log("   🧪 INICIANDO VERIFICACIÓN DE REQUISITOS SILVANIA  ");
  console.log("====================================================\n");

  // ----------------------------------------------------------------
  // PRUEBA 1: Ruteo de Modelos (Cortesías vs General/Estratégico)
  // ----------------------------------------------------------------
  console.log("--- 1. Ruteo de Modelos ---");
  const testPhrases = [
    { phrase: "hola", expected: "openai/gpt-4o-mini" },
    { phrase: "gracias", expected: "openai/gpt-4o-mini" },
    { phrase: "ok", expected: "openai/gpt-4o-mini" },
    { phrase: "qué hora es?", expected: "openai/gpt-4o-mini" },
    { phrase: "dame una propuesta de valor para inversores", expected: "google/gemini-2.5-flash" },
    { phrase: "lista los archivos en mi drive", expected: "google/gemini-2.5-flash" }
  ];

  for (const t of testPhrases) {
    const isCourtesy = (isUltraSimpleCourtesy as any)(t.phrase);
    const selectedModel = isCourtesy ? "openai/gpt-4o-mini" : "google/gemini-2.5-flash";
    const status = selectedModel === t.expected ? "✅ OK" : "❌ FALLÓ";
    console.log(`Mensaje: "${t.phrase}" -> Modelo: ${selectedModel} (${status})`);
  }
  console.log("");

  // ----------------------------------------------------------------
  // PRUEBA 2: Formato de Enlaces Unificado y Premium
  // ----------------------------------------------------------------
  console.log("--- 2. Formato de Enlaces Unificado y Premium ---");
  const folder = formatFolderLink("Proyectos de Silvania", "https://drive.google.com/folders/123");
  const file = formatFileLink("resumen_financiero.pdf", "https://drive.google.com/file/d/456");
  const email = formatEmailLink("Reunión de inversores el lunes", "https://mail.google.com/mail/u/0/#inbox/789");
  const video = formatVideoLink("Tutorial de Silvania.ai", "https://www.youtube.com/watch?v=000");
  const event = formatEventLink("Pitch con Inversores", "https://calendar.google.com/event?id=999");

  console.log(`Carpetas:  ${folder}`);
  console.log(`Archivos:  ${file}`);
  console.log(`Correos:   ${email}`);
  console.log(`Videos:    ${video}`);
  console.log(`Eventos:   ${event}`);

  const folderValid = folder === "📁 Proyectos de Silvania  ·  [🔗 Abrir](https://drive.google.com/folders/123)";
  const fileValid = file === "📄 resumen_financiero.pdf  ·  [🔗 Abrir](https://drive.google.com/file/d/456)";
  const emailValid = email === "📧 Reunión de inversores el lunes  ·  [🔗 Abrir](https://mail.google.com/mail/u/0/#inbox/789)";
  const videoValid = video === "🎥 Tutorial de Silvania.ai  ·  [🔗 Ver](https://www.youtube.com/watch?v=000)";
  const eventValid = event === "📅 Pitch con Inversores  ·  [🔗 Abrir](https://calendar.google.com/event?id=999)";

  if (folderValid && fileValid && emailValid && videoValid && eventValid) {
    console.log("✅ Todos los formatos de enlaces son premium y cumplen con la unificación estricta.");
  } else {
    console.log("❌ Uno o más formatos de enlaces no cumplen con la especificación.");
  }
  console.log("");

  // ----------------------------------------------------------------
  // PRUEBA 3 & 4: Memoria por Temas y Diagnóstico
  // ----------------------------------------------------------------
  console.log("--- 3 & 4. Memoria por Temas y Diagnóstico ---");
  await userContextStore.run({ userId }, async () => {
    try {
      // Diagnóstico de memoria
      console.log("Ejecutando herramienta 'memory_get_diagnostics'...");
      const diagnostics = await tools.memory_get_diagnostics({ userId });
      console.log("Resultado del Diagnóstico de Memoria:");
      console.log(diagnostics);
      console.log("");

      // Guardar un tema de prueba en Drive
      console.log("Guardando tema de prueba 'familia'...");
      const saveTopicRes = await tools.memory_save_topic({
        topicName: "familia",
        content: JSON.stringify({
          topic: "familia",
          lastUpdated: new Date().toISOString(),
          details: "Jesús tiene dos hermanos, Juan y María. Su madre se llama Carmen."
        }),
        userId
      });
      console.log(saveTopicRes);
      console.log("");

      // Buscar tema 'familia' (debería leer del archivo silvania/temas/familia.json)
      console.log("Buscando tema 'familia' con 'memory_search_by_topic'...");
      const searchRes = await tools.memory_search_by_topic({ topic: "familia", userId });
      console.log("Resultado de búsqueda de tema 'familia':");
      console.log(searchRes);
      console.log("");

      // Buscar tema no existente (ej: 'inmuebles') para probar el fallback a historial
      console.log("Buscando tema inexistente 'inmuebles' (debería caer en historial diario)...");
      const fallbackRes = await tools.memory_search_by_topic({ topic: "inmuebles", userId });
      console.log("Resultado de fallback:");
      console.log(fallbackRes);
      console.log("");

      console.log("✅ Pruebas de memoria finalizadas.");
    } catch (e: any) {
      console.error("❌ Error en pruebas de memoria:", e.message);
    }
  });

  console.log("\n====================================================");
  console.log("   🧪 FINALIZADA VERIFICACIÓN DE REQUISITOS SILVANIA ");
  console.log("====================================================");
}

runTests();
