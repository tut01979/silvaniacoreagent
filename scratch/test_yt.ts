import { youtubeSearch } from "../src/tools/youtube.js";

async function test() {
  const result = await youtubeSearch("Alejavi Rivera Absidian");
  console.log("RESULT:\n", result);
}

test().catch(console.error);
