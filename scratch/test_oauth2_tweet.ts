import { TwitterApi } from "twitter-api-v2";

// Let's test with OAuth 2.0 Bearer token for user:
const userToken = "SEROcDZtRjZ1TDlYdzRBNHpVTDNaZUU2SEVNYWM3d0Z5N0xZUDdXWkFdktoOjE3ODk0MzAyNTgyMDA6MTowOmF0OjE";

// In twitter-api-v2, you can pass an OAuth2 user token:
const client = new TwitterApi(userToken);

async function run() {
  try {
    // If it's OAuth 2.0 user context, can we post a tweet?
    const res = await client.v2.tweet("Silvania.ai — Prueba de agente inteligente 🚀");
    console.log("✅ Tweet publicado con OAuth 2.0:", res);
  } catch (err: any) {
    console.error("OAuth 2.0 Error:", JSON.stringify(err?.data || err.message, null, 2));
  }
}

run();
