import fs from "fs";
import path from "path";
import { marketingDb } from "../database.js";
import { computeSemanticVector, cosineSimilarity, normalizeToken } from "./semanticVectorEngine.js";

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

export interface VisualVectorChunk {
  id: string;
  relPath: string;
  product: ProductBrand | "shared";
  category: string;
  title: string;
  description: string;
  emotions: string[];
  objective: string;
  keywords: string[];
  attributes?: string[];
  copyrightStatus?: string;
  vector?: number[];
}

export interface SelectedSceneVisual {
  product: ProductBrand;
  category: string;
  localImagePath: string | null;
  catalogPrompt: string;
  brandBadge: string;
  accentColor: string;
  catalogItem?: VisualCatalogItem;
  assetId?: string;
  title?: string;
  emotions?: string[];
  objective?: string;
  matchReason?: string;
  score?: number;
  usageStats?: { total: number; unused: number; used: number; cycleResetTriggered: boolean };
}

const BRAND_CONFIG: Record<ProductBrand, { badge: string; accent: string }> = {
  coreagent: { badge: "SILVANIA COREAGENT", accent: "#06b6d4" },
  eva: { badge: "EVA EDUCACIÓN", accent: "#a855f7" },
  marketing: { badge: "SILVANIA MARKETING", accent: "#f43f5e" },
  fantasy_tales: { badge: "CUENTOS Y FANTASÍA", accent: "#ec4899" },
  cosmos: { badge: "COSMOS Y CIENCIA", accent: "#3b82f6" },
  scifi_holograms: { badge: "FUTURO Y HOLOGRAMAS", accent: "#0ea5e9" },
  faith_bible: { badge: "VALORES Y LUZ", accent: "#f59e0b" },
  nature_climates: { badge: "NATURALEZA", accent: "#10b981" },
  emotions: { badge: "CONEXIÓN HUMANA", accent: "#f97316" },
};

let cachedCatalog: VisualCatalogItem[] | null = null;
function getCatalog(): VisualCatalogItem[] {
  if (cachedCatalog) return cachedCatalog;
  try {
    const catalogPath = path.resolve(process.cwd(), "src/marketing/assets/visualLibraryCatalog.json");
    if (fs.existsSync(catalogPath)) {
      cachedCatalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8")) as VisualCatalogItem[];
      return cachedCatalog;
    }
  } catch (err: any) {
    console.warn("⚠️ [VisualAssetSelector] Error cargando visualLibraryCatalog.json:", err.message);
  }
  cachedCatalog = [];
  return [];
}

let cachedVectorChunks: VisualVectorChunk[] | null = null;
function getVectorChunks(): VisualVectorChunk[] {
  if (cachedVectorChunks) return cachedVectorChunks;
  const indexPath = path.resolve(process.cwd(), "src/marketing/assets/visualVectorIndex.json");
  if (fs.existsSync(indexPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as VisualVectorChunk[];
      cachedVectorChunks = raw.filter((c) => fs.existsSync(path.resolve(process.cwd(), c.relPath)));
      if (cachedVectorChunks.length > 0) {
        marketingDb.syncVisualAssets(
          cachedVectorChunks.map((c) => ({
            id: c.id,
            product: String(c.product),
            category: c.category,
            relPath: c.relPath,
          }))
        );
      }
      return cachedVectorChunks;
    } catch (err: any) {
      console.warn("⚠️ [VisualAssetSelector] Error cargando visualVectorIndex.json:", err.message);
    }
  }
  cachedVectorChunks = [];
  return cachedVectorChunks;
}

export const visualAssetSelector = {
  reloadIndex(): void {
    cachedVectorChunks = null;
    cachedCatalog = null;
  },

  detectProduct(topic: string, scriptText?: string): ProductBrand {
    return this.detectProductFromTopic(topic, scriptText);
  },

  detectCategory(product: ProductBrand, text: string, extraArg?: string | number): string {
    const t = normalizeToken(`${text} ${extraArg ?? ""}`);
    if (product === "coreagent") {
      if (/(documento|papel|archivo|pdf|carpeta)/.test(t)) return "stacked_documents";
      if (/(robot|bot|androide)/.test(t)) return "robots";
      if (/(oficina|lujo|despacho|rascacielos)/.test(t)) return "luxury_offices";
      if (/(google|workspace|gmail|calendar|drive|sheets)/.test(t)) return "google_workspace";
      if (/(productividad|tiempo|enfoque)/.test(t)) return "productivity";
      return "automation";
    }
    if (product === "marketing") {
      if (/(aceptacion|aprobacion|cliente|estrella|sonrisa)/.test(t)) return "acceptance_approval";
      if (/(redes|social|reels|tiktok|instagram|viral)/.test(t)) return "social_media";
      if (/(analitica|roi|metricas|grafico|crecimiento)/.test(t)) return "analytics_campaigns";
      if (/(estrategia|embudo|segmentacion)/.test(t)) return "marketing_strategy";
      return "advertising";
    }
    if (product === "eva") {
      if (/(robot|tutor)/.test(t)) return "robot_teacher";
      if (/(profesora|maestra|logopeda|humana|terapia)/.test(t)) return "human_teacher";
      if (/(juego|diversion|cuento|puzzle|bloque)/.test(t)) return "learning_games";
      return "school_classes";
    }
    return "general";
  },

  detectProductFromTopic(topic: string, scriptText?: string): ProductBrand {
    const full = normalizeToken(`${topic} ${scriptText || ""}`);
    if (/(eva|colegio|escuela|aula|profesora|logoped|infantil|habla|niño|nino|lectura|cuento)/.test(full)) {
      return "eva";
    }
    if (/(marketing|publicidad|anuncio|redes|viral|campana|embudo|roi|aceptacion|reels|tiktok)/.test(full)) {
      return "marketing";
    }
    if (/(coreagent|automatiz|workspace|drive|gmail|calendar|sheets|telegram|oficina|robot|documento|papeleo|productividad)/.test(full)) {
      return "coreagent";
    }
    if (/(cosmos|espacio|galaxia|universo)/.test(full)) return "cosmos";
    if (/(biblia|fe|dios|esperanza|luz)/.test(full)) return "faith_bible";
    if (/(naturaleza|bosque|mar|montana)/.test(full)) return "nature_climates";
    if (/(emocion|alegria|tristeza|empatia)/.test(full)) return "emotions";
    return "coreagent";
  },

  getAssetsDirectory(product: ProductBrand, category?: string): string {
    const base = path.resolve(process.cwd(), "src/marketing/assets/visuals", product);
    return category ? path.join(base, category) : base;
  },

  findLocalImageFiles(product: ProductBrand, category?: string): string[] {
    const targetDir = this.getAssetsDirectory(product, category);
    if (!fs.existsSync(targetDir)) {
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
          if (validExtensions.has(path.extname(entry.name).toLowerCase())) {
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
   * Selecciona la mejor imagen usando Memoria Vectorial Semántica + ciclo estricto "sin_usar" -> "usado".
   * Relaciona emociones, producto, objetivo y guion de escena, devolviendo el porqué de la elección.
   */
  selectAssetForScene(options: {
    product?: ProductBrand;
    topic?: string;
    sceneText?: string;
    targetEmotion?: string;
    sceneIndex?: number;
    totalScenes?: number;
    usedImages?: string[];
  }): SelectedSceneVisual {
    const product: ProductBrand =
      options.product || this.detectProductFromTopic(options.topic || "", options.sceneText || "");
    const brandMeta = BRAND_CONFIG[product] || BRAND_CONFIG.coreagent;

    const chunks = getVectorChunks();
    if (chunks.length > 0) {
      let usageMap = marketingDb.getAssetUsageMap("visual");
      const usedInVideo = new Set(
        (options.usedImages || []).map((p) => path.resolve(p).toLowerCase())
      );

      // Filtrar estrictamente por afinidad de producto para no mezclar imágenes de Eva (niños/clases) en vídeos de CoreAgent o viceversa
      const productFilteredChunks = chunks.filter((c) => {
        if (product === "coreagent") return c.product === "coreagent" || c.product === "shared" || c.product === "marketing";
        if (product === "marketing") return c.product === "marketing" || c.product === "shared" || c.product === "coreagent";
        if (product === "eva") return c.product === "eva" || c.product === "shared";
        return c.product === product || c.product === "shared";
      });
      const candidateChunks = productFilteredChunks.length > 0 ? productFilteredChunks : chunks;

      let unusedPool = candidateChunks.filter((c) => {
        const isUnused = (usageMap.get(c.id)?.status ?? "sin_usar") === "sin_usar";
        const abs = path.resolve(process.cwd(), c.relPath).toLowerCase();
        return isUnused && !usedInVideo.has(abs);
      });

      let cycleResetTriggered = false;
      if (unusedPool.length === 0) {
        marketingDb.resetAssetPoolToUnused("visual");
        usageMap = marketingDb.getAssetUsageMap("visual");
        cycleResetTriggered = true;
      }

      // Evaluar TODO el pool del producto no usado aún en este vídeo para que la coherencia semántica
      // con el guion gane siempre, manteniendo un bonus (+1.2) para imágenes "sin_usar"
      const evaluationPool = candidateChunks.filter((c) => {
        const abs = path.resolve(process.cwd(), c.relPath).toLowerCase();
        return !usedInVideo.has(abs);
      });
      const finalPool = evaluationPool.length > 0 ? evaluationPool : candidateChunks;

      const queryText = [
        product,
        options.targetEmotion || "",
        options.topic || "",
        options.sceneText || "",
      ]
        .filter(Boolean)
        .join(" | ");

      const queryVec = computeSemanticVector(queryText);
      const normQuery = normalizeToken(queryText);

      let bestChunk = finalPool[0];
      let bestScore = -Infinity;
      let bestMatchedEmotions: string[] = [];
      let bestMatchedKeywords: string[] = [];

      for (const chunk of finalPool) {
        const chunkVec =
          chunk.vector && chunk.vector.length > 0
            ? chunk.vector
            : computeSemanticVector(
                `${chunk.product} ${chunk.category} ${chunk.title} ${chunk.description} ${chunk.emotions.join(" ")} ${chunk.objective} ${chunk.keywords.join(" ")} ${(chunk.attributes || []).join(" ")}`
              );

        let score = cosineSimilarity(queryVec, chunkVec) * 10;

        // Bonus de rotación para variedad entre vídeos sin sacrificar coherencia del guion
        const isUnused = (usageMap.get(chunk.id)?.status ?? "sin_usar") === "sin_usar";
        if (isUnused) {
          score += 1.2;
        }

        // Afinidad directa con el producto objetivo
        if (chunk.product === product) {
          score += 4.5;
        } else if (chunk.product === "shared") {
          score += 0.4;
        }

        // Afinidad emocional explícita
        const matchedEmotions: string[] = [];
        for (const emo of chunk.emotions) {
          const ne = normalizeToken(emo);
          if (ne && normQuery.includes(ne)) {
            score += 1.4;
            matchedEmotions.push(emo);
          }
        }

        // Afinidad con palabras clave de la escena
        const matchedKeywords: string[] = [];
        for (const kw of chunk.keywords) {
          const nkw = normalizeToken(kw);
          if (nkw.length >= 3 && normQuery.includes(nkw)) {
            score += 0.7;
            matchedKeywords.push(kw);
          }
        }

        // Afinidad con atributos visuales enriquecidos (tono, escenario, estilo)
        for (const attr of chunk.attributes || []) {
          const nattr = normalizeToken(attr.replace(/_/g, " "));
          if (nattr.length >= 3 && normQuery.includes(nattr)) {
            score += 1.1;
            matchedKeywords.push(attr);
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestChunk = chunk;
          bestMatchedEmotions = matchedEmotions;
          bestMatchedKeywords = matchedKeywords;
        }
      }

      console.log(
        `🧠 [VisualVector] Producto=${product.toUpperCase()} -> [${bestChunk.product}/${bestChunk.category}] "${bestChunk.title}" (score=${bestScore.toFixed(2)}, emociones=[${bestMatchedEmotions.join(",")}], kw=[${bestMatchedKeywords.slice(0, 4).join(",")}])`
      );

      const chosenAbsPath = path.resolve(process.cwd(), bestChunk.relPath);
      marketingDb.markAssetUsed("visual", bestChunk.id);
      const stats = marketingDb.getAssetPoolStats("visual");

      const emoSummary =
        bestMatchedEmotions.length > 0
          ? bestMatchedEmotions.join(", ")
          : bestChunk.emotions.slice(0, 3).join(", ");
      const kwSummary =
        bestMatchedKeywords.length > 0
          ? ` | Conceptos: ${bestMatchedKeywords.slice(0, 4).join(", ")}`
          : "";

      const matchReason =
        `Imagen "${bestChunk.title}" [${bestChunk.product}/${bestChunk.category}] ` +
        `elegida por similitud vectorial (${bestScore.toFixed(2)}) con emociones [${emoSummary}]` +
        `${kwSummary}. Objetivo: ${bestChunk.objective}`;

      const catalog = getCatalog();
      const catalogMatch = catalog.find((c) => c.id === bestChunk.id);

      return {
        product,
        category: bestChunk.category,
        localImagePath: chosenAbsPath,
        catalogPrompt: bestChunk.description,
        brandBadge: brandMeta.badge,
        accentColor: brandMeta.accent,
        catalogItem: catalogMatch,
        assetId: bestChunk.id,
        title: bestChunk.title,
        emotions: bestChunk.emotions,
        objective: bestChunk.objective,
        matchReason,
        score: Number(bestScore.toFixed(3)),
        usageStats: {
          ...stats,
          cycleResetTriggered,
        },
      };
    }

    // Fallback de seguridad si aún no existe visualVectorIndex.json
    const allFiles = this.findLocalImageFiles(product);
    const usedSet = new Set((options.usedImages || []).map((p) => path.resolve(p).toLowerCase()));
    const available = allFiles.filter((f) => !usedSet.has(path.resolve(f).toLowerCase()));
    const chosen = available[0] || allFiles[0] || null;

    return {
      product,
      category: "general",
      localImagePath: chosen,
      catalogPrompt: options.sceneText || options.topic || "Escena profesional Silvania",
      brandBadge: brandMeta.badge,
      accentColor: brandMeta.accent,
      matchReason: "Selección directa por carpeta de producto (índice vectorial pendiente).",
    };
  },
};
