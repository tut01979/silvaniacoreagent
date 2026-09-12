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
  }
};
