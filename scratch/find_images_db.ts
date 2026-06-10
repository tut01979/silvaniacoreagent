import Database from "better-sqlite3";
import { config } from "../src/config/config.js";

const db = new Database(config.db.path);

try {
  const rows = db.prepare("SELECT * FROM messages WHERE content LIKE '%imagen%' OR content LIKE '%foto%' OR content LIKE '%Error%' OR content LIKE '%procesar%' ORDER BY id DESC LIMIT 50").all();
  console.log("Resultados de búsqueda en base de datos local:");
  console.log(JSON.stringify(rows, null, 2));
} catch (e) {
  console.error("Error consultando la base de datos:", e);
}
