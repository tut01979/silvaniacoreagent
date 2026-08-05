import { dbService } from "../database/db.js";
import { runGog } from "../tools/gogWrapper.js";
import { configManager } from "./configManager.js";
import { skillLoader } from "./skillLoader.js";
import { criticalLogService } from "./criticalLog.js";
import { folderCacheService } from "./folderCache.js";
import fs from "fs";
import path from "path";

export const driveMemoryService = {
  /**
   * Resuelve una ruta de carpetas anidadas en Google Drive, creándolas de forma secuencial si no existen.
   */
  async getOrCreateFolderPath(pathParts: string[], userId?: number): Promise<string> {
    return await folderCacheService.getOrCreateFolderPath(userId || 0, pathParts);
  },

  /**
   * Obtiene la fecha actual en la zona horaria de Madrid
   */
  getMadridDate() {
    const now = new Date();
    const madridTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
    return {
      YYYY: madridTime.getFullYear().toString(),
      MM: (madridTime.getMonth() + 1).toString().padStart(2, "0"),
      DD: madridTime.getDate().toString().padStart(2, "0"),
      madridTime
    };
  },

  /**
   * Sincroniza el historial local (caché) con el historial estructurado en Google Drive.
   * Si la caché local está vacía, descarga los archivos de los días más recientes para reconstruirla.
   */
  async syncFromDrive(userId: number): Promise<void> {
    try {
      const token = await dbService.getUserToken(userId);
      if (!token) return;

      // Optimización: si ya hay historial local, evitar crear carpetas y llamadas de red de Drive
      const localHistory = await dbService.getHistory(userId, 100);
      if (localHistory.length > 0) {
        console.log("ℹ️ [Drive Memory] Caché local caliente. Omitiendo sincronización y llamadas de red de Drive.");
        return;
      }

      console.log(`🔄 [Drive Memory] Sincronizando historial estructurado y prompts desde Drive para usuario ${userId}...`);
      
      // 1. Asegurar estructura de carpetas básica con control de errores individual
      try {
        const mainFolderId = await this.getOrCreateFolderPath(["silvania"], userId);
        const promptsFolderId = await this.getOrCreateFolderPath(["silvania", "prompts"], userId);
        await this.getOrCreateFolderPath(["silvania", "documentos"], userId);
        await this.getOrCreateFolderPath(["silvania", "temas"], userId);
        await this.getOrCreateFolderPath(["silvania", "historial"], userId);
      } catch (folderErr: any) {
        console.error("⚠️ [Drive Memory] Error al asegurar directorios en Drive:", folderErr.message);
        // Continuamos de todas formas ya que los gestores configManager/skillLoader tienen sus propios fallbacks
      }

      // 2. Sincronizar configuraciones y habilidades desde Drive con fallbacks ya protegidos en configManager/skillLoader
      try {
        await configManager.loadConfig(userId);
      } catch (confErr: any) {
        console.error("⚠️ [Drive Memory] Falló loadConfig, continuando con fallback local:", confErr.message);
      }

      try {
        await skillLoader.syncSkillsFromDrive(userId);
      } catch (skillErr: any) {
        console.error("⚠️ [Drive Memory] Falló syncSkillsFromDrive, continuando con fallback local:", skillErr.message);
      }

      // 3. Sincronizar historial de chat
      try {
        const localHistory = await dbService.getHistory(userId, 100);
        if (localHistory.length > 0) {
          console.log("ℹ️ [Drive Memory] Caché local caliente. No es necesario descargar historial del Drive.");
          return;
        }

        console.log("ℹ️ [Drive Memory] Caché local vacía. Buscando logs diarios en Drive para restaurar...");
        const { YYYY, MM } = this.getMadridDate();
        const folderId = await this.getOrCreateFolderPath(["silvania", "historial", YYYY, MM], userId);
        if (folderId === "root") return;

        // Buscar todos los archivos JSON en la carpeta del mes actual
        const searchRes = await runGog(`drive search "'${folderId}' in parents and mimeType = 'application/json' and trashed = false" --raw-query --json`, userId);
        const parsed = JSON.parse(searchRes);
        const files: any[] = parsed.files || (Array.isArray(parsed) ? parsed : []);

        if (files.length === 0) {
          console.log("ℹ️ [Drive Memory] No se encontraron archivos de conversación para el mes actual.");
          return;
        }

        // Ordenar por nombre del archivo (dia_DD.json) para procesar los días en orden cronológico
        const dayFiles = files
          .filter(f => f.name.startsWith("dia_") && f.name.endsWith(".json"))
          .sort((a, b) => {
            const dayA = parseInt(a.name.replace("dia_", "").replace(".json", "")) || 0;
            const dayB = parseInt(b.name.replace("dia_", "").replace(".json", "")) || 0;
            return dayA - dayB;
          });

        console.log(`✅ [Drive Memory] Encontrados ${dayFiles.length} archivos de conversación diaria. Descargando...`);

        const restoredMessages: any[] = [];
        const tempDir = path.join(process.cwd(), "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        for (const file of dayFiles) {
          const tempName = `download_restore_${userId}_${file.id}.json`;
          const tempPath = path.join(tempDir, tempName);
          
          try {
            await runGog(`drive download ${file.id} --out="${tempPath}"`, userId);
            if (fs.existsSync(tempPath)) {
              const content = fs.readFileSync(tempPath, "utf8");
              fs.unlinkSync(tempPath);
              const messages = JSON.parse(content);
              if (Array.isArray(messages)) {
                restoredMessages.push(...messages);
              }
            }
          } catch (downloadErr: any) {
            console.error(`❌ Error descargando archivo de restauración ${file.name}:`, downloadErr.message);
          }
        }

        if (restoredMessages.length > 0) {
          console.log(`🔄 [Drive Memory] Restaurando ${restoredMessages.length} mensajes en la caché local...`);
          for (const msg of restoredMessages) {
            try {
              await dbService.addMessage(userId, msg.role, msg.content);
            } catch (addMsgErr: any) {
              console.error("❌ Error al insertar mensaje restaurado en base de datos local:", addMsgErr.message);
            }
          }
          console.log("✅ [Drive Memory] Historial de conversación restaurado con éxito.");
        }
      } catch (histRestoreErr: any) {
        await criticalLogService.logCritical(
          "Restauración Historial Fallida",
          `Error al intentar restaurar el historial de chat desde Drive para usuario ${userId}: ${histRestoreErr.message}`
        );
      }
    } catch (err: any) {
      await criticalLogService.logCritical(
        "Fallo Sincronización Inicial (syncFromDrive)",
        `Error fatal en la sincronización inicial desde Drive para usuario ${userId}: ${err.message}`
      );
    }
  },

  /**
   * Sincroniza y guarda los mensajes de hoy en Google Drive: silvania/historial/YYYY/MM/dia_DD.json
   */
  async syncToDrive(userId: number): Promise<void> {
    try {
      const token = await dbService.getUserToken(userId);
      if (!token) return;

      console.log(`🔄 [Drive Memory] Subiendo mensajes del día a Drive para usuario ${userId}...`);
      
      // Sincronizar configuración consolidada a Drive al finalizar el turno solo si cambió
      try {
        const cp = await dbService.getCustomPrompt(userId) || "";
        const mv = await dbService.getMuteVoice(userId) || false;
        const config = await configManager.loadConfig(userId);
        if (config.customPrompt !== cp || config.muteVoice !== mv) {
          console.log(`ℹ️ [Drive Memory] Detectados cambios en la configuración. Sincronizando config.json a Drive.`);
          config.customPrompt = cp;
          config.muteVoice = mv;
          await configManager.saveConfig(userId, config);
        } else {
          console.log(`⚡ [Drive Memory] Omitiendo subida de config.json: los valores coinciden.`);
        }
      } catch (configSaveErr: any) {
        console.error("❌ [Drive Memory] Error al sincronizar configuración a Drive al finalizar:", configSaveErr.message);
      }

      // Obtener mensajes correspondientes al día de hoy
      const todayMessages = await dbService.getTodayMessages(userId);
      if (todayMessages.length === 0) {
        console.log("ℹ️ [Drive Memory] No hay mensajes nuevos hoy para subir.");
        return;
      }

      const { YYYY, MM, DD } = this.getMadridDate();

      // Crear archivo temporal JSON
      const tempName = `day_${userId}_${YYYY}_${MM}_${DD}.json`;
      const tempPath = path.join(process.cwd(), "temp", tempName);
      if (!fs.existsSync(path.dirname(tempPath))) {
        fs.mkdirSync(path.dirname(tempPath), { recursive: true });
      }

      fs.writeFileSync(tempPath, JSON.stringify(todayMessages, null, 2));

      // Resolver ruta de carpeta YYYY/MM en Drive
      const folderId = await this.getOrCreateFolderPath(["silvania", "historial", YYYY, MM], userId);

      // Buscar si ya existe el archivo del día en esa carpeta
      const fileName = `dia_${DD}.json`;
      const searchRes = await runGog(`drive search "name = '${fileName}' and '${folderId}' in parents and trashed = false" --raw-query --json`, userId);
      const parsed = JSON.parse(searchRes);
      const files = parsed.files || (Array.isArray(parsed) ? parsed : []);

      if (files.length > 0) {
        const fileId = files[0].id;
        try {
          await runGog(`drive rm ${fileId}`, userId);
        } catch (rmErr) {
          console.warn("⚠️ Advertencia al eliminar archivo de día anterior en Drive:", rmErr);
        }
      }

      // Subir el archivo de hoy
      await runGog(`drive upload "${tempPath}" --parent=${folderId} --name="${fileName}"`, userId);
      console.log(`✅ [Drive Memory] Historial diario para ${YYYY}-${MM}-${DD} guardado en Drive.`);
      
      // Limpiar archivo temporal
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      // Actualizar el archivo resumen (memoria_conversacion.json) de forma automática y asíncrona
      try {
        const { memoryManager } = await import("./memoryManager.js");
        await memoryManager.autoUpdateSummary(userId);
      } catch (sumErr: any) {
        console.error("❌ [Drive Memory] Error al actualizar memoria_conversacion.json:", sumErr.message);
      }
    } catch (err: any) {
      await criticalLogService.logCritical(
        "Fallo Guardado Historial (syncToDrive)",
        `Error al intentar subir el historial estructurado de hoy para usuario ${userId}: ${err.message}`
      );
    }
  },

  /**
   * Elimina toda la carpeta 'historial' de Google Drive del usuario para reiniciar memoria.
   */
  async clearMemoryOnDrive(userId: number): Promise<void> {
    try {
      const token = await dbService.getUserToken(userId);
      if (!token) return;
      
      console.log(`🗑️ [Drive Memory] Eliminando carpeta de historial en Drive para usuario ${userId}...`);
      
      // Buscar la carpeta 'historial' que esté dentro de la carpeta principal 'silvania'
      const parentFolderId = await this.getOrCreateFolderPath(["silvania"], userId);
      
      const searchRes = await runGog(`drive search "name = 'historial' and mimeType = 'application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed = false" --raw-query --json`, userId);
      const parsed = JSON.parse(searchRes);
      const files = parsed.files || (Array.isArray(parsed) ? parsed : []);
      
      if (files.length > 0) {
        const folderId = files[0].id;
        await runGog(`drive rm ${folderId}`, userId);
        console.log("✅ [Drive Memory] Carpeta de historial en Google Drive eliminada con éxito.");
      }
    } catch (err: any) {
      console.error("❌ [Drive Memory] Error eliminando historial en Drive:", err.message);
    }
  }
};
