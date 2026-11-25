import { Bot, InputFile, InlineKeyboard } from "grammy";
import Stripe from "stripe";
import { spawn, execSync } from "child_process";
import { config } from "./config/config.js";
import { runAgent } from "./agent/agent.js";
import { dbService } from "./database/db.js";
import { audioService } from "./services/audio.js";
import { voiceService } from "./services/voice.js";
import { llmService } from "./services/llm.js";
import { fileManager } from "./services/fileManager.js";
import express from "express";
import path from "path";
import { userContextStore } from "./services/context.js";
import { executeTool } from "./tools/index.js";
import { MOTIVATIONAL_QUOTES } from "./config/quotes.js";
import { 
  checkMaliciousPattern, 
  checkMaliciousFilename, 
  handleSecurityAlert, 
  setAdminTelegramNotifier, 
  logRateLimitEvent, 
  logCspViolation 
} from "./services/security.js";
import axios from "axios";
import fs from "fs";
import crypto from "crypto";
import { criticalLogService } from "./services/criticalLog.js";
import { generateDriveLink } from "./services/linkGenerator.js";
import { getAuthUrl, getGoogleCredentials } from "./services/authHelper.js";
import { checkCourtesyGreeting } from "./services/courtesyHelper.js";
import { EVA_EXERCISES_DATABASE, EVA_LESSONS } from "./config/evaExercises.js";
import { clearUserGogCredentials } from "./tools/gogWrapper.js";
import { configManager } from "./services/configManager.js";
import { morningRadarService } from "./services/morningRadar.js";
import { folderCacheService } from "./services/folderCache.js";
import { skillLoader } from "./services/skillLoader.js";
import { startMarketingAdminCron } from "./marketing/cron.js";

if (process.env.GOOGLE_CREDS_JSON) {
  try {
    fs.writeFileSync("./service-account.json", process.env.GOOGLE_CREDS_JSON);
    console.log("🔑 service-account.json creado exitosamente desde variable de entorno.");
  } catch (err: any) {
    console.error("❌ Error creando service-account.json desde variable de entorno:", err.message);
  }
}

process.on("uncaughtException", (err) => {
  console.error("❌ Exception No Capturada Global:", err);
  criticalLogService.logCritical(
    "Uncaught Exception",
    `Error no capturado en el hilo de ejecución principal: ${err?.stack || err?.message || err}`
  ).catch(logErr => console.error("Error al registrar alerta crítica de uncaughtException:", logErr));
});

process.on("unhandledRejection", (reason: any, promise) => {
  console.error("❌ Rejection No Controlada en Promesa:", reason);
  criticalLogService.logCritical(
    "Unhandled Promise Rejection",
    `Promesa rechazada sin capturar: ${reason?.stack || reason?.message || reason || "Desconocido"}`
  ).catch(logErr => console.error("Error al registrar alerta crítica de unhandledRejection:", logErr));
});

if (process.env.GMAIL_CREDS_JSON) {
  try {
    const credsFolder = path.join(process.cwd(), "data");
    if (!fs.existsSync(credsFolder)) {
      fs.mkdirSync(credsFolder, { recursive: true });
    }
    fs.writeFileSync(path.join(credsFolder, "gmail-credentials.json"), process.env.GMAIL_CREDS_JSON);
    console.log("🔑 gmail-credentials.json creado exitosamente desde variable de entorno.");
  } catch (err: any) {
    console.error("❌ Error creando gmail-credentials.json desde variable de entorno:", err.message);
  }
}

// Sincronizar gmail-credentials.json desde el directorio raíz al volumen persistente si existe
const rootCredsPath = path.join(process.cwd(), "gmail-credentials.json");
const dataCredsPath = path.join(process.cwd(), "data", "gmail-credentials.json");

if (fs.existsSync(rootCredsPath)) {
  try {
    const dataFolder = path.dirname(dataCredsPath);
    if (!fs.existsSync(dataFolder)) {
      fs.mkdirSync(dataFolder, { recursive: true });
    }
    fs.copyFileSync(rootCredsPath, dataCredsPath);
    console.log("🔑 gmail-credentials.json sincronizado en el volumen persistente (data/).");
  } catch (err: any) {
    console.error("❌ Error sincronizando gmail-credentials.json al volumen:", err.message);
  }
}

// Inicializar credenciales en gog CLI
function initGogCredentials() {
  const credsPath = path.join(process.cwd(), "data", "gmail-credentials.json");
  if (fs.existsSync(credsPath)) {
    try {
      console.log("🔧 Inicializando credenciales de cliente OAuth en gog CLI...");
      const executable = path.join(process.cwd(), "bin", process.platform === "win32" ? "gog.exe" : "gog");
      const localDataPath = path.join(process.cwd(), "data");
      const customEnv = { 
        ...process.env, 
        APPDATA: localDataPath,
        HOME: localDataPath, 
        USERPROFILE: localDataPath,
        GOG_KEYRING_PASSWORD: process.env.GOG_KEYRING_PASSWORD || "silvaniacoreagent"
      };
      const cmd = `"${executable}" auth credentials "${credsPath}"`;
      execSync(cmd, { env: customEnv });
      console.log("✅ Credenciales de cliente OAuth registradas con éxito en gog CLI.");
    } catch (err: any) {
      console.error("❌ Error registrando credenciales en gog CLI:", err.message);
    }
  } else {
    console.warn("⚠️ Advertencia: No se encontró gmail-credentials.json. gog CLI no podrá inicializar credenciales.");
  }
}

initGogCredentials();

const bot = new Bot(config.telegram.token);

// Configurar el notificador de Telegram del administrador con fallback seguro
setAdminTelegramNotifier(async (message: string) => {
  const adminId = config.telegram.allowedUsers[0] || 1572946817;
  try {
    await bot.api.sendMessage(adminId, message, { parse_mode: "Markdown" });
  } catch (err: any) {
    // Fallback inmediato a texto plano para evitar Telegram 400 "can't parse entities"
    try {
      await bot.api.sendMessage(adminId, message.replace(/[*_`\[\]()]/g, ""));
    } catch (err2: any) {
      console.error("❌ Falló el envío de la alerta de Telegram al admin incluso en texto plano:", err2.message);
    }
  }
});

// Configurar el receptor de alertas críticas de Silvania CoreAgent con fallback seguro (solo adminIds)
criticalLogService.registerCallback(async (msg: string) => {
  const adminIds: number[] = (config.marketing?.adminIds && config.marketing.adminIds.length > 0)
    ? config.marketing.adminIds
    : [1572946817];

  for (const adminId of adminIds) {
    try {
      await bot.api.sendMessage(adminId, msg, { parse_mode: "Markdown" });
    } catch (err: any) {
      // Fallback inmediato a texto plano para evitar Telegram 400 "can't parse entities"
      try {
        await bot.api.sendMessage(adminId, msg.replace(/[*_`\[\]()]/g, ""));
      } catch (err2: any) {
        console.error(`❌ Falló el envío de alerta de Telegram de logs críticos al admin ${adminId} en texto plano:`, err2.message);
      }
    }
  }
});

// Manejador global de errores para Grammy
bot.catch(async (err) => {
  const ctx = err.ctx;
  const errorObj = err.error as any;
  const errMsg = errorObj?.message || String(errorObj);
  console.error(`❌ Error en el middleware de Grammy para el update ${ctx.update.update_id}:`, errorObj);
  try {
    const userId = ctx.from?.id || 0;
    await criticalLogService.logCritical(
      "Error Grammy Middleware",
      `Error procesando update para usuario ${userId}: ${errMsg}`
    );
    await ctx.reply("❌ Ocurrió un error inesperado al procesar tu solicitud. Por favor, inténtalo de nuevo.");
  } catch (replyErr: any) {
    console.error("Error intentando avisar al usuario del fallo:", replyErr.message);
  }
});

// Manejadores globales de excepciones a nivel de proceso para evitar crashes en Railway
process.on("unhandledRejection", async (reason: any, promise: Promise<any>) => {
  console.error("❌ RECHAZO DE PROMESA NO CAPTURADO:", reason);
  try {
    await criticalLogService.logCritical(
      "Unhandled Rejection (Crash Prevenido)",
      `Se detectó un rechazo de promesa no capturado. Razón: ${reason?.stack || reason}`
    );
  } catch (logErr: any) {
    console.error("Error guardando log de unhandled rejection:", logErr.message);
  }
});

process.on("uncaughtException", async (error: Error) => {
  console.error("❌ EXCEPCIÓN NO CAPTURADA:", error);
  try {
    await criticalLogService.logCritical(
      "Uncaught Exception (Crash Prevenido)",
      `Se detectó una excepción no capturada. Detalles: ${error.stack || error.message}`
    );
  } catch (logErr: any) {
    console.error("Error guardando log de uncaught exception:", logErr.message);
  }
});

let botUsername = process.env.TELEGRAM_BOT_USERNAME || "Silvania_Core_Agent_Bot";
try {
  console.log("⚙️ Inicializando bot y obteniendo información...");
  await bot.init();
  botUsername = bot.botInfo.username;
  console.log(`🤖 Bot conectado como: @${botUsername}`);
} catch (err: any) {
  console.error("❌ Error inicializando bot:", err.message);
}

const app = express();

// --- HARDENING Y SEGURIDAD HTTP ---
app.disable("x-powered-by");

app.use((req: any, res: any, next: any) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy-Report-Only",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
    "img-src 'self' data:; " +
    "worker-src 'self' blob:; " +
    "connect-src 'self' https://cdn.jsdelivr.net; " +
    "report-uri /api/security/csp-report;"
  );
  next();
});

// Limitador de tasa de peticiones simple en memoria (60 peticiones por minuto por IP)
const requestCounts = new Map<string, { count: number; resetTime: number }>();
function rateLimiter(limit: number, windowMs: number) {
  return (req: any, res: any, next: any) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const now = Date.now();
    const record = requestCounts.get(ip);

    if (!record) {
      requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    record.count++;
    if (record.count > limit) {
      console.warn(`⚠️ [Rate Limit] IP bloqueada temporalmente: ${ip}`);
      logRateLimitEvent(ip, req.path);
      res.status(429).send("Demasiadas solicitudes. Por favor, inténtelo de nuevo más tarde.");
      return;
    }
    next();
  };
}

// Firmado y verificación criptográfica de estados OAuth para prevenir CSRF/Session Hijacking
const STATE_SECRET = process.env.TELEGRAM_TOKEN || "silvaniacoreagent_secret_state";

function generateSecureState(userId: number): string {
  const hash = crypto.createHmac("sha256", STATE_SECRET).update(userId.toString()).digest("hex");
  return `${userId}:${hash}`;
}

function verifySecureState(state: string): number | null {
  if (!state) return null;
  const parts = state.split(":");
  if (parts.length !== 2) return null;
  const userId = parseInt(parts[0]);
  const hash = parts[1];
  if (isNaN(userId)) return null;
  const expectedHash = crypto.createHmac("sha256", STATE_SECRET).update(userId.toString()).digest("hex");
  if (hash !== expectedHash) return null;
  return userId;
}

const PORT = process.env.PORT || 3000;
const publicUrlRaw = process.env.PUBLIC_URL || (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : "");
const PUBLIC_URL = publicUrlRaw.endsWith("/") ? publicUrlRaw.slice(0, -1) : publicUrlRaw;

// Servir archivos multimedia de marketing para APIs públicas de publicación (Instagram Graph API, etc.)
const tempMediaDir = path.join(process.cwd(), "temp");
if (!fs.existsSync(tempMediaDir)) {
  try { fs.mkdirSync(tempMediaDir, { recursive: true }); } catch (_) {}
}
app.use("/marketing-media", express.static(tempMediaDir));

// Servir Landing Page dinámica con Rate Limiting
app.get("/", rateLimiter(60, 60000), (req: any, res: any) => {
  try {
    const htmlPath = path.join(process.cwd(), "public", "index.html");
    if (fs.existsSync(htmlPath)) {
      let html = fs.readFileSync(htmlPath, "utf8");
      html = html.replace(/{{BOT_USERNAME}}/g, botUsername);
      res.send(html);
    } else {
      res.status(404).send("Landing page no encontrada.");
    }
  } catch (err: any) {
    console.error("Error sirviendo landing page:", err);
    res.status(500).send("Error interno.");
  }
});

// --- RUTAS DE FACTURACIÓN Y PASARELA DE PAGOS ---

// Redirección a pasarela de Stripe o simulador local
app.get("/checkout", rateLimiter(10, 60000), async (req: any, res: any) => {
  const userIdStr = req.query.userId;
  if (!userIdStr) {
    return res.status(400).send("Falta el parámetro userId.");
  }
  const userId = parseInt(userIdStr);
  if (isNaN(userId)) {
    return res.status(400).send("userId inválido.");
  }

  const requestedPlan = String(req.query.plan || "").toLowerCase();
  const isProSetterPlan = requestedPlan === "pro_setter";
  if (isProSetterPlan && process.env.ENABLE_PRO_SETTER_CHECKOUT !== "true") {
    return res.status(403).send("Plan CoreAgent Pro + Setter IA (49€/mes) en preparación — próximamente disponible.");
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.log(`⚠️ Stripe Key no configurada. Redirigiendo a simulador para usuario ${userId}`);
    return res.redirect(`/checkout-simulator?userId=${userId}`);
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" as any });
    const redirectUrl = PUBLIC_URL || `http://localhost:${PORT}`;
    const planProductName = isProSetterPlan
      ? "Silvania CoreAgent Pro + Setter IA"
      : "Silvania CoreAgent Premium";
    const planDescription = isProSetterPlan
      ? "Asistente ejecutivo + Setter IA conectado con Unipile y Google Calendar"
      : "Tu asistente ejecutivo élite 24/7 desde Telegram";
    const planUnitAmount = isProSetterPlan ? 4900 : 1900; // €49.00 vs €19.00

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: planProductName,
              description: planDescription,
            },
            unit_amount: planUnitAmount,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${redirectUrl}/success?userId=${userId}`,
      cancel_url: `${redirectUrl}/cancel?userId=${userId}`,
      client_reference_id: userId.toString(),
    });

    res.redirect(session.url!);
  } catch (err: any) {
    console.error("❌ Error creando sesión de Stripe:", err.message);
    res.status(500).send(`Error iniciando checkout: ${err.message}`);
  }
});

// Simulador de pago interactivo (cuando no hay Stripe API keys configuradas)
app.get("/checkout-simulator", rateLimiter(30, 60000), (req: any, res: any) => {
  const userIdStr = req.query.userId;
  if (!userIdStr) {
    return res.status(400).send("Falta el parámetro userId.");
  }
  const userId = parseInt(userIdStr);
  if (isNaN(userId)) {
    return res.status(400).send("userId inválido.");
  }

  res.send(`
    <html>
      <head>
        <title>Pasarela de Pago Segura (Simulador Stripe)</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg-primary: #0a0e17;
            --bg-card: rgba(17, 24, 39, 0.7);
            --accent-cyan: #06b6d4;
            --accent-blue: #3b82f6;
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            --border-color: rgba(255, 255, 255, 0.08);
          }
          body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-main);
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent),
                        radial-gradient(circle at bottom left, rgba(6, 182, 212, 0.1), transparent);
          }
          .card {
            background: var(--bg-card);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 40px;
            max-width: 450px;
            width: 90%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
            text-align: center;
          }
          .logo {
            font-size: 2rem;
            font-weight: 800;
            background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 24px;
          }
          .amount {
            font-size: 3rem;
            font-weight: 800;
            color: var(--text-main);
            margin: 16px 0;
          }
          .amount span {
            font-size: 1.2rem;
            color: var(--text-muted);
            font-weight: 400;
          }
          .input-group {
            text-align: left;
            margin-bottom: 16px;
          }
          label {
            display: block;
            font-size: 0.85rem;
            color: var(--text-muted);
            margin-bottom: 6px;
            font-weight: 600;
          }
          input {
            width: 100%;
            box-sizing: border-box;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 12px 16px;
            color: var(--text-main);
            font-size: 1rem;
            transition: all 0.3s ease;
          }
          input:focus {
            outline: none;
            border-color: var(--accent-cyan);
            box-shadow: 0 0 10px rgba(6, 182, 212, 0.2);
          }
          .row {
            display: flex;
            gap: 16px;
          }
          .btn-pay {
            background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue));
            color: #ffffff;
            border: none;
            border-radius: 14px;
            padding: 16px;
            width: 100%;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 10px;
            box-shadow: 0 4px 15px rgba(6, 182, 212, 0.3);
          }
          .btn-pay:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(6, 182, 212, 0.5);
          }
          .btn-pay:active {
            transform: translateY(0);
          }
          .badge {
            background: rgba(234, 179, 8, 0.1);
            color: #eab308;
            border: 1px solid rgba(234, 179, 8, 0.2);
            border-radius: 20px;
            padding: 6px 12px;
            font-size: 0.8rem;
            display: inline-block;
            margin-bottom: 20px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">🛠️ MODO SIMULACIÓN ACTIVO</div>
          <div class="logo">SILVANIA AI</div>
          <div style="font-size: 1.1rem; font-weight: 600;">Suscripción Premium</div>
          <div class="amount">19,00 €<span>/mes</span></div>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 24px;">Esta es una pasarela de pago de simulación para desarrollo y pruebas. No se realizará ningún cargo real.</p>
          
          <form id="payment-form">
            <div class="input-group">
              <label>Número de Tarjeta (Ficticia)</label>
              <input type="text" value="4242 4242 4242 4242" disabled>
            </div>
            <div class="row">
              <div class="input-group" style="flex: 1;">
                <label>Vence</label>
                <input type="text" value="12 / 29" disabled>
              </div>
              <div class="input-group" style="flex: 1;">
                <label>CVC</label>
                <input type="text" value="123" disabled>
              </div>
            </div>
            <button type="submit" class="btn-pay" id="pay-btn">Confirmar Pago Simulado ⚡</button>
          </form>
        </div>
        
        <script>
          const form = document.getElementById('payment-form');
          const btn = document.getElementById('pay-btn');
          const userId = ${userId};
          
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            btn.disabled = true;
            btn.innerText = 'Procesando pago... ⏳';
            
            try {
              const res = await fetch('/api/mock-checkout-success', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
              });
              
              const data = await res.json();
              if (data.success) {
                window.location.href = '/success?userId=' + userId;
              } else {
                alert('Error al simular el pago.');
                btn.disabled = false;
                btn.innerText = 'Confirmar Pago Simulado ⚡';
              }
            } catch (err) {
              alert('Error de conexión con el servidor.');
              btn.disabled = false;
              btn.innerText = 'Confirmar Pago Simulado ⚡';
            }
          });
        </script>
      </body>
    </html>
  `);
});

// Endpoint del simulador para activar la cuenta
app.post("/api/mock-checkout-success", rateLimiter(20, 60000), express.json(), async (req: any, res: any) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: "Falta userId" });
  }
  try {
    await dbService.createOrUpdateSubscription(userId, "active", "cus_mock_" + userId, "sub_mock_" + userId, null);
    
    // Avisar por Telegram
    try {
      await bot.api.sendMessage(userId, `🎉 **¡Suscripción Activada!**\n\nGracias por suscribirte al Plan Premium de Silvania CoreAgent (€19/mes).\n\nTu cuenta ha sido desbloqueada por completo y ya puedes interactuar de nuevo con todas mis capacidades.`);
    } catch (err: any) {
      console.error("❌ Error enviando alerta de pago a Telegram:", err.message);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("❌ Error activando suscripción simulada:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Webhook de Stripe (Soporta eventos de Stripe reales)
app.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req: any, res: any) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    if (webhookSecret && sig && process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" as any });
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // Fallback sin verificación para pruebas locales o simulación manual
      event = JSON.parse(req.body.toString());
    }
  } catch (err: any) {
    console.error("❌ Error verificando firma de webhook de Stripe:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`🔔 Evento Stripe recibido: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userIdStr = session.client_reference_id;
        const stripeCustomerId = session.customer;
        const stripeSubscriptionId = session.subscription;

        if (userIdStr) {
          const userId = parseInt(userIdStr);
          await dbService.createOrUpdateSubscription(userId, "active", stripeCustomerId, stripeSubscriptionId, null);
          try {
            await bot.api.sendMessage(userId, `🎉 **¡Suscripción Activada!**\n\nGracias por suscribirte al Plan Premium de Silvania CoreAgent (€19/mes).\n\nTu cuenta ha sido desbloqueada por completo y ya puedes interactuar de nuevo con todas mis capacidades.`);
          } catch (err: any) {
            console.error("❌ Error enviando alerta de pago a Telegram:", err.message);
          }
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const stripeCustomerId = invoice.customer;
        const stripeSubscriptionId = invoice.subscription;
        if (stripeCustomerId) {
          const userId = await dbService.getUserIdByStripeCustomerId(stripeCustomerId);
          if (userId) {
            await dbService.createOrUpdateSubscription(userId, "active", stripeCustomerId, stripeSubscriptionId, null);
            console.log(`✅ Suscripción de usuario ${userId} confirmada/renovada.`);
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const stripeSubscriptionId = sub.id;
        if (stripeSubscriptionId) {
          const userId = await dbService.getUserIdByStripeSubscriptionId(stripeSubscriptionId);
          if (userId) {
            await dbService.createOrUpdateSubscription(userId, "canceled", null, stripeSubscriptionId, null);
            try {
              await bot.api.sendMessage(userId, `⚠️ **Suscripción Cancelada**\n\nTu suscripción Premium ha sido cancelada. Tu cuenta se bloqueará al expirar el periodo en curso si no se reactiva.\n\nSi crees que esto es un error, por favor contacta con soporte.`);
            } catch (err: any) {
              console.error("❌ Error enviando alerta de cancelación a Telegram:", err.message);
            }
          }
        }
        break;
      }
    }
  } catch (err: any) {
    console.error("❌ Error de procesamiento en webhook:", err.message);
  }

  res.json({ received: true });
});

// Webhook Nivel 2: Ingesta de mensajes de prospectos de LinkedIn (SetterLink AI / Chrome Extension / Simulador)
app.post("/api/setter/incoming-message", express.json(), async (req: any, res: any) => {
  try {
    const { leadName, leadRole, messageText, leadProfileUrl, personaKey, chatId } = req.body;
    if (!leadName || !messageText) {
      return res.status(400).json({ error: "leadName and messageText are required" });
    }
    const adminId = chatId || config.marketing?.adminIds?.[0] || 1572946817;
    const { leadSetter } = await import("./services/leadSetter.js");
    const pending = await leadSetter.createPendingLeadReply({
      leadName,
      leadRole: leadRole || "Profesional B2B",
      leadProfileUrl,
      messageText,
      personaKey,
      chatId: adminId
    });
    await leadSetter.sendApprovalAlert(bot, adminId, pending);
    return res.json({ success: true, pendingId: pending.id });
  } catch (err: any) {
    console.error("❌ Error en webhook incoming-message:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Webhook Unipile (LinkedIn / Instagram / WhatsApp / Email): ingesta automática -> HITL Telegram -> Envío + Google Calendar
app.post("/api/unipile/webhook", express.json(), async (req: any, res: any) => {
  try {
    const { unipileService } = await import("./services/unipileService.js");
    const parsed = unipileService.parseWebhookPayload(req.body);
    if (!parsed) {
      return res.json({ ignored: true, reason: "non_message_or_empty" });
    }
    if (parsed.isSelf) {
      return res.json({ ignored: true, reason: "self_echo" });
    }

    const adminId = Number(req.query.userId) || config.marketing?.adminIds?.[0] || 1572946817;
    const { leadSetter } = await import("./services/leadSetter.js");
    const pending = await leadSetter.createPendingLeadReply({
      leadName: parsed.senderName,
      leadRole: parsed.senderRole || "Profesional B2B",
      leadProfileUrl: parsed.senderProfileUrl,
      messageText: parsed.messageText,
      chatId: adminId,
      unipileChatId: parsed.chatId,
      channel: parsed.provider,
    });
    await leadSetter.processIncomingLeadMessage(bot, adminId, pending);
    return res.json({ success: true, pendingId: pending.id, channel: parsed.provider, mode: leadSetter.getSetterMode(adminId) });
  } catch (err: any) {
    console.error("❌ Error en webhook /api/unipile/webhook:", err);
    return res.status(500).json({ error: err.message });
  }
});

// CORS para Widget Web Embebible ("Habla con Silvania") y audios de voz
app.use(["/api/widget", "/widget.js", "/marketing-media"], (req: any, res: any, next: any) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Widget Web "Habla con Silvania" (Voz Lucía por defecto + Diálogo + Setter IA + Calendar)
app.post("/api/widget/chat", rateLimiter(40, 60000), express.json(), async (req: any, res: any) => {
  try {
    const { message, history, agentId, voice } = req.body || {};
    const userMessage = String(message || "").trim();
    if (!userMessage) {
      return res.status(400).json({ success: false, error: "El mensaje no puede estar vacío." });
    }

    const adminId = config.marketing?.adminIds?.[0] || 1572946817;
    const { leadSetter } = await import("./services/leadSetter.js");
    const slots = await leadSetter.getSuggestedCalendarSlots(adminId);

    const systemPrompt =
      `Eres Silvania, la voz ejecutiva de Silvania.ai (La Primera Oficina Ejecutiva Inteligente).\n` +
      `Hablas en primera persona femenina, con un tono cercano, empático, natural y sin vender humo en español.\n\n` +
      `GUION CONVERSACIONAL PASO A PASO (SIGUE EL FLUJO SEGÚN EL HISTORIAL):\n` +
      `- El saludo inicial ya fue: "¡Hola! Soy Silvania. ¿Con quién tengo el gusto?"\n` +
      `- PASO 1 (Cuando el visitante te diga su nombre): Responde con calidez: "Mucho gusto, [Nombre]. Cuéntame un poco, ¿a qué te dedicas?"\n` +
      `- PASO 2 (Cuando te cuente a qué se dedica): Empatiza de verdad con las funciones, presiones y labores reales de esa faena concreta. Luego pregunta: "Y cuéntame un poco más, ¿cuál es el desafío que enfrentas día a día y que te quita más tiempo?"\n` +
      `- PASO 3 (Cuando te cuente su desafío o qué le quita más tiempo): Dile: "En Silvania hemos creado un ecosistema inteligente para ayudar a microempresarios y autónomos a gestionar su día a día y ahorrar mucho tiempo en tareas rutinarias, tales como..." y explícale de forma honesta y sin vender humo cómo puede ayudarle en SU ámbito concreto cada agente:\n` +
      `  1. CoreAgent (Operativo): Su oficina ejecutiva en Telegram (voz y texto) conectada a Google Workspace (Calendar, Gmail, Drive, Sheets) para ejecutar trabajo real.\n` +
      `  2. Marketing Agent (Operativo): Crea y publica contenido audiovisual en sus redes para darle presencia sin robarle horas.\n` +
      `  3. Setter Agent asistido por IA con control humano HITL (En validación): Captura mensajes de clientes y le envía la respuesta propuesta a Telegram para aprobar en 1 clic.\n` +
      `  (Si menciona educación o logopedia, existe también EVA, nuestro agente logopeda en evolución).\n` +
      `- PASO 4 (Invitación y Cierre de Cita — OBLIGATORIO): Antes de ofrecer los huecos, dile siempre que estamos en fase de validación privada invitando a ciertos grupos de profesionales donde Silvania pueda serles de ayuda real, ofreciendo acceso gratuito a cambio de su feedback y testimonio. Y termina exactamente con: "¿Qué te parece? ¡Genial, verdad! Tengo dos huecos disponibles para esta semana con nuestro fundador: ${slots.primaryLabel} o ${slots.secondaryLabel}. ¿Cuál te viene mejor?"\n` +
      `- PASO 5 (Si el visitante elige día por voz o texto sin usar el botón): NUNCA des la cita por confirmada todavía ni le pidas que dicte el correo por voz. Dile con naturalidad: "¡Perfecto! Para enviarte la invitación de Google Meet sin errores, por favor introduce tu nombre y tu correo electrónico en el formulario verde que acabo de abrirte aquí abajo."\n\n` +
      `REGLAS ESTRICTAS:\n` +
      `1. PROHIBIDO dar precios, tarifas o cifras en euros (ni 19€, ni 49€, ni 50€, ni 60€). Si pregunta por precios, recuérdale que estamos en fase de validación privada con acceso gratuito a cambio de feedback, testimonio y una breve cita de activación.\n` +
      `2. Ve paso a paso: NO saltes al Paso 3 ni sueltes todo el discurso en el primer mensaje. Escucha primero su nombre, luego su profesión y luego su desafío.\n` +
      `3. Sé breve en los pasos 1 y 2 (2 frases cálidas). En el Paso 3-4 sé clara, concisa (máximo 900 caracteres en total) y fácil de escuchar en voz alta con la voz de Lucía (sin asteriscos ni markdown).\n` +
      `4. Si el visitante pide directamente agendar una cita/demo/prueba, pasa directo a ofrecerle los dos huecos libres (${slots.primaryLabel} o ${slots.secondaryLabel}).`;

    const formattedHistory = Array.isArray(history)
      ? history
          .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-8)
          .map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content }))
      : [];

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...formattedHistory,
      { role: "user" as const, content: userMessage },
    ];

    let replyText = "";
    try {
      const llmRes = await llmService.chatSimple(messages);
      replyText = llmRes?.content ? String(llmRes.content).trim() : "";
    } catch (llmErr: any) {
      console.warn("⚠️ [Widget Chat] Fallback LLM:", llmErr.message);
    }

    if (!replyText) {
      replyText = `¡Mucho gusto! En Silvania hemos creado un ecosistema inteligente para ayudar a microempresarios y autónomos a ahorrar tiempo en tareas rutinarias. Estamos en fase de validación a cambio de feedback y testimonio; tengo dos huecos disponibles esta semana: ${slots.primaryLabel} o ${slots.secondaryLabel}.`;
    }

    const normUser = userMessage.toLowerCase();
    const day1Word = slots.primaryLabel.split(",")[0].trim().toLowerCase();
    const day2Word = slots.secondaryLabel.split(",")[0].trim().toLowerCase();
    const historyMentionedSlots = formattedHistory.some(
      (m) => m.role === "assistant" && (/huecos disponibles/i.test(m.content) || m.content.includes(day1Word) || m.content.includes(day2Word))
    );

    let autoOpenSlot: { start: string; label: string } | null = null;
    if (historyMentionedSlots) {
      if ((day1Word && normUser.includes(day1Word)) || /\b(primer[oa]?|opci[oó]n 1|10:30)\b/i.test(normUser)) {
        autoOpenSlot = { start: slots.primaryStart, label: slots.primaryLabel };
      } else if ((day2Word && normUser.includes(day2Word)) || /\b(segund[oa]?|opci[oó]n 2|16:30)\b/i.test(normUser)) {
        autoOpenSlot = { start: slots.secondaryStart, label: slots.secondaryLabel };
      }
    }

    const wantsBooking =
      Boolean(autoOpenSlot) ||
      /cita|reuni[oó]n|demo|agendar|agenda|reservar|hueco|horario|llamar|llamada/i.test(userMessage) ||
      /huecos disponibles|cu[aá]l te viene mejor|cu[aá]l te encaja/i.test(replyText) ||
      replyText.includes(slots.primaryLabel) ||
      replyText.includes(slots.secondaryLabel);

    const voiceChoice = String(voice || "Lucia").trim() || "Lucia";
    let audioUrls: string[] = [];
    try {
      const cleanSpeech = cleanTextForTTS(replyText);
      const audioPaths = await voiceService.textToSpeech(cleanSpeech, 0, voiceChoice);
      if (audioPaths && audioPaths.length > 0) {
        audioUrls = audioPaths
          .filter((p) => fs.existsSync(p))
          .map((p) => `/marketing-media/${path.basename(p)}`);
      }
    } catch (ttsErr: any) {
      console.warn("⚠️ [Widget Chat] Falló síntesis TTS de Lucía:", ttsErr.message);
    }

    return res.json({
      success: true,
      agentId: agentId || "silvania",
      voice: voiceChoice,
      replyText,
      audioUrl: audioUrls[0] || null,
      audioUrls,
      showBookingSlots: wantsBooking,
      autoOpenSlot,
      slots: [
        { start: slots.primaryStart, label: slots.primaryLabel },
        { start: slots.secondaryStart, label: slots.secondaryLabel },
      ],
    });
  } catch (err: any) {
    console.error("❌ Error en /api/widget/chat:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Agendamiento directo en Google Calendar desde el Widget Web ("Habla con Silvania")
app.post("/api/widget/book", rateLimiter(15, 60000), express.json(), async (req: any, res: any) => {
  try {
    const { name, email, slotStart, slotLabel, voice, agentId } = req.body || {};
    const leadName = String(name || "").trim();
    const leadEmail = String(email || "").trim();
    const startRaw = String(slotStart || "").trim();

    if (!leadName || !leadEmail || !startRaw) {
      return res.status(400).json({ success: false, error: "Faltan datos obligatorios (nombre, email y fecha)." });
    }

    const adminId = config.marketing?.adminIds?.[0] || 1572946817;
    const { calendarCreate } = await import("./tools/calendar.js");

    const startDate = new Date(startRaw);
    const endDate = new Date(startDate.getTime() + 30 * 60000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const endIso = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;

    const calResult = await calendarCreate(
      adminId,
      `Acceso Anticipado Silvania AI - ${leadName}`,
      startRaw,
      endIso,
      `Sesión de validación y acceso gratuito (condicionado a feedback y testimonio) agendada desde el Widget Web ("Habla con Silvania" · ${agentId || "silvania"}).\nParticipante: ${leadName}\nEmail: ${leadEmail}`,
      [leadEmail]
    );

    const confirmationText = `¡Perfecto ${leadName}! Ya he reservado tu cita de acceso anticipado con nuestro fundador para el ${slotLabel || startRaw}. Te acabo de enviar la invitación con el enlace de Google Meet a ${leadEmail}. ¡Nos vemos pronto!`;

    const voiceChoice = String(voice || "Lucia").trim() || "Lucia";
    let audioUrl: string | null = null;
    try {
      const cleanSpeech = cleanTextForTTS(confirmationText);
      const audioPaths = await voiceService.textToSpeech(cleanSpeech, 0, voiceChoice);
      if (audioPaths && audioPaths.length > 0 && fs.existsSync(audioPaths[0])) {
        audioUrl = `/marketing-media/${path.basename(audioPaths[0])}`;
      }
    } catch (ttsErr: any) {
      console.warn("⚠️ [Widget Book] Falló síntesis TTS:", ttsErr.message);
    }

    try {
      await bot.api.sendMessage(
        adminId,
        `🎉 *NUEVA CITA AGENDADA DESDE WIDGET WEB ("Habla con Silvania")*\n\n` +
        `👤 *Lead:* ${leadName}\n` +
        `📧 *Email:* ${leadEmail}\n` +
        `📅 *Fecha:* ${slotLabel || startRaw}\n` +
        `🎙️ *Voz:* ${voiceChoice}\n\n` +
        `${calResult}`,
        { parse_mode: "Markdown" }
      );
    } catch (tgErr: any) {
      console.warn("⚠️ No se pudo enviar notificación Telegram de cita web:", tgErr.message);
    }

    return res.json({
      success: true,
      replyText: confirmationText,
      audioUrl,
      calendarResult: calResult,
    });
  } catch (err: any) {
    console.error("❌ Error en /api/widget/book:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Páginas de éxito y cancelación
app.get("/success", (req: any, res: any) => {
  res.send(`
    <html>
      <head>
        <title>¡Gracias por tu pago! - Silvania AI</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg-primary: #0a0e17;
            --accent-green: #10b981;
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
          }
          body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-main);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: radial-gradient(circle at top right, rgba(16, 185, 129, 0.1), transparent);
          }
          .card {
            background: rgba(17, 24, 39, 0.7);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            padding: 40px;
            max-width: 450px;
            width: 90%;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          }
          h1 {
            color: var(--accent-green);
            margin-bottom: 16px;
            font-size: 2.2rem;
          }
          p {
            color: var(--text-muted);
            font-size: 1.1rem;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>⚡ ¡Pago Exitoso!</h1>
          <p>Tu cuenta ha sido activada correctamente. Ya puedes regresar a Telegram y continuar usando Silvania CoreAgent.</p>
        </div>
      </body>
    </html>
  `);
});

app.get("/cancel", (req: any, res: any) => {
  res.send(`
    <html>
      <head>
        <title>Pago Cancelado - Silvania AI</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg-primary: #0a0e17;
            --accent-red: #ef4444;
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
          }
          body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-main);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: radial-gradient(circle at top right, rgba(239, 68, 68, 0.1), transparent);
          }
          .card {
            background: rgba(17, 24, 39, 0.7);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            padding: 40px;
            max-width: 450px;
            width: 90%;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          }
          h1 {
            color: var(--accent-red);
            margin-bottom: 16px;
            font-size: 2.2rem;
          }
          p {
            color: var(--text-muted);
            font-size: 1.1rem;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>❌ Proceso Cancelado</h1>
          <p>El proceso de pago fue cancelado. Si cambias de opinión o deseas suscribirte más tarde, puedes hacerlo desde Telegram.</p>
        </div>
      </body>
    </html>
  `);
});

// Servir archivos estáticos y rutas amigables
app.get("/privacy", (req: any, res: any) => res.sendFile(path.join(process.cwd(), "public", "privacy.html")));
app.get("/terms", (req: any, res: any) => res.sendFile(path.join(process.cwd(), "public", "terms.html")));
function renderFounderGatedPage(req: any, res: any, agentTitle: string, targetFile: string) {
  const queryKey = (req.query?.admin || req.query?.key || req.query?.pin || req.query?.preview || "").toString().trim().toLowerCase();
  const cookies = req.headers?.cookie || "";
  const isCookieAuth = cookies.includes("silvania_founder=true");
  const isKeyAuth = queryKey === "silvania" || queryKey === "silvania2026" || queryKey === "admin" || queryKey === "1234";

  if (isKeyAuth || isCookieAuth) {
    if (isKeyAuth) {
      res.setHeader("Set-Cookie", "silvania_founder=true; Path=/; Max-Age=2592000; SameSite=Lax");
    }
    const htmlPath = path.join(process.cwd(), "founder_views", targetFile);
    if (fs.existsSync(htmlPath)) {
      let html = fs.readFileSync(htmlPath, "utf8");
      html = html.replace(/{{BOT_USERNAME}}/g, botUsername);
      return res.send(html);
    } else {
      return res.redirect("/founder");
    }
  }

  // Redirigir al portal del fundador si no está autenticado
  return res.redirect("/founder");
}

// ============================================================================
// RUTAS PÚBLICAS DE AGENTES EN DESARROLLO (Redirección incondicional al Hub)
// ============================================================================
app.get(["/eva", "/evaagent", "/eva-landing", "/eva.html", "/eva-landing.html"], (req: any, res: any) => {
  return res.redirect("/#eva");
});

app.get(["/marketing", "/marketing.html"], (req: any, res: any) => {
  return res.redirect("/#marketing");
});

// ============================================================================
// ACCESO PRIVADO EXCLUSIVO PARA EL FUNDADOR (/founder/*)
// ============================================================================
app.get("/founder/eva", rateLimiter(60, 60000), (req: any, res: any) => {
  return renderFounderGatedPage(req, res, "Eva Agent (Entorno de Pruebas)", "eva.html");
});

app.get("/founder/eva-landing", rateLimiter(60, 60000), (req: any, res: any) => {
  return renderFounderGatedPage(req, res, "Eva Agent Showcase", "eva-landing.html");
});

app.get("/founder/marketing", rateLimiter(60, 60000), (req: any, res: any) => {
  return renderFounderGatedPage(req, res, "Silvania Marketing Studio", "marketing.html");
});

// Portal Central de Fundador
app.get(["/founder", "/founder/hub"], rateLimiter(60, 60000), (req: any, res: any) => {
  const queryKey = (req.query?.admin || req.query?.key || req.query?.pin || req.query?.preview || "").toString().trim().toLowerCase();
  const cookies = req.headers?.cookie || "";
  const isCookieAuth = cookies.includes("silvania_founder=true");
  const isKeyAuth = queryKey === "silvania" || queryKey === "silvania2026" || queryKey === "admin" || queryKey === "1234";

  if (isKeyAuth || isCookieAuth) {
    if (isKeyAuth) {
      res.setHeader("Set-Cookie", "silvania_founder=true; Path=/; Max-Age=2592000; SameSite=Lax");
    }
    return res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Silvania Labs · Portal de Fundador</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;800&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at top, #0f172a 0%, #030712 100%);
      color: #f8fafc;
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.5rem;
    }
    .portal-card {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 28px;
      padding: 3rem 2.5rem;
      max-width: 700px;
      width: 100%;
      backdrop-filter: blur(25px);
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 0.4rem 1.1rem;
      border-radius: 50px;
      font-size: 0.85rem;
      font-weight: 700;
      margin-bottom: 1.2rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.2rem;
      font-weight: 800;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, #fff 40%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.subtitle {
      color: #94a3b8;
      font-size: 1rem;
      margin-bottom: 2.5rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.2rem;
      margin-bottom: 2rem;
      text-align: left;
    }
    .agent-item {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      padding: 1.5rem;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.25s ease;
    }
    .agent-item:hover {
      background: rgba(255, 255, 255, 0.08);
      transform: translateY(-4px);
      border-color: rgba(56, 189, 248, 0.5);
      box-shadow: 0 15px 30px rgba(0, 0, 0, 0.4);
    }
    .agent-item.marketing:hover {
      border-color: rgba(245, 158, 11, 0.6);
    }
    .agent-item.eva:hover {
      border-color: rgba(192, 132, 252, 0.6);
    }
    .item-icon {
      font-size: 1.8rem;
      margin-bottom: 1rem;
    }
    .agent-item.marketing .item-icon { color: #fbbf24; }
    .agent-item.eva .item-icon { color: #c084fc; }
    .item-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 0.4rem;
      color: #fff;
    }
    .item-desc {
      font-size: 0.88rem;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 1.2rem;
    }
    .item-btn {
      font-size: 0.88rem;
      font-weight: 700;
      color: #38bdf8;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .agent-item.marketing .item-btn { color: #fbbf24; }
    .agent-item.eva .item-btn { color: #c084fc; }
    .footer-note {
      color: #64748b;
      font-size: 0.85rem;
    }
    .footer-note a {
      color: #94a3b8;
      text-decoration: none;
    }
    .footer-note a:hover {
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="portal-card">
    <div class="badge"><i class="fa-solid fa-flask"></i> Silvania Labs · Acceso Privado</div>
    <h1>Panel de Desarrollo de Agentes</h1>
    <p class="subtitle">Entornos de prueba exclusivos para el fundador. Las rutas públicas están 100% protegidas y redirigen al Hub.</p>
    
    <div class="grid">
      <a href="/founder/marketing" class="agent-item marketing">
        <div>
          <div class="item-icon"><i class="fa-solid fa-bullhorn"></i></div>
          <div class="item-title">Silvania Marketing Studio</div>
          <div class="item-desc">Generador de copys, artículos SEO, guiones de vídeo para YouTube y TikTok, y difusión.</div>
        </div>
        <div class="item-btn">Abrir Marketing Studio <i class="fa-solid fa-arrow-right"></i></div>
      </a>

      <a href="/founder/eva" class="agent-item eva">
        <div>
          <div class="item-icon"><i class="fa-solid fa-child-reaching"></i></div>
          <div class="item-title">Eva Agent (Laboratorio)</div>
          <div class="item-desc">Pruebas en tiempo real de voz interactiva, cámara MediaPipe, minimundos y minijuego de burbujas.</div>
        </div>
        <div class="item-btn">Abrir Entorno Eva <i class="fa-solid fa-arrow-right"></i></div>
      </a>
    </div>

    <div style="margin-top: 1rem; display: flex; justify-content: center; gap: 1.5rem; flex-wrap: wrap;">
      <a href="/founder/eva-landing" style="color: #94a3b8; font-size: 0.9rem; text-decoration: none;"><i class="fa-solid fa-globe"></i> Ver Showcase de Eva</a>
      <a href="/coreagent" style="color: #94a3b8; font-size: 0.9rem; text-decoration: none;"><i class="fa-solid fa-cube"></i> Silvania CoreAgent</a>
      <a href="/" style="color: #64748b; font-size: 0.9rem; text-decoration: none;"><i class="fa-solid fa-house"></i> Ir a la Home Pública</a>
    </div>
  </div>
</body>
</html>`);
  }

  // Si no está autenticado, renderizar formulario para introducir PIN
  return res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acceso de Fundador | Silvania.ai</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;800&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #030712;
      color: #f8fafc;
      font-family: 'Plus Jakarta Sans', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }
    .gate-card {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 28px;
      padding: 3rem 2.2rem;
      max-width: 450px;
      width: 100%;
      text-align: center;
      backdrop-filter: blur(25px);
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6);
    }
    .badge {
      display: inline-block;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 0.35rem 0.9rem;
      border-radius: 50px;
      font-size: 0.82rem;
      font-weight: 700;
      margin-bottom: 1.2rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 2rem;
      font-weight: 800;
      margin-bottom: 0.6rem;
    }
    p {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    input {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 14px;
      padding: 0.95rem 1rem;
      color: #fff;
      font-size: 1.05rem;
      text-align: center;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus {
      border-color: #38bdf8;
    }
    button {
      background: linear-gradient(135deg, #0284c7, #6366f1);
      border: none;
      color: white;
      padding: 0.95rem;
      border-radius: 14px;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      box-shadow: 0 10px 25px rgba(99, 102, 241, 0.35);
      transition: transform 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
    }
    .back-link {
      display: inline-block;
      margin-top: 1.8rem;
      color: #64748b;
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.2s;
    }
    .back-link:hover {
      color: #cbd5e1;
    }
  </style>
</head>
<body>
  <div class="gate-card">
    <div class="badge">🔒 Silvania Labs · Modo Privado</div>
    <h2>Portal de Fundador</h2>
    <p>Introduce tu clave de fundador para acceder a los paneles de desarrollo y prueba de los agentes.</p>
    <form method="GET" action="/founder">
      <input type="password" name="admin" placeholder="Introduce el PIN de Fundador" autofocus required />
      <button type="submit">Entrar al Portal</button>
    </form>
    <a href="/" class="back-link">← Volver al Hub Principal (Silvania.ai)</a>
  </div>
</body>
</html>`);
});
app.get("/coreagent", rateLimiter(60, 60000), (req: any, res: any) => {
  try {
    const htmlPath = path.join(process.cwd(), "public", "coreagent.html");
    if (fs.existsSync(htmlPath)) {
      let html = fs.readFileSync(htmlPath, "utf8");
      html = html.replace(/{{BOT_USERNAME}}/g, botUsername);
      res.send(html);
    } else {
      res.sendFile(path.join(process.cwd(), "public", "index.html"));
    }
  } catch (err: any) {
    console.error("Error sirviendo coreagent page:", err);
    res.status(500).send("Error interno.");
  }
});
app.use(express.static("public"));

// Endpoint para la interacción conversacional en tiempo real con Eva (Logopedia & Pronunciación)
app.post("/api/eva-chat", rateLimiter(40, 60000), express.json(), async (req: any, res: any) => {
  try {
    const { message, history, exerciseContext, cameraActive, userProfile, sessionScoresHistory, currentMission } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Falta el mensaje del usuario." });
    }

    const name = userProfile?.name || "";
    const age = parseInt(userProfile?.age || "0", 10);
    const difficulty = userProfile?.difficulty || "";
    const style = userProfile?.style || "";

    const missionWorld = currentMission?.worldName || "";
    const missionTitle = currentMission?.missionName || "";
    const starsCount = currentMission?.starsCount || 0;
    const badgesEarned = Array.isArray(currentMission?.badges) ? currentMission.badges.join(", ") : "";

    const scoresHistoryText = Array.isArray(sessionScoresHistory) && sessionScoresHistory.length > 0
      ? sessionScoresHistory.map((h: any) => `- Ejercicio: "${h.exerciseName}" | Frase modelo: "${h.targetText}" | Lo que dijo: "${h.userText}" | Precisión real: ${h.score}%`).join("\n")
      : "Ninguno en esta sesión.";

    const systemPrompt = `Eres Eva, una entrenadora de voz y logopeda inteligente de Silvania.ai. Tu objetivo es interactuar de manera empática y natural con niños y adultos para mejorar su dicción y agilidad verbal.

🔷 DATOS DEL PERFIL DEL USUARIO:
- Nombre: ${name || "Desconocido"}
- Edad: ${age || "Desconocida (determina si es niño o adulto)"}
- Dificultades: ${difficulty || "Desconocidas (fonemas a trabajar como R, L, S, etc.)"}
- Estilo: ${style || "Desconocido (divertido/animales o serio/formal)"}

🔷 MAPA DE AVENTURAS INFANTIL Y PROGRESO:
- Mundo actual: ${missionWorld || "La Granja 🚜"}
- Misión activa: ${missionTitle || "Práctica guiada"}
- Estrellas acumuladas: ${starsCount} 🌟
- Insignias obtenidas: ${badgesEarned || "Ninguna aún"}
- Si estás en la Granja o en el Espacio, saluda o anima refiriéndote al mapa ("seguimos en la Granja", "desbloqueamos una estrella", "¡listos para el Espacio!").

🔷 INICIANDO LLAMADA PROACTIVA (onboarding):
Si el mensaje del usuario es exactamente "INICIAR_LLAMADA":
- Tu primer mensaje DEBE ser proactivo buscando información del usuario para completar su perfil de forma amigable (¡nunca sueltes trabalenguas de entrada!).
- Si falta el nombre, saluda proactivamente y pídelo: "¡Hola! Soy Eva, tu logopeda personal. ¿Con quién tengo el gusto de hablar hoy?" o similar.
- Si ya tienes el nombre pero falta la edad, saluda y pídele la edad: "¡Qué lindo saludarte, [Nombre]! ¿Cuántos años tienes para adaptar nuestros juegos?"
- Si tienes nombre y edad, saluda cálidamente y pregúntale si está listo para empezar su clase en ${missionWorld || "La Granja"}.

🔷 INSTRUCCIONES DE ONBOARDING DURANTE DIÁLOGO:
Si falta alguno de los datos del perfil (Nombre, Edad, Dificultad o Estilo) en tus turnos iniciales:
1. Pregúntalo amigablemente e indaga de forma natural (máximo 1 pregunta sencilla por turno).
2. Cuando el usuario te responda, memorízalo y al final de tu respuesta de texto agrega la etiqueta obligatoria para actualizar el perfil:
   [PROFILE: name=Valor, age=Valor, difficulty=Valor, style=Valor]
   Por ejemplo: "¡Hola Eduardo! Qué lindo nombre. [PROFILE: name=Eduardo]" o "Entendido, tienes 6 años. [PROFILE: age=6]"

🔷 EVALUACIÓN CLÍNICA FINAL ("TERMINAR_CLASE"):
Si el mensaje del usuario es "TERMINAR_CLASE" o indica que quiere finalizar la sesión:
- Analiza el historial de puntuaciones reales acumuladas en esta clase:
${scoresHistoryText}
- Genera una evaluación final motivadora y un diagnóstico constructivo de su desempeño, felicitando el esfuerzo y sugiriendo consejos específicos de colocación de la lengua o labios.

🔷 ESTRUCTURA DE LA LECCIÓN (20-25 Minutos):
Cuando guíes la clase, sigue este orden conversacional adaptando los ejercicios (no reinicies la clase si hay saludos intermedios):
- Fase 1: Calentamiento (1-2 min) -> Sonidos de animales/granja para niños, o vocales y respiración para adultos.
- Fase 2: Ejercicio objetivo del día -> Basado en el fonema que le cuesta (L, R, S).
- Fase 3: Modelo -> Ofrece 1 modelo actual: "${exerciseContext || "Práctica libre"}". Explica de forma corta cómo colocar la lengua/labios.
- Fase 4: Práctica -> Evalúa los intentos. Rota a otro ejercicio tras 3 repeticiones (no te estanques en una frase).
- Fase 5: Cierre -> Summary de progreso y pregunta si paramos o seguimos.

🔷 MODO TOLERANTE EN NIÑOS PEQUEÑOS Y DIFICULTADES ALTAS:
Si el alumno es niño (edad <= 7) o tiene dificultad alta:
- Acepta intentos aproximados y variaciones de fonemas comunes (como "natón" por "ratón") como válidos para mantener alta la motivación.
- NO le exijas repetición perfecta literal si el STT se confunde, pero bríndale un tip motor ("coloca la punta de la lengua en el paladar...") e invítale a seguir jugando.
- Evita trabalenguas largos. Usa sílabas ("ra", "ma") y palabras muy cortas de 1 o 2 sílabas.

🔷 MODO META-COMUNICACIÓN:
- Estado actual de la cámara del usuario: ${cameraActive ? "ACTIVA (puedes ver sus labios)" : "DESACTIVADA (no puedes ver sus labios)"}.
- Felicita los movimientos de labios si está activa, o sugiere encenderla si está apagada para guiarle visualmente.

🔷 TRATAMIENTO DE RUIDO, MURMULLOS O SUSURROS:
- Si la transcripción del usuario es muy corta, incomprensible, ruidosa (ej. "ah", "sí", murmullos inconexos o palabras que no se entienden en absoluto), responde exactamente o muy parecido a:
  "Me pareció oír que intentas decir algo, por favor habla un poco más fuerte para que te escuche bien. ¡Vamos!"

🔷 PRIVACIDAD ESTRICTA Y LÍMITES DE PRODUCTO (0 SCOPES GOOGLE):
- Eres exclusivamente Eva, entrenadora de voz y logopeda para familias y niños.
- NO tienes ni prometas acceso a Google Workspace, Gmail, Calendar ni Google Drive.
- La sesión se ejecuta de forma local y privada en navegador; nunca prometas gestionar emails o archivos de oficina ni de menores.

🔷 REGLAS DE FORMATO:
- Sé paciente, empática y lúdica.
- MANTÉN LAS RESPUESTAS CORTAS (1 a 3 frases máximo) para baja latencia conversacional. No uses markdown tosco ni caracteres raros.`;

    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(history) ? history.slice(-6) : []),
      { role: "user", content: message }
    ];

    const replyText = await llmService.chatEva(formattedMessages);
    let finalReply = replyText || "¡Muy bien! Sigamos practicando.";
    let updatedProfile: any = null;

    const profileRegex = /\[PROFILE:\s*([^\]]+)\]/;
    const match = finalReply.match(profileRegex);
    if (match) {
      finalReply = finalReply.replace(profileRegex, "").trim();
      updatedProfile = {};
      const pairs = match[1].split(",");
      pairs.forEach(pair => {
        const [key, val] = pair.split("=");
        if (key && val) {
          updatedProfile[key.trim()] = val.trim();
        }
      });
    }

    res.json({
      reply: finalReply,
      updatedProfile: updatedProfile
    });
  } catch (err: any) {
    console.error("❌ Error en endpoint /api/eva-chat:", err.message);
    res.status(500).json({ error: "Ocurrió un error procesando la voz con Eva." });
  }
});

// Endpoint para obtener la biblioteca completa de ejercicios y lecciones guiadas de 20-25 min
app.get("/api/eva-exercises", rateLimiter(60, 60000), (req: any, res: any) => {
  res.json({
    exercises: EVA_EXERCISES_DATABASE,
    lessons: EVA_LESSONS
  });
});

// Endpoint para recibir reportes de violaciones de CSP
app.post(
  "/api/security/csp-report",
  express.json({ type: ["application/json", "application/csp-report"] }),
  (req: any, res: any) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const report = req.body;
    console.warn(`⚠️ [CSP Violation] IP: ${ip} | Reporte:`, JSON.stringify(report, null, 2));
    logCspViolation(ip, report);
    res.sendStatus(204);
  }
);

// Función para limpiar texto antes de enviarlo al motor de voz
function cleanTextForTTS(text: string): string {
  // 0. Reemplazar correos electrónicos e IDs antes de procesar otros caracteres
  let clean = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, " correo en pantalla ");
  clean = clean.replace(/\b[a-fA-F0-9]{16}\b/g, " ID en pantalla ");
  clean = clean.replace(/\b[a-zA-Z0-9_-]{24,}\b/g, " ID en pantalla ");

  // 1. Reemplazar URLs con "abrir enlace"
  clean = clean.replace(/\b(?:https?:\/\/|www\.)\S+/gi, " abrir enlace ");
  
  // 2. Quitar líneas separadoras largas (como ━━━━━━━━━━━━━)
  clean = clean.replace(/[━─═─_-]{3,}/g, " ");

  // 3. Quitar emojis, dingbats y símbolos unicode raros
  clean = clean.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, " ");

  // 4. Quitar caracteres especiales de markdown y puntuación tosca
  clean = clean.replace(/[*_#`\[\]()\-<>|~+=]/g, " ");

  // 5. Convertir formatos de hora
  clean = clean.replace(/(\d{1,2}):(\d{2})/g, "$1 y $2");

  // 6. Quitar saltos de línea y colapsar espacios múltiples
  return clean
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Auto-corregir errores de transcripción fonética comunes de Whisper (STT) para Silvania AI
function correctTranscription(text: string): string {
  if (!text) return "";
  let corrected = text;
  
  // Reemplazos insensibles a mayúsculas/minúsculas para Spania, Chilpania, chipania, Sylvania, etc.
  corrected = corrected.replace(/\bsylvania\.ai\b/gi, "silvania.ai");
  corrected = corrected.replace(/\bsilvania\s+ai\b/gi, "silvania.ai");
  corrected = corrected.replace(/\bsylvania\s+ai\b/gi, "silvania.ai");
  corrected = corrected.replace(/\bsylvania\b/gi, "silvania");
  corrected = corrected.replace(/\bsilbania\b/gi, "silvania");
  corrected = corrected.replace(/\bspania\b/gi, "silvania");
  corrected = corrected.replace(/\bchilpania\b/gi, "silvania");
  corrected = corrected.replace(/\bchipania\b/gi, "silvania");
  corrected = corrected.replace(/chilpania\.com/gi, "silvania.ai");
  corrected = corrected.replace(/spania\.ai/gi, "silvania.ai");
  corrected = corrected.replace(/silvania\.a-i/gi, "silvania.ai");
  corrected = corrected.replace(/silvania\.a\.i/gi, "silvania.ai");
  corrected = corrected.replace(/spania for agents/gi, "silvania coreagent");
  corrected = corrected.replace(/spania core/gi, "silvania core");

  // Correcciones fonéticas frecuentes de Whisper en español para Google Drive
  corrected = corrected.replace(/\b(en\s+el|al|del|el)\s+(drag|drai|dray|dry|trayo|tray|trai|trall|tralle)\b/gi, "$1 Drive");
  corrected = corrected.replace(/\b(en\s+el)\s+trayecto\s+(carpeta|archivo|documento|familia|padre|esposa|hijo|madre|silvania)\b/gi, "$1 Drive $2");
  
  return corrected;
}

// Función para escapar caracteres especiales de Telegram Markdown (V1)
function escapeMarkdown(text: string): string {
  if (!text) return "";
  // En Markdown V1, los caracteres que inician entidades son *, _, `, [
  // Escapamos con backslash.
  return text.replace(/([*_`\[])/g, "\\$1");
}

function splitTextIntoSafeChunks(text: string, maxLength: number = 3900): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let currentChunk = "";

  for (const line of lines) {
    if (line.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      let remaining = line;
      while (remaining.length > maxLength) {
        chunks.push(remaining.substring(0, maxLength));
        remaining = remaining.substring(maxLength);
      }
      currentChunk = remaining + "\n";
      continue;
    }

    if ((currentChunk.length + line.length + 1) > maxLength) {
      chunks.push(currentChunk.trim());
      currentChunk = line + "\n";
    } else {
      currentChunk += line + "\n";
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function convertMarkdownToHtml(text: string): string {
  if (!text) return "";

  let processed = text;

  // 1. Convertir negritas Markdown a HTML (**bold** y __bold__)
  processed = processed.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  processed = processed.replace(/__([^_]+)__/g, "<b>$1</b>");

  // 2. Convertir títulos o énfasis con asterisco simple *texto* (no listas ni operaciones matemáticas)
  processed = processed.replace(/(^|[\s\n])\*([^\s*][^*]*[^\s*]|\S)\*(?=[\s\n.,:;!?]|$)/g, "$1<b>$2</b>");

  // 3. Convertir código en línea
  processed = processed.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 4. Convertir enlaces Markdown [texto](url) a <a href="url">texto</a>
  processed = processed.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, linkText, url) => {
    const safeUrl = url.replace(/"/g, "%22").replace(/&amp;/g, "&").replace(/&/g, "&amp;");
    return `<a href="${safeUrl}">${linkText}</a>`;
  });

  // 5. Proteger todas las etiquetas HTML legítimas básicas (b, i, code, pre, u, s, strike, del, span, a)
  const tokens: string[] = [];
  processed = processed.replace(/<(\/?(?:b|i|code|pre|u|s|strike|del|span|a(?:\s+href="[^"]*")?))>/gi, (match) => {
    tokens.push(match);
    return `___HTML_TOKEN_${tokens.length - 1}___`;
  });

  // 6. Escapar el resto de caracteres reservados de HTML (&, <, >)
  processed = processed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 7. Restaurar las etiquetas protegidas
  processed = processed.replace(/___HTML_TOKEN_(\d+)___/g, (_, idx) => {
    return tokens[parseInt(idx, 10)];
  });

  return processed;
}

// Envío seguro: URLs bare son auto-enlazadas por Telegram sin necesitar parse_mode
async function safeSendMessage(botInstance: Bot, userId: number, text: string) {
  const htmlText = convertMarkdownToHtml(text);
  const chunks = splitTextIntoSafeChunks(htmlText, 3900);

  for (const chunk of chunks) {
    try {
      await botInstance.api.sendMessage(userId, chunk, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } catch (err: any) {
      if (err.message?.includes("can't parse entities") || err.message?.includes("entities")) {
        console.warn("⚠️ Falló envío con HTML, reintentando en texto plano:", err.message);
        const plainText = chunk.replace(/<[^>]+>/g, "");
        await botInstance.api.sendMessage(userId, plainText, {
          link_preview_options: { is_disabled: true },
        });
      } else {
        console.error("Error enviando mensaje por Telegram:", err);
        try {
          await botInstance.api.sendMessage(userId, "❌ Error enviando parte de la respuesta.");
        } catch {}
      }
    }
  }
}

async function safeReply(ctx: any, text: string) {
  await safeSendMessage(bot, ctx.chat.id, text);
}

/**
 * Bootstrap canónico tras vinculación OAuth exitosa:
 * Resuelve y persiste en drive_folders la jerarquía canónica:
 * silvania -> skills, historial, prompts, documentos, temas.
 * Sincroniza y re-enlaza skills si la carpeta canónica en Drive aún no las tiene.
 */
async function bootstrapUserDriveFolders(userId: number): Promise<void> {
  try {
    const now = new Date();
    const madridTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
    const YYYY = madridTime.getFullYear().toString();
    const MM = (madridTime.getMonth() + 1).toString().padStart(2, "0");

    const standardPaths = [
      ["silvania"],
      ["silvania", "skills"],
      ["silvania", "historial"],
      ["silvania", "historial", YYYY],
      ["silvania", "historial", YYYY, MM],
      ["silvania", "prompts"],
      ["silvania", "documentos"],
      ["silvania", "temas"],
      ["silvania", "transcripciones"]
    ];

    for (const p of standardPaths) {
      const folderId = await folderCacheService.getOrCreateFolderPath(userId, p);
      console.log(`📁 [Drive Bootstrap] ${p.join("/")} -> ID: ${folderId}`);
    }

    // Sincronizar o re-subir skills a la carpeta canónica
    try {
      const { skillLoader } = await import("./services/skillLoader.js");
      await skillLoader.syncSkillsFromDrive(userId);
    } catch (skillErr: any) {
      console.warn(`⚠️ [Drive Bootstrap] Error en syncSkillsFromDrive durante bootstrap:`, skillErr.message);
    }

    console.log(`✅ [Drive Bootstrap] Carpetas canónicas listas y registradas en DB para usuario ${userId}.`);
  } catch (err: any) {
    console.error(`❌ [Drive Bootstrap] Error en bootstrap para usuario ${userId}:`, err.message);
  }
}

app.get("/auth/google/callback", rateLimiter(10, 60000), async (req: any, res: any) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send("Faltan parámetros code o state.");
  }
  
  const userId = verifySecureState(state as string);
  if (!userId) {
    console.warn(`⚠️ [OAuth Security] Intento de callback con estado inválido o alterado desde IP: ${req.ip}`);
    return res.status(400).send("Estado de autorización inválido o expirado. Genere un nuevo enlace en Telegram usando /auth.");
  }

  try {
    const creds = getGoogleCredentials(userId);
    if (!creds) {
      return res.status(500).send("No se encontraron las credenciales del cliente de Google.");
    }

    const redirectUri = PUBLIC_URL 
      ? `${PUBLIC_URL}/auth/google/callback` 
      : `http://localhost:${PORT}/auth/google/callback`;

    // 1. Intercambiar el código por tokens usando el cliente del tier adecuado (prod vs beta)
    const tokenResponse = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    });

    const tokens = tokenResponse.data;
    const { access_token, refresh_token } = tokens;

    // 2. Obtener el email del usuario con el access_token
    const userinfoResponse = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const email = userinfoResponse.data.email;
    if (!email) {
      return res.status(400).send("No se pudo obtener el correo del usuario.");
    }

    console.log(`🔑 Vinculando usuario ${userId} [Tier: ${creds.tier}] con el correo ${email}...`);

    // Detección de cambio de cuenta Google para el mismo Telegram userId
    const previousEmail = await dbService.getUserEmail(userId);
    const emailChanged = !!(previousEmail && previousEmail.trim().toLowerCase() !== email.trim().toLowerCase());

    if (emailChanged) {
      console.log(`🔄 [OAuth Callback] Cambio de cuenta Google detectado para userId ${userId}: ${previousEmail} -> ${email}`);
      // a) Limpiar credenciales gog del email anterior y del nuevo
      await clearUserGogCredentials(userId, previousEmail);
      await clearUserGogCredentials(userId, email);
      // b) Invalidar IDs canónicos viejos de Drive en DB y caché en memoria
      await folderCacheService.clearCache(userId);
      await dbService.clearDriveFolders(userId);
      // c) Invalidar caché local de skills de ese userId (no re-subir skills del disco del admin al Drive del demo)
      skillLoader.invalidateCache(userId);
      const localSkillsDir = path.resolve("skills", userId.toString());
      if (fs.existsSync(localSkillsDir)) {
        try {
          fs.rmSync(localSkillsDir, { recursive: true, force: true });
          console.log(`🧹 [OAuth Callback] Directorio local de skills purgado para ${userId} tras cambio de cuenta.`);
        } catch (rmErr: any) {
          console.warn(`⚠️ [OAuth Callback] Error purgando directorio local de skills:`, rmErr.message);
        }
      }
    } else {
      await clearUserGogCredentials(userId, email);
    }

    // 3. Guardar el nuevo correo en la base de datos
    await dbService.setUserEmail(userId, email);

    // 4. Importar el refresh_token a gog CLI si se recibió
    if (refresh_token) {
      const tokenObj = {
        email: email,
        client: creds.tier,
        authTier: creds.tier,
        services: ["gmail", "calendar", "drive", "sheets"],
        scopes: creds.scopes.split(" "),
        created_at: new Date().toISOString(),
        refresh_token: refresh_token
      };

      // Guardar el token en la base de datos (SaaS)
      await dbService.saveUserToken(userId, tokenObj);

      // Usar exactamente el mismo directorio de datos aislado por usuario que usa runGog
      const userAppdataPath = path.join(process.cwd(), "data", `user_${userId}`);
      if (!fs.existsSync(userAppdataPath)) {
        fs.mkdirSync(userAppdataPath, { recursive: true });
      }

      const executable = path.join(process.cwd(), "bin", process.platform === "win32" ? "gog.exe" : "gog");
      const customEnv = { 
        ...process.env, 
        APPDATA: userAppdataPath, 
        HOME: userAppdataPath, 
        USERPROFILE: userAppdataPath,
        GOG_KEYRING_PASSWORD: process.env.GOG_KEYRING_PASSWORD || "silvaniacoreagent",
        GOG_CLIENT: creds.tier
      };

      // Registrar credenciales del tier de cliente actual
      try {
        const userClientObj = {
          web: {
            client_id: creds.client_id,
            client_secret: creds.client_secret,
            redirect_uris: [redirectUri]
          }
        };
        const userCredsPath = path.join(userAppdataPath, "gmail-credentials.json");
        fs.writeFileSync(userCredsPath, JSON.stringify(userClientObj, null, 2));

        const clientCmd = `"${executable}" auth credentials "${userCredsPath}"`;
        execSync(clientCmd, { env: customEnv });
        if (creds.tier) {
          try {
            execSync(`"${executable}" --client=${creds.tier} auth credentials "${userCredsPath}"`, { env: customEnv });
          } catch {}
        }
      } catch (cErr: any) {
        console.error("❌ Error registrando credenciales en callback:", cErr.message);
      }

      const tempTokenPath = path.join(userAppdataPath, `temp_token_${userId}.json`);
      fs.writeFileSync(tempTokenPath, JSON.stringify(tokenObj, null, 2));

      const importCmd = `"${executable}" auth tokens import "${tempTokenPath}"`;
      console.log(`🔧 [gog] Importando token: ${importCmd}`);

      try {
        execSync(importCmd, { env: customEnv });
        console.log(`✅ Token importado correctamente en gog para ${email} (tier: ${creds.tier})`);
      } catch (importErr: any) {
        console.error("❌ Error importando token en gog:", importErr.stderr?.toString() || importErr.message);
      } finally {
        try { fs.unlinkSync(tempTokenPath); } catch {}
      }

      // Bootstrap canónico de carpetas en el Drive NUEVO en segundo plano (un solo bootstrap con el account correcto)
      bootstrapUserDriveFolders(userId).catch(bErr => {
        console.error("❌ [OAuth Callback] Error en bootstrap de carpetas:", bErr.message);
      });

      try {
        await bot.api.sendMessage(userId, `✅ ¡Tu cuenta de Google (${email}) ha sido vinculada correctamente! Ya puedes utilizar todas mis herramientas.`);
      } catch (tErr: any) {
        console.error("Error enviando mensaje de éxito a Telegram:", tErr.message);
      }

      res.send(`
        <html>
          <head>
            <title>Conexión SilvaniaCoreAgent</title>
            <meta charset="utf-8">
          </head>
          <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px; background-color: #0b0f19; color: #f3f4f6; margin: 0; height: 100vh; display: flex; justify-content: center; align-items: center;">
            <div style="background: rgba(17, 24, 39, 0.7); padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: inline-block;">
              <h1 style="color: #10b981; margin-bottom: 20px; font-size: 2.2rem;">⚡ ¡Vínculo Completado!</h1>
              <p style="color: #9ca3af; font-size: 1.1rem; margin-bottom: 20px;">Has autorizado correctamente el acceso para <strong>${email}</strong>.</p>
              <p style="color: #6b7280; font-size: 0.95rem;">Ya puedes cerrar esta ventana y regresar a Telegram.</p>
            </div>
          </body>
        </html>
      `);
    } else {
      // Asegurar bootstrap si ya estaba vinculado previamente (un solo bootstrap)
      bootstrapUserDriveFolders(userId).catch(bErr => {
        console.error("❌ [OAuth Callback] Error en bootstrap de carpetas:", bErr.message);
      });

      try {
        await bot.api.sendMessage(userId, `✅ ¡Tu cuenta de Google (${email}) ya estaba vinculada! Si tienes problemas de acceso, ve a la configuración de seguridad de tu cuenta de Google, revoca el acceso a la aplicación de Silvania y vuelve a iniciar el proceso.`);
      } catch {}

      res.send(`
        <html>
          <head>
            <title>Conexión SilvaniaCoreAgent</title>
            <meta charset="utf-8">
          </head>
          <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px; background-color: #0b0f19; color: #f3f4f6; margin: 0; height: 100vh; display: flex; justify-content: center; align-items: center;">
            <div style="background: rgba(17, 24, 39, 0.7); padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: inline-block;">
              <h1 style="color: #3b82f6; margin-bottom: 20px; font-size: 2.2rem;">🔗 Ya Vinculado</h1>
              <p style="color: #9ca3af; font-size: 1.1rem; margin-bottom: 20px;">Tu cuenta <strong>${email}</strong> ya cuenta con autorización previa.</p>
              <p style="color: #6b7280; font-size: 0.95rem;">Ya puedes cerrar esta ventana y regresar a Telegram.</p>
            </div>
          </body>
        </html>
      `);
    }
  } catch (err: any) {
    console.error("Error procesando la autenticación de Google:", err.message);
    res.status(500).send(`Error interno procesando la autenticación: ${err.message}`);
  }
});

// Ruta alternativa /oauth para redirigir al flujo oficial único
app.get("/oauth", (req: any, res: any) => {
  res.send(`
    <html>
      <head>
        <title>SilvaniaCoreAgent — Vinculación de Cuenta</title>
        <meta charset="utf-8">
      </head>
      <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px; background-color: #0b0f19; color: #f3f4f6; margin: 0; height: 100vh; display: flex; justify-content: center; align-items: center;">
        <div style="background: rgba(17, 24, 39, 0.7); padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: inline-block;">
          <h1 style="color: #3b82f6; margin-bottom: 20px; font-size: 2rem;">⚡ Vinculación Oficial de Google</h1>
          <p style="color: #9ca3af; font-size: 1.1rem; margin-bottom: 20px;">Para vincular tu cuenta con Silvania CoreAgent, abre tu chat en Telegram y envía el comando <code>/auth</code>.</p>
          <p style="color: #6b7280; font-size: 0.95rem;">Esto generará un enlace seguro y único adaptado a tu cuenta.</p>
        </div>
      </body>
    </html>
  `);
});

if (PUBLIC_URL) {
  app.use(express.json());
  app.post(`/bot${config.telegram.token}`, (req: any, res: any) => {
    res.sendStatus(200);
    bot.handleUpdate(req.body).catch(err => {
      console.error("❌ Error procesando update de Telegram:", err);
    });
  });
  bot.api.setWebhook(`${PUBLIC_URL}/bot${config.telegram.token}`).then(() => {
    console.log(`📡 Webhook configurado con éxito en: ${PUBLIC_URL}/bot${config.telegram.token}`);
  }).catch(err => {
    console.error("❌ Error configurando webhook:", err.message);
  });
}

app.listen(PORT, () => {
  console.log(`📡 Servidor Express de callback OAuth escuchando en puerto ${PORT}`);
});

// Función para el Cron del mensaje matutino diario
export async function sendMorningMessages(botInstance: Bot) {
  console.log("🌞 [Cron] Iniciando generación de mensajes matutinos...");
  try {
    const users = await dbService.getAllUsers();
    const usersNeedingAuth: Array<{ userId: number; email?: string; reason: string }> = [];

    for (const u of users) {
      const { userId, email } = u;
      console.log(`🌞 [Cron] Procesando usuario ${userId} (${email})...`);
      
      await userContextStore.run({ userId }, async () => {
        try {
          // 0. Obtener configuración del usuario (idioma / locale)
          let userLocale = "es";
          try {
            const userCfg = await configManager.loadConfig(userId);
            if (userCfg?.language) userLocale = userCfg.language;
            else if (userCfg?.locale) userLocale = userCfg.locale;
          } catch (cfgErr: any) {
            console.warn(`[Cron] No se pudo cargar config para ${userId}, usando 'es':`, cfgErr.message);
          }

          // 1. Obtener eventos de hoy verificando token previamente
          let calendarSummary = userLocale === "en" ? "No events scheduled for today." : "No hay eventos programados para hoy.";
          const userToken = await dbService.getUserToken(userId);

          if (!userToken || !userToken.refresh_token) {
            calendarSummary = userLocale === "en" 
              ? "Could not access calendar. Reconnect with /auth to view your schedule." 
              : "No pude acceder a tu agenda de hoy. Vincula de nuevo con /auth para ver tus eventos y citas.";
            usersNeedingAuth.push({ userId, email, reason: "sin cuenta vinculada" });
          } else {
            try {
              const eventsRes = await executeTool("calendar_list", { days_ahead: 1 }, userId);
              const lowerRes = (eventsRes || "").toLowerCase();
              if (
                lowerRes.includes("invalid_grant") ||
                lowerRes.includes("unauthorized_client") ||
                lowerRes.includes("sesión de google expiró") ||
                lowerRes.includes("no has vinculado") ||
                lowerRes.includes("revocada")
              ) {
                console.warn(`⚠️ [Cron] Token expirado o revocado detectado para usuario ${userId}. Purgando...`);
                try {
                  await dbService.deleteUserToken(userId);
                  await clearUserGogCredentials(userId, email);
                } catch {}
                calendarSummary = userLocale === "en"
                  ? "Could not access calendar. Reconnect with /auth to view your schedule."
                  : "No pude acceder a tu agenda de hoy. Vincula de nuevo con /auth para ver tus eventos y citas.";
                usersNeedingAuth.push({ userId, email, reason: "sesión expirada/revocada" });
              } else {
                calendarSummary = eventsRes;
              }
            } catch (e: any) {
              const errMsg = e.message || "";
              const lowerErr = errMsg.toLowerCase();
              if (
                lowerErr.includes("invalid_grant") ||
                lowerErr.includes("unauthorized_client") ||
                lowerErr.includes("sesión de google expiró")
              ) {
                try {
                  await dbService.deleteUserToken(userId);
                  await clearUserGogCredentials(userId, email);
                } catch {}
                usersNeedingAuth.push({ userId, email, reason: "sesión expirada/revocada" });
              }
              calendarSummary = userLocale === "en" 
                ? "Could not read calendar for today. Reconnect with /auth to view your schedule." 
                : "No pude acceder a tu agenda de hoy. Vincula de nuevo con /auth para ver tus eventos y citas.";
              console.warn(`[Cron] No se pudieron obtener eventos para ${userId}:`, errMsg);
            }
          }

          // 2. Obtener Radar del día (Economía, IA, Mundo) con tolerancia a fallos
          let radarMarkdown: string | null = null;
          try {
            radarMarkdown = await morningRadarService.getMorningRadarMarkdown(userLocale);
          } catch (radarErr: any) {
            console.warn(`[Cron] Error obteniendo radar matutino para ${userId}:`, radarErr.message);
            radarMarkdown = null;
          }

          // 3. Generar briefing matutino con el LLM (100% sin Gmail / correos)
          const now = new Date();
          const madridTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
          const start = new Date(madridTime.getFullYear(), 0, 0);
          const diff = (madridTime.getTime() - start.getTime()) + ((start.getTimezoneOffset() - madridTime.getTimezoneOffset()) * 60 * 1000);
          const oneDay = 1000 * 60 * 60 * 24;
          const dayOfYear = Math.floor(diff / oneDay);
          const quoteIndex = dayOfYear % MOTIVATIONAL_QUOTES.length;
          const selectedQuote = MOTIVATIONAL_QUOTES[quoteIndex];

          const languageName = userLocale === "en" ? "inglés" : userLocale === "pt" ? "portugués" : "español";
          const prompt = `Actúa como Silvania CoreAgent, el asistente personal del usuario. Genera los bloques del briefing matutino para un ejecutivo de élite en ${languageName}.

Aquí tienes sus eventos del calendario para hoy:
${calendarSummary}

Frase inspiradora del día:
"${selectedQuote}"

Estructura obligatoria de tu respuesta:
[SALUDO_Y_AGENDA]
Saluda con cordialidad y energía. Resume de forma clara los eventos/citas del día (usa emojis 🗓️, ⏰). Si no hay eventos o el usuario necesita vincular su cuenta, indícalo de forma amable y breve en una línea ("Vincula de nuevo con /auth para ver tu agenda") sin alarmismo.

[MOTIVACION]
Cierra el briefing de manera fluida y elegante incorporando y desarrollando la frase inspiradora del día para motivar su jornada laboral.

IMPORTANTE: No inventes noticias ni añadas secciones adicionales. Respeta las etiquetas [SALUDO_Y_AGENDA] y [MOTIVACION].`;

          let text = "";
          try {
            const response = await llmService.chat([
              { role: "system", content: "Eres Silvania CoreAgent, un asistente ejecutivo de élite." },
              { role: "user", content: prompt }
            ]);

            const responseText = response.content || "";
            const agendaMatch = responseText.match(/\[SALUDO_Y_AGENDA\]([\s\S]*?)(\[MOTIVACION\]|$)/i);
            const motivacionMatch = responseText.match(/\[MOTIVACION\]([\s\S]*)/i);

            if (agendaMatch && motivacionMatch) {
              const agendaPart = agendaMatch[1].trim();
              const motivacionPart = motivacionMatch[1].trim();
              if (radarMarkdown) {
                text = `${agendaPart}\n\n${radarMarkdown}\n\n${motivacionPart}`;
              } else {
                text = `${agendaPart}\n\n${motivacionPart}`;
              }
            } else {
              if (radarMarkdown) {
                text = `${responseText.trim()}\n\n${radarMarkdown}`;
              } else {
                text = responseText.trim() || (userLocale === "en" ? "Good morning! Have a productive day." : "¡Buenos días! Que tengas un excelente día.");
              }
            }
          } catch (llmErr: any) {
            console.error(`[Cron] Error llamando a LLM para briefing matutino de ${userId}:`, llmErr.message);
            const greeting = userLocale === "en" ? "Good morning! Here is your daily summary:" : "¡Buenos días! Aquí tienes tu resumen para hoy:";
            if (radarMarkdown) {
              text = `${greeting}\n\n${calendarSummary}\n\n${radarMarkdown}\n\n"${selectedQuote}"`;
            } else {
              text = `${greeting}\n\n${calendarSummary}\n\n"${selectedQuote}"`;
            }
          }

          // 4. Enviar mensaje por Telegram
          await safeSendMessage(botInstance, userId, text);
          console.log(`🌞 [Cron] Mensaje matutino enviado con éxito a ${userId}`);
        } catch (err: any) {
          console.error(`❌ [Cron] Error enviando mensaje a ${userId}:`, err.message);
        }
      });
    }

    // 5. Enviar como máximo 1 resumen diario al admin si hay usuarios que necesitan re-vincularse
    if (usersNeedingAuth.length > 0) {
      try {
        const adminId = 1572946817; // ID de Jesús
        const count = usersNeedingAuth.length;
        const listStr = usersNeedingAuth.map(u => `• Usuario \`${u.userId}\`${u.email ? ` (${u.email})` : ''}: ${u.reason}`).join("\n");
        const adminSummary = `ℹ️ **Resumen Matutino (Cuentas Google)**\n\n${count} usuario(s) necesitan /auth:\n${listStr}`;
        try {
          await botInstance.api.sendMessage(adminId, adminSummary, { parse_mode: "Markdown" });
        } catch {
          await botInstance.api.sendMessage(adminId, adminSummary.replace(/[*_`]/g, ""));
        }
      } catch (adminErr: any) {
        console.error("❌ [Cron] Error enviando resumen matutino de cuentas al admin:", adminErr.message);
      }
    }
  } catch (err: any) {
    console.error("❌ [Cron] Error general en sendMorningMessages:", err.message);
  }
}

function startMorningCron(botInstance: Bot) {
  console.log("⏰ Iniciando comprobador del Cron del mensaje matutino (06:30 AM Europe/Madrid)...");
  let lastFiredDay = "";
  
  setInterval(async () => {
    const now = new Date();
    // Obtener hora local en zona de Madrid
    const madridTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
    const hours = madridTime.getHours();
    const minutes = madridTime.getMinutes();
    const dayStr = madridTime.toDateString();
    
    // Disparar a las 06:30
    if (hours === 6 && minutes === 30 && lastFiredDay !== dayStr) {
      lastFiredDay = dayStr;
      console.log("⏰ [Cron] ¡Es hora del mensaje matutino!");
      await sendMorningMessages(botInstance);
    }
  }, 30 * 1000); // Comprobar cada 30 segundos
}

// Iniciar cron matutino
startMorningCron(bot);

// Iniciar cron de marketing rotativo exclusivo para administradores (HITL)
startMarketingAdminCron(bot);

// Middleware de prioridad absoluta para el administrador Jesús
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (userId === 1572946817) {
    // Bypass prioritario inmediato para Jesús
    await next();
    return;
  }
  await next();
});

// Middleware de seguridad: Whitelist (adaptado para SaaS)
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const allowed = config.telegram.allowedUsers;
  const isSaasOpen = true; // Habilitar acceso SaaS para todos los usuarios. Los privilegios administrativos siguen protegidos por ID.

  if (!isSaasOpen && !allowed.includes(userId)) {
    console.log(`⚠️ Acceso denegado para el usuario: ${userId}`);
    return; // Ignorar
  }
  await next();
});

// Middleware de Facturación / Suscripción
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Los administradores (usuarios en la whitelist del bot o ID prioritario de Jesús) están exentos de facturación
  const isAdmin = userId === 1572946817 || config.telegram.allowedUsers.includes(userId);
  if (isAdmin) {
    await next();
    return;
  }

  // Permitir siempre comandos básicos: /start, /auth y /clear
  const text = ctx.message?.text || "";
  const isBasicCommand = text.startsWith("/start") || text.startsWith("/auth") || text.startsWith("/clear");

  if (!isBasicCommand) {
    try {
      const billing = await dbService.checkUserBillingStatus(userId);
      if (billing.isBlocked) {
        const checkoutUrl = `${PUBLIC_URL || `http://localhost:${PORT}`}/checkout?userId=${userId}`;
        await ctx.reply(
          `⚠️ **Periodo de prueba finalizado**\n\n` +
          `Tu periodo de prueba gratuito de 7 días de Silvania CoreAgent ha expirado.\n\n` +
          `Para seguir disfrutando de tu asistente ejecutivo élite 24/7 (gestión de correo, calendario, análisis de imágenes y voz), activa tu Plan Premium por solo **€19 al mes**.\n\n` +
          `👉 Activa tu cuenta pulsando aquí:\n` +
          `${checkoutUrl}`,
          { link_preview_options: { is_disabled: true } }
        );
        return;
      }
    } catch (err: any) {
      console.error("❌ Error comprobando estado de facturación:", err.message);
    }
  }
  await next();
});

// Comando /start - Onboarding Fase 0 (Early Access / Producción)
bot.command("start", async (ctx) => {
  try {
    const channelUrl = config.marketing?.telegramChannelUrl;
    const channelLine = channelUrl 
      ? `\n📢 **Canal Oficial de Novedades y Demos:** ${channelUrl}\n` 
      : `\n📢 Usa /canal para conocer nuestro canal oficial de demos.\n`;

    const welcomeText = 
      `👋 **¡Hola! Te doy la bienvenida a Silvania CoreAgent.**\n\n` +
      `Soy tu asistente ejecutivo en Telegram, diseñado para ejecutar acciones reales en tu día a día integrado con **Google Workspace** mediante texto o notas de voz:\n\n` +
      `📁 **Google Drive:** Archivos de la app organizados en tu carpeta \`silvania/\` (permiso acotado \`drive.file\`).\n` +
      `✉️ **Gmail:** Envío de correos únicamente con tu confirmación (\`gmail.send\`, sin lectura de bandeja).\n` +
      `📅 **Google Calendar:** Creación de eventos, citas y gestión de agenda.\n` +
      `📊 **Google Sheets:** Registro de datos, facturación estructurada y tablas.\n` +
      `🌐 **Navegación Web:** Búsqueda e inspección de páginas y empresas en tiempo real.\n\n` +
      `🚀 **Acceso Anticipado (Early Access):**\n` +
      `Para conectar tus herramientas de Google con permisos oficiales y seguros, pulsa:\n` +
      `👉 /auth\n` +
      channelLine +
      `\n🌐 Más información y documentación: https://silvania.ai/coreagent\n` +
      `💬 Tu feedback directo por privado es clave en esta fase. ¿Qué tarea te gustaría automatizar hoy?`;

    const startUserId = ctx.from?.id;
    if (startUserId) {
      await dbService.addMessage(startUserId, "user", "/start");
      await dbService.addMessage(startUserId, "assistant", welcomeText);
    }
    await safeReply(ctx, welcomeText);
  } catch (err: any) {
    console.error("❌ Error en comando /start:", err.message);
    try {
      await ctx.reply(
        "👋 ¡Hola! Te doy la bienvenida a Silvania CoreAgent.\n\n" +
        "Para conectar tus herramientas de Google con permisos oficiales y seguros, pulsa:\n👉 /auth\n\n" +
        "🌐 Más información: https://silvania.ai/coreagent",
        { link_preview_options: { is_disabled: true } }
      );
    } catch {}
  }
});

// Comando /canal para consultar o acceder al canal vitrina
bot.command("canal", async (ctx) => {
  const channelUrl = config.marketing?.telegramChannelUrl;
  if (channelUrl && channelUrl.trim().length > 0) {
    await ctx.reply(
      `📢 **Canal Oficial de Novedades y Demos (Silvania AI):**\n\n` +
      `Sigue el desarrollo en abierto (build-in-public), nuevos casos de uso y demostraciones en vídeo:\n` +
      `👉 ${channelUrl}\n\n` +
      `_Espacio oficial de lectura para estar al día de las últimas mejoras._`,
      { link_preview_options: { is_disabled: false } }
    );
  } else {
    await ctx.reply(
      `📢 **Canal Oficial Silvania AI:**\n\n` +
      `Estamos preparando el lanzamiento de nuestro canal público de demostraciones y novedades.\n` +
      `Puedes consultar información actualizada y novedades del ecosistema en nuestra web oficial:\n` +
      `👉 https://silvania.ai/coreagent\n\n` +
      `Para cualquier consulta o sugerencia, puedes escribirnos directamente por este chat.`,
      { link_preview_options: { is_disabled: true } }
    );
  }
});

// Comando /clear para resetear la memoria
bot.command("clear", async (ctx) => {
  const userId = ctx.from!.id;
  await dbService.clearHistory(userId);
  try {
    const { driveMemoryService } = await import("./services/driveMemory.js");
    await driveMemoryService.clearMemoryOnDrive(userId);
  } catch (err: any) {
    console.error("Error borrando memoria de Drive:", err.message);
  }
  ctx.reply("🧠 Memoria de conversación reseteada.");
});

// Comando /seguridad (solo para administradores)
bot.command("seguridad", async (ctx) => {
  const userId = ctx.from!.id;
  const adminId = config.telegram.allowedUsers[0] || 1572946817;

  if (userId !== adminId) {
    return ctx.reply("❌ No tienes permisos para ejecutar este comando.");
  }

  const arg = ctx.match ? ctx.match.toString().trim().toLowerCase() : "";

  // 1. Exportar en formato CSV
  if (arg === "exportar") {
    try {
      const all = await dbService.getAllIncidentsForExport();
      if (all.length === 0) {
        return ctx.reply("📊 No hay incidentes registrados para exportar.");
      }

      let csvContent = "ID,UserID,Username,Reason,Timestamp\n";
      for (const row of all) {
        const username = row.username || "";
        const reason = row.reason.replace(/"/g, '""');
        csvContent += `${row.id},${row.userId},"${username}","${reason}","${row.timestamp}"\n`;
      }

      const localDataPath = path.join(process.cwd(), "data");
      if (!fs.existsSync(localDataPath)) {
        fs.mkdirSync(localDataPath, { recursive: true });
      }
      const tempPath = path.join(localDataPath, `reporte_seguridad_${Date.now()}.csv`);
      fs.writeFileSync(tempPath, csvContent, "utf8");

      await ctx.replyWithDocument(new InputFile(tempPath), {
        caption: "📊 Reporte completo de incidentes de seguridad en formato CSV."
      });
      fs.unlinkSync(tempPath);
      return;
    } catch (err: any) {
      console.error("Error al exportar incidentes:", err.message);
      return ctx.reply("❌ Ocurrió un error al exportar los datos de seguridad.");
    }
  }

  // 2. Reporte General e Incidentes Filtrados
  try {
    const stats = await dbService.getSecurityStats();

    if (stats.total === 0) {
      return ctx.reply("✅ Todo seguro en las últimas 24 horas. No hay incidentes registrados.");
    }

    // Determinar estado de salud
    let statusEmoji = "🟢";
    let statusText = "Todo seguro";
    if (stats.today > 5) {
      statusEmoji = "🔴";
      statusText = "Bajo ataque activo";
    } else if (stats.today > 0) {
      statusEmoji = "🟡";
      statusText = "Actividad sospechosa bloqueada";
    }

    let filterText = "Últimos 10 incidentes";
    let filterKey: string | undefined = undefined;

    if (arg === "hoy") {
      filterText = "Incidentes de hoy";
      filterKey = "hoy";
    } else if (arg === "semana") {
      filterText = "Incidentes de la semana";
      filterKey = "semana";
    }

    const incidents = await dbService.getRecentIncidents(filterKey, 10);

    let report = `🛡️ **REPORTE DE SEGURIDAD - SILVANIA COREAGENT** 🛡️\n\n`;
    report += `📊 **Resumen General:**\n`;
    report += `• Estado General: ${statusEmoji} **${statusText}**\n`;
    report += `• Total de Incidentes: \`${stats.total}\`\n`;
    report += `• Incidentes Hoy: \`${stats.today}\`\n`;
    report += `• Incidentes esta Semana: \`${stats.week}\`\n\n`;

    report += `📈 **Estadísticas por Tipo:**\n`;
    let hasStats = false;
    for (const [type, count] of Object.entries(stats.byType)) {
      if (count > 0) {
        report += `• ${type}: \`${count}\`\n`;
        hasStats = true;
      }
    }
    if (!hasStats) {
      report += `_No hay datos registrados._\n`;
    }
    report += `\n`;

    report += `🚨 **${filterText.toUpperCase()}:**\n`;
    if (incidents.length === 0) {
      report += `_No se registraron incidentes en este periodo._\n`;
    } else {
      for (const inc of incidents) {
        let type = "Inyección de Comando 💻";
        let action = "Bloqueado y Advertido ⚠️";
        const r = inc.reason;

        if (r.includes("CSP")) {
          type = "CSP Violation 🌐";
          action = "Reportado 📊";
        } else if (r.includes("Rate Limit")) {
          type = "Rate Limit ⏳";
          action = "IP Bloqueada (429) ⛔";
        } else if (r.includes("ejecutable") || r.includes("extensión") || r.includes("Archivo ejecutable")) {
          type = "Archivo Prohibido 📁";
          action = "Bloqueado 🚫";
        }

        const userDisplay = inc.username ? `@${inc.username}` : `ID: ${inc.userId}`;
        const shortDetail = inc.reason.length > 50 ? inc.reason.substring(0, 47) + "..." : inc.reason;
        
        // Escapar caracteres especiales para que no rompa Markdown de Telegram
        const escapedUser = escapeMarkdown(userDisplay);
        const escapedDetail = escapeMarkdown(shortDetail);

        report += `• **#${inc.id}** [${inc.timestamp}]\n`;
        report += `  👤 *Usuario*: ${escapedUser}\n`;
        report += `  🎯 *Tipo*: ${type}\n`;
        report += `  📝 *Detalle*: _${escapedDetail}_\n`;
        report += `  🛡️ *Acción*: ${action}\n`;
        report += `  ───────────────────\n`;
      }
    }

    report += `\n💡 **Acciones Rápidas:**\n`;
    report += `• Ver hoy: \`/seguridad hoy\`\n`;
    report += `• Ver semana: \`/seguridad semana\`\n`;
    report += `• Exportar CSV completo: \`/seguridad exportar\`\n`;

    await ctx.reply(report, { parse_mode: "Markdown" });
  } catch (err: any) {
    console.error("Error en comando /seguridad:", err.message);
    await ctx.reply("❌ Ocurrió un error al obtener la bitácora de seguridad.");
  }
});

// Comando /auth y /login para generar y entregar el enlace oficial
bot.command(["auth", "login"], async (ctx) => {
  const userId = ctx.from!.id;
  const authUrl = getAuthUrl(userId);
  if (!authUrl) {
    return ctx.reply("❌ Error: No se encontraron las credenciales de Google del bot en el servidor.");
  }

  await ctx.reply(
    `🔗 **Enlace de Vinculación de Google:**\n\n` +
    `Conecta tu cuenta de Google pulsando en este enlace:\n` +
    `${authUrl}\n\n` +
    `Este enlace te redirigirá a Google para que elijas qué cuenta deseas conectar de forma segura y automática.`,
    { link_preview_options: { is_disabled: true } }
  );
});

// Comando /eva para derivar a la web de Eva con explicación de 0 scopes y privacidad
bot.command("eva", async (ctx) => {
  await ctx.reply(
    `🗣️ **Eva — Logopedia y Entrenamiento de Voz Infantil y Familiar**\n\n` +
    `Eva es la entrenadora de voz y logopedia interactiva de Silvania, diseñada con estricta privacidad para menores y familias: cuenta con **0 scopes de Google** (no accede a correos de Gmail ni archivos de Drive de menores).\n\n` +
    `El roleplay interactivo, las aventuras de voz y los ejercicios de pronunciación viven exclusivamente en su plataforma web:\n` +
    `👉 https://silvania.ai/eva\n` +
    `🌐 Landing informativa: https://silvania.ai/eva-landing`,
    { parse_mode: "Markdown" }
  );
});

// Comando /perfil para revisar o configurar progresivamente la identidad y objetivos en silvania/coreagent/
bot.command("perfil", async (ctx) => {
  const userId = ctx.from!.id;
  const rawArgs = ctx.match ? ctx.match.toString().trim() : "";
  try {
    const { agentProfilesService } = await import("./services/agentProfiles.js");
    if (rawArgs) {
      const qMsg = agentProfilesService.startGuidedOnboarding(userId, "coreagent");
      const stepRes = await agentProfilesService.handleOnboardingStep(userId, rawArgs);
      if (stepRes.handled && stepRes.replyText) {
        const kb = stepRes.confirmButtonPrefix
          ? new InlineKeyboard()
              .text("✅ Confirmar y Guardar", stepRes.confirmButtonPrefix)
              .text("❌ Cancelar", "onb_cancel")
          : undefined;
        return await ctx.reply(stepRes.replyText, { parse_mode: "Markdown", ...(kb ? { reply_markup: kb } : {}) });
      }
      return await ctx.reply(qMsg, { parse_mode: "Markdown" });
    }

    const prof = await agentProfilesService.ensureCoreAgentStructure(userId, true);
    const kb = new InlineKeyboard().text("✨ Configurar / Editar Perfil Guiado", "core_onb_start");
    const statusBody = prof.configured
      ? `• *Nombre:* ${prof.nombre || "-"}\n` +
        `• *Empresa:* ${prof.empresa || "-"}\n` +
        `• *Cargo:* ${prof.cargo || "-"}\n` +
        `• *Objetivos:* ${prof.objetivos || "-"}\n` +
        `• *Tono/Idioma:* ${prof.tono || "-"}\n` +
        `• *Zona horaria:* ${prof.zonaHoraria || "-"}\n` +
        `• *Firma:* ${prof.firma || "-"}`
      : `_Tu plantilla en \`silvania/coreagent/perfil_y_objetivos.md\` está en blanco. Puedes configurarla por pasos o dejar que anote tus preferencias cuando me las cuentes._`;

    return await ctx.reply(
      `👤 *Perfil y Objetivos (CoreAgent)*\n` +
      `───────────────────────────\n\n` +
      `${statusBody}\n\n` +
      `📁 Archivo en Drive: \`silvania/coreagent/perfil_y_objetivos.md\``,
      { parse_mode: "Markdown", reply_markup: kb }
    );
  } catch (err: any) {
    return await ctx.reply(`❌ Error cargando perfil: ${err.message}`);
  }
});

// --- SILVANIA MARKETING STUDIO & LEADSETTER (HUMAN-IN-THE-LOOP) ---
bot.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery?.data || "";
  if (data.startsWith("onb_confirm_") || data === "onb_cancel" || data === "core_onb_start" || data === "mkt_onb_start" || data === "mkt_onb_preset_silvania") {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from!.id;
    const { agentProfilesService } = await import("./services/agentProfiles.js");

    if (data === "onb_cancel") {
      agentProfilesService.cancelOnboarding(userId);
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
      await ctx.reply("👌 Configuración cancelada. Puedes retomarla cuando la necesites.");
      return;
    }

    if (data.startsWith("onb_confirm_")) {
      const res = await agentProfilesService.confirmOnboardingAndSave(userId);
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
      if (res.saved) {
        const folderNote =
          res.agent === "setter"
            ? "`silvania/setter/` (empresa, ICP y objeciones)"
            : res.agent === "marketing"
            ? "`silvania/marketing/marca_y_reglas.md`"
            : "`silvania/coreagent/perfil_y_objetivos.md`";
        await ctx.reply(
          `✅ *Configuración guardada en Google Drive* (${folderNote}).\n\n` +
          (res.agent === "setter"
            ? `Tu Setter IA ya adapta su tono, notas de invitación y respuestas a tu negocio.\nPrueba: \`/setter buscar [sector ciudad]\` o \`/setter\`.`
            : res.agent === "marketing"
            ? `Marketing Studio ya aplicará la identidad de tu marca.\nPrueba: \`/marketing video [tema]\` o \`/marketing post linkedin [tema]\`.`
            : `CoreAgent ya conoce tu perfil y objetivos para personalizar cada tarea.`),
          { parse_mode: "Markdown" }
        );
      } else {
        await ctx.reply("⚠️ No hay una configuración pendiente por confirmar.");
      }
      return;
    }

    if (data === "core_onb_start") {
      await ctx.reply(agentProfilesService.startGuidedOnboarding(userId, "coreagent"), { parse_mode: "Markdown" });
      return;
    }

    if (data === "mkt_onb_start") {
      await ctx.reply(agentProfilesService.startGuidedOnboarding(userId, "marketing"), { parse_mode: "Markdown" });
      return;
    }

    if (data === "mkt_onb_preset_silvania") {
      if (!agentProfilesService.isAdminUser(userId)) {
        await ctx.reply("⛔ Preset reservado para administradores de Silvania.");
        return;
      }
      const { brandDriveAssets } = await import("./marketing/services/brandDriveAssets.js");
      const { driveMemoryService } = await import("./services/driveMemory.js");
      const folders = await brandDriveAssets.ensureBrandDriveStructure(userId);
      const fsMod = await import("fs");
      const pathMod = await import("path");
      const presetMd =
        `# Marca y Reglas de Marketing\n\n` +
        `- Nombre de marca / negocio: Silvania AI\n` +
        `- Sector y propuesta de valor: Ecosistema de agentes IA ejecutivos en Telegram sobre Google Workspace (CoreAgent, Marketing Studio y Eva)\n` +
        `- Slogan o lema principal: Tu oficina ejecutiva inteligente en Telegram\n` +
        `- Tono de comunicación (ej: ejecutivo, cercano, inspirador): Ejecutivo, sobrio, directo y humano\n` +
        `- Web oficial / enlace principal: https://silvania.ai\n` +
        `- Bot o WhatsApp de contacto: https://t.me/Silvania_Core_Agent_Bot\n` +
        `- Redes sociales: @silvania_ai en Telegram/YouTube/Instagram/X\n` +
        `- Reglas explícitas de vídeo e imágenes: Usar 01_inicio y 03_cierre cuando aplique\n`;
      const localPath = pathMod.default.join(process.cwd(), "data", `user_${userId}`, "agents", "marketing", "marca_y_reglas.md");
      fsMod.default.mkdirSync(pathMod.default.dirname(localPath), { recursive: true });
      fsMod.default.writeFileSync(localPath, presetMd, "utf8");
      if (folders) {
        await driveMemoryService.uploadOrReplace(userId, localPath, "marca_y_reglas.md", folders.rootFolderId);
      }
      await ctx.reply("✅ *Preset Silvania AI cargado en `silvania/marketing/marca_y_reglas.md`.*", { parse_mode: "Markdown" });
      return;
    }
  }

  if (data.startsWith("mkt_")) {
    try {
      const { telegramReview } = await import("./marketing/telegramReview.js");
      const handled = await telegramReview.handleCallback(bot, ctx);
      if (handled) return;
    } catch (err: any) {
      console.error("❌ Error manejando callback de marketing:", err);
    }
  } else if (data.startsWith("setter_")) {
    try {
      const { leadSetter } = await import("./services/leadSetter.js");
      const handled = await leadSetter.handleCallback(bot, ctx);
      if (handled) return;
    } catch (err: any) {
      console.error("❌ Error manejando callback de setter:", err);
    }
  } else if (data === "set_voice_alvaro" || data === "set_voice_lucia") {
    const userId = ctx.from!.id;
    const isAlvaro = data === "set_voice_alvaro";
    const voiceChoice = isAlvaro ? "Alvaro" : "Lucia";
    await dbService.setUserVoice(userId, voiceChoice);

    const keyboard = new InlineKeyboard()
      .text(isAlvaro ? "👨 Álvaro (Activo ✅)" : "👨 Álvaro (Masculino)", "set_voice_alvaro")
      .text(isAlvaro ? "👩 Lucía (Femenino)" : "👩 Lucía (Activa ✅)", "set_voice_lucia");

    const ack = isAlvaro 
      ? "✅ Has seleccionado la voz de *Álvaro (Masculina Neural)*. A partir de ahora te responderé con esta voz."
      : "✅ Has seleccionado la voz de *Lucía (Femenina Neural)*. A partir de ahora te responderé con esta voz.";

    try {
      await ctx.editMessageText(
        `🎙️ *Selector de Voz de Silvania CoreAgent*\n` +
        `───────────────────────────\n\n` +
        ack,
        { parse_mode: "Markdown", reply_markup: keyboard }
      );
    } catch {}

    try {
      const sampleText = isAlvaro 
        ? "¡Hola! Soy Álvaro, tu asistente ejecutivo en Silvania CoreAgent. ¿En qué te ayudo hoy?"
        : "¡Hola! Soy Lucía, tu asistente ejecutiva en Silvania CoreAgent. ¿En qué te ayudo hoy?";
      const audioPaths = await voiceService.textToSpeech(sampleText, userId, voiceChoice);
      if (audioPaths && audioPaths[0]) {
        await ctx.replyWithVoice(new InputFile(audioPaths[0]));
      }
    } catch (e: any) {
      console.warn("⚠️ No se pudo enviar nota de muestra de voz:", e.message);
    }
    return;
  }
  await next();
});

// Comando /voz o /voice (Selector de Voz Álvaro / Lucía)
bot.command(["voz", "voice"], async (ctx) => {
  const userId = ctx.from!.id;
  const currentVoice = await dbService.getUserVoice(userId);
  const isLucia = currentVoice.toLowerCase().includes("lucia") || currentVoice.toLowerCase().includes("elvira");

  const keyboard = new InlineKeyboard()
    .text(isLucia ? "👨 Álvaro (Masculino)" : "👨 Álvaro (Activo ✅)", "set_voice_alvaro")
    .text(isLucia ? "👩 Lucía (Activa ✅)" : "👩 Lucía (Femenino)", "set_voice_lucia");

  await ctx.reply(
    `🎙️ *Selector de Voz de Silvania CoreAgent*\n` +
    `───────────────────────────\n\n` +
    `Voz actual: *${isLucia ? "👩 Lucía (Femenina Neural)" : "👨 Álvaro (Masculina Neural)"}*\n\n` +
    `Toca abajo para elegir la voz que prefieras para tus notas de voz y vídeos:`,
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
});

// Comando /campaña (Campaña Omnicanal Multired)
// Nota: Telegram Bot API no reconoce 'ñ' en bot_command, por eso usamos bot.hears antes de message:text.
bot.hears(/^\/(?:campa[ñn]a|campaign)(?:@\w+)?(?:\s+([\s\S]+))?$/i, async (ctx) => {
  const userId = ctx.from!.id;
  const adminIds = config.marketing?.adminIds || [1572946817];

  if (!adminIds.includes(userId)) {
    return ctx.reply("❌ No tienes permisos para acceder a Silvania Marketing Studio.");
  }

  const topic = (ctx.match && ctx.match[1] ? ctx.match[1] : "").trim();
  if (!topic) {
    return ctx.reply(
      "🚀 *Campaña Omnicanal de Silvania*\n\n" +
      "Genera a partir de una sola idea todo el ecosistema coordinado de contenidos:\n" +
      "• 🎬 *YouTube Largo (16:9)*: Vídeo extendido (admite hasta 30 escenas y duración > 2-3 min)\n" +
      "• 📱 *TikTok / Shorts (9:16)*: Vídeo vertical condensado (3-4 microescenas clave, ~40s)\n" +
      "• 💼 *LinkedIn*: Copy profesional con storytelling y aprendizajes de negocio\n" +
      "• 𝕏 *X / Twitter*: Gancho viral sintético (< 280 caracteres)\n" +
      "• ✈️ *Telegram*: Digest con viñetas para lectura en móvil en el canal\n\n" +
      "_Uso:_ `/campaña [tu idea o tema]`\n" +
      "_Ejemplo:_ `/campaña Historia de David y Goliat 30 escenas` o `/campaña Productividad ejecutiva con Google Calendar`",
      { parse_mode: "Markdown" }
    );
  }

  try {
    const { marketingManager } = await import("./marketing/manager.js");
    await marketingManager.createCampaignPack(topic, userId, bot);
  } catch (err: any) {
    console.error("❌ Error en Campaña Omnicanal:", err);
    await ctx.reply(`❌ Error generando la campaña omnicanal: ${err.message}`);
  }
});

bot.command(["setter", "prospecting", "leads"], async (ctx) => {
  const userId = ctx.from!.id;
  const adminIds = config.marketing?.adminIds || [1572946817];

  if (!adminIds.includes(userId)) {
    return ctx.reply("❌ No tienes permisos para acceder a Silvania LeadSetter.");
  }

  const rawArgs = ctx.match ? ctx.match.toString().trim() : "";
  const parts = rawArgs.split(/\s+/);
  const subCmd = parts[0]?.toLowerCase() || "";

  const { leadSetter } = await import("./services/leadSetter.js");

  // 0. Configuración del negocio / personalidad de silvania/setter/
  if (subCmd === "config" || subCmd === "setup" || subCmd === "perfil") {
    const { agentProfilesService } = await import("./services/agentProfiles.js");
    const arg = parts[1]?.toLowerCase() || "";
    const restText = parts.slice(1).join(" ").trim();

    if (arg === "reset" || arg === "blanco" || arg === "limpiar") {
      await agentProfilesService.resetSetterToBlank(userId);
      return ctx.reply("🧹 Carpetas `silvania/setter/` reiniciadas a plantilla en blanco. Usa `/setter config` cuando quieras rellenarlo.", { parse_mode: "Markdown" });
    }
    if (arg === "silvania" || arg === "default") {
      if (!agentProfilesService.isAdminUser(userId)) {
        return ctx.reply("⛔ El preset Silvania es solo para administradores. Usa `/setter config` para configurar tu propio negocio.");
      }
      await agentProfilesService.loadSilvaniaSetterPreset(userId);
      return ctx.reply("🚀 *Preset Silvania AI activado* en `silvania/setter/`.", { parse_mode: "Markdown" });
    }
    if (restText && restText.length > 6) {
      agentProfilesService.startGuidedOnboarding(userId, "setter");
      const res = await agentProfilesService.handleOnboardingStep(userId, restText);
      if (res.handled && res.replyText) {
        const kb = res.confirmButtonPrefix
          ? new InlineKeyboard().text("✅ Confirmar y Guardar", res.confirmButtonPrefix).text("❌ Cancelar", "onb_cancel")
          : undefined;
        return ctx.reply(res.replyText, { parse_mode: "Markdown", ...(kb ? { reply_markup: kb } : {}) });
      }
    }

    const prof = await agentProfilesService.ensureSetterStructure(userId, true);
    const kb = new InlineKeyboard().text("✨ Configurar / Editar Negocio (3 pasos)", "setter_onb_start");
    if (agentProfilesService.isAdminUser(userId)) {
      kb.row().text("🚀 Cargar Preset Silvania AI", "setter_onb_preset_silvania");
    }
    const summary = prof.configured
      ? `• *Empresa:* ${prof.companyName || "-"}\n` +
        `• *Remitente:* ${prof.senderName || "-"} (${prof.roleTitle || "-"})\n` +
        `• *Oferta:* ${prof.valuePropShort || prof.offerSummary || "-"}\n` +
        `• *Objetivo CTA:* ${prof.goalCta || "-"}\n` +
        `• *ICP:* ${prof.targetRoles.join(", ") || "-"}`
      : `_Las plantillas de \`silvania/setter/\` están en blanco. Pulsa abajo para configurarlas en 3 pasos o dicta una nota de voz con tu empresa y clientes._`;

    return ctx.reply(
      `🎯 *Configuración Actual del Setter IA*\n` +
      `───────────────────────────\n\n` +
      `${summary}\n\n` +
      `📁 Drive: \`silvania/setter/{empresa_y_oferta,icp_y_exclusiones,objeciones_y_tono}.md\``,
      { parse_mode: "Markdown", reply_markup: kb }
    );
  }

  // 1. Simulación o Test Nivel 2 (Asistente con Aprobación en 1 Clic)
  if (subCmd === "test" || subCmd === "simular") {
    const rest = rawArgs.substring(subCmd.length).trim();
    let name = "Juan Pérez";
    let role = "Agente Inmobiliario en Madrid";
    let message = "Me parece interesante pero esta semana voy a tope de visitas.";

    if (rest.includes("|")) {
      const subParts = rest.split("|").map(s => s.trim());
      if (subParts[0]) name = subParts[0];
      if (subParts[1]) role = subParts[1];
      if (subParts[2]) message = subParts[2];
    }

    const pending = await leadSetter.createPendingLeadReply({
      leadName: name,
      leadRole: role,
      messageText: message,
      personaKey: "inmobiliaria",
      chatId: userId,
      unipileChatId: `sim_unipile_${Date.now()}`,
      channel: "LINKEDIN",
    });

    await leadSetter.sendApprovalAlert(bot, userId, pending);
    return;
  }

  // 2. Desbloquear lote adicional (/setter more o /setter 10)
  if (subCmd === "more" || subCmd === "10") {
    leadSetter.unlockExtraBatch(userId);
    return ctx.reply(
      "🛡️ *Lote Adicional Desbloqueado (10 prospectos)*\n" +
      "───────────────────────────\n\n" +
      "Has desbloqueado un cupo adicional de 10 prospectos bajo tu supervisión.\n" +
      "Puedes solicitar tu playbook ejecutando:\n" +
      "👉 `/setter inmobiliaria [ciudad]` (o `autonomos`, `comerciales`, `emprendedores`).",
      { parse_mode: "Markdown" }
    );
  }

  // 2A. Selector de Modo Híbrido (/setter auto | /setter hitl | /setter modo)
  if (subCmd === "auto" || subCmd === "autonomo") {
    leadSetter.setSetterMode(userId, "auto");
    const kb = new InlineKeyboard()
      .text("🤖 Autónomo Total (Activo ✅)", "setter_mode_auto")
      .text("🛡️ Asistido HITL", "setter_mode_hitl");
    return ctx.reply(
      "🤖 *MODO AUTÓNOMO TOTAL ACTIVADO*\nEl Setter IA responderá automáticamente los mensajes entrantes por Unipile y enviará invitaciones directas (tope seguro 10/día) enviándote el resumen a Telegram.",
      { parse_mode: "Markdown", reply_markup: kb }
    );
  }
  if (subCmd === "hitl" || subCmd === "asistido" || subCmd === "manual") {
    leadSetter.setSetterMode(userId, "hitl");
    const kb = new InlineKeyboard()
      .text("🤖 Autónomo Total", "setter_mode_auto")
      .text("🛡️ Asistido HITL (Activo ✅)", "setter_mode_hitl");
    return ctx.reply(
      "🛡️ *MODO ASISTIDO HITL ACTIVADO*\nEl Setter IA preparará cada respuesta e invitación y esperará tu clic en Telegram antes de enviarla.",
      { parse_mode: "Markdown", reply_markup: kb }
    );
  }
  if (subCmd === "modo" || subCmd === "mode") {
    const current = leadSetter.getSetterMode(userId);
    const kb = new InlineKeyboard()
      .text(current === "auto" ? "🤖 Autónomo Total (Activo ✅)" : "🤖 Autónomo Total", "setter_mode_auto")
      .text(current === "hitl" ? "🛡️ Asistido HITL (Activo ✅)" : "🛡️ Asistido HITL", "setter_mode_hitl");
    return ctx.reply(
      `⚙️ *Modo Actual del Setter IA:* ${current === "auto" ? "🤖 Autónomo Total" : "🛡️ Asistido HITL"}\n\nElige cómo quieres operar:`,
      { parse_mode: "Markdown", reply_markup: kb }
    );
  }

  // 2B. Búsqueda en vivo de prospectos en LinkedIn vía Unipile + Invitaciones HITL
  if (subCmd === "buscar" || subCmd === "busca" || subCmd === "buscame" || subCmd === "search" || subCmd === "leads") {
    const query = parts.slice(1).join(" ").trim();
    if (!query) {
      return ctx.reply("⚠️ Uso: `/setter buscar [sector y ciudad]`\nEjemplo: `/setter buscar agente inmobiliario Madrid`", { parse_mode: "Markdown" });
    }
    await leadSetter.searchAndPresentProspects(bot, userId, query, 5);
    return;
  }

  // 3. Responder a un mensaje específico: /setter responder [leadName | mensaje]
  if (subCmd === "responder" || subCmd === "reply") {
    const checkCfg = await leadSetter.ensureConfiguredOrPromptOnboarding(bot, userId);
    if (!checkCfg.ok) return;

    const rest = rawArgs.substring(subCmd.length).trim();
    if (!rest) {
      return ctx.reply("⚠️ Uso: `/setter responder [Nombre | Mensaje del prospecto]`\nEjemplo: `/setter responder María Gómez | ¿Cuánto cuesta la suscripción?`", { parse_mode: "Markdown" });
    }

    let leadName = "Prospecto LinkedIn";
    let leadRole = "Contacto Profesional";
    let msgText = rest;

    if (rest.includes("|")) {
      const sub = rest.split("|").map(s => s.trim());
      leadName = sub[0];
      msgText = sub.slice(1).join(" | ");
    }

    const pending = await leadSetter.createPendingLeadReply({
      leadName,
      leadRole,
      messageText: msgText,
      chatId: userId
    });

    await leadSetter.sendApprovalAlert(bot, userId, pending);
    return;
  }

  // 4. Verificación de perfil configurado + límite diario seguro (Máx 10 por defecto anti-baneo)
  const checkCfg = await leadSetter.ensureConfiguredOrPromptOnboarding(bot, userId);
  if (!checkCfg.ok) return;

  const limitCheck = leadSetter.checkDailyLimit(userId);
  if (!limitCheck.allowed) {
    return ctx.reply(
      "🛡️ *LÍMITE DIARIO DE SEGURIDAD ALCANZADO (10/10 LEADS)*\n" +
      "───────────────────────────\n\n" +
      "Para blindar tu cuenta de LinkedIn contra baneos o restricciones algorítmicas, Silvania limita el envío a un máximo de 10 prospectos al día.\n\n" +
      "⚠️ *¿Deseas prospectar 10 más bajo tu propio criterio?*\n" +
      "Escribe `/setter more` o `/setter 10` para autorizar un nuevo lote de 10.",
      { parse_mode: "Markdown" }
    );
  }

  // 5. Playbook de prospección adaptado al perfil configurado (o preset Silvania)
  const personaKey = parts[0] || "autonomos";
  const city = parts.slice(1).join(" ") || "España";

  try {
    const pack = leadSetter.getPack(personaKey, city, checkCfg.profile);
    if (!pack) {
      return ctx.reply("⚠️ Nicho no encontrado. Opciones: `inmobiliaria`, `autonomos`, `comerciales`, `emprendedores`.", { parse_mode: "Markdown" });
    }

    // Contabilizar las 10 prospecciones seguras del día
    leadSetter.incrementDailyCount(userId, 10);

    const report = leadSetter.formatTelegramReport(pack, city, checkCfg.profile);
    await ctx.reply(report, { parse_mode: "Markdown" });
  } catch (err: any) {
    console.error("❌ Error en LeadSetter:", err);
    await ctx.reply(`❌ Error en LeadSetter: ${err.message}`);
  }
});

bot.command("marketing", async (ctx) => {
  const userId = ctx.from!.id;
  const adminIds = config.marketing?.adminIds || [1572946817];

  if (!adminIds.includes(userId)) {
    return ctx.reply("❌ No tienes permisos para acceder a Silvania Marketing Studio.");
  }

  const rawArgs = ctx.match ? ctx.match.toString().trim() : "";
  if (!rawArgs) {
    return ctx.reply(
      "🚀 *Silvania Marketing Studio (Omnicanal & Low-Cost)*\n\n" +
      "Uso del comando:\n" +
      "• `/marketing config` - Configura tu marca/negocio paso a paso (o usa tu plantilla en `silvania/marketing/marca_y_reglas.md`).\n" +
      "• `/marketing proyecto [nuevo|usar|listar|salir] [nombre]` - Crea carpetas separadas por vídeo/campaña para no mezclar clips e imágenes.\n" +
      "• `/marketing montar [proyecto] [tema]` - Monta un vídeo combinando tus clips `.mp4` + fotos subidas + memoria vectorial 256D.\n" +
      "• `/marketing video [youtube] [tema]` - Vídeo 16:9 extendido (hasta 30 escenas y duración > 2-3 min).\n" +
      "• `/marketing short [tiktok] [tema]` - Vídeo vertical 9:16 ágil (3-4 escenas, ~40s).\n" +
      "• `/marketing whatsapp [tema]` - Vídeo vertical 9:16 de 30s para WhatsApp.\n" +
      "• `/marketing post [linkedin|x|telegram] [tema]` - Post adaptado con imagen y audio.\n" +
      "• `/marketing setup` - Revisa/crea en Google Drive tus carpetas (`proyectos`, `clips_cortos`, `banco_visual`, `imagenes_intrinsecas`, `videos`).\n" +
      "• `/marketing draft [coreagent|eva|marketing]` | `/marketing status`\n\n" +
      "_Tip:_ Envía fotos o vídeos cortos `.mp4` con caption `/marketing` (o `/marketing proyecto:nombre`) para guardarlos directo en tu Drive.",
      { parse_mode: "Markdown" }
    );
  }

  const parts = rawArgs.split(/\s+/);
  const subCmd = parts[0].toLowerCase();

  // Subcomando de configuración guiada de negocio/marca en silvania/marketing/
  if (subCmd === "config" || subCmd === "perfil") {
    const { agentProfilesService } = await import("./services/agentProfiles.js");
    const { brandDriveAssets } = await import("./marketing/services/brandDriveAssets.js");
    const restText = parts.slice(1).join(" ").trim();
    if (restText && restText.length > 6 && !/^(ver|estado|info)$/i.test(restText)) {
      agentProfilesService.startGuidedOnboarding(userId, "marketing");
      const res = await agentProfilesService.handleOnboardingStep(userId, restText);
      if (res.handled && res.replyText) {
        const kb = res.confirmButtonPrefix
          ? new InlineKeyboard().text("✅ Confirmar y Guardar", res.confirmButtonPrefix).text("❌ Cancelar", "onb_cancel")
          : undefined;
        return ctx.reply(res.replyText, { parse_mode: "Markdown", ...(kb ? { reply_markup: kb } : {}) });
      }
    }
    await brandDriveAssets.ensureBrandDriveStructure(userId);
    const configured = brandDriveAssets.isMarketingConfigured(userId);
    const kb = new InlineKeyboard().text("✨ Configurar / Editar Marca (3 pasos)", "mkt_onb_start");
    if (agentProfilesService.isAdminUser(userId)) {
      kb.row().text("🚀 Cargar Preset Silvania AI", "mkt_onb_preset_silvania");
    }
    return ctx.reply(
      `🎨 *Configuración de Marca (Marketing Studio)*\n` +
      `───────────────────────────\n\n` +
      (configured
        ? `✅ Ficha \`silvania/marketing/marca_y_reglas.md\` configurada.\nPulsa abajo para actualizarla por pasos o dicta una nota de voz tras pulsar Configurar.`
        : `_Tu plantilla \`silvania/marketing/marca_y_reglas.md\` está en blanco. Pulsa abajo para configurarla en 3 preguntas (sin bloquear vídeos de storytelling puro)._`),
      { parse_mode: "Markdown", reply_markup: kb }
    );
  }

  // Subcomando de gestión de proyectos aislados (silvania/marketing/proyectos/<nombre>/)
  if (subCmd === "proyecto" || subCmd === "proyectos" || subCmd === "project") {
    const { brandDriveAssets } = await import("./marketing/services/brandDriveAssets.js");
    const action = (parts[1] || "listar").toLowerCase();
    const projectNameArg = parts.slice(2).join(" ").trim();

    if (action === "listar" || action === "list") {
      const projs = await brandDriveAssets.listProjects(userId);
      const active = brandDriveAssets.getActiveProject(userId);
      const listStr = projs.length > 0
        ? projs.map((p) => `• \`${p.name}\`${p.name === active ? " *(activo ✅)*" : ""} — [Abrir](https://drive.google.com/drive/folders/${p.id})`).join("\n")
        : "_Aún no has creado subcarpetas de proyectos._";
      return ctx.reply(
        `📁 *Proyectos en \`silvania/marketing/proyectos/\`*\n\n${listStr}\n\n` +
        `📌 *Proyecto activo:* \`${active || "ninguno (modo global)"}\`\n` +
        `• Crear/activar: \`/marketing proyecto nuevo mi_video\`\n` +
        `• Volver a global: \`/marketing proyecto salir\``,
        { parse_mode: "Markdown", link_preview_options: { is_disabled: true } }
      );
    }

    if (action === "salir" || action === "global" || action === "ninguno" || action === "clear") {
      brandDriveAssets.setActiveProject(userId, "");
      return ctx.reply("👌 Proyecto desactivado. Ahora se usarán las carpetas globales `banco_visual/` y `clips_cortos/`.");
    }

    const rawName = (action === "nuevo" || action === "usar" || action === "crear" || action === "use")
      ? projectNameArg
      : parts.slice(1).join(" ").trim();
    if (!rawName) {
      return ctx.reply("⚠️ Indica el nombre del proyecto. Ejemplo: `/marketing proyecto nuevo lanzamiento_mayo`", { parse_mode: "Markdown" });
    }

    const proj = await brandDriveAssets.ensureProjectFolderStructure(userId, rawName, true);
    if (!proj) {
      return ctx.reply("⚠️ No pude crear la carpeta del proyecto en Drive. Verifica `/auth`.");
    }
    return ctx.reply(
      `✅ *Proyecto activo:* \`${proj.slug}\`\n\n` +
      `• 📁 [Carpeta Proyecto](https://drive.google.com/drive/folders/${proj.projectFolderId})\n` +
      `• 🖼️ [imagenes](https://drive.google.com/drive/folders/${proj.imagesFolderId})\n` +
      `• 🎞️ [clips](https://drive.google.com/drive/folders/${proj.clipsFolderId})\n\n` +
      `📤 Ahora envía fotos o vídeos cortos `.concat("`.mp4`") + ` con caption \`/marketing\` y se guardarán dentro de este proyecto.\n` +
      `🎬 Para montarlo: \`/marketing montar ${proj.slug} [tema o instrucciones]\``,
      { parse_mode: "Markdown" }
    );
  }

  // Subcomando de montaje híbrido: clips .mp4 + imágenes + voz + subtítulos
  if (subCmd === "montar" || subCmd === "assemble") {
    const { brandDriveAssets } = await import("./marketing/services/brandDriveAssets.js");
    const active = brandDriveAssets.getActiveProject(userId);
    const maybeProj = parts[1] || "";
    let targetProj = active;
    let topicIdx = 1;
    if (maybeProj && /^[a-z0-9_-]{2,40}$/i.test(maybeProj)) {
      const existing = await brandDriveAssets.listProjects(userId);
      if (existing.some((p) => p.name.toLowerCase() === maybeProj.toLowerCase()) || !active) {
        targetProj = maybeProj;
        topicIdx = 2;
      }
    }
    const assembleTopic = parts.slice(topicIdx).join(" ").trim() || (targetProj ? `Montaje audiovisual de ${targetProj}` : "");
    if (!assembleTopic) {
      return ctx.reply("⚠️ Uso: `/marketing montar <nombre_proyecto> [tema o guion]`", { parse_mode: "Markdown" });
    }
    await ctx.reply(`🎬 *Montaje Híbrido (Clips MP4 + Imágenes + Voz + Subtítulos) en marcha...*\nProyecto: \`${targetProj || "global"}\`\nTema: _${assembleTopic}_...`, { parse_mode: "Markdown" });
    void (async () => {
      try {
        const { marketingManager } = await import("./marketing/manager.js");
        const draft = await marketingManager.createAndReviewDraft(assembleTopic, "youtube_long", userId, bot, { projectName: targetProj || undefined });
        if (draft && draft.videoPath) {
          const realDurStr = draft.realDurationSeconds
            ? `${Math.floor(draft.realDurationSeconds / 60)}:${Math.round(draft.realDurationSeconds % 60) < 10 ? "0" : ""}${Math.round(draft.realDurationSeconds % 60)}`
            : `${Math.round(draft.videoScript?.totalEstimatedDurationSeconds || 60)}s`;
          await ctx.api.sendMessage(
            userId,
            `🎬 *Vídeo Montado:* MP4 ${realDurStr}${draft.brandDriveSummary ? ` (${draft.brandDriveSummary})` : ""}.\nRevisa el borrador arriba para aprobar y publicar.`,
            { parse_mode: "Markdown" }
          );
        }
      } catch (err: any) {
        await ctx.api.sendMessage(userId, `❌ Error montando el vídeo: ${String(err?.message || err).slice(0, 400)}`).catch(() => {});
      }
    })();
    return;
  }

  // Subcomando de LeadSetter
  if (subCmd === "setter" || subCmd === "prospecting" || subCmd === "leads") {
    const personaKey = parts[1] || "autonomos";
    const city = parts.slice(2).join(" ") || "España";
    try {
      const { leadSetter } = await import("./services/leadSetter.js");
      const checkCfg = await leadSetter.ensureConfiguredOrPromptOnboarding(bot, userId);
      if (!checkCfg.ok) return;
      const pack = leadSetter.getPack(personaKey, city, checkCfg.profile);
      if (!pack) {
        return ctx.reply("⚠️ Nicho no encontrado. Opciones: `inmobiliaria`, `autonomos`, `comerciales`, `emprendedores`.", { parse_mode: "Markdown" });
      }
      const report = leadSetter.formatTelegramReport(pack, city, checkCfg.profile);
      return ctx.reply(report, { parse_mode: "Markdown" });
    } catch (err: any) {
      return ctx.reply(`❌ Error en LeadSetter: ${err.message}`);
    }
  }

  // Subcomando de Campaña Omnicanal
  if (subCmd === "campaña" || subCmd === "campana" || subCmd === "campaign" || subCmd === "pack") {
    const topic = parts.slice(1).join(" ").trim();
    if (!topic) {
      return ctx.reply("⚠️ Indica el tema de la campaña. Ejemplo: `/marketing campaña David y Goliat 30 escenas`", { parse_mode: "Markdown" });
    }
    try {
      const { marketingManager } = await import("./marketing/manager.js");
      await marketingManager.createCampaignPack(topic, userId, bot);
      return;
    } catch (err: any) {
      return ctx.reply(`❌ Error generando campaña: ${err.message}`);
    }
  }

  // Subcomando de borrador rotativo diario bajo demanda (HITL)
  if (subCmd === "draft" || subCmd === "cron" || subCmd === "rotativo") {
    await ctx.reply("⏳ Generando propuesta diaria rotativa de producto para revisión HITL...");
    try {
      const { runMarketingDailyDraft } = await import("./marketing/cron.js");
      let forceIdx: number | undefined;
      const targetProd = parts[1]?.toLowerCase();
      if (targetProd?.includes("core")) forceIdx = 0;
      else if (targetProd?.includes("eva")) forceIdx = 1;
      else if (targetProd?.includes("market")) forceIdx = 2;

      const draft = await runMarketingDailyDraft(bot, userId, forceIdx);
      if (!draft) {
        await ctx.reply("❌ No se pudo generar el borrador rotativo. Revisa la consola o las claves LLM.");
      }
      return;
    } catch (err: any) {
      return ctx.reply(`❌ Error generando borrador rotativo: ${err.message}`);
    }
  }

  // Subcomando de inicialización / verificación de carpetas de marca en Google Drive
  if (subCmd === "setup" || subCmd === "drive" || subCmd === "marca") {
    await ctx.reply("📂 Revisando tu Google Drive y creando carpetas de marca si faltan...");
    try {
      const { brandDriveAssets } = await import("./marketing/services/brandDriveAssets.js");
      const folders = await brandDriveAssets.ensureBrandDriveStructure(userId);
      if (!folders) {
        return ctx.reply("⚠️ No pude acceder a tu Google Drive. Verifica que tu cuenta esté vinculada con `/auth`.");
      }
      return ctx.reply(
        `✅ *Estructura de Marca y Proyectos en Google Drive lista:*\n\n` +
        `• 📁 [silvania/marketing](https://drive.google.com/drive/folders/${folders.rootFolderId})\n` +
        `• 📂 [proyectos](https://drive.google.com/drive/folders/${folders.proyectosFolderId}) _(subcarpetas aisladas por vídeo)_\n` +
        `• 🎞️ [clips_cortos](https://drive.google.com/drive/folders/${folders.clipsCortosFolderId}) _(tus vídeos cortos MP4)_\n` +
        `• 🖼️ [banco_visual](https://drive.google.com/drive/folders/${folders.bancoVisualFolderId}) _(tus fotos del negocio)_\n` +
        `• 🏷️ [01_inicio](https://drive.google.com/drive/folders/${folders.inicioFolderId}) | [02_medio](https://drive.google.com/drive/folders/${folders.medioFolderId}) | [03_cierre](https://drive.google.com/drive/folders/${folders.cierreFolderId})\n` +
        `• 🎬 [videos](https://drive.google.com/drive/folders/${folders.videosFolderId})\n\n` +
        `📝 Configura tu negocio paso a paso con \`/marketing config\` o crea un proyecto con \`/marketing proyecto nuevo mi_video\`.`,
        { parse_mode: "Markdown" }
      );
    } catch (err: any) {
      return ctx.reply(`❌ Error preparando carpetas en Drive: ${err.message}`);
    }
  }

  // Subcomando de estado
  if (subCmd === "status") {
    try {
      const { marketingManager } = await import("./marketing/manager.js");
      const lastDraft = marketingManager.getLastDraft(userId);
      if (!lastDraft) {
        return ctx.reply("ℹ️ No hay borradores de marketing registrados todavía.");
      }
      const realDurStr = lastDraft.realDurationSeconds
        ? `${Math.floor(lastDraft.realDurationSeconds / 60)}:${Math.round(lastDraft.realDurationSeconds % 60) < 10 ? "0" : ""}${Math.round(lastDraft.realDurationSeconds % 60)} (audio real)`
        : null;
      const scenesInScript = lastDraft.videoScript?.scenes.length || lastDraft.sceneImageCount || 0;
      const net = lastDraft.networkImageCount ?? (lastDraft.distinctImageCount || 0);
      const loc = lastDraft.localFallbackImageCount ?? 0;
      const imgBreakdown = net > 0 && loc > 0 ? `${net} red, ${loc} slides corporativos` : net > 0 ? `${net} red` : loc > 0 ? `${loc} slides corporativos` : `${lastDraft.distinctImageCount || 0} imágenes`;
      const videoStatusStr = lastDraft.videoPath
        ? `Listo (${realDurStr ? `MP4 ${realDurStr} · ` : ""}${scenesInScript} escenas [${imgBreakdown}])`
        : (lastDraft.videoError ? `Error: ${lastDraft.videoError}` : "N/A");

      return ctx.reply(
        `📊 *Último Borrador:* #${lastDraft.id.slice(0, 8)}\n\n` +
        `📌 *Tema:* ${lastDraft.topic}\n` +
        `📦 *Formato:* ${lastDraft.format}\n` +
        `🚦 *Estado:* \`${lastDraft.status}\`\n` +
        `🎬 *Vídeo MP4:* ${videoStatusStr}\n` +
        `🎙️ *Voz:* ${lastDraft.voiceProvider || "edge"}\n` +
        `🎨 *Imagen:* ${lastDraft.imageProvider || "flux"}\n` +
        `🤖 *Modelo LLM:* ${lastDraft.llmModel || "gemini"}\n` +
        `📅 *Creado:* ${new Date(lastDraft.createdAt).toLocaleString("es-ES")}`,
        { parse_mode: "Markdown" }
      );
    } catch (err: any) {
      return ctx.reply(`❌ Error consultando status: ${err.message}`);
    }
  }

  // Enrutamiento de subcomandos y redes específicas
  let format: any = "social_post";
  let targetPlatform: any = undefined;
  let topicStartIndex = 1;

  if (subCmd === "post") {
    const nextArg = (parts[1] || "").toLowerCase();
    if (nextArg === "linkedin" || nextArg === "x" || nextArg === "twitter" || nextArg === "telegram") {
      targetPlatform = nextArg === "twitter" ? "x" : nextArg;
      topicStartIndex = 2;
    }
  } else if (subCmd === "video" || subCmd === "youtube") {
    format = "youtube_long";
    if (subCmd === "video" && (parts[1] || "").toLowerCase() === "youtube") {
      topicStartIndex = 2;
    }
  } else if (subCmd === "short" || subCmd === "shorts") {
    format = "youtube_short";
    if ((parts[1] || "").toLowerCase() === "tiktok") {
      format = "tiktok";
      topicStartIndex = 2;
    }
  } else if (subCmd === "tiktok") {
    format = "tiktok";
  } else if (subCmd === "whatsapp" || subCmd === "wa") {
    format = "whatsapp_video";
    targetPlatform = "whatsapp";
  } else if (subCmd === "linkedin") {
    format = "social_post";
    targetPlatform = "linkedin";
  } else if (subCmd === "x" || subCmd === "twitter") {
    format = "social_post";
    targetPlatform = "x";
  }

  const topic = parts.slice(topicStartIndex).join(" ").trim();

  if (!topic) {
    return ctx.reply("⚠️ Por favor indica el tema después del subcomando. Ejemplo: `/marketing post linkedin mi tema` o `/marketing video 30 escenas de fe`", { parse_mode: "Markdown" });
  }

  if (/^(mi\s+negocio|mi\s+empresa|anuncio|promocion|promoci[oó]n)$/i.test(topic)) {
    const { brandDriveAssets } = await import("./marketing/services/brandDriveAssets.js");
    const { agentProfilesService } = await import("./services/agentProfiles.js");
    await brandDriveAssets.ensureBrandDriveStructure(userId);
    if (!brandDriveAssets.isMarketingConfigured(userId)) {
      const kb = new InlineKeyboard().text("✨ Configurar Mi Negocio (3 pasos)", "mkt_onb_start");
      if (agentProfilesService.isAdminUser(userId)) {
        kb.row().text("🚀 Cargar Preset Silvania AI", "mkt_onb_preset_silvania");
      }
      return ctx.reply(
        `🎨 *Tu ficha \`silvania/marketing/marca_y_reglas.md\` está en blanco.*\nPara no inventar otra marca, dime qué negocio impulsas o pulsa abajo para redactarlo contigo paso a paso.`,
        { parse_mode: "Markdown", reply_markup: kb }
      );
    }
  }

  const platformBadge = targetPlatform ? ` [${targetPlatform.toUpperCase()}]` : "";
  await ctx.reply(`🧠 *Silvania Marketing Studio en marcha...*\nInvestigando y preparando propuesta${platformBadge} para:\n_${topic}_...`, { parse_mode: "Markdown" });

  // Ejecutar en segundo plano para responder 200 OK inmediato a Telegram y evitar reintentos del webhook tras 60s
  void (async () => {
    try {
      const { marketingManager } = await import("./marketing/manager.js");
      const draft = await marketingManager.createAndReviewDraft(topic, format, userId, bot, { targetPlatform });
      if (draft && draft.videoPath) {
        const realDurStr = draft.realDurationSeconds
          ? `${Math.floor(draft.realDurationSeconds / 60)}:${Math.round(draft.realDurationSeconds % 60) < 10 ? "0" : ""}${Math.round(draft.realDurationSeconds % 60)}`
          : `${Math.round(draft.videoScript?.totalEstimatedDurationSeconds || 60)}s`;
        const scenesInScript = draft.videoScript?.scenes.length || draft.sceneImageCount || 1;
        const net = draft.networkImageCount ?? (draft.distinctImageCount || 0);
        const loc = draft.localFallbackImageCount ?? 0;
        const imgBreakdown = net > 0 && loc > 0 ? `${net} red, ${loc} slides corporativos` : net > 0 ? `${net} red` : loc > 0 ? `${loc} slides corporativos` : `${draft.distinctImageCount || 0} imágenes`;
        await ctx.api.sendMessage(
          userId,
          `🎬 *Vídeo MP4 generado:* MP4 ${realDurStr} (audio real) · ${scenesInScript} escenas (${imgBreakdown}).\nRevisa el resultado interactivo arriba con los controles HITL de aprobación.`,
          { parse_mode: "Markdown" }
        );
      }
    } catch (err: any) {
      console.error("❌ Error en Marketing Studio:", err);
      await ctx.api.sendMessage(userId, `❌ Error generando el borrador de marketing: ${String(err?.message || err).slice(0, 500)}`).catch(() => {});
    }
  })();
});

// ─── CAMBIO RÁPIDO DE VOZ EN LENGUAJE NATURAL (Álvaro / Lucía) ───
async function handleVoiceChangeIntent(userId: number, rawText: string, ctx: any): Promise<boolean> {
  const norm = rawText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  const isLucia = norm.includes("voz de lucia") || norm.includes("voz femenina") || 
                  norm.includes("cambia a voz de mujer") || norm.includes("pon la voz de lucia") ||
                  norm.includes("con la voz de lucia") || norm.includes("quiero la voz de lucia") ||
                  norm.includes("pon a lucia") || norm.includes("voz lucia");
                  
  const isAlvaro = norm.includes("voz de alvaro") || norm.includes("voz masculina") || 
                   norm.includes("cambia a voz de hombre") || norm.includes("pon la voz de alvaro") ||
                   norm.includes("con la voz de alvaro") || norm.includes("quiero la voz de alvaro") ||
                   norm.includes("pon a alvaro") || norm.includes("voz alvaro");

  if (isLucia) {
    await dbService.setUserVoice(userId, "Lucia");
    const ack = "👩 He cambiado mi voz a Lucía. A partir de ahora te responderé con mi voz femenina.";
    await ctx.reply(ack);
    try {
      const audios = await voiceService.textToSpeech(ack, userId, "Lucia");
      if (audios && audios[0]) await ctx.replyWithVoice(new InputFile(audios[0]));
    } catch {}
    return true;
  }

  if (isAlvaro) {
    await dbService.setUserVoice(userId, "Alvaro");
    const ack = "👨 He cambiado mi voz a Álvaro. A partir de ahora te responderé con mi voz masculina.";
    await ctx.reply(ack);
    try {
      const audios = await voiceService.textToSpeech(ack, userId, "Alvaro");
      if (audios && audios[0]) await ctx.replyWithVoice(new InputFile(audios[0]));
    } catch {}
    return true;
  }

  return false;
}

// ─── ONBOARDING ESCALONADO ACTIVO POR VOZ O TEXTO ───
async function handleActiveOnboardingReply(userId: number, rawText: string, ctx: any): Promise<boolean> {
  const { agentProfilesService } = await import("./services/agentProfiles.js");
  const session = agentProfilesService.getActiveOnboarding(userId);
  if (!session || rawText.trim().startsWith("/")) return false;

  const res = await agentProfilesService.handleOnboardingStep(userId, rawText);
  if (!res.handled) return false;

  if (res.replyText) {
    const kb = res.confirmButtonPrefix
      ? new InlineKeyboard()
          .text("✅ Confirmar y Guardar en Drive", res.confirmButtonPrefix)
          .text("❌ Cancelar", "onb_cancel")
      : undefined;
    await ctx.reply(res.replyText, { parse_mode: "Markdown", ...(kb ? { reply_markup: kb } : {}) });
  }
  return true;
}

// Manejador de mensajes de texto
bot.on("message:text", async (ctx) => {
  const userId = ctx.from.id;
  const rawText = ctx.message.text;
  const text = correctTranscription(rawText);

  // Escaneo de seguridad del texto ingresado
  const threat = checkMaliciousPattern(text);
  if (threat) {
    const warning = await handleSecurityAlert(userId, ctx.from.username || "Usuario de Telegram", threat);
    return await ctx.reply(warning);
  }

  // Interceptar la primera interacción (cuando el historial está vacío) para usuarios nuevos
  try {
    const hasLocal = dbService.hasLocalHistory(userId);
    if (!hasLocal) {
      const history = await dbService.getHistory(userId);
      if (false && history.length === 0 && !text.startsWith("/")) { // Desactivado: delegar primer mensaje a runAgent sin re-pitch de /start
        const welcome = `¡Hola! Soy Silvania CoreAgent, tu asistente ejecutivo integrado con Google Workspace.\n` +
          `Puedo ayudarte a gestionar tu agenda de Calendar, hojas de cálculo en Sheets, tus archivos en Drive y coordinar tareas ejecutivas con herramientas reales.\n\n` +
          `¿En qué te puedo ayudar hoy?`;

        await dbService.addMessage(userId, "user", text);
        await dbService.addMessage(userId, "assistant", welcome);
        return await ctx.reply(welcome);
      }
    }
  } catch (err: any) {
    console.error("❌ Error interceptando primera interacción de usuario:", err.message);
  }

  // Interceptar cortesías cortas de forma programática ha sido desactivado para permitir el ruteo de gpt-4o-mini dinámico.
  /*
  try {
    const isAwaiting = await dbService.isAwaitingSearchResponse(userId).catch(() => false);
    if (!isAwaiting) {
      const courtesyReply = checkCourtesyGreeting(text);
      if (courtesyReply) {
        await dbService.addMessage(userId, "user", text);
        await dbService.addMessage(userId, "assistant", courtesyReply);
        return await ctx.reply(courtesyReply);
      }
    }
  } catch (err: any) {
    console.error("❌ Error interceptando cortesía de usuario:", err.message);
  }
  */

  const textLower = text.toLowerCase();
  
  // ─── CONTROL DE MUTE / SILENCIADO DE VOZ ───
  const muteKeywords = ["para voz", "para de hablar", "no hables", "desactiva voz", "modo silencio", "cállate", "callate", "silencio", "mutear"];
  const unmuteKeywords = ["activa voz", "activa la voz", "habla", "vuelve a hablar", "desmutea", "con voz", "léeme", "leeme", "escucha"];

  const wantsMute = muteKeywords.some(keyword => textLower.includes(keyword));
  const wantsUnmute = unmuteKeywords.some(keyword => textLower.includes(keyword));

  if (wantsMute) {
    await dbService.setMuteVoice(userId, true);
    return await ctx.reply("🔇 **Modo Silencioso Activado**\n\nDe acuerdo, he desactivado mi voz. A partir de ahora te responderé únicamente por texto.\n\n_Si deseas que vuelva a hablarte, dímelo escribiendo 'activa la voz' o pidiéndome que hable._");
  }

  if (wantsUnmute) {
    const isMuted = await dbService.getMuteVoice(userId);
    if (isMuted) {
      await dbService.setMuteVoice(userId, false);
      const ackText = "🔊 ¡Modo de voz activado de nuevo! A partir de ahora te responderé con notas de voz cuando lo solicites.";
      await ctx.reply(ackText);
      const audioPaths = await voiceService.textToSpeech(ackText, userId);
      if (audioPaths && audioPaths.length > 0) {
        for (const audioPath of audioPaths) {
          await ctx.replyWithVoice(new InputFile(audioPath));
        }
      }
      return;
    }
  }

  // ─── ONBOARDING ESCALONADO ACTIVO (CoreAgent / Marketing / Setter) ───
  if (await handleActiveOnboardingReply(userId, text, ctx)) {
    return;
  }

  // ─── CAMBIO RÁPIDO DE VOZ EN LENGUAJE NATURAL (Álvaro / Lucía) ───
  if (await handleVoiceChangeIntent(userId, text, ctx)) {
    return;
  }

  // ─── PROSPECCIÓN ACTIVA EN LINKEDIN VÍA UNIPILE (ADMIN HITL) ───
  const adminIds = config.marketing?.adminIds || [1572946817];
  if (adminIds.includes(userId) && /linkedin/i.test(text) && /(busca|b[uú]scame|encuentra|prospectos|leads|invita)/i.test(text)) {
    const cleanedQuery = text
      .replace(/^(por favor|oye|silvania|coreagent)[,\s]*/i, "")
      .replace(/(b[uú]scame|busca|encuentra|invita)\s*(leads|prospectos|contactos|personas|perfiles|a)?\s*(en\s*linkedin|linkedin)?\s*(de|sobre|para)?\s*/gi, "")
      .replace(/\s*(en\s*linkedin|con\s*invitaci[oó]n|para\s*invitarlos|y\s*m[aá]ndales.*|y\s*inv[ií]talos.*)$/gi, "")
      .trim();
    if (cleanedQuery.length >= 3) {
      const { leadSetter } = await import("./services/leadSetter.js");
      await leadSetter.searchAndPresentProspects(bot, userId, cleanedQuery, 5);
      return;
    }
  }

  // Notificar que está pensando con un intervalo para mantener el estado "escribiendo"
  await ctx.replyWithChatAction("typing");
  const typingInterval = setInterval(() => {
    ctx.replyWithChatAction("typing").catch(() => {});
  }, 4000);

  try {
    const response = await runAgent(userId, text);
    clearInterval(typingInterval);
    
    // Enviar respuesta de texto
    await safeReply(ctx, response);

    // OPCIONAL: Enviar también audio (TTS) si se solicita o hay palabras clave y el bot no está silenciado
    const isMuted = await dbService.getMuteVoice(userId);
    if (!isMuted) {
      const voiceKeywords = [
        "habla", "léeme", "leeme", "di ", "di,", "reproduce", "voz", "audio", 
        "escucha", "pronuncia", "lee ", "lee,", "lee\n", "lee la", "léela", 
        "leela", "léelo", "leelo", "reprodúcelo", "reproducilo", "dilo", 
        "di en voz alta", "voz alta", "lee esto", "léeme esto", "leeme esto"
      ];
      const shouldSendVoice = voiceKeywords.some(keyword => textLower.includes(keyword)) || textLower === "lee" || textLower === "léeme" || textLower === "leeme";

      if (shouldSendVoice) {
        const cleanText = cleanTextForTTS(response);
        const audioPaths = await voiceService.textToSpeech(cleanText, userId);
        if (audioPaths && audioPaths.length > 0) {
          for (const audioPath of audioPaths) {
            await ctx.replyWithVoice(new InputFile(audioPath));
          }
        }
      }
    }
  } catch (error: any) {
    clearInterval(typingInterval);
    console.error("Error procesando mensaje:", error);
    await ctx.reply("❌ Ups, ocurrió un error en mi matriz de pensamiento.");
  } finally {
    clearInterval(typingInterval);
  }
});

// Manejador de fotos
bot.on("message:photo", async (ctx) => {
  const userId = ctx.from.id;
  const photo = ctx.message.photo.pop();
  if (!photo) return;

  const caption = (ctx.message.caption || "").trim();
  if (/^\/marketing\b/i.test(caption)) {
    const adminIds = config.marketing?.adminIds || [1572946817];
    if (!adminIds.includes(userId)) {
      return ctx.reply("❌ No tienes permisos para subir activos de marca a Silvania Marketing Studio.");
    }
    const lowerCap = caption.toLowerCase();
    await ctx.reply("📤 Subiendo imagen a tu carpeta de marca en Google Drive...");
    let tmpPhotoPath = "";
    try {
      const file = await ctx.api.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
      const resp = await fetch(fileUrl);
      const buf = Buffer.from(await resp.arrayBuffer());
      const fsMod = await import("fs");
      const pathMod = await import("path");
      tmpPhotoPath = pathMod.default.resolve(process.cwd(), `temp_media/tg_brand_${userId}_${Date.now()}.jpg`);
      fsMod.default.mkdirSync(pathMod.default.dirname(tmpPhotoPath), { recursive: true });
      fsMod.default.writeFileSync(tmpPhotoPath, buf);

      const { brandDriveAssets } = await import("./marketing/services/brandDriveAssets.js");
      const { driveMemoryService } = await import("./services/driveMemory.js");
      const folders = await brandDriveAssets.ensureBrandDriveStructure(userId);
      if (!folders) {
        return ctx.reply("⚠️ No pude acceder a tu Google Drive. Verifica `/auth`.");
      }

      let targetFolderId = folders.bancoVisualFolderId;
      let folderLabel = "banco_visual";
      let fileName = `brand_photo_${Date.now()}.jpg`;
      const capProjMatch = caption.match(/\bproyecto:([^\s]+)/i);
      const targetProjName = capProjMatch ? capProjMatch[1].trim() : brandDriveAssets.getActiveProject(userId);

      if (/(inicio|logo|intro)/.test(lowerCap)) {
        targetFolderId = folders.inicioFolderId;
        folderLabel = "imagenes_intrinsecas/01_inicio";
        fileName = "logo_inicio.jpg";
      } else if (/(medio|slogan|producto)/.test(lowerCap)) {
        targetFolderId = folders.medioFolderId;
        folderLabel = "imagenes_intrinsecas/02_medio";
        fileName = "placa_medio.jpg";
      } else if (/(cierre|final|cta)/.test(lowerCap)) {
        targetFolderId = folders.cierreFolderId;
        folderLabel = "imagenes_intrinsecas/03_cierre";
        fileName = "placa_cierre.jpg";
      } else if (targetProjName) {
        const proj = await brandDriveAssets.ensureProjectFolderStructure(userId, targetProjName, Boolean(capProjMatch));
        if (proj) {
          targetFolderId = proj.imagesFolderId;
          folderLabel = `proyectos/${proj.slug}/imagenes`;
        }
      }

      const uploadedId = await driveMemoryService.uploadOrReplace(userId, tmpPhotoPath, fileName, targetFolderId);
      const driveUrl = uploadedId
        ? `https://drive.google.com/file/d/${uploadedId}/view`
        : `https://drive.google.com/drive/folders/${targetFolderId}`;
      return ctx.reply(
        `✅ *Imagen de marca guardada en Drive:*\n` +
        `📁 Carpeta: \`silvania/marketing/${folderLabel}\`\n` +
        `📄 Archivo: \`${fileName}\`\n` +
        `🔗 [Ver en Drive](${driveUrl})\n\n` +
        `_Al subirla desde aquí, el scope seguro \`drive.file\` ya la detecta automáticamente en tus próximos vídeos._`,
        { parse_mode: "Markdown" }
      );
    } catch (err: any) {
      return ctx.reply(`❌ Error subiendo imagen de marca: ${err.message}`);
    } finally {
      if (tmpPhotoPath) {
        try {
          const fsMod = await import("fs");
          if (fsMod.default.existsSync(tmpPhotoPath)) fsMod.default.unlinkSync(tmpPhotoPath);
        } catch {}
      }
    }
  }

  await ctx.replyWithChatAction("typing");
  const typingInterval = setInterval(() => {
    ctx.replyWithChatAction("typing").catch(() => {});
  }, 4000);

  try {
    const file = await ctx.api.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
    const originalName = `photo_${Date.now()}.jpg`;

    // Subir la foto automáticamente a Drive, pero pasando saveDescriptionFile = false
    const { descriptiveName, description, fileId } = await userContextStore.run({ userId }, () =>
      fileManager.processAndUpload(userId, fileUrl, originalName, true, undefined, false)
    );
    clearInterval(typingInterval);
    
    const fileLink = generateDriveLink(fileId, false);
    const agentContext = `El usuario ha enviado una imagen que ya he subido automáticamente a su Google Drive como "${descriptiveName}" (ID: ${fileId || "no disponible"}).
    Enlace de visualización directa: ${fileLink}
    
    Descripción visual de lo que hay en la imagen: "${description}".
    
    Por favor, informa al usuario que has guardado el archivo en su Google Drive (dándole el enlace directo de apertura), describe la imagen en pantalla y pregúntale qué desea que hagas a continuación con ella (ej. transcribirla, analizar datos, etc.).
    
    REGLA: NO guardes la descripción en un archivo de texto en Drive ni crees ningún documento de descripción a menos que el usuario te lo pida explícitamente.`;

    const response = await runAgent(userId, agentContext);
    await safeReply(ctx, response);
  } catch (error) {
    console.error("Error procesando foto:", error);
    await ctx.reply("❌ No pude procesar o subir la imagen.");
  } finally {
    clearInterval(typingInterval);
  }
});

// Manejador de documentos
bot.on("message:document", async (ctx) => {
  const userId = ctx.from.id;
  const doc = ctx.message.document;
  
  // Escaneo de seguridad del nombre de archivo
  const docNameThreat = checkMaliciousFilename(doc.file_name || "");
  if (docNameThreat) {
    const warning = await handleSecurityAlert(userId, ctx.from.username || "Usuario de Telegram", docNameThreat);
    return await ctx.reply(warning);
  }

  await ctx.replyWithChatAction("typing");
  const typingInterval = setInterval(() => {
    ctx.replyWithChatAction("typing").catch(() => {});
  }, 4000);

  try {
    const file = await ctx.api.getFile(doc.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
    const originalName = doc.file_name || `doc_${Date.now()}`;

    const { descriptiveName, description, fileId, descriptionFileId } = await userContextStore.run({ userId }, () =>
      fileManager.processAndUpload(userId, fileUrl, originalName, false)
    );
    clearInterval(typingInterval);
    
    const descFileLink = descriptionFileId ? generateDriveLink(descriptionFileId, false) : "";
    const agentContext = `He subido un documento llamado "${descriptiveName}" (ID: ${fileId || "no disponible"}). Descripción: ${description}. 
    ${descriptionFileId ? `Se ha generado una nota persistente (ID: ${descriptionFileId}, Enlace: ${descFileLink}).` : ""}
    Infórmale al usuario y pregúntale qué quiere hacer con él.`;
    
    const response = await runAgent(userId, agentContext);
    
    await safeReply(ctx, response);
  } catch (error) {
    console.error("Error procesando documento:", error);
    await ctx.reply("❌ No pude procesar o subir el documento.");
  } finally {
    clearInterval(typingInterval);
  }
});


// Manejador de voz
bot.on("message:voice", async (ctx) => {
  const userId = ctx.from.id;
  await ctx.replyWithChatAction("typing");
  const typingInterval = setInterval(() => {
    ctx.replyWithChatAction("typing").catch(() => {});
  }, 4000);
  const safetyTimeout = setTimeout(() => {
    clearInterval(typingInterval);
  }, 90000);

  try {
    const file = await ctx.api.getFile(ctx.message.voice.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
    const fileName = `voice_${userId}_${Date.now()}.ogg`;
    // 1. Transcribir
    const rawTranscribedText = await audioService.downloadAndTranscribe(fileUrl, fileName);
    const transcribedText = correctTranscription(rawTranscribedText);
    console.log(`🎙️ Usuario dijo (original): ${rawTranscribedText}`);
    console.log(`🎙️ Usuario dijo (corregido): ${transcribedText}`);
    
    // Escaneo de seguridad del audio transcrito
    const voiceThreat = checkMaliciousPattern(transcribedText);
    if (voiceThreat) {
      clearInterval(typingInterval);
      const warning = await handleSecurityAlert(userId, ctx.from.username || "Usuario de Telegram", `Transcripción de voz: "${transcribedText}" (${voiceThreat})`);
      return await ctx.reply(warning);
    }

    await ctx.reply(`🎙️ _Escuché:_ "${escapeMarkdown(transcribedText)}"`, { parse_mode: "Markdown" });

    // Onboarding escalonado activo por voz
    if (await handleActiveOnboardingReply(userId, transcribedText, ctx)) {
      clearInterval(typingInterval);
      return;
    }

    // Intención de cambio de voz detectada en nota de voz
    if (await handleVoiceChangeIntent(userId, transcribedText, ctx)) {
      clearInterval(typingInterval);
      return;
    }

    // Verificar cortesía rápido desactivado para permitir ruteo dinámico.
    /*
    const isAwaiting = await dbService.isAwaitingSearchResponse(userId).catch(() => false);
    if (!isAwaiting) {
      const courtesyReply = checkCourtesyGreeting(transcribedText);
      if (courtesyReply) {
        clearInterval(typingInterval);
        await dbService.addMessage(userId, "user", transcribedText);
        await dbService.addMessage(userId, "assistant", courtesyReply);
        await ctx.reply(courtesyReply);
        const isMuted = await dbService.getMuteVoice(userId);
        if (!isMuted) {
          const audioPaths = await voiceService.textToSpeech(courtesyReply, userId);
          if (audioPaths && audioPaths.length > 0) {
            for (const audioPath of audioPaths) {
              await ctx.replyWithVoice(new InputFile(audioPath));
            }
          }
        }
        return;
      }
    }
    */

    // 2. Procesar con el agente
    const response = await runAgent(userId, transcribedText);
    clearInterval(typingInterval);
    
    // 3. Responder con texto
    await safeReply(ctx, response);

    // 4. Responder con voz (TTS) - Siempre en respuesta a un audio (si no está silenciado)
    const isMuted = await dbService.getMuteVoice(userId);
    if (!isMuted) {
      const cleanResponse = cleanTextForTTS(response);
      const audioPaths = await voiceService.textToSpeech(cleanResponse, userId);
      if (audioPaths && audioPaths.length > 0) {
        for (const audioPath of audioPaths) {
          await ctx.replyWithVoice(new InputFile(audioPath));
        }
      }
    }
  } catch (error: any) {
    console.error("Error procesando audio:", error);
    const isTimeout = error?.message?.includes("504") || error?.description?.includes("Timeout");
    if (isTimeout) {
      await ctx.reply("❌ Los servidores de Telegram tardaron demasiado en entregar el mensaje de voz (504 Timeout). Por favor, prueba a enviarlo de nuevo.");
    } else {
      await ctx.reply("❌ No pude procesar tu mensaje de voz.");
    }
  } finally {
    clearInterval(typingInterval);
    clearTimeout(safetyTimeout);
  }
});

// Manejador de videonotas (mensajes de video redondos)
bot.on("message:video_note", async (ctx) => {
  const userId = ctx.from.id;
  await ctx.replyWithChatAction("typing");
  const typingInterval = setInterval(() => {
    ctx.replyWithChatAction("typing").catch(() => {});
  }, 4000);

  try {
    const file = await ctx.api.getFile(ctx.message.video_note.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
    const fileName = `videonote_${userId}_${Date.now()}.mp4`;

    // 1. Descargar y transcribir
    const rawTranscribedText = await audioService.downloadAndTranscribe(fileUrl, fileName);
    const transcribedText = correctTranscription(rawTranscribedText);
    console.log(`📹 Videonota del usuario (original): ${rawTranscribedText}`);

    // Escaneo de seguridad del texto
    const threat = checkMaliciousPattern(transcribedText);
    if (threat) {
      clearInterval(typingInterval);
      const warning = await handleSecurityAlert(userId, ctx.from.username || "Usuario de Telegram", `Transcripción de videonota: "${transcribedText}" (${threat})`);
      return await ctx.reply(warning);
    }

    await ctx.reply(`📹 _Videonota transcrita:_ "${escapeMarkdown(transcribedText)}"`, { parse_mode: "Markdown" });

    // Verificar cortesía rápido
    const isAwaiting = await dbService.isAwaitingSearchResponse(userId).catch(() => false);
    if (!isAwaiting) {
      const courtesyReply = checkCourtesyGreeting(transcribedText);
      if (courtesyReply) {
        clearInterval(typingInterval);
        await dbService.addMessage(userId, "user", transcribedText);
        await dbService.addMessage(userId, "assistant", courtesyReply);
        await ctx.reply(courtesyReply);
        const isMuted = await dbService.getMuteVoice(userId);
        if (!isMuted) {
          const audioPaths = await voiceService.textToSpeech(courtesyReply, userId);
          if (audioPaths && audioPaths.length > 0) {
            for (const audioPath of audioPaths) {
              await ctx.replyWithVoice(new InputFile(audioPath));
            }
          }
        }
        return;
      }
    }

    // 2. Procesar con el agente
    const response = await runAgent(userId, transcribedText);
    clearInterval(typingInterval);

    // 3. Responder con texto
    await safeReply(ctx, response);

    // 4. Responder con voz si no está silenciado
    const isMuted = await dbService.getMuteVoice(userId);
    if (!isMuted) {
      const cleanResponse = cleanTextForTTS(response);
      const audioPaths = await voiceService.textToSpeech(cleanResponse, userId);
      if (audioPaths && audioPaths.length > 0) {
        for (const audioPath of audioPaths) {
          await ctx.replyWithVoice(new InputFile(audioPath));
        }
      }
    }
  } catch (error) {
    console.error("Error procesando videonota:", error);
    await ctx.reply("❌ No pude transcribir tu videonota.");
  } finally {
    clearInterval(typingInterval);
  }
});

// Manejador de videos de Telegram (subida de clips MP4 para /marketing o transcripción para CoreAgent)
bot.on("message:video", async (ctx) => {
  const userId = ctx.from.id;
  const caption = (ctx.message.caption || "").trim();

  if (/^\/marketing\b/i.test(caption)) {
    const adminIds = config.marketing?.adminIds || [1572946817];
    if (!adminIds.includes(userId)) {
      return ctx.reply("❌ No tienes permisos para subir clips de vídeo a Marketing Studio.");
    }
    if ((ctx.message.video.file_size || 0) > 19.5 * 1024 * 1024) {
      return ctx.reply("⚠️ Este vídeo supera el límite de descarga directa de Telegram Bot API (~20 MB). Comprímelo o recórtalo en clips cortos (<20 MB) para guardarlo en `silvania/marketing/`.", { parse_mode: "Markdown" });
    }
    await ctx.reply("🎞️ Subiendo clip corto MP4 a tu carpeta de Marketing en Google Drive...");
    let tmpClipPath = "";
    try {
      const file = await ctx.api.getFile(ctx.message.video.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
      const resp = await fetch(fileUrl);
      const buf = Buffer.from(await resp.arrayBuffer());
      const fsMod = await import("fs");
      const pathMod = await import("path");
      tmpClipPath = pathMod.default.resolve(process.cwd(), `temp_media/tg_clip_${userId}_${Date.now()}.mp4`);
      fsMod.default.mkdirSync(pathMod.default.dirname(tmpClipPath), { recursive: true });
      fsMod.default.writeFileSync(tmpClipPath, buf);

      const { brandDriveAssets } = await import("./marketing/services/brandDriveAssets.js");
      const { driveMemoryService } = await import("./services/driveMemory.js");
      const folders = await brandDriveAssets.ensureBrandDriveStructure(userId);
      if (!folders) {
        return ctx.reply("⚠️ No pude acceder a tu Google Drive. Verifica `/auth`.");
      }

      const capProjMatch = caption.match(/\bproyecto:([^\s]+)/i);
      const targetProjName = capProjMatch ? capProjMatch[1].trim() : brandDriveAssets.getActiveProject(userId);
      let targetFolderId = folders.clipsCortosFolderId;
      let folderLabel = "clips_cortos";
      let projSlug = "";
      if (targetProjName) {
        const proj = await brandDriveAssets.ensureProjectFolderStructure(userId, targetProjName, Boolean(capProjMatch));
        if (proj) {
          targetFolderId = proj.clipsFolderId;
          folderLabel = `proyectos/${proj.slug}/clips`;
          projSlug = proj.slug;
        }
      }

      const fileName = `clip_${Date.now()}.mp4`;
      const uploadedId = await driveMemoryService.uploadOrReplace(userId, tmpClipPath, fileName, targetFolderId);
      const driveUrl = uploadedId
        ? `https://drive.google.com/file/d/${uploadedId}/view`
        : `https://drive.google.com/drive/folders/${targetFolderId}`;
      const durSec = ctx.message.video.duration || 0;
      const mountHint = projSlug
        ? `/marketing montar ${projSlug} [tema o guion]`
        : `/marketing montar [proyecto] [tema]`;

      return ctx.reply(
        `✅ *Clip corto MP4 guardado en Drive* (${durSec}s):\n` +
        `📁 Carpeta: \`silvania/marketing/${folderLabel}\`\n` +
        `📄 Archivo: \`${fileName}\`\n` +
        `🔗 [Ver en Drive](${driveUrl})\n\n` +
        `🎬 Cuando tengas tus clips e imágenes subidos, móntalo todo con:\n\`${mountHint}\``,
        { parse_mode: "Markdown" }
      );
    } catch (err: any) {
      return ctx.reply(`❌ Error subiendo clip MP4: ${err.message}`);
    } finally {
      if (tmpClipPath) {
        try {
          const fsMod = await import("fs");
          if (fsMod.default.existsSync(tmpClipPath)) fsMod.default.unlinkSync(tmpClipPath);
        } catch {}
      }
    }
  }

  await ctx.replyWithChatAction("typing");
  const typingInterval = setInterval(() => {
    ctx.replyWithChatAction("typing").catch(() => {});
  }, 4000);

  try {
    const file = await ctx.api.getFile(ctx.message.video.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
    const fileName = `video_${userId}_${Date.now()}.mp4`;

    // 1. Descargar y transcribir
    const rawTranscribedText = await audioService.downloadAndTranscribe(fileUrl, fileName);
    const transcribedText = correctTranscription(rawTranscribedText);
    console.log(`🎥 Video del usuario (original): ${rawTranscribedText}`);

    // Escaneo de seguridad del texto
    const threat = checkMaliciousPattern(transcribedText);
    if (threat) {
      clearInterval(typingInterval);
      const warning = await handleSecurityAlert(userId, ctx.from.username || "Usuario de Telegram", `Transcripción de video: "${transcribedText}" (${threat})`);
      return await ctx.reply(warning);
    }

    await ctx.reply(`🎥 _Video transcrito:_ "${escapeMarkdown(transcribedText)}"`, { parse_mode: "Markdown" });

    // 2. Procesar con el agente
    const response = await runAgent(userId, transcribedText);
    clearInterval(typingInterval);

    // 3. Responder con texto
    await safeReply(ctx, response);
  } catch (error) {
    console.error("Error procesando video:", error);
    await ctx.reply("❌ No pude transcribir el audio del video.");
  } finally {
    clearInterval(typingInterval);
  }
});

// Iniciar bot
if (!PUBLIC_URL) {
  console.log("🚀 SilvaniaCoreAgent encendido y activo (Long Polling)...");
  bot.start().catch(err => {
      console.error("❌ Error iniciando el bot:", err);
  });
} else {
  console.log("🚀 SilvaniaCoreAgent encendido y activo (Webhooks)...");
}

// Manejo de apagado gracioso para evitar errores 409 (Conflict)
const stopBot = async () => {
    console.log("🛑 Apagando SilvaniaCoreAgent...");
    if (!PUBLIC_URL) {
      await bot.stop();
    }
    process.exit(0);
};

process.on("SIGINT", stopBot);
process.on("SIGTERM", stopBot);
