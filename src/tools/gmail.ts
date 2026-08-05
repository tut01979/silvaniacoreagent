import { google } from "googleapis";
import { getGoogleAuthForUser } from "./googleAuth.js";
import { generateGmailLink, generateGmailSearchLink } from "../services/linkGenerator.js";
import { formatEmailLink, formatWebLink } from "../services/linkFormatter.js";

const SEP = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

// Helper: Decodificar cuerpo de email desde base64url
function decodeEmailBody(data: string): string {
  try {
    return Buffer.from(data, "base64url").toString("utf-8");
  } catch {
    return "";
  }
}

// Helper: Extraer cuerpo del email (prioriza text/plain)
function extractEmailBody(payload: any): string {
  if (payload.body?.data && payload.mimeType === "text/plain") {
    return decodeEmailBody(payload.body.data);
  }

  if (payload.body?.data && payload.mimeType === "text/html") {
    const html = decodeEmailBody(payload.body.data);
    return htmlToPlainText(html);
  }

  if (payload.parts) {
    // Primero buscar text/plain
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeEmailBody(part.body.data);
      }
    }
    // Si no hay text/plain, usar text/html
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = decodeEmailBody(part.body.data);
        return htmlToPlainText(html);
      }
      if (part.parts) {
        const nested = extractEmailBody(part);
        if (nested) return nested;
      }
    }
  }

  return "";
}

// Helper: Convertir HTML a texto plano
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function getTodayQueryDate(): string {
  const now = new Date();
  const madridTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  const YYYY = madridTime.getFullYear();
  const MM = String(madridTime.getMonth() + 1).padStart(2, "0");
  const DD = String(madridTime.getDate()).padStart(2, "0");
  return `${YYYY}/${MM}/${DD}`;
}

function isTodayRequestQuery(query: string): boolean {
  const q = query.toLowerCase().trim();
  
  if (!q || q === "in:inbox -label:sent" || q === "in:inbox") {
    return false;
  }

  // Comprobación de si pide específicamente correos de hoy / el día actual
  const regexes = [
    /\bhoy\b/,
    /\btoday\b/,
    /del d[íi]a/,
    /d[íi]a actual/,
    /correo(s)? de hoy/,
    /mensaje(s)? de hoy/,
    /mail(s)? de hoy/,
    /email(s)? de hoy/
  ];

  return regexes.some(regex => regex.test(q));
}

function formatGmailList(messages: any[], query?: string): string {
  if (messages.length === 0) return "📭 **Bandeja de entrada vacía.** No se han encontrado mensajes recientes.";
  
  let output = `📬 **CENTRO DE MENSAJERÍA GMAIL**\n${SEP}\n\n`;
  messages.forEach((m: any, i: number) => {
    const from = m.from || "Desconocido";
    const subject = m.subject || "(Sin asunto)";
    const date = m.date || "";
    const id = m.id || "N/A";
    const labels = (m.labels || []).join(", ");
    
    output += `📧 ${subject}\n`;
    output += `https://mail.google.com/mail/u/0/#inbox/${id}\n`;
    output += `👤 Remitente: ${from}\n`;
    if (date) {
      output += `📅 ${date}  |  🏷️ ${labels}\n\n`;
    } else {
      output += `🏷️ ${labels}\n\n`;
    }
  });
  
  const queryLink = generateGmailSearchLink(query);
  output += `${SEP}\n🔗 Navegación Directa:\n${queryLink}`;
  return output.trim();
}

export async function gmailSearch(userId: number, query: string, count?: number): Promise<string> {
  try {
    const auth = await getGoogleAuthForUser(userId);
    if (!auth) {
      return "❌ No has vinculado tu cuenta de Google. Usa el comando /auth para conectarla.";
    }

    const gmail = google.gmail({ version: "v1", auth });
    
    let activeQuery = query;
    const isToday = isTodayRequestQuery(query);
    if (isToday) {
      activeQuery = `in:inbox after:${getTodayQueryDate()}`;
    }

    // Limitar a 10-15 resultados por defecto (15) para consultas de hoy, o 30 por defecto general
    let limitCount = count;
    if (limitCount === undefined || limitCount === 30) {
      limitCount = isToday ? 15 : 30;
    }
    
    const res = await gmail.users.messages.list({
      userId: "me",
      q: activeQuery,
      maxResults: limitCount,
    });

    const messagesList = res.data.messages || [];
    const formattedMessages: any[] = [];

    for (const msg of messagesList) {
      const details = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      });

      const headers = details.data.payload?.headers || [];
      const subject = headers.find(h => h.name === "Subject")?.value || "(Sin asunto)";
      const from = headers.find(h => h.name === "From")?.value || "Desconocido";
      const dateRaw = headers.find(h => h.name === "Date")?.value || "";
      
      let dateStr = dateRaw;
      try {
        const d = new Date(dateRaw);
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
        }
      } catch {}

      formattedMessages.push({
        id: msg.id,
        subject,
        from,
        date: dateStr,
        dateParsed: new Date(dateRaw),
        labels: details.data.labelIds || []
      });
    }

    // Ordenar de más nuevo a más viejo
    formattedMessages.sort((a, b) => {
      const timeA = isNaN(a.dateParsed.getTime()) ? 0 : a.dateParsed.getTime();
      const timeB = isNaN(b.dateParsed.getTime()) ? 0 : b.dateParsed.getTime();
      return timeB - timeA;
    });

    return formatGmailList(formattedMessages, activeQuery);
  } catch (error: any) {
    const queryLink = generateGmailSearchLink(query);
    return `❌ Error buscando emails: ${error.message}\n\n🔗 **Navegación Directa:** [Intentar búsqueda manual en Gmail](${queryLink})`;
  }
}

export async function gmailList(userId: number, count?: number): Promise<string> {
  const query = "in:inbox";
  const limitCount = (count === undefined || count === 30) ? 15 : count;
  return await gmailSearch(userId, query, limitCount);
}

export async function gmailThread(userId: number, threadId: string): Promise<string> {
  try {
    const auth = await getGoogleAuthForUser(userId);
    if (!auth) {
      return "❌ No has vinculado tu cuenta de Google. Usa el comando /auth para conectarla.";
    }

    const gmail = google.gmail({ version: "v1", auth });
    
    // Obtener detalles del mensaje
    let payload: any;
    let snippet = "";
    try {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: threadId,
        format: "full"
      });
      payload = msg.data.payload;
      snippet = msg.data.snippet || "";
    } catch {
      // Fallback a hilo si el ID no es de mensaje directo sino de hilo
      const thread = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "full"
      });
      const lastMsg = thread.data.messages?.[thread.data.messages.length - 1];
      payload = lastMsg?.payload;
      snippet = lastMsg?.snippet || "";
    }

    const headers = payload?.headers || [];
    const subject = headers.find((h: any) => h.name === "Subject")?.value || "(Sin asunto)";
    const from = headers.find((h: any) => h.name === "From")?.value || "Desconocido";
    const date = headers.find((h: any) => h.name === "Date")?.value || "";

    const emailLink = generateGmailLink(threadId);
    const body = extractEmailBody(payload) || snippet || "(Sin contenido)";

    let finalOutput = `📜 **DETALLE DEL CORREO**\n${SEP}\n`;
    finalOutput += `${formatEmailLink(subject, emailLink)}\n`;
    finalOutput += `> 👤 De: ${from}\n`;
    finalOutput += `> 📅 Fecha: ${date}\n`;
    finalOutput += `${SEP}\n\n`;
    finalOutput += body;
    finalOutput += `\n\n💡 *Para responder a este correo, pídeme que redacte una respuesta indicando el destinatario y el asunto.*`;
    return finalOutput.trim();
  } catch (error: any) {
    return `❌ Error leyendo el correo: ${error.message}`;
  }
}

export async function gmailSend(userId: number, to: string, subject: string, body: string): Promise<string> {
  try {
    const auth = await getGoogleAuthForUser(userId);
    if (!auth) {
      return "❌ No has vinculado tu cuenta de Google. Usa el comando /auth para conectarla.";
    }

    const gmail = google.gmail({ version: "v1", auth });
    
    // Construir mensaje MIME simple
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const messageParts = [
      `To: ${to}`,
      `Subject: ${utf8Subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "MIME-Version: 1.0",
      "",
      body,
    ];
    const message = messageParts.join("\n");

    const raw = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    const id = result.data.threadId || result.data.id;
    const link = id ? generateGmailLink(id) : "";
    const linkStr = id ? `\n\n${formatEmailLink(subject, link)}` : "";
    return `✅ **Email enviado correctamente**\n\n> 👤 **Para:** ${to}${linkStr}`;
  } catch (error: any) {
    return `❌ Error enviando email: ${error.message}`;
  }
}
