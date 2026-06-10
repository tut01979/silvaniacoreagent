import Database from "better-sqlite3";
import { config } from "../config/config.js";
import { firestoreService } from "./firestore.js";
import fs from "fs";
import path from "path";

const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.db.path);


// Inicializar tablas local
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_accounts (
    userId INTEGER PRIMARY KEY,
    email TEXT NOT NULL
  )
`);

export const dbService = {
  setUserEmail: async (userId: number, email: string) => {
    const stmt = db.prepare("INSERT INTO user_accounts (userId, email) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET email = excluded.email");
    stmt.run(userId, email);

    if (config.db.useFirebase) {
      await firestoreService.setUserEmail(userId, email);
    }
  },

  getUserEmail: async (userId: number): Promise<string | null> => {
    if (config.db.useFirebase) {
      const email = await firestoreService.getUserEmail(userId);
      if (email) return email;
    }

    const stmt = db.prepare("SELECT email FROM user_accounts WHERE userId = ?");
    const row = stmt.get(userId) as { email: string } | undefined;
    return row ? row.email : null;
  },

  getAllUsers: async (): Promise<{ userId: number; email: string }[]> => {
    if (config.db.useFirebase) {
      try {
        const users = await firestoreService.getAllUsers();
        if (users.length > 0) return users;
      } catch (error) {
        console.error("Error obteniendo usuarios de Firestore:", error);
      }
    }
    const stmt = db.prepare("SELECT userId, email FROM user_accounts");
    return stmt.all() as { userId: number; email: string }[];
  },

  addMessage: async (userId: number, role: string, content: string) => {
    // Siempre guardamos en local como respaldo
    const stmt = db.prepare("INSERT INTO messages (userId, role, content) VALUES (?, ?, ?)");
    stmt.run(userId, role, content);

    if (config.db.useFirebase) {
      await firestoreService.addMessage(userId, role, content);
    }
  },

  getHistory: async (userId: number, limit: number = 20) => {
    if (config.db.useFirebase) {
      const history = await firestoreService.getHistory(userId, limit);
      if (history.length > 0) return history;
    }

    // Fallback a local si Firebase está desactivado o no hay datos
    const stmt = db.prepare("SELECT role, content FROM messages WHERE userId = ? ORDER BY timestamp DESC, id DESC LIMIT ?");
    const rows = stmt.all(userId, limit) as { role: string, content: string }[];
    return rows.reverse().map(row => ({
      role: row.role as "user" | "assistant" | "system",
      content: row.content
    }));
  },

  clearHistory: async (userId: number) => {
    const stmt = db.prepare("DELETE FROM messages WHERE userId = ?");
    stmt.run(userId);

    if (config.db.useFirebase) {
      await firestoreService.clearHistory(userId);
    }
  },

  migrateToCloud: async () => {
    console.log("🚛 Iniciando migración a la nube...");
    const allMessages = db.prepare("SELECT userId, role, content FROM messages").all() as any[];
    
    for (const msg of allMessages) {
      await firestoreService.addMessage(msg.userId, msg.role, msg.content);
    }
    console.log(`✅ Migración completada: ${allMessages.length} mensajes subidos.`);
  }
};
