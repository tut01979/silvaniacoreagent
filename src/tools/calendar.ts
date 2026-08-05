import { google } from "googleapis";
import { getGoogleAuthForUser } from "./googleAuth.js";
import { formatEventLink } from "../services/linkFormatter.js";

const SEP = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

function formatCalendarEvents(items: any[]): string {
  if (!items || items.length === 0) return "📅 No hay eventos próximos.";

  let out = `📅 **Agenda de Silvania** (${items.length} eventos)\n${SEP}\n\n`;
  for (const e of items) {
    if (!e) continue;
    const title = e.summary || "(sin título)";
    const start = e.start?.dateTime || e.start?.date || "";
    const end   = e.end?.dateTime || e.end?.date || "";
    const location = e.location || "";
    const link  = e.htmlLink || "";
    const id    = e.id || "";
    
    let timeStr = "";
    if (start) {
      try {
        timeStr = new Date(start).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
        if (end) {
          const endStr = new Date(end).toLocaleString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
          timeStr += ` - ${endStr}`;
        }
      } catch { timeStr = start; }
    }

    out += `${formatEventLink(title, link)}\n`;
    if (timeStr) out += `> ⏰ ${timeStr}\n`;
    if (location) out += `> 📍 ${location}\n\n`;
  }
  return out;
}

export const calendarList = async (userId: number, daysAhead = 7, startDate?: string) => {
  try {
    const auth = await getGoogleAuthForUser(userId);
    if (!auth) {
      return "❌ No has vinculado tu cuenta de Google. Usa el comando /auth para conectarla.";
    }

    const calendar = google.calendar({ version: "v3", auth });

    let timeMin: Date;
    if (startDate) {
      timeMin = new Date(startDate);
    } else {
      timeMin = new Date();
      timeMin.setHours(0, 0, 0, 0); // Inicio del día local
    }

    const timeMax = new Date(timeMin);
    timeMax.setDate(timeMax.getDate() + daysAhead);

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    return formatCalendarEvents(response.data.items || []);
  } catch (error: any) {
    return `❌ Error listando eventos: ${error.message}`;
  }
};

export const calendarCreate = async (
  userId: number,
  summary: string,
  start: string,
  end: string,
  description?: string
) => {
  try {
    const auth = await getGoogleAuthForUser(userId);
    if (!auth) {
      return "❌ No has vinculado tu cuenta de Google. Usa el comando /auth para conectarla.";
    }

    const calendar = google.calendar({ version: "v3", auth });

    const event = {
      summary,
      description: description || "",
      start: { dateTime: start, timeZone: "Europe/Madrid" },
      end: { dateTime: end, timeZone: "Europe/Madrid" }
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
      sendUpdates: "none" // Evitar notificaciones masivas/correos a invitados o compartidos
    });

    const eventData = response.data;
    const startStr = new Date(eventData.start?.dateTime || eventData.start?.date || start).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
    });

    const linkStr = formatEventLink(eventData.summary || summary, eventData.htmlLink || "");
    return `✅ **EVENTO PROGRAMADO CON ÉXITO**\n${SEP}\n\n` +
           `${linkStr}\n` +
           `> ⏰ **Cuándo:** ${startStr}\n` +
           `> 📍 **Lugar:** ${eventData.location || "No especificado"}\n\n` +
           `*Silvania CoreAgent ha agendado esto por ti.*`;
  } catch (error: any) {
    console.error("Error en calendarCreate:", error);
    return `❌ **Error al crear el evento:** ${error.message}\n\n_Asegúrate de que las fechas estén en formato ISO (ej: 2024-05-01T10:00:00Z) o usa términos claros como "mañana a las 10am"._`;
  }
};

export const calendarDelete = async (userId: number, eventId: string) => {
  try {
    const auth = await getGoogleAuthForUser(userId);
    if (!auth) {
      return "❌ No has vinculado tu cuenta de Google. Usa el comando /auth para conectarla.";
    }

    const calendar = google.calendar({ version: "v3", auth });

    // Obtener información del evento antes de borrarlo
    let summary = "Evento";
    try {
      const existing = await calendar.events.get({ calendarId: "primary", eventId });
      summary = existing.data.summary || "Sin título";
    } catch {}

    await calendar.events.delete({
      calendarId: "primary",
      eventId,
      sendUpdates: "none"
    });

    return `🗑️ **Evento eliminado**\n${SEP}\n📌 **${summary}**\n🆔 **ID:** ${eventId}\n${SEP}`;
  } catch (error: any) {
    return `❌ Error eliminando evento: ${error.message}`;
  }
};

export const calendarUpdate = async (
  userId: number,
  eventId: string,
  summary?: string,
  start?: string,
  end?: string,
  description?: string
) => {
  try {
    const auth = await getGoogleAuthForUser(userId);
    if (!auth) {
      return "❌ No has vinculado tu cuenta de Google. Usa el comando /auth para conectarla.";
    }

    const calendar = google.calendar({ version: "v3", auth });

    // Obtener el evento actual para preservar otros campos
    const existing = await calendar.events.get({ calendarId: "primary", eventId });
    const eventData = existing.data;

    const updateData: any = {};
    if (summary !== undefined) updateData.summary = summary;
    if (description !== undefined) updateData.description = description;
    if (start) {
      updateData.start = { dateTime: start, timeZone: eventData.start?.timeZone || "Europe/Madrid" };
    }
    if (end) {
      updateData.end = { dateTime: end, timeZone: eventData.end?.timeZone || "Europe/Madrid" };
    }

    const response = await calendar.events.update({
      calendarId: "primary",
      eventId,
      requestBody: { ...eventData, ...updateData },
      sendUpdates: "none"
    });

    const startStr = new Date(response.data.start?.dateTime || response.data.start?.date || "").toLocaleString("es-ES", {
      timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
    });

    const linkStr = formatEventLink(response.data.summary || summary || "Evento", response.data.htmlLink || "");
    return `✅ **EVENTO ACTUALIZADO CON ÉXITO**\n${SEP}\n\n` +
           `${linkStr}\n` +
           `> ⏰ **Cuándo:** ${startStr}\n` +
           `> 📍 **Lugar:** ${response.data.location || "No especificado"}`;
  } catch (error: any) {
    return `❌ **Error al actualizar el evento:** ${error.message}`;
  }
};
