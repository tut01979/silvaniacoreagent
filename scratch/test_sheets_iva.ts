import { sheetsCreate, sheetsWrite, sheetsRead } from "../src/tools/sheets.js";
import { userContextStore } from "../src/services/context.js";
import { runGog } from "../src/tools/gogWrapper.js";

async function main() {
  const userId = 1572946817; // Jesús
  console.log("=== INICIANDO PRUEBA DE CREACIÓN DE FACTURA TESTIVAFINAL ===");

  await userContextStore.run({ userId }, async () => {
    try {
      // 1. Crear la hoja TestIVAFinal
      console.log("\n1. Creando hoja de cálculo 'TestIVAFinal'...");
      const createRes = await sheetsCreate("TestIVAFinal", userId);
      console.log(createRes);

      // Buscar el ID de la hoja creada (lo extraemos de la respuesta de sheetsCreate)
      const idMatch = createRes.match(/🆔 \*\*ID:\*\* `([^`]+)`/);
      if (!idMatch) {
        console.error("❌ No se pudo extraer el ID de la hoja creada.");
        return;
      }
      const spreadsheetId = idMatch[1];
      console.log(`ID Extraído: ${spreadsheetId}`);

      // 2. Escribir los datos y fórmulas
      console.log("\n2. Volcando datos de factura y fórmula de IVA (21%)...");
      // Diseñamos los valores en formato CSV/pipes:
      // Fila 1: Cabeceras
      // Fila 2: Concepto, Cantidad, Precio Unitario, Base Imponible (fórmula)
      // Fila 3: Vacío, Vacío, "Subtotal", fórmula sumando base
      // Fila 4: Vacío, Vacío, "IVA (21%)", fórmula multiplying by 21%
      // Fila 5: Vacío, Vacío, "Total Factura", fórmula sumando subtotal + IVA
      
      const invoiceData = [
        "Concepto | Cantidad | Precio Unitario | Base Imponible",
        "Licencia Silvania SaaS | 1 | 100.00 | =B2*C2",
        "Soporte Premium | 1 | 50.00 | =B3*C3",
        " | | Subtotal | =SUM(D2:D3)",
        " | | IVA 21% | =D4*21%",
        " | | Total | =D4+D5"
      ].join("\n");

      const writeRes = await sheetsWrite(spreadsheetId, "Sheet1!A1:D6", invoiceData, userId);
      console.log(writeRes);

      // 3. Leer los datos escritos para verificar
      console.log("\n3. Leyendo datos de la hoja para verificar...");
      const readRes = await sheetsRead(spreadsheetId, "Sheet1!A1:D6", userId);
      console.log(readRes);

      console.log("\n=== PRUEBA DE FACTURA FINALIZADA CON ÉXITO ===");
    } catch (err: any) {
      console.error("❌ Error en la prueba de factura:", err.message);
    }
  });
}

main();
