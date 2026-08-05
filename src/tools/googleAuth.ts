import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { dbService } from "../database/db.js";

export function getOAuth2Client() {
  let credentials;
  const credsPath = path.join(process.cwd(), "data", "gmail-credentials.json");
  if (fs.existsSync(credsPath)) {
    credentials = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
  } else {
    console.error("❌ Falta gmail-credentials.json.");
    return null;
  }

  const clientInfo = credentials.installed || credentials.web;
  if (!clientInfo) return null;

  const { client_id, client_secret, redirect_uris } = clientInfo;
  
  // Usar el primer redirect URI por defecto o el de producción de Railway
  let redirectUri = redirect_uris[0];
  const publicUrlRaw = process.env.PUBLIC_URL || (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : "");
  if (publicUrlRaw) {
    const publicUrl = publicUrlRaw.endsWith("/") ? publicUrlRaw.slice(0, -1) : publicUrlRaw;
    redirectUri = `${publicUrl}/auth/google/callback`;
  }

  return new google.auth.OAuth2(client_id, client_secret, redirectUri);
}

export async function getGoogleAuthForUser(userId: number) {
  const oAuth2Client = getOAuth2Client();
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
