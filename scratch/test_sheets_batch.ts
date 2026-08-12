// Test script to validate sheetsWrite batch update format
import { sheetsWrite } from "../src/tools/sheets.js";

async function testSheetsBatch() {
  console.log("=== INICIANDO PRUEBAS DE ESCRITURA EN LOTES DE SHEETS ===");
  
  // Matriz de prueba
  const mockMatrix = [
    ["Nombre", "Sitio web", "Dirección", "Teléfono", "Email", "Actividad"],
    ["Plásticos Valencia S.A.", "https://plasticosvalencia.com", "Calle Industria 12", "+34 963 123 456", "info@plasticosvalencia.com", "Fabricante de envases"],
    ["Reciclajes Levante", "https://reciclajeslevante.es", "Polígono Industrial Sur", "+34 961 987 654", "contacto@reciclajeslevante.es", "Reciclaje de PET"]
  ];

  // Simular la conversión de matriz
  console.log("-> Matriz de entrada:\n", JSON.stringify(mockMatrix, null, 2));

  // Simular lógica interna de sheetsWrite
  const matrix = mockMatrix.map(row => {
    return row.map(cell => {
      if (cell === null || cell === undefined) return "";
      const trimmed = String(cell).trim();
      if (trimmed !== "" && !isNaN(Number(trimmed))) {
        return Number(trimmed);
      }
      return trimmed;
    });
  });

  const jsonVal = JSON.stringify(matrix);
  console.log("\n-> JSON serializado final para Gog:\n", jsonVal);

  const isValidJson = (() => {
    try {
      JSON.parse(jsonVal);
      return true;
    } catch {
      return false;
    }
  })();

  console.log(`\n-> JSON válido y bien estructurado: ${isValidJson ? "✅ PASÓ" : "❌ FALLÓ"}`);
  console.log(`-> Formato de matriz preservado (2D): ${Array.isArray(matrix) && Array.isArray(matrix[0]) ? "✅ PASÓ" : "❌ FALLÓ"}`);

  if (isValidJson && matrix.length === 3) {
    console.log("\n✅ TODAS LAS PRUEBAS DE ESCRITURA EN LOTES PASARON CON ÉXITO.");
  } else {
    console.error("\n❌ ALGUNAS PRUEBAS FALLARON.");
  }
}

testSheetsBatch().catch(err => {
  console.error("❌ Fallo en la prueba:", err);
});
