import fs from "fs";
import path from "path";
import crypto from "crypto";
// @ts-ignore
import { WebSocket } from "ws";

const BASE_URL = "speech.platform.bing.com/consumer/speech/synthesize/readaloud";
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WSS_URL = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

export interface EdgeTtsOptions {
  voice?: string; // e.g. "es-ES-AlvaroNeural", "es-ES-ElviraNeural", "es-MX-JorgeNeural"
  rate?: string;  // e.g. "+0%"
  pitch?: string; // e.g. "+0Hz"
  volume?: string;// e.g. "+0%"
}

/**
 * Sintetiza texto a voz usando Edge-TTS (Microsoft Neural) mediante WebSocket.
 * 100% gratuito, sin API key ni coste por request.
 */
export function synthesizeEdgeTts(text: string, options: EdgeTtsOptions = {}): Promise<Buffer> {
  const voice = options.voice || "es-ES-AlvaroNeural";
  const rate = options.rate || "+0%";
  const pitch = options.pitch || "+0Hz";
  const volume = options.volume || "+0%";

  return new Promise<Buffer>((resolve, reject) => {
    const connectionId = crypto.randomUUID().replace(/-/g, "");
    const url = `${WSS_URL}&ConnectionId=${connectionId}`;

    const ws = new WebSocket(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      },
    });

    const audioBuffers: Buffer[] = [];
    const timeout = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error("Timeout en síntesis Edge-TTS (30s)"));
    }, 30000);

    ws.on("error", (err: any) => {
      clearTimeout(timeout);
      reject(err);
    });

    ws.on("message", (rawData: any, isBinary: boolean) => {
      if (!isBinary) {
        const textData = rawData.toString("utf8");
        if (textData.includes("turn.end")) {
          clearTimeout(timeout);
          try { ws.close(); } catch {}
          resolve(Buffer.concat(audioBuffers));
        }
        return;
      }

      const buffer = rawData as Buffer;
      const separator = "Path:audio\r\n";
      const sepIndex = buffer.indexOf(separator);
      if (sepIndex !== -1) {
        const audioChunk = buffer.subarray(sepIndex + separator.length);
        audioBuffers.push(audioChunk);
      }
    });

    ws.on("open", () => {
      // 1. Configuración de formato de audio
      const speechConfig = JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: false,
                wordBoundaryEnabled: false,
              },
              outputFormat: "audio-24khz-48kbitrate-mono-mp3",
            },
          },
        },
      });

      const configMsg =
        `X-Timestamp:${new Date().toISOString()}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        speechConfig;

      ws.send(configMsg, (configErr: any) => {
        if (configErr) {
          clearTimeout(timeout);
          reject(configErr);
          return;
        }

        // 2. Mensaje SSML con el texto a reproducir
        const requestId = crypto.randomUUID().replace(/-/g, "");
        const escapedText = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        const ssml =
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='es-ES'>` +
          `<voice name='${voice}'>` +
          `<prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>` +
          `${escapedText}` +
          `</prosody></voice></speak>`;

        const ssmlMsg =
          `X-RequestId:${requestId}\r\n` +
          `Content-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${new Date().toISOString()}\r\n` +
          `Path:ssml\r\n\r\n` +
          ssml;

        ws.send(ssmlMsg, (ssmlErr: any) => {
          if (ssmlErr) {
            clearTimeout(timeout);
            reject(ssmlErr);
          }
        });
      });
    });
  });
}

/**
 * Guarda directamente el audio generado por Edge-TTS en disco.
 */
export async function saveEdgeTts(text: string, outputPath: string, options: EdgeTtsOptions = {}): Promise<void> {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const buffer = await synthesizeEdgeTts(text, options);
  fs.writeFileSync(outputPath, buffer);
}
