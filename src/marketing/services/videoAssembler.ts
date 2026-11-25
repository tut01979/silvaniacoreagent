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
  imagePath: string; // Ruta de imagen o clip corto MP4/MOV/WEBM
  mediaType?: "image" | "video";
  durationSeconds?: number;
}

export type VisualStylePreset =
  | "modern_clean"
  | "cinema_warm"
  | "vintage_film"
  | "high_contrast_tech";

export type TransitionStylePreset =
  | "auto"
  | "fade"
  | "dissolve"
  | "wipeleft"
  | "wiperight"
  | "slideleft"
  | "smoothleft"
  | "circleopen"
  | "none";

export interface VideoAssembleOptions {
  width?: number; // 1280 por defecto (o 720 para vertical 9:16)
  height?: number; // 720 por defecto (o 1280 para vertical 9:16)
  fps?: number; // 24 fps
  timeoutMs?: number; // 120 segundos
  musicTrackPath?: string;
  musicVolume?: number; // 0.14 por defecto
  visualStyle?: VisualStylePreset;
  enableZoomPan?: boolean; // true por defecto (Ken Burns)
  transitionStyle?: TransitionStylePreset; // "auto" por defecto
  transitionDurationSec?: number; // 0.55s por defecto
  srtPath?: string; // Ruta opcional al archivo .srt para quemar subtítulos dinámicos sincronizados
}

export interface VideoAssembleResult {
  videoPath: string;
  srtPath?: string;
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

      if (scene.durationSeconds && scene.durationSeconds > 0 && i < scenes.length - 1) {
        sceneDur = scene.durationSeconds;
        elapsed += sceneDur;
      } else if (i === scenes.length - 1) {
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

    // 3. Construir pipeline avanzado FFmpeg (Zoom/Pan Ken Burns + transiciones xfade + estilo visual + música ducked)
    const enableZoomPan = options?.enableZoomPan !== false;
    const visualStyle: VisualStylePreset = options?.visualStyle || "cinema_warm";
    const transitionStyle: TransitionStylePreset = options?.transitionStyle || "auto";
    const hasMusic = Boolean(options?.musicTrackPath && fs.existsSync(options.musicTrackPath));
    const musicVolume = options?.musicVolume ?? 0.14;

    const minSceneDur = Math.min(...allocatedDurations);
    const transDur =
      transitionStyle === "none" || scenes.length < 2
        ? 0
        : Math.min(options?.transitionDurationSec ?? 0.55, Math.max(0.25, minSceneDur * 0.3));

    const autoTransitions = ["fade", "dissolve", "smoothleft", "wipeleft", "circleopen"];

    const styleFilterMap: Record<VisualStylePreset, string> = {
      vintage_film:
        "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,noise=alls=12:allf=t+u,vignette=PI/4",
      cinema_warm: "eq=contrast=1.06:saturation=1.08:brightness=0.01,vignette=PI/5",
      high_contrast_tech: "eq=contrast=1.10:saturation=1.12,vignette=PI/5",
      modern_clean: "eq=saturation=1.04",
    };

    const inputArgs: string[] = [];
    const filterParts: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const imgPath = path.resolve(scenes[i].imagePath).replace(/\\/g, "/");
      const dur = allocatedDurations[i] + (i < scenes.length - 1 ? transDur : 0);
      const frames = Math.max(24, Math.ceil(dur * fps));
      // Escalar a 2x antes de zoompan en pipeline corto para evitar vibración por redondeo de píxel
      const upW = Math.round((width * 2) / 2) * 2;
      const upH = Math.round((height * 2) / 2) * 2;
      const isPortrait = height > width;
      const isBrandAsset = /(intrinsic_|drive_brand_|logo)/i.test(imgPath);
      const baseScale = `format=yuv420p,scale=${upW}:${upH}:force_original_aspect_ratio=increase,crop=${upW}:${upH},setsar=1`;
      if (enableZoomPan) {
        inputArgs.push(`-i "${imgPath}"`);
        const mode = i % 4;
        const denom = Math.max(1, frames - 1);
        let zpExpr = "";
        if (isPortrait || isBrandAsset) {
          // En 9:16 vertical o placas/logos de marca: mostrar imagen completa centrada sobre fondo difuminado (sin recortar bordes)
          const zoomDelta = isBrandAsset ? "0.03" : "0.06";
          zpExpr =
            mode % 2 === 0 || isBrandAsset
              ? `zoompan=z='1.0+${zoomDelta}*(on/${denom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`
              : `zoompan=z='${1 + parseFloat(zoomDelta)}-${zoomDelta}*(on/${denom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
          filterParts.push(
            `[${i}:v]format=yuv420p,split[bg${i}][fg${i}];` +
              `[bg${i}]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=18:4,setsar=1[bgb${i}];` +
              `[fg${i}]scale=${width}:${height}:force_original_aspect_ratio=decrease,setsar=1[fgb${i}];` +
              `[bgb${i}][fgb${i}]overlay=(W-w)/2:(H-h)/2,scale=${upW}:${upH}:flags=lanczos,setsar=1,${zpExpr},fps=${fps},settb=1/${fps},setpts=PTS-STARTPTS,format=yuv420p[v${i}]`
          );
        } else {
          if (mode === 0) {
            zpExpr = `zoompan=z='1.0+0.09*(on/${denom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
          } else if (mode === 1) {
            zpExpr = `zoompan=z='1.09-0.09*(on/${denom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
          } else if (mode === 2) {
            zpExpr = `zoompan=z='1.06':x='(iw-iw/zoom)*(on/${denom})':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
          } else {
            zpExpr = `zoompan=z='1.06':x='(iw-iw/zoom)*(1-(on/${denom}))':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
          }
          filterParts.push(`[${i}:v]${baseScale},${zpExpr},fps=${fps},settb=1/${fps},setpts=PTS-STARTPTS,format=yuv420p[v${i}]`);
        }
      } else {
        inputArgs.push(`-loop 1 -t ${dur.toFixed(3)} -i "${imgPath}"`);
        filterParts.push(`[${i}:v]format=yuv420p,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${fps},settb=1/${fps},setpts=PTS-STARTPTS,format=yuv420p[v${i}]`);
      }
    }

    // Encadenar transiciones xfade o concat
    let currentVideoLabel = "[v0]";
    if (scenes.length > 1 && transDur > 0) {
      let offset = allocatedDurations[0];
      for (let i = 1; i < scenes.length; i++) {
        const transName =
          transitionStyle === "auto"
            ? autoTransitions[(i - 1) % autoTransitions.length]
            : transitionStyle;
        const outLabel = i === scenes.length - 1 ? "[vcombined]" : `[vt${i}]`;
        filterParts.push(
          `${currentVideoLabel}[v${i}]xfade=transition=${transName}:duration=${transDur.toFixed(
            3
          )}:offset=${Math.max(0.1, offset).toFixed(3)}${outLabel}`
        );
        currentVideoLabel = outLabel;
        offset += allocatedDurations[i];
      }
    } else if (scenes.length > 1) {
      const inputs = scenes.map((_, i) => `[v${i}]`).join("");
      filterParts.push(`${inputs}concat=n=${scenes.length}:v=1:a=0[vcombined]`);
      currentVideoLabel = "[vcombined]";
    }

    // Aplicar estilo visual (ej: vintage_film / cinema_warm / modern_clean)
    const styleExpr = styleFilterMap[visualStyle] || styleFilterMap.cinema_warm;
    filterParts.push(`${currentVideoLabel}${styleExpr},format=yuv420p[vout]`);

    // Entradas de audio: narración + música de fondo opcional
    const narrationIdx = scenes.length;
    inputArgs.push(`-i "${audioPath}"`);

    let audioMapArg = `-map ${narrationIdx}:a`;
    if (hasMusic && options?.musicTrackPath) {
      const musicIdx = scenes.length + 1;
      const safeMusicPath = path.resolve(options.musicTrackPath).replace(/\\/g, "/");
      inputArgs.push(`-stream_loop -1 -i "${safeMusicPath}"`);
      const fadeOutStart = Math.max(0.5, totalAudioDuration - 1.8).toFixed(2);
      filterParts.push(
        `[${musicIdx}:a]volume=${musicVolume},afade=t=in:st=0:d=1.2,afade=t=out:st=${fadeOutStart}:d=1.8[mduck]`,
        `[${narrationIdx}:a][mduck]amix=inputs=2:duration=first:dropout_transition=2[aout]`
      );
      audioMapArg = `-map "[aout]"`;
    }

    const filterComplex = filterParts.join(";");
    const filterScriptPath = path.join(
      path.dirname(outputPath),
      `${path.basename(outputPath, path.extname(outputPath))}_filter.txt`
    );
    fs.writeFileSync(filterScriptPath, filterComplex, "utf8");

    const targetCrf = totalAudioDuration > 210 ? 27 : totalAudioDuration > 120 ? 25 : 23;
    const advancedFfmpegCmd = `"${ffmpegBin}" -y ${inputArgs.join(" ")} -filter_complex_script "${filterScriptPath}" -map "[vout]" ${audioMapArg} -r ${fps} -c:v libx264 -preset fast -crf ${targetCrf} -c:a aac -b:a 128k -shortest -movflags +faststart "${outputPath}"`;

    console.log(
      `🎬 VideoAssembler: Renderizando MP4 (${width}x${height} @ ${fps}fps, estilo=${visualStyle}, zoom=${enableZoomPan}, trans=${transitionStyle}, música=${hasMusic ? path.basename(options!.musicTrackPath!) : "ninguna"})...`
    );

    const baseName = path.basename(outputPath, path.extname(outputPath));
    const renderPerSceneConcat = async (): Promise<void> => {
      const clipPaths: string[] = [];
      const clipListPath = path.join(path.dirname(outputPath), `${baseName}_clips.txt`);
      const isPortraitClip = height > width;
      // Escalar 3x (1 escena a la vez = bajo consumo RAM) para eliminar vibración por redondeo de píxel en zoompan
      const upW = Math.round((width * 3) / 2) * 2;
      const upH = Math.round((height * 3) / 2) * 2;
      try {
        for (let i = 0; i < scenes.length; i++) {
          const imgPath = path.resolve(scenes[i].imagePath).replace(/\\/g, "/");
          const isVideoClip = scenes[i].mediaType === "video" || /\.(mp4|mov|m4v|webm)$/i.test(imgPath);
          const sceneDur = allocatedDurations[i];
          const frames = Math.max(24, Math.ceil(sceneDur * fps));
          const denom = Math.max(1, frames - 1);
          const fadeOutSt = Math.max(0.2, sceneDur - 0.35).toFixed(2);
          const clipPath = path.join(path.dirname(outputPath), `${baseName}_clip_${i}.mp4`);
          const isBrandAsset = /(intrinsic_|drive_brand_|logo)/i.test(imgPath);
          const mode = i % 4;
          let filterStr = "";
          let clipInputArg = `-i "${imgPath}"`;

          if (isVideoClip) {
            // Clip de vídeo corto (.mp4/.mov): lo recortamos/bucleamos suavemente a la duración exacta de la escena
            clipInputArg = `-stream_loop -1 -i "${imgPath}"`;
            filterStr = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${fps},fade=t=in:st=0:d=0.35,fade=t=out:st=${fadeOutSt}:d=0.35,${styleExpr},format=yuv420p[vout]`;
          } else if (enableZoomPan) {
            let zpExpr = "";
            if (isPortraitClip || isBrandAsset) {
              const zoomDelta = isBrandAsset ? "0.03" : "0.06";
              zpExpr =
                mode % 2 === 0 || isBrandAsset
                  ? `zoompan=z='1.0+${zoomDelta}*(on/${denom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`
                  : `zoompan=z='${1 + parseFloat(zoomDelta)}-${zoomDelta}*(on/${denom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
              filterStr =
                `[0:v]format=yuv420p,split[bg][fg];` +
                `[bg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=18:4,setsar=1[bgb];` +
                `[fg]scale=${width}:${height}:force_original_aspect_ratio=decrease,setsar=1[fgb];` +
                `[bgb][fgb]overlay=(W-w)/2:(H-h)/2,scale=${upW}:${upH}:flags=lanczos,setsar=1,${zpExpr},fps=${fps},fade=t=in:st=0:d=0.35,fade=t=out:st=${fadeOutSt}:d=0.35,${styleExpr},format=yuv420p[vout]`;
            } else {
              if (mode === 0) {
                zpExpr = `zoompan=z='1.0+0.09*(on/${denom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
              } else if (mode === 1) {
                zpExpr = `zoompan=z='1.09-0.09*(on/${denom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
              } else if (mode === 2) {
                zpExpr = `zoompan=z='1.06':x='(iw-iw/zoom)*(on/${denom})':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
              } else {
                zpExpr = `zoompan=z='1.06':x='(iw-iw/zoom)*(1-(on/${denom}))':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
              }
              filterStr = `[0:v]format=yuv420p,scale=${upW}:${upH}:flags=lanczos:force_original_aspect_ratio=increase,crop=${upW}:${upH},setsar=1,${zpExpr},fps=${fps},fade=t=in:st=0:d=0.35,fade=t=out:st=${fadeOutSt}:d=0.35,${styleExpr},format=yuv420p[vout]`;
            }
          } else {
            clipInputArg = `-loop 1 -t ${sceneDur.toFixed(3)} -i "${imgPath}"`;
            filterStr = `[0:v]format=yuv420p,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${fps},fade=t=in:st=0:d=0.35,fade=t=out:st=${fadeOutSt}:d=0.35,${styleExpr},format=yuv420p[vout]`;
          }

          const clipCmd = `"${ffmpegBin}" -y ${clipInputArg} -filter_complex "${filterStr}" -map "[vout]" -an -r ${fps} -c:v libx264 -preset fast -crf ${targetCrf} -t ${sceneDur.toFixed(3)} "${clipPath}"`;
          await execAsync(clipCmd, { timeout: 60_000, maxBuffer: 5 * 1024 * 1024 });
          clipPaths.push(clipPath);
        }

        fs.writeFileSync(
          clipListPath,
          clipPaths.map((p) => `file '${path.resolve(p).replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"),
          "utf8"
        );

        let finalAudioArgs = `-map 1:a`;
        let finalMusicInput = "";
        let finalAudioFilter = "";
        if (hasMusic && options?.musicTrackPath) {
          const safeMusicPath = path.resolve(options.musicTrackPath).replace(/\\/g, "/");
          finalMusicInput = `-stream_loop -1 -i "${safeMusicPath}"`;
          const fadeOutStart = Math.max(0.5, totalAudioDuration - 1.8).toFixed(2);
          finalAudioFilter = `-filter_complex "[2:a]volume=${musicVolume},afade=t=in:st=0:d=1.2,afade=t=out:st=${fadeOutStart}:d=1.8[mduck];[1:a][mduck]amix=inputs=2:duration=first:dropout_transition=2[aout]"`;
          finalAudioArgs = `-map "[aout]"`;
        }

        const mergeCmd = `"${ffmpegBin}" -y -f concat -safe 0 -i "${clipListPath}" -i "${audioPath}" ${finalMusicInput} ${finalAudioFilter} -map 0:v -c:v copy ${finalAudioArgs} -c:a aac -b:a 160k -shortest -movflags +faststart "${outputPath}"`;
        await execAsync(mergeCmd, { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 });
      } finally {
        for (const cp of clipPaths) {
          try { if (fs.existsSync(cp)) fs.unlinkSync(cp); } catch {}
        }
        try { if (fs.existsSync(clipListPath)) fs.unlinkSync(clipListPath); } catch {}
      }
    };

    const hasVideoClips = scenes.some(
      (s) => s.mediaType === "video" || /\.(mp4|mov|m4v|webm)$/i.test(s.imagePath)
    );
    let usedFallback = false;
    let usedPerScene = false;
    try {
      if (scenes.length > 6 || hasVideoClips) {
        // Vídeos largos (>6 escenas) o montaje híbrido con clips .mp4: renderizado secuencial por escena + concat -c:v copy
        usedPerScene = true;
        console.log(`🎬 [VideoAssembler] Renderizado secuencial por escena (${scenes.length} escenas, clips=${hasVideoClips ? "sí" : "no"})...`);
        await renderPerSceneConcat();
      } else {
        try {
          await execAsync(advancedFfmpegCmd, {
            timeout: Math.max(timeoutMs, scenes.length * 20_000, 300_000),
            maxBuffer: 15 * 1024 * 1024,
          });
        } catch (advErr: any) {
          usedFallback = true;
          const stderrTail = advErr?.stderr ? String(advErr.stderr).slice(-350).replace(/\s+/g, " ") : "";
          console.warn(
            `⚠️ [VideoAssembler] Pipeline avanzado falló (${advErr?.message?.slice(0, 120)}${stderrTail ? " | stderr: " + stderrTail : ""}), usando renderizado secuencial seguro con Ken Burns, fades y música...`
          );
          await renderPerSceneConcat();
        }
      }

      // Limpiar archivos intermedios
      try {
        if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
        if (fs.existsSync(filterScriptPath)) fs.unlinkSync(filterScriptPath);
      } catch {}

      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000) {
        throw new Error("El archivo MP4 generado está vacío o no se creó correctamente.");
      }

      let subtitlesBurned = false;
      if (options?.srtPath && fs.existsSync(options.srtPath)) {
        const subOutPath = outputPath.replace(/\.mp4$/i, "_sub.mp4");
        const relSrt = path.relative(process.cwd(), options.srtPath).replace(/\\/g, "/");
        const isVertical = height > width;
        const fontSize = isVertical ? 14 : 18;
        const marginV = isVertical ? 44 : 26;
        const styleStr = `FontName=Arial,FontSize=${fontSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H88000000,BorderStyle=3,Outline=1,Shadow=0,Alignment=2,MarginV=${marginV}`;
        const subCrf = totalAudioDuration > 210 ? 28 : totalAudioDuration > 120 ? 26 : 24;
        const subCmd = `"${ffmpegBin}" -y -i "${outputPath}" -vf "subtitles='${relSrt}':force_style='${styleStr}'" -c:v libx264 -preset veryfast -crf ${subCrf} -pix_fmt yuv420p -c:a copy -movflags +faststart "${subOutPath}"`;
        try {
          console.log(`💬 [VideoAssembler] Quemando subtítulos sincronizados (${relSrt})...`);
          await execAsync(subCmd, { timeout: 180_000, maxBuffer: 10 * 1024 * 1024 });
          if (fs.existsSync(subOutPath) && fs.statSync(subOutPath).size > 1000) {
            try { fs.unlinkSync(outputPath); } catch {}
            fs.renameSync(subOutPath, outputPath);
            subtitlesBurned = true;
            console.log(`✅ [VideoAssembler] Subtítulos quemados con éxito en el MP4.`);
          }
        } catch (subErr: any) {
          console.warn(`⚠️ [VideoAssembler] No se pudieron quemar subtítulos (${subErr?.message?.slice(0, 120)}); se conserva el MP4 limpio y el .srt.`);
          try { if (fs.existsSync(subOutPath)) fs.unlinkSync(subOutPath); } catch {}
        }
      }

      const fileStats = fs.statSync(outputPath);
      console.log(`✅ VideoAssembler: Vídeo MP4 generado con éxito (${fileStats.size} bytes, ${totalAudioDuration.toFixed(1)}s, ${distinctImages.size} imágenes distintas${subtitlesBurned ? ", subtítulos quemados" : ""}) en ${outputPath}`);

      return {
        videoPath: outputPath,
        srtPath: options?.srtPath,
        durationSeconds: totalAudioDuration,
        sceneCount: scenes.length,
        distinctImageCount: distinctImages.size,
        fileSizeBytes: fileStats.size,
        width,
        height,
        providerNotes: usedFallback
          ? `FFmpeg H.264/AAC @ ${fps}fps (Secuencial seguro: Ken Burns + fade + ${visualStyle}, ${distinctImages.size} imágenes distintas)`
          : usedPerScene
          ? `FFmpeg H.264/AAC @ ${fps}fps (Secuencial Ken Burns + fade + ${visualStyle}, ${distinctImages.size} imágenes distintas)`
          : `FFmpeg H.264/AAC @ ${fps}fps (Ken Burns + xfade:${transitionStyle} + ${visualStyle}, ${distinctImages.size} imágenes distintas)`,
      };
    } catch (err: any) {
      // Limpiar archivo intermedio en caso de fallo
      try {
        if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
        if (fs.existsSync(filterScriptPath)) fs.unlinkSync(filterScriptPath);
      } catch {}
      const shortErr = String(err?.stderr || err?.message || "Error FFmpeg").slice(-260).replace(/\s+/g, " ").trim();
      console.error("❌ VideoAssembler: Error en renderizado FFmpeg:", shortErr);
      throw new Error(`Fallo en el renderizado del vídeo con FFmpeg: ${shortErr}`);
    }
  },
};
