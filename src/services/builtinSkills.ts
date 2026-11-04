import fs from "fs";
import path from "path";
import { config } from "../config/config.js";

export interface BuiltinSkillDef {
  name: string;
  folderName: string;
  description: string;
  content: string;
}

const BUILTIN_DIR = path.resolve("skills", "_builtin");

export const BUILTIN_SKILL_NAMES = new Set(["factura-pro", "investigacion-empresarial", "coreagent-guia"]);

export function isBuiltinSkill(nameOrFolder: string): boolean {
  if (!nameOrFolder) return false;
  const norm = nameOrFolder.trim().toLowerCase().replace(/[^a-zA-Z0-9-]/g, "");
  return BUILTIN_SKILL_NAMES.has(norm);
}

/**
 * Genera la sección fija de capacidades built-in para el System Prompt del agente.
 * Se inyecta SIEMPRE en cada turno en memoria local sin depender de Google Drive.
 */
export function getBuiltinSkillsPromptSection(extraUserSkillsSummary?: string): string {
  let section = `## 🧬 Skills / capacidades de sistema (built-in)
Estas capacidades operativas están SIEMPRE activas e integradas en el agente (disponibles en runtime sin depender de Drive):

• **factura-pro**: Si el usuario pide crear, emitir o preparar una factura o plantilla con IVA (ej. 21%): es ESTRICTAMENTE OBLIGATORIO usar \`sheets_create_invoice\` (o la tool de factura existente). Está terminantemente prohibido usar \`sheets_write\` celda a celda o \`sheets_create\` como sustituto.
• **investigacion-empresarial**: Si el usuario pide investigar una empresa, profesional, negocio o sitio web: usar \`web_search\` y \`read_url\`. Separar estrictamente en el informe: **✅ DATOS VERIFICADOS (con fuente real)** vs **⚠️ NO ENCONTRADO / PENDIENTE DE CONFIRMAR**. Obligatorio nombrar y listar las Redes Sociales oficiales con su enlace directo (si no hay, declarar 'Redes sociales no encontradas'). Si no se encuentran fichas o enlaces directos de localización en Maps, Páginas Amarillas o informes de solvencia mercantil, indicar explícitamente 'Enlaces adicionales no encontrados' (o detallar los no encontrados). CERO URLs inventadas.
• **coreagent-guia**: Scopes reales y acotados de Google Workspace (\`drive.file\`, \`gmail.send\`, \`calendar.events\`, \`spreadsheets\`). NUNCA prometer leer la bandeja de entrada de Gmail (sin scope de lectura de inbox) ni archivos ajenos a la carpeta \`silvania/\` en Google Drive.`;

  if (extraUserSkillsSummary && extraUserSkillsSummary.trim().length > 0) {
    section += `\n\n**Skills extra del usuario en Drive:**\n${extraUserSkillsSummary.trim()}`;
  }

  return section;
}

export const BUILTIN_SKILLS: BuiltinSkillDef[] = [
  {
    name: "factura-pro",
    folderName: "factura-pro",
    description: "Flujo profesional de emisión y registro de facturas con desglose de IVA y totales mediante sheets_create_invoice.",
    content: `---
name: factura-pro
description: Flujo profesional de emisión y registro de facturas con desglose de IVA y totales mediante sheets_create_invoice.
---

# Factura Pro (Silvania CoreAgent)

## Descripción
Esta habilidad establece el flujo obligatorio para la generación y emisión de facturas profesionales o plantillas de factura estructuradas con cálculo automático de IVA y totales en Google Sheets.

## Cuándo Usarla
Úsala siempre que el usuario solicite:
- "Crea una factura para [cliente]"
- "Genera una factura con IVA"
- "Emite una factura de [monto/servicio]"
- "Plantilla de factura"

## Instrucciones Paso a Paso para el Agente
1. **Herramienta Obligatoria:** Si el usuario solicita una factura o plantilla de factura, es ESTRICTAMENTE OBLIGATORIO usar \`sheets_create_invoice\`. Está prohibido usar \`sheets_create\` para facturas.
2. **Parámetros:**
   - \`title\`: Título claro en formato \`Factura_<Número/Cliente>\`.
   - \`number\`: Número de factura correlativo si el usuario lo indica (por defecto "001").
   - \`date\`: Fecha de emisión si se especifica (por defecto fecha actual).
   - \`locale\`: "es" (España, IVA 21%) o "en" según el idioma solicitado.
3. **Cálculo y Organización:** La herramienta creará automáticamente la hoja en la carpeta canónica \`silvania/\` del Drive del usuario, con desglose de Base Imponible, IVA y Total.
4. **Respuesta al Usuario:**
   - Si la herramienta devuelve un error, informa al usuario claramente y no afirmes que la factura fue creada.
   - Si tiene éxito, entrega el enlace en una sola línea Markdown limpia: \`[Título](URL_EDIT)\`.
   - Si el usuario pide después el enlace a la factura, usa el mismo \`SPREADSHEET_ID\` sin llamar a \`sheets_list\`.

## Entregables
Hoja de cálculo en Google Sheets organizada en \`silvania/\` con la estructura oficial de factura profesional.
`
  },
  {
    name: "investigacion-empresarial",
    folderName: "investigacion-empresarial",
    description: "Protocolo riguroso de investigación corporativa y prospección en tiempo real usando web_search y read_url sin URLs inventadas, con redes sociales y enlaces adicionales verificados.",
    content: `---
name: investigacion-empresarial
description: Protocolo riguroso de investigación corporativa, análisis empresarial y prospección en tiempo real usando web_search y read_url sin URLs inventadas, con análisis de actividad, resumen de web, contactos, redes sociales y enlaces adicionales verificados.
---

# Protocolo de Investigación Empresarial Real (Silvania CoreAgent)

## Descripción
Esta habilidad establece el protocolo operativo obligatorio para investigar empresas, negocios locales y entidades corporativas utilizando herramientas reales (\`web_search\` y \`read_url\`).

## Cuándo Usarla
Úsala siempre que el usuario solicite:
- "Investiga la empresa X" o "Investiga X.com / X.ai"
- "Investiga con protocolo a X"
- "A qué se dedica X, qué servicios ofrece o resumen de su web"
- "Busca datos de contacto, web o dirección de X"
- "Prospección o informe corporativo de X"

## Reglas Críticas Anti-Alucinación y de Transparencia (OBLIGATORIAS)
1. **Detección de Dominio en Consulta:** Si el usuario escribe un dominio (ej: "Silvania.ai", "mercadona.es") o una URL directa, DEBES llamar prioritariamente a \`read_url\` sobre ese dominio oficial ("https://silvania.ai") para inspeccionar su sitio web real.
2. **Análisis y Resumen Empresarial Obligatorio:** Toda investigación debe explicar con claridad:
   - A qué se dedica la empresa y cuál es su actividad principal o sector.
   - Qué productos, catálogo o servicios ofrece.
   - Su modelo de negocio, público objetivo o propuesta de valor según lo publicado en su web oficial.
3. **PROHIBIDO inventar URLs o datos:** Nunca crees enlaces de Google Maps (tipo \`/place/...\`), Páginas Amarillas, Informa o perfiles sociales si no han sido devueltos directamente por \`web_search\` o extraídos con \`read_url\`.
4. **Extracción Exhaustiva de Datos de Contacto:** Es obligatorio recopilar y listar todos los datos de contacto verificados:
   - Email(s) corporativos o de atención al cliente.
   - Teléfono(s) fijos, móviles y WhatsApp directo.
   - Dirección física, sede corporativa o polígono industrial y código postal.
   - Razón social y CIF/NIF (si es público o figura en el aviso legal).
   - Enlace directo a la página de contacto oficial (si existe).
5. **Redes Sociales Obligatorias:** Es obligatorio buscar, identificar y listar las redes sociales disponibles de la empresa (LinkedIn, Instagram, Facebook, Twitter/X, YouTube, etc.) con sus enlaces Markdown directos. Si no se encuentra ninguna red social oficial en la web ni en la búsqueda, debes indicar explícitamente:
   \`📱 Redes sociales: No encontradas\`.
6. **Enlaces y Datos Adicionales (Maps, Directorios y Solvencia):**
   - Si se localizan las fichas directas reales (localización en Google Maps, ficha en Páginas Amarillas, informe de solvencia en Informa/Registro Mercantil), deben incluirse obligatoriamente.
   - Si NO se encuentran estas fichas o datos directos, es OBLIGATORIO indicar:
     \`⚠️ Enlaces adicionales no encontrados\` (o detallar individualmente: \`📍 Google Maps: Ficha directa no encontrada\`, \`📒 Páginas Amarillas: Ficha directa no encontrada\`, \`🏢 Solvencia / Informa: Ficha directa no encontrada\`, adjuntando los enlaces de consulta de directorios correspondientes).
7. **Estructura Obligatoria del Informe:** Debes estructurar el informe separando claramente:
   - **🏢 ANÁLISIS Y RESUMEN EMPRESARIAL (Web Oficial)**
   - **✅ DATOS CORPORATIVOS Y DE CONTACTO VERIFICADOS**
   - **📱 REDES SOCIALES DISPONIBLES (o "Redes sociales no encontradas")**
   - **🚀 ENLACES Y DIRECTORIOS ADICIONALES (o "Enlaces adicionales no encontrados")**
   - **⚠️ NO ENCONTRADO / PENDIENTE DE CONFIRMAR**

## Pasos de Ejecución para el Agente
1. **Detección Directa o Búsqueda:** Si el usuario aporta un dominio o URL (ej: "Silvania.ai"), llama a \`read_url\` sobre él directamente. Si aporta solo un nombre comercial (ej: "Mercadona"), ejecuta \`web_search\`.
2. **Lectura Obligatoria de la Web Oficial:** En cuanto localices el dominio oficial de la empresa, ejecuta \`read_url\` sobre esa URL. Extrae actividad principal, servicios, razón social, CIF si figura, dirección física real, teléfono, correo electrónico y **redes sociales oficiales**.
3. **Informe Estructurado:** Devuelve el informe con las secciones requeridas.

## Entregables
Informe empresarial contrastado con fuentes reales entregado en el chat y/o guardado en Drive.
`
  },
  {
    name: "coreagent-guia",
    folderName: "coreagent-guia",
    description: "Guía de capacidades, herramientas reales y límites operativos de Silvania CoreAgent bajo scopes acotados.",
    content: `---
name: coreagent-guia
description: Guía de capacidades, herramientas reales y límites operativos de Silvania CoreAgent bajo scopes acotados.
---

# Guía Operativa de Silvania CoreAgent

## Descripción
Esta habilidad proporciona las directrices oficiales sobre lo que Silvania CoreAgent puede y no puede hacer bajo sus scopes acotados y política de privacidad estricta.

## Cuándo Usarla
Úsala siempre que el usuario pregunte:
- "¿Qué puedes hacer?" o "¿Qué herramientas tienes?"
- "¿Cómo funciona mi privacidad o qué datos ves?"
- "¿Puedes leer mis correos o mis archivos privados?"
- Preguntas sobre límites de Google Workspace o configuración de cuenta.

## Capacidades Reales (Scopes Acotados Oficiales)
1. 📁 **Google Drive (\`drive.file\`):**
   - Acceso acotado exclusivamente a la carpeta \`silvania/\` y archivos creados por el agente.
   - **Límite estricto:** NO lee, modifica ni accede al resto de archivos privados ajenos a Silvania en el Drive del usuario.
2. ✉️ **Gmail (\`gmail.send\`):**
   - Redacción y envío directo de correos bajo orden expresa y confirmación del usuario.
   - **Límite estricto:** NO lee la bandeja de entrada ni correos privados (cero permisos de lectura de inbox).
3. 📅 **Google Calendar (\`calendar.events\`):**
   - Consulta, creación, actualización y cancelación de eventos y reuniones en la agenda del usuario.
4. 📊 **Google Sheets (\`spreadsheets\`):**
   - Creación y mantenimiento de hojas de cálculo, registros y facturas con IVA (\`sheets_create_invoice\`).
5. 🌐 **Navegación Web (\`web_search\`, \`read_url\`):**
   - Búsqueda de información en internet e inspección en vivo de sitios web en tiempo real.

## Directrices de Respuesta para el Agente
- Explicar siempre con total transparencia los alcances y límites de privacidad.
- Nunca prometer acciones fuera de los scopes acotados (ej. no prometer buscar en emails recibidos de la bandeja personal).
- Proponer alternativas viables con las herramientas reales activas.
`
  }
];

/**
 * Obtiene el contenido de una skill built-in desde disco si existe o desde el fallback en memoria.
 */
export function getBuiltinSkill(folderName: string): BuiltinSkillDef | null {
  const found = BUILTIN_SKILLS.find(s => s.folderName === folderName);
  if (!found) return null;

  const diskSkillMd = path.join(BUILTIN_DIR, folderName, "SKILL.md");
  if (fs.existsSync(diskSkillMd)) {
    try {
      const diskContent = fs.readFileSync(diskSkillMd, "utf8");
      return { ...found, content: diskContent };
    } catch {}
  }

  return found;
}

/**
 * Realiza el seed de las 3 habilidades built-in hacia la cuenta actual en Google Drive.
 * Se ejecuta si la carpeta silvania/skills de la cuenta está vacía y SEED_BUILTIN_SKILLS es true.
 * Garantiza:
 * - NUNCA copia habilidades experimentales de lab (rrhh-*, agente-*, prospeccion-*, test-*, taller-*, etc.).
 * - Si falla, no arroja excepción ni envía alertas críticas; retorna el conteo de éxitos.
 */
export async function seedBuiltinSkillsToDrive(userId: number): Promise<number> {
  if (config.skills?.seedBuiltin === false) {
    console.log(`ℹ️ [Builtin Skills] SEED_BUILTIN_SKILLS=false. Omitiendo seed para usuario ${userId}.`);
    return 0;
  }

  const { uploadSkillToDrive, getUserSkillsDir } = await import("../tools/skills.js");
  console.log(`🌱 [Builtin Skills] Iniciando seed de catálogo built-in (máximo 3 skills) para usuario ${userId}...`);
  const userSkillsDir = getUserSkillsDir(userId);
  let seededCount = 0;

  for (const skill of BUILTIN_SKILLS) {
    try {
      const targetDir = path.join(userSkillsDir, skill.folderName);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const targetSkillMd = path.join(targetDir, "SKILL.md");
      const skillDef = getBuiltinSkill(skill.folderName) || skill;
      fs.writeFileSync(targetSkillMd, skillDef.content, "utf8");

      // Subir al Drive de la cuenta actual
      const uploaded = await uploadSkillToDrive(userId, skill.folderName, targetDir);
      if (uploaded) {
        seededCount++;
        console.log(`✅ [Builtin Skills] Skill built-in '${skill.folderName}' seedeada con éxito en Drive para usuario ${userId}.`);
      } else {
        console.warn(`⚠️ [Builtin Skills] No se pudo subir '${skill.folderName}' a Drive durante seed (almacenada localmente).`);
      }
    } catch (err: any) {
      console.warn(`⚠️ [Builtin Skills] Error al seedear '${skill.folderName}' para usuario ${userId}:`, err.message);
    }
  }

  console.log(`🌱 [Builtin Skills] Seed finalizado para usuario ${userId}: ${seededCount}/${BUILTIN_SKILLS.length} skills subidas a Drive.`);
  return seededCount;
}

