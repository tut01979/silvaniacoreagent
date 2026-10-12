import fs from "fs";
import { slideRenderer } from "../src/marketing/services/slideRenderer.js";

async function main() {
  console.log("🚀 Probando slideRenderer...");
  const res = await slideRenderer.renderSceneSlide({
    sceneIndex: 1,
    totalScenes: 3,
    title: "¡Adiós al Caos! Centraliza tu Google Workspace",
    onScreenText: "Gestiona calendario, correos y hojas de cálculo sin salir de Telegram.",
  });

  console.log("✅ Resultado:", res);
  const exists = fs.existsSync(res.filePath);
  const size = exists ? fs.statSync(res.filePath).size : 0;
  console.log("📁 Archivo existe:", exists, "Tamaño:", size, "bytes");

  // Prueba escena 2
  const res2 = await slideRenderer.renderSceneSlide({
    sceneIndex: 2,
    totalScenes: 3,
    title: "Automatiza Tareas en Segundos",
    onScreenText: "Crea citas y registra gastos con un simple mensaje.",
  });
  console.log("✅ Escena 2:", res2);

  // Prueba escena 3
  const res3 = await slideRenderer.renderSceneSlide({
    sceneIndex: 3,
    totalScenes: 3,
    title: "Productividad Ejecutiva con Silvania",
    onScreenText: "Tu asistente inteligente en Telegram. silvania.ai",
  });
  console.log("✅ Escena 3:", res3);
}

main().catch(console.error);
