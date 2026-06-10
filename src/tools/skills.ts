import fs from "fs";
import path from "path";

const SKILLS_DIR = path.resolve("skills");

export async function searchSkills(query: string, limit: number = 20) {
  const allSkills: any[] = [];
  const queryLower = (query || "").toLowerCase().trim();

  if (fs.existsSync(SKILLS_DIR)) {
    const files = fs.readdirSync(SKILLS_DIR);
    for (const file of files) {
      const fullPath = path.join(SKILLS_DIR, file);
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
          
          // Si no hay query, devolver todas; si hay query, filtrar
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
              source: "local",
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
            description: "Habilidad empaquetada (ZIP). Usa install_skill para extraerla.",
            source: "local",
            type: "zip"
          });
        }
      }
    }
  }

  const result = allSkills.slice(0, limit);
  
  if (result.length === 0) {
    return `No se encontraron habilidades${queryLower ? ` para la búsqueda: "${query}"` : ""}. El catálogo local está vacío o no hay coincidencias.`;
  }

  let output = `🧬 **HABILIDADES DISPONIBLES** (${result.length} encontradas)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  for (const s of result) {
    output += `🔹 **${s.title}** \`[${s.type}]\`\n`;
    output += `> ${s.description}\n`;
    output += `> 🆔 ID: \`${s.id}\`\n\n`;
  }
  output += `\n💡 Usa \`install_skill\` con el ID para activar una habilidad.`;
  return output;
}

export async function getSkill(id: string) {
  if (!fs.existsSync(SKILLS_DIR)) return null;

  const folders = fs.readdirSync(SKILLS_DIR);
  for (const folder of folders) {
    const folderPath = path.join(SKILLS_DIR, folder);
    const skillMdPath = path.join(folderPath, "SKILL.md");
    
    if (!fs.existsSync(skillMdPath)) continue;
    
    const content = fs.readFileSync(skillMdPath, "utf-8");
    const nameMatch = content.match(/name:\s*(.+)/);
    const skillName = nameMatch ? nameMatch[1].trim() : "";
    
    // Buscar por nombre en frontmatter O por nombre de carpeta
    if (skillName === id || folder === id || folder === id.replace(/[^a-zA-Z0-9]/g, "-")) {
      const skillFiles = fs.readdirSync(folderPath)
        .filter(f => {
          try { return fs.statSync(path.join(folderPath, f)).isFile(); } catch { return false; }
        })
        .map(f => ({
          name: f,
          content: fs.readFileSync(path.join(folderPath, f), "utf-8")
        }));
      
      return { id: skillName || folder, folder, files: skillFiles, type: "folder" };
    }
  }

  // Buscar como ZIP
  const zipPath = path.join(SKILLS_DIR, `${id}.zip`);
  if (fs.existsSync(zipPath)) {
    return { id, path: zipPath, type: "zip" };
  }

  return null;
}

export async function installSkill(id: string) {
  const skill = await getSkill(id);
  if (!skill) return `❌ No se encontró la habilidad con ID: \`${id}\`\n\nUsa \`search_skills\` para ver las habilidades disponibles.`;

  // Si la skill ya está en una carpeta con SKILL.md, ya está "instalada"
  if (skill.type === "folder" && skill.folder) {
    const targetDir = path.join(SKILLS_DIR, skill.folder);
    if (fs.existsSync(path.join(targetDir, "SKILL.md"))) {
      return `✅ La habilidad **'${id}'** ya está instalada y activa en \`skills/${skill.folder}/\`.\n\n🧬 Estará disponible automáticamente en la próxima conversación.`;
    }
  }

  if (skill.type === "zip") {
    const { execSync } = await import("child_process");
    const targetDir = path.join(SKILLS_DIR, id.replace(/[^a-zA-Z0-9-]/g, "-"));
    try {
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const cmd = `powershell -Command "Expand-Archive -Path '${(skill as any).path}' -DestinationPath '${targetDir}' -Force"`;
      execSync(cmd);
      return `✅ **Habilidad '${id}' instalada correctamente** (ZIP extraído).\n\n🧬 Disponible en la próxima conversación en \`skills/${id}/\`.`;
    } catch (err: any) {
      return `❌ Error extrayendo habilidad ZIP: ${err.message}`;
    }
  }

  // Tipo folder pero en una carpeta diferente — copiar
  const targetDir = path.join(SKILLS_DIR, id.replace(/[^a-zA-Z0-9-]/g, "-"));
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  for (const file of (skill as any).files || []) {
    fs.writeFileSync(path.join(targetDir, file.name), file.content);
  }

  return `✅ **Habilidad '${id}' instalada correctamente**.\n\n🧬 Disponible en la próxima conversación. Ahora tengo acceso a nuevas capacidades.`;
}

export async function createSkill(name: string, description: string, content: string): Promise<string> {
  const folderName = name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const targetDir = path.join(SKILLS_DIR, folderName);
  
  try {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    
    const skillMd = `---\nname: ${name}\ndescription: ${description}\n---\n\n${content}`;
    fs.writeFileSync(path.join(targetDir, "SKILL.md"), skillMd);
    
    return `✅ **Nueva habilidad '${name}' creada e instalada**.\n\n📁 Ubicación: \`skills/${folderName}/SKILL.md\`\n🧬 Disponible automáticamente desde ahora.`;
  } catch (err: any) {
    return `❌ Error creando la habilidad: ${err.message}`;
  }
}

export async function loadSkills(): Promise<string[]> {
  const skills: string[] = [];
  if (fs.existsSync(SKILLS_DIR)) {
    const folders = fs.readdirSync(SKILLS_DIR);
    for (const folder of folders) {
      const skillPath = path.join(SKILLS_DIR, folder, "SKILL.md");
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

export async function loadSkillsSummary(): Promise<string> {
  let summary = "";
  if (fs.existsSync(SKILLS_DIR)) {
    const folders = fs.readdirSync(SKILLS_DIR);
    for (const folder of folders) {
      const folderPath = path.join(SKILLS_DIR, folder);
      let stats;
      try { stats = fs.statSync(folderPath); } catch { continue; }
      
      if (!stats.isDirectory()) continue;

      const skillPath = path.join(folderPath, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        try {
          const content = fs.readFileSync(skillPath, "utf-8");
          // Regex mejorada para capturar name y description incluso con saltos de línea o formatos variados
          const nameMatch = content.match(/name:\s*([^\n\r]+)/i);
          const descMatch = content.match(/description:\s*([^\n\r]+)/i);
          
          const name = nameMatch ? nameMatch[1].trim().replace(/['"]/g, "") : folder;
          let desc = descMatch ? descMatch[1].trim().replace(/['"]/g, "") : "Habilidad sin descripción detallada.";
          
          // Limitar longitud de descripción para no saturar el prompt
          if (desc.length > 150) desc = desc.substring(0, 147) + "...";
          
          summary += `- **${name}** (ID: \`${folder}\`): ${desc}\n`;
        } catch (err: any) {
          console.error(`⚠️ Error cargando resumen de skill en ${folder}:`, err.message);
        }
      }
    }
  }
  return summary || "No hay habilidades adicionales instaladas.";
}
