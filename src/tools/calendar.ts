import { runGog } from "./gogWrapper.js";

const SEP = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

function formatCalendarEvents(raw: any): string {
  const events: any[] = raw.events || raw.items || (Array.isArray(raw) ? raw : []);
  if (!events || events.length === 0) return "📅 No hay eventos próximos.";

  let out = `📅 **Agenda de Silvania** (${events.length} eventos)\n${SEP}\n\n`;
  for (const e of events) {
    if (!e) continue;
    const title = e.summary || e.title || "(sin título)";
    const start = e.start?.dateTime || e.start?.date || e.startTime || e.date || "";
    const end   = e.end?.dateTime || e.end?.date || e.endTime || "";
    const location = e.location || "";
    const link  = e.htmlLink || "";
    
    let timeStr = "";
    if (start) {
      try {
        timeStr = new Date(start).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
        if (end) {
          const endStr = new Date(end).toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit" });
          timeStr += ` - ${endStr}`;
        }
      } catch { timeStr = start; }
    }

    out += `🗓️ **${title}**\n`;
    if (timeStr) out += `└ ⏰ ${timeStr}\n`;
    if (location) out += `└ 📍 ${location}\n`;
    if (link)    out += `└ 🔗 [Abrir evento](${link})\n\n`;
  }
  return out;
}

export const calendarList = async (daysAhead = 7, startDate?: string) => {
  let cmd = `calendar ls --days=${daysAhead} --json`;
  if (startDate) cmd += ` --from=${startDate}`;
  const result = await runGog(cmd);
  try {
    const parsed = JSON.parse(result);
    return formatCalendarEvents(parsed);
  } catch {
    return result;
  }
};

export const calendarCreate = async (summary: string, start: string, end: string, description?: string) => {
  // Intentar normalizar fechas si vienen en formato amigable
  let cmd = `calendar create primary --summary="${summary}" --from="${start}" --to="${end}" --json`;
  if (description) cmd += ` --description="${description}"`;
  
  try {
    const result = await runGog(cmd);
    const parsed = JSON.parse(result);
    const event = parsed.event || (parsed.items ? parsed.items[0] : parsed);
    
    if (!event || !event.id) throw new Error("No se recibió confirmación del evento.");

    const startStr = new Date(event.start?.dateTime || event.start?.date).toLocaleString("es-ES", {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });

    return `✅ **EVENTO PROGRAMADO CON ÉXITO**\n${SEP}\n\n` +
           `🗓️ **Asunto:** ${event.summary}\n` +
           `⏰ **Cuándo:** ${startStr}\n` +
           `📍 **Lugar:** ${event.location || "No especificado"}\n` +
           `🔗 [Ver en Google Calendar](${event.htmlLink})\n\n` +
           `*Silvania CoreAgent ha agendado esto por ti.*`;
  } catch (error: any) {
    console.error("Error en calendarCreate:", error);
    return `❌ **Error al crear el evento:** ${error.message}\n\n_Asegúrate de que las fechas estén en formato ISO (ej: 2024-05-01T10:00:00Z) o usa términos claros como "mañana a las 10am"._`;
  }
};

export const calendarDelete = async (eventId: string) => {
  return await runGog(`calendar rm primary ${eventId}`);
};
