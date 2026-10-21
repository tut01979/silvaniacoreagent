/**
 * Helper unificado para el formateo de enlaces premium.
 * Asegura consistencia visual en todas las herramientas del agente (Drive, Gmail, YouTube, etc.).
 *
 * Formato obligatorio:
 * 📁 nombre_carpeta · 🔗 Abrir (url)
 * 📄 nombre_archivo · 🔗 Abrir (url)
 * 📧 asunto_del_correo · 🔗 Abrir (url)
 * 🎥 título_del_video · 🔗 Ver (url)
 * 📅 nombre_evento · 🔗 Abrir (url)
 */

export function formatFolderLink(name: string, url: string): string {
  const cleanName = String(name || "Carpeta sin nombre").trim();
  const cleanUrl = String(url || "").trim();
  return cleanUrl ? `📁 **${cleanName}** · [Abrir](${cleanUrl})` : `📁 **${cleanName}**`;
}

export function formatFileLink(name: string, url: string): string {
  const cleanName = String(name || "Archivo sin nombre").trim();
  const cleanUrl = String(url || "").trim();
  return cleanUrl ? `📄 **${cleanName}** · [Abrir](${cleanUrl})` : `📄 **${cleanName}**`;
}

export function formatEmailLink(subject: string, url: string): string {
  const cleanSubject = String(subject || "(Sin asunto)").trim();
  const cleanUrl = String(url || "").trim();
  return cleanUrl ? `📧 **${cleanSubject}** · [Abrir](${cleanUrl})` : `📧 **${cleanSubject}**`;
}

export function formatVideoLink(title: string, url: string): string {
  const cleanTitle = String(title || "Video sin título").trim();
  const cleanUrl = String(url || "").trim();
  return cleanUrl ? `🎥 **${cleanTitle}** · [Ver](${cleanUrl})` : `🎥 **${cleanTitle}**`;
}

export function formatEventLink(name: string, url: string): string {
  const cleanName = String(name || "Evento sin título").trim();
  const cleanUrl = String(url || "").trim();
  return cleanUrl ? `📅 **${cleanName}** · [Abrir](${cleanUrl})` : `📅 **${cleanName}**`;
}

export function formatNewsLink(title: string, url: string): string {
  const cleanTitle = String(title || "Noticia sin título").trim();
  const cleanUrl = String(url || "").trim();
  return cleanUrl ? `📰 **${cleanTitle}** · [Abrir](${cleanUrl})` : `📰 **${cleanTitle}**`;
}

export function formatWebLink(title: string, url: string): string {
  const cleanTitle = String(title || "Enlace Web").trim();
  const cleanUrl = String(url || "").trim();
  return cleanUrl ? `🔗 [${cleanTitle}](${cleanUrl})` : `🔗 **${cleanTitle}**`;
}

