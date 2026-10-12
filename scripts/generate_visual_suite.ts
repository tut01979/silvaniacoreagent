import fs from "fs";
import path from "path";
import axios from "axios";
import { VisualCatalogItem } from "./build_visual_suite_catalog.js";

/**
 * Script de generación/descarga por lotes para la suite de 300 imágenes comerciales.
 * Lee src/marketing/assets/visualLibraryCatalog.json y genera las imágenes
 * en sus respectivas carpetas por producto y categoría.
 * 
 * Uso:
 *   npx tsx scripts/generate_visual_suite.ts [--product=eva|coreagent|marketing] [--limit=5] [--provider=pollinations]
 */
async function run() {
  const catalogPath = path.resolve(process.cwd(), "src/marketing/assets/visualLibraryCatalog.json");
  if (!fs.existsSync(catalogPath)) {
    console.error("❌ No se encontró visualLibraryCatalog.json. Ejecuta primero build_visual_suite_catalog.ts");
    process.exit(1);
  }

  const catalog: VisualCatalogItem[] = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
  
  // Parámetros por CLI
  const args = process.argv.slice(2);
  const productArg = args.find(a => a.startsWith("--product="))?.split("=")[1];
  const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] || "0");

  let itemsToGenerate = catalog;
  if (productArg) {
    itemsToGenerate = itemsToGenerate.filter(it => it.product === productArg.toLowerCase());
  }
  if (limitArg > 0) {
    itemsToGenerate = itemsToGenerate.slice(0, limitArg);
  }

  console.log(`🚀 Iniciando generación para ${itemsToGenerate.length} elementos de la suite...`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < itemsToGenerate.length; i++) {
    const item = itemsToGenerate[i];
    const targetDir = path.resolve(process.cwd(), "src/marketing/assets/visuals", item.product, item.category);
    fs.mkdirSync(targetDir, { recursive: true });

    const targetFile = path.join(targetDir, `${item.id}.jpg`);

    if (fs.existsSync(targetFile)) {
      console.log(`⏭️ [${i + 1}/${itemsToGenerate.length}] Ya existe: ${item.id} (${item.product}/${item.category})`);
      skipCount++;
      continue;
    }

    console.log(`🎨 [${i + 1}/${itemsToGenerate.length}] Generando ${item.id} [${item.product}]...`);
    const encodedPrompt = encodeURIComponent(item.prompt);
    const seed = Math.floor(Math.random() * 900000) + 100000;
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&model=flux&seed=${seed}&nologo=true`;

    try {
      const resp = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 25000,
      });

      if (resp.status === 200 && resp.data && resp.data.length > 5000) {
        fs.writeFileSync(targetFile, resp.data);
        console.log(`  ✅ Guardada: ${targetFile} (${(resp.data.length / 1024).toFixed(1)} KB)`);
        successCount++;
      } else {
        console.warn(`  ⚠️ Respuesta inesperada para ${item.id}: status ${resp.status}`);
        errorCount++;
      }
    } catch (err: any) {
      console.warn(`  ❌ Error descargando ${item.id}:`, err.message);
      errorCount++;
    }

    // Pausa breve para evitar límites de tasa
    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`\n🏁 Resumen de generación de Suite Visual:`);
  console.log(`  ✅ Nuevas generadas: ${successCount}`);
  console.log(`  ⏭️ Ya existentes: ${skipCount}`);
  console.log(`  ❌ Fallidas: ${errorCount}`);
}

run().catch(err => {
  console.error("Error ejecutando suite generator:", err);
  process.exit(1);
});
