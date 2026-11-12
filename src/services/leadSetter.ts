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

export const PERSONAS: Record<string, ProspectingPersona> = {
  inmobiliaria: {
    key: "inmobiliaria",
    name: "Agente o Asesor Inmobiliario",
    emoji: "🏡",
    targetRole: "Asesor / Agente Inmobiliario / Broker",
    mainPain: "Pasa el día en la calle visitando inmuebles; perder citas o no poder abrir el portátil en el coche para apuntar datos en Sheets y Calendar.",
    dorkSearch: 'site:linkedin.com/in ("agente inmobiliario" OR "asesor inmobiliario" OR "consultor inmobiliario") [CIUDAD]',
    connectionNote: "Hola [Nombre], veo tu labor con propiedades en [Zona]. Sé lo caótico que es cuadrar visitas en la calle. Creamos un asistente en Telegram que te agenda en Calendar por voz. ¿Conectamos?",
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

export const leadSetter = {
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
    return (
      `🎯 *PLAYBOOK SETTER B2B: ${persona.name.toUpperCase()}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📌 *Perfil Objetivo:* ${persona.targetRole}\n` +
      `⚠️ *Dolor Principal:* _${persona.mainPain}_\n\n` +
      `🔍 *Comando de Búsqueda (Google / LinkedIn):*\n` +
      `\`\`\`text\n${persona.dorkSearch}\n\`\`\`\n\n` +
      `📨 *1. Nota de Invitación (< 200 caracteres):*\n` +
      `\`\`\`text\n${persona.connectionNote}\n\`\`\`\n\n` +
      `💬 *2. Mensaje tras Aceptar la Conexión:*\n` +
      `\`\`\`text\n${persona.followUpMessage}\n\`\`\`\n\n` +
      `🛡️ *3. Manejo de Objeciones:*\n` +
      `• *Si dice "No tengo tiempo":*\n_${persona.objections.noTime}_\n\n` +
      `• *Si pregunta por el precio:*\n_${persona.objections.price}_\n\n` +
      `• *Si dice "Ya uso otras herramientas":*\n_${persona.objections.alreadyHaveTools}_\n\n` +
      `📅 *4. Propuesta de Cierre en Google Calendar:* \n` +
      `\`\`\`text\n${persona.meetingProposal}\n\`\`\`\n\n` +
      `📹 *Google Meet:* Automático con enlace único generado por Google Calendar.`
    );
  }
};
