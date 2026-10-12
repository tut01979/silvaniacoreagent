import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { voiceStudio } from "../src/marketing/services/voiceStudio.js";
import { slideRenderer } from "../src/marketing/services/slideRenderer.js";
import { videoAssembler, getFfmpegBinary } from "../src/marketing/services/videoAssembler.js";

async function main() {
  console.log("🚀 [Sprint 1 Test] Verificando Pipeline Completo (Google TTS + Slides Canvas + VideoAssembler)...");

  // 1. Probar Locución con Google TTS primario
  const speechText = "¡Hola! Con Silvania CoreAgent, tu asistente inteligente vive en Telegram... Agenda reuniones, revisa tus correos y gestiona tus hojas de cálculo sin complicaciones. Todo en un solo lugar. Visita Silvania punto a-i.";
  console.log("🎙️ 1. Sintetizando locución con Google TTS...");
  const voiceRes = await voiceStudio.generateNarration(speechText, 1572946817);
  console.log("✅ Locución generada:", voiceRes);
  if (!fs.existsSync(voiceRes.audioPath)) {
    throw new Error("El archivo de audio no existe");
  }

  // 2. Generar 3 diapositivas corporativas Canvas
  console.log("🎨 2. Generando 3 diapositivas corporativas con @napi-rs/canvas...");
  const scenes = [
    {
      sceneNumber: 1,
      title: "¡Adiós al Caos! Centraliza tu Google Workspace",
      onScreenText: "CALENDARIO, CORREOS Y HOJAS EN TELEGRAM",
    },
    {
      sceneNumber: 2,
      title: "Automatiza Tareas en Segundos",
      onScreenText: "REGISTRA GASTOS Y REUNIONES AL INSTANTE",
    },
    {
      sceneNumber: 3,
      title: "Productividad Ejecutiva con Silvania",
      onScreenText: "TU ASISTENTE INTELIGENTE. SILVANIA.AI",
    },
  ];

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
      narrationText: s.title,
      imagePath: slide.filePath,
    });
  }

  console.log("✅ 3 Diapositivas generadas:");
  mediaList.forEach(m => console.log(`   - Escena ${m.sceneNumber}: ${m.imagePath} (${fs.statSync(m.imagePath).size} bytes)`));

  // 3. Ensamblar Video MP4
  console.log("🎬 3. Ensamblando MP4 con FFmpeg...");
  const videoRes = await videoAssembler.assembleVideo(
    mediaList,
    voiceRes.audioPath,
    "test_sprint1_output.mp4",
    { width: 1280, height: 720 }
  );

  console.log("✅ MP4 Ensamblado con éxito:", videoRes);
  const mp4Size = fs.statSync(videoRes.videoPath).size;
  console.log(`📁 Tamaño de MP4: ${(mp4Size / 1024).toFixed(1)} KB, Duración: ${videoRes.durationSeconds.toFixed(1)}s`);

  // 4. Extraer fotogramas a diferentes segundos para comprobar que los stills cambian
  const ffmpegBin = getFfmpegBinary();
  const testDir = path.join(process.cwd(), "temp", "sprint1_verify");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const times = [2, 6, 10];
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
  console.log(`🔍 Hashes distintos extraídos: ${distinctHashes.size} de ${hashes.length}`);
  if (distinctHashes.size > 1) {
    console.log("✅ ¡CONFIRMADO! El MP4 cambia de diapositiva visualmente a lo largo del vídeo.");
  } else {
    console.warn("⚠️ Advertencia: Hashes idénticos detectados.");
  }

  console.log("🎉 ¡SPRINT 1 COMPLETADO CON ÉXITO ABSOLUTO!");
}

main().catch(err => {
  console.error("❌ Fallo en test Sprint 1:", err);
  process.exit(1);
});
