import { folderCacheService } from "../src/services/folderCache.js";
import { dbService } from "../src/database/db.js";

async function testSheetsLogic() {
  console.log("=== TEST LOGICA DE SHEETS EN SILVANIA/ ===");
  const testUserId = 777888;
  const canonicalFolderId = "folder_silvania_canonical_123";

  // 1. Guardar carpeta silvania canónica en DB
  await dbService.saveDriveFolder(testUserId, "silvania", canonicalFolderId);

  // 2. Probar que folderCacheService.getOrCreateFolderPath(userId, "silvania") recupera el ID directamente
  const resolvedFolderId = await folderCacheService.getOrCreateFolderPath(testUserId, "silvania");
  console.log(`1. Carpeta resuelta: ${resolvedFolderId} (coincide: ${resolvedFolderId === canonicalFolderId})`);
  if (resolvedFolderId !== canonicalFolderId) {
    throw new Error("No resolvió la carpeta canónica silvania/");
  }

  // 3. Probar que folderCacheService también funciona si se le pasa array
  const resolvedWithArray = await folderCacheService.getOrCreateFolderPath(testUserId, ["silvania"]);
  console.log(`2. Carpeta resuelta con array: ${resolvedWithArray} (coincide: ${resolvedWithArray === canonicalFolderId})`);
  if (resolvedWithArray !== canonicalFolderId) {
    throw new Error("No resolvió con array");
  }

  // 4. Limpiar datos de prueba
  await dbService.clearDriveFolders(testUserId);
  console.log("3. Limpieza completada.");
  console.log("✅ Todas las comprobaciones de folderCacheService para Sheets pasaron con éxito.");
}

testSheetsLogic().catch(err => {
  console.error("❌ Error en test:", err);
  process.exit(1);
});
