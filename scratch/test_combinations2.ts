import { TwitterApi } from "twitter-api-v2";

const candidateKeys = [
  "0RUzPqKkbNTvTR41GgJ195wg3",
  "ORUzPqKkbNTvTR41GgJ195wg3"
];

const candidateSecrets = [
  "c8pGmGf8haS9ajvvH5TRkBrnNNwau9jaOoCon6hYsnr02Pvs2V",
  "c8pGmGf8haS9ajvvH5TRkBrnNNwau9ja0oCon6hYsnr02Pvs2V",
  "c8pGmGf8haS9ajvvH5TRkBrnNNwau9jaO0Con6hYsnr02Pvs2V",
  "c8pGmGf8haS9ajvvH5TRkBrnNNwau9ja00Con6hYsnr02Pvs2V"
];

const accessToken = "2099626611993673728-EfttLS5Z3MEUe8zn5g17Ra6OYAGkBJ";
const accessSecret = "OOPmuzhEWSb6Ak7mYrWc0VyoL7oK7BI9fUGczEpbllLBs";

async function run() {
  for (const k of candidateKeys) {
    for (const s of candidateSecrets) {
      console.log("Probando:", k.slice(0, 3), s.slice(30, 36));
      const client = new TwitterApi({
        appKey: k,
        appSecret: s,
        accessToken,
        accessSecret,
      });
      try {
        const user = await client.v2.me();
        console.log("🎉 ÉXITO TOTAL!", user.data.username);
        return;
      } catch (err: any) {
        // fail
      }
    }
  }
  console.log("Ninguna variante coincidió.");
}

run();
