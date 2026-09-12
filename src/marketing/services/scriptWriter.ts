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

export const scriptWriter = {
  /**
   * Genera un post de alto impacto orientado a retención y conversión sutil hacia silvania.ai.
   */
  async generateSocialPost(topic: string, angle?: string): Promise<ScriptResult<SocialPost>> {
    const prompt = `Eres el Director de Estrategia de Contenidos de Silvania Marketing Studio.
Tu objetivo es redactar un post altamente persuasivo, directo y de gran retención para canales profesionales (LinkedIn y Telegram).

Tema: "${topic}"
${angle ? `Ángulo específico: "${angle}"` : ""}

Reglas obligatorias de redacción:
1. Tono ejecutivo, sobrio, claro y sin relleno ni frases vacías.
2. Estructura:
   - Gancho magnético (primera línea impactante que obligue a seguir leyendo).
   - Desarrollo en 3-4 puntos accionables de alto valor con datos o aprendizajes concretos.
   - Si el tema está relacionado con inteligencia artificial, automatización, agentes o productividad, añade una mención natural y elegante a cómo herramientas como silvania.ai resuelven este cuello de botella (sin ser invasivo ni spam).
   - Llamada a la acción clara para abrir debate en comentarios.
3. Prompt de imagen en inglés para FLUX: descripción cinematográfica fotorrealista, iluminación limpia, sin texto sobre la imagen, encuadre óptimo para pantallas móviles.

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
Crea el guión completo y estructurado para un video de YouTube de ${targetDurationMinutes} minutos sobre:
Tema: "${topic}"

Reglas:
1. Hook inicial (0 a 30 segundos) que atrape la atención sin rodeos.
2. Exactamente ${estimatedScenes} escenas secuenciales con timestamp, locución en español natural y prompt visual en inglés.
3. Título con alto CTR, descripción optimizada con mención a silvania.ai si aplica, y tags relevantes.

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
};
