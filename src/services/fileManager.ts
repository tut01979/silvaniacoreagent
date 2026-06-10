import axios from "axios";
import fs from "fs";
import path from "path";
import { config } from "../config/config.js";
import { llmService } from "./llm.js";
import { executeTool } from "../tools/index.js";
import { runGog } from "../tools/gogWrapper.js";

// ID permanente de la carpeta de subidas (la principal, no los duplicados)
const UPLOADS_FOLDER_ID = "1rNNiFnS7XlzsUvdNTykTQY09So3b3eLo";
const UPLOADS_FOLDER_NAME = "Archivos SilvaniaCoreAgent";

export const fileManager = {

  async downloadFromTelegram(fileUrl: string, fileName: string): Promise<string> {
    const tempDir = path.resolve(config.tempDir);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, fileName);
    const writer = fs.createWriteStream(filePath);
    const response = await axios({ url: fileUrl, method: "GET", responseType: "stream" });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on("finish", () => resolve(filePath));
      writer.on("error", reject);
    });
  },

  /**
   * Genera un nombre descriptivo para una imagen usando visión del LLM.
   * Devuelve el nombre sin extension, limpio para usar como nombre de archivo.
   */
  async generateDescriptiveName(localPath: string, originalName: string, extension: string, existingDescription?: string): Promise<string> {
    try {
      let description = existingDescription;
      
      if (!description) {
        console.log("📸 Analizando imagen local con visión para nombre descriptivo...");
        const visionResponse = await llmService.analyzeImage([], localPath);
        description = (visionResponse.content || "").trim();
      }

      if (!description) throw new Error("Sin descripción de visión");

      // Pedir un nombre corto y profesional basado en la descripción
      const prompt = `Analiza detenidamente esta descripción de una imagen y genera un nombre de archivo que sea EXTREMADAMENTE descriptivo, corto, profesional y en español.
      
      REGLAS:
      1. Usa guiones bajos (_) en lugar de espacios.
      2. Máximo 4-5 palabras.
      3. NO incluyas la extensión del archivo.
      4. Si es un documento personal (DNI, Pasaporte), incluye el tipo.
      5. Si es una factura, incluye el comercio o servicio.

      Descripción de la imagen: "${description}"
      
      Ejemplos excelentes: DNI_Eduardo_Anverso, Factura_Iberdrola_Marzo, Foto_Reunion_Oficina, Logo_Silvania_Vectorial.

      Responde ÚNICAMENTE con el nombre del archivo limpio.`;

      const nameResponse = await llmService.chat([{ role: "user", content: prompt }]);
      const rawName = (nameResponse.content || "").trim();
      
      // Limpiar el nombre: solo caracteres alfanuméricos, guiones bajos y guiones
      const cleanName = rawName
        .replace(/\.[^/.]+$/, "")  // quitar extensión si la puso
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_\-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .substring(0, 60);

      return cleanName || "Archivo_Procesado";
    } catch (err) {
      console.error("⚠️ Error generando nombre descriptivo:", err);
      // Fallback: usar nombre original sin el prefix genérico
      const baseName = originalName
        .replace(/\.[^/.]+$/, "")
        .replace(/^(file_|photo_|image_|img_)/i, "")
        || "Archivo";
      return baseName;
    }
  },

  /**
   * Obtiene el ID de la carpeta de uploads, buscando primero la preferida 'Archivos SilvaniaCoreAgent'.
   * Evita crear duplicados si ya existe alguna carpeta con ese nombre.
   */
  async getOrCreateUploadFolder(): Promise<string> {
    const PREFERRED_NAME = UPLOADS_FOLDER_NAME;

    // 1. Intentar con el ID conocido (si sigue siendo válido)
    try {
      // Usamos drive list con el ID para verificar existencia rápida
      const checkRaw = await runGog(`drive get ${UPLOADS_FOLDER_ID} --json`);
      if (checkRaw && (checkRaw.includes(UPLOADS_FOLDER_ID) || checkRaw.includes("name"))) {
        const check = JSON.parse(checkRaw);
        const folder = check.file || check;
        if (folder && !folder.trashed) {
            console.log(`✅ Carpeta principal verificada por ID: ${UPLOADS_FOLDER_ID}`);
            return UPLOADS_FOLDER_ID;
        }
      }
    } catch (e) {
        console.log("ID de carpeta principal no accesible o inválido. Buscando por nombre...");
    }

    // 2. Buscar por nombre exacto (y nombre similar como fallback)
    console.log(`📂 Buscando carpeta "${PREFERRED_NAME}"...`);
    let searchResult: any[] = [];
    try {
      // Usamos la sintaxis correcta: query posicional + flag --raw-query
      const searchRaw = await runGog(`drive search "name = '${PREFERRED_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false" --raw-query --json`);
      
      const search = JSON.parse(searchRaw);
      searchResult = search.files || (Array.isArray(search) ? search : []);
      
      // Si no hay resultados exactos, intentamos búsqueda por 'contains' por si acaso
      if (searchResult.length === 0) {
        const searchRaw2 = await runGog(`drive search "name contains '${PREFERRED_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false" --raw-query --json`);
        const search2 = JSON.parse(searchRaw2);
        searchResult = search2.files || (Array.isArray(search2) ? search2 : []);
      }

      if (searchResult.length > 0) {
        // Si hay varios, nos quedamos con el más antiguo (asumimos que es el original)
        searchResult.sort((a: any, b: any) => new Date(a.createdTime || a.modifiedTime || 0).getTime() - new Date(b.createdTime || b.modifiedTime || 0).getTime());
        console.log(`✅ Encontrada carpeta existente: ${searchResult[0].name} (${searchResult[0].id}). Total duplicados: ${searchResult.length}`);
        return searchResult[0].id;
      }
    } catch (err: any) {
      console.warn(`⚠️ Error buscando la carpeta "${PREFERRED_NAME}":`, err.message);
    }

    // 3. Crear carpeta nueva SOLO si estamos seguros de que no existe
    console.log(`📁 Creando carpeta principal "${PREFERRED_NAME}"...`);
    try {
      const createRaw = await runGog(`drive mkdir "${PREFERRED_NAME}" --json`);
      const create = JSON.parse(createRaw);
      const folder = create.folder || create.file || create;
      if (folder && folder.id) {
          console.log(`✨ Nueva carpeta creada: ${folder.id}`);
          return folder.id;
      }
    } catch (err: any) {
      console.error("❌ Error crítico creando carpeta:", err.message);
      throw new Error(`Error creando la carpeta de subidas: ${err.message}`);
    }

    throw new Error("No se pudo obtener ni crear la carpeta de uploads.");
  },

  /**
   * Descarga, analiza, renombra y sube un archivo a Drive.
   * Además, guarda la descripción de visión en un archivo .txt separado.
   * @returns Objeto con nombre descriptivo, descripción de visión y IDs de archivos
   */
  async processAndUpload(
    userId: number,
    fileUrl: string,
    originalName: string,
    isPhoto: boolean,
    targetFolderId?: string
  ): Promise<{ descriptiveName: string; description: string; fileId: string; descriptionFileId?: string }> {
    const extension = path.extname(originalName).toLowerCase() || (isPhoto ? ".jpg" : "");
    
    // 1. Descargar localmente con nombre temporal
    const tempName = `temp_${Date.now()}${extension}`;
    const localPath = await this.downloadFromTelegram(fileUrl, tempName);
    let finalLocalPath = localPath;

    try {
      let descriptiveName: string;
      let description = "Archivo sin descripción detallada.";

      if (isPhoto || [".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
        // Generar nombre descriptivo mediante visión del LLM
        const visionResponse = await llmService.analyzeImage([], localPath);
        description = (visionResponse.content || "").trim();
        
        const baseName = await this.generateDescriptiveName(localPath, originalName, extension, description);
        descriptiveName = `${baseName}${extension}`;
      } else {
        // Documentos (PDF, etc): mejorar nombre si es genérico
        const isGeneric = /^(file_|document_|doc_|\d+\.|untitled|telegram)/i.test(originalName);
        if (isGeneric) {
          const prompt = `El usuario envió un documento llamado "${originalName}". Genera un nombre profesional y descriptivo en español (sin espacios, usando guiones bajos) basado en el nombre original. Responde SOLO con el nombre incluyendo la extensión.`;
          const nameResp = await llmService.chat([{ role: "user", content: prompt }]);
          descriptiveName = (nameResp.content || originalName).trim().replace(/ /g, "_");
          description = `Documento procesado: ${descriptiveName}`;
        } else {
          descriptiveName = originalName.replace(/ /g, "_");
          description = `Documento: ${descriptiveName}`;
        }
      }

      // Saneamiento final del nombre para evitar caracteres no válidos en sistemas de archivos (como Windows)
      descriptiveName = descriptiveName
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_\-\.]/g, "_")
        .replace(/_+/g, "_");

      // Asegurar que el nombre tenga la extensión correcta
      if (!descriptiveName.toLowerCase().endsWith(extension)) {
        descriptiveName += extension;
      }

      // 2. Renombrar archivo local
      finalLocalPath = path.join(path.dirname(localPath), descriptiveName);
      console.log(`📂 Renombrando archivo temporal a: ${finalLocalPath}`);
      fs.renameSync(localPath, finalLocalPath);

      // 3. Obtener carpeta destino
      const folderId = targetFolderId || await this.getOrCreateUploadFolder();

      // 4. Subir archivo principal a Drive
      console.log(`📤 Subiendo "${descriptiveName}" a Drive (carpeta: ${folderId})...`);
      const uploadRaw = await runGog(`drive upload "${finalLocalPath}" --name="${descriptiveName}" --parent="${folderId}" --json`);
      
      let fileId = "";
      try {
        const uploadParsed = JSON.parse(uploadRaw);
        fileId = uploadParsed.id || uploadParsed.file?.id || "";
      } catch (e) {
        console.warn("⚠️ No se pudo obtener el ID del archivo subido desde el JSON:", (e as Error).message);
      }

      // 5. SI ES IMAGEN: Guardar la descripción en un archivo .txt en la misma carpeta
      let descriptionFileId = "";
      if (isPhoto && description && fileId) {
        const descFileName = `Descripcion_${descriptiveName.replace(extension, "")}.txt`;
        const descTempPath = path.join(path.dirname(localPath), `desc_${Date.now()}.txt`);
        fs.writeFileSync(descTempPath, `DESCRIPCIÓN DE LA IMAGEN: ${descriptiveName}\n\nID Drive: ${fileId}\n\nCONTENIDO:\n${description}`);
        
        console.log(`📝 Guardando descripción en Drive: ${descFileName}`);
        const descUploadRaw = await runGog(`drive upload "${descTempPath}" --name="${descFileName}" --parent="${folderId}" --json`);
        try {
          const descParsed = JSON.parse(descUploadRaw);
          descriptionFileId = descParsed.id || descParsed.file?.id || "";
        } catch {}
        
        try { if (fs.existsSync(descTempPath)) fs.unlinkSync(descTempPath); } catch {}
      }

      // 6. Limpiar archivo local
      try { if (fs.existsSync(finalLocalPath)) fs.unlinkSync(finalLocalPath); } catch {}

      return { descriptiveName, description, fileId, descriptionFileId };
    } catch (error) {
      // Limpiar cualquier archivo temporal que quede
      try { 
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath); 
        if (fs.existsSync(finalLocalPath)) fs.unlinkSync(finalLocalPath);
      } catch {}
      console.error("Error en fileManager.processAndUpload:", error);
      throw error;
    }
  },
};
