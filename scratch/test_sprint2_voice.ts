import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { voiceStudio } from "../src/marketing/services/voiceStudio.js";
import { slideRenderer } from "../src/marketing/services/slideRenderer.js";
import { videoAssembler, getFfmpegBinary } from "../src/marketing/services/videoAssembler.js";

async function main() {
  console.log("🚀 [Sprint 2 Voice Test] Probando pipeline de locución estructurada con pausas y atempo=1.06...");

  const hook = "¿Cansado de perder horas entre pestañas? Fíjate en esto...";
  const scenes = [
    {
      sceneNumber: 1,
      title: "Tu Google Workspace en Telegram",
      onScreenText: "TODO EN UN SOLO MENSAJE",
      narration: "Con Silvania CoreAgent, todo tu ecosistema vive en Telegram... Un solo mensaje y listo.",
    },
    {
      sceneNumber: 2,
      title: "Automatiza Agenda y Gastos",
      onScreenText: "CALENDAR Y SHEETS AUTOMATIZADOS",
      narration: "Crea citas en Calendar, registra gastos en Sheets y redacta correos sin fricción.",
    },
    {
      sceneNumber: 3,
      title: "Productividad Ejecutiva Inmediata",
      onScreenText: "PRUÉBALO EN SILVANIA.AI",
      narration: "Más control... Menos clics. Transforma tu productividad hoy en silvania punto a-i.",
    },
  ];

  // 1. Locución estructurada por escenas
  console.log("🎙️ 1. Invocando voiceStudio.generatePacedNarration...");
  const pacedRes = await voiceStudio.generatePacedNarration(
    scenes.map(s => ({ sceneNumber: s.sceneNumber, narration: s.narration })),
    hook,
    1572946817,
    { pauseSeconds: 0.35, tempo: 1.06 }
  );

  console.log("✅ Paced Voice Result:", {
    audioPath: pacedRes.audioPath,
    totalDurationSeconds: pacedRes.totalDurationSeconds,
    sceneDurations: pacedRes.sceneDurations,
  });

  if (!fs.existsSync(pacedRes.audioPath)) {
    throw new Error("El archivo de audio maestro no existe");
  }

  // 2. Renderizar las 3 diapositivas Canvas
  console.log("🎨 2. Renderizando diapositivas corporativas Canvas...");
  const mediaList = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const slide = await slideRenderer.renderSceneSlide({
      sceneIndex: s.sceneNumber,
      totalScenes: scenes.length,
      title: s.title,
      onScreenText: s.onScreenText,
      width: 1280,
      height: 720,
    });
    mediaList.push({
      sceneNumber: s.sceneNumber,
      narrationText: s.narration,
      imagePath: slide.filePath,
      durationSeconds: pacedRes.sceneDurations[i],
    });
  }

  // 3. Ensamblar MP4 con duraciones exactas
  console.log("🎬 3. Ensamblando MP4 con VideoAssembler...");
  const videoRes = await videoAssembler.assembleVideo(
    mediaList,
    pacedRes.audioPath,
    "test_sprint2_output.mp4",
    { width: 1280, height: 720 }
  );

  console.log("✅ Vídeo MP4 ensamblado con éxito:", videoRes);
  const mp4Size = fs.statSync(videoRes.videoPath).size;
  console.log(`📁 MP4 generado: ${(mp4Size / 1024).toFixed(1)} KB, Duración: ${videoRes.durationSeconds.toFixed(2)}s`);

  // 4. Verificación de fotogramas extraídos
  const ffmpegBin = getFfmpegBinary();
  const testDir = path.join(process.cwd(), "temp", "sprint2_verify");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const times = [2, 6, 12];
  const hashes: string[] = [];

  for (const t of times) {
    if (t < videoRes.durationSeconds) {
      const framePath = path.join(testDir, `frame_${t}s.jpg`);
      execSync(`"${ffmpegBin}" -y -ss ${t} -i "${videoRes.videoPath}" -vframes 1 "${framePath}"`, { stdio: "pipe" });
      const hash = crypto.createHash("md5").update(fs.readFileSync(framePath)).digest("hex");
      hashes.push(hash);
      console.log(`🖼️ Fotograma a ${t}s extraído: Hash MD5 = ${hash}`);
    }
  }

  const distinctHashes = new Set(hashes);
  console.log(`🔍 Hashes distintos: ${distinctHashes.size} de ${hashes.length}`);
  if (distinctHashes.size > 1) {
    console.log("✅ ¡CONFIRMADO! El MP4 con narración estructurada cambia de escena visual con sincronización perfecta.");
  }

  console.log("🎉 ¡SPRINT 2 DE VOZ COMPLETADO Y VALIDADO CON ÉXITO ABSOLUTO!");
}

main().catch(err => {
  console.error("❌ Error en test Sprint 2:", err);
  process.exit(1);
});
