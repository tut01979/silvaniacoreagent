import { execSync } from "child_process";
import fs from "fs";
import { getFfmpegBinary } from "../src/marketing/services/videoAssembler.js";

const ffmpeg = getFfmpegBinary();
console.log("FFmpeg binary:", ffmpeg);

// Test 1: drawtext
try {
  execSync(`"${ffmpeg}" -y -f lavfi -i color=c=0x1E1E2E:s=1280x720:d=1 -vf "drawtext=text='Escena 1 Silvania':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2" -frames:v 1 temp/test_drawtext.jpg`, { stdio: "pipe" });
  console.log("✅ Test 1 drawtext OK, size:", fs.statSync("temp/test_drawtext.jpg").size);
} catch (e: any) {
  console.log("❌ Test 1 drawtext failed:", e.message);
  if (e.stderr) console.log(e.stderr.toString());
}

// Test 2: solid color with title
try {
  execSync(`"${ffmpeg}" -y -f lavfi -i color=c=0x0F172A:s=1280x720:d=1 -frames:v 1 temp/test_solid.jpg`, { stdio: "pipe" });
  console.log("✅ Test 2 solid OK, size:", fs.statSync("temp/test_solid.jpg").size);
} catch (e: any) {
  console.log("❌ Test 2 solid failed:", e.message);
}
