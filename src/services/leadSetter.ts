import { InlineKeyboard } from "grammy";
import { llmService } from "./llm.js";
import { calendarCreate, calendarList } from "../tools/calendar.js";
import { unipileService } from "./unipileService.js";

export interface ProspectingPersona {
  key: string;
  name: string;
  emoji: string;
  targetRole: string;
  mainPain: string;
  dorkSearch: string;
  connectionNote: string;
  followUpMessage: string;
  objections: {
    noTime: string;
    price: string;
    alreadyHaveTools: string;
  };
  meetingProposal: string;
}

export interface PendingLeadReply {
  id: string;
  leadName: string;
  leadRole: string;
  leadProfileUrl?: string;
  messageText: string;
  personaKey?: string;
  suggestedReply: string;
  status: "pending" | "approved" | "edited" | "discarded";
  createdAt: number;
  chatId: number;
  unipileChatId?: string;
  channel?: string;
  proposedSlotStart?: string;
  proposedSlotLabel?: string;
}

export interface PendingLinkedInInvite {
  id: string;
  providerId: string;
  name: string;
  headline: string;
  location: string;
  profileUrl: string;
  note: string;
  chatId: number;
  status: "pending" | "sent" | "discarded";
}

const pendingInvites = new Map<string, PendingLinkedInInvite>();

export const PERSONAS: Record<string, ProspectingPersona> = {
  inmobiliaria: {
    key: "inmobiliaria",
    name: "Agente o Asesor Inmobiliario",
    emoji: "🏡",
    targetRole: "Asesor / Agente Inmobiliario / Broker",
    mainPain: "Pasa el día en la calle visitando inmuebles; perder citas o no poder abrir el portátil en el coche para apuntar datos en Sheets y Calendar.",
    dorkSearch: 'site:linkedin.com/in ("agente inmobiliario" OR "asesor inmobiliario" OR "consultor inmobiliario") [CIUDAD]',
    connectionNote: "Hola [Nombre], veo tu labor con inmuebles en [Zona]. Sé lo caótico que es cuadrar visitas en la calle. Creamos un bot en Telegram que agenda en Calendar por voz. ¿Conectamos?",
    followUpMessage: 
      "¡Hola [Nombre]! Gracias por conectar. Te contacto brevemente porque muchos asesores pierden visitas o notas por estar fuera de la oficina sin poder abrir el ordenador.\n\n" +
      "Con Silvania CoreAgent puedes dictar una nota de voz en Telegram tipo:\n" +
      "👉 'Apunta visita con Juan Pérez el jueves a las 17:00 en Calle Alcalá'\n" +
      "...y el bot te lo deja agendado en tu Google Calendar y registrado en tu Google Sheet de clientes al instante.\n\n" +
      "¿Te cuadra que te pase un vídeo de 2 minutos para que veas cómo funciona?",
    objections: {
      noTime: "Totalmente comprensible, sé que vivís de visita en visita. Son solo 10 min por Google Meet y te llevas ideas prácticas aunque no lo uses. ¿Te viene mejor martes a las 10:00 o jueves a las 16:30?",
      price: "Tiene un coste de suscripción muy asequible para autónomos (menos de lo que cuesta un café al día), sin permanencia y con prueba gratuita de 10 días para que compruebes cuánto tiempo te ahorra.",
      alreadyHaveTools: "La ventaja de CoreAgent es que no reemplaza lo que ya tienes: trabaja directamente sobre el Google Calendar, Sheets y Drive que ya utilizas, pero controlado desde Telegram con lenguaje natural."
    },
    meetingProposal: 
      "Genial [Nombre]. Para mostrártelo en directo en 10 minutos y ver cómo se adapta a tus visitas diarias:\n" +
      "📅 ¿Te viene mejor este Jueves a las 11:00 o Viernes a las 16:30?\n" +
      "En cuanto me confirmes, te paso la sala de Google Meet directa."
  },

  autonomos: {
    key: "autonomos",
    name: "Autónomo o Consultor Profesional",
    emoji: "💼",
    targetRole: "Autónomo / Consultor / Asesor / Freelance",
    mainPain: "Sobrecarga de tareas administrativas: saltar entre 15 pestañas para emitir presupuestos, buscar facturas y organizar la semana.",
    dorkSearch: 'site:linkedin.com/in ("consultor" OR "asesor" OR "autónomo" OR "profesional independiente") [CIUDAD]',
    connectionNote: "Hola [Nombre], como autónomo sé lo frustrante que es saltar entre 10 pestañas para facturar y agendar. Creamos tu oficina ejecutiva en Telegram para Google Workspace. ¿Conectamos?",
    followUpMessage:
      "¡Hola [Nombre]! Qué bueno conectar.\n\n" +
      "Como profesionales independientes, contratar una secretaria ejecutiva cuesta más de 1.200€ al mes. En Silvania hemos creado CoreAgent para que puedas consultar tu agenda, redactar borradores de correo y registrar presupuestos en Google Sheets desde un único chat en Telegram, con permisos mínimos verificados por Google.\n\n" +
      "¿Cómo gestionas tú ahora mismo el tiempo administrativo en tu día a día?",
    objections: {
      noTime: "Te entiendo al 100%, ser autónomo es no tener un minuto libre. Justo por eso te interesará: son 10 min de llamada para ahorrarte 2 horas al día. ¿Cuándo tienes un hueco corto esta semana?",
      price: "El acceso anticipado tiene tarifa plana para autónomos y te permite recuperar la inversión en la primera semana de uso gracias al tiempo que ahorras en tareas repetitivas.",
      alreadyHaveTools: "Lo mejor es que no tienes que aprender un software nuevo: opera sobre el Google Workspace que ya tienes configurado en tu día a día."
    },
    meetingProposal:
      "Estupendo [Nombre]. Te propongo un Google Meet rápido de 10 minutos para enseñarte cómo opera desde Telegram:\n" +
      "📅 Tengo hueco el Martes a las 11:00 o Jueves a las 17:00, ¿cuál te encaja mejor?"
  },

  comerciales: {
    key: "comerciales",
    name: "Comercial o Ejecutivo de Cuentas B2B",
    emoji: "📞",
    targetRole: "Comercial / Account Executive / Director de Ventas",
    mainPain: "Tener que pasar notas de reuniones y actualizar hojas de cálculo de clientes al final del día.",
    dorkSearch: 'site:linkedin.com/in ("ejecutivo de cuentas" OR "account executive" OR "responsable comercial") [CIUDAD]',
    connectionNote: "Hola [Nombre], veo tu labor comercial en [Empresa]. Si te da pereza actualizar hojas de clientes tras cada llamada, creamos un bot que lo hace por ti desde Telegram. ¿Conectamos?",
    followUpMessage:
      "¡Hola [Nombre]! Te contacto porque sé de primera mano lo tedioso que es terminar 5 reuniones y tener que sentarse a actualizar el CRM o la hoja de cálculo.\n\n" +
      "Con CoreAgent, cuelgas la llamada, abres Telegram y dictas: 'Reunión con Marta de Empresa X, le interesa el plan anual, agendar seguimiento el viernes'. El agente registra el dato en Google Sheets y te crea el recordatorio en Google Calendar.\n\n" +
      "¿Te gustaría probarlo gratis 10 días para ver cómo te aligera el día?",
    objections: {
      noTime: "¡Claro! Los comerciales siempre estamos en llamada. Son 10 minutos justos para que lo veas en tu móvil. ¿Te encaja un café virtual el miércoles a las 10:30?",
      price: "Es una herramienta de productividad personal; se amortiza sola cerrando un cliente gracias al seguimiento puntual que te hace el bot.",
      alreadyHaveTools: "Complementa perfectamente a cualquier CRM corporativo porque te sirve de puente rápido mientras estás en movilidad."
    },
    meetingProposal:
      "Perfecto [Nombre]. Agendamos una demo ágil de 10 min con Google Meet:\n" +
      "📅 ¿Te viene mejor Miércoles a las 10:30 o Jueves a las 12:00?"
  },

  emprendedores: {
    key: "emprendedores",
    name: "Emprendedor o Fundador de Pyme",
    emoji: "🚀",
    targetRole: "Fundador / CEO / Co-founder / Director General",
    mainPain: "Falta de foco y tiempo; el fundador pasa demasiado tiempo en micro-gestión operativa en lugar de en estrategia y ventas.",
    dorkSearch: 'site:linkedin.com/in ("fundador" OR "co-founder" OR "ceo" OR "director general") [CIUDAD]',
    connectionNote: "Hola [Nombre], enhorabuena por el crecimiento de [Empresa]. De fundador a fundador: creamos una oficina en Telegram para no perder tiempo en Google Workspace. Me encantaría conectar.",
    followUpMessage:
      "¡Hola [Nombre]! Te escribo brevemente de fundador a fundador.\n\n" +
      "Sé lo difícil que es mantener el foco cuando la operativa diaria te consume horas. En Silvania creamos CoreAgent para centralizar la agenda, métricas de Sheets y gestión de archivos de tu empresa directamente en Telegram, sobre el Google Workspace que tu equipo ya utiliza.\n\n" +
      "¿Te encajaría una demo de 10 minutos este jueves a las 11:00 o viernes a las 16:30 para ver si le ahorra tiempo a tu equipo?",
    objections: {
      noTime: "Lo sé bien, el tiempo de un fundador es lo más escaso. Te prometo que en 10 minutos sabrás si esto le ahorra 10 horas semanales a tu equipo. ¿Viernes a las 12:00?",
      price: "Diseñado para pymes que quieren máxima eficiencia sin inflar los costes fijos de personal administrativo.",
      alreadyHaveTools: "Cero fricción de adopción: tu equipo no tiene que instalar nada nuevo; funciona en su Telegram sobre las cuentas de Google que ya usan."
    },
    meetingProposal:
      "Excelente [Nombre]. Hagamos un Google Meet de 10 minutos:\n" +
      "📅 ¿Te encaja este Jueves a las 11:00 o Viernes a las 16:30?"
  }
};

// Store en memoria para respuestas entrantes pendientes de aprobación
const pendingReplies = new Map<string, PendingLeadReply>();

// Límite diario estricto anti-baneos (máx 10 leads diarios por defecto)
const MAX_DAILY_LEADS = 10;
const dailyUsageTracker = new Map<string, { date: string; count: number }>();

export type SetterMode = "hitl" | "auto";
const setterModeTracker = new Map<number, SetterMode>();
const seenProspectIdsByUser = new Map<number, Set<string>>();
const searchCursorByUserQuery = new Map<string, string>();

function getTodayKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" }); // YYYY-MM-DD
}

export const leadSetter = {
  getSetterMode(userId: number): SetterMode {
    return setterModeTracker.get(userId) || "hitl";
  },

  setSetterMode(userId: number, mode: SetterMode): void {
    setterModeTracker.set(userId, mode);
  },

  /**
   * Comprueba si el usuario ha alcanzado el límite diario seguro (10 leads).
   */
  checkDailyLimit(userId: number): { allowed: boolean; currentCount: number; max: number } {
    const today = getTodayKey();
    const userKey = String(userId);
    const record = dailyUsageTracker.get(userKey);

    if (!record || record.date !== today) {
      dailyUsageTracker.set(userKey, { date: today, count: 0 });
      return { allowed: true, currentCount: 0, max: MAX_DAILY_LEADS };
    }

    return {
      allowed: record.count < MAX_DAILY_LEADS,
      currentCount: record.count,
      max: MAX_DAILY_LEADS
    };
  },

  /**
   * Incrementa el contador diario o desbloquea un lote adicional con /setter more
   */
  incrementDailyCount(userId: number, quantity: number = 10): void {
    const today = getTodayKey();
    const userKey = String(userId);
    const record = dailyUsageTracker.get(userKey);

    if (!record || record.date !== today) {
      dailyUsageTracker.set(userKey, { date: today, count: quantity });
    } else {
      record.count += quantity;
    }
  },

  /**
   * Desbloquea un lote extra manual (/setter more o /setter 10)
   */
  unlockExtraBatch(userId: number): void {
    const userKey = String(userId);
    const today = getTodayKey();
    // Reinicia el contador diario para permitir un nuevo lote de 10
    dailyUsageTracker.set(userKey, { date: today, count: 0 });
  },

  /**
   * Genera el pack completo de prospección adaptado a un nicho o perfil
   */
  getPack(personaKey: string, city: string = "España"): ProspectingPersona | undefined {
    const normKey = personaKey.toLowerCase().trim();
    let foundKey = "autonomos";

    if (normKey.includes("inmob") || normKey.includes("piso") || normKey.includes("casa")) {
      foundKey = "inmobiliaria";
    } else if (normKey.includes("comer") || normKey.includes("ventas") || normKey.includes("sales")) {
      foundKey = "comerciales";
    } else if (normKey.includes("empren") || normKey.includes("fundad") || normKey.includes("ceo") || normKey.includes("startup")) {
      foundKey = "emprendedores";
    } else {
      foundKey = "autonomos";
    }

    const persona = PERSONAS[foundKey];
    if (!persona) return undefined;

    return {
      ...persona,
      dorkSearch: persona.dorkSearch.replace("[CIUDAD]", city.trim() ? `"${city.trim()}"` : "")
    };
  },

  /**
   * Formatea el pack de prospección en Markdown listo para el chat de Telegram
   */
  formatTelegramReport(persona: ProspectingPersona, city: string = "España"): string {
    const keywordMap: Record<string, string> = {
      inmobiliaria: "asesor inmobiliario",
      autonomos: "consultor autonomo",
      comerciales: "ejecutivo comercial ventas",
      emprendedores: "fundador ceo director"
    };
    const baseKeyword = keywordMap[persona.key] || "consultor";
    const linkedinDirectUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${baseKeyword} ${city}`)}`;
    const googleDirectUrl = `https://www.google.com/search?q=${encodeURIComponent(persona.dorkSearch)}`;

    const validationUniversalNote = "¡Hola! Estamos validando una herramienta verificada por Google que gestiona por voz tu Google Workspace desde Telegram. Es gratis. ¿Conectamos?";
    const noNoteFollowUpShort =
      "¡Hola! Gracias por conectar. Estamos validando una IA verificada por Google para gestionar Calendar, Gmail y Sheets por voz desde Telegram y ahorrar 2h al día en tareas repetitivas, como agendar reuniones. ¿Te paso el enlace para que la pruebes? ¡Es gratis!";
    const validationFollowUp =
      "¡Gracias por conectar! Estamos en fase de validación de Silvania CoreAgent (https://silvania.ai): un asistente verificado por Google que te permite agendar en Calendar, registrar datos en Sheets y redactar correos simplemente enviando un audio en Telegram.\n\n" +
      "Estamos dando acceso gratuito a profesionales para conocer vuestro feedback real y ahorrarte hasta 2h al día.\n\n" +
      "¿Te paso el acceso directo para probarlo gratis o prefieres verlo en 5 min por Google Meet?";

    return (
      `🎯 *PLAYBOOK SETTER B2B: ${persona.name.toUpperCase()}*\n` +
      `───────────────────────────\n\n` +
      `📌 *Perfil Objetivo:* ${persona.targetRole}\n` +
      `⚠️ *Dolor Principal:* _${persona.mainPain}_\n\n` +
      `🚀 *Búsqueda Directa en 1 Clic (Sin copiar nada):*\n` +
      `• 👉 [Abrir Lista de Personas en LinkedIn](${linkedinDirectUrl})\n` +
      `• 🌐 [Abrir Perfiles desde Google](${googleDirectUrl})\n\n` +
      `⭐ *1A. Nota Universal de Validación (143 caracteres - Copiar y pegar directo sin editar nada):*\n` +
      `\`\`\`text\n${validationUniversalNote}\n\`\`\`\n\n` +
      `📨 *1B. Nota Personalizada por Sector (< 200 caracteres):*\n` +
      `\`\`\`text\n${persona.connectionNote}\n\`\`\`\n\n` +
      `💬 *2A. Si enviaste "Conectar" SIN nota y te han aceptado (Corto y Directo):*\n` +
      `\`\`\`text\n${noNoteFollowUpShort}\n\`\`\`\n\n` +
      `💬 *2B. Mensaje Completo tras Conectar (Enfoque Validación Gratis):*\n` +
      `\`\`\`text\n${validationFollowUp}\n\`\`\`\n\n` +
      `💬 *2C. Mensaje tras Conectar (Enfoque Dolor Específico):*\n` +
      `\`\`\`text\n${persona.followUpMessage}\n\`\`\`\n\n` +
      `🛡️ *3. Manejo de Objeciones:*\n` +
      `• *Si dice "No tengo tiempo":*\n_${persona.objections.noTime}_\n\n` +
      `• *Si pregunta por el precio:*\n_${persona.objections.price}_\n\n` +
      `• *Si dice "Ya uso otras herramientas":*\n_${persona.objections.alreadyHaveTools}_\n\n` +
      `📅 *4. Propuesta de Cierre en Google Calendar:* \n` +
      `\`\`\`text\n${persona.meetingProposal}\n\`\`\`\n\n` +
      `🎥 *Google Meet:* Automático con enlace único generado por Google Calendar.\n\n` +
      `🛡️ *Seguridad Anti-Baneo:* Límite seguro activo (10 invitaciones/día). Para pedir 10 adicionales: \`/setter more\` o \`/setter 10\`.`
    );
  },

  /**
   * Calcula 2 huecos reales en los próximos días laborables consultando Google Calendar si está conectado.
   */
  async getSuggestedCalendarSlots(userId: number): Promise<{ primaryStart: string; primaryLabel: string; secondaryStart: string; secondaryLabel: string }> {
    const candidateDays: Date[] = [];
    const cursor = new Date();
    cursor.setDate(cursor.getDate() + 1);
    while (candidateDays.length < 2) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) {
        candidateDays.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    let calendarText = "";
    try {
      if (userId > 0) {
        calendarText = await calendarList(userId, 4);
      }
    } catch {}

    const formatDayLabel = (d: Date, hour: string) => {
      const dayName = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short", timeZone: "Europe/Madrid" });
      return `${dayName} a las ${hour}`;
    };

    const pickHourForDay = (d: Date, preferredHours: string[]): string => {
      const isoDate = d.toISOString().split("T")[0];
      for (const h of preferredHours) {
        if (!calendarText || !calendarText.includes(isoDate) || !calendarText.includes(h)) {
          return h;
        }
      }
      return preferredHours[0];
    };

    const d1 = candidateDays[0];
    const d2 = candidateDays[1];
    const h1 = pickHourForDay(d1, ["10:30", "11:30", "16:30"]);
    const h2 = pickHourForDay(d2, ["16:30", "12:00", "10:30"]);
    const d1Iso = d1.toISOString().split("T")[0];
    const d2Iso = d2.toISOString().split("T")[0];

    return {
      primaryStart: `${d1Iso}T${h1}:00`,
      primaryLabel: formatDayLabel(d1, h1),
      secondaryStart: `${d2Iso}T${h2}:00`,
      secondaryLabel: formatDayLabel(d2, h2),
    };
  },

  /**
   * Genera una respuesta inteligente con IA a un mensaje entrante (LinkedIn / Unipile) usando el contexto del hilo.
   * Distingue tono peer/networking vs. interés real en llamada; prohibido el pitch genérico si no piden call o el hilo no está maduro.
   */
  async generateSuggestedReply(
    leadName: string,
    leadRole: string,
    messageText: string,
    personaKey?: string,
    slots?: { primaryLabel: string; secondaryLabel: string },
    threadHistory?: Array<{ sender: "me" | "lead"; text: string }>
  ): Promise<string> {
    const slot1 = slots?.primaryLabel || "mañana a las 10:30";
    const slot2 = slots?.secondaryLabel || "pasado mañana a las 16:30";

    const historyText = threadHistory && threadHistory.length > 0
      ? threadHistory.map((m) => `${m.sender === "me" ? "Nosotros" : leadName}: "${m.text}"`).join("\n")
      : "(Primer mensaje / sin historial previo)";

    const leadTurns = (threadHistory || []).filter((m) => m.sender === "lead").length;
    const explicitCallRequest = /reuni[oó]n|llamada|call|meet|demo|hueco|agendar|verlo|cu[aá]ndo hablamos|ens[eé]ñame|probarlo/i.test(messageText);
    const isMatureThread = leadTurns >= 3 && /interesa|silvania|funciona|tiempo|probar/i.test(messageText);
    const canOfferCalendar = explicitCallRequest || isMatureThread;

    try {
      const prompt =
        `Eres Eduardo (fundador de Silvania AI) respondiendo un mensaje real en LinkedIn.\n\n` +
        `DATOS DEL CONTACTO:\n` +
        `- Nombre: ${leadName}\n` +
        `- Cargo/Bio: ${leadRole}\n\n` +
        `ÚLTIMOS MENSAJES DEL HILO:\n${historyText}\n\n` +
        `ÚLTIMO MENSAJE RECIBIDO:\n"${messageText}"\n\n` +
        `REGLAS ESTRICTAS DE RESPUESTA:\n` +
        `1. Longitud: 2 a 3 frases cortas, tono humano real, cercano y entre colegas (cero tono robótico o comercial agresivo).\n` +
        `2. DETECCIÓN PEER / NETWORKING: Si es otro fundador, CEO o profesional contándonos su propio producto/proyecto, haciendo networking o respondiendo cordialmente SIN pedir una demo, RESPONDE DIRECTAMENTE AL CONTENIDO de lo que nos cuenta (muestra interés genuino en su trabajo o comenta su punto). PROHIBIDO soltar el pitch genérico de "10 min por Google Meet" o mencionar huecos.\n` +
        (canOfferCalendar
          ? `3. El contacto pide llamada/demo o el hilo ya está maduro: propón amablemente nuestros huecos libres reales (${slot1} o ${slot2}) para verlo en 10 min por Google Meet.\n`
          : `3. NO ofrezcas huecos de calendario ni pidas videollamada todavía porque aún no ha pedido call ni el hilo está maduro para cerrar.\n`) +
        `4. Nunca inventes precios ni tarifas (estamos en validación privada a cambio de feedback/testimonio).\n` +
        `5. Devuelve EXCLUSIVAMENTE el texto de la respuesta, sin comillas ni explicaciones.`;

      const response = await llmService.chatSimple([
        { role: "system", content: "Respondes mensajes reales de LinkedIn con naturalidad, empatía y contexto exacto del hilo." },
        { role: "user", content: prompt }
      ]);

      const text = response?.content ? String(response.content).trim() : "";
      if (text) return text;
    } catch (err: any) {
      console.warn("⚠️ Falló llamada a LLM para respuesta sugerida, usando fallback contextual:", err.message);
    }

    const firstName = leadName.split(" ")[0] || leadName;
    if (canOfferCalendar) {
      return `¡Genial ${firstName}! Si quieres te lo enseño en 10 min por Google Meet. Tengo libre ${slot1} o ${slot2}, ¿cuál te encaja mejor?`;
    }
    return `¡Muchas gracias por compartirlo, ${firstName}! Me parece muy interesante lo que comentas. ¿Qué es lo que más tiempo te consume ahora mismo en tu día a día?`;
  },

  /**
   * Crea un registro de mensaje entrante pendiente de aprobación HITL en Telegram
   */
  async createPendingLeadReply(opts: {
    leadName: string;
    leadRole: string;
    leadProfileUrl?: string;
    messageText: string;
    personaKey?: string;
    chatId: number;
    customSuggestedReply?: string;
    unipileChatId?: string;
    channel?: string;
  }): Promise<PendingLeadReply> {
    const id = `lr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const slots = await this.getSuggestedCalendarSlots(opts.chatId);
    const threadHistory = opts.unipileChatId
      ? await unipileService.getChatMessages(opts.unipileChatId, 6)
      : [];
    const suggested = opts.customSuggestedReply || await this.generateSuggestedReply(
      opts.leadName,
      opts.leadRole,
      opts.messageText,
      opts.personaKey,
      slots,
      threadHistory
    );

    const pending: PendingLeadReply = {
      id,
      leadName: opts.leadName,
      leadRole: opts.leadRole,
      leadProfileUrl: opts.leadProfileUrl,
      messageText: opts.messageText,
      personaKey: opts.personaKey,
      suggestedReply: suggested,
      status: "pending",
      createdAt: Date.now(),
      chatId: opts.chatId,
      unipileChatId: opts.unipileChatId,
      channel: opts.channel,
      proposedSlotStart: slots.primaryStart,
      proposedSlotLabel: slots.primaryLabel,
    };

    pendingReplies.set(id, pending);
    return pending;
  },

  /**
   * Envía la alerta interactiva HITL a Telegram con botones de aprobación, envío por Unipile y agenda en Calendar
   */
  async sendApprovalAlert(bot: any, chatId: number, reply: PendingLeadReply): Promise<void> {
    const hasUnipile = Boolean(reply.unipileChatId);
    const channelBadge = hasUnipile
      ? (unipileService.isConfigured() ? `Unipile · ${reply.channel || "LINKEDIN"}` : `Simulador Unipile · ${reply.channel || "LINKEDIN"}`)
      : "LinkedIn Manual";

    const keyboard = new InlineKeyboard()
      .text(hasUnipile ? "✅ Aprobar y Enviar" : "✅ Aprobar Respuesta", `setter_app_${reply.id}`)
      .text("📅 Enviar + Agendar Cita", `setter_appmeet_${reply.id}`)
      .row()
      .text("✏️ Modificar", `setter_edit_${reply.id}`)
      .text("❌ Descartar", `setter_disc_${reply.id}`);

    const message =
      `🔔 *Nuevo mensaje de ${reply.leadName}* (${reply.leadRole})\n` +
      `📡 *Canal:* ${channelBadge}\n` +
      `💬 "${reply.messageText}"\n\n` +
      `🤖 *Respuesta sugerida por Setter IA:*\n` +
      `"${reply.suggestedReply}"\n\n` +
      (reply.proposedSlotLabel ? `📅 *Hueco Calendar listo:* ${reply.proposedSlotLabel}` : "");

    await bot.api.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  },

  /**
   * Procesa los callbacks de Telegram para aprobación HITL, envío Unipile y agendado en Google Calendar
   */
  async handleCallback(bot: any, ctx: any): Promise<boolean> {
    const data = ctx.callbackQuery?.data || "";
    if (!data.startsWith("setter_")) return false;

    await ctx.answerCallbackQuery().catch(() => {});

    // Aprobar y Enviar (o Enviar + Agendar Cita en 1 clic)
    if (data.startsWith("setter_app_") || data.startsWith("setter_appmeet_")) {
      const alsoSchedule = data.startsWith("setter_appmeet_");
      const id = data.replace("setter_appmeet_", "").replace("setter_app_", "");
      const item = pendingReplies.get(id);

      if (!item) {
        await ctx.reply("⚠️ Este mensaje ya ha expirado o no se encuentra en memoria.");
        return true;
      }

      item.status = "approved";

      let sendStatusLine = `💬 *Texto Listo:* (Copia y pega en LinkedIn):\n\`\`\`text\n${item.suggestedReply}\n\`\`\``;
      if (item.unipileChatId) {
        const sendRes = await unipileService.sendMessage(item.unipileChatId, item.suggestedReply);
        if (sendRes.ok && !sendRes.simulated) {
          sendStatusLine = `🚀 *Enviado automáticamente vía Unipile (${item.channel || "LINKEDIN"})*\n_"${item.suggestedReply}"_`;
        } else if (sendRes.ok && sendRes.simulated) {
          sendStatusLine = `🧪 *Simulador Unipile OK* (conecta \`UNIPILE_DSN\` + \`UNIPILE_API_KEY\` en Railway para envío real):\n\`\`\`text\n${item.suggestedReply}\n\`\`\``;
        } else {
          sendStatusLine = `⚠️ *No se pudo enviar por Unipile (${sendRes.error}):*\n\`\`\`text\n${item.suggestedReply}\n\`\`\``;
        }
      }

      let calendarLine = `*(Si el prospecto acepta, pulsa abajo para agendar en Google Calendar)*`;
      if (alsoSchedule) {
        const uId = ctx.from?.id || item.chatId || 0;
        const startDt = item.proposedSlotStart || `${new Date(Date.now() + 86400000).toISOString().split("T")[0]}T11:00:00`;
        const [dPart, tPart] = startDt.split("T");
        const [hh, mm] = tPart.split(":").map(Number);
        const endDate = new Date(2000, 0, 1, hh, mm + 15);
        const endDt = `${dPart}T${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}:00`;
        try {
          const calendarRes = await calendarCreate(
            uId,
            `Demo Silvania CoreAgent - ${item.leadName}`,
            startDt,
            endDt,
            `Demostración de 15 minutos de Silvania CoreAgent con ${item.leadName} (${item.leadRole}).\nOrigen: Setter IA (${item.channel || "LinkedIn"}).`
          );
          calendarLine = `🎉 *¡CITA PROGRAMADA EN GOOGLE CALENDAR!* 🎥\n${calendarRes}`;
        } catch (calErr: any) {
          calendarLine = `⚠️ *No se pudo crear la cita en Calendar:* ${calErr.message}`;
        }
      }

      const meetKeyboard = alsoSchedule
        ? undefined
        : new InlineKeyboard().text("📅 Agendar Google Meet", `setter_meet_${id}`);

      const approvedMsg =
        `✅ *Respuesta APROBADA*\n` +
        `───────────────────────────\n\n` +
        `👤 *Destinatario:* ${item.leadName} (${item.leadRole})\n` +
        (item.leadProfileUrl ? `🔗 *Perfil:* [Ver Perfil](${item.leadProfileUrl})\n\n` : `\n`) +
        `${sendStatusLine}\n\n` +
        `${calendarLine}`;

      try {
        await ctx.editMessageText(approvedMsg, {
          parse_mode: "Markdown",
          ...(meetKeyboard ? { reply_markup: meetKeyboard } : {})
        });
      } catch {
        await ctx.reply(approvedMsg, {
          parse_mode: "Markdown",
          ...(meetKeyboard ? { reply_markup: meetKeyboard } : {})
        });
      }
      return true;
    }

    // Modificar
    if (data.startsWith("setter_edit_")) {
      const id = data.replace("setter_edit_", "");
      const item = pendingReplies.get(id);
      if (!item) {
        await ctx.reply("⚠️ Registro no encontrado.");
        return true;
      }

      await ctx.reply(
        `✏️ *Modificar Respuesta para ${item.leadName}:*\n\n` +
        `Para personalizar el mensaje, escribe:\n` +
        `\`/setter responder ${item.leadName} | [tu nuevo texto]\`\n\n` +
        `O simplemente dicta una nota de voz con lo que deseas responderle.`,
        { parse_mode: "Markdown" }
      );
      return true;
    }

    // Descartar
    if (data.startsWith("setter_disc_")) {
      const id = data.replace("setter_disc_", "");
      const item = pendingReplies.get(id);
      if (item) item.status = "discarded";

      try {
        await ctx.editMessageText(`❌ Conversación con *${item?.leadName || "prospecto"}* descartada.`, {
          parse_mode: "Markdown"
        });
      } catch {
        await ctx.reply(`❌ Conversación descartada.`);
      }
      return true;
    }

    // Agendar Google Meet
    if (data.startsWith("setter_meet_")) {
      const id = data.replace("setter_meet_", "");
      const item = pendingReplies.get(id);
      const leadTitle = item ? item.leadName : "Prospecto LinkedIn";
      const uId = ctx.from?.id || 0;

      // Calcular fecha automática: mañana a las 11:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split("T")[0];
      const startDateTime = `${dateStr}T11:00:00+02:00`;
      const endDateTime = `${dateStr}T11:15:00+02:00`;

      try {
        const calendarRes = await calendarCreate(
          uId,
          `Demo Silvania CoreAgent - ${leadTitle}`,
          startDateTime,
          endDateTime,
          `Demostración de 10 minutos de Silvania CoreAgent para Google Workspace con ${leadTitle}.\nProspecto originado en LinkedIn.`
        );

        await ctx.reply(
          `🎉 *¡REUNIÓN CREADA EN GOOGLE CALENDAR!* 🎥\n` +
          `───────────────────────────\n\n` +
          `👤 *Contacto:* ${leadTitle}\n` +
          `📅 *Horario Tentativo:* Mañana a las 11:00 (15 min)\n` +
          `🔗 *Detalles del Evento y Sala Google Meet:*\n${calendarRes}`,
          { parse_mode: "Markdown" }
        );
      } catch (err: any) {
        await ctx.reply(`❌ No se pudo crear el evento en Calendar: ${err.message}`);
      }
      return true;
    }

    // Enviar invitación de LinkedIn vía Unipile (HITL)
    if (data.startsWith("setter_inv_send_")) {
      const id = data.replace("setter_inv_send_", "");
      const item = pendingInvites.get(id);
      if (!item) {
        await ctx.reply("⚠️ Esta invitación ya ha expirado.");
        return true;
      }

      const limit = this.checkDailyLimit(item.chatId);
      if (!limit.allowed) {
        await ctx.reply("🛡️ Límite diario de seguridad alcanzado (10/10). Escribe `/setter more` para autorizar otro lote.", { parse_mode: "Markdown" });
        return true;
      }

      const res = await unipileService.sendLinkedInInvite(item.providerId, item.note);
      if (res.ok) {
        item.status = "sent";
        this.incrementDailyCount(item.chatId, 1);
        const badge = res.simulated ? "🧪 Simulado" : "📤 Enviada en vivo por Unipile";
        try {
          await ctx.editMessageText(
            `✅ *Invitación a conectar enviada* (${badge})\n\n` +
            `👤 *Prospecto:* ${item.name}\n` +
            `💼 ${item.headline}\n` +
            `💬 _"${item.note}"_`,
            { parse_mode: "Markdown" }
          );
        } catch {
          await ctx.reply(`✅ Invitación enviada a *${item.name}*.`, { parse_mode: "Markdown" });
        }
      } else {
        await ctx.reply(`❌ No se pudo enviar la invitación a *${item.name}*: ${res.error || "Error desconocido"}`, { parse_mode: "Markdown" });
      }
      return true;
    }

    // Descartar invitación de LinkedIn
    if (data.startsWith("setter_inv_disc_")) {
      const id = data.replace("setter_inv_disc_", "");
      const item = pendingInvites.get(id);
      if (item) item.status = "discarded";
      try {
        await ctx.editMessageText(`❌ Prospecto *${item?.name || "LinkedIn"}* descartado.`, { parse_mode: "Markdown" });
      } catch {}
      return true;
    }

    // Cambiar modo híbrido (Autónomo Total vs Asistido HITL)
    if (data === "setter_mode_auto" || data === "setter_mode_hitl") {
      const uId = ctx.from?.id || 1572946817;
      const newMode: SetterMode = data === "setter_mode_auto" ? "auto" : "hitl";
      this.setSetterMode(uId, newMode);
      const kb = new InlineKeyboard()
        .text(newMode === "auto" ? "🤖 Autónomo Total (Activo ✅)" : "🤖 Autónomo Total", "setter_mode_auto")
        .text(newMode === "hitl" ? "🛡️ Asistido HITL (Activo ✅)" : "🛡️ Asistido HITL", "setter_mode_hitl");
      const label = newMode === "auto"
        ? "🤖 *MODO AUTÓNOMO TOTAL ACTIVADO*\nEl Setter IA responderá automáticamente los mensajes entrantes por Unipile y enviará invitaciones directas (respetando el tope seguro de 10/día) enviándote solo el resumen a Telegram."
        : "🛡️ *MODO ASISTIDO HITL ACTIVADO*\nEl Setter IA preparará cada respuesta e invitación y esperará tu clic en Telegram antes de enviarla.";
      try {
        await ctx.editMessageText(label, { parse_mode: "Markdown", reply_markup: kb });
      } catch {
        await ctx.reply(label, { parse_mode: "Markdown", reply_markup: kb });
      }
      return true;
    }

    return false;
  },

  /**
   * Procesa un mensaje entrante de Unipile según el modo activo del usuario (HITL o Autónomo Total).
   */
  async processIncomingLeadMessage(bot: any, chatId: number, reply: PendingLeadReply): Promise<void> {
    const mode = this.getSetterMode(chatId);
    if (mode === "auto" && reply.unipileChatId) {
      const sendRes = await unipileService.sendMessage(reply.unipileChatId, reply.suggestedReply);
      if (sendRes.ok) {
        reply.status = "approved";
        const badge = sendRes.simulated ? "🧪 Simulado" : "📤 Enviado en vivo";
        const kb = new InlineKeyboard().text("📅 Agendar Cita en Calendar", `setter_meet_${reply.id}`);
        await bot.api.sendMessage(
          chatId,
          `🤖 *[MODO AUTÓNOMO] Respuesta enviada a ${reply.leadName}* (${reply.channel || "LINKEDIN"} · ${badge})\n\n` +
          `💬 *Mensaje del lead:* "${reply.messageText}"\n\n` +
          `✅ *Respuesta enviada:* "${reply.suggestedReply}"`,
          { parse_mode: "Markdown", reply_markup: kb }
        );
        return;
      }
    }
    await this.sendApprovalAlert(bot, chatId, reply);
  },

  /**
   * Busca prospectos en LinkedIn vía Unipile y envía tarjetas HITL (o ejecuta envío autónomo si está en modo 'auto').
   */
  async searchAndPresentProspects(bot: any, chatId: number, keywords: string, limit: number = 5): Promise<void> {
    const limitCheck = this.checkDailyLimit(chatId);
    if (!limitCheck.allowed) {
      await bot.api.sendMessage(
        chatId,
        "🛡️ *LÍMITE DIARIO DE SEGURIDAD ALCANZADO (10/10)*\nPara proteger tu cuenta de LinkedIn, escribe `/setter more` si deseas desbloquear otro lote.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    const mode = this.getSetterMode(chatId);
    const modeTag = mode === "auto" ? "🤖 Autónomo Total" : "🛡️ Asistido HITL";

    // Parseo de ciudad pedida e intención de autónomo / pequeño negocio
    const normKw = keywords.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cityMatch = normKw.match(/\ben\s+([a-z\s]{3,25})$/i);
    const knownCities = ["valencia", "madrid", "barcelona", "sevilla", "malaga", "bilbao", "zaragoza", "alicante", "murcia", "palma", "vigo", "granada", "cordoba", "valladolid"];
    const requestedCity = (cityMatch ? cityMatch[1].trim() : knownCities.find((c) => normKw.includes(c))) || "";
    const wantsSmallBiz = /autonom|pequen|microempresa|negocio local|comercio|tienda|freelance|independiente/i.test(normKw);

    // Reforzar keywords de búsqueda (quitando conectores vacíos para mejorar precisión en LinkedIn)
    const searchQuery = keywords
      .replace(/\b(con negocio peque[ñn]o|negocio peque[ñn]o)\b/gi, "autónomo pequeño negocio")
      .replace(/\s+/g, " ")
      .trim();

    await bot.api.sendMessage(
      chatId,
      `🔎 Buscando prospectos reales en tu LinkedIn para: *"${keywords}"* (${modeTag})...`,
      { parse_mode: "Markdown" }
    );

    if (!seenProspectIdsByUser.has(chatId)) {
      seenProspectIdsByUser.set(chatId, new Set<string>());
    }
    const seenIds = seenProspectIdsByUser.get(chatId)!;
    const cursorKey = `${chatId}:${normKw}`;
    let cursor = searchCursorByUserQuery.get(cursorKey);

    const candidatePool: any[] = [];
    let lastError: string | undefined;

    // Hasta 2 páginas para garantizar suficientes perfiles nuevos no repetidos y bien filtrados
    for (let page = 0; page < 2; page++) {
      const searchRes = await unipileService.searchLinkedInPeople(searchQuery, 20, cursor);
      if (!searchRes.ok) {
        lastError = searchRes.error;
        break;
      }
      if (searchRes.nextCursor) {
        cursor = searchRes.nextCursor;
        searchCursorByUserQuery.set(cursorKey, cursor);
      } else {
        searchCursorByUserQuery.delete(cursorKey);
      }

      for (const p of searchRes.prospects) {
        if (!seenIds.has(p.id) && !candidatePool.some((c) => c.id === p.id)) {
          candidatePool.push(p);
        }
      }
      if (candidatePool.length >= 12 || !searchRes.nextCursor) break;
    }

    if (lastError && candidatePool.length === 0) {
      await bot.api.sendMessage(chatId, `❌ Error buscando en LinkedIn vía Unipile: ${lastError}`);
      return;
    }

    // Puntuación y filtrado por relevancia (ciudad + perfil autónomo/pequeño negocio vs corporativo)
    const scored = candidatePool.map((p) => {
      let score = 0;
      const locNorm = (p.location || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const headNorm = (p.headline || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      if (requestedCity) {
        if (locNorm.includes(requestedCity) || headNorm.includes(requestedCity)) {
          score += 20;
        } else if (locNorm.length > 0) {
          score -= 25;
        }
      }

      if (wantsSmallBiz) {
        if (/\b(director|specification manager|multinacional|enterprise|head of|vp|vice president|corporate)\b/i.test(headNorm)) {
          score -= 15;
        }
        if (/\b(autonom|freelance|independiente|propietari|duen|fundador|tienda|comercio|clinica|despacho|consultor|pequen|pyme|gerente)\b/i.test(headNorm)) {
          score += 10;
        }
      }

      return { prospect: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const strictMatches = scored.filter((s) => s.score >= 0).map((s) => s.prospect);
    const selectedProspects = (strictMatches.length >= limit ? strictMatches : scored.map((s) => s.prospect)).slice(0, limit);

    if (selectedProspects.length === 0) {
      await bot.api.sendMessage(chatId, `⚠️ No encontré nuevos contactos (no vistos aún) para "${keywords}". Prueba con otras palabras clave.`);
      return;
    }

    // Marcar como vistos para que la siguiente búsqueda igual no repita estos perfiles
    for (const p of selectedProspects) {
      seenIds.add(p.id);
    }

    if (mode === "auto") {
      const remaining = Math.max(0, limitCheck.max - limitCheck.currentCount);
      const batch = selectedProspects.slice(0, remaining);
      const results: string[] = [];
      let sentCount = 0;

      for (const p of batch) {
        const firstName = p.name.split(" ")[0] || p.name;
        const note = `Hola ${firstName}, veo tu labor en el sector. Validamos Silvania, una IA en Telegram que ahorra horas en agenda y leads (acceso gratis por feedback). ¿Conectamos?`.slice(0, 195);
        const sendRes = await unipileService.sendLinkedInInvite(p.id, note);
        if (sendRes.ok) {
          sentCount++;
          this.incrementDailyCount(chatId, 1);
          results.push(`✅ *${p.name}* — ${p.headline}`);
        } else {
          results.push(`⚠️ *${p.name}* — Error: ${sendRes.error || "no enviado"}`);
        }
        await new Promise((r) => setTimeout(r, 1200));
      }

      await bot.api.sendMessage(
        chatId,
        `🤖 *RESUMEN PROSPECCIÓN AUTÓNOMA (${sentCount}/${batch.length} invitaciones enviadas)*\n` +
        `───────────────────────────\n` +
        results.join("\n") +
        `\n\n🛡️ _Cupo diario restante protegido anti-baneo._`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    for (const p of selectedProspects) {
      const firstName = p.name.split(" ")[0] || p.name;
      const note = `Hola ${firstName}, veo tu labor en el sector. Validamos Silvania, una IA en Telegram que ahorra horas en agenda y leads (acceso gratis por feedback). ¿Conectamos?`.slice(0, 195);

      const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const inviteItem: PendingLinkedInInvite = {
        id,
        providerId: p.id,
        name: p.name,
        headline: p.headline,
        location: p.location,
        profileUrl: p.profileUrl,
        note,
        chatId,
        status: "pending",
      };
      pendingInvites.set(id, inviteItem);

      const kb = new InlineKeyboard()
        .text("📨 Enviar Invitación", `setter_inv_send_${id}`)
        .text("❌ Descartar", `setter_inv_disc_${id}`);

      const msg =
        `👤 *${p.name}*\n` +
        `💼 ${p.headline}\n` +
        (p.location ? `📍 ${p.location}\n` : "") +
        (p.profileUrl ? `🔗 [Ver Perfil](${p.profileUrl})\n\n` : "\n") +
        `📝 *Nota de invitación (${note.length}/200 car.):*\n_"${note}"_`;

      await bot.api.sendMessage(chatId, msg, {
        parse_mode: "Markdown",
        reply_markup: kb,
        link_preview_options: { is_disabled: true },
      });
    }
  }
};
