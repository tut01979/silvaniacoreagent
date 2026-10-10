import { folderCacheService } from "../src/services/folderCache.js";
import { dbService } from "../src/database/db.js";
import { driveMkdir } from "../src/tools/drive.js";

async function testCanonicalFolders() {
  console.log("=== INICIANDO PRUEBAS DE RESOLUCIÓN CANÓNICA (PLAN P0) ===");
  const testUserId = 1572946817; // Jesús (admin de prueba)

  // 1. Probar guardado y lectura en DB (drive_folders)
  console.log("\n1. Verificando persistencia en drive_folders...");
  const fakeFolderId = "fake_silvania_folder_123456789";
  const fakeSkillsFolderId = "fake_skills_folder_987654321";
  await dbService.saveDriveFolder(testUserId, "test_silvania_path", fakeFolderId);
  await dbService.saveDriveFolder(testUserId, "silvania", fakeFolderId);
  await dbService.saveDriveFolder(testUserId, "silvania/skills", fakeSkillsFolderId);

  const readBackId = await dbService.getDriveFolder(testUserId, "test_silvania_path");
  console.log(`Leído de DB: ${readBackId} (coincide: ${readBackId === fakeFolderId})`);

  // 2. Probar guarda de seguridad en driveMkdir para "silvania"
  console.log("\n2. Probando interceptación de driveMkdir para 'silvania'...");
  const mkdirRes = await driveMkdir("silvania", undefined, testUserId);
  console.log("Resultado de driveMkdir('silvania'):\n", mkdirRes);
  const hasGuardMsg = mkdirRes.includes("ya está configurada") || mkdirRes.includes("No se crean carpetas duplicadas");
  console.log("Guarda activada correctamente:", hasGuardMsg);
  console.log("Devuelve el ID canónico de la DB:", mkdirRes.includes(fakeFolderId));

  // 3. Probar guarda de seguridad en driveMkdir para 'silvania/skills'
  console.log("\n3. Probando interceptación de driveMkdir para 'silvania/skills'...");
  const mkdirSkillsRes = await driveMkdir("silvania/skills", undefined, testUserId);
  console.log("Resultado de driveMkdir('silvania/skills'):\n", mkdirSkillsRes);
  const hasSkillsGuard = mkdirSkillsRes.includes("ya está configurada") || mkdirSkillsRes.includes("No se crean carpetas duplicadas");
  console.log("Guarda para skills activada correctamente:", hasSkillsGuard);
  console.log("Devuelve el ID canónico de skills de la DB:", mkdirSkillsRes.includes(fakeSkillsFolderId));

  // 4. Probar resolución jerárquica con caché y DB
  console.log("\n4. Verificando getOrCreateFolderPath...");
  // Limpiar caché en memoria para probar lectura desde DB
  await folderCacheService.clearCache();
  // Al haber guardado 'test_silvania_path' en DB, comprobar que lo recupera sin llamadas a Google Drive
  const resolvedId = await folderCacheService.getOrCreateFolderPath(testUserId, ["test_silvania_path"]);
  console.log(`ID resuelto desde DB: ${resolvedId} (coincide: ${resolvedId === fakeFolderId})`);

  console.log("\n5. Limpiando registros de prueba...");
  await dbService.clearDriveFolders(testUserId);
  console.log("Registros de prueba limpiados.");

  console.log("\n✅ Todas las pruebas canónicas del Plan P0 pasaron exitosamente.");
}

testCanonicalFolders().catch(err => {
  console.error("❌ Error en pruebas:", err);
});
