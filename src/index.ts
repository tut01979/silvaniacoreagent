import { Bot, InputFile } from "grammy";
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
import { getAuthUrl } from "./services/authHelper.js";
import { checkCourtesyGreeting } from "./services/courtesyHelper.js";
import { EVA_EXERCISES_DATABASE, EVA_LESSONS } from "./config/evaExercises.js";

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

// Configurar el notificador de Telegram del administrador
setAdminTelegramNotifier(async (message: string) => {
  try {
    const adminId = config.telegram.allowedUsers[0] || 1572946817;
    await bot.api.sendMessage(adminId, message, { parse_mode: "Markdown" });
  } catch (err: any) {
    console.error("❌ Falló el envío de la alerta de Telegram al admin:", err.message);
  }
});

// Configurar el receptor de alertas críticas de Silvania CoreAgent
criticalLogService.registerCallback(async (msg: string) => {
  try {
    const adminId = 1572946817; // ID prioritario de Jesús
    await bot.api.sendMessage(adminId, msg, { parse_mode: "Markdown" });
  } catch (err: any) {
    console.error("❌ Falló el envío de alerta de Telegram de logs críticos al admin:", err.message);
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

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.log(`⚠️ Stripe Key no configurada. Redirigiendo a simulador para usuario ${userId}`);
    return res.redirect(`/checkout-simulator?userId=${userId}`);
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" as any });
    const redirectUrl = PUBLIC_URL || `http://localhost:${PORT}`;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Silvania CoreAgent Premium",
              description: "Tu asistente ejecutivo élite 24/7 desde Telegram",
            },
            unit_amount: 1900, // €19.00
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
app.get("/eva", (req: any, res: any) => res.sendFile(path.join(process.cwd(), "public", "eva.html")));
app.get("/evaagent", (req: any, res: any) => res.sendFile(path.join(process.cwd(), "public", "eva.html")));
app.get("/coreagent", (req: any, res: any) => res.sendFile(path.join(process.cwd(), "public", "index.html")));
app.use(express.static("public"));

// Endpoint para la interacción conversacional en tiempo real con Eva (Logopedia & Pronunciación)
app.post("/api/eva-chat", rateLimiter(40, 60000), express.json(), async (req: any, res: any) => {
  try {
    const { message, history, exerciseContext } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Falta el mensaje del usuario." });
    }

    const systemPrompt = `Eres Eva, una logopeda y entrenadora de voz de Inteligencia Artificial creada por Ananova.
Tu objetivo es ayudar al usuario a practicar el habla, la dicción, la vocalización y la pronunciación.
- Sé extremadamente paciente, empática, motivadora y profesional.
- Si el usuario está practicando un ejercicio (ejercicio activo: "${exerciseContext || "Práctica libre"}"), evalúa amablemente su dicción y dale consejos prácticos para colocar la lengua, los labios o controlar el aire.
- MANTÉN TUS RESPUESTAS CORTAS Y FLUIDAS (máximo 1 a 3 frases) para que la lectura por voz (TTS) en la web sea rápida, dinámica y natural.
- Responde siempre en español. No uses caracteres especiales ni formatos toscos de markdown.`;

    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(history) ? history.slice(-6) : []),
      { role: "user", content: message }
    ];

    const replyText = await llmService.chatEva(formattedMessages);
    const finalReply = replyText || "¡Muy bien! Sigamos practicando.";

    res.json({ reply: finalReply });
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
  
  // Reemplazos insensibles a mayúsculas/minúsculas para Spania, Chilpania, chipania, etc.
  corrected = corrected.replace(/\bspania\b/gi, "silvania");
  corrected = corrected.replace(/\bchilpania\b/gi, "silvania");
  corrected = corrected.replace(/\bchipania\b/gi, "silvania");
  corrected = corrected.replace(/chilpania\.com/gi, "silvania.ai");
  corrected = corrected.replace(/spania\.ai/gi, "silvania.ai");
  corrected = corrected.replace(/silvania\.a-i/gi, "silvania.ai");
  corrected = corrected.replace(/silvania\.a\.i/gi, "silvania.ai");
  corrected = corrected.replace(/spania for agents/gi, "silvania coreagent");
  corrected = corrected.replace(/spania core/gi, "silvania core");
  
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

  // 1. Convertir negritas Markdown a HTML
  processed = processed.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  processed = processed.replace(/__([^_]+)__/g, "<b>$1</b>");

  // 2. Convertir código en línea
  processed = processed.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 3. Proteger todas las etiquetas HTML legítimas básicas (b, i, code, pre, u, s, strike, del, span)
  const tokens: string[] = [];
  processed = processed.replace(/<(\/?(?:b|i|code|pre|u|s|strike|del|span))>/gi, (match) => {
    tokens.push(match);
    return `___HTML_TOKEN_${tokens.length - 1}___`;
  });

  // 4. Escapar el resto de caracteres reservados de HTML
  processed = processed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 5. Restaurar las etiquetas protegidas
  processed = processed.replace(/___HTML_TOKEN_(\d+)___/g, (_, idx) => {
    return tokens[parseInt(idx)];
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

function getGoogleCredentials() {
  try {
    const credsPath = path.join(process.cwd(), "data", "gmail-credentials.json");
    if (fs.existsSync(credsPath)) {
      const data = JSON.parse(fs.readFileSync(credsPath, "utf8"));
      return data.installed || data.web;
    }
  } catch (err: any) {
    console.error("Error leyendo gmail-credentials.json:", err.message);
  }
  return null;
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
    const creds = getGoogleCredentials();
    if (!creds) {
      return res.status(500).send("No se encontraron las credenciales del cliente de Google.");
    }

    const redirectUri = PUBLIC_URL 
      ? `${PUBLIC_URL}/auth/google/callback` 
      : `http://localhost:${PORT}/auth/google/callback`;

    // 1. Intercambiar el código por tokens
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

    console.log(`🔑 Vinculando usuario ${userId} con el correo ${email}...`);

    // 3. Guardar el correo en la base de datos
    await dbService.setUserEmail(userId, email);

    // 4. Importar el refresh_token a gog CLI si se recibió
    if (refresh_token) {
      const tokenObj = {
        email: email,
        client: "default",
        services: ["gmail", "calendar", "drive", "sheets"],
        scopes: [
          "openid",
          "profile",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/gmail.modify",
          "https://www.googleapis.com/auth/drive",
          "https://www.googleapis.com/auth/calendar",
          "https://www.googleapis.com/auth/spreadsheets"
        ],
        created_at: new Date().toISOString(),
        refresh_token: refresh_token
      };

      // Guardar el token en la base de datos (SaaS)
      await dbService.saveUserToken(userId, tokenObj);

      const localDataPath = path.join(process.cwd(), "data");
      const tempTokenPath = path.join(localDataPath, `temp_token_${userId}.json`);
      
      fs.writeFileSync(tempTokenPath, JSON.stringify(tokenObj, null, 2));

      const executable = path.join(process.cwd(), "bin", process.platform === "win32" ? "gog.exe" : "gog");
      const customEnv = { 
        ...process.env, 
        APPDATA: localDataPath,
        HOME: localDataPath, 
        USERPROFILE: localDataPath,
        GOG_KEYRING_PASSWORD: process.env.GOG_KEYRING_PASSWORD || "silvaniacoreagent"
      };

      const importCmd = `"${executable}" auth tokens import "${tempTokenPath}"`;
      console.log(`🔧 [gog] Importando token: ${importCmd}`);
      
      const { exec } = await import("child_process");
      exec(importCmd, { env: customEnv }, async (err, stdout, stderr) => {
        try { fs.unlinkSync(tempTokenPath); } catch {}

        if (err) {
          console.error("❌ Error importando token en gog:", stderr || err.message);
          res.status(500).send("Error al registrar las credenciales en el sistema.");
        } else {
          console.log(`✅ Token importado correctamente en gog para ${email}`);
          
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
        }
      });
    } else {
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
async function sendMorningMessages(botInstance: Bot) {
  console.log("🌞 [Cron] Iniciando generación de mensajes matutinos...");
  try {
    const users = await dbService.getAllUsers();
    for (const u of users) {
      const { userId, email } = u;
      console.log(`🌞 [Cron] Procesando usuario ${userId} (${email})...`);
      
      await userContextStore.run({ userId }, async () => {
        try {
          // 1. Obtener eventos de hoy
          let calendarSummary = "No hay eventos programados para hoy.";
          try {
            const eventsRes = await executeTool("calendar_list", { days_ahead: 1 }, userId);
            calendarSummary = eventsRes;
          } catch (e: any) {
            console.warn(`[Cron] No se pudieron obtener eventos para ${userId}:`, e.message);
          }

          // 2. Obtener correos recientes (Inbox)
          let gmailSummary = "No se pudieron obtener correos recientes.";
          try {
            const gmailRes = await executeTool("gmail_list", { max_results: 5 }, userId);
            gmailSummary = gmailRes;
          } catch (e: any) {
            console.warn(`[Cron] No se pudieron obtener correos para ${userId}:`, e.message);
          }

          // 3. Generar briefing matutino con el LLM
          const now = new Date();
          const madridTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
          const start = new Date(madridTime.getFullYear(), 0, 0);
          const diff = (madridTime.getTime() - start.getTime()) + ((start.getTimezoneOffset() - madridTime.getTimezoneOffset()) * 60 * 1000);
          const oneDay = 1000 * 60 * 60 * 24;
          const dayOfYear = Math.floor(diff / oneDay);
          const quoteIndex = dayOfYear % MOTIVATIONAL_QUOTES.length;
          const selectedQuote = MOTIVATIONAL_QUOTES[quoteIndex];

          const prompt = `Actúa como Silvania CoreAgent, el asistente personal del usuario. Genera un briefing matutino motivador, elegante y súper estructurado en español para el usuario.
          
          Aquí tienes sus eventos del calendario para hoy:
          ${calendarSummary}
          
          Aquí tienes sus correos electrónicos recientes:
          ${gmailSummary}
          
          Frase inspiradora sugerida para hoy:
          "${selectedQuote}"
          
          Instrucciones:
          1. Saluda con cordialidad y energía.
          2. Resume de forma clara los eventos/citas del día (usa emojis 🗓️, ⏰).
          3. Resume los correos recientes más importantes o pendientes (usa emojis 📩, 👤).
          4. Finaliza el briefing de manera fluida y elegante incorporando y desarrollando la frase inspiradora del día para motivar su jornada laboral como ejecutivo de élite. Asegúrate de dar un mensaje inspirador y nuevo cada día.
          Mantén el texto conciso, elegante y profesional.`;

          const response = await llmService.chat([
            { role: "system", content: "Eres Silvania CoreAgent, un asistente ejecutivo de élite." },
            { role: "user", content: prompt }
          ]);

          const text = response.content || "¡Buenos días! Que tengas un excelente día.";

          // 4. Enviar mensaje por Telegram
          await safeSendMessage(botInstance, userId, text);
          console.log(`🌞 [Cron] Mensaje matutino enviado con éxito a ${userId}`);
        } catch (err: any) {
          console.error(`❌ [Cron] Error enviando mensaje a ${userId}:`, err.message);
        }
      });
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

// Comando /start
bot.command("start", (ctx) => ctx.reply(
  `¡Hola! Soy Silvania, tu agente ejecutivo elite premium.\n` +
  `No soy solo un chat bot puedo hacer o ejecutar tareas reales en el mundo real ¿Cómo te llamas?\n\n` +
  `Ademas tambien puedo adaptarme a diferentes perfiles. Estos son algunos roles predeterminados:\n` +
  `• Ejecutivo (por defecto)\n` +
  `• Marketing\n` +
  `• Soporte Técnico\n` +
  `• Investigador / Analista\n\n` +
  `Dime cuál prefieres o descríbeme cómo quieres que sea (puedo personalizarlo al 100% según tus necesidades).`
));

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

// Comando /auth para generar y entregar el enlace
bot.command("auth", async (ctx) => {
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
      if (history.length === 0 && !text.startsWith("/")) {
        const welcome = `¡Hola! Soy Silvania, tu agente ejecutivo elite premium.\n` +
          `No soy solo un chat bot puedo hacer o ejecutar tareas reales en el mundo real ¿Cómo te llamas?\n\n` +
          `Ademas tambien puedo adaptarme a diferentes perfiles. Estos son algunos roles predeterminados:\n` +
          `• Ejecutivo (por defecto)\n` +
          `• Marketing\n` +
          `• Soporte Técnico\n` +
          `• Investigador / Analista\n\n` +
          `Dime cuál prefieres o descríbeme cómo quieres que sea (puedo personalizarlo al 100% según tus necesidades).`;

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
    clearInterval(typingInterval);
    console.error("Error procesando foto:", error);
    await ctx.reply("❌ No pude procesar o subir la imagen.");
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
    clearInterval(typingInterval);
    console.error("Error procesando documento:", error);
    await ctx.reply("❌ No pude procesar o subir el documento.");
  }
});


// Manejador de voz
bot.on("message:voice", async (ctx) => {
  const userId = ctx.from.id;
  await ctx.replyWithChatAction("typing");
  const typingInterval = setInterval(() => {
    ctx.replyWithChatAction("typing").catch(() => {});
  }, 4000);

  const file = await ctx.api.getFile(ctx.message.voice.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
  const fileName = `voice_${userId}_${Date.now()}.ogg`;

  try {
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
  } catch (error) {
    clearInterval(typingInterval);
    console.error("Error procesando audio:", error);
    await ctx.reply("❌ No pude procesar tu mensaje de voz.");
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
    clearInterval(typingInterval);
    console.error("Error procesando videonota:", error);
    await ctx.reply("❌ No pude transcribir tu videonota.");
  }
});

// Manejador de videos de Telegram
bot.on("message:video", async (ctx) => {
  const userId = ctx.from.id;
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
    clearInterval(typingInterval);
    console.error("Error procesando video:", error);
    await ctx.reply("❌ No pude transcribir el audio del video.");
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
