import Groq from "groq-sdk";
import OpenAI from "openai";
import fs from "fs";
import { config } from "../config/config.js";

const groq = new Groq({ apiKey: config.llm.groqKey });
const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.llm.openRouterKey,
});

export const llmService = {
  async transcribe(filePath: string) {
    try {
      const translation = await groq.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-large-v3",
      });
      return translation.text;
    } catch (error) {
      console.error("Error transcribiendo audio:", error);
      return "No pude entender el mensaje de voz.";
    }
  },

  async analyzeImage(messages: any[], imagePath: string) {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString("base64");
      
      const ext = imagePath.split('.').pop()?.toLowerCase();
      let mimeType = "image/jpeg";
      if (ext === "png") mimeType = "image/png";
      else if (ext === "webp") mimeType = "image/webp";
      else if (ext === "gif") mimeType = "image/gif";

      console.log(`🤖 Analizando imagen con Vision (${mimeType})...`);
      const response = await openRouter.chat.completions.create({
        messages: [
          ...messages,
          {
            role: "user",
            content: [
              { type: "text", text: "¿Qué ves en esta imagen? Describe el contenido de forma detallada para poder generar un nombre de archivo profesional y descriptivo." },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          } as any,
        ],
        model: "google/gemini-2.5-flash",
      });
      return response.choices[0].message;
    } catch (error: any) {
      console.warn("⚠️ Vision con OpenRouter falló:", error.message);
      try {
        const ext = imagePath.split('.').pop()?.toLowerCase();
        let mimeType = "image/jpeg";
        if (ext === "png") mimeType = "image/png";
        else if (ext === "webp") mimeType = "image/webp";
        else if (ext === "gif") mimeType = "image/gif";

        // Fallback a Groq Llama-3.2 Vision si está disponible o simplemente una descripción genérica
        const response = await groq.chat.completions.create({
          messages: [
            ...messages,
            {
              role: "user",
              content: [
                { type: "text", text: "Describe esta imagen brevemente." },
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${fs.readFileSync(imagePath).toString("base64")}` }
                } as any
              ],
            } as any
          ],
          model: "llama-3.2-11b-vision-preview",
        });
        return response.choices[0].message;
      } catch (fallbackError) {
        console.error("❌ Todos los modelos de visión fallaron");
        return { role: "assistant", content: "Lo siento, no puedo ver la imagen ahora mismo." };
      }
    }
  },

  async chat(messages: any[], model?: string, userId?: number) {
    const targetModel = model || "google/gemini-2.5-flash";
    const adminId = config.telegram.allowedUsers[0] || 1572946817;
    const isAdmin = userId === adminId;
    const tools: any[] = [
      {
        type: "function",
        function: {
          name: "get_current_time",
          description: "Obtiene la fecha y hora actual",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "web_search",
          description: "Busca información en internet (general, noticias o locales). Devuelve enlaces directos.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "La consulta de búsqueda" },
              search_type: { type: "string", enum: ["web", "news", "local"], description: "Tipo de búsqueda" },
              max_results: { type: "number", description: "Número de resultados (1-10)" }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "read_url",
          description: "Lee el contenido de una página web a partir de su URL",
          parameters: {
            type: "object",
            properties: {
              url: { type: "string", description: "URL de la página" }
            },
            required: ["url"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "youtube_get_transcript",
          description: "Obtiene la transcripción (subtítulos) de un video de YouTube dada su URL o ID del video.",
          parameters: {
            type: "object",
            properties: {
              url: { type: "string", description: "URL completa del video de YouTube o ID del video (ej: https://www.youtube.com/watch?v=dQw4w9WgXcQ o dQw4w9WgXcQ)" }
            },
            required: ["url"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "youtube_search",
          description: "Busca videos en YouTube por palabra clave o nombre de canal, devolviendo títulos, duraciones, y enlaces directos.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Términos de búsqueda para encontrar los videos relevantes en YouTube (ej: 'alejavi rivera', 'antigravity artificial intelligence')" },
              max_results: { type: "number", description: "Número de resultados de video a devolver (1-10)" }
            },
            required: ["query"]
          }
        }
      },

  {
    type: "function",
    function: {
      name: "google_workspace",
      description: "Ejecuta comandos directos del CLI 'gog' para Google Workspace (drive, gmail, calendar, sheets).",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Comando gog (ej: 'drive ls', 'gmail list')" }
        },
        required: ["command"]
      }
    }
  },
  // ─── GMAIL ───
      {
        type: "function",
        function: {
          name: "gmail_list",
          description: "Lista los correos más recientes en la bandeja de entrada.",
          parameters: {
            type: "object",
            properties: {
              max_results: { type: "number", description: "Máximo correos a mostrar (default 10)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "gmail_search",
          description: "Busca correos en Gmail usando filtros (ej: 'from:google', 'subject:factura').",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Consulta de búsqueda de Gmail" },
              max_results: { type: "number", description: "Máximo correos a mostrar" }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "gmail_thread",
          description: "Obtiene el contenido completo de un hilo o correo de Gmail por su ID.",
          parameters: {
            type: "object",
            properties: {
              thread_id: { type: "string", description: "ID del hilo/mensaje" }
            },
            required: ["thread_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "gmail_send",
          description: "Envía un correo electrónico.",
          parameters: {
            type: "object",
            properties: {
              to: { type: "string", description: "Email del destinatario" },
              subject: { type: "string", description: "Asunto" },
              body: { type: "string", description: "Cuerpo del mensaje" }
            },
            required: ["to", "subject", "body"]
          }
        }
      },
      // ─── DRIVE ───
      {
        type: "function",
        function: {
          name: "drive_list",
          description: "Lista archivos y carpetas de Google Drive. Usa all=true para ver TODO el Drive. Soporta paginación.",
          parameters: {
            type: "object",
            properties: {
              parent_id: { type: "string", description: "ID de la carpeta padre (opcional)" },
              all: { type: "boolean", description: "Si es true, lista todo el Drive." },
              page: { type: "number", description: "Número de página (0-indexed) para listados largos." }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "drive_search",
          description: "Busca archivos en Drive por nombre o metadatos. Soporta paginación.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Nombre del archivo o consulta de búsqueda" },
              page: { type: "number", description: "Número de página (0-indexed) para listados largos." }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "drive_mkdir",
          description: "Crea una nueva carpeta en Drive. Evita duplicados automáticamente.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nombre de la carpeta" },
              parent_id: { type: 'string', description: 'ID de la carpeta padre (opcional)' }
            },
            required: ["name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "drive_move",
          description: "Mueve un archivo o carpeta a una nueva ubicación.",
          parameters: {
            type: "object",
            properties: {
              file_id: { type: "string", description: "ID del archivo a mover" },
              parent_id: { type: "string", description: "ID de la carpeta destino" }
            },
            required: ["file_id", "parent_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "drive_upload",
          description: "Sube un archivo local a Google Drive.",
          parameters: {
            type: "object",
            properties: {
              file_path: { type: "string", description: "Ruta local del archivo" },
              parent_id: { type: "string", description: "ID de la carpeta destino (opcional)" },
              name: { type: "string", description: "Nombre del archivo en Drive (opcional)" }
            },
            required: ["file_path"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "drive_remove",
          description: "Elimina un archivo o carpeta de Drive permanentemente.",
          parameters: {
            type: "object",
            properties: {
              file_id: { type: "string", description: "ID del archivo/carpeta a eliminar" }
            },
            required: ["file_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "drive_create_text_file",
          description: "Crea un archivo de texto (.txt) en Google Drive con el contenido especificado. Úsa para guardar notas, descripciones, registros o cualquier texto en Drive.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nombre del archivo (ej: 'descripcion_imagen.txt')" },
              content: { type: "string", description: "Contenido del archivo de texto" },
              parent_id: { type: "string", description: "ID de la carpeta destino (opcional)" }
            },
            required: ["name", "content"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "drive_read_file",
          description: "Lee y extrae el contenido de un archivo de Google Drive (ej: PDF, documentos de Google, TXT, CSV, JSON, MD) dado su ID.",
          parameters: {
            type: "object",
            properties: {
              file_id: { type: "string", description: "El ID del archivo de Google Drive que se desea leer" }
            },
            required: ["file_id"]
          }
        }
      },
      // ─── CALENDAR ───
      {
        type: "function",
        function: {
          name: "calendar_list",
          description: "Lista los eventos del calendario.",
          parameters: {
            type: "object",
            properties: {
              days_ahead: { type: "number", description: "Días a mostrar (default 7)" },
              start_date: { type: "string", description: "Fecha inicio (ISO format, ej: 2024-05-01)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "calendar_create",
          description: "Crea un nuevo evento en el calendario.",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "Título del evento" },
              start: { type: "string", description: "Inicio (ISO, ej: 2024-05-01T10:00:00Z)" },
              end: { type: "string", description: "Fin (ISO, ej: 2024-05-01T11:00:00Z)" },
              description: { type: "string", description: "Descripción opcional" }
            },
            required: ["summary", "start", "end"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "calendar_delete",
          description: "Elimina un evento del calendario.",
          parameters: {
            type: "object",
            properties: {
              event_id: { type: "string", description: "ID del evento" }
            },
            required: ["event_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "calendar_update",
          description: "Actualiza un evento existente en el calendario.",
          parameters: {
            type: "object",
            properties: {
              event_id: { type: "string", description: "ID del evento a actualizar" },
              summary: { type: "string", description: "Nuevo título del evento (opcional)" },
              start: { type: "string", description: "Nuevo inicio (ISO, ej: 2024-05-01T10:00:00Z, opcional)" },
              end: { type: "string", description: "Nuevo fin (ISO, ej: 2024-05-01T11:00:00Z, opcional)" },
              description: { type: "string", description: "Nueva descripción (opcional)" }
            },
            required: ["event_id"]
          }
        }
      },
      // ─── SHEETS ───
      {
        type: "function",
        function: {
          name: "sheets_list",
          description: "Lista las hojas de cálculo recientes en Drive.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "sheets_create",
          description: "Crea una nueva hoja de cálculo.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Título de la hoja" }
            },
            required: ["title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "sheets_read",
          description: "Lee datos de una hoja de cálculo.",
          parameters: {
            type: "object",
            properties: {
              spreadsheet_id: { type: "string", description: "ID de la hoja" },
              range: { type: "string", description: "Rango (ej: 'Hoja1!A1:B10')" }
            },
            required: ["spreadsheet_id", "range"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "sheets_write",
          description: "Escribe datos en una hoja de cálculo. Los valores deben ser una cadena formateada como CSV.",
          parameters: {
            type: "object",
            properties: {
              spreadsheet_id: { type: "string", description: "ID de la hoja" },
              range: { type: "string", description: "Rango (ej: 'Hoja1!A1')" },
              values: { type: "string", description: "Valores en formato CSV (ej: 'Col1,Col2\nVal1,Val2')" }
            },
            required: ["spreadsheet_id", "range", "values"]
          }
        }
      },
      // ─── SKILLS ───
      {
        type: "function",
        function: {
          name: "search_skills",
          description: "Busca habilidades (skills) para el agente en el catálogo local y global.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Palabra clave para buscar habilidades" },
              limit: { type: "number", description: "Máximo de resultados" }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_skill",
          description: "Obtiene los detalles y archivos de una habilidad específica por su ID.",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string", description: "ID de la habilidad" }
            },
            required: ["id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "install_skill",
          description: "Instala una habilidad en el sistema del agente para que pueda usarla.",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string", description: "ID de la habilidad a instalar" }
            },
            required: ["id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_skill",
          description: "Crea una nueva skill en Drive (carpeta + SKILL.md). Usa esta herramienta cuando el usuario pida crear una skill y la petición sea suficientemente clara. Debes generar un SKILL.md completo con valores por defecto razonables a partir de la descripción del usuario. NO pidas confirmación ni detalles adicionales a menos que la petición sea demasiado vaga (ej: solo 'crea una skill').",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nombre técnico de la skill en kebab-case (ej: 'rrhh-perfil-contratacion')" },
              description: { type: "string", description: "Descripción corta del propósito de la habilidad" },
              instructions: { type: "string", description: "(Opcional) Instrucciones adicionales. Si no se proporcionan, genera unas buenas por defecto." }
            },
            required: ["name", "description"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "load_skill",
          description: "Carga el contenido de las instrucciones (SKILL.md) de una habilidad específica instalada.",
          parameters: {
            type: "object",
            properties: {
              skillName: { type: "string", description: "Nombre o ID de la habilidad a cargar" }
            },
            required: ["skillName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "load_skills",
          description: "Carga todas las habilidades instaladas en el contexto del agente para conocer sus capacidades actuales.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "analyze_image",
          description: "Analiza una imagen guardada en Google Drive usando visión artificial.",
          parameters: {
            type: "object",
            properties: {
              file_id: { type: "string", description: "ID del archivo en Google Drive" },
              prompt: { type: "string", description: "Pregunta específica sobre la imagen (opcional)" }
            },
            required: ["file_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "analyze_document",
          description: "Analiza el contenido de un documento (PDF, CSV, JSON, MD, TXT) en Google Drive usando capacidades avanzadas de lectura y comprensión de documentos.",
          parameters: {
            type: "object",
            properties: {
              file_id: { type: "string", description: "ID del archivo de documento en Google Drive" },
              prompt: { type: "string", description: "Pregunta específica, resumen o instrucciones de análisis para el documento (opcional)" }
            },
            required: ["file_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_authorization_link",
          description: "Genera el enlace de autorización de Google para que el usuario vincule su cuenta.",
          parameters: { type: "object", properties: {} }
        }
      },
      // ─── MEMORIA E HISTORIAL ───
      {
        type: "function",
        function: {
          name: "memory_get_summary",
          description: "Obtiene el resumen consolidado y los puntos clave de las conversaciones anteriores guardadas en Drive.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "memory_update_summary",
          description: "Actualiza el resumen y los puntos clave de la memoria persistente en Google Drive.",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "Nuevo resumen consolidado de las conversaciones" },
              keyPoints: { type: "array", items: { type: "string" }, description: "Lista de puntos clave o datos importantes (opcional)" }
            },
            required: ["summary"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "memory_list_history",
          description: "Lista todos los días de conversaciones guardados en el historial de Google Drive (silvania/historial/...).",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "memory_read_day",
          description: "Lee y devuelve el historial de mensajes de un día específico guardado en Drive.",
          parameters: {
            type: "object",
            properties: {
              year: { type: "string", description: "Año de la conversación (ej: '2026')" },
              month: { type: "string", description: "Mes de la conversación (ej: '07')" },
              day: { type: "string", description: "Día de la conversación (ej: '19')" }
            },
            required: ["year", "month", "day"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "memory_search_by_topic",
          description: "Busca exhaustivamente en la memoria persistente e historial de conversaciones por un tema, situación o palabra clave específica (ej: 'situación sentimental', 'finanzas', 'embargo', 'proyecto Silvania').",
          parameters: {
            type: "object",
            properties: {
              topic: { type: "string", description: "Tema, situación o palabras clave a buscar en el historial de memoria." }
            },
            required: ["topic"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "memory_save_topic",
          description: "Guarda o actualiza un archivo de tema específico en la carpeta silvania/temas/ (ej: 'familia', 'proyectos', 'finanzas'). Úsala para estructurar y persistir información clave sobre un tema específico.",
          parameters: {
            type: "object",
            properties: {
              topicName: { type: "string", description: "Nombre del tema (ej: 'familia', 'proyectos', 'finanzas')" },
              content: { type: "string", description: "Contenido detallado en formato JSON estructurado o texto para guardar sobre el tema." }
            },
            required: ["topicName", "content"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "memory_get_diagnostics",
          description: "Obtiene un reporte detallado del estado y organización de la memoria del usuario, incluyendo los archivos reales en silvania/temas/ y el estado de memoria_conversacion.json.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "memory_list_folder",
          description: "Lista el contenido de cualquier carpeta de Google Drive (como 'historial', 'silvania', '2026', '07', etc.) resolviendo su nombre a su ID real de Drive.",
          parameters: {
            type: "object",
            properties: {
              folderNameOrId: { type: "string", description: "Nombre o ID de la carpeta a listar (ej: 'historial', 'silvania', '2026', '07')." }
            },
            required: ["folderNameOrId"]
          }
        }
      }

    ];

    if (isAdmin) {
      tools.push({
        type: "function",
        function: {
          name: "execute_command",
          description: "Ejecuta un comando en la terminal del sistema. Úsalo con precaución.",
          parameters: {
            type: "object",
            properties: {
              command: { type: "string", description: "El comando a ejecutar" }
            },
            required: ["command"]
          }
        }
      });
    }

    try {
      console.log(`🤖 [LLM] Usando OpenRouter (${targetModel})...`);
      const response = await openRouter.chat.completions.create({
        messages,
        model: targetModel,
        temperature: 0.5,
        tools,
      });
      return response.choices[0].message;
    } catch (error: any) {
      console.warn("⚠️ OpenRouter falló:", error.message);
      try {
        const cleanMessages = messages.map(m => {
          if (typeof m === "object" && m !== null) {
            const copy = { ...m };
            delete (copy as any).refusal;
            if (copy.role === "tool" && typeof copy.content === "string" && copy.content.length > 2500) {
              copy.content = copy.content.substring(0, 2500) + "\n...[contenido truncado para optimizar tokens]";
            }
            return copy;
          }
          return m;
        });

        // Garantizar que la llamada a Groq no supere los 12k tokens (System Message + últimos 8 mensajes)
        let groqMessages = cleanMessages;
        if (cleanMessages.length > 10) {
          const sys = cleanMessages[0]?.role === "system" ? [cleanMessages[0]] : [];
          const tail = cleanMessages.slice(-8);
          groqMessages = [...sys, ...tail];
        }

        const response = await groq.chat.completions.create({
          messages: groqMessages as any,
          model: "llama-3.3-70b-versatile",
          temperature: 0.5,
          tools,
        });
        const msg = response.choices[0].message;
        delete (msg as any).refusal;
        return msg;
      } catch (fallbackError: any) {
        console.error("❌ Modelos fallaron:", fallbackError.message);
        throw fallbackError;
      }
    }
  },

  async chatWithoutTools(messages: any[], model?: string): Promise<string> {
    const targetModel = model || "google/gemini-2.5-flash";
    try {
      console.log(`🤖 [LLM] Chat sin herramientas usando OpenRouter (${targetModel})...`);
      const response = await openRouter.chat.completions.create({
        messages,
        model: targetModel,
        temperature: 0.3,
      });
      return response.choices[0].message.content || "";
    } catch (error: any) {
      console.warn("⚠️ OpenRouter chat sin herramientas falló:", error.message);
      try {
        const response = await groq.chat.completions.create({
          messages,
          model: "llama-3.3-70b-versatile",
          temperature: 0.3,
        });
        return response.choices[0].message.content || "";
      } catch (fallbackError: any) {
        console.error("❌ Ambos modelos fallaron en chat sin herramientas:", fallbackError.message);
        throw fallbackError;
      }
    }
  }
};
