import { telegramReview } from "../dist/marketing/telegramReview.js";
import fs from "fs";

async function testLongCaption() {
  const dummyFile = "./temp/test_dummy_img.jpg";
  if (!fs.existsSync("./temp")) fs.mkdirSync("./temp", { recursive: true });
  fs.writeFileSync(dummyFile, "fake image content");

  let photoSent = false;
  let messageSent = false;

  const mockBot = {
    api: {
      sendPhoto: async (chatId, photo, opts) => {
        photoSent = true;
        if (opts?.caption && opts.caption.length > 1024) {
          throw new Error("Caption too long!");
        }
        return { message_id: 101 };
      },
      sendMessage: async (chatId, text, opts) => {
        messageSent = true;
        return { message_id: 102 };
      },
      sendVoice: async () => {}
    }
  };

  const longDraft = {
    id: "draft_long_test",
    userId: 1572946817,
    topic: "Tema largo de prueba",
    format: "social_post",
    status: "pending_review",
    socialContent: {
      title: "Título de prueba muy largo",
      copy: "Este es un texto sumamente detallado y extenso que supera los mil caracteres. ".repeat(25),
      hashtags: ["#ia", "#sheets", "#facturas", "#marketing"],
      imagePrompt: "test",
      callToAction: "Visita silvania.ai"
    },
    imageUrls: [dummyFile],
    audioUrls: [],
    targetChannels: ["telegram_channel"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  console.log("Probando sendReviewCard con caption de más de 1000 caracteres...");
  await telegramReview.sendReviewCard(mockBot, longDraft);

  if (!photoSent || !messageSent) {
    throw new Error("Falla: Debieron enviarse tanto la foto como el mensaje de texto largo");
  }

  console.log("✅ sendReviewCard manejó el texto largo perfectamente sin error de caption!");
  try { fs.unlinkSync(dummyFile); } catch {}
}

testLongCaption().catch(err => {
  console.error("❌ Error en test de caption largo:", err);
  process.exit(1);
});
