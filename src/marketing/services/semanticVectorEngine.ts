/**
 * Motor Vectorial Semántico bilingüe (ES/EN) determinista y de latencia 0ms.
 * Codifica textos, guiones, emociones, productos y objetivos en vectores L2-normalizados
 * de 128 dimensiones para calcular similitud coseno en tiempo real sin depender de red.
 */

const VECTOR_DIM = 128;

// 24 ejes semánticos explícitos (dimensiones 0..23) para alinear conceptos clave
const SEMANTIC_AXES: string[][] = [
  // 0: Victoria / Éxito / Logro
  ["victoria", "triunfo", "exito", "logro", "ganar", "campeon", "record", "cima", "superacion", "celebracion", "victory", "win", "success", "achievement"],
  // 1: Gloria / Épico / Lujo / Prestigio
  ["gloria", "epico", "grandeza", "majestad", "prestigio", "lujo", "exclusivo", "dorado", "imperio", "legado", "glory", "epic", "luxury", "prestige"],
  // 2: Descubrimiento / Innovación / Curiosidad
  ["descubrimiento", "descubrir", "curiosidad", "innovacion", "revelacion", "chispa", "idea", "explorar", "asombro", "futuro", "discovery", "innovation", "wonder"],
  // 3: Suspense / Problema / Caos / Urgencia
  ["suspense", "tension", "problema", "caos", "urgencia", "riesgo", "misterio", "estres", "saturacion", "papeleo", "burocracia", "cansancio", "frustracion", "drama"],
  // 4: Calma / Alivio / Paz / Inspiración / Esperanza
  ["calma", "alivio", "paz", "inspiracion", "esperanza", "tranquilidad", "descanso", "equilibrio", "serenidad", "libertad", "bienestar", "relief", "calm", "hope"],
  // 5: Automatización / Flujo / Orquestación
  ["automatizacion", "automatizar", "flujo", "workflow", "orquestacion", "autonomo", "24/7", "sincronizacion", "pipeline", "nodos", "trigger", "automation"],
  // 6: Documentos apilados / Archivos / Digitalización
  ["documento", "documentos", "apilados", "papeles", "carpetas", "archivo", "pdf", "contrato", "factura", "resumen", "digitalizacion", "biblioteca", "stacked", "papers"],
  // 7: Robots / Androides / Agentes IA
  ["robot", "robots", "androide", "humanoide", "asistente", "agente", "ia", "inteligencia", "artificial", "coreagent", "nucleo", "bot"],
  // 8: Oficinas de lujo / Corporativo / Ejecutivo
  ["oficina", "lujo", "rascacielos", "despacho", "ejecutivo", "ceo", "junta", "directiva", "cristal", "marmol", "corporativo", "empresa", "b2b", "office"],
  // 9: Productividad / Tiempo / Enfoque
  ["productividad", "tiempo", "ahorro", "enfoque", "eficiencia", "velocidad", "rapidez", "rendimiento", "agenda", "prioridad", "deep work", "productivity"],
  // 10: Google Workspace (Drive, Gmail, Calendar, Sheets, Docs)
  ["google", "workspace", "gmail", "correo", "email", "calendar", "calendario", "citas", "drive", "sheets", "hojas", "docs", "nube", "cloud"],
  // 11: Voz / Telegram / Mensajería instantánea
  ["voz", "telegram", "audio", "comando", "mensaje", "chat", "manos libres", "movil", "smartphone", "voice"],
  // 12: Publicidad / Anuncios / Producción
  ["publicidad", "anuncio", "anuncios", "estudio", "produccion", "camara", "valla", "megafono", "lanzamiento", "copywriting", "guion", "advertising"],
  // 13: Estrategia de Marketing / Embudo / Segmentación
  ["marketing", "estrategia", "embudo", "funnel", "conversion", "segmentacion", "target", "posicionamiento", "inbound", "leads", "clientes", "marca"],
  // 14: Aceptación / Aprobación / Satisfacción cliente
  ["aceptacion", "aprobacion", "aprobado", "cliente", "satisfecho", "estrellas", "testimonio", "aplauso", "acuerdo", "cierre", "venta", "acceptance", "approval"],
  // 15: Redes Sociales / Viralidad / Creadores
  ["redes", "sociales", "social", "reels", "shorts", "tiktok", "instagram", "linkedin", "youtube", "viral", "creador", "podcast", "comunidad", "engagement"],
  // 16: Analítica / ROI / Métricas / Crecimiento
  ["analitica", "roi", "metricas", "grafico", "crecimiento", "ventas", "datos", "optimizacion", "dashboard", "radar", "escalar", "analytics", "growth"],
  // 17: Eva / Clases escolares / Colegio / Aula
  ["eva", "clase", "clases", "escolar", "escolares", "colegio", "escuela", "aula", "alumnos", "estudiantes", "niños", "niño", "niña", "infantil", "school"],
  // 18: Profesora humana / Logopeda / Terapia del habla
  ["profesora", "maestra", "humana", "docente", "logopeda", "terapeuta", "terapia", "habla", "pronunciacion", "lectura", "empatia", "paciencia", "teacher"],
  // 19: Profesora robot / Tutor IA infantil
  ["robot", "tutor", "educativo", "compañero", "amigable", "dulzura", "inclusion", "futuro", "pizarra"],
  // 20: Juegos educativos / Cuentos / Fantasía / Ternura
  ["juego", "juegos", "diversion", "cuento", "cuentos", "magia", "ternura", "xilofono", "puzzle", "rompecabezas", "aventura", "recompensa", "bosque", "oceano"],
  // 21: Cosmos / Ciencia / Tecnología abstracta
  ["cosmos", "espacio", "universo", "planetas", "holograma", "cuantico", "energia", "prisma", "luz"],
  // 22: Colaboración / Equipo / Alianza
  ["equipo", "colaboracion", "alianza", "reunion", "juntos", "union", "amistad", "padres", "familia"],
  // 23: Seguridad / Privacidad / Confianza
  ["seguridad", "privacidad", "confianza", "boveda", "proteccion", "respaldo", "garantia", "verificacion"],
];

const AXIS_WORD_MAP = new Map<string, number[]>();
for (let axisIdx = 0; axisIdx < SEMANTIC_AXES.length; axisIdx++) {
  for (const word of SEMANTIC_AXES[axisIdx]) {
    const norm = normalizeToken(word);
    const list = AXIS_WORD_MAP.get(norm) || [];
    list.push(axisIdx);
    AXIS_WORD_MAP.set(norm, list);
  }
}

export function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

function fnv1aHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function computeSemanticVector(text: string): number[] {
  const vec = new Float64Array(VECTOR_DIM);
  const tokens = tokenize(text);

  for (const tok of tokens) {
    // 1. Semantic axis projection (dimensions 0..23) with high weight
    const exactAxes = AXIS_WORD_MAP.get(tok);
    if (exactAxes) {
      for (const ax of exactAxes) {
        vec[ax] += 2.4;
      }
    } else {
      // Partial prefix match for inflections (e.g. automatizando -> automatizacion)
      for (const [key, axes] of AXIS_WORD_MAP.entries()) {
        if (key.length >= 4 && (tok.startsWith(key.slice(0, 5)) || key.startsWith(tok.slice(0, 5)))) {
          for (const ax of axes) {
            vec[ax] += 1.1;
          }
        }
      }
    }

    // 2. Signed feature hashing into dimensions 24..127 (word + 3-char subword n-grams)
    const bucketOffset = 24;
    const bucketCount = VECTOR_DIM - bucketOffset;
    const h = fnv1aHash(tok);
    const idx = bucketOffset + (h % bucketCount);
    const sign = (h & 1) === 0 ? 1 : -1;
    vec[idx] += sign * 1.0;

    if (tok.length >= 4) {
      for (let i = 0; i <= tok.length - 3; i++) {
        const tri = tok.slice(i, i + 3);
        const th = fnv1aHash(tri);
        const tidx = bucketOffset + (th % bucketCount);
        const tsign = (th & 1) === 0 ? 1 : -1;
        vec[tidx] += tsign * 0.35;
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

