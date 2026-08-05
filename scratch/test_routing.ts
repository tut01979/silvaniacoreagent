// Simulación de la regex de detección de herramientas
const requiresToolsRegex = /crea|crear|lista|listar|busca|buscar|envia|envía|envias|envías|lee|leer|open|genera|generar|sube|subir|mueve|mover|borra|borrar|investiga|investigar|resume|resumir|transcribe|transcribir|factura|evento|correo|email|gmail|mensaje|recibido|bandeja|drive|carpeta|archivo|subir|descargar|mkdir|calendar|calendario|cita|reunion|reunión|agenda|programar|youtube|video|transcripcion|transcripción|sheets|excel|hoja|celda|fila|columna|web_search|noticia|noticias|memoria|historial|resumen|recordar|recuerdas|nombre|ayer|hablamos|primera|conversacion|conversación|dijiste|dije/i;

function checkMessage(msg: string): boolean {
  return requiresToolsRegex.test(msg);
}

function runTests() {
  console.log("=== INICIANDO PRUEBAS DE CLASIFICACIÓN DE RUTEO ===");
  
  const testCases = [
    { text: "hola", expected: false },
    { text: "gracias", expected: false },
    { text: "ok listo", expected: false },
    { text: "crea una factura funcional llamada TestRuteoOK con 2 productos, IVA 21% y total", expected: true },
    { text: "lista la raíz de mi Drive", expected: true },
    { text: "busca correos de ayer", expected: true },
    { text: "cuál es mi nombre", expected: true },
    { text: "qué es silvania.ai", expected: false }, // búsqueda web general no forzada (llama a la web si quiere, pero es conversacional a menos que tenga verbos)
    { text: "investiga a google", expected: true },
    { text: "resume la conversación anterior", expected: true },
  ];

  let passedCount = 0;
  for (const tc of testCases) {
    const result = checkMessage(tc.text);
    const passed = result === tc.expected;
    console.log(`Mensaje: "${tc.text}" -> Requiere herramientas? ${result} (Esperado: ${tc.expected}) -> ${passed ? "✅ PASÓ" : "❌ FALLÓ"}`);
    if (passed) passedCount++;
  }

  console.log(`\nResultado de pruebas: ${passedCount}/${testCases.length} pasadas.`);
  if (passedCount === testCases.length) {
    console.log("✅ Todas las pruebas de ruteo y clasificación pasaron con éxito.");
  } else {
    console.error("❌ Hay fallos en la clasificación de ruteo.");
  }
}

runTests();
