import { voiceService } from "../src/services/voice.js";
import fs from "fs";

async function testRealVoice() {
  try {
    console.log("Generando voz con el voiceService real de Silvania...");
    const files = await voiceService.textToSpeech("Hola, esto es una prueba real del motor de voz de Silvania.", 9999);
    console.log("Archivos generados:", files);
    for (const f of files) {
      if (fs.existsSync(f)) {
        console.log(`✅ Archivo verificado y existente: ${f}`);
        fs.unlinkSync(f); // cleanup
      } else {
        console.log(`❌ Archivo faltante: ${f}`);
      }
    }
  } catch (err: any) {
    console.error("❌ Fallo en testRealVoice:", err.message);
  }
}

testRealVoice();
