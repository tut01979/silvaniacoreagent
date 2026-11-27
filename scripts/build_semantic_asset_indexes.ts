import fs from "node:fs";
import path from "node:path";
import { computeSemanticVector } from "../src/marketing/services/semanticVectorEngine.js";
import { enrichVisualChunk } from "../src/marketing/services/visualMetadataEnricher.js";
import type { VisualVectorChunk } from "../src/marketing/services/visualAssetSelector.js";

interface MusicVectorChunk {
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
  vector: number[];
}

const ROOT = process.cwd();
const VISUALS_DIR = path.join(ROOT, "src/marketing/assets/visuals");
const CATALOG_PATH = path.join(ROOT, "src/marketing/assets/visualLibraryCatalog.json");
const EXTENDED_PATH = path.join(ROOT, "src/marketing/assets/visualLibraryExtended.json");
const VISUAL_INDEX_OUT = path.join(ROOT, "src/marketing/assets/visualVectorIndex.json");

const MUSIC_CATALOG_PATH = path.join(ROOT, "src/marketing/assets/musicLibraryCatalog.json");
const MUSIC_INDEX_OUT = path.join(ROOT, "src/marketing/assets/musicVectorIndex.json");

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function inferProductAndEmotions(relPath: string): {
  product: "coreagent" | "marketing" | "eva" | "shared";
  category: string;
  emotions: string[];
  objective: string;
  keywords: string[];
} {
  const norm = relPath.replace(/\\/g, "/").toLowerCase();
  const baseName = path.basename(norm, path.extname(norm)).replace(/[_-]+/g, " ");
  const parts = norm.split("/");
  const folder = parts.length >= 2 ? parts[parts.length - 2] : "general";

  if (norm.includes("coreagent") || norm.includes("silvaniacoreagent") || norm.includes("hub_ecosystem") || norm.includes("robot.png")) {
    return {
      product: "coreagent",
      category: folder,
      emotions: ["eficiencia", "control", "productividad", "confianza"],
      objective: "Mostrar automatización ejecutiva, productividad y ecosistema CoreAgent.",
      keywords: [baseName, folder, "coreagent", "automatizacion", "productividad", "ia"],
    };
  }
  if (norm.includes("marketing")) {
    return {
      product: "marketing",
      category: folder,
      emotions: ["creatividad", "impacto", "exito", "crecimiento"],
      objective: "Comunicar campañas, publicidad, redes sociales y crecimiento de marca.",
      keywords: [baseName, folder, "marketing", "publicidad", "campaña", "marca"],
    };
  }
  if (norm.includes("eva")) {
    return {
      product: "eva",
      category: folder,
      emotions: ["ternura", "alegria", "aprendizaje", "esperanza"],
      objective: "Mostrar educación infantil, terapia del habla y aprendizaje lúdico con Eva.",
      keywords: [baseName, folder, "eva", "educacion", "niños", "habla", "escuela"],
    };
  }
  if (norm.includes("emotions")) {
    return {
      product: "shared",
      category: "emotions",
      emotions: [baseName, "empatia", "conexion", "humanidad"],
      objective: "Conectar emocionalmente con la audiencia según el tono de la escena.",
      keywords: [baseName, "emociones", "sentimientos", "conexion"],
    };
  }
  if (norm.includes("cosmos") || norm.includes("scifi")) {
    return {
      product: "shared",
      category: folder,
      emotions: ["asombro", "descubrimiento", "futuro", "gloria"],
      objective: "Evocar visión de futuro, ciencia y escala tecnológica.",
      keywords: [baseName, folder, "futuro", "cosmos", "tecnologia", "descubrimiento"],
    };
  }
  if (norm.includes("fantasy")) {
    return {
      product: "eva",
      category: "fantasy_tales",
      emotions: ["magia", "imaginacion", "asombro", "ternura"],
      objective: "Ambientar cuentos, mundos mágicos e historias creativas.",
      keywords: [baseName, "fantasia", "cuentos", "magia", "imaginacion"],
    };
  }
  if (norm.includes("faith")) {
    return {
      product: "shared",
      category: "faith_bible",
      emotions: ["esperanza", "luz", "paz", "inspiracion"],
      objective: "Transmitir valores, reflexión, esperanza y luz.",
      keywords: [baseName, "fe", "luz", "esperanza", "paz", "inspiracion"],
    };
  }
  if (norm.includes("nature")) {
    return {
      product: "shared",
      category: "nature_climates",
      emotions: ["calma", "libertad", "armonia", "grandeza"],
      objective: "Aportar metáforas visuales de calma, claridad o fuerza natural.",
      keywords: [baseName, "naturaleza", "paisaje", "calma", "armonia"],
    };
  }
  return {
    product: "shared",
    category: folder,
    emotions: ["inspiracion", "claridad", "confianza"],
    objective: "Recurso visual versátil libre de derechos para escenas narrativas.",
    keywords: [baseName, folder, "silvania"],
  };
}

function buildVisualIndex(): VisualVectorChunk[] {
  const byRelPath = new Map<string, Omit<VisualVectorChunk, "vector">>();

  // 0. Preserve existing enriched structured attributes from current visualVectorIndex.json if present
  const existingByRelPath = new Map<string, VisualVectorChunk>();
  if (fs.existsSync(VISUAL_INDEX_OUT)) {
    try {
      const existingRaw = JSON.parse(fs.readFileSync(VISUAL_INDEX_OUT, "utf8")) as VisualVectorChunk[];
      for (const ex of existingRaw) {
        if (ex?.relPath) existingByRelPath.set(ex.relPath.replace(/\\/g, "/"), ex);
      }
    } catch {}
  }

  // 1. Load existing catalog if available (used to enrich matching files)
  const catalogById = new Map<string, any>();
  if (fs.existsSync(CATALOG_PATH)) {
    const rawCat = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
    for (const item of rawCat) {
      if (item?.id) catalogById.set(item.id, item);
    }
  }

  // 2. Load extended 140 specs (authoritative metadata for new images)
  if (fs.existsSync(EXTENDED_PATH)) {
    const extItems = JSON.parse(fs.readFileSync(EXTENDED_PATH, "utf8"));
    for (const item of extItems) {
      const relPath = `src/marketing/assets/visuals/${item.relPath}`.replace(/\\/g, "/");
      const absPath = path.join(ROOT, relPath);
      if (!fs.existsSync(absPath)) continue;
      byRelPath.set(relPath, {
        id: item.id,
        relPath,
        product: item.product,
        category: item.category,
        title: item.title,
        description: item.description,
        emotions: item.emotions || [],
        objective: item.objective || "",
        keywords: item.keywords || [],
        copyrightStatus: "royalty_free_ai_generated",
      });
    }
  }

  // 3. Scan all visual files under src/marketing/assets/visuals/**
  const allVisualFiles = walkFiles(VISUALS_DIR);
  for (const absFile of allVisualFiles) {
    const relPath = path.relative(ROOT, absFile).replace(/\\/g, "/");
    if (byRelPath.has(relPath)) continue;

    const baseId = path.basename(absFile, path.extname(absFile));
    const catMatch = catalogById.get(baseId);
    const inferred = inferProductAndEmotions(relPath);
    const canonicalBaseId = /^(story_riq_|ca_|mk_|inmob_|animo_|vida_|eva_)/.test(baseId)
      ? baseId
      : `vis_${baseId}`;

    byRelPath.set(relPath, {
      id: catMatch?.id || canonicalBaseId,
      relPath,
      product: (catMatch?.product as any) || inferred.product,
      category: catMatch?.subcategory || catMatch?.category || inferred.category,
      title: catMatch?.title || baseId.replace(/[_-]+/g, " "),
      description: catMatch?.prompt || inferred.objective,
      emotions: inferred.emotions,
      objective: catMatch?.commercialObjective || inferred.objective,
      keywords: Array.isArray(catMatch?.keywords)
        ? [...new Set([...catMatch.keywords, ...inferred.keywords])]
        : inferred.keywords,
      copyrightStatus: "royalty_free_verified",
    });
  }

  // 4. Add curated public/ scene assets
  const publicScenes: Array<{
    file: string;
    id: string;
    product: "coreagent" | "marketing" | "eva" | "shared";
    category: string;
    title: string;
    description: string;
    emotions: string[];
    objective: string;
    keywords: string[];
  }> = [
    {
      file: "public/eva_hero.jpg",
      id: "pub_eva_hero",
      product: "eva",
      category: "hero",
      title: "Eva Educación Infantil Hero",
      description: "Imagen principal de Eva conectando tecnología educativa amigable con el aprendizaje infantil.",
      emotions: ["esperanza", "alegria", "ternura", "confianza"],
      objective: "Presentar la marca Eva con calidez y profesionalismo.",
      keywords: ["eva", "educacion", "hero", "infantil", "habla"],
    },
    {
      file: "public/eva_robot.jpg",
      id: "pub_eva_robot",
      product: "eva",
      category: "robot_teacher",
      title: "Robot Educativo Eva",
      description: "Robot tutor amigable de Eva diseñado para acompañar el desarrollo del habla.",
      emotions: ["simpatia", "paciencia", "curiosidad", "confianza"],
      objective: "Mostrar al robot tutor oficial de Eva.",
      keywords: ["eva", "robot", "tutor", "profesora robot", "habla"],
    },
    {
      file: "public/eva_worlds_map.jpg",
      id: "pub_eva_worlds",
      product: "eva",
      category: "learning_games",
      title: "Mapa de Mundos Mágicos de Eva",
      description: "Mapa ilustrado de los mundos temáticos interactivos dentro de Eva.",
      emotions: ["aventura", "descubrimiento", "diversion", "magia"],
      objective: "Mostrar el recorrido gamificado de aprendizaje.",
      keywords: ["eva", "mundos", "mapa", "juegos", "aventura"],
    },
    {
      file: "public/hub_ecosystem.jpg",
      id: "pub_hub_ecosystem",
      product: "coreagent",
      category: "automation",
      title: "Ecosistema Hub Silvania",
      description: "Arquitectura visual del ecosistema conectado de agentes Silvania.",
      emotions: ["integracion", "poder", "vision", "orden"],
      objective: "Explicar cómo se conectan CoreAgent, Marketing Agent y Eva.",
      keywords: ["ecosistema", "hub", "silvania", "coreagent", "agentes"],
    },
    {
      file: "public/silvaniacoreagent_mockup.png",
      id: "pub_coreagent_mockup",
      product: "coreagent",
      category: "productivity",
      title: "Mockup Ejecutivo Silvania CoreAgent",
      description: "Vista de interfaz y presencia ejecutiva de Silvania CoreAgent en acción.",
      emotions: ["profesionalismo", "control", "modernidad", "confianza"],
      objective: "Mostrar producto real en presentaciones comerciales.",
      keywords: ["mockup", "coreagent", "silvania", "interfaz", "producto"],
    },
    {
      file: "public/robot.png",
      id: "pub_silvania_robot",
      product: "coreagent",
      category: "robots",
      title: "Emblema Robótico Silvania",
      description: "Robot representativo de inteligencia autónoma empresarial Silvania.",
      emotions: ["innovacion", "inteligencia", "cercania", "futuro"],
      objective: "Reforzar identidad visual de agente robótico.",
      keywords: ["robot", "silvania", "ia", "coreagent"],
    },
  ];

  for (const pub of publicScenes) {
    if (fs.existsSync(path.join(ROOT, pub.file)) && !byRelPath.has(pub.file)) {
      byRelPath.set(pub.file, {
        id: pub.id,
        relPath: pub.file,
        product: pub.product,
        category: pub.category,
        title: pub.title,
        description: pub.description,
        emotions: pub.emotions,
        objective: pub.objective,
        keywords: pub.keywords,
        copyrightStatus: "silvania_owned",
      });
    }
  }

  // 5. Enrich structured attributes & compute semantic vectors for 100% of assets
  const chunks: VisualVectorChunk[] = [];
  for (const item of byRelPath.values()) {
    const existing = existingByRelPath.get(item.relPath);
    const cleanExistingId = existing?.id?.replace(/^vis_(?=(?:story_riq_|ca_|mk_|inmob_|animo_|vida_|eva_))/, "");
    const mergedItem: VisualVectorChunk = {
      ...(existing || {}),
      ...item,
      id: item.id || cleanExistingId || item.relPath,
      product: (existing?.product || item.product) as any,
      category: existing?.category || item.category,
      title: existing?.title || item.title,
      description: existing?.description || item.description,
      emotions: existing?.emotions?.length ? existing.emotions : item.emotions,
      objective: existing?.objective || item.objective,
      keywords: existing?.keywords?.length ? existing.keywords : item.keywords,
      attributes: existing?.attributes,
      structuredAttributes: existing?.structuredAttributes,
    };
    chunks.push(enrichVisualChunk(mergedItem));
  }

  return chunks;
}

function buildMusicIndex(): MusicVectorChunk[] {
  if (!fs.existsSync(MUSIC_CATALOG_PATH)) return [];
  const rawMusic = JSON.parse(fs.readFileSync(MUSIC_CATALOG_PATH, "utf8"));
  const chunks: MusicVectorChunk[] = [];

  for (const item of rawMusic) {
    const absPath = path.join(ROOT, item.relPath);
    if (!fs.existsSync(absPath)) continue;
    const richText = [
      item.category,
      item.title,
      item.description,
      (item.emotions || []).join(" "),
      (item.products || []).join(" "),
      item.objective || "",
      (item.keywords || []).join(" "),
    ].join(" | ");

    chunks.push({
      id: item.id,
      relPath: item.relPath,
      category: item.category,
      title: item.title,
      description: item.description,
      emotions: item.emotions || [],
      products: item.products || [],
      objective: item.objective || "",
      keywords: item.keywords || [],
      bpm: item.bpm || 100,
      durationSec: item.durationSec || 28,
      copyrightStatus: item.copyrightStatus || "royalty_free_original",
      vector: computeSemanticVector(richText),
    });
  }

  return chunks;
}

function main() {
  const visualChunks = buildVisualIndex();
  fs.writeFileSync(VISUAL_INDEX_OUT, JSON.stringify(visualChunks, null, 2), "utf8");
  console.log(`✅ Built visual vector index: ${visualChunks.length} images -> ${VISUAL_INDEX_OUT}`);

  const musicChunks = buildMusicIndex();
  fs.writeFileSync(MUSIC_INDEX_OUT, JSON.stringify(musicChunks, null, 2), "utf8");
  console.log(`✅ Built music vector index: ${musicChunks.length} tracks -> ${MUSIC_INDEX_OUT}`);
}

main();

