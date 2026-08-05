import Database from "better-sqlite3";
import { config } from "./config/config.js";

const db = new Database(config.db.path);
try {
  const rows = db.prepare("SELECT * FROM security_incidents ORDER BY id DESC LIMIT 20").all();
  console.log("=== RECENT SECURITY INCIDENTS ===");
  console.log(JSON.stringify(rows, null, 2));
} catch (err: any) {
  console.error("Error reading incidents:", err.message);
}
