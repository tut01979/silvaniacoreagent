import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "../config/config.js";
import { MarketingDraft } from "./types.js";

// Asegurar directorio de base de datos
const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.db.path);
db.pragma("journal_mode = WAL");

// Inicialización de tabla aislada para Marketing Studio
db.exec(`
  CREATE TABLE IF NOT EXISTS marketing_drafts (
    id TEXT PRIMARY KEY,
    userId INTEGER NOT NULL,
    topic TEXT NOT NULL,
    format TEXT NOT NULL,
    status TEXT NOT NULL,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_marketing_drafts_user ON marketing_drafts (userId);
  CREATE INDEX IF NOT EXISTS idx_marketing_drafts_status ON marketing_drafts (status);

  CREATE TABLE IF NOT EXISTS visual_asset_usage (
    id TEXT PRIMARY KEY,
    product TEXT NOT NULL,
    category TEXT NOT NULL,
    rel_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sin_usar',
    use_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_visual_asset_status ON visual_asset_usage (status);

  CREATE TABLE IF NOT EXISTS music_asset_usage (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    rel_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sin_usar',
    use_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_music_asset_status ON music_asset_usage (status);
`);

export const marketingDb = {
  saveDraft(draft: MarketingDraft): void {
    const stmt = db.prepare(`
      INSERT INTO marketing_drafts (id, userId, topic, format, status, data_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        topic = excluded.topic,
        format = excluded.format,
        status = excluded.status,
        data_json = excluded.data_json,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      draft.id,
      draft.userId,
      draft.topic,
      draft.format,
      draft.status,
      JSON.stringify(draft),
      draft.createdAt,
      draft.updatedAt
    );
  },

  getDraft(id: string): MarketingDraft | null {
    const stmt = db.prepare("SELECT data_json FROM marketing_drafts WHERE id = ?");
    const row = stmt.get(id) as { data_json: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.data_json) as MarketingDraft;
    } catch {
      return null;
    }
  },

  listUserDrafts(userId: number, limit: number = 10): MarketingDraft[] {
    const stmt = db.prepare(
      "SELECT data_json FROM marketing_drafts WHERE userId = ? ORDER BY created_at DESC LIMIT ?"
    );
    const rows = stmt.all(userId, limit) as Array<{ data_json: string }>;
    return rows.map(r => JSON.parse(r.data_json) as MarketingDraft);
  },

  updateStatus(id: string, status: MarketingDraft["status"], feedbackNote?: string): boolean {
    const draft = this.getDraft(id);
    if (!draft) return false;

    draft.status = status;
    draft.updatedAt = new Date().toISOString();
    if (feedbackNote) {
      draft.feedbackNote = feedbackNote;
    }
    if (status === "published") {
      draft.publishedAt = new Date().toISOString();
    }

    this.saveDraft(draft);
    return true;
  },

  syncVisualAssets(
    assets: Array<{ id: string; product: string; category: string; relPath: string }>
  ): void {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO visual_asset_usage (id, product, category, rel_path, status, use_count)
      VALUES (?, ?, ?, ?, 'sin_usar', 0)
    `);
    const tx = db.transaction(
      (items: Array<{ id: string; product: string; category: string; relPath: string }>) => {
        for (const item of items) {
          insert.run(item.id, item.product, item.category, item.relPath);
        }
      }
    );
    tx(assets);
  },

  syncMusicAssets(
    assets: Array<{ id: string; category: string; relPath: string }>
  ): void {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO music_asset_usage (id, category, rel_path, status, use_count)
      VALUES (?, ?, ?, 'sin_usar', 0)
    `);
    const tx = db.transaction(
      (items: Array<{ id: string; category: string; relPath: string }>) => {
        for (const item of items) {
          insert.run(item.id, item.category, item.relPath);
        }
      }
    );
    tx(assets);
  },

  getAssetUsageMap(
    pool: "visual" | "music"
  ): Map<string, { status: "sin_usar" | "usado"; useCount: number; lastUsedAt: string | null }> {
    const table = pool === "visual" ? "visual_asset_usage" : "music_asset_usage";
    const rows = db
      .prepare(`SELECT id, status, use_count, last_used_at FROM ${table}`)
      .all() as Array<{
        id: string;
        status: string;
        use_count: number;
        last_used_at: string | null;
      }>;
    const map = new Map<
      string,
      { status: "sin_usar" | "usado"; useCount: number; lastUsedAt: string | null }
    >();
    for (const row of rows) {
      map.set(row.id, {
        status: row.status === "usado" ? "usado" : "sin_usar",
        useCount: row.use_count || 0,
        lastUsedAt: row.last_used_at || null,
      });
    }
    return map;
  },

  markAssetUsed(pool: "visual" | "music", id: string): void {
    const table = pool === "visual" ? "visual_asset_usage" : "music_asset_usage";
    db.prepare(
      `UPDATE ${table} SET status = 'usado', use_count = use_count + 1, last_used_at = ? WHERE id = ?`
    ).run(new Date().toISOString(), id);
  },

  resetAssetPoolToUnused(pool: "visual" | "music"): void {
    const table = pool === "visual" ? "visual_asset_usage" : "music_asset_usage";
    db.prepare(`UPDATE ${table} SET status = 'sin_usar'`).run();
  },

  getAssetPoolStats(pool: "visual" | "music"): {
    total: number;
    unused: number;
    used: number;
  } {
    const table = pool === "visual" ? "visual_asset_usage" : "music_asset_usage";
    const row = db
      .prepare(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'sin_usar' THEN 1 ELSE 0 END) AS unused FROM ${table}`
      )
      .get() as { total: number; unused: number | null };
    const total = row?.total || 0;
    const unused = row?.unused || 0;
    return { total, unused, used: Math.max(0, total - unused) };
  },

  close(): void {
    try {
      db.close();
    } catch {}
  }
};
