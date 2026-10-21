import Database from "better-sqlite3";
import { config } from "../src/config/config.js";

async function run() {
  const db = new Database(config.db.path);
  const allFolders = db.prepare("SELECT * FROM drive_folders").all();
  console.log("All drive_folders in DB:", JSON.stringify(allFolders, null, 2));

  const badRows = allFolders.filter((r: any) => r.folderId === "1LhOczaiyDMb69NI1I4FDiTLSsTijaU2H");
  if (badRows.length > 0) {
    console.log(`Found ${badRows.length} rows with bad folderId! Purging...`);
    db.prepare("DELETE FROM drive_folders WHERE folderId = '1LhOczaiyDMb69NI1I4FDiTLSsTijaU2H'").run();
    console.log("Purged.");
  }

  db.close();
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
