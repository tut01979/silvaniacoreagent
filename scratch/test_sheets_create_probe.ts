import { runGog } from "../src/tools/gogWrapper.js";

async function main() {
  try {
    const res = await runGog('sheets create "TestInspectOutput" --json', 1572946817);
    console.log("OUTPUT RAW:\n", res);
  } catch (e: any) {
    console.error("ERROR:", e.message);
  }
}

main();
