import { webSearch } from "../src/tools/webSearch.js";

async function run() {
  console.log("Searching...");
  const res = await webSearch("alejavi rivera youtube");
  console.log("Results:\n", res);
}

run().catch(console.error);
