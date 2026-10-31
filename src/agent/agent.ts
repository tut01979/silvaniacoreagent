import { llmService } from "../services/llm.js";
import { executeTool, loadSkillsSummary } from "../tools/index.js";
import { dbService } from "../database/db.js";
import { userContextStore } from "../services/context.js";
import { parseUserTasks, formatTaskSummary } from "../services/taskParser.js";
import { shouldTriggerMultitask } from "../services/multitaskFilter.js";
import fs from "fs";
import path from "path";
import { isBetaUser, getGoogleCredentials } from "../services/authHelper.js";
import { config } from "../config/config.js";

const MAX_ITERATIONS = 10;

/**
 * Calcula con precisión matemática el calendario de referencia de los próximos 7 días
 * y el offset horario real en Europe/Madrid (evita desfases de cambio de hora y errores de fechas relativas).
 */
export function getMadridRelativeCalendar(baseDate: Date = new Date()): { calendarText: string; offsetStr: string; todayIso: string; nowStr: string } {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Europe/Madrid",
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short"
  };
  const nowStr = baseDate.toLocaleString("es-ES", options);

  const madridFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  });
  const parts = madridFormatter.format(baseDate).split(", ");
  const [yyyy, mm, dd] = parts[0].split("-").map(Number);
  const timeStr = parts[1] || "12:00:00";

  const tzParts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", timeZoneName: "shortOffset" }).formatToParts(baseDate);
  const tzName = tzParts.find(p => p.type === "timeZoneName")?.value || "GMT+2";
  let offsetStr = "+02:00";
  const offsetMatch = tzName.match(/([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (offsetMatch) {
    const sign = offsetMatch[1];
    const hours = offsetMatch[2].padStart(2, "0");
    const mins = offsetMatch[3] || "00";
    offsetStr = `${sign}${hours}:${mins}`;
  }

  const todayIso = `${parts[0]}T${timeStr}${offsetStr}`;

  const rows: string[] = [];
  const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  for (let i = 0; i <= 7; i++) {
    const targetDate = new Date(Date.UTC(yyyy, mm - 1, dd + i, 12, 0, 0));
    const targetYyyy = targetDate.getUTCFullYear();
    const targetMm = String(targetDate.getUTCMonth() + 1).padStart(2, "0");
    const targetDd = String(targetDate.getUTCDate()).padStart(2, "0");
    const dayOfWeek = dayNames[targetDate.getUTCDay()];
    const isoDate = `${targetYyyy}-${targetMm}-${targetDd}`;

    let label = "";
    if (i === 0) label = " (HOY)";
    else if (i === 1) label = " (MAÑANA)";
    else if (i === 2) label = " (PASADO MAÑANA)";

    rows.push(`  - ${dayOfWeek.toUpperCase()}${label}: ${isoDate}`);
  }

  const calendarText = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 CALENDARIO DE REFERENCIA OBLIGATORIO (Europe/Madrid):\n` +
    rows.join("\n") +
    `\n  Offset horario oficial: ${offsetStr}` +
    `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  return { calendarText, offsetStr, todayIso, nowStr };
}

export async function runAgent(userId: number, userMessage: string) {
  return userContextStore.run({ userId }, async () => {
    // 0. Enrutamiento estricto por producto / canal (/marketing, /campaña, /eva)
    const trimmedMsg = userMessage.trim();
    if (trimmedMsg.startsWith("/marketing") || trimmedMsg.startsWith("/campaña") || trimmedMsg.startsWith("/campana")) {
      const parts = trimmedMsg.split(/\s+/);
      const isPost = parts[0].toLowerCase() === "/marketing" && parts[1]?.toLowerCase() === "post";
      
      let mktReply = "";
      if (trimmedMsg === "/marketing") {
        mktReply = "🚀 **Silvania Marketing Studio (Omnicanal & Low-Cost)**\n\n" +
          "Uso del comando:\n" +
          "• `/campaña [tema]` o `/marketing campaña [tema]` - Genera el pack omnicanal completo.\n" +
          "• `/marketing video [youtube] [tema]` - Vídeo 16:9 extendido.\n" +
          "• `/marketing short [tiktok] [tema]` - Vídeo vertical 9:16 ágil.\n" +
          "• `/marketing post [linkedin|x|telegram] [tema]` - Post adaptado a la red con imagen y audio.\n" +
          "• `/marketing draft [coreagent|eva|marketing]` - Borrador diario rotativo HITL.\n" +
          "• `/marketing status` - Consulta el estado del último borrador.";
      } else if (isPost && parts.length <= 2) {
        mktReply = "⚠️ **Silvania Marketing Studio:** Por favor indica el tema después del subcomando. Ejemplo: `/marketing post linkedin mi tema` o `/marketing post Mi nuevo producto`";
      } else if (isPost) {
        const topic = parts.slice(2).join(" ").trim();
        mktReply = `🧠 **Silvania Marketing Studio:** Solicitud de post recibida para _${topic}_.\nProcesando mediante el flujo HITL de Marketing Studio.`;
      } else {
        mktReply = `🚀 **Silvania Marketing Studio:** Comando de marketing recibido (${parts[0]}). Silvania Marketing Studio gestiona esta tarea con supervisión Human-in-the-Loop.`;
      }

      await dbService.addMessage(userId, "user", userMessage);
      await dbService.addMessage(userId, "assistant", mktReply);
      return mktReply;
    }

    const lowerTrimmed = trimmedMsg.toLowerCase();
    if (
      lowerTrimmed === "/eva" ||
      lowerTrimmed.startsWith("/eva ") ||
      lowerTrimmed.startsWith("/eva_") ||
      lowerTrimmed === "eva" ||
      lowerTrimmed.includes("jugar con eva") ||
      lowerTrimmed.includes("hablar con eva") ||
      lowerTrimmed.includes("ejercicio de logopedia")
    ) {
      const evaReply =
        `🗣️ **Eva — Logopedia y Entrenamiento de Voz Infantil y Familiar**\n\n` +
        `Eva es la entrenadora de voz y logopedia interactiva de Silvania, diseñada con estricta privacidad para menores y familias: cuenta con **0 scopes de Google** (no accede a correos de Gmail ni archivos de Drive de menores).\n\n` +
        `El roleplay interactivo, las aventuras de pronunciación y los ejercicios fonéticos funcionan exclusivamente en su plataforma web:\n` +
        `👉 https://silvania.ai/eva\n` +
        `🌐 Landing informativa: https://silvania.ai/eva-landing`;
      await dbService.addMessage(userId, "user", userMessage);
      await dbService.addMessage(userId, "assistant", evaReply);
      return evaReply;
    }

    // Sincronizar memoria desde Google Drive a caché local si corresponde en segundo plano o si no hay historial local
    try {
      const hasLocal = dbService.hasLocalHistory(userId);
      if (!hasLocal) {
        console.log(`ℹ️ [Agent] Primera interacción o caché vacía. Sincronizando historial de Drive de forma síncrona.`);
        const { driveMemoryService } = await import("../services/driveMemory.js");
        await driveMemoryService.syncFromDrive(userId);
      } else {
        console.log(`ℹ️ [Agent] Historial local existente. Lanzando sincronización de Drive en segundo plano.`);
        import("../services/driveMemory.js")
          .then(({ driveMemoryService }) => driveMemoryService.syncFromDrive(userId))
          .catch(err => console.error("Error en syncFromDrive en segundo plano:", err.message));
      }
    } catch (err: any) {
      console.error("Error al iniciar sincronización de Drive:", err.message);
    }

    // 1. Guardar mensaje del usuario
    await dbService.addMessage(userId, "user", userMessage);

    // 1.b Onboarding / Fast-path para saludo y presentación de nombre (ej. "hola soy Eduardo")
    const introducedName = extractUserNameIntroduction(userMessage);
    if (introducedName) {
      await saveUserPreferredName(userId, introducedName);
    }

    if (!hasTaskOrQuestionIntent(userMessage)) {
      if (introducedName && userMessage.trim().split(/\s+/).length <= 14) {
        const shortIntroReply = `¡Hola, ${introducedName}! Encantado de saludarte, ya he anotado tu nombre.\n¿En qué te puedo ayudar hoy?`;
        await dbService.addMessage(userId, "assistant", shortIntroReply);
        return shortIntroReply;
      }

      if (isPureShortGreeting(userMessage)) {
        const savedName = introducedName || (await getUserPreferredName(userId));
        const shortGreetingReply = savedName
          ? `¡Hola, ${savedName}! ¿En qué te puedo ayudar hoy?`
          : `¡Hola! ¿En qué te puedo ayudar hoy?`;
        await dbService.addMessage(userId, "assistant", shortGreetingReply);
        return shortGreetingReply;
      }
    }

    // Obtener estado real de conexión de Google
    const email = await dbService.getUserEmail(userId);
    const token = await dbService.getUserToken(userId);
    const isLinked = !!token;
    const googleStatusStr = isLinked
      ? `Estado Google: VINCULADO (${email || "email desconocido"})`
      : `Estado Google: NO VINCULADO`;

    // Intercepción prioritaria: si el usuario pide el enlace a la hoja/factura recién creada, usar el último spreadsheetId de la sesión (NO sheets_list)
    const asksRecentSheetLink =
      !/\b(crea|crear|nueva|nuevo|genera|generar|haz|hacer|añade|añadir|escribe|escribir|modifica|modificar)\b/i.test(userMessage) &&
      (
        /\b(enlace|link|url)\b.*\b(sheet|sheets|hoja|factura|excel|tabla)\b/i.test(userMessage) ||
        /\b(sheet|sheets|hoja|factura|excel|tabla)\b.*\b(enlace|link|url)\b/i.test(userMessage) ||
        /\b(el\s+enlace\s+no\s+es\s+v[aá]lido|no\s+funciona\s+el\s+enlace|p[aá]same\s+el\s+enlace|dame\s+el\s+enlace|dame\s+el\s+link|pasa\s+el\s+link)\b/i.test(userMessage)
      );

    if (asksRecentSheetLink) {
      const recentHistory = await dbService.getHistory(userId, 10);
      const lastSheet = await getLastSessionSpreadsheet(userId, recentHistory);
      if (lastSheet) {
        const singleLineMarkdown = `[${lastSheet.title}](${lastSheet.url})`;
        await dbService.addMessage(userId, "assistant", singleLineMarkdown);
        return singleLineMarkdown;
      }
    }

    // Intercepción de ruteo rápido para enlaces directos de Google si ya está vinculado
    if (isLinked) {
      const cleanMsg = userMessage.toLowerCase().trim();
      const hasEmailOrUrl = /@|https?:\/\//i.test(cleanMsg);
      const hasActionVerb = /\b(envia|envía|enviame|envíame|enviar|envies|envíes|manda|mandame|mándame|mandar|mandes|redacta|redactar|escribe|escribir|lee|leelo|léelo|leer|explica|explicame|explícame|explicar|resume|resumir|adjunta|adjuntar|busca|buscar|encuentra|crea|crear|borra|eliminar|mueve|mover|lista|listar|sube|subir|descarga|descargar|factura|transcripcion|transcripción|analiza|analizar|revisa|revisar|mira|mirar|abrir y|abre y)\b/i.test(cleanMsg);

      if (!hasEmailOrUrl && !hasActionVerb && !/\b(auth|vincular|conectar|cambiar)\b/i.test(cleanMsg)) {
        const hasDrive = /\b(drive|disco)\b/i.test(cleanMsg);
        const hasCalendar = /\b(calendar|calendario|agenda|reunion|reuniones)\b/i.test(cleanMsg);
        const hasGmail = /\b(gmail|correo|mail|inbox|bandeja)\b/i.test(cleanMsg);
        const hasSheets = /\b(sheets|hojas|excel|spreadsheets)\b/i.test(cleanMsg);
        
        // Solo si explícitamente pide el acceso/link/url general del servicio o es el nombre exacto de la herramienta
        const isExplicitLinkRequest = /\b(enlace|link|url|acceso|acceder|ir a|entrar a|dirección|direccion|dame el link|pasa el link|donde esta|dónde está)\b/i.test(cleanMsg) || 
          /^(drive|gmail|calendar|sheets|inbox)$/i.test(cleanMsg);
        
        if (isExplicitLinkRequest && (hasDrive || hasCalendar || hasGmail || hasSheets)) {
          const parts: string[] = [];
          if (hasDrive) parts.push(`📁 **Google Drive:** https://drive.google.com/drive/my-drive`);
          if (hasGmail) parts.push(`✉️ **Gmail:** https://mail.google.com/mail/u/0/#inbox`);
          if (hasCalendar) parts.push(`📅 **Google Calendar:** https://calendar.google.com/calendar/u/0/`);
          if (hasSheets) parts.push(`📊 **Google Sheets:** https://docs.google.com/spreadsheets/`);
          
          if (parts.length > 0) {
            const finalContent = `Aquí tienes tus accesos directos oficiales:\n\n${parts.join("\n")}`;
            await dbService.addMessage(userId, "assistant", finalContent);
            
            import("../services/driveMemory.js")
              .then(({ driveMemoryService }) => driveMemoryService.syncToDrive(userId))
              .catch(err => console.error("Error al guardar memoria en Drive (ruteo rápido intercepción):", err.message));
              
            return finalContent;
          }
        }
      }
    }

    // Parsear tareas si cumple con los criterios de multitarea, de lo contrario procesar como una única tarea
    const tasks = shouldTriggerMultitask(userMessage)
      ? await parseUserTasks(userMessage)
      : [userMessage];

    // 2. Obtener resumen de habilidades instaladas (filtrado por usuario)
    const skillsSummary = await loadSkillsSummary(userId);

    // Runtime Google OAuth Tier y Scopes
    const userIsBeta = isBetaUser(userId);
    const userTier: "beta" | "prod" = userIsBeta ? "beta" : "prod";
    const creds = getGoogleCredentials(userId);
    const effectiveScopes = creds?.scopes || (userIsBeta ? config.oauth.betaScopes : config.oauth.prodScopes);

    // Detección proactiva en producción para peticiones de lectura/listado de Gmail (scope insuficiente)
    if (userTier === "prod") {
      const asksGmailRead = /(?:lista|listar|busca|buscar|lee|leer|muestra|mostrar|ver|mira|mirar|qu[eé]\s+hay|tengo|consultar)\s+(?:mis\s+|los\s+)?(?:correos|emails|mails|mensajes|bandeja|inbox)/i.test(userMessage) ||
                            /^(?:mis\s+)?(?:correos|emails|mails|mensajes|bandeja)(?:\s+recibidos|\s+de\s+hoy)?\??$/i.test(userMessage.trim());
      const asksGmailSend = /(?:envia|envía|mandar|manda|redacta|escribe)\s+(?:un\s+)?(?:correo|email|mail|mensaje)/i.test(userMessage);

      if (asksGmailRead && !asksGmailSend) {
        console.log(`🔒 [Agent Guard] Petición de lectura de Gmail en Tier Producción detectada ("${userMessage}"). Devolviendo limitación oficial.`);
        const prodNotice = "⚠️ **Permisos de Gmail limitados (Tier Producción):** En tu plan actual Silvania cuenta únicamente con permisos mínimos verificados de envío (`gmail.send`) para proteger la privacidad de tu correspondencia. No disponemos de permisos para listar, buscar o leer los correos de tu bandeja de entrada.\n\n" +
                           "✉️ Si lo deseas, puedes pedirme que **redacte y envíe un correo** nuevo en tu nombre, o bien acceder directamente a tu bandeja de entrada en [Gmail](https://mail.google.com/mail/u/0/#inbox).";
        await dbService.addMessage(userId, "assistant", prodNotice);
        return prodNotice;
      }
    }

    // Inspección de Memoria Activa
    const userSkillsDir = path.resolve("skills", userId.toString());
    let installedSkillNames: string[] = [];
    if (fs.existsSync(userSkillsDir)) {
      try {
        installedSkillNames = fs.readdirSync(userSkillsDir).filter(f => {
          try { return fs.statSync(path.join(userSkillsDir, f)).isDirectory(); } catch { return false; }
        });
      } catch {}
    }
    const userFolder = path.join(process.cwd(), "data", `user_${userId}`);
    const localConfigPath = path.join(userFolder, "config.json");
    if (installedSkillNames.length === 0 && fs.existsSync(localConfigPath)) {
      try {
        const conf = JSON.parse(fs.readFileSync(localConfigPath, "utf8"));
        if (Array.isArray(conf.installedSkills)) {
          installedSkillNames = conf.installedSkills;
        }
      } catch {}
    }

    const localTemasDir = path.join(process.cwd(), "data", `user_${userId}`, "temas");
    let temasList: string[] = [];
    if (fs.existsSync(localTemasDir)) {
      try {
        temasList = fs.readdirSync(localTemasDir)
          .filter(f => f.endsWith(".json"))
          .map(f => f.replace(".json", ""));
      } catch {}
    }

    const localSummaryPath = path.join(process.cwd(), "data", `user_${userId}`, "memoria_conversacion.json");
    let hasDriveSummary = false;
    let summaryExcerpt = "No hay resumen previo registrado aún";
    if (fs.existsSync(localSummaryPath)) {
      try {
        const sumData = JSON.parse(fs.readFileSync(localSummaryPath, "utf8"));
        if (sumData.summary && sumData.summary.trim()) {
          hasDriveSummary = true;
          summaryExcerpt = sumData.summary.length > 200 ? sumData.summary.substring(0, 197) + "..." : sumData.summary;
        }
        if (Array.isArray(sumData.topics) && temasList.length === 0) {
          temasList = sumData.topics;
        }
      } catch {}
    }

    const currentHistory = await dbService.getHistory(userId);
    const todayMsgCount = currentHistory.length;

    // 3. Fecha y hora actual y calendario relativo verificado para contexto del agente
    const now = new Date();
    const { calendarText, offsetStr, todayIso: isoLocal, nowStr } = getMadridRelativeCalendar(now);

    const googleToolsStr = userTier === "prod"
      ? `\`gmail_send\`, \`drive_list\`, \`drive_search\`, \`drive_mkdir\`, \`drive_move\`, \`drive_upload\`, \`drive_remove\`, \`drive_create_text_file\`, \`drive_read_file\`, \`calendar_list\`, \`calendar_create\`, \`calendar_delete\`, \`calendar_update\`, \`sheets_list\`, \`sheets_create\`, \`sheets_read\`, \`sheets_write\`, \`sheets_append\`, \`sheets_create_invoice\``
      : `\`gmail_list\`, \`gmail_search\`, \`gmail_thread\`, \`gmail_send\`, \`drive_list\`, \`drive_search\`, \`drive_mkdir\`, \`drive_move\`, \`drive_upload\`, \`drive_remove\`, \`drive_create_text_file\`, \`drive_read_file\`, \`calendar_list\`, \`calendar_create\`, \`calendar_delete\`, \`calendar_update\`, \`sheets_list\`, \`sheets_create\`, \`sheets_read\`, \`sheets_write\`, \`sheets_append\`, \`sheets_create_invoice\`, \`google_workspace\``;

    const gmailHandlingStr = userTier === "prod"
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MANEJO DE GMAIL (TIER PRODUCCIÓN - SOLO ENVÍO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- EN TU PLAN ACTUAL SOLO ESTÁ HABILITADO EL ENVÍO DE CORREOS (gmail.send).
- Para enviar correos: destinatario + contenido. Llama DIRECTAMENTE a la herramienta \`gmail_send\`.
- REGLA ESTRICTA DE ENVÍO: Si el usuario te pide enviar un correo ("envía el correo a...", "envíalo tú", "mándalo ya"), DEBES ejecutar la herramienta \`gmail_send\` de inmediato.
- PROHIBICIÓN ABSOLUTA DE LECTURA / LISTADO: NO tienes herramientas ni permisos para listar correos ni leer la bandeja de entrada. Si el usuario te pide "lista mis correos", "busca correos", "mira mis emails" o "qué correos tengo":
  1. Explica que en tu tier de producción Silvania cuenta con permisos de solo envío (gmail.send) por privacidad.
  2. Proporciona el enlace directo a su bandeja: https://mail.google.com/mail/u/0/#inbox.
  3. ESTÁ ESTRICTAMENTE PROHIBIDO inventar correos ficticios o simular la lectura.`
      : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MANEJO DE GMAIL (TIER BETA - LECTURA Y ENVÍO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Para listar correos: remitente, fecha, categoría, enlace usando \`gmail_list\`.
- Para buscar correos: usa \`gmail_search\` con filtros.
- Para leer correos: cuerpo completo usando \`gmail_thread\`.
- Para enviar correos: destinatario + contenido usando \`gmail_send\`.
- Nunca inventes correos ni enlaces.`;

    // 4. Configurar System Prompt
    const systemPrompt = `Eres Silvania CoreAgent, el asistente ejecutivo modular de Silvania.ai que opera desde Telegram.
Silvania.ai es una plataforma SaaS multi-usuario de agentes de inteligencia artificial con estricta separación de productos.

⏰ FECHA Y HORA ACTUAL: ${nowStr}
Formato ISO local: ${isoLocal}
Zona horaria: Europe/Madrid (${offsetStr}). Usa estas fechas y offset para crear eventos o calcular fechas. NO llames a get_current_time.

${calendarText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 IDENTIDAD DEL AGENTE (SILVANIA COREAGENT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Canal Oficial: Telegram (@silvaniacorebot).
- Rol Principal: Asistente ejecutivo y operativo personal/corporativo para Google Workspace y ejecución de skills instaladas.
- Actúas exclusivamente bajo instrucciones explícitas del usuario.
- Nunca actúas de forma autónoma, nunca inventas datos ni enlaces falsos.
- REGLA DE ONBOARDING (PROHIBIDO REPETIR EL PITCH DE /start):
  * Si el usuario saluda o se presenta con su nombre (ej. "hola soy Eduardo"), reconócelo por su nombre en 1-2 líneas y pregúntale en qué puedes ayudarle. NUNCA repitas la presentación de capacidades de /start.
  * Si el usuario trae directamente una tarea ("crea evento...", "factura..."), ejecuta de inmediato la herramienta correspondiente sin soltar presentaciones.
- SEPARACIÓN ESTRICTA DE PRODUCTOS SILVANIA:
  1. NO ERES MARKETING STUDIO: Silvania cuenta con **Silvania Marketing Studio** como producto independiente para creación de campañas omnicanal (YouTube, TikTok, LinkedIn, X, Telegram) con flujo HITL (Human-in-the-Loop) mediante los comandos /marketing y /campaña. NO hables como agencia publicitaria ni ofrezcas redactar o inventar posts de marketing en CoreAgent; indica al usuario que use /marketing o /campaña.
  2. NUNCA ERES EVA NI ADOPTAS SU PERSONALIDAD: Silvania cuenta con **Eva** (https://silvania.ai/eva) como entrenadora de voz y logopedia interactiva en el navegador para niños y familias, con estricta privacidad y 0 scopes de Google. En Telegram (CoreAgent) está ESTRICTAMENTE PROHIBIDO adoptar la personalidad de Eva ("Soy Eva... La Granja", animales, fonemas, etc.) o iniciar mundos y ejercicios de logopedia. Si el usuario te habla de Eva o ejercicios infantiles en Telegram, responde únicamente con la explicación institucional breve de qué es Eva, su política de privacidad (0 scopes de Google) y los enlaces https://silvania.ai/eva y https://silvania.ai/eva-landing. El roleplay de Eva vive exclusivamente en la web /eva.
  3. VERTICALES (EJ. TALLER MECÁNICO, ASESORÍA): Las verticales son capas de prompts, flujos y skills especializadas instaladas SOBRE CoreAgent en silvania/skills/. No son bots separados ni cambian tu identidad base ejecutiva ni duplican OAuth.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 ESTADO GOOGLE Y PERMISOS EFECTIVOS (TIER: ${userTier.toUpperCase()})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Estado de Conexión: ${isLinked ? `VINCULADO (${email || "email desconocido"})` : "NO VINCULADO"}
- Tier OAuth Actual: [${userTier.toUpperCase()}] ${userIsBeta ? "(Usuario Beta con scopes ampliados)" : "(Usuario de Producción con scopes mínimos aprobados)"}
- Scopes Efectivos Autorizados: ${effectiveScopes}
${userTier === "prod" ? `
⚠️ REGLAS OBLIGATORIAS TIER PRODUCCIÓN:
1. LO QUE SÍ PUEDES HACER EN PROD:
   - Google Calendar: Crear, consultar, modificar y eliminar eventos en el calendario (calendar.events).
   - Google Sheets: Crear, leer y editar hojas de cálculo y facturas en silvania/ (spreadsheets).
   - Google Drive: Gestionar archivos propios de la aplicación bajo la carpeta silvania/ (drive.file).
   - Gmail: EXCLUSIVAMENTE ENVÍO de correos electrónicos mediante la herramienta gmail_send (gmail.send).
2. LO QUE ESTRICTAMENTE NO PUEDES HACER EN PROD (LÍMITES NO NEGOCIABLES):
   - ESTRICTAMENTE PROHIBIDO intentar listar correos, buscar correos o leer mensajes/hilos de Gmail (no dispones de scopes gmail.readonly ni gmail.modify ni de herramientas para ello).
   - ESTRICTAMENTE PROHIBIDO listar el disco personal completo del usuario (no dispones de scope drive global).
3. PROTOCOLO ANTE PETICIONES OUT-OF-SCOPE EN PROD:
   - Si el usuario te pide: "lista mis correos", "busca correos", "mira mi bandeja de entrada", "lee mis emails recibidos":
     * Explícale con total claridad y amabilidad que en el tier de Producción Silvania opera con permisos mínimos aprobados por Google (solo envío con gmail.send, sin lectura de correspondencia privada por seguridad).
     * Ofrécele el enlace directo oficial a su bandeja: https://mail.google.com/mail/u/0/#inbox.
     * NUNCA inventes correos, remitentes, asuntos ni simules llamadas.` : `
ℹ️ REGLAS TIER BETA:
- Usuario en lista blanca con permisos ampliados. Dispones de herramientas para listar, buscar y leer hilos de Gmail (gmail_list, gmail_search, gmail_thread) y acceso global a Drive.`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MEMORIA ACTIVA Y CONTEXTO CARGADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Memoria Persistente (Google Drive): ${hasDriveSummary ? "Activa (cargada / sincronizada en silvania/)" : "Inicial (sin resumen previo registrado aún)"}
- Resumen de Conversaciones Previas: ${summaryExcerpt}
- Temas Estructurados Guardados: ${temasList.length} tema(s) ${temasList.length > 0 ? `[${temasList.join(", ")}]` : "(ninguno registrado aún)"}
- Skills Instaladas Disponibles: ${installedSkillNames.length} habilidad(es) [${installedSkillNames.join(", ")}]
- Historial de la Sesión de Hoy (${now.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })}): ${todayMsgCount} mensaje(s) intercambiado(s)
- Estado de Configuración: Cargada desde Google Drive y sincronizada localmente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 REGLA ABSOLUTA DE HERRAMIENTAS Y TIERS (ANTI-ALUCINACIÓN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. No ofrezcas herramientas que no estén en la lista de tools de este turno.
2. Si el usuario pide algo fuera de tu tier o de tu lista de herramientas (ej: lectura de correos en prod): explica de forma transparente la limitación y proporciona la alternativa oficial (enlace oficial o "no disponible en tu plan/tier"), sin alucinar herramientas ni simular resultados.
3. Si el usuario te pregunta "¿tienes memoria?" o "¿qué skills hay?": responde basándote exactamente en la sección de MEMORIA ACTIVA Y CONTEXTO CARGADO de arriba.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 REGLAS ESTRICTAS ANTI-ALUCINACIÓN Y ENLACES (OBLIGATORIA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NUNCA INVENTES identificadores (\`fileId\`, \`messageId\`, \`folderId\`) ni enlaces de Google Drive (\`drive.google.com/drive/folders/...\`) o Gmail (\`#inbox/...\`).
2. SOLO puedes proporcionar enlaces específicos o IDs que hayan sido devueltos EXPLÍCITAMENTE por una herramienta (\`drive_list\`, \`drive_search\`, \`gmail_list\`, \`web_search\`, \`read_url\`, \`calendar_create\`, \`calendar_update\`, \`calendar_list\`) en esta conversación, o las URLs oficiales raíz canónicas:
   - Drive: https://drive.google.com/drive/my-drive
   - Gmail: https://mail.google.com/mail/u/0/#inbox
   - Calendar: https://calendar.google.com/calendar/u/0/
   - Sheets: https://docs.google.com/spreadsheets/
   - Web oficial: https://silvania.ai
3. Si una herramienta no devolvió un enlace directo o ID para un elemento, o la búsqueda no arrojó resultados, indícalo con honestidad ("Enlace directo no disponible" o "No encontrado"). NUNCA fabriques URLs simuladas.
4. ESTRICTAMENTE PROHIBIDO inventar URLs de Google Maps (\`google.com/maps/place/...\`), Páginas Amarillas (\`paginasamarillas.es/...\`), e-Informa o directorios empresariales. Solo se permiten enlaces web que provengan textualmente de los resultados de \`web_search\` o \`read_url\`.
5. ESTRICTAMENTE PROHIBIDO emitir fragmentos de código o pseudo-llamadas a herramientas como \`print(gmail_list(...))\`, \`print(web_search(...))\`, o \`tools.drive_list\`. Ejecuta las herramientas exclusivamente mediante function calling; NUNCA imprimas pseudo-llamadas en el texto de cara al usuario.
6. PROTOCOLO DE INVESTIGACIÓN EMPRESARIAL:
   - Al investigar empresas, autónomos o sitios web, ejecuta búsquedas reales con \`web_search\` y consulta páginas relevantes con \`read_url\`.
   - Divide la respuesta obligatoriamente en dos bloques:
     * **Datos Verificados**: solo lo confirmado directamente por las herramientas, citando las fuentes/URLs reales encontradas.
     * **No Encontrado / Pendiente de Verificación**: aspectos que no pudieron verificarse de manera fidedigna (ej. si no hay CIF, teléfono comprobado o ficha oficial). Jamás inventes datos.
7. Si el usuario pide explícitamente "enlace de autorización", "vincular Google", "conectar cuenta", "cambiar de cuenta" o "/auth": DEBES llamar obligatoriamente a la herramienta \`generate_authorization_link\`. NUNCA inventes enlaces de autorización ni utilices otros client_id ajenos al sistema.
8. Si el usuario ya vinculó su cuenta o te indica frases como "ya lo vinculé", "inténtalo ahora", "prueba ahora", "reintenta", o solicita una acción ejecutiva (ej. "crea la reunión", "lista mis eventos", "envía el correo"): ESTÁ ESTRICTAMENTE PROHIBIDO volver a llamar a \`generate_authorization_link\` o pedir autorización. Debes proceder INMEDIATAMENTE a ejecutar la acción solicitada llamando a la herramienta correspondiente (\`calendar_create\`, \`gmail_send\`, \`drive_list\`, etc.). Solo si una herramienta devuelve expresamente un error de sesión expirada ('invalid_grant', 'unauthorized_client'), ofrecerás reconectar.
9. CONFIRMACIÓN Y ENLACES DE GMAIL (\`gmail_send\`):
   - Tras \`gmail_send\`, la respuesta al usuario DEBE incluir SIEMPRE en una línea el enlace Markdown completo con el asunto/título del correo: \`[Asunto del correo](https://mail.google.com/mail/u/0/#inbox/{id})\` utilizando el Message ID real devuelto por la herramienta. Prohibido dejar solo la palabra "Abrir" o el título sin URL.
   - ESTRICTAMENTE PROHIBIDO emitir la palabra "Abrir" o "🔗 Abrir" sin su correspondiente hipervínculo en formato Markdown válido o con href vacío. Nunca escribas "Abrir" suelto sin enlace.
10. GESTIÓN DE EVENTOS, ASISTENTES Y ENLACES DE GOOGLE CALENDAR (\`calendar_create\`, \`calendar_update\`):
   - Al crear eventos (\`calendar_create\`): si el usuario menciona a alguien (ej: "con ana@ejemplo.com", "invita a carlos@empresa.com"), pásalo obligatoriamente en el parámetro \`attendees: ["correo@ejemplo.com"]\`. La herramienta enviará automáticamente la invitación por correo (\`sendUpdates=all\`).
   - Al invitar a eventos existentes o actualizarlos (\`calendar_update\`): si el usuario pide "añade a X a la reunión", "invita a X", "comparte el evento con X", etc.: ESTÁ ESTRICTAMENTE PROHIBIDO decir que es imposible o que no se puede invitar a un evento ya creado. Debes ejecutar de inmediato \`calendar_update\` con el \`event_id\` y \`attendees: ["correo@ejemplo.com"]\`.
   - REUTILIZACIÓN DE IDs (PROHIBIDO INVENTAR): Si acabas de crear un evento en este turno o en el anterior, REUTILIZA exactamente el \`ID\` devuelto por \`calendar_create\` o \`calendar_list\`. NUNCA inventes identificadores.
   - ENLACE DIRECTO COMPLETO: Tras \`calendar_create\` o \`calendar_update\`, la respuesta al usuario DEBE incluir SIEMPRE en una línea el enlace Markdown completo con el título del evento: \`[Título del evento](url_https_completa)\` utilizando el \`htmlLink\` real devuelto por la herramienta (ej: \`https://www.google.com/calendar/event?eid=...\`). Prohibido dejar solo la palabra "Abrir" o el título sin URL.
11. RESOLUCIÓN DE FECHAS RELATIVAS (EUROPE/MADRID):
   - Consulta OBLIGATORIAMENTE la tabla "CALENDARIO DE REFERENCIA OBLIGATORIO" de arriba antes de definir fechas y horas para el calendario.
   - Si el usuario dice "lunes", localiza la fila correspondiente a "LUNES" en la tabla. Si hoy es domingo 25/10/2026, el lunes siguiente es INVARIABLEMENTE 2026-10-26 (NO 2026-10-27).
   - "mañana" es siempre la fila marcada como (MAÑANA).
   - Utiliza siempre el offset horario oficial indicado en la tabla (ej: ${offsetStr}) en las fechas ISO de inicio y fin.
12. LECTURA Y ANÁLISIS DE DOCUMENTOS / PDFS (REGLA DURA ANTI-ALUCINACIÓN):
   - Cuando el usuario solicite leer, analizar, consultar o resumir un archivo, documento o PDF por su ID (ej. 1lwnmyCvSwjvjpHtXlvNCFWohThg9VLaj) o nombre: DEBES llamar obligatoriamente a la herramienta de lectura (\`analyze_document\` o \`drive_read_file\`) en el turno actual con dicho \`file_id\`.
   - El contenido del documento SOLO y EXCLUSIVAMENTE puede proceder del resultado devuelto por dicha herramienta en el turno actual para ese ID específico.
   - PROHIBICIÓN ABSOLUTA DE MEZCLAR O RELLENAR CON HISTORIAL PREVIO: Está TERMINANTEMENTE PROHIBIDO inventar el contenido o rellenarlo utilizando resúmenes o memorias de documentos anteriores del historial de conversación (ej. autos judiciales de Valencia, resoluciones, contratos o facturas de otros turnos o temas). Cada archivo es único y estanco.
   - Si la herramienta falla, no encuentra el archivo o devuelve un error/vacío: responde taxativamente "No pude leer el archivo [ID]: [motivo/error devuelto por la herramienta]". NUNCA inventes su contenido ni supongas de qué trata basándote en memoria previa.
13. ENLACES Y GESTIÓN DE GOOGLE SHEETS (LIBROS Y PARTES DE TALLER):
   - Si el usuario te pide "enlace al sheet", "pásame el link de la hoja", "dónde está el archivo", o el enlace a un parte o registro: DEBES utilizar OBLIGATORIAMENTE el \`spreadsheetId\` real devuelto por la herramienta en el turno actual o en el historial (\`https://docs.google.com/spreadsheets/d/{spreadsheetId}/edit\`).
   - ESTÁ ESTRICTAMENTE PROHIBIDO responder con la URL raíz genérica https://docs.google.com/spreadsheets/ o decir "Abrir en Google Sheets" sin enlace Markdown real.
   - Libro canónico \`Taller_Partes\`: para partes de taller mecánico existe UN ÚNICO libro canónico en la carpeta \`silvania/\`. Está estrictamente prohibido crear hojas duplicadas; utiliza \`sheets_append\` (o \`sheets_write\`) para añadir filas al libro canónico existente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🌐 CAPACIDADES DE NAVEGACIÓN WEB E INVESTIGACIÓN (OBLIGATORIO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Tu plataforma y web materna oficial es https://silvania.ai.
2. Tienes herramientas de navegación e investigación web en tiempo real:
   - \`read_url\`: Para entrar y leer directamente el contenido completo de cualquier sitio web, página o dominio (incluyendo https://silvania.ai).
   - \`web_search\`: Para buscar información en internet, noticias y negocios locales.
3. Está ESTRICTAMENTE PROHIBIDO que respondas con excusas como:
   - "Soy un modelo de lenguaje y no puedo entrar en la web / no puedo navegar"
   - "No tengo web materna"
   - "No puedo acceder a silvania.ai"
4. Si el usuario te pide entrar, leer, consultar o investigar cualquier web, URL o dominio (ej. "silvania.ai", "entra a la web...", "lee esta url..."), DEBES llamar INMEDIATAMENTE a \`read_url\` o \`web_search\` para leer su contenido en tiempo real y responder con los datos encontrados.
5. NOTICIAS Y RESULTADOS DE WEB_SEARCH (\`web_search\`):
   - Cada titular o resultado listado en tu respuesta DEBE llevar obligatoriamente la URL devuelta por la herramienta en formato Markdown \`[Titular](url_https_completa)\`.
   - Si un titular o ítem no tiene URL devuelta por la herramienta, OMITE el ítem por completo. Prohibido listar titulares sin URL.
6. BÚSQUEDA EN YOUTUBE (\`youtube_search\`):
   - Si el idioma del usuario/config es \`es\` o el mensaje va en español, incluye SIEMPRE \`"en español"\` en el \`query\` desde la primera llamada a \`youtube_search\`, no solo tras corrección del usuario.
   - Cada vídeo listado debe incluir su enlace completo \`[Título del vídeo](https://www.youtube.com/watch?v=...)\`.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 CAPACIDADES DE VOZ Y LECTURA EN VOZ ALTA (TTS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tienes plena capacidad para hablar, leer textos y enviar audios o notas de voz a través del motor de TTS (Text-to-Speech) integrado en la plataforma.
1. Si el usuario te pide: "habla", "léeme esto", "leeme", "di en voz alta", "reproduce", "audio", "lee la respuesta anterior" o frases similares:
   - Está STRICTLY PROHIBIDO que digas "no puedo hablar", "no tengo capacidad para enviar audios" o "soy un modelo de lenguaje y no puedo".
   - Tu respuesta debe ser el texto exacto que el usuario quiere que leas o digas en voz alta. 
   - El sistema automáticamente tomará tu texto de respuesta y lo sintetizará en un mensaje de voz enviado al chat.
2. Si te pide "lee la respuesta anterior":
   - Busca en el historial de conversación el último mensaje que tú (el asistente) enviaste al usuario.
   - Responde con el texto exacto de ese último mensaje. No añadas introducciones o explicaciones adicionales como "Aquí está la respuesta anterior:". Limítate a devolver la respuesta para que el motor la lea fluidamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 SISTEMA DE SKILLS (PLANTILLA GENÉRICA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cuando el usuario pida crear una skill, usa esta plantilla:

NOMBRE DE LA SKILL:
<nombre>

OBJETIVO:
Descripción clara de lo que hace la skill.

ENTRADAS:
Lista de datos que la skill necesita.

SALIDAS:
Qué devuelve la skill (texto, hoja, archivo, resumen, etc.)

PROCESO:
1. Paso 1
2. Paso 2
3. Paso 3
(Detallado y sin ambigüedades)

REGLAS:
- No inventar datos.
- No generar enlaces falsos.
- Confirmar cada acción.
- Manejar errores con mensajes claros.
Después de crear la skill, la instalas en el sistema y queda disponible para uso inmediato.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MANEJO DE GOOGLE DRIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Si recibes un ID, úsalo directamente.
- Si la API no devuelve webViewLink, dilo: “La API no devolvió enlace. Necesito ID o enlace manual.”
- Enlace web general a Google Drive: https://drive.google.com/drive/my-drive
- Si el usuario pide enlace a Drive y la cuenta está vinculada, proporciona el enlace web oficial directo (https://drive.google.com/drive/my-drive). NO solicites vinculación ni ejecutes generate_authorization_link salvo que el usuario pida vincular/cambiar de cuenta.
- Nunca inventes enlaces.
- PROHIBICIÓN ESTRICTA: Está TOTALMENTE PROHIBIDO usar drive_mkdir directamente para rutas silvania o silvania/* (ej: silvania, silvania/skills, silvania/historial, silvania/temas, silvania/prompts). Toda la estructura interna de 'silvania' es gestionada exclusivamente por el sistema canónico de carpetas. Solo usa drive_mkdir si el usuario te pide crear una carpeta personal externa explícita (ej: 'Mis Facturas', 'Proyectos').
- Para carpetas anidadas:
  1. Verificar existencia.
  2. Crear si falta.
  3. Confirmar con enlace final.
- Para mover archivos: Necesitas ID del archivo + ID de la carpeta destino.
- Al crear o verificar carpetas con \`drive_mkdir\` o \`drive_search\`, la herramienta devuelve su ID y enlace web real. Usa SIEMPRE ese ID y enlace proporcionados; NUNCA digas 'Enlace no disponible' ni recurras solo a 'my-drive' cuando la herramienta te entregó el enlace a la carpeta.
- Toda carpeta o archivo de transcripción debe crearse bajo la ruta canónica \`silvania/transcripciones\`.
- Para leer archivos:
  1. Si no hay texto, usar OCR.
  2. Si el PDF está vacío, dilo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MANEJO DE GOOGLE SHEETS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Para crear hojas (\`sheets_create\` o \`sheets_create_invoice\`): NO busques ni crees carpetas previas en Drive (como 'silvania'). Llama directamente a la herramienta correspondiente con el título pedido. El sistema se encarga de crearla y organizarla automáticamente dentro de la carpeta canónica \`silvania/\`.
- Recuerda siempre al usuario que las hojas de cálculo creadas viven organizadas dentro de su carpeta \`silvania/\` en Google Drive.
- Crear hoja → confirmar spreadsheetId y webViewLink reales devueltos por la herramienta.
- Crear estructura completa.
- Añadir fórmulas reales.
- Confirmar que las fórmulas existen.
- Devolver SIEMPRE enlace Markdown completo: \`[Abrir en Google Sheets](https://docs.google.com/spreadsheets/d/{spreadsheetId}/edit)\` utilizando el spreadsheetId real. ESTRICTAMENTE PROHIBIDO responder solo "Abrir en Google Sheets" sin enlace o con URLs ficticias/raíz.
- Si el usuario pide "enlace al sheet" del parte o de cualquier hoja, usa OBLIGATORIAMENTE el \`spreadsheetId\` del turno actual o el canónico guardado; NUNCA des https://docs.google.com/spreadsheets/ genérico.
- **LIBRO CANÓNICO DE TALLER (\`Taller_Partes\`):**
  * Para talleres mecánicos existe un único libro canónico llamado \`Taller_Partes\` en \`silvania/\`.
  * Si el libro ya existe, \`sheets_create\` devolverá su ID canónico para evitar crear libros duplicados.
  * El diseño oficial cuenta con banner Silvania en fila 1 y 15 cabeceras estructuradas en fila 2 con texto blanco sobre fondo oscuro.
  * **REGLA CRÍTICA DE ESCRITURA:** Tras crear \`Taller_Partes\` formateado, añadir partes solo con \`sheets_append\` (o \`sheets_write\` en la siguiente fila vacía, ej: \`A3\`); NO volver a escribir cabeceras en A1 ni en ninguna otra fila. La inserción de un parte nuevo debe ser SOLO la fila de datos (matriz 1x15).
  * El parámetro \`values\` de \`sheets_write\` y \`sheets_append\` debe ser SIEMPRE una matriz 2D (array de arrays: \`[[campo1, campo2, ...]]\`). PROHIBIDO terminantemente enviar cadenas de texto con punto y coma (';') o texto CSV plano.
- Si la API falla: “La API no devolvió enlace. Reintenta.”
- **REGLA DE ESCRITURA MASIVA (BATCH WRITE):**
  * Para rellenar o guardar datos en hojas genéricas distintas a \`Taller_Partes\` (como listas de prospección, tablas de resultados de skills o informes), debes realizar una sola escritura tras tener todos los datos: 1× \`sheets_create\` (si aplica) + 1× \`sheets_write\` o \`sheets_append\` con la matriz 2D completa conteniendo \`[cabeceras, ...filas]\`. (En cambio, para \`Taller_Partes\` las cabeceras ya existen en fila 2 y nunca se reescriben).
  * Está **estrictamente prohibido** realizar múltiples llamadas a \`sheets_write\` para la misma hoja en el mismo turno (prohibido escribir cabeceras en un turno y filas en otro, o escribir celda a celda).
  * **Si el enforcer de seguridad dispara un error de batch** (por haber llamado múltiples veces a \`sheets_write\`), está estrictamente prohibido que le digas al usuario que la hoja o enlace está listo. Debes leer el error de batch en la respuesta de la herramienta, reintentar inmediatamente en el mismo turno haciendo una única llamada con la matriz consolidada, o admitir el fallo de forma explícita.

**Plantilla de factura (skill genérica):**
Columnas:
1. Concepto
2. Cantidad
3. Precio Unitario
4. Importe (\`=B12*C12\` etc. apuntando a la celda de su respectiva fila).
5. Subtotal (\`=SUMA(D12:D14)\` en español, o \`=SUM(D12:D14)\` en inglés).
6. IVA (\`=D16*0,21\` en español, o \`=D16*0.21\` en inglés).
7. Total (\`=D16+D17\`).
*(Nota técnica OBLIGATORIA: Si el usuario pide factura o plantilla de factura, es ESTRICTAMENTE OBLIGATORIO usar \`sheets_create_invoice\`. La herramienta devuelve \`SPREADSHEET_ID=<id>\` y \`LINK=https://docs.google.com/spreadsheets/d/<id>/edit\`. Si la escritura falla y la herramienta devuelve \`❌ Error\`, informa del error claramente y NUNCA digas que la factura fue creada con IVA. Si tiene éxito, entrega al usuario el enlace en una sola línea Markdown limpia: \`[Nombre](https://docs.google.com/spreadsheets/d/ID/edit)\` sin repetir el ID en texto suelto. Si el usuario pide después el enlace a la hoja/factura, usa ese mismo \`SPREADSHEET_ID\` del turno/sesión y NUNCA llames a \`sheets_list\`.)*

${gmailHandlingStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MANEJO DE CALENDAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Crear eventos con: fecha, hora, título, ubicación.
- Confirmar con enlace.
- Si no hay eventos: dilo claramente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MANEJO DE OCR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Si el PDF tiene texto → lectura nativa.
- Si no tiene texto → OCR.
- Si está vacío → dilo.
- Nunca inventes contenido.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MANEJO DE PROSPECCIÓN COMERCIAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Nunca inventes empresas.
- Nunca inventes webs.
- Nunca inventes descripciones.
- Si la búsqueda falla: “No encontré resultados válidos.”
- Generar hoja con columnas: \`Nombre | Sitio web | Dirección | Teléfono | Email | Actividad | Maps (opcional)\`.
  * En Sitio web pon solo la URL corporativa real (está prohibido poner enlaces de google.com/maps/search/ en esta columna, de ser necesario van en la columna Maps). Si no hay datos, deja la celda vacía.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MANEJO DE ERRORES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Si la API falla: “La API no devolvió el dato necesario.”
- No inventes resultados.
- No inventes enlaces.
- No inventes contenido.
- Pedir ID, archivo o enlace si falta.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 CREACIÓN DE SKILLS EN LENGUAJE NATURAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cuando el usuario diga: “Crea una skill que haga X” debes:
1. Interpretar la necesidad.
2. Crear la skill usando la plantilla.
3. Instalarla en el Drive (\`silvania/skills/\`) e indexarla.
4. Confirmar que está lista.
5. Ejecutarla si el usuario lo pide.

*Ejemplo:*
- “Crea una skill para analizar facturas de electricidad”
- El agente debe crear: analisis_facturas_electricidad
- Entradas: PDF o ID
- Salidas: consumo, importe, desglose
- Proceso: lectura → OCR → extracción → resumen
- Reglas: no inventar datos

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 VERTICALES Y SKILLS ESPECIALIZADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Las soluciones verticales (ej. taller mecánico, asesoría, inmobiliaria, perfiles profesionales) se activan como capas de prompts, flujos y skills instaladas SOBRE Silvania CoreAgent en silvania/skills/.
- No son bots separados ni agentes paralelos con cuentas Google independientes.
- Mantén siempre tu identidad ejecutiva y no cambies de personalidad ni simules otros productos (Marketing Studio o Eva).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔧 MODO DE EJECUCIÓN DE HERRAMIENTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Siempre que el usuario solicite una acción que involucre Google Workspace (Sheets, Drive, Gmail, Calendar), OCR, prospección o cualquier otra herramienta, debes:

1. **Detectar la necesidad de herramientas** y activar el modo de ejecución de herramientas.
2. **Usar el modelo de herramientas** (como Gemini 2.5 Flash) para estas operaciones, en lugar del modelo de conversación.
3. **Nunca simular respuestas ni inventar tool calls**.
4. **Forzar la ejecución de herramientas** incluso si el router clasifica la consulta como “conversación simple” cuando se trata de una operación que requiere herramientas.
5. **Manejar errores reales** y devolver mensajes claros si una herramienta falla, solicitando ID, enlace o datos adicionales si es necesario.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🧬 HERRAMIENTAS DISPONIBLES EN ESTE TURNO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**Google Workspace:** ${googleToolsStr}

**Memoria e Historial:** \`memory_get_summary\`, \`memory_update_summary\`, \`memory_list_history\`, \`memory_read_day\`, \`memory_search_by_topic\`, \`memory_list_folder\`

**Internet & Sistema:** \`web_search\`, \`read_url\`, \`execute_command\`, \`analyze_image\`, \`google_workspace\`, \`search_skills\`, \`get_skill\`, \`install_skill\`, \`create_skill\`, \`load_skills\`, \`generate_authorization_link\`

**Skills Instaladas Actualmente (Tus Superpoderes):**
${skillsSummary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⚠️ NOTA DE ESTABILIDAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Si detectas un error de red o de "Conflict", informa al usuario que estás reiniciando las conexiones. Eres un agente de EJECUCIÓN, actúa siempre con los datos reales obtenidos de las herramientas.`;

    // 4. Obtener historial y prompts de la caché local
    let customPromptStr = "";
    try {
      const cachedPrompt = await dbService.getCustomPrompt(userId);
      if (cachedPrompt) {
        customPromptStr = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n## ⚙️ INSTRUCCIONES PERSONALIZADAS DEL USUARIO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nEl usuario ha definido las siguientes reglas y roles personalizados en su Google Drive (archivo 'prompts/instrucciones_agente.txt'). Síguelas fielmente:\n${cachedPrompt}\n`;
      }
    } catch (e: any) {
      console.error("Error al cargar customPrompt en agent.ts:", e.message);
    }

    let drivePromptsStr = "";
    try {
      const localPromptsDir = path.join(process.cwd(), "data", `user_${userId}`, "prompts");
      if (fs.existsSync(localPromptsDir)) {
        const files = fs.readdirSync(localPromptsDir);
        for (const file of files) {
          if (file.endsWith(".md") || file.endsWith(".txt")) {
            const filePath = path.join(localPromptsDir, file);
            const content = fs.readFileSync(filePath, "utf8");
            drivePromptsStr += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n## ⚙️ INSTRUCCIONES DE DRIVE (${file})\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${content}\n`;
          }
        }
      }
    } catch (e: any) {
      console.error("Error leyendo prompts locales de caché:", e.message);
    }

    // Ruteo de modelos: google/gemini-2.5-flash por defecto, gpt-4o-mini en cortesías ultra-simples.
    const isCourtesy = isUltraSimpleCourtesy(userMessage);
    const targetModel = isCourtesy ? "openai/gpt-4o-mini" : "google/gemini-2.5-flash";
    console.log(`🤖 [Agent] Ruteo de modelo para "${userMessage}": ${targetModel}`);

    let history: any[] = [
      { role: "system", content: systemPrompt + customPromptStr + drivePromptsStr },
      ...(await dbService.getHistory(userId))
    ];

    if (tasks.length <= 1) {
      // Usar chat sin herramientas si la consulta no menciona palabras clave de herramientas, búsqueda, navegación o memoria
      let requiresTools = /crea|crear|agendar|apunta|apuntar|anota|anotar|lista|listar|busca|buscar|envia|envía|envias|envías|lee|leer|open|genera|generar|sube|subir|mueve|mover|borra|borrar|investiga|investigar|resume|resumir|transcribe|transcribir|factura|evento|correo|email|gmail|mensaje|recibido|bandeja|drive|carpeta|archivo|subir|descargar|mkdir|calendar|calendario|cita|reunion|reunión|agenda|programar|youtube|video|transcripcion|transcripción|sheets|excel|hoja|celda|fila|columna|web_search|read_url|noticia|noticias|memoria|historial|resumen|recordar|recuerdas|ayer|hablamos|primera|conversacion|conversación|dijiste|dije|skill|skills|habilidad|habilidades|entra|entrar|visita|visitar|accede|acceder|mira|mirar|consulta|consultar|url|urls|web|sitio|pagina|página|portal|internet|link|enlace|silvania|sylvania|https?:\/\/|[a-zA-Z0-9-]+\.(ai|com|es|org|net|io|co|dev|app)\b/i.test(userMessage);

      // Anti-fast-path regex para garantizar acceso a herramientas en investigación, enlaces y operaciones de Google
      const antiFastPathRegex = /investig|protocolo|empresa|paleplast|maps|correo|gmail|drive|list|enlace|intent|ejecut|autoriz|gmail_list|drive_list|read_url|web_search/i;
      if (antiFastPathRegex.test(userMessage)) {
        requiresTools = true;
      }

      // Detección de IDs de Google Drive (ej. 1lwnmyCvSwjvjpHtXlvNCFWohThg9VLaj) y operaciones con documentos / PDFs
      const hasDriveFileId = /\b[a-zA-Z0-9_-]{25,65}\b/.test(userMessage);
      const isDocOrFile = /\b(pdf|documento|documentos|doc|docx|archivo|archivos|analiza|analizar|analisis|análisis|analyze|adjunto|adjuntos)\b/i.test(userMessage);
      if (hasDriveFileId || isDocOrFile) {
        requiresTools = true;
      }

      // Heurística de UX ampliada: Si el mensaje del usuario es una confirmación, orden corta o reintento
      // (ej: "ok", "si", "inténtalo de nuevo", "otra vez", "hazlo", "procede", "ejecútalo", "como que no?")
      // y el historial muestra que hubo actividad de herramientas o acción pendiente, forzar requiresTools = true.
      if (!requiresTools) {
        const cleanMsg = userMessage.toLowerCase().trim();
        const isConfirmationOrImperative = 
          /^(ok|si|sí|vale|procede|adelante|dale|continua|continuar|listo|termina|hazlo|guárdalo|guardalo|créalo|crealo|genera el enlace|int[eé]ntalo|otra vez|vuelve|ejec[uú]talo|como que no\??)$/i.test(cleanMsg) || 
          cleanMsg.length < 35 && /(ok|procede|adelante|continua|continuar|dale|termina|hazlo|guárdalo|guardalo|créalo|crealo|genera|int[eé]ntalo|otra vez|vuelve|ejec[uú]talo)/i.test(cleanMsg);
        
        if (isConfirmationOrImperative) {
          const userHistory = await dbService.getHistory(userId, 6);
          const hadToolActivity = userHistory.some(msg => /gmail|drive|correo|investig|web_search|read_url|empresa|archivo|carpeta|lista|enlace|búsqueda|busqueda/i.test(msg.content || ""));
          const lastAssistantMsg = [...userHistory].reverse().find(msg => msg.role === "assistant");
          const indicatesAction = lastAssistantMsg?.content && /voy a|procedo|guardar|crear|buscar|enviar|generar|un momento|espera/i.test(lastAssistantMsg.content);

          if (hadToolActivity || indicatesAction) {
            console.log(`ℹ️ [Agent] Reintento u orden continuada detectada ("${userMessage}"). Forzando requiresTools = true.`);
            requiresTools = true;
          }
        }
      }

      // Si el bot estaba en medio de una búsqueda o proceso, forzar uso de herramientas para no abandonar la tarea
      const isAwaiting = await dbService.isAwaitingSearchResponse(userId).catch(() => false);
      if (isAwaiting) {
        console.log(`ℹ️ [Agent] A la espera de respuesta de búsqueda previa. Forzando uso de herramientas.`);
        requiresTools = true;
      }

      if (!requiresTools) {
        console.log(`⚡ [Agent] Optimizando latencia: consulta conversacional simple detectada. Ejecutando sin herramientas.`);
        const responseText = await llmService.chatWithoutTools(history, targetModel);
        const finalContent = filterFinalOutput(enforceHardLimit(sanitizeAlucinatedLinks(responseText || "No tengo una respuesta en este momento.", history)), history);
        await dbService.addMessage(userId, "assistant", finalContent);
        
        // Guardar memoria actualizada en Google Drive en segundo plano (no bloqueante)
        if (!isCourtesy) {
          import("../services/driveMemory.js")
            .then(({ driveMemoryService }) => driveMemoryService.syncToDrive(userId))
            .catch(err => console.error("Error al guardar memoria en Drive (conversacional rápido):", err.message));
        }
        return finalContent;
      }

      let iterations = 0;
      const seenProgressMsgs = new Set<string>();
      while (iterations < MAX_ITERATIONS) {
        const response = await llmService.chat(history, targetModel, userId);
        
        if (response.content) {
          const contentStr = response.content.trim();
          if (isProgressMessage(contentStr)) {
            const normalized = contentStr.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¡¿]/g, "");
            if (seenProgressMsgs.has(normalized)) {
              console.warn(`🚨 [Anti-Loop] Bucle de mensaje de progreso detectado: "${contentStr}". Finalizando.`);
              const exitMsg = "❌ Se detectó un bucle repetitivo de progreso. Operación abortada.";
              await dbService.addMessage(userId, "assistant", exitMsg);
              return exitMsg;
            }
            seenProgressMsgs.add(normalized);
          }
        }
        
        // Si no quiere usar herramientas, comprobamos guardias antes de terminar
        if (!response.tool_calls || response.tool_calls.length === 0) {
          // Si el usuario proporcionó un ID de archivo de Drive y el modelo intentó responder en la primera iteración sin llamar a la herramienta de lectura:
          const driveIdMatch = userMessage.match(/\b([a-zA-Z0-9_-]{25,65})\b/);
          const asksReading = /\b(lee|leer|analiza|analizar|resumen|resume|muestra|ver|contenido|archivo|documento|pdf)\b/i.test(userMessage);
          if (iterations === 0 && driveIdMatch && asksReading) {
            const fileId = driveIdMatch[1];
            console.log(`📄 [Agent Guard] Usuario solicita lectura del archivo Drive ${fileId}. Forzando lectura.`);
            history.push(response);
            history.push({
              role: "user" as const,
              content: `⚠️ ACCIÓN OBLIGATORIA: Para responder sobre el archivo ${fileId}, DEBES ejecutar obligatoriamente la herramienta analyze_document (o drive_read_file) con file_id: "${fileId}". No respondas sin haber leído el archivo real.`
            });
            iterations++;
            continue;
          }

          let rawContent = response.content || "No tengo una respuesta en este momento.";

          // Anti-alucinación estricta de documentos: si una herramienta de lectura falló en este turno,
          // está PROHIBIDO que el modelo invente o sustituya el contenido basándose en historial anterior.
          const docToolResult = [...history].reverse().find(m => m.role === "tool" && (
            String(m.content).includes("analyze_document") ||
            String(m.content).includes("drive_read_file") ||
            String(m.content).includes("Error al analizar el documento") ||
            String(m.content).includes("Error al leer el archivo de Drive") ||
            String(m.content).includes("No pude leer el archivo")
          ));

          if (docToolResult && String(docToolResult.content).startsWith("❌")) {
            const errMatch = String(docToolResult.content).replace(/^❌\s*/, "");
            if (!rawContent.toLowerCase().includes("no pude leer") && !rawContent.toLowerCase().includes("error")) {
              console.warn("🚨 [Anti-Alucinación] La herramienta de lectura falló pero el modelo generó contenido simulado. Sustituyendo por fallo verificado.");
              rawContent = `❌ No pude leer el archivo solicitado: ${errMatch}`;
            }
          }

          // Anti-alucinación estricta de Gmail en producción: si una herramienta devolvió aviso de permisos limitados,
          // está TERMINANTEMENTE PROHIBIDO alucinar correos ficticios o enlaces inventados.
          const gmailLimitResult = [...history].reverse().find(m => m.role === "tool" && (
            String(m.content).includes("Permisos de Gmail limitados") ||
            String(m.content).includes("solo envío (`gmail.send`)")
          ));
          if (gmailLimitResult && (
            rawContent.includes("Asunto:") || 
            rawContent.includes("De:") || 
            rawContent.includes("Remitente:") || 
            /\[Abrir\]\(https:\/\/mail\.google\.com\/mail\/u\/0\/#inbox\/[a-zA-Z0-9_-]+\)/.test(rawContent)
          )) {
            console.warn("🚨 [Anti-Alucinación] Detectada alucinación de correos tras aviso de scope insuficiente. Reemplazando por limitación oficial.");
            rawContent = String(gmailLimitResult.content);
          }

          const finalContent = filterFinalOutput(enforceHardLimit(sanitizeAlucinatedLinks(rawContent, history)), history);
          await dbService.addMessage(userId, "assistant", finalContent);

          // Guardar memoria actualizada en Google Drive en segundo plano (no bloqueante)
          if (!isCourtesy) {
            import("../services/driveMemory.js")
              .then(({ driveMemoryService }) => driveMemoryService.syncToDrive(userId))
              .catch(err => console.error("Error al sincronizar memoria a Drive al finalizar el agente:", err.message));
          }

          return finalContent;
        }

        // Verificar abuso de llamadas individuales de escritura de Sheets
        const sheetsWriteCalls = response.tool_calls.filter(tc => tc.function.name === "sheets_write");
        if (sheetsWriteCalls.length >= 3) {
          const sheetIds = sheetsWriteCalls.map(tc => {
            try {
              return JSON.parse(tc.function.arguments).spreadsheet_id;
            } catch {
              return null;
            }
          });
          const hasAbuse = sheetIds.some(id => id && sheetIds.filter(x => x === id).length >= 3);
          if (hasAbuse) {
            console.warn("⚠️ [Agent] Detectadas >= 3 llamadas a sheets_write en el mismo turno para la misma hoja. Forzando error batch.");
            history.push(response);
            for (const toolCall of response.tool_calls) {
              history.push({
                role: "tool" as const,
                tool_call_id: toolCall.id,
                content: "❌ Error: Usa UNA sola sheets_write con matriz 2D completa. Prohibido celda a celda."
              });
            }
            iterations++;
            continue;
          }
        }

        // Si quiere usar herramientas, las ejecutamos
        history.push(response);
        
        for (const toolCall of response.tool_calls) {
          let result;
          try {
            result = await executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments), userId);
          } catch (err: any) {
            console.error(`❌ Error ejecutando herramienta ${toolCall.function.name}:`, err.message);
            result = `❌ Error en herramienta ${toolCall.function.name}: ${err.message}`;
          }
          
          // Añadimos el resultado de la herramienta al historial
          history.push({
            role: "tool" as const,
            tool_call_id: toolCall.id,
            content: String(result)
          });
        }

        // Volvemos a preguntar al modelo con los resultados de las herramientas
        iterations++;
      }

      const limitMsg = "Error interno: se ha superado el límite de iteraciones de herramientas para esta tarea.";
      await dbService.addMessage(userId, "assistant", limitMsg);
      return limitMsg;
    } else {
      // 1. Ejecutar las tareas individualmente con su propio historial aislado para evitar redundancias
      // Deduplicar tareas idénticas o muy similares antes de procesarlas
      const uniqueTasks: string[] = [];
      for (const t of tasks) {
        const cleanT = t.toLowerCase().trim();
        const isRedundant = uniqueTasks.some(existing => {
          const extL = existing.toLowerCase().trim();
          return extL.includes(cleanT) || cleanT.includes(extL);
        });
        if (!isRedundant) {
          uniqueTasks.push(t);
        }
      }

      const taskResults: { task: string; result: string }[] = [];

      for (let i = 0; i < uniqueTasks.length; i++) {
        const task = uniqueTasks[i];
        const originalHistoryLength = history.length;
        const taskHistory = [...history];

        // Reemplazar el último mensaje del historial (que es el mensaje multitarea original) con la tarea específica
        if (taskHistory.length > 0 && taskHistory[taskHistory.length - 1].role === "user") {
          taskHistory[taskHistory.length - 1] = {
            role: "user",
            content: `Ejecuta la siguiente tarea de forma autónoma y directa utilizando tus herramientas: "${task}"`
          };
        }

        let taskInstruction = `Por favor, ejecuta ahora la tarea ${i + 1} de forma proactiva: "${task}"`;
        const taskLower = task.toLowerCase();
        if (taskLower.includes("lista") || taskLower.includes("mostrar") || taskLower.includes("ver")) {
          if (taskLower.includes("carpeta") || taskLower.includes("historial") || taskLower.includes("silvania") || taskLower.includes("drive")) {
            taskInstruction += `\n⚠️ INSTRUCCIÓN DE HERRAMIENTA: Llama INMEDIATAMENTE a la herramienta drive_list (o memory_list_folder) con el parámetro parentId o folderNameOrId correspondiente a la carpeta mencionada (ej: parentId: "silvania/historial").`;
          }
        }

        // Añadir instrucción específica al historial aislado
        taskHistory.push({
          role: "user",
          content: taskInstruction
        });

        let iterations = 0;
        let taskCompletedContent = "";
        const seenProgressMsgs = new Set<string>();

        while (iterations < MAX_ITERATIONS) {
          const response = await llmService.chat(taskHistory, targetModel, userId);

          if (response.content) {
            const contentStr = response.content.trim();
            if (isProgressMessage(contentStr)) {
              const normalized = contentStr.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¡¿]/g, "");
              if (seenProgressMsgs.has(normalized)) {
                console.warn(`🚨 [Anti-Loop] Bucle de progreso detectado en tarea: "${contentStr}". Finalizando.`);
                taskCompletedContent = "❌ Operación abortada por bucle repetitivo de progreso.";
                break;
              }
              seenProgressMsgs.add(normalized);
            }
          }

          if (!response.tool_calls || response.tool_calls.length === 0) {
            taskCompletedContent = response.content || "Completado.";
            taskHistory.push(response);
            break;
          }

          // Verificar abuso de llamadas individuales de escritura de Sheets
          const sheetsWriteCalls = response.tool_calls.filter(tc => tc.function.name === "sheets_write");
          if (sheetsWriteCalls.length >= 3) {
            const sheetIds = sheetsWriteCalls.map(tc => {
              try {
                return JSON.parse(tc.function.arguments).spreadsheet_id;
              } catch {
                return null;
              }
            });
            const hasAbuse = sheetIds.some(id => id && sheetIds.filter(x => x === id).length >= 3);
            if (hasAbuse) {
              console.warn("⚠️ [Agent] Detectadas >= 3 llamadas a sheets_write en el mismo turno para la misma hoja en multitarea. Forzando error batch.");
              taskHistory.push(response);
              for (const toolCall of response.tool_calls) {
                taskHistory.push({
                  role: "tool" as const,
                  tool_call_id: toolCall.id,
                  content: "❌ Error: Usa UNA sola sheets_write con matriz 2D completa. Prohibido celda a celda."
                });
              }
              iterations++;
              continue;
            }
          }

          taskHistory.push(response);

          for (const toolCall of response.tool_calls) {
            let result;
            try {
              result = await executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments), userId);
            } catch (err: any) {
              console.error(`❌ Error ejecutando herramienta ${toolCall.function.name}:`, err.message);
              result = `❌ Error en herramienta ${toolCall.function.name}: ${err.message}`;
            }

            taskHistory.push({
              role: "tool" as const,
              tool_call_id: toolCall.id,
              content: String(result)
            });
          }
          iterations++;
        }

        if (iterations >= MAX_ITERATIONS && !taskCompletedContent) {
          taskCompletedContent = "Límite de iteraciones alcanzado.";
        }

        taskResults.push({ task, result: taskCompletedContent });

        // Acumular los nuevos mensajes generados en esta tarea de vuelta al historial principal (history)
        const newMessages = taskHistory.slice(originalHistoryLength);
        history.push(...newMessages);
      }

      // 2. Compilar la respuesta final detallada uniendo el resultado de cada tarea de forma consolidada
      let finalAgentResponse = "";
      if (uniqueTasks.length <= 1) {
        finalAgentResponse = taskResults[0]?.result || "Completado.";
      } else {
        finalAgentResponse = taskResults.map(tr => tr.result).join("\n\n");
      }

      // Sanitizar todo el reporte multitarea final para evitar enlaces alucinados
      finalAgentResponse = filterFinalOutput(enforceHardLimit(sanitizeAlucinatedLinks(finalAgentResponse, history)), history);

      // Guardar la respuesta final compilada en la DB del usuario
      await dbService.addMessage(userId, "assistant", finalAgentResponse);

      // Sincronizar memoria a Drive en segundo plano (no bloqueante)
      if (!isCourtesy) {
        import("../services/driveMemory.js")
          .then(({ driveMemoryService }) => driveMemoryService.syncToDrive(userId))
          .catch(err => console.error("Error al sincronizar memoria a Drive al finalizar el agente multitarea:", err.message));
      }

      return finalAgentResponse;
    }
  });
}

/**
 * Divide un mensaje complejo del usuario en una lista de tareas individuales delegando al servicio taskParser.
 */
async function parseMultipleTasks(userMessage: string): Promise<string[]> {
  return await parseUserTasks(userMessage);
}

/**
 * Detecta saludos y cortesías ultra-simples para ruteo rápido.
 */
export async function getLastSessionSpreadsheet(
  userId: number,
  history?: any[]
): Promise<{ id: string; title: string; url: string } | null> {
  // 1. Priorizar el ID autoritativo guardado directamente por la herramienta (sheets_create_invoice / sheets_create)
  try {
    const saved =
      (await dbService.getDriveFolder(userId, "sheet:LAST_INVOICE")) ||
      (await dbService.getDriveFolder(userId, "sheet:LAST_ACTIVE"));
    if (saved) {
      const [id, title] = saved.split("|");
      if (id && id.length >= 20) {
        return {
          id,
          title: title || "Factura",
          url: `https://docs.google.com/spreadsheets/d/${id}/edit`
        };
      }
    }
  } catch {}

  // 2. Fallback al historial de mensajes/tools de la sesión
  if (Array.isArray(history)) {
    for (let i = history.length - 1; i >= 0; i--) {
      const content = String(history[i]?.content || "");
      if (!content) continue;
      const mdMatch = content.match(/\[([^\]]+)\]\(https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,80})(?:\/edit)?\)/i);
      if (mdMatch && mdMatch[2]) {
        const title = mdMatch[1].replace(/^Abrir en Google Sheets$/i, "Factura").trim() || "Hoja de cálculo";
        return {
          id: mdMatch[2],
          title,
          url: `https://docs.google.com/spreadsheets/d/${mdMatch[2]}/edit`
        };
      }
      const idMatch =
        content.match(/SPREADSHEET_ID=([A-Za-z0-9_-]{20,80})/i) ||
        content.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,80})/i);
      if (idMatch && idMatch[1]) {
        return {
          id: idMatch[1],
          title: "Hoja de cálculo",
          url: `https://docs.google.com/spreadsheets/d/${idMatch[1]}/edit`
        };
      }
    }
  }

  return null;
}

export function extractUserNameIntroduction(text: string): string | null {
  if (!text) return null;
  const clean = text.trim();
  const match = clean.match(
    /(?:^|[\s,.;:!¡¿?-])(?:yo\s+)?(?:soy|me\s+llamo|mi\s+nombre\s+es|ll[aá]mame|puedes\s+llamarme)\s+([A-ZÁÉÍÓÚÜÑa-záéíóúüñ]{2,25})(?:\s+([A-ZÁÉÍÓÚÜÑa-záéíóúüñ]{2,25}))?(?=[\s,.;:!¡¿?]|$)/i
  );
  if (!match) return null;

  const nonNames = new Set([
    "nuevo", "nueva", "cliente", "usuario", "usuaria", "autonomo", "autónomo",
    "autonoma", "autónoma", "empresa", "pyme", "el", "la", "un", "una", "de",
    "del", "tu", "su", "yo", "silvania", "bot", "agente", "administrador", "admin",
    "comercial", "abogado", "mecanico", "mecánico", "doctor", "ingeniero", "gerente"
  ]);

  const firstWord = match[1];
  const firstNorm = firstWord.toLowerCase();
  if (nonNames.has(firstNorm)) return null;

  const formatWord = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  let fullName = formatWord(firstWord);

  if (match[2]) {
    const secondWord = match[2];
    const secondNorm = secondWord.toLowerCase();
    const stopSecondWords = new Set([
      "y", "o", "pero", "quiero", "necesito", "puedes", "crea", "crear", "haz",
      "hacer", "envia", "envía", "busca", "lista", "tengo", "estoy", "vengo",
      "para", "por", "con", "sin", "de", "del", "en", "que", "como", "cómo",
      "encantado", "encantada", "gracias", "buenas", "hola", "mañana", "manana", "hoy"
    ]);
    if (!nonNames.has(secondNorm) && !stopSecondWords.has(secondNorm)) {
      fullName += " " + formatWord(secondWord);
    }
  }
  return fullName;
}

export async function saveUserPreferredName(userId: number, userName: string): Promise<void> {
  try {
    const currentPrompt = (await dbService.getCustomPrompt(userId)) || "";
    const nameDirective = `Nombre del usuario: ${userName}.`;
    let updatedPrompt = currentPrompt;
    if (/Nombre del usuario:\s*[^\n.]+(\.|$)/i.test(currentPrompt)) {
      updatedPrompt = currentPrompt.replace(/Nombre del usuario:\s*[^\n.]+(\.|$)/i, nameDirective);
    } else {
      updatedPrompt = currentPrompt.trim()
        ? `${currentPrompt.trim()}\n${nameDirective}`
        : nameDirective;
    }
    await dbService.setCustomPrompt(userId, updatedPrompt);

    const userFolder = path.join(process.cwd(), "data", `user_${userId}`);
    const localConfigPath = path.join(userFolder, "config.json");
    if (fs.existsSync(localConfigPath)) {
      try {
        const conf = JSON.parse(fs.readFileSync(localConfigPath, "utf8"));
        conf.userName = userName;
        conf.customPrompt = updatedPrompt;
        fs.writeFileSync(localConfigPath, JSON.stringify(conf, null, 2), "utf8");
      } catch {}
    }
  } catch (err: any) {
    console.warn("⚠️ [Agent] No se pudo guardar el nombre preferido del usuario:", err.message);
  }
}

export async function getUserPreferredName(userId: number): Promise<string | null> {
  try {
    const currentPrompt = (await dbService.getCustomPrompt(userId)) || "";
    const match = currentPrompt.match(/Nombre del usuario:\s*([^\n.]+)/i);
    if (match && match[1]) return match[1].trim();

    const localConfigPath = path.join(process.cwd(), "data", `user_${userId}`, "config.json");
    if (fs.existsSync(localConfigPath)) {
      const conf = JSON.parse(fs.readFileSync(localConfigPath, "utf8"));
      if (conf.userName) return String(conf.userName).trim();
    }
  } catch {}
  return null;
}

export function hasTaskOrQuestionIntent(text: string): boolean {
  if (!text) return false;
  const clean = text.trim();
  if (
    /\b(crea|crear|agendar|agenda|programa|programar|apunta|apuntar|anota|anotar|pon|poner|evento|eventos|cita|citas|reuni[oó]n|reuniones|recordatorio|calendar|calendario|factura|facturas|presupuesto|hoja|hojas|sheet|sheets|excel|tabla|parte|taller|correo|correos|email|emails|gmail|env[ií]a|enviar|manda|mandar|redacta|redactar|drive|carpeta|archivo|archivos|documento|documentos|pdf|sube|subir|descarga|descargar|busca|buscar|investiga|investigar|lista|listar|lee|leer|analiza|analizar|resumen|resume|resumir|borra|borrar|elimina|eliminar|mueve|mover|actualiza|actualizar|modifica|modificar|cambia|cambiar|skill|skills|habilidad|web|url|link|enlace|auth|vincular|conectar|transcribe|transcribir|youtube|video|noticias|ayer|mañana|manana|pasado\s+mañana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i.test(clean)
  ) {
    return true;
  }
  if (/[?¿]/.test(clean)) {
    const withoutCourtesyQuestion = clean
      .replace(/¿?\s*(?:qu[eé]\s+tal|c[oó]mo\s+est[aá]s|c[oó]mo\s+va(?:\s+todo)?|qu[eé]\s+hay|todo\s+bien)\s*\??/gi, "")
      .trim();
    if (
      /[?¿]/.test(withoutCourtesyQuestion) ||
      /\b(qu[eé]|c[oó]mo|cu[aá]ndo|d[oó]nde|cu[aá]l|cu[aá]les|cu[aá]nto|por\s+qu[eé]|puedes|podr[ií]as|sabes|tienes)\b/i.test(withoutCourtesyQuestion)
    ) {
      return true;
    }
  }
  return false;
}

export function isPureShortGreeting(text: string): boolean {
  if (!text) return false;
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¡¿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return /^(?:hola|hey|buenas|buenos dias|buenos días|buenas tardes|buenas noches|saludos)(?:\s+(?:que tal|qué tal|como estas|cómo estás|todo bien|silvania|equipo))?$/i.test(clean);
}

export function isUltraSimpleCourtesy(text: string): boolean {
  if (!text) return false;
  const clean = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¡¿]/g, "") // Eliminar puntuación
    .replace(/\s+/g, " ")
    .trim();

  const words = clean.split(" ");
  if (words.length === 0 || words.length > 3) return false;

  const courtesyWords = new Set([
    "hola", "hi", "buenas", "buenos", "dias", "tardes", "noches",
    "ok", "okay", "vale", "perfecto", "gracias", "de", "nada",
    "entendido", "listo", "que", "dia", "es", "hoy", "hora"
  ]);

  return words.every(w => courtesyWords.has(w));
}

export function sanitizeAlucinatedLinks(responseText: string, history: any[]): string {
  const validIds = new Set<string>();
  const validUrls = new Set<string>();

  // 1. Escanear respuestas de herramientas (role === "tool") Y mensajes del historial (assistant / user)
  // para recopilar IDs y URLs verificados y legítimos a lo largo de la conversación
  for (const msg of history) {
    if (msg.content) {
      const content = String(msg.content);

      // A. Extraer URLs completas verificadas
      const urls = content.match(/(https?:\/\/[^\s)\]`'"]+)/gi) || [];
      for (const u of urls) {
        validUrls.add(u.trim().replace(/[.,;:]+$/, ""));
      }

      // B. Extraer IDs explícitos de Workspace (Drive, Gmail, Sheets, Calendar)
      const explicitMatches = content.matchAll(/(?:SPREADSHEET_ID=|spreadsheetId[*`"'=:\s]+|spreadsheet_id[*`"'=:\s]+|ID[*`"'=:\s]+|id["']?\s*:\s*["']?|\/d\/|\/folders\/|#inbox\/|[?&]id=|[?&]eid=)([a-zA-Z0-9_=-]{8,128})/gi);
      for (const m of explicitMatches) {
        if (m[1]) {
          validIds.add(m[1]);
          if (m[1].length >= 20) {
            validUrls.add(`https://docs.google.com/spreadsheets/d/${m[1]}/edit`);
            validUrls.add(`https://docs.google.com/spreadsheets/d/${m[1]}`);
          }
        }
      }
      for (const m of explicitMatches) {
        if (m[1]) validIds.add(m[1]);
      }

      // C. Extraer identificadores técnicos entre backticks que contengan dígitos y letras
      const backtickMatches = content.matchAll(/`([a-zA-Z0-9_=-]{8,128})`/g);
      for (const bm of backtickMatches) {
        const val = bm[1];
        // Asegurar que no sea una palabra de diccionario: debe tener al menos un dígito o guión/igual
        if (/[0-9_=-]/.test(val)) {
          validIds.add(val);
        }
      }
    }
  }

  // Whitelist estricta oficial (URLs fijas canónicas sin ID inventado)
  const canonicalWhitelist = [
    "https://drive.google.com/drive/my-drive",
    "https://drive.google.com",
    "https://mail.google.com/mail/u/0/#inbox",
    "https://mail.google.com/mail",
    "https://mail.google.com",
    "https://calendar.google.com/calendar/u/0/",
    "https://calendar.google.com/calendar/u/0",
    "https://calendar.google.com/calendar/u/0/r",
    "https://calendar.google.com/calendar",
    "https://calendar.google.com",
    "https://www.google.com/calendar",
    "https://docs.google.com/spreadsheets",
    "https://silvania.ai"
  ];

  // Purgar repeticiones basura tipo "2E6W0Z3Y9" o chunks alfanuméricos repetidos 3+ veces antes de validar enlaces
  let sanitizedText = responseText.replace(/(?:2E6W0Z3Y9[-_\s]*)+/gi, "").replace(/([A-Za-z0-9]{6,20})(?:[-_]?(\1)){2,}/g, "");
  let neutralizedCount = 0;

  // Regex para todas las URLs http/https del texto
  const allUrlsRegex = /(https?:\/\/[^\s)\]`'"]+)/gi;
  const linksFound = sanitizedText.match(allUrlsRegex) || [];

  for (const link of linksFound) {
    const cleanLink = link.trim().replace(/[.,;:]+$/, ""); // Limpiar puntuación al final

    // A. Si coincide exactamente con la whitelist canónica, se permite
    if (canonicalWhitelist.includes(cleanLink)) {
      continue;
    }

    // B. Si la URL completa vino explícitamente en el resultado de una tool, se permite
    if (validUrls.has(cleanLink) || Array.from(validUrls).some(u => u === cleanLink || cleanLink.startsWith(u) || u.startsWith(cleanLink))) {
      continue;
    }

    // C. Verificación de enlaces de Google Workspace (Gmail, Drive, Docs, Sheets, Calendar)
    const isGoogleService = /(?:mail|drive|docs|calendar)\.google\.com|google\.[a-z.]+\/calendar/i.test(cleanLink);
    if (isGoogleService) {
      // 1. Enlaces individuales de Gmail: https://mail.google.com/mail/u/0/#inbox/{id}
      const gmailMatch = cleanLink.match(/#inbox\/([a-zA-Z0-9_-]{8,65})/i);
      if (gmailMatch) {
        const msgId = gmailMatch[1];
        if (!validIds.has(msgId)) {
          neutralizedCount++;
          sanitizedText = sanitizedText.replace(link, "[Enlace no disponible — no devuelto por la herramienta]");
          continue;
        }
      }

      // 2. Enlaces individuales de Google Calendar: eid=... o /eventedit/ o ID
      const isCalendarLink = /(?:calendar\.google\.com|google\.[a-z.]+\/calendar)/i.test(cleanLink);
      if (isCalendarLink) {
        const matchesToolUrl = validUrls.has(cleanLink) || Array.from(validUrls).some(u => u === cleanLink || cleanLink.startsWith(u) || u.startsWith(cleanLink));
        const eidMatch = cleanLink.match(/[?&]eid=([a-zA-Z0-9_=-]+)/i);
        const hasKnownEid = eidMatch && (validIds.has(eidMatch[1]) || Array.from(validIds).some(id => eidMatch[1].includes(id)));

        if (matchesToolUrl || hasKnownEid) {
          continue;
        }

        if (cleanLink.startsWith("https://calendar.google.com/calendar/u/0") || cleanLink === "https://calendar.google.com" || cleanLink === "https://www.google.com/calendar") {
          continue;
        }

        neutralizedCount++;
        sanitizedText = sanitizedText.replace(link, "[Enlace no disponible — no devuelto por la herramienta]");
        continue;
      }

      // 3. Enlaces individuales de Drive / Docs / Sheets: /folders/{id} o /file/d/{id} o /d/{id} o ?id={id}
      let driveId = "";
      const dMatch = cleanLink.match(/\/d\/([a-zA-Z0-9_-]{12,128})/i);
      const folderMatch = cleanLink.match(/\/folders\/([a-zA-Z0-9_-]{12,128})/i);
      const idParamMatch = cleanLink.match(/[?&]id=([a-zA-Z0-9_-]{12,128})/i);

      if (dMatch) driveId = dMatch[1];
      else if (folderMatch) driveId = folderMatch[1];
      else if (idParamMatch) driveId = idParamMatch[1];

      if (driveId) {
        if (!validIds.has(driveId)) {
          neutralizedCount++;
          sanitizedText = sanitizedText.replace(link, "[Enlace no disponible — no devuelto por la herramienta]");
          continue;
        }
      } else if (!gmailMatch) {
        // Enlace de Google desconocido o sospechoso que no está en whitelist ni tiene ID verificado
        neutralizedCount++;
        sanitizedText = sanitizedText.replace(link, "[Enlace no disponible — no devuelto por la herramienta]");
        continue;
      }
    }

    // D. Verificación de directorios y mapas (Google Maps place, Páginas Amarillas, eInforma)
    const isDirectoryOrMaps = /(?:google\.[a-z.]+\/maps\/place|paginasamarillas\.es\/(?!resultados)|informa\.es\/(?!buscador)|einforma\.com)/i.test(cleanLink);
    if (isDirectoryOrMaps && !validUrls.has(cleanLink)) {
      neutralizedCount++;
      sanitizedText = sanitizedText.replace(link, "[Enlace no disponible — no devuelto por la herramienta]");
      continue;
    }
  }

  if (neutralizedCount > 0) {
    console.log(`🚨 [Link Sanitizer] Neutralizadas ${neutralizedCount} URLs alucinadas en esta respuesta`);
  }

  return sanitizedText;
}

/**
 * Trunca las respuestas del agente si superan la longitud máxima de seguridad para evitar fallos de buffer o logs infinitos.
 */
function enforceHardLimit(text: string): string {
  const MAX = 12000;
  if (text.length > MAX) {
    return text.slice(0, MAX) + "\n\n[Respuesta truncada por tamaño excesivo. Posible error interno.]";
  }
  return text;
}

export function filterFinalOutput(text: string, history?: any[]): string {
  if (!text) return "";

  let cleaned = text;

  // 0. Purgar cualquier repetición basura tipo "2E6W0Z3Y9" o chunks alfanuméricos repetidos
  cleaned = cleaned.replace(/(?:2E6W0Z3Y9[-_\s]*)+/gi, "");
  cleaned = cleaned.replace(/([A-Za-z0-9]{6,20})(?:[-_]?(\1)){2,}/g, "");

  // 1. Eliminar cualquier bloque de código markdown ```...``` que contenga print( o tools. en cualquier parte de su interior
  cleaned = cleaned.replace(/```(?:[a-zA-Z0-9_-]+)?[\s\S]*?(?:print\(|tools\.|await\s+tools\.|executeTool\(|gmail_|drive_|sheets_|calendar_)[\s\S]*?```/gi, "");

  // 2. Eliminar líneas individuales sueltas que simulen ejecución de tools o llamadas a print
  cleaned = cleaned.replace(/^\s*(?:print\([^\n]*\)|tools\.[a-zA-Z0-9_-]+\([^\n]*\)|await\s+tools\.[a-zA-Z0-9_-]+\([^\n]*\))\s*$/gmi, "");

  // 3. Eliminar sentencias sueltas de print(...) dentro del texto
  cleaned = cleaned.replace(/\bprint\((?:['"][^'"]*['"]|[a-zA-Z0-9_.]+\([^)]*\)|[^\n)]*)\);?/gi, "");

  // 4. Prevenir enlaces "Abrir" rotos o sin href y garantizar [título](url_https_completa) en una línea tras calendar_create, gmail_send y sheets_create_invoice
  let verifiedGmailUrl = "";
  let verifiedGmailTitle = "";
  let verifiedSheetsUrl = "";
  let verifiedSheetsTitle = "";
  let hasInvoiceMandatoryMarkdown = "";
  let invoiceToolError = "";
  let verifiedCalendarUrl = "";
  let verifiedCalendarTitle = "";
  let verifiedDriveUrl = "";

  let turnCalendarMarkdown = "";
  let turnGmailMarkdown = "";
  let hasTurnNewsSearch = false;
  const turnNewsItems: { title: string; url: string }[] = [];

  if (Array.isArray(history)) {
    let lastUserIdx = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i]?.role === "user" && !String(history[i]?.content || "").startsWith("⚠️ ACCIÓN OBLIGATORIA:")) {
        lastUserIdx = i;
        break;
      }
    }

    for (let idx = 0; idx < history.length; idx++) {
      const msg = history[idx];
      const isCurrentTurn = idx > lastUserIdx;
      if (msg.content) {
        const strContent = String(msg.content);
        if (isCurrentTurn && msg.role === "tool" && /^❌ Error.*factura/i.test(strContent.trim())) {
          invoiceToolError = strContent.trim();
        }
        if (isCurrentTurn && msg.role === "tool") {
          const calMdMatch = strContent.match(/CALENDAR_MARKDOWN=\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i);
          if (calMdMatch) {
            verifiedCalendarTitle = calMdMatch[1].trim();
            verifiedCalendarUrl = calMdMatch[2].trim();
            turnCalendarMarkdown = `[${verifiedCalendarTitle}](${verifiedCalendarUrl})`;
          }
          const gmailMdMatch = strContent.match(/GMAIL_MARKDOWN=\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i);
          if (gmailMdMatch) {
            verifiedGmailTitle = gmailMdMatch[1].trim();
            verifiedGmailUrl = gmailMdMatch[2].trim();
            turnGmailMarkdown = `[${verifiedGmailTitle}](${verifiedGmailUrl})`;
          }
          const mandatoryMatch = strContent.match(/RESPUESTA_OBLIGATORIA=(\[[^\]]+\]\(https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]{20,80}\/edit\))/i);
          if (mandatoryMatch && mandatoryMatch[1]) {
            hasInvoiceMandatoryMarkdown = mandatoryMatch[1].trim();
          }
          if (strContent.includes("📰 NOTICIAS PARA:") || strContent.includes("🌐 RESULTADOS WEB PARA:")) {
            if (strContent.includes("📰 NOTICIAS PARA:")) {
              hasTurnNewsSearch = true;
            }
            const itemMatches = strContent.matchAll(/(?:📰|🔗|📍)\s*(?:\*\*)?\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g);
            for (const im of itemMatches) {
              if (im[1] && im[2]) {
                turnNewsItems.push({ title: im[1].trim(), url: im[2].trim() });
              }
            }
          }
        }

        if (!verifiedGmailUrl) {
          const gmailMatch = strContent.match(/https:\/\/mail\.google\.com\/mail\/u\/0\/#inbox\/([a-zA-Z0-9_-]{8,65})/i);
          if (gmailMatch) verifiedGmailUrl = gmailMatch[0];
        }
        if (!verifiedSheetsUrl) {
          const sheetsMatch = strContent.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,80})/i);
          if (sheetsMatch) {
            verifiedSheetsUrl = `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/edit`;
          } else {
            const idMatch = strContent.match(/(?:SPREADSHEET_ID=|spreadsheetId[*`"'=:\s]+|spreadsheet_id[*`"'=:\s]+|ID[*`"'=:\s]+)`?([a-zA-Z0-9_-]{20,80})`?/i);
            if (idMatch) {
              verifiedSheetsUrl = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/edit`;
            }
          }
        }
        const mdTitleMatch = strContent.match(/MARKDOWN=\[([^\]]+)\]\(https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,80})\/edit\)/i);
        if (mdTitleMatch && mdTitleMatch[1]) {
          verifiedSheetsTitle = mdTitleMatch[1].trim();
          verifiedSheetsUrl = `https://docs.google.com/spreadsheets/d/${mdTitleMatch[2]}/edit`;
        }
        if (!verifiedCalendarUrl) {
          const calMatch = strContent.match(/https?:\/\/(?:www\.)?(?:calendar\.google\.com|google\.[a-z.]+\/calendar)\S+/i);
          if (calMatch) verifiedCalendarUrl = calMatch[0].replace(/[)\]`"',;]+$/, "");
        }
        if (!verifiedDriveUrl) {
          const driveMatch = strContent.match(/https:\/\/drive\.google\.com\S+/i);
          if (driveMatch) verifiedDriveUrl = driveMatch[0].replace(/[)\]`"',;]+$/, "");
        }
      }

      if (!verifiedSheetsUrl && Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          const argsStr = tc?.function?.arguments || "";
          const tcMatch = argsStr.match(/(?:spreadsheet_id|spreadsheetId)["':\s=]+`?([a-zA-Z0-9_-]{20,80})`?/i);
          if (tcMatch) {
            verifiedSheetsUrl = `https://docs.google.com/spreadsheets/d/${tcMatch[1]}/edit`;
            break;
          }
        }
      }
    }
  }

  // Si la herramienta de factura falló en el turno, nunca permitir que el LLM diga "creada con IVA"
  if (invoiceToolError) {
    return invoiceToolError;
  }

  // Si en este turno se ejecutó sheets_create_invoice con éxito, responder SIEMPRE en una sola línea Markdown limpia: [Nombre](https://docs.google.com/spreadsheets/d/ID/edit)
  if (hasInvoiceMandatoryMarkdown) {
    return hasInvoiceMandatoryMarkdown;
  }

  // Si no se encontró en history pero el texto tiene un ID explícito de hoja o URL
  if (!verifiedSheetsUrl) {
    const textUrlMatch = cleaned.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,80})/i);
    if (textUrlMatch) {
      verifiedSheetsUrl = `https://docs.google.com/spreadsheets/d/${textUrlMatch[1]}/edit`;
    } else {
      const textIdMatch = cleaned.match(/(?:spreadsheetId|spreadsheet_id|ID)["':\s=]+`?([a-zA-Z0-9_-]{20,80})`?/i);
      if (textIdMatch) {
        verifiedSheetsUrl = `https://docs.google.com/spreadsheets/d/${textIdMatch[1]}/edit`;
      }
    }
  }

  const sheetsFullMarkdown = verifiedSheetsUrl
    ? `[${verifiedSheetsTitle || "Hoja de cálculo"}](${verifiedSheetsUrl})`
    : "";
  const calendarFullMarkdown =
    turnCalendarMarkdown ||
    (verifiedCalendarUrl ? `[${verifiedCalendarTitle || "Evento en Google Calendar"}](${verifiedCalendarUrl})` : "");
  const gmailFullMarkdown =
    turnGmailMarkdown ||
    (verifiedGmailUrl ? `[${verifiedGmailTitle || "Correo enviado en Gmail"}](${verifiedGmailUrl})` : "");

  const primaryFallbackMarkdown =
    sheetsFullMarkdown ||
    calendarFullMarkdown ||
    gmailFullMarkdown ||
    (verifiedDriveUrl ? `[Carpeta en Google Drive](${verifiedDriveUrl})` : "");

  // D) filterFinalOutput: si hay spreadsheetId en el turno, sustituir "Abrir en Google Sheets" por markdown con [título](https://docs.google.com/spreadsheets/d/ID/edit)
  if (verifiedSheetsUrl) {
    cleaned = cleaned.replace(/\[(?:Abrir|Abrir en Google Sheets)\](?:\(([^)]*)\))?/gi, () => {
      return sheetsFullMarkdown;
    });
    cleaned = cleaned.replace(/(?:🔗\s*|·\s*)?(?<!\[)Abrir en Google Sheets(?!\s*\]|\s*\([^\s)]+\))/gi, () => {
      return sheetsFullMarkdown;
    });
  } else {
    cleaned = cleaned.replace(/\[Abrir en Google Sheets\]\((?:null|undefined|\s*|\[Enlace no disponible[^)]*\])?\)/gi, `[Google Sheets](https://docs.google.com/spreadsheets/)`);
    cleaned = cleaned.replace(/(?:🔗\s*|·\s*)?Abrir en Google Sheets(?!\s*\]|\s*\([^\s)]+\))/g, `[Google Sheets](https://docs.google.com/spreadsheets/)`);
  }

  // C. Reemplazar "[Abrir en Google Calendar](...)" o texto suelto "Abrir en Google Calendar" por [título](url_https_completa)
  if (calendarFullMarkdown) {
    cleaned = cleaned.replace(/\[(?:Abrir|Abrir en Google Calendar|Ver en Google Calendar|Ver evento)\]\([^)]*\)/gi, () => calendarFullMarkdown);
    cleaned = cleaned.replace(/(?:🔗\s*|·\s*)?(?<!\[)Abrir en Google Calendar(?!\s*\]|\s*\([^\s)]+\))/gi, () => calendarFullMarkdown);
  } else {
    cleaned = cleaned.replace(/\[Abrir en Google Calendar\]\((?:null|undefined|\s*|\[Enlace no disponible[^)]*\])\)/gi, `[Google Calendar](https://calendar.google.com/calendar/u/0/)`);
  }

  // C.2. Reemplazar "[Abrir](url_gmail)" o "[Abrir en Gmail](...)" por [asunto](url_https_completa)
  if (gmailFullMarkdown) {
    cleaned = cleaned.replace(/\[(?:Abrir|Abrir en Gmail|Ver correo|Ver en Gmail)\]\([^)]*\)/gi, () => gmailFullMarkdown);
    cleaned = cleaned.replace(/(?:🔗\s*|·\s*)?(?<!\[)Abrir en Gmail(?!\s*\]|\s*\([^\s)]+\))/gi, () => gmailFullMarkdown);
  }

  // D. Si hay "[Abrir]()", "[Abrir](null)", "[Abrir](undefined)", "[Abrir]([Enlace no disponible...])" o "[Abrir](url)":
  cleaned = cleaned.replace(/\[Abrir\]\(([^)]*)\)/gi, (_match, href) => {
    if (primaryFallbackMarkdown) return primaryFallbackMarkdown;
    if (href && /^https?:\/\//i.test(href.trim())) return `[Enlace directo](${href.trim()})`;
    return "";
  });

  // E. Si hay "🔗 Abrir", "· Abrir", ": Abrir" o línea suelta "Abrir" sin formatear como enlace:
  cleaned = cleaned.replace(/(?:🔗\s*|·\s*|:\s+)\bAbrir\b(?!\s*\]|\s*\([^\s)]+\))/gi, (prefix) => {
    const lead = prefix.trim().startsWith(":") ? ": " : " ";
    return primaryFallbackMarkdown ? `${lead}${primaryFallbackMarkdown}` : "";
  });
  cleaned = cleaned.replace(/^\s*Abrir\s*$/gmi, () => primaryFallbackMarkdown || "");

  // F. Garantizar que tras calendar_create o gmail_send en el turno actual SIEMPRE exista una línea con [título](url_https_completa)
  if (turnCalendarMarkdown && verifiedCalendarUrl && !cleaned.includes(`](${verifiedCalendarUrl})`)) {
    cleaned = `${cleaned.trim()}\n\n${turnCalendarMarkdown}`;
  }
  if (turnGmailMarkdown && verifiedGmailUrl && !cleaned.includes(`](${verifiedGmailUrl})`)) {
    cleaned = `${cleaned.trim()}\n\n${turnGmailMarkdown}`;
  }

  // G. Regla de Noticias / web_search: cada titular listado debe llevar URL devuelta por tool; si no hay URL, omitir el ítem
  if (cleaned.includes("[Enlace no disponible") || hasTurnNewsSearch) {
    const lines = cleaned.split(/\r?\n/);
    const filteredLines: string[] = [];
    for (const line of lines) {
      if (line.includes("[Enlace no disponible")) {
        continue;
      }
      const bulletMatch = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/);
      if (hasTurnNewsSearch && bulletMatch) {
        const bulletBody = bulletMatch[1].trim();
        const hasUrl = /https?:\/\/[^\s)]+/i.test(bulletBody);
        if (!hasUrl) {
          const normBullet = bulletBody.toLowerCase().replace(/[^a-záéíóúüñ0-9\s]/gi, " ");
          const bulletWords = normBullet.split(/\s+/).filter(w => w.length >= 4);
          let matchedItem: { title: string; url: string } | undefined;
          let bestScore = 0;
          for (const item of turnNewsItems) {
            const normTitle = item.title.toLowerCase();
            const hits = bulletWords.filter(w => normTitle.includes(w)).length;
            if (hits >= 2 && hits > bestScore) {
              bestScore = hits;
              matchedItem = item;
            }
          }
          if (matchedItem) {
            const cleanText = bulletBody.replace(/^\*\*|\*\*$/g, "").trim();
            filteredLines.push(`- [${cleanText}](${matchedItem.url})`);
          }
          continue;
        }
      }
      filteredLines.push(line);
    }
    cleaned = filteredLines.join("\n").replace(/\n{3,}/g, "\n\n");
  }

  // 5. Detectar si aún contiene simulaciones crudas residuales de tool calls
  const hasToolSimulations = /tools\.[a-zA-Z0-9_-]+\(/i.test(cleaned) || 
                            /print\((?:gmail_list|web_search|drive_list|read_url|sheets_|calendar_)[^)]*\)/i.test(cleaned) ||
                            /drive_create_text_file\(/i.test(cleaned) || 
                            /sheets_write\(/i.test(cleaned) || 
                            /calendar_create\(/i.test(cleaned);
                            
  if (hasToolSimulations) {
    console.warn("🚨 [Output Filter] Detectada simulación/echo de tool calls en el texto. Purgando llamadas simuladas.");
    cleaned = cleaned.replace(/[a-zA-Z0-9_.]+\((?:\{[\s\S]*?\}|[^\n)]*)\)/gi, "").trim();
    if (!cleaned) {
      return "He procesado tu solicitud. Por favor, indícame si deseas que realice una acción específica con los datos.";
    }
  }

  // 6. Detectar patrones repetitivos infinitos (ej. secuencias de 6+ caracteres repetidas consecutivamente 4+ veces)
  const cleanTrimmed = cleaned.trim();
  for (let len = 6; len <= 30; len++) {
    for (let i = 0; i <= cleanTrimmed.length - len * 4; i++) {
      const chunk = cleanTrimmed.substring(i, i + len);
      const rest = cleanTrimmed.substring(i + len);
      if (rest.startsWith(chunk + chunk + chunk) || rest.startsWith("-" + chunk + "-" + chunk + "-" + chunk)) {
        console.warn(`🚨 [Output Filter] Detectada repetición infinita del chunk "${chunk}".`);
        if (verifiedSheetsUrl) {
          return `[${verifiedSheetsTitle || "Hoja de cálculo"}](${verifiedSheetsUrl})`;
        }
        return "Error interno: se detuvo una generación inválida de ID/hoja. Reintenta la petición.";
      }
    }
  }

  return cleaned.trim();
}

function isProgressMessage(text: string): boolean {
  const clean = text.toLowerCase().trim();
  return (
    clean.includes("generando") ||
    clean.includes("procesando") ||
    clean.includes("buscando") ||
    clean.includes("un momento") ||
    clean.includes("por favor espera") ||
    clean.includes("espera un") ||
    clean.includes("procedo a") ||
    clean.includes("voy a buscar") ||
    clean.includes("voy a generar")
  );
}
