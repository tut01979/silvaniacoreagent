import { isZombieFolder, folderCacheService, isNotFoundError, registerZombieFolder } from "../src/services/folderCache.js";
import { dbService } from "../src/database/db.js";

async function runTest() {
  console.log("=== TEST 1: Zombie folder blacklist ===");
  const zombieId = "1LhOczaiyDMb69NI1I4FDiTLSsTijaU2H";
  if (!isZombieFolder(zombieId)) {
    throw new Error("❌ 1LhOczaiyDMb69NI1I4FDiTLSsTijaU2H is NOT in zombie blacklist!");
  }
  console.log("✅ Zombie blacklist correctly blocks 1LhOczaiyDMb69NI1I4FDiTLSsTijaU2H.");

  console.log("\n=== TEST 2: Dynamic registration of zombie folder ===");
  const dynamicZombie = "zombie_dummy_folder_999";
  registerZombieFolder(dynamicZombie);
  if (!isZombieFolder(dynamicZombie)) {
    throw new Error("❌ Dynamic zombie registration failed!");
  }
  console.log("✅ Dynamic zombie registered and blocked.");

  console.log("\n=== TEST 3: DB and Cache cleanup on zombie detection ===");
  const testUserId = 777777;
  await dbService.saveDriveFolder(testUserId, "silvania", zombieId);
  await dbService.saveDriveFolder(testUserId, "silvania/historial", zombieId);
  
  // Invalidar por ID zombi
  await folderCacheService.invalidateFolderId(testUserId, zombieId);
  const afterSilvania = await dbService.getDriveFolder(testUserId, "silvania");
  const afterHistorial = await dbService.getDriveFolder(testUserId, "silvania/historial");
  
  if (afterSilvania !== null || afterHistorial !== null) {
    throw new Error("❌ Zombie ID was not purged from DB!");
  }
  console.log("✅ Zombie ID successfully purged from all user paths in DB.");

  console.log("\n=== TEST 4: deleteDriveFoldersStartingWith ===");
  await dbService.saveDriveFolder(testUserId, "silvania", "some_valid_id");
  await dbService.saveDriveFolder(testUserId, "silvania/skills", "skills_id");
  await dbService.saveDriveFolder(testUserId, "silvania/temas", "temas_id");
  await dbService.saveDriveFolder(testUserId, "otro_path", "otro_id");

  await dbService.deleteDriveFoldersStartingWith(testUserId, "silvania");
  const checkSilvania = await dbService.getDriveFolder(testUserId, "silvania");
  const checkSkills = await dbService.getDriveFolder(testUserId, "silvania/skills");
  const checkTemas = await dbService.getDriveFolder(testUserId, "silvania/temas");
  const checkOtro = await dbService.getDriveFolder(testUserId, "otro_path");

  if (checkSilvania !== null || checkSkills !== null || checkTemas !== null) {
    throw new Error("❌ deleteDriveFoldersStartingWith failed to clear silvania subpaths!");
  }
  if (checkOtro !== "otro_id") {
    throw new Error("❌ deleteDriveFoldersStartingWith accidentally deleted unrelated path!");
  }
  console.log("✅ deleteDriveFoldersStartingWith correctly purged silvania tree while preserving unrelated paths.");

  // Limpiar
  await dbService.clearDriveFolders(testUserId);
  dbService.close();

  console.log("\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!");
}

runTest().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
