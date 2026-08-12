// Test script to validate batch sheets write enforcer logic
async function testBatchSheetsEnforcer() {
  console.log("=== INICIANDO PRUEBAS DE ENFORCER BATCH DE SHEETS ===");

  // Simulación de respuesta de tool_calls del LLM con abuso de llamadas a sheets_write
  const mockToolCallsAbuse = [
    {
      id: "call_1",
      function: {
        name: "sheets_write",
        arguments: JSON.stringify({ spreadsheet_id: "sheet_id_12345", range: "A1", values: "Concepto" })
      }
    },
    {
      id: "call_2",
      function: {
        name: "sheets_write",
        arguments: JSON.stringify({ spreadsheet_id: "sheet_id_12345", range: "B1", values: "Cantidad" })
      }
    },
    {
      id: "call_3",
      function: {
        name: "sheets_write",
        arguments: JSON.stringify({ spreadsheet_id: "sheet_id_12345", range: "C1", values: "Precio" })
      }
    }
  ];

  // Simulación de respuesta de tool_calls del LLM válida (menos de 3 escrituras)
  const mockToolCallsValid = [
    {
      id: "call_1",
      function: {
        name: "sheets_write",
        arguments: JSON.stringify({ spreadsheet_id: "sheet_id_12345", range: "A1", values: [["Concepto", "Cantidad", "Precio"]] })
      }
    }
  ];

  function runCheck(toolCalls: any[]): boolean {
    const sheetsWriteCalls = toolCalls.filter(tc => tc.function.name === "sheets_write");
    if (sheetsWriteCalls.length >= 3) {
      const sheetIds = sheetsWriteCalls.map(tc => {
        try {
          return JSON.parse(tc.function.arguments).spreadsheet_id;
        } catch {
          return null;
        }
      });
      const hasAbuse = sheetIds.some(id => id && sheetIds.filter(x => x === id).length >= 3);
      if (hasAbuse) {
        return true; // Se detectó y bloqueó el abuso
      }
    }
    return false; // Permitido
  }

  console.log(`-> Escenario de abuso (3 escrituras individuales): ${runCheck(mockToolCallsAbuse) ? "✅ PASÓ (Bloqueado/Enforzado)" : "❌ FALLÓ"}`);
  console.log(`-> Escenario válido (1 escritura batch): ${!runCheck(mockToolCallsValid) ? "✅ PASÓ (Permitido)" : "❌ FALLÓ"}`);

  if (runCheck(mockToolCallsAbuse) && !runCheck(mockToolCallsValid)) {
    console.log("\n✅ TODAS LAS PRUEBAS DE ENFORCER BATCH PASARON CON ÉXITO.");
  } else {
    console.error("\n❌ ALGUNAS PRUEBAS FALLARON.");
  }
}

testBatchSheetsEnforcer().catch(err => {
  console.error("❌ Fallo en la prueba:", err);
});
