import * as googleTTS from 'google-tts-api';
import fs from 'fs';

async function test() {
  try {
    const audioBase64 = await googleTTS.getAllAudioBase64('Hola, esto es una prueba de voz con Google. Es un texto más largo para asegurar que funciona correctamente el método getAllAudioBase64 que puede procesar textos de más de 200 caracteres de longitud dividiendo la carga de manera eficiente y correcta. ' + 'a '.repeat(200), {
        lang: 'es',
        slow: false,
        host: 'https://translate.google.com',
        timeout: 10000,
    });
    // getAllAudioBase64 returns an array of objects: { shortText, base64 }
    let completeAudio = Buffer.alloc(0);
    for (const chunk of audioBase64) {
        completeAudio = Buffer.concat([completeAudio, Buffer.from(chunk.base64, 'base64')]);
    }

    fs.writeFileSync('./temp_test/google2.mp3', completeAudio);
    console.log('✅ Listo google2.mp3');
  } catch (err) {
    console.error(err);
  }
}
test();
