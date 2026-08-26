// SileroVADController.ts
import * as ort from 'onnxruntime-web';

export interface VADConfig {
  modelPath: string;
  threshold?: number;
  sampleRate?: number;
  preTriggerMs?: number; // Búfer circular de pre-voz (ej: 400ms)
  hangoverMs?: number; // Tolerancia al silencio infantil (ej: 750ms)
}

export class SileroVADController {
  private session: ort.InferenceSession | null = null;
  private config: Required<VADConfig>;
  
  // Búfer circular en memoria para capturar fonemas oclusivos iniciales
  private circularBuffer: Int16Array[] = [];
  private maxCircularFrames = 0;

  private isSpeaking = false;
  private hangoverTimeout: NodeJS.Timeout | null = null;

  private onSpeechStartCallback: (() => void) | null = null;
  private onSpeechEndCallback: ((voiceBuffer: Int16Array) => void) | null = null;

  // Variables recurrentas de estado del modelo Silero
  private hState: ort.Tensor | null = null;
  private cState: ort.Tensor | null = null;

  constructor(config: VADConfig, onSpeechStart: () => void, onSpeechEnd: (voiceBuffer: Int16Array) => void) {
    this.config = {
      modelPath: config.modelPath,
      threshold: config.threshold ?? 0.5,
      sampleRate: config.sampleRate ?? 16000,
      preTriggerMs: config.preTriggerMs ?? 400,
      hangoverMs: config.hangoverMs ?? 750
    };
    this.onSpeechStartCallback = onSpeechStart;
    this.onSpeechEndCallback = onSpeechEnd;

    // Calcular cuántos frames de 30ms (480 samples) caben en el búfer circular (ej: 400ms / 30ms ~ 13 frames)
    const samplesPerFrame = (this.config.sampleRate * 0.03); // 30ms = 480 samples
    this.maxCircularFrames = Math.ceil(this.config.preTriggerMs / 30);
    
    this.resetStates();
  }

  private resetStates() {
    // Silero requiere tensores de estado vacíos al inicio (2 capas, lote 1, dimensión 64)
    this.hState = new ort.Tensor('float32', new Float32Array(2 * 1 * 64), [2, 1, 64]);
    this.cState = new ort.Tensor('float32', new Float32Array(2 * 1 * 64), [2, 1, 64]);
    this.circularBuffer = [];
  }

  async init(): Promise<void> {
    if (this.session) return;
    ort.env.wasm.numThreads = 1;
    this.session = await ort.InferenceSession.create(this.config.modelPath, {
      executionProviders: ['wasm']
    });
    console.log("SileroVADController: Inicializado con éxito.");
  }

  async processPCMChunk(chunk: ArrayBuffer): Promise<void> {
    if (!this.session) return;

    // Convertir ArrayBuffer (PCM Int16) a Float32 normalizado para la red ONNX
    const int16Array = new Int16Array(chunk);
    
    // Guardar en búfer circular de pre-voz
    this.circularBuffer.push(int16Array);
    if (this.circularBuffer.length > this.maxCircularFrames) {
      this.circularBuffer.shift();
    }

    const float32Data = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Data[i] = int16Array[i] / 32768.0;
    }

    // Tensores de entrada exigidos por Silero VAD v4
    const inputTensor = new ort.Tensor('float32', float32Data, [1, float32Data.length]);
    const srTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(this.config.sampleRate)]), [1]);

    try {
      const feeds = {
        input: inputTensor,
        sr: srTensor,
        h: this.hState!,
        c: this.cState!
      };

      const output = await this.session.run(feeds);
      
      // Actualizar variables de estado del modelo
      this.hState = output.hn;
      this.cState = output.cn;

      const probability = (output.output.data as Float32Array)[0];

      if (probability >= this.config.threshold) {
        this.triggerSpeechStart();
      } else {
        this.triggerSpeechEnd();
      }
    } catch (error) {
      console.warn("SileroVADController: Error procesando predicción VAD:", error);
    }
  }

  private triggerSpeechStart() {
    if (this.hangoverTimeout) {
      clearTimeout(this.hangoverTimeout);
      this.hangoverTimeout = null;
    }

    if (!this.isSpeaking) {
      this.isSpeaking = true;
      console.log("🗣️ VAD: Voz de usuario detectada (Barge-In).");
      if (this.onSpeechStartCallback) {
        this.onSpeechStartCallback(); // Gatillo inmediato de interrupción del agente
      }
    }
  }

  private triggerSpeechEnd() {
    if (this.isSpeaking && !this.hangoverTimeout) {
      // Hangover de silencio adaptado a logopedia (ej: 750ms)
      this.hangoverTimeout = setTimeout(() => {
        this.isSpeaking = false;
        this.hangoverTimeout = null;
        console.log("🤫 VAD: Silencio detectado. Consolidando audios.");

        // Consolidar todo el historial de búferes grabados
        const voiceData = this.consolidateAudioBuffer();
        if (this.onSpeechEndCallback) {
          this.onSpeechEndCallback(voiceData);
        }
        
        // Resetear buffers para la siguiente alocución
        this.circularBuffer = [];
      }, this.config.hangoverMs);
    }
  }

  private consolidateAudioBuffer(): Int16Array {
    const totalLength = this.circularBuffer.reduce((acc, val) => acc + val.length, 0);
    const result = new Int16Array(totalLength);
    let offset = 0;
    for (const buf of this.circularBuffer) {
      result.set(buf, offset);
      offset += buf.length;
    }
    return result;
  }

  destroy() {
    if (this.hangoverTimeout) {
      clearTimeout(this.hangoverTimeout);
    }
    this.session = null;
    this.resetStates();
  }
}
