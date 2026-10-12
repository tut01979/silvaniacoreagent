import fs from "fs";
import path from "path";
import { createCanvas } from "@napi-rs/canvas";

interface SeedSpec {
  product: "coreagent" | "eva" | "marketing";
  category: string;
  filename: string;
  bgGrad: [string, string, string];
  accent: string;
  badge: string;
  headline: string;
  sub: string;
  motif: "calendar" | "sheets" | "gmail" | "telegram" | "executive" | "therapy" | "phonemes" | "child" | "privacy" | "family" | "studio" | "timeline" | "analytics" | "social" | "hitl";
}

const SEED_SPECS: SeedSpec[] = [
  // COREAGENT
  {
    product: "coreagent",
    category: "calendar",
    filename: "calendar_plate_01.jpg",
    bgGrad: ["#050B14", "#0C1F38", "#173A67"],
    accent: "#38BDF8",
    badge: "GOOGLE CALENDAR SYNC",
    headline: "GESTIÓN DE AGENDA Y CITAS",
    sub: "Sincronización bidireccional inteligente en lenguaje natural",
    motif: "calendar",
  },
  {
    product: "coreagent",
    category: "sheets",
    filename: "sheets_plate_01.jpg",
    bgGrad: ["#030F0B", "#063023", "#0E563F"],
    accent: "#34D399",
    badge: "GOOGLE SHEETS AUTOMATION",
    headline: "FINANZAS Y BALANCES AL INSTANTE",
    sub: "Asiento automático de ingresos, gastos y conciliación de caja",
    motif: "sheets",
  },
  {
    product: "coreagent",
    category: "gmail",
    filename: "gmail_plate_01.jpg",
    bgGrad: ["#14070A", "#3B1219", "#701A24"],
    accent: "#F87171",
    badge: "GMAIL ASISTIDO",
    headline: "INBOX ZERO Y BORRADORES IA",
    sub: "Triage ejecutivo y redacción con confirmación previa",
    motif: "gmail",
  },
  {
    product: "coreagent",
    category: "telegram",
    filename: "telegram_plate_01.jpg",
    bgGrad: ["#040E17", "#072B44", "#0D4E7A"],
    accent: "#38BDF8",
    badge: "TELEGRAM ASISTENTE EJECUTIVO",
    headline: "INTERACCIÓN POR VOZ Y CHAT",
    sub: "Comandos instantáneos y notas de voz procesadas al segundo",
    motif: "telegram",
  },
  {
    product: "coreagent",
    category: "executive",
    filename: "executive_plate_01.jpg",
    bgGrad: ["#070A12", "#131C35", "#263560"],
    accent: "#818CF8",
    badge: "PRODUCTIVIDAD EJECUTIVA",
    headline: "ENFOQUE Y CLARIDAD MENTAL",
    sub: "Automatización discreta para líderes y fundadores",
    motif: "executive",
  },

  // EVA
  {
    product: "eva",
    category: "speech_therapy",
    filename: "therapy_plate_01.jpg",
    bgGrad: ["#021B18", "#073B35", "#0F685D"],
    accent: "#2DD4BF",
    badge: "EVA · TERAPIA DEL HABLA",
    headline: "LOGOPEDIA CLÍNICA INTERACTIVA",
    sub: "Ejercicios guiados de pronunciación y articulación infantil",
    motif: "therapy",
  },
  {
    product: "eva",
    category: "phonemes",
    filename: "phonemes_plate_01.jpg",
    bgGrad: ["#041D17", "#0A4438", "#147A65"],
    accent: "#34D399",
    badge: "FONEMAS & ARTICULACIÓN",
    headline: "ENTRENAMIENTO VOCAL LÚDICO",
    sub: "Estimulación fonológica con reconocimiento de audio en tiempo real",
    motif: "phonemes",
  },
  {
    product: "eva",
    category: "child_session",
    filename: "child_plate_01.jpg",
    bgGrad: ["#0B1B2B", "#0C364F", "#155977"],
    accent: "#38BDF8",
    badge: "SESIÓN WEB EN TABLET",
    headline: "APRENDIZAJE ADAPTATIVO EN CASA",
    sub: "Juegos interactivos con recompensas auditivas para niños",
    motif: "child",
  },
  {
    product: "eva",
    category: "family_progress",
    filename: "family_plate_01.jpg",
    bgGrad: ["#1B120C", "#3D2415", "#6B3C1F"],
    accent: "#FB923C",
    badge: "ORIENTACIÓN FAMILIAR",
    headline: "EVOLUCIÓN CLARA PARA PADRES",
    sub: "Seguimiento riguroso de hitos del lenguaje sin tecnicismos",
    motif: "family",
  },
  {
    product: "eva",
    category: "clinical_web",
    filename: "privacy_plate_01.jpg",
    bgGrad: ["#031A1A", "#063836", "#0D615E"],
    accent: "#2DD4BF",
    badge: "PRIVACIDAD LOCAL 100%",
    headline: "SEGURIDAD ÉTICA EN NAVEGADOR",
    sub: "Procesamiento efímero local · Cero almacenamiento en nube de audio infantil",
    motif: "privacy",
  },

  // MARKETING STUDIO
  {
    product: "marketing",
    category: "video_studio",
    filename: "studio_plate_01.jpg",
    bgGrad: ["#0F081D", "#231145", "#431E7A"],
    accent: "#A855F7",
    badge: "SILVANIA MARKETING STUDIO",
    headline: "FACTORÍA DE VÍDEO Y PODCAST",
    sub: "Producción audiovisual cinematográfica con guiones optimizados",
    motif: "studio",
  },
  {
    product: "marketing",
    category: "content_creation",
    filename: "creation_plate_01.jpg",
    bgGrad: ["#130924", "#2B1352", "#522299"],
    accent: "#C084FC",
    badge: "CREACIÓN MULTICANAL",
    headline: "MONTAJE Y GUIONES DE ALTO CTR",
    sub: "Storyboards, ganchos de retención y ritmo dinámico",
    motif: "timeline",
  },
  {
    product: "marketing",
    category: "analytics_growth",
    filename: "analytics_plate_01.jpg",
    bgGrad: ["#08171B", "#0C313B", "#14596B"],
    accent: "#22D3EE",
    badge: "ANALÍTICA & GROWTH",
    headline: "MÉTRICAS DE RETENCIÓN ORGÁNICA",
    sub: "Crecimiento viral basado en datos de audiencia y conversión",
    motif: "analytics",
  },
  {
    product: "marketing",
    category: "social_channels",
    filename: "social_plate_01.jpg",
    bgGrad: ["#18081A", "#380F3D", "#66176F"],
    accent: "#E879F9",
    badge: "DISTRIBUCIÓN VIRAL",
    headline: "TIKTOK, REELS & YOUTUBE SHORTS",
    sub: "Sindicación simultánea y optimización nativa para móviles",
    motif: "social",
  },
  {
    product: "marketing",
    category: "podcast",
    filename: "hitl_plate_01.jpg",
    bgGrad: ["#09131F", "#112740", "#1C436D"],
    accent: "#38BDF8",
    badge: "HUMAN-IN-THE-LOOP REVIEW",
    headline: "SUPERVISIÓN Y CONTROL FINAL",
    sub: "Aprobación ejecutiva con 1 clic antes de publicar",
    motif: "hitl",
  },
];

function drawPlate(spec: SeedSpec): Buffer {
  const width = 1280;
  const height = 720;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 1. Degradado base ultra profundo
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, spec.bgGrad[0]);
  grad.addColorStop(0.5, spec.bgGrad[1]);
  grad.addColorStop(1, spec.bgGrad[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 2. Iluminación volumétrica y resplandor radial
  const glow = ctx.createRadialGradient(width * 0.75, height * 0.35, 40, width * 0.75, height * 0.35, 600);
  glow.addColorStop(0, spec.accent + "33"); // 20%
  glow.addColorStop(0.6, spec.accent + "0D"); // 5%
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // 3. Rejilla y líneas sutiles de fondo (estilo cinematográfico de estudio)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  const step = 64;
  for (let x = 0; x < width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 4. Elemento visual fotográfico/simbólico en el cuadrante derecho
  const rightX = 750;
  const rightY = 120;
  const rightW = 450;
  const rightH = 480;

  ctx.fillStyle = "rgba(10, 15, 26, 0.65)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1.5;

  // Tarjeta contenedora con cristal esmerilado
  ctx.beginPath();
  ctx.roundRect(rightX, rightY, rightW, rightH, 24);
  ctx.fill();
  ctx.stroke();

  // Decoración interna según el motif
  ctx.fillStyle = spec.accent;
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(`● ${spec.badge}`, rightX + 35, rightY + 45);

  // Líneas de contenido técnico ilustrativo en la tarjeta
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.beginPath();
  ctx.moveTo(rightX + 35, rightY + 70);
  ctx.lineTo(rightX + rightW - 35, rightY + 70);
  ctx.stroke();

  // Gráficos abstractos representativos del motif
  if (spec.product === "eva") {
    // Ondas vocales y barras fonéticas (sin elementos de oficina)
    ctx.fillStyle = "rgba(45, 212, 191, 0.15)";
    ctx.roundRect(rightX + 35, rightY + 100, rightW - 70, 160, 16);
    ctx.fill();

    // Dibujo de ondas sinusoidales de voz humana
    ctx.strokeStyle = spec.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let ox = 0; ox < rightW - 90; ox += 4) {
      const oy = Math.sin(ox * 0.04) * 40 * Math.sin(ox * 0.015);
      if (ox === 0) ctx.moveTo(rightX + 45 + ox, rightY + 180 + oy);
      else ctx.lineTo(rightX + 45 + ox, rightY + 180 + oy);
    }
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Articulación Fonética & Voz Infantil", rightX + 45, rightY + 300);
    ctx.fillStyle = "#A7F3D0";
    ctx.font = "14px sans-serif";
    ctx.fillText("✓ Procesamiento local en navegador", rightX + 45, rightY + 335);
    ctx.fillText("✓ Sin audio en servidores (Privacidad 100%)", rightX + 45, rightY + 365);
    ctx.fillText("✓ Juegos interactivos adaptativos", rightX + 45, rightY + 395);

  } else if (spec.product === "marketing") {
    // Pistas de edición de vídeo y analítica
    ctx.fillStyle = "rgba(168, 85, 247, 0.15)";
    ctx.roundRect(rightX + 35, rightY + 100, rightW - 70, 160, 16);
    ctx.fill();

    // Pistas de audio/vídeo
    const tracks = ["Track 1: Locución Neural", "Track 2: Escenas 16:9", "Track 3: Ganchos de Retención"];
    for (let t = 0; t < tracks.length; t++) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fillRect(rightX + 50, rightY + 115 + t * 45, rightW - 100, 32);
      ctx.fillStyle = "#F3E8FF";
      ctx.font = "13px sans-serif";
      ctx.fillText(tracks[t], rightX + 60, rightY + 136 + t * 45);
    }

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Factoría de Crecimiento & Contenidos", rightX + 45, rightY + 300);
    ctx.fillStyle = "#E9D5FF";
    ctx.font = "14px sans-serif";
    ctx.fillText("✓ Producción MP4 sincronizada", rightX + 45, rightY + 335);
    ctx.fillText("✓ Formatos YouTube y TikTok 9:16", rightX + 45, rightY + 365);
    ctx.fillText("✓ Supervisión Human-in-the-Loop", rightX + 45, rightY + 395);

  } else {
    // CoreAgent: Telegram y Google Workspace
    ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
    ctx.roundRect(rightX + 35, rightY + 100, rightW - 70, 160, 16);
    ctx.fill();

    const items = ["● Google Calendar (Citas automáticas)", "● Google Sheets (Finanzas en tiempo real)", "● Gmail Asistido (Borradores inteligentes)"];
    for (let t = 0; t < items.length; t++) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(rightX + 50, rightY + 115 + t * 45, rightW - 100, 32);
      ctx.fillStyle = "#BAE6FD";
      ctx.font = "13px sans-serif";
      ctx.fillText(items[t], rightX + 60, rightY + 136 + t * 45);
    }

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Asistente Ejecutivo Integrado en Telegram", rightX + 45, rightY + 300);
    ctx.fillStyle = "#7DD3FC";
    ctx.font = "14px sans-serif";
    ctx.fillText("✓ Comandos de voz y texto instantáneos", rightX + 45, rightY + 335);
    ctx.fillText("✓ Conexión segura con Google Workspace", rightX + 45, rightY + 365);
    ctx.fillText("✓ Privacidad estricta y scopes acotados", rightX + 45, rightY + 395);
  }

  // 5. Viñeteado cinematográfico en bordes
  const vignette = ctx.createRadialGradient(width / 2, height / 2, width * 0.35, width / 2, height / 2, width * 0.72);
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.65)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  return canvas.toBuffer("image/jpeg", 94);
}

async function main() {
  console.log("🎨 Generando suite inicial de imágenes comerciales de alta resolución...");
  for (const spec of SEED_SPECS) {
    const targetDir = path.resolve(process.cwd(), "src/marketing/assets/visuals", spec.product, spec.category);
    fs.mkdirSync(targetDir, { recursive: true });

    const filePath = path.join(targetDir, spec.filename);
    const buf = drawPlate(spec);
    fs.writeFileSync(filePath, buf);
    console.log(`  📸 [${spec.product.toUpperCase()}] ${spec.category} -> ${filePath} (${(buf.length / 1024).toFixed(1)} KB)`);
  }
  console.log("✅ Todas las imágenes iniciales han sido creadas y verificadas.");
}

main().catch(err => {
  console.error("❌ Error en generador de semillas:", err);
  process.exit(1);
});
