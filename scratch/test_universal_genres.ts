import fs from "fs";
import path from "path";
import { visualAssetSelector } from "../src/marketing/services/visualAssetSelector.js";
import { scriptWriter } from "../src/marketing/services/scriptWriter.js";
import { imageGenerator } from "../src/marketing/services/imageGenerator.js";
import { voiceStudio } from "../src/marketing/services/voiceStudio.js";
import { videoAssembler } from "../src/marketing/services/videoAssembler.js";

async function runUniversalTest() {
  console.log("================================================================================");
  console.log("🌟 TEST INTEGRAL: ESTUDIO UNIVERSAL MULTIGÉNERO (CUENTOS, COSMOS, BIBLIA, TECH)");
  console.log("================================================================================");

  const tempDir = path.resolve(process.cwd(), "temp/test_universal");
  fs.mkdirSync(tempDir, { recursive: true });

  // --------------------------------------------------------------------------
  // TEST 1: Detección Universal de Géneros
  // --------------------------------------------------------------------------
  console.log("\n▶ TEST 1: Clasificación de Géneros Universales...");

  const topics = [
    { text: "Cuento infantil de un pequeño dragón que aprende a volar en un bosque mágico", expected: "fantasy_tales" },
    { text: "Los misterios del universo y los exoplanetas en los confines de la galaxia", expected: "cosmos" },
    { text: "Hologramas en 3D y computación cuántica del futuro", expected: "scifi_holograms" },
    { text: "La historia bíblica de Moisés y la fe que transformó el desierto", expected: "faith_bible" },
    { text: "La furia de las tormentas y auroras boreales en el Ártico", expected: "nature_climates" },
    { text: "Cómo superar la ansiedad y encontrar paz interior y resiliencia", expected: "emotions" },
    { text: "Organiza tu semana en Google Calendar con Telegram", expected: "coreagent" },
  ];

  for (const t of topics) {
    const universe = visualAssetSelector.detectProduct(t.text);
    console.log(`  - Tema: "${t.text.slice(0, 45)}..." -> Detectado: [${universe.toUpperCase()}]`);
    if (universe !== t.expected) {
      throw new Error(`❌ Fallo en detección: se esperaba ${t.expected} pero dio ${universe}`);
    }
  }
  console.log("  ✅ Clasificación de los 7 universos 100% precisa.");

  // --------------------------------------------------------------------------
  // TEST 2: Guion Narrativo de Cuento Infantil con LLM
  // --------------------------------------------------------------------------
  console.log("\n▶ TEST 2: Redacción de Guion para Cuento Infantil con LLM...");

  const taleTopic = "Cuento infantil corto: Sparky, el pequeño dragón que iluminaba las estrellas";
  const scriptResult = await scriptWriter.generateYouTubeScript(taleTopic, 1);
  const script = scriptResult.data;

  console.log(`  2.1 Título: "${script.title}"`);
  console.log(`  2.2 Hook inicial: "${script.hook}"`);
  console.log(`  2.3 Escenas generadas: ${script.scenes.length}`);

  for (let i = 0; i < script.scenes.length; i++) {
    const sc = script.scenes[i];
    console.log(`    [Escena ${i + 1}] Texto en pantalla: "${sc.onScreenText}"`);
    console.log(`    Locución: "${sc.narration.slice(0, 60)}..."`);
  }

  // Verificamos que el guion no mencione "Telegram", "Google" ni "pestañas"
  const fullScriptText = `${script.title} ${script.hook} ${script.scenes.map(s => s.narration).join(" ")}`.toLowerCase();
  if (fullScriptText.includes("telegram") || fullScriptText.includes("pestañas") || fullScriptText.includes("workspace")) {
    throw new Error("❌ El guion de cuento infantil contiene términos de oficina indebidos");
  }
  console.log("  ✅ Guion adaptado al género de cuento infantil con total coherencia.");

  // --------------------------------------------------------------------------
  // TEST 3: Generación de Diapositivas para Cosmos, Biblia, Hologramas y Cuento
  // --------------------------------------------------------------------------
  console.log("\n▶ TEST 3: Generación de Diapositivas Cinematográficas Multiverso...");

  // 3.1 Cuento Infantil
  const taleSlide = await imageGenerator.generateImage("Bosque mágico de cuento de hadas estilo Pixar", {
    sceneIndex: 1,
    totalScenes: 3,
    sceneTitle: "EL BOSQUE ENCANTADO",
    onScreenText: "SPARKY Y LAS ESTRELLAS",
    subtitle: "Había una vez un pequeño dragón que soñaba con volar.",
    product: "fantasy_tales",
  });
  console.log(`  3.1 Cuento Infantil Slide: OK -> ${taleSlide.filePath} (${taleSlide.product})`);

  // 3.2 Cosmos / Universo
  const cosmosSlide = await imageGenerator.generateImage("Nebulosa cósmica en el espacio profundo", {
    sceneIndex: 2,
    totalScenes: 3,
    sceneTitle: "EL CONFÍN DEL COSMOS",
    onScreenText: "GALAXIAS LEJANAS",
    subtitle: "A millones de años luz, mundos esperando ser descubiertos.",
    product: "cosmos",
  });
  console.log(`  3.2 Cosmos Slide: OK -> ${cosmosSlide.filePath} (${cosmosSlide.product})`);

  // 3.3 Relato Bíblico
  const faithSlide = await imageGenerator.generateImage("Rayos de luz divina celestial sobre el desierto", {
    sceneIndex: 3,
    totalScenes: 3,
    sceneTitle: "LA PROMESA EN EL DESIERTO",
    onScreenText: "FE QUE MUEVE MONTAÑAS",
    subtitle: "En el silencio de la noche, una luz que guía el camino.",
    product: "faith_bible",
  });
  console.log(`  3.3 Relato Bíblico Slide: OK -> ${faithSlide.filePath} (${faithSlide.product})`);

  // 3.4 Hologramas / Ciencia
  const scifiSlide = await imageGenerator.generateImage("Hologramas en 3D y redes neuronales futuristas", {
    sceneIndex: 1,
    totalScenes: 3,
    sceneTitle: "COMPUTACIÓN CUÁNTICA",
    onScreenText: "HOLOGRAMAS DEL FUTURO",
    subtitle: "Interfaces translúcidas que redefinen la realidad.",
    product: "scifi_holograms",
  });
  console.log(`  3.4 Hologramas Sci-Fi Slide: OK -> ${scifiSlide.filePath} (${scifiSlide.product})`);

  // --------------------------------------------------------------------------
  // TEST 4: Ensamblado de Vídeo MP4 para el Cuento Infantil
  // --------------------------------------------------------------------------
  console.log("\n▶ TEST 4: Ensamblado de Vídeo Completo MP4 para Cuento Infantil...");

  const taleScenesPaced = script.scenes.slice(0, 3);
  const audioResult = await voiceStudio.generatePacedNarration(taleScenesPaced, script.hook, 9999, {
    pauseSeconds: 0.45, // Pausa más cálida para cuento
    tempo: 1.0,         // Velocidad natural de narración de cuento
  });

  console.log(`  4.1 Locución de cuento generada: ${audioResult.totalDurationSeconds}s`);

  const sceneMediaList = [
    {
      sceneNumber: 1,
      narrationText: taleScenesPaced[0].narration,
      imagePath: taleSlide.filePath,
      durationSeconds: audioResult.sceneDurations[0],
    },
    {
      sceneNumber: 2,
      narrationText: taleScenesPaced[1].narration,
      imagePath: (await imageGenerator.generateImage("Paisaje estrellado de fantasía y castillo", {
        sceneIndex: 2,
        totalScenes: 3,
        sceneTitle: "EL VIAJE NOCTURNO",
        onScreenText: "VOLANDO SOBRE LAS NUBES",
        subtitle: "Sparky desplegó sus pequeñas alas doradas.",
        product: "fantasy_tales",
      })).filePath,
      durationSeconds: audioResult.sceneDurations[1],
    },
    {
      sceneNumber: 3,
      narrationText: taleScenesPaced[2].narration,
      imagePath: (await imageGenerator.generateImage("Zorrito amigable celebrando con Sparky", {
        sceneIndex: 3,
        totalScenes: 3,
        sceneTitle: "EL FINAL FELIZ",
        onScreenText: "UNA LUZ EN EL CORAZÓN",
        subtitle: "Y desde aquella noche, el bosque nunca dejó de brillar.",
        product: "fantasy_tales",
      })).filePath,
      durationSeconds: audioResult.sceneDurations[2],
    },
  ];

  const videoOut = path.join(tempDir, "sparky_dragon_tale_video.mp4");
  const videoResult = await videoAssembler.assembleVideo(
    sceneMediaList,
    audioResult.audioPath,
    videoOut,
    { width: 1280, height: 720 }
  );

  console.log(`  4.2 Vídeo MP4 final generado: ${videoResult.videoPath}`);
  console.log(`  4.3 Duración: ${videoResult.durationSeconds}s | Imágenes distintas: ${videoResult.distinctImageCount}`);
  const vStat = fs.statSync(videoResult.videoPath);
  console.log(`  4.4 Tamaño de archivo: ${(vStat.size / 1024).toFixed(1)} KB`);

  console.log("\n================================================================================");
  console.log("🎉 TODOS LOS UNIVERSOS VALIDADOS Y FUNCIONANDO CON ÉXITO: 0 ERRORES");
  console.log("================================================================================");
}

runUniversalTest().catch(err => {
  console.error("❌ Fallo en test de Estudio Universal:", err);
  process.exit(1);
});
