import OpenAI from "openai";
import Groq from "groq-sdk";
import { config } from "../../config/config.js";
import { SocialPost, VideoScript, SocialPlatform } from "../types.js";

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
   * Adaptado a la red de destino (LinkedIn, X/Twitter, Telegram o genérico).
   */
  async generateSocialPost(
    topic: string,
    angle?: string,
    platform: SocialPlatform = "generic"
  ): Promise<ScriptResult<SocialPost>> {
    let platformInstructions = "";
    if (platform === "linkedin") {
      platformInstructions = `
PLATAFORMA OBJETIVO: LINKEDIN (B2B & LIDERAZGO EJECUTIVO)
- Tono: Profesional, reflexivo, de liderazgo tecnológico y productividad empresarial.
- Formato: Estructura de storytelling con saltos de línea limpios, párrafos cortos (1 a 2 oraciones), 3 o 4 aprendizajes o puntos clave con viñetas.
- Cierre: Pregunta abierta que invite a debate técnico o empresarial en comentarios.
- Hashtags: 3 a 5 hashtags profesionales (ej: #Productividad #InteligenciaArtificial #Liderazgo #GoogleWorkspace #SilvaniaAI).
- Longitud del copy: 150 a 250 palabras ricas en sustancia.`;
    } else if (platform === "x") {
      platformInstructions = `
PLATAFORMA OBJETIVO: X / TWITTER (MÁXIMA CURIOSIDAD & SÍNTESIS VIRAL)
- Tono: Directo, intrigante, con gancho contracíclico o dato sorprendente.
- REGLA CRÍTICA DE LONGITUD: El campo "copy" debe tener MENOS DE 260 CARACTERES para entrar holgadamente en el límite de un solo tweet sin cortarse.
- Cierre: Llamada a la acción muy concisa ("¿Lo sabías?", "Pruébalo aquí 👇").
- Hashtags: Máximo 2 o 3 hashtags breves (#IA #Tech #SilvaniaAI).`;
    } else if (platform === "telegram") {
      platformInstructions = `
PLATAFORMA OBJETIVO: CANAL DE TELEGRAM (DIGEST ÁGIL & COMUNIDAD)
- Tono: Cercano, directo, formato resumen ejecutivo para lectura en móvil en 20 segundos.
- Formato: Titular con emoji llamativo, resumen del valor en 3 viñetas concisas con emojis, enlace o invitación clara.
- Cierre: Botón / llamada clara a probar el bot o ver el vídeo extendido.
- Longitud: 80 a 140 palabras muy escaneables visualmente.`;
    } else {
      platformInstructions = `
PLATAFORMA OBJETIVO: MULTIRED PROFESIONAL
- Tono: Ejecutivo, sobrio, claro y de alta retención.
- Desarrollo en 3-4 puntos accionables de alto valor.`;
    }

    const prompt = `Eres el Director de Estrategia de Contenidos de Silvania Marketing Studio.
Tu objetivo es redactar un post altamente persuasivo, directo y de gran retención.

${ECOSISTEMA_KNOWLEDGE}

Tema del Post: "${topic}"
${angle ? `Ángulo específico: "${angle}"` : ""}
${platformInstructions}

Reglas obligatorias de redacción:
1. Tono ejecutivo, sobrio, claro y sin relleno ni frases vacías.
2. Si el post habla de Eva Agent: Preséntala SIEMPRE en estado 'Próximamente / En el laboratorio'. NUNCA vendas acceso público directo aún; destaca la estimulación fonética interactiva y la privacidad 100% local en navegador.
3. Si el post habla de CoreAgent: Enfatiza la productividad real de Google Workspace en Telegram con scopes mínimos y privacidad. Disponible ya en Acceso Anticipado (https://silvania.ai/coreagent).
4. Si el post habla de Marketing Studio / Marketing Agent: Preséntalo SIEMPRE en estado 'Próximamente / Fase interna' (no vender acceso público directo todavía). Usa el enfoque de 'dogfooding' y supervisión obligatoria Human-in-the-Loop donde el founder aprueba cada borrador.
5. Prompt de imagen en inglés para FLUX: descripción cinematográfica fotorrealista, iluminación limpia, sin texto sobre la imagen, encuadre óptimo para pantallas móviles.

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
      post.platform = platform;
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
      post.platform = platform;
      return { data: post, llmModel: "llama-3.3-70b-versatile" };
    }
  },

  /**
   * Genera un guión estructurado de YouTube con retención y desglose de escenas.
   * Admite hasta 30 escenas si se solicitan explícitamente y garantiza duración real >= 2 minutos por defecto.
   */
  async generateYouTubeScript(topic: string, targetDurationMinutes: number = 2): Promise<ScriptResult<VideoScript>> {
    const isShortTest = /3\s*escena|corto|short|prueba|test|60s/i.test(topic);

    // Detección de petición explícita de escenas (ej: "30 escenas", "20 imágenes", "15 fotos")
    const explicitScenesMatch = topic.match(/(?:(\d+))\s*(?:escenas?|im[aá]genes?|fotos?)/i);
    const requestedScenes = explicitScenesMatch ? parseInt(explicitScenesMatch[1], 10) : null;

    let targetScenes: number;
    let wordsPerScene: string;
    let durationSeconds: number;

    if (requestedScenes && requestedScenes > 0) {
      // En YouTube se admite capacidad extendida de hasta 30 escenas
      targetScenes = Math.min(30, Math.max(1, requestedScenes));
      if (targetScenes <= 6) {
        wordsPerScene = "55 a 70 palabras de locución fluida y reflexiva con pausas (garantizar > 2 minutos de duración total)";
        durationSeconds = Math.max(120, targetScenes * 25);
      } else {
        wordsPerScene = "25 a 35 palabras por escena con ritmo ágil";
        durationSeconds = targetScenes * 16;
      }
    } else if (isShortTest) {
      targetScenes = 3;
      wordsPerScene = "25 a 30 palabras por escena";
      durationSeconds = 60;
    } else {
      // Por defecto para YouTube Horizontal (16:9): duración mínima de 2 a 3 minutos (120 - 180s)
      targetScenes = Math.min(8, Math.max(5, Math.round(targetDurationMinutes * 2.5)));
      wordsPerScene = "55 a 70 palabras de locución fluida, profunda y reflexiva con pausas fonéticas naturales (crucial para alcanzar mínimo 2 minutos de duración)";
      durationSeconds = Math.max(130, targetScenes * 24);
    }

    // Detección automática del género narrativo
    const t = topic.toLowerCase();
    let genreName = "PRODUCTIVIDAD & ECOSISTEMA SILVANIA";
    let toneInstruction = "Tono ejecutivo, directo, ágil y persuasivo.";
    let visualPromptGuide = "Cinematic 8k photography, modern architectural lighting, clean minimal aesthetics, no text";
    let onScreenExample = "TITULARES ACCIONABLES EN MAYÚSCULAS (ej: 'TU AGENDA EN TELEGRAM')";
    let hookInstruction = "Hook inicial (10 a 15s) de alto impacto que contraste un problema con una solución ágil.";

    if (/cuento|f[aá]bula|fantas[ií]a|pixar|disney|m[aá]gic|drag[oó]n|hadas|castillo|princesa|hab[ií]a una vez|infantil.*historia|historia.*niñ/i.test(t)) {
      genreName = "CUENTO INFANTIL & FANTASÍA (Estilo Pixar 3D)";
      toneInstruction = "Tono de NARRADOR DE CUENTOS INFANTILES: cálido, mágico, tierno, pausado. Narra con asombro y emoción una hermosa historia con personajes entrañables, un viaje o aventura y un final feliz o enseñanza hermosa. ¡CERO LENGUAJE DE OFICINA, NEGOCIOS O TELEGRAM!";
      visualPromptGuide = "Pixar 3D animated style, Disney Pixar quality render, warm soft volumetric lighting, whimsical magical atmosphere, cute expressive characters, vibrant rich colors, cinematic composition, 8k, no text";
      onScreenExample = "Títulos de capítulos del cuento o frases mágicas (ej: 'EL BOSQUE DE LAS ESTRELLAS', 'EL PEQUEÑO DRAGÓN')";
      hookInstruction = "Comienza con una introducción cautivadora que atrape la imaginación infantil ('Había una vez en...', o 'En un rincón mágico del bosque...').";
    } else if (/alien|extraterrestre|planeta|universo|cosmos|galaxia|nebulosa|astronom|marte|j[uú]piter|saturno|luna|agujero negro/i.test(t)) {
      genreName = "COSMOS, UNIVERSO & ASTRONOMÍA";
      toneInstruction = "Tono ÉPICO, SOBRECOGEDOR Y FASCIANTE de divulgación astronómica. Transmite la inmensidad del espacio, el misterio de mundos lejanos y la búsqueda de vida en el cosmos.";
      visualPromptGuide = "Cinematic space photography, James Webb telescope view, deep cosmos, glowing nebulae, majestic planetary rings, alien exoplanet horizon, photorealistic 8k, sci-fi grandeur, no text";
      onScreenExample = "Conceptos del cosmos (ej: 'EL CONFÍN DE LA GALAXIA', 'MUNDOS INEXPLORADOS')";
      hookInstruction = "Plantea un misterio fascinante sobre la inmensidad del universo o la existencia de otros mundos.";
    } else if (/biblia|b[ií]blic|cristian|dios|jes[uú]s|cristo|fe\b|evangelio|religi[oó]n|sagrad|vers[ií]culo|mois[eé]s|israel|oraci[oó]n/i.test(t)) {
      genreName = "RELATOS BÍBLICOS, FE & ESPIRITUALIDAD";
      toneInstruction = "Tono SOLEMNE, ESPIRITUAL, ESPERANZADOR Y PROFUNDAMENTE RESPETUOSO. Comparte la historia o reflexión bíblica conectando con el corazón, la esperanza y la paz interior.";
      visualPromptGuide = "Cinematic biblical epic scene, golden celestial ray of light breaking through dramatic clouds over ancient desert landscape, sacred stones, ancient scriptures, Rembrandt lighting, 8k photorealistic, no text";
      onScreenExample = "Frases de fe e inspiración (ej: 'LA PROMESA ETERNA', 'LA FE QUE MUEVE MONTAÑAS')";
      hookInstruction = "Inicia con una reflexión profunda sobre la fe y el propósito en la vida.";
    } else if (/holograma|pantalla.*3d|cu[aá]ntic|matrix|cibern[eé]tic|robot|futuro.*205|futurista|inteligencia artificial.*futuro/i.test(t)) {
      genreName = "CIENCIA & TECNOLOGÍA DEL FUTURO (Hologramas 3D)";
      toneInstruction = "Tono VANGUARDISTA, ELECTRIZANTE Y VISIONARIO. Explica innovaciones futuristas, interfaces holográficas y computación avanzada con asombro.";
      visualPromptGuide = "Futuristic technology, translucent 3D holographic computer interface glowing with cyan and purple light, AI neural network matrix, sleek sci-fi minimalism, cinematic 8k, no text";
      onScreenExample = "Conceptos de innovación (ej: 'HOLOGRAMAS EN 3D', 'LA NUEVA ERA CUÁNTICA')";
      hookInstruction = "Sorprende con una visión del futuro que transformará nuestra realidad.";
    } else if (/tormenta|rayo|rel[aá]mpago|aurora.*boreal|volc[aá]n|oc[eé]ano|monta[ñn]a|clima|paisaje|naturaleza|glaciar/i.test(t)) {
      genreName = "NATURALEZA, PAISAJES & CLIMAS EXTREMOS";
      toneInstruction = "Tono DOCUMENTAL DE NATURALEZA (estilo National Geographic / BBC Earth): majestuoso, poético, inmersivo.";
      visualPromptGuide = "National Geographic cinematic landscape photography, dramatic lightning storm, glowing green aurora borealis reflecting on water, majestic natural beauty, 8k, ultra-detailed, no text";
      onScreenExample = "Fenómenos de la Tierra (ej: 'EL BAILE DE LAS AURORAS', 'EL PODER DEL OCÉANO')";
      hookInstruction = "Describe con intensidad la majestuosidad indomable de la naturaleza.";
    }

    const prompt = `Eres el guionista y narrador principal de Silvania Studios.
Tu género objetivo para esta pieza es: ${genreName}.

Tema Solicitado: "${topic}"

Instrucciones de Voz y Tono para este género:
- ${toneInstruction}
- Redacta para ser HABLADO en voz alta por el oído humano, no leído.
- Frases cortas y ágiles (8 a 14 palabras máx por oración) con pausas fonéticas naturales (puntos y seguido frecuentes, puntos suspensivos...).
- ${hookInstruction}
- EXACTAMENTE ${targetScenes} escenas secuenciales (array "scenes").
- Cada escena debe tener:
  * "narration": locución fluida de ${wordsPerScene}.
  * "onScreenText": texto clave de 3 a 6 palabras en mayúsculas (${onScreenExample}).
  * "visualPrompt": descripción fotográfica en inglés optimizada (${visualPromptGuide}).

Responde ÚNICAMENTE con un JSON:
{
  "title": "Título del video",
  "hook": "Texto del gancho o inicio",
  "description": "Descripción optimizada para YouTube",
  "tags": ["tag1", "tag2"],
  "totalEstimatedDurationSeconds": ${durationSeconds},
  "scenes": [
    {
      "sceneNumber": 1,
      "timestamp": "00:00 - 00:20",
      "visualPrompt": "${visualPromptGuide}",
      "narration": "Texto de la locución",
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
      if (script.scenes && script.scenes.length > targetScenes) {
        script.scenes = script.scenes.slice(0, targetScenes);
      }
      script.totalEstimatedDurationSeconds = durationSeconds;
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
      if (script.scenes && script.scenes.length > targetScenes) {
        script.scenes = script.scenes.slice(0, targetScenes);
      }
      script.totalEstimatedDurationSeconds = durationSeconds;
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
2. Ritmo muy ágil: EXACTAMENTE entre 3 y 4 micro-escenas visuales (de 6 a 10 segundos cada una).
   REGLA DE CONDENSACIÓN: Si el tema menciona muchas escenas (por ejemplo 10, 20 o 30 escenas), NUNCA intentes meterlas aquí. En TikTok el usuario busca inmediatez; extrae ÚNICAMENTE los 3 o 4 momentos cumbre de mayor gancho emocional o viral.
3. Texto en pantalla (onScreenText) con palabras clave en mayúsculas para mantener la vista fija.
4. Locución conversacional, dinámica y persuasiva en español natural (15 a 25 palabras por escena).
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
      "timestamp": "00:00 - 00:08",
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
      if (script.scenes && script.scenes.length > 4) {
        script.scenes = script.scenes.slice(0, 4);
      }
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
      if (script.scenes && script.scenes.length > 4) {
        script.scenes = script.scenes.slice(0, 4);
      }
      return { data: script, llmModel: "llama-3.3-70b-versatile" };
    }
  },
};
