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
   - Rol: Asistente ejecutivo de productividad dentro de Telegram, conectado a Google Workspace e investigación web.
   - Habilidades reales:
     * Prospección Web Autónoma: Busca negocios reales en internet, entra en sus webs y extrae teléfonos, emails, WhatsApp, direcciones y redes sociales verificados.
     * Google Sheets Estructurado: Crea tablas CRM, balances, facturas y presupuestos profesionales en lote (batch) con fórmulas reales dinámicas y diseño corporativo, y los modifica in-place.
     * Google Calendar: Creación de citas, consulta de eventos y gestión de agenda en lenguaje natural.
     * Google Drive Acotado: Almacena facturas, presupuestos y tablas de trabajo en la carpeta canónica silvania/.
     * Gmail Asistido: Redacta y prepara correos, SIEMPRE solicitando confirmación explícita del usuario antes de enviar.
   - Web Oficial: https://silvania.ai/coreagent | Telegram: https://t.me/{{BOT_USERNAME}}

2. EVA AGENT (Voz & Estimulación Infantil - PRÓXIMAMENTE / EN DESARROLLO):
   - Rol: Entrenadora interactiva de voz, pronunciación y juego fonético para familias y niños.
   - Habilidades: Mundos interactivos (La Granja, El Espacio) y reconocimiento fonético en tiempo real.
   - Privacidad: Audio 100% efímero en navegador web (sin grabaciones persistidas en servidores).
   - REGLA CRÍTICA PARA EVA: Eva NO está finalizada aún. Debes tratarla SIEMPRE como "Sneak Peek / En el Laboratorio / Próximamente disponible". NUNCA digas que ya está abierta al público general para evitar frustraciones. Fomenta la curiosidad y cierra promoviendo usar HOY **Silvania CoreAgent** (ya activo en producción).

3. SILVANIA MARKETING AGENT / MARKETING STUDIO (PRÓXIMAMENTE / FASE INTERNA - TÚ MISMO):
   - Rol: Motor autónomo de contenidos, SEO y growth orgánico para marcas y creadores.
   - Habilidades: Redacción de copys persuasivos multicanal, estructuración de artículos de blog para posicionamiento web y distribución de píldoras.
   - Filosofía Human-in-the-Loop: Nunca publicas a ciegas; generas el borrador en Telegram y el founder lo aprueba, regenera o descarta con un botón interactivo.
   - Dogfooding: Cuando redactes sobre marketing o IA, puedes mencionar con orgullo que este contenido fue creado por el Marketing Agent de Silvania (próximamente), y cierra invitando a usar HOY **Silvania CoreAgent**, que ya está activo en producción en https://silvania.ai.
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

function isPureStorytellingTopic(topic: string): boolean {
  const t = (topic || "").toLowerCase();
  const hasAdIntent = /\b(publicidad|anuncio|comercial|vende|promocion\w*|coreagent|setter|eva|campa[ñn]a|suscripci[oó]n|workspace)\b/i.test(t);
  if (hasAdIntent) return false;
  return /\b(narra\w*|narraci[oó]n|historia|relato|cuento|f[aá]bula|documental|biograf[ií]a|liderazgo|filosof[ií]a|psicolog[ií]a|reflexi[oó]n|motivaci[oó]n|leyenda|misterio|cosmos|universo|naturaleza|biblia|despertar|amanecer|estado\s+de\s+[aá]nimo|emoci[oó]n\w*|sentimiento\w*|mentalidad|h[aá]bito\w*|disciplina|superaci[oó]n|riqueza|millonario\w*|fortuna|inversi[oó]n|bienestar|meditaci[oó]n|calma|felicidad)\b/i.test(t);
}

export const scriptWriter = {
  /**
   * Genera un post de alto impacto orientado a retención y conversión sutil hacia silvania.ai.
   * Adaptado a la red de destino (LinkedIn, X/Twitter, Telegram o genérico).
   */
  async generateSocialPost(
    topic: string,
    angle?: string,
    platform: SocialPlatform = "generic",
    brandRules?: string
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
${brandRules ? `\nREGLAS Y MARCA DEL USUARIO (DRIVE):\n${brandRules}\n` : ""}
${platformInstructions}

Reglas obligatorias de redacción:
1. Tono ejecutivo, sobrio, claro y sin relleno ni frases vacías.
2. Si el post habla de Eva Agent: Preséntala SIEMPRE en estado 'Próximamente / En el laboratorio'. NUNCA vendas acceso público directo aún; destaca la estimulación fonética interactiva y la privacidad 100% local en navegador.
3. Si el post habla de CoreAgent: Enfatiza la productividad real de Google Workspace en Telegram con scopes mínimos y privacidad. Disponible ya en Acceso Anticipado (https://silvania.ai/coreagent).
4. Si el post habla de Marketing Studio / Marketing Agent: Preséntalo SIEMPRE en estado 'Próximamente / Fase interna' (no vender acceso público directo todavía). Usa el enfoque de 'dogfooding' y supervisión obligatoria Human-in-the-Loop donde el founder aprueba cada borrador.
5. REGLA DE CIERRE PARA "PRÓXIMAMENTE": Siempre que el post trate sobre Eva Agent o Marketing Agent (productos próximamente), el cierre y el "callToAction" deben invitar explícitamente a probar HOY **Silvania CoreAgent** (ya activo en producción) en https://silvania.ai.
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
      post.platform = platform;
      post.copy = ensureOfficialLinks(post.copy || "", platform === "x");
      return { data: post, llmModel: preferredModel };
    } catch (err: any) {
      console.warn("⚠️ Falló OpenRouter en SocialPost, usando Groq fallback:", err.message);
      const groqModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
      for (const gm of groqModels) {
        try {
          const groqCompletion = await groq.chat.completions.create({
            model: gm,
            messages: [{ role: "user", content: prompt + "\n\nResponde SOLO con JSON válido." }],
            temperature: 0.65,
          });
          const raw = groqCompletion.choices[0].message?.content || "{}";
          const cleanJson = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
          const post = JSON.parse(cleanJson) as SocialPost;
          post.platform = platform;
          post.copy = ensureOfficialLinks(post.copy || "", platform === "x");
          return { data: post, llmModel: gm };
        } catch (groqErr: any) {
          console.warn(`⚠️ Groq (${gm}) falló en SocialPost:`, groqErr.message);
        }
      }

      // Edge copy mínimo determinista si OpenRouter (ej. 402 sin créditos) y Groq fallan
      const fallbackPost: SocialPost = {
        platform,
        title: topic.slice(0, 70),
        copy: ensureOfficialLinks(
          `🚀 ${topic}\n\nDescubre la Oficina Ejecutiva Inteligente de Silvania AI: multiplica tu capacidad de ejecución con agentes especializados.\n\n👉 https://silvania.ai`,
          platform === "x"
        ),
        hashtags: ["#SilvaniaAI", "#CoreAgent", "#ProductividadIA"],
        callToAction: "Descubre más en https://silvania.ai",
        imagePrompt: `Modern clean corporate workspace showing Silvania AI digital productivity, clean high contrast photography without any third-party logos`,
      };
      return { data: fallbackPost, llmModel: "edge-fallback-copy" };
    }
  },

  /**
   * Genera un guión estructurado de YouTube con retención y desglose de escenas.
   * Admite hasta 30 escenas si se solicitan explícitamente y garantiza duración real >= 2 minutos por defecto.
   */
  async generateYouTubeScript(topic: string, targetDurationMinutes: number = 2, brandRules?: string): Promise<ScriptResult<VideoScript>> {
    const isShortTest = /3\s*escena|corto|short|prueba|test|60s/i.test(topic);
    const isStory = isPureStorytellingTopic(topic);

    // Parsear duración explícita en minutos (ej: "5 min", "5 minutos", "10 min") si existe en el topic
    const durationMatch = topic.match(/(\d+(?:[.,]\d+)?)\s*(?:min(?:utos?)?|m\b)/i);
    const parsedMinutes = durationMatch ? parseFloat(durationMatch[1].replace(",", ".")) : null;
    const effectiveMinutes = parsedMinutes && parsedMinutes > 0
      ? Math.min(15, Math.max(1, parsedMinutes))
      : targetDurationMinutes;

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
        wordsPerScene = effectiveMinutes >= 4 ? "55 a 70 palabras por escena" : "25 a 35 palabras por escena con ritmo ágil";
        durationSeconds = Math.max(effectiveMinutes * 60, targetScenes * 16);
      }
    } else if (isShortTest) {
      targetScenes = 3;
      wordsPerScene = "25 a 30 palabras por escena";
      durationSeconds = 60;
    } else if (effectiveMinutes >= 3) {
      // Vídeos narrativos o largos (ej. 5 minutos = ~13 escenas de ~65 palabras -> ~850 palabras ≈ 5 min reales)
      targetScenes = Math.min(20, Math.max(8, Math.round(effectiveMinutes * 2.5)));
      wordsPerScene = `60 a 75 palabras de locución profunda, fluida y pausada por escena (IMPRESCINDIBLE mantener esta extensión en TODAS las ${targetScenes} escenas para alcanzar ${Math.round(effectiveMinutes)} minutos reales)`;
      durationSeconds = Math.round(effectiveMinutes * 60);
    } else {
      // Por defecto para YouTube Horizontal (16:9): duración mínima de 2 a 3 minutos (120 - 180s)
      targetScenes = Math.min(8, Math.max(5, Math.round(effectiveMinutes * 2.5)));
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
    } else if (isStory) {
      genreName = "NARRATIVA HUMANA, LIDERAZGO Y STORYTELLING PURO";
      toneInstruction = "Tono de NARRADOR DE DOCUMENTALES E HISTORIAS HUMANAS: profundo, cinematográfico, reflexivo y cálido. Construye un relato con planteamiento, conflicto real, aprendizaje y desenlace inspirador. ¡ESTRICTAMENTE PROHIBIDO mencionar apps, CoreAgent, Telegram, Google Workspace ni hacer publicidad comercial dentro de la historia!";
      visualPromptGuide = "Cinematic storytelling photography, dramatic warm lighting, emotional human expressions, contemplative scenes, inspiring atmosphere, 8k photorealistic film still, no text";
      onScreenExample = "Frases evocadoras de capítulos de la historia (ej: 'EL PESO DEL SILENCIO', 'CUANDO EL EJEMPLO HABLA', 'EL VERDADERO LEGADO')";
      hookInstruction = "Comienza con un relato vívido, una metáfora poderosa o una pregunta humana profunda que enganche desde el primer segundo sin sonar a anuncio.";
    }

    const closingCtaInstruction = isStory
      ? `- CIERRE NARRATIVO AUTÉNTICO (CERO PUBLICIDAD): La ÚLTIMA escena (escena ${targetScenes}) debe cerrar la historia o reflexión con una conclusión emotiva e inspiradora acorde al tema. PROHIBIDO vender software, mencionar CoreAgent, Telegram o pedir que usen silvania.ai dentro de la narración hablada (el logo de silvania.ai ya aparece visualmente).`
      : `- LLAMADA A LA ACCIÓN FINAL OBLIGATORIA: La ÚLTIMA escena (escena ${targetScenes}) debe cerrar SIEMPRE con una llamada a la acción clara, directa y persuasiva invitando a descubrir o probar Silvania en silvania.ai (tanto en "narration" como en "onScreenText", ej: "USA COREAGENT EN SILVANIA.AI"). Si el tema trata sobre un producto "Próximamente" (Eva Agent o Marketing Agent), el cierre DEBE promover empezar a usar HOY **Silvania CoreAgent** (ya activo en producción) en silvania.ai.`;

    const prompt = `Eres el guionista y narrador principal de Silvania Studios.
Tu género objetivo para esta pieza es: ${genreName}.

Tema Solicitado: "${topic}"
${brandRules && !isStory ? `\nREGLAS Y MARCA DEL USUARIO (DRIVE):\n${brandRules}\n` : ""}

Instrucciones de Voz y Tono para este género:
- ${toneInstruction}
- Redacta para ser HABLADO en voz alta por el oído humano, no leído.
- Frases cortas y ágiles (8 a 14 palabras máx por oración) con pausas fonéticas naturales (puntos y seguido frecuentes, puntos suspensivos...).
- ${hookInstruction}
- EXACTAMENTE ${targetScenes} escenas secuenciales (array "scenes").
${closingCtaInstruction}
- Cada escena debe tener:
  * "narration": locución fluida de ${wordsPerScene}.
  * "onScreenText": texto clave de 3 a 6 palabras en mayúsculas (${onScreenExample}).
  * "visualPrompt": descripción fotográfica CONCRETA Y ÚNICA para esa escena en inglés (${visualPromptGuide}), nombrando el lugar físico, momento del día y acción humana exacta que ilustra la locución (ej. si habla de despertar, describir persona despertando en la cama con luz matinal o amanecer dorado en la playa; si habla de tristeza, lluvia en ventana o persona cabizbaja; PROHIBIDO repetir descripciones genéricas idénticas entre escenas).
  * "visualMood": 2 a 4 palabras del estado de ánimo/emoción exacta de la escena en español e inglés (ej: "calma, esperanza, amanecer, serenity").
  * "visualConcepts": array de 4 a 7 sustantivos/acciones visuales concretas en español e inglés ligadas literalmente a esa escena (ej: ["despertar", "cama", "amanecer", "playa", "luz matinal", "sunrise", "bed"]).

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
      "visualMood": "emocion1, emocion2",
      "visualConcepts": ["concepto concreto 1", "concepto concreto 2", "mood"],
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
      return { data: ensureClosingCta(script, topic), llmModel: preferredModel };
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
      return { data: ensureClosingCta(script, topic), llmModel: "llama-3.3-70b-versatile" };
    }
  },

  /**
   * Genera un guión estructurado para TikTok o formato vertical 9:16 con ganchos virales de alta retención.
   */
  async generateTikTokScript(topic: string, angle?: string, brandRules?: string): Promise<ScriptResult<VideoScript>> {
    const prompt = `Eres el Director de Contenido Vertical (TikTok y YouTube Shorts) de Silvania Marketing Studio.

${ECOSISTEMA_KNOWLEDGE}

Crea el guión completo para un video vertical (9:16) de TikTok de alto impacto y máxima retención (30 a 45 segundos) sobre:
Tema: "${topic}"
${angle ? `Ángulo específico: "${angle}"` : ""}
${brandRules ? `\nREGLAS Y MARCA DEL USUARIO (DRIVE):\n${brandRules}\n` : ""}

Reglas obligatorias de TikTok:
1. Hook demoledor en los primeros 3 segundos (pregunta provocadora o revelación visual).
2. Ritmo muy ágil: EXACTAMENTE entre 3 y 4 micro-escenas visuales (de 6 a 10 segundos cada una).
   REGLA DE CONDENSACIÓN: Si el tema menciona muchas escenas (por ejemplo 10, 20 o 30 escenas), NUNCA intentes meterlas aquí. En TikTok el usuario busca inmediatez; extrae ÚNICAMENTE los 3 o 4 momentos cumbre de mayor gancho emocional o viral.
3. Texto en pantalla (onScreenText) con palabras clave en mayúsculas para mantener la vista fija.
4. Locución conversacional, dinámica y persuasiva en español natural (15 a 25 palabras por escena).
5. Prompt visual fotorrealista para FLUX en inglés (formato 9:16 vertical cinematográfico) describiendo literalmente la escena y estado de ánimo (no genérico).
6. Añade en cada escena "visualMood" (2-3 emociones ES/EN) y "visualConcepts" (4-6 palabras concretas visibles ES/EN para la memoria vectorial de imágenes).
7. Tags relevantes para TikTok y Shorts (#TechTok, #Productividad, #SilvaniaAI, #IA).
8. LLAMADA A LA ACCIÓN FINAL OBLIGATORIA: La última micro-escena debe cerrar SIEMPRE con una llamada a la acción directa en voz ("narration") y en pantalla ("onScreenText"), invitando a probarlo en silvania.ai (ej: "USA COREAGENT EN SILVANIA.AI"). Si el tema trata sobre un producto "Próximamente" (Eva Agent o Marketing Agent), el cierre DEBE promover usar HOY **Silvania CoreAgent** (ya activo) en silvania.ai.

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
      "visualPrompt": "Vertical 9:16 cinematic close-up shot depicting concrete action and mood",
      "visualMood": "emocion1, emocion2",
      "visualConcepts": ["concepto1", "concepto2", "concepto3"],
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
      return { data: ensureClosingCta(script, topic), llmModel: preferredModel };
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
      return { data: ensureClosingCta(script, topic), llmModel: "llama-3.3-70b-versatile" };
    }
  },

  /**
   * Genera un guión vertical de 30 segundos optimizado para Estados, Grupos y Canales de WhatsApp con CTA final.
   */
  async generateWhatsAppVideoScript(topic: string, angle?: string, brandRules?: string): Promise<ScriptResult<VideoScript>> {
    const prompt = `Eres el Director de Vídeo Directo para WhatsApp (Estados, Grupos y Canales) de Silvania Marketing Studio.

${ECOSISTEMA_KNOWLEDGE}

Crea el guión completo para un vídeo vertical (9:16) de EXACTAMENTE 30 segundos optimizado para compartir por WhatsApp sobre:
Tema: "${topic}"
${angle ? `Ángulo específico: "${angle}"` : ""}
${brandRules ? `\nREGLAS Y MARCA DEL USUARIO (DRIVE):\n${brandRules}\n` : ""}

Reglas obligatorias para WhatsApp 30s:
1. EXACTAMENTE 3 micro-escenas (10 segundos cada una, total 30 segundos).
2. Ritmo conversacional, cercano y directo al grano: 18 a 24 palabras por escena (ni más ni menos, para que la locución dure ~30s reales).
   - Escena 1 (00:00 - 00:10): Gancho cercano que conecte con un problema real o curiosidad inmediata.
   - Escena 2 (00:10 - 00:20): Solución práctica y beneficio tangible de Silvania.
   - Escena 3 (00:20 - 00:30): LLAMADA A LA ACCIÓN FINAL OBLIGATORIA en voz ("narration") y pantalla ("onScreenText") invitando a escribir por WhatsApp o entrar en silvania.ai. Si el tema trata sobre un producto "Próximamente" (Eva Agent o Marketing Agent), el cierre DEBE promover usar HOY **Silvania CoreAgent** (ya activo) en silvania.ai.
3. Texto en pantalla (onScreenText) claro y legible en móvil (3 a 6 palabras en mayúsculas).
4. Prompt visual fotorrealista en inglés para FLUX (formato 9:16 vertical cinematográfico) + "visualMood" y "visualConcepts" concretos ES/EN por escena.
5. Texto persuasivo para WhatsApp ("description"): redacta un copy corto y muy persuasivo listo para copiar y pegar junto al vídeo en WhatsApp (gancho en la primera línea, 2-3 frases con beneficio claro usando *negritas* de WhatsApp y emojis moderados, y cierre con CTA directo a silvania.ai o a CoreAgent si el tema es un producto "Próximamente").

Responde ÚNICAMENTE con un JSON válido con esta estructura:
{
  "title": "Título directo para WhatsApp",
  "hook": "Gancho inicial de los primeros 3 segundos",
  "description": "Texto persuasivo completo listo para enviar por WhatsApp junto al vídeo, con *negritas* y CTA final a silvania.ai",
  "tags": ["#WhatsApp", "#SilvaniaAI", "#Productividad", "#IA"],
  "totalEstimatedDurationSeconds": 30,
  "scenes": [
    {
      "sceneNumber": 1,
      "timestamp": "00:00 - 00:10",
      "visualPrompt": "Vertical 9:16 cinematic shot depicting concrete scene and emotion",
      "visualMood": "emocion1, emocion2",
      "visualConcepts": ["concepto1", "concepto2", "concepto3"],
      "narration": "Locución natural de 18 a 24 palabras",
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
        temperature: 0.6,
      });

      const raw = completion.choices[0].message?.content || "{}";
      const script = JSON.parse(raw) as VideoScript;
      if (script.scenes && script.scenes.length > 3) {
        script.scenes = script.scenes.slice(0, 3);
      }
      script.totalEstimatedDurationSeconds = 30;
      return { data: ensureClosingCta(script, topic), llmModel: preferredModel };
    } catch (err: any) {
      console.warn("⚠️ Falló OpenRouter en WhatsAppVideoScript, usando Groq:", err.message);
      const groqCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt + "\n\nResponde SOLO con JSON válido." }],
        temperature: 0.6,
      });

      const raw = groqCompletion.choices[0].message?.content || "{}";
      const cleanJson = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const script = JSON.parse(cleanJson) as VideoScript;
      if (script.scenes && script.scenes.length > 3) {
        script.scenes = script.scenes.slice(0, 3);
      }
      script.totalEstimatedDurationSeconds = 30;
      return { data: ensureClosingCta(script, topic), llmModel: "llama-3.3-70b-versatile" };
    }
  },
};

/**
 * Garantiza que la última escena de todo vídeo cierre con una llamada a la acción clara
 * tanto en la locución (voz) como en el texto en pantalla.
 */
function ensureClosingCta(script: VideoScript, topic: string): VideoScript {
  if (!script.scenes || script.scenes.length === 0) return script;

  // Si es una historia / relato / narración pura (no comercial), respetar el cierre narrativo sin meter publicidad de CoreAgent
  if (isPureStorytellingTopic(topic)) {
    script.description = ensureOfficialLinks(script.description || "");
    return script;
  }

  const lastScene = script.scenes[script.scenes.length - 1];
  const lowerTopic = topic.toLowerCase();
  const isUpcomingProduct =
    /\beva\b/i.test(lowerTopic) ||
    lowerTopic.includes("marketing") ||
    lowerTopic.includes("próximamente") ||
    lowerTopic.includes("proximamente") ||
    lowerTopic.includes("sneak peek");
  const narration = (lastScene.narration || "").trim();
  const hasSpokenUrl = /silvania\.ai|silvania punto a i/i.test(narration);
  const hasSpokenCta = isUpcomingProduct
    ? hasSpokenUrl && /coreagent/i.test(narration)
    : hasSpokenUrl && /pru[eé]ba|desc[uú]bre|visita|empieza|usa|solicita|únete/i.test(narration);

  if (!hasSpokenCta) {
    let ctaSentence = "Empieza hoy mismo con Silvania CoreAgent en silvania.ai.";
    if (isUpcomingProduct) {
      ctaSentence = "Muy pronto disponible; mientras tanto, empieza a usar hoy Silvania CoreAgent, ya activo en silvania.ai.";
    } else if (lowerTopic.includes("coreagent") || lowerTopic.includes("productividad")) {
      ctaSentence = "Empieza a usar Silvania CoreAgent hoy mismo en silvania.ai.";
    }
    lastScene.narration = narration ? `${narration.replace(/[.!?]*$/, "")}. ${ctaSentence}` : ctaSentence;
  }

  const screenText = (lastScene.onScreenText || "").trim();
  if (isUpcomingProduct && !/COREAGENT/i.test(screenText)) {
    lastScene.onScreenText = "USA COREAGENT HOY EN SILVANIA.AI";
  } else if (!/SILVANIA\.AI|PRU[EÉ]BALO|DESCUBRE|EMPIEZA|COREAGENT/i.test(screenText)) {
    lastScene.onScreenText = "USA COREAGENT EN SILVANIA.AI";
  }

  script.description = ensureOfficialLinks(script.description || "");
  return script;
}

const OFFICIAL_LINKS_BLOCK =
  `🌐 Web oficial: https://silvania.ai\n` +
  `🤖 Bot CoreAgent en Telegram: https://t.me/Silvania_Core_Agent_Bot\n` +
  `📢 Canal Telegram: https://t.me/silvania_ai\n` +
  `📸 Instagram: https://www.instagram.com/silvania.ai/\n` +
  `𝕏 X: https://x.com/Silvania_AI`;

/**
 * Garantiza que todo texto publicado o enviado (WhatsApp, redes, descripciones) incluya siempre
 * los enlaces oficiales a la web, bot de Telegram y redes sociales de Silvania.
 */
function ensureOfficialLinks(text: string, compactForX: boolean = false): string {
  const trimmed = (text || "").trim();
  const hasWeb = /silvania\.ai/i.test(trimmed);
  const hasBot = /Silvania_Core_Agent_Bot/i.test(trimmed);
  const hasSocial = /t\.me\/silvania_ai|instagram\.com\/silvania\.ai|x\.com\/Silvania_AI/i.test(trimmed);

  if (hasWeb && hasBot && hasSocial) {
    return trimmed;
  }

  if (compactForX) {
    const compactFooter = "🌐 https://silvania.ai | 🤖 https://t.me/Silvania_Core_Agent_Bot";
    return hasWeb && hasBot ? trimmed : `${trimmed}\n\n${compactFooter}`.trim();
  }

  return `${trimmed}\n\n${OFFICIAL_LINKS_BLOCK}`.trim();
}
