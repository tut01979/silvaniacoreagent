import { gmailList, gmailSearch } from "../src/tools/gmail.js";
import { ensureAccountParam, runGog } from "../src/tools/gogWrapper.js";
import { driveList, driveMkdir } from "../src/tools/drive.js";
import { driveMemoryService } from "../src/services/driveMemory.js";
import { userContextStore } from "../src/services/context.js";

async function main() {
  const userId = 1572946817; // Usuario principal Jesús
  console.log("=== INICIANDO VERIFICACIÓN DE FIXES ===");

  // Ejecutar en el contexto del usuario para poblar el AsyncLocalStorage
  await userContextStore.run({ userId }, async () => {
    try {
      // 1. Probar ensureAccountParam helper
      console.log("\n1. Probando helper ensureAccountParam:");
      const check1 = await ensureAccountParam("drive ls", userId);
      console.log("Comando resultante:", check1.command);
      console.log("Email resuelto:", check1.email);

      const check2 = await ensureAccountParam("drive ls --account=foo@bar.com", userId);
      console.log("Comando resultante (sobrescrito):", check2.command);
      console.log("Email resuelto (sobrescrito):", check2.email);

      // 2. Probar listado de correos de hoy
      console.log("\n2. Probando listado de correos de hoy:");
      const emailsToday = await gmailSearch(userId, "hoy", 10);
      console.log("Resultado de gmailSearch('hoy'):\n", emailsToday);

      // 3. Probar listado de carpeta 'silvania'
      console.log("\n3. Buscando la carpeta 'silvania' en Drive:");
      const searchSilvania = await runGog("drive search \"name = 'silvania' and mimeType = 'application/vnd.google-apps.folder' and trashed = false\" --raw-query --json", userId);
      console.log("Resultado búsqueda carpeta silvania:", searchSilvania);
      const parsedSearch = JSON.parse(searchSilvania);
      const files = parsedSearch.files || (Array.isArray(parsedSearch) ? parsedSearch : []);
      
      if (files.length > 0) {
        const silvaniaFolderId = files[0].id;
        console.log(`ID de Carpeta Silvania: ${silvaniaFolderId}`);

        console.log("\n4. Listando el contenido de la carpeta 'silvania':");
        const listSilvania = await driveList(silvaniaFolderId);
        console.log("Resultado listado silvania:\n", listSilvania);

        console.log("\n5. Creando una carpeta de prueba dentro de 'silvania':");
        const mkdirTestName = `Carpeta_Prueba_${Date.now()}`;
        const mkdirRes = await driveMkdir(mkdirTestName, silvaniaFolderId);
        console.log("Resultado driveMkdir:\n", mkdirRes);
      } else {
        console.log("No se encontró la carpeta 'silvania' en Drive, listando la raíz...");
        const listRoot = await driveList();
        console.log("Resultado raíz:\n", listRoot);
      }

    } catch (err: any) {
      console.error("❌ Error durante la verificación:", err.stack || err.message);
    }
  });
}

main();
