import { runGog } from "../src/tools/gogWrapper.js";

async function testDownload() {
  try {
    // 1. crear archivo
    const upRes = await runGog(`drive upload "package.json" --json`);
    const parsed = JSON.parse(upRes);
    const id = parsed.file.id;
    console.log("Subido. ID:", id);

    // 2. descargar archivo
    console.log("Descargando...");
    await runGog(`drive download ${id} --out="temp_test.json"`);
    console.log("✅ Descargado");

  } catch (err: any) {
    console.error("❌ ERROR:", err.message);
  }
}
testDownload();
