import { TwitterApi } from "twitter-api-v2";

const appKey = "0RUzPqKkbNTvTR41GgJ195wg3";
const appSecret = "c8pGmGf8haS9ajvvH5TRkBrnNNwau9jaOoCon6hYsnr02Pvs2V";
const accessToken = "2099626611993673728-EfttLS5Z3MEUe8zn5g17Ra6OYAGkBJ";

const secretCandidates = [
  "00PmuzhEWSb6Ak7mYrWc0VyoL7oK7BI9fUGczEpb11LBs",
  "00PmuzhEWSb6Ak7mYrWc0VyoL7oK7BI9fUGczEpbllLBs",
  "OOPmuzhEWSb6Ak7mYrWc0VyoL7oK7BI9fUGczEpb11LBs",
  "OOPmuzhEWSb6Ak7mYrWc0VyoL7oK7BI9fUGczEpbllLBs",
  "0OPmuzhEWSb6Ak7mYrWc0VyoL7oK7BI9fUGczEpb11LBs",
  "O0PmuzhEWSb6Ak7mYrWc0VyoL7oK7BI9fUGczEpb11LBs",
];

async function tryAll() {
  for (const secret of secretCandidates) {
    console.log("Probando secreto:", secret.slice(0, 5) + "..." + secret.slice(-5));
    const client = new TwitterApi({
      appKey,
      appSecret,
      accessToken,
      accessSecret: secret,
    });

    try {
      const user = await client.v2.me();
      console.log("🎉 ÉXITO CON ESTE SECRETO!", secret);
      console.log("Usuario:", user.data.username);
      return;
    } catch (err: any) {
      console.log("Falló:", err?.data?.detail || err?.message || err?.data);
    }
  }
}

tryAll();
