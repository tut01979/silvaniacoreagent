import * as pdf from "pdf-parse";
import fs from "fs";

async function run() {
  console.log("pdf keys:", Object.keys(pdf));
  const pdfParseClass = (pdf as any).PDFParse;
  console.log("PDFParse class type:", typeof pdfParseClass);
  console.log("PDFParse prototype keys:", Object.getOwnPropertyNames(pdfParseClass.prototype));
  console.log("PDFParse keys:", Object.getOwnPropertyNames(pdfParseClass));
  
  // Let's test with the actual PDF file
  const path = "C:\\Users\\eduar\\silvaniacoreagent\\temp_test.json"; // just a placeholder or we can read a file
}

run();
