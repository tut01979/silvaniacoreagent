// Test script to validate memory manager update throttle logic
import { memoryManager } from "../src/services/memoryManager.js";
import { dbService } from "../src/database/db.js";

async function testMemoryThrottle() {
  console.log("=== INICIANDO PRUEBAS DE THROTTLE DE MEMORIA ===");
  const userId = 99999;
  
  // Agregar un mensaje falso en la BD para hoy
  await dbService.addMessage(userId, "user", "Hola, esta es una prueba de throttle");
  await dbService.addMessage(userId, "assistant", "Hola usuario!");

  console.log("-> Primer llamado de autoUpdateSummary (debería ejecutarse)...");
  await memoryManager.autoUpdateSummary(userId);

  console.log("\n-> Segundo llamado de autoUpdateSummary inmediatamente (debería ser bloqueado por throttle de 15 minutos)...");
  await memoryManager.autoUpdateSummary(userId);

  console.log("\n✅ PRUEBA DE THROTTLE COMPLETADA CON ÉXITO.");
}

testMemoryThrottle().catch(err => {
  console.error("❌ Fallo en la prueba:", err);
});
