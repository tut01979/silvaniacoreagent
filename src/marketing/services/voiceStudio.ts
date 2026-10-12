import fs from "fs";
import path from "path";
import { exec, execSync } from "child_process";
import { promisify } from "util";
import { config } from "../../config/config.js";
import { saveEdgeTts } from "./edgeTtsHelper.js";
import { voiceService } from "../../services/voice.js";
import { getFfmpegBinary, getAudioDuration } from "./videoAssembler.js";

const execAsync = promisify(exec);

export interface VoiceResult {
  audioPath: string;
  provider: "edge" | "elevenlabs" | "polly" | "google";
}

export interface PacedSceneItem {
  sceneNumber: number;
  narration: string;
}

export interface PacedVoiceResult {
  audioPath: string;
  provider: "edge" | "elevenlabs" | "polly" | "google";
  totalDurationSeconds: number;
  sceneDurations: number[];
}

/**
 * Normaliza el texto para el oído humano evitando que el sintetizador lea URLs, arrobas o símbolos raros.
 */
export function normalizeSpokenText(text: string): string {
  return text
    .replace(/silvania\.ai/gi, "Silvania punto a-i")
    .replace(/https?:\/\/[^\s]+/gi, "Silvania")
    .replace(/@([a-zA-Z0-9_]+)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Genera o reutiliza un micro-archivo de silencio en MP3 (ej. 350ms) usando FFmpeg.
 */
function getSilenceFile(tempDir: string, durationSeconds: number = 0.35): string {
  const silencePath = path.join(tempDir, `silence_${Math.round(durationSeconds * 1000)}ms.mp3`);
  if (!fs.existsSync(silencePath)) {
    const ffmpegBin = getFfmpegBinary();
    execSync(`"${ffmpegBin}" -y -f lavfi -i anullsrc=r=44100:cl=mono -t ${durationSeconds} -q:a 9 "${silencePath}"`, {
      stdio: "pipe",
    });
  }
  return silencePath;
}

export const voiceStudio = {
  /**
   * Genera el audio para un contenido de marketing con política estricta low-cost (Google TTS primario gratuito):
   */
  async generateNarration(
    text: string,
    userId: number,
    options: { title?: string; forcePremium?: boolean; applyTempo?: boolean } = {}
  ): Promise<VoiceResult> {
    const tempDir = config.tempDir || "./temp";
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const usePremium = options.forcePremium || config.marketing?.premiumVoice === true;
    const spokenText = normalizeSpokenText(text);

    // --- CAMINO 1 (Prioritario Low-Cost): Google TTS (100% libre, sin errores 403 en Railway) ---
    if (!usePremium) {
      try {
        console.log(`🎙️ VoiceStudio [Low-Cost Primario]: Generando locución con Google TTS (0€)...`);
        const googleTTS = await import("google-tts-api");
        const audioData = await (googleTTS as any).getAllAudioBase64(spokenText, {
          lang: "es",
          slow: false,
          host: "https://translate.google.com",
          timeout: 15000,
        });

        let completeAudio = Buffer.alloc(0);
        for (const piece of audioData) {
          completeAudio = Buffer.concat([completeAudio, Buffer.from(piece.base64, "base64")]);
        }

        const rawFilePath = path.join(tempDir, `mkt_google_raw_${userId}_${Date.now()}.mp3`);
        fs.writeFileSync(rawFilePath, completeAudio);

        if (fs.existsSync(rawFilePath) && fs.statSync(rawFilePath).size > 500) {
          // Si se solicita aceleración suave para agilidad de podcast (atempo=1.06)
          let finalGooglePath = rawFilePath;
          if (options.applyTempo !== false) {
            try {
              const tempoPath = path.join(tempDir, `mkt_google_${userId}_${Date.now()}.mp3`);
              const ffmpegBin = getFfmpegBinary();
              execSync(`"${ffmpegBin}" -y -i "${rawFilePath}" -af "atempo=1.06" "${tempoPath}"`, { stdio: "pipe" });
              if (fs.existsSync(tempoPath) && fs.statSync(tempoPath).size > 500) {
                try { fs.unlinkSync(rawFilePath); } catch {}
                finalGooglePath = tempoPath;
              }
            } catch (tempoErr: any) {
              console.warn("⚠️ VoiceStudio: Filtro atempo falló, usando audio estándar:", tempoErr.message);
            }
          }

          console.log(`✅ VoiceStudio: Locución Google TTS completada con éxito (${fs.statSync(finalGooglePath).size} bytes).`);
          return {
            audioPath: finalGooglePath,
            provider: "google",
          };
        }
      } catch (googleErr: any) {
        console.warn(`⚠️ VoiceStudio: Google TTS falló (${googleErr.message}). Probando fallback Edge-TTS...`);
      }

      // --- CAMINO 2 (Respaldo secundario): Edge-TTS Neural ---
      const edgeVoice = "es-ES-AlvaroNeural";
      const edgeFileName = `mkt_edge_${userId}_${Date.now()}.mp3`;
      const edgeFilePath = path.join(tempDir, edgeFileName);

      try {
        console.log(`🎙️ VoiceStudio [Respaldo]: Probando Edge-TTS (${edgeVoice})...`);
        await saveEdgeTts(spokenText, edgeFilePath, { voice: edgeVoice, rate: "+2%" });

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

  /**
   * Genera una locución estructurada escena por escena con pausas naturales de respiración (350ms)
   * y aceleración suave de podcast (atempo=1.06).
   * Devuelve las duraciones matemáticas exactas de cada escena para sincronización perfecta con los slides.
   */
  async generatePacedNarration(
    scenes: PacedSceneItem[],
    hookText: string | undefined,
    userId: number,
    options: { pauseSeconds?: number; tempo?: number } = {}
  ): Promise<PacedVoiceResult> {
    const tempDir = config.tempDir || "./temp";
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const pauseSeconds = options.pauseSeconds ?? 0.35;
    const tempo = options.tempo ?? 1.06;
    const ffmpegBin = getFfmpegBinary();
    const silencePath = getSilenceFile(tempDir, pauseSeconds);

    console.log(`🎙️ [VoiceStudio Paced] Generando locución por escenas con pausas de ${pauseSeconds}s y tempo x${tempo}...`);

    // 1. Construir bloques de locución: Hook incorporado en Escena 1 (o bloque 0 si procede)
    // Para simplificar la sincronización con N escenas visuales, prefijamos el hook a la Escena 1
    const sceneAudioPaths: string[] = [];
    const sceneDurations: number[] = [];

    const googleTTS = await import("google-tts-api");

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      let sceneSpokenText = scene.narration.trim();
      if (i === 0 && hookText && hookText.trim().length > 0) {
        sceneSpokenText = `${hookText.trim()}... ${sceneSpokenText}`;
      }
      const normalized = normalizeSpokenText(sceneSpokenText);

      const rawChunkPath = path.join(tempDir, `mkt_chunk_${userId}_${Date.now()}_sc${scene.sceneNumber || i + 1}.mp3`);
      const tempoChunkPath = path.join(tempDir, `mkt_tempo_${userId}_${Date.now()}_sc${scene.sceneNumber || i + 1}.mp3`);

      // Síntesis de este bloque
      const audioData = await (googleTTS as any).getAllAudioBase64(normalized, {
        lang: "es",
        slow: false,
        host: "https://translate.google.com",
        timeout: 15000,
      });

      let chunkBuffer = Buffer.alloc(0);
      for (const piece of audioData) {
        chunkBuffer = Buffer.concat([chunkBuffer, Buffer.from(piece.base64, "base64")]);
      }
      fs.writeFileSync(rawChunkPath, chunkBuffer);

      // Aplicar filtro de tempo suave
      execSync(`"${ffmpegBin}" -y -i "${rawChunkPath}" -af "atempo=${tempo}" "${tempoChunkPath}"`, { stdio: "pipe" });
      try { fs.unlinkSync(rawChunkPath); } catch {}

      // Medir duración real de la locución de esta escena
      const chunkDur = await getAudioDuration(tempoChunkPath, ffmpegBin);
      sceneAudioPaths.push(tempoChunkPath);

      // La duración de la escena para el visual incluye la locución más la pausa de respiración (salvo la última)
      const allocatedSceneDur = parseFloat((chunkDur + (i < scenes.length - 1 ? pauseSeconds : 0)).toFixed(2));
      sceneDurations.push(allocatedSceneDur);
      console.log(`   - Escena ${i + 1}/${scenes.length}: ${chunkDur.toFixed(2)}s voz + ${i < scenes.length - 1 ? pauseSeconds : 0}s pausa = ${allocatedSceneDur}s`);
    }

    // 2. Concatenar con FFmpeg intercalando silencios
    const masterConcatList = path.join(tempDir, `concat_paced_${Date.now()}.txt`);
    let concatLines = "";

    for (let i = 0; i < sceneAudioPaths.length; i++) {
      concatLines += `file '${path.resolve(sceneAudioPaths[i]).replace(/\\/g, "/")}'\n`;
      if (i < sceneAudioPaths.length - 1) {
        concatLines += `file '${path.resolve(silencePath).replace(/\\/g, "/")}'\n`;
      }
    }
    fs.writeFileSync(masterConcatList, concatLines, "utf-8");

    const masterAudioPath = path.join(tempDir, `mkt_paced_master_${userId}_${Date.now()}.mp3`);
    execSync(`"${ffmpegBin}" -y -f concat -safe 0 -i "${masterConcatList}" -c copy "${masterAudioPath}"`, { stdio: "pipe" });
    try { fs.unlinkSync(masterConcatList); } catch {}

    const totalDurationSeconds = await getAudioDuration(masterAudioPath, ffmpegBin);
    console.log(`✅ [VoiceStudio Paced] Audio maestro concatenado: ${totalDurationSeconds.toFixed(2)}s totales.`);

    return {
      audioPath: masterAudioPath,
      provider: "google",
      totalDurationSeconds,
      sceneDurations,
    };
  },
};
