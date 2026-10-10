import { sheetsCreate } from "../src/tools/sheets.js";
import { runGog } from "../src/tools/gogWrapper.js";
import { dbService } from "../src/database/db.js";

async function main() {
  const userId = 1572946817;
  console.log("▶️ Ejecutando sheetsCreate('Test Org')...");
  const res = await sheetsCreate("Test Org", userId);
  console.log("Respuesta de sheetsCreate:\n", res);

  const idMatch = res.match(/(?:spreadsheetId|ID):\s*([A-Za-z0-9_-]{20,80})/i);
  if (!idMatch) {
    console.error("❌ No se pudo extraer el spreadsheetId");
    process.exit(1);
  }
  const fileId = idMatch[1];
  console.log(`✅ ID de hoja obtenido: ${fileId}`);

  // Verificar la carpeta de silvania en DB
  const silvaniaFolderId = await dbService.getDriveFolder(userId, "silvania");
  console.log(`📁 ID de silvania en DB: ${silvaniaFolderId}`);

  // Consultar en Drive los parents del archivo
  try {
    const driveInfoRaw = await runGog(`drive get ${fileId} --json`, userId);
    console.log("Drive get output:", driveInfoRaw);
    const driveInfo = JSON.parse(driveInfoRaw);
    const parents = driveInfo.parents || driveInfo.file?.parents || [];
    console.log("Parents del archivo en Drive:", parents);
    if (silvaniaFolderId && parents.includes(silvaniaFolderId)) {
      console.log("🎉 ÉXITO: El archivo está dentro de la carpeta silvania/ en Google Drive!");
    } else {
      console.log(`ℹ️ Parents encontrados: ${JSON.stringify(parents)}, silvaniaFolderId: ${silvaniaFolderId}`);
    }
  } catch (err: any) {
    console.error("Error consultando metadata del archivo:", err.message);
  }
}

main().catch(console.error);
