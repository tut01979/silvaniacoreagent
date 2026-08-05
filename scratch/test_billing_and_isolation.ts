import { dbService } from "../src/database/db.js";
import { runGog } from "../src/tools/gogWrapper.js";
import { userContextStore } from "../src/services/context.js";

async function runTest() {
  console.log("🧪 Iniciando pruebas de aislamiento de credenciales y lógica de facturación...");

  const testUserId = 99999;

  // --- 1. PRUEBAS DE FACTURACIÓN ---
  console.log("\n--- 1. Pruebas de Facturación ---");

  // Limpiar cualquier suscripción anterior del usuario de prueba
  try {
    const sub = await dbService.getSubscription(testUserId);
    console.log("Suscripción inicial del usuario de prueba:", sub);
  } catch (err: any) {
    console.log("No había suscripción previa o error al consultar:", err.message);
  }

  // Comprobar el estado inicial (debería crear una de prueba por defecto)
  const initialBilling = await dbService.checkUserBillingStatus(testUserId);
  console.log("1.1. Estado inicial creado automáticamente:", initialBilling);
  if (!initialBilling.isBlocked && initialBilling.status === "trialing") {
    console.log("✅ Éxito: Periodo de prueba inicial creado y no bloqueado.");
  } else {
    console.error("❌ Fallo: El periodo de prueba inicial no se creó correctamente.");
  }

  // Forzar expiración del periodo de prueba directamente en la base de datos local
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Ayer
  await dbService.createOrUpdateSubscription(testUserId, "trialing", null, null, pastDate);
  const expiredBilling = await dbService.checkUserBillingStatus(testUserId);
  console.log("1.2. Estado tras expirar la fecha de prueba:", expiredBilling);
  if (expiredBilling.isBlocked && expiredBilling.status === "trialing") {
    console.log("✅ Éxito: La cuenta se bloquea cuando la fecha de prueba está en el pasado.");
  } else {
    console.error("❌ Fallo: La cuenta no se bloqueó tras expirar la fecha de prueba.");
  }

  // Activar la cuenta (simulación de pago completado)
  await dbService.createOrUpdateSubscription(testUserId, "active", "cus_mock_test", "sub_mock_test", null);
  const activeBilling = await dbService.checkUserBillingStatus(testUserId);
  console.log("1.3. Estado tras simular pago activo:", activeBilling);
  if (!activeBilling.isBlocked && activeBilling.status === "active") {
    console.log("✅ Éxito: La cuenta se desbloquea tras el pago activo.");
  } else {
    console.error("❌ Fallo: La cuenta sigue bloqueada a pesar del pago activo.");
  }


  // --- 2. PRUEBAS DE AISLAMIENTO DE CREDENCIALES (GOG) ---
  console.log("\n--- 2. Pruebas de Aislamiento de Credenciales ---");

  // El usuario de prueba (testUserId = 99999) no tiene tokens guardados en la base de datos
  await userContextStore.run({ userId: testUserId }, async () => {
    console.log("Ejecutando comando de Drive en el contexto del usuario sin token...");
    try {
      const result = await runGog("drive ls");
      console.log("Resultado de la ejecución:", result);
      if (result.includes("No has vinculado tu cuenta de Google")) {
        console.log("✅ Éxito: El comando se bloqueó de manera segura debido a la falta de token de Google.");
      } else {
        console.error("❌ Fallo: El comando se ejecutó o devolvió un resultado inesperado, vulnerando el aislamiento.");
      }
    } catch (err: any) {
      console.error("❌ Fallo: El envoltorio arrojó un error en lugar de devolver el mensaje de bloqueo amigable:", err.message);
    }
  });

  console.log("\n🧪 Pruebas finalizadas.");
}

runTest().catch(console.error);
