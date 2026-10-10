import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

async function transcribe() {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const audioPath = path.join(process.cwd(), "scratch", "video_audio.mp3");
  const fileStream = fs.createReadStream(audioPath);

  console.log("Transcribiendo audio con Groq whisper-large-v3...");
  const transcription: any = await groq.audio.transcriptions.create({
    file: fileStream,
    model: "whisper-large-v3",
    response_format: "verbose_json",
    language: "es"
  });

  console.log("Longitud de texto:", transcription.text?.length);
  fs.writeFileSync(path.join(process.cwd(), "scratch", "video_transcript.json"), JSON.stringify(transcription, null, 2), "utf-8");
  fs.writeFileSync(path.join(process.cwd(), "scratch", "video_transcript.txt"), transcription.text || "", "utf-8");
  
  if (transcription.segments) {
    let segText = "";
    for (const s of transcription.segments) {
      const startMin = Math.floor(s.start / 60);
      const startSec = Math.floor(s.start % 60);
      const endMin = Math.floor(s.end / 60);
      const endSec = Math.floor(s.end % 60);
      segText += `[${startMin.toString().padStart(2, "0")}:${startSec.toString().padStart(2, "0")} -> ${endMin.toString().padStart(2, "0")}:${endSec.toString().padStart(2, "0")}] ${s.text}\n`;
    }
    fs.writeFileSync(path.join(process.cwd(), "scratch", "video_segments.txt"), segText, "utf-8");
  }
  console.log("Transcripción guardada con éxito.");
}

transcribe().catch(console.error);
