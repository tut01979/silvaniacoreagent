import admin from "firebase-admin";
import { config } from "../config/config.js";
import fs from "fs";
import path from "path";

// Cargar el archivo de credenciales
const serviceAccountPath = path.resolve(config.db.serviceAccountPath);

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ ERROR: No se encontró el archivo de credenciales en ${serviceAccountPath}`);
} else {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin inicializado correctamente.");
  }
}

const db = admin.firestore();

export const firestoreService = {
  async addMessage(userId: number, role: string, content: string) {
    try {
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
      const docRef = db.collection("user_accounts").doc(userId.toString());
      await docRef.set({ email });
    } catch (error) {
      console.error("Error guardando email en Firestore:", error);
    }
  },

  async getUserEmail(userId: number): Promise<string | null> {
    try {
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
