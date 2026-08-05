import { runGog } from "../src/tools/gogWrapper.js";
import { userContextStore } from "../src/services/context.js";

userContextStore.run({ userId: 1572946817 }, async () => {
  try {
    console.log("Searching messages...");
    const res = await runGog('gmail messages search "in:inbox" --max=3 --json');
    console.log("Result:", res);
  } catch (e: any) {
    console.error("Error:", e.message);
  }
});
