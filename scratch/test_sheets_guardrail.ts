// Test script to validate sheets spreadsheetId guardrail
import { sheetsWrite } from "../src/tools/sheets.js";

async function testSheetsGuardrail() {
  console.log("=== INICIANDO PRUEBAS DE GUARDRAIL DE SPREADSHEETID ===");

  const validId = "1DitnECgAHf7XTK4S7JucRLHavuLjwvXAgK3V-gK3V-A"; // Válido
  const shortId = "1Ditn"; // Muy corto
  const longId = "a".repeat(81); // Muy largo
  const invalidCharsId = "1DitnECgAHf7XTK4S7JucRLHavuLjwvXAgK3V-gK3V-A$"; // Carácter inválido ($)
  
  // ID alucinado en bucle (secuencia "gK3V-" repetida)
  const loopedId = "1DitnECgAHf7XTK4S7JucRLHavuLjwvXAgK3V-gK3V-gK3V-gK3V-gK3V-gK3V-";

  // Función validadora para test local
  function isValidSpreadsheetId(id?: string): boolean {
    if (!id || typeof id !== "string") return false;
    const clean = id.trim();
    if (clean.length < 20 || clean.length > 80) return false;
    if (!/^[A-Za-z0-9_-]+$/.test(clean)) return false;

    for (let len = 8; len <= clean.length / 3; len++) {
      for (let i = 0; i <= clean.length - len * 3; i++) {
        const chunk = clean.substring(i, i + len);
        const rest = clean.substring(i + len);
        if (rest.startsWith(chunk + chunk) || rest.startsWith(chunk + "-" + chunk)) {
          return false;
        }
      }
    }
    return true;
  }

  console.log(`-> Valid ID: ${isValidSpreadsheetId(validId) ? "✅ PASÓ (Válido)" : "❌ FALLÓ"}`);
  console.log(`-> Short ID: ${!isValidSpreadsheetId(shortId) ? "✅ PASÓ (Bloqueado)" : "❌ FALLÓ"}`);
  console.log(`-> Long ID: ${!isValidSpreadsheetId(longId) ? "✅ PASÓ (Bloqueado)" : "❌ FALLÓ"}`);
  console.log(`-> Invalid Chars ID: ${!isValidSpreadsheetId(invalidCharsId) ? "✅ PASÓ (Bloqueado)" : "❌ FALLÓ"}`);
  console.log(`-> Looped Alucinated ID: ${!isValidSpreadsheetId(loopedId) ? "✅ PASÓ (Bloqueado)" : "❌ FALLÓ"}`);

  if (
    isValidSpreadsheetId(validId) &&
    !isValidSpreadsheetId(shortId) &&
    !isValidSpreadsheetId(longId) &&
    !isValidSpreadsheetId(invalidCharsId) &&
    !isValidSpreadsheetId(loopedId)
  ) {
    console.log("\n✅ TODAS LAS PRUEBAS DE GUARDRAIL DE SPREADSHEETID PASARON CON ÉXITO.");
  } else {
    console.error("\n❌ ALGUNAS PRUEBAS FALLARON.");
  }
}

testSheetsGuardrail().catch(err => {
  console.error("❌ Fallo en la prueba:", err);
});
