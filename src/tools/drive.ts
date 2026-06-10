import { runGog, stripAnsi } from "./gogWrapper.js";
import fs from "fs";
import path from "path";

const SEP = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

function sanitizeMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/_/g, "-")
    .replace(/[*`\[\]()]/g, "");
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

    const link = f.webViewLink || (isFolder ? `https://drive.google.com/drive/folders/${f.id}` : `https://drive.google.com/file/d/${f.id}/view`);
    const date = f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString("es-ES") : "";
    const size = f.size ? ` (${(parseInt(f.size) / (1024 * 1024)).toFixed(2)} MB)` : "";
    
    out += `${icon} **${sanitizeMarkdown(f.name)}**\n`;
    out += `> 🆔 \`${f.id}\`${date ? `  |  📅 ${date}` : ""}${size}\n`;
    out += `> 🔗 [Abrir en Drive](${link})\n\n`;
  }
  
  if (raw.nextPageToken) {
    out += `${SEP}\n⚠️ *Nota: Hay más elementos. Prueba a listar una carpeta específica o usa un término de búsqueda.*`;
  }
    const queryLink = query 
      ? `https://drive.google.com/drive/u/0/search?q=${encodeURIComponent(query)}`
      : `https://drive.google.com/drive/u/0/my-drive`;
    out += `${SEP}\n🔗 **Navegación Directa:** [Abrir búsqueda en Drive](${queryLink})`;
    return out;
}

export const driveList = async (parentId?: string, all = false, page = 0) => {
  const PAGE_SIZE = 40;
  
  let cmd: string;
  if (parentId && parentId !== "." && parentId !== "root") {
    // Listar contenido de una carpeta específica
    cmd = `drive search "'${parentId}' in parents and trashed = false" --raw-query --json --max=1000`;
  } else if (all) {
    // Listar TODO el Drive (sin filtro de carpeta)
    cmd = `drive search "trashed = false" --raw-query --json --max=1000`;
  } else {
    // Listar solo la raíz (comportamiento por defecto mejorado)
    cmd = `drive search "'root' in parents and trashed = false" --raw-query --json --max=1000`;
  }
  
  const result = await runGog(cmd);
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
        const link = isFolder
          ? `https://drive.google.com/drive/folders/${f.id}`
          : `https://drive.google.com/file/d/${f.id}/view`;
        out += `${icon} **${sanitizeMarkdown(f.name)}** — \`${f.id}\` — [Abrir](${link})\n`;
      }

      if (end < files.length) {
        out += `\n${SEP}\n💬 *Más elementos disponibles. Di **"página ${page + 2}"** o **"más"** para ver los siguientes.*`;
      }
      const driveLink = parentId
        ? `https://drive.google.com/drive/folders/${parentId}`
        : `https://drive.google.com/drive/my-drive`;
      out += `\n🔗 [Abrir en Drive](${driveLink})`;
      return out;
    }

    return formatDriveList(parsed, parentId ? `parent:'${parentId}'` : undefined);
  } catch {
    // Si el JSON parse falla, devolver el resultado crudo como string descriptivo
    return `📁 Resultado del Drive:\n\n${result}`;
  }
};


export const driveSearch = async (query: string, page = 0) => {
  const PAGE_SIZE = 15;
  // Escapar comillas simples en la query
  const escapedQuery = query.replace(/'/g, "\\'");
  
  // Si la query no parece una query compleja de Drive, la tratamos como búsqueda por nombre
  const finalQuery = (query.includes("=") || query.includes("mimeType")) 
    ? query 
    : `name contains '${escapedQuery}' and trashed = false`;
    
  const result = await runGog(`drive search "${finalQuery}" --raw-query --json --max=1000`);
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
        const link = f.mimeType === "application/vnd.google-apps.folder"
          ? `https://drive.google.com/drive/folders/${f.id}`
          : `https://drive.google.com/file/d/${f.id}/view`;
        out += `- **${sanitizeMarkdown(f.name)}** — \`${f.id}\` — [Abrir](${link})\n`;
      }

      if (end < files.length) {
        const queryLink = `https://drive.google.com/drive/u/0/search?q=${encodeURIComponent(query)}`;
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

export const driveMkdir = async (name: string, parentId?: string) => {
  // Primero buscar si ya existe para evitar duplicados (petición del usuario)
  console.log(`🔍 Verificando si la carpeta "${name}" ya existe...`);
  const escapedName = name.replace(/'/g, "\\'");
  let searchQuery = `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId && parentId !== "root") {
    searchQuery += ` and '${parentId}' in parents`;
  }
  
  try {
    const searchRes = await runGog(`drive search "${searchQuery}" --raw-query --json`);
    const parsed = JSON.parse(searchRes);
    const files = parsed.files || (Array.isArray(parsed) ? parsed : []);
    
    if (files.length > 0) {
      const existing = files[0];
      console.log(`✅ Carpeta encontrada: ${existing.id}`);
      return `📁 La carpeta **"${name}"** ya existe (ID: \`${existing.id}\`).\n\nNo se ha creado una nueva para mantener tu Drive organizado.`;
    }
  } catch (err) {
    console.warn("⚠️ Advertencia: No se pudo verificar si la carpeta ya existe. Procediendo con cautela.");
  }

  let cmd = `drive mkdir "${name}" --json`;
  if (parentId && parentId !== "." && parentId !== "root") {
    cmd += ` --parent=${parentId}`;
  }
  
  const result = await runGog(cmd);
  try {
    const parsed = JSON.parse(result);
    const folder = parsed.folder || parsed;
    const link = `https://drive.google.com/drive/folders/${folder.id}`;
    return `✅ **Carpeta creada con éxito**\n\n📁 **Nombre:** ${folder.name}\n🆔 **ID:** ` + "`" + folder.id + "`" + `\n🔗 **Enlace:** [Abrir carpeta](${link})`;
  } catch {
    return result;
  }
};


export const driveMove = async (fileId: string, parentId: string) => {
  const result = await runGog(`drive move ${fileId} --parent=${parentId}`);
  const link = parentId === "root" ? "https://drive.google.com/drive/my-drive" : `https://drive.google.com/drive/folders/${parentId}`;
  return `✅ **Elemento movido correctamente**\n\n🆔 **Archivo:** \`${fileId}\`\n📂 **Nueva Carpeta:** \`${parentId}\`\n🔗 **Enlace carpeta:** [Ver carpeta](${link})\n\n*Resultado:* ${result}`;
};

export const driveUpload = async (filePath: string, parentId?: string, name?: string) => {
  let cmd = `drive upload "${filePath}" --json`;
  if (parentId) cmd += ` --parent=${parentId}`;
  if (name) cmd += ` --name="${name}"`;
  const result = await runGog(cmd);
  try {
    const parsed = JSON.parse(result);
    const file = parsed.file || parsed;
    const link = `https://drive.google.com/file/d/${file.id}/view`;
    return `✅ **Archivo subido con éxito**\n\n🆔 **ID:** \`${file.id}\`\n📁 **Nombre:** ${file.name}\n🔗 **Enlace:** [Abrir archivo](${link})`;
  } catch {
    return `✅ **Archivo subido**\n\n*Resultado:* ${result}`;
  }
};

export const driveRemove = async (fileId: string) => {
  const result = await runGog(`drive rm ${fileId}`);
  return `🗑️ **Elemento eliminado**\n\n🆔 **ID:** \`${fileId}\`\n\n*Resultado:* ${result}`;
};

export const driveReadFile = async (fileId: string) => {
  const tempName = `download_${Date.now()}`;
  const tempPath = path.join(process.cwd(), "temp", tempName);
  
  if (!fs.existsSync(path.join(process.cwd(), "temp"))) {
    fs.mkdirSync(path.join(process.cwd(), "temp"), { recursive: true });
  }

  try {
    console.log(`📥 Intentando descargar/exportar archivo de Drive ${fileId}...`);
    
    const metaRaw = await runGog(`drive get ${fileId} --json`);
    const meta = JSON.parse(metaRaw);
    const mimeType = meta.mimeType || meta.file?.mimeType || "";
    const name = meta.name || meta.file?.name || "archivo";
    
    let downloadPath = tempPath;
    let isGoogleDoc = mimeType.startsWith("application/vnd.google-apps.");
    let format = "";
    
    if (isGoogleDoc) {
      format = "txt";
      downloadPath = tempPath + ".txt";
      await runGog(`drive download ${fileId} --format=txt --out="${downloadPath}"`);
    } else {
      downloadPath = tempPath + (name.includes(".") ? path.extname(name) : "");
      await runGog(`drive download ${fileId} --out="${downloadPath}"`);
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

