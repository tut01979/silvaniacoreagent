import { gmailSend } from "../tools/gmail.js";
import { userContextStore } from "./context.js";
import { config } from "../config/config.js";
import fs from "fs";
import path from "path";
import { dbService } from "../database/db.js";

// Notificador de Telegram para el administrador
let telegramNotifier: ((message: string) => Promise<void>) | null = null;

export function setAdminTelegramNotifier(notifier: (message: string) => Promise<void>) {
  telegramNotifier = notifier;
}

/**
 * Escribe un evento en el archivo de registro físico data/security.log
 */
export function logSecurityEvent(userId: number | string, username: string | null, type: string, details: string) {
  try {
    const logDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFilePath = path.join(logDir, "security.log");
    const timestamp = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
    const logLine = `[${timestamp}] [${type}] User: ${username || "N/A"} (${userId}) | Details: ${details}\n`;
    fs.appendFileSync(logFilePath, logLine);
  } catch (err: any) {
    console.error("❌ Error escribiendo en data/security.log:", err.message);
  }
}

/**
 * Registra una violación de CSP reportada por el navegador
 */
export function logCspViolation(ip: string, report: any) {
  const reason = `Violación de CSP: ${JSON.stringify(report)}`;
  logSecurityEvent("SYSTEM", ip, "CSP_VIOLATION", reason);
  // Guardar en la base de datos
  dbService.logSecurityIncident(0, `IP: ${ip}`, reason).catch(() => {});
}

/**
 * Registra un evento de bloqueo por Rate Limiting
 */
export function logRateLimitEvent(ip: string, path: string) {
  const reason = `Rate Limit Excedido en ruta: ${path}`;
  logSecurityEvent("SYSTEM", ip, "RATE_LIMIT_BLOCK", reason);
  // Guardar en la base de datos
  dbService.logSecurityIncident(0, `IP: ${ip}`, reason).catch(() => {});
}

/**
 * Escanea un texto de chat en busca de patrones de inyección de comandos o flags maliciosas.
 * Devuelve el motivo si se detecta peligro, o null si es seguro.
 */
export function checkMaliciousPattern(text: string): string | null {
  const cleanText = text.trim();
  
  // 1. Detección de flags o comandos de borrado destructivo real (rm -rf, rmdir, del /f /s /q)
  if (/\b(rm\s+-rf|rm\s+-r|rmdir\s|del\s+\/[a-z]|format\s+[c-z]:)/i.test(cleanText)) {
    return "Intento de uso de comandos de eliminación del sistema o flags destructivas.";
  }
  
  // 2. Operadores de encadenamiento de comandos en shell (inyección)
  // Solo si se encadenan comandos de consola reales (sh/bash/powershell)
  if (/([;&|`$]|\bsh\b|\bbash\b)\s*(-c)?\s*\b(rm|mv|sudo|format|kill|shutdown|poweroff|reboot|mkfs)\b/i.test(cleanText)) {
    return "Intento de encadenamiento o inyección de comandos de consola.";
  }
  
  // 3. Ejecución directa de comandos administrativos (excluyendo "del" solo para no interferir con el español "del")
  if (/^(sudo\s|rm\s|chmod\s|chown\s|kill\s)/i.test(cleanText)) {
    return "Intento de ejecución directa de comando administrativo de consola.";
  }
  
  return null;
}

/**
 * Registra un incidente de seguridad, envía un correo de alerta al administrador,
 * envía un mensaje de Telegram instantáneo y devuelve el mensaje de advertencia para el usuario.
 */
export async function handleSecurityAlert(userId: number, username: string, reason: string): Promise<string> {
  const adminId = config.telegram.allowedUsers[0] || 1572946817;
  const timestamp = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
  
  const subject = `⚠️ ALERTA DE SEGURIDAD: Intento de inyección en Silvania.ai`;
  const body = `Se ha detectado un intento de actividad maliciosa o inyección de comandos en el bot de Silvania.\n\n` +
               `Detalles del incidente:\n` +
               `-------------------------\n` +
               `👤 Usuario: ${username || "Desconocido"} (Telegram ID: ${userId})\n` +
               `🎯 Motivo: ${reason}\n` +
               `⏰ Fecha y hora: ${timestamp}\n\n` +
               `El sistema ha bloqueado automáticamente la ejecución y ha advertido al usuario.`;

  console.warn(`[SECURITY ALERT] [${timestamp}] User ${userId} (${username}) triggered threat: ${reason}`);

  // 1. Registrar el incidente en el archivo de texto log
  logSecurityEvent(userId, username, "THREAT_DETECTED", reason);

  // 2. Registrar en la base de datos SQLite
  await dbService.logSecurityIncident(userId, username, reason);

  // 3. Enviar alerta de Telegram instantánea al administrador
  if (telegramNotifier) {
    telegramNotifier(
      `⚠️ *ALERTA DE SEGURIDAD DETECTADA*\n\n` +
      `Se ha bloqueado una actividad sospechosa o intento de inyección.\n\n` +
      `👤 *Usuario*: @${username || "Desconocido"} (ID: \`${userId}\`)\n` +
      `🎯 *Motivo*: ${reason}\n` +
      `⏰ *Fecha*: ${timestamp}`
    ).catch(err => console.error("❌ Error enviando alerta de Telegram al admin:", err.message));
  }

  // 4. Ejecutar el envío de email en segundo plano con el contexto del administrador
  userContextStore.run({ userId: adminId }, async () => {
    try {
      await gmailSend(adminId, "admin@silvania.ai", subject, body);
      console.log(`✉️ Alerta de seguridad enviada por correo a admin@silvania.ai`);
    } catch (err: any) {
      console.error(`❌ No se pudo enviar el correo de alerta al administrador:`, err.message);
    }
  });

  return `⚠️ **AVISO DE SEGURIDAD**\n\n` +
         `Por motivos de seguridad, no puedo procesar comandos de consola, inyecciones de código o scripts de sistema.\n\n` +
         `Por favor, realiza tus consultas o peticiones en lenguaje natural.`;
}

/**
 * Escanea el nombre de un archivo adjunto para verificar si tiene extensiones ejecutables o de script
 * o si contiene caracteres peligrosos de inyección.
 */
export function checkMaliciousFilename(filename: string): string | null {
  if (!filename) return null;
  const lowerName = filename.toLowerCase();
  
  // 1. Detección de binarios ejecutables potencialmente peligrosos (malware de escritorio)
  // Permitimos archivos de código y scripts (.py, .js, .sh, .bat, etc.) para que los usuarios puedan guardarlos en Drive
  const dangerousExtensions = [".exe", ".msi", ".dll", ".scr", ".pif"];
  if (dangerousExtensions.some(ext => lowerName.endsWith(ext))) {
    return `Archivo ejecutable binario bloqueado por seguridad: "${filename}".`;
  }
  
  // 2. Patrones de inyección de comandos en el nombre del archivo
  if (/[;&|`$]/g.test(filename)) {
    return `El nombre de archivo contiene caracteres de inyección de comandos: "${filename}".`;
  }
  
  return null;
}

