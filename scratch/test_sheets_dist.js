import { folderCacheService } from "../dist/services/folderCache.js";
import { dbService } from "../dist/database/db.js";

async function main() {
  const testUserId = 777888;
  const canonicalFolderId = "folder_silvania_canonical_123";

  // 1. Guardar en DB
  await dbService.saveDriveFolder(testUserId, "silvania", canonicalFolderId);

  // 2. folderCacheService con string "silvania"
  const resolvedStr = await folderCacheService.getOrCreateFolderPath(testUserId, "silvania");
  console.log("Resolved with string:", resolvedStr, resolvedStr === canonicalFolderId ? "✅ OK" : "❌ FAIL");

  // 3. folderCacheService con array ["silvania"]
  const resolvedArr = await folderCacheService.getOrCreateFolderPath(testUserId, ["silvania"]);
  console.log("Resolved with array:", resolvedArr, resolvedArr === canonicalFolderId ? "✅ OK" : "❌ FAIL");

  // 4. Limpiar
  await dbService.clearDriveFolders(testUserId);
  console.log("Test passed!");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
