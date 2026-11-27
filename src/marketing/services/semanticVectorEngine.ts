/**
 * Motor Vectorial Semántico Bilingüe (ES/EN) de 256 dimensiones y latencia 0ms.
 * Combina:
 * 1. Ejes conceptuales humanos, emocionales, climáticos, cotidianos, históricos y empresariales (dims 0..63).
 * 2. Expansión asociativa de conceptos y metáforas visuales (ej. "despertar" <-> amanecer, cama, playa, mañana, luz).
 * 3. Lematización ligera bilingüe + hashing de palabras y n-gramas en dims 64..255.
 */

const VECTOR_DIM = 256;
const HASH_OFFSET = 64;

const BOILERPLATE_NOISE = new Set([
  "cinematic",
  "photorealistic",
  "photography",
  "photograph",
  "photo",
  "picture",
  "image",
  "visual",
  "prompt",
  "still",
  "film",
  "8k",
  "4k",
  "hd",
  "uhd",
  "dramatic",
  "lighting",
  "aesthetics",
  "minimal",
  "minimalist",
  "stock",
  "free",
  "royalty",
  "pexels",
  "copyright",
  "clean",
  "trademarks",
  "high",
  "contrast",
  "rendering",
  "render",
  "quality",
  "ultra",
  "detailed",
  "text",
  "the",
  "and",
  "with",
  "for",
  "from",
  "into",
  "that",
  "this",
  "para",
  "con",
  "sin",
  "una",
  "uno",
  "unos",
  "unas",
  "los",
  "las",
  "del",
  "por",
  "que",
  "como",
  "sobre",
  "activo",
  "libre",
  "derechos",
  "escena",
  "scene",
]);

// 64 ejes semánticos explícitos (dimensiones 0..63) para alinear conceptos, emociones y objetos concretos
const SEMANTIC_AXES: string[][] = [
  // 0: Victoria / Triunfo / Logro / Celebración
  ["victoria", "triunfo", "exito", "logro", "ganar", "campeon", "record", "cima", "celebracion", "lograr", "triunfar", "victory", "win", "success", "achievement", "celebrate"],
  // 1: Gloria / Grandeza / Prestigio / Legado
  ["gloria", "epico", "grandeza", "majestad", "prestigio", "imperio", "legado", "trascender", "glory", "epic", "prestige", "legacy", "empire"],
  // 2: Descubrimiento / Innovación / Curiosidad / Idea
  ["descubrimiento", "descubrir", "curiosidad", "innovacion", "revelacion", "chispa", "idea", "explorar", "asombro", "creatividad", "ingenio", "discovery", "innovation", "wonder", "creative"],
  // 3: Suspense / Tensión / Problema / Urgencia
  ["suspense", "tension", "problema", "caos", "urgencia", "riesgo", "misterio", "saturacion", "papeleo", "burocracia", "presion", "retraso", "lenta", "lento", "tediosa", "tedioso", "manual", "repetitivo", "repetitiva", "desorden", "copiar", "pegar", "conflict", "tension", "chaos", "urgent", "problem", "slow", "tedious", "manual", "repetitive"],
  // 4: Calma / Serenidad / Paz interior / Meditación / Alivio
  ["calma", "alivio", "paz", "serenidad", "tranquilidad", "descanso", "equilibrio", "libertad", "bienestar", "meditacion", "meditar", "respirar", "mindfulness", "relajacion", "armonia", "calm", "relief", "peace", "serenity", "meditation", "breath", "harmony"],
  // 5: Automatización / Flujo / Orquestación / Sistemas / Prospección
  ["automatizacion", "automatizar", "flujo", "workflow", "orquestacion", "autonomo", "24/7", "sincronizacion", "pipeline", "nodos", "trigger", "prospeccion", "prospectar", "leads", "scraping", "extractor", "captacion", "batch", "automatico", "automation", "autonomous", "prospecting", "extraction"],
  // 6: Documentos apilados / Archivos / Digitalización / Plantillas
  ["documento", "documentos", "apilados", "papeles", "carpetas", "archivo", "pdf", "contrato", "factura", "presupuesto", "proforma", "plantilla", "registro", "ficha", "fichas", "informe", "resumen", "digitalizacion", "stacked", "papers", "files", "documents", "template", "invoice", "quote"],
  // 7: Robots / Androides / Agentes IA
  ["robot", "robots", "androide", "humanoide", "asistente", "agente", "ia", "inteligencia", "artificial", "coreagent", "nucleo", "bot", "ai"],
  // 8: Oficinas modernas / Despacho / Ejecutivo / CEO
  ["oficina", "despacho", "ejecutivo", "ceo", "junta", "directiva", "cristal", "marmol", "corporativo", "empresa", "b2b", "negocio", "pyme", "office", "executive", "corporate", "desk", "business"],
  // 9: Productividad / Rendimiento / Agenda / Eficiencia / Estructura
  ["productividad", "ahorro", "eficiencia", "velocidad", "rapidez", "agil", "instantaneo", "directo", "estructurado", "estructurada", "funcional", "organizado", "organizacion", "rendimiento", "agenda", "prioridad", "productivity", "efficiency", "performance", "structured", "organized"],
  // 10: Google Workspace (Drive, Gmail, Calendar, Sheets, Tablas, CRM)
  ["google", "workspace", "gmail", "correo", "email", "calendar", "calendario", "citas", "drive", "sheets", "hojas", "tabla", "tablas", "fila", "filas", "columna", "columnas", "celda", "celdas", "formula", "formulas", "crm", "spreadsheet", "spreadsheets", "table", "tables", "docs", "nube", "cloud"],
  // 11: Voz / Telegram / Mensajería instantánea / Smartphone
  ["voz", "telegram", "audio", "comando", "mensaje", "chat", "manos libres", "movil", "smartphone", "telefono", "voice", "mobile", "phone"],
  // 12: Publicidad / Anuncios / Estudio de grabación
  ["publicidad", "anuncio", "anuncios", "camara", "valla", "megafono", "lanzamiento", "copywriting", "advertising", "studio", "camera", "podcast"],
  // 13: Estrategia Marketing / Embudo / Segmentación
  ["marketing", "embudo", "funnel", "conversion", "segmentacion", "target", "posicionamiento", "inbound", "leads", "marca", "brand", "campaign"],
  // 14: Aceptación / Aprobación / Acuerdo / Cierre / Apretón de manos
  ["aceptacion", "aprobacion", "aprobado", "satisfecho", "estrellas", "testimonio", "aplauso", "acuerdo", "cierre", "venta", "apreton", "handshake", "agreement", "approval", "deal"],
  // 15: Redes Sociales / Viralidad / Creadores
  ["redes", "sociales", "social", "reels", "shorts", "tiktok", "instagram", "linkedin", "youtube", "viral", "creador", "comunidad", "engagement"],
  // 16: Analítica / ROI / Métricas / Gráficos / Datos reales / Investigación
  ["analitica", "roi", "metricas", "grafico", "crecimiento", "ventas", "datos", "optimizacion", "dashboard", "radar", "escalar", "investigacion", "investigar", "busqueda", "web", "directorio", "contacto", "contactos", "verificado", "fuente", "analytics", "growth", "chart", "research", "database", "verified"],
  // 17: Eva / Clases escolares / Colegio / Aula / Niños
  ["eva", "clase", "clases", "escolar", "escolares", "colegio", "escuela", "aula", "alumnos", "estudiantes", "ninos", "nino", "nina", "infantil", "school", "kids", "children"],
  // 18: Profesora humana / Logopeda / Terapia del habla
  ["profesora", "maestra", "docente", "logopeda", "terapeuta", "terapia", "habla", "pronunciacion", "lectura", "fonema", "teacher", "speech", "therapy"],
  // 19: Tutor infantil / Pizarra educativa / Aprendizaje
  ["tutor", "educativo", "companero", "amigable", "dulzura", "inclusion", "pizarra", "tarjetas", "learning", "cards"],
  // 20: Juegos educativos / Cuentos / Fantasía / Dragón / Castillo
  ["juego", "juegos", "diversion", "cuento", "cuentos", "magia", "ternura", "xilofono", "puzzle", "aventura", "fantasia", "dragon", "princesa", "castillo", "zorro", "fairy", "castle", "magic"],
  // 21: Cosmos / Ciencia espacial / Planetas / Galaxias
  ["cosmos", "espacio", "universo", "planetas", "planeta", "galaxia", "nebulosa", "orbita", "tierra", "estrellas", "astronomia", "space", "galaxy", "nebula", "planet", "universe"],
  // 22: Colaboración / Equipo / Reunión
  ["equipo", "colaboracion", "alianza", "reunion", "juntos", "union", "compañeros", "colegas", "team", "meeting", "collaboration", "colleagues"],
  // 23: Seguridad / Privacidad / Confianza / Respaldo
  ["seguridad", "privacidad", "confianza", "boveda", "proteccion", "respaldo", "garantia", "security", "privacy", "trust"],

  // --- NUEVOS EJES VISUALES HUMANOS, COTIDIANOS, CLIMÁTICOS, EMOCIONALES E HISTÓRICOS (dims 24..63) ---
  // 24: Despertar / Mañana / Cama / Dormitorio / Levantarse
  ["despertar", "despierta", "despiertas", "despertarse", "desperto", "cama", "dormitorio", "habitacion", "sabanas", "almohada", "despertador", "manana", "madrugar", "levantarse", "ojos abiertos", "wake", "waking", "awake", "bed", "bedroom", "morning", "pillow", "sheet"],
  // 25: Amanecer / Alba / Sol naciente / Luz dorada / Nuevo día
  ["amanecer", "alba", "alborada", "salir", "sol", "naciente", "rayos", "dorado", "dorada", "nuevo dia", "renacer", "luz matinal", "cortinas", "sunrise", "dawn", "daybreak", "sunlight", "golden", "curtains", "morning light"],
  // 26: Playa / Mar / Océano / Olas / Arena / Costa
  ["playa", "mar", "oceano", "olas", "ola", "arena", "orilla", "costa", "brisa", "marea", "muelle", "beach", "sea", "ocean", "waves", "wave", "shore", "coast", "sand", "pier"],
  // 27: Café / Desayuno / Hogar / Ventana / Lectura / Libreta
  ["cafe", "taza", "desayuno", "hogar", "ventana", "libro", "leer", "lectura", "libreta", "diario", "escribir", "mesa", "coffee", "cup", "breakfast", "home", "window", "book", "reading", "journal", "write"],
  // 28: Atardecer / Ocaso / Crepúsculo
  ["atardecer", "ocaso", "crepusculo", "puesta", "sunset", "dusk", "twilight"],
  // 29: Noche / Oscuridad / Penumbra / Insomnio / Tarde
  ["noche", "oscuro", "oscuridad", "penumbra", "sombra", "sombras", "medianoche", "madrugada", "insomnio", "tarde", "night", "dark", "darkness", "shadow", "late", "midnight"],
  // 30: Lluvia / Tormenta / Nubes / Relámpago / Gris / Frío
  ["lluvia", "llover", "lluvioso", "gotas", "cristal", "tormenta", "trueno", "relampago", "nublado", "nubes", "gris", "frio", "rain", "rainy", "raindrops", "storm", "stormy", "lightning", "clouds", "gloomy", "overcast"],
  // 31: Naturaleza / Bosque / Montaña / Sendero / Horizonte / Aurora
  ["naturaleza", "bosque", "arboles", "montana", "montanas", "cumbre", "sendero", "camino", "horizonte", "paisaje", "aurora", "nieve", "natural", "nature", "forest", "trees", "mountain", "mountains", "peak", "trail", "horizon", "landscape"],
  // 32: Alegría / Felicidad / Sonrisa / Risa / Optimismo / Plenitud
  ["alegria", "alegre", "feliz", "felicidad", "sonrisa", "sonriendo", "sonreir", "reir", "risa", "entusiasmo", "optimismo", "jubilo", "plenitud", "euphoria", "joy", "joyful", "happy", "happiness", "smile", "smiling", "laugh", "laughing"],
  // 33: Tristeza / Melancolía / Pena / Llanto / Abatimiento
  ["tristeza", "triste", "melancolia", "melancolico", "pena", "dolor", "llanto", "lagrimas", "llorar", "abatimiento", "desanimo", "decaido", "depresion", "cabizbajo", "sad", "sadness", "sorrow", "grief", "tears", "crying", "depressed", "heartbreak"],
  // 34: Soledad / Nostalgia / Silencio / Introspección / Aislamiento
  ["soledad", "solo", "sola", "aislamiento", "nostalgia", "vacio", "pensativo", "introspeccion", "contemplacion", "silencio", "silueta", "lonely", "loneliness", "solitary", "solitude", "alone", "nostalgic", "contemplation", "silhouette"],
  // 35: Ansiedad / Estrés / Agobio / Miedo / Angustia / Agotamiento
  ["ansiedad", "ansioso", "estres", "estresado", "agobio", "agobiado", "angustia", "nervios", "miedo", "temor", "panico", "agotamiento", "agotado", "cansancio", "cansado", "burnout", "anxiety", "anxious", "stressed", "overwhelmed", "worried", "exhausted", "fear", "panic", "weary"],
  // 36: Fracaso / Crisis / Derrota / Quiebra / Ruina / Dificultad
  ["fracaso", "fracasar", "fracasos", "fallido", "fallida", "derrota", "quiebra", "ruina", "crisis", "dificultad", "obstaculo", "tropezar", "caida", "perder", "failure", "fail", "failed", "bankrupt", "defeat", "struggle", "loss"],
  // 37: Esfuerzo / Sacrificio / Trabajo duro / Perseverancia / Taller / Artesano
  ["esfuerzo", "sacrificio", "perseverancia", "constancia", "disciplina", "lucha", "sudor", "herramientas", "taller", "artesano", "artesanales", "mecanico", "inventor", "manual", "forjar", "effort", "sacrifice", "hard work", "workshop", "tools", "craftsman", "artisan", "grit"],
  // 38: Determinación / Enfoque mental / Valentía / Resiliencia / Superación
  ["determinacion", "decidido", "resiliencia", "valentia", "coraje", "fuerza", "enfoque", "concentracion", "mirada", "superacion", "superar", "reto", "imparable", "determined", "resilience", "courage", "focus", "concentration", "overcome"],
  // 39: Esperanza / Futuro mejor / Propósito / Gratitud / Renacer
  ["esperanza", "esperanzado", "ilusion", "gratitud", "agradecido", "proposito", "sentido", "futuro", "oportunidad", "comienzo", "empezar", "amanecer interior", "hope", "hopeful", "gratitude", "purpose", "future", "rebirth", "beginning"],
  // 40: Amor / Empatía / Conexión humana / Abrazo / Familia / Pareja
  ["amor", "abrazo", "carino", "ternura", "empatia", "conexion", "pareja", "familia", "amistad", "compasion", "corazon", "love", "hug", "warmth", "empathy", "connection", "couple", "family", "heart"],
  // 41: Deporte / Salud / Correr / Vitalidad / Energía física
  ["deporte", "correr", "atleta", "ejercicio", "salud", "vitalidad", "energia", "entrenamiento", "gimnasio", "running", "jogging", "fitness", "health", "energy", "vitality", "workout"],
  // 42: Coches clásicos / Automóvil / Época / Vintage / Modelo T (automoción pura)
  ["coche", "coches", "auto", "autos", "automovil", "automocion", "carro", "vehiculo", "modelo", "modelo t", "modelo a", "ford", "henry ford", "clasico", "vintage", "epoca", "retro", "car", "cars", "automobile", "classic", "mercedes", "chasis", "motor", "carroceria", "transmision"],
  // 43: Fábrica industrial / Línea de ensamblaje / Maquinaria pesada / Engranajes (sin telares textiles)
  ["fabrica", "industria", "industrial", "ensamblaje", "linea de ensamblaje", "cadena de montaje", "produccion", "maquinaria", "maquina", "engranajes", "pinones", "acero", "metal", "torno", "prensa", "manufactura", "escala", "planta", "obreros", "trabajadores", "factory", "assembly", "machinery", "gears", "steel", "manufacturing", "workers"],
  // 44: Reloj / Tiempo / Horas / Paciencia / Edad
  ["reloj", "tiempo", "hora", "horas", "minutos", "segundos", "paciencia", "arena", "mecanismo", "edad", "clock", "watch", "pocket watch", "hourglass", "time", "patience"],
  // 45: Planos / Estrategia / Arquitectura / Diseño / Sistema
  ["planos", "plano", "esquema", "arquitectura", "arquitecto", "ingeniero", "diseno", "sistema", "sistemas", "estrategia", "planificacion", "blueprint", "blueprints", "architect", "engineer", "strategy", "system"],
  // 46: Riqueza / Dinero / Millonario / Inversión / Capital / Finanzas
  ["riqueza", "millonario", "millonarios", "rico", "fortuna", "dinero", "inversion", "inversor", "inversores", "capital", "flujo", "caja", "salario", "dolares", "mercado", "finanzas", "patrimonio", "wealth", "wealthy", "millionaire", "investor", "money", "finance", "fortune"],
  // 47: Lujo sobrio / Rascacielos / Avión / Yate / Traje
  ["lujo", "elegante", "rascacielos", "avion", "jet", "yate", "mansion", "traje", "panoramica", "horizonte urbano", "skyscraper", "private jet", "yacht", "luxury", "suit", "skyline"],
  // 48: Historia / Pasado / Biografía / Siglo / Antiguo
  ["historia", "historico", "pasado", "siglo", "biografia", "memorias", "antiguo", "antigua", "blanco y negro", "monocromo", "history", "historical", "century", "antique", "monochrome"],
  // 49: Espiritualidad / Fe / Biblia / Luz celestial / Oración
  ["fe", "biblia", "biblico", "dios", "jesus", "cristo", "oracion", "sagrado", "espiritual", "alma", "celestial", "cruz", "tumba", "santuario", "faith", "bible", "sacred", "spiritual", "soul", "celestial", "sanctuary", "galilee"],
  // 50: Ciencia / Hologramas / Futurismo / Cuántico / Cibernético
  ["holograma", "hologramas", "cuantico", "futurista", "neural", "matriz", "cibernetico", "laboratorio", "hologram", "quantum", "futuristic", "cyber"],
  // 51: Inmobiliaria / Vivienda / Casa / Piso / Llaves / Alquiler
  ["inmobiliaria", "inmueble", "vivienda", "piso", "casa", "apartamento", "llaves", "hipoteca", "alquiler", "real estate", "apartment", "house", "keys"],
  // 52: Clínicas dentales / Dentista / Salud bucal
  ["dental", "dentista", "odontologo", "clinica", "diente", "paciente", "medico", "doctor", "dentist", "clinic", "patient"],
  // 53: Abogados / Legal / Justicia / Bufete
  ["abogado", "abogados", "juridico", "bufete", "legal", "ley", "juicio", "justicia", "lawyer", "attorney", "law", "legal"],
  // 54: Comercio / Tienda / Local / Cliente / Mostrador
  ["comercio", "tienda", "local", "mostrador", "retail", "tpv", "inventario", "shop", "store", "retail"],
  // 55: Autónomos / Oficios / Fontanero / Electricista / Reparto
  ["autonomo", "oficio", "reparacion", "instalacion", "obra", "casco", "construction", "contractor"],
  // 56: Música / Arte / Pintura / Piano / Inspiración creativa
  ["musica", "arte", "pintar", "pintura", "cuadro", "instrumento", "piano", "music", "art", "painting"],
  // 57: Ciudad / Calle / Tráfico / Urbano
  ["ciudad", "calle", "urbano", "edificio", "puente", "city", "street", "urban", "building"],
  // 58: Camino / Viaje / Libertad de movimiento / Carretera
  ["viaje", "viajar", "carretera", "ruta", "horizonte abierto", "travel", "road", "journey"],
  // 59: Confusión / Duda / Pregunta / Incertidumbre
  ["duda", "confusion", "incertidumbre", "pregunta", "pensar", "reflexion", "dilema", "doubt", "confusion", "uncertainty", "thinking"],
  // 60: Orgullo / Confianza en uno mismo / Dignidad / Éxito personal
  ["orgullo", "dignidad", "seguridad personal", "autoestima", "confianza personal", "proud", "dignity", "confident"],
  // 61: Fuego / Pasión / Energía intensa / Ambición
  ["fuego", "pasion", "ambicion", "hambre", "impulso", "ardor", "fire", "passion", "ambition", "drive"],
  // 62: Dinámica / Cambio / Transformación / Evolución
  ["cambio", "transformacion", "evolucion", "salto", "revolucion", "progreso", "change", "transformation", "evolution", "progress"],
  // 63: Silencio interior / Contemplación / Calma profunda
  ["contemplar", "respiracion", "silencioso", "apacible", "sereno", "contemplate", "quiet", "stillness"],
  // 64: Industria Textil / Telares / Hilares / Costura (aislado de automoción y software)
  ["textil", "textiles", "telar", "telares", "hilar", "hilares", "hilo", "hilos", "hilatura", "tejido", "tejidos", "tejer", "bobina", "bobinas", "carrete", "algodon", "lana", "costura", "textile", "loom", "looms", "weaving", "yarn", "thread", "spinning", "spindle", "fabric", "sewing"],
  // 65: Solución / Organización / Orden / Estructuración / Eficiencia moderna
  ["solucion", "resuelve", "resolver", "organiza", "organizar", "organizacion", "estructurado", "estructura", "orden", "ordenado", "limpio", "productivo", "eficiente", "ecosistema", "solution", "solve", "organize", "organized", "structured", "order", "clean", "workflow"],
];

// Expansiones asociativas para consultas (queries): cuando el guion nombra una acción/concepto,
// activa sus metáforas visuales concretas (sin contaminar los documentos indexados).
const CONCEPT_EXPANSIONS: Record<string, string[]> = {
  despertar: ["amanecer", "manana", "cama", "dormitorio", "luz", "playa", "nuevo dia", "sol", "cafe", "cortinas", "sunrise", "bed", "morning"],
  despierta: ["amanecer", "manana", "cama", "dormitorio", "luz", "playa", "nuevo dia", "sunrise", "bed"],
  despertarse: ["amanecer", "manana", "cama", "dormitorio", "luz", "playa", "nuevo dia"],
  madrugar: ["amanecer", "manana", "cama", "cafe", "ventana", "correr", "despertar"],
  dormir: ["cama", "dormitorio", "noche", "descanso", "almohada", "sabanas"],
  animo: ["emocion", "estado", "sentimiento", "rostro", "alegria", "tristeza", "calma", "ansiedad", "esperanza"],
  emocion: ["rostro", "alegria", "tristeza", "calma", "estres", "esperanza", "sentimiento"],
  triste: ["tristeza", "melancolia", "lluvia", "ventana", "penumbra", "soledad", "lagrimas"],
  tristeza: ["melancolia", "lluvia", "ventana", "penumbra", "soledad", "lagrimas", "abatimiento"],
  deprimido: ["tristeza", "soledad", "penumbra", "lluvia", "cabizbajo", "ventana"],
  melancolia: ["lluvia", "ventana", "atardecer", "soledad", "nostalgia"],
  alegre: ["alegria", "sonrisa", "feliz", "luz", "risa", "optimismo"],
  alegria: ["sonrisa", "felicidad", "risa", "luz", "celebrar", "entusiasmo"],
  feliz: ["alegria", "sonrisa", "risa", "plenitud", "sol"],
  felicidad: ["alegria", "sonrisa", "plenitud", "libertad", "luz"],
  calma: ["paz", "serenidad", "playa", "mar", "meditacion", "respirar", "naturaleza"],
  tranquilidad: ["calma", "paz", "serenidad", "playa", "cafe", "naturaleza"],
  paz: ["calma", "serenidad", "playa", "mar", "amanecer", "meditacion"],
  relajar: ["calma", "paz", "meditacion", "respirar", "playa", "descanso"],
  ansiedad: ["estres", "agobio", "angustia", "presion", "cansancio", "noche"],
  estres: ["agobio", "ansiedad", "presion", "cansancio", "manos cabeza", "noche"],
  agobio: ["estres", "ansiedad", "cansancio", "noche", "despacho oscuro"],
  soledad: ["solo", "playa", "muelle", "silueta", "nostalgia", "ventana"],
  solo: ["soledad", "silueta", "camino", "reflexion", "nostalgia"],
  esperanza: ["amanecer", "sol", "horizonte", "luz", "cielo", "cortinas", "futuro"],
  renacer: ["amanecer", "sol", "despertar", "playa", "nuevo dia", "esperanza"],
  superacion: ["correr", "cumbre", "montana", "determinacion", "exito", "esfuerzo"],
  fracaso: ["crisis", "derrota", "taller oscuro", "despacho oscuro", "cansancio", "lluvia"],
  esfuerzo: ["taller", "herramientas", "correr", "trabajo duro", "disciplina", "determinacion"],
  ford: ["coche clasico", "ford", "modelo t", "automovil", "automocion", "fabrica", "ensamblaje", "engranajes", "metal", "taller mecanico", "reloj", "planos"],
  automovil: ["coche", "coches", "ford", "engranajes", "motor", "chasis", "ensamblaje", "clasico"],
  coche: ["automovil", "coches", "ford", "engranajes", "motor", "ensamblaje", "clasico"],
  coches: ["automovil", "coche", "ford", "engranajes", "motor", "ensamblaje", "clasico"],
  solucion: ["coreagent", "workspace", "sheets", "telegram", "organizacion", "orden", "ecosistema", "eficiencia", "mockup", "panel"],
  organiza: ["sheets", "calendar", "workspace", "tablas", "agenda", "orden", "planificacion", "estructura", "coreagent"],
  organizar: ["sheets", "calendar", "workspace", "tablas", "agenda", "orden", "planificacion", "estructura", "coreagent"],
  organizacion: ["sheets", "calendar", "workspace", "tablas", "agenda", "orden", "planificacion", "estructura", "coreagent"],
  millonario: ["riqueza", "rascacielos", "exito", "inversor", "lujo", "avion", "traje"],
  riqueza: ["millonario", "exito", "rascacielos", "inversor", "fortuna", "libertad"],
  tiempo: ["reloj", "amanecer", "atardecer", "engranajes", "paciencia"],
  futuro: ["horizonte", "amanecer", "cielo", "holograma", "tecnologia", "esperanza"],
  prospeccion: ["automatizacion", "datos", "clientes", "ordenador", "sheets", "crm", "web", "leads", "oficina", "ejecutivo"],
  prospectar: ["automatizacion", "datos", "clientes", "ordenador", "sheets", "web", "leads"],
  leads: ["clientes", "prospeccion", "crm", "sheets", "tablas", "ventas", "datos"],
  sheets: ["tablas", "hojas", "datos", "workspace", "formulas", "ordenador", "oficina", "productividad"],
  tabla: ["sheets", "datos", "filas", "columnas", "formulas", "estructurada", "ordenador"],
  tablas: ["sheets", "datos", "filas", "columnas", "formulas", "estructuradas", "ordenador"],
  manual: ["papeleo", "estres", "saturacion", "reloj", "lento", "documentos"],
  tediosa: ["papeleo", "estres", "saturacion", "reloj", "lento", "documentos"],
  lenta: ["reloj", "retraso", "papeleo", "estres", "saturacion"],
  automatizacion: ["flujo", "robot", "holograma", "nodos", "eficiencia", "workspace", "coreagent"],
  automatizar: ["flujo", "robot", "holograma", "nodos", "eficiencia", "workspace", "coreagent"],
  factura: ["plantilla", "sheets", "documento", "calculo", "oficina", "finanzas"],
  presupuesto: ["proforma", "plantilla", "sheets", "calculo", "cliente", "taller"],
  crm: ["leads", "clientes", "sheets", "datos", "tablas", "prospeccion"],
  investigacion: ["web", "busqueda", "datos", "analitica", "ordenador", "verificado"],
};

const AXIS_WORD_MAP = new Map<string, number[]>();
const AXIS_STEM_MAP = new Map<string, number[]>();

export function normalizeText(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, " ")
    .trim();
}

export function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "");
}

function lightStem(tok: string): string {
  if (tok.length <= 4) return tok;
  return tok
    .replace(/(imientos|imiento|aciones|acion|adores|ador|idades|idad|mente|ando|iendo|arse|erse|irse|ing|tion|ness|ment|ed|es|as|os|s)$/i, "")
    .slice(0, 7);
}

for (let axisIdx = 0; axisIdx < SEMANTIC_AXES.length; axisIdx++) {
  for (const phrase of SEMANTIC_AXES[axisIdx]) {
    for (const part of phrase.split(/\s+/)) {
      const norm = normalizeToken(part);
      if (norm.length < 2) continue;
      const list = AXIS_WORD_MAP.get(norm) || [];
      if (!list.includes(axisIdx)) list.push(axisIdx);
      AXIS_WORD_MAP.set(norm, list);

      const st = lightStem(norm);
      if (st.length >= 4) {
        const slist = AXIS_STEM_MAP.get(st) || [];
        if (!slist.includes(axisIdx)) slist.push(axisIdx);
        AXIS_STEM_MAP.set(st, slist);
      }
    }
  }
}

export function stripBoilerplateNoise(text: string): string {
  const words = (text || "").split(/\s+/);
  const kept = words.filter((w) => {
    const n = normalizeToken(w);
    return n.length >= 2 && !BOILERPLATE_NOISE.has(n);
  });
  return kept.join(" ");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !BOILERPLATE_NOISE.has(t));
}

function fnv1aHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function addTokenToVector(vec: Float64Array, tok: string, weight: number): void {
  // 1. Proyección conceptual directa en ejes semánticos (dims 0..63)
  const exactAxes = AXIS_WORD_MAP.get(tok);
  if (exactAxes) {
    for (const ax of exactAxes) {
      vec[ax] += 2.6 * weight;
    }
  } else {
    const st = lightStem(tok);
    const stemAxes = st.length >= 4 ? AXIS_STEM_MAP.get(st) : undefined;
    if (stemAxes) {
      for (const ax of stemAxes) {
        vec[ax] += 2.1 * weight;
      }
    } else if (tok.length >= 4) {
      for (const [key, axes] of AXIS_WORD_MAP.entries()) {
        if (key.length >= 4 && (tok.startsWith(key.slice(0, 5)) || key.startsWith(tok.slice(0, 5)))) {
          for (const ax of axes) {
            vec[ax] += 1.0 * weight;
          }
        }
      }
    }
  }

  // 2. Signed feature hashing en dims 64..255 (palabra + raíz + trigramas)
  const bucketCount = VECTOR_DIM - HASH_OFFSET;
  const h = fnv1aHash(tok);
  vec[HASH_OFFSET + (h % bucketCount)] += ((h & 1) === 0 ? 1 : -1) * 1.0 * weight;

  const st = lightStem(tok);
  if (st.length >= 4 && st !== tok) {
    const hs = fnv1aHash(`stem:${st}`);
    vec[HASH_OFFSET + (hs % bucketCount)] += ((hs & 1) === 0 ? 1 : -1) * 0.8 * weight;
  }

  if (tok.length >= 4) {
    for (let i = 0; i <= tok.length - 3; i++) {
      const tri = tok.slice(i, i + 3);
      const th = fnv1aHash(tri);
      vec[HASH_OFFSET + (th % bucketCount)] += ((th & 1) === 0 ? 1 : -1) * 0.25 * weight;
    }
  }
}

export function getExpandedQueryTokens(text: string): string[] {
  const tokens = tokenize(text);
  const expanded = new Set<string>(tokens);
  for (const tok of tokens) {
    const exp = CONCEPT_EXPANSIONS[tok];
    if (exp) {
      for (const e of exp) {
        for (const sub of tokenize(e)) expanded.add(sub);
      }
    }
  }
  return Array.from(expanded);
}

export function computeSemanticVector(text: string, expandConcepts: boolean = false): number[] {
  const vec = new Float64Array(VECTOR_DIM);
  const tokens = tokenize(text);

  for (const tok of tokens) {
    addTokenToVector(vec, tok, 1.0);

    if (expandConcepts) {
      const exp = CONCEPT_EXPANSIONS[tok];
      if (exp) {
        for (const phrase of exp) {
          for (const sub of tokenize(phrase)) {
            addTokenToVector(vec, sub, 0.52);
          }
        }
      }
    }
  }

  // L2 Normalize
  let normSq = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    normSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(normSq) || 1;
  const out: number[] = new Array(VECTOR_DIM);
  for (let i = 0; i < VECTOR_DIM; i++) {
    out[i] = Number((vec[i] / norm).toFixed(5));
  }
  return out;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}
