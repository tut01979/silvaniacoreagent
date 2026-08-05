import fs from "fs";

function getPngDimensions(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  // PNG signature is 8 bytes
  // IHDR chunk starts at offset 12. Width is at offset 16 (4 bytes), Height is at offset 20 (4 bytes)
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

try {
  const dimensions = getPngDimensions("public/robot.png");
  console.log(`DIMENSIONS: ${dimensions.width}x${dimensions.height}`);
} catch (err: any) {
  console.error("Error reading image:", err.message);
}
