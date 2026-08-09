import { resolveOrCreateParentId } from "../src/tools/drive.js";
import { runGog } from "../src/tools/gogWrapper.js";

async function runTests() {
  console.log("=== INICIANDO PRUEBAS DE CREACIÓN AUTOMÁTICA DE JERARQUÍA ===");
  const userId = 999999;
  
  // 1. Probar que un ID real de Drive se usa tal cual
  console.log("\n1. Probando ID de Drive directo (sin barras)...");
  const driveIdSimulated = "1owG1DBkgAxYth3WZGgAbpMH1Eis97vGu";
  const resId = await resolveOrCreateParentId(driveIdSimulated, userId);
  console.log(`-> ID devuelto: ${resId}`);
  const isIntact = resId === driveIdSimulated;
  console.log(`-> Se mantuvo intacto: ${isIntact ? "✅ PASÓ" : "❌ FALLÓ"}`);

  // 2. Probar que una ruta jerárquica inexistente como silvania/skills/test-auto-mkdir/resultados se crea automáticamente
  console.log("\n2. Probando ruta jerárquica con subcarpeta 'resultados'...");
  const hierarchicalPath = "silvania/skills/test-auto-mkdir/resultados";
  
  try {
    const resolvedId = await resolveOrCreateParentId(hierarchicalPath, userId);
    console.log(`-> Ruta jerárquica resuelta a ID de Drive: ${resolvedId}`);
    const isValidId = /^[a-zA-Z0-9_-]{15,}$/.test(resolvedId);
    console.log(`-> ID devuelto es válido: ${isValidId ? "✅ PASÓ" : "❌ FALLÓ"}`);
    
    // Buscar la carpeta creada en Drive para verificar su existencia real
    if (isValidId) {
      console.log("\n3. Limpiando carpeta de pruebas en Drive...");
      const parentSearch = await runGog(
        `drive search "name = 'test-auto-mkdir' and mimeType = 'application/vnd.google-apps.folder' and trashed = false" --raw-query --json`,
        userId
      );
      const parentParsed = JSON.parse(parentSearch);
      const parentFiles = parentParsed.files || [];
      if (parentFiles.length > 0) {
        const pId = parentFiles[0].id;
        await runGog(`drive rm ${pId}`, userId);
        console.log(`-> Carpeta de prueba '${parentFiles[0].name}' eliminada con éxito.`);
      }
    }
  } catch (err: any) {
    console.error("❌ Falló el test de ruta jerárquica:", err.message);
  }

  console.log("\n=== PRUEBAS CONCLUIDAS ===");
}

runTests();
