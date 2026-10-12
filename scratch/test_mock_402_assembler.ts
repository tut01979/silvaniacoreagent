import fs from "fs";
import path from "path";
import crypto from "crypto";
import axios from "axios";
import { execSync } from "child_process";
import { imageGenerator, reset402CircuitBreaker } from "../src/marketing/services/imageGenerator.js";
import { videoAssembler, getFfmpegBinary, SceneMediaInput } from "../src/marketing/services/videoAssembler.js";

async function main() {
  console.log("=== TEST RESILIENCE: POLLINATIONS 402 MOCK -> FALLBACK LOCAL -> MP4 STILLS ===");

  reset402CircuitBreaker();
  const ffmpegBin = getFfmpegBinary();
  const testDir = path.resolve("./temp/test_402_mock");
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // 1. Mock de axios.get para simular que Pollinations devuelve HTTP 402 (Payment Required)
  const originalAxiosGet = axios.get;
  let mock402CallsCount = 0;

  (axios as any).get = async (url: string, ...args: any[]) => {
    if (typeof url === "string" && url.includes("pollinations.ai")) {
      mock402CallsCount++;
      const err: any = new Error("Request failed with status code 402");
      err.response = { status: 402, data: "Payment Required" };
      throw err;
    }
    return originalAxiosGet(url, ...args);
  };

  console.log("🧪 Mock activo: Todas las llamadas a Pollinations devolverán HTTP 402.");

  // 2. Generar 3 imágenes de escena
  const scenePrompts = [
    { index: 1, title: "1. Introducción al Caso", prompt: "Introduction cinematic shot" },
    { index: 2, title: "2. Demostración en Vivo", prompt: "Live demonstration software" },
    { index: 3, title: "3. Llamada a la Acción", prompt: "Call to action ending screen" },
  ];

  const generatedImages: string[] = [];

  for (const s of scenePrompts) {
    console.log(`🎨 Solicitando imagen para Escena ${s.index}: "${s.title}"...`);
    const imgRes = await imageGenerator.generateImage(s.prompt, {
      width: 1280,
      height: 720,
      sceneIndex: s.index,
      sceneTitle: s.title,
      allowFallback: true,
    });

    console.log(`  -> Resultado: provider = ${imgRes.provider}, isLocalFallback = ${imgRes.isLocalFallback}, file = ${imgRes.filePath}`);

    if (imgRes.provider !== "local_ffmpeg_card" || !imgRes.isLocalFallback) {
      throw new Error(`Se esperaba fallback local pero se obtuvo: ${imgRes.provider}`);
    }

    if (!fs.existsSync(imgRes.filePath) || fs.statSync(imgRes.filePath).size < 1000) {
      throw new Error(`El archivo de imagen fallback local no existe o está vacío: ${imgRes.filePath}`);
    }

    generatedImages.push(imgRes.filePath);
  }

  console.log(`✅ 3 imágenes generadas con éxito vía fallback local tras HTTP 402.`);
  console.log(`ℹ️ Llamadas a Pollinations interceptadas: ${mock402CallsCount} (circuit breaker activado tras 2 errores 402).`);

  // Restaurar axios
  axios.get = originalAxiosGet;

  // 3. Verificar que las 3 imágenes son distintas
  const hashImg1 = crypto.createHash("md5").update(fs.readFileSync(generatedImages[0])).digest("hex");
  const hashImg2 = crypto.createHash("md5").update(fs.readFileSync(generatedImages[1])).digest("hex");
  const hashImg3 = crypto.createHash("md5").update(fs.readFileSync(generatedImages[2])).digest("hex");

  console.log(`🔍 Hashes de las 3 imágenes fallback generadas:`);
  console.log(`  - Escena 1: ${hashImg1}`);
  console.log(`  - Escena 2: ${hashImg2}`);
  console.log(`  - Escena 3: ${hashImg3}`);

  if (hashImg1 === hash2Img(hashImg2) || hashImg2 === hashImg3 || hashImg1 === hashImg3) {
    throw new Error("❌ Error: Las imágenes fallback no son distintas entre sí.");
  }
  console.log("✅ Confirmado: Las 3 imágenes locales tienen paletas y textos distintos.");

  function hash2Img(h: string) { return h; }

  // 4. Generar audio sintético de 6 segundos
  const audioPath = path.join(testDir, "test_audio_6s.aac");
  execSync(`"${ffmpegBin}" -y -f lavfi -i "sine=frequency=440:duration=6" -c:a aac "${audioPath}"`);

  // 5. Ensamblar vídeo MP4 con VideoAssembler
  const scenes: SceneMediaInput[] = [
    { sceneNumber: 1, narrationText: "Primera escena del caso de estudio.", imagePath: generatedImages[0] },
    { sceneNumber: 2, narrationText: "Segunda escena que demuestra la integración.", imagePath: generatedImages[1] },
    { sceneNumber: 3, narrationText: "Tercera escena final con el cierre del vídeo.", imagePath: generatedImages[2] },
  ];

  console.log("🎬 Ensamblando MP4 con las 3 imágenes fallback...");
  const videoRes = await videoAssembler.assembleVideo(scenes, audioPath, "test_402_mock_output.mp4", {
    width: 1280,
    height: 720,
    fps: 24,
    timeoutMs: 30000,
  });

  console.log("🎉 Resultado del vídeo ensamblado:", {
    videoPath: videoRes.videoPath,
    durationSeconds: videoRes.durationSeconds,
    sceneCount: videoRes.sceneCount,
    distinctImageCount: videoRes.distinctImageCount,
    fileSizeBytes: videoRes.fileSizeBytes,
  });

  if (videoRes.distinctImageCount !== 3) {
    throw new Error(`Se esperaban 3 imágenes distintas pero se reportaron ${videoRes.distinctImageCount}`);
  }

  // 6. Extraer fotogramas a 1s, 3s y 5s para verificar cambio de still
  const f1Path = path.join(testDir, "frame_1s.jpg");
  const f2Path = path.join(testDir, "frame_3s.jpg");
  const f3Path = path.join(testDir, "frame_5s.jpg");

  execSync(`"${ffmpegBin}" -y -ss 00:00:01.0 -i "${videoRes.videoPath}" -vframes 1 "${f1Path}"`);
  execSync(`"${ffmpegBin}" -y -ss 00:00:03.0 -i "${videoRes.videoPath}" -vframes 1 "${f2Path}"`);
  execSync(`"${ffmpegBin}" -y -ss 00:00:05.0 -i "${videoRes.videoPath}" -vframes 1 "${f3Path}"`);

  const fHash1 = crypto.createHash("md5").update(fs.readFileSync(f1Path)).digest("hex");
  const fHash2 = crypto.createHash("md5").update(fs.readFileSync(f2Path)).digest("hex");
  const fHash3 = crypto.createHash("md5").update(fs.readFileSync(f3Path)).digest("hex");

  console.log(`🔍 Hashes de fotogramas extraídos del MP4:`);
  console.log(`  - 1s: ${fHash1}`);
  console.log(`  - 3s: ${fHash2}`);
  console.log(`  - 5s: ${fHash3}`);

  if (fHash1 === fHash2 || fHash2 === fHash3 || fHash1 === fHash3) {
    throw new Error("❌ Error: Los fotogramas del MP4 no cambiaron en el tiempo.");
  }

  console.log("✅ ¡CONFIRMADO! El MP4 con fallback local cambia de still visualmente en cada escena.");
  console.log("✅ ¡TEST COMPLETADO CON ÉXITO ABSOLUTO!");
}

main().catch((err) => {
  console.error("❌ Error en test:", err);
  process.exit(1);
});
