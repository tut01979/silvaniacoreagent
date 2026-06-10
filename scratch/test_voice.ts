import { ttsSave } from "edge-tts";
import path from "path";
import fs from "fs";

async function test() {
  try {
    const tempDir = "./temp_test";
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const filePath = path.join(tempDir, "test.mp3");
    
    console.log("Generando audio de prueba...");
    await ttsSave("Hola, esto es una prueba de voz.", filePath, {
      voice: "es-ES-AlvaroNeural"
    });
    
    if (fs.existsSync(filePath)) {
      console.log("✅ Audio generado con éxito en:", filePath);
    } else {
      console.log("❌ El archivo no se creó.");
    }
  } catch (error: any) {
    console.error("❌ Error en el test:", error.message);
  }
}

test();
