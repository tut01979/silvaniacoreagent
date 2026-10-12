import fs from "fs";
import path from "path";

export type ProductBrand = "coreagent" | "eva" | "marketing";

export interface VisualCatalogItem {
  id: string;
  product: ProductBrand;
  category: string;
  subcategory: string;
  title: string;
  keywords: string[];
  prompt: string;
  suggestedAspectRatio: "16:9" | "9:16";
  commercialObjective: string;
}

export interface SelectedSceneVisual {
  product: ProductBrand;
  category: string;
  localImagePath: string | null;
  catalogPrompt: string;
  brandBadge: string;
  accentColor: string;
  catalogItem?: VisualCatalogItem;
}

// Carga perezosa del catálogo de 300 prompts
let cachedCatalog: VisualCatalogItem[] | null = null;
function getCatalog(): VisualCatalogItem[] {
  if (cachedCatalog) return cachedCatalog;
  try {
    const catalogPath = path.resolve(process.cwd(), "src/marketing/assets/visualLibraryCatalog.json");
    if (fs.existsSync(catalogPath)) {
      const data = fs.readFileSync(catalogPath, "utf-8");
      cachedCatalog = JSON.parse(data) as VisualCatalogItem[];
      return cachedCatalog;
    }
  } catch (err: any) {
    console.warn("⚠️ [VisualAssetSelector] Error leyendo visualLibraryCatalog.json:", err.message);
  }
  return [];
}

export const visualAssetSelector = {
  /**
   * Clasifica con precisión matemática el producto/agente del tema o guion.
   * Garantiza que Eva NUNCA se mezcle con Telegram ni Google Workspace.
   */
  detectProduct(text: string): ProductBrand {
    const t = (text || "").toLowerCase();

    // 1. Detección estricta de EVA (Salud vocal, logopedia, infancia, clínica web)
    if (
      /\beva\b|logoped|habla|fonem|infantil|niñ[oa]|hij[oa]|terapia|cl[ií]nic|rehabilitaci|tartamud|dislali|articulaci|pedi[aá]tr|pronunci|praxia|lenguaje/i.test(
        t
      )
    ) {
      return "eva";
    }

    // 2. Detección de MARKETING STUDIO (Agencia, vídeos, métricas, creadores)
    if (
      /marketing|cmo|creador|social|youtube|tiktok|viral|anuncio|copywriter|creaci[oó]n|campa[ñn]a|podcast|estudio|hitl|retenci[oó]n|growth|audiencia/i.test(
        t
      )
    ) {
      return "marketing";
    }

    // 3. Por defecto: SILVANIA COREAGENT (Asistente ejecutivo en Telegram con Google Workspace)
    return "coreagent";
  },

  /**
   * Identifica la categoría visual dentro del producto según las palabras clave de la escena.
   */
  detectCategory(product: ProductBrand, text: string, sceneIndex: number = 1): string {
    const t = (text || "").toLowerCase();

    if (product === "eva") {
      if (/fonema|vocal|sonido|pronunci|boca|lengua|articul/i.test(t)) return "phonemes";
      if (/tablet|juego|pantalla|app|casa|hogar|navegador/i.test(t)) return "child_session";
      if (/padres|madre|familia|consulta|informe|progreso/i.test(t)) return "family_progress";
      if (/privacidad|local|seguridad|onda|ac[uú]stic|cero|nube/i.test(t)) return "clinical_web";
      return "speech_therapy";
    }

    if (product === "marketing") {
      if (/estudio|camara|rodaje|microfono|luces|set/i.test(t)) return "video_studio";
      if (/guion|timeline|davinci|montaje|edici[oó]n|storyboard/i.test(t)) return "content_creation";
      if (/analitica|grafic|kpi|crecimiento|retenci|dashboard|conversion/i.test(t)) return "analytics_growth";
      if (/tiktok|reels|shorts|viral|redes|audiencia/i.test(t)) return "social_channels";
      return "podcast";
    }

    // Silvania CoreAgent
    if (/calendar|agenda|reuni[oó]n|cita|evento|fecha/i.test(t)) return "calendar";
    if (/sheet|hoja|gasto|excel|tabla|balance|presupuesto|contabilidad|caja/i.test(t)) return "sheets";
    if (/gmail|correo|email|inbox|bandeja|borrador|triage/i.test(t)) return "gmail";
    if (/telegram|chat|mensaje|voz|audio|nota|bot/i.test(t)) return "telegram";
    return "executive";
  },

  /**
   * Obtiene la ruta base del almacén de imágenes locales para el producto y categoría.
   */
  getAssetsDirectory(product: ProductBrand, category?: string): string {
    const base = path.resolve(process.cwd(), "src/marketing/assets/visuals", product);
    return category ? path.join(base, category) : base;
  },

  /**
   * Busca archivos de imagen reales existentes (.jpg, .jpeg, .png, .webp) en el directorio.
   */
  findLocalImageFiles(product: ProductBrand, category?: string): string[] {
    const targetDir = this.getAssetsDirectory(product, category);
    if (!fs.existsSync(targetDir)) return [];

    try {
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      const validExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
      const images: string[] = [];

      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (validExtensions.has(ext)) {
            images.push(path.join(targetDir, entry.name));
          }
        } else if (entry.isDirectory() && !category) {
          // Búsqueda recursiva de 1 nivel si no se especificó categoría
          const subImages = this.findLocalImageFiles(product, entry.name);
          images.push(...subImages);
        }
      }
      return images;
    } catch (err: any) {
      console.warn(`⚠️ [VisualAssetSelector] Error leyendo directorio ${targetDir}:`, err.message);
      return [];
    }
  },

  /**
   * Selecciona el activo visual y metadatos de diseño para una escena concreta.
   * Evita repetición entre escenas y garantiza coherencia absoluta de marca.
   */
  selectAssetForScene(options: {
    product?: ProductBrand;
    topic?: string;
    sceneText?: string;
    sceneIndex?: number;
    totalScenes?: number;
  }): SelectedSceneVisual {
    const topic = options.topic || "";
    const sceneText = options.sceneText || "";
    const sceneIndex = Math.max(1, options.sceneIndex || 1);
    const totalScenes = Math.max(1, options.totalScenes || 3);

    // 1. Detección o asignación de producto
    const product = options.product || this.detectProduct(`${topic} ${sceneText}`);
    const category = this.detectCategory(product, `${topic} ${sceneText}`, sceneIndex);

    // 2. Metadatos de diseño específicos por producto
    let brandBadge = "SILVANIA COREAGENT · TELEGRAM";
    let accentColor = "#38BDF8";

    if (product === "eva") {
      brandBadge = "EVA · TERAPIA DEL HABLA Y VOZ";
      accentColor = "#2DD4BF"; // Turquesa clínico
    } else if (product === "marketing") {
      brandBadge = "SILVANIA MARKETING STUDIO";
      accentColor = "#A855F7"; // Púrpura de agencia
    }

    // 3. Búsqueda de imagen local real
    const localImages = this.findLocalImageFiles(product, category);
    let chosenImagePath: string | null = null;

    if (localImages.length > 0) {
      // Reparto uniforme sin repetir si hay suficientes imágenes
      const imgIndex = (sceneIndex - 1) % localImages.length;
      chosenImagePath = localImages[imgIndex];
    } else {
      // Si la categoría específica no tiene fotos, buscar en cualquier categoría del mismo producto
      const allProductImages = this.findLocalImageFiles(product);
      if (allProductImages.length > 0) {
        const imgIndex = (sceneIndex - 1) % allProductImages.length;
        chosenImagePath = allProductImages[imgIndex];
      }
    }

    // 4. Búsqueda del prompt del catálogo comercial de 300 ítems
    const catalog = getCatalog();
    const productItems = catalog.filter(c => c.product === product);
    const categoryItems = productItems.filter(c => c.category === category);
    const pool = categoryItems.length > 0 ? categoryItems : productItems;

    let catalogItem: VisualCatalogItem | undefined;
    let catalogPrompt = "";

    if (pool.length > 0) {
      const promptIdx = (sceneIndex - 1) % pool.length;
      catalogItem = pool[promptIdx];
      catalogPrompt = catalogItem.prompt;
    } else {
      catalogPrompt = `High-end commercial 8k photography for ${product} (${category}), cinematic lighting, photorealistic, no text`;
    }

    return {
      product,
      category,
      localImagePath: chosenImagePath,
      catalogPrompt,
      brandBadge,
      accentColor,
      catalogItem,
    };
  },
};
