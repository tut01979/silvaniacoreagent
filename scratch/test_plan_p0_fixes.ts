import { tools } from "../src/tools/index.js";
import { getAuthUrl } from "../src/services/authHelper.js";
import { dbService } from "../src/database/db.js";
import { folderCacheService } from "../src/services/folderCache.js";

async function runTests() {
  console.log("=========================================");
  console.log("🧪 VALIDACIÓN AUTOMATIZADA — PLAN P0");
  console.log("=========================================\n");

  const testUserId = 999123;

  // 1. Validar un solo OAuth (generate_authorization_link vs getAuthUrl)
  console.log("▶️ Test 1: Un solo OAuth");
  const authUrl = getAuthUrl(testUserId);
  const toolResult = await tools.generate_authorization_link({ userId: testUserId });
  
  if (authUrl && toolResult.includes(authUrl)) {
    console.log("  ✅ generate_authorization_link devuelve la MISMA URL que /auth.");
  } else {
    console.error("  ❌ ERROR: generate_authorization_link no coincide con getAuthUrl.");
    process.exit(1);
  }

  // 2. Validar persistencia de carpetas Drive en DB (migración v4)
  console.log("\n▶️ Test 2: Base de Datos y migración v4 (drive_folders)");
  const samplePath = "silvania/historial/2026/09";
  const sampleFolderId = "folder_1234567890abcdef";
  await dbService.saveDriveFolder(testUserId, samplePath, sampleFolderId);
  const fetchedFolderId = await dbService.getDriveFolder(testUserId, samplePath);

  if (fetchedFolderId === sampleFolderId) {
    console.log(`  ✅ saveDriveFolder y getDriveFolder funcionan correctamente (ID: ${fetchedFolderId}).`);
  } else {
    console.error(`  ❌ ERROR en getDriveFolder: esperado ${sampleFolderId}, obtenido ${fetchedFolderId}`);
    process.exit(1);
  }

  // 3. Validar integración de folderCacheService con DB
  console.log("\n▶️ Test 3: folderCacheService con persistencia DB");
  folderCacheService.clearCache();
  const cachedFromDb = await folderCacheService.getOrCreateFolderPath(testUserId, ["silvania", "historial", "2026", "09"]);
  if (cachedFromDb === sampleFolderId) {
    console.log(`  ✅ folderCacheService resuelve el ID desde la DB sin requerir llamadas de búsqueda.`);
  } else {
    console.error(`  ❌ ERROR: folderCacheService no recuperó el ID de DB.`);
    process.exit(1);
  }

  // 4. Validar deleteUserToken (marcar desvinculado)
  console.log("\n▶️ Test 4: deleteUserToken ante invalid_grant");
  await dbService.saveUserToken(testUserId, { refresh_token: "test_token_p0", email: "test@silvania.ai" });
  let tokenBefore = await dbService.getUserToken(testUserId);
  if (!tokenBefore || tokenBefore.refresh_token !== "test_token_p0") {
    console.error("  ❌ ERROR: No se pudo guardar token de prueba.");
    process.exit(1);
  }
  await dbService.deleteUserToken(testUserId);
  let tokenAfter = await dbService.getUserToken(testUserId);
  if (tokenAfter === null) {
    console.log("  ✅ deleteUserToken elimina el token y marca la cuenta desvinculada.");
  } else {
    console.error("  ❌ ERROR: deleteUserToken no eliminó el token.");
    process.exit(1);
  }

  // Limpieza de datos de prueba
  await dbService.clearDriveFolders(testUserId);

  console.log("\n=========================================");
  console.log("🎉 ¡TODOS LOS TESTS DE PLAN P0 PASARON CON ÉXITO!");
  console.log("=========================================\n");
}

runTests().catch(err => {
  console.error("❌ Fallo en ejecución de tests:", err);
  process.exit(1);
});
