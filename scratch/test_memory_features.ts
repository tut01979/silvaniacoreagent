import { configManager } from "../src/services/configManager.js";
import { memoryManager } from "../src/services/memoryManager.js";
import { createSkill, loadSkill } from "../src/tools/skills.js";
import fs from "fs";
import path from "path";

async function runTests() {
  console.log("=== INICIANDO PRUEBAS DEL SISTEMA DE MEMORIA HÍBRIDO (v2) ===");
  const userId = 999999; // ID de usuario de pruebas
  const userFolder = path.join(process.cwd(), "data", `user_${userId}`);
  
  if (!fs.existsSync(userFolder)) {
    fs.mkdirSync(userFolder, { recursive: true });
  }

  // 1. Prueba de Configuración v2 y Migración Transparente
  console.log("\n1. Probando migración de configuración v1 a v2...");
  const oldConfigSimulated = {
    version: 1,
    customPrompt: "Instrucciones de prueba",
    muteVoice: true,
    installedSkills: ["rrhh-contratacion"]
  };

  const migrated = configManager.migrateConfig(oldConfigSimulated);
  console.log("-> Configuración migrada:", JSON.stringify(migrated, null, 2));

  const isV2 = migrated.version === 2;
  const hasPaths = migrated.skillsPath === "silvania/skills" && migrated.memory?.topicsEnabled === true;
  console.log(`-> Migró correctamente a v2: ${isV2 ? "✅ PASÓ" : "❌ FALLÓ"}`);
  console.log(`-> Incluye campos de rutas del esquema v2: ${hasPaths ? "✅ PASÓ" : "❌ FALLÓ"}`);

  // 2. Prueba de estructuración de SKILL.md en createSkill
  console.log("\n2. Probando estructuración y creación de skill...");
  const skillName = "Test-Marketing-SaaS";
  const skillDesc = "Habilidad para estructurar estrategias de marketing.";
  const skillContent = "Paso 1: Definir Buyer Persona.\nPaso 2: Lanzar campañas de Ads.\nPaso 3: Analizar ROI.";

  const localSkillsDir = path.join(process.cwd(), "skills", userId.toString());
  if (fs.existsSync(localSkillsDir)) {
    fs.rmSync(localSkillsDir, { recursive: true, force: true });
  }

  const resultMsg = await createSkill(skillName, skillDesc, skillContent, userId);
  console.log("-> Mensaje resultado:", resultMsg);

  const localSkillFilePath = path.join(localSkillsDir, "test-marketing-saas", "SKILL.md");
  const existsLocal = fs.existsSync(localSkillFilePath);
  console.log(`-> Archivo SKILL.md creado en caché local: ${existsLocal ? "✅ PASÓ" : "❌ FALLÓ"}`);

  if (existsLocal) {
    const writtenContent = fs.readFileSync(localSkillFilePath, "utf8");
    console.log("-> Contenido escrito:\n", writtenContent);
    const hasHeader = writtenContent.includes("name: Test-Marketing-SaaS") && writtenContent.includes("description:");
    const hasStep = writtenContent.includes("Paso 1: Definir Buyer Persona.");
    const hasSections = writtenContent.includes("## Descripción") && writtenContent.includes("## Entregables");
    console.log(`-> Posee frontmatter correcto: ${hasHeader ? "✅ PASÓ" : "❌ FALLÓ"}`);
    console.log(`-> Posee secciones obligatorias: ${hasSections ? "✅ PASÓ" : "❌ FALLÓ"}`);
    console.log(`-> Posee el paso de marketing: ${hasStep ? "✅ PASÓ" : "❌ FALLÓ"}`);
  }

  // 3. Prueba de carga contextual (loadSkill)
  console.log("\n3. Probando carga contextual de la skill (loadSkill)...");
  const loadedContent = await loadSkill(skillName, userId);
  const loadedOk = loadedContent !== null && loadedContent.includes("Strategy");
  console.log(`-> Habilidad cargada exitosamente: ${loadedContent ? "✅ PASÓ" : "❌ FALLÓ"}`);

  // 4. Limpieza de datos temporales de prueba
  try {
    if (fs.existsSync(userFolder)) fs.rmSync(userFolder, { recursive: true, force: true });
    if (fs.existsSync(localSkillsDir)) fs.rmSync(localSkillsDir, { recursive: true, force: true });
  } catch {}

  console.log("\n=== PRUEBAS CONCLUIDAS ===");
}

runTests();
