import axios from "axios";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { config } from "../../config/config.js";
import { getFfmpegBinary } from "./videoAssembler.js";
import { slideRenderer } from "./slideRenderer.js";
import { ProductBrand, visualAssetSelector } from "./visualAssetSelector.js";

export interface ImageResult {
  filePath: string;
  provider: "pollinations_flux" | "pollinations_turbo" | "corporate_slide_canvas" | "local_ffmpeg_card";
  isLocalFallback?: boolean;
  product?: ProductBrand;
  category?: string;
  sourceAssetPath?: string;
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
  product?: ProductBrand;
  category?: string;
  backgroundImagePath?: string | null;
  usedImages?: string[];
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
 * Genera una diapositiva cinematográfica corporativa premium con Canvas.
 * Si se pasa una imagen de fondo (de la suite de 300 o generada por IA), la dibuja en 16:9 con franja inferior.
 */
export async function generateLocalSceneCard(
  outputPath: string,
  width: number = 1280,
  height: number = 720,
  sceneIndex: number = 1,
  sceneTitle: string = "Silvania Scene",
  onScreenText?: string,
  totalScenes: number = 3,
  subtitle?: string,
  product?: ProductBrand,
  category?: string,
  backgroundImagePath?: string | null
): Promise<ImageResult> {
  const chosenProduct = product || visualAssetSelector.detectProduct(`${sceneTitle} ${onScreenText || ""}`);
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
      product: chosenProduct,
      category,
      backgroundImagePath,
    });
    return {
      filePath: slideRes.filePath,
      provider: "corporate_slide_canvas",
      isLocalFallback: !slideRes.hasBackgroundImage,
      product: chosenProduct,
      category,
      sourceAssetPath: backgroundImagePath || undefined,
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
      product: chosenProduct,
      category,
    };
  }
}

export const imageGenerator = {
  /**
   * Genera una imagen cinematográfica optimizada para vídeo comercial.
   * Cadena de resolución inteligente:
   * 1. Consulta la suite visual de 300 imágenes locales organizadas por producto (CoreAgent / Eva / Marketing).
   * 2. Si hay imagen en la biblioteca, la utiliza como fondo cinematográfico + franja de texto de alta definición.
   * 3. Si no hay imagen local y la red está disponible, solicita a IA con el prompt del catálogo comercial.
   * 4. Si la IA responde, la compone cinematográficamente con franja de texto.
   * 5. En caso de fallo de red (ej. HTTP 402), genera la diapositiva vectorial con aislamiento estricto de marca.
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

    // 1. Detección estricta de agente y selección de activo visual
    const selectedVisual = visualAssetSelector.selectAssetForScene({
      product: options.product,
      topic: prompt,
      sceneText: options.onScreenText || sceneTitle,
      sceneIndex,
      totalScenes,
      usedImages: options.usedImages,
    });

    const activeProduct = selectedVisual.product;
    const activeCategory = selectedVisual.category;

    // 2. ¿Existe ya una imagen fotográfica en la suite local de 300?
    const libraryImagePath = options.backgroundImagePath || selectedVisual.localImagePath;
    if (libraryImagePath && fs.existsSync(libraryImagePath)) {
      console.log(
        `📸 [ImageGenerator] Usando imagen fotográfica de la suite comercial: [${activeProduct.toUpperCase()}/${activeCategory}] -> ${libraryImagePath}`
      );
      return generateLocalSceneCard(
        outputPath,
        width,
        height,
        sceneIndex,
        sceneTitle,
        options.onScreenText,
        totalScenes,
        options.subtitle,
        activeProduct,
        activeCategory,
        libraryImagePath
      );
    }

    // 3. Si se fuerza explícitamente modo solo diapositiva sin intentar red
    if (options.preferCorporateSlides) {
      console.log(`🎨 [ImageGenerator] Generando slide corporativo vectorial: Escena ${sceneIndex}/${totalScenes}...`);
      return generateLocalSceneCard(
        outputPath,
        width,
        height,
        sceneIndex,
        sceneTitle,
        options.onScreenText,
        totalScenes,
        options.subtitle,
        activeProduct,
        activeCategory,
        null
      );
    }

    // 4. Si el circuit breaker de 402 está activo, pasar al motor nativo garantizando aislamiento de marca
    if (is402CircuitBreakerActive()) {
      console.log(`⚠️ [ImageGenerator] Circuit breaker activo (HTTP 402 previo). Omitiendo Pollinations y usando slide nativo.`);
      return generateLocalSceneCard(
        outputPath,
        width,
        height,
        sceneIndex,
        sceneTitle,
        options.onScreenText,
        totalScenes,
        options.subtitle,
        activeProduct,
        activeCategory,
        null
      );
    }

    // 5. Generación por IA usando el prompt del catálogo comercial de 300
    const rawAiPrompt = selectedVisual.catalogPrompt || prompt;
    const encodedPrompt = encodeURIComponent(rawAiPrompt);
    console.log(`🎨 [ImageGenerator] Solicitando imagen por IA (${activeProduct}/${activeCategory}): "${rawAiPrompt.slice(0, 50)}..."`);

    let lastError: any = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const modelParam = options.model ? `&model=${options.model}` : "";
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}${modelParam}&seed=${seed}&nologo=true`;

      try {
        const response = await axios.get(imageUrl, {
          responseType: "arraybuffer",
          timeout: 20000,
          headers: {
            "User-Agent": "SilvaniaMarketingStudio/1.2",
          },
        });

        if (response.data && response.data.byteLength > 1000) {
          const rawAiPath = path.join(tempDir, `raw_ai_${Date.now()}_${seed}.jpg`);
          fs.writeFileSync(rawAiPath, Buffer.from(response.data));
          consecutive402Errors = 0;

          // ¡CLAVE! Componer la imagen generada por IA en la diapositiva con franja cinematográfica
          console.log(`✅ [ImageGenerator] Imagen de IA recibida. Componiendo diapositiva cinematográfica...`);
          return generateLocalSceneCard(
            outputPath,
            width,
            height,
            sceneIndex,
            sceneTitle,
            options.onScreenText,
            totalScenes,
            options.subtitle,
            activeProduct,
            activeCategory,
            rawAiPath
          );
        }
      } catch (err: any) {
        lastError = err;
        const statusCode = err.response?.status;
        if (statusCode === 402) {
          consecutive402Errors++;
          last402Timestamp = Date.now();
          console.warn(`⛔ [ImageGenerator] HTTP 402 Payment Required en Pollinations. Contador = ${consecutive402Errors}`);
          if (consecutive402Errors >= 2) {
            break;
          }
        } else {
          console.warn(`⚠️ [ImageGenerator] Intento ${attempt} (${options.model || "default"}) falló (${err.message})...`);
        }

        if (attempt < 2 && consecutive402Errors < 2) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    // 6. Respaldo obligatorio en caso de fallo de red (usa imagen de catálogo local si existe)
    if (allowFallback) {
      const fallbackBg =
        selectedVisual.localImagePath && fs.existsSync(selectedVisual.localImagePath)
          ? selectedVisual.localImagePath
          : null;
      console.warn(
        `⚠️ [ImageGenerator] Red no disponible (${lastError?.message}). Activando diapositiva con respaldo local: ${fallbackBg || "Vectorial"}`
      );
      return generateLocalSceneCard(
        outputPath,
        width,
        height,
        sceneIndex,
        sceneTitle,
        options.onScreenText,
        totalScenes,
        options.subtitle,
        activeProduct,
        activeCategory,
        fallbackBg
      );
    }

    throw new Error(`Fallo en la generación de imagen tras reintentos: ${lastError?.message || "Error desconocido"}`);
  },
};
