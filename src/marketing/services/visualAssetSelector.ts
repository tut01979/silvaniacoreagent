import fs from "fs";
import path from "path";
import { marketingDb } from "../database.js";
import {
  computeSemanticVector,
  cosineSimilarity,
  getExpandedQueryTokens,
  normalizeText,
  normalizeToken,
  stripBoilerplateNoise,
} from "./semanticVectorEngine.js";

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

export type CommercialProfile =
  | "general"
  | "freelance"
  | "comerciantes"
  | "autonomos"
  | "microempresas"
  | "clinicas_dentales"
  | "inmobiliarias"
  | "abogados"
  | "educacion_logopedia";

export type NarrativeRole =
  | "hook_dolor"
  | "transicion"
  | "solucion_agente"
  | "resultado_exito"
  | "cierre_cta";

export type VisualGenre =
  | "corporativo_real"
  | "tecnologia_futurista"
  | "lifestyle_profesional"
  | "clinico_salud"
  | "educativo_infantil"
  | "redes_marketing"
  | "storytelling_humano"
  | "naturaleza_clima"
  | "emocion_estado_animo"
  | "vida_cotidiana";

export interface VisualStructuredAttributes {
  industryProfile: CommercialProfile;
  narrativeRole: NarrativeRole;
  genre: VisualGenre;
  emotions: string[];
  situations: string[];
  painPoints: string[];
  agentAffinity: Array<"coreagent" | "marketing" | "setter_ia" | "eva" | string>;
  setting: string;
  visualStyle: "fotografia_real" | "ilustracion_3d" | "holograma_futurista" | "editorial_minimalista";
  brandSafety: "clean_no_trademarks";
  subjects?: string[];
  actions?: string[];
  objects?: string[];
  useCases?: string[];
  scriptThemes?: string[];
  audience?: string;
  excludedProducts?: ProductBrand[];
}

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
  structuredAttributes?: VisualStructuredAttributes;
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

const NICHE_SYNONYMS: Record<string, string[]> = {
  inmobiliarias: ["inmobiliar", "vivienda", "propiedad", "piso", "casa", "alquiler", "hipoteca", "real estate", "apartment"],
  clinicas_dentales: ["dental", "dentista", "odontolog", "clinica", "diente", "salud bucal"],
  abogados: ["abogad", "juridic", "bufete", "legal", "juicio", "despacho legal"],
  comerciantes: ["comerc", "tienda", "retail", "mostrador", "tpv"],
  autonomos: ["autonom", "fontaner", "electricist", "oficio", "presupuesto"],
  freelance: ["freelance", "independiente", "remoto"],
  microempresas: ["microempresa", "pyme", "pequena empresa"],
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

function getExpectedNarrativeRole(sceneIndex?: number, totalScenes?: number): NarrativeRole | null {
  if (!sceneIndex || !totalScenes || totalScenes < 3) return null;
  const progress = (sceneIndex - 1) / Math.max(1, totalScenes - 1);
  if (progress <= 0.22) return "hook_dolor";
  if (progress >= 0.85) return "cierre_cta";
  if (progress >= 0.65) return "resultado_exito";
  if (progress >= 0.42) return "solucion_agente";
  return "transicion";
}

function lightStemToken(tok: string): string {
  if (tok.length <= 4) return tok;
  return tok
    .replace(/(imientos|imiento|aciones|acion|adores|ador|idades|idad|mente|ando|iendo|arse|erse|irse|ing|tion|ness|ment|ed|es|as|os|s)$/i, "")
    .slice(0, 7);
}

export const visualAssetSelector = {
  reloadIndex(): void {
    cachedVectorChunks = null;
    cachedCatalog = null;
  },

  detectExplicitCommercialProduct(topic: string, scriptText?: string): "eva" | "marketing" | "coreagent" | null {
    const full = normalizeText(`${topic} ${scriptText || ""}`);
    const hasCoreAgent = /\b(coreagent|core\s*agent|google\s+workspace|workspace|gmail|calendar|google\s+drive|google\s+sheets|sheets|hojas\s+de\s+calculo|prospecci[oó]?n|prospectar|tablas|facturas?|presupuestos?|ordenes\s+por\s+voz|telegram\s+bot|asistente\s+ejecutivo)\b/.test(full);
    const hasEva = /\b(eva|colegio|escuela|aula|profesora|logoped\w*|infantil|fonema\w*|pronunciacion|ninos|nino|nina|escolar)\b/.test(full);
    const hasMarketing = /\b(marketing\s+studio|marketing\s+agent|campana\s+publicitaria|anuncio\s+comercial|embudo\s+de\s+ventas)\b/.test(full);

    if (hasCoreAgent && !/\beva\b/.test(full)) {
      return "coreagent";
    }
    if (hasEva && !hasCoreAgent) {
      return "eva";
    }
    if (/\beva\b/.test(full)) {
      return "eva";
    }
    if (hasCoreAgent) {
      return "coreagent";
    }
    if (hasMarketing) {
      return "marketing";
    }
    return null;
  },

  detectProduct(topic: string, scriptText?: string): ProductBrand {
    return this.detectProductFromTopic(topic, scriptText);
  },

  detectCategory(product: ProductBrand, text: string, extraArg?: string | number): string {
    const t = normalizeText(`${text} ${extraArg ?? ""}`);
    if (product === "coreagent") {
      if (/\b(documento\w*|papel\w*|archivo\w*|pdf|carpeta\w*|manual|tediosa|lenta)\b/.test(t)) return "stacked_documents";
      if (/\b(robot\w*|bot|androide\w*)\b/.test(t)) return "robots";
      if (/\b(oficina\w*|lujo|despacho\w*|rascacielos)\b/.test(t)) return "luxury_offices";
      if (/\b(google|workspace|gmail|calendar|drive|sheets|tablas?|datos|prospeccion)\b/.test(t)) return "google_workspace";
      if (/\b(productividad|tiempo|enfoque|eficiencia|estructurad\w*)\b/.test(t)) return "productivity";
      return "automation";
    }
    if (product === "marketing") {
      if (/\b(aceptacion|aprobacion|cliente|estrella|sonrisa)\b/.test(t)) return "acceptance_approval";
      if (/\b(redes|social|reels|tiktok|instagram|viral)\b/.test(t)) return "social_media";
      if (/\b(analitica|roi|metricas|grafico|crecimiento)\b/.test(t)) return "analytics_campaigns";
      if (/\b(estrategia|embudo|segmentacion)\b/.test(t)) return "marketing_strategy";
      return "advertising";
    }
    if (product === "eva") {
      if (/\b(robot|tutor)\b/.test(t)) return "robot_teacher";
      if (/\b(profesora|maestra|logopeda|humana|terapia)\b/.test(t)) return "human_teacher";
      if (/\b(juego|diversion|cuento|puzzle|bloque)\b/.test(t)) return "learning_games";
      return "school_classes";
    }
    return "general";
  },

  detectProductFromTopic(topic: string, scriptText?: string): ProductBrand {
    const full = normalizeText(`${topic} ${scriptText || ""}`);
    const hasCoreAgent = /\b(coreagent|core\s*agent|automatiz\w*|workspace|drive|gmail|calendar|sheets|prospecci\w*|leads|tablas?|crm|factura\w*|presupuesto\w*|telegram|robot|documento\w*|papeleo|productividad)\b/.test(full);
    if (/\b(eva|colegio|escuela|aula|profesora|logoped\w*|infantil|fonema\w*|ninos|nino|nina)\b/.test(full) && !/\bcoreagent\b/.test(full)) {
      return "eva";
    }
    if (hasCoreAgent) return "coreagent";
    if (/\b(cuento|fantasia|dragon|princesa|castillo|hada)\b/.test(full)) return "fantasy_tales";
    if (/\b(cosmos|espacio|galaxia|universo|planeta|nebulosa|astronomia)\b/.test(full)) return "cosmos";
    if (/\b(biblia|biblic\w*|fe|dios|jesus|cristo|oracion|sagrado)\b/.test(full)) return "faith_bible";
    if (/\b(holograma\w*|cuantico|futurista|cibernetico|matrix)\b/.test(full)) return "scifi_holograms";
    if (/\b(despertar|amanecer|playa|mar|oceano|naturaleza|bosque|montana|lluvia|tormenta|atardecer|cama)\b/.test(full)) {
      return "nature_climates";
    }
    if (/\b(animo|emocion\w*|tristeza|alegria|calma|ansiedad|estres|soledad|esperanza|superacion|ford|rockefeller|buffett|jobs|historia|biografia|liderazgo|riqueza|millonario\w*|filosofia|mentalidad)\b/.test(full)) {
      return "emotions";
    }
    if (/\b(marketing|publicidad|anuncio|redes|viral|campana|embudo|roi|aceptacion|reels|tiktok)\b/.test(full)) {
      return "marketing";
    }
    return "emotions";
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
   * Selecciona la imagen con mayor similitud semántica vectorial respecto al guion,
   * emociones, conceptos visuales y situación de la escena.
   */
  selectAssetForScene(options: {
    product?: ProductBrand;
    topic?: string;
    videoTopic?: string;
    scriptTitle?: string;
    scriptHook?: string;
    sceneText?: string;
    targetEmotion?: string;
    visualConcepts?: string[];
    sceneIndex?: number;
    totalScenes?: number;
    usedImages?: string[];
    lastCategory?: string;
    pureStorytelling?: boolean;
  }): SelectedSceneVisual {
    const scriptLevelContext = [options.videoTopic, options.scriptTitle, options.scriptHook]
      .filter(Boolean)
      .join(" ");
    const detectionTopic = scriptLevelContext || options.topic || "";
    const explicitCommercial = this.detectExplicitCommercialProduct(
      detectionTopic,
      scriptLevelContext ? "" : options.sceneText || ""
    );
    const product: ProductBrand =
      options.product || this.detectProductFromTopic(detectionTopic, options.sceneText || "");
    // Bloquear secuestro hacia Eva cuando el producto explícito del vídeo es CoreAgent/Marketing u otro adulto
    const isEvaMode = options.product
      ? options.product === "eva"
      : (product === "eva" || explicitCommercial === "eva");

    const isEvaOrChildAsset = (c: VisualVectorChunk): boolean => {
      if (c.product === "eva" || c.product === "fantasy_tales") return true;
      if (c.relPath.replace(/\\/g, "/").toLowerCase().includes("/eva/")) return true;
      if (/^(?:kids_|school_classes|human_teacher|robot_teacher|learning_games|child_session|clinical_web|family_progress|phonemes|speech_therapy|parents_family|hero)/i.test(c.category || "")) {
        return true;
      }
      const sa = c.structuredAttributes;
      if (sa?.excludedProducts && sa.excludedProducts.includes(product)) return true;
      if (Array.isArray(sa?.agentAffinity) && sa.agentAffinity.length === 1 && sa.agentAffinity[0] === "eva") {
        return true;
      }
      return false;
    };

    const chunks = getVectorChunks();
    if (chunks.length > 0) {
      let usageMap = marketingDb.getAssetUsageMap("visual");
      const usedInVideo = new Set(
        (options.usedImages || []).map((p) => path.resolve(p).toLowerCase())
      );

      // Aislamiento estricto por producto y seguridad infantil:
      // - Vídeos de Eva usan exclusivamente activos infantiles/fantasía/naturaleza/cosmos amigables.
      // - Vídeos CoreAgent/Marketing excluyen ESTRICTAMENTE todo activo de Eva, niños y fantasía infantil.
      // - Resto de vídeos adultos excluyen EVA y buscan en la memoria vectorial compatible.
      const productFilteredChunks = chunks.filter((c) => {
        if (isEvaMode) {
          return (
            c.product === "eva" ||
            c.product === "fantasy_tales" ||
            c.product === "nature_climates" ||
            c.product === "cosmos" ||
            c.product === "shared"
          );
        }
        if (isEvaOrChildAsset(c)) return false;
        if (product === "coreagent" || product === "marketing" || explicitCommercial === "coreagent" || explicitCommercial === "marketing") {
          return c.product !== "faith_bible";
        }
        return c.product !== "eva";
      });
      const nonEvaSafeFallback = isEvaMode ? chunks : chunks.filter((c) => c.product !== "eva" && !isEvaOrChildAsset(c));
      const candidateChunks = productFilteredChunks.length > 0
        ? productFilteredChunks
        : (nonEvaSafeFallback.length > 0 ? nonEvaSafeFallback : chunks);

      const unusedPool = candidateChunks.filter((c) => {
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

      const evaluationPool = candidateChunks.filter((c) => {
        const abs = path.resolve(process.cwd(), c.relPath).toLowerCase();
        return !usedInVideo.has(abs);
      });
      const finalPool = evaluationPool.length > 0 ? evaluationPool : candidateChunks;

      const cleanTopic = stripBoilerplateNoise(options.topic || "");
      const cleanScriptContext = stripBoilerplateNoise(scriptLevelContext);
      const cleanSceneText = stripBoilerplateNoise(options.sceneText || "");
      const conceptsStr = (options.visualConcepts || []).join(" ");
      const emotionStr = options.targetEmotion || "";

      // La consulta combina conceptos visuales concretos + emoción + texto hablado + contexto completo del guión
      const queryText = [
        conceptsStr,
        conceptsStr, // doble peso para los conceptos concretos de la escena
        emotionStr,
        cleanSceneText,
        cleanTopic,
        cleanScriptContext,
      ]
        .filter(Boolean)
        .join(" | ");

      const queryVec = computeSemanticVector(queryText, true);
      const normQuery = normalizeText(queryText);
      const normPaddedQuery = ` ${normQuery} `;
      const expandedTokens = getExpandedQueryTokens(queryText);
      const expandedStems = new Set(expandedTokens.map((t) => lightStemToken(t)));
      const expectedRole = getExpectedNarrativeRole(options.sceneIndex, options.totalScenes);

      let bestChunk = finalPool[0];
      let bestScore = -Infinity;
      let bestMatchedEmotions: string[] = [];
      let bestMatchedKeywords: string[] = [];

      const countPhraseAndStemHits = (values: string[] | undefined): { hits: number; matched: string[] } => {
        if (!Array.isArray(values) || values.length === 0) return { hits: 0, matched: [] };
        let hits = 0;
        const matched: string[] = [];
        for (const v of values) {
          const nv = normalizeText(v);
          if (!nv || nv.length < 3) continue;
          if (normPaddedQuery.includes(` ${nv} `)) {
            hits += 1.4;
            matched.push(v);
            continue;
          }
          const parts = nv.split(/\s+/).filter((p) => p.length >= 4);
          if (parts.length > 0) {
            const stemHits = parts.filter((p) => expandedStems.has(lightStemToken(p))).length;
            if ((parts.length === 1 && stemHits === 1) || (parts.length >= 2 && stemHits >= 2)) {
              hits += parts.length >= 2 ? 1.1 : 0.75;
              matched.push(v);
            }
          }
        }
        return { hits, matched };
      };

      for (const chunk of finalPool) {
        const sa = chunk.structuredAttributes;
        const chunkRichText = [
          chunk.title,
          chunk.description,
          chunk.emotions.join(" "),
          chunk.objective,
          chunk.keywords.join(" "),
          (chunk.attributes || []).join(" "),
          (sa?.situations || []).join(" "),
          (sa?.painPoints || []).join(" "),
          (sa?.subjects || []).join(" "),
          (sa?.actions || []).join(" "),
          (sa?.objects || []).join(" "),
          (sa?.useCases || []).join(" "),
          (sa?.scriptThemes || []).join(" "),
        ].filter(Boolean).join(" ");

        const chunkVec =
          chunk.vector && chunk.vector.length >= 256
            ? chunk.vector
            : computeSemanticVector(chunkRichText, false);

        // 1. Similitud coseno vectorial 256-dim como motor principal
        let score = cosineSimilarity(queryVec, chunkVec) * 24;

        // 2. Pequeño bonus de rotación (sin sacrificar coherencia del guion)
        const isUnused = (usageMap.get(chunk.id)?.status ?? "sin_usar") === "sin_usar";
        if (isUnused) {
          score += 0.35;
        }

        // 3. Diversidad ligera entre cortes seguidos de la misma subcategoría
        if (options.lastCategory && chunk.category === options.lastCategory) {
          score -= 0.55;
        }

        // 4. Afinidad de producto (fuerte prioridad al producto objetivo del vídeo)
        if ((product === "coreagent" || explicitCommercial === "coreagent") && chunk.product === "coreagent") {
          score += 2.6;
        } else if (explicitCommercial && chunk.product === explicitCommercial) {
          score += 2.0;
        } else if (!options.pureStorytelling && chunk.product === product) {
          score += 1.0;
        }

        // 5. Alineación con rol narrativo (inicio -> dolor, desarrollo -> transición/solución, final -> éxito/cierre)
        if (expectedRole && sa?.narrativeRole === expectedRole) {
          score += 1.0;
        }

        // 6. Afinidad emocional y estados de ánimo (exacta y por raíz)
        const matchedEmotions: string[] = [];
        let emoBoost = 0;
        for (const emo of chunk.emotions || []) {
          const ne = normalizeText(emo);
          const stem = lightStemToken(ne.replace(/\s+/g, ""));
          if ((ne && normPaddedQuery.includes(` ${ne} `)) || (stem.length >= 4 && expandedStems.has(stem))) {
            emoBoost += 1.7;
            matchedEmotions.push(emo);
          }
        }
        score += Math.min(6.8, emoBoost);

        // 7. Afinidad con palabras clave concretas (objetos, acciones, clima, lugares)
        const matchedKeywords: string[] = [];
        let kwBoost = 0;
        for (const kw of chunk.keywords || []) {
          const fullKw = normalizeText(kw);
          const parts = fullKw.split(/\s+/).filter((p) => p.length >= 3);
          if (fullKw.length >= 3 && normPaddedQuery.includes(` ${fullKw} `)) {
            kwBoost += 1.4;
            matchedKeywords.push(kw);
          } else if (parts.some((p) => expandedStems.has(lightStemToken(p)))) {
            kwBoost += 0.85;
            matchedKeywords.push(kw);
          }
        }
        score += Math.min(7.0, kwBoost);

        // 8. Afinidad con título y atributos estructurados ricos (sujetos, acciones, objetos, casos de uso, guion)
        const titleNorm = normalizeText(chunk.title || "");
        let titleHits = 0;
        for (const tok of expandedTokens) {
          if (tok.length >= 4 && ` ${titleNorm} `.includes(` ${tok} `)) {
            titleHits++;
          }
        }
        score += Math.min(4.2, titleHits * 1.4);

        const attrMatch = countPhraseAndStemHits(chunk.attributes);
        score += Math.min(3.5, attrMatch.hits * 0.65);
        matchedKeywords.push(...attrMatch.matched.slice(0, 3));

        if (sa) {
          const nicheSyns = NICHE_SYNONYMS[sa.industryProfile];
          const profileNorm = normalizeText(sa.industryProfile.replace(/_/g, " "));
          const isVerticalNiche = Boolean(nicheSyns);
          const matchesNiche =
            (profileNorm && profileNorm !== "general" && normPaddedQuery.includes(` ${profileNorm} `)) ||
            (nicheSyns ? nicheSyns.some((s) => normQuery.includes(normalizeText(s))) : false);

          if (isVerticalNiche) {
            if (matchesNiche) {
              score += 4.5;
              matchedKeywords.push(`perfil:${sa.industryProfile}`);
            } else {
              // Evitar que los packs B2B específicos (inmobiliarias/abogados/clínicas) secuestren guiones generales
              score -= 3.8;
            }
          }

          if (
            (product === "coreagent" || explicitCommercial === "coreagent") &&
            chunk.category === "storytelling_riqueza" &&
            !matchesNiche
          ) {
            score -= 1.8;
          }

          for (const sit of sa.situations || []) {
            const sitWords = normalizeText(sit).split(/\s+/).filter((w) => w.length >= 4);
            const overlap = sitWords.filter((w) => expandedStems.has(lightStemToken(w))).length;
            if (overlap >= 2) {
              score += Math.min(2.8, overlap * 0.9);
              matchedKeywords.push(sit);
            }
          }

          for (const pain of sa.painPoints || []) {
            const np = normalizeText(pain);
            if (np.length >= 4 && normPaddedQuery.includes(` ${np} `)) {
              score += 1.6;
              matchedKeywords.push(pain);
            }
          }

          const deepFields = [
            ...(sa.subjects || []),
            ...(sa.actions || []),
            ...(sa.objects || []),
            ...(sa.useCases || []),
            ...(sa.scriptThemes || []),
          ];
          const deepMatch = countPhraseAndStemHits(deepFields);
          score += Math.min(4.8, deepMatch.hits * 0.9);
          matchedKeywords.push(...deepMatch.matched.slice(0, 4));
        }

        if (score > bestScore) {
          bestScore = score;
          bestChunk = chunk;
          bestMatchedEmotions = matchedEmotions;
          bestMatchedKeywords = matchedKeywords;
        }
      }

      const resolvedProduct: ProductBrand =
        bestChunk.product !== "shared" ? (bestChunk.product as ProductBrand) : product;
      const brandMeta = BRAND_CONFIG[resolvedProduct] || BRAND_CONFIG.emotions;

      console.log(
        `🧠 [VisualVector 256d] Producto=${product} | Escena="${cleanSceneText.slice(0, 48)}" -> [${bestChunk.product}/${bestChunk.category}] "${bestChunk.title}" (score=${bestScore.toFixed(2)}, emo=[${bestMatchedEmotions.join(",")}], attr=[${Array.from(new Set(bestMatchedKeywords)).slice(0, 6).join(",")}])`
      );

      const chosenAbsPath = path.resolve(process.cwd(), bestChunk.relPath);
      marketingDb.markAssetUsed("visual", bestChunk.id);
      const stats = marketingDb.getAssetPoolStats("visual");

      const emoSummary =
        bestMatchedEmotions.length > 0
          ? bestMatchedEmotions.join(", ")
          : (bestChunk.emotions || []).slice(0, 3).join(", ");
      const kwSummary =
        bestMatchedKeywords.length > 0
          ? ` | Conceptos: ${Array.from(new Set(bestMatchedKeywords)).slice(0, 4).join(", ")}`
          : "";

      const matchReason =
        `Imagen "${bestChunk.title}" [${bestChunk.product}/${bestChunk.category}] ` +
        `elegida por memoria vectorial (${bestScore.toFixed(2)}) con emociones [${emoSummary}]` +
        `${kwSummary}. Objetivo: ${bestChunk.objective}`;

      const catalog = getCatalog();
      const catalogMatch = catalog.find((c) => c.id === bestChunk.id);

      return {
        product: resolvedProduct,
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
    const fallbackBrandMeta = BRAND_CONFIG[product] || BRAND_CONFIG.emotions;
    const allFiles = this.findLocalImageFiles(product);
    const usedSet = new Set((options.usedImages || []).map((p) => path.resolve(p).toLowerCase()));
    const available = allFiles.filter((f) => !usedSet.has(path.resolve(f).toLowerCase()));
    const chosen = available[0] || allFiles[0] || null;

    return {
      product,
      category: "general",
      localImagePath: chosen,
      catalogPrompt: options.sceneText || options.topic || "Escena visual Silvania",
      brandBadge: fallbackBrandMeta.badge,
      accentColor: fallbackBrandMeta.accent,
      matchReason: "Selección directa por carpeta de producto (índice vectorial pendiente).",
    };
  },
};
