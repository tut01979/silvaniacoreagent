import { runGog } from "../tools/gogWrapper.js";
import { configManager } from "./configManager.js";
import { criticalLogService } from "./criticalLog.js";
import fs from "fs";
import path from "path";

export const skillLoader = {
  /**
   * Sincroniza todas las habilidades activas del usuario desde su Google Drive a la caché local aislada.
   */
  async syncSkillsFromDrive(userId: number): Promise<void> {
    try {
      console.log(`🔄 [Skill Loader] Sincronizando habilidades desde Drive para usuario ${userId}...`);
      
      const skillsFolderId = await configManager.getOrCreateFolderPath(userId, ["silvania", "skills"]);
      const localSkillsDir = path.resolve("skills", userId.toString());
      if (!fs.existsSync(localSkillsDir)) {
        fs.mkdirSync(localSkillsDir, { recursive: true });
      }

      // Buscar subcarpetas de habilidades en la carpeta 'silvania/skills' de Drive
      const searchRes = await runGog(
        `drive search "'${skillsFolderId}' in parents and trashed = false" --raw-query --json`,
        userId
      );
      const parsed = JSON.parse(searchRes);
      const items = parsed.files || (Array.isArray(parsed) ? parsed : []);

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
      console.log(`✅ [Skill Loader] Sincronización de habilidades completada para usuario ${userId}.`);
    } catch (err: any) {
      await criticalLogService.logCritical(
        "Fallo Sincronización Habilidades (syncSkillsFromDrive)",
        `Error al intentar sincronizar las habilidades desde Drive para usuario ${userId}: ${err.message}`
      );
    }
  }
};
