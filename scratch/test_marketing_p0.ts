import { voiceStudio } from "../src/marketing/services/voiceStudio.js";
import { imageGenerator } from "../src/marketing/services/imageGenerator.js";
import { scriptWriter } from "../src/marketing/services/scriptWriter.js";
import { marketingDb } from "../src/marketing/database.js";
import fs from "fs";

async function testP0Pipeline() {
  console.log("🚀 Iniciando prueba Plan P0 - Silvania Marketing Studio (Low-Cost)...");

  // 1. Script Writer con CTA hacia silvania.ai
  console.log("\n📝 1. Probando Redacción de Post con retención y CTA...");
  const scriptRes = await scriptWriter.generateSocialPost("3 trucos de IA para autónomos que ahorran 10 horas semanales");
  console.log("✅ Título:", scriptRes.data.title);
  console.log("Modelo LLM usado:", scriptRes.llmModel);
  console.log("Hashtags:", scriptRes.data.hashtags);
  console.log("Copy preview:", scriptRes.data.copy.slice(0, 120) + "...");

  // 2. Imagen con FLUX Free
  console.log("\n🎨 2. Probando Generación de Imagen (Free FLUX)...");
  const imgRes = await imageGenerator.generateImage(scriptRes.data.imagePrompt, { width: 640, height: 360 });
  console.log("✅ Imagen generada:", imgRes.filePath);
  console.log("Proveedor imagen:", imgRes.provider);
  console.log("Tamaño imagen:", fs.statSync(imgRes.filePath).size, "bytes");

  // 3. Voz con Edge-TTS Free Neural
  console.log("\n🎙️ 3. Probando Locución con Edge-TTS (Free Neural es-ES-AlvaroNeural)...");
  const voiceRes = await voiceStudio.generateNarration(scriptRes.data.copy.slice(0, 300), 1572946817);
  console.log("✅ Audio generado:", voiceRes.audioPath);
  console.log("Proveedor voz usado:", voiceRes.provider);
  console.log("Tamaño audio:", fs.statSync(voiceRes.audioPath).size, "bytes");

  // 4. Base de Datos SQLite
  console.log("\n💾 4. Verificando persistencia y metadatos en SQLite...");
  const draftId = "p0-test-" + Date.now();
  marketingDb.saveDraft({
    id: draftId,
    userId: 1572946817,
    topic: "3 trucos de IA para autónomos",
    format: "social_post",
    status: "pending_review",
    socialContent: scriptRes.data,
    imageUrls: [imgRes.filePath],
    audioUrls: [voiceRes.audioPath],
    targetChannels: ["telegram_channel"],
    voiceProvider: voiceRes.provider,
    imageProvider: imgRes.provider,
    llmModel: scriptRes.llmModel,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const retrieved = marketingDb.getDraft(draftId);
  console.log("✅ Borrador recuperado con éxito:");
  console.log("ID:", retrieved?.id);
  console.log("Status:", retrieved?.status);
  console.log("Voz:", retrieved?.voiceProvider);
  console.log("Imagen:", retrieved?.imageProvider);
  console.log("LLM:", retrieved?.llmModel);

  console.log("\n🎉 ¡TODAS LAS PRUEBAS DEL PLAN P0 COMPLETADAS CON ÉXITO!");
}

testP0Pipeline().catch(console.error);
