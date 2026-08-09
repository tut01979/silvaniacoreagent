import { createSkill, loadSkill } from "../src/tools/skills.js";
import fs from "fs";
import path from "path";

async function runTests() {
  console.log("=== INICIANDO PRUEBAS DE CREACIÓN PROACTIVA Y MULTITAREA ===");
  const userId = 999999;
  const localSkillsDir = path.join(process.cwd(), "skills", userId.toString());

  if (fs.existsSync(localSkillsDir)) {
    fs.rmSync(localSkillsDir, { recursive: true, force: true });
  }

  // 1. Proactividad en creación de skills sin instrucciones explícitas
  console.log("\n1. Probando creación de skill sin 'content' (instrucciones opcionales)...");
  const skillName = "rrhh-perfil-contratacion";
  const skillDesc = "Genera un perfil de contratación detallado para el departamento de RRHH basado en el puesto y el área.";

  const resultMsg = await createSkill(skillName, skillDesc, undefined, userId);
  console.log("-> Mensaje resultado:", resultMsg);

  const skillFilePath = path.join(localSkillsDir, "rrhh-perfil-contratacion", "SKILL.md");
  const existsLocal = fs.existsSync(skillFilePath);
  console.log(`-> SKILL.md creado: ${existsLocal ? "✅ PASÓ" : "❌ FALLÓ"}`);

  if (existsLocal) {
    const writtenContent = fs.readFileSync(skillFilePath, "utf8");
    console.log("-> Contenido generado:\n", writtenContent);
    const hasHeader = writtenContent.includes("name: rrhh-perfil-contratacion") && writtenContent.includes("description:");
    const hasStep = writtenContent.includes("1. Analizar la solicitud");
    const hasSections = writtenContent.includes("## Descripción") && writtenContent.includes("## Entregables");
    console.log(`-> Posee frontmatter correcto: ${hasHeader ? "✅ PASÓ" : "❌ FALLÓ"}`);
    console.log(`-> Posee secciones obligatorias: ${hasSections ? "✅ PASÓ" : "❌ FALLÓ"}`);
    console.log(`-> Posee pasos de ejecución por defecto: ${hasStep ? "✅ PASÓ" : "❌ FALLÓ"}`);
  }

  // 2. Limpieza de datos temporales
  try {
    if (fs.existsSync(localSkillsDir)) {
      fs.rmSync(localSkillsDir, { recursive: true, force: true });
    }
  } catch {}

  console.log("\n=== PRUEBAS CONCLUIDAS ===");
}

runTests();
