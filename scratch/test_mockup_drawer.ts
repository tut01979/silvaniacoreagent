import fs from "fs";
import path from "path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

// Registrar fuentes del repositorio
const boldFontPath = path.resolve("src/marketing/assets/fonts/Silvania-Bold.ttf");
const regularFontPath = path.resolve("src/marketing/assets/fonts/Silvania-Regular.ttf");
if (fs.existsSync(boldFontPath)) GlobalFonts.registerFromPath(boldFontPath, "SilvaniaBold");
if (fs.existsSync(regularFontPath)) GlobalFonts.registerFromPath(regularFontPath, "SilvaniaRegular");

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function test() {
  const canvas = createCanvas(1280, 720);
  const ctx = canvas.getContext("2d");

  // Fondo
  const grad = ctx.createLinearGradient(0, 0, 1280, 720);
  grad.addColorStop(0, "#090D16");
  grad.addColorStop(1, "#1E1B4B");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);

  // Tarjeta principal
  ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
  roundRect(ctx, 80, 60, 1120, 600, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Badge
  ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
  roundRect(ctx, 130, 105, 220, 34, 17);
  ctx.fill();
  ctx.fillStyle = "#38BDF8";
  ctx.font = "bold 15px SilvaniaBold";
  ctx.textBaseline = "middle";
  ctx.fillText("ESCENA 1 DE 3 · TELEGRAM", 150, 122);

  // Título
  ctx.font = "bold 44px SilvaniaBold";
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "top";
  ctx.fillText("AGENDA EN TELEGRAM", 130, 160);

  // Subtítulo
  ctx.font = "22px SilvaniaRegular";
  ctx.fillStyle = "#94A3B8";
  ctx.fillText("Gestiona citas y eventos al instante con lenguaje natural.", 130, 230);

  // Mockup Telegram a la derecha
  const mx = 700, my = 150, mw = 440, mh = 380;
  ctx.fillStyle = "rgba(30, 41, 59, 0.90)";
  roundRect(ctx, mx, my, mw, mh, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
  ctx.stroke();

  // Header Telegram
  ctx.fillStyle = "#0284C7";
  roundRect(ctx, mx, my, mw, 50, 16);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 16px SilvaniaBold";
  ctx.fillText("Telegram · @Silvania_Core_Agent_Bot", mx + 20, my + 15);

  // Mensaje usuario
  ctx.fillStyle = "#0369A1";
  roundRect(ctx, mx + 80, my + 75, 340, 55, 12);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "15px SilvaniaRegular";
  ctx.fillText("Crea reunión mañana a las 10am", mx + 95, my + 92);

  // Mensaje bot
  ctx.fillStyle = "#1E293B";
  roundRect(ctx, mx + 20, my + 150, 380, 80, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.stroke();
  ctx.fillStyle = "#34D399";
  ctx.font = "bold 15px SilvaniaBold";
  ctx.fillText("✅ Evento creado en Google Calendar", mx + 35, my + 165);
  ctx.fillStyle = "#CBD5E1";
  ctx.font = "14px SilvaniaRegular";
  ctx.fillText("Mañana · 10:00 - 11:00 AM · Google Meet", mx + 35, my + 195);

  fs.writeFileSync("temp/test_mockup_slide.jpg", canvas.toBuffer("image/jpeg", 92));
  console.log("Mockup test size:", fs.statSync("temp/test_mockup_slide.jpg").size);
}

test().catch(console.error);
