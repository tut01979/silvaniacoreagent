import { runGog } from "../src/tools/gogWrapper.js";
import { userContextStore } from "../src/services/context.js";

// Mock de la función formatDriveList simplificada de drive.ts
function formatDriveList(raw: any): string {
  const files: any[] = raw.files || (Array.isArray(raw) ? raw : []);
  if (!files || files.length === 0) return "📁 **Tu Google Drive está vacío o no hay coincidencias.**";

  // Ordenar por carpetas primero, luego por nombre
  const sorted = [...files].sort((a, b) => {
    const isAFolder = a.mimeType === "application/vnd.google-apps.folder";
    const isBFolder = b.mimeType === "application/vnd.google-apps.folder";
    if (isAFolder && !isBFolder) return -1;
    if (!isAFolder && isBFolder) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  const SEP = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
  let out = `📁 **CENTRO DE ARCHIVOS DRIVE** (${files.length} elementos)\n${SEP}\n\n`;
  for (const f of sorted) {
    if (!f || !f.id) continue;
    const isFolder = f.mimeType === "application/vnd.google-apps.folder";
    const name = f.name || "Sin nombre";
    const dateStr = f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString("es-ES") : "";
    
    if (isFolder) {
      out += `📁 ${name}\n`;
      out += `https://drive.google.com/drive/folders/${f.id}\n`;
    } else {
      out += `📄 ${name}\n`;
      out += `https://drive.google.com/file/d/${f.id}/view\n`;
    }
    if (dateStr) {
      out += `📅 ${dateStr}\n\n`;
    } else {
      out += `\n`;
    }
  }
  return out;
}

async function main() {
  const userId = 1572946817; // Jesús
  console.log("=== OBTENIENDO EJEMPLO REAL DE FORMATDRIVELIST ===");

  await userContextStore.run({ userId }, async () => {
    try {
      // Buscar archivos en Drive usando gog
      console.log("Ejecutando drive search...");
      const result = await runGog("drive search --raw-query \"'root' in parents and trashed = false\" --json --max=3", userId);
      const parsed = JSON.parse(result);
      
      const formatted = formatDriveList(parsed);
      console.log("\n--- RESULTADO DE LA HERRAMIENTA ---");
      console.log(formatted);
      console.log("----------------------------------");
    } catch (err: any) {
      console.error("❌ Error en la prueba:", err.message);
    }
  });
}

main();
