import { fileManager } from "../src/services/fileManager.js";
import { userContextStore } from "../src/services/context.js";

async function test() {
  const userId = 1572946817; // ID del administrador Jesús Quintero
  console.log("🧪 Iniciando test de diagnóstico de subida de archivos para usuario:", userId);

  await userContextStore.run({ userId }, async () => {
    try {
      console.log("1. Probando getOrCreateUploadFolder()...");
      const folderId = await fileManager.getOrCreateUploadFolder();
      console.log("✅ getOrCreateUploadFolder exitoso. ID Carpeta:", folderId);
    } catch (e: any) {
      console.error("❌ ERROR en getOrCreateUploadFolder:", e.message || e);
      if (e.stack) {
        console.error(e.stack);
      }
    }
  });
}

test().catch(console.error);
