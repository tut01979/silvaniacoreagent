import fs from "fs";
import path from "path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

// 1. Registro obligatorio de fuentes tipográficas del repositorio (garantiza texto nítido en Railway Linux y Windows)
const boldFontPath = path.resolve(process.cwd(), "src/marketing/assets/fonts/Silvania-Bold.ttf");
const regularFontPath = path.resolve(process.cwd(), "src/marketing/assets/fonts/Silvania-Regular.ttf");

let fontsLoaded = false;
function ensureFontsRegistered() {
  if (fontsLoaded) return;
  try {
    if (fs.existsSync(boldFontPath)) {
      GlobalFonts.registerFromPath(boldFontPath, "SilvaniaBold");
    }
    if (fs.existsSync(regularFontPath)) {
      GlobalFonts.registerFromPath(regularFontPath, "SilvaniaRegular");
    }
    fontsLoaded = true;
  } catch (err: any) {
    console.warn("⚠️ [SlideRenderer] Error registrando fuentes locales:", err.message);
  }
}

export interface RenderSlideOptions {
  sceneIndex: number;
  totalScenes?: number;
  title: string;
  subtitle?: string;
  onScreenText?: string;
  topic?: string;
  width?: number;
  height?: number;
  outputPath?: string;
}

export interface SlideRenderResult {
  filePath: string;
  width: number;
  height: number;
  provider: "corporate_slide_canvas";
}

type SceneCategory = "CALENDAR" | "SHEETS" | "GMAIL" | "TELEGRAM" | "COREAGENT";

interface ThemePreset {
  bg1: string;
  bg2: string;
  accent: string;
  pillBg: string;
  tag: string;
}

const THEME_PRESETS: Record<SceneCategory, ThemePreset> = {
  CALENDAR: {
    bg1: "#070E1B",
    bg2: "#1E3A8A",
    accent: "#38BDF8",
    pillBg: "rgba(56, 189, 248, 0.18)",
    tag: "GOOGLE CALENDAR",
  },
  SHEETS: {
    bg1: "#061A14",
    bg2: "#064E3B",
    accent: "#34D399",
    pillBg: "rgba(52, 211, 153, 0.18)",
    tag: "GOOGLE SHEETS",
  },
  GMAIL: {
    bg1: "#1A0B0E",
    bg2: "#7F1D1D",
    accent: "#F87171",
    pillBg: "rgba(248, 113, 113, 0.18)",
    tag: "GMAIL ASISTIDO",
  },
  TELEGRAM: {
    bg1: "#05131E",
    bg2: "#0369A1",
    accent: "#38BDF8",
    pillBg: "rgba(56, 189, 248, 0.18)",
    tag: "TELEGRAM CHAT",
  },
  COREAGENT: {
    bg1: "#0B0F19",
    bg2: "#312E81",
    accent: "#818CF8",
    pillBg: "rgba(129, 140, 248, 0.18)",
    tag: "PRODUCTIVIDAD IA",
  },
};

function detectCategory(text: string, sceneIndex: number): SceneCategory {
  const t = text.toLowerCase();
  if (/calendar|agenda|reuni[oó]n|cita|evento|fecha/i.test(t)) return "CALENDAR";
  if (/sheet|hoja|gasto|excel|tabla|dato|contabilidad|c[aá]lculo/i.test(t)) return "SHEETS";
  if (/gmail|correo|email|inbox|redacta/i.test(t)) return "GMAIL";
  if (/telegram|chat|mensaje|asistente/i.test(t)) return "TELEGRAM";
  
  // Por defecto según el índice de escena para variedad visual
  const fallbackOrder: SceneCategory[] = ["TELEGRAM", "CALENDAR", "SHEETS", "GMAIL", "COREAGENT"];
  return fallbackOrder[(Math.max(1, sceneIndex) - 1) % fallbackOrder.length];
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Dibuja un mockup visual auténtico en el lateral derecho de la diapositiva
 */
function drawCategoryMockup(ctx: any, category: SceneCategory, x: number, y: number, w: number, h: number, preset: ThemePreset) {
  // Contenedor del mockup
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  roundRect(ctx, x, y, w, h, 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 20);
  ctx.stroke();

  if (category === "CALENDAR") {
    // Cabecera Google Calendar
    ctx.fillStyle = "#1E40AF";
    roundRect(ctx, x, y, w, 55, 20);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 17px SilvaniaBold, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("📅 Google Calendar · Agenda", x + 25, y + 28);

    // Evento destacado 1
    ctx.fillStyle = "rgba(59, 130, 246, 0.25)";
    roundRect(ctx, x + 25, y + 80, w - 50, 75, 12);
    ctx.fill();
    ctx.strokeStyle = "#3B82F6";
    ctx.lineWidth = 1.5;
    roundRect(ctx, x + 25, y + 80, w - 50, 75, 12);
    ctx.stroke();
    ctx.fillStyle = "#60A5FA";
    ctx.font = "bold 15px SilvaniaBold, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("10:00 - 11:00 AM · Reunión con Cliente", x + 40, y + 92);
    ctx.fillStyle = "#E2E8F0";
    ctx.font = "14px SilvaniaRegular, sans-serif";
    ctx.fillText("Creada por Silvania CoreAgent vía Telegram", x + 40, y + 120);

    // Evento 2
    ctx.fillStyle = "rgba(148, 163, 184, 0.12)";
    roundRect(ctx, x + 25, y + 175, w - 50, 65, 12);
    ctx.fill();
    ctx.fillStyle = "#94A3B8";
    ctx.font = "bold 14px SilvaniaBold, sans-serif";
    ctx.fillText("14:30 PM · Revisión de Presupuestos", x + 40, y + 190);
    ctx.font = "13px SilvaniaRegular, sans-serif";
    ctx.fillText("Sincronización instantánea en tu cuenta", x + 40, y + 215);

    // Botón status
    ctx.fillStyle = "#10B981";
    roundRect(ctx, x + 25, y + 265, 160, 36, 18);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 13px SilvaniaBold, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("✓ SINCRONIZADO", x + 45, y + 283);

  } else if (category === "SHEETS") {
    // Cabecera Google Sheets
    ctx.fillStyle = "#065F46";
    roundRect(ctx, x, y, w, 55, 20);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 17px SilvaniaBold, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("📊 Google Sheets · Finanzas", x + 25, y + 28);

    // Filas de datos
    const rows = [
      { col1: "Transporte", col2: "50.00 €", tag: "Registrado" },
      { col1: "Publicidad", col2: "120.00 €", tag: "Confirmado" },
      { col1: "Software", col2: "35.00 €", tag: "Automático" },
    ];

    ctx.textBaseline = "top";
    for (let r = 0; r < rows.length; r++) {
      const ry = y + 75 + r * 68;
      ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
      roundRect(ctx, x + 25, ry, w - 50, 56, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(16, 185, 129, 0.25)";
      ctx.stroke();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 15px SilvaniaBold, sans-serif";
      ctx.fillText(rows[r].col1, x + 40, ry + 12);
      ctx.fillStyle = "#34D399";
      ctx.fillText(rows[r].col2, x + 180, ry + 12);

      ctx.fillStyle = "#A7F3D0";
      ctx.font = "12px SilvaniaRegular, sans-serif";
      ctx.fillText(`✓ ${rows[r].tag}`, x + 40, ry + 34);
    }

  } else if (category === "GMAIL") {
    // Cabecera Gmail
    ctx.fillStyle = "#991B1B";
    roundRect(ctx, x, y, w, 55, 20);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 17px SilvaniaBold, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("✉️ Gmail Asistido · Borrador", x + 25, y + 28);

    // Contenido del email
    ctx.fillStyle = "rgba(239, 68, 68, 0.12)";
    roundRect(ctx, x + 25, y + 80, w - 50, 160, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(239, 68, 68, 0.3)";
    ctx.stroke();

    ctx.textBaseline = "top";
    ctx.fillStyle = "#FCA5A5";
    ctx.font = "bold 14px SilvaniaBold, sans-serif";
    ctx.fillText("Para: cliente@empresa.com", x + 40, y + 95);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px SilvaniaBold, sans-serif";
    ctx.fillText("Asunto: Propuesta y Factura Silvania", x + 40, y + 125);
    ctx.fillStyle = "#CBD5E1";
    ctx.font = "14px SilvaniaRegular, sans-serif";
    ctx.fillText("Borrador redactado por IA listo en Gmail.", x + 40, y + 160);
    ctx.fillText("Pendiente de confirmación del usuario.", x + 40, y + 185);

    // Botón Enviar
    ctx.fillStyle = "#DC2626";
    roundRect(ctx, x + 25, y + 260, 180, 40, 20);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 14px SilvaniaBold, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("🚀 Enviar con 1 Clic", x + 45, y + 280);

  } else if (category === "TELEGRAM") {
    // Cabecera Telegram
    ctx.fillStyle = "#0284C7";
    roundRect(ctx, x, y, w, 55, 20);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 17px SilvaniaBold, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("✈️ Telegram · @Silvania_Core_Agent", x + 25, y + 28);

    // Burbuja usuario
    ctx.fillStyle = "#0369A1";
    roundRect(ctx, x + 90, y + 80, w - 115, 60, 12);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "14px SilvaniaRegular, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("Crea reunión mañana a las 10am con Juan", x + 105, y + 92);
    ctx.fillStyle = "#7DD3FC";
    ctx.font = "11px SilvaniaRegular, sans-serif";
    ctx.fillText("10:42 AM ✓✓", x + w - 75, y + 120);

    // Burbuja bot
    ctx.fillStyle = "#1E293B";
    roundRect(ctx, x + 25, y + 160, w - 70, 95, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.stroke();

    ctx.fillStyle = "#34D399";
    ctx.font = "bold 14px SilvaniaBold, sans-serif";
    ctx.fillText("✅ Cita agendada en Google Calendar", x + 40, y + 175);
    ctx.fillStyle = "#E2E8F0";
    ctx.font = "13px SilvaniaRegular, sans-serif";
    ctx.fillText("Mañana · 10:00 - 11:00 AM", x + 40, y + 200);
    ctx.fillStyle = "#94A3B8";
    ctx.fillText("Enlace Meet generado automáticamente", x + 40, y + 225);

  } else {
    // Hub CoreAgent
    ctx.fillStyle = "#4338CA";
    roundRect(ctx, x, y, w, 55, 20);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 17px SilvaniaBold, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("⚡ Silvania CoreAgent Hub", x + 25, y + 28);

    const integrations = [
      "✓ Google Calendar (Citas y Agenda)",
      "✓ Google Sheets (Registro de Gastos)",
      "✓ Gmail (Redacción Asistida)",
      "✓ Telegram (Interacción por Chat)",
    ];

    ctx.textBaseline = "top";
    for (let idx = 0; idx < integrations.length; idx++) {
      const iy = y + 80 + idx * 52;
      ctx.fillStyle = "rgba(129, 140, 248, 0.12)";
      roundRect(ctx, x + 25, iy, w - 50, 42, 10);
      ctx.fill();
      ctx.fillStyle = "#E0E7FF";
      ctx.font = "bold 14px SilvaniaBold, sans-serif";
      ctx.fillText(integrations[idx], x + 40, iy + 13);
    }
  }
}

export const slideRenderer = {
  /**
   * Genera una diapositiva corporativa premium y nítida (1280x720) usando Canvas en Node.js.
   * Totalmente determinista, 0€ de coste, <40ms de CPU y sin dependencias externas.
   */
  async renderSceneSlide(options: RenderSlideOptions): Promise<SlideRenderResult> {
    ensureFontsRegistered();

    const width = options.width || 1280;
    const height = options.height || 720;
    const sceneIndex = Math.max(1, options.sceneIndex);
    const totalScenes = options.totalScenes || 3;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Detección semántica de la categoría del slide
    const contextText = `${options.title} ${options.onScreenText || ""} ${options.subtitle || ""}`;
    const category = detectCategory(contextText, sceneIndex);
    const preset = THEME_PRESETS[category];

    // 1. Fondo degradado de alta gama (Dark Mode SaaS)
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, preset.bg1);
    gradient.addColorStop(1, preset.bg2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Resplandor ambiental suave en el centro/superior
    const ambientGlow = ctx.createRadialGradient(width / 3, height / 3, 50, width / 3, height / 3, 500);
    ambientGlow.addColorStop(0, preset.accent + "28"); // 16% opacidad
    ambientGlow.addColorStop(1, "transparent");
    ctx.fillStyle = ambientGlow;
    ctx.fillRect(0, 0, width, height);

    // 3. Tarjeta central contenedora (Glassmorphism sutil)
    const cardX = 80;
    const cardY = 60;
    const cardW = width - 160;
    const cardH = height - 120;
    const cardRadius = 24;

    ctx.shadowColor = "rgba(0, 0, 0, 0.50)";
    ctx.shadowBlur = 35;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 15;

    ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
    roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.stroke();

    // 4. Pill / Badge superior con número de escena y categoría
    const pillText = `ESCENA ${sceneIndex} DE ${totalScenes}  ·  ${preset.tag}`;
    ctx.font = "bold 15px SilvaniaBold, sans-serif";
    const pillMetrics = ctx.measureText(pillText);
    const pillW = pillMetrics.width + 36;
    const pillH = 34;
    const pillX = cardX + 45;
    const pillY = cardY + 40;

    ctx.fillStyle = preset.pillBg;
    roundRect(ctx, pillX, pillY, pillW, pillH, 17);
    ctx.fill();

    ctx.strokeStyle = preset.accent + "66";
    ctx.lineWidth = 1;
    roundRect(ctx, pillX, pillY, pillW, pillH, 17);
    ctx.stroke();

    ctx.fillStyle = preset.accent;
    ctx.textBaseline = "middle";
    ctx.fillText(pillText, pillX + 18, pillY + pillH / 2);

    // 5. Contenido izquierdo (Texto principal) vs Contenido derecho (Mockup visual)
    const leftW = 560; // Ancho reservado para texto a la izquierda

    // Título de la escena
    const titleText = (options.onScreenText || options.title).trim();
    ctx.font = "bold 42px SilvaniaBold, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "top";

    const titleLines = wrapText(ctx, titleText, leftW).slice(0, 3);
    const titleLineHeight = 52;
    const titleStartY = cardY + 100;

    for (let i = 0; i < titleLines.length; i++) {
      ctx.fillText(titleLines[i], cardX + 45, titleStartY + i * titleLineHeight);
    }

    // Subtítulo explicativo / Locución resumida
    const subtitleText = options.subtitle || options.title;
    const subStartY = titleStartY + titleLines.length * titleLineHeight + 20;

    if (subtitleText && subtitleText.toLowerCase() !== titleText.toLowerCase()) {
      ctx.font = "20px SilvaniaRegular, sans-serif";
      ctx.fillStyle = "#94A3B8"; // Slate-400

      const subLines = wrapText(ctx, subtitleText.trim(), leftW).slice(0, 3);
      const subLineHeight = 30;

      for (let i = 0; i < subLines.length; i++) {
        ctx.fillText(subLines[i], cardX + 45, subStartY + i * subLineHeight);
      }
    }

    // Bullets de valor adicionales
    const bulletY = subStartY + 100;
    if (bulletY < cardY + cardH - 80) {
      ctx.font = "bold 15px SilvaniaBold, sans-serif";
      ctx.fillStyle = preset.accent;
      ctx.fillText("✓ 100% Integrado en Telegram", cardX + 45, bulletY);
      ctx.fillText("✓ Sin salir de tu chat habitual", cardX + 45, bulletY + 28);
    }

    // 6. Mockup visual a la derecha
    const mockX = cardX + leftW + 80;
    const mockY = cardY + 80;
    const mockW = cardW - leftW - 120;
    const mockH = cardH - 150;
    drawCategoryMockup(ctx, category, mockX, mockY, mockW, mockH, preset);

    // 7. Pie corporativo de la tarjeta
    const footerY = cardY + cardH - 50;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 45, footerY - 15);
    ctx.lineTo(cardX + cardW - 45, footerY - 15);
    ctx.stroke();

    ctx.font = "bold 18px SilvaniaBold, sans-serif";
    ctx.fillStyle = "#F8FAFC";
    ctx.textBaseline = "middle";
    ctx.fillText("Silvania CoreAgent", cardX + 45, footerY);

    ctx.font = "16px SilvaniaBold, sans-serif";
    ctx.fillStyle = preset.accent;
    const siteText = "silvania.ai";
    const siteMetrics = ctx.measureText(siteText);
    ctx.fillText(siteText, cardX + cardW - 45 - siteMetrics.width, footerY);

    // 8. Exportar a JPEG de alta fidelidad
    const outputPath = options.outputPath || path.join(process.cwd(), "temp", `mkt_slide_${Date.now()}_${sceneIndex}.jpg`);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const buffer = canvas.toBuffer("image/jpeg", 92);
    fs.writeFileSync(outputPath, buffer);

    console.log(`🎨 [SlideRenderer] Slide corporativo generado: Escena ${sceneIndex}/${totalScenes} [${category}] -> ${outputPath} (${buffer.length} bytes)`);

    return {
      filePath: outputPath,
      width,
      height,
      provider: "corporate_slide_canvas",
    };
  },
};
