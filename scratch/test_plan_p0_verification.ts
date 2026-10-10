import { filterFinalOutput, sanitizeAlucinatedLinks } from "../src/agent/agent.js";
import { criticalLogService } from "../src/services/criticalLog.js";

async function runTests() {
  console.log("🚀 Iniciando suite de pruebas de Plan P0...");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // 1. Test filterFinalOutput
  console.log("\n🧪 1. Probando filterFinalOutput (eliminación de print y bloques python)...");
  
  const pythonSimulation = "Aquí tienes los datos:\n```python\n# Código para consultar\nprint(gmail_list())\n```\nFin de la respuesta.";
  const cleanedPython = filterFinalOutput(pythonSimulation);
  assert(!cleanedPython.includes("print(gmail_list())"), "Bloque python con print(...) eliminado correctamente");
  assert(!cleanedPython.includes("```python"), "Fences ```python eliminados correctamente");
  assert(cleanedPython.includes("Aquí tienes los datos:"), "Texto legítimo conservado");

  const loosePrint = "Llamando a la función:\nprint(tools.web_search('noticias'))\nOperación lista.";
  const cleanedLoose = filterFinalOutput(loosePrint);
  assert(!cleanedLoose.includes("print(tools.web_search"), "Línea suelta con print(...) eliminada correctamente");
  assert(cleanedLoose.includes("Operación lista."), "Texto final legítimo conservado");

  // 2. Test sanitizeAlucinatedLinks
  console.log("\n🧪 2. Probando sanitizeAlucinatedLinks...");
  const fakeToolHistory = [
    {
      role: "tool",
      content: "📁 CENTRO DE ARCHIVOS DRIVE\n📄 Documento Real · 🔗 https://drive.google.com/file/d/1realFolderIdABC12345/view\n> 🆔 ID: `1realFolderIdABC12345`"
    }
  ];

  const agentResponseWithRealAndFake = 
    "Enlace real: https://drive.google.com/file/d/1realFolderIdABC12345/view\n" +
    "Enlace alucinado: https://drive.google.com/file/d/1inventedFakeId99999/view";

  const sanitized = sanitizeAlucinatedLinks(agentResponseWithRealAndFake, fakeToolHistory);
  assert(sanitized.includes("https://drive.google.com/file/d/1realFolderIdABC12345/view"), "Enlace real con ID devuelto por tool conservado");
  assert(!sanitized.includes("https://drive.google.com/file/d/1inventedFakeId99999/view"), "Enlace inventado neutralizado");
  assert(sanitized.includes("[Enlace no disponible — no devuelto por la herramienta]"), "Marcador de enlace no disponible insertado");

  // Verificar que palabras comunes del diccionario en respuestas de tools no se consideran IDs
  const historyWithCommonWords = [
    {
      role: "tool",
      content: "No se encontraron mensajes o carpetas en la respuesta actual."
    }
  ];
  const responseWithWordAsId = "Mira este archivo: https://drive.google.com/file/d/encontraron/view";
  const sanitizedWordLink = sanitizeAlucinatedLinks(responseWithWordAsId, historyWithCommonWords);
  assert(!sanitizedWordLink.includes("encontraron/view"), "Palabras comunes del diccionario ya no se validan como IDs de Google");

  // 3. Test Telegram Alert Formatter & Safe Notifier Fallback
  console.log("\n🧪 3. Probando fallback de alertas críticas de Telegram...");
  let capturedCallbackMsg = "";
  criticalLogService.registerCallback(async (msg: string) => {
    capturedCallbackMsg = msg;
  });

  await criticalLogService.logCritical(
    "Fallo Test",
    "Error con caracteres especiales como `invalid_grant` y [corchetes] y stack_trace_line_45"
  );
  assert(capturedCallbackMsg.includes("ALERTA CRÍTICA"), "Callback de logCritical despachado");
  assert(capturedCallbackMsg.includes("invalid_grant"), "Contiene mensaje de error");

  console.log(`\n========================================`);
  console.log(`Pruebas completadas: ${passed} pasadas, ${failed} fallidas.`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTests().catch(err => {
  console.error("Error en test suite:", err);
  process.exit(1);
});
