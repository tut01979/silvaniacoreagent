import { runGog } from "../src/tools/gogWrapper.js";

async function test() {
  console.log("Testing gog drive commands...");
  try {
    const res = await runGog("drive --help", 1572946817);
    console.log("gog drive --help:\n", res);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
test();
