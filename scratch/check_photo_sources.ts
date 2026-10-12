import axios from "axios";

async function main() {
  console.log("Checking image sources...");
  
  // Test 1: Unsplash direct commercial curated photo
  try {
    const uResp = await axios.get("https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1280&h=720&fit=crop&q=80", {
      responseType: "arraybuffer",
      timeout: 10000,
    });
    console.log("1. Unsplash curated photo:", uResp.status, "Bytes:", uResp.data.length);
  } catch (err: any) {
    console.log("1. Unsplash error:", err.message);
  }

  // Test 2: Pollinations
  try {
    const pResp = await axios.get("https://image.pollinations.ai/prompt/professional%20executive%20woman%20looking%20at%20calendar%20on%20laptop%20in%20office?width=1280&height=720&nologo=true", {
      responseType: "arraybuffer",
      timeout: 15000,
    });
    console.log("2. Pollinations test:", pResp.status, "Bytes:", pResp.data.length);
  } catch (err: any) {
    console.log("2. Pollinations error:", err.response?.status, err.message);
  }
}

main();
