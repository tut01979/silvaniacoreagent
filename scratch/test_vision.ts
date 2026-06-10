import { llmService } from "../src/services/llm.js";
import fs from "fs";
import path from "path";

async function test() {
  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const imagePath = path.join(tempDir, "test_pixel.png");
  // 1x1 red png
  const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  fs.writeFileSync(imagePath, Buffer.from(base64Data, "base64"));

  console.log("📸 Iniciando prueba de visión con imagen:", imagePath);
  try {
    const res = await llmService.analyzeImage([], imagePath);
    console.log("✅ Respuesta de la API de visión:");
    console.log(res);
  } catch (err) {
    console.error("❌ Excepción no capturada en test:", err);
  } finally {
    try { if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath); } catch {}
  }
}

test().catch(err => {
  console.error("Fatal:", err);
});
