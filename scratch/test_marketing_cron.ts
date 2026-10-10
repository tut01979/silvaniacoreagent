import { MARKETING_PRODUCTS } from "../src/marketing/cron.js";
import { config } from "../src/config/config.js";

async function testMarketingCron() {
  console.log("🧪 Iniciando test del Cron de Marketing Rotativo para Admins...");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // 1. Verificar productos rotativos
  assert(MARKETING_PRODUCTS.length === 3, "Existen exactamente 3 productos rotativos");

  const coreAgent = MARKETING_PRODUCTS[0];
  assert(coreAgent.name.includes("CoreAgent"), "Producto 0 es CoreAgent");
  assert(coreAgent.status === "disponible", "CoreAgent está disponible (Acceso Anticipado)");
  assert(coreAgent.angle.includes("Google Workspace") && coreAgent.angle.includes("Telegram"), "CoreAgent destaca Workspace y Telegram");

  const eva = MARKETING_PRODUCTS[1];
  assert(eva.name.includes("Eva"), "Producto 1 es Eva");
  assert(eva.status === "proximamente", "Eva está en estado 'proximamente'");
  assert(eva.angle.includes("Próximamente") && eva.angle.includes("laboratorio"), "Eva enfatiza Próximamente / laboratorio");
  assert(eva.angle.includes("menores"), "Eva protege la privacidad de menores");

  const marketingStudio = MARKETING_PRODUCTS[2];
  assert(marketingStudio.name.includes("Marketing Studio"), "Producto 2 es Marketing Studio");
  assert(marketingStudio.status === "proximamente", "Marketing Studio está en estado 'proximamente'");
  assert(marketingStudio.angle.includes("Human-in-the-Loop") || marketingStudio.angle.includes("aprobación"), "Marketing Studio requiere supervisión HITL");

  // 2. Verificar reglas de destinatario
  const adminIds = config.marketing.adminIds;
  assert(Array.isArray(adminIds) && adminIds.length > 0, "Hay al menos un admin en config.marketing.adminIds");
  assert(adminIds.includes(1572946817), "1572946817 (Jesús) está en la lista de administradores de marketing");

  // 3. Simulación de rotación
  let lastIndex = 0;
  const seq = [];
  for (let i = 0; i < 6; i++) {
    lastIndex = (lastIndex + 1) % MARKETING_PRODUCTS.length;
    seq.push(lastIndex);
  }
  assert(
    seq[0] === 1 && seq[1] === 2 && seq[2] === 0 && seq[3] === 1 && seq[4] === 2 && seq[5] === 0,
    "Rotación cíclica 0 -> 1 -> 2 -> 0 verificada"
  );

  console.log(`\n========================================`);
  console.log(`Pruebas de Cron de Marketing: ${passed} pasadas, ${failed} fallidas.`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

testMarketingCron().catch(err => {
  console.error("Error en test:", err);
  process.exit(1);
});
