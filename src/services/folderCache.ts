import { runGog } from "../tools/gogWrapper.js";

// Caché en memoria para evitar búsquedas repetitivas de carpetas en Google Drive
// Key: "userId:pathParts.join('/')", Value: folderId
const folderIdCache = new Map<string, string>();

export const folderCacheService = {
  /**
   * Resuelve una ruta de carpetas anidadas en Google Drive para un usuario,
   * utilizando caché en memoria para evitar búsquedas repetitivas lentas.
   */
  async getOrCreateFolderPath(userId: number, pathParts: string[]): Promise<string> {
    let parentId = "root";
    const resolvedParts: string[] = [];

    for (const part of pathParts) {
      resolvedParts.push(part);
      const cacheKey = `${userId}:${resolvedParts.join("/")}`;

      if (folderIdCache.has(cacheKey)) {
        parentId = folderIdCache.get(cacheKey)!;
        continue;
      }

      try {
        const searchRes = await runGog(
          `drive search "name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false" --raw-query --json`,
          userId
        );
        const parsed = JSON.parse(searchRes);
        const files = parsed.files || (Array.isArray(parsed) ? parsed : []);
        const exactMatch = files.find((f: any) => f.name === part);

        if (exactMatch) {
          parentId = exactMatch.id;
        } else if (files.length > 0) {
          parentId = files[0].id;
        } else {
          // Crear la carpeta de forma segura
          let cmd = `drive mkdir "${part}" --json`;
          if (parentId !== "root") cmd += ` --parent=${parentId}`;
          const createRes = await runGog(cmd, userId);
          const cParsed = JSON.parse(createRes);
          const folder = cParsed.folder || cParsed;
          parentId = folder.id;
        }

        // Guardar en caché el ID de la subruta resuelta
        folderIdCache.set(cacheKey, parentId);
      } catch (err: any) {
        console.error(`❌ [Folder Cache] Error resolviendo carpeta '${part}':`, err.message);
        return "root";
      }
    }

    return parentId;
  },

  /**
   * Permite invalidar o limpiar la caché si es necesario.
   */
  clearCache(): void {
    folderIdCache.clear();
  }
};
