import Database from "better-sqlite3";
import path from "path";

async function dumpUsers() {
  const dbPath = path.join(process.cwd(), "data", "memory.db");
  console.log("DB Path:", dbPath);
  const db = new Database(dbPath);
  try {
    const users = db.prepare("SELECT * FROM users").all();
    console.log("Users in DB:", JSON.stringify(users, null, 2));

    const incidents = db.prepare("SELECT * FROM security_incidents ORDER BY id DESC LIMIT 5").all();
    console.log("Recent Incidents:", JSON.stringify(incidents, null, 2));
  } catch (err: any) {
    console.error("Error dumping DB:", err.message);
  } finally {
    db.close();
  }
}

dumpUsers();
