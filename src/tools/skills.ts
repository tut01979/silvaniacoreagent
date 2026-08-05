import fs from "fs";
import path from "path";
import { runGog } from "./gogWrapper.js";
import { configManager } from "../services/configManager.js";

const REPO_DIR = path.resolve("skills_repository");

export function getUserSkillsDir(userId: number): string {
  const dir = path.resolve("skills", userId.toString());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function searchSkills(query: string, userId: number, limit: number = 20) {
  const allSkills: any[] = [];
  const queryLower = (query || "").toLowerCase().trim();

  // 1. Buscar en el repositorio de habilidades (la biblioteca)
  if (fs.existsSync(REPO_DIR)) {
    const files = fs.readdirSync(REPO_DIR);
    for (const file of files) {
      const fullPath = path.join(REPO_DIR, file);
      let stats: fs.Stats;
      try { stats = fs.statSync(fullPath); } catch { continue; }

      if (stats.isDirectory()) {
        const skillMdPath = path.join(fullPath, "SKILL.md");
        if (fs.existsSync(skillMdPath)) {
          const content = fs.readFileSync(skillMdPath, "utf-8");
          const nameMatch = content.match(/name:\s*(.+)/);
          const descMatch = content.match(/description:\s*(.+)/);
          
          const skillName = nameMatch ? nameMatch[1].trim() : file;
          const skillDesc = descMatch ? descMatch[1].trim() : "Sin descripción";
          
          const matches = !queryLower
            || skillName.toLowerCase().includes(queryLower)
            || skillDesc.toLowerCase().includes(queryLower)
            || file.toLowerCase().includes(queryLower)
            || content.toLowerCase().includes(queryLower);

          if (matches) {
            allSkills.push({
              id: skillName,
              folder: file,
              title: skillName,
              description: skillDesc,
              source: "repository",
              type: "folder"
            });
          }
        }
      } else if (file.endsWith(".zip")) {
        const skillId = file.replace(".zip", "");
        const matches = !queryLower || skillId.toLowerCase().includes(queryLower);
        if (matches) {
          allSkills.push({
            id: skillId,
            folder: file,
            title: skillId,
            description: "Habilidad empaquetada (ZIP). Usa install_skill para extraerla e instalarla.",
            source: "repository",
            type: "zip"
          });
        }
      }
    }
  }

  // 2. Obtener lista de habilidades ya instaladas para el usuario actual
  const activeSkills = new Set<string>();
  const userSkillsDir = getUserSkillsDir(userId);
  if (fs.existsSync(userSkillsDir)) {
    const folders = fs.readdirSync(userSkillsDir);
    for (const folder of folders) {
      const skillMdPath = path.join(userSkillsDir, folder, "SKILL.md");
      if (fs.existsSync(skillMdPath)) {
        try {
          const content = fs.readFileSync(skillMdPath, "utf-8");
          const nameMatch = content.match(/name:\s*(.+)/);
          if (nameMatch) {
            activeSkills.add(nameMatch[1].trim().toLowerCase());
          }
        } catch {}
      }
    }
  }

  const result = allSkills.slice(0, limit);
  
  if (result.length === 0) {
    return `No se encontraron habilidades en el repositorio${queryLower ? ` para la búsqueda: "${query}"` : ""}.`;
  }

  let output = `🧬 **BIBLIOTECA DE HABILIDADES DISPONIBLES** (${result.length} encontradas)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  for (const s of result) {
    const isInstalled = activeSkills.has(s.id.toLowerCase());
    output += `🔹 **${s.title}** ${isInstalled ? "✅ *(Instalada y Activa)*" : "📥 *(Disponible en Repositorio)*"}\n`;
    output += `> ${s.description}\n`;
    output += `> 🆔 ID: \`${s.id}\`\n\n`;
  }
  output += `\n💡 Usa \`install_skill\` seguido del ID de la habilidad para activarla en tu conversación actual.`;
  return output;
}

export async function getSkill(id: string, userId: number) {
  const userSkillsDir = getUserSkillsDir(userId);
  const searchDirs = [REPO_DIR, userSkillsDir];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;

    const folders = fs.readdirSync(dir);
    for (const folder of folders) {
      const folderPath = path.join(dir, folder);
      let stats;
      try { stats = fs.statSync(folderPath); } catch { continue; }
      if (!stats.isDirectory()) continue;

      const skillMdPath = path.join(folderPath, "SKILL.md");
      if (!fs.existsSync(skillMdPath)) continue;
      
      const content = fs.readFileSync(skillMdPath, "utf-8");
      const nameMatch = content.match(/name:\s*(.+)/);
      const skillName = nameMatch ? nameMatch[1].trim() : "";
      
      const normalizedId = id.toLowerCase().replace(/[^a-zA-Z0-9]/g, "-");
      const normalizedFolder = folder.toLowerCase().replace(/[^a-zA-Z0-9]/g, "-");
      const normalizedSkillName = skillName.toLowerCase().replace(/[^a-zA-Z0-9]/g, "-");

      if (
        skillName.toLowerCase() === id.toLowerCase() ||
        folder.toLowerCase() === id.toLowerCase() ||
        normalizedSkillName === normalizedId ||
        normalizedFolder === normalizedId
      ) {
        const skillFiles = fs.readdirSync(folderPath)
          .filter(f => {
            try { return fs.statSync(path.join(folderPath, f)).isFile(); } catch { return false; }
          })
          .map(f => ({
            name: f,
            content: fs.readFileSync(path.join(folderPath, f), "utf-8")
          }));
        
        return { id: skillName || folder, folder, files: skillFiles, type: "folder", dir };
      }
    }

    // Buscar como ZIP
    const zipPath = path.join(dir, `${id}.zip`);
    if (fs.existsSync(zipPath)) {
      return { id, path: zipPath, type: "zip", dir };
    }
  }

  return null;
}

export async function installSkill(id: string, userId: number) {
  const skill = await getSkill(id, userId);
  if (!skill) {
    return `❌ No se encontró la habilidad con ID: \`${id}\` en la biblioteca ni en local.\n\nUsa \`search_skills\` para ver las disponibles.`;
  }

  const userSkillsDir = getUserSkillsDir(userId);
  // Si ya está activa en userSkillsDir
  if (skill.dir === userSkillsDir) {
    return `✅ La habilidad **'${id}'** ya está instalada y activa en las habilidades locales.`;
  }

  const targetFolderName = skill.folder || id.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const targetDir = path.join(userSkillsDir, targetFolderName);

  // Si es tipo ZIP
  if (skill.type === "zip" && skill.path) {
    const { execSync } = await import("child_process");
    try {
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const cmd = `powershell -Command "Expand-Archive -Path '${skill.path}' -DestinationPath '${targetDir}' -Force"`;
      execSync(cmd);
      
      // Subir a Drive para persistencia
      await uploadSkillToDrive(userId, targetFolderName, targetDir);
      
      return `✅ **Habilidad '${id}' instalada y activada correctamente** (ZIP extraído y guardado en Drive).\n\n🧬 Ya está disponible en la conversación actual.`;
    } catch (err: any) {
      return `❌ Error extrayendo habilidad ZIP: ${err.message}`;
    }
  }

  // Tipo folder - copiar archivos del repositorio a la carpeta de activas del usuario
  try {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    for (const file of (skill as any).files || []) {
      fs.writeFileSync(path.join(targetDir, file.name), file.content);
    }

    // Subir a Drive para persistencia
    await uploadSkillToDrive(userId, targetFolderName, targetDir);

    return `✅ **Habilidad '${id}' instalada y activada correctamente** (guardada en Drive).\n\n🧬 Ya está disponible en la conversación actual.`;
  } catch (err: any) {
    return `❌ Error al copiar los archivos de la habilidad: ${err.message}`;
  }
}

export async function createSkill(name: string, description: string, content: string, userId: number): Promise<string> {
  const folderName = name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const userSkillsDir = getUserSkillsDir(userId);
  
  try {
    const skillMd = `---\nname: ${name}\ndescription: ${description}\n---\n\n${content}`;

    // Crear en habilidades activas locales del usuario
    const activeTargetDir = path.join(userSkillsDir, folderName);
    if (!fs.existsSync(activeTargetDir)) fs.mkdirSync(activeTargetDir, { recursive: true });
    fs.writeFileSync(path.join(activeTargetDir, "SKILL.md"), skillMd);
    
    // Subir a Drive para persistencia
    await uploadSkillToDrive(userId, folderName, activeTargetDir);
    
    return `✅ **Nueva habilidad '${name}' creada e instalada en tu Drive**.\n\n🧬 Disponible desde ahora en la conversación actual.`;
  } catch (err: any) {
    return `❌ Error creando la habilidad: ${err.message}`;
  }
}

export async function loadSkills(userId: number): Promise<string[]> {
  const skills: string[] = [];
  const userSkillsDir = getUserSkillsDir(userId);
  if (fs.existsSync(userSkillsDir)) {
    const folders = fs.readdirSync(userSkillsDir);
    for (const folder of folders) {
      const skillPath = path.join(userSkillsDir, folder, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        try {
          const content = fs.readFileSync(skillPath, "utf-8");
          skills.push(content);
        } catch { /* skip corrupted */ }
      }
    }
  }
  return skills;
}

export async function loadSkillsSummary(userId: number): Promise<string> {
  let summary = "";
  const userSkillsDir = getUserSkillsDir(userId);
  if (fs.existsSync(userSkillsDir)) {
    const folders = fs.readdirSync(userSkillsDir);
    for (const folder of folders) {
      const folderPath = path.join(userSkillsDir, folder);
      let stats;
      try { stats = fs.statSync(folderPath); } catch { continue; }
      
      if (!stats.isDirectory()) continue;

      const skillPath = path.join(folderPath, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        try {
          const content = fs.readFileSync(skillPath, "utf-8");
          const nameMatch = content.match(/name:\s*([^\n\r]+)/i);
          const descMatch = content.match(/description:\s*([^\n\r]+)/i);
          
          const name = nameMatch ? nameMatch[1].trim().replace(/['"]/g, "") : folder;
          let desc = descMatch ? descMatch[1].trim().replace(/['"]/g, "") : "Habilidad sin descripción detallada.";
          
          if (desc.length > 150) desc = desc.substring(0, 147) + "...";
          
          summary += `- **${name}** (ID: \`${folder}\`): ${desc}\n`;
        } catch (err: any) {
          console.error(`⚠️ Error cargando resumen de skill en ${folder} para usuario ${userId}:`, err.message);
        }
      }
    }
  }
  return summary || "No hay habilidades adicionales instaladas.";
}

/**
 * Helper para subir/actualizar los archivos de una skill a Google Drive del usuario.
 */
async function uploadSkillToDrive(userId: number, folderName: string, localFolder: string): Promise<void> {
  try {
    const skillsFolderId = await configManager.getOrCreateFolderPath(userId, ["silvania", "skills"]);
    const skillDriveFolderId = await configManager.getOrCreateFolderPath(userId, ["silvania", "skills", folderName]);

    // Subir todos los archivos locales del folder de la skill
    const files = fs.readdirSync(localFolder);
    for (const file of files) {
      const localFilePath = path.join(localFolder, file);
      if (fs.statSync(localFilePath).isFile()) {
        // Buscar si ya existe para sobreescribir
        const searchRes = await runGog(
          `drive search "name = '${file}' and '${skillDriveFolderId}' in parents and trashed = false" --raw-query --json`,
          userId
        );
        const parsed = JSON.parse(searchRes);
        const driveFiles = parsed.files || (Array.isArray(parsed) ? parsed : []);
        if (driveFiles.length > 0) {
          try {
            await runGog(`drive rm ${driveFiles[0].id}`, userId);
          } catch {}
        }
        await runGog(`drive upload "${localFilePath}" --parent=${skillDriveFolderId} --name="${file}"`, userId);
      }
    }
    
    // Registrar también la skill en config.json
    const config = await configManager.loadConfig(userId);
    if (!config.installedSkills.includes(folderName)) {
      config.installedSkills.push(folderName);
      await configManager.saveConfig(userId, config);
    }
  } catch (err: any) {
    console.error(`❌ [Skills Drive] Error al sincronizar skill '${folderName}' a Google Drive:`, err.message);
  }
}
