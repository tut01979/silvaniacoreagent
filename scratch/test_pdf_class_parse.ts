import * as pdf from "pdf-parse";
import fs from "fs";
import { runGog } from "../src/tools/gogWrapper.js";
import path from "path";

async function run() {
  console.log("Testing PDFParse class extraction...");
  const fileId = "14C0DIYY33e1qFEEkttwY7ZftIs8IA_ew";
  const tempPath = path.join(process.cwd(), "temp", "test_doc.pdf");
  
  if (!fs.existsSync(path.dirname(tempPath))) {
    fs.mkdirSync(path.dirname(tempPath), { recursive: true });
  }

  try {
    console.log("Downloading PDF...");
    await runGog(`drive download ${fileId} --out="${tempPath}"`);
    console.log("Downloaded successfully.");

    const dataBuffer = fs.readFileSync(tempPath);
    console.log("File size:", dataBuffer.length, "bytes");

    // Instantiating PDFParse with options
    const parser = new (pdf as any).PDFParse({ data: dataBuffer });
    console.log("Getting text...");
    const textResult = await parser.getText();
    const text = textResult.text;
    
    console.log("Extracted text preview (first 500 chars):");
    console.log(text.substring(0, 500));
    
    // Clean up
    await parser.destroy();
    fs.unlinkSync(tempPath);
  } catch (error: any) {
    console.error("❌ Failed:", error);
  }
}

run();
