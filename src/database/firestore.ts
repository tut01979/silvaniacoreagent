import admin from "firebase-admin";
import { config } from "../config/config.js";
import fs from "fs";
import path from "path";

// Generar el archivo de credenciales de Firebase en caliente si está en el entorno
const serviceAccountPath = path.resolve(config.db.serviceAccountPath);

if (process.env.GOOGLE_CREDS_JSON && !fs.existsSync(serviceAccountPath)) {
  try {
    fs.writeFileSync(serviceAccountPath, process.env.GOOGLE_CREDS_JSON);
    console.log("🔑 service-account.json generado dinámicamente en firestore.ts.");
  } catch (err: any) {
    console.error("❌ Error creando service-account.json en firestore.ts:", err.message);
  }
}

// Cargar el archivo de credenciales si existe
if (!fs.existsSync(serviceAccountPath)) {
  console.warn(`⚠️ ADVERTENCIA: No se encontró el archivo de credenciales de Firebase en ${serviceAccountPath}. Las funciones de la nube no estarán disponibles.`);
} else {
  if (!admin.apps.length) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase Admin inicializado correctamente.");
    } catch (err: any) {
      console.error("❌ Error inicializando Firebase Admin:", err.message);
    }
  }
}

let dbInstance: admin.firestore.Firestore | null = null;

function getDb(): admin.firestore.Firestore {
  if (!dbInstance) {
    if (!admin.apps.length) {
      throw new Error("Firebase Admin no ha sido inicializado. No se puede acceder a Firestore.");
    }
    dbInstance = admin.firestore();
  }
  return dbInstance;
}

export const firestoreService = {
  async addMessage(userId: number, role: string, content: string) {
    try {
      const db = getDb();
      const docRef = db.collection("conversations")
        .doc(userId.toString())
        .collection("messages")
        .doc();
      
      await docRef.set({
        role,
        content,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error("Error guardando en Firestore:", error);
    }
  },

  async getHistory(userId: number, limit: number = 20) {
    try {
      const db = getDb();
      const snapshot = await db.collection("conversations")
        .doc(userId.toString())
        .collection("messages")
        .orderBy("timestamp", "desc")
        .limit(limit)
        .get();

      const messages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          role: data.role as "user" | "assistant" | "system",
          content: data.content
        };
      });

      return messages.reverse();
    } catch (error) {
      console.error("Error obteniendo historial de Firestore:", error);
      return [];
    }
  },

  async clearHistory(userId: number) {
    try {
      const db = getDb();
      const messagesRef = db.collection("conversations")
        .doc(userId.toString())
        .collection("messages");
      
      const snapshot = await messagesRef.get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (error) {
      console.error("Error borrando historial en Firestore:", error);
    }
  },

  async setUserEmail(userId: number, email: string) {
    try {
      const db = getDb();
      const docRef = db.collection("user_accounts").doc(userId.toString());
      await docRef.set({ email });
    } catch (error) {
      console.error("Error guardando email en Firestore:", error);
    }
  },

  async getUserEmail(userId: number): Promise<string | null> {
    try {
      const db = getDb();
      const doc = await db.collection("user_accounts").doc(userId.toString()).get();
      if (doc.exists) {
        return doc.data()?.email || null;
      }
      return null;
    } catch (error) {
      console.error("Error obteniendo email de Firestore:", error);
      return null;
    }
  },

  async getAllUsers(): Promise<{ userId: number; email: string }[]> {
    try {
      const db = getDb();
      const snapshot = await db.collection("user_accounts").get();
      return snapshot.docs.map(doc => ({
        userId: parseInt(doc.id),
        email: doc.data().email as string
      }));
    } catch (error) {
      console.error("Error obteniendo todos los usuarios en Firestore:", error);
      return [];
    }
  }
};
