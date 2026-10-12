import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { getFfmpegBinary, videoAssembler, SceneMediaInput } from "../src/marketing/services/videoAssembler.js";

async function main() {
  console.log("=== TEST VIDEO ASSEMBLER: 3 ESCENAS / 3 IMÁGENES DISTINTAS ===");

  // 1. Localizar binario FFmpeg
  const ffmpegBin = getFfmpegBinary();
  console.log(`✅ FFmpeg detectado en: ${ffmpegBin}`);

  const testDir = path.resolve("./temp/test_video");
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // 2. Generar 3 imágenes de prueba claramente distintas (Azul, Verde oscuro, Rojo oscuro)
  const img1Path = path.join(testDir, "scene_1_blue.jpg");
  const img2Path = path.join(testDir, "scene_2_green.jpg");
  const img3Path = path.join(testDir, "scene_3_red.jpg");

  console.log("🎨 Generando 3 imágenes de prueba distintas...");
  execSync(`"${ffmpegBin}" -y -f lavfi -i color=c=blue:s=1280x720:d=1 -vframes 1 "${img1Path}"`);
  execSync(`"${ffmpegBin}" -y -f lavfi -i color=c=darkgreen:s=1280x720:d=1 -vframes 1 "${img2Path}"`);
  execSync(`"${ffmpegBin}" -y -f lavfi -i color=c=darkred:s=1280x720:d=1 -vframes 1 "${img3Path}"`);

  if (!fs.existsSync(img1Path) || !fs.existsSync(img2Path) || !fs.existsSync(img3Path)) {
    throw new Error("No se pudieron generar las 3 imágenes de prueba.");
  }
  console.log("✅ 3 imágenes distintas generadas correctamente.");

  // 3. Generar audio de prueba de 6 segundos
  const audioPath = path.join(testDir, "test_audio_6s.aac");
  console.log("🎙️ Generando audio de prueba (6 segundos)...");
  execSync(`"${ffmpegBin}" -y -f lavfi -i "sine=frequency=440:duration=6" -c:a aac "${audioPath}"`);

  if (!fs.existsSync(audioPath)) {
    throw new Error("No se pudo generar el audio de prueba.");
  }
  console.log("✅ Audio de prueba de 6 segundos generado.");

  // 4. Definir 3 escenas con las 3 imágenes distintas
  const scenes: SceneMediaInput[] = [
    {
      sceneNumber: 1,
      narrationText: "Primera escena con fondo azul que dura aproximadamente dos segundos.",
      imagePath: img1Path,
    },
    {
      sceneNumber: 2,
      narrationText: "Segunda escena con fondo verde que presenta la solución del contenido.",
      imagePath: img2Path,
    },
    {
      sceneNumber: 3,
      narrationText: "Tercera escena final con fondo rojo que concluye con la llamada a la acción.",
      imagePath: img3Path,
    },
  ];

  console.log("🎬 Ejecutando videoAssembler.assembleVideo con 3 escenas distintas...");
  const result = await videoAssembler.assembleVideo(scenes, audioPath, "test_3scenes_output.mp4", {
    width: 1280,
    height: 720,
    fps: 24,
    timeoutMs: 30000,
  });

  console.log("🎉 Resultado del ensamblado:", {
    videoPath: result.videoPath,
    durationSeconds: result.durationSeconds,
    sceneCount: result.sceneCount,
    distinctImageCount: result.distinctImageCount,
    fileSizeBytes: result.fileSizeBytes,
    providerNotes: result.providerNotes,
  });

  // Validaciones
  if (result.sceneCount !== 3) {
    throw new Error(`Se esperaban 3 escenas pero se reportaron ${result.sceneCount}`);
  }
  if (result.distinctImageCount !== 3) {
    throw new Error(`Se esperaban 3 imágenes distintas pero se reportaron ${result.distinctImageCount}`);
  }
  if (Math.abs(result.durationSeconds - 6.0) > 0.5) {
    throw new Error(`La duración del vídeo (${result.durationSeconds}s) no coincide con el audio (6s)`);
  }

  // 5. Verificar que el vídeo cambia de still a lo largo del tiempo
  // Extraemos fotogramas en t = 1.0s (escena 1), t = 3.0s (escena 2) y t = 5.0s (escena 3)
  console.log("📸 Extrayendo fotogramas a 1s, 3s y 5s para verificar cambio de still...");
  const f1Path = path.join(testDir, "frame_1s.jpg");
  const f2Path = path.join(testDir, "frame_3s.jpg");
  const f3Path = path.join(testDir, "frame_5s.jpg");

  execSync(`"${ffmpegBin}" -y -ss 00:00:01.0 -i "${result.videoPath}" -vframes 1 "${f1Path}"`);
  execSync(`"${ffmpegBin}" -y -ss 00:00:03.0 -i "${result.videoPath}" -vframes 1 "${f2Path}"`);
  execSync(`"${ffmpegBin}" -y -ss 00:00:05.0 -i "${result.videoPath}" -vframes 1 "${f3Path}"`);

  const hash1 = crypto.createHash("md5").update(fs.readFileSync(f1Path)).digest("hex");
  const hash2 = crypto.createHash("md5").update(fs.readFileSync(f2Path)).digest("hex");
  const hash3 = crypto.createHash("md5").update(fs.readFileSync(f3Path)).digest("hex");

  console.log(`🔍 Hashes MD5 de los fotogramas extraídos:`);
  console.log(`  - 1.0s (Escena 1): ${hash1}`);
  console.log(`  - 3.0s (Escena 2): ${hash2}`);
  console.log(`  - 5.0s (Escena 3): ${hash3}`);

  if (hash1 === hash2 || hash2 === hash3 || hash1 === hash3) {
    throw new Error("❌ FALLO: Dos o más fotogramas son idénticos. El vídeo no cambió de still visual entre escenas.");
  }
  console.log("✅ ¡CONFIRMADO! El MP4 cambia de still visual en cada escena (los 3 fotogramas son distintos).");

  // 6. Test negativo: verificar que rechaza ensamblar si todas las escenas tienen la misma imagen
  console.log("🧪 Probando validación de imágenes idénticas (test negativo)...");
  const duplicateScenes: SceneMediaInput[] = [
    { sceneNumber: 1, narrationText: "Escena 1", imagePath: img1Path },
    { sceneNumber: 2, narrationText: "Escena 2", imagePath: img1Path },
    { sceneNumber: 3, narrationText: "Escena 3", imagePath: img1Path },
  ];

  let rejectedCorrectly = false;
  try {
    await videoAssembler.assembleVideo(duplicateScenes, audioPath, "test_dup_fail.mp4");
  } catch (dupErr: any) {
    if (dupErr.message.includes("solo 1 imagen distinta")) {
      rejectedCorrectly = true;
      console.log(`✅ Rechazado correctamente con error: "${dupErr.message}"`);
    }
  }

  if (!rejectedCorrectly) {
    throw new Error("❌ FALLO: El assembler debió rechazar el ensamblado con imágenes idénticas.");
  }

  console.log("✅ ¡TEST COMPLETADO CON ÉXITO ABSOLUTO (5/5 Verificaciones OK)!");
}

main().catch((err) => {
  console.error("❌ Error en test:", err);
  process.exit(1);
});
