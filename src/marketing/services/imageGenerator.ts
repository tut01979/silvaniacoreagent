import axios from "axios";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { config } from "../../config/config.js";
import { getFfmpegBinary } from "./videoAssembler.js";

export interface ImageResult {
  filePath: string;
  provider: "pollinations_flux" | "pollinations_turbo" | "local_ffmpeg_card";
  isLocalFallback?: boolean;
}

export interface GenerateImageOptions {
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
  sceneIndex?: number;
  sceneTitle?: string;
  allowFallback?: boolean;
}

// Circuit breaker para evitar spamear Pollinations tras recibir errores 402 consecutivos
let consecutive402Errors = 0;
let last402Timestamp = 0;

export function reset402CircuitBreaker(): void {
  consecutive402Errors = 0;
  last402Timestamp = 0;
}

export function is402CircuitBreakerActive(): boolean {
  return consecutive402Errors >= 2 && Date.now() - last402Timestamp < 10 * 60 * 1000;
}

/**
 * Genera una tarjeta de escena visual con FFmpeg (fallback local obligatorio).
 * NUNCA devuelve 402, siempre produce un archivo en disco con color distintivo por índice y texto.
 */
export function generateLocalSceneCard(
  outputPath: string,
  width: number = 1280,
  height: number = 720,
  sceneIndex: number = 1,
  sceneTitle: string = "Silvania Scene"
): ImageResult {
  const PALETTES = [
    { bg: "0x0F172A", text: "white", badge: "0x38BDF8" }, // Deep Slate / Sky
    { bg: "0x1E1B4B", text: "white", badge: "0x818CF8" }, // Indigo / Violet
    { bg: "0x064E3B", text: "white", badge: "0x34D399" }, // Emerald / Mint
    { bg: "0x164E63", text: "white", badge: "0x22D3EE" }, // Cyan / Ice
    { bg: "0x4C0519", text: "white", badge: "0xFB7185" }, // Rose / Crimson
    { bg: "0x312E81", text: "white", badge: "0xA78BFA" }, // Purple / Iris
    { bg: "0x14532D", text: "white", badge: "0x4ADE80" }, // Forest / Lime
    { bg: "0x1E293B", text: "white", badge: "0xFBBF24" }, // Slate / Amber
  ];

  const palette = PALETTES[(Math.max(1, sceneIndex) - 1) % PALETTES.length];
  const safeTitle = (sceneTitle || `Escena ${sceneIndex}`)
    .replace(/['"\\]/g, "")
    .replace(/[:]/g, " - ")
    .replace(/[\r\n\t]/g, " ")
    .slice(0, 60)
    .trim();
  const badgeText = `ESCENA ${sceneIndex}`;

  const ffmpegBin = getFfmpegBinary();

  try {
    const vf = `drawtext=text='${badgeText}':fontcolor=${palette.badge}:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2-50,drawtext=text='${safeTitle}':fontcolor=${palette.text}:fontsize=36:x=(w-text_w)/2:y=(h-text_h)/2+20`;
    execSync(`"${ffmpegBin}" -y -f lavfi -i color=c=${palette.bg}:s=${width}x${height}:d=1 -vf "${vf}" -frames:v 1 "${outputPath}"`, {
      stdio: "pipe",
    });
  } catch (err: any) {
    // Si drawtext falla por caracteres especiales, fallback a color sólido limpio
    console.warn("⚠️ [ImageGenerator] drawtext falló, usando fondo sólido:", err.message);
    execSync(`"${ffmpegBin}" -y -f lavfi -i color=c=${palette.bg}:s=${width}x${height}:d=1 -frames:v 1 "${outputPath}"`, {
      stdio: "pipe",
    });
  }

  console.log(`🛡️ [ImageGenerator] Fallback local FFmpeg generado: Escena ${sceneIndex} -> ${outputPath} (${palette.bg})`);
  return {
    filePath: outputPath,
    provider: "local_ffmpeg_card",
    isLocalFallback: true,
  };
}

export const imageGenerator = {
  /**
   * Genera una imagen optimizada para visualización en móvil (Telegram, LinkedIn, YouTube)
   * Cadena de providers: flux -> turbo -> fallback local FFmpeg OBLIGATORIO.
   */
  async generateImage(
    prompt: string,
    options: GenerateImageOptions = {}
  ): Promise<ImageResult> {
    const width = options.width || 1280;
    const height = options.height || 720;
    const seed = options.seed || Math.floor(Math.random() * 1000000);
    const sceneIndex = options.sceneIndex || 1;
    const sceneTitle = options.sceneTitle || prompt.slice(0, 50);
    const allowFallback = options.allowFallback !== false;

    const tempDir = config.tempDir || "./temp";
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `mkt_img_${Date.now()}_${seed}.jpg`;
    const outputPath = path.join(tempDir, fileName);

    // Si el circuit breaker de 402 está activo, pasar directamente al fallback local
    if (is402CircuitBreakerActive()) {
      console.log(`⚠️ [ImageGenerator] Circuit breaker activo (2x HTTP 402 previos). Omitiendo Pollinations y usando fallback local directo.`);
      return generateLocalSceneCard(outputPath, width, height, sceneIndex, sceneTitle);
    }

    // Ajuste del prompt para composición limpia
    const mobileOptimizedPrompt = `${prompt.trim()}, high contrast, vivid clean lighting, central composition optimized for mobile screens, no text overlay, 8k resolution cinematic photograph`;
    const encodedPrompt = encodeURIComponent(mobileOptimizedPrompt);

    console.log(`🎨 ImageGenerator: Solicitando imagen ("${prompt.slice(0, 45)}...")...`);

    let lastError: any = null;

    // Intentamos con reintento (intento 1: flux o modelo preferido, intento 2: turbo)
    for (let attempt = 1; attempt <= 2; attempt++) {
      const modelToUse = attempt === 1 ? (options.model || "flux") : "turbo";
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${modelToUse}&seed=${seed}&nologo=true`;

      try {
        const response = await axios.get(imageUrl, {
          responseType: "arraybuffer",
          timeout: 20000,
          headers: {
            "User-Agent": "SilvaniaMarketingStudio/1.2",
          },
        });

        if (response.data && response.data.byteLength > 1000) {
          fs.writeFileSync(outputPath, Buffer.from(response.data));
          const provider = modelToUse === "turbo" ? "pollinations_turbo" : "pollinations_flux";
          console.log(`✅ ImageGenerator: Imagen de red guardada (${provider}) en ${outputPath} (${response.data.byteLength} bytes)`);
          // Si tiene éxito, reiniciamos el contador de 402 consecutivos
          consecutive402Errors = 0;
          return {
            filePath: outputPath,
            provider,
            isLocalFallback: false,
          };
        }
      } catch (err: any) {
        lastError = err;
        const statusCode = err.response?.status;
        if (statusCode === 402) {
          consecutive402Errors++;
          last402Timestamp = Date.now();
          console.warn(`⛔ [ImageGenerator] HTTP 402 Payment Required en Pollinations (${modelToUse}). Contador 402 = ${consecutive402Errors}`);
          // Si recibimos 402 y ya van 2, rompemos el ciclo inmediatamente para no saturar
          if (consecutive402Errors >= 2) {
            break;
          }
        } else {
          console.warn(`⚠️ [ImageGenerator] Intento ${attempt} (${modelToUse}) falló (${err.message})...`);
        }

        if (attempt < 2 && consecutive402Errors < 2) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    // Si falló la red y el fallback está permitido, NUNCA romper: generar slide local con FFmpeg
    if (allowFallback) {
      console.warn(`⚠️ [ImageGenerator] Red no disponible (${lastError?.message}). Activando fallback local FFmpeg obligatorio.`);
      return generateLocalSceneCard(outputPath, width, height, sceneIndex, sceneTitle);
    }

    throw new Error(`Fallo en la generación de imagen tras reintentos: ${lastError?.message || "Error desconocido"}`);
  },
};
