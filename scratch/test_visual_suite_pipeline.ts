import fs from "fs";
import path from "path";
import { visualAssetSelector } from "../src/marketing/services/visualAssetSelector.js";
import { imageGenerator } from "../src/marketing/services/imageGenerator.js";
import { slideRenderer } from "../src/marketing/services/slideRenderer.js";
import { voiceStudio } from "../src/marketing/services/voiceStudio.js";
import { videoAssembler } from "../src/marketing/services/videoAssembler.js";

async function runVisualSuiteTests() {
  console.log("================================================================================");
  console.log("🧪 TEST SUITE: SEPARACIÓN DE AGENTES Y COMPOSICIÓN FOTOGRÁFICA DE ALTA RESOLUCIÓN");
  console.log("================================================================================");

  const tempDir = path.resolve(process.cwd(), "temp/test_visual_suite");
  fs.mkdirSync(tempDir, { recursive: true });

  // --------------------------------------------------------------------------
  // TEST 1: Verificación de Aislamiento Estricto de Marcas en visualAssetSelector
  // --------------------------------------------------------------------------
  console.log("\n▶ TEST 1: Clasificación de Producto y Aislamiento Estricto de Marcas...");

  const testEvaTopic = "Cómo ayudar a tu hijo a pronunciar la erre con juegos de voz interactivos";
  const testCoreTopic = "Organiza tu semana en Google Calendar y registra tus gastos sin salir de Telegram";
  const testMktTopic = "Estrategia de contenidos en YouTube Shorts con ganchos de alta retención";

  const prodEva = visualAssetSelector.detectProduct(testEvaTopic);
  const prodCore = visualAssetSelector.detectProduct(testCoreTopic);
  const prodMkt = visualAssetSelector.detectProduct(testMktTopic);

  console.log(`  1.1 Eva Topic -> Detectado: "${prodEva}"`);
  console.log(`  1.2 CoreAgent Topic -> Detectado: "${prodCore}"`);
  console.log(`  1.3 Marketing Topic -> Detectado: "${prodMkt}"`);

  if (prodEva !== "eva" || prodCore !== "coreagent" || prodMkt !== "marketing") {
    throw new Error(`❌ Error en clasificación de productos: Eva=${prodEva}, Core=${prodCore}, Mkt=${prodMkt}`);
  }
  console.log("  ✅ Clasificación de productos 100% precisa.");

  // --------------------------------------------------------------------------
  // TEST 2: Composición Fotográfica Cinematográfica de EVA (Tercio Inferior)
  // --------------------------------------------------------------------------
  console.log("\n▶ TEST 2: Generación de Diapositiva Cinematográfica para EVA...");
  const evaSlidePath = path.join(tempDir, "eva_cinematic_slide.jpg");

  const evaImgRes = await imageGenerator.generateImage("Sesión clínica de logopedia y fonemas", {
    outputPath: evaSlidePath,
    sceneIndex: 1,
    totalScenes: 3,
    sceneTitle: "ARTICULACIÓN Y FONEMAS EN CASA",
    onScreenText: "ENTRENAMIENTO VOCAL LÚDICO",
    subtitle: "Ejercicios interactivos con 100% de privacidad local en el navegador.",
    product: "eva",
  });

  console.log(`  2.1 Diapositiva generada: ${evaImgRes.filePath} (Provider: ${evaImgRes.provider})`);
  const evaStat = fs.statSync(evaImgRes.filePath);
  console.log(`  2.2 Tamaño de archivo: ${(evaStat.size / 1024).toFixed(1)} KB`);

  if (evaStat.size < 10000) {
    throw new Error(`❌ El archivo de la diapositiva es sospechosamente pequeño: ${evaStat.size} bytes`);
  }
  console.log("  ✅ Diapositiva cinematográfica de Eva generada correctamente.");

  // --------------------------------------------------------------------------
  // TEST 3: Composición Fotográfica Cinematográfica de COREAGENT
  // --------------------------------------------------------------------------
  console.log("\n▶ TEST 3: Generación de Diapositiva Cinematográfica para COREAGENT...");
  const coreSlidePath = path.join(tempDir, "coreagent_cinematic_slide.jpg");

  const coreImgRes = await imageGenerator.generateImage("Reunión ejecutiva y agenda en Google Calendar", {
    outputPath: coreSlidePath,
    sceneIndex: 2,
    totalScenes: 3,
    sceneTitle: "TU CALENDARIO EN TELEGRAM",
    onScreenText: "AGENDA EJECUTIVA SIN ESTRÉS",
    subtitle: "Crea eventos y coordina reuniones directamente desde tu chat habitual.",
    product: "coreagent",
  });

  console.log(`  3.1 Diapositiva generada: ${coreImgRes.filePath} (Provider: ${coreImgRes.provider})`);
  const coreStat = fs.statSync(coreImgRes.filePath);
  console.log(`  3.2 Tamaño de archivo: ${(coreStat.size / 1024).toFixed(1)} KB`);

  // --------------------------------------------------------------------------
  // TEST 4: Composición Fotográfica Cinematográfica de MARKETING STUDIO
  // --------------------------------------------------------------------------
  console.log("\n▶ TEST 4: Generación de Diapositiva Cinematográfica para MARKETING STUDIO...");
  const mktSlidePath = path.join(tempDir, "mkt_cinematic_slide.jpg");

  const mktImgRes = await imageGenerator.generateImage("Métricas de retención y análisis de growth", {
    outputPath: mktSlidePath,
    sceneIndex: 3,
    totalScenes: 3,
    sceneTitle: "ANALÍTICA Y CRECIMIENTO ORGÁNICO",
    onScreenText: "RETENCIÓN Y ENGAGEMENT",
    subtitle: "Supervisión Human-in-the-Loop donde tú decides qué publicar con un clic.",
    product: "marketing",
  });

  console.log(`  4.1 Diapositiva generada: ${mktImgRes.filePath} (Provider: ${mktImgRes.provider})`);
  const mktStat = fs.statSync(mktImgRes.filePath);
  console.log(`  4.2 Tamaño de archivo: ${(mktStat.size / 1024).toFixed(1)} KB`);

  // --------------------------------------------------------------------------
  // TEST 5: Ensamblado Completo de Vídeo MP4 con Audio y Suite Visual
  // --------------------------------------------------------------------------
  console.log("\n▶ TEST 5: Ensamblado MP4 de Vídeo Completo con Audio Sincronizado para EVA...");

  const evaScenes = [
    { narration: "Bienvenidos a Eva. La plataforma interactiva de terapia del habla diseñada para niños y familias." },
    { narration: "Con juegos adaptativos, tu hijo practica la articulación de fonemas difíciles con una sonrisa." },
    { narration: "Y lo más importante... Cero grabaciones en la nube. Privacidad total y segura en tu navegador." },
  ];

  const pacedAudio = await voiceStudio.generatePacedNarration(evaScenes, undefined, 12345, {
    pauseSeconds: 0.35,
    tempo: 1.06,
  });

  console.log(`  5.1 Audio paced generado: ${pacedAudio.audioPath} (${pacedAudio.totalDurationSeconds}s)`);
  console.log(`  5.2 Duraciones por escena:`, pacedAudio.sceneDurations);

  const sceneMediaList = [
    {
      sceneNumber: 1,
      narrationText: evaScenes[0].text,
      imagePath: evaImgRes.filePath,
      durationSeconds: pacedAudio.sceneDurations[0],
    },
    {
      sceneNumber: 2,
      narrationText: evaScenes[1].text,
      imagePath: (await imageGenerator.generateImage("Juegos de fonemas y praxias linguales", {
        sceneIndex: 2,
        totalScenes: 3,
        sceneTitle: "JUEGOS FONÉTICOS ADAPTATIVOS",
        onScreenText: "PRONUNCIACIÓN Y JUEGO",
        subtitle: "Estimulación del habla sin presiones.",
        product: "eva",
      })).filePath,
      durationSeconds: pacedAudio.sceneDurations[1],
    },
    {
      sceneNumber: 3,
      narrationText: evaScenes[2].text,
      imagePath: (await imageGenerator.generateImage("Seguridad clínica y privacidad en casa", {
        sceneIndex: 3,
        totalScenes: 3,
        sceneTitle: "PRIVACIDAD 100% EN NAVEGADOR",
        onScreenText: "PROTECCIÓN Y TRANQUILIDAD",
        subtitle: "El audio nunca sale del dispositivo familiar.",
        product: "eva",
      })).filePath,
      durationSeconds: pacedAudio.sceneDurations[2],
    },
  ];

  const videoOut = path.join(tempDir, "eva_final_commercial_video.mp4");
  const videoResult = await videoAssembler.assembleVideo(
    sceneMediaList,
    pacedAudio.audioPath,
    videoOut,
    { width: 1280, height: 720 }
  );

  console.log(`  5.3 Vídeo final generado: ${videoResult.videoPath}`);
  console.log(`  5.4 Duración total: ${videoResult.durationSeconds}s, Escenas distintas: ${videoResult.distinctImageCount}`);

  const vStat = fs.statSync(videoResult.videoPath);
  console.log(`  5.5 Tamaño de archivo MP4: ${(vStat.size / 1024).toFixed(1)} KB`);

  console.log("\n================================================================================");
  console.log("🎉 TODOS LOS TESTS COMPLETADOS CON ÉXITO: 0 FALLOS");
  console.log("================================================================================");
}

runVisualSuiteTests().catch(err => {
  console.error("❌ Fallo crítico en tests de Suite Visual:", err);
  process.exit(1);
});
