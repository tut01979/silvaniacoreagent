import axios from "axios";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { config } from "../../config/config.js";
import { getFfmpegBinary } from "./videoAssembler.js";
import { slideRenderer } from "./slideRenderer.js";

export interface ImageResult {
  filePath: string;
  provider: "pollinations_flux" | "pollinations_turbo" | "corporate_slide_canvas" | "local_ffmpeg_card";
  isLocalFallback?: boolean;
}

export interface GenerateImageOptions {
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
  sceneIndex?: number;
  totalScenes?: number;
  sceneTitle?: string;
  onScreenText?: string;
  subtitle?: string;
  allowFallback?: boolean;
  preferCorporateSlides?: boolean;
}

// Circuit breaker para evitar saturar Pollinations tras recibir errores 402 consecutivos
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
 * Genera una tarjeta de escena corporativa premium con Canvas.
 * NUNCA devuelve 402, siempre produce un archivo en disco de 1280x720 de alta definición en milisegundos.
 */
export async function generateLocalSceneCard(
  outputPath: string,
  width: number = 1280,
  height: number = 720,
  sceneIndex: number = 1,
  sceneTitle: string = "Silvania Scene",
  onScreenText?: string,
  totalScenes: number = 3,
  subtitle?: string
): Promise<ImageResult> {
  try {
    const slideRes = await slideRenderer.renderSceneSlide({
      sceneIndex,
      totalScenes,
      title: sceneTitle,
      subtitle,
      onScreenText,
      width,
      height,
      outputPath,
    });
    return {
      filePath: slideRes.filePath,
      provider: "corporate_slide_canvas",
      isLocalFallback: true,
    };
  } catch (canvasErr: any) {
    console.warn("⚠️ [ImageGenerator] Canvas slide falló, usando respaldo básico:", canvasErr.message);
    const ffmpegBin = getFfmpegBinary();
    execSync(`"${ffmpegBin}" -y -f lavfi -i color=c=0x0F172A:s=${width}x${height}:d=1 -frames:v 1 "${outputPath}"`, {
      stdio: "pipe",
    });
    return {
      filePath: outputPath,
      provider: "local_ffmpeg_card",
      isLocalFallback: true,
    };
  }
}

export const imageGenerator = {
  /**
   * Genera una imagen optimizada para visualización en móvil y vídeo.
   * Por defecto: Motor de slides corporativos fiables si se especifica preferCorporateSlides.
   * Cadena de providers: slides/flux -> turbo -> fallback corporativo obligatorio.
   */
  async generateImage(
    prompt: string,
    options: GenerateImageOptions = {}
  ): Promise<ImageResult> {
    const width = options.width || 1280;
    const height = options.height || 720;
    const seed = options.seed || Math.floor(Math.random() * 1000000);
    const sceneIndex = options.sceneIndex || 1;
    const totalScenes = options.totalScenes || 3;
    const sceneTitle = options.sceneTitle || prompt.slice(0, 50);
    const allowFallback = options.allowFallback !== false;

    const tempDir = config.tempDir || "./temp";
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `mkt_img_${Date.now()}_${seed}.jpg`;
    const outputPath = path.join(tempDir, fileName);

    // Si se prefiere el motor corporativo (Sprint 1 por defecto para vídeos fiables)
    if (options.preferCorporateSlides) {
      console.log(`🎨 [ImageGenerator] Generando slide corporativo nativo: Escena ${sceneIndex}/${totalScenes}...`);
      return generateLocalSceneCard(outputPath, width, height, sceneIndex, sceneTitle, options.onScreenText, totalScenes, options.subtitle);
    }

    // Si el circuit breaker de 402 está activo, pasar directamente al motor corporativo
    if (is402CircuitBreakerActive()) {
      console.log(`⚠️ [ImageGenerator] Circuit breaker activo (2x HTTP 402 previos). Omitiendo Pollinations y usando slide corporativo directo.`);
      return generateLocalSceneCard(outputPath, width, height, sceneIndex, sceneTitle, options.onScreenText, totalScenes, options.subtitle);
    }

    // Ajuste del prompt maestro de marca corporativa para Silvania AI
    const brandPrompt = `Executive SaaS productivity illustration for Silvania AI, minimal Google Workspace and Telegram business environment, modern dark blue aesthetic, cinematic lighting, 8k resolution, no text`;
    const mobileOptimizedPrompt = `${brandPrompt}, ${prompt.trim()}`;
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

    // Si falló la red y el fallback está permitido, generar slide corporativo premium
    if (allowFallback) {
      console.warn(`⚠️ [ImageGenerator] Red no disponible (${lastError?.message}). Activando slide corporativo nativo obligatorio.`);
      return generateLocalSceneCard(outputPath, width, height, sceneIndex, sceneTitle, options.onScreenText, totalScenes);
    }

    throw new Error(`Fallo en la generación de imagen tras reintentos: ${lastError?.message || "Error desconocido"}`);
  },
};
