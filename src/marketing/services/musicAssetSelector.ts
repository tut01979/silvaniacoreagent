import fs from "node:fs";
import path from "node:path";
import { marketingDb } from "../database.js";
import { computeSemanticVector, cosineSimilarity, normalizeToken } from "./semanticVectorEngine.js";
import type { ProductBrand } from "./visualAssetSelector.js";

export interface MusicVectorChunk {
  id: string;
  relPath: string;
  category: string;
  title: string;
  description: string;
  emotions: string[];
  products: string[];
  objective: string;
  keywords: string[];
  bpm: number;
  durationSec: number;
  copyrightStatus: string;
  vector?: number[];
}

export interface SelectedMusicTrack {
  id: string;
  filePath: string;
  relPath: string;
  category: string;
  title: string;
  emotions: string[];
  objective: string;
  matchReason: string;
  score: number;
  copyrightStatus: string;
  usageStats: { total: number; unused: number; used: number; cycleResetTriggered: boolean };
}

const INDEX_PATH = path.resolve(process.cwd(), "src/marketing/assets/musicVectorIndex.json");
const FALLBACK_CATALOG_PATH = path.resolve(
  process.cwd(),
  "src/marketing/assets/musicLibraryCatalog.json"
);

let cachedChunks: MusicVectorChunk[] | null = null;

function loadMusicChunks(): MusicVectorChunk[] {
  if (cachedChunks) return cachedChunks;
  const sourcePath = fs.existsSync(INDEX_PATH)
    ? INDEX_PATH
    : fs.existsSync(FALLBACK_CATALOG_PATH)
    ? FALLBACK_CATALOG_PATH
    : null;

  if (!sourcePath) {
    cachedChunks = [];
    return cachedChunks;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as MusicVectorChunk[];
    cachedChunks = raw.filter((item) => {
      const abs = path.resolve(process.cwd(), item.relPath);
      return fs.existsSync(abs);
    });
  } catch {
    cachedChunks = [];
  }

  if (cachedChunks.length > 0) {
    marketingDb.syncMusicAssets(
      cachedChunks.map((c) => ({
        id: c.id,
        category: c.category,
        relPath: c.relPath,
      }))
    );
  }
  return cachedChunks;
}

export const musicAssetSelector = {
  reloadIndex(): void {
    cachedChunks = null;
  },

  selectMusicForScript(options: {
    product?: ProductBrand;
    topic?: string;
    scriptText?: string;
    targetEmotion?: string;
  }): SelectedMusicTrack | null {
    const chunks = loadMusicChunks();
    if (chunks.length === 0) return null;

    let usageMap = marketingDb.getAssetUsageMap("music");
    let unusedPool = chunks.filter(
      (c) => (usageMap.get(c.id)?.status ?? "sin_usar") === "sin_usar"
    );

    let cycleResetTriggered = false;
    if (unusedPool.length === 0) {
      marketingDb.resetAssetPoolToUnused("music");
      usageMap = marketingDb.getAssetUsageMap("music");
      unusedPool = chunks;
      cycleResetTriggered = true;
    }

    const queryText = [
      options.product || "",
      options.targetEmotion || "",
      options.topic || "",
      options.scriptText || "",
    ]
      .filter(Boolean)
      .join(" | ");

    const queryVec = computeSemanticVector(queryText);
    const normQuery = normalizeToken(queryText);
    const targetProd = options.product || "shared";

    let bestChunk = unusedPool[0];
    let bestScore = -Infinity;
    let bestMatchedEmotions: string[] = [];

    for (const chunk of unusedPool) {
      const chunkVec =
        chunk.vector && chunk.vector.length > 0
          ? chunk.vector
          : computeSemanticVector(
              `${chunk.category} ${chunk.title} ${chunk.description} ${chunk.emotions.join(" ")} ${chunk.objective}`
            );

      let score = cosineSimilarity(queryVec, chunkVec) * 10;

      // Product alignment boost
      if (targetProd !== "shared" && chunk.products.includes(targetProd)) {
        score += 1.6;
      }

      // Direct emotion / category keyword boost
      const matchedEmotions: string[] = [];
      for (const emo of chunk.emotions) {
        const ne = normalizeToken(emo);
        if (ne && normQuery.includes(ne)) {
          score += 1.4;
          matchedEmotions.push(emo);
        }
      }
      if (normQuery.includes(normalizeToken(chunk.category))) {
        score += 1.8;
      }

      if (score > bestScore) {
        bestScore = score;
        bestChunk = chunk;
        bestMatchedEmotions = matchedEmotions;
      }
    }

    marketingDb.markAssetUsed("music", bestChunk.id);
    const stats = marketingDb.getAssetPoolStats("music");

    const emoLabel =
      bestMatchedEmotions.length > 0
        ? bestMatchedEmotions.join(", ")
        : bestChunk.emotions.slice(0, 3).join(", ");
    const matchReason =
      `Pista "${bestChunk.title}" (${bestChunk.category}, ${bestChunk.copyrightStatus}) ` +
      `seleccionada por afinidad vectorial (${bestScore.toFixed(2)}) con emociones [${emoLabel}] ` +
      `para el objetivo: ${bestChunk.objective}`;

    return {
      id: bestChunk.id,
      filePath: path.resolve(process.cwd(), bestChunk.relPath),
      relPath: bestChunk.relPath,
      category: bestChunk.category,
      title: bestChunk.title,
      emotions: bestChunk.emotions,
      objective: bestChunk.objective,
      matchReason,
      score: Number(bestScore.toFixed(3)),
      copyrightStatus: bestChunk.copyrightStatus,
      usageStats: {
        ...stats,
        cycleResetTriggered,
      },
    };
  },
};

