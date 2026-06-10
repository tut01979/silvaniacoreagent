import { dbService } from "./src/database/db.js";

async function runMigration() {
  try {
    await dbService.migrateToCloud();
    process.exit(0);
  } catch (error) {
    console.error("Error en la migración:", error);
    process.exit(1);
  }
}

runMigration();
