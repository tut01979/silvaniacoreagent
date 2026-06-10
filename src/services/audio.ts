import axios from "axios";
import fs from "fs";
import path from "path";
import { config } from "../config/config.js";
import { llmService } from "./llm.js";

export const audioService = {
  async downloadAndTranscribe(fileUrl: string, fileName: string) {
    const tempDir = path.resolve(config.tempDir);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const filePath = path.join(tempDir, fileName);
    const writer = fs.createWriteStream(filePath);

    const response = await axios({
      url: fileUrl,
      method: 'GET',
      responseType: 'stream'
    });

    response.data.pipe(writer);

    return new Promise<string>((resolve, reject) => {
      writer.on('finish', async () => {
        try {
          // Aseguramos que el archivo existe y tiene contenido
          if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("El archivo de audio está vacío o no se descargó correctamente.");
          }
          const text = await llmService.transcribe(filePath);
          resolve(text);
        } catch (err) {
          reject(err);
        }
      });
      writer.on('error', (err) => {
        console.error("Error escribiendo archivo de audio:", err);
        reject(err);
      });
      response.data.on('error', (err: any) => {
        console.error("Error descargando audio de Telegram:", err);
        reject(err);
      });
    });
  }
};
