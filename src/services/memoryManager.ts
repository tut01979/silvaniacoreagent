import { dbService } from "../database/db.js";
import { runGog } from "../tools/gogWrapper.js";
import { driveMemoryService } from "./driveMemory.js";
import { llmService } from "./llm.js";
import { generateDriveLink } from "./linkGenerator.js";
import fs from "fs";
import path from "path";

const summaryLocks = new Map<number, boolean>();

export interface MemorySummary {
  version: number;
  lastUpdated: string;
  summary: string;
  keyPoints: string[];
  topics?: string[];
  metadata?: Record<string, any>;
}

export const memoryManager = {
  /**
   * Resuelve cualquier nombre de carpeta (ej: "historial", "silvania", "2026", "07") o ID directo de Drive
   * y devuelve el listado formateado con emojis y enlaces generados por generateDriveLink.
   */
  async listFolderContents(userId: number, folderNameOrId: string): Promise<string> {
    try {
      let targetId = folderNameOrId?.trim();
      let folderDisplayName = targetId || "Raíz";

      if (!targetId || targetId === "." || targetId === "root") {
        targetId = "root";
        folderDisplayName = "Raíz de Drive";
      } else if (!/^[a-zA-Z0-9_-]{15,}$/.test(targetId)) {
        // Resolve path hierarchically (e.g., "silvania/historial/2026/07")
        console.log(`🔍 [Memory Manager] Resolviendo ID para la ruta de carpeta "${targetId}"...`);
        const parts = targetId.split("/").filter(p => p.trim().length > 0);
        let parentFolderId = "root";
        
        for (const part of parts) {
          const searchRes = await runGog(
            `drive search "name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed = false" --raw-query --json`,
            userId
          );
          const parsedSearch = JSON.parse(searchRes);
          const files = parsedSearch.files || (Array.isArray(parsedSearch) ? parsedSearch : []);
          if (files.length > 0) {
            parentFolderId = files[0].id;
            folderDisplayName = files[0].name;
          } else {
            // Fallback: Si no se encuentra en esa rama de forma jerárquica, intentar búsqueda global
            const fallbackRes = await runGog(
              `drive search "name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false" --raw-query --json`,
              userId
            );
            const parsedFallback = JSON.parse(fallbackRes);
            const fallbackFiles = parsedFallback.files || (Array.isArray(parsedFallback) ? parsedFallback : []);
            if (fallbackFiles.length > 0) {
              parentFolderId = fallbackFiles[0].id;
              folderDisplayName = fallbackFiles[0].name;
            } else {
              return `📁 No se encontró ninguna carpeta llamada "${part}" en el camino de "${folderNameOrId}" en tu Google Drive.`;
            }
          }
        }
        targetId = parentFolderId;
      }

      console.log(`📂 [Memory Manager] Listando contenido de la carpeta "${folderDisplayName}" (ID: ${targetId})...`);
      const cmd = `drive search "'${targetId}' in parents and trashed = false" --raw-query --json --max=1000`;
      const result = await runGog(cmd, userId);
      const parsed = JSON.parse(result);
      const files: any[] = parsed.files || (Array.isArray(parsed) ? parsed : []);

      if (files.length === 0) {
        return `📁 La carpeta **"${folderDisplayName}"** está vacía o no tiene elementos activos.`;
      }

      // Ordenar: carpetas primero, luego archivos alfabéticamente
      const sorted = [...files].sort((a, b) => {
        const isAFolder = a.mimeType === "application/vnd.google-apps.folder";
        const isBFolder = b.mimeType === "application/vnd.google-apps.folder";
        if (isAFolder && !isBFolder) return -1;
        if (!isAFolder && isBFolder) return 1;
        return (a.name || "").localeCompare(b.name || "");
      });

      let out = `📁 **CONTENIDO DE LA CARPETA "${folderDisplayName.toUpperCase()}"** (${files.length} elementos)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      for (const f of sorted) {
        if (!f || !f.id) continue;
        const isFolder = f.mimeType === "application/vnd.google-apps.folder";
        const icon = isFolder ? "📁" : f.mimeType === "application/vnd.google-apps.spreadsheet" ? "📊" : f.mimeType === "application/pdf" ? "📕" : "📄";
        const link = generateDriveLink(f.id, isFolder);
        const date = f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString("es-ES") : "";
        
        out += `${icon} ${f.name}  🔗 [Abrir](${link})\n`;
        out += `> 🆔 \`${f.id}\`${date ? `  |  📅 ${date}` : ""}\n\n`;
      }

      return out.trim();
    } catch (err: any) {
      console.error(`❌ Error al listar carpeta "${folderNameOrId}":`, err.message);
      return `❌ Error al listar la carpeta "${folderNameOrId}": ${err.message}`;
    }
  },
  /**
   * Obtiene el archivo resumen (memoria_conversacion.json) de Google Drive.
   * Si no existe, devuelve una estructura vacía inicial.
   * Si existe, lo descarga, lo parsea y realiza la migración automática de esquema si es necesario.
   */
  async getConversationSummary(userId: number): Promise<MemorySummary> {
    try {
      console.log(`🔍 [Memory Manager] Buscando memoria_conversacion.json en Drive para usuario ${userId}...`);
      const silvaniaFolderId = await driveMemoryService.getOrCreateFolderPath(["silvania"], userId);
      
      const searchRes = await runGog(
        `drive search "name = 'memoria_conversacion.json' and '${silvaniaFolderId}' in parents and trashed = false" --raw-query --json`,
        userId
      );
      
      const parsed = JSON.parse(searchRes);
      const files = parsed.files || (Array.isArray(parsed) ? parsed : []);
      
      if (files.length === 0) {
        console.log(`ℹ️ [Memory Manager] No se encontró memoria_conversacion.json. Se utilizará la estructura por defecto.`);
        return this.getDefaultSummary();
      }
      
      const fileId = files[0].id;
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempName = `summary_${userId}_${Date.now()}.json`;
      const tempPath = path.join(tempDir, tempName);
      
      try {
        await runGog(`drive download ${fileId} --out="${tempPath}"`, userId);
        if (fs.existsSync(tempPath)) {
          const content = fs.readFileSync(tempPath, "utf8");
          try { fs.unlinkSync(tempPath); } catch {}
          
          let data: any;
          try {
            data = JSON.parse(content);
          } catch (jsonErr: any) {
            console.error("❌ [Memory Manager] Error al parsear JSON de memoria_conversacion.json:", jsonErr.message);
            // Si el archivo está corrupto, tratarlo como si fuera un string plano con el contenido original
            data = content;
          }
          
          return this.migrateSummarySchema(data);
        }
      } catch (downloadErr: any) {
        console.error(`❌ [Memory Manager] Error descargando memoria_conversacion.json:`, downloadErr.message);
      }
    } catch (err: any) {
      console.error(`❌ [Memory Manager] Error en getConversationSummary:`, err.message);
    }
    return this.getDefaultSummary();
  },

  /**
   * Guarda el archivo resumen (memoria_conversacion.json) de Google Drive, reemplazando el existente.
   */
  async updateConversationSummary(userId: number, summaryData: MemorySummary): Promise<void> {
    try {
      console.log(`💾 [Memory Manager] Actualizando memoria_conversacion.json en Drive para usuario ${userId}...`);
      const silvaniaFolderId = await driveMemoryService.getOrCreateFolderPath(["silvania"], userId);
      
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempName = `summary_upload_${userId}_${Date.now()}.json`;
      const tempPath = path.join(tempDir, tempName);
      
      // Asegurar versión correcta antes de guardar
      summaryData.version = 1;
      summaryData.lastUpdated = new Date().toISOString();
      
      fs.writeFileSync(tempPath, JSON.stringify(summaryData, null, 2), "utf8");
      
      // Buscar si ya existe el archivo
      const fileName = "memoria_conversacion.json";
      await driveMemoryService.uploadOrReplace(userId, tempPath, fileName, silvaniaFolderId);
      console.log(`✅ [Memory Manager] memoria_conversacion.json subido con éxito.`);
      
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch {}
    } catch (err: any) {
      console.error(`❌ [Memory Manager] Error en updateConversationSummary:`, err.message);
    }
  },

  /**
   * Migración automática de esquema de memoria_conversacion.json
   */
  migrateSummarySchema(data: any): MemorySummary {
    if (!data) {
      return this.getDefaultSummary();
    }
    
    // Si es un string crudo (viejas versiones o texto corrupto)
    if (typeof data === "string") {
      return {
        version: 1,
        lastUpdated: new Date().toISOString(),
        summary: data.trim(),
        keyPoints: [],
        topics: [],
        metadata: { migratedFromRawString: true }
      };
    }
    
    // Si es un objeto, verificar los campos básicos
    const summary: MemorySummary = {
      version: 1,
      lastUpdated: data.lastUpdated || new Date().toISOString(),
      summary: data.summary || "",
      keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : (data.points ? data.points : []),
      topics: Array.isArray(data.topics) ? data.topics : [],
      metadata: data.metadata || {}
    };
    
    return summary;
  },

  getDefaultSummary(): MemorySummary {
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      summary: "No hay resumen de conversaciones previas disponible todavía.",
      keyPoints: [],
      topics: [],
      metadata: {}
    };
  },

  /**
   * Busca todos los archivos dia_XX.json y devuelve un listado ordenado cronológicamente.
   */
  async listHistoryFiles(userId: number): Promise<Array<{ year: string; month: string; day: string; fileId: string; name: string }>> {
    const list: Array<{ year: string; month: string; day: string; fileId: string; name: string }> = [];
    try {
      console.log(`📂 [Memory Manager] Listando archivos en silvania/historial...`);
      const historialFolderId = await driveMemoryService.getOrCreateFolderPath(["silvania", "historial"], userId);
      if (historialFolderId === "root") return [];
      
      // 1. Obtener carpetas de años (ej: 2026)
      const yearRes = await runGog(
        `drive search "'${historialFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false" --raw-query --json`,
        userId
      );
      const parsedYears = JSON.parse(yearRes);
      const yearFolders = parsedYears.files || (Array.isArray(parsedYears) ? parsedYears : []);
      
      for (const yearFolder of yearFolders) {
        const year = yearFolder.name;
        if (!/^\d{4}$/.test(year)) continue; // Asegurar que es un año de 4 dígitos
        
        // 2. Obtener carpetas de meses (ej: 06, 07)
        const monthRes = await runGog(
          `drive search "'${yearFolder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false" --raw-query --json`,
          userId
        );
        const parsedMonths = JSON.parse(monthRes);
        const monthFolders = parsedMonths.files || (Array.isArray(parsedMonths) ? parsedMonths : []);
        
        for (const monthFolder of monthFolders) {
          const month = monthFolder.name;
          if (!/^\d{2}$/.test(month)) continue; // Asegurar que es un mes de 2 dígitos
          
          // 3. Obtener archivos JSON dia_XX.json
          const fileRes = await runGog(
            `drive search "'${monthFolder.id}' in parents and mimeType = 'application/json' and trashed = false" --raw-query --json`,
            userId
          );
          const parsedFiles = JSON.parse(fileRes);
          const files = parsedFiles.files || (Array.isArray(parsedFiles) ? parsedFiles : []);
          
          for (const file of files) {
            if (file.name.startsWith("dia_") && file.name.endsWith(".json")) {
              const dayStr = file.name.replace("dia_", "").replace(".json", "");
              list.push({
                year,
                month,
                day: dayStr,
                fileId: file.id,
                name: file.name
              });
            }
          }
        }
      }
      
      // Ordenar cronológicamente (antiguos primero)
      list.sort((a, b) => {
        const dateA = `${a.year}-${a.month}-${a.day.padStart(2, '0')}`;
        const dateB = `${b.year}-${b.month}-${b.day.padStart(2, '0')}`;
        return dateA.localeCompare(dateB);
      });
      
    } catch (err: any) {
      console.error(`❌ [Memory Manager] Error al listar historial:`, err.message);
    }
    return list;
  },

  /**
   * Lee de forma fiable un archivo dia_XX.json de Drive.
   * Soporta versionado y migración de esquema si el archivo no es un array plano de mensajes (v1).
   */
  async readDayHistory(userId: number, year: string, month: string, day: string): Promise<any[] | null> {
    try {
      const formattedMonth = month.padStart(2, "0");
      const formattedDay = day.padStart(2, "0");
      console.log(`📖 [Memory Manager] Leyendo historial para el día ${year}-${formattedMonth}-${formattedDay}...`);
      
      const monthFolderId = await driveMemoryService.getOrCreateFolderPath(["silvania", "historial", year, formattedMonth], userId);
      if (monthFolderId === "root") {
        console.log(`ℹ️ [Memory Manager] No se encontró la carpeta del mes ${year}/${formattedMonth} en Drive.`);
        return null;
      }
      
      const fileName = `dia_${formattedDay}.json`;
      const searchRes = await runGog(
        `drive search "name = '${fileName}' and '${monthFolderId}' in parents and trashed = false" --raw-query --json`,
        userId
      );
      
      const parsed = JSON.parse(searchRes);
      const files = parsed.files || (Array.isArray(parsed) ? parsed : []);
      
      if (files.length === 0) {
        console.log(`ℹ️ [Memory Manager] No existe el archivo ${fileName} en Drive.`);
        return null;
      }
      
      const fileId = files[0].id;
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempName = `read_day_${userId}_${Date.now()}.json`;
      const tempPath = path.join(tempDir, tempName);
      
      try {
        await runGog(`drive download ${fileId} --out="${tempPath}"`, userId);
        if (fs.existsSync(tempPath)) {
          const content = fs.readFileSync(tempPath, "utf8");
          try { fs.unlinkSync(tempPath); } catch {}
          
          let parsedData: any;
          try {
            parsedData = JSON.parse(content);
          } catch (parseErr) {
            console.error(`❌ [Memory Manager] Error parseando contenido de ${fileName}:`, content);
            return null;
          }
          
          // Migración automática del esquema del día
          if (Array.isArray(parsedData)) {
            // Version 1: Array plano de mensajes
            return parsedData;
          } else if (parsedData && Array.isArray(parsedData.messages)) {
            // Version 2: Objeto estructurado
            return parsedData.messages;
          } else {
            console.warn(`⚠️ [Memory Manager] Formato desconocido en ${fileName}.`);
            return null;
          }
        }
      } catch (downloadErr: any) {
        console.error(`❌ [Memory Manager] Error descargando ${fileName}:`, downloadErr.message);
      }
    } catch (err: any) {
      console.error(`❌ [Memory Manager] Error leyendo historial diario:`, err.message);
    }
    return null;
  },

  /**
   * Lee un archivo de historial directamente por su ID de Drive sin resolver rutas.
   */
  async readDayHistoryByFileId(userId: number, fileId: string): Promise<any[] | null> {
    try {
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempPath = path.join(tempDir, `read_file_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}.json`);
      
      try {
        await runGog(`drive download ${fileId} --out="${tempPath}"`, userId);
        if (fs.existsSync(tempPath)) {
          const content = fs.readFileSync(tempPath, "utf8");
          try { fs.unlinkSync(tempPath); } catch {}
          let parsedData = JSON.parse(content);
          if (Array.isArray(parsedData)) return parsedData;
          if (parsedData && Array.isArray(parsedData.messages)) return parsedData.messages;
        }
      } catch (err: any) {
        console.error(`❌ Error descargando archivo ${fileId}:`, err.message);
      }
    } catch (err: any) {
      console.error(`❌ Error en readDayHistoryByFileId:`, err.message);
    }
    return null;
  },

  /**
   * Busca en la memoria persistente (memoria_conversacion.json), base de datos local
   * e historial de Drive por temas, situaciones o palabras clave de forma ultra-rápida.
   */
  async searchByTopic(userId: number, topic: string): Promise<string> {
    try {
      console.log(`🔍 [Memory Manager] Buscando memoria por tema "${topic}" para usuario ${userId}...`);
      if (!topic || !topic.trim()) {
        return "❌ Especifica un tema o situación para buscar en la memoria (ej: 'situación sentimental', 'finanzas', 'proyecto').";
      }

      const cleanTopic = topic.trim().toLowerCase();
      const keywords = cleanTopic
        .split(/[\s,.;:-]+/)
        .map(w => w.replace(/[^\wáéíóúñ]/gi, "").toLowerCase())
        .filter(w => w.length > 2);

      // A. Buscar en silvania/temas/ primero
      const temasFolderId = await driveMemoryService.getOrCreateFolderPath(["silvania", "temas"], userId);
      const topicsSearchRes = await runGog(
        `drive search "'${temasFolderId}' in parents and trashed = false" --raw-query --json`,
        userId
      ).catch(() => "[]");

      let topicFiles: any[] = [];
      try {
        const topicsParsed = JSON.parse(topicsSearchRes);
        topicFiles = topicsParsed.files || (Array.isArray(topicsParsed) ? topicsParsed : []);
      } catch (err) {
        console.warn("⚠️ No se pudo parsear el resultado de búsqueda de temas:", err);
      }

      let foundTopicContent = "";
      let foundTopicFileName = "";

      const normalizedTopic = cleanTopic.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      const matchedFile = topicFiles.find((f: any) => {
        const cleanName = f.name.toLowerCase().replace(".json", "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        return cleanName.includes(normalizedTopic) || normalizedTopic.includes(cleanName);
      });

      if (matchedFile) {
        console.log(`✅ [Memory Manager] Encontrado archivo de tema coincidente: ${matchedFile.name}`);
        const tempDir = path.join(process.cwd(), "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const tempPath = path.join(tempDir, `topic_read_${Date.now()}.json`);

        try {
          await runGog(`drive download ${matchedFile.id} --out="${tempPath}"`, userId);
          if (fs.existsSync(tempPath)) {
            const rawContent = fs.readFileSync(tempPath, "utf8");
            try { fs.unlinkSync(tempPath); } catch {}

            try {
              const parsedJson = JSON.parse(rawContent);
              foundTopicContent = typeof parsedJson === "object" ? JSON.stringify(parsedJson, null, 2) : rawContent;
            } catch {
              foundTopicContent = rawContent;
            }
            foundTopicFileName = matchedFile.name;
          }
        } catch (downloadErr: any) {
          console.error(`❌ Error descargando archivo de tema ${matchedFile.name}:`, downloadErr.message);
        }
      }

      if (foundTopicContent) {
        console.log(`🤖 [Memory Manager] Generando reporte estructurado desde archivo de tema para "${topic}"...`);
        const prompt = `Has realizado una búsqueda por el tema "${topic}" en la memoria persistente de conversaciones del usuario Jesús.
Se ha encontrado un archivo de tema específico denominado "${foundTopicFileName}" con el siguiente contenido:

${foundTopicContent}

=== INSTRUCCIONES OBLIGATORIAS ===
1. Redacta un reporte consolidado, claro, detallado y profesional en español.
2. Basate ÚNICAMENTE en la información proporcionada arriba. NUNCA inventes información, datos, fechas o diálogos.
3. Organiza el resumen con secciones y viñetas elegantes.
4. Sé directo y evita frases genéricas al inicio como "De acuerdo a lo encontrado...". Empieza directamente respondiendo a la consulta.`;

        const aiSummary = await llmService.chatWithoutTools([
          { role: "system", content: "Eres Silvania CoreAgent. Escribes reportes ejecutivos e informes profundos basados exclusivamente en el archivo de tema del usuario." },
          { role: "user", content: prompt }
        ]);

        const topicLink = generateDriveLink(matchedFile.id, false);
        let out = `🧠 **REPORTE DE MEMORIA POR TEMA: "${topic.toUpperCase()}"**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        out += `${aiSummary.trim()}\n\n`;
        out += `📁 Fuente: silvania/temas/${foundTopicFileName}  ·  [🔗 Abrir](${topicLink})\n`;
        return out.trim();
      }

      // B. Caer en historial diario + resumen consolidado si no hay temas específicos
      const matches: Array<{ date: string; role: string; content: string }> = [];
      const matchingKeyPoints: string[] = [];
      const matchingTopics: string[] = [];

      // 1. Consultar memoria_conversacion.json en Drive
      const summaryData = await this.getConversationSummary(userId);

      if (Array.isArray(summaryData.keyPoints)) {
        for (const kp of summaryData.keyPoints) {
          const kpLower = kp.toLowerCase();
          if (keywords.some(k => kpLower.includes(k)) || kpLower.includes(cleanTopic)) {
            matchingKeyPoints.push(kp);
          }
        }
      }

      if (Array.isArray(summaryData.topics)) {
        for (const t of summaryData.topics) {
          const tLower = t.toLowerCase();
          if (keywords.some(k => tLower.includes(k)) || tLower.includes(cleanTopic)) {
            matchingTopics.push(t);
          }
        }
      }

      // 2. Búsqueda directa ultra-rápida en DB local (mensajes recientes y guardados)
      const dbMatches = await dbService.searchMessagesByTopic(userId, keywords);
      for (const dbm of dbMatches) {
        const dateStr = dbm.timestamp ? dbm.timestamp.substring(0, 10) : "Reciente";
        const exists = matches.some(m => m.date === dateStr && m.content === dbm.content);
        if (!exists) {
          matches.push({
            date: dateStr,
            role: dbm.role || "user",
            content: dbm.content
          });
        }
      }

      // 3. Buscar en los archivos de historial diario (dia_XX.json) limitando a últimos 8 días (5-8 recomendados)
      const allHistoryFiles = await this.listHistoryFiles(userId);
      const historyFiles = allHistoryFiles.slice(-8); // Limitar estrictamente a los últimos 8 días
      for (const item of historyFiles) {
        const dateStr = `${item.year}-${item.month.padStart(2, "0")}-${item.day.padStart(2, "0")}`;
        const messages = await this.readDayHistoryByFileId(userId, item.fileId);
        if (Array.isArray(messages)) {
          for (const msg of messages) {
            if (!msg || !msg.content || typeof msg.content !== "string") continue;
            const contentLower = msg.content.toLowerCase();
            const hasMatch = keywords.some(k => contentLower.includes(k)) || contentLower.includes(cleanTopic);
            if (hasMatch) {
              const exists = matches.some(m => m.date === dateStr && m.content === msg.content);
              if (!exists) {
                matches.push({
                  date: dateStr,
                  role: msg.role || "user",
                  content: msg.content
                });
              }
            }
          }
        }
      }

      if (matches.length === 0 && matchingKeyPoints.length === 0 && matchingTopics.length === 0) {
        return `ℹ️ No encontré ninguna conversación o dato guardado en mi memoria sobre el tema **"${topic}"**.`;
      }

      // Generar reporte detallado y profundo usando el LLM
      console.log(`🤖 [Memory Manager] Generando reporte estructurado de memoria para el tema "${topic}"...`);
      const prompt = `Has realizado una búsqueda por el tema "${topic}" en la memoria persistente de conversaciones del usuario Jesús.
A continuación se listan los fragmentos de diálogos, puntos clave y temas relacionados encontrados en el historial:

=== PUNTOS CLAVE ENCONTRADOS ===
${matchingKeyPoints.length > 0 ? matchingKeyPoints.map(kp => `- ${kp}`).join("\n") : "(Ninguno registrado)"}

=== DIÁLOGOS E HISTORIAL DE MENSAJES ===
${matches.length > 0 ? matches.map(m => `[${m.date}] [${m.role === 'user' ? 'Jesús' : 'Silvania'}]: ${m.content}`).join("\n") : "(Ninguno registrado)"}

=== INSTRUCCIONES OBLIGATORIAS ===
1. Redacta un reporte consolidado, claro, detallado y profesional en español.
2. Basate ÚNICAMENTE en la información proporcionada arriba. NUNCA inventes información, datos, fechas o diálogos.
3. Si la información indica contradicciones o aclaraciones sobre el tema, menciónalas con rigurosidad y honestidad.
4. Si se habla de aspectos importantes (como finanzas, embargo, situación sentimental, familiar, etc.), organiza el resumen con secciones y viñetas elegantes.
5. Si no hay suficiente información o solo hay menciones breves, indícalo explícitamente: "El registro histórico sobre este tema es limitado, encontrándose únicamente las siguientes referencias...".
6. Sé directo y evita frases genéricas al inicio como "De acuerdo a lo encontrado...". Empieza directamente respondiendo a la consulta.`;

      const aiSummary = await llmService.chatWithoutTools([
        { role: "system", content: "Eres Silvania CoreAgent. Escribes reportes ejecutivos e informes profundos basados exclusivamente en la memoria e historial del usuario." },
        { role: "user", content: prompt }
      ]);

      let out = `🧠 **REPORTE DE MEMORIA POR TEMA: "${topic.toUpperCase()}"**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      out += `${aiSummary.trim()}\n\n`;

      if (matchingTopics.length > 0) {
        out += `🏷️ **Etiquetas Relacionadas:** ${matchingTopics.join(", ")}\n`;
      }

      return out.trim();
    } catch (err: any) {
      console.error(`❌ [Memory Manager] Error en searchByTopic:`, err.message);
      return `❌ Error buscando en la memoria por tema: ${err.message}`;
    }
  },

  /**
   * Se ejecuta automáticamente al finalizar cada interacción (llamado en syncToDrive).
   * Genera un resumen e identifica puntos clave y etiquetas de temas de la conversación de hoy,
   * y los fusiona de manera inteligente con el archivo memoria_conversacion.json existente.
   */
  async autoUpdateSummary(userId: number): Promise<void> {
    if (summaryLocks.get(userId)) {
      console.log(`ℹ️ [Memory Manager] Omitiendo autoUpdateSummary para usuario ${userId}: ya hay una actualización de memoria en progreso.`);
      return;
    }
    summaryLocks.set(userId, true);
    try {
      const todayMessages = await dbService.getTodayMessages(userId);
      if (todayMessages.length === 0) {
        console.log("ℹ️ [Memory Manager] Sin mensajes hoy. No hay nada que resumir.");
        return;
      }
      
      console.log(`🤖 [Memory Manager] Generando resumen diario de conversación para usuario ${userId}...`);
      
      // Obtener el resumen acumulado actual
      const currentSummary = await this.getConversationSummary(userId);
      
      // Preparar el prompt para el LLM sin herramientas
      const formattedMessages = todayMessages.map(m => `[${m.timestamp}] ${m.role.toUpperCase()}: ${m.content}`).join("\n");
      
      const prompt = `Analiza la conversación de hoy entre el usuario y el asistente, y actualiza la memoria persistente de forma consolidada.
      
=== MEMORIA ACTUAL ===
Resumen General: "${currentSummary.summary}"
Temas Principales Anteriores: ${(currentSummary.topics || []).join(", ")}
Puntos Clave Anteriores:
${currentSummary.keyPoints.map(kp => `- ${kp}`).join("\n")}

=== CONVERSACIÓN DE HOY ===
${formattedMessages}

=== INSTRUCCIONES ===
1. Actualiza el "Resumen General" integrando de forma cohesiva los hechos, cambios de preferencias, y decisiones importantes tomados hoy, manteniendo una narración breve y clara en tercera persona.
2. Agrega los "Puntos Clave" nuevos de hoy (como tareas pendientes, datos importantes del usuario, preferencias nuevas). Mantén los puntos clave anteriores si siguen siendo válidos.
3. Extrae o actualiza las "Etiquetas de Temas" (topics) principales mencionados (ej: "situación sentimental", "finanzas", "embargo", "proyecto Silvania", "antecedentes", "contactos", "calendario").
4. Devuelve los datos en formato JSON estricto con los campos:
   - "summary": string
   - "keyPoints": array de strings
   - "topics": array de strings
No incluyas explicaciones, saludos ni formateo de markdown (no uses triple comilla invertida). Solo el JSON limpio.`;

      const responseContent = await llmService.chatWithoutTools([
        { role: "system", content: "Eres un servicio interno de consolidación de memoria que actualiza el resumen de conversaciones en formato JSON." },
        { role: "user", content: prompt }
      ]);
      
      let cleanJson = responseContent.trim();
      if (cleanJson.includes("```")) {
        cleanJson = cleanJson.replace(/```json/g, "").replace(/```/g, "").trim();
      }
      
      try {
        const updateResult = JSON.parse(cleanJson);
        const updatedSummary: MemorySummary = {
          version: 1,
          lastUpdated: new Date().toISOString(),
          summary: updateResult.summary || currentSummary.summary,
          keyPoints: Array.isArray(updateResult.keyPoints) ? updateResult.keyPoints : currentSummary.keyPoints,
          topics: Array.isArray(updateResult.topics) ? updateResult.topics : (currentSummary.topics || []),
          metadata: {
            ...currentSummary.metadata,
            lastAutoUpdate: new Date().toISOString(),
            totalUpdates: (currentSummary.metadata?.totalUpdates || 0) + 1
          }
        };
        
        await this.updateConversationSummary(userId, updatedSummary);
        console.log(`✅ [Memory Manager] Memoria de conversación memoria_conversacion.json actualizada correctamente.`);
      } catch (jsonErr: any) {
        console.error(`❌ [Memory Manager] Error al parsear el JSON generado por el LLM:`, jsonErr.message, "\nContenido recibido:", responseContent);
      }
    } catch (err: any) {
      console.error(`❌ [Memory Manager] Falló auto-actualización del resumen de memoria:`, err.message);
    } finally {
      summaryLocks.set(userId, false);
    }
  },

  /**
   * Obtiene un tema específico desde la carpeta silvania/temas/ en Drive.
   */
  async getTopic(userId: number, topicName: string): Promise<any | null> {
    try {
      const temasFolderId = await driveMemoryService.getOrCreateFolderPath(["silvania", "temas"], userId);
      const cleanTopicName = topicName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_-]/g, "");
      const fileName = `${cleanTopicName}.json`;

      const searchRes = await runGog(
        `drive search "name = '${fileName}' and '${temasFolderId}' in parents and trashed = false" --raw-query --json`,
        userId
      );
      const parsed = JSON.parse(searchRes);
      const files = parsed.files || [];

      if (files.length === 0) return null;

      const fileId = files[0].id;
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const tempPath = path.join(tempDir, `topic_get_${Date.now()}.json`);

      try {
        await runGog(`drive download ${fileId} --out="${tempPath}"`, userId);
        if (fs.existsSync(tempPath)) {
          const content = fs.readFileSync(tempPath, "utf8");
          try { fs.unlinkSync(tempPath); } catch {}
          return JSON.parse(content);
        }
      } catch (err: any) {
        console.error(`❌ Error descargando tema ${fileName}:`, err.message);
      }
    } catch (err: any) {
      console.error("❌ Error en getTopic:", err.message);
    }
    return null;
  },

  /**
   * Guarda o actualiza un tema en Drive (silvania/temas/) utilizando uploadOrReplace.
   */
  async saveTopic(userId: number, topic: any): Promise<void> {
    try {
      const temasFolderId = await driveMemoryService.getOrCreateFolderPath(["silvania", "temas"], userId);
      const cleanTopicName = topic.topic.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_-]/g, "");
      const fileName = `${cleanTopicName}.json`;

      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const tempPath = path.join(tempDir, `topic_save_${Date.now()}.json`);

      topic.lastUpdated = new Date().toISOString();
      fs.writeFileSync(tempPath, JSON.stringify(topic, null, 2), "utf8");

      // Subir o reemplazar para evitar duplicados
      await driveMemoryService.uploadOrReplace(userId, tempPath, fileName, temasFolderId);
      
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
      console.log(`✅ [Memory Manager] Tema '${topic.topic}' guardado con éxito en Drive.`);
    } catch (err: any) {
      console.error("❌ Error en saveTopic:", err.message);
      throw err;
    }
  },

  /**
   * Lista los nombres de los temas existentes en Drive.
   */
  async listTopics(userId: number): Promise<string[]> {
    try {
      const temasFolderId = await driveMemoryService.getOrCreateFolderPath(["silvania", "temas"], userId);
      const searchRes = await runGog(
        `drive search "'${temasFolderId}' in parents and trashed = false" --raw-query --json`,
        userId
      );
      const parsed = JSON.parse(searchRes);
      const files = parsed.files || [];
      return files.map((f: any) => f.name.replace(".json", ""));
    } catch (err: any) {
      console.error("❌ Error en listTopics:", err.message);
      return [];
    }
  }
};
