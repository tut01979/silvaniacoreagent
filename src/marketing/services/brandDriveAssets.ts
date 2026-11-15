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
  videosFolderId: string;
  createdFolders: string[];
}

export interface BrandDriveBundle {
  folders: BrandDriveFolders | null;
  brandRulesText: string;
  introImagePath?: string;
  middleImagePath?: string;
  outroImagePath?: string;
  bankImages: Array<{ fileId: string; name: string; localPath: string }>;
  intrinsicCount: number;
  bankCount: number;
  tempDir: string;
  cleanup: () => void;
}

const DEFAULT_BRAND_RULES_TEMPLATE = `# Marca y Reglas de Marketing (Silvania Marketing Studio)

Edita este archivo en tu Google Drive para personalizar tus publicaciones y vídeos.
Si lo dejas tal cual, el agente usará los valores por defecto de Silvania.

- Nombre de marca / negocio:
- Sector y propuesta de valor:
- Slogan o lema principal:
- Tono de comunicación (ej: ejecutivo, cercano, inspirador):
- Web oficial / enlace principal:
- Bot o WhatsApp de contacto:
- Redes sociales:
- Reglas explícitas de vídeo e imágenes (ej: usar siempre las imágenes de 01_inicio, 02_medio y 03_cierre; estilo cinema cálido):
`;

const IMAGE_EXT_REGEX = /\.(png|jpe?g|webp|bmp|gif)$/i;

function isImageFile(file: any): boolean {
  const mime = String(file?.mimeType || "").toLowerCase();
  const name = String(file?.name || "");
  if (mime === "application/vnd.google-apps.folder") return false;
  return mime.startsWith("image/") || IMAGE_EXT_REGEX.test(name);
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

function hasCustomizedBrandRules(content: string): boolean {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "));
  return lines.some((l) => {
    const idx = l.indexOf(":");
    return idx !== -1 && l.slice(idx + 1).trim().length > 0;
  });
}

export const brandDriveAssets = {
  /**
   * Revisa Google Drive primero y crea automáticamente todas las carpetas canónicas de marketing
   * y la plantilla marca_y_reglas.md si no existen.
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
      const videosFolderId = await driveMemoryService.getOrCreateFolderPath(
        ["silvania", "marketing", "videos"],
        userId
      );

      // Crear marca_y_reglas.md solo si aún no existe en silvania/marketing
      const existingRootFiles = await listFolderFiles(userId, rootFolderId);
      const hasRulesFile = existingRootFiles.some(
        (f) => f.name.toLowerCase() === "marca_y_reglas.md" || f.name.toLowerCase() === "marca_y_reglas.txt"
      );

      const createdFolders: string[] = [];
      if (!hasRulesFile) {
        const tmpTemplate = path.resolve(process.cwd(), `temp_media/marca_y_reglas_${userId}.md`);
        fs.mkdirSync(path.dirname(tmpTemplate), { recursive: true });
        fs.writeFileSync(tmpTemplate, DEFAULT_BRAND_RULES_TEMPLATE, "utf8");
        try {
          await driveMemoryService.uploadOrReplace(userId, tmpTemplate, "marca_y_reglas.md", rootFolderId);
          createdFolders.push("marca_y_reglas.md");
        } finally {
          if (fs.existsSync(tmpTemplate)) fs.unlinkSync(tmpTemplate);
        }
      }

      return {
        rootFolderId,
        intrinsicFolderId,
        inicioFolderId,
        medioFolderId,
        cierreFolderId,
        bancoVisualFolderId,
        videosFolderId,
        createdFolders,
      };
    } catch (err: any) {
      console.warn(`⚠️ [BrandDrive] Drive no disponible o no vinculado para usuario ${userId}:`, err.message);
      return null;
    }
  },

  /**
   * Revisa Drive primero (creando carpetas faltantes), lee marca_y_reglas.md y descarga
   * bajo demanda las imágenes intrínsecas (inicio/medio/cierre) y del banco visual del usuario.
   */
  async loadBrandContextAndAssets(
    userId: number,
    topic: string,
    maxBankImages: number = 4
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
      bankImages: [],
      intrinsicCount: 0,
      bankCount: 0,
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

    // Si el usuario pegó su logo/imagen directamente en la raíz de imagenes_intrinsecas/
    if (!introImagePath || !outroImagePath) {
      const rootIntrinsicFiles = (await listFolderFiles(userId, folders.intrinsicFolderId)).filter(isImageFile);
      console.log(`🔍 [BrandDrive] Raíz imagenes_intrinsecas: ${rootIntrinsicFiles.length} imagen(es) detectada(s).`);
      if (rootIntrinsicFiles.length > 0) {
        const logoFile =
          rootIntrinsicFiles.find((f) => /logo|inicio|intro|marca/i.test(f.name)) || rootIntrinsicFiles[0];
        const ext = path.extname(logoFile.name) || ".png";
        const rootLogoPath = path.join(tempDir, `intrinsic_root_logo${ext}`);
        const ok = await downloadDriveFile(userId, logoFile.id, rootLogoPath);
        if (ok) {
          console.log(`✅ [BrandDrive] Logo detectado en raíz imagenes_intrinsecas: ${logoFile.name}`);
          if (!introImagePath) introImagePath = rootLogoPath;
          if (!outroImagePath) outroImagePath = rootLogoPath;
        }
      }
    }

    const intrinsicCount = [introImagePath, middleImagePath, outroImagePath].filter(Boolean).length;

    // 2. Banco visual del usuario en Drive (con ciclo sin_usar -> usado por usuario)
    const bankImages: Array<{ fileId: string; name: string; localPath: string }> = [];
    if (maxBankImages > 0) {
      const bankFiles = (await listFolderFiles(userId, folders.bancoVisualFolderId)).filter(isImageFile);
      if (bankFiles.length > 0) {
        const syncRows = bankFiles.map((f) => ({
          id: `drive:${userId}:${f.id}`,
          product: `brand_drive_${userId}`,
          category: "drive_banco_visual",
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

        // Prioridad: coincidencia explícita con el tema -> sin_usar -> menor uso
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

    return {
      folders,
      brandRulesText,
      introImagePath,
      middleImagePath,
      outroImagePath,
      bankImages,
      intrinsicCount,
      bankCount: bankImages.length,
      tempDir,
      cleanup,
    };
  },
};

