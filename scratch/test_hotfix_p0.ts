import { isNotFoundError, folderCacheService } from "../src/services/folderCache.js";
import { dbService } from "../src/database/db.js";

async function testRecovery() {
  console.log("=== TEST 1: isNotFoundError ===");
  const err404A = new Error("Google 404 notFound");
  const err404B = new Error("File not found: 1LhOczaiyDMb69NI1I4FDiTLSsTijaU2H");
  const errOther = new Error("Network timeout");

  if (!isNotFoundError(err404A) || !isNotFoundError(err404B)) {
    throw new Error("❌ isNotFoundError failed to detect 404 errors!");
  }
  if (isNotFoundError(errOther)) {
    throw new Error("❌ isNotFoundError falsely flagged network error as 404!");
  }
  console.log("✅ isNotFoundError passed.");

  console.log("\n=== TEST 2: Invalidation in DB and Cache ===");
  const testUserId = 999999999;
  const dummyFolderId = "1LhOczaiyDMb69NI1I4FDiTLSsTijaU2H";

  // Simular guardado previo de folderId obsoleto en DB
  await dbService.saveDriveFolder(testUserId, "silvania", dummyFolderId);
  let saved = await dbService.getDriveFolder(testUserId, "silvania");
  if (saved !== dummyFolderId) throw new Error("Failed to save dummy folder in DB");

  // Invalidar por path
  await folderCacheService.invalidatePath(testUserId, "silvania");
  saved = await dbService.getDriveFolder(testUserId, "silvania");
  if (saved !== null) throw new Error("❌ invalidatePath failed to purge from DB!");
  console.log("✅ InvalidatePath successfully purged from DB.");

  // Simular guardado y luego invalidar por folderId
  await dbService.saveDriveFolder(testUserId, "silvania/historial", dummyFolderId);
  await folderCacheService.invalidateFolderId(testUserId, dummyFolderId);
  saved = await dbService.getDriveFolder(testUserId, "silvania/historial");
  if (saved !== null) throw new Error("❌ invalidateFolderId failed to purge from DB!");
  console.log("✅ InvalidateFolderId successfully purged from DB.");

  // Limpiar
  await dbService.clearDriveFolders(testUserId);

  console.log("\n=== TEST 3: Telegram /eva Response ===");
  const { runAgent } = await import("../src/agent/agent.js");
  const response = await runAgent(testUserId, "/eva");
  console.log("Response to /eva:\n", response);

  if (response.includes("Soy Eva") || response.includes("Granja") || response.includes("fonema")) {
    throw new Error("❌ Response contains Eva roleplay/farm character!");
  }
  if (!response.includes("0 scopes") && !response.includes("cero scopes")) {
    throw new Error("❌ Response missing 0 scopes notice!");
  }
  if (!response.includes("https://silvania.ai/eva")) {
    throw new Error("❌ Response missing https://silvania.ai/eva!");
  }
  if (!response.includes("https://silvania.ai/eva-landing")) {
    throw new Error("❌ Response missing https://silvania.ai/eva-landing!");
  }
  console.log("✅ Telegram /eva response passed perfectly.");

  dbService.close();

  console.log("\n🎉 ALL HOTFIX P0 TESTS PASSED!");
}

testRecovery().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
