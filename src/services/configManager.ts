import { dbService } from "../database/db.js";
import { runGog } from "../tools/gogWrapper.js";
import { criticalLogService } from "./criticalLog.js";
import { folderCacheService } from "./folderCache.js";
import { driveMemoryService } from "./driveMemory.js";
import fs from "fs";
import path from "path";

const CURRENT_VERSION = 2;

export interface UserConfig {
  version: number;
  customPrompt: string;
  muteVoice: boolean;
  installedSkills: string[];
  memory?: {
    topicsEnabled: boolean;
    topicsPath: string;
    dailyHistoryPath: string;
    summaryFile: string;
  };
  skillsPath?: string;
  promptsPath?: string;
}

export const configManager = {
  /**
   * Resuelve una ruta de carpetas en Drive para el usuario específico.
   */
  async getOrCreateFolderPath(userId: number, pathParts: string[]): Promise<string> {
    return await folderCacheService.getOrCreateFolderPath(userId, pathParts);
  },

  /**
   * Carga la configuración del usuario desde Google Drive, aplicando control de cambios por metadatos (modifiedTime y size).
   */
  async loadConfig(userId: number): Promise<UserConfig> {
    const userFolder = path.join(process.cwd(), "data", `user_${userId}`);
    const localConfigPath = path.join(userFolder, "config.json");
    
    let configObj: UserConfig = {
      version: CURRENT_VERSION,
      customPrompt: "",
      muteVoice: false,
      installedSkills: []
    };

    try {
      const silvaniaFolderId = await this.getOrCreateFolderPath(userId, ["silvania"]);
      const fileName = "config.json";
      
      const searchRes = await runGog(
        `drive search "name = '${fileName}' and '${silvaniaFolderId}' in parents and trashed = false" --raw-query --json`,
        userId
      );
      const parsed = JSON.parse(searchRes);
      const files = parsed.files || (Array.isArray(parsed) ? parsed : []);
      
      if (files.length === 0) {
        console.log(`📦 [Config Manager] Creando config.json por defecto en Drive para usuario ${userId}...`);
        
        // Cargar valores iniciales del caché local si ya existen
        try {
          const cp = await dbService.getCustomPrompt(userId) || "";
          const mv = await dbService.getMuteVoice(userId) || false;
          configObj.customPrompt = cp;
          configObj.muteVoice = mv;
        } catch {}
        
        await this.saveConfig(userId, configObj);
      } else {
        const driveFile = files[0];
        const driveModifiedTime = driveFile.modifiedTime || "";
        const driveSize = driveFile.size !== undefined ? Number(driveFile.size) : 0;

        // 1. Control de cambios: verificar metadatos guardados en la DB
        let isCacheValid = false;
        try {
          const syncInfo = await dbService.getConfigSyncInfo(userId);
          const isFilePresentLocally = fs.existsSync(localConfigPath);
          
          if (isFilePresentLocally && syncInfo.lastSyncTime === driveModifiedTime && syncInfo.lastSyncSize === driveSize) {
            console.log(`⚡ [Config Manager] Evitando descarga de config.json para ${userId}: los metadatos coinciden (sin cambios).`);
            isCacheValid = true;
          }
        } catch (syncErr: any) {
          console.warn("⚠️ Error leyendo metadatos de sincronización de DB:", syncErr.message);
        }

        if (isCacheValid) {
          // Leer de la caché local aislada
          try {
            const cachedContent = fs.readFileSync(localConfigPath, "utf8");
            configObj = JSON.parse(cachedContent);
          } catch (readErr: any) {
            console.warn("⚠️ Falló lectura de caché local aislada, procediendo a descargar de Drive:", readErr.message);
            isCacheValid = false;
          }
        }

        if (!isCacheValid) {
          // 2. Descargar el archivo desde Google Drive
          if (!fs.existsSync(userFolder)) {
            fs.mkdirSync(userFolder, { recursive: true });
          }

          const tempName = `download_config_${userId}.json`;
          const tempPath = path.join(process.cwd(), "temp", tempName);
          if (!fs.existsSync(path.dirname(tempPath))) {
            fs.mkdirSync(path.dirname(tempPath), { recursive: true });
          }
          
          await runGog(`drive download ${driveFile.id} --out="${tempPath}"`, userId);
          const downloadedPath = tempPath;
          
          if (fs.existsSync(downloadedPath)) {
            const content = fs.readFileSync(downloadedPath, "utf8");
            try {
              configObj = JSON.parse(content);
              
              // Guardar en la caché local aislada
              fs.writeFileSync(localConfigPath, content, "utf8");
              
              // Registrar metadatos de sincronización
              await dbService.setConfigSyncInfo(userId, driveModifiedTime, driveSize);

              // Migrar esquema si es necesario
              if (!configObj.version || configObj.version < CURRENT_VERSION) {
                console.log(`📦 [Config Manager] Migrando configuración de versión ${configObj.version || 0} a ${CURRENT_VERSION}`);
                configObj = this.migrateConfig(configObj);
                await this.saveConfig(userId, configObj);
              }
            } catch (e: any) {
              console.error("❌ [Config Manager] Error de parseo en config.json descargado:", e.message);
              throw e;
            } finally {
              try { fs.unlinkSync(downloadedPath); } catch {}
            }
          } else {
            throw new Error("El archivo descargado no se encontró en la ruta temporal.");
          }
        }
      }

      // Sincronizar a caché local de DB
      await dbService.setCustomPrompt(userId, configObj.customPrompt || "");
      await dbService.setMuteVoice(userId, !!configObj.muteVoice);

      return configObj;
    } catch (err: any) {
      // Registro en sistema de logs críticos
      await criticalLogService.logCritical(
        "Fallo Carga Configuración",
        `No se pudo cargar la configuración de Drive para usuario ${userId}. Se utilizó fallback seguro. Error: ${err.message}`
      );

      // Fallback robusto de tres capas (Drive -> local DB -> defaults)
      try {
        if (fs.existsSync(localConfigPath)) {
          const cachedContent = fs.readFileSync(localConfigPath, "utf8");
          return JSON.parse(cachedContent);
        }
      } catch {}

      try {
        const cp = await dbService.getCustomPrompt(userId) || "";
        const mv = await dbService.getMuteVoice(userId) || false;
        return {
          version: CURRENT_VERSION,
          customPrompt: cp,
          muteVoice: mv,
          installedSkills: []
        };
      } catch (dbErr: any) {
        console.error("❌ Fallback de base de datos también falló:", dbErr.message);
        return {
          version: CURRENT_VERSION,
          customPrompt: "",
          muteVoice: false,
          installedSkills: []
        };
      }
    }
  },

  /**
   * Guarda la configuración del usuario en Google Drive de forma persistente.
   */
  async saveConfig(userId: number, config: UserConfig): Promise<void> {
    const userFolder = path.join(process.cwd(), "data", `user_${userId}`);
    const localConfigPath = path.join(userFolder, "config.json");

    try {
      const silvaniaFolderId = await this.getOrCreateFolderPath(userId, ["silvania"]);
      const fileName = "config.json";
      
      const tempName = `config_${userId}.json`;
      const tempPath = path.join(process.cwd(), "temp", tempName);
      if (!fs.existsSync(path.dirname(tempPath))) {
        fs.mkdirSync(path.dirname(tempPath), { recursive: true });
      }
      
      const configStr = JSON.stringify(config, null, 2);
      fs.writeFileSync(tempPath, configStr, "utf8");
      
      // Guardar también en la caché local aislada
      if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });
      }
      fs.writeFileSync(localConfigPath, configStr, "utf8");
      
      // Subir o reemplazar configuración
      const uploadRes = await driveMemoryService.uploadOrReplace(userId, tempPath, fileName, silvaniaFolderId);
      try { fs.unlinkSync(tempPath); } catch {}

      // Consultar y actualizar metadatos locales de sincronización tras la subida exitosa
      try {
        // Buscar el archivo subido de nuevo para obtener modifiedTime exacto asignado por Google Drive
        const checkRes = await runGog(
          `drive search "name = '${fileName}' and '${silvaniaFolderId}' in parents and trashed = false" --raw-query --json`,
          userId
        );
        const checkParsed = JSON.parse(checkRes);
        const checkFiles = checkParsed.files || [];
        if (checkFiles.length > 0) {
          const f = checkFiles[0];
          await dbService.setConfigSyncInfo(userId, f.modifiedTime || "", f.size !== undefined ? Number(f.size) : 0);
        }
      } catch (syncErr: any) {
        console.warn("⚠️ Error registrando metadatos de sincronización tras guardar:", syncErr.message);
      }

      console.log(`✅ [Config Manager] Configuración guardada en Drive y caché local para usuario ${userId}.`);
    } catch (err: any) {
      await criticalLogService.logCritical(
        "Fallo Guardado Configuración",
        `No se pudo guardar la configuración de Drive para usuario ${userId}. Error: ${err.message}`
      );
    }
  },

  /**
   * Función para realizar conversiones automáticas de esquema de configuración.
   */
  migrateConfig(oldConfig: any): UserConfig {
    return {
      version: CURRENT_VERSION,
      customPrompt: oldConfig.customPrompt || oldConfig.agentInstructions || "",
      muteVoice: !!(oldConfig.muteVoice),
      installedSkills: Array.isArray(oldConfig.installedSkills) ? oldConfig.installedSkills : [],
      memory: {
        topicsEnabled: oldConfig.memory?.topicsEnabled !== undefined ? oldConfig.memory.topicsEnabled : true,
        topicsPath: oldConfig.memory?.topicsPath || "silvania/temas",
        dailyHistoryPath: oldConfig.memory?.dailyHistoryPath || "silvania/historial",
        summaryFile: oldConfig.memory?.summaryFile || "silvania/memoria_conversacion.json"
      },
      skillsPath: oldConfig.skillsPath || "silvania/skills",
      promptsPath: oldConfig.promptsPath || "silvania/prompts"
    };
  }
};
