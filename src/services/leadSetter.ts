import { InlineKeyboard } from "grammy";
import { llmService } from "./llm.js";
import { calendarCreate } from "../tools/calendar.js";

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
}

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

function getTodayKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" }); // YYYY-MM-DD
}

export const leadSetter = {
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
      "¡Hola! Gracias por conectar. Estamos validando una IA verificada por Google para gestionar Calendar, Gmail y Sheets por voz desde Telegram y ahorrar 2h al día de tareas repetitivas. ¿Te paso el enlace para que la pruebes?";
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
   * Genera una respuesta inteligente con IA a un mensaje entrante de LinkedIn
   */
  async generateSuggestedReply(leadName: string, leadRole: string, messageText: string, personaKey?: string): Promise<string> {
    try {
      const prompt = 
        `Eres Silvania Setter AI, un asistente de prospección B2B de élite para Silvania CoreAgent (tu oficina ejecutiva en Telegram conectada con Google Workspace: Calendar, Gmail, Sheets, Drive).\n` +
        `Un prospecto en LinkedIn ha respondido a nuestro contacto:\n` +
        `- Nombre: ${leadName}\n` +
        `- Cargo/Sector: ${leadRole}\n` +
        `- Mensaje recibido del prospecto: "${messageText}"\n\n` +
        `Tu misión: Redactar la respuesta ideal en español para continuar la conversación con naturalidad, empatía y efectividad.\n` +
        `Reglas indispensables:\n` +
        `1. Longitud: 2 a 3 frases cortas (< 280 caracteres). Tono humano y cercano, cero lenguaje robótico o de venta agresiva.\n` +
        `2. Desactiva su objeción de inmediato (si no tiene tiempo, dile que por eso le ayuda a ganar 2 horas al día; si pregunta precio, indícale prueba gratis y tarifa plana reducida).\n` +
        `3. Propón una demo ágil de 10 minutos por Google Meet ofreciendo 2 opciones (ej: martes a las 10:00 o jueves a las 16:30).\n` +
        `4. Devuelve EXCLUSIVAMENTE el texto de la respuesta, sin saludos introductorios ni comillas extras.`;

      const response = await llmService.chatSimple([
        { role: "system", content: "Eres Silvania Setter AI, el copiloto de prospección y cierre de reuniones B2B." },
        { role: "user", content: prompt }
      ]);

      const text = response?.content ? String(response.content).trim() : "";
      if (text) return text;
    } catch (err: any) {
      console.warn("⚠️ Falló llamada a LLM para respuesta sugerida, usando fallback contextual:", err.message);
    }

    // Fallback contextual de alta calidad
    return `Te entiendo perfectamente ${leadName}, justo por eso te vendrá genial: te muestro en 10 min cómo dictar visitas por voz a Calendar y Sheets para ahorrarte 2h al día. ¿Te viene mejor el martes a las 10:00 o jueves a las 16:30?`;
  },

  /**
   * Crea un registro de mensaje entrante pendiente de aprobación en Nivel 2
   */
  async createPendingLeadReply(opts: {
    leadName: string;
    leadRole: string;
    leadProfileUrl?: string;
    messageText: string;
    personaKey?: string;
    chatId: number;
    customSuggestedReply?: string;
  }): Promise<PendingLeadReply> {
    const id = `lr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const suggested = opts.customSuggestedReply || await this.generateSuggestedReply(opts.leadName, opts.leadRole, opts.messageText, opts.personaKey);

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
      chatId: opts.chatId
    };

    pendingReplies.set(id, pending);
    return pending;
  },

  /**
   * Envía la alerta interactiva Nivel 2 a Telegram con botones [Aprobar y Enviar] y [Modificar]
   */
  async sendApprovalAlert(bot: any, chatId: number, reply: PendingLeadReply): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text("✅ Aprobar y Enviar", `setter_app_${reply.id}`)
      .text("✏️ Modificar", `setter_edit_${reply.id}`)
      .row()
      .text("❌ Descartar", `setter_disc_${reply.id}`);

    const message = 
      `🔔 *Nuevo mensaje de ${reply.leadName} (${reply.leadRole}):*\n` +
      `"${reply.messageText}"\n\n` +
      `🤖 *Respuesta sugerida por Silvania:*\n` +
      `"${reply.suggestedReply}"`;

    await bot.api.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  },

  /**
   * Procesa los callbacks de Telegram para la aprobación en 1 clic
   */
  async handleCallback(bot: any, ctx: any): Promise<boolean> {
    const data = ctx.callbackQuery?.data || "";
    if (!data.startsWith("setter_")) return false;

    await ctx.answerCallbackQuery().catch(() => {});

    // Aprobar y Enviar
    if (data.startsWith("setter_app_")) {
      const id = data.replace("setter_app_", "");
      const item = pendingReplies.get(id);

      if (!item) {
        await ctx.reply("⚠️ Este mensaje ya ha expirado o no se encuentra en memoria.");
        return true;
      }

      item.status = "approved";

      const meetKeyboard = new InlineKeyboard()
        .text("📅 Agendar Google Meet", `setter_meet_${id}`);

      const approvedMsg = 
        `✅ *Respuesta APROBADA y Lista para Enviar*\n` +
        `───────────────────────────\n\n` +
        `👤 *Destinatario:* ${item.leadName} (${item.leadRole})\n` +
        (item.leadProfileUrl ? `🔗 *Perfil:* [Ver LinkedIn](${item.leadProfileUrl})\n\n` : `\n`) +
        `💬 *Texto Listo:* (Copia y pega en LinkedIn):\n` +
        `\`\`\`text\n${item.suggestedReply}\n\`\`\`\n` +
        `*(Si el prospecto acepta una de las horas propuestas, pulsa abajo para agendar de inmediato en tu Google Calendar)*`;

      try {
        await ctx.editMessageText(approvedMsg, {
          parse_mode: "Markdown",
          reply_markup: meetKeyboard
        });
      } catch {
        await ctx.reply(approvedMsg, {
          parse_mode: "Markdown",
          reply_markup: meetKeyboard
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

    return false;
  }
};
