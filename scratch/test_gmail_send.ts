import { gmailSend } from "../src/tools/gmail.js";

async function test() {
  console.log("📨 Probando gmailSend...");
  const result = await gmailSend(
    "eduardoqm573@gmail.com",
    "Prueba Automatizada de Silvania - Resultados Búsqueda",
    "Hola Jesús,\n\nEsta es una prueba de envío con texto largo y saltos de línea.\n\nResultados de la empresa SAV:\n1. Empresa | Agricultores de la Vega de Valencia\n   Enlace: https://www.sav.es/\n\nSaludos,\nSilvania CoreAgent"
  );
  console.log("Resultado del envío:", result);
}

test().catch(err => {
  console.error("Error en test:", err);
});
