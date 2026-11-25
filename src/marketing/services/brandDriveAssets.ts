import fs from "fs";
import path from "path";
import { driveMemoryService } from "../../services/driveMemory.js";
import { runGog } from "../../tools/gogWrapper.js";
import { marketingDb } from "../database.js";

export interface DriveImageFile {
  id: string;
  name: string;
  mimeType?: string;
}

export interface BrandDriveFolders {
  rootFolderId: string;
  intrinsicFolderId: string;
  inicioFolderId: string;
  medioFolderId: string;
  cierreFolderId: string;
  bancoVisualFolderId: string;
  clipsCortosFolderId: string;
  proyectosFolderId: string;
  videosFolderId: string;
  createdFolders: string[];
}

export interface BrandDriveBundle {
  folders: BrandDriveFolders | null;
  brandRulesText: string;
  isBrandConfigured: boolean;
  activeProject?: string;
  introImagePath?: string;
  middleImagePath?: string;
  outroImagePath?: string;
  bankImages: Array<{ fileId: string; name: string; localPath: string }>;
  bankClips: Array<{ fileId: string; name: string; localPath: string }>;
  intrinsicCount: number;
  bankCount: number;
  clipCount: number;
  tempDir: string;
  cleanup: () => void;
}

const DEFAULT_BRAND_RULES_TEMPLATE = `# Marca y Reglas de Marketing

Plantilla en blanco para TU negocio. Edita estos campos en Google Drive o usa /marketing config en Telegram para que la IA los redacte contigo de forma profesional.

- Nombre de marca / negocio:
- Sector y propuesta de valor:
- Slogan o lema principal:
- Tono de comunicación (ej: ejecutivo, cercano, inspirador):
- Web oficial / enlace principal:
- Bot o WhatsApp de contacto:
- Redes sociales:
- Reglas explícitas de vídeo e imágenes (ej: usar siempre imágenes de 01_inicio, 02_medio y 03_cierre; estilo cinema cálido):
`;

const IMAGE_EXT_REGEX = /\.(png|jpe?g|webp|bmp|gif)$/i;
const VIDEO_EXT_REGEX = /\.(mp4|mov|m4v|webm)$/i;
const FOLDER_MIME = "application/vnd.google-apps.folder";

function isImageFile(file: any): boolean {
  const mime = String(file?.mimeType || "").toLowerCase();
  const name = String(file?.name || "");
  if (mime === FOLDER_MIME) return false;
  return mime.startsWith("image/") || IMAGE_EXT_REGEX.test(name);
}

function isVideoFile(file: any): boolean {
  const mime = String(file?.mimeType || "").toLowerCase();
  const name = String(file?.name || "");
  if (mime === FOLDER_MIME) return false;
  return mime.startsWith("video/") || VIDEO_EXT_REGEX.test(name);
}

function slugifyProjectName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function getLocalActiveProjectFile(userId: number): string {
  return path.join(process.cwd(), "data", `user_${userId}`, "agents", "marketing", "active_project.txt");
}

function getLocalBrandRulesFile(userId: number): string {
  return path.join(process.cwd(), "data", `user_${userId}`, "agents", "marketing", "marca_y_reglas.md");
}

async function listFolderFiles(userId: number, folderId: string): Promise<DriveImageFile[]> {
  try {
    const raw = await runGog(
      `drive search "'${folderId}' in parents and trashed = false" --raw-query --json`,
      userId
    );
    const parsed = JSON.parse(raw);
    const files = parsed.files || (Array.isArray(parsed) ? parsed : []);
    return files.map((f: any) => ({
      id: String(f.id),
      name: String(f.name || "asset"),
      mimeType: f.mimeType ? String(f.mimeType) : undefined,
    }));
  } catch (err: any) {
    console.warn(`⚠️ [BrandDrive] No se pudo listar carpeta ${folderId}:`, err.message);
    return [];
  }
}

async function downloadDriveFile(userId: number, fileId: string, outPath: string): Promise<boolean> {
  try {
    await runGog(`drive download ${fileId} --out="${outPath}"`, userId);
    return fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
  } catch (err: any) {
    console.warn(`⚠️ [BrandDrive] Falló descarga de ${fileId}:`, err.message);
    return false;
  }
}

function tokenizeTopic(topic: string): string[] {
  return topic
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
}

export function hasCustomizedBrandRules(content: string): boolean {
  return (content || "")
    .split(/\r?\n/)
    .some((rawLine) => {
      const line = rawLine.trim();
      if (!line.startsWith("- ")) return false;
      let parenDepth = 0;
      for (let i = 2; i < line.length; i++) {
        const ch = line[i];
        if (ch === "(") parenDepth++;
        else if (ch === ")" && parenDepth > 0) parenDepth--;
        else if (ch === ":" && parenDepth === 0) {
          return line.slice(i + 1).trim().length > 0;
        }
      }
      return false;
    });
}

export const brandDriveAssets = {
  getActiveProject(userId: number): string {
    try {
      const p = getLocalActiveProjectFile(userId);
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, "utf8").trim();
      }
    } catch {}
    return "";
  },

  setActiveProject(userId: number, projectName: string): string {
    const slug = slugifyProjectName(projectName);
    const p = getLocalActiveProjectFile(userId);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (slug) {
      fs.writeFileSync(p, slug, "utf8");
    } else if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
    return slug;
  },

  isMarketingConfigured(userId: number): boolean {
    try {
      const localPath = getLocalBrandRulesFile(userId);
      if (fs.existsSync(localPath)) {
        return hasCustomizedBrandRules(fs.readFileSync(localPath, "utf8"));
      }
    } catch {}
    return false;
  },

  /**
   * Revisa Google Drive primero y crea automáticamente todas las carpetas canónicas de marketing
   * (incluyendo clips_cortos y proyectos) y la plantilla en blanco marca_y_reglas.md si no existen.
   */
  async ensureBrandDriveStructure(userId: number): Promise<BrandDriveFolders | null> {
    if (!userId) return null;
    try {
      const rootFolderId = await driveMemoryService.getOrCreateFolderPath(["silvania", "marketing"], userId);
      const intrinsicFolderId = await driveMemoryService.getOrCreateFolderPath(
        ["silvania", "marketing", "imagenes_intrinsecas"],
        userId
      );
      const inicioFolderId = await driveMemoryService.getOrCreateFolderPath(
        ["silvania", "marketing", "imagenes_intrinsecas", "01_inicio"],
        userId
      );
      const medioFolderId = await driveMemoryService.getOrCreateFolderPath(
        ["silvania", "marketing", "imagenes_intrinsecas", "02_medio"],
        userId
      );
      const cierreFolderId = await driveMemoryService.getOrCreateFolderPath(
        ["silvania", "marketing", "imagenes_intrinsecas", "03_cierre"],
        userId
      );
      const bancoVisualFolderId = await driveMemoryService.getOrCreateFolderPath(
        ["silvania", "marketing", "banco_visual"],
        userId
      );
      const clipsCortosFolderId = await driveMemoryService.getOrCreateFolderPath(
        ["silvania", "marketing", "clips_cortos"],
        userId
      );
      const proyectosFolderId = await driveMemoryService.getOrCreateFolderPath(
        ["silvania", "marketing", "proyectos"],
        userId
      );
      const videosFolderId = await driveMemoryService.getOrCreateFolderPath(
        ["silvania", "marketing", "videos"],
        userId
      );

      // Crear marca_y_reglas.md en blanco solo si aún no existe en silvania/marketing
      const existingRootFiles = await listFolderFiles(userId, rootFolderId);
      const hasRulesFile = existingRootFiles.some(
        (f) => f.name.toLowerCase() === "marca_y_reglas.md" || f.name.toLowerCase() === "marca_y_reglas.txt"
      );

      const createdFolders: string[] = [];
      if (!hasRulesFile) {
        const localCacheRules = getLocalBrandRulesFile(userId);
        const content = fs.existsSync(localCacheRules)
          ? fs.readFileSync(localCacheRules, "utf8")
          : DEFAULT_BRAND_RULES_TEMPLATE;
        fs.mkdirSync(path.dirname(localCacheRules), { recursive: true });
        fs.writeFileSync(localCacheRules, content, "utf8");
        try {
          await driveMemoryService.uploadOrReplace(userId, localCacheRules, "marca_y_reglas.md", rootFolderId);
          createdFolders.push("marca_y_reglas.md");
        } catch {}
      }

      return {
        rootFolderId,
        intrinsicFolderId,
        inicioFolderId,
        medioFolderId,
        cierreFolderId,
        bancoVisualFolderId,
        clipsCortosFolderId,
        proyectosFolderId,
        videosFolderId,
        createdFolders,
      };
    } catch (err: any) {
      console.warn(`⚠️ [BrandDrive] Drive no disponible o no vinculado para usuario ${userId}:`, err.message);
      return null;
    }
  },

  /**
   * Crea (o selecciona) una carpeta aislada para un vídeo/campaña en silvania/marketing/proyectos/<slug>.
   */
  async ensureProjectFolderStructure(
    userId: number,
    rawProjectName: string,
    activate: boolean = true
  ): Promise<{
    slug: string;
    projectFolderId: string;
    imagesFolderId: string;
    clipsFolderId: string;
    outputFolderId: string;
  } | null> {
    const slug = slugifyProjectName(rawProjectName);
    if (!slug) return null;
    try {
      const projectFolderId = await driveMemoryService.getOrCreateFolderPath(
        ["silvania", "marketing", "proyectos", slug],
        userId
      );
      const imagesFolderId = await driveMemoryService.getOrCreateFolderPath(
        ["silvania", "marketing", "proyectos", slug, "imagenes"],
        userId
      );
      const clipsFolderId = await driveMemoryService.getOrCreateFolderPath(
        ["silvania", "marketing", "proyectos", slug, "clips"],
        userId
      );
      const outputFolderId = await driveMemoryService.getOrCreateFolderPath(
        ["silvania", "marketing", "proyectos", slug, "entregables"],
        userId
      );

      const files = await listFolderFiles(userId, projectFolderId);
      if (!files.some((f) => f.name.toLowerCase() === "brief.md")) {
        const tmpBrief = path.resolve(process.cwd(), `temp_media/brief_${userId}_${slug}.md`);
        fs.mkdirSync(path.dirname(tmpBrief), { recursive: true });
        fs.writeFileSync(
          tmpBrief,
          `# Proyecto Marketing: ${slug}\n\n- Tema u objetivo del vídeo:\n- Tono y audiencia:\n- Notas para montar los clips e imágenes:\n`,
          "utf8"
        );
        try {
          await driveMemoryService.uploadOrReplace(userId, tmpBrief, "brief.md", projectFolderId);
        } finally {
          if (fs.existsSync(tmpBrief)) fs.unlinkSync(tmpBrief);
        }
      }

      if (activate) {
        this.setActiveProject(userId, slug);
      }

      return { slug, projectFolderId, imagesFolderId, clipsFolderId, outputFolderId };
    } catch (err: any) {
      console.warn(`⚠️ [BrandDrive] Error asegurando proyecto ${slug}:`, err.message);
      return null;
    }
  },

  async listProjects(userId: number): Promise<Array<{ id: string; name: string }>> {
    try {
      const folders = await this.ensureBrandDriveStructure(userId);
      if (!folders) return [];
      const items = await listFolderFiles(userId, folders.proyectosFolderId);
      return items.filter((f) => String(f.mimeType || "").toLowerCase() === FOLDER_MIME || !f.name.includes("."));
    } catch {
      return [];
    }
  },

  /**
   * Revisa Drive primero (creando carpetas faltantes), lee marca_y_reglas.md y descarga
   * bajo demanda las imágenes intrínsecas, banco visual y clips cortos .mp4 (por proyecto si aplica).
   */
  async loadBrandContextAndAssets(
    userId: number,
    topic: string,
    maxBankImages: number = 4,
    explicitProjectName?: string
  ): Promise<BrandDriveBundle> {
    const tempDir = path.resolve(process.cwd(), `temp_media/drive_brand_${userId}_${Date.now()}`);
    const cleanup = () => {
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch {
        // ignore cleanup errors
      }
    };

    const emptyBundle: BrandDriveBundle = {
      folders: null,
      brandRulesText: "",
      isBrandConfigured: this.isMarketingConfigured(userId),
      bankImages: [],
      bankClips: [],
      intrinsicCount: 0,
      bankCount: 0,
      clipCount: 0,
      tempDir,
      cleanup,
    };

    const folders = await this.ensureBrandDriveStructure(userId);
    if (!folders) return emptyBundle;

    fs.mkdirSync(tempDir, { recursive: true });

    let brandRulesText = "";
    try {
      const rootFiles = await listFolderFiles(userId, folders.rootFolderId);
      const rulesFile = rootFiles.find(
        (f) => f.name.toLowerCase() === "marca_y_reglas.md" || f.name.toLowerCase() === "marca_y_reglas.txt"
      );
      if (rulesFile) {
        const rulesPath = path.join(tempDir, rulesFile.name);
        const ok = await downloadDriveFile(userId, rulesFile.id, rulesPath);
        if (ok) {
          const content = fs.readFileSync(rulesPath, "utf8");
          const localCache = getLocalBrandRulesFile(userId);
          fs.mkdirSync(path.dirname(localCache), { recursive: true });
          fs.writeFileSync(localCache, content, "utf8");
          if (hasCustomizedBrandRules(content)) {
            brandRulesText = content.trim().slice(0, 2000);
          }
        }
      }
    } catch {
      // ignore brand rules read errors
    }

    // 1. Imágenes intrínsecas (01_inicio, 02_medio, 03_cierre + raíz de imagenes_intrinsecas)
    const downloadIntrinsic = async (folderId: string, prefix: string): Promise<string | undefined> => {
      const files = (await listFolderFiles(userId, folderId)).filter(isImageFile);
      console.log(`🔍 [BrandDrive] Carpeta ${prefix} (${folderId}): ${files.length} imagen(es) detectada(s).`);
      if (files.length === 0) return undefined;
      const chosen = files[0];
      const ext = path.extname(chosen.name) || ".png";
      const outPath = path.join(tempDir, `${prefix}${ext}`);
      const ok = await downloadDriveFile(userId, chosen.id, outPath);
      if (ok) console.log(`✅ [BrandDrive] Descargada intrínseca ${prefix}: ${chosen.name}`);
      return ok ? outPath : undefined;
    };

    let [introImagePath, middleImagePath, outroImagePath] = await Promise.all([
      downloadIntrinsic(folders.inicioFolderId, "intrinsic_01_inicio"),
      downloadIntrinsic(folders.medioFolderId, "intrinsic_02_medio"),
      downloadIntrinsic(folders.cierreFolderId, "intrinsic_03_cierre"),
    ]);

    if (!introImagePath || !outroImagePath) {
      const rootIntrinsicFiles = (await listFolderFiles(userId, folders.intrinsicFolderId)).filter(isImageFile);
      if (rootIntrinsicFiles.length > 0) {
        const logoFile =
          rootIntrinsicFiles.find((f) => /logo|inicio|intro|marca/i.test(f.name)) || rootIntrinsicFiles[0];
        const ext = path.extname(logoFile.name) || ".png";
        const rootLogoPath = path.join(tempDir, `intrinsic_root_logo${ext}`);
        const ok = await downloadDriveFile(userId, logoFile.id, rootLogoPath);
        if (ok) {
          if (!introImagePath) introImagePath = rootLogoPath;
          if (!outroImagePath) outroImagePath = rootLogoPath;
        }
      }
    }

    const intrinsicCount = [introImagePath, middleImagePath, outroImagePath].filter(Boolean).length;

    // Resolver proyecto específico si se pidió o si hay uno activo
    const activeSlug = slugifyProjectName(explicitProjectName || "") || this.getActiveProject(userId);
    let targetImagesFolderId = folders.bancoVisualFolderId;
    let targetClipsFolderId = folders.clipsCortosFolderId;
    let activeProject: string | undefined;

    if (activeSlug) {
      const proj = await this.ensureProjectFolderStructure(userId, activeSlug, false);
      if (proj) {
        activeProject = proj.slug;
        targetImagesFolderId = proj.imagesFolderId;
        targetClipsFolderId = proj.clipsFolderId;
        try {
          const pFiles = await listFolderFiles(userId, proj.projectFolderId);
          const brief = pFiles.find((f) => f.name.toLowerCase() === "brief.md");
          if (brief) {
            const bPath = path.join(tempDir, "brief.md");
            if (await downloadDriveFile(userId, brief.id, bPath)) {
              const bContent = fs.readFileSync(bPath, "utf8");
              if (hasCustomizedBrandRules(bContent)) {
                brandRulesText = `${brandRulesText}\n\n[PROYECTO ${proj.slug}]:\n${bContent}`.trim().slice(0, 2600);
              }
            }
          }
        } catch {}
      }
    }

    // 2. Banco visual de imágenes (del proyecto activo o global)
    const bankImages: Array<{ fileId: string; name: string; localPath: string }> = [];
    if (maxBankImages > 0) {
      let bankFiles = (await listFolderFiles(userId, targetImagesFolderId)).filter(isImageFile);
      if (bankFiles.length === 0 && targetImagesFolderId !== folders.bancoVisualFolderId) {
        bankFiles = (await listFolderFiles(userId, folders.bancoVisualFolderId)).filter(isImageFile);
      }
      if (bankFiles.length > 0) {
        const syncRows = bankFiles.map((f) => ({
          id: `drive:${userId}:${f.id}`,
          product: `brand_drive_${userId}`,
          category: activeProject ? `proyecto_${activeProject}` : "drive_banco_visual",
          relPath: f.name,
        }));
        marketingDb.syncVisualAssets(syncRows);
        const usageMap = marketingDb.getAssetUsageMap("visual");
        const topicTokens = tokenizeTopic(topic);

        const scored = bankFiles.map((f) => {
          const dbId = `drive:${userId}:${f.id}`;
          const usage = usageMap.get(dbId);
          const isUnused = !usage || usage.status === "sin_usar";
          const normalizedName = f.name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          const nameHits = topicTokens.filter((t) => normalizedName.includes(t)).length;
          return {
            file: f,
            dbId,
            isUnused,
            nameHits,
            useCount: usage?.useCount || 0,
          };
        });

        scored.sort((a, b) => {
          if (b.nameHits !== a.nameHits) return b.nameHits - a.nameHits;
          if (a.isUnused !== b.isUnused) return a.isUnused ? -1 : 1;
          return a.useCount - b.useCount;
        });

        const selected = scored.slice(0, maxBankImages);
        for (let i = 0; i < selected.length; i++) {
          const item = selected[i];
          const ext = path.extname(item.file.name) || ".jpg";
          const outPath = path.join(tempDir, `drive_bank_${i + 1}${ext}`);
          const ok = await downloadDriveFile(userId, item.file.id, outPath);
          if (ok) {
            marketingDb.markAssetUsed("visual", item.dbId);
            bankImages.push({
              fileId: item.file.id,
              name: item.file.name,
              localPath: outPath,
            });
          }
        }
      }
    }

    // 3. Clips cortos .mp4 (del proyecto activo o global)
    const bankClips: Array<{ fileId: string; name: string; localPath: string }> = [];
    if (maxBankImages > 0) {
      let clipFiles = (await listFolderFiles(userId, targetClipsFolderId)).filter(isVideoFile);
      if (clipFiles.length === 0 && targetClipsFolderId !== folders.clipsCortosFolderId) {
        clipFiles = (await listFolderFiles(userId, folders.clipsCortosFolderId)).filter(isVideoFile);
      }
      const selectedClips = clipFiles.slice(0, Math.min(6, maxBankImages));
      for (let i = 0; i < selectedClips.length; i++) {
        const cf = selectedClips[i];
        const ext = path.extname(cf.name) || ".mp4";
        const outPath = path.join(tempDir, `drive_clip_${i + 1}${ext}`);
        const ok = await downloadDriveFile(userId, cf.id, outPath);
        if (ok) {
          console.log(`🎞️ [BrandDrive] Descargado clip corto: ${cf.name}`);
          bankClips.push({
            fileId: cf.id,
            name: cf.name,
            localPath: outPath,
          });
        }
      }
    }

    return {
      folders,
      brandRulesText,
      isBrandConfigured: Boolean(brandRulesText),
      activeProject,
      introImagePath,
      middleImagePath,
      outroImagePath,
      bankImages,
      bankClips,
      intrinsicCount,
      bankCount: bankImages.length,
      clipCount: bankClips.length,
      tempDir,
      cleanup,
    };
  },
};
