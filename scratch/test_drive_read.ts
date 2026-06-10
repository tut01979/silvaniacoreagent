import { driveReadFile } from "../src/tools/drive.js";

async function run() {
  console.log("Testing driveReadFile...");
  try {
    // 1. Test reading package.json (Text file)
    console.log("\n--- TEST 1: package.json (Text file) ---");
    const res1 = await driveReadFile("1PlutCch-Er75TVLJputbbyIde8BaXm4x");
    console.log(res1.substring(0, 500));

    // 2. Test reading PDFDeclaracion20253.pdf (PDF file)
    console.log("\n--- TEST 2: PDFDeclaracion20253.pdf (PDF file) ---");
    const res2 = await driveReadFile("14C0DIYY33e1qFEEkttwY7ZftIs8IA_ew");
    console.log(res2.substring(0, 500));
  } catch (error: any) {
    console.error("❌ Failed:", error.message);
  }
}

run();
