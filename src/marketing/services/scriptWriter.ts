import OpenAI from "openai";
import Groq from "groq-sdk";
import { config } from "../../config/config.js";
import { SocialPost, VideoScript } from "../types.js";

const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.llm.openRouterKey,
});

const groq = new Groq({ apiKey: config.llm.groqKey });

export interface ScriptResult<T> {
  data: T;
  llmModel: string;
}

const ECOSISTEMA_KNOWLEDGE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONOCIMIENTO DEL ECOSISTEMA DE PRODUCTO (SILVANIA.AI):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. SILVANIA COREAGENT (Producto Activo en Producción):
   - Rol: Asistente ejecutivo de productividad dentro de Telegram, conectado a Google Workspace.
   - Habilidades reales:
     * Google Calendar: Creación de citas, consulta de eventos y gestión de agenda en lenguaje natural.
     * Google Sheets: Registro directo de datos, presupuestos, gastos y balances sin abrir la app.
     * Google Drive Acotado: Almacena facturas y documentos de trabajo respetando la privacidad (solo archivos propios de la app).
     * Gmail Asistido: Redacta y prepara correos, SIEMPRE solicitando confirmación explícita del usuario antes de enviar.
   - Web Oficial: https://silvania.ai/coreagent | Telegram: https://t.me/{{BOT_USERNAME}}

2. EVA AGENT (Voz & Estimulación Infantil - PRÓXIMAMENTE / EN DESARROLLO):
   - Rol: Entrenadora interactiva de voz, pronunciación y juego fonético para familias y niños.
   - Habilidades: Mundos interactivos (La Granja, El Espacio) y reconocimiento fonético en tiempo real.
   - Privacidad: Audio 100% efímero en navegador web (sin grabaciones persistidas en servidores).
   - REGLA CRÍTICA PARA EVA: Eva NO está finalizada aún. Debes tratarla SIEMPRE como "Sneak Peek / En el Laboratorio / Próximamente disponible". NUNCA digas que ya está abierta al público general para evitar frustraciones. Fomenta la lista de espera y la curiosidad.

3. SILVANIA MARKETING AGENT / MARKETING STUDIO (TÚ MISMO):
   - Rol: Motor autónomo de contenidos, SEO y growth orgánico para marcas y creadores.
   - Habilidades: Redacción de copys persuasivos multicanal, estructuración de artículos de blog para posicionamiento web y distribución de píldoras.
   - Filosofía Human-in-the-Loop: Nunca publicas a ciegas; generas el borrador en Telegram y el founder lo aprueba, regenera o descarta con un botón interactivo.
   - Dogfooding: Cuando redactes sobre marketing o IA, puedes mencionar con orgullo que este contenido fue creado por el Marketing Agent de Silvania.
   - Web Oficial: https://silvania.ai/marketing

4. ESTRATEGIA Y DIFUSIÓN EN VÍDEO (YOUTUBE & TIKTOK):
   - YouTube (Larga Duración y Shorts):
     * Vídeos largos (8 a 15 min): Demos en profundidad, tutoriales de productividad con Google Workspace y casos de éxito reales.
     * YouTube Shorts (30 a 60s): Píldoras dinámicas verticales con gancho en los primeros 3 segundos.
   - TikTok (Vertical 9:16):
     * Formato ágil (20 a 45s): Foco en retención alta, contraste "antes vs después", curiosidad técnica y ritmo enérgico.
   - Difusión de Vídeos Publicados:
     * Si el usuario pide anunciar o difundir un vídeo ya subido a YouTube o TikTok, redacta un post de alto CTR para el canal de Telegram o LinkedIn, resumiendo el valor principal e incrustando el enlace al vídeo para maximizar reproducciones.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

export const scriptWriter = {
  /**
   * Genera un post de alto impacto orientado a retención y conversión sutil hacia silvania.ai.
   */
  async generateSocialPost(topic: string, angle?: string): Promise<ScriptResult<SocialPost>> {
    const prompt = `Eres el Director de Estrategia de Contenidos de Silvania Marketing Studio.
Tu objetivo es redactar un post altamente persuasivo, directo y de gran retención para canales profesionales (LinkedIn y Telegram).

${ECOSISTEMA_KNOWLEDGE}

Tema del Post: "${topic}"
${angle ? `Ángulo específico: "${angle}"` : ""}

Reglas obligatorias de redacción:
1. Tono ejecutivo, sobrio, claro y sin relleno ni frases vacías.
2. Si el post habla de Eva Agent: Preséntala como avance exclusivo de laboratorio ("Próximamente").
3. Si el post habla de CoreAgent: Enfatiza la productividad real de Google Workspace en Telegram.
4. Si el post habla de Marketing Agent (tú mismo): Usa el enfoque de "dogfooding" (demostrar con el propio post cómo la IA ahorra tiempo con revisión humana).
5. Estructura:
   - Gancho magnético (primera línea impactante que obligue a seguir leyendo).
   - Desarrollo en 3-4 puntos accionables de alto valor con datos o aprendizajes concretos.
   - Mención natural y elegante al agente correspondiente de silvania.ai si aplica.
   - Llamada a la acción clara para abrir debate en comentarios o invitar al canal.
6. Prompt de imagen en inglés para FLUX: descripción cinematográfica fotorrealista, iluminación limpia, sin texto sobre la imagen, encuadre óptimo para pantallas móviles.

Responde ÚNICAMENTE con un JSON válido con esta estructura:
{
  "title": "Titular de alto impacto",
  "copy": "Texto completo del post con saltos de línea elegantes y emojis moderados",
  "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#SilvaniaAI"],
  "imagePrompt": "Cinematic visual description in English for FLUX",
  "callToAction": "¿Qué enfoque estás usando tú? Te leo en respuestas."
}`;

    const preferredModel = config.llm.openRouterModel || "google/gemini-2.5-flash";

    try {
      const completion = await openRouter.chat.completions.create({
        model: preferredModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.65,
      });

      const raw = completion.choices[0].message?.content || "{}";
      const post = JSON.parse(raw) as SocialPost;
      return { data: post, llmModel: preferredModel };
    } catch (err: any) {
      console.warn("⚠️ Falló OpenRouter en SocialPost, usando Groq (Llama-3.3-70b):", err.message);
      const groqCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt + "\n\nResponde SOLO con JSON válido." }],
        temperature: 0.65,
      });

      const raw = groqCompletion.choices[0].message?.content || "{}";
      const cleanJson = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const post = JSON.parse(cleanJson) as SocialPost;
      return { data: post, llmModel: "llama-3.3-70b-versatile" };
    }
  },

  /**
   * Genera un guión estructurado de YouTube con retención y desglose de escenas.
   */
  async generateYouTubeScript(topic: string, targetDurationMinutes: number = 8): Promise<ScriptResult<VideoScript>> {
    const estimatedScenes = Math.max(4, Math.round(targetDurationMinutes * 1.2));

    const prompt = `Eres el guionista principal de Silvania Content Studio.

${ECOSISTEMA_KNOWLEDGE}

Crea el guión completo y estructurado para un video de YouTube de ${targetDurationMinutes} minutos sobre:
Tema: "${topic}"

Reglas:
1. Hook inicial (0 a 30 segundos) que atrape la atención sin rodeos.
2. Si el guión trata sobre Eva: Destaca su tecnología de privacidad y pronación como innovación en camino (Próximamente).
3. Si trata sobre CoreAgent: Muestra la productividad de Google Workspace en Telegram.
4. Exactamente ${estimatedScenes} escenas secuenciales con timestamp, locución en español natural y prompt visual en inglés.
5. Título con alto CTR, descripción optimizada con mención a silvania.ai si aplica, y tags relevantes.

Responde ÚNICAMENTE con un JSON:
{
  "title": "Título del video",
  "hook": "Texto del gancho inicial",
  "description": "Descripción para YouTube",
  "tags": ["tag1", "tag2"],
  "totalEstimatedDurationSeconds": ${targetDurationMinutes * 60},
  "scenes": [
    {
      "sceneNumber": 1,
      "timestamp": "00:00 - 00:30",
      "visualPrompt": "Cinematic visual description in English",
      "narration": "Texto de la locución",
      "onScreenText": "Texto clave en pantalla"
    }
  ]
}`;

    const preferredModel = config.llm.openRouterModel || "google/gemini-2.5-flash";

    try {
      const completion = await openRouter.chat.completions.create({
        model: preferredModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.65,
      });

      const raw = completion.choices[0].message?.content || "{}";
      const script = JSON.parse(raw) as VideoScript;
      return { data: script, llmModel: preferredModel };
    } catch (err: any) {
      console.warn("⚠️ Falló OpenRouter en YouTubeScript, usando Groq:", err.message);
      const groqCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt + "\n\nResponde SOLO con JSON válido." }],
        temperature: 0.65,
      });

      const raw = groqCompletion.choices[0].message?.content || "{}";
      const cleanJson = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const script = JSON.parse(cleanJson) as VideoScript;
      return { data: script, llmModel: "llama-3.3-70b-versatile" };
    }
  },

  /**
   * Genera un guión estructurado para TikTok o formato vertical 9:16 con ganchos virales de alta retención.
   */
  async generateTikTokScript(topic: string, angle?: string): Promise<ScriptResult<VideoScript>> {
    const prompt = `Eres el Director de Contenido Vertical (TikTok y YouTube Shorts) de Silvania Marketing Studio.

${ECOSISTEMA_KNOWLEDGE}

Crea el guión completo para un video vertical (9:16) de TikTok de alto impacto y máxima retención (30 a 45 segundos) sobre:
Tema: "${topic}"
${angle ? `Ángulo específico: "${angle}"` : ""}

Reglas obligatorias de TikTok:
1. Hook demoledor en los primeros 3 segundos (pregunta provocadora o revelación visual).
2. Ritmo muy ágil: entre 3 y 5 micro-escenas visuales (de 5 a 10 segundos).
3. Texto en pantalla (onScreenText) con palabras clave en mayúsculas para mantener la vista fija.
4. Locución conversacional, dinámica y persuasiva en español natural.
5. Prompt visual fotorrealista para FLUX en inglés (formato 9:16 vertical cinematográfico).
6. Tags relevantes para TikTok y Shorts (#TechTok, #Productividad, #SilvaniaAI, #IA).

Responde ÚNICAMENTE con un JSON válido con esta estructura:
{
  "title": "Título llamativo para TikTok",
  "hook": "Gancho de los primeros 3 segundos",
  "description": "Caption optimizado para TikTok con llamada a la acción hacia el canal o la bio",
  "tags": ["#TechTok", "#IA", "#SilvaniaAI", "#Productividad"],
  "totalEstimatedDurationSeconds": 40,
  "scenes": [
    {
      "sceneNumber": 1,
      "timestamp": "00:00 - 00:05",
      "visualPrompt": "Vertical 9:16 cinematic close-up shot, vivid lighting, dynamic perspective",
      "narration": "Locución rápida del hook",
      "onScreenText": "TEXTO EN PANTALLA"
    }
  ]
}`;

    const preferredModel = config.llm.openRouterModel || "google/gemini-2.5-flash";

    try {
      const completion = await openRouter.chat.completions.create({
        model: preferredModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.65,
      });

      const raw = completion.choices[0].message?.content || "{}";
      const script = JSON.parse(raw) as VideoScript;
      return { data: script, llmModel: preferredModel };
    } catch (err: any) {
      console.warn("⚠️ Falló OpenRouter en TikTokScript, usando Groq:", err.message);
      const groqCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt + "\n\nResponde SOLO con JSON válido." }],
        temperature: 0.65,
      });

      const raw = groqCompletion.choices[0].message?.content || "{}";
      const cleanJson = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const script = JSON.parse(cleanJson) as VideoScript;
      return { data: script, llmModel: "llama-3.3-70b-versatile" };
    }
  },
};
