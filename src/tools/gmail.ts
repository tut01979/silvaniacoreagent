import { runGog } from "./gogWrapper.js";
import fs from "fs";
import path from "path";

const SEP = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

function formatGmailList(raw: any, query?: string): string {
    const threads = raw.threads || (Array.isArray(raw) ? raw : []);
    if (threads.length === 0) return "📭 **Bandeja de entrada vacía.** No se han encontrado mensajes recientes.";
    
    let output = `📬 **CENTRO DE MENSAJERÍA GMAIL**\n${SEP}\n\n`;
    threads.forEach((t: any, i: number) => {
        const from = t.from || "Desconocido";
        const subject = t.subject || "(Sin asunto)";
        const date = t.date || "";
        const id = t.id || "N/A";
        const labels = (t.labels || []).join(", ");
        const link = `https://mail.google.com/mail/u/0/#inbox/${id}`;
        
        output += `🔹 **${i + 1}. ${subject}**\n`;
        output += `> 👤 **Remitente:** ${from}\n`;
        output += `> 📅 **Fecha:** ${date}  |  🏷️ \`${labels}\`\n`;
        output += `> 🆔 **ID:** \`${id}\`  |  🔗 [Abrir](${link})\n\n`;
    });
    
    const queryLink = query 
    ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(query)}`
    : `https://mail.google.com/mail/u/0/#search/in:inbox`;
    output += `${SEP}\n🔗 **Navegación Directa:** [Abrir búsqueda en Gmail](${queryLink})`;
    output += `\n💡 *Consejo: Usa \`gmail thread get [ID]\` para leer el contenido completo de un hilo.*`;
    return output.trim();
}


export async function gmailSearch(query: string, count: number = 30): Promise<string> {
    try {
        const output = await runGog(`gmail search "${query}" --max=${count} --json`);
        const json = JSON.parse(output);
        return formatGmailList(json, query);
    } catch (error: any) {
        const queryLink = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(query)}`;
        return `❌ Error buscando emails: ${error.message}\n\n🔗 **Navegación Directa:** [Intentar búsqueda manual en Gmail](${queryLink})`;
    }
}

export async function gmailList(count: number = 30): Promise<string> {
    try {
        const output = await runGog(`gmail search "in:inbox" --max=${count} --json`);
        const json = JSON.parse(output);
        return formatGmailList(json);
    } catch (error: any) {
        return `❌ Error listando emails: ${error.message}`;
    }
}

export async function gmailThread(threadId: string): Promise<string> {
    try {
        const output = await runGog(`gmail thread get ${threadId} --full`);
        
        const emailLink = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
        const SEP = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

        let finalOutput = `📜 **DETALLE DEL CORREO**\n${SEP}\n`;
        finalOutput += `🆔 **Hilo ID:** \`${threadId}\`\n`;
        finalOutput += `🔗 **Enlace directo:** [Abrir en Gmail](${emailLink})\n`;
        finalOutput += `${SEP}\n\n`;
        finalOutput += output;
        finalOutput += `\n\n💡 *Para responder a este correo, usa \`gmail_send\` con el asunto adecuado.*`;

        return finalOutput.trim();
    } catch (error: any) {
        return `❌ Error leyendo el correo: ${error.message}`;
    }
}

export async function gmailSend(to: string, subject: string, body: string): Promise<string> {
    const tempName = `mail_${Date.now()}.txt`;
    const tempPath = path.join(process.cwd(), "temp", tempName);
    
    if (!fs.existsSync(path.join(process.cwd(), "temp"))) {
        fs.mkdirSync(path.join(process.cwd(), "temp"), { recursive: true });
    }

    try {
        // Escribir el cuerpo en un archivo temporal
        fs.writeFileSync(tempPath, body, "utf-8");

        // Escapar comillas dobles en el asunto y destinatario
        const escapedTo = to.replace(/"/g, '\\"');
        const escapedSubject = subject.replace(/"/g, '\\"');

        const result = await runGog(`gmail send --to="${escapedTo}" --subject="${escapedSubject}" --body-file="${tempPath}" --json`);
        
        // Limpiar archivo temporal inmediatamente
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}

        try {
            const parsed = JSON.parse(result);
            const id = parsed.threadId || parsed.id;
            const link = id ? `\n🔗 **Enlace:** [Ver en Gmail](https://mail.google.com/mail/u/0/#inbox/${id})` : "";
            return `✅ **Email enviado correctamente**\n\n📧 **Para:** ${to}\n📋 **Asunto:** ${subject}${link}`;
        } catch {
            return `✅ **Email enviado correctamente**\n\n📧 **Para:** ${to}\n📋 **Asunto:** ${subject}`;
        }
    } catch (error: any) {
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
        return `❌ Error enviando email: ${error.message}`;
    }
}

