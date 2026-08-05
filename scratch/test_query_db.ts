import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "memory.db");
const db = new Database(dbPath);
try {
  const accounts = db.prepare("SELECT * FROM user_accounts").all();
  console.log("Accounts:", accounts);
} catch (e: any) {
  console.error("Error query user_accounts:", e.message);
}
try {
  const tokens = db.prepare("SELECT * FROM user_tokens").all();
  console.log("Tokens count:", tokens.length);
  for (const t of tokens) {
    console.log("UserId:", t.userId, "Token keys:", Object.keys(JSON.parse(t.token)));
  }
} catch (e: any) {
  console.error("Error query user_tokens:", e.message);
}
db.close();
