import fs from "fs";
import path from "path";
import crypto from "crypto";
import { config } from "../config/config.js";

const STATE_SECRET = process.env.TELEGRAM_TOKEN || "silvaniacoreagent_secret_state";

/**
 * Verifica si el usuario es miembro de la lista blanca de beta y si existen credenciales beta.
 * Regla de oro: NUNCA dar cliente beta si el usuario no está en BETA_USER_IDS o si faltan env vars beta.
 */
export function isBetaUser(userId?: number): boolean {
  if (!userId) return false;
  const isWhitelisted = config.oauth.betaUserIds.includes(userId);
  const hasBetaCreds = Boolean(config.oauth.betaClientId && config.oauth.betaClientSecret);
  return isWhitelisted && hasBetaCreds;
}

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

export interface GoogleCredentialsResult {
  client_id: string;
  client_secret: string;
  scopes: string;
  tier: "beta" | "prod";
}

/**
 * Obtiene las credenciales de la API de Google según el nivel del usuario (prod vs beta).
 */
export function getGoogleCredentials(userId?: number): GoogleCredentialsResult | null {
  const useBeta = isBetaUser(userId);

  if (useBeta) {
    return {
      client_id: config.oauth.betaClientId,
      client_secret: config.oauth.betaClientSecret,
      scopes: config.oauth.betaScopes,
      tier: "beta"
    };
  }

  // Si hay credenciales de prod en variables de entorno, usarlas prioritariamente
  if (config.oauth.prodClientId && config.oauth.prodClientSecret) {
    return {
      client_id: config.oauth.prodClientId,
      client_secret: config.oauth.prodClientSecret,
      scopes: config.oauth.prodScopes,
      tier: "prod"
    };
  }

  // Fallback a gmail-credentials.json
  try {
    const credsPath = path.join(process.cwd(), "data", "gmail-credentials.json");
    if (fs.existsSync(credsPath)) {
      const data = JSON.parse(fs.readFileSync(credsPath, "utf8"));
      const clientInfo = data.installed || data.web;
      if (clientInfo) {
        return {
          client_id: clientInfo.client_id,
          client_secret: clientInfo.client_secret,
          scopes: config.oauth.prodScopes,
          tier: "prod"
        };
      }
    }
  } catch (err: any) {
    console.error("Error leyendo gmail-credentials.json:", err.message);
  }
  return null;
}

/**
 * Genera la URL de autorización de Google OAuth adaptada al nivel del usuario (prod o beta).
 */
export function getAuthUrl(userId: number): string | null {
  const creds = getGoogleCredentials(userId);
  if (!creds) return null;

  const clientId = creds.client_id;
  const publicUrlRaw = process.env.PUBLIC_URL || (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : "");
  const PUBLIC_URL = publicUrlRaw.endsWith("/") ? publicUrlRaw.slice(0, -1) : publicUrlRaw;
  const PORT = process.env.PORT || 3000;

  const redirectUri = PUBLIC_URL 
    ? `${PUBLIC_URL}/auth/google/callback` 
    : `http://localhost:${PORT}/auth/google/callback`;

  const secureState = generateSecureState(userId);

  return `https://accounts.google.com/o/oauth2/v2/auth?` +
    `response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(creds.scopes)}` +
    `&state=${secureState}` +
    `&access_type=offline` +
    `&prompt=consent%20select_account`;
}
