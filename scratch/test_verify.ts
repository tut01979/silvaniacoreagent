import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
dotenv.config();

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_SECRET!,
});

async function check() {
  try {
    const user = await client.v1.verifyCredentials();
    console.log("✅ v1.1 Verify credentials SUCCESS:", user.screen_name);
  } catch (err: any) {
    console.error("v1.1 Error:", err?.data || err.message);
  }

  try {
    const userV2 = await client.v2.me();
    console.log("✅ v2.me SUCCESS:", userV2.data.username);
  } catch (err: any) {
    console.error("v2 Error:", err?.data || err.message);
  }
}

check();
