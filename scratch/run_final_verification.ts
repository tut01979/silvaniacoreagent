import { gmailSearch } from "../src/tools/gmail.js";
import { runGog } from "../src/tools/gogWrapper.js";
import { driveList, driveMkdir } from "../src/tools/drive.js";
import { userContextStore } from "../src/services/context.js";

async function main() {
  const userId = 1572946817; // Usuario principal Jesús
  console.log("=== INICIANDO VERIFICACIÓN FINAL EN VIVO ===");

  await userContextStore.run({ userId }, async () => {
    try {
      // 1. Buscar la carpeta 'silvania' en Drive
      console.log("\n--- PASO 1: Buscando la carpeta 'silvania' ---");
      const searchSilvania = await runGog("drive search \"name = 'silvania' and mimeType = 'application/vnd.google-apps.folder' and trashed = false\" --raw-query --json", userId);
      const parsedSearch = JSON.parse(searchSilvania);
      const files = parsedSearch.files || [];
      
      if (files.length === 0) {
        console.error("❌ No se encontró la carpeta 'silvania'.");
        return;
      }
      
      const silvaniaFolderId = files[0].id;
      console.log(`ID de Carpeta 'silvania': ${silvaniaFolderId}`);

      // 2. Listar la carpeta 'silvania' (contenido completo)
      console.log("\n--- PASO 2: Listando contenido de 'silvania' ---");
      const listRes = await driveList(silvaniaFolderId, false, 0, userId);
      console.log(listRes);

      // 3. Crear carpeta llamada 'Test_Verificacion_Final' dentro de 'silvania'
      console.log("\n--- PASO 3: Creando carpeta 'Test_Verificacion_Final' ---");
      const mkdirRes = await driveMkdir("Test_Verificacion_Final", silvaniaFolderId, userId);
      console.log(mkdirRes);

      // 4. Listar correos de hoy usando lenguaje natural
      console.log("\n--- PASO 4: Buscando 'muéstrame los correos de hoy' ---");
      const emailsToday = await gmailSearch(userId, "muéstrame los correos de hoy");
      console.log("Resultado de Gmail:\n", emailsToday);

      console.log("\n=== VERIFICACIÓN FINALIZADA CON ÉXITO ===");
    } catch (err: any) {
      console.error("❌ Error durante la verificación final:", err.stack || err.message);
    }
  });
}

main();
