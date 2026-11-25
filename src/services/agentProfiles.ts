import fs from "fs";
import path from "path";
import { config } from "../config/config.js";
import { dbService } from "../database/db.js";
import { driveMemoryService } from "./driveMemory.js";
import { llmService } from "./llm.js";
import { runGog } from "../tools/gogWrapper.js";

export type AgentNamespace = "coreagent" | "marketing" | "setter";

export interface CoreAgentProfile {
  configured: boolean;
  nombre: string;
  empresa: string;
  cargo: string;
  sector: string;
  objetivos: string;
  tono: string;
  zonaHoraria: string;
  firma: string;
  rawMarkdown: string;
}

export interface SetterBusinessProfile {
  configured: boolean;
  isSilvaniaPreset: boolean;
  senderName: string;
  companyName: string;
  roleTitle: string;
  offerSummary: string;
  valuePropShort: string;
  pricingRule: string;
  goalCta: string;
  calendarLinkOrFlow: string;
  tone: string;
  targetRoles: string[];
  preferredCities: string[];
  excludeKeywords: string[];
  objectionNoTime: string;
  objectionPrice: string;
  objectionTools: string;
  inviteTemplate: string;
  rawEmpresaMd: string;
  rawIcpMd: string;
  rawObjecionesMd: string;
}

export interface GuidedOnboardingSession {
  userId: number;
  agent: AgentNamespace;
  step: number; // 1..3, or 99 = awaiting confirmation of generated profile
  answers: string[];
  pendingTopicAfterSetup?: string;
  generatedFiles?: Record<string, string>;
  previewText?: string;
  updatedAt: number;
}

const onboardingSessions = new Map<number, GuidedOnboardingSession>();
const setterSyncTimestamp = new Map<number, number>();
const coreSyncTimestamp = new Map<number, number>();
const explicitBlankResetUsers = new Set<number>();
const DRIVE_SYNC_TTL_MS = 10 * 60 * 1000; // 10 min cache para respuesta instantánea en /setter y /perfil

export const BLANK_COREAGENT_TEMPLATE = `# Perfil y Objetivos del Usuario (CoreAgent)

Edita estos campos directamente o deja que CoreAgent los complete con tu permiso a medida que hablas con él.

- Nombre y trato preferido:
- Empresa o proyecto:
- Cargo / rol:
- Sector / actividad:
- Objetivos principales:
- Idioma y tono de respuesta:
- Zona horaria y horario habitual:
- Firma o datos de cierre para correos:
`;

export const BLANK_SETTER_EMPRESA_TEMPLATE = `# Empresa y Oferta (Setter IA)

Plantilla en blanco. Rellena los datos de TU negocio (o usa /setter config en Telegram para que la IA los redacte contigo de forma profesional).

- Nombre del remitente (quién firma los mensajes):
- Cargo del remitente:
- Nombre de la empresa / proyecto:
- Qué vendes y propuesta de valor en 1 frase:
- Servicio o producto principal (beneficios concretos):
- Regla de precios / prueba / diagnóstico:
- Objetivo al contactar (ej: reunión de 15 min, presupuesto, demo, llamada):
- Enlace web o calendario (si aplica):
`;

export const BLANK_SETTER_ICP_TEMPLATE = `# Cliente Ideal (ICP) y Exclusiones (Setter IA)

Plantilla en blanco. Define a quién buscar en LinkedIn y qué perfiles descartar automáticamente.

- Cargos / perfiles objetivo (separados por coma):
- Industrias / nichos prioritarios:
- Ciudades o zonas objetivo:
- Cargos o sectores a EXCLUIR (separados por coma):
- Dolor principal que resuelves a tu cliente:
`;

export const BLANK_SETTER_OBJECIONES_TEMPLATE = `# Objeciones, Notas y Tono (Setter IA)

Plantilla en blanco. Personaliza cómo responde tu Setter para que encaje 100% con tu negocio.

- Tono de conversación (ej: cercano entre colegas, ejecutivo directo, consultivo):
- Plantilla de nota de invitación (< 190 car., puedes usar [Nombre] y [Sector]):
- Respuesta si dice "No tengo tiempo":
- Respuesta si pregunta por el precio:
- Respuesta si dice "Ya trabajamos con otro / ya tengo herramienta":
- Reglas extra / qué NO decir nunca:
`;

function getLocalAgentDir(userId: number, agent: AgentNamespace): string {
  return path.join(process.cwd(), "data", `user_${userId}`, "agents", agent);
}

function readLocalFileSafe(filePath: string): string {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf8");
    }
  } catch {}
  return "";
}

function writeLocalFileSafe(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function splitBulletField(rawLine: string): { key: string; value: string } | null {
  const line = rawLine.trim();
  if (!line.startsWith("- ")) return null;
  let parenDepth = 0;
  for (let i = 2; i < line.length; i++) {
    const ch = line[i];
    if (ch === "(") parenDepth++;
    else if (ch === ")" && parenDepth > 0) parenDepth--;
    else if (ch === ":" && parenDepth === 0) {
      return {
        key: line.slice(2, i).trim(),
        value: line.slice(i + 1).trim(),
      };
    }
  }
  return null;
}

function parseBulletField(content: string, prefixes: string[]): string {
  const lines = (content || "").split(/\r?\n/);
  for (const rawLine of lines) {
    const parsed = splitBulletField(rawLine);
    if (!parsed || !parsed.value) continue;
    const key = parsed.key
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (prefixes.some((p) => key.includes(p))) {
      return parsed.value;
    }
  }
  return "";
}

function hasAnyFilledBullet(content: string): boolean {
  if (!content) return false;
  return content
    .split(/\r?\n/)
    .some((rawLine) => {
      const parsed = splitBulletField(rawLine);
      return Boolean(parsed && parsed.value.length > 0);
    });
}

function splitCsvField(val: string): string[] {
  if (!val) return [];
  return val
    .split(/[,;|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function listDriveFiles(userId: number, folderId: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const raw = await runGog(
      `drive search "'${folderId}' in parents and trashed = false" --raw-query --json`,
      userId
    );
    const parsed = JSON.parse(raw);
    const files = parsed.files || (Array.isArray(parsed) ? parsed : []);
    return files.map((f: any) => ({ id: String(f.id), name: String(f.name || "") }));
  } catch {
    return [];
  }
}

async function downloadDriveFile(userId: number, fileId: string, outPath: string): Promise<boolean> {
  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await runGog(`drive download ${fileId} --out="${outPath}"`, userId);
    return fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
  } catch {
    return false;
  }
}

async function ensureAndSyncMarkdownFile(
  userId: number,
  agent: AgentNamespace,
  fileName: string,
  blankTemplate: string,
  folderId: string | null,
  existingDriveFiles: Array<{ id: string; name: string }>
): Promise<string> {
  const localPath = path.join(getLocalAgentDir(userId, agent), fileName);
  const localContent = readLocalFileSafe(localPath);

  if (folderId) {
    const driveMatch = existingDriveFiles.find((f) => f.name.toLowerCase() === fileName.toLowerCase());
    if (driveMatch) {
      const tmpDown = `${localPath}.tmp`;
      const ok = await downloadDriveFile(userId, driveMatch.id, tmpDown);
      if (ok) {
        const remoteContent = readLocalFileSafe(tmpDown);
        try { fs.unlinkSync(tmpDown); } catch {}
        // Conservar remoto si tiene datos o si aún no había local
        if (hasAnyFilledBullet(remoteContent) || !localContent) {
          writeLocalFileSafe(localPath, remoteContent);
          return remoteContent;
        }
      }
    } else {
      const initialContent = localContent || blankTemplate;
      writeLocalFileSafe(localPath, initialContent);
      try {
        await driveMemoryService.uploadOrReplace(userId, localPath, fileName, folderId);
      } catch {}
      return initialContent;
    }
  }

  if (!localContent) {
    writeLocalFileSafe(localPath, blankTemplate);
    return blankTemplate;
  }
  return localContent;
}

export const agentProfilesService = {
  isAdminUser(userId: number): boolean {
    const admins = config.marketing?.adminIds || [1572946817];
    return admins.includes(userId);
  },

  wasExplicitlyResetToBlank(userId: number): boolean {
    return explicitBlankResetUsers.has(userId);
  },

  async ensureAgentFolderOnDrive(userId: number, agent: AgentNamespace): Promise<string | null> {
    if (!userId) return null;
    try {
      const token = await dbService.getUserToken(userId);
      if (!token) return null;
      const folderId = await driveMemoryService.getOrCreateFolderPath(["silvania", agent], userId);
      return folderId && folderId !== "root" ? folderId : null;
    } catch {
      return null;
    }
  },

  async saveAgentMarkdownFile(
    userId: number,
    agent: AgentNamespace,
    fileName: string,
    content: string
  ): Promise<{ localPath: string; driveFileId?: string; folderId?: string | null }> {
    const localPath = path.join(getLocalAgentDir(userId, agent), fileName);
    writeLocalFileSafe(localPath, content);

    let folderId: string | null = null;
    let driveFileId: string | undefined;
    try {
      folderId = await this.ensureAgentFolderOnDrive(userId, agent);
      if (folderId) {
        driveFileId = await driveMemoryService.uploadOrReplace(userId, localPath, fileName, folderId);
      }
    } catch (err: any) {
      console.warn(`⚠️ [AgentProfiles] No se pudo subir ${agent}/${fileName} a Drive:`, err?.message || err);
    }

    return { localPath, driveFileId, folderId };
  },

  // =========================================================================
  // 1. COREAGENT PROFILE (silvania/coreagent/perfil_y_objetivos.md)
  // =========================================================================

  async ensureCoreAgentStructure(userId: number, syncFromDrive: boolean = true): Promise<CoreAgentProfile> {
    const fileName = "perfil_y_objetivos.md";
    const localPath = path.join(getLocalAgentDir(userId, "coreagent"), fileName);
    let content = readLocalFileSafe(localPath);

    const lastSync = coreSyncTimestamp.get(userId) || 0;
    const isCacheHot = Boolean(content && Date.now() - lastSync < DRIVE_SYNC_TTL_MS);

    if (syncFromDrive && !isCacheHot) {
      const folderId = await this.ensureAgentFolderOnDrive(userId, "coreagent");
      const files = folderId ? await listDriveFiles(userId, folderId) : [];
      content = await ensureAndSyncMarkdownFile(
        userId,
        "coreagent",
        fileName,
        BLANK_COREAGENT_TEMPLATE,
        folderId,
        files
      );
      coreSyncTimestamp.set(userId, Date.now());
    } else if (!content) {
      content = BLANK_COREAGENT_TEMPLATE;
      writeLocalFileSafe(localPath, content);
    }

    return this.parseCoreAgentProfile(content);
  },

  parseCoreAgentProfile(content: string): CoreAgentProfile {
    const configured = hasAnyFilledBullet(content);
    return {
      configured,
      nombre: parseBulletField(content, ["nombre"]),
      empresa: parseBulletField(content, ["empresa", "proyecto"]),
      cargo: parseBulletField(content, ["cargo", "rol"]),
      sector: parseBulletField(content, ["sector", "actividad"]),
      objetivos: parseBulletField(content, ["objetivo"]),
      tono: parseBulletField(content, ["idioma", "tono"]),
      zonaHoraria: parseBulletField(content, ["zona horaria", "horario"]),
      firma: parseBulletField(content, ["firma"]),
      rawMarkdown: content,
    };
  },

  getCoreAgentProfilePromptBlock(userId: number): string {
    const localPath = path.join(getLocalAgentDir(userId, "coreagent"), "perfil_y_objetivos.md");
    const content = readLocalFileSafe(localPath);
    if (!content || !hasAnyFilledBullet(content)) return "";
    const parsed = this.parseCoreAgentProfile(content);
    const lines: string[] = [];
    if (parsed.nombre) lines.push(`- Nombre del usuario: ${parsed.nombre}`);
    if (parsed.empresa) lines.push(`- Empresa/Proyecto: ${parsed.empresa}`);
    if (parsed.cargo) lines.push(`- Cargo: ${parsed.cargo}`);
    if (parsed.sector) lines.push(`- Sector: ${parsed.sector}`);
    if (parsed.objetivos) lines.push(`- Objetivos en CoreAgent: ${parsed.objetivos}`);
    if (parsed.tono) lines.push(`- Idioma y tono: ${parsed.tono}`);
    if (parsed.zonaHoraria) lines.push(`- Zona horaria: ${parsed.zonaHoraria}`);
    if (parsed.firma) lines.push(`- Firma para correos: ${parsed.firma}`);
    if (lines.length === 0) return "";
    return (
      `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `## 👤 PERFIL DEL USUARIO (silvania/coreagent/perfil_y_objetivos.md)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${lines.join("\n")}\n`
    );
  },

  async updateCoreAgentProfileFields(
    userId: number,
    updates: Partial<Record<"nombre" | "empresa" | "cargo" | "sector" | "objetivos" | "tono" | "zonaHoraria" | "firma", string>>
  ): Promise<CoreAgentProfile> {
    const current = await this.ensureCoreAgentStructure(userId, false);
    const merged = {
      nombre: updates.nombre ?? current.nombre,
      empresa: updates.empresa ?? current.empresa,
      cargo: updates.cargo ?? current.cargo,
      sector: updates.sector ?? current.sector,
      objetivos: updates.objetivos ?? current.objetivos,
      tono: updates.tono ?? current.tono,
      zonaHoraria: updates.zonaHoraria ?? current.zonaHoraria,
      firma: updates.firma ?? current.firma,
    };

    const md =
      `# Perfil y Objetivos del Usuario (CoreAgent)\n\n` +
      `Edita estos campos directamente o desde Telegram con \`/perfil\`.\n\n` +
      `- Nombre y trato preferido: ${merged.nombre}\n` +
      `- Empresa o proyecto: ${merged.empresa}\n` +
      `- Cargo / rol: ${merged.cargo}\n` +
      `- Sector / actividad: ${merged.sector}\n` +
      `- Objetivos principales: ${merged.objetivos}\n` +
      `- Idioma y tono de respuesta: ${merged.tono}\n` +
      `- Zona horaria y horario habitual: ${merged.zonaHoraria}\n` +
      `- Firma o datos de cierre para correos: ${merged.firma}\n`;

    await this.saveAgentMarkdownFile(userId, "coreagent", "perfil_y_objetivos.md", md);
    return this.parseCoreAgentProfile(md);
  },

  // =========================================================================
  // 2. SETTER PROFILE (silvania/setter/{empresa_y_oferta,icp_y_exclusiones,objeciones_y_tono}.md)
  // =========================================================================

  async ensureSetterStructure(userId: number, syncFromDrive: boolean = true): Promise<SetterBusinessProfile> {
    const dir = getLocalAgentDir(userId, "setter");
    let emp = readLocalFileSafe(path.join(dir, "empresa_y_oferta.md"));
    let icp = readLocalFileSafe(path.join(dir, "icp_y_exclusiones.md"));
    let obj = readLocalFileSafe(path.join(dir, "objeciones_y_tono.md"));

    const now = Date.now();
    const lastSync = setterSyncTimestamp.get(userId) || 0;
    const isCacheHot = Boolean(emp && icp && obj && now - lastSync < DRIVE_SYNC_TTL_MS);

    if (syncFromDrive && !isCacheHot) {
      const folderId = await this.ensureAgentFolderOnDrive(userId, "setter");
      const files = folderId ? await listDriveFiles(userId, folderId) : [];
      emp = await ensureAndSyncMarkdownFile(userId, "setter", "empresa_y_oferta.md", BLANK_SETTER_EMPRESA_TEMPLATE, folderId, files);
      icp = await ensureAndSyncMarkdownFile(userId, "setter", "icp_y_exclusiones.md", BLANK_SETTER_ICP_TEMPLATE, folderId, files);
      obj = await ensureAndSyncMarkdownFile(userId, "setter", "objeciones_y_tono.md", BLANK_SETTER_OBJECIONES_TEMPLATE, folderId, files);
      setterSyncTimestamp.set(userId, Date.now());
    } else if (!emp || !icp || !obj) {
      if (!emp) {
        emp = BLANK_SETTER_EMPRESA_TEMPLATE;
        writeLocalFileSafe(path.join(dir, "empresa_y_oferta.md"), emp);
      }
      if (!icp) {
        icp = BLANK_SETTER_ICP_TEMPLATE;
        writeLocalFileSafe(path.join(dir, "icp_y_exclusiones.md"), icp);
      }
      if (!obj) {
        obj = BLANK_SETTER_OBJECIONES_TEMPLATE;
        writeLocalFileSafe(path.join(dir, "objeciones_y_tono.md"), obj);
      }
    }

    const parsed = this.parseSetterProfile(emp, icp, obj);
    // Para administradores existentes: si la carpeta está en blanco y no pidieron explícitamente resetear,
    // restaurar automáticamente su configuración previa de Silvania AI sin pedir configuración inicial.
    if (!parsed.configured && this.isAdminUser(userId) && !explicitBlankResetUsers.has(userId)) {
      return await this.loadSilvaniaSetterPreset(userId);
    }

    return parsed;
  },

  getCachedSetterProfile(userId: number): SetterBusinessProfile {
    const dir = getLocalAgentDir(userId, "setter");
    const emp = readLocalFileSafe(path.join(dir, "empresa_y_oferta.md")) || BLANK_SETTER_EMPRESA_TEMPLATE;
    const icp = readLocalFileSafe(path.join(dir, "icp_y_exclusiones.md")) || BLANK_SETTER_ICP_TEMPLATE;
    const obj = readLocalFileSafe(path.join(dir, "objeciones_y_tono.md")) || BLANK_SETTER_OBJECIONES_TEMPLATE;
    return this.parseSetterProfile(emp, icp, obj);
  },

  parseSetterProfile(emp: string, icp: string, obj: string): SetterBusinessProfile {
    const companyName = parseBulletField(emp, ["empresa", "proyecto"]);
    const offerSummary = parseBulletField(emp, ["servicio o producto", "beneficios", "que vendes"]);
    const configured = hasAnyFilledBullet(emp) || hasAnyFilledBullet(icp);
    const isSilvaniaPreset = /silvania/i.test(`${companyName} ${offerSummary}`) && /<!-- SILVANIA_PRESET -->/.test(emp);

    return {
      configured,
      isSilvaniaPreset,
      senderName: parseBulletField(emp, ["remitente"]),
      companyName,
      roleTitle: parseBulletField(emp, ["cargo del remitente"]),
      offerSummary: offerSummary || parseBulletField(emp, ["propuesta de valor"]),
      valuePropShort: parseBulletField(emp, ["propuesta de valor"]) || offerSummary,
      pricingRule: parseBulletField(emp, ["precios", "prueba", "diagnostico"]),
      goalCta: parseBulletField(emp, ["objetivo al contactar"]),
      calendarLinkOrFlow: parseBulletField(emp, ["enlace", "calendario", "web"]),
      tone: parseBulletField(obj, ["tono de conversacion"]),
      targetRoles: splitCsvField(parseBulletField(icp, ["cargos / perfiles objetivo", "perfiles objetivo"])),
      preferredCities: splitCsvField(parseBulletField(icp, ["ciudades", "zonas"])),
      excludeKeywords: splitCsvField(parseBulletField(icp, ["excluir"])),
      objectionNoTime: parseBulletField(obj, ["no tengo tiempo"]),
      objectionPrice: parseBulletField(obj, ["precio"]),
      objectionTools: parseBulletField(obj, ["ya trabajamos", "otra herramienta", "otro"]),
      inviteTemplate: parseBulletField(obj, ["plantilla de nota"]),
      rawEmpresaMd: emp,
      rawIcpMd: icp,
      rawObjecionesMd: obj,
    };
  },

  async loadSilvaniaSetterPreset(userId: number): Promise<SetterBusinessProfile> {
    const emp =
      `# Empresa y Oferta (Setter IA)\n<!-- SILVANIA_PRESET -->\n\n` +
      `- Nombre del remitente (quién firma los mensajes): Eduardo Quintero\n` +
      `- Cargo del remitente: Fundador de Silvania AI\n` +
      `- Nombre de la empresa / proyecto: Silvania AI (CoreAgent)\n` +
      `- Qué vendes y propuesta de valor en 1 frase: Asistente ejecutivo de IA en Telegram conectado a Google Workspace con permisos mínimos verificados por Google\n` +
      `- Servicio o producto principal (beneficios concretos): Gestiona Calendar, Gmail, Sheets y Drive por voz o texto en Telegram ahorrando hasta 2h diarias en administración\n` +
      `- Regla de precios / prueba / diagnóstico: Validación privada gratuita a cambio de feedback y testimonio (suscripción futura muy asequible para autónomos/pymes)\n` +
      `- Objetivo al contactar (ej: reunión de 15 min, presupuesto, demo, llamada): Conversación real entre colegas o demo de 10 minutos por Google Meet si muestran interés\n` +
      `- Enlace web o calendario (si aplica): https://silvania.ai\n`;

    const icp =
      `# Cliente Ideal (ICP) y Exclusiones (Setter IA)\n\n` +
      `- Cargos / perfiles objetivo (separados por coma): autonomos, asesores inmobiliarios, consultores, fundadores pyme, agentes comerciales\n` +
      `- Industrias / nichos prioritarios: inmobiliaria, servicios profesionales, consultoría, pymes\n` +
      `- Ciudades o zonas objetivo: España, Madrid, Valencia, Barcelona\n` +
      `- Cargos o sectores a EXCLUIR (separados por coma): multinacional, vice president, specification manager, enterprise\n` +
      `- Dolor principal que resuelves a tu cliente: Saltar entre 15 pestañas para agendar citas, facturar en Sheets y redactar correos estando en movilidad\n`;

    const obj =
      `# Objeciones, Notas y Tono (Setter IA)\n\n` +
      `- Tono de conversación (ej: cercano entre colegas, ejecutivo directo, consultivo): Cercano entre colegas/fundadores, cero robótico, sin pitch agresivo\n` +
      `- Plantilla de nota de invitación (< 190 car., puedes usar [Nombre] y [Sector]): Hola [Nombre], veo tu labor en [Sector]. Validamos Silvania, una IA en Telegram que ahorra horas en agenda y leads (acceso gratis por feedback). ¿Conectamos?\n` +
      `- Respuesta si dice "No tengo tiempo": Totalmente comprensible; justo por eso sirve para ahorrar 2h al día desde Telegram en 10 minutos de demo.\n` +
      `- Respuesta si pregunta por el precio: Estamos dando acceso de validación sin coste a profesionales para recoger feedback real.\n` +
      `- Respuesta si dice "Ya trabajamos con otro / ya tengo herramienta": No sustituye a tu Google Workspace actual; lo controla directamente desde Telegram con lenguaje natural.\n` +
      `- Reglas extra / qué NO decir nunca: Si otro fundador cuenta su proyecto en tono networking, responder a su contenido y NO soltar huecos de Meet ni pitch.\n`;

    explicitBlankResetUsers.delete(userId);
    await this.saveAgentMarkdownFile(userId, "setter", "empresa_y_oferta.md", emp);
    await this.saveAgentMarkdownFile(userId, "setter", "icp_y_exclusiones.md", icp);
    await this.saveAgentMarkdownFile(userId, "setter", "objeciones_y_tono.md", obj);
    setterSyncTimestamp.set(userId, Date.now());
    return this.parseSetterProfile(emp, icp, obj);
  },

  async resetSetterToBlank(userId: number): Promise<void> {
    explicitBlankResetUsers.add(userId);
    await this.saveAgentMarkdownFile(userId, "setter", "empresa_y_oferta.md", BLANK_SETTER_EMPRESA_TEMPLATE);
    await this.saveAgentMarkdownFile(userId, "setter", "icp_y_exclusiones.md", BLANK_SETTER_ICP_TEMPLATE);
    await this.saveAgentMarkdownFile(userId, "setter", "objeciones_y_tono.md", BLANK_SETTER_OBJECIONES_TEMPLATE);
    setterSyncTimestamp.set(userId, Date.now());
  },

  // =========================================================================
  // 3. ONBOARDING ESCALONADO Y REDACTOR PROFESIONAL IA
  // =========================================================================

  getActiveOnboarding(userId: number): GuidedOnboardingSession | undefined {
    const s = onboardingSessions.get(userId);
    if (!s) return undefined;
    if (Date.now() - s.updatedAt > 20 * 60 * 1000) {
      onboardingSessions.delete(userId);
      return undefined;
    }
    return s;
  },

  cancelOnboarding(userId: number): void {
    onboardingSessions.delete(userId);
  },

  startGuidedOnboarding(userId: number, agent: AgentNamespace, pendingTopicAfterSetup?: string): string {
    onboardingSessions.set(userId, {
      userId,
      agent,
      step: 1,
      answers: [],
      pendingTopicAfterSetup,
      updatedAt: Date.now(),
    });

    if (agent === "coreagent") {
      return (
        `👤 *Configuración rápida de tu Perfil (Paso 1 de 3)*\n\n` +
        `¿Cómo te llamas, cuál es tu **empresa o proyecto** y qué **cargo** tienes?\n` +
        `_(Puedes responder por texto o nota de voz. Si prefieres redactarlo luego, escribe "cancelar")._`
      );
    }

    if (agent === "marketing") {
      return (
        `🎨 *Configuración de tu Negocio en Marketing Studio (Paso 1 de 3)*\n\n` +
        `¿Cómo se llama tu **marca/empresa** y **qué vendes o impulsas** en una o dos frases?\n` +
        `_(También puedes mandarme una nota de voz explicándolo a tu manera y yo lo redacto profesional. Escribe "cancelar" para salir.)_`
      );
    }

    return (
      `🎯 *Configuración de tu Setter Comercial (Paso 1 de 3)*\n\n` +
      `Cuéntame con tus palabras: **¿cómo te llamas, qué empresa representas y qué producto o servicio quieres ofrecer?**\n` +
      `_(Si no sabes cómo expresarlo en B2B, explícamelo como te salga por texto o voz y yo lo redacto profesional. Escribe "cancelar" para salir.)_`
    );
  },

  async synthesizeProfessionalProfile(
    userId: number,
    agent: AgentNamespace,
    rawAnswers: string[]
  ): Promise<{ files: Record<string, string>; preview: string }> {
    const combinedInput = rawAnswers.join("\n---\n").trim();

    if (agent === "coreagent") {
      let data: any = {};
      try {
        const res = await llmService.chatSimple([
          {
            role: "system",
            content:
              "Extrae y redacta profesionalmente el perfil ejecutivo de un usuario en JSON puro sin markdown.",
          },
          {
            role: "user",
            content:
              `Respuestas del usuario:\n${combinedInput}\n\n` +
              `Devuelve JSON con exactamente las claves: nombre, empresa, cargo, sector, objetivos, tono, zonaHoraria, firma. Si falta alguna, deduce razonablemente o déjala vacía.`,
          },
        ]);
        const clean = String(res?.content || "{}").replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        data = JSON.parse(clean);
      } catch {
        data = { nombre: combinedInput.slice(0, 80), objetivos: rawAnswers[1] || "", tono: rawAnswers[2] || "Español profesional" };
      }

      const md =
        `# Perfil y Objetivos del Usuario (CoreAgent)\n\n` +
        `- Nombre y trato preferido: ${data.nombre || ""}\n` +
        `- Empresa o proyecto: ${data.empresa || ""}\n` +
        `- Cargo / rol: ${data.cargo || ""}\n` +
        `- Sector / actividad: ${data.sector || ""}\n` +
        `- Objetivos principales: ${data.objetivos || ""}\n` +
        `- Idioma y tono de respuesta: ${data.tono || "Español cercano y ejecutivo"}\n` +
        `- Zona horaria y horario habitual: ${data.zonaHoraria || "Europe/Madrid"}\n` +
        `- Firma o datos de cierre para correos: ${data.firma || ""}\n`;

      const preview =
        `👤 *Perfil CoreAgent preparado:*\n` +
        `• *Nombre:* ${data.nombre || "-"}\n` +
        `• *Empresa:* ${data.empresa || "-"} (${data.cargo || "-"})\n` +
        `• *Objetivos:* ${data.objetivos || "-"}\n` +
        `• *Tono:* ${data.tono || "Profesional"}`;

      return { files: { "perfil_y_objetivos.md": md }, preview };
    }

    if (agent === "marketing") {
      let data: any = {};
      try {
        const res = await llmService.chatSimple([
          {
            role: "system",
            content:
              "Eres Director de Marca y Copywriting B2B/B2C. Transformas explicaciones simples de cualquier negocio en una ficha profesional de Marketing Studio. Responde SOLO con JSON válido.",
          },
          {
            role: "user",
            content:
              `Datos dados por el usuario:\n${combinedInput}\n\n` +
              `Devuelve JSON con estas claves exactas:\n` +
              `{"marca":"...","sectorYValor":"...","slogan":"...","tono":"...","webOContacto":"...","redes":"...","reglasVideo":"..."}`,
          },
        ]);
        const clean = String(res?.content || "{}").replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        data = JSON.parse(clean);
      } catch {
        data = {
          marca: rawAnswers[0] || "Mi Negocio",
          sectorYValor: rawAnswers[1] || rawAnswers[0] || "",
          slogan: "",
          tono: "Profesional, claro y cercano",
          webOContacto: rawAnswers[2] || "",
          redes: "",
          reglasVideo: "Mostrar imágenes reales del negocio y subtítulos claros",
        };
      }

      const md =
        `# Marca y Reglas de Marketing\n\n` +
        `- Nombre de marca / negocio: ${data.marca || ""}\n` +
        `- Sector y propuesta de valor: ${data.sectorYValor || ""}\n` +
        `- Slogan o lema principal: ${data.slogan || ""}\n` +
        `- Tono de comunicación (ej: ejecutivo, cercano, inspirador): ${data.tono || ""}\n` +
        `- Web oficial / enlace principal: ${data.webOContacto || ""}\n` +
        `- Bot o WhatsApp de contacto: ${data.webOContacto || ""}\n` +
        `- Redes sociales: ${data.redes || ""}\n` +
        `- Reglas explícitas de vídeo e imágenes: ${data.reglasVideo || ""}\n`;

      const preview =
        `🎨 *Ficha de Marca redactada para Marketing Studio:*\n` +
        `• *Marca:* ${data.marca || "-"}\n` +
        `• *Propuesta de valor:* ${data.sectorYValor || "-"}\n` +
        `• *Slogan:* ${data.slogan || "-"}\n` +
        `• *Tono:* ${data.tono || "-"}\n` +
        `• *Contacto / CTA:* ${data.webOContacto || "-"}`;

      return { files: { "marca_y_reglas.md": md }, preview };
    }

    // SETTER
    let data: any = {};
    try {
      const res = await llmService.chatSimple([
        {
          role: "system",
          content:
            "Eres Director Comercial B2B y experto en Prospección en LinkedIn. A partir de lo que te cuente cualquier usuario (incluso de forma breve o informal), redactas su configuración completa de Setter comercial con tono natural humano (nada robótico ni vendedor barato). La nota de invitación DEBE tener menos de 190 caracteres e incluir [Nombre]. Responde SOLO con JSON válido.",
        },
        {
          role: "user",
          content:
            `Información del usuario:\n${combinedInput}\n\n` +
            `Devuelve JSON con exactamente estas claves:\n` +
            `{\n` +
            `  "remitente": "", "cargoRemitente": "", "empresa": "",\n` +
            `  "propuestaValor1Frase": "", "beneficiosPrincipales": "",\n` +
            `  "reglaPrecios": "", "objetivoContacto": "", "enlace": "",\n` +
            `  "cargosObjetivoCsv": "", "industriasCsv": "", "ciudadesCsv": "", "exclusionesCsv": "",\n` +
            `  "dolorCliente": "", "tono": "",\n` +
            `  "notaInvitacion": "Hola [Nombre], ... (<190 chars)",\n` +
            `  "objTiempo": "", "objPrecio": "", "objHerramientas": "", "reglasExtra": ""\n` +
            `}`,
        },
      ]);
      const clean = String(res?.content || "{}").replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      data = JSON.parse(clean);
    } catch {
      data = {
        remitente: "Equipo Comercial",
        cargoRemitente: "Dirección",
        empresa: rawAnswers[0] || "Nuestra Empresa",
        propuestaValor1Frase: rawAnswers[0] || "",
        beneficiosPrincipales: rawAnswers[1] || "",
        reglaPrecios: "Presupuesto o diagnóstico inicial sin compromiso",
        objetivoContacto: rawAnswers[2] || "Llamada o reunión breve de 15 minutos",
        cargosObjetivoCsv: rawAnswers[1] || "gerentes, directores, propietarios",
        ciudadesCsv: "España",
        exclusionesCsv: "practicante, estudiante",
        dolorCliente: "Falta de eficiencia y resultados",
        tono: "Cercano, profesional y consultivo",
        notaInvitacion: `Hola [Nombre], veo tu trabajo en [Sector]. Ayudamos desde ${rawAnswers[0]?.slice(0, 35) || "nuestro equipo"} a mejorar resultados. ¿Conectamos?`.slice(0, 190),
        objTiempo: "Son solo 10-15 minutos enfocados en tu caso real, sin rodeos.",
        objPrecio: "Se adapta al alcance de cada cliente; lo vemos sin compromiso en una breve charla.",
        objHerramientas: "Trabajamos complementando lo que ya tienes para darte resultados más rápidos.",
      };
    }

    const emp =
      `# Empresa y Oferta (Setter IA)\n\n` +
      `- Nombre del remitente (quién firma los mensajes): ${data.remitente || ""}\n` +
      `- Cargo del remitente: ${data.cargoRemitente || ""}\n` +
      `- Nombre de la empresa / proyecto: ${data.empresa || ""}\n` +
      `- Qué vendes y propuesta de valor en 1 frase: ${data.propuestaValor1Frase || ""}\n` +
      `- Servicio o producto principal (beneficios concretos): ${data.beneficiosPrincipales || ""}\n` +
      `- Regla de precios / prueba / diagnóstico: ${data.reglaPrecios || ""}\n` +
      `- Objetivo al contactar (ej: reunión de 15 min, presupuesto, demo, llamada): ${data.objetivoContacto || ""}\n` +
      `- Enlace web o calendario (si aplica): ${data.enlace || ""}\n`;

    const icp =
      `# Cliente Ideal (ICP) y Exclusiones (Setter IA)\n\n` +
      `- Cargos / perfiles objetivo (separados por coma): ${data.cargosObjetivoCsv || ""}\n` +
      `- Industrias / nichos prioritarios: ${data.industriasCsv || ""}\n` +
      `- Ciudades o zonas objetivo: ${data.ciudadesCsv || ""}\n` +
      `- Cargos o sectores a EXCLUIR (separados por coma): ${data.exclusionesCsv || ""}\n` +
      `- Dolor principal que resuelves a tu cliente: ${data.dolorCliente || ""}\n`;

    const obj =
      `# Objeciones, Notas y Tono (Setter IA)\n\n` +
      `- Tono de conversación (ej: cercano entre colegas, ejecutivo directo, consultivo): ${data.tono || ""}\n` +
      `- Plantilla de nota de invitación (< 190 car., puedes usar [Nombre] y [Sector]): ${String(data.notaInvitacion || "").slice(0, 190)}\n` +
      `- Respuesta si dice "No tengo tiempo": ${data.objTiempo || ""}\n` +
      `- Respuesta si pregunta por el precio: ${data.objPrecio || ""}\n` +
      `- Respuesta si dice "Ya trabajamos con otro / ya tengo herramienta": ${data.objHerramientas || ""}\n` +
      `- Reglas extra / qué NO decir nunca: ${data.reglasExtra || "No hacer pitch agresivo ni ofrecer agenda si el contacto solo hace networking"}\n`;

    const preview =
      `🎯 *Configuración Profesional Redactada para tu Setter IA:*\n\n` +
      `• *Empresa / Remitente:* ${data.empresa || "-"} (${data.remitente || "-"})\n` +
      `• *Propuesta de valor:* ${data.propuestaValor1Frase || "-"}\n` +
      `• *Cliente ideal (ICP):* ${data.cargosObjetivoCsv || "-"}\n` +
      `• *Objetivo CTA:* ${data.objetivoContacto || "-"}\n` +
      `• *Nota LinkedIn (${String(data.notaInvitacion || "").length}/198 car.):* _"${String(data.notaInvitacion || "").slice(0, 190)}"_\n` +
      `• *Tono:* ${data.tono || "-"}`;

    return {
      files: {
        "empresa_y_oferta.md": emp,
        "icp_y_exclusiones.md": icp,
        "objeciones_y_tono.md": obj,
      },
      preview,
    };
  },

  async handleOnboardingStep(
    userId: number,
    userText: string
  ): Promise<{
    handled: boolean;
    replyText?: string;
    confirmButtonPrefix?: string;
    finishedAndSaved?: boolean;
    pendingTopic?: string;
  }> {
    const session = this.getActiveOnboarding(userId);
    if (!session) return { handled: false };

    const clean = userText.trim();
    if (/^(cancelar|salir|stop|omitir)$/i.test(clean)) {
      onboardingSessions.delete(userId);
      return {
        handled: true,
        replyText: `👌 Configuración cancelada. Puedes retomarla cuando quieras con \`/${session.agent === "coreagent" ? "perfil" : session.agent + " config"}\`.`,
      };
    }

    if (session.step === 99) {
      // Si el usuario escribe ajustes en lugar de pulsar botón, regenerar incorporando su corrección
      session.answers.push(`Ajuste pedido por el usuario: ${clean}`);
      session.updatedAt = Date.now();
      const { files, preview } = await this.synthesizeProfessionalProfile(userId, session.agent, session.answers);
      session.generatedFiles = files;
      session.previewText = preview;
      return {
        handled: true,
        replyText: `${preview}\n\n¿Lo guardo así en tu Google Drive?`,
        confirmButtonPrefix: `onb_confirm_${session.agent}`,
      };
    }

    session.answers.push(clean);
    session.updatedAt = Date.now();

    // Si en el paso 1 ya dio una descripción rica o pide explícitamente que la IA lo redacte, saltar directo a síntesis
    const asksAutoDraft = /hazlo\s*t[uú]|no\s*s[eé]|red[aá]ctalo|ay[uú]dame/i.test(clean) && clean.length > 25;
    if (session.step >= 3 || (session.step === 1 && (clean.length > 140 || asksAutoDraft))) {
      const { files, preview } = await this.synthesizeProfessionalProfile(userId, session.agent, session.answers);
      session.step = 99;
      session.generatedFiles = files;
      session.previewText = preview;
      return {
        handled: true,
        replyText: `${preview}\n\n¿Confirmas que guarde esta configuración en \`silvania/${session.agent}/\`? _(Si quieres cambiar algún dato, escríbemelo directamente.)_`,
        confirmButtonPrefix: `onb_confirm_${session.agent}`,
      };
    }

    session.step += 1;

    if (session.agent === "coreagent") {
      if (session.step === 2) {
        return {
          handled: true,
          replyText: `✅ Anotado *(Paso 2 de 3)*.\n\n¿Cuáles son tus **principales objetivos** usando el asistente (ej. organizar agenda, automatizar correos, facturas en Sheets, seguimiento comercial)?`,
        };
      }
      return {
        handled: true,
        replyText: `✅ Perfecto *(Paso 3 de 3)*.\n\n¿En qué **idioma, tono y zona horaria** prefieres que trabaje y firme tus correos?`,
      };
    }

    if (session.agent === "marketing") {
      if (session.step === 2) {
        return {
          handled: true,
          replyText: `✅ Genial *(Paso 2 de 3)*.\n\n¿Quién es tu **público objetivo** y con qué **tono** quieres comunicar (ej. cercano, lujo sobrio, técnico, directo)?`,
        };
      }
      return {
        handled: true,
        replyText: `✅ Último paso *(Paso 3 de 3)*.\n\n¿Qué **web, WhatsApp o llamada a la acción (CTA)** quieres incluir cuando hagamos contenido promocional?`,
      };
    }

    // SETTER
    if (session.step === 2) {
      return {
        handled: true,
        replyText: `✅ Anotado *(Paso 2 de 3)*.\n\n¿A qué **clientes ideales (cargos/negocios)** quieres buscar, en qué **ciudad** y qué **problema principal** les resuelves?`,
      };
    }
    return {
      handled: true,
      replyText: `✅ Muy bien *(Paso 3 de 3)*.\n\n¿Qué **objetivo** buscas cuando te respondan (reunión de 15 min, llamada, enviar presupuesto, enlace web) y qué **rango de precios o prueba** ofreces?`,
    };
  },

  async confirmOnboardingAndSave(userId: number): Promise<{ saved: boolean; agent?: AgentNamespace; pendingTopic?: string }> {
    const session = onboardingSessions.get(userId);
    if (!session || !session.generatedFiles) return { saved: false };

    if (session.agent === "marketing") {
      const content = session.generatedFiles["marca_y_reglas.md"];
      if (content) {
        // Guardar en silvania/marketing/marca_y_reglas.md donde ya lee brandDriveAssets!
        const localPath = path.join(getLocalAgentDir(userId, "marketing"), "marca_y_reglas.md");
        writeLocalFileSafe(localPath, content);
        const { brandDriveAssets } = await import("../marketing/services/brandDriveAssets.js");
        const folders = await brandDriveAssets.ensureBrandDriveStructure(userId);
        if (folders) {
          await driveMemoryService.uploadOrReplace(userId, localPath, "marca_y_reglas.md", folders.rootFolderId);
        }
      }
    } else {
      for (const [fileName, fileContent] of Object.entries(session.generatedFiles)) {
        await this.saveAgentMarkdownFile(userId, session.agent, fileName, fileContent);
      }
      if (session.agent === "setter") {
        explicitBlankResetUsers.delete(userId);
        setterSyncTimestamp.set(userId, Date.now());
      } else if (session.agent === "coreagent") {
        coreSyncTimestamp.set(userId, Date.now());
      }
    }

    const pendingTopic = session.pendingTopicAfterSetup;
    const agent = session.agent;
    onboardingSessions.delete(userId);
    return { saved: true, agent, pendingTopic };
  },
};
