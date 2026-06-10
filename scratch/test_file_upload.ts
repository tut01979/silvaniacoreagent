import { fileManager } from "../src/services/fileManager.js";
import { runGog } from "../src/tools/gogWrapper.js";
import fs from "fs";
import path from "path";

async function test() {
  console.log("📂 Test de Subida de Archivos a Drive...");
  
  // 1. Obtener/crear carpeta
  try {
    const folderId = await fileManager.getOrCreateUploadFolder();
    console.log("✅ Carpeta de destino obtenida:", folderId);

    // 2. Crear una imagen temporal
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFilePath = path.join(tempDir, "test_upload_image.png");
    const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    fs.writeFileSync(tempFilePath, Buffer.from(base64Data, "base64"));
    console.log("📄 Archivo temporal creado en:", tempFilePath);

    // 3. Probar subida directa con runGog
    console.log("📤 Subiendo archivo de prueba mediante runGog...");
    const cmd = `drive upload "${tempFilePath}" --name="test_upload_image.png" --parent="${folderId}" --json`;
    const result = await runGog(cmd);
    console.log("✅ Resultado de gog drive upload:", result);

    // 4. Limpiar
    try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch {}
  } catch (err) {
    console.error("❌ Error en el flujo de prueba:", err);
  }
}

test().catch(err => {
  console.error("Fatal:", err);
});
