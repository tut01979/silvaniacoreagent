import { runGog } from "../tools/gogWrapper.js";
import { configManager } from "./configManager.js";
import { criticalLogService } from "./criticalLog.js";
import { uploadSkillToDrive } from "../tools/skills.js";
import { dbService } from "../database/db.js";
import fs from "fs";
import path from "path";

interface CachedSkillMeta {
  fileId: string;
  modifiedTime?: string;
}

interface UserSkillCacheEntry {
  lastSyncTime: number;
  skills: Map<string, CachedSkillMeta>;
}

const userSkillCache = new Map<number, UserSkillCacheEntry>();
const SKILL_SYNC_TTL_MS = 20 * 60 * 1000; // 20 minutos

export const skillLoader = {
  /**
   * Invalida la caché de sincronización de habilidades de un usuario
   */
  invalidateCache(userId: number): void {
    userSkillCache.delete(userId);
  },

  /**
   * Sincroniza todas las habilidades activas del usuario desde su Google Drive a la caché local aislada.
   * Utiliza estrictamente el ID canónico de 'silvania/skills'.
   * Si en la carpeta canónica no hay skills pero el código local tiene SKILL.md,
   * re-sube/instala las skills en la canónica sin borrar carpetas viejas duplicadas.
   */
  async syncSkillsFromDrive(userId: number, forceSync: boolean = false): Promise<void> {
    try {
      const token = await dbService.getUserToken(userId);
      if (!token || !token.refresh_token) {
        console.log(`ℹ️ [Skill Loader] Usuario ${userId} sin token de Google, omitiendo syncSkillsFromDrive.`);
        return;
      }

      const localSkillsDir = path.resolve("skills", userId.toString());
      const cached = userSkillCache.get(userId);

      // Verificación de TTL en memoria: evitar llamadas de red innecesarias en cada mensaje
      if (!forceSync && cached && (Date.now() - cached.lastSyncTime < SKILL_SYNC_TTL_MS)) {
        if (fs.existsSync(localSkillsDir)) {
          const localFolders = fs.readdirSync(localSkillsDir);
          if (localFolders.length > 0) {
            console.log(`ℹ️ [Skill Loader] Caché válida para usuario ${userId} (TTL: 20 min, ${localFolders.length} skills locales). Omitiendo re-descargas de Drive.`);
            return;
          }
        }
      }

      console.log(`🔄 [Skill Loader] Sincronizando habilidades desde Drive para usuario ${userId}...`);
      
      const skillsFolderId = await configManager.getOrCreateFolderPath(userId, ["silvania", "skills"]);
      if (!fs.existsSync(localSkillsDir)) {
        fs.mkdirSync(localSkillsDir, { recursive: true });
      }

      // Buscar subcarpetas de habilidades en la carpeta canónica 'silvania/skills' de Drive
      const searchRes = await runGog(
        `drive search "'${skillsFolderId}' in parents and trashed = false" --raw-query --json`,
        userId
      );
      const parsed = JSON.parse(searchRes);
      const items = parsed.files || (Array.isArray(parsed) ? parsed : []);

      let driveSkillsCount = 0;
      let downloadCount = 0;
      let omittedCount = 0;
      const newSkillsMap = new Map<string, CachedSkillMeta>();

      for (const item of items) {
        if (item.mimeType === "application/vnd.google-apps.folder") {
          const folderName = item.name;
          const folderId = item.id;
          const localFolder = path.join(localSkillsDir, folderName);
          if (!fs.existsSync(localFolder)) {
            fs.mkdirSync(localFolder, { recursive: true });
          }

          // Buscar el archivo SKILL.md dentro de esta subcarpeta en Drive
          const fileSearchRes = await runGog(
            `drive search "name = 'SKILL.md' and '${folderId}' in parents and trashed = false" --raw-query --json`,
            userId
          );
          const fParsed = JSON.parse(fileSearchRes);
          const fFiles = fParsed.files || (Array.isArray(fParsed) ? fParsed : []);

          if (fFiles.length > 0) {
            driveSkillsCount++;
            const skillFile = fFiles[0];
            const skillFileId = skillFile.id;
            const skillModifiedTime = skillFile.modifiedTime || "";
            const localSkillMd = path.join(localFolder, "SKILL.md");

            newSkillsMap.set(folderName, {
              fileId: skillFileId,
              modifiedTime: skillModifiedTime
            });

            // Verificar si el archivo ya existe localmente y coincide con los metadatos de Drive
            const prevCached = cached?.skills.get(folderName);
            const isLocalPresent = fs.existsSync(localSkillMd) && fs.statSync(localSkillMd).size > 0;
            const isMetaMatch = prevCached && prevCached.fileId === skillFileId && (!skillModifiedTime || prevCached.modifiedTime === skillModifiedTime);

            if (isLocalPresent && isMetaMatch && !forceSync) {
              omittedCount++;
              continue;
            }

            const tempDownloadPath = path.join(process.cwd(), "temp", `download_skill_${userId}_${folderName}.md`);
            if (!fs.existsSync(path.dirname(tempDownloadPath))) {
              fs.mkdirSync(path.dirname(tempDownloadPath), { recursive: true });
            }

            // Descargar el SKILL.md a temp y moverlo a la carpeta local del usuario
            await runGog(`drive download ${skillFileId} --out="${tempDownloadPath}"`, userId);
            
            if (fs.existsSync(tempDownloadPath)) {
              fs.copyFileSync(tempDownloadPath, localSkillMd);
              try { fs.unlinkSync(tempDownloadPath); } catch {}
              downloadCount++;
            }
          }
        }
      }

      // Si en la carpeta canónica no hay skills pero en el entorno local sí existen, re-subir a la canónica
      if (driveSkillsCount === 0 && fs.existsSync(localSkillsDir)) {
        const localFolders = fs.readdirSync(localSkillsDir);
        for (const f of localFolders) {
          const localFolder = path.join(localSkillsDir, f);
          try {
            if (fs.statSync(localFolder).isDirectory()) {
              const localSkillMd = path.join(localFolder, "SKILL.md");
              if (fs.existsSync(localSkillMd)) {
                console.log(`ℹ️ [Skill Loader] Re-enlazando y subiendo skill '${f}' a la carpeta canónica en Drive...`);
                await uploadSkillToDrive(userId, f, localFolder);
                driveSkillsCount++;
                downloadCount++;
              }
            }
          } catch (skillUploadErr: any) {
            console.warn(`⚠️ [Skill Loader] Error al re-subir skill '${f}' a Drive:`, skillUploadErr.message);
          }
        }
      }

      // Actualizar la caché en memoria para este usuario
      userSkillCache.set(userId, {
        lastSyncTime: Date.now(),
        skills: newSkillsMap
      });

      console.log(`✅ [Skill Loader] Sincronización de habilidades completada para usuario ${userId}: ${driveSkillsCount} skills activas (${downloadCount} descargas, ${omittedCount} omitidas por caché).`);
    } catch (err: any) {
      const msg = err.message || "";
      const isAuthErr = msg.includes("Tu sesión de Google expiró") || msg.includes("invalid_grant") || msg.includes("unauthorized_client");
      if (!isAuthErr) {
        await criticalLogService.logCritical(
          "Fallo Sincronización Habilidades (syncSkillsFromDrive)",
          `Error al intentar sincronizar las habilidades desde Drive para usuario ${userId}: ${msg}`
        );
      } else {
        console.warn(`⚠️ [Skill Loader] Sesión expirada para usuario ${userId}, omitiendo syncSkillsFromDrive.`);
      }
    }
  }
};
