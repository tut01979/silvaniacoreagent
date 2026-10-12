import fs from "fs";
import path from "path";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { ProductBrand, visualAssetSelector } from "./visualAssetSelector.js";

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
  backgroundImagePath?: string | null;
  product?: ProductBrand;
  category?: string;
}

export interface SlideRenderResult {
  filePath: string;
  width: number;
  height: number;
  provider: "corporate_slide_canvas";
  hasBackgroundImage?: boolean;
  product: ProductBrand;
}

interface ThemeConfig {
  bg1: string;
  bg2: string;
  accent: string;
  pillBg: string;
  tag: string;
  brandTitle: string;
  brandWebsite: string;
  bullet1: string;
  bullet2: string;
}

const BRAND_THEMES: Record<ProductBrand, ThemeConfig> = {
  eva: {
    bg1: "#021A16",
    bg2: "#0A463E",
    accent: "#2DD4BF",
    pillBg: "rgba(45, 212, 191, 0.20)",
    tag: "TERAPIA DEL HABLA Y VOZ",
    brandTitle: "Eva · Logopedia Clínica",
    brandWebsite: "eva.silvania.ai · Privacidad Local 100%",
    bullet1: "✓ 100% Privacidad local en navegador",
    bullet2: "✓ Sin grabaciones en servidores de menores",
  },
  marketing: {
    bg1: "#120822",
    bg2: "#3B1466",
    accent: "#C084FC",
    pillBg: "rgba(192, 132, 252, 0.20)",
    tag: "MARKETING STUDIO & GROWTH",
    brandTitle: "Silvania Marketing Studio",
    brandWebsite: "marketing.silvania.ai · Human-in-the-Loop",
    bullet1: "✓ Producción audiovisual y guiones IA",
    bullet2: "✓ Supervisión Human-in-the-Loop",
  },
  coreagent: {
    bg1: "#060F1E",
    bg2: "#13315C",
    accent: "#38BDF8",
    pillBg: "rgba(56, 189, 248, 0.20)",
    tag: "PRODUCTIVIDAD EJECUTIVA",
    brandTitle: "Silvania CoreAgent",
    brandWebsite: "silvania.ai/coreagent · Telegram & Google Workspace",
    bullet1: "✓ Asistente ejecutivo en Telegram",
    bullet2: "✓ Conectado a Google Workspace",
  },
};

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
 * Dibuja un mockup visual estricto para cada agente cuando NO hay foto real de fondo
 */
function drawProductSpecificMockup(
  ctx: any,
  product: ProductBrand,
  category: string,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: ThemeConfig
) {
  ctx.fillStyle = "rgba(10, 15, 26, 0.85)";
  roundRect(ctx, x, y, w, h, 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 20);
  ctx.stroke();

  if (product === "eva") {
    // -------------------------------------------------------------
    // Mockup de EVA: Terapia del Habla infantil (CERO TELEGRAM, CERO GOOGLE)
    // -------------------------------------------------------------
    ctx.fillStyle = "#0F766E";
    roundRect(ctx, x, y, w, 55, 20);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 17px SilvaniaBold, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("🗣️ Eva · Entrenamiento Articulatorio", x + 25, y + 28);

    // Contenedor de onda vocal
    ctx.fillStyle = "rgba(45, 212, 191, 0.12)";
    roundRect(ctx, x + 25, y + 75, w - 50, 130, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(45, 212, 191, 0.35)";
    ctx.stroke();

    ctx.fillStyle = "#A7F3D0";
    ctx.font = "bold 14px SilvaniaBold, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("Análisis Acústico de Fonemas en Tiempo Real", x + 40, y + 90);

    // Onda sinusoidal
    ctx.strokeStyle = "#2DD4BF";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let ox = 0; ox < w - 90; ox += 4) {
      const oy = Math.sin(ox * 0.05) * 26 * Math.cos(ox * 0.02);
      if (ox === 0) ctx.moveTo(x + 45 + ox, y + 145 + oy);
      else ctx.lineTo(x + 45 + ox, y + 145 + oy);
    }
    ctx.stroke();

    // Hitos y recompensas
    const milestones = [
      { text: "Fonema /r/ articulado con precisión", tag: "Excelente" },
      { text: "Control de respiración y soplo", tag: "Superado" },
      { text: "Privacidad: Audio efímero en navegador", tag: "100% Seguro" },
    ];

    for (let r = 0; r < milestones.length; r++) {
      const my = y + 220 + r * 58;
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      roundRect(ctx, x + 25, my, w - 50, 48, 10);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 13px SilvaniaBold, sans-serif";
      ctx.fillText(milestones[r].text, x + 40, my + 10);
      ctx.fillStyle = "#2DD4BF";
      ctx.font = "12px SilvaniaRegular, sans-serif";
      ctx.fillText(`✓ ${milestones[r].tag}`, x + 40, my + 28);
    }

  } else if (product === "marketing") {
    // -------------------------------------------------------------
    // Mockup de MARKETING STUDIO: Edición de vídeo, métricas y HITL
    // -------------------------------------------------------------
    ctx.fillStyle = "#6B21A8";
    roundRect(ctx, x, y, w, 55, 20);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 17px SilvaniaBold, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("🎬 Marketing Studio · Timeline & Métricas", x + 25, y + 28);

    // Contenedor de pistas de montaje
    ctx.fillStyle = "rgba(192, 132, 252, 0.12)";
    roundRect(ctx, x + 25, y + 75, w - 50, 130, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(192, 132, 252, 0.35)";
    ctx.stroke();

    ctx.fillStyle = "#E9D5FF";
    ctx.font = "bold 14px SilvaniaBold, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("Pistas de Ensamblado Audiovisual Sincronizado", x + 40, y + 90);

    const tracks = ["Audio Master (Voz Neural)", "Video 16:9 (Paced Cut)", "Overlay Cinematográfico"];
    for (let t = 0; t < tracks.length; t++) {
      const ty = y + 115 + t * 26;
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(x + 40, ty, w - 80, 20);
      ctx.fillStyle = "#D8B4FE";
      ctx.font = "11px SilvaniaRegular, sans-serif";
      ctx.fillText(tracks[t], x + 50, ty + 4);
    }

    // Métricas y HITL
    const stats = [
      { col1: "Retención estimada:", col2: "86% en primeros 30s" },
      { col1: "Sindicación:", col2: "YouTube & Shorts 9:16" },
      { col1: "Human-in-the-Loop:", col2: "Borrador pendiente de OK" },
    ];

    for (let s = 0; s < stats.length; s++) {
      const sy = y + 220 + s * 58;
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      roundRect(ctx, x + 25, sy, w - 50, 48, 10);
      ctx.fill();
      ctx.fillStyle = "#F3E8FF";
      ctx.font = "bold 13px SilvaniaBold, sans-serif";
      ctx.fillText(stats[s].col1, x + 40, sy + 10);
      ctx.fillStyle = "#C084FC";
      ctx.font = "12px SilvaniaRegular, sans-serif";
      ctx.fillText(stats[s].col2, x + 40, sy + 28);
    }

  } else {
    // -------------------------------------------------------------
    // Mockup de COREAGENT: Google Workspace & Telegram Ejecutivo
    // -------------------------------------------------------------
    ctx.fillStyle = "#0284C7";
    roundRect(ctx, x, y, w, 55, 20);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 17px SilvaniaBold, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("⚡ CoreAgent · Integraciones Google & Telegram", x + 25, y + 28);

    const integrations = [
      { name: "Google Calendar", desc: "Citas y agenda en lenguaje natural", stat: "Sincronizado" },
      { name: "Google Sheets", desc: "Finanzas, gastos y balances", stat: "Al segundo" },
      { name: "Gmail Asistido", desc: "Borradores con confirmación previa", stat: "Seguro" },
      { name: "Telegram Chat", desc: "Notas de voz y comandos directos", stat: "Activo" },
    ];

    ctx.textBaseline = "top";
    for (let idx = 0; idx < integrations.length; idx++) {
      const iy = y + 75 + idx * 72;
      ctx.fillStyle = "rgba(56, 189, 248, 0.10)";
      roundRect(ctx, x + 25, iy, w - 50, 60, 12);
      ctx.fill();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.stroke();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 15px SilvaniaBold, sans-serif";
      ctx.fillText(integrations[idx].name, x + 40, iy + 10);
      ctx.fillStyle = "#38BDF8";
      ctx.fillText(`✓ ${integrations[idx].stat}`, x + w - 140, iy + 10);

      ctx.fillStyle = "#94A3B8";
      ctx.font = "12px SilvaniaRegular, sans-serif";
      ctx.fillText(integrations[idx].desc, x + 40, iy + 34);
    }
  }
}

export const slideRenderer = {
  /**
   * Genera una diapositiva cinematográfica de alta definición (1280x720).
   * 
   * Si se proporciona una foto real de fondo (de la suite de 300 imágenes o IA):
   *   -> Dibuja la foto completa en 16:9 con encuadre nítido
   *   -> Aplica degradado inferior cinematográfico (estilo Apple TV / Netflix documental)
   *   -> Pinta la franja inferior con tipografía clara y la identidad de marca ESTRICTAMENTE SEPARADA.
   * 
   * Si no hay foto de fondo:
   *   -> Genera la composición vectorial garantizando que Eva NUNCA muestre Telegram ni Google.
   */
  async renderSceneSlide(options: RenderSlideOptions): Promise<SlideRenderResult> {
    ensureFontsRegistered();

    const width = options.width || 1280;
    const height = options.height || 720;
    const sceneIndex = Math.max(1, options.sceneIndex);
    const totalScenes = options.totalScenes || 3;

    // Detección estricta de producto
    const product: ProductBrand =
      options.product ||
      visualAssetSelector.detectProduct(`${options.topic || ""} ${options.title} ${options.onScreenText || ""}`);

    const theme = BRAND_THEMES[product];
    const category = options.category || visualAssetSelector.detectCategory(product, `${options.title} ${options.onScreenText || ""}`, sceneIndex);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    let hasBackgroundImage = false;

    // 1. ¿Existe imagen real de fondo (suite de 300 o IA)?
    if (options.backgroundImagePath && fs.existsSync(options.backgroundImagePath)) {
      try {
        const bgImg = await loadImage(options.backgroundImagePath);
        
        // Dibujado con recorte inteligente centrado (cover)
        const imgAspect = bgImg.width / bgImg.height;
        const canvasAspect = width / height;
        let sx = 0, sy = 0, sw = bgImg.width, sh = bgImg.height;

        if (imgAspect > canvasAspect) {
          sw = bgImg.height * canvasAspect;
          sx = (bgImg.width - sw) / 2;
        } else {
          sh = bgImg.width / canvasAspect;
          sy = (bgImg.height - sh) / 2;
        }

        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, width, height);
        hasBackgroundImage = true;
      } catch (loadErr: any) {
        console.warn("⚠️ [SlideRenderer] Error cargando imagen de fondo, usando respaldo vectorial:", loadErr.message);
      }
    }

    if (hasBackgroundImage) {
      // =========================================================================
      // MODO CINEMATOGRÁFICO CON FOTO REAL DE FONDO (Apple Keynote / Netflix)
      // La foto domina la pantalla; la franja inferior ofrece lectura nítida
      // =========================================================================

      // A. Viñeteado suave en esquinas
      const vignette = ctx.createRadialGradient(width / 2, height / 2, width * 0.35, width / 2, height / 2, width * 0.72);
      vignette.addColorStop(0, "transparent");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.45)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      // B. Degradado cinematográfico discreto en el tercio inferior (el 65% superior queda 100% libre para ver a las personas)
      const lowerGrad = ctx.createLinearGradient(0, height * 0.58, 0, height);
      lowerGrad.addColorStop(0, "transparent");
      lowerGrad.addColorStop(0.35, "rgba(8, 12, 22, 0.45)");
      lowerGrad.addColorStop(0.75, "rgba(8, 12, 22, 0.85)");
      lowerGrad.addColorStop(1, "rgba(6, 9, 17, 0.92)");
      ctx.fillStyle = lowerGrad;
      ctx.fillRect(0, height * 0.58, width, height * 0.42);

      // C. Pill de producto y categoría en tercio inferior
      const pillY = height - 165;
      const pillH = 30;
      const pillText = `ESCENA ${sceneIndex} DE ${totalScenes}  ·  ${theme.tag}`;
      ctx.font = "bold 13px SilvaniaBold, sans-serif";
      const pillMetrics = ctx.measureText(pillText);
      const pillW = pillMetrics.width + 32;
      const pillX = 70;

      ctx.fillStyle = theme.pillBg;
      roundRect(ctx, pillX, pillY, pillW, pillH, 15);
      ctx.fill();
      ctx.strokeStyle = theme.accent + "99";
      ctx.lineWidth = 1;
      roundRect(ctx, pillX, pillY, pillW, pillH, 15);
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.textBaseline = "middle";
      ctx.fillText(pillText, pillX + 16, pillY + pillH / 2);

      // D. Texto principal en pantalla (On-Screen Headline)
      const headlineText = (options.onScreenText || options.title).trim();
      ctx.font = "bold 38px SilvaniaBold, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textBaseline = "top";

      // Sombra sutil para máxima legibilidad sobre cualquier fondo fotográfico
      ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;

      const headlineLines = wrapText(ctx, headlineText, width - 140).slice(0, 2);
      const headlineY = height - 125;
      for (let i = 0; i < headlineLines.length; i++) {
        ctx.fillText(headlineLines[i], 70, headlineY + i * 42);
      }

      ctx.shadowColor = "transparent";

      // E. Subtítulo o locución resumida
      const subText = options.subtitle || "";
      if (subText && subText.toLowerCase() !== headlineText.toLowerCase() && headlineLines.length === 1) {
        ctx.font = "18px SilvaniaRegular, sans-serif";
        ctx.fillStyle = "#CBD5E1";
        const subLines = wrapText(ctx, subText, width - 360).slice(0, 1);
        if (subLines.length > 0) {
          ctx.fillText(subLines[0], 70, height - 45);
        }
      }

      // F. Firma de marca y web en esquina inferior derecha
      ctx.font = "bold 15px SilvaniaBold, sans-serif";
      ctx.fillStyle = theme.accent;
      ctx.textBaseline = "bottom";
      const brandMetrics = ctx.measureText(theme.brandWebsite);
      ctx.fillText(theme.brandWebsite, width - 70 - brandMetrics.width, height - 25);

    } else {
      // =========================================================================
      // MODO VECTORIAL DE RESPALDO (Sin foto pero con AISLAMIENTO ESTRICTO DE MARCA)
      // =========================================================================

      // 1. Degradado base con paleta exclusiva del producto
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, theme.bg1);
      grad.addColorStop(1, theme.bg2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Resplandor ambiental de acento
      const ambientGlow = ctx.createRadialGradient(width / 3, height / 3, 50, width / 3, height / 3, 500);
      ambientGlow.addColorStop(0, theme.accent + "26");
      ambientGlow.addColorStop(1, "transparent");
      ctx.fillStyle = ambientGlow;
      ctx.fillRect(0, 0, width, height);

      // 3. Tarjeta central glassmorphic
      const cardX = 80;
      const cardY = 60;
      const cardW = width - 160;
      const cardH = height - 120;

      ctx.shadowColor = "rgba(0, 0, 0, 0.50)";
      ctx.shadowBlur = 35;
      ctx.fillStyle = "rgba(10, 15, 26, 0.82)";
      roundRect(ctx, cardX, cardY, cardW, cardH, 24);
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1.5;
      roundRect(ctx, cardX, cardY, cardW, cardH, 24);
      ctx.stroke();

      // 4. Pill superior
      const pillText = `ESCENA ${sceneIndex} DE ${totalScenes}  ·  ${theme.tag}`;
      ctx.font = "bold 15px SilvaniaBold, sans-serif";
      const pillMetrics = ctx.measureText(pillText);
      const pillW = pillMetrics.width + 36;
      const pillH = 34;
      const pillX = cardX + 45;
      const pillY = cardY + 40;

      ctx.fillStyle = theme.pillBg;
      roundRect(ctx, pillX, pillY, pillW, pillH, 17);
      ctx.fill();
      ctx.strokeStyle = theme.accent + "66";
      ctx.lineWidth = 1;
      roundRect(ctx, pillX, pillY, pillW, pillH, 17);
      ctx.stroke();

      ctx.fillStyle = theme.accent;
      ctx.textBaseline = "middle";
      ctx.fillText(pillText, pillX + 18, pillY + pillH / 2);

      // 5. Contenido izquierdo (Texto)
      const leftW = 560;
      const titleText = (options.onScreenText || options.title).trim();
      ctx.font = "bold 40px SilvaniaBold, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textBaseline = "top";

      const titleLines = wrapText(ctx, titleText, leftW).slice(0, 3);
      const titleLineHeight = 50;
      const titleStartY = cardY + 100;
      for (let i = 0; i < titleLines.length; i++) {
        ctx.fillText(titleLines[i], cardX + 45, titleStartY + i * titleLineHeight);
      }

      // Subtítulo
      const subtitleText = options.subtitle || options.title;
      const subStartY = titleStartY + titleLines.length * titleLineHeight + 20;
      if (subtitleText && subtitleText.toLowerCase() !== titleText.toLowerCase()) {
        ctx.font = "19px SilvaniaRegular, sans-serif";
        ctx.fillStyle = "#94A3B8";
        const subLines = wrapText(ctx, subtitleText.trim(), leftW).slice(0, 3);
        for (let i = 0; i < subLines.length; i++) {
          ctx.fillText(subLines[i], cardX + 45, subStartY + i * 28);
        }
      }

      // Bullets específicos del producto (Garantiza que Eva NUNCA mencione Telegram)
      const bulletY = subStartY + 100;
      if (bulletY < cardY + cardH - 80) {
        ctx.font = "bold 15px SilvaniaBold, sans-serif";
        ctx.fillStyle = theme.accent;
        ctx.fillText(theme.bullet1, cardX + 45, bulletY);
        ctx.fillText(theme.bullet2, cardX + 45, bulletY + 28);
      }

      // 6. Mockup específico del agente a la derecha
      const mockX = cardX + leftW + 80;
      const mockY = cardY + 80;
      const mockW = cardW - leftW - 120;
      const mockH = cardH - 150;
      drawProductSpecificMockup(ctx, product, category, mockX, mockY, mockW, mockH, theme);

      // 7. Pie corporativo
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
      ctx.fillText(theme.brandTitle, cardX + 45, footerY);

      ctx.font = "16px SilvaniaBold, sans-serif";
      ctx.fillStyle = theme.accent;
      const siteMetrics = ctx.measureText(theme.brandWebsite);
      ctx.fillText(theme.brandWebsite, cardX + cardW - 45 - siteMetrics.width, footerY);
    }

    // 8. Exportar a JPEG
    const outputPath =
      options.outputPath || path.join(process.cwd(), "temp", `mkt_slide_${Date.now()}_${sceneIndex}.jpg`);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const buffer = canvas.toBuffer("image/jpeg", 92);
    fs.writeFileSync(outputPath, buffer);

    console.log(
      `🎨 [SlideRenderer] Slide generado: Escena ${sceneIndex}/${totalScenes} [${product.toUpperCase()}/${category}] (foto: ${hasBackgroundImage ? "SÍ" : "NO"}) -> ${outputPath}`
    );

    return {
      filePath: outputPath,
      width,
      height,
      provider: "corporate_slide_canvas",
      hasBackgroundImage,
      product,
    };
  },
};
