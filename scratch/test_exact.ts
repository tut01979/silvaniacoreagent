import { TwitterApi } from "twitter-api-v2";

const appKey = "0RUzPqKkbNTvTR41GgJ195wg3";
const appSecret = "c8pGmGf8haS9ajvvH5TRkBrnNNwau9jaOoCon6hYsnr02Pvs2V";
const accessToken = "2099626611993673728-EfttLS5Z3MEUe8zn5g17Ra6OYAGkBJ";
const accessSecret = "OOPmuzhEWSb6Ak7mYrWc0VyoL7oK7BI9fUGczEpbllLBs";

const client = new TwitterApi({
  appKey,
  appSecret,
  accessToken,
  accessSecret,
});

async function run() {
  try {
    const user = await client.v2.me();
    console.log("🎉 CONEXIÓN PERFECTA CON X!", user.data.username);
  } catch (err: any) {
    console.error("Error exacto:", JSON.stringify(err?.data || err.message, null, 2));
  }
}

run();
