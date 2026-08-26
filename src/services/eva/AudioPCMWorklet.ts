// AudioPCMWorklet.ts
export const AudioPCMWorkletCode = `
class AudioPCMWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    // Obtener canal 0 (Mono)
    const channelData = input[0];
    const bufferLength = channelData.length;
    
    // Crear buffer Int16 PCM (16-bit de punto fijo)
    const pcmBuffer = new Int16Array(bufferLength);

    for (let i = 0; i < bufferLength; i++) {
      // Normalizar rango de float [-1.0, 1.0] a int16 [-32768, 32767]
      let s = Math.max(-1.0, Math.min(1.0, channelData[i]));
      pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Enviar el búfer PCM al hilo principal en formato Int16
    this.port.postMessage(pcmBuffer.buffer, [pcmBuffer.buffer]);

    return true;
  }
}

registerProcessor('pcm-worklet-processor', AudioPCMWorkletProcessor);
`;
