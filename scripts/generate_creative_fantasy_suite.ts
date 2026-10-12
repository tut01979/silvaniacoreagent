import fs from "fs";
import path from "path";
import axios from "axios";

const TARGET_DIR = path.resolve(process.cwd(), "src/marketing/assets/visuals/fantasy_tales");

const CREATIVE_ASSETS = [
  {
    filename: "fantasy_dragon_baby_fire_01.jpg",
    prompt: "Cute adorable baby dragon with tiny scales and wings breathing a tiny glowing spark of magical fire, Pixar 3D animation style, Disney Pixar movie render, enchanting magical forest background, warm volumetric lighting, vibrant colors, 8k, no text"
  },
  {
    filename: "fantasy_dragon_majestic_fly_02.jpg",
    prompt: "Friendly majestic green and gold dragon flying over enchanted mountain kingdom, Pixar 3D animation style, Disney Pixar render, whimsical clouds, cinematic sunset, 8k, no text"
  },
  {
    filename: "fantasy_princess_golden_castle_01.jpg",
    prompt: "Beautiful brave fairy tale princess with golden tiara, flowing hair and elegant royal gown in front of magical glowing castle, Pixar 3D animation style, Disney Pixar movie render, bright expressive eyes, vibrant colors, 8k, no text"
  },
  {
    filename: "fantasy_princess_dragon_friend_02.jpg",
    prompt: "Cute fairy tale princess gently petting a friendly cute baby dragon, magical castle courtyard, Pixar 3D animation style, Disney Pixar render, heartwarming scene, warm lighting, 8k, no text"
  }
];

async function generate() {
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  console.log("🎨 Generando activos locales esenciales de Dragones y Princesas...");

  for (const asset of CREATIVE_ASSETS) {
    const filePath = path.join(TARGET_DIR, asset.filename);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 5000) {
      console.log(`✅ Ya existe: ${asset.filename}`);
      continue;
    }

    const encodedPrompt = encodeURIComponent(asset.prompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;
    console.log(`⏳ Descargando: ${asset.filename}...`);

    try {
      const resp = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 25000,
        headers: {
          "User-Agent": "SilvaniaMarketingStudio/1.2"
        }
      });

      if (resp.data && resp.data.byteLength > 2000) {
        fs.writeFileSync(filePath, Buffer.from(resp.data));
        console.log(`🎉 Guardado con éxito: ${asset.filename} (${resp.data.byteLength} bytes)`);
      }
    } catch (err: any) {
      console.warn(`⚠️ Error al generar ${asset.filename}:`, err.message);
    }
  }

  console.log("🏁 Proceso completado.");
}

generate();
