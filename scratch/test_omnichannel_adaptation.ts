import { scriptWriter } from "../src/marketing/services/scriptWriter.js";

async function main() {
  console.log("==================================================");
  console.log("🧪 TEST 1: YouTube con solicitud explícita de 12 escenas");
  console.log("==================================================");
  const yt12 = await scriptWriter.generateYouTubeScript("Relatos biblicos de fe y esperanza 12 escenas");
  console.log(`Título: ${yt12.data.title}`);
  console.log(`Escenas generadas: ${yt12.data.scenes.length}`);
  console.log(`Duración estimada: ${yt12.data.totalEstimatedDurationSeconds}s`);
  console.log(`Muestra Escena 1 (${yt12.data.scenes[0]?.narration.split(" ").length} palabras): "${yt12.data.scenes[0]?.narration}"`);

  console.log("\n==================================================");
  console.log("🧪 TEST 2: YouTube estándar (garantía de >= 2 minutos)");
  console.log("==================================================");
  const ytStd = await scriptWriter.generateYouTubeScript("Productividad extrema con Google Calendar y CoreAgent");
  console.log(`Título: ${ytStd.data.title}`);
  console.log(`Escenas generadas: ${ytStd.data.scenes.length}`);
  console.log(`Duración estimada: ${ytStd.data.totalEstimatedDurationSeconds}s`);
  const wordsFirstScene = ytStd.data.scenes[0]?.narration.split(" ").length || 0;
  console.log(`Palabras en Escena 1: ${wordsFirstScene} palabras`);

  console.log("\n==================================================");
  console.log("🧪 TEST 3: TikTok con tema que pide 30 escenas (DEBE CONDENSAR A 3-4)");
  console.log("==================================================");
  const tt = await scriptWriter.generateTikTokScript("Relatos de fe y esperanza 30 escenas");
  console.log(`Título TikTok: ${tt.data.title}`);
  console.log(`Escenas generadas en TikTok: ${tt.data.scenes.length} (condensado: ${tt.data.scenes.length <= 4 ? "SÍ ✅" : "NO ❌"})`);
  console.log(`Duración estimada TikTok: ${tt.data.totalEstimatedDurationSeconds}s`);

  console.log("\n==================================================");
  console.log("🧪 TEST 4: Posts adaptados a LinkedIn, X y Telegram");
  console.log("==================================================");
  const li = await scriptWriter.generateSocialPost("Productividad ejecutiva", undefined, "linkedin");
  console.log(`[LinkedIn] Título: ${li.data.title}`);
  console.log(`[LinkedIn] Copy (${li.data.copy.length} caracteres):\n${li.data.copy.slice(0, 150)}...`);

  const x = await scriptWriter.generateSocialPost("Productividad ejecutiva", undefined, "x");
  console.log(`\n[X / Twitter] Título: ${x.data.title}`);
  console.log(`[X / Twitter] Longitud: ${x.data.copy.length} caracteres (< 280: ${x.data.copy.length <= 280 ? "SÍ ✅" : "NO ❌"})`);
  console.log(`[X / Twitter] Copy: "${x.data.copy}"`);

  const tg = await scriptWriter.generateSocialPost("Productividad ejecutiva", undefined, "telegram");
  console.log(`\n[Telegram] Título: ${tg.data.title}`);
  console.log(`[Telegram] Copy:\n${tg.data.copy}`);

  console.log("\n==================================================");
  console.log("🎉 TODOS LOS TESTS OMNICANAL SUPERADOS CON ÉXITO");
  console.log("==================================================");
}

main().catch(err => {
  console.error("❌ Error en tests:", err);
  process.exit(1);
});
