import fs from "fs";
import path from "path";

export type ProductBrand =
  | "coreagent"
  | "eva"
  | "marketing"
  | "fantasy_tales"
  | "cosmos"
  | "scifi_holograms"
  | "faith_bible"
  | "nature_climates"
  | "emotions";

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

// Carga perezosa del catálogo de prompts
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
   * Clasifica el producto o universo temático de forma universal:
   * Cuentos infantiles/Pixar, Cosmos/Aliens, Ciencia/Hologramas, Biblia/Fe,
   * Naturaleza/Climas, Emociones, CoreAgent, Eva o Marketing Studio.
   */
  detectProduct(text: string): ProductBrand {
    const t = (text || "").toLowerCase();

    // 1. Cuentos infantiles, fábulas, fantasía y animación tipo Pixar
    if (
      /cuento|f[aá]bula|fantas[ií]a|pixar|disney|m[aá]gic|drag[oó]n|hadas|castillo|princesa|reino|hab[ií]a una vez|infantil.*historia|historia.*niñ/i.test(
        t
      )
    ) {
      return "fantasy_tales";
    }

    // 2. Cosmos, espacio, planetas, aliens y astronomía
    if (
      /alien|extraterrestre|planeta|universo|cosmos|galaxia|nebulosa|astronom|marte|j[uú]piter|saturno|luna|agujero negro|interestelar|v[ií]a l[aá]ctea|telescopio/i.test(
        t
      )
    ) {
      return "cosmos";
    }

    // 3. Ciencia ficción, tecnología futurista y hologramas 3D
    if (
      /holograma|pantalla.*3d|cu[aá]ntic|matrix|cibern[eé]tic|robot|futuro.*205|futurista|inteligencia artificial.*futuro|ciencia.*ficci[oó]n/i.test(
        t
      )
    ) {
      return "scifi_holograms";
    }

    // 4. Cristianismo, la Biblia, fe y espiritualidad
    if (
      /biblia|b[ií]blic|cristian|dios|jes[uú]s|cristo|fe\b|evangelio|religi[oó]n|sagrad|vers[ií]culo|mois[eé]s|israel|oraci[oó]n|espiritual|salmo/i.test(
        t
      )
    ) {
      return "faith_bible";
    }

    // 5. Naturaleza salvaje, paisajes extremos y climas
    if (
      /tormenta|rayo|rel[aá]mpago|aurora.*boreal|volc[aá]n|oc[eé]ano|monta[ñn]a|clima|paisaje|naturaleza|glaciar|desierto|tsunami|selva/i.test(
        t
      )
    ) {
      return "nature_climates";
    }

    // 6. Psicología, mente humana y emociones
    if (
      /emoci[oó]n|psicolog|ansiedad|mente\b|resiliencia|superaci[oó]n|autoestima|paz interior|tristeza|felicidad|estoic/i.test(
        t
      )
    ) {
      return "emotions";
    }

    // 7. Eva Agent: Salud vocal, logopedia, terapia del habla pediátrica
    if (
      /\beva\b|logoped|habla.*terapia|terapia.*habla|fonem|dislalia|tartamud|articulaci[oó]n.*vocal|praxia/i.test(
        t
      )
    ) {
      return "eva";
    }

    // 8. Marketing Studio: Creación de contenidos, podcast, YouTube, métricas
    if (
      /marketing|cmo|creador|social.*media|youtube|tiktok|viral|anuncio|copywriter|hitl|retenci[oó]n.*audiencia/i.test(
        t
      )
    ) {
      return "marketing";
    }

    // 9. Por defecto: Silvania CoreAgent (Productividad ejecutiva en Telegram)
    return "coreagent";
  },

  /**
   * Identifica la subcategoría visual según palabras clave
   */
  detectCategory(product: ProductBrand, text: string, sceneIndex: number = 1): string {
    const t = (text || "").toLowerCase();

    if (product === "fantasy_tales") {
      if (/drag[oó]n|criatura|animal|zorro/i.test(t)) return "characters";
      if (/castillo|reino|palacio/i.test(t)) return "castles";
      return "magic_worlds";
    }

    if (product === "cosmos") {
      if (/alien|extraterrestre|nave/i.test(t)) return "aliens";
      if (/planeta|marte|luna/i.test(t)) return "planets";
      return "deep_space";
    }

    if (product === "scifi_holograms") {
      if (/holograma|pantalla/i.test(t)) return "holograms";
      if (/robot|ia|circuito/i.test(t)) return "cybernetics";
      return "future_lab";
    }

    if (product === "faith_bible") {
      if (/desierto|tierra santa|israel/i.test(t)) return "holy_land";
      if (/escritura|pergamino|libro/i.test(t)) return "scriptures";
      return "celestial_light";
    }

    if (product === "nature_climates") {
      if (/tormenta|rayo|rel[aá]mpago/i.test(t)) return "storms";
      if (/aurora|polar/i.test(t)) return "auroras";
      return "mountains_oceans";
    }

    if (product === "emotions") {
      if (/calma|paz|seren/i.test(t)) return "peace";
      if (/fuerza|resilien|determin/i.test(t)) return "resilience";
      return "wonder";
    }

    if (product === "eva") {
      if (/fonema|vocal|sonido|pronunci|boca|lengua/i.test(t)) return "phonemes";
      if (/tablet|juego|pantalla|app|casa/i.test(t)) return "child_session";
      if (/padres|madre|familia|consulta/i.test(t)) return "family_progress";
      if (/privacidad|local|seguridad/i.test(t)) return "clinical_web";
      return "speech_therapy";
    }

    if (product === "marketing") {
      if (/estudio|camara|rodaje|microfono/i.test(t)) return "video_studio";
      if (/guion|timeline|montaje|edici[oó]n/i.test(t)) return "content_creation";
      if (/analitica|grafic|kpi|crecimiento/i.test(t)) return "analytics_growth";
      if (/tiktok|reels|shorts|viral/i.test(t)) return "social_channels";
      return "podcast";
    }

    // CoreAgent
    if (/calendar|agenda|reuni[oó]n|cita/i.test(t)) return "calendar";
    if (/sheet|hoja|gasto|excel|balance/i.test(t)) return "sheets";
    if (/gmail|correo|email|inbox/i.test(t)) return "gmail";
    if (/telegram|chat|mensaje|voz/i.test(t)) return "telegram";
    return "executive";
  },

  /**
   * Obtiene la ruta del directorio de imágenes
   */
  getAssetsDirectory(product: ProductBrand, category?: string): string {
    const base = path.resolve(process.cwd(), "src/marketing/assets/visuals", product);
    return category ? path.join(base, category) : base;
  },

  /**
   * Busca archivos de imagen reales (.jpg, .jpeg, .png, .webp)
   */
  findLocalImageFiles(product: ProductBrand, category?: string): string[] {
    const targetDir = this.getAssetsDirectory(product, category);
    if (!fs.existsSync(targetDir)) {
      // Si la subcarpeta directa no existe, buscar en la carpeta raíz del producto
      const productRoot = path.resolve(process.cwd(), "src/marketing/assets/visuals", product);
      if (fs.existsSync(productRoot)) {
        return this.searchDirectoryImages(productRoot);
      }
      return [];
    }
    return this.searchDirectoryImages(targetDir);
  },

  searchDirectoryImages(dirPath: string): string[] {
    const validExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
    const images: string[] = [];

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (validExtensions.has(ext)) {
            images.push(fullPath);
          }
        } else if (entry.isDirectory()) {
          images.push(...this.searchDirectoryImages(fullPath));
        }
      }
    } catch (err: any) {
      console.warn(`⚠️ [VisualAssetSelector] Error leyendo directorio ${dirPath}:`, err.message);
    }
    return images;
  },

  /**
   * Selecciona el activo visual y metadatos de diseño para una escena concreta
   */
  selectAssetForScene(options: {
    product?: ProductBrand;
    topic?: string;
    sceneText?: string;
    sceneIndex?: number;
    totalScenes?: number;
    usedImages?: string[];
  }): SelectedSceneVisual {
    const topic = options.topic || "";
    const sceneText = options.sceneText || "";
    const sceneIndex = Math.max(1, options.sceneIndex || 1);
    const totalScenes = Math.max(1, options.totalScenes || 3);

    // 1. Detección universal del universo temático
    const product = options.product || this.detectProduct(`${topic} ${sceneText}`);
    const category = this.detectCategory(product, `${topic} ${sceneText}`, sceneIndex);

    // 2. Metadatos de diseño y badge por universo
    let brandBadge = "SILVANIA COREAGENT · TELEGRAM";
    let accentColor = "#38BDF8";

    switch (product) {
      case "fantasy_tales":
        brandBadge = "✨ CUENTO INFANTIL · AVENTURA MÁGICA";
        accentColor = "#F59E0B";
        break;
      case "cosmos":
        brandBadge = "🌌 COSMOS & UNIVERSO · ASTRONOMÍA";
        accentColor = "#38BDF8";
        break;
      case "scifi_holograms":
        brandBadge = "⚡ CIENCIA & HOLOGRAMAS 3D";
        accentColor = "#06B6D4";
        break;
      case "faith_bible":
        brandBadge = "🕊️ RELATOS BÍBLICOS · FE & ESPERANZA";
        accentColor = "#FBBF24";
        break;
      case "nature_climates":
        brandBadge = "🌿 NATURALEZA & CLIMAS EXTREMOS";
        accentColor = "#10B981";
        break;
      case "emotions":
        brandBadge = "🧠 MENTE & EMOCIONES HUMANAS";
        accentColor = "#A855F7";
        break;
      case "eva":
        brandBadge = "EVA · TERAPIA DEL HABLA Y VOZ";
        accentColor = "#2DD4BF";
        break;
      case "marketing":
        brandBadge = "SILVANIA MARKETING STUDIO";
        accentColor = "#C084FC";
        break;
      case "coreagent":
      default:
        brandBadge = "SILVANIA COREAGENT · TELEGRAM";
        accentColor = "#38BDF8";
        break;
    }

    // 3. Búsqueda de imagen local real con concordancia inteligente de personajes y temas
    const allUniverseImages = this.findLocalImageFiles(product);
    const combinedText = `${topic} ${sceneText}`.toLowerCase();
    const sceneOnly = (sceneText || "").toLowerCase();
    // Si la escena tiene texto concreto, priorizarlo para no mezclar roles del tema global
    const textToMatch = sceneOnly.length > 5 ? sceneOnly : combinedText;

    let chosenImagePath: string | null = null;
    let matchedImages: string[] = [];

    if (product === "fantasy_tales") {
      const wantsDragon = /drag[oó]n|fuego|alas/i.test(textToMatch);
      const wantsPrincess = /princesa|pr[ií]ncipe|reina|doncella/i.test(textToMatch);
      const wantsBaby = /beb[eé]|peque[ñn]|chispa|diminut/i.test(textToMatch);
      const wantsFlight = /volar|vuelo|cielo|horizonte|alas grandes/i.test(textToMatch);

      if (wantsDragon && wantsPrincess) {
        matchedImages = allUniverseImages.filter(p => /princess_and_dragon|flight/i.test(p));
      } else if (wantsDragon && wantsBaby) {
        matchedImages = allUniverseImages.filter(p => /dragon_baby/i.test(p));
      } else if (wantsDragon && wantsFlight) {
        matchedImages = allUniverseImages.filter(p => /dragon_kingdom_flight|dragon_baby/i.test(p));
      } else if (wantsDragon) {
        matchedImages = allUniverseImages.filter(p => /dragon/i.test(p));
      } else if (wantsPrincess) {
        matchedImages = allUniverseImages.filter(p => /princess/i.test(p));
      } else if (/castillo|fortaleza|palacio/i.test(textToMatch)) {
        matchedImages = allUniverseImages.filter(p => /castle/i.test(p));
      } else if (/zorro|animal|amigo/i.test(textToMatch)) {
        matchedImages = allUniverseImages.filter(p => /fox|wonderland/i.test(p));
      }
    } else if (product === "cosmos") {
      if (/alien|extraterrestre|vida/i.test(combinedText)) {
        matchedImages = allUniverseImages.filter(p => /alien/i.test(p));
      } else if (/tierra|[oó]rbita|planeta/i.test(combinedText)) {
        matchedImages = allUniverseImages.filter(p => /orbit|earth/i.test(p));
      } else if (/nebulosa|galaxia|v[ií]a l[aá]ctea|estrellas/i.test(combinedText)) {
        matchedImages = allUniverseImages.filter(p => /nebula|galaxy/i.test(p));
      }
    } else if (product === "scifi_holograms") {
      if (/holograma|pantalla|matriz|matrix/i.test(combinedText)) {
        matchedImages = allUniverseImages.filter(p => /hologram|matrix/i.test(p));
      } else if (/red|neural|circuito|procesador|ia/i.test(combinedText)) {
        matchedImages = allUniverseImages.filter(p => /neural|lab/i.test(p));
      } else if (/energ[ií]a|cu[aá]ntic/i.test(combinedText)) {
        matchedImages = allUniverseImages.filter(p => /energy/i.test(p));
      }
    } else if (product === "faith_bible") {
      if (/rayo|luz|cielo|celestial|fe\b|gracia/i.test(combinedText)) {
        matchedImages = allUniverseImages.filter(p => /sunrays|celestial/i.test(p));
      } else if (/monte|desierto|tierra santa|israel|sagrad/i.test(combinedText)) {
        matchedImages = allUniverseImages.filter(p => /mountain|holy/i.test(p));
      }
    } else if (product === "nature_climates") {
      if (/tormenta|rayo|rel[aá]mpago/i.test(combinedText)) {
        matchedImages = allUniverseImages.filter(p => /storm|lightning/i.test(p));
      } else if (/aurora|boreal|polar/i.test(combinedText)) {
        matchedImages = allUniverseImages.filter(p => /aurora/i.test(p));
      } else if (/monta[ñn]a|volc[aá]n|glaciar/i.test(combinedText)) {
        matchedImages = allUniverseImages.filter(p => /mountain/i.test(p));
      }
    } else if (product === "emotions") {
      if (/paz|calma|serenidad/i.test(combinedText)) {
        matchedImages = allUniverseImages.filter(p => /peace/i.test(p));
      } else if (/fuerza|resiliencia|determinaci[oó]n/i.test(combinedText)) {
        matchedImages = allUniverseImages.filter(p => /resilience/i.test(p));
      }
    }

    const usedSet = new Set((options.usedImages || []).map(p => path.resolve(p)));

    // Priorizar imágenes aún no utilizadas en este video
    const availableMatched = matchedImages.filter(p => !usedSet.has(path.resolve(p)));
    const targetPool = availableMatched.length > 0 ? availableMatched : matchedImages;

    if (targetPool.length > 0) {
      const imgIndex = (sceneIndex - 1) % targetPool.length;
      chosenImagePath = targetPool[imgIndex];
    } else {
      const localImages = this.findLocalImageFiles(product, category);
      const availableLocal = localImages.filter(p => !usedSet.has(path.resolve(p)));
      const localPool = availableLocal.length > 0 ? availableLocal : localImages;

      if (localPool.length > 0) {
        const imgIndex = (sceneIndex - 1) % localPool.length;
        chosenImagePath = localPool[imgIndex];
      } else if (allUniverseImages.length > 0) {
        const availableAll = allUniverseImages.filter(p => !usedSet.has(path.resolve(p)));
        const allPool = availableAll.length > 0 ? availableAll : allUniverseImages;
        const imgIndex = (sceneIndex - 1) % allPool.length;
        chosenImagePath = allPool[imgIndex];
      }
    }

    // 4. Prompt descriptivo comercial optimizado
    let catalogPrompt = "";
    if (product === "fantasy_tales") {
      catalogPrompt = "Pixar 3D animated style, Disney Pixar quality render, warm soft volumetric lighting, whimsical magical atmosphere, cute expressive characters, vibrant rich colors, cinematic composition, 8k, no text";
    } else if (product === "cosmos") {
      catalogPrompt = "Cinematic space photography, James Webb telescope view, deep cosmos, glowing nebulae, majestic planetary rings, alien exoplanet horizon, photorealistic 8k, sci-fi grandeur, no text";
    } else if (product === "scifi_holograms") {
      catalogPrompt = "Futuristic technology, translucent 3D holographic computer interface glowing with cyan and purple light, AI neural network matrix, sleek sci-fi minimalism, cinematic 8k, no text";
    } else if (product === "faith_bible") {
      catalogPrompt = "Cinematic biblical epic scene, golden celestial ray of light breaking through dramatic clouds over ancient desert landscape, sacred stones, ancient scriptures, Rembrandt lighting, 8k photorealistic, no text";
    } else if (product === "nature_climates") {
      catalogPrompt = "National Geographic cinematic landscape photography, dramatic lightning storm or glowing green aurora borealis reflecting on water, majestic natural beauty, 8k, ultra-detailed";
    } else if (product === "emotions") {
      catalogPrompt = "Cinematic portrait photography, expressive human eyes and posture conveying deep peace and determination, warm studio rim light, 8k photorealistic, shallow depth of field";
    } else {
      // Buscar en el catálogo precargado para marcas core
      const catalog = getCatalog();
      const productItems = catalog.filter(c => c.product === (product as any));
      const pool = productItems.length > 0 ? productItems : catalog;
      if (pool.length > 0) {
        const promptIdx = (sceneIndex - 1) % pool.length;
        catalogPrompt = pool[promptIdx].prompt;
      } else {
        catalogPrompt = `High-end commercial 8k photography for ${product}, cinematic lighting, photorealistic, no text`;
      }
    }

    return {
      product,
      category,
      localImagePath: chosenImagePath,
      catalogPrompt,
      brandBadge,
      accentColor,
    };
  },
};
