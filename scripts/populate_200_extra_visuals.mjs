import fs from "node:fs";
import path from "node:path";

const VISUALS_ROOT = path.resolve(process.cwd(), "src/marketing/assets/visuals");
const VECTOR_INDEX_PATH = path.resolve(process.cwd(), "src/marketing/assets/visualVectorIndex.json");

const BUCKETS = [
  // ================= COREAGENT (~70) =================
  {
    product: "coreagent",
    category: "productivity_modern",
    prefix: "ca_mod",
    targetCount: 14,
    queries: ["modern computer workspace monitor", "minimalist desk dual monitor", "sleek laptop workspace"],
    titleBase: "Espacio de Trabajo Moderno y Productivo",
    description: "Ordenador modernísimo en escritorio limpio diseñado para máxima productividad ejecutiva.",
    emotions: ["productividad", "eficiencia", "enfoque", "calma"],
    objective: "Mostrar un entorno digital moderno y ágil impulsado por CoreAgent.",
    keywords: ["productividad", "eficiencia", "ordenador moderno", "escritorio", "monitor", "coreagent"],
    attributes: ["ordenadores modernisimos", "productividad", "eficiencia", "oficina moderna", "espacio limpio"],
  },
  {
    product: "coreagent",
    category: "holograms_virtual",
    prefix: "ca_holo",
    targetCount: 14,
    queries: ["hologram futuristic interface", "virtual screen technology", "futuristic digital display"],
    titleBase: "Interfaz Virtual y Holograma Inteligente",
    description: "Pantallas virtuales y hologramas futuristas procesando datos y órdenes en tiempo real.",
    emotions: ["innovacion", "futuro", "asombro", "velocidad"],
    objective: "Representar la inteligencia artificial avanzada y pantallas virtuales de Silvania.",
    keywords: ["holograma", "virtual", "futuro", "interfaz", "ia", "tecnologia"],
    attributes: ["hologramas", "pantallas virtuales", "futurista", "ordenadores virtuales", "tecnologia avanzada"],
  },
  {
    product: "coreagent",
    category: "executives_luxury",
    prefix: "ca_exec",
    targetCount: 16,
    queries: ["executive business meeting modern office", "luxury modern office glass", "business executive conference room"],
    titleBase: "Ejecutivos en Oficina de Lujo y Reunión",
    description: "Directivos en reunión ejecutiva dentro de una oficina moderna de lujo con ventanales.",
    emotions: ["liderazgo", "confianza", "exito", "profesionalidad"],
    objective: "Conectar con directivos, empresarios y reuniones ejecutivas de alto nivel.",
    keywords: ["ejecutivos", "reunion ejecutiva", "oficina de lujo", "directivo", "empresa", "liderazgo"],
    attributes: ["ejecutivos", "reuniones ejecutivas", "oficinas de lujo", "directivos", "corporativo"],
  },
  {
    product: "coreagent",
    category: "robots_computers",
    prefix: "ca_rbot",
    targetCount: 14,
    queries: ["robot working computer", "humanoid robot laptop", "ai robot keyboard"],
    titleBase: "Robot Manejando Ordenador y Sistemas",
    description: "Robot inteligente operando un ordenador y ejecutando tareas automatizadas.",
    emotions: ["eficiencia", "automatizacion", "futuro", "precision"],
    objective: "Visualizar al agente autónomo ejecutando tareas administrativas por el usuario.",
    keywords: ["robot", "ordenador", "automatizacion", "ia", "teclado", "agente"],
    attributes: ["robot manejando ordenador", "robots trabajando", "automatizacion total", "ia ejecutiva"],
  },
  {
    product: "coreagent",
    category: "paperwork_chaos",
    prefix: "ca_paper",
    targetCount: 12,
    queries: ["pile of paper documents office desk", "messy desk stacks of paper", "overflowing paperwork office"],
    titleBase: "Oficina Saturada con Montañas de Documentos",
    description: "Escritorio desbordado por pilas de papeles y documentos antes de automatizar con IA.",
    emotions: ["estres", "saturacion", "caos", "urgencia"],
    objective: "Contrastar el caos documental tradicional frente a la calma digital de CoreAgent.",
    keywords: ["documentos", "papeles", "montañas de papeles", "caos", "burocracia", "antes"],
    attributes: ["oficina con montañas de documentos", "exceso de papeles", "antes vs ahora", "desorden administrativo"],
  },

  // ================= EVA AGENT (~72) =================
  {
    product: "eva",
    category: "kids_playing_school",
    prefix: "eva_play",
    targetCount: 14,
    queries: ["happy children playing school classroom", "preschool kids playing games", "children smiling learning play"],
    titleBase: "Niños Jugando y Pasándolo Bien en el Colegio",
    description: "Niños alegres jugando, riendo y participando en actividades lúdicas en clase.",
    emotions: ["alegria", "diversion", "entusiasmo", "amistad"],
    objective: "Transmitir aprendizaje divertido y ambiente escolar feliz con Eva Agent.",
    keywords: ["niños jugando", "colegio", "diversion", "alegria", "clase", "juego"],
    attributes: ["niños jugando en el colegio", "pasarlo bien", "alegre", "luminosa", "aprendizaje ludico"],
  },
  {
    product: "eva",
    category: "kids_tablets_study",
    prefix: "eva_tab",
    targetCount: 12,
    queries: ["child using tablet learning", "kids tablet studying", "children researching tablet"],
    titleBase: "Niños Investigando y Jugando con Tablet",
    description: "Niños interactuando con una tablet educativa mientras investigan y aprenden jugando.",
    emotions: ["curiosidad", "descubrimiento", "diversion", "autonomia"],
    objective: "Mostrar cómo los niños usan tablets para aprender de forma interactiva con Eva.",
    keywords: ["tablet", "niños", "investigando", "estudiando", "jugando", "educacion"],
    attributes: ["niños con tablet jugando", "investigando", "estudiando", "pantalla interactiva", "aprendizaje digital"],
  },
  {
    product: "eva",
    category: "kids_modern_computers",
    prefix: "eva_comp",
    targetCount: 12,
    queries: ["children computer lab classroom", "students computers modern classroom", "kids learning computer school"],
    titleBase: "Niños en Clase Moderna con Ordenadores",
    description: "Estudiantes en un aula moderna equipada con ordenadores colaborando activamente.",
    emotions: ["modernidad", "entusiasmo", "aprendizaje", "futuro"],
    objective: "Mostrar colegios modernos equipados con tecnología y ordenadores para niños.",
    keywords: ["clase moderna", "ordenadores", "niños", "colegio", "tecnologia", "aula"],
    attributes: ["niños en clases modernas con ordenadores", "aula moderna", "colegio tecnologico", "educacion actual"],
  },
  {
    product: "eva",
    category: "kids_paper_painting",
    prefix: "eva_art",
    targetCount: 12,
    queries: ["child drawing paper pencil", "kids painting art classroom", "child writing notebook colored pencils"],
    titleBase: "Niños Estudiando con Papel, Lápiz y Pintura",
    description: "Niños dibujando, pintando y escribiendo con lápices de colores y papel en clase.",
    emotions: ["creatividad", "ternura", "enfoque", "expresion"],
    objective: "Integrar el aprendizaje creativo tradicional con papel, lápiz y pintura.",
    keywords: ["papel", "lapiz", "pintando", "dibujando", "niños", "creatividad"],
    attributes: ["niños estudiando con papel y lapiz", "pintando", "dibujo infantil", "creatividad en clase"],
  },
  {
    product: "eva",
    category: "kids_emotions_happy_angry",
    prefix: "eva_emo",
    targetCount: 10,
    queries: ["happy laughing child portrait", "angry frustrated child studying", "frustrated kid homework"],
    titleBase: "Expresión Emocional Infantil (Alegría y Frustración)",
    description: "Niños expresando emociones auténticas: alegría al lograr un reto o enfado/frustración ante tareas difíciles.",
    emotions: ["alegria", "enfado", "frustracion", "superacion"],
    objective: "Ilustrar cómo Eva detecta emociones y transforma la frustración en alegría.",
    keywords: ["niños felices", "niños enfadados", "emociones", "frustracion", "risa", "superacion"],
    attributes: ["niños felices", "niños enfadados", "emociones infantiles", "antes frustrado despues feliz"],
  },
  {
    product: "eva",
    category: "parents_family_learning",
    prefix: "eva_fam",
    targetCount: 12,
    queries: ["parents child tablet home", "happy family studying together", "family living room smiling"],
    titleBase: "Padres Felices Estudiando con sus Hijos en Casa",
    description: "Padres e hijos compartiendo tiempo de estudio con tablet y reuniones familiares felices.",
    emotions: ["calidez", "confianza", "familia", "alegria"],
    objective: "Conectar con padres que acompañan el aprendizaje de sus hijos en casa.",
    keywords: ["padres felices", "tablet con niños", "reunion familiar", "familia", "hogar", "estudio"],
    attributes: ["padres felices", "padres estudiando en tablet con niños", "reunion familiar", "hogar calido"],
  },

  // ================= MARKETING AGENT (~62) =================
  {
    product: "marketing",
    category: "social_media_campaigns",
    prefix: "mk_soc2",
    targetCount: 16,
    queries: ["social media marketing laptop", "digital marketing analytics screen", "social media strategy desk"],
    titleBase: "Estrategia de Marketing y Redes Sociales",
    description: "Paneles de marketing digital, métricas de crecimiento y gestión de redes sociales.",
    emotions: ["crecimiento", "estrategia", "impacto", "exito"],
    objective: "Representar campañas digitales y crecimiento en redes con Silvania Marketing.",
    keywords: ["marketing", "redes sociales", "campaña", "analitica", "alcance", "digital"],
    attributes: ["marketing digital", "redes sociales", "crecimiento de marca", "estrategia multicanal"],
  },
  {
    product: "marketing",
    category: "person_posting_social",
    prefix: "mk_post",
    targetCount: 16,
    queries: ["person using smartphone social media", "content creator filming phone", "person typing laptop social post"],
    titleBase: "Persona Publicando Contenido en Redes Sociales",
    description: "Creador o profesional publicando contenido en redes sociales desde móvil o portátil.",
    emotions: ["dinamismo", "conexion", "creatividad", "accion"],
    objective: "Mostrar la publicación ágil en redes sociales con aprobación en un clic.",
    keywords: ["publicando", "redes sociales", "smartphone", "creador", "contenido", "post"],
    attributes: ["persona publicando en redes", "creacion de contenido", "movil", "redes activas"],
  },
  {
    product: "marketing",
    category: "clocks_time_urgency",
    prefix: "mk_time",
    targetCount: 16,
    queries: ["digital clock led", "hourglass sand timer", "analog clock hands"],
    titleBase: "Relojes Digitales, de Arena y de Manillas",
    description: "Relojes digitales, relojes de arena y relojes clásicos de manillas simbolizando ahorro de tiempo y urgencia.",
    emotions: ["urgencia", "tiempo", "puntualidad", "ahorro"],
    objective: "Reforzar mensajes sobre ahorrar horas cada semana o aprovechar el momento actual.",
    keywords: ["reloj", "reloj digital", "reloj de arena", "reloj de manillas", "tiempo", "horas"],
    attributes: ["relojes digitales", "reloj de arena", "reloj de manillas", "ahorro de tiempo", "urgencia"],
  },
  {
    product: "marketing",
    category: "robot_marketing_desk",
    prefix: "mk_rbot",
    targetCount: 14,
    queries: ["robot computer keyboard", "ai robot screen desk", "futuristic robot typing"],
    titleBase: "Robot Manejando Ordenador de Marketing",
    description: "Robot de inteligencia artificial manejando un ordenador para diseñar y programar campañas.",
    emotions: ["innovacion", "automatizacion", "eficiencia", "futuro"],
    objective: "Representar a Silvania Marketing Agent trabajando automáticamente para el negocio.",
    keywords: ["robot", "ordenador", "marketing", "ia", "automatizacion", "campañas"],
    attributes: ["robot manejando un ordenador", "marketing autonomo", "ia creativa", "automatizacion de redes"],
  },
];

const usedUrls = new Set();

async function fetchOpenverse(query, page = 1) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license_type=commercial&mature=false&page_size=20&page=${page}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SilvaniaCoreAgent/1.0 (https://silvania.ai)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return results
      .filter((r) => r.url && (r.width || 900) >= 700 && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(r.url))
      .map((r) => ({ url: r.url, title: r.title || "" }));
  } catch {
    return [];
  }
}

async function fetchWikimedia(query) {
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|size|mime&format=json`;
  try {
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "SilvaniaCoreAgent/1.0 (https://silvania.ai)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {});
    const out = [];
    for (const p of pages) {
      const info = p?.imageinfo?.[0];
      if (!info?.url) continue;
      if (!/^image\/(jpeg|png|webp)$/i.test(info.mime || "")) continue;
      if ((info.width || 0) < 700) continue;
      out.push({ url: info.url, title: p.title || "" });
    }
    return out;
  } catch {
    return [];
  }
}

async function downloadImage(url, destPath) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SilvaniaCoreAgent/1.0 (https://silvania.ai)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 10000) return false;
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, buf);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const existingIndex = JSON.parse(fs.readFileSync(VECTOR_INDEX_PATH, "utf8"));
  const existingIds = new Set(existingIndex.map((x) => x.id));
  const newEntries = [];
  let totalDownloaded = 0;

  for (const bucket of BUCKETS) {
    const pool = [];
    for (const q of bucket.queries) {
      const ov = await fetchOpenverse(q, 1);
      pool.push(...ov);
      if (pool.length < bucket.targetCount * 2) {
        const wm = await fetchWikimedia(q);
        pool.push(...wm);
      }
    }

    let count = 0;
    for (const candidate of pool) {
      if (count >= bucket.targetCount) break;
      if (usedUrls.has(candidate.url)) continue;
      usedUrls.add(candidate.url);

      const num = String(count + 1).padStart(2, "0");
      const id = `${bucket.prefix}_${num}`;
      if (existingIds.has(id)) {
        count++;
        continue;
      }

      const relPath = `src/marketing/assets/visuals/${bucket.product}/${bucket.category}/${id}.jpg`;
      const absPath = path.resolve(process.cwd(), relPath);
      const ok = await downloadImage(candidate.url, absPath);
      if (!ok) continue;

      const cleanCandidateTitle = String(candidate.title || "")
        .replace(/^File:/i, "")
        .replace(/\.(jpg|jpeg|png|webp)$/i, "")
        .slice(0, 60)
        .trim();

      newEntries.push({
        id,
        relPath,
        product: bucket.product,
        category: bucket.category,
        title: `${bucket.titleBase} #${num}`,
        description: cleanCandidateTitle
          ? `${bucket.description} (${cleanCandidateTitle})`
          : bucket.description,
        emotions: bucket.emotions,
        objective: bucket.objective,
        keywords: bucket.keywords,
        attributes: bucket.attributes,
        copyrightStatus: "openverse_wikimedia_commercial",
      });

      existingIds.add(id);
      count++;
      totalDownloaded++;
      console.log(`✅ [${totalDownloaded}] ${relPath}`);
    }
    console.log(`📦 Bucket ${bucket.product}/${bucket.category}: ${count}/${bucket.targetCount}`);
  }

  const merged = [...existingIndex, ...newEntries];
  fs.writeFileSync(VECTOR_INDEX_PATH, JSON.stringify(merged, null, 2), "utf8");
  console.log(`\n🎉 Completado: ${totalDownloaded} nuevas imágenes descargadas e indexadas. Total en memoria vectorial: ${merged.length}`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});

