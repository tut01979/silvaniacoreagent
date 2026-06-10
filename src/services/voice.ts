import axios from "axios";
import fs from "fs";
import path from "path";
import { config } from "../config/config.js";
import * as googleTTS from 'google-tts-api';
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

// Función auxiliar para dividir textos muy largos en fragmentos y evitar límites en las APIs
function splitTextIntoChunks(text: string, maxLength: number = 2000): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|\s+[^.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk.length + sentence.length) <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

export const voiceService = {
  async textToSpeech(text: string, userId: number): Promise<string[]> {
    if (!fs.existsSync(config.tempDir)) fs.mkdirSync(config.tempDir);
    
    // Cortamos en fragmentos de unos 2000 caracteres (aprox. 2-3 minutos de voz por nota)
    const chunks = splitTextIntoChunks(text, 2000); 
    const generatedFiles: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const fileName = `reply_${userId}_${Date.now()}_part${i}.mp3`;
      const filePath = path.join(config.tempDir, fileName);
      let success = false;

      // INTENTO 1: ELEVENLABS (Premium)
      if (config.voice.elevenLabsKey && !success) {
        try {
          console.log(`🎙️ Intentando ElevenLabs para la parte ${i+1}...`);
          const voiceId = config.voice.voiceId || "21m00Tcm4TlvDq8ikWAM";
          const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
          
          const response = await axios({
            method: 'POST',
            url: url,
            data: {
              text: chunk,
              model_id: "eleven_multilingual_v2",
              voice_settings: { stability: 0.5, similarity_boost: 0.5 }
            },
            headers: {
              'xi-api-key': config.voice.elevenLabsKey,
              'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer'
          });

          const buffer = Buffer.from(response.data);
          fs.writeFileSync(filePath, buffer);
          console.log(`✅ ElevenLabs exitoso para la parte ${i+1}. Tamaño: ${buffer.length} bytes.`);
          generatedFiles.push(filePath);
          success = true;
        } catch (error: any) {
          console.warn(`⚠️ ElevenLabs falló para la parte ${i+1}, intentando respaldo 1...`);
        }
      }

      // INTENTO 2: AMAZON POLLY (Lucia)
      if (config.voice.awsAccessKey && config.voice.awsSecretKey && !success) {
        try {
          console.log(`🎙️ Intentando Amazon Polly para la parte ${i+1} (Respaldo 1)...`);
          const polly = new PollyClient({
            region: config.voice.awsRegion,
            credentials: {
              accessKeyId: config.voice.awsAccessKey,
              secretAccessKey: config.voice.awsSecretKey
            }
          });

          const command = new SynthesizeSpeechCommand({
            OutputFormat: "mp3",
            Text: chunk,
            VoiceId: (config.voice.pollyVoice as any) || "Lucia",
            Engine: "neural"
          });
          
          const response = await polly.send(command);
          if (response.AudioStream) {
            const buffer = Buffer.from(await response.AudioStream.transformToByteArray());
            fs.writeFileSync(filePath, buffer);
            console.log(`✅ Amazon Polly exitoso para la parte ${i+1}. Tamaño: ${buffer.length} bytes.`);
            generatedFiles.push(filePath);
            success = true;
          }
        } catch (error: any) {
          console.warn(`⚠️ Amazon Polly falló para la parte ${i+1}. Error de AWS:`, error.message);
        }
      }

      // INTENTO 3: GOOGLE TTS (Respaldo final y sin fallos)
      if (!success) {
        try {
          console.log(`🎙️ Intentando Google TTS para la parte ${i+1} (Respaldo Final)...`);
          const audioData = await googleTTS.getAllAudioBase64(chunk, {
            lang: 'es',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
          });
          
          let completeAudio = Buffer.alloc(0);
          for (const piece of audioData) {
            completeAudio = Buffer.concat([completeAudio, Buffer.from(piece.base64, 'base64')]);
          }
          
          fs.writeFileSync(filePath, completeAudio);
          console.log(`✅ Google TTS exitoso para la parte ${i+1}. Tamaño: ${completeAudio.length} bytes.`);
          generatedFiles.push(filePath);
          success = true;
        } catch (error: any) {
          console.error(`❌ Todos los servicios de voz fallaron para la parte ${i+1}:`, error.message);
        }
      }
    }

    return generatedFiles;
  }
};
