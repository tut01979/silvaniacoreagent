import axios from "axios";
import * as cheerio from "cheerio";
import { gmailSearch, gmailList, gmailThread, gmailSend } from "./gmail.js";
import { checkMaliciousPattern, handleSecurityAlert } from "../services/security.js";
import { config } from "../config/config.js";
import { driveList, driveSearch, driveMkdir, driveMove, driveUpload, driveRemove, driveReadFile, resolveOrCreateParentId } from "./drive.js";
import { calendarList, calendarCreate, calendarDelete, calendarUpdate } from "./calendar.js";
import { userContextStore } from "../services/context.js";
import { sheetsList, sheetsCreate, sheetsRead, sheetsWrite, sheetsCreateInvoice } from "./sheets.js";
import { runGog } from "./gogWrapper.js";
import { searchSkills, getSkill, installSkill, createSkill, loadSkills, loadSkillsSummary, loadSkill } from "./skills.js";
import { webSearch } from "./webSearch.js";
import { llmService } from "../services/llm.js";
import { youtubeGetTranscript, youtubeSearch } from "./youtube.js";
import { memoryManager } from "../services/memoryManager.js";
import { generateDriveLink } from "../services/linkGenerator.js";
import { driveMemoryService } from "../services/driveMemory.js";
import { getAuthUrl } from "../services/authHelper.js";
import { analyzeDocument } from "./documentAnalyzer.js";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

export const tools = {
  get_current_time: async () => {
    const now = new Date();
    return `Fecha y hora actual: ${now.toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "full", timeStyle: "medium" })}`;
  },

  web_search: async ({ query, search_type, max_results }: { query: string; search_type?: string; max_results?: number }) => {
    return await webSearch(query, search_type || "web", max_results || 5);
  },



  execute_command: async ({ command }: { command: string }) => {
    try {
      const { stdout, stderr } = await execPromise(command, { timeout: 30000 });
      return stdout || stderr || "Comando ejecutado sin salida.";
    } catch (e: any) {
      return `Error ejecutando comando: ${e.message}`;
    }
  },

  // ─── GMAIL ───
  gmail_list: async ({ max_results, userId }: { max_results?: number; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    return await gmailList(uId, max_results);
  },
  gmail_search: async ({ query, max_results, userId }: { query: string; max_results?: number; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    return await gmailSearch(uId, query, max_results);
  },
  gmail_thread: async ({ thread_id, userId }: { thread_id: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    return await gmailThread(uId, thread_id);
  },
  gmail_send: async ({ to, subject, body, userId }: { to: string; subject: string; body: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    return await gmailSend(uId, to, subject, body);
  },

  // ─── DRIVE ───
  drive_list: async ({ parent_id, all, page, userId }: { parent_id?: string; all?: boolean; page?: number; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    return await driveList(parent_id, all, page, uId);
  },
  drive_search: async ({ query, page, parent_id, userId }: { query: string; page?: number; parent_id?: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    return await driveSearch(query, page, parent_id, uId);
  },
  drive_mkdir: async ({ name, parent_id, userId }: { name: string; parent_id?: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    return await driveMkdir(name, parent_id, uId);
  },
  drive_move: async ({ file_id, parent_id, userId }: { file_id: string; parent_id: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    return await driveMove(file_id, parent_id, uId);
  },
  drive_upload: async ({ file_path, parent_id, name, userId }: { file_path: string; parent_id?: string; name?: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId || 0;
    const resolvedParentId = await resolveOrCreateParentId(parent_id, uId);
    let cmd = `drive upload "${file_path}" --json`;
    if (resolvedParentId && resolvedParentId !== "root") cmd += ` --parent=${resolvedParentId}`;
    if (name) cmd += ` --name="${name}"`;
    const result = await runGog(cmd, uId);
    try {
      const parsed = JSON.parse(result);
      const file = parsed.file || parsed;
      const isFolder = file.mimeType === "application/vnd.google-apps.folder";
      const link = generateDriveLink(file.id, isFolder);
      return `✅ **Archivo subido con éxito**\n\n🆔 **ID:** \`${file.id}\`\n📁 **Nombre:** ${file.name}\n🔗 **Enlace:** [Abrir archivo](${link})`;
    } catch {
      return `✅ **Archivo subido** (No se pudo parsear el ID)\n\n*Resultado:* ${result}`;
    }
  },
  drive_remove: async ({ file_id, userId }: { file_id: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    return await driveRemove(file_id, uId);
  },
  drive_read_file: async ({ file_id, userId }: { file_id: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    return await driveReadFile(file_id, uId);
  },
  drive_create_text_file: async ({ name, content, parent_id, userId }: { name: string; content: string; parent_id?: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId || 0;
    const resolvedParentId = await resolveOrCreateParentId(parent_id, uId);
    // 1. Crear archivo temporal
    const tempName = `temp_${Date.now()}.txt`;
    const tempPath = path.join(process.cwd(), "temp", tempName);
    
    if (!fs.existsSync(path.join(process.cwd(), "temp"))) {
      fs.mkdirSync(path.join(process.cwd(), "temp"), { recursive: true });
    }

    fs.writeFileSync(tempPath, content);

    // 2. Subir a Drive
    let cmd = `drive upload "${tempPath}" --name="${name}" --json`;
    if (resolvedParentId && resolvedParentId !== "root") cmd += ` --parent=${resolvedParentId}`;
    
    const result = await runGog(cmd, uId);
    
    // 3. Limpiar
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}

    try {
      const parsed = JSON.parse(result);
      const file = parsed.file || parsed;
      const isFolder = file.mimeType === "application/vnd.google-apps.folder";
      const link = generateDriveLink(file.id, isFolder);
      return `✅ **Archivo de texto creado con éxito**\n\n📁 **Nombre:** ${file.name}\n🆔 **ID:** \`${file.id}\`\n🔗 **Enlace:** [Abrir archivo](${link})`;
    } catch {
      return `✅ **Archivo de texto subido**\n\n*Resultado:* ${result}`;
    }
  },

  // ─── CALENDAR ───
  calendar_list: async ({ days_ahead, start_date, userId }: { days_ahead?: number; start_date?: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    return await calendarList(uId, days_ahead, start_date);
  },
  calendar_create: async ({ summary, start, end, description, userId }: { summary: string; start: string; end: string; description?: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    return await calendarCreate(uId, summary, start, end, description);
  },
  calendar_delete: async ({ event_id, userId }: { event_id: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    return await calendarDelete(uId, event_id);
  },
  calendar_update: async ({ event_id, summary, start, end, description, userId }: { event_id: string; summary?: string; start?: string; end?: string; description?: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    return await calendarUpdate(uId, event_id, summary, start, end, description);
  },

  // ─── SHEETS ───
  sheets_list: async ({ userId }: { userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    return await sheetsList(uId);
  },
  sheets_create: async ({ title, userId }: { title: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    return await sheetsCreate(title, uId);
  },
  sheets_read: async ({ spreadsheet_id, range, userId }: { spreadsheet_id: string; range: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    return await sheetsRead(spreadsheet_id, range, uId);
  },
  sheets_write: async ({ spreadsheet_id, range, values, userId }: { spreadsheet_id: string; range: string; values: string | any[][]; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    return await sheetsWrite(spreadsheet_id, range, values, uId);
  },
  sheets_create_invoice: async ({ title, number, date, locale, userId }: { title: string; number?: string; date?: string; locale?: "es" | "en"; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    return await sheetsCreateInvoice({ title, number, date, locale, userId: uId });
  },

  // ─── SKILLS ───
  search_skills: async ({ query, limit, userId }: { query: string; limit?: number; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    return await searchSkills(query, uId, limit);
  },
  get_skill: async ({ id, userId }: { id: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return null;
    return await getSkill(id, uId);
  },
  install_skill: async ({ id, userId }: { id: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    return await installSkill(id, uId);
  },
  create_skill: async ({ name, description, content, instructions, userId }: { name: string; description: string; content?: string; instructions?: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    const finalContent = content || instructions;
    return await createSkill(name, description, finalContent, uId);
  },
  load_skill: async ({ skillName, userId }: { skillName: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    const result = await loadSkill(skillName, uId);
    if (!result) return `❌ Habilidad '${skillName}' no encontrada.`;
    return result;
  },

  read_url: async ({ url }: { url: string }) => {
    try {
      const resp = await axios.get(url, { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } });
      const $ = cheerio.load(resp.data);
      
      // Eliminar scripts, estilos, cabeceras de metadatos, iframes y elementos visuales no textuales
      $("script, style, head, noscript, iframe, svg").remove();
      
      let text = $("body").text();
      
      // Limpiar emojis, iconos y caracteres extraños, manteniendo letras (\p{L}), números (\p{N}), 
      // espacios (\s), puntuación común y el símbolo '@' (excluyendo separadores raros, emojis, etc.)
      text = text.replace(/[^\p{L}\p{N}\s.,:;¡!¿?()'"\-\/ @$%&=+*]/gu, "");
      
      const cleanText = text.replace(/\s+/g, " ").trim().slice(0, 8000);
      return `📄 **Contenido de:** ${url}\n\n${cleanText}`;
    } catch (e: any) {
      return `❌ No se pudo leer la URL: ${e.message}`;
    }
  },

  youtube_get_transcript: async ({ url, save_to_drive, userId }: { url: string; save_to_drive?: boolean; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    return await youtubeGetTranscript(url, uId, !!save_to_drive);
  },

  youtube_search: async ({ query, max_results }: { query: string; max_results?: number }) => {
    return await youtubeSearch(query, max_results || 5);
  },

  google_workspace: async ({ command, userId }: { command: string; userId?: number }) => {
    let clean = command.startsWith("gog ") ? command.slice(4) : command;
    clean = clean.trim();

    // 1. Auto-corregir "calendar delete" -> "calendar rm"
    if (clean.startsWith("calendar delete ")) {
      clean = clean.replace("calendar delete ", "calendar rm ");
    }

    // 2. Parsear y corregir argumentos de comandos de calendar
    const parts = clean.split(/\s+/);
    if (parts[0] === "calendar") {
      const action = parts[1]; // ls, create, rm, update
      if (action === "rm" && parts.length === 3) {
        // "calendar rm <eventId>" -> "calendar rm primary <eventId>"
        clean = `calendar rm primary ${parts[2]}`;
      } else if (action === "create" && parts[2] && parts[2].startsWith("-")) {
        // "calendar create --summary ..." -> "calendar create primary --summary ..."
        clean = clean.replace("calendar create", "calendar create primary");
      } else if (action === "update") {
        const posArgs: string[] = [];
        for (let i = 2; i < parts.length; i++) {
          if (parts[i].startsWith("-")) break;
          posArgs.push(parts[i]);
        }
        if (posArgs.length === 1) {
          // "calendar update <eventId> --summary ..." -> "calendar update primary <eventId> --summary ..."
          clean = clean.replace("calendar update", "calendar update primary");
        }
      }
    }
    // 3. Auto-corregir --value en sheets update / append para usar --values-json con matriz 2D
    if (clean.includes("sheets update") || clean.includes("sheets append")) {
      clean = clean.replace(/0,21/g, "21%").replace(/0\.21/g, "21%");
      const match = clean.match(/--value(?:=|\s+)(["']?)(.*?)\1(?:\s|$)/);
      if (match) {
        const value = match[2];
        const jsonVal = JSON.stringify([[value]]);
        clean = clean.replace(/--value(?:=|\s+)(["']?)(.*?)\1(?:\s|$)/, `--values-json '${jsonVal}' `).trim();
      }
      if (!clean.includes("--input")) {
        clean += " --input USER_ENTERED";
      }
    }

    const uId = userId || userContextStore.getStore()?.userId;
    return await runGog(clean, uId);
  },
  
  analyze_image: async ({ file_id, prompt, userId }: { file_id: string; prompt?: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    try {
      // 1. Descargar el archivo de Drive a temporal
      const tempName = `analyze_${Date.now()}.jpg`;
      const tempPath = path.join(process.cwd(), "temp", tempName);
      
      if (!fs.existsSync(path.join(process.cwd(), "temp"))) {
        fs.mkdirSync(path.join(process.cwd(), "temp"), { recursive: true });
      }

      console.log(`📥 Descargando archivo ${file_id} para análisis...`);
      await runGog(`drive download ${file_id} --out="${tempPath}"`, uId);

      // 2. Analizar con visión
      const visionPrompt = prompt || "¿Qué ves en esta imagen? Describe el contenido detalladamente.";
      const visionResponse = await llmService.analyzeImage([{ role: "user", content: visionPrompt }], tempPath);
      
      // 3. Limpiar
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
      
      return visionResponse.content || "No pude obtener una descripción de la imagen.";
    } catch (e: any) {
      return `❌ Error analizando imagen: ${e.message}`;
    }
  },

  analyze_document: async ({ file_id, prompt, userId }: { file_id: string; prompt?: string; userId?: number }) => {
    return await analyzeDocument({ file_id, prompt, userId });
  },

  load_skills: async ({ userId }: { userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return [];
    return await loadSkills(uId);
  },

  generate_authorization_link: async ({ userId }: { userId?: number }) => {
    try {
      if (!userId) {
        return "❌ Error: ID de usuario no especificado.";
      }
      const authUrl = getAuthUrl(userId);
      if (!authUrl) {
        return "❌ Error: No se encontraron las credenciales de Google del bot en el servidor.";
      }
      return `🔗 **Enlace de Vinculación de Google:**\n\n[Haz clic aquí para conectar tu cuenta de Google](${authUrl})\n\nEste enlace te redirigirá a Google para que elijas qué cuenta deseas conectar de forma segura y automática.`;
    } catch (err: any) {
      return `❌ Error generando el enlace de autorización: ${err.message}`;
    }
  },

  // ─── MEMORIA E HISTORIAL ───
  memory_get_summary: async ({ userId }: { userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    try {
      const summary = await memoryManager.getConversationSummary(uId);
      let out = `🧠 **RESUMEN DE CONVERSACIONES GUARDADAS** (v${summary.version})\n`;
      out += `📅 *Última actualización:* ${summary.lastUpdated ? new Date(summary.lastUpdated).toLocaleString("es-ES") : "Nunca"}\n\n`;
      out += `📝 **Resumen General:**\n${summary.summary}\n\n`;
      out += `📌 **Puntos Clave:**\n`;
      if (summary.keyPoints && summary.keyPoints.length > 0) {
        summary.keyPoints.forEach(kp => {
          out += `- ${kp}\n`;
        });
      } else {
        out += `*Ninguno registrado.*`;
      }
      return out;
    } catch (err: any) {
      return `❌ Error al leer el resumen de memoria: ${err.message}`;
    }
  },

  memory_update_summary: async ({ summary, keyPoints, userId }: { summary: string; keyPoints?: string[]; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    try {
      const current = await memoryManager.getConversationSummary(uId);
      current.summary = summary;
      if (keyPoints) {
        current.keyPoints = keyPoints;
      }
      await memoryManager.updateConversationSummary(uId, current);
      return `✅ **Memoria consolidada actualizada con éxito en Drive.**`;
    } catch (err: any) {
      return `❌ Error al actualizar el resumen de memoria: ${err.message}`;
    }
  },

  memory_list_history: async ({ userId }: { userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    try {
      const files = await memoryManager.listHistoryFiles(uId);
      if (files.length === 0) {
        return "📂 **No se encontraron archivos de conversación en silvania/historial.**";
      }
      let out = `📂 **HISTORIAL DE CONVERSACIONES EN DRIVE** (${files.length} días registrados)\n\n`;
      files.forEach(f => {
        out += `- 📅 **${f.year}-${f.month}-${f.day}** (Archivo: \`${f.name}\`, ID: \`${f.fileId}\`)\n`;
      });
      return out;
    } catch (err: any) {
      return `❌ Error al listar el historial: ${err.message}`;
    }
  },

  memory_read_day: async ({ year, month, day, userId }: { year: string; month: string; day: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    try {
      const messages = await memoryManager.readDayHistory(uId, year, month, day);
      if (!messages) {
        return `❌ No se encontró ningún archivo de conversación para la fecha ${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")} en Drive.`;
      }
      let out = `📖 **Historial de conversación del ${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}:**\n\n`;
      messages.forEach(m => {
        const roleName = m.role === "user" ? "Jesús" : m.role === "assistant" ? "Silvania" : "Sistema";
        out += `**[${roleName}]**:\n${m.content}\n\n`;
      });
      return out;
    } catch (err: any) {
      return `❌ Error al leer el historial del día: ${err.message}`;
    }
  },

  memory_search_by_topic: async ({ topic, userId }: { topic: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    try {
      return await memoryManager.searchByTopic(uId, topic);
    } catch (err: any) {
      return `❌ Error al buscar por tema en la memoria: ${err.message}`;
    }
  },

  memory_save_topic: async ({ topicName, content, userId }: { topicName: string; content: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    try {
      let parsedTopic: any;
      try {
        parsedTopic = JSON.parse(content);
        if (!parsedTopic.topic) parsedTopic.topic = topicName;
      } catch {
        parsedTopic = {
          topic: topicName,
          lastUpdated: new Date().toISOString(),
          summary: content.substring(0, 100),
          keyFacts: [content],
          notes: content
        };
      }
      await memoryManager.saveTopic(uId, parsedTopic);
      const cleanTopicName = topicName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_-]/g, "");
      return `✅ **Tema "${topicName}" guardado con éxito en silvania/temas/${cleanTopicName}.json.**`;
    } catch (err: any) {
      return `❌ Error al guardar el tema en la memoria: ${err.message}`;
    }
  },

  memory_get_diagnostics: async ({ userId }: { userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    try {
      // 1. Obtener estado de memoria_conversacion.json
      const summary = await memoryManager.getConversationSummary(uId);

      // 2. Listar archivos reales en silvania/temas/
      const temasFolderId = await driveMemoryService.getOrCreateFolderPath(["silvania", "temas"], uId);
      const searchRes = await runGog(
        `drive search "'${temasFolderId}' in parents and trashed = false" --raw-query --json`,
        uId
      );
      const parsed = JSON.parse(searchRes);
      const files = parsed.files || (Array.isArray(parsed) ? parsed : []);

      let out = `🧠 **DIAGNÓSTICO Y ORGANIZACIÓN DE MEMORIA**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      out += `📂 **Archivo Central (memoria_conversacion.json):**\n`;
      out += `> 📅 *Última actualización:* ${summary.lastUpdated ? new Date(summary.lastUpdated).toLocaleString("es-ES") : "Nunca"}\n`;
      out += `> 📝 *Resumen:* ${summary.summary.substring(0, 150)}...\n`;
      out += `> 📌 *Puntos Clave:* ${summary.keyPoints?.length || 0} registrados\n\n`;

      out += `📂 **Temas Guardados (silvania/temas/):**\n`;
      if (files.length === 0) {
        out += `> *No se encontraron archivos de temas específicos guardados.*`;
      } else {
        files.forEach((f: any) => {
          const link = generateDriveLink(f.id, false);
          out += `> 📄 ${f.name}  ·  [🔗 Abrir](${link}) (ID: \`${f.id}\`)\n`;
        });
      }
      return out;
    } catch (err: any) {
      return `❌ Error al obtener diagnóstico de memoria: ${err.message}`;
    }
  },

  memory_list_folder: async ({ folderNameOrId, userId }: { folderNameOrId: string; userId?: number }) => {
    const uId = userId || userContextStore.getStore()?.userId;
    if (!uId) return "❌ Error: Usuario no identificado.";
    try {
      return await memoryManager.listFolderContents(uId, folderNameOrId);
    } catch (err: any) {
      return `❌ Error al listar la carpeta: ${err.message}`;
    }
  }
};

export type ToolName = keyof typeof tools;

export async function executeTool(name: string, args: any, userId?: number): Promise<string> {
  // 1. Restricción de seguridad de execute_command a nivel de administrador
  if (name === "execute_command") {
    const adminId = config.telegram.allowedUsers[0] || 1572946817;
    if (!userId || userId !== adminId) {
      const warning = await handleSecurityAlert(userId || 0, "Usuario de Telegram", "Intento no autorizado de usar execute_command (consola remota).");
      return warning;
    }
  }

  // 2. Escaneo de inyección de comandos en los argumentos pasados a cualquier herramienta
  if (args && typeof args === "object") {
    for (const key of Object.keys(args)) {
      if (typeof args[key] === "string") {
        const threat = checkMaliciousPattern(args[key]);
        if (threat) {
          const warning = await handleSecurityAlert(userId || 0, "Usuario de Telegram", `Inyección detectada en el argumento [${key}] de la herramienta [${name}]: "${args[key]}" (${threat})`);
          return warning;
        }
      }
    }
  }

  if (name in tools) {
    console.log(`🔧 Ejecutando herramienta: ${name}`, args);
    return String(await (tools as any)[name]({ ...args, userId }));
  }
  throw new Error(`Herramienta no encontrada: ${name}`);
}

// Re-export loadSkills y loadSkillsSummary para uso directo en agent.ts
export { loadSkills, loadSkillsSummary, loadSkill };
