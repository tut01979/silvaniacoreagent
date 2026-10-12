import fs from "fs";
import path from "path";
import { visualAssetSelector } from "../src/marketing/services/visualAssetSelector.js";
import { imageGenerator } from "../src/marketing/services/imageGenerator.js";
import { voiceStudio } from "../src/marketing/services/voiceStudio.js";
import { videoAssembler, SceneMediaInput } from "../src/marketing/services/videoAssembler.js";

async function runFairyTaleTest() {
  console.log("================================================================================");
  console.log("🐉 TEST: CUENTO INFANTIL CON DRAGONES Y PRINCESAS (PIXAR 3D RENDERING)");
  console.log("================================================================================");

  const tempDir = path.resolve(process.cwd(), "temp/test_fairy_tales");
  fs.mkdirSync(tempDir, { recursive: true });

  const topic = "Cuento de un pequeño dragón y una valiente princesa en un reino mágico";
  const detectedProduct = visualAssetSelector.detectProduct(topic);
  console.log(`\n▶ 1. Universo Detectado para "${topic}":`);
  console.log(`   -> Producto: ${detectedProduct.toUpperCase()}`);

  if (detectedProduct !== "fantasy_tales") {
    throw new Error(`❌ Se esperaba fantasy_tales pero se obtuvo ${detectedProduct}`);
  }
  console.log("   ✅ Universo correctamente asignado a FANTASY_TALES");

  const scenes = [
    {
      sceneIndex: 1,
      title: "EL CASTILLO DE CRISTAL",
      onScreenText: "LA VALIENTE PRINCESA AURA",
      narration: "En un lejano reino donde los castillos brillaban con la luz del atardecer, vivía una joven princesa con un corazón valiente y curioso.",
      prompt: "Valiente princesa en su castillo mágico con tiara dorada, estilo Pixar 3D"
    },
    {
      sceneIndex: 2,
      title: "EL PEQUEÑO DRAGÓN CHISPA",
      onScreenText: "UN AMIGO CON ALAS Y FUEGO",
      narration: "En lo profundo del bosque encantado, encontró a un pequeño dragón que en vez de fuego, lanzaba chispas de luz mágica que iluminaban las sombras.",
      prompt: "Pequeño dragón bebé con escamas brillantes y alas diminutas lanzando chispas de fuego mágico, estilo Pixar 3D"
    },
    {
      sceneIndex: 3,
      title: "UNA AMISTAD SIN LÍMITES",
      onScreenText: "VOLANDO JUNTOS HACIA EL HORIZONTE",
      narration: "Juntos demostraron a todo el reino que la verdadera magia no estaba en los hechizos, sino en la valentía de compartir y confiar.",
      prompt: "Princesa y dragón juntos volando sobre el reino al atardecer, estilo Pixar 3D"
    }
  ];

  console.log("\n▶ 2. Selección de activos visuales y generación de diapositivas cinematográficas...");
  const renderedSlides: string[] = [];
  const usedImages: string[] = [];

  for (const scene of scenes) {
    const slideOutput = path.join(tempDir, `fairy_scene_${scene.sceneIndex}.jpg`);
    const imgRes = await imageGenerator.generateImage(scene.prompt, {
      outputPath: slideOutput,
      sceneIndex: scene.sceneIndex,
      totalScenes: scenes.length,
      sceneTitle: scene.title,
      onScreenText: scene.onScreenText,
      subtitle: scene.narration,
      product: "fantasy_tales",
      usedImages,
    });

    console.log(`   [Escena ${scene.sceneIndex}]`);
    console.log(`   - Título: ${scene.title}`);
    console.log(`   - Imagen: ${imgRes.filePath}`);
    console.log(`   - Source Asset: ${imgRes.sourceAssetPath}`);
    console.log(`   - Proveedor: ${imgRes.provider}`);
    renderedSlides.push(imgRes.filePath);
    if (imgRes.sourceAssetPath) {
      usedImages.push(imgRes.sourceAssetPath);
    }
    usedImages.push(imgRes.filePath);
  }

  console.log("\n▶ 3. Síntesis de locución infantil cálida (Edge-TTS)...");
  const pacedAudio = await voiceStudio.generatePacedNarration(
    scenes.map(s => ({ sceneNumber: s.sceneIndex, narration: s.narration })),
    "Había una vez una hermosa historia en un reino de ensueño.",
    99999,
    { pauseSeconds: 0.4, tempo: 1.0 }
  );

  console.log(`   - Audio sintetizado: ${pacedAudio.audioPath}`);
  console.log(`   - Duración total: ${pacedAudio.totalDurationSeconds.toFixed(1)}s`);
  console.log(`   - Duraciones de escena:`, pacedAudio.sceneDurations);

  console.log("\n▶ 4. Ensamblaje de Video MP4 con FFmpeg...");
  const sceneMediaInputs: SceneMediaInput[] = scenes.map((s, idx) => ({
    sceneNumber: s.sceneIndex,
    narrationText: s.narration,
    imagePath: renderedSlides[idx],
    durationSeconds: pacedAudio.sceneDurations[idx] || 5.0,
  }));

  const assembledVideo = await videoAssembler.assembleVideo(
    sceneMediaInputs,
    pacedAudio.audioPath,
    "cuento_dragon_princesa_pixar.mp4",
    {
      width: 1280,
      height: 720,
    }
  );

  console.log(`   - Video MP4 creado: ${assembledVideo.videoPath}`);
  console.log(`   - Tamaño de archivo: ${(assembledVideo.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   - Duración: ${assembledVideo.durationSeconds}s`);
  console.log("\n🎉 TEST COMPLETADO CON ÉXITO ROTUNDO: Dragones, princesas, locución y video ensamblados!");
}

runFairyTaleTest().catch(console.error);
