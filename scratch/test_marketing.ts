import { scriptWriter } from "../src/marketing/services/scriptWriter.js";
import { imageGenerator } from "../src/marketing/services/imageGenerator.js";
import { marketingDb } from "../src/marketing/database.js";
import { MarketingDraft } from "../src/marketing/types.js";

async function runTest() {
  console.log("🧪 Test 1: Generación de Social Post...");
  const post = await scriptWriter.generateSocialPost("Las 3 claves de la IA en 2026 para automatizar negocios");
  console.log("✅ Post generado:", post.title);
  console.log("Hashtags:", post.hashtags);
  console.log("Image Prompt:", post.imagePrompt);

  console.log("\n🧪 Test 2: Generación de Imagen FLUX...");
  const imgPath = await imageGenerator.generateImage("Futuristic AI executive workspace, hyperrealistic, 8k cinematic lighting", { width: 640, height: 360 });
  console.log("✅ Imagen guardada en:", imgPath);

  console.log("\n🧪 Test 3: Guardado en SQLite de Marketing...");
  const draft: MarketingDraft = {
    id: "test-draft-001",
    userId: 1572946817,
    topic: "Las 3 claves de la IA en 2026",
    format: "social_post",
    status: "pending_review",
    socialContent: post,
    imageUrls: [imgPath],
    audioUrls: [],
    targetChannels: ["telegram_channel"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  marketingDb.saveDraft(draft);
  const retrieved = marketingDb.getDraft("test-draft-001");
  console.log("✅ Draft recuperado de SQLite:", retrieved?.id, retrieved?.topic, retrieved?.status);
}

runTest().catch(console.error);
