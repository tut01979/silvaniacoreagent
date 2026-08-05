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
  return `📁 ${cleanName} · 🔗 Abrir (${url})`;
}

export function formatFileLink(name: string, url: string): string {
  const cleanName = String(name || "Archivo sin nombre").trim();
  return `📄 ${cleanName} · 🔗 Abrir (${url})`;
}

export function formatEmailLink(subject: string, url: string): string {
  const cleanSubject = String(subject || "(Sin asunto)").trim();
  return `📧 ${cleanSubject} · 🔗 Abrir (${url})`;
}

export function formatVideoLink(title: string, url: string): string {
  const cleanTitle = String(title || "Video sin título").trim();
  return `🎥 ${cleanTitle} · 🔗 Ver (${url})`;
}

export function formatEventLink(name: string, url: string): string {
  const cleanName = String(name || "Evento sin título").trim();
  return `📅 ${cleanName} · 🔗 Abrir (${url})`;
}

export function formatNewsLink(title: string, url: string): string {
  const cleanTitle = String(title || "Noticia sin título").trim();
  return `📰 ${cleanTitle} · 🔗 Abrir (${url})`;
}

export function formatWebLink(title: string, url: string): string {
  const cleanTitle = String(title || "Enlace Web").trim();
  return `🔗 ${cleanTitle} · 🔗 Abrir (${url})`;
}
