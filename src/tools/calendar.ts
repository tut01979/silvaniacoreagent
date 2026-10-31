import { google } from "googleapis";
import { getGoogleAuthForUser } from "./googleAuth.js";
import { formatEventLink } from "../services/linkFormatter.js";

const SEP = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

function safeCalendarLink(link?: string): string | undefined {
  if (!link || typeof link !== "string") return undefined;
  if (link.length > 500) return undefined;

  // Solo aceptar dominios legítimos de Google Calendar
  if (!link.startsWith("https://www.google.com/calendar/") && !link.startsWith("https://calendar.google.com/")) {
    return undefined;
  }

  return link;
}

function buildCanonicalCalendarLink(eventId?: string, htmlLink?: string): string {
  const verified = safeCalendarLink(htmlLink);
  if (verified) return verified;
  if (eventId) {
    try {
      const eid = Buffer.from(`${eventId} primary`).toString("base64").replace(/=/g, "");
      return `https://www.google.com/calendar/event?eid=${eid}`;
    } catch {
      return `https://calendar.google.com/calendar/u/0/r/eventedit/${eventId}`;
    }
  }
  return "https://calendar.google.com/calendar/u/0/";
}

function parseAttendeesList(attendees?: string[] | string): { email: string }[] {
  if (!attendees) return [];
  let rawList: string[] = [];
  if (Array.isArray(attendees)) {
    rawList = attendees.map(e => String(e).trim());
  } else if (typeof attendees === "string" && attendees.trim()) {
    rawList = attendees.split(/[,;\s]+/).map(e => e.trim());
  }
  return rawList
    .filter(email => email.includes("@") && email.includes("."))
    .map(email => ({ email }));
}

function formatCalendarEvents(items: any[]): string {
  if (!items || items.length === 0) return "📅 No hay eventos próximos.";

  let out = `📅 **Agenda de Silvania** (${items.length} eventos)\n${SEP}\n\n`;
  for (const e of items) {
    if (!e) continue;
    const title = e.summary || "(sin título)";
    const start = e.start?.dateTime || e.start?.date || "";
    const end   = e.end?.dateTime || e.end?.date || "";
    const location = e.location || "";
    const id    = e.id || "";
    const link  = buildCanonicalCalendarLink(id, e.htmlLink || undefined);
    
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
    if (id) out += `> 🆔 **ID:** \`${id}\`\n`;
    if (timeStr) out += `> ⏰ ${timeStr}\n`;
    if (location) out += `> 📍 ${location}\n`;
    if (e.attendees && e.attendees.length > 0) {
      const attendeesEmails = e.attendees.map((a: any) => a.email).filter(Boolean).join(", ");
      if (attendeesEmails) out += `> 👥 **Invitados:** ${attendeesEmails}\n`;
    }
    out += `\n`;
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
  description?: string,
  attendees?: string[] | string
) => {
  try {
    const auth = await getGoogleAuthForUser(userId);
    if (!auth) {
      return "❌ No has vinculado tu cuenta de Google. Usa el comando /auth para conectarla.";
    }

    const calendar = google.calendar({ version: "v3", auth });
    const attendeeList = parseAttendeesList(attendees);
    const hasAttendees = attendeeList.length > 0;

    const event: any = {
      summary,
      description: description || "",
      start: { dateTime: start, timeZone: "Europe/Madrid" },
      end: { dateTime: end, timeZone: "Europe/Madrid" },
      ...(hasAttendees ? { attendees: attendeeList } : {})
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
      sendUpdates: hasAttendees ? "all" : "none"
    });

    const eventData = response.data;
    const eventId = eventData.id || "";
    const startStr = new Date(eventData.start?.dateTime || eventData.start?.date || start).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
    });

    const eventTitle = (eventData.summary || summary || "Evento").replace(/[\[\]\r\n]+/g, " ").trim();
    const realLink = buildCanonicalCalendarLink(eventId, eventData.htmlLink || undefined);
    const fullMarkdown = `[${eventTitle}](${realLink})`;
    const attendeesStr = hasAttendees
      ? `\n> 👥 **Invitados:** ${attendeeList.map(a => a.email).join(", ")} (notificación de invitación enviada por email)`
      : "";

    return `✅ **EVENTO PROGRAMADO CON ÉXITO**\n${SEP}\n\n` +
           `CALENDAR_MARKDOWN=${fullMarkdown}\n` +
           `${fullMarkdown}\n` +
           `> 🆔 **ID:** \`${eventId}\`\n` +
           `> ⏰ **Cuándo:** ${startStr}\n` +
           `> 📍 **Lugar:** ${eventData.location || "No especificado"}` +
           `${attendeesStr}\n` +
           `> 🔗 **Enlace directo:** ${fullMarkdown}\n\n` +
           `⚠️ OBLIGATORIO: En tu respuesta al usuario incluye SIEMPRE en una línea el Markdown completo: ${fullMarkdown} (prohibido dejar solo "Abrir" o el título sin URL).`;
  } catch (error: any) {
    console.error("Error en calendarCreate:", error);
    return `❌ **Error al crear el evento:** ${error.message}\n\n_Asegúrate de que las fechas estén en formato ISO (ej: 2026-10-26T10:00:00+02:00) o consulta las fechas relativas en el chat._`;
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
  description?: string,
  attendees?: string[] | string,
  sendUpdates?: string
) => {
  try {
    const auth = await getGoogleAuthForUser(userId);
    if (!auth) {
      return "❌ No has vinculado tu cuenta de Google. Usa el comando /auth para conectarla.";
    }

    const calendar = google.calendar({ version: "v3", auth });

    // Obtener el evento actual para preservar otros campos y combinar asistentes
    const existing = await calendar.events.get({ calendarId: "primary", eventId });
    const eventData = existing.data;

    const patchBody: any = {};
    if (summary !== undefined) patchBody.summary = summary;
    if (description !== undefined) patchBody.description = description;
    if (start) {
      patchBody.start = { dateTime: start, timeZone: eventData.start?.timeZone || "Europe/Madrid" };
    }
    if (end) {
      patchBody.end = { dateTime: end, timeZone: eventData.end?.timeZone || "Europe/Madrid" };
    }

    const newAttendees = parseAttendeesList(attendees);
    let finalAttendees: { email: string }[] | undefined = undefined;

    if (newAttendees.length > 0) {
      const existingEmails = new Set<string>(
        (eventData.attendees || [])
          .map(a => a.email?.toLowerCase())
          .filter((e): e is string => Boolean(e))
      );
      finalAttendees = (eventData.attendees || [])
        .filter(a => Boolean(a.email))
        .map(a => ({ email: a.email as string }));

      for (const na of newAttendees) {
        if (!existingEmails.has(na.email.toLowerCase())) {
          finalAttendees.push(na);
          existingEmails.add(na.email.toLowerCase());
        }
      }
      patchBody.attendees = finalAttendees;
    }

    const effectiveSendUpdates = sendUpdates || (newAttendees.length > 0 ? "all" : "none");

    const response = await calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: patchBody,
      sendUpdates: effectiveSendUpdates as any
    });

    const updatedEvent = response.data;
    const startStr = new Date(updatedEvent.start?.dateTime || updatedEvent.start?.date || "").toLocaleString("es-ES", {
      timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
    });

    const realLink = buildCanonicalCalendarLink(eventId, updatedEvent.htmlLink || undefined);
    const linkStr = formatEventLink(updatedEvent.summary || summary || "Evento", realLink);
    
    const attendeesStr = updatedEvent.attendees && updatedEvent.attendees.length > 0
      ? `\n> 👥 **Asistentes:** ${updatedEvent.attendees.map((a: any) => a.email).filter(Boolean).join(", ")}${newAttendees.length > 0 ? " (notificación enviada por email)" : ""}`
      : "";

    return `✅ **EVENTO ACTUALIZADO CON ÉXITO**\n${SEP}\n\n` +
           `${linkStr}\n` +
           `> 🆔 **ID:** \`${eventId}\`\n` +
           `> ⏰ **Cuándo:** ${startStr}\n` +
           `> 📍 **Lugar:** ${updatedEvent.location || "No especificado"}` +
           `${attendeesStr}\n` +
           `> 🔗 **Enlace directo:** ${realLink}`;
  } catch (error: any) {
    return `❌ **Error al actualizar el evento:** ${error.message}`;
  }
};

