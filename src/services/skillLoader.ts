import { runGog } from "../tools/gogWrapper.js";
import { configManager } from "./configManager.js";
import { criticalLogService } from "./criticalLog.js";
import { uploadSkillToDrive } from "../tools/skills.js";
import fs from "fs";
import path from "path";

export const skillLoader = {
  /**
   * Sincroniza todas las habilidades activas del usuario desde su Google Drive a la caché local aislada.
   * Utiliza estrictamente el ID canónico de 'silvania/skills'.
   * Si en la carpeta canónica no hay skills pero el código local tiene SKILL.md,
   * re-sube/instala las skills en la canónica sin borrar carpetas viejas duplicadas.
   */
  async syncSkillsFromDrive(userId: number): Promise<void> {
    try {
      console.log(`🔄 [Skill Loader] Sincronizando habilidades desde Drive para usuario ${userId}...`);
      
      const skillsFolderId = await configManager.getOrCreateFolderPath(userId, ["silvania", "skills"]);
      const localSkillsDir = path.resolve("skills", userId.toString());
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
            const skillFileId = fFiles[0].id;
            const tempDownloadPath = path.join(process.cwd(), "temp", `download_skill_${userId}_${folderName}.md`);
            if (!fs.existsSync(path.dirname(tempDownloadPath))) {
              fs.mkdirSync(path.dirname(tempDownloadPath), { recursive: true });
            }

            // Descargar el SKILL.md a temp y moverlo a la carpeta local del usuario
            await runGog(`drive download ${skillFileId} --out="${tempDownloadPath}"`, userId);
            
            if (fs.existsSync(tempDownloadPath)) {
              fs.copyFileSync(tempDownloadPath, path.join(localFolder, "SKILL.md"));
              try { fs.unlinkSync(tempDownloadPath); } catch {}
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
              }
            }
          } catch (skillUploadErr: any) {
            console.warn(`⚠️ [Skill Loader] Error al re-subir skill '${f}' a Drive:`, skillUploadErr.message);
          }
        }
      }

      console.log(`✅ [Skill Loader] Sincronización de habilidades completada para usuario ${userId} (${driveSkillsCount} skills activas).`);
    } catch (err: any) {
      await criticalLogService.logCritical(
        "Fallo Sincronización Habilidades (syncSkillsFromDrive)",
        `Error al intentar sincronizar las habilidades desde Drive para usuario ${userId}: ${err.message}`
      );
    }
  }
};
