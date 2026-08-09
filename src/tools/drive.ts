import { runGog, stripAnsi } from "./gogWrapper.js";
import { generateDriveLink, generateDriveSearchLink } from "../services/linkGenerator.js";
import { formatFolderLink, formatFileLink } from "../services/linkFormatter.js";
import { driveMemoryService } from "../services/driveMemory.js";
import fs from "fs";
import path from "path";

const SEP = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

function sanitizeMarkdown(text: string): string {
  if (!text) return "";
  return text.replace(/[*`\[\]()]/g, "");
}

function formatDriveList(raw: any, query?: string): string {
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

  let out = `📁 **CENTRO DE ARCHIVOS DRIVE** (${files.length} elementos)\n${SEP}\n\n`;
  for (const f of sorted) {
    if (!f || !f.id) continue;
    const isFolder = f.mimeType === "application/vnd.google-apps.folder";
    const isSheet  = f.mimeType === "application/vnd.google-apps.spreadsheet";
    const isDoc    = f.mimeType === "application/vnd.google-apps.document";
    const isPdf    = f.mimeType === "application/pdf";
    const isImage  = f.mimeType?.startsWith("image/");
    
    let icon = "📄";
    if (isFolder) icon = "📁";
    else if (isSheet) icon = "📊";
    else if (isDoc) icon = "📝";
    else if (isPdf) icon = "📕";
    else if (isImage) icon = "🖼️";

    const name = sanitizeMarkdown(f.name);
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
  
  if (raw.nextPageToken) {
    out += `${SEP}\n⚠️ *Nota: Hay más elementos. Prueba a listar una carpeta específica o usa un término de búsqueda.*`;
  }
    const queryLink = query 
      ? generateDriveSearchLink(query)
      : generateDriveLink("root", true);
    out += `${SEP}\n🔗 **Navegación Directa:** [Abrir búsqueda en Drive](${queryLink})`;
    return out;
}

export const driveList = async (parentId?: string, all = false, page = 0, userId?: number) => {
  const PAGE_SIZE = 40;
  
  let cmd: string;
  let resolvedFolderId = parentId;

  if (parentId && parentId !== "." && parentId !== "root") {
    // Si parentId es un nombre de carpeta (ej: "historial", "silvania", "2026") y no un ID crudo
    if (!/^[a-zA-Z0-9_-]{15,}$/.test(parentId)) {
      console.log(`🔍 [Drive Tool] Resolviendo ID jerárquicamente para la ruta de carpeta "${parentId}"...`);
      const parts = parentId.split("/").filter(p => p.trim().length > 0);
      let currentParentId = "root";
      
      for (const part of parts) {
        const searchRes = await runGog(
          `drive search "name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed = false" --raw-query --json`,
          userId
        );
        try {
          const searchParsed = JSON.parse(searchRes);
          const searchFiles = searchParsed.files || (Array.isArray(searchParsed) ? searchParsed : []);
          if (searchFiles.length > 0) {
            currentParentId = searchFiles[0].id;
          } else {
            // Fallback: búsqueda global si no existe en la ruta actual
            const fallbackRes = await runGog(
              `drive search "name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false" --raw-query --json`,
              userId
            );
            const fallbackParsed = JSON.parse(fallbackRes);
            const fallbackFiles = fallbackParsed.files || (Array.isArray(fallbackParsed) ? fallbackParsed : []);
            if (fallbackFiles.length > 0) {
              currentParentId = fallbackFiles[0].id;
            } else {
              return `📁 No se encontró ninguna carpeta llamada "${part}" en el camino de "${parentId}" en Google Drive.`;
            }
          }
        } catch (err: any) {
          console.error(`❌ Error buscando carpeta "${part}":`, err.message);
          return `❌ Error buscando carpeta "${part}": ${err.message}`;
        }
      }
      resolvedFolderId = currentParentId;
    }
    // Listar contenido de una carpeta específica por su ID resuelto
    cmd = `drive search "'${resolvedFolderId}' in parents and trashed = false" --raw-query --json --max=1000`;
  } else if (all) {
    // Listar TODO el Drive (sin filtro de carpeta)
    cmd = `drive search "trashed = false" --raw-query --json --max=1000`;
  } else {
    // Listar solo la raíz (comportamiento por defecto mejorado)
    cmd = `drive search "'root' in parents and trashed = false" --raw-query --json --max=1000`;
  }
  
  const result = await runGog(cmd, userId);
  try {
    const parsed = JSON.parse(result);
    const files: any[] = parsed.files || (Array.isArray(parsed) ? parsed : []);

    if (files.length === 0) {
      if (parentId) return `📁 Esta carpeta está vacía o no se encontraron archivos.`;
      return "📁 **Tu Google Drive está vacío o no hay coincidencias.**";
    }

    // Si hay muchos archivos, mostrar resumen paginado
    if (files.length > PAGE_SIZE) {
      const folders = files.filter(f => f.mimeType === "application/vnd.google-apps.folder");
      const docs = files.filter(f => f.mimeType !== "application/vnd.google-apps.folder");
      
      // Calcular bloque paginado
      const start = page * PAGE_SIZE;
      const end = Math.min(start + PAGE_SIZE, files.length);
      const pageFiles = files.slice(start, end);

      const sorted = [...pageFiles].sort((a, b) => {
        const isAFolder = a.mimeType === "application/vnd.google-apps.folder";
        const isBFolder = b.mimeType === "application/vnd.google-apps.folder";
        if (isAFolder && !isBFolder) return -1;
        if (!isAFolder && isBFolder) return 1;
        return (a.name || "").localeCompare(b.name || "");
      });

      let out = `📁 **GOOGLE DRIVE** — ${files.length} elementos totales`;
      out += `\n📂 Carpetas: ${folders.length}  |  📄 Archivos: ${docs.length}`;
      out += `\n${SEP}\n`;
      out += `📋 **Página ${page + 1} (Mostrando ${start + 1}–${end} de ${files.length}):**\n\n`;

      for (const f of sorted) {
        if (!f?.id) continue;
        const isFolder = f.mimeType === "application/vnd.google-apps.folder";
        const isSheet = f.mimeType === "application/vnd.google-apps.spreadsheet";
        const isDoc = f.mimeType === "application/vnd.google-apps.document";
        const isPdf = f.mimeType === "application/pdf";
        const isImage = f.mimeType?.startsWith("image/");
        let icon = "📄";
        if (isFolder) icon = "📁";
        else if (isSheet) icon = "📊";
        else if (isDoc) icon = "📝";
        else if (isPdf) icon = "📕";
        else if (isImage) icon = "🖼️";
        const link = generateDriveLink(f.id, isFolder);
        if (isFolder) {
          out += formatFolderLink(sanitizeMarkdown(f.name), link) + "\n\n";
        } else {
          out += formatFileLink(sanitizeMarkdown(f.name), link) + "\n\n";
        }
      }

      if (end < files.length) {
        out += `\n${SEP}\n💬 *Más elementos disponibles. Di **"página ${page + 2}"** o **"más"** para ver los siguientes.*`;
      }
      const driveLink = generateDriveLink(parentId || "root", true);
      out += `\n🔗 [Abrir en Drive](${driveLink})`;
      return out;
    }

    return formatDriveList(parsed, parentId ? `parent:'${parentId}'` : undefined);
  } catch {
    // Si el JSON parse falla, devolver el resultado crudo como string descriptivo
    return `📁 Resultado del Drive:\n\n${result}`;
  }
};


export const driveSearch = async (query: string, page = 0, parentId?: string, userId?: number) => {
  const PAGE_SIZE = 15;
  // Escapar comillas simples en la query
  const escapedQuery = query.replace(/'/g, "\\'");
  
  // Si la query no parece una query compleja de Drive, la tratamos como búsqueda por nombre
  let finalQuery = (query.includes("=") || query.includes("mimeType")) 
    ? query 
    : `name contains '${escapedQuery}' and trashed = false`;
    
  if (parentId) {
    finalQuery = `(${finalQuery}) and '${parentId}' in parents`;
  }
    
  const result = await runGog(`drive search "${finalQuery}" --raw-query --json --max=1000`, userId);
  try {
    const parsed = JSON.parse(result);
    const files: any[] = parsed.files || (Array.isArray(parsed) ? parsed : []);

    if (files.length > PAGE_SIZE) {
      const start = page * PAGE_SIZE;
      const end = Math.min(start + PAGE_SIZE, files.length);
      const pageFiles = files.slice(start, end);
      
      let out = `🔍 **RESULTADOS DE BÚSQUEDA** — ${files.length} encontrados\n${SEP}\n`;
      out += `📋 **Página ${page + 1} (Mostrando ${start + 1}–${end}):**\n\n`;

      for (const f of pageFiles) {
        if (!f?.id) continue;
        const isFolder = f.mimeType === "application/vnd.google-apps.folder";
        const link = generateDriveLink(f.id, isFolder);
        if (isFolder) {
          out += formatFolderLink(sanitizeMarkdown(f.name), link) + "\n\n";
        } else {
          out += formatFileLink(sanitizeMarkdown(f.name), link) + "\n\n";
        }
      }

      if (end < files.length) {
        const queryLink = generateDriveSearchLink(query);
        out += `\n${SEP}\n🔗 **Navegación Directa:** [Ver todos los resultados en Drive](${queryLink})`;
        out += `\n💬 *Más elementos disponibles. Di **"página ${page + 2}"** o **"más"** para ver los siguientes.*`;
      }
      return out;
    }

    return formatDriveList(parsed, query);
  } catch {
    return result;
  }
};

export async function resolveOrCreateParentId(parentId: string | undefined, userId: number): Promise<string> {
  if (!parentId || parentId === "." || parentId === "root") {
    return "root";
  }

  // Si parece un file/folder ID de Drive (alfanumérico largo sin barras "/") -> usarlo tal cual.
  const isDriveId = /^[a-zA-Z0-9_-]{15,}$/.test(parentId) && !parentId.includes("/");
  if (isDriveId) {
    return parentId;
  }

  // Si contiene "/" o es una ruta tipo silvania/skills/... -> resolver y crear la jerarquía con getOrCreateFolderPath.
  console.log(`📂 [Drive Tool] Detectada ruta de carpeta en parentId: "${parentId}". Resolviendo/Creando...`);
  const parts = parentId.split("/").filter(p => p.trim().length > 0);
  if (parts.length === 0) return "root";

  try {
    return await driveMemoryService.getOrCreateFolderPath(parts, userId);
  } catch (err: any) {
    console.error("❌ [Drive Tool] Error resolviendo ruta jerárquica:", err.message);
    return "root";
  }
}

export const driveMkdir = async (name: string, parentId?: string, userId?: number) => {
  const uId = userId || 0;
  const resolvedParentId = await resolveOrCreateParentId(parentId, uId);

  // Primero buscar si ya existe para evitar duplicados (petición del usuario)
  console.log(`🔍 Verificando si la carpeta "${name}" ya existe...`);
  const escapedName = name.replace(/'/g, "\\'");
  let searchQuery = `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (resolvedParentId && resolvedParentId !== "root") {
    searchQuery += ` and '${resolvedParentId}' in parents`;
  }
  
  try {
    const searchRes = await runGog(`drive search "${searchQuery}" --raw-query --json`, uId);
    const parsed = JSON.parse(searchRes);
    const files = parsed.files || (Array.isArray(parsed) ? parsed : []);
    
    if (files.length > 0) {
      const existing = files[0];
      console.log(`✅ Carpeta encontrada: ${existing.id}`);
      return `📁 La carpeta **"${name}"** ya existe (ID: \`${existing.id}\`).\n\nNo se ha creado una nueva para mantener tu Drive organized.`;
    }
  } catch (err) {
    console.warn("⚠️ Advertencia: No se pudo verificar si la carpeta ya existe. Procediendo con cautela.");
  }

  let cmd = `drive mkdir "${name}" --json`;
  if (resolvedParentId && resolvedParentId !== "." && resolvedParentId !== "root") {
    cmd += ` --parent=${resolvedParentId}`;
  }
  
  const result = await runGog(cmd, uId);
  try {
    const parsed = JSON.parse(result);
    const folder = parsed.folder || parsed;
    const link = generateDriveLink(folder.id, true);
    const linkStr = formatFolderLink(folder.name, link);
    return `✅ **Carpeta creada con éxito**\n\n${linkStr}\n> 🆔 \`${folder.id}\``;
  } catch {
    return result;
  }
};


export const driveMove = async (fileId: string, parentId: string, userId?: number) => {
  const uId = userId || 0;
  const resolvedParentId = await resolveOrCreateParentId(parentId, uId);
  const result = await runGog(`drive move ${fileId} --parent=${resolvedParentId}`, uId);
  const link = generateDriveLink(resolvedParentId, true);
  const linkStr = formatFolderLink("Carpeta Destino", link);
  return `✅ **Elemento movido correctamente**\n\n${linkStr}\n> 🆔 **Archivo:** \`${fileId}\`\n> 📂 **Nueva Carpeta:** \`${resolvedParentId}\`\n\n*Resultado:* ${result}`;
};

export const driveUpload = async (filePath: string, parentId?: string, name?: string, userId?: number) => {
  const uId = userId || 0;
  const resolvedParentId = await resolveOrCreateParentId(parentId, uId);

  let cmd = `drive upload "${filePath}" --json`;
  if (resolvedParentId && resolvedParentId !== "root") cmd += ` --parent=${resolvedParentId}`;
  if (name) cmd += ` --name="${name}"`;
  const result = await runGog(cmd, uId);
  try {
    const parsed = JSON.parse(result);
    const file = parsed.file || parsed;
    const isFolder = file.mimeType === "application/vnd.google-apps.folder";
    const link = generateDriveLink(file.id, isFolder);
    const linkStr = isFolder ? formatFolderLink(file.name, link) : formatFileLink(file.name, link);
    return `✅ **Archivo subido con éxito**\n\n${linkStr}\n> 🆔 \`${file.id}\``;
  } catch {
    return `✅ **Archivo subido**\n\n*Resultado:* ${result}`;
  }
};

export const driveRemove = async (fileId: string, userId?: number) => {
  const result = await runGog(`drive rm ${fileId}`, userId);
  return `🗑️ **Elemento eliminado**\n\n🆔 **ID:** \`${fileId}\`\n\n*Resultado:* ${result}`;
};

export const driveReadFile = async (fileId: string, userId?: number) => {
  const tempName = `download_${Date.now()}`;
  const tempPath = path.join(process.cwd(), "temp", tempName);
  
  if (!fs.existsSync(path.join(process.cwd(), "temp"))) {
    fs.mkdirSync(path.join(process.cwd(), "temp"), { recursive: true });
  }

  try {
    console.log(`📥 Intentando descargar/exportar archivo de Drive ${fileId}...`);
    
    const metaRaw = await runGog(`drive get ${fileId} --json`, userId);
    const meta = JSON.parse(metaRaw);
    const mimeType = meta.mimeType || meta.file?.mimeType || "";
    const name = meta.name || meta.file?.name || "archivo";
    
    let downloadPath = tempPath;
    let isGoogleDoc = mimeType.startsWith("application/vnd.google-apps.");
    let format = "";
    
    if (isGoogleDoc) {
      format = "txt";
      downloadPath = tempPath + ".txt";
      await runGog(`drive download ${fileId} --format=txt --out="${downloadPath}"`, userId);
    } else {
      downloadPath = tempPath + (name.includes(".") ? path.extname(name) : "");
      await runGog(`drive download ${fileId} --out="${downloadPath}"`, userId);
    }

    if (!fs.existsSync(downloadPath)) {
      throw new Error("No se pudo descargar el archivo.");
    }

    let content = "";
    const extension = path.extname(downloadPath).toLowerCase();
    
    if (extension === ".txt" || extension === ".csv" || extension === ".json" || extension === ".md") {
      content = fs.readFileSync(downloadPath, "utf-8");
    } else if (extension === ".pdf") {
      try {
        const pdfParseModule = (await import("pdf-parse")) as any;
        const dataBuffer = fs.readFileSync(downloadPath);
        const parser = new pdfParseModule.PDFParse({ data: dataBuffer });
        const textResult = await parser.getText();
        content = textResult.text || "El PDF no contiene texto extraíble.";
        await parser.destroy();
      } catch (pdfErr: any) {
        console.error("Error parseando PDF con pdf-parse:", pdfErr.message);
        content = `⚠️ El archivo es un PDF. Hubo un error al leerlo: ${pdfErr.message}`;
      }
    } else {
      content = `⚠️ El archivo tiene formato '${mimeType || extension}' y no es texto plano. No se puede leer el contenido directamente.`;
    }

    try { if (fs.existsSync(downloadPath)) fs.unlinkSync(downloadPath); } catch {}
    
    return `📄 **Contenido de "${name}" (ID: ${fileId}):**\n\n${content.substring(0, 8000)}${content.length > 8000 ? "\n\n... (truncado por longitud)" : ""}`;
  } catch (e: any) {
    try {
      const files = fs.readdirSync(path.join(process.cwd(), "temp"));
      for (const file of files) {
        if (file.startsWith(tempName)) {
          fs.unlinkSync(path.join(process.cwd(), "temp", file));
        }
      }
    } catch {}
    return `❌ Error al leer el archivo de Drive: ${e.message}`;
  }
};

