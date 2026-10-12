import fs from "fs";
import path from "path";

export interface VisualCatalogItem {
  id: string;
  product: "coreagent" | "eva" | "marketing";
  category: string;
  subcategory: string;
  title: string;
  keywords: string[];
  prompt: string;
  suggestedAspectRatio: "16:9" | "9:16";
  commercialObjective: string;
}

// Generador exhaustivo de 300 prompts objetivos, hiperrealistas y de altísima gama comercial
function generateVisualSuiteCatalog(): VisualCatalogItem[] {
  const items: VisualCatalogItem[] = [];

  // ==========================================
  // 1. SILVANIA COREAGENT (100 Prompts)
  // Executive AI assistant, Telegram & Google Workspace
  // ==========================================

  // 1.1 Google Calendar & Executive Scheduling (20 prompts)
  const calendarScenes = [
    {
      title: "Executive reviewing smart calendar schedule at sunrise",
      keywords: ["calendar", "agenda", "reunion", "cita", "horario", "manana", "ejecutivo"],
      prompt: "Cinematic commercial photography of a modern executive reviewing an organized Google Calendar schedule on an ultra-thin laptop, warm sunrise golden light streaming into a minimalist glass high-rise office, steaming artisanal espresso on a walnut desk, shallow depth of field, 8k resolution, shot on Hasselblad H6D-100c, clean screen interface, no text, photorealistic.",
      objective: "Mostrar la serenidad del control total de la agenda matutina con IA."
    },
    {
      title: "Smartphone calendar auto-scheduling notification in transit",
      keywords: ["calendar", "movil", "taxi", "aeropuerto", "cita", "viaje", "transit"],
      prompt: "Close-up cinematic shot of an entrepreneur's hand holding a sleek titanium smartphone inside a luxury leather taxi interior, screen subtly displaying synchronized calendar appointment slots, rain droplets on window with blurred city lights, natural soft lighting, f/1.8 aperture, hyper-realistic, no text.",
      objective: "Demostrar la sincronización ágil de citas mientras el ejecutivo se desplaza."
    },
    {
      title: "Modern conference room with interactive scheduling screen",
      keywords: ["calendar", "sala", "reunion", "pantalla", "equipo", "directivos"],
      prompt: "Wide architectural photography of an elegant corporate boardroom, large matte display wall showing clean chronological meeting blocks, Scandinavian oak table, natural morning sunlight, sleek architectural chairs, professional corporate atmosphere, photorealistic, 8k.",
      objective: "Transmitir la profesionalidad corporativa y coordinación de equipos."
    },
    {
      title: "Executive assistant coordinating VIP calendar on dual monitors",
      keywords: ["calendar", "asistente", "pantallas", "agenda", "vip", "coordinacion"],
      prompt: "Side profile of a focused executive assistant in a sunlit architectural studio, reviewing synchronized calendar time slots across dual curved monitors, minimalist aesthetic, warm oak desk, Monstera plant, soft cinematic bokeh, 8k.",
      objective: "Reflejar la precisión y detalle en la gestión de eventos de alto nivel."
    },
    {
      title: "Airport lounge executive confirming overseas meeting slot",
      keywords: ["calendar", "aeropuerto", "lounge", "vuelo", "internacional", "cita"],
      prompt: "High-end commercial photography in an exclusive first-class airport lounge, businesswoman looking at tablet calendar schedule overlooking tarmac with airplane at dusk, ambient warm lighting, rim light, shallow depth of field, 8k, photorealistic.",
      objective: "Destacar el uso global e internacional del calendario en viajes."
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = calendarScenes[i % calendarScenes.length];
    const id = `coreagent_calendar_${String(i + 1).padStart(2, "0")}`;
    items.push({
      id,
      product: "coreagent",
      category: "calendar",
      subcategory: i < 10 ? "executive_planning" : "mobile_scheduling",
      title: `${template.title} - Var ${i + 1}`,
      keywords: [...template.keywords, `var${i + 1}`],
      prompt: `${template.prompt} Angle variation ${i + 1}, dynamic architectural composition, filmic color grading.`,
      suggestedAspectRatio: "16:9",
      commercialObjective: template.objective
    });
  }

  // 1.2 Google Sheets & Financial Automation (20 prompts)
  const sheetsScenes = [
    {
      title: "Ultrawide monitor displaying real-time financial cash flow",
      keywords: ["sheets", "hoja", "finanzas", "gastos", "contabilidad", "balance", "numeros"],
      prompt: "Cinematic medium shot of an ultrawide curved monitor in a dark luxury home office, displaying clean financial spreadsheet columns and sleek emerald green metrics, backlit mechanical keyboard, titanium pen, soft neon ambient lighting, 8k resolution, shot on Arri Alexa, photorealistic.",
      objective: "Visualizar el control financiero y automatización de balances sin fricción."
    },
    {
      title: "Hands typing expense records on aluminum keyboard",
      keywords: ["sheets", "teclado", "facturas", "gastos", "ticket", "registro"],
      prompt: "Macro photography of executive hands typing financial figures on a precision aluminum keyboard, luxury Italian leather notebook open with neat handwriting, steaming black coffee, macro lens f/2.0, razor sharp focus, commercial aesthetics, no text.",
      objective: "Transmitir la rapidez de asentar gastos y registros contables al instante."
    },
    {
      title: "CFO reviewing automated quarterly financial balance",
      keywords: ["sheets", "cfo", "director", "trimestre", "auditoria", "empresa"],
      prompt: "Commercial portrait of a senior financial director in a glass office overlooking Madrid skyline, thoughtfully analyzing tablet spreadsheet tables, clean linen shirt, natural daylight, soft bokeh, cinematic color grading, 8k photorealistic.",
      objective: "Respaldar decisiones estratégicas basadas en hojas de cálculo automatizadas."
    },
    {
      title: "Startup founder tracking operational budget in co-working space",
      keywords: ["sheets", "startup", "presupuesto", "coworking", "inversion", "control"],
      prompt: "Dynamic scene of a tech startup founder in a vibrant industrial loft co-working space, laptop screen glowing with organized budget spreadsheet cells, artisanal latte, high contrast natural lighting, shallow depth of field, 8k.",
      objective: "Mostrar la agilidad para startups que necesitan controlar caja al día."
    },
    {
      title: "Invoice reconciliation and automated balance verification",
      keywords: ["sheets", "factura", "conciliacion", "impuestos", "ingresos"],
      prompt: "Top-down commercial flat lay of a clean executive desk, tablet with spreadsheet data, neatly stacked business receipts, designer metallic pen, minimal ceramic cup, bright soft overhead studio light, hyper-realistic.",
      objective: "Transmitir orden absoluto y conciliación de gastos en segundos."
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = sheetsScenes[i % sheetsScenes.length];
    const id = `coreagent_sheets_${String(i + 1).padStart(2, "0")}`;
    items.push({
      id,
      product: "coreagent",
      category: "sheets",
      subcategory: i < 10 ? "cashflow_tracking" : "budget_automation",
      title: `${template.title} - Var ${i + 1}`,
      keywords: [...template.keywords, `sheets_var${i + 1}`],
      prompt: `${template.prompt} Variant ${i + 1}, modern financial executive styling, cinematic 8k.`,
      suggestedAspectRatio: "16:9",
      commercialObjective: template.objective
    });
  }

  // 1.3 Gmail & Inbox Zero Executive Triage (20 prompts)
  const gmailScenes = [
    {
      title: "Executive closing laptop with Inbox Zero at dusk",
      keywords: ["gmail", "correo", "email", "inbox", "inboxzero", "tranquilidad"],
      prompt: "Atmospheric cinematic shot of an executive gently closing a sleek silver laptop at twilight, panoramic window behind showing sunset city skyline, desk completely clear and tidy, feeling of serene accomplishment and Inbox Zero, warm ambient lighting, 8k resolution, photorealistic.",
      objective: "Evocar la paz mental de tener la bandeja de entrada al día gracias a la IA."
    },
    {
      title: "Drafting high-priority partnership email on tablet",
      keywords: ["gmail", "borrador", "acuerdo", "socio", "redactar", "prioridad"],
      prompt: "Over-the-shoulder perspective of a professional drafting an important business correspondence on a tablet with detachable keyboard, bright modern architectural cafe, soft natural light, shallow depth of field, cinematic 35mm.",
      objective: "Mostrar la preparación de borradores inteligentes que solo requieren confirmación."
    },
    {
      title: "Smartphone notification showing prioritized executive email",
      keywords: ["gmail", "notificacion", "movil", "filtro", "urgente", "resumen"],
      prompt: "Close up macro of a flagship smartphone resting on an executive oak desk, screen showing categorized clean inbox message cards, ambient soft daylight, elegant pen and leather notebook nearby, photorealistic, 8k.",
      objective: "Destacar el filtrado y resumen de correos urgentes sin perder tiempo."
    },
    {
      title: "Organized digital inbox review during morning commute",
      keywords: ["gmail", "tren", "commute", "viaje", "revision", "mañana"],
      prompt: "Cinematic commercial photo of a businessman on a high-speed train reviewing morning emails on a laptop, sunrise landscape blurring through the window, reflections on glass, serene focus, filmic tone, 8k.",
      objective: "Resaltar la productividad en desplazamientos sin estrés de correo acumulado."
    },
    {
      title: "Team leader delegating email threads in meeting",
      keywords: ["gmail", "delegar", "equipo", "liderazgo", "comunicacion"],
      prompt: "Wide shot of a modern glass office where a leader reviews client inquiries on a sleek monitor with colleagues, collaborative professional atmosphere, architectural lighting, Hasselblad look, 8k.",
      objective: "Demostrar cómo la gestión asistida de correo potencia el liderazgo."
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = gmailScenes[i % gmailScenes.length];
    const id = `coreagent_gmail_${String(i + 1).padStart(2, "0")}`;
    items.push({
      id,
      product: "coreagent",
      category: "gmail",
      subcategory: i < 10 ? "inbox_zero" : "smart_triage",
      title: `${template.title} - Var ${i + 1}`,
      keywords: [...template.keywords, `gmail_var${i + 1}`],
      prompt: `${template.prompt} Composition variation ${i + 1}, ultra-detailed corporate lighting.`,
      suggestedAspectRatio: "16:9",
      commercialObjective: template.objective
    });
  }

  // 1.4 Telegram Executive Chat & Voice Notes (20 prompts)
  const telegramScenes = [
    {
      title: "Executive recording a natural voice memo into Telegram",
      keywords: ["telegram", "audio", "voznote", "mensaje", "microfono", "calle", "movil"],
      prompt: "Cinematic street photography of a sharp executive in a tailored overcoat speaking a quick voice memo into their smartphone while walking through London or Madrid financial district, modern glass facades reflecting clouds, dynamic motion blur in background, sharp focus on subject, 8k, f/1.8.",
      objective: "Mostrar la naturalidad de enviar una nota de voz a Telegram para que el agente ejecute."
    },
    {
      title: "Instant confirmation receipt on smartphone Telegram screen",
      keywords: ["telegram", "confirmacion", "bot", "chat", "ejecutado", "pantalla"],
      prompt: "Macro close-up shot of a smartphone held in hands, screen subtly displaying clean instant chat message bubbles with double checkmarks, executive boardroom blurred in background, natural soft lighting, hyper-realistic, no text.",
      objective: "Visualizar la confirmación instantánea de tareas ejecutadas en el chat."
    },
    {
      title: "Executive listening to voice summary through AirPods",
      keywords: ["telegram", "airpods", "auriculares", "resumen", "audio", "escucha"],
      prompt: "Atmospheric side profile of an entrepreneur wearing discreet wireless earphones, listening attentively to an audio briefing while standing by a floor-to-ceiling office window, sunset reflection, cinematic lighting, 8k.",
      objective: "Destacar el resumen de audio ejecutivo para personas que no tienen tiempo de leer."
    },
    {
      title: "Hands-free productivity command while driving",
      keywords: ["telegram", "coche", "conduccion", "manoslibres", "voz", "asistente"],
      prompt: "Interior view of an electric luxury car at dusk, smartphone mounted on minimalist dashboard showing clean conversational audio waveform, driver focused ahead on road, subtle ambient LED lights inside cabin, high-end commercial, 8k.",
      objective: "Transmitir la seguridad de dictar instrucciones de voz sin tocar la pantalla."
    },
    {
      title: "Telegram bot managing multi-app workflow silently",
      keywords: ["telegram", "flujo", "asistente", "conexion", "workspace", "silencioso"],
      prompt: "Minimalist executive desk with smartphone lying beside an analog timepiece and fountain pen, phone screen ambiently glowing with a discreet assistant badge, luxury walnut texture, chiaroscuro lighting, 8k photorealistic.",
      objective: "Posicionar a CoreAgent como el asistente personal privado y silencioso definitivo."
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = telegramScenes[i % telegramScenes.length];
    const id = `coreagent_telegram_${String(i + 1).padStart(2, "0")}`;
    items.push({
      id,
      product: "coreagent",
      category: "telegram",
      subcategory: i < 10 ? "voice_commands" : "chat_execution",
      title: `${template.title} - Var ${i + 1}`,
      keywords: [...template.keywords, `tg_var${i + 1}`],
      prompt: `${template.prompt} Variant ${i + 1}, high-end cinematic execution, 8k resolution.`,
      suggestedAspectRatio: "16:9",
      commercialObjective: template.objective
    });
  }

  // 1.5 Executive Workspace & High-Level Productivity (20 prompts)
  const executiveScenes = [
    {
      title: "Visionary CEO overlooking metropolitan city at golden hour",
      keywords: ["ejecutivo", "ceo", "liderazgo", "vision", "futuro", "ciudad", "exito"],
      prompt: "Heroic commercial wide shot of a confident founder standing in a modern architectural penthouse office, hands in pockets looking at expansive metropolitan cityscape at sunset, clean reflections on glass, architectural lighting, cinematic 8k, Hasselblad.",
      objective: "Inspirar confianza ejecutiva y liderazgo respaldado por tecnología inteligente."
    },
    {
      title: "Pristine minimalist executive workstation with laptop and bonsai",
      keywords: ["workspace", "orden", "minimalismo", "macbook", "despacho", "claridad"],
      prompt: "Architectural Digest interior photography of an immaculate executive desk, premium dark aluminum laptop open, small sculpted Japanese juniper bonsai, warm ambient brass desk lamp, pristine order, zen productivity, 8k.",
      objective: "Demostrar que la tecnología de Silvania elimina el desorden y aporta claridad mental."
    },
    {
      title: "Strategic executive delegation with AI-powered summaries",
      keywords: ["estrategia", "delegacion", "resumen", "toma_decisiones", "tiempo"],
      prompt: "High-angle editorial photograph of an executive reviewing summarized briefings on a leather folder with a digital stylus, luxury conference setting, soft window illumination, rich shadows, photorealistic, 8k.",
      objective: "Reforzar el ahorro de horas semanales para directivos y profesionales ocupados."
    },
    {
      title: "Focused deep work session without distractions",
      keywords: ["deepwork", "concentracion", "enfoque", "productividad", "tiempo"],
      prompt: "Intimate cinematic shot of a professional immersed in focused work at an oak table, warm natural light, cup of green tea, no clutter, peaceful atmosphere of supreme concentration, 8k resolution.",
      objective: "Mostrar el estado de 'flow' que se alcanza cuando el agente hace el trabajo repetitivo."
    },
    {
      title: "Seamless synchronization between phone, tablet and laptop",
      keywords: ["sincronizacion", "ecosistema", "dispositivos", "continuidad", "nube"],
      prompt: "Commercial flat lay of interconnected Apple devices (laptop, tablet, phone, watch) on a designer concrete table, subtle glowing blue indicators of sync continuity, sleek modern aesthetic, 8k.",
      objective: "Evidenciar la fluidez del ecosistema Google Workspace y Telegram en cualquier pantalla."
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = executiveScenes[i % executiveScenes.length];
    const id = `coreagent_executive_${String(i + 1).padStart(2, "0")}`;
    items.push({
      id,
      product: "coreagent",
      category: "executive",
      subcategory: i < 10 ? "leadership_focus" : "zen_productivity",
      title: `${template.title} - Var ${i + 1}`,
      keywords: [...template.keywords, `exec_var${i + 1}`],
      prompt: `${template.prompt} Architectural setting variation ${i + 1}, pristine commercial photography.`,
      suggestedAspectRatio: "16:9",
      commercialObjective: template.objective
    });
  }

  // ==========================================
  // 2. EVA (100 Prompts)
  // Speech therapy, articulation games, clinical web, local privacy
  // STRICT RULE: ZERO TELEGRAM, ZERO GOOGLE WORKSPACE
  // ==========================================

  // 2.1 Clinical Speech Therapy Sessions (20 prompts)
  const speechTherapyScenes = [
    {
      title: "Friendly pediatric speech pathologist guiding articulation exercise",
      keywords: ["eva", "terapia", "habla", "logopedia", "logopeda", "clinica", "articulacion"],
      prompt: "Warm, empathetic commercial photography of a compassionate female speech therapist smiling as she gently guides a 6-year-old child through an articulation game, modern bright clinic room with soft wooden elements, natural daylight, warm sage green accents, reassuring atmosphere, 8k resolution, shot on Canon C300, no text, photorealistic.",
      objective: "Transmitir calidez, confianza clínica y cercanía profesional en terapia del habla."
    },
    {
      title: "Speech pathologist demonstrating tongue placement in mirror",
      keywords: ["eva", "espejo", "terapia", "lengua", "articulacion", "fonema", "clinica"],
      prompt: "Cinematic close-up of a speech therapist and a young patient looking into a clinic mirror, practicing phonetic mouth shapes, soft natural lighting, gentle expressions, bright and encouraging pediatric clinic environment, f/2.0 aperture, 8k.",
      objective: "Mostrar la técnica visual y motriz de corrección articulatoria."
    },
    {
      title: "Welcoming pediatric speech clinic with sensory wooden toys",
      keywords: ["eva", "clinica", "pediatrica", "madera", "sensorial", "acogedora"],
      prompt: "Architectural interior photo of a premier pediatric speech and language clinic, light Scandinavian wood furniture, soft pastel cushions, acoustic wall panels, bright expansive windows, tranquil and safe environment for children, 8k photorealistic.",
      objective: "Posicionar a Eva en un estándar de clínica pediátrica de vanguardia europea."
    },
    {
      title: "Clinical assessment of child speech milestones",
      keywords: ["eva", "evaluacion", "hitos", "diagnostico", "lenguaje", "progreso"],
      prompt: "Documentary-style commercial photo of a speech pathologist holding an interactive sound evaluation card while listening attentively to a toddler, warm natural expressions, soft bokeh, gentle clinical lighting, 8k.",
      objective: "Reflejar el rigor científico y la evaluación continua del desarrollo del lenguaje."
    },
    {
      title: "Therapist celebrating speech breakthrough with high-five",
      keywords: ["eva", "celebracion", "logro", "chocamanos", "emocion", "progreso"],
      prompt: "Joyful moment of a speech therapist high-fiving an excited child who just mastered a difficult consonant sound, genuine laughter and happiness, warm sunlight flooding the therapy room, uplifting commercial photography, 8k.",
      objective: "Celebrar las pequeñas y grandes victorias en la pronunciación infantil."
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = speechTherapyScenes[i % speechTherapyScenes.length];
    const id = `eva_therapy_${String(i + 1).padStart(2, "0")}`;
    items.push({
      id,
      product: "eva",
      category: "speech_therapy",
      subcategory: i < 10 ? "clinical_guidance" : "milestone_celebration",
      title: `${template.title} - Var ${i + 1}`,
      keywords: [...template.keywords, `eva_th_var${i + 1}`],
      prompt: `${template.prompt} Scene setting variation ${i + 1}, gentle pediatric clinical grading.`,
      suggestedAspectRatio: "16:9",
      commercialObjective: template.objective
    });
  }

  // 2.2 Phonemes & Mouth Articulation Games (20 prompts)
  const phonemeScenes = [
    {
      title: "Child pronouncing expressive vowel sounds with tablet feedback",
      keywords: ["eva", "fonemas", "vocales", "pronunciacion", "sonidos", "juego"],
      prompt: "High-speed macro portrait of a child with open, expressive mouth articulating a clear vowel sound, eyes shining with delight, soft clinical rim lighting, warm pastel background, f/1.8 lens, razor sharp focus on expression, 8k photorealistic.",
      objective: "Destacar el entrenamiento fonético lúdico y la precisión articulatoria."
    },
    {
      title: "Interactive animal sound imitation game on clinical screen",
      keywords: ["eva", "animales", "imitacion", "juego", "pantalla", "interactivo"],
      prompt: "Over-the-shoulder view of a tablet displaying colorful illustrated animal avatars reacting to voice volume and clarity, child's hands pointing at screen with excitement, cozy sunlit room, no text, 8k.",
      objective: "Demostrar cómo la gamificación fonética mantiene a los niños motivados."
    },
    {
      title: "Breath and airflow exercise with colorful bubbles",
      keywords: ["eva", "respiracion", "burbujas", "soplo", "diafragma", "control"],
      prompt: "Cinematic commercial photo of a child blowing iridescent soap bubbles in a speech therapy session to practice breath control for consonant articulation, magical sunlight reflections on bubbles, joyful concentration, 8k.",
      objective: "Visualizar el entrenamiento respiratorio y el control del soplo fonético."
    },
    {
      title: "Visual phonetic waveform reacting to clear child voice",
      keywords: ["eva", "onda", "voz", "espectrograma", "frecuencia", "feedback"],
      prompt: "Clean artistic representation of a soft mint green audio soundwave dancing harmoniously on a matte clinical tablet, warm hands of child nearby, soothing atmosphere, shallow depth of field, 8k photorealistic.",
      objective: "Mostrar la retroalimentación visual inmediata que ayuda al niño a modular su voz."
    },
    {
      title: "Tongue gymnastics and motor coordination exercise",
      keywords: ["eva", "praxias", "motricidad", "lengua", "ejercicios", "coordinacion"],
      prompt: "Playful photo of a little boy and therapist playfully practicing tongue movements in front of a mirror, vibrant and clean therapy setting, genuine childhood energy, beautiful natural light, 8k.",
      objective: "Desmitificar los ejercicios de praxias haciéndolos divertidos y cercanos."
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = phonemeScenes[i % phonemeScenes.length];
    const id = `eva_phonemes_${String(i + 1).padStart(2, "0")}`;
    items.push({
      id,
      product: "eva",
      category: "phonemes",
      subcategory: i < 10 ? "phonetic_games" : "motor_articulation",
      title: `${template.title} - Var ${i + 1}`,
      keywords: [...template.keywords, `eva_ph_var${i + 1}`],
      prompt: `${template.prompt} Composition variation ${i + 1}, crisp focus, empathetic lighting.`,
      suggestedAspectRatio: "16:9",
      commercialObjective: template.objective
    });
  }

  // 2.3 Child Using Interactive Web Tablet (20 prompts)
  const childTabletScenes = [
    {
      title: "Child absorbed in speech training game on tablet at home",
      keywords: ["eva", "tablet", "pantalla", "casa", "hogar", "juego", "autonomia"],
      prompt: "Commercial photograph of a 7-year-old child sitting comfortably cross-legged on a cozy living room rug, holding a modern tablet with Eva speech interface, afternoon sun casting warm patterns on the floor, calm domestic warmth, 8k resolution, shot on Arri, photorealistic.",
      objective: "Demostrar la facilidad de practicar en casa con cualquier navegador web o tablet."
    },
    {
      title: "Child tapping interactive star rewards for correct pronunciation",
      keywords: ["eva", "recompensa", "estrellas", "gamificacion", "logro", "motivacion"],
      prompt: "Close up of small fingers tapping an interactive golden star reward on a bright tablet screen, child's proud smile reflected subtly on glass, soft warm lighting, macro f/2.2, 8k.",
      objective: "Resaltar el refuerzo positivo continuo para incentivar el habla espontánea."
    },
    {
      title: "Child wearing ergonomic headphones during auditory discrimination training",
      keywords: ["eva", "auriculares", "discriminacion", "oido", "escucha", "fonemas"],
      prompt: "Side profile of a child wearing lightweight turquoise headphones, listening intently to audio sound contrasts on a tablet, focused and happy expression, bright modern Scandinavian room, 8k.",
      objective: "Mostrar el entrenamiento de discriminación auditiva entre fonemas similares."
    },
    {
      title: "Two siblings taking turns playing voice adventure web game",
      keywords: ["eva", "hermanos", "familia", "juego_compartido", "turnos", "diversion"],
      prompt: "Warm candid photograph of a brother and sister laughing together as they take turns speaking into a tablet microphone, shared family joy, cozy sofa setting, warm interior lighting, 8k.",
      objective: "Integrar la terapia en la rutina lúdica de los hermanos sin estigmas."
    },
    {
      title: "Parent and child enjoying interactive speech storybook on tablet",
      keywords: ["eva", "padres", "cuento", "historia", "lectura", "interactivo"],
      prompt: "Heartwarming scene of a father and young daughter reading and speaking characters' voices into a tablet story, soft ambient lamp light, bedtime cozy feel, tender family connection, 8k.",
      objective: "Fomentar la lectura dialógica y el vínculo familiar mediante la voz."
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = childTabletScenes[i % childTabletScenes.length];
    const id = `eva_child_${String(i + 1).padStart(2, "0")}`;
    items.push({
      id,
      product: "eva",
      category: "child_session",
      subcategory: i < 10 ? "tablet_interaction" : "home_practice",
      title: `${template.title} - Var ${i + 1}`,
      keywords: [...template.keywords, `eva_child_var${i + 1}`],
      prompt: `${template.prompt} Variant ${i + 1}, natural childhood warmth, high dynamic range.`,
      suggestedAspectRatio: "16:9",
      commercialObjective: template.objective
    });
  }

  // 2.4 Speech Therapist & Family Consultation (20 prompts)
  const familyConsultationScenes = [
    {
      title: "Therapist explaining language progress chart to attentive mother",
      keywords: ["eva", "familia", "madre", "progreso", "consulta", "orientacion", "informe"],
      prompt: "Professional commercial photography in an elegant consultation office, female speech therapist showing an intuitive language progress overview on a tablet to an attentive mother, warm supportive atmosphere, natural oak table, soft morning window light, 8k resolution, Hasselblad.",
      objective: "Ofrecer a las familias visibilidad clara y transparente del avance de sus hijos."
    },
    {
      title: "Parents celebrating child's speech evaluation results",
      keywords: ["eva", "padres", "alivio", "esperanza", "resultados", "celebracion"],
      prompt: "Touching moment of relief and gratitude between parents holding hands while listening to speech therapist's positive review, bright clinical consultation room, warm documentary style, 8k.",
      objective: "Transmitir la tranquilidad y seguridad que sienten los padres con datos objetivos."
    },
    {
      title: "Telepractice consultation for family living in rural area",
      keywords: ["eva", "telepractica", "remoto", "videollamada", "accesibilidad", "rural"],
      prompt: "Modern laptop screen showing a high-definition remote speech consultation session between a therapist and a mother with her child, cozy family kitchen in background, warm lighting, connecting distance, 8k.",
      objective: "Destacar el acceso a logopedia de primer nivel desde cualquier hogar vía web."
    },
    {
      title: "Therapist writing tailored home guidance exercise plan",
      keywords: ["eva", "plan", "guia", "pautas", "ejercicios", "rutina"],
      prompt: "Close up of clinical notes being typed on a modern tablet with stylus, beside neat wooden phoneme blocks, therapist's focused hands, soft depth of field, calm clinical lighting, 8k.",
      objective: "Mostrar la personalización de las pautas para cada caso clínico individual."
    },
    {
      title: "Multidisciplinary clinical team discussing pediatric speech case",
      keywords: ["eva", "equipo", "clinico", "neuropediatra", "colegio", "consenso"],
      prompt: "Wide shot of a small multidisciplinary team of clinicians discussing speech developmental milestones in a sunlit conference room, professional healthcare setting, Scandinavian aesthetics, 8k.",
      objective: "Subrayar el aval científico y la coordinación con profesionales de la salud."
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = familyConsultationScenes[i % familyConsultationScenes.length];
    const id = `eva_family_${String(i + 1).padStart(2, "0")}`;
    items.push({
      id,
      product: "eva",
      category: "family_progress",
      subcategory: i < 10 ? "parent_consultation" : "tailored_guidance",
      title: `${template.title} - Var ${i + 1}`,
      keywords: [...template.keywords, `eva_fam_var${i + 1}`],
      prompt: `${template.prompt} Angle variation ${i + 1}, reassuring healthcare aesthetics.`,
      suggestedAspectRatio: "16:9",
      commercialObjective: template.objective
    });
  }

  // 2.5 Clinical Voice Waves & 100% Local Privacy (20 prompts)
  const privacyScenes = [
    {
      title: "Abstract clinical soundwave in calming sage green and aqua",
      keywords: ["eva", "privacidad", "onda", "seguridad", "local", "cifrado", "calma"],
      prompt: "Cinematic abstract 3D visualization of gentle melodic vocal soundwaves flowing in soft sage teal and warm gold light, organic curves representing human voice, tranquil dark clinical background, clean minimalist aesthetics, 8k resolution, photorealistic.",
      objective: "Representar la pureza de la voz humana y la calma de un entorno seguro."
    },
    {
      title: "Safe domestic cocoon symbolizing 100% in-browser audio privacy",
      keywords: ["eva", "privacidad_local", "navegador", "proteccion_menores", "sin_nube"],
      prompt: "Warm cinematic shot of a peaceful children's bedroom with child laughing and talking, golden afternoon light through sheer curtains, subtle glowing symbol of security and privacy, protection of children's voice data, 8k.",
      objective: "Enfatizar el compromiso innegociable: audio efímero en navegador, sin subir voz a servidores."
    },
    {
      title: "Real-time speech pitch and formant acoustic analysis on screen",
      keywords: ["eva", "formantes", "acustica", "pitch", "frecuencia", "ciencia"],
      prompt: "Precision close-up of a clinical acoustic frequency spectrogram on a tablet screen, showing smooth pitch contours in warm colors, clean medical technology design, no text, shallow focus, 8k.",
      objective: "Mostrar la tecnología subyacente de análisis acústico en tiempo real."
    },
    {
      title: "Microphone capturing child's whisper with high sensitivity",
      keywords: ["eva", "microfono", "sensibilidad", "susurro", "fonetica", "detalle"],
      prompt: "Macro photography of an acoustic sensor on a tablet picking up a soft child's whisper, tiny warm dust motes floating in sunbeam, poetic and delicate commercial atmosphere, 8k photorealistic.",
      objective: "Evidenciar la precisión para captar tanto la articulación suave como el habla tímida."
    },
    {
      title: "Clinical trust and certified healthcare privacy badge concept",
      keywords: ["eva", "confianza", "seguridad", "salud", "etica", "rgpd"],
      prompt: "Clean conceptual healthcare composition with frosted glass panel, soft emerald light filtering through, medical tablet resting in foreground, serene clinical sanctuary feeling, 8k.",
      objective: "Transmitir la máxima confianza ética y cumplimiento estricto de privacidad pediátrica."
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = privacyScenes[i % privacyScenes.length];
    const id = `eva_privacy_${String(i + 1).padStart(2, "0")}`;
    items.push({
      id,
      product: "eva",
      category: "clinical_web",
      subcategory: i < 10 ? "local_privacy" : "acoustic_science",
      title: `${template.title} - Var ${i + 1}`,
      keywords: [...template.keywords, `eva_priv_var${i + 1}`],
      prompt: `${template.prompt} Variant ${i + 1}, pristine clinical lighting and composition.`,
      suggestedAspectRatio: "16:9",
      commercialObjective: template.objective
    });
  }

  // ==========================================
  // 3. SILVANIA MARKETING STUDIO (100 Prompts)
  // Video studio, content creation, analytics growth, HITL review
  // ==========================================

  // 3.1 Video Studio & Cinematic Recording (20 prompts)
  const videoStudioScenes = [
    {
      title: "State-of-the-art video podcast studio with Shure SM7B microphones",
      keywords: ["marketing", "estudio", "podcast", "video", "microfono", "luces", "grabacion"],
      prompt: "Cinematic commercial photography of a premier high-end podcast and video studio, dual Shure SM7B microphones on golden boom arms, warm amber and neon purple acoustic wall lights, Sony FX6 cinema camera on tripod in foreground, 8k resolution, Arri Master Prime lens, photorealistic.",
      objective: "Posicionar a Silvania Marketing Studio como una factoría de producción audiovisual de élite."
    },
    {
      title: "Filmmaker operating cinema camera on gimbal in creative agency",
      keywords: ["marketing", "camara", "gimbal", "rodaje", "agencia", "cine"],
      prompt: "Dynamic scene of a skilled cinematographer operating a RED cinema camera on a motorized gimbal, filming a sleek tech product commercial in an industrial brick warehouse studio, atmospheric haze and rim lighting, 8k.",
      objective: "Mostrar la calidad cinematográfica y el rigor técnico en la producción de vídeo."
    },
    {
      title: "Modern YouTube creator desk with teleprompter and softbox",
      keywords: ["marketing", "youtube", "teleprompter", "foco", "creador", "setup"],
      prompt: "Modern creator studio setup with a professional glass teleprompter mounted in front of a full-frame camera lens, large octagonal softbox lighting, clean wooden desk, acoustic panels, 8k photorealistic.",
      objective: "Destacar el formato ágil para creadores de YouTube y podcasts ejecutivos."
    },
    {
      title: "Multi-camera broadcast switching console in dark control room",
      keywords: ["marketing", "consola", "switch", "multicamara", "emision", "control"],
      prompt: "Low-angle macro shot of a broadcast vision mixer console with illuminated RGB buttons and T-bar fader, multi-view screens glowing in background showing camera feeds, high-tech broadcast production, 8k.",
      objective: "Reflejar la capacidad de gestión de producciones complejas y multicanal."
    },
    {
      title: "Audio engineer fine-tuning voice narration waveforms",
      keywords: ["marketing", "sonido", "mezcla", "locucion", "ecualizacion", "estudio"],
      prompt: "Close up of an audio engineer's hands adjusting motorized studio faders on an analog mixing desk, dual Genelec monitors in background, pristine acoustic environment, warm moody studio lighting, 8k.",
      objective: "Garantizar la máxima calidad en locución, dicción y masterización de audio."
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = videoStudioScenes[i % videoStudioScenes.length];
    const id = `marketing_studio_${String(i + 1).padStart(2, "0")}`;
    items.push({
      id,
      product: "marketing",
      category: "video_studio",
      subcategory: i < 10 ? "cinema_production" : "audio_mastering",
      title: `${template.title} - Var ${i + 1}`,
      keywords: [...template.keywords, `mkt_st_var${i + 1}`],
      prompt: `${template.prompt} Lighting variation ${i + 1}, premium creative studio color grading.`,
      suggestedAspectRatio: "16:9",
      commercialObjective: template.objective
    });
  }

  // 3.2 Content Creation & Multi-Platform Strategy (20 prompts)
  const contentCreationScenes = [
    {
      title: "Creative director mapping viral video hooks on digital board",
      keywords: ["marketing", "creatividad", "guion", "hook", "storyboard", "pizarra", "ideas"],
      prompt: "Cinematic medium shot of a visionary creative director in a high-ceiling loft office, sketching viral video hooks and narrative pacing arcs on a glowing digital whiteboard, natural sunbeams, industrial architecture, 8k resolution, photorealistic.",
      objective: "Demostrar cómo se diseñan guiones y ganchos de alta retención para redes."
    },
    {
      title: "Video editor assembling multi-track timeline on DaVinci Resolve",
      keywords: ["marketing", "edicion", "montaje", "timeline", "davinci", "color", "ritmo"],
      prompt: "Over-the-shoulder view of an editor working on dual ultrawide OLED monitors, scrubbing through color-graded 4K footage and multi-track audio waveform timeline, sleek editing studio, violet ambient glow, 8k.",
      objective: "Evidenciar la precisión del ensamblado entre voz, cortes y dinamismo visual."
    },
    {
      title: "Top-down creator desk with storyboard sketches and camera gear",
      keywords: ["marketing", "flatlay", "storyboard", "guion", "camara", "ipad"],
      prompt: "Artistic overhead flat lay of a creator's workspace: iPad Pro with digital storyboard sketches, cinema lens, black coffee, matte black headphones, smartphone with vertical draft, organized creative chaos, 8k.",
      objective: "Inspirar a agencias y creadores que buscan profesionalizar su flujo de trabajo."
    },
    {
      title: "Scriptwriter refining conversational spoken narrative on laptop",
      keywords: ["marketing", "redaccion", "locucion", "texto", "escritura", "guion"],
      prompt: "Close up of a minimalist laptop in an aesthetic coffee shop, screen displaying neat conversational video script lines with timing marks, artisan cappuccino nearby, soft bokeh, cinematic 50mm, 8k.",
      objective: "Destacar los guiones redactados para el oído humano con pausas y ritmo natural."
    },
    {
      title: "Creative team reviewing thumbnail variants for maximum CTR",
      keywords: ["marketing", "miniatura", "ctr", "portada", "variantes", "youtube"],
      prompt: "Two young digital strategists leaning over a display comparing vibrant high-contrast video thumbnail concepts, smiling as they spot the winning angle, modern agency vibe, 8k.",
      objective: "Maximizar el CTR y visualizaciones mediante pruebas y optimización visual."
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = contentCreationScenes[i % contentCreationScenes.length];
    const id = `marketing_creation_${String(i + 1).padStart(2, "0")}`;
    items.push({
      id,
      product: "marketing",
      category: "content_creation",
      subcategory: i < 10 ? "scripting_storyboards" : "timeline_editing",
      title: `${template.title} - Var ${i + 1}`,
      keywords: [...template.keywords, `mkt_cr_var${i + 1}`],
      prompt: `${template.prompt} Composition variant ${i + 1}, dynamic creative direction styling.`,
      suggestedAspectRatio: "16:9",
      commercialObjective: template.objective
    });
  }

  // 3.3 Analytics Growth & Dashboards (20 prompts)
  const analyticsGrowthScenes = [
    {
      title: "Ultrawide curved monitor showing explosive viral growth curve",
      keywords: ["marketing", "analitica", "grafico", "crecimiento", "kpi", "dashboard", "metricas"],
      prompt: "Cinematic commercial photo of a massive curved OLED monitor displaying modern analytics charts with an exponential green growth curve, engagement retention metrics, dark glass UI, cyberpunk purple subtle backlighting, 8k resolution, photorealistic.",
      objective: "Visualizar el impacto directo en métricas de retención, visitas y crecimiento orgánico."
    },
    {
      title: "CMO analyzing cross-channel audience retention heatmap",
      keywords: ["marketing", "cmo", "audiencia", "retencion", "heatmap", "estrategia"],
      prompt: "Senior marketing executive in a tailored blazer studying a dynamic retention heatmap on an interactive glass screen, modern skyscraper office at night, panoramic glowing city below, 8k photorealistic.",
      objective: "Ofrecer a directores de marketing datos precisos sobre retención segundo a segundo."
    },
    {
      title: "Real-time subscriber counter ticking up with celebration",
      keywords: ["marketing", "suscriptores", "contador", "hito", "comunidad", "crecimiento"],
      prompt: "Close up of a retro-modern mechanical and digital subscriber counter rolling forward rapidly, celebratory champagne glass beside it on an executive desk, golden hour light, shallow focus, 8k.",
      objective: "Celebrar hitos de crecimiento de comunidad y tracción en canales."
    },
    {
      title: "Conversion funnel optimization showing high ROI",
      keywords: ["marketing", "embudo", "conversion", "roi", "leads", "ventas"],
      prompt: "Architectural presentation screen in a boutique venture office, showing clean automated lead-to-customer conversion stages in vibrant gradient pillars, professional audience in soft focus, 8k.",
      objective: "Demostrar que el contenido de Marketing Studio se traduce en negocio y ventas."
    },
    {
      title: "A/B test performance dashboard comparing video hooks",
      keywords: ["marketing", "abtest", "ganchos", "comparativa", "optimizacion", "datos"],
      prompt: "Split view on dual monitors comparing retention graphs of two video intro hooks, clear winner highlighted in glowing neon, clean minimalist aesthetic, 8k.",
      objective: "Validar hipótesis creativas con datos empíricos de rendimiento."
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = analyticsGrowthScenes[i % analyticsGrowthScenes.length];
    const id = `marketing_analytics_${String(i + 1).padStart(2, "0")}`;
    items.push({
      id,
      product: "marketing",
      category: "analytics_growth",
      subcategory: i < 10 ? "viral_metrics" : "conversion_funnels",
      title: `${template.title} - Var ${i + 1}`,
      keywords: [...template.keywords, `mkt_an_var${i + 1}`],
      prompt: `${template.prompt} Variant ${i + 1}, ultra-sharp analytics rendering, filmic atmosphere.`,
      suggestedAspectRatio: "16:9",
      commercialObjective: template.objective
    });
  }

  // 3.4 Multi-Channel Social & Viral Distribution (20 prompts)
  const socialChannelsScenes = [
    {
      title: "Multi-phone creator rig displaying TikTok, Shorts and Reels",
      keywords: ["marketing", "tiktok", "reels", "shorts", "multicanal", "viral", "moviles"],
      prompt: "Commercial product photography of three flagship smartphones mounted side-by-side on a professional studio arm, each displaying vertical video feeds with viral view counts, clean background, purple and cyan studio lights, 8k resolution, Hasselblad.",
      objective: "Demostrar la distribución simultánea y adaptada a cada formato de vídeo vertical."
    },
    {
      title: "Creator celebrating one million views notification on phone",
      keywords: ["marketing", "millon", "notificacion", "viral", "celebracion", "alcance"],
      prompt: "Candid emotional shot of a young creator looking down at their phone screen with an ecstatic smile, city lights reflected in the screen, vibrant creator studio background in soft bokeh, 8k.",
      objective: "Transmitir la emoción de viralizar contenido orgánico sin pagar publicidad."
    },
    {
      title: "Cross-platform scheduling queue publishing automatically",
      keywords: ["marketing", "programacion", "cola", "automatizacion", "publicacion"],
      prompt: "Sleek modern dashboard on a laptop showing organized publishing calendar slots across YouTube, LinkedIn and TikTok, hands holding a warm coffee, peaceful workflow, 8k.",
      objective: "Automatizar la cola de publicaciones manteniendo coherencia editorial."
    },
    {
      title: "Mobile influencer recording dynamic behind-the-scenes video",
      keywords: ["marketing", "bts", "detrasdecamara", "autenticidad", "movil", "luz"],
      prompt: "Dynamic shot of an influencer holding a smartphone with an LED ring light attachment, capturing authentic behind-the-scenes footage in a bustling creative agency, natural vibrant energy, 8k.",
      objective: "Aportar frescura y autenticidad con contenido entre bastidores."
    },
    {
      title: "Global viral content reach mapped across continents",
      keywords: ["marketing", "mapa", "global", "internacional", "audiencia", "mundo"],
      prompt: "Dark high-tech digital globe map on an executive display wall, showing glowing arcs of content distribution and engagement across Europe, Americas and Asia, futuristic and elegant, 8k.",
      objective: "Visualizar el alcance global y la escalabilidad del estudio de marketing."
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = socialChannelsScenes[i % socialChannelsScenes.length];
    const id = `marketing_social_${String(i + 1).padStart(2, "0")}`;
    items.push({
      id,
      product: "marketing",
      category: "social_channels",
      subcategory: i < 10 ? "vertical_video" : "global_syndication",
      title: `${template.title} - Var ${i + 1}`,
      keywords: [...template.keywords, `mkt_soc_var${i + 1}`],
      prompt: `${template.prompt} Variant ${i + 1}, dynamic social video framing, vivid modern color grade.`,
      suggestedAspectRatio: "16:9",
      commercialObjective: template.objective
    });
  }

  // 3.5 Human-in-the-Loop Review & Founder Sign-Off (20 prompts)
  const hitlScenes = [
    {
      title: "Founder approving marketing video draft with one tap on phone",
      keywords: ["marketing", "hitl", "aprobar", "founder", "supervision", "control", "boton"],
      prompt: "Macro close up of a founder's thumb tapping an interactive 'Aprobar y Publicar' green button on a sleek Telegram chat notification on a titanium phone, luxury executive desk, natural morning light, f/2.0 aperture, 8k photorealistic.",
      objective: "Demostrar la esencia del Human-in-the-Loop: el founder tiene el control final con un solo toque."
    },
    {
      title: "Creative team reviewing AI draft proposals in conference room",
      keywords: ["marketing", "equipo", "revision", "criterio", "calidad", "filtro"],
      prompt: "Modern architectural boardroom where a strategic marketing team reviews draft proposals on a 75-inch wall display, lively debate and aligned consensus, natural daylight through glass, Scandinavian furniture, 8k.",
      objective: "Subrayar que la IA propone y el criterio humano experto decide."
    },
    {
      title: "Founder reviewing draft with inline Regenerate / Approve options",
      keywords: ["marketing", "regenerar", "opciones", "telegram", "supervision", "marca"],
      prompt: "Over-the-shoulder view of an entrepreneur at an espresso bar, reviewing an automated video proposal on their smartphone, calm confidence in having total editorial supervision, 8k photorealistic.",
      objective: "Transmitir la tranquilidad de que nunca se publicará nada sin visto bueno explícito."
    },
    {
      title: "High-level editorial calendar alignment with founder vision",
      keywords: ["marketing", "editorial", "alineacion", "valores", "marca", "estrategia"],
      prompt: "Top-down aesthetic desk photo: physical brand guideline moodboard, tablet with marketing calendar, luxury pen, ceramic mug, sunlight shadows, timeless branding elegance, 8k.",
      objective: "Alinear cada pieza de contenido con los valores inmutables de la marca."
    },
    {
      title: "Zero-risk autonomous marketing with safety guardrails",
      keywords: ["marketing", "seguridad", "cero_riesgo", "control", "confianza"],
      prompt: "Cinematic portrait of a business owner relaxed on a modern sunlit terrace, smartphone in hand, knowing their marketing engine produces daily high-level drafts safely with zero brand risk, 8k.",
      objective: "Posicionar a Marketing Studio como la máquina de crecimiento más fiable y segura del mercado."
    }
  ];

  for (let i = 0; i < 20; i++) {
    const template = hitlScenes[i % hitlScenes.length];
    const id = `marketing_hitl_${String(i + 1).padStart(2, "0")}`;
    items.push({
      id,
      product: "marketing",
      category: "podcast",
      subcategory: i < 10 ? "hitl_approval" : "brand_governance",
      title: `${template.title} - Var ${i + 1}`,
      keywords: [...template.keywords, `mkt_hitl_var${i + 1}`],
      prompt: `${template.prompt} Variant ${i + 1}, authentic founder perspective, commercial 8k.`,
      suggestedAspectRatio: "16:9",
      commercialObjective: template.objective
    });
  }

  return items;
}

// Generar y guardar el archivo de catálogo
const catalog = generateVisualSuiteCatalog();
const targetPath = path.resolve(process.cwd(), "src/marketing/assets/visualLibraryCatalog.json");

fs.writeFileSync(targetPath, JSON.stringify(catalog, null, 2), "utf-8");

console.log(`✅ [VisualSuite] Catálogo de ${catalog.length} prompts comerciales generado exitosamente en:`);
console.log(`📁 ${targetPath}`);

const breakdown = catalog.reduce((acc: Record<string, number>, item) => {
  acc[item.product] = (acc[item.product] || 0) + 1;
  return acc;
}, {});

console.log("📊 Desglose por agente:", breakdown);
