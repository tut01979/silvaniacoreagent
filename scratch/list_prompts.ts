import { runGog } from "../src/tools/gogWrapper.js";
import { driveMemoryService } from "../src/services/driveMemory.js";

async function main() {
  try {
    const userId = 1572946817;
    const folderId = await driveMemoryService.getOrCreateFolderPath(["silvania", "prompts"], userId);
    console.log("Folder ID for prompts:", folderId);
    const searchRes = await runGog(`drive search "'${folderId}' in parents and trashed = false" --json`, userId);
    console.log("Search result:\n", searchRes);
  } catch (err: any) {
    console.error("Error listing prompts:", err.message);
  }
}

main();
