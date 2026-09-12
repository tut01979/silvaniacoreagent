import axios from "axios";
import fs from "fs";
import path from "path";
import { config } from "../../config/config.js";

export interface ImageResult {
  filePath: string;
  provider: "pollinations_flux" | "fallback";
}

export const imageGenerator = {
  /**
   * Genera una imagen optimizada para visualización en móvil (Telegram, LinkedIn, YouTube)
   * usando FLUX.1 de forma 100% gratuita y sin consumo de saldo de API.
   */
  async generateImage(
    prompt: string,
    options: { width?: number; height?: number; seed?: number } = {}
  ): Promise<ImageResult> {
    const width = options.width || 1280;
    const height = options.height || 720;
    const seed = options.seed || Math.floor(Math.random() * 1000000);

    const tempDir = config.tempDir || "./temp";
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `mkt_img_${Date.now()}_${seed}.jpg`;
    const outputPath = path.join(tempDir, fileName);

    // Ajuste del prompt para máxima claridad en pantallas móviles:
    // Alto contraste, sin tipografías ilegibles en la imagen, composición focalizada.
    const mobileOptimizedPrompt = `${prompt.trim()}, high contrast, vivid clean lighting, central composition optimized for mobile screens, no text overlay, 8k resolution cinematic photograph`;
    const encodedPrompt = encodeURIComponent(mobileOptimizedPrompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=flux&seed=${seed}&nologo=true`;

    console.log(`🎨 ImageGenerator [Low-Cost Free FLUX]: "${prompt.slice(0, 50)}..."`);

    let lastError: any = null;

    // Intentamos con reintento corto (2 intentos máximo)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await axios.get(imageUrl, {
          responseType: "arraybuffer",
          timeout: 30000,
          headers: {
            "User-Agent": "SilvaniaMarketingStudio/1.1",
          },
        });

        if (response.data && response.data.byteLength > 1000) {
          fs.writeFileSync(outputPath, Buffer.from(response.data));
          console.log(`✅ ImageGenerator: Imagen guardada en ${outputPath} (${response.data.byteLength} bytes)`);
          return {
            filePath: outputPath,
            provider: "pollinations_flux",
          };
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`⚠️ ImageGenerator: Intento ${attempt} falló (${err.message})...`);
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    throw new Error(`Fallo en la generación de imagen tras reintentos: ${lastError?.message || "Error desconocido"}`);
  },
};
