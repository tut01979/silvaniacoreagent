async function run() {
  const pdfParseModule = await import("pdf-parse");
  console.log("Module type:", typeof pdfParseModule);
  console.log("Module keys:", Object.keys(pdfParseModule));
  console.log("Module default type:", typeof pdfParseModule.default);
  console.log("Module value representation:", pdfParseModule);
}

run();
