import { morningRadarService } from "../src/services/morningRadar.js";
import { llmService } from "../src/services/llm.js";
import { MOTIVATIONAL_QUOTES } from "../src/config/quotes.js";

async function testMorningBriefing(locale: string = "es") {
  console.log(`=== TEST BRIEFING MATUTINO (locale: ${locale}) ===`);

  // 1. Simular eventos de calendario
  const calendarSummary = "🗓️ 10:00 - 11:00: Reunión de estrategia comercial\n🗓️ 15:30 - 16:15: Revisión técnica con el equipo de IA";

  // 2. Frase del día
  const selectedQuote = MOTIVATIONAL_QUOTES[0];

  // 3. Obtener Radar
  console.log("\nObteniendo Radar matutino...");
  const radarMarkdown = await morningRadarService.getMorningRadarMarkdown(locale);
  console.log("Radar obtenido:\n", radarMarkdown);

  // 4. Generar briefing con LLM
  const languageName = locale === "en" ? "inglés" : locale === "pt" ? "portugués" : "español";
  const prompt = `Actúa como Silvania CoreAgent, el asistente personal del usuario. Genera los bloques del briefing matutino para un ejecutivo de élite en ${languageName}.

Aquí tienes sus eventos del calendario para hoy:
${calendarSummary}

Frase inspiradora del día:
"${selectedQuote}"

Estructura obligatoria de tu respuesta:
[SALUDO_Y_AGENDA]
Saluda con cordialidad y energía. Resume de forma clara los eventos/citas del día (usa emojis 🗓️, ⏰). Si no hay eventos o no se pudo leer el calendario, indícalo de forma amable y natural.

[MOTIVACION]
Cierra el briefing de manera fluida y elegante incorporando y desarrollando la frase inspiradora del día para motivar su jornada laboral.

IMPORTANTE: No inventes noticias ni añadas secciones adicionales. Respeta las etiquetas [SALUDO_Y_AGENDA] y [MOTIVACION].`;

  console.log("\nLlamando a LLM para agenda y motivación...");
  const response = await llmService.chat([
    { role: "system", content: "Eres Silvania CoreAgent, un asistente ejecutivo de élite." },
    { role: "user", content: prompt }
  ]);

  const responseText = response.content || "";
  const agendaMatch = responseText.match(/\[SALUDO_Y_AGENDA\]([\s\S]*?)(\[MOTIVACION\]|$)/i);
  const motivacionMatch = responseText.match(/\[MOTIVACION\]([\s\S]*)/i);

  let finalMessage = "";
  if (agendaMatch && motivacionMatch) {
    const agendaPart = agendaMatch[1].trim();
    const motivacionPart = motivacionMatch[1].trim();
    if (radarMarkdown) {
      finalMessage = `${agendaPart}\n\n${radarMarkdown}\n\n${motivacionPart}`;
    } else {
      finalMessage = `${agendaPart}\n\n${motivacionPart}`;
    }
  } else {
    if (radarMarkdown) {
      finalMessage = `${responseText.trim()}\n\n${radarMarkdown}`;
    } else {
      finalMessage = responseText.trim();
    }
  }

  console.log("\n=================================");
  console.log("MENSAJE FINAL BRIEFING MATUTINO:");
  console.log("=================================");
  console.log(finalMessage);
  console.log(`\nLongitud total: ${finalMessage.length} caracteres.`);

  // 5. Probar segunda llamada para verificar caché
  console.log("\nProbando segunda llamada inmediata para verificar caché...");
  const cachedStart = Date.now();
  const cachedRadar = await morningRadarService.getMorningRadarMarkdown(locale);
  const durationMs = Date.now() - cachedStart;
  console.log(`Segunda llamada tardó ${durationMs}ms (debe ser instantánea por caché).`);
  console.log(`Contenido idéntico: ${cachedRadar === radarMarkdown}`);
}

testMorningBriefing("es");
