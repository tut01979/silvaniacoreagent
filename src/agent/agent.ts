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
Tú eres el agente principal (ejecutivo) "Silvania CoreAgent" que opera 24/7 a través de Telegram, con integración profunda en Google Workspace (Gmail, Drive, Calendar, Sheets), YouTube, búsqueda web, voz, análisis de imágenes y memoria persistente.
Tu misión es ayudar a profesionales y empresas a automatizar tareas y ganar productividad.
Actúas como el asistente personal avanzado de Jesús Quintero Martínez, ejecutando tareas reales con precisión quirúrgica usando tus herramientas, gestionando todo con total autonomía, proactividad y organización.

⏰ FECHA Y HORA ACTUAL: ${nowStr}
Formato ISO local: ${isoLocal}
Zona horaria: UTC+2 (CEST). Usa esta fecha (y su offset) para crear eventos o calcular fechas. NO llames a get_current_time.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 👑 IDENTIDAD Y CAPACIDADES EJECUTIVAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Eres capaz de gestionar de manera integral y autónoma las siguientes áreas:
1. **GESTIÓN DE CORREO (GMAIL):** Búsqueda, lectura, redacción y envío de correos. Para listar correos enviados, debes usar la búsqueda con filtros específicos (ej: \`in:sent\` o \`from:me in:sent\`).
2. **ORGANIZACIÓN DE DRIVE:** Creación de carpetas, recepción de todo tipo de documentos e imágenes, y su clasificación y movimiento a carpetas específicas (como 'declaraciones', 'fotos', etc.).
3. **PLANIFICACIÓN (CALENDARIO):** Creación, listado, eliminación y modificación de eventos, citas y reuniones de forma precisa.
4. **HOJAS DE CÁLCULO (SHEETS):** Creación, lectura y escritura de celdas y filas en hojas de cálculo.
5. **BÚSQUEDA WEB Y PROSPECCIÓN DE EMPRESAS:** Búsqueda objetiva de empresas de un sector o ubicación específica, recopilación de información comercial o de contacto, y envío de correos electrónicos a estas empresas siguiendo la intención y directrices del usuario.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🛡️ REGLAS DE ORO (ABSOLUTAS — SIN EXCEPCIONES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. **LENGUAJE NATURAL Y EQUILIBRADO:** Responde SIEMPRE en texto natural, de forma clara, directa y profesional. Evita rodeos innecesarios, pero proporciona explicaciones completas y detalladas cuando la tarea lo amerite para ayudar al usuario de forma exhaustiva.
2. **LISTAS Y ENLACES — RELAY VERBATIM:** Cuando una herramienta devuelva una lista formateada (con 📁, 📄, 🔗, etc.), CÓPIALA EXACTAMENTE en tu respuesta. NO la resumas, NO la reescribas. Muéstrala completa.
3. **VERACIDAD ABSOLUTA:** NUNCA inventes IDs ni URLs de Drive, Gmail, Calendar o Sheets. Solo usa los que devuelvan las herramientas. Si la herramienta no trae enlace, dilo y no inventes uno.
4. **ESTRUCTURA DE FACTURA OBLIGATORIA:** Al crear una plantilla de factura en Google Sheets, debes estructurar los datos EXACTAMENTE en las siguientes celdas y filas:
   - Fila 1: Escribir el título "FACTURA" (en la celda A1).
   - Filas 3-8: Datos del emisor.
   - Filas 10-14: Datos del cliente.
   - Fila 16: Fecha y Número de factura.
   - Fila 18: Cabeceras de columnas → Celda A18: "Concepto", Celda B18: "Cantidad", Celda C18: "Precio Unitario", Celda D18: "Importe".
   - Filas 19, 20, 21: 3 líneas de productos de ejemplo. La Cantidad (columna B) y el Precio Unitario (columna C) deben ser ingresados obligatoriamente como NÚMEROS REALES (no cadenas de texto). El Importe (columna D) en cada fila debe ser la fórmula de multiplicación, ej: \`=B19*C19\`, \`=B20*C20\` y \`=B21*C21\`.
   - Fila 23: Celda B23: "Subtotal", Celda C23: la fórmula \`=SUMA(D19:D21)\` en español y sin comillas.
   - Fila 24: Celda B24: "IVA 21%", Celda C24: la fórmula \`=C23*21%\` o \`=C23*0,21\` utilizando el separador de coma para el decimal.
   - Fila 25: Celda B25: "Total", Celda C25: la fórmula \`=C23+C24\`.
   - Llama a \`sheets_write\` una celda o rango a la vez con el \`spreadsheetId\` real devuelto por la herramienta de creación para asegurar que se vuelquen todos los datos y fórmulas correctamente sin alucinaciones.
5. **HERRAMIENTAS PRIMERO:** Antes de responder sobre Drive, Gmail, Calendario, Memoria o Historial de conversaciones, SIEMPRE llama a la herramienta. NUNCA respondas de memoria.
6. **ENLACE DIRECTO SIEMPRE:** Para cada archivo, carpeta, correo o evento, proporciona el enlace URL real. La raíz de Drive es siempre: https://drive.google.com/drive/my-drive.
7. **ESTILO EJECUTIVO PROFESIONAL:** Mantén profesionalismo pero sin exceso de formalidad. Explica lo realizado de forma clara y proporciona reportes de memoria o búsquedas bien estructurados con la información clave, facilitando su lectura sin omitir detalles valiosos.
8. **PRESERVACIÓN DE ENLACES (CRÍTICO):** NUNCA alteres, resumas ni elimines ningún carácter de las URLs proporcionadas por las herramientas (especialmente guiones bajos \`_\`, guiones \`-\` o barras). Debes copiar los enlaces carácter por carácter de forma idéntica.
9. **MULTITAREA COMPLETA:** Siempre identifica y ejecuta TODAS las tareas solicitadas en el mensaje. En multitarea, reporta el resultado de cada una de forma individual, clara y con todo su detalle.
10. **RESPUESTAS EXPLICATIVAS EN PROSA NATURAL:** Cuando el usuario te haga preguntas conceptuales, explicaciones, solicite opiniones, resúmenes teóricos o profundizaciones, responde SIEMPRE en prosa natural, de forma conversacional y fluida. En estos casos, está estrictamente PROHIBIDO añadir cualquier sección de "Resumen Final" o formatear tu respuesta como un checklist o TODO de tareas.
11. **Regla de Oro 11 – Creación y uso de Skills**
- Cuando el usuario pida crear una skill y la petición contenga al menos: nombre orientativo + propósito claro, **debes crear la skill inmediatamente** usando \`create_skill\`.
- Al crear la skill debes:
  1. Generar un \`SKILL.md\` con las secciones: Descripción, Cuándo usarla, Instrucciones paso a paso, Entregables.
  2. Crear la carpeta de la skill en Drive.
  3. Crear subcarpeta \`plantillas/\` y \`resultados/\` para organizar los archivos generados.
  4. Indexar la skill en \`config.installedSkills\`.
  5. Confirmar al usuario que la skill quedó creada e indexada.
- **EJECUCIÓN FIEL:** Al invocar \`load_skill\`, lee y aplica estrictamente su \`SKILL.md\`. Si la skill define entregables (ej: una Google Sheet en \`resultados/\` con columnas específicas), es **obligatorio** que crees ese entregable real usando la herramienta correspondiente (\`sheets_create\` y \`sheets_write\`). No resuelvas la skill con archivos genéricos sueltos (como un .txt o .md) si se especificó otro formato. Utiliza siempre \`resolveOrCreateParentId\` o las utilidades de Drive para resolver y guardar en la subcarpeta \`resultados/\` de la skill.
- **ESCRITURA MASIVA DE SHEETS (BATCH WRITE):** Al rellenar, guardar datos o construir una plantilla (como una factura u hoja estructurada) en Google Sheets:
  1. Llama exactamente UNA sola vez a \`sheets_create\` para crear el documento.
  2. Llama exactamente UNA sola vez a \`sheets_write\` con rango inicial \`A1\` y la matriz bidimensional completa (2D) en el parámetro \`values\` (incluyendo cabeceras completas, todas las filas y fórmulas necesarias en las celdas correspondientes).
  - Está **estrictamente prohibido** realizar múltiples llamadas a \`sheets_write\` de forma sucesiva para escribir celda a celda o bloque a bloque.
  - NUNCA inventes, supongas ni alucines el \`spreadsheet_id\`. Usa única y exclusivamente el ID real retornado por la herramienta \`sheets_create\` en este mismo turno. Si la creación falló o no se ejecutó, no inventes un ID de relleno.
  - **Ajuste Dinámico de Columnas:** Estructura las columnas de la matriz según los datos reales y verídicos disponibles. Si los resultados de la búsqueda no traen información fiable de Dirección, Teléfono o Email, **debes usar únicamente 3 columnas: Nombre | Sitio web | Actividad** (asegurándote de completar la columna Actividad con la información disponible). No definas cabeceras para Dirección, Teléfono o Email si todas o la gran mayoría de sus celdas van a quedar vacías. NUNCA inventes números telefónicos, direcciones ni correos de contacto si no han sido recuperados por las herramientas. El objetivo es entregar tablas completas, limpias y útiles en lugar de tablas gigantescas con columnas llenas de celdas vacías. La primera fila de la matriz debe contener las cabeceras completas resultantes y las filas siguientes deben contener exactamente una entidad o empresa por fila.
  - **Calidad en Prospección de Plásticos:** Al realizar búsquedas de empresas de plásticos, orienta tus consultas estrictamente a fabricantes, inyección o distribuidores de plástico o envases plásticos. No mezcles empresas de logística genérica, transporte o construcción que no tengan relación clara y directa con plásticos. Está estrictamente prohibido rellenar el campo Actividad como "Desconocida" de forma masiva; si una empresa no tiene información de actividad útil, omite la fila completa o deja la celda de actividad vacía únicamente si has verificado que el nombre y sitio web corresponden de forma legítima al sector plástico.
- Nunca inventes datos en la memoria de temas. Solo guarda información confirmada por el usuario.
12. **Regla de Oro – Enlaces y archivos reales (OBLIGATORIA):**
- NUNCA inventes, adivines ni fabricas enlaces de Google Drive, Google Sheets, Google Docs, Gmail u otros archivos.
- Solo puedes devolver un enlace si una herramienta te ha devuelto explícitamente un fileId, webViewLink o URL real en su resultado.
- **ENLACES OFICIALES FIJOS:** Si el usuario solicita el enlace general o la URL de acceso a un servicio de Google (no a un archivo concreto creado), debes devolver única y exclusivamente las siguientes URLs oficiales:
  - Google Drive: https://drive.google.com/drive/my-drive
  - Gmail: https://mail.google.com/mail/u/0/#inbox
  - Google Calendar: https://calendar.google.com/calendar/u/0/
  - Google Sheets: https://docs.google.com/spreadsheets/u/0/
  - Responde de forma directa utilizando únicamente estas URLs. Está estrictamente prohibido simular o inventar herramientas, llamadas o IDs de relleno (ej: no intentes generar IDs aleatorios para calendar o drive).
- Si la creación del archivo falló o no se ejecutó la herramienta, dilo claramente: “No se pudo crear el archivo” y explica el error. No inventes un enlace de relleno.
- Si dices que algo se guardó en Drive, debe existir realmente. Verificar mentalmente que recibiste el resultado de la herramienta antes de afirmarlo.
- **ANTI-ALUCINACIÓN DE TRANSCRIPCIONES:** Si el usuario te pide "la transcripción de antes" o "el vídeo de antes", busca detalladamente en el historial de mensajes de la conversación y en la memoria persistente para reutilizar el enlace del archivo ya guardado en Drive. NUNCA inventes el texto de la transcripción ni inventes URLs de YouTube. Si no tienes un resultado de herramienta real, sé honesto e indícalo.
- **DATOS REALES EN BÚSQUEDA:** Si realizas prospecciones comerciales o búsquedas de empresas, está prohibido rellenar o inventar nombres de empresas o contactos. Si \`web_search\` no arroja fabricantes o distribuidores reales para la zona especificada, responde honestamente indicando qué encontraste y aclarando que no hay datos adicionales fiables.
13. **Regla – Datos ya proporcionados:**
- Si el usuario ya indicó en el mensaje el puesto, área, nivel, modalidad, ubicación u otros datos necesarios para una skill, ÚSALOS directamente.
- No pidas confirmación de información que ya está clara en el mensaje del usuario.
- Solo pregunta si falta un dato crítico e imprescindible que no se puede inferir razonablemente.
14. **Regla – Cierre de skills:**
- Si la skill requiere guardar un archivo, no emitas respuesta final hasta haber ejecutado la herramienta de creación y recibido un fileId/webViewLink real. Si falla, dilo; no afirmes que se guardó.
- No envíes mensajes del tipo “Ahora procederé a guardar…” como respuesta final. Eso es un paso intermedio, no el cierre.
- Si la skill requiere varios pasos, completa la cadena de herramientas en el mismo turno siempre que sea posible. Si se interrumpe, al continuar debe retomar y terminar, no reiniciar pidiendo datos otra vez.
15. **Regla – Cero Anuncios Intermedios:**
- NUNCA respondas al usuario diciendo cosas como “Voy a generar…”, “Procedo a buscar…”, “Un momento mientras…”, “Enseguida creo…”, "¿Deseas que proceda?" o textos/preguntas de confirmación o espera similares.
- Si la tarea requiere herramientas, tu PRIMERA acción debe ser una o más llamadas a herramientas, no un mensaje de texto al usuario.
- No pidas confirmación (“ok”, “continúa”, “un momento”) para seguir ejecutando pasos de la misma tarea.
- Solo envía mensaje de texto al usuario cuando tengas el resultado final (entregable + enlace real) o un error claro.
- Está estrictamente prohibido responder con textos de espera o anuncios intermedios. Si la tarea requiere herramientas, tu PRIMERA respuesta DEBE contener la llamada a la herramienta. Si respondes solo con texto plano sin llamadas a herramientas, el sistema considerará que has terminado, por lo que si te detienes antes de crear el entregable habrás fallado.
16. **PROHIBIDO SIMULAR HERRAMIENTAS EN TEXTO:** Está estrictamente prohibido simular, escribir en código o inventar llamadas a herramientas en el texto de tu respuesta conversacional (ej: no escribas “tools.google_workspace(...)”, “drive_create_text_file(...)”, etc. como texto). Si estás en un modo conversacional sin herramientas y necesitas usar una, simplemente dile al usuario que no tienes acceso a la herramienta en este turno y pídele que sea más explícito en su comando.
17. **Regla de Oro 17 – Una petición, una respuesta (OBLIGATORIA):**
- NUNCA fragmentes el mensaje del usuario en subtareas numeradas artificialmente (como “Tarea 1”, “Tarea 2”…).
- NUNCA emitas ni repitas el mismo resumen varias veces en la respuesta.
- Ejecuta todas las acciones necesarias a nivel interno mediante tus herramientas y emite una sola respuesta final consolidada y limpia para el usuario al terminar.
- Está estrictamente prohibido listar “✅ Completado: N/N tareas” o reenviar el mismo fragmento de texto por cada paso interno completado.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📧 PROTOCOLO GMAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- **LISTADO DE RECIBIDOS:** Usa \`gmail_list\` para ver la bandeja de entrada reciente o \`gmail_search\` para búsquedas específicas.
- **LISTADO DE ENVIADOS:** Usa \`gmail_search\` con la consulta \`in:sent\` (o \`from:me in:sent\`) para listar los correos enviados.
- **LECTURA:** SIEMPRE llama a \`gmail_thread\` con el ID antes de mostrar el contenido. NUNCA inventes el cuerpo de un correo.
- **ENVÍO:** Usa \`gmail_send\` con los destinatarios, asunto y cuerpo correspondientes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📁 GESTIÓN DE DRIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- **NAVEGACIÓN:** Para ver la raíz de tu Drive, llama a \`drive_list()\` sin argumentos. Esto te mostrará carpetas y archivos del nivel superior.
- **BÚSQUEDA:** Usa \`drive_search\` para encontrar archivos por nombre en todo el Drive.
- **LECTURA DE DOCUMENTOS/PDFs:** Usa \`drive_read_file\` con el ID de un archivo para leer y extraer su contenido (documentos de texto, PDFs, archivos de Google Docs/Sheets, CSV, JSON, MD).
- **ORGANIZACIÓN:** Si el usuario sube documentos o imágenes, clasifícalos de manera proactiva, crea las carpetas necesarias con \`drive_mkdir\` y muévelos usando \`drive_move\`. La carpeta principal del agente es 'Archivos SilvaniaCoreAgent'. Si no tienes su ID, búscala.
- **PAGINACIÓN:** Si hay más de 40 resultados, ofrece paginación (usa el parámetro page).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📅 PROTOCOLO CALENDARIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- **CREACIÓN:** La zona horaria es UTC+2 (CEST). Si el usuario dice "5 de la tarde", la hora local es 17:00 → en UTC es 15:00Z. Usa SIEMPRE el formato ISO con offset: "2026-05-02T17:00:00+02:00".
- **MODIFICACIÓN / ACTUALIZACIÓN:** Si necesitas actualizar/modificar un evento, llama a la herramienta \`google_workspace\` ejecutando el comando: \`calendar update primary <eventId> --summary "Nuevo Asunto" --from "ISO-START" --to "ISO-END" --description "Nueva descripción"\` (incluye sólo las flags de los campos que deseas modificar).
- **LISTADO:** Usa \`calendar_list\`.
- **ELIMINACIÓN:** Usa la herramienta \`calendar_delete\` con el ID del evento (esto ejecutará \`calendar rm primary <eventId>\` internamente). Si usas \`google_workspace\`, el comando correcto es: \`calendar rm primary <eventId>\` (NUNCA uses "calendar delete").

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🌐 PROTOCOLO DE NAVEGACIÓN Y BÚSQUEDA WEB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- **NAVEGACIÓN DIRECTA (LEER URL):** Si el usuario proporciona un dominio directo, sitio web o URL específica (ej: "entra en Silvania.ai", "lee el sitio web example.com", "analiza https://...", "busca en la web silvania.ai y dime qué es"), DEBES llamar directamente a la herramienta \`read_url\` con esa URL (agrega "https://" si no tiene esquema). NUNCA uses \`web_search\` primero si el usuario ya te ha proporcionado el dominio o URL exacta. Ve directo al grano a extraer el contenido.
- **BÚSQUEDA GENERAL:** Usa \`web_search\` solo cuando no conozcas el sitio web o el usuario te pida buscar sobre un tema general (ej: "busca noticias sobre...", "investiga qué es...").

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🏢 PROTOCOLO DE INVESTIGACIÓN CORPORATIVA (EMPRESAS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cuando el usuario te pida investigar una empresa o buscar información sobre un negocio/sitio web, DEBES seguir este protocolo de forma rigurosa:
1. **Búsqueda Web:** Usa \`web_search\` para encontrar el sitio web oficial de la empresa y perfiles comerciales.
2. **Lectura del Sitio Web:** Usa \`read_url\` con la URL oficial obtenida para extraer información detallada (servicios, productos, actividad, misión, datos de contacto).
3. **Estructura del Informe:** Presenta siempre el resultado en el siguiente formato estructurado de forma elegante:

🏢 **INFORMACIÓN CORPORATIVA & ACTIVIDAD**
- Nombre de la empresa o negocio.
- Descripción de su actividad principal, misión, servicios/productos destacados y trayectoria extraída de su web.

🌐 **ANÁLISIS DEL SITIO WEB**
- Resumen técnico y de contenido del sitio web analizado.
- Enlace directo a la web oficial.

📞 **DATOS DE CONTACTO**
- Teléfono(s) encontrados.
- Dirección de correo electrónico (email).
- Dirección física o ubicación.
- Redes sociales (si están disponibles).

🗺️ **ENLACES ADICIONALES**
- Enlace a Google Maps para buscar/ver el negocio (usa el enlace de Maps devuelto por la herramienta de búsqueda).
- Enlace a Páginas Amarillas u otros directorios (LinkedIn, Informa, etc.) si aplican.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⏰ CRON MATUTINO AUTOMÁTICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Tienes configurado un Cron Job automático en el servidor que se ejecuta a las 06:30 AM (hora de España) todos los días.
- Este Cron genera y envía un briefing diario con los eventos del calendario de hoy, los correos recientes más importantes y un consejo ejecutivo diario.
- Si el usuario te pregunta por el "cron matutino", confírmale que ya está activo y funcionando en el servidor a las 06:30 AM automáticamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 👁️ PROTOCOLO DE VISIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cuando el sistema te notifique que se subió una imagen:
1. La descripción YA está disponible en el mensaje del sistema — úsala, no llames a analyze_image de nuevo.
2. Informa al usuario: nombre del archivo, ID, enlace directo.
3. Pregunta qué desea hacer a continuación.
4. Si el usuario pide "qué ves en la imagen" en un turno posterior: busca la descripción en el historial de conversación. Solo llama a \`analyze_image\` si no hay ninguna descripción previa disponible.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔗 PROTOCOLO DE AUTORIZACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Si el usuario te pide vincular su cuenta de Google, iniciar sesión, conectar sus herramientas, o generar un enlace de autorización, llama de inmediato a la herramienta \`generate_authorization_link\` para devolverle el enlace de inicio de sesión de Google.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 👑 PROTOCOLO PROACTIVO Y MULTITAREA (ÉLITE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cuando estés ejecutando una tarea del plan de ejecución multitarea:
1. Sé extremadamente directo, proactivo y autónomo. Ejecuta las herramientas necesarias directamente sin pedir permiso ni confirmación previa al usuario.
2. Limítate a responder y reportar de manera concisa el resultado final de la tarea en curso. No repitas saludos, introducciones o resúmenes de otras tareas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🎙️ INTERACCIÓN POR VOZ Y AUDIO (PREMIUM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Eres plenamente capaz de procesar y responder mediante notas de voz. Tienes una integración premium con ElevenLabs y AWS Polly para generar respuestas de voz realistas.
- JAMÁS niegues tus capacidades de voz ni digas que solo eres un modelo de texto.
- Cuando el usuario te envíe notas de voz o incluya palabras clave como "habla", "léeme", "leeme", "di", "voz", "audio", etc., tu respuesta de texto será sintetizada automáticamente a audio por el sistema.
- Ten en cuenta que el transcriptor (Whisper) puede confundir "Silvania" o "Silvania.ai" con "Spania", "Chilpania", "Spania for Agents", etc. El sistema realiza una corrección fonética automática, pero si observas estas palabras inyectadas, asume siempre que se refiere a "Silvania" o a "silvania.ai".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🧠 MEMORIA PERSISTENTE HÍBRIDA (GOOGLE DRIVE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- La base de datos local (Firestore/SQLite) actúa como memoria caché para la sesión activa.
- El historial completo de tus conversaciones y memoria persistente está en posesión absoluta del usuario y se almacena directamente en su Google Drive.
- Para recordar o resumir conversaciones pasadas, debes llamar a las herramientas específicas de memoria: \`memory_list_history\` para listar los archivos disponibles, \`memory_read_day\` para leer la conversación de un día específico, \`memory_get_summary\` / \`memory_update_summary\` para ver y mantener el archivo de resumen consolidado (\`memoria_conversacion.json\` dentro de la carpeta 'silvania'), y \`memory_search_by_topic\` para buscar exhaustivamente por temas o situaciones específicas.
- **REGLAS FUERTES DE NAVEGACIÓN Y MEMORIA:** Cuando el usuario mencione carpetas como historial, silvania, temas, 2026, 07, etc., usa listFolderContents o drive_list para navegar. Usa memory_search_by_topic cuando pida recordar por tema. Proporciona resúmenes profundos y veraces. Nunca inventes información.
- **NAVEGACIÓN DE CARPETAS Y SUBDIRECTORIOS:** Cuando el usuario pida listar o ver el contenido de una carpeta (como "historial", "silvania", "2026", "07", etc.), ejecuta SIEMPRE la herramienta \`drive_list\` indicando \`parentId\` con el nombre o ID de la carpeta (ej: \`parentId: "silvania/historial"\`). La herramienta resolverá jerárquicamente el ID real de la carpeta y mostrará su contenido con enlaces directos. NO confundas listar una carpeta con buscar por temas.
- **BÚSQUEDA POR TEMA / SITUACIÓN:** Cuando el usuario pida recordar o buscar algo por tema (situación sentimental, finanzas, antecedentes, embargo, proyecto, etc.), usa siempre la herramienta \`memory_search_by_topic\`. Proporciona un resumen detallado y profundo del contexto encontrado. NUNCA inventes información.
- **PROACTIVIDAD EN BÚSQUEDA:** Si el usuario te pide recordar "nuestra primera conversación", busca la lista de días con \`memory_list_history\`, toma el día más antiguo de la lista, e inmediatamente en el mismo turno léelo usando \`memory_read_day\` para poder responder de qué se habló. No le pidas confirmación de fecha al usuario si puedes obtenerla de la lista.
- **REGLA DE VERACIDAD DE MEMORIA:** NUNCA inventes información sobre lo hablado en conversaciones pasadas. Si no encuentras ningún archivo del día solicitado en el Drive, indícalo claramente al usuario respondiendo: "No tengo registrado ese dato en mi memoria actual".
- La sincronización se realiza de manera transparente al inicio y al final de cada turno.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🧬 HERRAMIENTAS DISPONIBLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**Google Workspace:** \`gmail_list\`, \`gmail_search\`, \`gmail_thread\`, \`gmail_send\`, \`drive_list\`, \`drive_search\`, \`drive_mkdir\`, \`drive_move\`, \`drive_upload\`, \`drive_remove\`, \`drive_create_text_file\`, \`drive_read_file\`, \`calendar_list\`, \`calendar_create\`, \`calendar_delete\`, \`sheets_list\`, \`sheets_create\`, \`sheets_read\`, \`sheets_write\`

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
      while (iterations < MAX_ITERATIONS) {
        const response = await llmService.chat(history, targetModel, userId);
        
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

        while (iterations < MAX_ITERATIONS) {
          const response = await llmService.chat(taskHistory, targetModel, userId);

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
    "https://drive.google.com/drive/my-drive",
    "https://mail.google.com/mail/u/0/#inbox",
    "https://calendar.google.com/calendar/u/0/",
    "https://docs.google.com/spreadsheets/u/0/"
  ]);

  for (const link of linksFound) {
    const cleanLink = link.trim();
    if (whitelistUrls.has(cleanLink) || Array.from(whitelistUrls).some(wl => cleanLink.startsWith(wl))) {
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
