import { Bot } from "grammy";
import fs from "fs";
import path from "path";
import { config } from "../config/config.js";
import { marketingManager } from "./manager.js";
import { MarketingDraft } from "./types.js";

export interface MarketingProductProfile {
  name: string;
  topic: string;
  angle: string;
  status: "disponible" | "proximamente";
}

export const MARKETING_PRODUCTS: MarketingProductProfile[] = [
  {
    name: "Silvania CoreAgent",
    topic: "Silvania CoreAgent: Productividad ejecutiva y gestión de Google Workspace en Telegram con permisos mínimos y privacidad",
    angle: "Productividad con Google Workspace (Calendar, Sheets, Drive, Gmail asistido) en Telegram por texto o notas de voz con permisos mínimos. Disponible en Acceso Anticipado: https://silvania.ai/coreagent",
    status: "disponible"
  },
  {
    name: "Eva",
    topic: "Eva: Voz interactiva y estimulación del habla en el navegador web con privacidad 100% local",
    angle: "Juegos fonéticos para familias y niños en navegador web, sin enviar audio de menores a servidores externos ni requerir cuentas infantiles de Google. Estado obligatorio: Próximamente / En el laboratorio (https://silvania.ai/eva). No vender acceso público directo aún.",
    status: "proximamente"
  },
  {
    name: "Silvania Marketing Studio",
    topic: "Silvania Marketing Studio: Motor de contenidos multicanal con supervisión Human-in-the-Loop",
    angle: "Dogfooding responsable y automatización editorial donde cada pieza requiere aprobación con un clic en Telegram antes de ser publicada. Estado obligatorio: Próximamente / Fase interna para creadores (https://silvania.ai/marketing). No vender acceso público directo aún.",
    status: "proximamente"
  }
];

const STATE_FILE_PATH = path.join(process.cwd(), "data", "marketing_cron_state.json");

interface MarketingCronState {
  lastRotationIndex: number;
  lastFiredDate: string;
}

function loadCronState(): MarketingCronState {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE_PATH, "utf8"));
      return {
        lastRotationIndex: typeof data.lastRotationIndex === "number" ? data.lastRotationIndex : 0,
        lastFiredDate: data.lastFiredDate || ""
      };
    }
  } catch {}
  return { lastRotationIndex: 0, lastFiredDate: "" };
}

function saveCronState(state: MarketingCronState): void {
  try {
    const dir = path.dirname(STATE_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), "utf8");
  } catch (err: any) {
    console.warn("⚠️ No se pudo guardar estado de marketing cron:", err.message);
  }
}

/**
 * Ejecuta la generación de un borrador diario rotativo exclusivo para el administrador.
 * HITL garantizado: envía la propuesta con botones de Telegram (Aprobar/Regenerar/Descartar).
 * Nunca publica automáticamente en canales sin aprobación humana explícita.
 */
export async function runMarketingDailyDraft(
  bot: Bot,
  targetAdminId?: number,
  forceProductIndex?: number
): Promise<MarketingDraft | null> {
  const adminIds = config.marketing.adminIds;
  if (!adminIds || adminIds.length === 0) {
    console.log("ℹ️ [Marketing Cron] No hay MARKETING_ADMIN_IDS configurados. Omitiendo.");
    return null;
  }

  const adminId = targetAdminId || adminIds[0];
  const state = loadCronState();

  // Determinar índice de producto rotativo (0: CoreAgent, 1: Eva, 2: Marketing Studio)
  let productIndex: number;
  if (typeof forceProductIndex === "number") {
    productIndex = Math.abs(forceProductIndex) % MARKETING_PRODUCTS.length;
  } else {
    productIndex = (state.lastRotationIndex + 1) % MARKETING_PRODUCTS.length;
  }

  const product = MARKETING_PRODUCTS[productIndex];
  console.log(`📣 [Marketing Cron] Generando borrador diario para Admin ${adminId} sobre: ${product.name} (Índice: ${productIndex})...`);

  try {
    const draft = await marketingManager.createAndReviewDraft(
      product.topic,
      "social_post",
      adminId,
      bot
    );

    // Actualizar estado persistido
    const todayStr = new Date().toISOString().slice(0, 10);
    saveCronState({
      lastRotationIndex: productIndex,
      lastFiredDate: todayStr
    });

    console.log(`✅ [Marketing Cron] Borrador generado con éxito (#${draft.id.slice(0, 8)}) y enviado a Admin ${adminId} para revisión HITL.`);
    return draft;
  } catch (err: any) {
    console.error(`❌ [Marketing Cron] Error generando borrador para ${product.name}:`, err.message);
    return null;
  }
}

/**
 * Inicia el planificador periódico de Marketing Studio exclusivo para administradores.
 */
export function startMarketingAdminCron(botInstance: Bot) {
  if (!config.marketing.cronEnabled) {
    console.log("ℹ️ [Marketing Cron] Cron de marketing deshabilitado por configuración (MARKETING_CRON_ENABLED=false).");
    return;
  }

  const adminIds = config.marketing.adminIds;
  if (!adminIds || adminIds.length === 0) {
    console.log("ℹ️ [Marketing Cron] No hay MARKETING_ADMIN_IDS definidos. Scheduler desactivado.");
    return;
  }

  const targetHour = config.marketing.cronHour ?? 11;
  const targetMinute = config.marketing.cronMinute ?? 0;
  console.log(`⏰ Iniciando planificador de Marketing Studio HITL (${String(targetHour).padStart(2, "0")}:${String(targetMinute).padStart(2, "0")} Europe/Madrid) para admins: [${adminIds.join(", ")}]...`);

  let lastFiredDay = "";

  setInterval(async () => {
    try {
      const now = new Date();
      const madridTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
      const hours = madridTime.getHours();
      const minutes = madridTime.getMinutes();
      const dayStr = madridTime.toDateString();

      if (hours === targetHour && minutes === targetMinute && lastFiredDay !== dayStr) {
        lastFiredDay = dayStr;
        console.log("🎯 [Marketing Cron] Disparando generación de borrador diario para el administrador...");
        await runMarketingDailyDraft(botInstance);
      }
    } catch (err: any) {
      console.error("❌ [Marketing Cron] Error en chequeo de intervalo:", err.message);
    }
  }, 30 * 1000); // Chequeo cada 30 segundos
}
