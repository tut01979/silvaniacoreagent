import { sheetsCreate, sheetsWrite, sheetsRead } from "../src/tools/sheets.js";
import { userContextStore } from "../src/services/context.js";

async function main() {
  const userId = 1572946817; // Jesús
  console.log("=== INICIANDO PRUEBA DE FACTURACIÓN SHEETS ===");

  await userContextStore.run({ userId }, async () => {
    try {
      // 1. Crear la hoja TestFacturaOK
      console.log("\n1. Creando hoja 'TestFacturaOK'...");
      const createRes = await sheetsCreate("TestFacturaOK", userId);
      console.log(createRes);

      const idMatch = createRes.match(/spreadsheetId:\s+(\S+)/);
      if (!idMatch) {
        console.error("❌ No se pudo extraer el spreadsheetId del texto plano.");
        return;
      }
      const spreadsheetId = idMatch[1];
      console.log(`ID Extraído: ${spreadsheetId}`);

      // 2. Escribir estructura de la factura
      console.log("\n2. Escribiendo la estructura de la factura celda a celda...");
      
      // A1: Título
      await sheetsWrite(spreadsheetId, "A1", "FACTURA", userId);
      
      // A3:A6: Datos Emisor
      const emisorData = "Silvania.ai\nCalle Innovación 99\nMadrid, España\nCIF: B12345678";
      await sheetsWrite(spreadsheetId, "A3:A6", emisorData, userId);

      // A10:A12: Datos Cliente
      const clienteData = "Jesús Quintero\nCliente VIP\njesus@example.com";
      await sheetsWrite(spreadsheetId, "A10:A12", clienteData, userId);

      // A16: Fecha y Nº factura
      await sheetsWrite(spreadsheetId, "A16", "Fecha: 05/08/2026 | Factura Nº: INV-2026-003", userId);

      // A18:D18: Encabezados
      const headers = "Concepto | Cantidad | Precio Unitario | Importe";
      await sheetsWrite(spreadsheetId, "A18:D18", headers, userId);

      // Filas 19, 20, 21: Productos de ejemplo (con Cantidad y Precio como NÚMEROS REALES)
      // Laptop Silvania: 1 unidad a 800
      await sheetsWrite(spreadsheetId, "A19:D19", "Laptop Silvania | 1 | 800.00 | =B19*C19", userId);
      // Monitor 4K: 2 unidades a 250
      await sheetsWrite(spreadsheetId, "A20:D20", "Monitor 4K | 2 | 250.00 | =B20*C20", userId);
      // Relleno tercera fila vacía / guión para cumplir estructura fija de 3 productos
      await sheetsWrite(spreadsheetId, "A21:D21", "- | 0 | 0.00 | =B21*C21", userId);

      // Fila 23: Subtotal
      await sheetsWrite(spreadsheetId, "B23:C23", "Subtotal | =SUMA(D19:D21)", userId);

      // Fila 24: IVA 21%
      await sheetsWrite(spreadsheetId, "B24:C24", "IVA 21% | =C23*21%", userId);

      // Fila 25: Total
      await sheetsWrite(spreadsheetId, "B25:C25", "Total | =C23+C24", userId);

      console.log("Factura escrita.");

      // 3. Leer y verificar los cálculos
      console.log("\n3. Leyendo el resultado de la hoja para verificar si hay #VALUE!...");
      const readRes = await sheetsRead(spreadsheetId, "A18:D25", userId);
      console.log(readRes);

      const hasValueErr = readRes.includes("#VALUE!") || readRes.includes("#VALOR!");
      if (hasValueErr) {
        console.error("❌ Falló la prueba: Se detectaron errores #VALUE! o #VALOR! en la factura.");
      } else {
        console.log("✅ Éxito: Las fórmulas se calcularon correctamente.");
      }

    } catch (e: any) {
      console.error("❌ Error durante el test:", e.message);
    }
  });
}

main();
