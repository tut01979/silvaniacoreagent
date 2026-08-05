/**
 * Módulo Helper para la generación unificada e infalible de enlaces de Google Drive y Gmail.
 * Garantiza que las URLs producidas sean compatibles tanto en dispositivos móviles como en escritorio,
 * preservando intactos los IDs, guiones bajos (_) y parámetros de búsqueda.
 */

/**
 * Genera el enlace directo a una carpeta o archivo de Google Drive.
 * @param id ID de la carpeta o archivo de Drive.
 * @param isFolder Valor booleano indicando si el elemento es una carpeta (por defecto true).
 */
export function generateDriveLink(id: string, isFolder: boolean = true): string {
  if (!id) return "https://drive.google.com/drive/my-drive";
  const cleanId = String(id).trim();
  if (!cleanId || cleanId === "root" || cleanId === ".") {
    return "https://drive.google.com/drive/my-drive";
  }
  if (isFolder) {
    return `https://drive.google.com/drive/folders/${cleanId}`;
  }
  return `https://drive.google.com/file/d/${cleanId}/view`;
}

/**
 * Genera el enlace directo a un correo o hilo en Gmail.
 * @param messageId ID del mensaje o hilo de correo.
 */
export function generateGmailLink(messageId: string): string {
  if (!messageId) return "https://mail.google.com/mail/u/0/#inbox";
  const cleanId = String(messageId).trim();
  if (!cleanId) return "https://mail.google.com/mail/u/0/#inbox";
  return `https://mail.google.com/mail/u/0/#inbox/${cleanId}`;
}

/**
 * Genera el enlace de búsqueda en Google Drive.
 * @param query Término o filtro de búsqueda.
 */
export function generateDriveSearchLink(query?: string): string {
  if (!query || !query.trim()) return "https://drive.google.com/drive/my-drive";
  return `https://drive.google.com/drive/u/0/search?q=${encodeURIComponent(query.trim())}`;
}

/**
 * Genera el enlace de búsqueda en Gmail.
 * @param query Consulta o filtro de búsqueda de Gmail.
 */
export function generateGmailSearchLink(query?: string): string {
  if (!query || !query.trim()) return "https://mail.google.com/mail/u/0/#search/in:inbox";
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(query.trim())}`;
}
