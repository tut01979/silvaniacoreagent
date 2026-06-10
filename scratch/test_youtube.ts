import { YoutubeTranscript } from "youtube-transcript";

async function test() {
  try {
    console.log("Fetching transcript...");
    const transcript = await YoutubeTranscript.fetchTranscript("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    console.log("Success! Characters:", transcript.map(t => t.text).join(" ").length);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

test();
