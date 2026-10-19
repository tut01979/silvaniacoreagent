import { runGog } from "../tools/gogWrapper.js";
import { dbService } from "../database/db.js";

// Caché en memoria para evitar búsquedas repetitivas de carpetas en Google Drive
// Key: "userId:pathParts.join('/')", Value: folderId
const folderIdCache = new Map<string, string>();

/**
 * Detecta si un error devuelto por la API de Google Drive corresponde a un 404 notFound
 */
export function isNotFoundError(err: any): boolean {
  const msg = typeof err === "string" ? err : (err?.message || "");
  const lower = msg.toLowerCase();
  return lower.includes("notfound") ||
         lower.includes("not found") ||
         lower.includes("404") ||
         lower.includes("file not found");
}

export const folderCacheService = {
  /**
   * Invalida una ruta específica de la caché en memoria y de la base de datos (drive_folders).
   */
  async invalidatePath(userId: number, pathInput: string[] | string): Promise<void> {
    const pathParts = Array.isArray(pathInput)
      ? pathInput
      : String(pathInput).split(/[/\\]/).filter(p => p.trim().length > 0);
    const fullPathStr = pathParts.join("/");
    const cacheKey = `${userId}:${fullPathStr}`;
    folderIdCache.delete(cacheKey);
    await dbService.deleteDriveFolder(userId, fullPathStr);
    console.log(`🧹 [Folder Cache] Ruta invalidada de DB y memoria: '${fullPathStr}' (userId=${userId})`);
  },

  /**
   * Invalida cualquier entrada en memoria y DB asociada a un folderId específico (útil tras 404 notFound).
   */
  async invalidateFolderId(userId: number, folderId: string): Promise<void> {
    if (!folderId || folderId === "root") return;
    for (const [key, val] of folderIdCache.entries()) {
      if (val === folderId && key.startsWith(`${userId}:`)) {
        folderIdCache.delete(key);
      }
    }
    await dbService.deleteDriveFolderById(userId, folderId);
    console.log(`🧹 [Folder Cache] Folder ID invalidado de DB y memoria: '${folderId}' (userId=${userId})`);
  },

  /**
   * Resuelve una ruta de carpetas anidadas en Google Drive para un usuario,
   * utilizando caché en memoria y persistencia en DB para operar óptimamente con drive.file.
   * Si existen carpetas duplicadas, selecciona de forma canónica la registrada en DB o la más antigua,
   * guardándola en DB y evitando crear duplicados.
   */
  async getOrCreateFolderPath(userId: number, pathInput: string[] | string): Promise<string> {
    const pathParts = Array.isArray(pathInput)
      ? pathInput
      : String(pathInput).split(/[/\\]/).filter(p => p.trim().length > 0);
    const fullPathStr = pathParts.join("/");
    const fullCacheKey = `${userId}:${fullPathStr}`;
    if (folderIdCache.has(fullCacheKey)) {
      return folderIdCache.get(fullCacheKey)!;
    }
    try {
      const persistedFull = await dbService.getDriveFolder(userId, fullPathStr);
      if (persistedFull) {
        folderIdCache.set(fullCacheKey, persistedFull);
        return persistedFull;
      }
    } catch {}

    let parentId = "root";
    const resolvedParts: string[] = [];

    for (const part of pathParts) {
      resolvedParts.push(part);
      const pathStr = resolvedParts.join("/");
      const cacheKey = `${userId}:${pathStr}`;

      // 1. Comprobar caché en memoria
      if (folderIdCache.has(cacheKey)) {
        parentId = folderIdCache.get(cacheKey)!;
        continue;
      }

      // 2. Comprobar persistencia en base de datos (DB drive_folders)
      let persistedId: string | null = null;
      try {
        persistedId = await dbService.getDriveFolder(userId, pathStr);
        if (persistedId) {
          folderIdCache.set(cacheKey, persistedId);
          parentId = persistedId;
          continue;
        }
      } catch {}

      try {
        // 3. Buscar si la carpeta ya existe en Drive bajo el parent actual
        let searchFiles: any[] = [];
        try {
          const searchRes = await runGog(
            `drive search "name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false" --raw-query --json`,
            userId
          );
          const parsed = JSON.parse(searchRes);
          searchFiles = parsed.files || (Array.isArray(parsed) ? parsed : []);
        } catch (searchErr: any) {
          console.warn(`⚠️ [Folder Cache] Búsqueda de carpeta '${part}' en parent '${parentId}' falló: ${searchErr.message}.`);
          if (isNotFoundError(searchErr) && parentId !== "root") {
            console.warn(`⚠️ [Folder Cache] Parent '${parentId}' dio 404 notFound en Drive. Invalidando parent y continuando desde root...`);
            await this.invalidateFolderId(userId, parentId);
            parentId = "root";
          }
          if (
            searchErr.message?.includes("Tu sesión de Google expiró") ||
            searchErr.message?.includes("invalid_grant") ||
            searchErr.message?.includes("unauthorized_client")
          ) {
            throw searchErr;
          }
        }

        // Si la búsqueda con parent no devolvió nada y estamos en root o silvania, intentar búsqueda global de fallback
        if (searchFiles.length === 0 && (parentId === "root" || part === "silvania")) {
          try {
            const globalSearchRes = await runGog(
              `drive search "name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false" --raw-query --json`,
              userId
            );
            const globalParsed = JSON.parse(globalSearchRes);
            const globalFiles = globalParsed.files || (Array.isArray(globalParsed) ? globalParsed : []);
            if (globalFiles.length > 0) {
              searchFiles = globalFiles;
            }
          } catch (gErr: any) {
            console.warn(`⚠️ [Folder Cache] Búsqueda global de fallback para '${part}' falló:`, gErr.message);
            if (
              gErr.message?.includes("Tu sesión de Google expiró") ||
              gErr.message?.includes("invalid_grant") ||
              gErr.message?.includes("unauthorized_client")
            ) {
              throw gErr;
            }
          }
        }

        // Filtrar coincidencias exactas de nombre
        const exactMatches = searchFiles.filter((f: any) => f.name === part);

        if (exactMatches.length > 1) {
          // Detectadas múltiples carpetas duplicadas: seleccionar canónica determinista
          // 1º Preferir la registrada en DB si coincide con algún ID
          let canonicalFolder = exactMatches.find((f: any) => f.id === persistedId);

          if (!canonicalFolder) {
            // 2º Si no está en DB, ordenar por createdTime ascendente (la más antigua)
            const sortedByAge = [...exactMatches].sort((a: any, b: any) => {
              const aTime = a.createdTime || a.modifiedTime || "";
              const bTime = b.createdTime || b.modifiedTime || "";
              return aTime.localeCompare(bTime);
            });
            canonicalFolder = sortedByAge[0];
          }

          parentId = canonicalFolder.id;
          console.warn(`⚠️ [Folder Cache] Detectadas ${exactMatches.length} carpetas '${part}' bajo parent '${parentId}'; usando canónica ID=${parentId}; NO se crea otra.`);
          
          folderIdCache.set(cacheKey, parentId);
          await dbService.saveDriveFolder(userId, pathStr, parentId);
        } else if (exactMatches.length === 1) {
          parentId = exactMatches[0].id;
          folderIdCache.set(cacheKey, parentId);
          await dbService.saveDriveFolder(userId, pathStr, parentId);
        } else if (searchFiles.length > 0) {
          parentId = searchFiles[0].id;
          folderIdCache.set(cacheKey, parentId);
          await dbService.saveDriveFolder(userId, pathStr, parentId);
        } else {
          // REGLA OBLIGATORIA 1: SIEMPRE consultar getDriveFolder(userId, path) antes de drive mkdir
          const checkBeforeMkdir = await dbService.getDriveFolder(userId, pathStr);
          if (checkBeforeMkdir) {
            parentId = checkBeforeMkdir;
            folderIdCache.set(cacheKey, parentId);
            continue;
          }

          // Solo crear si no existe ID en DB y no se encuentra ninguna carpeta usable creada por la app
          let cmd = `drive mkdir "${part}" --json`;
          if (parentId !== "root") cmd += ` --parent=${parentId}`;
          let createRes: string;
          try {
            createRes = await runGog(cmd, userId);
          } catch (mkdirErr: any) {
            if (isNotFoundError(mkdirErr) && parentId !== "root") {
              console.warn(`⚠️ [Folder Cache] Mkdir falló con 404 en parent '${parentId}'. Invalidando y creando en root...`);
              await this.invalidateFolderId(userId, parentId);
              parentId = "root";
              createRes = await runGog(`drive mkdir "${part}" --json`, userId);
            } else {
              throw mkdirErr;
            }
          }
          const cParsed = JSON.parse(createRes);
          const folder = cParsed.folder || cParsed.file || cParsed;
          const newFolderId = folder?.id;

          if (!newFolderId || newFolderId === "root") {
            throw new Error(`Fallo al crear carpeta '${part}' en Google Drive.`);
          }

          parentId = newFolderId;

          // REGLA OBLIGATORIA 2: Tras mkdir ok -> saveDriveFolder(userId, path, id) de forma obligatoria
          folderIdCache.set(cacheKey, parentId);
          await dbService.saveDriveFolder(userId, pathStr, parentId);
          console.log(`📁 [Folder Cache] Carpeta '${pathStr}' creada y registrada canónicamente con ID=${parentId}`);
        }
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
  async clearCache(userId?: number): Promise<void> {
    folderIdCache.clear();
    if (userId) {
      await dbService.clearDriveFolders(userId);
    }
  }
};
