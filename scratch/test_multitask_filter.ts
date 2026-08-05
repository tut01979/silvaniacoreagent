import { shouldTriggerMultitask } from "../src/services/multitaskFilter.js";

function runTests() {
  console.log("=== INICIANDO PRUEBAS DE FILTRADO DE MULTITAREA ===");

  const testCases = [
    // 1. Explicaciones, opiniones y consultas conceptuales (deben ser false)
    {
      text: "¿Qué opinas sobre el futuro de la inteligencia artificial? Además, me gustaría saber tu explicación.",
      expected: false
    },
    {
      text: "Explícame cómo funciona el ruteo de modelos en Silvania CoreAgent.",
      expected: false
    },
    {
      text: "¿Cómo puedo crear una carpeta de Drive? Dame una opinión técnica sobre las mejores prácticas.",
      expected: false
    },
    {
      text: "Dame un resumen de lo que es un agente inteligente y profundiza en sus capacidades.",
      expected: false
    },
    {
      text: "¿Qué hora es en España? También dime qué día es hoy.", // Conversacional simple sin herramientas complejas
      expected: false
    },

    // 2. Comandos de herramientas individuales con conector conversacional (debe ser false para evitar checklists innecesarios)
    {
      text: "Crea una factura funcional llamada FacturaTest. También quiero que tenga IVA 21%.",
      expected: false // Una sola herramienta de Sheets involucrada (aunque tenga dos frases)
    },

    // 3. Múltiples acciones físicas concretas en herramientas diferentes (deben ser true)
    {
      text: "Lista los archivos en la raíz de mi Drive y también crea una carpeta llamada Fotos.",
      expected: true // Listar + Crear
    },
    {
      text: "Busca los correos electrónicos más recientes y envía una respuesta de confirmación.",
      expected: true // Buscar + Enviar
    },
    {
      text: "Crea una hoja de cálculo y agrégale un evento al calendario para mañana.",
      expected: true // Crear hoja + Crear evento calendario
    },
    {
      text: "Lista mis últimos correos recibidos y sube un resumen consolidado a Google Drive.",
      expected: true // Listar correos + Subir a Drive
    }
  ];

  let passedCount = 0;
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const result = shouldTriggerMultitask(tc.text);
    const passed = result === tc.expected;
    console.log(`Test ${i + 1}: "${tc.text}"\n-> Resultado: ${result} (Esperado: ${tc.expected}) -> ${passed ? "✅ PASÓ" : "❌ FALLÓ"}\n`);
    if (passed) passedCount++;
  }

  console.log(`=== RESULTADO FINAL: ${passedCount}/${testCases.length} pasados ===`);
  if (passedCount === testCases.length) {
    console.log("✅ Todas las pruebas de filtrado de multitarea pasaron con éxito.");
  } else {
    console.error("❌ Hay fallos en el filtrado de multitarea.");
  }
}

runTests();
