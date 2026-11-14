import fs from "fs";
import path from "path";
import crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";
// @ts-ignore
import { WebSocket } from "ws";
import {
  generateSecMsGecV2,
  adjClockSkewSeconds,
  getUnixTimestamp,
  SEC_MS_GEC_VERSION,
  CHROMIUM_MAJOR_VERSION,
} from "./edgeTtsDrm.js";

const execAsync = promisify(exec);

const BASE_URL = "speech.platform.bing.com/consumer/speech/synthesize/readaloud";
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WSS_URL = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

export interface EdgeTtsOptions {
  voice?: string; // e.g. "es-ES-AlvaroNeural", "es-ES-ElviraNeural", "Alvaro", "Lucia"
  rate?: string;  // e.g. "+0%"
  pitch?: string; // e.g. "+0Hz"
  volume?: string;// e.g. "+0%"
}

/**
 * Resuelve nombres amigables a las voces neuronales oficiales de Microsoft Edge:
 * - "alvaro" -> "es-ES-AlvaroNeural" (Voz masculina premium de España)
 * - "lucia" | "elvira" -> "es-ES-ElviraNeural" (Voz femenina premium de España)
 */
export function resolveVoiceName(voice?: string): string {
  if (!voice) return "es-ES-AlvaroNeural";
  const norm = voice.toLowerCase().trim();
  if (norm.includes("lucia") || norm.includes("elvira") || norm.includes("mujer") || norm.includes("female")) {
    return "es-ES-ElviraNeural";
  }
  if (norm.includes("alvaro") || norm.includes("hombre") || norm.includes("male")) {
    return "es-ES-AlvaroNeural";
  }
  return voice;
}

/**
 * Sintetiza texto a voz usando el motor Edge-TTS (v2 con firma Sec-MS-GEC).
 * Intento 1: WebSocket nativo en Node.js con firma Sec-MS-GEC v2 (0 dependencias externas).
 * Intento 2: Runner Python de respaldo.
 */
export async function saveEdgeTts(text: string, outputPath: string, options: EdgeTtsOptions = {}): Promise<void> {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const voice = resolveVoiceName(options.voice);
  const rate = options.rate || "+0%";

  // Intento 1: WebSocket nativo con Sec-MS-GEC v2 (sin dependencias de Python/Nixpacks/Railpack)
  try {
    const buffer = await synthesizeEdgeTts(text, { ...options, voice });
    if (buffer && buffer.length > 500) {
      fs.writeFileSync(outputPath, buffer);
      console.log(`✅ [Edge-TTS Native] Síntesis exitosa (${voice}, ${buffer.length} bytes)`);
      return;
    }
  } catch (wsErr: any) {
    console.warn(`⚠️ [Edge-TTS Native] WebSocket falló (${wsErr.message}). Probando runner Python...`);
  }

  // Intento 2: Runner Python de respaldo
  const tempDir = dir;
  const tempTextFile = path.join(tempDir, `temp_edge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.txt`);
  try {
    fs.writeFileSync(tempTextFile, text, "utf-8");
    const scriptPath = path.resolve(process.cwd(), "scripts", "synthesize_voice.py");
    const rateArg = rate || "+0%";
    
    const commandsToTry = [
      `/app/.venv/bin/python "${scriptPath}" "${tempTextFile}" "${outputPath}" "${voice}" "${rateArg}"`,
      `python3 "${scriptPath}" "${tempTextFile}" "${outputPath}" "${voice}" "${rateArg}"`,
      `python "${scriptPath}" "${tempTextFile}" "${outputPath}" "${voice}" "${rateArg}"`,
      `py -3 "${scriptPath}" "${tempTextFile}" "${outputPath}" "${voice}" "${rateArg}"`,
      `/app/.venv/bin/edge-tts -f "${tempTextFile}" --write-media "${outputPath}" --voice "${voice}" --rate="${rateArg}"`,
      `edge-tts -f "${tempTextFile}" --write-media "${outputPath}" --voice "${voice}" --rate="${rateArg}"`,
      `python3 -m edge_tts -f "${tempTextFile}" --write-media "${outputPath}" --voice "${voice}" --rate="${rateArg}"`,
      `python -m edge_tts -f "${tempTextFile}" --write-media "${outputPath}" --voice "${voice}" --rate="${rateArg}"`
    ];

    for (const cmd of commandsToTry) {
      try {
        await execAsync(cmd, { timeout: 35000 });
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
          console.log(`✅ [Edge-TTS Runner] Síntesis exitosa con comando: ${cmd.split(" ")[0]} (${fs.statSync(outputPath).size} bytes)`);
          return;
        }
      } catch (err: any) {
        if (!err.message?.includes("not found") && !err.message?.includes("no se reconoce")) {
          console.warn(`⚠️ [Edge-TTS Runner] Intento con ${cmd.split(" ")[0]} falló: ${err.message}`);
        }
      }
    }
  } finally {
    try { fs.unlinkSync(tempTextFile); } catch {}
  }

  throw new Error("Edge-TTS falló tanto en WebSocket nativo como en runner Python.");
}

/**
 * Sintetiza texto a voz usando Edge-TTS mediante WebSocket directo con Sec-MS-GEC v2.
 */
export async function synthesizeEdgeTts(text: string, options: EdgeTtsOptions = {}): Promise<Buffer> {
  try {
    return await _synthesizeEdgeTtsOnce(text, options);
  } catch (err: any) {
    const isTransient = err?.isClockSkewRetryable || /timeout|econnreset|etimedout|socket/i.test(err?.message || "");
    if (isTransient) {
      return await _synthesizeEdgeTtsOnce(text, options);
    }
    throw err;
  }
}

function _synthesizeEdgeTtsOnce(text: string, options: EdgeTtsOptions = {}): Promise<Buffer> {
  const voice = resolveVoiceName(options.voice);
  const rate = options.rate || "+0%";
  const pitch = options.pitch || "+0Hz";
  const volume = options.volume || "+0%";

  return new Promise<Buffer>((resolve, reject) => {
    const connectionId = crypto.randomUUID().replace(/-/g, "");
    const secMsGec = generateSecMsGecV2();
    const muid = crypto.randomBytes(16).toString("hex").toUpperCase();
    const url = `${WSS_URL}&ConnectionId=${connectionId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

    const ws = new WebSocket(url, {
      headers: {
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: `muid=${muid};`,
      },
    });

    const audioBuffers: Buffer[] = [];
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch {}
      reject(new Error("Timeout en síntesis Edge-TTS (45s)"));
    }, 45000);

    ws.on("unexpected-response", (_req: any, res: any) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      const status = res?.statusCode;
      const serverDateStr = res?.headers?.date;
      if (status === 403 && serverDateStr) {
        const parsedMs = Date.parse(serverDateStr);
        if (!Number.isNaN(parsedMs)) {
          adjClockSkewSeconds(parsedMs / 1000 - getUnixTimestamp());
          const retryErr: any = new Error(`Unexpected server response: 403 (retrying with adjusted clock skew)`);
          retryErr.isClockSkewRetryable = true;
          reject(retryErr);
          return;
        }
      }
      reject(new Error(`Unexpected server response: ${status || "unknown"}`));
    });

    ws.on("error", (err: any) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      reject(err);
    });

    ws.on("message", (rawData: any, isBinary: boolean) => {
      if (!isBinary) {
        const textData = rawData.toString("utf8");
        if (textData.includes("turn.end")) {
          clearTimeout(timeout);
          if (settled) return;
          settled = true;
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
