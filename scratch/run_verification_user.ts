import { driveList, driveMkdir, driveUpload } from "../src/tools/drive.js";
import { runGog } from "../src/tools/gogWrapper.js";
import { userContextStore } from "../src/services/context.js";
import fs from "fs";
import path from "path";

async function run() {
  const userId = 1572946817; // Usuario principal Jesús
  console.log("=== INICIANDO PRUEBA COMPLETA DE --account ===");

  await userContextStore.run({ userId }, async () => {
    try {
      // 1. Encontrar la carpeta 'silvania'
      console.log("\n--- PASO 1: Buscando la carpeta 'silvania' ---");
      const searchSilvania = await runGog("drive search \"name = 'silvania' and mimeType = 'application/vnd.google-apps.folder' and trashed = false\" --raw-query --json", userId);
      const parsedSearch = JSON.parse(searchSilvania);
      const files = parsedSearch.files || (Array.isArray(parsedSearch) ? parsedSearch : []);
      
      if (files.length === 0) {
        console.error("❌ No se encontró la carpeta 'silvania'.");
        return;
      }
      
      const silvaniaFolderId = files[0].id;
      console.log(`ID de Carpeta 'silvania': ${silvaniaFolderId}`);

      // 2. Listar la carpeta 'silvania'
      console.log("\n--- PASO 2: Listando contenido de 'silvania' ---");
      const listRes = await driveList(silvaniaFolderId);
      console.log(listRes);

      // 3. Crear una carpeta llamada 'Test_Fix_Account' dentro de 'silvania'
      console.log("\n--- PASO 3: Creando carpeta 'Test_Fix_Account' ---");
      const mkdirRes = await driveMkdir("Test_Fix_Account", silvaniaFolderId);
      console.log(mkdirRes);

      // Buscar el ID de la carpeta recién creada (o si ya existía)
      const searchTestFolder = await runGog(`drive search "name = 'Test_Fix_Account' and mimeType = 'application/vnd.google-apps.folder' and '${silvaniaFolderId}' in parents and trashed = false" --raw-query --json`, userId);
      const parsedTestFolder = JSON.parse(searchTestFolder);
      const testFolderFiles = parsedTestFolder.files || [];
      
      if (testFolderFiles.length === 0) {
        console.error("❌ No se encontró la carpeta 'Test_Fix_Account' tras la creación.");
        return;
      }
      const testFolderId = testFolderFiles[0].id;
      console.log(`ID de Carpeta 'Test_Fix_Account': ${testFolderId}`);

      // 4. Subir un archivo de texto pequeño de prueba dentro de 'Test_Fix_Account'
      console.log("\n--- PASO 4: Subiendo archivo de texto de prueba ---");
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const testFilePath = path.join(tempDir, "test_verification.txt");
      fs.writeFileSync(testFilePath, "Este es un archivo de verificación para probar el fix de --account. Con amor, Silvania CoreAgent.", "utf8");
      
      const uploadRes = await driveUpload(testFilePath, testFolderId, "verificacion_fix.txt");
      console.log(uploadRes);

      // Limpiar archivo temporal
      try {
        if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
      } catch {}

      console.log("\n=== PRUEBA FINALIZADA CON ÉXITO ===");
    } catch (e: any) {
      console.error("❌ Ocurrió un error en la verificación:", e.stack || e.message);
    }
  });
}

run();
