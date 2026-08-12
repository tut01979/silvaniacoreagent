// Official pre-oauth validation script to test read-only operations of Drive, Calendar, and Gmail under the real user context
import { driveList } from "../src/tools/drive.js";
import { calendarList } from "../src/tools/calendar.js";
import { gmailList } from "../src/tools/gmail.js";

async function runPreOauthTests() {
  const userId = 1572946817; // ID real de Jesús Quintero Martínez
  console.log("=== EJECUTANDO PRUEBAS DEL TEST SUITE v2.0 (PRE-OAUTH) ===\n");

  // 1. D1 - Listar raíz de Drive
  try {
    console.log("--- D1: Listar raíz de Drive ---");
    const driveResult = await driveList("root", false, 0, userId);
    console.log(driveResult);
    console.log("\n");
  } catch (err: any) {
    console.error("❌ Falló prueba D1:", err.message);
  }

  // 2. C1 - Listar próximos eventos de Calendar
  try {
    console.log("--- C1: Listar próximos eventos de Calendar ---");
    const calendarResult = await calendarList(userId);
    console.log(calendarResult);
    console.log("\n");
  } catch (err: any) {
    console.error("❌ Falló prueba C1:", err.message);
  }

  // 3. G1 - Listar últimos correos de Gmail
  try {
    console.log("--- G1: Listar últimos correos de Gmail ---");
    const gmailResult = await gmailList(userId, 5);
    console.log(gmailResult);
    console.log("\n");
  } catch (err: any) {
    console.error("❌ Falló prueba G1:", err.message);
  }

  console.log("=== FIN DE LAS PRUEBAS FUNCIONALES ===");
}

runPreOauthTests().catch(err => {
  console.error("❌ Error general en la suite de pruebas:", err);
});
