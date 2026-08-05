import fs from "fs";
import path from "path";
import crypto from "crypto";

const STATE_SECRET = process.env.TELEGRAM_TOKEN || "silvaniacoreagent_secret_state";

/**
 * Genera el estado firmado seguro para proteger el callback OAuth contra ataques CSRF.
 */
export function generateSecureState(userId: number): string {
  const hash = crypto.createHmac("sha256", STATE_SECRET).update(userId.toString()).digest("hex");
  return `${userId}:${hash}`;
}

/**
 * Verifica si el estado de respuesta de OAuth es seguro y retorna el userId si es válido.
 */
export function verifySecureState(state: string): number | null {
  if (!state) return null;
  const parts = state.split(":");
  if (parts.length !== 2) return null;
  const userId = parseInt(parts[0]);
  const hash = parts[1];
  if (isNaN(userId)) return null;
  const expectedHash = crypto.createHmac("sha256", STATE_SECRET).update(userId.toString()).digest("hex");
  if (hash !== expectedHash) return null;
  return userId;
}

/**
 * Obtiene las credenciales de la API de Google del servidor.
 */
export function getGoogleCredentials(): any {
  try {
    const credsPath = path.join(process.cwd(), "data", "gmail-credentials.json");
    if (fs.existsSync(credsPath)) {
      const data = JSON.parse(fs.readFileSync(credsPath, "utf8"));
      return data.installed || data.web || null;
    }
  } catch (err: any) {
    console.error("Error leyendo gmail-credentials.json:", err.message);
  }
  return null;
}

/**
 * Genera la URL de autorización de Google OAuth unificada.
 */
export function getAuthUrl(userId: number): string | null {
  const creds = getGoogleCredentials();
  if (!creds) return null;

  const clientId = creds.client_id;
  const publicUrlRaw = process.env.PUBLIC_URL || (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : "");
  const PUBLIC_URL = publicUrlRaw.endsWith("/") ? publicUrlRaw.slice(0, -1) : publicUrlRaw;
  const PORT = process.env.PORT || 3000;

  const redirectUri = PUBLIC_URL 
    ? `${PUBLIC_URL}/auth/google/callback` 
    : `http://localhost:${PORT}/auth/google/callback`;

  const scopes = [
    "openid",
    "profile",
    "email",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/spreadsheets"
  ].join(" ");

  const secureState = generateSecureState(userId);

  return `https://accounts.google.com/o/oauth2/v2/auth?` +
    `response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${secureState}` +
    `&access_type=offline` +
    `&prompt=consent%20select_account`;
}
