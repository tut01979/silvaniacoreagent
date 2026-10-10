import { driveMemoryService } from "../src/services/driveMemory.js";

async function main() {
  const userId = 1572946817;
  console.log("Starting syncFromDrive...");
  await driveMemoryService.syncFromDrive(userId);
  console.log("syncFromDrive complete.");
}

main();
