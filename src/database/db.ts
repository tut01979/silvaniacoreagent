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


// Sistema de Migración de Esquemas de Base de Datos
let currentVersion = 0;
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY
  )
`);

try {
  const row = db.prepare("SELECT MAX(version) as version FROM schema_migrations").get() as { version: number | null };
  currentVersion = row?.version || 0;
} catch (err: any) {
  console.error("⚠️ Error leyendo tabla schema_migrations:", err.message);
}

const migrations: { [version: number]: () => void } = {
  1: () => {
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

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_tokens (
        userId INTEGER PRIMARY KEY,
        token TEXT NOT NULL
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_settings (
        userId INTEGER PRIMARY KEY,
        muteVoice INTEGER DEFAULT 0,
        customPrompt TEXT
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS security_incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        username TEXT,
        reason TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        userId INTEGER PRIMARY KEY,
        stripeCustomerId TEXT,
        stripeSubscriptionId TEXT,
        status TEXT NOT NULL,
        trialEndsAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  },
  2: () => {
    try {
      db.exec("ALTER TABLE user_settings ADD COLUMN configLastSyncTime TEXT");
      db.exec("ALTER TABLE user_settings ADD COLUMN configLastSyncSize INTEGER");
    } catch (e: any) {
      console.warn("⚠️ Columnas configLastSyncTime/Size ya existían en user_settings:", e.message);
    }
  },
  3: () => {
    try {
      db.exec("ALTER TABLE user_settings ADD COLUMN customPrompt TEXT");
    } catch (e: any) {
      console.warn("⚠️ Columna customPrompt ya existía en user_settings:", e.message);
    }
  }
};

const targetVersion = Math.max(...Object.keys(migrations).map(Number));
for (let v = currentVersion + 1; v <= targetVersion; v++) {
  console.log(`📦 [DB] Aplicando migración de esquema versión ${v}...`);
  try {
    db.transaction(() => {
      migrations[v]();
      db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(v);
    })();
    console.log(`✅ [DB] Migración de esquema versión ${v} completada.`);
  } catch (err: any) {
    console.error(`❌ [DB] Error aplicando migración versión ${v}:`, err.message);
    throw err;
  }
}

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

  hasLocalHistory: (userId: number): boolean => {
    try {
      const stmt = db.prepare("SELECT 1 FROM messages WHERE userId = ? LIMIT 1");
      return stmt.get(userId) !== undefined;
    } catch {
      return false;
    }
  },

  searchMessagesByTopic: async (userId: number, keywords: string[]) => {
    if (!keywords || keywords.length === 0) return [];
    try {
      const conditions = keywords.map(() => "content LIKE ?").join(" OR ");
      const params = keywords.map(k => `%${k}%`);
      const stmt = db.prepare(`SELECT timestamp, role, content FROM messages WHERE userId = ? AND (${conditions}) ORDER BY id ASC`);
      return stmt.all(userId, ...params) as { timestamp: string; role: string; content: string }[];
    } catch (err: any) {
      console.error("Error buscando mensajes por tema en DB:", err.message);
      return [];
    }
  },

  getTodayMessages: async (userId: number): Promise<{ role: string; content: string; timestamp: string }[]> => {
    const stmt = db.prepare(`
      SELECT role, content, datetime(timestamp, 'localtime') as localTimestamp 
      FROM messages 
      WHERE userId = ? AND date(timestamp, 'localtime') = date('now', 'localtime')
      ORDER BY id ASC
    `);
    const rows = stmt.all(userId) as { role: string; content: string; localTimestamp: string }[];
    return rows.map(r => ({
      role: r.role,
      content: r.content,
      timestamp: r.localTimestamp
    }));
  },

  isAwaitingSearchResponse: async (userId: number): Promise<boolean> => {
    try {
      const stmt = db.prepare("SELECT role, content FROM messages WHERE userId = ? ORDER BY timestamp DESC, id DESC LIMIT 2");
      const rows = stmt.all(userId) as { role: string; content: string }[];
      if (rows.length > 0) {
        const assistantMsg = rows.find(r => r.role === "assistant");
        if (assistantMsg) {
          const content = assistantMsg.content.toLowerCase();
          return /voy a buscar|un momento|dejame buscar|déjame buscar|buscando|espera|procesando|analizando/i.test(content);
        }
      }
      return false;
    } catch {
      return false;
    }
  },

  clearHistory: async (userId: number) => {
    const stmt = db.prepare("DELETE FROM messages WHERE userId = ?");
    stmt.run(userId);

    if (config.db.useFirebase) {
      await firestoreService.clearHistory(userId);
    }
  },

  saveUserToken: async (userId: number, token: any) => {
    const stmt = db.prepare("INSERT INTO user_tokens (userId, token) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET token = excluded.token");
    stmt.run(userId, JSON.stringify(token));

    if (config.db.useFirebase) {
      await firestoreService.saveUserToken(userId, token);
    }
  },

  getUserToken: async (userId: number): Promise<any | null> => {
    if (config.db.useFirebase) {
      const token = await firestoreService.getUserToken(userId);
      if (token) return token;
    }

    const stmt = db.prepare("SELECT token FROM user_tokens WHERE userId = ?");
    const row = stmt.get(userId) as { token: string } | undefined;
    return row ? JSON.parse(row.token) : null;
  },

  getMuteVoice: async (userId: number): Promise<boolean> => {
    try {
      const stmt = db.prepare("SELECT muteVoice FROM user_settings WHERE userId = ?");
      const row = stmt.get(userId) as { muteVoice: number } | undefined;
      return row ? row.muteVoice === 1 : false;
    } catch {
      return false;
    }
  },

  setMuteVoice: async (userId: number, mute: boolean) => {
    try {
      const stmt = db.prepare("INSERT INTO user_settings (userId, muteVoice) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET muteVoice = excluded.muteVoice");
      stmt.run(userId, mute ? 1 : 0);
    } catch (err: any) {
      console.error("Error guardando settings de voz:", err.message);
    }
  },

  getCustomPrompt: async (userId: number): Promise<string | null> => {
    try {
      const stmt = db.prepare("SELECT customPrompt FROM user_settings WHERE userId = ?");
      const row = stmt.get(userId) as { customPrompt: string | null } | undefined;
      return row ? row.customPrompt : null;
    } catch {
      return null;
    }
  },

  setCustomPrompt: async (userId: number, prompt: string) => {
    try {
      const stmt = db.prepare("INSERT INTO user_settings (userId, customPrompt) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET customPrompt = excluded.customPrompt");
      stmt.run(userId, prompt);
    } catch (err: any) {
      console.error("Error guardando customPrompt en BD:", err.message);
    }
  },

  logSecurityIncident: async (userId: number, username: string | null, reason: string) => {
    try {
      const stmt = db.prepare("INSERT INTO security_incidents (userId, username, reason) VALUES (?, ?, ?)");
      stmt.run(userId, username, reason);
      console.log("🔒 Incidente de seguridad registrado en la base de datos.");
    } catch (err: any) {
      console.error("Error guardando incidente de seguridad en BD:", err.message);
    }
  },

  getSecurityStats: async (): Promise<{
    total: number;
    today: number;
    week: number;
    byType: { [key: string]: number };
  }> => {
    try {
      const totalRow = db.prepare("SELECT COUNT(*) as count FROM security_incidents").get() as { count: number };
      const todayRow = db.prepare("SELECT COUNT(*) as count FROM security_incidents WHERE timestamp >= datetime('now', 'start of day')").get() as { count: number };
      const weekRow = db.prepare("SELECT COUNT(*) as count FROM security_incidents WHERE timestamp >= datetime('now', '-7 days')").get() as { count: number };
      
      const allIncidents = db.prepare("SELECT reason FROM security_incidents").all() as { reason: string }[];
      
      const byType: { [key: string]: number } = {
        "Inyección de Comandos": 0,
        "Archivo Bloqueado": 0,
        "Rate Limit Excedido": 0,
        "Violación de CSP": 0,
        "Otro": 0
      };

      for (const row of allIncidents) {
        const r = row.reason;
        if (r.includes("CSP")) {
          byType["Violación de CSP"]++;
        } else if (r.includes("Rate Limit")) {
          byType["Rate Limit Excedido"]++;
        } else if (r.includes("ejecutable") || r.includes("extensión") || r.includes("Archivo ejecutable")) {
          byType["Archivo Bloqueado"]++;
        } else if (r.includes("Inyección") || r.includes("comando") || r.includes("destructivas") || r.includes("consola")) {
          byType["Inyección de Comandos"]++;
        } else {
          byType["Otro"]++;
        }
      }

      return {
        total: totalRow?.count || 0,
        today: todayRow?.count || 0,
        week: weekRow?.count || 0,
        byType
      };
    } catch (err: any) {
      console.error("Error obteniendo estadísticas de seguridad:", err.message);
      return { total: 0, today: 0, week: 0, byType: {} };
    }
  },

  getRecentIncidents: async (filter?: string, limit: number = 10): Promise<any[]> => {
    try {
      let query = "SELECT id, userId, username, reason, datetime(timestamp, 'localtime') as timestamp FROM security_incidents";
      const params: any[] = [];
      
      if (filter === "hoy") {
        query += " WHERE timestamp >= datetime('now', 'start of day')";
      } else if (filter === "semana") {
        query += " WHERE timestamp >= datetime('now', '-7 days')";
      }
      
      query += " ORDER BY id DESC LIMIT ?";
      params.push(limit);
      
      return db.prepare(query).all(...params);
    } catch (err: any) {
      console.error("Error obteniendo incidentes filtrados:", err.message);
      return [];
    }
  },

  // Exportar todos para CSV
  getAllIncidentsForExport: async (): Promise<any[]> => {
    try {
      return db.prepare("SELECT id, userId, username, reason, datetime(timestamp, 'localtime') as timestamp FROM security_incidents ORDER BY id DESC").all();
    } catch (err: any) {
      console.error("Error obteniendo todos los incidentes:", err.message);
      return [];
    }
  },

  getSubscription: async (userId: number): Promise<{
    userId: number;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    status: string;
    trialEndsAt: string;
  } | null> => {
    if (config.db.useFirebase) {
      const fbSub = await firestoreService.getUserSubscription(userId);
      if (fbSub) {
        return {
          userId,
          stripeCustomerId: fbSub.stripeCustomerId || null,
          stripeSubscriptionId: fbSub.stripeSubscriptionId || null,
          status: fbSub.status,
          trialEndsAt: fbSub.trialEndsAt || ""
        };
      }
    }
    try {
      const stmt = db.prepare("SELECT * FROM user_subscriptions WHERE userId = ?");
      const row = stmt.get(userId) as any;
      return row || null;
    } catch {
      return null;
    }
  },

  createOrUpdateSubscription: async (
    userId: number,
    status: string,
    stripeCustomerId: string | null,
    stripeSubscriptionId: string | null,
    trialEndsAt: string | null
  ) => {
    const stmt = db.prepare(`
      INSERT INTO user_subscriptions (userId, status, stripeCustomerId, stripeSubscriptionId, trialEndsAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(userId) DO UPDATE SET
        status = excluded.status,
        stripeCustomerId = COALESCE(excluded.stripeCustomerId, user_subscriptions.stripeCustomerId),
        stripeSubscriptionId = COALESCE(excluded.stripeSubscriptionId, user_subscriptions.stripeSubscriptionId),
        trialEndsAt = COALESCE(excluded.trialEndsAt, user_subscriptions.trialEndsAt)
    `);
    stmt.run(userId, status, stripeCustomerId, stripeSubscriptionId, trialEndsAt);

    if (config.db.useFirebase) {
      await firestoreService.saveUserSubscription(userId, {
        status,
        stripeCustomerId,
        stripeSubscriptionId,
        trialEndsAt
      });
    }
  },

  checkUserBillingStatus: async (userId: number): Promise<{ isBlocked: boolean; status: string; trialEndsAt: string }> => {
    // Bypass incondicional del administrador Jesús
    if (userId === 1572946817) {
      return { isBlocked: false, status: "active", trialEndsAt: new Date(Date.now() + 365*24*60*60*1000).toISOString() };
    }
    let sub = await dbService.getSubscription(userId);
    const now = new Date();
    
    if (!sub) {
      // Registrar un nuevo usuario en periodo de prueba de 7 días
      const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const trialEndsStr = trialEnds.toISOString();
      await dbService.createOrUpdateSubscription(userId, "trialing", null, null, trialEndsStr);
      return { isBlocked: false, status: "trialing", trialEndsAt: trialEndsStr };
    }
    
    if (sub.status === "active") {
      return { isBlocked: false, status: "active", trialEndsAt: sub.trialEndsAt };
    }
    
    if (sub.status === "trialing") {
      const trialEnds = new Date(sub.trialEndsAt);
      if (now.getTime() < trialEnds.getTime()) {
        return { isBlocked: false, status: "trialing", trialEndsAt: sub.trialEndsAt };
      } else {
        // La prueba ha expirado
        return { isBlocked: true, status: "trialing", trialEndsAt: sub.trialEndsAt };
      }
    }
    
    // Cualquier otro estado (past_due, canceled) se bloquea
    return { isBlocked: true, status: sub.status, trialEndsAt: sub.trialEndsAt };
  },

  getUserIdByStripeCustomerId: async (stripeCustomerId: string): Promise<number | null> => {
    try {
      const stmt = db.prepare("SELECT userId FROM user_subscriptions WHERE stripeCustomerId = ?");
      const row = stmt.get(stripeCustomerId) as { userId: number } | undefined;
      return row ? row.userId : null;
    } catch {
      return null;
    }
  },

  getUserIdByStripeSubscriptionId: async (stripeSubscriptionId: string): Promise<number | null> => {
    try {
      const stmt = db.prepare("SELECT userId FROM user_subscriptions WHERE stripeSubscriptionId = ?");
      const row = stmt.get(stripeSubscriptionId) as { userId: number } | undefined;
      return row ? row.userId : null;
    } catch {
      return null;
    }
  },

  migrateToCloud: async () => {
    console.log("🚛 Iniciando migración a la nube...");
    const allMessages = db.prepare("SELECT userId, role, content FROM messages").all() as any[];
    
    for (const msg of allMessages) {
      await firestoreService.addMessage(msg.userId, msg.role, msg.content);
    }
    console.log(`✅ Migración completada: ${allMessages.length} mensajes subidos.`);
  },

  getConfigSyncInfo: async (userId: number): Promise<{ lastSyncTime: string | null, lastSyncSize: number | null }> => {
    try {
      const stmt = db.prepare("SELECT configLastSyncTime, configLastSyncSize FROM user_settings WHERE userId = ?");
      const row = stmt.get(userId) as any;
      return {
        lastSyncTime: row?.configLastSyncTime || null,
        lastSyncSize: row?.configLastSyncSize !== undefined && row?.configLastSyncSize !== null ? Number(row.configLastSyncSize) : null
      };
    } catch {
      return { lastSyncTime: null, lastSyncSize: null };
    }
  },

  setConfigSyncInfo: async (userId: number, lastSyncTime: string, lastSyncSize: number): Promise<void> => {
    try {
      const stmt = db.prepare(`
        INSERT INTO user_settings (userId, configLastSyncTime, configLastSyncSize)
        VALUES (?, ?, ?)
        ON CONFLICT(userId) DO UPDATE SET
          configLastSyncTime = excluded.configLastSyncTime,
          configLastSyncSize = excluded.configLastSyncSize
      `);
      stmt.run(userId, lastSyncTime, lastSyncSize);
    } catch (err: any) {
      console.error(`❌ Error en setConfigSyncInfo para usuario ${userId}:`, err.message);
    }
  }
};
