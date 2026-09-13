import { marketingDb } from "../dist/marketing/database.js";
import { telegramReview } from "../dist/marketing/telegramReview.js";
import { config } from "../dist/config/config.js";

async function runTests() {
  console.log("=== 1. TEST NON-ADMIN ACCESS REJECTION ===");
  let answeredText = "";
  const nonAdminCtx = {
    callbackQuery: { data: "mkt_pub_test123" },
    from: { id: 9999999 }, // non-admin
    answerCallbackQuery: async (opts) => { answeredText = opts.text; },
    reply: async () => {},
    editMessageReplyMarkup: async () => {}
  };
  const mockBot = { api: { sendMessage: async () => {}, sendPhoto: async () => {} } };

  const handled = await telegramReview.handleCallback(mockBot, nonAdminCtx);
  if (!handled || !answeredText.includes("No tienes permisos")) {
    throw new Error("Falla: Un usuario no admin pudo interactuar con marketing");
  }
  console.log("✅ Acceso no admin bloqueado correctamente:", answeredText);

  console.log("\n=== 2. TEST APPROVE WITHOUT CHANNEL CONFIGURED (approved_saved) ===");
  const testDraftId = "draft_test_no_channel";
  const dummyDraft = {
    id: testDraftId,
    userId: 1572946817,
    topic: "Test Topic",
    format: "social_post",
    status: "pending_review",
    socialContent: {
      title: "Título de Prueba",
      copy: "Contenido de prueba",
      hashtags: ["#ia", "#test"],
      imagePrompt: "test",
      callToAction: "Visita silvania.ai"
    },
    imageUrls: [],
    audioUrls: [],
    targetChannels: ["telegram_channel"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  marketingDb.saveDraft(dummyDraft);

  // Asegurar que telegramChannelId está vacío
  const originalChannelId = config.marketing.telegramChannelId;
  config.marketing.telegramChannelId = "";

  let adminReply = "";
  const adminCtx = {
    callbackQuery: { data: `mkt_pub_${testDraftId}` },
    from: { id: 1572946817 },
    answerCallbackQuery: async (opts) => { answeredText = opts.text; },
    reply: async (text) => { adminReply = text; },
    editMessageReplyMarkup: async () => {}
  };

  await telegramReview.handleCallback(mockBot, adminCtx);
  const updatedDraft = marketingDb.getDraft(testDraftId);

  if (updatedDraft?.status !== "approved_saved") {
    throw new Error(`Falla: Estado esperado 'approved_saved', pero fue '${updatedDraft?.status}'`);
  }
  if (!adminReply.includes("APROBADO Y GUARDADO") || !adminReply.includes("MARKETING_TELEGRAM_CHANNEL_ID")) {
    throw new Error("Falla: El mensaje de guardado sin canal no contiene las instrucciones correctas");
  }
  console.log("✅ Aprobación sin canal configurado guardó en SQLite correctamente (approved_saved)");

  console.log("\n=== 3. TEST APPROVE WITH CHANNEL CONFIGURED (published) ===");
  const testDraftId2 = "draft_test_with_channel";
  const dummyDraft2 = {
    id: testDraftId2,
    userId: 1572946817,
    topic: "Test Topic 2",
    format: "social_post",
    status: "pending_review",
    socialContent: {
      title: "Post para Canal",
      copy: "Texto publicado",
      hashtags: ["#prod"],
      imagePrompt: "test",
      callToAction: "Link"
    },
    imageUrls: [],
    audioUrls: [],
    targetChannels: ["telegram_channel"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  marketingDb.saveDraft(dummyDraft2);

  // Simular canal configurado
  config.marketing.telegramChannelId = "-100987654321";
  config.marketing.telegramChannelUrl = "https://t.me/silvania_ai";

  let sentToChannel = false;
  let channelTargetId = "";
  const channelMockBot = {
    api: {
      sendMessage: async (chatId, text) => {
        sentToChannel = true;
        channelTargetId = chatId;
        return { message_id: 42 };
      }
    }
  };

  const adminCtx2 = {
    callbackQuery: { data: `mkt_pub_${testDraftId2}` },
    from: { id: 1572946817 },
    answerCallbackQuery: async (opts) => {},
    reply: async (text) => { adminReply = text; },
    editMessageReplyMarkup: async () => {}
  };

  await telegramReview.handleCallback(channelMockBot, adminCtx2);
  const updatedDraft2 = marketingDb.getDraft(testDraftId2);

  if (updatedDraft2?.status !== "published" || !updatedDraft2.channelPublished || updatedDraft2.channelMessageId !== 42) {
    throw new Error("Falla: El borrador no se marcó como published o faltan metadatos de canal");
  }
  if (!sentToChannel || channelTargetId !== "-100987654321") {
    throw new Error("Falla: No se envió al canal ID correcto");
  }
  if (!adminReply.includes("https://t.me/silvania_ai/42")) {
    throw new Error("Falla: No se incluyó el enlace al post del canal en la confirmación al admin");
  }
  console.log("✅ Aprobación con canal configurado publicó correctamente:", adminReply);

  // Restaurar config original
  config.marketing.telegramChannelId = originalChannelId;

  console.log("\n🎉 TODOS LOS TESTS DE CANAL VITRINA Y MARKETING PASARON EXITOSAMENTE!");
}

runTests().catch(err => {
  console.error("❌ ERROR EN EL TEST:", err);
  process.exit(1);
});
