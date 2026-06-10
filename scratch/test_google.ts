import * as googleTTS from 'google-tts-api';
import fs from 'fs';

async function test() {
  try {
    const url = googleTTS.getAudioUrl('Hola, esto es una prueba de voz con Google.', {
      lang: 'es',
      slow: false,
      host: 'https://translate.google.com',
    });
    console.log(url);
    const audioBase64 = await googleTTS.getAudioBase64('Hola, esto es una prueba de voz con Google.', {
        lang: 'es',
        slow: false,
        host: 'https://translate.google.com',
        timeout: 10000,
    });
    fs.writeFileSync('./temp_test/google.mp3', Buffer.from(audioBase64, 'base64'));
    console.log('✅ Listo google.mp3');
  } catch (err) {
    console.error(err);
  }
}
test();
