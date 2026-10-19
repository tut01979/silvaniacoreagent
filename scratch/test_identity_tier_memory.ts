import { isBetaUser, getGoogleCredentials } from "../src/services/authHelper.js";
import { executeTool } from "../src/tools/index.js";
import { runAgent } from "../src/agent/agent.ts";
import { config } from "../src/config/config.js";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 INICIANDO PRUEBAS DE IDENTIDAD, TIER Y MEMORIA");
  console.log("=================================================\n");

  // TEST 1: Tier OAuth de producción vs beta
  console.log("--- TEST 1: Verificación de Tiers y Scopes ---");
  const prodUserId = 999888; // Usuario no en lista blanca beta
  const isBetaProd = isBetaUser(prodUserId);
  const credsProd = getGoogleCredentials(prodUserId);
  console.log(`Usuario prod (${prodUserId}) - isBetaUser: ${isBetaProd} (esperado: false)`);
  console.log(`Usuario prod (${prodUserId}) - tier: ${credsProd?.tier || 'prod'} (esperado: prod)`);
  console.log(`Scopes prod: ${credsProd?.scopes}`);
  if (isBetaProd) throw new Error("Fallo: usuario 999888 no debería ser beta");

  // TEST 2: Protección a nivel de executeTool para tools de lectura de Gmail en prod
  console.log("\n--- TEST 2: executeTool bloqueo en Tier Producción ---");
  const gmailListRes = await executeTool("gmail_list", { max_results: 5 }, prodUserId);
  console.log(`Resultado executeTool('gmail_list') para prod:\n${gmailListRes}`);
  if (!gmailListRes.includes("no está disponible en tu plan/tier actual") || !gmailListRes.includes("https://mail.google.com")) {
    throw new Error("Fallo: executeTool('gmail_list') no bloqueó al usuario prod");
  }

  // TEST 3: Enrutamiento /marketing post
  console.log("\n--- TEST 3: Comando /marketing post no responde como CoreAgent genérico ---");
  const mktPostRes = await runAgent(prodUserId, "/marketing post");
  console.log(`Respuesta a '/marketing post':\n${mktPostRes}`);
  if (mktPostRes.includes("Soy Silvania CoreAgent") || !mktPostRes.includes("Marketing Studio")) {
    throw new Error("Fallo: /marketing post respondió como CoreAgent genérico");
  }

  // TEST 4: Enrutamiento /eva
  console.log("\n--- TEST 4: Comando /eva explica 0 scopes y deriva a la web ---");
  const evaRes = await runAgent(prodUserId, "/eva");
  console.log(`Respuesta a '/eva':\n${evaRes}`);
  if (!evaRes.includes("Eva") || !evaRes.includes("cero scopes") || !evaRes.includes("https://silvania.ai/eva")) {
    throw new Error("Fallo: /eva no explicó la privacidad o no derivó a la web");
  }

  // TEST 5: Prompt y capacidades de calendar en prod
  console.log("\n--- TEST 5: Verificación de calendar disponible en tier prod ---");
  // Calendar create está en la lista de tools de prod
  const calendarListRes = await executeTool("calendar_list", { days_ahead: 1 }, prodUserId);
  console.log(`Resultado executeTool('calendar_list') (no bloqueado por tier):\n${calendarListRes}`);
  if (calendarListRes.includes("no está disponible en tu plan/tier actual")) {
    throw new Error("Fallo: calendar_list no debería estar bloqueado por tier en prod");
  }

  console.log("\n=================================================");
  console.log("✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE");
  console.log("=================================================");
  const { dbService } = await import("../src/database/db.js");
  dbService.close();
}

runTests().catch(async err => {
  console.error("❌ ERROR EN TEST:", err);
  const { dbService } = await import("../src/database/db.js");
  dbService.close();
  process.exit(1);
});
