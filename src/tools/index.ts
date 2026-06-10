import axios from "axios";
import { gmailSearch, gmailList, gmailThread, gmailSend } from "./gmail.js";
import { driveList, driveSearch, driveMkdir, driveMove, driveUpload, driveRemove, driveReadFile } from "./drive.js";
import { calendarList, calendarCreate, calendarDelete } from "./calendar.js";
import { sheetsList, sheetsCreate, sheetsRead, sheetsWrite } from "./sheets.js";
import { runGog } from "./gogWrapper.js";
import { searchSkills, getSkill, installSkill, createSkill, loadSkills, loadSkillsSummary } from "./skills.js";
import { webSearch } from "./webSearch.js";
import { llmService } from "../services/llm.js";
import { youtubeGetTranscript } from "./youtube.js";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

export const tools = {
  get_current_time: async () => {
    const now = new Date();
    return `Fecha y hora actual: ${now.toLocaleString("es-ES", { dateStyle: "full", timeStyle: "medium" })}`;
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
  gmail_list: async ({ max_results }: { max_results?: number }) => {
    return await gmailList(max_results);
  },
  gmail_search: async ({ query, max_results }: { query: string; max_results?: number }) => {
    return await gmailSearch(query, max_results);
  },
  gmail_thread: async ({ thread_id }: { thread_id: string }) => {
    return await gmailThread(thread_id);
  },
  gmail_send: async ({ to, subject, body }: { to: string; subject: string; body: string }) => {
    return await gmailSend(to, subject, body);
  },

  // ─── DRIVE ───
  drive_list: async ({ parent_id, all, page }: { parent_id?: string; all?: boolean; page?: number }) => {
    return await driveList(parent_id, all, page);
  },
  drive_search: async ({ query, page }: { query: string; page?: number }) => {
    return await driveSearch(query, page);
  },
  drive_mkdir: async ({ name, parent_id }: { name: string; parent_id?: string }) => {
    return await driveMkdir(name, parent_id);
  },
  drive_move: async ({ file_id, parent_id }: { file_id: string; parent_id: string }) => {
    return await driveMove(file_id, parent_id);
  },
  drive_upload: async ({ file_path, parent_id, name }: { file_path: string; parent_id?: string; name?: string }) => {
    let cmd = `drive upload "${file_path}" --json`;
    if (parent_id) cmd += ` --parent=${parent_id}`;
    if (name) cmd += ` --name="${name}"`;
    const result = await runGog(cmd);
    try {
      const parsed = JSON.parse(result);
      const file = parsed.file || parsed;
      const link = `https://drive.google.com/file/d/${file.id}/view`;
      return `✅ **Archivo subido con éxito**\n\n🆔 **ID:** \`${file.id}\`\n📁 **Nombre:** ${file.name}\n🔗 **Enlace:** [Abrir archivo](${link})`;
    } catch {
      return `✅ **Archivo subido** (No se pudo parsear el ID)\n\n*Resultado:* ${result}`;
    }
  },
  drive_remove: async ({ file_id }: { file_id: string }) => {
    return await driveRemove(file_id);
  },
  drive_read_file: async ({ file_id }: { file_id: string }) => {
    return await driveReadFile(file_id);
  },
  drive_create_text_file: async ({ name, content, parent_id }: { name: string; content: string; parent_id?: string }) => {
    // 1. Crear archivo temporal
    const tempName = `temp_${Date.now()}.txt`;
    const tempPath = path.join(process.cwd(), "temp", tempName);
    
    if (!fs.existsSync(path.join(process.cwd(), "temp"))) {
      fs.mkdirSync(path.join(process.cwd(), "temp"), { recursive: true });
    }

    fs.writeFileSync(tempPath, content);

    // 2. Subir a Drive
    let cmd = `drive upload "${tempPath}" --name="${name}" --json`;
    if (parent_id) cmd += ` --parent=${parent_id}`;
    
    const result = await runGog(cmd);
    
    // 3. Limpiar
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}

    try {
      const parsed = JSON.parse(result);
      const file = parsed.file || parsed;
      const link = `https://drive.google.com/file/d/${file.id}/view`;
      return `✅ **Archivo de texto creado con éxito**\n\n📁 **Nombre:** ${file.name}\n🆔 **ID:** \`${file.id}\`\n🔗 **Enlace:** [Abrir archivo](${link})`;
    } catch {
      return `✅ **Archivo de texto subido**\n\n*Resultado:* ${result}`;
    }
  },

  // ─── CALENDAR ───
  calendar_list: async ({ days_ahead, start_date }: { days_ahead?: number; start_date?: string }) => {
    return await calendarList(days_ahead, start_date);
  },
  calendar_create: async ({ summary, start, end, description }: { summary: string; start: string; end: string; description?: string }) => {
    return await calendarCreate(summary, start, end, description);
  },
  calendar_delete: async ({ event_id }: { event_id: string }) => {
    return await calendarDelete(event_id);
  },

  // ─── SHEETS ───
  sheets_list: async () => {
    return await sheetsList();
  },
  sheets_create: async ({ title }: { title: string }) => {
    return await sheetsCreate(title);
  },
  sheets_read: async ({ spreadsheet_id, range }: { spreadsheet_id: string; range: string }) => {
    return await sheetsRead(spreadsheet_id, range);
  },
  sheets_write: async ({ spreadsheet_id, range, values }: { spreadsheet_id: string; range: string; values: string }) => {
    return await sheetsWrite(spreadsheet_id, range, values);
  },

  // ─── SKILLS ───
  search_skills: async ({ query, limit }: { query: string; limit?: number }) => {
    return await searchSkills(query, limit);
  },
  get_skill: async ({ id }: { id: string }) => {
    return await getSkill(id);
  },
  install_skill: async ({ id }: { id: string }) => {
    return await installSkill(id);
  },
  create_skill: async ({ name, description, content }: { name: string; description: string; content: string }) => {
    return await createSkill(name, description, content);
  },

  // ─── WEB ───
  read_url: async ({ url }: { url: string }) => {
    try {
      const resp = await axios.get(url, { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } });
      const text = String(resp.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 8000);
      return `📄 **Contenido de:** ${url}\n\n${text}`;
    } catch (e: any) {
      return `❌ No se pudo leer la URL: ${e.message}`;
    }
  },

  youtube_get_transcript: async ({ url }: { url: string }) => {
    return await youtubeGetTranscript(url);
  },

  google_workspace: async ({ command }: { command: string }) => {
    const clean = command.startsWith("gog ") ? command.slice(4) : command;
    return await runGog(clean);
  },
  
  analyze_image: async ({ file_id, prompt }: { file_id: string; prompt?: string }) => {
    try {
      // 1. Descargar el archivo de Drive a temporal
      const tempName = `analyze_${Date.now()}.jpg`;
      const tempPath = path.join(process.cwd(), "temp", tempName);
      
      if (!fs.existsSync(path.join(process.cwd(), "temp"))) {
        fs.mkdirSync(path.join(process.cwd(), "temp"), { recursive: true });
      }

      console.log(`📥 Descargando archivo ${file_id} para análisis...`);
      await runGog(`drive download ${file_id} --out="${tempPath}"`);

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

  load_skills: async () => {
    return await loadSkills();
  }
};

export type ToolName = keyof typeof tools;

export async function executeTool(name: string, args: any, userId?: number): Promise<string> {
  if (name in tools) {
    console.log(`🔧 Ejecutando herramienta: ${name}`, args);
    return String(await (tools as any)[name]({ ...args, userId }));
  }
  throw new Error(`Herramienta no encontrada: ${name}`);
}

// Re-export loadSkills y loadSkillsSummary para uso directo en agent.ts
export { loadSkills, loadSkillsSummary };
