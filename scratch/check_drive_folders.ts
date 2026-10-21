import { dbService } from "../src/database/db.js";

async function run() {
  const adminId = 1572946817;
  const silvaniaFolder = await dbService.getDriveFolder(adminId, "silvania");
  console.log(`Current 'silvania' folder for user ${adminId}:`, silvaniaFolder);

  if (silvaniaFolder === "1LhOczaiyDMb69NI1I4FDiTLSsTijaU2H") {
    console.log("⚠️ Found obsolete 404 folder ID in DB! Purging...");
    await dbService.deleteDriveFolder(adminId, "silvania");
    await dbService.deleteDriveFolderById(adminId, "1LhOczaiyDMb69NI1I4FDiTLSsTijaU2H");
    console.log("✅ Obsolete 404 folder ID purged from DB.");
  } else {
    console.log("ℹ️ silvania folder is either not set or has another ID.");
  }

  dbService.close();
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
