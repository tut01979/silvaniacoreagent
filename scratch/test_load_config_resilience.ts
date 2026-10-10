import { configManager } from "../src/services/configManager.js";
import { criticalLogService } from "../src/services/criticalLog.js";
import { dbService } from "../src/database/db.js";

async function testLoadConfig() {
  console.log("🧪 Probando resiliencia de configManager.loadConfig para usuario sin token...");
  let alertFired = false;
  criticalLogService.registerCallback(async (msg) => {
    alertFired = true;
  });

  // Usuario 99999999 no existe y no tiene token
  const cfg = await configManager.loadConfig(99999999);
  console.log("Resultado config:", cfg);

  if (alertFired) {
    console.error("❌ ERROR: Se disparó alerta crítica para usuario sin token!");
    throw new Error("Alerta crítica disparada");
  } else {
    console.log("✅ ÉXITO: Usuario sin token utilizó fallback silencioso y NO disparó alerta crítica.");
  }

  dbService.close();
}

testLoadConfig().then(() => {
  console.log("Test finalizado con éxito.");
}).catch(e => {
  console.error("Error en test:", e);
  dbService.close();
});
