function simulateMultitaskCompilation(taskResults: { task: string; result: string }[]): string {
  let finalAgentResponse = "";
  for (let i = 0; i < taskResults.length; i++) {
    const tr = taskResults[i];
    finalAgentResponse += `**${i + 1}. Tarea: ${tr.task}**\n${tr.result}\n\n`;
  }
  finalAgentResponse += `✅ Completado: ${taskResults.length}/${taskResults.length} tareas`;
  return finalAgentResponse;
}

function runTests() {
  console.log("=== INICIANDO PRUEBAS DE COMPILACIÓN DE RESPUESTA MULTITAREA ===");

  const dummyResults = [
    {
      task: "Listar últimos 5 correos",
      result: "📧 Factura Silvania\nhttps://mail.google.com/mail/u/0/#inbox/msg-123\n👤 Remitente: emisor@silvania.ai\n📅 05/08/2026\n\n📧 Reunión Inversores\nhttps://mail.google.com/mail/u/0/#inbox/msg-456\n👤 Remitente: jesus@example.com\n📅 05/08/2026"
    },
    {
      task: "Crear evento para mañana reunión inversores a las 10:00",
      result: "📅 Reunión Inversores · 🔗 Abrir (https://www.google.com/calendar/event?eid=abc)\n> ⏰ **Cuándo:** jueves, 6 de agosto de 2026, 10:00\n> 📍 **Lugar:** Oficina Central"
    }
  ];

  const compiled = simulateMultitaskCompilation(dummyResults);
  console.log("\n--- RESPUESTA FINAL COMPILADA POR EL AGENTE ---");
  console.log(compiled);
  console.log("----------------------------------------------");

  const hasFirstTask = compiled.includes("**1. Tarea: Listar últimos 5 correos**") && compiled.includes("📧 Factura Silvania");
  const hasSecondTask = compiled.includes("**2. Tarea: Crear evento para mañana reunión inversores a las 10:00**") && compiled.includes("Reunión Inversores · 🔗 Abrir");
  const hasStatusLine = compiled.endsWith("✅ Completado: 2/2 tareas");

  if (hasFirstTask && hasSecondTask && hasStatusLine) {
    console.log("✅ El compilador de multitarea detallado generó la respuesta correctamente.");
  } else {
    console.error("❌ Falló la compilación de la respuesta.");
  }
}

runTests();
