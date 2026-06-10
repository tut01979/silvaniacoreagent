import { Bot, InputFile } from "grammy";
import { spawn } from "child_process";
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



const bot = new Bot(config.telegram.token);

// Función para limpiar texto antes de enviarlo al motor de voz
function cleanTextForTTS(text: string): string {
  return text
    .replace(/[*_#`\[\]()]/g, "") // Quitar caracteres de Markdown
    .replace(/(\d{1,2}):(\d{2})/g, "$1 y $2") // Convertir "12:23" en "12 y 23" para que no deletree los dos puntos
    .replace(/\n/g, " ") // Quitar saltos de línea
    .trim();
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

// Envío seguro: URLs bare son auto-enlazadas por Telegram sin necesitar parse_mode
async function safeReply(ctx: any, text: string) {
  const chunks = splitTextIntoSafeChunks(text, 3900);

  for (const chunk of chunks) {
    try {
      await ctx.reply(chunk, {
        parse_mode: "Markdown",
        link_preview_options: { is_disabled: true },
      });
    } catch (err: any) {
      if (err.message?.includes("can't parse entities") || err.message?.includes("entities")) {
        console.warn("⚠️ Falló envío con Markdown, reintentando en texto plano:", err.message);
        await ctx.reply(chunk, {
          link_preview_options: { is_disabled: true },
        });
      } else {
        console.error("Error enviando mensaje:", err);
        await ctx.reply("❌ Error enviando parte de la respuesta.");
      }
    }
  }
}

interface PendingAuth {
  email: string;
  authProcess: any;
  urlSent: boolean;
  port?: string;
  ctx: any;
}
const activeAuthProcesses = new Map<number, PendingAuth>();

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || ""; // e.g. https://myapp.railway.app

app.get("/auth/google/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send("Faltan parámetros code o state.");
  }
  const userId = parseInt(state as string);
  const pending = activeAuthProcesses.get(userId);
  if (!pending) {
    return res.status(400).send("No hay ningún proceso de autenticación activo para este usuario.");
  }
  
  const port = pending.port || "8080";
  const redirectUrl = `http://localhost:${port}/oauth2/callback?code=${code}&state=${state}\n`;
  
  try {
    pending.authProcess.stdin.write(redirectUrl);
    res.send(`
      <html>
        <head>
          <title>Conexión SilvaniaCoreAgent</title>
          <meta charset="utf-8">
        </head>
        <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px; background-color: #f5f5f5;">
          <div style="background: white; padding: 30px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h1 style="color: #4CAF50; margin-bottom: 10px;">⚡ ¡Vínculo Completado!</h1>
            <p style="color: #666; font-size: 16px;">Has autorizado correctamente el acceso de SilvaniaCoreAgent.</p>
            <p style="color: #999; font-size: 14px;">Ya puedes cerrar esta ventana y regresar a Telegram.</p>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("Error escribiendo en stdin de authProcess:", err);
    res.status(500).send("Error interno procesando la autenticación.");
  }
});

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
          await botInstance.api.sendMessage(userId, text, {
            parse_mode: "Markdown",
            link_preview_options: { is_disabled: true }
          });
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

// Middleware de seguridad: Whitelist (adaptado para SaaS)
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const allowed = config.telegram.allowedUsers;
  const isSaasOpen = allowed.length === 0 || (allowed.length === 1 && (isNaN(allowed[0]) || allowed[0] === 0));

  if (!isSaasOpen && !allowed.includes(userId)) {
    console.log(`⚠️ Acceso denegado para el usuario: ${userId}`);
    return; // Ignorar
  }
  await next();
});

// Comando /start
bot.command("start", (ctx) => ctx.reply("🦾 SilvaniaCoreAgent operativo. ¿En qué puedo ayudarte?"));

// Comando /clear para resetear la memoria
bot.command("clear", async (ctx) => {
  await dbService.clearHistory(ctx.from!.id);
  ctx.reply("🧠 Memoria de conversación reseteada.");
});

// Comando /auth para generar y entregar el enlace
bot.command("auth", async (ctx) => {
  const args = ctx.match;
  const email = args?.trim();

  if (!email || !email.includes("@")) {
    return ctx.reply("Para vincular tu cuenta de Google, por favor indícame tu correo.\n\nEjemplo: `/auth tu_correo@gmail.com`", { parse_mode: "Markdown" });
  }

  const userId = ctx.from!.id;
  await dbService.setUserEmail(userId, email);
  
  await ctx.reply(`Generando enlace de autorización para ${email}. Por favor, espera unos segundos...`, { link_preview_options: { is_disabled: true } });

  const executable = process.platform === "win32" ? "bin\\gog.exe" : "./bin/gog";
  
  const localDataPath = path.join(process.cwd(), "data");
  const customEnv = { 
    ...process.env, 
    APPDATA: localDataPath,
    HOME: localDataPath, 
    USERPROFILE: localDataPath
  };

  const authProcess = spawn(executable, ["auth", "add", email, "--manual", "--services", "gmail,calendar,drive,sheets"], { 
    shell: true,
    env: customEnv
  });

  let urlSent = false;
  let accumulatedOutput = "";
  let extractedPort = "8080";

  activeAuthProcesses.set(userId, {
    email,
    authProcess,
    urlSent: false,
    ctx
  });

  authProcess.stdout.on("data", async (data) => {
    const chunk = data.toString();
    accumulatedOutput += chunk;
    console.log(`[Auth Output User ${userId}]:`, chunk);

    if (!urlSent && accumulatedOutput.includes("https://accounts.google.com")) {
      const urlMatch = accumulatedOutput.match(/(https:\/\/accounts\.google\.com[^\s]+)/);
      if (urlMatch) {
        let authUrl = urlMatch[1];
        urlSent = true;

        const portMatch = authUrl.match(/localhost:(\d+)/) || authUrl.match(/127\.0\.0\.1:(\d+)/);
        if (portMatch) {
          extractedPort = portMatch[1];
          activeAuthProcesses.get(userId)!.port = extractedPort;
        }

        if (PUBLIC_URL) {
          const publicCallback = `${PUBLIC_URL}/auth/google/callback`;
          authUrl = authUrl
            .replace(/redirect_uri=http%3A%2F%2Flocalhost%3A\d+%2Foauth2%2Fcallback/, `redirect_uri=${encodeURIComponent(publicCallback)}`)
            .replace(/redirect_uri=http%3A%2F%2F127\.0\.0\.1%3A\d+%2Foauth2%2Fcallback/, `redirect_uri=${encodeURIComponent(publicCallback)}`);
          
          authUrl += `&state=${userId}`;
          
          await ctx.reply(
            `🔗 **Enlace de Vinculación Automática:**\n[Haz clic aquí para autorizar tu cuenta](${authUrl})\n\n` +
            `Una vez autorizado en el navegador, el bot se vinculará de forma completamente automática y segura.`,
            { parse_mode: "Markdown", link_preview_options: { is_disabled: true } }
          );
        } else {
          await ctx.reply(
            `🔗 **Enlace de Vinculación:**\n[Haz clic aquí para autorizar tu cuenta](${authUrl})\n\n` +
            `Una vez que inicies sesión y autorices los permisos:\n` +
            `1. Serás redirigido a una página local (que dará un error de conexión, esto es normal).\n` +
            `2. **Copia la dirección URL completa** de la barra de direcciones de tu navegador.\n` +
            `3. **Pega ese enlace aquí mismo** en el chat para completar la vinculación.`,
            { parse_mode: "Markdown", link_preview_options: { is_disabled: true } }
          );
        }
      }
    }

    if (accumulatedOutput.toLowerCase().includes("successfully")) {
      await ctx.reply(`✅ ¡Tu cuenta de Google (${email}) ha sido vinculada correctamente!`);
      activeAuthProcesses.delete(userId);
      try { authProcess.kill(); } catch {}
    }
  });

  authProcess.stderr.on("data", (data) => {
    console.error(`[Auth Error User ${userId}]:`, data.toString());
  });

  authProcess.on("exit", (code) => {
    console.log(`[Auth Process User ${userId}] finalizado con código:`, code);
    activeAuthProcesses.delete(userId);
  });
});

// Manejador de mensajes de texto
bot.on("message:text", async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;

  // 1. Verificar si el usuario está en proceso de autenticación y pegó el callback
  const pending = activeAuthProcesses.get(userId);
  if (pending && (text.startsWith("http://") || text.startsWith("https://") || text.includes("code="))) {
    await ctx.reply("Procesando tu URL de autorización. Por favor, espera...");
    try {
      pending.authProcess.stdin.write(text + "\n");
    } catch (err: any) {
      ctx.reply(`❌ Error escribiendo la URL de callback: ${err.message}`);
    }
    return;
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

    // OPCIONAL: Enviar también audio (TTS) si se solicita o hay palabras clave
    const voiceKeywords = ["habla", "léeme", "leeme", "di ", "di,", "reproduce", "voz", "audio", "escucha", "pronuncia"];
    const shouldSendVoice = voiceKeywords.some(keyword => text.toLowerCase().includes(keyword));

    if (shouldSendVoice) {
      const cleanText = cleanTextForTTS(response);
      const audioPaths = await voiceService.textToSpeech(cleanText, userId);
      if (audioPaths && audioPaths.length > 0) {
        for (const audioPath of audioPaths) {
          await ctx.replyWithVoice(new InputFile(audioPath));
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

    const { descriptiveName, description, fileId, descriptionFileId } = await fileManager.processAndUpload(userId, fileUrl, originalName, true);
    clearInterval(typingInterval);
    
    // Generar un contexto para el agente para que sepa qué hacer a continuación
    const descFileLink = descriptionFileId ? `https://drive.google.com/file/d/${descriptionFileId}/view` : "";
    const agentContext = `He subido una imagen llamada "${descriptiveName}" (ID: ${fileId || "no disponible"}) con esta descripción: "${description}". 
    También he guardado esta descripción en un archivo de texto (ID: ${descriptionFileId || "no disponible"}). ${descFileLink ? `Enlace: ${descFileLink}` : ""}
    Por favor, informa al usuario, proporciónale el enlace directo al archivo y pregúntale qué quiere hacer con ella (OCR, análisis profundo, etc.).`;
    
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
  
  await ctx.replyWithChatAction("typing");
  const typingInterval = setInterval(() => {
    ctx.replyWithChatAction("typing").catch(() => {});
  }, 4000);

  try {
    const file = await ctx.api.getFile(doc.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
    const originalName = doc.file_name || `doc_${Date.now()}`;

    const { descriptiveName, description, fileId, descriptionFileId } = await fileManager.processAndUpload(userId, fileUrl, originalName, false);
    clearInterval(typingInterval);
    
    const descFileLink = descriptionFileId ? `https://drive.google.com/file/d/${descriptionFileId}/view` : "";
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
    const transcribedText = await audioService.downloadAndTranscribe(fileUrl, fileName);
    console.log(`🎙️ Usuario dijo: ${transcribedText}`);
    await ctx.reply(`🎙️ _Escuché:_ "${escapeMarkdown(transcribedText)}"`, { parse_mode: "Markdown" });

    // 2. Procesar con el agente
    const response = await runAgent(userId, transcribedText);
    clearInterval(typingInterval);
    
    // 3. Responder con texto
    await safeReply(ctx, response);

    // 4. Responder con voz (TTS) - Siempre en respuesta a un audio
    const cleanResponse = cleanTextForTTS(response);
    const audioPaths = await voiceService.textToSpeech(cleanResponse, userId);
    if (audioPaths && audioPaths.length > 0) {
      for (const audioPath of audioPaths) {
        await ctx.replyWithVoice(new InputFile(audioPath));
      }
    }
  } catch (error) {
    clearInterval(typingInterval);
    console.error("Error procesando audio:", error);
    await ctx.reply("❌ No pude procesar tu mensaje de voz.");
  }
});

// Iniciar bot
console.log("🚀 SilvaniaCoreAgent encendido y activo...");
bot.start().catch(err => {
    console.error("❌ Error iniciando el bot:", err);
});

// Manejo de apagado gracioso para evitar errores 409 (Conflict)
const stopBot = async () => {
    console.log("🛑 Apagando SilvaniaCoreAgent...");
    await bot.stop();
    process.exit(0);
};

process.on("SIGINT", stopBot);
process.on("SIGTERM", stopBot);
