import { exec } from "child_process";
import util from "util";
import path from "path";
import { userContextStore } from "../services/context.js";
import { dbService } from "../database/db.js";

const execPromise = util.promisify(exec);
const GOG_PATH = process.platform === "win32" ? "bin\\gog.exe" : "./bin/gog";

// Función para limpiar códigos ANSI de la terminal
export function stripAnsi(text: string): string {
  return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
}

export async function runGogRaw(command: string): Promise<string> {
  const gogPath = process.platform === "win32" ? "bin\\gog.exe" : "bin/gog";
  const fullCmd = `${gogPath} ${command}`;
  
  // Redirigir APPDATA al directorio local 'data' para persistencia v1.3
  const localDataPath = path.join(process.cwd(), "data");
  const customEnv = { 
    ...process.env, 
    APPDATA: localDataPath,
    HOME: localDataPath, 
    USERPROFILE: localDataPath
  };

  console.log(`🔧 [gog] Ejecutando: ${fullCmd}`);
  try {
    const { stdout, stderr } = await execPromise(fullCmd, { 
      timeout: 60000, 
      maxBuffer: 1024 * 1024,
      env: customEnv
    });
    let output = stripAnsi(stdout || "").trim();
    
    // Si el comando pedía JSON, intentamos extraer el bloque JSON (objeto o array)
    if (command.includes("--json")) {
      const startBracket = output.indexOf("[");
      const startBrace = output.indexOf("{");
      
      let start = -1;
      let end = -1;
      
      if (startBracket !== -1 && (startBrace === -1 || startBracket < startBrace)) {
        start = startBracket;
        end = output.lastIndexOf("]");
      } else if (startBrace !== -1) {
        start = startBrace;
        end = output.lastIndexOf("}");
      }

      if (start !== -1 && end !== -1 && end > start) {
        output = output.substring(start, end + 1);
      }
    }
    
    return output;
  } catch (err: any) {
    const errorOutput = stripAnsi(err.stdout || err.stderr || err.message);
    console.error(`❌ [gog] Error en comando: ${fullCmd}\n${errorOutput}`);
    
    // Si falló pero devolvió algo que parece JSON, intentamos extraer el mensaje
    if (errorOutput.includes("{") || errorOutput.includes("[")) {
      try {
        const start = errorOutput.indexOf("{") !== -1 ? errorOutput.indexOf("{") : errorOutput.indexOf("[");
        const parsed = JSON.parse(errorOutput.substring(start));
        if (parsed && parsed.error && parsed.error.message) {
          throw new Error(parsed.error.message);
        }
      } catch (e) {
        // Ignorar error de parseo y lanzar el error original
      }
    }
    
    throw new Error(errorOutput);
  }
}

export function preprocessWorkspaceCommand(command: string): string {
  let clean = command.trim();
  const now = new Date();
  
  // Si el comando ya tiene --json o --format=json, lo normalizamos a --json
  if (clean.includes("--format=json")) {
    clean = clean.replace("--format=json", "--json");
  }

  // Prevenir IDs inválidos como "." o vacío
  // gog a veces interpreta un punto como el directorio actual, lo que rompe la API de Drive
  clean = clean.replace(/--parent=[\s"']*(\.)[\s"']*/g, '');
  clean = clean.replace(/--parent\s+[\s"']*(\.)[\s"']*/g, '');

  // Reemplazar palabras clave de tiempo por filtros de Gmail/Calendar
  if (clean.includes("gmail") || clean.includes("calendar ls")) {
    const todayStr = now.toISOString().split("T")[0].replace(/-/g, "/");
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0].replace(/-/g, "/");

    if (clean.includes("--today")) {
      clean = clean.replace("--today", "");
      if (clean.includes("gmail")) {
        clean += ` "after:${yesterdayStr}"`;
      } else {
        clean += ` --from=${todayStr} --to=${todayStr}`;
      }
    }
  }

  // Corregir sintaxis común de drive move/mkdir/upload
  if (clean.startsWith("drive move") || clean.startsWith("drive mkdir") || clean.startsWith("drive upload")) {
    // Normalizar --parent <id> a --parent=<id> y --name <val> a --name=<val>
    clean = clean.replace(/--parent\s+("([^"]+)"|(\S+))/g, '--parent=$1');
    clean = clean.replace(/--name\s+("([^"]+)"|(\S+))/g, '--name=$1');
    
    const parts = clean.match(/"[^"]+"|\S+/g) || [];
    // drive move <id> <parent_id> -> drive move <id> --parent=<parent_id>
    if (clean.startsWith("drive move") && parts.length === 4 && !parts[3].startsWith("--")) {
       clean = `drive move ${parts[2]} --parent=${parts[3]}`;
    }
    // drive mkdir "name" <parent_id> -> drive mkdir "name" --parent=<parent_id>
    if (clean.startsWith("drive mkdir") && parts.length === 4 && !parts[3].startsWith("--")) {
       clean = `drive mkdir ${parts[2]} --parent=${parts[3]}`;
    }
  }

  // gog drive search: normalizar sintaxis
  if (clean.includes("drive search")) {
    if (clean.includes("--raw-query=")) {
      clean = clean.replace(/--raw-query\s*=\s*("([^"]+)"|(\S+))/g, '$1 --raw-query');
    }
    if (clean.includes("--query=")) {
      clean = clean.replace(/--query\s*=\s*("([^"]+)"|(\S+))/g, '$1');
    }
    if (!clean.includes("--json") && !clean.includes("-j")) {
      clean += " --json";
    }
  }

  // gog gmail search: asegurar --json
  if (clean.startsWith("gmail search")) {
    if (!clean.includes("--json")) clean += " --json";
  }

  if (clean === "drive ls" || clean === "drive list") {
    clean = `drive search "'root' in parents and trashed = false" --raw-query --json --max=1000`; // Por defecto listar raíz
  }

  return clean;
}

/**
 * Ejecuta un comando gog con preprocesamiento y manejo de errores estandarizado.
 */
export async function runGog(command: string): Promise<string> {
  let finalCmd = command;
  const store = userContextStore.getStore();
  if (store?.userId) {
    const email = await dbService.getUserEmail(store.userId);
    if (email) {
      if (!finalCmd.includes("--account")) {
        finalCmd += ` --account=${email}`;
      }
    }
  }
  const processed = preprocessWorkspaceCommand(finalCmd);
  return await runGogRaw(processed);
}

