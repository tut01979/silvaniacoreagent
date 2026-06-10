import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(fs.readFileSync("./service-account.json", "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function test() {
  try {
    console.log("Intentando escribir en Firestore...");
    await db.collection("test").add({ date: new Date() });
    console.log("✅ Escritura exitosa!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

test();
