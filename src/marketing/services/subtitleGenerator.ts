import fs from "fs";
import path from "path";

export interface SubtitleResult {
  srtPath: string;
  transcriptText: string;
  cueCount: number;
}

function formatSrtTime(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const millis = Math.round((safe - Math.floor(safe)) * 1000);
  const pad = (n: number, w: number = 2) => String(n).padStart(w, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(Math.min(999, millis))}`;
}

function formatClockTime(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Divide un párrafo de locución en bloques breves (<= 46 caracteres / 8 palabras)
 * cómodos para lectura rápida en subtítulos de vídeo (16:9 y 9:16).
 */
function splitIntoSubtitleChunks(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .filter(Boolean);

  const chunks: string[] = [];
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter(Boolean);
    let current = "";
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      if (candidate.length > 44 || candidate.split(/\s+/).length > 8) {
        if (current) chunks.push(current);
        current = w;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);
  }
  return chunks;
}

/**
 * Genera un archivo .srt sincronizado con las duraciones reales de cada escena
 * y la transcripción legible completa para memoria/redes.
 */
export function generateTimedSrtAndTranscript(
  scenes: Array<{ sceneNumber?: number; narration?: string }>,
  sceneDurations: number[],
  hookText?: string,
  pauseSeconds: number = 0.35
): SubtitleResult {
  const tempDir = path.resolve(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const srtEntries: string[] = [];
  const transcriptLines: string[] = [];
  let cursorSec = 0;
  let cueIndex = 1;

  for (let i = 0; i < scenes.length; i++) {
    const sceneDur = sceneDurations[i] || 8;
    const isLast = i === scenes.length - 1;
    const spokenWindow = Math.max(0.8, sceneDur - (isLast ? 0 : pauseSeconds));

    let rawText = (scenes[i].narration || "").trim();
    if (i === 0 && hookText && hookText.trim().length > 0) {
      rawText = `${hookText.trim()} ${rawText}`.trim();
    }

    if (rawText) {
      transcriptLines.push(`[${formatClockTime(cursorSec)}] ${rawText}`);
      const chunks = splitIntoSubtitleChunks(rawText);
      const totalWords = chunks.reduce((acc, c) => acc + c.split(/\s+/).length, 0) || 1;

      let localOffset = 0;
      for (const chunk of chunks) {
        const wCount = chunk.split(/\s+/).length;
        const chunkDur = (wCount / totalWords) * spokenWindow;
        const start = cursorSec + localOffset;
        const end = Math.min(cursorSec + spokenWindow, start + Math.max(0.45, chunkDur));

        srtEntries.push(
          `${cueIndex}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${chunk}\n`
        );
        cueIndex++;
        localOffset += chunkDur;
      }
    }

    cursorSec += sceneDur;
  }

  const srtPath = path.join(tempDir, `mkt_subs_${Date.now()}.srt`);
  fs.writeFileSync(srtPath, srtEntries.join("\n"), "utf-8");

  return {
    srtPath,
    transcriptText: transcriptLines.join("\n"),
    cueCount: cueIndex - 1,
  };
}
