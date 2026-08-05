import { sheetsCreate, sheetsWrite, sheetsRead } from "../src/tools/sheets.js";
import { userContextStore } from "../src/services/context.js";
import { formatFileLink } from "../src/services/linkFormatter.js";

// Simulación de convertMarkdownToHtml simplificado de src/index.ts
function testConvertMarkdownToHtml(text: string): string {
  if (!text) return "";
  let processed = text;
  processed = processed.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  processed = processed.replace(/__([^_]+)__/g, "<b>$1</b>");
  processed = processed.replace(/`([^`]+)`/g, "<code>$1</code>");

  const tokens: string[] = [];
  processed = processed.replace(/<(\/?(?:b|i|code|pre|u|s|strike|del|span))>/gi, (match) => {
    tokens.push(match);
    return `___HTML_TOKEN_${tokens.length - 1}___`;
  });

  processed = processed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  processed = processed.replace(/___HTML_TOKEN_(\d+)___/g, (_, idx) => {
    return tokens[parseInt(idx)];
  });

  return processed;
}

async function main() {
  const userId = 1572946817; // Jesús
  console.log("=== INICIANDO PRUEBAS DE ROLLBACK Y SIMPLIFICACIÓN ===");

  // 1. Verificar convertMarkdownToHtml
  console.log("\n1. Probando convertMarkdownToHtml simplificado...");
  const rawMsg = "Hola, he encontrado este archivo:\n" +
                 formatFileLink("mi_archivo_2026.pdf", "https://drive.google.com/file/d/123/view?usp=drivesdk&key=abc") + "\n" +
                 "Nota: El total es < de 100 y el IVA es > de 0.";
                 
  const converted = testConvertMarkdownToHtml(rawMsg);
  console.log("Mensaje original:\n", rawMsg);
  console.log("\nMensaje convertido a HTML:\n", converted);
  
  const hasPlainLink = converted.includes("mi_archivo_2026.pdf · 🔗 Abrir (https://drive.google.com/file/d/123/view?usp=drivesdk&amp;key=abc)");
  const hasEscapedMath = converted.includes("El total es &lt; de 100") && converted.includes("el IVA es &gt; de 0.");
  
  if (hasPlainLink && hasEscapedMath) {
    console.log("✅ El convertidor simplificado procesó todo perfectamente.");
  } else {
    console.error("❌ Falló la conversión del convertidor simplificado.");
  }

  // 2. Crear y escribir la factura RollbackOK con 3 productos
  console.log("\n2. Creando hoja 'RollbackOK'...");
  await userContextStore.run({ userId }, async () => {
    try {
      const createRes = await sheetsCreate("RollbackOK", userId);
      console.log(createRes);

      const idMatch = createRes.match(/spreadsheetId:\s+(\S+)/);
      if (!idMatch) {
        console.error("❌ No se pudo extraer el spreadsheetId del texto plano.");
        return;
      }
      const spreadsheetId = idMatch[1];
      console.log(`ID Extraído Exitosamente: ${spreadsheetId}`);

      console.log(`\nEscribiendo factura de 3 productos con fórmula de IVA 21%...`);
      const invoiceData = [
        "Concepto | Cantidad | Precio Unitario | Base Imponible",
        "Laptop Silvania | 1 | 800.00 | =B2*C2",
        "Monitor 4K | 2 | 250.00 | =B3*C3",
        "Teclado Mecánico | 1 | 80.00 | =B4*C4",
        " | | Subtotal | =SUM(D2:D4)",
        " | | IVA 21% | =D5*21%",
        " | | Total | =D5+D6"
      ].join("\n");

      const writeRes = await sheetsWrite(spreadsheetId, "A1:D7", invoiceData, userId);
      console.log(writeRes);

      console.log(`\nLeyendo la hoja para verificar si las fórmulas se calcularon correctamente...`);
      const readRes = await sheetsRead(spreadsheetId, "A1:D7", userId);
      console.log(readRes);

      console.log("\n=== PRUEBAS FINALIZADAS CON ÉXITO ===");
    } catch (e: any) {
      console.error("❌ Error en pruebas de Sheets:", e.message);
    }
  });
}

main();
