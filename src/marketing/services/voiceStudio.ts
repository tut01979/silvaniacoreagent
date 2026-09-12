import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { config } from "../../config/config.js";
import { saveEdgeTts } from "./edgeTtsHelper.js";
import { voiceService } from "../../services/voice.js";

const execAsync = promisify(exec);

export interface VoiceResult {
  audioPath: string;
  provider: "edge" | "elevenlabs" | "polly" | "google";
}

export const voiceStudio = {
  /**
   * Genera el audio para un contenido de marketing con política estricta low-cost:
   * Prioridad 1: Edge-TTS (calidad neural gratuita, sin coste de API).
   * Fallback o Premium: Solo si MARKETING_PREMIUM_VOICE=true o si Edge falla, usa el servicio de respaldo.
   */
  async generateNarration(
    text: string,
    userId: number,
    options: { title?: string; forcePremium?: boolean } = {}
  ): Promise<VoiceResult> {
    const tempDir = config.tempDir || "./temp";
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const usePremium = options.forcePremium || config.marketing?.premiumVoice === true;
    const edgeVoice = "es-ES-AlvaroNeural";

    // --- CAMINO 1 (Prioritario por defecto): Edge-TTS Neural (GRATIS) ---
    if (!usePremium) {
      const edgeFileName = `mkt_edge_${userId}_${Date.now()}.mp3`;
      const edgeFilePath = path.join(tempDir, edgeFileName);

      try {
        console.log(`🎙️ VoiceStudio [Low-Cost]: Generando locución con Edge-TTS (${edgeVoice})...`);
        await saveEdgeTts(text, edgeFilePath, { voice: edgeVoice, rate: "+2%" });

        if (fs.existsSync(edgeFilePath) && fs.statSync(edgeFilePath).size > 1000) {
          console.log(`✅ VoiceStudio: Locución Edge-TTS completada con éxito (${fs.statSync(edgeFilePath).size} bytes).`);
          return {
            audioPath: edgeFilePath,
            provider: "edge",
          };
        }
      } catch (edgeErr: any) {
        console.warn(`⚠️ VoiceStudio: Edge-TTS falló (${edgeErr.message}). Activando fallback en cadena...`);
      }
    }

    // --- CAMINO 2: Google TTS gratuito (100% libre, sin coste de API) ---
    if (!usePremium) {
      try {
        console.log(`🎙️ VoiceStudio [Low-Cost Respaldo Gratuito]: Probando Google TTS (0€)...`);
        const googleTTS = await import("google-tts-api");
        const audioData = await (googleTTS as any).getAllAudioBase64(text.slice(0, 1000), {
          lang: "es",
          slow: false,
          host: "https://translate.google.com",
          timeout: 10000,
        });

        let completeAudio = Buffer.alloc(0);
        for (const piece of audioData) {
          completeAudio = Buffer.concat([completeAudio, Buffer.from(piece.base64, "base64")]);
        }

        const googleFilePath = path.join(tempDir, `mkt_google_${userId}_${Date.now()}.mp3`);
        fs.writeFileSync(googleFilePath, completeAudio);

        if (fs.existsSync(googleFilePath) && fs.statSync(googleFilePath).size > 500) {
          console.log(`✅ VoiceStudio: Locución Google TTS completada con éxito (${fs.statSync(googleFilePath).size} bytes).`);
          return {
            audioPath: googleFilePath,
            provider: "google",
          };
        }
      } catch (googleErr: any) {
        console.warn(`⚠️ VoiceStudio: Google TTS libre falló (${googleErr.message}). Pasando a voiceService...`);
      }
    }

    // --- CAMINO 3: Fallback controlado a voiceService existente (Polly / ElevenLabs) ---
    console.log(`🎙️ VoiceStudio: Usando motor secundario de voiceService...`);
    const audioParts = await voiceService.textToSpeech(text, userId);

    if (!audioParts || audioParts.length === 0) {
      throw new Error("No se pudo generar el audio para el contenido en ningún proveedor de voz.");
    }

    let finalPath = audioParts[0];

    // Si hay más de una parte, concatenamos con FFmpeg
    if (audioParts.length > 1) {
      const masterFileName = `mkt_master_${userId}_${Date.now()}.mp3`;
      const masterFilePath = path.join(tempDir, masterFileName);
      const concatListPath = path.join(tempDir, `concat_${Date.now()}.txt`);
      const fileLines = audioParts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n");
      fs.writeFileSync(concatListPath, fileLines, "utf-8");

      try {
        await execAsync(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${masterFilePath}"`);
        try { fs.unlinkSync(concatListPath); } catch {}
        finalPath = masterFilePath;
      } catch (err: any) {
        try { fs.unlinkSync(concatListPath); } catch {}
      }
    }

    const providerName: "elevenlabs" | "polly" | "google" = usePremium && config.voice.elevenLabsKey
      ? "elevenlabs"
      : config.voice.awsAccessKey
      ? "polly"
      : "google";

    return {
      audioPath: finalPath,
      provider: providerName,
    };
  },
};
