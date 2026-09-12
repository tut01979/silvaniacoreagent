import { google } from "googleapis";
import { dbService } from "../database/db.js";
import { getGoogleCredentials } from "../services/authHelper.js";

export function getOAuth2Client(userId?: number) {
  const creds = getGoogleCredentials(userId);
  if (!creds) {
    console.error("❌ No se pudieron obtener las credenciales de Google.");
    return null;
  }

  const { client_id, client_secret } = creds;
  
  const publicUrlRaw = process.env.PUBLIC_URL || (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : "");
  const PORT = process.env.PORT || 3000;
  const redirectUri = publicUrlRaw
    ? `${publicUrlRaw.endsWith("/") ? publicUrlRaw.slice(0, -1) : publicUrlRaw}/auth/google/callback`
    : `http://localhost:${PORT}/auth/google/callback`;

  return new google.auth.OAuth2(client_id, client_secret, redirectUri);
}

export async function getGoogleAuthForUser(userId: number) {
  const oAuth2Client = getOAuth2Client(userId);
  if (!oAuth2Client) return null;

  const tokenObj = await dbService.getUserToken(userId);
  if (!tokenObj || !tokenObj.refresh_token) {
    console.warn(`[googleAuth] No se encontró token para el usuario ${userId}`);
    return null;
  }

  oAuth2Client.setCredentials({
    refresh_token: tokenObj.refresh_token
  });

  return oAuth2Client;
}
