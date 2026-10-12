import { exec, execSync } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { config } from "../../config/config.js";

import ffmpegStatic from "ffmpeg-static";

const execAsync = promisify(exec);

export interface SceneMediaInput {
  sceneNumber: number;
  narrationText: string;
  imagePath: string;
  durationSeconds?: number;
}

export interface VideoAssembleOptions {
  width?: number; // 1280 por defecto (o 720 para vertical 9:16)
  height?: number; // 720 por defecto (o 1280 para vertical 9:16)
  fps?: number; // 24 fps
  timeoutMs?: number; // 120 segundos
}

export interface VideoAssembleResult {
  videoPath: string;
  durationSeconds: number;
  sceneCount: number;
  distinctImageCount: number;
  fileSizeBytes: number;
  width: number;
  height: number;
  providerNotes: string;
}

/**
 * Localiza la ruta del ejecutable FFmpeg en el entorno.
 * Prioridad:
 * 1. FFMPEG_PATH en variables de entorno.
 * 2. Paquete npm 'ffmpeg-static'.
 * 3. 'ffmpeg' en el PATH del sistema.
 */
export function getFfmpegBinary(): string {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  try {
    const staticPath = typeof ffmpegStatic === "string" ? ffmpegStatic : (ffmpegStatic as any)?.default;
    if (staticPath && typeof staticPath === "string" && fs.existsSync(staticPath)) {
      return staticPath;
    }
  } catch {}

  // Comprobar binario en PATH global del sistema
  try {
    const isWin = process.platform === "win32";
    const checkCmd = isWin ? "where ffmpeg" : "which ffmpeg";
    const out = execSync(checkCmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    const firstLine = out.split(/[\r\n]+/)[0]?.trim();
    if (firstLine && fs.existsSync(firstLine)) {
      return firstLine;
    }
    return "ffmpeg";
  } catch {
    throw new Error(
      "❌ FFmpeg no encontrado en el sistema. Asegúrate de tener ffmpeg instalado en el PATH o el paquete ffmpeg-static disponible."
    );
  }
}

/**
 * Obtiene la duración exacta en segundos de un archivo de audio usando FFmpeg.
 */
export async function getAudioDuration(audioPath: string, ffmpegBin: string): Promise<number> {
  try {
    await execAsync(`"${ffmpegBin}" -i "${audioPath}"`);
  } catch (err: any) {
    const output = String(err.stderr || err.stdout || err.message || "");
    const match = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseFloat(match[3]);
      return hours * 3600 + minutes * 60 + seconds;
    }
  }

  // Fallback heurístico si no se pudo leer el header (128kbps MP3 ~ 16KB/s)
  try {
    const stats = fs.statSync(audioPath);
    return Math.max(3, Math.round(stats.size / 16000));
  } catch {
    return 30; // 30s por defecto
  }
}

export const videoAssembler = {
  /**
   * Ensambla escenas visuales (imágenes) y una pista de locución en un archivo MP4 real.
   * Totalmente compatible con Telegram, YouTube y navegadores móviles (H.264 + AAC, faststart).
   */
  async assembleVideo(
    scenes: SceneMediaInput[],
    audioPath: string,
    outputFilename: string,
    options: VideoAssembleOptions = {}
  ): Promise<VideoAssembleResult> {
    if (!scenes || scenes.length === 0) {
      throw new Error("No hay escenas con imágenes disponibles para ensamblar el vídeo.");
    }
    if (!fs.existsSync(audioPath)) {
      throw new Error(`El archivo de audio no existe en la ruta: ${audioPath}`);
    }

    const distinctImages = new Set(scenes.map(s => path.resolve(s.imagePath)));
    if (scenes.length > 1 && distinctImages.size <= 1) {
      throw new Error(`Error de ensamblado: Se recibieron ${scenes.length} escenas pero solo 1 imagen distinta (${Array.from(distinctImages)[0]}). Se requieren imágenes distintas por escena.`);
    }

    const ffmpegBin = getFfmpegBinary();
    const width = options.width || 1280;
    const height = options.height || 720;
    const fps = options.fps || 24;
    const timeoutMs = options.timeoutMs || 120000;

    const tempDir = config.tempDir || "./temp";
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const outputPath = path.resolve(tempDir, outputFilename);
    const concatListPath = path.resolve(tempDir, `concat_${Date.now()}_${Math.random().toString(36).substring(7)}.txt`);

    // 1. Calcular duración total real del audio (con ffprobe / ffmpeg)
    const totalAudioDuration = await getAudioDuration(audioPath, ffmpegBin);
    console.log(`🎬 VideoAssembler: Audio detectado con duración real de ${totalAudioDuration.toFixed(2)}s (ffprobe) para ${scenes.length} escenas (${distinctImages.size} imágenes distintas).`);

    // 2. Distribuir la duración entre las escenas proporcionalmente a la duración del audio real
    const textLengths = scenes.map(s => Math.max(15, (s.narrationText || "").trim().length));
    const totalLength = textLengths.reduce((acc, len) => acc + len, 0);

    let concatFileContent = "";
    const allocatedDurations: number[] = [];
    let elapsed = 0;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      let sceneDur: number;

      if (i === scenes.length - 1) {
        // La última escena absorbe el tiempo restante para coincidir exactamente con el audio real
        sceneDur = Math.max(1.0, parseFloat((totalAudioDuration - elapsed).toFixed(2)));
      } else {
        const weight = textLengths[i] / totalLength;
        sceneDur = Math.max(1.5, parseFloat((weight * totalAudioDuration).toFixed(2)));
        elapsed += sceneDur;
      }

      allocatedDurations.push(sceneDur);

      // Usar barras inclinadas normales para compatibilidad en concat demuxer en Windows y Linux
      const normalizedImgPath = path.resolve(scene.imagePath).replace(/\\/g, "/");
      concatFileContent += `file '${normalizedImgPath}'\n`;
      concatFileContent += `duration ${sceneDur}\n`;
    }

    // Repetir la última imagen sin duración para evitar que el demuxer corte el último frame antes de tiempo
    if (scenes.length > 0) {
      const lastImgPath = path.resolve(scenes[scenes.length - 1].imagePath).replace(/\\/g, "/");
      concatFileContent += `file '${lastImgPath}'\n`;
    }

    fs.writeFileSync(concatListPath, concatFileContent, "utf8");

    // Loggear detalladamente cada entrada del demuxer para verificación
    console.log(`📄 [VideoAssembler] Concat demuxer (${scenes.length} entradas, audio real = ${totalAudioDuration.toFixed(2)}s, ${distinctImages.size} imágenes distintas):\n` +
      scenes.map((s, idx) => `  [Escena ${idx + 1}/${scenes.length}] ${allocatedDurations[idx]}s -> ${path.resolve(s.imagePath).replace(/\\/g, "/")}`).join("\n")
    );

    // 3. Ejecutar comando FFmpeg con escala, centrado y codificación estándar con framerate fijo a 24fps
    // -vf fps=24: garantiza que se generen frames continuos para evitar stills congelados en reproductores móviles/Telegram
    const vf = `fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;
    const ffmpegCmd = `"${ffmpegBin}" -y -f concat -safe 0 -i "${concatListPath}" -i "${audioPath}" -vf "${vf}" -r ${fps} -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest -movflags +faststart "${outputPath}"`;

    console.log(`🎬 VideoAssembler: Renderizando MP4 (${width}x${height} @ ${fps}fps) con FFmpeg...`);

    try {
      await execAsync(ffmpegCmd, {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      });

      // Limpiar archivo intermedio de lista
      try {
        if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
      } catch {}

      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000) {
        throw new Error("El archivo MP4 generado está vacío o no se creó correctamente.");
      }

      const fileStats = fs.statSync(outputPath);
      console.log(`✅ VideoAssembler: Vídeo MP4 generado con éxito (${fileStats.size} bytes, ${totalAudioDuration.toFixed(1)}s, ${distinctImages.size} imágenes distintas) en ${outputPath}`);

      return {
        videoPath: outputPath,
        durationSeconds: totalAudioDuration,
        sceneCount: scenes.length,
        distinctImageCount: distinctImages.size,
        fileSizeBytes: fileStats.size,
        width,
        height,
        providerNotes: `FFmpeg H.264/AAC @ ${fps}fps + Concat Demuxer (${distinctImages.size} imágenes distintas)`,
      };
    } catch (err: any) {
      // Limpiar archivo intermedio en caso de fallo
      try {
        if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
      } catch {}
      console.error("❌ VideoAssembler: Error en renderizado FFmpeg:", err.message);
      throw new Error(`Fallo en el renderizado del vídeo con FFmpeg: ${err.message}`);
    }
  },
};
