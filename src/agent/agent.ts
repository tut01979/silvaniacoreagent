import { llmService } from "../services/llm.js";
import { executeTool, loadSkillsSummary } from "../tools/index.js";
import { dbService } from "../database/db.js";
import { userContextStore } from "../services/context.js";
import { parseUserTasks, formatTaskSummary } from "../services/taskParser.js";
import { shouldTriggerMultitask } from "../services/multitaskFilter.js";
import fs from "fs";
import path from "path";

const MAX_ITERATIONS = 10;

export async function runAgent(userId: number, userMessage: string) {
  return userContextStore.run({ userId }, async () => {
    // Sincronizar memoria desde Google Drive a caché local si corresponde en segundo plano o si no hay historial local
    try {
      const hasLocal = dbService.hasLocalHistory(userId);
      if (!hasLocal) {
        console.log(`ℹ️ [Agent] Primera interacción o caché vacía. Sincronizando historial de Drive de forma síncrona.`);
        const { driveMemoryService } = await import("../services/driveMemory.js");
        await driveMemoryService.syncFromDrive(userId);
      } else {
        console.log(`ℹ️ [Agent] Historial local existente. Lanzando sincronización de Drive en segundo plano.`);
        import("../services/driveMemory.js")
          .then(({ driveMemoryService }) => driveMemoryService.syncFromDrive(userId))
          .catch(err => console.error("Error en syncFromDrive en segundo plano:", err.message));
      }
    } catch (err: any) {
      console.error("Error al iniciar sincronización de Drive:", err.message);
    }

    // 1. Guardar mensaje del usuario
    await dbService.addMessage(userId, "user", userMessage);

    // Obtener estado real de conexión de Google
    const email = await dbService.getUserEmail(userId);
    const token = await dbService.getUserToken(userId);
    const isLinked = !!token;
    const googleStatusStr = isLinked
      ? `Estado Google: VINCULADO (${email || "email desconocido"})`
      : `Estado Google: NO VINCULADO`;

    // Intercepción de ruteo rápido para enlaces directos de Google si ya está vinculado
    if (isLinked) {
      const cleanMsg = userMessage.toLowerCase().trim();
      if (!/\b(auth|vincular|conectar|cambiar)\b/i.test(cleanMsg)) {
        const hasDrive = /\b(drive|disco)\b/i.test(cleanMsg);
        const hasCalendar = /\b(calendar|calendario|agenda|reunion|reuniones)\b/i.test(cleanMsg);
        const hasGmail = /\b(gmail|correo|mail|inbox|bandeja)\b/i.test(cleanMsg);
        const hasSheets = /\b(sheets|hojas|excel|spreadsheets)\b/i.test(cleanMsg);
        
        const isAskingForLink = /\b(enlace|link|url|acceso|abre|abrir|ir|entrar|acceder|dirección|direccion|dame|pasa|pasame|pásame|muestra|muéstrame|muestrame|ver|dónde|donde|cómo|como)\b/i.test(cleanMsg) || cleanMsg.length <= 15;
        const hasComplexAction = /\b(busca|buscar|encuentra|crea|crear|borra|eliminar|mueve|mover|lista|listar|lee|leer|escribe|escribir|adjunta|sube|subir|descarga|descargar|factura|transcripcion|analiza)\b/i.test(cleanMsg);
        
        if (!hasComplexAction && (isAskingForLink || cleanMsg.includes("drive") || cleanMsg.includes("calendar") || cleanMsg.includes("gmail") || cleanMsg.includes("sheets"))) {
          const parts: string[] = [];
          if (hasDrive) parts.push(`📁 **Google Drive:** https://drive.google.com/drive/my-drive`);
          if (hasGmail) parts.push(`✉️ **Gmail:** https://mail.google.com/mail/u/0/#inbox`);
          if (hasCalendar) parts.push(`📅 **Google Calendar:** https://calendar.google.com/calendar/u/0/`);
          if (hasSheets) parts.push(`📊 **Google Sheets:** https://docs.google.com/spreadsheets/`);
          
          if (parts.length > 0) {
            const finalContent = `Aquí tienes tus accesos directos oficiales:\n\n${parts.join("\n")}`;
            await dbService.addMessage(userId, "assistant", finalContent);
            
            import("../services/driveMemory.js")
              .then(({ driveMemoryService }) => driveMemoryService.syncToDrive(userId))
              .catch(err => console.error("Error al guardar memoria en Drive (ruteo rápido intercepción):", err.message));
              
            return finalContent;
          }
        }
      }
    }

    // Parsear tareas si cumple con los criterios de multitarea, de lo contrario procesar como una única tarea
    const tasks = shouldTriggerMultitask(userMessage)
      ? await parseUserTasks(userMessage)
      : [userMessage];

    // 2. Obtener resumen de habilidades instaladas (filtrado por usuario)
    const skillsSummary = await loadSkillsSummary(userId);

    // 3. Fecha y hora actual para contexto del agente
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: "Europe/Madrid",
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZoneName: "short"
    };
    const nowStr = now.toLocaleString("es-ES", options);
    
    // Format local ISO for UTC+2
    const localNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
    const pad = (n: number) => n.toString().padStart(2, "0");
    const isoLocal = `${localNow.getFullYear()}-${pad(localNow.getMonth()+1)}-${pad(localNow.getDate())}T${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}+02:00`;

    // 4. Configurar System Prompt (sin backslash antes de ${} para que interpole correctamente)
    const systemPrompt = `Eres Silvania CoreAgent, el primer agente, y el producto estrella de Silvania.ai.
Silvania.ai es una plataforma SaaS multi-usuario de agentes de inteligencia artificial.

⏰ FECHA Y HORA ACTUAL: ${nowStr}
Formato ISO local: ${isoLocal}
Zona horaria: UTC+2 (CEST). Usa esta fecha (y su offset) para crear eventos o calcular fechas. NO llames a get_current_time.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 ESTADO DE LA CONEXIÓN DE GOOGLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${googleStatusStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 IDENTIDAD DEL AGENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Eres Silvania CoreAgent, un asistente ejecutivo modular que opera desde Telegram y ejecuta acciones explícitas del usuario.
- Nunca actúas de forma autónoma.
- Nunca inventas datos.
- Nunca generas enlaces falsos.
- Nunca ejecutas skills sin orden directa.

Tu función principal es:
1. Interpretar instrucciones del usuario.
2. Delegar tareas a skills o módulos internos.
3. Crear skills nuevas cuando el usuario las describe en lenguaje natural.
4. Mantener estabilidad, precisión y trazabilidad.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 REGLA ENLACES GOOGLE (OBLIGATORIA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Si el usuario pide enlace, acceso o abrir Drive, Gmail, Calendar o Sheets:
1. Si la cuenta YA está vinculada (ver Estado de Google arriba) → responde ÚNICAMENTE con estas URLs, sin más texto de autorización:
   - Drive: https://drive.google.com/drive/my-drive
   - Gmail: https://mail.google.com/mail/u/0/#inbox
   - Calendar: https://calendar.google.com/calendar/u/0/
   - Sheets: https://docs.google.com/spreadsheets/
2. Prohibido llamar a generate_authorization_link salvo que el usuario diga explícitamente /auth, 'vincular', 'conectar cuenta', 'cambiar de cuenta' o 'genera enlace de autorizacion'.
3. Prohibido decir 'necesito que autorices' si la cuenta ya está vinculada.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 CAPACIDADES DE VOZ Y LECTURA EN VOZ ALTA (TTS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tienes plena capacidad para hablar, leer textos y enviar audios o notas de voz a través del motor de TTS (Text-to-Speech) integrado en la plataforma.
1. Si el usuario te pide: "habla", "léeme esto", "leeme", "di en voz alta", "reproduce", "audio", "lee la respuesta anterior" o frases similares:
   - Está STRICTLY PROHIBIDO que digas "no puedo hablar", "no tengo capacidad para enviar audios" o "soy un modelo de lenguaje y no puedo".
   - Tu respuesta debe ser el texto exacto que el usuario quiere que leas o digas en voz alta. 
   - El sistema automáticamente tomará tu texto de respuesta y lo sintetizará en un mensaje de voz enviado al chat.
2. Si te pide "lee la respuesta anterior":
   - Busca en el historial de conversación el último mensaje que tú (el asistente) enviaste al usuario.
   - Responde con el texto exacto de ese último mensaje. No añadas introducciones o explicaciones adicionales como "Aquí está la respuesta anterior:". Limítate a devolver la respuesta para que el motor la lea fluidamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 SISTEMA DE SKILLS (PLANTILLA GENÉRICA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cuando el usuario pida crear una skill, usa esta plantilla:

NOMBRE DE LA SKILL:
<nombre>

OBJETIVO:
Descripción clara de lo que hace la skill.

ENTRADAS:
Lista de datos que la skill necesita.

SALIDAS:
Qué devuelve la skill (texto, hoja, archivo, resumen, etc.)

PROCESO:
1. Paso 1
2. Paso 2
3. Paso 3
(Detallado y sin ambigüedades)

REGLAS:
- No inventar datos.
- No generar enlaces falsos.
- Confirmar cada acción.
- Manejar errores con mensajes claros.
Después de crear la skill, la instalas en el sistema y queda disponible para uso inmediato.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MANEJO DE GOOGLE DRIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Si recibes un ID, úsalo directamente.
- Si la API no devuelve webViewLink, dilo: “La API no devolvió enlace. Necesito ID o enlace manual.”
- Enlace web general a Google Drive: https://drive.google.com/drive/my-drive
- Si el usuario pide enlace a Drive y la cuenta está vinculada, proporciona el enlace web oficial directo (https://drive.google.com/drive/my-drive). NO solicites vinculación ni ejecutes generate_authorization_link salvo que el usuario pida vincular/cambiar de cuenta.
- Nunca inventes enlaces.
- Para carpetas anidadas:
  1. Verificar existencia.
  2. Crear si falta.
  3. Confirmar con enlace final.
- Para mover archivos: Necesitas ID del archivo + ID de la carpeta destino.
- Para leer archivos:
  1. Si no hay texto, usar OCR.
  2. Si el PDF está vacío, dilo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MANEJO DE GOOGLE SHEETS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Crear hoja → confirmar spreadsheetId.
- Crear estructura completa.
- Añadir fórmulas reales.
- Confirmar que las fórmulas existen.
- Devolver enlace válido.
- Si la API falla: “La API no devolvió enlace. Reintenta.”
- **REGLA DE ESCRITURA MASIVA (BATCH WRITE):**
  * Para rellenar o guardar datos (como listas de prospección, tablas de resultados de skills o informes), debes realizar una sola escritura tras tener todos los datos: primero ejecuta todas las herramientas de búsqueda/obtención de datos, y luego realiza exactamente 1× \`sheets_create\` (si aplica) + 1× \`sheets_write\` con la matriz 2D completa conteniendo \`[cabeceras, ...filas]\`.
  * Está **estrictamente prohibido** realizar múltiples llamadas a \`sheets_write\` para la misma hoja en el mismo turno (prohibido escribir cabeceras en un turno y filas en otro, o escribir celda a celda).
  * **Si el enforcer de seguridad dispara un error de batch** (por haber llamado múltiples veces a \`sheets_write\`), está estrictamente prohibido que le digas al usuario que la hoja o enlace está listo. Debes leer el error de batch en la respuesta de la herramienta, reintentar inmediatamente en el mismo turno haciendo una única llamada con la matriz consolidada, o admitir el fallo de forma explícita.

**Plantilla de factura (skill genérica):**
Columnas:
1. Concepto
2. Cantidad
3. Precio Unitario
4. Importe (\`=B12*C12\` etc. apuntando a la celda de su respectiva fila).
5. Subtotal (\`=SUMA(D12:D14)\` en español, o \`=SUM(D12:D14)\` en inglés).
6. IVA (\`=D16*0,21\` en español, o \`=D16*0.21\` en inglés).
7. Total (\`=D16+D17\`).
*(Nota técnica: Para crear facturas es estrictamente OBLIGATORIO usar la herramienta \`sheets_create_invoice\`)*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MANEJO DE GMAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Para listar correos: remitente, fecha, categoría, enlace.
- Para leer correos: cuerpo completo.
- Para enviar correos: destinatario + contenido.
- Nunca inventes correos.
- Nunca inventes enlaces.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MANEJO DE CALENDAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Crear eventos con: fecha, hora, título, ubicación.
- Confirmar con enlace.
- Si no hay eventos: dilo claramente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MANEJO DE OCR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Si el PDF tiene texto → lectura nativa.
- Si no tiene texto → OCR.
- Si está vacío → dilo.
- Nunca inventes contenido.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MANEJO DE PROSPECCIÓN COMERCIAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Nunca inventes empresas.
- Nunca inventes webs.
- Nunca inventes descripciones.
- Si la búsqueda falla: “No encontré resultados válidos.”
- Generar hoja con columnas: \`Nombre | Sitio web | Dirección | Teléfono | Email | Actividad | Maps (opcional)\`.
  * En Sitio web pon solo la URL corporativa real (está prohibido poner enlaces de google.com/maps/search/ en esta columna, de ser necesario van en la columna Maps). Si no hay datos, deja la celda vacía.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 MANEJO DE ERRORES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Si la API falla: “La API no devolvió el dato necesario.”
- No inventes resultados.
- No inventes enlaces.
- No inventes contenido.
- Pedir ID, archivo o enlace si falta.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 CREACIÓN DE SKILLS EN LENGUAJE NATURAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cuando el usuario diga: “Crea una skill que haga X” debes:
1. Interpretar la necesidad.
2. Crear la skill usando la plantilla.
3. Instalarla en el Drive (\`silvania/skills/\`) e indexarla.
4. Confirmar que está lista.
5. Ejecutarla si el usuario lo pide.

*Ejemplo:*
- “Crea una skill para analizar facturas de electricidad”
- El agente debe crear: analisis_facturas_electricidad
- Entradas: PDF o ID
- Salidas: consumo, importe, desglose
- Proceso: lectura → OCR → extracción → resumen
- Reglas: no inventar datos

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔷 PREPARACIÓN PARA SOCIOS VIRTUALES (AGENTES EJECUTIVOS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
El sistema debe estar preparado para integrar y simular la interacción con socios virtuales:
- CMO Agent
- Marketing Agent
- Growth Agent
- Support Agent
- Metrics Agent
- Product Agent
- Ops Agent
- Tech Agent
Cada uno se instalará como skill avanzada con personalidad operativa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔧 MODO DE EJECUCIÓN DE HERRAMIENTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Siempre que el usuario solicite una acción que involucre Google Workspace (Sheets, Drive, Gmail, Calendar), OCR, prospección o cualquier otra herramienta, debes:

1. **Detectar la necesidad de herramientas** y activar el modo de ejecución de herramientas.
2. **Usar el modelo de herramientas** (como Gemini 2.5 Flash) para estas operaciones, en lugar del modelo de conversación.
3. **Nunca simular respuestas ni inventar tool calls**.
4. **Forzar la ejecución de herramientas** incluso si el router clasifica la consulta como “conversación simple” cuando se trata de una operación que requiere herramientas.
5. **Manejar errores reales** y devolver mensajes claros si una herramienta falla, solicitando ID, enlace o datos adicionales si es necesario.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🧬 HERRAMIENTAS DISPONIBLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**Google Workspace:** \`gmail_list\`, \`gmail_search\`, \`gmail_thread\`, \`gmail_send\`, \`drive_list\`, \`drive_search\`, \`drive_mkdir\`, \`drive_move\`, \`drive_upload\`, \`drive_remove\`, \`drive_create_text_file\`, \`drive_read_file\`, \`calendar_list\`, \`calendar_create\`, \`calendar_delete\`, \`sheets_list\`, \`sheets_create\`, \`sheets_read\`, \`sheets_write\`, \`sheets_create_invoice\`

**Memoria e Historial:** \`memory_get_summary\`, \`memory_update_summary\`, \`memory_list_history\`, \`memory_read_day\`, \`memory_search_by_topic\`, \`memory_list_folder\`

**Internet & Sistema:** \`web_search\`, \`read_url\`, \`execute_command\`, \`analyze_image\`, \`google_workspace\`, \`search_skills\`, \`get_skill\`, \`install_skill\`, \`create_skill\`, \`load_skills\`, \`generate_authorization_link\`

**Skills Instaladas Actualmente (Tus Superpoderes):**
${skillsSummary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⚠️ NOTA DE ESTABILIDAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Si detectas un error de red o de "Conflict", informa al usuario que estás reiniciando las conexiones. Eres un agente de EJECUCIÓN, actúa siempre con los datos reales obtenidos de las herramientas.`;

    // 4. Obtener historial y prompts de la caché local
    let customPromptStr = "";
    try {
      const cachedPrompt = await dbService.getCustomPrompt(userId);
      if (cachedPrompt) {
        customPromptStr = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n## ⚙️ INSTRUCCIONES PERSONALIZADAS DEL USUARIO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nEl usuario ha definido las siguientes reglas y roles personalizados en su Google Drive (archivo 'prompts/instrucciones_agente.txt'). Síguelas fielmente:\n${cachedPrompt}\n`;
      }
    } catch (e: any) {
      console.error("Error al cargar customPrompt en agent.ts:", e.message);
    }

    let drivePromptsStr = "";
    try {
      const localPromptsDir = path.join(process.cwd(), "data", `user_${userId}`, "prompts");
      if (fs.existsSync(localPromptsDir)) {
        const files = fs.readdirSync(localPromptsDir);
        for (const file of files) {
          if (file.endsWith(".md") || file.endsWith(".txt")) {
            const filePath = path.join(localPromptsDir, file);
            const content = fs.readFileSync(filePath, "utf8");
            drivePromptsStr += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n## ⚙️ INSTRUCCIONES DE DRIVE (${file})\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${content}\n`;
          }
        }
      }
    } catch (e: any) {
      console.error("Error leyendo prompts locales de caché:", e.message);
    }

    // Ruteo de modelos: google/gemini-2.5-flash por defecto, gpt-4o-mini en cortesías ultra-simples.
    const isCourtesy = isUltraSimpleCourtesy(userMessage);
    const targetModel = isCourtesy ? "openai/gpt-4o-mini" : "google/gemini-2.5-flash";
    console.log(`🤖 [Agent] Ruteo de modelo para "${userMessage}": ${targetModel}`);

    let history: any[] = [
      { role: "system", content: systemPrompt + customPromptStr + drivePromptsStr },
      ...(await dbService.getHistory(userId))
    ];

    if (tasks.length <= 1) {
      // Usar chat sin herramientas si la consulta no menciona palabras clave de herramientas, búsqueda o memoria
      let requiresTools = /crea|crear|lista|listar|busca|buscar|envia|envía|envias|envías|lee|leer|open|genera|generar|sube|subir|mueve|mover|borra|borrar|investiga|investigar|resume|resumir|transcribe|transcribir|factura|evento|correo|email|gmail|mensaje|recibido|bandeja|drive|carpeta|archivo|subir|descargar|mkdir|calendar|calendario|cita|reunion|reunión|agenda|programar|youtube|video|transcripcion|transcripción|sheets|excel|hoja|celda|fila|columna|web_search|noticia|noticias|memoria|historial|resumen|recordar|recuerdas|nombre|ayer|hablamos|primera|conversacion|conversación|dijiste|dije|skill|skills|habilidad|habilidades/i.test(userMessage);

      // Heurística de UX ampliada: Si el mensaje del usuario es una confirmación u orden corta
      // (ej: "ok", "si", "termina el trabajo", "hazlo", "procede", "genera el enlace")
      // y el historial muestra que hay una acción pendiente o el asistente lo requirió, forzar requiresTools = true.
      if (!requiresTools) {
        const cleanMsg = userMessage.toLowerCase().trim();
        const isConfirmationOrImperative = 
          /^(ok|si|sí|vale|procede|adelante|dale|continua|continuar|listo|termina|hazlo|guárdalo|guardalo|créalo|crealo|genera el enlace)$/i.test(cleanMsg) || 
          cleanMsg.length < 25 && /(ok|procede|adelante|continua|continuar|dale|termina|hazlo|guárdalo|guardalo|créalo|crealo|genera)/i.test(cleanMsg);
        
        if (isConfirmationOrImperative) {
          const userHistory = await dbService.getHistory(userId, 5);
          const lastAssistantMsg = [...userHistory].reverse().find(msg => msg.role === "assistant");
          if (lastAssistantMsg && lastAssistantMsg.content) {
            const contentLower = lastAssistantMsg.content.toLowerCase();
            const indicatesAction = /voy a|procedo|guardar|crear|buscar|enviar|generar|un momento|espera/i.test(contentLower);
            if (indicatesAction) {
              console.log(`ℹ️ [Agent] Confirmación u orden corta detectada ("${userMessage}"). Forzando requiresTools = true para mantener acceso a herramientas.`);
              requiresTools = true;
            }
          }
        }
      }

      // Si el bot estaba en medio de una búsqueda o proceso, forzar uso de herramientas para no abandonar la tarea
      const isAwaiting = await dbService.isAwaitingSearchResponse(userId).catch(() => false);
      if (isAwaiting) {
        console.log(`ℹ️ [Agent] A la espera de respuesta de búsqueda previa. Forzando uso de herramientas.`);
        requiresTools = true;
      }

      if (!requiresTools) {
        console.log(`⚡ [Agent] Optimizando latencia: consulta conversacional simple detectada. Ejecutando sin herramientas.`);
        const responseText = await llmService.chatWithoutTools(history, targetModel);
        const finalContent = filterFinalOutput(enforceHardLimit(sanitizeAlucinatedLinks(responseText || "No tengo una respuesta en este momento.", history)));
        await dbService.addMessage(userId, "assistant", finalContent);
        
        // Guardar memoria actualizada en Google Drive en segundo plano (no bloqueante)
        if (!isCourtesy) {
          import("../services/driveMemory.js")
            .then(({ driveMemoryService }) => driveMemoryService.syncToDrive(userId))
            .catch(err => console.error("Error al guardar memoria en Drive (conversacional rápido):", err.message));
        }
        return finalContent;
      }

      let iterations = 0;
      const seenProgressMsgs = new Set<string>();
      while (iterations < MAX_ITERATIONS) {
        const response = await llmService.chat(history, targetModel, userId);
        
        if (response.content) {
          const contentStr = response.content.trim();
          if (isProgressMessage(contentStr)) {
            const normalized = contentStr.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¡¿]/g, "");
            if (seenProgressMsgs.has(normalized)) {
              console.warn(`🚨 [Anti-Loop] Bucle de mensaje de progreso detectado: "${contentStr}". Finalizando.`);
              const exitMsg = "❌ Se detectó un bucle repetitivo de progreso. Operación abortada.";
              await dbService.addMessage(userId, "assistant", exitMsg);
              return exitMsg;
            }
            seenProgressMsgs.add(normalized);
          }
        }
        
        // Si no quiere usar herramientas, terminamos
        if (!response.tool_calls || response.tool_calls.length === 0) {
          const rawContent = response.content || "No tengo una respuesta en este momento.";
          const finalContent = filterFinalOutput(enforceHardLimit(sanitizeAlucinatedLinks(rawContent, history)));
          await dbService.addMessage(userId, "assistant", finalContent);

          // Guardar memoria actualizada en Google Drive en segundo plano (no bloqueante)
          if (!isCourtesy) {
            import("../services/driveMemory.js")
              .then(({ driveMemoryService }) => driveMemoryService.syncToDrive(userId))
              .catch(err => console.error("Error al sincronizar memoria a Drive al finalizar el agente:", err.message));
          }

          return finalContent;
        }

        // Verificar abuso de llamadas individuales de escritura de Sheets
        const sheetsWriteCalls = response.tool_calls.filter(tc => tc.function.name === "sheets_write");
        if (sheetsWriteCalls.length >= 3) {
          const sheetIds = sheetsWriteCalls.map(tc => {
            try {
              return JSON.parse(tc.function.arguments).spreadsheet_id;
            } catch {
              return null;
            }
          });
          const hasAbuse = sheetIds.some(id => id && sheetIds.filter(x => x === id).length >= 3);
          if (hasAbuse) {
            console.warn("⚠️ [Agent] Detectadas >= 3 llamadas a sheets_write en el mismo turno para la misma hoja. Forzando error batch.");
            history.push(response);
            for (const toolCall of response.tool_calls) {
              history.push({
                role: "tool" as const,
                tool_call_id: toolCall.id,
                content: "❌ Error: Usa UNA sola sheets_write con matriz 2D completa. Prohibido celda a celda."
              });
            }
            iterations++;
            continue;
          }
        }

        // Si quiere usar herramientas, las ejecutamos
        history.push(response);
        
        for (const toolCall of response.tool_calls) {
          let result;
          try {
            result = await executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments), userId);
          } catch (err: any) {
            console.error(`❌ Error ejecutando herramienta ${toolCall.function.name}:`, err.message);
            result = `❌ Error en herramienta ${toolCall.function.name}: ${err.message}`;
          }
          
          // Añadimos el resultado de la herramienta al historial
          history.push({
            role: "tool" as const,
            tool_call_id: toolCall.id,
            content: String(result)
          });
        }

        // Volvemos a preguntar al modelo con los resultados de las herramientas
        iterations++;
      }

      const limitMsg = "Error interno: se ha superado el límite de iteraciones de herramientas para esta tarea.";
      await dbService.addMessage(userId, "assistant", limitMsg);
      return limitMsg;
    } else {
      // 1. Ejecutar las tareas individualmente con su propio historial aislado para evitar redundancias
      // Deduplicar tareas idénticas o muy similares antes de procesarlas
      const uniqueTasks: string[] = [];
      for (const t of tasks) {
        const cleanT = t.toLowerCase().trim();
        const isRedundant = uniqueTasks.some(existing => {
          const extL = existing.toLowerCase().trim();
          return extL.includes(cleanT) || cleanT.includes(extL);
        });
        if (!isRedundant) {
          uniqueTasks.push(t);
        }
      }

      const taskResults: { task: string; result: string }[] = [];

      for (let i = 0; i < uniqueTasks.length; i++) {
        const task = uniqueTasks[i];
        const originalHistoryLength = history.length;
        const taskHistory = [...history];

        // Reemplazar el último mensaje del historial (que es el mensaje multitarea original) con la tarea específica
        if (taskHistory.length > 0 && taskHistory[taskHistory.length - 1].role === "user") {
          taskHistory[taskHistory.length - 1] = {
            role: "user",
            content: `Ejecuta la siguiente tarea de forma autónoma y directa utilizando tus herramientas: "${task}"`
          };
        }

        let taskInstruction = `Por favor, ejecuta ahora la tarea ${i + 1} de forma proactiva: "${task}"`;
        const taskLower = task.toLowerCase();
        if (taskLower.includes("lista") || taskLower.includes("mostrar") || taskLower.includes("ver")) {
          if (taskLower.includes("carpeta") || taskLower.includes("historial") || taskLower.includes("silvania") || taskLower.includes("drive")) {
            taskInstruction += `\n⚠️ INSTRUCCIÓN DE HERRAMIENTA: Llama INMEDIATAMENTE a la herramienta drive_list (o memory_list_folder) con el parámetro parentId o folderNameOrId correspondiente a la carpeta mencionada (ej: parentId: "silvania/historial").`;
          }
        }

        // Añadir instrucción específica al historial aislado
        taskHistory.push({
          role: "user",
          content: taskInstruction
        });

        let iterations = 0;
        let taskCompletedContent = "";
        const seenProgressMsgs = new Set<string>();

        while (iterations < MAX_ITERATIONS) {
          const response = await llmService.chat(taskHistory, targetModel, userId);

          if (response.content) {
            const contentStr = response.content.trim();
            if (isProgressMessage(contentStr)) {
              const normalized = contentStr.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¡¿]/g, "");
              if (seenProgressMsgs.has(normalized)) {
                console.warn(`🚨 [Anti-Loop] Bucle de progreso detectado en tarea: "${contentStr}". Finalizando.`);
                taskCompletedContent = "❌ Operación abortada por bucle repetitivo de progreso.";
                break;
              }
              seenProgressMsgs.add(normalized);
            }
          }

          if (!response.tool_calls || response.tool_calls.length === 0) {
            taskCompletedContent = response.content || "Completado.";
            taskHistory.push(response);
            break;
          }

          // Verificar abuso de llamadas individuales de escritura de Sheets
          const sheetsWriteCalls = response.tool_calls.filter(tc => tc.function.name === "sheets_write");
          if (sheetsWriteCalls.length >= 3) {
            const sheetIds = sheetsWriteCalls.map(tc => {
              try {
                return JSON.parse(tc.function.arguments).spreadsheet_id;
              } catch {
                return null;
              }
            });
            const hasAbuse = sheetIds.some(id => id && sheetIds.filter(x => x === id).length >= 3);
            if (hasAbuse) {
              console.warn("⚠️ [Agent] Detectadas >= 3 llamadas a sheets_write en el mismo turno para la misma hoja en multitarea. Forzando error batch.");
              taskHistory.push(response);
              for (const toolCall of response.tool_calls) {
                taskHistory.push({
                  role: "tool" as const,
                  tool_call_id: toolCall.id,
                  content: "❌ Error: Usa UNA sola sheets_write con matriz 2D completa. Prohibido celda a celda."
                });
              }
              iterations++;
              continue;
            }
          }

          taskHistory.push(response);

          for (const toolCall of response.tool_calls) {
            let result;
            try {
              result = await executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments), userId);
            } catch (err: any) {
              console.error(`❌ Error ejecutando herramienta ${toolCall.function.name}:`, err.message);
              result = `❌ Error en herramienta ${toolCall.function.name}: ${err.message}`;
            }

            taskHistory.push({
              role: "tool" as const,
              tool_call_id: toolCall.id,
              content: String(result)
            });
          }
          iterations++;
        }

        if (iterations >= MAX_ITERATIONS && !taskCompletedContent) {
          taskCompletedContent = "Límite de iteraciones alcanzado.";
        }

        taskResults.push({ task, result: taskCompletedContent });

        // Acumular los nuevos mensajes generados en esta tarea de vuelta al historial principal (history)
        const newMessages = taskHistory.slice(originalHistoryLength);
        history.push(...newMessages);
      }

      // 2. Compilar la respuesta final detallada uniendo el resultado de cada tarea de forma consolidada
      let finalAgentResponse = "";
      if (uniqueTasks.length <= 1) {
        finalAgentResponse = taskResults[0]?.result || "Completado.";
      } else {
        finalAgentResponse = taskResults.map(tr => tr.result).join("\n\n");
      }

      // Sanitizar todo el reporte multitarea final para evitar enlaces alucinados
      finalAgentResponse = filterFinalOutput(enforceHardLimit(sanitizeAlucinatedLinks(finalAgentResponse, history)));

      // Guardar la respuesta final compilada en la DB del usuario
      await dbService.addMessage(userId, "assistant", finalAgentResponse);

      // Sincronizar memoria a Drive en segundo plano (no bloqueante)
      if (!isCourtesy) {
        import("../services/driveMemory.js")
          .then(({ driveMemoryService }) => driveMemoryService.syncToDrive(userId))
          .catch(err => console.error("Error al sincronizar memoria a Drive al finalizar el agente multitarea:", err.message));
      }

      return finalAgentResponse;
    }
  });
}

/**
 * Divide un mensaje complejo del usuario en una lista de tareas individuales delegando al servicio taskParser.
 */
async function parseMultipleTasks(userMessage: string): Promise<string[]> {
  return await parseUserTasks(userMessage);
}

/**
 * Detecta saludos y cortesías ultra-simples para ruteo rápido.
 */
export function isUltraSimpleCourtesy(text: string): boolean {
  if (!text) return false;
  const clean = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¡¿]/g, "") // Eliminar puntuación
    .replace(/\s+/g, " ")
    .trim();

  const words = clean.split(" ");
  if (words.length === 0 || words.length > 3) return false;

  const courtesyWords = new Set([
    "hola", "hi", "buenas", "buenos", "dias", "tardes", "noches",
    "ok", "okay", "vale", "perfecto", "gracias", "de", "nada",
    "entendido", "listo", "que", "dia", "es", "hoy", "hora"
  ]);

  return words.every(w => courtesyWords.has(w));
}

function sanitizeAlucinatedLinks(responseText: string, history: any[]): string {
  const validIds = new Set<string>();
  const validUrls = new Set<string>();
  const idRegex = /\b([a-zA-Z0-9_-]{12,65})\b/g;

  // 1. Escanear todas las respuestas de las herramientas del historial para recopilar IDs y URLs reales y válidos
  for (const msg of history) {
    if (msg.role === "tool" && msg.content) {
      let match;
      idRegex.lastIndex = 0;
      while ((match = idRegex.exec(msg.content)) !== null) {
        validIds.add(match[1]);
      }
      
      const urls = msg.content.match(/(https?:\/\/[^\s)\]`'"]+)/gi) || [];
      for (const u of urls) {
        validUrls.add(u.trim());
      }
    }
  }

  // 2. Escanear respuestas anteriores del asistente por si reutilizamos enlaces creados con éxito
  for (const msg of history) {
    if (msg.role === "assistant" && msg.content) {
      const urls = msg.content.match(/(https?:\/\/[^\s)\]`'"]+)/gi) || [];
      for (const u of urls) {
        const trimmed = u.trim();
        if (!trimmed.includes("Enlace no disponible") && !trimmed.includes("URL neutralizada")) {
          validUrls.add(trimmed);
          let match;
          idRegex.lastIndex = 0;
          while ((match = idRegex.exec(trimmed)) !== null) {
            validIds.add(match[1]);
          }
        }
      }
    }
  }

  // URLs de Drive o Docs alucinables
  const driveLinkRegex = /(https?:\/\/(?:docs|drive|calendar)\.google\.com\/[^\s)\]`'"]+)/gi;
  let sanitizedText = responseText;
  const linksFound = responseText.match(driveLinkRegex) || [];
  let neutralizedCount = 0;

  const whitelistUrls = new Set([
    "https://drive.google.com",
    "https://drive.google.com/",
    "https://drive.google.com/drive",
    "https://drive.google.com/drive/my-drive",
    "https://mail.google.com",
    "https://mail.google.com/",
    "https://mail.google.com/mail",
    "https://mail.google.com/mail/u/0/#inbox",
    "https://calendar.google.com",
    "https://calendar.google.com/",
    "https://calendar.google.com/calendar",
    "https://calendar.google.com/calendar/u/0/",
    "https://docs.google.com/spreadsheets"
  ]);

  for (const link of linksFound) {
    const cleanLink = link.trim();
    if (whitelistUrls.has(cleanLink) || Array.from(whitelistUrls).some(wl => cleanLink.startsWith(wl) || wl.startsWith(cleanLink))) {
      continue;
    }
    if (validUrls.has(cleanLink)) {
      continue;
    }

    let linkId = "";
    const dMatch = cleanLink.match(/\/d\/([a-zA-Z0-9_-]{12,65})/i);
    const folderMatch = cleanLink.match(/\/folders\/([a-zA-Z0-9_-]{12,65})/i);
    const idParamMatch = cleanLink.match(/[?&]id=([a-zA-Z0-9_-]{12,65})/i);

    if (dMatch) {
      linkId = dMatch[1];
    } else if (folderMatch) {
      linkId = folderMatch[1];
    } else if (idParamMatch) {
      linkId = idParamMatch[1];
    }

    if (linkId) {
      // Si el ID del enlace no fue emitido por ninguna herramienta ni mensaje anterior, es inventado por el LLM
      if (!validIds.has(linkId)) {
        neutralizedCount++;
        sanitizedText = sanitizedText.replace(link, "[Enlace no disponible - creación no ejecutada o fallida]");
      }
    } else {
      // Si no pudimos extraer el ID pero la URL de Google es nueva y no estaba en validUrls, la neutralizamos por seguridad
      neutralizedCount++;
      sanitizedText = sanitizedText.replace(link, "[Enlace no disponible - creación no ejecutada o fallida]");
    }
  }

  if (neutralizedCount > 0) {
    console.log(`🚨 [Link Sanitizer] Neutralizadas ${neutralizedCount} URLs alucinadas en esta respuesta`);
  }

  return sanitizedText;
}

/**
 * Trunca las respuestas del agente si superan la longitud máxima de seguridad para evitar fallos de buffer o logs infinitos.
 */
function enforceHardLimit(text: string): string {
  const MAX = 12000;
  if (text.length > MAX) {
    return text.slice(0, MAX) + "\n\n[Respuesta truncada por tamaño excesivo. Posible error interno.]";
  }
  return text;
}

function filterFinalOutput(text: string): string {
  if (!text) return "";

  // 1. Detectar si contiene llamadas a herramientas simuladas en texto
  const hasToolSimulations = /tools\.[a-zA-Z0-9_-]+\(/i.test(text) || 
                            /drive_create_text_file\(/i.test(text) || 
                            /sheets_write\(/i.test(text) || 
                            /calendar_create\(/i.test(text);
                            
  if (hasToolSimulations) {
    console.warn("🚨 [Output Filter] Detectada simulación/echo de tool calls en el texto. Abortando respuesta.");
    return "Error interno: se detuvo una generación inválida de ID/hoja. Reintenta la petición.";
  }

  // 2. Detectar patrones repetitivos infinitos (ej. secuencias de 8+ caracteres repetidas consecutivamente 4+ veces)
  const clean = text.trim();
  for (let len = 8; len <= 30; len++) {
    for (let i = 0; i <= clean.length - len * 4; i++) {
      const chunk = clean.substring(i, i + len);
      const rest = clean.substring(i + len);
      if (rest.startsWith(chunk + chunk + chunk) || rest.startsWith("-" + chunk + "-" + chunk + "-" + chunk)) {
        console.warn(`🚨 [Output Filter] Detectada repetición infinita del chunk "${chunk}". Abortando respuesta.`);
        return "Error interno: se detuvo una generación inválida de ID/hoja. Reintenta la petición.";
      }
    }
  }

  return text;
}

function isProgressMessage(text: string): boolean {
  const clean = text.toLowerCase().trim();
  return (
    clean.includes("generando") ||
    clean.includes("procesando") ||
    clean.includes("buscando") ||
    clean.includes("un momento") ||
    clean.includes("por favor espera") ||
    clean.includes("espera un") ||
    clean.includes("procedo a") ||
    clean.includes("voy a buscar") ||
    clean.includes("voy a generar")
  );
}
