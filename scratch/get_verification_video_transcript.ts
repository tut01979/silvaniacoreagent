import { YoutubeTranscript } from "youtube-transcript";

async function main() {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript("Z_2j6LYynGY");
    console.log("Transcript length:", transcript.length);
    for (const item of transcript) {
      console.log(`[${Math.round(item.offset / 1000)}s]: ${item.text}`);
    }
  } catch (error) {
    console.error("Error fetching raw transcript:", error);
  }
}

main();
